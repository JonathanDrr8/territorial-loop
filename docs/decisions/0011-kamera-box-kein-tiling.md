# ADR 0011: Kamera-Box statt endlosem Tiling — Implementierungsplan

## Status

Accepted — umgesetzt als Toggle (Default an): min-Zoom auf eine Welt-Periode begrenzt
(`minZoom = max(canvasW/mapW, canvasH/mapH)` in `input.ts`), `drawTiled` kachelt bei
≤1 Periode ohnehin nur den Seam. Umschaltbar per Start-Menü-Checkbox „Kamera-Box"
(persistiert) + Taste **K** (live). Schritt 4 (sichtbarer Box-Rahmen) bewusst weggelassen.

## Datum

2026-05-29

## Kontext

Die Welt ist topologisch ein Torus (ADR-0001/Konzept). Heute **kachelt der Renderer beim
Pannen die Welt unendlich** (`drawTiled` in `renderer.ts`) → die Karte wiederholt sich wie
eine „Tapete", was verwirrt (man sieht dieselbe Nation mehrfach). Jonathan möchte stattdessen
eine **Kamera-Box**, in der genau eine Welt-Periode gerendert wird und Einheiten „links raus,
rechts rein" wandern (wie Asteroids/Pac-Man). Die **Topologie bleibt Torus** — nur die
Darstellung ändert sich. Reine Render-/Input-Schicht, **Sim unberührt**.

## Entscheidung (Ansatz)

**Zoom so begrenzen, dass nie mehr als eine Welt-Periode gleichzeitig sichtbar ist**, und den
Bitmap-Blit auf „eine Welt + nur die zum Füllen der Naht nötige Nachbarkopie" reduzieren statt
unendlich zu kacheln. Dann zeigt sich der Wrap nur noch als nahtloses „rechts rein, was links
rausläuft" am Rand — keine verwirrenden Wiederholungen. Objekte (Einheiten, Labels, Schiffe,
Angriffs-Pillen) werden an der Naht ohnehin schon gewrappt gezeichnet
(`nearestWrappedScreenPos` + die `dx/dy ∈ {-1,0,1}`-Schleifen in `drawBuildings`/`drawShips`/
`drawLabels`).

## Konkrete Schritte

1. **min-Zoom anheben (Kern).** In `input.ts` (`minZoom()`) das Auszoomen so begrenzen, dass
   die sichtbare Weltbreite **≤ `mapWidth`** und -höhe **≤ `mapHeight`** bleibt (genau eine
   Periode). Heute erlaubt `minZoom` ~87% Füllung und lässt das Tiling den Rest übernehmen →
   das ist die Quelle der Tapete. Neuer Grenzwert: `max(canvas.clientWidth / mapWidth,
canvas.clientHeight / mapHeight)` (so passt mindestens eine volle Periode in keine Richtung
   doppelt). Optional ein kleiner Rand.
2. **Blit auf eine Periode + Naht-Nachbar begrenzen.** `drawTiled` so umbauen, dass es das
   Welt-Bitmap einmal an der (gewrappten) Kameraposition zeichnet und je Achse höchstens **eine**
   zusätzliche Kopie, falls der Viewport die Naht überlappt — nie eine ganze Kachel-Matrix.
3. **Objekt-Wrap beibehalten.** Die vorhandenen 3×3-Wrap-Schleifen für Gebäude/Schiffe/Labels/
   Marker bleiben (sie zeichnen Objekte nahe der Naht korrekt auf beiden Seiten) — ggf. auf das
   tatsächlich Nötige reduzieren, da nun max. eine Naht sichtbar ist.
4. **Optionaler Rahmen / Kamera-Zentrierung.** Sichtbarer Box-Rahmen und/oder „Kamera bleibt
   auf dem Spieler zentriert"-Modus als Feinschliff (subjektiv, mit Jonathans Auge tunen).

## Risiko / Verifikation

Render-fundamental und iterationsbedürftig: Pan/Zoom-Gefühl, Naht-Sauberkeit, Minimap-Konsistenz
müssen visuell stimmen. Sim/Tests unberührt. Verifikation per Playwright: weit rauszoomen zeigt
**keine** Wiederholung mehr; am Rand pannen zeigt nahtlosen Wrap; Einheiten an der Naht
erscheinen genau einmal pro Seite. Betroffen: `src/render/renderer.ts` (`drawTiled`, evtl.
Wrap-Schleifen), `src/input/input.ts` (`minZoom`), evtl. `src/ui/minimap.ts` (Viewport-Rahmen).

## Konsequenzen

- **Pro:** Beendet die verwirrende „Tapete", macht den Torus intuitiv lesbar, kein Sim-Risiko.
- **Contra:** Auf sehr breiten Viewports + kleinen Karten ist „genau eine Periode" evtl. knapp
  (man kann nicht beliebig weit rauszoomen) — akzeptabel, ist ja der Sinn der Box.
- Unabhängig von Multiplayer (ADR-0009); kann davor oder danach kommen.
