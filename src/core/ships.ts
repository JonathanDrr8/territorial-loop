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
import { tileRef, torusDistance, type TileRef } from '../world/torus'
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
export const TRADE_GOLD_BASE = 300
/** Zusätzliches Gold pro Tile Reisedistanz. */
export const TRADE_GOLD_PER_TILE = 12

/** Kriegsschiffe: patrouillieren Wasser, fangen feindliche Handelsschiffe ab
 * (Blockade), versenken feindliche Boote und bekämpfen feindliche Kriegsschiffe. */
export const MAX_WARSHIPS_PER_PLAYER = 3
export const WARSHIP_SPEED = 1.5
export const WARSHIP_COST = 30_000
/** Kriegsschiff-HP — klein gehalten (5 Treffer = versenkt), HP-Leiste gut ablesbar. */
export const WARSHIP_HP = 5
/** HP-Schaden eines einschlagenden Schusses (1 = 1 Treffer). */
export const WARSHIP_DAMAGE_PER_TICK = 1
/** Schuss-Cooldown eines Kriegsschiffs (Ticks) — bei 15 ≈ 1,5 s zwischen Schüssen. */
export const WARSHIP_SHOT_COOLDOWN = 15
/**
 * Flug-Geschwindigkeit eines Projektils in Tiles/Tick. Bewusst langsam (deutlich unter
 * Schiffs-Tempo), damit man den Schuss tatsächlich fliegen *sieht* statt eines Aufblitzens —
 * die Flugzeit skaliert mit der Distanz (`impactAt = round(distanz / PROJECTILE_SPEED)`).
 * Stirbt der Schütze vor dem Einschlag, verpufft das Projektil.
 */
export const PROJECTILE_SPEED = 0.4
/** HP-Regeneration pro Tick, wenn ein Kriegsschiff nahe einem eigenen Hafen liegt. */
export const WARSHIP_HEAL_PER_TICK = 1
/** Reichweite (Tiles), in der ein Kriegsschiff feindliche Schiffe angreift. */
export const NAVAL_RANGE = 3
/** Distanz (Tiles) zu einem eigenen Hafen, innerhalb derer ein Kriegsschiff heilt. */
export const WARSHIP_HEAL_RANGE = 4

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
  /** Zurückgerufen → fährt rückwärts zur Start-Küste, Truppen kommen in den Pool. */
  returning: boolean
}

/**
 * Geschwindigkeit der Gold-Fuhren (Tiles/Tick entlang des Land-Pfads) — langsamer als Schiffe,
 * damit das Pendeln gut sichtbar ist.
 */
export const CART_SPEED = 0.5
/**
 * Gold je Anlieferung an der Fabrik, pro Fabrik-Level. Fest pro Fuhre — der Gold-DURCHSATZ
 * (pro Zeit) ergibt sich aus der Rundreise-Dauer: nahe Quellen pendeln öfter → mehr Gold/Zeit,
 * ferne weniger. So entsteht der Cluster-Anreiz (ADR-0018) emergent, ohne Distanz-Formel.
 */
export const CART_GOLD_PER_LEVEL = 150

/**
 * Eine Gold-Fuhre, die zwischen einer Quelle (eigene Stadt/Hafen) und der verbundenen Fabrik über
 * Land pendelt. An der Fabrik wird `gold` gutgeschrieben, dann kehrt sie um (Ping-Pong via `dir`).
 */
export interface GoldCart {
  readonly ownerId: number
  /** Land-Pfad Quelle→Fabrik (Tile-Liste; Brücken springen über Wasser). */
  readonly path: readonly TileRef[]
  /** Fortschritt entlang `path` (Float, ± CART_SPEED pro Tick je nach `dir`). */
  progress: number
  /** +1 = zur Fabrik (lädt dort Gold ab), -1 = zurück zur Quelle. */
  dir: 1 | -1
  /** Gold je Anlieferung an der Fabrik. */
  readonly gold: number
  readonly sourceTile: TileRef
  readonly factoryTile: TileRef
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

/** Ein Kriegsschiff, das seine Route ping-pong patrouilliert (dir kehrt am Ende um). */
export interface Warship {
  readonly ownerId: number
  /** Wasser-Tiles der Patrouillen-Route (per Bewegungsbefehl neu setzbar). */
  path: readonly TileRef[]
  progress: number
  /** Fahrtrichtung entlang `path`: +1 vorwärts, -1 rückwärts (Ping-Pong-Patrouille). */
  dir: 1 | -1
  hp: number
  /** Schuss-Cooldown in Ticks (0 = schussbereit); zählt pro Tick runter. */
  cooldown: number
  /**
   * Verhaltensmodus:
   *  - 'patrol' → Ping-Pong über die ganze Route (Standard).
   *  - 'hold'   → „Halten & Heilen": bei Beschädigung zum Hafen (Routen-Start) zurück,
   *    dort heilen, dann wieder rauspatrouillieren.
   */
  mode: 'patrol' | 'hold'
  /** Zurückgerufen → fährt zur Start-Küste und wird dort aufgelöst. */
  returning: boolean
}

/**
 * Ein fliegendes Projektil eines Kriegsschiffs. Schaden wird erst beim Einschlag (sobald
 * `travel >= impactAt`) angewendet — stirbt der Schütze vorher, verpufft das Projektil
 * (kein Schaden „aus dem Grab", damit nicht beide Schiffe gleichzeitig sterben). Hält direkte
 * Referenzen auf Schütze + Ziel (kurzlebig, nicht im State-Hash).
 */
export interface Projectile {
  readonly shooter: Warship
  readonly target: Warship | Boat | TradeShip
  readonly targetKind: 'warship' | 'boat' | 'trade'
  /** Abfeuer-Position (Welt-Koordinaten, fest) — Startpunkt der Flugbahn. */
  readonly fromX: number
  readonly fromY: number
  /** Verstrichene Flug-Ticks. */
  travel: number
  /** Flug-Ticks bis zum Einschlag (= round(Distanz / PROJECTILE_SPEED), bei Abschuss berechnet). */
  readonly impactAt: number
}

// ── Bomber & Bomben (ADR-0019) ──────────────────────────────────────────────
/** Bomber-Geschwindigkeit (Tiles/Tick) — schneller als Schiffe (fliegt über alles). */
export const BOMBER_SPEED = 2
/** Bomber-HP (Flak-Treffer bis zum Abschuss). */
export const BOMBER_HP = 4
/** Gold-Kosten je Bomber-Start (Munition — die offensive Gold-Senke). */
export const BOMBER_COST = 40_000
/** Bomben-Wirkradius (Tiles) am Einschlagpunkt — großzügig, die Fläche soll spürbar sein. */
export const BOMB_RADIUS = 6

/** Flugroute eines Bombers: gerade Linie oder Parabel-Bogen nach links/rechts (ADR-0019). */
export type BomberRoute = 'direct' | 'arc-left' | 'arc-right'

/**
 * Ein fliegender Bomber. Anders als die Schiffe ist er **sim-relevant** (sein Einschlag ändert
 * Gebiet/Truppen/Gebäude) und wird daher serialisiert. Fliegt `path` ab (über alles), wirft am
 * Ziel die Bombe ab und kehrt um (`dir` -1) zum Flughafen, wo er sich auflöst.
 */
export interface Bomber {
  readonly ownerId: number
  /** Flugpfad Flughafen→Ziel (Tiles, Terrain egal). */
  readonly path: readonly TileRef[]
  progress: number
  /** +1 = zum Ziel, -1 = zurück zum Flughafen (nach dem Abwurf). */
  dir: 1 | -1
  hp: number
  /** Bombe schon abgeworfen? (verhindert Doppel-Einschlag, markiert den Rückflug). */
  dropped: boolean
  /** Einschlag-Ziel (= letztes Vorwärts-path-Tile). */
  readonly targetTile: TileRef
}

/**
 * Konstruiert den Flugpfad eines Bombers vom Flughafen zum Ziel über die geradlinige Torus-
 * Kürzeste, optional als Parabel-Bogen seitlich versetzt (`arc-left`/`arc-right`, um Flak zu
 * umfliegen). Voll deterministisch (nur exakte IEEE-Ops: sqrt/Division/Multiplikation/round) —
 * der Bogen ist eine quadratische Parabel `4·t·(1−t)` statt sin, daher kein det-math nötig.
 */
export function planBomberRoute(
  mapW: number,
  mapH: number,
  fromTile: TileRef,
  toTile: TileRef,
  route: BomberRoute,
): TileRef[] {
  const fx = fromTile % mapW
  const fy = Math.floor(fromTile / mapW)
  const txr = toTile % mapW
  const tyr = Math.floor(toTile / mapW)
  // Kürzeste Torus-Verschiebung (über die nähere Wrap-Richtung).
  let dx = txr - fx
  let dy = tyr - fy
  if (dx > mapW / 2) dx -= mapW
  else if (dx < -mapW / 2) dx += mapW
  if (dy > mapH / 2) dy -= mapH
  else if (dy < -mapH / 2) dy += mapH
  const dist = Math.sqrt(dx * dx + dy * dy)
  const steps = Math.max(1, Math.round(dist))
  const len = dist > 0 ? dist : 1
  // Einheitsnormale zur Flugrichtung (für den seitlichen Parabel-Versatz).
  const nx = -dy / len
  const ny = dx / len
  const amp = route === 'direct' ? 0 : dist * 0.35 * (route === 'arc-left' ? 1 : -1)
  const path: TileRef[] = []
  let prev = -1
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const bow = amp * 4 * t * (1 - t)
    const wx = fx + dx * t + nx * bow
    const wy = fy + dy * t + ny * bow
    const ref = tileRef(Math.round(wx), Math.round(wy), mapW, mapH)
    if (ref !== prev) {
      path.push(ref)
      prev = ref
    }
  }
  if (path.length === 0) path.push(fromTile)
  if (path[path.length - 1] !== toTile) path.push(toTile)
  return path
}

/** Struktureller Typ für die Bewegungs-/Positions-Helfer (Boot/Handel/Kriegsschiff). */
interface MovingShip {
  readonly path: readonly TileRef[]
  progress: number
}

/** Gold-Ertrag einer Handelsfahrt der gegebenen Wasser-Distanz. */
export function tradeGold(distanceTiles: number): number {
  return TRADE_GOLD_BASE + Math.round(distanceTiles * TRADE_GOLD_PER_TILE)
}

/** Aktuelle Tile-Position eines Schiffs (für Rendering). */
export function shipTile(ship: MovingShip): TileRef {
  const idx = Math.min(Math.floor(ship.progress), ship.path.length - 1)
  return ship.path[idx] ?? ship.path[0] ?? 0
}

/**
 * Interpolierte Welt-Position (Tile-Mitten) eines Schiffs entlang seiner Route,
 * torus-sicher (interpoliert über die kürzere Wrap-Richtung). Für Rendering + Hover.
 */
export function shipWorldPos(
  ship: MovingShip,
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
export function shipArrived(ship: MovingShip): boolean {
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
