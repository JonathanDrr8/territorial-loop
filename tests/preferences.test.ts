import { describe, it, expect, beforeEach } from 'vitest'
import { loadMenuPrefs, saveMenuPrefs } from '../src/ui/preferences'
import type { StartMenuValues } from '../src/ui/start-menu'

const DEFAULTS: StartMenuValues = {
  playerName: 'Du',
  mapSize: 256,
  aiCount: 3,
  victoryPct: 90,
  difficulty: 'normal',
  tempo: 'normal',
  terrain: 'flat',
  soundEnabled: true,
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
      mapSize: 512,
      aiCount: 5,
      victoryPct: 75,
      difficulty: 'hard',
      tempo: 'siege',
      terrain: 'islands',
      soundEnabled: false,
    }
    saveMenuPrefs(custom)
    expect(loadMenuPrefs(DEFAULTS)).toEqual(custom)
  })

  it('ignores invalid map size, falls back to default', () => {
    window.localStorage.setItem(
      'territorial-loop:menu-prefs:v1',
      JSON.stringify({ ...DEFAULTS, mapSize: 999 }),
    )
    const loaded = loadMenuPrefs(DEFAULTS)
    expect(loaded.mapSize).toBe(DEFAULTS.mapSize)
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
      JSON.stringify({ ...DEFAULTS, aiCount: 99 }),
    )
    expect(loadMenuPrefs(DEFAULTS).aiCount).toBe(DEFAULTS.aiCount)
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
