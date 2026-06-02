# ADR-0028 — HUD-Editor-Umbau: Tabs, Quick-Configs, echtes Resize

**Status:** Proposed (Design mit Jonathan gelockt 2026-06-02, Umsetzung offen)
**Bezug:** Nachtrag/Erweiterung zu [ADR-0024 — Konfigurierbares HUD](./0024-konfigurierbares-hud.md)

## Auslöser (Spieler-Feedback)

1. **Log lässt sich nicht „voller" ziehen:** Zieht man das Ereignis-Panel größer, wird nur
   die Box größer (gezoomt), aber es erscheinen keine zusätzlichen Log-Zeilen.
2. **Angriffe-Panel nicht groß ziehbar:** Es „erscheint im Spiel" → im Editor ein winziger
   leerer Platzhalter, daher kaum skalierbar.
3. **Editor-Leiste überladen:** Eine dichte Knopf-Reihe; soll aufgeräumt werden.
4. **Quick-Configs gewünscht:** Layout-Presets — gemeint sind **Steuerungs-Modus-Presets**
   (z. B. nur Navigations-Rad / Maus-Modus), die Panels + Steuerung auf einen Schlag setzen.

## Kernursache (1 + 2)

Der Editor überführt Panels ins Modell `left/top + transform: scale(s)` (`hud-editor.ts`,
`applyTransform`). „Größer ziehen" = **ein einziger Skalierungs-Faktor** → die Box samt Inhalt
wird gezoomt. Es gibt keinen Weg, „gleiche Schriftgröße, mehr Inhalt" auszudrücken. Der Log
ist zusätzlich hart auf `MAX_VISIBLE = 7` gedeckelt (`event-log.ts:25`).

→ Log-Reflow und Angriffe-Resize sind **kein Quick-Fix**, sondern brauchen den Editor-Umbau.

## Entscheidungen (gelockt)

### A) Editor-Leiste → Tabs

`Design` / `Layout` / `Elemente` als drei Reiter (statt aller Reihen gleichzeitig) + ein
**Quick-Config-Dropdown** oben. Inhalt der Reiter = die heutigen Reihen:

- **Design:** Theme-Wahl (themeRow).
- **Layout:** Slider-Heimat, Knopf-Anordnung, Paket/Geteilt (×2), Truppen-Anzeige, Steuerung.
- **Elemente:** Sichtbarkeits-Toggles je Panel.
- Fuß bleibt: Export / Standard / Fertig.

### B) Quick-Configs = Steuerungs-Modus-Presets

Setzen Position/Größe/Sichtbarkeit ALLER Panels + `controlMode` + Button-Layout auf einmal.
Vorgesehen (final mit Jonathan abstimmen):

- **Standard** — das ausgewogene Default-Layout (= heutiger Reset).
- **Maus** — Desktop/Maus: Knopf-Reihen, Aktions-/Bau-Panel klassisch, Rad optional aus.
- **Navigations-Rad** — Rad als primäre Eingabe (Touch-freundliche Größen), reduzierte Leisten.
  Technisch: ein benannter Satz `HudLayout` + `HudPrefs`-Overrides je Preset; „anwenden"
  schreibt Layout + Prefs und ruft `applyLayoutPrefs`.

### C) Echtes Resize für Inhalts-Panels (löst 1 + 2)

Listen-/Feed-Panels (**Log**, **Rangliste**, **Angriffe**) bekommen eine **echte Höhe** im
Editor (nicht nur Scale). Der Inhalt **reflowt**: so viele Zeilen, wie bei aktueller Schrift in
die Box-Höhe passen.

- `event-log.ts`: `MAX_VISIBLE` durch eine aus der Box-Höhe berechnete Zeilenzahl ersetzen
  (`clientHeight / Zeilenhöhe`), `overflow:hidden` + `justify-content:flex-end` bleiben → älteste
  oben abgeschnitten.
- Editor-Resize-Modell: für diese Panels einen separaten Höhen-Freiheitsgrad zulassen
  (Scale weiterhin für Icon-/Knopf-Panels, wo Zoom gewollt ist). Im `HudLayout`-State je Panel
  optional `h` (Pixel) zusätzlich zum Scale.
- Angriffe-Panel: im Editor mit einer Mindest-/Platzhaltergröße darstellen, die sich ziehen lässt.

## Betroffene Dateien

`hud-editor.ts` (Tabs + Quick-Config-Dropdown + Höhen-Resize), `hud-layout.ts` (Presets + `h`),
`hud-prefs.ts` (Preset-Anwendung), `event-log.ts` (Reflow), `hud.ts` (Rangliste/Angriffe-Reflow),
`i18n/*` (Tab-Titel, Quick-Config-Namen — 9 Sprachen).

## Verifikation (geplant)

| #   | Was              | Test                                                                                      |
| --- | ---------------- | ----------------------------------------------------------------------------------------- |
| 1   | Log-Reflow       | Panel höher ziehen → mehr Zeilen bei gleicher Schriftgröße (Browser-Screenshot)           |
| 2   | Angriffe ziehbar | Im Editor Größe ändern, im Match Angriffe → Panel hat die gewählte Größe                  |
| 3   | Tabs             | Editor öffnen → 3 Reiter, jeder zeigt nur seine Regler                                    |
| 4   | Quick-Config     | Preset „Navigations-Rad" → Layout/Steuerung springt komplett um; „Standard" stellt zurück |
| 5   | Determinismus/MP | Presets sind reine Client-Layout-Prefs (kein Sim-State) — `npm run test:run` grün         |

## Offen / nächster Schritt

Umsetzung in der Reihenfolge: (C) Reflow-Fundament → (A) Tabs → (B) Quick-Configs. Inkrementell
mit Browser-Verifikation und je eigenem Commit.
