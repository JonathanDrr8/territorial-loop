# ADR 0006: Mechanik-Tiefe — Wirtschaft, Gebäude, Terrain, Schiffe, Diplomatie

## Status

Accepted

## Datum

2026-05-28

## Kontext

Nach dem MVP spielte sich `territorial-loop` wie ein reiner OpenFront-Klon: Klick →
Welle expandiert, sonst nichts. Jonathan wollte **strategische Tiefe** statt weiterer
Politur. In einer Planungsrunde wurden fünf Mechanik-Säulen samt konkreter
Design-Parameter abgestimmt. Dieses ADR hält die Entscheidungen und ihre Begründung
fest, damit spätere Sessions die Trade-Offs nachvollziehen können.

## Entscheidung

### Terrain-Höhen (4 Stufen)

Das `terrain`-Byte trägt Bit 7 `IS_LAND` und in den Bits 0-4 die Höhe (Magnitude).
Vier Klassen: Ebene / Hügel / Berg / Extrem-Berg (Höhe 31 = unpassierbar wie Wasser).
Verteilung ≈ 60/25/12/3 % auf Land-Tiles (tunebar). Begehbarkeit überall via `isPassable`
statt `isLand`. Höheres Terrain wirkt dreifach:

1. **Kampf-Kosten:** höhere Magnitude (80/100/120) → mehr Angreifer-Verlust pro Tile.
2. **Eroberungs-Tempo & -Form:** die pro Tick eroberten Tiles werden im Verhältnis
   Ebene/Front-Magnitude gedrosselt, und die Wave-Sortierung gibt höherem Terrain einen
   Distanz-Aufschlag — die Welle umfließt Erhebungen, statt sie als sauberen Diamant zu
   nehmen. So zeichnet sich Terrain in der Gebietsform ab.
3. **Truppen-Cap:** der Cap hängt an einer terrain-gewichteten Tile-Summe (`weightedTiles`):
   Ebene 1.5 · Hügel 1.0 · Berg 0.5. Plains-reiche Nationen tragen mehr Bevölkerung;
   Berge sind karg. `tilesOwned` (reine Anzahl) bleibt Basis für Gebiets-% und Sieg.

**Indikatoren:** neutrales Land nutzt eine gestufte Terrain-Palette, eigenes/fremdes
Gebiet ein Höhen-Relief (Ebene abgedunkelt, Berge hell + Richtung Fels getönt).

### Gold-Wirtschaft (flach pro Spieler)

Gold ist ein **flacher** Betrag pro Tick (`BASE_GOLD_PER_TICK = 100`), **nicht** pro Tile.
Zusätzliche Quellen: Markt-Gebäude und Handelsschiffe. Bewusster Balance-Trade-off:
kleine Nationen sind gold-effizient pro Fläche (können sich zum „Igel" mit Verteidigung/
Upgrades ausbauen), große Nationen haben Truppen-Übermacht aber an vielen Fronten keine
Ruhe für Wirtschaft. Kein Worker/Soldier-Split — alles kostet dieselbe Gold-Währung.

### Gebäude (mit Upgrades)

`core/buildings.ts`. Vier Typen, je bis Level 3, eskalierende Baukosten (`base·2^n`),
lineare Upgrade-Kosten (`base·(level+1)`):

- **Stadt** — erhöht den Truppen-Cap (`CITY_CAP_BONUS` pro Level).
- **Markt** — Gold/Tick (`MARKET_GOLD_PER_TICK` pro Level).
- **Verteidigungsposten** — Tiles in Reichweite verteidigen zäher (Magnitude ×5,
  stapelt mit Terrain); Range wächst pro Level.
- **Hafen** — Voraussetzung für Handelsschiffe, nur nahe Wasser baubar.

Bedienung: Hotkeys Q/W/E/R für den Bau-Modus (Linksklick platziert) sowie ein
Kontextmenü per Rechtsklick (ohne Drag) auf einem eigenen Tile.

### Schiffe

`core/ships.ts` + `world/water-path.ts`. Wasser-Zusammenhangskomponenten werden einmalig
gelabelt (O(1)-Routen-Existenz), konkrete Routen via A\* (Torus-aware, neighbors4).

- **Transport-Boot:** Ein Linksklick-Angriff auf eine über Wasser getrennte Landmasse
  wird vom **Core** automatisch zu einem Boot (kein eigener Intent, keine Input-Sonderlogik):
  `landComponents` entscheiden, ob das Ziel über Land erreichbar ist. Boot nimmt
  `BOAT_TROOP_FRACTION` (20 %) der Truppen mit, max 3 pro Spieler, landet als Brückenkopf
  und startet von dort einen normalen Angriff. Kein Hafen nötig (startet vom Ufer).
- **Handelsschiff:** Häfen senden gestaffelt Schiffe zu erreichbaren fremden Häfen; bei
  Ankunft erhalten **beide** Hafen-Besitzer Gold proportional zur Reisedistanz.

### Diplomatie

`core/diplomacy.ts`. Beziehungen als Zahlen-Schlüssel in Sets (ungeordnet für Allianzen,
gerichtet für Anfragen/Embargos).

- **Allianz:** Anfrage + Annahme (beidseitige Anfrage schließt sofort). Angriffe zwischen
  Verbündeten sind blockiert. (Geteilte Sicht ist ohne Fog-of-War ein No-Op.)
- **Verrat:** `break-alliance` wirkt sofort, ächtet den Verräter aber `AECHTUNG_DURATION_TICKS`
  (300) lang: Angreifer-Verluste gegen ihn werden halbiert (`TRAITOR_DEFENSE_PENALTY = 0.5`)
  — **außer** gegen Nationen, die er selbst gerade angreift. Anreiz: erst verraten, wenn
  man den Verratenen sofort überrollen kann.
- **Embargo:** einseitig verhängbar, ruht den (beidseitig profitablen) Handel komplett.
- **Sieg:** unverändert pro Einzelspieler — Allianzen sind nur taktisch, am Ende muss man
  verraten.

### KI

Die KI (`ai/ai.ts`) nutzt alle Mechaniken: gold-gated Bauen (Markt → Stadt → Verteidigung →
Hafen), amphibische Angriffe (über entfernte Ziele, Core macht das Boot), und Diplomatie
(gegen den Stärksten verbünden, bei klarer Führung verraten). Difficulty-Profile skalieren
Bau-/Diplomatie-/Boot-Neigung und die Verrats-Schwelle.

## Begründung

- **Flaches Gold** ist die zentrale Balance-Stellschraube für das „kleine Nation, starke
  Wirtschaft"-Fantasy, die Jonathan explizit wollte — und einfacher zu balancieren als
  Pro-Tile-Erträge, die große Nationen automatisch reicher machen.
- **Boot-Entscheid im Core statt im Input**: hält die Input-Schicht dumm (emittiert immer
  nur `attack`) und macht KI-Amphibien-Angriffe geschenkt — die KI muss nichts über Wasser
  wissen, sie zielt nur auf ein entferntes Tile.
- **Verrats-Ächtung statt Verrats-Verbot**: erlaubt das dramatische „Stich in den Rücken",
  ohne dass es folgenlos-optimal wird; das Zeitfenster zwingt zu Timing.
- **Vorberechnete Komponenten** (Wasser + Land) halten die Hot-Paths O(1): Routen-Existenz
  und „über Land erreichbar?" ohne Pro-Tick-Flood-Fill.

## Konsequenzen

- `GameState` trägt neue statische Felder (`waterComponents`, `landComponents`) und
  dynamische Listen/Sets (`boats`, `tradeShips`, `alliances`, `allianceRequests`,
  `embargoes`); `Player` bekommt `gold` und `traitorUntil`.
- Determinismus bleibt Pflicht: alle neuen Zufallswahlen über Sim-/KI-PRNG, alle
  Iterations-Reihenfolgen deterministisch sortiert.
- Reservierte State-Bits (Border/Defense) aus ADR 0002 wurden **nicht** gebraucht —
  Verteidigungs-Bonus wird live über die Gebäude-Liste berechnet (O(Posten)).
- `attackerLossPerTile` nimmt jetzt einen `mag`-Parameter (Terrain × Defense × Verrat).

## Alternativen (optional)

- **Gold pro Tile** (wie OpenFront teils) — verworfen, weil es das gewünschte
  Klein-aber-reich-Spiel untergräbt.
- **Explizite Boot-/Diplomatie-Sonderlogik im Input** — verworfen zugunsten der
  Core-Entscheidung, die KI und Mensch denselben Pfad nutzen lässt.
- **State-Bits für Defense-Bonus** (ADR 0002 vorgesehen) — verworfen, da die Posten-Liste
  klein ist und ein Live-Check einfacher korrekt zu halten ist als Bit-Pflege bei
  Bau/Abriss/Eroberung.
