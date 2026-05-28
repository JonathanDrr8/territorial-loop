/**
 * Tileable Terrain-Generation für den Torus: Land/Wasser + Höhen.
 *
 * **Wichtig:** Die Karte ist ein Torus — naiver 2D-Simplex hat einen sichtbaren
 * Naht-Übergang an den Rändern. Stattdessen nutzen wir eine Summe aus Cosinus-
 * Komponenten mit ganzzahligen Frequenzen — dadurch sind alle Komponenten am
 * Rand automatisch tile-kontinuierlich.
 *
 * Bit-Layout `terrain[i]` (Uint8):
 *   Bit 7      = IS_LAND (1 = Land, 0 = Wasser)
 *   Bits 0-4   = Höhe 0-31. Stufen für den Kampf:
 *                0-9 Ebene (mag 80), 10-19 Hügel (mag 100), 20-30 Berg (mag 120),
 *                31 = Extrem-Berg (unpassierbar, wie Wasser).
 */

import type { GameMap } from './map'
import type { PRNG } from '../core/random'

/** Bit 7 im terrain-Byte = "tile ist Land". */
export const IS_LAND_BIT = 0b1000_0000
/** Bits 0-4 = Höhe 0-31. */
export const HEIGHT_MASK = 0x1f
/** Höhe 31 = unpassierbarer Extrem-Berg. */
export const IMPASSABLE_HEIGHT = 31

export const PLAINS_MAG = 80
export const HILL_MAG = 100
export const MOUNTAIN_MAG = 120

export type TerrainType = 'flat' | 'continents' | 'islands'

const NUM_FREQ_COMPONENTS = 10

// Höhen-Verteilung (Anteil der Land-Tiles): Ebene / Hügel / Berg / Extrem-Berg.
const HILL_PCT = 0.25
const MOUNTAIN_PCT = 0.12
const EXTREME_PCT = 0.03

interface NoiseComponent {
  readonly fx: number
  readonly fy: number
  readonly phase: number
  readonly amplitude: number
}

/** Liefert `true` wenn das Tile Land ist (egal welche Höhe). */
export function isLand(terrain: Uint8Array, ref: number): boolean {
  const v = terrain[ref]
  if (v === undefined) return false
  return (v & IS_LAND_BIT) !== 0
}

/** Liefert `true` wenn das Tile begehbar ist (Land und kein Extrem-Berg). */
export function isPassable(terrain: Uint8Array, ref: number): boolean {
  const v = terrain[ref]
  if (v === undefined) return false
  if ((v & IS_LAND_BIT) === 0) return false
  return (v & HEIGHT_MASK) !== IMPASSABLE_HEIGHT
}

/** Kampf-Magnitude des Tiles aus seiner Höhenstufe (Ebene 80 / Hügel 100 / Berg 120). */
export function terrainMagnitude(terrain: Uint8Array, ref: number): number {
  const v = terrain[ref]
  if (v === undefined) return PLAINS_MAG
  const height = v & HEIGHT_MASK
  if (height >= 20) return MOUNTAIN_MAG
  if (height >= 10) return HILL_MAG
  return PLAINS_MAG
}

/** Truppen-Cap-Beitrag eines Tiles nach Höhe: Ebene viel, Berg wenig. */
export const PLAINS_TROOP_WEIGHT = 1.5
export const HILL_TROOP_WEIGHT = 1.0
export const MOUNTAIN_TROOP_WEIGHT = 0.5

/**
 * Wie viel ein Tile zum Truppen-Cap beiträgt (gewichtet nach Höhe). Ebene trägt
 * am meisten Bevölkerung (1.5), Hügel normal (1.0), Berg wenig (0.5). Wasser und
 * Extrem-Berge (nicht begehbar, nie besessen) tragen nichts.
 */
export function tileTroopWeight(terrain: Uint8Array, ref: number): number {
  if (!isPassable(terrain, ref)) return 0
  const v = terrain[ref] ?? 0
  const height = v & HEIGHT_MASK
  if (height >= 20) return MOUNTAIN_TROOP_WEIGHT
  if (height >= 10) return HILL_TROOP_WEIGHT
  return PLAINS_TROOP_WEIGHT
}

/** Erzeugt eine tileable Cosinus-Noise-Ebene als Float32Array über die ganze Karte. */
function buildNoise(w: number, h: number, prng: PRNG): Float32Array {
  const components: NoiseComponent[] = []
  for (let i = 0; i < NUM_FREQ_COMPONENTS; i++) {
    const fx = prng.nextInt(1, 6)
    const fy = prng.nextInt(1, 6)
    const phase = prng.nextFloat(0, Math.PI * 2)
    const amplitude = 1 / (1 + Math.max(fx, fy) * 0.4)
    components.push({ fx, fy, phase, amplitude })
  }
  const totalAmp = components.reduce((sum, c) => sum + c.amplitude, 0)
  const values = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0
      for (const c of components) {
        n += c.amplitude * Math.cos(2 * Math.PI * ((c.fx * x) / w + (c.fy * y) / h) + c.phase)
      }
      values[y * w + x] = n / totalAmp
    }
  }
  return values
}

/** Findet den Wert an einem Perzentil eines Float32Array (0..1). */
function percentile(sorted: Float32Array, p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)))
  return sorted[idx] ?? 0
}

/**
 * Füllt `map.terrain` mit Land/Wasser + Höhen nach dem gewählten Typ.
 * `flat` = alles Land, alles Ebene (Testmodus). `continents` ≈ 70% Land,
 * `islands` ≈ 35% Land — beide mit Höhen-Variation.
 */
export function generateTerrain(map: GameMap, prng: PRNG, type: TerrainType): void {
  const w = map.width
  const h = map.height
  const len = w * h

  if (type === 'flat') {
    map.terrain.fill(IS_LAND_BIT) // Land, Höhe 0 (Ebene)
    return
  }

  // --- Land/Wasser ---
  const landRatio = type === 'continents' ? 0.7 : 0.35
  const landNoise = buildNoise(w, h, prng)
  const landSorted = new Float32Array(landNoise)
  landSorted.sort()
  const landThreshold = percentile(landSorted, 1 - landRatio)

  // --- Höhe (eigene Noise-Ebene) ---
  const heightNoise = buildNoise(w, h, prng)
  // Perzentil-Schwellen nur über die Land-Tiles bestimmen, damit die Höhen-Anteile
  // sich auf das Land beziehen (nicht aufs Wasser).
  const landHeights: number[] = []
  for (let i = 0; i < len; i++) {
    if ((landNoise[i] ?? -1) > landThreshold) landHeights.push(heightNoise[i] ?? 0)
  }
  landHeights.sort((a, b) => a - b)
  const lhArr = Float32Array.from(landHeights)
  const hillThr = percentile(lhArr, 1 - (HILL_PCT + MOUNTAIN_PCT + EXTREME_PCT))
  const mountainThr = percentile(lhArr, 1 - (MOUNTAIN_PCT + EXTREME_PCT))
  const extremeThr = percentile(lhArr, 1 - EXTREME_PCT)

  for (let i = 0; i < len; i++) {
    const isLandTile = (landNoise[i] ?? -1) > landThreshold
    if (!isLandTile) {
      map.terrain[i] = 0 // Wasser
      continue
    }
    const hv = heightNoise[i] ?? 0
    let height = 5 // Ebene
    if (hv > extremeThr) height = IMPASSABLE_HEIGHT
    else if (hv > mountainThr)
      height = 25 // Berg
    else if (hv > hillThr) height = 15 // Hügel
    map.terrain[i] = IS_LAND_BIT | height
  }
}
