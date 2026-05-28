/**
 * Maus- und Tastatur-Input.
 *
 * Übersetzt User-Eingaben in Game-Intents bzw. UI-Events:
 *  - Linksklick auf eine Welt-Position → AttackIntent mit aktuellem Slider-Wert
 *  - Right-Click-Drag → Camera-Pan (mutiert `camera.x`/`camera.y`)
 *  - Mausrad → Zoom (mutiert `camera.zoom`)
 *  - Leertaste → Pause-Toggle (über `events`)
 *  - 1/2/5 → Speed-Wechsel (über `events`)
 *
 * Slider-State lebt extern — `getSliderPct()` wird pro Klick angerufen.
 */

import type { Camera } from '../render/renderer'
import { tileRef } from '../world/torus'
import type { BuildingType } from '../core/buildings'
import type { Intent } from '../core/intent'

/** Zahlen-Hotkey → Gebäudetyp für den Bau-Modus (1=Stadt, 2=Verteidigung, 3=Markt, 4=Hafen). */
const BUILD_HOTKEYS: Record<string, BuildingType> = {
  '1': 'city',
  '2': 'defense',
  '3': 'market',
  '4': 'port',
}

/** WASD → Kamera-Pan-Richtung (dx, dy in Welt-Tiles pro Schritt-Einheit). */
const PAN_KEYS: Record<string, readonly [number, number]> = {
  w: [0, -1],
  a: [-1, 0],
  s: [0, 1],
  d: [1, 0],
}

/** Kamera-Pan-Geschwindigkeit in Screen-Pixeln pro Frame (durch Zoom geteilt → Welt-Delta). */
const PAN_PX_PER_FRAME = 12

export interface InputEvents {
  pause(): void
  /** Schaltet die Sim-Geschwindigkeit eine Stufe hoch (+1) oder runter (-1). */
  cycleSpeed(dir: 1 | -1): void
  /** Optional: ESC-Taste → zurück zum Start-Menü. */
  escape?(): void
}

export interface InputDeps {
  readonly canvas: HTMLCanvasElement
  readonly camera: Camera
  readonly mapWidth: number
  readonly mapHeight: number
  /** Wird pro tick aufgerufen um Player-Truppen für die Slider-Konvertierung zu erhalten. */
  readonly getPlayerTroops: () => number
  readonly getSliderPct: () => number
  readonly playerId: number
  readonly emit: (intent: Intent) => void
  readonly events: InputEvents
  /**
   * Optional: wird beim erfolgreichen Linksklick mit den Welt-Koords (vor `tileRef`)
   * aufgerufen — z.B. für visuelles Klick-Feedback im Renderer.
   */
  readonly onAttackClick?: (worldX: number, worldY: number) => void
  /**
   * Optional: wird bei jeder Mausbewegung (außer während Drag) aufgerufen.
   * Liefert Welt-Koords (float) und Screen-Koords (in CSS-Pixeln, viewport-relativ).
   */
  readonly onHover?: (worldX: number, worldY: number, screenX: number, screenY: number) => void
  /** Optional: wird ausgerufen wenn der Cursor das Canvas verlässt. */
  readonly onHoverEnd?: () => void
  /** Optional: Bau-Modus hat sich geändert (für HUD-Feedback). null = kein Bau-Modus. */
  readonly onBuildModeChange?: (mode: BuildingType | null) => void
  /**
   * Optional: Rechtsklick ohne Drag → Radialmenü an Welt-Tile öffnen.
   * Liefert TileRef + Screen-Position (CSS-Pixel).
   */
  readonly onRadialMenu?: (tile: number, screenX: number, screenY: number) => void
  /**
   * Optional: Prüft ob im Bau-Modus auf `tile` der `type` platziert werden darf.
   * Ist die Position ungültig, bleibt der Bau-Modus aktiv (kein Platzieren).
   */
  readonly canPlaceBuilding?: (tile: number, type: BuildingType) => boolean
}

export interface InputHandler {
  destroy(): void
}

// Absolute Untergrenze klein genug, dass auch sehr große Karten ganz rausgezoomt
// werden können — das Kacheln verhindert ohnehin die fit-basierte Grenze in minZoom().
const ZOOM_MIN_ABS = 0.08
const ZOOM_MAX = 16
const ZOOM_STEP = 1.15

export function createInputHandler(deps: InputDeps): InputHandler {
  const { canvas, camera, mapWidth, mapHeight, emit, events } = deps

  /**
   * Dynamisches Zoom-Minimum: nicht weiter raus als bis die Karte ~87% des
   * Viewports füllt — so sieht man (große) Karten praktisch komplett, ohne dass
   * sich die Welt vielfach zur "Tapete" kachelt. Niemals unter ZOOM_MIN_ABS.
   */
  function minZoom(): number {
    const fitW = canvas.clientWidth / (mapWidth * 1.15)
    const fitH = canvas.clientHeight / (mapHeight * 1.15)
    return Math.max(ZOOM_MIN_ABS, Math.min(fitW, fitH))
  }

  let dragging = false
  let lastDragX = 0
  let lastDragY = 0
  // Rechtsklick: Drag-Distanz tracken — bei kaum Bewegung = Radialmenü statt Pan.
  let rmbDownX = 0
  let rmbDownY = 0
  let rmbMoved = false
  const DRAG_THRESHOLD = 6
  // Bau-Modus (per Hotkey gesetzt): nächster Linksklick platziert dieses Gebäude.
  let buildMode: BuildingType | null = null
  // WASD-Kamera-Pan: gedrückte Richtungstasten + laufende rAF-Schleife.
  const heldPan = new Set<string>()
  let panRaf: number | null = null

  function setBuildMode(mode: BuildingType | null): void {
    if (buildMode === mode) return
    buildMode = mode
    deps.onBuildModeChange?.(mode)
  }

  function panStep(): void {
    if (heldPan.size === 0) {
      panRaf = null
      return
    }
    let dx = 0
    let dy = 0
    for (const k of heldPan) {
      const v = PAN_KEYS[k]
      if (v !== undefined) {
        dx += v[0]
        dy += v[1]
      }
    }
    if (dx !== 0 || dy !== 0) {
      const d = PAN_PX_PER_FRAME / camera.zoom
      camera.x = (((camera.x + dx * d) % mapWidth) + mapWidth) % mapWidth
      camera.y = (((camera.y + dy * d) % mapHeight) + mapHeight) % mapHeight
    }
    panRaf = requestAnimationFrame(panStep)
  }

  function startPan(): void {
    if (panRaf === null) panRaf = requestAnimationFrame(panStep)
  }

  function screenToTile(clientX: number, clientY: number): number {
    const rect = canvas.getBoundingClientRect()
    const sx = clientX - rect.left
    const sy = clientY - rect.top
    const halfW = canvas.clientWidth / 2
    const halfH = canvas.clientHeight / 2
    const worldX = Math.floor((sx - halfW) / camera.zoom + camera.x)
    const worldY = Math.floor((sy - halfH) / camera.zoom + camera.y)
    return tileRef(worldX, worldY, mapWidth, mapHeight)
  }

  function onMouseDown(e: MouseEvent): void {
    if (e.button === 2) {
      // Rechtsklick → Drag-Pan startet (oder Radialmenü falls keine Bewegung)
      dragging = true
      lastDragX = e.clientX
      lastDragY = e.clientY
      rmbDownX = e.clientX
      rmbDownY = e.clientY
      rmbMoved = false
      e.preventDefault()
    }
  }

  function onMouseMove(e: MouseEvent): void {
    if (dragging) {
      const dx = e.clientX - lastDragX
      const dy = e.clientY - lastDragY
      lastDragX = e.clientX
      lastDragY = e.clientY
      if (
        Math.abs(e.clientX - rmbDownX) > DRAG_THRESHOLD ||
        Math.abs(e.clientY - rmbDownY) > DRAG_THRESHOLD
      ) {
        rmbMoved = true
      }
      camera.x -= dx / camera.zoom
      camera.y -= dy / camera.zoom
      camera.x = ((camera.x % mapWidth) + mapWidth) % mapWidth
      camera.y = ((camera.y % mapHeight) + mapHeight) % mapHeight
      return
    }
    if (deps.onHover !== undefined) {
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const halfW = canvas.clientWidth / 2
      const halfH = canvas.clientHeight / 2
      const worldX = (sx - halfW) / camera.zoom + camera.x
      const worldY = (sy - halfH) / camera.zoom + camera.y
      deps.onHover(worldX, worldY, sx, sy)
    }
  }

  function onMouseLeave(): void {
    deps.onHoverEnd?.()
  }

  function onMouseUp(e: MouseEvent): void {
    if (e.button === 2) {
      dragging = false
      // Rechtsklick ohne nennenswerte Bewegung → Radialmenü an dem Tile
      if (!rmbMoved && deps.onRadialMenu !== undefined) {
        const rect = canvas.getBoundingClientRect()
        deps.onRadialMenu(
          screenToTile(e.clientX, e.clientY),
          e.clientX - rect.left,
          e.clientY - rect.top,
        )
      }
      return
    }
    if (e.button !== 0) return

    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const halfW = canvas.clientWidth / 2
    const halfH = canvas.clientHeight / 2
    const worldX = Math.floor((sx - halfW) / camera.zoom + camera.x)
    const worldY = Math.floor((sy - halfH) / camera.zoom + camera.y)
    const target = tileRef(worldX, worldY, mapWidth, mapHeight)

    // Bau-Modus aktiv → Linksklick platziert das Gebäude. Bei ungültiger Position
    // (z.B. Hafen nicht am Wasser, fremdes Tile, zu wenig Gold) bleibt der Modus
    // aktiv, damit man einfach ein anderes Tile wählen kann.
    if (buildMode !== null) {
      const placeable = deps.canPlaceBuilding?.(target, buildMode) ?? true
      if (!placeable) return
      emit({ type: 'build', playerId: deps.playerId, tile: target, buildingType: buildMode })
      setBuildMode(null)
      return
    }

    // Sonst: Angriff
    const troops = deps.getPlayerTroops()
    const pct = deps.getSliderPct()
    const sendTroops = Math.floor((troops * pct) / 100)
    if (sendTroops > 0) {
      emit({ type: 'attack', playerId: deps.playerId, targetTile: target, troops: sendTroops })
      deps.onAttackClick?.(worldX, worldY)
    }
  }

  function onContextMenu(e: MouseEvent): void {
    // Rechtsklick-Kontextmenü unterdrücken — wir nutzen Rechtsklick für Pan
    e.preventDefault()
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault()
    // Welt-Punkt unter Cursor merken, damit der Zoom dort "zentriert" wirkt
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const halfW = canvas.clientWidth / 2
    const halfH = canvas.clientHeight / 2
    const worldXBefore = (sx - halfW) / camera.zoom + camera.x
    const worldYBefore = (sy - halfH) / camera.zoom + camera.y

    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
    camera.zoom = Math.max(minZoom(), Math.min(ZOOM_MAX, camera.zoom * factor))

    // Nach dem Zoom: Camera so verschieben dass die Welt-Position unter dem Cursor bleibt
    const worldXAfter = (sx - halfW) / camera.zoom + camera.x
    const worldYAfter = (sy - halfH) / camera.zoom + camera.y
    camera.x += worldXBefore - worldXAfter
    camera.y += worldYBefore - worldYAfter
  }

  function onKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase()
    if (e.code === 'Space') {
      events.pause()
      e.preventDefault()
    } else if (key in PAN_KEYS) {
      heldPan.add(key)
      startPan()
    } else if (e.key === ',') {
      events.cycleSpeed(-1)
    } else if (e.key === '.') {
      events.cycleSpeed(1)
    } else if (key in BUILD_HOTKEYS) {
      const mode = BUILD_HOTKEYS[key]
      if (mode !== undefined) setBuildMode(buildMode === mode ? null : mode)
    } else if (e.key === 'Escape') {
      // Esc bricht erst den Bau-Modus ab, sonst zurück zum Menü
      if (buildMode !== null) setBuildMode(null)
      else events.escape?.()
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    heldPan.delete(e.key.toLowerCase())
  }

  // Fokusverlust (Alt-Tab etc.): gedrückte Pan-Tasten zurücksetzen, sonst „klemmt" der Pan.
  function onBlur(): void {
    heldPan.clear()
  }

  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('mouseleave', onMouseLeave)
  canvas.addEventListener('contextmenu', onContextMenu)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  return {
    destroy(): void {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      canvas.removeEventListener('contextmenu', onContextMenu)
      canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      if (panRaf !== null) {
        cancelAnimationFrame(panRaf)
        panRaf = null
      }
    },
  }
}
