# `src/core/` — Game Simulation

## Zweck

Deterministische Spiel-Simulation. Diese Schicht weiß **nichts** über Rendering,
DOM, Pixi.js oder den Browser. Sie ist reine TypeScript-Logik und könnte theoretisch
auch in Node oder einem Web Worker laufen.

## Was gehört rein

- Game-State (Spieler, Territorien, Einheiten, Tick-Counter)
- Update-Loop / Tick-Logik
- Regeln (was passiert wenn Spieler A Tile B erobert)
- Seeded PRNG (deterministisch, niemals `Math.random()`)
- Event-Bus zwischen Sub-Systemen

## Was gehört NICHT rein

- Pixi.js, Canvas, WebGL
- DOM-Zugriffe (`document`, `window`)
- Input-Handling (kommt aus `src/input/`)
- Rendering-spezifische Datenstrukturen

## Konventionen

- **Keine `Math.random()`** — immer den seeded PRNG aus `core/random.ts` nutzen
- **Keine Floats für State** — verwende Integer wenn möglich (Determinismus)
- **Keine `Date.now()`** — Zeit kommt aus dem Tick-Counter
- **Reine Funktionen** wo immer möglich, mutierender State an klar definierten Stellen

## Öffentliche API

(wird in Phase B definiert)
