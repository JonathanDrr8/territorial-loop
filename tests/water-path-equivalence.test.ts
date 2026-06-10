/**
 * Äquivalenztest für die A*-Scratch-Optimierung (Perf-Runde 2): `findWaterPath` mit
 * epoch-gestempelten Arrays MUSS bit-identische Pfade zur alten Map-Implementierung liefern —
 * über echte generierte Karten (continents/islands, mit Flüssen) und hunderte seeded
 * Start/Ziel-Paare (gleiche + verschiedene Komponenten, Land-Fälle, identische Tiles).
 * Schiffspfade sind sim-relevant (MP-Lockstep) — jede Abweichung wäre ein Determinismus-Bug.
 */

import { describe, expect, it } from 'vitest'
import { createGame, type GameConfig } from '../src/core/game'
import { findWaterPath } from '../src/world/water-path'
import { isLand } from '../src/world/terrain'
import { neighbors4 } from '../src/world/torus'
import type { GameMap } from '../src/world/map'

// ── Referenz: die ALTE Map-basierte Implementierung (vor der Scratch-Optimierung), 1:1 kopiert ──
function torusManhattan(a: number, b: number, w: number, h: number): number {
  const ax = a % w
  const ay = Math.floor(a / w)
  const bx = b % w
  const by = Math.floor(b / w)
  const dx0 = Math.abs(ax - bx)
  const dy0 = Math.abs(ay - by)
  return Math.min(dx0, w - dx0) + Math.min(dy0, h - dy0)
}

class RefMinHeap {
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

function refFindWaterPath(
  map: GameMap,
  start: number,
  goal: number,
  comp?: Int32Array,
  maxExpansions = 200_000,
): number[] | null {
  const { width, height, terrain } = map
  if (isLand(terrain, start) || isLand(terrain, goal)) return null
  if (start === goal) return [start]
  if (comp !== undefined) {
    const ca = comp[start]
    const cb = comp[goal]
    if (!(ca !== undefined && cb !== undefined && ca !== -1 && ca === cb)) return null
  }
  const gScore = new Map<number, number>()
  const cameFrom = new Map<number, number>()
  const open = new RefMinHeap()
  gScore.set(start, 0)
  open.push(torusManhattan(start, goal, width, height), start)
  let expansions = 0
  while (open.size > 0) {
    const current = open.pop()
    if (current === goal) {
      const path: number[] = [goal]
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

// Seeded LCG (kein Math.random — Projektregel) für die Paar-Auswahl.
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    return s / 0x100000000
  }
}

describe('findWaterPath — Scratch-Optimierung ist bit-identisch zur Map-Referenz', () => {
  const SCENARIOS: { seed: string; terrain: 'continents' | 'islands'; rivers?: boolean }[] = [
    { seed: 'equiv-a', terrain: 'continents' },
    { seed: 'equiv-b', terrain: 'islands' },
    { seed: 'equiv-c', terrain: 'continents', rivers: true },
  ]

  for (const sc of SCENARIOS) {
    it(`${sc.terrain}${sc.rivers === true ? '+rivers' : ''} (${sc.seed}): 220 Paare exakt gleich`, () => {
      const config: GameConfig = {
        mapWidth: 128,
        mapHeight: 128,
        seed: sc.seed,
        victoryPct: 90,
        terrain: sc.terrain,
        ...(sc.rivers === true ? { rivers: true } : {}),
        players: [{ id: 1, name: 'P', color: 0xff0000ff, isHuman: true }],
      }
      const state = createGame(config)
      const map = state.map
      const water: number[] = []
      for (let i = 0; i < map.state.length; i++) if (!isLand(map.terrain, i)) water.push(i)
      expect(water.length).toBeGreaterThan(100) // Vorbedingung: genug Wasser zum Testen

      const rnd = lcg(0xc0ffee)
      let nonTrivial = 0
      for (let k = 0; k < 220; k++) {
        const a = water[Math.floor(rnd() * water.length)] ?? water[0] ?? 0
        const b = water[Math.floor(rnd() * water.length)] ?? water[0] ?? 0
        const expected = refFindWaterPath(map, a, b, state.waterComponents)
        const actual = findWaterPath(map, a, b, state.waterComponents)
        expect(actual).toEqual(expected)
        if (expected !== null && expected.length > 2) nonTrivial++
      }
      expect(nonTrivial).toBeGreaterThan(50) // Vorbedingung: echte Pfade, nicht nur Trivial-Fälle

      // Randfälle: identisches Tile, Land als Start/Ziel, ohne comp-Filter.
      const w0 = water[0] ?? 0
      expect(findWaterPath(map, w0, w0)).toEqual(refFindWaterPath(map, w0, w0))
      let landTile = -1
      for (let i = 0; i < map.state.length; i++)
        if (isLand(map.terrain, i)) {
          landTile = i
          break
        }
      if (landTile >= 0) {
        expect(findWaterPath(map, landTile, w0)).toBeNull()
        expect(findWaterPath(map, w0, landTile)).toBeNull()
      }
      const w1 = water[Math.floor(water.length / 2)] ?? w0
      expect(findWaterPath(map, w0, w1)).toEqual(refFindWaterPath(map, w0, w1))
      // Budget-Abbruch: beide Varianten zählen Expansionen identisch → gleicher Abbruchpunkt.
      expect(findWaterPath(map, w0, w1, undefined, 10)).toEqual(
        refFindWaterPath(map, w0, w1, undefined, 10),
      )
    })
  }
})
