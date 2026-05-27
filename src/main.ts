/**
 * Entry-Point: Boot, Start-Menü, Match-Session-Management.
 *
 * Die eigentliche Spiel-Logik lebt in `core/`, `world/`, `render/`, `input/`,
 * `ai/`, `ui/`. Diese Datei macht nur Boot-Wiring und den Lebenszyklus einer
 * Match-Session (Start-Menü → laufendes Match → Sieg → Neues Match).
 */

import { createAI, type AI } from './ai/ai'
import { createGame, tick, type GameConfig } from './core/game'
import type { Intent } from './core/intent'
import { createInputHandler } from './input/input'
import { createRenderer } from './render/renderer'
import { pickDistinctColors } from './ui/colors'
import { createHoverTooltip } from './ui/hover-tooltip'
import { createHUD } from './ui/hud'
import { createMinimap } from './ui/minimap'
import { pickRandomNames } from './ui/player-names'
import { createSoundEngine } from './ui/sound'
import { createStartMenu, type StartMenuValues } from './ui/start-menu'

const HUMAN_ID = 1
const SIM_BASE_INTERVAL_MS = 100
const DEFAULT_SLIDER_PCT = 30

const DEFAULT_MENU: StartMenuValues = {
  playerName: 'Du',
  mapSize: 256,
  aiCount: 3,
  victoryPct: 90,
  difficulty: 'normal',
  soundEnabled: true,
}

interface MatchSession {
  destroy(): void
}

function buildConfig(menu: StartMenuValues): GameConfig {
  const aiNames = pickRandomNames(menu.aiCount)
  const totalPlayers = 1 + menu.aiCount
  const colors = pickDistinctColors(totalPlayers)
  return {
    mapWidth: menu.mapSize,
    mapHeight: menu.mapSize,
    seed: 'match-' + Date.now().toString(),
    victoryPct: menu.victoryPct,
    players: [
      { id: HUMAN_ID, name: menu.playerName, color: colors[0] ?? 0xff0000ff, isHuman: true },
      ...aiNames.map((name, i) => ({
        id: HUMAN_ID + 1 + i,
        name,
        color: colors[i + 1] ?? 0x00ff00ff,
        isHuman: false,
      })),
    ],
  }
}

function startMatch(
  container: HTMLElement,
  menu: StartMenuValues,
  onRequestNewMatch: () => void,
): MatchSession {
  const config = buildConfig(menu)
  const state = createGame(config)
  const renderer = createRenderer(container, state)
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
    if (!p.isHuman) {
      ais.push(createAI(p.id, state.seed, menu.difficulty))
    }
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

  const hud = createHUD(
    container,
    state,
    (pct) => {
      sliderPct = pct
    },
    onRequestNewMatch,
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

  const tooltip = createHoverTooltip(container, state, HUMAN_ID)

  const input = createInputHandler({
    canvas: renderer.canvas,
    camera: renderer.camera,
    mapWidth: state.map.width,
    mapHeight: state.map.height,
    playerId: HUMAN_ID,
    emit: (intent) => pendingIntents.push(intent),
    getPlayerTroops: () => state.players.get(HUMAN_ID)?.troops ?? 0,
    getSliderPct: () => sliderPct,
    onAttackClick: (x, y) => {
      renderer.addClickMarker(x, y)
      sound.click()
    },
    onHover: (worldX, worldY, screenX, screenY) => {
      tooltip.show(worldX, worldY, screenX, screenY)
    },
    onHoverEnd: () => tooltip.hide(),
    events: {
      pause(): void {
        paused = !paused
        restartSimInterval()
        hud.setSpeed(paused ? 0 : speed)
      },
      setSpeed(m): void {
        speed = m
        restartSimInterval()
        if (!paused) hud.setSpeed(speed)
      },
      escape: onRequestNewMatch,
    },
  })

  hud.setSpeed(speed)

  restartSimInterval()

  function renderLoop(): void {
    if (destroyed) return
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
      renderer.destroy()
      sound.destroy()
    },
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
    const menu = createStartMenu(container, DEFAULT_MENU, (values) => {
      menu.destroy()
      if (session !== null) {
        session.destroy()
        session = null
      }
      session = startMatch(container, values, () => {
        if (session !== null) {
          session.destroy()
          session = null
        }
        showMenu()
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
