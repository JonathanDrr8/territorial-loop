# `net/` — Netzwerk-/Transport-Schicht

Trennt die Sim-Schleife vom „Woher kommen die committeten Intents". Diese Naht ist
**identisch für Single- und Multiplayer** (ADR-0009) und der erste, modell-egale
Multiplayer-Schritt.

## Was hier rein gehört

- **`IntentTransport`** — das Interface, gegen das `main.ts` codet: `submit(intents)`,
  `onCommitted(cb)`, `setRunning`, `setIntervalMs`, `destroy`.
- **`LocalTransport`** — Single-Player: besitzt die Takt-Uhr (`setInterval`), bündelt
  eingereichte Intents pro Turn und hängt die KI-Intents an. Reproduziert die alte
  `runSimTick`-Schleife 1:1.
- Später: **`NetworkTransport`** (server-autoritatives Lockstep) — gleiches Interface,
  `submit` → an den Server, `onCommitted` ← Server-Broadcast inkl. KI-Intents.

## Was hier NICHT rein gehört

- **Keine Spiel-Logik.** Der Transport ruft `tick()` nicht selbst — `main.ts` macht das in
  seinem `onCommitted`-Handler. Der Transport puffert/bündelt nur Intents.
- **Kein Rendering, keine UI, kein DOM** (außer den Timer-Funktionen, die injizierbar sind).
- **Kein Nicht-Determinismus**: kein `Date.now`, kein `Math.random`, kein Float-State.

## Reihenfolge-Garantie

Ein committetes Set ist `[eingereichte Intents in submit-Reihenfolge…, server-seitige
Intents (lokal: KI)…]`. `tick()` wendet Intents in dieser Reihenfolge an — die Reihenfolge
ist also teil des Determinismus-Vertrags und darf nicht umsortiert werden.
