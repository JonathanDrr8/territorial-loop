# ADR-0031: KI-Meilenstein-Ziele + Spätspiel-Gold-Senke

**Status:** Accepted (Richtung) — **A2 (Mechanik) umgesetzt** (Städte bis Level 6, verdoppelnde Kosten, 2026-06-07), Feel-Test offen. **Teil C — Grundschritt umgesetzt** (Bomber-Schwelle 0.58→0.40 gesenkt, ELO 1000 baut jetzt ein paar Bomber, 2026-06-07). A1 + Teil B (KI-Ziele) + ELO-feinparametrisiertes Bomber-Budget noch offen.
**Datum:** 2026-06-07

## Kontext — der Befund aus dem 10-Stunden-Match

Ein Match lief über Nacht 10 h durch (performant, ADR-0030 zahlt sich aus). Endstand: **drei KI-Nationen
im Patt** (Cerium 40,3 %, Dirac 31,5 %, Floki 28,1 % Territorium), **keine kommt durch**. Auffällig:
**Dirac hortet 376 Mio. Gold**, baut aber nichts mehr.

### Ursachenanalyse (Code, nicht vermutet)

Es ist **kein Gold-Mangel und kein ELO-Trainingsfehler**, sondern ein struktureller Logik-/Mechanik-Fehler:

1. **KI-Städte sind ans Territorium gekettet:** `cityTarget = floor(tilesOwned / ~188)`
   (`src/ai/ai.ts:723-726`, `825-833`). Im Patt ist `tilesOwned` eingefroren → das Städte-Soll ist
   erreicht → die KI baut nie wieder eine Stadt. Häfen/Fabriken hängen als Ratio an der Städtezahl → auch fix.
2. **Level ist bei 3 gedeckelt** (`MAX_BUILDING_LEVEL=3`, `src/core/buildings.ts:55`). Sind alle Gebäude
   auf Level 3, geben **`planBuild` UND `planUpgrade` `null` zurück** → gar kein Bauen/Upgraden mehr.
3. **Es gibt keinen Pfad „Gold → Truppen-Cap".** Der Cap ist `maxTroops(territorium) + Σ Städte·Level·25k`
   (`src/core/game.ts:1252-1259, 3026-3031`) — beide Summanden im Patt eingefroren. Gold kann nur in
   Bau/Upgrade/Schiffe/Bomben fließen, alles erschöpft → **Gold läuft ins Leere → Horten**.
4. **ELO-1000 verschärft:** Bomber (der einzige gold-getriebene Patt-Brecher) schalten erst ab ~ELO 1080
   frei (`src/ai/strength.ts:57`). Auf 1000 fehlt dieser Hebel komplett.

**Folge:** Drei gleich starke KIs treffen denselben festen Cap-Deckel → keine erreicht die für die
Volleinnahme nötige 2:1-Überlegenheit → ewiges Patt.

### Wichtig: betrifft auch den Menschen

Auch ein menschlicher Spieler hat im Spätspiel mit vollem Gebiet **keinen Weg, mit Gold seinen Cap weiter
zu heben**. Die Eco-Analyse (Nacht, `docs/balance-analyse-2026-06.md`) bestätigte: die Gold-**Raten** passen
(~1000/s Base, Fabrik +26–78 %, Snowball gedeckelt) — aber es fehlt **oben ein Ventil**. Das ist eine
generelle Spätspiel-Lücke, kein reines KI-Problem.

## Zu entscheidende Richtung (zwei gekoppelte Teile)

Reihenfolge wichtig: **Teil A (Mechanik) muss vor Teil B (KI-Ziele) stehen** — eine KI kann ein
„mehr Cap"-Ziel nur verfolgen, wenn es überhaupt einen Gold→Cap-Pfad gibt.

### Teil A — Spätspiel-Gold-Senke (Mechanik, betrifft KI + Mensch)

| Option                         | Idee                                                                                    | Pro                                                          | Contra / Risiko                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **A1 — Städte über die Ratio** | Bei Gold-Überschuss zusätzliche Städte auf freie Innen-Tiles (über `cityTarget` hinaus) | Minimal-invasiv, nutzt bestehende Mechanik, MP-sicher        | Tile-begrenzt (irgendwann ist das Gebiet voll) → nur Teil-Lösung         |
| **A2 — höheres Städte-Level**  | `MAX_BUILDING_LEVEL` für Städte anheben, mit stark eskalierenden Kosten                 | Kompakt (kein Platz nötig), echte Gold-Senke, skaliert lange | Balance-Eingriff; Kosten-Kurve muss sublinear-teuer sein, sonst Snowball |
| **A3 — eigener Cap-Ausbau**    | Neuer gold-finanzierter, sublinearer „Cap-Aufbau" (entkoppelt von Gebäuden)             | Flexibelste Senke, sauber dosierbar                          | Neue Mechanik + UI; größter Aufwand                                      |

**Querschnitt-Risiko (alle Optionen):** Gold→Macht darf den Führenden nicht zu dominant machen
(Snowball). Gegenmittel: stark **sublineare/eskalierende Kosten** (jeder weitere Cap-Punkt teurer) +
ggf. Deckel. Alles in `core/` → **muss deterministisch sein** (kein `Math.random`/`Date.now`, MP-genau).

**Beschlossen: A2 + A1.** Städte werden über Level 3 hinaus aufrüstbar (A2) mit stark eskalierenden
Kosten — das ist die eigentliche Gold-Senke + Snowball-Bremse in einem; zusätzlich baut die KI bei
Gold-Überschuss + vollem Gebiet weitere Städte auf Innen-Tiles (A1). Begründung: nutzt die bestehende,
dem Spieler vertraute Upgrade-Mechanik, ist kompakt (kein Platz nötig), skaliert lange, und die teurer
werdenden Level halten den Vorsprung des Führenden im Zaum. A3 (ganz neue Mechanik) vorerst verworfen
(überengineered). Empfehlung weiterhin **symmetrisch für KI + Mensch** (final in der Umsetzung).

### Teil B — KI-Meilenstein-Ziele statt starrer Solls (Jonathans Idee)

Heute folgt die KI starren Ratio-Solls (Stadt = tiles/188 …), die im Patt einfrieren. Stattdessen:
**dynamische Meilensteine, die die KI aktiv erreichen will und nie „abschließt".** Mögliche Achsen:

- **Wirtschaft:** Ziel „X Gold/s" → baut Fabriken/Häfen, bis erreicht.
- **Militär (Patt-Brecher):** Ziel „Truppen-Cap ≥ k× stärkster Nachbar" (z. B. k=1,5) → steckt Gold gezielt
  in die Teil-A-Senke, bis sie überlegen ist → bricht das Patt Richtung 2:1.
- **Expansion:** Territorium-%-Ziel.

Die KI wählt jeweils das **nächste unerfüllte** Ziel und handelt darauf hin. Im Patt ist das Militär-Ziel
offen → sie gibt ihr gehortetes Gold aus, statt es zu sammeln. Das passt zum gewünschten KI-Rework
(„Lage-Bewertung statt starrem Würfel-Menü", vgl. das KI-Rework-Vorhaben) und macht die KI auch sonst
zielgerichteter. **Setzt Teil A voraus.**

### Teil C — ELO-Kopplung + „normales Match deckt alle Elemente ab" (beschlossen)

Leitprinzip (Jonathan): **Ab ELO 1000 sind ALLE Spielelemente präsent — was mit der ELO skaliert, ist
nicht _ob_, sondern _wie viel / wie gut_.** Heute schaltet das Stufen-System Elemente erst spät frei
(z. B. Bomber erst ~ELO 1080, `src/ai/strength.ts:57`) → ein Standard-Spieler erlebt sie nie und lernt
sie nicht kennen. Künftig: jedes Element immer vorhanden, nur Intensität/Qualität skaliert. So fühlt sich
jedes Match „vollständig" an und ist lehrreich (man gewöhnt sich an alle Mechaniken).

Konkret skaliert mit der ELO (statt an/aus):

| Achse                                  | ELO 1000 (Anker)             | hohe ELO             |
| -------------------------------------- | ---------------------------- | -------------------- |
| Bomber-Budget                          | **wenige** (nicht null)      | viele, gut getimt    |
| Cap-Ziel `k` (ggü. stärkstem Nachbarn) | moderat (~1,1–1,2)           | ehrgeizig (~1,5+)    |
| Gold-Ausgabe-Tempo                     | gemächlich (etwas Horten ok) | zügig, kein Leerlauf |

Damit fühlt sich auch die 1000er-KI lebendig an (kauft mal einen Bomber, baut weiter), bleibt aber
schlagbar. Die Teil-B-Meilensteine und die Teil-A-Gold-Senke werden also **ELO-parametrisiert**.

## Konsequenzen

- **Positiv:** Spätspiel-Patts werden brechbar; Gold bekommt durchgehend Wert (auch für den Menschen);
  KI wirkt zielgerichteter statt „satt".
- **Negativ/Risiko:** Balance-Eingriff (Spätspiel-Dynamik ändert sich spürbar — Feel-Test nötig);
  Snowball-Gefahr bei zu billiger Gold→Cap-Umwandlung; Determinismus/MP-Sorgfalt (core).
- **Aufwand:** Teil A klein (A1) bis mittel (A2/A3); Teil B mittel (KI-Ziel-System) — zusammen ein
  eigenes Vorhaben, schrittweise + mit Feel-Abnahme.

## Status der Entscheidungen

**Beschlossen (2026-06-07):**

- Gold-Senke **A2 + A1** (Städte über Level 3 mit eskalierenden Kosten + KI baut bei Überschuss mehr Städte).
- **ELO-Kopplung** + Prinzip „normales Match deckt alle Elemente ab" (Bomber bei ELO 1000 wenige statt null).

**Umgesetzt (2026-06-07, feature/gold-senke-a2 — Feel-Test offen):**

- **A2-Mechanik:** Städte über Level 3 hinaus aufrüstbar bis **Level 6** (`MAX_CITY_LEVEL`, `maxLevel(type)`
  in `core/buildings.ts`). Upgrade-Kosten **verdoppeln sich je Level** ab Level 3 (`base×3×2^(level-2)`:
  L3→4 ×6, L4→5 ×12, L5→6 ×24 → Standard-Stadt 150k/300k/600k; teure Stadt ×4). Jedes Level weiter
  **+25k Cap** (bestehende `cityCapBonus`-Formel, level-linear → L6-Stadt = +150k). Direkt-BAU bleibt ≤3.
  Symmetrisch Mensch + KI; die KI rüstet im Patt über `planUpgrade` (Stadt-Prio 5) ihr Überschuss-Gold
  in Städte (drainiert das Horten). Determinismus: Integer-Shift statt `Math.pow` (MP-genau).
  → klärt die früheren offenen Punkte 1 (Kostenkurve: verdoppelnd), 2 (Deckel: Level 6), 3 (symmetrisch).

**Umgesetzt (2026-06-07, balance/wachstum-und-bomber — Feel-Test offen):**

- **Teil C — Grundschritt (Bomber bei ELO 1000):** Bomber-Schwelle in `src/ai/strength.ts` von
  `s≥0.58` (≈ELO 1081) auf **`s≥0.40`** gesenkt (`usesBombers` + `bomberChance`-Gate). ELO 1000 ≈ s0.43
  liegt jetzt drüber → baut mit ~8 % Bau-Chance ein paar Bomber (Ramp `lerp(0.05, 0.12, s)` bleibt). Flak +
  Krater-Heilung + Bomber liegen nun beieinander bei ~s0.40 → der Standard-Gegner deckt das volle Repertoire ab.
  Hinweis: hebt die Real-Stärke mittlerer Profile minimal → die ELO-Eichtabelle driftet leicht (bei niedriger
  Bomber-Chance vernachlässigbar; volle 200-Seed-Neu-Eichung wäre ein eigener Job).
- **Begleitende Wachstums-Balance (separater Befund):** `MAX_TROOPS_PER_TILE` 950→**800** (−15 %) in
  `core/config.ts` — ein Stück Land gab gefühlt zu viel Bevölkerung; große Nationen wuchsen zu schnell. Senkt
  Caps proportional (große Nationen stärker, da der Sockel 4000 bleibt). Deterministisch, MP-genau.

**Noch offen (mit Feel-Abnahme):**

1. **A2-Feel-Test:** brechen Spätspiel-Patts jetzt? Deckel/Steilheit ggf. nachziehen (leicht änderbar).
2. **A1:** KI baut bei Gold-Überschuss + vollem Gebiet zusätzliche Städte auf Innen-Tiles (über `cityTarget`).
3. **Teil B — Meilenstein-Werte:** Gold/s-Schwelle, Cap-Faktor `k` je ELO-Stufe, Territorium-%.
4. **Teil C — feine ELO-Kopplung:** Bomber-_Budget_/Cap-`k`/Gold-Tempo je ELO skalieren (über den jetzt
   gesetzten Grundschritt hinaus: nicht nur _ob_ Bomber, sondern _wie viele_, ELO-parametrisiert).
