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
import type { BomberRoute } from '../core/ships'
import type { CameraMode } from '../ui/start-menu'

/** Reihenfolge, in der das Mausrad im Bomber-Modus durch die Flugrouten blättert. */
const BOMBER_ROUTES: readonly BomberRoute[] = ['direct', 'arc-left', 'arc-right']

/** Zahlen-Hotkey → Gebäudetyp für den Bau-Modus (1=Stadt, 2=Verteidigung, 3=Hafen, 4=Fabrik). */
const BUILD_HOTKEYS: Record<string, BuildingType> = {
  '1': 'city',
  '2': 'defense',
  '3': 'port',
  '4': 'factory',
  '5': 'airport',
  '6': 'flak',
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
  /** Optional: setzt den Angriffs-Slider (Shift+Mausrad). */
  readonly setSliderPct?: (pct: number) => void
  readonly playerId: number
  readonly emit: (intent: Intent) => void
  readonly events: InputEvents
  /** Spieler-Aktionen erlaubt (Angriff/Bau/Menü)? false im Zuschauer-Modus — nur Kamera. */
  readonly interactive?: boolean
  /** Kamera-Darstellung (steuert das Zoom-Minimum): Kacheln / feste Box / dynamische Box. */
  readonly cameraMode?: CameraMode
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
  /** Optional: Boot-Modus an/aus (für HUD-Feedback). */
  readonly onBoatModeChange?: (on: boolean) => void
  /** Optional: Bomber-Modus an/aus + aktuelle Route (für HUD-Feedback + Render-Vorschau). */
  readonly onBomberModeChange?: (on: boolean, route: BomberRoute) => void
  /** Optional: Kriegsschiff-Modus an/aus (für HUD-Feedback + Render-Reichweiten-Vorschau). */
  readonly onWarshipModeChange?: (on: boolean) => void
  /** Optional: Taste „r" → Reichweiten-Ringe der eigenen Kriegsschiffe umschalten. */
  readonly onToggleShipRanges?: () => void
  /** Optional: aktuelle Auswahl-Box (Screen-CSS) beim Shift-Ziehen; null = aus. */
  readonly onSelectionBox?: (box: { x0: number; y0: number; x1: number; y1: number } | null) => void
  /** Optional: Shift-Box losgelassen → eigene Kriegsschiffe in der Box auswählen. */
  readonly onBoxSelect?: (box: { x0: number; y0: number; x1: number; y1: number }) => void
  /** Optional: Sind eigene Kriegsschiffe ausgewählt? (entscheidet Shift+LMB: schicken vs. Angriff). */
  readonly hasWarshipSelection?: () => boolean
  /** Optional: ausgewählte Kriegsschiffe zum Wasser-`tile` schicken. */
  readonly onMoveWarships?: (tile: number) => void
  /** Optional: Kriegsschiff-Auswahl aufheben (Klick ins Leere). */
  readonly onClearWarshipSelection?: () => void
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
  /**
   * Optional: rastet das Bau-Ziel auf ein nahes eigenes Gebäude desselben Typs (Snapping beim
   * Upgraden — kein pixelgenaues Treffen nötig). Liefert das (ggf. gerastete) Ziel-Tile.
   */
  readonly snapBuildTarget?: (tile: number, type: BuildingType) => number
}

export interface InputHandler {
  /** Schaltet den Bau-Modus für `type` um (für HUD-Bau-Buttons; wie der Hotkey). */
  toggleBuildMode(type: BuildingType): void
  /** Schaltet den Boot-Modus um (für einen HUD-Button; wie der Hotkey „b"). */
  toggleBoatMode(): void
  /** Schaltet den Bomber-Modus um (für einen HUD-Button; wie der Hotkey „7"). */
  toggleBomberMode(): void
  /** Schaltet den Kriegsschiff-Modus um (für einen HUD-Button; wie der Hotkey „8"). */
  toggleWarshipMode(): void
  destroy(): void
}

// Absolute Untergrenze klein genug, dass auch sehr große Karten ganz rausgezoomt
// werden können — das Kacheln verhindert ohnehin die fit-basierte Grenze in minZoom().
const ZOOM_MIN_ABS = 0.08
// Weit genug reinzoomen, um einzelne Tiles/Gebäude groß zu sehen.
const ZOOM_MAX = 40
const ZOOM_STEP = 1.15
/** Schrittweite (Prozentpunkte) der Angriffsgröße pro Shift+Mausrad-Raste. */
const ATTACK_STEP_PCT = 10

export function createInputHandler(deps: InputDeps): InputHandler {
  const { canvas, camera, mapWidth, mapHeight, emit, events } = deps

  // Kamera-Darstellung (Start-Menü): bestimmt, wie weit man rauszoomen darf.
  const cameraMode: CameraMode = deps.cameraMode ?? 'dynamic'

  /**
   * Dynamisches Zoom-Minimum je Kamera-Modus.
   *  - `fixed`/`dynamic`: bis 0.6 × „Welt passt komplett" — man darf die ganze Welt + Rand sehen
   *    (Renderer zeichnet dann eine Kopie mit schwarzen Rändern, kein Kacheln).
   *  - `period`: genau eine Welt-Periode (`max(canvasW/mapW, canvasH/mapH)`) — nahtloser Wrap,
   *    kein Weiter-Rauszoomen, keine „Tapete".
   *  - `tiles`: bis ~87% Füllung (das Kacheln übernimmt den Rest); nie unter ZOOM_MIN_ABS.
   */
  function minZoom(): number {
    if (cameraMode === 'dynamic' || cameraMode === 'fixed') {
      const fit = Math.min(canvas.clientWidth / mapWidth, canvas.clientHeight / mapHeight)
      return Math.max(ZOOM_MIN_ABS, fit * 0.6)
    }
    if (cameraMode === 'period') {
      return Math.max(canvas.clientWidth / mapWidth, canvas.clientHeight / mapHeight)
    }
    const fitW = canvas.clientWidth / (mapWidth * 1.15)
    const fitH = canvas.clientHeight / (mapHeight * 1.15)
    return Math.max(ZOOM_MIN_ABS, Math.min(fitW, fitH))
  }

  // Kamera-Drag mit Maus: 0 = linke, 2 = rechte Taste, null = kein Drag. Beide Tasten
  // pannen beim Ziehen; ohne nennenswerte Bewegung ist es ein Klick (links: Angriff/Bau,
  // rechts: Radialmenü).
  let dragButton: number | null = null
  let dragDownX = 0
  let dragDownY = 0
  let lastDragX = 0
  let lastDragY = 0
  let dragMoved = false
  const DRAG_THRESHOLD = 6
  // Bau-Modus (per Hotkey gesetzt): nächster Linksklick platziert dieses Gebäude.
  let buildMode: BuildingType | null = null
  // Boot-Modus (Toggle): solange aktiv schickt jeder Linksklick ein Transport-Boot.
  let boatMode = false
  // Bomber-Modus (Toggle, Taste 7): solange aktiv startet jeder Linksklick einen Bomber zum Ziel;
  // Mausrad blättert durch die Routen. Live-Vorschau (Route/Radius/Warnung) zeigt der Renderer.
  let bomberMode = false
  let bomberRoute: BomberRoute = 'direct'
  // Kriegsschiff-Modus (Toggle, Taste 8): Linksklick auf Wasser entsendet ein Kriegsschiff zum Ziel.
  let warshipMode = false
  // Box-Select (Shift+Linksklick-Ziehen): Start-Position in CSS-/Client-Koords, null = inaktiv.
  let boxStart: { sx: number; sy: number; clientX: number; clientY: number } | null = null
  // WASD-Kamera-Pan: gedrückte Richtungstasten + laufende rAF-Schleife.
  const heldPan = new Set<string>()
  let panRaf: number | null = null

  function setBuildMode(mode: BuildingType | null): void {
    // Bau-, Boot-, Bomber- und Kriegsschiff-Modus schließen sich gegenseitig aus.
    if (mode !== null && boatMode) setBoatMode(false)
    if (mode !== null && bomberMode) setBomberMode(false)
    if (mode !== null && warshipMode) setWarshipMode(false)
    if (buildMode === mode) return
    buildMode = mode
    deps.onBuildModeChange?.(mode)
  }

  function setBoatMode(on: boolean): void {
    if (on && buildMode !== null) setBuildMode(null)
    if (on && bomberMode) setBomberMode(false)
    if (on && warshipMode) setWarshipMode(false)
    if (boatMode === on) return
    boatMode = on
    deps.onBoatModeChange?.(on)
  }

  function setBomberMode(on: boolean): void {
    if (on && buildMode !== null) setBuildMode(null)
    if (on && boatMode) setBoatMode(false)
    if (on && warshipMode) setWarshipMode(false)
    if (bomberMode === on) return
    bomberMode = on
    deps.onBomberModeChange?.(on, bomberRoute)
  }

  function setWarshipMode(on: boolean): void {
    if (on && buildMode !== null) setBuildMode(null)
    if (on && boatMode) setBoatMode(false)
    if (on && bomberMode) setBomberMode(false)
    if (warshipMode === on) return
    warshipMode = on
    deps.onWarshipModeChange?.(on)
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
    // Shift+Linksklick startet einen Box-Select (Kriegsschiffe) statt Pan/Angriff.
    if (
      e.button === 0 &&
      e.shiftKey &&
      deps.interactive !== false &&
      deps.onBoxSelect !== undefined &&
      buildMode === null &&
      !boatMode
    ) {
      const rect = canvas.getBoundingClientRect()
      boxStart = {
        sx: e.clientX - rect.left,
        sy: e.clientY - rect.top,
        clientX: e.clientX,
        clientY: e.clientY,
      }
      e.preventDefault()
      return
    }
    if (e.button === 0 || e.button === 2) {
      // Beide Tasten starten einen potenziellen Drag-Pan; bei kaum Bewegung wird's
      // beim Loslassen als Klick (links) bzw. Radialmenü (rechts) gewertet.
      dragButton = e.button
      dragDownX = e.clientX
      dragDownY = e.clientY
      lastDragX = e.clientX
      lastDragY = e.clientY
      dragMoved = false
      e.preventDefault()
    }
  }

  function onMouseMove(e: MouseEvent): void {
    if (boxStart !== null) {
      const rect = canvas.getBoundingClientRect()
      deps.onSelectionBox?.({
        x0: boxStart.sx,
        y0: boxStart.sy,
        x1: e.clientX - rect.left,
        y1: e.clientY - rect.top,
      })
      return
    }
    if (dragButton !== null) {
      // Taste außerhalb des Canvas losgelassen? Dann Drag beenden (sonst „klebt" der Pan).
      if (e.buttons === 0) {
        dragButton = null
      } else {
        const dx = e.clientX - lastDragX
        const dy = e.clientY - lastDragY
        lastDragX = e.clientX
        lastDragY = e.clientY
        if (
          Math.abs(e.clientX - dragDownX) > DRAG_THRESHOLD ||
          Math.abs(e.clientY - dragDownY) > DRAG_THRESHOLD
        ) {
          dragMoved = true
        }
        camera.x -= dx / camera.zoom
        camera.y -= dy / camera.zoom
        camera.x = ((camera.x % mapWidth) + mapWidth) % mapWidth
        camera.y = ((camera.y % mapHeight) + mapHeight) % mapHeight
        return
      }
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
    // Box-Select abschließen (Shift+Linksklick).
    if (boxStart !== null && e.button === 0) {
      const start = boxStart
      boxStart = null
      deps.onSelectionBox?.(null)
      const moved =
        Math.abs(e.clientX - start.clientX) > DRAG_THRESHOLD ||
        Math.abs(e.clientY - start.clientY) > DRAG_THRESHOLD
      if (moved) {
        const rect = canvas.getBoundingClientRect()
        deps.onBoxSelect?.({
          x0: start.sx,
          y0: start.sy,
          x1: e.clientX - rect.left,
          y1: e.clientY - rect.top,
        })
      } else {
        // Shift-Klick ohne Ziehen: Auswahl vorhanden → Schiffe schicken; sonst Rundum-Angriff.
        const target = screenToTile(e.clientX, e.clientY)
        if (deps.hasWarshipSelection?.() === true) {
          deps.onMoveWarships?.(target)
        } else {
          const troops = deps.getPlayerTroops()
          const sendTroops = Math.floor((troops * deps.getSliderPct()) / 100)
          if (sendTroops > 0) {
            emit({
              type: 'attack',
              playerId: deps.playerId,
              targetTile: target,
              troops: sendTroops,
              omni: true,
            })
          }
        }
      }
      return
    }
    // Nur die Taste finalisieren, die den Drag begonnen hat.
    if (dragButton !== e.button) return
    const wasMoved = dragMoved
    dragButton = null

    if (e.button === 2) {
      if (wasMoved || deps.interactive === false) return
      // Hält man ein Gebäude / ist im Boot-Modus, bricht Rechtsklick das ab (wie Esc)
      // — statt das Radialmenü zu öffnen.
      if (buildMode !== null) {
        setBuildMode(null)
        return
      }
      if (boatMode) {
        setBoatMode(false)
        return
      }
      if (bomberMode) {
        setBomberMode(false)
        return
      }
      if (warshipMode) {
        setWarshipMode(false)
        return
      }
      // Sonst Rechtsklick ohne Drag → Radialmenü an dem Tile
      if (deps.onRadialMenu !== undefined) {
        const rect = canvas.getBoundingClientRect()
        deps.onRadialMenu(
          screenToTile(e.clientX, e.clientY),
          e.clientX - rect.left,
          e.clientY - rect.top,
        )
      }
      return
    }
    // Linke Taste: war es ein Drag (Pan), keine Klick-Aktion.
    if (wasMoved) return
    // Zuschauer-Modus: keine Spieler-Aktionen (Angriff/Bau).
    if (deps.interactive === false) return

    // Klick ins Leere (ohne Shift, kein Bau/Boot) hebt eine Kriegsschiff-Auswahl auf —
    // statt direkt anzugreifen (verhindert versehentliche Angriffe nach dem Steuern).
    if (
      buildMode === null &&
      !boatMode &&
      !bomberMode &&
      !warshipMode &&
      deps.hasWarshipSelection?.() === true
    ) {
      deps.onClearWarshipSelection?.()
      return
    }

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
      // Auf ein nahes eigenes Gebäude rasten (Upgrade ohne pixelgenaues Treffen).
      const snapped = deps.snapBuildTarget?.(target, buildMode) ?? target
      const placeable = deps.canPlaceBuilding?.(snapped, buildMode) ?? true
      if (!placeable) return
      emit({ type: 'build', playerId: deps.playerId, tile: snapped, buildingType: buildMode })
      setBuildMode(null)
      return
    }

    // Bomber-Modus aktiv → Linksklick startet einen Bomber (gewählte Route) zum Ziel. Der Modus
    // bleibt an (mehrere Würfe möglich; der Flughafen-Cooldown drosselt von selbst).
    if (bomberMode) {
      emit({
        type: 'launch-bomber',
        playerId: deps.playerId,
        targetTile: target,
        route: bomberRoute,
      })
      return
    }

    // Kriegsschiff-Modus aktiv → Linksklick auf Wasser entsendet ein Kriegsschiff. Die Sim prüft
    // Hafen/Route/Gold und meldet sonst still zurück. Der Modus bleibt an (Limit drosselt).
    if (warshipMode) {
      emit({ type: 'launch-warship', playerId: deps.playerId, targetTile: target })
      return
    }

    const troops = deps.getPlayerTroops()
    const pct = deps.getSliderPct()
    const sendTroops = Math.floor((troops * pct) / 100)

    // Boot-Modus aktiv → Linksklick schickt EIN Boot (Slider-Truppengröße) zum Ziel.
    // Der Modus bleibt an, damit man mehrere Boote losschicken kann (Esc/Toggle beendet).
    if (boatMode) {
      if (sendTroops > 0) {
        emit({ type: 'boat', playerId: deps.playerId, targetTile: target, troops: sendTroops })
      }
      return
    }

    // Sonst: Angriff. Mit Shift → Rundum (omni): auf eigenem Gebiet gleichmäßig in die
    // Wildnis ausbreiten, auf einer Nation entlang der GANZEN gemeinsamen Grenze angreifen.
    if (sendTroops > 0) {
      emit({
        type: 'attack',
        playerId: deps.playerId,
        targetTile: target,
        troops: sendTroops,
        omni: e.shiftKey,
      })
      deps.onAttackClick?.(worldX, worldY)
    }
  }

  function onContextMenu(e: MouseEvent): void {
    // Rechtsklick-Kontextmenü unterdrücken — wir nutzen Rechtsklick für Pan
    e.preventDefault()
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault()
    // Bomber-Modus: Shift+Mausrad blättert durch die Flugrouten (direkt/Bogen links/rechts).
    // Normales Mausrad zoomt weiterhin, auch im Bomber-Modus.
    if (bomberMode && e.shiftKey) {
      const dir = e.deltaY < 0 ? 1 : -1
      const idx = BOMBER_ROUTES.indexOf(bomberRoute)
      bomberRoute =
        BOMBER_ROUTES[(idx + dir + BOMBER_ROUTES.length) % BOMBER_ROUTES.length] ?? 'direct'
      deps.onBomberModeChange?.(true, bomberRoute)
      return
    }
    // Shift+Mausrad → Angriffsgröße ändern (statt Zoom). Feinschritte (1 %) unter 10 %,
    // gröber (10 %) darüber — runter UND wieder hoch, sodass 1 % erreichbar ist.
    if (e.shiftKey && deps.setSliderPct !== undefined && deps.interactive !== false) {
      const cur = deps.getSliderPct()
      const up = e.deltaY < 0
      const fine = up ? cur < 10 : cur <= 10
      const step = fine ? 1 : ATTACK_STEP_PCT
      const next = Math.max(1, Math.min(100, cur + (up ? step : -step)))
      deps.setSliderPct(next)
      return
    }
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
    } else if (key in BUILD_HOTKEYS && deps.interactive !== false) {
      const mode = BUILD_HOTKEYS[key]
      if (mode !== undefined) setBuildMode(buildMode === mode ? null : mode)
    } else if (key === 'b' && deps.interactive !== false) {
      setBoatMode(!boatMode)
    } else if (key === '7' && deps.interactive !== false) {
      setBomberMode(!bomberMode)
    } else if (key === '8' && deps.interactive !== false) {
      setWarshipMode(!warshipMode)
    } else if (key === 'r' && deps.interactive !== false) {
      deps.onToggleShipRanges?.()
    } else if (e.key === 'Escape') {
      // Esc bricht erst Bomber-/Kriegsschiff-/Boot-/Bau-Modus ab, sonst zurück zum Menü
      if (bomberMode) setBomberMode(false)
      else if (warshipMode) setWarshipMode(false)
      else if (boatMode) setBoatMode(false)
      else if (buildMode !== null) setBuildMode(null)
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
    toggleBuildMode(type: BuildingType): void {
      setBuildMode(buildMode === type ? null : type)
    },
    toggleBoatMode(): void {
      setBoatMode(!boatMode)
    },
    toggleBomberMode(): void {
      setBomberMode(!bomberMode)
    },
    toggleWarshipMode(): void {
      setWarshipMode(!warshipMode)
    },
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
