import { describe, it, expect } from 'vitest'
import {
  CAPTURE_FADE_TICKS,
  buildCostFor,
  canBuildAt,
  createGame,
  effectiveMaxTroops,
  estimateBomberFlakDamage,
  FACTORY_FOREIGN_MULT,
  factoryYield,
  goldBreakdown,
  initializeAllFrontiers,
  isBuildingAllowed,
  snapBuildTile,
  tick,
  type GameConfig,
  type GameState,
} from '../src/core/game'
import {
  HUMAN_START_TROOPS,
  BOT_START_TROOPS,
  BASE_GOLD_PER_TICK,
  ATTACK_CANCEL_TICKS,
  troopIncreaseRate,
  maxTroops,
} from '../src/core/config'
import { BOMBER_HP, CART_GOLD_PER_LEVEL, planBomberRoute } from '../src/core/ships'
import { getOwner, setOwner } from '../src/world/map'
import { IS_LAND_BIT, isPassable, terrainMagnitude } from '../src/world/terrain'
import { tileRef, neighbors4 } from '../src/world/torus'
import { areAllied, directedKey, pairKey } from '../src/core/diplomacy'

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

  it('spawn blobs prefer lowland (Phase 4: Terrain formt Expansion)', () => {
    // Auf einer Höhen-variablen Karte sollte das beanspruchte Land im Schnitt
    // flacher sein als das Land insgesamt — die Spawn-Welle meidet Gebirge.
    const state = createGame(
      baseConfig({ terrain: 'continents', mapWidth: 128, mapHeight: 128, seed: 'lowland-spawn' }),
    )
    const { terrain } = state.map
    let landSum = 0
    let landN = 0
    let ownedSum = 0
    let ownedN = 0
    for (let i = 0; i < state.map.state.length; i++) {
      if (!isPassable(terrain, i)) continue
      const mag = terrainMagnitude(terrain, i)
      landSum += mag
      landN++
      if (getOwner(state.map, i) > 0) {
        ownedSum += mag
        ownedN++
      }
    }
    expect(ownedN).toBeGreaterThan(0)
    expect(ownedSum / ownedN).toBeLessThan(landSum / landN)
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

describe('tick — grudge (Groll)', () => {
  it('klingt pro Tick ab und wird unter dem Minimum vergessen', () => {
    const state = createGame(baseConfig())
    state.grudge.set(directedKey(2, 1), 100)
    tick(state, [])
    const after = state.grudge.get(directedKey(2, 1)) ?? 0
    expect(after).toBeGreaterThan(0)
    expect(after).toBeLessThan(100) // abgeklungen
    // viele Ticks → vollständig vergessen (Eintrag gelöscht)
    for (let i = 0; i < 600; i++) tick(state, [])
    expect(state.grudge.has(directedKey(2, 1))).toBe(false)
  })
})

describe('tick — Fabrik-Netzwerk-Wirtschaft', () => {
  it('Gold-Fuhre pendelt Stadt→Fabrik über Land und liefert Gold (ADR-0018)', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const W = state.map.width
    const H = state.map.height
    const p1 = state.players.get(1)
    if (p1 === undefined) throw new Error('player missing')
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)

    // Stadt + Fabrik auf benachbartem Eigenland (eine Land-Komponente → verbunden).
    const cityTile = tileRef(20, 20, W, H)
    const factoryTile = tileRef(21, 20, W, H)
    setOwner(state.map, cityTile, 1)
    setOwner(state.map, factoryTile, 1)
    state.buildings.set(cityTile, {
      type: 'city',
      ownerId: 1,
      tile: cityTile,
      level: 1,
      completesAtTick: 0,
    })
    state.buildings.set(factoryTile, {
      type: 'factory',
      ownerId: 1,
      tile: factoryTile,
      level: 1,
      completesAtTick: 0,
    })

    tick(state, []) // recompute (tick 0) erzeugt die Fuhre
    expect(state.goldCarts.some((c) => c.ownerId === 1)).toBe(true)

    // Über genug Ticks pendelt die Fuhre zur Fabrik und liefert wiederholt Gold (mehr als Sockel).
    p1.gold = 0
    for (let i = 0; i < 40; i++) tick(state, [])
    expect(p1.gold).toBeGreaterThan(BASE_GOLD_PER_TICK * 40)
  })

  it('isolierte Fabrik ohne verbundene Ziele bringt nur den Sockel', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const W = state.map.width
    const H = state.map.height
    const p1 = state.players.get(1)
    if (p1 === undefined) throw new Error('player missing')
    const factoryTile = tileRef(40, 40, W, H)
    state.buildings.set(factoryTile, {
      type: 'factory',
      ownerId: 1,
      tile: factoryTile,
      level: 1,
      completesAtTick: 0,
    })
    p1.gold = 0
    tick(state, [])
    expect(p1.gold).toBe(BASE_GOLD_PER_TICK)
  })

  it('goldBreakdown zeigt Fuhren-Einkommen + zählt Quellen als Ziele (ADR-0018)', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const W = state.map.width
    const H = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const cityTile = tileRef(20, 20, W, H)
    const portTile = tileRef(20, 22, W, H)
    const factoryTile = tileRef(21, 20, W, H)
    // Zusammenhängendes Eigenland, das Stadt, Hafen und Fabrik verbindet.
    for (const t of [cityTile, portTile, factoryTile, tileRef(20, 21, W, H)])
      setOwner(state.map, t, 1)
    for (const [tile, type] of [
      [cityTile, 'city'],
      [portTile, 'port'],
      [factoryTile, 'factory'],
    ] as const) {
      state.buildings.set(tile, { type, ownerId: 1, tile, level: 1, completesAtTick: 0 })
    }
    tick(state, []) // recompute erzeugt die Fuhren (Stadt + Hafen → Fabrik)
    const gb = goldBreakdown(state, 1)
    expect(gb.base).toBe(BASE_GOLD_PER_TICK)
    expect(gb.factories).toBe(1)
    expect(gb.dests).toBe(2) // zwei pendelnde Fuhren (Stadt + Hafen)
    expect(gb.factory).toBeGreaterThan(0) // geschätzte Fuhren-Rate
  })

  it('factoryYield gibt den Fuhren-Live-Beitrag EINER Fabrik (ADR-0018)', () => {
    const state = createGame(baseConfig({ terrain: 'flat', mapWidth: 96, mapHeight: 96 }))
    const W = state.map.width
    const H = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const T = (x: number, y: number): number => tileRef(x, y, W, H)

    // Eigene zusammenhängende Landinsel: Stadt + Hafen + Fabrik direkt benachbart.
    for (const [x, y] of [
      [10, 10],
      [11, 10],
      [10, 11],
    ] as const)
      setOwner(state.map, T(x, y), 1)
    const cityTile = T(10, 10)
    const factoryTile = T(11, 10)
    state.buildings.set(cityTile, {
      type: 'city',
      ownerId: 1,
      tile: cityTile,
      level: 1,
      completesAtTick: 0,
    })
    state.buildings.set(T(10, 11), {
      type: 'port',
      ownerId: 1,
      tile: T(10, 11),
      level: 1,
      completesAtTick: 0,
    })
    state.buildings.set(factoryTile, {
      type: 'factory',
      ownerId: 1,
      tile: factoryTile,
      level: 2,
      completesAtTick: 0,
    })

    tick(state, []) // recompute erzeugt die Fuhren Stadt→Fabrik und Hafen→Fabrik

    const y = factoryYield(state, factoryTile)
    // Zwei Quellen (Stadt + Hafen) pendeln zu dieser Fabrik → dests=2, positive Rate.
    expect(y).not.toBeNull()
    expect(y?.dests).toBe(2)
    expect(y?.goldPerTick ?? 0).toBeGreaterThan(0)
    // Nicht-Fabrik-Tile → null.
    expect(factoryYield(state, cityTile)).toBeNull()
  })

  it('goldEarned zählt nur Einnahmen — ein Kauf drückt es nicht', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const p = state.players.get(1)
    if (p === undefined) throw new Error('player missing')
    tick(state, []) // ein Tick Einkommen
    expect(p.goldEarned).toBeGreaterThan(0)
    expect(p.gold).toBe(p.goldEarned) // ohne Ausgaben identisch

    // Kauf: eine Stadt bauen (kostet Gold). goldEarned darf dabei NICHT fallen.
    p.gold = 30_000
    const earnedBefore = p.goldEarned
    const tile = findOwnedTile(state, 1)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'city' }])
    expect(p.gold).toBeLessThan(30_000) // Gold wurde ausgegeben
    expect(p.goldEarned).toBeGreaterThanOrEqual(earnedBefore) // Einkommen zählt weiter, Ausgabe nicht
  })

  it('allowedBuildings: ein deaktivierter Typ kann nicht gebaut werden, andere schon', () => {
    const state = createGame(baseConfig({ terrain: 'flat', allowedBuildings: { factory: false } }))
    const p = state.players.get(1)
    if (p === undefined) throw new Error('player missing')
    p.gold = 5_000_000
    const tile = findOwnedTile(state, 1)
    expect(tile).toBeGreaterThanOrEqual(0)

    // Fabrik verboten → canBuildAt lehnt ab, der Build-Intent bewirkt nichts.
    expect(isBuildingAllowed(state.config, 'factory')).toBe(false)
    expect(canBuildAt(state, 1, tile, 'factory')).toBe(false)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'factory' }])
    expect(state.buildings.get(tile)).toBeUndefined()

    // Stadt ist erlaubt (kein Eintrag) → baubar.
    expect(isBuildingAllowed(state.config, 'city')).toBe(true)
    expect(canBuildAt(state, 1, tile, 'city')).toBe(true)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'city' }])
    expect(state.buildings.get(tile)?.type).toBe('city')
  })

  it('allowedBuildings: fehlende Map → alles erlaubt (Default)', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    for (const type of ['city', 'defense', 'port', 'factory', 'airport', 'flak'] as const) {
      expect(isBuildingAllowed(state.config, type)).toBe(true)
    }
  })

  it('Flughafen + Flugabwehr: baubar auf eigenem Land, Kosten korrekt (ADR-0019)', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const p = state.players.get(1)
    if (p === undefined) throw new Error('player missing')
    p.gold = 5_000_000
    const tile = findOwnedTile(state, 1)
    expect(tile).toBeGreaterThanOrEqual(0)
    // Flughafen: kein Wasser-Bedarf, eigene Eskalations-Gruppe (erstes = 50k).
    expect(canBuildAt(state, 1, tile, 'airport')).toBe(true)
    expect(buildCostFor(state, 1, 'airport')).toBe(50_000)
    // Flugabwehr: flach wie Verteidigung (35k).
    expect(canBuildAt(state, 1, tile, 'flak')).toBe(true)
    expect(buildCostFor(state, 1, 'flak')).toBe(35_000)
    // Bauen klappt.
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'airport' }])
    expect(state.buildings.get(tile)?.type).toBe('airport')
  })

  it('Bombe: neutralisiert Gebiet, zerstört Gebäude und schmilzt Truppen (ADR-0019)', () => {
    const state = createGame(baseConfig({ terrain: 'flat', mapWidth: 96, mapHeight: 96 }))
    const W = state.map.width
    const H = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const T = (x: number, y: number): number => tileRef(x, y, W, H)
    const p1 = state.players.get(1)
    const p2 = state.players.get(2)
    if (p1 === undefined || p2 === undefined) throw new Error('players missing')

    // p1: ein fertiger Flughafen + reichlich Gold.
    const airport = T(10, 10)
    setOwner(state.map, airport, 1)
    state.buildings.set(airport, {
      type: 'airport',
      ownerId: 1,
      tile: airport,
      level: 1,
      completesAtTick: 0,
    })
    p1.gold = 1_000_000
    p1.tilesOwned = 1

    // p2: ein 7×7-Block um (40,10) mit einer Stadt im Zentrum.
    const target = T(40, 10)
    let n = 0
    for (let x = 37; x <= 43; x++)
      for (let y = 7; y <= 13; y++) {
        setOwner(state.map, T(x, y), 2)
        n++
      }
    state.buildings.set(target, {
      type: 'city',
      ownerId: 2,
      tile: target,
      level: 1,
      completesAtTick: 0,
    })
    p2.tilesOwned = n
    p2.troops = 4900
    initializeAllFrontiers(state)
    const troopsBefore = p2.troops

    // Bomber starten (direkte Route) und genug Ticks bis Einschlag + Rückflug.
    for (let i = 0; i < 40; i++)
      tick(
        state,
        i === 0
          ? [{ type: 'launch-bomber' as const, playerId: 1, targetTile: target, route: 'direct' }]
          : [],
      )

    expect(p1.gold).toBeLessThan(1_000_000) // Start wurde bezahlt (Munition)
    expect(getOwner(state.map, target)).toBe(0) // Zentrum neutralisiert
    expect(state.buildings.has(target)).toBe(false) // Stadt zerstört
    expect(p2.troops).toBeLessThan(troopsBefore) // Truppen geschmolzen
    expect(p2.tilesOwned).toBeLessThan(n) // Gebiet verloren
    expect(state.bombers.length).toBe(0) // Bomber nach Rückflug aufgelöst
  })

  it('Bombe: Groll + Verrat bei Verbündeten + versenkt Schiffe im Radius (ADR-0019)', () => {
    const state = createGame(baseConfig({ terrain: 'flat', mapWidth: 96, mapHeight: 96 }))
    const W = state.map.width
    const H = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const T = (x: number, y: number): number => tileRef(x, y, W, H)
    const p1 = state.players.get(1)
    const p2 = state.players.get(2)
    if (p1 === undefined || p2 === undefined) throw new Error('players missing')

    const airport = T(10, 10)
    setOwner(state.map, airport, 1)
    state.buildings.set(airport, {
      type: 'airport',
      ownerId: 1,
      tile: airport,
      level: 1,
      completesAtTick: 0,
    })
    p1.gold = 1_000_000
    p1.tilesOwned = 1

    const target = T(40, 10)
    let n = 0
    for (let x = 37; x <= 43; x++)
      for (let y = 7; y <= 13; y++) {
        setOwner(state.map, T(x, y), 2)
        n++
      }
    p2.tilesOwned = n
    p2.troops = 4900
    // p1 und p2 sind verbündet — die Bombe auf p2 ist damit Verrat.
    state.alliances.add(pairKey(1, 2))
    // Ein p2-Kriegsschiff genau am Zielpunkt (im Bomben-Radius).
    state.warships.push({
      ownerId: 2,
      path: [target],
      progress: 0,
      dir: 1,
      hp: 5,
      cooldown: 0,
      mode: 'patrol',
      returning: false,
    })
    initializeAllFrontiers(state)
    expect(areAllied(state.alliances, 1, 2)).toBe(true)

    for (let i = 0; i < 40; i++)
      tick(
        state,
        i === 0
          ? [{ type: 'launch-bomber' as const, playerId: 1, targetTile: target, route: 'direct' }]
          : [],
      )

    expect(state.grudge.get(directedKey(1, 2)) ?? 0).toBeGreaterThan(0) // Opfer grollt
    expect(areAllied(state.alliances, 1, 2)).toBe(false) // Bombe auf Verbündeten = Verrat
    expect(state.warships.length).toBe(0) // Kriegsschiff im Radius versenkt
  })

  it('Flak: schießt einen durchfliegenden feindlichen Bomber ab (kein Einschlag) (ADR-0019)', () => {
    // Map breit genug, dass der direkte Weg (50) kürzer als der Torus-Wrap ist → Flugbahn quert x=35.
    const state = createGame(baseConfig({ terrain: 'flat', mapWidth: 128, mapHeight: 128 }))
    const W = state.map.width
    const H = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const T = (x: number, y: number): number => tileRef(x, y, W, H)
    const p1 = state.players.get(1)
    const p2 = state.players.get(2)
    if (p1 === undefined || p2 === undefined) throw new Error('players missing')

    // p1: Flughafen bei (10,10).
    const airport = T(10, 10)
    setOwner(state.map, airport, 1)
    state.buildings.set(airport, {
      type: 'airport',
      ownerId: 1,
      tile: airport,
      level: 1,
      completesAtTick: 0,
    })
    p1.gold = 1_000_000
    p1.tilesOwned = 1

    // p2: Ziel-Stadt weit hinten + eine Flak-Wand quer über den direkten Flugweg (y≈10).
    const targetCity = T(60, 10)
    setOwner(state.map, targetCity, 2)
    state.buildings.set(targetCity, {
      type: 'city',
      ownerId: 2,
      tile: targetCity,
      level: 1,
      completesAtTick: 0,
    })
    p2.tilesOwned = 1
    p2.troops = 1000
    // Fünf Flak-Türme bei x=35 → ein 4-HP-Bomber wird sicher runtergeholt.
    for (let y = 6; y <= 14; y += 2) {
      const ft = T(35, y)
      setOwner(state.map, ft, 2)
      state.buildings.set(ft, { type: 'flak', ownerId: 2, tile: ft, level: 1, completesAtTick: 0 })
    }
    initializeAllFrontiers(state)

    for (let i = 0; i < 40; i++)
      tick(
        state,
        i === 0
          ? [
              {
                type: 'launch-bomber' as const,
                playerId: 1,
                targetTile: targetCity,
                route: 'direct',
              },
            ]
          : [],
      )

    expect(state.bombers.length).toBe(0) // abgeschossen + entfernt
    expect(state.buildings.has(targetCity)).toBe(true) // kein Einschlag → Stadt steht
    expect(getOwner(state.map, targetCity)).toBe(2) // Gebiet unversehrt
  })

  it('estimateBomberFlakDamage: Flak-Wand auf der Route übersteigt Bomber-HP (Warnung) (ADR-0019)', () => {
    const state = createGame(baseConfig({ terrain: 'flat', mapWidth: 128, mapHeight: 128 }))
    const W = state.map.width
    const H = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const T = (x: number, y: number): number => tileRef(x, y, W, H)
    // Gegnerische Flak-Wand bei x=35.
    for (let y = 6; y <= 14; y += 2) {
      const ft = T(35, y)
      setOwner(state.map, ft, 2)
      state.buildings.set(ft, { type: 'flak', ownerId: 2, tile: ft, level: 1, completesAtTick: 0 })
    }
    // Route quer durch die Wand → geschätzter Schaden übersteigt die Bomber-HP (Warnung greift).
    const deadly = planBomberRoute(W, H, T(10, 10), T(60, 10), 'direct')
    expect(estimateBomberFlakDamage(state, 1, deadly)).toBeGreaterThanOrEqual(BOMBER_HP)
    // Route weit weg von jeder Flak → kein Schaden.
    const safe = planBomberRoute(W, H, T(10, 100), T(60, 100), 'direct')
    expect(estimateBomberFlakDamage(state, 1, safe)).toBe(0)
    // Eigene Flak zählt nicht gegen den eigenen Bomber.
    expect(estimateBomberFlakDamage(state, 2, deadly)).toBe(0)
  })

  it('Auslands-Gold zählt nur fremde Fabriken — eine fremde Stadt bringt keins (aber Gunst bleibt)', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const W = state.map.width
    const H = state.map.height
    const factoryTile = tileRef(20, 20, W, H) // Spieler 1
    const cityTile = tileRef(22, 20, W, H) // Spieler 2, in Reichweite (Distanz 2)
    state.buildings.set(factoryTile, {
      type: 'factory',
      ownerId: 1,
      tile: factoryTile,
      level: 1,
      completesAtTick: 0,
    })
    state.buildings.set(cityTile, {
      type: 'city',
      ownerId: 2,
      tile: cityTile,
      level: 1,
      completesAtTick: 0,
    })
    // ADR-0018: eine fremde STADT zählt NICHT mehr fürs Auslands-Gold (nur fremde Fabriken).
    const gb = goldBreakdown(state, 1)
    expect(gb.dests).toBe(0)
    expect(gb.factory).toBe(0)
    expect(factoryYield(state, factoryTile)?.goldPerTick).toBe(0)
    // Gunst aus Fabrik-Nachbarschaft bleibt (separates Beziehungs-Feature, ADR-0013).
    for (let i = 0; i < 31; i++) tick(state, [])
    expect(state.goodwill.get(directedKey(1, 2)) ?? 0).toBeGreaterThan(0)
    expect(state.goodwill.get(directedKey(2, 1)) ?? 0).toBeGreaterThan(0)
  })

  it('Fabrik schickt eine Auslands-Fuhre zur fremden Fabrik (3× Gold + Gunst) (ADR-0019)', () => {
    const state = createGame(baseConfig({ terrain: 'flat', mapWidth: 96, mapHeight: 96 }))
    const W = state.map.width
    const H = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const T = (x: number, y: number): number => tileRef(x, y, W, H)
    const myFactory = T(20, 20)
    const theirFactory = T(24, 20)
    // Land-Band zwischen den Fabriken (p2 dazwischen) → über Land erreichbar.
    setOwner(state.map, myFactory, 1)
    for (let x = 21; x <= 23; x++) setOwner(state.map, T(x, 20), 2)
    setOwner(state.map, theirFactory, 2)
    state.buildings.set(myFactory, {
      type: 'factory',
      ownerId: 1,
      tile: myFactory,
      level: 1,
      completesAtTick: 0,
    })
    state.buildings.set(theirFactory, {
      type: 'factory',
      ownerId: 2,
      tile: theirFactory,
      level: 1,
      completesAtTick: 0,
    })
    initializeAllFrontiers(state)

    tick(state, []) // recompute erzeugt die Auslands-Fuhren
    // p1 schickt eine Fuhre von der eigenen zur fremden Fabrik mit 3×-Gold.
    const cart = state.goldCarts.find(
      (c) => c.ownerId === 1 && c.sourceTile === myFactory && c.factoryTile === theirFactory,
    )
    expect(cart).toBeDefined()
    expect(cart?.gold).toBe(FACTORY_FOREIGN_MULT * CART_GOLD_PER_LEVEL)
    // p2 spiegelbildlich (eigene Auslands-Fuhre zurück).
    expect(state.goldCarts.some((c) => c.ownerId === 2 && c.sourceTile === theirFactory)).toBe(true)
    // Gunst entsteht beidseitig (Fabrik-Nachbarschaft).
    for (let i = 0; i < 31; i++) tick(state, [])
    expect(state.goodwill.get(directedKey(1, 2)) ?? 0).toBeGreaterThan(0)
  })

  it('Nähe-Vorteil: eine nahe Stadt bringt mehr Fuhren-Gold/Zeit als eine ferne (ADR-0018)', () => {
    const state = createGame(baseConfig({ terrain: 'flat', mapWidth: 96, mapHeight: 96 }))
    const W = state.map.width
    const H = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const T = (x: number, y: number): number => tileRef(x, y, W, H)

    // p1: Stadt direkt neben der Fabrik (kurzer Pendel-Weg).
    setOwner(state.map, T(10, 10), 1)
    setOwner(state.map, T(11, 10), 1)
    state.buildings.set(T(10, 10), {
      type: 'city',
      ownerId: 1,
      tile: T(10, 10),
      level: 1,
      completesAtTick: 0,
    })
    state.buildings.set(T(11, 10), {
      type: 'factory',
      ownerId: 1,
      tile: T(11, 10),
      level: 1,
      completesAtTick: 0,
    })

    // p2: Stadt weit von der Fabrik, über ein langes Land-Band verbunden (langer Pendel-Weg).
    for (let x = 10; x <= 24; x++) setOwner(state.map, T(x, 30), 2)
    state.buildings.set(T(10, 30), {
      type: 'city',
      ownerId: 2,
      tile: T(10, 30),
      level: 1,
      completesAtTick: 0,
    })
    state.buildings.set(T(24, 30), {
      type: 'factory',
      ownerId: 2,
      tile: T(24, 30),
      level: 1,
      completesAtTick: 0,
    })

    tick(state, []) // recompute erzeugt beide Fuhren
    expect(state.goldCarts.some((c) => c.ownerId === 1)).toBe(true)
    expect(state.goldCarts.some((c) => c.ownerId === 2)).toBe(true)
    // Gleiche Gebäude, nur Distanz unterschiedlich → die nahe Quelle liefert mehr Gold/Zeit.
    expect(goldBreakdown(state, 1).factory).toBeGreaterThan(goldBreakdown(state, 2).factory)
  })

  it('Auslands-Fuhren je Fabrik sind gedeckelt (kein unendliches Stapeln) (ADR-0019)', () => {
    const state = createGame(baseConfig({ terrain: 'flat', mapWidth: 96, mapHeight: 96 }))
    const W = state.map.width
    const H = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const T = (x: number, y: number): number => tileRef(x, y, W, H)
    const factoryTile = T(20, 20)
    setOwner(state.map, factoryTile, 1)
    state.buildings.set(factoryTile, {
      type: 'factory',
      ownerId: 1,
      tile: factoryTile,
      level: 1,
      completesAtTick: 0,
    })
    // 8 fremde Fabriken rundum in Reichweite, über Land erreichbar — mehr als der Deckel.
    for (let k = 0; k < 8; k++) {
      const t = T(21, 20 + k)
      setOwner(state.map, t, 2)
      state.buildings.set(t, { type: 'factory', ownerId: 2, tile: t, level: 1, completesAtTick: 0 })
    }
    initializeAllFrontiers(state)
    tick(state, []) // recompute erzeugt die Auslands-Fuhren
    // Nur FACTORY_FOREIGN_CAP Fuhren gehen von der Fabrik aus — nicht 8.
    const outbound = state.goldCarts.filter((c) => c.ownerId === 1 && c.sourceTile === factoryTile)
    expect(outbound.length).toBe(2)
    expect(factoryYield(state, factoryTile)?.dests).toBe(2)
  })

  it('Bündnis-Bildung bricht laufende Angriffe zwischen den Partnern ab', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const p1 = state.players.get(1)
    if (p1 === undefined) throw new Error('player missing')
    p1.troops = 1000
    p1.attacks = [
      { targetPlayerId: 2, reserveTroops: 500, focusTile: 0, frontTile: 0, startTick: 0 },
    ]
    state.allianceRequests.add(directedKey(2, 1)) // Spieler 2 hat 1 ein Bündnis angeboten
    tick(state, [{ type: 'accept-alliance', playerId: 1, targetPlayerId: 2 }])
    expect(areAllied(state.alliances, 1, 2)).toBe(true)
    expect(p1.attacks.some((a) => a.targetPlayerId === 2)).toBe(false) // Angriff abgebrochen
  })

  it('Angriff auf einen Verbündeten gilt als Verrat (Bündnis bricht + Ächtung)', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const W = state.map.width
    const H = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    for (const p of state.players.values()) {
      p.tilesOwned = 0
      p.frontier = new Set<number>()
    }
    const t1 = tileRef(10, 10, W, H)
    const t2 = tileRef(11, 10, W, H)
    const p1 = state.players.get(1)
    const p2 = state.players.get(2)
    if (p1 === undefined || p2 === undefined) throw new Error('player missing')
    setOwner(state.map, t1, 1)
    p1.tilesOwned = 1
    p1.frontier.add(t1)
    setOwner(state.map, t2, 2)
    p2.tilesOwned = 1
    p2.frontier.add(t2)
    p1.troops = 1000
    state.alliances.add(pairKey(1, 2))
    state.allianceExpiry.set(pairKey(1, 2), 99999)
    tick(state, [{ type: 'attack', playerId: 1, targetTile: t2, troops: 500 }])
    expect(areAllied(state.alliances, 1, 2)).toBe(false) // Bündnis gebrochen
    expect(p1.traitorUntil).toBeGreaterThan(state.tick) // Angreifer geächtet
  })

  it('snapBuildTile rastet auf ein nahes eigenes Gebäude gleichen Typs', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const W = state.map.width
    const H = state.map.height
    const cityTile = tileRef(20, 20, W, H)
    state.buildings.set(cityTile, {
      type: 'city',
      ownerId: 1,
      tile: cityTile,
      level: 1,
      completesAtTick: 0,
    })
    // Cursor 2 Tiles daneben, gleicher Typ → rastet auf die Stadt.
    expect(snapBuildTile(state, 1, tileRef(22, 20, W, H), 'city')).toBe(cityTile)
    // Weiter weg → kein Snap (Original-Tile).
    const far = tileRef(30, 20, W, H)
    expect(snapBuildTile(state, 1, far, 'city')).toBe(far)
    // Anderer Typ → kein Snap.
    const near = tileRef(21, 20, W, H)
    expect(snapBuildTile(state, 1, near, 'port')).toBe(near)
    // Fremdes Gebäude (anderer Besitzer) → kein Snap.
    expect(snapBuildTile(state, 2, tileRef(22, 20, W, H), 'city')).toBe(tileRef(22, 20, W, H))
  })
})

describe('wilde Nationen', () => {
  it('werden mit wild-Flag erzeugt und haben einen niedrigeren Truppen-Cap', () => {
    const state = createGame(
      baseConfig({
        terrain: 'flat',
        players: [
          { id: 1, name: 'KI', color: 0xff0000ff, isHuman: false },
          { id: 2, name: 'Wilde', color: 0x8f8a78ff, isHuman: false, wild: true },
        ],
      }),
    )
    const ai = state.players.get(1)
    const wild = state.players.get(2)
    if (ai === undefined || wild === undefined) throw new Error('players missing')
    expect(ai.wild).toBe(false)
    expect(wild.wild).toBe(true)
    // Gleiche Gebietsbasis → wilde Nation hat einen deutlich niedrigeren Cap (dünn besiedelt).
    ai.weightedTiles = 100
    wild.weightedTiles = 100
    expect(effectiveMaxTroops(state, 2)).toBe(Math.floor(effectiveMaxTroops(state, 1) * 0.38))
    expect(effectiveMaxTroops(state, 2)).toBeLessThan(effectiveMaxTroops(state, 1))
  })

  it('starten kleiner als reguläre Spieler (Puffer/Beute)', () => {
    const state = createGame(
      baseConfig({
        terrain: 'flat',
        mapWidth: 128,
        mapHeight: 128,
        players: [
          { id: 1, name: 'KI', color: 0xff0000ff, isHuman: false },
          { id: 2, name: 'Wilde', color: 0x8f8a78ff, isHuman: false, wild: true },
        ],
      }),
    )
    const ai = state.players.get(1)
    const wild = state.players.get(2)
    if (ai === undefined || wild === undefined) throw new Error('players missing')
    expect(wild.tilesOwned).toBeLessThanOrEqual(48)
    expect(wild.tilesOwned).toBeLessThan(ai.tilesOwned)
  })

  it('eingeschlossene wilde Nation wird sofort annektiert (samt Gold-Beute)', () => {
    const state = createGame(
      baseConfig({
        terrain: 'flat',
        mapWidth: 64,
        mapHeight: 64,
        players: [
          { id: 1, name: 'Du', color: 0x00ff00ff, isHuman: true },
          { id: 2, name: 'Wilde', color: 0x8f8a78ff, isHuman: false, wild: true },
        ],
      }),
    )
    const W = state.map.width
    const Hgt = state.map.height
    const p1 = state.players.get(1)
    const wild = state.players.get(2)
    if (p1 === undefined || wild === undefined) throw new Error('players missing')
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    for (const p of state.players.values()) {
      p.tilesOwned = 0
      p.frontier = new Set<number>()
      p.attacks = []
    }
    const T = (x: number, y: number): number => tileRef(x, y, W, Hgt)
    const center = T(10, 10)
    // Spieler 1 umschließt das einzelne wilde Tile vollständig (alle 4 Nachbarn).
    for (const t of [T(9, 10), T(11, 10), T(10, 9), T(10, 11)]) {
      setOwner(state.map, t, 1)
      p1.tilesOwned++
      p1.frontier.add(t)
    }
    setOwner(state.map, center, 2)
    wild.tilesOwned = 1
    wild.frontier.add(center)
    wild.gold = 1000
    const goldBefore = p1.gold

    tick(state, []) // tick 0 → Encircle-Check läuft (Intervall-Vielfaches)

    expect(getOwner(state.map, center)).toBe(1) // Gebiet übernommen
    expect(wild.tilesOwned).toBe(0)
    expect(wild.isAlive).toBe(false) // ohne Gebiet eliminiert
    expect(p1.gold - goldBefore).toBeGreaterThanOrEqual(1000) // Beute erhalten
  })

  it('produzieren nur halbes Gold pro Tick', () => {
    const state = createGame(
      baseConfig({
        terrain: 'flat',
        players: [
          { id: 1, name: 'KI', color: 0xff0000ff, isHuman: false },
          { id: 2, name: 'Wilde', color: 0x8f8a78ff, isHuman: false, wild: true },
        ],
      }),
    )
    const ai = state.players.get(1)
    const wild = state.players.get(2)
    if (ai === undefined || wild === undefined) throw new Error('players missing')
    ai.gold = 0
    wild.gold = 0
    tick(state, [])
    // Beide nur Grund-Gold (keine Fabriken); Wilde bekommen die Hälfte.
    expect(ai.gold).toBe(BASE_GOLD_PER_TICK)
    expect(wild.gold).toBe(Math.floor(BASE_GOLD_PER_TICK * 0.5))
  })
})

describe('Gold-Beute bei Eroberung', () => {
  it('erbeutet beim Erobern den Pro-Tile-Gold-Anteil des Verteidigers', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const W = state.map.width
    const Hgt = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const p1 = state.players.get(1) // Angreifer
    const p2 = state.players.get(2) // Verteidiger
    if (p1 === undefined || p2 === undefined) throw new Error('players missing')
    for (const p of state.players.values()) {
      p.tilesOwned = 0
      p.frontier = new Set<number>()
      p.attacks = []
      p.troops = 0
      p.gold = 0
    }
    const T = (x: number, y: number): number => tileRef(x, y, W, Hgt)
    // p1 (Angreifer) neben p2 (Verteidiger, 2 Tiles, 1000 Gold → 500/Tile).
    setOwner(state.map, T(5, 5), 1)
    p1.tilesOwned = 1
    p1.frontier.add(T(5, 5))
    setOwner(state.map, T(6, 5), 2)
    setOwner(state.map, T(7, 5), 2)
    p2.tilesOwned = 2
    p2.frontier.add(T(6, 5))
    p2.frontier.add(T(7, 5))
    p1.troops = 50_000 // klare Übermacht → erobert
    p2.troops = 100
    p2.gold = 1000
    for (let i = 0; i < 30 && p2.tilesOwned > 0; i++)
      tick(state, [{ type: 'attack', playerId: 1, targetTile: T(6, 5), troops: 40_000 }])
    // p2 wurde überrannt; sein Gold ist (großteils) zu p1 gewandert.
    expect(p1.gold).toBeGreaterThan(0)
    expect(p2.gold).toBeLessThan(1000)
  })
})

describe('Bündnis ablehnen', () => {
  it('decline-alliance verwirft die eingehende Anfrage ohne Bündnis', () => {
    const state = createGame(baseConfig())
    // p2 bietet p1 ein Bündnis an.
    tick(state, [{ type: 'request-alliance', playerId: 2, targetPlayerId: 1 }])
    expect(state.allianceRequests.has(directedKey(2, 1))).toBe(true)
    // p1 lehnt ab → Anfrage weg, kein Bündnis.
    tick(state, [{ type: 'decline-alliance', playerId: 1, requesterId: 2 }])
    expect(state.allianceRequests.has(directedKey(2, 1))).toBe(false)
    expect(state.alliances.size).toBe(0)
  })
})

describe('Bauen auf eigenem Gebäude = Upgrade', () => {
  it('ein Bau-Intent auf ein eigenes gleiches Gebäude upgradet es (statt Neubau)', () => {
    const state = createGame(baseConfig())
    const p = state.players.get(1)
    if (p === undefined) throw new Error('player missing')
    p.gold = 500_000
    const tile = findOwnedTile(state, 1)
    expect(tile).toBeGreaterThanOrEqual(0)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'city' }])
    expect(state.buildings.get(tile)?.level).toBe(1)
    // Gleicher Typ aufs gleiche Tile → Upgrade auf Level 2.
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'city' }])
    expect(state.buildings.get(tile)?.level).toBe(2)
  })
})

describe('Rundum-Ausbreitung (omni)', () => {
  it('expandiert gleichzeitig in alle Richtungen', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const W = state.map.width
    const Hgt = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const p1 = state.players.get(1)
    if (p1 === undefined) throw new Error('player missing')
    for (const p of state.players.values()) {
      p.tilesOwned = 0
      p.frontier = new Set<number>()
      p.attacks = []
      p.troops = 0
    }
    const center = tileRef(32, 32, W, Hgt)
    setOwner(state.map, center, 1)
    p1.tilesOwned = 1
    p1.frontier.add(center)
    p1.troops = 5000
    tick(state, [{ type: 'attack', playerId: 1, targetTile: center, troops: 4000, omni: true }])
    for (let i = 0; i < 12 && p1.attacks.length > 0; i++) tick(state, [])
    // In alle vier Richtungen gewachsen.
    for (const nb of neighbors4(center, W, Hgt)) {
      expect(getOwner(state.map, nb)).toBe(1)
    }
  })

  it('greift eine Nation entlang der ganzen Grenze an (kein Fokus aufs Klick-Tile)', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const W = state.map.width
    const Hgt = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const p1 = state.players.get(1)
    const p2 = state.players.get(2)
    if (p1 === undefined || p2 === undefined) throw new Error('players missing')
    for (const p of state.players.values()) {
      p.tilesOwned = 0
      p.frontier = new Set<number>()
      p.attacks = []
      p.troops = 0
    }
    const T = (x: number, y: number): number => tileRef(x, y, W, Hgt)
    const claim = (t: number, id: number, p: typeof p1): void => {
      setOwner(state.map, t, id)
      p.tilesOwned++
      p.frontier.add(t)
    }
    // p2 als vertikale Linie; p1 grenzt links an jede p2-Zelle → gemeinsame Grenze über
    // drei Reihen. Der omni-Klick zielt auf die MITTE — ohne Fokus müssen auch die
    // Enden (oben/unten) fallen.
    claim(T(10, 9), 2, p2)
    claim(T(10, 10), 2, p2)
    claim(T(10, 11), 2, p2)
    claim(T(9, 9), 1, p1)
    claim(T(9, 10), 1, p1)
    claim(T(9, 11), 1, p1)
    p1.troops = 20_000
    p2.troops = 30
    tick(state, [
      { type: 'attack', playerId: 1, targetTile: T(10, 10), troops: 15_000, omni: true },
    ])
    // Angriff richtet sich gegen p2 und ist als omni markiert.
    expect(p1.attacks[0]?.targetPlayerId).toBe(2)
    expect(p1.attacks[0]?.omni).toBe(true)
    for (let i = 0; i < 10 && p1.attacks.length > 0; i++) tick(state, [])
    // Beide Enden der Grenze (weit weg vom Klick-Tile) wurden erobert.
    expect(getOwner(state.map, T(10, 9))).toBe(1)
    expect(getOwner(state.map, T(10, 11))).toBe(1)
  })
})

describe('Angriff abbrechen (Wind-down)', () => {
  /** Bereitet ein Spiel mit p1 (1 Tile) + angrenzendem neutralen Ziel und einem laufenden Angriff vor. */
  function setupCancelGame(reserve: number): {
    state: GameState
    p1: NonNullable<ReturnType<GameState['players']['get']>>
    target: number
  } {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const W = state.map.width
    const Hgt = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const p1 = state.players.get(1)
    if (p1 === undefined) throw new Error('player missing')
    for (const p of state.players.values()) {
      p.tilesOwned = 0
      p.frontier = new Set<number>()
      p.attacks = []
      p.troops = 0
    }
    const center = tileRef(5, 5, W, Hgt)
    const target = tileRef(6, 5, W, Hgt) // angrenzendes neutrales Ziel
    setOwner(state.map, center, 1)
    p1.tilesOwned = 1
    p1.frontier.add(center)
    p1.attacks.push({
      targetPlayerId: 0,
      reserveTroops: reserve,
      focusTile: target,
      frontTile: target,
      startTick: 0,
    })
    return { state, p1, target }
  }

  it('hält den Vormarsch sofort an und zieht die Reserve über die Zeit zurück', () => {
    const { state, p1, target } = setupCancelGame(2000)
    tick(state, [{ type: 'cancel-attack', playerId: 1, attackIndex: 0 }])
    // Angriff läuft noch, ist aber als abbrechend markiert; Reserve sinkt bereits.
    expect(p1.attacks.length).toBe(1)
    expect(p1.attacks[0]?.cancelStartTick).toBeDefined()
    expect(p1.attacks[0]?.reserveTroops).toBeLessThan(2000)
    // Während des Abbruchs wird nichts mehr erobert.
    expect(getOwner(state.map, target)).toBe(0)
    // Nach Ablauf der Frist ist der Angriff weg und das Ziel weiterhin neutral.
    for (let i = 0; i < ATTACK_CANCEL_TICKS + 2 && p1.attacks.length > 0; i++) tick(state, [])
    expect(p1.attacks.length).toBe(0)
    expect(getOwner(state.map, target)).toBe(0)
    // Die zurückgezogenen Truppen sind (mindestens) wieder im Pool.
    expect(p1.troops).toBeGreaterThanOrEqual(2000)
  })

  it('beendet bei zweitem Abbruch-Befehl sofort', () => {
    const { state, p1 } = setupCancelGame(2000)
    tick(state, [{ type: 'cancel-attack', playerId: 1, attackIndex: 0 }])
    expect(p1.attacks.length).toBe(1)
    tick(state, [{ type: 'cancel-attack', playerId: 1, attackIndex: 0 }])
    expect(p1.attacks.length).toBe(0)
    expect(p1.troops).toBeGreaterThanOrEqual(2000)
  })
})

describe('Abwehr (1:1 gegen eingehenden Angriff)', () => {
  it('reduziert eingehende Reserve und eigene Truppen um denselben Betrag', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const W = state.map.width
    const Hgt = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const p1 = state.players.get(1) // Verteidiger
    const p2 = state.players.get(2) // Angreifer
    if (p1 === undefined || p2 === undefined) throw new Error('players missing')
    for (const p of state.players.values()) {
      p.tilesOwned = 0
      p.frontier = new Set<number>()
      p.attacks = []
      p.troops = 0
    }
    const t1 = tileRef(5, 5, W, Hgt)
    const t2 = tileRef(20, 20, W, Hgt) // bewusst NICHT angrenzend → kein Vormarsch
    setOwner(state.map, t1, 1)
    setOwner(state.map, t2, 2)
    p1.tilesOwned = 1
    p1.frontier.add(t1)
    p2.tilesOwned = 1
    p2.frontier.add(t2)
    // p2 hat einen eingehenden Angriff auf p1 mit 1000 Reserve.
    p2.attacks.push({
      targetPlayerId: 1,
      reserveTroops: 1000,
      focusTile: t1,
      frontTile: t1,
      startTick: 0,
    })
    p1.troops = 600
    p2.troops = 0
    tick(state, [{ type: 'defend', playerId: 1, attackerId: 2, troops: 400 }])
    // Abwehr opfert 400 = min(400, 600, 1000). p1 verliert 400 (+ winziges Wachstum).
    expect(p1.troops).toBeGreaterThanOrEqual(200)
    expect(p1.troops).toBeLessThan(300)
    // Der Angriff hat keine Front (Angreifer nicht angrenzend) → Rest-Reserve fließt zu p2
    // zurück. Dass p2 ~600 (statt 1000) zurückbekommt, beweist: die Abwehr nahm 400 weg.
    expect(p2.attacks.length).toBe(0)
    expect(p2.troops).toBeGreaterThanOrEqual(600)
    expect(p2.troops).toBeLessThan(1000)
  })

  it('deckelt auf die kleinste der drei Größen und ist no-op ohne eingehenden Angriff', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const p1 = state.players.get(1)
    const p2 = state.players.get(2)
    if (p1 === undefined || p2 === undefined) throw new Error('players missing')
    p2.attacks = []
    p1.troops = 500
    const before = p1.troops
    // Kein eingehender Angriff von p2 → no-op (Truppen unverändert, abzgl. Wachstum).
    tick(state, [{ type: 'defend', playerId: 1, attackerId: 2, troops: 300 }])
    expect(p1.troops).toBeGreaterThanOrEqual(before)
  })
})

describe('eingeschlossene Taschen (keine Blasen)', () => {
  it('eine vom Angreifer umzingelte neutrale Tasche fällt frei', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const W = state.map.width
    const Hgt = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const p1 = state.players.get(1)
    const p2 = state.players.get(2)
    if (p1 === undefined || p2 === undefined) throw new Error('players missing')
    for (const p of state.players.values()) {
      p.tilesOwned = 0
      p.frontier = new Set<number>()
      p.attacks = []
      p.troops = 0
    }
    const T = (x: number, y: number): number => tileRef(x, y, W, Hgt)
    const claim = (t: number, id: number, p: typeof p1): void => {
      setOwner(state.map, t, id)
      p.tilesOwned++
      p.frontier.add(t)
    }
    const pocket = T(4, 4) // bleibt neutral
    claim(T(4, 3), 1, p1) // N
    claim(T(4, 5), 1, p1) // S
    claim(T(5, 4), 1, p1) // O
    claim(T(3, 3), 1, p1) // grenzt an W
    claim(T(3, 4), 2, p2) // W — einziges p2-Tile
    p1.troops = 5000
    p2.troops = 0
    tick(state, [{ type: 'attack', playerId: 1, targetTile: T(3, 4), troops: 4000 }])
    // p1 erobert W; die neutrale Tasche (4,4) wird dadurch umzingelt → fällt frei.
    expect(getOwner(state.map, T(3, 4))).toBe(1)
    expect(getOwner(state.map, pocket)).toBe(1)
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

  it('multiple attacks on the same target merge into one', () => {
    const state = createGame(baseConfig())
    const player = state.players.get(1)
    if (player === undefined) throw new Error('player missing')
    player.troops = 20_000
    const targetTile = adjacentNeutralTile(state, 1)
    expect(targetTile).toBeGreaterThanOrEqual(0)
    tick(state, [
      { type: 'attack', playerId: 1, targetTile, troops: 3_000 },
      { type: 'attack', playerId: 1, targetTile, troops: 4_000 },
    ])
    // Beide Klicks auf dieselbe Front → genau EIN gebündelter Angriff, nicht zwei.
    const onTarget = player.attacks.filter((a) => a.targetPlayerId === 0)
    expect(onTarget.length).toBe(1)
  })

  it('mutual attacks cancel 1:1 (collision)', () => {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    const W = state.map.width
    const Hgt = state.map.height
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    const p1 = state.players.get(1)
    const p2 = state.players.get(2)
    if (p1 === undefined || p2 === undefined) throw new Error('players missing')
    for (const p of state.players.values()) {
      p.tilesOwned = 0
      p.frontier = new Set<number>()
      p.attacks = []
      p.troops = 0
      p.weightedTiles = 0
    }
    const claim = (x: number, y: number, id: number, p: typeof p1): number => {
      const r = tileRef(x, y, W, Hgt)
      setOwner(state.map, r, id)
      p.tilesOwned++
      p.frontier.add(r)
      return r
    }
    for (let x = 10; x <= 12; x++) claim(x, 10, 1, p1)
    for (let x = 13; x <= 15; x++) claim(x, 10, 2, p2)
    const t13 = tileRef(13, 10, W, Hgt)
    const t12 = tileRef(12, 10, W, Hgt)
    p1.attacks.push({
      targetPlayerId: 2,
      reserveTroops: 2000,
      focusTile: t13,
      frontTile: t13,
      startTick: 0,
    })
    p2.attacks.push({
      targetPlayerId: 1,
      reserveTroops: 2000,
      focusTile: t12,
      frontTile: t12,
      startTick: 0,
    })
    tick(state, [])
    // Gleich starke gegenseitige Angriffe heben sich komplett auf → beide verschwinden.
    expect(p1.attacks.length).toBe(0)
    expect(p2.attacks.length).toBe(0)
  })

  it('records recently captured tiles and prunes them after the flash lifetime', () => {
    const state = createGame(baseConfig())
    const player = state.players.get(1)
    if (player === undefined) throw new Error('player missing')
    player.troops = 20_000
    const targetTile = adjacentNeutralTile(state, 1)
    expect(targetTile).toBeGreaterThanOrEqual(0)
    tick(state, [{ type: 'attack', playerId: 1, targetTile, troops: 10_000 }])
    // Frisch eroberte Tiles sind für das Aufleuchten vermerkt.
    expect(state.recentCaptures.size).toBeGreaterThan(0)
    // Keine neuen Eroberungen → nach der Flash-Lebensdauer sind alle wieder weg.
    player.attacks = []
    for (let i = 0; i <= CAPTURE_FADE_TICKS; i++) tick(state, [])
    expect(state.recentCaptures.size).toBe(0)
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

  it('cancel-attack zieht die Reserve über die Zeit zurück und entfernt den Angriff', () => {
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
    // Sanftes Zurückziehen: der Angriff bleibt zunächst (als abbrechend markiert) …
    expect(player.attacks).toHaveLength(1)
    expect(player.attacks[0]?.cancelStartTick).toBeDefined()
    // … und löst sich erst über ATTACK_CANCEL_TICKS auf; die Reserve fließt komplett zurück.
    for (let i = 0; i < ATTACK_CANCEL_TICKS + 2 && player.attacks.length > 0; i++) tick(state, [])
    expect(player.attacks).toHaveLength(0)
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
    player.attacks.push({
      targetPlayerId: 2,
      reserveTroops: 500,
      focusTile: 0,
      frontTile: 0,
      startTick: 0,
    })
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

describe('Anti-Zersplitterung: eingeschlossene Fragmente (ADR-0017)', () => {
  const W = 64
  const Hgt = 64
  const T = (x: number, y: number): number => tileRef(x, y, W, Hgt)

  /**
   * Flache Welt: p1 umschließt das p2-Tile (5,5) im 3×3-Block bis auf das Wildnis-Loch (5,6),
   * an das p1 über (4,6)/(6,6) grenzt. Ein p1-Angriff auf (5,6) schließt (5,5) dann ein.
   */
  function setupEnclosed(opts: {
    p1Troops: number // aktuelle Truppen, nur damit p1 das Loch erobern kann
    p1Weighted?: number // weightedTiles → effektiver Cap (Regel-2-Vergleich)
    p2Weighted?: number
    extraP2?: ReadonlyArray<readonly [number, number]>
    allied?: boolean
    thirdEncloser?: boolean
  }): GameState {
    const state = createGame(baseConfig({ terrain: 'flat' }))
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
    for (const p of state.players.values()) {
      p.tilesOwned = 0
      p.frontier = new Set<number>()
      p.attacks = []
      p.troops = 0
      p.gold = 0
    }
    const claim = (x: number, y: number, id: number): void => {
      const p = state.players.get(id)
      if (p === undefined) throw new Error(`player ${String(id)} missing`)
      setOwner(state.map, T(x, y), id)
      p.tilesOwned++
      p.frontier.add(T(x, y))
    }
    // p1-Rahmen: 3×3 um (5,5) außer center (5,5) und Loch (5,6). Optional (6,5) als p3.
    claim(4, 4, 1)
    claim(5, 4, 1)
    claim(6, 4, 1)
    claim(4, 5, 1)
    claim(6, 5, opts.thirdEncloser === true ? 3 : 1)
    claim(4, 6, 1)
    claim(6, 6, 1)
    claim(5, 5, 2) // eingeschlossenes Ziel-Fragment
    for (const [x, y] of opts.extraP2 ?? []) claim(x, y, 2)
    const p1 = state.players.get(1)
    const p2 = state.players.get(2)
    if (p1 === undefined || p2 === undefined) throw new Error('players missing')
    p1.troops = opts.p1Troops
    // weightedTiles bestimmt den effektiven Cap (= Regel-2-Metrik); claim setzt nur tilesOwned.
    if (opts.p1Weighted !== undefined) p1.weightedTiles = opts.p1Weighted
    if (opts.p2Weighted !== undefined) p2.weightedTiles = opts.p2Weighted
    if (opts.allied === true) state.alliances.add(pairKey(1, 2))
    return state
  }

  /** p1 greift das Loch (5,6) an, bis es erobert ist (löst den Fragment-Check aus). */
  function captureHole(state: GameState, troops: number): void {
    for (let i = 0; i < 25 && getOwner(state.map, T(5, 6)) !== 1; i++)
      tick(state, [{ type: 'attack', playerId: 1, targetTile: T(5, 6), troops }])
    tick(state, []) // Nachlauf
    expect(getOwner(state.map, T(5, 6))).toBe(1) // Trigger lief tatsächlich
  }

  it('Regel 1: ein NICHT größtes (abgesprengtes) Fragment fällt sofort — Truppen egal', () => {
    // p2 hat ein großes freies Stück (4 Tiles) → (5,5) ist nur ein kleiner Fetzen. p2 hat sogar
    // klar mehr Truppen, trotzdem fällt der Fetzen (Regel 1 kennt keine Truppen-Schwelle).
    const state = setupEnclosed({
      p1Troops: 5000,
      extraP2: [
        [20, 20],
        [21, 20],
        [22, 20],
        [23, 20],
      ],
    })
    captureHole(state, 4000)
    expect(getOwner(state.map, T(5, 5))).toBe(1) // geschluckt
    expect(getOwner(state.map, T(20, 20))).toBe(2) // großes Stück bleibt
    expect(state.players.get(2)?.tilesOwned).toBe(4)
    assertTileCountConsistency(state)
  })

  it('Regel 2: das Kerngebiet bleibt ohne 25× Kapazitäts-Übermacht', () => {
    // (5,5) ist das einzige (= größte) Stück → Kerngebiet. p1 hat nur leicht mehr Cap (kein 25×).
    const state = setupEnclosed({ p1Troops: 15_000, p1Weighted: 50, p2Weighted: 1 })
    captureHole(state, 7000)
    expect(getOwner(state.map, T(5, 5))).toBe(2) // geschützt
    expect(state.players.get(2)?.isAlive).toBe(true)
  })

  it('Regel 2: das Kerngebiet fällt mit 25× Kapazitäts-Übermacht (Nation ausgelöscht)', () => {
    const state = setupEnclosed({ p1Troops: 60_000, p1Weighted: 3000, p2Weighted: 1 })
    captureHole(state, 8000)
    expect(getOwner(state.map, T(5, 5))).toBe(1) // geschluckt
    expect(state.players.get(2)?.tilesOwned).toBe(0)
    expect(state.players.get(2)?.isAlive).toBe(false) // checkEliminations
  })

  it('Verbündete werden nicht geschluckt', () => {
    const state = setupEnclosed({ p1Troops: 60_000, p1Weighted: 3000, p2Weighted: 1, allied: true })
    captureHole(state, 8000)
    expect(getOwner(state.map, T(5, 5))).toBe(2) // Allianz schützt
  })

  it('zwei verschiedene Umschließer → kein Schlucken', () => {
    // (6,5) gehört p3 → (5,5) ist nicht von GENAU EINEM Spieler umschlossen.
    const state = setupEnclosed({
      p1Troops: 60_000,
      p1Weighted: 3000,
      p2Weighted: 1,
      thirdEncloser: true,
    })
    captureHole(state, 8000)
    expect(getOwner(state.map, T(5, 5))).toBe(2) // gemischte Umschließung
  })
})
