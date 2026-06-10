# Features — territorial-loop

Vollständige Übersicht aller Spielfeatures, nach Themen gruppiert. Gedacht als schneller
Überblick „was kann das Spiel alles" — für Jonathan (Design) und für Claude (Kontext).

**Pflege:** Bei jedem neuen Feature hier eine Zeile ergänzen. Details stehen in den ADRs
(`docs/decisions/`), die Spieler-Sicht im `CHANGELOG.md`, der technische Aufbau in `Architecture.md`.
Stand: v0.29.1.

---

## Welt & Karte

- **Torus-Topologie** — die Welt hat keine Ränder: rechts raus = links rein (analog Nord/Süd), Kamera wrappt mit
- **Terrain mit Höhen** — 4 Höhenstufen, erdähnliches FBM-Noise (Kontinente/Inseln), Relief-Schattierung, unpassierbare Gipfel
- **Kartentypen** — Offen (kein Wasser), Kontinente, Inseln
- **Geo-Karten** — Welt, Europa, Afrika, Australien aus echten Küstenlinien (Höhen prozedural)
- **Flüsse** — navigierbares echtes Wasser, beim Generieren gecarved (Quellen an Bergen → Meer); Dichte einstellbar (0,2×–3×); reguläres Welt-Toggle
- **Kartengröße** — 256² bis 2048², große Karten laden in Sekunden
- **Karten-Vorschau + „Würfeln"** — Vorschaubild zum Seed vor dem Start, neuer Seed per Knopf
- **Kamera-Darstellungen** — 4-stufig: Kacheln / Box nahtlos / Box fest (harte Ränder) / Dynamische Box

## Spielziel & Modi

- **Territorium-Sieg** — Standard: X % der Welt erobern (einstellbar)
- **Hauptstadt-Modus** — jede Nation startet mit Hauptstadt (echte Stadt + Stern); erobert = raus; Sieg = letzte Seite übrig
- **Team-Modus (verbündet)** — Teams aus verbündeten Nationen, kein Friendly Fire, gemeinsame Gebiets-Wertung; Team-Anzahl + Größe per Slider
- **Geteilte Nation** — mehrere Spieler steuern dieselbe Nation (ein Land, gemeinsames Gold/Truppen)
- **Gebäude-Schalter** — Stadt/Verteidigung/Hafen/Fabrik/Flugplatz/Flak pro Match einzeln an-/abschaltbar
- **Schnellwahl-Vorgaben** — Klein / Standard / Groß / Chaos (Kartengröße, Gegner, Wilde vorgefüllt)
- Modi sind **kombinierbar** und in Solo + Mehrspieler verfügbar

## Expansion & Kampf

- **Organische Eroberung** — zusammenhängend wachsende Fronten, Spawn-Blobs, Terrain formt die Ausbreitung
- **Dichte-erhaltende Eroberung** — 2:1-Übermacht = komplette Einnahme; Truppen schmelzen über dem Cap ab
- **Mehrere Fronten** — Klicks nah an einer Front bündeln sich, weiter entfernt öffnet eine eigene unabhängige Front
- **Aktive Abwehr** — Truppen 1:1 gegen eingehende Angriffe einsetzen
- **Angriff-Abbruch** — zieht über ~2,5 s zurück statt sofort
- **Gold-Beute beim Erobern** — anteilig, auch von Wilden; Beute-Meldung im Log
- **Einkesseln** — komplett umzingelte abgetrennte Gebiete (samt Beute) fallen dir zu; Kerngebiet nur bei massiver Übermacht; Verbündete ausgenommen
- **Wilde sofort annektieren** — komplett umzingelte wilde Nation fällt sofort ganz an dich

## Steuerung

- **Angriffsgrößen-Slider** — wie viel deiner Truppen ein Angriff einsetzt
- **Shift+Linksklick** — Rundum-Ausbreiten/Angriff entlang der ganzen Grenze
- **Shift+Mausrad** — Angriffsgröße in 1 %-Feinschritten
- **Bau-Hotkeys** — 1–4 (Gebäude), 7 (Bomber), 8 (Kriegsschiff)
- **Rechtsklick-Radialmenü** — Bauen/Angriff/Boot/Kriegsschiff/Diplomatie/Handel als Kuchenstück-Ring
- **Doppelklick-Boot** — Doppelklick auf nur-über-Wasser-erreichbares Land schickt sofort einen Transport
- **Tasten** — C (Kamera aufs eigene Reich zentrieren), Esc (Pause-Menü)
- **Hover-Snapping** — schnappt auf nächstes Schiff/Gebäude bzw. Bau-Upgrade-Ziel

## Wirtschaft

- **Gold über Fabrik-Netzwerke** — Wirtschaft hängt an Fabriken, nicht an Gebietsgröße
- **Physische Gold-Fuhren** — Gold pendelt auf grauen Straßen zwischen Städten/Häfen und der nächsten Fabrik; näher = mehr Gold/Zeit
- **Auslands-Verbindungen** — nur Fabrik↔Fabrik über gemeinsames Land, bringen das 3-fache Gold
- **Baukosten-Eskalation** — 40k → 80k → 150k pro Bau, bei 150.000 gedeckelt; Hafen & Fabrik teilen sich die Basis (frühes „Entweder-Oder")
- **Economy-Aufschlüsselung** — aufklappbares HUD-Panel + Live-Tooltips (Fabrik-Beitrag, Upgrade-Nutzen); Gold-Rate zählt nur Einnahmen

## Gebäude

- **Stadt** — hebt das Truppen-Limit
- **Verteidigungsposten** — Reichweiten-Ring, schützt Umgebung (bei Eroberung nicht übernommen)
- **Hafen** — Handelsschiffe (Level = Anzahl Schiffe), an Wasser gebunden
- **Fabrik** — Knotenpunkt des Gold-Netzwerks
- **Flugplatz** — baut/parkt Bomber
- **Flak** — schießt feindliche Bomber ab
- **Upgrades** — alle Gebäude aufwertbar; Upgrade-Kosten skalieren mit dem (eskalierten) Baupreis
- **Hover-Tooltips** — Effektwert je Level, Verteidigungs-Reichweiten-Ring beim Hover

## Seekrieg

- **Transportboote** — amphibisch, explizit per Boot-Modus, rückrufbar, dürfen über Wasser flankieren; Lande-Marker + Versand-Warnung
- **Handelsschiffe** — bringen Gold; Zielwahl als Hafen-Modus (Zufall/Nächste/Weiteste/nur Verbündete)
- **Kriegsschiffe** — Handelsblockade + Schiff-gegen-Schiff; fangen feindliche Handelsrouten ab; Piraterie erbeutet die Fracht; Neutral-Toggle
- **Handel global stoppen** — Schalter legt Handel mit allen Nationen still

## Luftkrieg

- **Bomber** — fliegen physisch zum Ziel (direkt oder im Bogen um Flak); Flächenschaden (Truppen/Gebiet/Gebäude/Schiffe), verschont niemanden — auch Verbündete nicht
- **Flak** — Türme mit Reichweiten-Ring, Bomber haben Panzerung (mehrere Flaks nötig)
- **Ziel-Vorschau** — Flugroute, Einschlagsradius, Warnung bei Route durch Flak-Gebiet
- Bombardieren erzeugt **massiven Groll** + gilt als **Verrat** gegen Verbündete

## Diplomatie & Beziehungen

- **Allianzen & Verrat** — Verräter werden sichtbar geächtet
- **Embargos** — Handelssperren
- **Interaktives Bündnis-Panel** — Angebote direkt Akzeptieren/Ablehnen/Ignorieren; Angebote blenden nach 15 s aus
- **Beziehungssystem (Groll & Gunst)** — Seekrieg/Embargo/Eroberung → Groll; Handel/Fabrik-Nachbarschaft/Geschenke → Gunst; beide klingen ab, treiben Grenz-Tints + KI-Zielwahl
- **Geschenke** — Gold an jede Nation, Truppen an Verbündete → erzeugt Gunst (mehr je großzügiger relativ zum Vorrat)
- **Diplo-Marker** — auf der Karte erkennbar (Bündnisangebot / Embargo)

## Nationen-Typen

- **Spieler** — du (Solo oder mehrere im Mehrspieler)
- **KI** — bis 200, echte Gegner mit voller Mechanik-Nutzung
- **Wilde Nationen** — bis 600, passiver Spielertyp; breiten sich passiv in der Wildnis aus; halbe Gold-Produktion; zerstören eroberte Gebäude; keine Eigennamen („wild")

## Künstliche Intelligenz

- **5 Schwierigkeitsstufen** — Anfänger / Leicht / Standard / Fortgeschritten / Experte, je mit angezeigter ELO-Zahl; per tausende Testmatches kalibriert (monotone Leiter)
- **Echte Wirtschaft** — erst Städte (Truppen-Limit), dann Häfen/Fabriken
- **Profi-Taktik** — viele kleine Dauer-Angriffe statt weniger großer (Wachstums-Optimum, kein Überdehnen)
- **Höhere Stufen** — hyperaktiv, bauen Flak, setzen Bomber offensiv ein, heilen Bombenkrater, wägen einnehmen-vs-wegbomben ab
- **Lagebewusst** — liest Rang/Welt-Füllstand/Mobbing und regelt nach; klügere Diplomatie + Kriegsschiff-Routenjagd; respektiert erlaubte Gebäude
- **Lokaler Ranglisten-Modus** — Spiel gegen KI auf dem eigenen ELO; Sieg/Niederlage bewegt das ELO (lokal, ohne Konto)

## Mehrspieler

- **Server-autoritatives Lockstep** — der Server simuliert mit, baut die Config, broadcastet committete Intents (deterministisch, MP-sicher)
- **Lobby** — Raum-Code, Teilnehmer/Ready, host-konfigurierbare Match-Settings (Karte/Gegner/Modi/…)
- **Lobby-Browser** — offene Lobbys + laufende Spiele; private vs. öffentliche Lobbys
- **Zuschauen** — laufenden Matches als Beobachter beitreten
- **Reconnect & Resync** — Wieder-verbinden nach Abbruch (Snapshot), automatische Desync-Korrektur
- **Host-Pause** — nur der Host pausiert (hält die Server-Uhr an)
- **Einladungslinks** — `…/r/CODE`, öffnen direkt die Lobby

## Konto & Online-Rangliste

- **Online-Rangliste** — weltweite Bestenliste aus dem Solo-ELO; eigener Eintrag hervorgehoben; funktioniert als Gast (kein Login); aus der öffentlichen Liste ausblendbar
- **Optionales Konto** — Benutzername + Passwort; Wertung + Einstellungen werden geräteübergreifend; Login ist nie Pflicht
- **Wiederherstellungs-Code** — einmalig bei Registrierung; Passwort-Reset ohne E-Mail (E-Mail-Versand bewusst (noch) nicht gebaut)
- **Einstellungs-Sync** — HUD-Layout, Theme, Lautstärken, Match-Vorgaben und Sprache folgen dem Konto

## HUD & Oberfläche

- **Konfigurierbares HUD** — „HUD anpassen"-Editor: Panels verschieben/skalieren/ausblenden, Snap an Rand+Nachbarn (Hilfslinien), Kanten-Ziehen, „Standard"-Reset, Layout-Export; lokal gespeichert
- **6 Themes** — Dezent / Taktisch / Neon / Kriegskarte (Default) / Bathymetrie / Feldemaille; gilt auch im Hauptmenü
- **Hauptmenü** — Tabs (Spielen / Mehrspieler / Rangliste / Einstellungen / Changelog / Hilfe), Konto-Knopf, Sprachwahl, Karten-Backdrop
- **Rangliste im Spiel** — sortierbar nach Truppen oder Land (Territorium %); anklickbare Namen (Kamera springt)
- **Ereignislog** — eigenes Feld mit Filter (Diplomatie/Krieg/Wirtschaft), neueste Meldung unten; anklickbare Namen
- **Aktions-/Angriffe-Panel** — laufende Angriffe + aktive Abwehr; „Zum Kampf springen"; Abbrechen/Abwehr klickbar
- **Pause-Menü** — Esc → Weiter / HUD anpassen / Runde verlassen
- **Ergebnis-Fenster** — zweispaltige Abschlusstabelle, „Weiterspielen"-Knopf
- **Tooltips** — Gebäude (Effektwert), Angriffsgröße am Cursor, Hover-Snapping mit Markierung
- **Tipps & Tricks** — wechselnde Hinweise im Menü + auf dem Ladebildschirm
- **Einheitliche Icons** — Strich-Icon-Set statt Emojis, in allen Sprachen
- **Feedback/Bug-Knopf** — Spieler-Feedback direkt aus dem Spiel

## Audio

- **Soundeffekte** — Transportboot-Tuten (nur du), Bomber-Triebwerk (Angreifer + Ziel), Bomben-Einschlag (alle, lautstärke nach Distanz); Stereo-Richtung
- **Adaptiver Soundtrack (Beta)** — passt sich der Spielintensität an (mehr Schlachten → treibender); standardmäßig aus
- **Lautstärke-Regler** — Gesamt / Soundeffekte / Musik, je 0–100 %
- **Warntöne** — neuer Angriff auf dich, neues Bündnisangebot, Sieg/Niederlage

## Sprachen

- **9 Sprachen, komplettes UI** — Deutsch, Englisch, Spanisch, Französisch, Italienisch, Portugiesisch, Russisch, Chinesisch, Japanisch; Startmenü + gesamtes In-Game-UI (HUD, Radialmenü, Tooltips, Ereignislog, Dialoge, Mehrspieler-Lobby, Konto)
