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
import { BUILD_TIME_TICKS, defenseRange, isBuildingComplete } from '../core/buildings'
import { FACTORY_LINK_RANGE } from '../core/config'
import { canBuildAt, CAPTURE_FADE_TICKS, type GameState, type Player } from '../core/game'
import { areAllied, directedKey } from '../core/diplomacy'
import {
  type Boat,
  type TradeShip,
  type Warship,
  WARSHIP_HP,
  PROJECTILE_TRAVEL_TICKS,
  NAVAL_RANGE,
  shipWorldPos as shipWorldPosOf,
} from '../core/ships'
import { HEIGHT_MASK, IMPASSABLE_HEIGHT, IS_LAND_BIT } from '../world/terrain'
import { neighbors4, tileRef, torusDistance } from '../world/torus'

const BUILDING_GLYPH: Record<BuildingType, string> = {
  city: 'C',
  defense: 'D',
  port: 'P',
  factory: 'F',
}

/**
 * Kleine Pixel-Art-Icons pro Gebäudetyp (8×8), als Zeilen + Paletten-Mapping. Werden
 * einmal auf ein Offscreen-Canvas gerendert und im Marker crisp hochskaliert (statt
 * der Buchstaben C/D/P) → mehr visuelle Tiefe auf der Karte.
 */
interface SpriteDef {
  readonly rows: readonly string[]
  readonly palette: Readonly<Record<string, string>>
}
const BUILDING_SPRITES: Record<BuildingType, SpriteDef> = {
  // Stadt: Gebäude mit rotem Dach + Fenstern.
  city: {
    rows: [
      '..RRRR..',
      '.RRRRRR.',
      'RRRRRRRR',
      '.WWWWWW.',
      '.WdWWdW.',
      '.WWWWWW.',
      '.WdWWdW.',
      '.WWWWWW.',
    ],
    palette: { R: '#c75a4a', W: '#ddd0b0', d: '#36456a' },
  },
  // Verteidigung: Steinturm mit Zinnen + Tor.
  defense: {
    rows: [
      'S.S.S.S.',
      'SSSSSSSS',
      'SssssssS',
      'SssssssS',
      'SssDDssS',
      'SssDDssS',
      'SSSSSSSS',
      '........',
    ],
    palette: { S: '#b3b9c0', s: '#7c828b', D: '#2c313a' },
  },
  // Hafen: kleines Segelboot.
  port: {
    rows: [
      '...S....',
      '...SS...',
      '...SSS..',
      '...SSSS.',
      '...m....',
      '...m....',
      'HHHHHHHH',
      '.HHHHHH.',
    ],
    palette: { S: '#eef2f5', m: '#5a3a22', H: '#9c6b43' },
  },
  // Fabrik: Gebäude mit rauchendem Schornstein.
  factory: {
    rows: [
      '.....s..',
      '....s...',
      '...C....',
      '...C....',
      'WWWWWWWW',
      'WDWDWDWW',
      'WWWWWWWW',
      'WDDWWDDW',
    ],
    palette: { W: '#9098a0', D: '#34383f', C: '#6b5560', s: '#d2d7dd' },
  },
}

/** Pixel-Sprite für Kriegsschiffe (grauer Rumpf, Deck, Mast + rote Flagge). */
const WARSHIP_SPRITE: SpriteDef = {
  rows: [
    '...f....',
    '...m....',
    '..DDDD..',
    '.DDDDDD.',
    'HHHHHHHH',
    'HHHHHHHH',
    '.HHHHHH.',
    '..HHHH..',
  ],
  palette: { H: '#5c6670', D: '#8a929c', m: '#3a3f47', f: '#d24a4a' },
}

/** Packed RGBA → CSS rgb() (lokal, um render→ui Cross-Layer-Import zu vermeiden). */
function rgbaToCssLocal(rgba: number): string {
  const r = (rgba >>> 24) & 0xff
  const g = (rgba >>> 16) & 0xff
  const b = (rgba >>> 8) & 0xff
  return `rgb(${r},${g},${b})`
}

/** Packed RGBA → "r,g,b"-Triplet (für rgba(...) mit eigenem Alpha). */
function rgbaTripletLocal(rgba: number): string {
  const r = (rgba >>> 24) & 0xff
  const g = (rgba >>> 16) & 0xff
  const b = (rgba >>> 8) & 0xff
  return `${String(r)},${String(g)},${String(b)}`
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
  /** Aktiviert/deaktiviert die Bau-Platzierungs-Vorschau (Geist am Cursor). */
  setBuildPreview(type: BuildingType | null): void
  /** Schaltet die Reichweiten-Ringe der eigenen Kriegsschiffe um; gibt den neuen Zustand zurück. */
  toggleShipRanges(): boolean
  /** Setzt die Auswahl-Box (Screen-CSS) für die Anzeige während des Ziehens; null = aus. */
  setSelectionBox(box: { x0: number; y0: number; x1: number; y1: number } | null): void
  /** Wählt die eigenen Kriegsschiffe in der Screen-Box aus; gibt die Anzahl zurück. */
  selectWarshipsInBox(box: { x0: number; y0: number; x1: number; y1: number }): number
  /** Hebt die Kriegsschiff-Auswahl auf. */
  clearWarshipSelection(): void
  /** Hat der Spieler aktuell Kriegsschiffe ausgewählt? */
  hasWarshipSelection(): boolean
  /** Indizes der aktuell ausgewählten (noch lebenden) Kriegsschiffe in `state.warships`. */
  selectedWarshipIndices(): number[]
  /**
   * Zentriert die Kamera (torus-sicher) auf den Schwerpunkt eines Spielers.
   * `screenOffsetY` (CSS-Pixel, positiv) hebt den Schwerpunkt optisch nach oben —
   * nützlich, damit der Start-Spawn nicht vom unteren HUD-Panel verdeckt wird.
   */
  centerOnPlayer(playerId: number, screenOffsetY?: number): void
  destroy(): void
}

// Inland-Tönung: Anteil Eigenfarbe über der Terrain-Basis (Rest = Landschaft sichtbar).
const INTERIOR_TINT = 0.32
/**
 * Ab diesem Zoom werden auch „Neben"-Nationen beschriftet (wilde, oder — bei vielen
 * Nationen auf der Karte — auch KI). Rausgezoomt bleiben nur Mensch + Verbündete + (bei
 * wenigen Nationen) alle, damit die Karte nicht in Labels ertrinkt.
 */
const MINOR_LABEL_MIN_ZOOM = 2.5
/** Ab so vielen lebenden Nicht-Mensch-Nationen werden KI-Labels wie wilde gegated. */
const LABEL_CROWD_THRESHOLD = 14
const WATER_R = 24
const WATER_G = 48
const WATER_B = 92
// Flachwasser-Saum: Wasser-Tiles, die an Land grenzen, werden heller/türkiser —
// ergibt eine klare Küstenlinie (Tiefen-Gradient), damit Wasser nie mit dem
// Gebiet einer Nation verwechselt wird.
const SHALLOW_R = 64
const SHALLOW_G = 122
const SHALLOW_B = 150
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
/** Ab dieser Tile-Zahl bekommt ein zusammenhängender Gebiets-Fetzen ein eigenes Label. */
const MIN_LABEL_COMPONENT = 4

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

  // Mini-LUT: ownerId → { inner [r,g,b], border [r,g,b] }. Spielerfarben sind für
  // das Match statisch → einmal bauen (nicht pro Frame).
  interface ColorEntry {
    readonly ir: number
    readonly ig: number
    readonly ib: number
    readonly br: number
    readonly bg: number
    readonly bb: number
  }
  let lut: Map<number, ColorEntry> | null = null
  let lutHumanId = -1
  let bitmapBaked = false
  // Grenzfarbe je Spieler AUS SICHT des Menschen: eigenes leuchtet hell-cyan,
  // Verbündete grün, Nationen die einem kürzlich Land genommen haben rot (Intensität
  // = „Groll", klingt nach), alle anderen weiß.
  let borderTints = new Map<number, readonly [number, number, number]>()
  let lastBorderSig = ''

  /** Groll-Stufe (0–3) von `p` gegen den Menschen — nach kürzlich genommenem Land. */
  function grudgeLevel(p: Player, humanId: number, humanTiles: number): number {
    const g = state.grudge.get(directedKey(p.id, humanId)) ?? 0
    if (g <= 0) return 0
    // Anteil am eigenen (verbliebenen) Gebiet → kleiner Räuber blass, großer grell.
    const ratio = g / humanTiles
    if (ratio < 0.05) return 0
    if (ratio < 0.3) return 1
    if (ratio < 1.0) return 2
    return 3
  }

  /**
   * Berechnet die Grenz-Tints relativ zum Menschen und gibt eine Signatur zurück,
   * die sich nur bei Beziehungs-/Groll-Stufen-Wechseln ändert (→ seltenes Rebake;
   * der Groll-Wert selbst ändert sich jeden Tick, die Stufe nur selten).
   */
  function computeBorderTints(): string {
    const m = new Map<number, readonly [number, number, number]>()
    const humanId = lutHumanId
    const human = humanId >= 0 ? state.players.get(humanId) : undefined
    const humanTiles = human ? Math.max(1, human.tilesOwned) : 1
    // Spieler, die der Mensch GERADE aktiv angreift → ihr Rand wird orange markiert,
    // damit man genau sieht, wo man angreift.
    const attacked = new Set<number>()
    if (human)
      for (const a of human.attacks) if (a.targetPlayerId > 0) attacked.add(a.targetPlayerId)
    let sig = ''
    for (const p of state.players.values()) {
      if (!p.isAlive) continue
      let tint: readonly [number, number, number]
      let cat: string
      if (humanId < 0) {
        const c = lut?.get(p.id)
        tint = c ? [c.br, c.bg, c.bb] : [255, 0, 255]
        cat = 'c'
      } else if (p.id === humanId) {
        // Eigenleuchten: hell cyan-weiß, hebt sich klar vom neutralen Weiß ab.
        tint = [150, 245, 255]
        cat = 'me'
      } else if (attacked.has(p.id)) {
        // Aktives Angriffsziel: kräftiges Orange.
        tint = [255, 165, 40]
        cat = 'atk'
      } else if (areAllied(state.alliances, humanId, p.id)) {
        tint = [90, 220, 120]
        cat = 'ally'
      } else {
        const lvl = grudgeLevel(p, humanId, humanTiles)
        if (lvl === 0) {
          tint = [235, 235, 235]
          cat = 'w'
        } else {
          tint = lvl === 1 ? [180, 110, 110] : lvl === 2 ? [225, 75, 75] : [255, 45, 45]
          cat = 'g' + lvl.toString()
        }
      }
      m.set(p.id, tint)
      sig += p.id.toString() + cat + ';'
    }
    borderTints = m
    return sig
  }

  function buildLut(): void {
    const m = new Map<number, ColorEntry>()
    for (const p of state.players.values()) {
      const r = (p.color >>> 24) & 0xff
      const g = (p.color >>> 16) & 0xff
      const b = (p.color >>> 8) & 0xff
      m.set(p.id, {
        ir: r,
        ig: g,
        ib: b,
        br: Math.min(255, Math.round(r * 1.35 + 50)),
        bg: Math.min(255, Math.round(g * 1.35 + 50)),
        bb: Math.min(255, Math.round(b * 1.35 + 50)),
      })
      if (p.isHuman) lutHumanId = p.id
    }
    lut = m
  }

  /** Berechnet die Farbe eines einzelnen Tiles und schreibt sie in die ImageData. */
  function colorTile(i: number): void {
    const data = imageData.data
    const mapState = state.map.state
    const terrain = state.map.terrain
    const w = state.map.width
    const h = state.map.height
    const v = mapState[i]
    if (v === undefined) return
    const t = terrain[i] ?? 0
    const o = i * 4
    data[o + 3] = 255
    // Wasser: terrain-bit 7 = 0. Grenzt es an Land, malen wir Flachwasser (heller)
    // statt Tiefsee → sichtbare Küstenlinie. Hängt nur am (statischen) Terrain,
    // muss daher nie inkrementell aktualisiert werden.
    if ((t & IS_LAND_BIT) === 0) {
      const wx = i % w
      const wy = (i - wx) / w
      const nL = terrain[wy * w + (wx === 0 ? w - 1 : wx - 1)] ?? 0
      const nR = terrain[wy * w + (wx === w - 1 ? 0 : wx + 1)] ?? 0
      const nU = terrain[(wy === 0 ? h - 1 : wy - 1) * w + wx] ?? 0
      const nD = terrain[(wy === h - 1 ? 0 : wy + 1) * w + wx] ?? 0
      const coastal =
        (nL & IS_LAND_BIT) !== 0 ||
        (nR & IS_LAND_BIT) !== 0 ||
        (nU & IS_LAND_BIT) !== 0 ||
        (nD & IS_LAND_BIT) !== 0
      data[o] = coastal ? SHALLOW_R : WATER_R
      data[o + 1] = coastal ? SHALLOW_G : WATER_G
      data[o + 2] = coastal ? SHALLOW_B : WATER_B
      return
    }
    const height = t & HEIGHT_MASK
    // Extrem-Berg: unpassierbar, Fels-Ton (wird nie erobert)
    if (height === IMPASSABLE_HEIGHT) {
      data[o] = ROCK_R
      data[o + 1] = ROCK_G
      data[o + 2] = ROCK_B
      return
    }
    // Höhen-Stufe: 0 Ebene (<10), 1 Hügel (10-19), 2 Berg (20-30).
    const tier = height >= 20 ? 2 : height >= 10 ? 1 : 0
    // Terrain-Basisfarbe nach Höhe — DIE sichtbare Landschaft. Eigenes/fremdes Inland
    // wird darüber nur leicht getönt, sodass die Landschaft durchscheint.
    let tr: number
    let tg: number
    let tb: number
    if (tier === 0) {
      tr = 26
      tg = 32
      tb = 28
    } else if (tier === 1) {
      tr = 58
      tg = 52
      tb = 36
    } else {
      tr = 92
      tg = 82
      tb = 66
    }

    const owner = v & OWNER_MASK
    let r: number
    let g: number
    let b: number
    if (owner === 0) {
      r = tr
      g = tg
      b = tb
    } else {
      const c = lut?.get(owner)
      if (c === undefined) {
        r = 255
        g = 0
        b = 255
      } else {
        // Border-Check: grenzt das Tile an einen anderen Owner?
        const x = i % w
        const y = (i - x) / w
        const ol = (mapState[y * w + (x === 0 ? w - 1 : x - 1)] ?? 0) & OWNER_MASK
        const or = (mapState[y * w + (x === w - 1 ? 0 : x + 1)] ?? 0) & OWNER_MASK
        const ou = (mapState[(y === 0 ? h - 1 : y - 1) * w + x] ?? 0) & OWNER_MASK
        const od = (mapState[(y === h - 1 ? 0 : y + 1) * w + x] ?? 0) & OWNER_MASK
        const isBorder = ol !== owner || or !== owner || ou !== owner || od !== owner
        if (isBorder) {
          // Rand nach Beziehung zum Menschen (grün=verbündet, rot=greift dich an,
          // weiß=sonst). Fallback: Besitzerfarbe.
          const tint = borderTints.get(owner)
          if (tint !== undefined) {
            r = tint[0]
            g = tint[1]
            b = tint[2]
          } else {
            r = c.br
            g = c.bg
            b = c.bb
          }
        } else {
          // Inland: Terrain durchscheinen lassen, nur leichte Eigenfarbe drüber.
          const a = INTERIOR_TINT
          r = Math.round(tr * (1 - a) + c.ir * a)
          g = Math.round(tg * (1 - a) + c.ig * a)
          b = Math.round(tb * (1 - a) + c.ib * a)
        }
      }
    }
    data[o] = r
    data[o + 1] = g
    data[o + 2] = b
  }

  /**
   * Aktualisiert das Offscreen-Bitmap. Erster Aufruf: komplette Karte backen.
   * Danach inkrementell — nur die in `state.dirtyTiles` gemeldeten Tiles (+ ihre
   * 4 Nachbarn, deren Border-Status kippen kann) werden neu gefärbt. So ist der
   * Aufwand O(geänderte Tiles) statt O(Kartengröße) — Voraussetzung für große Karten.
   */
  function paintBitmap(): void {
    if (lut === null) buildLut()
    // Beziehungs-Tints neu berechnen; ändert sich die Signatur (Allianz/Angriff/
    // Größenstufe), müssen ALLE Grenzen neu — also einmal voll backen.
    const sig = computeBorderTints()
    if (sig !== lastBorderSig) {
      lastBorderSig = sig
      bitmapBaked = false
    }
    const w = state.map.width
    const h = state.map.height

    if (!bitmapBaked) {
      const len = state.map.state.length
      for (let i = 0; i < len; i++) colorTile(i)
      offscreenCtx.putImageData(imageData, 0, 0)
      bitmapBaked = true
      return
    }

    const dirty = state.dirtyTiles
    if (dirty.length === 0) return // keine Owner-Änderung → Bitmap unverändert

    const mapState = state.map.state
    const now = performance.now()
    let flashesAdded = 0
    const recolored = new Set<number>()
    for (const ref of dirty) {
      if (flashesAdded < MAX_FLASHES_PER_TICK && ((mapState[ref] ?? 0) & OWNER_MASK) !== 0) {
        flashes.push({ tileX: ref % w, tileY: Math.floor(ref / w), startTime: now })
        flashesAdded++
      }
      if (!recolored.has(ref)) {
        recolored.add(ref)
        colorTile(ref)
      }
      for (const n of neighbors4(ref, w, h)) {
        if (!recolored.has(n)) {
          recolored.add(n)
          colorTile(n)
        }
      }
    }
    offscreenCtx.putImageData(imageData, 0, 0)
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

  /**
   * Lässt frisch eroberte Tiles kurz aufleuchten — man sieht exakt, wo ein Angriff
   * gerade Wirkung zeigt. Eigene Eroberungen leuchten hell (cyan-weiß), Verbündete
   * grün, Gegner rot; im Zuschauer-Modus neutral weiß. Verblasst über
   * [[CAPTURE_FADE_TICKS]].
   */
  function drawCaptureFlashes(): void {
    if (state.recentCaptures.size === 0) return
    const cssW = container.clientWidth
    const cssH = container.clientHeight
    const z = camera.zoom
    const halfW = cssW / 2
    const halfH = cssH / 2
    const mapW = state.map.width
    const mapH = state.map.height
    const humanId = lutHumanId
    screenCtx.save()
    for (const [tile, capturedAt] of state.recentCaptures) {
      const age = state.tick - capturedAt
      if (age < 0 || age >= CAPTURE_FADE_TICKS) continue
      const fade = 1 - age / CAPTURE_FADE_TICKS
      const owner = (state.map.state[tile] ?? 0) & OWNER_MASK
      let rgb: string
      let peak: number
      if (humanId < 0) {
        rgb = '255,255,255'
        peak = 0.55
      } else if (owner === humanId) {
        rgb = '150,255,210' // eigene Eroberung — hell hervorgehoben
        peak = 0.85
      } else if (areAllied(state.alliances, humanId, owner)) {
        rgb = '120,230,140'
        peak = 0.5
      } else {
        rgb = '255,70,70' // jemand nimmt Land (auch: dir genommenes)
        peak = 0.6
      }
      const alpha = fade * peak
      screenCtx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`
      const tx = tile % mapW
      const ty = Math.floor(tile / mapW)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const sx = (tx + dx * mapW - camera.x) * z + halfW
          const sy = (ty + dy * mapH - camera.y) * z + halfH
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
  // Bau-Platzierungs-Vorschau: Geist am Hover-Tile (null = inaktiv).
  let buildPreviewType: BuildingType | null = null
  // Reichweiten-Ringe der eigenen Kriegsschiffe anzeigen (Toggle).
  let shipRangesVisible = false
  // Box-Select: ausgewählte eigene Kriegsschiffe + aktuelle Auswahl-Box (Screen-CSS).
  const selectedWarships = new Set<Warship>()
  let selectionBox: { x0: number; y0: number; x1: number; y1: number } | null = null
  // Bitmap-Caching: nur neu malen wenn sich der Sim-Tick geändert hat.
  // Render-Loop läuft mit 60 fps, Sim mit 10 Hz → 6× weniger Pixel-Writes.
  let lastBitmapTick: number = -1
  // Capture-Flash: kurzer Highlight wenn Tile-Owner gewechselt hat — gespeist aus
  // `state.dirtyTiles` (vom Core pro Tick gemeldet), kein O(N)-Diff mehr.
  const flashes: CaptureFlash[] = []
  // Schwerpunkt pro Spieler (für Namens-Label + Angriffspfeile). Gedrosselt
  // alle CENTROID_INTERVAL Ticks neu berechnet — Torus-sicher via Sinus/Cosinus.
  // Ein Label-Anker je zusammenhängendem Gebiets-Fetzen (statt nur einem Schwerpunkt pro
  // Nation) — so trägt jeder getrennte Teil einer geteilten Nation seinen eigenen Namen,
  // keine Farbfläche bleibt unbeschriftet. Alle CENTROID_INTERVAL Ticks via Flood-Fill.
  let labelAnchors: { owner: number; x: number; y: number }[] = []
  let lastCentroidTick = -1
  let visited: Uint8Array = new Uint8Array(0)
  let bfsQueue: Int32Array = new Int32Array(0)

  function maybeRecomputeCentroids(): void {
    if (lastCentroidTick >= 0 && state.tick - lastCentroidTick < CENTROID_INTERVAL) return
    lastCentroidTick = state.tick
    const w = state.map.width
    const h = state.map.height
    const ms = state.map.state
    const n = ms.length
    const kx = (2 * Math.PI) / w
    const ky = (2 * Math.PI) / h
    if (visited.length !== n) {
      visited = new Uint8Array(n)
      bfsQueue = new Int32Array(n)
    } else {
      visited.fill(0)
    }
    const anchors: { owner: number; x: number; y: number }[] = []
    for (let start = 0; start < n; start++) {
      if (visited[start] === 1) continue
      const owner = (ms[start] ?? 0) & OWNER_MASK
      if (owner === 0) {
        visited[start] = 1
        continue
      }
      // BFS über zusammenhängende Tiles desselben Owners (Torus-4-Nachbarschaft); Torus-
      // sicherer Schwerpunkt der Komponente via Sinus/Cosinus-Mittelung.
      let head = 0
      let tail = 0
      bfsQueue[tail++] = start
      visited[start] = 1
      let sx = 0
      let cx = 0
      let sy = 0
      let cy = 0
      let count = 0
      while (head < tail) {
        const t = bfsQueue[head++] ?? 0
        const x = t % w
        const y = (t - x) / w
        sx += Math.sin(x * kx)
        cx += Math.cos(x * kx)
        sy += Math.sin(y * ky)
        cy += Math.cos(y * ky)
        count++
        const nbs = [
          ((x - 1 + w) % w) + y * w,
          ((x + 1) % w) + y * w,
          x + ((y - 1 + h) % h) * w,
          x + ((y + 1) % h) * w,
        ]
        for (const nb of nbs) {
          if (visited[nb] !== 1 && ((ms[nb] ?? 0) & OWNER_MASK) === owner) {
            visited[nb] = 1
            bfsQueue[tail++] = nb
          }
        }
      }
      if (count >= MIN_LABEL_COMPONENT) {
        const mx = (Math.atan2(sx, cx) / (2 * Math.PI)) * w
        const my = (Math.atan2(sy, cy) / (2 * Math.PI)) * h
        anchors.push({ owner, x: ((mx % w) + w) % w, y: ((my % h) + h) % h })
      }
    }
    labelAnchors = anchors
  }

  /** Zentriert die Kamera (torus-sicher) auf den Schwerpunkt eines Spielers. */
  function centerOnPlayer(playerId: number, screenOffsetY = 0): void {
    const w = state.map.width
    const h = state.map.height
    const ms = state.map.state
    const kx = (2 * Math.PI) / w
    const ky = (2 * Math.PI) / h
    let sx = 0
    let cx = 0
    let sy = 0
    let cy = 0
    let n = 0
    for (let i = 0; i < ms.length; i++) {
      if (((ms[i] ?? 0) & OWNER_MASK) !== playerId) continue
      const x = i % w
      const y = (i - x) / w
      sx += Math.sin(x * kx)
      cx += Math.cos(x * kx)
      sy += Math.sin(y * ky)
      cy += Math.cos(y * ky)
      n++
    }
    if (n === 0) return
    const mx = (Math.atan2(sx, cx) / (2 * Math.PI)) * w
    const my = (Math.atan2(sy, cy) / (2 * Math.PI)) * h
    camera.x = ((mx % w) + w) % w
    // Schwerpunkt optisch nach oben heben: Kamera-Ziel um offset/zoom nach unten.
    camera.y = (((my + screenOffsetY / camera.zoom) % h) + h) % h
  }

  /** Welt→Screen, ohne Wrap (Aufrufer repliziert selbst). */
  function worldToScreenX(wx: number): number {
    return (wx - camera.x) * camera.zoom + container.clientWidth / 2
  }
  function worldToScreenY(wy: number): number {
    return (wy - camera.y) * camera.zoom + container.clientHeight / 2
  }

  /**
   * Screen-Position der Wrap-Kopie eines Welt-Punkts, die der Kamera am nächsten
   * liegt. Für „Annotations"-Overlays (Cursor, Marker, Pfeile, Labels), die genau
   * EINE logische Position markieren — sonst erscheinen sie beim Rauszoomen mehrfach.
   */
  function nearestWrappedScreenPos(wx: number, wy: number): { sx: number; sy: number } {
    const mapW = state.map.width
    const mapH = state.map.height
    const z = camera.zoom
    const nx = wx + mapW * Math.round((camera.x - wx) / mapW)
    const ny = wy + mapH * Math.round((camera.y - wy) / mapH)
    return {
      sx: (nx - camera.x) * z + container.clientWidth / 2,
      sy: (ny - camera.y) * z + container.clientHeight / 2,
    }
  }

  function drawLabels(): void {
    maybeRecomputeCentroids()
    const cssW = container.clientWidth
    const cssH = container.clientHeight
    const z = camera.zoom
    // Schrift skaliert mit dem Zoom (bei nahem Zoom größer/lesbarer), gedeckelt.
    const fontSize = Math.max(12, Math.min(26, Math.round(11 + z * 0.7)))
    const gap = Math.round(fontSize * 0.6)
    const margin = fontSize + 4
    screenCtx.save()
    screenCtx.font = `bold ${fontSize.toString()}px ui-monospace, SFMono-Regular, Menlo, monospace`
    screenCtx.textAlign = 'center'
    screenCtx.textBaseline = 'middle'
    screenCtx.lineWidth = 3
    // Bei vielen Nationen (viele Bots/Wilde) würden alle Labels die Karte zukleistern.
    // Dann werden Neben-Nationen wie Wilde behandelt: erst ab nahem Zoom beschriftet.
    let liveOthers = 0
    for (const p of state.players.values()) {
      if (p.isAlive && p.tilesOwned > 0 && p.id !== lutHumanId) liveOthers++
    }
    const crowded = liveOthers > LABEL_CROWD_THRESHOLD
    // Ein Label je Gebiets-Fetzen (labelAnchors): geteilte Nationen werden mehrfach
    // beschriftet, keine Farbfläche bleibt namenlos.
    for (const anchor of labelAnchors) {
      const p = state.players.get(anchor.owner)
      if (p === undefined || !p.isAlive) continue
      // Mensch + Verbündete immer; sonst bei Gedränge oder wild erst ab nahem Zoom
      // (rausgezoomt sauber, Hover zeigt sie weiterhin). So skaliert es auf hunderte Nationen.
      const isHuman = p.id === lutHumanId
      const allied = lutHumanId >= 0 && !isHuman && areAllied(state.alliances, lutHumanId, p.id)
      if (!isHuman && !allied && (p.wild || crowded) && z < MINOR_LABEL_MIN_ZOOM) continue
      // Nächste Wrap-Kopie des Fetzen-Schwerpunkts.
      const { sx, sy } = nearestWrappedScreenPos(anchor.x + 0.5, anchor.y + 0.5)
      // Liegt der Schwerpunkt weit außerhalb (> 1 Viewport), ist die Nation nicht in
      // Sicht → kein Label. Sonst: an den Rand klemmen, damit man sieht welches Land
      // angrenzt (auch wenn der Schwerpunkt selbst außerhalb des Bildes liegt).
      if (sx < -cssW || sx > 2 * cssW || sy < -cssH || sy > 2 * cssH) continue
      const offscreen = sx < 0 || sx > cssW || sy < 0 || sy > cssH
      const lx = Math.max(margin, Math.min(cssW - margin, sx))
      const ly = Math.max(margin, Math.min(cssH - margin, sy))
      const name = p.name
      const troopsLabel = fmtCompactRender(p.troops)
      // Verbündete Nationen: Name grün (oben berechnet), damit man Bündnisse sofort erkennt.
      screenCtx.globalAlpha = offscreen ? 0.6 : 1
      screenCtx.strokeStyle = 'rgba(0,0,0,0.85)'
      screenCtx.strokeText(name, lx, ly - gap)
      screenCtx.strokeText(troopsLabel, lx, ly + gap)
      screenCtx.fillStyle = allied ? '#5adc78' : '#ffffff'
      screenCtx.fillText(name, lx, ly - gap)
      screenCtx.fillStyle = 'rgba(255,255,255,0.8)'
      screenCtx.fillText(troopsLabel, lx, ly + gap)
    }
    screenCtx.globalAlpha = 1
    screenCtx.restore()
  }

  /**
   * Zeichnet pro aktivem Angriff die Reserve-Truppenzahl am Fokus-Tile.
   * Angriffe auf den Menschen werden als auffällige rote Pille mit Schwert
   * hervorgehoben (man muss sofort sehen, wie groß die Bedrohung ist); fremde
   * Angriffe bleiben eine dezente Zahl in Besitzerfarbe.
   */
  function drawAttackFronts(): void {
    const cssW = container.clientWidth
    const cssH = container.clientHeight
    const mapW = state.map.width
    const humanId = lutHumanId
    screenCtx.save()
    screenCtx.textAlign = 'center'
    screenCtx.textBaseline = 'middle'
    // Eigene Angriffe (grüne Pille) und eingehende Angriffe auf einen (rote Pille)
    // werden hervorgehoben und zuletzt gezeichnet; fremde bleiben eine dezente Zahl.
    const own: Array<{ sx: number; sy: number; label: string }> = []
    const incoming: Array<{ sx: number; sy: number; label: string }> = []
    screenCtx.lineWidth = 3
    screenCtx.font = 'bold 12px ui-monospace, monospace'
    for (const p of state.players.values()) {
      if (p.attacks.length === 0) continue
      const fill = rgbaToCssLocal(p.color)
      const isOwn = humanId >= 0 && p.id === humanId
      for (const atk of p.attacks) {
        // frontTile folgt der vorrückenden Grenze (focusTile war der statische Klick).
        const fx = (atk.frontTile % mapW) + 0.5
        const fy = Math.floor(atk.frontTile / mapW) + 0.5
        const { sx, sy } = nearestWrappedScreenPos(fx, fy)
        if (sx < -40 || sx > cssW + 40 || sy < -24 || sy > cssH + 24) continue
        const label = fmtCompactRender(atk.reserveTroops)
        if (isOwn) {
          own.push({ sx, sy, label })
          continue
        }
        if (humanId >= 0 && atk.targetPlayerId === humanId) {
          incoming.push({ sx, sy, label })
          continue
        }
        screenCtx.strokeStyle = 'rgba(0,0,0,0.85)'
        screenCtx.strokeText(label, sx, sy)
        screenCtx.fillStyle = fill
        screenCtx.fillText(label, sx, sy)
      }
    }
    // Pillen: eigene grün, eingehende rot — beide mit Schwert + Truppenzahl.
    screenCtx.font = 'bold 14px ui-monospace, monospace'
    for (const { sx, sy, label } of own) drawAttackPill(sx, sy, label, 'rgba(60,200,90,0.92)')
    for (const { sx, sy, label } of incoming) drawAttackPill(sx, sy, label, 'rgba(225,40,40,0.92)')
    screenCtx.restore()
  }

  /** Zeichnet eine abgerundete Pille mit Schwert + Label an (sx,sy). */
  function drawAttackPill(sx: number, sy: number, label: string, fill: string): void {
    const text = `⚔ ${label}`
    const w = screenCtx.measureText(text).width + 14
    const h = 20
    screenCtx.fillStyle = fill
    screenCtx.strokeStyle = 'rgba(0,0,0,0.6)'
    screenCtx.lineWidth = 2
    roundRect(screenCtx, sx - w / 2, sy - h / 2, w, h, 6)
    screenCtx.fill()
    screenCtx.stroke()
    screenCtx.fillStyle = '#ffffff'
    screenCtx.fillText(text, sx, sy + 0.5)
  }

  /** Pfad eines abgerundeten Rechtecks (kein Stroke/Fill — Aufrufer entscheidet). */
  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const rad = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rad, y)
    ctx.arcTo(x + w, y, x + w, y + h, rad)
    ctx.arcTo(x + w, y + h, x, y + h, rad)
    ctx.arcTo(x, y + h, x, y, rad)
    ctx.arcTo(x, y, x + w, y, rad)
    ctx.closePath()
  }

  // Vorgerenderte Pixel-Sprites (einmal erstellt, dann crisp skaliert).
  function renderSpriteCanvas(def: SpriteDef): HTMLCanvasElement | null {
    const h = def.rows.length
    const w = def.rows[0]?.length ?? 0
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (ctx === null) return null
    for (let y = 0; y < h; y++) {
      const row = def.rows[y] ?? ''
      for (let x = 0; x < w; x++) {
        const col = def.palette[row[x] ?? '']
        if (col !== undefined) {
          ctx.fillStyle = col
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }
    return c
  }
  const spriteCache = new Map<BuildingType, HTMLCanvasElement | null>()
  function getBuildingSprite(type: BuildingType): HTMLCanvasElement | null {
    const cached = spriteCache.get(type)
    if (cached !== undefined) return cached
    const c = renderSpriteCanvas(BUILDING_SPRITES[type])
    spriteCache.set(type, c)
    return c
  }
  let warshipSpriteCache: HTMLCanvasElement | null | undefined
  function getWarshipSprite(): HTMLCanvasElement | null {
    if (warshipSpriteCache === undefined) warshipSpriteCache = renderSpriteCanvas(WARSHIP_SPRITE)
    return warshipSpriteCache
  }

  /**
   * Zeichnet die Fabrik-Netzwerk-Verbindungen: von jeder Fabrik eine dezente Linie zu
   * jedem eigenen Wirtschafts-Gebäude (Stadt/Hafen/Fabrik) in `FACTORY_LINK_RANGE`
   * (Luftlinie). Fabrik-Fabrik-Linien nur einmal. Nur ab mittlerem Zoom (Anti-Clutter).
   */
  function drawBuildingLinks(): void {
    if (state.buildings.size === 0 || camera.zoom < 1.4) return
    const mapW = state.map.width
    const mapH = state.map.height
    type Eco = { tile: number; ownerId: number; factory: boolean }
    const eco: Eco[] = []
    for (const b of state.buildings.values()) {
      if (state.tick < b.completesAtTick) continue
      if (b.type === 'city' || b.type === 'port' || b.type === 'factory') {
        eco.push({ tile: b.tile, ownerId: b.ownerId, factory: b.type === 'factory' })
      }
    }
    if (eco.length < 2) return
    screenCtx.save()
    screenCtx.lineWidth = 1.5
    for (const f of eco) {
      if (!f.factory) continue
      const fx = (f.tile % mapW) + 0.5
      const fy = Math.floor(f.tile / mapW) + 0.5
      const fp = nearestWrappedScreenPos(fx, fy)
      const player = state.players.get(f.ownerId)
      const col = player === undefined ? '200,200,200' : rgbaTripletLocal(player.color)
      for (const e of eco) {
        if (e === f || e.ownerId !== f.ownerId) continue
        if (e.factory && e.tile < f.tile) continue // Fabrik-Fabrik nur einmal
        const ex = e.tile % mapW
        const ey = Math.floor(e.tile / mapW)
        if (
          torusDistance(f.tile % mapW, Math.floor(f.tile / mapW), ex, ey, mapW, mapH) >
          FACTORY_LINK_RANGE
        )
          continue
        const ep = nearestWrappedScreenPos(ex + 0.5, ey + 0.5)
        screenCtx.strokeStyle = `rgba(${col},0.45)`
        screenCtx.beginPath()
        screenCtx.moveTo(fp.sx, fp.sy)
        screenCtx.lineTo(ep.sx, ep.sy)
        screenCtx.stroke()
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
      // Im Bau? Fortschritt 0..1 für die Leiste; der Marker ist dann gedimmt.
      const inProgress = state.tick < b.completesAtTick
      const buildProgress = inProgress
        ? Math.max(0, Math.min(1, 1 - (b.completesAtTick - state.tick) / BUILD_TIME_TICKS))
        : 1
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const sx = worldToScreenX(tx + dx * mapW)
          const sy = worldToScreenY(ty + dy * mapH)
          if (sx < -radius || sx > cssW + radius || sy < -radius || sy > cssH + radius) continue
          screenCtx.globalAlpha = inProgress ? 0.55 : 1
          // Marker-Hintergrund + Spielerfarbe-Ring
          screenCtx.beginPath()
          screenCtx.arc(sx, sy, radius, 0, Math.PI * 2)
          screenCtx.fillStyle = 'rgba(15,15,20,0.92)'
          screenCtx.fill()
          screenCtx.lineWidth = 2
          screenCtx.strokeStyle = ring
          screenCtx.stroke()
          // Pixel-Sprite (statt Buchstabe); Fallback auf Glyph wenn kein Canvas.
          const spr = getBuildingSprite(b.type)
          if (spr !== null) {
            const ss = radius * 1.7
            const prevSmooth = screenCtx.imageSmoothingEnabled
            screenCtx.imageSmoothingEnabled = false
            screenCtx.drawImage(spr, sx - ss / 2, sy - ss / 2, ss, ss)
            screenCtx.imageSmoothingEnabled = prevSmooth
          } else {
            screenCtx.fillStyle = '#fff'
            screenCtx.fillText(glyph, sx, sy + 0.5)
          }
          screenCtx.globalAlpha = 1
          // Bau-Fortschrittsleiste unter dem Marker (nur während des Baus).
          if (inProgress) {
            const bw = radius * 2
            const bh = 3
            const bxl = sx - radius
            const byl = sy + radius + 2
            screenCtx.fillStyle = 'rgba(0,0,0,0.7)'
            screenCtx.fillRect(bxl, byl, bw, bh)
            screenCtx.fillStyle = '#5dd75d'
            screenCtx.fillRect(bxl, byl, bw * buildProgress, bh)
          }
          // Level-Nummer über dem Marker (ab Stufe 2).
          if (b.level > 1) {
            const lvFont = `bold ${String(Math.max(9, Math.round(radius)))}px ui-monospace, monospace`
            screenCtx.font = lvFont
            const ly = sy - radius - 4
            screenCtx.lineWidth = 3
            screenCtx.strokeStyle = 'rgba(0,0,0,0.85)'
            screenCtx.strokeText(String(b.level), sx, ly)
            screenCtx.fillStyle = '#ffd24a'
            screenCtx.fillText(String(b.level), sx, ly)
            // Marker-Font wiederherstellen (für nächste Glyph-Fallbacks).
            screenCtx.font = `bold ${Math.round(radius * 1.3).toString()}px ui-monospace, monospace`
          }
        }
      }
    }
    screenCtx.restore()
  }

  /** Interpolierte Welt-Position eines Schiffs entlang seiner Route (wrap-aware). */
  function shipWorldPos(ship: Boat | TradeShip | Warship): { wx: number; wy: number } {
    return shipWorldPosOf(ship, state.map.width, state.map.height)
  }

  function drawShips(): void {
    if (state.boats.length === 0 && state.tradeShips.length === 0 && state.warships.length === 0)
      return
    const cssW = container.clientWidth
    const cssH = container.clientHeight
    const mapW = state.map.width
    const mapH = state.map.height
    const r = Math.max(3, Math.min(7, camera.zoom * 2.5))
    screenCtx.save()

    const drawDot = (wx: number, wy: number, rad: number, fill: string, ring: string): void => {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const sx = worldToScreenX(wx + dx * mapW)
          const sy = worldToScreenY(wy + dy * mapH)
          if (sx < -rad || sx > cssW + rad || sy < -rad || sy > cssH + rad) continue
          screenCtx.beginPath()
          screenCtx.arc(sx, sy, rad, 0, Math.PI * 2)
          screenCtx.fillStyle = fill
          screenCtx.fill()
          screenCtx.lineWidth = 1.5
          screenCtx.strokeStyle = ring
          screenCtx.stroke()
        }
      }
    }

    // Handelsschiffe: kleiner, schlichter Punkt in Absender-Farbe (Gold-Default).
    const tradeR = Math.max(2.5, r * 0.85)
    for (const ship of state.tradeShips) {
      const { wx, wy } = shipWorldPos(ship)
      const owner = state.players.get(ship.fromOwnerId)
      const fill = owner === undefined ? '#e8c14a' : rgbaToCssLocal(owner.color)
      drawDot(wx, wy, tradeR, fill, shipRelationRing(ship.fromOwnerId))
    }
    // Transport-Boote: größerer Punkt + weißer Doppel-Rand + Truppenzahl darüber —
    // klar von den Handelsschiffen abgehoben.
    const boatR = r * 1.45
    screenCtx.textAlign = 'center'
    screenCtx.textBaseline = 'bottom'
    screenCtx.font = `bold ${String(Math.max(10, Math.round(9 + camera.zoom * 0.5)))}px system-ui, sans-serif`
    for (const boat of state.boats) {
      const { wx, wy } = shipWorldPos(boat)
      const player = state.players.get(boat.ownerId)
      const fill = player === undefined ? '#fff' : rgbaToCssLocal(player.color)
      drawDot(wx, wy, boatR, fill, shipRelationRing(boat.ownerId))
      // Truppenzahl als Label über dem Boot (nur die kameranächste Wrap-Kopie).
      const { sx, sy } = nearestWrappedScreenPos(wx, wy)
      if (sx > -60 && sx < cssW + 60 && sy > -20 && sy < cssH + 20) {
        const label = fmtCompactRender(boat.troops)
        const ty = sy - boatR - 3
        screenCtx.lineWidth = 3
        screenCtx.strokeStyle = 'rgba(0,0,0,0.85)'
        screenCtx.strokeText(label, sx, ty)
        screenCtx.fillStyle = '#ffffff'
        screenCtx.fillText(label, sx, ty)
      }
    }
    // Kriegsschiffe: Pixel-Sprite (Rumpf + Flagge) im Beziehungs-Ring + HP-Leiste.
    const warSprite = getWarshipSprite()
    const warR = r * 1.6
    for (const ws of state.warships) {
      const { wx, wy } = shipWorldPos(ws)
      const { sx, sy } = nearestWrappedScreenPos(wx, wy)
      if (sx < -warR || sx > cssW + warR || sy < -warR || sy > cssH + warR) continue
      // Angriffs-Reichweiten-Ring (Toggle) um eigene Kriegsschiffe.
      if (shipRangesVisible && ws.ownerId === lutHumanId) {
        screenCtx.beginPath()
        screenCtx.arc(sx, sy, NAVAL_RANGE * camera.zoom, 0, Math.PI * 2)
        screenCtx.strokeStyle = 'rgba(120,200,255,0.5)'
        screenCtx.lineWidth = 1.5
        screenCtx.setLineDash([5, 4])
        screenCtx.stroke()
        screenCtx.setLineDash([])
      }
      // Auswahl-Ring (Box-Select) — heller cyan Kreis um gewählte Schiffe.
      if (selectedWarships.has(ws)) {
        screenCtx.beginPath()
        screenCtx.arc(sx, sy, warR + 3, 0, Math.PI * 2)
        screenCtx.strokeStyle = 'rgba(120,230,255,0.95)'
        screenCtx.lineWidth = 2.5
        screenCtx.stroke()
      }
      // Hintergrund-Scheibe in der BESITZERFARBE (zeigt, wem das Schiff gehört) + außen
      // der Beziehungs-Ring (weiß=eigen, grün=verbündet, rot=Groll, schwarz=neutral).
      const owner = state.players.get(ws.ownerId)
      screenCtx.beginPath()
      screenCtx.arc(sx, sy, warR, 0, Math.PI * 2)
      screenCtx.fillStyle =
        owner === undefined ? 'rgba(15,18,24,0.85)' : rgbaToCssLocal(owner.color)
      screenCtx.fill()
      // Dunkle Tönung darüber, damit der graue Schiff-Sprite lesbar bleibt.
      screenCtx.fillStyle = 'rgba(10,12,18,0.45)'
      screenCtx.fill()
      screenCtx.lineWidth = 2.5
      screenCtx.strokeStyle = shipRelationRing(ws.ownerId)
      screenCtx.stroke()
      if (warSprite !== null) {
        const ss = warR * 1.8
        const prev = screenCtx.imageSmoothingEnabled
        screenCtx.imageSmoothingEnabled = false
        screenCtx.drawImage(warSprite, sx - ss / 2, sy - ss / 2, ss, ss)
        screenCtx.imageSmoothingEnabled = prev
      }
      // HP-Leiste UNTER dem Schiff (immer sichtbar — bei nur 5 HP gut ablesbar).
      const hpFrac = Math.max(0, Math.min(1, ws.hp / WARSHIP_HP))
      const bw = warR * 2
      const byl = sy + warR + 3
      screenCtx.fillStyle = 'rgba(0,0,0,0.7)'
      screenCtx.fillRect(sx - warR, byl, bw, 3)
      screenCtx.fillStyle = hpFrac > 0.4 ? '#5dd75d' : '#e84545'
      screenCtx.fillRect(sx - warR, byl, bw * hpFrac, 3)
    }
    screenCtx.restore()
  }

  /** Zeichnet fliegende Kriegsschiff-Projektile als kurze helle Leuchtspur (Schütze-Farbe). */
  function drawProjectiles(): void {
    if (state.projectiles.length === 0) return
    const mapW = state.map.width
    const mapH = state.map.height
    const z = camera.zoom
    screenCtx.save()
    screenCtx.lineCap = 'round'
    for (const pr of state.projectiles) {
      const tp = shipWorldPos(pr.target)
      const frac = Math.min(1, pr.travel / PROJECTILE_TRAVEL_TICKS)
      // Interpolation entlang der kürzeren Torus-Richtung von Abfeuer- zu Zielposition.
      const dx = tp.wx - pr.fromX - mapW * Math.round((tp.wx - pr.fromX) / mapW)
      const dy = tp.wy - pr.fromY - mapH * Math.round((tp.wy - pr.fromY) / mapH)
      const wx = pr.fromX + dx * frac
      const wy = pr.fromY + dy * frac
      const { sx, sy } = nearestWrappedScreenPos(wx, wy)
      if (
        sx < -20 ||
        sx > container.clientWidth + 20 ||
        sy < -20 ||
        sy > container.clientHeight + 20
      )
        continue
      // Kurze Spur entgegen der Flugrichtung.
      const len = Math.max(4, z * 0.5)
      const m = Math.hypot(dx, dy) || 1
      const ux = (dx / m) * len
      const uy = (dy / m) * len
      const owner = state.players.get(pr.shooter.ownerId)
      screenCtx.strokeStyle = owner === undefined ? '#ffe08a' : rgbaToCssLocal(owner.color)
      screenCtx.lineWidth = Math.max(1.5, z * 0.18)
      screenCtx.beginPath()
      screenCtx.moveTo(sx - ux, sy - uy)
      screenCtx.lineTo(sx, sy)
      screenCtx.stroke()
      // Heller Kopf.
      screenCtx.beginPath()
      screenCtx.arc(sx, sy, Math.max(1.5, z * 0.22), 0, Math.PI * 2)
      screenCtx.fillStyle = '#fff4c2'
      screenCtx.fill()
    }
    screenCtx.restore()
  }

  /** Zeichnet die Auswahl-Box (Box-Select) während des Ziehens. */
  function drawSelectionBox(): void {
    if (selectionBox === null) return
    const x = Math.min(selectionBox.x0, selectionBox.x1)
    const y = Math.min(selectionBox.y0, selectionBox.y1)
    const wd = Math.abs(selectionBox.x1 - selectionBox.x0)
    const ht = Math.abs(selectionBox.y1 - selectionBox.y0)
    screenCtx.save()
    screenCtx.fillStyle = 'rgba(120,230,255,0.12)'
    screenCtx.fillRect(x, y, wd, ht)
    screenCtx.strokeStyle = 'rgba(120,230,255,0.9)'
    screenCtx.lineWidth = 1.5
    screenCtx.strokeRect(x, y, wd, ht)
    screenCtx.restore()
  }

  /** Rand-Farbe eines Schiffs nach Beziehung des Besitzers zum Menschen. */
  function shipRelationRing(ownerId: number): string {
    const humanId = lutHumanId
    if (humanId < 0 || ownerId === humanId) return 'rgba(255,255,255,0.9)'
    if (areAllied(state.alliances, humanId, ownerId)) return 'rgba(90,220,120,0.95)'
    const human = state.players.get(humanId)
    const humanTiles = human ? Math.max(1, human.tilesOwned) : 1
    const grudge = state.grudge.get(directedKey(ownerId, humanId)) ?? 0
    if (grudge / humanTiles >= 0.05) return 'rgba(232,60,60,0.95)'
    return 'rgba(0,0,0,0.75)' // neutral: schwarzer Rand
  }

  function drawHoverOutline(): void {
    if (hoverTile === null) return
    const cssW = container.clientWidth
    const cssH = container.clientHeight
    const z = camera.zoom
    screenCtx.save()
    screenCtx.lineWidth = 1.5
    screenCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    // Genau eine Outline am Hover-Tile (Wrap-Kopie nächst der Kamera) — kein 3×3.
    const { sx, sy } = nearestWrappedScreenPos(hoverTile.x, hoverTile.y)
    if (!(sx + z < 0 || sx > cssW || sy + z < 0 || sy > cssH)) {
      screenCtx.strokeRect(sx + 0.5, sy + 0.5, z, z)
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

    screenCtx.save()
    screenCtx.lineWidth = 3
    for (const m of markers) {
      const tRaw = (now - m.startTime) / MARKER_DURATION_MS
      const t = Math.max(0, Math.min(1, tRaw))
      const radius = MARKER_RADIUS_START + t * (MARKER_RADIUS_END - MARKER_RADIUS_START)
      const alpha = 1 - t
      screenCtx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`

      // Genau ein Marker (Wrap-Kopie nächst der Kamera).
      const { sx, sy } = nearestWrappedScreenPos(m.worldX, m.worldY)
      if (sx < -radius || sx > cssW + radius || sy < -radius || sy > cssH + radius) continue
      screenCtx.beginPath()
      screenCtx.arc(sx, sy, radius, 0, Math.PI * 2)
      screenCtx.stroke()
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

        // Genau ein Crosshair (Wrap-Kopie nächst der Kamera).
        const { sx, sy } = nearestWrappedScreenPos(fx, fy)
        if (sx < -baseR || sx > cssW + baseR || sy < -baseR || sy > cssH + baseR) continue
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
    screenCtx.restore()
  }

  /** Bau-Vorschau: Geist-Symbol am Hover-Tile, grün wenn baubar, sonst rot. */
  function drawBuildPreview(): void {
    if (buildPreviewType === null || hoverTile === null) return
    const mapW = state.map.width
    const mapH = state.map.height
    const ref = tileRef(hoverTile.x, hoverTile.y, mapW, mapH)
    let humanId = -1
    for (const p of state.players.values()) {
      if (p.isHuman) {
        humanId = p.id
        break
      }
    }
    if (humanId < 0) return
    const valid = canBuildAt(state, humanId, ref, buildPreviewType)
    const ring = valid ? '#5dd75d' : '#e05a5a'
    const fill = valid ? 'rgba(93,215,93,0.30)' : 'rgba(224,90,90,0.30)'
    const cssW = container.clientWidth
    const cssH = container.clientHeight
    const z = camera.zoom
    const radius = Math.max(7, Math.min(13, z * 4.5))
    const glyph = BUILDING_GLYPH[buildPreviewType]
    const tx = hoverTile.x + 0.5
    const ty = hoverTile.y + 0.5
    screenCtx.save()
    screenCtx.textAlign = 'center'
    screenCtx.textBaseline = 'middle'
    screenCtx.font = `bold ${Math.round(radius * 1.3).toString()}px ui-monospace, monospace`
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const sx = worldToScreenX(tx + dx * mapW)
        const sy = worldToScreenY(ty + dy * mapH)
        if (sx < -radius || sx > cssW + radius || sy < -radius || sy > cssH + radius) continue
        // Verteidigungs-Reichweite bzw. Fabrik-Verbindungsradius als gestrichelten Ring andeuten.
        const previewRadiusTiles =
          buildPreviewType === 'defense'
            ? defenseRange(1)
            : buildPreviewType === 'factory'
              ? FACTORY_LINK_RANGE
              : 0
        if (previewRadiusTiles > 0) {
          screenCtx.beginPath()
          screenCtx.arc(sx, sy, previewRadiusTiles * z, 0, Math.PI * 2)
          screenCtx.strokeStyle = valid ? 'rgba(93,215,93,0.5)' : 'rgba(224,90,90,0.5)'
          screenCtx.lineWidth = 1.5
          screenCtx.setLineDash([4, 4])
          screenCtx.stroke()
          screenCtx.setLineDash([])
        }
        screenCtx.beginPath()
        screenCtx.arc(sx, sy, radius, 0, Math.PI * 2)
        screenCtx.fillStyle = fill
        screenCtx.fill()
        screenCtx.lineWidth = 2
        screenCtx.strokeStyle = ring
        screenCtx.stroke()
        screenCtx.fillStyle = '#fff'
        screenCtx.fillText(glyph, sx, sy + 0.5)
      }
    }
    screenCtx.restore()
  }

  /**
   * Reichweiten-Ring beim Hover über einen bestehenden, fertigen Verteidigungsposten
   * (gestrichelt, gelb) — macht Level-Unterschiede sichtbar. Im Bau-Modus unterdrückt.
   */
  function drawHoveredDefenseRange(): void {
    if (buildPreviewType !== null || hoverTile === null) return
    const mapW = state.map.width
    const mapH = state.map.height
    const ref = tileRef(hoverTile.x, hoverTile.y, mapW, mapH)
    const b = state.buildings.get(ref)
    if (b === undefined || b.type !== 'defense' || !isBuildingComplete(b, state.tick)) return
    const z = camera.zoom
    const r = defenseRange(b.level) * z
    const tx = hoverTile.x + 0.5
    const ty = hoverTile.y + 0.5
    const cssW = container.clientWidth
    const cssH = container.clientHeight
    screenCtx.save()
    screenCtx.strokeStyle = 'rgba(232,180,74,0.7)'
    screenCtx.lineWidth = 1.5
    screenCtx.setLineDash([5, 4])
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const sx = worldToScreenX(tx + dx * mapW)
        const sy = worldToScreenY(ty + dy * mapH)
        if (sx < -r || sx > cssW + r || sy < -r || sy > cssH + r) continue
        screenCtx.beginPath()
        screenCtx.arc(sx, sy, r, 0, Math.PI * 2)
        screenCtx.stroke()
      }
    }
    screenCtx.setLineDash([])
    screenCtx.restore()
  }

  function render(): void {
    if (state.tick !== lastBitmapTick) {
      // Wurden Ticks übersprungen (z.B. bei hohem Speed / Frame-Drops)? Dann reicht
      // das inkrementelle Update des letzten Ticks nicht — einmal voll neu backen.
      if (state.tick - lastBitmapTick !== 1) bitmapBaked = false
      paintBitmap()
      lastBitmapTick = state.tick
    }
    drawTiled()
    drawCaptureFlashes()
    drawFlashes()
    drawHoverOutline()
    drawAttackFronts()
    drawAttackTargets()
    drawShips()
    drawProjectiles()
    drawBuildingLinks()
    drawBuildings()
    drawHoveredDefenseRange()
    drawBuildPreview()
    drawMarkers()
    drawLabels()
    drawSelectionBox()
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
    setBuildPreview(type: BuildingType | null): void {
      buildPreviewType = type
    },
    toggleShipRanges(): boolean {
      shipRangesVisible = !shipRangesVisible
      return shipRangesVisible
    },
    setSelectionBox(box): void {
      selectionBox = box
    },
    selectWarshipsInBox(box): number {
      selectedWarships.clear()
      const x0 = Math.min(box.x0, box.x1)
      const x1 = Math.max(box.x0, box.x1)
      const y0 = Math.min(box.y0, box.y1)
      const y1 = Math.max(box.y0, box.y1)
      for (const ws of state.warships) {
        if (ws.ownerId !== lutHumanId) continue
        const { wx, wy } = shipWorldPos(ws)
        const { sx, sy } = nearestWrappedScreenPos(wx, wy)
        if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) selectedWarships.add(ws)
      }
      return selectedWarships.size
    },
    clearWarshipSelection(): void {
      selectedWarships.clear()
    },
    hasWarshipSelection(): boolean {
      // Tote Schiffe aus der Auswahl entfernen, dann prüfen.
      for (const ws of [...selectedWarships])
        if (!state.warships.includes(ws)) selectedWarships.delete(ws)
      return selectedWarships.size > 0
    },
    selectedWarshipIndices(): number[] {
      const idx: number[] = []
      for (let i = 0; i < state.warships.length; i++) {
        const ws = state.warships[i]
        if (ws !== undefined && selectedWarships.has(ws)) idx.push(i)
      }
      return idx
    },
    centerOnPlayer,
    destroy,
  }
}
