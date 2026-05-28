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

/** Hotkey → Gebäudetyp für den Bau-Modus. */
const BUILD_HOTKEYS: Record<string, BuildingType> = {
  q: 'city',
  w: 'defense',
  e: 'market',
  r: 'port',
}

export interface InputEvents {
  pause(): void
  setSpeed(multiplier: 1 | 2 | 5): void
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
}

export interface InputHandler {
  destroy(): void
}

const ZOOM_MIN_ABS = 0.5
const ZOOM_MAX = 16
const ZOOM_STEP = 1.15

export function createInputHandler(deps: InputDeps): InputHandler {
  const { canvas, camera, mapWidth, mapHeight, emit, events } = deps

  /**
   * Dynamisches Zoom-Minimum: nicht weiter raus als bis die Karte ~70% des
   * Viewports füllt — sonst kachelt sich die Welt vielfach zur "Tapete".
   * Niemals unter ZOOM_MIN_ABS.
   */
  function minZoom(): number {
    const fitW = canvas.clientWidth / (mapWidth * 1.4)
    const fitH = canvas.clientHeight / (mapHeight * 1.4)
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

  function setBuildMode(mode: BuildingType | null): void {
    if (buildMode === mode) return
    buildMode = mode
    deps.onBuildModeChange?.(mode)
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

    // Bau-Modus aktiv → Linksklick platziert das Gebäude (Core validiert eigenes Tile/Gold)
    if (buildMode !== null) {
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
    } else if (e.key === '1') {
      events.setSpeed(1)
    } else if (e.key === '2') {
      events.setSpeed(2)
    } else if (e.key === '5') {
      events.setSpeed(5)
    } else if (key in BUILD_HOTKEYS) {
      const mode = BUILD_HOTKEYS[key]
      if (mode !== undefined) setBuildMode(buildMode === mode ? null : mode)
    } else if (e.key === 'Escape') {
      // Esc bricht erst den Bau-Modus ab, sonst zurück zum Menü
      if (buildMode !== null) setBuildMode(null)
      else events.escape?.()
    }
  }

  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('mouseleave', onMouseLeave)
  canvas.addEventListener('contextmenu', onContextMenu)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown)

  return {
    destroy(): void {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      canvas.removeEventListener('contextmenu', onContextMenu)
      canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
    },
  }
}
