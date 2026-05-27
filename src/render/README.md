# `src/render/` — Canvas 2D Rendering

## Zweck

Visualisierung des Game-States via plain HTML5 Canvas 2D. Diese Schicht **liest**
den State aus `core/`, mutiert ihn aber nie.

> **Hinweis:** Ursprünglich war Pixi.js v8 mit WebGL geplant, hat aber auf
> manchen Linux-Compositor-Kombinationen still ein schwarzes Canvas erzeugt
> (Pixi initialisiert ohne Fehler, aber keine Pixel landen am Bildschirm).
> Canvas 2D ist portabler und für unsere Map-Größen schnell genug —
> 1024×1024 bei 60 fps Render + 10 Hz Sim mit komfortablen Reserven.

## Was gehört rein

- Offscreen-Bitmap in Map-Auflösung (State → Pixel-Farben pro Frame)
- On-Screen-Canvas mit getiltem `drawImage` der Bitmap → Torus-Wrap durch
  3×3-Replikation in dem für den Viewport sichtbaren Bereich
- Camera-Position + Zoom (Welt-Koords)
- Klick-Marker-Animation (expandierende, fadende Ringe)

## Was gehört NICHT rein

- Game-Logik (das ist `src/core/`)
- Input (das ist `src/input/`)
- DOM-UI (das ist `src/ui/`)

## Konventionen

- **Render liest, ändert nicht** — keine Mutation von Core-State
- **Camera = Welt-Koords + Zoom** — sehr einfaches Modell, kein eigener
  Render-Tree
- Torus-Wrap durch wiederholtes `drawImage` mit Offsets, nicht durch Shader

## Öffentliche API

### `renderer.ts`

```ts
interface Camera {
  x: number // welt-x am screen-center
  y: number // welt-y am screen-center
  zoom: number // 1 = pixelgenau, >1 = reingezoomt
}

interface Renderer {
  canvas: HTMLCanvasElement
  camera: Camera
  render(): void // pro Frame aufrufen
  getBitmap(): HTMLCanvasElement // map-aufgelöstes Bitmap (für Minimap)
  screenToWorld(sx, sy): { x: number; y: number } // CSS-Pixel → Welt-Koords
  addClickMarker(worldX, worldY): void // expandierender Ring
  destroy(): void
}

function createRenderer(container: HTMLElement, state: GameState): Renderer
```
