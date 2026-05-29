/**
 * Simulierender Lockstep-Server (ADR-0009 Phase 4): Node + `ws`.
 *
 * Autoritativer Koordinator UND Mitsimulant: hält je Raum eine {@link ServerMatch}, ist die
 * **Turn-Uhr** (fester Takt, wartet nicht auf Nachzügler), sammelt Client-Intents, lässt die
 * `ServerMatch` die KI ausführen + committen, und **broadcastet nur das committete Intent-Set**
 * (keine States im Normalbetrieb). Desync/Reconnect über `state-hash`/`snapshot`.
 *
 * Start: eigenständig per `npm run server` / `dev:server` (tsx) ODER automatisch zusammen mit
 * dem Vite-Dev-Server (Plugin in `vite.config.ts`). Health-Check: `GET /health`.
 *
 * Lobby-Modell: erster Beitritt wird Host und setzt die Match-Settings (`configure`); das Match
 * startet, sobald alle Verbundenen „ready" sind. Disconnect friert die Nation ein (angreifbar,
 * Verbündete straffrei), Reconnect/Desync bekommt einen Snapshot.
 */

import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'

import { ServerMatch } from './match'
import type { Difficulty } from '../src/ai/ai'
import type { GameConfig, PlayerDef } from '../src/core/game'
import type { TerrainType } from '../src/world/terrain'
import {
  encode,
  decodeClient,
  type ClientMessage,
  type ServerMessage,
  type PeerInfo,
  type MatchSettings,
} from '../src/net/protocol'

const PORT = Number(process.env.PORT ?? 8787)
/** Turn-Takt in ms (entspricht SIM_BASE_INTERVAL_MS des Clients). */
const TURN_MS = 100

/** Default-Match-Settings, bis der Host sie in der Lobby anpasst. */
const DEFAULT_SETTINGS: MatchSettings = {
  mapWidth: 256,
  mapHeight: 256,
  terrain: 'continents',
  seed: '',
  aiCount: 2,
  wildCount: 2,
  victoryPct: 90,
  difficulty: 'normal',
}

/** Begrenzt vom Host gesetzte Settings auf sinnvolle Bereiche (Schutz vor Unfug/Riesenkarten). */
function clampSettings(s: MatchSettings): MatchSettings {
  const clamp = (v: number, lo: number, hi: number): number =>
    Math.max(lo, Math.min(hi, Math.round(v)))
  const terrain: TerrainType =
    s.terrain === 'flat' || s.terrain === 'continents' || s.terrain === 'islands'
      ? s.terrain
      : 'continents'
  const difficulty: Difficulty =
    s.difficulty === 'easy' || s.difficulty === 'normal' || s.difficulty === 'hard'
      ? s.difficulty
      : 'normal'
  return {
    mapWidth: clamp(s.mapWidth, 64, 2048),
    mapHeight: clamp(s.mapHeight, 64, 2048),
    terrain,
    seed: typeof s.seed === 'string' ? s.seed.slice(0, 64) : '',
    aiCount: clamp(s.aiCount, 0, 200),
    wildCount: clamp(s.wildCount, 0, 400),
    victoryPct: clamp(s.victoryPct, 1, 100),
    difficulty,
  }
}

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
  hostId: number // erster Beitritt = Host (darf Settings setzen)
  settings: MatchSettings
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
  broadcast(room, {
    kind: 'lobby',
    peers: peerList(room),
    settings: room.settings,
    hostId: room.hostId,
  })
}

/** Baut die Match-Config aus den menschlichen Mitgliedern + den Host-Settings. */
function buildConfig(room: Room): GameConfig {
  const s = room.settings
  const players: PlayerDef[] = []
  let id = 0
  for (const m of room.members.values()) {
    players.push({ id: m.playerId, name: m.name, color: colorFor(m.playerId), isHuman: true })
    id = Math.max(id, m.playerId)
  }
  for (let i = 0; i < s.aiCount; i++)
    players.push({ id: ++id, name: `KI ${String(i + 1)}`, color: colorFor(id), isHuman: false })
  for (let i = 0; i < s.wildCount; i++)
    players.push({
      id: ++id,
      name: `Wilde ${String(i + 1)}`,
      color: 0x8f8a78ff,
      isHuman: false,
      wild: true,
    })
  return {
    mapWidth: s.mapWidth,
    mapHeight: s.mapHeight,
    seed: s.seed.length > 0 ? s.seed : `room-${room.code}`,
    victoryPct: s.victoryPct,
    terrain: s.terrain,
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
  room.match = new ServerMatch(config, room.settings.difficulty)
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
    case 'configure':
      // Nur der Host darf die Match-Settings setzen, und nur vor dem Start.
      if (member.playerId === room.hostId && room.match === null) {
        room.settings = clampSettings(msg.settings)
        sendLobby(room)
      }
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
          r = {
            code,
            members: new Map(),
            nextPlayerId: 1,
            hostId: 0,
            settings: DEFAULT_SETTINGS,
            match: null,
            clock: null,
          }
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
        if (r.hostId === 0) r.hostId = playerId // erster Beitritt wird Host
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

  return new Promise<RunningServer>((resolve, reject) => {
    // Listen-Fehler (z.B. Port belegt, weil schon ein Server läuft) als Rejection durchreichen,
    // statt den Prozess (z.B. den Vite-Dev-Server) abzuschießen. Sowohl der HTTP-Server als auch
    // der daran hängende WebSocketServer emittieren bei EADDRINUSE ein `error` — beide brauchen
    // einen Listener, sonst wirft Node trotz Promise-Rejection.
    const onError = (err: Error): void => {
      reject(err)
    }
    httpServer.once('error', onError)
    wss.once('error', onError)
    httpServer.listen(port, () => {
      httpServer.removeListener('error', onError)
      wss.removeListener('error', onError)
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
