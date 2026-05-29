import { describe, it, expect } from 'vitest'
import { createAI } from '../src/ai/ai'
import { createGame, tick, type GameConfig } from '../src/core/game'
import { getOwner } from '../src/world/map'
import { neighbors4 } from '../src/world/torus'

function aiConfig(seed = 'ai-test-seed'): GameConfig {
  return {
    mapWidth: 64,
    mapHeight: 64,
    seed,
    victoryPct: 90,
    players: [
      { id: 1, name: 'Human', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'AI-1', color: 0x00ff00ff, isHuman: false },
    ],
  }
}

describe('createAI', () => {
  it('emits no intent before its first decision tick', () => {
    const state = createGame(aiConfig())
    const ai = createAI(2, state.seed)
    // At tick 0, the AI hasn't yet decided. The randomized first-decision tick is in [30, 100].
    // So at least one of the first 30 ticks should produce zero intents.
    let emittedEarly = false
    for (let t = 0; t < 25; t++) {
      const intents = ai.decide(state)
      if (intents.length > 0) emittedEarly = true
      tick(state, intents)
    }
    expect(emittedEarly).toBe(false)
  })

  it('eventually emits an attack intent', () => {
    const state = createGame(aiConfig())
    const ai = createAI(2, state.seed)
    let attackSeen = false
    for (let t = 0; t < 200; t++) {
      const intents = ai.decide(state)
      if (intents.some((i) => i.type === 'attack' && i.playerId === 2)) {
        attackSeen = true
      }
      tick(state, intents)
    }
    expect(attackSeen).toBe(true)
  })

  it('does not emit intents for a dead player', () => {
    const state = createGame(aiConfig())
    const ai = createAI(2, state.seed)
    const aiPlayer = state.players.get(2)
    if (aiPlayer === undefined) throw new Error('ai missing')
    aiPlayer.isAlive = false
    for (let t = 0; t < 200; t++) {
      const intents = ai.decide(state)
      expect(intents).toEqual([])
      tick(state, intents)
    }
  })

  it('is deterministic — two AIs with same seed produce identical intent stream', () => {
    const stateA = createGame(aiConfig('determ'))
    const stateB = createGame(aiConfig('determ'))
    const aiA = createAI(2, stateA.seed)
    const aiB = createAI(2, stateB.seed)

    const intentsA: ReturnType<typeof aiA.decide>[] = []
    const intentsB: ReturnType<typeof aiB.decide>[] = []
    for (let t = 0; t < 300; t++) {
      const a = aiA.decide(stateA)
      const b = aiB.decide(stateB)
      intentsA.push(a)
      intentsB.push(b)
      tick(stateA, a)
      tick(stateB, b)
    }
    expect(intentsA).toEqual(intentsB)
  })

  it('uses buildings and diplomacy over a long four-player game', () => {
    const config: GameConfig = {
      mapWidth: 64,
      mapHeight: 64,
      seed: 'ai-mechanics',
      victoryPct: 90,
      terrain: 'flat',
      players: [
        { id: 1, name: 'A1', color: 0xff0000ff, isHuman: false },
        { id: 2, name: 'A2', color: 0x00ff00ff, isHuman: false },
        { id: 3, name: 'A3', color: 0x0000ffff, isHuman: false },
        { id: 4, name: 'A4', color: 0xffff00ff, isHuman: false },
      ],
    }
    const state = createGame(config)
    const ais = config.players.map((p) => createAI(p.id, state.seed, 'hard'))
    for (let t = 0; t < 2500; t++) {
      const intents = ais.flatMap((ai) => [...ai.decide(state)])
      tick(state, intents)
    }
    // Mindestens ein Gebäude wurde gebaut.
    expect(state.buildings.size).toBeGreaterThan(0)
    // Diplomatie fand statt (Anfrage und/oder Bündnis).
    expect(state.alliances.size + state.allianceRequests.size).toBeGreaterThan(0)
  })

  it('places defense posts behind the border, not directly on the enemy front', () => {
    // Verteidigungsposten sollen ins eigene Hinterland (überleben einen Push und
    // decken eigenes Land ab), nicht aufs unmittelbare Front-Tile (sofort miterobert).
    // Wir prüfen jeden Bau-Intent zum Entscheidungszeitpunkt gegen das aktuelle Board.
    const config: GameConfig = {
      mapWidth: 64,
      mapHeight: 64,
      seed: 'ai-defense-placement',
      victoryPct: 90,
      terrain: 'flat',
      players: [
        { id: 1, name: 'A1', color: 0xff0000ff, isHuman: false },
        { id: 2, name: 'A2', color: 0x00ff00ff, isHuman: false },
        { id: 3, name: 'A3', color: 0x0000ffff, isHuman: false },
        { id: 4, name: 'A4', color: 0xffff00ff, isHuman: false },
      ],
    }
    const state = createGame(config)
    const { width, height } = state.map
    const ais = config.players.map((p) => createAI(p.id, state.seed, 'hard'))
    let interior = 0
    let onBorder = 0
    for (let t = 0; t < 2500; t++) {
      const intents = ais.flatMap((ai) => [...ai.decide(state)])
      for (const i of intents) {
        if (i.type === 'build' && i.buildingType === 'defense') {
          let adjacentEnemy = false
          for (const n of neighbors4(i.tile, width, height)) {
            const o = getOwner(state.map, n)
            if (o > 0 && o !== i.playerId) {
              adjacentEnemy = true
              break
            }
          }
          if (adjacentEnemy) onBorder++
          else interior++
        }
      }
      tick(state, intents)
    }
    // Es wurden überhaupt Verteidigungsposten gebaut …
    expect(interior + onBorder).toBeGreaterThan(0)
    // … und die klare Mehrheit liegt im Hinterland, nicht direkt am Feind.
    expect(interior).toBeGreaterThan(onBorder)
  })

  it('different player IDs → different intent streams (even same seed)', () => {
    // Make a config with 2 AIs so we can compare their behavior
    const config: GameConfig = {
      ...aiConfig('shared'),
      players: [
        { id: 1, name: 'Human', color: 0xff0000ff, isHuman: true },
        { id: 2, name: 'A2', color: 0x00ff00ff, isHuman: false },
        { id: 3, name: 'A3', color: 0x0000ffff, isHuman: false },
      ],
    }
    const state = createGame(config)
    const ai2 = createAI(2, state.seed)
    const ai3 = createAI(3, state.seed)

    const stream2: number[] = []
    const stream3: number[] = []
    for (let t = 0; t < 200; t++) {
      const a2 = ai2.decide(state)
      const a3 = ai3.decide(state)
      const tile2 = a2[0]?.type === 'attack' ? a2[0].targetTile : -1
      const tile3 = a3[0]?.type === 'attack' ? a3[0].targetTile : -1
      stream2.push(tile2)
      stream3.push(tile3)
      tick(state, [...a2, ...a3])
    }
    expect(stream2).not.toEqual(stream3)
  })

  it('wilde KI expandiert (greift an), baut aber nie und macht keine Diplomatie', () => {
    const config: GameConfig = {
      ...aiConfig('wild-ai'),
      players: [
        { id: 1, name: 'Human', color: 0xff0000ff, isHuman: true },
        { id: 2, name: 'Wilde', color: 0x8f8a78ff, isHuman: false, wild: true },
      ],
    }
    const state = createGame(config)
    const wildAi = createAI(2, state.seed, 'normal', true)
    let sawAttack = false
    let sawBuildOrDiplo = false
    for (let t = 0; t < 300; t++) {
      const intents = wildAi.decide(state)
      for (const i of intents) {
        if (i.type === 'attack') sawAttack = true
        if (
          i.type === 'build' ||
          i.type === 'request-alliance' ||
          i.type === 'accept-alliance' ||
          i.type === 'break-alliance' ||
          i.type === 'set-embargo' ||
          i.type === 'launch-warship'
        ) {
          sawBuildOrDiplo = true
        }
      }
      tick(state, intents)
    }
    expect(sawAttack).toBe(true) // expandiert in neutrales Land
    expect(sawBuildOrDiplo).toBe(false) // baut/diplomatisiert/keine Schiffe
  })
})
