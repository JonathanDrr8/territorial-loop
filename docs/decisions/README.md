# Architecture Decision Records (ADRs)

Hier liegen die wichtigen Architektur-Entscheidungen mit Kontext und Begründung.

## Format

Jedes ADR ist eine eigene Markdown-Datei nach dem Schema `NNNN-kurzer-titel.md`:

```markdown
# ADR NNNN: <Titel>

## Status

Proposed | Accepted | Deprecated | Superseded by ADR XXXX

## Datum

YYYY-MM-DD

## Kontext

Welches Problem oder welche Frage haben wir? Welche Optionen gab es?

## Entscheidung

Was haben wir entschieden? Klar und eindeutig.

## Begründung

Warum diese Option? Welche Trade-Offs wurden akzeptiert?

## Konsequenzen

Was bedeutet das für den Code, das Team, künftige Entscheidungen?

## Alternativen (optional)

Welche Optionen wurden verworfen und warum?
```

## Wann ein ADR schreiben?

Schreibe ein ADR wenn eine Entscheidung:

- **schwer rückgängig zu machen** ist (z.B. "Wir nutzen Pixi.js statt Phaser")
- **Auswirkungen über mehrere Module** hat
- **nicht offensichtlich** ist (z.B. "Warum Torus und nicht Sphäre?")
- **Trade-Offs** beinhaltet, die nachvollziehbar sein sollten

Triviale Entscheidungen (z.B. "Datei-Naming") brauchen keine ADRs.

## Aktive ADRs

- [0001 — Tech-Stack-Auswahl](./0001-tech-stack.md)
- [0002 — Map als Dual-TypedArray](./0002-map-datenstruktur.md)
- [0003 — Tick-Modell: Fixed 10 Hz Sim, entkoppelter Render](./0003-tick-modell.md)
- [0004 — OpenFront-Mechaniken als MVP-Baseline übernehmen](./0004-openfront-mechaniken.md)
- [0005 — Canvas 2D ersetzt Pixi.js / WebGL als Renderer](./0005-canvas2d-statt-pixi.md)
