import { describe, it, expect } from 'vitest'
import { createGame, type GameConfig, type PlayerDef } from '../src/core/game'

/**
 * Regressions-Wache gegen die O(Nationen × Karten-Tiles)-Falle bei der Spawn-Platzierung
 * (`fillEnclosed` scannte früher die GANZE Karte je Nation → 1536² mit 276 Nationen brauchte
 * ~30 s; jetzt lokaler BFS am Spawn-Blob → ~3 s). Großzügige Schranke (12 s), damit der Test
 * auf langsamen CI-Maschinen nicht flackert, aber den 30-s-Abgrund zuverlässig fängt.
 */
describe('Spawn-Platzierung skaliert (kein O(Nationen × Tiles))', () => {
  it('1536² mit 276 Nationen baut zügig auf', () => {
    const players: PlayerDef[] = [{ id: 1, name: 'Du', color: 0xff0000ff, isHuman: true }]
    let id = 2
    for (let i = 0; i < 75; i++)
      players.push({ id: id++, name: `KI${i}`, color: 0x00ff00ff, isHuman: false })
    for (let i = 0; i < 200; i++)
      players.push({ id: id++, name: `W${i}`, color: 0x888888ff, isHuman: false, wild: true })
    const config: GameConfig = {
      mapWidth: 1536,
      mapHeight: 1536,
      seed: 'spawn-perf',
      victoryPct: 90,
      terrain: 'continents',
      players,
    }
    const start = performance.now()
    const state = createGame(config)
    const ms = performance.now() - start
    expect(state.players.size).toBe(276)
    expect(ms).toBeLessThan(12_000)
  }, 30_000)
})
