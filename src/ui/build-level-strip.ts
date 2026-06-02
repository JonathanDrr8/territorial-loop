/**
 * Stufen-Leiste für den Level-Direktbau: im Bau-Modus wählt man hier, auf welchem Level (I/II/III)
 * das nächste Gebäude DIREKT errichtet wird — für mehr Gold (Baukosten + alle Upgrades bis dahin,
 * siehe `buildCostAtLevel`). Wird sowohl ins Desktop-HUD als auch neben das Mobile-Bau-Rad gehängt.
 *
 * Reine Anzeige: die Pro-Level-Kosten kommen über einen `costFor`-Callback (entkoppelt vom
 * Game-State), die Auswahl meldet `onPick(level)`. Das zuletzt gewählte Level wird vom Input-Handler
 * als Präferenz gemerkt; der Besitzer ruft `setActiveLevel` auf, damit die Leiste es vorgewählt zeigt.
 */

import type { BuildingType } from '../core/buildings'
import { t } from '../i18n'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V']
const ACTIVE_BG = 'rgba(232,193,74,0.85)'
const IDLE_BG = 'rgba(255,255,255,0.06)'
const ACTIVE_BORDER = '#e8c14a'
const IDLE_BORDER = 'rgba(255,255,255,0.15)'

/** Kompaktes k/M-Format für die Kosten-Unterzeile. */
function fmtK(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k'
  return String(Math.round(n))
}

export interface BuildLevelStrip {
  readonly element: HTMLElement
  /** Leiste für `type` einblenden (Kosten beziehen sich danach auf diesen Gebäudetyp). */
  show(type: BuildingType): void
  /** Leiste ausblenden (kein Bau-Modus). */
  hide(): void
  /** Aktives (gemerktes) Level hervorheben. */
  setActiveLevel(level: number): void
  /** Kosten/Bezahlbarkeit je Level neu berechnen (jeden Frame vom Besitzer aufgerufen). */
  refresh(
    costFor: (type: BuildingType, level: number) => { cost: number; affordable: boolean },
  ): void
}

export function createBuildLevelStrip(opts: {
  onPick: (level: number) => void
  levelCount: number
}): BuildLevelStrip {
  let currentType: BuildingType | null = null
  let activeLevel = 1
  const buttons: HTMLButtonElement[] = []
  const costEls: HTMLSpanElement[] = []

  const wrap = document.createElement('div')
  // Sichtbarkeit über display; Positionierung/Hintergrund setzt der Besitzer (HUD inline, Rad absolut).
  wrap.style.display = 'none'
  wrap.style.alignItems = 'stretch'
  wrap.style.gap = '4px'

  const label = document.createElement('span')
  label.textContent = t('hud.buildLevel')
  label.style.cssText = 'align-self: center; font-size: 10px; opacity: 0.6; margin-right: 2px'
  wrap.appendChild(label)

  for (let lvl = 1; lvl <= opts.levelCount; lvl++) {
    const btn = document.createElement('button')
    btn.style.cssText = [
      'flex: 1',
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'gap: 1px',
      'padding: 3px 8px',
      'border-radius: 6px',
      'cursor: pointer',
      'font: inherit',
      'font-size: 10px',
      `background: ${IDLE_BG}`,
      `border: 1px solid ${IDLE_BORDER}`,
      'color: white',
    ].join(';')
    const num = document.createElement('span')
    num.textContent = ROMAN[lvl] ?? String(lvl)
    num.style.cssText = 'font-weight: bold; font-size: 12px'
    const cost = document.createElement('span')
    cost.style.cssText = 'font-size: 9px; color: #5dd75d'
    btn.append(num, cost)
    btn.addEventListener('click', () => {
      opts.onPick(lvl)
    })
    wrap.appendChild(btn)
    buttons.push(btn)
    costEls.push(cost)
  }

  function highlight(): void {
    buttons.forEach((b, i) => {
      const active = i + 1 === activeLevel
      b.style.background = active ? ACTIVE_BG : IDLE_BG
      b.style.color = active ? '#1a1a1a' : 'white'
      b.style.borderColor = active ? ACTIVE_BORDER : IDLE_BORDER
    })
  }

  return {
    element: wrap,
    show(type) {
      currentType = type
      wrap.style.display = 'flex'
      highlight()
    },
    hide() {
      currentType = null
      wrap.style.display = 'none'
    },
    setActiveLevel(level) {
      activeLevel = Math.max(1, Math.min(opts.levelCount, Math.round(level)))
      highlight()
    },
    refresh(costFor) {
      const type = currentType
      if (type === null) return
      buttons.forEach((b, i) => {
        const lvl = i + 1
        const info = costFor(type, lvl)
        const el = costEls[i]
        if (el !== undefined) {
          el.textContent = fmtK(info.cost)
          // Aktives Level: dunkle Schrift auf dem Akzent; sonst grün/rot je Bezahlbarkeit.
          el.style.color = lvl === activeLevel ? '#1a1a1a' : info.affordable ? '#5dd75d' : '#ef5350'
        }
        b.style.opacity = info.affordable ? '1' : '0.5'
      })
      highlight()
    },
  }
}
