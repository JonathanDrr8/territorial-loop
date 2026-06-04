/**
 * Nachrichtenprotokoll Main ↔ Sim-Worker (ADR-0030 Stufe 2).
 *
 * Der Worker besitzt den autoritativen `GameState` und tickt ihn; der Hauptthread hält nur den
 * read-only Schatten und schickt Eingaben/Steuerung rüber. Alle Nachrichten sind **strukturklon-
 * fähig** (plain data) — `GameConfig`/`SerializedGameState`/`TickDelta`/`Intent` enthalten keine
 * Funktionen, Maps, Sets oder lebende Objekt-Referenzen.
 *
 * Mehrspieler bleibt vorerst auf dem Nicht-Worker-Pfad (Stufe 3); hier nur der Single-Player-Zweig.
 */

import type { Difficulty } from '../ai/ai'
import type { GameConfig } from '../core/game'
import type { Intent } from '../core/intent'
import type { SerializedGameState } from '../core/serialize'
import type { TickDelta } from './tick-delta'

/** Serialisierbare KI-Beschreibung: der Worker erzeugt daraus `createAI` (deterministisch, gleiche Logik wie main). */
export interface AiConfig {
  readonly playerId: number
  readonly wild: boolean
}

/** Main → Worker. */
export type MainToWorker =
  | {
      readonly type: 'init'
      readonly config: GameConfig
      readonly ais: readonly AiConfig[]
      readonly difficulty: Difficulty
      /** Ranglisten-ELO (ADR-0022): setzt das KI-Profil aller nicht-wilden KI; sonst `undefined`. */
      readonly rankedElo?: number
      readonly intervalMs: number
      /** Reconnect/Resync: vom Server erhaltener Voll-Snapshot statt frisch generieren. */
      readonly snapshot?: SerializedGameState
    }
  | { readonly type: 'submit'; readonly intents: readonly Intent[] }
  | { readonly type: 'set-running'; readonly running: boolean }
  | { readonly type: 'set-interval'; readonly ms: number }
  | { readonly type: 'request-full-refresh' }
  | { readonly type: 'destroy' }

/** Worker → Main. */
export type WorkerToMain =
  | { readonly type: 'ready' }
  | {
      readonly type: 'snapshot-full'
      readonly tick: number
      readonly snapshot: SerializedGameState
    }
  | { readonly type: 'tick-delta'; readonly delta: TickDelta }
