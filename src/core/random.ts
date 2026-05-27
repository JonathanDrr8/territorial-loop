/**
 * Deterministischer PRNG-Wrapper für die Game-Simulation.
 *
 * Pflicht: in Game-Logik niemals `Math.random()` — wir brauchen reproduzierbare
 * Spielsessions (Replays, Determinismus-Tests, später Multiplayer). Stattdessen
 * eine `PRNG`-Instanz aus `createPRNG(seed)` durchreichen.
 *
 * Algorithmus: Alea (über `seedrandom`-Library). Schnell, gut, von OpenFront
 * ebenfalls eingesetzt — damit gleiche statistische Eigenschaften.
 */

import seedrandom from 'seedrandom'

export interface PRNG {
  /** Float in `[0, 1)` */
  next(): number
  /** Integer in `[min, max)` (max exklusiv). `min` muss ≤ `max`. */
  nextInt(min: number, max: number): number
  /** Float in `[min, max)` */
  nextFloat(min: number, max: number): number
  /** Element aus einem Array. Wirft wenn das Array leer ist. */
  randElement<T>(arr: readonly T[]): T
  /** True mit Wahrscheinlichkeit `p` (in `[0, 1]`). */
  chance(p: number): boolean
  /** Fisher-Yates Shuffle, mutiert das Array in-place und gibt es zurück. */
  shuffleArray<T>(arr: T[]): T[]
}

/**
 * Erzeugt einen PRNG aus einem String-Seed. Gleicher Seed → gleicher Verlauf.
 */
export function createPRNG(seed: string): PRNG {
  const raw = seedrandom.alea(seed)

  return {
    next() {
      return raw()
    },

    nextInt(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max)) {
        throw new TypeError(`nextInt requires integer bounds, got ${min}, ${max}`)
      }
      if (min > max) {
        throw new RangeError(`nextInt: min ${min} > max ${max}`)
      }
      if (min === max) return min
      return min + Math.floor(raw() * (max - min))
    },

    nextFloat(min, max) {
      if (min > max) {
        throw new RangeError(`nextFloat: min ${min} > max ${max}`)
      }
      return min + raw() * (max - min)
    },

    randElement<T>(arr: readonly T[]): T {
      if (arr.length === 0) {
        throw new RangeError('randElement on empty array')
      }
      const idx = Math.floor(raw() * arr.length)
      const v = arr[idx]
      if (v === undefined) {
        // Theoretisch unerreichbar (idx ist in-range), aber TS' noUncheckedIndexedAccess
        // verlangt den Check. Lieber expliziter Throw als stiller Cast.
        throw new Error('randElement: unexpected undefined')
      }
      return v
    },

    chance(p) {
      if (p < 0 || p > 1) {
        throw new RangeError(`chance: p must be in [0, 1], got ${p}`)
      }
      return raw() < p
    },

    shuffleArray<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(raw() * (i + 1))
        const a = arr[i]
        const b = arr[j]
        if (a === undefined || b === undefined) {
          // Unerreichbar — i, j sind beide in-range. Nur für noUncheckedIndexedAccess.
          throw new Error('shuffleArray: unexpected undefined')
        }
        arr[i] = b
        arr[j] = a
      }
      return arr
    },
  }
}
