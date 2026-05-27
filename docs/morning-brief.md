# Morning Brief — Nacht-Session 2026-05-27/28

Stand bei deinem Reinkommen morgens. **34 Commits** seit du schlafen gegangen
bist, alle 132 Tests grün, Lint + Typecheck clean.

## Was du sofort testen kannst

`http://localhost:5173/` ist offen — der Vite-Dev-Server läuft die ganze Nacht.

Das **Start-Menü** ist neu und merkt sich die Einstellungen zwischen Sessions
(LocalStorage). Probier mal verschiedene Kombinationen:

- **Kontinente** oder **Inseln** als Karten-Typ
- **Belagerung** als Tempo (Welle fließt langsamer, OpenFront weniger frantic)
- **Schwer** als KI-Schwierigkeit
- 1024×1024 für ein episches Match
- Seed-Feld füllen für reproduzierbare Matches

## Größte sichtbare Änderungen

1. **Terrain (Land/Wasser)** — tileable noise via Cosinus-Summen, keine sichtbare
   Naht am Torus-Rand. Spawn-Platzierung, Wave-Expansion, Sieg-Check respektieren
   Wasser.
2. **Start-Menü** mit allen Match-Parametern + LocalStorage-Persistence.
3. **Belagerungs-Modus light** — `tilesPerTick × 0.3`, Wave langsam, Angriff hält
   länger an. Adressiert dein "OpenFront zu schnell"-Anliegen.
4. **Minimap** unten rechts mit Torus-Wrap-Indikator (Viewport-Box wird 3×3
   getilt — du siehst direkt wenn dein Sichtfeld einen Wrap überschreitet).
5. **Sound** (Web Audio, keine Assets nötig) — Klick beim Angriff, Sieg/Niederlage-Chime.
6. **HUD** zeigt jetzt Spielzeit + aktuelle Sim-Geschwindigkeit + Live-%-Stand.
7. **Game-Over-Banner mit Statistik** — Sieger, Match-Dauer, pro Spieler:
   Peak-%-Stand, Peak-Truppen, Match-Seed (für Wiederholung).
8. **Hover-Tooltip** über fremden Tiles zeigt Spielername, Bevölkerung, %.
9. **Hover-Tile-Outline** macht klar wo dein nächster Klick landet.
10. **Pulsierendes Crosshair** auf jedem deiner aktiven Attack-Foci.
11. **Klick-Animation** — expandierender Ring beim Angriffsklick.
12. **Direktionale Angriffe** — der Klick-Punkt bestimmt die Richtung der Welle.
13. **KI-Schwierigkeitsgrade** Einfach / Normal / Schwer.
14. **Random Spieler-Namen** aus einem 48-Namen-Pool, distinkte Farben pro Match.
15. **Esc** = zurück zum Start-Menü, jederzeit.
16. **Pause-Overlay** ("PAUSE" in groß) wenn die Sim pausiert ist.
17. **Match-Seed** wird im Game-Over-Banner angezeigt → kannst du copy-paste-en
    um exakt dasselbe Match nochmal zu spielen.

## Was unter der Haube passiert ist

- `main.ts` wurde refactort — HUD, Hover-Tooltip, Minimap, Sound, Start-Menü,
  Color-Utils, Preferences sind eigene Module unter `src/ui/`.
- WebGL-Renderer (Pixi) wurde gegen Canvas-2D ersetzt — Pixi rendert bei dir
  auf Hyprland nicht zuverlässig (siehe ADR-0005).
- Render-Performance: Bitmap wird nur einmal pro Sim-Tick gemalt (statt jedes
  Frame), erspart 6/7 der Pixel-Writes bei 60fps Render + 10 Hz Sim.
- Performance bei 1024×1024-Maps validiert (Sim hält 10 Hz, kein Frame-Drop).
- Module-READMEs (ai, input, render, ui, world) sind alle aktuell.
- Test-Suite ging von 71 auf 132 Tests, alle grün.
- ADR-0005 dokumentiert die Pixi→Canvas2D-Entscheidung.

## Offene Fragen

`docs/morning-questions.md` ist leer — alles was du vor dem Schlafen geklärt
hast, ist eingebaut.

## Wenn etwas dramatisch schiefläuft

```bash
git log --oneline -40      # Übersicht aller Nacht-Commits
git revert <hash>          # einzelnen Commit rückgängig
git reset --hard <hash>    # zu früherem Zustand zurück (vorsichtig)
```

Alle Commits sind klein und fokussiert — Reverts sollten chirurgisch möglich
sein ohne dass anderes mitleidet.

## Was noch nicht getan ist (Stretch goals für später)

- Echtes Capture-Progress-System (Tiles mit N-Tick-Countdown statt Speed-
  Multiplier). Siehe `feature-idea-belagerung.md` im memory.
- Animationen für einzelne Tile-Eroberungen (Aufblitzen)
- Mehrere Spieler-Profile / KI-Persönlichkeiten (defensiv vs. aggressiv)
- Mehr Spieler-Limit (aktuell max 7 KI + 1 Mensch = 8)
- Pixi-Dependency entfernen (in `package.json` noch drin, wird nicht genutzt)

## Memory-Updates

Im memory-System wurden folgende Files aktualisiert oder neu angelegt:

- `feature-idea-belagerung.md` — Belagerungs-Idee ist als matchSpeed umgesetzt,
  vollständiges capture-progress als Erweiterung-Idee gemerkt
- Alle anderen MVP-bezogenen Memory-Dateien sind weiterhin gültig

_Letztes Update: 2026-05-28, Ende der Nacht-Session_
