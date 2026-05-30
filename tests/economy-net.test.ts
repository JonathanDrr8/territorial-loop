import { describe, it, expect } from 'vitest'
import { createMap, setOwner, type GameMap } from '../src/world/map'
import { IS_LAND_BIT, IMPASSABLE_HEIGHT } from '../src/world/terrain'
import { computeOwnerComponents, sameOwnerComponent, BRIDGE_SPAN } from '../src/world/economy-net'
import { tileRef } from '../src/world/torus'

/**
 * Baut eine Map aus ASCII. '.' = Wasser, '#' = neutrales Land (Owner 0), '1'–'9' = Land mit dem
 * Owner, 'X' = Berg (Land, aber impassierbar). Zeilen müssen gleich lang sein. Genug neutraler
 * Rand verhindert ungewollte Torus-Wrap-Verbindungen.
 */
function mapFromAscii(rows: string[]): GameMap {
  const h = rows.length
  const w = (rows[0] ?? '').length
  const map = createMap(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = rows[y]?.[x] ?? '.'
      const ref = y * w + x
      if (c === '.') {
        map.terrain[ref] = 0
      } else if (c === 'X') {
        map.terrain[ref] = IS_LAND_BIT | IMPASSABLE_HEIGHT
      } else {
        map.terrain[ref] = IS_LAND_BIT
        if (c >= '1' && c <= '9') setOwner(map, ref, Number(c))
      }
    }
  }
  return map
}

describe('computeOwnerComponents (ADR-0018)', () => {
  it('verbindet 4-connected gleiches Eigenland zu einer Komponente', () => {
    const map = mapFromAscii(['#####', '#111#', '#####'])
    const comp = computeOwnerComponents(map)
    const w = map.width
    expect(sameOwnerComponent(comp, tileRef(1, 1, w, 3), tileRef(2, 1, w, 3))).toBe(true)
    expect(sameOwnerComponent(comp, tileRef(2, 1, w, 3), tileRef(3, 1, w, 3))).toBe(true)
  })

  it('trennt eigenes Land, das durch FREMDES Land unterbrochen ist', () => {
    // owner1 — owner2 — owner1 nebeneinander: die beiden 1er sind nicht verbunden.
    const map = mapFromAscii(['#####', '#121#', '#####'])
    const w = map.width
    const comp = computeOwnerComponents(map)
    expect(sameOwnerComponent(comp, tileRef(1, 1, w, 3), tileRef(3, 1, w, 3))).toBe(false)
  })

  it('Brücke: verbindet über schmales Wasser (≤ BRIDGE_SPAN)', () => {
    // 2 Wasser-Tiles zwischen zwei eigenen Land-Tiles → Brücke.
    const map = mapFromAscii(['#######', '#1..1##', '#######'])
    const w = map.width
    const comp = computeOwnerComponents(map)
    expect(BRIDGE_SPAN).toBeGreaterThanOrEqual(3)
    expect(sameOwnerComponent(comp, tileRef(1, 1, w, 3), tileRef(4, 1, w, 3))).toBe(true)
  })

  it('keine Brücke über zu breites Wasser (> BRIDGE_SPAN)', () => {
    // 5 Wasser-Tiles (> BRIDGE_SPAN=4) → keine Brücke.
    const map = mapFromAscii(['##########', '#1.....1##', '##########'])
    const w = map.width
    const comp = computeOwnerComponents(map)
    expect(sameOwnerComponent(comp, tileRef(1, 1, w, 3), tileRef(7, 1, w, 3))).toBe(false)
  })

  it('Brücke blockiert durch fremdes Land in der Mitte', () => {
    // owner1 . owner2 . owner1 — das fremde Land stoppt den Brücken-Scan.
    const map = mapFromAscii(['########', '#1.2.1##', '########'])
    const w = map.width
    const comp = computeOwnerComponents(map)
    expect(sameOwnerComponent(comp, tileRef(1, 1, w, 3), tileRef(5, 1, w, 3))).toBe(false)
  })

  it('Berg (impassierbar) blockiert die Verbindung', () => {
    const map = mapFromAscii(['######', '#1X1##', '######'])
    const w = map.width
    const comp = computeOwnerComponents(map)
    expect(sameOwnerComponent(comp, tileRef(1, 1, w, 3), tileRef(3, 1, w, 3))).toBe(false)
  })

  it('Wasser/Berg/Niemandsland bekommen keine Komponente (-1)', () => {
    const map = mapFromAscii(['#1.X#'])
    const w = map.width
    expect(computeOwnerComponents(map)[tileRef(0, 0, w, 1)]).toBe(-1) // neutrales Land
    expect(computeOwnerComponents(map)[tileRef(2, 0, w, 1)]).toBe(-1) // Wasser
    expect(computeOwnerComponents(map)[tileRef(3, 0, w, 1)]).toBe(-1) // Berg
    expect(computeOwnerComponents(map)[tileRef(1, 0, w, 1)]).toBeGreaterThanOrEqual(0) // owner1
  })
})
