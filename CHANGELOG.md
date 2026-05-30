# Changelog

Was sich im Spiel geändert hat — nur Dinge, die du beim Spielen merkst.

## [Unreleased]

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
