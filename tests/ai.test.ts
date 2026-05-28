import { describe, it, expect } from 'vitest'
import { createAI } from '../src/ai/ai'
import { createGame, tick, type GameConfig } from '../src/core/game'

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
})
