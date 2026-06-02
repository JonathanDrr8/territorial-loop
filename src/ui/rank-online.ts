/**
 * Online-Rangliste-Client (ADR-0027, Phase 1).
 *
 * Bindet das lokale Solo-ELO (`ranked.ts`) an ein anonymes **Gast-Token** (localStorage) und
 * spricht die Server-Endpoints `/rank/submit` + `/leaderboard` an. Alles fehlertolerant: ist der
 * Server offline, läuft das Spiel ungestört weiter (die Rangliste ist Beiwerk, keine Pflicht).
 *
 * Kein Sim-State, kein Determinismus-Bezug — reine UI-/Netz-Schicht (darf daher fetch/localStorage/
 * crypto nutzen). Das Token ist kryptografisch zufällig (kein `Math.random`).
 */

import type { RankedState } from './ranked'

const TOKEN_KEY = 'territorial-loop:guest-token:v1'
const HIDDEN_KEY = 'territorial-loop:rank-hidden:v1'

/** ws://host → http://host (bzw. wss→https) für die HTTP-Endpoints. */
function toHttp(wsUrl: string): string {
  return wsUrl.replace(/^ws(s?):\/\//i, 'http$1://')
}

/** Erzeugt ein neues anonymes Gast-Token (`guest-` + 32 Hex). Passt zum Server-Regex `[A-Za-z0-9_-]{8,64}`. */
function newToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return `guest-${hex}`
}

/** Liefert das (persistente) Gast-Token, erzeugt es beim ersten Aufruf. */
export function guestToken(): string {
  try {
    const existing = window.localStorage.getItem(TOKEN_KEY)
    if (existing !== null && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing
    const fresh = newToken()
    window.localStorage.setItem(TOKEN_KEY, fresh)
    return fresh
  } catch {
    // localStorage gesperrt (Privacy-Modus): flüchtiges Token, Rangliste dann nur für diese Sitzung.
    return newToken()
  }
}

/**
 * Übernimmt ein vom Server geliefertes Gast-Token (nach Login/Recovery): ab jetzt gehören alle
 * ELO-Meldungen dieses Geräts zum angemeldeten Account (Cross-Device, ADR-0027 Phase 2).
 */
export function setGuestToken(token: string): void {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) return
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // localStorage gesperrt — Token bleibt flüchtig für diese Sitzung.
  }
}

/** Verwirft das aktuelle Gast-Token und erzeugt ein frisches (Logout → wieder anonymer Gast). */
export function resetGuestToken(): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, newToken())
  } catch {
    // silent ignore
  }
}

/** Hat der Spieler sich aus der öffentlichen Rangliste ausgeblendet? (lokale Präferenz) */
export function isRankHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

/** Setzt die lokale „mich ausblenden"-Präferenz. */
export function setRankHiddenLocal(hidden: boolean): void {
  try {
    window.localStorage.setItem(HIDDEN_KEY, hidden ? '1' : '0')
  } catch {
    // silent ignore
  }
}

/** Ein Ranglisten-Eintrag, wie ihn der Server liefert. */
export interface OnlineRankEntry {
  readonly rank: number
  readonly displayName: string
  readonly elo: number
  readonly wins: number
  readonly losses: number
}

/** Holt die öffentliche Bestenliste (Top-N nach ELO). Bei Fehler/Offline: leere Liste. */
/**
 * Lädt die Online-Rangliste. Rückgabe: Array (ggf. leer = erreichbar, aber keine Einträge) ODER
 * `null` = Server nicht erreichbar / Fehler → der Aufrufer zeigt dann „offline" statt „leer".
 */
export async function fetchLeaderboard(
  serverWsUrl: string,
  limit = 100,
): Promise<OnlineRankEntry[] | null> {
  try {
    const res = await fetch(`${toHttp(serverWsUrl)}/leaderboard?limit=${String(limit)}`)
    if (!res.ok) return null
    const json = (await res.json()) as { entries?: unknown }
    if (!Array.isArray(json.entries)) return null
    return json.entries as OnlineRankEntry[]
  } catch {
    return null
  }
}

/**
 * Reicht den aktuellen Ranglisten-Stand beim Server ein (an das Gast-Token gebunden). Fehlertolerant.
 * `hidden` steuert die Sichtbarkeit in der öffentlichen Liste mit (wird bei jedem Submit mitgesendet,
 * damit ein Umschalten des Toggles ohne Match wirkt).
 */
export async function submitRank(
  serverWsUrl: string,
  name: string,
  state: RankedState,
  hidden: boolean,
): Promise<void> {
  try {
    await fetch(`${toHttp(serverWsUrl)}/rank/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: guestToken(),
        name,
        elo: state.elo,
        wins: state.wins,
        losses: state.losses,
        peak: state.peak,
        hidden,
      }),
    })
  } catch {
    // Server offline / kein Netz → Rangliste ist Beiwerk, Spiel läuft normal weiter.
  }
}
