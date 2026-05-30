/**
 * Entry-Point: Boot, Start-Menü, Match-Session-Management.
 *
 * Die eigentliche Spiel-Logik lebt in `core/`, `world/`, `render/`, `input/`,
 * `ai/`, `ui/`. Diese Datei macht nur Boot-Wiring und den Lebenszyklus einer
 * Match-Session (Start-Menü → laufendes Match → Sieg → Neues Match).
 */

import { createAI, type AI } from './ai/ai'
import {
  canBuildAt,
  createGame,
  snapBuildTile,
  tick,
  type GameConfig,
  type GameState,
  type PlayerDef,
} from './core/game'
import { areAllied } from './core/diplomacy'
import { deserializeState, loadSnapshotInto } from './core/serialize'
import { getOwner } from './world/map'
import { hashState } from './core/hash'
import type { Intent } from './core/intent'
import { createRecorder } from './core/replay'
import { APP_VERSION } from 'virtual:app-version'
import { LocalTransport, NetworkTransport, type IntentTransport } from './net/transport'
import { t } from './i18n'
import { createInputHandler, type InputHandler } from './input/input'
import { createRenderer } from './render/renderer'
import { createBuildMenu } from './ui/build-menu'
import { pickDistinctColors } from './ui/colors'
import { createConfirmDialog } from './ui/confirm-dialog'
import { createEventLog } from './ui/event-log'
import { createAlliancePrompt } from './ui/alliance-prompt'
import { createHoverTooltip } from './ui/hover-tooltip'
import { createHUD } from './ui/hud'
import { createMinimap } from './ui/minimap'
import { isGeoMapId, loadGeoMapAsset } from './ui/geo-loader'
import { pickRandomNames } from './ui/player-names'
import { createMultiplayerMenu, type MultiplayerMenuApi } from './ui/multiplayer-menu'
import { createFeedbackUi } from './ui/feedback-dialog'
import { clearScalables, createUiScaleSlider } from './ui/ui-scale'
import type { MatchSettings } from './net/protocol'
import {
  clearActiveSession,
  loadActiveSession,
  loadMenuPrefs,
  loadServerUrl,
  saveActiveSession,
  saveMenuPrefs,
  saveServerUrl,
  type ActiveSession,
} from './ui/preferences'
import { createSoundEngine } from './ui/sound'
import { TEMPO_TO_SPEED, type StartMenuValues } from './ui/start-menu'
import { createMenuShell } from './ui/menu-shell'

const SOLO_PLAYER_ID = 1
const SIM_BASE_INTERVAL_MS = 100
const DEFAULT_SLIDER_PCT = 30

/**
 * Default-Lockstep-Server-URL: lokal (Dev) der mitlaufende Server auf :8787, sonst **dieselbe
 * Origin** wie die ausgelieferte Seite (ein Node-Server liefert Client + Lockstep, z.B.
 * `wss://loop.jarhost.de`). Im Mehrspieler-Dialog weiterhin überschreibbar.
 */
function defaultServerUrl(): string {
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host === '') return 'ws://localhost:8787'
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}`
}

/** HTTP(S)-Basis für Feedback-POSTs (gleicher Server wie Lockstep): ws→http, wss→https. */
function feedbackEndpoint(): string {
  return defaultServerUrl().replace(/^ws/, 'http')
}

/**
 * Default-Spielername: ein pro Browser **persistierter Zufallsname** (statt „Du", sonst heißen
 * alle gleich — im Mehrspieler bricht das sogar das namensbasierte Reconnect). Stabil über Reloads.
 */
function defaultPlayerName(): string {
  const KEY = 'territorial-loop:player-name:v1'
  try {
    const saved = window.localStorage.getItem(KEY)
    if (saved !== null && saved.length > 0) return saved
    const name = pickRandomNames(1)[0] ?? 'Nation'
    window.localStorage.setItem(KEY, name)
    return name
  } catch {
    return pickRandomNames(1)[0] ?? 'Nation'
  }
}

const DEFAULT_MENU: StartMenuValues = {
  playerName: defaultPlayerName(),
  mapWidth: 1024,
  mapHeight: 1024,
  aiCount: 3,
  wildCount: 2,
  victoryPct: 90,
  difficulty: 'normal',
  tempo: 'normal',
  terrain: 'continents',
  soundEnabled: true,
  cameraMode: 'period',
  allowedBuildings: { city: true, defense: true, port: true, factory: true },
  rivers: true, // Flüsse standardmäßig an (reguläres Match-Toggle, ADR-0015)
  experimental: {},
}

/** Gedämpfte Einheitsfarbe für wilde Nationen (neutral, hebt sich von Spielern ab). */
const WILD_COLOR = 0x8f8a78ff

/**
 * Leichte, deterministische Farbvariation pro wilder Nation (um die feste, erdige
 * WILD_COLOR herum), damit sich bei vielen Wilden benachbarte Gebiete unterscheiden
 * lassen — ohne aus dem gedämpften „Barbaren"-Look auszubrechen. Rein kosmetisch.
 */
function wildColorVariant(i: number): number {
  const jitter = (seed: number, range: number): number => {
    const h = Math.sin(seed) * 43758.5453
    return Math.round((h - Math.floor(h)) * range * 2 - range)
  }
  const clamp = (v: number): number => Math.max(64, Math.min(190, v))
  const r = clamp(((WILD_COLOR >>> 24) & 0xff) + jitter(i * 12.9898 + 1, 30))
  const g = clamp(((WILD_COLOR >>> 16) & 0xff) + jitter(i * 78.233 + 2, 28))
  const b = clamp(((WILD_COLOR >>> 8) & 0xff) + jitter(i * 37.719 + 3, 26))
  return ((r << 24) | (g << 16) | (b << 8) | 0xff) >>> 0
}

interface MatchSession {
  destroy(): void
}

function buildConfig(menu: StartMenuValues, spectator: boolean): GameConfig {
  const aiCount = spectator ? 1 + menu.aiCount : menu.aiCount // im Spectator ist der „erste" auch KI
  const humanCount = spectator ? 0 : 1
  const colors = pickDistinctColors(humanCount + aiCount) // Wilde nutzen WILD_COLOR-Varianten
  // Echte Eigennamen für KI UND Wilde aus demselben Pool (sprach-neutral, keine Doppelte) —
  // wild-Status wird im UI über das `wild`-Flag als übersetztes Kürzel markiert, nicht über den Namen.
  const names = pickRandomNames(aiCount + menu.wildCount)
  const seed =
    menu.seed !== undefined && menu.seed.length > 0 ? menu.seed : 'match-' + Date.now().toString()

  const players: PlayerDef[] = []
  let id = SOLO_PLAYER_ID
  let colorIdx = 0
  let nameIdx = 0
  if (!spectator) {
    players.push({
      id: id++,
      name: menu.playerName,
      color: colors[colorIdx++] ?? 0xff0000ff,
      isHuman: true,
    })
  }
  for (let i = 0; i < aiCount; i++) {
    players.push({
      id: id++,
      name: names[nameIdx++] ?? `Nation ${String(i + 1)}`,
      color: colors[colorIdx++] ?? 0x00ff00ff,
      isHuman: false,
    })
  }
  for (let i = 0; i < menu.wildCount; i++) {
    players.push({
      id: id++,
      name: names[nameIdx++] ?? `Nation ${String(aiCount + i + 1)}`,
      color: wildColorVariant(i),
      isHuman: false,
      wild: true,
    })
  }

  // Geo-Karte (ADR-0016): terrain kommt als Asset über die mapId; die Dimensionen wurden vor
  // startMatch aus dem geladenen Asset in menu.mapWidth/mapHeight übernommen. `terrain` bleibt
  // gesetzt (von createGame ignoriert, wenn mapId vorliegt), damit der Typ stimmt.
  const geoId = isGeoMapId(menu.terrain) ? menu.terrain : undefined
  return {
    mapWidth: menu.mapWidth,
    mapHeight: menu.mapHeight,
    seed,
    victoryPct: menu.victoryPct,
    matchSpeed: TEMPO_TO_SPEED[menu.tempo],
    terrain: isGeoMapId(menu.terrain) ? 'continents' : menu.terrain,
    rivers: menu.rivers,
    allowedBuildings: menu.allowedBuildings,
    players,
    ...(geoId !== undefined ? { mapId: geoId } : {}),
  }
}

/**
 * Mehrspieler-Sitzung: ein bereits verbundener `NetworkTransport`, die vom Server gelieferte
 * Config und die eigene (server-vergebene) Spieler-ID. Ist das gesetzt, läuft das Match über
 * den Server (KI auf dem Server, keine lokale KI/Takt-Uhr).
 */
interface NetSession {
  transport: NetworkTransport
  config: GameConfig
  humanId: number
  /** Ob dieser Client der Host ist — nur der Host darf das Match pausieren. */
  isHost: boolean
  /** Bei Reconnect: bereits aus dem Server-Snapshot deserialisierter State (statt createGame). */
  initialState?: GameState
}

function startMatch(
  container: HTMLElement,
  menu: StartMenuValues,
  onRequestNewMatch: () => void,
  spectator: boolean,
  net?: NetSession,
): MatchSession {
  clearScalables() // UI-Größen-Registry leeren — die HUD-Panels dieses Matches melden sich neu an
  const config = net?.config ?? buildConfig(menu, spectator)
  const humanId = net?.humanId ?? SOLO_PLAYER_ID
  // „Du" für Renderer/HUD: Zuschauen → kein lokaler Spieler (-1); sonst die eigene ID
  // (Single: 1, MP: server-vergeben). Die interaktive Verdrahtung nutzt weiter `humanId`.
  const localHumanId = spectator ? -1 : humanId
  // Reconnect lädt den Server-Snapshot direkt als State; sonst frisch generieren.
  const state = net?.initialState ?? createGame(config)
  const renderer = createRenderer(container, state, localHumanId)
  // Geo-Karten (ADR-0016) sind meer-umrandete Kontinent-Ausschnitte → fest „Box (fest)" (eine
  // Welt-Kopie + harte Ränder), damit sie nicht kacheln/wrappen. Prozedural: Menü-Wahl.
  renderer.setCameraMode(config.mapId !== undefined ? 'fixed' : menu.cameraMode)
  // Kamera nach dem Generieren exakt auf das eigene Spawn zentrieren — sonst weiß
  // man auf großen Karten nicht, wo man ist. (Erneut im ersten Render-Frame, falls
  // das Canvas hier noch nicht final dimensioniert ist.)
  renderer.centerOnPlayer(humanId)
  let recenterPending = true
  const sound = createSoundEngine()
  sound.setEnabled(menu.soundEnabled)
  ;(window as unknown as { __TL__: unknown }).__TL__ = {
    state,
    renderer,
    sound,
    config,
    // Replay-Log des laufenden Matches: replayGame({config, turns: __TL__.recorder.turns()}).
    get recorder() {
      return recorder
    },
  }

  let lastPhase: 'running' | 'ended' = state.phase
  let endChimePlayed = false
  // „Du wirst angegriffen"-Ton: Set der Nationen, die gerade DICH angreifen; ein neuer Angreifer
  // löst den Alarm aus (mit Abklingzeit, damit es bei vielen Fronten nicht hämmert).
  let prevIncomingAttackers = new Set<number>()
  let lastAlarmTick = -Infinity
  const ALARM_COOLDOWN_TICKS = 25

  let sliderPct = DEFAULT_SLIDER_PCT
  let paused = false
  let speed: 1 | 2 | 5 = 1
  let renderRafId: number | null = null
  let destroyed = false

  // Sim-Naht (ADR-0009): UI/Eingabe reichen Intents per `submit` ein, `tick()` läuft aus
  // `onCommitted`. Single-Player: LocalTransport mit lokaler Takt-Uhr + lokaler KI. Mehrspieler:
  // der schon verbundene NetworkTransport (KI + Takt auf dem Server).
  const ais: AI[] = []
  if (net === undefined) {
    for (const p of state.players.values()) {
      if (p.isHuman) continue
      // Wilde Nationen bekommen eine passive KI (expandieren v.a. in neutrales Land, greifen
      // zurückhaltend an, bauen/diplomatisieren nie) — sonst die normale KI je Schwierigkeit.
      ais.push(createAI(p.id, state.seed, menu.difficulty, p.wild))
    }
  }

  const transport: IntentTransport =
    net?.transport ??
    new LocalTransport({
      produceServerIntents: () => {
        const aiIntents: Intent[] = []
        for (const ai of ais) {
          for (const intent of ai.decide(state)) aiIntents.push(intent)
        }
        return aiIntents
      },
      intervalMs: SIM_BASE_INTERVAL_MS,
      running: true,
    })
  // Jeden committeten Turn mitschneiden → ein Replay-Log (config + turns) reproduziert das
  // Match bit-genau (ADR-0009 Phase 3). Für Desync-Repro/Debugging über `__TL__` erreichbar.
  const recorder = createRecorder()
  transport.onCommitted((turn, intents) => {
    recorder.record(turn, intents)
    tick(state, intents)
    // Im Mehrspieler dem Server den eigenen Hash melden → Desync-Erkennung (→ Snapshot).
    net?.transport.reportHash(turn, hashState(state))
  })
  const rawSubmit = (intent: Intent): void => {
    transport.submit([intent])
  }

  /**
   * Liefert den Namen des verbündeten Ziels, wenn der Intent ein Angriff/Boot auf eine
   * verbündete Nation ist — sonst `null`. Grundlage für die Verrats-Warnung.
   */
  const treasonAllyName = (intent: Intent): string | null => {
    if (intent.type !== 'attack' && intent.type !== 'boat') return null
    const tile = intent.targetTile
    if (tile < 0 || tile >= state.map.state.length) return null
    const owner = getOwner(state.map, tile)
    if (owner <= 0 || owner === humanId) return null
    if (!areAllied(state.alliances, humanId, owner)) return null
    return state.players.get(owner)?.name ?? null
  }

  // Angriff/Boot auf einen Verbündeten erst nach Bestätigung absenden (= Verrat, Ächtung).
  const submit = (intent: Intent): void => {
    const allyName = treasonAllyName(intent)
    if (allyName !== null) {
      confirmDialog.open(t('confirm.treason', { ally: allyName }), () => rawSubmit(intent))
      return
    }
    rawSubmit(intent)
  }

  let inputHandler: InputHandler | null = null

  const hud = createHUD(
    container,
    state,
    (pct) => {
      sliderPct = pct
    },
    onRequestNewMatch,
    (type) => inputHandler?.toggleBuildMode(type),
    () => inputHandler?.toggleBoatMode(),
    (attackIndex) => submit({ type: 'cancel-attack', playerId: humanId, attackIndex }),
    (boatIndex) => submit({ type: 'boat-recall', playerId: humanId, boatIndex }),
    (warshipIndex) => submit({ type: 'recall-warship', playerId: humanId, warshipIndex }),
    (attackerId) =>
      submit({
        type: 'defend',
        playerId: humanId,
        attackerId,
        troops: Math.floor(((state.players.get(humanId)?.troops ?? 0) * sliderPct) / 100),
      }),
    (tile) => {
      // ⌖ „Zum Kampf springen": Kamera auf das (Front-)Tile zentrieren.
      const w = state.map.width
      renderer.camera.x = (tile % w) + 0.5
      renderer.camera.y = Math.floor(tile / w) + 0.5
    },
    localHumanId,
  )

  // Mid-Match-Resync (ADR-0009 Phase 6): erkennt der Server einen Desync (aus `reportHash`),
  // schickt er einen Korrektur-Snapshot. Den laden wir IN-PLACE in den laufenden State — alle
  // Closure-Halter (Renderer/HUD/Minimap) sehen die Korrektur sofort — backen das Bitmap neu
  // und blitzen kurz „Resync…" auf. So schnappt ein abgedrifteter Client zurück, statt still
  // weiter zu driften.
  net?.transport.setSnapshotHandler((_turn, snap) => {
    loadSnapshotInto(state, snap)
    renderer.invalidate()
    hud.flashResync()
  })
  // HUD am Debug-Hook erreichbar (z.B. `__TL__.hud.flashResync()` zum Desync-UI-Testen).
  ;(window as unknown as { __TL__: { hud?: unknown } }).__TL__.hud = hud

  // MP-Host-Pause: der Server broadcastet den autoritativen Pause-Zustand. Während Pause kommen
  // keine Commits → der Sim steht ohnehin still; hier nur die Anzeige (PAUSE-Overlay) nachziehen.
  net?.transport.setPauseHandler((p) => {
    paused = p
    hud.setSpeed(p ? 0 : speed)
  })

  const minimap = createMinimap({
    container,
    state,
    camera: renderer.camera,
    getBitmap: renderer.getBitmap,
    getViewportSize: () => ({
      width: renderer.canvas.clientWidth,
      height: renderer.canvas.clientHeight,
    }),
  })

  const tooltip = createHoverTooltip(
    container,
    state,
    humanId,
    () => Math.floor(((state.players.get(humanId)?.troops ?? 0) * sliderPct) / 100),
    (h) => renderer.setHoverHighlight(h),
  )
  const eventLog = createEventLog(container, state)
  const alliancePrompt = createAlliancePrompt(
    container,
    state,
    humanId,
    (requesterId) =>
      submit({
        type: 'accept-alliance',
        playerId: humanId,
        targetPlayerId: requesterId,
      }),
    (requesterId) => submit({ type: 'decline-alliance', playerId: humanId, requesterId }),
    () => sound.alliance(),
  )
  const buildMenu = createBuildMenu(
    container,
    state,
    humanId,
    (intent) => submit(intent),
    () => Math.floor(((state.players.get(humanId)?.troops ?? 0) * sliderPct) / 100),
  )

  const confirmDialog = createConfirmDialog(container)

  const input = createInputHandler({
    canvas: renderer.canvas,
    camera: renderer.camera,
    mapWidth: state.map.width,
    mapHeight: state.map.height,
    playerId: humanId,
    interactive: !spectator,
    cameraMode: menu.cameraMode,
    emit: (intent) => submit(intent),
    getPlayerTroops: () => state.players.get(humanId)?.troops ?? 0,
    getSliderPct: () => sliderPct,
    setSliderPct: (pct) => {
      sliderPct = pct
      hud.setSliderPct(pct)
    },
    onAttackClick: (x, y) => {
      renderer.addClickMarker(x, y)
      sound.click()
    },
    onHover: (worldX, worldY, screenX, screenY) => {
      tooltip.show(worldX, worldY, screenX, screenY, renderer.camera.zoom)
      renderer.setHoverTile(worldX, worldY)
    },
    onHoverEnd: () => {
      tooltip.hide()
      renderer.clearHoverTile()
    },
    onBuildModeChange: (mode) => {
      hud.setBuildMode(mode)
      renderer.setBuildPreview(mode)
    },
    onBoatModeChange: (on) => {
      hud.setBoatMode(on)
    },
    onToggleShipRanges: () => renderer.toggleShipRanges(),
    onSelectionBox: (box) => renderer.setSelectionBox(box),
    onBoxSelect: (box) => renderer.selectWarshipsInBox(box),
    hasWarshipSelection: () => renderer.hasWarshipSelection(),
    onMoveWarships: (tile) => {
      const indices = renderer.selectedWarshipIndices()
      if (indices.length > 0)
        submit({
          type: 'move-warship',
          playerId: humanId,
          warshipIndices: indices,
          targetTile: tile,
        })
    },
    onClearWarshipSelection: () => renderer.clearWarshipSelection(),
    onRadialMenu: (tile, screenX, screenY) => {
      buildMenu.open(tile, screenX, screenY)
    },
    canPlaceBuilding: (tile, type) => canBuildAt(state, humanId, tile, type),
    snapBuildTarget: (tile, type) => snapBuildTile(state, humanId, tile, type),
    events: {
      pause(): void {
        if (net !== undefined) {
          // MP: nur der Host darf pausieren — echt über den Server (Uhr hält an, alle sehen es).
          // Der lokale Zustand/HUD wird über den server-broadcasteten `match-paused` nachgezogen.
          if (net.isHost) net.transport.requestPause(!paused)
          return
        }
        paused = !paused
        transport.setRunning(!paused)
        hud.setSpeed(paused ? 0 : speed)
      },
      cycleSpeed(dir): void {
        if (net !== undefined) return // MP: festes Standard-Tempo, kein Tempo-Wechsel
        const levels: readonly (1 | 2 | 5)[] = [1, 2, 5]
        const idx = levels.indexOf(speed)
        const next = levels[Math.max(0, Math.min(levels.length - 1, idx + dir))]
        if (next === undefined || next === speed) return
        speed = next
        transport.setIntervalMs(SIM_BASE_INTERVAL_MS / speed)
        if (!paused) hud.setSpeed(speed)
      },
      escape(): void {
        if (buildMenu.isOpen()) {
          buildMenu.close()
          return
        }
        // Offenen Bestätigungs-Dialog mit Esc wieder schließen (nicht beenden).
        if (confirmDialog.isOpen()) {
          confirmDialog.close()
          return
        }
        // Nicht sofort raus — erst nachfragen (versehentliches Runden-Ende vermeiden).
        confirmDialog.open(t('confirm.leaveRound'), onRequestNewMatch)
      },
    },
  })

  inputHandler = input

  hud.setSpeed(speed)

  function renderLoop(): void {
    if (destroyed) return
    // Erste Zentrierung wiederholen, sobald das Canvas garantiert final dimensioniert
    // ist (initialer Aufruf kann vor dem finalen Layout passieren).
    if (recenterPending) {
      recenterPending = false
      renderer.centerOnPlayer(humanId)
    }
    // Sieg-/Niederlage-Ton genau einmal beim Phasen-Wechsel
    if (state.phase === 'ended' && lastPhase === 'running' && !endChimePlayed) {
      endChimePlayed = true
      if (state.winner === humanId) {
        sound.victory()
      } else {
        sound.defeat()
      }
    }
    lastPhase = state.phase
    // Neuer eingehender Angriff auf dich → kurzer Alarm-Ton (nicht im Zuschauer-Modus).
    if (humanId >= 0 && state.phase === 'running') {
      const cur = new Set<number>()
      let newThreat = false
      for (const p of state.players.values()) {
        for (const atk of p.attacks) {
          if (atk.targetPlayerId === humanId) {
            cur.add(p.id)
            if (!prevIncomingAttackers.has(p.id)) newThreat = true
          }
        }
      }
      prevIncomingAttackers = cur
      if (newThreat && state.tick - lastAlarmTick >= ALARM_COOLDOWN_TICKS) {
        lastAlarmTick = state.tick
        sound.alarm()
      }
    }
    renderer.render()
    minimap.update()
    hud.update()
    // Bündnis-Panel zuerst, dann den Log darunter schieben (sonst überdeckt es ihn).
    alliancePrompt.update()
    // Bündnis-Anfragen liegen jetzt links → der Log (rechts) braucht keinen Versatz mehr.
    eventLog.setTopOffset(0)
    eventLog.update()
    renderRafId = requestAnimationFrame(renderLoop)
  }
  renderRafId = requestAnimationFrame(renderLoop)

  console.info('[territorial-loop] Match gestartet:', menu)

  return {
    destroy(): void {
      destroyed = true
      transport.destroy()
      if (renderRafId !== null) {
        cancelAnimationFrame(renderRafId)
        renderRafId = null
      }
      input.destroy()
      hud.destroy()
      minimap.destroy()
      tooltip.destroy()
      eventLog.destroy()
      alliancePrompt.destroy()
      buildMenu.destroy()
      confirmDialog.destroy()
      renderer.destroy()
      sound.destroy()
    },
  }
}

/** Zeigt ein zentriertes „Karte wird generiert…"-Overlay; gibt eine Entfernen-Funktion zurück. */
function showLoadingOverlay(container: HTMLElement): () => void {
  const el = document.createElement('div')
  el.style.cssText = [
    'position: absolute',
    'inset: 0',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'background: #0b0b12',
    'color: rgba(255,255,255,0.85)',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 18px',
    'z-index: 50',
  ].join(';')
  el.textContent = t('loading.map')
  container.appendChild(el)
  return () => {
    el.remove()
  }
}

function main(): void {
  const maybeContainer = document.getElementById('game')
  if (maybeContainer === null) {
    throw new Error('No #game container in DOM')
  }
  const container: HTMLElement = maybeContainer
  container.textContent = ''
  container.style.position = 'relative'

  // Dauerhaftes Feedback-/Bug-Widget (im Match: schwebender Knopf; im Menü: Footer-Eintrag, da der
  // Knopf hinter dem Menü-Overlay liegt) — schreibt an den Server (JSONL).
  const feedbackUi = createFeedbackUi(container, {
    endpoint: feedbackEndpoint(),
    version: APP_VERSION,
  })
  // UI-Größen-Slider (unten links über dem Feedback-Knopf) — skaliert das ganze In-Game-HUD.
  createUiScaleSlider(container)

  let session: MatchSession | null = null
  let lobby: MultiplayerMenuApi | null = null

  /** Beendet eine evtl. laufende Session und kehrt ins Start-Menü zurück (absichtliches Verlassen). */
  function backToMenu(): void {
    clearActiveSession() // absichtlich verlassen → kein „Wieder verbinden" mehr
    if (session !== null) {
      session.destroy()
      session = null
    }
    showMenu()
  }

  /**
   * Startet eine Mehrspieler-Match-Session über den Server-Transport und hängt den
   * Abbruch-Handler an: bricht die Verbindung UNERWARTET ab, geht es zurück ins Menü — die
   * gespeicherte Sitzung bleibt, sodass dort „Wieder verbinden" erscheint.
   */
  function startNetSession(
    initial: StartMenuValues,
    transport: NetworkTransport,
    config: GameConfig,
    humanId: number,
    isHost: boolean,
    initialState?: GameState,
  ): void {
    transport.onDisconnect(() => {
      if (session !== null) {
        session.destroy()
        session = null
      }
      showMenu() // aktive Sitzung NICHT löschen → Reconnect-Button erscheint
    })
    session = startMatch(container, initial, backToMenu, false, {
      transport,
      config,
      humanId,
      isHost,
      ...(initialState !== undefined ? { initialState } : {}),
    })
  }

  /**
   * Verbindet erneut mit einer unterbrochenen Sitzung: tritt demselben Raum/Slot bei, lädt den
   * Server-Snapshot und spielt weiter. Schlägt das fehl (Raum weg, Timeout), zurück ins Menü.
   */
  function reconnect(sess: ActiveSession): void {
    const initial = loadMenuPrefs(DEFAULT_MENU)
    const removeLoading = showLoadingOverlay(container)
    let cfg: GameConfig | null = null
    let snapState: GameState | null = null
    let myId = 0
    let built = false
    const tryBuild = (): void => {
      if (built || cfg === null || snapState === null) return
      built = true
      window.clearTimeout(failTimer)
      removeLoading()
      // Reconnect kennt den Host-Status nicht (kein Lobby-Abo) → konservativ kein Host-Recht.
      startNetSession(initial, transport, cfg, myId, false, snapState)
    }
    const transport = new NetworkTransport({
      url: sess.serverUrl,
      room: sess.room,
      name: sess.name,
      onJoined: (id) => {
        myId = id
      },
      onStart: (c) => {
        cfg = c
        tryBuild()
      },
      onSnapshot: (_turn, state) => {
        snapState = deserializeState(state)
        tryBuild()
      },
    })
    const failTimer = window.setTimeout(() => {
      if (built) return
      transport.destroy()
      clearActiveSession() // Raum vermutlich weg → Sitzung verwerfen
      removeLoading()
      showMenu()
    }, 8000)
  }

  /**
   * Tritt einem laufenden Match als reiner Zuschauer bei (kein Spieler-Slot): Server schickt
   * start + Snapshot, danach folgt der Client den Commits. Keine Eingabe, kein Reconnect-Slot.
   */
  function spectate(code: string): void {
    const initial = loadMenuPrefs(DEFAULT_MENU)
    const removeLoading = showLoadingOverlay(container)
    let cfg: GameConfig | null = null
    let snapState: GameState | null = null
    let built = false
    const tryBuild = (): void => {
      if (built || cfg === null || snapState === null) return
      built = true
      window.clearTimeout(failTimer)
      removeLoading()
      transport.onDisconnect(() => {
        if (session !== null) {
          session.destroy()
          session = null
        }
        showMenu()
      })
      session = startMatch(container, initial, backToMenu, true, {
        transport,
        config: cfg,
        humanId: -1,
        isHost: false, // Zuschauer pausieren nie
        initialState: snapState,
      })
    }
    const transport = new NetworkTransport({
      url: loadServerUrl(defaultServerUrl()),
      room: code,
      name: initial.playerName,
      spectate: true,
      onStart: (c) => {
        cfg = c
        tryBuild()
      },
      onSnapshot: (_turn, state) => {
        snapState = deserializeState(state)
        tryBuild()
      },
    })
    const failTimer = window.setTimeout(() => {
      if (built) return
      transport.destroy()
      removeLoading()
      showMenu()
    }, 8000)
  }

  /**
   * Öffnet die Mehrspieler-Lobby; bei Match-Start läuft die Session über den Server-Transport.
   * `autoJoinRoom` (aus dem Lobby-Browser) tritt einem Raum direkt bei.
   */
  function showLobby(initial: StartMenuValues, autoJoinRoom?: string): void {
    const settings: MatchSettings = {
      mapWidth: 256,
      mapHeight: 256,
      // Geo-Karten sind im Mehrspieler noch nicht unterstützt (Server lädt kein Asset) → prozedural.
      terrain: isGeoMapId(initial.terrain) ? 'continents' : initial.terrain,
      seed: '',
      aiCount: 2,
      wildCount: 2,
      victoryPct: initial.victoryPct,
      difficulty: initial.difficulty,
      rivers: initial.rivers,
      allowedBuildings: initial.allowedBuildings,
      public: true,
    }
    lobby = createMultiplayerMenu(container, {
      defaultServerUrl: loadServerUrl(defaultServerUrl()),
      defaultName: initial.playerName,
      defaultSettings: settings,
      saveServerUrl,
      saveActiveSession,
      ...(autoJoinRoom !== undefined ? { autoJoinRoom } : {}),
      onBack: () => {
        lobby?.destroy()
        lobby = null
        showMenu()
      },
      onMatchStart: (config, transport, humanId, isHost) => {
        lobby?.destroy()
        lobby = null
        // NetworkTransport puffert frühe Commits → synchroner Start ist sicher.
        startNetSession(initial, transport, config, humanId, isHost)
      },
    })
  }

  function showMenu(): void {
    const initial = loadMenuPrefs(DEFAULT_MENU)
    const activeSession = loadActiveSession()
    const menu = createMenuShell(
      container,
      initial,
      {
        onStart: (values, spectator) => {
          saveMenuPrefs(values)
          clearActiveSession() // ein frisches (Single-)Match verwirft eine alte MP-Sitzung
          menu.destroy()
          if (session !== null) {
            session.destroy()
            session = null
          }
          // Große Karten: Gen + Komponenten-Labeling kosten Zeit. Overlay zeigen und
          // den schweren Start auf den übernächsten Frame schieben, damit es sichtbar ist.
          const removeLoading = showLoadingOverlay(container)
          const proceed = (startValues: StartMenuValues): void => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                try {
                  session = startMatch(container, startValues, backToMenu, spectator)
                } finally {
                  removeLoading()
                }
              })
            })
          }
          // Geo-Karte (ADR-0016): erst das Asset laden/registrieren, dann mit dessen Dimensionen
          // starten. Prozedurale Karten starten direkt.
          if (isGeoMapId(values.terrain)) {
            loadGeoMapAsset(values.terrain)
              .then((m) => proceed({ ...values, mapWidth: m.width, mapHeight: m.height }))
              .catch((err: unknown) => {
                removeLoading()
                console.error('Geo-Karte konnte nicht geladen werden', err)
                backToMenu()
              })
          } else {
            proceed(values)
          }
        },
        onMultiplayer: (values) => {
          saveMenuPrefs(values)
          menu.destroy()
          showLobby(values)
        },
        // Lobby-Browser: Klick auf eine offene Lobby tritt direkt bei.
        onJoinLobby: (code, values) => {
          saveMenuPrefs(values)
          menu.destroy()
          showLobby(values, code)
        },
        // Lobby-Browser: Klick auf ein laufendes Spiel → als Zuschauer beitreten.
        onSpectate: (code) => {
          menu.destroy()
          spectate(code)
        },
        onFeedback: () => feedbackUi.open(),
      },
      loadServerUrl(defaultServerUrl()),
    )

    // „Wieder verbinden": nur zeigen, wenn der Server bestätigt, dass der Raum/Slot wirklich noch
    // rejoinable ist (sonst hängt ein toter Knopf für längst beendete Räume — „Leiche").
    if (activeSession !== null) {
      const q = new URLSearchParams({ room: activeSession.room, name: activeSession.name })
      fetch(`${feedbackEndpoint()}/rejoinable?${q.toString()}`)
        .then((r) => r.json() as Promise<{ rejoinable?: boolean }>)
        .then((j) => {
          if (j.rejoinable === true) {
            menu.showReconnect(activeSession.room, () => {
              menu.destroy()
              reconnect(activeSession)
            })
          } else {
            clearActiveSession() // Raum weg/Match vorbei → Sitzung verwerfen
          }
        })
        .catch(() => {
          /* Server nicht erreichbar → keinen Knopf zeigen */
        })
    }
  }

  // Einladungslink → direkt in die Lobby dieses Raums (auch für private Lobbys). Bevorzugt das
  // pfad-basierte Schema `/r/CODE` (hübsch teilbar), mit `?room=CODE` als Fallback (Alt-Links).
  const pathMatch = /^\/r\/([A-Za-z0-9]+)\/?$/.exec(window.location.pathname)
  const roomFromUrl =
    pathMatch?.[1] ?? new URLSearchParams(window.location.search).get('room') ?? ''
  if (roomFromUrl.length > 0) {
    history.replaceState(null, '', '/') // Code aus der URL entfernen (kein Re-Trigger bei Reload)
    showLobby(loadMenuPrefs(DEFAULT_MENU), roomFromUrl.toUpperCase())
    console.info('[territorial-loop] Boot complete (Einladung → Lobby)')
  } else {
    showMenu()
    console.info('[territorial-loop] Boot complete (start menu shown)')
  }
}

try {
  main()
} catch (err) {
  console.error('[territorial-loop] Boot failed:', err)
  const root = document.getElementById('game')
  if (root !== null) {
    root.style.color = '#f88'
    root.style.padding = '20px'
    root.style.fontFamily = 'monospace'
    root.textContent =
      'Fehler beim Booten — siehe Browser-Konsole. ' +
      (err instanceof Error ? err.message : String(err))
  }
}
