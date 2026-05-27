/**
 * Map-Datenstruktur — Dual-TypedArray nach OpenFront-Vorbild.
 *
 * Siehe `docs/decisions/0002-map-datenstruktur.md` für Begründung.
 *
 * Bit-Layout `state[i]` (Uint16):
 *   Bits 0-11 (0x0FFF): ownerID (0 = neutral, 1..4095 = Spieler)
 *   Bits 12-15:         reserviert (Border-Flag, Capture-Progress, Defense-Bonus)
 *
 * Bit-Layout `terrain[i]` (Uint8): im MVP unbenutzt (alle Tiles = Land);
 * Struktur reserviert für Post-MVP-Terrain.
 *
 * Performance-Hinweis: getOwner/setOwner sind die "sichere" API für Modul-
 * Grenzen, mit Bounds-Check. In Hot Loops (Tick-Pipeline, Frontier-Iteration)
 * sollte direkt auf `state[ref]` zugegriffen werden — der Bounds-Check
 * mehrfach pro Tile kostet zu viel.
 */

import type { TileRef } from './torus'

/** Maximum-ID = 0xFFF = 4095. ownerID == 0 ist reserviert für "neutral". */
export const OWNER_MASK = 0x0fff

/** Maximum mögliche Spieler-ID (inkl.). 0 ist neutral, also 4095 spielbare IDs. */
export const MAX_OWNER_ID = OWNER_MASK

export interface GameMap {
  readonly width: number
  readonly height: number
  readonly terrain: Uint8Array
  readonly state: Uint16Array
}

/**
 * Erzeugt eine leere Map. Beide TypedArrays sind mit 0 initialisiert
 * (`Uint8Array` und `Uint16Array` garantieren das per Spec).
 */
export function createMap(width: number, height: number): GameMap {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError(`Map dimensions must be positive integers, got ${width}x${height}`)
  }
  const len = width * height
  return {
    width,
    height,
    terrain: new Uint8Array(len),
    state: new Uint16Array(len),
  }
}

/** Wirft RangeError wenn `ref` außerhalb der Map liegt. Sonst gibt den State-Wert zurück. */
function readState(map: GameMap, ref: TileRef): number {
  const v = map.state[ref]
  if (v === undefined) {
    throw new RangeError(`TileRef ${ref} out of bounds for map ${map.width}x${map.height}`)
  }
  return v
}

/** Liest die ownerID eines Tiles. */
export function getOwner(map: GameMap, ref: TileRef): number {
  return readState(map, ref) & OWNER_MASK
}

/**
 * Setzt die ownerID eines Tiles, lässt die oberen 4 Bits unverändert.
 * Wirft `RangeError` wenn `ownerId` außerhalb `[0, MAX_OWNER_ID]` liegt
 * oder `ref` out-of-bounds ist.
 */
export function setOwner(map: GameMap, ref: TileRef, ownerId: number): void {
  if (!Number.isInteger(ownerId) || ownerId < 0 || ownerId > MAX_OWNER_ID) {
    throw new RangeError(`Owner ID ${ownerId} out of range 0..${MAX_OWNER_ID}`)
  }
  const current = readState(map, ref)
  map.state[ref] = (current & ~OWNER_MASK) | ownerId
}
