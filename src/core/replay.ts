/**
 * Replay: ein aufgezeichneter Strom committeter Turns + die Start-Config reproduziert ein
 * Match **bit-genau** (ADR-0009 Phase 3).
 *
 * Grundlage des Determinismus-Vertrags: `createGame(config)` + dieselben Intent-Sets pro Turn
 * (in `tick`-Reihenfolge) ⇒ identischer `GameState` an jedem Tick. Das ist exakt das, was im
 * server-autoritativen Lockstep über die Leitung geht — die committeten Turns des Servers SIND
 * der Replay-Log. Damit lassen sich Desync-Bugs reproduzieren, Snapshots verifizieren und (im
 * Test) der Determinismus messbar absichern (statt nur behauptet).
 *
 * Die Sim läuft in `core/` ohne Browser-Deps → Replay funktioniert headless (Node/CI).
 */

import { createGame, tick, type GameConfig, type GameState } from './game'
import type { Intent } from './intent'

/** Ein committetes Intent-Set für genau einen Turn (entspricht dem Transport-`onCommitted`). */
export interface RecordedTurn {
  readonly tick: number
  readonly intents: readonly Intent[]
}

/** Vollständiger Replay-Datensatz: was zum exakten Nachspielen eines Matches nötig ist. */
export interface Replay {
  readonly config: GameConfig
  readonly turns: readonly RecordedTurn[]
}

/**
 * Recorder: hängt sich an den committeten Intent-Strom (z.B. `transport.onCommitted`) und
 * sammelt die Turns. `turns()` liefert eine eingefrorene Kopie für `Replay`/Serialisierung.
 */
export interface Recorder {
  record(tick: number, intents: readonly Intent[]): void
  turns(): RecordedTurn[]
}

export function createRecorder(): Recorder {
  const turns: RecordedTurn[] = []
  return {
    record(tick, intents) {
      // Intents kopieren — der Log darf nicht mit weiterlaufenden Puffern mutieren.
      turns.push({ tick, intents: intents.map((i) => ({ ...i }) as Intent) })
    },
    turns() {
      return turns.map((t) => ({
        tick: t.tick,
        intents: t.intents.map((i) => ({ ...i }) as Intent),
      }))
    },
  }
}

/**
 * Spielt einen Replay nach und gibt den End-State zurück. `untilTurn` (optional) bricht nach
 * so vielen Turns ab (für Snapshot-/Schrittweise-Verifikation). Die `tick`-Felder der Turns
 * dienen nur der Diagnose — angewendet wird strikt in Listen-Reihenfolge.
 */
export function replayGame(replay: Replay, untilTurn?: number): GameState {
  const state = createGame(replay.config)
  const limit =
    untilTurn === undefined ? replay.turns.length : Math.min(untilTurn, replay.turns.length)
  for (let i = 0; i < limit; i++) {
    const turn = replay.turns[i]
    if (turn === undefined) break
    tick(state, turn.intents)
  }
  return state
}
