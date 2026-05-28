import { describe, it, expect } from 'vitest'
import {
  maxTroops,
  troopIncreaseRate,
  tilesPerTick,
  attackerLossPerTile,
  defenderLossPerTile,
  growthZones,
  HUMAN_START_TROOPS,
  BOT_START_TROOPS,
  PLAINS_MAG,
} from '../src/core/config'

describe('maxTroops', () => {
  it('returns base cap for 0 tiles', () => {
    expect(maxTroops(0)).toBe(4_000)
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

  it('applies bot cap factor when bot=true', () => {
    const human = maxTroops(10_000)
    const bot = maxTroops(10_000, { bot: true })
    expect(bot).toBeLessThan(human)
    // Bots etwas schwächer (~0.8× Cap)
    expect(bot / human).toBeCloseTo(0.8, 1)
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

  it('schmilzt über dem Cap langsam ab (negatives Wachstum)', () => {
    // 50_000 über Cap → -ceil(50_000 * 0.03) = -1500
    expect(troopIncreaseRate(150_000, 100_000)).toBe(-1500)
    expect(troopIncreaseRate(150_000, 100_000)).toBeLessThan(0)
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

  it('Wachstum geht von der übergebenen (freien) Bevölkerung + ihrem Cap-Platz aus', () => {
    // Kleine freie Bevölkerung gegen kleinen freien Cap-Platz → moderate Rate,
    // unabhängig von gebundenen Truppen (die der Aufrufer über die Argumente abzieht).
    const rate = troopIncreaseRate(2000, 5000)
    expect(rate).toBeGreaterThan(0)
    expect(troopIncreaseRate(5000, 5000)).toBe(0) // am (freien) Cap kein Wachstum
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

describe('growthZones', () => {
  it('optimum liegt nahe dem Peak der Wachstumskurve (~35-50%)', () => {
    const { optimum } = growthZones(85_500)
    expect(optimum).toBeGreaterThanOrEqual(0.3)
    expect(optimum).toBeLessThanOrEqual(0.55)
  })

  it('stall liegt rechts vom Optimum und vor dem Cap', () => {
    const { optimum, stall } = growthZones(85_500)
    expect(stall).toBeGreaterThan(optimum)
    expect(stall).toBeLessThanOrEqual(1)
  })

  it('die Rate am Stagnations-Strich ist höchstens ein Drittel der Peak-Rate', () => {
    const cap = 85_500
    const { optimum, stall } = growthZones(cap)
    const peakRate = troopIncreaseRate(Math.floor(optimum * cap), cap)
    const stallRate = troopIncreaseRate(Math.floor(stall * cap), cap)
    expect(stallRate).toBeLessThanOrEqual(peakRate / 3 + 1)
  })

  it('degeneriert sauber bei cap 0', () => {
    expect(growthZones(0)).toEqual({ optimum: 0, stall: 1 })
  })
})

describe('tilesPerTick', () => {
  it('returns 0 when frontWidth is 0', () => {
    expect(tilesPerTick(1000, 500, 0, false)).toBe(0)
    expect(tilesPerTick(1000, 500, 0, true)).toBe(0)
  })

  it('against TerraNullius: 1.5 * frontWidth (no troop comparison)', () => {
    expect(tilesPerTick(1000, 0, 5, true)).toBe(7.5)
    expect(tilesPerTick(50_000, 0, 10, true)).toBe(15)
  })

  it('against player: speed scales with attack:defense ratio, capped at 2:1', () => {
    // 2:1 → factor 1 (max): 1 * 4 * 1.5 = 6
    expect(tilesPerTick(2000, 1000, 4, false)).toBeCloseTo(1 * 4 * 1.5)
    // ≥2:1 (10:1) → ebenfalls gedeckelt bei factor 1
    expect(tilesPerTick(10_000, 1000, 4, false)).toBeCloseTo(1 * 4 * 1.5)
    // 1:1 → factor 0.5 → 0.5 * 2 * 1.5 = 1.5
    expect(tilesPerTick(1000, 1000, 2, false)).toBeCloseTo(0.5 * 2 * 1.5)
    // stark unterlegen → unterer Faktor 0.02
    expect(tilesPerTick(1, 1000, 10, false)).toBeCloseTo(0.02 * 10 * 1.5)
  })

  it('against zero-troop defender: counts as full 2:1 overmatch', () => {
    expect(tilesPerTick(1000, 0, 5, false)).toBeCloseTo(1 * 5 * 1.5)
  })
})

describe('attackerLossPerTile', () => {
  it('against TerraNullius: mag / 5 (16 for Plains)', () => {
    expect(attackerLossPerTile(0, 1, true)).toBe(PLAINS_MAG / 5)
    expect(attackerLossPerTile(0, 1, true)).toBe(16)
  })

  it('against player: 2 × Verteidigungsdichte (auf Ebene)', () => {
    // density = 1000/100 = 10 → 2 × 10 × (80/80) = 20
    expect(attackerLossPerTile(1000, 100, false)).toBeCloseTo(20)
    // dichter verteidigt → teurer: 5000/100 = 50 → 2 × 50 = 100
    expect(attackerLossPerTile(5000, 100, false)).toBeCloseTo(100)
  })

  it('skaliert mit dem Terrain (mag/PLAINS_MAG)', () => {
    // Berg mag=120 → 2 × 10 × (120/80) = 30
    expect(attackerLossPerTile(1000, 100, false, 120)).toBeCloseTo(30)
  })

  it('Σ Kosten ≈ 2 × Verteidiger-Truppen → 2:1 reicht für komplette Einnahme', () => {
    // Bei konstanter Dichte (Verteidiger verliert pro Tile seine Pro-Tile-Truppen)
    // ist die Eroberung eines Tiles 2 × density teuer; über alle Tiles summiert sich
    // das zu 2 × Gesamttruppen. Hier: 1000 Truppen auf 100 Tiles, density 10.
    const perTile = attackerLossPerTile(1000, 100, false) // 20
    expect(perTile * 100).toBeCloseTo(2 * 1000)
  })
})

describe('defenderLossPerTile', () => {
  it('Pro-Tile-Truppen des Verteidigers (dichteerhaltend)', () => {
    expect(defenderLossPerTile(1000, 100, false)).toBe(10)
    expect(defenderLossPerTile(50_000, 500, false)).toBe(100)
  })
  it('0 gegen TerraNullius und bei 0 Tiles', () => {
    expect(defenderLossPerTile(1000, 100, true)).toBe(0)
    expect(defenderLossPerTile(1000, 0, false)).toBe(0)
  })
})
