/**
 * Minimap mit Torus-Wrap-Indikator.
 *
 * - Zeigt die ganze Karte verkleinert in der unteren rechten Ecke
 * - Zeichnet den aktuell sichtbaren Viewport als helles Rechteck. Beim Torus
 *   kann das Rechteck über den Rand wrappen — dann werden mehrere Kopien
 *   gezeichnet, was den Wrap visuell erfahrbar macht.
 * - Gestrichelter Rahmen um die Minimap signalisiert "Welt loopt hier".
 *
 * Update-Frequenz: jeden Render-Frame. Bei großen Karten könnte das teuer
 * werden — falls Profiling das zeigt, auf z.B. alle 6 Frames runterdrosseln.
 */

import type { GameState } from '../core/game'
import type { Camera } from '../render/renderer'
import { registerPanel, unregisterPanel } from './hud-layout'
import { registerScalable } from './ui-scale'
import { t } from '../i18n'

export interface MinimapApi {
  update(): void
  /** Position live umschalten (Steuerungs-Modus). */
  setMobile(on: boolean): void
  /** Komplett ein-/ausblenden (Mobile-Cockpit: Minimap aus, das Eck-Rad übernimmt). */
  setVisible(on: boolean): void
  /**
   * In die RTS-Kommandoleiste einhängen (`slot`) bzw. zurück an den normalen Eck-Platz (`null`).
   * Klick-Mapping bleibt korrekt (rechnet über getBoundingClientRect). Idempotent.
   */
  setCommandBarSlot(slot: HTMLElement | null): void
  destroy(): void
}

const TARGET_SIZE = 192
const MARGIN = 12
const VIEWPORT_COLOR = 'rgba(255, 255, 255, 0.6)'
const BORDER_COLOR = 'rgba(255, 255, 255, 0.4)'
const BG_COLOR = 'rgba(0, 0, 0, 0.4)'

export interface MinimapDeps {
  readonly container: HTMLElement
  readonly state: GameState
  readonly camera: Camera
  /** Map-Auflösungs-Bitmap vom Renderer (wird pro Frame aktualisiert). */
  readonly getBitmap: () => HTMLCanvasElement
  /** Aktuelle CSS-Pixel-Größe des Haupt-Viewports. */
  readonly getViewportSize: () => { readonly width: number; readonly height: number }
  /** Touch/Mobile: Minimap oben rechts (sonst überlappt das Eck-Rad unten rechts). */
  readonly mobile?: boolean
}

export function createMinimap(deps: MinimapDeps): MinimapApi {
  const { container, state, camera, getBitmap, getViewportSize } = deps
  const mobile = deps.mobile === true

  const mapW = state.map.width
  const mapH = state.map.height
  const aspect = mapW / mapH
  const w = aspect >= 1 ? TARGET_SIZE : Math.round(TARGET_SIZE * aspect)
  const h = aspect >= 1 ? Math.round(TARGET_SIZE / aspect) : TARGET_SIZE

  const wrapper = document.createElement('div')
  // Mobile: oben rechts (sonst überlappt das immer sichtbare Eck-Rad unten rechts).
  wrapper.style.cssText = [
    'position: absolute',
    mobile ? `top: ${String(MARGIN)}px` : `bottom: ${String(MARGIN)}px`,
    `right: ${String(MARGIN)}px`,
    'padding: 4px',
    `background: ${BG_COLOR}`,
    'border-radius: 6px',
    'z-index: 10',
    `outline: 2px dashed ${BORDER_COLOR}`,
    'outline-offset: -2px',
  ].join(';')

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.style.cssText = `display: block; width: ${w}px; height: ${h}px`
  wrapper.appendChild(canvas)

  // Einklapp-Knopf (oben links auf der Karte): blendet die Karte aus → nur der Knopf bleibt.
  let collapsed = false
  const collapseBtn = document.createElement('button')
  collapseBtn.type = 'button'
  collapseBtn.style.cssText = [
    'position: absolute',
    'top: 2px',
    'left: 2px',
    'width: 20px',
    'height: 20px',
    'padding: 0',
    'font: 700 13px/1 var(--tl-font, monospace)',
    'color: var(--tl-text, #fff)',
    'background: rgba(0,0,0,0.5)',
    'border: 1px solid var(--tl-panel-border-color, rgba(255,255,255,0.3))',
    'border-radius: 4px',
    'cursor: pointer',
    'z-index: 1',
  ].join(';')
  const applyCollapsed = (): void => {
    canvas.style.display = collapsed ? 'none' : 'block'
    collapseBtn.textContent = collapsed ? '+' : '–'
    collapseBtn.title = collapsed ? t('minimap.expand') : t('minimap.collapse')
    // Eingeklappt: Rahmen-Padding raus, nur der Knopf bleibt sichtbar.
    wrapper.style.padding = collapsed ? '0' : '4px'
  }
  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    collapsed = !collapsed
    applyCollapsed()
  })
  wrapper.appendChild(collapseBtn)
  applyCollapsed()

  container.appendChild(wrapper)
  registerScalable(wrapper)
  registerPanel('minimap', wrapper)
  // Sauberer Heimat-Zustand (inkl. zoom) — Restore-Ziel nach einem Aufenthalt in der
  // RTS-Kommandoleiste (ein Laufzeit-Snapshot wäre durch den HUD-Editor „armiert").
  const homeCss = wrapper.style.cssText

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('Minimap: 2D context not available')
  ctx.imageSmoothingEnabled = false

  // Klick/Ziehen auf die Karte → Kamera dorthin springen (zentrieren). Die Welt-Position wird aus
  // der Klick-Pixel-Position über die TATSÄCHLICH gerenderte Canvas-Größe (getBoundingClientRect)
  // zurückgerechnet → robust gegen UI-Skalierung. Ziehen scrubt die Kamera kontinuierlich; der
  // Torus-Wrap nutzt dasselbe ((v%s)+s)%s-Idiom wie der Pan-Code in input.ts.
  canvas.style.cursor = 'pointer'
  canvas.style.touchAction = 'none' // Touch-Drag auf der Minimap scrollt nicht die Seite
  let panning = false
  const jumpToPointer = (e: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const worldX = ((e.clientX - rect.left) / rect.width) * mapW
    const worldY = ((e.clientY - rect.top) / rect.height) * mapH
    camera.x = ((worldX % mapW) + mapW) % mapW
    camera.y = ((worldY % mapH) + mapH) % mapH
  }
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    panning = true
    canvas.setPointerCapture(e.pointerId)
    jumpToPointer(e)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (panning) jumpToPointer(e)
  })
  const endPan = (e: PointerEvent): void => {
    panning = false
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
  }
  canvas.addEventListener('pointerup', endPan)
  canvas.addEventListener('pointercancel', endPan)

  /** Box-Geometrie (Minimap-Pixel) des sichtbaren Viewports. */
  function viewportBox(): { x: number; y: number; bw: number; bh: number } {
    const viewport = getViewportSize()
    const z = camera.zoom
    const worldW = viewport.width / z
    const worldH = viewport.height / z
    return {
      x: (camera.x - worldW / 2) * (w / mapW),
      y: (camera.y - worldH / 2) * (h / mapH),
      bw: worldW * (w / mapW),
      bh: worldH * (h / mapH),
    }
  }

  function update(): void {
    const ctx2 = ctx
    if (ctx2 === null) return
    ctx2.clearRect(0, 0, w, h)
    const bitmap = getBitmap()
    const { x: boxX, y: boxY, bw, bh } = viewportBox()

    // 1) Ganze Karte gedimmt als Hintergrund.
    ctx2.globalAlpha = 0.42
    ctx2.drawImage(bitmap, 0, 0, w, h)
    ctx2.globalAlpha = 1

    // 2) Sichtbaren Viewport-Bereich voll-hell „ausstanzen" (3×3 wegen Torus-Wrap)
    //    → man sieht sofort, welcher Anteil der Welt gerade im Bild ist (Weltgröße).
    ctx2.save()
    ctx2.beginPath()
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        ctx2.rect(boxX + dx * w, boxY + dy * h, bw, bh)
      }
    }
    ctx2.clip()
    ctx2.drawImage(bitmap, 0, 0, w, h)
    ctx2.restore()

    // 3) Rahmen um den sichtbaren Bereich.
    ctx2.lineWidth = 1.5
    ctx2.strokeStyle = VIEWPORT_COLOR
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        ctx2.strokeRect(boxX + dx * w, boxY + dy * h, bw, bh)
      }
    }
  }

  // Gerade in der Kommandoleiste eingehängt?
  let inBar = false

  return {
    update,
    /** Position live umschalten (Steuerungs-Modus): Mobile = oben rechts, sonst unten rechts. */
    setMobile(on: boolean): void {
      if (inBar) return // in der Leiste: Eck-Anker nicht anfassen (relative Position!)
      if (on) {
        wrapper.style.top = `${String(MARGIN)}px`
        wrapper.style.bottom = 'auto'
      } else {
        wrapper.style.bottom = `${String(MARGIN)}px`
        wrapper.style.top = 'auto'
      }
    },
    setVisible(on: boolean): void {
      wrapper.style.display = on ? '' : 'none'
    },
    setCommandBarSlot(slot: HTMLElement | null): void {
      if (slot !== null) {
        inBar = true
        unregisterPanel('minimap') // kein Clamp/Editor-Drag in der Leiste
        slot.appendChild(wrapper)
        // Relativ statt absolut: bleibt Anker für den Einklapp-Knopf (position:absolute).
        // Editor-Arm-Reste (transform/zoom/left/top) mit überschreiben.
        wrapper.style.position = 'relative'
        wrapper.style.top = 'auto'
        wrapper.style.bottom = 'auto'
        wrapper.style.left = 'auto'
        wrapper.style.right = 'auto'
        wrapper.style.transform = 'none'
        registerScalable(wrapper) // zoom auf aktuellen UI-Maßstab (Editor setzt ihn auf 1)
      } else if (inBar) {
        inBar = false
        wrapper.style.cssText = homeCss
        container.appendChild(wrapper)
        registerScalable(wrapper) // re-anwenden: aktueller UI-Maßstab statt Snapshot-Stand
        registerPanel('minimap', wrapper)
      }
    },
    destroy(): void {
      unregisterPanel('minimap')
      wrapper.remove()
    },
  }
}
