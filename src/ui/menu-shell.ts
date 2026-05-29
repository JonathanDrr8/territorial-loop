/**
 * Haupt­menü-Shell (ADR-0014).
 *
 * Löst das alte einspaltige Start-Menü ab: ein Overlay mit fester Hülle —
 * Header (Logo + Version, Kategorie-Tabs, Name-Feld, Sprach-Umschalter), wechselndem
 * Inhaltsbereich je Tab und Footer (Links + Version). Reines Vanilla-DOM (Projekt-Konvention).
 *
 * Die Tab-Inhalte setzen sich aus dem Formular-Toolkit (`start-menu.ts`) und bestehenden
 * Bausteinen (`lobby-browser.ts`, Mehrspieler-Dialog via Callback) zusammen — Logik bleibt
 * unangetastet, neu ist nur die Anordnung. Texte laufen über `t()` (de/en); ein Sprachwechsel
 * baut die Shell mit den aktuellen Werten neu auf (Tab + Feldstände bleiben erhalten).
 */

import { getLocale, onLocaleChange, setLocale, t, type Locale } from '../i18n'
import { createLobbyBrowser, type LobbyBrowserApi } from './lobby-browser'
import { generateMenuBackground } from './menu-background'
import changelogRaw from '../../CHANGELOG.md?raw'
import {
  ACCENT,
  BUTTON_STYLE,
  CAMERA_OPTIONS,
  DIFFICULTY_OPTIONS,
  INPUT_STYLE,
  makeMapRow,
  makeSelectRow,
  makeSliderRow,
  makeTextRow,
  MENU_CSS,
  SELECT_STYLE,
  TERRAIN_OPTIONS,
  type CameraMode,
  type Difficulty,
  type StartMenuValues,
  type TerrainChoice,
} from './start-menu'

export interface MenuShellApi {
  destroy(): void
  /** Zeigt den „Wieder verbinden"-Banner (nachträglich, nach der Rejoinable-Prüfung in main.ts). */
  showReconnect(room: string, onReconnect: () => void): void
}

export interface MenuShellCallbacks {
  /** „Match starten" / „Zuschauen" (spectator=true). Aufrufer ist für destroy() zuständig. */
  onStart(values: StartMenuValues, spectator: boolean): void
  /** Öffnet den vollen Mehrspieler-Dialog (Lobby erstellen / per Code beitreten). */
  onMultiplayer(values: StartMenuValues): void
  /** Klick auf eine offene Lobby im Browser → direkt beitreten. */
  onJoinLobby(code: string, values: StartMenuValues): void
  /** Klick auf ein laufendes Spiel im Browser → als Zuschauer beitreten. */
  onSpectate(code: string): void
  /** Footer-Eintrag „Feedback" → öffnet den Feedback-/Bug-Dialog. */
  onFeedback?(): void
}

type TabId = 'play' | 'multiplayer' | 'settings' | 'changelog' | 'help'

const TABS: ReadonlyArray<readonly [TabId, string]> = [
  ['play', 'nav.play'],
  ['multiplayer', 'nav.multiplayer'],
  ['settings', 'nav.settings'],
  ['changelog', 'nav.changelog'],
  ['help', 'nav.help'],
]

/**
 * Dämpfung des Karten-Backdrops (Feel-Entscheidung „sehr dezent", ADR-0014). Hier zentral
 * justierbar: niedrigere Opazität / dunklere Helligkeit / dichteres Veil = schemenhafter.
 */
const BG_BLUR_PX = 2
const BG_BRIGHTNESS = 0.5
const BG_SATURATE = 0.65
const BG_OPACITY = 0.4
const BG_VEIL =
  'radial-gradient(115% 95% at 50% 38%, rgba(12,12,18,0.32) 0%, rgba(8,8,13,0.84) 100%)'

/** Übersetzt eine Options-Liste `[wert, _]` per Key-Schema `prefix.wert` über `t()`. */
function translatedOptions<T extends string>(
  values: ReadonlyArray<readonly [T, string]>,
  prefix: string,
): ReadonlyArray<readonly [T, string]> {
  return values.map(([v]) => [v, t(`${prefix}.${v}`)] as const)
}

export function createMenuShell(
  container: HTMLElement,
  initial: StartMenuValues,
  callbacks: MenuShellCallbacks,
  /** Server-URL (ws://…) für den Lobby-Browser; ohne sie wird er nicht gezeigt. */
  serverUrl?: string,
): MenuShellApi {
  // Über Rerender (Sprachwechsel) hinweg erhaltener Zustand.
  let values: StartMenuValues = { ...initial }
  let activeTab: TabId = 'play'
  let reconnect: { room: string; onReconnect: () => void } | null = null

  // Karten-Backdrop einmal pro Menü-Öffnung generieren (gleich über alle Tab-Wechsel hinweg).
  const bgDataUrl = generateMenuBackground()

  let overlay: HTMLDivElement | null = null
  let lobbyBrowser: LobbyBrowserApi | null = null
  let bannerSlot: HTMLDivElement | null = null

  const teardown = (): void => {
    lobbyBrowser?.destroy()
    lobbyBrowser = null
    overlay?.remove()
    overlay = null
    bannerSlot = null
  }

  function render(): void {
    teardown()

    overlay = document.createElement('div')
    overlay.className = 'tl-menu'
    overlay.style.cssText = [
      'position: absolute',
      'inset: 0',
      'display: flex',
      'flex-direction: column',
      'background: radial-gradient(120% 120% at 50% 0%, #1a1d28 0%, #0c0c12 70%)',
      'color: white',
      'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
      'font-size: 14px',
      'z-index: 50',
      'overflow: hidden',
    ].join(';')

    const style = document.createElement('style')
    style.textContent = MENU_CSS
    overlay.appendChild(style)

    // Karten-Backdrop (gedämpft) + dunkles Veil/Vignette darüber — beide klick-transparent,
    // liegen hinter Header/Inhalt/Footer (die folgen im DOM und werden darüber gemalt).
    if (bgDataUrl !== null) {
      const bg = document.createElement('div')
      bg.style.cssText = [
        'position: absolute',
        'inset: 0',
        'pointer-events: none',
        // z-index < 0 → hinter den (nicht-positionierten) Inhalt; sonst malen positionierte
        // Geschwister ÜBER Leisten/Inhalt und das Veil würde alles wieder zudecken.
        'z-index: -1',
        `background-image: url(${bgDataUrl})`,
        'background-size: cover',
        'background-position: center',
        `filter: blur(${BG_BLUR_PX}px) brightness(${BG_BRIGHTNESS}) saturate(${BG_SATURATE})`,
        `opacity: ${BG_OPACITY}`,
      ].join(';')
      overlay.appendChild(bg)
      const veil = document.createElement('div')
      veil.style.cssText = [
        'position: absolute',
        'inset: 0',
        'pointer-events: none',
        'z-index: -1',
        `background: ${BG_VEIL}`,
      ].join(';')
      overlay.appendChild(veil)
    }

    overlay.appendChild(buildHeader())

    // Scrollbarer Inhaltsbereich (Banner + aktiver Tab).
    const contentScroll = document.createElement('div')
    contentScroll.style.cssText =
      'flex: 1; overflow-y: auto; display: flex; flex-direction: column; align-items: center; padding: 28px 20px'

    bannerSlot = document.createElement('div')
    bannerSlot.style.cssText =
      'width: 100%; display: flex; justify-content: center; margin-bottom: 8px'
    contentScroll.appendChild(bannerSlot)

    const tabContent = document.createElement('div')
    tabContent.style.cssText =
      'width: 100%; max-width: 1100px; display: flex; justify-content: center'
    tabContent.appendChild(buildTab(activeTab))
    contentScroll.appendChild(tabContent)

    overlay.appendChild(contentScroll)
    overlay.appendChild(buildFooter())

    container.appendChild(overlay)
    updateBanner()
  }

  // ── Header ──────────────────────────────────────────────────────────────────
  function buildHeader(): HTMLElement {
    const header = document.createElement('div')
    header.style.cssText = [
      'display: flex',
      'align-items: center',
      'gap: 20px',
      'padding: 14px 24px',
      'border-bottom: 1px solid rgba(255,255,255,0.08)',
      'background: #11131b',
      'flex-wrap: wrap',
    ].join(';')

    // Logo + Version
    const brand = document.createElement('div')
    brand.style.cssText = 'display: flex; flex-direction: column; line-height: 1.1'
    const title = document.createElement('div')
    title.innerHTML = `territorial-<span style="color:${ACCENT}">loop</span>`
    title.style.cssText = 'font-size: 20px; font-weight: bold; letter-spacing: 0.5px'
    const version = document.createElement('div')
    version.textContent = `v${__APP_VERSION__}`
    version.style.cssText = 'font-size: 11px; opacity: 0.5'
    brand.appendChild(title)
    brand.appendChild(version)
    header.appendChild(brand)

    // Tabs (mittig, nimmt den freien Platz)
    const nav = document.createElement('nav')
    nav.style.cssText = 'flex: 1; display: flex; gap: 6px; justify-content: center; flex-wrap: wrap'
    for (const [id, labelKey] of TABS) {
      const btn = document.createElement('button')
      btn.className = id === activeTab ? 'tl-tab tl-tab-active' : 'tl-tab'
      btn.textContent = t(labelKey)
      btn.addEventListener('click', () => {
        if (activeTab === id) return
        activeTab = id
        render()
      })
      nav.appendChild(btn)
    }
    header.appendChild(nav)

    // Name + Sprache (rechts)
    const right = document.createElement('div')
    right.style.cssText = 'display: flex; align-items: center; gap: 12px'

    const nameWrap = document.createElement('label')
    nameWrap.style.cssText =
      'display: flex; align-items: center; gap: 8px; font-size: 12px; opacity: 0.85'
    nameWrap.appendChild(document.createTextNode(t('header.name')))
    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.value = values.playerName
    nameInput.maxLength = 16
    nameInput.placeholder = t('header.namePlaceholder')
    nameInput.style.cssText = INPUT_STYLE + ';width: 140px'
    nameInput.addEventListener('input', () => {
      values = { ...values, playerName: nameInput.value.trim() || values.playerName }
    })
    nameGetter = (): string => nameInput.value.trim() || values.playerName
    nameWrap.appendChild(nameInput)
    right.appendChild(nameWrap)

    const langSelect = document.createElement('select')
    langSelect.style.cssText = SELECT_STYLE + ';width: auto'
    langSelect.title = t('lang.label')
    for (const [code, label] of [
      ['de', 'DE'],
      ['en', 'EN'],
    ] as const) {
      const opt = document.createElement('option')
      opt.value = code
      opt.textContent = label
      if (code === getLocale()) opt.selected = true
      langSelect.appendChild(opt)
    }
    langSelect.addEventListener('change', () => {
      // captureValues() vor dem Wechsel, damit Feldstände erhalten bleiben (setLocale → onLocaleChange → render).
      captureValues()
      setLocale(langSelect.value as Locale)
    })
    right.appendChild(langSelect)

    header.appendChild(right)
    return header
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  function buildFooter(): HTMLElement {
    const footer = document.createElement('div')
    footer.style.cssText = [
      'display: flex',
      'align-items: center',
      'justify-content: space-between',
      'gap: 16px',
      'padding: 10px 24px',
      'border-top: 1px solid rgba(255,255,255,0.08)',
      'background: #11131b',
      'font-size: 12px',
      'opacity: 0.7',
      'flex-wrap: wrap',
    ].join(';')

    const left = document.createElement('div')
    left.style.cssText = 'display: flex; gap: 16px; align-items: center'
    const gh = document.createElement('a')
    gh.textContent = t('footer.sourcecode')
    gh.href = 'https://github.com/JonathanDrr8/territorial-loop'
    gh.target = '_blank'
    gh.rel = 'noopener'
    gh.style.cssText = `color: ${ACCENT}; text-decoration: none`
    left.appendChild(gh)
    if (callbacks.onFeedback !== undefined) {
      const fb = document.createElement('button')
      fb.textContent = `🐞 ${t('footer.feedback')}`
      fb.style.cssText = [
        'background: transparent',
        `color: ${ACCENT}`,
        'border: none',
        'padding: 0',
        'font-family: inherit',
        'font-size: 12px',
        'cursor: pointer',
      ].join(';')
      fb.addEventListener('click', () => callbacks.onFeedback?.())
      left.appendChild(fb)
    }
    footer.appendChild(left)

    const right = document.createElement('div')
    right.textContent = `v${__APP_VERSION__} · 2026`
    footer.appendChild(right)
    return footer
  }

  // ── Tab-Inhalte ───────────────────────────────────────────────────────────────
  /** Karten-Panel mit dezenter Rahmung — gemeinsame Hülle für die Tab-Inhalte. */
  function panel(): HTMLDivElement {
    const p = document.createElement('div')
    p.style.cssText = [
      'background: linear-gradient(160deg, #1c1f2b 0%, #14141c 100%)',
      'border: 1px solid rgba(70,217,230,0.18)',
      'border-radius: 14px',
      'padding: 26px 30px',
      'width: 100%',
      'max-width: 560px',
      'box-sizing: border-box',
      'box-shadow: 0 18px 60px rgba(0,0,0,0.5)',
    ].join(';')
    return p
  }

  function section(parent: HTMLElement, label: string): void {
    const h = document.createElement('div')
    h.className = 'tl-section'
    h.textContent = label
    parent.appendChild(h)
  }

  /** Erzeugt den Lobby-Browser (offene Lobbys + laufende Spiele) und merkt ihn für teardown. */
  function mountLobbyBrowser(): HTMLElement | null {
    if (serverUrl === undefined) return null
    lobbyBrowser = createLobbyBrowser(serverUrl, {
      onJoin: (code) => callbacks.onJoinLobby(code, collect()),
      onSpectate: (code) => callbacks.onSpectate(code),
    })
    return lobbyBrowser.element
  }

  function buildTab(id: TabId): HTMLElement {
    switch (id) {
      case 'play':
        return buildPlayTab()
      case 'multiplayer':
        return buildMultiplayerTab()
      case 'settings':
        return buildSettingsTab()
      case 'changelog':
        return buildChangelogTab()
      case 'help':
        return buildHelpTab()
    }
  }

  // Feld-Getter werden pro Render gesetzt; collect()/captureValues() lesen sie aus.
  let nameGetter: () => string = () => values.playerName
  let playFields: {
    mapW: () => number
    mapH: () => number
    ai: () => number
    wild: () => number
    victory: () => number
    difficulty: () => Difficulty
    terrain: () => TerrainChoice
  } | null = null
  let settingsFields: { camera: () => CameraMode; sound: () => boolean } | null = null
  let seedGetter: () => string = () => values.seed ?? ''

  function collect(): StartMenuValues {
    const seed = seedGetter().trim()
    const out: StartMenuValues = {
      playerName: nameGetter(),
      mapWidth: playFields?.mapW() ?? values.mapWidth,
      mapHeight: playFields?.mapH() ?? values.mapHeight,
      aiCount: playFields?.ai() ?? values.aiCount,
      wildCount: playFields?.wild() ?? values.wildCount,
      victoryPct: playFields?.victory() ?? values.victoryPct,
      difficulty: playFields?.difficulty() ?? values.difficulty,
      tempo: values.tempo,
      terrain: playFields?.terrain() ?? values.terrain,
      soundEnabled: settingsFields?.sound() ?? values.soundEnabled,
      cameraMode: settingsFields?.camera() ?? values.cameraMode,
      experimental: { ...values.experimental },
      ...(seed.length > 0 && { seed }),
    }
    return out
  }

  /** Aktuelle Feldstände in `values` sichern (vor Rerender/Tab-Wechsel). */
  function captureValues(): void {
    values = collect()
  }

  function buildPlayTab(): HTMLElement {
    const p = panel()

    section(p, t('section.world'))
    const map = makeMapRow(t('field.map'), values.mapWidth, values.mapHeight)
    p.appendChild(map.element)
    const terrain = makeSelectRow<TerrainChoice>(
      t('field.terrain'),
      translatedOptions(TERRAIN_OPTIONS, 'terrain'),
      values.terrain,
    )
    p.appendChild(terrain.element)

    section(p, t('section.opponents'))
    const ai = makeSliderRow(t('field.aiCount'), 1, 200, 1, values.aiCount)
    p.appendChild(ai.element)
    const wild = makeSliderRow(t('field.wildCount'), 0, 400, 1, values.wildCount)
    p.appendChild(wild.element)
    const difficulty = makeSelectRow<Difficulty>(
      t('field.difficulty'),
      translatedOptions(DIFFICULTY_OPTIONS, 'difficulty'),
      values.difficulty,
    )
    p.appendChild(difficulty.element)

    section(p, t('section.match'))
    const victory = makeSliderRow(t('field.victory'), 50, 100, 5, values.victoryPct, '%')
    p.appendChild(victory.element)
    const seed = makeTextRow(t('field.seed'), values.seed ?? '', {
      placeholder: t('field.seedPlaceholder'),
      maxLength: 32,
    })
    p.appendChild(seed.element)

    playFields = {
      mapW: map.getWidth,
      mapH: map.getHeight,
      ai: ai.getValue,
      wild: wild.getValue,
      victory: victory.getValue,
      difficulty: difficulty.getValue,
      terrain: terrain.getValue,
    }
    seedGetter = seed.getValue

    const startBtn = document.createElement('button')
    startBtn.className = 'tl-start'
    startBtn.textContent = t('play.start')
    startBtn.style.cssText = BUTTON_STYLE
    startBtn.addEventListener('click', () => callbacks.onStart(collect(), false))
    p.appendChild(startBtn)

    const watchBtn = document.createElement('button')
    watchBtn.textContent = t('play.spectate')
    watchBtn.style.cssText = secondaryButtonStyle()
    watchBtn.addEventListener('click', () => callbacks.onStart(collect(), true))
    p.appendChild(watchBtn)

    // Lobby-Browser als linke Spalte → belebter. 3-Spalten-Raster (1fr auto 1fr) mit leerem
    // Spacer rechts hält das Setup-Panel echt mittig (sonst säße es rechts der Mitte).
    const browser = mountLobbyBrowser()
    if (browser === null) return p
    const row = document.createElement('div')
    row.style.cssText =
      'display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: start; width: 100%'
    const leftCol = document.createElement('div')
    leftCol.style.cssText = 'justify-self: end; width: 230px; max-width: 100%'
    leftCol.appendChild(browser)
    row.appendChild(leftCol)
    row.appendChild(p)
    row.appendChild(document.createElement('div')) // Spacer rechts (Symmetrie)
    return row
  }

  function buildSettingsTab(): HTMLElement {
    const p = panel()

    const intro = document.createElement('div')
    intro.textContent = t('settings.intro')
    intro.style.cssText = 'opacity: 0.65; font-size: 13px; margin-bottom: 6px; line-height: 1.5'
    p.appendChild(intro)

    section(p, t('settings.display'))
    const camera = makeSelectRow<CameraMode>(
      t('field.camera'),
      translatedOptions(CAMERA_OPTIONS, 'camera'),
      values.cameraMode,
    )
    p.appendChild(camera.element)

    // Sound als Select-freie Checkbox-Zeile (an/aus aus t()).
    const soundRow = document.createElement('div')
    soundRow.style.cssText =
      'display: grid; grid-template-columns: 130px 1fr; align-items: center; gap: 12px; margin-bottom: 11px'
    const soundLabel = document.createElement('label')
    soundLabel.textContent = t('field.sound')
    const soundWrap = document.createElement('label')
    soundWrap.style.cssText = 'display: inline-flex; align-items: center; gap: 8px; cursor: pointer'
    const soundCheck = document.createElement('input')
    soundCheck.type = 'checkbox'
    soundCheck.checked = values.soundEnabled
    soundCheck.style.cssText = 'width: 16px; height: 16px; cursor: pointer'
    const soundText = document.createElement('span')
    soundText.textContent = values.soundEnabled ? t('toggle.on') : t('toggle.off')
    soundCheck.addEventListener('change', () => {
      soundText.textContent = soundCheck.checked ? t('toggle.on') : t('toggle.off')
    })
    soundWrap.appendChild(soundCheck)
    soundWrap.appendChild(soundText)
    soundRow.appendChild(soundLabel)
    soundRow.appendChild(soundWrap)
    p.appendChild(soundRow)

    settingsFields = { camera: camera.getValue, sound: () => soundCheck.checked }

    section(p, t('settings.experimental'))
    const expBody = document.createElement('div')
    expBody.style.cssText = 'line-height: 1.55; opacity: 0.7; font-size: 12px'
    expBody.textContent = t('settings.experimental.body')
    p.appendChild(expBody)

    return p
  }

  function buildMultiplayerTab(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.style.cssText =
      'display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%'

    const p = panel()
    const intro = document.createElement('div')
    intro.textContent = t('mp.intro')
    intro.style.cssText = 'opacity: 0.7; font-size: 13px; margin-bottom: 14px; line-height: 1.5'
    p.appendChild(intro)

    const openBtn = document.createElement('button')
    openBtn.className = 'tl-start'
    openBtn.textContent = t('mp.openDialog')
    openBtn.style.cssText = BUTTON_STYLE + ';margin-top: 0'
    openBtn.addEventListener('click', () => callbacks.onMultiplayer(collect()))
    p.appendChild(openBtn)

    wrap.appendChild(p)

    // Lobby-Browser (offene Lobbys + laufende Spiele zum Zuschauen) — nur mit Server-URL.
    const browser = mountLobbyBrowser()
    if (browser !== null) {
      browser.style.maxWidth = '560px'
      browser.style.width = '100%'
      wrap.appendChild(browser)
    }

    return wrap
  }

  function buildChangelogTab(): HTMLElement {
    const p = panel()
    p.style.maxWidth = '720px'
    const h = document.createElement('div')
    h.className = 'tl-section'
    h.style.borderTop = 'none'
    h.style.paddingTop = '0'
    h.style.marginTop = '0'
    h.textContent = t('changelog.title')
    p.appendChild(h)

    const body = document.createElement('div')
    body.style.cssText = 'line-height: 1.6; font-size: 13px; opacity: 0.9'
    renderChangelog(body, changelogRaw)
    p.appendChild(body)
    return p
  }

  function buildHelpTab(): HTMLElement {
    const p = panel()
    p.style.maxWidth = '720px'

    const h = document.createElement('div')
    h.className = 'tl-section'
    h.style.borderTop = 'none'
    h.style.paddingTop = '0'
    h.style.marginTop = '0'
    h.textContent = t('help.title')
    p.appendChild(h)

    const intro = document.createElement('div')
    intro.textContent = t('help.intro')
    intro.style.cssText = 'line-height: 1.6; opacity: 0.85; margin-bottom: 8px'
    p.appendChild(intro)

    const topics = [
      'goal',
      'expansion',
      'buildings',
      'economy',
      'ships',
      'diplomacy',
      'treason',
      'relations',
      'wild',
      'camera',
      'controls',
      'growth',
    ]
    for (const topic of topics) {
      const block = document.createElement('div')
      block.style.cssText = 'margin-top: 16px'
      const title = document.createElement('div')
      title.textContent = t(`help.${topic}.title`)
      title.style.cssText = `font-weight: 700; color: ${ACCENT}; margin-bottom: 4px`
      const text = document.createElement('div')
      text.textContent = t(`help.${topic}.body`)
      text.style.cssText = 'line-height: 1.6; opacity: 0.85'
      block.appendChild(title)
      block.appendChild(text)
      p.appendChild(block)
    }
    return p
  }

  // ── Reconnect-Banner ───────────────────────────────────────────────────────
  function updateBanner(): void {
    if (bannerSlot === null) return
    bannerSlot.textContent = ''
    if (reconnect === null) return
    const rc = document.createElement('button')
    rc.textContent = t('mp.reconnect', { room: reconnect.room })
    rc.style.cssText = [
      'padding: 11px 20px',
      'background: #2e8b57',
      'color: white',
      'border: 1px solid #5adc78',
      'border-radius: 8px',
      'font-size: 14px',
      'font-weight: 700',
      'font-family: inherit',
      'cursor: pointer',
    ].join(';')
    const cb = reconnect.onReconnect
    rc.addEventListener('click', () => cb())
    bannerSlot.appendChild(rc)
  }

  const removeLocaleListener = onLocaleChange(() => render())

  render()

  return {
    destroy(): void {
      removeLocaleListener()
      teardown()
    },
    showReconnect(room: string, onReconnect: () => void): void {
      reconnect = { room, onReconnect }
      updateBanner()
    },
  }
}

/** Sekundär-Button (Zuschauen u. ä.) — dezenter Umriss statt gefüllt. */
function secondaryButtonStyle(): string {
  return [
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
}

/**
 * Sehr leichtes Markdown-Rendering für den Changelog (Überschriften/Listen/**fett**).
 * Umgebrochene Folgezeilen werden in den laufenden Block (Listenpunkt/Absatz) gefaltet;
 * Link-Referenz-Definitionen (`[x]: http…`) am Ende werden übersprungen.
 */
function renderChangelog(parent: HTMLElement, raw: string): void {
  const lines = raw.split('\n')
  let list: HTMLUListElement | null = null
  let cur: HTMLElement | null = null // laufender Block, an den Folgezeilen angehängt werden
  const closeBlock = (): void => {
    list = null
    cur = null
  }
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      closeBlock()
      continue
    }
    if (trimmed.startsWith('# ')) {
      closeBlock()
      continue // Haupttitel überspringen (steht schon als Tab-Überschrift)
    }
    if (/^\[[^\]]+\]:\s*https?:/.test(trimmed)) {
      closeBlock()
      continue // Link-Referenz-Definition → nicht anzeigen
    }
    if (trimmed.startsWith('## ')) {
      closeBlock()
      const h = document.createElement('div')
      h.textContent = trimmed.slice(3).replace(/[[\]]/g, '')
      h.style.cssText = `font-weight: 700; color: ${ACCENT}; margin: 18px 0 6px`
      parent.appendChild(h)
      continue
    }
    if (trimmed.startsWith('### ')) {
      closeBlock()
      const h = document.createElement('div')
      h.textContent = trimmed.slice(4)
      h.style.cssText = 'font-weight: 700; opacity: 0.8; margin: 10px 0 4px; font-size: 12px'
      parent.appendChild(h)
      continue
    }
    if (trimmed.startsWith('- ')) {
      if (list === null) {
        list = document.createElement('ul')
        list.style.cssText = 'margin: 4px 0; padding-left: 20px'
        parent.appendChild(list)
      }
      const li = document.createElement('li')
      li.style.marginBottom = '3px'
      applyInline(li, trimmed.slice(2))
      list.appendChild(li)
      cur = li
      continue
    }
    // Folgezeile eines umgebrochenen Listenpunkts/Absatzes → anhängen.
    if (cur !== null) {
      applyInline(cur, ' ' + trimmed)
      continue
    }
    const para = document.createElement('div')
    para.style.cssText = 'margin: 6px 0; opacity: 0.8'
    applyInline(para, trimmed)
    parent.appendChild(para)
    cur = para
  }
}

/** Wendet `**fett**` an und macht `[text](url)` zu reinem `text` (bewusst minimal, eigene Quelle). */
function applyInline(target: HTMLElement, text: string): void {
  const cleaned = text.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1')
  const parts = cleaned.split(/(\*\*[^*]+\*\*)/g)
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const b = document.createElement('strong')
      b.textContent = part.slice(2, -2)
      target.appendChild(b)
    } else if (part.length > 0) {
      target.appendChild(document.createTextNode(part))
    }
  }
}
