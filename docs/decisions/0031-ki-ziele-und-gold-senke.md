# ADR-0031: KI-Meilenstein-Ziele + Spätspiel-Gold-Senke

**Status:** Proposed — Diskussionsentwurf, NICHTS umgesetzt. Jonathan entscheidet.
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

**Empfehlung (Diskussionsbasis):** A1 als schneller KI-Patt-Brecher kurzfristig; A2 oder A3 als
eigentliche, langfristige Gold-Senke (auch für den Menschen). A1 + A2 sind kombinierbar.

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

## Konsequenzen

- **Positiv:** Spätspiel-Patts werden brechbar; Gold bekommt durchgehend Wert (auch für den Menschen);
  KI wirkt zielgerichteter statt „satt".
- **Negativ/Risiko:** Balance-Eingriff (Spätspiel-Dynamik ändert sich spürbar — Feel-Test nötig);
  Snowball-Gefahr bei zu billiger Gold→Cap-Umwandlung; Determinismus/MP-Sorgfalt (core).
- **Aufwand:** Teil A klein (A1) bis mittel (A2/A3); Teil B mittel (KI-Ziel-System) — zusammen ein
  eigenes Vorhaben, schrittweise + mit Feel-Abnahme.

## Offene Fragen an Jonathan (Entscheidungen)

1. **Welche Gold-Senke?** A1 (schnell) / A2 (höheres Level) / A3 (eigener Pfad) — oder Kombination?
2. **Auch für den Menschen** (symmetrisch) oder vorerst nur KI? (Empfehlung: symmetrisch, sonst unfair.)
3. **Wie stark/teuer?** Snowball-Bremse über die Kostenkurve — wie aggressiv eskalieren?
4. **Meilenstein-Werte:** konkrete Ziele (Gold/s-Schwelle, Cap-Faktor k, Territorium-%)?
5. **ELO-1000-Bomber:** zusätzlich die Bomber-Schwelle senken (eigener kleiner Patt-Brecher), oder reicht A+B?
