/**
 * Bridge-Test für den Mehrspieler-Worker (ADR-0030 Stufe 3, browser-frei).
 *
 * Verifiziert die Naht `WorkerNetTransport` + `createSimHost`: füttert man sie mit einer Folge
 * committeter Turns (wie es im echten MP der Hauptthread aus den Server-Commits tut), müssen die
 * gemeldeten State-Hashes (über `reportHash`) **turn-genau identisch** zu einem Referenzlauf sein, der
 * dieselben Turns direkt über `tick()` abspielt. Das sichert die Bridge-Logik (Commit→tick→Hash) ohne
 * einen echten Worker — der eigentliche Determinismus von `tick()` ist anderweitig (hash/replay) gedeckt.
 */
import { describe, expect, it } from 'vitest'

import { createGame, tick, type GameConfig } from '../src/core/game'
import { hashState } from '../src/core/hash'
import type { Intent } from '../src/core/intent'
import { getOwner } from '../src/world/map'
import { neighbors4 } from '../src/world/torus'
import { createSimHost } from '../src/worker/sim-host'
import { WorkerNetTransport } from '../src/worker/worker-transports'

function cfg(): GameConfig {
  return {
    mapWidth: 64,
    mapHeight: 64,
    seed: 'worker-net-test',
    victoryPct: 99,
    terrain: 'flat',
    players: [
      { id: 1, name: 'A', color: 0xff0000ff, isHuman: false },
      { id: 2, name: 'B', color: 0x00ff00ff, isHuman: false },
      { id: 3, name: 'C', color: 0x0000ffff, isHuman: false },
    ],
  }
}

/** Deterministischer Intent-Strom (Angriffe auf neutrale Grenz-Tiles) — aus dem Referenz-State berechnet. */
function turnIntents(ref: ReturnType<typeof createGame>, turn: number): Intent[] {
  const intents: Intent[] = []
  if (turn % 3 !== 0) return intents
  const { width, height } = ref.map
  for (const pid of [1, 2, 3]) {
    const p = ref.players.get(pid)
    if (p === undefined) continue
    let target = -1
    for (const f of p.frontier) {
      for (const n of neighbors4(f, width, height)) {
        if (getOwner(ref.map, n) === 0) {
          target = n
          break
        }
      }
      if (target >= 0) break
    }
    if (target >= 0)
      intents.push({ type: 'attack', playerId: pid, targetTile: target, troops: 800 })
  }
  return intents
}

describe('WorkerNetTransport + createSimHost — MP-Worker-Bridge (ADR-0030 Stufe 3)', () => {
  it('gemeldete Turn-Hashes sind identisch zum direkten tick()-Referenzlauf', () => {
    // Bridge-Pfad: createSimHost mit WorkerNetTransport, gefüttert per deliverCommit (wie der Worker).
    const reported: { turn: number; hash: number }[] = []
    const wnet = new WorkerNetTransport((turn, hash) => reported.push({ turn, hash }))
    const bridgeState = createGame(cfg())
    createSimHost({ state: bridgeState, ais: [], netTransport: wnet, intervalMs: 100 })

    // Referenz: identischer Start, dieselben Intents direkt durch tick().
    const ref = createGame(cfg())

    const N = 90
    for (let turn = 0; turn < N; turn++) {
      const intents = turnIntents(ref, turn)
      wnet.deliverCommit(turn, intents) // → createSimHost: record + tick + reportHash + onAfterTick
      tick(ref, intents)
      expect(reported[turn]?.turn).toBe(turn)
      expect(reported[turn]?.hash).toBe(hashState(ref))
    }
    expect(reported.length).toBe(N)
    // Und der im Bridge-Pfad getickte State ist bit-identisch zum Referenz-State.
    expect(hashState(bridgeState)).toBe(hashState(ref))
  })

  it('puffert Commits, die vor onCommitted eintreffen, und holt sie in Reihenfolge nach', () => {
    // deliverCommit VOR createSimHost (das onCommitted registriert) → muss gepuffert + nachgeholt werden.
    const reported: number[] = []
    const wnet = new WorkerNetTransport((turn) => reported.push(turn))
    const ref = createGame(cfg())
    const early0 = turnIntents(ref, 0)
    wnet.deliverCommit(0, early0) // früher Commit, noch kein Handler
    tick(ref, early0)
    createSimHost({ state: createGame(cfg()), ais: [], netTransport: wnet, intervalMs: 100 })
    // Beim Registrieren von onCommitted wird der gepufferte Turn 0 nachgeholt.
    expect(reported).toEqual([0])
  })
})
