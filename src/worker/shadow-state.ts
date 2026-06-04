/**
 * Schatten-`GameState` (ADR-0030, Sim-auf-Worker): der Hauptthread hält einen read-only Schatten des
 * autoritativen States (der im Worker tickt). Render/UI/Input lesen den Schatten wie heute `state`.
 *
 * - `createShadow`: baut den initialen Schatten aus einem Voll-Snapshot (über die getestete
 *   serialize/deserialize-Maschinerie → rekonstruiert Terrain/Komponenten/Frontier).
 * - `applyTickDelta`: wendet ein `TickDelta` IN-PLACE an (Owner-Delta + dynamische Felder), ohne die
 *   Objekt-Referenz oder die statischen/abgeleiteten Felder (Terrain, Komponenten) zu ersetzen. Das
 *   `frontier`-Set der Schatten-Spieler bleibt erhalten (wird separat gepflegt — Stufe 1b).
 * - `fullRefresh`: lädt einen kompletten Snapshot in-place (Resync/Reconnect/Overflow).
 *
 * Bit-genaue Sync der HASH-relevanten Felder (Owner-Array + je Spieler troops/gold/tilesOwned/isAlive
 * + tick) ist in `tests/tick-delta.test.ts` verifiziert: `hashState(shadow) === hashState(state)`.
 */

import { initializeAllFrontiers, updateFrontierAfterCapture, type GameState } from '../core/game'
import { deserializeState, loadSnapshotInto, serializeState } from '../core/serialize'
import type { SerializedGameState } from '../core/serialize'
import { getOwner } from '../world/map'
import type { TickDelta } from './tick-delta'

/**
 * Schiff-Liste identitäts-erhaltend übernehmen: bei GLEICHER Länge die vorhandenen Schatten-Objekte
 * in-place aktualisieren (`Object.assign`) → ihre Objekt-Identität bleibt über Ticks erhalten, sodass
 * main-seitige Identitäts-Caches (Kriegsschiff-Box-Auswahl im Renderer als `Set<Warship>`, perspektivisch
 * die Sound-Dedup) weiter greifen. Ändert sich die Länge (Schiff gespawnt/gestorben), wird die Liste neu
 * aufgebaut (Auswahl-Verlust dort akzeptiert — selten, harmlos). Die `src`-Elemente sind bereits frische
 * Deep-Copies (aus `buildTickDelta` bzw. strukturell geklont über `postMessage`), inkl. eigener `path`.
 */
function reconcileShips<T extends object>(prev: T[], src: readonly T[]): T[] {
  if (prev.length !== src.length) return src.slice()
  for (let i = 0; i < src.length; i++) {
    const dst = prev[i]
    const next = src[i]
    if (dst !== undefined && next !== undefined) Object.assign(dst, next)
  }
  return prev
}

/** Initialer Schatten aus dem aktuellen autoritativen State (über den Voll-Snapshot-Pfad). */
export function createShadow(state: GameState): GameState {
  return deserializeState(serializeState(state))
}

/** Schatten aus einem (z.B. übers Netz/Worker erhaltenen) Voll-Snapshot. */
export function createShadowFromSnapshot(snapshot: SerializedGameState): GameState {
  return deserializeState(snapshot)
}

/** Voll-Refresh in-place (Resync/Reconnect/Owner-Overflow). */
export function fullRefresh(shadow: GameState, snapshot: SerializedGameState): void {
  loadSnapshotInto(shadow, snapshot)
}

/**
 * Wendet ein `TickDelta` in-place auf den Schatten an. Gibt `true` zurück, wenn der Owner-Layer voll
 * ersetzt wurde (Overflow) → der Aufrufer sollte dann `renderer.invalidate()` rufen (Voll-Rebake).
 */
export function applyTickDelta(shadow: GameState, delta: TickDelta): boolean {
  shadow.tick = delta.tick
  shadow.phase = delta.phase
  shadow.winner = delta.winner

  // --- Owner-Layer + Frontier-Pflege ---
  const ms = shadow.map.state
  let didFull = false
  if (delta.ownerFull !== null) {
    ms.set(delta.ownerFull)
    shadow.dirtyTiles = []
    // Owner komplett ersetzt → alle Frontiers neu aufbauen. initializeAllFrontiers ADDIERT nur
    // (in deserializeState sind die Sets frisch leer), darum hier erst leeren.
    for (const p of shadow.players.values()) p.frontier.clear()
    initializeAllFrontiers(shadow)
    didFull = true
  } else {
    const tiles = delta.ownerTiles
    const vals = delta.ownerValues
    const n = tiles.length
    const dirty: number[] = new Array<number>(n)
    const oldOwners: number[] = new Array<number>(n)
    // Alte Owner VOR dem Schreiben merken (für die Frontier-Pflege).
    for (let i = 0; i < n; i++) {
      const t = tiles[i] ?? 0
      dirty[i] = t
      oldOwners[i] = getOwner(shadow.map, t)
    }
    // Neue Owner schreiben (Karte erst final machen) …
    for (let i = 0; i < n; i++) ms[dirty[i] ?? 0] = vals[i] ?? 0
    // … dann Frontiers inkrementell gegen die FINALE Karte pflegen — exakt die Sim-Logik
    // (`updateFrontierAfterCapture`), daher kein Drift. Idempotent bei doppelten Tiles.
    for (let i = 0; i < n; i++) {
      const t = dirty[i] ?? 0
      updateFrontierAfterCapture(shadow, t, oldOwners[i] ?? 0, getOwner(shadow.map, t))
    }
    shadow.dirtyTiles = dirty // damit renderer.collectDirty() die geänderten Tiles inkrementell zieht
  }

  // --- Spieler: nur die mutablen Felder ersetzen, frontier des Schattens bleibt erhalten ---
  for (const pd of delta.players) {
    const p = shadow.players.get(pd.id)
    if (p === undefined) continue
    Object.assign(p, pd) // pd = Omit<Player,'frontier'> → frontier bleibt unangetastet
  }

  // --- dynamische Listen (eigene mutable Kopien für den Schatten) ---
  shadow.buildings = new Map(delta.buildings.map(([t, b]) => [t, { ...b }]))
  // Schiffe identitäts-erhaltend (s. reconcileShips) — sonst bräche die Kriegsschiff-Box-Auswahl.
  shadow.boats = reconcileShips(shadow.boats, delta.boats)
  shadow.tradeShips = reconcileShips(shadow.tradeShips, delta.tradeShips)
  shadow.goldCarts = reconcileShips(shadow.goldCarts, delta.goldCarts)
  shadow.warships = reconcileShips(shadow.warships, delta.warships)
  shadow.bombers = reconcileShips(shadow.bombers, delta.bombers)
  shadow.events = delta.events.map((e) => ({ ...e }))
  // Render-flüchtige Listen (nicht hash-relevant) — der Renderer liest sie aus dem Schatten.
  shadow.goldPops = delta.goldPops.map((g) => ({ ...g }))
  shadow.projectiles = delta.projectiles.map((p) => ({ ...p }))
  shadow.bombImpacts = delta.bombImpacts.map((b) => ({ ...b }))
  shadow.flakShots = delta.flakShots.map((f) => ({ ...f }))

  // --- Diplomatie/Beziehungen (readonly Collections → in-place leeren + neu füllen) ---
  shadow.alliances.clear()
  for (const k of delta.alliances) shadow.alliances.add(k)
  shadow.allianceExpiry.clear()
  for (const [k, v] of delta.allianceExpiry) shadow.allianceExpiry.set(k, v)
  shadow.allianceRequests.clear()
  for (const k of delta.allianceRequests) shadow.allianceRequests.add(k)
  shadow.embargoes.clear()
  for (const k of delta.embargoes) shadow.embargoes.add(k)
  shadow.grudge.clear()
  for (const [k, v] of delta.grudge) shadow.grudge.set(k, v)
  shadow.goodwill.clear()
  for (const [k, v] of delta.goodwill) shadow.goodwill.set(k, v)
  shadow.recentCaptures.clear()
  for (const [k, v] of delta.recentCaptures) shadow.recentCaptures.set(k, v)

  return didFull
}
