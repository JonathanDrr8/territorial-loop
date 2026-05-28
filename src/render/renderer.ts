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
  /** Setzt das aktuelle Hover-Tile für Outline-Rendering. */
  setHoverTile(worldX: number, worldY: number): void
  /** Entfernt den Hover-Tile-Outline (Cursor verließ Canvas). */
  clearHoverTile(): void
  destroy(): void
}

const NEUTRAL_R = 30
const NEUTRAL_G = 30
const NEUTRAL_B = 35
const WATER_R = 24
const WATER_G = 48
const WATER_B = 92
const BG_FILL = '#0a0a10'

const IS_LAND_BIT = 0b1000_0000

const OWNER_MASK = 0x0fff

const MARKER_DURATION_MS = 500
const MARKER_RADIUS_START = 6
const MARKER_RADIUS_END = 40

const FLASH_DURATION_MS = 280
const MAX_FLASHES_PER_TICK = 600

interface ClickMarker {
  worldX: number
  worldY: number
  startTime: number
}

interface CaptureFlash {
  tileX: number
  tileY: number
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

    const terrain = state.map.terrain
    for (let i = 0; i < len; i++) {
      const v = mapState[i]
      if (v === undefined) continue
      const t = terrain[i]
      const o = i * 4
      // Wasser: terrain-bit 7 = 0 → unpassierbar, eigene Farbe, owner ignoriert
      if (t !== undefined && (t & IS_LAND_BIT) === 0) {
        data[o] = WATER_R
        data[o + 1] = WATER_G
        data[o + 2] = WATER_B
        data[o + 3] = 255
        continue
      }
      const owner = v & OWNER_MASK
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

    // Diff gegen vorigen Snapshot: Owner-Wechsel sammeln, in flashes pushen.
    // Beim ersten Paint gibt's keinen Snapshot — dann nur kopieren ohne Flashes.
    if (lastOwnerSnapshot !== null && lastOwnerSnapshot.length === mapState.length) {
      const now = performance.now()
      let added = 0
      for (let i = 0; i < mapState.length; i++) {
        const prev = lastOwnerSnapshot[i]
        const curr = mapState[i]
        if (prev === undefined || curr === undefined) continue
        const prevOwner = prev & OWNER_MASK
        const currOwner = curr & OWNER_MASK
        if (prevOwner === currOwner) continue
        // Skip wenn jetzt neutral (z.B. wenn jemand alle Tiles verlor — Anti-Spam)
        if (currOwner === 0) continue
        flashes.push({
          tileX: i % state.map.width,
          tileY: Math.floor(i / state.map.width),
          startTime: now,
        })
        added++
        if (added >= MAX_FLASHES_PER_TICK) break
      }
    }
    if (lastOwnerSnapshot === null || lastOwnerSnapshot.length !== mapState.length) {
      lastOwnerSnapshot = new Uint16Array(mapState.length)
    }
    lastOwnerSnapshot.set(mapState)
  }

  function drawFlashes(): void {
    if (flashes.length === 0) return
    const now = performance.now()
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]
      if (f !== undefined && now - f.startTime >= FLASH_DURATION_MS) {
        flashes.splice(i, 1)
      }
    }
    if (flashes.length === 0) return

    const cssW = container.clientWidth
    const cssH = container.clientHeight
    const z = camera.zoom
    const halfW = cssW / 2
    const halfH = cssH / 2
    const mapW = state.map.width
    const mapH = state.map.height

    screenCtx.save()
    for (const f of flashes) {
      const t = Math.max(0, Math.min(1, (now - f.startTime) / FLASH_DURATION_MS))
      const alpha = (1 - t) * 0.7
      screenCtx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const wx = f.tileX + dx * mapW
          const wy = f.tileY + dy * mapH
          const sx = (wx - camera.x) * z + halfW
          const sy = (wy - camera.y) * z + halfH
          if (sx + z < 0 || sx > cssW || sy + z < 0 || sy > cssH) continue
          screenCtx.fillRect(sx, sy, z, z)
        }
      }
    }
    screenCtx.restore()
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

    // Kachel-Größe leicht aufrunden (+1px) und Positionen auf ganze Pixel runden,
    // damit benachbarte Map-Kopien sich minimal überlappen statt Lücken (Gitterlinien)
    // bei fraktionalem Zoom zu lassen.
    const tileDrawW = Math.ceil(mapW * z) + 1
    const tileDrawH = Math.ceil(mapH * z) + 1

    for (let wx = xStart; wx < worldRight; wx += mapW) {
      for (let wy = yStart; wy < worldBottom; wy += mapH) {
        const sx = Math.round((wx - worldLeft) * z)
        const sy = Math.round((wy - worldTop) * z)
        screenCtx.drawImage(offscreen, sx, sy, tileDrawW, tileDrawH)
      }
    }
  }

  const markers: ClickMarker[] = []
  let hoverTile: { x: number; y: number } | null = null
  // Bitmap-Caching: nur neu malen wenn sich der Sim-Tick geändert hat.
  // Render-Loop läuft mit 60 fps, Sim mit 10 Hz → 6× weniger Pixel-Writes.
  let lastBitmapTick: number = -1
  // Capture-Flash: kurzer Highlight wenn Tile-Owner gewechselt hat. Wir vergleichen
  // gegen einen Snapshot vom letzten Paint und sammeln pro Tick die Änderungen.
  let lastOwnerSnapshot: Uint16Array | null = null
  const flashes: CaptureFlash[] = []

  function drawHoverOutline(): void {
    if (hoverTile === null) return
    const cssW = container.clientWidth
    const cssH = container.clientHeight
    const z = camera.zoom
    const halfW = cssW / 2
    const halfH = cssH / 2
    const mapW = state.map.width
    const mapH = state.map.height
    const tileX = hoverTile.x
    const tileY = hoverTile.y
    screenCtx.save()
    screenCtx.lineWidth = 1.5
    screenCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    // Outline 1×1-Tile am world (tileX, tileY); 3×3 Wrap-Replikation
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const wx = tileX + dx * mapW
        const wy = tileY + dy * mapH
        const sx = (wx - camera.x) * z + halfW
        const sy = (wy - camera.y) * z + halfH
        const sz = z
        if (sx + sz < 0 || sx > cssW || sy + sz < 0 || sy > cssH) continue
        // Strich-Rechteck so dass Stroke nicht durch den Tile geht
        screenCtx.strokeRect(sx + 0.5, sy + 0.5, sz, sz)
      }
    }
    screenCtx.restore()
  }

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

  function drawAttackTargets(): void {
    const time = performance.now() * 0.001
    // Sanfte 1.5 Hz Pulsation, alpha pulsiert zwischen 0.5 und 0.95
    const pulse = 0.5 + Math.abs(Math.sin(time * Math.PI * 1.5)) * 0.45

    const cssW = container.clientWidth
    const cssH = container.clientHeight
    const mapW = state.map.width
    const mapH = state.map.height
    const z = camera.zoom
    const halfW = cssW / 2
    const halfH = cssH / 2

    screenCtx.save()
    screenCtx.lineWidth = 2

    for (const player of state.players.values()) {
      if (!player.isHuman) continue
      if (player.attacks.length === 0) continue

      const r = (player.color >>> 24) & 0xff
      const g = (player.color >>> 16) & 0xff
      const b = (player.color >>> 8) & 0xff
      screenCtx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${pulse.toFixed(3)})`

      for (const attack of player.attacks) {
        const fx = attack.focusTile % mapW
        const fy = Math.floor(attack.focusTile / mapW)
        // Pulse-Radius wandert sanft zwischen 7 und 11 px
        const baseR = 9 + Math.sin(time * Math.PI * 2) * 2

        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const wx = fx + dx * mapW
            const wy = fy + dy * mapH
            const sx = (wx - camera.x) * z + halfW
            const sy = (wy - camera.y) * z + halfH
            if (sx < -baseR || sx > cssW + baseR || sy < -baseR || sy > cssH + baseR) continue
            // Crosshair: Ring + 4 kurze Striche
            screenCtx.beginPath()
            screenCtx.arc(sx, sy, baseR, 0, Math.PI * 2)
            screenCtx.stroke()
            const tickLen = 4
            screenCtx.beginPath()
            screenCtx.moveTo(sx - baseR - tickLen, sy)
            screenCtx.lineTo(sx - baseR, sy)
            screenCtx.moveTo(sx + baseR, sy)
            screenCtx.lineTo(sx + baseR + tickLen, sy)
            screenCtx.moveTo(sx, sy - baseR - tickLen)
            screenCtx.lineTo(sx, sy - baseR)
            screenCtx.moveTo(sx, sy + baseR)
            screenCtx.lineTo(sx, sy + baseR + tickLen)
            screenCtx.stroke()
          }
        }
      }
    }
    screenCtx.restore()
  }

  function render(): void {
    if (state.tick !== lastBitmapTick) {
      paintBitmap()
      lastBitmapTick = state.tick
    }
    drawTiled()
    drawFlashes()
    drawHoverOutline()
    drawAttackTargets()
    drawMarkers()
  }

  function addClickMarker(worldX: number, worldY: number): void {
    markers.push({ worldX, worldY, startTime: performance.now() })
  }

  function setHoverTile(worldX: number, worldY: number): void {
    const mapW = state.map.width
    const mapH = state.map.height
    const tileX = ((Math.floor(worldX) % mapW) + mapW) % mapW
    const tileY = ((Math.floor(worldY) % mapH) + mapH) % mapH
    hoverTile = { x: tileX, y: tileY }
  }

  function clearHoverTile(): void {
    hoverTile = null
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
    setHoverTile,
    clearHoverTile,
    destroy,
  }
}
