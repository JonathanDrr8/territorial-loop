/**
 * Deterministischer Zustands-Hash (FNV-1a, 32-bit) über die spielentscheidenden Felder des
 * `GameState`: Tick, das Owner-/Terrain-Array und je Spieler (id-sortiert) Truppen, Gold,
 * Tiles, Lebt-Flag und Einfrier-Status (Disconnect, ADR-0009).
 *
 * Zweck: Determinismus absichern. Zwei Clients (oder zwei Läufe mit gleichem Seed +
 * identischem Intent-Strom) müssen denselben Hash je Tick liefern — Abweichung = Desync.
 * Grundlage für Lockstep-Multiplayer (ADR-0009) und für Replay-/Bug-Repro-Werkzeuge.
 *
 * Bewusst NICHT gehasht: rein darstellende/abgeleitete Felder (Frontier-Sets, Schiffe,
 * recentCaptures, Groll, peak-Stats), da sie aus den Kernfeldern folgen bzw. nicht
 * desync-relevant sind. Owner-Array + Truppen/Gold/Tiles je Spieler deckt die Sim-Wahrheit.
 */

import type { GameState } from './game'

const FNV_OFFSET = 2166136261
const FNV_PRIME = 16777619

/** Mischt einen 32-bit-Wert byteweise in den laufenden FNV-1a-Hash. */
function mix(h: number, value: number): number {
  let x = h
  for (let shift = 0; shift < 32; shift += 8) {
    x ^= (value >>> shift) & 0xff
    x = Math.imul(x, FNV_PRIME)
  }
  return x
}

export function hashState(state: GameState): number {
  let h = FNV_OFFSET
  h = mix(h, state.tick)

  // Owner-/Terrain-Array — deckt alle Gebiets- und Eroberungs-Änderungen ab.
  const s = state.map.state
  for (let i = 0; i < s.length; i++) h = mix(h, s[i] ?? 0)

  // Spieler in fester (id-sortierter) Reihenfolge → reihenfolge-unabhängig deterministisch.
  const ids = [...state.players.keys()].sort((a, b) => a - b)
  for (const id of ids) {
    const p = state.players.get(id)
    if (p === undefined) continue
    h = mix(h, p.id)
    h = mix(h, p.troops)
    h = mix(h, p.gold)
    h = mix(h, p.tilesOwned)
    h = mix(h, p.isAlive ? 1 : 0)
    h = mix(h, p.frozen ? 1 : 0)
  }
  return h >>> 0
}
