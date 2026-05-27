# territorial-loop

Browser-basiertes Territorial-RTS mit **loopender Spielwelt** (Torus-Topologie).
Die Karte hat keine Ränder — wer rechts rausläuft kommt links wieder rein, oben
und unten ebenso. Inspiriert von OpenFront.io, aber eigenständig entwickelt.

## Status

🎮 **MVP spielbar** — Start-Menü, Echtzeit-Sim mit Wave-Eroberung, 1-7 KI-Gegner
mit drei Schwierigkeitsgraden, Land/Wasser-Karten, Belagerungs-Modus, Minimap,
Sound, Game-Over-Statistik. Determinismus über Match-Seed reproduzierbar.

## Tech-Stack

TypeScript · Vite · Canvas 2D · Vitest · seedrandom

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
├── core/    Game-Simulation (deterministisch) — game, random, config, intent
├── world/   Karte + Torus-Koordinaten + Terrain-Generation
├── render/  Canvas-2D-Renderer mit Torus-Wrap
├── input/   Maus/Tastatur/Touch
├── ai/      KI-Gegner mit drei Difficulty-Profilen
└── ui/      Start-Menü, HUD, Minimap, Hover-Tooltip, Sound, Preferences
```

Details siehe `docs/Architecture.md` und das jeweilige `README.md` pro Modul.

## Spielablauf

1. Start-Menü öffnet sich (Name, Kartengröße, Anzahl KI, Eroberungs-Tempo,
   Schwierigkeit, Sieg-%, Karten-Typ, Sound, optional fester Seed)
2. Match startet — du expandierst per Linksklick auf gewünschte Tiles. Die
   Welle fließt zum Klick-Punkt hin.
3. Rechte Maustaste pant die Kamera (wrap-aware), Mausrad zoomt, `Leertaste`
   pausiert, `1/2/5` setzt die Sim-Geschwindigkeit, `Esc` ruft das Menü auf.
4. Sieg bei Erreichen des Sieg-%-Schwellwerts. Match läuft weiter — du kannst
   zuschauen oder im Banner "Neues Match" klicken.

## Doku

- [`CLAUDE.md`](./CLAUDE.md) — Briefing für Claude Code Sessions
- [`docs/Concept.md`](./docs/Concept.md) — Spielkonzept und Mechaniken
- [`docs/Architecture.md`](./docs/Architecture.md) — Architektur-Übersicht
- [`docs/decisions/`](./docs/decisions/) — Architecture Decision Records (ADRs)

## Lizenz

MIT (siehe LICENSE)
