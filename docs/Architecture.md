# Architektur — territorial-loop

> **Status:** Stub. Wird in der **Architektur-Phase (Phase B)** finalisiert,
> nachdem das Konzept (Phase A) steht.

## Schicht-Modell (vorläufig)

```
┌──────────────────────────────────────────────────────────┐
│  UI (DOM)        │  Render (Pixi.js)                     │  ← Liest State
├──────────────────┴───────────────────────────────────────┤
│  Input  →  Intents                                       │  ← Erzeugt Intents
├──────────────────────────────────────────────────────────┤
│  AI     →  Intents                                       │
├──────────────────────────────────────────────────────────┤
│  Core (Game-Simulation, deterministisch)                 │  ← Konsumiert Intents,
│  └─ World (Karte, Torus-Koordinaten, Pathfinding)        │     mutiert State
└──────────────────────────────────────────────────────────┘
```

## Datenfluss (vorläufig)

```
Input/AI ──Intent──> Core.tick(intents) ──> State (neu)
                                              │
                                              v
                                        Render liest State,
                                        UI liest State
```

## Noch zu klären (in Phase B)

- Wie ist das Tick-Modell? (Fixed Timestep? Variable?)
- Wie sind Intents strukturiert? (Zod-Schemas? Discriminated Unions?)
- Wie ist State organisiert? (ECS? Klassische Klassen-Hierarchie? Immutable?)
- Multiplayer-Architektur (falls geplant): Server-authoritative, Lockstep, Rollback?
- Map-Datenstruktur: Pixel-Grid? Hex-Grid? Tile-Atlas?
- Persistenz/Save-Game: LocalStorage? IndexedDB?
- Performance-Strategie für Pathfinding/Rendering bei großen Karten

## Modul-Verantwortungen (siehe `src/<modul>/README.md`)

| Modul     | Verantwortung                         | Abhängigkeiten                                               |
| --------- | ------------------------------------- | ------------------------------------------------------------ |
| `core/`   | Game-Simulation, Tick-Loop, Regeln    | nur `world/`                                                 |
| `world/`  | Map, Tiles, Torus-Koords, Pathfinding | keine                                                        |
| `render/` | Pixi.js Rendering                     | `core/`, `world/` (read-only)                                |
| `input/`  | Eingabe → Intents                     | `core/` (für Intent-Submission), `world/` (für Screen→World) |
| `ai/`     | KI-Gegner, generiert Intents          | `core/` (read-only), `world/`                                |
| `ui/`     | HUD, Menüs, DOM                       | `core/` (read-only)                                          |

## Architecture Decision Records

Wichtige Entscheidungen werden in [`docs/decisions/`](./decisions/) als ADRs
dokumentiert. Format: ein Markdown-File pro Entscheidung, nummeriert.
