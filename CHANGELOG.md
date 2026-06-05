# Changelog

Was sich im Spiel geändert hat — nur Dinge, die du beim Spielen merkst.

## [Unreleased]

## [0.54.1] – 2026-06-05

### Behoben

- **Bombenkrater wieder einnehmbar:** Eine Bombe mitten ins Reich hinterließ manchmal ein neutrales
  Loch, das sich partout nicht zurückerobern ließ — die eigene Grenze „sah" das Loch schlicht nicht.
  Behoben: Krater am eigenen Rand lassen sich wieder normal einnehmen. (Schloss nebenbei eine seltene
  Ursache für Mehrspieler-Aussetzer nach einem Wiederverbinden.)
- **Flüsse auf jedem Browser identisch:** Eine Rechenstelle der Fluss-Erzeugung konnte auf verschiedenen
  Browsern minimal unterschiedlich ausfallen — jetzt erzeugt derselbe Karten-Seed überall exakt dasselbe
  Flussbild (saubere, faire Mehrspieler-Starts).

## [0.54.0] – 2026-06-04

### Neu

- **Kein Einfrieren im Mehrspieler mehr:** Die Spielberechnung läuft jetzt auch in Online-Partien
  im Hintergrund, getrennt vom Zeichnen und der Bedienung. Kamera, HUD und Klicks bleiben damit
  jederzeit flüssig — auch in großen Spätspiel-Partien mit vielen Nationen. (Im Einzelspieler war
  das seit 0.53.0 so; jetzt gilt es überall.)

## [0.53.0] – 2026-06-04

### Neu

- **Kein Einfrieren mehr im Spätspiel:** Die Spielberechnung läuft jetzt im Hintergrund, getrennt
  vom Zeichnen und der Bedienung. Kamera, HUD und Klicks reagieren damit jederzeit sofort — auch
  wenn gerade eine riesige Schlachtenfront abgerechnet wird oder hunderte Nationen gleichzeitig
  aktiv sind. Betrifft den Einzelspieler, ohne dass etwas einzustellen wäre. Sehr alte Browser
  spielen wie bisher.
- **Deutlich weniger Ruckler im Spätspiel:** Große Schlachten und Masseneroberungen wurden intern
  stark beschleunigt — der Sprung von flüssig zu kurz hakelig bei vielen aktiven Nationen fällt
  spürbar kleiner aus.

## [0.52.5] – 2026-06-04

### Behoben

- **Weniger Ruckler in Firefox:** Zwei Stellen entfernt, an denen Firefox bei Gleitkomma-Rechnungen
  ausgebremst wurde — das Zeichnen der vielen runden Marker (Nationen/Schiffe/Ringe) läuft jetzt über
  Bézier-Kurven statt `arc()`, und das Karten-Wrapping (Torus) nimmt für die häufigsten Werte einen
  schnellen Abkürzungs-Pfad. Beides ist bit-genau dasselbe Ergebnis (Aussehen und Multiplayer
  unverändert), nur ohne die Firefox-Bremse. Die großen Spätspiel-Hänger haben eine andere Ursache
  (die Simulation selbst) und werden separat angegangen.

## [0.52.4] – 2026-06-03

### Behoben

- **Periodische komplette Standbilder behoben (vor allem Firefox):** Während eine Partie lief, fror das
  Bild alle paar Sekunden für einen Moment komplett ein — bei sonst guter Bildrate, und es wurde mit der
  Spielzeit schlimmer. Ursache: die Berechnung, wo die Nationsnamen auf der Karte stehen, erzeugte bei
  jedem Durchlauf **Millionen winziger Wegwerf-Objekte**. Firefox' Speicher-Aufräumer (Garbage Collector)
  hielt das Spiel dafür kurz komplett an — Chrome schluckt das unbemerkt, Firefox nicht. Genau deshalb
  fror es **nur im laufenden Spiel** (pausiert nicht) und **unabhängig vom Zoom**. Die Berechnung läuft
  jetzt ohne diesen Müll → der Aufräumer hat nichts mehr zu tun, das Bild bleibt flüssig. Aussehen und
  Spielablauf sind exakt dieselben.

### Behoben

- **Periodische komplette Standbilder weg (vor allem in Firefox):** Zuletzt lief das Spiel mit guter
  Bildrate, fror dann aber alle paar Sekunden für einen Moment komplett ein — schlimmer als das frühere
  gleichmäßige Ruckeln. Ursache war eine interne Umstellung der Karten-Zeichenfläche auf eine neue
  Browser-Technik (als Vorbereitung für einen größeren Umbau): Firefox schiebt die über die Grafikkarte,
  und das Hochladen der Karte dorthin erzeugte regelmäßige Mini-Hänger. Die Zeichenfläche läuft jetzt
  wieder über den klassischen, flüssigen Weg. Das Bild ist exakt dasselbe; die neue Technik kommt
  später zurück, wenn das Zeichnen auf einen eigenen Thread wandert (wo sie dann nichts mehr einfrieren
  kann).
- **Zeichnen allgemein entlastet:** Die laufende Bild-Aktualisierung sammelt geänderte Felder jetzt
  sauber zusammen, und die Nationsnamen-Platzierung wurde deutlich verbilligt — weniger Last pro Bild,
  auch wenn viel auf einmal passiert.

### Behoben

- **Komplette Standbilder bei großen Angriffen weg:** Wenn eine sehr breite Angriffsfront auf einmal
  riesige Flächen verschluckt hat, fror das Spiel kurz komplett ein („flüssig, dann Standbild, dann
  wieder flüssig"). Ursache war die Taschen-/Einkreisungs-Erkennung, die über alle in einem Tick
  eroberten Felder lief. Sehr breite Eroberungen rollen jetzt über ein paar Ticks ab, statt alles in
  einem einzigen — das Einnehmen sieht praktisch gleich aus, nur ohne Ruckler. Normale Angriffe sind
  unverändert.
- **Kein Hänger mehr bei vielen Häfen:** Die Routen der Handelsschiffe werden jetzt nur noch einmal
  berechnet und gemerkt (das Wasser ändert sich ja nie), statt bei jeder Abfahrt neu. Auf Karten mit
  hunderten Nationen/Häfen war das vorher ein spürbarer periodischer Ruckler.
- **Große Karten (Chaos-Preset) laufen jetzt flüssig:** Auf riesigen Karten mit hunderten Nationen
  fror das Bild regelmäßig komplett ein (das „flüssig zwischen kompletten Standbildern"-Gefühl). Schuld
  war das Neuzeichnen der Beziehungs-Färbung an den Grenzen: jeder Nationstod und jeder Groll-/Gunst-
  Stufenwechsel hat die **ganze Karte** (Millionen Felder) neu eingefärbt. Jetzt werden nur noch die
  Grenz-Felder der wenigen tatsächlich betroffenen Nationen aktualisiert. Gemessen auf der Chaos-Karte
  (2048², 751 Nationen): von ~17 Standbildern pro 8 Sekunden auf **eins**, Bildrate fast verdoppelt —
  und die Darstellung ist exakt dieselbe.
- **Keine Sekunden-Hänger mehr beim Boot-Start im Spätspiel:** Sobald eine Nation viel Land besaß,
  ließ das Aussenden eines Transport-Boots das Spiel bis zu einer Sekunde einfrieren — der Start
  durchsuchte das **gesamte** eigene Gebiet nach einem Küstenpunkt. Jetzt werden die Küsten-Felder
  einmal beim Match-Start ermittelt und der Boot-Start prüft nur noch die eigene Küste. Gemessen auf
  der Chaos-Karte um Spielminute 10: pro Boot-Start von ~1150 ms auf ~90 ms.

## [0.52.1] – 2026-06-03

### Geändert

- **Schwierigkeitsstufen neu geeicht:** Nachdem die KI ihre Wirtschaft jetzt besser nutzt, wurden die
  ELO-Stufen frisch vermessen (200 Test-Partien). Die Stufen liegen nun etwas näher beieinander
  (Experte ist nicht mehr ganz so überlegen) — die Labels „Standard (1000)", „Experte (1225)" usw.
  treffen damit wieder die korrekte relative Stärke.

## [0.52.0] – 2026-06-03

### Geändert

- **KI nutzt ihre Fabrik-Wirtschaft jetzt richtig:** Fabriken werden in der korrekten Anzahl gebaut
  (genug, um alle eigenen Städte/Häfen zu bedienen) und dann **ausgebaut** (höheres Level = mehr Gold
  je Anschluss), statt nur Stufe 1 zu bleiben oder gar nicht zu kommen. Gemessen in Testläufen:
  Fabriken erreichen jetzt ~Level 2.5 (vorher stur 1), die KI hat fast **3× so viel Gold**. Dadurch
  spielt die KI wirtschaftlich deutlich stärker — Partien konsolidieren sich etwas schneller zu
  wenigen, größeren Reichen.

### Behoben

- **Kein Ruckeln mehr — auch in riesigen Spätspiel-Schlachten:** Die Gold-Routen-Berechnung wird jetzt
  über mehrere Ticks verteilt, statt sie in einem einzigen Tick zu erledigen. Damit verschwindet auch
  der letzte periodische Mini-Hänger bei vielen Fabriken auf großen Karten. Gemessen auf einer
  1024²-Karte mit großem Reich + laufendem Angriff: **kein einziger Frame über dem 16-ms-Budget**
  (vorher gelegentliche ~40-ms-Aussetzer). Spielverhalten unverändert (die Routing-Ergebnisse sind
  identisch, nur über ein paar Ticks gestreckt).

## [0.51.0] – 2026-06-03

### Neu

- **HUD passt sich automatisch an die Bildschirmgröße an:** Statt einer festen Standardgröße wählt das
  Spiel die UI-Größe jetzt passend zum Fenster — kleines Laptop/Fenster → kompakteres HUD, großer
  Monitor → größeres. Verändert sich die Fenstergröße, zieht es automatisch mit. Der „UI"-Regler oben
  links überschreibt das weiterhin jederzeit (danach bleibt deine Wahl fix).

## [0.50.2] – 2026-06-03

### Behoben

- **Deutlich weniger Ruckeln im späten Spiel:** Die Gold-Routen-Berechnung flutet jetzt nur noch das
  eigene, von Gebäuden erreichbare Gebiet statt der ganzen Karte, läuft seltener und wird in ruhigen
  Phasen ganz übersprungen (wenn sich nichts geändert hat). In großen Partien mit vielen Fabriken
  fällt der periodische Hänger so von ~40 ms auf ~17 ms und tritt halb so oft auf; ohne Baugeschehen
  ist er ganz weg. Verhalten (welche Fabrik welche Stadt versorgt) bleibt identisch.

### Behoben

- **Weniger Ruckeln:** Die Wirtschafts-Routen-Berechnung lief alle 2 Sekunden über die GANZE Karte —
  selbst wenn (noch) niemand Fabriken hatte —, was kurze Hänger verursachte. Jetzt wird sie ganz
  übersprungen, solange es kein Fabrik-Netz gibt, und braucht weniger Speicher. Dazu kleinere
  Optimierungen im Angriffs- und Render-Pfad (weniger Speicher-Müll → seltenere GC-Hänger). Verhalten
  bleibt identisch. (Bei vielen Fabriken auf riesigen Karten kann noch ein seltener Hänger bleiben —
  daran arbeiten wir separat weiter.)

### Neu

- **Gebäude direkt auf höherem Level bauen:** Im Bau-Modus wählst du jetzt über eine Stufen-Leiste
  (I / II / III), auf welcher Stufe das Gebäude direkt entsteht — gegen Aufpreis (Bau + alle Upgrades
  auf einmal), statt es später Stufe für Stufe hochzuziehen. Die Leiste sitzt am Desktop über der
  Bau-Reihe und am Handy unten-mittig; das **zuletzt gewählte Level wird gemerkt** und beim nächsten
  Mal vorgewählt. Auch die KI baut bei Gold-Überschuss direkt auf höherer Stufe.

## [0.49.0] – 2026-06-02

### Geändert

- **KI baut ihre Wirtschaft aus:** Die KI wertet jetzt bestehende Gebäude auf (Stadt/Fabrik/Hafen,
  und bei Bedrohung Verteidigung/Flak), statt nur immer neue zu bauen — ihre Wirtschaft wird mit der
  Zeit spürbar tiefer und stärker.
- **KI räumt mit wilden Nationen auf:** Beim Expandieren frisst die KI bevorzugt schwache wilde
  Nachbarn, statt sie ewig dümpeln zu lassen. Kleine, von einer Nation eingekesselte wilde Reste
  werden aufgeräumt (auch wenn noch ein Schlupfloch offen ist) — frische, große Wilde bleiben aber
  bestehen.
- **Faireres Annektieren eingeschlossener Gegner:** Ob ein komplett eingekreistes Kerngebiet
  geschluckt wird, hängt jetzt an den tatsächlich **stehenden Truppen** des Angreifers — nicht mehr
  an der bloßen Reichsgröße. Ein gerade leergekämpftes Reich bekommt kein Kerngebiet mehr geschenkt.

## [0.48.1] – 2026-06-02

### Behoben

- **Wilde im Angriffs-Log:** Greifst du eine wilde Nation an (oder schickst ein Boot zu ihr), steht
  jetzt „Wildnis" im Log statt ihres internen Nationen-Namens.

### Geändert

- **Ausgewählte Vorlage ist hinterlegt:** Im Menü ist die gerade aktive Steuerungs-/HUD-Vorlage
  jetzt farblich markiert, damit man sieht, was gewählt ist.
- **Rangliste zeigt „offline":** Ist der Ranglisten-Server nicht erreichbar, steht das jetzt klar da
  („Offline — keine Verbindung") statt wie eine leere Rangliste auszusehen.

## [0.48.0] – 2026-06-02

### Geändert

- **Aufgeräumtes Spielen-Menü:** „Match starten" steht jetzt ganz oben — schnell rein, ohne an
  allen Einstellungen vorbeizuscrollen. Die Detail-Einstellungen (Karte, Gegner, Modus, Match) sind
  unter „Match-Einstellungen anpassen" eingeklappt; wer feintunen will, klappt sie auf.
- **Einfacheres Layout-Speichern im HUD-Editor:** Statt Dropdowns gibt es jetzt ein Namensfeld + den
  „Speichern"-Knopf, und gespeicherte Layouts erscheinen als anklickbare Liste (Laden per Klick,
  Löschen per ✕). Die festen Vorlagen (Standard/Maus/Navigations-Rad) stehen ebenfalls in der Liste.

## [0.47.0] – 2026-06-02

### Geändert

- **Eigenes Querformat-Cockpit (Handy).** Im Querformat ist das HUD jetzt für die breite, niedrige
  Fläche gemacht: Angriffsgröße-Slider links (linker Daumen), Eck-Rad unten rechts (rechter Daumen),
  Status-Leiste oben — die Mitte bleibt frei für die Karte. Vorher war das Hochformat-Rad im
  Querformat unten abgeschnitten. Drehst du das Gerät, wechselt das Layout automatisch zwischen
  Hoch- und Querformat (ein selbst angepasstes HUD bleibt dabei unangetastet).

## [0.46.2] – 2026-06-02

### Behoben

- **Truppen unterwegs anklicken bringt die Kamera hin** statt sie zurückzurufen. Ein Klick auf eine
  Zeile im Angriffs-Panel (laufender Angriff, Boot, Kriegsschiff) springt zum Geschehen;
  Zurückrufen/Abbrechen geht nur noch über den kleinen Knopf (✕ / ↩) rechts.
- **Panels ändern im Spiel ihre Größe nicht mehr.** Das Truppen-Panel wuchs bisher um eine Zeile,
  sobald „im Kampf" erschien — die Zeile ist jetzt fest reserviert. Das Angriffs-Panel wächst nur
  noch bis zu einer Höhe und scrollt dann, statt übers Bild zu laufen.

## [0.46.1] – 2026-06-02

### Behoben

- **Doppeltipp-Zoom löst keinen versehentlichen Angriff mehr aus.** Der Tipp-Angriff wartet jetzt
  kurz, ob ein zweiter Tipp (Zoom) folgt. Die Wartezeit ist in den Einstellungen regelbar
  („Tipp-Angriff-Verzögerung") — auf 0 gestellt greifst du sofort an (dafür gibt es dann keinen
  Doppeltipp-Zoom, nur noch Pinch mit zwei Fingern).
- **Klick auf einen Ranglisten-Namen springt zur Nation.** Auf dem Handy fährt die Rangliste dabei
  ein, damit man die zentrierte Nation auch sieht.
- **„Zurück" im Bau-Rad entfernt die Gebäudeauswahl** — kein hängender Geister-Bau-Cursor mehr,
  wenn man das Bau-Menü ohne zu bauen verlässt.

## [0.46.0] – 2026-06-02

### Behoben

- **Angriffe verschmelzen wieder zuverlässig zu einem großen.** Bisher bündelten sich nur frische
  Klicks; getrennte Angriffe, deren Fronten zusammenwuchsen, blieben für immer als kleine
  Einzelangriffe „auf einem Haufen". Jetzt laufen benachbarte eigene Angriffe gegen dieselbe Nation
  fortlaufend zu einem großen zusammen (und das Bündeln beim Klick ist etwas großzügiger).
- **Bomber-Flugvorschau zeigt zum richtigen Flughafen.** Beim Starten mehrerer Bomber zeigte die
  Vorschau-Linie weiter auf den nächstgelegenen Flughafen, auch wenn der voll war und der Bomber in
  Wirklichkeit von woanders abhob. Jetzt zeigt sie immer auf den Flughafen, von dem der nächste
  Bomber tatsächlich startet.

## [0.45.0] – 2026-06-02

### Behoben

- **Küstengebiet wird nicht mehr fälschlich „eingekesselt" einkassiert.** Ein Gebietsstück an der
  Küste galt bisher als rundum umzingelt, sobald an Land ringsum nur der Gegner stand — das offene
  Meer zählte fälschlich als Wand. Jetzt ist Seezugang ein Fluchtweg: Küstengebiet wird nicht mehr
  annektiert.

### Geändert

- **Dynamischer Soundtrack reagiert jetzt auch auf deine Offensive.** Bisher wurde die Musik nur
  intensiver, wenn du angegriffen wurdest. Jetzt treiben auch dein eigenes Angreifen (je nach
  eingesetzten Truppen) und dein Bombardieren (ein Bomber in der Luft) die Intensität.

## [0.44.0] – 2026-06-02

### Geändert

- **Hauptstadt-Modus: der Fall der Hauptstadt hat jetzt echte Folgen.** Erobert ein Gegner deine
  Hauptstadt am Boden, übernimmt er dein **komplettes Reich** — alles Land, alle Gebäude (auch
  Verteidigungs- und Flak-Posten) und dein Gold. Wird die Hauptstadt dagegen **zerbombt**, zerfällt
  dein ganzes Reich zu herrenloser **Wildnis** (niemand erbt es). Vorher blieb das Restland einer
  besiegten Nation einfach unverteidigt liegen und musste Stück für Stück erobert werden.

## [0.43.0] – 2026-06-02

### Geändert

- **Handy: durchdachtes Standard-Layout.** Neue Spieler auf dem Handy starten jetzt mit einer
  aufgeräumten Cockpit-Anordnung (Rad unten Mitte, Status-Leiste oben, Angriffsgröße rechts,
  Feedback oben links) statt mit den rohen Default-Positionen. Das Layout passt sich proportional
  an die jeweilige Bildschirmgröße an, sitzt also auf jedem Handy ähnlich. Wer sein HUD schon
  selbst eingerichtet hat, behält es unverändert.

## [0.42.2] – 2026-06-02

### Behoben

- **HUD-Editor: Panels lassen sich wieder anfassen und in der Größe ziehen.** Solange der
  Editor offen war, hat das laufende Spiel die Panels jeden Moment überschrieben — sie
  erschienen ohne Hintergrund („keine Textur"), schrumpften beim Anfassen auf einen winzigen
  Kasten und ließen sich nicht vergrößern. Jetzt friert das HUD beim Editieren ein: alle Panels
  bleiben sichtbar, das Panel „Laufende Angriffe" lässt sich (wie die anderen) frei in Höhe und
  Breite ziehen, und geladene Vorlagen erscheinen vollständig.

## [0.42.1] – 2026-06-02

### Behoben

- Handy: Der vertikale Angriffsbalken am rechten Rand verschwindet jetzt, solange die
  Rangliste ausgefahren ist — vorher überlappte er deren rechte Kante und verdeckte z. B.
  den „Ignorieren"-Knopf einer Bündnis-Anfrage im Meldungen-Tab.

## [0.42.0] – 2026-06-02

### Geändert

- **Handy: „Meldungen"-Tab in der Rangliste.** Bündnis-Anfragen und das Ereignislog
  liegen jetzt als eigener Tab in der ausgefahrenen Rangliste (Knopf oben rechts) statt
  frei über dem Bild zu schweben — die Rangliste hat dort jetzt zwei Tabs („Rangliste"
  und „Meldungen"). Wartet ein Bündnis-Angebot, leuchtet ein kleiner Punkt am Rang-Knopf,
  damit du es im Tab nicht verpasst. (Auf dem Desktop bleibt alles wie gehabt.)

## [0.41.0] – 2026-06-02

### Geändert

- **Hauptmenü am Handy nutzbar:** Alle Menü-Seiten (Spielen, Mehrspieler, Rangliste,
  Einstellungen, Changelog, Hilfe) stapeln sich auf schmalen Bildschirmen sauber
  untereinander und laufen nicht mehr rechts aus dem Bild. Die Eingabefelder stehen
  jetzt mit Beschriftung über dem Feld und nutzen die volle Breite — kein Gequetsche
  und kein seitliches Scrollen mehr.

## [0.40.2] – 2026-06-02

### Behoben

- Im HUD-Editor lässt sich das Panel „Laufende Angriffe" jetzt auch dann anfassen und in
  der Größe ziehen, wenn gerade kein Kampf läuft (vorher war es leer kaum greifbar).
- Die Truppen-/Bau-Anzeige rutscht nicht mehr aus dem Bild, wenn man die Gold-Aufschlüsselung
  ausklappt — die Liste ist gedeckelt und scrollt bei Bedarf.

### Geändert

- Klarere Panel-Namen im HUD-Editor, die jetzt auch in ihre Felder passen (z. B. „Laufende
  Angriffe", „Angriffsgröße", „Meldungen", „Statusleiste", „Spielzeit").

## [0.40.1] – 2026-06-02

### Behoben

- Der Balken-/Kugel-Umschalter sitzt nicht mehr am Truppen-Widget im Spiel — die
  Truppen-Anzeige (Balken oder Kugel) stellt man in den HUD-Einstellungen ein.

## [0.40.0] – 2026-06-02

### Geändert

- **HUD-Editor übersichtlicher:** Der Editor ist jetzt ein schmaler, vertikaler Block statt
  einer breiten Querleiste. Die Layout-Optionen stehen untereinander, sodass man sie mit
  einem Blick erfasst. Die **Vorlagen** (Laden, Speichern, Löschen) haben einen eigenen,
  klar beschrifteten Abschnitt — sie sind nicht mehr in die Reiter-Leiste gequetscht.

## [0.39.0] – 2026-06-02

### Neu

- **Angriffs-Panel auf dem Handy:** Laufende und eingehende Angriffe sind jetzt auch auf
  dem Handy sichtbar — mit denselben Schaltflächen zum Abbrechen und Abwehren wie am
  Desktop. Vorher gab es dort kein Angriffs-Panel.

- **Feed-Spalte auf dem Handy:** Bündnis-Anfragen und der Ereignis-Log erscheinen jetzt
  in einer eigenen Spalte und lassen sich im HUD-Editor frei verschieben.

- **Feedback-Knopf auf dem Handy:** Der Feedback-Knopf ist jetzt im Handy-HUD vorhanden
  und im HUD-Editor verschiebbar.

- **Handy-HUD-Editor zeigt nur wirksame Regler:** Im HUD-Editor werden auf dem Handy
  ausschließlich die Panels angezeigt, die dort tatsächlich sichtbar sind. Desktop-spezifische
  Optionen (Slider-Position, Knopf-Anordnung, Truppen-Anzeige usw.) sind ausgeblendet.

## [0.38.0] – 2026-06-02

### Neu

- **Effizienz-Färbung des Truppen-Balkens:** Der Füll-Ring am Cockpit-Rad und der kleine
  Balken in der Top-Leiste färben sich jetzt nach der Wachstums-Effizienz — **grün** wenn
  man gut wächst, **gelb** wenn es stagniert, **rot** wenn man voll ist oder stark unter
  Druck steht. Auf einen Blick sieht man, ob die eigene Produktion gerade sinnvoll läuft.

- **Angriffsgrößen-Slider auf dem Handy:** Am rechten Bildrand über dem Cockpit-Rad gibt
  es jetzt einen vertikalen Schieberegler — unten 0 %, oben 100 %. Damit lässt sich
  einstellen, wie viele Truppen ein Angriff einsetzt. Vorher war das auf dem Handy gar
  nicht möglich.

- **Doppeltipp-Zoom:** Zweimal tippen und beim zweiten Tipp gedrückt halten, dann hoch
  oder runter ziehen — zoomt rein oder raus, genau wie bei Karten-Apps. Eine Hand reicht.

### Geändert

- **„Angriffe" statt „Schiffe" im Aktions-Rad:** Der Eintrag heißt jetzt **Angriffe**, weil
  dort auch Bomber starten — nicht nur Schiffe.

## [0.37.0] – 2026-06-02

### Neu

- **Menü-Knopf auf dem Desktop:** Oben links gibt es jetzt einen sichtbaren Knopf, der das
  Spielmenü öffnet — praktisch für alle, die gerade keine Tastatur griffbereit haben. Menü-
  und Feedback-Knopf lassen sich im HUD-Editor frei verschieben.

- **Gebäude per Ziehen platzieren (Handy):** Im Bau-Modus tippt man ein Gebäude im Rad an,
  zieht den Finger auf das gewünschte Feld — die Vorschau folgt direkt — und beim Loslassen
  wird gebaut. Das gewählte Gebäude bleibt im Rad markiert, damit man immer sieht, was gerade
  scharf ist.

- **Ausbreiten per Tippen (Handy):** Ein einfacher Tipp ins eigene Gebiet breitet die Truppen
  entlang der ganzen Grenze aus — entspricht dem **Shift+Linksklick** am Desktop.

- **Cockpit-Rad und Top-Leiste im HUD-Editor:** Der Maus-/Rad-Steuerungsmodus (ohne Tastatur)
  ist jetzt vollwertig im HUD-Editor editierbar. Rad und Top-Leiste lassen sich verschieben,
  skalieren und ein- oder ausblenden. Der Editor zeigt im Maus-Modus auch nur diese beiden
  Elemente, damit keine Desktop-Panels den Blick verstellen.

### Geändert

- **Bündnis-Anfragen auf dem Handy** erscheinen jetzt kompakt oben mittig statt groß unten
  rechts — sie blockieren nicht mehr den unteren Bildschirmbereich beim Spielen.

- **Rangliste:** Die Sortierung nach **Land** (Territorium-Anteil) ist jetzt die Standardansicht.

### Behoben

- **HUD-Editor-Panel** lässt sich jetzt frei in der Größe ziehen und startet zentriert auf dem
  Bildschirm statt in einer festen Ecke.

- **Panels mit Maximalbreite** (z. B. das Angriffs-Panel) ließen sich im HUD-Editor nicht über
  ihre Mindestbreite hinaus verbreitern — das ist jetzt behoben.

## [0.36.0] – 2026-06-02

### Neu

- **Mobile Top-Leiste:** Auf dem Handy erscheint oben rechts eine kompakte Leiste mit
  Truppen-Balken inkl. **Truppen-Cap**, aktuellem **Gold** samt Einkommens-Rate, einem
  **Menü-Knopf** (öffnet das Pause-Menü inklusive „HUD anpassen") und einem
  **Ranglisten-Knopf**, der die Rangliste kurz ein- und ausfährt.

- **Truppen-Cap im Cockpit-Rad und Bau-Preise im Bau-Rad:** Das Cockpit-Rad zeigt jetzt
  zusätzlich das Truppen-Cap (z. B. „8,9k / 23k"). Im Bau-Rad steht unter jedem Gebäude
  der Preis — **grün** wenn man ihn sich leisten kann, **rot** wenn das Gold nicht reicht.

- **Nationen-Namen am Bildschirmrand:** Nationen, die gerade außerhalb des Bildschirms
  liegen, werden am Rand eingeblendet — aber nur die **nächsten X** (Standard: 7, in den
  Einstellungen einstellbar, 0 = aus). Wilde Nationen zählen nie mit; wer einen gerade
  angreift, bleibt zur Warnung immer sichtbar.

### Behoben

- **Querformat auf dem Handy:** Im Querformat und auf schmalen Tablets liefen die Spalten
  des Startmenüs links und rechts aus dem Bild. Sie stapeln sich jetzt sauber untereinander.

## [0.35.0] – 2026-06-02

### Neu

- **Komplett spielbar auf dem Handy:** Menü und Match funktionieren jetzt vollständig
  auf Smartphones. Die Desktop-Panels (Zeit, Rangliste, Angriffe, Truppen-Balken,
  Bau-Leiste, Ereignis-Log, Minimap) werden auf kleinen Bildschirmen ausgeblendet,
  damit sich nichts überlappt.

- **Cockpit-Rad auf dem Handy:** Anstelle der Desktop-Panels zeigt das Eck-Rad auf dem
  Handy direkt in der Mitte die wichtigsten Werte — eigene Truppen, Einkommens-Rate,
  Gold und Platzierung. Ein farbiger Füll-Ring drumherum zeigt auf einen Blick, ob die
  Truppen-Auslastung entspannt (grün), angespannt (gelb) oder ein Angriff im Gange
  (rot) ist.

- **Hauptmenü passt sich schmalen Screens an:** Alle Spalten des Startmenüs stapeln
  sich auf Handy-Breite untereinander, Tabs brechen um — nichts wird mehr abgeschnitten
  oder scrollt unsichtbar aus dem Bild.

### Geändert

- **Bündnis-Angebote bleiben auf dem Handy sichtbar:** Auch wenn die übrigen Panels
  ausgeblendet sind, erscheinen eingehende Bündnis-Angebote weiterhin, damit man sie
  annehmen oder ablehnen kann.

## [0.34.1] – 2026-06-02

### Geändert

- **Musik ist jetzt standardmäßig an:** Der adaptive Soundtrack läuft von Anfang an mit
  (auch für bestehende Spieler). Wer ihn nicht möchte, dreht ihn in den Einstellungen
  unter „Musik" einfach runter.

## [0.34.0] – 2026-06-02

### Neu

- **Layout-Vorlagen im HUD-Editor:** Der HUD-Editor kennt jetzt drei feste Vorlagen —
  **Standard**, **Maus** und **Navigations-Rad** — sowie eigene speicherbare **Slots**.
  Über „Speichern in…" legt man die aktuelle Panel-Anordnung in einem eigenen Slot ab
  oder überschreibt eine der festen Vorlagen. Geänderte Vorlagen sind mit **„\*"**
  markiert; „Löschen" setzt sie auf den Originalzustand zurück bzw. entfernt eigene Slots.

- **Konfigurierbare Tastenbelegung:** Alle wichtigen Aktionstasten lassen sich jetzt
  umbelegen — **Kamera zentrieren**, **Aktionsmenü öffnen**, **Transportboot**, **Bomber**,
  **Kriegsschiff**, **Schiff-Reichweite anzeigen**, **Spieltempo hoch/runter** sowie alle
  **Bau-Hotkeys** (Stadt, Verteidigung, Hafen, Fabrik, Flugplatz, Flak). Klick auf eine
  Belegung, gewünschte Taste drücken, fertig. „Zurücksetzen" stellt die Standardtasten
  wieder her. Erreichbar sowohl im **Einstellungen-Reiter des Hauptmenüs** als auch im
  **Esc-Menü während einer Partie**. WASD, Leertaste und Esc bleiben fest.

### Geändert

- **Tutorial-Knopf besser sichtbar:** Der „Tutorial"-Knopf sitzt jetzt prominent
  unterhalb der Lobby-Liste auf der Startseite — statt wie bisher halb versteckt im
  Setup-Bereich.

## [0.33.0] – 2026-06-02

### Neu

- **Niederlage-Bildschirm:** Wird das eigene Reich vollständig erobert, erscheint sofort
  eine Einblendung „Du wurdest besiegt" mit den Knöpfen **„Weiter zuschauen"** und
  **„Neues Match"**. Vorher lief das Spiel kommentarlos weiter, ohne dass man merkte,
  dass man ausgeschieden ist. Truppen-Anzeige und Bau-Leiste blenden sich beim
  Ausscheiden ebenfalls aus.

- **Balken/Kugel-Umschalter direkt am Truppen-Widget:** Den Anzeigestil der Truppenstärke
  — klassischer Balken oder Füll-Kugel — kann man jetzt mit einem Klick direkt am Widget
  umschalten, ohne dafür den HUD-Editor öffnen zu müssen.

### Geändert

- **Wilde Nationen wieder nummeriert:** Wilde Nationen tragen wieder eine Nummer
  (z. B. „wild 3"), damit man getrennte Flecken derselben Nation auf der Karte
  auseinanderhalten kann. Außerdem kleben ihre Labels nicht mehr am Bildschirmrand fest,
  wenn man die Karte scrollt.

- **Bau-Snapping:** Ein Klick knapp neben das eigene (kleine) Reich rastet jetzt aufs
  nächste eigene Feld ein. Gebäude lassen sich so präziser platzieren, ohne den Klick
  perfekt treffen zu müssen.

- **Ereignis-Log wächst beim Vergrößern:** Zieht man das Ereignis-Log-Panel größer,
  füllt es sich mit wirklich mehr Einträgen aus der Spielgeschichte — statt nur den
  vorhandenen Text zu zoomen.

- **HUD-Editor als Reiter:** Der HUD-Editor ist jetzt in drei Reiter unterteilt —
  **Design**, **Layout** und **Elemente** — und übersichtlicher zu bedienen.
  Neu hinzu kommen **Quick-Config-Presets**: mit einem Klick lässt sich die Steuerung
  auf **Standard**, **Maus** oder **Navigations-Rad** umschalten.

## [0.32.0] – 2026-06-01

### Neu

- **Touch- und Handy-Steuerung:** Das Spiel läuft jetzt vollständig auf Smartphones und
  Tablets. Ein Finger zieht die Karte, zwei Finger zoomen (Pinch), kurzes Tippen löst
  einen Angriff aus, Gedrückthalten öffnet das Kontextmenü direkt an der Berührstelle.

- **Aktions-Rad auf Touch:** Auf Touch-Geräten erscheint unten rechts dauerhaft ein
  rundes Rad. Darüber lassen sich alle Gebäude und Schiffe (Boot, Bomber, Kriegsschiff)
  per Daumen erreichen — **Zurück** in der Mitte bringt eine Ebene zurück.

- **Füll-Kugel als Truppen-Anzeige:** Neben dem klassischen Balken gibt es jetzt eine
  Kugel, die sich entsprechend der Truppenstärke füllt. Auf Touch-Geräten ist sie
  Standard; am Desktop lässt sie sich im **„HUD anpassen"**-Menü aktivieren.

- **Tastenkürzel E:** Wer lieber mit der Tastatur arbeitet, kann mit **E** das
  Aktionsmenü direkt an der Mausposition öffnen — praktisch als Alternative zum Rechtsklick.

- **Einstellungen mitten im Spiel:** Das Esc-/Pause-Menü enthält jetzt einen
  **„Einstellungen"**-Eintrag. Lautstärken — Gesamt, Soundeffekte, Musik — lassen sich
  so anpassen, ohne die Partie verlassen zu müssen. Auch die Größe des Radialmenüs
  (Klein / Normal / Groß) ist dort wählbar.

### Geändert

- **Steuerungs-Modus wählbar:** Im **„HUD anpassen"**-Menü kann man zwischen
  **Auto**, **Desktop** und **Touch** wählen. Touch-Modus zeigt das Mobile-Layout
  auch am Desktop — nützlich, wer auf einem Touchscreen mit Windows spielt oder
  das Touch-Layout einfach bevorzugt.

- **Minimap einklappbar:** Ein kleiner Knopf an der Minimap blendet sie aus und
  wieder ein. Auf Touch-Geräten sitzt die Minimap oben rechts, wo der Daumen sie
  leichter erreicht.

- **Schnelleres Bauen:** Nach dem Platzieren eines Gebäudes bleibt der Bau-Modus
  aktiv, sodass man direkt mehrere Gebäude desselben Typs hintereinander setzen kann,
  ohne das Menü erneut öffnen zu müssen.

- **Aufgeräumtes Rechtsklick-Menü:** Das Radialmenü hat ein neues, ruhigeres Aussehen —
  nahtloses Zifferblatt, Icon und Beschriftung nebeneinander, **Zurück** in der Mitte.
  Schneller zu lesen, weniger visuelles Rauschen.

## [0.31.0] – 2026-06-01

### Neu

- **Orientierungs-Puls beim Spielstart:** Sobald eine Partie beginnt, erscheint kurz ein
  pulsierender Ring in deiner Farbe über deinem Startgebiet. Auf großen Karten findet
  man so sofort, wo man steckt — ohne langes Suchen.

### Geändert

- **Einheitliche Karten-Marker:** Die kleinen Symbole auf der Karte, die auf ein
  Bündnis-Angebot, einen Verrat, ein Embargo oder einen laufenden Angriff hinweisen,
  sind jetzt gezeichnete Strich-Symbole im Stil des restlichen Spiels. Vorher waren
  es bunte Emojis, die optisch aus dem Rahmen fielen.

- **Weicheres Knopf-Feedback im HUD:** Die Knöpfe im Aktionsmenü (Bauen, Einheiten,
  Sortieren) reagieren jetzt mit einem sanften Aufhellen beim Drüberfahren und einem
  kurzen Eindrücken beim Klicken.

### Behoben

- **Kein Doppelpunkt mehr in Beschriftungen:** Truppenzahlen und Namen auf der Karte
  zeigten in seltenen Fällen durch einen Darstellungsfehler einen doppelten Punkt.
  Das ist korrigiert.

## [0.30.1] – 2026-06-01

### Behoben

- **Geteilte Nation im Mehrspieler funktioniert jetzt richtig:** In der Lobby kann jeder
  Spieler gezielt wählen, welche gemeinsame Nation er mitsteuert. Vorher landeten alle
  automatisch auf derselben Nation, sodass sich Menschteams nicht sauber aufteilen ließen.
  Jetzt spielen Mitspieler mit gleicher Team-Nummer wirklich zusammen — geteiltes Gold,
  Truppen und Gebiet — während verschiedene Teams gegeneinander antreten.

## [0.30.0] – 2026-06-01

### Neu

- **Tutorial:** Im **Spielen**-Tab gibt es einen neuen, freiwilligen **„Tutorial"**-Knopf.
  Er startet ein geführtes Match auf einer kleinen, ruhigen Karte. Das Spiel hält an festen
  Punkten an, zeigt eine Erklär-Box und läuft danach weiter — pausieren, erklären, weiter.
  Ein angeheftetes **Ziel-Panel** auf der linken Seite zeigt den Fortschritt mit Haken an.
  Das Tutorial führt durch die Grundlagen: Gebiet ausbreiten, Angriffsgröße einstellen,
  wilde Nationen erobern, **Stadt** und **Fabrik** bauen (Wirtschaft), weiter wachsen,
  **Flughafen** und **Bomber** einsetzen (Luftkrieg). Der jeweils gemeinte Knopf wird
  hervorgehoben; für die Bauschritte bekommt man Gold geschenkt. Wer das Spiel schon kennt,
  ignoriert den Knopf einfach — das Tutorial ist nie Pflicht. Verfügbar in allen 9 Sprachen.

## [0.29.1] – 2026-06-01

### Geändert

- **E-Mail-Feld beim Registrieren ausgeblendet:** Solange es keinen Mail-Versand gibt, hätte
  eine E-Mail-Adresse keinen Nutzen. Das Zurücksetzen des Passworts läuft weiter über den
  Wiederherstellungs-Code. (Das Feld kommt zurück, sobald der Mail-Versand eingerichtet ist.)

## [0.29.0] – 2026-06-01

### Neu

- **Einstellungen folgen dem Konto:** Wer angemeldet ist, hat sein **HUD-Layout**, das
  gewählte **Design**, die **Lautstärken**, die **Match-Vorgaben** und die **Sprache**
  jetzt geräteübergreifend gespeichert — auf einem anderen Gerät ist alles sofort so
  eingerichtet wie gewohnt. Als Gast bleibt alles wie bisher nur lokal.

### Behoben

- **Menüleiste wieder mittig:** Der neue Konto-Knopf hatte die Menüleiste im Header leicht
  aus der Mitte verschoben — das ist korrigiert.

## [0.28.0] – 2026-06-01

### Neu

- **Online-Rangliste:** Im Hauptmenü gibt es einen neuen Tab **„Rangliste"**. Dein ELO aus
  Solo-Matches gegen die KI wird weltweit gespeichert und in einer Bestenliste angezeigt —
  dein eigener Eintrag ist hervorgehoben. Mehrspieler-Partien fließen nicht in die Wertung
  ein. Die Rangliste funktioniert ohne Konto (als Gast). Wer nicht in der öffentlichen Liste
  auftauchen möchte, kann sich dort ausblenden.

- **Optionales Konto:** Im Menü-Header gibt es einen neuen **Konto-Knopf**. Mit Benutzername
  und Passwort kann man sich registrieren und anmelden — dann ist die Wertung
  geräteübergreifend (Handy, PC) und bleibt auch bei einem Browser-Wechsel erhalten. Beim
  Registrieren erhält man einmalig einen **Wiederherstellungs-Code**, mit dem man das
  Passwort ohne E-Mail zurücksetzen kann. E-Mail-Adresse ist optional. Wer kein Konto anlegt,
  spielt ganz normal als Gast weiter — eine Anmeldung ist nie Pflicht.

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
