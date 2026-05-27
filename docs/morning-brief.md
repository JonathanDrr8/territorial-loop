# Morning Brief — Nacht-Session 2026-05-27 / 28

Stand bei deinem Reinkommen morgens. 29 Commits seit du schlafen gegangen bist,
alle 132 Tests grün, Lint + Typecheck clean.

## Was du sofort testen kannst

`http://localhost:5173/` ist offen — der Vite-Dev-Server läuft die ganze Nacht.

Das **Start-Menü** ist neu und merkt sich die Einstellungen zwischen Sessions.
Dein letzter Match-Setup wird vorausgewählt.

## Größte Sichtbare Änderungen

1. **Terrain (Land/Wasser-Karten)** — "Karten-Typ" im Menü: _Offen / Kontinente
   / Inseln_. Tileable noise, kein Naht-Übergang am Torus-Rand. Spawn-Platzierung,
   Wave-Expansion, Sieg-Check respektieren Wasser.
2. **Start-Menü** mit allen Match-Parametern (Name, Größe, KI-Anzahl, Tempo,
   Schwierigkeit, Terrain, Sound).
3. **Belagerungs-Modus light** — "Eroberungs-Tempo: Belagerung" multipliziert
   `tilesPerTick` × 0.3. Wave bewegt sich langsamer, Angriff hält länger an.
4. **Minimap** unten rechts mit Torus-Wrap-Indikator (Viewport-Box wird 3×3
   getilt — du siehst direkt wenn dein Sichtfeld einen Wrap überschreitet).
5. **Sound** (Web Audio, kein Asset) — Klick beim Angriff, Sieg/Niederlage-Chime.
6. **HUD** zeigt jetzt Spielzeit + aktuelle Sim-Geschwindigkeit + Live-%-Stand
   aller Spieler. Game-Over-Banner mit Sieger und "Neues Match"-Button.
7. **Hover-Tooltip** über fremden Tiles zeigt Spielername, Bevölkerung, %.
8. **Hover-Tile-Outline** macht klar wo dein nächster Klick landet.
9. **Pulsierendes Crosshair** auf jedem deiner aktiven Attack-Foci, in deiner
   Spielerfarbe.
10. **Klick-Animation** — expandierender Ring am Klick-Punkt mit Wrap-Replikation.
11. **Direktionale Angriffe** — der Klick-Punkt bestimmt die Richtung der
    Welle, nicht mehr diamantförmig in alle Richtungen.
12. **KI-Schwierigkeitsgrade** Einfach / Normal / Schwer.
13. **Random Spieler-Namen** aus einem 48-Namen-Pool, distinkte Farben pro Match.
14. **Esc** = zurück zum Start-Menü, jederzeit.

## Was unter der Haube passiert ist

- main.ts wurde refactort — HUD, Hover-Tooltip, Minimap, Sound, Start-Menü,
  Color-Utils, Preferences sind eigene Module unter `src/ui/`.
- WebGL-Renderer (Pixi) wurde gegen Canvas-2D ersetzt — Pixi rendert bei dir
  auf Hyprland nicht zuverlässig.
- Performance bei 1024×1024-Maps validiert (Sim hält 10 Hz, kein Frame-Drop).
- Module-READMEs (ai, input, render, ui, world) sind alle aktuell.
- Test-Suite ging von 71 auf 132 Tests, alle grün.

## Offene Fragen

`docs/morning-questions.md` ist leer — alles was du vor dem Schlafen geklärt
hast, ist eingebaut.

## Wenn etwas dramatisch schiefläuft

```bash
git log --oneline -30      # Übersicht aller Nacht-Commits
git revert <hash>          # einzelnen Commit rückgängig
git reset --hard <hash>    # zu früherem Zustand zurück (vorsichtig)
```

Alle Commits sind klein und fokussiert — Reverts sollten chirurgisch möglich
sein ohne dass anderes mitleidet.

## Was noch nicht getan ist

- Echtes Capture-Progress-System (Tiles mit N-Tick-Countdown statt Speed-
  Multiplier). Siehe `feature-idea-belagerung.md` im memory.
- Match-Statistik beim Game-Over (Match-Dauer, größte Eroberung, etc.)
- Replay via Seed-Eingabe im Menü
- Render-Optimierung: nur sichtbare Region per Frame redraw

_Stand: 2026-05-28 (Beginn der morgendlichen Übergabe)_
