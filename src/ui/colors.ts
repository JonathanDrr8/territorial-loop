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

/**
 * Wählt `count` gleichmäßig im Farbring verteilte Hues (mit zufälliger Start-Phase)
 * und liefert daraus packed-RGBA-Werte. So sind Spielerfarben pro Match maximal
 * voneinander unterscheidbar — keine "ist das jetzt rot oder doch braun-rot?"-
 * Verwechslungen.
 *
 * Saturation und Lightness sind leicht variabel um auch bei vielen Spielern
 * Differenzierung zu erhalten.
 */
export function pickDistinctColors(count: number): number[] {
  if (count <= 0) return []
  const startHue = Math.random() * 360
  const step = 360 / count
  const colors: number[] = []
  for (let i = 0; i < count; i++) {
    const hue = (startHue + i * step) % 360
    // Kleine Variation in S/L damit benachbarte Spieler im Farbring nicht nur
    // im Hue, sondern auch in Helligkeit/Sättigung leicht unterscheidbar sind.
    const sat = 0.65 + (i % 2) * 0.1 // 0.65 oder 0.75
    const light = 0.52 + (i % 3) * 0.04 // 0.52, 0.56, 0.60
    colors.push(hslToRgba(hue, sat, light))
  }
  // Shuffle so adjacent player slots aren't always adjacent in the color wheel
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = colors[i]
    const swap = colors[j]
    if (tmp !== undefined && swap !== undefined) {
      colors[i] = swap
      colors[j] = tmp
    }
  }
  return colors
}

/** Packed RGBA → CSS `rgb(r,g,b)` String. Alpha wird nicht übernommen. */
export function rgbaToCss(rgba: number): string {
  const r = (rgba >>> 24) & 0xff
  const g = (rgba >>> 16) & 0xff
  const b = (rgba >>> 8) & 0xff
  return `rgb(${r},${g},${b})`
}
