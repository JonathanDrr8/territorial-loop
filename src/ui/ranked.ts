/**
 * Ranked-/Progressions-Modus (ADR-0022): lokales Spieler-ELO, das mit dem Können wächst.
 *
 * Der Spieler startet bei 1000, spielt gegen eine KI seiner Stärke (`profileForElo`), und nach dem
 * Match bewegt sich sein ELO nach Standard-Formel (Sieg → hoch, Niederlage → runter). Alles lokal
 * im `localStorage` — KEINE Accounts/Server nötig (das Online-Cross-Device-Ranking bleibt später).
 *
 * Reine Funktionen (ELO-Mathematik) sind separat testbar; nur get/set berühren `localStorage`.
 */

const STORAGE_KEY = 'territorial-loop:ranked:v1'

/** Start-ELO für neue Spieler. */
export const STARTING_ELO = 1000
/** ELO-Grenzen (an den gemessenen KI-Stärke-Bereich angelehnt, mit Luft nach unten/oben). */
export const ELO_MIN = 100
export const ELO_MAX = 2000
/** K-Faktor: wie stark ein Match das ELO bewegt. */
const K_FACTOR = 32

export interface RankedState {
  elo: number
  wins: number
  losses: number
  /** Höchstes je erreichtes ELO (für „du wirst besser"-Anzeige). */
  peak: number
}

const DEFAULT_STATE: RankedState = { elo: STARTING_ELO, wins: 0, losses: 0, peak: STARTING_ELO }

/** Erwartete Punktzahl des Spielers (0..1) gegen einen Gegner mit `aiElo` (ELO-Logistik). */
export function expectedScore(playerElo: number, aiElo: number): number {
  return 1 / (1 + Math.pow(10, (aiElo - playerElo) / 400))
}

/** Neues Spieler-ELO nach einem Match (won = hat der Mensch gewonnen?), geklemmt. */
export function nextElo(playerElo: number, aiElo: number, won: boolean): number {
  const exp = expectedScore(playerElo, aiElo)
  const raw = playerElo + K_FACTOR * ((won ? 1 : 0) - exp)
  return Math.max(ELO_MIN, Math.min(ELO_MAX, Math.round(raw)))
}

/** Liest den Ranked-Stand aus dem localStorage (oder Default). Robust gegen kaputte Daten. */
export function loadRanked(): RankedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(raw) as Partial<RankedState>
    const elo =
      typeof parsed.elo === 'number' && Number.isFinite(parsed.elo)
        ? Math.max(ELO_MIN, Math.min(ELO_MAX, Math.round(parsed.elo)))
        : STARTING_ELO
    return {
      elo,
      wins: typeof parsed.wins === 'number' ? parsed.wins : 0,
      losses: typeof parsed.losses === 'number' ? parsed.losses : 0,
      peak: typeof parsed.peak === 'number' ? Math.max(parsed.peak, elo) : elo,
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function saveRanked(state: RankedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage nicht verfügbar (privater Modus o.ä.) — Ranked ist dann nur flüchtig.
  }
}

/**
 * Verbucht ein Match-Ergebnis: aktualisiert ELO/Bilanz/Peak und persistiert. Gibt alt+neu zurück
 * (für die „ELO 1000 → 1024"-Anzeige).
 */
export function recordResult(aiElo: number, won: boolean): { before: number; after: RankedState } {
  const cur = loadRanked()
  const before = cur.elo
  const elo = nextElo(cur.elo, aiElo, won)
  const next: RankedState = {
    elo,
    wins: cur.wins + (won ? 1 : 0),
    losses: cur.losses + (won ? 0 : 1),
    peak: Math.max(cur.peak, elo),
  }
  saveRanked(next)
  return { before, after: next }
}

/** Setzt den Ranked-Stand zurück (für einen „Neu anfangen"-Knopf). */
export function resetRanked(): RankedState {
  saveRanked({ ...DEFAULT_STATE })
  return { ...DEFAULT_STATE }
}
