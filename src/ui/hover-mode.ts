/**
 * Hover-Modus: steuert, WIE die Info zum Tile unter dem Cursor gezeigt wird — rein lokale
 * Darstellungs-Präferenz (analog zu {@link ./map-style.ts}/Theme), persistiert in localStorage.
 *
 * - `both`    — festes Panel ({@link ./hover-info.ts}) UND mitwandernder Tooltip ({@link ./hover-tooltip.ts}).
 * - `panel`   — nur das feste Panel (Tooltip aus).
 * - `tooltip` — nur der mitwandernde Tooltip (Panel aus).
 *
 * Beide Anzeigen speisen sich aus demselben Resolver ({@link ./hover-content.ts}) → identische
 * Infos, nur unterschiedlich platziert. Kein Sim-/State-Einfluss, multiplayer-sicher.
 */

export type HoverMode = 'both' | 'panel' | 'tooltip'

/** Reihenfolge der Auswahl im Menü (`[key, labelKey]`; Label kommt zur Laufzeit aus `t()`). */
export const HOVER_MODE_OPTIONS: ReadonlyArray<readonly [HoverMode, string]> = [
  ['both', 'hovermode.both'],
  ['panel', 'hovermode.panel'],
  ['tooltip', 'hovermode.tooltip'],
]

export const DEFAULT_HOVER_MODE: HoverMode = 'both'
const STORAGE_KEY = 'territorial-loop:hover-mode:v1'

const VALID = new Set<string>(['both', 'panel', 'tooltip'])

let current: HoverMode = DEFAULT_HOVER_MODE
const listeners = new Set<() => void>()

function loadMode(): HoverMode {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v !== null && VALID.has(v)) return v as HoverMode
  } catch {
    /* ignore */
  }
  return DEFAULT_HOVER_MODE
}

// Beim Import die persistierte Wahl übernehmen (nur localStorage, kein DOM nötig).
current = loadMode()

/** Aktiver Hover-Modus. */
export function getHoverMode(): HoverMode {
  return current
}

/** Modus wählen + persistieren (reine Client-Präferenz). Benachrichtigt Abonnenten. */
export function setHoverMode(mode: string): void {
  const next: HoverMode = VALID.has(mode) ? (mode as HoverMode) : DEFAULT_HOVER_MODE
  if (next === current) return
  current = next
  try {
    window.localStorage.setItem(STORAGE_KEY, current)
  } catch {
    /* ignore */
  }
  for (const cb of listeners) cb()
}

/** Auf Modus-Wechsel reagieren (z.B. main → Tooltip/Panel umschalten). Gibt Abmelder zurück. */
export function onHoverModeChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
