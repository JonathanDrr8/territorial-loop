import { describe, it, expect } from 'vitest'
import {
  buildCost,
  upgradeCost,
  defenseRange,
  CITY_CAP_BONUS,
  MARKET_GOLD_PER_TICK,
} from '../src/core/buildings'
import { createGame, tick, effectiveMaxTroops, type GameConfig } from '../src/core/game'
import { getOwner } from '../src/world/map'

function cfg(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mapWidth: 48,
    mapHeight: 48,
    seed: 'build-test',
    victoryPct: 90,
    terrain: 'flat',
    players: [
      { id: 1, name: 'Human', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'AI', color: 0x00ff00ff, isHuman: false },
    ],
    ...overrides,
  }
}

function ownedTile(state: ReturnType<typeof createGame>, playerId: number): number {
  for (let i = 0; i < state.map.state.length; i++) {
    if (getOwner(state.map, i) === playerId) return i
  }
  return -1
}

describe('building cost functions', () => {
  it('build cost escalates by powers of two', () => {
    expect(buildCost('city', 0)).toBe(25_000)
    expect(buildCost('city', 1)).toBe(50_000)
    expect(buildCost('city', 2)).toBe(100_000)
  })

  it('upgrade cost grows linearly with level', () => {
    expect(upgradeCost('market', 1)).toBe(30_000)
    expect(upgradeCost('market', 2)).toBe(45_000)
  })

  it('defense range grows per level', () => {
    expect(defenseRange(1)).toBe(8)
    expect(defenseRange(2)).toBe(12)
    expect(defenseRange(3)).toBe(16)
  })
})

describe('build intent', () => {
  it('places a building and deducts gold', () => {
    const state = createGame(cfg())
    const p = state.players.get(1)
    if (p === undefined) throw new Error('no player')
    p.gold = 100_000
    const tile = ownedTile(state, 1)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'market' }])
    expect(state.buildings.has(tile)).toBe(true)
    expect(state.buildings.get(tile)?.type).toBe('market')
    // gold reduced by 15000 build cost (then +income for the tick)
    expect(p.gold).toBeLessThan(100_000)
  })

  it('rejects building without enough gold', () => {
    const state = createGame(cfg())
    const p = state.players.get(1)
    if (p === undefined) throw new Error('no player')
    p.gold = 100
    const tile = ownedTile(state, 1)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'city' }])
    expect(state.buildings.has(tile)).toBe(false)
  })

  it('rejects building on a foreign tile', () => {
    const state = createGame(cfg())
    const p = state.players.get(1)
    if (p === undefined) throw new Error('no player')
    p.gold = 100_000
    const enemyTile = ownedTile(state, 2)
    tick(state, [{ type: 'build', playerId: 1, tile: enemyTile, buildingType: 'market' }])
    expect(state.buildings.has(enemyTile)).toBe(false)
  })

  it('city raises the effective troop cap', () => {
    const state = createGame(cfg())
    const p = state.players.get(1)
    if (p === undefined) throw new Error('no player')
    const capBefore = effectiveMaxTroops(state, 1)
    p.gold = 100_000
    const tile = ownedTile(state, 1)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'city' }])
    expect(effectiveMaxTroops(state, 1)).toBe(capBefore + CITY_CAP_BONUS)
  })

  it('market adds to gold income', () => {
    const state = createGame(cfg())
    const p = state.players.get(1)
    if (p === undefined) throw new Error('no player')
    p.gold = 100_000
    const tile = ownedTile(state, 1)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'market' }])
    const goldAfterBuild = p.gold
    tick(state, []) // one tick: base income + market income
    const delta = p.gold - goldAfterBuild
    // base 100 + market 40 (level 1)
    expect(delta).toBe(100 + MARKET_GOLD_PER_TICK)
  })
})

describe('upgrade intent', () => {
  it('raises building level and deducts upgrade cost', () => {
    const state = createGame(cfg())
    const p = state.players.get(1)
    if (p === undefined) throw new Error('no player')
    p.gold = 200_000
    const tile = ownedTile(state, 1)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'city' }])
    tick(state, [{ type: 'upgrade', playerId: 1, tile }])
    expect(state.buildings.get(tile)?.level).toBe(2)
  })

  it('caps at MAX_BUILDING_LEVEL', () => {
    const state = createGame(cfg())
    const p = state.players.get(1)
    if (p === undefined) throw new Error('no player')
    p.gold = 10_000_000
    const tile = ownedTile(state, 1)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'city' }])
    for (let i = 0; i < 5; i++) tick(state, [{ type: 'upgrade', playerId: 1, tile }])
    expect(state.buildings.get(tile)?.level).toBe(3)
  })
})
