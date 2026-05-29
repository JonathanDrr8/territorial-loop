# ADR 0009: Multiplayer (server-autoritatives Lockstep) — Implementierungsplan

## Status

Proposed (Plan — noch nicht umgesetzt). Determinismus-Fundament + `hashState()` stehen bereits.

## Datum

2026-05-29 (Architektur 2026-05-30 auf server-autoritatives Lockstep umgestellt — skaliert auf
viele Menschen, statt Peer-Lockstep mit ~8er-Grenze).

## Kontext & Ziel

`territorial-loop` soll Multiplayer bekommen — **und zwar bis zu Matches mit ähnlich vielen
Menschen wie Bots** (Richtung der Bot-Skalierung, nicht nur 2–4). Die Simulation ist von Anfang
an **streng deterministisch** (ADR-0003): seeded PRNG (`core/random`), Zeit nur aus dem
Tick-Counter (kein `Date.now` in der Logik), Integer-lastiger State, feste Iterationsreihenfolge
(`orderedPlayers`), **Intents als einzige Mutationsquelle** (`tick(state, intents)`), und `core/`
hat **keine Browser-Abhängigkeiten** → die Sim läuft unverändert auch in Node.

## Entscheidung (Architektur): server-autoritatives Lockstep

**Server UND Clients führen dieselbe deterministische Sim** (`tick`). Der **Server ist die
autoritative Turn-Uhr**: er taktet die Ticks in festem Rhythmus, sammelt die Intents, bündelt sie
pro Turn, **führt die KI aus** und broadcastet das committete Intent-Set. Clients simulieren lokal
mit — übers Netz gehen **nur Intents** (geringe Bandbreite), kein State pro Tick. (So macht es
auch OpenFront: gleiche Sim auf Client+Server, Server = autoritativer Koordinator für
Turn-Verteilung und Desync-Erkennung.)

| Ansatz                                                        | Skaliert auf viele?                                               | Bandbreite           | Cheating                  | Gewählt?                                   |
| ------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------- | ------------------------- | ------------------------------------------ |
| Peer-Lockstep (Server wartet auf ALLE)                        | **Nein** — langsamster Client bremst alle (~8er-Grenze)           | sehr gering          | mittel                    | Nein                                       |
| **Server-autoritatives Lockstep** (Server taktet + simuliert) | **Ja** — Server ist die Uhr, Nachzügler resyncen statt zu bremsen | gering (nur Intents) | gut (Server-Truth + Hash) | **Ja**                                     |
| Voll State-Sync (Server schickt State/Deltas)                 | Ja                                                                | hoch                 | sehr gut                  | Nein — wirft den Determinismus-Vorteil weg |

**Konsequenz aus der Wahl:**

- Der **Server taktet die Turns mit fester Rate und wartet NICHT auf Nachzügler.** Ein laggiger
  Client hinkt hinterher und **resynct per Snapshot** — bremst aber niemanden. → skaliert.
- **Die KI läuft auf dem Server** (er simuliert ohnehin) und ihre Intents werden wie Spieler-
  Intents committet. Keine KI-Desync-Quelle, kein Host-Sonderfall.
- Der Server ist die **Quelle der Wahrheit**: ein Client, der (z.B. durch Engine-Unterschiede)
  abweicht, wird per Snapshot korrigiert — **Desync ist nicht mehr fatal** (im Peer-Modell wäre es
  das). Härten lohnt trotzdem (seltene Resyncs), ist aber kein K.O.-Kriterium.

## Determinismus — Garantien & Fallstricke

Bereits erfüllt: seeded PRNG, kein `Date.now`/`Math.random` in der Sim, feste Reihenfolgen,
Intents als einzige Mutation, `hashState()` ✅. **Weiter härten (jetzt „wünschenswert" statt
„fatal", weil der Server korrigiert):**

1. **Trigonometrie im Spawn** (`growSpawn`: `Math.sin/atan2`). Über JS-Engines nicht bit-genau →
   Client-Server-Abweichung. Mitigation: deterministische Eigen-Implementierung (Polynom/Lookup
   mit Integer-Eingang). Audit aller `Math.sin/cos/tan/atan2/exp/log/pow`, die in den **State**
   fließen (`Math.pow` in `config.ts` für Caps/Wachstum mit auditieren).
2. **Map-Iteration** über `orderedPlayers` (sortiert) — beibehalten.
3. **Floats**: +−×÷ und `sqrt` sind IEEE-754-deterministisch; `NaN`/`-0` meiden, keine `toFixed`
   in der Logik.
4. **Intents** tragen nur Integer — beibehalten.

Absicherung: Clients schicken alle N Ticks `hashState(state)` an den Server; weicht ein Hash vom
Server-Hash ab → der Client bekommt einen **Snapshot** und spielt ab dort weiter (Desync-Log +
ggf. Hinweis). Der Server läuft dabei als Truth.

## Code-Naht (Sim-Schleife)

Eine **Transport-Abstraktion** trennt „Intents einsammeln" von „Tick ausführen" — **identisch für
Single- und Multiplayer**, deshalb Phase 1:

```ts
interface IntentTransport {
  submit(intents: Intent[]): void // lokale Intents einreichen
  onCommitted(cb: (tick: number, intents: Intent[]) => void): void // committete Sets in Tick-Reihenfolge
  destroy(): void
}
```

- **LocalTransport** (Single-Player, exakt heutiges Verhalten): `submit` → sofort committed für den
  nächsten Tick. KI lokal.
- **NetworkTransport** (server-autoritatives Lockstep): `submit` schickt lokale Intents an den
  Server mit Ziel-Tick `N + INPUT_DELAY`; `onCommitted` feuert, sobald der **Server** den Turn N
  broadcastet (inkl. der vom Server erzeugten KI-Intents). `main.ts` treibt den Sim-Fortschritt aus
  `onCommitted` — `tick()`/Sim bleiben unberührt (reine Umverdrahtung).

## Tick-/Turn-Modell (server-getaktet)

- **Server ist die Uhr:** er rückt Turns mit fester Rate vor und committet Turn N mit allen bis zur
  **Deadline** eingegangenen Intents (+ KI-Intents). Säumige Client-Intents → gelten für N als
  „nicht da", kommen ggf. im nächsten Turn. **Kein Warten auf den Langsamsten.**
- **Input-Delay:** lokale Intents gelten erst für `currentTick + INPUT_DELAY` (z.B. 3 Ticks ≈
  300 ms) → die meisten Inputs sind rechtzeitig da, kein Ruckeln bei moderater Latenz; adaptiv.
- **Nachzügler:** ein Client, der zu weit hinter dem Server-Commit liegt, **resynct per Snapshot**
  statt zu blockieren.
- **Reihenfolge-Determinismus:** der Server sortiert die Intents eines Turns **stabil nach
  `playerId`** (dann Einreichungsindex) → alle bekommen exakt dieselbe Liste.

## Protokoll (WebSocket, JSON im MVP; später binär)

Client→Server: `join {room, name}` · `submitIntents {tick, intents}` · `stateHash {tick, hash}` ·
`ready` · `leave` · `ping`.
Server→Client: `joined {playerId, slot}` · `lobby {players[]}` · `start {seed, config, players}` ·
`commit {tick, intents}` (gebündeltes Set inkl. KI) · `snapshot {tick, state}` (Resync/Reconnect) ·
`peerFrozen {playerId}` / `peerResumed {playerId}` · `pong`.

## Lobby / UI

Neuer Menü-Pfad „**Mehrspieler**": Raum erstellen/beitreten per **Raum-Code**, Server-URL (Default:
gehosteter Relay; im Dev localhost), Spielerliste + Ready-Status, Host wählt Karte/Seed/Gegnerzahl.
Start sobald alle „ready". Bausteine aus `start-menu.ts`, `preferences.ts` (Server-URL/Name).

## Disconnect / Freeze / Reconnect (Design-Entscheidung)

- **Verlässt ein Mensch / lagt raus:** seine Nation wird **eingefroren** — sie wird **nicht** von
  der KI übernommen, gibt keine Intents ab (steht wie eine wilde Nation). **Aber:** sie bleibt
  **voll angreifbar**, und **Verbündete dürfen sie straffrei angreifen** (kein Verrat/keine
  Ächtung, solange sie eingefroren ist). Kommt der Mensch zurück, übernimmt er wieder.
  → Core-Zusatz: ein `frozen`-Flag je Spieler; `frozen` ⇒ keine Intents akzeptiert, und in
  `betrayAlliance`/Angriffs-Verrat zählt ein Angriff auf eine eingefrorene Nation nicht als Verrat.
- **Reconnect/Resync:** kein State über die Leitung im Normalbetrieb → ein Rejoin/Resync lädt einen
  **vollen GameState-Snapshot** (Server hält den letzten committeten Tick + periodischen Snapshot)
  und spielt ab dort weiter. Dafür `serializeState`/`deserializeState` (Maps + TypedArrays) **inkl.
  PRNG-Zustand** — `createPRNG` von `seedrandom.alea(seed)` auf `{ state: true }` umstellen und das
  `PRNG`-Interface um `state()` erweitern (zugleich Basis für Save/Load).

## Anti-Cheat

Server-autoritativ + Lockstep: der Server ist Truth, Clients senden nur eigene Intents (Server
prüft die `playerId`), und **Hash-Checksums** decken abweichende Clients auf → Snapshot-Korrektur
oder Kick. Stärker als reines Peer-Lockstep; voll State-Sync wäre noch sicherer, aber teurer.

## Implementierungs-Phasen

1. **Transport-Naht (lokal, kein Netz).** `IntentTransport` + `LocalTransport`, `main.ts` auf
   `submit`/`onCommitted` umstellen. Verhalten identisch zu heute. **Modell-egal.**
2. **Determinismus-Härtung.** ✅ `hashState()` (`src/core/hash.ts`) + Test. **Offen:** Trig-Audit
   in `growSpawn` → deterministische Eigen-Funktion. **Modell-egal.**
3. **Replay-Harness.** Intents aufzeichnen/laden/deterministisch abspielen (Lockstep-Validierung
   offline + Bug-Repros). **Modell-egal.**
4. **Server (Node + `ws`), simulierend & autoritativ.** Importiert `core/` und **simuliert die Sim
   mit**: Räume, Slot-Vergabe, Turn-Uhr (feste Rate), Intent-Sammlung + KI-Ausführung (`ai.decide`
   auf dem Server) + Commit-Broadcast, Hash-Vergleich, Snapshots. Health-Check-Endpoint.
5. **NetworkTransport + Lobby.** Client-Transport gegen den Server; Mehrspieler-Menü (Raum-Code,
   Ready, Start mit geteiltem Seed/Config). End-to-End: 2 Browser, 1 Match.
6. **Skalierung, Input-Delay, Freeze/Reconnect-Snapshot, Desync-UI, Politur.** `serializeState`/
   `deserializeState` (+ PRNG-State), adaptiver Input-Delay, Freeze-/Resync-Handling, Last-Tests
   mit vielen Slots.

Phasen 1–3 bringen schon allein Wert (Testbarkeit, Repros) und sind risikoarm — erst danach Server/Netz.

## Betroffene / neue Dateien

- `src/net/transport.ts` (neu) — `IntentTransport`, `LocalTransport`, `NetworkTransport`.
- `src/net/protocol.ts` (neu) — Nachrichten-Typen (Discriminated Union wie `intent.ts`).
- `src/core/hash.ts` (✅) — `hashState`.
- `src/core/serialize.ts` (neu) — `serializeState`/`deserializeState` (Maps + TypedArrays + PRNG).
- `src/core/game.ts` — Determinismus-Härtung (Spawn-Trig) + `frozen`-Flag (Disconnect-Freeze,
  Verrats-Ausnahme gegen Eingefrorene).
- `src/core/random.ts` — `PRNG.state()`, `createPRNG` mit `{ state: true }`.
- `src/main.ts` — Sim-Schleife auf Transport umstellen.
- `src/ui/multiplayer-menu.ts` (neu) — Lobby.
- `server/` (neu, Node + `ws`) — **simulierender** Relay-/Tick-Server: importiert `core/`, fährt die
  Sim + KI, taktet Turns, broadcastet Commits, vergleicht Hashes, hält Snapshots.
- Tests: Determinismus-Hash über N Ticks; Replay-Harness; Transport-Verträge.

## Konsequenzen

- **Pro:** Skaliert auf viele Menschen+Bots (Server ist die Uhr, Nachzügler resyncen), minimale
  Bandbreite (nur Intents), nutzt den Determinismus maximal, Single-Player bleibt über
  `LocalTransport` exakt gleich, Server-Truth = solide Anti-Cheat-/Desync-Basis, Replay-Tools als
  Nebenprodukt.
- **Contra/Risiko:** Der Server muss die Sim mitlaufen lassen (CPU pro Match — bei vielen Bots wie
  im Single-Player, plus Turn-Verwaltung). Reconnect/Resync braucht robuste State-Serialisierung
  (inkl. PRNG-Zustand). Cross-Engine-Trig verursacht sonst häufige Resyncs → vor Phase 4 härten.
- **Reihenfolge:** Phasen 1–3 (Naht + Härtung + Replay) zuerst (Wert + risikoarm), dann der
  simulierende Server.
