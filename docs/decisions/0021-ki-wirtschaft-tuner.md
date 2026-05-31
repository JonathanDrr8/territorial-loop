# ADR 0021: KI-Wirtschafts-Rückgrat (OpenFront-Stil) + Komposit-Tuner

## Status

Accepted — in Umsetzung (Session 2026-06-01). Aufbauend auf ADR-0020 (5-Stufen-Leiter). Branch
`feature/flugzeuge-bomben`, schrittweise Commits.

## Datum

2026-06-01

## Kontext

Nach ADR-0020 stand eine messbare 5-Stufen-Leiter — aber Spieltests (Jonathan, auf „Experte")
zeigten zwei klare Schwächen, die die Arena nicht erfasst hatte:

1. **Keine echte Wirtschaft.** Daten (Arena-Gold pro Stufe): Experte war die _ärmste_ fähige Stufe
   (~23k Gold), Leicht die reichste (~77k) — weil „Gold" nur Übriggebliebenes war, kein Plan. Die KI
   baute kaum Städte (~0,5/Match), blieb gold-arm, konnte sich darum kaum Bomber/Kriegsschiffe
   leisten. Truppen-Cap (über Städte) wurde nie als Strategie aufgebaut.
2. **Zu wenig Aktivität (APM).** Die KI entschied alle 12–60 Ticks ~1–2 Aktionen → ein „Experte"
   wirkte wie ein Gelegenheitsspieler, nicht wie ein bauwütiger Profi.

Ursache war auch die Fitness: Die ADR-0020-Arena maß **Territorium bei Tick 4000** → reine
Aggression grabscht am schnellsten Land, also tunte die Kalibrierung die Wirtschaft _weg_.

## Recherche (was macht das Feld / OpenFront?)

- **Utility-AI** (gewichtete „Considerations", GameAIPro): Aktionen per gewichteter Summe bewerten,
  Beste wählen — der Standard für tunbare Spiel-KI.
- **Auto-Tuning per Evolutions-Strategie (CMA-ES/EA) über Self-Play**: Gewichts-Vektor definieren,
  Suche optimiert ihn gegen eine Self-Play-Fitness.
- **OpenFront-Bot** (Quellcode `src/core/execution/nation/`, analysiert): KEIN ML, KEINE Utility-AI —
  durchdachte Heuristiken. Schlüssel-Erkenntnisse, die wir übernehmen:
  - **Schwierigkeit = Reaktions-Rate (APM):** Easy 65–100 … Impossible 30–50 Ticks/Handlung.
  - **„Städte zuerst, Rest als Ratio pro Stadt":** Hafen/Fabrik/Flak/Silo je als fixes Verhältnis
    zur Stadtzahl, Stadt immer priorisiert. Platzierung übers Netz (Cluster/closestTile).
  - Bestätigt nebenbei unseren ~42%-Aggressions-Sweet-Spot (gleiche Bell-Curve-Wachstumskurve).

## Entscheidung (Hybrid)

Statt eines vollen Utility-Rewrites (Overkill für das Ziel) ein **Hybrid**:

1. **Wirtschafts-Rückgrat à la OpenFront:** Städte proaktiv (1 je `tilesPerCity`, Profil-Knopf),
   Hafen/Fabrik/Flughafen als **Ratio pro Stadt** (`PORT/FACTORY/AIRPORT_PER_CITY`), Fabrik ans
   Gold-Netz platziert (`pickNetworkTile`). Erster Flughafen für Bomber-Stufen früh (Anti-Aushunger).
2. **APM-Achse:** Entscheidungs-Cooldown skaliert hart mit der Stufe (Experte 9–26 statt 18–60).
3. **Komposit-Fitness** (Jonathans Wahl): `0.5·Sieg + 0.3·Wachstum + 0.2·Economy`, je als Anteil am
   Match-Gesamt — belohnt „reich + großes Heer + dominiert", nicht nur Land.
4. **Kleiner Tuner** (`src/ai/tune.ts` + `npm run ai-tune`): (μ+λ)-Evolutions-Strategie über die
   such-baren Profil-Parameter (attackPct, Cooldowns, popThreshold, build/boat/warship/bomberChance,
   tilesPerCity). Kandidat spielt gegen feste Baseline, Komposit-Score = Fitness. Findet das
   stärkste Profil (= Experte-Optimum); schwächere Stufen werden daraus abgeleitet.

Das ist **kein Machine-Learning** — Hyperparameter-Suche über die Heuristik-Gewichte. Die Arena ist
schnell (~0,2 s/Match) → der ganze Tuning-Lauf dauert Minuten, nicht eine Nacht.

## Ergebnis

(Wird nach dem Tuning-Lauf eingetragen: bestes Profil, neu kalibrierte 5-Stufen-Leiter, Vergleich
Gold/Truppen/Bomber vor/nach, Win-Raten.)

## Konsequenzen

**Positiv:** Echte Wirtschaft (Städte-Rückgrat → Cap → Heer), spürbare APM-Staffelung, Fitness die
Wirtschaft belohnt, per Gewichte verständlich/steuerbar. Profil-Knöpfe sind die Angriffsfläche für
künftiges Tuning.

**Negativ / offen:** Heuristik bleibt handgeschrieben; die Per-City-Ratios sind noch Modul-Konstanten
(nicht per Stufe getunt — später möglich); stärkerer Snowball lässt schwache Stufen öfter sterben
(ggf. Balance-Nachregelung).
