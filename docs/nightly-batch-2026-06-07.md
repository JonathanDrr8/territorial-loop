# Nacht-Batch 2026-06-07 (autonom)

**Auftrag (Jonathan, vor dem Schlafen):** mehrere Test-Befunde + Wünsche autonom abarbeiten, alles auf
Branch `chore/perf-profiling` (kein Merge/Deploy — Morgen-Review), am Ende PC ausschalten.

**Regeln:** typecheck+lint+test:run nach jeder Änderung grün; UI per Playwright im echten Match prüfen;
Determinismus in core/; Perf-Arbeit nur verhaltensneutral (Golden identisch); Balance nur messen+vorschlagen
(keine Wert-Änderung außer der ausdrücklichen Kriegsschiff-Direktive).

## Tracking

| #   | Aufgabe                                                    | Status       | Commit   |
| --- | ---------------------------------------------------------- | ------------ | -------- |
| 1   | Off-Screen-Panel-Clamp (zoom-aware)                        | ✅ erledigt  | 07b0ef2  |
| 2   | Kriegsschiff-Reichweite NAVAL_RANGE 3→32                   | ✅ erledigt  | (dieser) |
| 3   | UI-Transparenz-Regler (Einstellungen, 9 Sprachen)          | erledigt     | (dieser) |
| 4   | Hover-Panel-Sprung — geprüft, kein Positions-Bug           | dokumentiert | —        |
| 5   | Mikro-Hänger — Sim gemessen, nicht sim-gebunden            | dokumentiert | —        |
| 6   | Gebäude zu günstig — gemessen + Vorschlag (keine Änderung) | dokumentiert | —        |
| 7   | RTS-Bottom-Panel (experimentell)                           | offen        | —        |

## Notizen

- **#2 Kriegsschiff-Reichweite:** `NAVAL_RANGE` 3 → **32** (Jonathan: „massiv hoch, gern 32 oder sogar
  48"). **48 ist die Alternative**, falls 32 noch zu wenig wirkt — eine Konstante in `src/core/ships.ts:50`.
  Golden-Hash blieb identisch (im 300-Tick-Lauf engagen Kriegsschiffe nicht reichweiten-kritisch). Der
  AI-Abfang-Test wurde auf eine 80×80-Karte umgestellt (Ziel 40 Tiles entfernt > Reichweite → KI fährt hin).

## Balance-Vorschläge zur Freigabe (NICHT umgesetzt)

### #6 Gebäude zu günstig (Daten + Vorschlag)

Gemessene Einkommens-Rate des Leaders (Standard-Match, headless, seed gold-probe):

| Zeit  | Tiles  | Gold-Konto | Rate     | bis 25k-Gebäude |
| ----- | ------ | ---------- | -------- | --------------- |
| 50 s  | 997    | 50k        | 1.000/s  | 25 s            |
| 100 s | 3.009  | 123k       | 1.964/s  | 13 s            |
| 150 s | 9.159  | 170k       | 3.455/s  | 7 s             |
| 200 s | 17.010 | 418k       | 4.965/s  | 5 s             |
| 300 s | 34.380 | 639k       | 13.469/s | 2 s             |
| 400 s | 53.473 | 1.045k     | 6.875/s  | 4 s             |

**Befund:** Das FLACHE Gold (`BASE_GOLD_PER_TICK=100` → ~1.000/s) bleibt konstant; die Explosion (bis
13k/s) kommt aus dem **Fabrik-Netz**, das mit der Reichsgröße skaliert — während die Baukosten bei **100k**
gedeckelt sind. Mittel/Spätspiel: ein Gebäude alle **2–7 s**, und das Gold-**Konto** staut sich auf **1 Mio.+**
ungenutzt → „immer viel zu platzieren". Bestätigt.

**Vorschlag (zur Freigabe — eine Konstante je Hebel):**

1. **Baukosten-Basis 25k → 40k** (`BASE_BUILD_COST`, `src/core/buildings.ts`): jedes erste Gebäude ein
   größerer Schritt (Eskalation dann 40/80/100k). Wirkt v.a. früh/mittel.
2. **Deckel 100k → 150k** (`BUILD_COST_CAP`): das N-te Gebäude wird teurer (40/80/160→150k) → Spam kostet.
3. **Optional flaches Gold 100 → 70** (`BASE_GOLD_PER_TICK`): bremst die GANZE Wirtschaft (auch früh).
   Hinweis: trifft das SPÄTE Pile-up kaum (das ist Fabrik-getrieben), eher das Früh-Tempo.
4. **Kern des Spätspiel-Pile-ups** ist der bekannte Gold-Senken-Mangel (ADR-0031): Einkommen >> Senken.
   Echte Lösung wäre eine stärkere Senke (Städte-Leveln teurer/höher) ODER Fabrik-Einkommen flacher.

**Empfehlung:** 1 + 2 zusammen (Baukosten 40k + Deckel 150k) als spürbarer, risikoarmer erster Schritt;
Fabrik-Einkommen/Senke separat, falls das Spätspiel-Pile-up bleibt.

- **#3 UI-Transparenz:** Regler 40–100 % in den Einstellungen (live), persistiert (localStorage,
  theme-unabhängig), CSS-Var `--tl-ui-opacity` auf `:root`, von `panelStyle()` als Panel-Deckkraft
  genutzt. Verifiziert (Playwright): bei 50 % liegen 15/16 Haupt-HUD-Panels auf 0.5. **Abdeckung:**
  panelStyle-basiertes In-Game-HUD (hud.ts, Ereignislog, Hover-Panel, Pause-Menü, …). NOCH NICHT erfasst:
  Panels mit direkter `var(--tl-panel-bg)`-Nutzung (Radialmenü/build-menu, action-wheel/Mobile, einige
  Dialoge) — diese fadest man später analog mit, falls gewünscht.

- **#4 Hover-Panel:** GEPRÜFT (Playwright) — das fixe „Unter dem Cursor"-Panel (hover-info.ts) ist
  anchored (top:128, left:12) + `min-height:86px` und **wechselt die Position NICHT** (über zwei
  Hover-Stellen exakt top=115/left=11/h=77). Es wächst höchstens nach unten (Inhalt). Der wahrgenommene
  „Sprung" ist der **cursor-folgende Tooltip** (hover-tooltip.ts) — der dem Mauszeiger folgt, **gewollt**.
  → KEINE Code-Änderung (nichts Kaputtes). Hebel, falls das mitwandernde Tooltip stört: Hover-Modus in
  den Einstellungen auf „nur Panel" stellen (entfernt das mitwandernde Tooltip). Mögliche weitere Ursache
  von „verschiebt sich oft" auf einem Tiling-WM (Hyprland): bei jedem Fenster-Resize rechnet die ui-scale
  die Zoom-Stufe neu → das ganze HUD reskaliert sichtbar. Das ist responsives Verhalten; feinere
  Zoom-Stufen wären ein separater, größerer Eingriff (zur Freigabe vermerkt).

- **#5 Mikro-Hänger:** GEMESSEN (`npm run perf -- standard --phases --ticks 2000`): Schnitt **2,0 ms/Tick**,
  schlimmster Tick **26 ms** (Trade-BFS-Warmup, transient), attacks p99 4,2 ms. Chaos (vorher) ~3,6 ms/Tick.
  Die Sim liegt **weit unter dem 100-ms-Tick-Budget** → die Mikro-Hänger sind **NICHT sim-gebunden** (der
  große KI-Spike wurde im ersten Nachtlauf gefixt: planBomber 354→38 ms, orderedPlayers gecacht).
  **Wahrscheinliche Ursache:** Render-Thread-GC (Zeichnen vieler Nationen/Labels alloziert pro Frame) oder
  die Worker→Shadow-Sync pro Tick — beides **außerhalb der headless-Sim-Messung**. Sauber lokalisieren nur
  mit einer **betreuten Chrome-DevTools-Performance-Aufnahme** während des Spielens (zeigt GC/Long-Task-
  Spikes je Frame). → KEINE blinde Änderung. Hebel für eine betreute Sitzung: (a) DevTools-Performance-
  Aufnahme 10 s im Match → Long-Tasks/GC ansehen; (b) falls Render-GC: Allokationen im renderLoop/Shadow-
  Sync senken (Scratch-Puffer); (c) findWaterPath-Epoch-Arrays (aus dem Perf-Doc) gegen den Trade-Spike.
