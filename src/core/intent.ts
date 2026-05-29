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
  | LaunchWarshipIntent
  | RecallWarshipIntent
  | ToggleWarshipModeIntent
  | MoveWarshipIntent
  | CancelAttackIntent
  | DefendIntent
  | BuildIntent
  | UpgradeIntent
  | RequestAllianceIntent
  | AcceptAllianceIntent
  | DeclineAllianceIntent
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
  /**
   * Rundum-Modus (kein Richtungs-Fokus, ganze Front zugleich) — z.B. via Shift+Linksklick:
   * - Klick auf eigenes Gebiet / Wildnis → gleichmäßige Ausbreitung in alle angrenzende Wildnis.
   * - Klick auf eine erreichbare, nicht verbündete Nation → Angriff entlang der GANZEN
   *   gemeinsamen Grenze (statt gezielt zum Klick-Tile). Die Sim leitet das Ziel aus dem
   *   Owner des `targetTile` ab.
   */
  readonly omni?: boolean
}

/**
 * Spieler schickt ein einzelnes Transport-Boot zu einem Küsten-Ziel. Anders als beim
 * Angriff ist das ein bewusster Befehl (Boot-Modus):
 *
 * - `targetTile` muss ein begehbares Land-Tile am Wasser sein (Wildnis oder Gegner),
 *   zu dem ein Wasserweg von einer eigenen Küste existiert. Das Ziel DARF über Land
 *   erreichbar sein — eine kurze Überfahrt zur Flankierung ist ausdrücklich erlaubt.
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
 * Spieler entsendet ein Kriegsschiff zu einem Wasser-Ziel. Startet von einem
 * fertigen eigenen Hafen mit Wasserweg zum Ziel; kostet `WARSHIP_COST` Gold und
 * unterliegt dem Kriegsschiff-Limit. Das Schiff patrouilliert die Route (Ping-Pong).
 */
export interface LaunchWarshipIntent {
  readonly type: 'launch-warship'
  readonly playerId: number
  readonly targetTile: TileRef
}

/** Spieler ruft sein `warshipIndex`-tes Kriegsschiff zurück (fährt zur Küste, löst sich auf). */
export interface RecallWarshipIntent {
  readonly type: 'recall-warship'
  readonly playerId: number
  readonly warshipIndex: number
}

/**
 * Schaltet den Verhaltensmodus der Kriegsschiffe des Spielers um (Ping-Pong ↔ Halten & Heilen).
 * Wirkt auf den Standard für neue Schiffe UND alle bereits aktiven eigenen Kriegsschiffe.
 */
export interface ToggleWarshipModeIntent {
  readonly type: 'toggle-warship-mode'
  readonly playerId: number
}

/**
 * Schickt die ausgewählten eigenen Kriegsschiffe (`warshipIndices` in `state.warships`) zu
 * einem Wasser-`targetTile`. Jedes Schiff bekommt eine neue Wasserroute von seiner aktuellen
 * Position dorthin (und patrouilliert sie dann); ohne Wasserweg bleibt es unverändert.
 */
export interface MoveWarshipIntent {
  readonly type: 'move-warship'
  readonly playerId: number
  readonly warshipIndices: readonly number[]
  readonly targetTile: TileRef
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
 * Spieler wehrt einen eingehenden Angriff aktiv ab: er opfert eigene freie Truppen 1:1
 * gegen die Reserve des Angriffs von `attackerId` auf ihn. `troops` ist der gewünschte
 * Einsatz (Slider-Schub); die Sim deckelt auf `min(troops, eigene Truppen, Angriffs-Reserve)`.
 * Wiederholbar (mehrere Schübe). Kein passender eingehender Angriff → no-op.
 */
export interface DefendIntent {
  readonly type: 'defend'
  readonly playerId: number
  readonly attackerId: number
  readonly troops: number
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

/** Spieler lehnt das Bündnis-Angebot von `requesterId` ab (die Anfrage wird verworfen). */
export interface DeclineAllianceIntent {
  readonly type: 'decline-alliance'
  readonly playerId: number
  readonly requesterId: number
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
