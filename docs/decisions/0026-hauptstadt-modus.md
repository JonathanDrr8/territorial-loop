# ADR-0026: Hauptstadt-Modus

**Status:** Accepted (umgesetzt, Solo)
**Datum:** 2026-06-01

## Kontext

Experimenteller Spielmodus (Jonathans Vorschlag): Jede Nation startet mit einer **Hauptstadt**. Man
**verliert, wenn die eigene Hauptstadt erobert** wurde, und **gewinnt, wenn alle anderen
Hauptstädte** gefallen sind. Ersetzt die Gebiets-%-Siegbedingung. Die KI soll den Modus „verstehen".

## Entscheidung

- `GameConfig.captureMode?` (bool). `Player.capitalTile?` — beim Spawn aufs **Spawn-Zentrum** gesetzt
  (`placeSpawns`, nur für nicht-wilde Nationen).
- **Eliminierung** (`checkEliminations`): zusätzlich zur „kein Gebiet"-Regel ist eine Nation raus,
  sobald ein **Gegner** (owner > 0, nicht man selbst) ihr Hauptstadt-Tile besitzt. Eine nur _neutrale_
  Hauptstadt (z.B. Bombenkrater) eliminiert NICHT — sie ist nur „lost" durch echte Eroberung. Das
  übrige Gebiet der eliminierten Nation bleibt liegen und ist herrenlos eroberbar.
- **Sieg** (`checkCaptureVictory`): sobald nur noch **eine Seite** (Team oder Einzel-Nation) lebende,
  nicht-wilde Nationen hat. Team-bewusst über `sideOf` → komponiert mit Teams (ADR-0025).
- **Rendering:** ein Stern in Besitzerfarbe auf jeder lebenden Hauptstadt (`drawCapitals`).
- **KI:** im Capture-Modus wertet `pickLandTarget` Gegner-Tiles **näher an deren Hauptstadt höher** →
  die KI drängt zur Hauptstadt. NUR in diesem Modus aktiv → die kalibrierte Normal-Balance bleibt
  unberührt (keine Neu-Eichung nötig).
- **UI:** Play-Tab → „Modus" → „Hauptstadt-Modus" (Checkbox). `buildConfig` reicht `captureMode` durch.

## Konsequenzen

- Deterministisch + MP-sicher (Player-Feld via `...rest` serialisiert, `captureMode` im `config`-Snapshot).
- Erste KI-Awareness ist bewusst schlicht (Ziel-Gewichtung). Mögliche Vertiefung später: Hauptstadt
  aktiv verteidigen (Truppen/Posten zurückhalten), gezielte Boote auf Insel-Hauptstädte.
- Noch nicht in `MatchSettings` (MP) — vorerst Solo. MP-Durchreichung offen.
