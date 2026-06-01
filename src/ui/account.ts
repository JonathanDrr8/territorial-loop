/**
 * Account-Client (ADR-0027, Phase 2): Registrieren / Anmelden / Passwort-Reset gegen die
 * `/account/*`-Endpoints. Hält den „eingeloggt"-Status (Username) lokal und synchronisiert beim
 * Anmelden das Gast-Token + den Ranglisten-Stand des Accounts aufs Gerät (Cross-Device).
 *
 * Login ist optional — alles hier ist Beiwerk zum anonymen Gast-Spiel. Fehlertolerant.
 */

import { guestToken, setGuestToken, resetGuestToken } from './rank-online'
import { overwriteRanked, resetRanked } from './ranked'

const USERNAME_KEY = 'territorial-loop:account-username:v1'

function toHttp(wsUrl: string): string {
  return wsUrl.replace(/^ws(s?):\/\//i, 'http$1://')
}

/** Der angemeldete Benutzername (oder null = anonymer Gast). */
export function currentUsername(): string | null {
  try {
    const v = window.localStorage.getItem(USERNAME_KEY)
    return v !== null && v.length > 0 ? v : null
  } catch {
    return null
  }
}

function setUsernameLocal(name: string | null): void {
  try {
    if (name === null) window.localStorage.removeItem(USERNAME_KEY)
    else window.localStorage.setItem(USERNAME_KEY, name)
  } catch {
    // silent ignore
  }
}

/** Ergebnis einer Account-Aktion: Erfolg (ggf. mit Recovery-Code) oder Fehlercode für die UI. */
export type AccountResult =
  | { readonly ok: true; readonly recoveryCode?: string; readonly username?: string }
  | { readonly ok: false; readonly error: string }

interface MeResponse {
  username?: unknown
  displayName?: unknown
  elo?: unknown
  wins?: unknown
  losses?: unknown
  peak?: unknown
}

/** Holt den Account-Stand zum aktuellen Token und spiegelt ihn lokal (Username + Ranglisten-Stand). */
async function syncFromServer(serverWsUrl: string): Promise<void> {
  try {
    const res = await fetch(
      `${toHttp(serverWsUrl)}/account/me?token=${encodeURIComponent(guestToken())}`,
    )
    if (!res.ok) return
    const me = (await res.json()) as MeResponse
    if (typeof me.username === 'string') setUsernameLocal(me.username)
    if (
      typeof me.elo === 'number' &&
      typeof me.wins === 'number' &&
      typeof me.losses === 'number' &&
      typeof me.peak === 'number'
    ) {
      overwriteRanked({ elo: me.elo, wins: me.wins, losses: me.losses, peak: me.peak })
    }
  } catch {
    // offline → lokaler Stand bleibt
  }
}

async function postJson(
  serverWsUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${toHttp(serverWsUrl)}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  let json: Record<string, unknown> = {}
  try {
    json = (await res.json()) as Record<string, unknown>
  } catch {
    /* leerer/ungültiger Body */
  }
  return { status: res.status, json }
}

/** Wertet den aktuellen Gast zu einem Account auf. Bei Erfolg kommt der einmalige Recovery-Code zurück. */
export async function registerAccount(
  serverWsUrl: string,
  username: string,
  password: string,
  email: string,
): Promise<AccountResult> {
  try {
    const { status, json } = await postJson(serverWsUrl, '/account/register', {
      token: guestToken(),
      username,
      password,
      email,
    })
    if (status === 200 && json.ok === true) {
      setUsernameLocal(username)
      return {
        ok: true,
        recoveryCode: typeof json.recoveryCode === 'string' ? json.recoveryCode : '',
      }
    }
    return { ok: false, error: typeof json.error === 'string' ? json.error : 'server' }
  } catch {
    return { ok: false, error: 'offline' }
  }
}

/** Meldet an: übernimmt bei Erfolg Token + Ranglisten-Stand des Accounts aufs Gerät. */
export async function loginAccount(
  serverWsUrl: string,
  username: string,
  password: string,
): Promise<AccountResult> {
  try {
    const { status, json } = await postJson(serverWsUrl, '/account/login', { username, password })
    if (status === 200 && json.ok === true && typeof json.token === 'string') {
      setGuestToken(json.token)
      await syncFromServer(serverWsUrl)
      return { ok: true, username: typeof json.username === 'string' ? json.username : username }
    }
    return { ok: false, error: typeof json.error === 'string' ? json.error : 'invalid' }
  } catch {
    return { ok: false, error: 'offline' }
  }
}

/** Setzt das Passwort per Recovery-Code zurück und meldet damit an. */
export async function recoverAccount(
  serverWsUrl: string,
  username: string,
  recoveryCode: string,
  newPassword: string,
): Promise<AccountResult> {
  try {
    const { status, json } = await postJson(serverWsUrl, '/account/recover', {
      username,
      recoveryCode,
      newPassword,
    })
    if (status === 200 && json.ok === true && typeof json.token === 'string') {
      setGuestToken(json.token)
      await syncFromServer(serverWsUrl)
      return { ok: true, username }
    }
    return { ok: false, error: typeof json.error === 'string' ? json.error : 'invalid' }
  } catch {
    return { ok: false, error: 'offline' }
  }
}

/** Meldet ab: zurück zum anonymen Gast (frisches Token, lokaler Ranglisten-Stand zurückgesetzt). */
export function logout(): void {
  setUsernameLocal(null)
  resetGuestToken()
  resetRanked()
}
