/**
 * Deterministische Transzendenten-Mathematik (`pow`/`sin`/`cos`/`atan2`) aus **reiner
 * Arithmetik** (+ − × ÷, plus die exakten `Math.floor/round/abs`).
 *
 * Warum: `Math.sin/cos/atan2/pow` sind über JS-Engines **nicht bit-genau** (V8 ≠ SpiderMonkey
 * ≠ Node-libm), `+ − × ÷` und `Math.floor/round/abs` dagegen schon (IEEE-754 korrekt gerundet
 * bzw. exakt). Für server-autoritatives Lockstep (ADR-0009) müssen Client und Server **dieselben
 * Bits** liefern, sonst driften sie auseinander. Diese Funktionen sind die gemeinsame Definition
 * — sie müssen `libm` nicht exakt treffen, nur **überall identisch** sein (und nah genug am
 * Original, dass sich Spielgefühl/Balance praktisch nicht ändern).
 *
 * NUR diese Funktionen in Sim-Pfaden nutzen, die in den State fließen. Reines Rendering darf
 * weiter `Math.*` verwenden (nicht determinismus-relevant).
 *
 * Genauigkeit: relativer/absoluter Fehler < ~1e-9 gegenüber `Math.*` über die genutzten
 * Wertebereiche (in `tests/det-math.test.ts` abgesichert).
 */

const LN2 = 0.6931471805599453
const SQRT2 = 1.4142135623730951
const SQRT3 = 1.7320508075688772
const PI = Math.PI
const TWO_PI = 2 * PI
const HALF_PI = PI / 2
/** tan(15°) = 2 − √3 — Reduktions-Schwelle für atan. */
const TAN15 = 0.2679491924311227

/** 2^k für ganzzahliges k via exakter Verdopplung/Halbierung (deterministisch). */
function pow2i(k: number): number {
  let r = 1
  const n = Math.abs(k)
  for (let i = 0; i < n; i++) r = k >= 0 ? r * 2 : r / 2
  return r
}

/** Natürlicher Logarithmus für x > 0 (atanh-Reihe nach Mantissen-Reduktion). */
export function detLn(x: number): number {
  if (x <= 0) return x === 0 ? -Infinity : NaN
  // x = m · 2^e mit m ∈ [1, 2)
  let e = 0
  let m = x
  while (m >= 2) {
    m /= 2
    e++
  }
  while (m < 1) {
    m *= 2
    e--
  }
  // Weiter auf [1, √2) reduzieren → kleineres t, schnellere Konvergenz.
  let half = 0
  if (m > SQRT2) {
    m /= SQRT2
    half = 0.5
  }
  const t = (m - 1) / (m + 1) // t ∈ [0, ~0.172]
  const t2 = t * t
  let term = t
  let sum = 0
  for (let k = 1; k <= 15; k += 2) {
    sum += term / k
    term *= t2
  }
  return (e + half) * LN2 + 2 * sum
}

/** Exponentialfunktion (Taylor nach Reduktion y = k·ln2 + r). */
export function detExp(y: number): number {
  const k = Math.round(y / LN2)
  const r = y - k * LN2 // r ∈ [-ln2/2, ln2/2]
  let term = 1
  let sum = 1
  for (let n = 1; n <= 16; n++) {
    term *= r / n
    sum += term
  }
  return sum * pow2i(k)
}

/**
 * `x^p` für x ≥ 0, deterministisch über `exp(p · ln x)`. Sonderfälle: `0^0 = 1`, `0^p = 0`
 * (p > 0). Negatives x ist im Sim-Pfad nicht vorgesehen → `NaN`.
 */
export function detPow(x: number, p: number): number {
  if (x === 0) return p === 0 ? 1 : 0
  if (x < 0) return NaN
  if (p === 0) return 1
  return detExp(p * detLn(x))
}

/** Sinus, exakt-reduziert auf [-π/2, π/2], dann Taylor. */
export function detSin(x: number): number {
  let a = x - TWO_PI * Math.round(x / TWO_PI) // a ∈ [-π, π]
  if (a > HALF_PI) a = PI - a
  else if (a < -HALF_PI) a = -PI - a
  const a2 = a * a
  let term = a
  let sum = a
  for (let n = 1; n <= 8; n++) {
    term *= -a2 / (2 * n * (2 * n + 1))
    sum += term
  }
  return sum
}

/** Cosinus über `sin(x + π/2)`. */
export function detCos(x: number): number {
  return detSin(x + HALF_PI)
}

/** atan(z) für |z| ≤ 1 (Reduktion auf [0, tan15°], dann Taylor). */
function detAtanUnit(z: number): number {
  const sign = z < 0 ? -1 : 1
  let a = Math.abs(z)
  let offset = 0
  if (a > TAN15) {
    a = (SQRT3 * a - 1) / (SQRT3 + a) // → a ∈ (0, tan15°]
    offset = PI / 6
  }
  const a2 = a * a
  let term = a
  let sum = a
  for (let n = 1; n <= 7; n++) {
    term *= -a2
    sum += term / (2 * n + 1)
  }
  return sign * (offset + sum)
}

/** `atan2(y, x)` über die |y|≤|x|-Reduktion + Quadranten-Korrektur. */
export function detAtan2(y: number, x: number): number {
  if (x === 0 && y === 0) return 0
  const ay = Math.abs(y)
  const ax = Math.abs(x)
  let r: number
  if (ax >= ay) {
    r = detAtanUnit(y / x)
    if (x < 0) r += y >= 0 ? PI : -PI
  } else {
    r = (y >= 0 ? HALF_PI : -HALF_PI) - detAtanUnit(x / y)
  }
  return r
}
