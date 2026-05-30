/**
 * Intent-Transport: trennt „Intents einsammeln" von „Tick ausführen".
 *
 * Dieselbe Abstraktion für Single- und Multiplayer (ADR-0009). Die Sim-Schleife in
 * `main.ts` reicht lokale Intents per {@link IntentTransport.submit} ein und treibt den
 * Tick-Fortschritt ausschließlich aus {@link IntentTransport.onCommitted} — `tick()` und
 * die Simulation bleiben unberührt.
 *
 * - {@link LocalTransport}: Single-Player. Besitzt die Takt-Uhr selbst, bündelt die
 *   eingereichten Intents pro Turn und hängt die „server-seitigen" Intents (lokal: die
 *   KI) an — exakt das Verhalten der alten `runSimTick`-Schleife.
 * - {@link NetworkTransport} (server-autoritatives Lockstep): `submit` schickt Intents an den
 *   Server (Ziel-Turn `aktuell + INPUT_DELAY`); `onCommitted` feuert, sobald der Server den
 *   Turn broadcastet (inkl. der vom Server erzeugten KI-Intents). Identisches Interface →
 *   `main.ts` ändert sich nicht. Match-Lebenszyklus (`start`/`snapshot`/Lobby) läuft über
 *   separate Callbacks, da das nicht zur reinen Tick-Naht gehört.
 *
 * Determinismus: der Transport benutzt **kein** `Date.now`/`Math.random` und keinen
 * Float-State — er puffert und bündelt nur. Der einzige Zeitgeber ist die externe
 * Takt-Uhr (Local: `window.setInterval`; Network: der Server).
 */

import type { GameConfig } from '../core/game'
import type { Intent } from '../core/intent'
import type { SerializedGameState } from '../core/serialize'
import {
  decodeServer,
  encode,
  type ClientMessage,
  type MatchSettings,
  type PeerInfo,
} from './protocol'

/** Ein committetes Intent-Set für genau einen Turn, in fester Anwendungsreihenfolge. */
export type CommitHandler = (turn: number, intents: readonly Intent[]) => void

export interface IntentTransport {
  /** Lokale Intents für den nächsten Turn einreichen (gepuffert, Reihenfolge bleibt erhalten). */
  submit(intents: readonly Intent[]): void
  /** Callback für committete Turns — feuert in Turn-Reihenfolge und treibt `tick()`. */
  onCommitted(cb: CommitHandler): void
  /** Takt-Uhr starten/stoppen (Pause). No-op bei serverseitiger Uhr. */
  setRunning(running: boolean): void
  /** Takt-Intervall in ms (Spiel-Tempo). No-op bei serverseitiger Uhr. */
  setIntervalMs(ms: number): void
  /** Ressourcen freigeben (Timer stoppen, Callbacks lösen). */
  destroy(): void
}

/** Liefert die „server-seitigen" Intents eines Turns (lokal: die KI-Entscheidungen). */
export type ServerIntentSource = () => readonly Intent[]

export interface LocalTransportOptions {
  /**
   * Wird unmittelbar vor jedem Commit aufgerufen und liefert die server-seitigen
   * Intents (lokal: die KI). Sie werden **nach** den eingereichten Intents angehängt
   * — exakt die Reihenfolge der alten Schleife ([UI-/Eingabe-Intents…, KI-Intents…]).
   */
  produceServerIntents: ServerIntentSource
  /** Start-Intervall in ms. */
  intervalMs: number
  /** Ob die Uhr sofort läuft (Default: false → erst per `setRunning(true)`). */
  running?: boolean
  /** Timer-Funktionen (für Tests injizierbar); Default: `window`. */
  timer?: {
    setInterval(handler: () => void, ms: number): number
    clearInterval(id: number): void
  }
}

/**
 * Single-Player-Transport: besitzt die Takt-Uhr, bündelt eingereichte Intents pro Turn
 * und hängt die KI-Intents an. Reproduziert das alte `runSimTick`/`restartSimInterval`-
 * Verhalten 1:1 (gleiche Intent-Reihenfolge, gleicher resultierender State).
 */
export class LocalTransport implements IntentTransport {
  private readonly produceServerIntents: ServerIntentSource
  private readonly timer: NonNullable<LocalTransportOptions['timer']>
  private buffer: Intent[] = []
  private handler: CommitHandler | null = null
  private turn = 0
  private intervalMs: number
  private running: boolean
  private timerId: number | null = null

  constructor(opts: LocalTransportOptions) {
    this.produceServerIntents = opts.produceServerIntents
    this.intervalMs = opts.intervalMs
    this.running = opts.running ?? false
    this.timer = opts.timer ?? {
      setInterval: (h, ms) => window.setInterval(h, ms),
      clearInterval: (id) => {
        window.clearInterval(id)
      },
    }
    this.restartTimer()
  }

  submit(intents: readonly Intent[]): void {
    if (intents.length === 0) return
    for (const intent of intents) this.buffer.push(intent)
  }

  onCommitted(cb: CommitHandler): void {
    this.handler = cb
  }

  setRunning(running: boolean): void {
    if (running === this.running) return
    this.running = running
    this.restartTimer()
  }

  setIntervalMs(ms: number): void {
    if (ms === this.intervalMs) return
    this.intervalMs = ms
    this.restartTimer()
  }

  destroy(): void {
    this.running = false
    this.clearTimer()
    this.handler = null
    this.buffer.length = 0
  }

  /**
   * Ein Turn: eingereichte Intents + KI-Intents bündeln und committen. Öffentlich, damit
   * Tests den Takt deterministisch treiben können (statt echte Timer zu nutzen).
   */
  step(): void {
    if (!this.running) return
    const committed: Intent[] = this.buffer
    this.buffer = []
    for (const intent of this.produceServerIntents()) committed.push(intent)
    this.handler?.(this.turn, committed)
    this.turn++
  }

  private restartTimer(): void {
    this.clearTimer()
    if (!this.running) return
    this.timerId = this.timer.setInterval(() => {
      this.step()
    }, this.intervalMs)
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      this.timer.clearInterval(this.timerId)
      this.timerId = null
    }
  }
}

/* ============================================================================
 * NetworkTransport (server-autoritatives Lockstep)
 * ========================================================================== */

/**
 * Minimaler, browser-/Node-kompatibler WebSocket-Ausschnitt (Browser-`WebSocket`-Stil; `ws`
 * unterstützt dieselben `on*`-Setter + `.data`). Injizierbar für Tests (`ws`) vs. Browser-Global.
 */
export interface WebSocketLike {
  send(data: string): void
  close(): void
  onopen: ((ev: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onclose: ((ev: unknown) => void) | null
  onerror: ((ev: unknown) => void) | null
}

export type WebSocketFactory = (url: string) => WebSocketLike

/** Start-Eingabeverzögerung (Turns), bis die erste Ping-Messung den adaptiven Wert setzt. */
export const DEFAULT_INPUT_DELAY = 3
/** Angenommene Server-Turn-Dauer (ms) für die Delay-Berechnung (= SIM_BASE_INTERVAL_MS). */
const TURN_MS = 100
/** Wie oft die RTT gemessen wird (ms). */
const PING_INTERVAL_MS = 2000
const MIN_INPUT_DELAY = 1
const MAX_INPUT_DELAY = 10

export interface NetworkTransportOptions {
  url: string
  /** Raum-Code; leer ⇒ der Server erstellt einen neuen und teilt ihn per `onJoined` mit. */
  room: string
  name: string
  /** Als reiner Zuschauer beitreten (kein Spieler-Slot): nur start/commit/snapshot empfangen. */
  spectate?: boolean
  /** Match-Start: der Server schickt die Config — der Verbraucher baut `createGame(config)`. */
  onStart: (config: GameConfig) => void
  /** Voller Snapshot (Resync nach Desync / Reconnect) — Verbraucher lädt `deserializeState`. */
  onSnapshot?: (turn: number, state: SerializedGameState) => void
  /** Beitritt bestätigt (eigene Spieler-ID + tatsächlicher Raum-Code). */
  onJoined?: (playerId: number, room: string) => void
  /** Lobby-Aktualisierung (Teilnehmer + Ready, aktuelle Settings, Host-ID). */
  onLobby?: (
    peers: readonly (PeerInfo & { ready: boolean })[],
    settings: MatchSettings,
    hostId: number,
  ) => void
  /**
   * Fester Override der Eingabeverzögerung (Turns). Ohne Angabe wird der Delay **adaptiv** aus
   * der gemessenen Latenz (ping/pong) bestimmt — lokal ~1 Turn, bei Internet automatisch mehr.
   */
  inputDelay?: number
  /** WebSocket-Konstruktor (Default: globaler `WebSocket`; Tests injizieren `ws`). */
  socketFactory?: WebSocketFactory
}

/**
 * Client-Transport gegen den Lockstep-Server. Erfüllt {@link IntentTransport}: `submit` schickt
 * eigene Intents an den Server (Ziel-Turn `nächster Commit + inputDelay`), `onCommitted` feuert
 * pro Server-`commit`. Die Turn-Uhr liegt beim Server → `setRunning`/`setIntervalMs` sind No-ops.
 */
export class NetworkTransport implements IntentTransport {
  private readonly ws: WebSocketLike
  private readonly opts: NetworkTransportOptions
  /** Fester Override (falls gesetzt) — sonst wird `adaptiveDelay` benutzt. */
  private readonly fixedDelay: number | undefined
  /** Adaptiv aus der Latenz gesetzter Delay (Turns); Start = Default, bis der erste Pong kommt. */
  private adaptiveDelay = DEFAULT_INPUT_DELAY
  /** Geglättete RTT (ms) für die Delay-Berechnung. */
  private rttMs = -1
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private destroyed = false
  /** Wird bei UNERWARTETEM Verbindungsabbruch gerufen (nicht bei `destroy()`). */
  private disconnectHandler: (() => void) | null = null
  private handler: CommitHandler | null = null
  /** Mid-Match-Snapshot-Handler (ADR-0009 Phase 6) — getrennt von `opts.onSnapshot` (Lobby-Build). */
  private snapshotHandler: ((turn: number, state: SerializedGameState) => void) | null = null
  /** Match-Pause-Zustand vom Server (Host hat pausiert/fortgesetzt). */
  private pauseHandler: ((paused: boolean) => void) | null = null
  /** Commits, die vor dem Registrieren von `onCommitted` eintrafen (Start-Rennen abfangen). */
  private pending: { turn: number; intents: readonly Intent[] }[] = []
  /** Zuletzt committeter Turn vom Server (−1 = noch keiner). */
  private lastCommittedTurn = -1

  constructor(opts: NetworkTransportOptions) {
    this.opts = opts
    this.fixedDelay = opts.inputDelay
    const factory: WebSocketFactory =
      opts.socketFactory ?? ((url) => new WebSocket(url) as unknown as WebSocketLike)
    this.ws = factory(opts.url)
    this.ws.onopen = (): void => {
      this.sendMsg({
        kind: 'join',
        room: opts.room,
        name: opts.name,
        ...(opts.spectate === true ? { spectate: true } : {}),
      })
      // Latenz-Messung starten (nur sinnvoll ohne festen Override; Zuschauer reichen nichts ein).
      if (this.fixedDelay === undefined && opts.spectate !== true) {
        this.sendPing()
        this.pingTimer = setInterval(() => this.sendPing(), PING_INTERVAL_MS)
      }
    }
    this.ws.onmessage = (ev): void => {
      this.handleMessage(String(ev.data))
    }
    this.ws.onclose = (): void => {
      if (!this.destroyed) this.disconnectHandler?.()
    }
    this.ws.onerror = null
  }

  /** Handler für unerwarteten Verbindungsabbruch setzen (z.B. → „Wieder verbinden"-UI). */
  onDisconnect(cb: () => void): void {
    this.disconnectHandler = cb
  }

  /**
   * Registriert den Mid-Match-Snapshot-Handler: feuert, wenn der Server während des laufenden
   * Matches einen Korrektur-Snapshot schickt (Desync-Resync). Der Verbraucher lädt ihn in-place
   * in den laufenden State. Läuft zusätzlich zu `opts.onSnapshot` (das den Erst-Build bedient).
   */
  setSnapshotHandler(cb: (turn: number, state: SerializedGameState) => void): void {
    this.snapshotHandler = cb
  }

  /** Aktuelle Eingabeverzögerung (Turns): fester Override oder der adaptive Wert. */
  get inputDelay(): number {
    return this.fixedDelay ?? this.adaptiveDelay
  }

  submit(intents: readonly Intent[]): void {
    if (intents.length === 0) return
    const targetTurn = this.lastCommittedTurn + 1 + this.inputDelay
    this.sendMsg({ kind: 'submit-intents', turn: targetTurn, intents: [...intents] })
  }

  private sendPing(): void {
    // I/O-Zeitstempel (kein Sim-Determinismus) — performance.now() ist in Browser + Node verfügbar.
    this.sendMsg({ kind: 'ping', t: globalThis.performance.now() })
  }

  /** Verarbeitet eine RTT-Messung und leitet daraus den adaptiven Input-Delay ab. */
  private updateLatency(rtt: number): void {
    this.rttMs = this.rttMs < 0 ? rtt : this.rttMs * 0.7 + rtt * 0.3
    // Delay muss die einfache Strecke (~RTT/2) bis zur Server-Deadline abdecken → + 1 Turn Puffer.
    const turns = Math.ceil(this.rttMs / 2 / TURN_MS) + 1
    this.adaptiveDelay = Math.max(MIN_INPUT_DELAY, Math.min(MAX_INPUT_DELAY, turns))
  }

  onCommitted(cb: CommitHandler): void {
    this.handler = cb
    // Vor der Registrierung eingetroffene Commits in Reihenfolge nachholen.
    const queued = this.pending
    this.pending = []
    for (const c of queued) cb(c.turn, c.intents)
  }

  // Die Uhr liegt beim Server — lokale Pause/Tempo-Steuerung greift im Lockstep nicht.
  setRunning(): void {
    /* no-op */
  }
  setIntervalMs(): void {
    /* no-op */
  }

  /** Bereit-Status in der Lobby melden (Match startet, wenn alle bereit sind). */
  setReady(ready: boolean): void {
    this.sendMsg({ kind: 'ready', ready })
  }

  /** Match-Settings setzen (nur als Host wirksam — der Server prüft das). */
  configure(settings: MatchSettings): void {
    this.sendMsg({ kind: 'configure', settings })
  }

  /** Eigenen State-Hash zu einem Turn melden — der Server prüft auf Desync (→ Snapshot). */
  reportHash(turn: number, hash: number): void {
    this.sendMsg({ kind: 'state-hash', turn, hash })
  }

  /** Vollen Snapshot anfordern (manueller Resync). */
  requestResync(): void {
    this.sendMsg({ kind: 'resync-request' })
  }

  /** Host-Pause an den Server schicken (nur der Host wird serverseitig akzeptiert). */
  requestPause(paused: boolean): void {
    this.sendMsg({ kind: 'set-pause', paused })
  }

  /** Registriert den Handler für den (server-broadcasteten) Match-Pause-Zustand. */
  setPauseHandler(cb: (paused: boolean) => void): void {
    this.pauseHandler = cb
  }

  destroy(): void {
    this.destroyed = true
    this.handler = null
    this.disconnectHandler = null
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    this.ws.onmessage = null
    this.ws.onopen = null
    try {
      this.ws.close()
    } catch {
      /* bereits geschlossen */
    }
  }

  private sendMsg(msg: ClientMessage): void {
    this.ws.send(encode(msg))
  }

  private handleMessage(raw: string): void {
    let msg
    try {
      msg = decodeServer(raw)
    } catch {
      return
    }
    switch (msg.kind) {
      case 'joined':
        this.opts.onJoined?.(msg.playerId, msg.room)
        break
      case 'lobby':
        this.opts.onLobby?.(msg.peers, msg.settings, msg.hostId)
        break
      case 'start':
        this.opts.onStart(msg.config)
        break
      case 'commit':
        this.lastCommittedTurn = msg.turn
        if (this.handler === null) this.pending.push({ turn: msg.turn, intents: msg.intents })
        else this.handler(msg.turn, msg.intents)
        break
      case 'snapshot':
        // Der Client springt nach einem Snapshot auf dessen Turn (Resync/Reconnect).
        this.lastCommittedTurn = msg.turn - 1
        this.opts.onSnapshot?.(msg.turn, msg.state)
        this.snapshotHandler?.(msg.turn, msg.state)
        break
      case 'pong':
        this.updateLatency(globalThis.performance.now() - msg.t)
        break
      case 'match-paused':
        this.pauseHandler?.(msg.paused)
        break
    }
  }
}
