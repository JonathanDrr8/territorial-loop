/**
 * Tileable Terrain-Generation für den Torus: Land/Wasser + Höhen.
 *
 * **Wichtig:** Die Karte ist ein Torus — naiver 2D-Simplex hat einen sichtbaren
 * Naht-Übergang an den Rändern. Stattdessen bauen wir das Noise aus Cosinus-
 * Komponenten mit ganzzahligen Frequenzen — dadurch ist am Rand alles automatisch
 * tile-kontinuierlich. Land/Höhe nutzen fraktales Noise (FBM, mehrere Oktaven mit
 * 1/f-Spektrum) + eine niederfrequente Kontinent-Maske + leichtes Domain-Warping
 * → erdähnliche Kontinente mit fraktalen Küsten und zusammenhängenden Gebirgen.
 *
 * Bit-Layout `terrain[i]` (Uint8):
 *   Bit 7      = IS_LAND (1 = Land, 0 = Wasser)
 *   Bits 0-4   = Höhe 0-31. Stufen für den Kampf:
 *                0-9 Ebene (mag 80), 10-19 Hügel (mag 100), 20-30 Berg (mag 120),
 *                31 = Extrem-Berg (unpassierbar, wie Wasser).
 */

import type { GameMap } from './map'
import { detCos, detSin } from '../core/det-math'
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

/**
 * Tileable fraktales Noise (FBM): summiert Oktaven mit steigender Frequenz und
 * fallender Amplitude (Persistence). Niedrige Oktaven formen große Strukturen
 * (Kontinente/Gebirgsrümpfe), hohe Oktaven brechen Küsten/Grate fraktal auf —
 * das 1/f-Spektrum ergibt das „erdähnliche" Aussehen statt wabbliger Blobs.
 *
 * Tileable bleibt es, weil alle Frequenz-Komponenten ganzzahlig sind (am Torus-
 * Rand also stetig). Pro Oktave werden `compsPerOctave` Komponenten mit zufälliger
 * Richtung (theta) auf dem Frequenz-Ring gewählt → isotrop, keine Achsen-Artefakte.
 */
function buildFractalNoise(
  w: number,
  h: number,
  prng: PRNG,
  octaves: number,
  baseFreq: number,
  lacunarity: number,
  persistence: number,
  compsPerOctave: number,
): Float32Array {
  const components: NoiseComponent[] = []
  let amp = 1
  let freq = baseFreq
  let totalAmp = 0
  for (let o = 0; o < octaves; o++) {
    for (let k = 0; k < compsPerOctave; k++) {
      const theta = prng.nextFloat(0, Math.PI * 2)
      let fx = Math.abs(Math.round(freq * detCos(theta)))
      const fy = Math.abs(Math.round(freq * detSin(theta)))
      if (fx === 0 && fy === 0) fx = 1
      const phase = prng.nextFloat(0, Math.PI * 2)
      const a = amp / compsPerOctave
      components.push({ fx, fy, phase, amplitude: a })
      totalAmp += a
    }
    amp *= persistence
    freq *= lacunarity
  }
  const values = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const yw = y * w
    for (let x = 0; x < w; x++) {
      let n = 0
      for (const c of components) {
        n += c.amplitude * detCos(2 * Math.PI * ((c.fx * x) / w + (c.fy * y) / h) + c.phase)
      }
      values[yw + x] = totalAmp > 0 ? n / totalAmp : 0
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
/**
 * Carvt Flüsse als echtes Wasser in `terrain` (ADR-0015). Quellen liegen an Bergen
 * (`heightNoise` hoch), der Pfad folgt dem steilsten Abstieg von `landNoise` (dessen Minima das
 * Meer sind → Flüsse erreichen die Küste). Pro Pfadpunkt wird ein 2×2-Block gecarvt → der Fluss
 * ist überall ≥2 Tiles breit und orthogonal 4-zusammenhängend (Schiffe bewegen sich nur über
 * `neighbors4`, ein diagonal „treppender" 1-Tile-Fluss wäre für sie unverbunden). Deterministisch.
 */
function carveRivers(
  terrain: Uint8Array,
  prng: PRNG,
  landNoise: Float32Array,
  heightNoise: Float32Array,
  sourceThr: number,
  w: number,
  h: number,
): void {
  const len = w * h
  /** Wasser = Original-Meer ODER bereits gecarvter Fluss (beide: IS_LAND_BIT nicht gesetzt). */
  const isWater = (i: number): boolean => ((terrain[i] ?? 0) & IS_LAND_BIT) === 0
  // Mäander-Feld: niederfrequentes Noise → sanfte, glatte Schlangenlinien (kein erratisches Zucken).
  const wander = buildFractalNoise(w, h, prng, 2, 3.5, 2.0, 0.5, 2)
  const minSepSq = (Math.min(w, h) * 0.1) ** 2
  const maxLen = w + h

  const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
    let dx = Math.abs(ax - bx)
    let dy = Math.abs(ay - by)
    if (dx > w / 2) dx = w - dx
    if (dy > h / 2) dy = h - dy
    return dx * dx + dy * dy
  }

  // 2×2-Block ab (cx,cy) zu Wasser machen → Fluss ≥2 Tiles breit + orthogonal 4-zusammenhängend.
  const carveBlock = (i: number): void => {
    const cx = i % w
    const cy = (i - cx) / w
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        terrain[(((cy + dy) % h) * w + ((cx + dx) % w)) | 0] = 0
      }
    }
  }
  // Pfad + Mündungs-Tile carven (Mündung öffnet den Fluss sichtbar ins Meer → „berührt" es).
  const carve = (path: readonly number[], mouth: number): void => {
    for (const p of path) carveBlock(p)
    if (mouth >= 0) carveBlock(mouth)
  }

  // ── Typ B: Berg → Meer (Abstieg von landNoise, mäandernd) ────────────────────
  const targetB = Math.max(2, Math.round(Math.sqrt(w * h) / 110))
  const sources: { i: number; x: number; y: number }[] = []
  for (let a = 0; a < targetB * 300 && sources.length < targetB; a++) {
    const i = prng.nextInt(0, len - 1)
    if (isWater(i) || (heightNoise[i] ?? 0) < sourceThr) continue
    const x = i % w
    const y = (i - x) / w
    if (sources.every((s) => dist2(x, y, s.x, s.y) >= minSepSq)) sources.push({ i, x, y })
  }
  const WANDER_B = 0.025 // Mäander-Stärke: wählt unter den ABWÄRTS-Nachbarn einen verschobenen
  // Mindestlänge: ein Berg direkt an der Küste ergäbe sonst einen 3-Tile-Stummel — verwerfen.
  const minRiverLen = Math.max(14, Math.round(Math.min(w, h) * 0.08))
  for (const src of sources) {
    const path: number[] = []
    const visited = new Set<number>()
    let cur = src.i
    let mouth = -1
    for (let step = 0; step < maxLen; step++) {
      if (isWater(cur)) {
        mouth = cur
        break
      }
      if (visited.has(cur)) break
      visited.add(cur)
      path.push(cur)
      const cx = cur % w
      const cy = (cur - cx) / w
      const curN = landNoise[cur] ?? 0
      let best = -1
      let bestScore = Infinity
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const ni = (((cy + dy + h) % h) * w + ((cx + dx + w) % w)) | 0
          if ((landNoise[ni] ?? 0) >= curN) continue // nur abwärts → garantiert Richtung Meer
          const score = (landNoise[ni] ?? 0) + WANDER_B * (wander[ni] ?? 0)
          if (score < bestScore) {
            bestScore = score
            best = ni
          }
        }
      }
      if (best < 0) break // lokales Minimum vor dem Meer → Sackgasse, verwerfen
      cur = best
    }
    if (mouth >= 0 && path.length >= minRiverLen) carve(path, mouth) // zu kurze Stummel verwerfen
  }

  // ── Typ A: Meer → Meer, quer durchs Land ─────────────────────────────────────
  // Start an einer Küste, Ziel ein Punkt quer überm Land. Es werden nur Schritte gewählt, die dem
  // Ziel NÄHER kommen → der Pfad ist garantiert schleifenfrei (kann sich nie selbst kreuzen) und
  // terminiert. Sanfter SEITLICHER Wander (kein Heading-Random-Walk) ergibt glatte Schlangenlinien.
  // Erst simulieren, nur bei Meer-Treffer carven → keine im Land versickernden Sackgassen.
  const isCoastLand = (i: number): boolean => {
    if (isWater(i)) return false
    const x = i % w
    const y = (i - x) / w
    return (
      isWater((y * w + ((x + 1) % w)) | 0) ||
      isWater((y * w + ((x - 1 + w) % w)) | 0) ||
      isWater((((y + 1) % h) * w + x) | 0) ||
      isWater((((y - 1 + h) % h) * w + x) | 0)
    )
  }
  // Torus-Delta (kürzeste Richtung) von (ax,ay) nach (bx,by).
  const torusDelta = (ax: number, ay: number, bx: number, by: number): [number, number] => {
    let dx = bx - ax
    let dy = by - ay
    if (dx > w / 2) dx -= w
    if (dx < -w / 2) dx += w
    if (dy > h / 2) dy -= h
    if (dy < -h / 2) dy += h
    return [dx, dy]
  }
  const targetA = Math.max(1, Math.round(Math.sqrt(w * h) / 150))
  const minCross = minRiverLen
  const reach = Math.round(Math.min(w, h) * 0.4) // wie weit das Ziel quer überm Land liegt
  const WANDER_A = 0.85 // seitliche Mäander-Stärke (Anteil quer zur Zielrichtung)
  let madeA = 0
  for (let a = 0; a < targetA * 400 && madeA < targetA; a++) {
    const start = prng.nextInt(0, len - 1)
    if (!isCoastLand(start)) continue
    const sx = start % w
    const sy = (start - sx) / w
    const ang = prng.nextFloat(0, Math.PI * 2)
    const tx = (((sx + Math.round(reach * detCos(ang))) % w) + w) % w
    const ty = (((sy + Math.round(reach * detSin(ang))) % h) + h) % h
    const path: number[] = []
    let cur = start
    let mouth = -1
    let curD2 = dist2(sx, sy, tx, ty)
    for (let step = 0; step < maxLen; step++) {
      if (isWater(cur) && path.length >= minCross) {
        mouth = cur
        break
      }
      path.push(cur)
      const cx = cur % w
      const cy = (cur - cx) / w
      // Zielrichtung (normiert) + seitliche Wander-Auslenkung → glatte Kurve, immer Richtung Ziel.
      const [ddx, ddy] = torusDelta(cx, cy, tx, ty)
      const dl = Math.sqrt(ddx * ddx + ddy * ddy) || 1
      const dirx = ddx / dl
      const diry = ddy / dl
      const lat = WANDER_A * (wander[cur] ?? 0)
      const fx = dirx + -diry * lat
      const fy = diry + dirx * lat
      let best = -1
      let bestScore = -Infinity
      let bestD2 = curD2
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = (cx + dx + w) % w
          const ny = (cy + dy + h) % h
          const nd2 = dist2(nx, ny, tx, ty)
          if (nd2 >= curD2) continue // nur NÄHER ans Ziel → schleifenfrei + terminiert
          const score = dx * fx + dy * fy
          if (score > bestScore) {
            bestScore = score
            best = (ny * w + nx) | 0
            bestD2 = nd2
          }
        }
      }
      if (best < 0) break // Ziel erreicht / keine Annäherung mehr → kein Meer getroffen, verwerfen
      cur = best
      curD2 = bestD2
    }
    if (mouth >= 0) {
      carve(path, mouth)
      madeA++
    }
  }
}

export function generateTerrain(map: GameMap, prng: PRNG, type: TerrainType, rivers = false): void {
  const w = map.width
  const h = map.height
  const len = w * h

  if (type === 'flat') {
    map.terrain.fill(IS_LAND_BIT) // Land, Höhe 0 (Ebene)
    return
  }

  // --- Land/Wasser ---
  // Kontinent-Maske (sehr niederfrequent → wenige große Landmassen) mischt mit
  // einem fraktalen Detail-Feld (fraktale Küsten). Das Detail wird per Domain-
  // Warping leicht verzerrt → organische, weniger „ge-ripplete" Küstenlinien.
  const landRatio = type === 'continents' ? 0.7 : 0.35
  const mask = buildFractalNoise(w, h, prng, 2, 1.0, 2.0, 0.6, 2)
  const detail = buildFractalNoise(w, h, prng, 5, 1.8, 2.0, 0.55, 2)
  const warpX = buildFractalNoise(w, h, prng, 2, 1.0, 2.0, 0.5, 1)
  const warpY = buildFractalNoise(w, h, prng, 2, 1.0, 2.0, 0.5, 1)
  const warpAmp = Math.max(4, Math.round(Math.min(w, h) * 0.05))

  const landNoise = new Float32Array(len)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const wx = (((x + Math.round(warpAmp * (warpX[i] ?? 0))) % w) + w) % w
      const wy = (((y + Math.round(warpAmp * (warpY[i] ?? 0))) % h) + h) % h
      landNoise[i] = 0.6 * (mask[i] ?? 0) + 0.4 * (detail[wy * w + wx] ?? 0)
    }
  }
  const landSorted = new Float32Array(landNoise)
  landSorted.sort()
  const landThreshold = percentile(landSorted, 1 - landRatio)

  // --- Höhe (eigenes fraktales Feld) ---
  // Wenige Oktaven → Berge/Hügel bilden zusammenhängende Gebirgszüge statt
  // einzelner Sprenkel (wichtig damit Terrain die Expansion sichtbar formt).
  const heightNoise = buildFractalNoise(w, h, prng, 3, 2.2, 2.0, 0.5, 2)
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

  // Flüsse (Opt-in, ADR-0015): Quellen an Bergen, Abstieg nach landNoise bis zum Meer.
  if (rivers) carveRivers(map.terrain, prng, landNoise, heightNoise, mountainThr, w, h)
}
