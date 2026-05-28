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
  PLAINS_MAG,
  generateTerrain,
  isLand,
  isPassable,
  terrainMagnitude,
  tileTroopWeight,
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
  BUILD_TIME_TICKS,
  CITY_CAP_BONUS,
  DEFENSE_MAG_MULTIPLIER,
  MAX_BUILDING_LEVEL,
  PORT_WATER_RANGE,
  buildCost,
  defenseRange,
  isBuildingComplete,
  upgradeCost,
} from './buildings'
import type {
  AcceptAllianceIntent,
  AttackIntent,
  BoatIntent,
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
  ALLIANCE_DURATION_TICKS,
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
  /**
   * Aktueller Front-Schwerpunkt (folgt der vorrückenden Grenze) — nur für die
   * Anzeige (Angriffs-Pille). Startet auf `focusTile` und wird pro Tick auf den
   * Mittelpunkt der gerade eroberten Tiles nachgeführt.
   */
  frontTile: TileRef
  /** Tick, an dem der Angriff gestartet wurde (für die Dauer-Anzeige im HUD). */
  startTick: number
}

export interface Player {
  readonly id: number
  readonly name: string
  readonly color: number
  readonly isHuman: boolean
  troops: number
  tilesOwned: number
  /**
   * Terrain-gewichtete Tile-Summe (Ebene 1.5 / Hügel 1 / Berg 0.5) — Basis für den
   * Truppen-Cap. Plains-reiche Nationen tragen mehr Bevölkerung als Berg-Nationen.
   * `tilesOwned` bleibt die reine Anzahl (für Gebiets-%).
   */
  weightedTiles: number
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
  /**
   * Tiles deren Owner sich in diesem Tick geändert hat (für inkrementelles
   * Rendering). Wird zu Tick-Beginn geleert und von `captureTile` befüllt; der
   * Renderer liest sie read-only und malt nur diese (+ Nachbarn) neu.
   */
  dirtyTiles: TileRef[]
  /** Wasser-Zusammenhangskomponenten (Index pro Tile, -1 = Land). Statisch. */
  readonly waterComponents: Int32Array
  /** Begehbare-Land-Komponenten (Index pro Tile, -1 = Wasser/unpassierbar). Statisch. */
  readonly landComponents: Int32Array
  /**
   * Anzahl begehbarer (eroberbarer) Tiles — Wasser und Extrem-Berge zählen nicht.
   * Basis für Gebiets-% und Sieg-Schwelle. Statisch (Terrain ändert sich nie).
   */
  readonly passableLandCount: number
  /** Aktive Transport-Boote. */
  boats: Boat[]
  /** Aktive Handelsschiffe. */
  tradeShips: TradeShip[]
  /** Aktive Allianzen als ungeordnete Paar-Schlüssel ([[pairKey]]). */
  readonly alliances: Set<number>
  /** Ablauf-Tick je Allianz ([[pairKey]] → Tick) — Allianzen laufen automatisch aus. */
  readonly allianceExpiry: Map<number, number>
  /** Offene Bündnis-Angebote als gerichtete Schlüssel from→to ([[directedKey]]). */
  readonly allianceRequests: Set<number>
  /** Verhängte Embargos als gerichtete Schlüssel from→to. */
  readonly embargoes: Set<number>
  /**
   * „Groll" als gerichteter Schlüssel Angreifer→Opfer ([[directedKey]]) → abklingender
   * Wert, der mit jedem vom Opfer eroberten Tile steigt und pro Tick zerfällt. Misst,
   * wie viel Land ein Spieler einem anderen *kürzlich* genommen hat — Basis für den
   * roten Grenz-Tint (mit Nachglühen), unabhängig davon ob gerade aktiv angegriffen wird.
   */
  readonly grudge: Map<number, number>
}

/* ============================================================================
 * createGame
 * ========================================================================== */

const SPAWN_HALF_SIZE = 2 // 5×5-Kern muss Land sein (Zentrums-Validierung)
/** Ziel-Größe eines Start-Gebiets (Tiles) — organisch gewachsen, nicht quadratisch. */
const SPAWN_TARGET_TILES = 80

/**
 * Terrain-Aufschlag für die Wave-Sortierung: höheres Terrain wird in der
 * Eroberungs-Reihenfolge wie zusätzliche Distanz behandelt (mag-Differenz zur
 * Ebene × Faktor). Hügel ≈ +3, Berg ≈ +6 Tiles „weiter weg" → die Welle
 * umfließt Gebirgszüge deutlich sichtbar, statt sie als sauberen Diamant zu
 * schlucken (zusammen mit den kohärenten Gebirgen aus Phase 3).
 */
const TERRAIN_WAVE_PENALTY = 0.15

/**
 * Glättungs-Gewicht für die Front-Welle: jeder eigene Nachbar eines eroberbaren
 * Tiles zieht es in der Reihenfolge um so viele „Tiles näher". Hoch genug, dass
 * Buchten/Konkavitäten zuerst gefüllt werden (breite, glatte Front), aber nicht so
 * hoch, dass die Fokus-Richtung verloren geht. Verhindert dünne Finger, die fremde
 * Gebiete zerstückeln.
 */
const FRONT_SMOOTHING = 8

/**
 * Fokus-Gewicht für Angriffe auf Nationen (0..1): stark gedämpft (vs. 1.0 für
 * Wildnis), damit sich der Druck über die ganze gemeinsame Grenze verteilt, statt
 * gezielt am Klick-Punkt zu konzentrieren — gesicherte Grenzen werden zäh.
 */
const NATION_FOCUS_PULL = 0.15

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
      weightedTiles: 0,
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
    dirtyTiles: [],
    waterComponents: labelWaterComponents(map),
    landComponents: labelLandComponents(map),
    passableLandCount: countPassableLand(map),
    boats: [],
    tradeShips: [],
    alliances: new Set<number>(),
    allianceExpiry: new Map<number, number>(),
    allianceRequests: new Set<number>(),
    embargoes: new Set<number>(),
    grudge: new Map<number, number>(),
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
  const minDist = Math.max(10, Math.floor(Math.min(width, height) / players.size))
  // Spawn-Größe an die verfügbare Fläche koppeln: höchstens ~⅓ des fairen Anteils
  // pro Spieler, damit auch auf kleinen Karten alle Platz haben (sonst frisst der
  // erste Spawn alles). Auf normalen Karten greift SPAWN_TARGET_TILES.
  const passable = countPassableLand(map)
  const target = Math.max(
    6,
    Math.min(SPAWN_TARGET_TILES, Math.floor(passable / (players.size * 3))),
  )

  const placedCenters: Array<readonly [number, number]> = []
  const playerList = orderedPlayers(state)

  for (const player of playerList) {
    const [cx, cy] = findSpawnCenter(state, rng, width, height, placedCenters, minDist)
    placedCenters.push([cx, cy])
    growSpawn(state, player, cx, cy, target)
  }
}

/** Signierte kürzeste Distanz a→b auf einer Torus-Achse der Länge `size` (−size/2..size/2). */
function signedTorusDelta(a: number, b: number, size: number): number {
  let d = (a - b) % size
  if (d > size / 2) d -= size
  else if (d < -size / 2) d += size
  return d
}

/**
 * Lässt das Start-Gebiet eines Spielers von (cx,cy) zu einem soliden, aber
 * organisch geformten Blob wachsen (bis `target` Tiles). Auswahl-Kosten je Kandidat:
 *   - radiale Distanz, je Richtung durch zwei Sinus-„Lappen" verzerrt (pro Spieler
 *     zufällige Phasen) → der Blob wächst in manche Richtungen weiter, ergibt eine
 *     unregelmäßige, nicht-runde/quadratische Form
 *   - ein leichter Nachbar-Bonus glättet (Buchten zuerst, gegen Ein-Pixel-Löcher)
 *   - etwas Jitter für Kanten-Textur
 * Spart Wasser/Extrem-Berge aus. Ein Loch-Füll-Pass schließt umschlossene Tiles →
 * solider 1-Tile-Rand.
 */
function growSpawn(state: GameState, player: Player, cx: number, cy: number, target: number): void {
  const { map, rng } = state
  const { width, height } = map
  const claimedTiles: TileRef[] = []
  // Zufällige Lappen-Form pro Spieler (jeder Spawn sieht anders aus).
  const ph1 = rng.next() * Math.PI * 2
  const ph2 = rng.next() * Math.PI * 2
  const freq1 = 2 + Math.floor(rng.next() * 3) // 2..4 grobe Lappen
  const freq2 = 4 + Math.floor(rng.next() * 4) // feinere Welligkeit

  const claim = (ref: TileRef): boolean => {
    if (!isPassable(map.terrain, ref) || getOwner(map, ref) !== 0) return false
    setOwner(map, ref, player.id)
    player.tilesOwned++
    player.weightedTiles += tileTroopWeight(map.terrain, ref)
    claimedTiles.push(ref)
    return true
  }

  // Kandidaten mit (mutierbarer) Kosten; jeder neue eigene Nachbar senkt die Kosten leicht.
  const cost = new Map<TileRef, number>()
  const baseCost = (ref: TileRef): number => {
    const dx = signedTorusDelta(ref % width, cx, width)
    const dy = signedTorusDelta(Math.floor(ref / width), cy, height)
    const dist = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)
    const lobe = Math.sin(angle * freq1 + ph1) * 0.32 + Math.sin(angle * freq2 + ph2) * 0.16
    // Höheres Terrain ist teurer → der Spawn-Blob schmiegt sich ans Tiefland und
    // meidet Gebirge (Hügel ≈ +2, Berg ≈ +4 Tiles „weiter").
    const terrainCost = (terrainMagnitude(map.terrain, ref) - PLAINS_MAG) * SPAWN_TERRAIN_PENALTY
    return dist * (1 - lobe) + rng.next() * 0.8 + terrainCost
  }
  const onClaimed = (ref: TileRef): void => {
    for (const nb of neighbors4(ref, width, height)) {
      if (getOwner(map, nb) !== 0 || !isPassable(map.terrain, nb)) continue
      const prev = cost.get(nb)
      cost.set(nb, prev === undefined ? baseCost(nb) - SPAWN_FILL_BONUS : prev - SPAWN_FILL_BONUS)
    }
  }

  const center = tileRef(cx, cy, width, height)
  if (claim(center)) onClaimed(center)
  else onClaimed(center) // belegtes/Wasser-Zentrum: trotzdem von hier aus wachsen

  while (claimedTiles.length < target && cost.size > 0) {
    let best = -1
    let bestCost = Infinity
    for (const [ref, c] of cost) {
      if (c < bestCost) {
        bestCost = c
        best = ref
      }
    }
    cost.delete(best)
    if (best < 0) break
    if (claim(best)) onClaimed(best)
  }

  fillEnclosed(state, player)
}

/** Glättungs-Bonus pro bereits eigenem Nachbarn beim Spawn-Wachstum (nur glätten,
 * nicht die Lappen-Form überschreiben). */
const SPAWN_FILL_BONUS = 1.2

/** Terrain-Aufschlag beim Spawn-Wachstum (mag-Differenz zur Ebene × Faktor).
 * Hügel ≈ +2, Berg ≈ +4 Tiles „weiter" → der Spawn meidet Gebirge. */
const SPAWN_TERRAIN_PENALTY = 0.1

/**
 * Schließt Tiles, die von `player` rundum (über alle passierbaren Nachbarn)
 * umschlossen sind — verhindert Ein-Pixel-Löcher im Gebiet. Läuft bis stabil.
 */
function fillEnclosed(state: GameState, player: Player): void {
  const { map } = state
  const { width, height } = map
  let changed = true
  while (changed) {
    changed = false
    for (let ref = 0; ref < map.state.length; ref++) {
      if (getOwner(map, ref) !== 0 || !isPassable(map.terrain, ref)) continue
      let hasPassable = false
      let enclosed = true
      for (const nb of neighbors4(ref, width, height)) {
        if (!isPassable(map.terrain, nb)) continue
        hasPassable = true
        if (getOwner(map, nb) !== player.id) {
          enclosed = false
          break
        }
      }
      if (hasPassable && enclosed) {
        setOwner(map, ref, player.id)
        player.tilesOwned++
        player.weightedTiles += tileTroopWeight(map.terrain, ref)
        changed = true
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
  state.dirtyTiles.length = 0 // pro Tick frisch sammeln (für inkrementelles Rendering)
  applyIntents(state, intents)
  growPopulations(state)
  generateGold(state)
  resolveAttacks(state)
  advanceBoats(state)
  spawnTradeShips(state)
  advanceTradeShips(state)
  decayGrudge(state)
  expireAlliances(state)
  checkEliminations(state)
  checkVictory(state)
  updatePeakStats(state)
  state.tick++
  return state
}

/** Faktor pro Tick, mit dem „Groll" abklingt (Nachglühen über ~viele Sekunden). */
const GRUDGE_DECAY = 0.99
/** Unter diesem Wert wird ein Groll-Eintrag gelöscht (gilt als vergessen). */
const GRUDGE_MIN = 1

/** Beendet abgelaufene Allianzen (Laufzeit überschritten) und meldet das im Log. */
function expireAlliances(state: GameState): void {
  if (state.allianceExpiry.size === 0) return
  for (const [key, expiresAt] of state.allianceExpiry) {
    if (state.tick < expiresAt) continue
    state.alliances.delete(key)
    state.allianceExpiry.delete(key)
    const a = state.players.get(Math.floor(key / 4096))
    const b = state.players.get(key % 4096)
    if (a !== undefined && b !== undefined) {
      emitEvent(state, `Allianz zwischen ${a.name} und ${b.name} ausgelaufen`, a.color)
    }
  }
}

/** Lässt allen aufgebauten Groll pro Tick etwas abklingen; vergisst Kleinstwerte. */
function decayGrudge(state: GameState): void {
  if (state.grudge.size === 0) return
  for (const [key, value] of state.grudge) {
    const next = value * GRUDGE_DECAY
    if (next < GRUDGE_MIN) state.grudge.delete(key)
    else state.grudge.set(key, next)
  }
}

function generateGold(state: GameState): void {
  // Flaches Gold-Einkommen pro lebendem Spieler (+ Handelsschiff-Gold beim Eintreffen).
  for (const player of state.players.values()) {
    if (player.isAlive) player.gold += BASE_GOLD_PER_TICK
  }
}

/** Truppen-Cap-Bonus eines Spielers aus seinen Städten. */
function cityCapBonus(state: GameState, playerId: number): number {
  let bonus = 0
  for (const b of state.buildings.values()) {
    if (b.type === 'city' && b.ownerId === playerId && isBuildingComplete(b, state.tick))
      bonus += CITY_CAP_BONUS * b.level
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
    if (b.type !== 'defense' || b.ownerId !== defenderId || !isBuildingComplete(b, state.tick))
      continue
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
      case 'boat':
        applyBoatIntent(state, intent)
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
    completesAtTick: state.tick + BUILD_TIME_TICKS,
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

/** Schließt eine Allianz (a,b) und setzt ihren Ablauf-Tick. */
function formAlliance(state: GameState, a: number, b: number): void {
  const key = pairKey(a, b)
  state.alliances.add(key)
  state.allianceExpiry.set(key, state.tick + ALLIANCE_DURATION_TICKS)
}

function applyRequestAllianceIntent(state: GameState, intent: RequestAllianceIntent): void {
  const pair = livingPair(state, intent.playerId, intent.targetPlayerId)
  if (pair === null) return
  const [from, to] = pair
  if (areAllied(state.alliances, from.id, to.id)) return
  // Hatte die Gegenseite bereits angefragt → Bündnis kommt sofort zustande.
  if (hasAllianceRequest(state.allianceRequests, to.id, from.id)) {
    state.allianceRequests.delete(directedKey(to.id, from.id))
    formAlliance(state, from.id, to.id)
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
  formAlliance(state, accepter.id, requester.id)
  emitEvent(state, `${accepter.name} und ${requester.name} sind verbündet`, accepter.color)
}

function applyBreakAllianceIntent(state: GameState, intent: BreakAllianceIntent): void {
  const pair = livingPair(state, intent.playerId, intent.targetPlayerId)
  if (pair === null) return
  const [traitor, betrayed] = pair
  if (!areAllied(state.alliances, traitor.id, betrayed.id)) return
  state.alliances.delete(pairKey(traitor.id, betrayed.id))
  state.allianceExpiry.delete(pairKey(traitor.id, betrayed.id))
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

  // Angriffe wirken nur über Land. Eine andere Landmasse erreicht man bewusst
  // über den Boot-Modus (BoatIntent), nicht implizit per Angriffs-Klick.
  if (!reachableByLand(state, player, intent.targetTile)) return

  player.troops -= troops
  player.attacks.push({
    targetPlayerId: targetOwner,
    reserveTroops: troops,
    focusTile: intent.targetTile,
    frontTile: intent.targetTile,
    startTick: state.tick,
  })
}

/**
 * Bewusster Boot-Befehl (Boot-Modus): schickt EIN Transport-Boot mit der per
 * Slider gewählten Truppenzahl zu einem Küsten-Ziel auf einer anderen Landmasse.
 * Schlägt der Start fehl (kein Wasserweg von eigener Küste, Boot-Limit, Ziel über
 * Land erreichbar), gibt es einen Log-Hinweis statt eines stillen Fehlschlags.
 */
function applyBoatIntent(state: GameState, intent: BoatIntent): void {
  const player = state.players.get(intent.playerId)
  if (player === undefined || !player.isAlive) return
  if (intent.targetTile < 0 || intent.targetTile >= state.map.state.length) return
  if (!isPassable(state.map.terrain, intent.targetTile)) return

  const targetOwner = getOwner(state.map, intent.targetTile)
  if (targetOwner === player.id) return
  if (targetOwner > 0 && areAllied(state.alliances, player.id, targetOwner)) return
  // Über Land erreichbar → das ist ein Land-Angriff, kein Boot.
  if (reachableByLand(state, player, intent.targetTile)) return

  // Differenziertes Feedback: ohne eigene Küste ist ein Boot unmöglich (man muss erst
  // Land am Wasser erobern); sonst lag es am fehlenden Wasserweg zum Ziel.
  const ownerTiles = collectOwnerTiles(state, player.id)
  const hasCoast = ownerTiles.some((t) => isCoastalTile(state.map, t))
  if (!hasCoast) {
    if (player.isHuman) {
      emitEvent(
        state,
        `${player.name}: keine eigene Küste — erobere erst Land am Wasser`,
        player.color,
      )
    }
    return
  }
  if (!tryLaunchBoat(state, player, intent.targetTile, intent.troops)) {
    if (player.isHuman) {
      emitEvent(state, `${player.name}: kein Wasserweg zu diesem Ziel`, player.color)
    }
  }
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
 * `requestedTroops` (gedeckelt auf den Truppen-Pool) mit. Liefert `true` bei
 * erfolgreichem Start, sonst `false` (z.B. kein Wasserweg, Boot-Limit erreicht).
 */
function tryLaunchBoat(
  state: GameState,
  player: Player,
  targetTile: TileRef,
  requestedTroops: number,
): boolean {
  const activeBoats = state.boats.reduce((n, b) => (b.ownerId === player.id ? n + 1 : n), 0)
  if (activeBoats >= MAX_BOATS_PER_PLAYER) return false

  const troops = Math.min(Math.floor(requestedTroops), player.troops)
  if (troops <= 0) return false

  // Toleranz: ein grob auf eine Insel gesetzter Klick muss nicht exakt ein Küsten-Tile
  // treffen. Wir probieren die nächsten Küsten DERSELBEN Landmasse durch und nehmen die
  // erste, zu der von einer eigenen Küste ein Wasserweg existiert.
  const ownerTiles = collectOwnerTiles(state, player.id)
  const candidates = coastalTilesNear(state.map, targetTile, 16)
  if (candidates.length === 0) candidates.push(targetTile)
  let landingTile = -1
  let path: readonly TileRef[] | null = null
  for (const c of candidates) {
    const plan = planBoatLaunch(state.map, state.waterComponents, ownerTiles, c)
    if (plan !== null) {
      landingTile = c
      path = plan.path
      break
    }
  }
  if (path === null || landingTile < 0) return false

  player.troops -= troops
  state.boats.push({ ownerId: player.id, troops, path, progress: 0, targetTile: landingTile })
  emitEvent(state, `${player.name} schickt ein Transportboot`, player.color)
  return true
}

/** Passierbares Land-Tile direkt am Wasser (mind. ein Nicht-Land-Nachbar). */
function isCoastalTile(map: GameMap, ref: TileRef): boolean {
  if (!isPassable(map.terrain, ref)) return false
  const { width, height } = map
  for (const n of neighbors4(ref, width, height)) {
    if (!isLand(map.terrain, n)) return true
  }
  return false
}

/**
 * Sammelt Küsten-Tiles auf DERSELBEN Landmasse wie `start`, nach Land-BFS-Distanz
 * geordnet (nächste zuerst, bis `limit`). Damit muss ein Boot-Klick nicht exakt ein
 * Küsten-Tile treffen, und der Aufrufer kann mehrere Lande-Kandidaten probieren —
 * wichtig, falls die nächste Küste an einem Meer liegt, das nicht mit der eigenen
 * Küste verbunden ist.
 */
function coastalTilesNear(map: GameMap, start: TileRef, limit: number): TileRef[] {
  const { width, height } = map
  if (!isLand(map.terrain, start)) return []
  const result: TileRef[] = []
  if (isCoastalTile(map, start)) result.push(start)
  const seen = new Set<number>([start])
  const queue: number[] = [start]
  let head = 0
  const MAX_VISIT = 8000
  while (head < queue.length && head < MAX_VISIT && result.length < limit) {
    const cur = queue[head++]
    if (cur === undefined) break
    for (const n of neighbors4(cur, width, height)) {
      if (seen.has(n) || !isLand(map.terrain, n)) continue
      seen.add(n)
      if (isCoastalTile(map, n)) result.push(n)
      queue.push(n)
    }
  }
  return result
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

/** Truppen die der Spieler aktuell in laufenden Angriffen gebunden hat. */
function committedTroops(player: Player): number {
  let sum = 0
  for (const a of player.attacks) sum += a.reserveTroops
  return sum
}

/** Gesamttruppen eines Spielers: frei verfügbar + in Angriffen gebunden. */
export function totalTroops(player: Player): number {
  return player.troops + committedTroops(player)
}

function growPopulations(state: GameState): void {
  for (const player of orderedPlayers(state)) {
    if (!player.isAlive) continue
    const max =
      maxTroops(player.weightedTiles, { bot: !player.isHuman }) + cityCapBonus(state, player.id)
    // Wachstum bezieht sich auf die Gesamttruppen (frei + gebunden); freie Truppen
    // wachsen, ohne dass die Gesamtzahl den Cap überschreitet.
    // Wachstum geht konsistent von der FREIEN Bevölkerung aus, gebremst durch ihren
    // freien Cap-Platz (Cap minus die im Angriff gebundenen Truppen). So verzerren
    // gebundene Angriffstruppen das Wachstum nicht — und sie produzieren nicht selbst.
    const committed = committedTroops(player)
    const freeCap = Math.max(0, max - committed)
    const rate = troopIncreaseRate(player.troops, freeCap)
    if (rate < 0) {
      // Über dem freien Cap (z.B. nach Gebietsverlust): Überschuss langsam abschmelzen.
      player.troops = Math.max(0, player.troops + rate)
    } else {
      player.troops = Math.min(player.troops + rate, freeCap)
    }
  }
}

/** Effektiver Truppen-Cap inkl. Stadt-Bonus, terrain-gewichtet (für HUD/AI). */
export function effectiveMaxTroops(state: GameState, playerId: number): number {
  const p = state.players.get(playerId)
  if (p === undefined) return 0
  return maxTroops(p.weightedTiles, { bot: !p.isHuman }) + cityCapBonus(state, playerId)
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
    attackerLossPerTile(defTroops, defTiles, vsNull, mag) *
    traitorDefenseMul(state, owner, boat.ownerId)

  if (boat.troops <= aLoss) return // gescheiterte Landung, Truppen verloren

  // Verlorenes Land nimmt seine Bevölkerung mit (siehe advanceAttack).
  if (!vsNull && defender !== undefined) {
    const dLoss = defenderLossPerTile(defender.troops, defender.tilesOwned, false)
    defender.troops = Math.max(0, Math.floor(defender.troops - dLoss))
  }
  const remaining = Math.floor(boat.troops - aLoss)
  captureTile(state, target, boat.ownerId) // setzt Frontier auf der neuen Landmasse
  attacker.attacks.push({
    targetPlayerId: owner,
    reserveTroops: remaining,
    focusTile: target,
    frontTile: target,
    startTick: state.tick,
  })
  emitEvent(state, `${attacker.name} landet Truppen an`, attacker.color)
}

/** Häfen senden gestaffelt Handelsschiffe zu erreichbaren, fremden Häfen. */
function spawnTradeShips(state: GameState): void {
  const ports: TileRef[] = []
  for (const b of state.buildings.values()) {
    if (b.type === 'port' && isBuildingComplete(b, state.tick)) ports.push(b.tile)
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
      player.weightedTiles = 0
    }
  }
}

/** Zählt die begehbaren (eroberbaren) Tiles einer Karte — Wasser/Extrem-Berge raus. */
function countPassableLand(map: GameMap): number {
  let n = 0
  for (let i = 0; i < map.terrain.length; i++) {
    if (isPassable(map.terrain, i)) n++
  }
  return n
}

function checkVictory(state: GameState): void {
  if (state.phase === 'ended') return
  // Sieg-Schwelle bezieht sich auf eroberbare Tiles (Land), nicht auf den gesamten
  // Bitmap-Bereich — sonst wäre Sieg auf einer Insel-Karte mit 35% Land unmöglich.
  const totalTiles =
    state.passableLandCount > 0 ? state.passableLandCount : state.map.width * state.map.height
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
    // Keine Front mehr (Ziel nicht mehr erreichbar / aufgebraucht) → der Angriff
    // endet und seine verbleibende Reserve fließt zurück in den Truppen-Pool.
    attacker.troops += attack.reserveTroops
    attack.reserveTroops = 0
    return false
  }

  const defenderTroops = vsTerraNullius ? 0 : (defender?.troops ?? 0)
  const defenderTilesOwned = vsTerraNullius ? 1 : (defender?.tilesOwned ?? 1)

  const speedMul = state.config.matchSpeed ?? 1
  const rate =
    tilesPerTick(attack.reserveTroops, defenderTroops, frontWidth, vsTerraNullius) * speedMul
  const integerPart = Math.floor(rate)
  const fraction = rate - integerPart
  const extra = state.rng.next() < fraction ? 1 : 0
  let wantCapture = Math.min(integerPart + extra, tiles.length)

  // Höheres Terrain wird langsamer erobert: die tatsächlich pro Tick eroberten
  // Tiles werden im Verhältnis Ebene/Durchschnitts-Magnitude der Front gedrosselt
  // (Ebene 1.0, Hügel ~0.8, Berg ~0.67) — auch wenn die Rohrate sonst alle
  // Front-Tiles auf einmal nähme. Auf Ebene (Faktor 1) bleibt alles unverändert.
  const terrainSlow = PLAINS_MAG / Math.max(PLAINS_MAG, avgFrontMagnitude(state, tiles))
  if (terrainSlow < 1) {
    const slowed = wantCapture * terrainSlow
    const slowInt = Math.floor(slowed)
    wantCapture = slowInt + (state.rng.next() < slowed - slowInt ? 1 : 0)
  }

  if (wantCapture <= 0) return true

  // Front-Welle: die Reihenfolge der Eroberung formt das Gebiet. Schlüssel je
  // eroberbarem Tile (kleiner = zuerst), aus drei Effekten:
  //   - Nähe zum Fokus → gerichtete Ausbreitung in Klick-Richtung. Voll gegen
  //     Wildnis (man drückt gezielt rein), stark gedämpft gegen Nationen: dort baut
  //     sich der Druck über die GANZE gemeinsame Grenze auf (gesicherte Grenzen sind
  //     zäh, keine 1-2-Pixel-Lücken).
  //   - viele eigene Nachbarn ziehen stark vor (FRONT_SMOOTHING) → Buchten werden
  //     zuerst gefüllt, die Front bleibt breit/glatt statt dünne Finger zu treiben
  //   - höheres Terrain bremst → die Welle umfließt Hügel/Berge
  // Vorab-Shuffle macht Tiles mit gleichem Schlüssel deterministisch-zufällig (Charme).
  state.rng.shuffleArray(tiles)
  const { width: mapW, height: mapH } = state.map
  const focusX = attack.focusTile % mapW
  const focusY = Math.floor(attack.focusTile / mapW)
  const focusPull = vsTerraNullius ? 1 : NATION_FOCUS_PULL
  const keyed = tiles.map((t) => {
    const tx = t % mapW
    const ty = Math.floor(t / mapW)
    const dist = torusDistance(tx, ty, focusX, focusY, mapW, mapH)
    const own = ownNeighborCount(state, t, attacker.id)
    const terrainPenalty =
      (terrainMagnitude(state.map.terrain, t) - PLAINS_MAG) * TERRAIN_WAVE_PENALTY
    return { t, key: dist * focusPull - own * FRONT_SMOOTHING + terrainPenalty }
  })
  keyed.sort((a, b) => a.key - b.key)

  // Front-Schwerpunkt der diesen Tick eroberten Tiles akkumulieren (relativ zum
  // bisherigen frontTile, torus-sicher), damit die Angriffs-Pille der Front folgt.
  const { width: fw, height: fh } = state.map
  const anchorX = attack.frontTile % fw
  const anchorY = Math.floor(attack.frontTile / fw)
  let sumDx = 0
  let sumDy = 0
  let captured = 0

  for (let i = 0; i < wantCapture; i++) {
    if (attack.reserveTroops <= 0) break
    const ref = keyed[i]?.t
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

    // Verlorenes Land nimmt seine Bevölkerung mit: der Verteidiger verliert pro Tile
    // seine Pro-Tile-Truppen → Truppen und Tiles sinken proportional, die Dichte
    // bleibt konstant, und 2:1-Übermacht reicht exakt für die komplette Einnahme.
    if (!isCurrentlyTerraNullius && defender !== undefined) {
      const dLoss = defenderLossPerTile(defender.troops, defender.tilesOwned, false)
      defender.troops = Math.max(0, Math.floor(defender.troops - dLoss))
    }

    captureTile(state, ref, attacker.id)
    sumDx += signedTorusDelta(ref % fw, anchorX, fw)
    sumDy += signedTorusDelta(Math.floor(ref / fw), anchorY, fh)
    captured++
  }

  if (captured > 0) {
    const mx = (((anchorX + Math.round(sumDx / captured)) % fw) + fw) % fw
    const my = (((anchorY + Math.round(sumDy / captured)) % fh) + fh) % fh
    attack.frontTile = my * fw + mx
  }

  return attack.reserveTroops > 0
}

/** Anzahl der 4-Nachbarn von `tile`, die `ownerId` gehören (0..4). */
function ownNeighborCount(state: GameState, tile: TileRef, ownerId: number): number {
  const { width, height } = state.map
  let n = 0
  for (const nb of neighbors4(tile, width, height)) {
    if (getOwner(state.map, nb) === ownerId) n++
  }
  return n
}

/** Durchschnittliche Terrain-Magnitude der eroberbaren Front-Tiles (min. Ebene). */
function avgFrontMagnitude(state: GameState, tiles: readonly TileRef[]): number {
  if (tiles.length === 0) return PLAINS_MAG
  let sum = 0
  for (const t of tiles) sum += terrainMagnitude(state.map.terrain, t)
  return sum / tiles.length
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
  state.dirtyTiles.push(ref) // Owner-Wechsel → Renderer malt dieses Tile (+ Nachbarn) neu

  // Gebäude auf dem eroberten Tile: Verteidigungsposten werden zerstört, alle
  // anderen (Stadt/Markt/Hafen) übernimmt der Eroberer mitsamt Level.
  const captured = state.buildings.get(ref)
  if (captured !== undefined) {
    if (captured.type === 'defense') state.buildings.delete(ref)
    else state.buildings.set(ref, { ...captured, ownerId: attackerId })
  }

  const weight = tileTroopWeight(map.terrain, ref)
  const attacker = players.get(attackerId)
  if (attacker !== undefined) {
    attacker.tilesOwned++
    attacker.weightedTiles += weight
  }

  if (oldOwner > 0) {
    const oldPlayer = players.get(oldOwner)
    if (oldPlayer !== undefined) {
      oldPlayer.tilesOwned--
      oldPlayer.weightedTiles = Math.max(0, oldPlayer.weightedTiles - weight)
    }
    // „Groll" des Bestohlenen gegen den Angreifer erhöhen (abklingend, → roter Rand).
    const key = directedKey(attackerId, oldOwner)
    state.grudge.set(key, (state.grudge.get(key) ?? 0) + weight)
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
