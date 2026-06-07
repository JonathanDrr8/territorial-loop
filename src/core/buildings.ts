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

export type BuildingType = 'city' | 'defense' | 'port' | 'factory' | 'airport' | 'flak'

export const BUILDING_TYPES: readonly BuildingType[] = [
  'city',
  'defense',
  'port',
  'factory',
  'airport',
  'flak',
]

export interface Building {
  type: BuildingType
  readonly ownerId: number
  readonly tile: TileRef
  level: number
  /** Tick, ab dem das Gebäude fertig ist und wirkt. Bis dahin „im Bau". */
  completesAtTick: number
  /**
   * Tatsächliche (eskalierte) Baukosten dieses Gebäudes zum Bauzeitpunkt. Upgrade-Kosten
   * skalieren daran (teure Max-Cost-Fabrik → teures Upgrade, siehe [[upgradeCost]]). Optional:
   * Alt-Snapshots/Tests ohne Feld fallen auf die typ-Basiskosten zurück (= bisheriges Verhalten).
   */
  readonly buildPrice?: number
  /**
   * Nur Flak (ADR-0019): Tick, bis zu dem der Turm nicht wieder feuern kann (Schuss-Cooldown).
   * `undefined`/0 = schussbereit. Mutiert beim Feuern.
   */
  cooldownUntilTick?: number
  /**
   * Nur Flughafen (ADR-0019-Nachtrag): wie viele GEPARKTE (startbereite) Flugzeuge gerade im
   * Hangar stehen. Fliegende Bomber zählen nicht hier, sondern in `state.bombers`. Hangar-Größe
   * = Flughafen-Level ([[airportSlots]]). `undefined` = 0. Mutiert beim Start/Rückkehr/Abschuss.
   */
  aircraft?: number
}

export const MAX_BUILDING_LEVEL = 3

/**
 * Städte sind über {@link MAX_BUILDING_LEVEL} hinaus aufrüstbar (ADR-0031, Spätspiel-Gold-Senke):
 * jedes Level weiter +{@link CITY_CAP_BONUS} Truppen-Cap, aber mit verdoppelnden Kosten
 * ({@link upgradeCost}) als Snowball-Bremse. Direkt-BAU bleibt bei {@link MAX_BUILDING_LEVEL}; nur
 * das Hochrüsten vorhandener Städte geht bis hierher.
 */
export const MAX_CITY_LEVEL = 6

/**
 * Mindestabstand (Torus-Tiles) zwischen zwei eigenen Städten (ADR-0033): Städte breiten sich als
 * Siedlungen aus, statt sich zu Cap-Clustern zu stapeln. Bau-Regel in `canBuildAt` (deterministisch,
 * MP-sicher); die KI-Stadtplatzierung respektiert ihn ebenfalls; im Bau-Modus wird der Radius gezeigt.
 *
 * 2026-06-07 von 8 → 5 gesenkt: 8 war zu groß — ein kompaktes Reich bis ~150 Tiles (Radius < 8)
 * hatte NULL gültige Zweitstadt-Plätze (gemessen) → „kann keine Städte platzieren". 5 entsperrt
 * Reiche ab ~80 Tiles, hält Städte aber spürbar verteilt.
 */
export const CITY_MIN_DISTANCE = 5

/** Höchstes erreichbares Level je Gebäudetyp (Städte tiefer dank Gold-Senke, ADR-0031). */
export function maxLevel(type: BuildingType): number {
  return type === 'city' ? MAX_CITY_LEVEL : MAX_BUILDING_LEVEL
}

/**
 * Siedlungs-Stufen einer Stadt nach Level (ADR-0033): eine Stadt startet als Dorf und wächst über die
 * Level zur Weltstadt. i18n-Keys, Index = Level-1. Wird statt des generischen „Stadt" angezeigt.
 */
const CITY_STAGE_KEYS = [
  'citystage.dorf',
  'citystage.kleinstadt',
  'citystage.stadt',
  'citystage.grossstadt',
  'citystage.metropole',
  'citystage.weltstadt',
] as const

/** i18n-Key für den Siedlungs-Namen einer Stadt nach Level (1..{@link MAX_CITY_LEVEL}). */
export function cityStageKey(level: number): string {
  const i = Math.max(1, Math.min(MAX_CITY_LEVEL, Math.floor(level))) - 1
  return CITY_STAGE_KEYS[i] ?? 'building.city'
}

/** Bauzeit in Ticks (≈ 5 s bei 10 Ticks/s) — bis dahin wirkt das Gebäude nicht. */
export const BUILD_TIME_TICKS = 50

/** Ist das Gebäude zum gegebenen Tick fertig (wirkt es)? */
export function isBuildingComplete(b: Building, tick: number): boolean {
  return tick >= b.completesAtTick
}

/**
 * Basis-Baukosten; tatsächliche Kosten eskalieren mit Anzahl gebauter Gebäude der Gruppe.
 * Hafen und Fabrik haben bewusst dieselbe Basis und teilen sich die Eskalation ([[COST_GROUP]])
 * → im frühen Spiel ein „entweder-oder" (Schiffe/Handel ODER Gold-Netz), nicht beides billig.
 */
const BASE_BUILD_COST: Record<BuildingType, number> = {
  city: 25_000,
  defense: 25_000,
  port: 25_000,
  factory: 25_000,
  // Flughafen: eigene Eskalations-Gruppe (offensive Infrastruktur ist eine Investition).
  airport: 50_000,
  // Flak: flach wie der Verteidigungsposten (man soll mehrere zur Abdeckung verteilen können).
  flak: 35_000,
}

/** Obergrenze der eskalierenden Baukosten — nach genug Gebäuden wird's nicht teurer.
 * 100k: Stadt/Hafen/Fabrik eskalieren 25k→50k→100k und bleiben dann fest (Flughafen 50k→100k). */
export const BUILD_COST_CAP = 100_000

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
  airport: ['airport'],
  flak: ['flak'],
}

/** Anzeige-Namen (UI). */
export const BUILDING_LABEL: Record<BuildingType, string> = {
  city: 'Stadt',
  defense: 'Verteidigung',
  port: 'Hafen',
  factory: 'Fabrik',
  airport: 'Flughafen',
  flak: 'Flugabwehr',
}

/**
 * Baukosten. Verteidigungsposten kosten immer gleich viel (flach); alle anderen
 * eskalieren — jedes weitere Gebäude der Gruppe kostet doppelt (Stadt: 25k/50k/100k…),
 * gedeckelt bei [[BUILD_COST_CAP]] (100k). `existingCountInGroup` ist die Anzahl bereits
 * gebauter Gebäude der Eskalations-Gruppe (siehe [[COST_GROUP]]).
 */
export function buildCost(type: BuildingType, existingCountInGroup: number): number {
  // Defensive Posten (Verteidigung + Flak) kosten flach — man verteilt sie zur Flächenabdeckung.
  if (type === 'defense' || type === 'flak') return BASE_BUILD_COST[type]
  // Eskalation: Basiskosten × 2^n. Deterministisch per Integer-Verdopplung statt `Math.pow`
  // — exakt über JS-Engines hinweg (Cross-Engine-Determinismus, ADR-0009). Ergebnis ist
  // identisch zur alten `round(base × 2^n)`-Formel (base/2^n sind exakte Integer).
  let cost = BASE_BUILD_COST[type]
  for (let i = 0; i < existingCountInGroup; i++) {
    cost *= 2
    if (cost >= BUILD_COST_CAP) return BUILD_COST_CAP
  }
  return Math.min(cost, BUILD_COST_CAP)
}

/**
 * Upgrade-Kosten aufs nächste Level. Skaliert am **tatsächlichen Baupreis** des Gebäudes
 * (`buildPrice`) statt an den Typ-Basiskosten → eine teure (eskalierte) Max-Cost-Fabrik kostet
 * auch entsprechend mehr zum Upgraden, eine erste/billige unverändert (buildPrice = Basis → identisch
 * zur früheren `BASE × (level+1)`-Formel). Fehlt `buildPrice` (Alt-Snapshot/Test), gilt die Basis.
 */
export function upgradeCost(b: Pick<Building, 'type' | 'level' | 'buildPrice'>): number {
  const base = b.buildPrice ?? BASE_BUILD_COST[b.type]
  // Städte über Level 3 (ADR-0031): Kosten verdoppeln sich je Level — Gold-Senke + Snowball-Bremse.
  // Multiplikator base×3 × 2^(level-2): L3→4 = ×6, L4→5 = ×12, L5→6 = ×24 (Basis 25k → 150k/300k/600k).
  // Integer-Shift statt Math.pow → cross-engine-deterministisch (MP, ADR-0009).
  if (b.type === 'city' && b.level + 1 > MAX_BUILDING_LEVEL) {
    return Math.round(base * 3 * (1 << (b.level - 2)))
  }
  return Math.round(base * (b.level + 1))
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

/** Reichweite eines Verteidigungspostens auf gegebenem Level. */
export function defenseRange(level: number): number {
  return DEFENSE_BASE_RANGE + (level - 1) * DEFENSE_RANGE_PER_LEVEL
}

// ── Flughafen & Flak (ADR-0019) ─────────────────────────────────────────────
/**
 * Hangar-Plätze eines Flughafens = sein Level (ADR-0019-Nachtrag): L1 1 / L2 2 / L3 3. So viele
 * Flugzeuge kann er besitzen (geparkt + gerade in der Luft). Die Flugzeit ersetzt einen Cooldown.
 */
export function airportSlots(level: number): number {
  return level
}

/** Flak-Reichweite (Tiles): L1 10 / L2 14 / L3 18 — etwas größer als der Verteidigungsposten,
 * damit ein Level-1-Posten Bomber schon aus etwas mehr Abstand erreicht. */
export const FLAK_BASE_RANGE = 10
export const FLAK_RANGE_PER_LEVEL = 4
export function flakRange(level: number): number {
  return FLAK_BASE_RANGE + (level - 1) * FLAK_RANGE_PER_LEVEL
}
