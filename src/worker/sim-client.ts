/**
 * Sim-Client (ADR-0030 Stufe 2): der Main-seitige Proxy für den Sim-Worker. Spawnt den Worker,
 * hält den read-only Schatten und wendet die eingehenden `tick-delta`/`snapshot-full`-Nachrichten
 * darauf an. Exponiert dieselbe Steuer-Fläche wie der `SimHost` (`submit`/`setRunning`/
 * `setIntervalMs`/`destroy`), damit `main.ts` beide Pfade über dieselbe `SimController`-Naht treibt.
 *
 * Der Schatten wird vom Aufrufer fertig übergeben (deterministisch identisch zum Worker-State,
 * da `createGame`/`deserializeState` seeded sind) — der Worker schickt KEINEN initialen Voll-
 * Snapshot; jeder Tick-Delta überschreibt ohnehin alle dynamischen Felder, statische (Terrain/
 * Komponenten) liefert der lokal gebaute Schatten.
 */

import type { Difficulty } from '../ai/ai'
import type { GameConfig, GameState } from '../core/game'
import type { Intent } from '../core/intent'
import type { SerializedGameState } from '../core/serialize'
import type { AiConfig, MainToWorker, WorkerToMain } from './sim-protocol'
import { applyTickDelta, fullRefresh } from './shadow-state'

/** Gemeinsame Steuer-Fläche von `SimHost` (Nicht-Worker) und `SimClient` (Worker). */
export interface SimController {
  submit(intent: Intent): void
  setRunning(running: boolean): void
  setIntervalMs(ms: number): void
  destroy(): void
}

export interface SimClient extends SimController {
  /** Der read-only Render-Schatten, den dieser Client pro Tick aktualisiert. */
  readonly shadow: GameState
}

export interface SimClientOptions {
  /** Bereits gebauter Schatten (deterministisch == Worker-State); wird in-place aktualisiert. */
  readonly shadow: GameState
  readonly config: GameConfig
  readonly ais: readonly AiConfig[]
  readonly difficulty: Difficulty
  readonly rankedElo?: number
  readonly intervalMs: number
  /** Nur Reconnect/Resync: vom Server erhaltener Voll-Snapshot statt frisch generieren. */
  readonly snapshot?: SerializedGameState
  /** Nach jedem angewandten Delta/Snapshot: `true` bei Voll-Ersatz (→ `renderer.invalidate()`). */
  readonly onApplied: (didFull: boolean) => void
}

export function createSimClient(opts: SimClientOptions): SimClient {
  const { shadow, onApplied } = opts
  const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' })

  worker.onmessage = (ev: MessageEvent<WorkerToMain>): void => {
    const msg = ev.data
    switch (msg.type) {
      case 'ready':
        break
      case 'snapshot-full':
        fullRefresh(shadow, msg.snapshot)
        onApplied(true)
        break
      case 'tick-delta':
        onApplied(applyTickDelta(shadow, msg.delta))
        break
    }
  }

  const send = (m: MainToWorker): void => {
    worker.postMessage(m)
  }

  send({
    type: 'init',
    config: opts.config,
    ais: opts.ais,
    difficulty: opts.difficulty,
    ...(opts.rankedElo !== undefined ? { rankedElo: opts.rankedElo } : {}),
    intervalMs: opts.intervalMs,
    ...(opts.snapshot !== undefined ? { snapshot: opts.snapshot } : {}),
  })

  return {
    shadow,
    submit: (intent: Intent): void => send({ type: 'submit', intents: [intent] }),
    setRunning: (running: boolean): void => send({ type: 'set-running', running }),
    setIntervalMs: (ms: number): void => send({ type: 'set-interval', ms }),
    destroy: (): void => {
      send({ type: 'destroy' })
      worker.terminate()
    },
  }
}
