import { describe, expect, it } from 'vitest'

import type { Intent } from '../src/core/intent'
import { LocalTransport } from '../src/net/transport'

/** Bau-Intent-Stub (Typ egal — der Transport behandelt Intents opak). */
function attack(playerId: number, tile: number): Intent {
  return { type: 'attack', playerId, targetTile: tile, troops: 1 }
}

describe('LocalTransport', () => {
  it('bündelt eingereichte Intents pro Turn und committet sie', () => {
    const commits: { turn: number; intents: readonly Intent[] }[] = []
    const t = new LocalTransport({
      produceServerIntents: () => [],
      intervalMs: 100,
      running: true,
    })
    t.onCommitted((turn, intents) => commits.push({ turn, intents }))

    t.submit([attack(1, 10)])
    t.submit([attack(1, 11)])
    t.step()

    expect(commits).toHaveLength(1)
    expect(commits[0]?.turn).toBe(0)
    expect(commits[0]?.intents).toHaveLength(2)
  })

  it('hängt server-seitige (KI-)Intents NACH den eingereichten an', () => {
    const aiIntent = attack(2, 99)
    let committed: readonly Intent[] = []
    const t = new LocalTransport({
      produceServerIntents: () => [aiIntent],
      intervalMs: 100,
      running: true,
    })
    t.onCommitted((_turn, intents) => {
      committed = intents
    })

    const ui = attack(1, 5)
    t.submit([ui])
    t.step()

    // Reihenfolge-Vertrag: [UI…, KI…]
    expect(committed).toEqual([ui, aiIntent])
  })

  it('leert den Puffer nach jedem Commit (kein Doppel-Anwenden)', () => {
    const commits: number[] = []
    const t = new LocalTransport({
      produceServerIntents: () => [],
      intervalMs: 100,
      running: true,
    })
    t.onCommitted((_turn, intents) => commits.push(intents.length))

    t.submit([attack(1, 1)])
    t.step()
    t.step() // kein neuer Submit → leerer Commit

    expect(commits).toEqual([1, 0])
  })

  it('zählt Turns hoch', () => {
    const turns: number[] = []
    const t = new LocalTransport({
      produceServerIntents: () => [],
      intervalMs: 100,
      running: true,
    })
    t.onCommitted((turn) => turns.push(turn))
    t.step()
    t.step()
    t.step()
    expect(turns).toEqual([0, 1, 2])
  })

  it('committet nichts solange gestoppt (Pause)', () => {
    let count = 0
    const t = new LocalTransport({
      produceServerIntents: () => [],
      intervalMs: 100,
      running: false,
    })
    t.onCommitted(() => count++)
    t.submit([attack(1, 1)])
    t.step() // gestoppt → No-op
    expect(count).toBe(0)
    t.setRunning(true)
    t.step()
    expect(count).toBe(1)
  })

  it('feuert auf dem injizierten Timer im Intervall-Takt', () => {
    const holder: { tickFn: (() => void) | null; clearedId: number | null } = {
      tickFn: null,
      clearedId: null,
    }
    const timer = {
      setInterval: (h: () => void) => {
        holder.tickFn = h
        return 42
      },
      clearInterval: (id: number) => {
        holder.clearedId = id
      },
    }
    let count = 0
    const t = new LocalTransport({
      produceServerIntents: () => [],
      intervalMs: 100,
      running: true,
      timer,
    })
    t.onCommitted(() => count++)

    expect(holder.tickFn).not.toBeNull()
    holder.tickFn?.()
    holder.tickFn?.()
    expect(count).toBe(2)

    // setIntervalMs startet den Timer neu (alter wird gestoppt).
    t.setIntervalMs(50)
    expect(holder.clearedId).toBe(42)
  })

  it('destroy stoppt den Timer und verwirft den Puffer', () => {
    let cleared = false
    const timer = {
      setInterval: () => 7,
      clearInterval: () => {
        cleared = true
      },
    }
    let count = 0
    const t = new LocalTransport({
      produceServerIntents: () => [],
      intervalMs: 100,
      running: true,
      timer,
    })
    t.onCommitted(() => count++)
    t.submit([attack(1, 1)])
    t.destroy()
    expect(cleared).toBe(true)
    t.step() // nach destroy → No-op
    expect(count).toBe(0)
  })
})
