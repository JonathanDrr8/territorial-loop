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

import {
  airportSlots,
  BUILDING_TYPES,
  CITY_CAP_BONUS,
  DEFENSE_BASE_RANGE,
  DEFENSE_MAG_MULTIPLIER,
  DEFENSE_RANGE_PER_LEVEL,
  FLAK_BASE_RANGE,
  FLAK_RANGE_PER_LEVEL,
  type BuildingType,
} from '../core/buildings'
import { WARSHIP_COST, type BomberRoute } from '../core/ships'
import { growthZones, troopIncreaseRate } from '../core/config'
import { areAllied, pairKey } from '../core/diplomacy'
import {
  bomberHangarInfo,
  bomberLaunchInfo,
  buildCostFor,
  countBuildingsOfType,
  effectiveMaxTroops,
  goldBreakdown,
  isBuildingAllowed,
  totalTroops,
  warshipCapacity,
  type GameState,
  type Player,
} from '../core/game'
import { t } from '../i18n'
import { rgbaToCss } from './colors'
import { buildingIcon, icon } from './icons'
import { registerScalable } from './ui-scale'

const DEFAULT_SLIDER_PCT = 30
const SIM_TICKS_PER_SECOND = 10
const RANK_COLLAPSED = 5
/** Sample-Intervall (Ticks) für die geglättete Gold-Einkommensrate. */
const GOLD_SAMPLE_TICKS = 30

const BUILDING_HOTKEY: Record<BuildingType, string> = {
  city: '1',
  defense: '2',
  port: '3',
  factory: '4',
  airport: '5',
  flak: '6',
}
/** Gebäude-Tooltip (übersetzt zur Aufruf-Zeit). */
function buildingTooltip(type: BuildingType): string {
  switch (type) {
    case 'city':
      return t('hud.tooltip.city', { cap: fmtCompact(CITY_CAP_BONUS) })
    case 'defense':
      return t('hud.tooltip.defense', {
        range: DEFENSE_BASE_RANGE,
        per: DEFENSE_RANGE_PER_LEVEL,
        mult: DEFENSE_MAG_MULTIPLIER,
      })
    case 'port':
      return t('hud.tooltip.port')
    case 'factory':
      return t('hud.tooltip.factory')
    case 'airport':
      return t('hud.tooltip.airport', { slots: airportSlots(1) })
    case 'flak':
      return t('hud.tooltip.flak', { range: FLAK_BASE_RANGE, per: FLAK_RANGE_PER_LEVEL })
  }
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
  /** Markiert den Boot-Modus (Button-Highlight + Hinweisbanner). */
  setBoatMode(on: boolean): void
  /** Zeigt/aktualisiert den Bomber-Modus-Hinweis (mit aktiver Route). */
  setBomberMode(on: boolean, route: BomberRoute): void
  /** Zeigt/versteckt den Kriegsschiff-Modus-Hinweis. */
  setWarshipMode(on: boolean): void
  /** Setzt den Angriffs-Slider extern (z.B. Shift+Mausrad) — bewegt Regler + Label. */
  setSliderPct(pct: number): void
  /** Blitzt kurz einen „Resync…"-Hinweis auf (Server-Korrektur-Snapshot eingespielt). */
  flashResync(): void
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
  onBoatClick: () => void,
  onBomberClick: () => void,
  onWarshipClick: () => void,
  onCancelAttack: (attackIndex: number) => void,
  onRecallBoat: (boatIndex: number) => void,
  onRecallWarship: (warshipIndex: number) => void,
  onDefend: (attackerId: number) => void,
  /** Zentriert die Kamera auf ein Tile (Sprung zum Kampf-/Schiff-Ort). */
  onLocate: (tile: number) => void,
  /** Spieler-ID des lokalen Menschen („du") — MP-sicher statt isHuman zu raten. */
  localHumanId: number,
): HUDApi {
  let currentSpeed: SpeedMultiplier = 1
  let currentSliderPct = DEFAULT_SLIDER_PCT
  let rankSort: RankSort = 'troops'
  let rankExpanded = false
  // Geglättetes Gold-Einkommen (Gold/s) — mittelt sprunghaften Handel. Per Sample
  // alle GOLD_SAMPLE_TICKS Ticks aktualisiert (EMA).
  let goldRatePerSec = 0
  let lastGoldSampleTick = -1
  let lastGoldSampleValue = 0

  /* ---- Oben links: kompakte Info + Steuerungs-Hinweis ---------------------- */
  const infoBox = document.createElement('div')
  infoBox.style.cssText = [
    'position: absolute',
    // Unter der Chrome-Zeile (UI-Größe + Feedback), die oben links bei top:12 sitzt. Die
    // Box klappt „Controls" nach unten auf → überdeckt die Chrome-Zeile darüber nie.
    'top: 52px',
    'left: 12px',
    'background: rgba(0,0,0,0.82)',
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
  helpSummary.textContent = t('hud.controls')
  helpSummary.style.cssText = 'cursor: pointer; opacity: 0.8'
  helpDetails.appendChild(helpSummary)
  const helpBody = document.createElement('div')
  helpBody.style.cssText = 'margin-top: 4px; line-height: 1.5'
  helpBody.innerHTML = t('hud.controlsBody')
  helpDetails.appendChild(helpBody)
  infoBox.appendChild(helpDetails)
  container.appendChild(infoBox)
  registerScalable(infoBox)

  /* ---- Verräter-Warnung: oben mittig, nur wenn DU selbst geächtet bist ---------- */
  const traitorBanner = document.createElement('div')
  traitorBanner.style.cssText = [
    'position: absolute',
    'top: 68px',
    'left: 50%',
    'transform: translateX(-50%)',
    'background: rgba(120,20,20,0.92)',
    'color: #ffd9d4',
    'padding: 7px 14px',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 13px',
    'font-weight: bold',
    'border: 1px solid #e8736b',
    'border-radius: 6px',
    'z-index: 11',
    'display: none',
    'pointer-events: none',
    'text-align: center',
  ].join(';')
  container.appendChild(traitorBanner)

  // Resync-Hinweis: blitzt nur kurz auf, wenn der Server gerade einen Korrektur-Snapshot
  // eingespielt hat (Mid-Match-Resync, ADR-0009 Phase 6). Kein Dauer-Status — nur „passiert gerade".
  const resyncTag = document.createElement('div')
  resyncTag.style.cssText = [
    'position: absolute',
    'top: 100px',
    'left: 50%',
    'transform: translateX(-50%)',
    'background: rgba(20,60,110,0.92)',
    'color: #cfe6ff',
    'padding: 6px 12px',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 12px',
    'border: 1px solid #4f9fe0',
    'border-radius: 6px',
    'z-index: 12',
    'display: none',
    'pointer-events: none',
    'transition: opacity 0.3s',
  ].join(';')
  container.appendChild(resyncTag)
  let resyncTimer: ReturnType<typeof setTimeout> | null = null

  /* ---- Gefahren-Vignette: pulst rot am Bildschirmrand wenn man angegriffen wird --- */
  const dangerStyle = document.createElement('style')
  dangerStyle.textContent = '@keyframes tl-danger-pulse{0%,100%{opacity:0.35}50%{opacity:0.9}}'
  document.head.appendChild(dangerStyle)
  const dangerVignette = document.createElement('div')
  // Radialer Verlauf (transparente Mitte → rote Ränder) statt teurem box-shadow-Blur,
  // plus `will-change: opacity` → eigenes GPU-Layer, der Puls wird nur composited
  // (kein Neu-Rastern pro Frame → kein Lag über dem Canvas).
  dangerVignette.style.cssText = [
    'position: absolute',
    'inset: 0',
    'pointer-events: none',
    'z-index: 9',
    'display: none',
    'will-change: opacity',
    'background: radial-gradient(ellipse at center, rgba(225,40,40,0) 52%, rgba(225,40,40,0.6) 100%)',
  ].join(';')
  container.appendChild(dangerVignette)

  /* ---- Aktive Aktionen (Abbrechen/Abwehr/Schiff-Rückruf) ------------------- */
  // Eigene Liste LINKS neben der Hauptbox (unten gemeinsam im bottomWrap, siehe unten) —
  // ausgehende Angriffe (mit ✕), Abwehr und Schiff-/Boot-Rückruf. Frei klickbar, direkt
  // beim Geschehen.
  const attackPanel = document.createElement('div')
  // ÜBER der zentralen Hauptbox (rechtsbündig), wächst nach oben in den freien Kartenraum. Früher
  // links daneben — das kollidierte mit dem Ressourcen-Block unten links (der sich beim Aufklappen
  // der Economy-Aufschlüsselung zudem nach oben ausdehnt).
  attackPanel.style.cssText = [
    'position: absolute',
    'right: 0',
    'bottom: calc(100% + 8px)',
    'background: rgba(0,0,0,0.86)',
    'color: white',
    'padding: 8px 11px',
    'border-radius: 10px',
    'box-shadow: 0 4px 18px rgba(0,0,0,0.45)',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 11px',
    'line-height: 1.7',
    'width: max-content',
    'max-width: 240px',
    'pointer-events: auto',
    'display: none',
  ].join(';')
  // Delegierte Aktion auf `mousedown` (NICHT `click`!): das Panel re-rendert sein innerHTML laufend,
  // sodass ein `click` (= mousedown+mouseup am selben Element) oft ins Leere geht, weil das Element
  // dazwischen ersetzt wurde. `mousedown` feuert atomar beim Drücken → zuverlässig. Nur linke Taste.
  attackPanel.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    const el = (e.target as HTMLElement | null)?.closest(
      '[data-locate],[data-cancel],[data-recall],[data-recall-warship],[data-defend]',
    )
    if (!(el instanceof HTMLElement)) return
    // ⌖ „Zum Kampf springen" hat Vorrang vor der Zeilen-Aktion (Abbrechen/Abwehren/Zurückrufen).
    const locate = el.dataset.locate
    if (locate !== undefined) {
      onLocate(Number(locate))
      return
    }
    const cancel = el.dataset.cancel
    const recall = el.dataset.recall
    const recallWar = el.dataset.recallWarship
    const defend = el.dataset.defend
    if (cancel !== undefined) onCancelAttack(Number(cancel))
    else if (recall !== undefined) onRecallBoat(Number(recall))
    else if (recallWar !== undefined) onRecallWarship(Number(recallWar))
    else if (defend !== undefined) onDefend(Number(defend))
  })

  // Eigener Hover-Tooltip fürs Angriffs-Panel. Der native `title` taugt hier nicht: das Panel
  // re-rendert sein innerHTML laufend, sodass das Browser-Tooltip-Delay (~1 s ruhiger Hover) nie
  // greift. Stattdessen ein eigener DIV, der per Delegation am Panel-Container hängt (überlebt das
  // Neu-Zeichnen) und sofort den `data-tip`-Text des Elements unterm Cursor zeigt.
  const attackTip = document.createElement('div')
  attackTip.style.cssText = [
    'position: fixed',
    'z-index: 30',
    'pointer-events: none',
    'background: rgba(0,0,0,0.92)',
    'color: white',
    'padding: 5px 8px',
    'border-radius: 6px',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 11px',
    'white-space: nowrap',
    'box-shadow: 0 3px 12px rgba(0,0,0,0.5)',
    'display: none',
  ].join(';')
  container.appendChild(attackTip)
  function positionAttackTip(e: MouseEvent): void {
    // Über dem Cursor, leicht versetzt; am rechten Rand nach links klappen.
    const pad = 12
    const w = attackTip.offsetWidth
    let x = e.clientX + pad
    if (x + w > window.innerWidth - 4) x = e.clientX - pad - w
    attackTip.style.left = `${Math.max(4, x)}px`
    attackTip.style.top = `${Math.max(4, e.clientY - 30)}px`
  }
  attackPanel.addEventListener('mousemove', (e) => {
    const el = (e.target as HTMLElement | null)?.closest('[data-tip]')
    const tip = el instanceof HTMLElement ? el.dataset.tip : undefined
    if (tip === undefined || tip === '') {
      attackTip.style.display = 'none'
      return
    }
    attackTip.textContent = tip
    attackTip.style.display = 'block'
    positionAttackTip(e)
  })
  attackPanel.addEventListener('mouseleave', () => {
    attackTip.style.display = 'none'
  })

  /* ---- Oben rechts: Rangliste ---------------------------------------------- */
  const rankPanel = document.createElement('div')
  rankPanel.style.cssText = [
    'position: absolute',
    'top: 12px',
    'right: 12px',
    'width: 250px',
    'background: rgba(0,0,0,0.82)',
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
  rankTitle.textContent = t('hud.rank')
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
  sortTroopsBtn.textContent = t('hud.troops')
  sortGoldBtn.textContent = t('hud.gold')
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
  registerScalable(rankPanel)

  /* ---- Unten Mitte: eigenes Spieler-Menü ----------------------------------- */
  const actionBar = document.createElement('div')
  // Direkt am unteren Bildrand (bündig) — spart Platz; nur oben abgerundet.
  actionBar.style.cssText = [
    'position: absolute',
    'bottom: 0',
    'left: 50%',
    'transform: translateX(-50%)',
    'background: rgba(0,0,0,0.86)',
    'color: white',
    'padding: 8px 16px 10px',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 12px',
    'border-radius: 10px 10px 0 0',
    'box-shadow: 0 -2px 18px rgba(0,0,0,0.45)',
    'min-width: 420px',
    'pointer-events: auto',
    'z-index: 11',
  ].join(';')

  // Aktive-Aktionen-Liste als absolutes Kind LINKS außerhalb der Hauptbox (verschiebt sie nicht).
  actionBar.appendChild(attackPanel)

  /* ---- Unten links: Ressourcen-Block (Truppen GROSS + Balken + Gold) -------- */
  // UI-Redesign Schritt 1: Truppen sind die wichtigste Zahl → prominent unten links, die ZAHL
  // separat (groß) statt auf dem Balken; der Balken bleibt rein visuell (idle/Angriff/Kampf +
  // Wachstums-Zonen). Gold zieht aus der Aktions-Leiste mit hierher („alle Ressourcen an einem Ort").
  const troopBadge = document.createElement('div')
  troopBadge.style.cssText = [
    'position: absolute',
    'bottom: 12px',
    'left: 12px',
    'background: rgba(0,0,0,0.86)',
    'color: white',
    'padding: 10px 14px 11px',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 15px',
    'border-radius: 12px',
    'box-shadow: 0 4px 18px rgba(0,0,0,0.45)',
    'min-width: 240px',
    'max-width: 320px',
    'pointer-events: auto',
    'z-index: 11',
    'display: flex',
    'flex-direction: column',
    'gap: 4px',
  ].join(';')

  // Große, prominente Truppen-Zahl (der Held des HUD) — separat ÜBER dem Balken, nicht drauf.
  const troopBig = document.createElement('div')
  troopBig.style.cssText = [
    'display: flex',
    'align-items: baseline',
    'gap: 8px',
    'line-height: 1.05',
  ].join(';')
  // Eigenes Zahl-Element (wird per innerHTML aktualisiert), damit das Rate-Element daneben bleibt.
  const troopNumEl = document.createElement('div')
  troopBig.appendChild(troopNumEl)
  troopBadge.appendChild(troopBig)

  // (Balken-Beschriftung entfällt — die Zahl steht jetzt groß in troopBig.)
  const barCaption = document.createElement('div')
  barCaption.style.cssText = 'display: none'

  const barWrap = document.createElement('div')
  barWrap.style.cssText = [
    'position: relative',
    'height: 28px',
    'background: rgba(255,255,255,0.08)',
    'border: 1px solid rgba(255,255,255,0.15)',
    'border-radius: 4px',
    'overflow: hidden',
    'margin-bottom: 3px',
  ].join(';')
  // Balken bewusst schlicht: eine ruhige Nationsfarbe. KEINE Optimum/Stagnations-Striche
  // mehr — die haben gedrängt, Truppen auszugeben. Idle-Truppen voll, im Kampf befindliche
  // als texturierter Teil desselben Tons (busy ≠ Druck). Nur die große Zahl färbt sich
  // beim Wachsen (Ampel) als sanfter Hinweis.
  const segIdle = document.createElement('div')
  const segCombat = document.createElement('div')
  for (const seg of [segIdle, segCombat]) {
    seg.style.cssText = 'position: absolute; top: 0; bottom: 0'
    barWrap.appendChild(seg)
  }
  barWrap.appendChild(barCaption)

  // Truppen-pro-Sekunde (Wachstums-Zonenfarbe) — inline rechts neben der großen Zahl in troopBig.
  const troopRateEl = document.createElement('div')
  troopRateEl.style.cssText = [
    'font-size: 14px',
    'font-weight: bold',
    'font-variant-numeric: tabular-nums',
    'margin-left: auto',
  ].join(';')
  troopBig.appendChild(troopRateEl)
  // Balken voll breit direkt unter der Zahl (kein gequetschtes Flex-Row mehr).
  troopBadge.appendChild(barWrap)

  const barLegend = document.createElement('div')
  barLegend.style.cssText = 'font-size: 11px; opacity: 0.75; min-height: 0'
  troopBadge.appendChild(barLegend)
  container.appendChild(troopBadge)
  registerScalable(troopBadge)

  const sliderWrap = document.createElement('div')
  sliderWrap.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 8px'
  const sliderLabel = document.createElement('span')
  sliderLabel.textContent = t('hud.attack', { pct: DEFAULT_SLIDER_PCT })
  sliderLabel.style.minWidth = '150px'
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
    sliderLabel.textContent = t('hud.attack', { pct })
    onSliderChange(pct)
  })
  sliderWrap.appendChild(sliderLabel)
  sliderWrap.appendChild(slider)
  actionBar.appendChild(sliderWrap)

  // Tooltip über der Leiste — erklärt beim Hover, was ein Gebäude bewirkt.
  const buildTooltip = document.createElement('div')
  buildTooltip.style.cssText = [
    'position: absolute',
    'left: 16px',
    'right: 16px',
    'bottom: calc(100% + 8px)',
    'background: rgba(12,14,20,0.95)',
    'border: 1px solid rgba(255,255,255,0.15)',
    'border-radius: 6px',
    'padding: 6px 10px',
    'font-size: 11px',
    'line-height: 1.4',
    'text-align: center',
    'pointer-events: none',
    'display: none',
  ].join(';')
  actionBar.appendChild(buildTooltip)

  // Gold-Zeile im Ressourcen-Block (unten links): Vorrat + geglättete Einkommensrate. Klick
  // klappt die Economy-Aufschlüsselung auf (Grund-Gold / Fabrik-Netz / Handel).
  const goldEl = document.createElement('div')
  goldEl.style.cssText = 'font-size: 13px; color: #e8c14a; cursor: pointer; margin-top: 2px'
  troopBadge.appendChild(goldEl)

  // Aufklappbare Economy-Aufschlüsselung (Grund-Gold / Fabrik-Netz / Handel).
  let economyOpen = false
  const goldDetail = document.createElement('div')
  goldDetail.style.cssText = [
    'display: none',
    'font-size: 11px',
    'line-height: 1.5',
    'margin: 2px 0 0',
    'padding: 5px 7px',
    'background: rgba(0,0,0,0.35)',
    'border-radius: 5px',
    'color: #d8d2bf',
  ].join(';')
  troopBadge.appendChild(goldDetail)
  goldEl.addEventListener('click', () => {
    economyOpen = !economyOpen
    goldDetail.style.display = economyOpen ? 'block' : 'none'
  })

  // Bau-Buttons-Reihe (Glyph, Name, Hotkey, Kosten) — setzen den Bau-Modus.
  const buildRow = document.createElement('div')
  buildRow.style.cssText = 'display: flex; gap: 6px'
  const buildButtons = new Map<BuildingType, HTMLButtonElement>()
  const buildCostEls = new Map<BuildingType, HTMLSpanElement>()
  const buildCountEls = new Map<BuildingType, HTMLSpanElement>()
  for (const type of BUILDING_TYPES) {
    const btn = document.createElement('button')
    btn.style.cssText = [
      'position: relative',
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
    // Erkennbares Symbol-Icon + kleine Hotkey-Ziffer (statt Buchstabe C/D/P…). Name steht im
    // Tooltip + Radialmenü; hier nur Icon + Hotkey + Kosten (kompakter Chip).
    const top = document.createElement('span')
    top.style.cssText = 'display: flex; align-items: center; gap: 3px; height: 20px'
    top.innerHTML =
      `<span style="font-size:10px;opacity:0.55;font-weight:bold">${BUILDING_HOTKEY[type]}</span>` +
      buildingIcon(type)
    const cost = document.createElement('span')
    cost.style.cssText = 'color: #5dd75d; font-size: 12px; font-weight: bold'
    // Kleines Badge oben rechts: wie viele dieses Gebäudes man aktuell besitzt (0 = versteckt).
    const count = document.createElement('span')
    count.style.cssText = [
      'position: absolute',
      'top: 2px',
      'right: 3px',
      'font-size: 9px',
      'font-weight: bold',
      'color: rgba(255,255,255,0.55)',
      'line-height: 1',
    ].join(';')
    btn.appendChild(top)
    btn.appendChild(cost)
    btn.appendChild(count)
    buildCountEls.set(type, count)
    btn.addEventListener('click', () => {
      onBuildClick(type)
    })
    btn.addEventListener('mouseenter', () => {
      if (btn.dataset.active !== '1') btn.style.background = 'rgba(255,255,255,0.14)'
      buildTooltip.textContent = buildingTooltip(type)
      buildTooltip.style.display = 'block'
    })
    btn.addEventListener('mouseleave', () => {
      if (btn.dataset.active !== '1') btn.style.background = 'rgba(255,255,255,0.06)'
      buildTooltip.style.display = 'none'
    })
    buildRow.appendChild(btn)
    buildButtons.set(type, btn)
    buildCostEls.set(type, cost)
  }
  actionBar.appendChild(buildRow)

  // Einheiten-Reihe (Toggle-Modi): Boot / Bomber / Kriegsschiff — jeweils mit Hotkey + Kosten.
  // Klick schaltet den Modus, danach setzt ein Linksklick auf der Karte die Einheit ab.
  const unitRow = document.createElement('div')
  unitRow.style.cssText = 'display: flex; gap: 6px; margin-top: 6px'
  const makeUnitBtn = (
    hotkey: string,
    label: string,
    costText: string,
  ): { btn: HTMLButtonElement; costEl: HTMLSpanElement; capEl: HTMLSpanElement } => {
    const btn = document.createElement('button')
    btn.style.cssText = [
      'position: relative',
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
      'font-size: 11px',
      'cursor: pointer',
    ].join(';')
    const top = document.createElement('span')
    top.style.cssText = 'font-weight: bold'
    top.innerHTML = `<span style="font-size:13px">${hotkey}</span> ${label}`
    const costEl = document.createElement('span')
    costEl.style.cssText = 'font-size: 11px; font-weight: bold; color: #5dd75d'
    costEl.textContent = costText
    // Kapazitäts-Badge oben rechts („benutzt/Kapazität", z. B. 2/4) — nur für Einheiten mit Limit
    // (Bomber-Hangars, Kriegsschiff-Slots). Bleibt leer, solange niemand es füllt.
    const capEl = document.createElement('span')
    capEl.style.cssText = [
      'position: absolute',
      'top: 2px',
      'right: 4px',
      'font-size: 9px',
      'font-weight: bold',
      'line-height: 1',
      'font-variant-numeric: tabular-nums',
      'color: rgba(255,255,255,0.6)',
    ].join(';')
    btn.appendChild(top)
    btn.appendChild(costEl)
    btn.appendChild(capEl)
    unitRow.appendChild(btn)
    return { btn, costEl, capEl }
  }
  // Boot kostet Truppen (kein Gold) → grauer Hinweis statt Gold-Kosten.
  const boat = makeUnitBtn('B', t('hud.boat'), t('hud.troops'))
  const boatBtn = boat.btn
  boat.costEl.style.color = 'rgba(255,255,255,0.5)'
  boatBtn.addEventListener('click', () => {
    onBoatClick()
  })
  const bomber = makeUnitBtn('7', t('hud.bomber'), '')
  const bomberBtn = bomber.btn
  const bomberCostEl = bomber.costEl
  const bomberCapEl = bomber.capEl
  bomberBtn.addEventListener('click', () => {
    onBomberClick()
  })
  const warship = makeUnitBtn('8', t('hud.warship'), fmtCompact(WARSHIP_COST))
  const warshipBtn = warship.btn
  const warshipCostEl = warship.costEl
  const warshipCapEl = warship.capEl
  warshipBtn.addEventListener('click', () => {
    onWarshipClick()
  })
  actionBar.appendChild(unitRow)

  // Hinweis-Banner während aktivem Boot-Modus.
  const boatHint = document.createElement('div')
  boatHint.style.cssText = [
    'margin-top: 6px',
    'padding: 5px 8px',
    'display: none',
    'background: rgba(70,217,230,0.15)',
    'border: 1px solid rgba(70,217,230,0.6)',
    'border-radius: 6px',
    'color: #aef3fb',
    'font-size: 11px',
    'text-align: center',
  ].join(';')
  boatHint.innerHTML = `${icon.ship} ${escapeHtml(t('hud.boatModeHint'))}`
  actionBar.appendChild(boatHint)

  // Hinweis-Banner während aktivem Bomber-Modus (zeigt die gewählte Route, Shift+Rad wechselt).
  const bomberHint = document.createElement('div')
  bomberHint.style.cssText = [
    'margin-top: 6px',
    'padding: 5px 8px',
    'display: none',
    'background: rgba(232,136,74,0.15)',
    'border: 1px solid rgba(232,136,74,0.6)',
    'border-radius: 6px',
    'color: #f4c89a',
    'font-size: 11px',
    'text-align: center',
  ].join(';')
  actionBar.appendChild(bomberHint)

  // Hinweis-Banner während aktivem Kriegsschiff-Modus.
  const warshipHint = document.createElement('div')
  warshipHint.style.cssText = [
    'margin-top: 6px',
    'padding: 5px 8px',
    'display: none',
    'background: rgba(120,200,255,0.15)',
    'border: 1px solid rgba(120,200,255,0.6)',
    'border-radius: 6px',
    'color: #bfe0ff',
    'font-size: 11px',
    'text-align: center',
  ].join(';')
  warshipHint.textContent = t('hud.warshipModeHint')
  actionBar.appendChild(warshipHint)

  container.appendChild(actionBar)
  registerScalable(actionBar)

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
  newMatchBtn.textContent = t('hud.newMatch')
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
  pauseOverlay.textContent = t('hud.pauseOverlay')
  container.appendChild(pauseOverlay)

  /** Findet den menschlichen Spieler (falls vorhanden und lebend). */
  function findHuman(): Player | undefined {
    // Explizit über die lokale ID (MP-sicher) — `isHuman` würde im Mehrspieler den ersten
    // Menschen liefern und damit auf fremden Clients die falschen Werte anzeigen.
    return state.players.get(localHumanId)
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
    const color = rgbaToCss(human.color)
    const pctW = (v: number): string => `${Math.max(0, Math.min(100, (v / cap) * 100)).toString()}%`

    segIdle.style.left = '0%'
    segIdle.style.width = pctW(idle)
    segIdle.style.background = color
    segCombat.style.left = pctW(idle)
    segCombat.style.width = pctW(combat)
    segCombat.style.background = `repeating-linear-gradient(45deg, ${color} 0 5px, rgba(0,0,0,0.4) 5px 10px)`

    const zones = growthZones(cap)
    const frac = total / cap
    const stateColor = frac < zones.optimum ? '#5dd75d' : frac < zones.stall ? '#e8d24a' : '#e05a5a'
    const pct = Math.round(frac * 100)
    // Große, prominente Truppen-Zahl (Held); Cap/%/Label klein daneben.
    troopNumEl.innerHTML =
      `<span style="font-size:27px;font-weight:800;color:${stateColor};font-variant-numeric:tabular-nums">${fmtCompact(total)}</span>` +
      `<span style="font-size:12px;opacity:0.75"> / ${fmtCompact(cap)} ${t('hud.troops')} · ${pct.toString()}%</span>`
    // Angriffsmenge steht jetzt im Slider-Label (eine Quelle statt zwei). Die Legende zeigt
    // nur noch die einzigartige „im Kampf"-Info und blendet sich aus, wenn nichts kämpft.
    sliderLabel.textContent = `${t('hud.attack', { pct: currentSliderPct })} · ≈${fmtCompact(attackAmt)}`
    if (combat > 0) {
      barLegend.innerHTML = `<span style="opacity:0.85">▨ ${t('hud.inCombat', { n: fmtCompact(combat) })}</span>`
      barLegend.style.display = 'block'
    } else {
      barLegend.style.display = 'none'
    }

    // Truppen/s (links neben dem Balken), in derselben Zonenfarbe wie die Truppenzahl;
    // negativ (über Cap → Abschmelzen) wird rot. Wie growPopulations: freie Bevölkerung
    // gegen ihren freien Cap-Platz.
    const freeCap = Math.max(0, cap - combat)
    const ratePerSec = troopIncreaseRate(idle, freeCap) * SIM_TICKS_PER_SECOND
    const rateColor = ratePerSec < 0 ? '#e05a5a' : stateColor
    const rateSign = ratePerSec >= 0 ? '+' : '−'
    troopRateEl.style.color = rateColor
    troopRateEl.innerHTML = `${rateSign}${fmtCompact(Math.abs(ratePerSec))}<span style="font-size:9px;opacity:0.7">/s</span>`

    // Gold-Vorrat + geglättete EINKOMMENS-Rate (EMA über GOLD_SAMPLE_TICKS). Wir sampeln
    // `goldEarned` (nur Einnahmen), NICHT `gold` — sonst würde ein Kauf die Rate kurzzeitig
    // negativ/auf 0 drücken, obwohl die Produktion unverändert läuft.
    if (lastGoldSampleTick < 0) {
      lastGoldSampleTick = state.tick
      lastGoldSampleValue = human.goldEarned
    } else if (state.tick - lastGoldSampleTick >= GOLD_SAMPLE_TICKS) {
      const dTicks = state.tick - lastGoldSampleTick
      const sampleRate = ((human.goldEarned - lastGoldSampleValue) / dTicks) * SIM_TICKS_PER_SECOND
      goldRatePerSec = goldRatePerSec * 0.7 + sampleRate * 0.3
      lastGoldSampleTick = state.tick
      lastGoldSampleValue = human.goldEarned
    }
    const caret = economyOpen ? '▾' : '▸'
    goldEl.innerHTML = `<b>${fmtCompact(human.gold)}</b> ${t('hud.gold')} <span style="opacity:0.7">≈ +${fmtCompact(Math.max(0, goldRatePerSec))}/s</span> <span style="opacity:0.55">${caret}</span>`
    if (economyOpen) {
      const gb = goldBreakdown(state, human.id)
      const baseSec = gb.base * SIM_TICKS_PER_SECOND
      const factorySec = gb.factory * SIM_TICKS_PER_SECOND
      const tradeSec = Math.max(0, Math.round(goldRatePerSec - baseSec - factorySec))
      const factoryNote =
        gb.factories > 0
          ? ` <span style="opacity:0.6">(${t('hud.ecoNote', { factories: gb.factories, dests: gb.dests })})</span>`
          : ''
      const line = (label: string, perSec: number, note = ''): string =>
        `<div style="display:flex;justify-content:space-between;gap:10px"><span>${label}${note}</span><span>+${fmtCompact(perSec)}/s</span></div>`
      goldDetail.innerHTML =
        line(t('hud.ecoBase'), baseSec) +
        line(t('hud.ecoFactory'), factorySec, factoryNote) +
        line(t('hud.ecoTrade'), tradeSec) +
        `<div style="border-top:1px solid rgba(255,255,255,0.18);margin-top:3px;padding-top:3px;display:flex;justify-content:space-between;gap:10px"><span><b>${t('hud.ecoSum')}</b></span><span><b>≈ +${fmtCompact(Math.max(0, goldRatePerSec))}/s</b></span></div>`
    }

    for (const type of BUILDING_TYPES) {
      const btnEl = buildButtons.get(type)
      // Im Match deaktivierte Gebäudetypen ganz ausblenden (Setup-Toggle / MP-Settings).
      if (btnEl !== undefined) {
        btnEl.style.display = isBuildingAllowed(state.config, type) ? '' : 'none'
      }
      // Anzahl-Badge: wie viele dieses Gebäudes der Spieler aktuell besitzt (0 = leer).
      const countEl = buildCountEls.get(type)
      if (countEl !== undefined) {
        const n = countBuildingsOfType(state, human.id, type)
        countEl.textContent = n > 0 ? String(n) : ''
      }
      const costEl = buildCostEls.get(type)
      if (costEl !== undefined) {
        const c = buildCostFor(state, human.id, type)
        const afford = human.gold >= c
        costEl.textContent = fmtCompact(c)
        costEl.style.color = afford ? '#5dd75d' : '#ef5350'
        // Ganzer Button signalisiert Bezahlbarkeit (nicht nur die kleine Zahl): unbezahlbar →
        // gedimmt + roter Rand, damit der Wechsel sofort sichtbar ist.
        const btn = buildButtons.get(type)
        if (btn !== undefined) {
          btn.style.opacity = afford ? '1' : '0.55'
          btn.style.borderColor = afford ? 'rgba(255,255,255,0.15)' : 'rgba(239,83,80,0.7)'
        }
      }
    }
    // Bomber-Kosten dynamisch: nur Munition (geparktes Flugzeug) oder Flugzeug-Kauf + Munition.
    const bi = bomberLaunchInfo(state, human.id)
    bomberCostEl.textContent = fmtCompact(bi.cost)
    bomberCostEl.style.color = bi.available && human.gold >= bi.cost ? '#5dd75d' : '#ef5350'
    // Hangar-Auslastung als Zähler (geparkt + in der Luft / Plätze). Voll → rot getönt.
    const bh = bomberHangarInfo(state, human.id)
    bomberCapEl.textContent =
      bh.capacity > 0 ? `${bh.used.toString()}/${bh.capacity.toString()}` : ''
    bomberCapEl.style.color =
      bh.used >= bh.capacity ? 'rgba(239,83,80,0.85)' : 'rgba(255,255,255,0.6)'
    // Kriegsschiff: Kosten NUR grün, wenn bezahlbar UND ein Slot frei ist (sonst bringt das Gold
    // nichts — das war der Bug). Slots = Summe der Hafen-Level; aktive = eigene Kriegsschiffe.
    const wsCap = warshipCapacity(state, human.id)
    const wsActive = state.warships.reduce((n, w) => (w.ownerId === human.id ? n + 1 : n), 0)
    const wsRoom = wsActive < wsCap
    warshipCostEl.style.color = wsRoom && human.gold >= WARSHIP_COST ? '#5dd75d' : '#ef5350'
    warshipCapEl.textContent = wsCap > 0 ? `${wsActive.toString()}/${wsCap.toString()}` : ''
    warshipCapEl.style.color = wsRoom ? 'rgba(255,255,255,0.6)' : 'rgba(239,83,80,0.85)'
  }

  // Memoisiertes Panel-HTML: nur neu setzen, wenn sich der Inhalt wirklich ändert — sonst würde das
  // 60×/s-Re-Rendern die interaktiven Elemente ständig zerstören (Klick/Hover gehen verloren).
  let lastAttackHtml = ''
  /** Übersicht eigener (ausgehender) und eingehender Angriffe mit Dauer. */
  function updateAttackPanel(): void {
    const human = findHuman()
    if (human === undefined || !human.isAlive) {
      attackPanel.style.display = 'none'
      return
    }
    const dur = (startTick: number): string =>
      fmtDuration((state.tick - startTick) / SIM_TICKS_PER_SECOND)
    // Eine Zeile = Flex-Row, einzeilig (kein Umbruch): Icon + Label links, Aktion rechts.
    const rowStyle =
      'cursor:pointer;border-radius:4px;padding:3px 5px;display:flex;align-items:center;gap:6px;white-space:nowrap'
    const act = (html: string): string =>
      `<span style="margin-left:auto;opacity:0.7">${html}</span>`
    // Rechte Zeilen-Gruppe: ⌖ „Zum Kampf springen" (zentriert die Kamera) + die Aktion.
    const locateAct = (tile: number, actionHtml: string): string =>
      `<span style="margin-left:auto;display:flex;align-items:center;gap:8px;opacity:0.75">` +
      `<span data-locate="${String(tile)}" data-tip="${t('hud.jumpToBattle')}" style="cursor:pointer">⌖</span>` +
      `<span>${actionHtml}</span></span>`
    const rows: string[] = []
    // Ausgehende Angriffe — klickbar zum Abbrechen (Reserve fließt über ~2.5s zurück).
    human.attacks.forEach((atk, i) => {
      const target =
        atk.targetPlayerId === 0
          ? t('hud.wilderness')
          : (state.players.get(atk.targetPlayerId)?.name ?? '?')
      const cancelling = atk.cancelStartTick !== undefined
      const actionHtml = cancelling
        ? `<span style="color:#e8b84a">${t('hud.cancelling')}</span>`
        : '✕'
      const title = cancelling ? t('hud.cancelNow') : t('hud.cancelAttack')
      rows.push(
        `<div data-cancel="${String(i)}" data-tip="${title}" style="${rowStyle}"><span style="color:#5dd75d;display:inline-flex;align-items:center;gap:1px">${icon.swords}→</span><span>${escapeHtml(target)} · ${fmtCompact(atk.reserveTroops)} · ${dur(atk.startTick)}</span>${locateAct(atk.frontTile, actionHtml)}</div>`,
      )
    })
    // Eigene Boote — klickbar zum Zurückrufen.
    let boatIdx = 0
    for (const boat of state.boats) {
      if (boat.ownerId !== human.id) continue
      const label = boat.returning ? t('hud.returning') : t('hud.enRoute')
      rows.push(
        `<div data-recall="${String(boatIdx)}" data-tip="${t('hud.recallBoat')}" style="${rowStyle}"><span style="color:#46d9e6;display:inline-flex">${icon.ship}</span><span>${fmtCompact(boat.troops)} · ${label}</span>${act('↩')}</div>`,
      )
      boatIdx++
    }
    // Eigene Kriegsschiffe — klickbar zum Zurückrufen.
    let warIdx = 0
    for (const ws of state.warships) {
      if (ws.ownerId !== human.id) continue
      const label = ws.returning
        ? t('hud.returning')
        : `${String(Math.max(0, Math.round(ws.hp)))} HP`
      rows.push(
        `<div data-recall-warship="${String(warIdx)}" data-tip="${t('hud.recallWarship')}" style="${rowStyle}"><span style="color:#9fb2c4;display:inline-flex">${icon.anchor}</span><span>${label}</span>${act('↩')}</div>`,
      )
      warIdx++
    }
    // Eingehende Angriffe: Name-Bereich = zum Angriff SPRINGEN (data-locate), Schild = ABWEHREN
    // (data-defend, eigene Truppen 1:1 gegen die Reserve; Tooltip zeigt die aktuelle Slider-Menge).
    let incoming = 0
    const defendTroops = Math.floor((human.troops * currentSliderPct) / 100)
    for (const p of state.players.values()) {
      if (p.id === human.id || !p.isAlive) continue
      for (const atk of p.attacks) {
        if (atk.targetPlayerId !== human.id) continue
        incoming++
        rows.push(
          `<div style="${rowStyle}">` +
            `<span data-locate="${String(atk.frontTile)}" data-tip="${t('hud.jumpToBattle')}" style="cursor:pointer;display:flex;align-items:center;gap:6px;flex:1;min-width:0">` +
            `<span style="color:#e84545;display:inline-flex;align-items:center;gap:1px">${icon.swords}←</span>` +
            `<span style="overflow:hidden;text-overflow:ellipsis">${escapeHtml(p.name)} · ${fmtCompact(atk.reserveTroops)} · ${dur(atk.startTick)}</span>` +
            `</span>` +
            `<span data-defend="${String(p.id)}" data-tip="${t('hud.defendWith', { troops: fmtCompact(defendTroops) })}" style="cursor:pointer;margin-left:8px;flex-shrink:0;font-size:15px;display:inline-flex">${icon.shield}</span>` +
            `</div>`,
        )
      }
    }
    // Gefahren-Vignette: pulst rot solange man angegriffen wird.
    if (incoming > 0) {
      dangerVignette.style.display = 'block'
      dangerVignette.style.animation = 'tl-danger-pulse 1.2s ease-in-out infinite'
    } else {
      dangerVignette.style.display = 'none'
      dangerVignette.style.animation = 'none'
    }
    if (rows.length === 0) {
      attackPanel.style.display = 'none'
      return
    }
    attackPanel.style.display = 'block'
    const html = `<div style="opacity:0.65;margin-bottom:2px">${t('hud.attacks')}</div>${rows.join('')}`
    if (html !== lastAttackHtml) {
      attackPanel.innerHTML = html
      lastAttackHtml = html
    }
  }

  /** Baut die Ranglisten-Zeilen (Top-5 oder alle), sortiert nach rankSort. */
  function updateRankList(): void {
    const totalTiles =
      state.passableLandCount > 0 ? state.passableLandCount : state.map.width * state.map.height
    // Wilde Nationen tauchen in der Rangliste nicht auf — sie können nicht gewinnen, das hält die
    // Liste auf die echten Konkurrenten fokussiert.
    const players = [...state.players.values()].filter(
      (p) => (p.isAlive || p.tilesOwned > 0) && !p.wild,
    )
    const valueOf = (p: Player): number => (rankSort === 'gold' ? p.gold : totalTroops(p))
    players.sort((a, b) => valueOf(b) - valueOf(a))
    const visible = rankExpanded ? players : players.slice(0, RANK_COLLAPSED)
    const human = findHuman()

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
      // Verräter (geächtet): für ALLE als Verräter markiert, solange die Ächtung läuft.
      const traitor = p.traitorUntil > state.tick
      // Verbündete: Name grün + Hover-Tooltip mit Allianz-Restzeit. Verrat hat Vorrang (rot).
      const allied = human !== undefined && !p.isHuman && areAllied(state.alliances, human.id, p.id)
      const nameColor = traitor ? 'color:#e8736b;' : allied ? 'color:#5adc78;' : ''
      let title = ''
      if (traitor) {
        const remain = Math.max(0, (p.traitorUntil - state.tick) / SIM_TICKS_PER_SECOND)
        title = ` title="${t('hud.traitorTitle', { time: fmtDuration(remain) })}"`
      } else if (allied) {
        const expiry = state.allianceExpiry.get(pairKey(human.id, p.id))
        const remain =
          expiry !== undefined ? Math.max(0, (expiry - state.tick) / SIM_TICKS_PER_SECOND) : 0
        title = ` title="${t('hud.alliedTitle', { time: fmtDuration(remain) })}"`
      }
      const tag = traitor ? `${icon.warning} ` : allied ? `${icon.alliance} ` : ''
      rows.push(
        `<div style="display:flex;align-items:center;gap:6px;padding:1px 4px;${bg}"${title}>` +
          `<span style="opacity:0.5;min-width:14px">${rank.toString()}</span>` +
          `<span style="color:${rgbaToCss(p.color)}">■</span>` +
          `<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${nameColor}">${tag}${escapeHtml(p.name)}${dead}</span>` +
          `<span style="opacity:0.55;font-size:10px">${pctTiles}</span>` +
          `<span style="min-width:88px;text-align:right;font-size:10px">${primary}</span>` +
          `</div>`,
      )
    }
    rankBody.innerHTML = rows.join('')
    const hidden = players.length - visible.length
    rankToggle.style.display = players.length > RANK_COLLAPSED ? 'block' : 'none'
    rankToggle.textContent = rankExpanded
      ? t('hud.less')
      : t('hud.showAll', { n: players.length, hidden: Math.max(0, hidden) })
  }

  function update(): void {
    const gameSeconds = state.tick / SIM_TICKS_PER_SECOND
    const speedLabel = currentSpeed === 0 ? t('hud.pause') : `${String(currentSpeed)}×`
    // „Phase" (running/ended) entfällt — „running" ist redundant, „ended" zeigt das Game-Over-Banner.
    infoLine.innerHTML = `${t('hud.time')} ${fmtDuration(gameSeconds)} · ${speedLabel}`

    updateRankList()
    updateActionBar()
    updateAttackPanel()

    // Eigener Ächtungs-Status: deutliche Warnung, solange DU geächtet bist.
    const me = findHuman()
    if (me !== undefined && me.traitorUntil > state.tick) {
      const remain = Math.max(0, (me.traitorUntil - state.tick) / SIM_TICKS_PER_SECOND)
      traitorBanner.innerHTML = `${icon.warning} ${escapeHtml(t('hud.traitorBanner', { time: fmtDuration(remain) }))}`
      traitorBanner.style.display = 'block'
    } else {
      traitorBanner.style.display = 'none'
    }

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
          `${t('hud.victory')}: <span style="color:${rgbaToCss(winner.color)}">${escapeHtml(winner.name)}</span>` +
          `</div>` +
          `<div style="font-size: 12px; opacity: 0.7; margin-bottom: 10px">${t('hud.matchDuration', { time: matchTime })}</div>` +
          `<table style="font-size: 12px; margin: 0 auto; border-collapse: collapse"><thead><tr style="opacity: 0.6"><th style="font-weight: normal; padding-right: 12px; text-align: left">${t('hud.colPlayer')}</th><th style="font-weight: normal; padding-right: 12px; text-align: right">${t('hud.colPeakPct')}</th><th style="font-weight: normal; text-align: right">${t('hud.colPeakTroops')}</th></tr></thead><tbody>${statsRows}</tbody></table>` +
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
    setSliderPct(pct: number): void {
      const v = Math.max(0, Math.min(100, Math.round(pct)))
      currentSliderPct = v
      slider.value = String(v)
      sliderLabel.textContent = t('hud.attack', { pct: v })
    },
    setBoatMode(on: boolean): void {
      boatHint.style.display = on ? 'block' : 'none'
      boatBtn.style.background = on ? 'rgba(70,217,230,0.85)' : 'rgba(255,255,255,0.06)'
      boatBtn.style.color = on ? '#06222a' : 'white'
      boatBtn.style.borderColor = on ? '#46d9e6' : 'rgba(255,255,255,0.15)'
    },
    setBomberMode(on: boolean, route: BomberRoute): void {
      bomberHint.style.display = on ? 'block' : 'none'
      bomberBtn.style.background = on ? 'rgba(232,136,74,0.85)' : 'rgba(255,255,255,0.06)'
      bomberBtn.style.color = on ? '#241200' : 'white'
      bomberBtn.style.borderColor = on ? '#e8884a' : 'rgba(255,255,255,0.15)'
      if (on) {
        const routeLabel = t(`route.${route}`)
        bomberHint.textContent = `${t('hud.bomberModeHint', { route: routeLabel })}`
      }
    },
    setWarshipMode(on: boolean): void {
      warshipHint.style.display = on ? 'block' : 'none'
      warshipBtn.style.background = on ? 'rgba(120,200,255,0.85)' : 'rgba(255,255,255,0.06)'
      warshipBtn.style.color = on ? '#04223a' : 'white'
      warshipBtn.style.borderColor = on ? '#78c8ff' : 'rgba(255,255,255,0.15)'
    },
    flashResync(): void {
      resyncTag.textContent = `⟳ ${t('hud.resync')}`
      resyncTag.style.display = 'block'
      resyncTag.style.opacity = '1'
      if (resyncTimer !== null) clearTimeout(resyncTimer)
      // 1,6 s sichtbar, dann ausblenden — nur „passiert gerade", kein Dauer-Status.
      resyncTimer = setTimeout(() => {
        resyncTag.style.opacity = '0'
        resyncTimer = setTimeout(() => {
          resyncTag.style.display = 'none'
        }, 300)
      }, 1600)
    },
    destroy(): void {
      if (resyncTimer !== null) clearTimeout(resyncTimer)
      infoBox.remove()
      traitorBanner.remove()
      resyncTag.remove()
      attackPanel.remove()
      rankPanel.remove()
      actionBar.remove()
      banner.remove()
      pauseOverlay.remove()
      dangerVignette.remove()
      dangerStyle.remove()
    },
  }
}
