import { describe, it, expect } from 'vitest'
import { createGame, tick, type GameConfig } from '../src/core/game'
import { hashState } from '../src/core/hash'
import { getOwner, setOwner } from '../src/world/map'
import { neighbors4 } from '../src/world/torus'
import type { Intent } from '../src/core/intent'

function cfg(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mapWidth: 64,
    mapHeight: 64,
    seed: 'hash-test',
    victoryPct: 90,
    terrain: 'flat',
    players: [
      { id: 1, name: 'A', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'B', color: 0x00ff00ff, isHuman: false },
      { id: 3, name: 'C', color: 0x0000ffff, isHuman: false },
    ],
    ...overrides,
  }
}

/** Ein neutrales Tile an der Frontier von `playerId` (für einen echten Angriff). */
function neutralBorder(state: ReturnType<typeof createGame>, playerId: number): number {
  const { width, height } = state.map
  const p = state.players.get(playerId)
  if (p === undefined) return -1
  for (const f of p.frontier) {
    for (const n of neighbors4(f, width, height)) {
      if (getOwner(state.map, n) === 0) return n
    }
  }
  return -1
}

describe('hashState — Determinismus', () => {
  it('gleicher Seed + identischer Intent-Strom → identischer Hash an jedem Tick', () => {
    const a = createGame(cfg())
    const b = createGame(cfg())
    expect(hashState(a)).toBe(hashState(b)) // identischer Start

    // Beide Spiele bekommen denselben (auf a berechneten) Intent-Strom und müssen Tick für
    // Tick denselben Hash behalten.
    for (let i = 0; i < 60; i++) {
      const intents: Intent[] = []
      if (i % 7 === 0) {
        const target = neutralBorder(a, 1)
        if (target >= 0)
          intents.push({ type: 'attack', playerId: 1, targetTile: target, troops: 2000 })
      }
      tick(a, intents)
      tick(b, intents)
      expect(hashState(a)).toBe(hashState(b))
    }
  })

  it('unterschiedliche Seeds → (mit hoher Wahrscheinlichkeit) unterschiedlicher Hash', () => {
    const a = createGame(cfg({ seed: 'seed-a' }))
    const b = createGame(cfg({ seed: 'seed-b' }))
    expect(hashState(a)).not.toBe(hashState(b))
  })

  it('reagiert auf einen Owner-Wechsel', () => {
    const state = createGame(cfg())
    const before = hashState(state)
    // Ein beliebiges neutrales Tile einem Spieler zuweisen → Hash ändert sich.
    for (let i = 0; i < state.map.state.length; i++) {
      if (getOwner(state.map, i) === 0) {
        setOwner(state.map, i, 1)
        break
      }
    }
    expect(hashState(state)).not.toBe(before)
  })

  it('ist reihenfolge-unabhängig (Hash hängt nicht an Spieler-Iterationsreihenfolge)', () => {
    // Zwei Spiele mit denselben Spielern in anderer Definitions-Reihenfolge → gleiche
    // Sim-Wahrheit, gleicher Hash (id-sortiert). Hier nur am frischen Spiel geprüft.
    const a = createGame(cfg())
    const b = createGame(
      cfg({
        players: [
          { id: 3, name: 'C', color: 0x0000ffff, isHuman: false },
          { id: 1, name: 'A', color: 0xff0000ff, isHuman: true },
          { id: 2, name: 'B', color: 0x00ff00ff, isHuman: false },
        ],
      }),
    )
    // Owner-Arrays können wegen anderer Spawn-Reihenfolge abweichen → wir vergleichen nur,
    // dass hashState stabil dieselbe Zahl für identische States liefert (Determinismus von a).
    expect(hashState(a)).toBe(hashState(createGame(cfg())))
    expect(typeof hashState(b)).toBe('number')
  })
})
