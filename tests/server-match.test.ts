import { describe, expect, it } from 'vitest'

import { ServerMatch } from '../server/match'
import { createGame, tick, type GameConfig } from '../src/core/game'
import { hashState } from '../src/core/hash'
import { deserializeState } from '../src/core/serialize'
import { getOwner } from '../src/world/map'
import { neighbors4 } from '../src/world/torus'

function cfg(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mapWidth: 80,
    mapHeight: 80,
    seed: 'server-test',
    victoryPct: 99,
    terrain: 'continents',
    players: [
      { id: 1, name: 'Mensch-A', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'Mensch-B', color: 0x00ff00ff, isHuman: true },
      { id: 3, name: 'KI', color: 0x0000ffff, isHuman: false },
      { id: 4, name: 'Wilde', color: 0x888888ff, isHuman: false, wild: true },
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

describe('ServerMatch — autoritative Sim (ADR-0009 Phase 4)', () => {
  it('Clients, die nur die Server-Commits anwenden, landen bit-genau beim Server-State', () => {
    const config = cfg()
    const server = new ServerMatch(config)
    // Zwei „Clients": fahren dieselbe Sim, wenden aber NUR die Server-Commits an (keine KI).
    const clientA = createGame(config)
    const clientB = createGame(config)

    for (let t = 0; t < 50; t++) {
      // Menschen reichen ab und zu Angriffe ein (für den Ziel-Turn t).
      if (t % 4 === 0) {
        const tgt = neutralBorder(clientA, 1)
        if (tgt >= 0)
          server.submitIntents(
            t,
            [{ type: 'attack', playerId: 1, targetTile: tgt, troops: 600 }],
            1,
          )
      }
      if (t % 6 === 0) {
        const tgt = neutralBorder(clientB, 2)
        if (tgt >= 0)
          server.submitIntents(
            t,
            [{ type: 'attack', playerId: 2, targetTile: tgt, troops: 600 }],
            2,
          )
      }

      const commit = server.advanceTurn()
      tick(clientA, commit.intents)
      tick(clientB, commit.intents)
      expect(hashState(clientA)).toBe(commit.hash)
      expect(hashState(clientB)).toBe(commit.hash)
    }
  })

  it('lehnt gespoofte Intents ab (fremde playerId)', () => {
    const server = new ServerMatch(cfg())
    const client = createGame(cfg())
    // Spieler 1 versucht, im Namen von Spieler 2 einzureichen → muss verworfen werden.
    server.submitIntents(0, [{ type: 'attack', playerId: 2, targetTile: 5, troops: 100 }], 1)
    const commit = server.advanceTurn()
    tick(client, commit.intents)
    // Kein Spoofing-Intent durchgekommen (Set enthält nur evtl. KI-Intents, keine von „2").
    expect(commit.intents.every((i) => i.playerId !== 2)).toBe(true)
    expect(hashState(client)).toBe(commit.hash)
  })

  it('verschiebt verspätete Intents in den nächsten offenen Turn (gehen nicht verloren)', () => {
    const server = new ServerMatch(cfg())
    server.advanceTurn() // Turn 0 ist durch
    server.advanceTurn() // Turn 1 ist durch → nextTurn = 2
    // Intent für den längst vergangenen Turn 0 → landet im aktuellen Turn 2.
    const client = createGame(cfg())
    const c0 = server.advanceTurn() // sollte hier nicht greifen (Turn 0 schon weg) …
    void c0
    // Neuer Versuch nachdem wir wissen: submit nach den ersten Ticks, Ziel 0.
    server.submitIntents(0, [{ type: 'build', playerId: 1, tile: 0, buildingType: 'city' }], 1)
    const c = server.advanceTurn()
    // Der verspätete Build-Intent ist im nächsten Commit enthalten.
    expect(c.intents.some((i) => i.type === 'build' && i.playerId === 1)).toBe(true)
    void client
  })

  it('verifyHash erkennt Übereinstimmung und Desync', () => {
    const server = new ServerMatch(cfg({ seed: 'verify' }))
    const commit = server.advanceTurn()
    expect(server.verifyHash(commit.turn, commit.hash)).toBe(true)
    expect(server.verifyHash(commit.turn, commit.hash ^ 0x1)).toBe(false)
    expect(server.verifyHash(99999, 0)).toBeUndefined()
  })

  it('Snapshot eines laufenden Matches lässt sich deserialisieren und stimmt mit dem Server überein', () => {
    const config = cfg({ seed: 'snap' })
    const server = new ServerMatch(config)
    const client = createGame(config)
    let lastHash = 0
    for (let t = 0; t < 30; t++) {
      const commit = server.advanceTurn()
      tick(client, commit.intents)
      lastHash = commit.hash
    }
    const snap = server.snapshot()
    expect(snap.turn).toBe(30)
    const restored = deserializeState(JSON.parse(JSON.stringify(snap.state)))
    expect(hashState(restored)).toBe(lastHash)
  })

  it('snapshot() ist pro Turn memoisiert (gleiche Referenz) und verfällt beim nächsten Turn', () => {
    const server = new ServerMatch(cfg({ seed: 'cache' }))
    for (let t = 0; t < 5; t++) server.advanceTurn()
    const a = server.snapshot()
    const b = server.snapshot()
    expect(b).toBe(a) // selber Turn → derselbe gecachte Blob (kein zweites serializeState)
    server.advanceTurn()
    const c = server.snapshot()
    expect(c).not.toBe(a) // Turn fortgeschritten → frisch serialisiert
    expect(c.turn).toBe(a.turn + 1)
  })
})
