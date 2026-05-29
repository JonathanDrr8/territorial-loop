/**
 * Autoritative Match-Simulation für server-autoritatives Lockstep (ADR-0009 Phase 4).
 *
 * Die „Brain" des Servers — **ohne WebSocket/I-O**, damit deterministisch unit-testbar:
 * `server.ts` liefert die Uhr (Turn-Takt) und die Netz-Anbindung, `ServerMatch` macht die
 * Simulation. Der Server fährt dieselbe deterministische Sim wie die Clients (`createGame`+
 * `tick`), **führt die KI aus** (zentral, keine KI-Desync-Quelle) und produziert je Turn ein
 * committetes Intent-Set. Genau dieses Set broadcastet der Server; Clients wenden es
 * unverändert an und landen bit-genau beim selben State (verifiziert über `hashState`).
 */

import { createAI, type AI } from '../src/ai/ai'
import { createGame, tick, type GameConfig, type GameState } from '../src/core/game'
import { hashState } from '../src/core/hash'
import type { Intent } from '../src/core/intent'
import { serializeState, type SerializedGameState } from '../src/core/serialize'
import type { Difficulty } from '../src/ai/ai'

/** Ergebnis eines committeten Turns: das gebündelte Set (für Broadcast) + Server-Hash. */
export interface CommittedTurn {
  readonly turn: number
  readonly intents: readonly Intent[]
  readonly hash: number
}

/** Wie viele Turn-Hashes der Server für Desync-Vergleiche vorhält. */
const HASH_HISTORY = 256

export class ServerMatch {
  readonly config: GameConfig
  private readonly state: GameState
  private readonly ais: AI[]
  /** Eingereichte Client-Intents je Ziel-Turn (in Ankunftsreihenfolge). */
  private readonly buffers = new Map<number, Intent[]>()
  /** Server-Hash je committetem Turn (begrenzte Historie für Desync-Checks). */
  private readonly hashes = new Map<number, number>()
  /** Nächster zu committeter Turn (State spiegelt die Turns [0, turn) wider). */
  private nextTurn = 0

  constructor(config: GameConfig, difficulty: Difficulty = 'normal') {
    this.config = config
    this.state = createGame(config)
    this.ais = []
    for (const p of this.state.players.values()) {
      if (p.isHuman) continue
      this.ais.push(createAI(p.id, this.state.seed, difficulty, p.wild))
    }
  }

  /** Nächster (noch nicht committeter) Turn. */
  currentTurn(): number {
    return this.nextTurn
  }

  /**
   * Reicht Intents eines Spielers für einen Ziel-Turn ein. Anti-Spoofing: nur Intents mit
   * passender `playerId` werden übernommen. Verspätete (Turn bereits committet) wandern in den
   * nächsten offenen Turn statt verloren zu gehen (ADR-0009: „kommen ggf. im nächsten Turn").
   */
  submitIntents(targetTurn: number, intents: readonly Intent[], fromPlayerId: number): void {
    const turn = Math.max(targetTurn, this.nextTurn)
    let buf = this.buffers.get(turn)
    if (buf === undefined) {
      buf = []
      this.buffers.set(turn, buf)
    }
    for (const i of intents) if (i.playerId === fromPlayerId) buf.push(i)
  }

  /**
   * Rückt einen Turn vor: gebündelte Client-Intents (Ankunftsreihenfolge) + KI-Intents
   * anwenden, State ticken, Commit zurückgeben. Wird von der Server-Uhr in festem Takt
   * gerufen — wartet NICHT auf säumige Clients (die resyncen per Snapshot).
   */
  advanceTurn(): CommittedTurn {
    const committed: Intent[] = []
    const buffered = this.buffers.get(this.nextTurn)
    if (buffered !== undefined) {
      for (const i of buffered) committed.push(i)
      this.buffers.delete(this.nextTurn)
    }
    // KI zuletzt — identische Reihenfolge wie LocalTransport ([Spieler…, KI…]).
    for (const ai of this.ais) for (const i of ai.decide(this.state)) committed.push(i)

    tick(this.state, committed)
    const hash = hashState(this.state)
    const turn = this.nextTurn
    this.hashes.set(turn, hash)
    if (this.hashes.size > HASH_HISTORY) {
      const oldest = turn - HASH_HISTORY
      this.hashes.delete(oldest)
    }
    this.nextTurn++
    return { turn, intents: committed, hash }
  }

  /**
   * Vergleicht einen vom Client gemeldeten Hash mit dem Server-Hash desselben Turns.
   * `true` = stimmt überein, `false` = Desync (→ Snapshot schicken), `undefined` = Turn
   * außerhalb der vorgehaltenen Historie (kein Urteil möglich).
   */
  verifyHash(turn: number, clientHash: number): boolean | undefined {
    const serverHash = this.hashes.get(turn)
    if (serverHash === undefined) return undefined
    return serverHash === clientHash
  }

  /** Voller Snapshot zum aktuellen Stand (für Resync/Reconnect). */
  snapshot(): { turn: number; state: SerializedGameState } {
    return { turn: this.nextTurn, state: serializeState(this.state) }
  }
}
