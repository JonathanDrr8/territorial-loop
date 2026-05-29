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
import { deserializeState } from './core/serialize'
import { getOwner } from './world/map'
import { hashState } from './core/hash'
import type { Intent } from './core/intent'
import { createRecorder } from './core/replay'
import { LocalTransport, NetworkTransport, type IntentTransport } from './net/transport'
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
import { pickRandomNames } from './ui/player-names'
import { createMultiplayerMenu, type MultiplayerMenuApi } from './ui/multiplayer-menu'
import { createFeedbackUi } from './ui/feedback-dialog'
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
import { createStartMenu, TEMPO_TO_SPEED, type StartMenuValues } from './ui/start-menu'

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
    const name = pickRandomNames(1)[0] ?? 'Spieler'
    window.localStorage.setItem(KEY, name)
    return name
  } catch {
    return pickRandomNames(1)[0] ?? 'Spieler'
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
  const names = pickRandomNames(aiCount)
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
      name: names[nameIdx++] ?? `KI ${String(i + 1)}`,
      color: colors[colorIdx++] ?? 0x00ff00ff,
      isHuman: false,
    })
  }
  for (let i = 0; i < menu.wildCount; i++) {
    players.push({
      id: id++,
      name: `Wilde ${String(i + 1)}`,
      color: wildColorVariant(i),
      isHuman: false,
      wild: true,
    })
  }

  return {
    mapWidth: menu.mapWidth,
    mapHeight: menu.mapHeight,
    seed,
    victoryPct: menu.victoryPct,
    matchSpeed: TEMPO_TO_SPEED[menu.tempo],
    terrain: menu.terrain,
    players,
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
  const config = net?.config ?? buildConfig(menu, spectator)
  const humanId = net?.humanId ?? SOLO_PLAYER_ID
  // „Du" für Renderer/HUD: Zuschauen → kein lokaler Spieler (-1); sonst die eigene ID
  // (Single: 1, MP: server-vergeben). Die interaktive Verdrahtung nutzt weiter `humanId`.
  const localHumanId = spectator ? -1 : humanId
  // Reconnect lädt den Server-Snapshot direkt als State; sonst frisch generieren.
  const state = net?.initialState ?? createGame(config)
  const renderer = createRenderer(container, state, localHumanId)
  renderer.setCameraMode(menu.cameraMode)
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
      confirmDialog.open(
        `${allyName} ist mit dir verbündet. Ein Angriff ist VERRAT: das Bündnis bricht, ` +
          `du wirst geächtet und nimmst eine Zeit lang 1,5× Schaden von allen. Trotzdem angreifen?`,
        () => rawSubmit(intent),
      )
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
        paused = !paused
        transport.setRunning(!paused)
        hud.setSpeed(paused ? 0 : speed)
      },
      cycleSpeed(dir): void {
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
        confirmDialog.open('Laufende Runde verlassen?', onRequestNewMatch)
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
    renderer.render()
    minimap.update()
    hud.update()
    // Bündnis-Panel zuerst, dann den Log darunter schieben (sonst überdeckt es ihn).
    alliancePrompt.update()
    const promptH = alliancePrompt.heightPx()
    eventLog.setTopOffset(promptH > 0 ? promptH + 8 : 0)
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
  el.textContent = 'Karte wird generiert …'
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

  // Dauerhaftes Feedback-/Bug-Widget (Menü + im Match) — schreibt an den Server (JSONL).
  createFeedbackUi(container, { endpoint: feedbackEndpoint(), version: __APP_VERSION__ })

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
      startNetSession(initial, transport, cfg, myId, snapState)
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
   * Öffnet die Mehrspieler-Lobby; bei Match-Start läuft die Session über den Server-Transport.
   * `autoJoinRoom` (aus dem Lobby-Browser) tritt einem Raum direkt bei.
   */
  function showLobby(initial: StartMenuValues, autoJoinRoom?: string): void {
    const settings: MatchSettings = {
      mapWidth: 256,
      mapHeight: 256,
      terrain: initial.terrain,
      seed: '',
      aiCount: 2,
      wildCount: 2,
      victoryPct: initial.victoryPct,
      difficulty: initial.difficulty,
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
      onMatchStart: (config, transport, humanId) => {
        lobby?.destroy()
        lobby = null
        // NetworkTransport puffert frühe Commits → synchroner Start ist sicher.
        startNetSession(initial, transport, config, humanId)
      },
    })
  }

  function showMenu(): void {
    const initial = loadMenuPrefs(DEFAULT_MENU)
    const activeSession = loadActiveSession()
    const menu = createStartMenu(
      container,
      initial,
      (values, spectator) => {
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
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              session = startMatch(container, values, backToMenu, spectator)
            } finally {
              removeLoading()
            }
          })
        })
      },
      () => {
        menu.destroy()
        showLobby(initial)
      },
      // Lobby-Browser (linke Spalte): Klick auf eine offene Lobby tritt direkt bei.
      (code) => {
        menu.destroy()
        showLobby(initial, code)
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

  // Einladungslink (?room=CODE) → direkt in die Lobby dieses Raums (auch für private Lobbys).
  const roomParam = new URLSearchParams(window.location.search).get('room')
  if (roomParam !== null && roomParam.length > 0) {
    history.replaceState(null, '', window.location.pathname) // ?room= entfernen (kein Re-Trigger)
    showLobby(loadMenuPrefs(DEFAULT_MENU), roomParam.toUpperCase())
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
