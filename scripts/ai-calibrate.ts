/**
 * Eichung der kontinuierlichen KI-Stärke (ADR-0022) — `npm run ai-calibrate`.
 *
 * Lässt N Stärke-Stufen (s ∈ [0,1]) in der Arena gegeneinander laufen und misst per paarweisem
 * ELO, welche Spielstärke jedes `s` hat. Die Updates sind nullsummen → der Mittelwert bleibt ~1000,
 * die Stufen spreizen sich darum. Ergebnis: die `STRENGTH_ELO`-Stützpunkte für `src/ai/strength.ts`.
 *
 * Flags: --seeds N (40) --ticks N (3000) --map N (96) --levels N (9)
 */

import { runMatch } from '../src/ai/arena'
import type { Difficulty } from '../src/ai/ai'
import { profileForStrength } from '../src/ai/strength'

const num = (name: string, def: number): number => {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return def
  const v = Number(process.argv[i + 1])
  return Number.isFinite(v) ? v : def
}
const SEEDS = num('seeds', 40)
const TICKS = num('ticks', 3000)
const MAP = num('map', 96)
const NLEVELS = num('levels', 9)

const levels: number[] = Array.from({ length: NLEVELS }, (_, i) => i / (NLEVELS - 1))
const roster: Difficulty[] = levels.map(() => 'expert')
const overrides = levels.map((s) => profileForStrength(s))

// Paarweise Siege (Tiles-Vergleich) zwischen Stufen-Indizes sammeln.
const wins: number[][] = levels.map(() => levels.map(() => 0))
const games: number[][] = levels.map(() => levels.map(() => 0))

/* eslint-disable no-console */
const t0 = Date.now()
for (let s = 0; s < SEEDS; s++) {
  const r = runMatch({
    roster,
    seed: `calib-s${String(s)}`,
    mapWidth: MAP,
    mapHeight: MAP,
    maxTicks: TICKS,
    terrain: 'continents',
    profileOverrides: overrides,
  })
  const byId = new Map(r.players.map((p) => [p.id, p.tilesOwned]))
  for (let i = 0; i < levels.length; i++) {
    for (let j = i + 1; j < levels.length; j++) {
      const ti = byId.get(i + 1) ?? 0
      const tj = byId.get(j + 1) ?? 0
      games[i][j]++
      games[j][i]++
      if (ti > tj) wins[i][j]++
      else if (tj > ti) wins[j][i]++
      else {
        wins[i][j] += 0.5
        wins[j][i] += 0.5
      }
    }
  }
}

// Iteratives ELO (nullsummen → Mittel ~1000).
const elo = levels.map(() => 1000)
for (let it = 0; it < 3000; it++) {
  for (let i = 0; i < levels.length; i++) {
    for (let j = 0; j < levels.length; j++) {
      if (i === j || games[i][j] === 0) continue
      const exp = 1 / (1 + Math.pow(10, (elo[j] - elo[i]) / 400))
      const act = wins[i][j] / games[i][j]
      elo[i] += 8 * (act - exp)
    }
  }
}
// Auf Mittel 1000 zentrieren.
const mean = elo.reduce((a, b) => a + b, 0) / elo.length
for (let i = 0; i < elo.length; i++) elo[i] = Math.round(elo[i] - mean + 1000)

console.log(
  `EICHUNG — ${String(SEEDS)} Seeds · ${String(NLEVELS)} Stufen · Map ${String(MAP)}² · ${String(TICKS)} Ticks · ${((Date.now() - t0) / 1000).toFixed(0)}s\n`,
)
console.log('  s     ELO   attackPct  cooldown   Bomber?')
for (let i = 0; i < levels.length; i++) {
  const p = overrides[i]
  console.log(
    `  ${levels[i].toFixed(2)}  ${String(elo[i]).padStart(5)}   ${p.attackPct.toFixed(0).padStart(3)}      ${String(p.cooldownMin)}-${String(p.cooldownMax)}     ${p.usesBombers ? 'ja' : 'nein'}`,
  )
}
console.log('\nSTRENGTH_ELO Stützpunkte (in src/ai/strength.ts eintragen):')
console.log('[' + levels.map((s, i) => `[${s.toFixed(2)}, ${String(elo[i])}]`).join(', ') + ']')
