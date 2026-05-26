# `src/render/` — Pixi.js Rendering

## Zweck

Visualisierung des Game-States via Pixi.js (WebGL). Diese Schicht **liest** den
State aus `core/`, mutiert ihn aber nie.

## Was gehört rein

- Pixi.js Application-Setup
- Kamera mit Torus-Wrap (Tiles am Bildschirmrand "von der anderen Seite" rendern)
- Sprites/Textures für Tiles, Einheiten, Territorien
- Layer-Management (Hintergrund, Tiles, Einheiten, UI-Overlays)
- Animationen, Partikel-Effekte
- Performance-Optimierungen (Culling, Object-Pooling, Tile-Batching)

## Was gehört NICHT rein

- Game-Logik (das ist `src/core/`)
- Input (das ist `src/input/`)
- DOM-UI (das ist `src/ui/`)

## Konventionen

- **Render liest, ändert nicht** — keine Mutation von Core-State
- **Kamera kennt Torus** — Wrap wird durch doppeltes Rendering oder Position-Modulo gelöst
- Pixi-Objekte werden gepoolt, nicht ständig neu erzeugt (Performance)

## Öffentliche API

(wird in Phase B definiert)
