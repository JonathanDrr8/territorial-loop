/**
 * Tests für die Selbstläufer-Arena + ELO-Auswertung (ADR-0020).
 */

import { describe, expect, it } from 'vitest'
import { classifyIntent, runMatch, type MatchResult } from '../src/ai/arena'
import { aggregatePairwise, computeElo } from '../src/ai/elo'
import type { Difficulty } from '../src/ai/ai'

describe('arena.runMatch', () => {
  it('ist deterministisch — gleicher Seed ergibt identisches Ergebnis', () => {
    const opts = {
      roster: ['easy', 'standard', 'advanced'] as Difficulty[],
      seed: 'det-1',
      mapWidth: 64,
      mapHeight: 64,
      maxTicks: 400,
      terrain: 'continents' as const,
    }
    const a = runMatch(opts)
    const b = runMatch(opts)
    expect(a.players.map((p) => p.tilesOwned)).toEqual(b.players.map((p) => p.tilesOwned))
    expect(a.ticks).toBe(b.ticks)
  })

  it('weist jedem Spieler sein Roster-Profil zu', () => {
    const m = runMatch({
      roster: ['easy', 'advanced'] as Difficulty[],
      seed: 'roster-1',
      mapWidth: 48,
      mapHeight: 48,
      maxTicks: 100,
      terrain: 'continents',
    })
    expect(m.players.map((p) => p.difficulty)).toEqual(['easy', 'advanced'])
  })

  it('zählt Aktionen in der Nutzungs-Statistik', () => {
    const m = runMatch({
      roster: ['advanced', 'advanced'] as Difficulty[],
      seed: 'usage-1',
      mapWidth: 64,
      mapHeight: 64,
      maxTicks: 800,
      terrain: 'continents',
    })
    const totalAttacks = m.players.reduce((s, p) => s + (p.usage.attack ?? 0), 0)
    expect(totalAttacks).toBeGreaterThan(0)
  })

  it('läuft auch mit deaktivierten Gebäuden ohne Crash', () => {
    const m = runMatch({
      roster: ['standard', 'standard'] as Difficulty[],
      seed: 'nobld-1',
      mapWidth: 48,
      mapHeight: 48,
      maxTicks: 300,
      terrain: 'continents',
      allowedBuildings: { city: false, port: false, factory: false, defense: false },
    })
    // Kein Bau-Intent darf gezählt worden sein.
    for (const p of m.players) {
      for (const k of Object.keys(p.usage)) expect(k.startsWith('build:')).toBe(false)
    }
  })
})

describe('classifyIntent', () => {
  it('schlüsselt Bau nach Gebäudetyp auf', () => {
    expect(classifyIntent({ type: 'build', playerId: 1, tile: 0, buildingType: 'airport' })).toBe(
      'build:airport',
    )
  })
  it('fasst Diplomatie-Intents zusammen', () => {
    expect(classifyIntent({ type: 'request-alliance', playerId: 1, targetPlayerId: 2 })).toBe(
      'diplomacy',
    )
  })
})

describe('elo', () => {
  /** Baut ein synthetisches Match, in dem `winner` mehr Land hält als `loser`. */
  function match(seed: string, winner: Difficulty, loser: Difficulty): MatchResult {
    return {
      seed,
      ticks: 100,
      totalLand: 100,
      players: [
        { id: 1, difficulty: winner, tilesOwned: 60, troops: 0, gold: 0, isAlive: true, usage: {} },
        { id: 2, difficulty: loser, tilesOwned: 10, troops: 0, gold: 0, isAlive: true, usage: {} },
      ],
    }
  }

  it('verankert das Anker-Profil bei 1000', () => {
    const matches = [match('a', 'advanced', 'easy'), match('b', 'standard', 'easy')]
    const elo = computeElo(aggregatePairwise(matches), { anchor: 'standard' })
    expect(elo['standard']).toBe(1000)
  })

  it('gibt dem stärkeren Profil mehr ELO', () => {
    const matches: MatchResult[] = []
    for (let i = 0; i < 10; i++) {
      matches.push(match(`h${String(i)}`, 'advanced', 'standard'))
      matches.push(match(`n${String(i)}`, 'standard', 'easy'))
    }
    const elo = computeElo(aggregatePairwise(matches), { anchor: 'standard' })
    expect(elo['advanced']).toBeGreaterThan(elo['standard'] ?? 0)
    expect(elo['standard']).toBeGreaterThan(elo['easy'] ?? 0)
  })
})
