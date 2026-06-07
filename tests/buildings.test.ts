import { describe, it, expect } from 'vitest'
import {
  buildCost,
  upgradeCost,
  defenseRange,
  BUILD_TIME_TICKS,
  BUILD_COST_CAP,
  CITY_CAP_BONUS,
  cityStageKey,
} from '../src/core/buildings'
import {
  buildCostFor,
  canBuildAt,
  createGame,
  tick,
  effectiveMaxTroops,
  snapBuildTile,
  BUILD_NEARMISS_RADIUS,
  type GameConfig,
} from '../src/core/game'
import { getOwner, setOwner } from '../src/world/map'

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

  it('upgrade cost grows linearly with level (Basis ohne buildPrice = Typ-Basiskosten)', () => {
    expect(upgradeCost({ type: 'city', level: 1 })).toBe(50_000)
    expect(upgradeCost({ type: 'city', level: 2 })).toBe(75_000)
  })

  it('Städte brauchen Mindestabstand (ADR-0033): zu nah abgelehnt, weit genug erlaubt', () => {
    const state = createGame(cfg())
    const p = state.players.get(1)
    if (p === undefined) throw new Error('no player')
    p.gold = 1_000_000
    const w = state.map.width
    const row = 10
    // Horizontalen Streifen dem Spieler geben (kontrollierte Distanzen; flat map = passierbar).
    for (let x = 0; x < 30; x++) setOwner(state.map, row * w + x, 1)
    const cityTile = row * w + 5
    state.buildings.set(cityTile, {
      type: 'city',
      ownerId: 1,
      tile: cityTile,
      level: 1,
      completesAtTick: 0,
    })
    // 4 Tiles entfernt (< CITY_MIN_DISTANCE 8) → kein Bau
    expect(canBuildAt(state, 1, row * w + 9, 'city')).toBe(false)
    // 10 Tiles entfernt (>= 8) → Bau erlaubt
    expect(canBuildAt(state, 1, row * w + 15, 'city')).toBe(true)
    // Andere Gebäude (Verteidigung) sind vom Stadt-Abstand NICHT betroffen
    expect(canBuildAt(state, 1, row * w + 9, 'defense')).toBe(true)
  })

  it('cityStageKey: Level → Siedlungs-Stufe (ADR-0033)', () => {
    expect(cityStageKey(1)).toBe('citystage.dorf')
    expect(cityStageKey(3)).toBe('citystage.stadt')
    expect(cityStageKey(6)).toBe('citystage.weltstadt')
    expect(cityStageKey(99)).toBe('citystage.weltstadt') // über Max → geklemmt
    expect(cityStageKey(0)).toBe('citystage.dorf') // unter Min → geklemmt
  })

  it('Städte-Kosten verdoppeln sich ab Level 3 (ADR-0031 Gold-Senke, Basis 25k)', () => {
    expect(upgradeCost({ type: 'city', level: 3 })).toBe(150_000) // L3→4 = base×6
    expect(upgradeCost({ type: 'city', level: 4 })).toBe(300_000) // L4→5 = base×12
    expect(upgradeCost({ type: 'city', level: 5 })).toBe(600_000) // L5→6 = base×24
    // Teure Stadt (buildPrice 100k) skaliert ×4 mit.
    expect(upgradeCost({ type: 'city', level: 3, buildPrice: 100_000 })).toBe(600_000)
  })

  it('upgrade cost skaliert am tatsächlichen Baupreis (Max-Cost-Fabrik teuer)', () => {
    // Erste/billige Fabrik (buildPrice = Basis 25k): unverändert.
    expect(upgradeCost({ type: 'factory', level: 1, buildPrice: 25_000 })).toBe(50_000)
    // Max-Cost-Fabrik (100k gebaut): Upgrade skaliert mit → deutlich teurer als der L1-Preis.
    expect(upgradeCost({ type: 'factory', level: 1, buildPrice: 100_000 })).toBe(200_000)
    expect(upgradeCost({ type: 'factory', level: 2, buildPrice: 100_000 })).toBe(300_000)
  })

  it('build cost is capped at BUILD_COST_CAP (100k)', () => {
    // Basis 25k × 2^n; 2^6 = 64 → 1.6 Mio → gedeckelt.
    expect(buildCost('city', 6)).toBe(BUILD_COST_CAP)
    expect(buildCost('city', 20)).toBe(BUILD_COST_CAP)
    expect(buildCost('factory', 6)).toBe(BUILD_COST_CAP)
  })

  it('defense range grows per level', () => {
    expect(defenseRange(1)).toBe(8)
    expect(defenseRange(2)).toBe(12)
    expect(defenseRange(3)).toBe(16)
  })
})

describe('buildCostFor — Eskalations-Gruppen (pro Spieler)', () => {
  it('Hafen und Fabrik teilen sich den Kosten-Multiplikator', () => {
    const state = createGame(cfg())
    // Spieler 1 hat 1 Hafen + 1 Fabrik fertig → Gruppen-Zähler = 2 für beide.
    const t1 = ownedTile(state, 1)
    setOwner(state.map, t1, 1)
    state.buildings.set(t1, { type: 'port', ownerId: 1, tile: t1, level: 1, completesAtTick: 0 })
    const t2 = t1 + 1
    setOwner(state.map, t2, 1)
    state.buildings.set(t2, { type: 'factory', ownerId: 1, tile: t2, level: 1, completesAtTick: 0 })
    // Gleiche Basis (25k) + geteilter Zähler 2 → Hafen und Fabrik kosten identisch: 25k × 2^2.
    expect(buildCostFor(state, 1, 'port')).toBe(100_000)
    expect(buildCostFor(state, 1, 'factory')).toBe(100_000)
    // Stadt bleibt eigene Gruppe (Zähler 0) → Basispreis.
    expect(buildCostFor(state, 1, 'city')).toBe(25_000)
  })

  it('zählt nur eigene Gebäude (pro Spieler, nicht pro Spiel)', () => {
    const state = createGame(cfg())
    const tEnemy = ownedTile(state, 2)
    setOwner(state.map, tEnemy, 2)
    state.buildings.set(tEnemy, {
      type: 'port',
      ownerId: 2,
      tile: tEnemy,
      level: 1,
      completesAtTick: 0,
    })
    // Spieler 1 hat selbst keinen Hafen → Basispreis, unbeeinflusst von Spieler 2.
    expect(buildCostFor(state, 1, 'port')).toBe(25_000)
  })
})

describe('build intent', () => {
  it('places a building and deducts gold', () => {
    const state = createGame(cfg())
    const p = state.players.get(1)
    if (p === undefined) throw new Error('no player')
    p.gold = 100_000
    const tile = ownedTile(state, 1)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'defense' }])
    expect(state.buildings.has(tile)).toBe(true)
    expect(state.buildings.get(tile)?.type).toBe('defense')
    // gold reduced by build cost
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
    tick(state, [{ type: 'build', playerId: 1, tile: enemyTile, buildingType: 'city' }])
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
    // Während des Baus noch keine Wirkung …
    expect(effectiveMaxTroops(state, 1)).toBe(capBefore)
    // … erst nach der Bauzeit.
    for (let i = 0; i < BUILD_TIME_TICKS; i++) tick(state, [])
    expect(effectiveMaxTroops(state, 1)).toBe(capBefore + CITY_CAP_BONUS)
  })
})

describe('snapBuildTile — Nähe-Snap (Bau knapp neben das eigene Gebiet)', () => {
  /** Alle Eigentums-Bits von Spieler 1 entfernen → kontrollierte Ausgangslage (Spawn stört nicht). */
  function clearOwnership(state: ReturnType<typeof createGame>, playerId: number): void {
    for (let i = 0; i < state.map.state.length; i++) {
      if (getOwner(state.map, i) === playerId) setOwner(state.map, i, 0)
    }
  }

  it('rastet einen Klick knapp neben eigenes Land aufs nächste eigene baubare Tile', () => {
    const state = createGame(cfg())
    clearOwnership(state, 1)
    const w = state.map.width
    const own = 10 * w + 10 // (x=10, y=10)
    setOwner(state.map, own, 1)
    const nearMiss = 10 * w + 12 // 2 Tiles rechts daneben, NICHT besessen
    expect(getOwner(state.map, nearMiss)).not.toBe(1)
    const snapped = snapBuildTile(state, 1, nearMiss, 'city')
    expect(snapped).toBe(own)
    expect(getOwner(state.map, snapped)).toBe(1)
  })

  it('rastet NICHT, wenn das nächste eigene Tile weiter als der Radius entfernt ist', () => {
    const state = createGame(cfg())
    clearOwnership(state, 1)
    const w = state.map.width
    setOwner(state.map, 5 * w + 5, 1)
    const far = 5 * w + (5 + BUILD_NEARMISS_RADIUS + 2) // jenseits des Snap-Radius
    const snapped = snapBuildTile(state, 1, far, 'city')
    expect(snapped).toBe(far)
  })

  it('rastet nicht auf ein Tile, das bereits ein Gebäude trägt (sucht das nächste freie)', () => {
    const state = createGame(cfg())
    clearOwnership(state, 1)
    const w = state.map.width
    const occupied = 20 * w + 20
    const free = 20 * w + 21
    setOwner(state.map, occupied, 1)
    setOwner(state.map, free, 1)
    // Anderer Gebäude-Typ als der gebaute (factory ≠ city) → der Upgrade-Snap (Schritt 1, nur
    // gleicher Typ) greift NICHT, sodass wirklich der allgemeine Nähe-Snap getestet wird.
    state.buildings.set(occupied, {
      type: 'factory',
      ownerId: 1,
      tile: occupied,
      level: 1,
      completesAtTick: 0,
    })
    // Klick 1 Tile rechts vom freien Tile (= 2 Tiles vom belegten): muss aufs freie rasten.
    const nearMiss = 20 * w + 22
    const snapped = snapBuildTile(state, 1, nearMiss, 'city')
    expect(snapped).toBe(free)
  })

  it('greift nicht bei Häfen (die haben ihren eigenen Küsten-Snap)', () => {
    const state = createGame(cfg())
    clearOwnership(state, 1)
    const w = state.map.width
    setOwner(state.map, 30 * w + 30, 1)
    const nearMiss = 30 * w + 32
    // Für Häfen NICHT der allgemeine Nähe-Snap → Tile bleibt (Küsten-Snap findet hier kein Wasser).
    const snapped = snapBuildTile(state, 1, nearMiss, 'port')
    expect(snapped).toBe(nearMiss)
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

  it('Städte rüsten bis Level 6 hoch (ADR-0031 Gold-Senke)', () => {
    const state = createGame(cfg())
    const p = state.players.get(1)
    if (p === undefined) throw new Error('no player')
    p.gold = 10_000_000
    const tile = ownedTile(state, 1)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'city' }])
    for (let i = 0; i < 8; i++) tick(state, [{ type: 'upgrade', playerId: 1, tile }])
    expect(state.buildings.get(tile)?.level).toBe(6)
  })

  it('andere Gebäude bleiben bei Level 3 gedeckelt', () => {
    const state = createGame(cfg())
    const p = state.players.get(1)
    if (p === undefined) throw new Error('no player')
    p.gold = 10_000_000
    const tile = ownedTile(state, 1)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'defense' }])
    for (let i = 0; i < 8; i++) tick(state, [{ type: 'upgrade', playerId: 1, tile }])
    expect(state.buildings.get(tile)?.level).toBe(3)
  })

  it('eine Level-6-Stadt hebt den Truppen-Cap um 150k (6×25k)', () => {
    const state = createGame(cfg())
    const p = state.players.get(1)
    if (p === undefined) throw new Error('no player')
    p.gold = 10_000_000
    const tile = ownedTile(state, 1)
    const before = effectiveMaxTroops(state, 1)
    tick(state, [{ type: 'build', playerId: 1, tile, buildingType: 'city' }])
    for (let i = 0; i < BUILD_TIME_TICKS; i++) tick(state, []) // Stadt fertig bauen (Cap wirkt)
    for (let i = 0; i < 8; i++) tick(state, [{ type: 'upgrade', playerId: 1, tile }])
    expect(state.buildings.get(tile)?.level).toBe(6)
    // Level-6-Stadt = 6×CITY_CAP_BONUS = 150k Cap-Bonus (Tile-Cap ist bei nur einem Bau-Tile stabil).
    expect(effectiveMaxTroops(state, 1) - before).toBe(6 * CITY_CAP_BONUS)
  })
})

describe('Eroberte Wirtschaftsgebäude: Gold-Fuhre wechselt den Besitzer', () => {
  it('die Inland-Fuhre einer eroberten Fabrik+Quelle gehört danach dem Eroberer (nicht mehr dem alten Besitzer)', () => {
    const state = createGame(cfg())
    const w = state.map.width
    // Quelle (Stadt) + Fabrik direkt nebeneinander, beide Spieler 1, fertig → erzeugt eine Inland-Fuhre.
    const cityTile = 10 * w + 10
    const facTile = 10 * w + 11
    setOwner(state.map, cityTile, 1)
    setOwner(state.map, facTile, 1)
    state.buildings.set(cityTile, {
      type: 'city',
      ownerId: 1,
      tile: cityTile,
      level: 1,
      completesAtTick: 0,
    })
    state.buildings.set(facTile, {
      type: 'factory',
      ownerId: 1,
      tile: facTile,
      level: 1,
      completesAtTick: 0,
    })
    state.economyDirty = true
    for (let i = 0; i < 90; i++) tick(state, []) // >2× ECONOMY_RECOMPUTE_INTERVAL → Routen neu gebaut

    const cart = state.goldCarts.find((c) => c.factoryTile === facTile)
    expect(cart).toBeDefined()
    expect(cart?.ownerId).toBe(1)

    // Eroberung: Tiles + Gebäude wechseln zu Spieler 2 (wie captureTile es täte).
    const cityB = state.buildings.get(cityTile)
    const facB = state.buildings.get(facTile)
    if (cityB === undefined || facB === undefined) throw new Error('building missing')
    setOwner(state.map, cityTile, 2)
    setOwner(state.map, facTile, 2)
    state.buildings.set(cityTile, { ...cityB, ownerId: 2 })
    state.buildings.set(facTile, { ...facB, ownerId: 2 })
    state.economyDirty = true
    for (let i = 0; i < 90; i++) tick(state, []) // >2× ECONOMY_RECOMPUTE_INTERVAL → Routen neu gebaut

    // Die (über die gleiche Route wiederverwendete) Fuhre muss jetzt Spieler 2 gehören.
    const cart2 = state.goldCarts.find((c) => c.factoryTile === facTile)
    expect(cart2).toBeDefined()
    expect(cart2?.ownerId).toBe(2)
  })
})
