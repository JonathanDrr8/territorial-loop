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
 * startet, sobald alle Verbundenen „ready" sind. Bei Disconnect läuft die Nation idle weiter
 * (kein Einfrieren) und der Slot bleibt für einen Reconnect (gleicher Name → Snapshot).
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { appendFileSync, createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'

import { ServerMatch } from './match'
import type { Difficulty } from '../src/ai/ai'
import type { BuildingType } from '../src/core/buildings'
import type { GameConfig, PlayerDef } from '../src/core/game'
import type { TerrainType } from '../src/world/terrain'
import { pickRandomNames } from '../src/ui/player-names'
import {
  encode,
  decodeClient,
  type ClientMessage,
  type ServerMessage,
  type PeerInfo,
  type MatchSettings,
  type GameListing,
  type LobbyListing,
} from '../src/net/protocol'

const PORT = Number(process.env.PORT ?? 8787)
/** Turn-Takt in ms (entspricht SIM_BASE_INTERVAL_MS des Clients). */
const TURN_MS = 100

/**
 * Entzerrt Desync-Korrektur-Snapshots pro Socket: ein Client, der mehrere Turns in Folge einen
 * abweichenden Hash meldet (bis der eingespielte Snapshot greift), bekommt höchstens alle
 * ~3 s (= 30 Turns) einen neuen vollen Snapshot — verhindert einen „Snapshot-Sturm".
 */
const DESYNC_SNAPSHOT_COOLDOWN_TURNS = 30
const lastDesyncSnapshotTurn = new WeakMap<WebSocket, number>()

/** Verzeichnis der gebauten Client-App (Production). Default `dist/` relativ zum CWD. */
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? 'dist')

/** App-Version (von npm gesetzt, wenn via `npm run server` gestartet). */
const APP_VERSION = process.env.npm_package_version ?? 'dev'

/** Persistentes Verzeichnis für Spieler-Feedback/Bug-Reports (per Volume gemountet). */
const FEEDBACK_DIR = resolve(process.env.FEEDBACK_DIR ?? 'feedback')
const FEEDBACK_FILE = join(FEEDBACK_DIR, 'feedback.jsonl')

/** Nimmt einen Feedback-/Bug-POST an und hängt ihn als JSONL-Zeile an (persistiert via Volume). */
function handleFeedback(req: IncomingMessage, res: ServerResponse): void {
  let body = ''
  req.on('data', (c: Buffer) => {
    body += c.toString()
    if (body.length > 8000) req.destroy() // Schutz vor Riesen-Payloads
  })
  req.on('end', () => {
    try {
      const p = JSON.parse(body) as { text?: unknown; version?: unknown; kind?: unknown }
      const text = String(p.text ?? '')
        .slice(0, 2000)
        .trim()
      if (text.length === 0) {
        res.writeHead(400, { 'access-control-allow-origin': '*' })
        res.end()
        return
      }
      const entry = {
        ts: new Date().toISOString(),
        kind: p.kind === 'bug' ? 'bug' : 'feedback',
        version: String(p.version ?? '').slice(0, 32),
        ip: (req.headers['x-forwarded-for'] ?? '').toString().split(',')[0]?.trim() ?? '',
        text,
      }
      mkdirSync(FEEDBACK_DIR, { recursive: true })
      appendFileSync(FEEDBACK_FILE, JSON.stringify(entry) + '\n')
      res.writeHead(204, { 'access-control-allow-origin': '*' })
      res.end()
    } catch {
      res.writeHead(400, { 'access-control-allow-origin': '*' })
      res.end()
    }
  })
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
}

/** Liefert eine Datei aus {@link STATIC_DIR}; unbekannte Pfade → index.html (SPA-Fallback). */
function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')
  // Pfad-Traversal abwehren: normalisieren, führende ../ entfernen, im Root verankern.
  const rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(STATIC_DIR, rel)
  if (
    !filePath.startsWith(STATIC_DIR) ||
    !existsSync(filePath) ||
    statSync(filePath).isDirectory()
  ) {
    filePath = join(STATIC_DIR, 'index.html')
  }
  if (!existsSync(filePath)) {
    res.writeHead(404)
    res.end()
    return
  }
  // Cache-Strategie: Vites Asset-Dateinamen tragen einen Content-Hash (`index-Dq2nIDPm.js`) → sie
  // sind unveränderlich und dürfen ewig gecacht werden. ALLES andere (v. a. index.html, die auf das
  // jeweils aktuelle Bundle zeigt) NIE cachen — sonst sieht der Spieler nach einem Deploy weiter die
  // alte Version (gecachte index.html → altes JS). `no-store` erzwingt frisches Laden bei jedem Besuch.
  const immutable = urlPath.startsWith('/assets/')
  res.writeHead(200, {
    'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'cache-control': immutable
      ? 'public, max-age=31536000, immutable'
      : 'no-store, must-revalidate',
  })
  createReadStream(filePath).pipe(res)
}

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
  rivers: false,
  public: true,
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
    rivers: s.rivers === true,
    ...(s.allowedBuildings !== undefined && {
      allowedBuildings: sanitizeAllowed(s.allowedBuildings),
    }),
    public: s.public !== false,
  }
}

/** Übernimmt nur die vier bekannten Gebäude-Flags (Schutz vor manipulierten Feldern). */
function sanitizeAllowed(
  a: Partial<Record<BuildingType, boolean>>,
): Partial<Record<BuildingType, boolean>> {
  const out: Partial<Record<BuildingType, boolean>> = {}
  for (const type of ['city', 'defense', 'port', 'factory', 'airport', 'flak'] as const) {
    if (a[type] === false) out[type] = false
  }
  return out
}

interface Member {
  readonly playerId: number
  name: string
  ready: boolean
  socket: WebSocket | null // null = getrennt (Slot bleibt für Reconnect)
}

interface Room {
  readonly code: string
  readonly members: Map<number, Member>
  /** Reine Zuschauer (kein Spieler-Slot): bekommen start/commit/snapshot, schicken keine Intents. */
  readonly spectators: Set<WebSocket>
  nextPlayerId: number
  hostId: number // erster Beitritt = Host (darf Settings setzen)
  settings: MatchSettings
  match: ServerMatch | null
  clock: ReturnType<typeof setInterval> | null
  /** Host-Pause: solange `true`, rückt der Server die Turn-Uhr NICHT vor (kein Commit). */
  paused: boolean
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

/**
 * Schickt bei bestätigtem Desync einen Korrektur-Snapshot an genau diesen Socket — aber
 * höchstens alle {@link DESYNC_SNAPSHOT_COOLDOWN_TURNS} Turns (Snapshot-Sturm-Schutz). Der
 * Snapshot selbst ist in {@link ServerMatch.snapshot} pro Turn gecacht.
 */
function sendDesyncSnapshot(socket: WebSocket, room: Room): void {
  const snap = room.match?.snapshot()
  if (snap === undefined) return
  const last = lastDesyncSnapshotTurn.get(socket)
  if (last !== undefined && snap.turn - last < DESYNC_SNAPSHOT_COOLDOWN_TURNS) return
  lastDesyncSnapshotTurn.set(socket, snap.turn)
  send(socket, { kind: 'snapshot', turn: snap.turn, state: snap.state })
}

function broadcast(room: Room, msg: ServerMessage): void {
  for (const m of room.members.values()) if (m.socket !== null) send(m.socket, msg)
  for (const s of room.spectators) send(s, msg)
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
  // Echte Eigennamen für KI UND Wilde (sprach-neutral); wild-Status markiert das UI via `wild`-Flag.
  const botNames = pickRandomNames(s.aiCount + s.wildCount)
  let nameIdx = 0
  for (let i = 0; i < s.aiCount; i++)
    players.push({
      id: ++id,
      name: botNames[nameIdx++] ?? `Nation ${String(i + 1)}`,
      color: colorFor(id),
      isHuman: false,
    })
  for (let i = 0; i < s.wildCount; i++)
    players.push({
      id: ++id,
      name: botNames[nameIdx++] ?? `Nation ${String(s.aiCount + i + 1)}`,
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
    rivers: s.rivers,
    ...(s.allowedBuildings !== undefined && { allowedBuildings: s.allowedBuildings }),
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
    if (match === null || room.paused) return // Host-Pause: Uhr steht still
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
      if (room.match?.verifyHash(msg.turn, msg.hash) === false) sendDesyncSnapshot(socket, room)
      break
    }
    case 'resync-request': {
      const snap = room.match?.snapshot()
      if (snap !== undefined) send(socket, { kind: 'snapshot', turn: snap.turn, state: snap.state })
      break
    }
    case 'set-pause': {
      // Nur der Host darf pausieren; im laufenden Match. Server-Uhr hält an → echte Pause für alle.
      if (member.playerId === room.hostId && room.match !== null && room.paused !== msg.paused) {
        room.paused = msg.paused
        broadcast(room, { kind: 'match-paused', paused: msg.paused })
      }
      break
    }
  }
}

/**
 * Nachrichten eines reinen Zuschauers (kein Spieler-Slot). Er schickt keine Intents; nur
 * Desync-Selbstkorrektur ist sinnvoll: bei Hash-Abweichung / auf Anfrage einen Snapshot NUR an
 * diesen Socket. ping wird bereits global (vor dem Join) beantwortet.
 */
function handleSpectatorMessage(socket: WebSocket, room: Room, msg: ClientMessage): void {
  if (msg.kind === 'state-hash') {
    if (room.match?.verifyHash(msg.turn, msg.hash) === false) sendDesyncSnapshot(socket, room)
  } else if (msg.kind === 'resync-request') {
    const snap = room.match?.snapshot()
    if (snap !== undefined) send(socket, { kind: 'snapshot', turn: snap.turn, state: snap.state })
  }
}

/** Räumt einen Raum auf, wenn niemand mehr verbunden ist (kein Spieler-Socket UND kein Zuschauer). */
function cleanupIfEmpty(room: Room): void {
  const noPlayers = [...room.members.values()].every((m) => m.socket === null)
  if (noPlayers && room.spectators.size === 0) {
    if (room.clock !== null) clearInterval(room.clock)
    rooms.delete(room.code)
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
    // Server-Browser: offene (noch nicht gestartete) Lobbys als JSON. CORS offen, da die
    // Dev-Seite (5173) den Server (8787) cross-origin abfragt.
    if (req.url === '/lobbies') {
      const open: LobbyListing[] = []
      for (const r of rooms.values()) {
        if (r.match !== null) continue // läuft schon → nicht beitretbar
        if (!r.settings.public) continue // privat → nicht im Server-Browser listen
        const host = [...r.members.values()].find((m) => m.playerId === r.hostId)
        open.push({
          code: r.code,
          host: host?.name ?? '?',
          players: [...r.members.values()].filter((m) => m.socket !== null).length,
          mapWidth: r.settings.mapWidth,
          aiCount: r.settings.aiCount,
          wildCount: r.settings.wildCount,
          terrain: r.settings.terrain,
        })
      }
      res.writeHead(200, {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
      })
      res.end(JSON.stringify(open))
      return
    }
    // Laufende, öffentliche Matches → im Lobby-Browser als „Zuschauen" + grobe Terrain-Vorschau.
    if (req.url === '/games') {
      const games: GameListing[] = []
      for (const r of rooms.values()) {
        if (r.match === null) continue // nur laufende
        if (!r.settings.public) continue // privat → nicht listen
        const host = [...r.members.values()].find((m) => m.playerId === r.hostId)
        games.push({
          code: r.code,
          host: host?.name ?? '?',
          players: [...r.members.values()].filter((m) => m.socket !== null).length,
          spectators: r.spectators.size,
          mapWidth: r.settings.mapWidth,
          mapHeight: r.settings.mapHeight,
          terrain: r.settings.terrain,
          seed: r.settings.seed.length > 0 ? r.settings.seed : `room-${r.code}`,
        })
      }
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
      res.end(JSON.stringify(games))
      return
    }
    if (req.url === '/version') {
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
      res.end(JSON.stringify({ version: APP_VERSION }))
      return
    }
    // Kann (room, name) wieder beitreten? = Raum existiert, Match läuft, ein getrennter Slot
    // dieses Namens wartet. Damit zeigt das Hauptmenü den „Wieder verbinden"-Knopf nur, wenn er
    // wirklich funktioniert (keine „Leiche" für längst beendete/verlassene Räume).
    if (req.url?.startsWith('/rejoinable')) {
      const q = new URL(req.url, 'http://x').searchParams
      const room = rooms.get((q.get('room') ?? '').toUpperCase())
      const name = q.get('name') ?? ''
      const ok =
        room !== undefined &&
        room.match !== null &&
        [...room.members.values()].some((m) => m.socket === null && m.name === name)
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
      res.end(JSON.stringify({ rejoinable: ok }))
      return
    }
    // Spieler-Feedback/Bug-Report: POST mit text/plain-Body (kein CORS-Preflight) → JSONL.
    if (req.url === '/feedback' && req.method === 'POST') {
      handleFeedback(req, res)
      return
    }
    // Statischer Client: die gebaute Spiel-App (dist/) auf derselben Domain ausliefern, damit ein
    // Node-Server Client + Lockstep abdeckt (Production). SPA-Fallback auf index.html. Existiert
    // dist/ nicht (lokale Dev — da liefert Vite die App), bleibt es bei 404.
    if (req.method === 'GET' && existsSync(STATIC_DIR)) {
      serveStatic(req, res)
      return
    }
    res.writeHead(404)
    res.end()
  })

  const wss = new WebSocketServer({ server: httpServer })

  wss.on('connection', (socket) => {
    let room: Room | null = null
    let member: Member | null = null
    let spectator = false

    socket.on('message', (data) => {
      let msg: ClientMessage
      try {
        msg = decodeClient(data.toString())
      } catch {
        return // ungültiges JSON ignorieren
      }

      // Latenz-Messung jederzeit beantworten (auch vor dem Join) — Client misst die RTT daraus.
      if (msg.kind === 'ping') {
        send(socket, { kind: 'pong', t: msg.t })
        return
      }

      // Erste Nachricht MUSS 'join' sein (legt Raum/Slot an bzw. hängt einen Zuschauer an).
      if (room === null) {
        if (msg.kind !== 'join') return

        // Zuschauer: kein Spieler-Slot. Raum muss existieren; bei laufendem Match sofort
        // start + Snapshot, danach folgt der Zuschauer den Commits (broadcast inkl. Spectators).
        if (msg.spectate === true) {
          const r = rooms.get(msg.room.toUpperCase())
          if (r === undefined) {
            socket.close()
            return
          }
          r.spectators.add(socket)
          room = r
          spectator = true
          send(socket, { kind: 'joined', room: r.code, playerId: -1 })
          if (r.match !== null) {
            send(socket, { kind: 'start', config: r.match.config })
            const snap = r.match.snapshot()
            send(socket, { kind: 'snapshot', turn: snap.turn, state: snap.state })
          }
          return
        }

        const code = msg.room.length > 0 ? msg.room.toUpperCase() : makeRoomCode()
        let r = rooms.get(code)
        if (r === undefined) {
          r = {
            code,
            members: new Map(),
            spectators: new Set(),
            nextPlayerId: 1,
            hostId: 0,
            settings: DEFAULT_SETTINGS,
            match: null,
            clock: null,
            paused: false,
          }
          rooms.set(code, r)
        }
        // Reconnect: ein getrennter Slot (socket === null) gleichen Namens wird übernommen.
        // Die Nation lief in der Zwischenzeit ganz normal idle weiter (kein Einfrieren).
        const freeSlot = [...r.members.values()].find(
          (m) => m.socket === null && m.name === msg.name,
        )
        if (freeSlot !== undefined) {
          freeSlot.socket = socket
          member = freeSlot
          room = r
          send(socket, { kind: 'joined', room: code, playerId: freeSlot.playerId })
          const snap = r.match?.snapshot()
          if (r.match !== null) {
            // start + snapshot NUR an den Zurückkehrenden — die anderen spielen unbeirrt weiter.
            send(socket, { kind: 'start', config: r.match.config })
            if (snap !== undefined)
              send(socket, { kind: 'snapshot', turn: snap.turn, state: snap.state })
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

      if (member !== null) handleMessage(socket, room, member, msg)
      else if (spectator) handleSpectatorMessage(socket, room, msg)
    })

    socket.on('close', () => {
      if (room === null) return
      if (spectator) {
        room.spectators.delete(socket)
        cleanupIfEmpty(room)
        return
      }
      if (member === null) return
      member.socket = null
      // Laufendes Match: Slot für einen möglichen Reconnect halten — die Nation läuft in der
      // Sim ganz normal idle weiter (kein Einfrieren) und wird ggf. von anderen erobert.
      // Vor dem Start (Lobby): Slot entfernen.
      if (room.match === null) {
        room.members.delete(member.playerId)
      }
      sendLobby(room)
      cleanupIfEmpty(room)
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
