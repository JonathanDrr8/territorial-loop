# Architektur — territorial-loop

> **Status:** Phase B (Architektur). MVP-Scope siehe `docs/Concept.md`.
> Konkrete OpenFront-Mechaniken-Referenz: Memory-File `openfront-mechanics-notes`.

## Leitprinzipien

1. **Determinismus überall.** Selbe Inputs (Intents + Seed) → selber Ausgang. Replays + Multiplayer fallen damit später quasi gratis aus.
2. **Klare Schicht-Trennung.** Core kennt kein Pixi/DOM. Render mutiert keinen Core-State. Input/AI/UI sprechen nur via Intents.
3. **Torus-First.** Keine rohe `x+dx`-Arithmetik in der Codebase. Alle Wrap-Operationen über `world/`-Helper.
4. **Performance an den richtigen Stellen.** Flat TypedArrays für die Map, Frontier-Listen statt Full-Scans, GPU-Textur statt Per-Pixel-Sprite-Rendering.

## Schicht-Modell

```
┌──────────────────────────────────────────────────────────┐
│  UI (DOM/Web Components)  │  Render (Pixi.js)            │  ← liest State
├───────────────────────────┴──────────────────────────────┤
│  Input  →  Intents                                       │
├──────────────────────────────────────────────────────────┤
│  AI     →  Intents                                       │
├──────────────────────────────────────────────────────────┤
│  Core  ── tick(intents) ──→ State                        │
│  └─ World (Map, Torus-Koords, Pathfinding)               │
└──────────────────────────────────────────────────────────┘
```

## Tick-Modell — entkoppelt

Zwei Loops, unabhängig getaktet:

| Loop     | Frequenz | Quelle                  | Aufgabe                                                                         |
| -------- | -------- | ----------------------- | ------------------------------------------------------------------------------- |
| Sim-Tick | 10 Hz    | `setInterval(_, 100)`   | `core.tick(intents)` — Bevölkerung wachsen, Kampf-Resolution, Sieg-Check        |
| Render   | 60 fps   | `requestAnimationFrame` | Liest Game-State + State-Textur, zeichnet Welt, interpoliert visuell wenn nötig |

**Begründung 10 Hz Sim:** OpenFront nutzt die gleiche Rate, alle Kampf-Formeln sind dafür kalibriert. Render-Interpolation für visuelle Flüssigkeit ist im MVP nicht nötig (Pixel-Färbungen sind eh diskret).

**Speed-Regler (1x/2x/5x):** modifiziert nur das Sim-Intervall (100ms / 50ms / 20ms). Pause stoppt den Sim-Loop, Render läuft weiter.

**Determinismus:** Sim-Code nutzt **niemals** `Date.now()` oder `performance.now()`. Zeit kommt aus dem `tick: number` Counter im Game-State.

## Daten-Modell

### Map — Dual-Array (nach OpenFront-Vorbild)

```ts
interface GameMap {
  width: number // konfigurierbar, MVP-Default 512
  height: number // konfigurierbar, MVP-Default 512
  terrain: Uint8Array // unveränderlich; im MVP: alle Tiles = Land
  state: Uint16Array // veränderlich, pro Tick mutiert
}
```

- **Länge** beider Arrays: `width * height`
- **`TileRef = number`** (Type-Alias für Clarity) = `y * width + x` — flacher Integer-Index
- **`state[i]` Bit-Layout:**
  - Bits 0-11 (`0xFFF`): `ownerID` — 0 = neutral, 1..4095 = Spieler
  - Bits 12-15: reserviert (z.B. später Border-Flag, Capture-Progress für Belagerungs-Modus)
- **`terrain[i]` Bit-Layout:** im MVP irrelevant (alle Tiles Land); Struktur trotzdem reserviert für Post-MVP-Terrain.

**Begründung Dual-Array:** Cache-friendly, RAM-effizient (~1.5 MB für 512×512), und der `state`-Buffer ist direkt als WebGL-Textur nutzbar. Übernahme von OpenFronts Layout — funktioniert dort skaliert auf ~4M Tiles.

### Torus-Topologie

Alle Koordinaten-Math läuft über `world/torus.ts`:

```ts
// Wrap einzelner Koordinate
wrap(x: number, dim: number): number

// Tile-Index mit Wrap
tileRef(x: number, y: number, w: number, h: number): TileRef

// Kürzeste Torus-Distanz zwischen zwei Punkten
torusDistance(ax, ay, bx, by, w, h): number
//   dx = min(|ax-bx|, w-|ax-bx|),  dy = analog
//   return sqrt(dx*dx + dy*dy)

// Nachbarn (4 oder 8) mit Wrap
neighbors4(ref: TileRef, w: number, h: number): TileRef[]
neighbors8(ref: TileRef, w: number, h: number): TileRef[]
```

**Verbot:** Direkte `state[y * width + x]`-Zugriffe ohne vorherigen `wrap()`. Lint-Regel oder Code-Review fängt das.

### Player-State

```ts
interface Player {
  id: number // 1..4095, 0 reserviert für "neutral"
  name: string
  color: number // RGBA-Wert, zufällig generiert beim Match-Start
  troops: number // bei MVP-Map-Größen weit unter Number.MAX_SAFE_INTEGER, daher kein bigint
  tilesOwned: number // Cache für O(1) %-Berechnung & maxTroops-Formel
  frontier: Set<TileRef> // Tiles dieses Spielers die an Gegner/Neutral grenzen
  attacks: Attack[] // aktive Angriffe (Reserve-Truppen + Ziel)
  isHuman: boolean
  isAlive: boolean // false → Spectator-Modus, wird nicht mehr getickt
}

interface Attack {
  targetPlayerId: number // 0 = TerraNullius
  reserveTroops: number // aktuelle Restmenge in dieser Angriffs-Welle
  // erweiterbar (Pfad-Hinweise, Modifier)
}
```

**`frontier`-Set:** essentiell für Performance. Statt pro Tick alle Tiles des Spielers zu scannen, iterieren wir nur über `frontier` — die Tiles wo etwas passieren kann (Expansion, Verteidigung). Wird inkrementell gepflegt: wenn Tile erobert → eigene Tiles um neuen Pixel auf Frontier prüfen, Gegner-Tiles um alten Frontier-Pixel updaten.

### Game-State

```ts
interface GameState {
  tick: number // monoton steigend
  map: GameMap
  players: Map<number, Player>
  rng: PRNG // seedrandom-Wrapper, eine Instanz pro Sim
  seed: string // Original-Seed, für Replay
  config: GameConfig // Karten-Größe, Sieg-%, etc.
  phase: 'spawn' | 'running' | 'ended'
  winner: number | null // playerId, gesetzt sobald jemand Sieg-% erreicht
}
```

## Intent-System

Alle Mutations gehen via Intent. Format: Discriminated Union (TypeScript-Native, kein Zod im MVP — `core/intent.ts` exportiert die Types).

```ts
type Intent =
  | { type: 'attack'; playerId: number; targetTile: TileRef; troops: number }
  | { type: 'cancel-attack'; playerId: number; attackIdx: number }
// Erweiterbar — z.B. später 'build-city', 'send-boat', ...
```

**Slider-Konvention:** UI rechnet Slider-% → absolute Truppen-Zahl clientseitig (`troops = floor(player.troops * sliderPct / 100)`). Intent enthält absolute Zahl. Sim deckelt auf `min(intent.troops, player.troops)`.

**Intent-Queue:** Pro Sim-Tick werden alle Intents (Spieler + KI) gesammelt → `core.tick(intents[])` verarbeitet sie deterministisch in einer festen Reihenfolge (z.B. nach `playerId` aufsteigend).

## Core: Tick-Pipeline

```
core.tick(intents):
  1. intents-apply       → für jedes Intent: Validierung + State-Mutation
                           (z.B. 'attack' erzeugt neuen Attack im Player + Frontier-Update)
  2. growth              → für jeden Player: troops += troopIncreaseRate()
                           (Formel aus openfront-mechanics-notes)
  3. attacks-resolve     → für jeden aktiven Attack:
                           a) bestimme Tiles-Pro-Tick via Frontier-Set
                           b) wähle deterministisch (rng.shuffleArray) eroberbare Tiles
                           c) für jedes Tile: Verlust-Berechnung,
                              Tile-Owner-Wechsel, Frontier-Update für beide Player,
                              tilesOwned-Cache aktualisieren
                           d) wenn reserveTroops <= 0: Attack entfernen
  4. eliminate-check     → für jeden Player: wenn tilesOwned == 0 → isAlive = false
  5. victory-check       → wenn ein Player tilesOwned/totalTiles >= victoryThreshold:
                           phase = 'ended', winner = player.id (Match läuft weiter!)
  6. tick += 1
```

Game-Over-Logik ist explizit nicht-blockierend: Bei Sieg wird `winner` gesetzt + Banner gezeigt, aber Sim läuft weiter (Jonathans Wunsch — KI weiter beobachten können).

## World: Pathfinding & Frontier

**MVP-Variante:** Kein A\* nötig. Eroberung läuft ausschließlich über die Frontier-Set-Expansion (welche Tiles eines Spielers haben Nachbarn die nicht ihm gehören). Tiles werden über die Frontier deterministisch ausgewählt — kein klassisches Pathfinding.

**Post-MVP:** Wenn Boats/Cities dazukommen, brauchen wir A\* mit Torus-Heuristik (manhattanTorus statt manhattan).

## Render: Pixi.js + State-Textur

**Strategie:**

- **Eine WebGL-Textur** pro Map, Format `R16UI` (16-bit unsigned int pro Pixel). Quelle: direkter Upload des `state: Uint16Array`. Update pro Render-Frame (oder nur wenn dirty-Flag gesetzt).
- **Ein Fullscreen-Sprite** zeichnet die Textur via Custom-Shader.
- **Shader:** liest pro Pixel den `ownerID` aus der Textur, schlägt in einer kleinen Player-Color-LUT (Uniform Array) nach, gibt die Farbe aus. Neutral (0) = dunkelgrau.
- **Torus-Wrap im Shader:** `texture(stateTexture, fract(uv))` — die UV-Koordinaten werden via `fract()` gewrappt. `TEXTURE_WRAP_S/T = REPEAT` als Fallback.

**Kamera-Wrap:**

- Kamera = Offset+Zoom-Transform auf dem Fullscreen-Quad
- Quad ist **größer als der Viewport** und bewegt sich nicht — stattdessen werden die UV-Koordinaten verschoben, der Wrap im Shader handhabt den Rest
- Ergebnis: an jeder Stelle der Karte fühlt sich der Spieler "in der Mitte" — kein sichtbares "Ende"

**Pro Frame (60 fps):**

1. Hat Sim seit letztem Render `dirtyTiles` geupdatet? → Re-upload betroffener Region (oder ganzer Textur — im MVP simpler).
2. Update Camera-Uniforms (offset/zoom)
3. Draw Fullscreen-Quad

**Performance:** Wir rendern eine einzelne Textur statt 260k Sprites — selbst bei 1024×1024 trivial.

## UI: Vanilla DOM

- **Start-Menü:** simples `<div>` mit Form-Elementen (Karten-Größe-Slider, KI-Anzahl-Input, Sieg-%-Slider) und Start-Button.
- **HUD:** absolut positioniertes `<div>` über dem Canvas. Sub-Elemente: Bevölkerungs-Anzeige, Truppen-Slider (`<input type="range">`), Player-Stat-Leiste, Speed/Pause-Buttons.
- **Minimap:** kleines `<canvas>` (separat von Pixi), zeichnet alle 10 Ticks die State-Textur skaliert. Torus-Wrap-Indikator: Kachel-Pattern oder dezenter Rahmen.
- **Game-Over-Banner:** `<div>` mit "Sieger: X — Match-Status: weiterschauen | beenden" — kein Modal das den View blockiert.

DOM-Updates passieren via einfacher Pull-Pattern: `ui.update(gameState)` pro Render-Frame (oder seltener). Kein Framework, kein Reactivity-System — bei wenigen DOM-Elementen reicht Diff-by-Hand.

## Input

- **Linksklick auf Map-Tile** → `attack`-Intent mit aktuellem Slider-Wert
- **Rechtsklick + Drag** → Kamera-Pan
- **Mausrad** → Zoom (Range z.B. 0.5× bis 8×)
- **Leertaste** → Pause-Toggle
- **1/2/5-Tasten** → Speed-Wechsel

Screen→World-Konvertierung: `worldX = wrap(cameraX + (screenX - viewportW/2) / zoom, mapWidth)` — Wrap ist Pflicht.

## AI

**MVP-Strategie ("Allround"):**

- Alle 50-200 Ticks (deterministisch via PRNG-Jitter) wählt KI ein Ziel:
  - Wenn Bevölkerung > 60% Cap: Angriff auf nächsten erreichbaren Gegner-Tile
  - Sonst: Expansion in nahegelegenes TerraNullius
- Slider-Anteil: festes 20% (wie OpenFront-Default für Menschen, höher als Bot-Default 5% damit Match interessant ist)
- **Zielwahl deterministisch:** PRNG-gesteuert für Variation, aber pro Match reproduzierbar

KI emittiert Intents über exakt die gleiche API wie Spieler. Kein State-Manipulieren.

## Determinismus-Regeln (Recap)

| Was                    | Wie                                                                          |
| ---------------------- | ---------------------------------------------------------------------------- |
| Zufall in Sim          | `gameState.rng` (eine `seedrandom`-Instanz, geseeded aus Config)             |
| Zufall in KI           | Sub-PRNGs pro KI, geseeded aus `seed + playerId`                             |
| Zeit                   | `gameState.tick`, niemals `Date.now()`                                       |
| Iterations-Reihenfolge | Spieler sortiert nach `id`, Tiles sortiert nach `TileRef`                    |
| Float-Arithmetik       | Truppen-Werte werden nach Formel-Anwendung gefloored, im State immer Integer |

## Offene Architektur-Fragen (für später, nicht MVP-blockend)

- **Truppen-Typ:** Entschieden für `number`, nicht `bigint`. Bei MVP-Map-Größen (≤ 1M Tiles) bleibt max-Cap unter ~8M, weit unter `Number.MAX_SAFE_INTEGER`. Falls extrem große Maps (>100M Tiles) nötig werden: punktuell zu bigint wechseln.
- **Multiplayer:** Server-authoritative? Lockstep? Rollback? — Entscheidung aufgeschoben bis MVP läuft.
- **Persistenz:** LocalStorage für Settings ist ok. Replays via Seed+Intent-Log — kommt mit Multiplayer.
- **Map-Generator:** Im MVP ist die Karte leer (alle Tiles Land). Für Post-MVP mit Wasser/Bergen: seamless tileable Perlin/Simplex Noise (Trick: 4D-Noise auf 2D-Kreis projiziert, garantiert wrap-safe).

## Modul-API-Skizzen

Public API jedes Moduls. Alles andere ist intern.

### `world/`

```ts
type TileRef = number
export const wrap: (v: number, dim: number) => number
export const tileRef: (x: number, y: number, w: number, h: number) => TileRef
export const tileXY: (ref: TileRef, w: number) => readonly [number, number]
export const torusDistance: (ax, ay, bx, by, w, h) => number
export const neighbors4: (ref: TileRef, w: number, h: number) => readonly TileRef[]
export const neighbors8: (ref: TileRef, w: number, h: number) => readonly TileRef[]
export const createMap: (w: number, h: number) => GameMap
```

### `core/`

```ts
export const createGame: (config: GameConfig) => GameState
export const tick: (state: GameState, intents: readonly Intent[]) => GameState // mutiert in-place, return = same ref
export const maxTroops: (numTilesOwned: number, opts?: { bot?: boolean }) => number
export const troopIncreaseRate: (troops: number, max: number, opts?: { bot?: boolean }) => number
// Re-Exports: Intent, GameState, Player, GameConfig
```

### `render/`

```ts
export const createRenderer: (canvas: HTMLCanvasElement, state: GameState) => Renderer
interface Renderer {
  render(state: GameState): void
  setCamera(x: number, y: number, zoom: number): void
  destroy(): void
}
```

### `input/`

```ts
export const createInputHandler: (
  canvas: HTMLCanvasElement,
  sink: (i: Intent) => void,
) => InputHandler
interface InputHandler {
  destroy(): void
}
```

### `ai/`

```ts
export const createAI: (playerId: number, seed: string) => AI
interface AI {
  decide(state: GameState): readonly Intent[] // pro Tick aufgerufen
}
```

### `ui/`

```ts
export const createUI: (root: HTMLElement, sink: (i: Intent | UIEvent) => void) => UI
interface UI {
  update(state: GameState): void
  destroy(): void
}
type UIEvent =
  | { type: 'set-speed'; multiplier: 0 | 1 | 2 | 5 } // 0 = Pause
  | { type: 'set-slider'; pct: number }
```

## ADRs

- [ADR-0001](decisions/0001-tech-stack.md) — Tech-Stack
- [ADR-0002](decisions/0002-map-datenstruktur.md) — Map als Dual-TypedArray
- [ADR-0003](decisions/0003-tick-modell.md) — Fixed 10 Hz Sim, entkoppelter Render
- [ADR-0004](decisions/0004-openfront-mechaniken.md) — OpenFront-Formeln 1:1 als MVP-Baseline
