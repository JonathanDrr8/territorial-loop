/**
 * Tick-Delta (ADR-0030, Sim-auf-Worker): die Pro-Tick-Nachricht, die der (künftige) Worker an den
 * Hauptthread schickt, damit dieser seinen **Schatten-`GameState`** aktualisiert.
 *
 * Inhalt = die DYNAMISCHEN Felder eines `GameState` (alles was sich pro Tick ändert) — bewusst nach
 * demselben Muster wie `serializeState` (die bit-genau getestete Snapshot-Maschinerie), mit EINER
 * Optimierung: das Owner-/Terrain-Array (`map.state`, ~1 Mio. Einträge) wird NICHT voll kopiert,
 * sondern nur als **Dirty-Delta** (die in diesem Tick geänderten Tiles aus `state.dirtyTiles`).
 * Überschreitet das Delta einen Bruchteil der Karte (große Front), wird stattdessen einmal der ganze
 * Owner-Layer mitgeschickt (`ownerFull`) → der Empfänger backt einmal voll.
 *
 * Statische Felder (Terrain, Map-Maße, rng/seed/config) sind NICHT enthalten — die baut der Schatten
 * einmalig aus dem Voll-Snapshot (`createShadow`). Render-flüchtige Listen (projectiles/goldPops/
 * bombImpacts/flakShots) sind hier noch NICHT drin (nicht hash-relevant, `serializeState` lässt sie
 * auch weg) — kommen mit dem Render-Wiring (Stufe 1b), falls der Renderer sie aus dem Schatten liest.
 */

import type { Building } from '../core/buildings'
import type { GameEvent, GamePhase, GameState, Player } from '../core/game'
import type { Boat, Bomber, GoldCart, TradeShip, Warship } from '../core/ships'
import type { TileRef } from '../world/torus'

/** Spieler-Felder ohne das ableitbare `frontier`-Set (wie `SerializedPlayer` in serialize.ts). */
export type PlayerDelta = Omit<Player, 'frontier'>

export interface TickDelta {
  readonly tick: number
  readonly phase: GamePhase
  readonly winner: number | null
  /** Geänderte Tiles dieses Ticks (aus `state.dirtyTiles`). Leer, wenn `ownerFull` gesetzt ist. */
  readonly ownerTiles: readonly number[]
  /** Neuer `map.state[tile]`-Wert je Eintrag in `ownerTiles` (gleiche Reihenfolge). */
  readonly ownerValues: readonly number[]
  /** Voll-Snapshot des Owner-Layers (nur bei Overflow großer Fronten), sonst `null`. */
  readonly ownerFull: readonly number[] | null
  readonly players: readonly PlayerDelta[]
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
}

/** Ab dieser Delta-Größe (Anteil der Karte) lohnt sich ein Voll-Owner-Transfer statt vieler Einzel-Tiles. */
const OWNER_FULL_SHIFT = 2 // > length >> 2  (= mehr als ein Viertel der Karte geändert)

/**
 * Liest die dynamischen Felder des (autoritativen) `state` in ein `TickDelta`. Reiner Lese-Vorgang —
 * kein RNG/Date, keine Mutation → MP-deterministisch. Tiefe Kopien (Schiffe/`attacks`/`path`), damit
 * das Delta nicht mit dem weiterlaufenden State mutiert (relevant sobald es über `postMessage` geht).
 */
export function buildTickDelta(state: GameState): TickDelta {
  const ms = state.map.state
  const dirty = state.dirtyTiles
  let ownerTiles: number[] = []
  let ownerValues: number[] = []
  let ownerFull: number[] | null = null
  if (dirty.length > ms.length >> OWNER_FULL_SHIFT) {
    ownerFull = Array.from(ms)
  } else {
    ownerTiles = dirty.slice()
    ownerValues = new Array<number>(dirty.length)
    for (let i = 0; i < dirty.length; i++) ownerValues[i] = ms[dirty[i] ?? 0] ?? 0
  }

  const players: PlayerDelta[] = []
  for (const p of state.players.values()) {
    const { frontier: _frontier, attacks, ...rest } = p
    players.push({ ...rest, attacks: attacks.map((a) => ({ ...a })) })
  }

  return {
    tick: state.tick,
    phase: state.phase,
    winner: state.winner,
    ownerTiles,
    ownerValues,
    ownerFull,
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
