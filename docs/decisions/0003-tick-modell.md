# ADR 0003: Tick-Modell — Fixed 10 Hz Sim, entkoppelter Render

## Status

Accepted

## Datum

2026-05-27

## Kontext

Wir brauchen ein Tick-Modell für die Game-Simulation. Anforderungen:

- **Deterministisch** — selber Seed + Intents = selber State (CLAUDE.md Pflicht)
- **Pause + Speed-Regler** (1x/2x/5x) — MVP-Anforderung
- **Visuell flüssig** trotz diskreter Sim — Rendering darf nicht ruckeln
- **Kompatibel mit OpenFront-Mechaniken** — deren Formeln sind auf konkrete Tick-Rate kalibriert

Optionen:

1. **Variable Timestep** — Sim läuft mit Render-Loop, `dt` als Multiplier
2. **Fixed Timestep mit Interpolation** — Sim bei z.B. 30 Hz, Render interpoliert visuell
3. **Fixed Timestep, entkoppelt, ohne Interpolation** — Sim bei 10 Hz, Render bei 60 fps liest aktuellen State
4. **Sim im Render-Loop bei festem dt** — Sim läuft pro Render-Frame, dt fix, einfachster Code

## Entscheidung

**Option 3 — Fixed Timestep 10 Hz, entkoppelt vom Render-Loop, ohne Interpolation.**

- Sim-Loop: `setInterval(simTick, 100ms)` (anpassbar via Speed-Regler: 100/50/20ms)
- Render-Loop: `requestAnimationFrame` mit 60 fps (Browser-abhängig)
- Beide Loops teilen sich denselben Game-State (Sim mutiert, Render liest)
- Pause stoppt nur den Sim-Loop, Render läuft weiter (sonst keine Reaktion auf Pan/Zoom)

## Begründung

### Determinismus

Variable Timestep (Option 1) verletzt Determinismus sofort — der gleiche Spielzug mit anderem Frame-Rate führt zu anderem Outcome. Disqualifikator.

### OpenFront-Parität

OpenFront tickt mit 10 Hz und alle dort recherchierten Formeln (Bevölkerungs-Wachstum, Tiles-pro-Tick, Verlust-Berechnungen) sind auf "pro 100ms" kalibriert. Wenn wir dieselbe Rate fahren, sind die Werte 1:1 übernehmbar.

### Kein Interpolations-Bedarf im MVP

Render zeigt eine Bitmap — Tile-Färbungen sind diskret und ändern sich pro Tick um wenige Pixel. Es gibt keine "fließenden" Bewegungen die Interpolation rechtfertigen würden (kein bewegtes Sprite). Wenn später Boats/Animationen dazukommen: Render kann pro Animation visuell glätten ohne dass die Sim das wissen muss.

### Speed-Regler-Simplizität

Speed-Wechsel = `clearInterval` + `setInterval` mit neuem Interval. Pause = `clearInterval`. Render bleibt unbeeinflusst. Sehr einfach.

### Entkopplung vs. Option 4

Sim im Render-Loop (Option 4) klingt einfach, koppelt aber Sim-Rate an Browser-Frame-Rate. Bei 60Hz vs 144Hz Display würden Spiele sich anders anfühlen — Disqualifikator wenn Multiplayer mal kommt.

## Konsequenzen

- **Vorteil:** Determinismus garantiert
- **Vorteil:** OpenFront-Formeln 1:1 nutzbar
- **Vorteil:** Pause/Speed-Regler trivial
- **Nachteil:** Bei 10 Hz Sim und 60 fps Render werden 5/6 der Render-Frames den gleichen State zeichnen — leichter visueller Stau bei sehr langsamen Bewegungen. Im MVP nicht problematisch (Eroberung ist eh diskret), kann später durch Render-seitige Animationen (z.B. Capture-Fade) kosmetisch geglättet werden.
- **Nachteil:** `setInterval` ist nicht zeit-genau bei stark belasteter Tab — minimale Drift möglich. Akzeptabel für SP, bei MP später durch Server-authoritative Ticks gelöst.

## Alternativen verworfen

- **Variable Timestep:** Bricht Determinismus.
- **Fixed mit Interpolation:** Im MVP überengineert (nichts bewegt sich kontinuierlich).
- **Sim im RAF-Loop:** Koppelt an Display-Refresh-Rate, inkonsistent zwischen Geräten.

## Reviewdatum

Bei Bedarf für Animationen, oder wenn Multiplayer Server-Ticks erfordert.
