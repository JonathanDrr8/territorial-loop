/**
 * Menü-Typen + wiederverwendbares Formular-Toolkit.
 *
 * Früher baute diese Datei das komplette Start-Menü-Overlay (`createStartMenu`).
 * Mit dem Hauptmenü-Umbau (ADR-0014) übernimmt `menu-shell.ts` die Hülle (Header-Nav,
 * Tabs, Footer); hier bleiben nur die geteilten Typen, Style-Konstanten und die
 * Widget-Builder (Slider/Select/Text/Check-Zeilen), die die Tabs zusammensetzen.
 */

import type { BuildingType } from '../core/buildings'
// KI-Schwierigkeit kommt aus dem KI-Modul (5-Stufen-Leiter, ADR-0020) — eine Quelle der Wahrheit.
import type { Difficulty } from '../ai/ai'

export type { Difficulty }
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
  /** Start-Angriffsgröße in % — initialer Wert des In-Game-Angriffs-Sliders. */
  attackPct: number
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
  /** Fluss-Häufigkeit (Multiplikator auf die Anzahl; 1 = Standard). Wirkt nur bei `rivers`. */
  riverDensity: number
  /** Opt-in experimentelle Feature-Toggles (persistiert; vorerst Platzhalter). */
  experimental: ExperimentalFlags
  /** Optional fester Match-Seed; leer/undefined → random. */
  seed?: string
  /** Hauptstadt-Modus (ADR-0026): Sieg/Niederlage über Hauptstadt-Eroberung statt Gebiets-%. */
  captureMode: boolean
  /** Team-Modus (ADR-0025): `off` = jeder gegen jeden, `allied` = Teams aus verbündeten Nationen. */
  teamMode: TeamMode
  /** Anzahl Teams (nur bei `teamMode==='allied'`). */
  teamCount: number
  /** Nationen pro Team (nur bei `teamMode==='allied'`). */
  teamSize: number
}

/**
 * Team-Modus:
 *  - `off`    → jeder gegen jeden.
 *  - `allied` → Teams aus mehreren VERBÜNDETEN Nationen (permanente Allianz), Sieg zählt zusammen.
 *  - `shared` → wie `allied`, aber jedes Team ist EINE gemeinsam gesteuerte Nation (ein Land statt
 *               mehrere). Mehrere Spieler steuern dieselbe Nation; primär ein Mehrspieler-Modus.
 */
export type TeamMode = 'off' | 'allied' | 'shared'

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

/**
 * Match-Vorgaben (Presets): kuratierte, angenehm spielbare Configs — die Kartengröße wächst mit
 * der Gegnerzahl, damit es nie gedrängt wird. Alle auf Standard-KI (ELO 1000) & 90% Sieg (der
 * vereinbarte Anker). `key` ist das i18n-Suffix (`preset.<key>`). Wird im Match-Setup UND in der
 * Mehrspieler-Lobby angeboten.
 */
export interface MatchPreset {
  readonly key: string
  readonly mapWidth: number
  readonly mapHeight: number
  readonly aiCount: number
  readonly wildCount: number
  readonly terrain: TerrainChoice
  readonly difficulty: Difficulty
  readonly victoryPct: number
}

export const MATCH_PRESETS: readonly MatchPreset[] = [
  {
    key: 'small',
    mapWidth: 768,
    mapHeight: 768,
    aiCount: 25,
    wildCount: 120,
    terrain: 'continents',
    difficulty: 'standard',
    victoryPct: 90,
  },
  {
    key: 'standard',
    mapWidth: 1024,
    mapHeight: 1024,
    aiCount: 50,
    wildCount: 300,
    terrain: 'continents',
    difficulty: 'standard',
    victoryPct: 90,
  },
  {
    key: 'large',
    mapWidth: 1536,
    mapHeight: 1536,
    aiCount: 75,
    wildCount: 480,
    terrain: 'continents',
    difficulty: 'standard',
    victoryPct: 90,
  },
  {
    key: 'chaos',
    mapWidth: 2048,
    mapHeight: 2048,
    aiCount: 150,
    wildCount: 600,
    terrain: 'continents',
    difficulty: 'standard',
    victoryPct: 90,
  },
]

export const DIFFICULTY_OPTIONS: ReadonlyArray<readonly [Difficulty, string]> = [
  ['beginner', 'Anfänger'],
  ['easy', 'Leicht'],
  ['standard', 'Standard'],
  ['advanced', 'Fortgeschritten'],
  ['expert', 'Experte'],
]

export const CAMERA_OPTIONS: ReadonlyArray<readonly [CameraMode, string]> = [
  ['tiles', 'Kacheln (wie vorher)'],
  ['period', 'Box (nahtlos)'],
  ['fixed', 'Box (fest)'],
  ['dynamic', 'Dynamische Box'],
]

/** Akzentfarbe folgt dem gewählten Theme (ADR-0024: Menü teilt das HUD-Theme, nur Optik). */
export const ACCENT = 'var(--tl-accent)'

export const FIELD_ROW_STYLE =
  'display: grid; grid-template-columns: 150px 1fr; align-items: center; gap: 14px; margin-bottom: 13px'

export const BUTTON_STYLE = [
  'margin-top: 22px',
  'width: 100%',
  'padding: 16px',
  'background: var(--tl-accent)',
  'color: #100c06',
  'border: none',
  'border-radius: var(--tl-panel-radius)',
  'font-size: 18px',
  'font-family: var(--tl-font)',
  'letter-spacing: 0.3px',
  'cursor: pointer',
  'font-weight: bold',
  'box-shadow: 0 4px 16px rgba(0,0,0,0.35)',
  'transition: transform 0.08s, box-shadow 0.12s, filter 0.12s',
].join(';')

export const INPUT_STYLE = [
  'background: rgba(0,0,0,0.35)',
  'color: var(--tl-text)',
  'border: 1px solid var(--tl-panel-border-color)',
  'border-radius: 5px',
  'padding: 9px 11px',
  'font-family: var(--tl-font)',
  'font-size: 16px',
  'width: 100%',
  'box-sizing: border-box',
  'outline: none',
  'transition: border-color 0.12s',
].join(';')

export const SELECT_STYLE = INPUT_STYLE

/** Klassen-basierte Hover/Focus-Styles (inline geht nicht für :focus/:hover). Farben aus Theme-Tokens. */
export const MENU_CSS = `
.tl-menu input[type=text]:focus, .tl-menu select:focus { border-color: var(--tl-accent); box-shadow: 0 0 0 2px rgba(255,255,255,0.16) }
.tl-menu .tl-start:hover { transform: translateY(-1px); filter: brightness(1.08); box-shadow: 0 6px 22px rgba(0,0,0,0.45) }
.tl-menu .tl-start:active { transform: translateY(0) }
.tl-menu .tl-section { margin: 20px 0 10px; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--tl-accent); opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.07); padding-top: 14px }
.tl-menu input[type=range] { accent-color: var(--tl-accent) }
.tl-menu input[type=checkbox] { accent-color: var(--tl-accent) }
.tl-tab { background: transparent; border: 1px solid transparent; color: rgba(255,255,255,0.7); padding: 9px 18px; border-radius: 8px; font-family: var(--tl-font); font-size: 16px; cursor: pointer; transition: color 0.12s, background 0.12s, border-color 0.12s }
.tl-tab:hover { color: white; background: rgba(255,255,255,0.06) }
.tl-tab.tl-tab-active { color: #100c06; background: var(--tl-accent); border-color: var(--tl-accent); font-weight: 700 }
/* Die drei Spalten (Lobby/Setup/Tipps) brauchen ~860px nebeneinander. Darunter (schmaler Desktop,
   Tablet, **Handy im Querformat**) untereinander stapeln, statt links/rechts aus dem Bild zu laufen.
   Eigener, höher liegender Breakpoint als der Header (der passt im Querformat noch in eine Zeile). */
@media (max-width: 900px) {
  .tl-menu .tl-cols { display: flex !important; flex-direction: column !important; align-items: stretch !important; gap: 14px !important }
  /* width:100% + min-width:0 lassen die Spalte auf die Bildbreite schrumpfen (statt an der
     Mindestbreite eines Kindes hängenzubleiben und rechts aus dem Bild zu laufen). max-width
     hält sie auf Tablets noch in lesbarer Breite, margin:auto zentriert. */
  .tl-menu .tl-cols > * { width: 100% !important; min-width: 0 !important; max-width: 520px !important; margin-left: auto !important; margin-right: auto !important }
}
/* Die Bottom-Navigation existiert immer im DOM, ist aber ein reines Handy-Element. */
.tl-bottomnav { display: none }
/* Schmale Screens (Handy im Hochformat): eigener App-Wurf statt geschrumpfter Desktop-Seite —
   Header-Tabs und Footer verschwinden, unten übernimmt eine feste Tab-Leiste (App-Navigation),
   Inhalte werden einspaltig mit großen Touch-Zielen (>=44px) und großem Start-CTA.
   !important schlägt die Inline-Layout-Styles. */
@media (max-width: 640px) {
  .tl-menu .tl-header { gap: 8px !important; padding: 10px 12px !important; justify-content: center }
  .tl-menu .tl-header > * { flex: 1 1 100% !important }
  .tl-menu .tl-header > div:last-child { justify-content: center !important; flex-wrap: wrap !important; gap: 8px !important }
  .tl-menu .tl-header input[type=text] { flex: 1 1 auto; width: auto !important; min-width: 0 }
  .tl-menu .tl-header label { flex: 1 1 100%; min-width: 0 }
  /* Header-Tabs + Footer raus — die Bottom-Navigation übernimmt. */
  .tl-menu .tl-nav { display: none !important }
  .tl-menu .tl-footer { display: none !important }
  .tl-bottomnav {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 70;
    display: flex; align-items: stretch;
    background: var(--tl-panel-bg);
    border-top: 1px solid rgba(255,255,255,0.14);
    padding: 0 2px calc(4px + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 -8px 24px rgba(0,0,0,0.45);
  }
  .tl-bottomtab {
    flex: 1 1 0; min-width: 0; min-height: 54px;
    display: flex; align-items: center; justify-content: center;
    background: transparent; border: none; border-top: 2px solid transparent;
    color: rgba(255,255,255,0.6); font-family: var(--tl-font);
    font-size: 12px; font-weight: 600; letter-spacing: 0.2px; cursor: pointer;
    padding: 6px 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .tl-bottomtab.tl-bottomtab-active { color: var(--tl-accent); border-top-color: var(--tl-accent); background: rgba(255,255,255,0.05) }
  /* Inhalt: volle Breite, Platz für die Bottom-Leiste, kompakte Karten. */
  .tl-menu .tl-content { padding: 12px 10px calc(76px + env(safe-area-inset-bottom, 0px)) !important }
  /* App-Reihenfolge im Play-Tab: Setup-Karte (Start-CTA) ZUERST, dann Lobbys/Tutorial, dann Tipps. */
  .tl-menu .tl-cols > *:nth-child(2) { order: -1 }
  .tl-menu .tl-card { padding: 18px 14px !important; border-radius: 12px !important; max-width: 100% !important }
  /* Großer Start-CTA + Presets als 2x2-Kacheln mit App-Touch-Zielen. */
  .tl-menu .tl-start { width: 100% !important; min-height: 56px !important; font-size: 18px !important }
  .tl-menu .tl-presets { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 10px !important }
  .tl-menu .tl-presets > button { min-height: 62px; width: auto !important }
  /* Touch-Ziele: alles Bedienbare mindestens 44px hoch. */
  .tl-menu button, .tl-menu select { min-height: 44px }
  .tl-menu input[type=text] { min-height: 42px; box-sizing: border-box }
  .tl-menu .tl-field { grid-template-columns: 1fr !important; align-items: stretch !important; gap: 6px !important; margin-bottom: 15px !important }
  .tl-menu .tl-field > label { opacity: 0.8; font-size: 14px }
}
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
  row.className = 'tl-field'

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
  row.className = 'tl-field'
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
  row.className = 'tl-field'
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
  row.className = 'tl-field'
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
  row.className = 'tl-field'
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
