/**
 * Namen-Pool für KI-Spieler.
 *
 * Beim Match-Start werden zufällig N Namen ausgewählt (ohne Doppelte). Die
 * Auswahl läuft über `Math.random()` — der Sim-PRNG bleibt davon unberührt,
 * weil Namen rein kosmetisch sind und keinen Spielablauf beeinflussen.
 *
 * Die Namen sind kuratiert bunt — kurze 1-Wort-Namen aus verschiedenen
 * Kulturkreisen, geschlechtsoffen, "Commander"-Atmosphäre.
 */

const POOL: readonly string[] = [
  'Cassius',
  'Lysandra',
  'Cyrus',
  'Tariq',
  'Yuki',
  'Bjorn',
  'Imhotep',
  'Helga',
  'Drogon',
  'Nikita',
  'Astrid',
  'Wendell',
  'Kano',
  'Sven',
  'Mara',
  'Rasmus',
  'Indira',
  'Kael',
  'Soren',
  'Nadia',
  'Theo',
  'Wren',
  'Felix',
  'Lyra',
  'Asa',
  'Ezra',
  'Iris',
  'Jules',
  'Quinn',
  'Ren',
  'Sage',
  'Tycho',
  'Vance',
  'Wynn',
  'Xavi',
  'Yara',
  'Zara',
  'Oren',
  'Pyre',
  'Mira',
  'Aldric',
  'Belen',
  'Cato',
  'Doran',
  'Eyra',
  'Floki',
  'Gunnar',
  'Hilde',
]

/**
 * Wählt `count` eindeutige Namen aus dem Pool. Wirft wenn mehr Namen verlangt
 * werden als der Pool hergibt.
 */
export function pickRandomNames(count: number): string[] {
  if (count < 0 || !Number.isInteger(count)) {
    throw new RangeError(`pickRandomNames: count must be a non-negative integer, got ${count}`)
  }
  if (count > POOL.length) {
    throw new RangeError(`pickRandomNames: pool has ${POOL.length} names, ${count} requested`)
  }
  // Fisher-Yates partial shuffle: nur die ersten `count` Slots randomisieren
  const arr = [...POOL]
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i))
    const a = arr[i]
    const b = arr[j]
    if (a === undefined || b === undefined) {
      throw new Error('pickRandomNames: unexpected undefined during shuffle')
    }
    arr[i] = b
    arr[j] = a
  }
  return arr.slice(0, count)
}

/** Gesamtanzahl verfügbarer Namen — nützlich für UI-Konsistenz-Checks. */
export const NAME_POOL_SIZE = POOL.length
