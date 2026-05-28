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
import type { BuildingType } from './buildings'

export type Intent =
  | AttackIntent
  | BoatIntent
  | BoatRecallIntent
  | CancelAttackIntent
  | BuildIntent
  | UpgradeIntent
  | RequestAllianceIntent
  | AcceptAllianceIntent
  | BreakAllianceIntent
  | SetEmbargoIntent

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
 * Spieler schickt ein einzelnes Transport-Boot zu einem Ziel auf einer anderen
 * Landmasse. Anders als beim Angriff ist das ein bewusster Befehl (Boot-Modus):
 *
 * - `targetTile` muss ein begehbares Land-Tile am Wasser sein, das NICHT über
 *   Land erreichbar ist (eigene/feindliche Landmasse zählt nur, wenn übers Meer).
 * - `troops` ist die absolute Anzahl (Slider-%), gedeckelt auf `player.troops`.
 *   Findet die Sim keinen Wasserweg von einer eigenen Küste, passiert nichts
 *   (mit Log-Hinweis).
 */
export interface BoatIntent {
  readonly type: 'boat'
  readonly playerId: number
  readonly targetTile: TileRef
  readonly troops: number
}

/**
 * Spieler ruft ein fahrendes eigenes Transport-Boot zurück. `boatIndex` zählt nur
 * die eigenen Boote (0-basiert, in `state.boats`-Reihenfolge). Das Boot kehrt zur
 * Start-Küste um; bei Ankunft kommen die Truppen zurück in den Pool.
 */
export interface BoatRecallIntent {
  readonly type: 'boat-recall'
  readonly playerId: number
  readonly boatIndex: number
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

/**
 * Spieler baut ein Gebäude auf einem eigenen, begehbaren Tile.
 * Die Sim prüft Besitz, Begehbarkeit, Gold und typ-spezifische Bedingungen
 * (z.B. Hafen nahe Wasser) und zieht die Kosten ab.
 */
export interface BuildIntent {
  readonly type: 'build'
  readonly playerId: number
  readonly tile: TileRef
  readonly buildingType: BuildingType
}

/** Spieler wertet ein eigenes Gebäude auf das nächste Level auf. */
export interface UpgradeIntent {
  readonly type: 'upgrade'
  readonly playerId: number
  readonly tile: TileRef
}

/** Spieler bietet einem anderen ein Bündnis an. Doppel-Anfrage schließt es sofort. */
export interface RequestAllianceIntent {
  readonly type: 'request-alliance'
  readonly playerId: number
  readonly targetPlayerId: number
}

/** Spieler nimmt das Bündnis-Angebot von `targetPlayerId` an. */
export interface AcceptAllianceIntent {
  readonly type: 'accept-alliance'
  readonly playerId: number
  readonly targetPlayerId: number
}

/**
 * Spieler bricht das Bündnis mit `targetPlayerId` — Verrat. Sofort wirksam,
 * aber der Verräter wird zeitbegrenzt geächtet (Verteidigungs-Malus gegen alle
 * Nationen die er nicht selbst angreift).
 */
export interface BreakAllianceIntent {
  readonly type: 'break-alliance'
  readonly playerId: number
  readonly targetPlayerId: number
}

/** Spieler verhängt/hebt ein Handelsembargo gegen `targetPlayerId` auf (Toggle). */
export interface SetEmbargoIntent {
  readonly type: 'set-embargo'
  readonly playerId: number
  readonly targetPlayerId: number
  readonly enabled: boolean
}
