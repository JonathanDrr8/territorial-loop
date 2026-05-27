import { describe, it, expect } from 'vitest'
import { createPRNG } from '../src/core/random'

describe('createPRNG', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createPRNG('test-seed')
    const b = createPRNG('test-seed')
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next())
    }
  })

  it('produces different sequences for different seeds', () => {
    const a = createPRNG('seed-a')
    const b = createPRNG('seed-b')
    // Extrem unwahrscheinlich dass die ersten 10 Werte alle gleich sind
    let diffCount = 0
    for (let i = 0; i < 10; i++) {
      if (a.next() !== b.next()) diffCount++
    }
    expect(diffCount).toBeGreaterThan(8)
  })

  it('next() returns values in [0, 1)', () => {
    const rng = createPRNG('range-test')
    for (let i = 0; i < 1000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('nextInt', () => {
  it('returns values in [min, max)', () => {
    const rng = createPRNG('int-range')
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(5, 10)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThan(10)
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('returns min when min === max', () => {
    const rng = createPRNG('eq')
    expect(rng.nextInt(7, 7)).toBe(7)
  })

  it('rejects non-integer bounds', () => {
    const rng = createPRNG('x')
    expect(() => rng.nextInt(0.5, 10)).toThrow(TypeError)
    expect(() => rng.nextInt(0, 10.5)).toThrow(TypeError)
  })

  it('rejects min > max', () => {
    const rng = createPRNG('x')
    expect(() => rng.nextInt(10, 5)).toThrow(RangeError)
  })

  it('covers the entire range over many calls', () => {
    const rng = createPRNG('coverage')
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i++) {
      seen.add(rng.nextInt(0, 5))
    }
    expect(seen).toEqual(new Set([0, 1, 2, 3, 4]))
  })
})

describe('nextFloat', () => {
  it('returns values in [min, max)', () => {
    const rng = createPRNG('float')
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextFloat(-5, 5)
      expect(v).toBeGreaterThanOrEqual(-5)
      expect(v).toBeLessThan(5)
    }
  })

  it('rejects min > max', () => {
    const rng = createPRNG('x')
    expect(() => rng.nextFloat(10, 5)).toThrow(RangeError)
  })
})

describe('randElement', () => {
  it('returns an element of the array', () => {
    const rng = createPRNG('elem')
    const arr = ['a', 'b', 'c'] as const
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(rng.randElement(arr))
    }
  })

  it('throws on empty array', () => {
    const rng = createPRNG('empty')
    expect(() => rng.randElement([])).toThrow(RangeError)
  })

  it('covers all elements over many calls', () => {
    const rng = createPRNG('elem-coverage')
    const arr = [1, 2, 3, 4]
    const seen = new Set<number>()
    for (let i = 0; i < 200; i++) {
      seen.add(rng.randElement(arr))
    }
    expect(seen).toEqual(new Set(arr))
  })
})

describe('chance', () => {
  it('returns true ~p fraction of the time', () => {
    const rng = createPRNG('chance')
    let trueCount = 0
    const N = 10000
    for (let i = 0; i < N; i++) {
      if (rng.chance(0.3)) trueCount++
    }
    const ratio = trueCount / N
    expect(ratio).toBeGreaterThan(0.27)
    expect(ratio).toBeLessThan(0.33)
  })

  it('always false for p=0', () => {
    const rng = createPRNG('zero')
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false)
    }
  })

  it('always true for p=1', () => {
    const rng = createPRNG('one')
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(1)).toBe(true)
    }
  })

  it('rejects p out of [0, 1]', () => {
    const rng = createPRNG('x')
    expect(() => rng.chance(-0.1)).toThrow(RangeError)
    expect(() => rng.chance(1.1)).toThrow(RangeError)
  })
})

describe('shuffleArray', () => {
  it('preserves element multiset', () => {
    const rng = createPRNG('shuffle')
    const arr = [1, 2, 3, 4, 5]
    const original = [...arr]
    rng.shuffleArray(arr)
    expect([...arr].sort()).toEqual(original.sort())
  })

  it('returns the same array reference (in-place)', () => {
    const rng = createPRNG('inplace')
    const arr = [1, 2, 3]
    expect(rng.shuffleArray(arr)).toBe(arr)
  })

  it('actually shuffles (very unlikely to be identity)', () => {
    const rng = createPRNG('actual')
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    rng.shuffleArray(arr)
    // 10! = 3.6M Permutationen, identity-Wahrscheinlichkeit ~3e-7
    expect(arr).not.toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('is deterministic across PRNG instances with same seed', () => {
    const a = createPRNG('shuf')
    const b = createPRNG('shuf')
    const arr1 = [1, 2, 3, 4, 5]
    const arr2 = [1, 2, 3, 4, 5]
    a.shuffleArray(arr1)
    b.shuffleArray(arr2)
    expect(arr1).toEqual(arr2)
  })
})
