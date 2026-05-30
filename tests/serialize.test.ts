import { describe, expect, it } from 'vitest'

import { createGame, tick, type GameConfig } from '../src/core/game'
import { hashState } from '../src/core/hash'
import { deserializeState, loadSnapshotInto, serializeState } from '../src/core/serialize'
import type { Intent } from '../src/core/intent'
import { getOwner, setOwner } from '../src/world/map'
import { neighbors4 } from '../src/world/torus'

function cfg(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mapWidth: 64,
    mapHeight: 64,
    seed: 'serialize-test',
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

/** Roundtrip durch JSON (so wie es übers Netz ginge) — fängt nicht-JSON-sichere Felder. */
function jsonRoundtrip(state: ReturnType<typeof createGame>): ReturnType<typeof createGame> {
  return deserializeState(JSON.parse(JSON.stringify(serializeState(state))))
}

describe('serializeState / deserializeState', () => {
  it('Roundtrip am frischen State → identischer Hash', () => {
    const s = createGame(cfg())
    expect(hashState(jsonRoundtrip(s))).toBe(hashState(s))
  })

  it('Roundtrip mitten im Spiel → identischer Hash', () => {
    const s = createGame(cfg())
    for (let i = 0; i < 25; i++) {
      const target = neutralBorder(s, 1)
      const intents: Intent[] =
        target >= 0 ? [{ type: 'attack', playerId: 1, targetTile: target, troops: 1500 }] : []
      tick(s, intents)
    }
    expect(hashState(jsonRoundtrip(s))).toBe(hashState(s))
  })

  it('deserialisierter State läuft BIT-GENAU weiter (PRNG-Zustand mitserialisiert)', () => {
    const original = createGame(cfg())
    for (let i = 0; i < 20; i++) tick(original, [])

    const restored = jsonRoundtrip(original)
    expect(hashState(restored)).toBe(hashState(original))

    // Beide ab hier mit identischem Intent-Strom weiter — müssen Tick für Tick gleich bleiben.
    for (let i = 0; i < 40; i++) {
      const target = neutralBorder(original, 1)
      const intents: Intent[] =
        target >= 0 ? [{ type: 'attack', playerId: 1, targetTile: target, troops: 1200 }] : []
      tick(original, intents)
      tick(restored, intents)
      expect(hashState(restored)).toBe(hashState(original))
    }
  })

  it('erhält Gebäude über den Roundtrip', () => {
    const s = createGame(cfg())
    // Ein Tile dem Menschen geben und dort eine Stadt bauen.
    const p = s.players.get(1)
    if (p === undefined) throw new Error('player 1 missing')
    p.gold = 100_000 // Stadt kostet 25k
    const homeTile = [...p.frontier][0] ?? 0
    tick(s, [{ type: 'build', playerId: 1, tile: homeTile, buildingType: 'city' }])

    const restored = jsonRoundtrip(s)
    expect(restored.buildings.size).toBe(s.buildings.size)
    expect(restored.buildings.size).toBeGreaterThan(0)
    expect(hashState(restored)).toBe(hashState(s))
  })

  it('rekonstruiert Frontiers (Angriff läuft nach Roundtrip weiter)', () => {
    const s = createGame(cfg())
    for (let i = 0; i < 10; i++) tick(s, [])
    const restored = jsonRoundtrip(s)
    for (const id of [1, 2, 3]) {
      const a = s.players.get(id)
      const b = restored.players.get(id)
      expect(b?.frontier.size).toBe(a?.frontier.size)
    }
  })

  it('erhält statische Ableitungen (passableLandCount) korrekt', () => {
    const s = createGame(cfg({ terrain: 'continents', mapWidth: 96, mapHeight: 96 }))
    for (let i = 0; i < 15; i++) tick(s, [])
    const restored = jsonRoundtrip(s)
    expect(restored.passableLandCount).toBe(s.passableLandCount)
    expect(hashState(restored)).toBe(hashState(s))
  })

  it('Snapshot ist unabhängig vom weiterlaufenden State (kein geteilter Speicher)', () => {
    const s = createGame(cfg())
    const snap = serializeState(s)
    const hashAtSnap = hashState(deserializeState(JSON.parse(JSON.stringify(snap))))
    // State danach mutieren …
    for (let i = 0; i < 5; i++) tick(s, [])
    setOwner(s.map, 0, 1)
    // … der Snapshot darf sich nicht mitverändert haben.
    expect(hashState(deserializeState(JSON.parse(JSON.stringify(snap))))).toBe(hashAtSnap)
  })
})

describe('loadSnapshotInto (Mid-Match-Resync, ADR-0009 Phase 6)', () => {
  it('schnappt einen abgedrifteten State IN-PLACE bit-genau auf den Snapshot zurück', () => {
    // Autoritativer Verlauf: Spieler 1 greift an.
    const authoritative = createGame(cfg())
    for (let i = 0; i < 20; i++) {
      const target = neutralBorder(authoritative, 1)
      tick(
        authoritative,
        target >= 0 ? [{ type: 'attack', playerId: 1, targetTile: target, troops: 1200 }] : [],
      )
    }
    const snap = JSON.parse(JSON.stringify(serializeState(authoritative))) as ReturnType<
      typeof serializeState
    >

    // Abgedrifteter Client: anderer Intent-Strom → garantiert anderer Hash.
    const drifted = createGame(cfg())
    for (let i = 0; i < 14; i++) {
      const target = neutralBorder(drifted, 2)
      tick(
        drifted,
        target >= 0 ? [{ type: 'attack', playerId: 2, targetTile: target, troops: 900 }] : [],
      )
    }
    expect(hashState(drifted)).not.toBe(hashState(authoritative))

    // Resync IN-PLACE: gleiche Objekt-Referenz, danach bit-genau wie der Snapshot.
    const ref = drifted
    loadSnapshotInto(drifted, snap)
    expect(drifted).toBe(ref) // Referenz erhalten → Closure-Halter sehen die Korrektur
    expect(hashState(drifted)).toBe(hashState(authoritative))

    // Läuft danach mit identischem Intent-Strom Tick für Tick deckungsgleich weiter.
    for (let i = 0; i < 30; i++) {
      const target = neutralBorder(authoritative, 1)
      const intents: Intent[] =
        target >= 0 ? [{ type: 'attack', playerId: 1, targetTile: target, troops: 1200 }] : []
      tick(authoritative, intents)
      tick(drifted, intents)
      expect(hashState(drifted)).toBe(hashState(authoritative))
    }
  })
})
