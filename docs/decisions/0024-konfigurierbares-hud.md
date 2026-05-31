# ADR 0024: Konfigurierbares HUD + wählbare Themes (In-Game-Editor)

## Status

Accepted — **Phasen 1–3 umgesetzt** (Session 2026-05-31). Aufbauend auf ADR-0010 (HUD-Umbau)
und dem UI-Redesign Schritt 1–4. Prototyp existiert unter `public/theme-*.html` (Dev-Vorschau,
nicht für Produktion). Phase 4 (Politur) weitgehend mit-erledigt (localStorage-Persistenz +
„Standard"-Reset im Editor). Offen: Jonathans Kriegskarte-Anordnung als **eingebauter
Default-Layout** (statt der kantenverankerten Standard-Anordnung) — wird gebacken, sobald er
es im Editor nachbaut + exportiert.

## Datum

2026-05-31

## Kontext

Beim Playtest war das HUD der häufigste Kritikpunkt: zu voll, unklar, „passt nicht zum Spiel".
Schritt 1–3 (Layout/Klarheit, Icons, Emojis raus) sind umgesetzt. Schritt 4 (Look/Theme) wurde
als Prototyp erkundet: ein Web-Editor, in dem jedes HUD-Element ein frei verschieb-/skalier-/
ein-/ausblendbares **Widget** ist, mit 6 Themes (u. a. zwei vom `frontend-design`-Plugin
entworfene: **Bathymetrie** = Seekarte, **Feldemaille** = Kommando-Konsole) und **Kriegskarte**
(Leder/Bronze). Jonathan hat als Ziel-Default ein konkretes **Kriegskarte-Layout** festgelegt und
will den **kompletten Editor ins Spiel** — Spieler sollen ihr HUD selbst bauen, sein Layout ist der
Default.

## Entscheidung

### Persistenz: localStorage, KEINE Accounts

HUD-Config (Layout, Theme, Größen, Sichtbarkeit) ist eine reine **Client-Präferenz** ohne
Einfluss auf die Simulation oder den State-Hash. Daher:

- Speicherung in **localStorage** (wie UI-Größen-Slider + Log-Filter heute).
- **Multiplayer-sicher**: nicht im State-Hash → jeder Spieler darf ein anderes HUD haben, ohne den
  Lockstep zu brechen. Kein Determinismus-Risiko.
- **Keine Profile/Accounts nötig.** Falls später Accounts kommen (ADR-Idee ELO/Ranglisten), kann die
  HUD-Config optional an den Account gehängt werden (Sync über Geräte) — Kür, nicht jetzt.

### Architektur

- **Theme-Tokens** (`src/ui/theme.ts`, vorhanden): CSS-Variablen `--tl-…` definieren Panel-Look,
  Farben, Typografie. Ein gewähltes Theme setzt die Variablen; Panels referenzieren `var(--tl-…)`
  bzw. `panelStyle()`. Schriften (Saira Condensed / Semi Condensed, Oswald) werden **gebündelt**
  (self-hosted, kein CDN-Zwang im Spiel).
- **Widget-Registry**: jedes konfigurierbare HUD-Panel registriert sich mit `id` + Default-Position
  (kanten­verankert). Ein **Layout-Store** (localStorage) hält je Widget
  `{x, y, scale, w, h, hidden, variant}` + `theme` + Gruppen-/Slider-Einstellungen.
- **Default-Layout**: Jonathans Kriegskarte-Anordnung, **sinngemäß kantenverankert übersetzt**
  (sein Prototyp nutzt absolute Pixel von seinem großen Monitor — im Spiel an Ränder gebunden, damit
  es auf jedem Bildschirm passt).
- **Editor-Modus**: per Knopf/Taste umschaltbar. An → Drag/Resize (4 Ecken + Breite/Höhe-Kanten),
  Snap an Rand/Nachbarn mit Align-Linien, Ein-/Ausblenden + Hinzufügen, Paket↔Einzelteile,
  Anordnungs-Varianten (Käufe als Reihe/Numpad), Theme-Wahl, „Zurücksetzen auf Default". Während
  Editor-Modus sind Gameplay-Klicks pausiert. Aus → normales Spiel, Layout/Theme gespeichert.

### Phasen (jede einzeln testbar)

1. **Theme-Fundament** ✅ — Schriften gebündelt, alle 6 Token-Sätze in `theme.ts`, Kriegskarte als
   Default, `panelStyle()` auf allen echten HUD-Panels. Menü übernimmt das Theme mit (nur Look,
   nicht die Positionen).
2. **Layout-Store + Defaults** ✅ — `hud-layout.ts`: Panel-IDs (`info`/`rank`/`resource`/`action`/
   `minimap`/`feed`) + speicherbare `{x,y,s,w,h,hidden}` in localStorage. Ohne Override bleibt das
   Panel an seiner kantenverankerten Standard-Stelle.
3. **Editor-Modus** ✅ — `hud-editor.ts`: „HUD anpassen"-Knopf → Drag/Resize (4 Ecken **+ 4 Kanten**
   für Breite/Höhe einzeln)/Snap (Rand + Nachbarn, Hilfslinien)/Hide+Wieder-Einblenden + Theme-Wahl
   live im Spiel. Beim Öffnen werden Panels vom CSS-Anker + `zoom` ins absolute Modell (`left/top`
   - `transform:scale`) überführt. **Prototyp-Parität (v0.12.0):** Slider-Heimat (Aktion/Truppen),
     Kauf-Knöpfe als Reihe oder 3×3-Numpad, **Paket↔Einzelteile** (Truppen-Block → Zahl/Balken/Gold,
     Aktions-Block → Käufe/Boot) — über `hud-prefs.ts` (geteilter Pref-Speicher, `onHudPrefsChange`
     → HUD re-rendert live, Editor baut Rahmen neu).
4. **Persistenz + Politur** ✅ (Kern) — localStorage-Round-Trip verifiziert, „Standard"-Reset im
   Editor. Offen: Jonathans Layout als eingebauter Default (s. Status).

## Konsequenzen

**Positiv:** Spieler bauen ihr HUD selbst (großer Wunsch im Playtest); ein eigenständiger,
zum Spiel passender Look; kein Account-Zwang; MP bleibt deterministisch.

**Negativ / offen:** großer Umfang über mehrere Sitzungen; das echte HUD hat mehr Zustände als der
Prototyp (Tooltips, Radialmenü, Banner) — nur die Haupt-Panels werden konfigurierbar, der Rest
erbt nur das Theme; Schrift-Bundle vergrößert den Build leicht. Verwandt:
[[feature-idea-hud-editor]], ADR-0010.
