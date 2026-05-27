import { describe, it, expect } from 'vitest'
import { pickRandomNames, NAME_POOL_SIZE } from '../src/ui/player-names'

describe('pickRandomNames', () => {
  it('returns the requested number of names', () => {
    expect(pickRandomNames(0)).toHaveLength(0)
    expect(pickRandomNames(1)).toHaveLength(1)
    expect(pickRandomNames(5)).toHaveLength(5)
  })

  it('all names are unique', () => {
    const names = pickRandomNames(10)
    expect(new Set(names).size).toBe(names.length)
  })

  it('returns strings', () => {
    for (const name of pickRandomNames(3)) {
      expect(typeof name).toBe('string')
      expect(name.length).toBeGreaterThan(0)
    }
  })

  it('rejects negative or non-integer counts', () => {
    expect(() => pickRandomNames(-1)).toThrow(RangeError)
    expect(() => pickRandomNames(1.5)).toThrow(RangeError)
  })

  it('rejects requests larger than the pool', () => {
    expect(() => pickRandomNames(NAME_POOL_SIZE + 1)).toThrow(RangeError)
  })

  it('can return the whole pool when requested', () => {
    const all = pickRandomNames(NAME_POOL_SIZE)
    expect(new Set(all).size).toBe(NAME_POOL_SIZE)
  })
})
