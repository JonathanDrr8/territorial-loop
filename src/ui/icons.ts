/**
 * Gemeinsames Inline-SVG-Icon-Set fürs In-Game-UI (UI-Redesign Schritt 3) — ersetzt die bunten
 * Emojis (⚓🚢🛡⚔🤝💔⛔⚖😠💰⚠🔗) durch einheitliche Strich-Icons im selben Stil wie die Bau-Knöpfe.
 *
 * Alle Icons nutzen `currentColor` → sie erben die Textfarbe und lassen sich später (Theme, Schritt 4)
 * zentral umfärben. Sie sind so dimensioniert, dass sie INLINE mit Text laufen (`1.05em`,
 * vertikal leicht abgesenkt). Verwendung: direkt als HTML-String einsetzen, z. B.
 * `` `${icon.anchor} ${label}` `` oder in `innerHTML`.
 */

import type { BuildingType } from '../core/buildings'

/** Baut ein inline-taugliches SVG aus den Pfad-Innereien. `currentColor`, an Textgröße gekoppelt. */
function svg(inner: string): string {
  return (
    `<svg viewBox="0 0 24 24" width="1.05em" height="1.05em" fill="none" stroke="currentColor" ` +
    `stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ` +
    `style="display:inline-block;vertical-align:-0.16em;flex:none">${inner}</svg>`
  )
}

/** Wie {@link svg}, aber in einer wählbaren Pixelgröße (für die Bau-Knöpfe/Radial-Slots). */
function svgPx(inner: string, px = 20): string {
  return (
    `<svg viewBox="0 0 24 24" width="${px.toString()}" height="${px.toString()}" fill="none" ` +
    `stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ` +
    `style="display:block">${inner}</svg>`
  )
}

/** Pfad-Innereien je Gebäudetyp (geteilt zwischen Bau-Knöpfen, Radialmenü, Tooltips). */
const BUILDING_PATHS: Record<BuildingType, string> = {
  city: '<path d="M3 21h18"/><rect x="4" y="10" width="5" height="11"/><rect x="10" y="5" width="5" height="16"/><rect x="16" y="13" width="4" height="8"/>',
  defense: '<path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z"/>',
  port: '<circle cx="12" cy="5" r="2"/><path d="M12 7v13"/><path d="M8 11h8"/><path d="M5 13c0 4 3 7 7 7s7-3 7-7"/>',
  factory:
    '<path d="M3 21h18"/><path d="M4 21V10l5 3.5V10l5 3.5V10l5 3.5V21"/><path d="M18 8V4h2v4"/>',
  airport: '<path d="M11 2h2l1 8 6 4v2l-6-2v4l2 2v1.6L12 20l-4 1.6V20l2-2v-4l-6 2v-2l6-4 1-8z"/>',
  flak: '<circle cx="12" cy="12" r="7"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
}

/**
 * Erkennbares Symbol-Icon je Gebäudetyp in Pixelgröße (Standard 20px) — für die Bau-Knöpfe und die
 * Gebäude-Slots im Radialmenü. Stadt=Skyline, Verteidigung=Schild, Hafen=Anker, Fabrik=Silhouette,
 * Flughafen=Flugzeug, Flak=Fadenkreuz.
 */
export function buildingIcon(type: BuildingType, px = 20): string {
  return svgPx(BUILDING_PATHS[type], px)
}

export const icon = {
  /** Anker — Hafen, Kriegsschiff. */
  anchor: svg(
    '<circle cx="12" cy="5" r="2.2"/><path d="M12 7.2V21"/><path d="M8 11h8"/><path d="M5 13c0 4 3.1 7 7 7s7-3 7-7"/>',
  ),
  /** Boot/Schiff — Transportboot, Handelsschiff. */
  ship: svg(
    '<path d="M4 14h16l-2.1 5.1a1 1 0 0 1-.92.6H7.03a1 1 0 0 1-.92-.6L4 14z"/><path d="M12 14V4"/><path d="M12 5.4l5 2-5 2"/>',
  ),
  /** Schild — Verteidigung, Abwehr. */
  shield: svg('<path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z"/>'),
  /** Gekreuzte Klingen — Angriff, Krieg. */
  swords: svg(
    '<path d="M3 4l11 11"/><path d="M3 7V4h3"/><path d="M21 4L10 15"/><path d="M21 7V4h-3"/><path d="M7 16l1.5 1.5"/><path d="M17 16l-1.5 1.5"/>',
  ),
  /** Herz — Bündnis, Verbündeter, Gunst. Klares Gegenstück zum gebrochenen Herz (Verrat). */
  alliance: svg(
    '<path d="M12 20.5C7 17 3.5 13.6 3.5 9.8 3.5 7 5.6 5 8 5c1.7 0 3 1 4 2.4C13 6 14.3 5 16 5c2.4 0 4.5 2 4.5 4.8 0 3.8-3.5 7.2-8.5 10.7z"/>',
  ),
  /** Gebrochenes Herz — Verrat, Bündnis-Bruch. */
  brokenHeart: svg(
    '<path d="M12 7.5C10.6 4.7 6.5 5 5.4 8.2 4.3 11.7 8 14.6 12 17c4-2.4 7.7-5.3 6.6-8.8C17.5 5 13.4 4.7 12 7.5z"/><path d="M12 7.5l-1.6 2.6 2.4 1.6-1.6 2.6"/>',
  ),
  /** Verbots-Schild — Embargo. */
  ban: svg('<circle cx="12" cy="12" r="8"/><path d="M6.3 6.3l11.4 11.4"/>'),
  /** Waage — Diplomatie, Neutralität. */
  scales: svg(
    '<path d="M12 4v16"/><path d="M7 20h10"/><path d="M4 7h16"/><path d="M4 7l-2 5a3 3 0 0 0 6 0L6 7"/><path d="M18 7l-2 5a3 3 0 0 0 6 0l-2-5"/>',
  ),
  /** Verärgertes Gesicht — Groll. */
  grudge: svg(
    '<circle cx="12" cy="12" r="9"/><path d="M8.5 15.5c1-1.1 2.2-1.7 3.5-1.7s2.5.6 3.5 1.7"/><path d="M8 9.6l2.2 1"/><path d="M16 9.6l-2.2 1"/>',
  ),
  /** Münzstapel — Gold, Beute. */
  gold: svg(
    '<ellipse cx="12" cy="6.5" rx="7" ry="2.6"/><path d="M5 6.5v6c0 1.45 3.1 2.6 7 2.6s7-1.15 7-2.6v-6"/><path d="M5 12.5c0 1.45 3.1 2.6 7 2.6s7-1.15 7-2.6"/>',
  ),
  /** Warndreieck — Gefahr, Bedrohung. */
  warning: svg(
    '<path d="M12 3.5L2.3 20.5h19.4L12 3.5z"/><path d="M12 9.5v4.5"/><path d="M12 17.4v.2"/>',
  ),
  /** Kettenglieder — Einladungs-Link. */
  link: svg(
    '<path d="M9.5 13a3.5 3.5 0 0 0 5.2.4l2.4-2.4a3.5 3.5 0 0 0-5-5L10.7 7.4"/><path d="M14.5 11a3.5 3.5 0 0 0-5.2-.4L6.9 13a3.5 3.5 0 0 0 5 5l1.4-1.4"/>',
  ),
}
