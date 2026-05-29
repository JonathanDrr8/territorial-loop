import { afterEach, describe, expect, it } from 'vitest'
import { de } from '../src/i18n/de'
import { en } from '../src/i18n/en'
import { getLocale, setLocale, t } from '../src/i18n'

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

  it('jeder en-Key existiert auch in de (keine verwaisten Übersetzungen)', () => {
    const orphans = Object.keys(en).filter((k) => !(k in de))
    expect(orphans).toEqual([])
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
