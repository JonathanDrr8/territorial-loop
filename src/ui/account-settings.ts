/**
 * Geräteübergreifender Einstellungs-Sync (ADR-0027, Phase 2-Nachtrag).
 *
 * Knüpft die geräteunabhängigen Einstellungen (HUD-Layout, Theme, Audio, Match-Vorgaben, Sprache)
 * ans Konto: beim Anmelden lädt der Client die Konto-Einstellungen aufs Gerät, und solange man
 * eingeloggt ist, wandern lokale Änderungen automatisch (entprellt) zum Server. Als Gast bleibt
 * alles rein lokal.
 *
 * Bewusst „tief": liest den Login-Status direkt aus localStorage (kein Import von `account.ts`),
 * damit `account.ts` hier hereinziehen kann, ohne Zyklus. Reine UI-/Netz-Schicht.
 */

import { guestToken } from './rank-online'

/** Die localStorage-Keys, die ans Konto gebunden werden. */
const SYNCED_KEYS: readonly string[] = [
  'territorial-loop:hud-layout:v1',
  'territorial-loop:theme:v1',
  'territorial-loop:locale:v1',
  'territorial-loop:audio:v1',
  'territorial-loop:menu-prefs:v1',
  'territorial-loop:ui-opacity:v1',
]

const USERNAME_KEY = 'territorial-loop:account-username:v1'
const PUSH_DEBOUNCE_MS = 1500

let serverUrlRef = ''
let pushTimer: ReturnType<typeof setTimeout> | null = null

function toHttp(wsUrl: string): string {
  return wsUrl.replace(/^ws(s?):\/\//i, 'http$1://')
}

function isLoggedIn(): boolean {
  try {
    const v = window.localStorage.getItem(USERNAME_KEY)
    return v !== null && v.length > 0
  } catch {
    return false
  }
}

/** Setzt die Server-URL für den Hintergrund-Push (beim Boot aufgerufen). */
export function initAccountSync(serverWsUrl: string): void {
  serverUrlRef = serverWsUrl
}

/** Sammelt die zu synchronisierenden localStorage-Werte. */
export function collectSettings(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (const key of SYNCED_KEYS) {
      const v = window.localStorage.getItem(key)
      if (v !== null) out[key] = v
    }
  } catch {
    // localStorage gesperrt
  }
  return out
}

/** Schreibt einen Einstellungs-Blob in den localStorage. Gibt true, wenn etwas angewendet wurde. */
export function applySettings(blob: Record<string, unknown>): boolean {
  let applied = false
  try {
    for (const key of SYNCED_KEYS) {
      const v = blob[key]
      if (typeof v === 'string') {
        window.localStorage.setItem(key, v)
        applied = true
      }
    }
  } catch {
    // localStorage gesperrt
  }
  return applied
}

/** Lädt die Konto-Einstellungen vom Server und wendet sie lokal an. Gibt true, wenn welche da waren. */
export async function pullSettings(serverWsUrl: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${toHttp(serverWsUrl)}/account/settings?token=${encodeURIComponent(guestToken())}`,
    )
    if (!res.ok) return false
    const json = (await res.json()) as { settings?: unknown }
    if (json.settings !== null && typeof json.settings === 'object') {
      return applySettings(json.settings as Record<string, unknown>)
    }
    return false
  } catch {
    return false
  }
}

/** Schiebt die aktuellen lokalen Einstellungen zum Server (fehlertolerant). */
export async function pushSettings(serverWsUrl: string): Promise<void> {
  try {
    await fetch(`${toHttp(serverWsUrl)}/account/settings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: guestToken(), settings: collectSettings() }),
    })
  } catch {
    // offline → Einstellungen bleiben lokal, nächster Push holt es nach
  }
}

/**
 * Meldet eine Einstellungs-Änderung: wenn man eingeloggt ist, wird der Stand entprellt zum Server
 * geschoben. Wird von den Speicher-Funktionen (Prefs/Theme/Audio/HUD/Sprache) aufgerufen.
 */
export function notifySettingsChanged(): void {
  if (serverUrlRef === '' || !isLoggedIn()) return
  if (pushTimer !== null) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void pushSettings(serverUrlRef)
  }, PUSH_DEBOUNCE_MS)
}
