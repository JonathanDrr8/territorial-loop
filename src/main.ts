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
  type PlayerDef,
} from './core/game'
import type { Intent } from './core/intent'
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
import { loadMenuPrefs, saveMenuPrefs } from './ui/preferences'
import { createSoundEngine } from './ui/sound'
import { createStartMenu, TEMPO_TO_SPEED, type StartMenuValues } from './ui/start-menu'

const HUMAN_ID = 1
const SIM_BASE_INTERVAL_MS = 100
const DEFAULT_SLIDER_PCT = 30

const DEFAULT_MENU: StartMenuValues = {
  playerName: 'Du',
  mapWidth: 1024,
  mapHeight: 1024,
  aiCount: 3,
  wildCount: 2,
  victoryPct: 90,
  difficulty: 'normal',
  tempo: 'normal',
  terrain: 'continents',
  soundEnabled: true,
  cameraBox: true,
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
  let id = HUMAN_ID
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

function startMatch(
  container: HTMLElement,
  menu: StartMenuValues,
  onRequestNewMatch: () => void,
  spectator: boolean,
): MatchSession {
  const config = buildConfig(menu, spectator)
  const state = createGame(config)
  const renderer = createRenderer(container, state)
  // Kamera nach dem Generieren exakt auf das eigene Spawn zentrieren — sonst weiß
  // man auf großen Karten nicht, wo man ist. (Erneut im ersten Render-Frame, falls
  // das Canvas hier noch nicht final dimensioniert ist.)
  renderer.centerOnPlayer(HUMAN_ID)
  let recenterPending = true
  const sound = createSoundEngine()
  sound.setEnabled(menu.soundEnabled)
  ;(window as unknown as { __TL__: unknown }).__TL__ = { state, renderer, sound }

  let lastPhase: 'running' | 'ended' = state.phase
  let endChimePlayed = false

  const pendingIntents: Intent[] = []
  let sliderPct = DEFAULT_SLIDER_PCT
  let paused = false
  let speed: 1 | 2 | 5 = 1
  let simIntervalId: number | null = null
  let renderRafId: number | null = null
  let destroyed = false

  const ais: AI[] = []
  for (const p of state.players.values()) {
    if (p.isHuman) continue
    // Wilde Nationen bekommen eine passive KI (expandieren v.a. in neutrales Land, greifen
    // zurückhaltend an, bauen/diplomatisieren nie) — sonst die normale KI je Schwierigkeit.
    ais.push(createAI(p.id, state.seed, menu.difficulty, p.wild))
  }

  function runSimTick(): void {
    if (paused) return
    for (const ai of ais) {
      for (const intent of ai.decide(state)) {
        pendingIntents.push(intent)
      }
    }
    tick(state, pendingIntents)
    pendingIntents.length = 0
  }

  function restartSimInterval(): void {
    if (simIntervalId !== null) {
      window.clearInterval(simIntervalId)
      simIntervalId = null
    }
    if (paused || destroyed) return
    const ms = SIM_BASE_INTERVAL_MS / speed
    simIntervalId = window.setInterval(runSimTick, ms)
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
    (attackIndex) =>
      pendingIntents.push({ type: 'cancel-attack', playerId: HUMAN_ID, attackIndex }),
    (boatIndex) => pendingIntents.push({ type: 'boat-recall', playerId: HUMAN_ID, boatIndex }),
    (warshipIndex) =>
      pendingIntents.push({ type: 'recall-warship', playerId: HUMAN_ID, warshipIndex }),
    (attackerId) =>
      pendingIntents.push({
        type: 'defend',
        playerId: HUMAN_ID,
        attackerId,
        troops: Math.floor(((state.players.get(HUMAN_ID)?.troops ?? 0) * sliderPct) / 100),
      }),
    (tile) => {
      // ⌖ „Zum Kampf springen": Kamera auf das (Front-)Tile zentrieren.
      const w = state.map.width
      renderer.camera.x = (tile % w) + 0.5
      renderer.camera.y = Math.floor(tile / w) + 0.5
    },
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
    HUMAN_ID,
    () => Math.floor(((state.players.get(HUMAN_ID)?.troops ?? 0) * sliderPct) / 100),
    (h) => renderer.setHoverHighlight(h),
  )
  const eventLog = createEventLog(container, state)
  const alliancePrompt = createAlliancePrompt(
    container,
    state,
    HUMAN_ID,
    (requesterId) =>
      pendingIntents.push({
        type: 'accept-alliance',
        playerId: HUMAN_ID,
        targetPlayerId: requesterId,
      }),
    (requesterId) =>
      pendingIntents.push({ type: 'decline-alliance', playerId: HUMAN_ID, requesterId }),
  )
  const buildMenu = createBuildMenu(
    container,
    state,
    HUMAN_ID,
    (intent) => pendingIntents.push(intent),
    () => Math.floor(((state.players.get(HUMAN_ID)?.troops ?? 0) * sliderPct) / 100),
  )

  const confirmDialog = createConfirmDialog(container)

  const input = createInputHandler({
    canvas: renderer.canvas,
    camera: renderer.camera,
    mapWidth: state.map.width,
    mapHeight: state.map.height,
    playerId: HUMAN_ID,
    interactive: !spectator,
    cameraBox: menu.cameraBox,
    emit: (intent) => pendingIntents.push(intent),
    getPlayerTroops: () => state.players.get(HUMAN_ID)?.troops ?? 0,
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
        pendingIntents.push({
          type: 'move-warship',
          playerId: HUMAN_ID,
          warshipIndices: indices,
          targetTile: tile,
        })
    },
    onClearWarshipSelection: () => renderer.clearWarshipSelection(),
    onRadialMenu: (tile, screenX, screenY) => {
      buildMenu.open(tile, screenX, screenY)
    },
    canPlaceBuilding: (tile, type) => canBuildAt(state, HUMAN_ID, tile, type),
    snapBuildTarget: (tile, type) => snapBuildTile(state, HUMAN_ID, tile, type),
    events: {
      pause(): void {
        paused = !paused
        restartSimInterval()
        hud.setSpeed(paused ? 0 : speed)
      },
      cycleSpeed(dir): void {
        const levels: readonly (1 | 2 | 5)[] = [1, 2, 5]
        const idx = levels.indexOf(speed)
        const next = levels[Math.max(0, Math.min(levels.length - 1, idx + dir))]
        if (next === undefined || next === speed) return
        speed = next
        restartSimInterval()
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

  restartSimInterval()

  function renderLoop(): void {
    if (destroyed) return
    // Erste Zentrierung wiederholen, sobald das Canvas garantiert final dimensioniert
    // ist (initialer Aufruf kann vor dem finalen Layout passieren).
    if (recenterPending) {
      recenterPending = false
      renderer.centerOnPlayer(HUMAN_ID)
    }
    // Sieg-/Niederlage-Ton genau einmal beim Phasen-Wechsel
    if (state.phase === 'ended' && lastPhase === 'running' && !endChimePlayed) {
      endChimePlayed = true
      if (state.winner === HUMAN_ID) {
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
      if (simIntervalId !== null) {
        window.clearInterval(simIntervalId)
        simIntervalId = null
      }
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

  let session: MatchSession | null = null

  function showMenu(): void {
    const initial = loadMenuPrefs(DEFAULT_MENU)
    const menu = createStartMenu(container, initial, (values, spectator) => {
      saveMenuPrefs(values)
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
            session = startMatch(
              container,
              values,
              () => {
                if (session !== null) {
                  session.destroy()
                  session = null
                }
                showMenu()
              },
              spectator,
            )
          } finally {
            removeLoading()
          }
        })
      })
    })
  }

  showMenu()
  console.info('[territorial-loop] Boot complete (start menu shown)')
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
