/**
 * Allround-KI — nutzt alle Spielmechaniken.
 *
 * Pro Spieler eine eigene PRNG (`ai-${id}-${seed}`) → deterministisch, aber
 * unabhängig vom Sim-PRNG. Zwischen Entscheidungen ein Cooldown (difficulty-
 * abhängig). Pro Entscheidung kann die KI mehrere Aktionen auf einmal anstoßen:
 *
 *  - **Militär** (immer versucht): Land-Angriff auf ein Frontier-Nachbar-Tile;
 *    mit kleiner Wahrscheinlichkeit ein expliziter Boot-Befehl (BoatIntent) auf
 *    ein entferntes Küsten-Gegner-Tile über Wasser.
 *  - **Wirtschaft/Bau** (gold-gated): Stadt → Hafen → Verteidigung,
 *    nach einfachen Prioritäten.
 *  - **Diplomatie**: Bündnis-Anfragen annehmen (gegen den Stärksten verbünden),
 *    selbst anfragen wenn man nicht führt, und bei klarer Führung verraten.
 *
 * Die KI sieht alles (kein Fog-of-War). Alle Zufallswahlen laufen über die
 * AI-PRNG → reproduzierbar.
 */

import {
  buildCostFor,
  countBuildingsOfType,
  effectiveMaxTroops,
  type GameState,
  type Player,
} from '../core/game'
import { defenseRange, isBuildingComplete, type BuildingType } from '../core/buildings'
import { areAllied, hasAllianceRequest } from '../core/diplomacy'
import { MAX_WARSHIPS_PER_PLAYER, NAVAL_RANGE, shipTile, WARSHIP_COST } from '../core/ships'
import type { Intent } from '../core/intent'
import { createPRNG } from '../core/random'
import { getOwner } from '../world/map'
import { isLand } from '../world/terrain'
import { neighbors4, torusDistance } from '../world/torus'

export type Difficulty = 'easy' | 'normal' | 'hard'

interface DifficultyProfile {
  readonly attackPct: number
  readonly cooldownMin: number
  readonly cooldownMax: number
  readonly popThresholdForPvp: number
  /** Wahrscheinlichkeit pro Entscheidung ein Gebäude zu bauen (wenn Gold reicht). */
  readonly buildChance: number
  /** Wahrscheinlichkeit pro Entscheidung eine Diplomatie-Aktion zu prüfen. */
  readonly diploChance: number
  /** Wahrscheinlichkeit statt Land-Angriff einen amphibischen Angriff zu wagen. */
  readonly boatChance: number
  /** Wahrscheinlichkeit pro Entscheidung ein Kriegsschiff zur Blockade zu entsenden. */
  readonly warshipChance: number
  /** Führungs-Verhältnis (Tiles Leader / #2) ab dem die KI ein Bündnis verrät. */
  readonly betrayLeadRatio: number
}

const PROFILES: Record<Difficulty, DifficultyProfile> = {
  easy: {
    attackPct: 18,
    cooldownMin: 60,
    cooldownMax: 180,
    popThresholdForPvp: 0.75,
    buildChance: 0.15,
    diploChance: 0.1,
    boatChance: 0.05,
    warshipChance: 0.03,
    betrayLeadRatio: 2.0,
  },
  normal: {
    attackPct: 30,
    cooldownMin: 30,
    cooldownMax: 100,
    popThresholdForPvp: 0.6,
    buildChance: 0.3,
    diploChance: 0.2,
    boatChance: 0.12,
    warshipChance: 0.06,
    betrayLeadRatio: 1.6,
  },
  hard: {
    attackPct: 42,
    cooldownMin: 18,
    cooldownMax: 60,
    popThresholdForPvp: 0.45,
    buildChance: 0.5,
    diploChance: 0.3,
    boatChance: 0.2,
    warshipChance: 0.12,
    betrayLeadRatio: 1.3,
  },
}

/**
 * Profil für wilde Nationen: passiv und simpel. Sie expandieren vor allem in neutrales Land
 * (hohe `popThresholdForPvp` → greifen Spieler erst an, wenn fast voll), greifen also eher
 * zurückhaltend an, sind seltener aktiv (hoher Cooldown) und **bauen/diplomatisieren nie**
 * (alle bau-/diplomatie-/schiff-Chancen 0) — dadurch dauerhaft schwächer.
 */
const WILD_PROFILE: DifficultyProfile = {
  attackPct: 25,
  cooldownMin: 40,
  cooldownMax: 140,
  popThresholdForPvp: 0.85,
  buildChance: 0,
  diploChance: 0,
  boatChance: 0,
  warshipChance: 0,
  betrayLeadRatio: Infinity,
}

export interface AI {
  /** Aufgerufen pro Sim-Tick. Returnt 0..n Intents für diesen Tick. */
  decide(state: GameState): readonly Intent[]
}

export function createAI(
  playerId: number,
  gameSeed: string,
  difficulty: Difficulty = 'normal',
  wild = false,
): AI {
  const profile = wild ? WILD_PROFILE : PROFILES[difficulty]
  const rng = createPRNG(`ai-${playerId.toString()}-${gameSeed}`)
  let nextDecisionTick = rng.nextInt(profile.cooldownMin, profile.cooldownMax)

  /** Ein Land-Nachbar-Ziel der Frontier (bevorzugt Gegner oder Neutrale). */
  function pickLandTarget(state: GameState, player: Player, preferEnemies: boolean): number {
    const { width, height } = state.map
    const enemyTiles: number[] = []
    const neutralTiles: number[] = []
    const seen = new Set<number>()

    for (const ref of player.frontier) {
      for (const n of neighbors4(ref, width, height)) {
        if (seen.has(n)) continue
        seen.add(n)
        const owner = getOwner(state.map, n)
        if (owner === player.id) continue
        // Verbündete nicht angreifen.
        if (owner > 0 && areAllied(state.alliances, player.id, owner)) continue
        if (owner === 0) neutralTiles.push(n)
        else enemyTiles.push(n)
      }
    }

    const primary = preferEnemies ? enemyTiles : neutralTiles
    const fallback = preferEnemies ? neutralTiles : enemyTiles
    const pool = primary.length > 0 ? primary : fallback
    if (pool.length === 0) return -1
    return rng.randElement(pool)
  }

  /**
   * Ein entferntes Gegner-Tile für einen amphibischen Angriff. Wir wählen ein
   * Frontier-Tile eines lebenden, nicht-verbündeten Gegners — der Core prüft, ob
   * eine Wasserroute existiert, und startet ggf. ein Boot.
   */
  function pickBoatTarget(state: GameState, player: Player): number {
    const enemies: Player[] = []
    for (const p of state.players.values()) {
      if (p.id === player.id || !p.isAlive) continue
      if (areAllied(state.alliances, player.id, p.id)) continue
      if (p.frontier.size > 0) enemies.push(p)
    }
    if (enemies.length === 0) return -1
    enemies.sort((a, b) => a.id - b.id)
    const enemy = rng.randElement(enemies)
    if (enemy === undefined) return -1
    const tiles = [...enemy.frontier]
    return rng.randElement(tiles) ?? -1
  }

  /** Wählt ein eigenes Frontier-Tile (optional eines das an einen Gegner grenzt). */
  function pickOwnTile(state: GameState, player: Player, borderingEnemy: boolean): number {
    const { width, height } = state.map
    const candidates: number[] = []
    for (const ref of player.frontier) {
      if (state.buildings.has(ref)) continue
      if (!borderingEnemy) {
        candidates.push(ref)
        continue
      }
      for (const n of neighbors4(ref, width, height)) {
        const owner = getOwner(state.map, n)
        if (owner > 0 && owner !== player.id) {
          candidates.push(ref)
          break
        }
      }
    }
    return candidates.length > 0 ? (rng.randElement(candidates) ?? -1) : -1
  }

  /** Ein eigenes, unbebautes Frontier-Tile das ans Wasser grenzt (für Häfen). */
  function pickCoastalTile(state: GameState, player: Player): number {
    const { width, height } = state.map
    const candidates: number[] = []
    for (const ref of player.frontier) {
      if (state.buildings.has(ref)) continue
      for (const n of neighbors4(ref, width, height)) {
        if (!isLand(state.map.terrain, n)) {
          candidates.push(ref)
          break
        }
      }
    }
    return candidates.length > 0 ? (rng.randElement(candidates) ?? -1) : -1
  }

  /**
   * Bestes Tile für einen Verteidigungsposten: ein paar Tiles HINTER der bedrohten
   * Grenze (überlebt einen Push, statt sofort miterobert zu werden), aber nah genug
   * dass die Front im Wirkradius liegt, und in dichtem Eigenland (deckt möglichst
   * viel eigenes Gebiet ab). Posten werden auf Abstand gehalten, damit sich die
   * Abdeckung über die Grenze verteilt statt zu verklumpen.
   */
  function pickDefenseTile(state: GameState, player: Player): number {
    const { width, height } = state.map
    // 1. Bedrohte Grenze als BFS-Quellen: eigene Frontier-Tiles neben Feind.
    const sources: number[] = []
    for (const ref of player.frontier) {
      for (const n of neighbors4(ref, width, height)) {
        const o = getOwner(state.map, n)
        if (o > 0 && o !== player.id) {
          sources.push(ref)
          break
        }
      }
    }
    if (sources.length === 0) return -1

    // 2. Bestehende eigene Posten (für Spreizung).
    const posts: Array<{ x: number; y: number }> = []
    for (const [tile, b] of state.buildings) {
      if (b.type === 'defense' && b.ownerId === player.id) {
        posts.push({ x: tile % width, y: Math.floor(tile / width) })
      }
    }
    const spacing = defenseRange(1) * 0.9

    // 3. Multi-Source-BFS über Eigenland → depth = Schrittabstand zur nächsten Front.
    const MIN_DEPTH = 3
    const MAX_DEPTH = 6
    const SWEET_DEPTH = 4
    const MAX_VISIT = 6000
    const depth = new Map<number, number>()
    const queue: number[] = []
    for (const s of sources) {
      depth.set(s, 0)
      queue.push(s)
    }
    let best = -1
    let bestScore = -Infinity
    let head = 0
    while (head < queue.length && head < MAX_VISIT) {
      const cur = queue[head++]
      if (cur === undefined) break
      const d = depth.get(cur) ?? 0
      if (d >= MIN_DEPTH && !state.buildings.has(cur)) {
        const cx = cur % width
        const cy = Math.floor(cur / width)
        let tooClose = false
        for (const p of posts) {
          if (torusDistance(cx, cy, p.x, p.y, width, height) < spacing) {
            tooClose = true
            break
          }
        }
        if (!tooClose) {
          let ownN = 0
          for (const n of neighbors4(cur, width, height)) {
            if (getOwner(state.map, n) === player.id) ownN++
          }
          const score = ownN - 2 * Math.abs(d - SWEET_DEPTH)
          if (score > bestScore) {
            bestScore = score
            best = cur
          }
        }
      }
      if (d < MAX_DEPTH) {
        for (const n of neighbors4(cur, width, height)) {
          if (depth.has(n)) continue
          if (getOwner(state.map, n) !== player.id) continue
          depth.set(n, d + 1)
          queue.push(n)
        }
      }
    }
    // Fallback: zu dünnes/kleines Reich für Tiefe → erster Posten direkt an der Front.
    if (best < 0 && posts.length === 0) return pickOwnTile(state, player, true)
    return best
  }

  /** Plant einen Bau nach einfachen Prioritäten (Stadt → Hafen → Verteidigung). */
  function planBuild(state: GameState, player: Player): Intent | null {
    const gold = player.gold
    const costOf = (t: BuildingType): number => buildCostFor(state, player.id, t)

    // 1. Truppen-Cap ist der Engpass → Stadt
    if (player.troops >= 0.9 * effectiveMaxTroops(state, player.id) && gold >= costOf('city')) {
      const tile = pickOwnTile(state, player, false)
      if (tile >= 0) return { type: 'build', playerId: player.id, tile, buildingType: 'city' }
    }
    // 2. Am Wasser ohne Hafen → Hafen (VOR Verteidigung, sonst baut die KI bei flachen
    //    Verteidigungskosten endlos Posten und kommt nie zum Hafen / zu Schiffen).
    if (countBuildingsOfType(state, player.id, 'port') === 0 && gold >= costOf('port')) {
      const tile = pickCoastalTile(state, player)
      if (tile >= 0) return { type: 'build', playerId: player.id, tile, buildingType: 'port' }
    }
    // 2b. Wirtschaft: Fabrik bauen, wenn es Ziele (Stadt/Hafen) zum Vernetzen gibt und
    //     noch nicht mehr Fabriken als Ziele existieren (sonst lohnt sich keine weitere).
    const dests =
      countBuildingsOfType(state, player.id, 'city') +
      countBuildingsOfType(state, player.id, 'port')
    if (
      dests > 0 &&
      countBuildingsOfType(state, player.id, 'factory') < dests &&
      gold >= costOf('factory')
    ) {
      const tile = pickOwnTile(state, player, false)
      if (tile >= 0) return { type: 'build', playerId: player.id, tile, buildingType: 'factory' }
    }
    // 3. Bedrohte Front → Verteidigungsposten (hinter der Grenze, nicht drauf)
    if (gold >= costOf('defense')) {
      const tile = pickDefenseTile(state, player)
      if (tile >= 0) return { type: 'build', playerId: player.id, tile, buildingType: 'defense' }
    }
    return null
  }

  /** Diplomatie-Aktion: annehmen / anfragen / verraten — gegen den Stärksten spielen. */
  function planDiplomacy(state: GameState, player: Player): Intent | null {
    const living: Player[] = []
    // Wilde Nationen sind passiv → keine Diplomatie-Partner (würden nie antworten).
    for (const p of state.players.values()) if (p.isAlive && !p.wild) living.push(p)
    if (living.length < 3) return null // unter 3 Spielern lohnt Bündnis-Politik kaum
    living.sort((a, b) => b.tilesOwned - a.tilesOwned || a.id - b.id)
    const leader = living[0]
    if (leader === undefined) return null
    const amLeader = leader.id === player.id
    const allies = living.filter(
      (o) => o.id !== player.id && areAllied(state.alliances, player.id, o.id),
    )

    // 1. Verrat: führe ich klar und habe einen Verbündeten → schwächsten Verbündeten verraten
    if (amLeader && allies.length > 0) {
      const second = living[1]
      const margin =
        second !== undefined && second.tilesOwned > 0
          ? leader.tilesOwned / second.tilesOwned
          : Infinity
      if (margin >= profile.betrayLeadRatio) {
        allies.sort((a, b) => a.tilesOwned - b.tilesOwned || a.id - b.id)
        const victim = allies[0]
        if (victim !== undefined) {
          return { type: 'break-alliance', playerId: player.id, targetPlayerId: victim.id }
        }
      }
    }

    // 2. Offenes Bündnis-Angebot annehmen (nicht wenn ich führe — dann lieber solo)
    if (!amLeader) {
      for (const o of living) {
        if (o.id === player.id) continue
        if (hasAllianceRequest(state.allianceRequests, o.id, player.id)) {
          return { type: 'accept-alliance', playerId: player.id, targetPlayerId: o.id }
        }
      }
    }

    // 3. Selbst anfragen: ich führe nicht und habe keinen Verbündeten → mit einem
    //    anderen Nicht-Anführer gegen den Leader verbünden
    if (!amLeader && allies.length === 0) {
      for (const o of living) {
        if (o.id === player.id || o.id === leader.id) continue
        if (areAllied(state.alliances, player.id, o.id)) continue
        if (hasAllianceRequest(state.allianceRequests, player.id, o.id)) continue
        return { type: 'request-alliance', playerId: player.id, targetPlayerId: o.id }
      }
    }
    return null
  }

  function planMilitary(state: GameState, player: Player): Intent | null {
    const max = effectiveMaxTroops(state, player.id)
    const popRatio = max > 0 ? player.troops / max : 0
    const preferEnemies = popRatio >= profile.popThresholdForPvp

    // Gelegentlich amphibisch: entferntes Küsten-Ziel über Wasser → explizites Boot.
    if (preferEnemies && rng.next() < profile.boatChance) {
      const boatTarget = pickBoatTarget(state, player)
      if (boatTarget >= 0) {
        const troops = Math.floor((player.troops * profile.attackPct) / 100)
        if (troops > 0) return { type: 'boat', playerId: player.id, targetTile: boatTarget, troops }
      }
    }

    const targetTile = pickLandTarget(state, player, preferEnemies)
    if (targetTile < 0) return null
    const troops = Math.floor((player.troops * profile.attackPct) / 100)
    if (troops <= 0) return null
    return { type: 'attack', playerId: player.id, targetTile, troops }
  }

  /** Entsendet (mit Hafen + Gold) ein Kriegsschiff zum Wasser neben einem Gegner-Hafen. */
  function planWarship(state: GameState, player: Player): Intent | null {
    if (player.gold < WARSHIP_COST) return null
    const active = state.warships.reduce((n, w) => (w.ownerId === player.id ? n + 1 : n), 0)
    if (active >= MAX_WARSHIPS_PER_PLAYER) return null
    let hasPort = false
    for (const b of state.buildings.values()) {
      if (b.type === 'port' && b.ownerId === player.id && isBuildingComplete(b, state.tick)) {
        hasPort = true
        break
      }
    }
    if (!hasPort) return null
    const { width, height } = state.map
    // Wasser-Tile neben einem Hafen eines lebenden, nicht-verbündeten Gegners (Blockade).
    for (const b of state.buildings.values()) {
      if (b.type !== 'port' || b.ownerId === player.id) continue
      const enemy = state.players.get(b.ownerId)
      if (enemy === undefined || !enemy.isAlive) continue
      if (areAllied(state.alliances, player.id, b.ownerId)) continue
      for (const n of neighbors4(b.tile, width, height)) {
        if (!isLand(state.map.terrain, n)) {
          return { type: 'launch-warship', playerId: player.id, targetTile: n }
        }
      }
    }
    return null
  }

  /**
   * Lenkt eigene (patrouillierende) Kriegsschiffe aktiv auf feindliche Handelsschiff-Routen:
   * schickt jedes Schiff ein Stück VOR das nächste erreichbare feindliche Handelsschiff auf
   * dessen Restroute, um es abzufangen — statt nur zwischen Häfen zu pendeln. Verbündete
   * Handelsschiffe werden nie gejagt; schon engagierte Schiffe (Ziel in Reichweite) bleiben.
   */
  function planWarshipHunts(state: GameState, player: Player): Intent[] {
    if (state.warships.length === 0 || state.tradeShips.length === 0) return []
    const { width, height } = state.map
    const comp = state.waterComponents
    const hostile = (a: number, b: number): boolean => a !== b && !areAllied(state.alliances, a, b)
    const moves: Intent[] = []
    for (let i = 0; i < state.warships.length; i++) {
      const ws = state.warships[i]
      if (ws === undefined || ws.ownerId !== player.id || ws.returning || ws.mode !== 'patrol')
        continue
      const wTile = shipTile(ws)
      const wComp = comp[wTile]
      if (wComp === undefined || wComp < 0) continue
      const wx = wTile % width
      const wy = Math.floor(wTile / width)
      let aimTile = -1
      let bestDist = Infinity
      let engaging = false
      for (const ts of state.tradeShips) {
        // Nur feindliche Fracht (zu BEIDEN Hafen-Besitzern feindlich) — nie die von Freunden.
        if (!hostile(player.id, ts.fromOwnerId) || !hostile(player.id, ts.toOwnerId)) continue
        // Abfang-Punkt: ein Stück voraus auf der Restroute, damit das Schiff es trifft.
        const idx = Math.min(Math.floor(ts.progress) + 6, ts.path.length - 1)
        const aim = ts.path[idx]
        if (aim === undefined || comp[aim] !== wComp) continue // nicht über Wasser erreichbar
        const ax = aim % width
        const ay = Math.floor(aim / width)
        const d = torusDistance(wx, wy, ax, ay, width, height)
        if (d <= NAVAL_RANGE) {
          engaging = true // schon nah dran → nicht umlenken, draufhalten
          break
        }
        if (d < bestDist) {
          bestDist = d
          aimTile = aim
        }
      }
      if (!engaging && aimTile >= 0) {
        moves.push({
          type: 'move-warship',
          playerId: player.id,
          warshipIndices: [i],
          targetTile: aimTile,
        })
      }
    }
    return moves
  }

  return {
    decide(state: GameState): readonly Intent[] {
      const player = state.players.get(playerId)
      if (player === undefined || !player.isAlive) return []
      if (state.tick < nextDecisionTick) return []
      nextDecisionTick = state.tick + rng.nextInt(profile.cooldownMin, profile.cooldownMax)

      const intents: Intent[] = []

      // Militär zuerst (bleibt das primäre Verhalten).
      const military = planMilitary(state, player)
      if (military !== null) intents.push(military)

      // Gelegentlich ein Kriegsschiff zur Handelsblockade.
      if (rng.next() < profile.warshipChance) {
        const warship = planWarship(state, player)
        if (warship !== null) intents.push(warship)
      }

      // Vorhandene Kriegsschiffe aktiv auf feindliche Handels-Routen lenken (Abfangen).
      for (const m of planWarshipHunts(state, player)) intents.push(m)

      // Wirtschaft/Bau.
      if (rng.next() < profile.buildChance) {
        const build = planBuild(state, player)
        if (build !== null) intents.push(build)
      }

      // Diplomatie.
      if (rng.next() < profile.diploChance) {
        const diplo = planDiplomacy(state, player)
        if (diplo !== null) intents.push(diplo)
      }

      return intents
    },
  }
}
