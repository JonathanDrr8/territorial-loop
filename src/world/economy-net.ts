/**
 * Owner-Land-Komponenten für das Wirtschafts-Verbindungssystem (ADR-0018).
 *
 * Zwei eigene Wirtschaftsgebäude (Stadt/Hafen/Fabrik) gelten als verbunden, wenn ein Weg über
 * zusammenhängendes EIGENES Land sie erreicht. Brücken überspannen schmales Wasser (Flüsse oder
 * Engen bis `BRIDGE_SPAN` Tiles breit), aber kein offenes Meer. Berge (impassierbar) und fremdes
 * Land blockieren — eine durchschnittene Nation verliert die Verbindung.
 *
 * Flüsse tragen kein eigenes Terrain-Bit; die Brücke erkennt schmales Wasser rein über die
 * Spannweite (≤ BRIDGE_SPAN Wasser-Tiles geradeaus zwischen zwei eigenen Land-Tiles).
 *
 * Deterministisch (Union-Find in fester Tile-Reihenfolge, kleinere Wurzel gewinnt) → MP-tauglich.
 */
import type { GameMap } from './map'
import { getOwner } from './map'
import { isLand, isPassable } from './terrain'

/** Maximale Wasser-Breite (Tiles), die eine Brücke überspannt — Flüsse/Engen ja, offenes Meer nein. */
export const BRIDGE_SPAN = 4

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/**
 * Ruft `visit` für jeden über Land erreichbaren Nachbarn von `ref` auf, der `owner` gehört:
 * direkter 4-Nachbar oder das erste eigene Land-Tile hinter einer Brücke (≤ BRIDGE_SPAN Wasser
 * geradeaus). Das erste Land-Tile in einer Richtung beendet den Scan (fremdes Land/Berg blockt).
 * Gemeinsame Kanten-Definition für Komponenten-Labeling UND Pfadsuche → identische Topologie.
 */
function forEachLandNeighbor(
  map: GameMap,
  ref: number,
  owner: number,
  visit: (neighbor: number) => void,
): void {
  const { width, height, terrain } = map
  const x = ref % width
  const y = (ref - x) / width
  for (const dir of DIRS) {
    for (let s = 1; s <= BRIDGE_SPAN; s++) {
      const nx = (((x + dir[0] * s) % width) + width) % width
      const ny = (((y + dir[1] * s) % height) + height) % height
      const j = ny * width + nx
      if (!isLand(terrain, j)) continue // Wasser → Brücke möglich, weiter scannen
      if (isPassable(terrain, j) && getOwner(map, j) === owner) visit(j)
      break // Land (eigenes/fremdes/Berg) beendet den Scan in dieser Richtung
    }
  }
}

/**
 * Wie `forEachLandNeighbor`, aber OHNE Besitzer-Schranke: besucht jedes über Land (inkl. Brücken
 * ≤ BRIDGE_SPAN) erreichbare passierbare Tile, egal wem es gehört. Für Auslands-Wege (ADR-0019),
 * die über fremdes Gebiet zur fremden Fabrik führen dürfen.
 */
function forEachTerrainNeighbor(
  map: GameMap,
  ref: number,
  visit: (neighbor: number) => void,
): void {
  const { width, height, terrain } = map
  const x = ref % width
  const y = (ref - x) / width
  for (const dir of DIRS) {
    for (let s = 1; s <= BRIDGE_SPAN; s++) {
      const nx = (((x + dir[0] * s) % width) + width) % width
      const ny = (((y + dir[1] * s) % height) + height) % height
      const j = ny * width + nx
      if (!isLand(terrain, j)) continue // Wasser → Brücke möglich, weiter scannen
      if (isPassable(terrain, j)) visit(j)
      break // Land (passierbar/Berg) beendet den Scan in dieser Richtung
    }
  }
}

/**
 * Kürzester Land-Pfad (in Schritten) von `start` zu `goal` über BELIEBIGES passierbares Land
 * (inkl. Brücken), unabhängig vom Besitzer — für Auslands-Fuhren, die durch fremdes Gebiet zur
 * fremden Fabrik pendeln. Begrenzt auf `maxSteps` (sonst null) → bleibt billig, weil Auslands-
 * Ziele ohnehin nah liegen. Deterministisch (feste Nachbar-Reihenfolge, BFS).
 */
export function findTerrainPath(
  map: GameMap,
  start: number,
  goal: number,
  maxSteps: number,
): number[] | null {
  if (start === goal) return [start]
  const cameFrom = new Map<number, number>()
  const seen = new Set<number>([start])
  const dist = new Map<number, number>([[start, 0]])
  const queue: number[] = [start]
  let head = 0
  let found = false
  while (head < queue.length && !found) {
    const cur = queue[head++]
    if (cur === undefined) break
    const d = dist.get(cur) ?? 0
    if (d >= maxSteps) continue
    forEachTerrainNeighbor(map, cur, (j) => {
      if (seen.has(j)) return
      seen.add(j)
      cameFrom.set(j, cur)
      dist.set(j, d + 1)
      if (j === goal) found = true
      queue.push(j)
    })
  }
  if (!seen.has(goal)) return null
  const path: number[] = [goal]
  let c = goal
  while (c !== start) {
    const prev = cameFrom.get(c)
    if (prev === undefined) return null
    path.push(prev)
    c = prev
  }
  path.reverse()
  return path
}

/**
 * Labelt jedes Tile mit der ID seiner Owner-Land-Komponente. Tiles ohne eigenen Besitzer
 * (Wasser, Berge, Niemandsland) bekommen -1. Zwei Tiles in derselben Komponente sind über Land
 * (inkl. Brücken) verbunden.
 */
export function computeOwnerComponents(map: GameMap): Int32Array {
  const { width, height, terrain } = map
  const n = width * height
  const parent = new Int32Array(n)
  for (let i = 0; i < n; i++) parent[i] = i
  const find = (start: number): number => {
    let r = start
    while (parent[r] !== r) r = parent[r] ?? r
    let c = start
    while (parent[c] !== r) {
      const next = parent[c] ?? r
      parent[c] = r
      c = next
    }
    return r
  }
  const union = (a: number, b: number): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    if (ra < rb) parent[rb] = ra
    else parent[ra] = rb
  }

  for (let i = 0; i < n; i++) {
    if (!isPassable(terrain, i)) continue
    const owner = getOwner(map, i)
    if (owner <= 0) continue
    forEachLandNeighbor(map, i, owner, (j) => union(i, j))
  }

  const comp = new Int32Array(n).fill(-1)
  for (let i = 0; i < n; i++) {
    if (isPassable(terrain, i) && getOwner(map, i) > 0) comp[i] = find(i)
  }
  return comp
}

/** Sind die Tiles `a` und `b` in derselben Owner-Land-Komponente (beide besessen)? */
export function sameOwnerComponent(comp: Int32Array, a: number, b: number): boolean {
  const ca = comp[a]
  return ca !== undefined && ca >= 0 && ca === comp[b]
}

/**
 * Kürzester Land-Pfad (in Schritten) von `start` zu `goal` über eigenes Land inklusive Brücken,
 * als Tile-Liste mit Start und Ziel. `null`, wenn beide nicht in derselben Owner-Land-Komponente
 * liegen. BFS über dieselbe Topologie wie `computeOwnerComponents` (jede Kante = ein Schritt, eine
 * Brücke springt über das Wasser). Deterministisch (feste Nachbar-Reihenfolge).
 */
export function findLandPath(
  map: GameMap,
  comp: Int32Array,
  start: number,
  goal: number,
): number[] | null {
  if (!sameOwnerComponent(comp, start, goal)) return null
  if (start === goal) return [start]
  const owner = getOwner(map, start)
  const cameFrom = new Map<number, number>()
  const seen = new Set<number>([start])
  const queue: number[] = [start]
  let head = 0
  let found = false
  while (head < queue.length && !found) {
    const cur = queue[head++]
    if (cur === undefined) break
    forEachLandNeighbor(map, cur, owner, (j) => {
      if (seen.has(j)) return
      seen.add(j)
      cameFrom.set(j, cur)
      if (j === goal) found = true
      queue.push(j)
    })
  }
  if (!seen.has(goal)) return null
  const path: number[] = [goal]
  let c = goal
  while (c !== start) {
    const prev = cameFrom.get(c)
    if (prev === undefined) return null
    path.push(prev)
    c = prev
  }
  path.reverse()
  return path
}
