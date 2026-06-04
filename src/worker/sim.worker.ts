/**
 * Sim-Worker (ADR-0030 Stufe 2): besitzt den autoritativen `GameState` und tickt ihn auf einem
 * eigenen Thread. Pro committetem Tick schickt er ein `TickDelta` an den Hauptthread, der seinen
 * read-only Schatten aktualisiert. So friert die Oberfläche nie ein, egal wie lange ein Tick rechnet.
 *
 * Bewusst browser-frei (kein DOM/`window`): nutzt `createSimHost` (mit injiziertem `self`-Timer) +
 * `createGame`/`createAI` aus den reinen Schichten. `tick()` läuft byte-identisch zum Nicht-Worker-
 * Pfad → der State-Hash bleibt bit-genau (MP-Determinismus).
 */

import { createAI, type AI } from '../ai/ai'
import { profileForElo } from '../ai/strength'
import { createGame, type GameState } from '../core/game'
import { deserializeState, serializeState } from '../core/serialize'
import { createSimHost, type SimHost } from './sim-host'
import { buildTickDelta } from './tick-delta'
import type { MainToWorker, WorkerToMain } from './sim-protocol'

/**
 * Schlankes Abbild des `DedicatedWorkerGlobalScope` — vermeidet, die `webworker`-Lib einzubinden
 * (die mit der global aktiven DOM-Lib kollidieren würde). Deckt genau ab, was der Worker nutzt.
 */
interface SimWorkerScope {
  postMessage(msg: WorkerToMain): void
  onmessage: ((ev: MessageEvent<MainToWorker>) => void) | null
  setInterval(handler: () => void, ms: number): number
  clearInterval(id: number): void
}

const ctx = self as unknown as SimWorkerScope

let sim: SimHost | null = null
let state: GameState | null = null

function post(msg: WorkerToMain): void {
  ctx.postMessage(msg)
}

/** Worker-Takt-Uhr (statt `window` im `LocalTransport`-Default). */
const workerTimer = {
  setInterval: (handler: () => void, ms: number): number => ctx.setInterval(handler, ms),
  clearInterval: (id: number): void => {
    ctx.clearInterval(id)
  },
}

ctx.onmessage = (ev: MessageEvent<MainToWorker>): void => {
  const msg = ev.data
  switch (msg.type) {
    case 'init': {
      const s = msg.snapshot !== undefined ? deserializeState(msg.snapshot) : createGame(msg.config)
      state = s
      // KI exakt wie main.ts erzeugen (gleiches profileForElo + createAI → deterministisch identisch).
      const override = msg.rankedElo !== undefined ? profileForElo(msg.rankedElo) : undefined
      const ais: AI[] = []
      for (const cfg of msg.ais) {
        ais.push(
          createAI(cfg.playerId, s.seed, msg.difficulty, cfg.wild, cfg.wild ? undefined : override),
        )
      }
      sim = createSimHost({
        state: s,
        ais,
        intervalMs: msg.intervalMs,
        timer: workerTimer,
        onAfterTick: () => post({ type: 'tick-delta', delta: buildTickDelta(s) }),
      })
      // Initialer Voll-Snapshot → der Main baut daraus seinen Schatten; dann „bereit".
      post({ type: 'snapshot-full', tick: s.tick, snapshot: serializeState(s) })
      post({ type: 'ready' })
      break
    }
    case 'submit':
      for (const intent of msg.intents) sim?.submit(intent)
      break
    case 'set-running':
      sim?.setRunning(msg.running)
      break
    case 'set-interval':
      sim?.setIntervalMs(msg.ms)
      break
    case 'request-full-refresh':
      if (state !== null)
        post({ type: 'snapshot-full', tick: state.tick, snapshot: serializeState(state) })
      break
    case 'destroy':
      sim?.destroy()
      sim = null
      state = null
      break
  }
}
