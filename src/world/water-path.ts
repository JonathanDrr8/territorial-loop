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
 * Wiederverwendete A*-Scratch-Puffer (Perf): statt pro Aufruf zwei frische Maps zu füllen
 * (Hash-Kosten + GC-Druck — der Trade-Routen-Warmup auf großen Karten spike'te bis ~85 ms),
 * markiert ein Epochen-Stempel je Tile, ob sein Eintrag zum AKTUELLEN Aufruf gehört —
 * O(1)-„Leeren" ohne `fill()`. Semantik ist BIT-IDENTISCH zur Map-Variante (gleiche Vergleiche,
 * gleiche Heap-Reihenfolge → exakt dieselben Pfade; per Äquivalenztest abgesichert).
 *
 * Single-threaded sicher: die Puffer werden innerhalb EINES `findWaterPath`-Aufrufs benutzt
 * (Sim/Worker/Server ticken sequenziell). Größe folgt lazy der größten gesehenen Karte.
 */
let scratchEpoch = 0
let scratchStamp = new Int32Array(0)
let scratchG = new Int32Array(0)
let scratchFrom = new Int32Array(0)

function ensureScratch(n: number): void {
  if (scratchStamp.length < n) {
    scratchStamp = new Int32Array(n)
    scratchG = new Int32Array(n)
    scratchFrom = new Int32Array(n)
    scratchEpoch = 0
  }
  scratchEpoch++
  if (scratchEpoch === 0x7fffffff) {
    // Epoch-Überlauf (praktisch unerreichbar): Stempel zurücksetzen und neu beginnen.
    scratchStamp.fill(0)
    scratchEpoch = 1
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

  ensureScratch(width * height)
  const epoch = scratchEpoch
  const open = new MinHeap()
  // gScore(start) = 0; start hat keinen Vorgänger (-1 = Pfad-Anfang beim Rekonstruieren).
  scratchG[start] = 0
  scratchFrom[start] = -1
  scratchStamp[start] = epoch
  open.push(torusManhattan(start, goal, width, height), start)

  let expansions = 0
  while (open.size > 0) {
    const current = open.pop()
    if (current === goal) return reconstruct(current)
    if (++expansions > maxExpansions) return null

    // Entspricht `gScore.get(current) ?? Infinity` — current ist immer gestempelt (wurde gepusht).
    const cg = scratchStamp[current] === epoch ? (scratchG[current] ?? 0) : Infinity
    for (const nb of neighbors4(current, width, height)) {
      if (isLand(terrain, nb)) continue
      const tentative = cg + 1
      const known = scratchStamp[nb] === epoch ? (scratchG[nb] ?? 0) : Infinity
      if (tentative < known) {
        scratchFrom[nb] = current
        scratchG[nb] = tentative
        scratchStamp[nb] = epoch
        open.push(tentative + torusManhattan(nb, goal, width, height), nb)
      }
    }
  }
  return null
}

function reconstruct(goal: number): TileRef[] {
  const path: TileRef[] = [goal]
  let cur = goal
  for (;;) {
    const prev = scratchFrom[cur] ?? -1
    if (prev < 0) break
    path.push(prev)
    cur = prev
  }
  path.reverse()
  return path
}
