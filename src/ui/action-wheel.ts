/**
 * Immer sichtbares Action-Rad für den Touch-/Mobile-Modus (ADR-Action-Rad). Sitzt fest unten
 * rechts und ist die primäre Steuerung ohne Tastatur/Rechtsklick: oberste Ebene **Bauen** /
 * **Schiffe**, ein Druck wechselt an Ort und Stelle in die Unterebene (Mitte = Zurück). Die Auswahl
 * schaltet den jeweiligen Modus im Input-Handler scharf — danach tippt/zieht man auf der Karte zum
 * Platzieren (der Bau-Modus bleibt aktiv → mehrere desselben Typs).
 *
 * Eigenständig (keine Tile-Kontext-Logik wie das Radial-Kontextmenü in build-menu.ts). Gleiche
 * Optik wie dort: nahtloses dunkles Zifferblatt, dünne Trenner, Icon + Wort, Akzentfarbe je Aktion.
 * SVG-Farben konkret (var(--tl-…) löst in style.fill nicht auf).
 */

import type { BuildingType } from '../core/buildings'
import { buildingIcon, icon } from './icons'
import { t } from '../i18n'

const SVG_NS = 'http://www.w3.org/2000/svg'
const BUILD_ACCENT = '#d9a441'
const SHIP_ACCENT = '#46d9e6'
const IDLE_FILL = 'rgba(22,18,14,0.94)'
const IDLE_STROKE = 'rgba(196,168,120,0.30)'

interface WheelAction {
  glyph: string
  label: string
  accent: string
  run: () => void
  /** Optionale Unterzeile (z.B. Baukosten „25k" im Bau-Rad). */
  sub?: string
  /** Farbe der Unterzeile (z.B. grün=bezahlbar / rot=zu teuer). */
  subColor?: string
}

export interface ActionWheelDeps {
  /** Erlaubte Gebäudetypen (matchweit gesetzt) — nur diese erscheinen unter „Bauen". */
  readonly allowedBuildings: readonly BuildingType[]
  /** Gebäude-Bau-Modus scharfschalten (wie HUD-Bau-Knopf / Hotkey). */
  readonly onBuild: (type: BuildingType) => void
  readonly onBoat: () => void
  readonly onBomber: () => void
  readonly onWarship: () => void
  /**
   * Live-Baukosten + Bezahlbarkeit je Gebäude — für die Preis-Anzeige im Bau-Rad. Optional
   * (ohne sie zeigt das Bau-Rad nur Name/Icon). Wird jedes Mal beim Öffnen des Bau-Rads abgefragt.
   */
  readonly buildInfo?: (type: BuildingType) => { cost: number; affordable: boolean }
}

/** Live-Werte fürs Cockpit (Mitte des Rads + Füll-Ring). */
export interface WheelStats {
  troops: number
  cap: number
  /** Truppen pro Sekunde (kann negativ sein, wenn über Cap). */
  rate: number
  gold: number
  /** 1-basierter Rang in der Rangliste. */
  rankPos: number
  /** Gebiets-Anteil in Prozent (0..100). */
  territoryPct: number
  /** Wird der Spieler gerade angegriffen? (Ring rot.) */
  underAttack: boolean
}

export interface ActionWheelApi {
  setVisible(on: boolean): void
  /** Live-Werte fürs Cockpit setzen (jeden Frame aus dem HUD-Update). */
  setStats(s: WheelStats): void
  /** Wurzel-Element (zum Registrieren als verschieb-/skalierbares HUD-Panel im Editor). */
  readonly element: HTMLElement
  destroy(): void
}

export function createActionWheel(container: HTMLElement, deps: ActionWheelDeps): ActionWheelApi {
  const rIn = 44
  const rOut = 104
  const pad = 4
  const size = 2 * (rOut + pad)
  const c = size / 2

  const panel = document.createElement('div')
  panel.style.cssText = [
    'position: absolute',
    'right: 14px',
    'bottom: 14px',
    `width: ${String(size)}px`,
    `height: ${String(size)}px`,
    'z-index: 18',
    'pointer-events: none',
    'display: none',
    'font-family: var(--tl-font)',
  ].join(';')
  container.appendChild(panel)

  // ── Cockpit: Live-Werte in der Mitte + Füll-Ring (Truppen/Cap) ──
  let stats: WheelStats | null = null
  let statsBox: HTMLElement | null = null // Mitten-Anzeige (nur oberste Ebene)
  let ring: SVGCircleElement | null = null // Truppen-Füll-Ring
  const rRing = rOut + 2
  const ringCirc = 2 * Math.PI * rRing

  const fmtK = (n: number): string => {
    const a = Math.abs(n)
    if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
    if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k'
    return String(Math.round(n))
  }

  /** Aktuelle Werte in Mitte + Ring schreiben (ohne Neuaufbau). */
  function applyStats(): void {
    if (stats === null) return
    if (statsBox !== null) {
      const rateColor = stats.rate > 0 ? '#5adc78' : stats.rate < 0 ? '#e8736b' : 'var(--tl-text)'
      const sign = stats.rate > 0 ? '+' : ''
      const pct =
        stats.territoryPct < 1 ? stats.territoryPct.toFixed(2) : stats.territoryPct.toFixed(0)
      statsBox.innerHTML =
        `<div style="font-size:16px;font-weight:700;line-height:1.05">${fmtK(stats.troops)}<span style="font-size:10px;font-weight:400;opacity:0.6"> / ${fmtK(stats.cap)}</span></div>` +
        `<div style="font-size:9.5px;line-height:1.1;color:${rateColor}">${sign}${fmtK(stats.rate)}/s</div>` +
        `<div style="font-size:9.5px;line-height:1.15;opacity:0.92;display:flex;align-items:center;gap:3px;justify-content:center;color:#e8c14a">${icon.gold} ${fmtK(stats.gold)}</div>` +
        `<div style="font-size:9px;line-height:1.1;opacity:0.6">#${String(stats.rankPos)} · ${pct}%</div>`
    }
    if (ring !== null) {
      const frac = stats.cap > 0 ? Math.max(0, Math.min(1, stats.troops / stats.cap)) : 0
      ring.style.strokeDashoffset = String(ringCirc * (1 - frac))
      ring.style.stroke = stats.underAttack ? '#e8736b' : frac >= 0.85 ? '#e8c14a' : '#5adc78'
    }
  }

  const polar = (rr: number, a: number): string =>
    `${(c + rr * Math.cos(a)).toFixed(2)} ${(c + rr * Math.sin(a)).toFixed(2)}`
  const sector = (rin: number, rout: number, a0: number, a1: number): string => {
    const large = a1 - a0 > Math.PI ? 1 : 0
    return (
      `M ${polar(rin, a0)} L ${polar(rout, a0)} ` +
      `A ${String(rout)} ${String(rout)} 0 ${String(large)} 1 ${polar(rout, a1)} ` +
      `L ${polar(rin, a1)} A ${String(rin)} ${String(rin)} 0 ${String(large)} 0 ${polar(rin, a0)} Z`
    )
  }

  /** Rendert eine Ring-Ebene. `onBack` gesetzt → Mitte ist Zurück-Knopf, sonst neutrales Label. */
  function render(actions: readonly WheelAction[], onBack: (() => void) | null): void {
    panel.textContent = ''
    const n = actions.length
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('width', String(size))
    svg.setAttribute('height', String(size))
    svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none'
    panel.appendChild(svg)

    // Refs zurücksetzen (panel.textContent='' hat das alte DOM entfernt).
    statsBox = null
    ring = null

    // Truppen-Füll-Ring außen (Hintergrund + Fortschritt), startet oben (-90°). Färbt sich rot,
    // wenn du angegriffen wirst (s. applyStats).
    const ringBg = document.createElementNS(SVG_NS, 'circle')
    ringBg.setAttribute('cx', String(c))
    ringBg.setAttribute('cy', String(c))
    ringBg.setAttribute('r', String(rRing))
    ringBg.style.fill = 'none'
    ringBg.style.stroke = 'rgba(255,255,255,0.10)'
    ringBg.style.strokeWidth = '3'
    svg.appendChild(ringBg)
    const ringFill = document.createElementNS(SVG_NS, 'circle')
    ringFill.setAttribute('cx', String(c))
    ringFill.setAttribute('cy', String(c))
    ringFill.setAttribute('r', String(rRing))
    ringFill.style.fill = 'none'
    ringFill.style.stroke = '#5adc78'
    ringFill.style.strokeWidth = '3'
    ringFill.style.strokeLinecap = 'round'
    ringFill.style.strokeDasharray = String(ringCirc)
    ringFill.style.strokeDashoffset = String(ringCirc)
    ringFill.style.transform = 'rotate(-90deg)'
    ringFill.style.transformOrigin = `${String(c)}px ${String(c)}px`
    ringFill.style.transition = 'stroke-dashoffset 0.3s, stroke 0.2s'
    svg.appendChild(ringFill)
    ring = ringFill

    actions.forEach((a, i) => {
      const mid = -Math.PI / 2 + (i / n) * Math.PI * 2
      const half = Math.PI / n
      const path = document.createElementNS(SVG_NS, 'path')
      path.setAttribute('d', sector(rIn, rOut, mid - half, mid + half))
      path.style.fill = IDLE_FILL
      path.style.stroke = IDLE_STROKE
      path.style.strokeWidth = '1'
      path.style.strokeLinejoin = 'round'
      path.style.pointerEvents = 'auto'
      path.style.cursor = 'pointer'
      path.style.transition = 'filter 0.1s, stroke 0.1s'
      const enter = (): void => {
        path.style.filter = 'brightness(1.35)'
        path.style.stroke = a.accent
        path.style.strokeWidth = '1.6'
      }
      const leave = (): void => {
        path.style.filter = 'none'
        path.style.stroke = IDLE_STROKE
        path.style.strokeWidth = '1'
      }
      path.addEventListener('mouseenter', enter)
      path.addEventListener('mouseleave', leave)
      path.addEventListener('click', (e) => {
        e.stopPropagation()
        leave()
        a.run()
      })
      svg.appendChild(path)

      const gr = (rIn + rOut) / 2
      const lbl = document.createElement('div')
      lbl.style.cssText = [
        'position: absolute',
        `left: ${(c + gr * Math.cos(mid)).toFixed(1)}px`,
        `top: ${(c + gr * Math.sin(mid)).toFixed(1)}px`,
        'transform: translate(-50%,-50%)',
        'pointer-events: none',
        'display: flex',
        'flex-direction: column',
        'align-items: center',
        'gap: 2px',
        'text-align: center',
      ].join(';')
      lbl.innerHTML =
        `<div style="font-size:21px;line-height:1;display:flex;align-items:center;justify-content:center;color:${a.accent}">${a.glyph}</div>` +
        `<div style="font-size:11px;font-weight:600;line-height:1.05;color:var(--tl-text)">${a.label}</div>` +
        (a.sub !== undefined
          ? `<div style="font-size:9.5px;font-weight:700;line-height:1;color:${a.subColor ?? 'var(--tl-text)'}">${a.sub}</div>`
          : '')
      panel.appendChild(lbl)
    })

    // Mitte: Zurück-Knopf (Untermenü) oder neutrales Label (oberste Ebene).
    const centerEl = document.createElement('div')
    centerEl.style.cssText = [
      'position: absolute',
      'left: 50%',
      'top: 50%',
      'transform: translate(-50%,-50%)',
      `width: ${String(rIn * 1.9)}px`,
      `height: ${String(rIn * 1.9)}px`,
      'border-radius: 50%',
      'box-sizing: border-box',
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'text-align: center',
      'background: var(--tl-panel-bg)',
      'border: 1px solid var(--tl-panel-border-color)',
      'box-shadow: inset 0 2px 8px rgba(0,0,0,0.5)',
      `pointer-events: ${onBack !== null ? 'auto' : 'none'}`,
      `cursor: ${onBack !== null ? 'pointer' : 'default'}`,
      'color: var(--tl-text)',
    ].join(';')
    if (onBack !== null) {
      centerEl.innerHTML =
        `<div style="font-size:22px;font-weight:bold;line-height:1;color:var(--tl-accent)">‹</div>` +
        `<div style="font-size:10px;opacity:0.7">${t('wheel.back')}</div>`
      centerEl.addEventListener('click', (e) => {
        e.stopPropagation()
        onBack()
      })
    } else {
      // Oberste Ebene = Cockpit-Mitte: Live-Werte (Truppen/Rate/Gold/Rang), befüllt von applyStats.
      const sb = document.createElement('div')
      sb.style.cssText =
        'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:2px'
      // Fallback, bis Live-Werte gesetzt sind (applyStats überschreibt das).
      sb.innerHTML = `<div style="font-size:10px;opacity:0.65">${t('wheel.title')}</div>`
      centerEl.appendChild(sb)
      statsBox = sb
    }
    panel.appendChild(centerEl)
    applyStats() // Ring + (ggf.) Mitte mit den aktuellen Werten füllen
  }

  function showTop(): void {
    render(
      [
        {
          glyph: buildingIcon('city', 24),
          label: t('wheel.build'),
          accent: BUILD_ACCENT,
          run: showBuild,
        },
        { glyph: icon.ship, label: t('wheel.ships'), accent: SHIP_ACCENT, run: showShips },
      ],
      null,
    )
  }

  function showBuild(): void {
    const actions: WheelAction[] = deps.allowedBuildings.map((type) => {
      const action: WheelAction = {
        glyph: buildingIcon(type, 22),
        label: t(`building.${type}`),
        accent: BUILD_ACCENT,
        run: () => {
          deps.onBuild(type)
          showTop()
        },
      }
      // Live-Preis als Unterzeile (grün=bezahlbar, rot=zu teuer) — sonst tappt man auf dem Handy blind.
      const info = deps.buildInfo?.(type)
      if (info !== undefined) {
        action.sub = fmtK(info.cost)
        action.subColor = info.affordable ? '#5dd75d' : '#ef5350'
      }
      return action
    })
    render(actions, showTop)
  }

  function showShips(): void {
    render(
      [
        {
          glyph: icon.ship,
          label: t('hud.boat'),
          accent: SHIP_ACCENT,
          run: () => {
            deps.onBoat()
            showTop()
          },
        },
        {
          glyph: icon.plane,
          label: t('hud.bomber'),
          accent: '#c89bff',
          run: () => {
            deps.onBomber()
            showTop()
          },
        },
        {
          glyph: icon.anchor,
          label: t('hud.warship'),
          accent: '#7fb2ff',
          run: () => {
            deps.onWarship()
            showTop()
          },
        },
      ],
      showTop,
    )
  }

  showTop()

  return {
    setVisible(on: boolean): void {
      panel.style.display = on ? 'block' : 'none'
      if (on) showTop() // beim Einblenden auf die oberste Ebene zurück
    },
    setStats(s: WheelStats): void {
      stats = s
      applyStats()
    },
    element: panel,
    destroy(): void {
      panel.remove()
    },
  }
}
