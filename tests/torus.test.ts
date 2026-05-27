import { describe, it, expect } from 'vitest'
import { wrap, tileRef, tileXY, torusDistance, neighbors4, neighbors8 } from '../src/world/torus'

describe('wrap', () => {
  it('returns value unchanged when in range', () => {
    expect(wrap(0, 10)).toBe(0)
    expect(wrap(5, 10)).toBe(5)
    expect(wrap(9, 10)).toBe(9)
  })

  it('wraps positive overflow', () => {
    expect(wrap(10, 10)).toBe(0)
    expect(wrap(11, 10)).toBe(1)
    expect(wrap(25, 10)).toBe(5)
  })

  it('wraps negative values', () => {
    expect(wrap(-1, 10)).toBe(9)
    expect(wrap(-5, 10)).toBe(5)
    expect(wrap(-10, 10)).toBe(0)
    expect(wrap(-11, 10)).toBe(9)
  })
})

describe('tileRef', () => {
  it('computes flat index for in-range coords', () => {
    expect(tileRef(0, 0, 10, 10)).toBe(0)
    expect(tileRef(5, 0, 10, 10)).toBe(5)
    expect(tileRef(0, 1, 10, 10)).toBe(10)
    expect(tileRef(3, 4, 10, 10)).toBe(43)
  })

  it('wraps negative coords', () => {
    expect(tileRef(-1, 0, 10, 10)).toBe(9)
    expect(tileRef(0, -1, 10, 10)).toBe(90)
    expect(tileRef(-1, -1, 10, 10)).toBe(99)
  })

  it('wraps overflow coords', () => {
    expect(tileRef(10, 0, 10, 10)).toBe(0)
    expect(tileRef(0, 10, 10, 10)).toBe(0)
    expect(tileRef(13, 14, 10, 10)).toBe(tileRef(3, 4, 10, 10))
  })

  it('handles non-square maps', () => {
    expect(tileRef(0, 0, 7, 13)).toBe(0)
    expect(tileRef(6, 12, 7, 13)).toBe(6 * 1 + 12 * 7)
    expect(tileRef(7, 0, 7, 13)).toBe(0)
    expect(tileRef(0, 13, 7, 13)).toBe(0)
  })
})

describe('tileXY', () => {
  it('inverts tileRef for in-range coords', () => {
    const cases: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [5, 0],
      [0, 1],
      [3, 4],
      [9, 9],
    ]
    for (const [x, y] of cases) {
      const ref = tileRef(x, y, 10, 10)
      expect(tileXY(ref, 10)).toEqual([x, y])
    }
  })

  it('inverts tileRef on non-square map', () => {
    const ref = tileRef(5, 11, 7, 13)
    expect(tileXY(ref, 7)).toEqual([5, 11])
  })
})

describe('torusDistance', () => {
  it('returns 0 for identical points', () => {
    expect(torusDistance(5, 5, 5, 5, 10, 10)).toBe(0)
  })

  it('matches euclidean for points in the same quadrant', () => {
    expect(torusDistance(0, 0, 3, 4, 100, 100)).toBeCloseTo(5)
  })

  it('uses wrap-around for distant-looking points', () => {
    expect(torusDistance(0, 0, 9, 0, 10, 10)).toBe(1)
    expect(torusDistance(0, 0, 0, 9, 10, 10)).toBe(1)
    expect(torusDistance(0, 0, 9, 9, 10, 10)).toBeCloseTo(Math.SQRT2)
  })

  it('is symmetric', () => {
    expect(torusDistance(2, 3, 7, 8, 10, 10)).toBeCloseTo(torusDistance(7, 8, 2, 3, 10, 10))
  })

  it('handles unwrapped input coords', () => {
    expect(torusDistance(-1, 0, 1, 0, 10, 10)).toBe(2)
    expect(torusDistance(11, 0, 1, 0, 10, 10)).toBe(0)
  })

  it('max distance is half map diagonal', () => {
    const w = 10
    const h = 10
    const expected = Math.sqrt((w / 2) ** 2 + (h / 2) ** 2)
    expect(torusDistance(0, 0, w / 2, h / 2, w, h)).toBeCloseTo(expected)
  })
})

describe('neighbors4', () => {
  it('returns 4 distinct neighbors in the map center', () => {
    const ref = tileRef(5, 5, 10, 10)
    const ns = neighbors4(ref, 10, 10)
    expect(ns).toHaveLength(4)
    expect(new Set(ns).size).toBe(4)
  })

  it('wraps at right edge', () => {
    const corner = tileRef(9, 5, 10, 10)
    const ns = neighbors4(corner, 10, 10)
    expect(ns).toContain(tileRef(0, 5, 10, 10))
  })

  it('wraps at left edge', () => {
    const corner = tileRef(0, 5, 10, 10)
    const ns = neighbors4(corner, 10, 10)
    expect(ns).toContain(tileRef(9, 5, 10, 10))
  })

  it('wraps at top edge', () => {
    const corner = tileRef(5, 0, 10, 10)
    const ns = neighbors4(corner, 10, 10)
    expect(ns).toContain(tileRef(5, 9, 10, 10))
  })

  it('wraps at corner (all 4 wrap)', () => {
    const corner = tileRef(0, 0, 10, 10)
    const ns = neighbors4(corner, 10, 10)
    expect(ns).toContain(tileRef(9, 0, 10, 10))
    expect(ns).toContain(tileRef(0, 9, 10, 10))
    expect(ns).toContain(tileRef(1, 0, 10, 10))
    expect(ns).toContain(tileRef(0, 1, 10, 10))
  })
})

describe('neighbors8', () => {
  it('returns 8 distinct neighbors in the map center', () => {
    const ref = tileRef(5, 5, 10, 10)
    const ns = neighbors8(ref, 10, 10)
    expect(ns).toHaveLength(8)
    expect(new Set(ns).size).toBe(8)
  })

  it('includes all 4 orthogonal and all 4 diagonal neighbors', () => {
    const ref = tileRef(5, 5, 10, 10)
    const ns = neighbors8(ref, 10, 10)
    // Orthogonal
    expect(ns).toContain(tileRef(6, 5, 10, 10))
    expect(ns).toContain(tileRef(4, 5, 10, 10))
    expect(ns).toContain(tileRef(5, 6, 10, 10))
    expect(ns).toContain(tileRef(5, 4, 10, 10))
    // Diagonal
    expect(ns).toContain(tileRef(6, 6, 10, 10))
    expect(ns).toContain(tileRef(6, 4, 10, 10))
    expect(ns).toContain(tileRef(4, 6, 10, 10))
    expect(ns).toContain(tileRef(4, 4, 10, 10))
  })

  it('wraps at corner', () => {
    const corner = tileRef(0, 0, 10, 10)
    const ns = neighbors8(corner, 10, 10)
    expect(ns).toHaveLength(8)
    expect(ns).toContain(tileRef(9, 9, 10, 10))
  })
})
