import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'

import { startServer, type RunningServer } from '../server/server'
import { NetworkTransport, type WebSocketLike } from '../src/net/transport'
import { createGame, tick, type GameState } from '../src/core/game'
import { hashState } from '../src/core/hash'

let server: RunningServer

beforeEach(async () => {
  server = await startServer(0)
})

afterEach(async () => {
  await server.close()
})

const socketFactory = (url: string): WebSocketLike => new WebSocket(url) as unknown as WebSocketLike

/**
 * Ein NetworkTransport-„Client": baut bei `start` das Spiel, ticked die Server-Commits, meldet
 * sich „ready", sobald ≥2 Peers in der Lobby sind. Resolved mit dem End-Hash nach `target` Turns.
 */
function runClient(name: string, room: string, target: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let state: GameState | null = null
    let turns = 0
    let readied = false
    let transport: NetworkTransport | null = null
    transport = new NetworkTransport({
      url: `ws://localhost:${String(server.port)}`,
      room,
      name,
      socketFactory,
      onLobby: (peers) => {
        if (!readied && peers.length >= 2) {
          readied = true
          transport?.setReady(true)
        }
      },
      onStart: (config) => {
        state = createGame(config)
      },
    })
    transport.onCommitted((turn, intents) => {
      if (state === null) return
      tick(state, intents)
      // Desync-Selbstmeldung an den Server (sollte „in sync" sein → kein Snapshot zurück).
      transport?.reportHash(turn, hashState(state))
      turns++
      if (turns >= target) {
        const h = hashState(state)
        transport?.destroy()
        resolve(h)
      }
    })
    setTimeout(() => reject(new Error(`${name} timeout`)), 12000)
  })
}

describe('NetworkTransport — Client-Lockstep gegen den Server (ADR-0009 Phase 5)', () => {
  it('zwei NetworkTransports laufen über die Server-Commits in Lockstep (gleicher Hash)', async () => {
    const a = runClient('Alice', 'NT', 25)
    await new Promise((r) => setTimeout(r, 100))
    const b = runClient('Bob', 'NT', 25)
    const [ha, hb] = await Promise.all([a, b])
    expect(ha).toBe(hb)
  }, 15000)
})
