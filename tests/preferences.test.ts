import { describe, it, expect, beforeEach } from 'vitest'
import { loadMenuPrefs, saveMenuPrefs } from '../src/ui/preferences'
import type { StartMenuValues } from '../src/ui/start-menu'

const DEFAULTS: StartMenuValues = {
  playerName: 'Du',
  mapWidth: 1024,
  mapHeight: 1024,
  aiCount: 3,
  wildCount: 2,
  victoryPct: 90,
  attackPct: 30,
  difficulty: 'standard',
  tempo: 'normal',
  terrain: 'flat',
  soundEnabled: true,
  cameraMode: 'dynamic',
  allowedBuildings: {
    city: true,
    defense: true,
    port: true,
    factory: true,
    airport: true,
    flak: true,
  },
  rivers: true,
  riverDensity: 1,
  experimental: {},
  captureMode: false,
  teamMode: 'off',
  teamCount: 2,
  teamSize: 2,
}

describe('preferences', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns defaults when no prefs are stored', () => {
    expect(loadMenuPrefs(DEFAULTS)).toEqual(DEFAULTS)
  })

  it('round-trips a full save → load', () => {
    const custom: StartMenuValues = {
      playerName: 'Jonathan',
      mapWidth: 512,
      mapHeight: 768,
      aiCount: 5,
      wildCount: 4,
      victoryPct: 75,
      attackPct: 50,
      difficulty: 'advanced',
      tempo: 'siege',
      terrain: 'islands',
      soundEnabled: false,
      cameraMode: 'tiles',
      allowedBuildings: {
        city: true,
        defense: false,
        port: true,
        factory: false,
        airport: true,
        flak: false,
      },
      rivers: false,
      riverDensity: 1,
      experimental: { earthlikeNoise: true },
      captureMode: true,
      teamMode: 'allied',
      teamCount: 3,
      teamSize: 2,
    }
    saveMenuPrefs(custom)
    expect(loadMenuPrefs(DEFAULTS)).toEqual(custom)
  })

  it('round-trips experimental flags und filtert nicht-boolesche Werte', () => {
    window.localStorage.setItem(
      'territorial-loop:menu-prefs:v1',
      JSON.stringify({ ...DEFAULTS, experimental: { foo: true, bar: 'nope', baz: false } }),
    )
    expect(loadMenuPrefs(DEFAULTS).experimental).toEqual({ foo: true, baz: false })
  })

  it('ignores invalid map size, falls back to default', () => {
    window.localStorage.setItem(
      'territorial-loop:menu-prefs:v1',
      JSON.stringify({ ...DEFAULTS, mapWidth: 999, mapHeight: 777 }),
    )
    const loaded = loadMenuPrefs(DEFAULTS)
    expect(loaded.mapWidth).toBe(DEFAULTS.mapWidth)
    expect(loaded.mapHeight).toBe(DEFAULTS.mapHeight)
  })

  it('ignores invalid difficulty enum, falls back to default', () => {
    window.localStorage.setItem(
      'territorial-loop:menu-prefs:v1',
      JSON.stringify({ ...DEFAULTS, difficulty: 'lethal' }),
    )
    expect(loadMenuPrefs(DEFAULTS).difficulty).toBe(DEFAULTS.difficulty)
  })

  it('ignores out-of-range aiCount', () => {
    window.localStorage.setItem(
      'territorial-loop:menu-prefs:v1',
      JSON.stringify({ ...DEFAULTS, aiCount: 999 }),
    )
    expect(loadMenuPrefs(DEFAULTS).aiCount).toBe(DEFAULTS.aiCount)
  })

  it('ignores out-of-range attackPct, falls back to default', () => {
    window.localStorage.setItem(
      'territorial-loop:menu-prefs:v1',
      JSON.stringify({ ...DEFAULTS, attackPct: 250 }),
    )
    expect(loadMenuPrefs(DEFAULTS).attackPct).toBe(DEFAULTS.attackPct)
  })

  it('round-trips a valid attackPct', () => {
    saveMenuPrefs({ ...DEFAULTS, attackPct: 60 })
    expect(loadMenuPrefs(DEFAULTS).attackPct).toBe(60)
  })

  it('returns defaults when stored JSON is malformed', () => {
    window.localStorage.setItem('territorial-loop:menu-prefs:v1', '{not json')
    expect(loadMenuPrefs(DEFAULTS)).toEqual(DEFAULTS)
  })

  it('trims long playerName to 16 chars', () => {
    saveMenuPrefs({ ...DEFAULTS, playerName: 'a'.repeat(40) })
    expect(loadMenuPrefs(DEFAULTS).playerName).toHaveLength(16)
  })

  it('ignores empty playerName, falls back to default', () => {
    window.localStorage.setItem(
      'territorial-loop:menu-prefs:v1',
      JSON.stringify({ ...DEFAULTS, playerName: '   ' }),
    )
    expect(loadMenuPrefs(DEFAULTS).playerName).toBe(DEFAULTS.playerName)
  })
})
