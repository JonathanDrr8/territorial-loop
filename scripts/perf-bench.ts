/**
 * Wiederholbares Performance-Benchmark (deterministisch, headless, ohne Browser).
 *
 * Misst die **Simulations-Tick-Zeit** über die echten Match-Presets (Small … Chaos) und meldet die
 * Verteilung (Median / p99 / Max) plus die Zahl der Ticks über dem 16-/50-ms-Budget. Reines JS →
 * maschinen-relativ stabil und in CI lauffähig. Ziel: Sim-Regressionen objektiv und reproduzierbar
 * fangen, statt „gefühlt" zu messen.
 *
 * **`--phases`-Modus** (genauer, 2026-06-07): bricht einen Lauf in die Phasen von `tick()` auf
 * (intents / growth / attacks / naval / air / trade / economy / relations / world) PLUS die
 * KI-Entscheidung (`ai-decide`, separat gemessen — sie läuft pro Tick vor `tick()`). Meldet je Phase
 * Gesamtanteil, p99 und Max sowie die 10 langsamsten Ticks mit ihrer Spitzen-Phase → zeigt, *welcher*
 * Teil ruckelt, nicht nur *dass* es ruckelt. Nutzt den `setPhaseProfiler`-Haken aus `core/game.ts`
 * (mutiert keinen State → Determinismus unberührt).
 *
 * WICHTIG — was hier NICHT gemessen wird: die **GPU-Render-Kosten** (Canvas-Zeichnen). Die brauchen
 * einen echten Browser auf echter GPU; headless-Chromium nutzt SwiftShader (Software) und verfälscht
 * Canvas-Zahlen. Als Render-Last-Proxy meldet das Benchmark die max. geänderten Tiles pro Tick
 * (`dirtyMax`) — hohe Werte = teures inkrementelles Neuzeichnen. Die echte Frame-Zeit misst man im
 * Browser mit dem Snippet in `scripts/perf-render.md` (in die DevTools-Konsole eines Matches einfügen).
 *
 * Nutzung:
 *   npm run perf                       # alle Presets, je 2500 Ticks (Aggregat-Tabelle)
 *   npm run perf -- chaos              # nur Chaos
 *   npm run perf -- standard chaos --ticks 4000
 *   npm run perf -- chaos --phases     # Phasen-Aufschlüsselung + langsamste Ticks (Chaos)
 */

import {
  createGame,
  tick,
  setPhaseProfiler,
  type GameConfig,
  type PlayerDef,
} from '../src/core/game'
import { createAI, setAiProfiler, type AI } from '../src/ai/ai'

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

function makeAis(state: ReturnType<typeof createGame>): AI[] {
  const ais: AI[] = []
  for (const pl of state.players.values())
    ais.push(createAI(pl.id, state.seed, 'standard', pl.wild))
  return ais
}

function pad(s: string | number, n: number): string {
  return String(s).padEnd(n)
}

function r1(n: number): number {
  return Math.round(n * 10) / 10
}

/* ── Aggregat-Modus (Default) ────────────────────────────────────────────── */

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
  const ais = makeAis(state)

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

function runAggregate(selected: readonly Preset[], ticks: number): void {
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

/* ── Phasen-Modus (--phases) ─────────────────────────────────────────────── */

interface PhaseStat {
  phase: string
  sum: number
  p99: number
  max: number
}

function runPhaseProfile(p: Preset, ticks: number): void {
  const config = buildConfig(p)
  const state = createGame(config)
  const ais = makeAis(state)

  const samples = new Map<string, number[]>()
  const push = (phase: string, dt: number): void => {
    let arr = samples.get(phase)
    if (arr === undefined) {
      arr = []
      samples.set(phase, arr)
    }
    arr.push(dt)
  }

  let last = 0
  let curTotal = 0
  const cur = new Map<string, number>()
  // tick() ruft den Haken nach jeder Phasen-Gruppe auf; 'begin' setzt nur die Startmarke.
  setPhaseProfiler((phase) => {
    const now = performance.now()
    if (phase === 'begin') {
      last = now
      return
    }
    const dt = now - last
    last = now
    push(phase, dt)
    cur.set(phase, dt)
    curTotal += dt
  })

  // Feinere Aufschlüsselung INNERHALB ai-decide (eigener Zeitstrahl, läuft vor tick()). Geht nur in
  // `samples` (separate Sub-Tabelle), NICHT in cur/curTotal — sonst würde ai-decide doppelt zählen.
  let aiLast = 0
  setAiProfiler((step) => {
    const now = performance.now()
    if (step === 'begin') {
      aiLast = now
      return
    }
    push(step, now - aiLast)
    aiLast = now
  })

  const tickTotals: { t: number; total: number; top: string; topDt: number }[] = []
  for (let t = 0; t < ticks; t++) {
    cur.clear()
    curTotal = 0
    // KI-Entscheidung läuft VOR tick() (im echten Spiel im Worker genauso) → separat messen.
    const aiStart = performance.now()
    const intents = []
    for (const ai of ais) for (const i of ai.decide(state)) intents.push(i)
    const aiDt = performance.now() - aiStart
    push('ai-decide', aiDt)
    cur.set('ai-decide', aiDt)
    curTotal += aiDt
    tick(state, intents) // Haken füllt die tick()-Phasen in samples/cur/curTotal
    let top = ''
    let topDt = -1
    for (const [ph, dt] of cur)
      if (dt > topDt) {
        topDt = dt
        top = ph
      }
    tickTotals.push({ t, total: curTotal, top, topDt })
  }
  setPhaseProfiler(null)
  setAiProfiler(null)

  // Phasen-Tabelle (nach Gesamt-Anteil absteigend). 'ai:'-Schritte sind die Aufschlüsselung VON
  // ai-decide → eigene Sub-Tabelle, nicht in `grand` (sonst Doppelzählung).
  const stats: PhaseStat[] = []
  const aiStats: PhaseStat[] = []
  let grand = 0
  for (const [phase, arr] of samples) {
    const sum = arr.reduce((a, b) => a + b, 0)
    const sorted = [...arr].sort((a, b) => a - b)
    const row: PhaseStat = {
      phase,
      sum,
      p99: percentile(sorted, 0.99),
      max: sorted[sorted.length - 1] ?? 0,
    }
    if (phase.startsWith('ai:')) {
      aiStats.push(row)
    } else {
      grand += sum
      stats.push(row)
    }
  }
  stats.sort((a, b) => b.sum - a.sum)
  aiStats.sort((a, b) => b.sum - a.sum)

  process.stdout.write(
    `\nperf-bench --phases — Preset "${p.key}" (${p.mapWidth}², ${String(
      p.aiCount + 1 + p.wildCount,
    )} Nationen), ${String(ticks)} Ticks.\n` +
      `Phase = Gruppe in tick(); ai-decide = KI vor tick(). Zeit in ms.\n\n`,
  )
  const head =
    pad('Phase', 14) + pad('Anteil', 9) + pad('Ø/Tick', 9) + pad('p99', 9) + pad('max', 9)
  process.stdout.write(head + '\n' + '-'.repeat(head.length) + '\n')
  for (const s of stats) {
    const pct = grand > 0 ? (s.sum / grand) * 100 : 0
    process.stdout.write(
      pad(s.phase, 14) +
        pad(`${r1(pct)}%`, 9) +
        pad(r1(s.sum / ticks), 9) +
        pad(r1(s.p99), 9) +
        pad(r1(s.max), 9) +
        '\n',
    )
  }
  const totalMs = grand
  process.stdout.write(
    '-'.repeat(head.length) +
      `\n${pad('GESAMT', 14)}${pad('100%', 9)}${pad(r1(totalMs / ticks), 9)}\n`,
  )

  // ai-decide Aufschlüsselung (Anteil je Schritt AM ai-decide, nicht am Gesamt).
  if (aiStats.length > 0) {
    const aiGrand = aiStats.reduce((a, s) => a + s.sum, 0)
    process.stdout.write('\nai-decide Aufschlüsselung (Anteil an der KI-Zeit):\n')
    process.stdout.write(head + '\n' + '-'.repeat(head.length) + '\n')
    for (const s of aiStats) {
      const pct = aiGrand > 0 ? (s.sum / aiGrand) * 100 : 0
      process.stdout.write(
        pad(s.phase, 14) +
          pad(`${r1(pct)}%`, 9) +
          pad(r1(s.sum / ticks), 9) +
          pad(r1(s.p99), 9) +
          pad(r1(s.max), 9) +
          '\n',
      )
    }
  }

  // Die 10 langsamsten Ticks (mit Spitzen-Phase) — zeigt Spikes statt nur Durchschnitt.
  const worst = [...tickTotals].sort((a, b) => b.total - a.total).slice(0, 10)
  process.stdout.write('\nLangsamste 10 Ticks (Spike-Diagnose):\n')
  process.stdout.write(
    pad('Tick', 8) + pad('total', 10) + pad('Spitzen-Phase', 18) + 'Spitzen-ms\n',
  )
  process.stdout.write('-'.repeat(46) + '\n')
  for (const w of worst) {
    process.stdout.write(
      pad(w.t, 8) + pad(`${r1(w.total)}ms`, 10) + pad(w.top, 18) + `${r1(w.topDt)}\n`,
    )
  }
  process.stdout.write('\n')
}

function main(): void {
  const argv = process.argv.slice(2)
  const phases = argv.includes('--phases')
  let ticks = phases ? 4000 : 2500
  const tIdx = argv.indexOf('--ticks')
  if (tIdx >= 0) {
    const v = Number(argv[tIdx + 1])
    if (Number.isFinite(v) && v > 0) ticks = Math.floor(v)
  }
  const skip = new Set([String(ticks)])
  const wanted = argv.filter((a) => !a.startsWith('--') && !skip.has(a))
  let selected = wanted.length > 0 ? PRESETS.filter((p) => wanted.includes(p.key)) : PRESETS.slice()
  if (selected.length === 0) {
    process.stdout.write(`Unbekanntes Preset. Bekannt: ${PRESETS.map((p) => p.key).join(', ')}\n`)
    return
  }

  if (phases) {
    // Phasen-Modus standardmäßig auf dem schwersten ausgewählten Preset (sonst Chaos).
    if (wanted.length === 0) selected = PRESETS.filter((p) => p.key === 'chaos')
    for (const p of selected) runPhaseProfile(p, ticks)
    return
  }
  runAggregate(selected, ticks)
}

main()
