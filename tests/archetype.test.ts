/**
 * Tests fürs KI-Rework Phase 1 (ADR-0032): Archetypen (Spielstil orthogonal zur ELO) +
 * Spätspiel-Gold-Senke (Phase 3: Städte über das Ratio-Ziel hinaus statt Horten, ADR-0031 A1).
 */

import { describe, expect, it } from 'vitest'
import {
  applyArchetype,
  ARCHETYPES,
  archetypeFor,
  profileForElo,
  PRESET_ELO,
} from '../src/ai/strength'
import { createAI } from '../src/ai/ai'
import { createGame, tick, type GameConfig } from '../src/core/game'
import { setOwner } from '../src/world/map'
import { tileRef } from '../src/world/torus'

describe('Archetypen (ADR-0032)', () => {
  it('archetypeFor ist deterministisch und streut über die Stile', () => {
    expect(archetypeFor('seed-a', 2)).toBe(archetypeFor('seed-a', 2))
    const seen = new Set<string>()
    for (let id = 2; id < 40; id++) seen.add(archetypeFor('seed-a', id))
    expect(seen.size).toBeGreaterThan(2) // bunte Mischung, kein Einheitsbrei
    // anderer Seed → (irgendwo) andere Zuweisung
    let differs = false
    for (let id = 2; id < 40; id++)
      if (archetypeFor('seed-a', id) !== archetypeFor('seed-b', id)) differs = true
    expect(differs).toBe(true)
  })

  it('balanced ist die Identität, Stile verformen das Profil moderat', () => {
    const base = profileForElo(PRESET_ELO.standard)
    expect(applyArchetype(base, 'balanced')).toEqual(base)
    const eco = applyArchetype(base, 'eco')
    expect(eco.buildChance).toBeGreaterThan(base.buildChance)
    expect(eco.attackPct).toBeLessThan(base.attackPct)
    const agg = applyArchetype(base, 'aggressor')
    expect(agg.attackPct).toBeGreaterThan(base.attackPct)
    expect(agg.buildChance).toBeLessThan(base.buildChance)
    const turtle = applyArchetype(base, 'turtle')
    expect(turtle.attackPct).toBeLessThan(base.attackPct)
    expect(turtle.usesAirDefense).toBe(true)
    const bomber = applyArchetype(base, 'bomber')
    expect(bomber.bomberChance).toBeGreaterThan(base.bomberChance)
  })

  it('Stil-Modifikatoren bleiben über die ganze ELO-Skala in sinnvollen Grenzen', () => {
    for (const elo of [660, 850, 1000, 1130, 1225, 1293]) {
      const base = profileForElo(elo)
      for (const a of ARCHETYPES) {
        const p = applyArchetype(base, a)
        expect(p.attackPct).toBeGreaterThanOrEqual(5)
        expect(p.attackPct).toBeLessThanOrEqual(100)
        expect(p.buildChance).toBeGreaterThanOrEqual(0)
        expect(p.buildChance).toBeLessThanOrEqual(1)
        expect(p.cooldownMax).toBeGreaterThan(p.cooldownMin)
        expect(p.bomberChance).toBeGreaterThanOrEqual(0)
        expect(p.bomberChance).toBeLessThanOrEqual(0.5)
      }
    }
  })
})

describe('Spätspiel-Gold-Senke (ADR-0032 Phase 3 / ADR-0031 A1)', () => {
  it('baut bei Gold-Überschuss Städte ÜBER das Ratio-Ziel hinaus (statt zu horten)', () => {
    const W = 64
    const H = 64
    const config: GameConfig = {
      mapWidth: W,
      mapHeight: H,
      seed: 'phase3-sink',
      victoryPct: 99,
      terrain: 'flat',
      players: [
        { id: 1, name: 'Reich', color: 0xff0000ff, isHuman: false },
        { id: 2, name: 'Feind', color: 0x00ff00ff, isHuman: false },
      ],
    }
    const state = createGame(config)
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const p1 = state.players.get(1)
    const p2 = state.players.get(2)
    if (p1 === undefined || p2 === undefined) throw new Error('players missing')
    for (const p of [p1, p2]) {
      p.tilesOwned = 0
      p.frontier = new Set<number>()
      p.attacks = []
      p.troops = 10_000
    }
    // 30×30-Reich (900 Tiles) für Spieler 1 — Stadt-Ziel bei tilesPerCity~185 ist 4; wir geben ihm
    // bereits 4 Städte + 1 Fabrik (Ratio gedeckt) → Schritt 5 baut NICHT mehr. Nur die Phase-3-
    // Senke (Gold-Überschuss) darf weitere Städte anstoßen.
    for (let y = 10; y < 40; y++)
      for (let x = 10; x < 40; x++) {
        const ref = tileRef(x, y, W, H)
        setOwner(state.map, ref, 1)
        p1.tilesOwned++
        p1.frontier.add(ref)
      }
    // Gegner klein daneben (hasLivingEnemy etc.)
    const e = tileRef(50, 50, W, H)
    setOwner(state.map, e, 2)
    p2.tilesOwned = 1
    p2.frontier.add(e)
    const mkB = (type: 'city' | 'factory', x: number, y: number): void => {
      const tile = tileRef(x, y, W, H)
      state.buildings.set(tile, { type, ownerId: 1, tile, level: 1, completesAtTick: 0 })
    }
    mkB('city', 12, 12)
    mkB('city', 12, 30)
    mkB('city', 30, 12)
    mkB('city', 30, 30)
    mkB('factory', 20, 21) // ≥5 von allen Städten, ≤40 (verlinkt)
    p1.gold = 2_000_000 // klarer Überschuss → Phase 3

    const ai = createAI(1, state.seed, 'standard')
    let extraCity = false
    // Großzügiges Fenster: die KI arbeitet erst die übrigen Bauziele ab (Flughäfen, Fabrik-
    // Upgrades), bevor die Phase-3-Senke an die Reihe kommt.
    for (let t = 0; t < 2500 && !extraCity; t++) {
      const intents = ai.decide(state)
      for (const i of intents) {
        if (i.type === 'build' && i.buildingType === 'city') extraCity = true
      }
      tick(state, intents)
    }
    expect(extraCity).toBe(true) // Senke greift: 5. Stadt über dem Ziel (4) wird gebaut
  })
})
