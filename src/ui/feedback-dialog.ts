/**
 * Feedback-/Bug-Report-Widget: ein dezenter, dauerhaft sichtbarer Knopf (unten links) — auch
 * mitten im Match erreichbar, damit man einen Bug sofort melden kann. Öffnet einen kleinen
 * Dialog (Feedback oder Bug + Freitext) und schickt ihn als `text/plain`-POST an `<endpoint>/
 * feedback` (kein CORS-Preflight). Der Server hängt es als JSONL an (persistiert via Volume).
 *
 * Reine DOM-UI, eigenständig. Der Aufrufer erzeugt das Widget einmal beim Boot und ruft am Ende
 * `destroy()`.
 */

import { t } from '../i18n'
import { panelStyle } from './theme'

const ACCENT = 'var(--tl-accent)'

export interface FeedbackUiApi {
  /** Öffnet den Feedback-/Bug-Dialog (z. B. aus dem Menü-Footer). */
  open(): void
  destroy(): void
}

export function createFeedbackUi(
  container: HTMLElement,
  opts: { endpoint: string; version: string },
): FeedbackUiApi {
  const trigger = document.createElement('button')
  trigger.textContent = t('footer.feedback')
  trigger.title = t('feedback.triggerTitle')
  // Oben links (der UI-Größen-Slider, der hier mal daneben saß, ist raus → ADR-0024). Im Menü liegt
  // der Knopf hinter dem Overlay (s. main.ts). Theme-Panel-Look, damit er zum HUD passt.
  trigger.style.cssText = panelStyle([
    'position: absolute',
    'left: 12px',
    'top: 12px',
    'z-index: 40',
    'padding: 6px 10px',
    'font-size: 12px',
    'cursor: pointer',
    'opacity: 0.82',
  ])
  trigger.addEventListener('mouseenter', () => (trigger.style.opacity = '1'))
  trigger.addEventListener('mouseleave', () => (trigger.style.opacity = '0.82'))

  let overlay: HTMLElement | null = null

  function close(): void {
    overlay?.remove()
    overlay = null
  }

  function open(): void {
    if (overlay !== null) return
    overlay = document.createElement('div')
    overlay.style.cssText = [
      'position: absolute',
      'inset: 0',
      'background: rgba(0,0,0,0.75)',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'z-index: 60',
      'backdrop-filter: blur(3px)',
    ].join(';')

    const panel = document.createElement('div')
    panel.style.cssText = panelStyle(['padding: 20px 22px', 'width: 380px', 'max-width: 92vw'])

    const h = document.createElement('div')
    h.textContent = t('feedback.title')
    h.style.cssText = 'font-size:16px;font-weight:700;margin-bottom:12px'
    panel.appendChild(h)

    // Art-Umschalter (Feedback ↔ Bug)
    let kind: 'feedback' | 'bug' = 'feedback'
    const kindRow = document.createElement('div')
    kindRow.style.cssText = 'display:flex;gap:8px;margin-bottom:10px'
    const mkKind = (value: 'feedback' | 'bug', label: string): HTMLButtonElement => {
      const b = document.createElement('button')
      b.textContent = label
      b.style.cssText = [
        'flex:1',
        'padding:7px',
        'border-radius:6px',
        'font-family:inherit',
        'font-size:12px',
        'cursor:pointer',
        'border:1px solid rgba(255,255,255,0.2)',
      ].join(';')
      const refresh = (): void => {
        const active = kind === value
        b.style.background = active ? ACCENT : 'transparent'
        b.style.color = active ? '#06121f' : 'white'
        b.style.fontWeight = active ? '700' : '400'
      }
      b.addEventListener('click', () => {
        kind = value
        refreshAll()
      })
      kindButtons.push(refresh)
      return b
    }
    const kindButtons: (() => void)[] = []
    const refreshAll = (): void => kindButtons.forEach((f) => f())
    kindRow.appendChild(mkKind('feedback', t('feedback.kindFeedback')))
    kindRow.appendChild(mkKind('bug', t('feedback.kindBug')))
    panel.appendChild(kindRow)
    refreshAll()

    const textarea = document.createElement('textarea')
    textarea.placeholder = t('feedback.placeholder')
    textarea.maxLength = 2000
    textarea.style.cssText = [
      'width:100%',
      'box-sizing:border-box',
      'height:120px',
      'resize:vertical',
      'background:#0c0c12',
      'color:white',
      'border:1px solid rgba(255,255,255,0.18)',
      'border-radius:6px',
      'padding:9px',
      'font-family:inherit',
      'font-size:13px',
    ].join(';')
    panel.appendChild(textarea)

    const status = document.createElement('div')
    status.style.cssText = 'font-size:12px;min-height:16px;margin-top:6px;opacity:0.85'
    panel.appendChild(status)

    const btnRow = document.createElement('div')
    btnRow.style.cssText = 'display:flex;gap:8px;margin-top:8px'
    const sendBtn = document.createElement('button')
    sendBtn.textContent = t('feedback.send')
    sendBtn.style.cssText = [
      'flex:1',
      'padding:10px',
      `background:${ACCENT}`,
      'color:#06121f',
      'border:none',
      'border-radius:8px',
      'font-weight:700',
      'font-family:inherit',
      'font-size:13px',
      'cursor:pointer',
    ].join(';')
    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = t('feedback.cancel')
    cancelBtn.style.cssText = [
      'padding:10px 14px',
      'background:transparent',
      'color:white',
      'border:1px solid rgba(255,255,255,0.25)',
      'border-radius:8px',
      'font-family:inherit',
      'font-size:13px',
      'cursor:pointer',
    ].join(';')
    cancelBtn.addEventListener('click', close)
    sendBtn.addEventListener('click', () => {
      const text = textarea.value.trim()
      if (text.length === 0) {
        status.textContent = t('feedback.empty')
        return
      }
      sendBtn.disabled = true
      status.textContent = t('feedback.sending')
      // text/plain → kein CORS-Preflight; Body ist JSON-String.
      fetch(`${opts.endpoint}/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ kind, text, version: opts.version }),
      })
        .then((r) => {
          if (!r.ok && r.status !== 204) throw new Error(String(r.status))
          status.style.color = '#7cffa0'
          status.textContent = t('feedback.thanks')
          setTimeout(close, 900)
        })
        .catch(() => {
          sendBtn.disabled = false
          status.style.color = '#ff8080'
          status.textContent = t('feedback.error')
        })
    })
    btnRow.appendChild(sendBtn)
    btnRow.appendChild(cancelBtn)
    panel.appendChild(btnRow)

    overlay.appendChild(panel)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close()
    })
    container.appendChild(overlay)
    setTimeout(() => textarea.focus(), 0)
  }

  trigger.addEventListener('click', open)
  container.appendChild(trigger)

  return {
    open,
    destroy(): void {
      close()
      trigger.remove()
    },
  }
}
