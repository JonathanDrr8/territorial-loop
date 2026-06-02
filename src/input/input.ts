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
import { MAX_BUILDING_LEVEL, type BuildingType } from '../core/buildings'
import type { Intent } from '../core/intent'
import type { BomberRoute } from '../core/ships'
import type { CameraMode } from '../ui/start-menu'
import { resolveAction, type KeyAction } from './keybinds'
import { getHudPrefs, setHudPref } from '../ui/hud-prefs'

/** Reihenfolge, in der das Mausrad im Bomber-Modus durch die Flugrouten blättert. */
const BOMBER_ROUTES: readonly BomberRoute[] = ['direct', 'arc-left', 'arc-right']

/** Bau-Aktion (aus den Keybinds) → Gebäudetyp für den Bau-Modus. */
const BUILD_ACTION_TYPE: Partial<Record<KeyAction, BuildingType>> = {
  buildCity: 'city',
  buildDefense: 'defense',
  buildPort: 'port',
  buildFactory: 'factory',
  buildAirport: 'airport',
  buildFlak: 'flak',
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
  /** Optional: C-Taste → Kamera auf das eigene Gebiets-Zentrum. */
  recenterSelf?(): void
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
  /** Optional: gewähltes Bau-Level (Level-Direktbau) hat sich geändert — hält die UI-Leisten synchron. */
  readonly onBuildLevelChange?: (level: number) => void
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
  /**
   * Optional: Soll ein Doppelklick auf `tile` ein Transportboot losschicken? `true`, wenn das Ziel
   * fremdes/neutrales Land ist, das NUR über Wasser erreichbar ist — dann ist ein Boot statt eines
   * (sowieso wirkungslosen) Land-Angriffs gemeint.
   */
  readonly shouldBoatTo?: (tile: number) => boolean
  /**
   * Optional: Gehört `tile` dem eigenen Spieler? Auf Touch wird ein Tipp auf eigenes Gebiet wie
   * Shift+Linksklick behandelt (Rundum-Ausbreiten/Angriff entlang der ganzen Grenze).
   */
  readonly ownsTile?: (tile: number) => boolean
  /**
   * Optional: schiebt beim Touch-Drag-Platzieren die Bau-Vorschau (Geist) auf `worldX/worldY` —
   * OHNE das Hover-Tooltip (das würde das gerade platzierte Gebäude verdecken).
   */
  readonly onBuildPreviewMove?: (worldX: number, worldY: number) => void
}

export interface InputHandler {
  /** Schaltet den Bau-Modus für `type` um (für HUD-Bau-Buttons; wie der Hotkey). */
  toggleBuildMode(type: BuildingType): void
  /** Setzt das Ziel-Level fürs Direktbauen (Stufen-Leiste); wird gemerkt. */
  setBuildLevel(level: number): void
  /** Aktuelles (gemerktes) Bau-Level. */
  getBuildLevel(): number
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
  // Letzte bekannte Maus-Position (Client-Koords) — für den Tasten-Aufruf des Aktionsmenüs (E),
  // damit das Rad ohne Rechtsklick an der Cursor-Stelle aufgeht (RMB-Workaround). −1 = noch unbekannt.
  let lastPointerClientX = -1
  let lastPointerClientY = -1
  // Touch-Steuerung (parallel zur Maus): 1 Finger ziehen = Kamera, 2 Finger = Pinch-Zoom,
  // kurz tippen = Angriff (primaryAction), Long-Press = Kontextrad (onRadialMenu).
  let touchStartX = 0
  let touchStartY = 0
  let touchLastX = 0
  let touchLastY = 0
  let touchMoved = false
  let touchStartTime = 0
  let pinchDist = 0 // letzte Finger-Distanz beim 2-Finger-Pinch; 0 = kein Pinch aktiv
  // Drag-Platzieren (Bau-Modus): 1 Finger zeigt die Gebäude-Vorschau und schiebt sie; beim Loslassen
  // wird gebaut. Aktiv nur solange ein Bau-Modus läuft. Verhindert Pan/Long-Press während des Ziehens.
  let placingBuild = false
  // Doppeltipp-Ziehen zum Zoomen (wie Karten-Apps): zweiter Tipp + Ziehen (hoch = rein) zoomt um den
  // Tipp-Punkt. `lastTapEnd` merkt den letzten Tipp, um den Doppeltipp zu erkennen.
  let lastTapEnd: { time: number; x: number; y: number } | null = null
  let zoomDragActive = false
  let zoomStartY = 0
  let zoomStartZoom = 1
  let zoomAnchorX = 0
  let zoomAnchorY = 0
  const DOUBLE_TAP_DIST = 32
  let longPressFired = false
  let longPressTimer: ReturnType<typeof setTimeout> | null = null
  // Verzögerter Tipp-Angriff (einstellbares Fenster, in dem ein zweiter Tipp stattdessen den
  // Doppeltipp-Zoom auslöst). Bei 0 ms feuert der Angriff sofort (kein Timer).
  let pendingTapTimer: ReturnType<typeof setTimeout> | null = null
  function clearPendingTap(): void {
    if (pendingTapTimer !== null) {
      clearTimeout(pendingTapTimer)
      pendingTapTimer = null
    }
  }
  const LONG_PRESS_MS = 450
  const TOUCH_TAP_MAX_MS = 400
  // Bau-Modus (per Hotkey gesetzt): nächster Linksklick platziert dieses Gebäude.
  let buildMode: BuildingType | null = null
  // Ziel-Level fürs Direktbauen (Level-Direktbau) — aus den Präferenzen gemerkt, bleibt über
  // Bau-Modus-Wechsel hinweg bestehen (Jonathans „merkt sich das zuletzt Gewählte").
  let buildLevel = Math.max(1, Math.min(MAX_BUILDING_LEVEL, getHudPrefs().buildLevel))
  // Boot-Modus (Toggle): solange aktiv schickt jeder Linksklick ein Transport-Boot.
  let boatMode = false
  // Doppelklick-Erkennung: zwei schnelle Linksklicks auf dasselbe Tile (für „Boot per Doppelklick").
  let lastLeftClick: { tile: number; time: number } | null = null
  const DOUBLE_CLICK_MS = 350
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
    // Beim Scharfschalten das gemerkte Level an die UI-Leisten melden (Vorauswahl hervorheben).
    if (mode !== null) deps.onBuildLevelChange?.(buildLevel)
  }

  /** Ziel-Level fürs Direktbauen setzen (1..MAX) — wird als Präferenz gemerkt. */
  function setBuildLevel(level: number): void {
    const n = Math.max(1, Math.min(MAX_BUILDING_LEVEL, Math.round(level)))
    if (n === buildLevel) return
    buildLevel = n
    setHudPref('buildLevel', n)
    deps.onBuildLevelChange?.(n)
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
    lastPointerClientX = e.clientX
    lastPointerClientY = e.clientY
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
    // Linke Taste: war es ein Drag (Pan), keine Klick-Aktion. Sonst Primär-Aktion (s. primaryAction).
    if (wasMoved) return
    primaryAction(e.clientX, e.clientY, e.shiftKey)
  }

  /** Client-Koords → Welt-Koords (gefloort) + Canvas-lokale Screen-Koords. */
  function clientToWorld(
    clientX: number,
    clientY: number,
  ): {
    worldX: number
    worldY: number
    sx: number
    sy: number
  } {
    const rect = canvas.getBoundingClientRect()
    const sx = clientX - rect.left
    const sy = clientY - rect.top
    const halfW = canvas.clientWidth / 2
    const halfH = canvas.clientHeight / 2
    const worldX = Math.floor((sx - halfW) / camera.zoom + camera.x)
    const worldY = Math.floor((sy - halfH) / camera.zoom + camera.y)
    return { worldX, worldY, sx, sy }
  }

  /** Zeigt die Bau-Vorschau (Geist) an einer Touch-Position (Drag-Platzieren auf dem Handy). */
  function moveBuildPreview(clientX: number, clientY: number): void {
    const { worldX, worldY } = clientToWorld(clientX, clientY)
    deps.onBuildPreviewMove?.(worldX, worldY)
  }

  /**
   * Primär-Aktion an einer Screen-Position (Client-Koords) — gemeinsam für Linksklick UND
   * Touch-Tippen, damit beide sich identisch verhalten. Respektiert den aktiven Modus
   * (Bau/Bomber/Kriegsschiff/Boot), sonst Angriff in Slider-Größe. `shiftKey` nur per Maus
   * relevant (Rundum-Angriff); Touch übergibt false.
   */
  function primaryAction(
    clientX: number,
    clientY: number,
    shiftKey: boolean,
    isTouchTap = false,
  ): void {
    // Zuschauer-Modus: keine Spieler-Aktionen.
    if (deps.interactive === false) return
    // Klick ins Leere (kein Modus) hebt eine Kriegsschiff-Auswahl auf — statt anzugreifen.
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

    const { worldX, worldY } = clientToWorld(clientX, clientY)
    const target = tileRef(worldX, worldY, mapWidth, mapHeight)

    // Bau-Modus aktiv → platziert das Gebäude. Der Modus BLEIBT aktiv (Toggle pro Gebäude), damit
    // man schnell mehrere desselben Typs setzt. Beenden: Hotkey/Knopf erneut, Rechtsklick oder Esc.
    if (buildMode !== null) {
      const snapped = deps.snapBuildTarget?.(target, buildMode) ?? target
      const placeable = deps.canPlaceBuilding?.(snapped, buildMode) ?? true
      if (!placeable) return
      emit({
        type: 'build',
        playerId: deps.playerId,
        tile: snapped,
        buildingType: buildMode,
        level: buildLevel,
      })
      return
    }
    // Bomber-Modus → Bomber (gewählte Route) zum Ziel; Modus bleibt (Cooldown drosselt).
    if (bomberMode) {
      emit({
        type: 'launch-bomber',
        playerId: deps.playerId,
        targetTile: target,
        route: bomberRoute,
      })
      return
    }
    // Kriegsschiff-Modus → Kriegsschiff zum Ziel; Modus bleibt (Limit drosselt).
    if (warshipMode) {
      emit({ type: 'launch-warship', playerId: deps.playerId, targetTile: target })
      return
    }

    const troops = deps.getPlayerTroops()
    const pct = deps.getSliderPct()
    const sendTroops = Math.floor((troops * pct) / 100)

    // Boot-Modus → ein Boot (Slider-Größe) zum Ziel; Modus bleibt.
    if (boatMode) {
      if (sendTroops > 0) {
        emit({ type: 'boat', playerId: deps.playerId, targetTile: target, troops: sendTroops })
      }
      return
    }

    // Doppel-Tipp/-Klick auf nur-über-Wasser-erreichbares Land → direkt ein Transportboot.
    const now = performance.now()
    const isDouble =
      lastLeftClick !== null &&
      lastLeftClick.tile === target &&
      now - lastLeftClick.time < DOUBLE_CLICK_MS
    lastLeftClick = { tile: target, time: now }
    if (isDouble && !shiftKey && deps.shouldBoatTo?.(target) === true) {
      if (sendTroops > 0) {
        emit({ type: 'boat', playerId: deps.playerId, targetTile: target, troops: sendTroops })
      }
      return
    }

    // Sonst: Angriff. Mit Shift → Rundum (omni). Auf Touch zählt ein Tipp auf EIGENES Gebiet wie
    // Shift+Linksklick (Rundum-Ausbreiten) — sonst wäre ein Angriff auf sich selbst wirkungslos.
    const omni = shiftKey || (isTouchTap && deps.ownsTile?.(target) === true)
    if (sendTroops > 0) {
      emit({
        type: 'attack',
        playerId: deps.playerId,
        targetTile: target,
        troops: sendTroops,
        omni,
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

  function clearLongPress(): void {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }

  function onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      const t = e.touches[0]
      if (t === undefined) return
      touchStartX = touchLastX = t.clientX
      touchStartY = touchLastY = t.clientY
      lastPointerClientX = t.clientX
      lastPointerClientY = t.clientY
      touchMoved = false
      longPressFired = false
      pinchDist = 0
      touchStartTime = performance.now()
      clearLongPress()
      // Doppeltipp-Ziehen (Karten-Geste): zweiter Tipp kurz nach dem ersten am selben Punkt →
      // beim Ziehen zoomen (hoch = rein), kein Pan/Bau/Long-Press.
      const nowDt = performance.now()
      // Doppeltipp-Fenster = einstellbare Tipp-Angriff-Verzögerung. Bei 0 (aus) gibt es keinen
      // Doppeltipp-Zoom mehr (der erste Tipp greift sofort an) — bewusster Trade-off.
      const tapDelay = getHudPrefs().tapAttackDelayMs
      if (
        tapDelay > 0 &&
        lastTapEnd !== null &&
        nowDt - lastTapEnd.time < tapDelay &&
        Math.abs(t.clientX - lastTapEnd.x) < DOUBLE_TAP_DIST &&
        Math.abs(t.clientY - lastTapEnd.y) < DOUBLE_TAP_DIST &&
        deps.interactive !== false
      ) {
        // Zweiter Tipp = Doppeltipp-Zoom → den noch verzögerten Angriff des ersten Tipps verwerfen.
        clearPendingTap()
        zoomDragActive = true
        zoomStartY = t.clientY
        zoomStartZoom = camera.zoom
        zoomAnchorX = t.clientX
        zoomAnchorY = t.clientY
        e.preventDefault()
        return
      }
      // Bau-Modus → Drag-Platzieren: Gebäude-Vorschau erscheint sofort unter dem Finger und folgt
      // ihm; beim Loslassen wird gebaut. Kein Long-Press/Pan, kein Tap-Bauen.
      if (buildMode !== null && deps.interactive !== false) {
        placingBuild = true
        moveBuildPreview(touchStartX, touchStartY)
        e.preventDefault()
        return
      }
      // Long-Press (Finger ruhig halten) → Kontextrad an der Stelle.
      longPressTimer = setTimeout(() => {
        longPressTimer = null
        if (touchMoved || deps.interactive === false || deps.onRadialMenu === undefined) return
        longPressFired = true
        const rect = canvas.getBoundingClientRect()
        deps.onRadialMenu(
          screenToTile(touchStartX, touchStartY),
          touchStartX - rect.left,
          touchStartY - rect.top,
        )
      }, LONG_PRESS_MS)
      e.preventDefault()
    } else if (e.touches.length === 2) {
      // Zweiter Finger → Pinch beginnt; Tap/Long-Press/Platzieren verwerfen.
      clearLongPress()
      placingBuild = false
      touchMoved = true
      const a = e.touches[0]
      const b = e.touches[1]
      if (a === undefined || b === undefined) return
      pinchDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      touchLastX = (a.clientX + b.clientX) / 2
      touchLastY = (a.clientY + b.clientY) / 2
      e.preventDefault()
    }
  }

  function onTouchMove(e: TouchEvent): void {
    if (e.touches.length === 1 && pinchDist === 0) {
      const t = e.touches[0]
      if (t === undefined) return
      // Doppeltipp-Ziehen: hoch = reinzoomen, runter = raus — um den Tipp-Punkt herum.
      if (zoomDragActive) {
        touchMoved = true
        const factor = Math.pow(2, (zoomStartY - t.clientY) / 200) // 200px ≈ 2×
        const rect = canvas.getBoundingClientRect()
        const sx = zoomAnchorX - rect.left
        const sy = zoomAnchorY - rect.top
        const halfW = canvas.clientWidth / 2
        const halfH = canvas.clientHeight / 2
        const wxBefore = (sx - halfW) / camera.zoom + camera.x
        const wyBefore = (sy - halfH) / camera.zoom + camera.y
        camera.zoom = Math.max(minZoom(), Math.min(ZOOM_MAX, zoomStartZoom * factor))
        const wxAfter = (sx - halfW) / camera.zoom + camera.x
        const wyAfter = (sy - halfH) / camera.zoom + camera.y
        camera.x = (((camera.x + wxBefore - wxAfter) % mapWidth) + mapWidth) % mapWidth
        camera.y = (((camera.y + wyBefore - wyAfter) % mapHeight) + mapHeight) % mapHeight
        e.preventDefault()
        return
      }
      // Drag-Platzieren: die Bau-Vorschau folgt dem Finger, die Kamera bleibt stehen.
      if (placingBuild) {
        touchLastX = t.clientX
        touchLastY = t.clientY
        lastPointerClientX = t.clientX
        lastPointerClientY = t.clientY
        touchMoved = true
        moveBuildPreview(t.clientX, t.clientY)
        e.preventDefault()
        return
      }
      const dx = t.clientX - touchLastX
      const dy = t.clientY - touchLastY
      touchLastX = t.clientX
      touchLastY = t.clientY
      lastPointerClientX = t.clientX
      lastPointerClientY = t.clientY
      if (
        Math.abs(t.clientX - touchStartX) > DRAG_THRESHOLD ||
        Math.abs(t.clientY - touchStartY) > DRAG_THRESHOLD
      ) {
        touchMoved = true
        clearLongPress()
      }
      camera.x -= dx / camera.zoom
      camera.y -= dy / camera.zoom
      camera.x = ((camera.x % mapWidth) + mapWidth) % mapWidth
      camera.y = ((camera.y % mapHeight) + mapHeight) % mapHeight
      e.preventDefault()
    } else if (e.touches.length === 2) {
      const a = e.touches[0]
      const b = e.touches[1]
      if (a === undefined || b === undefined) return
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const midX = (a.clientX + b.clientX) / 2
      const midY = (a.clientY + b.clientY) / 2
      if (pinchDist > 0 && dist > 0) {
        // Zoom um den Pinch-Mittelpunkt (wie beim Mausrad), dann Pan per Mittelpunkt-Verschiebung.
        const rect = canvas.getBoundingClientRect()
        const sx = midX - rect.left
        const sy = midY - rect.top
        const halfW = canvas.clientWidth / 2
        const halfH = canvas.clientHeight / 2
        const wxBefore = (sx - halfW) / camera.zoom + camera.x
        const wyBefore = (sy - halfH) / camera.zoom + camera.y
        camera.zoom = Math.max(minZoom(), Math.min(ZOOM_MAX, camera.zoom * (dist / pinchDist)))
        const wxAfter = (sx - halfW) / camera.zoom + camera.x
        const wyAfter = (sy - halfH) / camera.zoom + camera.y
        camera.x += wxBefore - wxAfter - (midX - touchLastX) / camera.zoom
        camera.y += wyBefore - wyAfter - (midY - touchLastY) / camera.zoom
        camera.x = ((camera.x % mapWidth) + mapWidth) % mapWidth
        camera.y = ((camera.y % mapHeight) + mapHeight) % mapHeight
      }
      pinchDist = dist
      touchLastX = midX
      touchLastY = midY
      e.preventDefault()
    }
  }

  function onTouchEnd(e: TouchEvent): void {
    clearLongPress()
    // Ein Finger vom Pinch gelöst → Pan-Basis auf den verbliebenen setzen, kein Tap.
    if (e.touches.length === 1) {
      const t = e.touches[0]
      if (t !== undefined) {
        touchLastX = t.clientX
        touchLastY = t.clientY
      }
      pinchDist = 0
      touchMoved = true
      return
    }
    if (e.touches.length === 0) {
      const now = performance.now()
      // Zoom-Drag beendet: war es ein echtes Ziehen → keine Tipp-Aktion, Doppeltipp-Kette brechen.
      if (zoomDragActive) {
        zoomDragActive = false
        if (touchMoved) {
          pinchDist = 0
          lastTapEnd = null
          return
        }
        // Doppeltipp OHNE Ziehen → normal weiterbehandeln (z. B. Doppeltipp = Transportboot).
      }
      // Drag-Platzieren beendet → am Endpunkt bauen (auch nach Ziehen). Bau-Modus bleibt aktiv.
      if (placingBuild) {
        placingBuild = false
        lastTapEnd = { time: now, x: touchStartX, y: touchStartY }
        primaryAction(touchLastX, touchLastY, false)
        return
      }
      const wasTap = !touchMoved && !longPressFired && now - touchStartTime < TOUCH_TAP_MAX_MS
      pinchDist = 0
      // Touch-Tipp (isTouchTap=true): Tipp auf eigenes Gebiet wirkt wie Shift+Linksklick (omni).
      // Tipp merken → ermöglicht die Doppeltipp-Zoom-Geste beim nächsten Antippen.
      if (wasTap) {
        lastTapEnd = { time: now, x: touchStartX, y: touchStartY }
        // Angriff um die eingestellte Verzögerung aufschieben, damit ein sofort folgender zweiter
        // Tipp stattdessen den Doppeltipp-Zoom auslösen kann (der dann clearPendingTap() ruft).
        // 0 ms = sofort angreifen (kein Doppeltipp-Zoom, dafür schnelleres Antippen).
        const tapDelay = getHudPrefs().tapAttackDelayMs
        const tx = touchStartX
        const ty = touchStartY
        clearPendingTap()
        if (tapDelay <= 0) {
          primaryAction(tx, ty, false, true)
        } else {
          pendingTapTimer = setTimeout(() => {
            pendingTapTimer = null
            primaryAction(tx, ty, false, true)
          }, tapDelay)
        }
      }
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase()
    // Feste Tasten zuerst (nicht umbelegbar): Pause (Leertaste), Esc, Kamera-Pan (WASD).
    if (e.code === 'Space') {
      events.pause()
      e.preventDefault()
      return
    }
    if (e.key === 'Escape') {
      // Esc bricht erst Bomber-/Kriegsschiff-/Boot-/Bau-Modus ab, sonst zurück zum Menü.
      if (bomberMode) setBomberMode(false)
      else if (warshipMode) setWarshipMode(false)
      else if (boatMode) setBoatMode(false)
      else if (buildMode !== null) setBuildMode(null)
      else events.escape?.()
      return
    }
    if (key in PAN_KEYS) {
      heldPan.add(key)
      startPan()
      return
    }
    // Konfigurierbare Aktions-Tasten (Reverse-Lookup auf die Tastenkarte).
    const action = resolveAction(key)
    if (action === undefined) return
    // Tempo + Zentrieren auch im Zuschauer-Modus erlaubt; alles andere nur interaktiv.
    if (action === 'speedDown') {
      events.cycleSpeed(-1)
      return
    }
    if (action === 'speedUp') {
      events.cycleSpeed(1)
      return
    }
    if (action === 'center') {
      events.recenterSelf?.()
      return
    }
    if (deps.interactive === false) return
    const buildType = BUILD_ACTION_TYPE[action]
    if (buildType !== undefined) {
      setBuildMode(buildMode === buildType ? null : buildType)
      return
    }
    switch (action) {
      case 'boat':
        setBoatMode(!boatMode)
        break
      case 'bomber':
        setBomberMode(!bomberMode)
        break
      case 'warship':
        setWarshipMode(!warshipMode)
        break
      case 'shipRanges':
        deps.onToggleShipRanges?.()
        break
      case 'radial':
        // Aktionsmenü an der Mausposition öffnen — Alternative zum Rechtsklick (bei manchen
        // Browsern/Setups kommt RMB nicht an). Öffnet dasselbe Radialmenü wie ein Rechtsklick.
        if (deps.onRadialMenu !== undefined && lastPointerClientX >= 0) {
          const rect = canvas.getBoundingClientRect()
          deps.onRadialMenu(
            screenToTile(lastPointerClientX, lastPointerClientY),
            lastPointerClientX - rect.left,
            lastPointerClientY - rect.top,
          )
        }
        break
      default:
        break
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
  canvas.addEventListener('touchstart', onTouchStart, { passive: false })
  canvas.addEventListener('touchmove', onTouchMove, { passive: false })
  canvas.addEventListener('touchend', onTouchEnd)
  canvas.addEventListener('touchcancel', onTouchEnd)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  return {
    toggleBuildMode(type: BuildingType): void {
      setBuildMode(buildMode === type ? null : type)
    },
    setBuildLevel(level: number): void {
      setBuildLevel(level)
    },
    getBuildLevel(): number {
      return buildLevel
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
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
      clearLongPress()
      clearPendingTap()
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
