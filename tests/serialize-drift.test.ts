/**
 * Permanente Regressionstests für die zwei reproduzierten Resync-Drift-Bugs (Audit-Funde):
 *
 * 1. Ein Snapshot WÄHREND einer mehr-Tick-Econ-Flut (Reich > ECON_FLOOD_BUDGET = 24 000 Tiles)
 *    verlor den Flut-Zwischenstand → Original und Kopie bauten die Gold-Fuhren zu verschiedenen
 *    Ticks → Gold-Drift (Hash-Divergenz ~Tick 61 im Original-Repro).
 * 2. Fliegende Kriegsschiff-Projektile wurden verworfen, obwohl der Schaden erst beim EINSCHLAG
 *    fällt → im Original versenkt + Piraterie-Beute, in der Kopie nicht (Divergenz ~Tick 21).
 *
 * Beide Transienten werden seitdem mitserialisiert; diese Tests halten die Garantie
 * „Snapshot mid-flight → läuft bit-genau weiter" dauerhaft fest.
 */

import { describe, expect, it } from 'vitest'
import { createGame, initializeAllFrontiers, tick, type GameConfig } from '../src/core/game'
import { serializeState, deserializeState } from '../src/core/serialize'
import { hashState } from '../src/core/hash'
import { setOwner } from '../src/world/map'
import { tileRef } from '../src/world/torus'
import type { Warship } from '../src/core/ships'
import { IS_LAND_BIT } from '../src/world/terrain'
import { labelLandComponents, labelWaterComponents } from '../src/world/water-path'

describe('Resync-Drift (Snapshot mid-flight)', () => {
  it('Econ-Flut: Snapshot mitten im Zyklus läuft bit-genau weiter (kein Gold-Drift)', () => {
    // Reich > ECON_FLOOD_BUDGET (24 000): 220×220 = 48 400 Tiles → Flut braucht ~3 Ticks.
    const W = 220
    const H = 220
    const config: GameConfig = {
      mapWidth: W,
      mapHeight: H,
      seed: 'econ-drift',
      victoryPct: 99,
      terrain: 'flat',
      players: [
        { id: 1, name: 'Reich', color: 0xff0000ff, isHuman: true },
        { id: 2, name: 'Rest', color: 0x00ff00ff, isHuman: false },
      ],
    }
    const state = createGame(config)
    const p1 = state.players.get(1)
    if (p1 === undefined) throw new Error('player missing')
    for (let i = 0; i < state.map.state.length; i++) setOwner(state.map, i, 1)
    p1.tilesOwned = W * H
    initializeAllFrontiers(state)
    // Stadt + Fabrik (Abstand 10: ≥ MIN_FACTORY_SOURCE_DIST, ≤ FACTORY_LINK_RANGE) → Fuhren-Route.
    const city = tileRef(50, 50, W, H)
    const factory = tileRef(60, 50, W, H)
    state.buildings.set(city, {
      type: 'city',
      ownerId: 1,
      tile: city,
      level: 1,
      completesAtTick: 0,
    })
    state.buildings.set(factory, {
      type: 'factory',
      ownerId: 1,
      tile: factory,
      level: 1,
      completesAtTick: 0,
    })
    state.economyDirty = true

    // Bis mitten in den Flut-Zyklus laufen (startet bei tick % 40 === 0, dauert ~3 Ticks).
    let guard = 0
    while (!state.econActive && guard++ < 200) tick(state, [])
    expect(state.econActive).toBe(true) // Vorbedingung: Snapshot fällt WÄHREND der Flut

    const copy = deserializeState(serializeState(state))
    expect(hashState(copy)).toBe(hashState(state))
    expect(copy.econActive).toBe(true) // der Zyklus hat den Snapshot überlebt

    // Beide Welten weiterlaufen lassen — deckt Flut-Ende, routeGoldCarts und Fuhren-Lieferungen
    // (Gold ist gehasht) ab. Vor dem Fix divergierte der Hash bei ~Tick 61.
    for (let t = 0; t < 120; t++) {
      tick(state, [])
      tick(copy, [])
      if (t % 5 === 0 || t > 50) {
        expect(hashState(copy)).toBe(hashState(state))
      }
    }
  })

  it('Projektil: Snapshot mit fliegendem Schuss läuft bit-genau weiter (keine verlorene Beute)', () => {
    const W = 8
    const H = 4
    const config: GameConfig = {
      mapWidth: W,
      mapHeight: H,
      seed: 'projectile-drift',
      victoryPct: 90,
      terrain: 'flat',
      players: [
        { id: 1, name: 'Handel', color: 0xff0000ff, isHuman: true },
        { id: 2, name: 'Pirat', color: 0x00ff00ff, isHuman: false },
      ],
    }
    const state = createGame(config)
    // Wasser-Spalte bei x=0, Rest Land (wie in ships.test).
    const t = state.map.terrain
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) t[y * W + x] = x === 0 ? 0 : IS_LAND_BIT
    state.waterComponents.set(labelWaterComponents(state.map))
    state.landComponents.set(labelLandComponents(state.map))
    initializeAllFrontiers(state)

    const shooter: Warship = {
      ownerId: 2,
      path: [tileRef(0, 0, W, H), tileRef(0, 1, W, H)],
      progress: 0,
      dir: 1,
      hp: 5,
      cooldown: 99, // keine neuen Schüsse — nur das fliegende Projektil zählt
      mode: 'patrol',
      returning: false,
    }
    state.warships.push(shooter)
    const trade = {
      fromOwnerId: 1,
      toOwnerId: 1,
      path: [tileRef(0, 0, W, H), ...new Array<number>(80).fill(tileRef(0, 1, W, H))],
      progress: 0,
      gold: 500, // Piraterie-Beute beim Treffer = 1000 → Gold ist gehasht → Drift wäre sichtbar
      originPort: tileRef(1, 1, W, H),
      destPort: tileRef(5, 1, W, H),
    }
    state.tradeShips.push(trade)
    state.projectiles.push({
      shooter,
      target: trade,
      targetKind: 'trade',
      fromX: 0,
      fromY: 0,
      aimX: 0.5,
      aimY: 0.5,
      travel: 0,
      impactAt: 3, // fliegt noch — Einschlag NACH dem Snapshot
    })

    const copy = deserializeState(serializeState(state))
    expect(copy.projectiles.length).toBe(1) // das Projektil hat den Snapshot überlebt
    expect(hashState(copy)).toBe(hashState(state))

    // Vor dem Fix: Original versenkt + kassiert 1000 Beute, Kopie nicht → Hash-Divergenz.
    for (let i = 0; i < 30; i++) {
      tick(state, [])
      tick(copy, [])
      expect(hashState(copy)).toBe(hashState(state))
    }
    expect(state.tradeShips.length).toBe(0) // Vorbedingung hielt: der Schuss traf wirklich
  })

  it('Alt-Snapshot ohne die neuen Felder lädt wie bisher (abwärtskompatibel)', () => {
    const state = createGame({
      mapWidth: 16,
      mapHeight: 16,
      seed: 'compat',
      victoryPct: 90,
      terrain: 'flat',
      players: [{ id: 1, name: 'P', color: 0xff0000ff, isHuman: true }],
    })
    const data = serializeState(state)
    // Alt-Snapshot simulieren: neue optionale Felder entfernen.
    const legacy = { ...data } as Record<string, unknown>
    delete legacy['projectiles']
    delete legacy['econ']
    delete legacy['economyDirty']
    const copy = deserializeState(legacy as unknown as Parameters<typeof deserializeState>[0])
    expect(copy.projectiles.length).toBe(0)
    expect(copy.econActive).toBe(false)
    expect(copy.economyDirty).toBe(true)
    expect(hashState(copy)).toBe(hashState(state))
  })
})
