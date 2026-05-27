import { describe, it, expect } from 'vitest'
import { createMap, getOwner, setOwner, OWNER_MASK, MAX_OWNER_ID } from '../src/world/map'
import { tileRef } from '../src/world/torus'

describe('createMap', () => {
  it('allocates arrays of correct length', () => {
    const map = createMap(10, 20)
    expect(map.width).toBe(10)
    expect(map.height).toBe(20)
    expect(map.terrain.length).toBe(200)
    expect(map.state.length).toBe(200)
  })

  it('uses TypedArrays for state and terrain', () => {
    const map = createMap(4, 4)
    expect(map.terrain).toBeInstanceOf(Uint8Array)
    expect(map.state).toBeInstanceOf(Uint16Array)
  })

  it('initialises all tiles to neutral (owner 0)', () => {
    const map = createMap(5, 5)
    for (let i = 0; i < map.state.length; i++) {
      expect(map.state[i]).toBe(0)
    }
  })

  it('rejects invalid dimensions', () => {
    expect(() => createMap(0, 10)).toThrow(RangeError)
    expect(() => createMap(10, 0)).toThrow(RangeError)
    expect(() => createMap(-1, 10)).toThrow(RangeError)
    expect(() => createMap(1.5, 10)).toThrow(RangeError)
  })
})

describe('getOwner / setOwner', () => {
  it('default owner is 0 (neutral)', () => {
    const map = createMap(10, 10)
    expect(getOwner(map, tileRef(3, 4, 10, 10))).toBe(0)
  })

  it('round-trips owner IDs', () => {
    const map = createMap(10, 10)
    const ref = tileRef(3, 4, 10, 10)
    setOwner(map, ref, 7)
    expect(getOwner(map, ref)).toBe(7)
  })

  it('supports the maximum owner ID', () => {
    const map = createMap(4, 4)
    const ref = tileRef(0, 0, 4, 4)
    setOwner(map, ref, MAX_OWNER_ID)
    expect(getOwner(map, ref)).toBe(MAX_OWNER_ID)
  })

  it('does not affect neighbouring tiles', () => {
    const map = createMap(10, 10)
    const center = tileRef(5, 5, 10, 10)
    setOwner(map, center, 42)
    expect(getOwner(map, tileRef(4, 5, 10, 10))).toBe(0)
    expect(getOwner(map, tileRef(6, 5, 10, 10))).toBe(0)
    expect(getOwner(map, tileRef(5, 4, 10, 10))).toBe(0)
    expect(getOwner(map, tileRef(5, 6, 10, 10))).toBe(0)
  })

  it('preserves the reserved upper 4 bits when setting owner', () => {
    const map = createMap(4, 4)
    const ref = tileRef(0, 0, 4, 4)
    // Setze direkt einen Wert mit gesetzten oberen Bits (z.B. Bit 14 = defense-bonus)
    map.state[ref] = (1 << 14) | 100
    setOwner(map, ref, 200)
    expect(getOwner(map, ref)).toBe(200)
    expect((map.state[ref] ?? 0) & ~OWNER_MASK).toBe(1 << 14)
  })

  it('rejects owner IDs out of range', () => {
    const map = createMap(4, 4)
    const ref = tileRef(0, 0, 4, 4)
    expect(() => setOwner(map, ref, -1)).toThrow(RangeError)
    expect(() => setOwner(map, ref, MAX_OWNER_ID + 1)).toThrow(RangeError)
    expect(() => setOwner(map, ref, 1.5)).toThrow(RangeError)
  })

  it('overwriting owner replaces previous value cleanly', () => {
    const map = createMap(4, 4)
    const ref = tileRef(0, 0, 4, 4)
    setOwner(map, ref, 100)
    setOwner(map, ref, 50)
    expect(getOwner(map, ref)).toBe(50)
  })
})
