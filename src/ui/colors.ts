/**
 * Color utilities — HSL → packed RGBA, packed RGBA → CSS string, random colors.
 *
 * Color-Format intern: ein einzelner `number` mit Bytes (R,G,B,A) in High-zu-Low-
 * Reihenfolge. Vorteile: einfach zu vergleichen, gut für Spieler-IDs zu speichern,
 * direkt für den State-Buffer im Renderer brauchbar.
 */

/** HSL → RGBA-packed (R,G,B,A in 8-bit, R im höchsten Byte). */
export function hslToRgba(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  const R = Math.round((r + m) * 255)
  const G = Math.round((g + m) * 255)
  const B = Math.round((b + m) * 255)
  return ((R << 24) | (G << 16) | (B << 8) | 0xff) >>> 0
}

/** Zufällige helle, gesättigte Farbe — gut zur Spieler-Differenzierung. */
export function randomColor(): number {
  return hslToRgba(Math.random() * 360, 0.7, 0.55)
}

/** Packed RGBA → CSS `rgb(r,g,b)` String. Alpha wird nicht übernommen. */
export function rgbaToCss(rgba: number): string {
  const r = (rgba >>> 24) & 0xff
  const g = (rgba >>> 16) & 0xff
  const b = (rgba >>> 8) & 0xff
  return `rgb(${r},${g},${b})`
}
