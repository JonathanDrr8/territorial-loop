import { describe, it, expect } from 'vitest'
import {
  maxTroops,
  troopIncreaseRate,
  HUMAN_START_TROOPS,
  BOT_START_TROOPS,
} from '../src/core/config'

describe('maxTroops', () => {
  it('returns base cap for 0 tiles', () => {
    // 2 * (0 + 50000) = 100000
    expect(maxTroops(0)).toBe(100_000)
  })

  it('grows sublinear with tile count (^0.6 exponent)', () => {
    const at1k = maxTroops(1_000)
    const at10k = maxTroops(10_000)
    const at100k = maxTroops(100_000)
    // ratio between successive 10x jumps should be < 10 due to sublinear exponent
    expect(at10k / at1k).toBeLessThan(10)
    expect(at100k / at10k).toBeLessThan(10)
    expect(at10k).toBeGreaterThan(at1k)
    expect(at100k).toBeGreaterThan(at10k)
  })

  it('applies bot divisor (cap / 3) when bot=true', () => {
    const human = maxTroops(10_000)
    const bot = maxTroops(10_000, { bot: true })
    expect(bot).toBeLessThan(human)
    // Floor differences allowed; ratio approx 1/3
    expect(bot / human).toBeCloseTo(1 / 3, 2)
  })

  it('rejects negative tile count', () => {
    expect(() => maxTroops(-1)).toThrow(RangeError)
  })

  it('returns integer values', () => {
    expect(Number.isInteger(maxTroops(123))).toBe(true)
    expect(Number.isInteger(maxTroops(123, { bot: true }))).toBe(true)
  })
})

describe('troopIncreaseRate', () => {
  it('produces positive growth at zero troops (seed growth)', () => {
    // toAdd = 10 + 0^0.73 / 4 = 10; ratio = 1; rate = 10
    expect(troopIncreaseRate(0, 100_000)).toBe(10)
  })

  it('is zero at cap (no overflow growth)', () => {
    expect(troopIncreaseRate(100_000, 100_000)).toBe(0)
  })

  it('is zero above cap (no negative growth)', () => {
    expect(troopIncreaseRate(150_000, 100_000)).toBe(0)
  })

  it('is zero when cap is zero (no division by zero)', () => {
    expect(troopIncreaseRate(0, 0)).toBe(0)
    expect(troopIncreaseRate(1000, 0)).toBe(0)
  })

  it('rejects negative inputs', () => {
    expect(() => troopIncreaseRate(-1, 100)).toThrow(RangeError)
    expect(() => troopIncreaseRate(100, -1)).toThrow(RangeError)
  })

  it('peaks somewhere around 40-45% of cap', () => {
    // Sample the curve to find approximate peak — should match OpenFront's ~42%
    const max = 1_000_000
    let bestPct = 0
    let bestRate = 0
    for (let pct = 5; pct < 100; pct += 5) {
      const rate = troopIncreaseRate(max * (pct / 100), max)
      if (rate > bestRate) {
        bestRate = rate
        bestPct = pct
      }
    }
    expect(bestPct).toBeGreaterThanOrEqual(35)
    expect(bestPct).toBeLessThanOrEqual(50)
  })

  it('bot rate is half of human rate at same troops/cap', () => {
    const t = 10_000
    const max = 100_000
    const human = troopIncreaseRate(t, max)
    const bot = troopIncreaseRate(t, max, { bot: true })
    // toAdd halved → resulting floored value approximately halved
    expect(bot * 2).toBeGreaterThanOrEqual(human - 1)
    expect(bot * 2).toBeLessThanOrEqual(human + 1)
  })

  it('returns integer values', () => {
    expect(Number.isInteger(troopIncreaseRate(5000, 100_000))).toBe(true)
  })

  it('rate strictly decreases past the optimum', () => {
    const max = 1_000_000
    const at60 = troopIncreaseRate(max * 0.6, max)
    const at80 = troopIncreaseRate(max * 0.8, max)
    const at95 = troopIncreaseRate(max * 0.95, max)
    expect(at80).toBeLessThan(at60)
    expect(at95).toBeLessThan(at80)
  })
})

describe('constants', () => {
  it('start troops are integers and human > bot', () => {
    expect(Number.isInteger(HUMAN_START_TROOPS)).toBe(true)
    expect(Number.isInteger(BOT_START_TROOPS)).toBe(true)
    expect(HUMAN_START_TROOPS).toBeGreaterThan(BOT_START_TROOPS)
  })
})
