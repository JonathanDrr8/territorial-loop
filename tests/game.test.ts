import { describe, it, expect } from 'vitest'
import {
  createGame,
  effectiveMaxTroops,
  tick,
  type GameConfig,
  type GameState,
} from '../src/core/game'
import {
  HUMAN_START_TROOPS,
  BOT_START_TROOPS,
  troopIncreaseRate,
  maxTroops,
} from '../src/core/config'
import { getOwner } from '../src/world/map'
import { IS_LAND_BIT } from '../src/world/terrain'
import { tileRef, neighbors4 } from '../src/world/torus'

/** Validate that every tile in each player's frontier is actually a border tile. */
function assertFrontierConsistency(state: GameState): void {
  const { width, height } = state.map
  for (const player of state.players.values()) {
    for (const ref of player.frontier) {
      expect(getOwner(state.map, ref)).toBe(player.id)
      const hasForeign = neighbors4(ref, width, height).some(
        (n) => getOwner(state.map, n) !== player.id,
      )
      expect(hasForeign).toBe(true)
    }
  }
}

/** Sum of tilesOwned across players must match map tiles that have a non-zero owner. */
function assertTileCountConsistency(state: GameState): void {
  let actualOwned = 0
  for (let i = 0; i < state.map.state.length; i++) {
    if (getOwner(state.map, i) !== 0) actualOwned++
  }
  let cachedOwned = 0
  for (const p of state.players.values()) cachedOwned += p.tilesOwned
  expect(cachedOwned).toBe(actualOwned)
}

/** Find a tile owned by `playerId`. Returns -1 if not found. */
function findOwnedTile(state: GameState, playerId: number): number {
  for (let i = 0; i < state.map.state.length; i++) {
    if (getOwner(state.map, i) === playerId) return i
  }
  return -1
}

/** Find a neutral tile adjacent to a tile owned by `playerId`. */
function findNeutralBorderTile(state: GameState, playerId: number): number {
  const { width, height } = state.map
  const player = state.players.get(playerId)
  if (player === undefined) return -1
  for (const ref of player.frontier) {
    for (const n of neighbors4(ref, width, height)) {
      if (getOwner(state.map, n) === 0) return n
    }
  }
  return -1
}

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
  it('claims a solid spawn blob per player (~SPAWN_TARGET tiles, no overlap)', () => {
    const state = createGame(baseConfig())
    for (const p of state.players.values()) {
      // Organischer Blob (SPAWN_TARGET ~80); auf 64x64-flat mit 4 Spielern und
      // genug Abstand bekommt jeder sein volles Ziel.
      expect(p.tilesOwned).toBeGreaterThanOrEqual(60)
      expect(p.tilesOwned).toBeLessThanOrEqual(100)
    }
    // tilesOwned-Cache stimmt mit den tatsächlich belegten Map-Tiles überein
    // (keine Überlappung, kein Doppelzählen).
    assertTileCountConsistency(state)
  })

  it('frontier for each player is non-empty after spawn', () => {
    const state = createGame(baseConfig())
    for (const p of state.players.values()) {
      expect(p.frontier.size).toBeGreaterThan(0)
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
    // Cap ist terrain-gewichtet → weightedTiles, nicht die reine Tile-Anzahl.
    const expectedRate = troopIncreaseRate(before, maxTroops(human.weightedTiles))
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

  it('plains-heavy nation has a higher troop cap than a mountain-heavy one', () => {
    const state = createGame(baseConfig())
    const a = state.players.get(1)
    const b = state.players.get(2)
    if (a === undefined || b === undefined) throw new Error('players missing')
    // gleiche Tile-Anzahl, aber Ebene (Gewicht 1.5) vs. Berg (Gewicht 0.5)
    a.tilesOwned = 100
    a.weightedTiles = 100 * 1.5
    b.tilesOwned = 100
    b.weightedTiles = 100 * 0.5
    expect(effectiveMaxTroops(state, 1)).toBeGreaterThan(effectiveMaxTroops(state, 2))
  })

  it('does not grow past cap (stays at cap)', () => {
    const state = createGame(baseConfig())
    const p = state.players.get(1)
    if (p === undefined) throw new Error('player missing')
    const max = maxTroops(p.weightedTiles)
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

/** Ein an die Frontier des Spielers angrenzendes neutrales Tile (für echte, fortlaufende Angriffe). */
function adjacentNeutralTile(state: GameState, playerId: number): number {
  const player = state.players.get(playerId)
  if (player === undefined) return -1
  const { width, height } = state.map
  for (const ref of player.frontier) {
    for (const n of neighbors4(ref, width, height)) {
      if (getOwner(state.map, n) === 0) return n
    }
  }
  return -1
}

describe('tick — intents', () => {
  it('attack intent moves troops into player.attacks', () => {
    const state = createGame(baseConfig())
    const player = state.players.get(1)
    if (player === undefined) throw new Error('player missing')
    // Angrenzendes neutrales Tile → der Angriff hat eine Front und bleibt aktiv.
    const targetTile = adjacentNeutralTile(state, 1)
    expect(targetTile).toBeGreaterThanOrEqual(0)

    const troopsBefore = player.troops
    tick(state, [{ type: 'attack', playerId: 1, targetTile, troops: 5_000 }])
    expect(player.attacks.length).toBeGreaterThanOrEqual(1)
    expect(player.attacks[0]?.targetPlayerId).toBe(0) // neutral
    expect(player.attacks[0]?.reserveTroops).toBeGreaterThan(0)
    expect(player.attacks[0]?.reserveTroops).toBeLessThanOrEqual(5_000)
    // troops sank by ~5k (abzüglich etwas Wachstum) — niedriger als vorher
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
    const targetTile = adjacentNeutralTile(state, 1)
    expect(targetTile).toBeGreaterThanOrEqual(0)
    const tooMany = player.troops * 10
    tick(state, [{ type: 'attack', playerId: 1, targetTile, troops: tooMany }])
    const attack = player.attacks[0]
    expect(attack).toBeDefined()
    if (attack !== undefined) {
      // Reserve nie über den verfügbaren Truppen zum Intent-Zeitpunkt
      expect(attack.reserveTroops).toBeLessThanOrEqual(HUMAN_START_TROOPS)
    }
  })

  it('cancel-attack returns reserve troops and removes attack', () => {
    const state = createGame(baseConfig())
    const player = state.players.get(1)
    if (player === undefined) throw new Error('player missing')
    const targetTile = adjacentNeutralTile(state, 1)
    expect(targetTile).toBeGreaterThanOrEqual(0)
    tick(state, [{ type: 'attack', playerId: 1, targetTile, troops: 1_000 }])
    const attack = player.attacks[0]
    expect(attack).toBeDefined()
    const reserve = attack?.reserveTroops ?? 0
    expect(reserve).toBeGreaterThan(0)
    const troopsBefore = player.troops
    tick(state, [{ type: 'cancel-attack', playerId: 1, attackIndex: 0 }])
    expect(player.attacks).toHaveLength(0)
    // Die zum Cancel-Zeitpunkt verbliebene Reserve fließt zurück in den Pool.
    expect(player.troops).toBeGreaterThanOrEqual(troopsBefore + reserve)
  })

  it('higher terrain is conquered more slowly (fewer tiles over time)', () => {
    // Zwei identische Läufe: einmal in Ebene, einmal in Berg-Terrain.
    function expandedTiles(mountain: boolean): number {
      const state = createGame(baseConfig())
      if (mountain) {
        // Alle Tiles auf Berg-Höhe setzen (begehbar, aber hohe Magnitude).
        for (let i = 0; i < state.map.terrain.length; i++) {
          state.map.terrain[i] = IS_LAND_BIT | 25
        }
      }
      const player = state.players.get(1)
      if (player === undefined) throw new Error('player missing')
      const target = adjacentNeutralTile(state, 1)
      expect(target).toBeGreaterThanOrEqual(0)
      player.troops = 1_000_000
      tick(state, [{ type: 'attack', playerId: 1, targetTile: target, troops: 500_000 }])
      for (let i = 0; i < 20; i++) tick(state, [])
      return player.tilesOwned
    }
    expect(expandedTiles(false)).toBeGreaterThan(expandedTiles(true))
  })

  it('an attack with no reachable front refunds its reserve', () => {
    const state = createGame(baseConfig())
    const player = state.players.get(1)
    if (player === undefined) throw new Error('player missing')
    // Künstlicher Angriff auf Spieler 2, der nicht an die eigene Frontier grenzt
    // (Spawns haben Mindestabstand). Ohne Front sollte die Reserve zurückfließen.
    player.troops -= 500
    const troopsBefore = player.troops
    player.attacks.push({ targetPlayerId: 2, reserveTroops: 500, focusTile: 0 })
    tick(state, [])
    expect(player.attacks).toHaveLength(0)
    expect(player.troops).toBeGreaterThanOrEqual(troopsBefore + 500)
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

describe('attack resolution — TerraNullius', () => {
  it('attack on neutral tile captures tiles over multiple ticks', () => {
    const state = createGame(baseConfig())
    const neutralTile = findNeutralBorderTile(state, 1)
    expect(neutralTile).toBeGreaterThanOrEqual(0)

    const player = state.players.get(1)
    if (player === undefined) throw new Error('player missing')
    const tilesBefore = player.tilesOwned

    tick(state, [{ type: 'attack', playerId: 1, targetTile: neutralTile, troops: 5_000 }])
    for (let i = 0; i < 10; i++) tick(state, [])

    expect(player.tilesOwned).toBeGreaterThan(tilesBefore)
    assertTileCountConsistency(state)
  })

  it('TerraNullius capture does not change other players tile counts', () => {
    const state = createGame(baseConfig())
    const neutralTile = findNeutralBorderTile(state, 1)
    expect(neutralTile).toBeGreaterThanOrEqual(0)

    const others = [2, 3, 4].map((id) => {
      const p = state.players.get(id)
      if (p === undefined) throw new Error(`player ${id} missing`)
      return { id, before: p.tilesOwned }
    })

    tick(state, [{ type: 'attack', playerId: 1, targetTile: neutralTile, troops: 5_000 }])
    for (let i = 0; i < 5; i++) tick(state, [])

    for (const { id, before } of others) {
      const p = state.players.get(id)
      if (p === undefined) throw new Error('lost')
      expect(p.tilesOwned).toBe(before)
    }
  })

  it('attack ends when reserve runs out, after capturing some tiles', () => {
    const state = createGame(baseConfig())
    const neutralTile = findNeutralBorderTile(state, 1)
    const player = state.players.get(1)
    if (player === undefined) throw new Error('player missing')
    const tilesBefore = player.tilesOwned

    // Even small reserve (200) may be consumed in the same tick (front is wide,
    // tilesPerTick can reach ~30 against TerraNullius); after a few ticks the
    // attack must be gone regardless.
    tick(state, [{ type: 'attack', playerId: 1, targetTile: neutralTile, troops: 200 }])
    for (let i = 0; i < 50; i++) tick(state, [])

    expect(player.attacks).toHaveLength(0)
    expect(player.tilesOwned).toBeGreaterThan(tilesBefore)
  })
})

describe('attack resolution — invariants', () => {
  it('frontier stays consistent across many ticks of combat', () => {
    const state = createGame(baseConfig({ seed: 'frontier-test' }))

    for (let id = 1; id <= 4; id++) {
      const target = findNeutralBorderTile(state, id)
      if (target < 0) continue
      const p = state.players.get(id)
      if (p === undefined) continue
      tick(state, [
        {
          type: 'attack',
          playerId: id,
          targetTile: target,
          troops: Math.floor(p.troops / 2),
        },
      ])
    }

    for (let i = 0; i < 100; i++) {
      tick(state, [])
      if (i % 20 === 0) {
        assertTileCountConsistency(state)
        assertFrontierConsistency(state)
      }
    }
    assertFrontierConsistency(state)
    assertTileCountConsistency(state)
  })

  it('attacking own tile (via stale targetTile) keeps invariants', () => {
    const state = createGame(baseConfig({ seed: 'self-attack' }))
    const ownTile = findOwnedTile(state, 1)
    expect(ownTile).toBeGreaterThanOrEqual(0)

    // Attack on own tile is ignored — no state corruption
    tick(state, [{ type: 'attack', playerId: 1, targetTile: ownTile, troops: 1_000 }])
    assertTileCountConsistency(state)
    assertFrontierConsistency(state)
  })
})

describe('attack resolution — determinism', () => {
  it('two runs with the same seed and intent stream produce identical states', () => {
    const a = createGame(baseConfig({ seed: 'determ-1' }))
    const b = createGame(baseConfig({ seed: 'determ-1' }))

    const target = findNeutralBorderTile(a, 1)
    expect(target).toBeGreaterThanOrEqual(0)
    const attackIntent = {
      type: 'attack' as const,
      playerId: 1,
      targetTile: target,
      troops: 3_000,
    }

    tick(a, [attackIntent])
    tick(b, [attackIntent])

    for (let i = 0; i < 30; i++) {
      tick(a, [])
      tick(b, [])
    }

    for (let i = 0; i < a.map.state.length; i++) {
      expect(getOwner(a.map, i)).toBe(getOwner(b.map, i))
    }
    for (const id of [1, 2, 3, 4]) {
      expect(a.players.get(id)?.troops).toBe(b.players.get(id)?.troops)
      expect(a.players.get(id)?.tilesOwned).toBe(b.players.get(id)?.tilesOwned)
    }
  })
})

describe('attack resolution — end-to-end victory', () => {
  it('aggressive solo expansion eventually triggers victory', () => {
    const state = createGame(
      baseConfig({
        mapWidth: 32,
        mapHeight: 32,
        victoryPct: 50,
        seed: 'victory-test',
        players: [
          { id: 1, name: 'Solo', color: 0xff0000ff, isHuman: true },
          { id: 2, name: 'Dummy', color: 0x00ff00ff, isHuman: false },
        ],
      }),
    )

    const player = state.players.get(1)
    if (player === undefined) throw new Error('player missing')

    let ticks = 0
    const MAX_TICKS = 5000
    while (state.phase === 'running' && ticks < MAX_TICKS) {
      if (ticks % 5 === 0 && player.attacks.length < 3) {
        const target = findNeutralBorderTile(state, 1)
        if (target >= 0) {
          tick(state, [
            {
              type: 'attack',
              playerId: 1,
              targetTile: target,
              troops: Math.floor(player.troops * 0.3),
            },
          ])
        } else {
          tick(state, [])
        }
      } else {
        tick(state, [])
      }
      ticks++
    }

    expect(state.phase).toBe('ended')
    expect(state.winner).toBe(1)
    expect(ticks).toBeLessThan(MAX_TICKS)
  })
})
