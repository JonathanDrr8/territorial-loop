/**
 * Gebäude-System: Typen, Kosten, Effekt-Konstanten.
 *
 * Gebäude leben in `GameState.buildings` (Map<TileRef, Building>). Sie kosten
 * Gold, stehen auf eigenen, begehbaren Tiles, und sind upgradebar.
 *
 * Effekte (in `core/game.ts` angewandt):
 *  - Stadt: erhöht den Truppen-Cap.
 *  - Verteidigungsposten: Tiles in Reichweite sind beim Verteidigen zäher
 *    (Magnitude-Multiplikator, stapelt mit Terrain).
 *  - Hafen: Voraussetzung für Schiffe, nur nahe Wasser baubar.
 *  - Fabrik: verbindet sich per Luftlinie mit eigenen Städten/Häfen/Fabriken
 *    (Cluster) und produziert Gold skaliert mit verbundenen Städten+Häfen.
 */

import type { TileRef } from '../world/torus'

export type BuildingType = 'city' | 'defense' | 'port' | 'factory'

export const BUILDING_TYPES: readonly BuildingType[] = ['city', 'defense', 'port', 'factory']

export interface Building {
  type: BuildingType
  readonly ownerId: number
  readonly tile: TileRef
  level: number
  /** Tick, ab dem das Gebäude fertig ist und wirkt. Bis dahin „im Bau". */
  completesAtTick: number
}

export const MAX_BUILDING_LEVEL = 3

/** Bauzeit in Ticks (≈ 5 s bei 10 Ticks/s) — bis dahin wirkt das Gebäude nicht. */
export const BUILD_TIME_TICKS = 50

/** Ist das Gebäude zum gegebenen Tick fertig (wirkt es)? */
export function isBuildingComplete(b: Building, tick: number): boolean {
  return tick >= b.completesAtTick
}

/** Basis-Baukosten; tatsächliche Kosten eskalieren mit Anzahl gebauter Gebäude der Gruppe. */
const BASE_BUILD_COST: Record<BuildingType, number> = {
  city: 25_000,
  defense: 25_000,
  port: 20_000,
  factory: 50_000,
}

/** Obergrenze der eskalierenden Baukosten — nach genug Gebäuden wird's nicht teurer. */
export const BUILD_COST_CAP = 1_000_000

/**
 * Eskalations-Gruppen: Gebäude derselben Gruppe teilen sich den Kosten-Multiplikator
 * (der Exponent zählt ALLE gebauten Gebäude der Gruppe, nicht nur den eigenen Typ). Häfen
 * und Fabriken bilden eine gemeinsame Gruppe; jede andere Sorte steht für sich. Die Basis
 * bleibt typ-spezifisch (Hafen 20k, Fabrik 50k) — nur der Exponent ist geteilt.
 */
export const COST_GROUP: Record<BuildingType, readonly BuildingType[]> = {
  city: ['city'],
  defense: ['defense'],
  port: ['port', 'factory'],
  factory: ['port', 'factory'],
}

/** Anzeige-Namen (UI). */
export const BUILDING_LABEL: Record<BuildingType, string> = {
  city: 'Stadt',
  defense: 'Verteidigung',
  port: 'Hafen',
  factory: 'Fabrik',
}

/**
 * Baukosten. Verteidigungsposten kosten immer gleich viel (flach); alle anderen
 * eskalieren — jedes weitere Gebäude der Gruppe kostet doppelt (Stadt: 25k/50k/100k…),
 * gedeckelt bei [[BUILD_COST_CAP]] (1 Mio). `existingCountInGroup` ist die Anzahl bereits
 * gebauter Gebäude der Eskalations-Gruppe (siehe [[COST_GROUP]]).
 */
export function buildCost(type: BuildingType, existingCountInGroup: number): number {
  if (type === 'defense') return BASE_BUILD_COST.defense
  const raw = Math.round(BASE_BUILD_COST[type] * Math.pow(2, existingCountInGroup))
  return Math.min(raw, BUILD_COST_CAP)
}

/** Upgrade-Kosten von `currentLevel` auf das nächste (linear in der Stufe). */
export function upgradeCost(type: BuildingType, currentLevel: number): number {
  return Math.round(BASE_BUILD_COST[type] * (currentLevel + 1))
}

// Effekt-Konstanten
/** Zusätzlicher Truppen-Cap pro Stadt-Level (linear: L1 +25k, L2 +50k, …; kein
 * Upgrade-Bonus — eine Stufe-2-Stadt = zwei Stufe-1-Städte, spart nur Platz). */
export const CITY_CAP_BONUS = 25_000
/** Reichweite eines Verteidigungspostens (Tiles), plus pro Level. */
export const DEFENSE_BASE_RANGE = 8
export const DEFENSE_RANGE_PER_LEVEL = 4
/** Magnitude-Multiplikator für verteidigte Tiles (stapelt mit Terrain). */
export const DEFENSE_MAG_MULTIPLIER = 5
/** Wie nah ein Hafen am Wasser sein muss (Tiles). */
export const PORT_WATER_RANGE = 3

/** Reichweite eines Verteidigungspostens auf gegebenem Level. */
export function defenseRange(level: number): number {
  return DEFENSE_BASE_RANGE + (level - 1) * DEFENSE_RANGE_PER_LEVEL
}
