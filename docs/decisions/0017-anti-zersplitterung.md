# ADR 0017: Anti-Zersplitterung — eingeschlossene Fragmente verschlucken

## Status

Accepted — Schritt A (Mechanik) umgesetzt. Schritt B (Allianz-Erneuerung 30 s vor Ablauf)
ist separat geplant und noch offen.

## Datum

2026-05-30

## Kontext

Nationen zersplittern im Spielverlauf in viele kleine, voneinander getrennte Landfetzen.
Bisher gab es dagegen nur zwei punktuelle Mechaniken:

- `fillEnclosedPockets` — füllt **bedingungslos** jedes fremde/neutrale Tile, das nach einer
  Eroberung rundum nur noch vom Angreifer umgeben ist („keine Blasen hinter der Front").
- `annexEncircledWilds` — schluckt eine **ganze** wilde Nation, wenn sie komplett von genau
  einem Spieler umschlossen ist.

Für echte Nationen fehlte eine durchdachte Regel: Ein abgesprengter Fetzen sollte fallen,
ein hart umkämpftes Kerngebiet aber nicht einfach kampflos „weggeschluckt" werden können.

## Entscheidung

Nach **jeder Angriffs-Eroberung** (`advanceAttack` → `annexEnclosedFragments`) wird geprüft,
ob ein zusammenhängendes Stück einer **fremden, nicht verbündeten, nicht-wilden** Nation jetzt
rundum nur noch vom Angreifer (plus Wasser/Berg als Wände) umschlossen ist — kein Fluchtweg in
freie Wildnis, keine dritte Nation angrenzend, **genau ein** Umschließer.

- **Regel 1:** Ist das Fragment **nicht** das flächengrößte Stück der Nation (ein abgesprengter
  Fetzen), fällt es **sofort** — unabhängig von Truppen.
- **Regel 2:** Ist es das **Kerngebiet** (größtes Stück), fällt es nur bei massiver Übermacht:
  effektiver Truppen-**Cap** des Angreifers ≥ **25 ×** Cap der eingeschlossenen Nation.

Beides nur bei **aktivem Angriff** (durch die Eroberung ausgelöst) und **nicht zwischen
Verbündeten**. Wilde Nationen laufen weiter über `annexEncircledWilds` (ganze Nation, ohne
Schwelle). `fillEnclosedPockets` wurde auf **Wildnis + wilde Taschen** beschränkt, damit es die
geregelte Fragment-Mechanik für echte Nationen nicht aushebelt. Gold-Beute anteilig zur
Fragment-Größe; Auslöschung erledigt `checkEliminations`. Kettenreaktionen werden in einer
begrenzten Schleife aufgelöst.

### Warum Cap statt aktueller Truppen

Der **effektive Cap** (`effectiveMaxTroops` = Land-gewichtete Tiles **+ Städte-Bonus**, je
25 000/Stadt-Level) bildet die stabile „Größe/Entwicklung" einer Nation ab — anders als die
volatilen aktuellen Truppen (Kampf, Angriffe). Wichtiger Nebeneffekt: weil **Städte** massiv in
den Cap einfließen, ist eine **entwickelte** kleine Nation praktisch unschluckbar (schon 1 Stadt
hebt die nötige Gegner-Größe von ~10 600 auf ~87 000 Tiles). „Wer investiert/sich verteidigt, ist
geschützt" ist damit ohne Sonderregel eingebaut; nur eine völlig unterentwickelte Winzling-Nation
kann von einem echten Giganten geschluckt werden.

### Warum 25×

Wegen des `^0.6`-Cap-Exponenten ist ein Cap-Verhältnis viel extremer, als es klingt: 25× Cap
entspricht **~500×** mehr Land. Höher (40×) ließe Regel 2 praktisch nie greifen (Kerngebiete
blieben ewige Stacheln); niedriger machte das kampflose Schlucken zu billig. 25× trifft nur
echte Gigant-gegen-Zwerg-Lagen.

## Konsequenzen

- Karten „heilen" über die Zeit: tote Fetzen verschwinden, Fronten bleiben sauberer.
- Das Kerngebiet einer entwickelten Nation muss weiterhin **konventionell** erobert werden.
- `fillEnclosedPockets` schluckt keine echten Feind-Taschen mehr bedingungslos — minimal
  verändertes Frontgefühl, dafür konsistent mit den neuen Regeln.
- Deterministisch (sortierte Seeds, Flood-Fill über Arrays) → Multiplayer-tauglich.

## Offen (Schritt B)

Allianz-**Erneuerung**: in den letzten 30 s vor Ablauf beidseitig verlängerbar (Diplomatie + UI).
