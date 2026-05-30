/**
 * Browser-Lader für gebackene Geo-Karten (ADR-0016). Holt `public/maps/<id>.bin.gz`, dekomprimiert
 * (gzip via `DecompressionStream`), dekodiert und registriert die Karte → danach kann `createGame`
 * sie synchron über die `mapId` aus der Registry nutzen.
 */
import { decodeGeoMap, registerGeoMap, getGeoMap, type GeoMapData } from '../world/geo-map'

/** Verfügbare Geo-Karten (Phase 1). `id` = Asset-/mapId, `labelKey` = i18n-Schlüssel. */
export const GEO_MAPS = [
  { id: 'world', labelKey: 'terrain.world' },
  { id: 'europe', labelKey: 'terrain.europe' },
  { id: 'africa', labelKey: 'terrain.africa' },
  { id: 'australia', labelKey: 'terrain.australia' },
] as const

export type GeoMapId = (typeof GEO_MAPS)[number]['id']

const IDS: ReadonlySet<string> = new Set(GEO_MAPS.map((m) => m.id))

/** Ob `value` eine Geo-Karten-ID ist (vs. prozedural flat/continents/islands). */
export function isGeoMapId(value: string): value is GeoMapId {
  return IDS.has(value)
}

/** Lädt + registriert die Geo-Karte (idempotent) und liefert ihre Daten (inkl. Dimensionen). */
export async function loadGeoMapAsset(id: string): Promise<GeoMapData> {
  const cached = getGeoMap(id)
  if (cached !== undefined) return cached
  // Asset-Endung bewusst .bin (kein .gz): so setzt kein Server Content-Encoding: gzip und der
  // Browser dekomprimiert nicht transparent — wir dekomprimieren hier immer selbst (server-unabhängig).
  const res = await fetch(`${import.meta.env.BASE_URL}maps/${id}.bin`)
  if (!res.ok || res.body === null) {
    throw new Error(`Geo-Karte '${id}' nicht ladbar (HTTP ${String(res.status)})`)
  }
  // gzip direkt im Stream dekomprimieren (kein Zwischen-Blob).
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'))
  const raw = new Uint8Array(await new Response(stream).arrayBuffer())
  const map = decodeGeoMap(raw)
  registerGeoMap(id, map)
  return map
}
