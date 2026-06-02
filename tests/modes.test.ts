import { describe, it, expect } from 'vitest'
import { createGame, tick, type GameConfig, type PlayerDef } from '../src/core/game'
import { areAllied } from '../src/core/diplomacy'
import { getOwner, setOwner } from '../src/world/map'

function cfg(players: PlayerDef[], extra: Partial<GameConfig> = {}): GameConfig {
  return {
    mapWidth: 48,
    mapHeight: 48,
    seed: 'modes-test',
    victoryPct: 90,
    terrain: 'flat',
    players,
    ...extra,
  }
}

describe('Hauptstadt-Modus (ADR-0026)', () => {
  it('setzt jeder Nation eine Hauptstadt aufs Spawn-Zentrum', () => {
    const state = createGame(
      cfg(
        [
          { id: 1, name: 'A', color: 0xff0000ff, isHuman: true },
          { id: 2, name: 'B', color: 0x00ff00ff, isHuman: false },
        ],
        { captureMode: true },
      ),
    )
    for (const p of state.players.values()) {
      expect(p.capitalTile).toBeTypeOf('number')
      // Hauptstadt gehört zu Spielbeginn dem Spieler selbst.
      expect(getOwner(state.map, p.capitalTile ?? -1)).toBe(p.id)
      // … und ist eine ECHTE, fertige Stadt (funktioniert wie eine Stadt).
      const b = state.buildings.get(p.capitalTile ?? -1)
      expect(b?.type).toBe('city')
      expect(b?.ownerId).toBe(p.id)
      expect(b?.level).toBe(1)
    }
  })

  it('erobert ein Gegner die Hauptstadt, ist die Nation raus; Sieg für die letzte Seite', () => {
    const state = createGame(
      cfg(
        [
          { id: 1, name: 'A', color: 0xff0000ff, isHuman: true },
          { id: 2, name: 'B', color: 0x00ff00ff, isHuman: false },
        ],
        { captureMode: true },
      ),
    )
    const b = state.players.get(2)
    if (b === undefined || b.capitalTile === undefined) throw new Error('no capital')
    // Spieler 1 erobert die Hauptstadt von B.
    setOwner(state.map, b.capitalTile, 1)
    tick(state, [])
    expect(b.isAlive).toBe(false)
    // Nur noch Seite 1 übrig → Sieg.
    expect(state.phase).toBe('ended')
    expect(state.winner).toBe(1)
  })

  it('Hauptstadt zerbombt (neutralisiert) → eliminiert, ganzes Reich wird wild', () => {
    const state = createGame(
      cfg(
        [
          { id: 1, name: 'A', color: 0xff0000ff, isHuman: true },
          { id: 2, name: 'B', color: 0x00ff00ff, isHuman: false },
        ],
        { captureMode: true },
      ),
    )
    const b = state.players.get(2)
    if (b === undefined || b.capitalTile === undefined) throw new Error('no capital')
    // Ein B-Tile ungleich Hauptstadt merken — es soll nach dem „Bomben"-Tod herrenlos sein.
    let someBTile = -1
    for (let i = 0; i < state.map.state.length; i++) {
      if (getOwner(state.map, i) === 2 && i !== b.capitalTile) {
        someBTile = i
        break
      }
    }
    expect(someBTile).toBeGreaterThanOrEqual(0)
    setOwner(state.map, b.capitalTile, 0) // Hauptstadt neutralisiert = Bomben-Krater
    tick(state, [])
    expect(b.isAlive).toBe(false)
    expect(b.tilesOwned).toBe(0)
    // Das restliche Reich ist zu Wildnis (owner 0) zerfallen — NICHT an einen Gegner gegangen.
    expect(getOwner(state.map, someBTile)).toBe(0)
  })

  it('erobert → Eroberer erbt Land, Gebäude (auch Verteidigung) und Gold', () => {
    const state = createGame(
      cfg(
        [
          { id: 1, name: 'A', color: 0xff0000ff, isHuman: true },
          { id: 2, name: 'B', color: 0x00ff00ff, isHuman: false },
        ],
        { captureMode: true },
      ),
    )
    const a = state.players.get(1)
    const b = state.players.get(2)
    if (a === undefined || b === undefined || b.capitalTile === undefined) throw new Error('setup')
    // Ein B-Tile (≠ Hauptstadt) für einen Verteidigungsposten finden.
    let someBTile = -1
    for (let i = 0; i < state.map.state.length; i++) {
      if (getOwner(state.map, i) === 2 && i !== b.capitalTile) {
        someBTile = i
        break
      }
    }
    expect(someBTile).toBeGreaterThanOrEqual(0)
    state.buildings.set(someBTile, {
      type: 'defense',
      ownerId: 2,
      tile: someBTile,
      level: 1,
      completesAtTick: 0,
    })
    b.gold = 5000
    a.gold = 1000
    setOwner(state.map, b.capitalTile, 1) // A erobert die Hauptstadt von B
    tick(state, [])
    expect(b.isAlive).toBe(false)
    // Land an A übergegangen …
    expect(getOwner(state.map, someBTile)).toBe(1)
    // … inklusive des Verteidigungspostens (saubere Übernahme — NICHT zerstört) …
    expect(state.buildings.get(someBTile)?.ownerId).toBe(1)
    // … und Bs Gold geerbt (1000 + 5000; etwaige Wirtschafts-Einnahmen im Tick kommen obendrauf).
    expect(a.gold).toBeGreaterThanOrEqual(6000)
    expect(b.gold).toBe(0)
  })
})

describe('Team-Modus (ADR-0025)', () => {
  it('Teammitglieder sind von Anfang an permanent verbündet', () => {
    const state = createGame(
      cfg([
        { id: 1, name: 'A', color: 0xff0000ff, isHuman: true, teamId: 0 },
        { id: 2, name: 'B', color: 0x00ff00ff, isHuman: false, teamId: 0 },
        { id: 3, name: 'C', color: 0x0000ffff, isHuman: false, teamId: 1 },
      ]),
    )
    expect(areAllied(state.alliances, 1, 2)).toBe(true) // gleiches Team
    expect(areAllied(state.alliances, 1, 3)).toBe(false) // anderes Team
    // Permanent: kein Ablauf-Eintrag.
    expect(state.allianceExpiry.size).toBe(0)
  })

  it('man kann einen Teamkameraden nicht angreifen (kein Friendly Fire)', () => {
    const state = createGame(
      cfg([
        { id: 1, name: 'A', color: 0xff0000ff, isHuman: true, teamId: 0 },
        { id: 2, name: 'B', color: 0x00ff00ff, isHuman: false, teamId: 0 },
      ]),
    )
    const a = state.players.get(1)
    const b = state.players.get(2)
    if (a === undefined || b === undefined) throw new Error('missing')
    a.troops = 1000
    const mate = b.frontier.values().next().value ?? -1
    tick(state, [{ type: 'attack', playerId: 1, targetTile: mate, troops: 500 }])
    // Angriff verpufft: kein Angriff angelegt (Truppen wachsen unabhängig weiter), Bündnis intakt.
    expect(a.attacks.length).toBe(0)
    expect(areAllied(state.alliances, 1, 2)).toBe(true)
    // Truppen nicht für einen Angriff abgezogen (≥ Startwert minus Toleranz).
    expect(a.troops).toBeGreaterThanOrEqual(1000)
  })

  it('Sieg zählt pro Team zusammen (Summe der Mitglieder)', () => {
    const state = createGame(
      cfg(
        [
          { id: 1, name: 'A', color: 0xff0000ff, isHuman: false, teamId: 0 },
          { id: 2, name: 'B', color: 0x00ff00ff, isHuman: false, teamId: 0 },
          { id: 3, name: 'C', color: 0x0000ffff, isHuman: false, teamId: 1 },
        ],
        { victoryPct: 60 },
      ),
    )
    // Karte fast vollständig auf Team 0 aufteilen (je zur Hälfte an Spieler 1 und 2).
    const total = state.map.state.length
    for (const p of state.players.values()) {
      p.tilesOwned = 0
      p.frontier.clear()
    }
    for (let i = 0; i < total; i++) {
      const owner = i < total / 2 ? 1 : i < total * 0.95 ? 2 : 3
      setOwner(state.map, i, owner)
      const pl = state.players.get(owner)
      if (pl !== undefined) pl.tilesOwned++
    }
    tick(state, [])
    // Team 0 (Spieler 1+2) hält zusammen ~95% → über 60%-Schwelle → Team-Sieg.
    expect(state.phase).toBe('ended')
    expect([1, 2]).toContain(state.winner)
  })
})
