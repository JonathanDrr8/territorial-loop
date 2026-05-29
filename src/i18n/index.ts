/**
 * Leichtgewichtige i18n (ADR-0014). `t(key)` schlägt den String der aktuellen Sprache nach,
 * fällt auf Deutsch und zuletzt auf den Key zurück. Sprache aus `navigator.language` (de→de,
 * sonst en), persistiert in localStorage; Wechsel benachrichtigt Listener (→ Menü neu rendern).
 *
 * Bewusst minimal (kein Framework): die NEUE Oberfläche (Menü-Shell + Hilfe) nutzt `t()` und ist
 * de+en; das bestehende In-Game-HUD bleibt vorerst Deutsch und wird inkrementell migriert.
 */

import { de } from './de'
import { en } from './en'

export type Locale = 'de' | 'en'

const DICTS: Record<Locale, Record<string, string>> = { de, en }
const STORAGE_KEY = 'territorial-loop:locale:v1'

function detectLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'de' || saved === 'en') return saved
  } catch {
    /* ignore */
  }
  try {
    return window.navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en'
  } catch {
    return 'de'
  }
}

let current: Locale = detectLocale()
const listeners = new Set<() => void>()

export function getLocale(): Locale {
  return current
}

export function setLocale(locale: Locale): void {
  if (locale === current) return
  current = locale
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
  for (const cb of listeners) cb()
}

/** Registriert einen Callback für Sprachwechsel; gibt eine Abmelde-Funktion zurück. */
export function onLocaleChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/**
 * Übersetzt `key` in die aktuelle Sprache. `{name}`-Platzhalter werden aus `params` ersetzt.
 * Fallback: Deutsch → der Key selbst (so fällt Fehlendes im Test auf).
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = DICTS[current][key] ?? DICTS.de[key] ?? key
  if (params === undefined) return raw
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = params[k]
    return v === undefined ? m : String(v)
  })
}
