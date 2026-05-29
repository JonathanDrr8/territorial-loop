# ADR 0008: Fabrik-Netzwerk-Wirtschaft, Kriegsschiffe, Wilde Nationen

## Status

Accepted

## Datum

2026-05-29

## Kontext

Größerer Feature-Block nach der Spielgefühl-Iteration (ADR-0007), als
zusammenhängendes Paket umgesetzt. Jonathans Vorgaben: **kein Gold-Wachstum mit
Gebietsgröße** — die Wirtschaft soll über ein **Produktionsgebäude mit
Verbindungssystem** (OpenFront-inspiriert, aber **ohne Züge**) laufen; dazu
**Kriegsschiffe** (Handelsblockade + Schiff-gegen-Schiff) und ein passiver
Spielertyp **„wilde Nationen"**. Formeller Kriegszustand wurde bewusst verworfen.

## Entscheidung

### Fabrik + Verbindungs-Netzwerk (Wirtschaft)

Neuer Gebäudetyp `factory`. Eine Fabrik verbindet sich automatisch **per Luftlinie**
(`FACTORY_LINK_RANGE`, Torus-Distanz, **transitiv** via Union-Find) mit eigenen
Städten/Häfen/Fabriken zu einem **Cluster**. Pro Tick produziert jede Fabrik
`FACTORY_GOLD_PER_DEST × (Anzahl Städte+Häfen im Cluster) × Level` Gold
(`factoryGoldPerTick`). Eine isolierte Fabrik ohne verbundene Ziele bringt nichts →
man baut **Stadt + Hafen + Fabrik nah beieinander** und vernetzt sie; Städte (Cap)
und Häfen (Handel/Schiffe) werden so zusätzlich wirtschaftlich wertvoll. Das flache
`BASE_GOLD_PER_TICK` bleibt nur als kleiner Start-Trickle (nicht größen-abhängig).
**Bewusst keine Züge** — nur das Netzwerk-/Cluster-Prinzip, mit sichtbaren
Verbindungslinien (`drawBuildingLinks`), damit es sich nicht „abgekupfert" anfühlt.

### Kriegsschiffe + Handelsblockade + Schiff-gegen-Schiff

Neuer Schiffstyp `Warship`: vom eigenen **Hafen** (Gold `WARSHIP_COST`, Limit
`MAX_WARSHIPS_PER_PLAYER`) per Radialmenü auf ein **Wasser-Tile** entsandt,
patrouilliert die Route als **Ping-Pong** (`dir` kehrt am Ende um). Neue
Tick-Phasen `advanceWarships` + `resolveNavalCombat` (nach `advanceBoats`,
deterministisch, feste Reihenfolge): feindliche **Handelsschiffe** in `NAVAL_RANGE`
werden zerstört (Blockade, kein Gold), **Transportboote** versenkt,
**Kriegsschiffe** verlieren gegenseitig `WARSHIP_DAMAGE_PER_TICK` HP bis zur
Versenkung. „Feindlich" = anderer Besitzer und nicht verbündet. Rückruf
(`RecallWarshipIntent`) übers HUD-Angriffs-Panel. Render: Pixel-Sprite + HP-Leiste +
Beziehungs-Ring. KI nutzt `warshipChance` zur Blockade gegnerischer Häfen.

### Wilde Nationen / Barbaren

`PlayerDef.wild` / `Player.wild`. Wilde bekommen **keine KI** (emittieren nie
Intents → greifen nicht an, bauen nicht, keine Diplomatie) und einen **halben
Truppen-Cap** (`WILD_CAP_FACTOR`) → eroberbarer Puffer/Beute. Erzeugt in
`buildConfig` aus `menu.wildCount`, in gedämpfter Einheitsfarbe. KI/Mensch greifen
sie als Gegner an; Diplomatie-Optionen sind für sie ausgeblendet (UI + KI).

### Start-Menü

Zwei-Spalten-Layout: links die Einstellungen, rechts ein eigenes, stehendes
**„Experimentell"-Panel** (statt aufklappbar). Neue Option „Wilde Nationen" (0–N).

## Konsequenzen

- `GameState` trägt `warships`; neue Intents `LaunchWarshipIntent`,
  `RecallWarshipIntent`. Neuer `BuildingType` `factory` (4. Bau-Button, Hotkey 4).
- Schiff-Helfer (`shipWorldPos`/`shipArrived`/`shipTile`) nehmen jetzt einen
  strukturellen `MovingShip`-Typ (Boot/Handel/Kriegsschiff).
- Balance-Werte (Fabrik-Gold/Reichweite, Kriegsschiff-Kosten/HP/Reichweite,
  Wild-Cap) sind Startwerte und per Playtest tunbar.
- Determinismus gewahrt (seeded PRNG, Tick-Zeit, feste Iterationsreihenfolgen).
- Tests: Fabrik-Cluster-Gold + isolierte Fabrik, Wild-Cap/-Flag, Kriegsschiff-
  Launch/Blockade/Schiff-gegen-Schiff/Rückruf, `wildCount`-Persistenz.

## Nachtrag (Playtest-Verfeinerungen)

Aus späteren Playtests hervorgegangen, im Geist dieses ADRs:

- **Wilde Nationen sind jetzt eine passive KI** (`WILD_PROFILE`) statt einer Sonder-
  Ausbreitungslogik: Sie breiten sich **wie normale Nationen** in neutrales Land aus (normale
  Eroberungs-Geschwindigkeit) und greifen Nachbarn **zurückhaltend** an (hohe
  `popThresholdForPvp` → erst wenn fast voll). **Bauen/diplomatisieren/keine Schiffe** (alle
  entsprechenden Chancen 0) → dauerhaft schwächer. Die einzigen Unterschiede zu echten
  Nationen sind **Startwerte** (kleiner Spawn `WILD_SPAWN_TILES`) und **Wachstum** (halber
  Cap `WILD_CAP_FACTOR`). In `main.ts` bekommen Wilde jetzt `createAI(..., wild=true)`.
- **Wilde mit halber Gold-Produktion** (`WILD_GOLD_FACTOR = 0.5`) → kleiner Vorrat als Beute.
- **Gold-Beute beim Erobern** (`lootGoldOnCapture`): pro erobertem Tile wandert der Pro-Tile-
  Anteil des Gold-Vorrats des Verteidigers zum Angreifer (auch von Wilden) — analog zur
  Bevölkerung. Greift in `advanceAttack` (Land) und `landBoat` (amphibisch).
- **Baukosten gedeckelt** (`BUILD_COST_CAP = 1 Mio`); **Hafen & Fabrik teilen sich dieselbe
  Basis (25k) und Eskalation** (`COST_GROUP`, `buildCostFor`) → früh ein bewusstes Entweder-Oder.
- **Boote dürfen über Wasser flankieren** (die „über Land erreichbar → kein Boot"-Sperre ist
  weg; Gültigkeit = Wasserweg vorhanden).
- **Skalierung:** wilde Nationen bis 400, echte KI bis 200 (KI-Cooldown drosselt die teure
  Planung → 150 Bots @ 61 fps verifiziert); Karten-Labels dünnen bei >14 Nicht-Mensch-Nationen
  aus (`MINOR_LABEL_MIN_ZOOM`); Bot-zu-Bot-Diplomatie wird bei >20 Spielern nicht geloggt.

## Offen / später (eigene Pläne, mit Jonathan)

Kamera-Box statt endlosem Tiling (Render-/UX-Umbau, ADR-0011), Multiplayer (Lockstep-Netcode
auf der deterministischen Sim, ADR-0009), HUD-Komplettumbau (ADR-0010, Schritt 1 umgesetzt),
weitere Experimentell-Toggles (Wälder/Flüsse/Fische).
