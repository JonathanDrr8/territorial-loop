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
 * Wählt `count` Namen. Bis zur Pool-Größe eindeutige Zufallsnamen; werden mehr
 * verlangt (viele KI), wird mit generischen Namen ("Nation N") aufgefüllt.
 */
export function pickRandomNames(count: number): string[] {
  if (count < 0 || !Number.isInteger(count)) {
    throw new RangeError(`pickRandomNames: count must be a non-negative integer, got ${count}`)
  }
  const arr = [...POOL]
  // Fisher-Yates partial shuffle: nur so viele Slots randomisieren wie nötig
  const shuffleN = Math.min(count, arr.length)
  for (let i = 0; i < shuffleN; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i))
    const a = arr[i]
    const b = arr[j]
    if (a === undefined || b === undefined) {
      throw new Error('pickRandomNames: unexpected undefined during shuffle')
    }
    arr[i] = b
    arr[j] = a
  }
  const names = arr.slice(0, shuffleN)
  for (let n = names.length; n < count; n++) names.push(`Nation ${(n + 1).toString()}`)
  return names
}

/** Gesamtanzahl verfügbarer Namen — nützlich für UI-Konsistenz-Checks. */
export const NAME_POOL_SIZE = POOL.length
