/**
 * Bündnis-Anfragen-Panel: zeigt eingehende Allianz-Angebote an den Menschen mit
 * direkten Aktionen (Akzeptieren / Ablehnen / Ignorieren) — oben mittig, damit man
 * nicht erst ins Diplomatie-Menü navigieren muss.
 *
 *  - Akzeptieren → accept-alliance Intent (Bündnis kommt zustande).
 *  - Ablehnen    → decline-alliance Intent (Anfrage wird verworfen).
 *  - Ignorieren  → nur lokal ausblenden (Anfrage bleibt im State, stört aber nicht mehr).
 *
 * Liest `state.allianceRequests` read-only; Schlüssel sind gerichtet (from→to) via
 * `directedKey(from,to) = from*4096 + to`.
 */

import type { GameState } from '../core/game'
import { rgbaToCss } from './colors'

const ID_STRIDE = 4096

export interface AlliancePromptApi {
  update(): void
  destroy(): void
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  )
}

export function createAlliancePrompt(
  container: HTMLElement,
  state: GameState,
  humanId: number,
  onAccept: (requesterId: number) => void,
  onDecline: (requesterId: number) => void,
): AlliancePromptApi {
  const box = document.createElement('div')
  box.style.cssText = [
    'position: absolute',
    'top: 12px',
    'left: 50%',
    'transform: translateX(-50%)',
    'display: flex',
    'flex-direction: column',
    'gap: 6px',
    'align-items: center',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 12px',
    'z-index: 20',
    'pointer-events: none',
  ].join(';')
  container.appendChild(box)

  // Lokal ignorierte Anfragesteller (nur Anzeige; State bleibt unberührt).
  const ignored = new Set<number>()

  box.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement | null)?.closest('[data-act]')
    if (!(el instanceof HTMLElement)) return
    const requesterId = Number(el.dataset.req)
    const act = el.dataset.act
    if (act === 'accept') onAccept(requesterId)
    else if (act === 'decline') onDecline(requesterId)
    else if (act === 'ignore') {
      ignored.add(requesterId)
      update()
    }
  })

  function update(): void {
    if (humanId < 0) {
      if (box.childElementCount > 0) box.textContent = ''
      return
    }
    const rows: string[] = []
    for (const key of state.allianceRequests) {
      if (key % ID_STRIDE !== humanId) continue // nur Angebote an uns
      const from = Math.floor(key / ID_STRIDE)
      if (ignored.has(from)) continue
      const requester = state.players.get(from)
      if (requester === undefined || !requester.isAlive) continue
      const color = rgbaToCss(requester.color)
      const btn = (act: string, label: string, bg: string): string =>
        `<button data-act="${act}" data-req="${String(from)}" style="pointer-events:auto;cursor:pointer;font:inherit;border:none;border-radius:4px;padding:3px 8px;color:#fff;background:${bg}">${label}</button>`
      rows.push(
        `<div style="background:rgba(8,10,16,0.92);border-left:3px solid ${color};border-radius:6px;padding:6px 9px;display:flex;gap:8px;align-items:center">` +
          `<span>🤝 <b style="color:${color}">${escapeHtml(requester.name)}</b> bietet ein Bündnis</span>` +
          btn('accept', 'Akzeptieren', '#2f7d4f') +
          btn('decline', 'Ablehnen', '#8a3a3a') +
          btn('ignore', 'Ignorieren', '#3a3f4a') +
          `</div>`,
      )
    }
    // Ignorierte Steller vergessen, sobald ihre Anfrage weg ist (damit eine spätere
    // erneute Anfrage wieder erscheint).
    for (const id of ignored) {
      if (!state.allianceRequests.has(id * ID_STRIDE + humanId)) ignored.delete(id)
    }
    box.innerHTML = rows.join('')
  }

  return {
    update,
    destroy(): void {
      box.remove()
    },
  }
}
