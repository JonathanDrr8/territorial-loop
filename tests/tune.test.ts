/**
 * Tests fürs Tuner-Kernmodul (ADR-0021): Komposit-Fitness, Clamping, Mutation, Profil-Mapping.
 */

import { describe, expect, it } from 'vitest'
import {
  BOUNDS,
  clampParams,
  compositeFitness,
  mulberry32,
  mutateParams,
  paramsToProfile,
  profileToParams,
  type ParamVector,
} from '../src/ai/tune'
import { PROFILES } from '../src/ai/ai'
import type { MatchResult } from '../src/ai/arena'

function result(
  players: Array<{ id: number; tiles: number; troops: number; gold: number }>,
): MatchResult {
  return {
    seed: 's',
    ticks: 100,
    totalLand: 1000,
    players: players.map((p) => ({
      id: p.id,
      difficulty: 'expert' as const,
      tilesOwned: p.tiles,
      troops: p.troops,
      gold: p.gold,
      isAlive: true,
      usage: {},
    })),
  }
}

describe('compositeFitness', () => {
  it('= 1, wenn der Kandidat das ganze Feld hält', () => {
    const r = result([
      { id: 1, tiles: 100, troops: 100, gold: 100 },
      { id: 2, tiles: 0, troops: 0, gold: 0 },
    ])
    expect(compositeFitness(r, new Set([1]))).toBeCloseTo(1, 5)
  })

  it('≈ 0, wenn der Kandidat nichts hält', () => {
    const r = result([
      { id: 1, tiles: 0, troops: 0, gold: 0 },
      { id: 2, tiles: 100, troops: 100, gold: 100 },
    ])
    expect(compositeFitness(r, new Set([1]))).toBeCloseTo(0, 5)
  })

  it('gewichtet Sieg > Wachstum > Economy', () => {
    // Kandidat hält alle Tiles, sonst nichts → Fitness = win-Gewicht (0.5).
    const r = result([
      { id: 1, tiles: 100, troops: 0, gold: 0 },
      { id: 2, tiles: 0, troops: 100, gold: 100 },
    ])
    expect(compositeFitness(r, new Set([1]))).toBeCloseTo(0.5, 5)
  })
})

describe('clampParams', () => {
  it('hält alle Dimensionen in den Grenzen', () => {
    const wild: ParamVector = {
      attackPct: 999,
      cooldownMin: -5,
      cooldownMax: 1,
      popThresholdForPvp: 5,
      buildChance: 9,
      boatChance: -1,
      warshipChance: 9,
      bomberChance: 9,
      tilesPerCity: 9999,
    }
    const c = clampParams(wild)
    for (const k of Object.keys(BOUNDS) as (keyof ParamVector)[]) {
      const [lo, hi] = BOUNDS[k]
      expect(c[k]).toBeGreaterThanOrEqual(lo)
      expect(c[k]).toBeLessThanOrEqual(hi)
    }
  })

  it('erzwingt cooldownMax > cooldownMin', () => {
    const c = clampParams({ ...profileToParams(PROFILES.expert), cooldownMin: 40, cooldownMax: 10 })
    expect(c.cooldownMax).toBeGreaterThan(c.cooldownMin)
  })
})

describe('paramsToProfile', () => {
  it('übernimmt die Fähigkeits-Flags der Basis, setzt die Parameter', () => {
    const base = PROFILES.expert
    const params = { ...profileToParams(base), attackPct: 33, tilesPerCity: 100 }
    const prof = paramsToProfile(params, base)
    expect(prof.attackPct).toBe(33)
    expect(prof.tilesPerCity).toBe(100)
    expect(prof.usesBombers).toBe(base.usesBombers)
    expect(prof.healsCraters).toBe(base.healsCraters)
  })
})

describe('mutateParams', () => {
  it('ist deterministisch bei gleichem Seed und bleibt in den Grenzen', () => {
    const p = profileToParams(PROFILES.standard)
    const a = mutateParams(p, 0.2, mulberry32(42))
    const b = mutateParams(p, 0.2, mulberry32(42))
    expect(a).toEqual(b)
    for (const k of Object.keys(BOUNDS) as (keyof ParamVector)[]) {
      const [lo, hi] = BOUNDS[k]
      expect(a[k]).toBeGreaterThanOrEqual(lo)
      expect(a[k]).toBeLessThanOrEqual(hi)
    }
  })
})
