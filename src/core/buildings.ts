/**
 * Gebäude-System: Typen, Kosten, Effekt-Konstanten.
 *
 * Gebäude leben in `GameState.buildings` (Map<TileRef, Building>). Sie kosten
 * Gold, stehen auf eigenen, begehbaren Tiles, und sind upgradebar.
 *
 * Effekte (in `core/game.ts` angewandt):
 *  - Stadt: erhöht den Truppen-Cap.
 *  - Markt: erzeugt Gold pro Tick.
 *  - Verteidigungsposten: Tiles in Reichweite sind beim Verteidigen zäher
 *    (Magnitude-Multiplikator, stapelt mit Terrain).
 *  - Hafen: Voraussetzung für Schiffe (Phase 5), nur nahe Wasser baubar.
 */

import type { TileRef } from '../world/torus'

export type BuildingType = 'city' | 'defense' | 'market' | 'port'

export const BUILDING_TYPES: readonly BuildingType[] = ['city', 'defense', 'market', 'port']

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

/** Basis-Baukosten; tatsächliche Kosten eskalieren mit Anzahl gebauter Gebäude des Typs. */
const BASE_BUILD_COST: Record<BuildingType, number> = {
  city: 25_000,
  defense: 12_000,
  market: 15_000,
  port: 20_000,
}

/** Anzeige-Namen (UI). */
export const BUILDING_LABEL: Record<BuildingType, string> = {
  city: 'Stadt',
  defense: 'Verteidigung',
  market: 'Markt',
  port: 'Hafen',
}

/**
 * Baukosten. Verteidigungsposten kosten immer gleich viel (flach); alle anderen
 * eskalieren — jedes weitere Gebäude des Typs kostet doppelt (Stadt: 25k/50k/100k…).
 */
export function buildCost(type: BuildingType, existingCountOfType: number): number {
  if (type === 'defense') return BASE_BUILD_COST.defense
  return Math.round(BASE_BUILD_COST[type] * Math.pow(2, existingCountOfType))
}

/** Upgrade-Kosten von `currentLevel` auf das nächste (linear in der Stufe). */
export function upgradeCost(type: BuildingType, currentLevel: number): number {
  return Math.round(BASE_BUILD_COST[type] * (currentLevel + 1))
}

// Effekt-Konstanten
/** Zusätzlicher Truppen-Cap pro Stadt-Level (linear: L1 +25k, L2 +50k, …; kein
 * Upgrade-Bonus — eine Stufe-2-Stadt = zwei Stufe-1-Städte, spart nur Platz). */
export const CITY_CAP_BONUS = 25_000
/** Gold pro Tick pro Markt-Level. */
export const MARKET_GOLD_PER_TICK = 40
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
