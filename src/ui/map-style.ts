/**
 * Karten-Stil-System (rein lokale Darstellung, analog zum Theme-System in {@link ./theme.ts}).
 *
 * **Wichtig (Architektur/MP):** Das Terrain-RAUSCHEN und die Höhen sind Sim-State (deterministisch,
 * im Multiplayer für alle gleich). Ein Karten-Stil ändert NUR, WIE das Terrain gezeichnet wird —
 * Farbpalette, Relief-Stärke, Inland-Tönung, Kontur-Kanten. Das ist reine Client-Präferenz
 * (localStorage), berührt weder `core/` noch den Determinismus und ist damit multiplayer-sicher.
 *
 * Der Renderer liest beim Backen des Karten-Bitmaps den aktiven Stil ({@link getMapStyle}) und
 * abonniert {@link onMapStyleChange}, um bei einem Stil-Wechsel das Bitmap neu zu backen (live,
 * ohne Reload).
 */

/** Alle pro Stil variierbaren Terrain-Render-Parameter (RGB-Tripel + Skalare). */
export interface MapStyleParams {
  /** Terrain-Basisfarbe Ebene (Höhenstufe 0). */
  readonly plain: readonly [number, number, number]
  /** Terrain-Basisfarbe Hügel (Höhenstufe 1). */
  readonly hill: readonly [number, number, number]
  /** Terrain-Basisfarbe Berg (Höhenstufe 2). */
  readonly mountain: readonly [number, number, number]
  /** Tiefsee-Basisfarbe. */
  readonly water: readonly [number, number, number]
  /** Flachwasser-Saum (Küstenlinie). */
  readonly shallow: readonly [number, number, number]
  /** Dunkler Fels (Schatten/Senken) der unpassierbaren Gipfel. */
  readonly darkRock: readonly [number, number, number]
  /** Schneekappe (Grate/Sonnseite) der unpassierbaren Gipfel. */
  readonly snow: readonly [number, number, number]
  /** Inland-Tönung: Anteil Eigenfarbe über der Terrain-Basis (0..1). */
  readonly interiorTint: number
  /** Relief-Hangstärke pro Höhen-Differenz der Nachbarn. */
  readonly reliefLight: number
  /** Relief-Höhen-Aufhellung (Gipfel heller, Ebene dunkler). */
  readonly reliefHeight: number
  /** Untere Klemme des Relief-Multiplikators. */
  readonly reliefMin: number
  /** Obere Klemme des Relief-Multiplikators. */
  readonly reliefMax: number
  /** Multiplikator der Höhen-Konturkante an Bergen (kleiner = dunklere/klarere Kante). */
  readonly contourMountain: number
  /** Multiplikator der Höhen-Konturkante an Hügeln. */
  readonly contourHill: number
}

/** Ein Karten-Stil: i18n-Schlüssel für den Anzeigenamen + die Render-Parameter. */
export interface MapStyleDef {
  /** i18n-Key, z.B. `mapstyle.standard`. */
  readonly labelKey: string
  readonly params: MapStyleParams
}

/**
 * Die wählbaren Stile.
 *
 * `standard` MUSS bit-genau das bisherige Aussehen abbilden (gleiche Werte wie zuvor fest im
 * Renderer). `atlas` und `flat` variieren nur die zugänglichen Parameter — kein Bake-Umbau.
 */
/** „standard": bit-genau die früheren, fest im Renderer verdrahteten Werte. Auch der Fallback. */
const STANDARD_PARAMS: MapStyleParams = {
  plain: [26, 32, 28],
  hill: [58, 52, 36],
  mountain: [92, 82, 66],
  water: [24, 48, 92],
  shallow: [64, 122, 150],
  darkRock: [104, 112, 128],
  snow: [182, 190, 204],
  interiorTint: 0.2,
  reliefLight: 0.03,
  reliefHeight: 0.006,
  reliefMin: 0.6,
  reliefMax: 1.4,
  contourMountain: 0.4,
  contourHill: 0.72,
}

export const MAP_STYLES: Record<string, MapStyleDef> = {
  standard: {
    labelKey: 'mapstyle.standard',
    params: STANDARD_PARAMS,
  },
  // Landkarten-Anmutung: hellere, gedämpfte „Papier"-Flächen mit hypsometrischen Höhenfarben
  // (Tiefland grünlich → Hochland tan/braun), FLACHE Schattierung, dafür klare Konturkanten.
  atlas: {
    labelKey: 'mapstyle.atlas',
    params: {
      plain: [108, 132, 96],
      hill: [156, 142, 100],
      mountain: [150, 120, 92],
      water: [86, 124, 156],
      shallow: [140, 178, 196],
      darkRock: [142, 136, 128],
      snow: [232, 230, 224],
      interiorTint: 0.18,
      reliefLight: 0.012,
      reliefHeight: 0.003,
      reliefMin: 0.85,
      reliefMax: 1.15,
      contourMountain: 0.5,
      contourHill: 0.62,
    },
  },
  // Minimalistisch/flach: ruhige, entsättigte Farben, sehr wenig Relief, weiche Konturen.
  flat: {
    labelKey: 'mapstyle.flat',
    params: {
      plain: [44, 52, 46],
      hill: [64, 66, 56],
      mountain: [86, 84, 74],
      water: [38, 56, 78],
      shallow: [74, 104, 122],
      darkRock: [112, 114, 118],
      snow: [172, 176, 182],
      interiorTint: 0.24,
      reliefLight: 0.008,
      reliefHeight: 0.002,
      reliefMin: 0.92,
      reliefMax: 1.08,
      contourMountain: 0.66,
      contourHill: 0.82,
    },
  },
}

/** Reihenfolge der Auswahl im Menü (`[key, _label]`; Label kommt zur Laufzeit aus `t()`). */
export const MAP_STYLE_OPTIONS: ReadonlyArray<readonly [string, string]> = Object.entries(
  MAP_STYLES,
).map(([key, def]) => [key, def.labelKey] as const)

export const DEFAULT_MAP_STYLE = 'standard'
const STORAGE_KEY = 'territorial-loop:map-style:v1'

let current = DEFAULT_MAP_STYLE
const listeners = new Set<() => void>()

function loadName(): string {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v !== null && v in MAP_STYLES) return v
  } catch {
    /* ignore */
  }
  return DEFAULT_MAP_STYLE
}

// Beim Import die persistierte Wahl übernehmen (nur localStorage, kein DOM nötig).
current = loadName()

/** Aktiver Stil-Schlüssel. */
export function getMapStyleName(): string {
  return current
}

/** Render-Parameter des aktiven Stils (Renderer liest das beim Backen). */
export function getMapStyle(): MapStyleParams {
  return MAP_STYLES[current]?.params ?? STANDARD_PARAMS
}

/**
 * Stil wählen + persistieren (reine Client-Präferenz). Benachrichtigt Abonnenten
 * ({@link onMapStyleChange}) — der Renderer backt daraufhin das Terrain-Bitmap live neu.
 */
export function setMapStyle(name: string): void {
  const next = name in MAP_STYLES ? name : DEFAULT_MAP_STYLE
  if (next === current) return
  current = next
  try {
    window.localStorage.setItem(STORAGE_KEY, current)
  } catch {
    /* ignore */
  }
  for (const cb of listeners) cb()
}

/**
 * Auf Stil-Wechsel reagieren (z.B. Renderer → Bitmap neu backen). Gibt eine Abmelde-Funktion
 * zurück.
 */
export function onMapStyleChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
