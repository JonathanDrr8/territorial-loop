# Changelog

Was sich im Spiel geändert hat — nur Dinge, die du beim Spielen merkst.

## [Unreleased]

## [0.27.0] – 2026-06-01

### Neu

- **Geteilte Nation (Team-Modus):** Neuer Team-Modus, bei dem mehrere Spieler gemeinsam
  dieselbe Nation steuern — ein Land, eine Farbe, gemeinsames Gold und gemeinsame Truppen.
  Jeder Mitspieler kann angreifen und bauen. In der Mehrspieler-Lobby wählt man über das
  Team-Dropdown, welche Nation man mitsteuert: gleiche Nummer bedeutet zusammen spielen.
  Nicht besetzte Nationen übernimmt die KI. Die Team-Anzahl legt fest, wie viele Nationen
  es insgesamt gibt.

## [0.26.1] – 2026-06-01

### Behoben

- **Hauptstadt ist jetzt eine echte Stadt:** Im Hauptstadt-Modus gibt die Hauptstadt nun
  den Truppen-Limit-Bonus wie jede andere **Stadt** und zählt als deine erste Stadt — der
  **Stern** bleibt weiterhin als Markierung sichtbar. Wer die Hauptstadt erobert, übernimmt
  damit auch die Stadt.

## [0.26.0] – 2026-06-01

### Neu

- **Team gezielt wählen im Mehrspieler:** In der Mehrspieler-Lobby kann jeder Spieler über
  ein Dropdown sein Team selbst wählen — so lässt sich gezielt mit Freunden ins selbe Team
  setzen. Freie Plätze füllt die KI auf, damit alle Teams gleich groß bleiben.

### Geändert

- **Aufgeräumtes Match-Setup:** Die Einstellungen für Team-Anzahl und Team-Größe erscheinen
  nur noch, wenn der Team-Modus aktiv ist — sowohl im Solo-Match-Setup als auch in der
  Mehrspieler-Lobby.

## [0.25.0] – 2026-06-01

### Neu

- **Hauptstadt- und Team-Modus jetzt auch im Mehrspieler:** Beide Modi lassen sich in
  der Mehrspieler-Lobby vom Host einstellen. Mitspieler werden der Reihe nach auf die
  Teams verteilt, freie Plätze füllt die KI auf. So kann man mit Freunden im Team gegen
  andere Teams — oder gegen die KI — antreten.

## [0.24.0] – 2026-06-01

### Neu

- **Hauptstadt-Modus:** Im Match-Setup unter „Modus" einschaltbar. Jede Nation bekommt beim
  Start eine **Hauptstadt**, die mit einem Stern auf der Karte markiert ist. Wird deine
  Hauptstadt erobert, scheidest du sofort aus — egal wie viel Land du sonst noch hältst. Du
  gewinnst, wenn alle gegnerischen Hauptstädte gefallen sind. Die KI drängt in diesem Modus
  gezielt auf feindliche Hauptstädte statt nur auf Gebietsgewinn.
- **Team-Modus:** Ebenfalls unter „Modus" zu finden. Wähle „Teams (verbündet)" sowie Anzahl
  der Teams und Team-Größe per Slider. Teamkameraden kämpfen nie gegeneinander — auch
  KI-Mitspieler nicht. Der Sieg wird gemeinsam gewertet: Das Gebiet aller Teammitglieder
  zählt zusammen. Lässt sich mit dem **Hauptstadt-Modus** kombinieren.

## [0.23.0] – 2026-06-01

### Neu

- **Lautstärke-Regler im Einstellungsmenü:** Im neuen Abschnitt „Audio" gibt es jetzt drei
  Regler — **Gesamt**, **Soundeffekte** und **Musik** — jeweils von 0 bis 100 %. Bei 0 %
  ist der jeweilige Kanal stumm. Die bisherigen An/Aus-Häkchen für Sound und Musik entfallen
  damit.

### Geändert

- **Ausgewogenere Kampf-Musik:** Die Schichten, die der Soundtrack bei hoher Spielintensität
  dazumischt, klingen jetzt leiser und fügen sich besser in den Gesamt-Mix ein.

## [0.22.2] – 2026-06-01

### Behoben

- **Einstellungen werden sofort gespeichert:** Änderungen im Menü (Kamera, Sound, erlaubte
  Gebäude, Flüsse usw.) wurden bisher erst beim Start eines Matches gesichert — wer etwas
  umstellte und die Seite neu lud ohne zu spielen, verlor die Änderung. Jetzt wird jede
  Einstellung sofort beim Ändern gespeichert.

## [0.22.1] – 2026-06-01

### Behoben

- **Häfen nur noch an der Küste:** Ein Hafen ließ sich versehentlich so weit vom Wasser
  entfernt platzieren, dass keine Schiffe mehr gebaut werden konnten. Häfen müssen jetzt
  direkt an Wasser grenzen. Klickt man knapp daneben, rastet der Cursor automatisch aufs
  nächste eigene Küsten-Tile.
- **Boot-Tuten wieder hörbar:** Das tiefe Tuten beim Aussenden eines Transportboots war auf
  vielen Boxen und Laptops kaum wahrnehmbar (zu reiner Ton, zu tief). Der Sound klingt jetzt
  voller und trägt deutlich besser.

## [0.22.0] – 2026-05-31

### Geändert

- **Günstigere Gebäude im großen Maßstab:** Die Baukosten für Städte, Häfen und Fabriken
  steigen zwar weiter mit jedem Bau (25k → 50k → 100k), sind jetzt aber bei **100.000 Gold
  gedeckelt** — statt wie bisher bei 1 Million. Im späten Spiel lässt sich damit deutlich
  günstiger weiter ausbauen.

## [0.21.0] – 2026-05-31

### Neu

- **Soundeffekte:** Drei neue Sounds begleiten jetzt Marinen-Aktionen und Luftangriffe.
  Ein tiefes **Tuten** ertönt, wenn du ein Transportboot ausschickst (nur du hörst es).
  Beim Start eines **Bombers** brummt das Triebwerk — der Angreifer und die angegriffene
  Nation hören es. Beim **Einschlag** der Bombe gibt es einen dumpfen Knall, den alle
  Spieler hören, lauter je näher sie am Geschehen sind. Alle drei Sounds kommen mit
  **Stereo-Richtung**: was links auf dem Bildschirm passiert, kommt von links.
- **Adaptiver Soundtrack (Beta):** Wer Musik mag, kann im Einstellungsmenü **„Musik (Beta)"**
  einschalten. Der Soundtrack passt sich dann der Spielintensität an — je mehr Schlachten
  und Bewegung auf der Karte, desto treibender und voller die Musik. Standardmäßig aus,
  bis der Modus ausreichend erprobt ist.

### Geändert

- **Flak greift früher an:** Die Reichweite eines **Flak-Postens auf Stufe 1** wurde von
  8 auf 10 Felder erhöht. Bomber werden jetzt schon aus etwas mehr Abstand beschossen,
  bevor sie ihre Nutzlast abwerfen können.

## [0.20.0] – 2026-05-31

### Geändert

- **Vollere Welt:** Die Obergrenze für wilde Nationen wurde von 400 auf 600 angehoben. Die
  Schnellwahl-Vorgaben setzen jetzt mehr Wilde (Klein: 120, Standard: 300, Groß: 480,
  Chaos: 600), damit sich die Karte von Anfang an weniger leer anfühlt.

## [0.19.0] – 2026-05-31

### Geändert

- **Große Karten laden jetzt in Sekunden:** Ein Engpass beim Verteilen der Startpositionen
  sorgte dafür, dass Karten mit vielen Nationen extrem lange zum Laden brauchten — 1536×1536
  rund 30 Sekunden, 2048×2048 über eine Minute. Das ist behoben; auch die größten Karten
  starten jetzt in wenigen Sekunden.
- **Belebtere Welt in den Vorgaben:** Die Schnellwahl-Vorgaben **Klein**, **Standard** und
  **Groß** haben jetzt mehr Gegner und mehr wilde Nationen, damit die Karte von Anfang an
  voller Leben wirkt (Klein: 25 KI + 50 wild; Standard: 50 KI + 130 wild; Groß: 75 KI +
  280 wild). **Chaos** bleibt unverändert.

## [0.18.0] – 2026-05-31

### Neu

- **Karten-Vorschau im Match-Setup:** Bevor das Spiel startet, zeigt ein kleines Vorschaubild
  die Karte zum eingestellten Seed — so sieht man schon, ob Kontinente und Inseln passen.
  Der neue **„Würfeln"-Knopf** zieht einen anderen Seed, bis die Karte gefällt.
- **Schnellwahl-Vorgaben:** Vier Knöpfe oben im Setup — **Klein**, **Standard**, **Groß** und
  **Chaos** — füllen Kartengröße, Gegnerzahl und wilde Nationen passend vor. Chaos wirft
  bis zu 150 Gegner auf die Karte.
- **Doppelklick-Boot:** Ein Doppelklick auf Land, das nur über Wasser erreichbar ist, schickt
  sofort einen Truppentransport los — ohne vorher in den Boot-Modus wechseln zu müssen.

### Geändert

- **Handelsverluste im Aktivitätslog:** Wird eines deiner Handelsschiffe von einem feindlichen
  Kriegsschiff abgefangen, zeigt das Log jetzt, wie viel Gold dir dabei entgangen ist.
- **Projektile besser sichtbar:** Schüsse von Kriegsschiffen und Flak-Posten leuchten
  jetzt hellgelb mit Glühen — statt in der oft dunklen Nationsfarbe, die leicht übersehen
  wurde.
- **Flak feuert schneller:** Ein einzelner Flak-Posten holt einen Bomber jetzt zuverlässig
  im Vorbeiflug runter; vorher überlebte der Bomber das häufig.
- **KI breitet sich sauberer aus:** Die KI versucht nicht mehr, Flüsse oder Meeresfelder zu
  erobern — sie konzentriert sich auf erreichbares Land und lässt weniger leeres Gebiet
  zwischen ihren Fronten übrig.

## [0.17.0] – 2026-05-31

### Neu

- **Fluss-Häufigkeit einstellbar:** Wenn Flüsse aktiviert sind, bestimmt ein neuer Regler
  (0,2× bis 3×, Standard 1×), wie dicht die Karte mit Wasserläufen bedeckt wird. Niedrige
  Werte ergeben wenige, breite Flüsse; hohe Werte überziehen die Welt mit einem dichten
  Flussnetz. Die Einstellung gilt sowohl im Einzelspieler als auch in der Mehrspieler-Lobby.

## [0.16.0] – 2026-05-31

### Neu

- **Mehrere Fronten gegen dieselbe Nation:** Bisher wurden alle Angriffe auf eine Nation
  zusammengefasst — ein zweiter Klick an anderer Stelle zog die Truppen von der ersten Front ab.
  Jetzt bündeln sich nur noch Klicks, die **nah an einer bestehenden Front** liegen. Ein Klick
  weiter entfernt an derselben Grenze eröffnet eine **eigene, unabhängige Front** mit eigenen
  Truppen. So lassen sich mehrere Angriffsstöße gleichzeitig führen, ohne dass eine Front die
  andere leersaugt.

## [0.15.0] – 2026-05-31

### Neu

- **Weiterspielen nach dem Match:** Am Match-Ende gibt es jetzt den Knopf **„Weiterspielen"** —
  er schließt das Ergebnis-Fenster, sodass man die beendete Partie noch in Ruhe anschauen kann,
  ohne direkt ins Menü zu müssen.
- **Kamera auf C:** Die Taste **C** zentriert die Kamera sofort auf den Mittelpunkt des eigenen
  Reichs — praktisch nach langen Kampfzügen am anderen Ende der Welt.
- **Namen anklicken:** Alle Nationen-Namen in der **Rangliste** und im **Ereignislog** sind jetzt
  anklickbar. Ein Klick springt die Kamera direkt zur jeweiligen Nation.
- **Platzhalter im HUD-Editor:** Panels, die nur im Spiel aktiv sind (z. B. das Angriffe-Panel,
  wenn gerade kein Kampf läuft), zeigen im Editor jetzt einen **beschrifteten Platzhalter** statt
  eines leeren Kastens. So lassen sie sich sauber positionieren, auch wenn sie aktuell nichts
  anzeigen.

### Geändert

- **Ergebnis-Fenster überarbeitet:** Der Endstand passt jetzt auf jeden Bildschirm — die
  Abschlusstabelle erscheint zweispaltig (Top 16 + „… und X weitere"), und das Fenster trägt das
  gewählte **Spiel-Design** (Theme).
- **Hilfe aktualisiert und besser lesbar:** Die Hilfe beschreibt jetzt die aktuelle Spielversion
  vollständig: Wirtschaft (Fabriken + Fabrik-Netzwerk), Gebäude inkl. **Flugplatz** und **Flak**,
  aktuelle Tastenbelegung. Neu hinzugekommen sind die Themen **Luftkrieg**, **Flüsse**,
  **HUD anpassen** und **Mehrspieler & Ranglisten**. Die Schrift in Hilfe und Changelog ist
  größer und leichter zu lesen. Die Übersetzungen aller **9 Sprachen** wurden mitgezogen.

## [0.14.0] – 2026-05-31

### Neu

- **Alle HUD-Elemente auf einen Blick:** Im „HUD anpassen"-Modus zeigt ein festes Seitenmenü
  jetzt **jedes Element** mit einem Haken — ausgeblendete Panels sind sofort sichtbar und lassen
  sich mit einem Klick wieder einblenden. Kein Rätseln mehr, wo ein Panel geblieben ist.
- **Angriffe-Panel frei positionierbar:** Die laufenden Angriffe und die aktive Abwehr erscheinen
  jetzt in einem **eigenen Panel**, das sich wie jedes andere HUD-Element verschieben und skalieren
  lässt.
- **Eroberungen schaden der Freundschaft:** Wer eine Nation überrennt, verliert sofort die
  aufgebaute **Gunst** mit ihr und zieht sich deren **Groll** zu — je mehr Land genommen, desto
  stärker. Dieser Effekt war schon in der KI-Logik vorhanden, wirkt jetzt aber auch beim Spieler.
  Außerdem: Nationen, auf die gerade gebombt oder gekämpft wird, färben sich **sichtbar rot** — so
  ist auf einen Blick erkennbar, wer gerade angegriffen wird und warum die KI entsprechend reagiert.

### Behoben

- **Ruckler in großen Partien behoben:** In Runden mit vielen Nationen und intensiven
  Gefechten ruckelten die Bilder merklich. Ursache waren die **Gold-Transport-Linien**, die
  tausendfach pro Bild einzeln gezeichnet wurden. Nach der Optimierung läuft das Spiel auch
  mit 80+ Nationen durchgehend flüssig.

## [0.13.0] – 2026-05-31

### Neu

- **Pause-Menü:** Wer **Esc** drückt, landet jetzt in einem richtigen Pause-Menü im Spiel-Design —
  mit den Optionen **Weiter**, **HUD anpassen** und **Runde verlassen**. Die Verlassen-Abfrage
  erscheint also nicht mehr sofort, sondern erst nach einem bewussten Klick.
- **HUD-Editor aus dem Menü heraus einrichten:** In den Einstellungen unter „HUD & Design" gibt
  es den Knopf **„HUD anpassen"**. Ein Klick startet ein kleines, pausiertes Übungs-Match mit
  sofort geöffnetem Editor — so lässt sich das eigene HUD-Layout in Ruhe einrichten, ohne ein
  echtes Spiel starten zu müssen. **„Fertig"** bringt direkt zurück ins Hauptmenü.
- **Werkzeugleiste verschiebbar:** Die Editor-Leiste lässt sich jetzt am **Zieh-Griff oben**
  frei auf dem Bildschirm verschieben — sie verdeckt keine Panels mehr.
- **Einheitliches Design im Startmenü:** Das gewählte Spiel-Design gilt jetzt auch für die
  **Lobby-Liste** und das **Tipps-&-Tricks-Feld** im Startmenü — vorher waren diese Bereiche
  unabhängig davon immer dunkelblau.
- **Tipps & Tricks auf dem Ladebildschirm:** Die Hinweise erscheinen jetzt auch während das
  Match lädt. Der Wechsel zwischen den Tipps läuft **langsamer und mit sanftem Überblenden** —
  so bleibt genug Zeit, sie tatsächlich zu lesen.

### Geändert

- Der schwebende **„HUD anpassen"-Knopf oben links** im laufenden Match ist entfallen. Den
  Editor erreicht man jetzt über **Esc → HUD anpassen** oder über die Einstellungen.

## [0.12.0] – 2026-05-31

### Neu

- **Kanten-Ziehen im HUD-Editor:** Panels lassen sich jetzt nicht nur an den vier Ecken, sondern
  auch an den **Seiten-, Ober- und Unterkanten** ziehen — so ändert man Breite oder Höhe einzeln,
  ohne das Panel in alle Richtungen zu strecken. Besonders praktisch bei Ereignislog und Rangliste.
- **Slider-Position wählbar:** Der Angriffsgrößen-Slider kann jetzt wahlweise im **Aktions-Panel
  bleiben oder zum Truppen-Block wandern** — ein Umschalter im Editor bestimmt das. So liegt der
  Slider genau da, wo er beim eigenen Spielstil am schnellsten erreichbar ist.
- **Kauf-Knöpfe als Numpad:** Die Gebäude- und Einheiten-Knöpfe lassen sich in eine **3×3-Anordnung
  nach Ziffernblock** umschalten (7/8 oben, 4/5/6 Mitte, 1/2/3 unten) — die Tastenpositionen
  stimmen dann 1:1 mit den echten Hotkeys überein, kein Suchen mehr.
- **Pakete aufteilen und zusammenfügen:** Der Truppen-Block (Zahl / Balken / Gold) und der
  Aktions-Block (Käufe / Boot) lassen sich **in Einzelteile zerlegen**, die man dann separat
  platzieren und skalieren kann. Ein weiterer Klick fasst sie wieder zu einem Block zusammen.

Alle vier Funktionen sind über die Werkzeugleiste im HUD-Editor erreichbar, werden lokal
gespeichert und stehen in allen 9 Sprachen zur Verfügung.

## [0.11.0] – 2026-05-31

### Neu

- **HUD-Editor:** Oben links erscheint der Knopf „HUD anpassen". Damit lässt sich jedes
  HUD-Panel **frei verschieben**, an allen vier Ecken **skalieren**, **ausblenden** und wieder
  einblenden. Beim Verschieben snappt das Panel an Bildschirm-Ränder und andere Panels — mit
  Hilfslinien. „Standard" setzt das Layout auf die Werkseinstellung zurück. Das eigene Layout
  wird **lokal gespeichert** und bleibt über Matches hinweg erhalten.
- **Design live umschalten:** Im HUD-Editor lassen sich alle **6 Looks** (Dezent, Taktisch,
  Neon, Kriegskarte, Bathymetrie, Feldemaille) auf Knopfdruck live ausprobieren — das Ergebnis
  ist sofort im Spiel zu sehen.
- **Layout exportieren:** Ein „Export"-Knopf im Editor kopiert das eigene Layout als Code in
  die Zwischenablage — zum Teilen mit anderen oder als Sicherung.
- **Rangliste nach Land sortieren:** Neben der bisherigen Sortierung nach Truppen gibt es jetzt
  auch **„Land" (Territorium-Anteil in %)** — das eigentliche Sieg-Ziel ist damit auf einen
  Blick ablesbar.
- **HUD & Design in den Einstellungen:** Eine neue Sektion im Einstellungs-Menü erlaubt es,
  das Design zu wechseln und das HUD-Layout zurückzusetzen — auch ohne laufendes Match.

### Geändert

- **Das gewählte Design gilt überall:** Nicht nur das HUD im Match, sondern auch das
  **Hauptmenü und die Bündnis-Karten** tragen jetzt den gewählten Look.
- **HUD-Größe pro Panel:** Der globale UI-Größe-Slider ist entfallen. Die Größe jedes Panels
  lässt sich stattdessen direkt im HUD-Editor einzeln anpassen.

## [0.10.0] – 2026-05-31

### Neu

- **Neuer HUD-Look „Kriegskarte":** das ganze Interface trägt jetzt ein einheitliches Design —
  **Leder- und Bronze-Panels**, eigene Schriften, dunklere Töne. Der Look ist lokal gespeichert
  und hat keinen Einfluss auf das Spielgeschehen.

### Geändert

- **Truppen sind jetzt die große Zahl** unten links — sofort lesbar, ohne im Balken zu suchen.
  Der Balken selbst zeigt ruhig den Füllstand ohne Druck-Striche.
- **Ereignislog und Bündnis-Anfragen** laufen jetzt in **einem gemeinsamen Feed** unten rechts
  über der Minimap — kein zweites Fenster mehr, alles an einem Ort. Die neueste Meldung steht
  **unten** (wie ein Chat), die Filter-Knöpfe sind ebenfalls unten.
- **Bau-Knöpfe haben echte Icons** statt Buchstabenkürzel — Stadt, Verteidigung, Hafen und
  Fabrik sind auf einen Blick unterscheidbar. Boot-, Bomber- und Kriegsschiff-Knöpfe zeigen
  passende Schiff-, Flugzeug- und Anker-Icons.
- **Bomber und Kriegsschiff zeigen einen Kapazitäts-Zähler** (z. B. „2/4"), damit du siehst,
  wie viele Slots noch frei sind.
- **Ressourcen-Box hat feste Breite** — die Gold-Anzeige wackelt nicht mehr, wenn die Zahl
  größer wird.
- **Alle Icons einheitlich:** bunte Emojis im HUD, Radialmenü und in Tooltips sind durch ein
  einheitliches Strich-Icon-Set ersetzt — in allen 9 Sprachen.

### Behoben

- **Kriegsschiff-Knopf zeigte grüne Kosten**, obwohl kein Slot mehr frei war — das ist
  behoben, die Kosten-Farbe passt jetzt zum tatsächlichen Zustand.

## [0.9.0] – 2026-05-31

### Neu

- **Ranglisten-Modus:** Eigener „Ranglisten"-Knopf im Play-Menü — du startest bei **ELO 1000** und
  spielst gegen eine KI auf genau deinem Level. Gewinnst du, steigt dein ELO; verlierst du, sinkt
  es — so siehst du über die Zeit, **wie du besser wirst**. Mit Sieg-/Niederlage-Bilanz und
  Höchstwert, alles lokal gespeichert (kein Account nötig).
- **Geschenke (Gunst):** Im Diplomatie-Radialmenü kannst du jetzt **Gold an jede Nation
  verschenken** (über den Slider oder feste 10/25/50/100 %) und **Truppen an Verbündete** schicken.
  Beides erzeugt **Gunst** — und zwar mehr, je großzügiger du gemessen an deinem Vorrat bist. Gut,
  um Groll zu besänftigen oder ein Bündnis zu erkaufen.

### Geändert

- **An jeder Schwierigkeitsstufe steht jetzt die ELO-Zahl** (z. B. „Standard (1000)") — du siehst
  auf einen Blick, wie stark der Gegner ist. Die fünf Stufen sind Punkte auf einer durchgehenden
  Stärke-Skala.
- **Die KI verschenkt selbst Gold — aber nur klug:** eine schwächere KI besänftigt einen stärkeren,
  grollenden Nachbarn mit einem Geschenk, statt blind alle zu bestechen.

## [0.8.0] – 2026-05-31

### Geändert

- **Die KI ist deutlich stärker und schlauer geworden** — und kommt jetzt in **fünf
  Schwierigkeitsstufen** (Anfänger / Leicht / Standard / Fortgeschritten / Experte):
  - Sie **baut eine echte Wirtschaft** (erst Städte fürs Truppen-Limit, dann Häfen und Fabriken)
    statt nur draufloszurennen.
  - Sie spielt die **Profi-Taktik**: viele kleine Dauer-Angriffe statt weniger großer — so bleibt
    ihre Truppenzahl im Wachstums-Optimum und sie überdehnt nie.
  - Höhere Stufen sind **hyperaktiv** (handeln viel öfter), bauen **Flugabwehr**, setzen **Bomber**
    offensiv ein, **heilen Bombenkrater** im eigenen Reich und wägen ab, ob sie ein Feind-Gebäude
    lieber **einnehmen oder wegbomben**.
  - Sie verbündet sich klüger, verrät situationsabhängig, jagt mit Kriegsschiffen Handelsrouten und
    passt sich an, welche Gebäude im Match überhaupt erlaubt sind.
- Jede Stufe ist **per Messung kalibriert** (über tausende KI-gegen-KI-Testmatches), sodass jede
  spürbar stärker spielt als die darunter — von „zum Lernen" bis „richtig fordernd".

## [0.7.0] – 2026-05-31

### Neu

- **Flugzeuge, Bomben & Flugabwehr:** Bau einen **Flughafen**, kauf **Bomber** (die im Hangar
  parken) und wirf **Bomben** auf den Feind. Die Flugzeuge **fliegen physisch** zum Ziel — direkt
  oder im Bogen, um der Flak auszuweichen. Eine Bombe trifft eine **Fläche**: sie tötet Truppen,
  neutralisiert Gebiet, zerstört Gebäude und versenkt Schiffe im Radius — und verschont
  **niemanden**, auch dich und deine Verbündeten nicht.
- **Flugabwehr (Flak):** Türme mit Reichweiten-Ring schießen feindliche Bomber ab. Bomber haben
  Panzerung — mehrere Flaks holen sie sicher runter.
- **Ziel-Vorschau:** Vor dem Abwurf siehst du Flugroute, Einschlagsradius und eine **Warnung, wenn
  die Route durch Flak-Gebiet führt** (wo der Bomber sicher abgeschossen würde).

### Geändert

- **Bomber und Kriegsschiff als Leisten-Knöpfe** mit Kosten — Bomber über Taste 7 oder das
  Radialmenü, Kriegsschiff über Taste 8 (100k Gold).
- **Bombardieren erzeugt massiven Groll** (auch bei unbeteiligten Nationen, aus Angst) und gilt als
  **Verrat**, wenn es Verbündete trifft.

## [0.6.7] – 2026-05-30

### Geändert

- **Wirtschaft fährt jetzt physisch:** Gold kommt nicht mehr aus Luftlinien-Clustern, sondern aus
  **Gold-Fuhren**, die über graue Straßen zwischen deinen Städten/Häfen und der nächsten Fabrik
  pendeln. Jede Fabrik bedient ihre drei nächsten über Land erreichbaren eigenen Gebäude und
  routet um, wenn ein näheres dazukommt. **Näher = mehr Gold pro Zeit** — kompakte Wirtschaften
  lohnen sich von selbst. Bei jeder Anlieferung (Fabrik & Hafen) ploppt kurz das verdiente Gold auf.
- **Mindestabstand zwischen Fabrik und Stadt/Hafen**, damit man sie nicht direkt aufeinander stapelt.
- **Auslands-Verbindungen nur noch Fabrik↔Fabrik** und nur über gemeinsames Land (als graue Straße,
  kein Luftlinien-Strich mehr).
- **Wilde Nationen heißen überall nur noch „wild"** — kein Eigenname mehr (das verwirrte), raus aus
  Rangliste und Ereignislog. Sie betreiben **keine Wirtschaft** und **zerstören Gebäude**, wenn sie
  ein Feld erobern.
- **Viel mehr KI-Namen** (chemische Elemente + Wissenschaftler), damit seltener generische
  „Nation N"-Namen auftauchen.

### Neu

- **Gebäude-Schalter im Match-Setup:** Stadt, Verteidigung, Hafen und Fabrik lassen sich pro Match
  einzeln an-/abschalten — ein deaktivierter Typ kann von niemandem gebaut werden, auch nicht von
  der KI. Im Mehrspieler stellt der Host das für alle ein.
- **Flüsse sind ein reguläres Welt-Toggle** (vorher nur im Experimentell-Panel).

## [0.6.6] – 2026-05-30

### Geändert

- **Eingeschlossene Gebiete fallen dir zu:** Umzingelst du ein abgetrenntes Stück einer Nation
  komplett (kein Fluchtweg, nur du ringsum), verschluckst du es samt anteiliger Gold-Beute. Das
  **Kerngebiet** (größtes Stück) fällt aber nur bei massiver Übermacht (25× Truppen-Kapazität) —
  gut entwickelte Nationen mit Städten bleiben praktisch unschluckbar, und **Verbündete** sind
  ausgenommen. Hält die Karte sauberer und belohnt echtes Einkesseln.

## [0.6.5] – 2026-05-30

### Behoben

- **Hover-Tooltips im Angriffe-Panel erscheinen wieder** — beim Drüberfahren über das Schild steht
  jetzt sofort „Abwehren mit X Truppen", über dem Namen „Zum Angriff springen" (auch beim Abbrechen
  und beim Schiff-Zurückrufen). Vorher zeigte der Browser-Tooltip nie etwas, weil das Panel ständig
  neu gezeichnet wird.

## [0.6.4] – 2026-05-30

### Behoben

- **Das Angriffs-Panel reagiert wieder zuverlässig** — Schild (Abwehren), Name (zum Angriff
  springen) und die Hover-Tooltips funktionieren jetzt. Vorher wurde das Panel ~60×/Sekunde neu
  gezeichnet, wodurch Klicks ins Leere gingen und Tooltips nie auftauchten.

## [0.6.3] – 2026-05-30

### Behoben

- **Nach einem Update siehst du sofort die neue Version.** Bisher konnte der Browser die alte
  Seite „festhalten" (man sah die alte Versionsnummer, obwohl längst neu deployt war, bis man
  manuell hart neu lud). Der Server liefert die Seite jetzt mit korrekten Cache-Regeln aus —
  einmal noch hart neu laden (Strg+Shift+R), danach passiert es nicht mehr.

## [0.6.2] – 2026-05-30

### Behoben

- **Angriffe-Panel eindeutig bedienbar:** Klick auf den **Namen** springt jetzt zum Angriff
  (Kamera), Klick aufs **Schild** wehrt ab. Vorher löste die ganze Zeile die Abwehr aus und das
  Schild war kein eigener Knopf.

### Geändert

- Das Abwehr-Schild zeigt beim Drüberfahren **„Abwehren mit X Truppen"** (X = aktuelle
  Slider-Menge), damit klar ist, wie viel ein Klick einsetzt.

## [0.6.1] – 2026-05-30

### Behoben

- **Gebäude-Upgrades kosten jetzt passend zum Baupreis.** Eine teure, mehrfach eskalierte Fabrik
  (oder Hafen/Stadt) kostet auch beim Aufwerten mehr — vorher war jedes Upgrade immer billig
  (der Grundpreis), egal wie teuer das Gebäude im Bau war.

## [0.6.0] – 2026-05-30

### Neu

- **Karten aus echter Geografie** — **Welt, Europa, Afrika, Australien** mit echten Küstenlinien,
  im Kartentyp-Menü wählbar (Höhen/Berge noch prozedural). Geo-Karten laufen fest als „Box (fest)"
  (eine Welt-Kopie mit harten Rändern) statt zu kacheln.

## [0.5.0] – 2026-05-30

### Neu

- **Flüsse im Terrain** (an, im Experimentell-Panel abschaltbar) — echtes, **befahrbares** Wasser:
  Quellen an Bergen fließen zum Meer, dazu Ströme, die quer durchs Land zwei Meere verbinden.
  Schiffe/Boote können flussaufwärts, Binnen-Küsten werden per Boot erreichbar.
- **Mehrspieler: echte Host-Pause** — nur der Host kann pausieren (hält die Server-Uhr wirklich an,
  alle sehen es); das Tempo ist im Mehrspieler fest auf Standard.
- **Einladungslinks als `…/r/CODE`** (hübscher teilbar) und automatische **Resync-Korrektur**, falls
  ein Client mal aus dem Takt gerät.
- **Wasser** changiert jetzt leicht (Strömungs-Flecken) statt uniform; **unpassierbare Gipfel** sind
  als helle Schnee-/Felsfläche klar erkennbar.

### Geändert

- **HUD aufgeräumt:** Truppen-Anzeige als größere Nodge bündig am oberen Rand; **UI standardmäßig
  größer** (130 %, Slider bis 220 %).
- **Ereignislog** ist ein eigenes Feld mit **Filter** (Diplomatie/Krieg/Wirtschaft) und zeigt das
  **Neueste oben**.
- Nationen-Namen sind jetzt sprach-neutral (auch die wilden — mit „(wild)"-Kürzel).

## [0.4.0] – 2026-05-30

### Neu

- **Das ganze Spiel spricht jetzt 9 Sprachen** — nicht mehr nur das Menü, sondern alles im Match:
  das HUD (Truppen, Gold mit Wirtschafts-Aufschlüsselung, Rangliste, Zeit, Steuerungs-Hilfe,
  Sieg-Bildschirm), das Rechtsklick-Radialmenü (Bauen/Angriff/Boot/Kriegsschiff/Diplomatie/Handel),
  die Gebäude- und Nationen-Tooltips, das Ereignislog, die Bestätigungs- und Feedback-Dialoge und
  die Mehrspieler-Lobby. Umschaltbar oben rechts im Startmenü (Deutsch, Englisch, Spanisch,
  Französisch, Italienisch, Portugiesisch, Russisch, Chinesisch, Japanisch).

## [0.3.0] – 2026-05-30

### Neu

- **Menü in 9 Sprachen:** Deutsch, Englisch, Spanisch, Französisch, Italienisch, Portugiesisch,
  Russisch, Chinesisch und Japanisch — umschaltbar oben rechts. (Das In-Game-HUD folgt.)

## [0.2.4] – 2026-05-30

### Neu

- **HUD aufgeräumt:** die Truppen-Anzeige sitzt jetzt als großes Badge oben in der Mitte, die
  Aktions-Box unten ist kompakter und sitzt bündig am Bildrand — mehr Platz für die Karte.
- **Verteidigungsposten sichtbar:** dezent „verstärkter Boden" + Reichweiten-Ring zeigen, wie
  weit ein Posten schützt.
- **Sprites für Transportboote & Handelsschiffe** (vorher nur Punkte).

### Geändert

- **Fabrik-Verbindungen** sehen wie kleine Straßen aus (Trasse + Mittellinie) statt dünner Linien.

## [0.2.3] – 2026-05-30

### Neu

- **UI-Größe einstellbar:** Slider unten links skaliert das ganze HUD (80–160 %, gespeichert) —
  für alle, denen die Anzeigen zu klein sind.
- **Diplo-Marker auf der Karte:** über dem Namen einer Nation zeigt 🤝, dass sie dir ein Bündnis
  anbietet, und ⛔, dass sie dich embargoiert hat — auf einen Blick erkennbar.

### Behoben

- Bündnis-Anfragen liegen jetzt links und überlappen nicht mehr die aufgeklappte Rangliste.

## [0.2.2] – 2026-05-30

### Neu

- **Eingeschlossene Wilde sofort annektieren:** umzingelst du eine wilde Nation komplett, fällt
  ihr ganzes Gebiet samt Gold-Beute sofort an dich — der Start wird viel dynamischer.

### Geändert

- **Größerer Start:** Spieler beginnen mit mehr Gebiet (organischere Startform).
- **Wilde Nationen** sind größer, aber dünner besiedelt — mehr Land und Beute, weniger Truppen
  pro Fläche.

## [0.2.1] – 2026-05-30

### Neu

- **Terrain deutlich lesbarer:** Relief-Schattierung zeigt Berge, Täler und Küsten; die
  Nationsfarbe liegt nur noch dezent darüber.
- **Warnton,** wenn dich jemand neu angreift; dezenter **Hinweis-Ton** bei neuem Bündnis-Angebot.
- **Beute-Meldung im Log:** wie viel Gold du von welcher Nation erbeutet hast.

### Geändert

- **Eroberung** wächst organischer und zusammenhängend — keine zersplitterten oder
  schnurgeraden Fronten mehr.
- **Bündnis-Angebote** blenden nach 15 s von selbst aus (kein Zukleistern bei vielen Nationen).
- **Namen** off-screen liegender Nationen werden ausgeblendet (Übersicht bei vielen Bots).

### Behoben

- Fabrik-Verbindungslinien werden über den Karten-Rand kurz gezeichnet statt quer über die Karte.

## [0.2.0] – 2026-05-30

### Neu

- **Neues Hauptmenü** mit Kategorien (Spielen, Mehrspieler, Einstellungen, Changelog, Hilfe),
  Sprachwahl Deutsch/Englisch und einer Hilfe-Seite, die die Spielmechaniken erklärt.
- **Laufende Spiele zuschauen:** im Lobby-Browser erscheinen laufende Matches mit einer groben
  Karten-Vorschau — per Klick als Zuschauer beitreten.
- **Tipps & Tricks** auf der Startseite (wechselnde Hinweise).
- **„Handel mit allen stoppen":** globaler Schalter im Rechtsklick-Menü auf eigenem Gebiet —
  legt den Handel mit allen Nationen auf einmal still (Häfen & Fabriken) bzw. erlaubt ihn wieder.

### Geändert

- **Rechtsklick-Menü** ist jetzt ein Ring aus Kuchenstücken — eine kleine Mausbewegung in die
  Richtung genügt zum Auswählen.
- **Bauen** läuft jetzt über die HUD-Knöpfe (1–4) statt übers Rechtsklick-Menü; das Menü auf
  eigenem Gebiet ist für Diplomatie/Wirtschaft da.

## [0.1.1] – 2026-05-29

### Neu

- **Private und öffentliche Lobbys:** öffentliche erscheinen im Lobby-Browser, private nur per
  Code oder Einladungslink.
- **Einladungslinks** öffnen das Spiel direkt in der richtigen Lobby.
- **Zufälliger Spielername** für jeden — statt überall „Du".

### Behoben

- „Wieder verbinden" erscheint nur noch, wenn das Spiel wirklich noch läuft.

## [0.1.0] – 2026-05-29

Erste online spielbare Fassung.

### Neu

- **Mehrspieler:** Lobby mit Raum-Code, Lobby-Browser für offene Spiele, Wieder-verbinden nach
  Verbindungsabbruch.
- **Wirtschaft über Fabrik-Netzwerke** — Verbindungen zu anderen Nationen bringen mehr Gold.
- **Schiffe:** Kriegsschiffe, Handelsschiffe und Transportboote.
- **Diplomatie** mit Bündnissen und Verrat (Verräter werden sichtbar geächtet).
- **Beziehungen** (Groll & Gunst), **wilde Nationen**, **Terrain mit Höhen** und mehrere
  **Kamera-Darstellungen**.
