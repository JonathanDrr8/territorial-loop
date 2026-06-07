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
| 2   | `orderedPlayers` cachen (Spieler-Menge invariant) statt ≥6×/Tick neu sortieren | attacks 2,3 ms / Schnitt 4,6 ms | **1,7 ms / ~3,6 ms** (−22 %) | 7d36c83          |
| 3   | `applyFactoryDiplomacy`: credited-Check vor Embargo/Distanz ziehen             | economy max ~14 ms              | ~12 ms (Streuung)            | beea8ad          |

> Hinweis zu #1: minimaler KI-Zielwahl-Effekt in langen Spielen möglich (Top-12-Näherung), im
> Golden-Szenario kein Effekt → Golden unverändert. Von Jonathan wach freigegeben.
> #2/#3 strikt verlustfrei: identisches Ergebnis, nur weniger Arbeit; Resync invalidiert den
> orderedPlayers-Cache (`loadSnapshotInto`). Golden + alle 528 Tests unverändert.

**Endstand (Chaos, 1200 Ticks): Schnitt ~3,6 ms/Tick (war 6,1 vor dem Nachtlauf).** Der katastrophale
KI-Spike (354 ms) ist weg; die stetige Last −22 %. Verbleibende Spikes sind **transient** (trade-BFS-
Warmup) oder **einmalig** (Spawn-Burst) — und nur mit Risiko/Verhaltensänderung weiter senkbar (s.u.).

---

## Verbleibende Spikes (nicht SICHER neutral senkbar → nicht angefasst)

- **trade-Spike (~64–96 ms, transient):** `findWaterPath`-A\*-BFS auf Cache-Misses während des Warmups
  (Random-Handelsziele füllen nach und nach den persistenten Route-Cache → klingt im Spielverlauf ab).
  Pro Port-Paar nur EINMAL, danach O(1). Im Dauerbetrieb kein Problem.
- **intents-Spike (~107 ms, EINMALIG ~Tick 226):** Spawn-/Erst-Bau-Burst beim Match-Anlauf. Einmalig,
  nicht lohnend.
- **attacks (~47 % stetig, aber stabil p99 ~6 ms):** bereits stark optimiert (Scratch-Puffer „Perf R1",
  Capture-Deckel). Kein sicherer neutraler Hebel mehr.

## Ideen für eine BETREUTE Sitzung (Verhaltens-/Determinismus-Risiko → Freigabe + sorgfältige Prüfung)

1. **`findWaterPath` mit epoch-gestempelten Scratch-Arrays** statt `Map<gScore>`/`Map<cameFrom>` —
   größter verbleibender Hebel (senkt den trade-/Boot-/Kriegsschiff-BFS-Spike deutlich). MUSS denselben
   Pfad liefern (Heap-/Expansions-Reihenfolge unverändert lassen). **Risiko:** stiller Determinismus-Bug,
   weil der Trade-BFS-Pfad nur dünn von Tests abgedeckt ist. Vor Übernahme: Äquivalenz-Test (alt vs.
   neu über viele Start/Ziel-Paare) bauen. NICHT unbeaufsichtigt gemacht.
2. **trade-BFS amortisieren** (Routen über Ticks verteilt vorausberechnen) — würde ändern, in welchem
   Tick Schiffe spawnen → **verhaltensändernd** (Golden) → Freigabe nötig.
3. **`planBomber`-Shortlist (#1, bereits drin)** ist eine Näherung; falls die minimal andere Zielwahl
   stört, kann SHORTLIST erhöht oder die Vorauswahl verfeinert werden (Balance-Entscheidung).

## Status für den Morgen

Alles auf Branch **`chore/perf-profiling`** (NICHT nach main gemergt — dein Review). Enthält: Perf-Tooling
(`npm run perf -- chaos --phases`, `scripts/perf-render.md`), planBomber-Fix, orderedPlayers-Cache,
factory-diplo-Micro-Opt. `npm run typecheck && npm run lint && npm run test:run` = grün (528).
