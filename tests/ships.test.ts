import { describe, it, expect } from 'vitest'
import { createGame, tick, type GameConfig, type GameState } from '../src/core/game'
import {
  planWaterRoute,
  planBoatLaunch,
  tradeGold,
  shipTile,
  shipArrived,
  TRADE_INTERVAL_TICKS,
} from '../src/core/ships'
import { labelWaterComponents, labelLandComponents } from '../src/world/water-path'
import { getOwner, setOwner } from '../src/world/map'
import { IS_LAND_BIT } from '../src/world/terrain'
import { tileRef } from '../src/world/torus'

const W = 8
const H = 4

function cfg(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mapWidth: W,
    mapHeight: H,
    seed: 'ships-test',
    victoryPct: 90,
    terrain: 'flat',
    players: [
      { id: 1, name: 'Human', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'AI', color: 0x00ff00ff, isHuman: false },
    ],
    ...overrides,
  }
}

/**
 * Verwandelt das (flache) Spiel in zwei Landmassen, getrennt durch zwei
 * Wasser-Spalten (x=0 und x=4). Links = Spalten 1-3, rechts = 5-7. Beide
 * Landmassen grenzen über die Wasser-Spalten aneinander → Boot-Route existiert.
 * Danach werden Komponenten neu gelabelt und der Besitz zurückgesetzt.
 */
function splitMap(state: GameState): void {
  const t = state.map.terrain
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const land = x !== 0 && x !== 4
      t[y * W + x] = land ? IS_LAND_BIT : 0
    }
  }
  state.waterComponents.set(labelWaterComponents(state.map))
  state.landComponents.set(labelLandComponents(state.map))
  // Besitz zurücksetzen
  for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
  for (const p of state.players.values()) {
    p.tilesOwned = 0
    p.frontier = new Set<number>()
    p.attacks = []
  }
}

function own(state: GameState, x: number, y: number, playerId: number): number {
  const ref = tileRef(x, y, W, H)
  setOwner(state.map, ref, playerId)
  const p = state.players.get(playerId)
  if (p !== undefined) {
    p.tilesOwned++
    p.frontier.add(ref)
  }
  return ref
}

describe('trade gold + ship helpers', () => {
  it('tradeGold grows with distance', () => {
    expect(tradeGold(0)).toBe(200)
    expect(tradeGold(10)).toBe(260)
  })

  it('shipTile/shipArrived track progress along the path', () => {
    const ship = {
      ownerId: 1,
      troops: 10,
      path: [10, 11, 12] as const,
      progress: 0,
      targetTile: 99,
    }
    expect(shipTile(ship)).toBe(10)
    ship.progress = 1
    expect(shipTile(ship)).toBe(11)
    expect(shipArrived(ship)).toBe(false)
    ship.progress = 2
    expect(shipArrived(ship)).toBe(true)
  })
})

describe('route planners on a split map', () => {
  it('plans a water route between two coastal land tiles', () => {
    const state = createGame(cfg())
    splitMap(state)
    const left = tileRef(1, 1, W, H) // coastal to x=0 water
    const right = tileRef(7, 1, W, H) // coastal to x=0 water (via wrap)
    const path = planWaterRoute(state.map, state.waterComponents, left, right)
    expect(path).not.toBeNull()
    expect(path?.length ?? 0).toBeGreaterThan(0)
  })

  it('plans a boat launch from the nearest own coast', () => {
    const state = createGame(cfg())
    splitMap(state)
    own(state, 3, 1, 1) // human owns a tile coastal to x=4 water
    own(state, 1, 2, 1) // and one coastal to x=0 water
    const target = tileRef(5, 1, W, H) // enemy landmass, coastal to x=4
    const plan = planBoatLaunch(
      state.map,
      state.waterComponents,
      [tileRef(3, 1, W, H), tileRef(1, 2, W, H)],
      target,
    )
    expect(plan).not.toBeNull()
    // nearest own coast to (5,1) is (3,1) → launch from there
    expect(plan?.fromLand).toBe(tileRef(3, 1, W, H))
  })
})

describe('boat launch + landing via tick', () => {
  it('launches a boat via a boat intent and lands a beachhead', () => {
    const state = createGame(cfg())
    splitMap(state)
    own(state, 3, 1, 1) // human on left landmass, coastal
    const enemyTile = own(state, 5, 1, 2) // enemy on right landmass
    const human = state.players.get(1)
    const enemy = state.players.get(2)
    if (human === undefined || enemy === undefined) throw new Error('missing player')
    human.troops = 1000
    enemy.troops = 0 // unverteidigt → Landung gelingt

    const before = human.troops
    // Boot-Intent trägt die angeforderte Truppenzahl (Slider-%), nicht mehr einen Bruchteil.
    tick(state, [{ type: 'boat', playerId: 1, targetTile: enemyTile, troops: 600 }])
    // Pool sank um ~600 (abzüglich des kleinen Wachstums im selben Tick).
    expect(human.troops).toBeLessThan(before)
    if (state.boats.length > 0) {
      expect(state.boats[0]?.troops).toBe(600)
    }

    // bis zur Auflösung weiterticken
    for (let i = 0; i < 50 && state.boats.length > 0; i++) tick(state, [])
    expect(state.boats.length).toBe(0)
    // Brückenkopf: Mensch besitzt jetzt das ehemalige Gegner-Tile
    expect(getOwner(state.map, enemyTile)).toBe(1)
  })

  it('a boat intent to a land-reachable target does nothing (use attack instead)', () => {
    const state = createGame(cfg())
    splitMap(state)
    own(state, 1, 1, 1)
    const neighborLand = tileRef(2, 1, W, H) // same landmass, neutral
    const human = state.players.get(1)
    if (human === undefined) throw new Error('no human')
    human.troops = 500
    tick(state, [{ type: 'boat', playerId: 1, targetTile: neighborLand, troops: 500 }])
    // kein Boot und kein Angriff — über Land erreichbar ist kein Boot-Ziel (No-Op)
    expect(state.boats.length).toBe(0)
    expect(human.attacks.length).toBe(0)
  })

  it('an attack across water no longer auto-launches a boat (explicit boat mode only)', () => {
    const state = createGame(cfg())
    splitMap(state)
    own(state, 3, 1, 1)
    const enemyTile = own(state, 5, 1, 2) // enemy on the other landmass
    const human = state.players.get(1)
    if (human === undefined) throw new Error('no human')
    human.troops = 1000
    tick(state, [{ type: 'attack', playerId: 1, targetTile: enemyTile, troops: 1000 }])
    // Angriff über Wasser = No-Op: kein Boot und kein Angriff entsteht
    expect(state.boats.length).toBe(0)
    expect(human.attacks.length).toBe(0)
  })

  it('a boat intent snaps a non-coastal target to a reachable coast of that landmass', () => {
    const state = createGame(cfg())
    splitMap(state)
    own(state, 3, 1, 1) // human coastal on the left landmass
    const human = state.players.get(1)
    if (human === undefined) throw new Error('no human')
    human.troops = 1000
    // x=6 ist ein Inland-Tile des rechten Kontinents (Nachbarn x=5/x=7 sind Land).
    const interior = tileRef(6, 1, W, H)
    const before = human.troops
    tick(state, [{ type: 'boat', playerId: 1, targetTile: interior, troops: 500 }])
    // Truppen wurden ins Boot gesteckt → Start ist geglückt (Klick traf kein Küsten-Tile).
    expect(human.troops).toBeLessThan(before)
    // Bis zur Landung weiterticken; danach hält der Mensch einen Brückenkopf auf dem
    // rechten Kontinent (Spalten 5-7).
    for (let i = 0; i < 50 && state.boats.length > 0; i++) tick(state, [])
    let ownsRight = false
    for (let x = 5; x <= 7; x++) {
      for (let y = 0; y < H; y++) {
        if (getOwner(state.map, tileRef(x, y, W, H)) === 1) ownsRight = true
      }
    }
    expect(ownsRight).toBe(true)
  })
})

describe('trade ships via tick', () => {
  it('spawns a trade ship between two foreign ports and pays both owners', () => {
    const state = createGame(cfg())
    splitMap(state)
    const humanPort = own(state, 1, 1, 1) // coastal to x=0 water at (0,1)
    const enemyPort = own(state, 1, 3, 2) // coastal to x=0 water at (0,3) → Route Länge 3
    // place port buildings
    state.buildings.set(humanPort, {
      type: 'port',
      ownerId: 1,
      tile: humanPort,
      level: 1,
      completesAtTick: 0,
    })
    state.buildings.set(enemyPort, {
      type: 'port',
      ownerId: 2,
      tile: enemyPort,
      level: 1,
      completesAtTick: 0,
    })

    // fast-forward to a tick where the human port is due to launch
    while (state.tick % TRADE_INTERVAL_TICKS !== humanPort % TRADE_INTERVAL_TICKS) {
      tick(state, [])
    }
    const human = state.players.get(1)
    const enemy = state.players.get(2)
    if (human === undefined || enemy === undefined) throw new Error('missing player')
    const goldBeforeHuman = human.gold
    const goldBeforeEnemy = enemy.gold

    tick(state, []) // this tick spawns the ship
    expect(state.tradeShips.length).toBeGreaterThanOrEqual(1)
    const ship = state.tradeShips[0]
    if (ship === undefined) throw new Error('no ship')

    // run until the ship arrives
    for (let i = 0; i < 100 && state.tradeShips.length > 0; i++) tick(state, [])
    // both owners gained at least the ship's gold (plus base income over ticks)
    expect(human.gold - goldBeforeHuman).toBeGreaterThanOrEqual(ship.gold)
    expect(enemy.gold - goldBeforeEnemy).toBeGreaterThanOrEqual(ship.gold)
  })
})
