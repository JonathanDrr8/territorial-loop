# Nacht-Batch 2026-06-07 (autonom)

**Auftrag (Jonathan, vor dem Schlafen):** mehrere Test-Befunde + Wünsche autonom abarbeiten, alles auf
Branch `chore/perf-profiling` (kein Merge/Deploy — Morgen-Review), am Ende PC ausschalten.

**Regeln:** typecheck+lint+test:run nach jeder Änderung grün; UI per Playwright im echten Match prüfen;
Determinismus in core/; Perf-Arbeit nur verhaltensneutral (Golden identisch); Balance nur messen+vorschlagen
(keine Wert-Änderung außer der ausdrücklichen Kriegsschiff-Direktive).

## Tracking

| #   | Aufgabe                                           | Status      | Commit   |
| --- | ------------------------------------------------- | ----------- | -------- |
| 1   | Off-Screen-Panel-Clamp (zoom-aware)               | ✅ erledigt | 07b0ef2  |
| 2   | Kriegsschiff-Reichweite NAVAL_RANGE 3→32          | ✅ erledigt | (dieser) |
| 3   | UI-Transparenz-Regler (Einstellungen, 9 Sprachen) | erledigt    | (dieser) |
| 4   | Hover-Panel-Sprung stabilisieren                  | offen       | —        |
| 5   | Mikro-Hänger (neutrale Perf)                      | offen       | —        |
| 6   | Gebäude zu günstig (nur messen + Doku)            | offen       | —        |
| 7   | RTS-Bottom-Panel (experimentell)                  | offen       | —        |

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
