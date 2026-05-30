/**
 * Bündnis-Anfragen-Panel: zeigt eingehende Allianz-Angebote an den Menschen mit
 * direkten Aktionen (Akzeptieren / Ablehnen / Ignorieren) — rechtsbündig unter der Rangliste.
 *
 *  - Akzeptieren → accept-alliance Intent (Bündnis kommt zustande).
 *  - Ablehnen    → decline-alliance Intent (Anfrage wird verworfen).
 *  - Ignorieren  → nur lokal ausblenden (Anfrage bleibt im State, stört aber nicht mehr).
 *  - Nach 15 s blendet ein unbeantwortetes Angebot von selbst aus (faded weg), damit das
 *    Panel bei vielen Nationen nicht den Bildschirm zukleistert. Ein neues Angebot gibt
 *    einen dezenten Hinweis-Sound (über `onNewRequest`).
 *
 * Liest `state.allianceRequests` read-only; Schlüssel sind gerichtet (from→to) via
 * `directedKey(from,to) = from*4096 + to`.
 */

import type { GameState } from '../core/game'
import { t } from '../i18n'
import { rgbaToCss } from './colors'
import { registerScalable } from './ui-scale'

const ID_STRIDE = 4096
/** Wie lange ein unbeantwortetes Angebot sichtbar bleibt, bevor es ausfaded. */
const TTL_MS = 15_000
const FADE_MS = 600
/** Mindestabstand zwischen zwei Hinweis-Sounds (verhindert Salven bei vielen Angeboten). */
const SOUND_COOLDOWN_MS = 1500

export interface AlliancePromptApi {
  update(): void
  /** Aktuelle Pixel-Höhe des Panels (0 wenn leer) — damit der Log darunter rücken kann. */
  heightPx(): number
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
  /** Wird gerufen, wenn ein NEUES Angebot erscheint (z.B. für einen Hinweis-Sound). */
  onNewRequest?: () => void,
): AlliancePromptApi {
  const box = document.createElement('div')
  // Links (statt rechts) — sonst überlappt die aufgeklappte Rangliste oben rechts die Anfragen.
  box.style.cssText = [
    'position: absolute',
    'top: 232px',
    'left: 12px',
    'display: flex',
    'flex-direction: column',
    'gap: 6px',
    'align-items: flex-start',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 12px',
    'z-index: 20',
    'pointer-events: none',
  ].join(';')
  container.appendChild(box)
  registerScalable(box)

  // Pro Anfragesteller eine verwaltete Zeile (kein Neubauen pro Frame → Klicks bleiben stabil,
  // und einzelne Zeilen können ein-/ausfaden).
  const rows = new Map<number, HTMLDivElement>()
  const firstSeen = new Map<number, number>()
  const fading = new Set<number>()
  // Lokal ignorierte Anfragesteller (Ignorieren-Klick oder 15-s-Timeout) — nur Anzeige.
  const ignored = new Set<number>()
  let lastSoundAt = -Infinity

  box.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement | null)?.closest('[data-act]')
    if (!(el instanceof HTMLElement)) return
    const requesterId = Number(el.dataset.req)
    const act = el.dataset.act
    if (act === 'accept') onAccept(requesterId)
    else if (act === 'decline') onDecline(requesterId)
    else if (act === 'ignore') hide(requesterId)
  })

  /** Zeile entfernen + lokal ignorieren (sofort, ohne Fade). */
  function hide(id: number): void {
    ignored.add(id)
    const el = rows.get(id)
    if (el !== undefined) {
      el.remove()
      rows.delete(id)
    }
    firstSeen.delete(id)
    fading.delete(id)
  }

  /** Zeile ausfaden und danach lokal ignorieren (15-s-Timeout). */
  function fadeOut(id: number): void {
    if (fading.has(id)) return
    fading.add(id)
    const el = rows.get(id)
    if (el === undefined) {
      ignored.add(id)
      return
    }
    el.style.opacity = '0'
    el.style.transform = 'translateX(-12px)'
    window.setTimeout(() => {
      el.remove()
      rows.delete(id)
      firstSeen.delete(id)
      fading.delete(id)
      ignored.add(id)
    }, FADE_MS)
  }

  function makeRow(from: number, name: string, color: string): HTMLDivElement {
    const row = document.createElement('div')
    row.style.cssText = [
      `background:rgba(8,10,16,0.92)`,
      `border-left:3px solid ${color}`,
      'border-radius:6px',
      'padding:6px 9px',
      'display:flex',
      'gap:8px',
      'align-items:center',
      'opacity:0',
      'transform:translateX(-12px)',
      `transition:opacity ${String(FADE_MS)}ms ease, transform ${String(FADE_MS)}ms ease`,
    ].join(';')
    const btn = (act: string, label: string, bg: string): string =>
      `<button data-act="${act}" data-req="${String(from)}" style="pointer-events:auto;cursor:pointer;font:inherit;border:none;border-radius:4px;padding:3px 8px;color:#fff;background:${bg}">${label}</button>`
    row.innerHTML =
      `<span><b style="color:${color}">${escapeHtml(name)}</b> ${t('prompt.offersAlliance')}</span>` +
      btn('accept', t('prompt.accept'), '#2f7d4f') +
      btn('decline', t('prompt.decline'), '#8a3a3a') +
      btn('ignore', t('prompt.ignore'), '#3a3f4a')
    return row
  }

  function update(): void {
    if (humanId < 0) {
      if (rows.size > 0) {
        box.textContent = ''
        rows.clear()
        firstSeen.clear()
        fading.clear()
      }
      return
    }
    // I/O-Zeit (kein Sim-Determinismus) — rein clientseitige Anzeige-Lebensdauer.
    const now = globalThis.performance.now()
    const present = new Set<number>()
    let newAppeared = false

    for (const key of state.allianceRequests) {
      if (key % ID_STRIDE !== humanId) continue // nur Angebote an uns
      const from = Math.floor(key / ID_STRIDE)
      if (ignored.has(from)) continue
      const requester = state.players.get(from)
      if (requester === undefined || !requester.isAlive) continue
      present.add(from)

      const existing = rows.get(from)
      if (existing === undefined) {
        const el = makeRow(from, requester.name, rgbaToCss(requester.color))
        rows.set(from, el)
        firstSeen.set(from, now)
        box.appendChild(el)
        // Fade-in im nächsten Frame (sonst greift die Transition vom Startwert nicht).
        requestAnimationFrame(() => {
          el.style.opacity = '1'
          el.style.transform = 'translateX(0)'
        })
        newAppeared = true
      } else if (!fading.has(from) && now - (firstSeen.get(from) ?? now) >= TTL_MS) {
        fadeOut(from) // 15 s ohne Antwort → wegfaden
      }
    }

    // Zeilen entfernen, deren Anfrage aus dem State verschwand (akzeptiert/abgelehnt/Steller tot).
    for (const [id, el] of rows) {
      if (!present.has(id) && !fading.has(id)) {
        el.remove()
        rows.delete(id)
        firstSeen.delete(id)
      }
    }
    // Ignorierte Steller vergessen, sobald ihre Anfrage weg ist (spätere Anfrage erscheint neu).
    for (const id of ignored) {
      if (!state.allianceRequests.has(id * ID_STRIDE + humanId)) ignored.delete(id)
    }

    if (newAppeared && now - lastSoundAt >= SOUND_COOLDOWN_MS) {
      lastSoundAt = now
      onNewRequest?.()
    }
  }

  return {
    update,
    heightPx(): number {
      return box.offsetHeight
    },
    destroy(): void {
      box.remove()
    },
  }
}
