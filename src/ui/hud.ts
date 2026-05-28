/**
 * HUD — Spieler-Stats, Truppen-Slider, Game-Over-Banner.
 *
 * Liest pro Frame den aktuellen GameState; mutiert nur DOM. Slider-Änderungen
 * laufen über den onSliderChange-Callback, "Neues Match"-Klick im Banner über
 * onNewMatch.
 *
 * Die Anzeige ist ein einfaches `innerHTML`-Rebuild pro Update — bei nur 4-16
 * Spielern in der Liste völlig schmerzfrei. Wenn das mal teuer wird,
 * differential update auf Listenebene.
 */

import { troopIncreaseRate } from '../core/config'
import { effectiveMaxTroops, totalTroops, type GameState, type Player } from '../core/game'
import { rgbaToCss } from './colors'

const DEFAULT_SLIDER_PCT = 30

/** Kompaktes Zahlenformat: 1234567 → "1.2M", 12345 → "12k", 842 → "842". */
function fmtCompact(value: number): string {
  const v = Math.round(value)
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(v)
}

export type SpeedMultiplier = 0 | 1 | 2 | 5 // 0 = Pause

export interface HUDApi {
  update(): void
  /** Update the speed indicator (0 = Pause, 1/2/5 = Sim-Speed-Multiplier). */
  setSpeed(speed: SpeedMultiplier): void
  /** Zeigt/versteckt den Bau-Modus-Hinweis. `null` = kein Bau-Modus aktiv. */
  setBuildMode(label: string | null): void
  destroy(): void
}

/** Formatiert einen Prozentsatz mit dynamischer Präzision für kleine Werte. */
function fmtPct(value: number): string {
  if (value <= 0) return '0%'
  if (value < 0.01) return '<0.01%'
  if (value < 1) return value.toFixed(2) + '%'
  return value.toFixed(1) + '%'
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  )
}

/** Formatiert Sekunden → "m:ss" oder "h:mm:ss". */
function fmtDuration(seconds: number): string {
  const totalSec = Math.floor(seconds)
  const s = totalSec % 60
  const totalMin = Math.floor(totalSec / 60)
  const m = totalMin % 60
  const h = Math.floor(totalMin / 60)
  const pad = (n: number): string => (n < 10 ? '0' + String(n) : String(n))
  if (h > 0) return `${String(h)}:${pad(m)}:${pad(s)}`
  return `${String(m)}:${pad(s)}`
}

const SIM_TICKS_PER_SECOND = 10

export function createHUD(
  container: HTMLElement,
  state: GameState,
  onSliderChange: (pct: number) => void,
  onNewMatch: () => void,
): HUDApi {
  let currentSpeed: SpeedMultiplier = 1
  let currentSliderPct = DEFAULT_SLIDER_PCT
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

  // Truppen-Leiste (nur eigener Spieler): Cap = volle Breite, Füllung = Gesamttruppen
  // (frei + im Kampf), heller Abschnitt = was der nächste Angriff sendet.
  const barCaption = document.createElement('div')
  barCaption.style.cssText = 'font-size: 11px; margin-bottom: 2px'
  hud.appendChild(barCaption)

  const barWrap = document.createElement('div')
  barWrap.style.cssText = [
    'position: relative',
    'height: 14px',
    'background: rgba(255,255,255,0.08)',
    'border: 1px solid rgba(255,255,255,0.15)',
    'border-radius: 4px',
    'overflow: hidden',
    'margin-bottom: 3px',
  ].join(';')
  const segIdle = document.createElement('div')
  const segAttack = document.createElement('div')
  const segCombat = document.createElement('div')
  for (const seg of [segIdle, segAttack, segCombat]) {
    seg.style.cssText = 'position: absolute; top: 0; bottom: 0'
    barWrap.appendChild(seg)
  }
  hud.appendChild(barWrap)

  const barLegend = document.createElement('div')
  barLegend.style.cssText = 'font-size: 10px; opacity: 0.75; margin-bottom: 8px'
  hud.appendChild(barLegend)

  const sliderWrap = document.createElement('div')
  sliderWrap.style.cssText = 'display: flex; gap: 8px; align-items: center'
  const sliderLabel = document.createElement('span')
  sliderLabel.textContent = `Angriff: ${DEFAULT_SLIDER_PCT}%`
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
    currentSliderPct = pct
    sliderLabel.textContent = `Angriff: ${pct}%`
    onSliderChange(pct)
  })
  sliderWrap.appendChild(sliderLabel)
  sliderWrap.appendChild(slider)
  hud.appendChild(sliderWrap)

  const hint = document.createElement('div')
  hint.style.cssText = 'margin-top: 6px; font-size: 11px; opacity: 0.7'
  hint.innerHTML =
    'Linksklick: Angriff &nbsp;·&nbsp; WASD / Rechtsklick-Ziehen: Kamera &nbsp;·&nbsp; Mausrad: Zoom<br/>Rechtsklick (eigenes Tile): Bau-Menü &nbsp;·&nbsp; 1–4: Gebäude (Stadt/Vert./Markt/Hafen)<br/>Leertaste: Pause &nbsp;·&nbsp; , / . : Tempo &nbsp;·&nbsp; Esc: Menü'
  hud.appendChild(hint)

  // Bau-Modus-Hinweis (nur sichtbar wenn ein Hotkey-Bau-Modus aktiv ist)
  const buildModeEl = document.createElement('div')
  buildModeEl.style.cssText = [
    'margin-top: 6px',
    'padding: 5px 8px',
    'font-size: 11px',
    'border-radius: 4px',
    'background: rgba(232,193,74,0.18)',
    'border: 1px solid rgba(232,193,74,0.5)',
    'color: #e8c14a',
    'display: none',
  ].join(';')
  hud.appendChild(buildModeEl)

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

  const bannerText = document.createElement('div')
  banner.appendChild(bannerText)

  const newMatchBtn = document.createElement('button')
  newMatchBtn.textContent = 'Neues Match'
  newMatchBtn.style.cssText = [
    'margin-top: 12px',
    'padding: 8px 18px',
    'background: #4a8',
    'color: white',
    'border: none',
    'border-radius: 6px',
    'font-size: 14px',
    'font-family: inherit',
    'cursor: pointer',
    'pointer-events: auto',
    'font-weight: bold',
  ].join(';')
  newMatchBtn.addEventListener('mouseenter', () => {
    newMatchBtn.style.background = '#5b9'
  })
  newMatchBtn.addEventListener('mouseleave', () => {
    newMatchBtn.style.background = '#4a8'
  })
  newMatchBtn.addEventListener('click', onNewMatch)
  banner.appendChild(newMatchBtn)

  container.appendChild(banner)

  // Pause-Overlay (großes Dim mit 'PAUSE'-Text, sichtbar wenn currentSpeed === 0)
  const pauseOverlay = document.createElement('div')
  pauseOverlay.style.cssText = [
    'position: absolute',
    'inset: 0',
    'display: none',
    'align-items: center',
    'justify-content: center',
    'background: rgba(10,10,20,0.35)',
    'color: rgba(255,255,255,0.85)',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 56px',
    'font-weight: bold',
    'letter-spacing: 12px',
    'text-shadow: 0 4px 12px rgba(0,0,0,0.6)',
    'pointer-events: none',
    'z-index: 15',
    'user-select: none',
  ].join(';')
  pauseOverlay.textContent = 'PAUSE'
  container.appendChild(pauseOverlay)

  /** Aktualisiert die Truppen-Leiste des eigenen Spielers. */
  function updateTroopBar(): void {
    let human: Player | undefined
    for (const p of state.players.values()) {
      if (p.isHuman) {
        human = p
        break
      }
    }
    if (human === undefined || !human.isAlive) {
      barWrap.style.display = 'none'
      barCaption.style.display = 'none'
      barLegend.style.display = 'none'
      return
    }
    barWrap.style.display = ''
    barCaption.style.display = ''
    barLegend.style.display = ''

    const cap = Math.max(1, effectiveMaxTroops(state, human.id))
    const idle = human.troops
    const total = totalTroops(human)
    const combat = Math.max(0, total - idle)
    const attackAmt = Math.floor((idle * currentSliderPct) / 100)
    const idleBase = Math.max(0, idle - attackAmt)
    const color = rgbaToCss(human.color)
    const pctW = (v: number): string => `${Math.max(0, Math.min(100, (v / cap) * 100)).toString()}%`

    segIdle.style.left = '0%'
    segIdle.style.width = pctW(idleBase)
    segIdle.style.background = color

    segAttack.style.left = pctW(idleBase)
    segAttack.style.width = pctW(attackAmt)
    segAttack.style.background = '#e8d24a' // gold = was der nächste Angriff sendet

    segCombat.style.left = pctW(idleBase + attackAmt)
    segCombat.style.width = pctW(combat)
    segCombat.style.background = `repeating-linear-gradient(45deg, ${color} 0 5px, rgba(0,0,0,0.4) 5px 10px)`

    barCaption.innerHTML = `Truppen <b>${fmtCompact(total)}</b> / ${fmtCompact(cap)}`
    const combatLegend =
      combat > 0 ? ` &nbsp; <span style="opacity:0.85">▨ im Kampf ${fmtCompact(combat)}</span>` : ''
    barLegend.innerHTML = `<span style="color:#e8d24a">▌</span> Angriff ${fmtCompact(attackAmt)} (${currentSliderPct.toString()}%)${combatLegend}`
  }

  function update(): void {
    // Gebiets-% bezieht sich auf eroberbares Land (ohne Wasser/Extrem-Berge).
    const totalTiles =
      state.passableLandCount > 0 ? state.passableLandCount : state.map.width * state.map.height
    const html: string[] = []
    const gameSeconds = state.tick / SIM_TICKS_PER_SECOND
    const speedLabel = currentSpeed === 0 ? '⏸ Pause' : `${String(currentSpeed)}×`
    html.push(`Zeit: ${fmtDuration(gameSeconds)} · ${speedLabel}<br>`)
    const phaseLine =
      state.phase === 'running' ? 'Phase: läuft' : `Phase: beendet (Sieger: ${state.winner ?? '?'})`
    html.push(phaseLine + '<br><br>')
    const players = [...state.players.values()].sort((a, b) => a.id - b.id)
    for (const p of players) {
      const pct = fmtPct((p.tilesOwned / totalTiles) * 100)
      const dead = p.isAlive ? '' : ' <span style="opacity:0.5">†</span>'
      // Gesamttruppen = frei + im Kampf gebunden.
      html.push(
        `<span style="color:${rgbaToCss(p.color)}">■</span> ${escapeHtml(p.name)}${dead}: ${Math.round(totalTroops(p)).toLocaleString('de-DE')}T · ${pct}<br>`,
      )
      // Eigene Nation: Wachstumsrate (pro Sekunde) + Gold-Vorrat
      if (p.isHuman && p.isAlive) {
        const cap = effectiveMaxTroops(state, p.id)
        const ratePerSec = troopIncreaseRate(totalTroops(p), cap) * 10
        html.push(
          `<span style="opacity:0.6; font-size:11px">&nbsp;&nbsp;↳ +${fmtCompact(ratePerSec)}/s · <span style="color:#e8c14a">${fmtCompact(p.gold)} Gold</span></span><br>`,
        )
      }
    }
    status.innerHTML = html.join('')
    updateTroopBar()

    if (state.phase === 'ended' && state.winner !== null) {
      const winner = state.players.get(state.winner)
      if (winner !== undefined) {
        banner.style.display = 'block'
        const totalTiles =
          state.passableLandCount > 0 ? state.passableLandCount : state.map.width * state.map.height
        const players = [...state.players.values()].sort(
          (a, b) => b.peakTilesOwned - a.peakTilesOwned,
        )
        const statsRows = players
          .map((p) => {
            const peakPct = fmtPct((p.peakTilesOwned / totalTiles) * 100)
            const dead = p.isAlive ? '' : ' <span style="opacity:0.5">†</span>'
            return (
              `<tr>` +
              `<td style="padding-right: 12px"><span style="color:${rgbaToCss(p.color)}">■</span> ${escapeHtml(p.name)}${dead}</td>` +
              `<td style="padding-right: 12px; text-align: right">${peakPct}</td>` +
              `<td style="text-align: right">${p.peakTroops.toLocaleString('de-DE')}T</td>` +
              `</tr>`
            )
          })
          .join('')
        const matchTime = fmtDuration(state.tick / SIM_TICKS_PER_SECOND)
        bannerText.innerHTML =
          `<div style="font-size: 22px; margin-bottom: 4px">` +
          `Sieg: <span style="color:${rgbaToCss(winner.color)}">${escapeHtml(winner.name)}</span>` +
          `</div>` +
          `<div style="font-size: 12px; opacity: 0.7; margin-bottom: 10px">Dauer ${matchTime} · Match läuft weiter</div>` +
          `<table style="font-size: 12px; margin: 0 auto; border-collapse: collapse"><thead><tr style="opacity: 0.6"><th style="font-weight: normal; padding-right: 12px; text-align: left">Spieler</th><th style="font-weight: normal; padding-right: 12px; text-align: right">Peak %</th><th style="font-weight: normal; text-align: right">Peak Truppen</th></tr></thead><tbody>${statsRows}</tbody></table>` +
          `<div style="font-size: 11px; opacity: 0.5; margin-top: 8px; font-family: ui-monospace">Seed: ${escapeHtml(state.seed)}</div>`
      }
    } else {
      banner.style.display = 'none'
    }
  }

  return {
    update,
    setSpeed(speed: SpeedMultiplier): void {
      currentSpeed = speed
      pauseOverlay.style.display = speed === 0 ? 'flex' : 'none'
    },
    setBuildMode(label: string | null): void {
      if (label === null) {
        buildModeEl.style.display = 'none'
      } else {
        buildModeEl.innerHTML = `Bau-Modus: <b>${escapeHtml(label)}</b> — Linksklick platzieren, Esc abbrechen`
        buildModeEl.style.display = 'block'
      }
    },
    destroy(): void {
      hud.remove()
      banner.remove()
      pauseOverlay.remove()
    },
  }
}
