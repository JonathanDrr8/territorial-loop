/**
 * ELO-Auswertung der Arena-Matches (ADR-0020).
 *
 * Aus den Match-Ergebnissen werden **paarweise Vergleiche** zwischen Profilen gezogen (innerhalb
 * eines Matches: wer von zwei Nationen unterschiedlicher Schwierigkeit hält mehr Territorium →
 * Sieg/Niederlage/Remis). Daraus fällt eine Gewinnraten-Matrix und per iterativem Elo-Fit ein
 * Rating pro Profil. Der **Anker** (Standard-Profil) wird fest auf 1000 verschoben — alle anderen
 * liegen relativ dazu darüber/darunter.
 *
 * Rein arithmetisch & deterministisch (feste Iterations-Reihenfolge) → reproduzierbar.
 */

import type { MatchResult } from './arena'

/** Aggregierter paarweiser Ausgang A-gegen-B: `scoreA` = Summe (Sieg 1 / Remis .5 / Niederlage 0). */
export interface PairTally {
  readonly a: string
  readonly b: string
  scoreA: number
  games: number
}

/** Gewinnraten-Matrix + Spielzahlen für den Report. */
export interface PairwiseStats {
  /** Sortierte Profil-Labels. */
  readonly labels: readonly string[]
  /** `tallies[key]` mit `key = "A|B"` (A,B in Label-Sortierreihenfolge, A<B). */
  readonly tallies: ReadonlyMap<string, PairTally>
}

function pairKey(a: string, b: string): string {
  return `${a}|${b}`
}

/**
 * Zieht aus allen Matches die paarweisen Vergleiche zwischen unterschiedlichen Profilen.
 * Innerhalb eines Matches wird jede Nation gegen jede andere (anderen Profils) verglichen —
 * mehr Territorium gewinnt. So liefert ein Match mit k Profilen viele Stichproben.
 */
export function aggregatePairwise(matches: readonly MatchResult[]): PairwiseStats {
  const labelSet = new Set<string>()
  for (const m of matches) for (const p of m.players) labelSet.add(p.difficulty)
  const labels = [...labelSet].sort()
  const tallies = new Map<string, PairTally>()

  const ensure = (a: string, b: string): PairTally => {
    const key = pairKey(a, b)
    let t = tallies.get(key)
    if (t === undefined) {
      t = { a, b, scoreA: 0, games: 0 }
      tallies.set(key, t)
    }
    return t
  }

  for (const m of matches) {
    const ps = m.players
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const pi = ps[i]
        const pj = ps[j]
        if (pi === undefined || pj === undefined) continue
        if (pi.difficulty === pj.difficulty) continue
        // Kanonische Richtung: a = lexikografisch kleineres Label.
        const aFirst = pi.difficulty < pj.difficulty
        const a = aFirst ? pi.difficulty : pj.difficulty
        const b = aFirst ? pj.difficulty : pi.difficulty
        const aTiles = aFirst ? pi.tilesOwned : pj.tilesOwned
        const bTiles = aFirst ? pj.tilesOwned : pi.tilesOwned
        const t = ensure(a, b)
        if (aTiles > bTiles) t.scoreA += 1
        else if (aTiles < bTiles) t.scoreA += 0
        else t.scoreA += 0.5
        t.games += 1
      }
    }
  }

  return { labels, tallies }
}

export interface EloOptions {
  /** Profil, das auf `anchorValue` festgenagelt wird. */
  readonly anchor: string
  /** Anker-Rating (Default 1000). */
  readonly anchorValue?: number
  readonly epochs?: number
  readonly k?: number
}

/** Erwartungswert A gegen B nach Elo-Logistik. */
function expected(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400))
}

/**
 * Iterativer Elo-Fit aus den paarweisen Aggregaten. Startet alle Profile bei 1000 und schiebt
 * sie über `epochs` Durchläufe in Richtung der beobachteten Gewinnraten; danach Verschiebung,
 * sodass `anchor == anchorValue`. Feste Reihenfolge (sortierte Pair-Keys) → deterministisch.
 */
export function computeElo(stats: PairwiseStats, opts: EloOptions): Record<string, number> {
  const anchorValue = opts.anchorValue ?? 1000
  const epochs = opts.epochs ?? 4000
  const k = opts.k ?? 16

  const rating = new Map<string, number>()
  for (const label of stats.labels) rating.set(label, 1000)

  const keys = [...stats.tallies.keys()].sort()

  for (let e = 0; e < epochs; e++) {
    for (const key of keys) {
      const t = stats.tallies.get(key)
      if (t === undefined || t.games === 0) continue
      const ra = rating.get(t.a) ?? 1000
      const rb = rating.get(t.b) ?? 1000
      const actualA = t.scoreA / t.games
      const delta = k * (actualA - expected(ra, rb))
      rating.set(t.a, ra + delta)
      rating.set(t.b, rb - delta)
    }
  }

  // Anker verschieben.
  const anchorRating = rating.get(opts.anchor)
  const shift = anchorRating === undefined ? 0 : anchorValue - anchorRating
  const out: Record<string, number> = {}
  for (const [label, r] of rating) out[label] = Math.round(r + shift)
  return out
}
