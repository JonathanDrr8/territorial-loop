# `src/input/` — Eingabe-Verarbeitung

## Zweck

Maus-, Tastatur- und Touch-Eingaben in **Game-Intents** übersetzen.

## Was gehört rein

- Maus-Handler (Klick, Drag, Scroll für Zoom, Pan)
- Tastatur-Handler (Shortcuts, Kamera-Bewegung)
- Touch-Handler (Pinch-Zoom, Multi-Touch)
- Konvertierung Screen-Koordinaten → Welt-Koordinaten (mit Torus-Wrap)
- Intent-Emitter (gibt Intents an `core/` weiter)

## Was gehört NICHT rein

- Direkte State-Mutation (immer über Intents)
- UI-Buttons (die handhabt `src/ui/`)
- Rendering der Cursors (das ist `src/render/`)

## Konventionen

- **Inputs werden zu Intents** — kein direktes State-Manipulieren
- **Bildschirm-zu-Welt-Konvertierung wrappt** — Klick am Rand kann auf die andere Seite zeigen

## Öffentliche API

(wird in Phase B definiert)
