/**
 * Wiederholbares Performance-Benchmark (deterministisch, headless, ohne Browser).
 *
 * Misst die **Simulations-Tick-Zeit** über die echten Match-Presets (Small … Chaos) und meldet die
 * Verteilung (Median / p99 / Max) plus die Zahl der Ticks über dem 16-/50-ms-Budget. Reines JS →
 * maschinen-relativ stabil und in CI lauffähig. Ziel: Sim-Regressionen objektiv und reproduzierbar
 * fangen, statt „gefühlt" zu messen.
 *
 * WICHTIG — was hier NICHT gemessen wird: die **GPU-Render-Kosten** (Canvas-Zeichnen). Die brauchen
 * einen echten Browser auf echter GPU; headless-Chromium nutzt SwiftShader (Software) und verfälscht
 * Canvas-Zahlen. Als Render-Last-Proxy meldet das Benchmark die max. geänderten Tiles pro Tick
 * (`dirtyMax`) — hohe Werte = teures inkrementelles Neuzeichnen. Die eigentliche Frame-Zeit prüft man
 * im Browser (siehe README / `npm run dev`).
 *
 * Nutzung:
 *   npm run perf                  # alle Presets, je 2500 Ticks
 *   npm run perf -- chaos         # nur Chaos
 *   npm run perf -- standard chaos --ticks 4000
 */

import { createGame, tick, type GameConfig, type PlayerDef } from '../src/core/game'
import { createAI, type AI } from '../src/ai/ai'

interface Preset {
  readonly key: string
  readonly mapWidth: number
  readonly mapHeight: number
  readonly aiCount: number
  readonly wildCount: number
}

// Spiegelt MATCH_PRESETS aus src/ui/start-menu.ts (Kartengröße + Nationen). Bewusst hier dupliziert,
// damit das Benchmark keine UI-Abhängigkeit (DOM/i18n) hereinzieht.
const PRESETS: readonly Preset[] = [
  { key: 'small', mapWidth: 768, mapHeight: 768, aiCount: 25, wildCount: 120 },
  { key: 'standard', mapWidth: 1024, mapHeight: 1024, aiCount: 50, wildCount: 300 },
  { key: 'large', mapWidth: 1536, mapHeight: 1536, aiCount: 75, wildCount: 480 },
  { key: 'chaos', mapWidth: 2048, mapHeight: 2048, aiCount: 150, wildCount: 600 },
]

function buildConfig(p: Preset): GameConfig {
  const players: PlayerDef[] = []
  let id = 1
  // Der „Mensch"-Slot wird hier als ganz normale KI gefahren (Selbstspiel) → volle Last.
  for (let i = 0; i <= p.aiCount; i++)
    players.push({ id: id++, name: `AI${String(i)}`, color: 0x3366ccff, isHuman: false })
  for (let i = 0; i < p.wildCount; i++)
    players.push({ id: id++, name: `W${String(i)}`, color: 0x888888ff, isHuman: false, wild: true })
  return {
    mapWidth: p.mapWidth,
    mapHeight: p.mapHeight,
    seed: `perf-${p.key}`,
    victoryPct: 99, // hoch → Match endet nicht vorzeitig, wir messen die volle Dauer
    terrain: 'continents',
    players,
  }
}

function percentile(sortedAsc: readonly number[], q: number): number {
  if (sortedAsc.length === 0) return 0
  const i = Math.min(sortedAsc.length - 1, Math.floor(q * sortedAsc.length))
  return sortedAsc[i] ?? 0
}

interface Row {
  key: string
  map: string
  nations: number
  ticks: number
  p50: number
  p99: number
  max: number
  over16: number
  over50: number
  dirtyMax: number
  totalS: number
}

function runPreset(p: Preset, ticks: number): Row {
  const config = buildConfig(p)
  const state = createGame(config)
  const ais: AI[] = []
  for (const pl of state.players.values())
    ais.push(createAI(pl.id, state.seed, 'standard', pl.wild))

  const times: number[] = []
  let dirtyMax = 0
  const t0 = performance.now()
  for (let t = 0; t < ticks; t++) {
    const intents = []
    for (const ai of ais) for (const i of ai.decide(state)) intents.push(i)
    const a = performance.now()
    tick(state, intents)
    times.push(performance.now() - a)
    if (state.dirtyTiles.length > dirtyMax) dirtyMax = state.dirtyTiles.length
  }
  const totalS = (performance.now() - t0) / 1000
  const sorted = [...times].sort((a, b) => a - b)
  const r1 = (n: number): number => Math.round(n * 10) / 10
  return {
    key: p.key,
    map: `${String(p.mapWidth)}²`,
    nations: p.aiCount + 1 + p.wildCount,
    ticks,
    p50: r1(percentile(sorted, 0.5)),
    p99: r1(percentile(sorted, 0.99)),
    max: r1(sorted[sorted.length - 1] ?? 0),
    over16: times.filter((x) => x > 16).length,
    over50: times.filter((x) => x > 50).length,
    dirtyMax,
    totalS: r1(totalS),
  }
}

function pad(s: string | number, n: number): string {
  return String(s).padEnd(n)
}

function main(): void {
  const argv = process.argv.slice(2)
  let ticks = 2500
  const tIdx = argv.indexOf('--ticks')
  if (tIdx >= 0) {
    const v = Number(argv[tIdx + 1])
    if (Number.isFinite(v) && v > 0) ticks = Math.floor(v)
  }
  const wanted = argv.filter((a) => !a.startsWith('--') && a !== String(ticks))
  const selected =
    wanted.length > 0 ? PRESETS.filter((p) => wanted.includes(p.key)) : PRESETS.slice()
  if (selected.length === 0) {
    process.stdout.write(`Unbekanntes Preset. Bekannt: ${PRESETS.map((p) => p.key).join(', ')}\n`)
    return
  }

  process.stdout.write(
    `\nperf-bench — Sim-Tick-Zeit (ms), je ${String(ticks)} Ticks Selbstspiel, deterministisch.\n` +
      `(Render/GPU NICHT enthalten — siehe Kopf der Datei; dirtyMax = Render-Last-Proxy.)\n\n`,
  )
  const head =
    pad('Preset', 10) +
    pad('Karte', 8) +
    pad('Nat.', 6) +
    pad('p50', 8) +
    pad('p99', 8) +
    pad('max', 9) +
    pad('>16ms', 8) +
    pad('>50ms', 8) +
    pad('dirtyMax', 10) +
    pad('Sim-s', 7)
  process.stdout.write(head + '\n' + '-'.repeat(head.length) + '\n')
  for (const p of selected) {
    const r = runPreset(p, ticks)
    process.stdout.write(
      pad(r.key, 10) +
        pad(r.map, 8) +
        pad(r.nations, 6) +
        pad(r.p50, 8) +
        pad(r.p99, 8) +
        pad(r.max, 9) +
        pad(r.over16, 8) +
        pad(r.over50, 8) +
        pad(r.dirtyMax, 10) +
        pad(r.totalS, 7) +
        '\n',
    )
  }
  process.stdout.write('\n')
}

main()
