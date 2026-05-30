/**
 * Voll-Snapshot des `GameState` ↔ JSON-sicheres Objekt (ADR-0009).
 *
 * Zweck: server-autoritatives Lockstep braucht einen **vollständigen GameState-Snapshot**
 * für Resync (ein abweichender Client wird korrigiert) und Reconnect (ein zurückkehrender
 * Mensch lädt den aktuellen Stand). Im Normalbetrieb gehen nur Intents übers Netz —
 * Snapshots sind selten, daher ist die JSON-/Array-Form (nicht binär) für den MVP okay
 * (ADR-0009: „JSON im MVP; später binär").
 *
 * Garantie: `deserializeState(serializeState(s))` ergibt einen State, der **bit-genau
 * gleich weiterläuft** — `hashState` ist sofort identisch und bleibt es über beliebig
 * viele weitere Ticks (durch den mitserialisierten PRNG-Zustand). Verifiziert in
 * `tests/serialize.test.ts`.
 *
 * Bewusst NICHT serialisiert (rekonstruiert/verworfen):
 *  - `waterComponents`/`landComponents`/`passableLandCount` — statisch aus dem Terrain
 *    ableitbar, werden beim Deserialisieren neu berechnet.
 *  - `player.frontier` — aus der Owner-Karte ableitbar (`initializeAllFrontiers`).
 *  - `projectiles` — kurzlebig, nicht hash-relevant; ein laufender Schuss verpufft beim
 *    Snapshot (höchstens ein kosmetischer Aussetzer, kein Sim-Unterschied).
 */

import type { Building } from './buildings'
import {
  countPassableLand,
  initializeAllFrontiers,
  type Attack,
  type GameConfig,
  type GameEvent,
  type GamePhase,
  type GameState,
  type Player,
} from './game'
import { createPRNG, type PRNGState } from './random'
import type { Boat, GoldCart, TradeShip, Warship } from './ships'
import { createMap } from '../world/map'
import { labelLandComponents, labelWaterComponents } from '../world/water-path'
import type { TileRef } from '../world/torus'

/** Spieler ohne das ableitbare `frontier`-Set (wird beim Deserialisieren rekonstruiert). */
type SerializedPlayer = Omit<Player, 'frontier'>

export interface SerializedGameState {
  readonly tick: number
  readonly phase: GamePhase
  readonly winner: number | null
  readonly seed: string
  readonly config: GameConfig
  readonly rng: PRNGState
  readonly map: {
    readonly width: number
    readonly height: number
    readonly terrain: readonly number[]
    readonly state: readonly number[]
  }
  readonly players: readonly SerializedPlayer[]
  readonly buildings: readonly (readonly [TileRef, Building])[]
  readonly boats: readonly Boat[]
  readonly tradeShips: readonly TradeShip[]
  readonly goldCarts: readonly GoldCart[]
  readonly warships: readonly Warship[]
  readonly alliances: readonly number[]
  readonly allianceExpiry: readonly (readonly [number, number])[]
  readonly allianceRequests: readonly number[]
  readonly embargoes: readonly number[]
  readonly grudge: readonly (readonly [number, number])[]
  readonly goodwill: readonly (readonly [number, number])[]
  readonly recentCaptures: readonly (readonly [TileRef, number])[]
  readonly events: readonly GameEvent[]
}

/** Kopiert ein Schiff inkl. eigener `path`-Kopie (Snapshot darf nicht mit dem State mutieren). */
function copyAttack(a: Attack): Attack {
  return { ...a }
}

/** Vollständiger, JSON-sicherer Snapshot des aktuellen Spielzustands. */
export function serializeState(state: GameState): SerializedGameState {
  const players: SerializedPlayer[] = []
  for (const p of state.players.values()) {
    const { frontier: _frontier, attacks, ...rest } = p
    players.push({ ...rest, attacks: attacks.map(copyAttack) })
  }

  return {
    tick: state.tick,
    phase: state.phase,
    winner: state.winner,
    seed: state.seed,
    config: state.config,
    rng: state.rng.state(),
    map: {
      width: state.map.width,
      height: state.map.height,
      terrain: Array.from(state.map.terrain),
      state: Array.from(state.map.state),
    },
    players,
    buildings: [...state.buildings.entries()].map(([tile, b]) => [tile, { ...b }]),
    boats: state.boats.map((b) => ({ ...b, path: [...b.path] })),
    tradeShips: state.tradeShips.map((t) => ({ ...t, path: [...t.path] })),
    goldCarts: state.goldCarts.map((c) => ({ ...c, path: [...c.path] })),
    warships: state.warships.map((w) => ({ ...w, path: [...w.path] })),
    alliances: [...state.alliances],
    allianceExpiry: [...state.allianceExpiry.entries()],
    allianceRequests: [...state.allianceRequests],
    embargoes: [...state.embargoes],
    grudge: [...state.grudge.entries()],
    goodwill: [...state.goodwill.entries()],
    recentCaptures: [...state.recentCaptures.entries()],
    events: state.events.map((e) => ({ ...e })),
  }
}

/**
 * Baut aus einem Snapshot einen voll funktionsfähigen `GameState` — läuft bit-genau
 * weiter wie der ursprüngliche (gleicher PRNG-Zustand, gleiche Owner-Karte, gleiche Sim-
 * Kollektionen). Statische/ableitbare Felder werden neu berechnet.
 */
export function deserializeState(data: SerializedGameState): GameState {
  const map = createMap(data.map.width, data.map.height)
  map.terrain.set(data.map.terrain)
  map.state.set(data.map.state)

  const players = new Map<number, Player>()
  for (const sp of data.players) {
    players.set(sp.id, { ...sp, attacks: sp.attacks.map(copyAttack), frontier: new Set<TileRef>() })
  }

  const state: GameState = {
    tick: data.tick,
    map,
    players,
    rng: createPRNG('', data.rng),
    seed: data.seed,
    config: data.config,
    phase: data.phase,
    winner: data.winner,
    events: data.events.map((e) => ({ ...e })),
    buildings: new Map(data.buildings.map(([tile, b]) => [tile, { ...b }])),
    dirtyTiles: [],
    waterComponents: labelWaterComponents(map),
    landComponents: labelLandComponents(map),
    passableLandCount: countPassableLand(map),
    boats: data.boats.map((b) => ({ ...b, path: [...b.path] })),
    tradeShips: data.tradeShips.map((t) => ({ ...t, path: [...t.path] })),
    goldCarts: data.goldCarts.map((c) => ({ ...c, path: [...c.path] })),
    ownerComponents: null,
    goldPops: [],
    warships: data.warships.map((w) => ({ ...w, path: [...w.path] })),
    projectiles: [],
    alliances: new Set(data.alliances),
    allianceExpiry: new Map(data.allianceExpiry.map(([k, v]) => [k, v])),
    allianceRequests: new Set(data.allianceRequests),
    embargoes: new Set(data.embargoes),
    grudge: new Map(data.grudge.map(([k, v]) => [k, v])),
    goodwill: new Map(data.goodwill.map(([k, v]) => [k, v])),
    recentCaptures: new Map(data.recentCaptures.map(([k, v]) => [k, v])),
  }

  initializeAllFrontiers(state)
  return state
}

/**
 * Lädt einen Snapshot **in-place** in einen bestehenden `GameState`: alle Felder werden ersetzt,
 * die Objekt-Referenz selbst bleibt erhalten. Dadurch sehen alle Closure-Halter (Renderer, HUD,
 * Input) die Korrektur sofort — ohne Match-Neuaufbau. Grundlage für den Mid-Match-Resync nach
 * server-erkanntem Desync (ADR-0009 Phase 6): der laufende State schnappt auf den autoritativen
 * Server-Snapshot zurück, statt still weiter zu driften.
 */
export function loadSnapshotInto(target: GameState, data: SerializedGameState): void {
  Object.assign(target, deserializeState(data))
}
