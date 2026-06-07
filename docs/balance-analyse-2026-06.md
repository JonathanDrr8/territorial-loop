# Balance-Analyse — Terrain & Economy (2026-06)

Reine Code-Analyse (echte Konstanten + Formeln, mit `datei:zeile`). Keine Balance-
Änderung im Spielcode — nur diese Doku. Stand: Branch `docs/balance-analyse`.

## TL;DR

- **(7) Terrain — Empfehlung: ANPASSEN NEIN (passt).** Terrain greift an **fünf**
  Stellen gleichzeitig ineinander und ist dadurch spürbar, obwohl die einzelnen
  Combat-Faktoren mild sind. Stärkster Hebel ist das **Truppen-Cap-Gewicht
  (Ebene 1.5 vs. Berg 0.5 = roh 3×, nach `^0.6`-Dämpfung effektiv ~1.9× Cap je Tile)**.
  Eroberungs-**Kosten** und -**Tempo** sind je 1.0/1.25/1.5 (Ebene/Hügel/Berg) → ein
  Bergtile kostet zusammengenommen ~2.25× „Truppen-Zeit" wie ein Ebenen-Tile. Dazu
  Wellen-Umfließen (+6 Sortier-Einheiten am Berg) und 3 % unpassierbare Extrem-Berge
  als harte Wände. Kohärentes Bild (Berge sind teurer **und** weniger wert) — kein
  Handlungsbedarf. Optional, falls Berge sich „wehrhafter" anfühlen sollen: `MOUNTAIN_MAG`
  120 → 130–140 (kein Muss).

- **(8) Economy — Empfehlung: ANPASSEN NEIN (passt).** Größenordnungen sind stimmig:
  erste 25k-Stadt/Fabrik nach **~25 s** reinem Grund-Trickle (100/Tick × 10 Ticks/s);
  eine gut vernetzte **Level-1-Fabrik ≈ +26 %**, eine ausgebaute **Level-3-Fabrik
  ≈ +78 %** aufs Einkommen; Handel je Hafen-Level ≈ vergleichbar mit einer Inland-Fuhre.
  Harte Per-Fabrik-Deckel (3 Inland + 2 Ausland) und der **flache, gebiets-unabhängige**
  Grund-Trickle verhindern Snowball zuverlässig — kein Pfad ist zu dominant, keiner zu
  lahm. Einzige (Nicht-Balance-)Empfehlung: die **tote Konstante `FACTORY_GOLD_PER_DEST`
  (config.ts:54)** + der veraltete Kommentar dazu beschreiben das ALTE Pro-Ziel-Modell,
  das vom Fuhren-Modell (ADR-0018/0019) abgelöst wurde — bei Gelegenheit aufräumen.

---

## (7) Wie stark beeinflusst das Terrain die Eroberung?

### Höhenstufen & Verteilung

`src/world/terrain.ts:13-15, 29-38`

| Stufe       | Höhe-Bits | `*_MAG`              | Anteil am Land        |
| ----------- | --------- | -------------------- | --------------------- |
| Ebene       | 0–9       | `PLAINS_MAG = 80`    | ~60 %                 |
| Hügel       | 10–19     | `HILL_MAG = 100`     | `HILL_PCT = 0.25`     |
| Berg        | 20–30     | `MOUNTAIN_MAG = 120` | `MOUNTAIN_PCT = 0.12` |
| Extrem-Berg | 31        | unpassierbar         | `EXTREME_PCT = 0.03`  |

Die meisten Tiles sind also Ebene; die Terrain-Effekte greifen auf einer Minderheit
(~40 %) der Tiles, die 3 % Extrem-Berge wirken wie Wasser (`isPassable`, terrain.ts:55-60).

### Die fünf Stellen, an denen Terrain in die Mathe eingeht

**1) Truppen-Cap-Gewicht (der stärkste Hebel)**
`terrain.ts:73-89` → `game.ts:777, 873, 3029, 3555, 4537`

```
PLAINS_TROOP_WEIGHT   = 1.5
HILL_TROOP_WEIGHT     = 1.0
MOUNTAIN_TROOP_WEIGHT = 0.5
```

Jedes Tile addiert sein Gewicht auf `player.weightedTiles`; daraus kommt der Cap:
`maxTroops(weightedTiles)` (`game.ts:3029`) mit
`MAX_TROOPS_BASE + weightedTiles^0.6 * MAX_TROOPS_PER_TILE` (`config.ts:76-83`).

- **Roher Faktor Ebene : Berg = 1.5 / 0.5 = 3×**, Ebene : Hügel = 1.5×.
- **Effektiv auf den Cap** (wegen `^0.6`-Dämpfung, bei gleicher Tile-Zahl):
  `3^0.6 ≈ 1.93×` (Ebene vs. Berg) bzw. `1.5^0.6 ≈ 1.28×` (Ebene vs. Hügel).

→ Ebenen-Land ist pro Tile fast **doppelt so viel Armee-Cap** wert wie Bergland.
Das ist der klar spürbarste Terrain-Effekt fürs strategische „welches Land lohnt sich".

**2) Eroberungs-Kosten (Truppen-Verlust pro Tile)**
`config.ts:219-238` → `game.ts:3107, 3969`

```
attackerLossPerTile = CONQUEST_COST_FACTOR * density * (mag / PLAINS_MAG)
  CONQUEST_COST_FACTOR = 2 (config.ts:212)
  mag/PLAINS_MAG: Ebene 80/80=1.00 · Hügel 100/80=1.25 · Berg 120/80=1.50
```

- **Faktor Ebene : Berg = 1.5×** (gegen denselben Verteidiger). Heißt: für dieselbe
  Berg-Fläche braucht man 1.5× so viel Reserve wie auf Ebene.
- Gegen Niemandsland: `attackerLoss = mag/5` → Ebene 16 · Hügel 20 · Berg 24 Truppen/Tile
  (`config.ts:234`). Gleiche 1.5×-Spanne.

**3) Eroberungs-Tempo-Drossel**
`game.ts:3881`

```
terrainSlow = PLAINS_MAG / max(PLAINS_MAG, avgFrontMagnitude(front))
  reine Ebene  80/80  = 1.00
  reine Hügel  80/100 = 0.80
  reine Berge  80/120 = 0.667
```

- **Faktor Ebene : Berg = 1.5× langsamer** (≈ 33 % weniger Tiles/Tick an Berg-Fronten).
- **Kombiniert mit (2):** ein Bergtile zu nehmen kostet ~1.5× Truppen **und** dauert
  ~1.5× länger → ~**2.25× „Truppen-Zeit"** vs. Ebene. Das ist der eigentlich gefühlte
  Widerstand von Gebirge.

**4) Wellen-Sortierung (Form, nicht Kosten)**
`game.ts:498, 3922-3923`

```
TERRAIN_WAVE_PENALTY = 0.15
terrainPenalty = (mag - 80) * 0.15  →  Hügel +3 · Berg +6 „Tiles weiter"
```

Verschiebt nur die Reihenfolge, in der Front-Tiles fallen → die Welle **umfließt**
Gebirgszüge sichtbar, statt sie als Diamant zu schlucken. Reiner Form-/Feel-Effekt,
verstärkt sich bei niedrigem Tempo (Default `normal` = 0.3, `TEMPO_TO_SPEED`,
start-menu.ts:99-103 → desaturierte Welle, Terrain prägt die Gebietsform mehr).

**5) Spawn-Aversion**
`game.ts:792, 830`

```
SPAWN_TERRAIN_PENALTY = 0.1
terrainCost = (mag - 80) * 0.1  →  Hügel +2 · Berg +4 „Tiles weiter"
```

Start-Blobs schmiegen sich ans Tiefland, meiden Gebirge. Platzierungs-/Form-Effekt.

**Bonus — stapelt mit Verteidigung (Gebäude, kein reines Terrain):**
`game.ts:1266-1281, 3106, 3968` · `DEFENSE_MAG_MULTIPLIER = 5` (`buildings.ts:149`).
Ein verteidigtes Tile bekommt `mag × 5`. Ein **verteidigter Berg** = `120×5 = 600` →
Eroberungskosten **7.5× Ebene-unverteidigt**. Terrain multipliziert hier den Posten-Effekt.

### Faktoren-Übersicht

| Effekt                               | Ebene | Hügel | Berg  | Spanne Ebene→Berg  |
| ------------------------------------ | ----- | ----- | ----- | ------------------ |
| Cap-Gewicht (roh)                    | 1.5   | 1.0   | 0.5   | **3×**             |
| Cap-Gewicht (effektiv, `^0.6`)       | 1.0   | 0.78  | 0.52  | **~1.9×**          |
| Eroberungs-Kosten/Tile               | 1.00  | 1.25  | 1.50  | **1.5×**           |
| Eroberungs-Tempo                     | 1.00  | 0.80  | 0.667 | **1.5× langsamer** |
| Kosten × Zeit (gefühlter Widerstand) | 1.00  | 1.56  | 2.25  | **~2.25×**         |
| Wellen-Sortier-Penalty               | +0    | +3    | +6    | Form               |
| Spawn-Penalty                        | +0    | +2    | +4    | Form               |
| Extrem-Berg (3 %)                    | —     | —     | —     | harte Wand         |

### Bewertung: spürbar?

**Ja, spürbar — durch das Zusammenspiel, nicht durch eine einzelne große Zahl.**
Die Combat-Einzelfaktoren (1.5×) sind bewusst mild, aber sie kompounden: ein Berg ist
~2.25× zäher (Kosten×Zeit) **und** als eroberte Fläche ~1.9× weniger wert (Cap) — Berge
sind also doppelt unattraktiv, was ein kohärentes, lesbares Terrain-Design ergibt. Dazu
formen Wellen-Umfließen (+6) und 3 % unpassierbare Wände die Expansion sichtbar; bei
Default-Tempo (0.3) ist dieser Form-Effekt zusätzlich verstärkt. Das Design-Ziel
„Terrain formt Expansion" ist erfüllt.

### Empfehlung (7): ANPASSEN — NEIN

Passt. Das Terrain ist spürbar und in sich stimmig. **Kein Handlungsbedarf.**
Optional (nur falls Jonathan möchte, dass Gebirge sich noch wehrhafter anfühlt):
`MOUNTAIN_MAG` 120 → 130–140 (hebt Kosten- und Tempo-Spanne auf ~1.6–1.75× und damit
Kosten×Zeit auf ~2.7–3.0×). Kein Muss — nur ein Spielgefühl-Regler.

---

## (8) Economy-Balance

### Rahmen

- Tickrate: 10 Ticks/s (`SIM_BASE_INTERVAL_MS = 100`, main.ts:93).
- Spieler starten mit **0 Gold** (`game.ts:592`).
- **`matchSpeed` wirkt NICHT auf Gold** — nur auf die Eroberungs-Welle
  (`game.ts:3869-3871`; Kommentar config.ts:166-177). Gold läuft immer mit voller Rate.
- Kein Gold-/Economy-Multiplikator in `GameConfig` (geprüft).

### Konstanten

| Konstante                       | Wert                                                         | Fundstelle           |
| ------------------------------- | ------------------------------------------------------------ | -------------------- |
| `BASE_GOLD_PER_TICK`            | 100 (flach, **gebiets-unabhängig**)                          | config.ts:43         |
| Wilde Nationen                  | × `WILD_GOLD_FACTOR = 0.5`                                   | game.ts:1162         |
| `CART_GOLD_PER_LEVEL`           | 150 (Gold je Anlieferung × Fabrik-Level)                     | ships.ts:78          |
| `CART_SPEED`                    | 0.5 Tiles/Tick                                               | ships.ts:72          |
| `FACTORY_CART_LIMIT`            | 3 (Inland-Quellen je Fabrik)                                 | game.ts:3279         |
| `FACTORY_FOREIGN_MULT`          | 3× Gold für Auslands-Fuhren                                  | game.ts:1216         |
| `FACTORY_FOREIGN_CAP`           | 2 (Auslands-Ziele je Fabrik)                                 | game.ts:1222         |
| `FACTORY_LINK_RANGE`            | 40 Tiles (Luftlinie)                                         | config.ts:53         |
| `TRADE_GOLD_BASE` / `_PER_TILE` | 300 + 12 × Dist                                              | ships.ts:25-27       |
| `TRADE_INTERVAL_TICKS`          | 120 (Sende-Fenster je Hafen)                                 | ships.ts:23          |
| `TRADE_SHIP_SPEED`              | 1 Tile/Tick                                                  | ships.ts:21          |
| Hafen-Level                     | = Anzahl Schiffe je Fenster                                  | game.ts:3198         |
| `BASE_BUILD_COST`               | Stadt/Verteidigung/Hafen/Fabrik 25k; Flughafen 50k; Flak 35k | buildings.ts:70-79   |
| Eskalation                      | × 2 je weiterem Gebäude der Gruppe                           | buildings.ts:116-128 |
| `BUILD_COST_CAP`                | 100k                                                         | buildings.ts:83      |
| Kosten-Gruppe Hafen+Fabrik      | geteilt (`COST_GROUP`)                                       | buildings.ts:91-98   |
| `upgradeCost`                   | `buildPrice × (level+1)`                                     | buildings.ts:136-139 |
| `CITY_CAP_BONUS`                | +25k Cap je Stadt-Level                                      | buildings.ts:144     |
| `WARSHIP_COST`                  | 100k                                                         | ships.ts:33          |

### Durchgerechnete Größenordnungen

**Grund-Trickle:** 100/Tick × 10 Ticks/s = **1.000 Gold/s = 60.000/min**, für jeden
gleich (egal wie groß). → Erste **25k**-Stadt/Fabrik nach **250 Ticks ≈ 25 s** reinem
Trickle. Schnell genug für einen zügigen Eröffnungs-Build, ohne Leerlauf.

**Fuhren-Einkommen (die zentrale Formel):** Eine Fuhre schreibt `gold` nur bei
Ankunft an der Fabrik gut und pendelt dann zurück → eine Anlieferung je voller
Rundreise. Bei `CART_SPEED = 0.5` dauert die Rundreise `4 × steps` Ticks (steps =
Land-Pfad-Kanten). Damit:

```
Rate je Fuhre = gold / (4 × steps)  Gold/Tick     (game.ts:3534 / 1245 bestätigt)
```

**Inland-Fabrik (Level 1, Quellen ~6 Land-Schritte entfernt):**

- je Inland-Fuhre: `150 / (4×6) ≈ 6.25/Tick`; bis zu 3 Quellen → **~18.75/Tick**.
- 2 Auslands-Fuhren (`gold = 3×150 = 450`, ~30 Schritte): `2 × 450/(4×30) = 7.5/Tick`.
- **Summe L1 ≈ 26/Tick ≈ +26 %** über dem Grund-Trickle.

**Fabrik Level 3** (Gold ×3 je Fuhre):

- Inland: `3 × 450/(4×6) ≈ 56/Tick`; Ausland: `2 × 1350/(4×30) ≈ 22.5/Tick`.
- **Summe L3 ≈ 78/Tick ≈ +78 %**. Eine maxte Fabrik **verdoppelt** das Einkommen fast.

**Handel (Hafen, ~50-Tile-Wasserroute):** `tradeGold = 300 + 12×50 = 900`, an **beide**
Hafen-Besitzer (game.ts:3229-3250). 1 Schiff je 120 Ticks je Level →
`900/120 = 7.5/Tick je Level` als Sender, **plus** reziprokes Gold als Ziel anderer
Routen. → grob auf dem Niveau einer Inland-Fuhre pro Einheit, mit Bündnis-Bonus
(erzeugt Gunst, game.ts:3252-3258).

**Bau-/Upgrade-Pfad:**

- Stadt-Gruppe eigenständig: Stadt 25k → 50k → 100k (3. und weitere 100k, Deckel).
- Hafen+Fabrik **gemeinsame** Gruppe: 1. Gebäude (Hafen ODER Fabrik) 25k, 2. = 50k, 3. = 100k → das frühe „Entweder-Oder".
- Upgrade skaliert am echten Baupreis: eine zu 25k gebaute Fabrik kostet +50k (→L2),
  +75k (→L3) = **150k** für Level 3 (≈ 2.5 min Trickle). Eine zu 100k gebaute Fabrik
  kostet +200k/+300k — Upgrades teurer Gebäude werden bewusst steil.

### Bewertung: stimmig?

**Ja.** Die Größenordnungen passen und die Anti-Snowball-Architektur greift sauber:

- **Kein Pfad zu dominant.** Der Grund-Trickle ist **flach und gebiets-unabhängig** —
  eine Riesen-Nation verdient pro Tick exakt so viel wie ein Zwerg. Skalierung läuft
  nur über Gebäude, und die sind hart gedeckelt (3 Inland + 2 Ausland je Fabrik,
  Bau-Deckel 100k, geteilte Hafen/Fabrik-Eskalation). Auslands-Fuhren (3×) klingen
  stark, sind aber auf 2 begrenzt **und** brauchen eine nahe fremde Fabrik + Land-Weg.
  Wer mehr will, muss viele Fabriken bauen (jede ab der 2. teuer) → kosten-gegated.
- **Kein Pfad zu lahm.** 25 s bis zum ersten Bau, Fabriken +26…+78 %, Handel
  vergleichbar. Die langsamen Fuhren (`CART_SPEED 0.5`) halbieren zwar den Durchsatz
  (bewusst, für Sichtbarkeit), aber das Einkommen bleibt im sinnvollen Bereich.
- Risiko liegt eher beim **Gegenteil** (Economy könnte sich „flach" anfühlen, weil
  territoriale Dominanz das Einkommen nicht direkt erhöht) — das ist aber die bewusste
  Design-Entscheidung aus ADR-0008 und gehört nicht „korrigiert".

### Empfehlung (8): ANPASSEN — NEIN

Economy passt. Keine Balance-Änderung empfohlen.

**Nicht-Balance-Aufräumung (optional, separat):** `FACTORY_GOLD_PER_DEST = 6`
(config.ts:54) ist **tot** — nirgends mehr referenziert (das Pro-Ziel-pro-Tick-Modell
wurde vom Fuhren-Modell ADR-0018/0019 abgelöst). Der zugehörige Kommentar
(config.ts:45-54) beschreibt noch das alte Modell und ist irreführend. Bei Gelegenheit
Konstante + Kommentar entfernen/aktualisieren (kein Balance-Eingriff).

---

## Methodik-Notiz

Alle Zahlen stammen aus dem Quellcode (Konstanten + Formeln, Stand Branch
`docs/balance-analyse`). Die Fuhren-Rate `gold/(4×steps)` wurde gegen beide
Implementierungen verifiziert (`estimatedCartIncome` game.ts:3534, `factoryYield`
game.ts:1245) — beide ergeben identisch `gold × CART_SPEED / (2 × oneWay)`.
Distanz-Annahmen (6 Schritte inland, 30 Schritte Ausland/50 Tiles Handel) sind
plausible Mittelwerte; die Schlussfolgerungen (Snowball-Deckelung, Größenordnungen)
hängen nicht an den exakten Distanzen.
