# ADR 0019: Flugzeuge, Bomben & Flugabwehr

## Status

Accepted — in Umsetzung (Session 2026-05-30). Schrittweise, jeder Schritt eigener Commit.

## Datum

2026-05-30

## Kontext

Bisher gibt es **keine offensive Verwendung für angesammeltes Gold**. Gold fließt in Wirtschaft
(Fabriken/Häfen) und Defensive (Verteidigungsposten, Kriegsschiffe), aber wer reich ist, kann das
nicht direkt in einen Angriff ummünzen. OpenFront.io löst das mit Raketensilos + Atombomben.

Jonathan möchte eine ähnliche Richtung, aber mit **Flugzeugen und Bomben** — physisch fliegende
Einheiten, die zu ihrem Ziel fliegen und dort eine Bombe abwerfen, plus **Flugabwehr** als Konter.
Das schließt die Lücke „Gold ansammeln, aber nichts damit anstellen können".

## Entscheidung

### Zwei neue Gebäude

- **Flughafen (`airport`):** startet Bomber. Der **Start kostet Gold** (Munition — so fließt Gold
  offensiv). Zwischen zwei Starts liegt ein **Cooldown**; das **Gebäude-Level senkt den Cooldown**
  (höheres Level = schnellere Starts, analog zur Effektivitäts-Logik der anderen Gebäude). Wird bei
  Eroberung **übernommen** (wie Stadt/Hafen/Fabrik).
- **Flak-Turm (`flak`):** Flugabwehr mit **Reichweiten-Ring** (wie Verteidigungsposten, L1 8 / L2 12
  / L3 16 Tiles). Feuert **schnell** Projektile auf feindliche Bomber in Reichweite. Wird bei
  Eroberung **zerstört** (wie der Verteidigungsposten — rein defensiv, bleibt nicht stehen).

### Bomber (vorerst ein Typ)

- Physische Einheit wie ein Kriegsschiff (`path` + `progress`), fliegt aber **über alles** (Terrain
  egal). Hat **HP**. Nach dem Abwurf fliegt er zurück / löst sich auf.
- **Abschuss unterwegs → verloren, keine Bombe.** Das eingesetzte Gold ist weg (Risiko).
- **Routen-Wahl beim Start:** **direkt** (gerade Torus-Linie) oder **zwei Parabel-Bögen**
  (links/rechts ausbeulend). Bewusst nur diese drei — mehr Auswahl würde dichte Flak trivial
  umfliegbar machen. Alle Routen deterministisch konstruiert (det-math).

### Bombe (Wirkung im Radius am Zielpunkt)

- **Tötet Truppen** im Radius (anteilig zur getroffenen Fläche).
- **Neutralisiert Gebiet** (Tiles → herrenlos, wieder eroberbar).
- **Zerstört Gebäude** im Radius.
- **Verschont niemanden** — auch **eigene und verbündete** Tiles/Gebäude werden getroffen. Riskante
  Platzierung ist Teil der Strategie.
- **Radius großzügig** (nicht nur ein paar Tiles) — die Fläche soll spürbar sein.

### Flak gegen Bomber

- Flak feuert in Reichweite **schnell** (kurzer Cooldown) Projektile; jeder Treffer kostet den
  Bomber **HP**. Eine Flak schwächt, **mehrere holen sicher runter**. Projektil-Maschinerie wie
  beim Kriegsschiff, aber **sim-relevant** (siehe unten).

### Steuerung & Vorschau

- Start über das **Rechtsklick-Radialmenü** auf das Ziel-Tile („Bomber starten", erscheint bei
  eigenem Flughafen + genug Gold + bereitem Cooldown), inkl. Routen-Wahl.
- Beim Zielen sichtbar: **Flugroute**, **Einschlagsradius** und eine **Warnung**, wenn die Route
  durch eine Flak-Zone führt, in der der Bomber bei aktueller Luftabdeckung **sicher abgeschossen**
  wird (Vorab-Auswertung des Pfads gegen die bekannten Flak-Türme).

## Determinismus / Multiplayer

Anders als die bisherigen Schiffe und ihre Schüsse (rein darstellend, **nicht** im State-Hash) ändern
Bomber den echten Spielstand (Gebiet/Truppen/Gebäude). Deshalb:

- Bomber laufen **voll deterministisch** (Integer-State, `det-math` für die Routen/Bewegung).
- Bomber werden in **Snapshots serialisiert** (`serialize.ts`) und in den **State-Hash** aufgenommen
  (`hash.ts`) — sonst driften Mehrspieler-Partien beim Einschlag auseinander.
- Flak-Schüsse, die Bomber treffen, sind ebenfalls **sim-relevant** (entscheiden, ob der Bomber den
  Einschlag erreicht) → gleicher Determinismus-Anspruch. (Die reinen Schiff-gegen-Schiff-Projektile
  bleiben unverändert deko-only.)

## Umsetzung (Reihenfolge)

1. **Gebäude-Verdrahtung** `airport` + `flak` als neue `BuildingType` (Kosten, Sprites, i18n, HUD,
   `canBuildAt`, KI, Toggle) — inkl. Eroberungs-Verhalten (Flughafen übernommen, Flak zerstört).
2. **Bomber + Bombe:** Einheit, Start-Intent (mit Route), deterministischer Flug, Einschlag-Wirkung
   (Truppen/Gebiet/Gebäude), Render (Bomber-Sprite + Einschlag-Funken), Serialize/Hash, Tests.
3. **Flak:** Reichweite, schnelle Projektile, Bomber-HP/Abschuss, Render (Ring + Projektile), Tests.
4. **Vorschau-UI:** Routen-Wahl + Routen-/Radius-Vorschau + Flak-Warnung beim Zielen.
5. **Balance-Feintuning** und (später, Phase 3) weitere Flugzeug-Typen / Bombenteppich.

## Startwerte (beim Spielen justierbar)

- Flughafen ~50k Basis (eigene Eskalations-Gruppe), Start-Munition ~40k Gold pro Bomber.
- Flughafen-Cooldown L1 ~10 s, sinkt pro Level.
- Bomber: HP 4, Tempo ~2 Tiles/Tick (schneller als Schiffe), Bomben-Radius ~6 Tiles.
- Flak-Turm ~35k, Reichweite wie Verteidigung, Schuss-Cooldown ~3 Ticks, 1 Schaden/Treffer
  (eine Flak schwächt, zwei holen einen 4-HP-Bomber sicher runter).

## Konsequenzen

- Erste **offensive Gold-Senke** — reiche Spieler haben endlich ein Machtmittel.
- Neue Determinismus-Anforderung an „fliegende, wirksame" Einheiten (Hash/Serialize) — sauber
  abgegrenzt von den bestehenden Deko-Einheiten.
- Flugabwehr schafft ein **Bau-Wettrüsten** (Angreifer-Routen vs. Verteidiger-Abdeckung).
