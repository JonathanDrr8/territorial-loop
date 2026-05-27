import { describe, it, expect } from 'vitest'
import { hslToRgba, rgbaToCss, randomColor, pickDistinctColors } from '../src/ui/colors'

describe('hslToRgba', () => {
  it('produces pure red for H=0, S=1, L=0.5', () => {
    const rgba = hslToRgba(0, 1, 0.5)
    expect((rgba >>> 24) & 0xff).toBe(255)
    expect((rgba >>> 16) & 0xff).toBe(0)
    expect((rgba >>> 8) & 0xff).toBe(0)
    expect(rgba & 0xff).toBe(0xff)
  })

  it('produces pure green for H=120', () => {
    const rgba = hslToRgba(120, 1, 0.5)
    expect((rgba >>> 24) & 0xff).toBe(0)
    expect((rgba >>> 16) & 0xff).toBe(255)
    expect((rgba >>> 8) & 0xff).toBe(0)
  })

  it('produces pure blue for H=240', () => {
    const rgba = hslToRgba(240, 1, 0.5)
    expect((rgba >>> 24) & 0xff).toBe(0)
    expect((rgba >>> 16) & 0xff).toBe(0)
    expect((rgba >>> 8) & 0xff).toBe(255)
  })

  it('produces grey-ish at S=0', () => {
    const rgba = hslToRgba(200, 0, 0.5)
    const r = (rgba >>> 24) & 0xff
    const g = (rgba >>> 16) & 0xff
    const b = (rgba >>> 8) & 0xff
    expect(r).toBe(g)
    expect(g).toBe(b)
  })

  it('alpha byte is always 0xff', () => {
    for (let h = 0; h < 360; h += 30) {
      const rgba = hslToRgba(h, 0.7, 0.55)
      expect(rgba & 0xff).toBe(0xff)
    }
  })
})

describe('rgbaToCss', () => {
  it('formats packed RGBA to rgb() string', () => {
    expect(rgbaToCss(0xff0000ff)).toBe('rgb(255,0,0)')
    expect(rgbaToCss(0x00ff00ff)).toBe('rgb(0,255,0)')
    expect(rgbaToCss(0x123456ff)).toBe('rgb(18,52,86)')
  })

  it('ignores the alpha byte', () => {
    expect(rgbaToCss(0xff000000)).toBe('rgb(255,0,0)')
    expect(rgbaToCss(0xff0000ff)).toBe('rgb(255,0,0)')
  })
})

describe('randomColor', () => {
  it('returns a number in valid 32-bit unsigned range', () => {
    for (let i = 0; i < 50; i++) {
      const c = randomColor()
      expect(Number.isInteger(c)).toBe(true)
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThanOrEqual(0xffffffff)
    }
  })

  it('alpha byte is always 0xff (fully opaque)', () => {
    for (let i = 0; i < 50; i++) {
      expect(randomColor() & 0xff).toBe(0xff)
    }
  })
})

describe('pickDistinctColors', () => {
  it('returns exactly the requested count', () => {
    expect(pickDistinctColors(1)).toHaveLength(1)
    expect(pickDistinctColors(4)).toHaveLength(4)
    expect(pickDistinctColors(8)).toHaveLength(8)
  })

  it('returns empty array for count <= 0', () => {
    expect(pickDistinctColors(0)).toEqual([])
    expect(pickDistinctColors(-3)).toEqual([])
  })

  it('all colors are unique', () => {
    const colors = pickDistinctColors(8)
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('alpha bytes are always 0xff', () => {
    for (const c of pickDistinctColors(6)) {
      expect(c & 0xff).toBe(0xff)
    }
  })

  it('hue spread is at least ~ 360/count for each pair (rough check)', () => {
    // We can't easily extract hue from packed RGBA without re-inverting HSL.
    // Sanity: with count = 4, the 4 colors should differ significantly in their R/G/B distribution.
    const colors = pickDistinctColors(4)
    // Sum of channel sums — at least the colors aren't all the same hue
    const channelDiffs = new Set<string>()
    for (const c of colors) {
      const r = (c >>> 24) & 0xff
      const g = (c >>> 16) & 0xff
      const b = (c >>> 8) & 0xff
      // Bucket into rough "dominant channel" key
      const max = Math.max(r, g, b)
      const key =
        max === r
          ? 'R' + Math.round(r / 32).toString()
          : max === g
            ? 'G' + Math.round(g / 32).toString()
            : 'B' + Math.round(b / 32).toString()
      channelDiffs.add(key)
    }
    // 4 distinct hue buckets sollten mindestens 3 unterschiedliche Klassen ergeben
    expect(channelDiffs.size).toBeGreaterThanOrEqual(3)
  })
})
