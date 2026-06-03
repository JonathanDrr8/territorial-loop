# ADR 0029: Angriffs-Front inkrementell statt Voll-Rescan pro Tick (Performance) — Plan

## Status

Proposed (Plan — noch nicht umgesetzt). Schreibt sich an ADR-0012 (viele Bots) und ADR-0006
(Mechanik-Tiefe) an. **Vor der Umsetzung von Jonathan abzusegnen** (determinismus-kritischer
Kampf-Kern, MP-Lockstep ADR-0009).

## Datum

2026-06-03

## Kontext — gemessenes Problem

Im **Spätspiel auf großen Karten** (Chaos-Preset 2048², 751 Nationen, ab ~Spielminute 7) wird die
Simulation zäh. Mit `npm run perf -- chaos --ticks 4000` (deterministisches Selbstspiel) und temporärer
Phasen-Instrumentierung gemessen:

| Spielzeit | lebende Nationen | `resolveAttacks`                              |
| --------- | ---------------- | --------------------------------------------- |
| 3 min     | 360              | sum 21 885 ms / 2000 Ticks (≈ 11 ms/Tick)     |
| 7 min     | 144              | sum 115 756 ms (≈ 58 ms/Tick)                 |
| 10 min    | 112              | sum 182 666 ms (≈ **91 ms/Tick**), max 294 ms |

Die anderen Phasen sind nach den 0.52.2-Fixes klein (Render-Färbung, Boot-Start, Trade-Routen bereits
behoben). `resolveAttacks` ist die **letzte große Dauerlast** — sie wächst mit der **Konsolidierung**
(wenige, riesige Nationen) und trifft jede Hardware (reines JS, nicht GPU/Render).

Bei 10 Ticks/s (100-ms-Intervall) ist ~28–91 ms/Tick noch im Budget, aber die **Spitzen > 100 ms**
lassen die Sim hinter die Uhr fallen → sicht­bares Ruckeln; zusammen mit dem Render frisst es die
Bildrate. „Flüssig zwischen Standbildern" im Spätspiel.

## Wo die Kosten liegen (`advanceAttack` in `src/core/game.ts`)

Pro **Angriff pro Tick**:

1. **`collectAttackableTiles(attacker, targetId)`** — iteriert die **komplette** `attacker.frontier`
   (alle Rand-Tiles der Nation) und prüft je 4 Nachbarn auf `targetId`. Ergebnis: die Front-Tiles
   (Ziel-Tiles am eigenen Rand) + `frontWidth`. Kosten: **O(attacker.frontier)** — bei einer Nation,
   die 20–40 % der Karte hält, sind das zehntausende Tiles, **jeden Tick neu gescannt**, obwohl die
   Front sich pro Tick nur um ≤ `MAX_CAPTURES_PER_TICK` (120) verschiebt.
2. **Schlüssel-Aufbau** (`keyed`) — pro Front-Tile `torusDistance` + `ownNeighborCount` +
   `terrainMagnitude` + `tileNoise`. Kosten: **O(front)**.
3. **`keyed.sort(...)`** — die ganze Front sortieren, um die besten ≤120 zu nehmen. **O(front·log front)**.
4. Eroberung der besten ≤120 (mit Recheck, Verlust-Rechnung, Pocket-/Fragment-Erkennung — letztere
   bereits durch `MAX_CAPTURES_PER_TICK` gedeckelt, ADR-0006-Nachtrag/0.52.2).

Schritt 1 dominiert bei Nationen mit großer Gesamt-Frontier, die nur einen Teil-Gegner angreifen
(F ≫ Front). Schritt 2–3 dominieren bei **breiten Omni-Angriffen** entlang einer langen gemeinsamen
Grenze (Front sehr groß, aber nur 120 werden genommen).

## Harte Randbedingung: MP-Determinismus

`resolveAttacks` ist Teil der gehashten Sim (ADR-0009 Lockstep). **Jede** Änderung MUSS auf allen
Clients bit-genau dasselbe Ergebnis liefern:

- Gleiche Tiles in gleicher Reihenfolge erobern (die Eroberungs-Reihenfolge formt das Gebiet).
- Gleicher PRNG-Verbrauch (`state.rng.next()` für die Fraktions-Rundung etc.) in gleicher Reihenfolge.
- Reihenfolge-Stabilität: heute kommt sie aus der **Insertion-Order der `attackableSet`** (=
  deterministische Frontier-Iterations-Reihenfolge) und dem stabilen `sort` über numerische Keys.

Eine inkrementelle Front-Pflege darf diese Reihenfolge **nicht** kippen, sonst desyncen Clients /
brechen Replays. Das ist der Grund, warum dies ein eigener, vorsichtiger Schritt mit eigenem Plan ist.

## Plan — zwei Phasen, von risikoarm nach risikoreich

### Phase 1 (risikoarm, gameplay-NEUTRAL, zuerst): Frontier-Scan pro Nation einmal/Tick bündeln

Heute ruft jede der `A` Attacken einer Nation `collectAttackableTiles` → `A × O(frontier)`. Stattdessen
**einmal pro Nation pro Tick** die Frontier scannen und nach angrenzendem Ziel-Owner in Buckets
`Map<targetId, TileRef[]>` einsortieren; jede Attacke nimmt ihren Bucket.

- Spart den Faktor `A` (Nationen mit mehreren gleichzeitigen Angriffen). Bei genau einem Angriff keine
  Änderung → **kein** Effekt auf das häufige Ein-Angriff-gegen-eine-Nation-Szenario.
- **Reihenfolge bleibt identisch** (gleiche Frontier-Iteration, gleiche Bucket-Insertion-Order) →
  bit-genau gleiches Ergebnis, null Determinismus-Risiko. Gut als Sicherheits-Netz + erster Messpunkt.

### Phase 2 (der eigentliche Hebel): Inkrementelle Front je Angriff

Je Angriff ein **persistentes Front-Set** `attack.front: Set<TileRef>` (die aktuell eroberbaren
Ziel-Tiles), das **nicht** jeden Tick neu gescannt, sondern fortgeschrieben wird:

1. **Initialisierung** (beim Angriffs-Start in `applyAttackIntent`): die Front einmal aufbauen — über
   die heutige Frontier-gegen-Ziel-Logik (deterministische Reihenfolge als Basis).
2. **Nach den Eroberungen eines Ticks**: für jedes neu eroberte Tile dessen 4 Nachbarn prüfen — gehört
   ein Nachbar dem Ziel und grenzt jetzt an eigenes Land, wird er der Front hinzugefügt; das eroberte
   Tile selbst fällt raus. Kosten: **O(erobert · 4) = O(120)** statt O(frontier).
3. **Stale-Einträge**: Tiles, die inzwischen jemand anderem gehören (paralleler Angriff) oder nicht
   mehr am eigenen Rand liegen, werden beim Verarbeiten übersprungen/entfernt — die bestehende
   Recheck-Logik in der Capture-Schleife deckt das bereits ab (sie überspringt fremd gewordene Tiles).
4. **`frontWidth`** wird aus der Front-Größe abgeleitet (heute = Zahl der Frontier-Tiles mit Ziel-Nachbarn;
   muss exakt nachgebildet werden, da es in `tilesPerTick` eingeht → sonst andere Eroberungsrate).

Damit fällt Schritt 1 von O(frontier) auf O(120). Schritt 2–3 (Key + Sort) bleiben O(front); bei sehr
breiten Fronten zusätzlich optional **Top-K-Auswahl** (Quickselect/Heap, O(front) statt O(front·log front))
— nur, falls Messung zeigt, dass der Sort relevant bleibt.

**Determinismus-Kern von Phase 2:** Das Front-`Set` muss eine **deterministische Iterations-Reihenfolge**
haben, die auf allen Clients identisch ist — auch nach beliebig vielen inkrementellen Adds/Deletes.
JS-`Set` hält Insertion-Order; solange Adds in deterministischer Reihenfolge passieren (Nachbar-
Reihenfolge `tileNeighbor4` d=0..3, eroberte Tiles in Capture-Reihenfolge), ist die Order reproduzierbar.
**Aber**: Delete+spätere Re-Add ändert die Position → Risiko. Sicherer Ansatz: die Front je Tick in ein
Array materialisieren und **deterministisch sortieren** (wie heute der Key-Sort) — die Reihenfolge kommt
dann komplett aus dem numerischen Key, nicht aus der Set-Order. Dann ist die Set-Order irrelevant und
nur die Menge muss stimmen. Das ist der robusteste Weg und sollte der Default sein.

## Risiken & Gegenmaßnahmen

- **Desync (höchstes Risiko).** Gegenmaßnahme: Reihenfolge ausschließlich aus dem numerischen Key
  ableiten (s. o.), nicht aus Set-Iteration. Verifikation über den bestehenden Determinismus-Harness
  (`tests/serialize.test.ts`: warm vs. deserialisiert läuft bit-genau) **plus** ein neuer Test, der zwei
  Spiele mit gleichem Seed/Intent-Strom Tick für Tick per `hashState` vergleicht, mit aktiven Großangriffen.
- **Front „verliert" Tiles** (inkrementelle Pflege übersieht einen neu erreichbaren Ziel-Rand) → Angriff
  stockt sichtbar. Gegenmaßnahme: gegen die alte Voll-Scan-Front testen (Property-Test: inkrementelle
  Front == Voll-Scan-Front nach N Ticks, auf mehreren Seeds).
- **Gameplay-Drift**: andere Eroberungsform als heute. Phase 1 ist garantiert neutral; Phase 2 muss per
  Hash-Gleichheit gegen den Status quo geprüft werden (Ziel: identisch; falls bewusst abweichend, klar
  dokumentieren und Jonathan vorlegen).

## Verifikation (PFLICHT vor Merge)

| #   | Was                                     | Test-Kommando                                                                                                                                      | Erwartetes Ergebnis                                                                                                                |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sim bleibt korrekt                      | `npm run test:run`                                                                                                                                 | 485+ Tests grün (inkl. `tests/ships.test.ts`, `tests/serialize.test.ts`)                                                           |
| 2   | Typen/Lint                              | `npm run typecheck && npm run lint`                                                                                                                | beide ohne Fehler                                                                                                                  |
| 3   | Perf-Gewinn Spätspiel                   | `npm run perf -- chaos --ticks 4000`                                                                                                               | `resolveAttacks`-Anteil deutlich runter; **Tick-p99 < ~60 ms**, **max < ~120 ms** (Baseline 0.52.2: p50 28 / p99 151 / max 249 ms) |
| 4   | Perf-Gewinn früh/mittel unverändert gut | `npm run perf -- small standard`                                                                                                                   | keine Regression (Baseline: standard p50 ~3 ms)                                                                                    |
| 5   | Determinismus                           | neuer Test `tests/determinism-attacks.test.ts`: zwei Läufe gleicher Seed + identische Intents, `hashState` Tick-für-Tick gleich, mit Großangriffen | identische Hashes über ≥500 Ticks                                                                                                  |
| 6   | In-Browser (Jonathans GPU)              | Chaos starten, ~Minute 10, Frame-Gaps messen (rAF-Delta-Snippet)                                                                                   | deutlich weniger Gaps > 50 ms als 0.52.2                                                                                           |

Zusätzlich manuell: Jonathan spielt Chaos bis ins Spätspiel und bestätigt „flüssig".

## Alternativen (verworfen / zurückgestellt)

- **Front auf ein Fenster um den Fokus kappen.** Würde Omni-Angriffe (ganze Grenze) im Verhalten ändern
  → Gameplay-Eingriff, nicht rein Perf. Verworfen.
- **Nur Sort durch Top-K ersetzen, Scan lassen.** Halber Gewinn (Schritt 1 = O(frontier) bleibt der
  Hauptkostenpunkt bei großen Nationen). Als optionaler Zusatz in Phase 2 vorgesehen, nicht als Ersatz.
- **KI weniger Angriffe ausführen lassen.** Behandelt das Symptom (weniger Angriffe), nicht die Ursache,
  und ändert Spielstärke/ELO. Verworfen.

## Rollout

Phase 1 zuerst (neutral, messbar), committen + per `npm run perf` belegen. Dann Phase 2 mit dem
Determinismus-Test als Gate. Erst nach beidem + grüner Verifikation gemeinsam mit 0.52.2 deployen
(0.52.2 wartet bis dahin auf dem Branch `fix/freeze-standbilder`, so mit Jonathan vereinbart).
