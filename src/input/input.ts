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
import type { Intent } from '../core/intent'

export interface InputEvents {
  pause(): void
  setSpeed(multiplier: 1 | 2 | 5): void
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
}

export interface InputHandler {
  destroy(): void
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 16
const ZOOM_STEP = 1.15

export function createInputHandler(deps: InputDeps): InputHandler {
  const { canvas, camera, mapWidth, mapHeight, emit, events } = deps

  let dragging = false
  let lastDragX = 0
  let lastDragY = 0

  function onMouseDown(e: MouseEvent): void {
    if (e.button === 2) {
      // Rechtsklick → Drag-Pan startet
      dragging = true
      lastDragX = e.clientX
      lastDragY = e.clientY
      e.preventDefault()
    }
  }

  function onMouseMove(e: MouseEvent): void {
    if (!dragging) return
    const dx = e.clientX - lastDragX
    const dy = e.clientY - lastDragY
    lastDragX = e.clientX
    lastDragY = e.clientY
    // Pan-Bewegung in Welt-Koords (zoom invertieren)
    camera.x -= dx / camera.zoom
    camera.y -= dy / camera.zoom
    // Wrap auf Welt-Bereich — fühlt sich auf dem Torus natürlicher an
    camera.x = ((camera.x % mapWidth) + mapWidth) % mapWidth
    camera.y = ((camera.y % mapHeight) + mapHeight) % mapHeight
  }

  function onMouseUp(e: MouseEvent): void {
    if (e.button === 2) {
      dragging = false
    } else if (e.button === 0) {
      // Linksklick auf Welt-Position → Attack-Intent
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const halfW = canvas.clientWidth / 2
      const halfH = canvas.clientHeight / 2
      const worldX = Math.floor((sx - halfW) / camera.zoom + camera.x)
      const worldY = Math.floor((sy - halfH) / camera.zoom + camera.y)
      const target = tileRef(worldX, worldY, mapWidth, mapHeight)

      const troops = deps.getPlayerTroops()
      const pct = deps.getSliderPct()
      const sendTroops = Math.floor((troops * pct) / 100)
      if (sendTroops > 0) {
        emit({
          type: 'attack',
          playerId: deps.playerId,
          targetTile: target,
          troops: sendTroops,
        })
      }
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
    camera.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, camera.zoom * factor))

    // Nach dem Zoom: Camera so verschieben dass die Welt-Position unter dem Cursor bleibt
    const worldXAfter = (sx - halfW) / camera.zoom + camera.x
    const worldYAfter = (sy - halfH) / camera.zoom + camera.y
    camera.x += worldXBefore - worldXAfter
    camera.y += worldYBefore - worldYAfter
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      events.pause()
      e.preventDefault()
    } else if (e.key === '1') {
      events.setSpeed(1)
    } else if (e.key === '2') {
      events.setSpeed(2)
    } else if (e.key === '5') {
      events.setSpeed(5)
    }
  }

  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('contextmenu', onContextMenu)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown)

  return {
    destroy(): void {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('contextmenu', onContextMenu)
      canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
    },
  }
}
