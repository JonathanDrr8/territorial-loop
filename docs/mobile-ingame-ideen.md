# Ideen-Katalog: In-Game-Mobile (nur Konzept, nichts umgesetzt)

**Kontext (2026-06-10):** Das Start-Menü hat mit 0.60.0 einen eigenen App-Wurf bekommen
(Bottom-Navigation, großer Start-CTA, 2×2-Preset-Kacheln, Touch-Ziele ≥44 px). Jonathan fragte
zusätzlich nach Ideen fürs **In-Game** auf dem Handy. Stand heute: Mobile ist spielbar
(Action-Rad + Top-Leiste, v0.36.0), aber es gibt Luft nach oben. Vorschläge zur Auswahl —
bewusst priorisiert nach Wirkung/Aufwand.

## 1. Kontextsensitive Bottom-Action-Bar (statt nur Radial) — Wirkung HOCH, Aufwand mittel

Wie die neue Menü-Bottom-Nav: eine schmale, feste Leiste am unteren Rand, die **kontextabhängig**
die 2–3 wichtigsten Aktionen zeigt: nichts gewählt → [Angriff %] [Bauen] [Diplomatie]; im
Bau-Modus → [Stadt] [Hafen] [Abbrechen]; Angriff läuft → [Abbrechen] [Abwehr] [⌖ Zum Kampf].
Daumen-erreichbar, kein Ziel-Genauigkeits-Problem wie beim Radial auf kleinen Flächen.
(Re-homed bestehende Renderer, analog RTS-Kommandoleisten-Plan.)

## 2. ~~Auto-Zoom-Stufen~~ — VERWORFEN (Jonathan 2026-06-10: „unnötig")

Doppeltipp wechselt heute Zoom; zusätzlich: **drei feste Zoom-Stufen** (Welt / Region / Front)
per Knopf in der Top-Leiste durchschalten + der bestehende ⌖-Sprung prominent als Floating-Button,
wenn ein eigener Angriff läuft. Auf 6-Zoll-Displays ist Orientierung das Hauptproblem.

## 3. Kompakt-Rangliste als Chip — Wirkung MITTEL, Aufwand klein

Die volle Rangliste ist auf dem Handy riesig. Stattdessen ein **einzeiliger Chip** oben
(eigener Rang + Land-% + Erster), Tipp darauf öffnet die volle Liste als Overlay (wie ein
App-Sheet, von oben einschiebend), Tipp daneben schließt.

## 4. Gesten-Paket — Wirkung MITTEL, Aufwand mittel

- **Zwei-Finger-Tipp** = Angriff abbrechen (häufigste „oh nein"-Aktion).
- **Long-Press** auf eigenes Gebiet = Bau-Modus mit Snap (statt Radial-Umweg).
- **Swipe von unten** = Action-Bar/Event-Log einblenden (wie App-Drawer).
  Achtung: nicht mit Pan/Zoom kollidieren — braucht sorgfältiges Playwright-Touch-Testing.

## 5. Sheet-basierte Dialoge — Wirkung MITTEL, Aufwand mittel

Diplomatie-/Gebäude-/Economy-Dialoge auf dem Handy als **Bottom-Sheets** (von unten einschiebend,
über Wischen schließbar) statt zentrierter Desktop-Dialoge — vertrauter App-Standard, bessere
Daumen-Erreichbarkeit, kein Verdecken der Karten-Mitte.

## 6. Haptik + reduzierte Effekte — Wirkung KLEIN, Aufwand klein

`navigator.vibrate(10)` bei Eroberungs-Funken/Angriffs-Start (wo unterstützt); optional
„Reduzierte Effekte"-Toggle (weniger Partikel) für schwächere Geräte — die Render-Last ist auf
Mobile-GPUs der Engpass, nicht die Sim.

## Empfohlene Reihenfolge

**2 → 3 → 1 → 5 → 4 → 6.** Punkt 2+3 sind kleine, risikoarme Quickwins mit sofort spürbarem
Effekt; Punkt 1 ist der große Wurf (gemeinsame Basis mit der RTS-Kommandoleiste,
docs/rts-command-bar-design.md — beide re-homen dieselben Renderer, einmal bauen, zweimal nutzen).
