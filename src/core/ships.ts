/**
 * Schiffe: Transport-Boote (amphibische Angriffe) und Handelsschiffe.
 *
 * Diese Datei hält die Datentypen, Konstanten und die *reinen* Routenplaner
 * (Map + Wasser-Komponenten rein, Pfad raus). Die zustandsverändernde Logik
 * — Boote bewegen, landen, Gold ausschütten — lebt in `core/game.ts`, weil
 * sie an interne Kampf-/Capture-Funktionen koppelt.
 *
 * Alles deterministisch: keine `Math.random`, feste Iterations-Reihenfolgen.
 */

import type { GameMap } from '../world/map'
import { torusDistance, type TileRef } from '../world/torus'
import { adjacentWaterByComponent, findWaterPath, sameWaterComponent } from '../world/water-path'

/** Maximale Anzahl gleichzeitiger Transport-Boote pro Spieler. */
export const MAX_BOATS_PER_PLAYER = 3
/** Tiles die ein Boot pro Tick zurücklegt. */
export const BOAT_SPEED = 2
/** Tiles die ein Handelsschiff pro Tick zurücklegt. */
export const TRADE_SHIP_SPEED = 1
/** Wie oft (Ticks) ein Hafen versucht ein Handelsschiff auszusenden. */
export const TRADE_INTERVAL_TICKS = 120
/** Gold-Sockelbetrag pro abgeschlossener Handelsfahrt (an beide Hafen-Besitzer). */
export const TRADE_GOLD_BASE = 200
/** Zusätzliches Gold pro Tile Reisedistanz. */
export const TRADE_GOLD_PER_TILE = 6

/** Ein Transport-Boot unterwegs zu einem Lande-Ziel. */
export interface Boat {
  readonly ownerId: number
  troops: number
  /** Wasser-Tiles der Route, Start→Ziel. */
  readonly path: readonly TileRef[]
  /** Fortschritt entlang `path` (Float, wird pro Tick um BOAT_SPEED erhöht). */
  progress: number
  /** Land-Tile auf dem das Boot landet und den Angriff beginnt. */
  readonly targetTile: TileRef
}

/** Ein Handelsschiff zwischen zwei Häfen. */
export interface TradeShip {
  readonly fromOwnerId: number
  readonly toOwnerId: number
  readonly path: readonly TileRef[]
  progress: number
  /** Gold das bei Ankunft an BEIDE Hafen-Besitzer geht. */
  readonly gold: number
  readonly originPort: TileRef
  readonly destPort: TileRef
}

/** Gold-Ertrag einer Handelsfahrt der gegebenen Wasser-Distanz. */
export function tradeGold(distanceTiles: number): number {
  return TRADE_GOLD_BASE + Math.round(distanceTiles * TRADE_GOLD_PER_TILE)
}

/** Aktuelle Tile-Position eines Schiffs (für Rendering). */
export function shipTile(ship: Boat | TradeShip): TileRef {
  const idx = Math.min(Math.floor(ship.progress), ship.path.length - 1)
  return ship.path[idx] ?? ship.path[0] ?? 0
}

/**
 * Interpolierte Welt-Position (Tile-Mitten) eines Schiffs entlang seiner Route,
 * torus-sicher (interpoliert über die kürzere Wrap-Richtung). Für Rendering + Hover.
 */
export function shipWorldPos(
  ship: Boat | TradeShip,
  mapW: number,
  mapH: number,
): { wx: number; wy: number } {
  const len = ship.path.length
  const fIdx = Math.min(Math.floor(ship.progress), len - 1)
  const frac = ship.progress - fIdx
  const a = ship.path[fIdx] ?? ship.path[0] ?? 0
  const b = ship.path[Math.min(fIdx + 1, len - 1)] ?? a
  const ax = (a % mapW) + 0.5
  const ay = Math.floor(a / mapW) + 0.5
  const bx = (b % mapW) + 0.5
  const by = Math.floor(b / mapW) + 0.5
  let dx = bx - ax
  let dy = by - ay
  if (dx > mapW / 2) dx -= mapW
  else if (dx < -mapW / 2) dx += mapW
  if (dy > mapH / 2) dy -= mapH
  else if (dy < -mapH / 2) dy += mapH
  return { wx: ax + dx * frac, wy: ay + dy * frac }
}

/** Ob ein Schiff seine Route abgeschlossen hat. */
export function shipArrived(ship: Boat | TradeShip): boolean {
  return ship.progress >= ship.path.length - 1
}

/**
 * Plant eine Wasserroute zwischen zwei Küsten-Land-Tiles. Sucht eine gemeinsame
 * Wasser-Komponente an die beide grenzen und liefert den A*-Pfad dazwischen.
 */
export function planWaterRoute(
  map: GameMap,
  comp: Int32Array,
  fromLand: TileRef,
  toLand: TileRef,
): TileRef[] | null {
  const fromSeas = adjacentWaterByComponent(map, comp, fromLand)
  const toSeas = adjacentWaterByComponent(map, comp, toLand)
  // gemeinsame Komponente mit kleinster ID (deterministisch)
  let bestComp = -1
  for (const c of fromSeas.keys()) {
    if (toSeas.has(c) && (bestComp === -1 || c < bestComp)) bestComp = c
  }
  if (bestComp === -1) return null
  const start = fromSeas.get(bestComp)
  const goal = toSeas.get(bestComp)
  if (start === undefined || goal === undefined) return null
  if (!sameWaterComponent(comp, start, goal)) return null
  return findWaterPath(map, start, goal, comp)
}

/**
 * Plant den Start eines Transport-Boots: findet das dem Ziel nächstgelegene
 * eigene Küsten-Land-Tile, das über Wasser mit dem Ziel verbunden ist, und
 * baut die Route. `ownerTiles` ist die Liste der dem Spieler gehörenden Tiles.
 */
export function planBoatLaunch(
  map: GameMap,
  comp: Int32Array,
  ownerTiles: readonly TileRef[],
  targetTile: TileRef,
): { fromLand: TileRef; path: TileRef[] } | null {
  const targetSeas = adjacentWaterByComponent(map, comp, targetTile)
  if (targetSeas.size === 0) return null

  const { width, height } = map
  const tx = targetTile % width
  const ty = Math.floor(targetTile / width)

  let bestLand = -1
  let bestDist = Infinity
  for (const land of ownerTiles) {
    const seas = adjacentWaterByComponent(map, comp, land)
    let connected = false
    for (const c of seas.keys()) {
      if (targetSeas.has(c)) {
        connected = true
        break
      }
    }
    if (!connected) continue
    const lx = land % width
    const ly = Math.floor(land / width)
    const d = torusDistance(lx, ly, tx, ty, width, height)
    if (d < bestDist) {
      bestDist = d
      bestLand = land
    }
  }
  if (bestLand === -1) return null
  const path = planWaterRoute(map, comp, bestLand, targetTile)
  if (path === null) return null
  return { fromLand: bestLand, path }
}
