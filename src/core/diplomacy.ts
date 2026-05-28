/**
 * Diplomatie: Allianzen, Verrat („Ächtung"), Handelsembargos.
 *
 * Reine Schlüssel-/Beziehungs-Helfer + Konstanten. Die zustandsverändernden
 * Aktionen (Bündnis anfragen/annehmen/brechen, Embargo setzen) und ihre
 * Auswirkungen auf den Kampf leben in `core/game.ts`.
 *
 * Beziehungen werden als Zahlen-Schlüssel in Sets gehalten:
 *  - Allianz: ungeordnetes Paar (a,b) → `pairKey`.
 *  - Allianz-Anfrage & Embargo: gerichtetes Paar (from→to) → `directedKey`.
 */

/** Obergrenze der Spieler-IDs (siehe OWNER_MASK = 0x0fff). */
const ID_STRIDE = 4096

/** Ächtungsdauer nach Verrat (Ticks), in der der Verräter geschwächt verteidigt. */
export const AECHTUNG_DURATION_TICKS = 300
/** Verteidigungs-Malus des Verräters: Angreifer-Verluste werden mit diesem Faktor multipliziert. */
export const TRAITOR_DEFENSE_PENALTY = 0.5

/** Ungeordneter Paar-Schlüssel (a,b) == (b,a). */
export function pairKey(a: number, b: number): number {
  return a < b ? a * ID_STRIDE + b : b * ID_STRIDE + a
}

/** Gerichteter Schlüssel from→to. */
export function directedKey(from: number, to: number): number {
  return from * ID_STRIDE + to
}

/** Sind a und b verbündet? */
export function areAllied(alliances: ReadonlySet<number>, a: number, b: number): boolean {
  if (a === b) return false
  return alliances.has(pairKey(a, b))
}

/** Hat `from` `to` ein Bündnis angeboten? */
export function hasAllianceRequest(
  requests: ReadonlySet<number>,
  from: number,
  to: number,
): boolean {
  return requests.has(directedKey(from, to))
}

/**
 * Ist der Handel zwischen `a` und `b` durch ein Embargo blockiert? Embargos sind
 * einseitig verhängbar, stoppen aber den (beidseitig profitablen) Handel komplett
 * — verhängt eine der beiden Seiten ein Embargo, ruht der Handel.
 */
export function isTradeBlocked(embargoes: ReadonlySet<number>, a: number, b: number): boolean {
  return embargoes.has(directedKey(a, b)) || embargoes.has(directedKey(b, a))
}
