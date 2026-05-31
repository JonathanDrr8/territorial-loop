# ADR 0023: KI-Trainings-Ausbau & offene Justierung (Plan)

## Status

**Proposed** — Checkpoint 2026-05-31, nach ADR-0020/0021/0022. Bewusst NICHT jetzt umgesetzt: die
KI ist in gutem Zustand; das hier ist Verfeinerung, gegen anderen Content/Balance/Politur abzuwägen.
Festgehalten, damit es nicht verloren geht (Jonathans Frage „lohnt mehr Training, parallel, Server,
Balance-Agent?").

## Kontext

Nach ADR-0020/0021/0022 spielt die KI gut: 5-Stufen-ELO-Leiter, kontinuierliche Stärke, OpenFront-
Wirtschafts-Rückgrat, Evolutions-Tuner (auch FFA + Diplomatie), kontextbewusste Schicht. Frage:
bringt MEHR Training mehr?

## Befund (ehrlich)

- **Mehr vom GLEICHEN Setup → schnell abnehmender Ertrag.** Der Tuner optimiert ~11 feste Knöpfe
  gegen eine feste Fitness; die Fitness rastete zuletzt bei 0,71–0,74 ein. Mehr Generationen/Seeds
  machen das Ergebnis nur präziser/weniger verrauscht.
- **Overfitting-Risiko:** Zu hartes Tunen auf die Arena-Bedingungen → KI wird gut darin, SICH SELBST
  zu schlagen, fühlt sich gegen MENSCHEN evtl. schräg/ausnutzbar an.
- **Echte neue Gewinne** kommen aus mehr Parametern, mehr Szenarien und mehr Durchsatz — nicht aus
  „mehr vom Gleichen".

## Plan (priorisiert)

1. **Arena parallelisieren (Multiplikator, zuerst).** Aktuell läuft sie sequenziell in einem Prozess.
   Mit `worker_threads` über alle CPU-Kerne → grob ~8× Durchsatz. Macht alles andere billig (8× mehr
   Seeds/Szenarien in derselben Zeit). `runMatch` ist rein/deterministisch → gut parallelisierbar
   (Matches sind unabhängig; nur die Ergebnisse einsammeln).
2. **Mehr Parameter in den `ParamVector`.** Aktuell von Hand gesetzt: die Kontext-Modulations-Stärken
   (`assessContext`-Effekte, +0,12/−0,1 …), die Per-City-Ratios (`PORT/FACTORY/AIRPORT_PER_CITY`),
   die Spenden-Schwellen. In den Tuner geben = echter neuer Spielraum.
3. **Mehr Eval-Szenarien** (Kartengrößen, Spielerzahlen, Terrains flat/continents/islands,
   `allowedBuildings`-Varianten). Fitness über einen Mix → KI wird ROBUST statt auf eine Bedingung
   überangepasst. Hier hilft mehr Rechenzeit (= Parallelisierung) wirklich.
4. **Optional: große Sweeps auf dem Homelab-Server.** Der Tuner ist ein Headless-Node-Skript, läuft
   auf jeder Maschine mit dem Repo. Lohnt erst, wenn lokale Parallelisierung ausgereizt ist.
5. **Balance-Agent (Vorschlags-/Report-Werkzeug, KEIN Auto-Änderer).** Arena laufen lassen →
   Auffälligkeiten erkennen (z. B. „Kriegsschiffe nie genutzt → evtl. unterpowert", „eine Strategie
   dominiert → OP") → Konstanten-Änderung VORSCHLAGEN (`WARSHIP_COST`, `BOMB_RADIUS` …) → testen →
   BERICHTEN. **Game-Balance bleibt Jonathans Revier** (seine eigene Leitplanke). **Caveat:** Die
   Arena misst KI-gegen-KI — starkes Signal, aber KEINE Wahrheit fürs Menschen-Balancing (Beispiel:
   der Tuner sagt „Städte braucht's kaum", die Design-Intuition will sie wichtig — beide können
   recht haben).

## Offene Justier-Punkte (brauchen Jonathans Playtest/Entscheidung)

- **Fühlt sich Standard (1000) ebenbürtig an?** Nur am Menschen messbar — Jonathan muss spielen, dann
  ggf. `PRESET_ELO.standard`/die Eichung nachregeln.
- **Fühlt sich die kontextbewusste KI im Endgame „richtig" an?** (Führender konsolidiert, Nachzügler
  verbündet sich gegen den Großen, volle/leere Welt.)
- **Kontext-Modulations-Stärken** sind von Hand gesetzt → Kandidaten fürs Tunen (siehe Plan-Punkt 2).
- **Explizite Spielphase** (früh/mittig/spät) als eigenes Signal (aktuell über `crowding` als Proxy).

## Konsequenzen

**Positiv:** Klarer, ehrlicher Fahrplan; Parallelisierung als günstiger Multiplikator; mehr Params/
Szenarien = robustere KI; Balance-Agent als sicheres Werkzeug.

**Negativ / offen:** Alles Verfeinerung, kein Spiel-Transformator — bewusst abzuwägen. Menschen-
Balance bleibt außerhalb dessen, was die Arena messen kann.
