import { describe, expect, it } from 'vitest'

import { createAI } from '../src/ai/ai'
import { createGame, tick, type GameConfig } from '../src/core/game'
import { hashState } from '../src/core/hash'
import { createRecorder, replayGame, type Replay } from '../src/core/replay'
import { deserializeState, serializeState } from '../src/core/serialize'
import type { Intent } from '../src/core/intent'
import { getOwner } from '../src/world/map'
import { neighbors4 } from '../src/world/torus'

function cfg(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mapWidth: 80,
    mapHeight: 80,
    seed: 'replay-test',
    victoryPct: 99,
    terrain: 'continents',
    players: [
      { id: 1, name: 'Du', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'KI-1', color: 0x00ff00ff, isHuman: false },
      { id: 3, name: 'KI-2', color: 0x0000ffff, isHuman: false },
      { id: 4, name: 'Wilde', color: 0x888888ff, isHuman: false, wild: true },
    ],
    ...overrides,
  }
}

function neutralBorder(state: ReturnType<typeof createGame>, playerId: number): number {
  const { width, height } = state.map
  const p = state.players.get(playerId)
  if (p === undefined) return -1
  for (const f of p.frontier) {
    for (const n of neighbors4(f, width, height)) {
      if (getOwner(state.map, n) === 0) return n
    }
  }
  return -1
}

/**
 * Spielt ein realistisches Match (KI + skriptete Spieler-Angriffe) für `turnCount` Turns und
 * gibt den Replay-Log + die Live-Hashes je Turn zurück. Die Reihenfolge im committeten Set
 * spiegelt den Transport: [Spieler/Skript …, KI …].
 */
function playAndRecord(
  config: GameConfig,
  turnCount: number,
): { replay: Replay; liveHashes: number[] } {
  const live = createGame(config)
  const recorder = createRecorder()
  const ais = config.players
    .filter((p) => !p.isHuman)
    .map((p) => createAI(p.id, live.seed, 'normal', p.wild ?? false))
  const liveHashes: number[] = []

  for (let t = 0; t < turnCount; t++) {
    const committed: Intent[] = []
    // Skripteter Spieler-Input: alle paar Turns ein Angriff auf neutrales Land.
    if (t % 5 === 0) {
      const target = neutralBorder(live, 1)
      if (target >= 0)
        committed.push({ type: 'attack', playerId: 1, targetTile: target, troops: 800 })
    }
    // KI-Intents anhängen (server-seitig).
    for (const ai of ais) committed.push(...ai.decide(live))

    recorder.record(t, committed)
    tick(live, committed)
    liveHashes.push(hashState(live))
  }

  return { replay: { config, turns: recorder.turns() }, liveHashes }
}

describe('Replay-Determinismus (ADR-0009 Phase 3)', () => {
  it('Replay reproduziert das Live-Match Tick für Tick bit-genau', () => {
    const config = cfg()
    const { replay, liveHashes } = playAndRecord(config, 60)

    // Voller Replay → identischer End-Hash.
    expect(hashState(replayGame(replay))).toBe(liveHashes[liveHashes.length - 1])

    // Schrittweise: Replay bis Turn k stimmt mit dem Live-Hash bei k überein.
    for (const k of [1, 7, 23, 45, 60]) {
      expect(hashState(replayGame(replay, k))).toBe(liveHashes[k - 1])
    }
  })

  it('zweimaliger Replay desselben Logs ist identisch (reine Determinismus-Garantie)', () => {
    const { replay } = playAndRecord(cfg({ seed: 'replay-twice' }), 40)
    expect(hashState(replayGame(replay))).toBe(hashState(replayGame(replay)))
  })

  it('Snapshot + Replay-Rest ergibt denselben State wie durchgehender Replay', () => {
    const config = cfg({ seed: 'replay-snapshot' })
    const { replay, liveHashes } = playAndRecord(config, 50)

    // Bis Turn 20 replayen, snapshotten, deserialisieren, Rest-Turns drauf anwenden.
    const mid = deserializeState(JSON.parse(JSON.stringify(serializeState(replayGame(replay, 20)))))
    for (let i = 20; i < replay.turns.length; i++) {
      const turn = replay.turns[i]
      if (turn !== undefined) tick(mid, turn.intents)
    }
    expect(hashState(mid)).toBe(liveHashes[liveHashes.length - 1])
  })

  it('anderer Seed → anderer Replay-Ausgang (Sanity)', () => {
    const a = playAndRecord(cfg({ seed: 'seed-x' }), 30)
    const b = playAndRecord(cfg({ seed: 'seed-y' }), 30)
    expect(hashState(replayGame(a.replay))).not.toBe(hashState(replayGame(b.replay)))
  })
})
