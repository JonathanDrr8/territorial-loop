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
import { registerScalable, unregisterScalable } from './ui-scale'

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
/**
 * Vor dem ERSTEN Klemmen gesicherte Anker-Styles eines Panels. Jeder Clamp-Durchlauf stellt sie
 * zuerst wieder her und misst dann neu: passt das Panel wieder an seinen ursprünglichen Anker
 * (rechts-/unten-verankert, `left: 50%`-Zentrierung), kehrt es dorthin ZURÜCK — ein einmaliger
 * Überlauf konvertiert es nicht mehr dauerhaft in eine absolute Position (Audit-Fund E3).
 */
const savedAnchors = new WeakMap<
  HTMLElement,
  { left: string; right: string; top: string; bottom: string; transform: string }
>()

/**
 * Gesicherten Clamp-Anker eines Panels verwerfen — für Aufrufer, die ein Panel direkt per
 * Style-Writes in absolute Koordinaten überführen (z.B. der HUD-Editor beim Öffnen/`arm()`).
 * Ohne das würde der ResizeObserver-Clamp den alten Anker über die frischen Styles restaurieren.
 */
export function invalidateClampAnchor(el: HTMLElement): void {
  savedAnchors.delete(el)
}

function clampToViewport(el: HTMLElement): void {
  // Gesicherten Original-Anker zuerst wiederherstellen — gemessen wird gegen den Anker, nicht
  // gegen die zuletzt geklemmte Absolut-Position.
  const saved = savedAnchors.get(el)
  if (saved !== undefined) {
    el.style.left = saved.left
    el.style.right = saved.right
    el.style.top = saved.top
    el.style.bottom = saved.bottom
    el.style.transform = saved.transform
  }
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
  if (dx === 0 && dy === 0) {
    savedAnchors.delete(el) // passt (wieder) — der Original-Anker gilt
    return
  }
  // Erstes Klemmen: Anker sichern, damit spätere Durchläufe ihn wiederherstellen können.
  if (saved === undefined) {
    savedAnchors.set(el, {
      left: el.style.left,
      right: el.style.right,
      top: el.style.top,
      bottom: el.style.bottom,
      transform: el.style.transform,
    })
  }
  // `dx`/`dy` sind in Screen-Pixeln (aus getBoundingClientRect). Viele Panels haben aber `zoom`
  // (ui-scale) → die CSS-Position `left/top` ist um den Zoom-Faktor kleiner als die Screen-Position.
  // Beim Anwenden also durch den Zoom teilen, sonst wird nur teilweise reingeschoben (Off-Screen-Bug).
  const z = parseFloat(getComputedStyle(el).zoom) || 1
  // Prozent-Positionen (z.B. `left: 50%` der zentrierten Aktionsleiste) NICHT per parseFloat lesen —
  // das ergäbe „50 Pixel" (Audit-Fund: Panel verlor seine Mitte). Sie zählen wie „keine px-Position"
  // → Basis kommt aus dem gemessenen Rect.
  const pxOf = (v: string): number => (v.endsWith('%') ? NaN : parseFloat(v))
  const curL = pxOf(el.style.left)
  const curT = pxOf(el.style.top)
  // Kommt die Basis aus dem Rect, steckt ein evtl. Translate-Anteil (translateX(-50%)-Zentrierung)
  // bereits in der Messung — er muss raus, sonst verschöbe er die neue absolute Position ERNEUT.
  // Scale-Overrides (transform: scale) bleiben unangetastet (ändern die Position bei origin
  // top-left nicht).
  if (
    ((dx !== 0 && Number.isNaN(curL)) || (dy !== 0 && Number.isNaN(curT))) &&
    el.style.transform.includes('translate')
  ) {
    el.style.transform = 'none'
  }
  // Inline-Position aus dem GEMESSENEN Rect ableiten (÷ Zoom), nicht aus `el.style.left`: so greift
  // der Clamp auch für CSS-/rechts-/unten-verankerte Panels (dort ist `el.style.left` leer → früher
  // NaN-Guard → Panel blieb draußen). `right`/`bottom` auf auto, damit die neue Inline-Position wirkt.
  if (dx !== 0) {
    const base = Number.isNaN(curL) ? rect.left / z : curL
    el.style.left = `${Math.round(base + dx / z).toString()}px`
    el.style.right = 'auto'
  }
  if (dy !== 0) {
    const base = Number.isNaN(curT) ? rect.top / z : curT
    el.style.top = `${Math.round(base + dy / z).toString()}px`
    el.style.bottom = 'auto'
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

/** Hat der Override Geometrie (Position/Scale/Größe) — also übernimmt das Layout die Skalierung? */
function hasGeometry(o: PanelOverride): boolean {
  return (
    o.x !== undefined ||
    o.y !== undefined ||
    o.s !== undefined ||
    o.w !== undefined ||
    o.h !== undefined
  )
}

/** Wendet den (evtl. vorhandenen) Override eines Panels auf sein DOM-Element an. */
function apply(id: string): void {
  const el = panels.get(id)
  if (el === undefined) return
  const o = layout[id]
  if (o === undefined) return
  if (hasGeometry(o)) {
    // Sobald ein Geometrie-Override greift, übernimmt der Layout-Speicher die Skalierung per
    // `transform`. Das per `registerScalable` gesetzte `zoom: 1.3` muss raus, sonst skaliert es
    // doppelt — und das Panel muss aus der ui-scale-Registry, sonst schreibt `refreshAutoScale`
    // beim nächsten Fenster-Resize das `zoom` zurück (Doppel-Skalierung + Positions-Versatz,
    // der „UI verschiebt sich"-Bug). `resetLayout` registriert es wieder.
    unregisterScalable(el)
    el.style.zoom = '1'
    // Der Override ist die neue Positions-Wahrheit — ein evtl. vor dem Override gesicherter
    // CSS-Anker (Clamp-Wiederherstellung) ist damit hinfällig.
    savedAnchors.delete(el)
  }
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

/**
 * Globaler Unterkanten-Versatz (px, Screen) für unten-verankerte Panels — z.B. wenn die
 * RTS-Kommandoleiste den unteren Rand belegt. Wirkt auf alle aktuell registrierten Panels mit
 * Inline-`bottom: Xpx` UND auf spätere Registrierungen (Minimap entsteht nach dem HUD).
 * Zoom-bewusst (CSS-bottom ist in gezoomten Einheiten). `setBottomInset(0)` stellt alles zurück.
 */
let bottomInset = 0
const insetApplied = new Map<HTMLElement, string>()

function applyBottomInset(el: HTMLElement): void {
  if (bottomInset <= 0 || insetApplied.has(el)) return
  const b = el.style.bottom
  if (!b.endsWith('px')) return // nur unten-verankerte Panels; top-/Override-Panels unberührt
  const z = parseFloat(getComputedStyle(el).zoom) || 1
  insetApplied.set(el, b)
  el.style.bottom = `${String(Math.round(parseFloat(b) + bottomInset / z))}px`
}

export function setBottomInset(px: number): void {
  if (px === bottomInset) return
  for (const [el, orig] of insetApplied) el.style.bottom = orig
  insetApplied.clear()
  bottomInset = px
  if (px > 0) for (const el of panels.values()) applyBottomInset(el)
}

/**
 * Unverschobener `bottom`-Wert eines aktuell vom Inset verschobenen Panels (sonst `null`).
 * Der HUD-Editor erfasst damit beim Armieren den kanonischen Zustand — sein Vor-Arm-Snapshot
 * darf den temporären Leisten-Versatz nicht enthalten (sonst restauriert er ihn später als Anker).
 */
export function insetOriginalBottom(el: HTMLElement): string | null {
  return insetApplied.get(el) ?? null
}

/**
 * Externe Style-Resets einsammeln: Code außerhalb des Layout-Systems schreibt `bottom` teils hart
 * neu (z. B. `applyMobileLayout` beim Moduswechsel: Minimap `12px`, Feed `224px`) und wischt damit
 * einen aktiven Inset weg. Hier nach solchen Resets aufrufen — Panels, deren `bottom` wieder auf
 * dem Original-Wert steht (oder die neu unten-verankert sind), bekommen den Inset erneut.
 */
export function refreshBottomInset(): void {
  if (bottomInset <= 0) return
  for (const el of panels.values()) {
    const orig = insetApplied.get(el)
    if (orig !== undefined) {
      // Steht `bottom` wieder auf dem Wert von vor dem Inset, wurde es extern zurückgesetzt.
      // (Einen extern bewusst ANDERS gesetzten Wert nicht anfassen.)
      if (el.style.bottom === orig) {
        insetApplied.delete(el)
        applyBottomInset(el)
      }
    } else {
      applyBottomInset(el)
    }
  }
}

/** Panel anmelden — bekommt sofort seinen gespeicherten Override (falls vorhanden). */
export function registerPanel(id: string, el: HTMLElement): void {
  panels.set(id, el)
  apply(id)
  applyBottomInset(el) // Spät-Registrierer (z.B. Minimap) respektieren einen aktiven Inset
  armResizeClamp()
  panelResizeObserver?.observe(el) // bei Größen-Settle/-Wachstum nachklemmen
}

/** Panel abmelden (z. B. zu Match-Ende). */
export function unregisterPanel(id: string): void {
  const el = panels.get(id)
  if (el !== undefined) {
    panelResizeObserver?.unobserve(el)
    const orig = insetApplied.get(el)
    if (orig !== undefined) {
      el.style.bottom = orig
      insetApplied.delete(el)
    }
  }
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
    savedAnchors.delete(el) // Styles sind frisch zurückgesetzt — alter Anker-Snapshot ist hinfällig
    // Zurück in die Auto-Skalierung: `apply()` hatte das Panel aus der ui-scale-Registry
    // genommen (Layout-Override besaß die Skalierung) — jetzt skaliert es wieder normal mit.
    registerScalable(el)
  }
}
