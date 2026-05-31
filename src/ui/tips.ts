/**
 * Gemeinsame Tipp-Liste (i18n-Keys) für das Start-Menü (rechte Spalte) und den Lade-Overlay
 * zwischen Menü/Lobby und Match. Reine Deko — kein Sim-Determinismus, `Date.now()` ok.
 */

export const TIP_KEYS = [
  'info.tip.1',
  'info.tip.2',
  'info.tip.3',
  'info.tip.4',
  'info.tip.5',
  'info.tip.6',
] as const

/** Zufälliger Start-Index (variiert den ersten gezeigten Tipp). */
export function randomTipIndex(): number {
  return Date.now() % TIP_KEYS.length
}
