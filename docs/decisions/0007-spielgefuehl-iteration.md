# ADR 0007: Spielgefühl-Iteration — Kampf-Balance, Gebietsformen, HUD-Redesign

## Status

Accepted

## Datum

2026-05-28

## Kontext

Nach der Mechanik-Tiefe (ADR-0006) folgte eine intensive Playtest-Iteration mit
Jonathan: viele kleine, schnell aufeinanderfolgende Anpassungen an Kampf-Balance,
Gebietsformen, Sichtbarkeit und HUD. Dieses ADR hält die nicht-offensichtlichen
Entscheidungen fest, damit spätere Sessions die Trade-Offs nachvollziehen.

## Entscheidung

### Kampf-Balance

- **Verteidiger verliert keine Truppen beim Verteidigen.** Wer angegriffen wird,
  verliert nur Land, nicht Truppen (`defenderLossPerTile` entfernt). Folge: die
  Truppen sitzen weiter auf dem schrumpfenden Gebiet → die Eroberung wird pro Tile
  zäher (`def.troops/tiles` steigt), und geschlagene Nationen behalten Schlagkraft
  für Gegenangriffe. Bewusste Design-Entscheidung; fühlte sich vorher falsch an.
- **Verteidigung gegen unterlegene Angriffe verstärkt.** Tempo-Minimum 0.05→0.02
  (unterlegene Angriffe kriechen statt zu marschieren) und Verlust-Verhältnis bis
  4× statt 2× gedeckelt — kleine Angriffe arbeiten sich nicht mehr leicht in große
  Nationen rein. (Hintergrund: der sublineare Cap `^0.6` macht große Reiche pro Feld
  _dünn_, weshalb konzentrierte kleine Angriffe sonst lokal durchbrechen.)
- **Truppen über dem Cap schmelzen ab** (`OVER_CAP_DECAY` 3 %/Tick) statt bei 0 zu
  stagnieren — eine dezimierte Nation sitzt nicht mehr dauerhaft auf ihrem alten
  Truppenberg; der Bestand folgt dem gesunkenen Gebiets-Cap nach.
- **Gebundene Truppen produzieren nicht.** `troopIncreaseRate(producingTroops)`:
  nur freie Truppen erzeugen Nachschub, der Cap-Bezug bleibt auf der Gesamtzahl.
- **Tempo gesenkt** (normal 0.45→0.3, Wildnis-Rate 2→1.5) — die Ausbreitung fühlte
  sich am Anfang zu schnell an; die Weite bleibt, nur langsamer.

### Gebietsformen

- **Spawn ist ein organischer Blob** statt eines 5×5-Quadrats: gewichteter Flood-Fill
  bis ~80 Tiles, Radius je Richtung durch zwei Sinus-„Lappen" (pro Spieler zufällige
  Phasen) verzerrt → unregelmäßige Form, jeder Spawn anders. Ein leichter Nachbar-Bonus
  glättet, ein Loch-Füll-Pass schließt umschlossene Tiles → solider 1-Tile-Rand ohne
  Ein-Pixel-Lücken. Größe an die verfügbare Fläche gekoppelt (kleine Karten).
- **Angriffswelle bevorzugt Front-Tiles mit vielen eigenen Nachbarn**
  (`FRONT_SMOOTHING`) → breite, „blasige" Front statt dünner Finger, die fremdes
  Gebiet zerstückeln. Fokus-Richtung und Terrain prägen weiterhin die Form.

### Gebäude bei Eroberung

Stadt/Markt/Hafen werden **übernommen** (Besitzerwechsel mitsamt Level), nur
**Verteidigungsposten werden zerstört**.

### Sicht aus Spieler-Perspektive (Render)

- **Grenzfarben relativ zum Menschen:** eigenes Gebiet leuchtet hell-cyan
  (Eigenleuchten, schnelles Wiederfinden), Verbündete grün, neutral weiß. Nationen,
  die einem kürzlich Land genommen haben, sind rot — Intensität nach abklingendem
  **„Groll"** (`state.grudge`, gerichteter Schlüssel, ~1 %/Tick Decay) statt nach
  aktivem Angriff: der rote Rand glüht nach, auch wenn der Angreifer gerade pausiert.
- **Aktives Angriffsziel** wird orange umrandet — man sieht genau, wo man angreift.
- **Angriffs-Pillen** (eigene grün, eingehende rot, mit Schwert + Truppenzahl) folgen
  der vorrückenden Front (`Attack.frontTile`, pro Tick auf den Schwerpunkt der
  eroberten Tiles nachgeführt) statt am Klick-Punkt zu kleben.
- **Küstenlinie:** Wasser am Land wird heller (Flachwasser) → klare Grenze, Wasser
  nie mit einer Nation verwechselbar.

Damit das mit dem inkrementellen Rendering (ADR-0006) verträglich bleibt, werden
Beziehungs-/Groll-Stufen **quantisiert**: ein voller Bitmap-Rebake passiert nur bei
Stufenwechsel (Signatur), nicht bei jeder Groll-Wert-Änderung pro Tick.

### HUD — Version A

Oben links kompakte Info (Zeit/Speed/Phase) + klappbare Steuerung; oben rechts
Rangliste aller Nationen (sortierbar Truppen/Gold, Top-5 + Erweitern); unten Mitte
ein eigenes Aktionsmenü mit Truppenleiste (Optimum-/Stagnations-Striche aus
`growthZones`, Beschriftung im Balken, Truppen/s links in Zonenfarbe), Angriffs-Slider
und Bau-Buttons (Hotkey, Kosten, Tooltips). Gold steht über den Bau-Buttons mit
**geglätteter Einkommensrate** (EMA) — ein exaktes Momentan-Einkommen wäre wegen des
sprunghaften Handels irreführend.

## Konsequenzen

- Mehrere Balance-Werte (Tempo, Cap-Sockel, Decay-Raten, FRONT_SMOOTHING,
  Spawn-Größe) sind playtest-getunt und können sich weiter ändern.
- `Attack` trägt jetzt `frontTile` und `startTick` (Anzeige); `GameState` trägt
  `grudge`.
- Tests decken die neuen Formeln ab (`growthZones`, `producingTroops`, Cap-Abschmelzen,
  Groll-Decay, Defense-Clamp).

## Offen / später (mit Jonathan zu besprechen)

Kriegszustand-Mechanik, Kriegsschiffe + Handelsblockade, Angriffs-Kollision (Reserven
verrechnen), Allianz-Ablauf mit Timer, Steuerungs-Überarbeitung, Start-Menü-Face-Lift.
