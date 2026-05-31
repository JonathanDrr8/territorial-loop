/**
 * Tuner-Kern (ADR-0021): such-bare Profil-Parameter + Komposit-Fitness für die Evolutions-Suche.
 *
 * Idee (Jonathans Wunsch „Gewichtungen, die ins Training eingehen"): Ein Kandidaten-Profil wird in
 * der Arena gegen eine feste Baseline gespielt; seine Stärke misst ein **Komposit-Score** aus drei
 * Achsen — Sieg/Territorium, Wachstum (Truppen) und Economy (Gold) — jeweils als ANTEIL am
 * Match-Gesamt (also „wie sehr dominiert der Kandidat das Feld"). Eine schlanke (μ+λ)-Evolutions-
 * Strategie (im Runner `scripts/ai-tune.ts`) mutiert die Parameter und behält die Gewinner.
 *
 * Das ist KEIN Machine-Learning im KI-Sinn — die KI lernt nichts. Es ist Hyperparameter-Suche über
 * die Heuristik-Gewichte (Standard-Verfahren, vgl. CMA-ES/Evolution Strategies). Reine Funktionen,
 * deterministisch testbar.
 */

import type { DifficultyProfile } from './ai'
import type { MatchResult } from './arena'

/** Such-barer Teil eines Profils (kontinuierliche Knöpfe). Fähigkeits-Flags bleiben fix. */
export interface ParamVector {
  attackPct: number
  cooldownMin: number
  cooldownMax: number
  popThresholdForPvp: number
  buildChance: number
  boatChance: number
  warshipChance: number
  bomberChance: number
  tilesPerCity: number
}

/** Sinnvolle Grenzen je Parameter (lo, hi) — die Suche bleibt im spielbaren Bereich. */
export const BOUNDS: Record<keyof ParamVector, readonly [number, number]> = {
  attackPct: [10, 55],
  cooldownMin: [4, 45],
  cooldownMax: [12, 130],
  popThresholdForPvp: [0.3, 0.9],
  buildChance: [0.05, 0.85],
  boatChance: [0, 0.4],
  warshipChance: [0, 0.3],
  bomberChance: [0, 0.4],
  tilesPerCity: [55, 260],
}

/** Komposit-Gewichte (Jonathan: Sieg + Economy + Wachstum). Summe 1. Bewusst sieg-lastig. */
export const FITNESS_WEIGHTS = { win: 0.5, growth: 0.3, economy: 0.2 } as const

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** Hält einen Vektor in den Grenzen und erzwingt cooldownMax > cooldownMin. */
export function clampParams(p: ParamVector): ParamVector {
  const c = { ...p }
  for (const k of Object.keys(BOUNDS) as (keyof ParamVector)[]) {
    const [lo, hi] = BOUNDS[k]
    c[k] = clamp(c[k], lo, hi)
  }
  c.cooldownMin = Math.round(c.cooldownMin)
  c.cooldownMax = Math.max(Math.round(c.cooldownMax), c.cooldownMin + 5)
  c.tilesPerCity = Math.round(c.tilesPerCity)
  return c
}

/** Liest die such-baren Felder aus einem vollen Profil. */
export function profileToParams(p: DifficultyProfile): ParamVector {
  return {
    attackPct: p.attackPct,
    cooldownMin: p.cooldownMin,
    cooldownMax: p.cooldownMax,
    popThresholdForPvp: p.popThresholdForPvp,
    buildChance: p.buildChance,
    boatChance: p.boatChance,
    warshipChance: p.warshipChance,
    bomberChance: p.bomberChance,
    tilesPerCity: p.tilesPerCity,
  }
}

/** Baut aus einem Vektor + Basis-Profil (für die Fähigkeits-Flags) ein vollständiges Profil. */
export function paramsToProfile(p: ParamVector, base: DifficultyProfile): DifficultyProfile {
  const c = clampParams(p)
  return { ...base, ...c }
}

/**
 * Komposit-Fitness des Kandidaten aus einem Match: gewichteter Anteil an Territorium (Sieg),
 * Truppen (Wachstum) und Gold (Economy) — gemittelt über die Kandidaten-Nationen. 0..1, höher
 * = dominanter. `candidateIds` = Spieler-IDs der Kandidaten-Nationen.
 */
export function compositeFitness(result: MatchResult, candidateIds: ReadonlySet<number>): number {
  let totTiles = 0
  let totTroops = 0
  let totGold = 0
  let candTiles = 0
  let candTroops = 0
  let candGold = 0
  let candCount = 0
  for (const p of result.players) {
    totTiles += p.tilesOwned
    totTroops += p.troops
    totGold += p.gold
    if (candidateIds.has(p.id)) {
      candTiles += p.tilesOwned
      candTroops += p.troops
      candGold += p.gold
      candCount++
    }
  }
  if (candCount === 0) return 0
  // Anteil am Gesamt, normiert auf „fairen Anteil" (1 = Kandidat hält alles).
  const tileShare = totTiles > 0 ? candTiles / totTiles : 0
  const troopShare = totTroops > 0 ? candTroops / totTroops : 0
  const goldShare = totGold > 0 ? candGold / totGold : 0
  return (
    FITNESS_WEIGHTS.win * tileShare +
    FITNESS_WEIGHTS.growth * troopShare +
    FITNESS_WEIGHTS.economy * goldShare
  )
}

/** Kleiner deterministischer PRNG (mulberry32) — fürs reproduzierbare Mutieren (offline, nicht Sim). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standardnormal-Sample (Box-Muller) aus einer uniformen Quelle. */
export function randn(rng: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/**
 * Mutiert einen Vektor: jede Dimension + Gauss-Rauschen, skaliert mit `sigma` (Anteil der
 * Dimensions-Spannweite). Ergebnis ist geclamped.
 */
export function mutateParams(p: ParamVector, sigma: number, rng: () => number): ParamVector {
  const c = { ...p }
  for (const k of Object.keys(BOUNDS) as (keyof ParamVector)[]) {
    const [lo, hi] = BOUNDS[k]
    c[k] = c[k] + randn(rng) * sigma * (hi - lo)
  }
  return clampParams(c)
}
