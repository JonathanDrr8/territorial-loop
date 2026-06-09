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
// Untergrenze 0.7 (vorher 0.9 → 0.8 → 0.7): auf schmalen Fenstern (z.B. getiltes Drittel-/Viertel-
// Fenster) skaliert das HUD weiter runter, damit die unteren Panels (Ressourcen links /
// Aktionsleiste Mitte) auch bei ~820–940px Breite nicht mehr überlappen. 0.7 ist noch lesbar.
export const UI_SCALE_MIN = 0.7
export const UI_SCALE_MAX = 2.2
/** Standard-Größe für neue Spieler (HUD ist sonst auf hochauflösenden Monitoren zu winzig). */
export const UI_SCALE_DEFAULT = 1.3

const elements = new Set<HTMLElement>()
/** App-lebenslange Elemente (z.B. Feedback-Knopf) — überleben `clearScalables()` zu Match-Start. */
const persistent = new Set<HTMLElement>()

/**
 * Effektive Fensterbreite eines 1920×1080-Fensters → bekommt den bewährten Default 1.3. Das HUD ist
 * breiten-limitiert (Bau-Reihe + Rangliste), daher messen wir an `min(Breite, Höhe×1.7)`.
 */
const AUTO_REF_EFF = 1836

/**
 * Automatischer UI-Maßstab aus der Fenstergröße (CSS-Pixel berücksichtigen DPI bereits): kleines
 * Fenster/Laptop → kleineres HUD, großer Monitor → größeres → passt sich „von selbst" an jedes
 * System an. 1920×1080 ≈ Default 1.3 (kein Bruch für bestehende 1080p-Nutzer); auf [MIN, MAX]
 * geklemmt. Wird vom manuellen Slider überschrieben.
 */
function computeAutoScale(): number {
  try {
    const w = window.innerWidth
    const h = window.innerHeight
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return UI_SCALE_DEFAULT
    const eff = Math.min(w, h * 1.7)
    const raw = Math.round((UI_SCALE_DEFAULT * (eff / AUTO_REF_EFF)) / 0.05) * 0.05
    return Math.max(UI_SCALE_MIN, Math.min(UI_SCALE_MAX, raw))
  } catch {
    return UI_SCALE_DEFAULT
  }
}

/** Geladener Maßstab + ob er automatisch (kein gespeicherter manueller Override) bestimmt wurde. */
function load(): { value: number; auto: boolean } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw !== null) {
      const v = Number(raw)
      if (Number.isFinite(v) && v >= UI_SCALE_MIN && v <= UI_SCALE_MAX)
        return { value: v, auto: false }
    }
  } catch {
    /* ignore */
  }
  return { value: computeAutoScale(), auto: true }
}

const loaded = load()
let scale = loaded.value
/** Solange true: der Maßstab folgt automatisch der Fenstergröße (kein manueller Slider-Override). */
let isAuto = loaded.auto

export function getUiScale(): number {
  return scale
}

/**
 * Bei Fenster-Resize aufrufen: passt den Maßstab automatisch an die neue Größe an — ABER nur, wenn
 * der Nutzer ihn nicht manuell per Slider gesetzt hat. Wendet die neue Größe sofort auf alle Panels an.
 */
export function refreshAutoScale(): void {
  if (!isAuto) return
  const next = computeAutoScale()
  if (next === scale) return
  scale = next
  for (const el of elements) el.style.setProperty('zoom', String(scale))
}

/**
 * Panel anmelden — wird sofort auf die aktuelle Größe gesetzt und bei Änderungen mitskaliert.
 * `keepAcrossMatches: true` für app-lebenslange Elemente (z.B. Feedback-Knopf): die überleben
 * `clearScalables()` zu Match-Start und skalieren dauerhaft mit.
 */
export function registerScalable(el: HTMLElement, keepAcrossMatches = false): void {
  elements.add(el)
  if (keepAcrossMatches) persistent.add(el)
  el.style.setProperty('zoom', String(scale))
}

/** Registry leeren (z.B. zu Match-Start, bevor neue Panels sich anmelden). */
export function clearScalables(): void {
  elements.clear()
  for (const el of persistent) elements.add(el)
}

/**
 * Panel abmelden — wird nicht mehr mitskaliert. Nötig, wenn ein skaliertes Panel als Kind
 * in ein anderes (ebenfalls skaliertes) Panel wandert: sonst multipliziert sich das `zoom`.
 * Der Aufrufer setzt das `zoom` des Elements danach selbst (i.d.R. auf `1`).
 */
export function unregisterScalable(el: HTMLElement): void {
  elements.delete(el)
}

export function setUiScale(value: number): void {
  scale = Math.max(UI_SCALE_MIN, Math.min(UI_SCALE_MAX, value))
  isAuto = false // manueller Override → Automatik aus (folgt nicht mehr der Fenstergröße)
  try {
    window.localStorage.setItem(STORAGE_KEY, String(scale))
  } catch {
    /* ignore */
  }
  for (const el of elements) el.style.setProperty('zoom', String(scale))
}

/** Kleiner Slider oben links (neben dem Feedback-Knopf), der die UI-Größe steuert. */
export function createUiScaleSlider(container: HTMLElement): { destroy(): void } {
  const wrap = document.createElement('div')
  wrap.style.cssText = [
    'position: absolute',
    // Chrome-Zeile oben links (zusammen mit dem Feedback-Knopf rechts daneben), damit die
    // untere linke Ecke ganz dem Ressourcen-Block gehört.
    'left: 12px',
    'top: 12px',
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
