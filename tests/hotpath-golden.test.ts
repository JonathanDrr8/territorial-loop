/**
 * Golden-Hash-Regression für den Angriffs-Hotpath (ADR-0030-Nachtrag, Sim-Optimierung).
 *
 * Anders als `hash.test.ts`/`replay.test.ts` (die nur ZWEI Läufe desselben Codes vergleichen und
 * darum interne Konsistenz, NICHT eine Verhaltens-Änderung gegenüber dem alten Algorithmus prüfen),
 * fixiert dieser Test **golden values**, die vom Stand VOR der Optimierung von `collectAttackableTiles`
 * & Co. aufgezeichnet wurden. Jede bit-Abweichung (falsche `tiles`-Menge/-Reihenfolge → anderer
 * `shuffleArray`-Verlauf → anderer Hash) bricht ihn sofort. Deterministisches Selbstspiel über echte
 * KI (exerziert Angriffe/Eroberung/Frontier/Economy/Diplomatie zusammen).
 */
import { describe, expect, it } from 'vitest'

import { createAI, type AI } from '../src/ai/ai'
import { createGame, tick, type GameConfig, type PlayerDef } from '../src/core/game'
import { hashState } from '../src/core/hash'

function cfg(): GameConfig {
  const players: PlayerDef[] = []
  let id = 1
  for (let i = 0; i < 6; i++)
    players.push({ id: id++, name: `A${String(i)}`, color: 0x3366ccff, isHuman: false })
  for (let i = 0; i < 8; i++)
    players.push({ id: id++, name: `W${String(i)}`, color: 0x888888ff, isHuman: false, wild: true })
  return {
    mapWidth: 128,
    mapHeight: 128,
    seed: 'hotpath-golden',
    victoryPct: 99,
    terrain: 'continents',
    players,
  }
}

/** Vom Stand VOR der Hotpath-Optimierung aufgezeichnet (commit f499376-Linie). */
const GOLDEN: Record<number, number> = { 100: 3687982766, 200: 2046912374, 300: 854871503 }

describe('Angriffs-Hotpath — golden hash', () => {
  it('deterministisches Selbstspiel bleibt bit-identisch (collectAttackableTiles & Co.)', () => {
    const state = createGame(cfg())
    const ais: AI[] = []
    for (const p of state.players.values()) ais.push(createAI(p.id, state.seed, 'standard', p.wild))
    const checkpoints: Record<number, number> = {}
    for (let t = 0; t < 300; t++) {
      const intents = []
      for (const ai of ais) for (const i of ai.decide(state)) intents.push(i)
      tick(state, intents)
      const n = t + 1
      if (n === 100 || n === 200 || n === 300) checkpoints[n] = hashState(state)
    }
    expect(checkpoints).toEqual(GOLDEN)
  })
})
