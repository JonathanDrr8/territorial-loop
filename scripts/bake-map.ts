/**
 * Offline-Bake-Tool für Geo-Karten (ADR-0016, Phase 1: echte Küsten + prozedurale Höhen).
 *
 * Quelle: Natural-Earth-Land-Polygone (GeoJSON, Public Domain). Wir rastern die Polygone selbst
 * (Scanline-Even-Odd-Fill) zu einer Land/Wasser-Maske im gewählten Lat/Lon-Ausschnitt, legen
 * prozedurale Höhen aufs Land, erzwingen einen Ozean-Rahmen (Torus-Naht), encodieren ins
 * Asset-Format und schreiben `public/maps/<id>.bin.gz` (gzip).
 *
 * Lauf: `npx tsx scripts/bake-map.ts`. Die GeoJSON-Quelle wird bei Bedarf nach
 * `scripts/.cache/` geladen (gitignored). Committet werden nur die kleinen .bin.gz-Assets.
 *
 * Flüsse kommen in Phase 2 (Natural-Earth-Flusslinien, gleiche Rasterung).
 */
import { gzipSync } from 'node:zlib'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { encodeGeoMap } from '../src/world/geo-map'
import { IS_LAND_BIT, IMPASSABLE_HEIGHT } from '../src/world/terrain'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'scripts', '.cache')
const OUT = join(ROOT, 'public', 'maps')
const LAND_URL =
  'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/50m/physical/ne_50m_land.json'

interface MapDef {
  id: string
  /** Lat/Lon-Ausschnitt (Grad). lonMin/lonMax dürfen -180..180; world = volle Breite (E-W-Wrap). */
  lonMin: number
  lonMax: number
  latMin: number
  latMax: number
  width: number
  height: number
  /** Rand-Tiles, die zwingend zu Wasser werden (Torus-Naht → Wasser-zu-Wasser). */
  oceanBorder: number
  seed: number
}

// Phase-1-Karten: meer-umrandete Ausschnitte (continents) + Welt (E-W nahtlos, Pole abgeschnitten).
const MAPS: MapDef[] = [
  {
    id: 'africa',
    lonMin: -20,
    lonMax: 53,
    latMin: -37,
    latMax: 39,
    width: 512,
    height: 512,
    oceanBorder: 4,
    seed: 1,
  },
  {
    id: 'australia',
    lonMin: 110,
    lonMax: 180,
    latMin: -50,
    latMax: -8,
    width: 512,
    height: 384,
    oceanBorder: 4,
    seed: 2,
  },
  {
    id: 'europe',
    lonMin: -12,
    lonMax: 42,
    latMin: 34,
    latMax: 72,
    width: 512,
    height: 512,
    oceanBorder: 4,
    seed: 3,
  },
  {
    id: 'world',
    lonMin: -180,
    lonMax: 180,
    latMin: -82,
    latMax: 84,
    width: 1024,
    height: 512,
    oceanBorder: 0,
    seed: 4,
  },
]

type Ring = [number, number][] // [lon, lat] Paare
interface FeatureCollection {
  features: { geometry: { type: string; coordinates: unknown } }[]
}

/** Alle Land-Ringe (lon/lat) aus dem GeoJSON sammeln (Polygon + MultiPolygon). */
function collectRings(geo: FeatureCollection): Ring[] {
  const rings: Ring[] = []
  for (const f of geo.features) {
    const g = f.geometry
    if (g.type === 'Polygon') {
      for (const ring of g.coordinates as Ring[]) rings.push(ring)
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates as Ring[][]) for (const ring of poly) rings.push(ring)
    }
  }
  return rings
}

/** Deterministischer Hash → [0,1). */
function hash01(ix: number, iy: number, seed: number): number {
  let n = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}
function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}
/** Glattes Value-Noise (eine Oktave) über Zell-Gitter `cells`. */
function valueNoise(
  x: number,
  y: number,
  w: number,
  h: number,
  cells: number,
  seed: number,
): number {
  const gx = (x / w) * cells
  const gy = (y / h) * cells
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const fx = smooth(gx - x0)
  const fy = smooth(gy - y0)
  const a = hash01(x0, y0, seed)
  const b = hash01(x0 + 1, y0, seed)
  const c = hash01(x0, y0 + 1, seed)
  const d = hash01(x0 + 1, y0 + 1, seed)
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy
}

/** Rastert Land-Ringe in eine Land-Maske (1 = Land) für den Ausschnitt. */
function rasterizeLand(rings: Ring[], m: MapDef): Uint8Array {
  const { width: w, height: h, lonMin, lonMax, latMin, latMax } = m
  const mask = new Uint8Array(w * h)
  // Ringe in Pixel-Koords umrechnen; Kanten sammeln.
  const edges: { x0: number; y0: number; x1: number; y1: number }[] = []
  const toPx = (lon: number): number => ((lon - lonMin) / (lonMax - lonMin)) * w
  const toPy = (lat: number): number => ((latMax - lat) / (latMax - latMin)) * h
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i]
      const b = ring[i + 1]
      if (a === undefined || b === undefined) continue
      edges.push({ x0: toPx(a[0]), y0: toPy(a[1]), x1: toPx(b[0]), y1: toPy(b[1]) })
    }
  }
  // Scanline-Even-Odd-Fill pro Zeile.
  const xs: number[] = []
  for (let py = 0; py < h; py++) {
    const yc = py + 0.5
    xs.length = 0
    for (const e of edges) {
      const { y0, y1 } = e
      if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) {
        xs.push(e.x0 + ((yc - y0) / (y1 - y0)) * (e.x1 - e.x0))
      }
    }
    xs.sort((p, q) => p - q)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = Math.max(0, Math.ceil((xs[i] ?? 0) - 0.5))
      const b = Math.min(w - 1, Math.floor((xs[i + 1] ?? 0) - 0.5))
      for (let px = a; px <= b; px++) mask[py * w + px] = 1
    }
  }
  return mask
}

/** Baut das terrain: Land/Wasser aus Maske, Höhen prozedural auf dem Land, Ozean-Rahmen. */
function buildTerrain(mask: Uint8Array, m: MapDef): Uint8Array {
  const { width: w, height: h, seed, oceanBorder } = m
  const terrain = new Uint8Array(w * h)
  // Höhen-Noise (2 Oktaven) für die Land-Tiles sammeln → Perzentil-Schwellen.
  const heights = new Float32Array(w * h)
  const landVals: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (mask[i] !== 1) continue
      const hv =
        valueNoise(x, y, w, h, 10, seed) * 0.65 + valueNoise(x, y, w, h, 24, seed + 7) * 0.35
      heights[i] = hv
      landVals.push(hv)
    }
  }
  landVals.sort((p, q) => p - q)
  const q = (p: number): number =>
    landVals[Math.min(landVals.length - 1, Math.floor(landVals.length * p))] ?? 1
  const hillThr = q(1 - (0.25 + 0.12 + 0.03)) // oberste 40 % = Hügel+
  const mtnThr = q(1 - (0.12 + 0.03))
  const extThr = q(1 - 0.03)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (mask[i] !== 1) {
        terrain[i] = 0
        continue
      }
      const hv = heights[i]
      let height = 5
      if (hv > extThr) height = IMPASSABLE_HEIGHT
      else if (hv > mtnThr) height = 25
      else if (hv > hillThr) height = 15
      terrain[i] = IS_LAND_BIT | height
    }
  }
  // Ozean-Rahmen erzwingen (Torus-Naht → Wasser-zu-Wasser). 0 bei world (E-W-Wrap ist nahtlos,
  // oben/unten ohnehin Polarmeer).
  if (oceanBorder > 0) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x < oceanBorder || x >= w - oceanBorder || y < oceanBorder || y >= h - oceanBorder) {
          terrain[y * w + x] = 0
        }
      }
    }
  }
  return terrain
}

async function loadLand(): Promise<FeatureCollection> {
  mkdirSync(CACHE, { recursive: true })
  const cached = join(CACHE, 'ne_50m_land.json')
  if (!existsSync(cached)) {
    process.stdout.write('Lade Natural-Earth-Land (50m) …\n')
    const res = await fetch(LAND_URL)
    if (!res.ok) throw new Error(`Download fehlgeschlagen: ${res.status}`)
    writeFileSync(cached, Buffer.from(await res.arrayBuffer()))
  }
  return JSON.parse(readFileSync(cached, 'utf8')) as FeatureCollection
}

async function main(): Promise<void> {
  const geo = await loadLand()
  const rings = collectRings(geo)
  process.stdout.write(`${rings.length} Land-Ringe geladen.\n`)
  mkdirSync(OUT, { recursive: true })
  for (const m of MAPS) {
    const mask = rasterizeLand(rings, m)
    let land = 0
    for (const v of mask) if (v === 1) land++
    const terrain = buildTerrain(mask, m)
    // gzip-Inhalt, aber Endung .bin (kein .gz) → kein Server setzt Content-Encoding: gzip; der
    // Browser-Lader dekomprimiert immer selbst (server-unabhängig, siehe ui/geo-loader.ts).
    const asset = gzipSync(encodeGeoMap(m.width, m.height, terrain))
    writeFileSync(join(OUT, `${m.id}.bin`), asset)
    const pct = ((land / (m.width * m.height)) * 100).toFixed(0)
    process.stdout.write(
      `✓ ${m.id} ${m.width}×${m.height} — ${pct}% Land, ${(asset.length / 1024).toFixed(0)} KB\n`,
    )
  }
}

void main()
