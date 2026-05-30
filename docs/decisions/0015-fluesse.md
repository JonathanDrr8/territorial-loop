# ADR 0015: Flüsse im Terrain (navigierbares echtes Wasser)

## Status

Umgesetzt (erste Version). Opt-in im Experimentell-Panel (Single-Player) + Lobby-Settings (MP-Host).
Verifiziert: Flüsse münden ins Meer, Fluss-Wasser liegt in derselben Wasser-Komponente wie das
offene Meer (navigierbar); Tests für Determinismus / Mehr-Wasser / Meer-Anbindung.

## Datum

2026-05-30

## Kontext & Ziel

Das Terrain soll optional **Flüsse** bekommen — als echtes Wasser, das die Land-Ausbreitung
unterbricht und **von Schiffen befahrbar** ist (Wasserstraßen ins Landesinnere → Binnen-Häfen
erreichbar, amphibisches Flankieren, natürliche Chokepoints/Grenzen). Inspiriert von OpenFront
(dort dünne, befahrbare Flüsse).

## Entscheidung

**Flüsse sind echtes Wasser**, beim Terrain-Generieren (`generateTerrain`, vor Komponenten-
Labeling/Spawns) in die Karte „gecarved". Dadurch zählt sie **die gesamte vorhandene Wasser-
Maschinerie automatisch als Wasser**: `labelWaterComponents`/`landComponents`, `passableLandCount`
(→ Sieg-%), Schiffs-Pathfinding (`water-path.ts`), Spawn-Platzierung (meidet `!isPassable`).

### Generierung (deterministisch aus dem Seed)

1. **Quellen**: Land-Tiles mit hohem `heightNoise` (Berge/Hügel), zufällig gewählt, mit
   Mindestabstand verteilt. Anzahl skaliert mit Kartengröße.
2. **Bergab tracen**: dem steilsten Gefälle des kontinuierlichen `heightNoise` folgen (8-Nachbarn,
   torus-gewrappt), bis Meer erreicht ODER ein bestehender Fluss (Merge) ODER Sackgasse/Maxlänge.
3. **Nur Flüsse behalten, die das Meer erreichen** (kein Inland-Pooling in v1).
4. **Carven** als 2×2-Block je Pfadpunkt → garantiert ≥2 Tiles breit **und orthogonal
   4-zusammenhängend** (wichtig: Schiffe bewegen sich nur über `neighbors4`; ein diagonal
   „treppender" 1-Tile-Fluss wäre für sie unverbunden).

### Constraints

- Nur bei `continents`/`islands` (brauchen ein Meer zum Entwässern), nicht bei `flat`.
- Breite (Brush) als Parameter; Default ~2 Tiles (robust befahrbar, OpenFront-nah).
- Opt-in über `GameConfig.rivers` / `MatchSettings.rivers` + Schalter im Experimentell-Panel.

## Konsequenzen

- **+** Minimaler Integrationsaufwand: Flüsse = Wasser → Downstream gratis.
- **+** Strategische Tiefe (Chokepoints, Binnen-Schifffahrt), MP-deterministisch.
- **−** Balancing nötig (Anzahl/Breite, keine winzigen Wasser-Komponenten, Spawn-Sicherheit).
- Risiko 1-Tile-Pinch/Diagonal-Disconnect → durch 2×2-Carving + Corner-Fill vermieden.
