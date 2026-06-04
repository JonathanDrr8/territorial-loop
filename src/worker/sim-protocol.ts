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
      /**
       * Mehrspieler (Stufe 3): keine lokale KI/Takt-Uhr — der Worker baut einen `WorkerNetTransport`,
       * die committeten Turns kommen per `net-commit` vom Hauptthread. SP (default `false`): LocalTransport
       * + lokale KI aus `ais`/`difficulty`.
       */
      readonly mp?: boolean
    }
  | { readonly type: 'submit'; readonly intents: readonly Intent[] }
  | { readonly type: 'set-running'; readonly running: boolean }
  | { readonly type: 'set-interval'; readonly ms: number }
  | { readonly type: 'request-full-refresh' }
  // Mehrspieler (Stufe 3): vom Server committeter Turn / Korrektur-Snapshot, vom Hauptthread durchgereicht.
  | { readonly type: 'net-commit'; readonly turn: number; readonly intents: readonly Intent[] }
  | { readonly type: 'net-snapshot'; readonly snapshot: SerializedGameState }
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
  // Mehrspieler (Stufe 3): der im Worker berechnete State-Hash je Turn → Main meldet ihn dem Server.
  | { readonly type: 'hash'; readonly turn: number; readonly hash: number }
