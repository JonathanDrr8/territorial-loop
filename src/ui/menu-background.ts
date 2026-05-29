/**
 * Menü-Hintergrund: einmal beim Öffnen frisch generierte Terrain-Karte (ADR-0014).
 *
 * Zeichnet NUR die Landschaft (Wasser/Untiefen/Höhenstufen/Fels) — keine Nationen,
 * keine Labels —, denn genau die bunten Blobs wären ablenkend. Das Ergebnis kommt als
 * Daten-URL zurück und wird in der Shell stark gedämpft (Blur + Abdunklung + Vignette,
 * siehe `menu-shell.ts`) hinter den Inhalt gelegt.
 *
 * Bewusst keine Spiel-Determinismus-Garantie nötig (reine Deko): der Seed darf aus der Uhr
 * kommen, damit jede Menü-Öffnung eine andere Karte zeigt.
 */

import { createPRNG } from '../core/random'
import { createMap } from '../world/map'
import { generateTerrain, HEIGHT_MASK, IMPASSABLE_HEIGHT, IS_LAND_BIT } from '../world/terrain'

// Terrain-Basisfarben — bewusst identisch zu `renderer.ts`, damit der Backdrop on-brand ist.
const WATER: readonly [number, number, number] = [24, 48, 92]
const SHALLOW: readonly [number, number, number] = [64, 122, 150]
const ROCK: readonly [number, number, number] = [70, 66, 62]
const PLAINS: readonly [number, number, number] = [26, 32, 28]
const HILLS: readonly [number, number, number] = [58, 52, 36]
const MOUNTAINS: readonly [number, number, number] = [92, 82, 66]

/** Auflösung der Backdrop-Karte (klein → schnell; wird per CSS hochskaliert + geblurrt). */
const BG_W = 384
const BG_H = 240

/**
 * Generiert eine Terrain-Karte und gibt sie als PNG-Daten-URL zurück. `null`, falls 2D-Kontext
 * fehlt (z. B. Test-Umgebung) — die Shell fällt dann auf den reinen Verlauf zurück.
 */
export function generateMenuBackground(seed?: string): string | null {
  const map = createMap(BG_W, BG_H)
  const prng = createPRNG(seed ?? `menu-${Date.now().toString()}`)
  // „continents" → zusammenhängende Landmassen mit Küsten (ruhigeres Bild als viele Inseln).
  generateTerrain(map, prng, 'continents')

  const canvas = document.createElement('canvas')
  canvas.width = BG_W
  canvas.height = BG_H
  const ctx = canvas.getContext('2d')
  if (ctx === null) return null

  const img = ctx.createImageData(BG_W, BG_H)
  const data = img.data
  const terrain = map.terrain
  for (let y = 0; y < BG_H; y++) {
    for (let x = 0; x < BG_W; x++) {
      const i = y * BG_W + x
      const t = terrain[i] ?? 0
      let c: readonly [number, number, number]
      if ((t & IS_LAND_BIT) === 0) {
        // Wasser: an Land grenzend → Untiefe (heller), sonst Tiefsee. Torus-Wrap bei Nachbarn.
        const l = terrain[y * BG_W + (x === 0 ? BG_W - 1 : x - 1)] ?? 0
        const r = terrain[y * BG_W + (x === BG_W - 1 ? 0 : x + 1)] ?? 0
        const u = terrain[(y === 0 ? BG_H - 1 : y - 1) * BG_W + x] ?? 0
        const d = terrain[(y === BG_H - 1 ? 0 : y + 1) * BG_W + x] ?? 0
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
