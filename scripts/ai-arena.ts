/**
 * Arena-Runner (ADR-0020) — `npm run ai-arena`.
 *
 * Lässt die KI-Profile über viele Seeds gegeneinander laufen und druckt einen Report:
 * ELO-Leiter (Standard auf 1000 verankert), Gewinnraten-Matrix, Territorium-Anteile,
 * Match-Längen und **Nutzungs-Statistik** (wie oft nutzt jedes Profil welche Aktion) als
 * Grundlage für Balance-Tweaks.
 *
 * Flags (alle optional):
 *   --seeds N       Anzahl Seeds (Default 20)
 *   --map W         Kartenbreite=Höhe (Default 96)
 *   --ticks T       Max Ticks pro Match (Default 4000)
 *   --terrain X     flat | continents | islands (Default continents)
 *   --rivers        Flüsse an
 *   --roster A,B,.. Difficulty-Liste pro Nation (Default 3×easy,3×normal,3×hard)
 *   --anchor X      Anker-Profil für ELO 1000 (Default normal)
 *   --json          Roh-JSON statt Report (für Tooling)
 */

import { runMatch, type ActionKind, type MatchResult } from '../src/ai/arena'
import { aggregatePairwise, computeElo } from '../src/ai/elo'
import type { Difficulty } from '../src/ai/ai'
import type { TerrainType } from '../src/world/terrain'

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return undefined
  const v = process.argv[i + 1]
  return v !== undefined && !v.startsWith('--') ? v : ''
}

const seeds = Number(flag('seeds') ?? '20')
const map = Number(flag('map') ?? '96')
const ticks = Number(flag('ticks') ?? '4000')
const terrain = (flag('terrain') ?? 'continents') as TerrainType
const rivers = flag('rivers') !== undefined
const anchor = (flag('anchor') ?? 'standard') as Difficulty
const asJson = flag('json') !== undefined

const rosterRaw = flag('roster')
const roster: Difficulty[] =
  rosterRaw !== undefined && rosterRaw.length > 0
    ? (rosterRaw.split(',') as Difficulty[])
    : ([
        'beginner',
        'beginner',
        'easy',
        'easy',
        'standard',
        'standard',
        'advanced',
        'advanced',
        'expert',
        'expert',
      ] as Difficulty[])

const t0 = Date.now()
const matches: MatchResult[] = []
for (let s = 0; s < seeds; s++) {
  matches.push(
    runMatch({
      roster,
      seed: `arena-${String(s)}`,
      mapWidth: map,
      mapHeight: map,
      maxTicks: ticks,
      terrain,
      rivers,
    }),
  )
}
const elapsedMs = Date.now() - t0

const stats = aggregatePairwise(matches)
const elo = computeElo(stats, { anchor })

if (asJson) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ elo, matches }, null, 2))
  process.exit(0)
}

// ---- Report ----
const profiles = [...new Set(roster)].sort((a, b) => (elo[a] ?? 0) - (elo[b] ?? 0))

// Pro Profil: Anzahl Nationen, Ø Territorium-Anteil, Überlebensrate, Ø Nutzung.
interface Agg {
  nations: number
  tileShareSum: number
  aliveSum: number
  usage: Map<ActionKind, number>
}
const agg = new Map<Difficulty, Agg>()
for (const p of profiles) agg.set(p, { nations: 0, tileShareSum: 0, aliveSum: 0, usage: new Map() })
for (const m of matches) {
  for (const pl of m.players) {
    const a = agg.get(pl.difficulty)
    if (a === undefined) continue
    a.nations++
    a.tileShareSum += m.totalLand > 0 ? pl.tilesOwned / m.totalLand : 0
    a.aliveSum += pl.isAlive ? 1 : 0
    for (const [k, v] of Object.entries(pl.usage) as [ActionKind, number][]) {
      a.usage.set(k, (a.usage.get(k) ?? 0) + v)
    }
  }
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`
const avgTicks = matches.reduce((s, m) => s + m.ticks, 0) / Math.max(1, matches.length)

/* eslint-disable no-console */
console.log('')
console.log(
  `ARENA — ${String(seeds)} Seeds · Map ${String(map)}² · ${terrain}${rivers ? '+Flüsse' : ''} · max ${String(ticks)} Ticks`,
)
console.log(`Roster: ${roster.join(', ')}`)
console.log(
  `Laufzeit: ${(elapsedMs / 1000).toFixed(1)}s · Ø Match-Länge: ${avgTicks.toFixed(0)} Ticks · Anker: ${anchor}=1000`,
)
console.log('')
console.log('ELO-Leiter:')
for (const p of [...profiles].sort((a, b) => (elo[b] ?? 0) - (elo[a] ?? 0))) {
  const a = agg.get(p)
  const tShare = a && a.nations > 0 ? a.tileShareSum / a.nations : 0
  const alive = a && a.nations > 0 ? a.aliveSum / a.nations : 0
  console.log(
    `  ${p.padEnd(8)} ${String(elo[p] ?? 0).padStart(5)}   Ø-Gebiet ${pct(tShare).padStart(6)}   Überlebt ${pct(alive).padStart(6)}`,
  )
}
console.log('')
console.log('Gewinnraten (Zeile schlägt Spalte):')
const header = ['        ', ...profiles.map((p) => p.slice(0, 7).padStart(8))].join('')
console.log(header)
for (const a of profiles) {
  const cells: string[] = [a.padEnd(8)]
  for (const b of profiles) {
    if (a === b) {
      cells.push('     -  ')
      continue
    }
    const aFirst = a < b
    const key = aFirst ? `${a}|${b}` : `${b}|${a}`
    const t = stats.tallies.get(key)
    if (t === undefined || t.games === 0) {
      cells.push('     ·  ')
      continue
    }
    const wrA = aFirst ? t.scoreA / t.games : 1 - t.scoreA / t.games
    cells.push(pct(wrA).padStart(8))
  }
  console.log(cells.join(''))
}
console.log('')
console.log('Nutzung (Ø Aktionen pro Nation/Match):')
for (const p of [...profiles].sort((a, b) => (elo[b] ?? 0) - (elo[a] ?? 0))) {
  const a = agg.get(p)
  if (a === undefined || a.nations === 0) continue
  const entries = [...a.usage.entries()]
    .map(([k, v]) => [k, v / a.nations] as [ActionKind, number])
    .filter(([, v]) => v >= 0.05)
    .sort((x, y) => y[1] - x[1])
  const str = entries.map(([k, v]) => `${k} ${v.toFixed(1)}`).join('  ')
  console.log(`  ${p.padEnd(8)} ${str.length > 0 ? str : '(keine)'}`)
}
console.log('')
