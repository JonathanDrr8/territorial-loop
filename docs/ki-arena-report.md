# KI-Arena-Report (ADR-0020)

**Stand:** 2026-05-31 · Branch `feature/flugzeuge-bomben` · `npm run ai-arena`
**Setup:** 40 Seeds · Karte 96² · `continents` · max 4000 Ticks · Roster 2× jede Stufe · Anker `standard`=1000

Dieser Report ist die Daten-Grundlage für Balance-Entscheidungen. Er entsteht aus der
Selbstläufer-Arena (KI gegen KI, headless, deterministisch). **Kein Machine-Learning** — die
Zahlen _messen_ die handgetunte Heuristik; Tuning passiert von Hand, der nächste Lauf zeigt die
Wirkung.

## ELO-Leiter (Endstand)

| Stufe                          | ELO  | Ø-Gebiet | Überlebt | schlägt die Stufe darunter |
| ------------------------------ | ---- | -------- | -------- | -------------------------- |
| **expert** (Experte)           | 1164 | 18,1 %   | 92,5 %   | 59,7 %                     |
| **advanced** (Fortgeschritten) | 1094 | 16,1 %   | 87,5 %   | 63,1 %                     |
| **standard** (Standard, Anker) | 1000 | 8,9 %    | 75,0 %   | 65,3 %                     |
| **easy** (Leicht)              | 896  | 5,1 %    | 62,5 %   | 79,1 %                     |
| **beginner** (Anfänger)        | 660  | 0,1 %    | 16,3 %   | —                          |

**Monoton** über ~490 ELO. Jede Stufe schlägt die darunterliegende in ≈60–79 % der direkten
Territorium-Vergleiche — also eine **klar spürbare** Schwierigkeits-Stufe pro Schritt.

**Warum die Spitze enger ist (expert vs advanced 59,7 %):** Beide spielen nahe am Aggressions-
Optimum (~42 % Truppen-Einsatz). Empirisch: 50 % Einsatz ist bereits _schwächer_ als 42 % (die
Truppen zerfasern, man überdehnt). Es gibt also eine Decke — „besser als optimal" geht nicht. Der
Abstand expert↔advanced ist ein echter, aber kleiner Vorsprung. Das ist beabsichtigt und ehrlich:
Wer advanced zu leicht findet, bekommt mit expert einen verlässlich, aber nicht erdrückend stärkeren
Gegner.

**ELO ist relativ** zu diesem KI-Pool, nicht absolutes Skill-Maß. Die anfänglichen Zielwerte
(600/800/1000/1300/1600) waren grobe Anker; real liegt die Leiter bei 660–1164, weil ~1100 hier
schon nahezu perfektes Spiel ist.

## Fähigkeits-Staffelung (capability-gated)

| Fähigkeit                   |   beginner   |   easy    | standard | advanced | expert  |
| --------------------------- | :----------: | :-------: | :------: | :------: | :-----: |
| Expansion / Land-Angriff    |      ✓       |     ✓     |    ✓     |    ✓     |    ✓    |
| Wirtschaft (Bau)            |      –       |     ✓     |    ✓     |    ✓     |    ✓    |
| Diplomatie + Kriegsschiffe  |      –       | (minimal) |    ✓     |    ✓     |    ✓    |
| defensive Flak              |      –       |     –     |    ✓     |    ✓     |    ✓    |
| Krater-Heilung              |      –       |     –     |    ✓     |    ✓     |    ✓    |
| offensive Bomber            |      –       |     –     |    –     |    ✓     |    ✓    |
| Aggression Richtung Optimum | sehr niedrig |  niedrig  |  mittel  |   hoch   | optimal |

Die KI prüft vor jeder Aktion `isBuildingAllowed` + Infrastruktur/Gold → bei im Karteneditor
**deaktivierten Gebäuden** fällt der Zweig einfach weg (getestet: `tests/arena.test.ts` „läuft mit
deaktivierten Gebäuden ohne Crash"). Keine Spezialfälle pro Kombination.

## Nutzungs-Statistik (Ø Aktionen pro Nation/Match) — Balance-Beobachtungen

| Aktion         | expert | advanced | standard | easy | beginner |
| -------------- | -----: | -------: | -------: | ---: | -------: |
| attack         |   88,4 |     67,7 |     50,4 | 32,0 |     16,8 |
| build:defense  |   16,4 |     12,2 |      5,8 |  2,3 |        – |
| boat           |   11,3 |      9,2 |      5,1 |  1,4 |        – |
| build:flak     |    3,2 |      2,8 |      2,0 |    – |        – |
| build:port     |    2,0 |      2,0 |      1,9 |  1,0 |        – |
| build:airport  |    0,9 |      1,1 |        – |    – |        – |
| launch-bomber  |    0,5 |      0,8 |        – |    – |        – |
| build:city     |    0,6 |      0,4 |      0,6 |  1,1 |        – |
| launch-warship |    0,1 |      0,1 |      0,3 |  0,1 |        – |

### Auffälligkeiten & Empfehlungen für Jonathan

1. **Kriegsschiffe werden fast nie gestartet (~0,1–0,3/Match).** Die KI baut Häfen (für Handel),
   aber kauft kaum Kriegsschiffe. Mögliche Ursachen: 100k ist teuer relativ zum Nutzen (nur
   Handels-Blockade + Schiff-gegen-Schiff), und der KI-Trigger ist eng (Gegner-Hafen mit
   angrenzendem Wasser nötig). **Empfehlung:** Falls Kriegsschiffe im Spiel präsenter sein sollen,
   entweder Kosten senken oder Wirkung/Reichweite erhöhen — rein am KI-Verhalten liegt es nicht
   allein, das Werkzeug ist für den Aufwand schlicht selten lohnend. (Klein/umkehrbar: `WARSHIP_COST`
   in `src/core/ships.ts`.)
2. **Bomber sind ein bewusster Nischen-Gold-Sink (~0,5–0,8/Match bei advanced/expert).** Sie
   bewegen das ELO nur wenig — eine Bombe (25–75k) zerstört Infrastruktur + Truppen lokal, gewinnt
   aber kaum Territorium. Das ist balance-technisch gesund (keine Auto-Win-Waffe). **Wenn du
   Luftkrieg prominenter willst:** `AIRCRAFT_COST` senken oder Bomben-Radius/-Wirkung erhöhen
   (`BOMB_RADIUS`, `BOMB_TROOP_KILL_*` in Core). Aktuell fühlt sich „teuer, situativ" richtig an.
3. **Städte werden selten gebaut (~0,4–1,1/Match).** Der Truppen-Cap aus Gebiet reicht meist; eine
   Stadt lohnt nur unter Cap-Druck. Kein Bug — eher ein Hinweis, dass Städte als eigene
   Bau-Entscheidung schwach sind. Beobachten.
4. **Verteidigungsposten dominieren den Bau** (bis 16/Match bei expert). Flache Kosten machen sie
   zur Standard-Wahl. Falls Bau-Vielfalt gewünscht: Verteidigungs-Eskalation leicht anheben.

## Reproduzieren / Weiter-Tunen

```bash
npm run ai-arena                      # Default: 20 Seeds, alle 5 Stufen
npm run ai-arena -- --seeds 40        # mehr Seeds = weniger Rauschen
npm run ai-arena -- --roster expert,advanced,advanced --anchor advanced
npm run ai-arena -- --terrain flat --rivers   # andere Bedingungen
```

Aggressions-Knöpfe je Stufe in `src/ai/ai.ts` (`PROFILES`): `attackPct`, `cooldownMin/Max`,
`popThresholdForPvp`, `buildChance`. **Sweet Spot Aggression ≈ 42 % Truppen-Einsatz** — darüber wird
die KI schwächer.
