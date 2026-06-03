# ADR 0030: Simulation (und Rendern) auf einem eigenen Thread — Plan

## Status

Accepted (von Jonathan freigegeben 2026-06-03; nach ADR-0029). Größerer Architektur-
Umbau → **vor der Umsetzung von Jonathan abzusegnen**. Sinnvoll **erst, falls ADR-0029 (Algorithmus)
das Spätspiel nicht ausreichend glättet** — zuerst messen.

## Datum

2026-06-03

## Kontext — das strukturelle Problem

Heute laufen **Simulation und Rendern auf demselben (Haupt-)Thread**: `renderLoop` in `main.ts` ruft
pro Frame `renderer.render()` + `hud.update()`, und ein Timer treibt `tick(state, …)`. Dauert ein Tick
mal 250 ms (großes Spätspiel, ADR-0029), **blockiert das den gesamten Browser-Tab** → das Bild friert
ein. Das ist die strukturelle Ursache hinter „flüssig zwischen kompletten Standbildern": **ein einziger
teurer Tick = ein sichtbares Standbild.**

ADR-0029 senkt die **Kosten** der teuren Ticks (algorithmisch). Dieser ADR beseitigt die **Kopplung**:
läuft die Sim auf einem eigenen Thread, kann ein teurer Tick die Oberfläche gar nicht mehr einfrieren —
sie zeigt höchstens kurz einen minimal älteren Stand. Das ist die „**strukturell nie wieder
einfrieren**"-Garantie, unabhängig davon, wie teuer ein Tick im Extremfall wird.

## Was den Umbau schwer macht (ehrlich)

Der Determinismus-Kern (`core/`, `world/`, `ai/`, `net/`) ist bewusst **browser-frei** (ADR-Schichten-
Trennung) → die Sim **kann** problemlos in einem Worker laufen. Der Haken ist die **UI-Kopplung**:
Renderer, HUD und Input lesen heute alle **direkt** dasselbe `state`-Objekt (gemessen: der Renderer
greift auf `state.map`, `state.players`, `state.buildings`, alle Schiffs-Arrays, `state.alliances`,
`state.grudge`, … zu; das HUD auf Rangliste/Gold/Wirtschaft; Hover-Tooltips auf fast den ganzen State).
Über eine Thread-Grenze geht das nicht mehr „einfach so" — der Hauptthread hat das `state`-Objekt nicht.

`map.state` (Uint16Array) und `map.terrain` (Uint8Array) sind ideal teilbar (`SharedArrayBuffer`,
Null-Kopie). Aber `players` (Map mit `frontier`-Sets — teils groß), `buildings` (Map), Schiffs-Arrays,
Beziehungs-Maps sind Objekte/Maps und müssen **kopiert/serialisiert** über die Grenze.

## Plan — bevorzugter Ansatz: OffscreenCanvas + Worker (Sim **und** Render im Worker)

Statt nur die Sim auszulagern und den State teuer zum Render-Thread zu spiegeln, wandert **auch der
Renderer** in den Worker — über **`OffscreenCanvas`** (das Canvas wird per `transferControlToOffscreen()`
an den Worker übergeben). Dann lebt das ganze `state`-Objekt im Worker, und Sim + Render fassen es direkt
an — kein Spiegeln nötig.

Aufteilung:

- **Worker:** `tick()`-Schleife (über die bestehende `IntentTransport`-Naht), KI (`ai.decide`), Renderer
  (`renderer.render()` auf dem OffscreenCanvas). Hält den `state`.
- **Hauptthread:** DOM/HUD, Eingabe, Menüs, Audio. Schickt **Intents** (Klicks → `BoatIntent`/`AttackIntent`/…)
  per `postMessage` an den Worker; empfängt vom Worker ein **kompaktes „View-Model"** pro Frame/Intervall
  (Ranglisten-Zahlen, eigenes Gold/Truppen/Rate, Hover-Tooltip-Inhalt, Ereignislog-Einträge) — alles klein
  (KB-Bereich), kein Voll-State.

Vorteile: kein `SharedArrayBuffer`/keine COOP-COEP-Header nötig (OffscreenCanvas reicht), Renderer-Code
fast unverändert (nur Kontext-Quelle), Determinismus **unberührt** (gleicher Core, gleicher PRNG — der
Thread ändert nur, **wo** gerechnet wird).

### Die eigentliche Arbeit (Hauptthread-Entkopplung)

1. **Intent-Kanal:** Input erzeugt heute Intents und gibt sie an `transport.submit()`. Künftig:
   Input → `postMessage({type:'intent', …})` → Worker `transport.submit()`. Geringe Latenz (nächster Tick).
2. **Hover/Picking:** Maus-Koordinaten liegen im Hauptthread, die Kamera + der State im Worker. Lösung:
   Kamera-Zustand (x/y/zoom) im Hauptthread spiegeln (klein, ändert sich nur bei Pan/Zoom) → Welt-Koordinate
   lokal berechnen → an Worker fragen „was ist an Tile X?" bzw. der Worker liefert pro Frame die Hover-
   Auflösung fürs aktuelle Maus-Tile. Round-Trip ist 1 Frame — für Tooltips unkritisch.
3. **HUD-View-Model:** der Worker stellt pro Intervall ein schlankes Objekt zusammen (Top-N-Rangliste,
   eigene Kennzahlen, offene Bündnisangebote, Economy-Aufschlüsselung) und postet es. Das HUD rendert daraus
   — statt `state` direkt zu lesen. Das ist der größte Refactor-Posten (viele HUD-Stellen).
4. **Lebenszyklus:** Match-Start/Ende, Pause, Snapshot/Resync (ADR-0009), Replay — alles über Worker-
   Nachrichten. Der `server/`-Pfad (echtes Mehrspieler) bleibt; der Worker ist nur der lokale Sim-Host.

## Alternativen

- **A: Nur Sim im Worker, Render bleibt Hauptthread, Tile-Arrays via `SharedArrayBuffer`.** Der Renderer
  liest `map.state`/`terrain` Null-Kopie aus dem SAB. **Problem:** Renderer/HUD lesen viel **mehr** als die
  Tile-Arrays (players/frontier/buildings/…) — die müssten trotzdem gespiegelt werden, und seit dem Tint-Fix
  (0.52.2) liest sogar `paintBitmap` `player.frontier`. Plus COOP/COEP-Header-Pflicht. Mehr Reibung als der
  OffscreenCanvas-Weg → nachrangig.
- **B (risikoärmster Zwischenschritt): Sim auf dem Hauptthread, aber teure Ticks zeitlich zerschneiden.**
  Statt einen 250-ms-Tick am Stück zu rechnen, ihn kooperativ über mehrere Frames verteilen (wie die
  bereits umgesetzte Economy-Flut-Amortisierung, nur für `resolveAttacks`/Capture). Kein Thread, keine
  Header, kein UI-Refactor — aber heikler im Determinismus (ein Tick muss als Einheit committen, bevor der
  nächste Intent-Turn kommt → Zerschneiden nur **innerhalb** eines Ticks, nicht über Turn-Grenzen). Holt
  weniger als der Worker, aber schnell und risikoarm. **Empfohlen, falls ADR-0029 fast reicht und nur die
  Rest-Spitzen stören.**
- **C: WebGL-Renderer (ADR-0005 revidieren).** Der Render ist nach dem Färb-Fix nicht der Flaschenhals →
  derzeit nicht nötig. Zurückgestellt.

## Risiken

- **Großer UI-Refactor** (HUD/Input/Hover an Nachrichten statt direktem `state`-Zugriff). Zeit-/Bug-Risiko;
  betrifft viel `ui/`-Code. Schrittweise machbar (erst Renderer, dann HUD-Felder einzeln).
- **OffscreenCanvas-Support:** modern breit verfügbar (Chrome/Edge/Firefox/Safari aktuell). Fallback nötig
  für sehr alte Browser? → Feature-Detection, sonst klassisch auf dem Hauptthread (kein Worker).
- **Input-Latenz:** +1 Frame (Round-Trip). Bei einem Strategiespiel mit Tick-Intervall 100 ms vernachlässigbar.
- **Mehrspieler:** der Worker hostet die lokale Sim; der `NetworkTransport` (Server-Commits) müsste im
  Worker laufen oder Commits durchgereicht werden. Sauber lösbar, aber mitzudenken.

## Verifikation (PFLICHT vor Merge)

| #   | Was                               | Test/Methode                                                                     | Erwartung                                                                      |
| --- | --------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Determinismus unberührt           | `npm run test:run` (inkl. serialize/Lockstep-E2E)                                | alle grün, Hashes identisch                                                    |
| 2   | Keine UI-Blockade bei teurem Tick | In-Browser Chaos 2048², Spätspiel, Frame-Gaps messen (rAF-Delta)                 | **konstant ~60 fps, keine Gaps > ~30 ms**, auch wenn ein Sim-Tick lange dauert |
| 3   | Eingabe reagiert                  | Klick-Angriff/Boot/Bauen in-game                                                 | Aktion erscheint binnen 1–2 Frames                                             |
| 4   | Mehrspieler-Lockstep              | zwei Tabs, Raum-Code, Match                                                      | identischer Verlauf, kein Desync                                               |
| 5   | Funktionsgleichheit               | Smoke über alle UI-Panels (Rangliste, Radialmenü, Diplomatie, Economy, Tooltips) | alles funktioniert wie vorher                                                  |

## Empfehlung & Reihenfolge

1. **Zuerst ADR-0029** (Algorithmus) umsetzen + per `npm run perf` und in-browser messen.
2. **Dann entscheiden:** Reichen die Ticks unter ~100 ms und stören nur seltene Spitzen → **Alternative B**
   (Tick-Zeitscheiben, risikoarm). Will man die **harte „nie einfrieren"-Garantie** für beliebige
   Extrem-Szenarien → der **OffscreenCanvas+Worker-Umbau** (dieser ADR, Hauptweg) — als eigener Feature-
   Branch, schrittweise, mit der Verifikations-Tabelle als Gate.
3. **Backend bleibt unangetastet** — die Sim-Last verschwindet nicht durchs Verlagern auf einen Server
   (gleiche Rechenarbeit + 16-MB-Zustand pro Tick zu streamen wäre teurer); der `server/`-Pfad ist und
   bleibt für die Mehrspieler-Koordination da, nicht zum Auslagern der Einzelspieler-Rechenlast.

## Detaillierter Stufenplan (datei-genau, von Jonathan abzusegnen)

Vorab kartiert (Explore, 2026-06-03): `core/`/`world/`/`ai/`/`net/` sind worker-rein. Reibungspunkte:
der **Renderer** (`src/render/renderer.ts`) liest direkt `document`/`window`/`devicePixelRatio`/
`container.clientWidth/Height` (~40 Stellen) + treibt `requestAnimationFrame`; **Input** (`src/input/`)
macht **synchrone** State-Abfragen (`canBuildAt`/`snapBuildTile`/`canReachByLand`, Hover-Picking); die
**Kamera** lebt im Renderer-Objekt und wird vom Input mutiert; **HUD/Tooltips** (`src/ui/`) lesen jeden
Frame direkt aus `state`. Bestehend: **keine** Worker/OffscreenCanvas/SAB-Nutzung; `vite.config.ts` ohne
Worker-Config.

**Architektur-Entscheidung:** Sim **und** Renderer (inkl. Minimap + Tooltip-INHALT) laufen im Worker;
der Hauptthread macht nur DOM/HUD/Input/Audio/Kamera. **Kein SharedArrayBuffer** — der teure Owner-Array
wird nie über die Grenze kopiert, weil das Zeichnen im Worker bleibt (OffscreenCanvas). Picking/Tooltip/
Bau-Checks lösen wir per **Round-Trip** (1 Frame Latenz, für ein 10-Hz-Strategiespiel unkritisch). Das HUD
bekommt pro Tick ein **kompaktes View-Model** (KB-Bereich). Keine COOP/COEP-Header nötig.

**Leitprinzip:** Nach JEDER Stufe ist das Spiel voll lauffähig (kein Big-Bang). Stufen 1–3 entkoppeln
_auf dem Hauptthread_ (verifizierbar, kein Worker) — der eigentliche Thread-Sprung ist Stufe 4 hinter
einem Feature-Flag.

### Stufe 0 — Infrastruktur, kein Verhaltenswechsel

- **Neu** `src/worker/protocol.ts`: alle Nachrichten-Typen als discriminated unions. Main→Worker:
  `init(config, offscreenCanvas)`, `intent(Intent)`, `camera(x,y,zoom)`, `viewport(w,h,dpr)`,
  `hover(tile|null)`, `buildQuery(id, tile, type, level)`, `control(pause|speed|leave|snapshot)`.
  Worker→Main: `ready`, `viewModel(snapshot)`, `hoverResult(tooltipData)`, `buildQueryResult(id, …)`,
  `event/log`, `desyncSnapshot`.
- **Ändern** `vite.config.ts`: `worker: { format: 'es' }`.
- **Verify:** `npm run build` + `npm run typecheck` grün; Spiel unverändert (Worker noch nicht verdrahtet).

### Stufe 1 — Renderer von DOM/Fenster entkoppeln (läuft NOCH auf Main)

- **Ändern** `src/render/renderer.ts`: Konstruktor nimmt ein `canvas: HTMLCanvasElement | OffscreenCanvas`
  - ein `viewport: { width, height, dpr }` (per `setViewport()` von außen gesetzt) statt `container`/
    `window.devicePixelRatio` abzufragen. Alle `container.clientWidth/Height` → `this.viewport.*`. Resize:
    Main hängt einen `ResizeObserver` an den Container und ruft `renderer.setViewport(...)`. Sprite-/
    Offscreen-Canvases: `document.createElement('canvas')` → `new OffscreenCanvas(w,h)` (im Worker und Main
    gültig). `requestAnimationFrame` **raus** aus dem Renderer — `main.ts` treibt `render()` weiter im
    `renderLoop`.
- **Ändern** `src/main.ts`: Renderer mit dem echten Canvas + ResizeObserver verdrahten (Verhalten gleich).
- **Verify:** in-browser Smoke + Screenshot (Darstellung pixelgleich); alle Presets starten; resize testen.

### Stufe 2 — Sim-Host kapseln (läuft NOCH auf Main)

- **Neu** `src/worker/sim-host.ts`: `createSimHost(config)` bündelt `LocalTransport`/`NetworkTransport` +
  `ais` + `tick()` + den View-Model-Bau. Exponiert `submit(intent)`, `control(...)`, Callbacks
  `onViewModel(vm)` / `onCommitted(...)`. Timer per Injection (`setInterval`), damit Worker-tauglich.
- **Ändern** `src/main.ts`: die heutige Transport-/KI-/Tick-Verdrahtung durch `createSimHost` ersetzen
  (immer noch auf Main). **Verify:** Spiel + MP-E2E-Tests unverändert (`npm run test:run`).

### Stufe 3 — View-Model + asynchrone Abfrage-Schicht (läuft NOCH auf Main)

- **Neu** `src/worker/view-model.ts`: `buildViewModel(state, humanId)` → schlankes Objekt (Rangliste Top-N
  - alle Spieler-Kernwerte, eigenes Gold/Truppen/Rate/Rang, Diplomatie-Lage, offene Bündnisangebote,
    Economy-Aufschlüsselung, Ereignislog-Deltas, Phase/Tick). Plus `resolveHover(state, tile)` →
    Tooltip-Daten und `buildQuery(state, …)` → `{ canBuild, snappedTile, cost, … }`.
- **Ändern** `src/ui/hud.ts`, `event-log.ts`, `alliance-prompt.ts`, `action-wheel.ts`, `mobile-topbar.ts`,
  `minimap.ts`, `hover-tooltip.ts`: aus dem **View-Model** lesen statt direkt aus `state`. `src/input/`:
  Bau-/Reach-/Hover-Abfragen über eine `GameQuery`-Schnittstelle (auf Main sync hinterlegt, async-fähig
  geschnitten). **Verify:** alle HUD-Panels + Tooltips + Bauen/Boot/Angriff identisch (in-browser Smoke).

### Stufe 4 — Thread-Sprung (hinter Feature-Flag `?worker` / Einstellung)

- **Neu** `src/worker/sim.worker.ts`: hält `state`, `createSimHost`, den Renderer (OffscreenCanvas via
  `init`), Minimap-Render, `resolveHover`/`buildQuery`. Verarbeitet Main-Nachrichten, postet `viewModel`
  pro Tick + `hoverResult`/`buildQueryResult` auf Anfrage.
- **Ändern** `src/main.ts`: bei aktivem Flag Canvas per `transferControlToOffscreen()` an den Worker;
  `ResizeObserver`→`viewport`-Message; Input→`intent`/`hover`/`buildQuery`-Messages; Kamera-Mutationen→
  `camera`-Message; HUD aus empfangenem `viewModel`. Ohne Flag: der Stufe-3-Pfad auf Main (Fallback +
  für Browser ohne OffscreenCanvas).
- **Verify (Kern-Gate):** in-browser Chaos 2048² Spätspiel, Frame-Gaps messen → **konstant ~60 fps, keine
  Gaps > ~30 ms**, auch wenn ein Sim-Tick lange dauert; Eingabe reagiert ≤1–2 Frames; alle Panels/Tooltips
  funktionieren; Screenshot-Vergleich.

### Stufe 5 — Mehrspieler + Lebenszyklus durch den Worker

- `NetworkTransport`-Commits, Pause/Tempo, Snapshot/Resync (ADR-0009), Replay, Match-Ende über Worker-
  Nachrichten. **Verify:** zwei Tabs, Raum-Code, identischer Verlauf, kein Desync; Reconnect/Resync.

### Stufe 6 — Flag entfernen, aufräumen, mit 0.52.2 zusammen deployen

- OffscreenCanvas-Feature-Detection → Worker als Default, Main-Pfad nur als Fallback. Flag/Doku/Changelog.
- **Verify:** volle Suite grün; in-browser über alle Presets; dann Merge `fix/freeze-standbilder` → main +
  Deploy (so mit Jonathan vereinbart: alles wartet bis hierher).

### Risiko-Reihenfolge

Stufen 1–3 sind reine Entkopplung auf dem Hauptthread → jederzeit lauffähig + einzeln verifizierbar, **null**
Determinismus-Risiko (gleicher Code, gleicher Thread). Das echte Risiko (und der Gewinn) steckt in Stufe 4;
das Feature-Flag erlaubt Seite-an-Seite-Vergleich und sofortiges Zurückschalten.
