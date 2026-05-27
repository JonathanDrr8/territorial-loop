/**
 * Canvas-2D-Renderer mit Torus-Wrap.
 *
 * Ansatz:
 * - Ein Offscreen-Canvas in Map-Auflösung (z.B. 256×256) hält die State-Bitmap;
 *   pro Frame wird Owner → Player-Farbe in eine `ImageData` gemalt.
 * - Ein On-Screen-Canvas füllt den Viewport. Pro Frame: clear + tile-Drawloop
 *   die den Offscreen-Canvas mit `drawImage` so oft kachelt wie nötig — das ist
 *   der Torus-Wrap.
 *
 * Warum nicht Pixi/WebGL: WebGL-Rendering kann auf einigen Linux/Compositor-
 * Konfigurationen still ausfallen (Canvas bleibt schwarz). Canvas2D ist 100%
 * portabel und für unsere Map-Größen mehr als schnell genug.
 */

import type { GameState } from '../core/game'

export interface Camera {
  /** Welt-Koord die am Screen-Center erscheint. */
  x: number
  y: number
  /** Zoom-Faktor: 1 = pixelgenau, 2 = doppelt gross, 0.5 = halb. */
  zoom: number
}

export interface Renderer {
  /** Das On-Screen-Canvas das in den DOM eingehängt ist. */
  readonly canvas: HTMLCanvasElement
  readonly camera: Camera
  /** Liest den aktuellen GameState aus und zeichnet einen Frame. */
  render(): void
  /**
   * Das Map-Auflösungs-Bitmap. Wird pro `render()`-Aufruf aktualisiert.
   * Read-only: Konsumenten (z.B. Minimap) zeichnen es ab, mutieren es nicht.
   */
  getBitmap(): HTMLCanvasElement
  /** Konvertiert eine Maus-Position (in CSS-Pixeln) in Welt-Koords. */
  screenToWorld(screenX: number, screenY: number): { readonly x: number; readonly y: number }
  /**
   * Legt einen expandierenden Klick-Ring an die Welt-Position. Wird über
   * `MARKER_DURATION_MS` ausgeblendet und danach automatisch entfernt.
   */
  addClickMarker(worldX: number, worldY: number): void
  destroy(): void
}

const NEUTRAL_R = 30
const NEUTRAL_G = 30
const NEUTRAL_B = 35
const BG_FILL = '#0a0a10'

const OWNER_MASK = 0x0fff

const MARKER_DURATION_MS = 500
const MARKER_RADIUS_START = 6
const MARKER_RADIUS_END = 40

interface ClickMarker {
  worldX: number
  worldY: number
  startTime: number
}

function get2dContext(canvas: HTMLCanvasElement, label: string): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (ctx === null) {
    throw new Error(`Renderer: 2D context for ${label} not available`)
  }
  return ctx
}

export function createRenderer(container: HTMLElement, state: GameState): Renderer {
  // On-screen canvas, full container size
  const screenCanvas = document.createElement('canvas')
  screenCanvas.style.display = 'block'
  screenCanvas.style.touchAction = 'none'
  screenCanvas.style.cursor = 'crosshair'
  container.appendChild(screenCanvas)

  const screenCtx = get2dContext(screenCanvas, 'screen')
  screenCtx.imageSmoothingEnabled = false

  // Offscreen canvas in Map-Auflösung
  const offscreen = document.createElement('canvas')
  offscreen.width = state.map.width
  offscreen.height = state.map.height
  const offscreenCtx = get2dContext(offscreen, 'offscreen')
  const imageData = offscreenCtx.createImageData(state.map.width, state.map.height)

  function resize(): void {
    const dpr = window.devicePixelRatio || 1
    const w = container.clientWidth
    const h = container.clientHeight
    screenCanvas.style.width = w + 'px'
    screenCanvas.style.height = h + 'px'
    screenCanvas.width = Math.floor(w * dpr)
    screenCanvas.height = Math.floor(h * dpr)
    // Reset transform — wir skalieren manuell pro frame
    screenCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    screenCtx.imageSmoothingEnabled = false
  }
  resize()
  window.addEventListener('resize', resize)

  const camera: Camera = {
    x: state.map.width / 2,
    y: state.map.height / 2,
    zoom: 2,
  }

  function paintBitmap(): void {
    const data = imageData.data
    const mapState = state.map.state
    const players = state.players
    const len = mapState.length

    // Mini-LUT pro Frame: ownerId → [r,g,b,a]
    const lut = new Map<number, readonly [number, number, number, number]>()
    for (const p of players.values()) {
      lut.set(p.id, [
        (p.color >>> 24) & 0xff,
        (p.color >>> 16) & 0xff,
        (p.color >>> 8) & 0xff,
        p.color & 0xff,
      ])
    }

    for (let i = 0; i < len; i++) {
      const v = mapState[i]
      if (v === undefined) continue
      const owner = v & OWNER_MASK
      const o = i * 4
      if (owner === 0) {
        data[o] = NEUTRAL_R
        data[o + 1] = NEUTRAL_G
        data[o + 2] = NEUTRAL_B
        data[o + 3] = 255
      } else {
        const rgba = lut.get(owner)
        if (rgba === undefined) {
          data[o] = 255
          data[o + 1] = 0
          data[o + 2] = 255
          data[o + 3] = 255
        } else {
          data[o] = rgba[0]
          data[o + 1] = rgba[1]
          data[o + 2] = rgba[2]
          data[o + 3] = rgba[3]
        }
      }
    }

    offscreenCtx.putImageData(imageData, 0, 0)
  }

  function drawTiled(): void {
    const cssW = container.clientWidth
    const cssH = container.clientHeight
    const mapW = state.map.width
    const mapH = state.map.height
    const z = camera.zoom

    // Welt-Koords der Screen-Ecke top-left
    const worldLeft = camera.x - cssW / 2 / z
    const worldTop = camera.y - cssH / 2 / z
    const worldRight = worldLeft + cssW / z
    const worldBottom = worldTop + cssH / z

    // Linker und oberer Rand des ersten zu zeichnenden Map-Tiles
    const xStart = Math.floor(worldLeft / mapW) * mapW
    const yStart = Math.floor(worldTop / mapH) * mapH

    screenCtx.fillStyle = BG_FILL
    screenCtx.fillRect(0, 0, cssW, cssH)

    for (let wx = xStart; wx < worldRight; wx += mapW) {
      for (let wy = yStart; wy < worldBottom; wy += mapH) {
        const sx = (wx - worldLeft) * z
        const sy = (wy - worldTop) * z
        screenCtx.drawImage(offscreen, sx, sy, mapW * z, mapH * z)
      }
    }
  }

  const markers: ClickMarker[] = []

  function drawMarkers(): void {
    if (markers.length === 0) return
    const now = performance.now()
    // Remove expired markers in-place (reverse loop for splice safety)
    for (let i = markers.length - 1; i >= 0; i--) {
      const m = markers[i]
      if (m !== undefined && now - m.startTime >= MARKER_DURATION_MS) {
        markers.splice(i, 1)
      }
    }
    if (markers.length === 0) return

    const cssW = container.clientWidth
    const cssH = container.clientHeight
    const mapW = state.map.width
    const mapH = state.map.height
    const z = camera.zoom
    const halfW = cssW / 2
    const halfH = cssH / 2

    screenCtx.save()
    screenCtx.lineWidth = 3
    for (const m of markers) {
      const tRaw = (now - m.startTime) / MARKER_DURATION_MS
      const t = Math.max(0, Math.min(1, tRaw))
      const radius = MARKER_RADIUS_START + t * (MARKER_RADIUS_END - MARKER_RADIUS_START)
      const alpha = 1 - t
      screenCtx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`

      // Wegen Torus: Welt-Position kann mehrere Screen-Positionen erzeugen.
      // Wir prüfen 3×3 Wrap-Offsets und zeichnen sichtbare.
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const wx = m.worldX + dx * mapW
          const wy = m.worldY + dy * mapH
          const sx = (wx - camera.x) * z + halfW
          const sy = (wy - camera.y) * z + halfH
          if (sx < -radius || sx > cssW + radius || sy < -radius || sy > cssH + radius) continue
          screenCtx.beginPath()
          screenCtx.arc(sx, sy, radius, 0, Math.PI * 2)
          screenCtx.stroke()
        }
      }
    }
    screenCtx.restore()
  }

  function render(): void {
    paintBitmap()
    drawTiled()
    drawMarkers()
  }

  function addClickMarker(worldX: number, worldY: number): void {
    markers.push({ worldX, worldY, startTime: performance.now() })
  }

  function screenToWorld(
    screenX: number,
    screenY: number,
  ): { readonly x: number; readonly y: number } {
    const halfW = container.clientWidth / 2
    const halfH = container.clientHeight / 2
    return {
      x: (screenX - halfW) / camera.zoom + camera.x,
      y: (screenY - halfH) / camera.zoom + camera.y,
    }
  }

  function destroy(): void {
    window.removeEventListener('resize', resize)
    screenCanvas.remove()
  }

  function getBitmap(): HTMLCanvasElement {
    return offscreen
  }

  return {
    canvas: screenCanvas,
    camera,
    render,
    screenToWorld,
    getBitmap,
    addClickMarker,
    destroy,
  }
}
