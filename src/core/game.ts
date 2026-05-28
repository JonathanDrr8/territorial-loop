/**
 * Game-State und Tick-Pipeline.
 *
 * Hier kommt alles zusammen: Map, Spieler, Intents, deterministisches Wachstum.
 *
 * Diese Datei enthält das Skelett — `createGame`, Spawn-Platzierung, und die
 * Tick-Phasen Growth → Eliminate → Victory. Die Attack-Resolution (Phase
 * zwischen Growth und Eliminate) wird in einem nachfolgenden Commit ergänzt.
 *
 * Tick-Reihenfolge ist deterministisch — Spieler immer nach `id` aufsteigend
 * iteriert, Intents nach `playerId` sortiert.
 */

import { createMap, getOwner, setOwner, type GameMap } from '../world/map'
import {
  generateTerrain,
  isLand,
  isPassable,
  terrainMagnitude,
  type TerrainType,
} from '../world/terrain'
import { type TileRef, neighbors4, tileRef, torusDistance } from '../world/torus'
import {
  BASE_GOLD_PER_TICK,
  BOT_START_TROOPS,
  HUMAN_START_TROOPS,
  attackerLossPerTile,
  defenderLossPerTile,
  maxTroops,
  tilesPerTick,
  troopIncreaseRate,
} from './config'
import {
  type Building,
  type BuildingType,
  CITY_CAP_BONUS,
  DEFENSE_MAG_MULTIPLIER,
  MARKET_GOLD_PER_TICK,
  MAX_BUILDING_LEVEL,
  PORT_WATER_RANGE,
  buildCost,
  defenseRange,
  upgradeCost,
} from './buildings'
import type {
  AcceptAllianceIntent,
  AttackIntent,
  BreakAllianceIntent,
  BuildIntent,
  CancelAttackIntent,
  Intent,
  RequestAllianceIntent,
  SetEmbargoIntent,
  UpgradeIntent,
} from './intent'
import { createPRNG, type PRNG } from './random'
import {
  AECHTUNG_DURATION_TICKS,
  TRAITOR_DEFENSE_PENALTY,
  areAllied,
  directedKey,
  hasAllianceRequest,
  isTradeBlocked,
  pairKey,
} from './diplomacy'
import {
  type Boat,
  BOAT_SPEED,
  BOAT_TROOP_FRACTION,
  MAX_BOATS_PER_PLAYER,
  TRADE_INTERVAL_TICKS,
  TRADE_SHIP_SPEED,
  type TradeShip,
  planBoatLaunch,
  planWaterRoute,
  shipArrived,
  tradeGold,
} from './ships'
import { labelLandComponents, labelWaterComponents } from '../world/water-path'

/* ============================================================================
 * Types
 * ========================================================================== */

export interface PlayerDef {
  readonly id: number
  readonly name: string
  readonly color: number
  readonly isHuman: boolean
}

export interface GameConfig {
  readonly mapWidth: number
  readonly mapHeight: number
  readonly seed: string
  /** Anteil der Karte (in Prozent, z.B. 90) ab dem ein Spieler als Sieger gilt. */
  readonly victoryPct: number
  /**
   * Multiplikator für `tilesPerTick`. 1.0 = OpenFront-Standard (Welle expandiert
   * schnell), 0.5 = halbe Eroberungsgeschwindigkeit, 0.3 = Belagerungs-Feeling.
   * Wirkt nur auf die Wave-Geschwindigkeit, nicht auf Truppen-Verluste pro Tile —
   * d.h. Belagerung lässt Angriffe länger anhalten ohne mehr Truppen zu kosten.
   * Default 1.0.
   */
  readonly matchSpeed?: number
  /** Karten-Topographie. Default 'flat' (alles Land — wie bisher). */
  readonly terrain?: TerrainType
  readonly players: readonly PlayerDef[]
}

export interface Attack {
  /** 0 = TerraNullius (neutrales Gebiet) */
  targetPlayerId: number
  reserveTroops: number
  /**
   * Klick-Punkt der den Angriff ausgelöst hat. Die Welle bevorzugt Tiles
   * mit kurzer Torus-Distanz zu diesem Punkt — daher fließt der Angriff
   * gezielt in eine Richtung statt diamantförmig zu expandieren.
   */
  focusTile: TileRef
}

export interface Player {
  readonly id: number
  readonly name: string
  readonly color: number
  readonly isHuman: boolean
  troops: number
  tilesOwned: number
  frontier: Set<TileRef>
  attacks: Attack[]
  isAlive: boolean
  /** Gold-Vorrat — Währung für Gebäude und Schiffe. */
  gold: number
  /** Höchster jemals erreichter `tilesOwned`-Stand. */
  peakTilesOwned: number
  /** Höchster jemals erreichter `troops`-Stand. */
  peakTroops: number
  /**
   * Tick bis zu dem der Spieler als Verräter geächtet ist (0 = nicht geächtet).
   * Solange aktiv: −50% Verteidigung gegen Nationen die er nicht selbst angreift.
   */
  traitorUntil: number
}

export type GamePhase = 'running' | 'ended'

/** Ein Spielereignis fürs Log (Eliminierung, Sieg, später Allianzen/Verrat/Embargo). */
export interface GameEvent {
  readonly tick: number
  readonly text: string
  /** Optionale Akzent-Farbe (RGBA-packed), z.B. die Farbe des betroffenen Spielers. */
  readonly color?: number
}

export interface GameState {
  tick: number
  readonly map: GameMap
  readonly players: Map<number, Player>
  readonly rng: PRNG
  readonly seed: string
  readonly config: GameConfig
  phase: GamePhase
  /** Spieler-ID des Siegers oder `null` wenn noch keiner gewonnen hat. */
  winner: number | null
  /** Chronologische Ereignis-Liste; die UI liest sie und zeigt die letzten an. */
  events: GameEvent[]
  /** Gebäude pro Tile. */
  buildings: Map<TileRef, Building>
  /** Wasser-Zusammenhangskomponenten (Index pro Tile, -1 = Land). Statisch. */
  readonly waterComponents: Int32Array
  /** Begehbare-Land-Komponenten (Index pro Tile, -1 = Wasser/unpassierbar). Statisch. */
  readonly landComponents: Int32Array
  /** Aktive Transport-Boote. */
  boats: Boat[]
  /** Aktive Handelsschiffe. */
  tradeShips: TradeShip[]
  /** Aktive Allianzen als ungeordnete Paar-Schlüssel ([[pairKey]]). */
  readonly alliances: Set<number>
  /** Offene Bündnis-Angebote als gerichtete Schlüssel from→to ([[directedKey]]). */
  readonly allianceRequests: Set<number>
  /** Verhängte Embargos als gerichtete Schlüssel from→to. */
  readonly embargoes: Set<number>
}

/* ============================================================================
 * createGame
 * ========================================================================== */

const SPAWN_HALF_SIZE = 2 // 5×5 = (2*2+1)^2

/**
 * Erzeugt einen neuen Spielzustand und platziert alle Spieler-Spawns.
 *
 * Spawn-Platzierung: Rejection Sampling — pro Spieler bis zu 1000 Versuche,
 * einen Punkt mit Mindest-Abstand zu allen bisher platzierten Spawns zu finden.
 * Mindest-Abstand: `max(8, min(w,h) / numPlayers)` (Torus-Distanz). Bei
 * gescheitertem Sampling: zufälliger Punkt als Fallback (Spawn könnte überlappen,
 * Tiles werden in der Reihenfolge gesetzt, später-platzierte verlieren).
 */
export function createGame(config: GameConfig): GameState {
  validateConfig(config)

  const map = createMap(config.mapWidth, config.mapHeight)
  const rng = createPRNG(config.seed)
  // Terrain wird vor allen Sim-relevanten PRNG-Zugriffen generiert; dafür gibt's
  // einen separaten PRNG damit terrain ↔ sim-Verlauf nicht miteinander verschränkt sind.
  const terrainRng = createPRNG(`terrain-${config.seed}`)
  generateTerrain(map, terrainRng, config.terrain ?? 'flat')
  const players = new Map<number, Player>()

  for (const def of config.players) {
    const startTroops = def.isHuman ? HUMAN_START_TROOPS : BOT_START_TROOPS
    players.set(def.id, {
      id: def.id,
      name: def.name,
      color: def.color,
      isHuman: def.isHuman,
      troops: startTroops,
      tilesOwned: 0,
      frontier: new Set<TileRef>(),
      attacks: [],
      isAlive: true,
      gold: 0,
      peakTilesOwned: 0,
      peakTroops: startTroops,
      traitorUntil: 0,
    })
  }

  const state: GameState = {
    tick: 0,
    map,
    players,
    rng,
    seed: config.seed,
    config,
    phase: 'running',
    winner: null,
    events: [],
    buildings: new Map<TileRef, Building>(),
    waterComponents: labelWaterComponents(map),
    landComponents: labelLandComponents(map),
    boats: [],
    tradeShips: [],
    alliances: new Set<number>(),
    allianceRequests: new Set<number>(),
    embargoes: new Set<number>(),
  }

  placeSpawns(state)
  initializeAllFrontiers(state)

  return state
}

function validateConfig(config: GameConfig): void {
  if (config.victoryPct <= 0 || config.victoryPct > 100) {
    throw new RangeError(`victoryPct must be in (0, 100], got ${config.victoryPct}`)
  }
  if (config.players.length === 0) {
    throw new RangeError('At least one player required')
  }
  const ids = new Set<number>()
  for (const p of config.players) {
    if (p.id <= 0) {
      throw new RangeError(`Player id must be >= 1 (got ${p.id}, reserved for neutral)`)
    }
    if (ids.has(p.id)) {
      throw new RangeError(`Duplicate player id: ${p.id}`)
    }
    ids.add(p.id)
  }
}

function placeSpawns(state: GameState): void {
  const { map, players, rng } = state
  const { width, height } = map
  const minDist = Math.max(8, Math.floor(Math.min(width, height) / players.size))

  const placedCenters: Array<readonly [number, number]> = []
  const playerList = orderedPlayers(state)

  for (const player of playerList) {
    const [cx, cy] = findSpawnCenter(state, rng, width, height, placedCenters, minDist)
    placedCenters.push([cx, cy])

    for (let dy = -SPAWN_HALF_SIZE; dy <= SPAWN_HALF_SIZE; dy++) {
      for (let dx = -SPAWN_HALF_SIZE; dx <= SPAWN_HALF_SIZE; dx++) {
        const ref = tileRef(cx + dx, cy + dy, width, height)
        // Nur claim wenn Land und neutral
        if (!isPassable(map.terrain, ref)) continue
        if (getOwner(map, ref) === 0) {
          setOwner(map, ref, player.id)
          player.tilesOwned++
        }
      }
    }
  }
}

function allLandIn5x5(
  state: GameState,
  cx: number,
  cy: number,
  width: number,
  height: number,
): boolean {
  for (let dy = -SPAWN_HALF_SIZE; dy <= SPAWN_HALF_SIZE; dy++) {
    for (let dx = -SPAWN_HALF_SIZE; dx <= SPAWN_HALF_SIZE; dx++) {
      const ref = tileRef(cx + dx, cy + dy, width, height)
      if (!isPassable(state.map.terrain, ref)) return false
    }
  }
  return true
}

function findSpawnCenter(
  state: GameState,
  rng: PRNG,
  width: number,
  height: number,
  placedCenters: ReadonlyArray<readonly [number, number]>,
  minDist: number,
): readonly [number, number] {
  const MAX_ATTEMPTS = 1000
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const x = rng.nextInt(0, width)
    const y = rng.nextInt(0, height)
    if (!allLandIn5x5(state, x, y, width, height)) continue
    let valid = true
    for (const [ox, oy] of placedCenters) {
      if (torusDistance(x, y, ox, oy, width, height) < minDist) {
        valid = false
        break
      }
    }
    if (valid) return [x, y]
  }
  // Fallback: zufälliger Land-Punkt
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const x = rng.nextInt(0, width)
    const y = rng.nextInt(0, height)
    if (allLandIn5x5(state, x, y, width, height)) return [x, y]
  }
  // Letzter Notnagel — beliebiger Punkt, auch wenn sich Spawn nicht vollständig setzen lässt
  return [rng.nextInt(0, width), rng.nextInt(0, height)]
}

function initializeAllFrontiers(state: GameState): void {
  const { map, players } = state
  const { width, height } = map
  for (let ref = 0; ref < map.state.length; ref++) {
    const owner = getOwner(map, ref)
    if (owner === 0) continue
    const player = players.get(owner)
    if (player === undefined) continue
    for (const n of neighbors4(ref, width, height)) {
      // Wasser-Tiles werden nie erobert → kein Anlass sie als "Frontier" zu führen.
      if (!isPassable(map.terrain, n)) continue
      if (getOwner(map, n) !== owner) {
        player.frontier.add(ref)
        break
      }
    }
  }
}

/* ============================================================================
 * tick
 * ========================================================================== */

/**
 * Führt einen Sim-Tick aus. Mutiert `state` in-place und gibt die gleiche
 * Referenz zurück (Convenience).
 *
 * Phasen-Reihenfolge:
 *   1. Intents anwenden (Attack-Reserven verschieben, Cancel)
 *   2. Bevölkerung wachsen pro lebendem Spieler
 *   3. Attack-Resolution — Wave-Expansion + Truppen-Verluste
 *   4. Eliminierte Spieler markieren (tilesOwned == 0)
 *   5. Sieg-Check — bei Erreichen der Schwelle phase='ended', winner gesetzt
 *      Match läuft trotzdem weiter (Jonathan: Spieler soll KI weiter beobachten)
 *   6. tick++
 */
export function tick(state: GameState, intents: readonly Intent[]): GameState {
  applyIntents(state, intents)
  growPopulations(state)
  generateGold(state)
  resolveAttacks(state)
  advanceBoats(state)
  spawnTradeShips(state)
  advanceTradeShips(state)
  checkEliminations(state)
  checkVictory(state)
  updatePeakStats(state)
  state.tick++
  return state
}

function generateGold(state: GameState): void {
  // Markt-Gold pro Spieler aus den Gebäuden vorberechnen.
  const marketGold = new Map<number, number>()
  for (const b of state.buildings.values()) {
    if (b.type !== 'market') continue
    marketGold.set(b.ownerId, (marketGold.get(b.ownerId) ?? 0) + MARKET_GOLD_PER_TICK * b.level)
  }
  for (const player of state.players.values()) {
    if (!player.isAlive) continue
    player.gold += BASE_GOLD_PER_TICK + (marketGold.get(player.id) ?? 0)
  }
}

/** Truppen-Cap-Bonus eines Spielers aus seinen Städten. */
function cityCapBonus(state: GameState, playerId: number): number {
  let bonus = 0
  for (const b of state.buildings.values()) {
    if (b.type === 'city' && b.ownerId === playerId) bonus += CITY_CAP_BONUS * b.level
  }
  return bonus
}

/**
 * Magnitude-Multiplikator durch Verteidigungsposten des Verteidigers: 5 wenn ein
 * eigener Posten in Reichweite des Tiles steht, sonst 1. O(Posten) — bei wenigen
 * Posten günstig.
 */
function defenseMagMultiplier(state: GameState, tile: TileRef, defenderId: number): number {
  if (defenderId === 0) return 1 // TerraNullius hat keine Posten
  const { width, height } = state.map
  const tx = tile % width
  const ty = Math.floor(tile / width)
  for (const b of state.buildings.values()) {
    if (b.type !== 'defense' || b.ownerId !== defenderId) continue
    const bx = b.tile % width
    const by = Math.floor(b.tile / width)
    if (torusDistance(tx, ty, bx, by, width, height) <= defenseRange(b.level)) {
      return DEFENSE_MAG_MULTIPLIER
    }
  }
  return 1
}

/**
 * Verteidigungs-Multiplikator für die Angreifer-Verluste, wenn der Verteidiger
 * ein geächteter Verräter ist: gegen Nationen, die er NICHT selbst gerade
 * angreift, verteidigt er um TRAITOR_DEFENSE_PENALTY geschwächt (Angreifer
 * verlieren entsprechend weniger). Greift er den Angreifer selbst an, kein Malus.
 */
function traitorDefenseMul(state: GameState, defenderId: number, attackerId: number): number {
  if (defenderId <= 0) return 1
  const defender = state.players.get(defenderId)
  if (defender === undefined || defender.traitorUntil <= state.tick) return 1
  // Greift der Verräter den aktuellen Angreifer selbst an? Dann kein Malus.
  for (const atk of defender.attacks) {
    if (atk.targetPlayerId === attackerId) return 1
  }
  return TRAITOR_DEFENSE_PENALTY
}

function updatePeakStats(state: GameState): void {
  for (const p of state.players.values()) {
    if (p.troops > p.peakTroops) p.peakTroops = p.troops
    if (p.tilesOwned > p.peakTilesOwned) p.peakTilesOwned = p.tilesOwned
  }
}

function applyIntents(state: GameState, intents: readonly Intent[]): void {
  const sorted = [...intents].sort((a, b) => a.playerId - b.playerId)
  for (const intent of sorted) {
    switch (intent.type) {
      case 'attack':
        applyAttackIntent(state, intent)
        break
      case 'cancel-attack':
        applyCancelAttackIntent(state, intent)
        break
      case 'build':
        applyBuildIntent(state, intent)
        break
      case 'upgrade':
        applyUpgradeIntent(state, intent)
        break
      case 'request-alliance':
        applyRequestAllianceIntent(state, intent)
        break
      case 'accept-alliance':
        applyAcceptAllianceIntent(state, intent)
        break
      case 'break-alliance':
        applyBreakAllianceIntent(state, intent)
        break
      case 'set-embargo':
        applySetEmbargoIntent(state, intent)
        break
    }
  }
}

/** Anzahl Gebäude eines Typs die `playerId` besitzt (für eskalierende Kosten). */
export function countBuildingsOfType(
  state: GameState,
  playerId: number,
  type: BuildingType,
): number {
  let n = 0
  for (const b of state.buildings.values()) {
    if (b.ownerId === playerId && b.type === type) n++
  }
  return n
}

/** Prüft ob ein Tile in `PORT_WATER_RANGE` an Wasser grenzt (für Hafen-Bau). */
export function nearWater(state: GameState, tile: TileRef): boolean {
  const { width, height } = state.map
  const tx = tile % width
  const ty = Math.floor(tile / width)
  const r = PORT_WATER_RANGE
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const ref = tileRef(tx + dx, ty + dy, width, height)
      if (!isLand(state.map.terrain, ref)) return true
    }
  }
  return false
}

/**
 * Darf `playerId` auf `tile` ein Gebäude vom Typ `type` bauen? Single Source of
 * Truth für `applyBuildIntent` UND die UI-Platzierungsvorschau (Geist grün/rot).
 * Prüft Besitz, Begehbarkeit, freies Tile, Hafen-am-Wasser und Gold.
 */
export function canBuildAt(
  state: GameState,
  playerId: number,
  tile: TileRef,
  type: BuildingType,
): boolean {
  const player = state.players.get(playerId)
  if (player === undefined || !player.isAlive) return false
  if (tile < 0 || tile >= state.map.state.length) return false
  if (getOwner(state.map, tile) !== playerId) return false // nur eigenes Tile
  if (!isPassable(state.map.terrain, tile)) return false
  if (state.buildings.has(tile)) return false // schon bebaut
  if (type === 'port' && !nearWater(state, tile)) return false
  const cost = buildCost(type, countBuildingsOfType(state, playerId, type))
  return player.gold >= cost
}

function applyBuildIntent(state: GameState, intent: BuildIntent): void {
  const player = state.players.get(intent.playerId)
  if (player === undefined) return
  if (!canBuildAt(state, intent.playerId, intent.tile, intent.buildingType)) return

  const cost = buildCost(
    intent.buildingType,
    countBuildingsOfType(state, player.id, intent.buildingType),
  )
  player.gold -= cost
  state.buildings.set(intent.tile, {
    type: intent.buildingType,
    ownerId: player.id,
    tile: intent.tile,
    level: 1,
  })
}

function applyUpgradeIntent(state: GameState, intent: UpgradeIntent): void {
  const player = state.players.get(intent.playerId)
  if (player === undefined || !player.isAlive) return
  const b = state.buildings.get(intent.tile)
  if (b === undefined || b.ownerId !== player.id) return
  if (b.level >= MAX_BUILDING_LEVEL) return
  // Tile könnte zwischenzeitlich verloren sein
  if (getOwner(state.map, intent.tile) !== player.id) return

  const cost = upgradeCost(b.type, b.level)
  if (player.gold < cost) return
  player.gold -= cost
  b.level++
}

/* ============================================================================
 * Diplomatie-Intents
 * ========================================================================== */

/** Beide Spieler existieren und leben? Liefert die beiden Player oder null. */
function livingPair(state: GameState, a: number, b: number): [Player, Player] | null {
  if (a === b) return null
  const pa = state.players.get(a)
  const pb = state.players.get(b)
  if (pa === undefined || pb === undefined || !pa.isAlive || !pb.isAlive) return null
  return [pa, pb]
}

function applyRequestAllianceIntent(state: GameState, intent: RequestAllianceIntent): void {
  const pair = livingPair(state, intent.playerId, intent.targetPlayerId)
  if (pair === null) return
  const [from, to] = pair
  if (areAllied(state.alliances, from.id, to.id)) return
  // Hatte die Gegenseite bereits angefragt → Bündnis kommt sofort zustande.
  if (hasAllianceRequest(state.allianceRequests, to.id, from.id)) {
    state.allianceRequests.delete(directedKey(to.id, from.id))
    state.alliances.add(pairKey(from.id, to.id))
    emitEvent(state, `${from.name} und ${to.name} sind verbündet`, from.color)
    return
  }
  if (hasAllianceRequest(state.allianceRequests, from.id, to.id)) return
  state.allianceRequests.add(directedKey(from.id, to.id))
  emitEvent(state, `${from.name} bietet ${to.name} ein Bündnis an`, from.color)
}

function applyAcceptAllianceIntent(state: GameState, intent: AcceptAllianceIntent): void {
  const pair = livingPair(state, intent.playerId, intent.targetPlayerId)
  if (pair === null) return
  const [accepter, requester] = pair
  // Es muss ein Angebot requester→accepter geben.
  if (!hasAllianceRequest(state.allianceRequests, requester.id, accepter.id)) return
  state.allianceRequests.delete(directedKey(requester.id, accepter.id))
  state.alliances.add(pairKey(accepter.id, requester.id))
  emitEvent(state, `${accepter.name} und ${requester.name} sind verbündet`, accepter.color)
}

function applyBreakAllianceIntent(state: GameState, intent: BreakAllianceIntent): void {
  const pair = livingPair(state, intent.playerId, intent.targetPlayerId)
  if (pair === null) return
  const [traitor, betrayed] = pair
  if (!areAllied(state.alliances, traitor.id, betrayed.id)) return
  state.alliances.delete(pairKey(traitor.id, betrayed.id))
  traitor.traitorUntil = state.tick + AECHTUNG_DURATION_TICKS
  emitEvent(state, `${traitor.name} verrät ${betrayed.name}!`, traitor.color)
}

function applySetEmbargoIntent(state: GameState, intent: SetEmbargoIntent): void {
  const pair = livingPair(state, intent.playerId, intent.targetPlayerId)
  if (pair === null) return
  const [from, to] = pair
  const key = directedKey(from.id, to.id)
  if (intent.enabled) {
    if (state.embargoes.has(key)) return
    state.embargoes.add(key)
    emitEvent(state, `${from.name} verhängt ein Embargo gegen ${to.name}`, from.color)
  } else {
    if (!state.embargoes.has(key)) return
    state.embargoes.delete(key)
    emitEvent(state, `${from.name} hebt das Embargo gegen ${to.name} auf`, from.color)
  }
}

function applyAttackIntent(state: GameState, intent: AttackIntent): void {
  const player = state.players.get(intent.playerId)
  if (player === undefined || !player.isAlive) return
  if (intent.targetTile < 0 || intent.targetTile >= state.map.state.length) return
  // Ziel muss begehbares Land sein — auf Wasser/unpassierbare Berge gibt's nichts zu erobern.
  if (!isPassable(state.map.terrain, intent.targetTile)) return

  const targetOwner = getOwner(state.map, intent.targetTile)
  if (targetOwner === player.id) return // kein Selbst-Angriff
  // Verbündete kann man nicht angreifen — erst das Bündnis brechen.
  if (targetOwner > 0 && areAllied(state.alliances, player.id, targetOwner)) return

  const troops = Math.min(intent.troops, player.troops)
  if (troops <= 0) return

  // Erreicht der Spieler das Ziel über Land (gemeinsame Land-Komponente an der
  // Frontier)? Sonst ist es eine andere Landmasse → Transport-Boot nötig.
  if (!reachableByLand(state, player, intent.targetTile)) {
    tryLaunchBoat(state, player, intent.targetTile)
    return
  }

  player.troops -= troops
  player.attacks.push({
    targetPlayerId: targetOwner,
    reserveTroops: troops,
    focusTile: intent.targetTile,
  })
}

/** Liegt eine Frontier-Kachel des Spielers auf derselben Land-Komponente wie das Ziel? */
function reachableByLand(state: GameState, player: Player, targetTile: TileRef): boolean {
  const targetComp = state.landComponents[targetTile]
  if (targetComp === undefined || targetComp < 0) return false
  for (const f of player.frontier) {
    if (state.landComponents[f] === targetComp) return true
  }
  return false
}

/**
 * Versucht ein Transport-Boot zum Ziel zu starten: prüft Boot-Limit, sammelt die
 * eigenen Tiles als mögliche Start-Küsten und plant die Wasserroute. Nimmt
 * BOAT_TROOP_FRACTION der Truppen mit. Schlägt der Plan fehl, passiert nichts.
 */
function tryLaunchBoat(state: GameState, player: Player, targetTile: TileRef): void {
  const activeBoats = state.boats.reduce((n, b) => (b.ownerId === player.id ? n + 1 : n), 0)
  if (activeBoats >= MAX_BOATS_PER_PLAYER) return

  const troops = Math.floor(player.troops * BOAT_TROOP_FRACTION)
  if (troops <= 0) return

  const ownerTiles = collectOwnerTiles(state, player.id)
  const plan = planBoatLaunch(state.map, state.waterComponents, ownerTiles, targetTile)
  if (plan === null) return

  player.troops -= troops
  state.boats.push({ ownerId: player.id, troops, path: plan.path, progress: 0, targetTile })
}

/** Alle Tiles die `playerId` besitzt (für Boot-Start-Küsten). O(N) — nur bei Boot-Start. */
function collectOwnerTiles(state: GameState, playerId: number): TileRef[] {
  const tiles: TileRef[] = []
  for (let i = 0; i < state.map.state.length; i++) {
    if (getOwner(state.map, i) === playerId) tiles.push(i)
  }
  return tiles
}

function applyCancelAttackIntent(state: GameState, intent: CancelAttackIntent): void {
  const player = state.players.get(intent.playerId)
  if (player === undefined || !player.isAlive) return

  const attack = player.attacks[intent.attackIndex]
  if (attack === undefined) return

  // Reserve-Truppen zurück in den Spieler-Pool
  player.troops += attack.reserveTroops
  player.attacks.splice(intent.attackIndex, 1)
}

function growPopulations(state: GameState): void {
  for (const player of orderedPlayers(state)) {
    if (!player.isAlive) continue
    const max = maxTroops(player.tilesOwned) + cityCapBonus(state, player.id)
    player.troops += troopIncreaseRate(player.troops, max)
  }
}

/** Effektiver Truppen-Cap inkl. Stadt-Bonus (für HUD/AI). */
export function effectiveMaxTroops(state: GameState, playerId: number): number {
  const p = state.players.get(playerId)
  if (p === undefined) return 0
  return maxTroops(p.tilesOwned) + cityCapBonus(state, playerId)
}

/** Hängt ein Ereignis ans Log (chronologisch). */
function emitEvent(state: GameState, text: string, color?: number): void {
  state.events.push(
    color === undefined ? { tick: state.tick, text } : { tick: state.tick, text, color },
  )
}

/* ============================================================================
 * Schiffe — Transport-Boote & Handel
 * ========================================================================== */

function advanceBoats(state: GameState): void {
  if (state.boats.length === 0) return
  const survivors: Boat[] = []
  for (const boat of state.boats) {
    boat.progress += BOAT_SPEED
    if (shipArrived(boat)) {
      landBoat(state, boat)
    } else {
      survivors.push(boat)
    }
  }
  state.boats = survivors
}

/**
 * Boot landet am Ziel-Tile: erobert es als Brückenkopf (zahlt die Tile-Kosten
 * gegen den Verteidiger) und übergibt die Resttruppen an einen normalen Angriff,
 * der von dort weiterläuft. Verliert das Boot den Landekampf, sind die Truppen weg.
 */
function landBoat(state: GameState, boat: Boat): void {
  const attacker = state.players.get(boat.ownerId)
  if (attacker === undefined || !attacker.isAlive) return // Truppen verloren

  const target = boat.targetTile
  const owner = getOwner(state.map, target)
  if (owner === boat.ownerId) {
    attacker.troops += boat.troops // schon unser → Truppen zurück in den Pool
    return
  }

  const defender = owner > 0 ? state.players.get(owner) : undefined
  const vsNull = owner === 0 || defender === undefined || !defender.isAlive
  const defTroops = vsNull ? 0 : (defender?.troops ?? 0)
  const defTiles = vsNull ? 1 : (defender?.tilesOwned ?? 1)
  const mag =
    terrainMagnitude(state.map.terrain, target) * defenseMagMultiplier(state, target, owner)
  const aLoss =
    attackerLossPerTile(boat.troops, defTroops, defTiles, vsNull, mag) *
    traitorDefenseMul(state, owner, boat.ownerId)

  if (boat.troops <= aLoss) return // gescheiterte Landung, Truppen verloren

  if (!vsNull && defender !== undefined) {
    const dLoss = defenderLossPerTile(defender.troops, defender.tilesOwned, false)
    defender.troops = Math.max(0, Math.floor(defender.troops - dLoss))
  }

  const remaining = Math.floor(boat.troops - aLoss)
  captureTile(state, target, boat.ownerId) // setzt Frontier auf der neuen Landmasse
  attacker.attacks.push({ targetPlayerId: owner, reserveTroops: remaining, focusTile: target })
  emitEvent(state, `${attacker.name} landet Truppen an`, attacker.color)
}

/** Häfen senden gestaffelt Handelsschiffe zu erreichbaren, fremden Häfen. */
function spawnTradeShips(state: GameState): void {
  const ports: TileRef[] = []
  for (const b of state.buildings.values()) {
    if (b.type === 'port') ports.push(b.tile)
  }
  if (ports.length < 2) return
  ports.sort((a, b) => a - b)

  const { width, height } = state.map
  for (const origin of ports) {
    // Staffelung: jeder Hafen ist in einem festen Tick seines Intervall-Fensters dran.
    if (state.tick % TRADE_INTERVAL_TICKS !== origin % TRADE_INTERVAL_TICKS) continue
    const originOwner = getOwner(state.map, origin)
    if (originOwner === 0) continue

    // nächstgelegenen erreichbaren Hafen eines anderen Spielers wählen
    const ox = origin % width
    const oy = Math.floor(origin / width)
    let best = -1
    let bestDist = Infinity
    for (const dest of ports) {
      if (dest === origin) continue
      const destOwner = getOwner(state.map, dest)
      if (destOwner === 0 || destOwner === originOwner) continue
      if (isTradeEmbargoed(state, originOwner, destOwner)) continue
      const dx = dest % width
      const dy = Math.floor(dest / width)
      const d = torusDistance(ox, oy, dx, dy, width, height)
      if (d < bestDist) {
        bestDist = d
        best = dest
      }
    }
    if (best === -1) continue

    const path = planWaterRoute(state.map, state.waterComponents, origin, best)
    if (path === null || path.length < 2) continue
    state.tradeShips.push({
      fromOwnerId: originOwner,
      toOwnerId: getOwner(state.map, best),
      path,
      progress: 0,
      gold: tradeGold(path.length),
      originPort: origin,
      destPort: best,
    })
  }
}

/** Ruht der Handel zwischen `from` und `to` wegen eines Embargos einer der Seiten? */
function isTradeEmbargoed(state: GameState, from: number, to: number): boolean {
  return isTradeBlocked(state.embargoes, from, to)
}

function advanceTradeShips(state: GameState): void {
  if (state.tradeShips.length === 0) return
  const survivors: TradeShip[] = []
  for (const ship of state.tradeShips) {
    ship.progress += TRADE_SHIP_SPEED
    if (shipArrived(ship)) {
      // Gold an beide noch lebenden Hafen-Besitzer
      const from = state.players.get(ship.fromOwnerId)
      const to = state.players.get(ship.toOwnerId)
      if (from !== undefined && from.isAlive) from.gold += ship.gold
      if (to !== undefined && to.isAlive) to.gold += ship.gold
    } else {
      survivors.push(ship)
    }
  }
  state.tradeShips = survivors
}

function checkEliminations(state: GameState): void {
  for (const player of state.players.values()) {
    if (player.isAlive && player.tilesOwned === 0) {
      player.isAlive = false
      emitEvent(state, `${player.name} wurde eliminiert`, player.color)
      // Eventuell laufende Angriffe sind durch tilesOwned=0 implizit gestoppt;
      // Reserve-Truppen werden hier nicht zurückgegeben — Spieler ist eh raus.
      player.attacks = []
      player.troops = 0
    }
  }
}

function checkVictory(state: GameState): void {
  if (state.phase === 'ended') return
  // Sieg-Schwelle bezieht sich auf eroberbare Tiles (Land), nicht auf den gesamten
  // Bitmap-Bereich — sonst wäre Sieg auf einer Insel-Karte mit 35% Land unmöglich.
  let landTotal = 0
  for (let i = 0; i < state.map.terrain.length; i++) {
    if (isPassable(state.map.terrain, i)) landTotal++
  }
  const totalTiles = landTotal > 0 ? landTotal : state.map.width * state.map.height
  const threshold = state.config.victoryPct / 100
  for (const player of orderedPlayers(state)) {
    if (!player.isAlive) continue
    if (player.tilesOwned / totalTiles >= threshold) {
      state.phase = 'ended'
      state.winner = player.id
      emitEvent(state, `${player.name} hat das Match gewonnen!`, player.color)
      return
    }
  }
}

/* ============================================================================
 * Attack-Resolution
 * ========================================================================== */

function resolveAttacks(state: GameState): void {
  for (const player of orderedPlayers(state)) {
    if (!player.isAlive) continue
    // Iteration rückwärts, weil wir gelöschte Angriffe aus dem Array entfernen
    for (let i = player.attacks.length - 1; i >= 0; i--) {
      const attack = player.attacks[i]
      if (attack === undefined) continue
      const stillActive = advanceAttack(state, player, attack)
      if (!stillActive) {
        player.attacks.splice(i, 1)
      }
    }
  }
}

/** Erweitert einen einzelnen Angriff um einen Tick. Returnt `true` wenn der Angriff weiter aktiv ist. */
function advanceAttack(state: GameState, attacker: Player, attack: Attack): boolean {
  if (attack.reserveTroops <= 0) return false

  const defender = attack.targetPlayerId > 0 ? state.players.get(attack.targetPlayerId) : undefined
  // Wenn das ursprüngliche Ziel ein Spieler war der zwischenzeitlich eliminiert wurde,
  // behandeln wir verbleibende Tiles als TerraNullius. Defender-Truppen = 0.
  const vsTerraNullius = attack.targetPlayerId === 0 || defender === undefined || !defender.isAlive

  const targetId = vsTerraNullius ? 0 : attack.targetPlayerId
  const { frontWidth, tiles } = collectAttackableTiles(state, attacker, targetId)

  if (frontWidth === 0 || tiles.length === 0) {
    // Kein Fortschritt — Angriff bleibt aktiv, vielleicht öffnet sich später eine Front
    return true
  }

  const defenderTroops = vsTerraNullius ? 0 : (defender?.troops ?? 0)
  const defenderTilesOwned = vsTerraNullius ? 1 : (defender?.tilesOwned ?? 1)

  const speedMul = state.config.matchSpeed ?? 1
  const rate =
    tilesPerTick(attack.reserveTroops, defenderTroops, frontWidth, vsTerraNullius) * speedMul
  const integerPart = Math.floor(rate)
  const fraction = rate - integerPart
  const extra = state.rng.next() < fraction ? 1 : 0
  const wantCapture = Math.min(integerPart + extra, tiles.length)

  if (wantCapture <= 0) return true

  // Direktionale Wave: sortiere eroberbare Tiles nach Torus-Distanz zum focus.
  // So fließt der Angriff zum Klick-Punkt hin statt diamantförmig in alle Richtungen.
  // Vorher shufflen damit Tiles mit gleicher Distanz zufällig (aber deterministisch)
  // sortiert sind — sonst hängt die Wahl an der Insertion-Order des Frontier-Sets.
  state.rng.shuffleArray(tiles)
  const { width: mapW, height: mapH } = state.map
  const focusX = attack.focusTile % mapW
  const focusY = Math.floor(attack.focusTile / mapW)
  tiles.sort((a, b) => {
    const ax = a % mapW
    const ay = Math.floor(a / mapW)
    const bx = b % mapW
    const by = Math.floor(b / mapW)
    return (
      torusDistance(ax, ay, focusX, focusY, mapW, mapH) -
      torusDistance(bx, by, focusX, focusY, mapW, mapH)
    )
  })

  for (let i = 0; i < wantCapture; i++) {
    if (attack.reserveTroops <= 0) break
    const ref = tiles[i]
    if (ref === undefined) break

    // Recheck — könnte durch parallelen Angriff schon erobert worden sein
    const currentOwner = getOwner(state.map, ref)
    if (currentOwner === attacker.id) continue
    // Wenn ein anderer Spieler (≠ ursprüngliches Ziel, ≠ neutral) jetzt der Besitzer ist:
    // dieser Angriff zielt nicht auf den — überspringen
    if (!vsTerraNullius && currentOwner !== targetId && currentOwner !== 0) continue

    const isCurrentlyTerraNullius = currentOwner === 0
    // Terrain-Magnitude, multipliziert mit Verteidigungsposten-Bonus des Verteidigers.
    const mag =
      terrainMagnitude(state.map.terrain, ref) * defenseMagMultiplier(state, ref, currentOwner)
    const aLoss =
      attackerLossPerTile(
        attack.reserveTroops,
        isCurrentlyTerraNullius ? 0 : defenderTroops,
        isCurrentlyTerraNullius ? 1 : defenderTilesOwned,
        isCurrentlyTerraNullius,
        mag,
      ) * traitorDefenseMul(state, currentOwner, attacker.id)

    if (attack.reserveTroops < aLoss) {
      attack.reserveTroops = 0
      break
    }

    attack.reserveTroops = Math.max(0, Math.floor(attack.reserveTroops - aLoss))

    if (!isCurrentlyTerraNullius && defender !== undefined) {
      const dLoss = defenderLossPerTile(defender.troops, defender.tilesOwned, false)
      defender.troops = Math.max(0, Math.floor(defender.troops - dLoss))
    }

    captureTile(state, ref, attacker.id)
  }

  return attack.reserveTroops > 0
}

/**
 * Sammelt die Tiles des Ziels (oder TerraNullius), die an die Frontier des
 * Angreifers grenzen — und zählt wieviele Frontier-Tiles tatsächlich am Ziel anstoßen.
 */
function collectAttackableTiles(
  state: GameState,
  attacker: Player,
  targetId: number,
): { readonly frontWidth: number; readonly tiles: TileRef[] } {
  const { map } = state
  const { width, height } = map
  const tilesSet = new Set<TileRef>()
  let frontWidth = 0

  for (const ref of attacker.frontier) {
    let borders = false
    for (const n of neighbors4(ref, width, height)) {
      if (!isPassable(map.terrain, n)) continue
      if (getOwner(map, n) === targetId) {
        tilesSet.add(n)
        borders = true
      }
    }
    if (borders) frontWidth++
  }

  return { frontWidth, tiles: [...tilesSet] }
}

/** Erobert ein Tile für `attackerId`, aktualisiert tilesOwned und Frontier-Sets. */
function captureTile(state: GameState, ref: TileRef, attackerId: number): void {
  const { map, players } = state
  const oldOwner = getOwner(map, ref)
  if (oldOwner === attackerId) return

  setOwner(map, ref, attackerId)

  // Gebäude auf dem eroberten Tile wird zerstört (Investition geht verloren).
  state.buildings.delete(ref)

  const attacker = players.get(attackerId)
  if (attacker !== undefined) attacker.tilesOwned++

  if (oldOwner > 0) {
    const oldPlayer = players.get(oldOwner)
    if (oldPlayer !== undefined) oldPlayer.tilesOwned--
  }

  updateFrontierAfterCapture(state, ref, oldOwner, attackerId)
}

/**
 * Inkrementelles Frontier-Update nach einem Owner-Wechsel.
 *
 * Drei Effekte:
 *   1. `ref` raus aus `oldOwner.frontier` (gehört nicht mehr ihm)
 *   2. `ref` ggf. in `newOwner.frontier` (wenn er noch Nicht-eigene Nachbarn hat)
 *   3. Für jeden Nachbarn `n` von `ref`: ggf. Frontier-Status neu bewerten
 *      - Nachbar `n` gehört `newOwner`: war evtl. wegen `ref` (Nicht-eigenes) im
 *        Frontier; jetzt prüfen ob noch andere Nicht-eigene Nachbarn da sind
 *      - Nachbar `n` gehört einem anderen Spieler: er hat jetzt einen weiteren
 *        Fremd-Nachbarn → ist (immer noch / jetzt erst) im Frontier
 */
function updateFrontierAfterCapture(
  state: GameState,
  ref: TileRef,
  oldOwner: number,
  newOwner: number,
): void {
  const { map, players } = state
  const { width, height } = map

  if (oldOwner > 0) {
    players.get(oldOwner)?.frontier.delete(ref)
  }

  const newPlayer = players.get(newOwner)
  if (newPlayer === undefined) return

  const refNeighbors = neighbors4(ref, width, height)

  // Ist `ref` neue Frontier von `newOwner`?
  let refIsFrontier = false
  for (const n of refNeighbors) {
    if (!isPassable(map.terrain, n)) continue
    if (getOwner(map, n) !== newOwner) {
      refIsFrontier = true
      break
    }
  }
  if (refIsFrontier) newPlayer.frontier.add(ref)

  // Nachbar-Status updaten
  for (const n of refNeighbors) {
    const nOwner = getOwner(map, n)
    if (nOwner === 0) continue
    const nPlayer = players.get(nOwner)
    if (nPlayer === undefined) continue

    if (nOwner === newOwner) {
      // n gehört newOwner — muss prüfen ob noch Land-Fremd-Nachbarn da sind
      let stillFrontier = false
      for (const nn of neighbors4(n, width, height)) {
        if (!isPassable(map.terrain, nn)) continue
        if (getOwner(map, nn) !== newOwner) {
          stillFrontier = true
          break
        }
      }
      if (!stillFrontier) nPlayer.frontier.delete(n)
    } else {
      // n gehört jemand anderem (oldOwner oder dritter Spieler) — hat jetzt newOwner-Tile als Nachbar
      nPlayer.frontier.add(n)
    }
  }
}

/* ============================================================================
 * Helpers
 * ========================================================================== */

/** Spieler in deterministischer Reihenfolge (nach ID aufsteigend). */
function orderedPlayers(state: GameState): Player[] {
  return [...state.players.values()].sort((a, b) => a.id - b.id)
}
