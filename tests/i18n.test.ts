import { afterEach, describe, expect, it } from 'vitest'
import { de } from '../src/i18n/de'
import { en } from '../src/i18n/en'
import { es } from '../src/i18n/es'
import { fr } from '../src/i18n/fr'
import { it as itDict } from '../src/i18n/it'
import { pt } from '../src/i18n/pt'
import { ru } from '../src/i18n/ru'
import { zh } from '../src/i18n/zh'
import { ja } from '../src/i18n/ja'
import { getLocale, LOCALES, setLocale, t } from '../src/i18n'

const NON_DE: ReadonlyArray<readonly [string, Record<string, string>]> = [
  ['en', en],
  ['es', es],
  ['fr', fr],
  ['it', itDict],
  ['pt', pt],
  ['ru', ru],
  ['zh', zh],
  ['ja', ja],
]

afterEach(() => {
  setLocale('de')
})

describe('i18n', () => {
  it('liefert deutsche Strings nach setLocale("de")', () => {
    setLocale('de')
    expect(getLocale()).toBe('de')
    expect(t('nav.play')).toBe('Spielen')
  })

  it('liefert englische Strings nach setLocale("en")', () => {
    setLocale('en')
    expect(t('nav.play')).toBe('Play')
  })

  it('fällt für fehlende englische Keys auf Deutsch zurück', () => {
    setLocale('en')
    // Ein Key, der bewusst nur im de-Dict existiert → Fallback auf de.
    const deOnly = Object.keys(de).find((k) => !(k in en))
    if (deOnly !== undefined) {
      expect(t(deOnly)).toBe(de[deOnly])
    }
  })

  it('gibt bei unbekanntem Key den Key selbst zurück', () => {
    expect(t('does.not.exist')).toBe('does.not.exist')
  })

  it('interpoliert {param}-Platzhalter', () => {
    setLocale('de')
    expect(t('mp.reconnect', { room: 'XY42' })).toContain('XY42')
  })

  it('keine verwaisten Keys in irgendeiner Sprache (Tippfehler-Schutz)', () => {
    for (const [name, dict] of NON_DE) {
      const orphans = Object.keys(dict).filter((k) => !(k in de))
      expect(orphans, `verwaiste Keys in ${name}`).toEqual([])
    }
  })

  it('alle deklarierten LOCALES sind eindeutig', () => {
    const codes = LOCALES.map((l) => l.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('die Kern-Navigation ist in beiden Sprachen vorhanden', () => {
    for (const key of [
      'nav.play',
      'nav.multiplayer',
      'nav.settings',
      'nav.changelog',
      'nav.help',
    ]) {
      expect(de[key]).toBeTruthy()
      expect(en[key]).toBeTruthy()
    }
  })
})
