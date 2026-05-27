/**
 * Entry-Point: Boot, Sim-Loop, Render-Loop.
 *
 * Default-Match: 256×256 Torus, 1 Mensch + 3 KI (KI emittiert noch keine
 * Intents — siehe TODO unten; sie wachsen passiv und können angegriffen werden).
 *
 * Architektur-Treue: Sim-Tick und Render sind getrennt — Sim läuft mit
 * `setInterval` bei 100ms / speed, Render mit `requestAnimationFrame`.
 */

import { createAI, type AI } from './ai/ai'
import { createGame, tick, type GameConfig } from './core/game'
import type { Intent } from './core/intent'
import { createInputHandler } from './input/input'
import { createRenderer } from './render/renderer'
import { createMinimap } from './ui/minimap'
import { pickRandomNames } from './ui/player-names'
import { createStartMenu, type StartMenuValues } from './ui/start-menu'

const HUMAN_ID = 1
const SIM_BASE_INTERVAL_MS = 100
const DEFAULT_SLIDER_PCT = 30

/** HSL → RGBA-packed (r,g,b,a in 8-bit, RR GG BB AA). */
function hslToRgba(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  const R = Math.round((r + m) * 255)
  const G = Math.round((g + m) * 255)
  const B = Math.round((b + m) * 255)
  return ((R << 24) | (G << 16) | (B << 8) | 0xff) >>> 0
}

function randomColor(): number {
  return hslToRgba(Math.random() * 360, 0.7, 0.55)
}

function buildConfig(menu: StartMenuValues): GameConfig {
  const aiNames = pickRandomNames(menu.aiCount)
  return {
    mapWidth: menu.mapSize,
    mapHeight: menu.mapSize,
    seed: 'match-' + Date.now().toString(),
    victoryPct: menu.victoryPct,
    players: [
      { id: 1, name: menu.playerName, color: randomColor(), isHuman: true },
      ...aiNames.map((name, i) => ({
        id: i + 2,
        name,
        color: randomColor(),
        isHuman: false,
      })),
    ],
  }
}

const DEFAULT_MENU: StartMenuValues = {
  playerName: 'Du',
  mapSize: 256,
  aiCount: 3,
  victoryPct: 90,
}

interface MatchSession {
  destroy(): void
}

function rgbaToCss(rgba: number): string {
  const r = (rgba >>> 24) & 0xff
  const g = (rgba >>> 16) & 0xff
  const b = (rgba >>> 8) & 0xff
  return `rgb(${r},${g},${b})`
}

/** Formatiert einen Prozentsatz mit dynamischer Präzision für kleine Werte. */
function fmtPct(value: number): string {
  if (value <= 0) return '0%'
  if (value < 0.01) return '<0.01%'
  if (value < 1) return value.toFixed(2) + '%'
  return value.toFixed(1) + '%'
}

interface HUDApi {
  update(): void
  destroy(): void
}

function createHUD(
  container: HTMLElement,
  state: ReturnType<typeof createGame>,
  onSliderChange: (pct: number) => void,
): HUDApi {
  const hud = document.createElement('div')
  hud.style.cssText = [
    'position: absolute',
    'top: 12px',
    'left: 12px',
    'background: rgba(0,0,0,0.55)',
    'color: white',
    'padding: 10px 12px',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 13px',
    'line-height: 1.4',
    'border-radius: 6px',
    'min-width: 220px',
    'pointer-events: auto',
    'z-index: 10',
  ].join(';')

  const status = document.createElement('div')
  status.style.whiteSpace = 'pre'
  status.style.marginBottom = '8px'
  hud.appendChild(status)

  const sliderWrap = document.createElement('div')
  sliderWrap.style.cssText = 'display: flex; gap: 8px; align-items: center'
  const sliderLabel = document.createElement('span')
  sliderLabel.textContent = `Truppen: ${DEFAULT_SLIDER_PCT}%`
  sliderLabel.style.minWidth = '90px'
  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = '0'
  slider.max = '100'
  slider.step = '1'
  slider.value = String(DEFAULT_SLIDER_PCT)
  slider.style.flex = '1'
  slider.addEventListener('input', () => {
    const pct = Number(slider.value)
    sliderLabel.textContent = `Truppen: ${pct}%`
    onSliderChange(pct)
  })
  sliderWrap.appendChild(sliderLabel)
  sliderWrap.appendChild(slider)
  hud.appendChild(sliderWrap)

  const hint = document.createElement('div')
  hint.style.cssText = 'margin-top: 6px; font-size: 11px; opacity: 0.7'
  hint.innerHTML =
    'Linksklick: Angriff &nbsp;·&nbsp; Rechte Maustaste + Ziehen: Karte &nbsp;·&nbsp; Mausrad: Zoom<br/>Leertaste: Pause &nbsp;·&nbsp; 1/2/5: Geschwindigkeit'
  hud.appendChild(hint)

  container.appendChild(hud)

  // Game-Over-Banner (versteckt im laufenden Match)
  const banner = document.createElement('div')
  banner.style.cssText = [
    'position: absolute',
    'top: 24px',
    'left: 50%',
    'transform: translateX(-50%)',
    'background: rgba(0,0,0,0.75)',
    'color: white',
    'padding: 14px 22px',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'border-radius: 8px',
    'box-shadow: 0 4px 20px rgba(0,0,0,0.5)',
    'z-index: 20',
    'text-align: center',
    'pointer-events: none',
    'display: none',
  ].join(';')
  container.appendChild(banner)

  function update(): void {
    const totalTiles = state.map.width * state.map.height
    const html: string[] = []
    html.push(`Tick: ${state.tick}<br>`)
    const phaseLine =
      state.phase === 'running' ? 'Phase: läuft' : `Phase: beendet (Sieger: ${state.winner ?? '?'})`
    html.push(phaseLine + '<br><br>')
    const players = [...state.players.values()].sort((a, b) => a.id - b.id)
    for (const p of players) {
      const pct = fmtPct((p.tilesOwned / totalTiles) * 100)
      const dead = p.isAlive ? '' : ' <span style="opacity:0.5">†</span>'
      html.push(
        `<span style="color:${rgbaToCss(p.color)}">■</span> ${escapeHtml(p.name)}${dead}: ${p.troops.toLocaleString('de-DE')}T · ${pct}<br>`,
      )
    }
    status.innerHTML = html.join('')

    // Game-Over-Banner
    if (state.phase === 'ended' && state.winner !== null) {
      const winner = state.players.get(state.winner)
      if (winner !== undefined) {
        banner.style.display = 'block'
        banner.innerHTML =
          `<div style="font-size: 22px; margin-bottom: 4px">` +
          `Sieg: <span style="color:${rgbaToCss(winner.color)}">${escapeHtml(winner.name)}</span>` +
          `</div>` +
          `<div style="font-size: 12px; opacity: 0.7">Match läuft weiter — du kannst zuschauen</div>`
      }
    } else {
      banner.style.display = 'none'
    }
  }

  return {
    update,
    destroy() {
      hud.remove()
      banner.remove()
    },
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  )
}

function startMatch(container: HTMLElement, menu: StartMenuValues): MatchSession {
  const config = buildConfig(menu)
  const state = createGame(config)
  const renderer = createRenderer(container, state)
  // Debug-Hook: aktuelles Match auf window für Browser-Konsole / Playwright-Tests
  ;(window as unknown as { __TL__: unknown }).__TL__ = { state, renderer }

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
      ais.push(createAI(p.id, state.seed))
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

  const hud = createHUD(container, state, (pct) => {
    sliderPct = pct
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

  const input = createInputHandler({
    canvas: renderer.canvas,
    camera: renderer.camera,
    mapWidth: state.map.width,
    mapHeight: state.map.height,
    playerId: HUMAN_ID,
    emit: (intent) => pendingIntents.push(intent),
    getPlayerTroops: () => state.players.get(HUMAN_ID)?.troops ?? 0,
    getSliderPct: () => sliderPct,
    events: {
      pause(): void {
        paused = !paused
        restartSimInterval()
      },
      setSpeed(m): void {
        speed = m
        restartSimInterval()
      },
    },
  })

  restartSimInterval()

  function renderLoop(): void {
    if (destroyed) return
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
      renderer.destroy()
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
      }
      session = startMatch(container, values)
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
