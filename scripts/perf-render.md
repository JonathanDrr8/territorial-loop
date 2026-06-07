# Render-Performance messen (Frame-Zeit im Browser)

Die **Sim**-Last misst `npm run perf` (headless, deterministisch). Die **Render**-Last (Canvas-
Zeichnen auf echter GPU) lässt sich nur im echten Browser messen — headless-Chromium nutzt
Software-Rendering (SwiftShader) und verfälscht die Zahlen.

Dieses Snippet misst die echte **Frame-Zeit** über `requestAnimationFrame` und meldet
Median/p95/p99/Max + die Zahl langer Frames (Ruckler).

## So geht's

1. Ein **schweres Match** starten (Start-Menü → Preset **Chaos**, große Karte) und kurz laufen lassen,
   bis die Karte voll ist.
2. DevTools öffnen (F12) → Reiter **Console**.
3. Das Snippet unten einfügen, Enter.
4. Während der 10 s **aktiv schwenken und zoomen** (genau das, was sich ruckelig anfühlt) — einmal
   weit rausgezoomt (ganze Welt) und einmal reingezoomt testen, das sind verschiedene Render-Lasten.
5. Ergebnis ablesen.

```js
;(() => {
  const frames = []
  let last = performance.now()
  const SECONDS = 10
  const stop = last + SECONDS * 1000
  const pct = (a, q) => {
    const s = [...a].sort((x, y) => x - y)
    return s[Math.min(s.length - 1, Math.floor(q * s.length))] || 0
  }
  const loop = (now) => {
    frames.push(now - last)
    last = now
    if (now < stop) requestAnimationFrame(loop)
    else {
      const f = frames.slice(1) // erste Δ verwerfen
      const max = Math.max(...f)
      console.log(`%cRender-Messung (${f.length} Frames / ${SECONDS}s)`, 'font-weight:bold')
      console.log(
        `Frame-Zeit ms — Median ${pct(f, 0.5).toFixed(1)} | p95 ${pct(f, 0.95).toFixed(1)} | p99 ${pct(f, 0.99).toFixed(1)} | max ${max.toFixed(1)}`,
      )
      console.log(
        `FPS — Median ${(1000 / pct(f, 0.5)).toFixed(0)} | 5%-schlechteste ~${(1000 / pct(f, 0.95)).toFixed(0)}`,
      )
      console.log(
        `Lange Frames — >16.7ms (unter 60fps): ${f.filter((d) => d > 16.7).length} | >33ms: ${f.filter((d) => d > 33).length} | >50ms (sichtbarer Ruckler): ${f.filter((d) => d > 50).length}`,
      )
    }
  }
  requestAnimationFrame(loop)
  console.log(`Messung läuft ${SECONDS}s … jetzt schwenken/zoomen!`)
})()
```

## Deuten

- **Median nahe 16.7 ms (~60 FPS)** = flüssig.
- Viele **Frames >33 ms** oder einzelne **>50 ms** = die spürbaren Ruckler. Tritt das nur bei einem
  bestimmten Zoom auf (z. B. ganz rausgezoomt mit allen Labels), liegt es am Render, nicht an der Sim.
- Gegenprobe: ist die **Sim** sauber (`npm run perf -- chaos --phases` zeigt niedrige p99/max), das
  Render aber zäh → der Engpass ist das Zeichnen (Tiles/Labels/Schiffe), nicht die Logik.
