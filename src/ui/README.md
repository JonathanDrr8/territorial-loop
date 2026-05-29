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

### `menu-shell.ts` — Hauptmenü-Shell (ADR-0014)

Top-Nav-Shell mit Kategorie-Tabs (Spielen / Mehrspieler / Einstellungen / Changelog / Hilfe),
Header (Logo + Version, Name-Feld, Sprach-Umschalter de/en) und Footer. Komponiert die
Tab-Inhalte aus dem Toolkit von `start-menu.ts` und bestehenden Bausteinen (`lobby-browser.ts`,
Mehrspieler-Dialog via Callback). Texte über `t()` (siehe `src/i18n/`).

```ts
function createMenuShell(
  container: HTMLElement,
  initial: StartMenuValues,
  callbacks: {
    onStart(values: StartMenuValues, spectator: boolean): void
    onMultiplayer(values: StartMenuValues): void
    onJoinLobby(code: string, values: StartMenuValues): void
  },
  serverUrl?: string,
): { destroy(): void; showReconnect(room: string, cb: () => void): void }
```

### `start-menu.ts` — Menü-Typen + Formular-Toolkit

Keine eigene UI mehr (das alte Overlay ist in `menu-shell.ts` aufgegangen). Liefert die geteilten
Typen (`StartMenuValues`, `CameraMode`, …), Style-Konstanten und die Widget-Builder
(`makeSliderRow`, `makeSelectRow`, `makeTextRow`, `makeCheckRow`, `makeMapRow`), aus denen die
Tabs der Shell zusammengesetzt werden.

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
