/**
 * Wasser-Topologie für Schiffe: Komponenten-Labeling + A*-Pfadsuche.
 *
 * Schiffe bewegen sich ausschließlich über Wasser-Tiles (`!isLand`). Zwei
 * Fragen müssen schnell beantwortbar sein:
 *
 *  1. „Gibt es überhaupt eine Wasserroute zwischen A und B?" — O(1) über
 *     vorberechnete Zusammenhangskomponenten (`labelWaterComponents`). Wasser
 *     ändert sich nie, also einmalig bei `createGame` berechnet.
 *  2. „Wie sieht die konkrete Route aus?" — A* (`findWaterPath`), Torus-aware,
 *     orthogonale Bewegung (neighbors4).
 *
 * Alles deterministisch: feste Nachbar-Reihenfolge, keine `Math.random`.
 */

import { isLand, isPassable } from './terrain'
import type { GameMap } from './map'
import { neighbors4, type TileRef } from './torus'

/** Tiles ohne Komponente (z.B. Land bei Wasser-Labeling) bekommen diese Markierung. */
export const NO_COMPONENT = -1

/**
 * Generisches Flood-Fill-Labeling: vergibt pro Zusammenhangskomponente der
 * Tiles, für die `member(ref)` gilt, eine ID (0,1,2,…). Andere Tiles erhalten
 * `NO_COMPONENT`. Torus-aware (neighbors4).
 */
function labelComponents(map: GameMap, member: (ref: number) => boolean): Int32Array {
  const { width, height } = map
  const n = width * height
  const comp = new Int32Array(n).fill(NO_COMPONENT)
  const stack: number[] = []
  let next = 0

  for (let start = 0; start < n; start++) {
    if (!member(start)) continue
    if (comp[start] !== NO_COMPONENT) continue
    const id = next++
    comp[start] = id
    stack.length = 0
    stack.push(start)
    while (stack.length > 0) {
      const ref = stack.pop()
      if (ref === undefined) break
      for (const nb of neighbors4(ref, width, height)) {
        if (!member(nb)) continue
        if (comp[nb] !== NO_COMPONENT) continue
        comp[nb] = id
        stack.push(nb)
      }
    }
  }
  return comp
}

/**
 * Flutet alle Wasser-Tiles (`!isLand`) und vergibt pro Zusammenhangskomponente
 * eine ID. Land-Tiles erhalten `NO_COMPONENT`. Wasser ändert sich nie → einmalig.
 */
export function labelWaterComponents(map: GameMap): Int32Array {
  return labelComponents(map, (ref) => !isLand(map.terrain, ref))
}

/**
 * Komponenten der begehbaren Land-Tiles (`isPassable`). Zwei begehbare Gebiete,
 * die nur über Wasser oder unpassierbare Berge verbunden sind, liegen in
 * verschiedenen Komponenten — genau dann braucht ein Angriff ein Transport-Boot.
 */
export function labelLandComponents(map: GameMap): Int32Array {
  return labelComponents(map, (ref) => isPassable(map.terrain, ref))
}

/** Wahr, wenn beide Tiles Wasser sind und in derselben Komponente liegen. */
export function sameWaterComponent(comp: Int32Array, a: TileRef, b: TileRef): boolean {
  const ca = comp[a]
  const cb = comp[b]
  return ca !== undefined && cb !== undefined && ca !== NO_COMPONENT && ca === cb
}

/** Liefert ein an `landTile` angrenzendes Wasser-Tile (neighbors4) oder -1. */
export function coastalWater(map: GameMap, landTile: TileRef): TileRef {
  for (const nb of neighbors4(landTile, map.width, map.height)) {
    if (!isLand(map.terrain, nb)) return nb
  }
  return -1
}

/**
 * Für ein Land-Tile: pro angrenzender Wasser-Komponente ein repräsentatives
 * Wasser-Tile. Ein Küsten-Tile kann an mehrere getrennte Meere grenzen — so
 * lässt sich für eine Route die passende gemeinsame Komponente wählen.
 */
export function adjacentWaterByComponent(
  map: GameMap,
  comp: Int32Array,
  landTile: TileRef,
): Map<number, TileRef> {
  const result = new Map<number, TileRef>()
  for (const nb of neighbors4(landTile, map.width, map.height)) {
    if (isLand(map.terrain, nb)) continue
    const c = comp[nb]
    if (c === undefined || c === NO_COMPONENT) continue
    if (!result.has(c)) result.set(c, nb)
  }
  return result
}

/** Torus-Manhattan-Distanz (zulässige A*-Heuristik bei orthogonaler Bewegung). */
function torusManhattan(a: TileRef, b: TileRef, w: number, h: number): number {
  const ax = a % w
  const ay = Math.floor(a / w)
  const bx = b % w
  const by = Math.floor(b / w)
  const dx0 = Math.abs(ax - bx)
  const dy0 = Math.abs(ay - by)
  return Math.min(dx0, w - dx0) + Math.min(dy0, h - dy0)
}

/** Binärer Min-Heap auf (fScore, tile)-Paaren. */
class MinHeap {
  private readonly fs: number[] = []
  private readonly ts: number[] = []
  get size(): number {
    return this.ts.length
  }
  push(f: number, t: number): void {
    this.fs.push(f)
    this.ts.push(t)
    let i = this.ts.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      const pf = this.fs[parent]
      const cf = this.fs[i]
      if (pf === undefined || cf === undefined || pf <= cf) break
      this.swap(i, parent)
      i = parent
    }
  }
  pop(): number {
    const top = this.ts[0]
    const lastT = this.ts.pop()
    const lastF = this.fs.pop()
    if (top === undefined || lastT === undefined || lastF === undefined) return -1
    if (this.ts.length > 0) {
      this.ts[0] = lastT
      this.fs[0] = lastF
      this.siftDown(0)
    }
    return top
  }
  private siftDown(start: number): void {
    let i = start
    for (;;) {
      const l = 2 * i + 1
      const r = 2 * i + 2
      let smallest = i
      const sf = this.fs[smallest]
      const lf = this.fs[l]
      const rf = this.fs[r]
      if (lf !== undefined && sf !== undefined && lf < sf) smallest = l
      const sf2 = this.fs[smallest]
      if (rf !== undefined && sf2 !== undefined && rf < sf2) smallest = r
      if (smallest === i) break
      this.swap(i, smallest)
      i = smallest
    }
  }
  private swap(a: number, b: number): void {
    const tf = this.fs[a]
    const tt = this.ts[a]
    const of = this.fs[b]
    const ot = this.ts[b]
    if (tf === undefined || tt === undefined || of === undefined || ot === undefined) return
    this.fs[a] = of
    this.ts[a] = ot
    this.fs[b] = tf
    this.ts[b] = tt
  }
}

/**
 * A*-Pfad über Wasser-Tiles von `start` nach `goal` (beides Wasser-Tiles,
 * inklusive). Liefert die Tile-Folge oder `null` wenn keine Route existiert
 * (oder das Expansions-Budget überschritten wird).
 *
 * `comp` ist optional — wird es übergeben, scheitert die Suche sofort (O(1))
 * wenn start/goal in verschiedenen Komponenten liegen.
 */
export function findWaterPath(
  map: GameMap,
  start: TileRef,
  goal: TileRef,
  comp?: Int32Array,
  maxExpansions = 200_000,
): TileRef[] | null {
  const { width, height, terrain } = map
  if (isLand(terrain, start) || isLand(terrain, goal)) return null
  if (start === goal) return [start]
  if (comp !== undefined && !sameWaterComponent(comp, start, goal)) return null

  const gScore = new Map<number, number>()
  const cameFrom = new Map<number, number>()
  const open = new MinHeap()
  gScore.set(start, 0)
  open.push(torusManhattan(start, goal, width, height), start)

  let expansions = 0
  while (open.size > 0) {
    const current = open.pop()
    if (current === goal) return reconstruct(cameFrom, current)
    if (++expansions > maxExpansions) return null

    const cg = gScore.get(current) ?? Infinity
    for (const nb of neighbors4(current, width, height)) {
      if (isLand(terrain, nb)) continue
      const tentative = cg + 1
      if (tentative < (gScore.get(nb) ?? Infinity)) {
        cameFrom.set(nb, current)
        gScore.set(nb, tentative)
        open.push(tentative + torusManhattan(nb, goal, width, height), nb)
      }
    }
  }
  return null
}

function reconstruct(cameFrom: Map<number, number>, goal: number): TileRef[] {
  const path: TileRef[] = [goal]
  let cur = goal
  for (;;) {
    const prev = cameFrom.get(cur)
    if (prev === undefined) break
    path.push(prev)
    cur = prev
  }
  path.reverse()
  return path
}
