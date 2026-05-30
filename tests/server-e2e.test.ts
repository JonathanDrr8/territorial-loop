import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'

import { startServer, type RunningServer } from '../server/server'
import { createGame, tick, type GameState } from '../src/core/game'
import { hashState } from '../src/core/hash'
import { decodeServer, encode } from '../src/net/protocol'

let server: RunningServer

beforeEach(async () => {
  server = await startServer(0) // ephemerer Port
})

afterEach(async () => {
  await server.close()
})

/**
 * Verbindet einen WS-Client, der dem Raum beitritt, nach 2 Lobby-Peers „ready" meldet und die
 * Server-Commits anwendet. Resolved mit dem End-Hash nach `targetCommits` Turns.
 */
function runClient(name: string, room: string, targetCommits: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${String(server.port)}`)
    let state: GameState | null = null
    let turns = 0
    let readied = false
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
        turns++
        if (turns >= targetCommits) {
          const h = hashState(state)
          ws.close()
          resolve(h)
        }
      }
    })
    ws.on('error', reject)
  })
}

describe('Lockstep-Server end-to-end (ADR-0009 Phase 4)', () => {
  it('Health-Endpoint antwortet', async () => {
    const res = await fetch(`http://localhost:${String(server.port)}/health`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('zwei echte WS-Clients laufen über die Server-Commits in Lockstep (gleicher Hash)', async () => {
    const a = runClient('Alice', 'E2E', 25)
    // Kurz versetzt beitreten, damit Alice zuerst den Raum erstellt.
    await new Promise((r) => setTimeout(r, 100))
    const b = runClient('Bob', 'E2E', 25)
    const [ha, hb] = await Promise.all([a, b])
    expect(ha).toBe(hb)
  }, 15000)

  it('GET /lobbies listet offene Räume für den Server-Browser', async () => {
    // Anfangs leer.
    const empty = await (await fetch(`http://localhost:${String(server.port)}/lobbies`)).json()
    expect(Array.isArray(empty)).toBe(true)
    expect(empty.length).toBe(0)

    // Ein Client erstellt einen Raum (leerer Code → neuer Raum) und bleibt in der Lobby.
    const ws = new WebSocket(`ws://localhost:${String(server.port)}`)
    const code = await new Promise<string>((resolve, reject) => {
      ws.on('open', () => ws.send(encode({ kind: 'join', room: '', name: 'Host' })))
      ws.on('message', (d: Buffer) => {
        const m = decodeServer(d.toString())
        if (m.kind === 'joined') resolve(m.room)
      })
      ws.on('error', reject)
      setTimeout(() => reject(new Error('join timeout')), 5000)
    })

    const lobbies = await (await fetch(`http://localhost:${String(server.port)}/lobbies`)).json()
    expect(lobbies.length).toBe(1)
    expect(lobbies[0].code).toBe(code)
    expect(lobbies[0].host).toBe('Host')
    expect(lobbies[0].players).toBe(1)
    ws.close()
  }, 10000)

  it('Host pausiert das Match (Server-Uhr hält an); Nicht-Host wird ignoriert', async () => {
    interface Client {
      ws: WebSocket
      commits: () => number
      send: (m: Parameters<typeof encode>[0]) => void
      paused: () => boolean
    }
    const mkClient = (name: string): Promise<Client> =>
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${String(server.port)}`)
        let commits = 0
        let readied = false
        let paused = false
        let started = false
        ws.on('open', () => ws.send(encode({ kind: 'join', room: 'PAUSE', name })))
        ws.on('message', (d: Buffer) => {
          const m = decodeServer(d.toString())
          if (m.kind === 'lobby' && !readied && m.peers.length >= 2) {
            readied = true
            ws.send(encode({ kind: 'ready', ready: true }))
          } else if (m.kind === 'start') {
            started = true
            resolve({
              ws,
              commits: () => commits,
              send: (msg) => ws.send(encode(msg)),
              paused: () => paused,
            })
          } else if (m.kind === 'commit') {
            commits++
          } else if (m.kind === 'match-paused') {
            paused = m.paused
          }
        })
        ws.on('error', reject)
        setTimeout(() => {
          if (!started) reject(new Error(`start timeout (${name})`))
        }, 6000)
      })

    // Beide PARALLEL verbinden — Start braucht beide „ready", also nicht sequenziell awaiten.
    const hostP = mkClient('Host')
    await new Promise((r) => setTimeout(r, 60)) // Host erstellt den Raum zuerst
    const guestP = mkClient('Guest')
    const [host, guest] = await Promise.all([hostP, guestP])

    // Match läuft an → ein paar Commits abwarten.
    await new Promise((r) => setTimeout(r, 400))
    expect(host.commits()).toBeGreaterThan(0)

    // Nicht-Host (Gast) versucht zu pausieren → muss ignoriert werden (Commits laufen weiter).
    const beforeGuestPause = host.commits()
    guest.send({ kind: 'set-pause', paused: true })
    await new Promise((r) => setTimeout(r, 300))
    expect(host.paused()).toBe(false)
    expect(host.commits()).toBeGreaterThan(beforeGuestPause)

    // Host pausiert → Server-Uhr hält an, beide sehen `paused`, keine weiteren Commits.
    host.send({ kind: 'set-pause', paused: true })
    await new Promise((r) => setTimeout(r, 200))
    expect(host.paused()).toBe(true)
    expect(guest.paused()).toBe(true)
    const atPause = host.commits()
    await new Promise((r) => setTimeout(r, 400))
    expect(host.commits()).toBe(atPause) // keine Commits während Pause

    // Host setzt fort → Commits laufen wieder.
    host.send({ kind: 'set-pause', paused: false })
    await new Promise((r) => setTimeout(r, 300))
    expect(host.paused()).toBe(false)
    expect(host.commits()).toBeGreaterThan(atPause)

    host.ws.close()
    guest.ws.close()
  }, 15000)
})
