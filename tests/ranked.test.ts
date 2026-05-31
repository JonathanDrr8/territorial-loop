/**
 * Tests fürs Ranked-ELO (ADR-0022): ELO-Mathematik + Persistenz/Bilanz.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  ELO_MAX,
  ELO_MIN,
  STARTING_ELO,
  expectedScore,
  loadRanked,
  nextElo,
  recordResult,
  resetRanked,
} from '../src/ui/ranked'

describe('ELO-Mathematik', () => {
  it('gleich starke Gegner → Erwartung 0.5', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 5)
  })

  it('Sieg gegen Stärkere bringt mehr als gegen Schwächere', () => {
    const vsStronger = nextElo(1000, 1300, true) - 1000
    const vsWeaker = nextElo(1000, 700, true) - 1000
    expect(vsStronger).toBeGreaterThan(vsWeaker)
  })

  it('Sieg hebt, Niederlage senkt', () => {
    expect(nextElo(1000, 1000, true)).toBeGreaterThan(1000)
    expect(nextElo(1000, 1000, false)).toBeLessThan(1000)
  })

  it('bleibt in den Grenzen', () => {
    expect(nextElo(ELO_MAX, 100, true)).toBeLessThanOrEqual(ELO_MAX)
    expect(nextElo(ELO_MIN, 2000, false)).toBeGreaterThanOrEqual(ELO_MIN)
  })
})

describe('Persistenz/Bilanz', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('startet bei 1000 ohne gespeicherte Daten', () => {
    expect(loadRanked().elo).toBe(STARTING_ELO)
  })

  it('verbucht Sieg: ELO steigt, Sieg-Zähler + Peak hoch', () => {
    const { before, after } = recordResult(1000, true)
    expect(before).toBe(1000)
    expect(after.elo).toBeGreaterThan(1000)
    expect(after.wins).toBe(1)
    expect(after.losses).toBe(0)
    expect(after.peak).toBe(after.elo)
    // Persistiert?
    expect(loadRanked().elo).toBe(after.elo)
  })

  it('Peak bleibt nach einer Niederlage erhalten', () => {
    recordResult(1400, true) // hoch
    const peak = loadRanked().peak
    recordResult(800, false) // runter
    expect(loadRanked().peak).toBe(peak)
    expect(loadRanked().elo).toBeLessThan(peak)
  })

  it('reset stellt den Startzustand her', () => {
    recordResult(1200, true)
    resetRanked()
    expect(loadRanked().elo).toBe(STARTING_ELO)
    expect(loadRanked().wins).toBe(0)
  })
})
