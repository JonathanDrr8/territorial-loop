# Changelog

Was sich im Spiel geändert hat — nur Dinge, die du beim Spielen merkst.

## [Unreleased]

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
