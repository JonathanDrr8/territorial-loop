/**
 * Kontinuierliche KI-Stärke (ADR-0022): statt 5 fester Stufen ein Stärke-Skalar `s ∈ [0,1]`, der
 * ein vollständiges Profil erzeugt — von einem schwachen Boden (s=0) bis zum vom Tuner gefundenen
 * Optimum (s=1, ADR-0021). Fähigkeiten schalten an Schwellen frei (Wirtschaft/Flak/Bomber).
 *
 * Über die Eichung (`scripts/ai-calibrate.ts`) wird `s` auf **ELO** abgebildet → `profileForElo(elo)`
 * liefert eine KI beliebiger Spielstärke (Anker: ELO 1000 = ausgewogener Gegner). Grundlage des
 * Ranked-/Progressions-Modus (Spieler startet 1000, ELO bewegt sich mit dem Können).
 */

import type { DifficultyProfile } from './ai'

/**
 * Vom Tuner gefundenes & über 50 Seeds validiertes Optimum: kleine Dauer-Angriffe (niedrige
 * Angriffs-% bei maximaler Frequenz) halten die Truppen am ~42%-Wachstums-Optimum und expandieren
 * unermüdlich. Deutlich stärker als das alte „große, seltene Angriffe"-Experte.
 */
const OPTIMUM = {
  // Hinweis: Der Tuner fand attackPct 11 / Cooldown 4-12 (1-gegen-1 gegen Baseline). Die Eichung im
  // realistischen Mehr-Nationen-Freikampf zeigte aber, dass das EXTREM (max APM, min Angriff)
  // überangepasst ist — das etwas ruhigere Profil ist im FFA stärker. Daher hier als oberer Anker.
  attackPct: 14,
  cooldownMin: 14,
  cooldownMax: 40,
  popThresholdForPvp: 0.6,
  buildChance: 0.62,
  boatChance: 0.1,
  warshipChance: 0.09,
  bomberChance: 0.17,
  tilesPerCity: 150,
} as const

const lerp = (a: number, b: number, s: number): number => a + (b - a) * s
const clamp01 = (s: number): number => Math.max(0, Math.min(1, s))

/**
 * Vollständiges Profil für einen Stärke-Skalar `s ∈ [0,1]`. Schwächung primär über APM (hoher
 * Cooldown = träge), naivere Aggression (größere, seltenere Angriffe) und fehlende Fähigkeiten.
 */
export function profileForStrength(sRaw: number): DifficultyProfile {
  const s = clamp01(sRaw)
  return {
    // Aggression: schwach = große, seltene Angriffe (überdehnt); stark = kleine Dauer-Angriffe.
    attackPct: lerp(34, OPTIMUM.attackPct, s),
    // APM: der dominante Stärke-Hebel (OpenFront-Vorbild). Träge unten, hyperaktiv oben.
    cooldownMin: Math.round(lerp(90, OPTIMUM.cooldownMin, s)),
    cooldownMax: Math.round(lerp(240, OPTIMUM.cooldownMax, s)),
    popThresholdForPvp: lerp(0.85, OPTIMUM.popThresholdForPvp, s),
    // Wirtschaft schaltet ab s≈0.18 frei.
    buildChance: s < 0.18 ? 0 : lerp(0.15, OPTIMUM.buildChance, s),
    diploChance: s < 0.3 ? 0 : lerp(0.1, 0.35, s),
    boatChance: s < 0.25 ? 0 : lerp(0.03, OPTIMUM.boatChance, s),
    warshipChance: s < 0.38 ? 0 : lerp(0.02, OPTIMUM.warshipChance, s),
    bomberChance: s < 0.58 ? 0 : lerp(0.05, OPTIMUM.bomberChance, s),
    betrayLeadRatio: s < 0.3 ? Infinity : lerp(2.0, 1.25, s),
    // Fähigkeits-Schwellen so gelegt, dass die benannten Presets passen: Standard (~s0.41) hat Flak +
    // Krater-Heilung, aber noch keine offensiven Bomber; Fortgeschritten (~s0.66) bekommt Bomber.
    usesAirDefense: s >= 0.38,
    usesBombers: s >= 0.58,
    healsCraters: s >= 0.4,
    tilesPerCity: s < 0.18 ? 0 : Math.round(lerp(190, OPTIMUM.tilesPerCity, s)),
  }
}

/**
 * Eich-Stützpunkte `[s, ELO]` aus `scripts/ai-calibrate.ts` (gemessen, monoton, Anker ≈1000).
 * Platzhalter-linear bis zur ersten Messung; wird nach der Eichung mit echten Werten ersetzt.
 */
export const STRENGTH_ELO: ReadonlyArray<readonly [number, number]> = [
  [0, 663],
  [0.13, 668],
  [0.25, 857],
  [0.38, 961],
  [0.5, 1098],
  [0.63, 1124],
  [0.75, 1200],
  [0.88, 1212],
  [1, 1225],
]

/** Lineare Interpolation/Inversion über eine monotone (x→y)-Stützpunkt-Tabelle. */
function interp(
  table: ReadonlyArray<readonly [number, number]>,
  x: number,
  invert = false,
): number {
  const pts = table.map((p) => (invert ? [p[1], p[0]] : [p[0], p[1]]) as readonly [number, number])
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (first === undefined || last === undefined) return 0
  if (x <= first[0]) return first[1]
  if (x >= last[0]) return last[1]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    if (a === undefined || b === undefined) continue
    if (x <= b[0]) {
      const t = (x - a[0]) / (b[0] - a[0] || 1)
      return a[1] + (b[1] - a[1]) * t
    }
  }
  return last[1]
}

/** ELO → Stärke-Skalar (invertiert die Eich-Tabelle). */
export function eloToStrength(elo: number): number {
  return clamp01(interp(STRENGTH_ELO, elo, true))
}

/** Stärke-Skalar → erwartetes ELO (für Anzeige/Eichung). */
export function strengthToElo(s: number): number {
  return Math.round(interp(STRENGTH_ELO, clamp01(s)))
}

/** Vollständiges KI-Profil für ein Ziel-ELO (Kern des Ranked-Modus). */
export function profileForElo(elo: number): DifficultyProfile {
  return profileForStrength(eloToStrength(elo))
}

/**
 * Die 5 benannten Schwierigkeits-Presets als ELO-Punkte auf dem Kontinuum (gemessen, monoton).
 * So ist das im UI angezeigte ELO die *echte* Spielstärke, und Presets + Ranked teilen sich die
 * gleiche Engine. Standard = 1000 (Anker, ausgewogen). Im UI als „Standard (1000)" anzeigen.
 */
export const PRESET_ELO = {
  beginner: 660,
  easy: 850,
  standard: 1000,
  advanced: 1130,
  expert: 1225,
} as const
