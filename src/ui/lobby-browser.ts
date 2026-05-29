/**
 * Server-Browser (ADR-0009 / ADR-0014 Phase 2): listet **offene Lobbys** (`GET /lobbies`, per Klick
 * beitreten) und **laufende Spiele** (`GET /games`, per Klick zuschauen — mit grober Terrain-Vorschau
 * aus dem Seed). Pollt periodisch, fehlertolerant (Server weg → dezenter Hinweis, kein Crash).
 *
 * Reine DOM-UI, eigenständig (kein WebSocket — nur HTTP-Polling). Texte über `t()` (de/en).
 */

import { t } from '../i18n'
import type { GameListing, LobbyListing } from '../net/protocol'
import { generateTerrainDataUrl } from './menu-background'

const ACCENT = '#7cc4ff'
const POLL_MS = 3000

export interface LobbyBrowserCallbacks {
  /** Offene Lobby beitreten. */
  onJoin: (code: string) => void
  /** Laufendem Spiel als Zuschauer beitreten. */
  onSpectate: (code: string) => void
}

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
  callbacks: LobbyBrowserCallbacks,
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
    'gap: 4px',
  ].join(';')

  const sectionHead = (key: string): HTMLElement => {
    const h = document.createElement('div')
    h.textContent = t(key)
    h.style.cssText = 'font-size: 14px; font-weight: 700; margin: 6px 0 8px'
    return h
  }
  const makeList = (): HTMLElement => {
    const l = document.createElement('div')
    l.style.cssText = 'display: flex; flex-direction: column; gap: 6px; min-height: 36px'
    return l
  }

  const openHead = sectionHead('lobby.openTitle')
  const openList = makeList()
  const runningHead = sectionHead('lobby.runningTitle')
  const runningList = makeList()
  runningHead.style.marginTop = '14px'
  panel.appendChild(openHead)
  panel.appendChild(openList)
  panel.appendChild(runningHead)
  panel.appendChild(runningList)

  const refreshBtn = document.createElement('button')
  refreshBtn.textContent = t('lobby.refresh')
  refreshBtn.style.cssText = [
    'margin-top: 14px',
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

  const hint = (target: HTMLElement, text: string): void => {
    target.textContent = ''
    const h = document.createElement('div')
    h.textContent = text
    h.style.cssText = 'font-size: 12px; opacity: 0.55; padding: 6px 0'
    target.appendChild(h)
  }

  const rowBase = [
    'display: flex',
    'align-items: center',
    'gap: 10px',
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
    'width: 100%',
    'box-sizing: border-box',
  ].join(';')

  function renderOpen(lobbies: readonly LobbyListing[]): void {
    if (lobbies.length === 0) {
      hint(openList, t('lobby.emptyOpen'))
      return
    }
    openList.textContent = ''
    for (const lo of lobbies) {
      const row = document.createElement('button')
      row.style.cssText = rowBase
      const terrain = TERRAIN_LABEL[lo.terrain] ?? lo.terrain
      const text = document.createElement('div')
      text.innerHTML =
        `<span style="color:${ACCENT};font-weight:700;letter-spacing:1px">${lo.code}</span>` +
        ` <span style="opacity:0.6">· ${String(lo.players)} ${t('lobby.players')}</span><br>` +
        `<span style="opacity:0.75">${escapeHtml(lo.host)} · ${String(lo.mapWidth)}² · ` +
        `${String(lo.aiCount)} KI · ${terrain}</span>`
      row.appendChild(text)
      row.addEventListener('click', () => callbacks.onJoin(lo.code))
      openList.appendChild(row)
    }
  }

  // Terrain-Vorschau pro Seed nur einmal generieren (Polling ändert den Seed nicht).
  const thumbCache = new Map<string, string | null>()
  const thumbFor = (g: GameListing): string | null => {
    const key = `${g.seed}|${g.terrain}|${String(g.mapWidth)}x${String(g.mapHeight)}`
    let url = thumbCache.get(key)
    if (url === undefined) {
      url = generateTerrainDataUrl({
        seed: g.seed,
        terrain: g.terrain,
        width: g.mapWidth,
        height: g.mapHeight,
        maxDim: 96,
      })
      thumbCache.set(key, url)
    }
    return url
  }

  function renderRunning(games: readonly GameListing[]): void {
    if (games.length === 0) {
      hint(runningList, t('lobby.emptyRunning'))
      return
    }
    runningList.textContent = ''
    for (const g of games) {
      const row = document.createElement('button')
      row.style.cssText = rowBase
      const url = thumbFor(g)
      if (url !== null) {
        const thumb = document.createElement('img')
        thumb.src = url
        thumb.style.cssText =
          'width: 44px; height: 44px; flex: 0 0 auto; border-radius: 4px; object-fit: cover; image-rendering: auto; border: 1px solid rgba(255,255,255,0.12)'
        row.appendChild(thumb)
      }
      const terrain = TERRAIN_LABEL[g.terrain] ?? g.terrain
      const text = document.createElement('div')
      text.style.flex = '1'
      text.innerHTML =
        `<span style="color:${ACCENT};font-weight:700;letter-spacing:1px">${g.code}</span>` +
        ` <span style="opacity:0.6">· ${String(g.players)} ${t('lobby.players')} · ` +
        `${String(g.spectators)} ${t('lobby.spectators')}</span><br>` +
        `<span style="opacity:0.75">${escapeHtml(g.host)} · ${String(g.mapWidth)}² · ${terrain}</span>`
      row.appendChild(text)
      const watch = document.createElement('span')
      watch.textContent = t('lobby.spectate')
      watch.style.cssText = `flex: 0 0 auto; color: ${ACCENT}; opacity: 0.9`
      row.appendChild(watch)
      row.addEventListener('click', () => callbacks.onSpectate(g.code))
      runningList.appendChild(row)
    }
  }

  let destroyed = false
  let inFlight: AbortController | null = null

  async function poll(): Promise<void> {
    inFlight?.abort()
    const ac = new AbortController()
    inFlight = ac
    const base = toHttpUrl(serverWsUrl)
    try {
      const [lobbiesRes, gamesRes] = await Promise.all([
        fetch(`${base}/lobbies`, { signal: ac.signal }),
        fetch(`${base}/games`, { signal: ac.signal }),
      ])
      if (!lobbiesRes.ok || !gamesRes.ok) throw new Error('HTTP error')
      const lobbies = (await lobbiesRes.json()) as LobbyListing[]
      const games = (await gamesRes.json()) as GameListing[]
      if (!destroyed) {
        renderOpen(lobbies)
        renderRunning(games)
      }
    } catch {
      if (!destroyed && !ac.signal.aborted) {
        hint(openList, t('lobby.unreachable'))
        runningList.textContent = ''
      }
    }
  }

  refreshBtn.addEventListener('click', () => void poll())
  hint(openList, t('lobby.loading'))
  hint(runningList, t('lobby.loading'))
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
