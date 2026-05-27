# `src/ui/` — DOM-basierte UI

## Zweck

HUD, Menüs, Modals — alles was nicht im Pixi-Canvas, sondern als DOM-Element gerendert wird.

## Was gehört rein

- Hauptmenü, Lobby-Screen
- HUD-Elemente (Punkte, Ressourcen, Mini-Map)
- Modal-Dialoge (Settings, Pause, Game-Over)
- Tooltips
- Buttons, Inputs, Slider

## Was gehört NICHT rein

- Game-Welt-Rendering (das ist `src/render/`)
- Direkte State-Mutation (immer über Intents)
- Input-Handling für Game-Aktionen (das ist `src/input/`)

## Konventionen

- **Vanilla DOM** oder leichte Web Components — kein React, kein Vue, kein Framework-Overhead
- **UI liest State** aus `core/`, mutiert ihn nicht
- **Aktionen via Intents** an `core/`

## Öffentliche API

### `start-menu.ts` — Match-Konfigurator vor dem Spielstart

```ts
interface StartMenuValues {
  playerName: string
  mapSize: number // 128 | 256 | 512 | 1024
  aiCount: number // 1-7
  victoryPct: number // 50-100 in 5er Schritten
}

function createStartMenu(
  container: HTMLElement,
  initial: StartMenuValues,
  onStart: (values: StartMenuValues) => void,
): { destroy(): void }
```

### `hud.ts` — Spieler-Stats, Truppen-Slider, Game-Over-Banner

```ts
function createHUD(
  container: HTMLElement,
  state: GameState,
  onSliderChange: (pct: number) => void,
  onNewMatch: () => void,
): { update(): void; destroy(): void }
```

Pro Frame `update()` aufrufen — liest aktuellen Tick, Phase, Spieler-Stats.

### `minimap.ts` — Übersichtskarte mit Torus-Wrap-Indikator

```ts
function createMinimap(deps: {
  container: HTMLElement
  state: GameState
  camera: Camera
  getBitmap(): HTMLCanvasElement
  getViewportSize(): { width: number; height: number }
}): { update(): void; destroy(): void }
```

Zeichnet das Renderer-Bitmap downscaled in die untere rechte Ecke, plus
3×3-getilte Viewport-Box (zeigt visuell den Wrap an).

### `hover-tooltip.ts` — Gegner-Stats per Mouse-Over

```ts
function createHoverTooltip(
  container: HTMLElement,
  state: GameState,
  humanId: number,
): {
  show(worldX, worldY, screenX, screenY): void
  hide(): void
  destroy(): void
}
```

### `player-names.ts` — Random-Namen-Pool

```ts
function pickRandomNames(count: number): string[]
const NAME_POOL_SIZE: number
```

### `colors.ts` — Farb-Utilities

```ts
function hslToRgba(h: number, s: number, l: number): number
function randomColor(): number
function rgbaToCss(rgba: number): string
```
