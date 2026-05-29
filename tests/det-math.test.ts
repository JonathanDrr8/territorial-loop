import { describe, expect, it } from 'vitest'

import { detAtan2, detCos, detExp, detLn, detPow, detSin } from '../src/core/det-math'

const EPS = 1e-9

describe('det-math — Nähe zu Math.* (Spielgefühl bleibt)', () => {
  it('detLn ≈ Math.log über mehrere Größenordnungen', () => {
    for (const x of [0.001, 0.5, 1, 1.5, 2, 7, 80, 950, 12_345, 1_000_000, 9_999_999]) {
      expect(Math.abs(detLn(x) - Math.log(x))).toBeLessThan(
        EPS * Math.max(1, Math.abs(Math.log(x))),
      )
    }
  })

  it('detExp ≈ Math.exp', () => {
    for (const y of [-10, -3, -1, 0, 0.5, 1, 5, 13.8]) {
      expect(Math.abs(detExp(y) - Math.exp(y))).toBeLessThan(EPS * Math.max(1, Math.exp(y)))
    }
  })

  it('detPow ≈ Math.pow für die genutzten Exponenten (0.6 / 0.73)', () => {
    for (const p of [0.6, 0.73]) {
      for (let x = 0; x <= 4000; x += 7) {
        const got = detPow(x, p)
        const want = Math.pow(x, p)
        expect(Math.abs(got - want)).toBeLessThan(1e-6 * Math.max(1, want))
      }
    }
  })

  it('detPow Sonderfälle', () => {
    expect(detPow(0, 0.6)).toBe(0)
    expect(detPow(0, 0)).toBe(1)
    expect(detPow(5, 0)).toBe(1)
  })

  it('detSin/detCos ≈ Math.sin/cos über mehrere Perioden', () => {
    for (let x = -20; x <= 20; x += 0.1) {
      expect(Math.abs(detSin(x) - Math.sin(x))).toBeLessThan(1e-7)
      expect(Math.abs(detCos(x) - Math.cos(x))).toBeLessThan(1e-7)
    }
  })

  it('detAtan2 ≈ Math.atan2 in allen Quadranten', () => {
    const vals = [-7, -1, -0.3, 0, 0.3, 1, 7]
    for (const y of vals) {
      for (const x of vals) {
        expect(Math.abs(detAtan2(y, x) - Math.atan2(y, x))).toBeLessThan(1e-7)
      }
    }
  })
})

describe('det-math — Determinismus (gleiche Eingabe → exakt gleiche Bits)', () => {
  it('liefert identische Werte bei Wiederholung', () => {
    for (const x of [3, 17.5, 950, 123456.789]) {
      expect(detPow(x, 0.6)).toBe(detPow(x, 0.6))
      expect(detLn(x)).toBe(detLn(x))
      expect(detSin(x)).toBe(detSin(x))
      expect(detAtan2(x, 1.5)).toBe(detAtan2(x, 1.5))
    }
  })

  it('maxTroops-Cap bleibt nah am alten Math.pow-Wert (≤ 1 Truppe Drift)', () => {
    // Sicherstellt, dass die Balance-Verschiebung wirklich minimal ist.
    for (const tiles of [0, 1, 5, 37, 80, 500, 5000, 50000]) {
      const oldCap = Math.floor(4000 + Math.pow(tiles, 0.6) * 950)
      const newCap = Math.floor(4000 + detPow(tiles, 0.6) * 950)
      expect(Math.abs(newCap - oldCap)).toBeLessThanOrEqual(1)
    }
  })
})
