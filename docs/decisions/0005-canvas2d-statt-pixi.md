# ADR 0005: Canvas 2D ersetzt Pixi.js / WebGL als Renderer

## Status

Accepted (supersedes Renderer-Wahl in ADR-0001)

## Datum

2026-05-28

## Kontext

ADR-0001 hatte Pixi.js 8 mit WebGL als Renderer-Bibliothek vorgesehen. Das war
für das angepeilte Performance-Profil (tausende Tiles per Frame) die naheliegende
Wahl.

Die erste Pixi-Integration (Commit `05189e8`) initialisierte sauber, zeigte aber
auf dem Entwicklungs-Setup (CachyOS + Hyprland) ein durchgehend schwarzes Canvas:

- Pixi-Application initialisierte ohne Fehler
- Die `TilingSprite` wurde mit korrekten Dimensionen und einer gültigen Texture
  ins Stage-Objekt aufgenommen
- `app.render()` lief, der Background-Color-Setter wurde akzeptiert
- Aber: `readPixels` auf den WebGL-Drawing-Buffer lieferte ausschließlich
  `(0, 0, 0, 255)` — auch der Background-Color landete nicht im Buffer

Im Playwright-Test-Browser (Chromium über Linux ohne Hyprland) rendert dieselbe
Pixi-Konfiguration korrekt. Es handelt sich also nicht um einen Code-Fehler,
sondern um einen Browser/Compositor/Driver-Edge-Case auf dem Zielsystem.

Optionen:

1. **Pixi-Konfiguration weiter debuggen** — `preserveDrawingBuffer: true`,
   andere `powerPreference`, alternative GPU
2. **Pixi durch eigenes WebGL-Setup ersetzen** — mehr Kontrolle, mehr Code
3. **Canvas 2D verwenden**

## Entscheidung

**Option 3: Canvas 2D.**

Implementation in `src/render/renderer.ts`:

- Offscreen-Canvas in Map-Auflösung (z.B. 256×256), wird pro Frame aus dem
  Game-State neu gemalt (Owner-ID → Player-Color via Mini-LUT)
- On-Screen-Canvas in Viewport-Größe, zeichnet die Offscreen-Textur per
  `drawImage` mehrfach mit Wrap-Offsets — **das ist der Torus-Wrap, ganz ohne
  Shader**
- Camera = `(x, y, zoom)` in Welt-Koords; `drawImage`-Scaling und -Position
  werden daraus berechnet

## Begründung

### Portabilität

Canvas 2D funktioniert in jedem Browser, auf jedem OS, mit jedem Compositor.
Keine Driver-Probleme, keine GPU-Detection, kein Context-Loss-Handling.

### Ausreichende Performance

Bei 1024×1024-Maps (≈1 Mio. Tiles) und 60 fps-Render-Loop: keine messbare
Frame-Drops. Der Hotloop ist die Bitmap-Aktualisierung (4 Bytes pro Pixel
schreiben), und JS-typed-arrays sind dabei nahe an C-Speed.

### Code-Einfachheit

Kein Pixi-Stage-Tree, keine TilingSprite-Konfiguration, kein
`await app.init(...)` mit async-Boot. Renderer ist eine Funktion, gibt ein
Objekt zurück, fertig.

### Torus-Wrap ist trivial

Die `drawImage`-Schleife mit 3×3-Wrap-Offsets ist 10 Zeilen Code und macht
genau das was wir wollen — beliebige Camera-Position, beliebiger Zoom, korrektes
Looping.

## Konsequenzen

- **Vorteil:** Funktioniert garantiert auf jedem Setup, inklusive Jonathan's
  Hyprland-Maschine
- **Vorteil:** Renderer ist ~170 Zeilen statt einem komplexen Pixi-Setup
- **Vorteil:** Kein Pixi-Lock-in mehr — der Canvas-Ansatz bleibt verständlich
  für jeden mit JavaScript-Kenntnissen
- **Nachteil:** Bei extremen Map-Größen (>4M Tiles) könnte die Bitmap-Aktualisierung
  zum Bottleneck werden — Pixi-WebGL hätte da Vorteile durch GPU-Upload-Path.
  Aktueller Stand (1M Tiles auf 60 fps): kein Problem.
- **Nachteil:** Komplexere visuelle Effekte (Beleuchtung, Partikel-Systeme,
  Shader-Effekte) wären in WebGL einfacher. Im aktuellen MVP-Scope nicht
  relevant; falls sie später kommen, kann ein einzelner Effekt-Pass via
  WebGL-Canvas darübergelegt werden.

## Pixi-Dependency

`pixi.js` ist noch in `package.json` — wir lassen es kurzfristig drin falls
wir später z.B. einen Partikel-Effekt-Layer brauchen. Sollte bis zum Ende der
Polish-Phase nichts in der Richtung gebraucht werden, kann es bei der nächsten
Dependency-Aufräumung entfernt werden.

## Reviewdatum

Bei Performance-Problemen oder wenn wir GPU-only Effekte (Shader, Particles)
einführen wollen.
