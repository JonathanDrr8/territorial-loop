/**
 * Selbstläufer-Arena (ADR-0020) — misst KI-Stärke headless.
 *
 * Lässt mehrere KI-Profile in derselben deterministischen Sim (`createGame` + `tick`)
 * gegeneinander laufen, deckelt die Match-Länge und wertet nach Territorium. Aus vielen
 * Matches über viele Seeds fällt ein **ELO pro Profil** (Standard auf 1000 verankert) plus
 * **Nutzungs-Statistik** (wie oft nutzt die KI welche Aktion) für die Balance-Beobachtung.
 *
 * Das ist KEIN Machine-Learning: die KI lernt nichts. Die Arena *misst* nur — getunt wird
 * von Hand an den Heuristik-Konstanten, und der nächste Arena-Lauf zeigt, ob es geholfen hat.
 *
 * Reine Sim-Logik, keine Browser-Deps → läuft in Node/CI (`npm run ai-arena`).
 */

import { createGame, tick, type GameConfig, type GameState, type PlayerDef } from '../core/game'
import type { TerrainType } from '../world/terrain'
import { isLand } from '../world/terrain'
import type { BuildingType } from '../core/buildings'
import type { Intent } from '../core/intent'
import { createAI, type AI, type Difficulty } from './ai'

/** Eine Aktions-Kategorie für die Nutzungs-Statistik (Intent-Typ, Bau aufgeschlüsselt nach Gebäude). */
export type ActionKind =
  | 'attack'
  | 'boat'
  | 'launch-warship'
  | 'move-warship'
  | 'launch-bomber'
  | 'diplomacy'
  | `build:${BuildingType}`
  | 'other'

/** Klassifiziert einen Intent in eine Statistik-Kategorie. */
export function classifyIntent(intent: Intent): ActionKind {
  switch (intent.type) {
    case 'attack':
      return 'attack'
    case 'boat':
      return 'boat'
    case 'launch-warship':
      return 'launch-warship'
    case 'move-warship':
      return 'move-warship'
    case 'launch-bomber':
      return 'launch-bomber'
    case 'build':
      return `build:${intent.buildingType}`
    case 'request-alliance':
    case 'accept-alliance':
    case 'decline-alliance':
    case 'break-alliance':
    case 'set-embargo':
      return 'diplomacy'
    default:
      return 'other'
  }
}

export interface ArenaPlayerResult {
  readonly id: number
  readonly difficulty: Difficulty
  readonly tilesOwned: number
  readonly troops: number
  readonly gold: number
  readonly isAlive: boolean
  /** Zähler je Aktions-Kategorie über das ganze Match. */
  readonly usage: Readonly<Partial<Record<ActionKind, number>>>
}

export interface MatchResult {
  readonly seed: string
  readonly ticks: number
  readonly totalLand: number
  readonly players: readonly ArenaPlayerResult[]
}

export interface MatchOptions {
  /** Ein Difficulty-Eintrag pro KI-Nation (Roster). */
  readonly roster: readonly Difficulty[]
  readonly seed: string
  readonly mapWidth?: number
  readonly mapHeight?: number
  /** Harte Obergrenze an Sim-Ticks (Match endet vorher bei Sieg/Alleinherrschaft). */
  readonly maxTicks?: number
  readonly terrain?: TerrainType
  readonly rivers?: boolean
  readonly allowedBuildings?: Partial<Record<BuildingType, boolean>>
  /** Anteil (Prozent) der Karte für vorzeitigen Sieg. Default 80. */
  readonly victoryPct?: number
}

const DEFAULT_MAP = 96
const DEFAULT_MAX_TICKS = 4000

/** Zählt alle Land-Tiles der Karte (Nenner für Territorium-Anteil). */
function countLand(state: GameState): number {
  let n = 0
  const len = state.map.state.length
  for (let i = 0; i < len; i++) if (isLand(state.map.terrain, i)) n++
  return n
}

/** Wie viele Spieler leben noch? (für vorzeitiges Match-Ende) */
function aliveCount(state: GameState): number {
  let n = 0
  for (const p of state.players.values()) if (p.isAlive) n++
  return n
}

/**
 * Spielt ein Match headless und liefert das Ergebnis. Jede KI bekommt ihr Profil aus dem Roster
 * (Reihenfolge = Player-ID-Reihenfolge). Determiniert vollständig durch `seed`.
 */
export function runMatch(opts: MatchOptions): MatchResult {
  const mapWidth = opts.mapWidth ?? DEFAULT_MAP
  const mapHeight = opts.mapHeight ?? DEFAULT_MAP
  const maxTicks = opts.maxTicks ?? DEFAULT_MAX_TICKS
  const victoryPct = opts.victoryPct ?? 80

  const players: PlayerDef[] = opts.roster.map((_diff, i) => ({
    id: i + 1,
    name: `AI-${String(i + 1)}`,
    color: 0xffffffff,
    isHuman: false,
  }))

  const config: GameConfig = {
    mapWidth,
    mapHeight,
    seed: opts.seed,
    victoryPct,
    ...(opts.terrain !== undefined && { terrain: opts.terrain }),
    ...(opts.rivers !== undefined && { rivers: opts.rivers }),
    ...(opts.allowedBuildings !== undefined && { allowedBuildings: opts.allowedBuildings }),
    players,
  }

  const state = createGame(config)
  const totalLand = countLand(state)

  // KI + Profil + Nutzungs-Zähler pro Spieler.
  const diffById = new Map<number, Difficulty>()
  const usageById = new Map<number, Map<ActionKind, number>>()
  const ais: { id: number; ai: AI }[] = []
  let idx = 0
  for (const p of state.players.values()) {
    const diff = opts.roster[idx] ?? 'standard'
    diffById.set(p.id, diff)
    usageById.set(p.id, new Map())
    ais.push({ id: p.id, ai: createAI(p.id, state.seed, diff, p.wild) })
    idx++
  }

  let ranTicks = 0
  for (let t = 0; t < maxTicks; t++) {
    const committed: Intent[] = []
    for (const { id, ai } of ais) {
      const intents = ai.decide(state)
      if (intents.length === 0) continue
      const usage = usageById.get(id)
      for (const intent of intents) {
        committed.push(intent)
        if (usage !== undefined) {
          const kind = classifyIntent(intent)
          usage.set(kind, (usage.get(kind) ?? 0) + 1)
        }
      }
    }
    tick(state, committed)
    ranTicks = t + 1
    // Vorzeitiges Ende: Sieg erreicht oder nur noch eine lebende Nation.
    if (state.phase === 'ended' || aliveCount(state) <= 1) break
  }

  const results: ArenaPlayerResult[] = []
  for (const p of state.players.values()) {
    const usageMap = usageById.get(p.id) ?? new Map<ActionKind, number>()
    const usage: Partial<Record<ActionKind, number>> = {}
    for (const [k, v] of usageMap) usage[k] = v
    results.push({
      id: p.id,
      difficulty: diffById.get(p.id) ?? 'standard',
      tilesOwned: p.tilesOwned,
      troops: p.troops,
      gold: p.gold,
      isAlive: p.isAlive,
      usage,
    })
  }

  return { seed: opts.seed, ticks: ranTicks, totalLand, players: results }
}
