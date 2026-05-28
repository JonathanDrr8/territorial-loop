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

import type { BuildingType } from '../core/buildings'
import type { GameState } from '../core/game'
import type { Boat, TradeShip } from '../core/ships'
import { HEIGHT_MASK, IMPASSABLE_HEIGHT, IS_LAND_BIT } from '../world/terrain'

const BUILDING_GLYPH: Record<BuildingType, string> = {
  city: 'C',
  defense: 'D',
  market: '$',
  port: 'P',
}

/** Packed RGBA → CSS rgb() (lokal, um render→ui Cross-Layer-Import zu vermeiden). */
function rgbaToCssLocal(rgba: number): string {
  const r = (rgba >>> 24) & 0xff
  const g = (rgba >>> 16) & 0xff
  const b = (rgba >>> 8) & 0xff
  return `rgb(${r},${g},${b})`
}

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
const ROCK_R = 70
const ROCK_G = 66
const ROCK_B = 62
const BG_FILL = '#0a0a10'

const OWNER_MASK = 0x0fff

const MARKER_DURATION_MS = 500
const MARKER_RADIUS_START = 6
const MARKER_RADIUS_END = 40

const FLASH_DURATION_MS = 280
const MAX_FLASHES_PER_TICK = 600

/** Schwerpunkt-Neuberechnung alle N Sim-Ticks (Performance vs. Aktualität). */
const CENTROID_INTERVAL = 10

/** Kompaktes Zahlenformat fürs Overlay: 1234567 → "1.2M", 12345 → "12k". */
function fmtCompactRender(value: number): string {
  const v = Math.round(value)
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(v)
}

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
    const w = state.map.width
    const h = state.map.height

    // Mini-LUT pro Frame: ownerId → { inner [r,g,b], border [r,g,b] }
    // border = aufgehellte Variante (OpenFront-Stil: Grenztiles heller als Inneres).
    interface ColorEntry {
      readonly ir: number
      readonly ig: number
      readonly ib: number
      readonly br: number
      readonly bg: number
      readonly bb: number
    }
    const lut = new Map<number, ColorEntry>()
    let humanId = -1
    for (const p of players.values()) {
      const r = (p.color >>> 24) & 0xff
      const g = (p.color >>> 16) & 0xff
      const b = (p.color >>> 8) & 0xff
      lut.set(p.id, {
        ir: r,
        ig: g,
        ib: b,
        br: Math.min(255, Math.round(r * 1.35 + 50)),
        bg: Math.min(255, Math.round(g * 1.35 + 50)),
        bb: Math.min(255, Math.round(b * 1.35 + 50)),
      })
      if (p.isHuman) humanId = p.id
    }

    const terrain = state.map.terrain
    for (let i = 0; i < len; i++) {
      const v = mapState[i]
      if (v === undefined) continue
      const t = terrain[i] ?? 0
      const o = i * 4
      data[o + 3] = 255
      // Wasser: terrain-bit 7 = 0 → unpassierbar, owner ignoriert
      if ((t & IS_LAND_BIT) === 0) {
        data[o] = WATER_R
        data[o + 1] = WATER_G
        data[o + 2] = WATER_B
        continue
      }
      const height = t & HEIGHT_MASK
      // Extrem-Berg: unpassierbar, Fels-Ton (owner irrelevant — wird nie erobert)
      if (height === IMPASSABLE_HEIGHT) {
        data[o] = ROCK_R
        data[o + 1] = ROCK_G
        data[o + 2] = ROCK_B
        continue
      }
      const owner = v & OWNER_MASK
      let r: number
      let g: number
      let b: number
      if (owner === 0) {
        r = NEUTRAL_R
        g = NEUTRAL_G
        b = NEUTRAL_B
      } else {
        const c = lut.get(owner)
        if (c === undefined) {
          r = 255
          g = 0
          b = 255
        } else {
          // Border-Check: grenzt das Tile an einen anderen Owner (oder Wasser/neutral)?
          const x = i % w
          const y = (i - x) / w
          const ol = (mapState[y * w + (x === 0 ? w - 1 : x - 1)] ?? 0) & OWNER_MASK
          const or = (mapState[y * w + (x === w - 1 ? 0 : x + 1)] ?? 0) & OWNER_MASK
          const ou = (mapState[(y === 0 ? h - 1 : y - 1) * w + x] ?? 0) & OWNER_MASK
          const od = (mapState[(y === h - 1 ? 0 : y + 1) * w + x] ?? 0) & OWNER_MASK
          const isBorder = ol !== owner || or !== owner || ou !== owner || od !== owner
          if (isBorder) {
            if (owner === humanId) {
              r = 240
              g = 240
              b = 255
            } else {
              r = c.br
              g = c.bg
              b = c.bb
            }
          } else {
            r = c.ir
            g = c.ig
            b = c.ib
          }
        }
      }
      // Höhen-Helligkeit: Hügel/Berg leicht heller, wie beleuchtetes Relief
      const hf = height >= 20 ? 1.18 : height >= 10 ? 1.09 : 1
      if (hf !== 1) {
        r = Math.min(255, r * hf)
        g = Math.min(255, g * hf)
        b = Math.min(255, b * hf)
      }
      data[o] = r
      data[o + 1] = g
      data[o + 2] = b
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
  // Schwerpunkt pro Spieler (für Namens-Label + Angriffspfeile). Gedrosselt
  // alle CENTROID_INTERVAL Ticks neu berechnet — Torus-sicher via Sinus/Cosinus.
  const centroids = new Map<number, { x: number; y: number }>()
  let lastCentroidTick = -1

  function maybeRecomputeCentroids(): void {
    if (lastCentroidTick >= 0 && state.tick - lastCentroidTick < CENTROID_INTERVAL) return
    lastCentroidTick = state.tick
    const w = state.map.width
    const h = state.map.height
    const mapState = state.map.state
    interface Acc {
      sx: number
      cx: number
      sy: number
      cy: number
      n: number
    }
    const acc = new Map<number, Acc>()
    const kx = (2 * Math.PI) / w
    const ky = (2 * Math.PI) / h
    for (let i = 0; i < mapState.length; i++) {
      const owner = (mapState[i] ?? 0) & OWNER_MASK
      if (owner === 0) continue
      let a = acc.get(owner)
      if (a === undefined) {
        a = { sx: 0, cx: 0, sy: 0, cy: 0, n: 0 }
        acc.set(owner, a)
      }
      const x = i % w
      const y = (i - x) / w
      a.sx += Math.sin(x * kx)
      a.cx += Math.cos(x * kx)
      a.sy += Math.sin(y * ky)
      a.cy += Math.cos(y * ky)
      a.n++
    }
    centroids.clear()
    for (const [owner, a] of acc) {
      const mx = (Math.atan2(a.sx, a.cx) / (2 * Math.PI)) * w
      const my = (Math.atan2(a.sy, a.cy) / (2 * Math.PI)) * h
      centroids.set(owner, {
        x: ((mx % w) + w) % w,
        y: ((my % h) + h) % h,
      })
    }
  }

  /** Welt→Screen, ohne Wrap (Aufrufer repliziert selbst). */
  function worldToScreenX(wx: number): number {
    return (wx - camera.x) * camera.zoom + container.clientWidth / 2
  }
  function worldToScreenY(wy: number): number {
    return (wy - camera.y) * camera.zoom + container.clientHeight / 2
  }

  function drawLabels(): void {
    maybeRecomputeCentroids()
    const cssW = container.clientWidth
    const cssH = container.clientHeight
    const mapW = state.map.width
    const mapH = state.map.height
    const z = camera.zoom
    screenCtx.save()
    screenCtx.font = 'bold 13px ui-monospace, SFMono-Regular, Menlo, monospace'
    screenCtx.textAlign = 'center'
    screenCtx.textBaseline = 'middle'
    screenCtx.lineWidth = 3
    for (const p of state.players.values()) {
      if (!p.isAlive || p.tilesOwned === 0) continue
      const c = centroids.get(p.id)
      if (c === undefined) continue
      const name = p.name
      const troopsLabel = fmtCompactRender(p.troops)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const sx = worldToScreenX(c.x + dx * mapW)
          const sy = worldToScreenY(c.y + dy * mapH)
          if (sx < -60 || sx > cssW + 60 || sy < -30 || sy > cssH + 30) continue
          screenCtx.strokeStyle = 'rgba(0,0,0,0.85)'
          screenCtx.strokeText(name, sx, sy - 8)
          screenCtx.strokeText(troopsLabel, sx, sy + 8)
          screenCtx.fillStyle = '#ffffff'
          screenCtx.fillText(name, sx, sy - 8)
          screenCtx.fillStyle = 'rgba(255,255,255,0.8)'
          screenCtx.fillText(troopsLabel, sx, sy + 8)
        }
      }
    }
    // Zoom-abhängig nicht skaliert (feste Screen-Größe); z wird nur für Sichtbarkeits-
    // Clipping oben implizit über die Screen-Koords genutzt.
    void z
    screenCtx.restore()
  }

  function drawAttackArrows(): void {
    const cssW = container.clientWidth
    const cssH = container.clientHeight
    const mapW = state.map.width
    const mapH = state.map.height
    screenCtx.save()
    screenCtx.font = 'bold 11px ui-monospace, monospace'
    screenCtx.textAlign = 'center'
    screenCtx.textBaseline = 'middle'
    for (const p of state.players.values()) {
      if (p.attacks.length === 0) continue
      const c = centroids.get(p.id)
      if (c === undefined) continue
      const r = (p.color >>> 24) & 0xff
      const g = (p.color >>> 16) & 0xff
      const b = (p.color >>> 8) & 0xff
      const stroke = `rgba(${r},${g},${b},0.85)`
      for (const atk of p.attacks) {
        const fx = atk.focusTile % mapW
        const fy = Math.floor(atk.focusTile / mapW)
        // Kürzesten Wrap-Weg vom Centroid zum focusTile wählen
        let ddx = fx - c.x
        if (ddx > mapW / 2) ddx -= mapW
        else if (ddx < -mapW / 2) ddx += mapW
        let ddy = fy - c.y
        if (ddy > mapH / 2) ddy -= mapH
        else if (ddy < -mapH / 2) ddy += mapH
        const tx = c.x + ddx
        const ty = c.y + ddy
        const label = fmtCompactRender(atk.reserveTroops)
        for (let rx = -1; rx <= 1; rx++) {
          for (let ry = -1; ry <= 1; ry++) {
            const ox = rx * mapW
            const oy = ry * mapH
            const x0 = worldToScreenX(c.x + ox)
            const y0 = worldToScreenY(c.y + oy)
            const x1 = worldToScreenX(tx + ox)
            const y1 = worldToScreenY(ty + oy)
            // Beide Endpunkte off-screen → skip
            const onScreen =
              (x1 > -40 && x1 < cssW + 40 && y1 > -40 && y1 < cssH + 40) ||
              (x0 > -40 && x0 < cssW + 40 && y0 > -40 && y0 < cssH + 40)
            if (!onScreen) continue
            drawArrow(x0, y0, x1, y1, stroke)
            screenCtx.lineWidth = 3
            screenCtx.strokeStyle = 'rgba(0,0,0,0.8)'
            screenCtx.strokeText(label, x1, y1 - 12)
            screenCtx.fillStyle = '#fff'
            screenCtx.fillText(label, x1, y1 - 12)
          }
        }
      }
    }
    screenCtx.restore()
  }

  function drawBuildings(): void {
    if (state.buildings.size === 0) return
    const cssW = container.clientWidth
    const cssH = container.clientHeight
    const mapW = state.map.width
    const mapH = state.map.height
    const z = camera.zoom
    const radius = Math.max(6, Math.min(11, z * 4))
    screenCtx.save()
    screenCtx.textAlign = 'center'
    screenCtx.textBaseline = 'middle'
    screenCtx.font = `bold ${Math.round(radius * 1.3).toString()}px ui-monospace, monospace`
    for (const b of state.buildings.values()) {
      const player = state.players.get(b.ownerId)
      const ring = player === undefined ? '#fff' : rgbaToCssLocal(player.color)
      const glyph = BUILDING_GLYPH[b.type]
      const tx = (b.tile % mapW) + 0.5
      const ty = Math.floor(b.tile / mapW) + 0.5
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const sx = worldToScreenX(tx + dx * mapW)
          const sy = worldToScreenY(ty + dy * mapH)
          if (sx < -radius || sx > cssW + radius || sy < -radius || sy > cssH + radius) continue
          // Marker-Hintergrund + Spielerfarbe-Ring
          screenCtx.beginPath()
          screenCtx.arc(sx, sy, radius, 0, Math.PI * 2)
          screenCtx.fillStyle = 'rgba(15,15,20,0.92)'
          screenCtx.fill()
          screenCtx.lineWidth = 2
          screenCtx.strokeStyle = ring
          screenCtx.stroke()
          // Glyph
          screenCtx.fillStyle = '#fff'
          screenCtx.fillText(glyph, sx, sy + 0.5)
          // Level-Punkte (über dem Marker)
          if (b.level > 1) {
            screenCtx.fillStyle = '#ffd24a'
            for (let l = 0; l < b.level; l++) {
              screenCtx.beginPath()
              screenCtx.arc(
                sx - radius * 0.5 + l * radius * 0.5,
                sy - radius - 3,
                1.6,
                0,
                Math.PI * 2,
              )
              screenCtx.fill()
            }
          }
        }
      }
    }
    screenCtx.restore()
  }

  /** Interpolierte Welt-Position eines Schiffs entlang seiner Route (wrap-aware). */
  function shipWorldPos(ship: Boat | TradeShip): { wx: number; wy: number } {
    const mapW = state.map.width
    const mapH = state.map.height
    const len = ship.path.length
    const fIdx = Math.min(Math.floor(ship.progress), len - 1)
    const frac = ship.progress - fIdx
    const a = ship.path[fIdx] ?? ship.path[0] ?? 0
    const b = ship.path[Math.min(fIdx + 1, len - 1)] ?? a
    const ax = (a % mapW) + 0.5
    const ay = Math.floor(a / mapW) + 0.5
    const bx = (b % mapW) + 0.5
    const by = Math.floor(b / mapW) + 0.5
    // Wrap-aware Delta: über die kürzere Torus-Richtung interpolieren.
    let dx = bx - ax
    let dy = by - ay
    if (dx > mapW / 2) dx -= mapW
    else if (dx < -mapW / 2) dx += mapW
    if (dy > mapH / 2) dy -= mapH
    else if (dy < -mapH / 2) dy += mapH
    return { wx: ax + dx * frac, wy: ay + dy * frac }
  }

  function drawShips(): void {
    if (state.boats.length === 0 && state.tradeShips.length === 0) return
    const cssW = container.clientWidth
    const cssH = container.clientHeight
    const mapW = state.map.width
    const mapH = state.map.height
    const r = Math.max(3, Math.min(7, camera.zoom * 2.5))
    screenCtx.save()

    const drawDot = (wx: number, wy: number, fill: string, ring: string): void => {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const sx = worldToScreenX(wx + dx * mapW)
          const sy = worldToScreenY(wy + dy * mapH)
          if (sx < -r || sx > cssW + r || sy < -r || sy > cssH + r) continue
          screenCtx.beginPath()
          screenCtx.arc(sx, sy, r, 0, Math.PI * 2)
          screenCtx.fillStyle = fill
          screenCtx.fill()
          screenCtx.lineWidth = 1.5
          screenCtx.strokeStyle = ring
          screenCtx.stroke()
        }
      }
    }

    // Handelsschiffe: goldene Punkte
    for (const ship of state.tradeShips) {
      const { wx, wy } = shipWorldPos(ship)
      drawDot(wx, wy, '#e8c14a', 'rgba(0,0,0,0.6)')
    }
    // Transport-Boote: in Besitzerfarbe, kräftiger Rand
    for (const boat of state.boats) {
      const { wx, wy } = shipWorldPos(boat)
      const player = state.players.get(boat.ownerId)
      const fill = player === undefined ? '#fff' : rgbaToCssLocal(player.color)
      drawDot(wx, wy, fill, '#fff')
    }
    screenCtx.restore()
  }

  function drawArrow(x0: number, y0: number, x1: number, y1: number, color: string): void {
    const angle = Math.atan2(y1 - y0, x1 - x0)
    const head = 9
    screenCtx.lineWidth = 2
    screenCtx.strokeStyle = color
    screenCtx.beginPath()
    screenCtx.moveTo(x0, y0)
    screenCtx.lineTo(x1, y1)
    screenCtx.stroke()
    screenCtx.beginPath()
    screenCtx.moveTo(x1, y1)
    screenCtx.lineTo(
      x1 - head * Math.cos(angle - Math.PI / 6),
      y1 - head * Math.sin(angle - Math.PI / 6),
    )
    screenCtx.moveTo(x1, y1)
    screenCtx.lineTo(
      x1 - head * Math.cos(angle + Math.PI / 6),
      y1 - head * Math.sin(angle + Math.PI / 6),
    )
    screenCtx.stroke()
  }

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
    drawAttackArrows()
    drawAttackTargets()
    drawShips()
    drawBuildings()
    drawMarkers()
    drawLabels()
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
