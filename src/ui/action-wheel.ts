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
}

export interface ActionWheelDeps {
  /** Erlaubte Gebäudetypen (matchweit gesetzt) — nur diese erscheinen unter „Bauen". */
  readonly allowedBuildings: readonly BuildingType[]
  /** Gebäude-Bau-Modus scharfschalten (wie HUD-Bau-Knopf / Hotkey). */
  readonly onBuild: (type: BuildingType) => void
  readonly onBoat: () => void
  readonly onBomber: () => void
  readonly onWarship: () => void
}

export interface ActionWheelApi {
  setVisible(on: boolean): void
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
        `<div style="font-size:11px;font-weight:600;line-height:1.05;color:var(--tl-text)">${a.label}</div>`
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
      centerEl.innerHTML = `<div style="font-size:10px;opacity:0.65">${t('wheel.title')}</div>`
    }
    panel.appendChild(centerEl)
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
    const actions: WheelAction[] = deps.allowedBuildings.map((type) => ({
      glyph: buildingIcon(type, 22),
      label: t(`building.${type}`),
      accent: BUILD_ACCENT,
      run: () => {
        deps.onBuild(type)
        showTop()
      },
    }))
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
    destroy(): void {
      panel.remove()
    },
  }
}
