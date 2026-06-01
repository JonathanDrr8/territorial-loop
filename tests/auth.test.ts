import { describe, it, expect } from 'vitest'

import {
  generateRecoveryCode,
  generateSessionToken,
  hashPassword,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyPassword,
  verifyRecoveryCode,
} from '../server/auth'

describe('auth: Passwort-Hashing', () => {
  it('verifiziert das richtige Passwort und lehnt falsche ab', async () => {
    const { hash, salt } = await hashPassword('correct horse')
    expect(await verifyPassword('correct horse', hash, salt)).toBe(true)
    expect(await verifyPassword('wrong horse', hash, salt)).toBe(false)
  })

  it('nutzt pro Hash ein frisches Salt (gleiche Passwörter → verschiedene Hashes)', async () => {
    const a = await hashPassword('same')
    const b = await hashPassword('same')
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
    expect(await verifyPassword('same', a.hash, a.salt)).toBe(true)
    expect(await verifyPassword('same', b.hash, b.salt)).toBe(true)
  })

  it('verifyPassword wirft nicht bei kaputtem Hash', async () => {
    expect(await verifyPassword('x', 'nicht-hex!!', 'salt')).toBe(false)
  })
})

describe('auth: Recovery-Code', () => {
  it('hat das Format XXXX-XXXX-XXXX-XXXX aus verwechslungsarmem Alphabet', () => {
    const code = generateRecoveryCode()
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(code).not.toMatch(/[01OIL]/) // verwechslungsarm
  })

  it('normalisiert Eingaben (Groß, ohne Trennzeichen)', () => {
    expect(normalizeRecoveryCode('k7mp-q4rs-9tvw-xy28')).toBe('K7MPQ4RS9TVWXY28')
    expect(normalizeRecoveryCode('K7MP Q4RS')).toBe('K7MPQ4RS')
  })

  it('verifiziert den Code unabhängig von Schreibweise/Trennzeichen', async () => {
    const code = generateRecoveryCode()
    const { hash, salt } = await hashRecoveryCode(code)
    expect(await verifyRecoveryCode(code.toLowerCase(), hash, salt)).toBe(true)
    expect(await verifyRecoveryCode(code.replace(/-/g, ''), hash, salt)).toBe(true)
    expect(await verifyRecoveryCode('WRONG-CODE-0000-0000', hash, salt)).toBe(false)
  })

  it('Session-Token sind URL-sicher und einzigartig', () => {
    const a = generateSessionToken()
    const b = generateSessionToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(a).not.toBe(b)
  })
})
