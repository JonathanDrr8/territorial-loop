/**
 * Globale UI-Größe fürs In-Game-HUD. Ein Slider (unten links) skaliert alle registrierten
 * HUD-Panels per CSS `zoom` — das hält die Anker (oben/unten/links/rechts) erhalten und macht
 * Schrift + Abstände proportional größer/kleiner. Persistiert in localStorage (reine Client-
 * Einstellung, kein Sim-Determinismus).
 *
 * Lebenszyklus: `registerScalable(el)` meldet ein Panel an (bekommt sofort die aktuelle Größe);
 * `clearScalables()` zu Match-Start leert die Registry (alte, zerstörte Panels fallen raus).
 */

import { t } from '../i18n'

// v2: neuer, größerer Default (1.3) — alte gespeicherte „1.0"-Werte sollen NICHT kleben bleiben.
const STORAGE_KEY = 'territorial-loop:ui-scale:v2'
export const UI_SCALE_MIN = 0.9
export const UI_SCALE_MAX = 2.2
/** Standard-Größe für neue Spieler (HUD ist sonst auf hochauflösenden Monitoren zu winzig). */
export const UI_SCALE_DEFAULT = 1.3

const elements = new Set<HTMLElement>()

function load(): number {
  try {
    const v = Number(window.localStorage.getItem(STORAGE_KEY))
    if (Number.isFinite(v) && v >= UI_SCALE_MIN && v <= UI_SCALE_MAX) return v
  } catch {
    /* ignore */
  }
  return UI_SCALE_DEFAULT
}

let scale = load()

export function getUiScale(): number {
  return scale
}

/** Panel anmelden — wird sofort auf die aktuelle Größe gesetzt und bei Änderungen mitskaliert. */
export function registerScalable(el: HTMLElement): void {
  elements.add(el)
  el.style.setProperty('zoom', String(scale))
}

/** Registry leeren (z.B. zu Match-Start, bevor neue Panels sich anmelden). */
export function clearScalables(): void {
  elements.clear()
}

export function setUiScale(value: number): void {
  scale = Math.max(UI_SCALE_MIN, Math.min(UI_SCALE_MAX, value))
  try {
    window.localStorage.setItem(STORAGE_KEY, String(scale))
  } catch {
    /* ignore */
  }
  for (const el of elements) el.style.setProperty('zoom', String(scale))
}

/** Kleiner Slider unten links (neben dem Feedback-Knopf), der die UI-Größe steuert. */
export function createUiScaleSlider(container: HTMLElement): { destroy(): void } {
  const wrap = document.createElement('div')
  wrap.style.cssText = [
    'position: absolute',
    'left: 10px',
    'bottom: 44px',
    'z-index: 45',
    'display: flex',
    'align-items: center',
    'gap: 7px',
    'background: rgba(20,20,28,0.8)',
    'border: 1px solid rgba(255,255,255,0.2)',
    'border-radius: 8px',
    'padding: 5px 9px',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 11px',
    'color: rgba(255,255,255,0.85)',
    'pointer-events: auto',
  ].join(';')

  const label = document.createElement('span')
  label.textContent = 'UI'
  label.style.opacity = '0.8'

  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = String(UI_SCALE_MIN)
  slider.max = String(UI_SCALE_MAX)
  slider.step = '0.05'
  slider.value = String(scale)
  slider.title = t('uiscale.title')
  slider.style.width = '92px'
  slider.style.accentColor = '#46d9e6'
  slider.style.cursor = 'pointer'

  const val = document.createElement('span')
  val.style.cssText = 'min-width: 34px; text-align: right; font-variant-numeric: tabular-nums'
  const pct = (s: number): string => `${String(Math.round(s * 100))}%`
  val.textContent = pct(scale)

  slider.addEventListener('input', () => {
    const s = Number(slider.value)
    setUiScale(s)
    val.textContent = pct(s)
  })

  wrap.appendChild(label)
  wrap.appendChild(slider)
  wrap.appendChild(val)
  container.appendChild(wrap)

  return {
    destroy(): void {
      wrap.remove()
    },
  }
}
