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
 *
 * Sehr wohl serialisiert (Audit-Funde, Resync-Drift):
 *  - `projectiles` — Kriegsschiff-Schaden fällt erst beim EINSCHLAG; verworfene Projektile
 *    schlugen im Original ein, in der Kopie nie → HP-/Gold-Drift. Ziel-Referenzen werden als
 *    typisierte Indizes geschrieben und beim Laden auf die neuen Objekt-Instanzen zurückgemappt.
 *  - laufender Econ-Zyklus (`econActive` + eingefrorene Seeds/Sources/Factories + Flut-Arrays) —
 *    die mehr-Tick-Flut liest die LIVE-Karte, ein Neustart ab Zyklusbeginn wäre also nicht
 *    bit-identisch; ohne den Zustand drifteten goldCarts/Gold nach einem mid-cycle-Snapshot.
 *    Nur geschrieben, wenn ein Zyklus aktiv ist (Snapshots sind sonst unverändert klein).
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
import type { Boat, Bomber, GoldCart, TradeShip, Warship } from './ships'
import { createMap } from '../world/map'
import { labelLandComponents, labelWaterComponents } from '../world/water-path'
import type { TileRef } from '../world/torus'

/** Spieler ohne das ableitbare `frontier`-Set (wird beim Deserialisieren rekonstruiert). */
type SerializedPlayer = Omit<Player, 'frontier'>

/** Fliegendes Projektil mit Ziel als typisiertem Index (Objekt-Identität überlebt JSON nicht). */
interface SerializedProjectile {
  /** Index des Schützen in `warships`. */
  readonly shooter: number
  readonly targetKind: 'warship' | 'boat' | 'trade'
  /** Index des Ziels im Array seiner `targetKind` (warships/boats/tradeShips). */
  readonly target: number
  readonly fromX: number
  readonly fromY: number
  readonly aimX: number
  readonly aimY: number
  readonly travel: number
  readonly impactAt: number
}

/** Eingefrorener Stand eines LAUFENDEN Econ-Zyklus (nur bei `econActive` im Snapshot). */
interface SerializedEcon {
  readonly seeds: readonly TileRef[]
  readonly sources: readonly TileRef[]
  readonly factories: readonly { tile: TileRef; owner: number; level: number }[]
  readonly flood: {
    readonly comp: readonly number[]
    readonly queue: readonly number[]
    readonly head: number
    readonly tail: number
    readonly seedIdx: number
    readonly nextId: number
    readonly curOwner: number
    readonly curId: number
    readonly done: boolean
  }
}

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
  readonly bombers: readonly Bomber[]
  readonly alliances: readonly number[]
  readonly allianceExpiry: readonly (readonly [number, number])[]
  readonly allianceRequests: readonly number[]
  readonly embargoes: readonly number[]
  readonly grudge: readonly (readonly [number, number])[]
  readonly goodwill: readonly (readonly [number, number])[]
  readonly recentCaptures: readonly (readonly [TileRef, number])[]
  readonly events: readonly GameEvent[]
  /** Fliegende Projektile (optional — Alt-Snapshots ohne Feld laden wie bisher: leer). */
  readonly projectiles?: readonly SerializedProjectile[]
  /** Laufender Econ-Zyklus (optional — fehlt er, startet die Kopie wie bisher frisch). */
  readonly econ?: SerializedEcon
  /** Economy-Dirty-Flag des Originals (optional — fehlt es, gilt das bisherige `true`). */
  readonly economyDirty?: boolean
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

  // Projektile: Objekt-Referenzen → typisierte Indizes (Reihenfolge der Arrays bleibt im
  // Snapshot exakt erhalten). Schütze/Ziel ohne Index (theoretisch unmöglich) → Projektil entfällt
  // wie früher (verpufft) statt einen kaputten Verweis zu schreiben.
  const idxOf = (arr: readonly unknown[], item: unknown): number => arr.indexOf(item)
  const projectiles: SerializedProjectile[] = []
  for (const pr of state.projectiles) {
    const shooter = idxOf(state.warships, pr.shooter)
    const target =
      pr.targetKind === 'warship'
        ? idxOf(state.warships, pr.target)
        : pr.targetKind === 'boat'
          ? idxOf(state.boats, pr.target)
          : idxOf(state.tradeShips, pr.target)
    if (shooter < 0 || target < 0) continue
    projectiles.push({
      shooter,
      targetKind: pr.targetKind,
      target,
      fromX: pr.fromX,
      fromY: pr.fromY,
      aimX: pr.aimX,
      aimY: pr.aimY,
      travel: pr.travel,
      impactAt: pr.impactAt,
    })
  }

  // Laufenden Econ-Zyklus einfrieren (nur dann — sonst bleibt der Snapshot klein). Die Flut-Arrays
  // sind n-groß wie die Owner-Karte; gleiche Array-Kodierung wie `map.state`.
  const fs = state.econFlood
  const econ: SerializedEcon | undefined =
    state.econActive && fs !== null
      ? {
          seeds: [...state.econSeeds],
          sources: [...state.econSources],
          factories: state.econFactories.map((f) => ({ ...f })),
          flood: {
            comp: Array.from(fs.comp),
            queue: Array.from(fs.queue),
            head: fs.head,
            tail: fs.tail,
            seedIdx: fs.seedIdx,
            nextId: fs.nextId,
            curOwner: fs.curOwner,
            curId: fs.curId,
            done: fs.done,
          },
        }
      : undefined

  return {
    ...(econ !== undefined ? { econ } : {}),
    projectiles,
    economyDirty: state.economyDirty,
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
    bombers: state.bombers.map((b) => ({ ...b, path: [...b.path] })),
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

  const warships = data.warships.map((w) => ({ ...w, path: [...w.path] }))
  const boats = data.boats.map((b) => ({ ...b, path: [...b.path] }))
  const tradeShips = data.tradeShips.map((t) => ({ ...t, path: [...t.path] }))

  // Projektile: typisierte Indizes → neue Objekt-Instanzen (gleiche Array-Reihenfolge wie beim
  // Schreiben). Ungültige Indizes (Alt-/Fremd-Snapshot) → Projektil entfällt wie früher.
  const projectiles: GameState['projectiles'] = []
  for (const pr of data.projectiles ?? []) {
    const shooter = warships[pr.shooter]
    const target =
      pr.targetKind === 'warship'
        ? warships[pr.target]
        : pr.targetKind === 'boat'
          ? boats[pr.target]
          : tradeShips[pr.target]
    if (shooter === undefined || target === undefined) continue
    projectiles.push({
      shooter,
      target,
      targetKind: pr.targetKind,
      fromX: pr.fromX,
      fromY: pr.fromY,
      aimX: pr.aimX,
      aimY: pr.aimY,
      travel: pr.travel,
      impactAt: pr.impactAt,
    })
  }

  // Laufenden Econ-Zyklus wiederherstellen (Flut-Arrays + eingefrorene Inputs) — die Kopie
  // setzt die Flut exakt dort fort, wo das Original stand (bit-genau, Audit-Fund Gold-Drift).
  const econ = data.econ
  const econFlood =
    econ !== undefined
      ? {
          comp: Int32Array.from(econ.flood.comp),
          queue: Int32Array.from(econ.flood.queue),
          head: econ.flood.head,
          tail: econ.flood.tail,
          seedIdx: econ.flood.seedIdx,
          nextId: econ.flood.nextId,
          curOwner: econ.flood.curOwner,
          curId: econ.flood.curId,
          done: econ.flood.done,
        }
      : null

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
    coastalTiles: null, // lazy beim ersten Boot-Start (Terrain steht hier schon, aber konsistent mit createGame)
    boats,
    tradeShips,
    tradeRouteCache: new Map<string, readonly TileRef[] | null>(),
    goldCarts: data.goldCarts.map((c) => ({ ...c, path: [...c.path] })),
    ownerComponents: null,
    economyDirty: data.economyDirty ?? true,
    econFlood,
    econActive: econ !== undefined,
    econSeeds: econ !== undefined ? [...econ.seeds] : [],
    econSources: econ !== undefined ? [...econ.sources] : [],
    econFactories: econ !== undefined ? econ.factories.map((f) => ({ ...f })) : [],
    goldPops: [],
    warships,
    projectiles,
    bombers: data.bombers.map((b) => ({ ...b, path: [...b.path] })),
    bombImpacts: [],
    flakShots: [],
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
  // Transienter, abgeleiteter Cache: der Resync ersetzt die Spieler-Objekte in-place; ein alter
  // orderedPlayers-Cache hielte sonst veraltete Referenzen (gleiche Länge → nicht selbst-invalidiert).
  // deserializeState setzt den Key nicht, daher überschreibt Object.assign ihn nicht → hier verwerfen.
  delete target.orderedPlayersCache
}
