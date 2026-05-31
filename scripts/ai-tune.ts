/**
 * Tuner-Runner (ADR-0021) — `npm run ai-tune`.
 *
 * (μ+λ)-Evolutions-Strategie über die such-baren Profil-Parameter (ParamVector). Ein Kandidat spielt
 * in der Arena gegen eine feste Baseline (Fortgeschritten); seine Stärke misst der Komposit-Score
 * (Sieg + Wachstum + Economy, Anteil am Match-Gesamt). Die Suche behält die Gewinner und mutiert
 * weiter. Ergebnis: das stärkste Profil (= Experte-Optimum), aus dem die schwächeren Stufen
 * abgeleitet werden.
 *
 * Flags: --gens N (Default 24) --lambda N (8) --mu N (3) --seeds N (12) --ticks N (2500)
 *        --map N (80) --baseline X (advanced) --out PATH (/tmp/ai-tune-best.json)
 *
 * Kein Machine-Learning — Hyperparameter-Suche über die Heuristik-Gewichte.
 */

import { runMatch } from '../src/ai/arena'
import { PROFILES, type Difficulty } from '../src/ai/ai'
import {
  clampParams,
  compositeFitness,
  mulberry32,
  mutateParams,
  paramsToProfile,
  profileToParams,
  type ParamVector,
} from '../src/ai/tune'

const num = (name: string, def: number): number => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return def
  const v = Number(process.argv[i + 1])
  return Number.isFinite(v) ? v : def
}
const str = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] !== undefined ? (process.argv[i + 1] as string) : def
}

const GENS = num('gens', 24)
const LAMBDA = num('lambda', 8)
const MU = num('mu', 3)
const SEEDS = num('seeds', 12)
const TICKS = num('ticks', 2500)
const MAP = num('map', 80)
const BASELINE = str('baseline', 'advanced') as Difficulty
const OUT = str('out', '/tmp/ai-tune-best.json')

// Roster: 3 Kandidaten (IDs 1-3, per Override) gegen 3 Baseline-Nationen.
const roster: Difficulty[] = ['expert', 'expert', 'expert', BASELINE, BASELINE, BASELINE]
const candIds = new Set([1, 2, 3])
const baseProfile = PROFILES.expert // liefert die Fähigkeits-Flags (alle an)

function evaluate(cand: ParamVector, gen: number): number {
  const prof = paramsToProfile(cand, baseProfile)
  const overrides = [prof, prof, prof, null, null, null]
  let sum = 0
  for (let s = 0; s < SEEDS; s++) {
    const r = runMatch({
      roster,
      seed: `tune-g${String(gen)}-s${String(s)}`,
      mapWidth: MAP,
      mapHeight: MAP,
      maxTicks: TICKS,
      terrain: 'continents',
      profileOverrides: overrides,
    })
    sum += compositeFitness(r, candIds)
  }
  return sum / SEEDS
}

const rng = mulberry32(0x5eed)
const sigmaAt = (gen: number): number => 0.18 - (0.14 * gen) / Math.max(1, GENS) // 0.18 → 0.04

/* eslint-disable no-console */
const t0 = Date.now()
console.log(
  `TUNER — ${String(GENS)} Gen × ${String(LAMBDA)} Kandidaten · ${String(SEEDS)} Seeds · Map ${String(MAP)}² · ${String(TICKS)} Ticks · Baseline ${BASELINE}`,
)
console.log(`Komposit-Fitness: 0.5·Sieg + 0.3·Wachstum + 0.2·Economy (Anteil am Match-Gesamt)`)

interface Scored {
  p: ParamVector
  f: number
}
const top = (pool: Scored[]): Scored =>
  pool[0] ?? { p: clampParams(profileToParams(PROFILES.expert)), f: 0 }

// Start: aktuelles Experte-Profil als Eltern-Saat.
const seed0: Scored = { p: clampParams(profileToParams(PROFILES.expert)), f: 0 }
seed0.f = evaluate(seed0.p, 0)
let parents: Scored[] = [seed0]
console.log(`Start (aktuelles Experte): Fitness ${seed0.f.toFixed(4)}`)

let best: Scored = seed0
for (let gen = 1; gen <= GENS; gen++) {
  const sigma = sigmaAt(gen)
  const offspring: Scored[] = []
  for (let i = 0; i < LAMBDA; i++) {
    const parent = parents[Math.floor(rng() * parents.length)] ?? seed0
    const child = mutateParams(parent.p, sigma, rng)
    offspring.push({ p: child, f: evaluate(child, gen) })
  }
  // (μ+λ): Eltern + Nachkommen frisch im Pool, Top-μ überleben.
  const pool: Scored[] = [...parents.map((x) => ({ p: x.p, f: evaluate(x.p, gen) })), ...offspring]
  pool.sort((a, b) => b.f - a.f)
  parents = pool.slice(0, MU)
  const genBest = top(parents)
  if (genBest.f > best.f) best = genBest
  console.log(
    `Gen ${String(gen).padStart(2)}/${String(GENS)}  σ=${sigma.toFixed(3)}  beste=${genBest.f.toFixed(4)}  (all-time ${best.f.toFixed(4)})`,
  )
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
console.log(`\nFertig in ${elapsed}s. Bestes Profil (Fitness ${best.f.toFixed(4)}):`)
const bp = clampParams(best.p)
console.log(JSON.stringify(bp, null, 2))

import { writeFileSync } from 'node:fs'
writeFileSync(OUT, JSON.stringify({ fitness: best.f, params: bp }, null, 2))
console.log(`\nGespeichert: ${OUT}`)
