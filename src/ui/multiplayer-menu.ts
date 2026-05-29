/**
 * Mehrspieler-Lobby (ADR-0009 Phase 5). Verbindet per {@link NetworkTransport} gegen den
 * Lockstep-Server: Raum erstellen/beitreten (Raum-Code), Teilnehmerliste + Bereit-Status, und
 * — als Host — die Match-Settings (Karte/Gegner/Seed/…). Bei Match-Start gibt die Lobby den
 * verbundenen Transport + die vom Server vergebene Spieler-ID nach außen (siehe `onMatchStart`)
 * und der Aufrufer startet damit die eigentliche Match-Session.
 *
 * Reine DOM-UI (kein Framework), passend zum Start-Menü-Stil. Der Aufrufer ruft `destroy()`.
 */

import type { GameConfig } from '../core/game'
import { NetworkTransport } from '../net/transport'
import type { MatchSettings, PeerInfo } from '../net/protocol'

const ACCENT = '#7cc4ff'
type LobbyPeer = PeerInfo & { ready: boolean }

export interface MultiplayerMenuOptions {
  defaultServerUrl: string
  defaultName: string
  defaultSettings: MatchSettings
  /** Match startet (Server `start`): der Transport + eigene Spieler-ID werden übergeben. */
  onMatchStart: (config: GameConfig, transport: NetworkTransport, humanId: number) => void
  /** Zurück zum Start-Menü (Lobby verlassen). */
  onBack: () => void
  /** Persistiert die zuletzt genutzte Server-URL. */
  saveServerUrl?: (url: string) => void
}

export interface MultiplayerMenuApi {
  destroy(): void
}

const PANEL_STYLE = [
  'background: #14141c',
  'color: white',
  'border: 1px solid rgba(255,255,255,0.12)',
  'border-radius: 12px',
  'padding: 22px 24px',
  'width: 360px',
  'max-width: 92vw',
  'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
  'box-shadow: 0 12px 40px rgba(0,0,0,0.5)',
].join(';')

const INPUT_STYLE = [
  'flex: 1',
  'background: #0c0c12',
  'color: white',
  'border: 1px solid rgba(255,255,255,0.18)',
  'border-radius: 6px',
  'padding: 7px 9px',
  'font-family: inherit',
  'font-size: 13px',
  'min-width: 0',
].join(';')

const ROW_STYLE = 'display:flex;align-items:center;gap:10px;margin-bottom:10px'
const LABEL_STYLE = 'width:84px;font-size:12px;opacity:0.75;flex:none'

function button(label: string, primary: boolean): HTMLButtonElement {
  const b = document.createElement('button')
  b.textContent = label
  b.style.cssText = [
    'width: 100%',
    'padding: 10px',
    'margin-top: 8px',
    primary ? `background: ${ACCENT}` : 'background: transparent',
    primary ? 'color: #06121f' : 'color: white',
    primary ? 'border: none' : 'border: 1px solid rgba(255,255,255,0.25)',
    'border-radius: 8px',
    'font-size: 13px',
    'font-weight: ' + (primary ? '700' : '400'),
    'font-family: inherit',
    'cursor: pointer',
  ].join(';')
  return b
}

export function createMultiplayerMenu(
  container: HTMLElement,
  opts: MultiplayerMenuOptions,
): MultiplayerMenuApi {
  const overlay = document.createElement('div')
  overlay.style.cssText = [
    'position: absolute',
    'inset: 0',
    'background: rgba(0,0,0,0.78)',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'overflow-y: auto',
    'padding: 24px 0',
    'box-sizing: border-box',
    'z-index: 55',
    'backdrop-filter: blur(4px)',
  ].join(';')

  const panel = document.createElement('div')
  panel.style.cssText = PANEL_STYLE
  overlay.appendChild(panel)
  container.appendChild(overlay)

  let transport: NetworkTransport | null = null
  let myId = 0
  let hostId = 0
  let started = false // ab Match-Start NICHT den Transport schließen (läuft weiter)
  let settings: MatchSettings = opts.defaultSettings

  const title = (text: string): HTMLElement => {
    const h = document.createElement('div')
    h.textContent = text
    h.style.cssText = 'font-size:18px;font-weight:700;margin-bottom:14px'
    h.innerHTML = text.replace('loop', `<span style="color:${ACCENT}">loop</span>`)
    return h
  }

  const labeledInput = (label: string, value: string, placeholder = ''): HTMLInputElement => {
    const row = document.createElement('div')
    row.style.cssText = ROW_STYLE
    const l = document.createElement('label')
    l.textContent = label
    l.style.cssText = LABEL_STYLE
    const input = document.createElement('input')
    input.type = 'text'
    input.value = value
    input.placeholder = placeholder
    input.style.cssText = INPUT_STYLE
    row.appendChild(l)
    row.appendChild(input)
    panel.appendChild(row)
    return input
  }

  /* ── Formular-Ansicht ───────────────────────────────────────────────────── */
  function showForm(error?: string): void {
    panel.textContent = ''
    panel.appendChild(title('Mehrspieler — territorial-loop'))

    const urlInput = labeledInput('Server', opts.defaultServerUrl, 'ws://host:8787')
    const nameInput = labeledInput('Name', opts.defaultName, 'Du')
    const roomInput = labeledInput('Raum', '', 'leer = neuen Raum')

    if (error !== undefined) {
      const e = document.createElement('div')
      e.textContent = error
      e.style.cssText = 'color:#ff8080;font-size:12px;margin:4px 0 6px'
      panel.appendChild(e)
    }

    const connectBtn = button('Verbinden', true)
    connectBtn.addEventListener('click', () => {
      const url = urlInput.value.trim()
      const name = nameInput.value.trim() || 'Du'
      if (url.length === 0) {
        showForm('Bitte eine Server-URL angeben.')
        return
      }
      opts.saveServerUrl?.(url)
      connect(url, roomInput.value.trim().toUpperCase(), name)
    })
    panel.appendChild(connectBtn)

    const backBtn = button('Zurück', false)
    backBtn.addEventListener('click', () => opts.onBack())
    panel.appendChild(backBtn)
  }

  function showConnecting(url: string): void {
    panel.textContent = ''
    panel.appendChild(title('Verbinde …'))
    const info = document.createElement('div')
    info.textContent = url
    info.style.cssText = 'font-size:12px;opacity:0.7;margin-bottom:8px;word-break:break-all'
    panel.appendChild(info)
  }

  /* ── Verbindung ─────────────────────────────────────────────────────────── */
  function connect(url: string, room: string, name: string): void {
    showConnecting(url)
    let joined = false
    transport = new NetworkTransport({
      url,
      room,
      name,
      onJoined: (playerId, roomCode) => {
        joined = true
        myId = playerId
        renderLobby(roomCode, [], settings)
      },
      onLobby: (peers, srvSettings, srvHostId) => {
        hostId = srvHostId
        settings = srvSettings
        renderLobby(currentRoom, peers, srvSettings)
      },
      onStart: (config) => {
        started = true
        const t = transport
        if (t !== null) opts.onMatchStart(config, t, myId)
      },
    })
    // Verbindungsfehler/Abbruch vor dem Join → zurück zum Formular (Timeout-basiert, da der
    // Transport keine onerror/onclose-Hooks nach außen gibt).
    window.setTimeout(() => {
      if (!joined && !started) {
        teardownTransport()
        showForm(
          'Keine Verbindung (Timeout). Läuft der Dev-Server (npm run dev) bzw. npm run server?',
        )
      }
    }, 6000)
  }

  let currentRoom = ''

  /* ── Lobby-Ansicht ──────────────────────────────────────────────────────── */
  function renderLobby(room: string, peers: readonly LobbyPeer[], s: MatchSettings): void {
    currentRoom = room
    panel.textContent = ''
    panel.appendChild(title('Lobby'))

    const code = document.createElement('div')
    code.innerHTML = `Raum-Code: <b style="color:${ACCENT};letter-spacing:2px">${room}</b>`
    code.style.cssText = 'font-size:14px;margin-bottom:12px'
    panel.appendChild(code)

    // Teilnehmerliste
    const list = document.createElement('div')
    list.style.cssText = 'margin-bottom:12px'
    for (const p of peers) {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;justify-content:space-between;font-size:13px;padding:3px 0'
      const left = document.createElement('span')
      const you = p.playerId === myId ? ' (du)' : ''
      const host = p.playerId === hostId ? ' ★' : ''
      left.textContent = `• ${p.name}${you}${host}`
      const right = document.createElement('span')
      right.textContent = p.connected ? (p.ready ? 'bereit ✓' : 'wartet …') : 'getrennt'
      right.style.cssText = `opacity:0.8;color:${p.ready ? '#7cffa0' : 'white'}`
      row.appendChild(left)
      row.appendChild(right)
      list.appendChild(row)
    }
    if (peers.length === 0) {
      const hint = document.createElement('div')
      hint.textContent = 'Warte auf Teilnehmer …'
      hint.style.cssText = 'font-size:12px;opacity:0.6'
      list.appendChild(hint)
    }
    panel.appendChild(list)

    // Match-Settings (Host editierbar, sonst nur Anzeige)
    panel.appendChild(renderSettings(s, myId === hostId && peers.length > 0))

    const readyBtn = button('Bereit ✓', true)
    readyBtn.addEventListener('click', () => transport?.setReady(true))
    panel.appendChild(readyBtn)

    const leaveBtn = button('Verlassen', false)
    leaveBtn.addEventListener('click', () => {
      teardownTransport()
      opts.onBack()
    })
    panel.appendChild(leaveBtn)
  }

  /** Settings-Block; bei `editable` ändern Eingaben die Settings und senden `configure`. */
  function renderSettings(s: MatchSettings, editable: boolean): HTMLElement {
    const box = document.createElement('div')
    box.style.cssText =
      'border-top:1px solid rgba(255,255,255,0.1);padding-top:10px;margin-bottom:6px'
    const head = document.createElement('div')
    head.textContent = editable ? 'Match (du bist Host)' : 'Match (vom Host gesetzt)'
    head.style.cssText = 'font-size:12px;opacity:0.6;margin-bottom:8px'
    box.appendChild(head)

    const push = (next: MatchSettings): void => {
      settings = next
      transport?.configure(next)
    }

    const numRow = (label: string, value: number, apply: (v: number) => MatchSettings): void => {
      const row = document.createElement('div')
      row.style.cssText = ROW_STYLE
      const l = document.createElement('label')
      l.textContent = label
      l.style.cssText = LABEL_STYLE
      const input = document.createElement('input')
      input.type = 'number'
      input.value = String(value)
      input.disabled = !editable
      input.style.cssText = INPUT_STYLE
      input.addEventListener('change', () => push(apply(Number(input.value))))
      row.appendChild(l)
      row.appendChild(input)
      box.appendChild(row)
    }

    const selectRow = (
      label: string,
      value: string,
      options: ReadonlyArray<readonly [string, string]>,
      apply: (v: string) => MatchSettings,
    ): void => {
      const row = document.createElement('div')
      row.style.cssText = ROW_STYLE
      const l = document.createElement('label')
      l.textContent = label
      l.style.cssText = LABEL_STYLE
      const sel = document.createElement('select')
      sel.disabled = !editable
      sel.style.cssText = INPUT_STYLE
      for (const [val, text] of options) {
        const o = document.createElement('option')
        o.value = val
        o.textContent = text
        if (val === value) o.selected = true
        sel.appendChild(o)
      }
      sel.addEventListener('change', () => push(apply(sel.value)))
      row.appendChild(l)
      row.appendChild(sel)
      box.appendChild(row)
    }

    selectRow(
      'Karte',
      String(s.mapWidth),
      [
        ['128', '128²'],
        ['256', '256²'],
        ['512', '512²'],
        ['768', '768²'],
        ['1024', '1024²'],
      ],
      (v) => ({ ...settings, mapWidth: Number(v), mapHeight: Number(v) }),
    )
    selectRow(
      'Terrain',
      s.terrain,
      [
        ['flat', 'Offen'],
        ['continents', 'Kontinente'],
        ['islands', 'Inseln'],
      ],
      (v) => ({ ...settings, terrain: v as MatchSettings['terrain'] }),
    )
    numRow('KI', s.aiCount, (v) => ({ ...settings, aiCount: v }))
    numRow('Wilde', s.wildCount, (v) => ({ ...settings, wildCount: v }))
    numRow('Sieg %', s.victoryPct, (v) => ({ ...settings, victoryPct: v }))
    selectRow(
      'KI-Stärke',
      s.difficulty,
      [
        ['easy', 'Einfach'],
        ['normal', 'Normal'],
        ['hard', 'Schwer'],
      ],
      (v) => ({ ...settings, difficulty: v as MatchSettings['difficulty'] }),
    )

    return box
  }

  function teardownTransport(): void {
    if (transport !== null && !started) transport.destroy()
    transport = null
  }

  showForm()

  return {
    destroy(): void {
      teardownTransport()
      overlay.remove()
    },
  }
}
