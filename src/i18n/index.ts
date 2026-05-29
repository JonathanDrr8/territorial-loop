/**
 * Leichtgewichtige i18n (ADR-0014). `t(key)` schlägt den String der aktuellen Sprache nach,
 * fällt auf Deutsch und zuletzt auf den Key zurück. Sprache aus `navigator.language` (Präfix-
 * Match gegen die verfügbaren Locales), persistiert in localStorage; Wechsel benachrichtigt
 * Listener (→ Menü neu rendern).
 *
 * Eine Sprache hinzufügen: Wörterbuch-Datei anlegen (Keys aus `de`), hier importieren und einen
 * Eintrag in `LOCALES` ergänzen. Fehlende Keys fallen automatisch auf Deutsch zurück.
 */

import { de } from './de'
import { en } from './en'
import { es } from './es'
import { fr } from './fr'
import { it } from './it'
import { pt } from './pt'
import { ru } from './ru'
import { zh } from './zh'
import { ja } from './ja'

export type Locale = 'de' | 'en' | 'es' | 'fr' | 'it' | 'pt' | 'ru' | 'zh' | 'ja'

/** Verfügbare Sprachen (Reihenfolge = Anzeige im Umschalter); `label` ist die Kurz-Anzeige. */
export const LOCALES: ReadonlyArray<{ readonly code: Locale; readonly label: string }> = [
  { code: 'de', label: 'DE' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
  { code: 'it', label: 'IT' },
  { code: 'pt', label: 'PT' },
  { code: 'ru', label: 'RU' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
]

const DICTS: Record<Locale, Record<string, string>> = { de, en, es, fr, it, pt, ru, zh, ja }
const STORAGE_KEY = 'territorial-loop:locale:v1'

function isLocale(v: string): v is Locale {
  return LOCALES.some((l) => l.code === v)
}

function detectLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved !== null && isLocale(saved)) return saved
  } catch {
    /* ignore */
  }
  try {
    const lang = window.navigator.language.toLowerCase()
    for (const { code } of LOCALES) {
      if (lang.startsWith(code)) return code
    }
  } catch {
    /* ignore */
  }
  return 'en'
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
 * Fallback: aktuelle Sprache → Deutsch → der Key selbst (so fällt Fehlendes im Test auf).
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = DICTS[current][key] ?? DICTS.de[key] ?? key
  if (params === undefined) return raw
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = params[k]
    return v === undefined ? m : String(v)
  })
}
