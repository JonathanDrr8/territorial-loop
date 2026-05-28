# ADR 0012: Skalierung auf viele echte KI-Bots (Performance) — Plan

## Status

Proposed (Plan — noch nicht umgesetzt)

## Datum

2026-05-29

## Kontext

OpenFront erlaubt bis ~400 Bots **und** ~400 Nationen. Die **wilden Nationen** skalieren bei
uns bereits auf mehrere Hundert (ADR-0008 + Autonom-Session: 200 Wilde @ 61 fps, flüssig) —
sie sind **passiv** (keine KI, kein Bauen, keine Diplomatie), kosten also fast nichts. Der
teure Teil ist die **aktive KI**: jeder echte Bot ruft `ai.decide(state)` und plant Angriffe/
Bau/Diplomatie. Heute ist die KI-Anzahl auf 32 begrenzt (`start-menu.ts`). Dieser Plan
beschreibt, wie viele _echte_ Bots (Richtung 100–400) performant werden.

## Wo die Kosten liegen

- `runSimTick` ruft pro Tick **jede** `ai.decide` (`main.ts`). Bei 400 Bots × 10 Ticks/s =
  4000 Entscheidungs-Durchläufe/s — das ist der Flaschenhals, nicht die Sim selbst (deren
  Tick-Phasen sind O(Spieler) und bei Hunderten unkritisch, siehe Wild-Test).
- `ai.decide` liest potenziell den ganzen State (Frontier-Scans, Ziel-Suche). Kosten hängen an
  der Implementierung in `ai/ai.ts`.

## Plan

1. **KI-Throttling / Zeit-Slicing (Kern).** Bots entscheiden **nicht jeden Tick**, sondern in
   einem **Round-Robin über mehrere Ticks** (z.B. je Bot alle N Ticks, gestaffelt nach
   `id % N`) — die KI-Last pro Tick wird konstant gehalten, egal wie viele Bots. Spielerisch
   unkritisch (Bots müssen nicht 10×/s neu planen; 1–2×/s reicht). Deterministisch: die Staffel
   hängt nur an `id` und `tick`, nicht an Wall-Clock.
2. **`ai.decide` profilieren + verschlanken.** Teure Scans cachen/begrenzen (z.B. nur eigene
   Frontier statt globaler Sweeps; Ziel-Kandidaten begrenzen). Erst messen (`performance`),
   dann optimieren.
3. **Cap anheben + Spawn prüfen.** KI-Slider in `start-menu.ts`/`preferences.ts` schrittweise
   hoch (32 → 100 → …), Spawn-Platzierung (`findSpawnCenter`, Rejection-Sampling) bei vielen
   Spielern auf großer Karte verifizieren (wie bei den Wilden; ggf. `minDist` adaptiv).
4. **Rendering bleibt günstig.** Labels sind für Wilde bereits zoom-gegated (ADR-0008/Session);
   für viele KI denselben Mechanismus erwägen (nur die größten/nächsten beschriften).
5. **Verifikation.** Playwright-FPS-Messung bei 100/200/400 Bots; Tick-Zeit messen
   (`runSimTick`-Dauer). Ziel: ≥ 50 fps und Tick-Zeit < ~10 ms bei 1×.

## Bezug zu Multiplayer

In Multiplayer (ADR-0009) laufen Bots **autoritativ an einer Stelle** (Server/Host), nicht auf
jedem Client — dort ist KI-Throttling sogar wichtiger (eine Maschine trägt alle Bots). Die hier
geplante Round-Robin-Staffel ist dieselbe und deterministisch, passt also nahtlos.

## Konsequenzen

- **Pro:** Entkoppelt KI-Last von der Bot-Zahl → „viele Bots" wird machbar, ohne die Sim
  anzufassen. Wilde Nationen decken den Wunsch „viele Nationen" schon ab; echte Bots sind die
  Kür.
- **Contra:** Throttling macht Bots minimal träger im Reagieren (1–2×/s statt 10×/s) — in einem
  Territorial-RTS irrelevant.
- Betroffen: `src/main.ts` (KI-Schleife/Throttle), `src/ai/ai.ts` (Profiling/Verschlankung),
  `src/ui/start-menu.ts` + `src/ui/preferences.ts` (Cap).
