/**
 * Terrain als Bild: gemeinsamer Maler für den Menü-Hintergrund (ADR-0014) UND die groben
 * Vorschau-Thumbnails laufender Spiele im Lobby-Browser (ADR-0014 Phase 2).
 *
 * Zeichnet NUR die Landschaft (Wasser/Untiefen/Höhenstufen/Fels) — keine Nationen, keine Labels.
 * Das Ergebnis kommt als PNG-Daten-URL zurück; die Aufrufer dämpfen/skalieren es per CSS.
 *
 * Bewusst keine Spiel-Determinismus-Garantie nötig (reine Deko): der Seed darf aus der Uhr
 * kommen. Bei Thumbnails ist der Seed der echte Match-Seed → die Vorschau matcht die Karten-Form
 * (bei sehr großen Karten approximiert, da die Generier-Auflösung gedeckelt wird).
 */

import { createPRNG } from '../core/random'
import { createMap } from '../world/map'
import {
  generateTerrain,
  HEIGHT_MASK,
  IMPASSABLE_HEIGHT,
  IS_LAND_BIT,
  type TerrainType,
} from '../world/terrain'

// Terrain-Basisfarben — bewusst identisch zu `renderer.ts`, damit Backdrop/Vorschau on-brand sind.
const WATER: readonly [number, number, number] = [24, 48, 92]
const SHALLOW: readonly [number, number, number] = [64, 122, 150]
const ROCK: readonly [number, number, number] = [70, 66, 62]
const PLAINS: readonly [number, number, number] = [26, 32, 28]
const HILLS: readonly [number, number, number] = [58, 52, 36]
const MOUNTAINS: readonly [number, number, number] = [92, 82, 66]

export interface TerrainImageOptions {
  seed: string
  terrain: TerrainType
  /** Karten-Dimensionen (Seitenverhältnis); die Generier-Auflösung wird auf `maxDim` gedeckelt. */
  width: number
  height: number
  /** Obergrenze der längeren Kante bei der Generierung (Default 384 — schnell, reicht als Vorschau). */
  maxDim?: number
}

/**
 * Generiert eine Terrain-Karte und gibt sie als PNG-Daten-URL zurück. `null`, falls 2D-Kontext
 * fehlt (z. B. Test-Umgebung) — die Aufrufer fallen dann sauber zurück.
 */
export function generateTerrainDataUrl(opts: TerrainImageOptions): string | null {
  const maxDim = opts.maxDim ?? 384
  const longest = Math.max(opts.width, opts.height)
  const scale = longest > maxDim ? maxDim / longest : 1
  const w = Math.max(2, Math.round(opts.width * scale))
  const h = Math.max(2, Math.round(opts.height * scale))

  const map = createMap(w, h)
  generateTerrain(map, createPRNG(opts.seed), opts.terrain)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx === null) return null

  const img = ctx.createImageData(w, h)
  const data = img.data
  const terrain = map.terrain
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const t = terrain[i] ?? 0
      let c: readonly [number, number, number]
      if ((t & IS_LAND_BIT) === 0) {
        // Wasser: an Land grenzend → Untiefe (heller), sonst Tiefsee. Torus-Wrap bei Nachbarn.
        const l = terrain[y * w + (x === 0 ? w - 1 : x - 1)] ?? 0
        const r = terrain[y * w + (x === w - 1 ? 0 : x + 1)] ?? 0
        const u = terrain[(y === 0 ? h - 1 : y - 1) * w + x] ?? 0
        const d = terrain[(y === h - 1 ? 0 : y + 1) * w + x] ?? 0
        const coastal =
          (l & IS_LAND_BIT) !== 0 ||
          (r & IS_LAND_BIT) !== 0 ||
          (u & IS_LAND_BIT) !== 0 ||
          (d & IS_LAND_BIT) !== 0
        c = coastal ? SHALLOW : WATER
      } else {
        const height = t & HEIGHT_MASK
        c =
          height === IMPASSABLE_HEIGHT
            ? ROCK
            : height >= 20
              ? MOUNTAINS
              : height >= 10
                ? HILLS
                : PLAINS
      }
      const o = i * 4
      data[o] = c[0]
      data[o + 1] = c[1]
      data[o + 2] = c[2]
      data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

/** Menü-Hintergrund: eine zufällige (deko) Kontinent-Karte im Menü-Seitenverhältnis. */
export function generateMenuBackground(seed?: string): string | null {
  return generateTerrainDataUrl({
    seed: seed ?? `menu-${Date.now().toString()}`,
    terrain: 'continents',
    width: 384,
    height: 240,
  })
}
