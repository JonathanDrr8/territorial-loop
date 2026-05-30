/**
 * Stufe-1-Test (ADR-0020): Die KI reagiert auf eingehende Bomber mit dem Bau von Flak —
 * und nur Profile mit Luftabwehr tun das.
 */

import { describe, expect, it } from 'vitest'
import { createGame, type GameConfig } from '../src/core/game'
import { createAI, type Difficulty } from '../src/ai/ai'
import { setOwner } from '../src/world/map'
import { tileRef } from '../src/world/torus'
import type { Bomber } from '../src/core/ships'

const W = 64
const H = 64
const T = (x: number, y: number): number => tileRef(x, y, W, H)

function config(): GameConfig {
  return {
    mapWidth: W,
    mapHeight: H,
    seed: 'flak-test',
    victoryPct: 90,
    terrain: 'flat',
    players: [
      { id: 1, name: 'Enemy', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'AI', color: 0x00ff00ff, isHuman: false },
    ],
  }
}

/** Baut einen Zustand: KI (Spieler 2) besitzt einen 5×5-Block, ein Feind-Bomber zielt darauf. */
function setupThreat(diff: Difficulty): { decideFlak: () => boolean } {
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
  for (let y = 8; y <= 12; y++) {
    for (let x = 8; x <= 12; x++) {
      setOwner(state.map, T(x, y), 2)
      ai.tilesOwned++
      ai.weightedTiles++
      ai.frontier.add(T(x, y))
    }
  }
  setOwner(state.map, T(40, 40), 1)
  enemy.tilesOwned = 1
  enemy.frontier.add(T(40, 40))

  const target = T(10, 10)
  const bomber: Bomber = {
    ownerId: 1,
    path: [T(40, 40), target],
    progress: 0,
    dir: 1,
    hp: 4,
    dropped: false,
    targetTile: target,
    homeAirport: T(40, 40),
  }
  state.bombers.push(bomber)

  const agent = createAI(2, state.seed, diff)
  return {
    decideFlak(): boolean {
      // Über viele „Entscheidungsfenster" laufen lassen (Tick bumpen → Cooldown-Gate passieren).
      for (let i = 0; i < 80; i++) {
        state.tick += 60
        for (const intent of agent.decide(state)) {
          if (intent.type === 'build' && intent.buildingType === 'flak') return true
        }
      }
      return false
    },
  }
}

describe('KI-Luftabwehr (ADR-0020 Stufe 1)', () => {
  it('normal baut Flak gegen einen eingehenden Bomber', () => {
    expect(setupThreat('normal').decideFlak()).toBe(true)
  })

  it('hard baut Flak gegen einen eingehenden Bomber', () => {
    expect(setupThreat('hard').decideFlak()).toBe(true)
  })

  it('easy ignoriert die Luftbedrohung (keine Flak)', () => {
    expect(setupThreat('easy').decideFlak()).toBe(false)
  })
})
