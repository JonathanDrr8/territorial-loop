# ADR 0016: Karten aus Geodaten (gebackene Real-Welt-Maps)

## Status

**Proposed (Plan, noch nichts umgesetzt).** Alternative/Ergänzung zur prozeduralen Generierung
(ADR-0003/0015). Auf Jonathans Wunsch (2026-05-30): „Maps aus Geodaten ableiten wie OpenFront."

## Kontext & Ziel

Unsere prozeduralen Flüsse/Küsten sind okay, aber nie so natürlich wie echte Geografie. OpenFront
hat das Problem nicht, weil deren Karten aus realen Geodaten stammen. Ziel: eine Handvoll
**kuratierter, aus echten Höhen-/Tiefendaten gebackener Karten** als wählbare Alternative —
schöne Küsten, Gebirge und (später) Flüsse „umsonst", deterministisch und MP-tauglich.

**Nicht-Ziel (vorerst):** vollautomatischer Welt-Generator aus beliebigen Koordinaten; Live-Download
von Geodaten im Spiel. Wir backen **offline** ein paar Karten und liefern sie als Assets.

## Entscheidung (Architektur)

### 1. Datenquelle: ETOPO (NOAA) bzw. GEBCO

Globales Relief-Grid **inklusive Bathymetrie** (Ozeantiefe). Vorteile:

- **Land/Wasser kommt direkt aus dem Vorzeichen** der Höhe (> 0 = Land, ≤ 0 = Wasser) — kein
  separater Wassermaske-Datensatz nötig.
- 15-Bogensekunden-Auflösung (ETOPO) ist für unsere 512²–1024²-Karten mehr als genug.
- **Public Domain** (NOAA, US-Behörde) → ohne Lizenz-Sorgen ausgelieferbar. (GEBCO als Alternative,
  ähnliche Lizenz; SRTM nur Land, deshalb ETOPO bevorzugt.)
- Flüsse/Seen später aus **Natural Earth** (Public Domain, Vektor-Flusslinien).

### 2. Offline-Bake-Pipeline (`scripts/bake-map.ts`, nur Dev)

Manuell ausgeführtes Node-Skript, das aus einem Relief-Raster eine fertige Karte in **unserem
Tile-Format** erzeugt:

1. **Eingabe:** ein Relief-Ausschnitt (GeoTIFF/PNG-Graustufen, Höhe = Pixelwert) für eine
   Region (Lat/Lon-Bounding-Box). Pro Karte ein vorbereiteter Ausschnitt.
2. **Downsamplen** auf die Zielgröße (z. B. 768² oder 1024²), Seitenverhältnis der Region wahren
   oder bewusst auf quadratisch zuschneiden.
3. **Klassifizieren** pro Tile → `terrain[i]` (Uint8, bestehendes Layout, ADR-0015):
   - Höhe ≤ Meeresspiegel → **Wasser** (`0`).
   - sonst Höhenstufe aus der Land-Elevation (Perzentil ODER feste Bänder, z. B. >2500 m =
     Extrem-Berg `31` = unpassierbar; abgestimmt auf unsere ~3 % Extrem/12 % Berg/25 % Hügel).
4. **Ozean-Rahmen erzwingen** (siehe Torus unten): die äußersten N Tiles am Rand auf Wasser setzen,
   falls die Region nicht ohnehin meer-umrandet ist.
5. **Encodieren** als kompaktes Asset (siehe unten) → `public/maps/<id>.bin`.

Dev-Dependency: ein GeoTIFF/PNG-Decoder (z. B. `geotiff` / `pngjs`) — **nur** für das Skript, nicht
im Spiel-Bundle.

### 3. Der Knackpunkt: Torus-Naht

Unsere Welt wrappt **rundum** (links↔rechts UND oben↔unten, kein Rand). Reale Karten sind nicht
toroidal → an den Wrap-Kanten passt die Geografie nicht zusammen (sichtbare Naht).

**Entscheidung: meer-umrandete Ausschnitte + Sim bleibt toroidal.** Wir kuratieren Regionen so,
dass **alle vier Ränder offenes Wasser** sind (im Bake-Schritt notfalls erzwungen). Dann ist der
Wrap **Wasser-zu-Wasser** → keine sichtbare Land-Naht, und gameplay-technisch harmlos (Einheiten
queren Wasser ohnehin nur per Boot; ein gewrappter Seeweg ist selten und unkritisch). **Kein
Eingriff in die Sim** (Torus-Distanz/Wrap-Arithmetik bleibt) — das ist der entscheidende Vorteil
dieser Variante.

Verworfene Alternativen: Ränder spiegeln/blenden (verzerrt Geografie, hässlich); echter
Nicht-Torus-Modus mit harten Rändern (großer Sim-Umbau, widerspricht der Torus-Kern-Identität).

### 4. Integration ins Spiel

- **`GameConfig`**: neues optionales Feld `mapId?: string`. Ist es gesetzt, lädt `createGame`
  die gebackene Karte statt `generateTerrain` aufzurufen.
- **Laden:** `terrain` wird aus dem Asset dekodiert (fetch → Uint8). Höhen/Land/Wasser sind drin;
  `waterComponents`/`landComponents`/`passableLandCount`/Spawns laufen unverändert darüber.
- **Menü:** der „Karten-Typ"-Dropdown bekommt zusätzlich die kuratierten Geo-Maps (z. B.
  „Mittelmeer", „Karibik", „Japan"). Intern: `terrain: 'geo'` + `mapId`, oder direkt `mapId`.
- **MP-Determinismus (wichtig):** die Karte ist ein **statisches Asset**, das mit Client **und**
  Server ausgeliefert wird. Der Server broadcastet nur die `mapId`; alle laden dasselbe Asset →
  bit-identisches Terrain. **Einfacher als prozedural** (keine Generierung). Snapshots/Reconnect
  serialisieren `map.terrain` ohnehin voll — funktioniert unverändert.

### 5. Asset-Format

`terrain` ist 1 Byte/Tile, niederentropisch → gut komprimierbar. Optionen:

- **PNG** (R-Kanal = terrain-Byte): standard-dekodierbar im Browser, ~klein durch PNG-Kompression.
- **gzip der rohen Uint8** + `fetch`+`DecompressionStream`: noch kleiner.

Größe grob: 768² = 590 KB roh → komprimiert ~50–150 KB je Karte (Land/Wasser-Flächen komprimieren
stark). Mehrere Karten = wenige hundert KB Assets — vertretbar.

## Phasen

1. **Phase 1 — Küsten + Höhen.** Bake-Skript + Lade-Pfad + 2–3 kuratierte Karten (meer-umrandet),
   ohne Flüsse. Schon das (echte Küsten/Gebirge) ist der Hauptgewinn.
2. **Phase 2 — Flüsse aus Vektordaten.** Natural-Earth-Flusslinien rastern (2-Tile breit,
   4-zusammenhängend wie ADR-0015) und in die gebackene Karte carven → echte, perfekt mäandernde
   Flüsse.
3. **Phase 3 — Kuratierter Pool / Auswahl-UI.** Mehr Karten, Vorschau-Thumbnails; verzahnt mit der
   [[feature-idea-map-rating]]-Idee (Community-Bewertung/Pool).

## Offene Fragen (vor Phase 1 klären)

- **Höhen-Mapping:** feste Höhenbänder (Meter) oder Perzentil je Karte? (Perzentil hält das Verhältnis
  Ebene/Hügel/Berg stabil, feste Bänder sind geografisch ehrlicher.)
- **Welche Regionen zuerst?** Vorschlag: Mittelmeer, Karibik, Japan/Ostasien, Schwarzes Meer,
  Britische Inseln — alle natürlich meer-umrandet, gut spielbare Land/Wasser-Mischung.
- **Kartengröße fix oder pro Karte?** (Manche Regionen sind eher breit als quadratisch.)

## Konsequenzen

- **+** Natürliche Küsten/Gebirge/(später)Flüsse ohne prozedurale Tricks; MP-Determinismus trivial.
- **+** Erweiterbar (neue Karte = neues Asset, kein Code).
- **−** Offline-Tooling + kuratierte Daten-Pipeline (einmaliger Aufwand ~½–1 Tag für Phase 1).
- **−** Torus-Naht nur via meer-umrandete Ausschnitte umschiffbar → schränkt wählbare Regionen ein.
- Prozedurale Generierung (continents/islands) bleibt parallel bestehen — Geo-Maps sind eine
  zusätzliche Option, kein Ersatz.

## Verwandt

[[feature-idea-geodata-maps]] (Memory), ADR-0015 (Flüsse/Tile-Format), ADR-0003 (Determinismus),
ADR-0009 (MP — Asset-by-ID statt Broadcast), [[feature-idea-map-rating]].
