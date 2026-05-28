/**
 * HUD — Version A.
 *
 * Drei Bereiche, alle absolut im Container positioniert, pro Frame `update()`:
 *  - oben links: kompakte Info (Zeit · Speed · Phase) + klappbarer Steuerungs-Hinweis.
 *  - oben rechts: Rangliste aller Nationen, sortierbar nach Truppen/Gold, Top-5 mit
 *    Erweitern-Knopf (dann scrollbar).
 *  - unten Mitte: eigenes Spieler-Menü — Truppen-Leiste (mit Effizienz-Strichen),
 *    Angriffs-Slider und Bau-Buttons (mit Hotkey-Label).
 *
 * Liest pro Frame den GameState read-only; mutiert nur DOM. Slider-Änderungen über
 * onSliderChange, Bau-Button-Klick über onBuildClick (setzt den Bau-Modus im Input),
 * "Neues Match" über onNewMatch.
 */

import { BUILDING_LABEL, BUILDING_TYPES, buildCost, type BuildingType } from '../core/buildings'
import { growthZones } from '../core/config'
import {
  countBuildingsOfType,
  effectiveMaxTroops,
  totalTroops,
  type GameState,
  type Player,
} from '../core/game'
import { rgbaToCss } from './colors'

const DEFAULT_SLIDER_PCT = 30
const SIM_TICKS_PER_SECOND = 10
const RANK_COLLAPSED = 5

const BUILDING_GLYPH: Record<BuildingType, string> = {
  city: 'C',
  defense: 'D',
  market: '$',
  port: 'P',
}
const BUILDING_HOTKEY: Record<BuildingType, string> = {
  city: '1',
  defense: '2',
  market: '3',
  port: '4',
}

type RankSort = 'troops' | 'gold'

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
  /** Markiert den aktiven Bau-Modus-Button. `null` = kein Bau-Modus aktiv. */
  setBuildMode(type: BuildingType | null): void
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

export function createHUD(
  container: HTMLElement,
  state: GameState,
  onSliderChange: (pct: number) => void,
  onNewMatch: () => void,
  onBuildClick: (type: BuildingType) => void,
): HUDApi {
  let currentSpeed: SpeedMultiplier = 1
  let currentSliderPct = DEFAULT_SLIDER_PCT
  let rankSort: RankSort = 'troops'
  let rankExpanded = false

  /* ---- Oben links: kompakte Info + Steuerungs-Hinweis ---------------------- */
  const infoBox = document.createElement('div')
  infoBox.style.cssText = [
    'position: absolute',
    'top: 12px',
    'left: 12px',
    'background: rgba(0,0,0,0.55)',
    'color: white',
    'padding: 8px 12px',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 13px',
    'line-height: 1.4',
    'border-radius: 6px',
    'pointer-events: auto',
    'z-index: 10',
  ].join(';')
  const infoLine = document.createElement('div')
  infoBox.appendChild(infoLine)

  const helpDetails = document.createElement('details')
  helpDetails.style.cssText = 'margin-top: 4px; font-size: 11px; opacity: 0.75'
  const helpSummary = document.createElement('summary')
  helpSummary.textContent = 'Steuerung'
  helpSummary.style.cssText = 'cursor: pointer; opacity: 0.8'
  helpDetails.appendChild(helpSummary)
  const helpBody = document.createElement('div')
  helpBody.style.cssText = 'margin-top: 4px; line-height: 1.5'
  helpBody.innerHTML =
    'Linksklick: Angriff (über Wasser → Boot)<br/>Ziehen (links/rechts) oder WASD: Kamera<br/>Mausrad: Zoom · Rechtsklick: Menü<br/>1–4: Gebäude · Leertaste: Pause<br/>, / . : Tempo · Esc: Menü'
  helpDetails.appendChild(helpBody)
  infoBox.appendChild(helpDetails)
  container.appendChild(infoBox)

  /* ---- Oben rechts: Rangliste ---------------------------------------------- */
  const rankPanel = document.createElement('div')
  rankPanel.style.cssText = [
    'position: absolute',
    'top: 12px',
    'right: 12px',
    'width: 250px',
    'background: rgba(0,0,0,0.6)',
    'color: white',
    'padding: 8px 10px',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 12px',
    'border-radius: 6px',
    'pointer-events: auto',
    'z-index: 12',
  ].join(';')

  const rankHead = document.createElement('div')
  rankHead.style.cssText =
    'display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 11px'
  const rankTitle = document.createElement('span')
  rankTitle.textContent = 'Rangliste'
  rankTitle.style.cssText = 'flex: 1; opacity: 0.7'
  const sortTroopsBtn = document.createElement('button')
  const sortGoldBtn = document.createElement('button')
  function styleSortBtn(btn: HTMLButtonElement, active: boolean): void {
    btn.style.cssText = [
      'font: inherit',
      'font-size: 10px',
      'padding: 2px 7px',
      'border-radius: 4px',
      'cursor: pointer',
      'border: 1px solid rgba(255,255,255,0.2)',
      active ? 'background: rgba(232,210,74,0.85)' : 'background: rgba(255,255,255,0.08)',
      active ? 'color: #1a1a1a' : 'color: white',
      active ? 'font-weight: bold' : 'font-weight: normal',
    ].join(';')
  }
  sortTroopsBtn.textContent = 'Truppen'
  sortGoldBtn.textContent = 'Gold'
  sortTroopsBtn.addEventListener('click', () => {
    rankSort = 'troops'
    refreshSortButtons()
  })
  sortGoldBtn.addEventListener('click', () => {
    rankSort = 'gold'
    refreshSortButtons()
  })
  function refreshSortButtons(): void {
    styleSortBtn(sortTroopsBtn, rankSort === 'troops')
    styleSortBtn(sortGoldBtn, rankSort === 'gold')
  }
  refreshSortButtons()
  rankHead.appendChild(rankTitle)
  rankHead.appendChild(sortTroopsBtn)
  rankHead.appendChild(sortGoldBtn)
  rankPanel.appendChild(rankHead)

  const rankBody = document.createElement('div')
  rankBody.style.cssText = 'line-height: 1.5'
  rankPanel.appendChild(rankBody)

  const rankToggle = document.createElement('button')
  rankToggle.style.cssText = [
    'margin-top: 6px',
    'width: 100%',
    'font: inherit',
    'font-size: 11px',
    'padding: 3px',
    'background: rgba(255,255,255,0.08)',
    'border: 1px solid rgba(255,255,255,0.15)',
    'border-radius: 4px',
    'color: white',
    'cursor: pointer',
  ].join(';')
  rankToggle.addEventListener('click', () => {
    rankExpanded = !rankExpanded
    applyRankExpansion()
  })
  function applyRankExpansion(): void {
    if (rankExpanded) {
      rankBody.style.maxHeight = '260px'
      rankBody.style.overflowY = 'auto'
    } else {
      rankBody.style.maxHeight = ''
      rankBody.style.overflowY = ''
    }
  }
  rankPanel.appendChild(rankToggle)
  container.appendChild(rankPanel)

  /* ---- Unten Mitte: eigenes Spieler-Menü ----------------------------------- */
  const actionBar = document.createElement('div')
  actionBar.style.cssText = [
    'position: absolute',
    'bottom: 14px',
    'left: 50%',
    'transform: translateX(-50%)',
    'background: rgba(0,0,0,0.62)',
    'color: white',
    'padding: 10px 16px',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 12px',
    'border-radius: 10px',
    'box-shadow: 0 4px 18px rgba(0,0,0,0.45)',
    'min-width: 440px',
    'pointer-events: auto',
    'z-index: 11',
  ].join(';')

  const barCaption = document.createElement('div')
  barCaption.style.cssText = 'font-size: 11px; margin-bottom: 2px'
  actionBar.appendChild(barCaption)

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
  // Effizienz-Striche: Optimum-Strich (cyan) am Peak der Wachstumskurve — links
  // davon wächst man am besten (grün), rechts wird es zunehmend weniger (gelb), ab
  // dem Stagnations-Strich (rot) ist das Wachstum stark gebremst. Pro Frame aus dem
  // aktuellen Cap neu positioniert.
  const optimumTick = document.createElement('div')
  optimumTick.style.cssText =
    'position:absolute;top:-2px;bottom:-2px;width:3px;background:#46d9e6;box-shadow:0 0 4px #46d9e6;border-radius:1px'
  const stallTick = document.createElement('div')
  stallTick.style.cssText =
    'position:absolute;top:0;bottom:0;width:2px;background:#e05a5a;opacity:0.8'
  barWrap.appendChild(optimumTick)
  barWrap.appendChild(stallTick)
  actionBar.appendChild(barWrap)

  const barLegend = document.createElement('div')
  barLegend.style.cssText = 'font-size: 10px; opacity: 0.75; margin-bottom: 8px'
  actionBar.appendChild(barLegend)

  const sliderWrap = document.createElement('div')
  sliderWrap.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 8px'
  const sliderLabel = document.createElement('span')
  sliderLabel.textContent = `Angriff: ${DEFAULT_SLIDER_PCT}%`
  sliderLabel.style.minWidth = '92px'
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
  actionBar.appendChild(sliderWrap)

  // Bau-Buttons-Reihe (Glyph, Name, Hotkey, Kosten) — setzen den Bau-Modus.
  const buildRow = document.createElement('div')
  buildRow.style.cssText = 'display: flex; gap: 6px'
  const buildButtons = new Map<BuildingType, HTMLButtonElement>()
  const buildCostEls = new Map<BuildingType, HTMLSpanElement>()
  for (const type of BUILDING_TYPES) {
    const btn = document.createElement('button')
    btn.style.cssText = [
      'flex: 1',
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'gap: 1px',
      'padding: 5px 4px',
      'background: rgba(255,255,255,0.06)',
      'border: 1px solid rgba(255,255,255,0.15)',
      'border-radius: 6px',
      'color: white',
      'font: inherit',
      'font-size: 10px',
      'cursor: pointer',
    ].join(';')
    const top = document.createElement('span')
    top.style.cssText = 'font-weight: bold; font-size: 12px'
    top.textContent = `${BUILDING_HOTKEY[type]} ${BUILDING_GLYPH[type]}`
    const name = document.createElement('span')
    name.textContent = BUILDING_LABEL[type]
    name.style.cssText = 'opacity: 0.85'
    const cost = document.createElement('span')
    cost.style.cssText = 'color: #e8c14a; font-size: 9px'
    btn.appendChild(top)
    btn.appendChild(name)
    btn.appendChild(cost)
    btn.addEventListener('click', () => {
      onBuildClick(type)
    })
    btn.addEventListener('mouseenter', () => {
      if (btn.dataset.active !== '1') btn.style.background = 'rgba(255,255,255,0.14)'
    })
    btn.addEventListener('mouseleave', () => {
      if (btn.dataset.active !== '1') btn.style.background = 'rgba(255,255,255,0.06)'
    })
    buildRow.appendChild(btn)
    buildButtons.set(type, btn)
    buildCostEls.set(type, cost)
  }
  actionBar.appendChild(buildRow)
  container.appendChild(actionBar)

  /* ---- Game-Over-Banner ---------------------------------------------------- */
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

  /* ---- Pause-Overlay ------------------------------------------------------- */
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

  /** Findet den menschlichen Spieler (falls vorhanden und lebend). */
  function findHuman(): Player | undefined {
    for (const p of state.players.values()) {
      if (p.isHuman) return p
    }
    return undefined
  }

  /** Aktualisiert die Truppen-Leiste + Bau-Buttons des eigenen Spielers. */
  function updateActionBar(): void {
    const human = findHuman()
    if (human === undefined || !human.isAlive) {
      actionBar.style.display = 'none'
      return
    }
    actionBar.style.display = 'block'

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
    segAttack.style.background = '#e8d24a'
    segCombat.style.left = pctW(idleBase + attackAmt)
    segCombat.style.width = pctW(combat)
    segCombat.style.background = `repeating-linear-gradient(45deg, ${color} 0 5px, rgba(0,0,0,0.4) 5px 10px)`

    const zones = growthZones(cap)
    optimumTick.style.left = `${(zones.optimum * 100).toString()}%`
    stallTick.style.left = `${(zones.stall * 100).toString()}%`
    const frac = total / cap
    const stateColor = frac < zones.optimum ? '#5dd75d' : frac < zones.stall ? '#e8d24a' : '#e05a5a'
    const pct = Math.round(frac * 100)
    barCaption.innerHTML = `Truppen <b style="color:${stateColor}">${fmtCompact(total)}</b> (${pct.toString()}%) / ${fmtCompact(cap)} &nbsp; <span style="color:#e8c14a">${fmtCompact(human.gold)} Gold</span>`
    const combatLegend =
      combat > 0 ? ` &nbsp; <span style="opacity:0.85">▨ im Kampf ${fmtCompact(combat)}</span>` : ''
    barLegend.innerHTML = `<span style="color:#e8d24a">▌</span> Angriff ${fmtCompact(attackAmt)} (${currentSliderPct.toString()}%)${combatLegend}`

    for (const type of BUILDING_TYPES) {
      const costEl = buildCostEls.get(type)
      if (costEl !== undefined) {
        const c = buildCost(type, countBuildingsOfType(state, human.id, type))
        costEl.textContent = fmtCompact(c)
        costEl.style.color = human.gold >= c ? '#e8c14a' : '#d66'
      }
    }
  }

  /** Baut die Ranglisten-Zeilen (Top-5 oder alle), sortiert nach rankSort. */
  function updateRankList(): void {
    const totalTiles =
      state.passableLandCount > 0 ? state.passableLandCount : state.map.width * state.map.height
    const players = [...state.players.values()].filter((p) => p.isAlive || p.tilesOwned > 0)
    const valueOf = (p: Player): number => (rankSort === 'gold' ? p.gold : totalTroops(p))
    players.sort((a, b) => valueOf(b) - valueOf(a))
    const visible = rankExpanded ? players : players.slice(0, RANK_COLLAPSED)

    const rows: string[] = []
    let rank = 0
    for (const p of players) {
      rank++
      if (!rankExpanded && rank > RANK_COLLAPSED) break
      const isMe = p.isHuman
      const dead = p.isAlive ? '' : ' †'
      const pctTiles = fmtPct((p.tilesOwned / totalTiles) * 100)
      const troopsTxt = fmtCompact(totalTroops(p))
      const goldTxt = fmtCompact(p.gold)
      const primary =
        rankSort === 'gold'
          ? `<b style="color:#e8c14a">${goldTxt}</b> · ${troopsTxt}T`
          : `<b>${troopsTxt}</b>T · <span style="color:#e8c14a">${goldTxt}</span>`
      const bg = isMe ? 'background:rgba(255,255,255,0.12);border-radius:4px;' : ''
      rows.push(
        `<div style="display:flex;align-items:center;gap:6px;padding:1px 4px;${bg}">` +
          `<span style="opacity:0.5;min-width:14px">${rank.toString()}</span>` +
          `<span style="color:${rgbaToCss(p.color)}">■</span>` +
          `<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.name)}${dead}</span>` +
          `<span style="opacity:0.55;font-size:10px">${pctTiles}</span>` +
          `<span style="min-width:88px;text-align:right;font-size:10px">${primary}</span>` +
          `</div>`,
      )
    }
    rankBody.innerHTML = rows.join('')
    const hidden = players.length - visible.length
    rankToggle.style.display = players.length > RANK_COLLAPSED ? 'block' : 'none'
    rankToggle.textContent = rankExpanded
      ? 'Weniger ▴'
      : `Alle ${players.length.toString()} anzeigen ▾ (+${Math.max(0, hidden).toString()})`
  }

  function update(): void {
    const gameSeconds = state.tick / SIM_TICKS_PER_SECOND
    const speedLabel = currentSpeed === 0 ? '⏸ Pause' : `${String(currentSpeed)}×`
    const phaseLine =
      state.phase === 'running'
        ? 'läuft'
        : `beendet · Sieger ${state.winner !== null ? (state.players.get(state.winner)?.name ?? '?') : '?'}`
    infoLine.innerHTML = `Zeit ${fmtDuration(gameSeconds)} · ${speedLabel} · ${phaseLine}`

    updateRankList()
    updateActionBar()

    if (state.phase === 'ended' && state.winner !== null) {
      const winner = state.players.get(state.winner)
      if (winner !== undefined) {
        banner.style.display = 'block'
        const totalTiles =
          state.passableLandCount > 0 ? state.passableLandCount : state.map.width * state.map.height
        const ranked = [...state.players.values()].sort(
          (a, b) => b.peakTilesOwned - a.peakTilesOwned,
        )
        const statsRows = ranked
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
    setBuildMode(type: BuildingType | null): void {
      for (const [t, btn] of buildButtons) {
        const active = t === type
        btn.dataset.active = active ? '1' : '0'
        btn.style.background = active ? 'rgba(232,193,74,0.85)' : 'rgba(255,255,255,0.06)'
        btn.style.color = active ? '#1a1a1a' : 'white'
        btn.style.borderColor = active ? '#e8c14a' : 'rgba(255,255,255,0.15)'
      }
    },
    destroy(): void {
      infoBox.remove()
      rankPanel.remove()
      actionBar.remove()
      banner.remove()
      pauseOverlay.remove()
    },
  }
}
