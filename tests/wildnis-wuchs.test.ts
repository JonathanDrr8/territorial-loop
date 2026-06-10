/**
 * Passiver Wildnis-Wuchs (2026-06-10): Wilde Nationen wachsen Tile für Tile in FREIES Land, bis
 * die Welt aufgeteilt ist (volle Karte „wie OpenFront"). Sichert: nur freies Land, fremdes Gebiet
 * bleibt unberührt, deterministisch, und das Tempo ist dichte-gekoppelt (Cache).
 */

import { describe, expect, it } from 'vitest'
import { createGame, initializeAllFrontiers, tick, type GameConfig } from '../src/core/game'
import { getOwner, setOwner } from '../src/world/map'
import { tileRef } from '../src/world/torus'

const W = 48
const H = 48
const T = (x: number, y: number): number => tileRef(x, y, W, H)

function cfg(seed: string): GameConfig {
  return {
    mapWidth: W,
    mapHeight: H,
    seed,
    victoryPct: 95,
    terrain: 'flat',
    players: [
      { id: 1, name: 'P1', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'Wild', color: 0x888888ff, isHuman: false, wild: true },
    ],
  }
}

/** Leert die Karte, setzt eine kleine Wilde (id 2) als 2×2-Block bei (cx,cy). */
function setup(state: ReturnType<typeof createGame>, cx: number, cy: number): void {
  for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
  for (const p of state.players.values()) {
    p.tilesOwned = 0
    p.weightedTiles = 0
    p.frontier = new Set<number>()
    p.troops = 0
  }
  const wild = state.players.get(2)
  if (wild === undefined) throw new Error('wild missing')
  for (let x = cx; x < cx + 2; x++) {
    for (let y = cy; y < cy + 2; y++) {
      setOwner(state.map, T(x, y), 2)
      wild.tilesOwned++
      wild.weightedTiles++
    }
  }
  initializeAllFrontiers(state)
}

describe('passiver Wildnis-Wuchs', () => {
  it('eine Wilde wächst in angrenzendes freies Land', () => {
    const state = createGame(cfg('grow-into-free'))
    setup(state, 20, 20)
    state.wildGrowthIntervalCache = 1 // jeden Tick eine Schicht (Test-Tempo)
    const before = state.players.get(2)?.tilesOwned ?? 0
    for (let t = 0; t < 5; t++) tick(state, [])
    const after = state.players.get(2)?.tilesOwned ?? 0
    expect(after).toBeGreaterThan(before) // ist gewachsen
  })

  it('wächst NICHT in fremdes Gebiet (nur herrenloses Land)', () => {
    const state = createGame(cfg('respect-owned'))
    setup(state, 20, 20)
    // Eine Wand aus Spieler-1-Tiles direkt rechts neben die Wilde setzen.
    const p1 = state.players.get(1)
    if (p1 === undefined) throw new Error('p1 missing')
    for (let y = 19; y <= 22; y++) {
      setOwner(state.map, T(22, y), 1)
      p1.tilesOwned++
      p1.weightedTiles++
    }
    initializeAllFrontiers(state)
    const p1Before = p1.tilesOwned
    state.wildGrowthIntervalCache = 1
    for (let t = 0; t < 10; t++) tick(state, [])
    // Spieler 1 hat KEIN Tile an die Wilde verloren (Wuchs nimmt nur Owner 0).
    expect(p1.tilesOwned).toBe(p1Before)
    // Die Wand-Tiles gehören weiterhin Spieler 1.
    expect(getOwner(state.map, T(22, 20))).toBe(1)
  })

  it('ist deterministisch (zwei Läufe → identische Wild-Fläche)', () => {
    const fill = (): number => {
      const state = createGame(cfg('determinism'))
      setup(state, 20, 20)
      state.wildGrowthIntervalCache = 2
      for (let t = 0; t < 20; t++) tick(state, [])
      return state.players.get(2)?.tilesOwned ?? 0
    }
    expect(fill()).toBe(fill())
  })

  it('Tempo ist dichte-gekoppelt: mehr Nationen → längeres Intervall (langsamer)', () => {
    // Über die echte (gecachte) Berechnung: dichter besiedelt → größeres Intervall.
    const sparse = createGame({
      ...cfg('sparse'),
      players: [
        { id: 1, name: 'P1', color: 0xff0000ff, isHuman: true },
        { id: 2, name: 'W', color: 0x888888ff, isHuman: false, wild: true },
      ],
    })
    const dense = createGame({
      ...cfg('dense'),
      players: [
        { id: 1, name: 'P1', color: 0xff0000ff, isHuman: true },
        ...Array.from({ length: 60 }, (_, i) => ({
          id: 2 + i,
          name: `W${String(i)}`,
          color: 0x888888ff,
          isHuman: false,
          wild: true,
        })),
      ],
    })
    // Ein Tick triggert die lazy Intervall-Berechnung (Cache).
    tick(sparse, [])
    tick(dense, [])
    const iSparse = sparse.wildGrowthIntervalCache ?? 0
    const iDense = dense.wildGrowthIntervalCache ?? 0
    expect(iSparse).toBeGreaterThan(0)
    expect(iDense).toBeGreaterThan(0)
    expect(iDense).toBeGreaterThan(iSparse) // mehr Nationen → langsameres Wachstum (gleiche Zielzeit)
  })
})
