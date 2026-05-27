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

### `random.ts` — PRNG

```ts
interface PRNG {
  next(): number // [0, 1)
  nextInt(min: number, max: number): number // Integer in [min, max)
  nextFloat(min: number, max: number): number
  randElement<T>(arr: readonly T[]): T
  chance(p: number): boolean
  shuffleArray<T>(arr: T[]): T[] // Fisher-Yates, in-place
}
function createPRNG(seed: string): PRNG
```

Algorithmus: Alea (via `seedrandom`). Selber Seed → selber Verlauf.

### `config.ts` — Spielmechanik-Konstanten und -Formeln

```ts
const HUMAN_START_TROOPS = 25_000
const BOT_START_TROOPS = 10_000
const HUMAN_DEFAULT_ATTACK_PCT = 20
const BOT_DEFAULT_ATTACK_PCT = 5

function maxTroops(numTilesOwned: number, opts?: { bot?: boolean }): number
function troopIncreaseRate(troops: number, max: number, opts?: { bot?: boolean }): number
```

Formel-Quelle: OpenFront (siehe ADR-0004). Werte sind `number`, nicht `bigint`
— bei MVP-Map-Größen (≤ 1M Tiles) bleibt alles weit unter `Number.MAX_SAFE_INTEGER`.

### `game.ts`, `intent.ts`

(folgen — Tick-Pipeline und Intent-Typen)
