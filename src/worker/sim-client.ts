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
import type { NetworkTransport } from '../net/transport'
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
  /** Einzelspieler-KI (im Mehrspieler leer/ungenutzt — der Server liefert die KI). */
  readonly ais?: readonly AiConfig[]
  readonly difficulty?: Difficulty
  readonly rankedElo?: number
  readonly intervalMs: number
  /** Reconnect/Resync: vom Server erhaltener Voll-Snapshot statt frisch generieren. */
  readonly snapshot?: SerializedGameState
  /** Nach jedem angewandten Delta/Snapshot: `true` bei Voll-Ersatz (→ `renderer.invalidate()`). */
  readonly onApplied: (didFull: boolean) => void
  /**
   * Mehrspieler (Stufe 3): der bereits verbundene `NetworkTransport` (bleibt auf dem Hauptthread).
   * Gesetzt → MP-Modus: der Worker tickt die vom Server committeten Turns (statt lokaler KI/Uhr); der
   * Client bridgt Commits/Snapshots in den Worker und den Hash zurück an den Server. UI-Intents gehen
   * direkt an `net.submit` (nicht über den Worker).
   */
  readonly net?: NetworkTransport
  /** Mehrspieler: nach einem Server-Resync-Snapshot (NICHT dem initialen) — z.B. „Resync…"-Blitz. */
  readonly onResync?: () => void
}

export function createSimClient(opts: SimClientOptions): SimClient {
  const { shadow, onApplied, net, onResync } = opts
  const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' })

  // Lädt/läuft der Worker nicht (Modul-Load-Fehler u.ä. passieren asynchron, nicht beim Konstruktor),
  // bliebe der Schatten still stehen. Wenigstens sichtbar machen — der Konstruktor-Fehler (kein
  // Worker-Support) wird dagegen vom Aufrufer (main.ts) abgefangen und fällt auf den Hauptthread zurück.
  worker.onerror = (e): void => {
    console.error('[territorial-loop] Sim-Worker-Fehler', e.message || e)
  }

  // Der initiale snapshot-full (direkt nach init) ist der Erst-Build, KEIN Resync → nicht blitzen.
  let gotInitialSnapshot = false
  worker.onmessage = (ev: MessageEvent<WorkerToMain>): void => {
    const msg = ev.data
    switch (msg.type) {
      case 'ready':
        break
      case 'snapshot-full':
        fullRefresh(shadow, msg.snapshot)
        onApplied(true)
        if (gotInitialSnapshot) onResync?.()
        gotInitialSnapshot = true
        break
      case 'tick-delta':
        onApplied(applyTickDelta(shadow, msg.delta))
        break
      case 'hash':
        // Mehrspieler: der im Worker berechnete Turn-Hash → an den Server (Desync-Erkennung).
        net?.reportHash(msg.turn, msg.hash)
        break
    }
  }

  const send = (m: MainToWorker): void => {
    worker.postMessage(m)
  }

  // init ZUERST senden (vor dem onCommitted-Verdrahten) → der Worker verarbeitet init vor jedem
  // net-commit (postMessage-FIFO), der WorkerNetTransport ist dann bereit.
  send({
    type: 'init',
    config: opts.config,
    ais: opts.ais ?? [],
    difficulty: opts.difficulty ?? 'standard',
    ...(opts.rankedElo !== undefined ? { rankedElo: opts.rankedElo } : {}),
    intervalMs: opts.intervalMs,
    ...(opts.snapshot !== undefined ? { snapshot: opts.snapshot } : {}),
    ...(net !== undefined ? { mp: true } : {}),
  })

  // Mehrspieler: committete Server-Turns + Korrektur-Snapshots in den Worker bridgen.
  if (net !== undefined) {
    net.onCommitted((turn, intents) => send({ type: 'net-commit', turn, intents }))
    net.setSnapshotHandler((_turn, snap) => send({ type: 'net-snapshot', snapshot: snap }))
  }

  return {
    shadow,
    submit: (intent: Intent): void => {
      // Mehrspieler: UI-Intents gehen DIREKT an den Server; Einzelspieler: an den Worker (LocalTransport).
      if (net !== undefined) net.submit([intent])
      else send({ type: 'submit', intents: [intent] })
    },
    setRunning: (running: boolean): void => {
      if (net === undefined) send({ type: 'set-running', running }) // MP: Server ist die Uhr
    },
    setIntervalMs: (ms: number): void => {
      if (net === undefined) send({ type: 'set-interval', ms }) // MP: Server ist die Uhr
    },
    destroy: (): void => {
      send({ type: 'destroy' })
      worker.terminate()
    },
  }
}
