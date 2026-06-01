/**
 * Authentifizierung für eigene Accounts (ADR-0027, Phase 2).
 *
 * Passwort-Hashing über Nodes eingebautes `scrypt` (absichtlich langsam → brute-force-resistent),
 * pro Passwort ein zufälliges Salt. Vergleich timing-sicher. Token (Session + Recovery) aus
 * `crypto.randomBytes`. **Keine externe Dependency.** Reine Krypto-/Zufalls-Schicht, kein Netz/DB.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>

const KEYLEN = 64

/** Hasht ein Passwort mit frischem Salt. Beide Werte (hex) landen in der DB. */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, KEYLEN)
  return { hash: derived.toString('hex'), salt }
}

/** Prüft ein Passwort gegen gespeicherten Hash+Salt (timing-sicher). */
export async function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  let stored: Buffer
  try {
    stored = Buffer.from(hash, 'hex')
  } catch {
    return false
  }
  const derived = await scrypt(password, salt, KEYLEN)
  return stored.length === derived.length && timingSafeEqual(stored, derived)
}

/** Opakes Session-Token (URL-sicher). */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

// Verwechslungsarmes Alphabet (kein 0/O, 1/I/L) für abtippbare Codes.
const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Menschlich abtippbarer Recovery-Code, z.B. `K7MP-Q4RS-9TVW-XY28`. Wird dem Nutzer einmalig
 * gezeigt; nur sein Hash wird gespeichert. 16 Zeichen aus 30er-Alphabet ≈ 78 Bit.
 */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(16)
  let out = ''
  for (let i = 0; i < 16; i++) {
    out += RECOVERY_ALPHABET[(bytes[i] ?? 0) % RECOVERY_ALPHABET.length]
    if (i % 4 === 3 && i < 15) out += '-'
  }
  return out
}

/** Normalisiert einen eingegebenen Recovery-Code (Groß, ohne Trennzeichen/Leerraum) für Vergleich/Hash. */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * Hasht einen Recovery-Code (normalisiert) mit Salt — analog zum Passwort, da er wie ein zweites
 * Geheimnis wirkt.
 */
export async function hashRecoveryCode(code: string): Promise<{ hash: string; salt: string }> {
  return hashPassword(normalizeRecoveryCode(code))
}

/** Prüft einen eingegebenen Recovery-Code gegen gespeicherten Hash+Salt. */
export async function verifyRecoveryCode(
  code: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  return verifyPassword(normalizeRecoveryCode(code), hash, salt)
}
