/**
 * Konfigurierbare Tastenbelegung für die Aktions-Tasten (ADR-0028-Erweiterung). Bildet eine
 * Aktion auf eine einzelne Taste ab (kleingeschrieben). Reine Client-Präferenz (localStorage),
 * kein Sim-Determinismus → multiplayer-sicher.
 *
 * NICHT umbelegbar (reserviert): Bewegung WASD, Pause (Leertaste), Esc (Abbrechen/Menü) sowie
 * Shift (Modifier). Diese Tasten dürfen daher auch nicht als Ziel einer Belegung gewählt werden.
 */

/** Belegbare Aktionen. */
export type KeyAction =
  | 'center'
  | 'boat'
  | 'bomber'
  | 'warship'
  | 'shipRanges'
  | 'radial'
  | 'speedUp'
  | 'speedDown'
  | 'buildCity'
  | 'buildDefense'
  | 'buildPort'
  | 'buildFactory'
  | 'buildAirport'
  | 'buildFlak'

/** Reihenfolge fürs Einstellungs-UI. */
export const KEY_ACTIONS: readonly KeyAction[] = [
  'center',
  'radial',
  'boat',
  'bomber',
  'warship',
  'shipRanges',
  'speedUp',
  'speedDown',
  'buildCity',
  'buildDefense',
  'buildPort',
  'buildFactory',
  'buildAirport',
  'buildFlak',
]

/** i18n-Key je Aktion (Label im Einstellungs-UI). */
export const KEY_ACTION_LABEL: Record<KeyAction, string> = {
  center: 'keybind.center',
  radial: 'keybind.radial',
  boat: 'keybind.boat',
  bomber: 'keybind.bomber',
  warship: 'keybind.warship',
  shipRanges: 'keybind.shipRanges',
  speedUp: 'keybind.speedUp',
  speedDown: 'keybind.speedDown',
  buildCity: 'keybind.buildCity',
  buildDefense: 'keybind.buildDefense',
  buildPort: 'keybind.buildPort',
  buildFactory: 'keybind.buildFactory',
  buildAirport: 'keybind.buildAirport',
  buildFlak: 'keybind.buildFlak',
}

const DEFAULTS: Record<KeyAction, string> = {
  center: 'c',
  radial: 'e',
  boat: 'b',
  bomber: '7',
  warship: '8',
  shipRanges: 'r',
  speedUp: '.',
  speedDown: ',',
  buildCity: '1',
  buildDefense: '2',
  buildPort: '3',
  buildFactory: '4',
  buildAirport: '5',
  buildFlak: '6',
}

/** Tasten, die fest reserviert sind und nicht belegt werden dürfen. */
const RESERVED = new Set(['w', 'a', 's', 'd', ' ', 'escape', 'shift', 'control', 'alt', 'meta'])

/** Reservierte Taste? (z. B. zum Ablehnen im Rebind-UI.) */
export function isReservedKey(key: string): boolean {
  return RESERVED.has(key.toLowerCase())
}

const KEY = 'territorial-loop:keybinds:v1'

function load(): Record<KeyAction, string> {
  const out = { ...DEFAULTS }
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw) as Partial<Record<KeyAction, string>>
      for (const a of KEY_ACTIONS) {
        const k = parsed[a]
        if (typeof k === 'string' && k !== '') out[a] = k.toLowerCase()
      }
    }
  } catch {
    /* ignore */
  }
  return out
}

let binds = load()
const listeners = new Set<() => void>()

function save(): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(binds))
  } catch {
    /* ignore */
  }
  for (const fn of listeners) fn()
}

/** Aktuell belegte Taste einer Aktion. */
export function getKey(action: KeyAction): string {
  return binds[action]
}

/**
 * Aktion zu einer gedrückten Taste (kleingeschrieben) auflösen — Reverse-Lookup für den Input.
 * `undefined`, wenn keine Aktion auf der Taste liegt.
 */
export function resolveAction(key: string): KeyAction | undefined {
  const k = key.toLowerCase()
  for (const a of KEY_ACTIONS) {
    if (binds[a] === k) return a
  }
  return undefined
}

/**
 * Eine Aktion neu belegen. Liegt die Taste schon auf einer anderen Aktion, wird die andere frei
 * (Tausch/Kollision vermeiden). Reservierte Tasten werden abgelehnt (Rückgabe false).
 */
export function setKey(action: KeyAction, key: string): boolean {
  const k = key.toLowerCase()
  if (k === '' || isReservedKey(k)) return false
  const next = { ...binds }
  // Kollision: dieselbe Taste von einer anderen Aktion lösen.
  for (const a of KEY_ACTIONS) {
    if (a !== action && next[a] === k) next[a] = ''
  }
  next[action] = k
  binds = next
  save()
  return true
}

/** Alle Belegungen auf die Standardwerte zurücksetzen. */
export function resetKeybinds(): void {
  binds = { ...DEFAULTS }
  save()
}

/** Bei Änderungen benachrichtigt werden (Abmelde-Funktion zurück). */
export function onKeybindsChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
