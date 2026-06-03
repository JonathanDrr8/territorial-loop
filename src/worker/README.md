# `worker/` — Simulations-Host (für den Web-Worker-Umbau, ADR-0030)

Hier wohnt die **browser-freie Simulations-Treiber-Naht**, die schrittweise (ADR-0030) in einen
Web Worker wandert, damit ein teurer Sim-Tick die Oberfläche nie mehr einfriert.

## Was rein gehört

- `sim-host.ts` — `createSimHost`: kapselt Intent-Transport (`net/`), KI-Intent-Quelle (`ai/`), das
  `tick()`-Treiben aus `onCommitted` (+ Replay-Recorder + Desync-Hash-Meldung). **Kein DOM/`window`** —
  läuft auf dem Hauptthread (heute) genauso wie im Worker (Stufe 4).
- Später (Stufe 0/4): `protocol.ts` (Main↔Worker-Nachrichten), `sim.worker.ts` (Worker-Entry mit
  OffscreenCanvas-Renderer), `view-model.ts` (kompakter HUD-Snapshot + Hover-/Bau-Abfragen).

## Was NICHT rein gehört

- Kein DOM, kein `window`, kein Canvas-Setup (das Screen-Canvas + ResizeObserver bleiben im
  Hauptthread/`main.ts`; der Renderer bekommt das Canvas in Stufe 4 per `transferControlToOffscreen`).
- Keine UI-Logik (HUD/Input) — die liest künftig aus dem View-Model, nicht aus dem `state`.

## Stand

Stufe 1 (Renderer von DOM entkoppelt) + Stufe 2 (`createSimHost` extrahiert) umgesetzt; läuft noch auf
dem Hauptthread, Verhalten unverändert. Der Thread-Sprung (Stufe 4) folgt hinter einem Feature-Flag.
Siehe `docs/decisions/0030-sim-eigener-thread.md`.
