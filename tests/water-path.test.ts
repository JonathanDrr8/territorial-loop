import { describe, it, expect } from 'vitest'
import { createMap } from '../src/world/map'
import { IS_LAND_BIT } from '../src/world/terrain'
import {
  labelWaterComponents,
  sameWaterComponent,
  coastalWater,
  findWaterPath,
  NO_COMPONENT,
} from '../src/world/water-path'
import { tileRef } from '../src/world/torus'

/**
 * Baut eine Map aus einem ASCII-Layout. '#' = Land, '.' = Wasser.
 * Zeilen müssen gleich lang sein.
 */
function mapFromAscii(rows: string[]): ReturnType<typeof createMap> {
  const h = rows.length
  const firstRow = rows[0] ?? ''
  const w = firstRow.length
  const map = createMap(w, h)
  for (let y = 0; y < h; y++) {
    const row = rows[y] ?? ''
    for (let x = 0; x < w; x++) {
      const c = row[x]
      // default land if missing
      map.terrain[y * w + x] = c === '.' ? 0 : IS_LAND_BIT
    }
  }
  return map
}

describe('labelWaterComponents', () => {
  it('marks land as NO_COMPONENT and water with ids', () => {
    const map = mapFromAscii(['#.#', '#.#', '#.#'])
    const comp = labelWaterComponents(map)
    expect(comp[tileRef(0, 0, 3, 3)]).toBe(NO_COMPONENT) // land
    expect(comp[tileRef(1, 0, 3, 3)]).toBeGreaterThanOrEqual(0) // water
    // the whole middle column is one connected component
    const id = comp[tileRef(1, 0, 3, 3)]
    expect(comp[tileRef(1, 1, 3, 3)]).toBe(id)
    expect(comp[tileRef(1, 2, 3, 3)]).toBe(id)
  })

  it('separates two disconnected water bodies into different ids', () => {
    // Land columns at x=0,2,4 isolate the two water columns x=1 and x=3.
    // The torus wrap edge (x=4 ↔ x=0) is land↔land, so they stay separate.
    const map = mapFromAscii(['#.#.#', '#.#.#'])
    const comp = labelWaterComponents(map)
    const left = comp[tileRef(1, 0, 5, 2)]
    const right = comp[tileRef(3, 0, 5, 2)]
    expect(left).toBeGreaterThanOrEqual(0)
    expect(right).toBeGreaterThanOrEqual(0)
    expect(left).not.toBe(right)
  })

  it('wraps across the torus edge (left and right columns connect)', () => {
    // Without wrap these would be two bodies; on a torus the left and right
    // water columns are neighbors and form ONE component.
    const map = mapFromAscii(['.#.', '.#.', '.#.'])
    const comp = labelWaterComponents(map)
    // x=0 and x=2 are torus-adjacent (0-1 wraps to width-1=2)
    expect(sameWaterComponent(comp, tileRef(0, 0, 3, 3), tileRef(2, 0, 3, 3))).toBe(true)
  })
})

describe('coastalWater', () => {
  it('finds an adjacent water tile for a coastal land tile', () => {
    const map = mapFromAscii(['##', '.#'])
    // land at (1,1) has water neighbor at (0,1)
    const w = coastalWater(map, tileRef(1, 1, 2, 2))
    expect(w).toBe(tileRef(0, 1, 2, 2))
  })

  it('returns -1 for a fully landlocked tile', () => {
    const map = mapFromAscii(['###', '###', '###'])
    expect(coastalWater(map, tileRef(1, 1, 3, 3))).toBe(-1)
  })
})

describe('findWaterPath', () => {
  it('finds a straight path along open water', () => {
    const map = mapFromAscii(['.....'])
    const path = findWaterPath(map, tileRef(0, 0, 5, 1), tileRef(4, 0, 5, 1))
    expect(path).not.toBeNull()
    // 0..4 = 5 tiles (or shorter via torus wrap — but on a 5-wide torus the
    // direct route is 4 steps; wrap is also 1 step the other way!)
    expect(path?.[0]).toBe(tileRef(0, 0, 5, 1))
    expect(path?.[path.length - 1]).toBe(tileRef(4, 0, 5, 1))
  })

  it('uses the shorter torus-wrap route when available', () => {
    // 1D ring of width 6, all water. From x=0 to x=5: direct = 5 steps,
    // wrap = 1 step. A* must take the wrap.
    const map = mapFromAscii(['......'])
    const path = findWaterPath(map, tileRef(0, 0, 6, 1), tileRef(5, 0, 6, 1))
    expect(path).not.toBeNull()
    expect(path?.length).toBe(2) // start + goal, one wrap step
  })

  it('routes around a land obstacle', () => {
    // Land border columns (x=0,4) block the torus wrap; a land plug at (2,1)
    // forces the route from (1,1) to (3,1) to detour through row 0 or row 2.
    const map = mapFromAscii(['#...#', '#.#.#', '#...#'])
    const path = findWaterPath(map, tileRef(1, 1, 5, 3), tileRef(3, 1, 5, 3))
    expect(path).not.toBeNull()
    // direct hop is blocked by the plug → must go around (4 steps, 5 tiles)
    expect(path?.length ?? 0).toBeGreaterThan(2)
    // and the plug tile is never on the path
    expect(path?.includes(tileRef(2, 1, 5, 3))).toBe(false)
  })

  it('returns null when goal is on a different water component', () => {
    // Land columns (x=0,2,4) isolate the two water columns (x=1,3). On a
    // 5-wide torus the wrap edge joins land to land, so the water columns
    // never connect → two components.
    const map = mapFromAscii(['#.#.#', '#.#.#'])
    const comp = labelWaterComponents(map)
    const a = tileRef(1, 0, 5, 2)
    const b = tileRef(3, 0, 5, 2)
    expect(sameWaterComponent(comp, a, b)).toBe(false)
    expect(findWaterPath(map, a, b, comp)).toBeNull()
  })

  it('returns null when start or goal is land', () => {
    const map = mapFromAscii(['#..'])
    expect(findWaterPath(map, tileRef(0, 0, 3, 1), tileRef(2, 0, 3, 1))).toBeNull()
  })
})
