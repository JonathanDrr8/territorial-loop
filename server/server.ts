/**
 * Simulierender Lockstep-Server (ADR-0009 Phase 4): Node + `ws`.
 *
 * Autoritativer Koordinator UND Mitsimulant: hält je Raum eine {@link ServerMatch}, ist die
 * **Turn-Uhr** (fester Takt, wartet nicht auf Nachzügler), sammelt Client-Intents, lässt die
 * `ServerMatch` die KI ausführen + committen, und **broadcastet nur das committete Intent-Set**
 * (keine States im Normalbetrieb). Desync/Reconnect über `state-hash`/`snapshot`.
 *
 * Start: `npm run dev:server` (tsx). Health-Check: `GET /health`.
 *
 * MVP-Vereinfachungen (Lobby-Politur = Phase 5): Raum-Defaults statt Host-Konfiguration,
 * Start, sobald alle Verbundenen „ready" sind, feste kleine Karte.
 */

import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'

import { ServerMatch } from './match'
import type { GameConfig, PlayerDef } from '../src/core/game'
import {
  encode,
  decodeClient,
  type ClientMessage,
  type ServerMessage,
  type PeerInfo,
} from '../src/net/protocol'

const PORT = Number(process.env.PORT ?? 8787)
/** Turn-Takt in ms (entspricht SIM_BASE_INTERVAL_MS des Clients). */
const TURN_MS = 100
/** Default-Gegner/Wilde, bis die Lobby (Phase 5) das konfigurierbar macht. */
const DEFAULT_AI = 2
const DEFAULT_WILD = 2

interface Member {
  readonly playerId: number
  name: string
  ready: boolean
  socket: WebSocket | null // null = getrennt (eingefroren)
}

interface Room {
  readonly code: string
  readonly members: Map<number, Member>
  nextPlayerId: number
  match: ServerMatch | null
  clock: ReturnType<typeof setInterval> | null
}

const rooms = new Map<string, Room>()

function makeRoomCode(): string {
  // I/O-Zufall (kein Sim-Determinismus nötig). 4 Zeichen, gut tippbar.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return rooms.has(code) ? makeRoomCode() : code
}

function send(socket: WebSocket, msg: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(encode(msg))
}

function broadcast(room: Room, msg: ServerMessage): void {
  for (const m of room.members.values()) if (m.socket !== null) send(m.socket, msg)
}

function peerList(room: Room): (PeerInfo & { ready: boolean })[] {
  return [...room.members.values()].map((m) => ({
    playerId: m.playerId,
    name: m.name,
    connected: m.socket !== null,
    ready: m.ready,
  }))
}

function sendLobby(room: Room): void {
  broadcast(room, { kind: 'lobby', peers: peerList(room) })
}

/** Baut die Match-Config aus den menschlichen Mitgliedern + Default-KI/Wilden. */
function buildConfig(room: Room): GameConfig {
  const players: PlayerDef[] = []
  let id = 0
  for (const m of room.members.values()) {
    players.push({ id: m.playerId, name: m.name, color: colorFor(m.playerId), isHuman: true })
    id = Math.max(id, m.playerId)
  }
  for (let i = 0; i < DEFAULT_AI; i++)
    players.push({ id: ++id, name: `KI ${String(i + 1)}`, color: colorFor(id), isHuman: false })
  for (let i = 0; i < DEFAULT_WILD; i++)
    players.push({
      id: ++id,
      name: `Wilde ${String(i + 1)}`,
      color: 0x8f8a78ff,
      isHuman: false,
      wild: true,
    })
  return {
    mapWidth: 256,
    mapHeight: 256,
    seed: `room-${room.code}`,
    victoryPct: 90,
    terrain: 'continents',
    players,
  }
}

/** Schlichte, deterministische Farbe pro Slot (Lobby/Phase-5 ersetzt das durch echte Auswahl). */
function colorFor(id: number): number {
  const hues = [0xff4040ff, 0x40a0ffff, 0x40ff80ff, 0xffd040ff, 0xc060ffff, 0xff80c0ff]
  return hues[(id - 1) % hues.length] ?? 0xffffffff
}

function startMatch(room: Room): void {
  if (room.match !== null) return
  const config = buildConfig(room)
  room.match = new ServerMatch(config)
  broadcast(room, { kind: 'start', config })
  room.clock = setInterval(() => {
    const match = room.match
    if (match === null) return
    const commit = match.advanceTurn()
    broadcast(room, { kind: 'commit', turn: commit.turn, intents: commit.intents })
  }, TURN_MS)
  console.info(`[server] Raum ${room.code}: Match gestartet (${config.players.length} Spieler)`)
}

function maybeStart(room: Room): void {
  if (room.match !== null) return
  const connected = [...room.members.values()].filter((m) => m.socket !== null)
  if (connected.length > 0 && connected.every((m) => m.ready)) startMatch(room)
}

function handleMessage(socket: WebSocket, room: Room, member: Member, msg: ClientMessage): void {
  switch (msg.kind) {
    case 'join':
      // Bereits über die Verbindung beigetreten — ein erneutes join aktualisiert nur den Namen.
      member.name = msg.name || member.name
      sendLobby(room)
      break
    case 'ready':
      member.ready = msg.ready
      sendLobby(room)
      maybeStart(room)
      break
    case 'submit-intents':
      room.match?.submitIntents(msg.turn, msg.intents, member.playerId)
      break
    case 'state-hash': {
      const verdict = room.match?.verifyHash(msg.turn, msg.hash)
      if (verdict === false) {
        const snap = room.match?.snapshot()
        if (snap !== undefined)
          send(socket, { kind: 'snapshot', turn: snap.turn, state: snap.state })
      }
      break
    }
    case 'resync-request': {
      const snap = room.match?.snapshot()
      if (snap !== undefined) send(socket, { kind: 'snapshot', turn: snap.turn, state: snap.state })
      break
    }
  }
}

/** Laufender Server mit Handle zum Schließen (für Tests / sauberes Herunterfahren). */
export interface RunningServer {
  readonly port: number
  close(): Promise<void>
}

/**
 * Startet HTTP (Health) + WebSocket-Server auf `port` (0 = ephemerer Port). Gibt ein Handle
 * mit dem tatsächlichen Port und einer `close()`-Funktion zurück.
 */
export function startServer(port: number = PORT): Promise<RunningServer> {
  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('ok')
      return
    }
    res.writeHead(404)
    res.end()
  })

  const wss = new WebSocketServer({ server: httpServer })

  wss.on('connection', (socket) => {
    let room: Room | null = null
    let member: Member | null = null

    socket.on('message', (data) => {
      let msg: ClientMessage
      try {
        msg = decodeClient(data.toString())
      } catch {
        return // ungültiges JSON ignorieren
      }

      // Erste Nachricht MUSS 'join' sein (legt Raum + Slot an).
      if (room === null || member === null) {
        if (msg.kind !== 'join') return
        const code = msg.room.length > 0 ? msg.room.toUpperCase() : makeRoomCode()
        let r = rooms.get(code)
        if (r === undefined) {
          r = { code, members: new Map(), nextPlayerId: 1, match: null, clock: null }
          rooms.set(code, r)
        }
        // Reconnect: ein eingefrorener Slot gleichen Namens wird übernommen.
        const frozenSlot = [...r.members.values()].find(
          (m) => m.socket === null && m.name === msg.name,
        )
        if (frozenSlot !== undefined) {
          frozenSlot.socket = socket
          member = frozenSlot
          room = r
          r.match?.setFrozen(frozenSlot.playerId, false)
          send(socket, { kind: 'joined', room: code, playerId: frozenSlot.playerId })
          const snap = r.match?.snapshot()
          if (r.match !== null) {
            broadcast(r, { kind: 'start', config: r.match.config })
            if (snap !== undefined)
              send(socket, { kind: 'snapshot', turn: snap.turn, state: snap.state })
            broadcast(r, { kind: 'peer-frozen', playerId: frozenSlot.playerId, frozen: false })
          }
          sendLobby(r)
          return
        }
        const playerId = r.nextPlayerId++
        member = { playerId, name: msg.name || `Spieler ${String(playerId)}`, ready: false, socket }
        r.members.set(playerId, member)
        room = r
        send(socket, { kind: 'joined', room: code, playerId })
        sendLobby(r)
        return
      }

      handleMessage(socket, room, member, msg)
    })

    socket.on('close', () => {
      if (room === null || member === null) return
      member.socket = null
      if (room.match !== null) {
        // Laufendes Match: Nation einfrieren (angreifbar, Verbündete straffrei) statt entfernen.
        room.match.setFrozen(member.playerId, true)
        broadcast(room, { kind: 'peer-frozen', playerId: member.playerId, frozen: true })
      } else {
        room.members.delete(member.playerId)
      }
      sendLobby(room)
      // Leeren Raum aufräumen.
      if ([...room.members.values()].every((m) => m.socket === null)) {
        if (room.clock !== null) clearInterval(room.clock)
        rooms.delete(room.code)
      }
    })
  })

  return new Promise<RunningServer>((resolve) => {
    httpServer.listen(port, () => {
      const addr = httpServer.address()
      const actualPort = typeof addr === 'object' && addr !== null ? addr.port : port
      console.info(`[server] Lockstep-Server lauscht auf :${String(actualPort)} (Health: /health)`)
      resolve({
        port: actualPort,
        close: () =>
          new Promise<void>((res) => {
            for (const r of rooms.values()) if (r.clock !== null) clearInterval(r.clock)
            rooms.clear()
            wss.close(() => httpServer.close(() => res()))
          }),
      })
    })
  })
}

// Als Entrypoint gestartet (npm run server / dev:server) → sofort lauschen.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startServer()
}
