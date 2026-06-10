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

/**
 * Vom Stand VOR der Hotpath-Optimierung aufgezeichnet (commit f499376-Linie).
 * Neu aufgezeichnet 2026-06-07 nach der Balance-Runde (MAX_TROOPS_PER_TILE 950→800 +
 * TROOP_GROWTH_FACTOR 0.6): die geänderten Cap-/Wachstums-Konstanten verändern den Sim-Verlauf
 * bewusst → neue (deterministisch reproduzierte) Hashes. Der Test bleibt der Tripwire für
 * ungewollte Hotpath-Algorithmus-Änderungen.
 */
// 300er neu am 2026-06-10 (Balance #6: Baukosten 40k + Deckel 150k — KIs bauen ab ~Tick 250 anders;
// 100/200 unverändert). 2× deterministisch reproduziert.
// Alle neu am 2026-06-10 (passiver Wildnis-Wuchs: Wilde schlucken ab Tick 0 freies Land →
// State ändert sich früh). 2× deterministisch reproduziert.
const GOLDEN: Record<number, number> = { 100: 415124253, 200: 502047252, 300: 3431581441 }

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
