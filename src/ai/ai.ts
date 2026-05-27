/**
 * Allround-KI.
 *
 * Strategie:
 * - Pro Spieler eigene PRNG-Instanz (seed = `ai-${playerId}-${gameSeed}`),
 *   damit die KI deterministisch ist, aber unabhängig vom Sim-PRNG.
 * - Cooldown zwischen Entscheidungen: 30-100 Ticks (3-10 Sekunden bei 10 Hz).
 * - Entscheidung:
 *   - Bevölkerung >= 60% des Caps → Angriff auf Gegner-Tile bevorzugt
 *   - Sonst → Expansion in nahegelegenes neutrales Tile
 * - Truppen-Einsatz: 30% der Bevölkerung pro Angriff.
 *
 * Die KI sieht alles (kein Fog-of-War im MVP) und greift nur Tiles an die
 * direkt an die eigene Frontier grenzen — keine "Springer"-Angriffe.
 */

import type { Player, GameState } from '../core/game'
import type { Intent } from '../core/intent'
import { maxTroops } from '../core/config'
import { createPRNG } from '../core/random'
import { getOwner } from '../world/map'
import { neighbors4 } from '../world/torus'

const ATTACK_PCT = 30
const COOLDOWN_MIN = 30
const COOLDOWN_MAX = 100
const POP_THRESHOLD_FOR_PVP = 0.6

export interface AI {
  /** Aufgerufen pro Sim-Tick. Returnt Intents für diesen Tick (0 oder 1). */
  decide(state: GameState): readonly Intent[]
}

export function createAI(playerId: number, gameSeed: string): AI {
  const rng = createPRNG(`ai-${playerId.toString()}-${gameSeed}`)
  let nextDecisionTick = rng.nextInt(COOLDOWN_MIN, COOLDOWN_MAX)

  function pickTarget(state: GameState, player: Player, preferEnemies: boolean): number {
    const { width, height } = state.map
    const enemyTiles: number[] = []
    const neutralTiles: number[] = []
    const seen = new Set<number>()

    for (const ref of player.frontier) {
      for (const n of neighbors4(ref, width, height)) {
        if (seen.has(n)) continue
        seen.add(n)
        const owner = getOwner(state.map, n)
        if (owner === player.id) continue
        if (owner === 0) neutralTiles.push(n)
        else enemyTiles.push(n)
      }
    }

    const primary = preferEnemies ? enemyTiles : neutralTiles
    const fallback = preferEnemies ? neutralTiles : enemyTiles
    const pool = primary.length > 0 ? primary : fallback
    if (pool.length === 0) return -1
    return rng.randElement(pool)
  }

  return {
    decide(state: GameState): readonly Intent[] {
      const player = state.players.get(playerId)
      if (player === undefined || !player.isAlive) return []
      if (state.tick < nextDecisionTick) return []

      nextDecisionTick = state.tick + rng.nextInt(COOLDOWN_MIN, COOLDOWN_MAX)

      const max = maxTroops(player.tilesOwned)
      const popRatio = max > 0 ? player.troops / max : 0
      const preferEnemies = popRatio >= POP_THRESHOLD_FOR_PVP

      const targetTile = pickTarget(state, player, preferEnemies)
      if (targetTile < 0) return []

      const troops = Math.floor((player.troops * ATTACK_PCT) / 100)
      if (troops <= 0) return []

      return [
        {
          type: 'attack',
          playerId,
          targetTile,
          troops,
        },
      ]
    },
  }
}
