/**
 * Stufe-2-Test (ADR-0020): Die KI nutzt offensive Bomber — wirft auf Feind-Infrastruktur,
 * verschont sich aber vor sicherem Abschuss (Flak-Route) und nur Profile mit Bombern tun es.
 */

import { describe, expect, it } from 'vitest'
import { createGame, type GameConfig } from '../src/core/game'
import { createAI, type Difficulty } from '../src/ai/ai'
import { setOwner } from '../src/world/map'
import { tileRef, neighbors4 } from '../src/world/torus'
import type { Building } from '../src/core/buildings'

const W = 64
const H = 64
const T = (x: number, y: number): number => tileRef(x, y, W, H)

function config(): GameConfig {
  return {
    mapWidth: W,
    mapHeight: H,
    seed: 'bomber-test',
    victoryPct: 90,
    terrain: 'flat',
    players: [
      { id: 1, name: 'Enemy', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'AI', color: 0x00ff00ff, isHuman: false },
    ],
  }
}

const AIRPORT = T(10, 10)
const FACTORY = T(40, 40)

/**
 * KI (Spieler 2) hat einen fertigen Flughafen mit geparktem Flugzeug; der Feind (Spieler 1)
 * hat eine Fabrik. Optional Flak-Ring um die Fabrik (sicherer Abschuss).
 */
function setupOffense(diff: Difficulty, enemyFlak: boolean): { decideBomb: () => boolean } {
  const state = createGame(config())
  for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
  for (const p of state.players.values()) {
    p.tilesOwned = 0
    p.frontier = new Set<number>()
    p.attacks = []
    p.troops = 5_000
    p.gold = 1_000_000
    p.weightedTiles = 0
  }
  const ai = state.players.get(2)
  const enemy = state.players.get(1)
  if (ai === undefined || enemy === undefined) throw new Error('players missing')
  for (let y = 8; y <= 12; y++)
    for (let x = 8; x <= 12; x++) {
      setOwner(state.map, T(x, y), 2)
      ai.tilesOwned++
      ai.weightedTiles++
      ai.frontier.add(T(x, y))
    }
  for (let y = 38; y <= 42; y++)
    for (let x = 38; x <= 42; x++) {
      setOwner(state.map, T(x, y), 1)
      enemy.tilesOwned++
      enemy.weightedTiles++
      enemy.frontier.add(T(x, y))
    }

  const b = (type: Building['type'], tile: number, ownerId: number): Building => ({
    type,
    ownerId,
    tile,
    level: 1,
    completesAtTick: 0,
  })
  state.buildings.set(AIRPORT, { ...b('airport', AIRPORT, 2), aircraft: 1 })
  state.buildings.set(FACTORY, b('factory', FACTORY, 1))
  if (enemyFlak) {
    // Dichter Flak-Ring um die Fabrik → jede Route wird sicher abgeschossen.
    for (const n of neighbors4(FACTORY, W, H)) state.buildings.set(n, b('flak', n, 1))
  }

  const agent = createAI(2, state.seed, diff)
  return {
    decideBomb(): boolean {
      for (let i = 0; i < 120; i++) {
        state.tick += 40
        for (const intent of agent.decide(state)) {
          if (intent.type === 'launch-bomber') return true
        }
      }
      return false
    },
  }
}

describe('KI-Bomber-Offensive (ADR-0020 Stufe 2)', () => {
  it('hard wirft eine Bombe auf eine ungeschützte Feind-Fabrik', () => {
    expect(setupOffense('hard', false).decideBomb()).toBe(true)
  })

  it('hard verschont ein Ziel hinter dichter Flak (sicherer Abschuss)', () => {
    expect(setupOffense('hard', true).decideBomb()).toBe(false)
  })

  it('normal nutzt keine offensiven Bomber', () => {
    expect(setupOffense('normal', false).decideBomb()).toBe(false)
  })
})
