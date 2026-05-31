/**
 * Tests für die Gunst-Spenden (ADR-0022): Gold-Geschenk → Gunst; Truppen-Spende nur an
 * Verbündete. Deterministische Core-Logik.
 */

import { describe, expect, it } from 'vitest'
import { createGame, tick, type GameConfig } from '../src/core/game'
import { directedKey, pairKey } from '../src/core/diplomacy'

function config(): GameConfig {
  return {
    mapWidth: 48,
    mapHeight: 48,
    seed: 'donate-test',
    victoryPct: 90,
    terrain: 'flat',
    players: [
      { id: 1, name: 'Du', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'Ally', color: 0x00ff00ff, isHuman: false },
    ],
  }
}

const gw = (s: ReturnType<typeof createGame>, a: number, b: number): number =>
  s.goodwill.get(directedKey(a, b)) ?? 0

describe('Gold spenden (ADR-0022)', () => {
  it('überträgt Gold und erzeugt beidseitige Gunst', () => {
    const state = createGame(config())
    const p1 = state.players.get(1)
    const p2 = state.players.get(2)
    if (p1 === undefined || p2 === undefined) throw new Error('players missing')
    p1.gold = 100_000
    p2.gold = 0
    tick(state, [{ type: 'donate-gold', playerId: 1, targetPlayerId: 2, amount: 50_000 }])
    expect(p2.gold).toBeGreaterThanOrEqual(50_000) // Geschenk angekommen
    expect(p1.gold).toBeLessThanOrEqual(50_500) // Geschenk abgegeben (+ evtl. Tick-Einkommen)
    // Basis 50000/200 = 250, plus Bereitschafts-Bonus (Anteil 0,5 → ×1,25) = 312,5,
    // minus minimaler Abkling-Schritt im selben Tick (×0,997).
    expect(gw(state, 1, 2)).toBeGreaterThan(305)
    expect(gw(state, 1, 2)).toBeLessThanOrEqual(313)
    expect(gw(state, 2, 1)).toBeCloseTo(gw(state, 1, 2), 5) // beidseitig gleich
  })

  it('lehnt ab, wenn nicht genug Gold da ist (keine Gunst, kein Transfer)', () => {
    const state = createGame(config())
    const p1 = state.players.get(1)
    const p2 = state.players.get(2)
    if (p1 === undefined || p2 === undefined) throw new Error('players missing')
    p1.gold = 100
    p2.gold = 0
    tick(state, [{ type: 'donate-gold', playerId: 1, targetPlayerId: 2, amount: 50_000 }])
    expect(gw(state, 1, 2)).toBe(0)
    expect(p2.gold).toBeLessThan(50_000)
  })
})

describe('Truppen spenden (ADR-0022)', () => {
  it('nur an Verbündete: ohne Bündnis abgelehnt', () => {
    const state = createGame(config())
    const p1 = state.players.get(1)
    if (p1 === undefined) throw new Error('player missing')
    p1.troops = 50_000
    tick(state, [{ type: 'donate-troops', playerId: 1, targetPlayerId: 2, amount: 10_000 }])
    expect(gw(state, 1, 2)).toBe(0) // keine Gunst → wurde nicht ausgeführt
  })

  it('mit Bündnis: überträgt Truppen und stärkt die Gunst', () => {
    const state = createGame(config())
    const p1 = state.players.get(1)
    const p2 = state.players.get(2)
    if (p1 === undefined || p2 === undefined) throw new Error('players missing')
    state.alliances.add(pairKey(1, 2))
    p1.troops = 50_000
    const before = p2.troops
    tick(state, [{ type: 'donate-troops', playerId: 1, targetPlayerId: 2, amount: 10_000 }])
    expect(gw(state, 1, 2)).toBeGreaterThan(0)
    expect(p2.troops).toBeGreaterThan(before) // Truppen angekommen
  })
})
