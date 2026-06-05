import { describe, it, expect } from 'vitest'
import { nextAttackStepPct } from '../src/input/input'

describe('nextAttackStepPct (Shift+Mausrad Angriffsgröße)', () => {
  it('hoch: 1 → 10 → 20 → … → 100', () => {
    expect(nextAttackStepPct(1, true)).toBe(10)
    expect(nextAttackStepPct(10, true)).toBe(20)
    expect(nextAttackStepPct(20, true)).toBe(30)
    expect(nextAttackStepPct(90, true)).toBe(100)
  })

  it('runter: 100 → 90 → … → 10 → 1', () => {
    expect(nextAttackStepPct(100, false)).toBe(90)
    expect(nextAttackStepPct(30, false)).toBe(20)
    expect(nextAttackStepPct(20, false)).toBe(10)
    expect(nextAttackStepPct(10, false)).toBe(1)
  })

  it('der gemeldete Bug: von 10 runter springt direkt auf 1, NICHT in Einzelschritten auf 9', () => {
    expect(nextAttackStepPct(10, false)).toBe(1)
    expect(nextAttackStepPct(10, false)).not.toBe(9)
  })

  it('rastet an den Grenzen: 100 hoch bleibt 100, 1 runter bleibt 1', () => {
    expect(nextAttackStepPct(100, true)).toBe(100)
    expect(nextAttackStepPct(1, false)).toBe(1)
  })

  it('Zwischenwerte (z. B. per Menü gesetzter Startwert) rasten zur nächsten 10er-Stufe in Scroll-Richtung', () => {
    expect(nextAttackStepPct(25, true)).toBe(30)
    expect(nextAttackStepPct(25, false)).toBe(20)
    expect(nextAttackStepPct(5, true)).toBe(10)
    expect(nextAttackStepPct(5, false)).toBe(1)
  })
})
