/**
 * Gebackene Geo-Karten (ADR-0016): aus echten Geodaten offline erzeugte Karten, die zur Laufzeit
 * als Asset geladen statt prozedural generiert werden.
 *
 * Dieses Modul ist **rein** (keine Browser-/Node-spezifischen APIs): nur Format-Encode/Decode +
 * eine Registry. Das eigentliche Laden (fetch im Browser, fs im Server) macht der jeweilige
 * Aufruf-Kontext und ruft dann {@link registerGeoMap} — `createGame` liest die Karte synchron aus
 * der Registry über die `mapId`.
 *
 * Asset-Format (dekomprimierte Bytes):
 *   [0]    Version (= 1)
 *   [1..4] Breite  (Uint32 LE)
 *   [5..8] Höhe    (Uint32 LE)
 *   [9..]  terrain (Breite*Höhe Bytes, identisches Layout wie `world/terrain.ts`)
 * Im Repo liegen die Assets gzip-komprimiert; der Lader dekomprimiert vor `decodeGeoMap`.
 */

const GEO_MAP_VERSION = 1
const HEADER_BYTES = 9

export interface GeoMapData {
  readonly width: number
  readonly height: number
  /** terrain-Bytes (Bit7 = Land, Bits0-4 = Höhe; siehe `world/terrain.ts`). */
  readonly terrain: Uint8Array
}

/** Serialisiert eine Geo-Karte ins Asset-Format (unkomprimiert). */
export function encodeGeoMap(width: number, height: number, terrain: Uint8Array): Uint8Array {
  if (terrain.length !== width * height) {
    throw new Error(`encodeGeoMap: terrain.length ${terrain.length} ≠ ${width}*${height}`)
  }
  const buf = new Uint8Array(HEADER_BYTES + terrain.length)
  const dv = new DataView(buf.buffer)
  buf[0] = GEO_MAP_VERSION
  dv.setUint32(1, width, true)
  dv.setUint32(5, height, true)
  buf.set(terrain, HEADER_BYTES)
  return buf
}

/** Liest das Asset-Format (unkomprimierte Bytes) → Breite/Höhe/terrain. */
export function decodeGeoMap(bytes: Uint8Array): GeoMapData {
  if (bytes.length < HEADER_BYTES) throw new Error('decodeGeoMap: zu kurz')
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const version = bytes[0]
  if (version !== GEO_MAP_VERSION) throw new Error(`decodeGeoMap: Version ${String(version)}`)
  const width = dv.getUint32(1, true)
  const height = dv.getUint32(5, true)
  const need = HEADER_BYTES + width * height
  if (bytes.length < need) throw new Error(`decodeGeoMap: ${bytes.length} < ${need} Bytes`)
  // Kopie, damit das terrain unabhängig vom Eingabe-Buffer lebt.
  const terrain = bytes.slice(HEADER_BYTES, HEADER_BYTES + width * height)
  return { width, height, terrain }
}

// ── Registry ─────────────────────────────────────────────────────────────────
// Der jeweilige Lade-Kontext (Browser/Server) registriert die dekodierte Karte; `createGame` holt
// sie synchron über die `mapId`.
const registry = new Map<string, GeoMapData>()

export function registerGeoMap(id: string, map: GeoMapData): void {
  registry.set(id, map)
}

export function getGeoMap(id: string): GeoMapData | undefined {
  return registry.get(id)
}

export function hasGeoMap(id: string): boolean {
  return registry.has(id)
}
