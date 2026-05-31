/**
 * In-Game-HUD-Editor (ADR-0024, Phase 3). Ein „HUD anpassen"-Knopf (oben links) schaltet einen
 * Bearbeitungs-Modus frei: jedes registrierte Panel bekommt einen Rahmen mit Zieh-Fläche
 * (verschieben), Eck-Griffen (skalieren) und einem ×-Knopf (ausblenden). Verschieben snappt an
 * Bildschirm-Ränder und an andere Panels (Hilfslinien). Änderungen wandern in den Layout-Speicher
 * (`hud-layout`) und damit nach localStorage — reine Client-Präferenz, kein Sim-Determinismus.
 *
 * Technik-Brücke: Panels sitzen normal an CSS-Ankern (oben/unten/links/rechts) + `zoom`
 * (Basisgröße aus `ui-scale`). Im Editor werden sie in ein absolutes Modell überführt
 * (`left/top` + `transform: scale`, `zoom` neutralisiert) — wie im Prototyp `theme-editor.html`,
 * damit Drag-/Resize-Mathematik in echten Bildschirm-Pixeln rechnet.
 */

import { t } from '../i18n'
import { getPanel, panelElements, resetLayout, setPanel, type PanelOverride } from './hud-layout'
import { getUiScale } from './ui-scale'
import { getTheme, panelStyle, setTheme, THEMES } from './theme'

export interface HudEditorApi {
  destroy(): void
}

const SNAP = 9
const S_MIN = 0.6
const S_MAX = 3
/** Lesbare Panel-Namen für die Ausgeblendet-Liste (i18n-Keys). */
const PANEL_LABEL: Record<string, string> = {
  info: 'hud.editor.panel.info',
  rank: 'hud.editor.panel.rank',
  resource: 'hud.editor.panel.resource',
  action: 'hud.editor.panel.action',
  minimap: 'hud.editor.panel.minimap',
  feed: 'hud.editor.panel.feed',
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function createHudEditor(container: HTMLElement): HudEditorApi {
  let open = false
  const frames = new Map<string, HTMLElement>()

  // ---- Umschalt-Knopf (oben links, neben dem Feedback-Knopf) ---------------------------------
  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.textContent = t('hud.editor.open')
  toggle.style.cssText = panelStyle([
    'position: absolute',
    'left: 116px',
    'top: 12px',
    'z-index: 46',
    'padding: 6px 11px',
    'font-size: 12px',
    'font-family: var(--tl-font)',
    'cursor: pointer',
    'pointer-events: auto',
  ])
  toggle.addEventListener('click', () => {
    if (open) close()
    else openEditor()
  })
  container.appendChild(toggle)

  // ---- Werkzeugleiste (unten mittig, nur im Editor sichtbar) ---------------------------------
  const toolbar = document.createElement('div')
  toolbar.style.cssText = panelStyle([
    'position: absolute',
    'left: 50%',
    'bottom: 16px',
    'transform: translateX(-50%)',
    'z-index: 60',
    'display: none',
    'flex-direction: column',
    'gap: 8px',
    'padding: 10px 12px',
    'max-width: 92vw',
    'pointer-events: auto',
  ])
  container.appendChild(toolbar)

  // ---- Snap-Hilfslinien ----------------------------------------------------------------------
  const guideV = document.createElement('div')
  const guideH = document.createElement('div')
  for (const g of [guideV, guideH]) {
    g.style.cssText = [
      'position: absolute',
      'z-index: 58',
      'background: var(--tl-accent)',
      'box-shadow: 0 0 6px var(--tl-accent)',
      'display: none',
      'pointer-events: none',
    ].join(';')
  }
  guideV.style.width = '2px'
  guideV.style.top = '0'
  guideV.style.bottom = '0'
  guideH.style.height = '2px'
  guideH.style.left = '0'
  guideH.style.right = '0'
  container.appendChild(guideV)
  container.appendChild(guideH)

  function showGuideV(x: number | null): void {
    if (x === null) guideV.style.display = 'none'
    else {
      guideV.style.left = `${x.toString()}px`
      guideV.style.display = 'block'
    }
  }
  function showGuideH(y: number | null): void {
    if (y === null) guideH.style.display = 'none'
    else {
      guideH.style.top = `${y.toString()}px`
      guideH.style.display = 'block'
    }
  }
  function hideGuides(): void {
    guideV.style.display = 'none'
    guideH.style.display = 'none'
  }

  // ---- Koordinaten-Helfer (Container-lokal) --------------------------------------------------
  function localRect(el: HTMLElement): Rect {
    const c = container.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height }
  }

  function scaleOf(id: string): number {
    return getPanel(id)?.s ?? getUiScale()
  }

  /** Panel ins absolute Editor-Modell überführen (zoom raus, left/top/scale gesetzt). */
  function arm(id: string, el: HTMLElement): void {
    const s = scaleOf(id)
    const r = localRect(el)
    el.style.zoom = '1'
    el.style.transformOrigin = 'top left'
    el.style.left = `${Math.round(r.x).toString()}px`
    el.style.top = `${Math.round(r.y).toString()}px`
    el.style.right = 'auto'
    el.style.bottom = 'auto'
    el.style.transform = `scale(${s.toString()})`
  }

  /** Sichtbarer Pixel-Kasten eines Panels (footprint = intrinsische Größe × scale). */
  function footprint(id: string, el: HTMLElement): Rect {
    const s = scaleOf(id)
    const x = parseFloat(el.style.left) || 0
    const y = parseFloat(el.style.top) || 0
    return { x, y, w: el.offsetWidth * s, h: el.offsetHeight * s }
  }

  function layoutFrame(id: string): void {
    const el = panelMap.get(id)
    const frame = frames.get(id)
    if (el === undefined || frame === undefined) return
    const f = footprint(id, el)
    frame.style.left = `${f.x.toString()}px`
    frame.style.top = `${f.y.toString()}px`
    frame.style.width = `${f.w.toString()}px`
    frame.style.height = `${f.h.toString()}px`
  }

  // ---- Snap-Kandidaten (Ränder + andere Panels) ----------------------------------------------
  function snapTargets(exceptId: string): { vx: number[]; hy: number[] } {
    const vx = [0, container.clientWidth]
    const hy = [0, container.clientHeight]
    for (const [id, el] of panelMap) {
      if (id === exceptId) continue
      const o = getPanel(id)
      if (o?.hidden === true) continue
      const f = footprint(id, el)
      vx.push(f.x, f.x + f.w)
      hy.push(f.y, f.y + f.h)
    }
    return { vx, hy }
  }

  function snap(value: number, targets: number[]): number | null {
    let best: number | null = null
    let bd = SNAP
    for (const t2 of targets) {
      const d = Math.abs(value - t2)
      if (d < bd) {
        bd = d
        best = t2
      }
    }
    return best
  }

  // ---- Drag ----------------------------------------------------------------------------------
  function startDrag(id: string, ev: PointerEvent): void {
    const found = panelMap.get(id)
    if (found === undefined) return
    const el: HTMLElement = found
    ev.preventDefault()
    const f0 = footprint(id, el)
    const startX = ev.clientX
    const startY = ev.clientY
    const { vx, hy } = snapTargets(id)

    function onMove(e: PointerEvent): void {
      let nx = f0.x + (e.clientX - startX)
      let ny = f0.y + (e.clientY - startY)
      let gx: number | null = null
      let gy: number | null = null
      // Linke Kante ODER rechte Kante an vertikale Linien snappen.
      const sl = snap(nx, vx)
      if (sl !== null) {
        nx = sl
        gx = sl
      } else {
        const sr = snap(nx + f0.w, vx)
        if (sr !== null) {
          nx = sr - f0.w
          gx = sr
        }
      }
      const st = snap(ny, hy)
      if (st !== null) {
        ny = st
        gy = st
      } else {
        const sb = snap(ny + f0.h, hy)
        if (sb !== null) {
          ny = sb - f0.h
          gy = sb
        }
      }
      nx = Math.max(0, Math.min(nx, container.clientWidth - 24))
      ny = Math.max(0, Math.min(ny, container.clientHeight - 24))
      el.style.left = `${Math.round(nx).toString()}px`
      el.style.top = `${Math.round(ny).toString()}px`
      showGuideV(gx)
      showGuideH(gy)
      layoutFrame(id)
    }
    function onUp(): void {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      hideGuides()
      setPanel(id, { x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0 })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ---- Resize (Eck-Griff, seitenverhältnis-treu) ---------------------------------------------
  function startResize(id: string, cx: 0 | 1, cy: 0 | 1, ev: PointerEvent): void {
    const found = panelMap.get(id)
    if (found === undefined) return
    const el: HTMLElement = found
    ev.preventDefault()
    ev.stopPropagation()
    const f0 = footprint(id, el)
    const w0 = el.offsetWidth
    const h0 = el.offsetHeight
    // Gegenüberliegende Ecke bleibt fix.
    const anchorX = cx === 0 ? f0.x + f0.w : f0.x
    const anchorY = cy === 0 ? f0.y + f0.h : f0.y
    const diag0 = Math.hypot(w0, h0)
    const c = container.getBoundingClientRect()

    function onMove(e: PointerEvent): void {
      const px = e.clientX - c.left
      const py = e.clientY - c.top
      const dist = Math.hypot(px - anchorX, py - anchorY)
      const s = Math.max(S_MIN, Math.min(S_MAX, dist / diag0))
      const nw = w0 * s
      const nh = h0 * s
      const nx = cx === 0 ? anchorX - nw : anchorX
      const ny = cy === 0 ? anchorY - nh : anchorY
      el.style.left = `${Math.round(nx).toString()}px`
      el.style.top = `${Math.round(ny).toString()}px`
      el.style.transform = `scale(${s.toString()})`
      // Override sofort schreiben, damit footprint()/scaleOf() den neuen Wert kennt.
      setPanel(id, { x: Math.round(nx), y: Math.round(ny), s: Math.round(s * 100) / 100 })
      layoutFrame(id)
    }
    function onUp(): void {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ---- Kanten-Resize (Breite ODER Höhe einzeln ziehen, Skalierung bleibt) --------------------
  const EDGE_MIN = 60
  function startEdge(id: string, axis: 'x' | 'y', side: 0 | 1, ev: PointerEvent): void {
    const found = panelMap.get(id)
    if (found === undefined) return
    const el: HTMLElement = found
    ev.preventDefault()
    ev.stopPropagation()
    const f0 = footprint(id, el)
    const s = scaleOf(id)
    const c = container.getBoundingClientRect()
    const { vx, hy } = snapTargets(id)

    function onMove(e: PointerEvent): void {
      const px = e.clientX - c.left
      const py = e.clientY - c.top
      if (axis === 'x') {
        let edge = px
        const sn = snap(edge, vx)
        let gx: number | null = null
        if (sn !== null) {
          edge = sn
          gx = sn
        }
        if (side === 1) {
          const screenW = Math.max(EDGE_MIN, edge - f0.x)
          setPanel(id, { w: Math.round(screenW / s) })
        } else {
          const right = f0.x + f0.w
          const left = Math.min(edge, right - EDGE_MIN)
          setPanel(id, { x: Math.round(left), w: Math.round((right - left) / s) })
          el.style.left = `${Math.round(left).toString()}px`
        }
        el.style.width = `${Math.round(getPanel(id)?.w ?? f0.w / s).toString()}px`
        showGuideV(gx)
        showGuideH(null)
      } else {
        let edge = py
        const sn = snap(edge, hy)
        let gy: number | null = null
        if (sn !== null) {
          edge = sn
          gy = sn
        }
        if (side === 1) {
          const screenH = Math.max(EDGE_MIN, edge - f0.y)
          setPanel(id, { h: Math.round(screenH / s) })
        } else {
          const bottom = f0.y + f0.h
          const top = Math.min(edge, bottom - EDGE_MIN)
          setPanel(id, { y: Math.round(top), h: Math.round((bottom - top) / s) })
          el.style.top = `${Math.round(top).toString()}px`
        }
        el.style.height = `${Math.round(getPanel(id)?.h ?? f0.h / s).toString()}px`
        showGuideH(gy)
        showGuideV(null)
      }
      layoutFrame(id)
    }
    function onUp(): void {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      hideGuides()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ---- Rahmen je Panel bauen -----------------------------------------------------------------
  const panelMap = new Map<string, HTMLElement>()

  function buildFrame(id: string, el: HTMLElement): void {
    const frame = document.createElement('div')
    frame.style.cssText = [
      'position: absolute',
      'z-index: 57',
      'box-sizing: border-box',
      'border: 2px dashed var(--tl-accent)',
      'background: rgba(70,217,230,0.06)',
      'cursor: grab',
      'pointer-events: auto',
    ].join(';')
    frame.addEventListener('pointerdown', (e) => {
      startDrag(id, e)
    })

    // ×-Knopf zum Ausblenden (oben rechts, innen).
    const hide = document.createElement('button')
    hide.type = 'button'
    hide.textContent = '×'
    hide.style.cssText = [
      'position: absolute',
      'top: 2px',
      'right: 2px',
      'width: 20px',
      'height: 20px',
      'line-height: 18px',
      'padding: 0',
      'z-index: 2',
      'border: none',
      'border-radius: 4px',
      'background: var(--tl-bad, #c0392b)',
      'color: #fff',
      'font-size: 15px',
      'cursor: pointer',
      'pointer-events: auto',
    ].join(';')
    hide.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
    })
    hide.addEventListener('click', (e) => {
      e.stopPropagation()
      setPanel(id, { hidden: true })
      el.style.display = 'none'
      frame.style.display = 'none'
      refreshHiddenList()
    })
    frame.appendChild(hide)

    // 4 Eck-Griffe.
    const corners: Array<[0 | 1, 0 | 1, string]> = [
      [0, 0, 'top:-5px;left:-5px;cursor:nwse-resize'],
      [1, 0, 'top:-5px;right:-5px;cursor:nesw-resize'],
      [0, 1, 'bottom:-5px;left:-5px;cursor:nesw-resize'],
      [1, 1, 'bottom:-5px;right:-5px;cursor:nwse-resize'],
    ]
    for (const [cx, cy, pos] of corners) {
      const grip = document.createElement('div')
      grip.style.cssText = [
        'position: absolute',
        'width: 14px',
        'height: 14px',
        'background: var(--tl-accent)',
        'border: 2px solid rgba(0,0,0,0.4)',
        'border-radius: 3px',
        'z-index: 3',
        'pointer-events: auto',
        pos,
      ].join(';')
      grip.addEventListener('pointerdown', (e) => {
        startResize(id, cx, cy, e)
      })
      frame.appendChild(grip)
    }

    // 4 Kanten-Griffe (Breite/Höhe einzeln ziehen).
    const edges: Array<['x' | 'y', 0 | 1, string]> = [
      ['y', 0, 'top:-4px;left:18px;right:18px;height:8px;cursor:ns-resize'],
      ['y', 1, 'bottom:-4px;left:18px;right:18px;height:8px;cursor:ns-resize'],
      ['x', 0, 'left:-4px;top:18px;bottom:18px;width:8px;cursor:ew-resize'],
      ['x', 1, 'right:-4px;top:18px;bottom:18px;width:8px;cursor:ew-resize'],
    ]
    for (const [axis, side, pos] of edges) {
      const bar2 = document.createElement('div')
      bar2.style.cssText = [
        'position: absolute',
        'z-index: 2',
        'background: rgba(70,217,230,0.35)',
        'pointer-events: auto',
        pos,
      ].join(';')
      bar2.addEventListener('pointerdown', (e) => {
        startEdge(id, axis, side, e)
      })
      frame.appendChild(bar2)
    }

    container.appendChild(frame)
    frames.set(id, frame)
    layoutFrame(id)
  }

  // ---- Ausgeblendet-Liste in der Werkzeugleiste ----------------------------------------------
  const hiddenRow = document.createElement('div')
  hiddenRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;align-items:center'

  function refreshHiddenList(): void {
    hiddenRow.textContent = ''
    const hiddenIds = [...panelMap.keys()].filter((id) => getPanel(id)?.hidden === true)
    if (hiddenIds.length === 0) {
      hiddenRow.style.display = 'none'
      return
    }
    hiddenRow.style.display = 'flex'
    const label = document.createElement('span')
    label.textContent = `${t('hud.editor.hidden')}:`
    label.style.cssText = 'font-size:11px;opacity:0.7'
    hiddenRow.appendChild(label)
    for (const id of hiddenIds) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = `+ ${t(PANEL_LABEL[id] ?? id)}`
      b.style.cssText = [
        'padding:3px 8px',
        'font-size:11px',
        'cursor:pointer',
        'border:1px solid var(--tl-panel-border-color)',
        'border-radius:5px',
        'background:var(--tl-btn-bg, rgba(255,255,255,0.06))',
        'color:var(--tl-text)',
      ].join(';')
      b.addEventListener('click', () => {
        setPanel(id, { hidden: false })
        const el = panelMap.get(id)
        if (el !== undefined) el.style.display = ''
        const frame = frames.get(id)
        if (frame !== undefined) {
          frame.style.display = ''
          layoutFrame(id)
        }
        refreshHiddenList()
      })
      hiddenRow.appendChild(b)
    }
  }

  // ---- Theme-Auswahl + Aktionen in der Werkzeugleiste ----------------------------------------
  function buildToolbar(): void {
    toolbar.textContent = ''

    const themeRow = document.createElement('div')
    themeRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;align-items:center'
    const themeLabel = document.createElement('span')
    themeLabel.textContent = `${t('hud.editor.theme')}:`
    themeLabel.style.cssText = 'font-size:11px;opacity:0.7'
    themeRow.appendChild(themeLabel)
    const themeBtns = new Map<string, HTMLButtonElement>()
    const styleThemeBtn = (b: HTMLButtonElement, active: boolean): void => {
      b.style.cssText = [
        'padding:4px 9px',
        'font-size:11px',
        'cursor:pointer',
        'border-radius:5px',
        `border:1px solid ${active ? 'var(--tl-accent)' : 'var(--tl-panel-border-color)'}`,
        active
          ? 'background:var(--tl-accent);color:#0c0c10'
          : 'background:transparent;color:var(--tl-text)',
      ].join(';')
    }
    for (const [key, def] of Object.entries(THEMES)) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = def.label
      styleThemeBtn(b, key === getTheme())
      b.addEventListener('click', () => {
        setTheme(key)
        for (const [k, btn] of themeBtns) styleThemeBtn(btn, k === key)
      })
      themeBtns.set(key, b)
      themeRow.appendChild(b)
    }
    toolbar.appendChild(themeRow)

    toolbar.appendChild(hiddenRow)
    refreshHiddenList()

    // Untere Knopf-Zeile: Hinweis + Standard + Fertig.
    const actions = document.createElement('div')
    actions.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:space-between'
    const hint = document.createElement('span')
    hint.textContent = t('hud.editor.hint')
    hint.style.cssText = 'font-size:11px;opacity:0.6'
    actions.appendChild(hint)

    const right = document.createElement('div')
    right.style.cssText = 'display:flex;gap:8px'

    // Export: aktuelles Layout (+ Theme + Bildschirmgröße) als JSON in die Zwischenablage —
    // damit ein gewähltes Layout geteilt / als eingebauter Default übernommen werden kann.
    const exportBtn = document.createElement('button')
    exportBtn.type = 'button'
    exportBtn.textContent = t('hud.editor.export')
    exportBtn.style.cssText = [
      'padding:5px 12px',
      'font-size:12px',
      'cursor:pointer',
      'border:1px solid var(--tl-panel-border-color)',
      'border-radius:6px',
      'background:transparent',
      'color:var(--tl-text)',
    ].join(';')
    exportBtn.addEventListener('click', () => {
      const panels: Record<string, PanelOverride> = {}
      for (const id of panelMap.keys()) {
        const o = getPanel(id)
        if (o !== undefined) panels[id] = o
      }
      const payload = {
        theme: getTheme(),
        screen: { w: container.clientWidth, h: container.clientHeight },
        panels,
      }
      const json = JSON.stringify(payload)
      void navigator.clipboard.writeText(json).then(
        () => {
          const prev = exportBtn.textContent
          exportBtn.textContent = t('hud.editor.copied')
          window.setTimeout(() => (exportBtn.textContent = prev), 1200)
        },
        () => {
          /* Clipboard verweigert → wenigstens in die Konsole legen. */
          // eslint-disable-next-line no-console
          console.log('[hud-editor] layout export:', json)
        },
      )
    })
    right.appendChild(exportBtn)

    const resetBtn = document.createElement('button')
    resetBtn.type = 'button'
    resetBtn.textContent = t('hud.editor.reset')
    resetBtn.style.cssText = [
      'padding:5px 12px',
      'font-size:12px',
      'cursor:pointer',
      'border:1px solid var(--tl-panel-border-color)',
      'border-radius:6px',
      'background:transparent',
      'color:var(--tl-text)',
    ].join(';')
    resetBtn.addEventListener('click', () => {
      doReset()
    })
    const doneBtn = document.createElement('button')
    doneBtn.type = 'button'
    doneBtn.textContent = t('hud.editor.done')
    doneBtn.style.cssText = [
      'padding:5px 14px',
      'font-size:12px',
      'font-weight:700',
      'cursor:pointer',
      'border:none',
      'border-radius:6px',
      'background:var(--tl-accent)',
      'color:#0c0c10',
    ].join(';')
    doneBtn.addEventListener('click', () => {
      close()
    })
    right.appendChild(resetBtn)
    right.appendChild(doneBtn)
    actions.appendChild(right)
    toolbar.appendChild(actions)
  }

  // ---- Reset (zurück auf Standard, danach neu armieren) --------------------------------------
  function doReset(): void {
    resetLayout()
    // Standard-Basisgröße (zoom) wiederherstellen, Editor-Inline-Styles weg.
    for (const [, el] of panelMap) {
      el.style.removeProperty('left')
      el.style.removeProperty('top')
      el.style.removeProperty('right')
      el.style.removeProperty('bottom')
      el.style.removeProperty('transform')
      el.style.removeProperty('transform-origin')
      el.style.display = ''
      el.style.setProperty('zoom', getUiScale().toString())
    }
    // Neu messen + Rahmen aktualisieren.
    for (const [id, el] of panelMap) arm(id, el)
    for (const id of panelMap.keys()) layoutFrame(id)
    refreshHiddenList()
  }

  // ---- Öffnen / Schließen --------------------------------------------------------------------
  function openEditor(): void {
    if (open) return
    open = true
    panelMap.clear()
    for (const [id, el] of panelElements()) panelMap.set(id, el)
    for (const [id, el] of panelMap) {
      const hidden = getPanel(id)?.hidden === true
      // Auch ausgeblendete Panels vermessen (kurz einblenden), damit Position/Größe stimmen,
      // wenn sie später wieder hinzugefügt werden.
      if (hidden) el.style.display = ''
      arm(id, el)
      buildFrame(id, el)
      if (hidden) {
        el.style.display = 'none'
        const frame = frames.get(id)
        if (frame !== undefined) frame.style.display = 'none'
      }
    }
    buildToolbar()
    toolbar.style.display = 'flex'
    toggle.textContent = t('hud.editor.done')
  }

  function close(): void {
    if (!open) return
    open = false
    for (const [, frame] of frames) frame.remove()
    frames.clear()
    panelMap.clear()
    toolbar.style.display = 'none'
    hideGuides()
    toggle.textContent = t('hud.editor.open')
  }

  return {
    destroy(): void {
      close()
      toggle.remove()
      toolbar.remove()
      guideV.remove()
      guideH.remove()
    },
  }
}
