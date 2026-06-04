/**
 * `WorkerNetTransport` (ADR-0030 Stufe 3): der `IntentTransport`, mit dem `createSimHost` IM Sim-Worker
 * den Mehrspieler-Tick treibt. Anders als der `NetworkTransport` (der auf dem Hauptthread am WebSocket
 * hängt) ist dieser hier **passiv**: der Hauptthread reicht die vom Server committeten Turns per
 * `deliverCommit` herein, und der gemeldete State-Hash geht per Callback zurück an den Hauptthread (der
 * ihn an den Server weiterleitet).
 *
 * - `submit` ist ein **No-op**: im Mehrspieler reicht der Hauptthread die UI-Intents DIREKT an den Server
 *   (`NetworkTransport.submit`); der Worker submittet nie.
 * - `setRunning`/`setIntervalMs` sind No-ops (die Takt-Uhr ist der Server).
 *
 * Erfüllt `HashReportingTransport` (= `IntentTransport` + `reportHash`), genau die Fläche, die
 * `createSimHost` von seinem `netTransport` nutzt → der Worker-Entry bleibt uniform (immer `createSimHost`).
 */

import type { Intent } from '../core/intent'
import type { CommitHandler, HashReportingTransport } from '../net/transport'

export class WorkerNetTransport implements HashReportingTransport {
  private handler: CommitHandler | null = null
  /** Commits, die vor dem Registrieren von `onCommitted` eintreffen (Start-Rennen-Absicherung). */
  private pending: { turn: number; intents: readonly Intent[] }[] = []

  /** `reportHashOut` postet den Turn-Hash zurück an den Hauptthread (→ an den Server). */
  constructor(private readonly reportHashOut: (turn: number, hash: number) => void) {}

  /** No-op: im Mehrspieler submittet der Hauptthread direkt an den Server, nicht der Worker. */
  submit(): void {
    /* siehe Klassen-Doc */
  }

  onCommitted(cb: CommitHandler): void {
    this.handler = cb
    const queued = this.pending
    this.pending = []
    for (const c of queued) cb(c.turn, c.intents)
  }

  /** Vom Hauptthread aufgerufen, sobald der Server einen Turn committet hat → treibt `tick()`. */
  deliverCommit(turn: number, intents: readonly Intent[]): void {
    if (this.handler === null) this.pending.push({ turn, intents })
    else this.handler(turn, intents)
  }

  reportHash(turn: number, hash: number): void {
    this.reportHashOut(turn, hash)
  }

  // Die Uhr liegt beim Server — lokale Pause/Tempo-Steuerung greift im Lockstep nicht.
  setRunning(): void {
    /* no-op */
  }
  setIntervalMs(): void {
    /* no-op */
  }

  destroy(): void {
    this.handler = null
    this.pending = []
  }
}
