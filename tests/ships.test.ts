import { describe, it, expect } from 'vitest'
import { createGame, tick, type GameConfig, type GameState } from '../src/core/game'
import {
  planWaterRoute,
  planBoatLaunch,
  tradeGold,
  shipTile,
  shipArrived,
  TRADE_INTERVAL_TICKS,
  WARSHIP_COST,
  WARSHIP_HP,
  type Warship,
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
      returning: false,
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

  it('flankiert über Wasser zu einem über Land erreichbaren Gegner-Küstenziel', () => {
    const state = createGame(cfg())
    splitMap(state)
    own(state, 3, 1, 1) // Spieler, Küste an der x=4-Wasserspalte
    // Gegner auf DERSELBEN (linken) Landmasse — über Land erreichbar — aber ebenfalls an
    // x=4: eine kurze Überfahrt umgeht die Landgrenze.
    const enemyTile = own(state, 3, 2, 2)
    const human = state.players.get(1)
    const enemy = state.players.get(2)
    if (human === undefined || enemy === undefined) throw new Error('missing player')
    human.troops = 800
    enemy.troops = 0 // unverteidigt → Landung gelingt
    const before = human.troops
    tick(state, [{ type: 'boat', playerId: 1, targetTile: enemyTile, troops: 500 }])
    // Früher No-Op (über Land erreichbar); jetzt startet das Boot (Truppen aus dem Pool).
    expect(human.troops).toBeLessThan(before)
    for (let i = 0; i < 50 && state.boats.length > 0; i++) tick(state, [])
    // Flankierung gelandet: ehemaliges Gegner-Tile gehört jetzt dem Menschen.
    expect(getOwner(state.map, enemyTile)).toBe(1)
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

  it('a recalled boat reverses and returns its troops to the pool', () => {
    const state = createGame(cfg())
    splitMap(state)
    own(state, 3, 1, 1) // Mensch besitzt ein Tile → bleibt am Leben (sonst eliminiert)
    const human = state.players.get(1)
    if (human === undefined) throw new Error('no human')
    human.troops = 0
    // Boot mitten auf einer (Wasser-)Route, noch nicht gelandet.
    const water = [
      tileRef(0, 0, W, H),
      tileRef(0, 1, W, H),
      tileRef(0, 2, W, H),
      tileRef(0, 3, W, H),
    ] as const
    state.boats.push({
      ownerId: 1,
      troops: 500,
      path: water,
      progress: 2,
      targetTile: tileRef(5, 1, W, H),
      returning: false,
    })
    tick(state, [{ type: 'boat-recall', playerId: 1, boatIndex: 0 }])
    for (let i = 0; i < 10 && state.boats.length > 0; i++) tick(state, [])
    // Boot ist heimgekehrt und die Truppen sind zurück im Pool (statt gelandet).
    expect(state.boats.length).toBe(0)
    expect(human.troops).toBeGreaterThanOrEqual(500)
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

describe('warships via tick', () => {
  it('launches a warship from an own port to a water target (costs gold)', () => {
    const state = createGame(cfg())
    splitMap(state)
    const portTile = own(state, 3, 1, 1) // coastal land of player 1
    state.buildings.set(portTile, {
      type: 'port',
      ownerId: 1,
      tile: portTile,
      level: 1,
      completesAtTick: 0,
    })
    const p1 = state.players.get(1)
    if (p1 === undefined) throw new Error('no player')
    p1.gold = WARSHIP_COST + 5000
    const target = tileRef(4, 1, W, H) // Wasser-Spalte
    tick(state, [{ type: 'launch-warship', playerId: 1, targetTile: target }])
    expect(state.warships.length).toBe(1)
    expect(state.warships[0]?.ownerId).toBe(1)
    expect(p1.gold).toBeLessThan(WARSHIP_COST + 5000)
  })

  it('does not launch a warship without a port', () => {
    const state = createGame(cfg())
    splitMap(state)
    own(state, 3, 1, 1)
    const p1 = state.players.get(1)
    if (p1 === undefined) throw new Error('no player')
    p1.gold = WARSHIP_COST + 5000
    tick(state, [{ type: 'launch-warship', playerId: 1, targetTile: tileRef(4, 1, W, H) }])
    expect(state.warships.length).toBe(0)
  })

  it('blockades: an enemy warship destroys a trade ship in range', () => {
    const state = createGame(cfg())
    splitMap(state)
    own(state, 1, 1, 1)
    own(state, 5, 1, 2)
    const water = [tileRef(0, 0, W, H), tileRef(0, 1, W, H)] as const
    state.warships.push({
      ownerId: 1,
      path: water,
      progress: 0,
      dir: 1,
      hp: WARSHIP_HP,
      cooldown: 0,
      returning: false,
    })
    state.tradeShips.push({
      fromOwnerId: 2,
      toOwnerId: 2,
      path: water,
      progress: 0,
      gold: 200,
      originPort: water[0],
      destPort: water[1],
    })
    // Schuss (Tick 0) + 4 Ticks Projektil-Flug bis zum Einschlag.
    for (let i = 0; i < 8 && state.tradeShips.length > 0; i++) tick(state, [])
    expect(state.tradeShips.length).toBe(0) // blockiert/zerstört
    expect(state.warships.length).toBe(1) // Kriegsschiff bleibt
  })

  it('Projektil eines versenkten Schiffs verpufft (nicht beide sterben)', () => {
    const state = createGame(cfg())
    splitMap(state)
    own(state, 1, 1, 1)
    own(state, 5, 1, 2)
    const water = [tileRef(0, 0, W, H), tileRef(0, 1, W, H), tileRef(0, 2, W, H)] as const
    // cooldown 99 → keine neuen Schüsse; nur die zwei injizierten Projektile zählen.
    const a: Warship = {
      ownerId: 1,
      path: water,
      progress: 0,
      dir: 1,
      hp: 5,
      cooldown: 99,
      returning: false,
    }
    const b: Warship = {
      ownerId: 2,
      path: water,
      progress: 0,
      dir: 1,
      hp: 1,
      cooldown: 99,
      returning: false,
    }
    state.warships.push(a, b)
    // A's Schuss schlägt EINEN Tick früher ein (travel 3 → tötet B), B's Schuss fliegt noch
    // (travel 2) und verpufft, sobald B versenkt ist.
    state.projectiles.push({
      shooter: a,
      target: b,
      targetKind: 'warship',
      fromX: 0,
      fromY: 0,
      travel: 3,
    })
    state.projectiles.push({
      shooter: b,
      target: a,
      targetKind: 'warship',
      fromX: 0,
      fromY: 0,
      travel: 2,
    })
    for (let i = 0; i < 5 && state.warships.length > 1; i++) tick(state, [])
    expect(state.warships.length).toBe(1)
    expect(state.warships[0]?.ownerId).toBe(1)
    expect(state.warships[0]?.hp).toBe(5) // B's Projektil verpuffte → A unbeschädigt
  })

  it('warship vs warship: the one with more HP survives', () => {
    const state = createGame(cfg())
    splitMap(state)
    own(state, 1, 1, 1)
    own(state, 5, 1, 2)
    const water = [tileRef(0, 0, W, H), tileRef(0, 1, W, H), tileRef(0, 2, W, H)] as const
    // hp 5 vs 3, 1 Schaden/Schuss (alle 15 Ticks, 4 Ticks Flug) → das schwächere (3) sinkt
    // zuerst, das stärkere überlebt. Genug Ticks für mehrere Schuss-Runden.
    state.warships.push({
      ownerId: 1,
      path: water,
      progress: 0,
      dir: 1,
      hp: 5,
      cooldown: 0,
      returning: false,
    })
    state.warships.push({
      ownerId: 2,
      path: water,
      progress: 0,
      dir: 1,
      hp: 3,
      cooldown: 0,
      returning: false,
    })
    for (let i = 0; i < 60 && state.warships.length > 1; i++) tick(state, [])
    expect(state.warships.length).toBe(1)
    expect(state.warships[0]?.ownerId).toBe(1)
  })

  it('a recalled warship sails home and disbands', () => {
    const state = createGame(cfg())
    splitMap(state)
    own(state, 1, 1, 1)
    const water = [tileRef(0, 0, W, H), tileRef(0, 1, W, H)] as const
    state.warships.push({
      ownerId: 1,
      path: water,
      progress: 1,
      dir: 1,
      hp: WARSHIP_HP,
      cooldown: 0,
      returning: false,
    })
    tick(state, [{ type: 'recall-warship', playerId: 1, warshipIndex: 0 }])
    expect(state.warships.length).toBe(0)
  })

  it('heilt nahe einem eigenen Hafen über die Zeit', () => {
    const state = createGame(cfg())
    splitMap(state)
    own(state, 1, 1, 1)
    // Eigener fertiger Hafen bei (1,1); beschädigtes Kriegsschiff auf dem Wasser daneben.
    const portTile = tileRef(1, 1, W, H)
    state.buildings.set(portTile, {
      type: 'port',
      ownerId: 1,
      tile: portTile,
      level: 1,
      completesAtTick: 0,
    })
    const water = [tileRef(0, 0, W, H), tileRef(0, 1, W, H)] as const
    state.warships.push({
      ownerId: 1,
      path: water,
      progress: 1,
      dir: 1,
      hp: 1,
      cooldown: 0,
      returning: false,
    })
    for (let i = 0; i < 5; i++) tick(state, [])
    expect(state.warships[0]?.hp).toBeGreaterThan(1)
    expect(state.warships[0]?.hp).toBeLessThanOrEqual(WARSHIP_HP)
  })
})
