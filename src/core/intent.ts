/**
 * Intents — Eingaben in die Game-Simulation.
 *
 * Mutationen am Game-State passieren ausschließlich über Intents. Spieler-Input,
 * UI-Aktionen und KI-Entscheidungen werden in Intent-Objekte übersetzt und an
 * `tick(state, intents)` übergeben.
 *
 * Discriminated Union auf dem `type`-Feld — sauberes Pattern-Matching ohne
 * Zod/Schema-Lib im MVP.
 */

import type { TileRef } from '../world/torus'

export type Intent = AttackIntent | CancelAttackIntent

/**
 * Spieler startet einen Angriff auf ein Ziel-Tile.
 *
 * - `targetTile` ist ein TileRef im Gebiet des Ziel-Spielers (oder TerraNullius).
 *   Die Sim leitet daraus den Ziel-Spieler ab (Owner des Tiles zur Intent-Zeit).
 * - `troops` ist die absolute Anzahl der Truppen die dem Angriff zugeordnet
 *   werden sollen. Die Sim deckelt auf `min(troops, player.troops)`.
 *   Slider-% → absolute Zahl wird clientseitig (UI/AI) gerechnet.
 */
export interface AttackIntent {
  readonly type: 'attack'
  readonly playerId: number
  readonly targetTile: TileRef
  readonly troops: number
}

/**
 * Spieler bricht einen seiner aktiven Angriffe ab.
 * `attackIndex` zeigt in `player.attacks`. Truppen der Reserve gehen
 * zurück in den Spieler-Pool (oder werden verworfen — Design-Detail).
 */
export interface CancelAttackIntent {
  readonly type: 'cancel-attack'
  readonly playerId: number
  readonly attackIndex: number
}
