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
  ATTACK_CANCEL_TICKS,
  BASE_GOLD_PER_TICK,
  BOT_START_TROOPS,
  FACTORY_GOLD_PER_DEST,
  FACTORY_LINK_RANGE,
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
  COST_GROUP,
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
  BoatRecallIntent,
  BreakAllianceIntent,
  LaunchWarshipIntent,
  RecallWarshipIntent,
  ToggleWarshipModeIntent,
  MoveWarshipIntent,
  BuildIntent,
  CancelAttackIntent,
  DeclineAllianceIntent,
  DefendIntent,
  Intent,
  RequestAllianceIntent,
  SetEmbargoIntent,
  SetTradeModeIntent,
  ToggleWarshipNeutralIntent,
  TradeMode,
  UpgradeIntent,
} from './intent'
import { detAtan2, detSin } from './det-math'
import { createPRNG, type PRNG } from './random'
import {
  AECHTUNG_DURATION_TICKS,
  ALLIANCE_DURATION_TICKS,
  TRAITOR_DAMAGE_MULT,
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
  MAX_WARSHIPS_PER_PLAYER,
  NAVAL_RANGE,
  TRADE_INTERVAL_TICKS,
  TRADE_SHIP_SPEED,
  type TradeShip,
  type Warship,
  type Projectile,
  WARSHIP_COST,
  WARSHIP_DAMAGE_PER_TICK,
  WARSHIP_HEAL_PER_TICK,
  WARSHIP_HEAL_RANGE,
  WARSHIP_HP,
  WARSHIP_SHOT_COOLDOWN,
  WARSHIP_SPEED,
  PROJECTILE_SPEED,
  planBoatLaunch,
  planWaterRoute,
  shipArrived,
  shipTile,
  shipWorldPos,
  tradeGold,
} from './ships'
import {
  adjacentWaterByComponent,
  findWaterPath,
  labelLandComponents,
  labelWaterComponents,
} from '../world/water-path'

/* ============================================================================
 * Types
 * ========================================================================== */

export interface PlayerDef {
  readonly id: number
  readonly name: string
  readonly color: number
  readonly isHuman: boolean
  /**
   * „Wilde Nation"/Barbar: passiv — keine KI, keine Intents (greift nicht an, baut
   * nicht, keine Diplomatie), niedrigerer Truppen-Cap → eroberbarer Puffer. Default false.
   */
  readonly wild?: boolean
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
  /** Rundum-Ausbreitung (kein Richtungs-Fokus → gleichmäßig in alle Wildnis). */
  omni?: boolean
  /**
   * Gesetzt, sobald der Angriff abgebrochen wird (Tick des Abbruch-Befehls). Ein abbrechender
   * Angriff erobert nichts mehr; seine Reserve fließt über [[ATTACK_CANCEL_TICKS]] zurück in
   * den Spieler-Pool. Ein zweiter Abbruch-Befehl beendet sofort (Rest zurück).
   */
  cancelStartTick?: number
  /** Über die Laufzeit dieses Angriffs erbeutetes Gold (Summe der Pro-Tile-Beute). */
  lootGained?: number
}

export interface Player {
  readonly id: number
  readonly name: string
  readonly color: number
  readonly isHuman: boolean
  /** Passive „wilde Nation" (siehe PlayerDef.wild). */
  readonly wild: boolean
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
  /**
   * Kumuliertes Gesamt-Einkommen (Produktion + Handel + Beute) — zählt nur Einnahmen, NIE
   * Ausgaben. Für die Einkommens-Anzeige im HUD: ein Kauf darf die „+x/s"-Rate nicht auf 0
   * drücken (sonst sähe es so aus, als verdiene man nichts).
   */
  goldEarned: number
  /** Höchster jemals erreichter `tilesOwned`-Stand. */
  peakTilesOwned: number
  /** Höchster jemals erreichter `troops`-Stand. */
  peakTroops: number
  /**
   * Tick bis zu dem der Spieler als Verräter geächtet ist (0 = nicht geächtet).
   * Solange aktiv: −50% Verteidigung gegen Nationen die er nicht selbst angreift.
   */
  traitorUntil: number
  /** Standard-Verhaltensmodus neuer Kriegsschiffe: true = „Halten & Heilen", false = Ping-Pong. */
  warshipHold: boolean
  /** Handels-Zielwahl: wohin die eigenen Häfen ihre Handelsschiffe schicken (Default `random`). */
  tradeMode: TradeMode
  /**
   * Wenn `true`, verschonen die eigenen Kriegsschiffe NEUTRALE Handelsschiffe (greifen nur
   * Fracht von embargoierten / stark begrollten Nationen an). Default `false` = alle angreifen.
   */
  warshipSpareNeutral: boolean
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
  /** Aktive Kriegsschiffe. */
  warships: Warship[]
  /** Fliegende Kriegsschiff-Projektile (verzögerter Schaden; verpuffen, wenn der Schütze stirbt). */
  projectiles: Projectile[]
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
  /**
   * „Gunst" als gerichteter Schlüssel ([[directedKey]]) → abklingender Wert, der durch
   * Zusammenarbeit steigt (abgeschlossener Handel, Fabriken in gegenseitiger Reichweite).
   * Positives Gegenstück zum [[grudge]]; treibt den grünen Beziehungs-Tint und die KI-Zielwahl
   * (gute Partner werden geschont). Klingt langsamer ab als Groll (Freundschaften halten länger).
   */
  readonly goodwill: Map<number, number>
  /**
   * Kürzlich eroberte Tiles (TileRef → Eroberungs-Tick). Der Renderer lässt sie kurz
   * aufleuchten (Farbe nach Beziehung des neuen Besitzers zum Menschen) → man sieht
   * exakt, wo ein Angriff gerade Wirkung zeigt. Wird nach wenigen Ticks geprunt.
   */
  readonly recentCaptures: Map<TileRef, number>
}

/* ============================================================================
 * createGame
 * ========================================================================== */

const SPAWN_HALF_SIZE = 2 // 5×5-Kern muss Land sein (Zentrums-Validierung)
/** Ziel-Größe eines Start-Gebiets (Tiles) — organisch gewachsen, nicht quadratisch. */
const SPAWN_TARGET_TILES = 80
/** Start-Größe wilder Nationen — etwas kleiner als reguläre Spawns, aber sichtbar präsent. */
const WILD_SPAWN_TILES = 28

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
    const wild = def.wild ?? false
    const startTroops = def.isHuman ? HUMAN_START_TROOPS : BOT_START_TROOPS
    players.set(def.id, {
      id: def.id,
      name: def.name,
      color: def.color,
      isHuman: def.isHuman,
      wild,
      troops: startTroops,
      tilesOwned: 0,
      weightedTiles: 0,
      frontier: new Set<TileRef>(),
      attacks: [],
      isAlive: true,
      gold: 0,
      goldEarned: 0,
      peakTilesOwned: 0,
      peakTroops: startTroops,
      traitorUntil: 0,
      warshipHold: false,
      tradeMode: 'random',
      warshipSpareNeutral: false,
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
    warships: [],
    projectiles: [],
    alliances: new Set<number>(),
    allianceExpiry: new Map<number, number>(),
    allianceRequests: new Set<number>(),
    embargoes: new Set<number>(),
    grudge: new Map<number, number>(),
    goodwill: new Map<number, number>(),
    recentCaptures: new Map<TileRef, number>(),
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
    // Wilde starten klein (Puffer/Beute); reguläre Spieler bekommen das volle Ziel.
    const playerTarget = player.wild ? Math.min(target, WILD_SPAWN_TILES) : target
    growSpawn(state, player, cx, cy, playerTarget)
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
    const dist = Math.sqrt(dx * dx + dy * dy) // sqrt ist IEEE-754-deterministisch
    const angle = detAtan2(dy, dx)
    const lobe = detSin(angle * freq1 + ph1) * 0.32 + detSin(angle * freq2 + ph2) * 0.16
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

export function initializeAllFrontiers(state: GameState): void {
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
  resolveAttackCollisions(state)
  resolveAttacks(state)
  advanceBoats(state)
  advanceWarships(state)
  resolveNavalCombat(state)
  spawnTradeShips(state)
  advanceTradeShips(state)
  applyFactoryDiplomacy(state)
  decayGrudge(state)
  decayGoodwill(state)
  pruneRecentCaptures(state)
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
/** Groll pro Kriegsschiff-Treffer (akkumuliert über die Treffer bis zur Versenkung). */
const GRUDGE_PER_WARSHIP_HIT = 10
/** Groll, wenn ein eigenes Transportboot versenkt wird. */
const GRUDGE_PER_BOAT_SUNK = 60
/** Groll, wenn ein eigenes Handelsschiff blockiert/versenkt wird (an beide Hafen-Besitzer). */
const GRUDGE_PER_TRADE_SUNK = 45
/** Einmaliger Groll-Stoß des Embargoierten gegen den, der das Embargo verhängt. */
const GRUDGE_PER_EMBARGO = 80
/** Ab diesem Groll gilt ein Handelspartner im „Neutrale schonen"-Modus als verfeindet (→ angreifbar). */
const NEUTRAL_BLOCKADE_GRUDGE = 60

/** Erhöht den (abklingenden) Groll des Opfers gegen den Angreifer. Ignoriert Selbst/Besitzlos. */
function addGrudge(state: GameState, attackerId: number, victimId: number, amount: number): void {
  if (attackerId === victimId || victimId <= 0 || attackerId <= 0) return
  const key = directedKey(attackerId, victimId)
  state.grudge.set(key, (state.grudge.get(key) ?? 0) + amount)
}

/** Abkling-Faktor pro Tick für „Gunst" — langsamer als Groll, damit Freundschaften halten. */
const GOODWILL_DECAY = 0.997
/** Unter diesem Wert wird ein Gunst-Eintrag gelöscht. */
const GOODWILL_MIN = 1
/** Erhöht die (beidseitige) Gunst zwischen a und b. Ignoriert Selbst/Besitzlos. */
function addGoodwill(state: GameState, a: number, b: number, amount: number): void {
  if (a === b || a <= 0 || b <= 0 || amount <= 0) return
  const k1 = directedKey(a, b)
  const k2 = directedKey(b, a)
  state.goodwill.set(k1, (state.goodwill.get(k1) ?? 0) + amount)
  state.goodwill.set(k2, (state.goodwill.get(k2) ?? 0) + amount)
}

/** Lässt aufgebaute Gunst pro Tick etwas abklingen; vergisst Kleinstwerte. */
function decayGoodwill(state: GameState): void {
  if (state.goodwill.size === 0) return
  for (const [key, value] of state.goodwill) {
    const next = value * GOODWILL_DECAY
    if (next < GOODWILL_MIN) state.goodwill.delete(key)
    else state.goodwill.set(key, next)
  }
}

/** Gunst-Gewinn pro abgeschlossener Handelsfahrt (an beide Hafen-Besitzer, ∝ Fahrt-Gold). */
const GOODWILL_PER_TRADE_DIVISOR = 8
/** Intervall (Ticks), in dem Fabrik-Nachbarschafts-Gunst/-Boni gewährt werden. */
const FACTORY_DIPLO_INTERVAL = 30
/** Gunst je Intervall, wenn eine Fabrik in Reichweite einer fremden Stadt/eines Hafens liegt. */
const GOODWILL_PER_FACTORY_NEIGHBOR = 6

/**
 * Fabrik-Diplomatie: liegt eine eigene fertige Fabrik in `FACTORY_LINK_RANGE` einer Stadt/eines
 * Hafens eines ANDEREN (nicht embargoierten) Spielers, entsteht beidseitig **Gunst**. Der
 * Gold-Vorteil der Verbindung (3×) steckt im Fabrik-Einkommen (`goldBreakdown`), nicht hier.
 * Embargo schneidet beides ab. Läuft alle FACTORY_DIPLO_INTERVAL.
 */
function applyFactoryDiplomacy(state: GameState): void {
  if (state.tick % FACTORY_DIPLO_INTERVAL !== 0) return
  const { width, height } = state.map
  const factories: { x: number; y: number; owner: number }[] = []
  const dests: { x: number; y: number; owner: number }[] = []
  for (const b of state.buildings.values()) {
    if (!isBuildingComplete(b, state.tick) || b.ownerId <= 0) continue
    const x = b.tile % width
    const y = Math.floor(b.tile / width)
    if (b.type === 'factory') factories.push({ x, y, owner: b.ownerId })
    // Ziele für Gunst = fremde Städte/Häfen UND Fabriken (eine Fabrik verbindet sich auch mit
    // fremden Fabriken, analog zum Gold-Bonus in factoryForeignContribution).
    if (b.type === 'city' || b.type === 'port' || b.type === 'factory')
      dests.push({ x, y, owner: b.ownerId })
  }
  if (factories.length === 0 || dests.length === 0) return
  // Pro (Fabrik, fremdes Ziel)-Nachbarschaft höchstens EINMAL pro Paar Gunst gutschreiben.
  const credited = new Set<number>()
  for (const f of factories) {
    for (const d of dests) {
      if (d.owner === f.owner) continue
      if (isTradeEmbargoed(state, f.owner, d.owner)) continue
      if (torusDistance(f.x, f.y, d.x, d.y, width, height) > FACTORY_LINK_RANGE) continue
      const pairId = directedKey(Math.min(f.owner, d.owner), Math.max(f.owner, d.owner))
      if (credited.has(pairId)) continue
      credited.add(pairId)
      addGoodwill(state, f.owner, d.owner, GOODWILL_PER_FACTORY_NEIGHBOR)
    }
  }
}
/** Wie lange (Ticks) ein frisch erobertes Tile aufleuchtet, bevor es vergessen wird. */
export const CAPTURE_FADE_TICKS = 6

/** Entfernt ausgeblendete Eroberungs-Funken (älter als [[CAPTURE_FADE_TICKS]]). */
function pruneRecentCaptures(state: GameState): void {
  if (state.recentCaptures.size === 0) return
  for (const [tile, capturedAt] of state.recentCaptures) {
    if (state.tick - capturedAt >= CAPTURE_FADE_TICKS) state.recentCaptures.delete(tile)
  }
}

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
      emitDiploEvent(state, a, b, `Allianz zwischen ${a.name} und ${b.name} ausgelaufen`, a.color)
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

/** Gold-Produktionsfaktor wilder Nationen — halbe Produktion einer normalen Nation. */
const WILD_GOLD_FACTOR = 0.5

function generateGold(state: GameState): void {
  // Flacher Start-Trickle (NICHT größen-abhängig) + Fabrik-Netzwerk-Einkommen
  // (+ Handelsschiff-Gold beim Eintreffen, separat). Wilde Nationen produzieren nur die
  // Hälfte — so haben sie einen kleinen Gold-Vorrat, den man beim Erobern erbeutet.
  for (const player of state.players.values()) {
    if (!player.isAlive) continue
    const gb = goldBreakdown(state, player.id)
    const raw = gb.base + gb.factory
    const income = player.wild ? Math.floor(raw * WILD_GOLD_FACTOR) : raw
    player.gold += income
    player.goldEarned += income
  }
}

/** Aufschlüsselung des stetigen Gold-Einkommens eines Spielers pro Tick (Handel ist lumpig → separat). */
export interface GoldBreakdown {
  /** Flacher Grund-Trickle pro Tick (nicht größen-abhängig). */
  base: number
  /** Gold pro Tick aus dem Fabrik-Netzwerk. */
  factory: number
  /** Anzahl eigener fertiger Fabriken. */
  factories: number
  /** Anzahl verbundener Städte/Häfen (in einem Cluster mit ≥1 Fabrik). */
  dests: number
}

/**
 * Schlüsselt das stetige Gold-Einkommen eines Spielers auf. Eigene fertige Städte/Häfen/
 * Fabriken werden per Luftlinie (`FACTORY_LINK_RANGE`) transitiv zu Clustern verbunden
 * (Union-Find). Jede Fabrik produziert `FACTORY_GOLD_PER_DEST` × (Städte+Häfen im selben
 * Cluster) × Fabrik-Level. Isolierte Fabriken ohne verbundene Ziele = 0.
 */
export function goldBreakdown(state: GameState, playerId: number): GoldBreakdown {
  const nodes: { tile: TileRef; isDest: boolean; isFactory: boolean; level: number }[] = []
  for (const b of state.buildings.values()) {
    if (b.ownerId !== playerId || !isBuildingComplete(b, state.tick)) continue
    if (b.type === 'city' || b.type === 'port' || b.type === 'factory') {
      nodes.push({
        tile: b.tile,
        isDest: b.type === 'city' || b.type === 'port',
        isFactory: b.type === 'factory',
        level: b.level,
      })
    }
  }
  const n = nodes.length
  if (n === 0) return { base: BASE_GOLD_PER_TICK, factory: 0, factories: 0, dests: 0 }

  // Union-Find über Reichweiten-Kanten (Torus-Luftlinie).
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => {
    let r = i
    while (parent[r] !== r) r = parent[r] ?? r
    let c = i
    while (parent[c] !== c) {
      const next = parent[c] ?? c
      parent[c] = r
      c = next
    }
    return r
  }
  const { width, height } = state.map
  for (let i = 0; i < n; i++) {
    const a = nodes[i]
    if (a === undefined) continue
    const ax = a.tile % width
    const ay = Math.floor(a.tile / width)
    for (let j = i + 1; j < n; j++) {
      const b = nodes[j]
      if (b === undefined) continue
      const bx = b.tile % width
      const by = Math.floor(b.tile / width)
      if (torusDistance(ax, ay, bx, by, width, height) <= FACTORY_LINK_RANGE) {
        parent[find(i)] = find(j)
      }
    }
  }

  // Ziele (Stadt/Hafen) und Fabrik-Präsenz pro Cluster, dann Beiträge summieren.
  const destPerCluster = new Map<number, number>()
  const factoryClusters = new Set<number>()
  let factories = 0
  for (let i = 0; i < n; i++) {
    const node = nodes[i]
    if (node === undefined) continue
    const root = find(i)
    if (node.isDest) destPerCluster.set(root, (destPerCluster.get(root) ?? 0) + 1)
    if (node.isFactory) {
      factories++
      factoryClusters.add(root)
    }
  }
  let gold = 0
  for (let i = 0; i < n; i++) {
    const node = nodes[i]
    if (node?.isFactory !== true) continue
    // Eigene Ziele je Fabrik gedeckelt (FACTORY_OWN_CAP) → linear statt quadratisch.
    const own = Math.min(destPerCluster.get(find(i)) ?? 0, FACTORY_OWN_CAP)
    gold += FACTORY_GOLD_PER_DEST * own * node.level
  }
  // Verbundene Ziele = Städte/Häfen in einem Cluster mit mindestens einer Fabrik.
  let dests = 0
  for (const [root, count] of destPerCluster) {
    if (factoryClusters.has(root)) dests += count
  }
  // Auslands-Verbindungen: jede FREMDE (nicht embargoierte) Stadt/Hafen in Fabrik-Reichweite
  // bringt 3× Gold (Kooperation über Grenzen lohnt sich; Gunst separat via applyFactoryDiplomacy).
  const foreign = foreignFactoryGold(state, playerId, nodes)
  gold += foreign.gold
  dests += foreign.dests
  return { base: BASE_GOLD_PER_TICK, factory: Math.floor(gold), factories, dests }
}

/** Gold-Multiplikator für Auslands-Verbindungen einer Fabrik (fremde Stadt/Hafen in Reichweite). */
const FACTORY_FOREIGN_MULT = 3
/**
 * Deckel an Zielen JE Fabrik (eigene bzw. ausländische, getrennt). Macht eine Fabrik linear
 * statt quadratisch (kein Cluster-Schneeball) und gibt dem Level Sinn: Level multipliziert das
 * Gold innerhalb des Deckels, also = „verdichten/Platz sparen" vs. Duplizieren = „Fläche abdecken"
 * (beide gleich viel Gold/Kosten). An OpenFronts diminishing-returns (nach 10 Stops) angelehnt.
 */
const FACTORY_OWN_CAP = 4
/** Max. ausländische Ziele je Fabrik (exportiert, damit das Rendering die Viz exakt spiegelt). */
export const FACTORY_FOREIGN_CAP = 4

/**
 * Gold + Ziel-Anzahl aus den Auslands-Verbindungen EINER Fabrik: jedes FREMDE (nicht
 * embargoierte) fertige Wirtschaftsgebäude (Stadt/Hafen/**Fabrik**) in `FACTORY_LINK_RANGE`
 * zählt als Ziel mit `FACTORY_FOREIGN_MULT`× Gold — genau wie eine Fabrik sich im eigenen Netz
 * mit Städten/Häfen/Fabriken verbindet. So lohnt es sich, Fabriken nah an andere Nationen zu
 * bauen (Kooperation über Grenzen).
 */
function factoryForeignContribution(
  state: GameState,
  ownerId: number,
  factoryTile: TileRef,
  factoryLevel: number,
): { gold: number; dests: number } {
  const { width, height } = state.map
  const fx = factoryTile % width
  const fy = Math.floor(factoryTile / width)
  let dests = 0
  for (const b of state.buildings.values()) {
    if (dests >= FACTORY_FOREIGN_CAP) break // Deckel: nur die ersten N Auslands-Ziele zählen
    if (b.ownerId === ownerId || b.ownerId <= 0) continue
    if (b.type !== 'city' && b.type !== 'port' && b.type !== 'factory') continue
    if (!isBuildingComplete(b, state.tick)) continue
    if (isTradeEmbargoed(state, ownerId, b.ownerId)) continue
    const bx = b.tile % width
    const by = Math.floor(b.tile / width)
    if (torusDistance(fx, fy, bx, by, width, height) > FACTORY_LINK_RANGE) continue
    dests++
  }
  return { gold: FACTORY_GOLD_PER_DEST * FACTORY_FOREIGN_MULT * factoryLevel * dests, dests }
}

/** Summe der Auslands-Verbindungen über alle Fabrik-Knoten eines Spielers. */
function foreignFactoryGold(
  state: GameState,
  playerId: number,
  nodes: readonly { tile: TileRef; isFactory: boolean; level: number }[],
): { gold: number; dests: number } {
  let gold = 0
  let dests = 0
  for (const node of nodes) {
    if (!node.isFactory) continue
    const c = factoryForeignContribution(state, playerId, node.tile, node.level)
    gold += c.gold
    dests += c.dests
  }
  return { gold, dests }
}

/**
 * Live-Beitrag EINER Fabrik zum Gold/Tick: ihre Cluster-Ziele (Städte+Häfen im selben
 * Reichweiten-Cluster desselben Besitzers) × Fabrik-Level × `FACTORY_GOLD_PER_DEST`. `null`,
 * wenn das Tile keine fertige Fabrik ist. Für den Hover-Tooltip (verstehen, was eine Fabrik bringt).
 */
export function factoryYield(
  state: GameState,
  tile: TileRef,
): { goldPerTick: number; dests: number } | null {
  const self = state.buildings.get(tile)
  if (self === undefined || self.type !== 'factory' || !isBuildingComplete(self, state.tick))
    return null
  const ownerId = self.ownerId
  const nodes: { tile: TileRef; isDest: boolean }[] = []
  let selfIdx = -1
  for (const b of state.buildings.values()) {
    if (b.ownerId !== ownerId || !isBuildingComplete(b, state.tick)) continue
    if (b.type === 'city' || b.type === 'port' || b.type === 'factory') {
      if (b.tile === tile) selfIdx = nodes.length
      nodes.push({ tile: b.tile, isDest: b.type === 'city' || b.type === 'port' })
    }
  }
  if (selfIdx < 0) return null
  const n = nodes.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => {
    let r = i
    while (parent[r] !== r) r = parent[r] ?? r
    let c = i
    while (parent[c] !== c) {
      const next = parent[c] ?? c
      parent[c] = r
      c = next
    }
    return r
  }
  const { width, height } = state.map
  for (let i = 0; i < n; i++) {
    const a = nodes[i]
    if (a === undefined) continue
    const ax = a.tile % width
    const ay = Math.floor(a.tile / width)
    for (let j = i + 1; j < n; j++) {
      const b = nodes[j]
      if (b === undefined) continue
      const bx = b.tile % width
      const by = Math.floor(b.tile / width)
      if (torusDistance(ax, ay, bx, by, width, height) <= FACTORY_LINK_RANGE) {
        parent[find(i)] = find(j)
      }
    }
  }
  const root = find(selfIdx)
  let clusterDests = 0
  for (let i = 0; i < n; i++) {
    if (nodes[i]?.isDest === true && find(i) === root) clusterDests++
  }
  const own = Math.min(clusterDests, FACTORY_OWN_CAP) // eigene Ziele gedeckelt
  // Auslands-Verbindungen dieser Fabrik (3× Gold) mitzählen.
  const foreign = factoryForeignContribution(state, ownerId, tile, self.level)
  return {
    goldPerTick: FACTORY_GOLD_PER_DEST * own * self.level + foreign.gold,
    dests: own + foreign.dests,
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
 * Schadens-Multiplikator GEGEN einen Verteidiger, der ein geächteter Verräter ist: greift ihn
 * jemand an, den er NICHT selbst gerade angreift, nimmt er `TRAITOR_DAMAGE_MULT`× Verluste
 * (Freiwild). Greift der Verräter den Angreifer selbst an (sein „Opfer"), kämpft es normal (1×).
 */
function traitorDamageMul(state: GameState, defenderId: number, attackerId: number): number {
  if (defenderId <= 0) return 1
  const defender = state.players.get(defenderId)
  if (defender === undefined || defender.traitorUntil <= state.tick) return 1
  // Das aktuelle Opfer des Verräters (das er selbst angreift) kämpft normal gegen ihn.
  for (const atk of defender.attacks) {
    if (atk.targetPlayerId === attackerId) return 1
  }
  return TRAITOR_DAMAGE_MULT
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
      case 'boat-recall':
        applyBoatRecallIntent(state, intent)
        break
      case 'launch-warship':
        applyLaunchWarshipIntent(state, intent)
        break
      case 'recall-warship':
        applyRecallWarshipIntent(state, intent)
        break
      case 'toggle-warship-mode':
        applyToggleWarshipModeIntent(state, intent)
        break
      case 'move-warship':
        applyMoveWarshipIntent(state, intent)
        break
      case 'cancel-attack':
        applyCancelAttackIntent(state, intent)
        break
      case 'defend':
        applyDefendIntent(state, intent)
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
      case 'decline-alliance':
        applyDeclineAllianceIntent(state, intent)
        break
      case 'break-alliance':
        applyBreakAllianceIntent(state, intent)
        break
      case 'set-embargo':
        applySetEmbargoIntent(state, intent)
        break
      case 'set-trade-mode':
        applySetTradeModeIntent(state, intent)
        break
      case 'toggle-warship-neutral':
        applyToggleWarshipNeutralIntent(state, intent)
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

/**
 * Baukosten für `type` beim aktuellen Spieler-Bestand. Kapselt die Eskalations-Gruppen
 * ([[COST_GROUP]]) — z.B. zählen für Hafen/Fabrik beide Sorten gemeinsam, sodass sie sich
 * den Kosten-Multiplikator teilen. Single Source of Truth für UI, KI und Build-Intent.
 */
export function buildCostFor(state: GameState, playerId: number, type: BuildingType): number {
  let count = 0
  for (const t of COST_GROUP[type]) count += countBuildingsOfType(state, playerId, t)
  return buildCost(type, count)
}

/** Snap-Radius (Tiles) beim Bauen — innerhalb dessen der Cursor auf ein eigenes Gebäude rastet. */
export const BUILD_SNAP_RADIUS = 2

/**
 * „Snapping" beim Bauen/Upgraden: liegt nahe `tile` (≤ [[BUILD_SNAP_RADIUS]], Torus) ein
 * EIGENES Gebäude desselben `type`, liefert dessen Tile (→ Klick upgradet es, ohne pixelgenaues
 * Treffen). Sonst `tile` unverändert. Wird für Vorschau UND Platzierung genutzt (konsistent).
 */
export function snapBuildTile(
  state: GameState,
  playerId: number,
  tile: TileRef,
  type: BuildingType,
): TileRef {
  const { width, height } = state.map
  const tx = tile % width
  const ty = Math.floor(tile / width)
  let best = -1
  let bestDist = BUILD_SNAP_RADIUS + 0.0001
  for (const b of state.buildings.values()) {
    if (b.ownerId !== playerId || b.type !== type) continue
    const d = torusDistance(tx, ty, b.tile % width, Math.floor(b.tile / width), width, height)
    if (d <= bestDist) {
      bestDist = d
      best = b.tile
    }
  }
  return best >= 0 ? best : tile
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
 * Erreicht `playerId` das Ziel über Land (gleiche Landmasse an der Frontier)?
 * Read-only-Helfer für die UI (Radialmenü: Angriff vs. Transportboot anbieten).
 */
export function canReachByLand(state: GameState, playerId: number, targetTile: TileRef): boolean {
  const player = state.players.get(playerId)
  if (player === undefined) return false
  return reachableByLand(state, player, targetTile)
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
  const existing = state.buildings.get(tile)
  if (existing !== undefined) {
    // Bauen auf eigenem gleichem Gebäude = Upgrade (wenn nicht max + leistbar).
    if (existing.ownerId !== playerId || existing.type !== type) return false
    if (existing.level >= MAX_BUILDING_LEVEL) return false
    return player.gold >= upgradeCost(type, existing.level)
  }
  if (type === 'port' && !nearWater(state, tile)) return false
  const cost = buildCostFor(state, playerId, type)
  return player.gold >= cost
}

function applyBuildIntent(state: GameState, intent: BuildIntent): void {
  const player = state.players.get(intent.playerId)
  if (player === undefined) return
  if (!canBuildAt(state, intent.playerId, intent.tile, intent.buildingType)) return

  // Bauen auf eigenem gleichem Gebäude → Upgrade statt Neubau (von canBuildAt garantiert).
  const existing = state.buildings.get(intent.tile)
  if (existing !== undefined) {
    player.gold -= upgradeCost(existing.type, existing.level)
    existing.level++
    return
  }

  const cost = buildCostFor(state, player.id, intent.buildingType)
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
/** Bricht laufende Angriffe zwischen `a` und `b` ab (beide Richtungen) und gibt die Reserve zurück. */
function cancelAttacksBetween(state: GameState, a: number, b: number): void {
  const stop = (attackerId: number, victimId: number): void => {
    const p = state.players.get(attackerId)
    if (p === undefined || p.attacks.length === 0) return
    p.attacks = p.attacks.filter((atk) => {
      if (atk.targetPlayerId !== victimId) return true
      p.troops += atk.reserveTroops // Truppen aus dem abgebrochenen Angriff zurück in den Pool
      return false
    })
  }
  stop(a, b)
  stop(b, a)
}

function formAlliance(state: GameState, a: number, b: number): void {
  const key = pairKey(a, b)
  state.alliances.add(key)
  state.allianceExpiry.set(key, state.tick + ALLIANCE_DURATION_TICKS)
  // Mit dem Bündnis schweigen die Waffen: laufende Angriffe zwischen beiden sofort abbrechen.
  cancelAttacksBetween(state, a, b)
}

/**
 * Bricht ein bestehendes Bündnis zwischen `breakerId` und `partnerId`. No-op ohne Bündnis.
 * Normalerweise Verrat → der Brecher wird geächtet. AUSNAHME: ist der Partner bereits ein
 * geächteter Verräter, ist das Aufkündigen gerechtfertigt → KEINE eigene Ächtung.
 */
function betrayAlliance(state: GameState, breakerId: number, partnerId: number): void {
  const key = pairKey(breakerId, partnerId)
  if (!state.alliances.has(key)) return
  state.alliances.delete(key)
  state.allianceExpiry.delete(key)
  const breaker = state.players.get(breakerId)
  const partner = state.players.get(partnerId)
  if (breaker === undefined || partner === undefined) return
  // Den Partner trifft schon eine Ächtung? Dann darf man das Bündnis straflos kündigen.
  if (partner.traitorUntil > state.tick) {
    emitDiploEvent(
      state,
      breaker,
      partner,
      `${breaker.name} kündigt das Bündnis mit Verräter ${partner.name}`,
      breaker.color,
    )
    return
  }
  breaker.traitorUntil = state.tick + AECHTUNG_DURATION_TICKS
  emitDiploEvent(state, breaker, partner, `${breaker.name} verrät ${partner.name}!`, breaker.color)
}

/** Ab so vielen Spielern wird Bot-zu-Bot-Diplomatie nicht mehr geloggt (nur Mensch-bezogene). */
const DIPLO_LOG_ALL_MAX = 20

/**
 * Loggt ein Diplomatie-Ereignis. Bei wenigen Spielern (≤ DIPLO_LOG_ALL_MAX) immer — die
 * Welt-Diplomatie ist nette Atmosphäre. Bei vielen Bots nur, wenn der Mensch beteiligt ist,
 * sonst würde Bot-zu-Bot-Diplomatie den Ereignislog fluten und relevante Meldungen verdrängen.
 */
function emitDiploEvent(
  state: GameState,
  a: Player,
  b: Player,
  text: string,
  color?: number,
): void {
  if (a.isHuman || b.isHuman || state.players.size <= DIPLO_LOG_ALL_MAX) {
    emitEvent(state, text, color)
  }
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
    emitDiploEvent(state, from, to, `${from.name} und ${to.name} sind verbündet`, from.color)
    return
  }
  if (hasAllianceRequest(state.allianceRequests, from.id, to.id)) return
  state.allianceRequests.add(directedKey(from.id, to.id))
  emitDiploEvent(state, from, to, `${from.name} bietet ${to.name} ein Bündnis an`, from.color)
}

function applyAcceptAllianceIntent(state: GameState, intent: AcceptAllianceIntent): void {
  const pair = livingPair(state, intent.playerId, intent.targetPlayerId)
  if (pair === null) return
  const [accepter, requester] = pair
  // Es muss ein Angebot requester→accepter geben.
  if (!hasAllianceRequest(state.allianceRequests, requester.id, accepter.id)) return
  state.allianceRequests.delete(directedKey(requester.id, accepter.id))
  formAlliance(state, accepter.id, requester.id)
  emitDiploEvent(
    state,
    accepter,
    requester,
    `${accepter.name} und ${requester.name} sind verbündet`,
    accepter.color,
  )
}

/** Lehnt ein Bündnis-Angebot `requesterId → playerId` ab (verwirft die Anfrage). */
function applyDeclineAllianceIntent(state: GameState, intent: DeclineAllianceIntent): void {
  const pair = livingPair(state, intent.playerId, intent.requesterId)
  if (pair === null) return
  const [decliner, requester] = pair
  if (!hasAllianceRequest(state.allianceRequests, requester.id, decliner.id)) return
  state.allianceRequests.delete(directedKey(requester.id, decliner.id))
  emitDiploEvent(
    state,
    decliner,
    requester,
    `${decliner.name} lehnt das Bündnis von ${requester.name} ab`,
    decliner.color,
  )
}

function applyBreakAllianceIntent(state: GameState, intent: BreakAllianceIntent): void {
  const pair = livingPair(state, intent.playerId, intent.targetPlayerId)
  if (pair === null) return
  betrayAlliance(state, pair[0].id, pair[1].id)
}

function applySetEmbargoIntent(state: GameState, intent: SetEmbargoIntent): void {
  const pair = livingPair(state, intent.playerId, intent.targetPlayerId)
  if (pair === null) return
  const [from, to] = pair
  const key = directedKey(from.id, to.id)
  if (intent.enabled) {
    if (state.embargoes.has(key)) return
    state.embargoes.add(key)
    // Der Embargoierte grollt dem, der es verhängt (Wirtschafts-Affront).
    addGrudge(state, from.id, to.id, GRUDGE_PER_EMBARGO)
    emitDiploEvent(
      state,
      from,
      to,
      `${from.name} verhängt ein Embargo gegen ${to.name}`,
      from.color,
    )
  } else {
    if (!state.embargoes.has(key)) return
    state.embargoes.delete(key)
    emitDiploEvent(
      state,
      from,
      to,
      `${from.name} hebt das Embargo gegen ${to.name} auf`,
      from.color,
    )
  }
}

const TRADE_MODE_LABEL: Record<TradeMode, string> = {
  random: 'zufällig',
  nearest: 'nächste',
  farthest: 'weiteste',
  allies: 'nur Verbündete',
}

function applySetTradeModeIntent(state: GameState, intent: SetTradeModeIntent): void {
  const player = state.players.get(intent.playerId)
  if (player === undefined || player.tradeMode === intent.mode) return
  player.tradeMode = intent.mode
  if (player.isHuman) {
    emitEvent(state, `Handelsziele: ${TRADE_MODE_LABEL[intent.mode]}`, player.color)
  }
}

function applyToggleWarshipNeutralIntent(
  state: GameState,
  intent: ToggleWarshipNeutralIntent,
): void {
  const player = state.players.get(intent.playerId)
  if (player === undefined) return
  player.warshipSpareNeutral = !player.warshipSpareNeutral
  if (player.isHuman) {
    emitEvent(
      state,
      `Kriegsschiffe: ${player.warshipSpareNeutral ? 'neutrale schonen' : 'alle angreifen'}`,
      player.color,
    )
  }
}

function applyAttackIntent(state: GameState, intent: AttackIntent): void {
  const player = state.players.get(intent.playerId)
  if (player === undefined || !player.isAlive) return

  // Rundum-Ausbreitung: expandiert ohne Richtungs-Fokus gleichmäßig entlang der ganzen
  // Front. Klick auf eigenes Gebiet/Wildnis → gegen Wildnis (Ziel 0); Klick auf eine
  // erreichbare, nicht verbündete Nation → omni gegen GENAU diese Nation (Angriff entlang
  // der ganzen gemeinsamen Grenze). Bündelt in einen bestehenden Angriff auf dasselbe Ziel.
  if (intent.omni === true) {
    const troopsOmni = Math.min(intent.troops, player.troops)
    if (troopsOmni <= 0) return

    let omniTarget = 0 // Default: Wildnis
    if (
      intent.targetTile >= 0 &&
      intent.targetTile < state.map.state.length &&
      isPassable(state.map.terrain, intent.targetTile)
    ) {
      const owner = getOwner(state.map, intent.targetTile)
      if (owner > 0 && owner !== player.id && reachableByLand(state, player, intent.targetTile)) {
        // Angriff auf einen Verbündeten = Verrat (Bündnis bricht, Ächtung), dann greift man an.
        if (areAllied(state.alliances, player.id, owner)) betrayAlliance(state, player.id, owner)
        omniTarget = owner
      }
    }

    player.troops -= troopsOmni
    const existing = player.attacks.find((a) => a.targetPlayerId === omniTarget)
    if (existing !== undefined) {
      existing.reserveTroops += troopsOmni
      existing.omni = true
      return
    }
    const seed = omniTarget === 0 ? (player.frontier.values().next().value ?? 0) : intent.targetTile
    player.attacks.push({
      targetPlayerId: omniTarget,
      reserveTroops: troopsOmni,
      focusTile: seed,
      frontTile: seed,
      startTick: state.tick,
      omni: true,
    })
    return
  }

  if (intent.targetTile < 0 || intent.targetTile >= state.map.state.length) return
  // Ziel muss begehbares Land sein — auf Wasser/unpassierbare Berge gibt's nichts zu erobern.
  if (!isPassable(state.map.terrain, intent.targetTile)) return

  const targetOwner = getOwner(state.map, intent.targetTile)
  if (targetOwner === player.id) return // kein Selbst-Angriff
  // Angriff auf einen Verbündeten = Verrat: Bündnis bricht + Ächtung, dann läuft der Angriff.
  if (targetOwner > 0 && areAllied(state.alliances, player.id, targetOwner)) {
    betrayAlliance(state, player.id, targetOwner)
  }

  const troops = Math.min(intent.troops, player.troops)
  if (troops <= 0) return

  // Angriffe wirken nur über Land. Eine andere Landmasse erreicht man bewusst
  // über den Boot-Modus (BoatIntent), nicht implizit per Angriffs-Klick.
  if (!reachableByLand(state, player, intent.targetTile)) return

  player.troops -= troops
  // Mehrere Klicks auf dieselbe Front bündeln: existiert schon ein Angriff auf
  // diesen Gegner, fließen die Truppen in dessen Reserve und der Front-Fokus folgt
  // dem neuen Klick — statt viele kleine Einzelangriffe (Pillen) zu erzeugen.
  const existing = player.attacks.find((a) => a.targetPlayerId === targetOwner)
  if (existing !== undefined) {
    existing.reserveTroops += troops
    existing.focusTile = intent.targetTile
    existing.omni = false // gezielter Klick fokussiert einen evtl. laufenden omni-Angriff wieder
    return
  }
  player.attacks.push({
    targetPlayerId: targetOwner,
    reserveTroops: troops,
    focusTile: intent.targetTile,
    frontTile: intent.targetTile,
    startTick: state.tick,
  })
}

/**
 * Bewusster Boot-Befehl (Boot-Modus): schickt EIN Transport-Boot mit der per Slider
 * gewählten Truppenzahl zu einem beliebigen Küsten-Ziel (Wildnis oder Gegner), zu dem ein
 * Wasserweg von einer eigenen Küste existiert — auch wenn es über Land erreichbar wäre
 * (Flankierung über kurze Überfahrt). Schlägt der Start fehl (kein Wasserweg, keine eigene
 * Küste, Boot-Limit), gibt es einen Log-Hinweis statt eines stillen Fehlschlags.
 */
function applyBoatIntent(state: GameState, intent: BoatIntent): void {
  const player = state.players.get(intent.playerId)
  if (player === undefined || !player.isAlive) return
  if (intent.targetTile < 0 || intent.targetTile >= state.map.state.length) return
  if (!isPassable(state.map.terrain, intent.targetTile)) return

  const targetOwner = getOwner(state.map, intent.targetTile)
  if (targetOwner === player.id) return // kein Boot ins eigene Gebiet
  // Boot-Angriff auf einen Verbündeten = Verrat (Bündnis bricht), dann fährt das Boot.
  if (targetOwner > 0 && areAllied(state.alliances, player.id, targetOwner)) {
    betrayAlliance(state, player.id, targetOwner)
  }
  // Bewusst KEINE „über Land erreichbar"-Sperre mehr: ein Boot darf zu jedem Küsten-Ziel
  // fahren, zu dem ein Wasserweg existiert — auch wenn das Ziel über Land erreichbar wäre
  // (z.B. eine kurze Überfahrt, um eine gegnerische Verteidigungslinie an der Landgrenze zu
  // flankieren). Gültigkeit = Wasserweg vorhanden (unten via tryLaunchBoat).

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
  state.boats.push({
    ownerId: player.id,
    troops,
    path,
    progress: 0,
    targetTile: landingTile,
    returning: false,
  })
  // Landet das Boot auf fremdem Gebiet, wird der Verteidiger schon beim Versand gewarnt
  // (wie bei einem Angriff) — in seiner Farbe, damit „dein Land wird angegriffen" auffällt.
  const defenderId = getOwner(state.map, landingTile)
  const defender = defenderId === player.id ? undefined : state.players.get(defenderId)
  if (defender !== undefined && defender.isAlive) {
    emitEvent(
      state,
      `⚠ ${defender.name} wird von ${player.name} per Transportboot angegriffen`,
      defender.color,
    )
  } else {
    emitEvent(state, `${player.name} schickt ein Transportboot`, player.color)
  }
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

  // Erster Abbruch-Befehl: sanftes Zurückziehen einleiten (Reserve fließt über
  // ATTACK_CANCEL_TICKS zurück, kein Vormarsch mehr — siehe windDownCancellingAttack).
  // Zweiter Befehl auf einen schon abbrechenden Angriff: sofort fertig (Rest zurück).
  if (attack.cancelStartTick === undefined) {
    attack.cancelStartTick = state.tick
    return
  }
  player.troops += attack.reserveTroops
  player.attacks.splice(intent.attackIndex, 1)
}

/**
 * Aktive Abwehr: der Verteidiger opfert eigene freie Truppen 1:1 gegen die Reserve eines
 * eingehenden Angriffs (von `attackerId` auf ihn). Gedeckelt auf das Minimum aus gewünschtem
 * Einsatz, eigenen Truppen und Angriffs-Reserve. Leergelaufene Angriffe entfernt resolveAttacks.
 */
function applyDefendIntent(state: GameState, intent: DefendIntent): void {
  const player = state.players.get(intent.playerId)
  if (player === undefined || !player.isAlive) return
  const attacker = state.players.get(intent.attackerId)
  if (attacker === undefined || !attacker.isAlive) return
  const atk = attacker.attacks.find((a) => a.targetPlayerId === intent.playerId)
  if (atk === undefined) return
  const d = Math.min(intent.troops, player.troops, atk.reserveTroops)
  if (d <= 0) return
  player.troops -= d
  atk.reserveTroops -= d
  emitEvent(state, `${player.name} wehrt den Angriff von ${attacker.name} ab`, player.color)
}

/** Ruft das `boatIndex`-te eigene Boot zurück (es fährt zur Start-Küste um). */
function applyBoatRecallIntent(state: GameState, intent: BoatRecallIntent): void {
  let seen = 0
  for (const boat of state.boats) {
    if (boat.ownerId !== intent.playerId) continue
    if (seen === intent.boatIndex) {
      boat.returning = true
      return
    }
    seen++
  }
}

/**
 * Plant die Wasserroute eines Kriegsschiffs: vom dem Ziel nächstgelegenen eigenen
 * fertigen Hafen (mit Wasserweg zur Ziel-Wasserkomponente) zum Ziel-Wasser-Tile.
 * `null` wenn das Ziel kein Wasser ist oder kein Hafen das Ziel-Meer erreicht.
 */
function planWarshipRoute(
  state: GameState,
  playerId: number,
  targetTile: TileRef,
): TileRef[] | null {
  const comp = state.waterComponents
  const targetComp = comp[targetTile]
  if (targetComp === undefined || targetComp < 0) return null // Ziel ist kein Wasser
  const { width, height } = state.map
  const tx = targetTile % width
  const ty = Math.floor(targetTile / width)
  let bestStart = -1
  let bestDist = Infinity
  for (const b of state.buildings.values()) {
    if (b.type !== 'port' || b.ownerId !== playerId || !isBuildingComplete(b, state.tick)) continue
    const startWater = adjacentWaterByComponent(state.map, comp, b.tile).get(targetComp)
    if (startWater === undefined) continue
    const d = torusDistance(b.tile % width, Math.floor(b.tile / width), tx, ty, width, height)
    if (d < bestDist) {
      bestDist = d
      bestStart = startWater
    }
  }
  if (bestStart < 0) return null
  return findWaterPath(state.map, bestStart, targetTile, comp)
}

/** Entsendet ein Kriegsschiff zu einem Wasser-Ziel (von einem eigenen Hafen, gegen Gold). */
function applyLaunchWarshipIntent(state: GameState, intent: LaunchWarshipIntent): void {
  const player = state.players.get(intent.playerId)
  if (player === undefined || !player.isAlive) return
  const t = intent.targetTile
  if (t < 0 || t >= state.map.state.length) return
  const note = (msg: string): void => {
    if (player.isHuman) emitEvent(state, `${player.name}: ${msg}`, player.color)
  }
  const active = state.warships.reduce((n, w) => (w.ownerId === player.id ? n + 1 : n), 0)
  if (active >= MAX_WARSHIPS_PER_PLAYER) {
    note('Kriegsschiff-Limit erreicht')
    return
  }
  if (player.gold < WARSHIP_COST) {
    note('zu wenig Gold für ein Kriegsschiff')
    return
  }
  const route = planWarshipRoute(state, player.id, t)
  if (route === null) {
    note('kein Hafen mit Wasserweg zum Ziel')
    return
  }
  player.gold -= WARSHIP_COST
  state.warships.push({
    ownerId: player.id,
    path: route,
    progress: 0,
    dir: 1,
    hp: WARSHIP_HP,
    cooldown: 0,
    mode: player.warshipHold ? 'hold' : 'patrol',
    returning: false,
  })
  emitEvent(state, `${player.name} entsendet ein Kriegsschiff`, player.color)
}

/** Ruft das `warshipIndex`-te eigene Kriegsschiff zurück (fährt zur Küste, löst sich auf). */
function applyRecallWarshipIntent(state: GameState, intent: RecallWarshipIntent): void {
  let seen = 0
  for (const w of state.warships) {
    if (w.ownerId !== intent.playerId) continue
    if (seen === intent.warshipIndex) {
      w.returning = true
      return
    }
    seen++
  }
}

/** Schaltet den Kriegsschiff-Modus des Spielers um (Standard + alle aktiven eigenen Schiffe). */
function applyToggleWarshipModeIntent(state: GameState, intent: ToggleWarshipModeIntent): void {
  const player = state.players.get(intent.playerId)
  if (player === undefined) return
  player.warshipHold = !player.warshipHold
  const mode = player.warshipHold ? 'hold' : 'patrol'
  for (const w of state.warships) if (w.ownerId === player.id) w.mode = mode
  emitEvent(
    state,
    `${player.name}: Kriegsschiffe ${player.warshipHold ? 'halten & heilen' : 'patrouillieren'}`,
    player.color,
  )
}

/**
 * Schickt die ausgewählten eigenen Kriegsschiffe zu einem Wasser-Tile: jedes bekommt eine
 * neue Wasserroute von seiner aktuellen Position dorthin (und patrouilliert sie dann). Ohne
 * Wasserweg (andere Wasser-Komponente) bleibt das jeweilige Schiff unverändert.
 */
function applyMoveWarshipIntent(state: GameState, intent: MoveWarshipIntent): void {
  if (intent.targetTile < 0 || intent.targetTile >= state.map.state.length) return
  if (isPassable(state.map.terrain, intent.targetTile)) return // Ziel muss Wasser sein
  for (const idx of intent.warshipIndices) {
    const ws = state.warships[idx]
    if (ws === undefined || ws.ownerId !== intent.playerId || ws.returning) continue
    const from = shipTile(ws)
    const route = findWaterPath(state.map, from, intent.targetTile, state.waterComponents)
    if (route === null || route.length < 2) continue
    ws.path = route
    ws.progress = 0
    ws.dir = 1
  }
}

/** Bewegt Kriegsschiffe: Ping-Pong-Patrouille entlang der Route; zurückgerufene fahren heim. */
function advanceWarships(state: GameState): void {
  if (state.warships.length === 0) return
  const { width, height } = state.map
  const survivors: Warship[] = []
  for (const w of state.warships) {
    if (w.returning) {
      w.progress -= WARSHIP_SPEED
      if (w.progress > 0) survivors.push(w)
      continue
    }
    const maxP = w.path.length - 1
    if (w.mode === 'hold' && w.hp < WARSHIP_HP) {
      // „Halten & Heilen": beschädigt → Richtung Hafen (Routen-Start) zurück, nicht weiter
      // rauspatrouillieren. Dort greift unten die Heilung; ist es wieder voll, patrouilliert
      // es normal weiter.
      w.dir = 1
      w.progress = Math.max(0, w.progress - WARSHIP_SPEED)
    } else {
      w.progress += WARSHIP_SPEED * w.dir
      if (w.progress >= maxP) {
        w.progress = maxP
        w.dir = -1
      } else if (w.progress <= 0) {
        w.progress = 0
        w.dir = 1
      }
    }
    // Heilung: liegt das Schiff nahe einem eigenen fertigen Hafen, regeneriert es HP.
    if (w.hp < WARSHIP_HP && nearOwnPort(state, w, width, height)) {
      w.hp = Math.min(WARSHIP_HP, w.hp + WARSHIP_HEAL_PER_TICK)
    }
    survivors.push(w)
  }
  state.warships = survivors
}

/** Liegt das Kriegsschiff in `WARSHIP_HEAL_RANGE` eines eigenen fertigen Hafens? */
function nearOwnPort(state: GameState, ws: Warship, width: number, height: number): boolean {
  const { wx, wy } = shipWorldPos(ws, width, height)
  for (const b of state.buildings.values()) {
    if (b.type !== 'port' || b.ownerId !== ws.ownerId || !isBuildingComplete(b, state.tick))
      continue
    const bx = b.tile % width
    const by = Math.floor(b.tile / width)
    if (torusDistance(wx, wy, bx, by, width, height) <= WARSHIP_HEAL_RANGE) return true
  }
  return false
}

/** Ob `arr` das Objekt `x` (per Identität) enthält — Union-sicher ohne Typ-Verengung. */
function arrHas<T>(arr: readonly T[], x: unknown): boolean {
  return (arr as readonly unknown[]).includes(x)
}

/**
 * Seekrieg (deterministisch, feste Reihenfolge): Kriegsschiffe feuern alle
 * `WARSHIP_SHOT_COOLDOWN` Ticks ein **Projektil** auf ein feindliches Ziel (Kriegsschiff/
 * Boot/Handelsschiff) in `NAVAL_RANGE`. Schaden fällt erst beim Einschlag (nach der von der
 * Distanz abhängigen Flugzeit `impactAt`) — stirbt der Schütze vorher, verpufft sein Projektil (nicht
 * „beide sterben"). „Feindlich" = anderer Besitzer und nicht verbündet.
 *
 * Reihenfolge: Cooldowns runter → Projektile fliegen + Einschläge → Tote entfernen → neue
 * Schüsse (von Überlebenden). So feuern in diesem Tick versenkte Schiffe nicht mehr.
 */
function resolveNavalCombat(state: GameState): void {
  const { width: w, height: h } = state.map

  // 1. Schuss-Cooldowns runterzählen.
  for (const ws of state.warships) if (ws.cooldown > 0) ws.cooldown--

  // 2. Projektile vorrücken; bei Einschlag Schaden/Versenkung (Schütze muss noch leben).
  if (state.projectiles.length > 0) {
    const sunkBoats = new Set<Boat>()
    const sunkTrades = new Set<TradeShip>()
    const flying: Projectile[] = []
    for (const pr of state.projectiles) {
      pr.travel++
      if (pr.travel < pr.impactAt) {
        flying.push(pr)
        continue
      }
      if (!arrHas(state.warships, pr.shooter)) continue // Schütze tot → verpufft
      const shooterId = pr.shooter.ownerId
      if (pr.targetKind === 'warship') {
        if (arrHas(state.warships, pr.target)) {
          const tgt = pr.target as Warship
          tgt.hp -= WARSHIP_DAMAGE_PER_TICK
          // Beschuss → Groll (auch jeder Treffer zählt, nicht erst die Versenkung).
          addGrudge(state, shooterId, tgt.ownerId, GRUDGE_PER_WARSHIP_HIT)
        }
      } else if (pr.targetKind === 'boat') {
        if (arrHas(state.boats, pr.target)) {
          const tgt = pr.target as Boat
          sunkBoats.add(tgt)
          addGrudge(state, shooterId, tgt.ownerId, GRUDGE_PER_BOAT_SUNK)
        }
      } else if (arrHas(state.tradeShips, pr.target)) {
        const tgt = pr.target as TradeShip
        if (!sunkTrades.has(tgt)) {
          sunkTrades.add(tgt)
          // Beide Hafen-Besitzer verlieren das Handelseinkommen → beide grollen.
          addGrudge(state, shooterId, tgt.fromOwnerId, GRUDGE_PER_TRADE_SUNK)
          addGrudge(state, shooterId, tgt.toOwnerId, GRUDGE_PER_TRADE_SUNK)
          // Piraterie: der Schütze ERBEUTET die Fracht — beide Anteile (2× das Fahrt-Gold).
          const pirate = state.players.get(shooterId)
          if (pirate !== undefined && pirate.isAlive) {
            const loot = tgt.gold * 2
            pirate.gold += loot
            pirate.goldEarned += loot
          }
        }
      }
    }
    state.projectiles = flying
    if (sunkBoats.size > 0) {
      state.boats = state.boats.filter((b) => {
        if (!sunkBoats.has(b)) return true
        const o = state.players.get(b.ownerId)
        emitEvent(state, `${o?.name ?? '?'}s Transportboot versenkt`, o?.color ?? 0xffffffff)
        return false
      })
    }
    if (sunkTrades.size > 0) {
      state.tradeShips = state.tradeShips.filter((ts) => {
        if (!sunkTrades.has(ts)) return true
        const o = state.players.get(ts.fromOwnerId)
        emitEvent(state, `Handelsschiff blockiert`, o?.color ?? 0xffffffff)
        return false
      })
    }
  }

  // 3. Versenkte Kriegsschiffe (HP ≤ 0) entfernen.
  if (state.warships.some((ws) => ws.hp <= 0)) {
    state.warships = state.warships.filter((ws) => {
      if (ws.hp > 0) return true
      const o = state.players.get(ws.ownerId)
      emitEvent(state, `${o?.name ?? '?'}s Kriegsschiff versenkt`, o?.color ?? 0xffffffff)
      return false
    })
  }

  // 4. Schussbereite Kriegsschiffe feuern auf ein feindliches Ziel in Reichweite.
  if (state.warships.length === 0) return
  const wpos = state.warships.map((ws) => shipWorldPos(ws, w, h))
  const hostile = (a: number, b: number): boolean => a !== b && !areAllied(state.alliances, a, b)
  const inRange = (
    pos: { wx: number; wy: number },
    ship: { path: readonly TileRef[]; progress: number },
  ): boolean => {
    const p = shipWorldPos(ship, w, h)
    return torusDistance(pos.wx, pos.wy, p.wx, p.wy, w, h) <= NAVAL_RANGE
  }
  // „Neutrale schonen"-Modus: ein Kriegsschiff dieses Besitzers greift Handelsschiffe nur an,
  // wenn ER mit einem Hafen-Besitzer wirklich verfeindet ist (Embargo oder deutlicher Groll) —
  // sonst lässt es neutrale Fracht in Ruhe. Boote/Kriegsschiffe bleiben immer Ziel.
  const sparesNeutralTrade = (shooterId: number, ts: TradeShip): boolean => {
    if (state.players.get(shooterId)?.warshipSpareNeutral !== true) return false
    for (const endpoint of [ts.fromOwnerId, ts.toOwnerId]) {
      if (isTradeEmbargoed(state, shooterId, endpoint)) return false
      if ((state.grudge.get(directedKey(endpoint, shooterId)) ?? 0) > NEUTRAL_BLOCKADE_GRUDGE)
        return false
    }
    return true // neutral → verschonen
  }
  for (let i = 0; i < state.warships.length; i++) {
    const ws = state.warships[i]
    const pos = wpos[i]
    if (ws === undefined || pos === undefined || ws.cooldown > 0 || ws.returning) continue
    let target: Warship | Boat | TradeShip | null = null
    let kind: 'warship' | 'boat' | 'trade' = 'warship'
    // Priorität: feindliche Kriegsschiffe → Transportboote → Handelsschiffe (Array-Reihenfolge).
    for (let j = 0; j < state.warships.length; j++) {
      const o = state.warships[j]
      const op = wpos[j]
      if (o === undefined || op === undefined || o === ws || !hostile(ws.ownerId, o.ownerId))
        continue
      if (torusDistance(pos.wx, pos.wy, op.wx, op.wy, w, h) <= NAVAL_RANGE) {
        target = o
        kind = 'warship'
        break
      }
    }
    if (target === null) {
      for (const b of state.boats) {
        if (hostile(ws.ownerId, b.ownerId) && inRange(pos, b)) {
          target = b
          kind = 'boat'
          break
        }
      }
    }
    if (target === null) {
      for (const ts of state.tradeShips) {
        if (
          hostile(ws.ownerId, ts.fromOwnerId) &&
          hostile(ws.ownerId, ts.toOwnerId) &&
          inRange(pos, ts) &&
          !sparesNeutralTrade(ws.ownerId, ts)
        ) {
          target = ts
          kind = 'trade'
          break
        }
      }
    }
    if (target !== null) {
      const tp = shipWorldPos(target, w, h)
      const dist = torusDistance(pos.wx, pos.wy, tp.wx, tp.wy, w, h)
      state.projectiles.push({
        shooter: ws,
        target,
        targetKind: kind,
        fromX: pos.wx,
        fromY: pos.wy,
        travel: 0,
        impactAt: Math.max(1, Math.round(dist / PROJECTILE_SPEED)),
      })
      ws.cooldown = WARSHIP_SHOT_COOLDOWN
    }
  }
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

/** Truppen-Cap-Faktor für wilde Nationen — niedrige Dichte → eroberbarer Puffer. */
const WILD_CAP_FACTOR = 0.5

function growPopulations(state: GameState): void {
  for (const player of orderedPlayers(state)) {
    if (!player.isAlive) continue
    const max = effectiveMaxTroops(state, player.id)
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
  const base = maxTroops(p.weightedTiles, { bot: !p.isHuman }) + cityCapBonus(state, playerId)
  return p.wild ? Math.floor(base * WILD_CAP_FACTOR) : base
}

/** Hängt ein Ereignis ans Log (chronologisch). */
/** Kompaktes Gold-Format fürs Ereignislog (deterministisch, kein locale): 12345 → "12.3k". */
function fmtCompactGold(value: number): string {
  const n = Math.round(value)
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

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
    if (boat.returning) {
      // Zurückgerufen: rückwärts zur Start-Küste; angekommen → Truppen in den Pool.
      boat.progress -= BOAT_SPEED
      if (boat.progress <= 0) {
        const owner = state.players.get(boat.ownerId)
        if (owner !== undefined) owner.troops += boat.troops
      } else {
        survivors.push(boat)
      }
      continue
    }
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
  const aLoss = attackerLossPerTile(defTroops, defTiles, vsNull, mag)

  if (boat.troops <= aLoss) return // gescheiterte Landung, Truppen verloren

  // Verlorenes Land nimmt seine Bevölkerung mit (siehe advanceAttack); Verräter: 1,5× Verluste.
  let bridgeLoot = 0
  if (!vsNull && defender !== undefined) {
    const dLoss =
      defenderLossPerTile(defender.troops, defender.tilesOwned, false) *
      traitorDamageMul(state, owner, boat.ownerId)
    defender.troops = Math.max(0, Math.floor(defender.troops - dLoss))
    bridgeLoot = lootGoldOnCapture(attacker, defender) // Gold-Anteil des Brückenkopf-Tiles erbeuten
  }
  const remaining = Math.floor(boat.troops - aLoss)
  captureTile(state, target, boat.ownerId) // setzt Frontier auf der neuen Landmasse
  attacker.attacks.push({
    targetPlayerId: owner,
    reserveTroops: remaining,
    focusTile: target,
    frontTile: target,
    startTick: state.tick,
    ...(bridgeLoot > 0 && { lootGained: bridgeLoot }),
  })
  emitEvent(state, `${attacker.name} landet Truppen an`, attacker.color)
}

/** Häfen senden gestaffelt Handelsschiffe zu erreichbaren, fremden Häfen. */
function spawnTradeShips(state: GameState): void {
  const ports: { tile: TileRef; level: number }[] = []
  for (const b of state.buildings.values()) {
    if (b.type === 'port' && isBuildingComplete(b, state.tick))
      ports.push({ tile: b.tile, level: b.level })
  }
  if (ports.length < 2) return
  ports.sort((a, b) => a.tile - b.tile)

  const { width, height } = state.map
  for (const { tile: origin, level } of ports) {
    // Staffelung: jeder Hafen ist in einem festen Tick seines Intervall-Fensters dran.
    if (state.tick % TRADE_INTERVAL_TICKS !== origin % TRADE_INTERVAL_TICKS) continue
    const originOwner = getOwner(state.map, origin)
    if (originOwner === 0) continue
    const owner = state.players.get(originOwner)
    const mode: TradeMode = owner?.tradeMode ?? 'random'

    // Gültige Ziele: Häfen anderer lebender Spieler, nicht embargoiert; bei 'allies' nur
    // aktuelle Allianzpartner. Distanz vorberechnen (für nearest/farthest).
    const ox = origin % width
    const oy = Math.floor(origin / width)
    const candidates: { tile: TileRef; dist: number }[] = []
    for (const { tile: dest } of ports) {
      if (dest === origin) continue
      const destOwner = getOwner(state.map, dest)
      if (destOwner === 0 || destOwner === originOwner) continue
      if (isTradeEmbargoed(state, originOwner, destOwner)) continue
      if (mode === 'allies' && !areAllied(state.alliances, originOwner, destOwner)) continue
      const dx = dest % width
      const dy = Math.floor(dest / width)
      candidates.push({ tile: dest, dist: torusDistance(ox, oy, dx, dy, width, height) })
    }
    if (candidates.length === 0) continue
    candidates.sort((a, b) => a.dist - b.dist || a.tile - b.tile)

    // Ziel je Modus wählen — Hafen-Level = Anzahl Schiffe pro Sende-Fenster.
    const pickTarget = (): TileRef => {
      switch (mode) {
        case 'nearest':
          return candidates[0]?.tile ?? origin
        case 'farthest':
          return candidates[candidates.length - 1]?.tile ?? origin
        case 'allies':
        case 'random':
          return state.rng.randElement(candidates).tile
      }
    }

    const routeCache = new Map<TileRef, TileRef[] | null>()
    const routeTo = (dest: TileRef): TileRef[] | null => {
      const cached = routeCache.get(dest)
      if (cached !== undefined) return cached
      const r = planWaterRoute(state.map, state.waterComponents, origin, dest)
      const route = r !== null && r.length >= 2 ? r : null
      routeCache.set(dest, route)
      return route
    }

    for (let k = 0; k < level; k++) {
      const dest = pickTarget()
      const path = routeTo(dest)
      if (path === null) continue // unerreichbar (andere Wasser-Komponente) → dieses Schiff entfällt
      state.tradeShips.push({
        fromOwnerId: originOwner,
        toOwnerId: getOwner(state.map, dest),
        path,
        progress: 0,
        gold: tradeGold(path.length),
        originPort: origin,
        destPort: dest,
      })
    }
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
      if (from !== undefined && from.isAlive) {
        from.gold += ship.gold
        from.goldEarned += ship.gold
      }
      if (to !== undefined && to.isAlive) {
        to.gold += ship.gold
        to.goldEarned += ship.gold
      }
      // Handel zwischen zwei Nationen schafft beidseitige Gunst (∝ Fahrt-Gold).
      if (ship.fromOwnerId !== ship.toOwnerId) {
        addGoodwill(
          state,
          ship.fromOwnerId,
          ship.toOwnerId,
          Math.round(ship.gold / GOODWILL_PER_TRADE_DIVISOR),
        )
      }
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
export function countPassableLand(map: GameMap): number {
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

/**
 * Greifen sich zwei Spieler GEGENSEITIG an, heben sich ihre Reserven 1:1 auf
 * (Kollision an der Front) — die kleinere Reserve verschwindet ganz, nur der
 * Überschuss des Stärkeren setzt sich durch. Pro Paar einmal je Tick; läuft vor
 * `resolveAttacks`, leergelaufene Angriffe werden dort entfernt.
 */
function resolveAttackCollisions(state: GameState): void {
  for (const a of orderedPlayers(state)) {
    if (!a.isAlive) continue
    for (const atkA of a.attacks) {
      const bId = atkA.targetPlayerId
      if (bId <= 0 || bId <= a.id) continue // Wildnis schlägt nicht zurück; Paar nur einmal
      const b = state.players.get(bId)
      if (b === undefined || !b.isAlive) continue
      const atkB = b.attacks.find((x) => x.targetPlayerId === a.id)
      if (atkB === undefined) continue
      const d = Math.min(atkA.reserveTroops, atkB.reserveTroops)
      atkA.reserveTroops -= d
      atkB.reserveTroops -= d
    }
  }
}

function resolveAttacks(state: GameState): void {
  for (const player of orderedPlayers(state)) {
    if (!player.isAlive) continue
    // Iteration rückwärts, weil wir gelöschte Angriffe aus dem Array entfernen
    for (let i = player.attacks.length - 1; i >= 0; i--) {
      const attack = player.attacks[i]
      if (attack === undefined) continue
      // Abbrechende Angriffe erobern nichts mehr — ihre Reserve fließt nur noch zurück.
      const stillActive =
        attack.cancelStartTick === undefined
          ? advanceAttack(state, player, attack)
          : windDownCancellingAttack(state, player, attack)
      if (!stillActive) {
        // Beute-Feedback: beim Angriffs-Ende einmal melden, wie viel Gold von wem erbeutet
        // wurde (nur für menschliche Angreifer → kein Log-Spam bei hunderten KI/Wilden).
        const loot = attack.lootGained ?? 0
        if (player.isHuman && loot > 0) {
          const fromName =
            attack.targetPlayerId > 0
              ? (state.players.get(attack.targetPlayerId)?.name ?? 'Wildnis')
              : 'Wildnis'
          emitEvent(
            state,
            `${player.name} erbeutet ${fmtCompactGold(loot)} Gold von ${fromName}`,
            0xe8c14aff,
          )
        }
        player.attacks.splice(i, 1)
      }
    }
  }
}

/**
 * Führt einen abgebrochenen Angriff einen Tick weiter zurück: ein Anteil der Reserve
 * (gleichmäßig über die Rest-Ticks bis [[ATTACK_CANCEL_TICKS]]) fließt in den Spieler-Pool.
 * Erobert nichts. Returnt `false`, sobald die Reserve aufgebraucht oder die Frist abgelaufen
 * ist (Rest wird dann komplett zurückgegeben).
 */
function windDownCancellingAttack(state: GameState, player: Player, attack: Attack): boolean {
  const start = attack.cancelStartTick ?? state.tick
  const elapsed = state.tick - start
  if (attack.reserveTroops <= 0) return false
  if (elapsed >= ATTACK_CANCEL_TICKS) {
    player.troops += attack.reserveTroops
    attack.reserveTroops = 0
    return false
  }
  const remainingTicks = Math.max(1, ATTACK_CANCEL_TICKS - elapsed)
  const refund = Math.min(attack.reserveTroops, Math.ceil(attack.reserveTroops / remainingTicks))
  player.troops += refund
  attack.reserveTroops -= refund
  return attack.reserveTroops > 0
}

/**
 * Gold-Beute pro erobertem Tile: der Angreifer erbeutet den Pro-Tile-Anteil des Gold-
 * Vorrats des Verteidigers (`gold / tilesOwned`, vor der Eroberung dieses Tiles). Erobert
 * man jemandes gesamtes Gebiet, bekommt man so praktisch sein ganzes Gold — auch von
 * wilden Nationen. Analog zu [[defenderLossPerTile]] (Bevölkerung), nur für Gold.
 */
function lootGoldOnCapture(attacker: Player, defender: Player): number {
  if (defender.tilesOwned <= 0 || defender.gold <= 0) return 0
  const loot = Math.floor(defender.gold / defender.tilesOwned)
  if (loot <= 0) return 0
  defender.gold -= loot
  attacker.gold += loot
  attacker.goldEarned += loot
  return loot
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
  // Rundum-Ausbreitung (omni): kein Richtungs-Fokus UND keine Bucht-Bevorzugung → die
  // Eroberung verteilt sich (über den Vorab-Shuffle) gleichmäßig über die GANZE Grenze, statt
  // sich erst in konkave Buchten zu fressen. Terrain-Bremse bleibt. Sonst: Fokus + Glättung.
  const focusPull = attack.omni === true ? 0 : vsTerraNullius ? 1 : NATION_FOCUS_PULL
  const smoothing = attack.omni === true ? 0 : FRONT_SMOOTHING
  const keyed = tiles.map((t) => {
    const tx = t % mapW
    const ty = Math.floor(t / mapW)
    const dist = torusDistance(tx, ty, focusX, focusY, mapW, mapH)
    const own = ownNeighborCount(state, t, attacker.id)
    const terrainPenalty =
      (terrainMagnitude(state.map.terrain, t) - PLAINS_MAG) * TERRAIN_WAVE_PENALTY
    return { t, key: dist * focusPull - own * smoothing + terrainPenalty }
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
  const capturedTiles: TileRef[] = []

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
    const aLoss = attackerLossPerTile(
      isCurrentlyTerraNullius ? 0 : defenderTroops,
      isCurrentlyTerraNullius ? 1 : defenderTilesOwned,
      isCurrentlyTerraNullius,
      mag,
    )

    if (attack.reserveTroops < aLoss) {
      attack.reserveTroops = 0
      break
    }

    attack.reserveTroops = Math.max(0, Math.floor(attack.reserveTroops - aLoss))

    // Verlorenes Land nimmt seine Bevölkerung mit: der Verteidiger verliert pro Tile
    // seine Pro-Tile-Truppen → Truppen und Tiles sinken proportional, die Dichte
    // bleibt konstant, und 2:1-Übermacht reicht exakt für die komplette Einnahme.
    // Verräter (von Dritten angegriffen): 1,5× Verluste → er bricht schneller weg.
    if (!isCurrentlyTerraNullius && defender !== undefined) {
      const dLoss =
        defenderLossPerTile(defender.troops, defender.tilesOwned, false) *
        traitorDamageMul(state, currentOwner, attacker.id)
      defender.troops = Math.max(0, Math.floor(defender.troops - dLoss))
      // Gold-Anteil dieses Tiles erbeuten + auf dem Angriff summieren (für das Beute-Event).
      attack.lootGained = (attack.lootGained ?? 0) + lootGoldOnCapture(attacker, defender)
    }

    captureTile(state, ref, attacker.id)
    capturedTiles.push(ref)
    sumDx += signedTorusDelta(ref % fw, anchorX, fw)
    sumDy += signedTorusDelta(Math.floor(ref / fw), anchorY, fh)
    captured++
  }

  // Eingeschlossene Taschen schließen: vom Angreifer rundum umzingelte fremde/neutrale
  // Tiles fallen frei (keine „Blasen" hinter einer durchbrochenen Front).
  if (capturedTiles.length > 0) fillEnclosedPockets(state, attacker, capturedTiles)

  if (captured > 0) {
    const mx = (((anchorX + Math.round(sumDx / captured)) % fw) + fw) % fw
    const my = (((anchorY + Math.round(sumDy / captured)) % fh) + fh) % fh
    attack.frontTile = my * fw + mx
  }

  return attack.reserveTroops > 0
}

/**
 * Schließt vom Angreifer rundum umzingelte fremde/neutrale Tiles (sie fallen frei) —
 * verhindert „Blasen"/Löcher hinter einer gerade durchbrochenen Front. Lokal: prüft
 * nur die Nachbarn der gerade eroberten Tiles, in wenigen Wellen (begrenzt).
 */
function fillEnclosedPockets(state: GameState, attacker: Player, seeds: readonly TileRef[]): void {
  const { map } = state
  const { width, height } = map
  const isEnclosedByAttacker = (ref: TileRef): boolean => {
    let hasPassable = false
    for (const nn of neighbors4(ref, width, height)) {
      if (!isPassable(map.terrain, nn)) continue
      hasPassable = true
      if (getOwner(map, nn) !== attacker.id) return false
    }
    return hasPassable
  }
  let frontier: TileRef[] = [...seeds]
  let guard = 0
  while (frontier.length > 0 && guard < 8) {
    guard++
    const next: TileRef[] = []
    for (const ref of frontier) {
      for (const n of neighbors4(ref, width, height)) {
        if (!isPassable(map.terrain, n)) continue
        if (getOwner(map, n) === attacker.id) continue
        if (isEnclosedByAttacker(n)) {
          captureTile(state, n, attacker.id)
          next.push(n)
        }
      }
    }
    frontier = next
  }
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
  state.recentCaptures.set(ref, state.tick) // frisch erobert → kurzes Aufleuchten im Render

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
