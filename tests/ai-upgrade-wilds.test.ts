/**
 * KI-Wirtschafts-Tiefe + Umgang mit wilden Nationen:
 *  - Die KI wertet bestehende Gebäude auf, wenn nichts Neues zu bauen ist (planUpgrade).
 *  - Beim Expandieren bevorzugt sie wilde Nachbarn vor leerem Neutralland (Zielwahl).
 *  - Kleine, von einem Spieler dominierte wilde Reste werden aufgeräumt (Mop-up-Annektierung),
 *    große bzw. nicht dominierte wilde Reste bleiben bestehen.
 */

import { describe, expect, it } from 'vitest'
import { createGame, initializeAllFrontiers, tick, type GameConfig } from '../src/core/game'
import { createAI } from '../src/ai/ai'
import { getOwner, setOwner } from '../src/world/map'
import { tileRef } from '../src/world/torus'
import type { Intent } from '../src/core/intent'

const W = 64
const H = 64
const T = (x: number, y: number): number => tileRef(x, y, W, H)

function blankConfig(extra: Partial<GameConfig> = {}): GameConfig {
  return {
    mapWidth: W,
    mapHeight: H,
    seed: 'ai-upgrade-wilds',
    victoryPct: 95,
    terrain: 'flat',
    players: [
      { id: 1, name: 'P1', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'AI', color: 0x00ff00ff, isHuman: false },
      { id: 3, name: 'Wild', color: 0x888888ff, isHuman: false, wild: true },
    ],
    ...extra,
  }
}

/** Setzt ALLE Tiles auf neutral und leert die Spieler (frontier/troops/tiles). */
function clear(state: ReturnType<typeof createGame>): void {
  for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
  for (const p of state.players.values()) {
    p.tilesOwned = 0
    p.weightedTiles = 0
    p.frontier = new Set<number>()
    p.attacks = []
    p.troops = 0
    p.gold = 0
  }
}

describe('KI: Gebäude-Upgrades (planUpgrade)', () => {
  it('wertet ein bestehendes Gebäude auf, wenn nichts Neues zu bauen ist', () => {
    // Alle Neubauten verboten → planBuild liefert immer null → die KI muss upgraden.
    const state = createGame(
      blankConfig({
        seed: 'upgrade-only',
        allowedBuildings: {
          city: false,
          port: false,
          factory: false,
          airport: false,
          defense: false,
          flak: false,
        },
      }),
    )
    clear(state)
    const ai = state.players.get(2)
    const p1 = state.players.get(1)
    if (ai === undefined || p1 === undefined) throw new Error('players missing')
    // KI bekommt ein 5×5-Gebiet + viel Gold, P1 sitzt weit weg (bleibt am Leben, stört nicht).
    for (let y = 8; y <= 12; y++) {
      for (let x = 8; x <= 12; x++) {
        setOwner(state.map, T(x, y), 2)
        ai.tilesOwned++
        ai.weightedTiles++
      }
    }
    setOwner(state.map, T(50, 50), 1)
    p1.tilesOwned = 1
    initializeAllFrontiers(state)
    ai.troops = 2000
    ai.gold = 2_000_000
    const cityTile = T(10, 10)
    state.buildings.set(cityTile, {
      type: 'city',
      ownerId: 2,
      tile: cityTile,
      level: 1,
      completesAtTick: 0,
      buildPrice: 25_000,
    })

    const bot = createAI(2, state.seed, 'expert')
    let upgraded = false
    for (let t = 0; t < 600 && !upgraded; t++) {
      const intents = bot.decide(state)
      if (intents.some((i) => i.type === 'upgrade' && i.tile === cityTile)) upgraded = true
      tick(state, intents)
    }
    expect(upgraded).toBe(true)
    expect(state.buildings.get(cityTile)?.level ?? 0).toBeGreaterThan(1)
  })
})

describe('KI: Zielwahl gegen wilde Nationen', () => {
  it('greift beim Expandieren bevorzugt wilde Nachbarn an statt leeres Neutralland', () => {
    const state = createGame(blankConfig({ seed: 'wild-target' }))
    clear(state)
    const ai = state.players.get(2)
    const wild = state.players.get(3)
    const p1 = state.players.get(1)
    if (ai === undefined || wild === undefined || p1 === undefined)
      throw new Error('players missing')
    // KI (2): Säule x=10, y=10..14. Rechts daneben wildes Land (20 Tiles > Mop-up-Grenze, bleibt
    // bestehen), links offenes Neutralland (x=9). Wenig Truppen → Expansions-Modus.
    for (let y = 10; y <= 14; y++) {
      setOwner(state.map, T(10, y), 2)
      ai.tilesOwned++
      ai.weightedTiles++
    }
    for (let x = 11; x <= 14; x++) {
      for (let y = 10; y <= 14; y++) {
        setOwner(state.map, T(x, y), 3)
        wild.tilesOwned++
        wild.weightedTiles++
      }
    }
    setOwner(state.map, T(50, 50), 1)
    p1.tilesOwned = 1
    initializeAllFrontiers(state)
    ai.troops = 100 // weit unter Cap → preferEnemies = false (expandiert)

    const bot = createAI(2, state.seed, 'standard')
    let firstTargetWasWild: boolean | null = null
    for (let t = 0; t < 250 && firstTargetWasWild === null; t++) {
      const intents = bot.decide(state)
      const atk = intents.find(
        (i): i is Extract<Intent, { type: 'attack' }> => i.type === 'attack' && i.playerId === 2,
      )
      if (atk !== undefined) firstTargetWasWild = getOwner(state.map, atk.targetTile) === 3
      tick(state, intents)
    }
    expect(firstTargetWasWild).toBe(true)
  })
})

describe('Mop-up: kleine, dominierte wilde Reste aufräumen', () => {
  /** Wild (3) als 2×3-Block (6 Tiles) ab (10,10); umliegende Perimeter-Tiles werden gesetzt. */
  function setupSmallWild(
    state: ReturnType<typeof createGame>,
    perimeterOwner: (x: number, y: number) => number,
  ): void {
    clear(state)
    const wild = state.players.get(3)
    if (wild === undefined) throw new Error('wild missing')
    const block: Array<[number, number]> = []
    for (let x = 10; x <= 11; x++) for (let y = 10; y <= 12; y++) block.push([x, y])
    for (const [x, y] of block) {
      setOwner(state.map, T(x, y), 3)
      wild.tilesOwned++
      wild.weightedTiles++
    }
    // Perimeter (alle 4er-Nachbarn außerhalb des Blocks) nach Vorgabe besetzen.
    const perim: Array<[number, number]> = [
      [10, 9],
      [11, 9],
      [9, 10],
      [9, 11],
      [9, 12],
      [12, 10],
      [12, 11],
      [12, 12],
      [10, 13],
      [11, 13],
    ]
    for (const [x, y] of perim) {
      const o = perimeterOwner(x, y)
      if (o > 0) {
        setOwner(state.map, T(x, y), o)
        const p = state.players.get(o)
        if (p !== undefined) p.tilesOwned++
      }
    }
    initializeAllFrontiers(state)
    for (const p of state.players.values()) p.troops = 1000
  }

  function tickUntilAnnexedOrGiveUp(state: ReturnType<typeof createGame>): void {
    for (let t = 0; t < 30; t++) tick(state, [])
  }

  it('kleiner wilder Rest, dessen Grenze ein Spieler dominiert, wird annektiert (mit Fluchtweg)', () => {
    const state = createGame(blankConfig({ seed: 'mopup-yes' }))
    // (10,9) bleibt neutral (Fluchtweg), alle übrigen 9 Perimeter-Tiles gehören P1 → 90% Dominanz.
    setupSmallWild(state, (x, y) => (x === 10 && y === 9 ? 0 : 1))
    expect(state.players.get(3)?.tilesOwned).toBe(6)
    tickUntilAnnexedOrGiveUp(state)
    expect(state.players.get(3)?.tilesOwned ?? 0).toBe(0) // wild aufgeräumt
    expect(state.players.get(3)?.isAlive).toBe(false)
    // Die 6 Tiles gehören jetzt P1.
    expect(getOwner(state.map, T(10, 10))).toBe(1)
  })

  it('kleiner wilder Rest ohne dominanten Nachbarn überlebt (nur Neutralland ringsum)', () => {
    const state = createGame(blankConfig({ seed: 'mopup-no-dom' }))
    setupSmallWild(state, () => 0) // alles ringsum neutral
    tickUntilAnnexedOrGiveUp(state)
    expect(state.players.get(3)?.tilesOwned).toBe(6) // unverändert
    expect(state.players.get(3)?.isAlive).toBe(true)
  })

  it('großer wilder Rest (> Mop-up-Grenze) wird NICHT aufgeräumt, auch wenn dominiert', () => {
    const state = createGame(blankConfig({ seed: 'mopup-too-big' }))
    clear(state)
    const wild = state.players.get(3)
    const p1 = state.players.get(1)
    if (wild === undefined || p1 === undefined) throw new Error('players missing')
    // Wild als 4×4-Block (16 Tiles > 10) ab (10,10).
    for (let x = 10; x <= 13; x++) {
      for (let y = 10; y <= 13; y++) {
        setOwner(state.map, T(x, y), 3)
        wild.tilesOwned++
        wild.weightedTiles++
      }
    }
    // P1 ringsum bis auf eine Öffnung (9,10) → dominiert, aber zu groß für Mop-up.
    const perim: Array<[number, number]> = []
    for (let x = 10; x <= 13; x++) {
      perim.push([x, 9], [x, 14])
    }
    for (let y = 10; y <= 13; y++) {
      perim.push([9, y], [14, y])
    }
    for (const [x, y] of perim) {
      if (x === 9 && y === 10) continue // Fluchtweg
      setOwner(state.map, T(x, y), 1)
      p1.tilesOwned++
    }
    initializeAllFrontiers(state)
    for (const p of state.players.values()) p.troops = 1000
    for (let t = 0; t < 30; t++) tick(state, [])
    expect(state.players.get(3)?.tilesOwned).toBe(16) // bleibt (Mop-up nur für kleine Reste)
  })
})
