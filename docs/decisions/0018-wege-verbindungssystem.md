# ADR 0018: Wirtschafts-Verbindungen über echte Land-Wege

## Status

Proposed — in Umsetzung (autonome Session 2026-05-30). Schrittweise, jeder Schritt eigener Commit.

## Datum

2026-05-30

## Kontext

Bisher verbinden sich Wirtschaftsgebäude (Stadt/Hafen/Fabrik) per **Torus-Luftlinie**
(`FACTORY_LINK_RANGE`, Union-Find in `goldBreakdown`/game.ts) — unabhängig von Terrain und
Territorium. Das ignoriert Geografie völlig: zwei Fabriken über offenem Meer „verbinden" sich.

Jonathan möchte ein neues System, in dem Verbindungen **echten Wegen über eigenes Land** folgen,
und diese Wege **sichtbar gezogen** werden. Abgesegnete Designentscheidungen:

- **Verbindung = Weg über eigenes, ZUSAMMENHÄNGENDES Land** (um Wasser/Berge herum). **Brücken
  über Flüsse erlaubt.** Zersplitterte Reiche verlieren Verbindungen.
- **Fabrik als Knoten:** Städte/Häfen hängen an der nächsten über Land erreichbaren eigenen Fabrik;
  Fabriken vernetzen sich transitiv.
- **Ausland nur Fabrik↔Fabrik** (Nähe an der Grenze) — ausländische Städte/Häfen zählen nicht mehr.
- **Gold-Formel bleibt** (je Stadt/Hafen, Deckel, Multiplikatoren) — nur die Verbindungs-Logik
  und das Wege-Rendering sind neu.

## Entscheidung

### Land-Konnektivität (neu)

Eine Verbindung zwischen zwei eigenen Gebäuden existiert, wenn ein Pfad über **eigene
passierbare Tiles** (4-connected) sie verbindet, wobei **Brücken** schmales Wasser überspannen.

- **Brücken-Heuristik (statt Fluss-Bit):** Flüsse haben kein eigenes Terrain-Bit. Eine Brücke
  verbindet zwei eigene Land-Tiles, wenn dazwischen in gerader Richtung höchstens
  `BRIDGE_SPAN` (≈ 4) Wasser-Tiles liegen. So werden Flüsse (≥2 breit) und schmale Engen
  überspannt, offenes Meer nicht. Terrain-unabhängig, deterministisch.
- Berechnung: **eine globale Owner-Komponenten-Flood** über die Karte (4-Nachbar-Kanten zwischen
  Tiles GLEICHEN Owners + Brücken-Kanten) → `Int32Array` Komponenten-Label. Zwei Gebäude
  verbunden ⟺ gleiche Komponente. Liegt in `world/economy-net.ts` (rein, testbar).

### Gold (Formel unverändert, Verbindungs-Quelle neu)

`goldBreakdown` ersetzt das Luftlinien-Union-Find durch Komponenten-Gleichheit. Pro Fabrik:
`FACTORY_GOLD_PER_DEST × min(verbundene Städte+Häfen, FACTORY_OWN_CAP) × level`. **Ausland:** nur
fremde **Fabriken** in Grenznähe (`factoryForeignContribution` filtert auf `type==='factory'`),
weiter über kurze Luftlinie (Grenznähe), 3× gedeckelt.

### Performance (MP-deterministisch)

`generateGold` läuft **jeden Tick × jeder Spieler** — eine Voll-Flood dort wäre bei bis zu 200
Nationen zu teuer. Lösung:

- Neues serialisiertes Feld **`player.factoryGold`** (Fabrik-Gold-Beitrag/Tick).
- Eine globale Routine `recomputeEconomyNetwork(state)` rechnet **alle `ECONOMY_RECOMPUTE_INTERVAL`
  Ticks** (≈ 15) die Komponenten **einmal** und füllt alle `factoryGold`. `generateGold` nutzt nur
  das Feld (billig).
- Im State (serialisiert) → Snapshots/Reconnect bleiben konsistent, kein cache-vs-frisch-Drift.
  Recompute an festem Tick (`tick % INTERVAL`) → alle Clients rechnen synchron.

### Wege-Rendering (der sichtbare Teil)

`drawBuildingLinks` malt nicht mehr gerade Linien, sondern **die echten Pfade**: pro Verbindung
ein BFS-Pfad über die Komponente (Stadt/Hafen → nächste Fabrik; Fabrik↔Fabrik), als Straße
(Trasse + Mittellinie) gezeichnet, Brücken-Segmente über Wasser leicht abgesetzt. Pfade werden
nur bei sichtbarem Zoom und nur für sichtbare Gebäude berechnet (gecacht pro Frame).

## Umsetzungs-Schritte

1. Auslandsregel: nur fremde Fabriken (`factoryForeignContribution` + Render). Test.
2. `world/economy-net.ts`: Owner-Komponenten mit Brücken. Unit-Tests (Brücke ja/nein, Zusammenhang).
3. `goldBreakdown` + `factoryGold`-Feld + `recomputeEconomyNetwork` + Serialisierung. Tests.
4. Wege-Rendering: Pfade statt Linien.

## Konsequenzen

- Geografie + Territorial-Zusammenhalt zählen real für die Wirtschaft.
- Eine durchschnittene Nation verliert Fabrik-Einkommen → strategischer Tiefgang.
- Etwas teurer (periodische Komponenten-Flood), aber durch Throttling + State-Feld beherrscht.
- Determinismus gewahrt (Integer-Komponenten, fester Recompute-Tick, serialisiertes Feld).

## Offen / Risiken

- `BRIDGE_SPAN` und `ECONOMY_RECOMPUTE_INTERVAL` sind Balance-/Perf-Stellschrauben (justierbar).
- Pfad-Rendering bei sehr großen Komponenten: nur sichtbare Gebäude, pro Frame begrenzt.

## Nachtrag: Inland-Gold fährt physisch über Straßen (Fuhren)

Statt der abstrakten Distanz-Formel (oben) wurde — auf Jonathans Wunsch — das Inland-Gold als
**physische Gold-Fuhren** umgesetzt (analog zum Handelsschiff-System, aber über Land):

- Pro eigener Stadt/Hafen, die über Land eine eigene Fabrik erreicht, **pendelt genau eine Fuhre**
  (`GoldCart` in `core/ships.ts`) zwischen Quelle und Fabrik (Ping-Pong via `dir`). An der Fabrik
  wird `gold` gutgeschrieben, dann kehrt sie um.
- **Nähe-Vorteil emergent:** Langer Weg = lange Rundreise = weniger Anlieferungen/Zeit. Keine
  künstliche Abfall-Formel nötig. `gold = CART_GOLD_PER_LEVEL × Fabrik-Level`, `CART_SPEED` fest.
- **Verwaltung:** `recomputeGoldRoutes` (alle `ECONOMY_RECOMPUTE_INTERVAL` Ticks) berechnet die
  Owner-Land-Komponenten und legt/entfernt Fuhren (gültige behalten ihren Pfad). `advanceGoldCarts`
  bewegt sie jeden Tick. `findLandPath` liefert den Pfad (BFS über die Komponente, inkl. Brücken).
- **Gold-Fluss:** `generateGold` gibt nur noch Sockel + Auslands-Gold (3× fremde Fabriken); das
  Inland kommt lumpig aus den Fuhren-Anlieferungen. Das HUD zeigt die **geglättete** Rate
  (`estimatedCartIncome = Σ gold / Rundreise-Dauer`).
- **MP/Determinismus:** `goldCarts` serialisiert (Snapshots konsistent), `ownerComponents`
  transient (nur Routing/Rendering). Bewegung über Integer-Tiles + feste `CART_SPEED`.
- **Rendering:** `drawBuildingLinks` malt die echten Fuhr-Pfade als Straßen + die fahrenden Karren
  (Gold-Kern); Auslands-Linien bleiben gestrichelte Luftlinien.

Damit entfällt das geplante serialisierte `player.factoryGold`-Feld (die Fuhren SIND der State).
