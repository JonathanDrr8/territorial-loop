# ADR 0020: KI-Rework (Lage-Bewertung) + Selbstläufer-Arena mit ELO

## Status

Accepted — **umgesetzt** (Session 2026-05-31, autonomer Über-Nacht-Lauf). Stufen 0–4 abgeschlossen,
je eigener Commit auf `feature/flugzeuge-bomben`. Ergebnis siehe „Endstand" unten + Balance-Report
`docs/ki-arena-report.md`.

## Datum

2026-05-31

## Kontext

Die KI (`src/ai/ai.ts`) ist ein **Würfel-Menü**: pro Entscheidungs-Tick würfelt sie und macht
_eine_ Aktion aus einer festen Liste (Land-Angriff, evtl. Boot/Kriegsschiff/Bau/Diplomatie),
weitgehend **ohne die Lage zu lesen**. Sie fragt nie „werde ich gerade bombardiert?", „lohnt es,
die Fabrik des Gegners zu zerstören statt sie einzunehmen?", „bin ich eingekesselt?".

Mit ADR-0019 (Flugzeuge/Bomben/Flak) kamen Werkzeuge dazu, die die KI **gar nicht kennt**: kein
Flughafen, keine Flak, keine Bomber. Außerdem kann man im Karteneditor Gebäude **deaktivieren**
(`allowedBuildings`) — die KI muss auch _ohne_ bestimmte Werkzeuge sinnvoll spielen, ohne dass wir
für jede Kombination eine eigene Taktik schreiben.

Zusätzlich fehlt jedes **Maß** für KI-Stärke. „hard fühlt sich stärker an als normal" ist nicht
überprüfbar; ob ein Tuning-Schritt die KI wirklich verbessert oder nur verändert, ist blind.

## Entscheidung

### 1. Architektur-Wechsel: Lage lesen → bewerten → besten Zug

Statt „würfeln, welche Aktion": Die KI liest **einmal pro Entscheidung die Lage** (werde ich
bombardiert / wo? welche Front ist unter Druck? habe ich neutralisierte Löcher im Reich? wo hat ein
Feind ein dichtes Infrastruktur-Nest? habe ich Flughafen+Bomber bereit? bin ich Flak-blind?),
**bewertet alle erlaubten & möglichen Aktionen** lage-abhängig und führt die beste aus.

**Capability-gated:** Die KI nimmt nie an, dass ein Werkzeug existiert — sie prüft vor jeder Aktion
`isBuildingAllowed` + Infrastruktur/Gold. Ein deaktiviertes Gebäude ist damit ein leeres Menüfeld,
kein Spezialfall. Das ist robuster als heute, nicht komplizierter — eine Denkweise statt N
Taktik-Sets.

### 2. Selbstläufer-Arena (`src/ai/arena.ts`, `src/ai/elo.ts`, `npm run ai-arena`)

Headless KI-gegen-KI in derselben deterministischen Sim (`createGame`+`tick`), gedeckelte
Match-Länge, Territorium-Score. Liefert **ELO pro Profil** (Standard auf **1000** verankert) +
**Nutzungs-Statistik** (wie oft nutzt die KI welche Aktion). Das ist **kein Machine-Learning** — die
KI lernt nichts; die Arena _misst_ nur, getunt wird von Hand an den Heuristik-Konstanten, und der
nächste Lauf zeigt, ob es geholfen hat. Dient zugleich als **Regressions-Schutz** (fällt das ELO
nach einem Umbau, ist die KI schwächer geworden) und als **Balance-Lupe** (Nutzungs-Häufigkeiten
zeigen ungenutzte/überstarke Mechaniken).

Performance: ~0,37s pro Match (9 KIs, 2000 Ticks) → hunderte Matches in Sekunden, problemlos
nacht-tauglich für viele Tuning-Iterationen.

### 3. ELO-Leiter (Anker 1000), Luftkrieg als Fähigkeit auf der Leiter

5 Stufen (Namen Platzhalter, frei umbenennbar): Anfänger ~600 (nur Expansion), Leicht ~800
(+Wirtschaft), **Standard 1000** (+Diplomatie/Kriegsschiffe/**defensive Flak**), Fortgeschritten
~1300 (+**offensive Bomber**/Lage-Reaktion/Krater-Heilung), Experte ~1600 (alles optimal,
annektieren-vs-zerstören). Luftkrieg ist damit eine _gestaffelte Fähigkeit_ (unter 1000 am Boden, ab
Standard Flak, darüber Bomber) statt ein binäres „alle oder nur Hard". Die ELO-Zahlen sind
Zielwerte — die echten fallen aus der Arena, die Profile werden bis ~dahin justiert.

### Stufen-Plan

- **Stufe 0** (dieser Commit): Arena + ELO-Auswertung + Kriegsschiff-Cap-Bug-Fix
  (`ai.ts` nutzte `MAX_WARSHIPS_PER_PLAYER=3` statt der Hafen-Level-Kapazität `warshipCapacity`).
  Mess-Fundament steht, Baseline dokumentiert.
- **Stufe 1**: Lage-Einschätzung + defensive Flak (KI baut Flak wo bedroht/wertvoll, reagiert auf
  eingehende Bomber).
- **Stufe 2**: offensive Bomber (Flughäfen bauen, Bomber kaufen, Zielwahl: Infrastruktur-Nester +
  Groll-Vergeltung, Flak-Route-Abwägung).
- **Stufe 3**: Bombenkrater im eigenen Reich heilen, annektieren-vs-zerstören, Schiffe/Boote
  gezielter lenken.
- **Stufe 4**: 5-Stufen-Leiter + ELO-Kalibrierung, wilde Nationen bleiben passiv.

## Baseline (vor dem Rework, 30 Seeds · 96² · continents · 4000 Ticks)

| Profil | ELO  | Ø-Gebiet | Überlebt |
| ------ | ---- | -------- | -------- |
| hard   | 1015 | 15,3%    | 86,7%    |
| normal | 1000 | 13,8%    | 88,9%    |
| easy   | 756  | 3,2%     | 47,8%    |

**Befund:** Die heutige 3-Stufen-Leiter ist real eher 2-stufig — `hard` schlägt `normal` nur in
**52,6%** (Münzwurf), während `easy` klar abfällt (80% Niederlage gegen beide). Kriegsschiffe werden
kaum genutzt (launch-warship ~0,2–0,6/Match), Städte fast nie gebaut (~0,2–1,3), Angriff dominiert
alles. Bomber/Flak: 0 (KI kennt sie nicht). Der Rework muss die Stufen-Abstände verbreitern und die
ungenutzten Mechaniken aktivieren.

## Endstand (nach Stufe 4, 40 Seeds · 96² · continents · 4000 Ticks)

Die 5-Stufen-Leiter (`'beginner' | 'easy' | 'standard' | 'advanced' | 'expert'`) ist **monoton**,
Anker `standard`=1000:

| Stufe                      | ELO  | schlägt die Stufe darunter |
| -------------------------- | ---- | -------------------------- |
| expert (Experte)           | 1164 | 59,7 %                     |
| advanced (Fortgeschritten) | 1094 | 63,1 %                     |
| standard (Standard)        | 1000 | 65,3 %                     |
| easy (Leicht)              | 896  | 79,1 %                     |
| beginner (Anfänger)        | 660  | —                          |

Jede Stufe schlägt die darunterliegende in ≈60–79 % — eine klar spürbare Schwierigkeit pro Schritt.
Die Spitze (expert vs advanced 59,7 %) ist enger, weil beide nahe am Aggressions-**Optimum** (~42 %
Truppen-Einsatz) spielen — darüber wird die KI nachweislich schwächer (Decke der Spielstärke). Luft-
krieg ist gestaffelt (defensive Flak ab standard, offensive Bomber ab advanced) und capability-gated
(passt sich an deaktivierte Gebäude an). Alle 5 Stufen sind im UI (Einzelspieler-Menü + MP-Lobby) in
9 Sprachen wählbar. Details + Balance-Beobachtungen (Kriegsschiffe/Bomber/Städte selten genutzt) im
Report. ~375 Tests grün.

## Konsequenzen

**Positiv:** Messbare, gestaffelte Schwierigkeit; Regressions-Schutz; Balance-Hinweise aus echten
Daten; KI passt sich automatisch an deaktivierte Gebäude an; Fundament für eine spätere
Spieler-Rangliste (die getunten Profile = die Schwierigkeitsstufen).

**Negativ / offen:** Heuristik bleibt handgeschrieben (kein Selbst-Lernen); ELO misst nur relative
Stärke der Profile gegeneinander, nicht gegen Menschen; die Stufen-Namen sind noch Platzhalter.

**Spieler-ELO/Ranked-Ladder** bleibt bewusst **außen vor** (braucht Accounts/Persistenz/Matchmaking
— eigene spätere Ausbaustufe).
