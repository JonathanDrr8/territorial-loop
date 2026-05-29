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
import { registerScalable } from './ui-scale'

export interface MinimapApi {
  update(): void
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
}

export function createMinimap(deps: MinimapDeps): MinimapApi {
  const { container, state, camera, getBitmap, getViewportSize } = deps

  const mapW = state.map.width
  const mapH = state.map.height
  const aspect = mapW / mapH
  const w = aspect >= 1 ? TARGET_SIZE : Math.round(TARGET_SIZE * aspect)
  const h = aspect >= 1 ? Math.round(TARGET_SIZE / aspect) : TARGET_SIZE

  const wrapper = document.createElement('div')
  wrapper.style.cssText = [
    'position: absolute',
    `bottom: ${MARGIN}px`,
    `right: ${MARGIN}px`,
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
  container.appendChild(wrapper)
  registerScalable(wrapper)

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('Minimap: 2D context not available')
  ctx.imageSmoothingEnabled = false

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

  return {
    update,
    destroy(): void {
      wrapper.remove()
    },
  }
}
