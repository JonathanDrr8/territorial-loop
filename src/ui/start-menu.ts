/**
 * Start-Menü vor dem Match.
 *
 * Overlay über dem Container. Spieler stellt Match-Parameter ein (Name,
 * Kartengröße, Anzahl KI, Sieg-Bedingung) und drückt "Match starten".
 * Das Menü ruft `onStart(values)` und räumt sich anschließend nicht selbst
 * auf — der Aufrufer ist für `destroy()` zuständig.
 */

export type Difficulty = 'easy' | 'normal' | 'hard'
export type MatchTempo = 'fast' | 'normal' | 'siege'
export type TerrainChoice = 'flat' | 'continents' | 'islands'

export interface StartMenuValues {
  playerName: string
  /** Karten-Breite und -Höhe getrennt → beliebige Seitenverhältnisse möglich. */
  mapWidth: number
  mapHeight: number
  aiCount: number
  victoryPct: number
  difficulty: Difficulty
  tempo: MatchTempo
  terrain: TerrainChoice
  soundEnabled: boolean
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

export interface StartMenuApi {
  destroy(): void
}

/** Wählbare Kantenlängen für Breite/Höhe (frei kombinierbar → auch 6:1 etc.). */
const MAP_DIM_OPTIONS = [256, 512, 768, 1024, 1536, 2048] as const

/** Akzentfarbe — passt zum Eigenleuchten/Optimum-Strich im Spiel (cyan). */
const ACCENT = '#46d9e6'

const PANEL_STYLE = [
  'background: linear-gradient(160deg, #1c1f2b 0%, #14141c 100%)',
  'color: white',
  'padding: 30px 34px 26px',
  'border-radius: 14px',
  'border: 1px solid rgba(70,217,230,0.18)',
  'min-width: 420px',
  'max-width: 92vw',
  'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
  'font-size: 14px',
  'box-shadow: 0 18px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.4)',
].join(';')

const FIELD_ROW_STYLE =
  'display: grid; grid-template-columns: 130px 1fr; align-items: center; gap: 12px; margin-bottom: 11px'

const BUTTON_STYLE = [
  'margin-top: 22px',
  'width: 100%',
  'padding: 13px',
  'background: linear-gradient(180deg, #3fd0c0 0%, #2bb39c 100%)',
  'color: #07120f',
  'border: none',
  'border-radius: 8px',
  'font-size: 15px',
  'font-family: inherit',
  'letter-spacing: 0.3px',
  'cursor: pointer',
  'font-weight: bold',
  'box-shadow: 0 4px 16px rgba(63,208,192,0.3)',
  'transition: transform 0.08s, box-shadow 0.12s',
].join(';')

const INPUT_STYLE = [
  'background: #0d0d13',
  'color: white',
  'border: 1px solid #2c2c3a',
  'border-radius: 5px',
  'padding: 7px 9px',
  'font-family: inherit',
  'font-size: 14px',
  'width: 100%',
  'box-sizing: border-box',
  'outline: none',
  'transition: border-color 0.12s',
].join(';')

const SELECT_STYLE = INPUT_STYLE

/** Klassen-basierte Hover/Focus-Styles (inline geht nicht für :focus/:hover). */
const MENU_CSS = `
.tl-menu input[type=text]:focus, .tl-menu select:focus { border-color: ${ACCENT}; box-shadow: 0 0 0 2px rgba(70,217,230,0.2) }
.tl-menu .tl-start:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(63,208,192,0.45) }
.tl-menu .tl-start:active { transform: translateY(0) }
.tl-menu .tl-section { margin: 18px 0 9px; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: ${ACCENT}; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.07); padding-top: 12px }
.tl-menu input[type=range] { accent-color: ${ACCENT} }
.tl-menu input[type=checkbox] { accent-color: ${ACCENT} }
`

interface SliderRow {
  readonly element: HTMLElement
  readonly getValue: () => number
}

function makeSliderRow(
  label: string,
  min: number,
  max: number,
  step: number,
  initialValue: number,
  suffix = '',
): SliderRow {
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
    'min-width: 50px; text-align: right; font-variant-numeric: tabular-nums'

  slider.addEventListener('input', () => {
    valueLabel.textContent = slider.value + suffix
  })

  sliderWrap.appendChild(slider)
  sliderWrap.appendChild(valueLabel)
  row.appendChild(sliderWrap)

  return {
    element: row,
    getValue: () => Number(slider.value),
  }
}

export function createStartMenu(
  container: HTMLElement,
  initial: StartMenuValues,
  onStart: (values: StartMenuValues, spectator: boolean) => void,
): StartMenuApi {
  const overlay = document.createElement('div')
  overlay.style.cssText = [
    'position: absolute',
    'inset: 0',
    'background: rgba(0,0,0,0.78)',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'overflow-y: auto',
    'padding: 24px 0',
    'box-sizing: border-box',
    'z-index: 50',
    'backdrop-filter: blur(4px)',
  ].join(';')

  const styleTag = document.createElement('style')
  styleTag.textContent = MENU_CSS
  overlay.appendChild(styleTag)

  const panel = document.createElement('div')
  panel.className = 'tl-menu'
  panel.style.cssText = PANEL_STYLE

  /** Sektions-Überschrift, gruppiert die Felder darunter. */
  const section = (text: string): void => {
    const h = document.createElement('div')
    h.className = 'tl-section'
    h.textContent = text
    panel.appendChild(h)
  }

  const title = document.createElement('h1')
  title.innerHTML = `territorial-<span style="color:${ACCENT}">loop</span>`
  title.style.cssText = 'margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 0.5px'
  panel.appendChild(title)

  const subtitle = document.createElement('div')
  subtitle.textContent = 'Browser-RTS auf einer randlosen Welt'
  subtitle.style.cssText = 'opacity: 0.6; font-size: 12px; margin-bottom: 18px'
  panel.appendChild(subtitle)

  // Name field
  const nameRow = document.createElement('div')
  nameRow.style.cssText = FIELD_ROW_STYLE
  const nameLabel = document.createElement('label')
  nameLabel.textContent = 'Dein Name'
  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.value = initial.playerName
  nameInput.maxLength = 16
  nameInput.style.cssText = INPUT_STYLE
  nameRow.appendChild(nameLabel)
  nameRow.appendChild(nameInput)
  panel.appendChild(nameRow)

  // Kartengröße — Breite × Höhe getrennt wählbar (beliebige Seitenverhältnisse)
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
  const mapRow = document.createElement('div')
  mapRow.style.cssText = FIELD_ROW_STYLE
  const mapLabel = document.createElement('label')
  mapLabel.textContent = 'Karte (B × H)'
  const widthSelect = dimSelect(initial.mapWidth)
  const heightSelect = dimSelect(initial.mapHeight)
  const dimWrap = document.createElement('div')
  dimWrap.style.cssText = 'display: flex; gap: 8px; align-items: center'
  const times = document.createElement('span')
  times.textContent = '×'
  times.style.opacity = '0.6'
  dimWrap.appendChild(widthSelect)
  dimWrap.appendChild(times)
  dimWrap.appendChild(heightSelect)
  mapRow.appendChild(mapLabel)
  mapRow.appendChild(dimWrap)
  section('Welt')
  panel.appendChild(mapRow)

  // Terrain — discrete select
  const terrainRow = document.createElement('div')
  terrainRow.style.cssText = FIELD_ROW_STYLE
  const terrainLabel = document.createElement('label')
  terrainLabel.textContent = 'Karten-Typ'
  const terrainSelect = document.createElement('select')
  terrainSelect.style.cssText = SELECT_STYLE
  const TERRAIN_OPTIONS: ReadonlyArray<readonly [TerrainChoice, string]> = [
    ['flat', 'Offen (kein Wasser)'],
    ['continents', 'Kontinente'],
    ['islands', 'Inseln'],
  ]
  for (const [value, label] of TERRAIN_OPTIONS) {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = label
    if (value === initial.terrain) opt.selected = true
    terrainSelect.appendChild(opt)
  }
  terrainRow.appendChild(terrainLabel)
  terrainRow.appendChild(terrainSelect)
  panel.appendChild(terrainRow)

  // AI count
  section('Gegner')
  const aiCount = makeSliderRow('Anzahl KI', 1, 32, 1, initial.aiCount)
  panel.appendChild(aiCount.element)

  // Eroberungs-Tempo wird nicht mehr im Start-Menü gewählt — feste Balance,
  // ingame getunt. Der Wert bleibt intern (initial.tempo, Default 'normal').

  // Difficulty — discrete select
  const diffRow = document.createElement('div')
  diffRow.style.cssText = FIELD_ROW_STYLE
  const diffLabel = document.createElement('label')
  diffLabel.textContent = 'KI-Schwierigkeit'
  const diffSelect = document.createElement('select')
  diffSelect.style.cssText = SELECT_STYLE
  const DIFFICULTY_OPTIONS: ReadonlyArray<readonly [Difficulty, string]> = [
    ['easy', 'Einfach'],
    ['normal', 'Normal'],
    ['hard', 'Schwer'],
  ]
  for (const [value, label] of DIFFICULTY_OPTIONS) {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = label
    if (value === initial.difficulty) opt.selected = true
    diffSelect.appendChild(opt)
  }
  diffRow.appendChild(diffLabel)
  diffRow.appendChild(diffSelect)
  panel.appendChild(diffRow)

  // Victory %
  section('Match')
  const victory = makeSliderRow('Sieg-%', 50, 100, 5, initial.victoryPct, '%')
  panel.appendChild(victory.element)

  // Seed (optional)
  const seedRow = document.createElement('div')
  seedRow.style.cssText = FIELD_ROW_STYLE
  const seedLabel = document.createElement('label')
  seedLabel.textContent = 'Seed (optional)'
  const seedInput = document.createElement('input')
  seedInput.type = 'text'
  seedInput.value = initial.seed ?? ''
  seedInput.placeholder = 'leer = zufällig'
  seedInput.maxLength = 32
  seedInput.style.cssText = INPUT_STYLE
  seedRow.appendChild(seedLabel)
  seedRow.appendChild(seedInput)
  panel.appendChild(seedRow)

  // Sound toggle
  const soundRow = document.createElement('div')
  soundRow.style.cssText = FIELD_ROW_STYLE
  const soundLabel = document.createElement('label')
  soundLabel.textContent = 'Sound'
  const soundCheckWrap = document.createElement('label')
  soundCheckWrap.style.cssText =
    'display: inline-flex; align-items: center; gap: 8px; cursor: pointer'
  const soundCheck = document.createElement('input')
  soundCheck.type = 'checkbox'
  soundCheck.checked = initial.soundEnabled
  soundCheck.style.cssText = 'width: 16px; height: 16px; cursor: pointer'
  const soundCheckText = document.createElement('span')
  soundCheckText.textContent = 'an'
  soundCheckWrap.appendChild(soundCheck)
  soundCheckWrap.appendChild(soundCheckText)
  soundCheck.addEventListener('change', () => {
    soundCheckText.textContent = soundCheck.checked ? 'an' : 'aus'
  })
  soundRow.appendChild(soundLabel)
  soundRow.appendChild(soundCheckWrap)
  panel.appendChild(soundRow)

  // Aufklappbare Wachstums-Erklärung
  const help = document.createElement('details')
  help.style.cssText = 'margin-top: 14px; font-size: 12px; opacity: 0.85'
  const helpSummary = document.createElement('summary')
  helpSummary.textContent = 'Wie funktioniert das Truppen-Wachstum?'
  helpSummary.style.cssText = 'cursor: pointer; opacity: 0.8'
  const helpBody = document.createElement('div')
  helpBody.style.cssText = 'margin-top: 8px; line-height: 1.5; opacity: 0.8'
  helpBody.innerHTML =
    'Jede Nation hat ein <b>Truppen-Maximum</b> das mit der Anzahl deiner Tiles steigt ' +
    '(sublinear — doppelt so viel Land ≠ doppelter Cap). ' +
    'Das Wachstum pro Sekunde ist <b>nicht konstant</b>: nahe 0 Truppen wächst du langsam, ' +
    'bei mittlerem Bestand am schnellsten, und je näher am Maximum desto stärker abgebremst.<br><br>' +
    'Das <b>Optimum liegt bei ~42 % des Caps</b> — dort wächst du am schnellsten. ' +
    'Daraus folgt: Truppen für Angriffe ausgeben hält dich oft im wachstumsstarken Bereich, ' +
    'während Horten nahe am Cap das Wachstum fast zum Stillstand bringt.<br><br>' +
    '<span style="font-family:ui-monospace">Wachstum/Tick = (10 + Truppen^0.73 / 4) · (1 − Truppen/Max)</span>'
  help.appendChild(helpSummary)
  help.appendChild(helpBody)
  panel.appendChild(help)

  // Start button
  const collectValues = (): StartMenuValues => {
    const seedRaw = seedInput.value.trim()
    return {
      playerName: nameInput.value.trim() || 'Du',
      mapWidth: Number(widthSelect.value),
      mapHeight: Number(heightSelect.value),
      aiCount: aiCount.getValue(),
      victoryPct: victory.getValue(),
      difficulty: diffSelect.value as Difficulty,
      tempo: initial.tempo,
      terrain: terrainSelect.value as TerrainChoice,
      soundEnabled: soundCheck.checked,
      ...(seedRaw.length > 0 && { seed: seedRaw }),
    }
  }

  const startBtn = document.createElement('button')
  startBtn.className = 'tl-start'
  startBtn.textContent = 'Match starten'
  startBtn.style.cssText = BUTTON_STYLE
  startBtn.addEventListener('click', () => {
    onStart(collectValues(), false)
  })
  panel.appendChild(startBtn)

  // Zuschauen — startet ein Match ganz ohne menschlichen Spieler (nur KI beobachten).
  const watchBtn = document.createElement('button')
  watchBtn.textContent = 'Zuschauen'
  watchBtn.style.cssText = [
    'margin-top: 10px',
    'width: 100%',
    'padding: 10px',
    'background: transparent',
    'color: white',
    'border: 1px solid rgba(255,255,255,0.25)',
    'border-radius: 8px',
    'font-size: 13px',
    'font-family: inherit',
    'cursor: pointer',
    'opacity: 0.85',
  ].join(';')
  watchBtn.addEventListener('click', () => {
    onStart(collectValues(), true)
  })
  panel.appendChild(watchBtn)

  overlay.appendChild(panel)
  container.appendChild(overlay)

  // Auto-focus name input
  setTimeout(() => nameInput.focus(), 0)

  return {
    destroy(): void {
      overlay.remove()
    },
  }
}
