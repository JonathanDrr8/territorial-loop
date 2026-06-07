/**
 * Layout-Speicher fürs konfigurierbare HUD (ADR-0024, Phase 2). Jedes anpassbare HUD-Panel
 * registriert sich mit einer ID; der Speicher hält je Panel optionale Overrides
 * (`{x, y, s, w, h, hidden}`) in localStorage und wendet sie an. **Ohne Override bleibt das Panel
 * an seiner Standard-Stelle** (CSS-Anker im HUD) — Phase 2 ändert also nichts sichtbar, liefert
 * aber die Grundlage, auf der der In-Game-Editor (Phase 3) Panels verschiebt/skaliert/aus­blendet.
 *
 * Reine Client-Präferenz → kein Sim-Einfluss, kein State-Hash, multiplayer-sicher (wie das Theme).
 */

export interface PanelOverride {
  /** Linke Kante (px, absolut). Gesetzt → CSS-Anker rechts/unten wird gelöst. */
  x?: number
  /** Obere Kante (px, absolut). */
  y?: number
  /** Skalierung (transform). */
  s?: number
  /** Breite (px) — nur für Panels, die Breite respektieren. */
  w?: number
  /** Höhe (px). */
  h?: number
  /** Ausgeblendet. */
  hidden?: boolean
}

import { notifySettingsChanged } from './account-settings'

const KEY = 'territorial-loop:hud-layout:v1'

let layout: Record<string, PanelOverride> = load()
const panels = new Map<string, HTMLElement>()

function load(): Record<string, PanelOverride> {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw !== null) return JSON.parse(raw) as Record<string, PanelOverride>
  } catch {
    /* ignore */
  }
  return {}
}

function save(): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(layout))
  } catch {
    /* ignore */
  }
  notifySettingsChanged()
}

/** Mind. so viele Pixel eines Panels bleiben sichtbar — deckt sich mit dem Editor-Drag-Spielraum. */
/**
 * Hält ein absolut positioniertes Panel GANZ im Bild — das komplette Panel bleibt sichtbar, nichts
 * wandert über den Rand. Nötig, weil gespeicherte Pixel-Positionen nach Resize/Drehen (oder auf
 * kleinerem Gerät) sonst teilweise/ganz aus dem Bild fallen.
 *
 * Korrigiert über das TATSÄCHLICH gerenderte Rect (inkl. Skalierung UND `transform`, z.B. das
 * mittig per `translateX(-50%)` verankerte Aktions-Panel): der Überstand wird als Delta auf
 * `left`/`top` zurückgerechnet. Panels, die größer als der Viewport sind, werden oben/links bündig
 * gesetzt (sie decken ihn ab, kein großer Rand).
 */
function clampToViewport(el: HTMLElement): void {
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return // noch nicht gerendert/gemessen
  const vw = window.innerWidth
  const vh = window.innerHeight
  let dx = 0
  if (rect.right > vw) dx = vw - rect.right // zu weit rechts → nach links schieben
  if (rect.left + dx < 0) dx = -rect.left // zu weit links / größer als Viewport → linke Kante auf 0
  let dy = 0
  if (rect.bottom > vh) dy = vh - rect.bottom
  if (rect.top + dy < 0) dy = -rect.top
  if (dx !== 0) {
    const left = parseFloat(el.style.left)
    if (!Number.isNaN(left)) el.style.left = `${Math.round(left + dx).toString()}px`
  }
  if (dy !== 0) {
    const top = parseFloat(el.style.top)
    if (!Number.isNaN(top)) el.style.top = `${Math.round(top + dy).toString()}px`
  }
}

/**
 * Re-Clamp, sobald sich die GRÖSSE eines Panels ändert (Schrift-/Content-/Skalierungs-Settle nach
 * dem ersten Anwenden, oder wachsende Panels wie der Feed). Klemmt nur die Position → ändert nie die
 * Größe → keine Endlosschleife. `null`, wo es kein ResizeObserver gibt (z.B. jsdom in Tests) — dann
 * reichen Sofort-Clamp + Fenster-Resize.
 */
const panelResizeObserver: ResizeObserver | null = (() => {
  try {
    return new ResizeObserver((entries) => {
      for (const e of entries) clampToViewport(e.target as HTMLElement)
    })
  } catch {
    return null
  }
})()

/** Alle angemeldeten Panels neu in den sichtbaren Bereich klemmen (Fenster-Resize/Drehung). */
function clampAll(): void {
  for (const el of panels.values()) clampToViewport(el)
}

let resizeArmed = false
function armResizeClamp(): void {
  if (resizeArmed) return
  resizeArmed = true
  try {
    window.addEventListener('resize', clampAll)
  } catch {
    /* kein window (Tests ohne DOM) */
  }
}

/** Wendet den (evtl. vorhandenen) Override eines Panels auf sein DOM-Element an. */
function apply(id: string): void {
  const el = panels.get(id)
  if (el === undefined) return
  const o = layout[id]
  if (o === undefined) return
  // Sobald ein Override greift, übernimmt der Layout-Speicher die Skalierung per `transform`.
  // Das per `registerScalable` gesetzte `zoom: 1.3` muss raus, sonst skaliert es doppelt.
  el.style.zoom = '1'
  if (o.x !== undefined) {
    el.style.left = `${o.x.toString()}px`
    el.style.right = 'auto'
  }
  if (o.y !== undefined) {
    el.style.top = `${o.y.toString()}px`
    el.style.bottom = 'auto'
  }
  if (o.s !== undefined) {
    el.style.transformOrigin = 'top left'
    el.style.transform = `scale(${o.s.toString()})`
  }
  if (o.w !== undefined) {
    el.style.width = `${o.w.toString()}px`
    // Hartkodierte max-width mancher Panels (z. B. Angriffs-Panel: 240px) nicht den Override
    // deckeln lassen — sonst lässt sich das Panel gar nicht breiter ziehen.
    el.style.maxWidth = `${o.w.toString()}px`
  }
  if (o.h !== undefined) {
    el.style.height = `${o.h.toString()}px`
    // Hartkodierte max-height mancher Panels (z. B. die Feed-Spalte: 300px) nicht den Override
    // deckeln lassen — sonst lässt sich das Panel gar nicht höher ziehen.
    el.style.maxHeight = `${o.h.toString()}px`
  }
  if (o.hidden === true) el.style.display = 'none'
  // Nach dem Anwenden einer absoluten Position sicherstellen, dass das Panel im Bild bleibt.
  if (o.x !== undefined || o.y !== undefined) clampToViewport(el)
}

/** Panel anmelden — bekommt sofort seinen gespeicherten Override (falls vorhanden). */
export function registerPanel(id: string, el: HTMLElement): void {
  panels.set(id, el)
  apply(id)
  armResizeClamp()
  panelResizeObserver?.observe(el) // bei Größen-Settle/-Wachstum nachklemmen
}

/** Panel abmelden (z. B. zu Match-Ende). */
export function unregisterPanel(id: string): void {
  const el = panels.get(id)
  if (el !== undefined) panelResizeObserver?.unobserve(el)
  panels.delete(id)
}

/** Override eines Panels setzen/aktualisieren (mergt) + persistieren + anwenden. */
export function setPanel(id: string, patch: PanelOverride): void {
  layout[id] = { ...layout[id], ...patch }
  save()
  apply(id)
}

/** Aktueller Override eines Panels (oder `undefined`). */
export function getPanel(id: string): PanelOverride | undefined {
  return layout[id]
}

/** Tiefe Kopie aller aktuellen Panel-Overrides — für speicherbare Layout-Presets (ADR-0028). */
export function getLayoutSnapshot(): Record<string, PanelOverride> {
  return JSON.parse(JSON.stringify(layout)) as Record<string, PanelOverride>
}

/** IDs aller aktuell angemeldeten Panels. */
export function registeredIds(): string[] {
  return [...panels.keys()]
}

/** [id, element] aller angemeldeten Panels — für den Editor (Phase 3). */
export function panelElements(): Array<[string, HTMLElement]> {
  return [...panels.entries()]
}

/** Hat der Spieler (oder ein Default) bereits irgendein Layout-Override? */
export function hasAnyLayout(): boolean {
  return Object.keys(layout).length > 0
}

// ── Eingebautes Mobile-Standard-Layout (Jonathans Cockpit-Anordnung) ──────────────────────────
// Greift EINMALIG für frische Mobile-Spieler ohne eigenes Layout. Positionen sind absolut für die
// Referenz-Bildschirmgröße und werden beim Anwenden proportional auf die echte Größe umgerechnet
// (x × Breite/refW, y × Höhe/refH) — so sitzt es auf jedem Handy ähnlich, nicht nur auf 390×797.
// Größe/Scale (s, h, w) bleiben unverändert. Reine Client-Voreinstellung, MP-sicher.
const MOBILE_DEFAULT_FLAG = 'territorial-loop:mobile-default-applied:v1'
const PORTRAIT_REF = { w: 390, h: 797 } as const
const LANDSCAPE_REF = { w: 844, h: 390 } as const
/** Hochformat-Cockpit (Rad unten Mitte, groß). */
const MOBILE_PORTRAIT_PANELS: Record<string, PanelOverride> = {
  feedback: { x: 0, y: 0 },
  attacks: { x: 6, y: 649, h: 127, s: 0.96, hidden: false },
  wheel: { x: 173, y: 561, s: 1.05 },
  topbar: { x: 128, y: 0, s: 1.02 },
  attackbar: { x: 325, y: 191 },
}
/** Querformat-Cockpit (breit-kurz): Rad kleiner in die untere rechte Ecke, Slider rechts darüber,
 *  Top-Leiste oben Mitte, Angriffe + Feedback links. Ref 844×390. */
const MOBILE_LANDSCAPE_PANELS: Record<string, PanelOverride> = {
  feedback: { x: 0, y: 0 },
  topbar: { x: 300, y: 0, s: 1.0 },
  // Angriffe oben rechts (über dem Rad), Slider links (linker Daumen), Rad unten rechts (rechter
  // Daumen) — zweihändiges Querformat, Mitte bleibt frei für die Karte.
  attacks: { x: 600, y: 4, h: 110, s: 0.85, hidden: false },
  attackbar: { x: 12, y: 64 },
  wheel: { x: 600, y: 175, s: 0.7 },
}

// Modul-State: welche Default-Variante zuletzt automatisch gesetzt wurde + ihr JSON. So erkennen
// wir beim Drehen, ob der Spieler das Auto-Layout seither selbst verändert hat (→ dann NICHT mehr
// automatisch wechseln, sein Layout bleibt). Reset bei Reload (dann respektieren wir das Gespeicherte).
let lastAutoKind: 'portrait' | 'landscape' | null = null
let lastAutoJson = ''

/**
 * Eingebautes Mobile-Standard-Layout anwenden — orientierungs-bewusst (eigene Anordnung für Hoch-
 * und Querformat), proportional zur Bildschirmgröße. Für frische Mobile-Spieler; beim Drehen wird
 * die passende Variante neu gesetzt, SOLANGE der Spieler das Auto-Layout nicht selbst verändert hat.
 * Ein vorhandenes eigenes/gespeichertes Layout wird nie überschrieben.
 */
export function applyMobileDefaultLayout(screenW: number, screenH: number): void {
  const kind: 'portrait' | 'landscape' = screenW >= screenH ? 'landscape' : 'portrait'
  let flagSet = false
  try {
    flagSet = window.localStorage.getItem(MOBILE_DEFAULT_FLAG) !== null
  } catch {
    /* ignore */
  }
  if (flagSet) {
    // Schon mal angewendet. Neu setzen nur bei Orientierungswechsel UND wenn das aktuelle Layout
    // noch exakt das zuletzt automatisch gesetzte ist (Spieler hat nichts angefasst).
    if (kind === lastAutoKind) return
    if (lastAutoKind === null || JSON.stringify(layout) !== lastAutoJson) return
  } else if (hasAnyLayout()) {
    // Bestandsspieler mit eigenem Layout → nicht anfassen, nur Flag setzen.
    try {
      window.localStorage.setItem(MOBILE_DEFAULT_FLAG, '1')
    } catch {
      /* ignore */
    }
    return
  }
  const panels = kind === 'landscape' ? MOBILE_LANDSCAPE_PANELS : MOBILE_PORTRAIT_PANELS
  const ref = kind === 'landscape' ? LANDSCAPE_REF : PORTRAIT_REF
  const fx = screenW > 0 ? screenW / ref.w : 1
  const fy = screenH > 0 ? screenH / ref.h : 1
  resetLayout()
  for (const [id, ov] of Object.entries(panels)) {
    const scaled: PanelOverride = { ...ov }
    if (ov.x !== undefined) scaled.x = Math.round(ov.x * fx)
    if (ov.y !== undefined) scaled.y = Math.round(ov.y * fy)
    setPanel(id, scaled)
  }
  lastAutoKind = kind
  lastAutoJson = JSON.stringify(layout)
  try {
    window.localStorage.setItem(MOBILE_DEFAULT_FLAG, '1')
  } catch {
    /* ignore */
  }
}

/** Alle Overrides löschen (zurück auf Standard-Anordnung). Setzt betroffene Inline-Styles zurück. */
export function resetLayout(): void {
  const ids = Object.keys(layout)
  layout = {}
  save()
  for (const id of ids) {
    const el = panels.get(id)
    if (el === undefined) continue
    el.style.removeProperty('left')
    el.style.removeProperty('top')
    el.style.removeProperty('right')
    el.style.removeProperty('bottom')
    el.style.removeProperty('transform')
    el.style.removeProperty('transform-origin')
    el.style.removeProperty('zoom')
    el.style.removeProperty('width')
    el.style.removeProperty('height')
    el.style.removeProperty('max-width')
    el.style.removeProperty('max-height')
    el.style.removeProperty('display')
  }
}
