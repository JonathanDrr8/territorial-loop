/**
 * Torus-Koordinaten und Wrap-Math.
 *
 * Pflicht-Layer für jede Koordinaten-Operation auf der Spielwelt — die Welt
 * loopt auf beiden Achsen, rohe `x + dx`-Arithmetik wäre falsch.
 *
 * Performance: alle Funktionen sind pure und cheap. TileRef ist ein flacher
 * Integer-Index (`y * width + x`), passt in V8-SMI, kein Boxing.
 */

/** Flacher Integer-Index in die Map-Arrays: `ref = y * width + x`. */
export type TileRef = number

/**
 * Wrap einer Koordinate in den Bereich `[0, dim)`.
 *
 * Funktioniert für negative Werte und Werte ≥ dim. Implementierung:
 * `((v % dim) + dim) % dim` — robuster als naives `% dim`, da JS-Modulo bei
 * negativen Werten negativ bleibt.
 */
export function wrap(v: number, dim: number): number {
  return ((v % dim) + dim) % dim
}

/**
 * Erzeugt einen TileRef aus (x, y). Wrappt automatisch — `tileRef(-1, 0, 10, 10)`
 * ergibt den TileRef für `(9, 0)`.
 */
export function tileRef(x: number, y: number, w: number, h: number): TileRef {
  return wrap(y, h) * w + wrap(x, w)
}

/**
 * Umkehrung von `tileRef`: extrahiert `(x, y)` aus einem flachen Index.
 *
 * Caller-Verantwortung: `ref` muss im gültigen Bereich `[0, w*h)` liegen.
 * `tileRef()` garantiert das.
 */
export function tileXY(ref: TileRef, w: number): readonly [number, number] {
  const y = Math.floor(ref / w)
  const x = ref - y * w
  return [x, y]
}

/**
 * Kürzeste Distanz zwischen zwei Punkten auf dem Torus.
 *
 * Auf einer randlosen Karte ist die euklidische Distanz falsch: der Punkt
 * `(0, 0)` ist nicht weit weg von `(w-1, h-1)`, sondern ein Schritt diagonal.
 * Wir berechnen pro Achse `min(|dx|, w - |dx|)`.
 *
 * Coords werden vor der Berechnung gewrappt, falls sie außerhalb `[0, dim)` liegen.
 */
export function torusDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  w: number,
  h: number,
): number {
  const dx0 = Math.abs(wrap(ax, w) - wrap(bx, w))
  const dy0 = Math.abs(wrap(ay, h) - wrap(by, h))
  const dx = Math.min(dx0, w - dx0)
  const dy = Math.min(dy0, h - dy0)
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Die 4 orthogonalen Nachbarn eines Tiles (N, E, S, W) — alle wrap-aware.
 * Reihenfolge ist deterministisch (wichtig für Determinismus): E, W, S, N.
 */
export function neighbors4(ref: TileRef, w: number, h: number): readonly TileRef[] {
  const [x, y] = tileXY(ref, w)
  return [
    tileRef(x + 1, y, w, h),
    tileRef(x - 1, y, w, h),
    tileRef(x, y + 1, w, h),
    tileRef(x, y - 1, w, h),
  ]
}

/**
 * Die 8 Nachbarn eines Tiles (orthogonal + diagonal) — alle wrap-aware.
 * Reihenfolge deterministisch: erst die 4 orthogonalen, dann die 4 Diagonalen.
 */
export function neighbors8(ref: TileRef, w: number, h: number): readonly TileRef[] {
  const [x, y] = tileXY(ref, w)
  return [
    tileRef(x + 1, y, w, h),
    tileRef(x - 1, y, w, h),
    tileRef(x, y + 1, w, h),
    tileRef(x, y - 1, w, h),
    tileRef(x + 1, y + 1, w, h),
    tileRef(x + 1, y - 1, w, h),
    tileRef(x - 1, y + 1, w, h),
    tileRef(x - 1, y - 1, w, h),
  ]
}
