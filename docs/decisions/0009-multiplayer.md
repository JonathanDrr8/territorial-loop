# ADR 0009: Multiplayer (Lockstep über die deterministische Sim) — Implementierungsplan

## Status

Proposed (Plan — noch nicht umgesetzt)

## Datum

2026-05-29

## Kontext

`territorial-loop` soll Multiplayer bekommen. Die Simulation ist von Anfang an **streng
deterministisch** gebaut (ADR-0003): seeded PRNG (`core/random`), Zeit nur aus dem
Tick-Counter (kein `Date.now` in der Logik), Integer-lastiger State, feste
Iterationsreihenfolge (`orderedPlayers`), und **Intents sind die einzige Mutationsquelle**
(`tick(state, intents)`). Das ist exakt die Voraussetzung für **Lockstep-Netcode**: Clients
tauschen nur die Intents (+ Tick-Nummer) aus und simulieren lokal identisch — es wird **kein
Spielzustand übertragen** (nur bei Reconnect ein Snapshot).

Dieser ADR schreibt den kompletten Weg vor, sodass die spätere Umsetzung „nur noch
Abarbeiten" ist. Er ist bewusst detailliert (auf Jonathans Wunsch).

## Entscheidung (Architektur)

**Lockstep mit dünnem, autoritativem Relay-Server.** Begründung der Wahl:

| Ansatz                                       | Bandbreite                     | Cheating                       | Komplexität                     | Passt?                                     |
| -------------------------------------------- | ------------------------------ | ------------------------------ | ------------------------------- | ------------------------------------------ |
| **Lockstep (Intents)**                       | sehr gering (nur Intents/Tick) | mittel (mit Checksums gut)     | mittel                          | **Ja** — Sim ist schon deterministisch     |
| State-Sync (Server simuliert, schickt State) | hoch (großer State je Tick)    | sehr gut                       | hoch (Server-Authoritative-Sim) | Nein — wirft den Determinismus-Vorteil weg |
| P2P-Lockstep ohne Server                     | gering                         | schlecht (kein Schiedsrichter) | mittel                          | Nur als Fallback                           |

Empfehlung: **Lockstep**, koordiniert von einem **leichten Relay-/Tick-Server** (Node +
`ws`). Der Server simuliert NICHT — er sammelt pro Tick die Intents aller Clients, ordnet sie
deterministisch und broadcastet das **gebündelte Intent-Set für Tick N**. Alle Clients führen
`tick(state, committedIntents)` damit aus → identischer State. Der Server gibt außerdem
Spieler-Slots aus, hält den Seed/Config, und erkennt Desyncs per Checksum.

## Determinismus — Garantien & Fallstricke (KRITISCH)

Lockstep desynct sofort, wenn zwei Clients bei gleichem Input auch nur 1 Bit abweichen.
Bereits erfüllt: seeded PRNG, kein `Date.now`/`Math.random` in der Sim, feste Reihenfolgen,
Intents als einzige Mutation. **Vor MP zu härten:**

1. **Trigonometrie im Spawn.** `growSpawn` nutzt `Math.sin/atan2/sqrt` (`game.ts`,
   Spawn-Lappen). `sqrt` ist IEEE-754 (bit-identisch), aber **`sin/cos/atan2` sind über
   JS-Engines NICHT bit-genau standardisiert** → Risiko bei gemischten Browsern (Chrome vs
   Firefox). Mitigation: entweder (a) MP nur „same-engine" garantieren (unrealistisch), oder
   (b) **die Spawn-Trig durch eine deterministische Eigen-Implementierung ersetzen**
   (Polynom-Approximation/Lookup mit Integer-Eingang) — bevorzugt. Audit: alle `Math.sin/cos/
tan/atan2/exp/log/pow`-Aufrufe finden, die in den **State** fließen, und ersetzen oder als
   „nur Anzeige" bestätigen (`Math.pow` in `config.ts` für Caps/Wachstum fließt in State →
   ebenfalls auditieren; `pow` mit ganzzahligen/halben Exponenten ist meist stabil, aber
   absichern).
2. **Map-Iteration.** `state.players` ist eine `Map` (Insertions-Reihenfolge, deterministisch),
   die heiße Iteration läuft über `orderedPlayers` (sortiert) — beibehalten. Keine
   `Object`-Key-Iteration über Zahlen-Keys in der Sim.
3. **Floats.** JS-`number` (IEEE-754 double) ist für +−×÷ und `sqrt` plattform-deterministisch.
   `NaN`/`-0` vermeiden. Keine `toFixed`-Rundungen in der Logik.
4. **KI-Determinismus.** Bots müssen auf allen Clients identische Intents erzeugen ODER nur an
   EINER Stelle laufen. **Entscheidung:** Die KI läuft **autoritativ auf dem Server (oder dem
   designierten Host)** und ihre Intents werden wie Spieler-Intents gebroadcastet. So muss kein
   Client die KI deterministisch nachbauen, und es gibt keine KI-Desync-Quelle.
5. **Float in Intents.** Intents tragen nur Integer (`troops`, `tile`, IDs) — beibehalten.

Absicherung: **State-Hash** (`hashState(state) → uint32`, FNV/xxhash über Owner-Array +
Truppen + Gold + Tick) alle N Ticks an den Server; der Server vergleicht die Hashes aller
Clients und meldet Desync (Logging + Pause), statt dass das Spiel still auseinanderläuft.

## Code-Naht (so wird die Sim-Schleife umgebaut)

Heute (`main.ts`, vereinfacht):

```ts
function runSimTick() {
  if (paused) return
  for (const ai of ais) for (const intent of ai.decide(state)) pendingIntents.push(intent)
  tick(state, pendingIntents) // sofort lokal
  pendingIntents.length = 0
}
setInterval(runSimTick, SIM_BASE_INTERVAL_MS / speed)
```

Neu — eine **Transport-Abstraktion** trennt „Intents einsammeln" von „Tick ausführen":

```ts
interface IntentTransport {
  /** Lokale Intents für einen künftigen Tick einreichen. */
  submit(intents: Intent[]): void
  /**
   * Liefert die committeten Intent-Sets in Tick-Reihenfolge. Single-Player: sofort der
   * eigene Input. Netzwerk: erst wenn der Server Tick N committet hat.
   */
  onCommitted(cb: (tick: number, intents: Intent[]) => void): void
  destroy(): void
}
```

- **LocalTransport** (Single-Player, Verhalten exakt wie heute): `submit` → sofort als
  committed für den nächsten Tick zurückrufen. Kein Verhaltensunterschied, keine Latenz.
- **NetworkTransport** (Lockstep): `submit` schickt die lokalen Intents an den Server mit
  Ziel-Tick `N + INPUT_DELAY`. `onCommitted` feuert, sobald der Server das gebündelte Set für
  einen Tick broadcastet. `runSimTick` ruft **nicht mehr direkt `tick()`**, sondern verarbeitet
  die committeten Sets der Reihe nach.

`main.ts` wird so umgebaut, dass der Sim-Fortschritt von `onCommitted` getrieben wird (lokale
KI-Intents nur im LocalTransport; im Netzwerk kommen sie vom Host). Das ist eine **reine
Umverdrahtung** — `tick()`/Sim bleiben unberührt.

## Tick-/Turn-Modell (Latenz verstecken)

- **Input-Delay-Buffer:** Lokale Intents gelten erst für `currentTick + INPUT_DELAY`
  (z.B. 3 Ticks ≈ 300 ms bei `SIM_BASE_INTERVAL_MS=100`). So hat jeder Client Zeit, die Intents
  aller anderen für diesen Ziel-Tick zu empfangen, bevor er ihn ausführt → kein Ruckeln bei
  moderater Latenz. Der Wert ist an die Ping-Zeit anpassbar (adaptiv).
- **Commit-Bedingung:** Der Server committet Tick N, sobald **alle verbundenen Clients** ihre
  Intents für N eingereicht haben — oder ein **Deadline-Timeout** abläuft (dann gilt der
  säumige Client für N als „keine Intents", und es gibt einen Lag-Hinweis). Leere Ticks sind
  erlaubt (die meisten Ticks haben gar keine Intents).
- **Gleichlauf:** Clients dürfen der Server-Commit-Spitze nicht vorauslaufen. Fehlt der
  committete Tick noch, **wartet** der Client (kurzer Stall) statt zu spekulieren.

## Protokoll (WebSocket, JSON im MVP; später binär)

Client→Server: `join {room, name}` · `submitIntents {tick, intents}` · `stateHash {tick, hash}`
· `ready` · `leave` · `ping`.
Server→Client: `joined {playerId, slot}` · `lobby {players[]}` · `start {seed, config, players}`
· `commit {tick, intents}` (das gebündelte Set; KI-Intents inklusive) · `desync {tick}` ·
`peerLeft {playerId}` · `pong`.

Reihenfolge-Determinismus: der Server sortiert die Intents eines Ticks **stabil nach
`playerId`** (und Einreichungsindex), bevor er sie broadcastet — alle Clients bekommen exakt
dieselbe Liste.

## Lobby / UI

Neuer Menü-Pfad neben „Match starten"/„Zuschauen": **„Mehrspieler"** → Räume erstellen/
beitreten per **Raum-Code**, Server-URL (Default: gehosteter Relay), Spielerliste mit
Ready-Status, Host wählt Karte/Seed/Gegnerzahl (wie Single-Player-Menü, aber geteilt). Start,
sobald alle „ready". Wiederverwenden: `start-menu.ts`-Bausteine, `preferences.ts` für
Server-URL/Name.

## Disconnect / Lag / Reconnect

- **Lag:** Input-Delay puffert kleine Schwankungen; bei Deadline-Überschreitung kurze
  „Warte auf Spieler X"-Anzeige (alle pausieren denselben Tick → bleibt deterministisch).
- **Reconnect/Snapshot:** Da kein State übertragen wird, braucht ein Rejoin einen **vollen
  GameState-Snapshot**. Dafür `serializeState(state)` / `deserializeState(data)` schreiben, das
  `Map`s (players, buildings, recentCaptures, alliances …) und `TypedArray`s (map.state,
  terrain, landComponents, waterComponents) korrekt rundreist. Server hält den letzten
  bekannten committeten Tick + (vom Host periodisch geschickten) Snapshot; ein neuer/
  zurückkehrender Client lädt Snapshot @ Tick K und spielt ab K weiter.
- **Verlässt ein Mensch dauerhaft:** seine Nation wird ab dann von der autoritativen KI
  übernommen (Host generiert ihre Intents) oder „eingefroren"/passiv (Design-Entscheidung).

## Anti-Cheat

Lockstep ist von Natur aus „alle sehen alles" — kein Hidden-State-Vorteil. Restrisiko:
manipulierte Intents/State. Gegenmittel: (1) Server validiert Intents grob (Spieler darf nur
Intents mit eigener `playerId` schicken); (2) **State-Hash-Checksums** decken abweichende Sim
(modifizierter Client) auf → Desync-Erkennung + Kick. Voll serverautoritativ (State-Sync) wäre
sicherer, aber teurer — bewusst nicht im ersten Wurf.

## Implementierungs-Phasen (Schritt für Schritt)

1. **Transport-Naht (lokal, kein Netz).** `IntentTransport` + `LocalTransport` einführen,
   `main.ts`-Sim-Schleife auf `submit`/`onCommitted` umstellen. Verhalten identisch zu heute.
   Tests: Single-Player läuft unverändert; ein „RecordingTransport" zeichnet Intents+Ticks auf.
2. **Determinismus-Härtung.** Audit aller `Math.sin/cos/atan2/pow/exp/log` in der Sim; Spawn-
   Trig durch deterministische Eigen-Funktion ersetzen. `hashState()` + Test: zwei `createGame`
   - identischer Intent-Stream → identischer Hash über N Ticks (gibt es als Test-Idee schon:
     „same seed and intent stream produce identical states" — auf Hash erweitern).
3. **Replay-Harness.** Intent-Aufzeichnung speichern/laden und deterministisch abspielen
   (validiert Lockstep-Tauglichkeit offline, ohne Server). Nützlich auch für Bug-Repros.
4. **Relay-Server.** Node + `ws`: Räume, Slot-Vergabe, Intent-Sammlung pro Tick, Commit-Broad-
   cast, KI-Autorität (Server oder Host führt `ai.decide` und reicht die Intents ein),
   Hash-Vergleich. Einfacher Health-Check-Endpoint.
5. **NetworkTransport + Lobby.** Client-Transport gegen den Server; Mehrspieler-Menü
   (Raum-Code, Ready, Start mit geteiltem Seed/Config). End-to-End: 2 Browser, 1 Match.
6. **Input-Delay, Lag-Handling, Reconnect-Snapshot, Checksum-Desync-UI, Politur.**
   `serializeState`/`deserializeState`, adaptiver Input-Delay, Warte-Overlay, Desync-Meldung.

## Betroffene / neue Dateien

- `src/net/transport.ts` (neu) — `IntentTransport`, `LocalTransport`, `NetworkTransport`.
- `src/net/protocol.ts` (neu) — Nachrichten-Typen (Discriminated Union wie `intent.ts`).
- `src/net/hash.ts` (neu) — `hashState`.
- `src/core/serialize.ts` (neu) — `serializeState`/`deserializeState` (Maps + TypedArrays).
- `src/main.ts` — Sim-Schleife auf Transport umstellen; KI nur im LocalTransport lokal.
- `src/core/game.ts` — Determinismus-Härtung (Spawn-Trig), evtl. `hashState`-Hilfen.
- `src/ui/start-menu.ts` / neues `src/ui/multiplayer-menu.ts` — Lobby.
- `server/` (neu, Node + `ws`) — Relay-/Tick-Server, Räume, KI-Autorität, Hash-Vergleich.
- Tests: Determinismus-Hash über N Ticks; Replay-Harness; Transport-Verträge.

## Konsequenzen

- **Pro:** Minimale Bandbreite (nur Intents), nutzt den vorhandenen Determinismus maximal,
  Single-Player bleibt über `LocalTransport` exakt gleich, gute Repro-/Replay-Tools als
  Nebenprodukt.
- **Contra/Risiko:** Determinismus ist gnadenlos — Cross-Engine-Trig ist die Hauptgefahr und
  muss vor allem anderen gehärtet werden. Lockstep koppelt das Tempo an den langsamsten Client
  (Input-Delay + Deadline mildern das). Reconnect erfordert robuste State-Serialisierung.
- **Reihenfolge wichtig:** Phasen 1–3 (Naht + Härtung + Replay) bringen schon allein Wert
  (Testbarkeit, Repros) und sind risikoarm; erst danach Server/Netz.
