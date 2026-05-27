# ADR 0004: OpenFront-Mechaniken 1:1 als MVP-Baseline übernehmen

## Status

Accepted

## Datum

2026-05-27

## Kontext

`territorial-loop` ist mechanisch stark an OpenFront.io angelehnt — Jonathan mag dort
das Spielgefühl, das Alleinstellungsmerkmal soll nur der **Torus-Wrap** sein. Wir
haben die Wahl:

1. **Eigene Mechaniken entwickeln** (Bevölkerungs-Wachstum, Kampf-Resolution, Tiles-pro-Tick, etc.)
2. **OpenFront-Formeln als Inspiration** nehmen und stark vereinfachen
3. **OpenFront-Formeln 1:1 übernehmen** als MVP-Baseline und nur bei tatsächlichen Problemen anpassen

Wir haben OpenFronts Source-Code recherchiert und konkrete Formeln/Werte extrahiert (Memory `openfront-mechanics-notes`).

## Entscheidung

**Option 3 — OpenFront-Formeln 1:1 als MVP-Baseline.**

Konkret übernommen:

- **Truppen-Cap:** `2 * (numTiles^0.6 * 1000 + 50000) + sum(cityLevel) * 250000`
  _(City-Term im MVP irrelevant, da keine Cities — bleibt 0)_
- **Wachstums-Formel:** `troopIncrease = (10 + troops^0.73 / 4) * (1 - troops/maxTroops)`
- **Default-Slider:** 20% (für Mensch und KI im MVP)
- **Tiles-pro-Tick beim Angriff:** `clamp(5*att/def*2, 0.01, 0.5) * adjFrontier * 3` (gegen Spieler) bzw. `* 2` (gegen TerraNullius)
- **Verlust-Formel:** wie in `openfront-mechanics-notes` dokumentiert, inkl. Plains-Mag=80
- **Start-Truppen:** 25.000 (Mensch), 10.000 (Bot)
- **Tick-Rate:** 10 Hz

Nicht übernommen im MVP (bewusst entfernt):

- Worker/Gold-System (OpenFront hat es nicht, Bestätigung)
- Cities, DefensePosts (keine Gebäude im MVP)
- Boats (kein Wasser im MVP)
- Nuclear Fallout
- KI-Difficulty-Multiplier (nur eine KI-Stärke)
- Mountain/Highland/Plains-Variation (im MVP eh nur Plains)
- Anti-Zerg-Debuffs für >100k Tiles (bei unseren Map-Größen nicht relevant)

## Begründung

### Erprobt

OpenFront hat tausende Spielstunden Balance-Testing durchlaufen. Die Formeln funktionieren — Snowball ist gebremst (sublinearer Cap), Wachstum ist befriedigend (Power-Law in `^0.73`), Kampf hat taktische Tiefe (Defender hat Boden-Vorteil über `mag`-Faktor).

### MVP-Ziel

Das Risiko des MVPs ist die **Torus-Mechanik**, nicht das Balance-Tuning. Wenn wir eigene Formeln entwickeln, verbringen wir Wochen mit Balance statt mit dem Validieren der eigentlichen Hypothese. Mit OpenFront-Werten als Baseline können wir sofort spielen.

### Anpassbarkeit

Die Formeln sind in `core/config.ts` als reine Funktionen zentral. Tuning später ist trivial (Konstante ändern, Speed-up testen). Wir verbauen uns nichts.

### Torus-Effekt isolieren

Wenn das Spiel sich auf dem Torus anders anfühlt, wollen wir wissen: liegt's am Wrap oder an unseren Mechaniken? Mit identischen Mechaniken zu OpenFront ist die Antwort eindeutig.

### Rechtliches

OpenFront ist AGPL v3. Wir nutzen die **Formeln** als Inspiration und implementieren neu — keine Code-Kopie. Konkrete Zahlen sind nicht copyrightable. Sicher.

## Konsequenzen

- **Vorteil:** Schneller MVP, kein Balance-Aufwand
- **Vorteil:** Klares Vergleichs-Spiel (Torus on/off testbar)
- **Vorteil:** Wenn Formeln nicht passen wegen Torus-Topologie, wissen wir's sofort
- **Nachteil:** Spiel wirkt initial wie "OpenFront mit Loop" — das ist aber genau das Konzept
- **Nachteil:** Wir lernen weniger über Game-Design-Tuning — können wir aber nachholen wenn MVP steht

## Alternativen verworfen

- **Eigene Mechaniken:** zu hoher Aufwand für MVP, falsche Reihenfolge der Risiko-Validierung
- **Vereinfachte Mechaniken:** würden das Spielgefühl von OpenFront das Jonathan mag verlieren — wir wissen nicht welche Teile der Komplexität für das Feel verantwortlich sind

## Reviewdatum

Nach dem ersten Playtest. Wenn das Spiel sich auf dem Torus signifikant anders anfühlt
(zu schnell, zu langsam, zu ungerecht), tunen wir die Konstanten. Strukturell bleibt
die Formel-Familie aber, bis ein klarer Grund für Wechsel auftritt.
