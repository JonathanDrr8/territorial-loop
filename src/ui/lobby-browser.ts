/**
 * Server-Browser (ADR-0009): listet offene Lobbys (`GET <server>/lobbies`) und lässt per Klick
 * beitreten — ohne Raum-Code tippen. Wird als linke Spalte im Hauptmenü gezeigt. Pollt periodisch
 * und ist fehlertolerant (Server nicht erreichbar → dezenter Hinweis, kein Crash).
 *
 * Reine DOM-UI, eigenständig (kein WebSocket — nur HTTP-Polling). Klick auf eine Lobby ruft
 * `onJoin(code)`; das Wiring (main.ts) öffnet damit die Mehrspieler-Lobby und tritt direkt bei.
 */

import type { LobbyListing } from '../net/protocol'

const ACCENT = '#7cc4ff'
const POLL_MS = 3000

export interface LobbyBrowserApi {
  readonly element: HTMLElement
  destroy(): void
}

const TERRAIN_LABEL: Record<string, string> = {
  flat: 'Offen',
  continents: 'Kontinente',
  islands: 'Inseln',
}

/** ws://host:port → http://host:port (bzw. wss → https) für den HTTP-Endpoint. */
function toHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws(s?):\/\//i, 'http$1://')
}

export function createLobbyBrowser(
  serverWsUrl: string,
  onJoin: (code: string) => void,
): LobbyBrowserApi {
  const panel = document.createElement('div')
  panel.style.cssText = [
    'background: #14141c',
    'color: white',
    'border: 1px solid rgba(255,255,255,0.12)',
    'border-radius: 12px',
    'padding: 18px 18px',
    'width: 230px',
    'max-width: 92vw',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'display: flex',
    'flex-direction: column',
  ].join(';')

  const head = document.createElement('div')
  head.textContent = 'Offene Lobbys'
  head.style.cssText = 'font-size: 14px; font-weight: 700; margin-bottom: 12px'
  panel.appendChild(head)

  const list = document.createElement('div')
  list.style.cssText = 'flex: 1; min-height: 80px; display: flex; flex-direction: column; gap: 6px'
  panel.appendChild(list)

  const refreshBtn = document.createElement('button')
  refreshBtn.textContent = '↻ Aktualisieren'
  refreshBtn.style.cssText = [
    'margin-top: 12px',
    'padding: 7px',
    'background: transparent',
    'color: white',
    'border: 1px solid rgba(255,255,255,0.25)',
    'border-radius: 8px',
    'font-size: 12px',
    'font-family: inherit',
    'cursor: pointer',
  ].join(';')
  panel.appendChild(refreshBtn)

  const hint = (text: string): void => {
    list.textContent = ''
    const h = document.createElement('div')
    h.textContent = text
    h.style.cssText = 'font-size: 12px; opacity: 0.55; padding: 6px 0'
    list.appendChild(h)
  }

  function renderRows(lobbies: readonly LobbyListing[]): void {
    if (lobbies.length === 0) {
      hint('Keine offenen Lobbys. Starte selbst eine über „Mehrspieler".')
      return
    }
    list.textContent = ''
    for (const lo of lobbies) {
      const row = document.createElement('button')
      row.style.cssText = [
        'text-align: left',
        'background: #0c0c12',
        'color: white',
        'border: 1px solid rgba(255,255,255,0.15)',
        'border-radius: 8px',
        'padding: 8px 10px',
        'font-family: inherit',
        'font-size: 12px',
        'cursor: pointer',
        'line-height: 1.45',
      ].join(';')
      const terrain = TERRAIN_LABEL[lo.terrain] ?? lo.terrain
      row.innerHTML =
        `<span style="color:${ACCENT};font-weight:700;letter-spacing:1px">${lo.code}</span>` +
        ` <span style="opacity:0.6">· ${String(lo.players)} 👤</span><br>` +
        `<span style="opacity:0.75">${escapeHtml(lo.host)} · ${String(lo.mapWidth)}² · ` +
        `${String(lo.aiCount)} KI · ${terrain}</span>`
      row.addEventListener('click', () => onJoin(lo.code))
      list.appendChild(row)
    }
  }

  let destroyed = false
  let inFlight: AbortController | null = null

  async function poll(): Promise<void> {
    inFlight?.abort()
    const ac = new AbortController()
    inFlight = ac
    try {
      const res = await fetch(`${toHttpUrl(serverWsUrl)}/lobbies`, { signal: ac.signal })
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`)
      const data = (await res.json()) as LobbyListing[]
      if (!destroyed) renderRows(data)
    } catch {
      if (!destroyed && !ac.signal.aborted) hint('Server nicht erreichbar.')
    }
  }

  refreshBtn.addEventListener('click', () => void poll())
  hint('Lade …')
  void poll()
  const timer = setInterval(() => void poll(), POLL_MS)

  return {
    element: panel,
    destroy(): void {
      destroyed = true
      clearInterval(timer)
      inFlight?.abort()
      panel.remove()
    },
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
