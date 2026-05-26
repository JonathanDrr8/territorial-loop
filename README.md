# territorial-loop

Browser-basiertes Territorial-RTS mit **loopender Spielwelt** (Torus-Topologie).
Die Karte hat keine Ränder — wer rechts rausläuft kommt links wieder rein, oben
und unten ebenso. Inspiriert von OpenFront.io, aber eigenständig entwickelt.

## Status

🚧 **Frühe Entwicklung** — Setup abgeschlossen, Konzept und Architektur in Arbeit.

## Tech-Stack

TypeScript · Vite · Pixi.js · Vitest

## Entwicklung

```bash
npm install
npm run dev
```

Öffnet auf `http://localhost:5173`.

## Skripte

| Skript              | Funktion                         |
| ------------------- | -------------------------------- |
| `npm run dev`       | Vite Dev-Server mit Hot-Reload   |
| `npm run build`     | Production-Build                 |
| `npm run preview`   | Production-Build lokal anschauen |
| `npm run typecheck` | TypeScript-Check                 |
| `npm test`          | Vitest im Watch-Mode             |
| `npm run test:run`  | Tests einmal ausführen           |
| `npm run lint`      | ESLint                           |
| `npm run format`    | Prettier                         |

## Projekt-Struktur

```
src/
├── core/    Game-Simulation (deterministisch)
├── world/   Karte + Torus-Koordinaten
├── render/  Pixi.js Rendering
├── input/   Maus/Tastatur/Touch
├── ai/      KI-Gegner
└── ui/      HUD und Menüs
```

Details siehe `docs/Architecture.md`.

## Doku

- [`CLAUDE.md`](./CLAUDE.md) — Briefing für Claude Code Sessions
- [`docs/Concept.md`](./docs/Concept.md) — Spielkonzept und Mechaniken
- [`docs/Architecture.md`](./docs/Architecture.md) — Architektur-Übersicht
- [`docs/decisions/`](./docs/decisions/) — Architecture Decision Records (ADRs)

## Lizenz

MIT (siehe LICENSE)
