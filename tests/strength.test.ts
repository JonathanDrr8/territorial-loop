/**
 * Tests für die kontinuierliche KI-Stärke (ADR-0022): Monotonie, Fähigkeits-Schwellen,
 * ELO-Abbildung und die benannten Presets.
 */

import { describe, expect, it } from 'vitest'
import {
  PRESET_ELO,
  eloToStrength,
  profileForElo,
  profileForStrength,
  strengthToElo,
} from '../src/ai/strength'

describe('profileForStrength', () => {
  it('wird mit steigendem s schneller (APM) und weniger überdehnt', () => {
    const weak = profileForStrength(0.1)
    const strong = profileForStrength(0.95)
    expect(strong.cooldownMin).toBeLessThan(weak.cooldownMin)
    expect(strong.cooldownMax).toBeLessThan(weak.cooldownMax)
    expect(strong.attackPct).toBeLessThan(weak.attackPct) // stark = kleine Dauer-Angriffe
  })

  it('schaltet Fähigkeiten an Schwellen frei', () => {
    expect(profileForStrength(0.1).usesAirDefense).toBe(false)
    expect(profileForStrength(0.1).buildChance).toBe(0)
    expect(profileForStrength(0.5).usesAirDefense).toBe(true)
    expect(profileForStrength(0.5).usesBombers).toBe(false)
    expect(profileForStrength(0.7).usesBombers).toBe(true)
  })

  it('erzwingt cooldownMax > cooldownMin auf der ganzen Skala', () => {
    for (let s = 0; s <= 1.0001; s += 0.1) {
      const p = profileForStrength(s)
      expect(p.cooldownMax).toBeGreaterThan(p.cooldownMin)
    }
  })
})

describe('ELO-Abbildung', () => {
  it('ist monoton: höheres ELO → höhere Stärke', () => {
    expect(eloToStrength(700)).toBeLessThan(eloToStrength(1000))
    expect(eloToStrength(1000)).toBeLessThan(eloToStrength(1200))
  })

  it('strengthToElo und eloToStrength sind grob invers', () => {
    for (const s of [0.2, 0.5, 0.8]) {
      const back = eloToStrength(strengthToElo(s))
      expect(Math.abs(back - s)).toBeLessThan(0.12)
    }
  })
})

describe('benannte Presets', () => {
  it('Standard ist auf 1000 verankert, aufsteigend geordnet', () => {
    expect(PRESET_ELO.standard).toBe(1000)
    expect(PRESET_ELO.beginner).toBeLessThan(PRESET_ELO.easy)
    expect(PRESET_ELO.easy).toBeLessThan(PRESET_ELO.standard)
    expect(PRESET_ELO.standard).toBeLessThan(PRESET_ELO.advanced)
    expect(PRESET_ELO.advanced).toBeLessThan(PRESET_ELO.expert)
  })

  it('die Fähigkeiten landen passend: Standard=Flak/Krater, Fortgeschritten=Bomber', () => {
    const easy = profileForElo(PRESET_ELO.easy)
    const standard = profileForElo(PRESET_ELO.standard)
    const advanced = profileForElo(PRESET_ELO.advanced)
    expect(easy.usesAirDefense).toBe(false)
    expect(standard.usesAirDefense).toBe(true)
    expect(standard.healsCraters).toBe(true)
    expect(standard.usesBombers).toBe(false)
    expect(advanced.usesBombers).toBe(true)
  })

  it('Anfänger baut keine Wirtschaft', () => {
    const beginner = profileForElo(PRESET_ELO.beginner)
    expect(beginner.buildChance).toBe(0)
    expect(beginner.tilesPerCity).toBe(0)
  })
})
