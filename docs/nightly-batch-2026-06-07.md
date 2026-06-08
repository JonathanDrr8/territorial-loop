# Nacht-Batch 2026-06-07 (autonom)

**Auftrag (Jonathan, vor dem Schlafen):** mehrere Test-Befunde + Wünsche autonom abarbeiten, alles auf
Branch `chore/perf-profiling` (kein Merge/Deploy — Morgen-Review), am Ende PC ausschalten.

**Regeln:** typecheck+lint+test:run nach jeder Änderung grün; UI per Playwright im echten Match prüfen;
Determinismus in core/; Perf-Arbeit nur verhaltensneutral (Golden identisch); Balance nur messen+vorschlagen
(keine Wert-Änderung außer der ausdrücklichen Kriegsschiff-Direktive).

## Tracking

| #   | Aufgabe                                           | Status       | Commit   |
| --- | ------------------------------------------------- | ------------ | -------- |
| 1   | Off-Screen-Panel-Clamp (zoom-aware)               | ✅ erledigt  | 07b0ef2  |
| 2   | Kriegsschiff-Reichweite NAVAL_RANGE 3→32          | ✅ erledigt  | (dieser) |
| 3   | UI-Transparenz-Regler (Einstellungen, 9 Sprachen) | erledigt     | (dieser) |
| 4   | Hover-Panel-Sprung — geprüft, kein Positions-Bug  | dokumentiert | —        |
| 5   | Mikro-Hänger — Sim gemessen, nicht sim-gebunden   | dokumentiert | —        |
| 6   | Gebäude zu günstig (nur messen + Doku)            | offen        | —        |
| 7   | RTS-Bottom-Panel (experimentell)                  | offen        | —        |

## Notizen

- **#2 Kriegsschiff-Reichweite:** `NAVAL_RANGE` 3 → **32** (Jonathan: „massiv hoch, gern 32 oder sogar
  48"). **48 ist die Alternative**, falls 32 noch zu wenig wirkt — eine Konstante in `src/core/ships.ts:50`.
  Golden-Hash blieb identisch (im 300-Tick-Lauf engagen Kriegsschiffe nicht reichweiten-kritisch). Der
  AI-Abfang-Test wurde auf eine 80×80-Karte umgestellt (Ziel 40 Tiles entfernt > Reichweite → KI fährt hin).

## Balance-Vorschläge zur Freigabe (NICHT umgesetzt)

_(wird von #6 gefüllt)_

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
