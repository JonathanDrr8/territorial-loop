import { describe, expect, it } from 'vitest'

import { createGame, tick, type GameConfig } from '../src/core/game'
import { hashState } from '../src/core/hash'
import type { Intent } from '../src/core/intent'
import type { Warship } from '../src/core/ships'
import { getOwner } from '../src/world/map'
import { neighbors4 } from '../src/world/torus'
import { buildTickDelta } from '../src/worker/tick-delta'
import { applyTickDelta, createShadow } from '../src/worker/shadow-state'

/** Minimal-Kriegsschiff für die Schiff-Listen-Tests (synthetisch; Kämpfe wären zu aufwändig). */
function makeWarship(overrides: Partial<Warship> = {}): Warship {
  return {
    ownerId: 1,
    path: [1, 2],
    progress: 0,
    dir: 1,
    hp: 4,
    cooldown: 0,
    mode: 'patrol',
    returning: false,
    ...overrides,
  }
}

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

  it('Schatten-frontier bleibt über 120 Ticks korrekt (== autoritativ, Set-gleich)', () => {
    const s = createGame(cfg())
    const shadow = createShadow(s)
    for (let i = 0; i < 120; i++) {
      tick(s, attackIntents(s))
      applyTickDelta(shadow, buildTickDelta(s))
    }
    for (const id of [1, 2, 3]) {
      const a = s.players.get(id)?.frontier
      const b = shadow.players.get(id)?.frontier
      expect(b instanceof Set).toBe(true)
      expect(b?.size).toBe(a?.size)
      let missing = 0
      if (a !== undefined && b !== undefined) for (const t of a) if (!b.has(t)) missing++
      expect(missing).toBe(0)
    }
  })

  it('Owner-Overflow rebaut die Frontiers korrekt', () => {
    const s = createGame(cfg())
    const shadow = createShadow(s)
    for (let i = 0; i < 30; i++) tick(s, attackIntents(s))
    s.dirtyTiles = Array.from({ length: s.map.state.length }, (_, i) => i)
    applyTickDelta(shadow, buildTickDelta(s))
    for (const id of [1, 2, 3]) {
      expect(shadow.players.get(id)?.frontier.size).toBe(s.players.get(id)?.frontier.size)
    }
  })

  it('render-flüchtige Listen landen im Schatten (goldPops/bombImpacts/flakShots/projectiles)', () => {
    const s = createGame(cfg())
    const shadow = createShadow(s)
    // Synthetische Render-Einträge — die entstehen sonst nur in Spätspiel-Kämpfen.
    s.goldPops.push({ tile: 5, amount: 300, ownerId: 1, atTick: s.tick })
    s.bombImpacts.push({ tile: 9, atTick: s.tick })
    s.flakShots.push({ fromX: 1, fromY: 2, toX: 3, toY: 4, atTick: s.tick, ownerId: 2 })
    const target = makeWarship({ ownerId: 2, path: [20, 21], progress: 0.5 })
    s.projectiles.push({
      shooter: makeWarship({ path: [10, 11, 12], progress: 1.5 }),
      target,
      targetKind: 'warship',
      fromX: 1,
      fromY: 1,
      travel: 1,
      impactAt: 5,
    })

    applyTickDelta(shadow, buildTickDelta(s))

    expect(shadow.goldPops).toEqual(s.goldPops)
    expect(shadow.bombImpacts).toEqual(s.bombImpacts)
    expect(shadow.flakShots).toEqual(s.flakShots)
    expect(shadow.projectiles.length).toBe(1)
    const p = shadow.projectiles[0]
    // Ziel-Position (path/progress) übernommen — aber als eigenständige Kopie (postMessage-sicher),
    // KEINE lebende Referenz aufs State-Schiff.
    expect(p?.target.path).toEqual([20, 21])
    expect(p?.target.progress).toBe(0.5)
    expect(p?.target).not.toBe(target)
  })

  it('Schiff-Identität bleibt bei gleicher Länge erhalten, bricht bei Längenänderung', () => {
    const s = createGame(cfg())
    const shadow = createShadow(s)
    s.warships.push(makeWarship({ path: [1, 2] }), makeWarship({ path: [3, 4] }))
    applyTickDelta(shadow, buildTickDelta(s))
    expect(shadow.warships.length).toBe(2)
    const ref0 = shadow.warships[0]
    const ref1 = shadow.warships[1]

    // Tick ohne Längenänderung (nur progress ändert sich) → gleiche Schatten-Objekte (Identität).
    const ws0 = s.warships[0]
    if (ws0 !== undefined) ws0.progress = 0.7
    applyTickDelta(shadow, buildTickDelta(s))
    expect(shadow.warships[0]).toBe(ref0)
    expect(shadow.warships[1]).toBe(ref1)
    expect(shadow.warships[0]?.progress).toBe(0.7) // Wert wurde in-place aktualisiert

    // Längenänderung (ein Schiff entfernt) → Neuaufbau, Identität bricht erwartungsgemäß.
    s.warships.pop()
    applyTickDelta(shadow, buildTickDelta(s))
    expect(shadow.warships.length).toBe(1)
    expect(shadow.warships[0]).not.toBe(ref0)
  })
})
