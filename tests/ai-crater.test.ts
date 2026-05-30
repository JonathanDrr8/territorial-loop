/**
 * Stufe-3-Test (ADR-0020): Die KI heilt einen voll umschlossenen Bombenkrater (neutrales Tile
 * mit 4 eigenen Nachbarn) im eigenen Reich — und nur Profile mit `healsCraters` tun das gezielt.
 */

import { describe, expect, it } from 'vitest'
import { createGame, type GameConfig } from '../src/core/game'
import { createAI, type Difficulty } from '../src/ai/ai'
import { setOwner } from '../src/world/map'
import { tileRef } from '../src/world/torus'

const W = 64
const H = 64
const T = (x: number, y: number): number => tileRef(x, y, W, H)
const CRATER = T(10, 10)

function config(): GameConfig {
  return {
    mapWidth: W,
    mapHeight: H,
    seed: 'crater-test',
    victoryPct: 90,
    terrain: 'flat',
    players: [
      { id: 1, name: 'Enemy', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'AI', color: 0x00ff00ff, isHuman: false },
    ],
  }
}

/** KI (Spieler 2) besitzt einen 5×5-Block, in dessen Mitte ein neutrales Loch klafft. */
function setupCrater(diff: Difficulty): { healsCrater: () => boolean } {
  const state = createGame(config())
  for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
  for (const p of state.players.values()) {
    p.tilesOwned = 0
    p.frontier = new Set<number>()
    p.attacks = []
    p.troops = 8_000
    p.gold = 0
    p.weightedTiles = 0
  }
  const ai = state.players.get(2)
  if (ai === undefined) throw new Error('player missing')
  for (let y = 8; y <= 12; y++)
    for (let x = 8; x <= 12; x++) {
      setOwner(state.map, T(x, y), 2)
      ai.tilesOwned++
      ai.weightedTiles++
      ai.frontier.add(T(x, y))
    }
  // Loch in der Mitte: neutral, voll umschlossen.
  setOwner(state.map, CRATER, 0)
  ai.tilesOwned--
  ai.frontier.delete(CRATER)

  const agent = createAI(2, state.seed, diff)
  return {
    healsCrater(): boolean {
      for (let i = 0; i < 60; i++) {
        state.tick += 60
        for (const intent of agent.decide(state)) {
          if (intent.type === 'attack' && intent.targetTile === CRATER) return true
        }
      }
      return false
    },
  }
}

describe('KI-Krater-Heilung (ADR-0020 Stufe 3)', () => {
  it('normal erobert das umschlossene Innen-Loch zurück', () => {
    expect(setupCrater('normal').healsCrater()).toBe(true)
  })

  it('hard erobert das umschlossene Innen-Loch zurück', () => {
    expect(setupCrater('hard').healsCrater()).toBe(true)
  })
})
