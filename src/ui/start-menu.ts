/**
 * Start-Menü vor dem Match.
 *
 * Overlay über dem Container. Spieler stellt Match-Parameter ein (Name,
 * Kartengröße, Anzahl KI, Sieg-Bedingung) und drückt "Match starten".
 * Das Menü ruft `onStart(values)` und räumt sich anschließend nicht selbst
 * auf — der Aufrufer ist für `destroy()` zuständig.
 */

export interface StartMenuValues {
  playerName: string
  mapSize: number
  aiCount: number
  victoryPct: number
}

export interface StartMenuApi {
  destroy(): void
}

const MAP_SIZE_OPTIONS = [128, 256, 512] as const

const PANEL_STYLE = [
  'background: #1a1a22',
  'color: white',
  'padding: 28px 32px',
  'border-radius: 10px',
  'min-width: 380px',
  'max-width: 90vw',
  'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
  'font-size: 14px',
  'box-shadow: 0 8px 40px rgba(0,0,0,0.6)',
].join(';')

const FIELD_ROW_STYLE =
  'display: grid; grid-template-columns: 130px 1fr; align-items: center; gap: 12px; margin-bottom: 12px'

const BUTTON_STYLE = [
  'margin-top: 16px',
  'width: 100%',
  'padding: 12px',
  'background: #4a8',
  'color: white',
  'border: none',
  'border-radius: 6px',
  'font-size: 15px',
  'font-family: inherit',
  'cursor: pointer',
  'font-weight: bold',
].join(';')

const INPUT_STYLE = [
  'background: #0e0e14',
  'color: white',
  'border: 1px solid #2a2a35',
  'border-radius: 4px',
  'padding: 6px 8px',
  'font-family: inherit',
  'font-size: 14px',
  'width: 100%',
  'box-sizing: border-box',
].join(';')

const SELECT_STYLE = INPUT_STYLE

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
  onStart: (values: StartMenuValues) => void,
): StartMenuApi {
  const overlay = document.createElement('div')
  overlay.style.cssText = [
    'position: absolute',
    'inset: 0',
    'background: rgba(0,0,0,0.78)',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'z-index: 50',
    'backdrop-filter: blur(4px)',
  ].join(';')

  const panel = document.createElement('div')
  panel.style.cssText = PANEL_STYLE

  const title = document.createElement('h1')
  title.textContent = 'territorial-loop'
  title.style.cssText = 'margin: 0; font-size: 24px'
  panel.appendChild(title)

  const subtitle = document.createElement('div')
  subtitle.textContent = 'Browser-RTS auf einer randlosen Welt'
  subtitle.style.cssText = 'opacity: 0.65; font-size: 12px; margin-bottom: 24px'
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

  // Map size — discrete select
  const mapRow = document.createElement('div')
  mapRow.style.cssText = FIELD_ROW_STYLE
  const mapLabel = document.createElement('label')
  mapLabel.textContent = 'Kartengröße'
  const mapSelect = document.createElement('select')
  mapSelect.style.cssText = SELECT_STYLE
  for (const size of MAP_SIZE_OPTIONS) {
    const opt = document.createElement('option')
    opt.value = String(size)
    opt.textContent = `${size} × ${size}`
    if (size === initial.mapSize) opt.selected = true
    mapSelect.appendChild(opt)
  }
  mapRow.appendChild(mapLabel)
  mapRow.appendChild(mapSelect)
  panel.appendChild(mapRow)

  // AI count
  const aiCount = makeSliderRow('Anzahl KI', 1, 7, 1, initial.aiCount)
  panel.appendChild(aiCount.element)

  // Victory %
  const victory = makeSliderRow('Sieg-%', 50, 100, 5, initial.victoryPct, '%')
  panel.appendChild(victory.element)

  // Start button
  const startBtn = document.createElement('button')
  startBtn.textContent = 'Match starten'
  startBtn.style.cssText = BUTTON_STYLE
  startBtn.addEventListener('mouseenter', () => {
    startBtn.style.background = '#5b9'
  })
  startBtn.addEventListener('mouseleave', () => {
    startBtn.style.background = '#4a8'
  })
  startBtn.addEventListener('click', () => {
    onStart({
      playerName: nameInput.value.trim() || 'Du',
      mapSize: Number(mapSelect.value),
      aiCount: aiCount.getValue(),
      victoryPct: victory.getValue(),
    })
  })
  panel.appendChild(startBtn)

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
