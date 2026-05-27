/**
 * Tileable Terrain-Generation für den Torus.
 *
 * **Wichtig:** Die Karte ist ein Torus — naiver 2D-Simplex hat einen sichtbaren
 * Naht-Übergang an den Rändern. Stattdessen nutzen wir eine Summe aus Sinus-/
 * Cosinus-Komponenten mit ganzzahligen Frequenzen (Wellen-Zahlen) — dadurch
 * sind alle Komponenten am Rand automatisch tile-kontinuierlich.
 *
 * `noise(x, y)` ist eine FFT-artige Summe; Threshold-Sortierung bestimmt
 * danach welche Anteile als Land und welche als Wasser markiert werden.
 *
 * Im MVP nur zwei Bit-Werte: Land (Bit 7 = 1) oder Wasser (Bit 7 = 0).
 * Höhe / Biome werden später ergänzt.
 */

import type { GameMap } from './map'
import type { PRNG } from '../core/random'

/** Bit 7 im terrain-Byte = "tile ist Land". */
export const IS_LAND_BIT = 0b1000_0000

export type TerrainType = 'flat' | 'continents' | 'islands'

const NUM_FREQ_COMPONENTS = 10

interface NoiseComponent {
  readonly fx: number
  readonly fy: number
  readonly phase: number
  readonly amplitude: number
}

/** Liefert `true` wenn das Tile begehbares Land ist. */
export function isLand(terrain: Uint8Array, ref: number): boolean {
  const v = terrain[ref]
  if (v === undefined) return false
  return (v & IS_LAND_BIT) !== 0
}

/**
 * Füllt `map.terrain` mit Land/Wasser nach dem gewählten Typ.
 * `flat` lässt alles Land. `continents` ≈ 70% Land, `islands` ≈ 35% Land.
 */
export function generateTerrain(map: GameMap, prng: PRNG, type: TerrainType): void {
  if (type === 'flat') {
    map.terrain.fill(IS_LAND_BIT)
    return
  }

  const w = map.width
  const h = map.height
  const landRatio = type === 'continents' ? 0.7 : 0.35

  // Zufällige tileable Frequenz-Komponenten. fx/fy sind kleine positive Integers,
  // die die Anzahl der Wellen-Berge in der jeweiligen Achse über die ganze Karte angeben.
  const components: NoiseComponent[] = []
  for (let i = 0; i < NUM_FREQ_COMPONENTS; i++) {
    const fx = prng.nextInt(1, 6)
    const fy = prng.nextInt(1, 6)
    const phase = prng.nextFloat(0, Math.PI * 2)
    // Höhere Frequenzen mit kleinerer Amplitude (1/f-Spektrum-artig)
    const amplitude = 1 / (1 + Math.max(fx, fy) * 0.4)
    components.push({ fx, fy, phase, amplitude })
  }

  const totalAmp = components.reduce((sum, c) => sum + c.amplitude, 0)

  // Pass 1: Noise-Wert pro Tile berechnen
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

  // Pass 2: Threshold so wählen dass `landRatio` Tiles Land werden
  const sortedCopy = new Float32Array(values)
  sortedCopy.sort()
  const cutoffIdx = Math.floor(sortedCopy.length * (1 - landRatio))
  const threshold = sortedCopy[Math.min(cutoffIdx, sortedCopy.length - 1)] ?? 0

  // Pass 3: terrain-Bits setzen
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v === undefined) continue
    map.terrain[i] = v > threshold ? IS_LAND_BIT : 0
  }
}
