# ADR-0033: Städte als wachsende Siedlungen

**Status:** Accepted — Scheiben 1 (Stufen + Sprites) + 2 (Mindestabstand + Radius-Ring) umgesetzt & released (0.58.0, 2026-06-07); Scheibe 3 (Politur „zu nah"-Tönung) optional offen.
**Bezug:** baut auf ADR-0031 (A2-Gold-Senke: Städte bis Level 6, verdoppelnde Kosten — bereits umgesetzt).

## Kontext

A2 (ADR-0031) macht Städte über Level 3 hinaus aufrüstbar (bis 6, Kosten verdoppeln sich, je +25k
Truppen-Cap) — als Gold-Senke. Die Arena-Validierung zeigte: A2 allein stopft das KI-Gold-Horten
nicht (das ist die separate KI-Rework-Sache, ADR-0032). **Aber A2 ist ein gutes Spieler-Feature für
sich** — und Jonathan will daraus eine sichtbar **wachsende Siedlung** machen: eine Stadt startet als
Dorf und wächst über die Stufen zur Metropole, mit angepasstem Sprite. Dazu: Städte sollen einen
**Mindestabstand** zueinander haben (kein Cluster-Spam), und dieser **Radius** wird angezeigt.

Festgelegt (mit Jonathan, 2026-06-07): gold-getrieben (kein Gratis-Wachstum über Zeit); **direkt**
rein (nicht experimentell); benannte Stufen + wachsende Sprites; Mindestabstand + Radius-Anzeige.

## Entscheidung / Spec

### 1. Gold-getriebenes Leveln (bereits umgesetzt, A2)

Bleibt wie in ADR-0031: `MAX_CITY_LEVEL = 6`, `upgradeCost` verdoppelt sich ab Level 3
(`base×3×2^(level-2)` → Standard-Stadt 150k/300k/600k), je Stufe +25k Cap (`cityCapBonus`).
**Kein** Wachsen über Zeit.

### 2. Benannte Stufen (Dorf → Metropole)

Stadt-Level → Siedlungsname (statt generisch „Stadt"):

| Level | Name (de)  |
| ----- | ---------- |
| 1     | Dorf       |
| 2     | Kleinstadt |
| 3     | Stadt      |
| 4     | Großstadt  |
| 5     | Metropole  |
| 6     | Weltstadt  |

- Neuer Helfer `cityStageKey(level)` → i18n-Key `citystage.dorf` … `citystage.weltstadt`.
- Anzeige überall, wo heute „Stadt Lvl X" steht: Hover-Panel/Tooltip (`hover-content.ts`),
  Bau-/Radialmenü (`build-menu.ts`), Ereignislog-Bau-Meldungen. Der Bau-**Knopf** bleibt „Stadt"
  (man baut immer ein Dorf, das dann wächst) — nur das gebaute/aufgerüstete Objekt trägt den
  Stufennamen.
- **i18n:** 6 Keys in allen 9 Sprachen.

### 3. Wachsendes / angepasstes Sprite je Stufe

Sprites sind prozedural (`SpriteDef`: Zeichengrid + Palette in `renderer.ts`). Pro Stufe ein eigenes
City-Sprite (Dorf = einzelne Hütte → höhere Stufen = mehr/höhere Gebäude, Metropole = Skyline).
`getBuildingSprite` wird um das Level erweitert (`getCitySprite(level)`, eigener Cache je Stufe).
Zusätzlich darf der Marker-Radius leicht mit der Stufe wachsen (Dorf kleiner, Weltstadt größer), damit
der Größenunterschied auch rausgezoomt lesbar ist. **Reine Darstellung — kein Sim-/Determinismus-Einfluss.**

### 4. Mindestabstand zwischen Städten + Radius-Anzeige

- **Bau-Regel (core, deterministisch):** Eine neue Stadt darf nicht innerhalb von `CITY_MIN_DISTANCE`
  (Torus-Distanz, Vorschlag **8 Tiles**, tunebar) zu einer bestehenden eigenen Stadt stehen. Greift in
  `canBuildAt`/`placeBuilding` (analog zum bestehenden `factorySourceTooClose`). Gilt für Mensch **und**
  KI; die KI-Stadtplatzierung (`pickInteriorTile` in `ai.ts`) respektiert den Abstand.
- **Radius-Anzeige (render):** Im Stadt-Bau-Modus + beim Hover über eine Stadt einen Ring mit Radius
  `CITY_MIN_DISTANCE` zeichnen (wie der Verteidigungs-Reichweiten-Ring), damit man die „Sperrzone" sieht.
  Im Bau-Vorschau-Modus: Ring am Cursor + ggf. rote Tönung, wenn zu nah an einer bestehenden Stadt.

### 5. Rollout

Direkt als reguläres Feature (kein Experimentell-Flag). Da die Bau-Regel (Mindestabstand) Sim-relevant
und damit MP-deterministisch ist, gilt sie für alle gleich — kein Opt-in nötig.

## Determinismus / MP

- Stufennamen + Sprites + Radius-Ring sind reine Darstellung (kein State).
- Mindestabstand ist **core/deterministisch** (Integer-Torus-Distanz, kein `Math.random`/`Date.now`) →
  für alle Clients identisch, MP-sicher.

## Umsetzung in Scheiben

1. **Sichtbar zuerst:** benannte Stufen (i18n) + wachsende City-Sprites + Marker-Größe je Level.
   → Feel-Test: eine Stadt hochrüsten, sieht man sie wachsen + den Namen wechseln?
2. **Mindestabstand** (core-Regel + KI-Platzierung) + **Radius-Ring** (Bau-Vorschau/Hover).
3. Politur (rote Tönung „zu nah", Balance-Feinschliff Abstand/Kosten), Release.

## Offen (vor/bei Umsetzung zu bestätigen)

1. **Stufennamen** wie oben ok? (insb. Level 6 „Weltstadt" vs. „Megalopolis").
2. **CITY_MIN_DISTANCE = 8 Tiles** — passt, oder enger/weiter? (skaliert nicht mit Kartengröße; fix in Tiles.)
3. Marker-Wachstum: nur Sprite-Detail, oder auch spürbar größerer Marker je Stufe?

## Verifikation

| #   | Was                   | Test                                      | Erwartet                                     |
| --- | --------------------- | ----------------------------------------- | -------------------------------------------- |
| 1   | Stufennamen-Mapping   | Unit: `cityStageKey(1..6)`                | `citystage.dorf` … `citystage.weltstadt`     |
| 2   | i18n vollständig      | `grep citystage. src/i18n/*.ts`           | 6 Keys × 9 Sprachen                          |
| 3   | Mindestabstand greift | Unit: 2. Stadt < 8 Tiles → `build`-Intent | wird abgelehnt (keine 2. Stadt)              |
| 4   | Abstand ≥ 8 ok        | Unit: 2. Stadt ≥ 8 Tiles entfernt         | Stadt wird gebaut                            |
| 5   | Sprite je Stufe       | Playwright: Stadt L1 vs L6                | sichtbar unterschiedlich/größer (Screenshot) |
| 6   | Radius-Ring           | Playwright: Stadt-Bau-Modus               | Ring am Cursor sichtbar                      |
| 7   | Regression            | `typecheck && lint && test:run`           | grün                                         |

Manuell (Jonathan): Stadt von Dorf zu Weltstadt hochziehen — fühlt sich das Wachsen gut an? Abstand
nervig oder sinnvoll? Radius-Ring verständlich?
