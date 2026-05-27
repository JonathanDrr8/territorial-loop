import { describe, it, expect } from 'vitest'
import { createGame, tick, type GameConfig } from '../src/core/game'
import {
  HUMAN_START_TROOPS,
  BOT_START_TROOPS,
  troopIncreaseRate,
  maxTroops,
} from '../src/core/config'
import { getOwner } from '../src/world/map'
import { tileRef } from '../src/world/torus'

function baseConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mapWidth: 64,
    mapHeight: 64,
    seed: 'test-seed',
    victoryPct: 90,
    players: [
      { id: 1, name: 'Human', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'AI-1', color: 0x00ff00ff, isHuman: false },
      { id: 3, name: 'AI-2', color: 0x0000ffff, isHuman: false },
      { id: 4, name: 'AI-3', color: 0xffff00ff, isHuman: false },
    ],
    ...overrides,
  }
}

describe('createGame — basics', () => {
  it('initialises tick=0, phase=running, no winner', () => {
    const state = createGame(baseConfig())
    expect(state.tick).toBe(0)
    expect(state.phase).toBe('running')
    expect(state.winner).toBeNull()
  })

  it('creates one Player per config entry', () => {
    const state = createGame(baseConfig())
    expect(state.players.size).toBe(4)
    expect(state.players.get(1)?.name).toBe('Human')
    expect(state.players.get(2)?.isHuman).toBe(false)
  })

  it('seeds players with correct starting troops', () => {
    const state = createGame(baseConfig())
    expect(state.players.get(1)?.troops).toBe(HUMAN_START_TROOPS)
    expect(state.players.get(2)?.troops).toBe(BOT_START_TROOPS)
  })

  it('all players start alive', () => {
    const state = createGame(baseConfig())
    for (const p of state.players.values()) {
      expect(p.isAlive).toBe(true)
    }
  })
})

describe('createGame — spawn placement', () => {
  it('claims tiles for each player (approximately 25 each, 5x5)', () => {
    const state = createGame(baseConfig())
    let totalClaimed = 0
    for (const p of state.players.values()) {
      // Mit 4 Spielern auf 64x64 minDist = max(8, 16) = 16; Spawns sollten sich nicht überlappen
      expect(p.tilesOwned).toBe(25)
      totalClaimed += p.tilesOwned
    }
    expect(totalClaimed).toBe(100)
  })

  it('frontier for each player is non-empty after spawn (border tiles of 5x5)', () => {
    const state = createGame(baseConfig())
    for (const p of state.players.values()) {
      // Ein 5x5-Quadrat hat 16 Rand-Tiles (alle außer dem inneren 3x3 = 9 Tiles).
      // Bei Torus mit ausreichend Abstand sollten genau diese 16 in der Frontier sein.
      expect(p.frontier.size).toBe(16)
    }
  })

  it('different seeds produce different spawn positions', () => {
    const a = createGame(baseConfig({ seed: 'seed-a' }))
    const b = createGame(baseConfig({ seed: 'seed-b' }))
    // Suche das erste Tile mit nicht-neutralem Owner pro Game; bei verschiedenen Seeds
    // sollte das (mit hoher Wahrscheinlichkeit) ein anderer Tile sein.
    function firstOwnedTile(state: ReturnType<typeof createGame>): number {
      for (let i = 0; i < state.map.state.length; i++) {
        if (getOwner(state.map, i) !== 0) return i
      }
      return -1
    }
    expect(firstOwnedTile(a)).not.toBe(firstOwnedTile(b))
  })

  it('same seed produces identical games (determinism)', () => {
    const a = createGame(baseConfig({ seed: 'fixed' }))
    const b = createGame(baseConfig({ seed: 'fixed' }))
    for (let i = 0; i < a.map.state.length; i++) {
      expect(getOwner(a.map, i)).toBe(getOwner(b.map, i))
    }
  })

  it('rejects invalid victoryPct', () => {
    expect(() => createGame(baseConfig({ victoryPct: 0 }))).toThrow(RangeError)
    expect(() => createGame(baseConfig({ victoryPct: 101 }))).toThrow(RangeError)
  })

  it('rejects duplicate player IDs', () => {
    expect(() =>
      createGame(
        baseConfig({
          players: [
            { id: 1, name: 'A', color: 0, isHuman: true },
            { id: 1, name: 'B', color: 0, isHuman: false },
          ],
        }),
      ),
    ).toThrow(RangeError)
  })

  it('rejects player id 0 (reserved for neutral)', () => {
    expect(() =>
      createGame(
        baseConfig({
          players: [{ id: 0, name: 'X', color: 0, isHuman: true }],
        }),
      ),
    ).toThrow(RangeError)
  })
})

describe('tick — growth', () => {
  it('increments tick counter', () => {
    const state = createGame(baseConfig())
    expect(state.tick).toBe(0)
    tick(state, [])
    expect(state.tick).toBe(1)
    tick(state, [])
    expect(state.tick).toBe(2)
  })

  it('grows population per troopIncreaseRate formula', () => {
    const state = createGame(baseConfig())
    const human = state.players.get(1)
    if (human === undefined) throw new Error('player 1 missing')
    const before = human.troops
    const expectedRate = troopIncreaseRate(before, maxTroops(human.tilesOwned))
    tick(state, [])
    expect(human.troops).toBe(before + expectedRate)
  })

  it('does not grow dead players', () => {
    const state = createGame(baseConfig())
    const p = state.players.get(2)
    if (p === undefined) throw new Error('player 2 missing')
    p.isAlive = false
    const before = p.troops
    tick(state, [])
    expect(p.troops).toBe(before)
  })

  it('does not grow past cap (stays at cap)', () => {
    const state = createGame(baseConfig())
    const p = state.players.get(1)
    if (p === undefined) throw new Error('player missing')
    const max = maxTroops(p.tilesOwned)
    p.troops = max
    tick(state, [])
    // Rate ist 0 wenn troops == max, also troops bleibt bei max
    expect(p.troops).toBe(max)
  })
})

describe('tick — eliminations', () => {
  it('marks player as dead when tilesOwned == 0', () => {
    const state = createGame(baseConfig())
    const p = state.players.get(3)
    if (p === undefined) throw new Error('player missing')
    p.tilesOwned = 0
    expect(p.isAlive).toBe(true)
    tick(state, [])
    expect(p.isAlive).toBe(false)
    expect(p.troops).toBe(0)
    expect(p.attacks).toEqual([])
  })

  it('does not re-eliminate already-dead players (no double-processing)', () => {
    const state = createGame(baseConfig())
    const p = state.players.get(2)
    if (p === undefined) throw new Error('player missing')
    p.isAlive = false
    p.tilesOwned = 0
    p.troops = 5 // simulate stale data
    tick(state, [])
    // Should remain at whatever stale state we set (no further changes)
    expect(p.isAlive).toBe(false)
  })
})

describe('tick — victory', () => {
  it('sets phase=ended and winner when threshold reached', () => {
    const state = createGame(baseConfig({ victoryPct: 90 }))
    const totalTiles = state.map.width * state.map.height
    const p = state.players.get(1)
    if (p === undefined) throw new Error('player missing')
    p.tilesOwned = Math.ceil(totalTiles * 0.91)
    tick(state, [])
    expect(state.phase).toBe('ended')
    expect(state.winner).toBe(1)
  })

  it('does not change phase if no one above threshold', () => {
    const state = createGame(baseConfig({ victoryPct: 90 }))
    tick(state, [])
    expect(state.phase).toBe('running')
    expect(state.winner).toBeNull()
  })

  it('continues ticking after match ended (Spectator-Modus)', () => {
    const state = createGame(baseConfig({ victoryPct: 90 }))
    const totalTiles = state.map.width * state.map.height
    const p = state.players.get(1)
    if (p === undefined) throw new Error('player missing')
    p.tilesOwned = Math.ceil(totalTiles * 0.91)
    tick(state, [])
    const tickAfterWin = state.tick
    tick(state, [])
    expect(state.tick).toBe(tickAfterWin + 1)
    expect(state.phase).toBe('ended')
    expect(state.winner).toBe(1)
  })
})

describe('tick — intents', () => {
  it('attack intent moves troops into player.attacks', () => {
    const state = createGame(baseConfig())
    const player = state.players.get(1)
    if (player === undefined) throw new Error('player missing')
    const enemy = state.players.get(2)
    if (enemy === undefined) throw new Error('enemy missing')

    // Suche ein Tile von Spieler 2 als Ziel
    let targetTile = -1
    for (let i = 0; i < state.map.state.length; i++) {
      if (getOwner(state.map, i) === 2) {
        targetTile = i
        break
      }
    }
    expect(targetTile).toBeGreaterThanOrEqual(0)

    const troopsBefore = player.troops
    tick(state, [{ type: 'attack', playerId: 1, targetTile, troops: 5_000 }])
    expect(player.attacks).toHaveLength(1)
    expect(player.attacks[0]?.targetPlayerId).toBe(2)
    expect(player.attacks[0]?.reserveTroops).toBe(5_000)
    // troops sank by 5k, then grew slightly — should be lower than before
    expect(player.troops).toBeLessThan(troopsBefore)
  })

  it('attack intent on own tile is ignored', () => {
    const state = createGame(baseConfig())
    let ownTile = -1
    for (let i = 0; i < state.map.state.length; i++) {
      if (getOwner(state.map, i) === 1) {
        ownTile = i
        break
      }
    }
    tick(state, [{ type: 'attack', playerId: 1, targetTile: ownTile, troops: 5_000 }])
    expect(state.players.get(1)?.attacks).toEqual([])
  })

  it('attack troops are clamped to available troops', () => {
    const state = createGame(baseConfig())
    const player = state.players.get(1)
    if (player === undefined) throw new Error('player missing')
    let targetTile = -1
    for (let i = 0; i < state.map.state.length; i++) {
      if (getOwner(state.map, i) === 2) {
        targetTile = i
        break
      }
    }
    const tooMany = player.troops * 10
    tick(state, [{ type: 'attack', playerId: 1, targetTile, troops: tooMany }])
    const attack = player.attacks[0]
    expect(attack).toBeDefined()
    if (attack !== undefined) {
      // Should never exceed troops at the moment of intent
      expect(attack.reserveTroops).toBeLessThanOrEqual(HUMAN_START_TROOPS)
    }
  })

  it('cancel-attack returns reserve troops and removes attack', () => {
    const state = createGame(baseConfig())
    const player = state.players.get(1)
    if (player === undefined) throw new Error('player missing')
    let targetTile = -1
    for (let i = 0; i < state.map.state.length; i++) {
      if (getOwner(state.map, i) === 2) {
        targetTile = i
        break
      }
    }
    tick(state, [{ type: 'attack', playerId: 1, targetTile, troops: 1_000 }])
    expect(player.attacks).toHaveLength(1)
    const troopsBefore = player.troops
    tick(state, [{ type: 'cancel-attack', playerId: 1, attackIndex: 0 }])
    expect(player.attacks).toHaveLength(0)
    expect(player.troops).toBeGreaterThanOrEqual(troopsBefore + 1_000)
  })

  it('intents from different players are applied deterministically', () => {
    const state1 = createGame(baseConfig())
    const state2 = createGame(baseConfig())
    // unrelated, no-op intents — same seed must give same end state
    tick(state1, [])
    tick(state2, [])
    expect(state1.tick).toBe(state2.tick)
    expect(state1.players.get(1)?.troops).toBe(state2.players.get(1)?.troops)
  })
})

describe('tile coords are torus-wrapped on access', () => {
  it('attack on a tile at world edge still resolves correctly', () => {
    const state = createGame(baseConfig())
    // Pick the wrap edge tile — should be owner 0 (neutral) statistically
    const wrapTile = tileRef(
      state.map.width - 1,
      state.map.height - 1,
      state.map.width,
      state.map.height,
    )
    // No exception should be thrown
    tick(state, [{ type: 'attack', playerId: 1, targetTile: wrapTile, troops: 100 }])
  })
})
