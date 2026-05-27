# `src/world/` — Karte, Koordinaten, Topologie

## Zweck

Alles was mit der Spielwelt zu tun hat: Karten-Daten, Tile-Layout, Koordinaten-System
inklusive der **Torus-Topologie** (loopende Welt).

## Was gehört rein

- `TorusCoord` / Koordinaten-Helper für Wrap-Mathematik
- Map-Datenstruktur (Tile-Grid, Biome, Höhen, etc.)
- Map-Generator (Perlin/Simplex Noise, seamless tileable)
- Distanz-Funktionen (kürzeste Distanz auf Torus)
- Pathfinding-Algorithmen (A\* mit Torus-Heuristik)
- Nachbar-Lookups die den Wrap berücksichtigen

## Was gehört NICHT rein

- Rendering der Karte (das ist `src/render/`)
- Game-State der Spieler (das ist `src/core/`)
- Input-Verarbeitung (das ist `src/input/`)

## Konventionen

- **Jede Koordinaten-Operation wrappt automatisch** — niemals rohe `x + dx`-Arithmetik
- **Distanz-Berechnungen IMMER über Torus-Helper** — euklidische Distanz wäre falsch
- Map-Größe ist eine Konfiguration, nicht hart kodiert

## Öffentliche API

### `torus.ts`

```ts
type TileRef = number
function wrap(v: number, dim: number): number
function tileRef(x: number, y: number, w: number, h: number): TileRef
function tileXY(ref: TileRef, w: number): readonly [number, number]
function torusDistance(ax, ay, bx, by, w, h): number
function neighbors4(ref: TileRef, w: number, h: number): readonly TileRef[]
function neighbors8(ref: TileRef, w: number, h: number): readonly TileRef[]
```

### `map.ts`

```ts
const OWNER_MASK = 0x0fff // Bits 0-11
const MAX_OWNER_ID = 0x0fff // 4095

interface GameMap {
  readonly width: number
  readonly height: number
  readonly terrain: Uint8Array // 1 Byte pro Tile, im MVP unbenutzt
  readonly state: Uint16Array // Bits 0-11: ownerID, 12-15: reserviert
}

function createMap(width: number, height: number): GameMap
function getOwner(map: GameMap, ref: TileRef): number
function setOwner(map: GameMap, ref: TileRef, ownerId: number): void
```

**Hot-Loop-Hinweis:** Für Tick-Pipelines und Frontier-Iterationen sollte direkt
auf `map.state[ref]` zugegriffen werden (mit Bit-Maskierung), nicht über die
Helper — Function-Call-Overhead pro Tile summiert sich bei 100k+ Iterationen.
