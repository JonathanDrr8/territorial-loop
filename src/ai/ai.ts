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
  bomberLaunchInfo,
  buildCostFor,
  countBuildingsOfType,
  effectiveMaxTroops,
  estimateBomberFlakDamage,
  isBuildingAllowed,
  warshipCapacity,
  type GameState,
  type Player,
} from '../core/game'
import { defenseRange, flakRange, isBuildingComplete, type BuildingType } from '../core/buildings'
import { areAllied, directedKey, hasAllianceRequest } from '../core/diplomacy'
import {
  BOMBER_HP,
  NAVAL_RANGE,
  planBomberRoute,
  shipTile,
  WARSHIP_COST,
  type BomberRoute,
} from '../core/ships'
import { PRESET_ELO, profileForElo } from './strength'
import type { Intent } from '../core/intent'
import { createPRNG } from '../core/random'
import { getOwner } from '../world/map'
import { isLand } from '../world/terrain'
import { neighbors4, tileRef, tileXY, torusDistance } from '../world/torus'

export type Difficulty = 'beginner' | 'easy' | 'standard' | 'advanced' | 'expert'

/** Alle Stufen in aufsteigender Stärke (für UI-Auswahl, Arena-Roster, Validierung). */
export const DIFFICULTIES: readonly Difficulty[] = [
  'beginner',
  'easy',
  'standard',
  'advanced',
  'expert',
]

/** Übersteigt die Netto-Gunst (Gunst − Groll) diesen Wert, schont die KI den Partner (wie verbündet). */
const FRIEND_SPARE_THRESHOLD = 200
/** Ab diesem Netto-Groll (Groll − Gunst) lehnt die KI ein Bündnis mit dem Betreffenden ab. */
const ALLY_REFUSE_GRUDGE = 120

export interface DifficultyProfile {
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
  /** Baut die KI Flak (Luftabwehr) — reagiert auf Bomber, schützt Wirtschaft. ADR-0020 Stufe 1. */
  readonly usesAirDefense: boolean
  /** Nutzt die KI offensive Bomber (Flughafen bauen, Bomben werfen). ADR-0020 Stufe 2. */
  readonly usesBombers: boolean
  /** Wahrscheinlichkeit pro Entscheidung einen Bomber zu starten (wenn startbar). ADR-0020 Stufe 2. */
  readonly bomberChance: number
  /** Heilt die KI Bombenkrater / neutrale Löcher tief im eigenen Reich. ADR-0020 Stufe 3. */
  readonly healsCraters: boolean
  /**
   * Wirtschafts-Rückgrat (OpenFront-Stil, ADR-0021): baut proaktiv 1 Stadt je `tilesPerCity` Tiles
   * (Städte heben den Truppen-Cap → Basis fürs Heer). 0 = baut keine Wirtschaft (nur Anfänger).
   * Kleiner = dichter = stärker. Schlüssel-Ratio für den Tuner.
   */
  readonly tilesPerCity: number
}

// Wirtschafts-Ratios relativ zur Stadtzahl (OpenFront-Vorbild „Städte zuerst, Rest als Ratio pro
// Stadt", ADR-0021). Start-Werte — der Tuner justiert sie später. Hafen/Fabrik versorgen das
// Gold-Netz, Flughafen die Luftwaffe.
const PORT_PER_CITY = 0.5
const FACTORY_PER_CITY = 0.75
const AIRPORT_PER_CITY = 0.34

export const PROFILES: Record<Difficulty, DifficultyProfile> = {
  // Die 5 Presets sind Punkte auf dem kontinuierlichen Stärke-Kontinuum (ADR-0022): jedes Profil
  // kommt aus profileForElo(PRESET_ELO[...]) — so ist das angezeigte ELO die echte Spielstärke und
  // Presets + Ranked-Modus teilen sich dieselbe Engine. Tuning passiert zentral in strength.ts.
  beginner: profileForElo(PRESET_ELO.beginner),
  easy: profileForElo(PRESET_ELO.easy),
  standard: profileForElo(PRESET_ELO.standard),
  advanced: profileForElo(PRESET_ELO.advanced),
  expert: profileForElo(PRESET_ELO.expert),
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
  usesAirDefense: false,
  usesBombers: false,
  bomberChance: 0,
  healsCraters: false,
  tilesPerCity: 0,
}

export interface AI {
  /** Aufgerufen pro Sim-Tick. Returnt 0..n Intents für diesen Tick. */
  decide(state: GameState): readonly Intent[]
}

export function createAI(
  playerId: number,
  gameSeed: string,
  difficulty: Difficulty = 'standard',
  wild = false,
  profileOverride?: DifficultyProfile,
): AI {
  // profileOverride: vom Tuner (ADR-0021) eingespeistes Kandidaten-Profil — ersetzt das Stufen-Profil.
  const profile = profileOverride ?? (wild ? WILD_PROFILE : PROFILES[difficulty])
  const rng = createPRNG(`ai-${playerId.toString()}-${gameSeed}`)
  let nextDecisionTick = rng.nextInt(profile.cooldownMin, profile.cooldownMax)

  /** Ein Land-Nachbar-Ziel der Frontier (bevorzugt Gegner oder Neutrale). */
  function pickLandTarget(state: GameState, player: Player, preferEnemies: boolean): number {
    const { width, height } = state.map
    // Gegner-Tiles mit Beziehungs-Gewicht: resentierte Nationen bevorzugen, gute Partner meiden.
    const enemyTiles: { tile: number; weight: number }[] = []
    const neutralTiles: number[] = []
    const seen = new Set<number>()

    /** Beziehungs-bewertet ein Gegner-Tile: `null` = nicht angreifen (Freund), sonst Gewicht. */
    const enemyWeight = (owner: number): number | null => {
      const grudge = state.grudge.get(directedKey(owner, player.id)) ?? 0
      const goodwill = state.goodwill.get(directedKey(owner, player.id)) ?? 0
      // Starker Partner (Gunst klar über Groll) → wie ein Verbündeter behandeln, nicht angreifen.
      if (goodwill - grudge > FRIEND_SPARE_THRESHOLD) return null
      // Sonst: Grundgewicht + Groll-Aufschlag (gezielte Vergeltung), abzgl. Gunst-Dämpfung.
      return Math.max(0.15, 1 + Math.min(grudge / 40, 6) - Math.min(goodwill / 60, 2))
    }

    for (const ref of player.frontier) {
      for (const n of neighbors4(ref, width, height)) {
        if (seen.has(n)) continue
        seen.add(n)
        const owner = getOwner(state.map, n)
        if (owner === player.id) continue
        if (owner === 0) {
          neutralTiles.push(n)
          continue
        }
        // Verbündete nicht angreifen.
        if (areAllied(state.alliances, player.id, owner)) continue
        const w = enemyWeight(owner)
        if (w !== null) enemyTiles.push({ tile: n, weight: w })
      }
    }

    if (preferEnemies) {
      if (enemyTiles.length > 0) return weightedPickTile(enemyTiles)
      return neutralTiles.length > 0 ? rng.randElement(neutralTiles) : -1
    }
    if (neutralTiles.length > 0) return rng.randElement(neutralTiles)
    return enemyTiles.length > 0 ? weightedPickTile(enemyTiles) : -1
  }

  /** Gewichtete (deterministische) Auswahl eines Tiles aus {tile, weight}-Kandidaten. */
  function weightedPickTile(items: readonly { tile: number; weight: number }[]): number {
    let total = 0
    for (const it of items) total += it.weight
    if (total <= 0) return items[0]?.tile ?? -1
    let r = rng.next() * total
    for (const it of items) {
      r -= it.weight
      if (r <= 0) return it.tile
    }
    return items[items.length - 1]?.tile ?? -1
  }

  /**
   * Ein entferntes Gegner-Tile für einen amphibischen Angriff. Statt rein zufällig wird der
   * Gegner gewichtet: SCHWACHE (wenig Truppen → echtes Land zu holen) und BEGROLLTE Nationen
   * bevorzugt. Der Core prüft danach, ob eine Wasserroute existiert. (ADR-0020 Stufe 3)
   */
  function pickBoatTarget(state: GameState, player: Player): number {
    const enemies: { p: Player; weight: number }[] = []
    for (const p of state.players.values()) {
      if (p.id === player.id || !p.isAlive) continue
      if (areAllied(state.alliances, player.id, p.id)) continue
      if (p.frontier.size === 0) continue
      const grudge = state.grudge.get(directedKey(p.id, player.id)) ?? 0
      const goodwill = state.goodwill.get(directedKey(p.id, player.id)) ?? 0
      if (goodwill - grudge > FRIEND_SPARE_THRESHOLD) continue // Gunst-Partner verschonen
      // Schwäche (eigene/feindliche Truppen) + Groll-Aufschlag, gedämpft durch Gunst.
      const weakness = player.troops / Math.max(1, p.troops)
      const weight = Math.max(
        0.1,
        weakness + Math.min(grudge / 40, 3) - Math.min(goodwill / 60, 1.5),
      )
      enemies.push({ p, weight })
    }
    if (enemies.length === 0) return -1
    enemies.sort((a, b) => a.p.id - b.p.id)
    let total = 0
    for (const e of enemies) total += e.weight
    let r = rng.next() * total
    let enemy = enemies[enemies.length - 1]?.p
    for (const e of enemies) {
      r -= e.weight
      if (r <= 0) {
        enemy = e.p
        break
      }
    }
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

  /**
   * Eingehende feindliche Bomber, die ein eigenes Tile anvisieren (noch nicht abgeworfen).
   * Grundlage der Luftabwehr-Reaktion: wo droht ein Einschlag? (ADR-0020 Stufe 1)
   */
  function incomingBomberTargets(state: GameState, player: Player): number[] {
    const out: number[] = []
    for (const bomber of state.bombers) {
      if (bomber.ownerId === player.id || bomber.dropped) continue
      if (getOwner(state.map, bomber.targetTile) === player.id) out.push(bomber.targetTile)
    }
    return out
  }

  /** Lebt ein nicht-verbündeter Gegner? (lohnt überhaupt eine offensive Investition?) */
  function hasLivingEnemy(state: GameState, player: Player): boolean {
    for (const p of state.players.values()) {
      if (p.id === player.id || !p.isAlive) continue
      if (areAllied(state.alliances, player.id, p.id)) continue
      return true
    }
    return false
  }

  /** Besitzt ein nicht-verbündeter Gegner einen Flughafen? (gibt es überhaupt eine Luftbedrohung?) */
  function enemyHasAirport(state: GameState, player: Player): boolean {
    for (const b of state.buildings.values()) {
      if (b.type !== 'airport' || b.ownerId === player.id) continue
      if (areAllied(state.alliances, player.id, b.ownerId)) continue
      return true
    }
    return false
  }

  /** Eigene „wertvolle" Gebäude (Wirtschaft/Luftwaffe) — was eine Flak schützen soll. */
  function ownValuableBuildingTiles(state: GameState, player: Player): number[] {
    const out: number[] = []
    for (const [tile, b] of state.buildings) {
      if (b.ownerId !== player.id) continue
      if (b.type === 'defense' || b.type === 'flak') continue
      out.push(tile)
    }
    return out
  }

  /**
   * Bestes Tile für einen Flak-Turm: deckt mit seinem Reichweiten-Ring möglichst viele eigene
   * wertvolle Gebäude (und akut bedrohte Tiles, falls Bomber im Anflug — 3× gewichtet) ab. Hält
   * Abstand zu bestehenden Flaks, damit sich die Abdeckung verteilt. -1 wenn nichts Sinnvolles.
   */
  function pickFlakTile(state: GameState, player: Player, threatTiles: readonly number[]): number {
    const { width, height } = state.map
    const range = flakRange(1)
    const cover = ownValuableBuildingTiles(state, player)
    if (cover.length === 0 && threatTiles.length === 0) return -1

    const flaks: Array<readonly [number, number]> = []
    for (const b of state.buildings.values()) {
      if (b.type === 'flak' && b.ownerId === player.id) flaks.push(tileXY(b.tile, width))
    }
    const spacing = range * 0.8

    // Kandidaten: eigene, unbebaute Tiles im Umkreis der Schutzobjekte/Bedrohungen.
    const focus = threatTiles.length > 0 ? [...threatTiles, ...cover] : cover
    const cand = new Set<number>()
    const r = Math.max(2, Math.floor(range / 2))
    for (const f of focus) {
      const [fx, fy] = tileXY(f, width)
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const t = tileRef(fx + dx, fy + dy, width, height)
          if (getOwner(state.map, t) !== player.id) continue
          if (state.buildings.has(t)) continue
          cand.add(t)
        }
      }
    }
    if (cand.size === 0) return -1

    let best = -1
    let bestScore = -Infinity
    for (const t of cand) {
      const [tx, ty] = tileXY(t, width)
      let tooClose = false
      for (const [fx, fy] of flaks) {
        if (torusDistance(tx, ty, fx, fy, width, height) < spacing) {
          tooClose = true
          break
        }
      }
      if (tooClose) continue
      let score = 0
      for (const c of cover) {
        const [cx, cy] = tileXY(c, width)
        if (torusDistance(tx, ty, cx, cy, width, height) <= range) score += 1
      }
      for (const th of threatTiles) {
        const [hx, hy] = tileXY(th, width)
        if (torusDistance(tx, ty, hx, hy, width, height) <= range) score += 3
      }
      if (score > bestScore || (score === bestScore && (best < 0 || t < best))) {
        bestScore = score
        best = t
      }
    }
    return bestScore > 0 ? best : -1
  }

  /**
   * Ein eigenes, unbebautes Tile tief im Reich (für Flughäfen — möglichst nicht an der Grenze,
   * damit es nicht sofort miterobert wird). BFS von der Frontier nach innen; bevorzugt Tiefe ~3
   * mit vielen eigenen Nachbarn. Fallback: irgendein Frontier-Tile.
   */
  function pickInteriorTile(state: GameState, player: Player): number {
    const { width, height } = state.map
    const depth = new Map<number, number>()
    const queue: number[] = []
    for (const f of player.frontier) {
      depth.set(f, 0)
      queue.push(f)
    }
    const MAX_VISIT = 4000
    let head = 0
    let best = -1
    let bestScore = -Infinity
    while (head < queue.length && head < MAX_VISIT) {
      const cur = queue[head++]
      if (cur === undefined) break
      const d = depth.get(cur) ?? 0
      if (d >= 2 && !state.buildings.has(cur)) {
        let own = 0
        for (const n of neighbors4(cur, width, height)) {
          if (getOwner(state.map, n) === player.id) own++
        }
        const score = own - Math.abs(d - 3)
        if (score > bestScore || (score === bestScore && (best < 0 || cur < best))) {
          bestScore = score
          best = cur
        }
      }
      if (d < 5) {
        for (const n of neighbors4(cur, width, height)) {
          if (depth.has(n)) continue
          if (getOwner(state.map, n) !== player.id) continue
          depth.set(n, d + 1)
          queue.push(n)
        }
      }
    }
    return best >= 0 ? best : pickOwnTile(state, player, false)
  }

  /**
   * Tile für eine Fabrik, das sich gut ins eigene Gold-Netz einfügt: eigenes, unbebautes Tile in
   * der Nähe möglichst vieler eigener Netz-Anker (Stadt/Hafen/Fabrik). Ohne Anker → Interior-Tile.
   * (ADR-0021: Netz-Platzierung wie OpenFront — Fabrik produziert pro verbundener Stadt/Hafen.)
   */
  function pickNetworkTile(state: GameState, player: Player): number {
    const { width, height } = state.map
    const anchors: number[] = []
    for (const [tile, b] of state.buildings) {
      if (b.ownerId !== player.id) continue
      if (b.type === 'city' || b.type === 'port' || b.type === 'factory') anchors.push(tile)
    }
    if (anchors.length === 0) return pickInteriorTile(state, player)
    const r = 5
    let best = -1
    let bestScore = -Infinity
    const seen = new Set<number>()
    for (const a of anchors) {
      const [ax, ay] = tileXY(a, width)
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const t = tileRef(ax + dx, ay + dy, width, height)
          if (seen.has(t)) continue
          seen.add(t)
          if (getOwner(state.map, t) !== player.id || state.buildings.has(t)) continue
          const [tx, ty] = tileXY(t, width)
          // Score: Nähe zu mehreren Ankern (dichtes Netz) + etwas Abstand zum nächsten (Streuung).
          let near = 0
          let nearestD = Infinity
          for (const a2 of anchors) {
            const [bx, by] = tileXY(a2, width)
            const d = torusDistance(tx, ty, bx, by, width, height)
            if (d <= 12) near++
            if (d < nearestD) nearestD = d
          }
          const score = near * 2 + Math.min(nearestD, 3)
          if (score > bestScore || (score === bestScore && (best < 0 || t < best))) {
            bestScore = score
            best = t
          }
        }
      }
    }
    return best >= 0 ? best : pickInteriorTile(state, player)
  }

  /** Plant einen Bau: Luftabwehr-Notfall → Wirtschafts-Rückgrat (Städte/Ratios) → Luft/Verteidigung. */
  function planBuild(state: GameState, player: Player): Intent | null {
    const gold = player.gold
    const costOf = (t: BuildingType): number => buildCostFor(state, player.id, t)

    // 0. Akute Luftbedrohung: Bomber im Anflug → sofort Flak (vor allem anderen).
    if (
      profile.usesAirDefense &&
      isBuildingAllowed(state.config, 'flak') &&
      gold >= costOf('flak')
    ) {
      const threats = incomingBomberTargets(state, player)
      if (
        threats.length > 0 &&
        countBuildingsOfType(state, player.id, 'flak') < threats.length + 1
      ) {
        const tile = pickFlakTile(state, player, threats)
        if (tile >= 0) return { type: 'build', playerId: player.id, tile, buildingType: 'flak' }
      }
    }

    // Wirtschafts-Rückgrat (OpenFront-Stil, ADR-0021): Städte zuerst (proaktiv fürs Truppen-Cap),
    // dann Hafen/Fabrik als Ratio pro Stadt. Das ersetzt das alte „Stadt nur bei Cap-Druck".
    const cities = countBuildingsOfType(state, player.id, 'city')
    const cityTarget =
      profile.tilesPerCity > 0 && player.tilesOwned >= 40
        ? Math.floor(player.tilesOwned / profile.tilesPerCity)
        : 0
    // 1. Stadt, wenn unter Gebiets-Ziel (Rückgrat) ODER — falls Wirtschaft aus — bei Cap-Druck.
    if (isBuildingAllowed(state.config, 'city') && gold >= costOf('city')) {
      const wantCity =
        cities < cityTarget ||
        (profile.tilesPerCity === 0 && player.troops >= 0.9 * effectiveMaxTroops(state, player.id))
      if (wantCity) {
        const tile = pickInteriorTile(state, player)
        if (tile >= 0) return { type: 'build', playerId: player.id, tile, buildingType: 'city' }
      }
    }
    const base = Math.max(cities, 1) // Ratios relativ zur Stadtzahl (min 1, sobald Wirtschaft läuft)
    // 1b. Bomber-Stufen: den ERSTEN Flughafen früh bauen (sobald eine Stadt steht), bevor das Gold
    //     in den Rest der Wirtschaft fließt — sonst hungert die Luftwaffe aus (ADR-0021).
    if (
      profile.usesBombers &&
      cities >= 1 &&
      isBuildingAllowed(state.config, 'airport') &&
      countBuildingsOfType(state, player.id, 'airport') === 0 &&
      hasLivingEnemy(state, player) &&
      gold >= costOf('airport')
    ) {
      const tile = pickInteriorTile(state, player)
      if (tile >= 0) return { type: 'build', playerId: player.id, tile, buildingType: 'airport' }
    }
    // 2. Hafen ans Wasser (Ratio pro Stadt) — Handel + Kriegsschiff-Kapazität.
    if (
      isBuildingAllowed(state.config, 'port') &&
      countBuildingsOfType(state, player.id, 'port') < Math.ceil(base * PORT_PER_CITY) &&
      gold >= costOf('port')
    ) {
      const tile = pickCoastalTile(state, player)
      if (tile >= 0) return { type: 'build', playerId: player.id, tile, buildingType: 'port' }
    }
    // 3. Fabrik (Ratio pro Stadt), ans Gold-Netz platziert — produziert pro verbundener Stadt/Hafen.
    if (
      isBuildingAllowed(state.config, 'factory') &&
      cities + countBuildingsOfType(state, player.id, 'port') > 0 &&
      countBuildingsOfType(state, player.id, 'factory') < Math.ceil(base * FACTORY_PER_CITY) &&
      gold >= costOf('factory')
    ) {
      const tile = pickNetworkTile(state, player)
      if (tile >= 0) return { type: 'build', playerId: player.id, tile, buildingType: 'factory' }
    }
    // 2c. Luftabwehr-Schutz: NUR wenn ein Gegner überhaupt Luftwaffe hat (Flughafen) — sonst ist
    //     Flak vergeudetes Gold. Dann ein paar Flaks zur Deckung der Wirtschaft (Deckel ~ halbe
    //     Anzahl wertvoller Gebäude → kein Flak-Spam).
    if (
      profile.usesAirDefense &&
      isBuildingAllowed(state.config, 'flak') &&
      gold >= costOf('flak') &&
      enemyHasAirport(state, player)
    ) {
      const valuable =
        countBuildingsOfType(state, player.id, 'city') +
        countBuildingsOfType(state, player.id, 'port') +
        countBuildingsOfType(state, player.id, 'factory') +
        countBuildingsOfType(state, player.id, 'airport')
      const flakCount = countBuildingsOfType(state, player.id, 'flak')
      if (valuable >= 2 && flakCount < Math.ceil(valuable / 2)) {
        const tile = pickFlakTile(state, player, [])
        if (tile >= 0) return { type: 'build', playerId: player.id, tile, buildingType: 'flak' }
      }
    }

    // 2d. Luftwaffe: einen Flughafen (bei großem Reich zwei) bauen, wenn die KI offensiv fliegt
    //     und es Gegner gibt. Tief im Reich platzieren (Capture-Schutz).
    if (
      profile.usesBombers &&
      isBuildingAllowed(state.config, 'airport') &&
      gold >= costOf('airport')
    ) {
      const airports = countBuildingsOfType(state, player.id, 'airport')
      const airportTarget = Math.max(1, Math.ceil(base * AIRPORT_PER_CITY))
      if (airports < airportTarget && hasLivingEnemy(state, player)) {
        const tile = pickInteriorTile(state, player)
        if (tile >= 0) return { type: 'build', playerId: player.id, tile, buildingType: 'airport' }
      }
    }

    // 3. Bedrohte Front → Verteidigungsposten (hinter der Grenze, nicht drauf)
    if (isBuildingAllowed(state.config, 'defense') && gold >= costOf('defense')) {
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

    // „Im Krieg mit": die KI lehnt Bündnisse mit jemandem ab, den sie GERADE angreift oder gegen
    // den sie deutlichen Netto-Groll hat — kein Bündnis mit dem, den man überrennt.
    const atWarWith = (otherId: number): boolean => {
      for (const a of player.attacks) if (a.targetPlayerId === otherId) return true
      const grudge = state.grudge.get(directedKey(otherId, player.id)) ?? 0
      const goodwill = state.goodwill.get(directedKey(otherId, player.id)) ?? 0
      return grudge - goodwill > ALLY_REFUSE_GRUDGE
    }

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
        if (atWarWith(o.id)) continue // den, den man angreift/grollt, verbündet man nicht
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
        if (atWarWith(o.id)) continue
        if (hasAllianceRequest(state.allianceRequests, player.id, o.id)) continue
        return { type: 'request-alliance', playerId: player.id, targetPlayerId: o.id }
      }
    }
    return null
  }

  /**
   * Ein VOLL umschlossenes neutrales Tile (alle 4 Nachbarn eigen) — ein echter Bombenkrater bzw.
   * verlorenes Innen-Tile, das die normale Grenz-Expansion NICHT von selbst schließt. Extrem billig
   * zurückzuerobern (TerraNullius). Bewusst nur 4/4-Nachbarn, damit die KI nicht Tempo verliert,
   * indem sie normale Expansions-Pötte heilt statt Grenzen zu schieben. (ADR-0020 Stufe 3)
   */
  function findCraterTarget(state: GameState, player: Player): number {
    const { width, height } = state.map
    const seen = new Set<number>()
    let best = -1
    for (const ref of player.frontier) {
      for (const n of neighbors4(ref, width, height)) {
        if (seen.has(n)) continue
        seen.add(n)
        if (getOwner(state.map, n) !== 0) continue
        let own = 0
        for (const m of neighbors4(n, width, height)) {
          if (getOwner(state.map, m) === player.id) own++
        }
        if (own === 4 && (best < 0 || n < best)) best = n
      }
    }
    return best
  }

  function planMilitary(state: GameState, player: Player): Intent | null {
    const max = effectiveMaxTroops(state, player.id)
    const popRatio = max > 0 ? player.troops / max : 0
    const preferEnemies = popRatio >= profile.popThresholdForPvp

    // Bombenkrater / neutrale Innen-Löcher zuerst heilen (billig, schließt die eigene Fläche).
    if (profile.healsCraters) {
      const crater = findCraterTarget(state, player)
      if (crater >= 0) {
        const troops = Math.floor((player.troops * profile.attackPct) / 100)
        if (troops > 0) return { type: 'attack', playerId: player.id, targetTile: crater, troops }
      }
    }

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
    // Kapazität = Summe der Hafen-Level (wie beim Menschen), nicht mehr ein globales Limit.
    if (active >= warshipCapacity(state, player.id)) return null
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

  /**
   * Startet einen Bomber auf das wertvollste erreichbare Feind-Infrastruktur-Ziel. Bewertet
   * Gebäude-Wert + Groll, wählt die flak-ärmste der drei Routen (direct/arc-left/arc-right) und
   * überspringt Ziele, die der Bomber wegen Flak nicht überlebt (Schaden ≥ BOMBER_HP). Verbündete
   * und starke Gunst-Partner werden verschont. (ADR-0020 Stufe 2)
   */
  function planBomber(state: GameState, player: Player): Intent | null {
    if (!profile.usesBombers) return null
    if (!isBuildingAllowed(state.config, 'airport')) return null
    const info = bomberLaunchInfo(state, player.id)
    if (!info.available || player.gold < info.cost) return null
    const { width, height } = state.map

    // Bombenwert je Gebäudetyp (Flughafen/Flak hoch → bricht die feindliche Luftmacht).
    const bombValue = (t: BuildingType): number => {
      switch (t) {
        case 'airport':
          return 6
        case 'flak':
          return 5
        case 'factory':
          return 4
        case 'city':
          return 3
        case 'port':
          return 2
        case 'defense':
          return 1
      }
    }

    // Nächster eigener fertiger Flughafen zu einem Ziel (für Routen-/Flak-Schätzung).
    const nearestAirport = (target: number): number => {
      const tx = target % width
      const ty = Math.floor(target / width)
      let best = -1
      let bestD = Infinity
      for (const b of state.buildings.values()) {
        if (b.type !== 'airport' || b.ownerId !== player.id || !isBuildingComplete(b, state.tick))
          continue
        const d = torusDistance(tx, ty, b.tile % width, Math.floor(b.tile / width), width, height)
        if (d < bestD) {
          bestD = d
          best = b.tile
        }
      }
      return best
    }

    const routes: BomberRoute[] = ['direct', 'arc-left', 'arc-right']
    let bestTarget = -1
    let bestRoute: BomberRoute = 'direct'
    let bestScore = -Infinity
    for (const [tile, b] of state.buildings) {
      const owner = b.ownerId
      if (owner === player.id || owner <= 0) continue
      if (areAllied(state.alliances, player.id, owner)) continue
      const grudge = state.grudge.get(directedKey(owner, player.id)) ?? 0
      const goodwill = state.goodwill.get(directedKey(owner, player.id)) ?? 0
      if (goodwill - grudge > FRIEND_SPARE_THRESHOLD) continue // Gunst-Partner verschonen
      const airport = nearestAirport(tile)
      if (airport < 0) continue
      let routeDmg = Infinity
      let route: BomberRoute = 'direct'
      for (const r of routes) {
        const path = planBomberRoute(width, height, airport, tile, r)
        const dmg = estimateBomberFlakDamage(state, player.id, path)
        if (dmg < routeDmg) {
          routeDmg = dmg
          route = r
        }
      }
      if (routeDmg >= BOMBER_HP) continue // würde abgeschossen → Ziel überspringen
      // Annektieren-vs-zerstören: stärkere Gegner (kann man nicht überrennen) bevorzugt bomben;
      // schwache nimmt man lieber per Bodenangriff ein, statt Bomben zu verschwenden.
      const ep = state.players.get(owner)
      const strength = ep !== undefined ? ep.troops / Math.max(1, player.troops) : 1
      const strengthBonus = Math.min(2, Math.max(0, strength - 1)) * 2
      const score = bombValue(b.type) + Math.min(grudge / 30, 5) + strengthBonus - routeDmg
      if (score > bestScore || (score === bestScore && (bestTarget < 0 || tile < bestTarget))) {
        bestScore = score
        bestTarget = tile
        bestRoute = route
      }
    }
    if (bestTarget < 0) return null
    return { type: 'launch-bomber', playerId: player.id, targetTile: bestTarget, route: bestRoute }
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

      // Gelegentlich einen Bomber auf Feind-Infrastruktur werfen (Gold offensiv nutzen).
      if (rng.next() < profile.bomberChance) {
        const bomber = planBomber(state, player)
        if (bomber !== null) intents.push(bomber)
      }

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
