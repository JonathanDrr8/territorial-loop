/**
 * Karten-Vorschau fürs Start-/Lobby-Menü.
 *
 * Generiert das Terrain für einen Seed (in REDUZIERTER Auflösung) und malt es als
 * Minimap-artiges Thumbnail — selbe Höhen-/Wasserfärbung wie der Renderer, nur ohne
 * Besitz-Farben (im Menü gibt es noch keine Nationen). Da das Terrain-Noise normalisiert
 * samplet (Frequenzen in Zyklen-pro-Karte), zeigt die kleine Auflösung dieselben
 * Kontinent-Formen wie das echte Match — man kann also „würfeln bis die Karte cool aussieht".
 *
 * Rein darstellend, kein Spiel-State. Deterministisch (Seed → identisches Bild).
 */

import { createMap } from '../world/map'
import {
  generateTerrain,
  isLand,
  HEIGHT_MASK,
  IMPASSABLE_HEIGHT,
  type TerrainType,
} from '../world/terrain'
import { createPRNG } from '../core/random'

/** Längere Kante des generierten Vorschau-Terrains (Tiles). Klein → sofort neu würfelbar. */
const PREVIEW_MAX = 200

export interface MapPreviewOpts {
  readonly seed: string
  readonly mapWidth: number
  readonly mapHeight: number
  readonly terrain: TerrainType
  readonly rivers: boolean
  readonly riverDensity: number
}

export interface MapPreviewApi {
  readonly element: HTMLElement
  /** Neu generieren + zeichnen (bei Seed-/Größe-/Terrain-Wechsel). */
  render(opts: MapPreviewOpts): void
  destroy(): void
}

// Farben wie im Renderer (renderer.ts) — Wasser nach Tiefe, Land nach Höhenstufe.
const WATER: readonly [number, number, number] = [24, 48, 92]
const SHALLOW: readonly [number, number, number] = [64, 122, 150]
const PLAINS: readonly [number, number, number] = [26, 32, 28]
const HILLS: readonly [number, number, number] = [58, 52, 36]
const MOUNTAINS: readonly [number, number, number] = [92, 82, 66]
const PEAK: readonly [number, number, number] = [150, 160, 175]

/** Vorschau-Maße (Tiles) aus dem Karten-Seitenverhältnis, längere Kante = PREVIEW_MAX. */
function previewDims(mapWidth: number, mapHeight: number): { w: number; h: number } {
  const aspect = mapWidth / mapHeight
  const w = aspect >= 1 ? PREVIEW_MAX : Math.max(1, Math.round(PREVIEW_MAX * aspect))
  const h = aspect >= 1 ? Math.max(1, Math.round(PREVIEW_MAX / aspect)) : PREVIEW_MAX
  return { w, h }
}

export function createMapPreview(displaySize = 160): MapPreviewApi {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = [
    'position: relative',
    'border-radius: 6px',
    'overflow: hidden',
    'outline: 1px solid var(--tl-border, rgba(255,255,255,0.18))',
    'background: rgba(0,0,0,0.4)',
    'flex: 0 0 auto',
  ].join(';')

  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'display: block; image-rendering: auto'
  wrapper.appendChild(canvas)

  const ctx = canvas.getContext('2d')

  function render(opts: MapPreviewOpts): void {
    if (ctx === null) return
    const { w, h } = previewDims(opts.mapWidth, opts.mapHeight)

    // Vorschau-Terrain generieren (reduzierte Auflösung, gleicher Seed/Typ/Flüsse).
    const map = createMap(w, h)
    const prng = createPRNG(opts.seed)
    generateTerrain(map, prng, opts.terrain, opts.rivers, opts.riverDensity)
    const terrain = map.terrain

    // Canvas auf Vorschau-Auflösung, CSS skaliert aufs Anzeige-Maß (längere Kante = displaySize).
    canvas.width = w
    canvas.height = h
    const cssW = w >= h ? displaySize : Math.round(displaySize * (w / h))
    const cssH = w >= h ? Math.round(displaySize * (h / w)) : displaySize
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`

    const img = ctx.createImageData(w, h)
    const data = img.data
    for (let i = 0; i < terrain.length; i++) {
      const land = isLand(terrain, i)
      let col: readonly [number, number, number]
      if (!land) {
        // Flachwasser an der Küste (mind. ein Land-Nachbar) → heller, sonst Tiefsee.
        const x = i % w
        const y = (i - x) / w
        const coast =
          isLand(terrain, y * w + (x === 0 ? w - 1 : x - 1)) ||
          isLand(terrain, y * w + (x === w - 1 ? 0 : x + 1)) ||
          isLand(terrain, (y === 0 ? h - 1 : y - 1) * w + x) ||
          isLand(terrain, (y === h - 1 ? 0 : y + 1) * w + x)
        col = coast ? SHALLOW : WATER
      } else {
        const height = (terrain[i] ?? 0) & HEIGHT_MASK
        if (height === IMPASSABLE_HEIGHT) col = PEAK
        else if (height >= 20) col = MOUNTAINS
        else if (height >= 10) col = HILLS
        else col = PLAINS
      }
      const o = i * 4
      data[o] = col[0]
      data[o + 1] = col[1]
      data[o + 2] = col[2]
      data[o + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }

  return {
    element: wrapper,
    render,
    destroy(): void {
      wrapper.remove()
    },
  }
}
