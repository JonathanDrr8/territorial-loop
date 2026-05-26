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

(wird in Phase B definiert)
