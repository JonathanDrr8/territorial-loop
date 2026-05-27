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

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('Minimap: 2D context not available')
  ctx.imageSmoothingEnabled = false

  function drawViewportBox(): void {
    const ctx2 = ctx
    if (ctx2 === null) return
    const viewport = getViewportSize()
    const z = camera.zoom
    // Welt-Koords der sichtbaren Region
    const worldW = viewport.width / z
    const worldH = viewport.height / z
    const worldLeft = camera.x - worldW / 2
    const worldTop = camera.y - worldH / 2

    // Minimap-Pixel pro Welt-Tile
    const sx = w / mapW
    const sy = h / mapH

    // Box-Position auf der Minimap (kann negativ sein oder über mapW hinaus gehen)
    const boxX = worldLeft * sx
    const boxY = worldTop * sy
    const boxW = worldW * sx
    const boxH = worldH * sy

    ctx2.lineWidth = 1
    ctx2.strokeStyle = VIEWPORT_COLOR

    // Zeichne die Box 3×3 mal mit Wrap-Offsets — wenn sie über den Rand geht
    // erscheint die "andere Hälfte" auf der gegenüberliegenden Seite.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        ctx2.strokeRect(boxX + dx * w, boxY + dy * h, boxW, boxH)
      }
    }
  }

  function update(): void {
    const ctx2 = ctx
    if (ctx2 === null) return
    // Hintergrund clearen (für Transparenz / saubere Wrap-Box)
    ctx2.clearRect(0, 0, w, h)
    // Bitmap downscaled malen
    ctx2.drawImage(getBitmap(), 0, 0, w, h)
    // Viewport-Box drüber
    drawViewportBox()
  }

  return {
    update,
    destroy(): void {
      wrapper.remove()
    },
  }
}
