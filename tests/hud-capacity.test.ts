/**
 * Kapazitäts-Helfer fürs HUD (UI-Redesign Schritt 2): `bomberHangarInfo` (Hangar-Auslastung
 * geparkt+fliegend / Plätze) und `warshipCapacity` (Summe der Hafen-Level). Diese speisen die
 * „X/Y"-Zähler und die Kosten-Einfärbung (Kriegsschiff-Kosten rot, wenn kein Slot frei).
 */

import { describe, expect, it } from 'vitest'
import { bomberHangarInfo, createGame, warshipCapacity, type GameConfig } from '../src/core/game'
import type { Building } from '../src/core/buildings'
import { tileRef } from '../src/world/torus'

const W = 64
const H = 64
const T = (x: number, y: number): number => tileRef(x, y, W, H)

function config(): GameConfig {
  return {
    mapWidth: W,
    mapHeight: H,
    seed: 'cap-test',
    victoryPct: 90,
    terrain: 'flat',
    players: [{ id: 1, name: 'A', color: 0xff0000ff, isHuman: true }],
  }
}

function building(type: Building['type'], tile: number, level: number, complete = true): Building {
  return { type, ownerId: 1, tile, level, completesAtTick: complete ? 0 : 9_999_999 }
}

describe('warshipCapacity (HUD Schritt 2)', () => {
  it('summiert die Level aller FERTIGEN eigenen Häfen', () => {
    const state = createGame(config())
    state.buildings.set(T(5, 5), building('port', T(5, 5), 3))
    state.buildings.set(T(6, 5), building('port', T(6, 5), 1))
    expect(warshipCapacity(state, 1)).toBe(4)
  })

  it('zählt unfertige Häfen + Nicht-Häfen nicht mit', () => {
    const state = createGame(config())
    state.buildings.set(T(5, 5), building('port', T(5, 5), 2))
    state.buildings.set(T(7, 5), building('port', T(7, 5), 2, false)) // im Bau
    state.buildings.set(T(8, 5), building('city', T(8, 5), 3)) // kein Hafen
    expect(warshipCapacity(state, 1)).toBe(2)
  })
})

describe('bomberHangarInfo (HUD Schritt 2)', () => {
  it('used = geparkt + fliegend (gedeckelt auf Plätze), capacity = Summe airportSlots', () => {
    const state = createGame(config())
    const air = T(10, 10)
    state.buildings.set(air, { ...building('airport', air, 2), aircraft: 1 }) // Level 2 → 2 Plätze
    expect(bomberHangarInfo(state, 1)).toEqual({ used: 1, capacity: 2 })

    // Ein fliegender Bomber von diesem Flughafen → used steigt auf 2 (voll).
    state.bombers.push({
      ownerId: 1,
      homeAirport: air,
      path: [air],
      progress: 0,
      dir: 1,
      hp: 5,
      dropped: false,
      targetTile: air,
    })
    expect(bomberHangarInfo(state, 1)).toEqual({ used: 2, capacity: 2 })
  })

  it('ignoriert unfertige Flughäfen', () => {
    const state = createGame(config())
    const air = T(10, 10)
    state.buildings.set(air, { ...building('airport', air, 3, false), aircraft: 2 })
    expect(bomberHangarInfo(state, 1)).toEqual({ used: 0, capacity: 0 })
  })
})
