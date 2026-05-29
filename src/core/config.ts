/**
 * Konstanten und Formeln für die Game-Mechanik.
 *
 * Alle Formeln nach OpenFront-Vorbild übernommen (siehe ADR-0004 und
 * Memory `openfront-mechanics-notes`).
 *
 * **Implementierungs-Hinweis:** Werte sind als `number`, nicht `bigint`. Auch
 * bei extremen Map-Größen (≥10M Tiles) bleiben alle Truppen-Zahlen weit unter
 * `Number.MAX_SAFE_INTEGER`. Falls zukünftige Map-Größen oder Skill-Multiplier das
 * ändern, wechseln wir punktuell zu bigint.
 *
 * **Determinismus:** Potenzen über `detPow` statt `Math.pow` — `Math.pow` ist über
 * JS-Engines nicht bit-genau, und Cap/Wachstum fließen jeden Tick in den State (ADR-0009).
 */

import { detPow } from './det-math'

/** Start-Truppen für menschliche Spieler (klein → längere, spürbare Wachstumskurve). */
export const HUMAN_START_TROOPS = 2_500

/** Start-Truppen für Bot-/„Barbaren"-Spieler. */
export const BOT_START_TROOPS = 1_000

/** Default Slider-Prozentwert für Angriffe (Mensch). */
export const HUMAN_DEFAULT_ATTACK_PCT = 20

/** Default Slider-Prozentwert für Bot-Angriffe. */
export const BOT_DEFAULT_ATTACK_PCT = 5

/**
 * Dauer (Sim-Ticks) für das sanfte Zurückziehen eines abgebrochenen Angriffs. Statt die
 * Reserve sofort zurückzugeben, fließt sie über diese Spanne zurück (~2.5 s bei 10 Ticks/s,
 * `SIM_BASE_INTERVAL_MS = 100` in main.ts). Verhindert Sofort-Abbruch-Abuse und fühlt sich
 * wie ein echter Rückzug an. Ein zweiter Abbruch-Klick beendet sofort.
 */
export const ATTACK_CANCEL_TICKS = 25

/**
 * Flaches Gold-Einkommen pro Tick und lebendem Spieler — unabhängig von der
 * Gebietsgröße (bewusster Balance-Trade-off: kleine Nationen sind Gold-effizient
 * pro Fläche). Eco-Gebäude und Handelsschiffe kommen additiv obendrauf.
 */
export const BASE_GOLD_PER_TICK = 100

/**
 * Fabrik-Netzwerk-Wirtschaft (kein Gold-Wachstum mit Gebietsgröße!). Eine Fabrik
 * verbindet sich per Luftlinie (Torus-Distanz ≤ `FACTORY_LINK_RANGE`) transitiv mit
 * eigenen Städten/Häfen/Fabriken zu einem Cluster und produziert pro Tick
 * `FACTORY_GOLD_PER_DEST` Gold je verbundener Stadt/Hafen im Cluster (× Fabrik-Level).
 * Eine isolierte Fabrik (keine verbundenen Ziele) bringt nichts — man muss vernetzen.
 * Startwerte, per Playtest tunbar.
 */
export const FACTORY_LINK_RANGE = 40
export const FACTORY_GOLD_PER_DEST = 6

/**
 * Terrain-Magnitude — bestimmt Verlust- und Geschwindigkeits-Faktoren beim Kampf.
 * Im MVP gibt es nur Plains (alle Tiles sind Land). Werte aus OpenFront.
 */
export const PLAINS_MAG = 80

/** Cap-Sockel (≈ Cap eines winzigen Spawns) und Beitrag pro Tile^0.6. */
export const MAX_TROOPS_BASE = 4_000
export const MAX_TROOPS_PER_TILE = 950
/** Cap-Faktor für Bots/„Barbaren" (etwas niedriger als beim Menschen). */
export const BOT_CAP_FACTOR = 0.8

/**
 * Maximaler Truppen-Cap, abhängig von der (terrain-gewichteten) Tile-Anzahl.
 *
 * Formel: `MAX_TROOPS_BASE + numTiles^0.6 * MAX_TROOPS_PER_TILE`.
 * Bewusst kleiner Sockel → ein frisches 5×5-Spawn (gewichtet ~37) ergibt ~12.500;
 * der Cap wächst dann spürbar mit eroberten Tiles (sublinear, ^0.6, bremst Snowball).
 * Bei `bot: true` wird der Cap mit `BOT_CAP_FACTOR` skaliert (~10.000 am Spawn).
 */
export function maxTroops(numTilesOwned: number, opts: { readonly bot?: boolean } = {}): number {
  if (numTilesOwned < 0) {
    throw new RangeError(`numTilesOwned must be >= 0, got ${numTilesOwned}`)
  }
  const raw = MAX_TROOPS_BASE + detPow(numTilesOwned, 0.6) * MAX_TROOPS_PER_TILE
  const value = opts.bot === true ? raw * BOT_CAP_FACTOR : raw
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
 * Wenn `troops == max` oder `max == 0`, ist die Rate 0. **Über** dem Cap (z.B.
 * nachdem eine Nation Gebiet — und damit Cap — verloren hat) ist die Rate negativ:
 * der Überschuss schmilzt langsam ab (`OVER_CAP_DECAY`), damit eine dezimierte
 * Nation nicht dauerhaft auf einem riesigen Truppenberg sitzt.
 */
export const OVER_CAP_DECAY = 0.03

export function troopIncreaseRate(
  troops: number,
  max: number,
  opts: { readonly bot?: boolean } = {},
): number {
  if (troops < 0) throw new RangeError(`troops must be >= 0, got ${troops}`)
  if (max < 0) throw new RangeError(`max must be >= 0, got ${max}`)
  if (max === 0) return 0
  if (troops > max) return -Math.ceil((troops - max) * OVER_CAP_DECAY)
  if (troops === max) return 0

  // Sowohl Produktivität (toAdd) als auch Cap-Bremse (ratio) beziehen sich auf
  // dieselbe Größe `troops`. Der Aufrufer entscheidet, welche Bevölkerung das ist —
  // für Wachstum: die FREIE Bevölkerung gegen ihren freien Cap-Platz (siehe
  // growPopulations), damit gebundene Angriffstruppen das Wachstum nicht verzerren.
  let toAdd = 10 + detPow(troops, 0.73) / 4
  if (opts.bot === true) toAdd *= 0.5
  const ratio = 1 - troops / max
  return Math.floor(toAdd * ratio)
}

/**
 * Charakterisiert die Wachstumskurve für einen gegebenen Cap als zwei Marken
 * (Anteile des Caps `0..1`), für die HUD-Visualisierung der Truppen-Effizienz:
 *  - `optimum`: wo die absolute Wachstumsrate maximal ist (Peak der Kurve, ~42%).
 *    Links davon wächst man immer besser → „wachsend"; rechts wird es zunehmend
 *    weniger → ab hier „stagnierend".
 *  - `stall`: ab hier ist die Rate auf ein Drittel des Peaks gefallen →
 *    „stark stagnierend".
 *
 * Per Sampling der `troopIncreaseRate`-Kurve ermittelt (cap-abhängig, da der
 * `toAdd`-Term von der absoluten Truppenzahl abhängt). Reine Anzeige-Hilfe,
 * keine Sim-Logik.
 */
export function growthZones(cap: number): { readonly optimum: number; readonly stall: number } {
  if (cap <= 0) return { optimum: 0, stall: 1 }
  const SAMPLES = 100
  const rateAt = (frac: number): number => troopIncreaseRate(Math.floor(frac * cap), cap)
  let optimum = 0
  let peakRate = 0
  for (let s = 1; s <= SAMPLES; s++) {
    const frac = s / SAMPLES
    const rate = rateAt(frac)
    if (rate > peakRate) {
      peakRate = rate
      optimum = frac
    }
  }
  if (peakRate <= 0) return { optimum: 0, stall: 1 }
  let stall = 1
  for (let s = 1; s <= SAMPLES; s++) {
    const frac = s / SAMPLES
    if (frac <= optimum) continue
    if (rateAt(frac) <= peakRate / 3) {
      stall = frac
      break
    }
  }
  return { optimum, stall }
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
/**
 * Maximales Angriff:Verteidigung-Verhältnis für die Eroberungs-Geschwindigkeit.
 * Ab 2:1 Übermacht wird man NICHT schneller — so bleibt Verteidigung (und damit
 * Verteidigungsposten) relevant, statt von purer Truppenzahl überrollt zu werden.
 */
export const MAX_ATTACK_RATIO = 2
/** Eroberungs-Rate pro Front-Tile bei voller (2:1+) Übermacht. */
const PLAYER_RATE_AT_CAP = 1.5

export function tilesPerTick(
  attackTroops: number,
  defenderTroops: number,
  frontWidth: number,
  vsTerraNullius: boolean,
): number {
  if (frontWidth <= 0) return 0
  if (vsTerraNullius) return frontWidth * 1.5
  // Geschwindigkeit skaliert mit dem Angriff:Verteidigung-Verhältnis, gedeckelt bei
  // MAX_ATTACK_RATIO (2:1). Unverteidigt (def==0) gilt als volle Übermacht.
  const ratio = defenderTroops > 0 ? attackTroops / defenderTroops : MAX_ATTACK_RATIO
  // Unterlegene Angriffe kriechen nur noch sehr langsam (Minimum 0.02 statt 0.05),
  // damit sich kleine Angriffe nicht mehr so leicht in große Nationen reinarbeiten.
  const factor = Math.max(0.02, Math.min(1, ratio / MAX_ATTACK_RATIO))
  return factor * frontWidth * PLAYER_RATE_AT_CAP
}

/**
 * Faktor, mit dem die Eroberung pro Tile auf die Verteidigungsdichte kalibriert ist.
 * Bei `CONQUEST_COST_FACTOR = 2` kostet die komplette Einnahme eines Landes (auf
 * Ebene, ohne Verteidigungsposten) genau `2 × Verteidiger-Truppen` — also reicht
 * 2:1-Übermacht exakt aus. Da der Verteidiger pro verlorenem Tile seine Pro-Tile-
 * Truppen verliert ([[defenderLossPerTile]]), bleibt die Dichte dabei konstant.
 */
export const CONQUEST_COST_FACTOR = 2

/**
 * Truppen-Verlust des Angreifers pro eroberten Tile.
 *
 *   Gegen TerraNullius: `attackerLoss = mag / 5` (16 bei Plains).
 *
 *   Gegen Spieler: `CONQUEST_COST_FACTOR × Verteidigungsdichte × (mag/PLAINS_MAG)`,
 *   wobei Verteidigungsdichte = `def.troops / def.tilesOwned`. So hängen die Kosten
 *   nur an der lokalen Verteidigungsstärke und am Terrain — nicht am Angreifer. Die
 *   Reserve bestimmt damit, wie viel Land man nimmt: 2:1 → alles, 1:1 → etwa die
 *   Hälfte (auf Ebene, ohne Verteidigungsposten).
 *
 * `mag` kommt aus dem Terrain des Ziel-Tiles (Ebene 80 / Hügel 100 / Berg 120),
 * multipliziert durch Verteidigungsposten. Default `PLAINS_MAG`.
 */
export function attackerLossPerTile(
  defenderTroops: number,
  defenderTilesOwned: number,
  vsTerraNullius: boolean,
  mag: number = PLAINS_MAG,
): number {
  if (vsTerraNullius) return mag / 5
  const safeTiles = defenderTilesOwned > 0 ? defenderTilesOwned : 1
  const density = defenderTroops / safeTiles
  return CONQUEST_COST_FACTOR * density * (mag / PLAINS_MAG)
}

/**
 * Truppen-Verlust des Verteidigers pro verlorenem Tile = seine Pro-Tile-Truppenzahl
 * (`troops / tilesOwned`). Konzeptionell: das verlorene Land nimmt seine Bevölkerung
 * mit. Dadurch sinken Truppen und Tiles proportional → die Verteidigungsdichte bleibt
 * konstant, womit 2:1-Übermacht exakt für die komplette Einnahme reicht.
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
