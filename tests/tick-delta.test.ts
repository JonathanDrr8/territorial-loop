import { describe, expect, it } from 'vitest'

import { createGame, tick, type GameConfig } from '../src/core/game'
import { hashState } from '../src/core/hash'
import type { Intent } from '../src/core/intent'
import { getOwner } from '../src/world/map'
import { neighbors4 } from '../src/world/torus'
import { buildTickDelta } from '../src/worker/tick-delta'
import { applyTickDelta, createShadow } from '../src/worker/shadow-state'

function cfg(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mapWidth: 64,
    mapHeight: 64,
    seed: 'tick-delta-test',
    victoryPct: 99,
    terrain: 'flat',
    players: [
      { id: 1, name: 'A', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'B', color: 0x00ff00ff, isHuman: false },
      { id: 3, name: 'C', color: 0x0000ffff, isHuman: false },
    ],
    ...overrides,
  }
}

/** Ein neutrales Grenz-Tile eines Spielers (für Angriffs-Intents, die Eroberungen → dirtyTiles erzeugen). */
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

function attackIntents(state: ReturnType<typeof createGame>): Intent[] {
  const intents: Intent[] = []
  for (const pid of [1, 2, 3]) {
    const target = neutralBorder(state, pid)
    if (target >= 0)
      intents.push({ type: 'attack', playerId: pid, targetTile: target, troops: 1000 })
  }
  return intents
}

describe('TickDelta / Schatten-State (ADR-0030 — Sim-auf-Worker-Naht)', () => {
  it('frischer Schatten ist hash-identisch zum autoritativen State', () => {
    const s = createGame(cfg())
    const shadow = createShadow(s)
    expect(hashState(shadow)).toBe(hashState(s))
  })

  it('Schatten bleibt über 200 Ticks (mit Eroberungen) bit-genau hash-gleich', () => {
    const s = createGame(cfg())
    const shadow = createShadow(s)
    for (let i = 0; i < 200; i++) {
      tick(s, attackIntents(s))
      applyTickDelta(shadow, buildTickDelta(s))
      expect(hashState(shadow)).toBe(hashState(s))
    }
    // Owner-Array elementweise identisch (der Hash deckt es, aber explizit doppelt geprüft).
    const a = s.map.state
    const b = shadow.map.state
    expect(b.length).toBe(a.length)
    let diffs = 0
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diffs++
    expect(diffs).toBe(0)
  })

  it('Owner-Overflow-Pfad (ownerFull) snappt den Schatten korrekt auf den State', () => {
    const s = createGame(cfg())
    const shadow = createShadow(s)
    // State 30 Ticks ohne Schatten-Sync vorlaufen lassen → Schatten ist veraltet.
    for (let i = 0; i < 30; i++) tick(s, attackIntents(s))
    expect(hashState(shadow)).not.toBe(hashState(s))

    // Overflow erzwingen: alle Tiles als dirty markieren → buildTickDelta liefert ownerFull.
    s.dirtyTiles = Array.from({ length: s.map.state.length }, (_, i) => i)
    const delta = buildTickDelta(s)
    expect(delta.ownerFull).not.toBeNull()

    const didFull = applyTickDelta(shadow, delta)
    expect(didFull).toBe(true)
    expect(hashState(shadow)).toBe(hashState(s))
  })

  it('Spieler-frontier des Schattens bleibt erhalten (wird NICHT vom Delta überschrieben)', () => {
    const s = createGame(cfg())
    const shadow = createShadow(s)
    for (let i = 0; i < 20; i++) {
      tick(s, attackIntents(s))
      applyTickDelta(shadow, buildTickDelta(s))
    }
    // Jeder Schatten-Spieler hat noch ein frontier-Set (Referenz erhalten, nicht via Object.assign weg).
    for (const id of [1, 2, 3]) {
      const p = shadow.players.get(id)
      expect(p).toBeDefined()
      expect(p?.frontier instanceof Set).toBe(true)
    }
  })
})
