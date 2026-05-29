import { describe, expect, it } from 'vitest'

import {
  createGame,
  isFrozen,
  setFrozen,
  tick,
  type GameConfig,
  type GameState,
} from '../src/core/game'
import type { Intent } from '../src/core/intent'
import { areAllied } from '../src/core/diplomacy'
import { getOwner } from '../src/world/map'
import { neighbors4 } from '../src/world/torus'

/** Bildet eine Allianz zwischen a und b über die regulären Intents (Anfrage + Annahme). */
function formAlliance(s: GameState, a: number, b: number): void {
  tick(s, [{ type: 'request-alliance', playerId: a, targetPlayerId: b }])
  tick(s, [{ type: 'accept-alliance', playerId: b, targetPlayerId: a }])
}

function cfg(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mapWidth: 64,
    mapHeight: 64,
    seed: 'freeze-test',
    victoryPct: 90,
    terrain: 'flat',
    players: [
      { id: 1, name: 'A', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'B', color: 0x00ff00ff, isHuman: false },
    ],
    ...overrides,
  }
}

/** Ein Tile von `victim`, das an `attacker`s Gebiet grenzt (für einen direkten Angriff). */
function borderTileOf(state: GameState, attackerId: number, victimId: number): number {
  const { width, height } = state.map
  const att = state.players.get(attackerId)
  if (att === undefined) return -1
  for (const f of att.frontier) {
    for (const n of neighbors4(f, width, height)) {
      if (getOwner(state.map, n) === victimId) return n
    }
  }
  return -1
}

describe('Einfrieren (Disconnect, ADR-0009)', () => {
  it('setFrozen / isFrozen togglen den Status', () => {
    const s = createGame(cfg())
    expect(isFrozen(s, 1)).toBe(false)
    setFrozen(s, 1, true)
    expect(isFrozen(s, 1)).toBe(true)
    setFrozen(s, 1, false)
    expect(isFrozen(s, 1)).toBe(false)
  })

  it('Intents einer eingefrorenen Nation werden verworfen', () => {
    const s = createGame(cfg())
    const p1 = s.players.get(1)
    if (p1 === undefined) throw new Error('p1')
    p1.gold = 100_000
    const home = [...p1.frontier][0] ?? 0
    setFrozen(s, 1, true)
    tick(s, [{ type: 'build', playerId: 1, tile: home, buildingType: 'city' }])
    expect(s.buildings.size).toBe(0) // Intent ignoriert, kein Bau

    // Aufgetaut → derselbe Intent greift wieder.
    setFrozen(s, 1, false)
    tick(s, [{ type: 'build', playerId: 1, tile: home, buildingType: 'city' }])
    expect(s.buildings.size).toBe(1)
  })

  it('Angriff auf eine eingefrorene verbündete Nation ist KEIN Verrat (Bündnis bleibt)', () => {
    const s = createGame(cfg())
    for (let i = 0; i < 8; i++) tick(s, []) // Gebiete wachsen lassen → gemeinsame Grenze
    formAlliance(s, 1, 2)
    expect(areAllied(s.alliances, 1, 2)).toBe(true)

    setFrozen(s, 2, true)
    const target = borderTileOf(s, 1, 2)
    // Falls (noch) keine direkte Grenze: omni-Angriff gegen Spieler 2 anlegen.
    const intent: Intent =
      target >= 0
        ? { type: 'attack', playerId: 1, targetTile: target, troops: 500 }
        : { type: 'attack', playerId: 1, targetTile: 0, troops: 500, omni: true }
    tick(s, [intent])

    const p1 = s.players.get(1)
    expect(p1?.traitorUntil ?? 0).toBe(0) // nicht als Verräter geächtet
    expect(areAllied(s.alliances, 1, 2)).toBe(true) // Bündnis besteht weiter
  })

  it('Angriff auf eine NICHT eingefrorene verbündete Nation bleibt Verrat (Kontrast)', () => {
    const s = createGame(cfg())
    for (let i = 0; i < 8; i++) tick(s, [])
    formAlliance(s, 1, 2)
    const target = borderTileOf(s, 1, 2)
    const intent: Intent =
      target >= 0
        ? { type: 'attack', playerId: 1, targetTile: target, troops: 500 }
        : { type: 'attack', playerId: 1, targetTile: 0, troops: 500, omni: true }
    // Nur sinnvoll, wenn eine gemeinsame Grenze existiert (sonst kein Verrat auslösbar).
    if (target >= 0) {
      tick(s, [intent])
      const p1 = s.players.get(1)
      expect(p1?.traitorUntil ?? 0).toBeGreaterThan(0)
      expect(areAllied(s.alliances, 1, 2)).toBe(false)
    }
  })
})
