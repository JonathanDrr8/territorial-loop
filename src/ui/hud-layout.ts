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
}

/** Wendet den (evtl. vorhandenen) Override eines Panels auf sein DOM-Element an. */
function apply(id: string): void {
  const el = panels.get(id)
  if (el === undefined) return
  const o = layout[id]
  if (o === undefined) return
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
  if (o.w !== undefined) el.style.width = `${o.w.toString()}px`
  if (o.h !== undefined) el.style.height = `${o.h.toString()}px`
  if (o.hidden === true) el.style.display = 'none'
}

/** Panel anmelden — bekommt sofort seinen gespeicherten Override (falls vorhanden). */
export function registerPanel(id: string, el: HTMLElement): void {
  panels.set(id, el)
  apply(id)
}

/** Panel abmelden (z. B. zu Match-Ende). */
export function unregisterPanel(id: string): void {
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

/** IDs aller aktuell angemeldeten Panels. */
export function registeredIds(): string[] {
  return [...panels.keys()]
}

/** [id, element] aller angemeldeten Panels — für den Editor (Phase 3). */
export function panelElements(): Array<[string, HTMLElement]> {
  return [...panels.entries()]
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
    el.style.removeProperty('width')
    el.style.removeProperty('height')
    el.style.removeProperty('display')
  }
}
