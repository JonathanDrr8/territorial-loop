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

export type Difficulty = 'easy' | 'normal' | 'hard'

interface DifficultyProfile {
  readonly attackPct: number
  readonly cooldownMin: number
  readonly cooldownMax: number
  readonly popThresholdForPvp: number
}

const PROFILES: Record<Difficulty, DifficultyProfile> = {
  // Langsamere Entscheidungen, kleinere Wellen, beschäftigt sich länger mit
  // neutralem Land bevor sie zu Gegnern wechselt.
  easy: { attackPct: 18, cooldownMin: 60, cooldownMax: 180, popThresholdForPvp: 0.75 },
  // Mittelfeld — entspricht dem ursprünglichen Allround-Verhalten.
  normal: { attackPct: 30, cooldownMin: 30, cooldownMax: 100, popThresholdForPvp: 0.6 },
  // Aggressiv: fast doppelt so oft Entscheidungen, größere Wellen, schneller PvP.
  hard: { attackPct: 42, cooldownMin: 18, cooldownMax: 60, popThresholdForPvp: 0.45 },
}

export interface AI {
  /** Aufgerufen pro Sim-Tick. Returnt Intents für diesen Tick (0 oder 1). */
  decide(state: GameState): readonly Intent[]
}

export function createAI(
  playerId: number,
  gameSeed: string,
  difficulty: Difficulty = 'normal',
): AI {
  const profile = PROFILES[difficulty]
  const rng = createPRNG(`ai-${playerId.toString()}-${gameSeed}`)
  let nextDecisionTick = rng.nextInt(profile.cooldownMin, profile.cooldownMax)

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

      nextDecisionTick = state.tick + rng.nextInt(profile.cooldownMin, profile.cooldownMax)

      const max = maxTroops(player.tilesOwned)
      const popRatio = max > 0 ? player.troops / max : 0
      const preferEnemies = popRatio >= profile.popThresholdForPvp

      const targetTile = pickTarget(state, player, preferEnemies)
      if (targetTile < 0) return []

      const troops = Math.floor((player.troops * profile.attackPct) / 100)
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
