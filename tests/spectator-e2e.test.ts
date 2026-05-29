import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'

import { startServer, type RunningServer } from '../server/server'
import { createGame, tick, type GameState } from '../src/core/game'
import { hashState } from '../src/core/hash'
import { deserializeState } from '../src/core/serialize'
import { decodeServer, encode, type GameListing } from '../src/net/protocol'

let server: RunningServer

beforeEach(async () => {
  server = await startServer(0)
})

afterEach(async () => {
  await server.close()
})

/** Spieler: tritt bei, meldet bei 2 Peers „ready", wendet Commits an, merkt sich Hash je Turn. */
function runPlayer(name: string, room: string, untilTurn: number): Promise<Map<number, number>> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${String(server.port)}`)
    let state: GameState | null = null
    let readied = false
    const hashes = new Map<number, number>()
    ws.on('open', () => ws.send(encode({ kind: 'join', room, name })))
    ws.on('message', (data: Buffer) => {
      const msg = decodeServer(data.toString())
      if (msg.kind === 'lobby' && !readied && msg.peers.length >= 2) {
        readied = true
        ws.send(encode({ kind: 'ready', ready: true }))
      } else if (msg.kind === 'start') {
        state = createGame(msg.config)
      } else if (msg.kind === 'commit' && state !== null) {
        tick(state, msg.intents)
        hashes.set(msg.turn, hashState(state))
        if (msg.turn >= untilTurn) {
          ws.close()
          resolve(hashes)
        }
      }
    })
    ws.on('error', reject)
  })
}

/** Zuschauer: tritt mit spectate=true bei, lädt den Snapshot, folgt den Commits. */
function runSpectator(room: string, untilTurn: number): Promise<{ turn: number; hash: number }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${String(server.port)}`)
    let state: GameState | null = null
    let snapTurn = -1
    let myId = 99
    ws.on('open', () => ws.send(encode({ kind: 'join', room, name: 'Spec', spectate: true })))
    ws.on('message', (data: Buffer) => {
      const msg = decodeServer(data.toString())
      if (msg.kind === 'joined') {
        myId = msg.playerId
      } else if (msg.kind === 'snapshot') {
        state = deserializeState(msg.state)
        snapTurn = msg.turn
      } else if (msg.kind === 'commit' && state !== null && msg.turn >= snapTurn) {
        tick(state, msg.intents)
        if (msg.turn >= untilTurn) {
          ws.close()
          resolve({ turn: msg.turn, hash: hashState(state) })
        }
      }
    })
    // Anti-Spoof: Zuschauer-ID muss -1 sein (kein Spieler-Slot).
    setTimeout(() => {
      if (myId !== -1) reject(new Error(`Spectator-ID erwartet -1, war ${String(myId)}`))
    }, 600)
    ws.on('error', reject)
  })
}

describe('Zuschauer-Modus end-to-end (ADR-0014 Phase 2)', () => {
  it('ein Zuschauer landet über Snapshot + Commits bit-genau beim selben State', async () => {
    const TARGET = 28
    const a = runPlayer('Alice', 'SPEC', TARGET)
    await new Promise((r) => setTimeout(r, 80))
    const b = runPlayer('Bob', 'SPEC', TARGET)
    // Zuschauer steigt erst ein, wenn das Match schon ein paar Turns läuft (→ echter Snapshot).
    await new Promise((r) => setTimeout(r, 400))
    const spec = runSpectator('SPEC', TARGET)

    const [aHashes, , specResult] = await Promise.all([a, b, spec])
    const playerHash = aHashes.get(specResult.turn)
    expect(playerHash).toBeDefined()
    expect(specResult.hash).toBe(playerHash)
  }, 15000)

  it('GET /games listet ein laufendes Match mit Seed für die Vorschau', async () => {
    // Anfangs keine laufenden Spiele.
    const empty = (await (
      await fetch(`http://localhost:${String(server.port)}/games`)
    ).json()) as GameListing[]
    expect(empty.length).toBe(0)

    const a = runPlayer('Alice', 'GAMES', 6)
    await new Promise((r) => setTimeout(r, 80))
    const b = runPlayer('Bob', 'GAMES', 6)
    // Kurz laufen lassen, dann /games abfragen, während das Match noch läuft.
    await new Promise((r) => setTimeout(r, 300))
    const games = (await (
      await fetch(`http://localhost:${String(server.port)}/games`)
    ).json()) as GameListing[]
    expect(games.length).toBe(1)
    expect(games[0]?.code).toBe('GAMES')
    expect(games[0]?.players).toBe(2)
    expect((games[0]?.seed.length ?? 0) > 0).toBe(true)

    await Promise.all([a, b])
  }, 15000)
})
