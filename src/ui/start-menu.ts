/**
 * Menü-Typen + wiederverwendbares Formular-Toolkit.
 *
 * Früher baute diese Datei das komplette Start-Menü-Overlay (`createStartMenu`).
 * Mit dem Hauptmenü-Umbau (ADR-0014) übernimmt `menu-shell.ts` die Hülle (Header-Nav,
 * Tabs, Footer); hier bleiben nur die geteilten Typen, Style-Konstanten und die
 * Widget-Builder (Slider/Select/Text/Check-Zeilen), die die Tabs zusammensetzen.
 */

import type { BuildingType } from '../core/buildings'

export type Difficulty = 'easy' | 'normal' | 'hard'
export type MatchTempo = 'fast' | 'normal' | 'siege'
/**
 * Terrain-Auswahl: prozedural (`flat`/`continents`/`islands`) **oder** eine gebackene Geo-Karte
 * (`world`/`europe`/`africa`/`australia`, ADR-0016). Bei Geo-Karten kommt das terrain als Asset
 * (mapId), die Karten-Dimensionen werden beim Laden überschrieben.
 */
export type TerrainChoice =
  | 'flat'
  | 'continents'
  | 'islands'
  | 'world'
  | 'europe'
  | 'africa'
  | 'australia'
/**
 * Kamera-Darstellung der Torus-Welt:
 *  - `tiles`   → wie vorher: endloses Kacheln beim Rauszoomen (die Welt wiederholt sich).
 *  - `period`  → Box (nahtlos): genau eine Welt-Periode, nahtloser Wrap, kein Weiter-Rauszoomen.
 *  - `fixed`   → Box (fest): immer eine Welt-Kopie mit harten schwarzen Rändern (bleibt auch
 *                reingezoomt; kein Wrap), frei zoombar.
 *  - `dynamic` → Dynamische Box: reingezoomt nahtlos, weit rausgezoomt ganze Welt + schwarze Ränder.
 */
export type CameraMode = 'tiles' | 'period' | 'fixed' | 'dynamic'

/**
 * Opt-in „Experimentell"-Toggles. Vorerst leer — das Gerüst steht, künftige
 * Features (Wälder, Flüsse, Fische, erdähnlicher Noise …) kommen hier als
 * boolesche Flags hinein, nicht fest ins Core-Gameplay.
 */
export type ExperimentalFlags = Record<string, boolean>

export interface StartMenuValues {
  playerName: string
  /** Karten-Breite und -Höhe getrennt → beliebige Seitenverhältnisse möglich. */
  mapWidth: number
  mapHeight: number
  aiCount: number
  /** Anzahl passiver „wilder Nationen"/Barbaren (eroberbarer Puffer). */
  wildCount: number
  victoryPct: number
  difficulty: Difficulty
  tempo: MatchTempo
  terrain: TerrainChoice
  soundEnabled: boolean
  /** Kamera-Darstellung: Kacheln / feste Box / dynamische Box (siehe [[CameraMode]]). */
  cameraMode: CameraMode
  /**
   * Erlaubte Gebäudetypen im Match (default alle an). Ein deaktivierter Typ kann von niemandem
   * gebaut werden (HUD blendet aus, KI überspringt, `canBuildAt` lehnt ab). Wird als
   * `GameConfig.allowedBuildings` durchgereicht und im MP über `MatchSettings` gespiegelt.
   */
  allowedBuildings: Record<BuildingType, boolean>
  /** Flüsse ins Terrain carven (ADR-0015). Reguläres Match-Toggle (nicht mehr „experimentell"). */
  rivers: boolean
  /** Opt-in experimentelle Feature-Toggles (persistiert; vorerst Platzhalter). */
  experimental: ExperimentalFlags
  /** Optional fester Match-Seed; leer/undefined → random. */
  seed?: string
}

// Ausbreitungs-Tempo (multipliziert die Eroberungs-Rate). Unter 0.5 entsättigt sich
// die Welle (Rate < verfügbare Front-Tiles) → spürbar langsamer UND Terrain prägt die
// Gebietsform. „normal" ist der getunte Standardwert.
export const TEMPO_TO_SPEED: Record<MatchTempo, number> = {
  fast: 0.55,
  normal: 0.3,
  siege: 0.18,
}

/** Wählbare Kantenlängen für Breite/Höhe (frei kombinierbar → auch 6:1 etc.). */
export const MAP_DIM_OPTIONS = [256, 512, 768, 1024, 1536, 2048] as const

export const TERRAIN_OPTIONS: ReadonlyArray<readonly [TerrainChoice, string]> = [
  ['flat', 'Offen (kein Wasser)'],
  ['continents', 'Kontinente'],
  ['islands', 'Inseln'],
  // Geo-Karten (ADR-0016) — echte Küsten aus Geodaten, Dimensionen kommen aus dem Asset.
  ['world', 'Welt (Geo)'],
  ['europe', 'Europa (Geo)'],
  ['africa', 'Afrika (Geo)'],
  ['australia', 'Australien (Geo)'],
]

export const DIFFICULTY_OPTIONS: ReadonlyArray<readonly [Difficulty, string]> = [
  ['easy', 'Einfach'],
  ['normal', 'Normal'],
  ['hard', 'Schwer'],
]

export const CAMERA_OPTIONS: ReadonlyArray<readonly [CameraMode, string]> = [
  ['tiles', 'Kacheln (wie vorher)'],
  ['period', 'Box (nahtlos)'],
  ['fixed', 'Box (fest)'],
  ['dynamic', 'Dynamische Box'],
]

/** Akzentfarbe — passt zum Eigenleuchten/Optimum-Strich im Spiel (cyan). */
export const ACCENT = '#46d9e6'

export const FIELD_ROW_STYLE =
  'display: grid; grid-template-columns: 150px 1fr; align-items: center; gap: 14px; margin-bottom: 13px'

export const BUTTON_STYLE = [
  'margin-top: 22px',
  'width: 100%',
  'padding: 16px',
  'background: linear-gradient(180deg, #3fd0c0 0%, #2bb39c 100%)',
  'color: #07120f',
  'border: none',
  'border-radius: 8px',
  'font-size: 18px',
  'font-family: inherit',
  'letter-spacing: 0.3px',
  'cursor: pointer',
  'font-weight: bold',
  'box-shadow: 0 4px 16px rgba(63,208,192,0.3)',
  'transition: transform 0.08s, box-shadow 0.12s',
].join(';')

export const INPUT_STYLE = [
  'background: #0d0d13',
  'color: white',
  'border: 1px solid #2c2c3a',
  'border-radius: 5px',
  'padding: 9px 11px',
  'font-family: inherit',
  'font-size: 16px',
  'width: 100%',
  'box-sizing: border-box',
  'outline: none',
  'transition: border-color 0.12s',
].join(';')

export const SELECT_STYLE = INPUT_STYLE

/** Klassen-basierte Hover/Focus-Styles (inline geht nicht für :focus/:hover). */
export const MENU_CSS = `
.tl-menu input[type=text]:focus, .tl-menu select:focus { border-color: ${ACCENT}; box-shadow: 0 0 0 2px rgba(70,217,230,0.2) }
.tl-menu .tl-start:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(63,208,192,0.45) }
.tl-menu .tl-start:active { transform: translateY(0) }
.tl-menu .tl-section { margin: 20px 0 10px; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; color: ${ACCENT}; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.07); padding-top: 14px }
.tl-menu input[type=range] { accent-color: ${ACCENT} }
.tl-menu input[type=checkbox] { accent-color: ${ACCENT} }
.tl-tab { background: transparent; border: 1px solid transparent; color: rgba(255,255,255,0.7); padding: 9px 18px; border-radius: 8px; font-family: inherit; font-size: 16px; cursor: pointer; transition: color 0.12s, background 0.12s, border-color 0.12s }
.tl-tab:hover { color: white; background: rgba(255,255,255,0.06) }
.tl-tab.tl-tab-active { color: #07120f; background: ${ACCENT}; border-color: ${ACCENT}; font-weight: 700 }
`

/** Gemeinsamer Rückgabetyp der Widget-Builder: DOM-Zeile + Wert-Getter. */
export interface ValueRow<T> {
  readonly element: HTMLElement
  readonly getValue: () => T
}

/** Beschriftete Schieberegler-Zeile (Wert rechts, optional mit Suffix wie „%"). */
export function makeSliderRow(
  label: string,
  min: number,
  max: number,
  step: number,
  initialValue: number,
  suffix = '',
): ValueRow<number> {
  const row = document.createElement('div')
  row.style.cssText = FIELD_ROW_STYLE

  const labelEl = document.createElement('label')
  labelEl.textContent = label
  row.appendChild(labelEl)

  const sliderWrap = document.createElement('div')
  sliderWrap.style.cssText = 'display: flex; gap: 8px; align-items: center'

  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = String(min)
  slider.max = String(max)
  slider.step = String(step)
  slider.value = String(initialValue)
  slider.style.flex = '1'

  const valueLabel = document.createElement('span')
  valueLabel.textContent = String(initialValue) + suffix
  valueLabel.style.cssText =
    'min-width: 58px; text-align: right; font-variant-numeric: tabular-nums'

  slider.addEventListener('input', () => {
    valueLabel.textContent = slider.value + suffix
  })

  sliderWrap.appendChild(slider)
  sliderWrap.appendChild(valueLabel)
  row.appendChild(sliderWrap)

  return { element: row, getValue: () => Number(slider.value) }
}

/** Beschriftete Auswahl-Zeile (Select) über einer Optionsliste `[wert, label]`. */
export function makeSelectRow<T extends string>(
  label: string,
  options: ReadonlyArray<readonly [T, string]>,
  initial: T,
): ValueRow<T> {
  const row = document.createElement('div')
  row.style.cssText = FIELD_ROW_STYLE
  const labelEl = document.createElement('label')
  labelEl.textContent = label
  const select = document.createElement('select')
  select.style.cssText = SELECT_STYLE
  for (const [value, text] of options) {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = text
    if (value === initial) opt.selected = true
    select.appendChild(opt)
  }
  row.appendChild(labelEl)
  row.appendChild(select)
  return { element: row, getValue: () => select.value as T }
}

/** Beschriftete Textfeld-Zeile. */
export function makeTextRow(
  label: string,
  initial: string,
  opts: { placeholder?: string; maxLength?: number } = {},
): ValueRow<string> {
  const row = document.createElement('div')
  row.style.cssText = FIELD_ROW_STYLE
  const labelEl = document.createElement('label')
  labelEl.textContent = label
  const input = document.createElement('input')
  input.type = 'text'
  input.value = initial
  if (opts.placeholder !== undefined) input.placeholder = opts.placeholder
  if (opts.maxLength !== undefined) input.maxLength = opts.maxLength
  input.style.cssText = INPUT_STYLE
  row.appendChild(labelEl)
  row.appendChild(input)
  return { element: row, getValue: () => input.value.trim() }
}

/** Beschriftete Checkbox-Zeile mit an/aus-Text neben der Box. */
export function makeCheckRow(
  label: string,
  initial: boolean,
  onText: string,
  offText: string,
): ValueRow<boolean> {
  const row = document.createElement('div')
  row.style.cssText = FIELD_ROW_STYLE
  const labelEl = document.createElement('label')
  labelEl.textContent = label
  const wrap = document.createElement('label')
  wrap.style.cssText = 'display: inline-flex; align-items: center; gap: 8px; cursor: pointer'
  const check = document.createElement('input')
  check.type = 'checkbox'
  check.checked = initial
  check.style.cssText = 'width: 16px; height: 16px; cursor: pointer'
  const text = document.createElement('span')
  text.textContent = initial ? onText : offText
  check.addEventListener('change', () => {
    text.textContent = check.checked ? onText : offText
  })
  wrap.appendChild(check)
  wrap.appendChild(text)
  row.appendChild(labelEl)
  row.appendChild(wrap)
  return { element: row, getValue: () => check.checked }
}

/** Zwei nebeneinander stehende Dimensions-Selects (Breite × Höhe). */
export function makeMapRow(
  label: string,
  initialWidth: number,
  initialHeight: number,
): { element: HTMLElement; getWidth: () => number; getHeight: () => number } {
  const dimSelect = (initialVal: number): HTMLSelectElement => {
    const sel = document.createElement('select')
    sel.style.cssText = SELECT_STYLE
    for (const d of MAP_DIM_OPTIONS) {
      const opt = document.createElement('option')
      opt.value = String(d)
      opt.textContent = String(d)
      if (d === initialVal) opt.selected = true
      sel.appendChild(opt)
    }
    return sel
  }
  const row = document.createElement('div')
  row.style.cssText = FIELD_ROW_STYLE
  const labelEl = document.createElement('label')
  labelEl.textContent = label
  const widthSelect = dimSelect(initialWidth)
  const heightSelect = dimSelect(initialHeight)
  const wrap = document.createElement('div')
  wrap.style.cssText = 'display: flex; gap: 8px; align-items: center'
  const times = document.createElement('span')
  times.textContent = '×'
  times.style.opacity = '0.6'
  wrap.appendChild(widthSelect)
  wrap.appendChild(times)
  wrap.appendChild(heightSelect)
  row.appendChild(labelEl)
  row.appendChild(wrap)
  return {
    element: row,
    getWidth: () => Number(widthSelect.value),
    getHeight: () => Number(heightSelect.value),
  }
}
