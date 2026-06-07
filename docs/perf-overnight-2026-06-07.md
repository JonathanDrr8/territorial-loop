# Perf-Nachtarbeit 2026-06-07 (autonom)

**Auftrag (Jonathan, vor dem Schlafen):** Performance iterativ optimieren, **ohne Gameplay zu ändern**.
Gameplay-ändernde Ideen nur vermerken, nicht umsetzen. Am Ende PC ausschalten.

**Sicherheits-Regel:** Eine Optimierung gilt nur dann als „verhaltensneutral", wenn der **Golden-Hash**
(`tests/hotpath-golden.test.ts`) danach **identisch** ist UND alle Tests grün. Andernfalls: revertieren
und als Idee unten vermerken.

**Werkzeug:** `npm run perf -- chaos --phases --ticks 1200` (Phasen-Aufschlüsselung + ai-decide-Breakdown

- langsamste Ticks). Render ist separat sauber gemessen (stabil 60 FPS, nicht das Problem).

**Branch:** `chore/perf-profiling` (nicht nach main gemergt — Morgen-Review).

---

## Umgesetzt (verhaltensneutral, Golden identisch)

| #   | Was                                                                            | Vorher                          | Nachher                      | Commit           |
| --- | ------------------------------------------------------------------------------ | ------------------------------- | ---------------------------- | ---------------- |
| 0   | Perf-Tooling: `--phases` + ai-decide-Breakdown + Render-Snippet                | —                               | —                            | d7882d1, 2c710a7 |
| 1   | `planBomber`: Flughäfen einmal sammeln + Top-12-Vorauswahl statt alle Ziele    | ai:bomber **354 ms** Spike      | **38 ms** (9×)               | 1ab8d0e          |
| 2   | `orderedPlayers` cachen (Spieler-Menge invariant) statt ≥6×/Tick neu sortieren | attacks 2,3 ms / Schnitt 4,6 ms | **1,7 ms / ~3,6 ms** (−22 %) | (dieser)         |

> Hinweis zu #1: minimaler KI-Zielwahl-Effekt in langen Spielen möglich (Top-12-Näherung), im
> Golden-Szenario kein Effekt → Golden unverändert. Von Jonathan wach freigegeben.
> #2 ist strikt verlustfrei: identische id-sortierte Liste, nur einmal berechnet; Resync invalidiert
> den Cache (`loadSnapshotInto`). Golden + alle 528 Tests unverändert.

Stand nach #2 (Chaos, 1200 Ticks): Schnitt **~3,6 ms/Tick** (war 4,6). Verbleibende Spikes: **trade**
(max ~80–96 ms — BFS-Warmup, klingt ab, da Random-Ziele den Route-Cache füllen) und **intents** (~97 ms,
einmalig ~Tick 226, Spawn-Burst). `attacks` p99 9,2 → 6,6 ms.

---

## Befunde / nächste Kandidaten

- **trade-Spike (~85 ms):** `spawnTradeShips`/`advanceTradeShips` — Ursache noch zu finden.
- **intents-Spike (~76 ms, einmalig):** wahrscheinlich Spawn-/Bau-Burst, evtl. nicht lohnend.
- **attacks (48 % stetig):** größter Dauerposten, aber stabil — neutrale Micro-Opts schwierig.

## Gameplay-ändernde Ideen (NICHT umgesetzt — für Jonathans Freigabe)

_(wird gefüllt, falls eine Optimierung Verhalten/Balance berühren würde)_
