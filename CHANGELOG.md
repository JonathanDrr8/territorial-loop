# Changelog

Was sich im Spiel geändert hat — nur Dinge, die du beim Spielen merkst.

## [Unreleased]

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
