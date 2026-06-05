/**
 * Regressionstest (Kern-Risiko-Audit 2026-06-05): Eine Bomben-Neutralisierung neutralisiert
 * Tiles über `captureTile(state, ref, 0)`, was `updateFrontierAfterCapture(..., newOwner = 0)`
 * aufruft. FRÜHER brach diese Funktion bei `newOwner === 0` mit einem early-return ab, BEVOR die
 * Nachbar-Neubewertung lief. Folge:
 *   1. Spür­barer Gameplay-Bug: ein eingeschlossener Bomben-Krater ließ sich nicht einnehmen,
 *      weil die Krater-Rand-Tiles nie in die Frontier kamen (collectAttackableTiles iteriert die
 *      Frontier → der Krater war für den Spieler „unsichtbar").
 *   2. Versteckter MP-Desync: die inkrementell gepflegte Frontier wich von der über
 *      `initializeAllFrontiers` rekonstruierten ab. Da `frontier` weder serialisiert noch gehasht
 *      wird, blieb die Divergenz bis zur nächsten Eroberung unsichtbar und schlug erst nach einem
 *      Reconnect/Resync als Hash-Mismatch durch.
 *
 * Dieser Test geht durch den ECHTEN Pfad (setOwner → updateFrontierAfterCapture, genau wie
 * captureTile) — anders als ai-crater.test.ts, das die Frontier manuell korrekt aufbaut und den
 * Bug daher nie traf.
 */

import { describe, expect, it } from 'vitest'
import {
  createGame,
  initializeAllFrontiers,
  updateFrontierAfterCapture,
  type GameConfig,
  type GameState,
} from '../src/core/game'
import { getOwner, setOwner } from '../src/world/map'
import { tileRef } from '../src/world/torus'

const W = 64
const H = 64
const T = (x: number, y: number): number => tileRef(x, y, W, H)
const CRATER = T(10, 10)
const CRATER_NEIGHBORS = [T(11, 10), T(9, 10), T(10, 11), T(10, 9)]

function config(): GameConfig {
  return {
    mapWidth: W,
    mapHeight: H,
    seed: 'bomb-frontier-test',
    victoryPct: 90,
    terrain: 'flat',
    players: [
      { id: 1, name: 'P', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'Q', color: 0x00ff00ff, isHuman: false },
    ],
  }
}

/** Spieler 1 besitzt einen massiven 5×5-Block; Frontier sauber via initializeAllFrontiers. */
function setupBlock(): GameState {
  const state = createGame(config())
  for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
  for (const p of state.players.values()) {
    p.tilesOwned = 0
    p.frontier = new Set<number>()
  }
  const p1 = state.players.get(1)
  if (p1 === undefined) throw new Error('player 1 missing')
  for (let y = 8; y <= 12; y++)
    for (let x = 8; x <= 12; x++) {
      setOwner(state.map, T(x, y), 1)
      p1.tilesOwned++
    }
  initializeAllFrontiers(state)
  return state
}

/** Bomben-Pfad nachbilden: Owner → 0, dann updateFrontierAfterCapture (exakt wie captureTile). */
function bombTile(state: GameState, ref: number): void {
  const oldOwner = getOwner(state.map, ref)
  setOwner(state.map, ref, 0)
  updateFrontierAfterCapture(state, ref, oldOwner, 0)
}

const sorted = (s: Set<number>): number[] => [...s].sort((a, b) => a - b)

describe('Bomben-Krater hält die Frontier konsistent (Audit-Fix)', () => {
  it('CRATER ist vor der Bombe ein reines Innen-Tile (nicht in der Frontier)', () => {
    const state = setupBlock()
    expect(state.players.get(1)?.frontier.has(CRATER)).toBe(false)
  })

  it('nach der Neutralisierung sind die Krater-Nachbarn in P1.frontier (Krater einnehmbar)', () => {
    const state = setupBlock()
    bombTile(state, CRATER)
    const p1 = state.players.get(1)
    if (p1 === undefined) throw new Error('player 1 missing')
    for (const n of CRATER_NEIGHBORS) {
      expect(p1.frontier.has(n)).toBe(true)
    }
  })

  it('inkrementelle Frontier == frische initializeAllFrontiers nach der Bombe', () => {
    const state = setupBlock()
    bombTile(state, CRATER)

    // inkrementell gepflegte Frontier sichern, dann frisch rekonstruieren und vergleichen
    const incremental = new Map<number, number[]>(
      [...state.players].map(([id, p]) => [id, sorted(p.frontier)]),
    )
    for (const p of state.players.values()) p.frontier = new Set<number>()
    initializeAllFrontiers(state)
    for (const [id, p] of state.players) {
      expect(incremental.get(id)).toEqual(sorted(p.frontier))
    }
  })
})
