# ADR 0010: HUD-Komplettumbau (Entrümpelung) — Implementierungsplan

## Status

**Abgeschlossen (2026-05-30).** Umgesetzt: Schritt 1 (Abbrechen/Abwehr ans untere Aktions-Panel),
Schritt 4 (kompakte Bau-Chips), Schritt 5 (Ereignislog als deckendes Feld + Filter), plus
Attack-ins-Slider-Label und Economy-Popover; dazu der Truppen-Badge als Nodge oben. **Schritt 2
(Zahl ÜBER den Balken) und Schritt 3 (/s-Labels) bewusst verworfen** — die Truppen-Zahl bleibt
zentriert AUF dem Balken (so will es Jonathan). HUD gilt als fertig.

## Datum

2026-05-29

## Kontext

Jonathan findet das In-Game-HUD „ein wenig unübersichtlich". In der Autonom-Session wurden
bereits die **risikoarmen, objektiven** Lesbarkeits-Fixes gemacht (committet): Angriffsmenge
ins Slider-Label gefaltet (doppelte „▌ Angriff"-Zeile entfernt), Economy-Aufschlüsselung
aufklappbar an der Gold-Zeile. Der **größere Layout-Umbau** ist subjektiv → wartet bewusst
auf Jonathans Auge (er war bei der Optik unsicher und will sie kleinteilig abstimmen). Dieser
ADR hält den abgestimmten Mockup + die konkreten Schritte fest, damit der Umbau bei Freigabe
„nur noch Abarbeiten" ist.

## Heute (Aktions-Panel unten Mitte, von oben)

Von oben: `+X/s` (Truppen/s) + Truppenbalken mit Text drauf; darunter `Angriff: Z% · ≈X` +
Slider; dann `Gold ≈ +Y/s ▸` (+ Economy-Popover); 4 große Bau-Buttons; Boot-Button. Dazu die
**Angriffs-/Aktions-Liste oben links** (`hud.ts`, `top:92px;left:12px`) — die Jonathan als
„zu weit weg, um schnell abzubrechen" bemängelt hat.

## Zielbild (Mockup)

```
  ⚔→ Wildnis · 35.1k · 0:12                       [ ✕ ]      <- Abbruch (2.5s, Fortschritt)
  ⚔< Nikita  · 12.0k · 0:05                       [ S ]      <- Abwehr 1:1
  Boot 5.0k · unterwegs                           [ ^ ]
 +--------------------- Aktions-Panel -------------------------+
 | Truppen   111.6k / 117.2k · 95%              ^ +570/s       |   Zahl UEBER dem Balken
 | [#####################.....]                                |   reiner Balken, kein Text
 | Gold   177.9k                 ^ +1.4k/s   v                 |   v = Economy-Popover (fertig)
 | Angriff   30%  (~ 35.1k)   [----o-------------]             |   eine Zeile (fertig)
 | [C.200k] [D.25k] [P.20k] [F.100k]            [Boot]         |   kompakte Chips
 +-------------------------------------------------------------+
```

## Geplante Schritte (noch offen)

1. **Aktive-Aktionen-Leiste nach unten.** Das Top-Left-Panel (`attackPanel` in `hud.ts`)
   direkt **über** das Aktions-Panel (unten mittig) verlegen → Abbrechen (✕, mit
   2.5 s-Fortschritt) und Abwehr (🛡) sind dort, wo der Blick ist. Erscheint nur bei aktiven
   Aktionen. (Funktionalität existiert bereits, nur die Position ändert sich → braucht
   visuelles Tuning gegen Kollision mit Minimap/Log.)
2. **Truppenzahl über statt auf den Balken.** `barCaption` aus dem Balken-Inneren in eine
   Zeile darüber ziehen; der Balken bleibt reine farbige Anzeige (bessere Lesbarkeit als Text
   auf Farbverlauf).
3. **Raten klar beschriftet.** „Truppen/s" an der Truppenzeile, „Gold/s" an der Goldzeile
   (heute sind die zwei „/s"-Werte nur durch Position kontextualisiert).
4. **Bau-Buttons → kompakte Chips** (nur Glyph + Kosten; Namen stehen im Radialmenü +
   Tooltip). Spart vertikale Höhe.
5. **Ereignislog** ist bereits lesbar (solide Hintergrund-Chips) — nur prüfen, ob er mit der
   neuen unteren Aktions-Leiste kollidiert.

## Risiko / Reihenfolge

Reiner DOM-/CSS-Umbau in `hud.ts`; Sim unberührt. Hauptrisiko: Positionierung der unteren
Aktions-Leiste (Kollision mit Minimap unten rechts / Gefahren-Vignette). **Mit Jonathans Auge
iterieren** — Schritt 1 (Relokation) zuerst, dann 2–4 als getrennte kleine Schritte, jeweils
Playwright-Sichtprüfung. Betroffen: nur `src/ui/hud.ts`.
