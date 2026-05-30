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
    const x = i % width
    const y = (i - x) / width
    for (const dir of DIRS) {
      const dx = dir[0]
      const dy = dir[1]
      // Vom Tile aus geradeaus: das ERSTE Land-Tile beendet den Scan. Ist es eigenes passierbares
      // Land (direkt benachbart oder über ≤ BRIDGE_SPAN-1 Wasser-Tiles = Brücke), wird verbunden.
      for (let s = 1; s <= BRIDGE_SPAN; s++) {
        const nx = (((x + dx * s) % width) + width) % width
        const ny = (((y + dy * s) % height) + height) % height
        const j = ny * width + nx
        if (!isLand(terrain, j)) continue // Wasser → Brücke möglich, weiter scannen
        if (isPassable(terrain, j) && getOwner(map, j) === owner) union(i, j)
        break // Land (eigenes/fremdes/Berg) beendet den Scan in dieser Richtung
      }
    }
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
