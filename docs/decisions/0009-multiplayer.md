# ADR 0009: Multiplayer (server-autoritatives Lockstep) — Implementierungsplan

## Status

Spielbar im Mehrspieler. **Phasen 1–5 fertig** (Transport-Naht, Determinismus-Fundament inkl.
Snapshot/PRNG-State/Freeze/det-math, Replay-Harness, simulierender ws-Server, Client-Transport +
Lobby — zwei Browser-Tabs in Lockstep verifiziert). **Phase 6 (Politur) teilweise umgesetzt:**
adaptiver Input-Delay (ping/pong) ✅, **Mid-Match-Resync** ✅ (`loadSnapshotInto` lädt Server-
Korrektur-Snapshots IN-PLACE in den laufenden State, `renderer.invalidate()` + transienter
`hud.flashResync()`-Hinweis — abgedrifteter Client schnappt zurück statt still weiterzudriften;
Unit-Test bit-genau), **pfad-basierte Einladungslinks** ✅ (`/r/CODE`, `?room=` als Fallback,
SPA-Fallback des Servers liefert beliebige Pfade). **Verbleibend (Proposed):** periodische
server-seitige Snapshots (proaktiv statt nur auf Desync), Lasttests mit vielen Slots,
gehostetes Deployment-Härten.

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

1. **Transport-Naht (lokal, kein Netz).** ✅ `IntentTransport` + `LocalTransport`
   (`src/net/transport.ts`), `main.ts` auf `submit`/`onCommitted` umgestellt. Verhalten identisch
   zu heute (Browser verifiziert: Takt/Pause/Resume/KI). **Modell-egal.**
2. **Determinismus-Härtung.** ✅ `hashState()` + `frozen`-Flag + Snapshot-Fundament:
   - ✅ `serializeState`/`deserializeState` (`src/core/serialize.ts`) — voller GameState-Snapshot,
     **inkl. PRNG-Zustand** (`createPRNG` auf `seedrandom.alea(…, {state:true})`, `PRNG.state()`).
     Garantie getestet: `deserialize(serialize(s))` läuft bit-genau weiter.
   - ✅ `frozen`-Flag (`setFrozen`/`isFrozen`) + Freeze-Semantik (keine Intents, Verrats-Ausnahme).
   - ✅ `Math.pow(2,n)` in `buildCost` → Integer-Verdopplung (cross-engine-exakt).
   - ⏳ **Offen (Jonathan-Entscheidung, siehe „Transzendenten-Audit"):** Trig in `growSpawn` und
     `terrain` + fraktionale `Math.pow` in `config.ts` (`maxTroops`, `troopIncreaseRate`). **Modell-egal.**
3. **Replay-Harness.** ✅ `src/core/replay.ts` (`RecordedTurn`/`Replay`, `createRecorder`,
   `replayGame`). `main.ts` schneidet jeden Turn mit (`__TL__.recorder`). Browser verifiziert:
   107 Live-Ticks → Replay aus `config+turns` ergibt identischen Hash. **Modell-egal.**
4. **Server (Node + `ws`), simulierend & autoritativ.** ✅ `src/net/protocol.ts` (Wire-Typen),
   `server/match.ts` (`ServerMatch` — autoritative Sim ohne I/O: buffert Client-Intents pro Turn
   inkl. Anti-Spoofing, führt die KI aus, ticked, liefert Commit+Hash; Freeze, Hash-Verify,
   Snapshot), `server/server.ts` (`startServer` — ws+http: Räume, Slot-Vergabe, Turn-Uhr,
   Commit-Broadcast, Disconnect→Freeze, Reconnect/Desync→Snapshot, `/health`). `npm run server`
   / `dev:server`. Verifiziert: 6 Unit-Tests + 2 echte End-to-End-Tests (zwei ws-Clients in
   Lockstep auf identischem Hash).
5. **NetworkTransport + Lobby.** ✅ `NetworkTransport` (zweite `IntentTransport`-Implementierung,
   `submit`→Server / `onCommitted`←Broadcast, frühe Commits gepuffert, Match-Lebenszyklus über
   Callbacks). Host-konfigurierbare `MatchSettings` (Karte/Gegner/Seed/Terrain/Schwierigkeit) per
   `configure`-Nachricht. Lobby-UI `src/ui/multiplayer-menu.ts` (Raum-Code, Teilnehmer+Ready, Host-
   Settings) + „Mehrspieler"-Button im Start-Menü. `main.ts`: `HUMAN_ID` → Session-`humanId`,
   `startMatch` nimmt optional eine `NetSession` (Server-Config + Transport, keine lokale KI/Uhr,
   meldet Hash je Tick). **Verifiziert:** zwei echte Browser-Tabs (Host konfiguriert + beide ready)
   laufen über 1000+ Ticks in identischem Hash.
6. **Skalierung, Input-Delay, Freeze/Reconnect-Snapshot-UI, Desync-UI, Politur.** ✅ Adaptiver
   Input-Delay (ping/pong → `inputDelay`), ✅ **Mid-Match-Resync** (`loadSnapshotInto` in-place +
   `renderer.invalidate()` + transienter `hud.flashResync()`), ✅ **pfad-Einladungslinks** `/r/CODE`.
   **Offen:** proaktive periodische Server-Snapshots, Last-Tests mit vielen Slots, Deployment-Härten.

Phasen 1–4 sind **umgesetzt** (Stand 2026-05-29) — Sim-Naht, Determinismus-Fundament (Snapshot/
PRNG/Freeze/det-math), Replay und der simulierende Server stehen und sind getestet. Phase 5
(Client-Transport + Lobby) ist der nächste, UI-lastige Schritt.

## Transzendenten-Audit (Cross-Engine-Determinismus) — offene Entscheidung

Audit aller `Math.*`-Transzendenten, deren Ergebnis in den **State** fließt (relevant erst, wenn
Client und Server in **verschiedenen JS-Engines** laufen — `+ − × ÷` und `sqrt` sind IEEE-754-exakt,
aber `sin/cos/atan2/pow` sind es **nicht** bit-genau):

| Stelle                          | Funktion            | Läuft          | In State?                 | Risiko             |
| ------------------------------- | ------------------- | -------------- | ------------------------- | ------------------ |
| `config.ts` `maxTroops`         | `pow(tiles, 0.6)`   | **jeden Tick** | Truppen-Cap (→ floor int) | **hoch** (laufend) |
| `config.ts` `troopIncreaseRate` | `pow(troops, 0.73)` | **jeden Tick** | Wachstum (→ floor int)    | **hoch** (laufend) |
| `game.ts` `growSpawn`           | `sin`, `atan2`      | einmal (Setup) | Spawn-Form/Owner-Karte    | mittel (einmalig)  |
| `terrain.ts`                    | `cos`, `sin`        | einmal (Setup) | Karten-Höhen              | mittel (einmalig)  |
| `buildings.ts` `buildCost`      | ~~`pow(2,n)`~~      | —              | ✅ ersetzt (Integer)      | erledigt           |

**Warum nicht jetzt blind ersetzt:** Eine deterministische Eigen-Implementierung (Polynom-`exp`/`ln`
für `pow`, Minimax-`sin/cos` — alles nur mit `+−×÷`, damit **alle Engines dieselben Bits** liefern)
ist machbar, **verändert aber Jonathans gerade gebalancte Werte** (Cap/Wachstum um ≤1 Truppe) und
**die aus einem Seed erzeugten Karten/Spawns** sichtbar. Da der Server abweichende Clients ohnehin
per Snapshot korrigiert, ist Cross-Engine-Drift **kein K.O., sondern „häufigere Resyncs"** — daher
**vor Phase 4 mit Jonathan abstimmen**, nicht autonom durchziehen.

Optionen (zur Entscheidung):

1. **Deterministische `det-math` einziehen** (`pow`/`sin`/`cos`/`atan2` aus reiner Arithmetik) und
   die fünf Stellen umstellen. Cross-Engine-sauber; Preis: minimale Balance-/Karten-Verschiebung
   (einmalig, danach stabil).
2. **Nur die laufenden `pow` (config.ts) härten**, Setup-Trig (Spawn/Terrain) so lassen — der
   Server schickt die Start-Karte/-Spawns im `start`/Snapshot mit, statt sie clientseitig zu
   regenerieren. Spart die Karten-Verschiebung, kostet etwas Bandbreite beim Start.
3. **Gar nicht härten** — Server korrigiert per Snapshot. Einfachster Weg, aber spürbar mehr
   Resyncs für Clients auf fremder Engine (z.B. Firefox-Client ↔ Node-Server).

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
