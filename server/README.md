# `server/` — Simulierender Lockstep-Server (ADR-0009 Phase 4)

Node + `ws`. Autoritativer Koordinator **und** Mitsimulant: fährt je Raum dieselbe
deterministische Sim wie die Clients (`createGame`+`tick` aus `src/core/`), ist die Turn-Uhr,
führt die KI aus und broadcastet pro Turn nur das committete Intent-Set.

## Starten

Im Dev läuft der Server **automatisch mit** `npm run dev` (Vite-Plugin in `vite.config.ts` ruft
`startServer(8787)`). Kein zweites Terminal nötig — die Lobby ist sofort erreichbar.

Eigenständig (z.B. fürs Deployment) zusätzlich:

```bash
npm run dev:server   # tsx watch (Reload bei Änderungen)
npm run server       # einmalig
# PORT=9000 npm run server   # anderer Port (Default 8787)
```

Health-Check: `GET http://localhost:8787/health` → `ok`. Ist der Port schon belegt, toleriert das
Vite-Plugin das (nutzt den laufenden Server) statt zu crashen.

## Dateien

- **`match.ts`** — `ServerMatch`: die autoritative Sim **ohne I/O** (deterministisch unit-getestet
  in `tests/server-match.test.ts`). Buffert Client-Intents pro Turn, hängt KI-Intents an, ticked,
  liefert Commit + Hash; Freeze, Hash-Verifikation, Snapshot.
- **`server.ts`** — `ws`+`http`: Räume, Slot-Vergabe, Turn-Uhr, Broadcast, Disconnect→Freeze,
  Reconnect→Snapshot, Desync→Snapshot. Protokoll-Typen in `src/net/protocol.ts`.

## Was hier NICHT rein gehört

- **Keine Spiel-Logik** — die lebt in `src/core/`. Der Server importiert sie nur.
- **Kein Nicht-Determinismus in der Sim** — `Math.random`/`Date.now` sind hier nur für I/O
  erlaubt (Raum-Codes), nie für Sim-relevante Entscheidungen.

## Status / offen (Phase 5+)

- Client-Anbindung (`NetworkTransport`) + Mehrspieler-Lobby (Raum-Code/Ready/Config) — Phase 5.
- Host-konfigurierbare Matches (Karte/Seed/Gegnerzahl) statt Defaults; adaptiver Input-Delay;
  periodische Snapshots; Lasttests — Phase 6.
