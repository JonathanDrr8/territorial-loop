/**
 * Wire-Protokoll für server-autoritatives Lockstep (ADR-0009). Geteilt zwischen Client
 * (`NetworkTransport`, Phase 5) und Server (`server/`, Phase 4).
 *
 * Discriminated Unions wie in `intent.ts` — über `kind` unterscheidbar, JSON-serialisierbar.
 * Übers Netz gehen im Normalbetrieb **nur Intents** (geringe Bandbreite); ein `snapshot` wird
 * nur bei Resync/Reconnect verschickt.
 *
 * MVP: JSON über WebSocket. Später ggf. binär — die Typen bleiben die Schnittstelle.
 */

import type { Difficulty } from '../ai/ai'
import type { GameConfig } from '../core/game'
import type { Intent } from '../core/intent'
import type { SerializedGameState } from '../core/serialize'
import type { TerrainType } from '../world/terrain'

/** Eine offene Lobby im Server-Browser (`GET /lobbies`) — für die Übersicht im Hauptmenü. */
export interface LobbyListing {
  readonly code: string
  readonly host: string
  readonly players: number
  readonly mapWidth: number
  readonly aiCount: number
  readonly wildCount: number
  readonly terrain: TerrainType
}

/** Eine Lobby-/Match-Teilnehmerzeile (für Anzeige + Slot-Zuordnung). */
export interface PeerInfo {
  readonly playerId: number
  readonly name: string
  readonly connected: boolean
}

/**
 * Vom Host konfigurierbare Match-Parameter (die Menschen kommen aus der Lobby dazu). Der Server
 * baut daraus + den verbundenen Spielern die finale `GameConfig`. Leerer `seed` ⇒ Server leitet
 * einen aus dem Raum-Code ab.
 */
export interface MatchSettings {
  readonly mapWidth: number
  readonly mapHeight: number
  readonly terrain: TerrainType
  readonly seed: string
  readonly aiCount: number
  readonly wildCount: number
  readonly victoryPct: number
  readonly difficulty: Difficulty
  /** Öffentlich = im Server-Browser (`/lobbies`) gelistet. Privat = nur per Code/Link beitretbar. */
  readonly public: boolean
}

/* ── Client → Server ──────────────────────────────────────────────────────── */

/** Raum betreten/erstellen. `room` leer ⇒ neuen Raum erstellen (Server vergibt Code). */
export interface JoinMsg {
  readonly kind: 'join'
  readonly room: string
  readonly name: string
}

/** Eigene Intents für einen Ziel-Turn einreichen (Server bündelt sie pro Turn). */
export interface SubmitIntentsMsg {
  readonly kind: 'submit-intents'
  readonly turn: number
  readonly intents: readonly Intent[]
}

/** Eigener State-Hash zu einem Turn — der Server vergleicht ihn gegen seinen (Desync-Check). */
export interface StateHashMsg {
  readonly kind: 'state-hash'
  readonly turn: number
  readonly hash: number
}

/** Bereit-Status in der Lobby (Match startet, wenn alle bereit sind). */
export interface ReadyMsg {
  readonly kind: 'ready'
  readonly ready: boolean
}

/** Vollen Snapshot anfordern (Resync nach erkanntem Desync / nach Reconnect). */
export interface ResyncRequestMsg {
  readonly kind: 'resync-request'
}

/** Host setzt die Match-Parameter (nur vom Raum-Ersteller akzeptiert). */
export interface ConfigureMsg {
  readonly kind: 'configure'
  readonly settings: MatchSettings
}

/** Latenz-Messung: `t` ist ein opaker Client-Zeitstempel, den der Server unverändert zurückwirft. */
export interface PingMsg {
  readonly kind: 'ping'
  readonly t: number
}

export type ClientMessage =
  | JoinMsg
  | SubmitIntentsMsg
  | StateHashMsg
  | ReadyMsg
  | ResyncRequestMsg
  | ConfigureMsg
  | PingMsg

/* ── Server → Client ──────────────────────────────────────────────────────── */

/** Bestätigt den Beitritt + teilt dem Client seine Spieler-ID/Slot und den Raum-Code mit. */
export interface JoinedMsg {
  readonly kind: 'joined'
  readonly room: string
  readonly playerId: number
}

/** Lobby-Zustand: Teilnehmer + Ready, aktuelle Match-Settings, wer der Host ist. */
export interface LobbyMsg {
  readonly kind: 'lobby'
  readonly peers: readonly (PeerInfo & { readonly ready: boolean })[]
  readonly settings: MatchSettings
  readonly hostId: number
}

/** Match-Start: alle Clients bauen `createGame(config)` mit demselben Seed/Config. */
export interface StartMsg {
  readonly kind: 'start'
  readonly config: GameConfig
}

/** Committeter Turn: das gebündelte Intent-Set (inkl. KI) in Anwendungsreihenfolge. */
export interface CommitMsg {
  readonly kind: 'commit'
  readonly turn: number
  readonly intents: readonly Intent[]
}

/** Voller State-Snapshot für Resync/Reconnect (kein State im Normalbetrieb). */
export interface SnapshotMsg {
  readonly kind: 'snapshot'
  readonly turn: number
  readonly state: SerializedGameState
}

/** Antwort auf {@link PingMsg} — `t` unverändert zurück, der Client berechnet daraus die RTT. */
export interface PongMsg {
  readonly kind: 'pong'
  readonly t: number
}

export type ServerMessage = JoinedMsg | LobbyMsg | StartMsg | CommitMsg | SnapshotMsg | PongMsg

/** Serialisiert eine Nachricht für den Wire (JSON). */
export function encode(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg)
}

/** Parst eine Wire-Nachricht. Wirft bei ungültigem JSON; Typprüfung beim Verbraucher. */
export function decodeClient(raw: string): ClientMessage {
  return JSON.parse(raw) as ClientMessage
}

export function decodeServer(raw: string): ServerMessage {
  return JSON.parse(raw) as ServerMessage
}
