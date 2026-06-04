/**
 * Sim-Host (ADR-0030 Stufe 2): kapselt die lokale Simulations-Treiber-Naht — Intent-Transport,
 * KI-Intent-Quelle, das `tick()`-Treiben aus `onCommitted` (+ Replay-Recorder + Desync-Hash-Meldung).
 *
 * Zweck: diesen Block aus `main.ts` herauslösen, damit er später (Stufe 4) unverändert in einem
 * Web Worker laufen kann. Bewusst **browser-frei** (kein DOM/`window`) — wie `core/`/`net/`/`ai/`.
 *
 * Heute läuft der Sim-Host weiter auf dem Hauptthread; `main.ts` hält weiterhin die net-spezifischen
 * Handler (Snapshot/Pause/Host-Steuerung) an seinem `NetworkTransport`. Verhalten unverändert.
 */

import { tick, type GameState } from '../core/game'
import { hashState } from '../core/hash'
import type { Intent } from '../core/intent'
import { createRecorder, type Recorder } from '../core/replay'
import { LocalTransport, type IntentTransport, type NetworkTransport } from '../net/transport'
import type { AI } from '../ai/ai'

export interface SimHost {
  /** Der zugrunde liegende Transport (für net-spezifische Handler in `main.ts`). */
  readonly transport: IntentTransport
  /** Replay-Mitschnitt des Matches (für `__TL__`-Debugging / Desync-Repro). */
  readonly recorder: Recorder
  /** Einen einzelnen Intent einreichen (UI/Eingabe). */
  submit(intent: Intent): void
  /** Sim-Uhr starten/anhalten (Pause). */
  setRunning(running: boolean): void
  /** Tick-Intervall (ms) setzen (Tempo-Wechsel). */
  setIntervalMs(ms: number): void
  /** Transport schließen (Match-Ende). */
  destroy(): void
}

export interface SimHostOptions {
  readonly state: GameState
  /**
   * Lokale KI (Einzelspieler). Im Mehrspieler leer — dort produziert der Server die KI-Intents und
   * `netTransport` liefert die committeten Turns.
   */
  readonly ais: readonly AI[]
  /**
   * Im Mehrspieler der bereits verbundene `NetworkTransport`; im Einzelspieler `undefined` → ein
   * `LocalTransport` mit lokaler Takt-Uhr + lokaler KI wird erzeugt. Für die Desync-Hash-Meldung
   * (nur Mehrspieler relevant) wird dieser Transport auch in `onCommitted` genutzt.
   */
  readonly netTransport?: NetworkTransport | undefined
  /** Tick-Intervall in ms (vom Aufrufer, z.B. `SIM_BASE_INTERVAL_MS`). */
  readonly intervalMs: number
  /**
   * Hook NACH jedem committeten Tick (Turn, Intents). Stufe 3 hängt hier den View-Model-Bau ein;
   * heute ungenutzt.
   */
  readonly onAfterTick?: (turn: number, intents: readonly Intent[]) => void
  /**
   * Optionale Takt-Uhr für den `LocalTransport` (Single-Player). Default ist `window` — im Web Worker
   * (ADR-0030 Stufe 2) gibt es kein `window`, dort wird ein `self`-basierter Timer injiziert.
   */
  readonly timer?: {
    setInterval(handler: () => void, ms: number): number
    clearInterval(id: number): void
  }
}

export function createSimHost(opts: SimHostOptions): SimHost {
  const { state, ais, netTransport, intervalMs } = opts

  const transport: IntentTransport =
    netTransport ??
    new LocalTransport({
      produceServerIntents: () => {
        const aiIntents: Intent[] = []
        for (const ai of ais) {
          for (const intent of ai.decide(state)) aiIntents.push(intent)
        }
        return aiIntents
      },
      intervalMs,
      running: true,
      ...(opts.timer !== undefined ? { timer: opts.timer } : {}),
    })

  // Jeden committeten Turn mitschneiden → Replay-Log (config + turns) reproduziert das Match
  // bit-genau (ADR-0009 Phase 3). Dann tick(), dann im Mehrspieler den eigenen State-Hash melden
  // (Desync-Erkennung → Snapshot/Resync). Reihenfolge identisch zur früheren Inline-Verdrahtung.
  const recorder = createRecorder()
  transport.onCommitted((turn, intents) => {
    recorder.record(turn, intents)
    tick(state, intents)
    netTransport?.reportHash(turn, hashState(state))
    opts.onAfterTick?.(turn, intents)
  })

  return {
    transport,
    recorder,
    submit: (intent: Intent): void => transport.submit([intent]),
    setRunning: (running: boolean): void => {
      transport.setRunning(running)
    },
    setIntervalMs: (ms: number): void => {
      transport.setIntervalMs(ms)
    },
    destroy: (): void => {
      transport.destroy()
    },
  }
}
