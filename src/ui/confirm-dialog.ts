/**
 * Schlichtes Bestätigungs-Overlay (Ja/Abbrechen) — z.B. damit ein versehentliches Esc
 * nicht sofort die laufende Runde beendet. Bestätigen via Button oder Enter; Abbrechen via
 * Button, Klick daneben oder Esc.
 */

import { t } from '../i18n'

export interface ConfirmDialogApi {
  /** Öffnet den Dialog mit `message`; `onConfirm` läuft bei Bestätigung. */
  open(message: string, onConfirm: () => void): void
  isOpen(): boolean
  /** Schließt ohne zu bestätigen. */
  close(): void
  destroy(): void
}

export function createConfirmDialog(container: HTMLElement): ConfirmDialogApi {
  let onConfirm: (() => void) | null = null

  const backdrop = document.createElement('div')
  backdrop.style.cssText = [
    'position: absolute',
    'inset: 0',
    'background: rgba(0,0,0,0.5)',
    'display: none',
    'align-items: center',
    'justify-content: center',
    'z-index: 40',
    'pointer-events: auto',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
  ].join(';')

  const box = document.createElement('div')
  box.style.cssText = [
    'background: rgba(16,18,24,0.97)',
    'border: 1px solid rgba(255,255,255,0.15)',
    'border-radius: 10px',
    'padding: 20px 22px',
    'box-shadow: 0 8px 30px rgba(0,0,0,0.55)',
    'text-align: center',
    'color: white',
    'max-width: 360px',
  ].join(';')

  const msgEl = document.createElement('div')
  msgEl.style.cssText = 'font-size: 14px; margin-bottom: 16px; line-height: 1.4'

  const btnRow = document.createElement('div')
  btnRow.style.cssText = 'display: flex; gap: 10px; justify-content: center'

  const confirmBtn = document.createElement('button')
  confirmBtn.textContent = t('confirm.leave')
  confirmBtn.style.cssText = [
    'font: inherit',
    'cursor: pointer',
    'border: none',
    'border-radius: 6px',
    'padding: 8px 16px',
    'color: #fff',
    'background: #8a3a3a',
  ].join(';')

  const cancelBtn = document.createElement('button')
  cancelBtn.textContent = t('confirm.keepPlaying')
  cancelBtn.style.cssText = [
    'font: inherit',
    'cursor: pointer',
    'border: none',
    'border-radius: 6px',
    'padding: 8px 16px',
    'color: #fff',
    'background: #2f7d4f',
  ].join(';')

  btnRow.appendChild(cancelBtn)
  btnRow.appendChild(confirmBtn)
  box.appendChild(msgEl)
  box.appendChild(btnRow)
  backdrop.appendChild(box)
  container.appendChild(backdrop)

  function close(): void {
    backdrop.style.display = 'none'
    onConfirm = null
  }

  function confirm(): void {
    const cb = onConfirm
    close()
    cb?.()
  }

  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close() // Klick daneben = abbrechen
  })
  cancelBtn.addEventListener('click', close)
  confirmBtn.addEventListener('click', confirm)
  backdrop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirm()
    else if (e.key === 'Escape') close()
  })

  return {
    open(message, cb): void {
      msgEl.textContent = message
      onConfirm = cb
      backdrop.style.display = 'flex'
      cancelBtn.focus() // Default-Fokus auf „Weiterspielen" (sicherere Wahl)
    },
    isOpen: () => backdrop.style.display !== 'none',
    close,
    destroy(): void {
      backdrop.remove()
    },
  }
}
