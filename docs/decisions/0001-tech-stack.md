# ADR 0001: Tech-Stack-Auswahl

## Status

Accepted

## Datum

2026-05-26

## Kontext

Für ein Browser-basiertes Territorial-RTS mit potenziell tausenden gleichzeitig
gerenderten Tiles, Echtzeit-Animationen und (potenziell) Multiplayer-Determinismus
brauchen wir Entscheidungen über:

- Programmiersprache und Build-Tools
- Rendering-Bibliothek
- UI-Framework
- Test-Framework
- Code-Qualitäts-Tools

Wir sind ein Solo-Entwicklerteam (Jonathan als Game-Designer, Claude als
Implementer). Erfahrung mit Game-Engines ist nicht vorhanden. Wir wollen
schnell zu einem spielbaren Prototyp kommen und gleichzeitig solide Grundlagen
für Wachstum schaffen.

## Entscheidung

| Bereich              | Wahl                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Sprache              | **TypeScript 5.7** (strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Bundler / Dev-Server | **Vite 6**                                                                                 |
| Rendering            | **Pixi.js 8** (WebGL)                                                                      |
| UI                   | **Vanilla DOM** / Web Components (kein React/Vue/Lit)                                      |
| State / Game-Sim     | Plain TypeScript-Klassen (keine ECS-Lib zunächst)                                          |
| Determinismus        | `seedrandom` als PRNG                                                                      |
| Tests                | **Vitest 3** mit jsdom                                                                     |
| Linter               | **ESLint 9** Flat Config + `typescript-eslint` strict                                      |
| Formatter            | **Prettier 3**                                                                             |
| Pre-Commit           | Husky + lint-staged                                                                        |

## Begründung

### TypeScript strict

Game-Logik ist komplex und voller Off-by-One-Fehler, vor allem bei der Torus-Mathematik.
Strict-Mode plus `noUncheckedIndexedAccess` fängt diese Klasse von Bugs zur Compile-Zeit.

### Vite

Schneller Dev-Server, einfache Konfiguration, gute TypeScript-Integration, kein
komplexes Webpack-Setup. Industrie-Standard für moderne Frontend-Projekte.

### Pixi.js 8

- Marktführer für 2D-WebGL-Rendering in JavaScript
- Skaliert problemlos auf tausende Sprites (perfekt für Tile-basierte Spiele)
- Aktiv gepflegt, große Community, viele Lern-Ressourcen
- Wird auch von OpenFront genutzt — gute Referenz

**Alternative verworfen:** Phaser 3. Phaser ist eine vollständige Engine mit
Physik, Audio, Scene-Management etc. — Overhead für unseren Anwendungsfall.
Wir brauchen Rendering, mehr nicht. Den Rest bauen wir selbst.

### Vanilla DOM / Web Components statt Framework

Spiele-UI ist meist statisch (HUD-Werte, Menüs). Ein Framework wie React würde
Reactivity-Overhead einführen, der nichts beiträgt. Web Components sind nativ,
leichtgewichtig und genug für unsere Bedürfnisse.

**Alternative verworfen:** React, Vue, Svelte, Lit. Alle erhöhen Bundle-Size und
Komplexität, ohne dass die Pixi-Welt davon profitiert. Wir können später eines
einführen falls sich UI-Logik als sehr reaktiv erweist.

### Plain TypeScript-Klassen statt ECS

ECS (Entity-Component-System) ist mächtig bei riesigen Welten mit komplexen
Interaktionen (tausende Entitäten mit unterschiedlichen Verhalten). Wir starten
einfacher mit klassischer OOP-Struktur. Refactoring zu ECS ist möglich falls nötig.

### Vitest

- Native ESM-Support, kein Babel-Setup
- Vite-Integration → kein zweiter Build-Stack
- Schnell, gute DX
- API-kompatibel zu Jest

### ESLint Flat Config + typescript-eslint strict

- Flat Config ist die aktuelle ESLint-Standard-Form (ESLint 9+)
- `typescript-eslint`-strict fängt subtile TypeScript-Anti-Patterns
- Prettier-Integration via `eslint-config-prettier` (deaktiviert kollidierende Regeln)

### `seedrandom` für PRNG

- Determinismus ist Pflicht für reproduzierbare Spielsessions und potenziell Multiplayer
- `Math.random()` ist nicht seedbar in JavaScript
- `seedrandom` ist klein, gut getestet, Industrie-Standard

## Konsequenzen

- **Geringe Lock-in:** Vite, TypeScript, Pixi sind austauschbar wenn nötig
- **Lernkurve niedrig** für jemanden mit Web-Hintergrund
- **Bundle bleibt schlank** (kein React-Runtime, keine vollständige Game-Engine)
- **Wir müssen mehr selbst bauen** (UI-Reaktivität, Scene-Management, evtl. später ECS)
- **TypeScript-strict bremst initial leicht aus**, zahlt sich aber bei der ersten
  Pathfinding-Refactoring-Session zigfach aus

## Reviewdatum

Diese Entscheidung wird neu bewertet wenn:

- Performance-Probleme auftreten die einen Engine-Wechsel rechtfertigen würden
- UI-Komplexität ein Framework rechtfertigt
- Multiplayer-Architektur Anpassungen am Determinismus-Setup erfordert
