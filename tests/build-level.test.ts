/**
 * Level-Direktbau: Gebäude direkt auf einem höheren Level errichten (Baukosten + alle Upgrades
 * bis dahin). Deckt Kostenformel, Intent-Verarbeitung (inkl. Gold-Deckung) und die KI-Level-Wahl ab.
 */

import { describe, expect, it } from 'vitest'
import { buildCostAtLevel, createGame, tick, type GameConfig } from '../src/core/game'
import { aiBuildLevel } from '../src/ai/ai'
import { setOwner } from '../src/world/map'
import { tileRef } from '../src/world/torus'

const W = 64
const H = 64
const T = (x: number, y: number): number => tileRef(x, y, W, H)

function config(): GameConfig {
  return {
    mapWidth: W,
    mapHeight: H,
    seed: 'build-level',
    victoryPct: 95,
    terrain: 'flat',
    players: [
      { id: 1, name: 'P1', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'P2', color: 0x00ff00ff, isHuman: false },
    ],
  }
}

/** Leerer Zustand: alles neutral, Spieler 1 besitzt ein 3×3-Gebiet um (10,10). */
function setup(gold: number): ReturnType<typeof createGame> {
  const state = createGame(config())
  for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
  for (const p of state.players.values()) {
    p.tilesOwned = 0
    p.weightedTiles = 0
    p.frontier = new Set<number>()
    p.attacks = []
    p.troops = 1000
    p.gold = 0
  }
  const p1 = state.players.get(1)
  if (p1 === undefined) throw new Error('player missing')
  for (let y = 9; y <= 11; y++) {
    for (let x = 9; x <= 11; x++) {
      setOwner(state.map, T(x, y), 1)
      p1.tilesOwned++
      p1.weightedTiles++
      p1.frontier.add(T(x, y))
    }
  }
  p1.gold = gold
  return state
}

describe('buildCostAtLevel: Kostenformel (1× / 3× / 6× der Baukosten)', () => {
  it('L1 = base, L2 = 3×base, L3 = 6×base', () => {
    const state = setup(0)
    const base = buildCostAtLevel(state, 1, 'city', 1)
    expect(buildCostAtLevel(state, 1, 'city', 2)).toBe(base * 3)
    expect(buildCostAtLevel(state, 1, 'city', 3)).toBe(base * 6)
  })

  it('klemmt auf 1..MAX (Level 0 → 1, Level 99 → wie L3)', () => {
    const state = setup(0)
    expect(buildCostAtLevel(state, 1, 'city', 0)).toBe(buildCostAtLevel(state, 1, 'city', 1))
    expect(buildCostAtLevel(state, 1, 'city', 99)).toBe(buildCostAtLevel(state, 1, 'city', 3))
  })
})

describe('Level-Direktbau über den Build-Intent', () => {
  it('baut direkt auf Level 3 und zieht die vollen Gesamtkosten ab', () => {
    const state = setup(500_000)
    const tile = T(10, 10)
    // Kosten VOR dem Bau erfassen (danach zählt die neue Stadt mit → Eskalation).
    const base1 = buildCostAtLevel(state, 1, 'city', 1)
    const cost3 = buildCostAtLevel(state, 1, 'city', 3)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'city', level: 3 }])
    const b = state.buildings.get(tile)
    expect(b?.level).toBe(3)
    expect(b?.type).toBe('city')
    // Upgrade-Basis bleibt die einfachen Baukosten (nicht die Level-Gesamtkosten).
    expect(b?.buildPrice).toBe(base1)
    // Gold: Start − Gesamtkosten (+ kleines Tick-Einkommen). Beweist, dass die vollen L3-Kosten
    // abgezogen wurden, nicht nur die L1-Kosten.
    const gold = state.players.get(1)?.gold ?? 0
    expect(gold).toBeGreaterThanOrEqual(500_000 - cost3)
    expect(gold).toBeLessThan(500_000 - cost3 + 1000)
  })

  it('ohne Level baut wie bisher auf Level 1', () => {
    const state = setup(500_000)
    const tile = T(10, 10)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'city' }])
    expect(state.buildings.get(tile)?.level).toBe(1)
  })

  it('reicht das Gold nur für L1, wird ein L3-Bau NICHT ausgeführt (Gold bleibt)', () => {
    // L1 = base (canBuildAt ok), L3 = 6×base → mit knapp über base Gold scheitert der L3-Bau.
    const state = setup(0)
    const base = buildCostAtLevel(state, 1, 'city', 1)
    const p1 = state.players.get(1)
    if (p1 === undefined) throw new Error('player missing')
    p1.gold = base + 10 // genug für L1, viel zu wenig für L3 (6×)
    const tile = T(10, 10)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'city', level: 3 }])
    expect(state.buildings.has(tile)).toBe(false) // kein Bau
    // Keine Baukosten abgezogen (nur kleines Tick-Einkommen oben drauf).
    expect(p1.gold).toBeGreaterThanOrEqual(base + 10)
  })
})

describe('KI-Level-Wahl (aiBuildLevel)', () => {
  it('reiche KI baut hoch, knappe KI baut niedrig (60 % Reserve)', () => {
    const base = 25_000
    expect(aiBuildLevel(1_000_000, base)).toBe(3) // 6×base=150k ≤ 400k
    expect(aiBuildLevel(200_000, base)).toBe(2) // 3×base=75k ≤ 80k, 6×base=150k > 80k
    expect(aiBuildLevel(100_000, base)).toBe(1) // 3×base=75k > 40k
  })
})
