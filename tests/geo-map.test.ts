import { describe, it, expect } from 'vitest'

import { encodeGeoMap, decodeGeoMap, registerGeoMap, hasGeoMap } from '../src/world/geo-map'
import { createGame, type GameConfig } from '../src/core/game'
import { IS_LAND_BIT } from '../src/world/terrain'

/** Baut ein kleines synthetisches terrain: linke Hälfte Wasser, rechte Land (mit etwas Höhe). */
function syntheticTerrain(w: number, h: number): Uint8Array {
  const t = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (x < w / 2)
        t[i] = 0 // Wasser
      else t[i] = IS_LAND_BIT | (x % 5 === 0 ? 15 : 5) // Land, mal Hügel mal Ebene
    }
  }
  return t
}

function cfg(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mapWidth: 24,
    mapHeight: 24,
    seed: 'geo',
    victoryPct: 90,
    terrain: 'continents',
    players: [
      { id: 1, name: 'A', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'B', color: 0x00ff00ff, isHuman: false },
    ],
    ...overrides,
  }
}

describe('geo-map (ADR-0016)', () => {
  it('encode/decode-Roundtrip erhält Größe + terrain', () => {
    const t = syntheticTerrain(24, 24)
    const decoded = decodeGeoMap(encodeGeoMap(24, 24, t))
    expect(decoded.width).toBe(24)
    expect(decoded.height).toBe(24)
    expect([...decoded.terrain]).toEqual([...t])
  })

  it('encode wirft bei falscher terrain-Länge', () => {
    expect(() => encodeGeoMap(10, 10, new Uint8Array(99))).toThrow()
  })

  it('createGame nutzt das registrierte Geo-Terrain statt zu generieren', () => {
    const t = syntheticTerrain(24, 24)
    registerGeoMap('test-map', decodeGeoMap(encodeGeoMap(24, 24, t)))
    expect(hasGeoMap('test-map')).toBe(true)
    const state = createGame(cfg({ mapId: 'test-map' }))
    expect([...state.map.terrain]).toEqual([...t])
    // abgeleitete Felder kommen aus dem Geo-Terrain (linke Hälfte Wasser).
    expect(state.passableLandCount).toBeGreaterThan(0)
    expect(state.passableLandCount).toBeLessThan(24 * 24) // nicht alles begehbar (Wasser links)
  })

  it('deterministisch: zweimal createGame mit derselben Geo-Karte → identisches Terrain', () => {
    registerGeoMap('det-map', decodeGeoMap(encodeGeoMap(24, 24, syntheticTerrain(24, 24))))
    const a = createGame(cfg({ mapId: 'det-map' }))
    const b = createGame(cfg({ mapId: 'det-map' }))
    expect([...a.map.terrain]).toEqual([...b.map.terrain])
  })

  it('createGame wirft, wenn die Geo-Karte nicht registriert ist', () => {
    expect(() => createGame(cfg({ mapId: 'fehlt-im-registry' }))).toThrow(/nicht geladen/)
  })

  it('createGame wirft bei Dimensions-Mismatch', () => {
    registerGeoMap('mini', decodeGeoMap(encodeGeoMap(8, 8, syntheticTerrain(8, 8))))
    expect(() => createGame(cfg({ mapId: 'mini', mapWidth: 24, mapHeight: 24 }))).toThrow(/≠/)
  })
})
