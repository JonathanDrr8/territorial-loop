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

  it('Host-Settings greifen: KI=0/Wilde=0 → Match nur mit den Menschen', async () => {
    const startConfig = new Promise<number>((resolve, reject) => {
      let myId = 0
      let configured = false
      let readied = false
      let t: NetworkTransport | null = null
      t = new NetworkTransport({
        url: `ws://localhost:${String(server.port)}`,
        room: 'CFG',
        name: 'Host',
        socketFactory,
        onJoined: (playerId) => {
          myId = playerId
        },
        onLobby: (peers, settings, hostId) => {
          if (myId === hostId && !configured) {
            configured = true
            t?.configure({ ...settings, aiCount: 0, wildCount: 0 })
          }
          if (!readied && peers.length >= 2) {
            readied = true
            t?.setReady(true)
          }
        },
        onStart: (config) => {
          t?.destroy()
          resolve(config.players.length)
        },
      })
      setTimeout(() => reject(new Error('host timeout')), 12000)
    })
    // Zweiter Spieler, damit „alle bereit" erreichbar ist.
    await new Promise((r) => setTimeout(r, 100))
    const guest = runClient('Gast', 'CFG', 3).catch(() => 0) // läuft kurz mit
    const playerCount = await startConfig
    await guest
    expect(playerCount).toBe(2) // 2 Menschen, 0 KI, 0 Wilde
  }, 15000)
})
