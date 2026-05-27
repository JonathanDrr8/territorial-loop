# `src/input/` — Eingabe-Verarbeitung

## Zweck

Maus-, Tastatur- und Touch-Eingaben in **Game-Intents** übersetzen.

## Was gehört rein

- Maus-Handler (Klick, Drag, Scroll für Zoom, Pan)
- Tastatur-Handler (Shortcuts, Kamera-Bewegung)
- Touch-Handler (Pinch-Zoom, Multi-Touch)
- Konvertierung Screen-Koordinaten → Welt-Koordinaten (mit Torus-Wrap)
- Intent-Emitter (gibt Intents an `core/` weiter)

## Was gehört NICHT rein

- Direkte State-Mutation (immer über Intents)
- UI-Buttons (die handhabt `src/ui/`)
- Rendering der Cursors (das ist `src/render/`)

## Konventionen

- **Inputs werden zu Intents** — kein direktes State-Manipulieren
- **Bildschirm-zu-Welt-Konvertierung wrappt** — Klick am Rand kann auf die andere Seite zeigen

## Öffentliche API

### `input.ts` — Maus + Tastatur

```ts
interface InputDeps {
  canvas: HTMLCanvasElement
  camera: Camera           // wird in-place gepant + gezoomt
  mapWidth, mapHeight: number
  playerId: number
  emit(intent: Intent): void
  getPlayerTroops(): number     // für Slider-% → absolute Truppen
  getSliderPct(): number
  events: { pause(); setSpeed(1|2|5) }
  onAttackClick?: (worldX, worldY) => void   // erfolgreicher Klick → Render-Marker
  onHover?: (worldX, worldY, screenX, screenY) => void  // Mouse-over für Tooltip
  onHoverEnd?: () => void
}

function createInputHandler(deps: InputDeps): { destroy(): void }
```

**Bindings:**

| Input                  | Aktion                                  |
| ---------------------- | --------------------------------------- |
| Linksklick             | AttackIntent (Slider-% × Truppen)       |
| Rechtsklick + Ziehen   | Camera-Pan, wrap-aware                  |
| Mausrad                | Zoom (Cursor-zentriert, range 0.5×-16×) |
| Leertaste              | Pause-Toggle                            |
| `1` / `2` / `5`        | Sim-Geschwindigkeit                     |
| Mausbewegung (no drag) | onHover-Callback                        |
| Mouse-Leave Canvas     | onHoverEnd-Callback                     |
