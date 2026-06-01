/**
 * Mehrspieler-Lobby (ADR-0009 Phase 5). Verbindet per {@link NetworkTransport} gegen den
 * Lockstep-Server: Raum erstellen/beitreten (Raum-Code), Teilnehmerliste + Bereit-Status, und
 * — als Host — die Match-Settings (Karte/Gegner/Seed/…). Bei Match-Start gibt die Lobby den
 * verbundenen Transport + die vom Server vergebene Spieler-ID nach außen (siehe `onMatchStart`)
 * und der Aufrufer startet damit die eigentliche Match-Session.
 *
 * Reine DOM-UI (kein Framework), passend zum Start-Menü-Stil. Der Aufrufer ruft `destroy()`.
 */

import { PRESET_ELO } from '../ai/strength'
import type { BuildingType } from '../core/buildings'
import type { GameConfig } from '../core/game'
import { NetworkTransport } from '../net/transport'
import type { MatchSettings, PeerInfo } from '../net/protocol'
import { t } from '../i18n'
import { icon } from './icons'

const ACCENT = 'var(--tl-accent)'
type LobbyPeer = PeerInfo & { ready: boolean }

export interface MultiplayerMenuOptions {
  defaultServerUrl: string
  defaultName: string
  defaultSettings: MatchSettings
  /** Match startet (Server `start`): Transport, eigene Spieler-ID und ob man Host ist. */
  onMatchStart: (
    config: GameConfig,
    transport: NetworkTransport,
    humanId: number,
    isHost: boolean,
  ) => void
  /** Zurück zum Start-Menü (Lobby verlassen). */
  onBack: () => void
  /** Persistiert die zuletzt genutzte Server-URL. */
  saveServerUrl?: (url: string) => void
  /** Merkt die laufende Sitzung (für „Wieder verbinden" nach Abbruch) — beim Match-Start gerufen. */
  saveActiveSession?: (info: { serverUrl: string; room: string; name: string }) => void
  /** Direkt einem Raum beitreten (aus dem Lobby-Browser) — überspringt das Formular. */
  autoJoinRoom?: string
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
    panel.appendChild(title(t('mp.formTitle')))

    const urlInput = labeledInput('Server', opts.defaultServerUrl, 'ws://host:8787')
    const nameInput = labeledInput(t('header.name'), opts.defaultName, t('mp.namePlaceholder'))
    const roomInput = labeledInput(t('mp.room'), '', t('mp.roomPlaceholder'))

    if (error !== undefined) {
      const e = document.createElement('div')
      e.textContent = error
      e.style.cssText = 'color:#ff8080;font-size:12px;margin:4px 0 6px'
      panel.appendChild(e)
    }

    const connectBtn = button(t('mp.connect'), true)
    connectBtn.addEventListener('click', () => {
      const url = urlInput.value.trim()
      const name = nameInput.value.trim() || 'Du'
      if (url.length === 0) {
        showForm(t('mp.noUrl'))
        return
      }
      opts.saveServerUrl?.(url)
      connect(url, roomInput.value.trim().toUpperCase(), name)
    })
    panel.appendChild(connectBtn)

    const backBtn = button(t('mp.back'), false)
    backBtn.addEventListener('click', () => opts.onBack())
    panel.appendChild(backBtn)
  }

  function showConnecting(url: string): void {
    panel.textContent = ''
    panel.appendChild(title(t('mp.connecting')))
    const info = document.createElement('div')
    info.textContent = url
    info.style.cssText = 'font-size:12px;opacity:0.7;margin-bottom:8px;word-break:break-all'
    panel.appendChild(info)
  }

  /* ── Verbindung ─────────────────────────────────────────────────────────── */
  let connectedUrl = ''
  let connectedName = ''
  function connect(url: string, room: string, name: string): void {
    showConnecting(url)
    connectedUrl = url
    connectedName = name
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
      onStart: (config, youAre) => {
        started = true
        const tr = transport
        if (tr === null) return
        // Sitzung merken (für „Wieder verbinden" nach Abbruch) und ans Match übergeben.
        opts.saveActiveSession?.({
          serverUrl: connectedUrl,
          room: currentRoom,
          name: connectedName,
        })
        // `youAre` = die gesteuerte Nation (im geteilten Modus ≠ eigene Lobby-ID); Host-Rechte
        // bleiben aber an der Mitglieds-ID (`myId`) hängen.
        opts.onMatchStart(config, tr, youAre ?? myId, myId === hostId)
      },
    })
    // Verbindungsfehler/Abbruch vor dem Join → zurück zum Formular (Timeout-basiert, da der
    // Transport keine onerror/onclose-Hooks nach außen gibt).
    window.setTimeout(() => {
      if (!joined && !started) {
        teardownTransport()
        showForm(t('mp.timeout'))
      }
    }, 6000)
  }

  let currentRoom = ''

  /* ── Lobby-Ansicht ──────────────────────────────────────────────────────── */
  function renderLobby(room: string, peers: readonly LobbyPeer[], s: MatchSettings): void {
    currentRoom = room
    panel.textContent = ''
    panel.appendChild(title(t('mp.lobbyTitle')))

    const code = document.createElement('div')
    code.innerHTML = `${t('mp.roomCode')}: <b style="color:${ACCENT};letter-spacing:2px">${room}</b>`
    code.style.cssText = 'font-size:14px;margin-bottom:8px'
    panel.appendChild(code)

    // Einladungslink: öffnet das Spiel direkt in diesem Raum (auch für private Lobbys teilbar).
    const inviteUrl = `${window.location.origin}/r/${room}`
    const inviteRow = document.createElement('div')
    inviteRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:12px'
    const inviteField = document.createElement('input')
    inviteField.type = 'text'
    inviteField.readOnly = true
    inviteField.value = inviteUrl
    inviteField.style.cssText = INPUT_STYLE + ';font-size:11px;opacity:0.85'
    const copyBtn = document.createElement('button')
    copyBtn.innerHTML = `${icon.link} ${t('mp.copy')}`
    copyBtn.style.cssText = [
      'flex:none',
      'padding:7px 9px',
      'background:transparent',
      'color:white',
      'border:1px solid rgba(255,255,255,0.25)',
      'border-radius:6px',
      'font-family:inherit',
      'font-size:11px',
      'cursor:pointer',
    ].join(';')
    copyBtn.addEventListener('click', () => {
      void navigator.clipboard?.writeText(inviteUrl).then(
        () => {
          copyBtn.textContent = `✓ ${t('mp.copied')}`
          setTimeout(() => (copyBtn.innerHTML = `${icon.link} ${t('mp.copy')}`), 1500)
        },
        () => {
          inviteField.select() // Fallback: markieren zum manuellen Kopieren
        },
      )
    })
    inviteRow.appendChild(inviteField)
    inviteRow.appendChild(copyBtn)
    panel.appendChild(inviteRow)

    // Teilnehmerliste
    const list = document.createElement('div')
    list.style.cssText = 'margin-bottom:12px'
    // Team-Wähler bei „verbündet" UND „geteilt" (bei „geteilt" = welche Nation man mitsteuert).
    const teamMode = s.teamMode === 'allied' || s.teamMode === 'shared'
    const teamCount = Math.max(2, s.teamCount ?? 2)
    for (const p of peers) {
      const row = document.createElement('div')
      row.style.cssText =
        'display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;padding:3px 0'
      const left = document.createElement('span')
      const you = p.playerId === myId ? ` (${t('mp.you')})` : ''
      const host = p.playerId === hostId ? ' ★' : ''
      left.textContent = `• ${p.name}${you}${host}`
      left.style.cssText = 'flex:1;min-width:0'
      row.appendChild(left)
      // Team-Wähler (nur im Team-Modus): eigenes editierbar, fremde nur Anzeige.
      if (teamMode) {
        if (p.playerId === myId) {
          const sel = document.createElement('select')
          sel.style.cssText = INPUT_STYLE + ';flex:none;width:auto;padding:2px 6px;font-size:12px'
          for (let i = 0; i < teamCount; i++) {
            const o = document.createElement('option')
            o.value = String(i)
            o.textContent = `${t('mp.team')} ${String(i + 1)}`
            if (i === (p.teamId ?? 0)) o.selected = true
            sel.appendChild(o)
          }
          sel.addEventListener('change', () => transport?.setTeam(Number(sel.value)))
          row.appendChild(sel)
        } else {
          const teamTag = document.createElement('span')
          teamTag.textContent = `${t('mp.team')} ${String((p.teamId ?? 0) + 1)}`
          teamTag.style.cssText = 'flex:none;opacity:0.75;font-size:12px'
          row.appendChild(teamTag)
        }
      }
      const right = document.createElement('span')
      right.textContent = p.connected
        ? p.ready
          ? `${t('mp.ready')} ✓`
          : t('mp.waiting')
        : t('mp.disconnected')
      right.style.cssText = `flex:none;opacity:0.8;color:${p.ready ? '#7cffa0' : 'white'}`
      row.appendChild(right)
      list.appendChild(row)
    }
    if (peers.length === 0) {
      const hint = document.createElement('div')
      hint.textContent = t('mp.waitingPeers')
      hint.style.cssText = 'font-size:12px;opacity:0.6'
      list.appendChild(hint)
    }
    panel.appendChild(list)

    // Match-Settings (Host editierbar, sonst nur Anzeige)
    panel.appendChild(renderSettings(s, myId === hostId && peers.length > 0))

    const readyBtn = button(`${t('mp.readyBtn')} ✓`, true)
    readyBtn.addEventListener('click', () => transport?.setReady(true))
    panel.appendChild(readyBtn)

    const leaveBtn = button(t('confirm.leave'), false)
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
    head.textContent = editable ? t('mp.matchHost') : t('mp.matchGuest')
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

    const checkboxRow = (
      label: string,
      value: boolean,
      hint: (on: boolean) => string,
      apply: (v: boolean) => MatchSettings,
    ): void => {
      const row = document.createElement('div')
      row.style.cssText = ROW_STYLE
      const l = document.createElement('label')
      l.textContent = label
      l.style.cssText = LABEL_STYLE
      const wrap = document.createElement('label')
      wrap.style.cssText = 'flex:1;display:flex;align-items:center;gap:8px;font-size:12px'
      if (editable) wrap.style.cursor = 'pointer'
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.checked = value
      cb.disabled = !editable
      const txt = document.createElement('span')
      txt.textContent = hint(value)
      cb.addEventListener('change', () => {
        txt.textContent = hint(cb.checked)
        push(apply(cb.checked))
      })
      wrap.appendChild(cb)
      wrap.appendChild(txt)
      row.appendChild(l)
      row.appendChild(wrap)
      box.appendChild(row)
    }

    selectRow(
      t('mp.map'),
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
      t('mp.terrain'),
      s.terrain,
      [
        ['flat', t('mp.terrainFlat')],
        ['continents', t('terrain.continents')],
        ['islands', t('terrain.islands')],
      ],
      (v) => ({ ...settings, terrain: v as MatchSettings['terrain'] }),
    )
    numRow(t('mp.ai'), s.aiCount, (v) => ({ ...settings, aiCount: v }))
    numRow(t('mp.wild'), s.wildCount, (v) => ({ ...settings, wildCount: v }))
    numRow(t('field.victory'), s.victoryPct, (v) => ({ ...settings, victoryPct: v }))
    selectRow(
      t('mp.difficulty'),
      s.difficulty,
      [
        ['beginner', `${t('difficulty.beginner')} (${String(PRESET_ELO.beginner)})`],
        ['easy', `${t('difficulty.easy')} (${String(PRESET_ELO.easy)})`],
        ['standard', `${t('difficulty.standard')} (${String(PRESET_ELO.standard)})`],
        ['advanced', `${t('difficulty.advanced')} (${String(PRESET_ELO.advanced)})`],
        ['expert', `${t('difficulty.expert')} (${String(PRESET_ELO.expert)})`],
      ],
      (v) => ({ ...settings, difficulty: v as MatchSettings['difficulty'] }),
    )
    checkboxRow(
      t('field.rivers'),
      s.rivers,
      (on) => (on ? t('toggle.on') : t('toggle.off')),
      (v) => ({ ...settings, rivers: v }),
    )
    numRow(t('field.riverDensity'), s.riverDensity ?? 1, (v) => ({
      ...settings,
      riverDensity: Math.max(0.2, Math.min(3, v)),
    }))
    // Modus (ADR-0025/0026): Hauptstadt-Modus + Teams.
    checkboxRow(
      t('field.captureMode'),
      s.captureMode === true,
      (on) => (on ? t('toggle.on') : t('toggle.off')),
      (v) => ({ ...settings, captureMode: v }),
    )
    selectRow(
      t('field.teamMode'),
      s.teamMode ?? 'off',
      [
        ['off', t('teamMode.off')],
        ['allied', t('teamMode.allied')],
        ['shared', t('teamMode.shared')],
      ],
      (v) => ({
        ...settings,
        teamMode: v === 'allied' ? 'allied' : v === 'shared' ? 'shared' : 'off',
      }),
    )
    // Team-Anzahl bei „verbündet" & „geteilt" (= Nationen); Team-Größe nur bei „verbündet".
    if (s.teamMode === 'allied' || s.teamMode === 'shared') {
      numRow(t('field.teamCount'), s.teamCount ?? 2, (v) => ({
        ...settings,
        teamCount: Math.max(2, Math.min(8, Math.round(v))),
      }))
    }
    if (s.teamMode === 'allied') {
      numRow(t('field.teamSize'), s.teamSize ?? 2, (v) => ({
        ...settings,
        teamSize: Math.max(1, Math.min(6, Math.round(v))),
      }))
    }
    // Gebäude-Toggles: deaktivierte Typen kann im Match niemand bauen (deterministisch übers Netz).
    const setBuilding = (type: BuildingType, on: boolean): MatchSettings => {
      const ab: Partial<Record<BuildingType, boolean>> = { ...(settings.allowedBuildings ?? {}) }
      ab[type] = on
      return { ...settings, allowedBuildings: ab }
    }
    for (const type of ['city', 'defense', 'port', 'factory', 'airport', 'flak'] as const) {
      checkboxRow(
        t(`building.${type}`),
        s.allowedBuildings?.[type] !== false,
        (on) => (on ? t('toggle.on') : t('toggle.off')),
        (v) => setBuilding(type, v),
      )
    }
    checkboxRow(
      t('mp.visible'),
      s.public,
      (on) => (on ? t('mp.public') : t('mp.private')),
      (v) => ({ ...settings, public: v }),
    )

    return box
  }

  function teardownTransport(): void {
    if (transport !== null && !started) transport.destroy()
    transport = null
  }

  // Aus dem Lobby-Browser: direkt verbinden (Formular überspringen); sonst Formular zeigen.
  if (opts.autoJoinRoom !== undefined && opts.autoJoinRoom.length > 0) {
    connect(opts.defaultServerUrl, opts.autoJoinRoom.toUpperCase(), opts.defaultName)
  } else {
    showForm()
  }

  return {
    destroy(): void {
      teardownTransport()
      overlay.remove()
    },
  }
}
