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
import { type TileRef, neighbors4, tileRef, torusDistance } from '../world/torus'
import { BOT_START_TROOPS, HUMAN_START_TROOPS, maxTroops, troopIncreaseRate } from './config'
import type { AttackIntent, CancelAttackIntent, Intent } from './intent'
import { createPRNG, type PRNG } from './random'

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
  readonly players: readonly PlayerDef[]
}

export interface Attack {
  /** 0 = TerraNullius (neutrales Gebiet) */
  targetPlayerId: number
  reserveTroops: number
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
}

export type GamePhase = 'running' | 'ended'

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
  const players = new Map<number, Player>()

  for (const def of config.players) {
    players.set(def.id, {
      id: def.id,
      name: def.name,
      color: def.color,
      isHuman: def.isHuman,
      troops: def.isHuman ? HUMAN_START_TROOPS : BOT_START_TROOPS,
      tilesOwned: 0,
      frontier: new Set<TileRef>(),
      attacks: [],
      isAlive: true,
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
    const [cx, cy] = findSpawnCenter(rng, width, height, placedCenters, minDist)
    placedCenters.push([cx, cy])

    for (let dy = -SPAWN_HALF_SIZE; dy <= SPAWN_HALF_SIZE; dy++) {
      for (let dx = -SPAWN_HALF_SIZE; dx <= SPAWN_HALF_SIZE; dx++) {
        const ref = tileRef(cx + dx, cy + dy, width, height)
        // Nur claim wenn neutral — schützt vor späteren Spawns die überlappen würden
        if (getOwner(map, ref) === 0) {
          setOwner(map, ref, player.id)
          player.tilesOwned++
        }
      }
    }
  }
}

function findSpawnCenter(
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
    let valid = true
    for (const [ox, oy] of placedCenters) {
      if (torusDistance(x, y, ox, oy, width, height) < minDist) {
        valid = false
        break
      }
    }
    if (valid) return [x, y]
  }
  // Fallback: random point, may overlap with existing spawns
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
 *   3. (TBD) Attack-Resolution — eigener Commit
 *   4. Eliminierte Spieler markieren (tilesOwned == 0)
 *   5. Sieg-Check — bei Erreichen der Schwelle phase='ended', winner gesetzt
 *      Match läuft trotzdem weiter (Jonathan: Spieler soll KI weiter beobachten)
 *   6. tick++
 */
export function tick(state: GameState, intents: readonly Intent[]): GameState {
  applyIntents(state, intents)
  growPopulations(state)
  // resolveAttacks(state)  — kommt im nächsten Commit
  checkEliminations(state)
  checkVictory(state)
  state.tick++
  return state
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
    }
  }
}

function applyAttackIntent(state: GameState, intent: AttackIntent): void {
  const player = state.players.get(intent.playerId)
  if (player === undefined || !player.isAlive) return
  if (intent.targetTile < 0 || intent.targetTile >= state.map.state.length) return

  const targetOwner = getOwner(state.map, intent.targetTile)
  if (targetOwner === player.id) return // kein Selbst-Angriff

  const troops = Math.min(intent.troops, player.troops)
  if (troops <= 0) return

  player.troops -= troops
  player.attacks.push({
    targetPlayerId: targetOwner,
    reserveTroops: troops,
  })
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
    const max = maxTroops(player.tilesOwned)
    player.troops += troopIncreaseRate(player.troops, max)
  }
}

function checkEliminations(state: GameState): void {
  for (const player of state.players.values()) {
    if (player.isAlive && player.tilesOwned === 0) {
      player.isAlive = false
      // Eventuell laufende Angriffe sind durch tilesOwned=0 implizit gestoppt;
      // Reserve-Truppen werden hier nicht zurückgegeben — Spieler ist eh raus.
      player.attacks = []
      player.troops = 0
    }
  }
}

function checkVictory(state: GameState): void {
  if (state.phase === 'ended') return
  const totalTiles = state.map.width * state.map.height
  const threshold = state.config.victoryPct / 100
  for (const player of orderedPlayers(state)) {
    if (!player.isAlive) continue
    if (player.tilesOwned / totalTiles >= threshold) {
      state.phase = 'ended'
      state.winner = player.id
      return
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
