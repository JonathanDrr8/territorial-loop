/**
 * Pause-/Esc-Menü im Match. Esc öffnet ein kleines Overlay mit „Weiter", „HUD anpassen"
 * (öffnet den HUD-Editor) und „Runde verlassen". Ersetzt den früheren direkten Verlassen-
 * Bestätigungsdialog — das Menü selbst ist die bewusste Hürde gegen versehentliches Beenden.
 *
 * Reine Client-UI, folgt dem gewählten Theme (`panelStyle`).
 */

import { t } from '../i18n'
import { panelStyle } from './theme'

export interface PauseMenuCallbacks {
  /** Menü schließen, weiterspielen. */
  onResume: () => void
  /** HUD-Editor öffnen. */
  onCustomizeHud: () => void
  /** Runde verlassen (zurück ins Hauptmenü). */
  onLeave: () => void
}

export interface PauseMenuApi {
  open(): void
  close(): void
  isOpen(): boolean
  destroy(): void
}

export function createPauseMenu(
  container: HTMLElement,
  callbacks: PauseMenuCallbacks,
): PauseMenuApi {
  let open = false

  const backdrop = document.createElement('div')
  backdrop.style.cssText = [
    'position: absolute',
    'inset: 0',
    'background: rgba(0,0,0,0.5)',
    'display: none',
    'align-items: center',
    'justify-content: center',
    'z-index: 48',
    'pointer-events: auto',
  ].join(';')

  const box = document.createElement('div')
  box.style.cssText = panelStyle([
    'min-width: 260px',
    'padding: 22px 24px',
    'display: flex',
    'flex-direction: column',
    'gap: 10px',
    'text-align: center',
    'box-shadow: 0 18px 60px rgba(0,0,0,0.55)',
  ])
  backdrop.appendChild(box)

  const title = document.createElement('div')
  title.textContent = t('pause.title')
  title.style.cssText =
    'font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: var(--tl-accent); opacity: 0.9; margin-bottom: 6px'
  box.appendChild(title)

  function makeBtn(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = label
    b.style.cssText = [
      'padding: 11px 14px',
      'font-family: var(--tl-font)',
      'font-size: 14px',
      'font-weight: 700',
      'cursor: pointer',
      'border-radius: 8px',
      primary ? 'border: none' : 'border: 1px solid var(--tl-panel-border-color)',
      primary
        ? 'background: var(--tl-accent); color: #0c0c10'
        : 'background: transparent; color: var(--tl-text)',
    ].join(';')
    b.addEventListener('click', onClick)
    return b
  }

  box.appendChild(makeBtn(t('pause.resume'), true, () => close()))
  box.appendChild(
    makeBtn(t('hud.editor.open'), false, () => {
      close()
      callbacks.onCustomizeHud()
    }),
  )
  const leaveBtn = makeBtn(t('pause.leave'), false, () => {
    close()
    callbacks.onLeave()
  })
  leaveBtn.style.color = 'var(--tl-bad, #d9534f)'
  box.appendChild(leaveBtn)

  // Klick neben die Box schließt (weiterspielen).
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close()
  })

  function setOpen(v: boolean): void {
    open = v
    backdrop.style.display = v ? 'flex' : 'none'
  }
  function close(): void {
    if (!open) return
    setOpen(false)
    callbacks.onResume()
  }

  container.appendChild(backdrop)

  return {
    open: () => setOpen(true),
    close,
    isOpen: () => open,
    destroy(): void {
      backdrop.remove()
    },
  }
}
