import { describe, it, expect } from 'vitest'
import { createGame, tick, type GameConfig, type GameState } from '../src/core/game'
import {
  pairKey,
  directedKey,
  areAllied,
  isTradeBlocked,
  AECHTUNG_DURATION_TICKS,
  ALLIANCE_DURATION_TICKS,
} from '../src/core/diplomacy'
import { getOwner, setOwner } from '../src/world/map'
import { tileRef } from '../src/world/torus'

const W = 12
const H = 6

function cfg(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mapWidth: W,
    mapHeight: H,
    seed: 'diplo-test',
    victoryPct: 90,
    terrain: 'flat',
    players: [
      { id: 1, name: 'Eins', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'Zwei', color: 0x00ff00ff, isHuman: false },
      { id: 3, name: 'Drei', color: 0x0000ffff, isHuman: false },
    ],
    ...overrides,
  }
}

/** Setzt Besitz zurück und gibt jedem Spieler ein bekanntes Layout. */
function reset(state: GameState): void {
  for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 0)
  for (const p of state.players.values()) {
    p.tilesOwned = 0
    p.frontier = new Set<number>()
    p.attacks = []
  }
}

function own(state: GameState, x: number, y: number, playerId: number): number {
  const ref = tileRef(x, y, W, H)
  setOwner(state.map, ref, playerId)
  const p = state.players.get(playerId)
  if (p !== undefined) {
    p.tilesOwned++
    p.frontier.add(ref)
  }
  return ref
}

describe('diplomacy key helpers', () => {
  it('pairKey is unordered, directedKey is ordered', () => {
    expect(pairKey(2, 5)).toBe(pairKey(5, 2))
    expect(directedKey(2, 5)).not.toBe(directedKey(5, 2))
  })

  it('areAllied / isTradeBlocked read the sets correctly', () => {
    const alliances = new Set<number>([pairKey(1, 2)])
    expect(areAllied(alliances, 1, 2)).toBe(true)
    expect(areAllied(alliances, 2, 1)).toBe(true)
    expect(areAllied(alliances, 1, 3)).toBe(false)
    const embargoes = new Set<number>([directedKey(1, 2)])
    expect(isTradeBlocked(embargoes, 1, 2)).toBe(true)
    expect(isTradeBlocked(embargoes, 2, 1)).toBe(true) // einseitig blockt beidseitig
    expect(isTradeBlocked(embargoes, 1, 3)).toBe(false)
  })
})

describe('alliance lifecycle', () => {
  it('forms an alliance via request + accept', () => {
    const state = createGame(cfg())
    tick(state, [{ type: 'request-alliance', playerId: 1, targetPlayerId: 2 }])
    expect(areAllied(state.alliances, 1, 2)).toBe(false) // nur Anfrage
    tick(state, [{ type: 'accept-alliance', playerId: 2, targetPlayerId: 1 }])
    expect(areAllied(state.alliances, 1, 2)).toBe(true)
  })

  it('forms an alliance instantly on mutual requests', () => {
    const state = createGame(cfg())
    tick(state, [{ type: 'request-alliance', playerId: 1, targetPlayerId: 2 }])
    tick(state, [{ type: 'request-alliance', playerId: 2, targetPlayerId: 1 }])
    expect(areAllied(state.alliances, 1, 2)).toBe(true)
  })

  it('läuft nach ALLIANCE_DURATION_TICKS automatisch aus', () => {
    const state = createGame(cfg())
    tick(state, [{ type: 'request-alliance', playerId: 1, targetPlayerId: 2 }])
    tick(state, [{ type: 'accept-alliance', playerId: 2, targetPlayerId: 1 }])
    expect(areAllied(state.alliances, 1, 2)).toBe(true)
    // kurz vor Ablauf noch verbündet
    for (let i = 0; i < ALLIANCE_DURATION_TICKS - 2; i++) tick(state, [])
    expect(areAllied(state.alliances, 1, 2)).toBe(true)
    // nach Ablauf nicht mehr
    for (let i = 0; i < 4; i++) tick(state, [])
    expect(areAllied(state.alliances, 1, 2)).toBe(false)
    expect(state.allianceExpiry.size).toBe(0)
  })

  it('blocks attacks between allies', () => {
    const state = createGame(cfg())
    reset(state)
    own(state, 1, 1, 1)
    const allyTile = own(state, 2, 1, 2)
    const p1 = state.players.get(1)
    if (p1 === undefined) throw new Error('no p1')
    p1.troops = 1000
    // verbünden
    tick(state, [{ type: 'request-alliance', playerId: 1, targetPlayerId: 2 }])
    tick(state, [{ type: 'accept-alliance', playerId: 2, targetPlayerId: 1 }])
    // Angriff auf Verbündeten wird abgelehnt
    tick(state, [{ type: 'attack', playerId: 1, targetTile: allyTile, troops: 1000 }])
    expect(p1.attacks.length).toBe(0)
    expect(getOwner(state.map, allyTile)).toBe(2)
  })
})

describe('betrayal (Ächtung)', () => {
  it('break-alliance flags the traitor for the ächtung window', () => {
    const state = createGame(cfg())
    tick(state, [{ type: 'request-alliance', playerId: 1, targetPlayerId: 2 }])
    tick(state, [{ type: 'accept-alliance', playerId: 2, targetPlayerId: 1 }])
    const tickAtBreak = state.tick
    tick(state, [{ type: 'break-alliance', playerId: 1, targetPlayerId: 2 }])
    expect(areAllied(state.alliances, 1, 2)).toBe(false)
    const traitor = state.players.get(1)
    if (traitor === undefined) throw new Error('no traitor')
    expect(traitor.traitorUntil).toBe(tickAtBreak + AECHTUNG_DURATION_TICKS)
  })

  it('halves attacker losses against a traitor (defends weaker vs uninvolved nations)', () => {
    // Zwei identische Läufe, nur der Verteidiger ist im zweiten ein Verräter.
    function runAttackOnce(makeTraitor: boolean): number {
      const state = createGame(cfg())
      reset(state)
      // Angreifer (3) besitzt Spalte x=4, Verteidiger (2) Spalte x=5
      for (let y = 0; y < H; y++) own(state, 4, y, 3)
      for (let y = 0; y < H; y++) own(state, 5, y, 2)
      const attacker = state.players.get(3)
      const defender = state.players.get(2)
      if (attacker === undefined || defender === undefined) throw new Error('missing')
      attacker.troops = 50_000
      defender.troops = 30_000
      if (makeTraitor) defender.traitorUntil = state.tick + 1000
      tick(state, [
        { type: 'attack', playerId: 3, targetTile: tileRef(5, 0, W, H), troops: 50_000 },
      ])
      const atk = attacker.attacks[0]
      return atk?.reserveTroops ?? 0
    }
    const normalReserve = runAttackOnce(false)
    const traitorReserve = runAttackOnce(true)
    // Gegen den Verräter verliert der Angreifer weniger → mehr Reserve übrig.
    expect(traitorReserve).toBeGreaterThan(normalReserve)
  })
})

describe('embargo toggle', () => {
  it('set-embargo intent adds and removes the directed embargo', () => {
    const state = createGame(cfg())
    expect(isTradeBlocked(state.embargoes, 1, 2)).toBe(false)
    tick(state, [{ type: 'set-embargo', playerId: 1, targetPlayerId: 2, enabled: true }])
    expect(isTradeBlocked(state.embargoes, 1, 2)).toBe(true)
    tick(state, [{ type: 'set-embargo', playerId: 1, targetPlayerId: 2, enabled: false }])
    expect(isTradeBlocked(state.embargoes, 1, 2)).toBe(false)
  })
})
