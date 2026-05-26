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

(wird in Phase B definiert)
