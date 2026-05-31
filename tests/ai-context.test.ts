/**
 * Test für die KI-Lage-Einschätzung (ADR-0022-Nachtrag): Rang, Führer, Welt-Füllstand, gemobbt.
 */

import { describe, expect, it } from 'vitest'
import { createGame, type GameConfig } from '../src/core/game'
import { assessContext } from '../src/ai/ai'
import { setOwner } from '../src/world/map'
import { tileRef } from '../src/world/torus'

const W = 64
const H = 64
const T = (x: number, y: number): number => tileRef(x, y, W, H)

function config(): GameConfig {
  return {
    mapWidth: W,
    mapHeight: H,
    seed: 'ctx-test',
    victoryPct: 90,
    terrain: 'flat',
    players: [
      { id: 1, name: 'Leader', color: 0xff0000ff, isHuman: false },
      { id: 2, name: 'B', color: 0x00ff00ff, isHuman: false },
      { id: 3, name: 'C', color: 0x0000ffff, isHuman: false },
    ],
  }
}

function blank(): ReturnType<typeof createGame> {
  const state = createGame(config())
  for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
  for (const p of state.players.values()) {
    p.tilesOwned = 0
    p.frontier = new Set<number>()
    p.attacks = []
  }
  return state
}

describe('assessContext (ADR-0022)', () => {
  it('erkennt den Führenden (meiste Tiles) → isLeader, rank 0', () => {
    const state = blank()
    const p1 = state.players.get(1)
    const p2 = state.players.get(2)
    const p3 = state.players.get(3)
    if (p1 === undefined || p2 === undefined || p3 === undefined) throw new Error('players')
    p1.tilesOwned = 500
    p2.tilesOwned = 100
    p3.tilesOwned = 50
    const c1 = assessContext(state, p1)
    expect(c1.isLeader).toBe(true)
    expect(c1.rank).toBe(0)
    const c3 = assessContext(state, p3)
    expect(c3.isLeader).toBe(false)
    expect(c3.rank).toBeGreaterThan(0.9) // Schlusslicht
  })

  it('misst den Füllstand: nur neutrale Nachbarn → 0, nur Feinde → 1', () => {
    const state = blank()
    const p1 = state.players.get(1)
    if (p1 === undefined) throw new Error('player')
    // p1 besitzt (10,10), Nachbarn ringsum neutral.
    setOwner(state.map, T(10, 10), 1)
    p1.tilesOwned = 1
    p1.frontier.add(T(10, 10))
    expect(assessContext(state, p1).crowding).toBe(0)
    // Jetzt alle 4 Nachbarn dem Feind (2) geben → voll.
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      setOwner(state.map, T(10 + dx, 10 + dy), 2)
    expect(assessContext(state, p1).crowding).toBe(1)
  })

  it('erkennt Mobbing: ≥2 Angreifer auf mich → ganged', () => {
    const state = blank()
    const p1 = state.players.get(1)
    const p2 = state.players.get(2)
    const p3 = state.players.get(3)
    if (p1 === undefined || p2 === undefined || p3 === undefined) throw new Error('players')
    expect(assessContext(state, p1).ganged).toBe(false)
    const atk = (target: number) => ({
      targetPlayerId: target,
      reserveTroops: 100,
      focusTile: 0,
      frontTile: 0,
      startTick: 0,
    })
    p2.attacks = [atk(1)]
    p3.attacks = [atk(1)]
    expect(assessContext(state, p1).ganged).toBe(true)
  })
})
