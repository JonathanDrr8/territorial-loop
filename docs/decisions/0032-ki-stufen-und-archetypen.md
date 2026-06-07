# ADR-0032: KI-Stufen-Bauziele + Archetypen (KI-Rework)

**Status:** Proposed (Entwurf zur Abstimmung) — 2026-06-07
**Bezug:** baut auf ADR-0031 (A2-Gold-Senke umgesetzt) + Vorhaben „KI-Rework/Arena".

## Problem

1. **Bauziele frieren ein:** Heute hängt alles an starren Ratios (`cityTarget = tilesOwned / tilesPerCity`,
   `factoryTarget = (cities+ports)/FACTORY_CART_LIMIT`, `src/ai/ai.ts:723-733`). Im Patt ist
   `tilesOwned` fix → Ziele erreicht → die KI baut/handelt nicht mehr sinnvoll, hortet Gold (ADR-0031).
2. **Keine Vielfalt:** Alle KIs verhalten sich gleich; der einzige Unterschied ist die ELO/Skill-Stufe
   (`profileForElo(elo)`, `ai.ts:132-140`). Es gibt keine _Spielstile_ — keine, die früh auf Bomber geht,
   keine reine Eco-Nation, keine Turtle. (Jonathans Idee.)

## Idee (zwei Bausteine)

### Baustein 1 — Stufen-Bauziele statt eingefrorener Ratios

Die KI durchläuft **Phasen**, die steuern _wie viel von was_ sie als Nächstes will. Eine Phase „schließt
nie ab": ist eine erreicht, rückt die KI in die nächste, statt zu erstarren. Vorschlag (3 Phasen):

| Phase                      | Auslöser (Beispiel)                       | Bauziel-Schwerpunkt                                                                                          |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **1 Etablieren**           | Start / kleines Reich                     | Wirtschafts-Rückgrat: Städte→Fabriken→Häfen nach Ratio (wie heute)                                           |
| **2 Aufrüsten**            | Eco-Ziele der Phase 1 erfüllt             | Militär-Infra: Flughäfen/Bomber, Verteidigung; Eco weiter verdichten                                         |
| **3 Spätspiel/Durchbruch** | Expansion stockt **oder** Gold-Überschuss | Macht weiter ausbauen statt horten: Städte **hochrüsten (A2!)**, mehr Bomber, gezielt Gold→Cap, Patt-Brecher |

Kernpunkt: In Phase 3 sind die Ziele **nicht mehr tile-gebunden**, sondern z.B. gold-/zeit-getrieben
(„solange Überschuss da ist, hebe Macht") → der Hort wird _dauerhaft_ abgebaut (das, was A2 allein nicht
schafft — Validierung ADR-0031: A2 hebt Caps, stopft den Hort aber nicht).

### Baustein 2 — Archetypen (Spielstile), orthogonal zur ELO

ELO = **wie gut** (Skill, Timing, APM). Archetyp = **welcher Stil**. Ein Archetyp ist ein **Modifikator**
auf das `DifficultyProfile` + auf die Phasen-Gewichte — derselbe Archetyp existiert auf jeder ELO.

Vorschlag (5 Archetypen):

| Archetyp        | Stil                            | Beispiel-Modifikatoren                                      |
| --------------- | ------------------------------- | ----------------------------------------------------------- |
| **Balanced**    | Allrounder (heutiges Verhalten) | neutral                                                     |
| **Eco-First**   | Wirtschaft zuerst, spät stark   | längere Phase 1, mehr Fabriken/Häfen, später aber hohe Caps |
| **Bomber-Rush** | früh Luftwaffe                  | Phase 2 früh, hoher `bomberChance`, Flughäfen zuerst        |
| **Turtle**      | defensiv, hält & wächst sicher  | `usesAirDefense`, viel Verteidigung, niedriger `attackPct`  |
| **Aggressor**   | Expansion/Angriff               | hoher `attackPct`, niedriger `buildChance`, Eco minimal     |

**Andocken (minimal-invasiv):** `profileForElo(elo)` → `profileForElo(elo, archetype)`; ein
`ARCHETYPE_MODIFIERS: Record<Archetype, (p: DifficultyProfile) => DifficultyProfile>` formt das
Basis-Profil. Die Phasen-Logik liest Archetyp-Gewichte. Alles in `core`/`ai`, **deterministisch** (kein
`Math.random`/`Date.now`; MP-genau, ADR-0009).

**Zuweisung:** pro Match eine **bunte Mischung** (seed-deterministisch verteilt) als Default — so fühlt
sich jedes Match lebendig/unterschiedlich an. Später optional in den Match-Settings konfigurierbar
(„KI-Vielfalt an/aus", oder gezielt Archetypen wählen).

## Konsequenzen

- **Positiv:** KI handelt zielgerichtet + hört nie auf zu entwickeln (fixt Hort/Patt); Matches werden
  abwechslungsreich (verschiedene Gegner-Stile); Grundlage fürs Arena-Tuning (Stile gegeneinander messen).
- **Risiko:** Balance (Archetypen dürfen nicht stark unfair sein — Arena-Sim zum Gegenchecken); mehr
  KI-Komplexität (sauber kapseln); Determinismus-Sorgfalt.
- **Aufwand:** mittel-groß → in Scheiben: (1) Phasen-Bauziele (fixt nebenbei den Hort), (2) Archetyp-
  Gerüst + 2-3 Stile, (3) restliche Stile + Match-Settings-Schalter, (4) Arena-Balance.

## Offene Design-Entscheidungen (für Jonathan)

1. **Phasen-Schnitt:** 3 Phasen wie oben (Etablieren → Aufrüsten → Spätspiel) — passt, oder anders/mehr?
2. **Archetyp-Set:** die 5 oben — passt, andere/mehr (z.B. „Naval", „Diplomat/Verräter")?
3. **Orthogonal zur ELO** bestätigen (Stil getrennt von Skill) + **Zuweisung** (bunte Mischung als Default).
4. **Umsetzungs-Reihenfolge:** erst Phasen-Bauziele (Foundation + Hort-Fix), dann Archetypen — ok?
