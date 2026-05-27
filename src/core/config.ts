/**
 * Konstanten und Formeln für die Game-Mechanik.
 *
 * Alle Formeln nach OpenFront-Vorbild übernommen (siehe ADR-0004 und
 * Memory `openfront-mechanics-notes`).
 *
 * **Implementierungs-Hinweis:** Werte sind als `number`, nicht `bigint`. Auch
 * bei extremen Map-Größen (≥10M Tiles) bleiben alle Truppen-Zahlen weit unter
 * `Number.MAX_SAFE_INTEGER`. Native `Math.pow` ist deutlich performanter als
 * bigint-Math. Falls zukünftige Map-Größen oder Skill-Multiplier das ändern,
 * wechseln wir punktuell zu bigint.
 */

/** Start-Truppen für menschliche Spieler. */
export const HUMAN_START_TROOPS = 25_000

/** Start-Truppen für Bot-/KI-Spieler. */
export const BOT_START_TROOPS = 10_000

/** Default Slider-Prozentwert für Angriffe (Mensch). */
export const HUMAN_DEFAULT_ATTACK_PCT = 20

/** Default Slider-Prozentwert für Bot-Angriffe. */
export const BOT_DEFAULT_ATTACK_PCT = 5

/**
 * Terrain-Magnitude — bestimmt Verlust- und Geschwindigkeits-Faktoren beim Kampf.
 * Im MVP gibt es nur Plains (alle Tiles sind Land). Werte aus OpenFront.
 */
export const PLAINS_MAG = 80

/**
 * Maximaler Truppen-Cap eines Spielers, abhängig von der Anzahl seiner Tiles.
 *
 * Formel:
 *   `2 * (numTiles^0.6 * 1000 + 50000) + sum(cityLevel) * 250000`
 *
 * City-Term ist im MVP immer 0 (keine Cities). Sublinearer Tile-Exponent (0.6)
 * bremst Snowball-Sieger.
 *
 * Bei `bot: true` wird der Cap durch 3 geteilt (OpenFront-Konvention).
 */
export function maxTroops(numTilesOwned: number, opts: { readonly bot?: boolean } = {}): number {
  if (numTilesOwned < 0) {
    throw new RangeError(`numTilesOwned must be >= 0, got ${numTilesOwned}`)
  }
  const base = 2 * (Math.pow(numTilesOwned, 0.6) * 1000 + 50_000)
  const value = opts.bot === true ? base / 3 : base
  return Math.floor(value)
}

/**
 * Wachstumsrate der Truppen pro Sim-Tick.
 *
 * Formel:
 *   `toAdd = 10 + troops^0.73 / 4`
 *   `ratio = 1 - troops / max`
 *   `rate  = toAdd * ratio`
 *
 * Logistisch-ähnlich: Power-Law-Wachstum, durch `ratio` gegen den Cap gebremst.
 * Mathematisches Wachstums-Optimum liegt bei ungefähr 42% des Caps.
 *
 * Bei `bot: true` wird `toAdd` zusätzlich halbiert.
 *
 * Wenn `troops >= max` oder `max == 0`, ist die Rate 0 (kein negatives Wachstum).
 */
export function troopIncreaseRate(
  troops: number,
  max: number,
  opts: { readonly bot?: boolean } = {},
): number {
  if (troops < 0) throw new RangeError(`troops must be >= 0, got ${troops}`)
  if (max < 0) throw new RangeError(`max must be >= 0, got ${max}`)
  if (max === 0) return 0
  if (troops >= max) return 0

  let toAdd = 10 + Math.pow(troops, 0.73) / 4
  if (opts.bot === true) toAdd *= 0.5
  const ratio = 1 - troops / max
  return Math.floor(toAdd * ratio)
}

/**
 * Anzahl Tiles die ein Angriff pro Tick erobern darf (kann fractional sein).
 *
 * OpenFront-Formel:
 *   `clamp(5 * attackTroops / defenderTroops * 2, 0.01, 0.5) * frontWidth * 3`
 *   Gegen TerraNullius: `frontWidth * 2` (kein Truppen-Vergleich)
 *
 * `frontWidth` ist die Anzahl der Frontier-Tiles des Angreifers, die an mindestens
 * ein Ziel-Tile angrenzen.
 *
 * Die zurückgegebene Rate kann fraktional sein — der Aufrufer ist für die
 * deterministische Integer-Konvertierung verantwortlich (z.B. `Math.floor` + PRNG-Bonus).
 */
export function tilesPerTick(
  attackTroops: number,
  defenderTroops: number,
  frontWidth: number,
  vsTerraNullius: boolean,
): number {
  if (frontWidth <= 0) return 0
  if (vsTerraNullius) return frontWidth * 2
  // Bei defenderTroops==0 gibt JS Infinity → wird durch clamp auf 0.5 begrenzt
  const raw = (10 * attackTroops) / defenderTroops
  const clamped = Math.max(0.01, Math.min(0.5, raw))
  return clamped * frontWidth * 3
}

/**
 * Truppen-Verlust des Angreifers pro eroberten Tile.
 *
 * OpenFront-Formel (vereinfacht für MVP: nur Plains, keine Cities/DefensePosts,
 * keine Anti-Zerg-Debuffs):
 *
 *   Gegen TerraNullius: `attackerLoss = mag / 5 = 16`
 *
 *   Gegen Spieler:
 *     `currentLoss = clamp(def.troops/att.troops, 0.6, 2) * mag * 0.8`
 *     `altLoss     = 1.3 * (def.troops/def.tilesOwned) * (mag/100)`
 *     `attackerLoss = 0.6 * currentLoss + 0.4 * altLoss`
 *
 * `mag = 80` für Plains.
 */
export function attackerLossPerTile(
  attackTroops: number,
  defenderTroops: number,
  defenderTilesOwned: number,
  vsTerraNullius: boolean,
): number {
  const mag = PLAINS_MAG
  if (vsTerraNullius) return mag / 5

  const safeAttack = attackTroops > 0 ? attackTroops : 1
  const safeTiles = defenderTilesOwned > 0 ? defenderTilesOwned : 1
  const ratio = Math.max(0.6, Math.min(2, defenderTroops / safeAttack))
  const currentLoss = ratio * mag * 0.8
  const altLoss = 1.3 * (defenderTroops / safeTiles) * (mag / 100)
  return 0.6 * currentLoss + 0.4 * altLoss
}

/**
 * Truppen-Verlust des Verteidigers pro verlorenes Tile.
 *
 * OpenFront: `defenderLoss = defender.troops / defender.tilesOwned` —
 * exakt der Durchschnitts-Truppen-Bestand pro Tile.
 *
 * Gegen TerraNullius: keiner verliert etwas (oldOwner ist neutral).
 */
export function defenderLossPerTile(
  defenderTroops: number,
  defenderTilesOwned: number,
  vsTerraNullius: boolean,
): number {
  if (vsTerraNullius) return 0
  if (defenderTilesOwned <= 0) return 0
  return defenderTroops / defenderTilesOwned
}
