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
  // Aus dem FREIKAMPF-Tuner (ADR-0022-Nachtrag, --ffa: Kandidat in einem Feld diverser unabhängiger
  // Gegner, Fitness 0.74). Realistischer als das 1-gegen-1-Optimum: kleine Dauer-Angriffe (attackPct
  // 14) bei moderater APM, viel Wirtschaft, aggressives PvP (popThr 0.3). Wichtig: Diplomatie wurde
  // NICHT wegoptimiert (diploChance 0.37, betrayLeadRatio 1.83 = loyaler) → Diplomatie hilft im FFA.
  attackPct: 14,
  cooldownMin: 22,
  cooldownMax: 38,
  popThresholdForPvp: 0.34,
  buildChance: 0.63,
  boatChance: 0.11,
  warshipChance: 0.13,
  bomberChance: 0.12,
  tilesPerCity: 185,
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
    // Diplomatie (FFA-getunt): stark = aktive Diplomatie (0.37) + loyaler (betrayLeadRatio 1.83,
    // verrät erst bei klarem Vorsprung). Schwach = passiv/treulos-naiv.
    diploChance: s < 0.3 ? 0 : lerp(0.1, 0.37, s),
    boatChance: s < 0.25 ? 0 : lerp(0.03, OPTIMUM.boatChance, s),
    warshipChance: s < 0.38 ? 0 : lerp(0.02, OPTIMUM.warshipChance, s),
    bomberChance: s < 0.4 ? 0 : lerp(0.05, OPTIMUM.bomberChance, s),
    betrayLeadRatio: s < 0.3 ? Infinity : lerp(2.2, 1.83, s),
    // Fähigkeits-Schwellen so gelegt, dass der Standard-Gegner (ELO 1000 ≈ s0.43) das volle
    // Repertoire abdeckt — inkl. ein paar Bomber (2026-06-07, ADR-0031 Teil C: Bomber-Schwelle
    // 0.58 → 0.40 gesenkt). Flak + Krater-Heilung + Bomber liegen nun beieinander bei ~s0.40.
    usesAirDefense: s >= 0.38,
    usesBombers: s >= 0.4,
    healsCraters: s >= 0.4,
    tilesPerCity: s < 0.18 ? 0 : Math.round(lerp(190, OPTIMUM.tilesPerCity, s)),
  }
}

/**
 * Eich-Stützpunkte `[s, ELO]` aus `scripts/ai-calibrate.ts` (gemessen, monoton, Anker ≈1000).
 * Neu geeicht 2026-06-03 (200 Seeds) NACH der Fabrik-Wirtschafts-Überarbeitung (v0.52.0): die
 * verbesserte Fabrik-Nutzung half schwachen/mittleren Profilen relativ mehr → die Spreizung
 * schrumpfte (oben 1410→1293, Mitte rauf), die Stufen liegen jetzt näher beieinander.
 */
export const STRENGTH_ELO: ReadonlyArray<readonly [number, number]> = [
  [0, 659],
  [0.13, 671],
  [0.25, 858],
  [0.38, 972],
  [0.5, 1040],
  [0.63, 1107],
  [0.75, 1165],
  [0.88, 1235],
  [1, 1293],
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

// ── Archetypen (ADR-0032, Baustein 2): Spielstil ORTHOGONAL zur ELO ─────────────────────────────
// ELO = wie GUT (Skill/APM/Timing), Archetyp = welcher STIL. Ein Archetyp ist ein deterministischer
// Modifikator auf das fertige Profil — derselbe Stil existiert auf jeder Stärke. 'balanced' ist die
// Identität (heutiges Verhalten); Eich-/Golden-/Tuner-Pfade laufen weiter mit 'balanced'.

export type Archetype = 'balanced' | 'eco' | 'bomber' | 'turtle' | 'aggressor'

/** Reihenfolge = Verteilungs-Schlüssel von {@link archetypeFor} (Index-stabil halten!). */
export const ARCHETYPES: readonly Archetype[] = ['balanced', 'eco', 'bomber', 'turtle', 'aggressor']

const clampRange = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/**
 * Formt das Basis-Profil zum Spielstil um. Bewusst MODERATE Modifikatoren (×0.7–×1.6 + Clamps):
 * der Stil soll spürbar sein, ohne die geeichte Spielstärke (ELO) zu kippen — Arena-validiert.
 * Rein deterministisch (keine PRNG-/Zeit-Abhängigkeit) → MP-sicher.
 */
export function applyArchetype(p: DifficultyProfile, a: Archetype): DifficultyProfile {
  switch (a) {
    case 'balanced':
      return p
    case 'eco':
      // Wirtschaft zuerst: mehr Bauen, dichteres Städtenetz, dafür zurückhaltender im Angriff.
      return {
        ...p,
        buildChance: clampRange(p.buildChance * 1.35, 0, 0.9),
        tilesPerCity: p.tilesPerCity > 0 ? Math.max(120, Math.round(p.tilesPerCity * 0.75)) : 0,
        attackPct: clampRange(p.attackPct * 0.8, 5, 100),
        bomberChance: p.bomberChance * 0.6,
        warshipChance: p.warshipChance * 1.2,
      }
    case 'bomber':
      // Früh + viel Luftwaffe: hohe Bomber-Quote, Bauen leicht rauf (Flughäfen!), See runter.
      return {
        ...p,
        usesBombers: p.usesBombers,
        bomberChance: p.usesBombers ? clampRange(p.bomberChance * 2 + 0.04, 0, 0.4) : 0,
        buildChance: clampRange(p.buildChance * 1.15, 0, 0.85),
        warshipChance: p.warshipChance * 0.5,
      }
    case 'turtle':
      // Defensiv: kleinere/seltenere Angriffe, kaum PvP-Hunger, dafür Flak/Heilung früh.
      // (Arena-getunt: ×0.8/×1.1 statt ×0.7/×1.2 — die härteren Werte gewannen nur 4/50.)
      return {
        ...p,
        attackPct: clampRange(p.attackPct * 0.8, 5, 100),
        cooldownMin: Math.round(p.cooldownMin * 1.1),
        cooldownMax: Math.round(p.cooldownMax * 1.1),
        popThresholdForPvp: clampRange(p.popThresholdForPvp * 1.15, 0, 0.95),
        usesAirDefense: true,
        healsCraters: true,
        betrayLeadRatio: p.betrayLeadRatio === Infinity ? Infinity : p.betrayLeadRatio * 1.3,
      }
    case 'aggressor':
      // Expansion/Druck: größere + häufigere Angriffe, Wirtschaft schlanker, früh PvP-bereit.
      // (Arena-getunt: Eco ×0.8 statt ×0.7 + Angriff ×1.3 statt ×1.4 — sonst verhungert/überdehnt er.)
      return {
        ...p,
        attackPct: clampRange(p.attackPct * 1.3, 5, 100),
        cooldownMin: Math.max(8, Math.round(p.cooldownMin * 0.85)),
        cooldownMax: Math.max(12, Math.round(p.cooldownMax * 0.85)),
        buildChance: clampRange(p.buildChance * 0.8, 0, 1),
        popThresholdForPvp: clampRange(p.popThresholdForPvp * 0.85, 0.15, 1),
        bomberChance: p.bomberChance * 0.8,
      }
  }
}

/**
 * Seed-deterministische Archetyp-Zuweisung für eine KI (ADR-0032: „bunte Mischung" als Default).
 * Hängt NUR an (gameSeed, playerId) → Client, Server und Worker errechnen identisch denselben Stil
 * (MP-sicher, ADR-0009). FNV-1a über den kombinierten String, dann gleichverteilt über ARCHETYPES.
 */
export function archetypeFor(gameSeed: string, playerId: number): Archetype {
  const key = `${gameSeed}#${String(playerId)}`
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const idx = (h >>> 0) % ARCHETYPES.length
  return ARCHETYPES[idx] ?? 'balanced'
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
