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
import { getHudPrefs, onHudPrefsChange, setHudPref } from './hud-prefs'
import {
  FIXED_PRESET_IDS,
  applyFixedPreset,
  applyUserPreset,
  deleteUserPreset,
  hasFixedOverride,
  listUserPresets,
  resetFixedPreset,
  saveFixedAsDefault,
  saveUserPreset,
  type FixedPresetId,
} from './hud-presets'

export interface HudEditorApi {
  /** Editor-Modus öffnen (z. B. aus dem Pause-Menü). */
  open(): void
  isOpen(): boolean
  destroy(): void
}

const SNAP = 9
const S_MIN = 0.6
const S_MAX = 3
/** Lesbare Panel-Namen für die Ausgeblendet-Liste (i18n-Keys). */
const PANEL_LABEL: Record<string, string> = {
  info: 'hud.editor.panel.info',
  rank: 'hud.editor.panel.rank',
  wheel: 'hud.editor.panel.wheel',
  topbar: 'hud.editor.panel.topbar',
  attackbar: 'hud.editor.panel.attackbar',
  menu: 'hud.editor.panel.menu',
  feedback: 'hud.editor.panel.feedback',
  resource: 'hud.editor.panel.resource',
  action: 'hud.editor.panel.action',
  attacks: 'hud.editor.panel.attacks',
  minimap: 'hud.editor.panel.minimap',
  feed: 'hud.editor.panel.feed',
  'res-num': 'hud.editor.panel.troopsNum',
  'res-bar': 'hud.editor.panel.troopsBar',
  'res-gold': 'hud.editor.panel.gold',
  'act-buys': 'hud.editor.panel.buys',
  'act-boat': 'hud.editor.panel.boat',
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** IDs der Cockpit-/Maus-Modus-Elemente (Eck-Rad + Top-Leiste). Im Cockpit-Modus bearbeitet der
 *  Editor NUR diese; im Desktop-Modus NUR die Desktop-Panels (alles andere). */
const COCKPIT_PANEL_IDS = new Set(['wheel', 'topbar', 'attackbar'])

/** Panels, die in BEIDEN Modi editierbar sind (auch auf Mobile sinnvoll): Angriffs-Panel,
 *  Feedback-Knopf. (Die Feed-Spalte ist auf dem Handy Teil der Rangliste — „Meldungen"-Tab —
 *  und daher dort kein eigenes Panel; auf Desktop bleibt sie über `!cockpit` editierbar.) */
const BOTH_PANEL_IDS = new Set(['attacks', 'feedback'])

/** IDs, die NICHT ausgeblendet werden dürfen (sonst verlöre man den Zugang) — nur verschiebbar. */
const NO_HIDE_IDS = new Set(['menu', 'feedback'])

export interface HudEditorOptions {
  /** Wird beim Schließen über „Fertig" zusätzlich aufgerufen (z. B. Sandbox → zurück ins Menü). */
  onDone?: () => void
  /** Liefert, ob gerade der Cockpit-/Maus-Modus aktiv ist (Rad sichtbar) — steuert, welche
   *  Panels der Editor zeigt. Fehlt sie, gilt Desktop-Modus. */
  isCockpit?: () => boolean
  /** Bei jedem Schließen aufgerufen (auch ohne „Fertig") — z. B. um die Cockpit-Sichtbarkeit
   *  nach Aus-/Einblenden im Editor neu anzuwenden. */
  onClose?: () => void
}

export function createHudEditor(container: HTMLElement, opts: HudEditorOptions = {}): HudEditorApi {
  let open = false
  const frames = new Map<string, HTMLElement>()

  // Geöffnet wird der Editor übers Pause-Menü (Esc), geschlossen über „Fertig" in der Werkzeugleiste.

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
    // Schmaler, vertikaler Werkzeug-Block statt breiter Leiste (kompakter, weniger Karten-Verdeckung).
    'width: 340px',
    'max-width: 94vw',
    'max-height: 88vh',
    'overflow-y: auto',
    'pointer-events: auto',
  ])
  container.appendChild(toolbar)

  // Die Werkzeugleiste lässt sich selbst verschieben (sie verdeckt sonst manchmal Panels) und
  // skalieren. Standardposition: Bildschirm-Mitte. Nach dem Ziehen: absolute Position. Beides
  // nur Sitzungs-Bequemlichkeit (nicht persistiert).
  let toolbarPos: { x: number; y: number } | null = null
  let toolbarScale = 1
  function applyToolbarPos(): void {
    if (toolbarPos === null) {
      toolbar.style.left = '50%'
      toolbar.style.top = '50%'
      toolbar.style.bottom = 'auto'
      toolbar.style.transformOrigin = 'center'
      toolbar.style.transform = `translate(-50%, -50%) scale(${toolbarScale.toString()})`
    } else {
      toolbar.style.left = `${toolbarPos.x.toString()}px`
      toolbar.style.top = `${toolbarPos.y.toString()}px`
      toolbar.style.bottom = 'auto'
      toolbar.style.transformOrigin = 'top left'
      toolbar.style.transform = `scale(${toolbarScale.toString()})`
    }
  }
  function startToolbarDrag(ev: PointerEvent): void {
    ev.preventDefault()
    const cr = container.getBoundingClientRect()
    const tr = toolbar.getBoundingClientRect()
    const offX = ev.clientX - tr.left
    const offY = ev.clientY - tr.top
    function onMove(e: PointerEvent): void {
      const x = Math.max(0, Math.min(e.clientX - cr.left - offX, cr.width - tr.width))
      const y = Math.max(0, Math.min(e.clientY - cr.top - offY, cr.height - tr.height))
      toolbarPos = { x, y }
      applyToolbarPos()
    }
    function onUp(): void {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Werkzeugleiste skalieren (Eck-Griff unten rechts) — größer/kleiner für unterschiedliche Screens.
  function startToolbarResize(ev: PointerEvent): void {
    ev.preventDefault()
    ev.stopPropagation()
    const startX = ev.clientX
    const startScale = toolbarScale
    function onMove(e: PointerEvent): void {
      // 200px Ziehen ≈ +1.0 Scale; geclampt auf 0,6…1,8.
      toolbarScale = Math.max(0.6, Math.min(1.8, startScale + (e.clientX - startX) / 200))
      applyToolbarPos()
    }
    function onUp(): void {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

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
    // Mindest-Greiffläche: zustandsbedingt leere Panels (z. B. 'attacks' ohne laufenden Kampf)
    // sind sonst nur ein winziger Kasten und kaum anfassbar.
    frame.style.left = `${f.x.toString()}px`
    frame.style.top = `${f.y.toString()}px`
    frame.style.width = `${Math.max(f.w, 120).toString()}px`
    frame.style.height = `${Math.max(f.h, 40).toString()}px`
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

  function buildFrame(id: string, el: HTMLElement, isEmpty = false): void {
    const frame = document.createElement('div')
    frame.style.cssText = [
      'position: absolute',
      'z-index: 57',
      'box-sizing: border-box',
      'border: 2px dashed var(--tl-accent)',
      // Zustandsbedingt leere Panels (z. B. 'attacks' ohne Kampf) bekommen einen kräftigeren
      // Karten-Hintergrund, damit der Platzhalter wie ein echtes Panel wirkt statt leerem Kasten.
      isEmpty ? 'background: rgba(12,14,20,0.78)' : 'background: rgba(70,217,230,0.06)',
      'border-radius: 8px',
      'cursor: grab',
      'pointer-events: auto',
    ].join(';')
    frame.addEventListener('pointerdown', (e) => {
      startDrag(id, e)
    })

    // Namens-Label (mittig, durchklickbar) — macht Panels im Editor identifizierbar. Leere Panels
    // bekommen zusätzlich einen Hinweis „erscheint im Spiel", damit kein nackter Kasten dasteht.
    const nameTag = document.createElement('div')
    nameTag.style.cssText = [
      'position: absolute',
      'inset: 0',
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'gap: 3px',
      'text-align: center',
      'pointer-events: none',
      'z-index: 1',
    ].join(';')
    const nameLine = document.createElement('div')
    nameLine.textContent = t(PANEL_LABEL[id] ?? id)
    nameLine.style.cssText =
      'font-size: 12px; font-weight: 700; letter-spacing: 0.5px; color: var(--tl-accent); text-shadow: 0 1px 3px rgba(0,0,0,0.8)'
    nameTag.appendChild(nameLine)
    if (isEmpty) {
      const hint = document.createElement('div')
      hint.textContent = t('hud.editor.emptyHint')
      hint.style.cssText = 'font-size: 10px; opacity: 0.6; color: var(--tl-text)'
      nameTag.appendChild(hint)
    }
    frame.appendChild(nameTag)

    // ×-Knopf zum Ausblenden (oben rechts, innen) — außer bei nicht-ausblendbaren Elementen
    // (Menü/Feedback): die bleiben immer sichtbar, nur verschiebbar.
    if (!NO_HIDE_IDS.has(id)) {
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
        refreshElementList()
      })
      frame.appendChild(hide)
    }

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

  // ---- Element-Liste in der Werkzeugleiste ---------------------------------------------------
  // Festes Menü mit ALLEN Panels (nicht nur ausgeblendeten): je ein Schalter sichtbar `[x]` /
  // ausgeblendet `[ ]`. So findet man entfernte Elemente jederzeit wieder und kann jedes Panel
  // gezielt ein- oder ausblenden — auch die Split-Einzelteile, sobald sie geteilt sind.
  const elementsRow = document.createElement('div')
  elementsRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;align-items:center'

  /** Sichtbarkeit eines Panels setzen (Layout-Speicher + Live-Element + Rahmen). */
  function setPanelHidden(id: string, hidden: boolean): void {
    setPanel(id, { hidden })
    const el = panelMap.get(id)
    if (el !== undefined) el.style.display = hidden ? 'none' : ''
    const frame = frames.get(id)
    if (frame !== undefined) {
      frame.style.display = hidden ? 'none' : ''
      if (!hidden) layoutFrame(id)
    }
  }

  function refreshElementList(): void {
    elementsRow.textContent = ''
    const label = document.createElement('span')
    label.textContent = `${t('hud.editor.elements')}:`
    label.style.cssText = 'font-size:11px;opacity:0.7'
    elementsRow.appendChild(label)
    for (const id of panelMap.keys()) {
      if (NO_HIDE_IDS.has(id)) continue // Menü/Feedback nicht ausblendbar → kein Toggle
      const hidden = getPanel(id)?.hidden === true
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = `${hidden ? '[ ]' : '[x]'} ${t(PANEL_LABEL[id] ?? id)}`
      b.style.cssText = [
        'padding:3px 8px',
        'font-size:11px',
        'cursor:pointer',
        'border-radius:5px',
        `border:1px solid ${hidden ? 'var(--tl-panel-border-color)' : 'var(--tl-accent)'}`,
        hidden
          ? 'background:transparent;color:var(--tl-text);opacity:0.5'
          : 'background:var(--tl-accent);color:#0c0c10',
      ].join(';')
      b.addEventListener('click', () => {
        setPanelHidden(id, !hidden)
        refreshElementList()
      })
      elementsRow.appendChild(b)
    }
  }

  /** Beschrifteter Segment-Umschalter (Label + 2+ Optionen, aktive hervorgehoben). */
  function segmented<T extends string>(
    label: string,
    initial: T,
    options: ReadonlyArray<readonly [T, string]>,
    onPick: (value: T) => void,
  ): HTMLElement {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'display:flex;gap:4px;align-items:center'
    const lab = document.createElement('span')
    lab.textContent = `${label}:`
    lab.style.cssText = 'font-size:11px;opacity:0.7'
    wrap.appendChild(lab)
    const btns = new Map<T, HTMLButtonElement>()
    let active = initial
    const restyle = (): void => {
      for (const [val, btn] of btns) {
        const on = val === active
        btn.style.cssText = [
          'padding:3px 9px',
          'font-size:11px',
          'cursor:pointer',
          'border-radius:5px',
          `border:1px solid ${on ? 'var(--tl-accent)' : 'var(--tl-panel-border-color)'}`,
          on
            ? 'background:var(--tl-accent);color:#0c0c10'
            : 'background:transparent;color:var(--tl-text)',
        ].join(';')
      }
    }
    for (const [val, text] of options) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = text
      btn.addEventListener('click', () => {
        active = val
        restyle()
        onPick(val)
      })
      btns.set(val, btn)
      wrap.appendChild(btn)
    }
    restyle()
    return wrap
  }

  // Aktiver Reiter der Werkzeugleiste (bleibt über Neuaufbauten erhalten).
  let activeEditorTab: 'design' | 'layout' | 'elements' = 'layout'

  // ---- Theme-Auswahl + Aktionen in der Werkzeugleiste ----------------------------------------
  function buildToolbar(): void {
    toolbar.textContent = ''
    applyToolbarPos()

    // Zieh-Griff: die Werkzeugleiste selbst verschiebbar (verdeckt sonst manchmal Panels).
    const dragHandle = document.createElement('div')
    dragHandle.textContent = `⠿ ${t('hud.editor.open')}`
    dragHandle.style.cssText = [
      'cursor: grab',
      'text-align: center',
      'font-size: 11px',
      'letter-spacing: 1px',
      'opacity: 0.6',
      'padding: 2px 0 4px',
      'border-bottom: 1px solid var(--tl-panel-border-color)',
      'margin-bottom: 4px',
      'user-select: none',
    ].join(';')
    dragHandle.addEventListener('pointerdown', (e) => {
      startToolbarDrag(e)
    })
    toolbar.appendChild(dragHandle)

    // ---- Reiter (Design / Layout / Elemente) — entzerrt die früher überladene Leiste. ----------
    const tabBar = document.createElement('div')
    tabBar.style.cssText =
      'display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap'
    const paneDesign = document.createElement('div')
    const paneLayout = document.createElement('div')
    const paneElements = document.createElement('div')
    const tabDefs: Array<['design' | 'layout' | 'elements', string, HTMLElement]> = [
      ['design', t('hud.editor.theme'), paneDesign],
      ['layout', t('hud.editor.tab.layout'), paneLayout],
      ['elements', t('hud.editor.elements'), paneElements],
    ]
    const tabBtns = new Map<string, HTMLButtonElement>()
    const styleTab = (b: HTMLButtonElement, active: boolean): void => {
      b.style.cssText = [
        'padding:4px 12px',
        'font-size:12px',
        'font-weight:600',
        'cursor:pointer',
        'border-radius:6px 6px 0 0',
        `border:1px solid ${active ? 'var(--tl-accent)' : 'var(--tl-panel-border-color)'}`,
        'border-bottom:none',
        active
          ? 'background:var(--tl-accent);color:#0c0c10'
          : 'background:transparent;color:var(--tl-text);opacity:0.7',
      ].join(';')
    }
    const setActiveTab = (name: 'design' | 'layout' | 'elements'): void => {
      activeEditorTab = name
      for (const [key, , pane] of tabDefs) pane.style.display = key === name ? 'block' : 'none'
      for (const [key, btn] of tabBtns) styleTab(btn, key === name)
    }
    for (const [key, label] of tabDefs) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.addEventListener('click', () => {
        setActiveTab(key)
      })
      tabBtns.set(key, b)
      tabBar.appendChild(b)
    }
    // Vorlagen-Block: eigener vertikaler Abschnitt (unter den Reitern), klar beschriftet —
    // Laden / Speichern / Löschen, dazu im Dev-Modus „Als Standard speichern".
    const quickWrap = document.createElement('div')
    quickWrap.style.cssText =
      'display:flex;flex-direction:column;align-items:stretch;gap:6px;margin-top:2px;padding-top:8px;border-top:1px solid var(--tl-panel-border-color)'
    const quickHeader = document.createElement('div')
    quickHeader.textContent = t('hud.editor.presets.templates')
    quickHeader.style.cssText = 'font-size:11px;font-weight:700;opacity:0.7;letter-spacing:0.5px'
    const FIXED_LABEL: Record<FixedPresetId, string> = {
      standard: 'quickcfg.standard',
      mouse: 'quickcfg.mouse',
      wheel: 'quickcfg.wheel',
    }
    const presetBtn = (label: string): HTMLButtonElement => {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.style.cssText =
        'font-size:11px;padding:5px 10px;border-radius:5px;border:1px solid var(--tl-panel-border-color);background:transparent;color:var(--tl-text);cursor:pointer;white-space:nowrap'
      return b
    }
    // Speichern: Namensfeld + Knopf (Enter speichert auch). Leerer Name → automatischer Slot-Name.
    const saveRow = document.createElement('div')
    saveRow.style.cssText = 'display:flex;gap:6px;align-items:center'
    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.maxLength = 24
    nameInput.placeholder = t('hud.editor.presets.namePlaceholder')
    nameInput.style.cssText =
      'flex:1;min-width:0;font-size:11px;padding:5px 8px;border-radius:5px;border:1px solid var(--tl-panel-border-color);background:rgba(0,0,0,0.3);color:var(--tl-text)'
    const saveBtn = presetBtn(t('hud.editor.presets.save'))
    const doSave = (): void => {
      saveUserPreset(nameInput.value.trim() || nextSlotName())
      nameInput.value = ''
      buildToolbar()
    }
    saveBtn.addEventListener('click', doSave)
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        doSave()
      }
    })
    saveRow.append(nameInput, saveBtn)

    // Laden: anklickbare Liste — feste Vorlagen (Steuerungs-Modi) + eigene Slots. Klick lädt sofort.
    // Eigene mit ✕ (löschen), überschriebene feste mit ↺ (auf eingebauten Default zurücksetzen).
    const listEl = document.createElement('div')
    listEl.style.cssText = 'display:flex;flex-direction:column;gap:4px'
    const listItem = (
      label: string,
      onLoad: () => void,
      action?: { glyph: string; title: string; onClick: () => void },
    ): void => {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;gap:4px'
      const load = document.createElement('button')
      load.type = 'button'
      load.textContent = label
      load.style.cssText =
        'flex:1;min-width:0;text-align:left;font-size:11px;padding:5px 9px;border-radius:5px;border:1px solid var(--tl-panel-border-color);background:rgba(0,0,0,0.25);color:var(--tl-text);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
      load.addEventListener('click', () => {
        onLoad()
        buildFrames() // Panels sind umgesprungen → Editor-Rahmen neu setzen
      })
      row.appendChild(load)
      if (action !== undefined) {
        const act = document.createElement('button')
        act.type = 'button'
        act.textContent = action.glyph
        act.title = action.title
        act.style.cssText =
          'flex:0 0 auto;font-size:12px;padding:5px 9px;border-radius:5px;border:1px solid var(--tl-panel-border-color);background:transparent;color:var(--tl-text);cursor:pointer'
        act.addEventListener('click', (e) => {
          e.stopPropagation()
          action.onClick()
        })
        row.appendChild(act)
      }
      listEl.appendChild(row)
    }
    for (const id of FIXED_PRESET_IDS) {
      const label = hasFixedOverride(id) ? `${t(FIXED_LABEL[id])} *` : t(FIXED_LABEL[id])
      listItem(
        label,
        () => applyFixedPreset(id),
        hasFixedOverride(id)
          ? {
              glyph: '↺',
              title: t('hud.editor.presets.reset'),
              onClick: () => {
                resetFixedPreset(id)
                buildToolbar()
              },
            }
          : undefined,
      )
    }
    for (const name of listUserPresets()) {
      listItem(name, () => applyUserPreset(name), {
        glyph: '✕',
        title: t('hud.editor.presets.delete'),
        onClick: () => {
          deleteUserPreset(name)
          buildToolbar()
        },
      })
    }
    quickWrap.append(quickHeader, saveRow, listEl)
    // NUR DEV: aktuelle Anordnung als eingebauten Standard speichern (schreibt in die JSON →
    // ausgeliefert für alle, nach Commit). Drei klare Knöpfe statt Dropdown. Im Live-Build weg.
    if (import.meta.env.DEV) {
      const devHeader = document.createElement('div')
      devHeader.textContent = '⚙ Als Standard speichern (dev)'
      devHeader.style.cssText = 'font-size:11px;font-weight:700;opacity:0.7;margin-top:4px'
      const devRow = document.createElement('div')
      devRow.style.cssText = 'display:flex;gap:6px'
      for (const id of FIXED_PRESET_IDS) {
        const b = presetBtn(t(FIXED_LABEL[id]))
        b.style.flex = '1'
        b.addEventListener('click', () => {
          const prev = b.textContent
          void saveFixedAsDefault(id).then((ok) => {
            b.textContent = ok ? '✓' : '✗'
            window.setTimeout(() => (b.textContent = prev), 1200)
          })
        })
        devRow.appendChild(b)
      }
      quickWrap.append(devHeader, devRow)
    }
    toolbar.appendChild(tabBar)
    toolbar.appendChild(quickWrap)
    toolbar.appendChild(paneDesign)
    toolbar.appendChild(paneLayout)
    toolbar.appendChild(paneElements)

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
    paneDesign.appendChild(themeRow)

    // Layout-Schalter: Slider-Heimat + Knopf-Anordnung (über hud-prefs, live).
    const layoutRow = document.createElement('div')
    // Vertikal gestapelt (jede Option eine Zeile) statt einer langen horizontalen Leiste.
    layoutRow.style.cssText = 'display:flex;flex-direction:column;align-items:stretch;gap:8px'
    // Diese Regler betreffen NUR die Desktop-Panels (Slider-Heimat, Knopf-Anordnung, Split/Merge,
    // Truppen-Stil) → im Maus-/Cockpit-Modus ausblenden (dort gibt es diese Panels nicht).
    const cockpit = opts.isCockpit?.() ?? false
    if (!cockpit) {
      layoutRow.appendChild(
        segmented(
          t('hud.editor.slider'),
          getHudPrefs().sliderHome,
          [
            ['action', t('hud.editor.slider.action')],
            ['resource', t('hud.editor.slider.resource')],
          ],
          (v) => setHudPref('sliderHome', v),
        ),
      )
      layoutRow.appendChild(
        segmented(
          t('hud.editor.buttons'),
          getHudPrefs().buttonsLayout,
          [
            ['row', t('hud.editor.buttons.row')],
            ['numpad', t('hud.editor.buttons.numpad')],
          ],
          (v) => setHudPref('buttonsLayout', v),
        ),
      )
      // Paket ↔ Einzelteile (Split/Merge) je Gruppe.
      layoutRow.appendChild(
        segmented(
          t('hud.editor.panel.resource'),
          getHudPrefs().resourceSplit ? 'split' : 'pkg',
          [
            ['pkg', t('hud.editor.merged')],
            ['split', t('hud.editor.split')],
          ],
          (v) => setHudPref('resourceSplit', v === 'split'),
        ),
      )
      layoutRow.appendChild(
        segmented(
          t('hud.editor.panel.action'),
          getHudPrefs().actionSplit ? 'split' : 'pkg',
          [
            ['pkg', t('hud.editor.merged')],
            ['split', t('hud.editor.split')],
          ],
          (v) => setHudPref('actionSplit', v === 'split'),
        ),
      )
      // Truppen-Anzeige: klassischer Balken oder füllende Kugel (live über hud-prefs).
      layoutRow.appendChild(
        segmented(
          t('hud.editor.troopStyle'),
          getHudPrefs().troopStyle,
          [
            ['bar', t('hud.editor.troopStyle.bar')],
            ['orb', t('hud.editor.troopStyle.orb')],
          ],
          (v) => setHudPref('troopStyle', v),
        ),
      )
    }
    // Steuerungs-Modus: auto / Desktop (klassisch) / Maus-Rad (Eck-Rad). Bleibt immer (Modus-Wechsel).
    layoutRow.appendChild(
      segmented(
        t('hud.editor.control'),
        getHudPrefs().controlMode,
        [
          ['auto', t('hud.editor.control.auto')],
          ['desktop', t('hud.editor.control.desktop')],
          ['touch', t('hud.editor.control.touch')],
        ],
        (v) => setHudPref('controlMode', v),
      ),
    )
    paneLayout.appendChild(layoutRow)

    paneElements.appendChild(elementsRow)
    refreshElementList()
    // Anfangs nur der aktive Reiter sichtbar.
    setActiveTab(activeEditorTab)

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
      opts.onDone?.()
    })
    right.appendChild(resetBtn)
    right.appendChild(doneBtn)
    actions.appendChild(right)
    toolbar.appendChild(actions)

    // Eck-Griff unten rechts: Werkzeugleiste größer/kleiner ziehen.
    const resizeGrip = document.createElement('div')
    resizeGrip.title = t('hud.editor.resizePanel')
    resizeGrip.style.cssText = [
      'position: absolute',
      'right: 1px',
      'bottom: 1px',
      'width: 16px',
      'height: 16px',
      'cursor: nwse-resize',
      'border-right: 2px solid var(--tl-accent)',
      'border-bottom: 2px solid var(--tl-accent)',
      'border-bottom-right-radius: 6px',
      'opacity: 0.6',
      'pointer-events: auto',
    ].join(';')
    resizeGrip.addEventListener('pointerdown', startToolbarResize)
    toolbar.appendChild(resizeGrip)
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
    refreshElementList()
  }

  // ---- Layout-Presets: nächster freier Auto-Name für einen eigenen Slot ----------------------
  // Anwenden/Speichern/Löschen laufen über `hud-presets` (feste Vorlagen + eigene Slots); das
  // Dropdown + die Knöpfe sind in `buildToolbar` verdrahtet.
  function nextSlotName(): string {
    const existing = new Set(listUserPresets())
    let n = 1
    while (existing.has(t('hud.editor.presets.slotName', { n: String(n) }))) n++
    return t('hud.editor.presets.slotName', { n: String(n) })
  }

  // Panels, die der Editor nur fürs Bearbeiten sichtbar gemacht hat (zustandsbedingt leer wie
  // 'attacks' ohne laufenden Kampf) — beim Schließen wieder auf `display:none` zurücksetzen.
  const forcedShown = new Set<string>()

  // ---- Frames (neu) aufbauen — auch nach Split/Merge, da sich der Panel-Satz ändert ----------
  function buildFrames(): void {
    for (const [, frame] of frames) frame.remove()
    frames.clear()
    panelMap.clear()
    forcedShown.clear()
    // Nur die Panels des aktiven Modus bearbeiten: im Cockpit-/Maus-Modus die Cockpit-Elemente
    // (Rad/Top-Leiste/Angriffs-Slider) + die „beide Modi"-Panels (Angriffe/Feed/Feedback); im
    // Desktop-Modus alles AUSSER den reinen Cockpit-Elementen. So tauchen die im jeweils anderen
    // Modus ersetzten Panels nie als überdimensionierte Platzhalter auf.
    const cockpit = opts.isCockpit?.() ?? false
    for (const [id, el] of panelElements()) {
      const show = COCKPIT_PANEL_IDS.has(id) ? cockpit : BOTH_PANEL_IDS.has(id) || !cockpit
      if (!show) continue
      panelMap.set(id, el)
    }
    for (const [id, el] of panelMap) {
      const hidden = getPanel(id)?.hidden === true
      // Nicht ausgeblendete, aber gerade unsichtbare Panels (display:none, z. B. leeres 'attacks')
      // fürs Bearbeiten einblenden — nur die `display:none`-Inline-Regel lösen (kein flex/block
      // anderer Panels anfassen).
      if (!hidden && el.style.display === 'none') {
        el.style.display = ''
        forcedShown.add(id)
      }
      // Auch ausgeblendete Panels vermessen (kurz einblenden), damit Position/Größe stimmen.
      if (hidden) el.style.display = ''
      arm(id, el)
      buildFrame(id, el, forcedShown.has(id))
      if (hidden) {
        el.style.display = 'none'
        const frame = frames.get(id)
        if (frame !== undefined) frame.style.display = 'none'
      }
    }
  }

  // ---- Öffnen / Schließen --------------------------------------------------------------------
  function openEditor(): void {
    if (open) return
    open = true
    buildFrames()
    buildToolbar()
    toolbar.style.display = 'flex'
  }

  function close(): void {
    if (!open) return
    open = false
    // Nur fürs Bearbeiten eingeblendete (leere) Panels wieder verstecken — ihr Live-Update
    // setzt das `display` ohnehin neu, sobald wieder Inhalt da ist.
    for (const id of forcedShown) {
      if (getPanel(id)?.hidden !== true) panelMap.get(id)?.style.setProperty('display', 'none')
    }
    forcedShown.clear()
    for (const [, frame] of frames) frame.remove()
    frames.clear()
    panelMap.clear()
    toolbar.style.display = 'none'
    hideGuides()
    // Cockpit-Sichtbarkeit neu anwenden (Rad/Top-Leiste evtl. im Editor aus-/eingeblendet).
    opts.onClose?.()
  }

  // Split/Merge (und andere Layout-Prefs) ändern den Panel-Satz → Rahmen + Werkzeugleiste neu.
  const offPrefs = onHudPrefsChange(() => {
    if (open) {
      buildFrames()
      buildToolbar()
    }
  })

  return {
    open: openEditor,
    isOpen: () => open,
    destroy(): void {
      close()
      offPrefs()
      toolbar.remove()
      guideV.remove()
      guideH.remove()
    },
  }
}
