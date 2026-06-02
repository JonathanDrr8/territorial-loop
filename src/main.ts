/**
 * Entry-Point: Boot, Start-Menü, Match-Session-Management.
 *
 * Die eigentliche Spiel-Logik lebt in `core/`, `world/`, `render/`, `input/`,
 * `ai/`, `ui/`. Diese Datei macht nur Boot-Wiring und den Lebenszyklus einer
 * Match-Session (Start-Menü → laufendes Match → Sieg → Neues Match).
 */

import { createAI, type AI } from './ai/ai'
import { profileForElo } from './ai/strength'
import { loadRanked, recordResult, resetRanked } from './ui/ranked'
import { submitRank, isRankHidden } from './ui/rank-online'
import { initAccountSync } from './ui/account-settings'
import {
  canBuildAt,
  canReachByLand,
  createGame,
  buildCostFor,
  effectiveMaxTroops,
  snapBuildTile,
  tick,
  totalTroops,
  type GameConfig,
  type GameState,
  type PlayerDef,
} from './core/game'
import { areAllied } from './core/diplomacy'
import { deserializeState, loadSnapshotInto } from './core/serialize'
import { getOwner } from './world/map'
import { isLand } from './world/terrain'
import { hashState } from './core/hash'
import type { Intent } from './core/intent'
import { createRecorder } from './core/replay'
import { APP_VERSION } from 'virtual:app-version'
import { LocalTransport, NetworkTransport, type IntentTransport } from './net/transport'
import { t } from './i18n'
import { createInputHandler, type InputHandler } from './input/input'
import { createRenderer } from './render/renderer'
import { createBuildMenu } from './ui/build-menu'
import { createActionWheel } from './ui/action-wheel'
import { createMobileTopbar } from './ui/mobile-topbar'
import { createGameSettings } from './ui/game-settings'
import type { BuildingType } from './core/buildings'
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
import { icon } from './ui/icons'
import { panelStyle } from './ui/theme'
import './ui/theme' // Theme-Variablen + gebündelte Schriften früh laden (ADR-0024)
import {
  applyMobileDefaultLayoutOnce,
  getPanel,
  registerPanel,
  unregisterPanel,
} from './ui/hud-layout'
import { getHudPrefs, onHudPrefsChange } from './ui/hud-prefs'
import { createHudEditor, type HudEditorOptions } from './ui/hud-editor'
import { randomTipIndex, TIP_KEYS } from './ui/tips'
import { createPauseMenu } from './ui/pause-menu'
import { createTutorial, defaultTutorialSteps, type TutorialApi } from './ui/tutorial'
import { clearScalables, getUiScale, registerScalable, unregisterScalable } from './ui/ui-scale'
import type { MatchSettings } from './net/protocol'
import {
  clearActiveSession,
  loadActiveSession,
  loadMenuPrefs,
  loadAudioVolumes,
  loadServerUrl,
  saveActiveSession,
  saveMenuPrefs,
  saveServerUrl,
  type ActiveSession,
} from './ui/preferences'
import { createSoundEngine } from './ui/sound'
import { createMusicEngine } from './ui/music'
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
  difficulty: 'standard',
  tempo: 'normal',
  terrain: 'continents',
  soundEnabled: true,
  cameraMode: 'period',
  allowedBuildings: {
    city: true,
    defense: true,
    port: true,
    factory: true,
    airport: true,
    flak: true,
  },
  rivers: true, // Flüsse standardmäßig an (reguläres Match-Toggle, ADR-0015)
  riverDensity: 1, // Fluss-Häufigkeit (1 = Standard)
  experimental: {},
  captureMode: false,
  teamMode: 'off',
  teamCount: 2,
  teamSize: 2,
}

/**
 * Match-Vorgaben fürs Tutorial: kleine, ruhige Karte ohne Wasser, keine echte KI, ein paar passive
 * Wilde zum Erobern, fester Seed (reproduzierbar). Wird über die aktuellen Menü-Werte gelegt, damit
 * Name/Sprache/Design erhalten bleiben.
 */
const TUTORIAL_OVERRIDES = {
  mapWidth: 256,
  mapHeight: 256,
  aiCount: 0,
  wildCount: 20, // dicht → der Spieler hat immer nahe Wilde zum Erobern und Bombardieren
  terrain: 'flat',
  rivers: false,
  captureMode: false,
  teamMode: 'off',
  victoryPct: 95, // hoch → das Match endet während des Tutorials nicht versehentlich
  seed: 'tutorial-1',
} satisfies Partial<StartMenuValues>

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
  const humanCount = spectator ? 0 : 1
  // Team-Modus (ADR-0025):
  //  - „allied": teamCount Teams à teamSize → so viele Nationen wie Team-Slots (KI füllt auf).
  //  - „shared": teamCount Nationen, der Mensch steuert EINE, der Rest ist KI (echtes Teilen gibt es
  //    nur im Mehrspieler — im Solo ist es einfach ein Spiel mit teamCount Nationen, ohne Allianzen).
  const allied = menu.teamMode === 'allied'
  const shared = menu.teamMode === 'shared'
  const teamCount = allied || shared ? Math.max(2, menu.teamCount) : 0
  const teamSize = allied ? Math.max(1, menu.teamSize) : 0
  const baseAi = spectator ? 1 + menu.aiCount : menu.aiCount // im Spectator ist der „erste" auch KI
  const aiCount = allied
    ? Math.max(0, teamCount * teamSize - humanCount)
    : shared
      ? Math.max(0, teamCount - humanCount)
      : baseAi
  // Nur „allied" vergibt Team-IDs (Allianzen). „shared"-Nationen sind je eine eigene Seite.
  const teamOf = (slot: number): number | undefined =>
    allied ? Math.floor(slot / teamSize) : undefined

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
  let slot = 0
  if (!spectator) {
    const t = teamOf(slot)
    players.push({
      id: id++,
      name: menu.playerName,
      color: colors[colorIdx++] ?? 0xff0000ff,
      isHuman: true,
      ...(t !== undefined ? { teamId: t } : {}),
    })
    slot++
  }
  for (let i = 0; i < aiCount; i++) {
    const t = teamOf(slot)
    players.push({
      id: id++,
      name: names[nameIdx++] ?? `Nation ${String(i + 1)}`,
      color: colors[colorIdx++] ?? 0x00ff00ff,
      isHuman: false,
      ...(t !== undefined ? { teamId: t } : {}),
    })
    slot++
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
    riverDensity: menu.riverDensity,
    allowedBuildings: menu.allowedBuildings,
    captureMode: menu.captureMode,
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

// ── Ranglisten-Modus (ADR-0022) ──────────────────────────────────────────────
// Hinweis: Texte hier vorerst deutsch hartkodiert; i18n für den Ranglisten-Screen folgt als
// eigener kleiner Schritt (analog zu den difficulty.*-Keys).
const RANKED_PANEL =
  'background:#14141c;color:#fff;border:1px solid rgba(255,255,255,0.14);border-radius:12px;' +
  'padding:24px 28px;text-align:center;font-family:ui-monospace,Menlo,Monaco,monospace;min-width:280px'
const RANKED_OVERLAY =
  'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:60;' +
  'background:rgba(0,0,0,0.72);backdrop-filter:blur(4px)'

function rankedButton(label: string, primary: boolean): HTMLButtonElement {
  const b = document.createElement('button')
  b.textContent = label
  b.style.cssText = [
    'width:100%',
    'padding:10px',
    'margin-top:8px',
    primary ? 'background:#46d9e6' : 'background:transparent',
    primary ? 'color:#06121f' : 'color:#fff',
    primary ? 'border:none' : 'border:1px solid rgba(255,255,255,0.25)',
    'border-radius:8px',
    'font:inherit',
    'font-size:13px',
    `font-weight:${primary ? '700' : '400'}`,
    'cursor:pointer',
  ].join(';')
  return b
}

/** Zeigt nach einem Ranglisten-Match die ELO-Veränderung. */
function showRankedResultOverlay(
  container: HTMLElement,
  aiElo: number,
  won: boolean,
  before: number,
  after: number,
): void {
  const delta = after - before
  const overlay = document.createElement('div')
  overlay.style.cssText = RANKED_OVERLAY
  const panel = document.createElement('div')
  panel.style.cssText = RANKED_PANEL
  const title = document.createElement('div')
  title.textContent = won ? 'Sieg' : 'Niederlage'
  title.style.cssText = `font-size:20px;font-weight:700;margin-bottom:12px;color:${won ? '#46d9e6' : '#ff8080'}`
  const line = document.createElement('div')
  const sign = delta >= 0 ? '+' : ''
  line.innerHTML = `Dein ELO: <b>${String(before)}</b> &rarr; <b>${String(after)}</b> <span style="color:${delta >= 0 ? '#7ee0a0' : '#ff9090'}">(${sign}${String(delta)})</span>`
  line.style.cssText = 'font-size:14px;margin-bottom:6px'
  const sub = document.createElement('div')
  sub.textContent = `Gegner-Stärke: ${String(aiElo)} ELO`
  sub.style.cssText = 'font-size:12px;opacity:0.6;margin-bottom:18px'
  const ok = rankedButton('Weiter', true)
  ok.addEventListener('click', () => overlay.remove())
  panel.append(title, line, sub, ok)
  overlay.appendChild(panel)
  container.appendChild(overlay)
}

/** Ranglisten-Screen: zeigt ELO/Bilanz/Peak und startet ein Match auf Spieler-Stärke. */
function showRankedScreen(
  container: HTMLElement,
  onPlay: (elo: number) => void,
  onBack: () => void,
): void {
  const overlay = document.createElement('div')
  overlay.style.cssText = RANKED_OVERLAY
  const render = (): void => {
    const r = loadRanked()
    overlay.textContent = ''
    const panel = document.createElement('div')
    panel.style.cssText = RANKED_PANEL
    const h = document.createElement('div')
    h.textContent = 'Ranglisten-Modus'
    h.style.cssText = 'font-size:18px;font-weight:700;margin-bottom:14px'
    const elo = document.createElement('div')
    elo.textContent = String(r.elo)
    elo.style.cssText = 'font-size:40px;font-weight:800;color:#46d9e6;line-height:1.1'
    const eloCap = document.createElement('div')
    eloCap.textContent = 'dein ELO'
    eloCap.style.cssText = 'font-size:11px;opacity:0.55;margin-bottom:14px;letter-spacing:0.05em'
    const stats = document.createElement('div')
    stats.textContent = `${String(r.wins)} Siege · ${String(r.losses)} Niederlagen · Höchstwert ${String(r.peak)}`
    stats.style.cssText = 'font-size:12px;opacity:0.75;margin-bottom:14px'
    const intro = document.createElement('div')
    intro.textContent =
      'Spiele gegen eine KI auf deinem Level. Gewinnst du, steigt dein ELO — so siehst du, wie du besser wirst.'
    intro.style.cssText = 'font-size:12px;opacity:0.7;margin-bottom:16px;line-height:1.4'
    const play = rankedButton('Spielen', true)
    play.addEventListener('click', () => {
      overlay.remove()
      onPlay(r.elo)
    })
    const reset = rankedButton('Zurücksetzen', false)
    reset.addEventListener('click', () => {
      resetRanked()
      render()
    })
    const back = rankedButton('Zurück', false)
    back.addEventListener('click', () => {
      overlay.remove()
      onBack()
    })
    panel.append(h, elo, eloCap, stats, intro, play, reset, back)
    overlay.appendChild(panel)
  }
  render()
  container.appendChild(overlay)
}

function startMatch(
  container: HTMLElement,
  menu: StartMenuValues,
  onRequestNewMatch: () => void,
  spectator: boolean,
  net?: NetSession,
  /** Ranglisten-Match (ADR-0022): alle KI auf dieses ELO, Ergebnis aktualisiert das Spieler-ELO. */
  rankedElo?: number,
  /** HUD-Sandbox: Match nur zum HUD-Einrichten — pausiert starten + Editor sofort öffnen. */
  hudSandbox?: boolean,
  /** Tutorial-Match: geführtes Drehbuch (Ziel-Panel + pausieren/erklären) statt freies Spiel. */
  tutorial?: boolean,
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
  // Audio-Lautstärken (Master/SFX/Musik, 0..1) aus den Einstellungen. Effektiv = Master × Kanal.
  const audio = loadAudioVolumes()
  const sound = createSoundEngine()
  sound.setEnabled(audio.master > 0 && audio.sfx > 0)
  sound.setVolume(audio.master * audio.sfx)
  // Adaptiver Soundtrack (Prototyp, opt-in über Musik-Lautstärke > 0): nur im Spielmodus, startet
  // beim ersten Frame (Match-Start = User-Geste → AudioContext erlaubt). Reine Präsentation.
  const music = !spectator && audio.master > 0 && audio.music > 0 ? createMusicEngine() : null
  music?.setVolume(audio.master * audio.music)
  ;(window as unknown as { __TL__: unknown }).__TL__ = {
    state,
    renderer,
    sound,
    music,
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

  // Schiff-/Flugzeug-/Bomben-Sounds (reine Präsentation): erkennt neue Boote/Bomber/Einschläge im
  // State und spielt sie positionsabhängig. Die „Wer hört's"-Regel wird pro Client am lokalen
  // Spieler (`humanId`) ausgewertet — nicht im Sim-State, MP-sicher.
  let seenBombImpacts = new Set<string>()
  const seenBoats = new WeakSet<object>()
  const seenBombers = new WeakSet<object>()
  const MAX_BOMB_SOUNDS_PER_FRAME = 3
  const SOUND_CUTOFF_VIEWPORTS = 1.5
  /** Pan (−1..1) + Lautstärke (0..1) eines Tiles relativ zur Kamera; `null` = außerhalb Hörweite. */
  function panGainForTile(tile: number): { pan: number; gain: number } | null {
    const w = state.map.width
    const h = state.map.height
    const tx = tile % w
    const ty = Math.floor(tile / w)
    const wrap = (a: number, b: number, size: number): number => {
      let d = a - b
      if (d > size / 2) d -= size
      else if (d < -size / 2) d += size
      return d
    }
    const z = renderer.camera.zoom
    const dxPx = wrap(tx, renderer.camera.x, w) * z
    const dyPx = wrap(ty, renderer.camera.y, h) * z
    const vw = container.clientWidth || 1
    const cutoff = SOUND_CUTOFF_VIEWPORTS * vw
    const dist = Math.hypot(dxPx, dyPx)
    if (dist > cutoff) return null
    return {
      pan: Math.max(-1, Math.min(1, dxPx / (vw / 2))),
      gain: Math.max(0, 1 - dist / cutoff),
    }
  }

  let musicStarted = false
  // Cockpit-Rad: Truppen-Rate grob über ~1-Sekunden-Samples (UI-only, kein Sim-State).
  let wheelRate = 0
  let wheelRatePrevTroops = -1
  let wheelRatePrevMs = 0
  /** Intensität (0..1) fürs adaptive Musik-Prototyp: laufende Angriffe + Bomben + eigene Bedrängnis. */
  function computeMusicIntensity(): number {
    if (state.phase !== 'running') return 0
    let attacks = 0
    for (const p of state.players.values()) attacks += p.attacks.length
    const a = Math.min(1, attacks / 50)
    const bombs = Math.min(1, state.bombImpacts.length / 5)
    const personal = prevIncomingAttackers.size > 0 ? 0.25 : 0
    return Math.min(1, Math.max(a, bombs * 0.7) + personal)
  }

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
    // Ranglisten-Match: alle (nicht-wilden) KI spielen exakt auf dem Spieler-ELO (ADR-0022).
    const rankedProfile = rankedElo !== undefined ? profileForElo(rankedElo) : undefined
    for (const p of state.players.values()) {
      if (p.isHuman) continue
      // Wilde Nationen bekommen eine passive KI (expandieren v.a. in neutrales Land, greifen
      // zurückhaltend an, bauen/diplomatisieren nie) — sonst die normale KI je Schwierigkeit.
      const override = !p.wild ? rankedProfile : undefined
      ais.push(createAI(p.id, state.seed, menu.difficulty, p.wild, override))
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
    () => inputHandler?.toggleBomberMode(),
    () => inputHandler?.toggleWarshipMode(),
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
    (pid) => renderer.centerOnPlayer(pid),
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

  // Touch/Mobile-Erkennung (steuert Eck-Rad-Sichtbarkeit + Minimap-Position).
  const touchDevice = ((): boolean => {
    try {
      return (
        navigator.maxTouchPoints > 0 ||
        (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
      )
    } catch {
      return false
    }
  })()
  // Effektives Mobile-Layout aus dem Steuerungs-Modus (HUD-Editor): auto folgt der Geräte-Erkennung,
  // `touch`/`desktop` erzwingen es. Live umschaltbar (siehe onHudPrefsChange weiter unten).
  const isMobileLayout = (): boolean => {
    const cm = getHudPrefs().controlMode
    return cm === 'touch' || (cm === 'auto' && touchDevice)
  }

  const minimap = createMinimap({
    container,
    state,
    camera: renderer.camera,
    getBitmap: renderer.getBitmap,
    getViewportSize: () => ({
      width: renderer.canvas.clientWidth,
      height: renderer.canvas.clientHeight,
    }),
    mobile: isMobileLayout(),
  })

  const tooltip = createHoverTooltip(
    container,
    state,
    humanId,
    () => Math.floor(((state.players.get(humanId)?.troops ?? 0) * sliderPct) / 100),
    (h) => renderer.setHoverHighlight(h),
  )
  // Gemeinsame Feed-Spalte unten rechts, ÜBER der Minimap (klassisches Layout): oben die
  // interaktiven Bündnis-Anfragen, darunter das passive Ereignislog. Anker unten → wächst nach
  // oben. Die Spalte trägt das `zoom` für beide Karten (Kinder registrieren sich nicht selbst).
  const feedColumn = document.createElement('div')
  feedColumn.style.cssText = [
    'position: absolute',
    'right: 12px',
    // Über der Minimap (TARGET_SIZE 192 + Padding/Margin) mit etwas Luft.
    'bottom: 224px',
    'width: 250px',
    // Gedeckelt, damit der Feed bei vielen Anfragen/Ereignissen nicht in die Rangliste hochwächst.
    // Anker unten → wächst nach oben; der Log (unten) gibt nach, die Bündnis-Karten (oben) bleiben.
    'max-height: 300px',
    'display: flex',
    'flex-direction: column',
    'gap: 6px',
    'align-items: stretch',
    'pointer-events: none',
    'z-index: 12',
  ].join(';')
  container.appendChild(feedColumn)
  registerScalable(feedColumn)
  registerPanel('feed', feedColumn)

  // Reihenfolge zählt: Bündnis-Karten zuerst (oben), Log danach (unten, direkt über der Minimap).
  const alliancePrompt = createAlliancePrompt(
    feedColumn,
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
  const eventLog = createEventLog(feedColumn, state, (pid) => renderer.centerOnPlayer(pid))

  // HUD-Editor (ADR-0024 Phase 3): „HUD anpassen"-Knopf oben links → Panels verschieben/
  // skalieren/ausblenden, Design wählen. Alle Panels sind jetzt registriert.
  // Im Sandbox-Modus (aus den Einstellungen) bringt „Fertig" direkt zurück ins Menü.
  // isCockpit/onClose: im Maus-/Cockpit-Modus bearbeitet der Editor Rad + Top-Leiste; onClose wendet
  // die Cockpit-Sichtbarkeit neu an (falls Rad/Leiste im Editor aus-/eingeblendet wurden).
  const editorOpts: HudEditorOptions = {
    isCockpit: () => isMobileLayout() && !spectator,
    onClose: () => applyMobileLayout(),
  }
  const hudEditor =
    hudSandbox === true
      ? createHudEditor(container, { ...editorOpts, onDone: onRequestNewMatch })
      : createHudEditor(container, editorOpts)

  const buildMenu = createBuildMenu(
    container,
    state,
    humanId,
    (intent) => submit(intent),
    () => Math.floor(((state.players.get(humanId)?.troops ?? 0) * sliderPct) / 100),
  )

  const confirmDialog = createConfirmDialog(container)

  // Pause-/Esc-Menü: „Weiter / HUD anpassen / Runde verlassen". Ersetzt den direkten Verlassen-
  // Bestätigungsdialog bei Esc — das Menü ist selbst die Hürde gegen versehentliches Beenden.
  // In-Game-Einstellungen (über Pause-Menü): Audio live auf Sound-/Musik-Engine + Radialmenü-Größe.
  const gameSettings = createGameSettings(container, {
    onAudio: (v) => {
      sound.setEnabled(v.master > 0 && v.sfx > 0)
      sound.setVolume(v.master * v.sfx)
      music?.setVolume(v.master * v.music)
    },
  })

  const pauseMenu = createPauseMenu(container, {
    onResume: () => {
      /* nichts weiter — Overlay schließt sich selbst */
    },
    onCustomizeHud: () => hudEditor.open(),
    onSettings: () => gameSettings.open(),
    onLeave: onRequestNewMatch,
  })

  // Sichtbarer Menü-Knopf (☰) oben links — öffnet das Pause-/ESC-Menü auch ohne Tastatur. Auf dem
  // Handy liegt das ☰ in der Top-Leiste, daher hier nur im Desktop-Modus (s. applyMobileLayout).
  // Als verschiebbares HUD-Element registriert (nicht ausblendbar — sonst verlöre man den Menü-Zugang).
  const desktopMenuBtn = document.createElement('button')
  desktopMenuBtn.type = 'button'
  desktopMenuBtn.innerHTML = icon.menu
  desktopMenuBtn.title = t('pause.title')
  desktopMenuBtn.setAttribute('aria-label', t('pause.title'))
  desktopMenuBtn.style.cssText = panelStyle([
    'position: absolute',
    'left: 12px',
    'top: 12px',
    'z-index: 41',
    'width: 36px',
    'height: 32px',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'cursor: pointer',
    'font-size: 17px',
    'padding: 0',
  ])
  desktopMenuBtn.addEventListener('click', () => pauseMenu.open())
  container.appendChild(desktopMenuBtn)
  registerScalable(desktopMenuBtn)
  registerPanel('menu', desktopMenuBtn)

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
      actionWheel.setBuildMode(mode) // Bau-Rad hebt das gewählte Gebäude hervor (Mobile-Cockpit)
    },
    onBoatModeChange: (on) => {
      hud.setBoatMode(on)
    },
    onBomberModeChange: (on, route) => {
      hud.setBomberMode(on, route)
      renderer.setBomberPreview(on ? route : null)
    },
    onWarshipModeChange: (on) => {
      hud.setWarshipMode(on)
      renderer.setWarshipPreview(on)
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
    // Doppelklick-Boot: nur fremdes/neutrales LAND, das NICHT über Land erreichbar ist (also reine
    // Wasser-Anbindung) → ein Land-Angriff wäre wirkungslos, gemeint ist ein Transportboot.
    shouldBoatTo: (tile) =>
      isLand(state.map.terrain, tile) &&
      getOwner(state.map, tile) !== humanId &&
      !canReachByLand(state, humanId, tile),
    // Touch: Tipp auf eigenes Gebiet wirkt wie Shift+Linksklick (Rundum-Ausbreiten).
    ownsTile: (tile) => getOwner(state.map, tile) === humanId,
    // Drag-Platzieren: nur den Bau-Geist schieben (kein Tooltip, das das Gebäude verdecken würde).
    onBuildPreviewMove: (worldX, worldY) => renderer.setHoverTile(worldX, worldY),
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
      recenterSelf(): void {
        // C: Kamera auf das eigene Gebiets-Zentrum (Zuschauer haben kein eigenes → ignorieren).
        if (humanId > 0) renderer.centerOnPlayer(humanId)
      },
      escape(): void {
        if (gameSettings.isOpen()) {
          gameSettings.close()
          return
        }
        if (buildMenu.isOpen()) {
          buildMenu.close()
          return
        }
        if (confirmDialog.isOpen()) {
          confirmDialog.close()
          return
        }
        // Editor offen? Esc schließt nicht den Editor (der hat „Fertig") — aber das Pause-Menü
        // soll nicht darüber aufgehen. Wenn der Editor läuft, ignorieren wir Esc hier.
        if (hudEditor.isOpen()) return
        // Pause-Menü auf/zu (HUD anpassen / Runde verlassen / Weiter).
        if (pauseMenu.isOpen()) pauseMenu.close()
        else pauseMenu.open()
      },
    },
  })

  inputHandler = input

  // Immer sichtbares Action-Rad (nur Touch/Mobile erstmal): primäre Steuerung ohne Tastatur —
  // Bauen/Schiffe wählen → Modus scharf → auf die Karte tippen/ziehen zum Platzieren.
  const WHEEL_BUILD_ORDER: BuildingType[] = [
    'city',
    'defense',
    'port',
    'factory',
    'airport',
    'flak',
  ]
  const actionWheel = createActionWheel(container, {
    allowedBuildings: WHEEL_BUILD_ORDER.filter((tp) => config.allowedBuildings?.[tp] !== false),
    onBuild: (tp) => input.toggleBuildMode(tp),
    onBoat: () => input.toggleBoatMode(),
    onBomber: () => input.toggleBomberMode(),
    onWarship: () => input.toggleWarshipMode(),
    // Live-Baupreis je Gebäude fürs Bau-Rad (grün=bezahlbar, rot=zu teuer) — auf dem Handy
    // sieht man sonst weder Preis noch Gold beim Tippen.
    buildInfo: (tp) => {
      const meP = humanId >= 0 ? state.players.get(humanId) : undefined
      const cost = humanId >= 0 ? buildCostFor(state, humanId, tp) : 0
      return { cost, affordable: meP !== undefined && meP.gold >= cost }
    },
  })
  // Mobile-Top-Leiste (oben rechts): feste Werte, die im Rad schlecht ablesbar sind —
  // Truppen-Balken mit Cap + Gold/Rate, dazu ☰ Menü (öffnet Pause-/ESC-Menü inkl. „HUD anpassen")
  // und ≣ Rang (fährt die Rangliste ein/aus).
  let mobileRankOpen = false
  // Spiegelt den Cockpit-Modus (Handy & kein Zuschauer) für die Render-Schleife — treibt z. B. den
  // Hinweis-Punkt am Rang-Knopf (offene Bündnis-Angebote stecken im „Meldungen"-Tab).
  let mobileCockpit = false
  const mobileTopbar = createMobileTopbar(container, {
    onMenu: () => pauseMenu.open(),
    onToggleRank: () => {
      mobileRankOpen = !mobileRankOpen
      hud.setMobileRankOpen(mobileRankOpen)
      mobileTopbar.setRankActive(mobileRankOpen)
      updateAttackBarVisible() // Balken aus, solange die Rangliste offen ist (sonst Überlappung)
    },
  })
  // Rad + Top-Leiste sind im Maus-/Cockpit-Modus die einzige Steuerung → als HUD-Elemente
  // registrieren, damit der HUD-Editor sie verschieben/skalieren/aus-einblenden kann (ADR-0024).
  registerScalable(actionWheel.element)
  registerPanel('wheel', actionWheel.element)
  registerScalable(mobileTopbar.element)
  registerPanel('topbar', mobileTopbar.element)
  // Vertikaler Angriffsgrößen-Slider (Mobile): rechter Rand, über dem Rad, 0 unten / 100 oben.
  // Setzt denselben sliderPct wie der Desktop-Slider (Shift+Mausrad/Aktionsleiste).
  const attackBar = document.createElement('div')
  attackBar.style.cssText = panelStyle([
    'position: absolute',
    'right: 16px',
    'bottom: 300px',
    'z-index: 18',
    'display: flex',
    'flex-direction: column',
    'align-items: center',
    'gap: 6px',
    'padding: 8px 5px',
    'pointer-events: auto',
  ])
  const attackVal = document.createElement('div')
  attackVal.style.cssText =
    'font-size: 12px; font-weight: 700; color: var(--tl-accent); font-family: var(--tl-num-font); font-variant-numeric: tabular-nums'
  const attackRange = document.createElement('input')
  attackRange.type = 'range'
  attackRange.min = '0'
  attackRange.max = '100'
  attackRange.step = '1'
  attackRange.value = String(sliderPct)
  attackRange.setAttribute('aria-label', t('hud.attack', { pct: sliderPct }))
  // Vertikal mit 0 unten / 100 oben (writing-mode + rtl). Höhe responsiv (kurze Querformat-Screens).
  attackRange.style.cssText =
    'writing-mode: vertical-lr; direction: rtl; width: 26px; height: min(42vh, 230px); cursor: pointer; accent-color: var(--tl-accent)'
  const syncAttackVal = (): void => {
    attackVal.textContent = `${attackRange.value}%`
  }
  attackRange.addEventListener('input', () => {
    sliderPct = Number(attackRange.value)
    hud.setSliderPct(sliderPct)
    syncAttackVal()
  })
  syncAttackVal()
  attackBar.append(attackVal, attackRange)
  container.appendChild(attackBar)
  registerScalable(attackBar)
  registerPanel('attackbar', attackBar)
  // Mobile-Cockpit: das Eck-Rad + die Top-Leiste zeigen alles Wichtige → die Desktop-Panels (Zeit,
  // Rangliste, Angriffe, Truppen, Bau-Leiste, Log, Minimap) werden ausgeblendet. Nur die Bündnis-
  // Karte (in feedColumn, separat) bleibt einblendbar, damit man auf dem Handy Angebote annehmen kann.
  // Zuschauer haben kein Rad → für sie bleiben die Panels sichtbar (sonst leerer Bildschirm).
  // Angriffsbalken (vertikal, rechter Rand) verstecken, solange die Rangliste offen ist — sonst
  // überlappt er deren rechte Kante (und verdeckt z. B. den „Ignorieren"-Knopf einer Bündnis-Karte
  // im Meldungen-Tab). Beim Lesen braucht man den Balken eh nicht; er kommt zurück, sobald man
  // die Rangliste schließt.
  function updateAttackBarVisible(): void {
    const show = mobileCockpit && getPanel('attackbar')?.hidden !== true && !mobileRankOpen
    attackBar.style.display = show ? 'flex' : 'none'
  }

  const applyMobileLayout = (): void => {
    const m = isMobileLayout()
    const cockpit = m && !spectator
    mobileCockpit = cockpit
    // Rad + Top-Leiste sind im Cockpit-Modus aktiv — außer der Spieler hat sie im HUD-Editor
    // ausgeblendet (Layout-`hidden`). Das Rad ganz auszublenden ist erlaubt (der Spieler will's so).
    actionWheel.setVisible(cockpit && getPanel('wheel')?.hidden !== true)
    mobileTopbar.setVisible(cockpit && getPanel('topbar')?.hidden !== true)
    updateAttackBarVisible()
    // Desktop-Menü-Knopf nur ohne Cockpit (auf dem Handy hat die Top-Leiste das ☰).
    desktopMenuBtn.style.display = cockpit ? 'none' : 'flex'
    minimap.setMobile(m)
    minimap.setVisible(!cockpit)
    hud.setMobile(cockpit)
    // Log ist jetzt auch auf Mobile verfügbar (Teil der verschiebbaren Feed-Spalte).
    eventLog.setVisible(true)
    // Bündnis-Karte kompakt auf Mobile. Die Feed-Spalte (Anfragen + Log) lebt auf dem Handy als
    // „Meldungen"-Tab IN der Rangliste (in deren Slot eingehängt), auf Desktop als eigenes Panel
    // unten rechts über der Minimap.
    alliancePrompt.setCompact(cockpit)
    if (cockpit) {
      // In den Rangliste-Slot: fließend (nicht absolut), volle Breite, eigenes Zoom aus (das
      // Rangliste-Panel skaliert bereits → sonst doppeltes `zoom`), scrollbar wenn viel ansteht.
      unregisterScalable(feedColumn)
      feedColumn.style.zoom = '1'
      feedColumn.style.transform = 'none'
      feedColumn.style.position = 'static'
      feedColumn.style.top = 'auto'
      feedColumn.style.bottom = 'auto'
      feedColumn.style.left = 'auto'
      feedColumn.style.right = 'auto'
      feedColumn.style.marginLeft = '0'
      feedColumn.style.marginRight = '0'
      feedColumn.style.width = '100%'
      feedColumn.style.maxWidth = 'none'
      feedColumn.style.maxHeight = '52vh'
      feedColumn.style.overflowY = 'auto'
      hud.getMobileFeedSlot().appendChild(feedColumn)
    } else {
      // Zurück als eigenes Desktop-Panel. Editor-Override (falls gesetzt) erst danach wieder anwenden.
      container.appendChild(feedColumn)
      registerScalable(feedColumn)
      feedColumn.style.zoom = String(getUiScale())
      feedColumn.style.position = 'absolute'
      feedColumn.style.overflowY = ''
      const feedMoved = getPanel('feed') !== undefined
      if (!feedMoved) {
        feedColumn.style.top = 'auto'
        feedColumn.style.bottom = '224px'
        feedColumn.style.left = 'auto'
        feedColumn.style.right = '12px'
        feedColumn.style.marginLeft = ''
        feedColumn.style.marginRight = ''
        feedColumn.style.width = '250px'
        feedColumn.style.maxWidth = ''
        feedColumn.style.maxHeight = '300px'
      }
    }
    if (!cockpit) {
      // Beim Wechsel zurück auf Desktop den Mobile-Rang-Toggle zurücksetzen.
      mobileRankOpen = false
      mobileTopbar.setRankActive(false)
    }
  }
  // Eingebautes Mobile-Standard-Layout (einmalig, proportional zur Bildschirmgröße) für frische
  // Mobile-Spieler. Nur im Cockpit-Modus (die Anordnung betrifft Cockpit-Panels) und nur, wenn der
  // Spieler noch kein eigenes Layout hat — danach setzt es ein Flag und fasst nichts mehr an.
  if (isMobileLayout()) applyMobileDefaultLayoutOnce(container.clientWidth, container.clientHeight)
  // Reagiert auf alle HUD-Pref-Änderungen: Mobile-Cockpit ein/aus + Off-Screen-Label-Anzahl.
  const applyPrefs = (): void => {
    applyMobileLayout()
    renderer.setOffscreenLabelCount(getHudPrefs().offscreenLabelCount)
  }
  applyPrefs()
  // Steuerungs-Modus live (HUD-Editor): Cockpit ein/aus + Label-Anzahl live umschalten.
  const offControlMode = onHudPrefsChange(applyPrefs)

  hud.setSpeed(speed)

  // Tutorial-Drehbuch (geführtes Match, Option im Menü): steuert die Sim-Pause und hängt sein
  // Ziel-Panel + die Erklärbox ins Match-DOM. Nur Solo (humanId > 0).
  let tutorialApi: TutorialApi | null = null
  if (tutorial === true && humanId > 0) {
    tutorialApi = createTutorial({
      steps: defaultTutorialSteps(),
      humanId,
      setPaused: (p) => {
        paused = p
        transport.setRunning(!p)
        hud.setSpeed(p ? 0 : speed)
      },
      onFinish: () => {
        // Drehbuch durch → Panel weg, der Spieler kann das Match frei weiterspielen oder verlassen.
        tutorialApi?.destroy()
        tutorialApi = null
      },
    })
    container.appendChild(tutorialApi.element)
  }

  function renderLoop(): void {
    if (destroyed) return
    tutorialApi?.tick(state)
    // Erste Zentrierung wiederholen, sobald das Canvas garantiert final dimensioniert
    // ist (initialer Aufruf kann vor dem finalen Layout passieren).
    if (recenterPending) {
      recenterPending = false
      renderer.centerOnPlayer(humanId)
      // Spawn-Puls erst jetzt anstoßen (Kamera sitzt final): kurzes „hier bist du" über dem
      // eigenen Gebiet. Nicht beim Zuschauen (kein eigenes Land) und nicht im Tutorial
      // (dort führen eigene Highlights). Reine Präsentation.
      if (!spectator && tutorial !== true) renderer.pulseSpawn(humanId)
    }
    // Sieg-/Niederlage-Ton genau einmal beim Phasen-Wechsel
    if (state.phase === 'ended' && lastPhase === 'running' && !endChimePlayed) {
      endChimePlayed = true
      const won = state.winner === humanId
      if (won) {
        sound.victory()
      } else {
        sound.defeat()
      }
      // Ranglisten-Match: Spieler-ELO nach dem Ergebnis aktualisieren + Veränderung einblenden.
      if (rankedElo !== undefined && !spectator) {
        const res = recordResult(rankedElo, won)
        showRankedResultOverlay(container, rankedElo, won, res.before, res.after.elo)
        // Online-Rangliste (ADR-0027): neuen Stand ans Gast-Token melden (fire-and-forget, offline-tolerant).
        void submitRank(
          loadServerUrl(defaultServerUrl()),
          menu.playerName,
          res.after,
          isRankHidden(),
        )
      }
    }
    // Niederlage durch Elimination: der Mensch verliert all sein Gebiet, WÄHREND das Match noch
    // läuft (Standard-Modus endet sonst erst, wenn eine andere Seite die Sieg-Schwelle erreicht —
    // der Spieler säße bis dahin ohne Rückmeldung vor eingefrorenen Werten). Rein client-seitig
    // (kein Sim-State angefasst), greift in Solo wie Mehrspieler. Teilt sich `endChimePlayed` als
    // Einmal-Guard mit dem Sieg-Pfad oben → kein doppelter Ton / keine doppelte ELO-Wertung.
    if (!endChimePlayed && !spectator && state.phase === 'running') {
      const me = state.players.get(humanId)
      if (me !== undefined && !me.isAlive) {
        endChimePlayed = true
        sound.defeat()
        if (rankedElo !== undefined) {
          // Ranglisten-Match: Elimination = entschiedene Niederlage → sofort werten (sonst könnte
          // man der ELO-Strafe entgehen, indem man nach dem Aus die Runde verlässt).
          const res = recordResult(rankedElo, false)
          showRankedResultOverlay(container, rankedElo, false, res.before, res.after.elo)
          void submitRank(
            loadServerUrl(defaultServerUrl()),
            menu.playerName,
            res.after,
            isRankHidden(),
          )
        } else {
          hud.showDefeat()
        }
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
    // Schiff/Flugzeug/Bombe: neue State-Einträge → positionsabhängige Sounds (pro Client gefiltert).
    if (state.phase === 'running' && sound.isEnabled()) {
      // Bomben — jeder hört sie (Lautstärke nach Distanz), pro Frame begrenzt gegen Kakophonie.
      let bombsThisFrame = 0
      const nextSeenBomb = new Set<string>()
      for (const imp of state.bombImpacts) {
        const key = `${String(imp.tile)}:${String(imp.atTick)}`
        nextSeenBomb.add(key)
        if (seenBombImpacts.has(key) || bombsThisFrame >= MAX_BOMB_SOUNDS_PER_FRAME) continue
        const pg = panGainForTile(imp.tile)
        if (pg !== null) {
          sound.bombImpact(pg.pan, pg.gain)
          bombsThisFrame++
        }
      }
      seenBombImpacts = nextSeenBomb
      // Bomber-Start — nur Starter (Besitzer) UND Ziel (Besitzer des Ziel-Tiles) hören es.
      for (const b of state.bombers) {
        if (seenBombers.has(b)) continue
        seenBombers.add(b)
        if (humanId < 0) continue
        if (b.ownerId === humanId || getOwner(state.map, b.targetTile) === humanId) {
          const pg = panGainForTile(b.targetTile) ?? { pan: 0, gain: 0.85 }
          sound.planeLaunch(pg.pan, Math.max(0.5, pg.gain))
        }
      }
      // Transportboot — nur der eigene Versand (du selbst).
      for (const bt of state.boats) {
        if (seenBoats.has(bt)) continue
        seenBoats.add(bt)
        if (humanId >= 0 && bt.ownerId === humanId) {
          const pg = panGainForTile(bt.targetTile)
          sound.boatHorn(pg?.pan ?? 0)
        }
      }
    }
    // Adaptiver Soundtrack (Prototyp): beim ersten laufenden Frame starten (User-Geste vorbei),
    // dann pro Frame die Intensität nachführen.
    if (music !== null) {
      if (!musicStarted && state.phase === 'running') {
        music.start()
        musicStarted = true
      }
      music.setIntensity(computeMusicIntensity())
    }
    renderer.render()
    minimap.update()
    // HUD-Live-Update aussetzen, solange der HUD-Editor offen ist: sonst toggeln Funktionen wie
    // updateAttackPanel jeden Frame `display:none` (z. B. leeres Angriffs-Panel) und überschreiben
    // damit die vom Editor eingeblendeten Panels → deren Rahmen kollabiert auf die Mindestgröße,
    // das Panel ist unsichtbar („keine Textur") und lässt sich nicht greifen/skalieren. Auch der
    // Feed (Bündnis-Karten + Log) wird eingefroren, sonst wächst/schrumpft sein Rahmen beim
    // Editieren durch neue Einträge. Beim Schließen laufen alle Updates sofort wieder.
    if (!hudEditor.isOpen()) {
      hud.update()
      // Gemeinsame Feed-Spalte: Bündnis-Karten (oben) + Log (unten). Flex regelt das Stapeln selbst.
      alliancePrompt.update()
      eventLog.update()
    }
    // Handy: Punkt am Rang-Knopf, wenn im „Meldungen"-Tab offene Bündnis-Angebote warten — sonst
    // würde man sie übersehen, weil der Feed im Tab statt frei sichtbar liegt.
    if (mobileCockpit) mobileTopbar.setRankAlert(alliancePrompt.pendingCount() > 0)
    // Cockpit-Rad (Mobile): Live-Werte ins Rad — Truppen/Rate/Gold/Rang/% + „unter Angriff".
    const me = state.players.get(humanId)
    if (me !== undefined && me.isAlive && !spectator) {
      const troops = totalTroops(me)
      const nowMs = performance.now()
      if (wheelRatePrevTroops < 0) {
        wheelRatePrevTroops = troops
        wheelRatePrevMs = nowMs
      } else if (nowMs - wheelRatePrevMs >= 1000) {
        wheelRate = ((troops - wheelRatePrevTroops) * 1000) / (nowMs - wheelRatePrevMs)
        wheelRatePrevTroops = troops
        wheelRatePrevMs = nowMs
      }
      const totalTiles =
        state.passableLandCount > 0 ? state.passableLandCount : state.map.width * state.map.height
      let rankPos = 1
      let underAttack = false
      for (const p of state.players.values()) {
        if (p.id !== humanId && p.isAlive && !p.wild && totalTroops(p) > troops) rankPos++
        for (const atk of p.attacks) if (atk.targetPlayerId === humanId) underAttack = true
      }
      const wheelStats = {
        troops,
        cap: effectiveMaxTroops(state, humanId),
        rate: wheelRate,
        gold: me.gold,
        rankPos,
        territoryPct: (me.tilesOwned / totalTiles) * 100,
        underAttack,
      }
      actionWheel.setStats(wheelStats)
      mobileTopbar.setStats(wheelStats) // dieselben Werte in die Top-Leiste (Balken/Cap + Gold)
    }
    renderRafId = requestAnimationFrame(renderLoop)
  }
  renderRafId = requestAnimationFrame(renderLoop)

  console.info('[territorial-loop] Match gestartet:', menu)

  // HUD-Sandbox (aus den Einstellungen geöffnet): Match pausieren und den Editor sofort aufmachen,
  // damit man das HUD am echten Layout einrichten kann, ohne ein echtes Spiel zu starten.
  if (hudSandbox === true) {
    transport.setRunning(false)
    hud.setSpeed(0)
    paused = true
    hudEditor.open()
  }

  return {
    destroy(): void {
      destroyed = true
      transport.destroy()
      if (renderRafId !== null) {
        cancelAnimationFrame(renderRafId)
        renderRafId = null
      }
      input.destroy()
      tutorialApi?.destroy()
      hudEditor.destroy()
      hud.destroy()
      minimap.destroy()
      tooltip.destroy()
      eventLog.destroy()
      alliancePrompt.destroy()
      unregisterPanel('feed')
      feedColumn.remove()
      buildMenu.destroy()
      unregisterPanel('wheel')
      unregisterPanel('topbar')
      unregisterPanel('attackbar')
      unregisterPanel('menu')
      attackBar.remove()
      desktopMenuBtn.remove()
      actionWheel.destroy()
      mobileTopbar.destroy()
      offControlMode()
      gameSettings.destroy()
      confirmDialog.destroy()
      pauseMenu.destroy()
      renderer.destroy()
      sound.destroy()
      music?.destroy()
    },
  }
}

/** Zeigt ein zentriertes „Karte wird generiert…"-Overlay mit rotierendem Tipp; entfernt es per Rückgabe. */
function showLoadingOverlay(container: HTMLElement): () => void {
  const el = document.createElement('div')
  el.style.cssText = [
    'position: absolute',
    'inset: 0',
    'display: flex',
    'flex-direction: column',
    'align-items: center',
    'justify-content: center',
    'gap: 22px',
    'background: #0b0b12',
    'color: var(--tl-text)',
    'font-family: var(--tl-font)',
    'z-index: 50',
    'padding: 24px',
    'box-sizing: border-box',
  ].join(';')

  const head = document.createElement('div')
  head.style.cssText = 'font-size: 18px; opacity: 0.9'
  head.textContent = t('loading.map')
  el.appendChild(head)

  // Tipp-Karte (gleiche Tipps wie im Menü) — Wartezeit überbrücken statt nur „Lädt…".
  const tipCard = document.createElement('div')
  tipCard.style.cssText = [
    'max-width: 440px',
    'text-align: center',
    'background: var(--tl-panel-bg)',
    'border: 1px solid var(--tl-panel-border-color)',
    'border-radius: 12px',
    'padding: 16px 22px',
    'box-shadow: 0 12px 40px rgba(0,0,0,0.5)',
  ].join(';')
  const tipHead = document.createElement('div')
  tipHead.style.cssText =
    'font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--tl-accent); opacity: 0.85; margin-bottom: 7px'
  tipHead.textContent = t('info.title')
  const tipBody = document.createElement('div')
  tipBody.style.cssText =
    'font-size: 14px; line-height: 1.5; opacity: 0.85; transition: opacity 0.45s ease'
  tipCard.appendChild(tipHead)
  tipCard.appendChild(tipBody)
  el.appendChild(tipCard)

  let tipIdx = randomTipIndex()
  const showTip = (): void => {
    tipBody.textContent = t(TIP_KEYS[tipIdx] ?? 'info.tip.1')
  }
  showTip()
  const tipTimer = window.setInterval(() => {
    tipBody.style.opacity = '0'
    window.setTimeout(() => {
      tipIdx = (tipIdx + 1) % TIP_KEYS.length
      showTip()
      tipBody.style.opacity = '0.85'
    }, 450)
  }, 13000)

  container.appendChild(el)
  return () => {
    window.clearInterval(tipTimer)
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
  // Feedback-Knopf als verschiebbares HUD-Element (im Editor; nicht ausblendbar).
  registerScalable(feedbackUi.element)
  registerPanel('feedback', feedbackUi.element)
  // UI-Größen-Slider entfernt (ADR-0024): die HUD-Größe regelt künftig der HUD-Editor pro Widget.
  // Die Standard-Skalierung (registerScalable, zoom 1.3) bleibt als Basisgröße bestehen.

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
      riverDensity: initial.riverDensity,
      allowedBuildings: initial.allowedBuildings,
      captureMode: initial.captureMode,
      teamMode: initial.teamMode,
      teamCount: initial.teamCount,
      teamSize: initial.teamSize,
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
        onCustomizeHud: () => {
          // HUD-Editor aus den Einstellungen: kurz in ein kleines, pausiertes Sandbox-Match
          // springen (echtes HUD vorhanden) + Editor sofort öffnen. „Runde verlassen" → zurück.
          menu.destroy()
          if (session !== null) {
            session.destroy()
            session = null
          }
          const sandbox: StartMenuValues = {
            ...DEFAULT_MENU,
            mapWidth: 256,
            mapHeight: 256,
            aiCount: 5,
            wildCount: 0,
            victoryPct: 100,
            terrain: 'continents',
            rivers: false,
            experimental: {},
          }
          const removeLoading = showLoadingOverlay(container)
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try {
                session = startMatch(
                  container,
                  sandbox,
                  backToMenu,
                  false,
                  undefined,
                  undefined,
                  true,
                )
              } finally {
                removeLoading()
              }
            })
          })
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
        // Tutorial (Option): geführtes Match auf kleiner ruhiger Karte; das Drehbuch erklärt die
        // Grundlagen (pausieren → erklären → weiter). Nutzt die Match-Maschinerie mit `tutorial=true`.
        onTutorial: (values) => {
          saveMenuPrefs(values)
          clearActiveSession()
          menu.destroy()
          if (session !== null) {
            session.destroy()
            session = null
          }
          const removeLoading = showLoadingOverlay(container)
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try {
                session = startMatch(
                  container,
                  { ...values, ...TUTORIAL_OVERRIDES },
                  backToMenu,
                  false,
                  undefined,
                  undefined,
                  undefined,
                  true,
                )
              } finally {
                removeLoading()
              }
            })
          })
        },
        // Ranglisten-Modus (ADR-0022): ELO-Screen öffnen; „Spielen" startet ein Match auf
        // Spieler-Stärke (alle KI = dein ELO), das Ergebnis bewegt das ELO.
        onRanked: (values) => {
          saveMenuPrefs(values)
          clearActiveSession()
          menu.destroy()
          showRankedScreen(
            container,
            (elo) => {
              if (session !== null) {
                session.destroy()
                session = null
              }
              const removeLoading = showLoadingOverlay(container)
              const proceed = (startValues: StartMenuValues): void => {
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    try {
                      session = startMatch(
                        container,
                        startValues,
                        backToMenu,
                        false,
                        undefined,
                        elo,
                      )
                    } finally {
                      removeLoading()
                    }
                  })
                })
              }
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
            backToMenu,
          )
        },
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

  // Geräteübergreifenden Einstellungs-Sync verdrahten (ADR-0027): Push-Ziel für eingeloggte Spieler.
  initAccountSync(loadServerUrl(defaultServerUrl()))

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
