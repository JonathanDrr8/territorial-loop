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
 * - `NetworkTransport` (später, Phase 4): `submit` schickt Intents an den Server;
 *   `onCommitted` feuert, sobald der Server den Turn broadcastet (inkl. der vom Server
 *   erzeugten KI-Intents). Identisches Interface → `main.ts` ändert sich nicht.
 *
 * Determinismus: der Transport benutzt **kein** `Date.now`/`Math.random` und keinen
 * Float-State — er puffert und bündelt nur. Der einzige Zeitgeber ist die externe
 * Takt-Uhr (Local: `window.setInterval`; Network: der Server).
 */

import type { Intent } from '../core/intent'

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
