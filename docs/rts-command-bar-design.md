# Design-Entwurf: RTS-Kommandoleiste (unteres Panel)

**Status:** Proposed (Entwurf, NICHT umgesetzt) — Idee von Jonathan: „ein großes Panel für den unteren
Bildschirm wie aus anderen RTS-Games, das alle aktuellen Elemente vereint. Vielleicht sieht das gut aus."

**Warum nur Entwurf, nicht gebaut:** Das ist ein subjektiver, größerer HUD-Umbau (re-homed mehrere
bestehende Panels in eine Leiste). Im unbeaufsichtigten Nachtlauf wäre eine halbfertige Version riskant
(Bugs + evtl. nicht dein Geschmack). Dieser Entwurf lässt dich das Konzept beurteilen, bevor investiert wird.

## Konzept

Eine durchgehende Leiste am **unteren Rand**, voll breit, die die heute verstreuten HUD-Elemente bündelt:
Minimap · Truppen/Gold/Rang · Angriffs-Slider · Bau- & Schiffs-/Diplomatie-Buttons. **Opt-in** (umschaltbar),
das Default-HUD bleibt unangetastet.

## ASCII-Mockup (Desktop, ~1280 breit)

```
 Karte / Spielfeld
 ────────────────────────────────────────────────────────────────────────────────────────
|                                                                                          |
|                                  (Spielwelt)                                             |
|                                                                                          |
 ════════════════════════════════════════════════════════════════════════════════════════
| ┌────────────┐ │ Aldric · Rang #1 · 53% Land     │ Angriff  30%        │ Bauen           |
| │  Minimap   │ │ Truppen 16.6k / 16.7k   (99%)   │ [====|──────] ◀▶     │ [Stadt] [Hafen] |
| │  120 x 86  │ │ Gold    1.04M   ▸  +999/s       │ ⌖ Zum Kampf springen │ [Fabrik][Vert.] |
| └────────────┘ │ Pop wächst optimal bei 42%       │                     │ [Flak] [Flugh.] |
| ───────────────┴─────────────────────────────────┴─────────────────────┴──── [Boot]──────|
|  Aktionen: [Abbrechen] [Abwehr]      Ereignis: „Carbon bietet Aldric ein Bündnis"  [⚙]   |
 ════════════════════════════════════════════════════════════════════════════════════════
```

**Sektionen (links→rechts):**

1. **Minimap** (umgezogen aus der Ecke).
2. **Status:** Name/Rang/Land-%, Truppen/Cap/%, Gold + Rate (+ aufklappbare Economy), Wachstums-Hinweis.
3. **Angriff:** Slider (Shift+Rad bleibt), „Zum Kampf springen".
4. **Bauen/Aktionen:** Bau-Buttons (Stadt/Hafen/Fabrik/Verteidigung/Flak/Flughafen) + Boot/Kriegsschiff/
   Diplomatie. (Ersetzt für Maus-Spieler optional das Rechtsklick-Radialmenü; das Radial bleibt verfügbar.)
5. **Untere Zeile:** kontextuelle Aktionen (Abbrechen/Abwehr), kompakter Ereignis-Hinweis, Einstellungen.

Die **Rangliste** bliebe oben rechts (zu groß für die Leiste) oder würde ein-/ausklappbar.

## Opt-in / Umsetzung

- **Schalter:** neue HUD-Pref `commandBar: boolean` (hud-prefs.ts) + Eintrag in den Einstellungen
  („Klassische RTS-Leiste"). Default **aus** → bestehendes HUD unverändert.
- **Neues Modul** `src/ui/command-bar.ts`: voll-breites, unten-verankertes Panel (`panelStyle`), das die
  vorhandenen Bau-/Angriffs-/Status-Renderer **wiederverwendet** (nicht dupliziert) und neu anordnet.
- Ist `commandBar` an: die heute verstreuten Panels (Truppen/Gold, Aktions-Panel, Minimap) werden
  **ausgeblendet** (über das vorhandene `hud-layout`-/`getPanel(...).hidden`-System) und in die Leiste
  eingehängt.
- **i18n:** ein Schalter-Label in 9 Sprachen; die Bau-/Aktions-Labels existieren bereits.
- **Mobile:** Die Action-Wheel-/Top-Leiste (v0.36.0) bleibt für Touch; die Kommandoleiste ist ein
  **Desktop**-Layout (auf schmalen Viewports nicht anbieten).

## Aufwand / Risiko

- **Aufwand:** mittel–groß (Re-Homing + Wiederverwendung der Renderer, sauberer Opt-in-Pfad, Playwright-
  Verifikation der umgehängten Controls). Realistisch eine eigene betreute Feature-Sitzung.
- **Risiko:** Layout-Geschmack (subjektiv); Wechselwirkung mit HUD-Editor/ui-scale; Doppel-Wege fürs Bauen
  (Leiste vs. Radial). Darum Opt-in + Default unverändert.

## Empfehlung

Konzept zuerst freigeben (sieht das Mockup gut aus?), dann in **einer betreuten Sitzung** als Opt-in bauen —
Schritt 1 nur Status+Bauen in der Leiste, Minimap/Angriff danach. So bleibt jeder Zwischenstand bewertbar.
