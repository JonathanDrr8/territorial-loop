/**
 * Account-Dialog (ADR-0027, Phase 2): modales Overlay zum Anmelden / Registrieren / Passwort-Reset.
 * Geöffnet über den Konto-Knopf im Menü-Header. Reines Vanilla-DOM, folgt dem Menü-Theme (`--tl-*`).
 *
 * Optional gedacht: Wer nichts anklickt, spielt als anonymer Gast weiter (ADR-0027). Nach
 * erfolgreichem Login/Logout meldet `onChange` zurück, damit der Header seinen Status aktualisiert.
 */

import { t } from '../i18n'
import { currentUsername, loginAccount, logout, recoverAccount, registerAccount } from './account'

const ACCENT = 'var(--tl-accent)'

type Mode = 'login' | 'register' | 'recover'

export interface AccountDialogApi {
  destroy(): void
}

export interface AccountDialogOptions {
  serverUrl: string
  /** Wird nach Login/Logout/Registrierung aufgerufen (Header-Status neu zeichnen). */
  onChange?: () => void
}

const INPUT_STYLE = [
  'width: 100%',
  'box-sizing: border-box',
  'padding: 9px 11px',
  'background: var(--tl-input-bg, rgba(0,0,0,0.25))',
  'color: var(--tl-text)',
  'border: 1px solid var(--tl-panel-border-color)',
  'border-radius: 8px',
  'font-family: var(--tl-font)',
  'font-size: 14px',
  'margin-top: 4px',
].join(';')

const BTN_PRIMARY = [
  'width: 100%',
  'padding: 10px',
  'margin-top: 14px',
  `background: ${ACCENT}`,
  'color: #1a1a1a',
  'border: none',
  'border-radius: 8px',
  'font-weight: 700',
  'font-size: 14px',
  'cursor: pointer',
  'font-family: var(--tl-font)',
].join(';')

const LINK_STYLE = [
  'background: none',
  'border: none',
  'color: var(--tl-text)',
  'opacity: 0.7',
  'cursor: pointer',
  'font-size: 13px',
  'font-family: var(--tl-font)',
  'text-decoration: underline',
  'padding: 4px',
].join(';')

export function createAccountDialog(opts: AccountDialogOptions): AccountDialogApi {
  let mode: Mode = 'login'
  let busy = false

  const overlay = document.createElement('div')
  overlay.style.cssText = [
    'position: fixed',
    'inset: 0',
    'z-index: 100',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'background: rgba(0,0,0,0.6)',
    'font-family: var(--tl-font)',
  ].join(';')

  const panel = document.createElement('div')
  panel.style.cssText = [
    'background: var(--tl-panel-bg)',
    'color: var(--tl-text)',
    'border: 1px solid var(--tl-panel-border-color)',
    'border-radius: 14px',
    'padding: 24px 26px',
    'width: 340px',
    'max-width: 92vw',
    'box-shadow: 0 18px 60px rgba(0,0,0,0.5)',
  ].join(';')
  overlay.appendChild(panel)

  const destroy = (): void => {
    document.removeEventListener('keydown', onKey)
    overlay.remove()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') destroy()
  }
  document.addEventListener('keydown', onKey)
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) destroy()
  })

  function field(labelKey: string, type: string, autocomplete: string): HTMLInputElement {
    const wrap = document.createElement('label')
    wrap.style.cssText = 'display: block; margin-top: 12px; font-size: 13px; opacity: 0.85'
    wrap.textContent = t(labelKey)
    const input = document.createElement('input')
    input.type = type
    input.setAttribute('autocomplete', autocomplete)
    input.style.cssText = INPUT_STYLE
    wrap.appendChild(input)
    panel.appendChild(wrap)
    return input
  }

  function heading(textKey: string): void {
    const h = document.createElement('div')
    h.textContent = t(textKey)
    h.style.cssText = `font-size: 18px; font-weight: 700; color: ${ACCENT}; margin-bottom: 4px`
    panel.appendChild(h)
  }

  function msg(text: string, error: boolean): void {
    const m = document.createElement('div')
    m.textContent = text
    m.style.cssText = `margin-top: 12px; font-size: 13px; line-height: 1.45; color: ${error ? '#e8806a' : ACCENT}`
    panel.appendChild(m)
  }

  function linkRow(items: ReadonlyArray<readonly [string, () => void]>): void {
    const row = document.createElement('div')
    row.style.cssText =
      'display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-top: 14px'
    for (const [labelKey, fn] of items) {
      const b = document.createElement('button')
      b.textContent = t(labelKey)
      b.style.cssText = LINK_STYLE
      b.addEventListener('click', fn)
      row.appendChild(b)
    }
    panel.appendChild(row)
  }

  function primaryButton(labelKey: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.textContent = t(labelKey)
    b.style.cssText = BTN_PRIMARY
    b.addEventListener('click', onClick)
    panel.appendChild(b)
    return b
  }

  function errorText(code: string): string {
    const key =
      code === 'taken'
        ? 'account.error.taken'
        : code === 'username'
          ? 'account.error.username'
          : code === 'password'
            ? 'account.error.password'
            : code === 'offline'
              ? 'account.error.offline'
              : 'account.error.invalid'
    return t(key)
  }

  function render(): void {
    panel.textContent = ''

    const loggedIn = currentUsername()
    if (loggedIn !== null) {
      heading('account.title.account')
      msg(t('account.loggedInAs', { name: loggedIn }), false)
      primaryButton('account.btn.logout', () => {
        logout()
        opts.onChange?.()
        render()
      })
      linkRow([['account.btn.close', destroy]])
      return
    }

    const intro = document.createElement('div')
    intro.textContent = t('account.intro')
    intro.style.cssText = 'font-size: 12px; opacity: 0.7; line-height: 1.5; margin: 6px 0 6px'

    if (mode === 'login') {
      heading('account.title.login')
      panel.appendChild(intro)
      const user = field('account.username', 'text', 'username')
      const pass = field('account.password', 'password', 'current-password')
      primaryButton('account.btn.login', () => {
        if (busy) return
        void submit(() => loginAccount(opts.serverUrl, user.value.trim(), pass.value))
      })
      linkRow([
        ['account.switch.toRegister', () => switchTo('register')],
        ['account.switch.toRecover', () => switchTo('recover')],
      ])
    } else if (mode === 'register') {
      heading('account.title.register')
      panel.appendChild(intro)
      const user = field('account.username', 'text', 'username')
      const pass = field('account.password', 'password', 'new-password')
      // E-Mail-Feld vorerst ausgeblendet: ohne Mail-Versand (Recovery läuft über den Code) hätte es
      // keinen Nutzen. Backend/DB akzeptieren weiter eine E-Mail — wieder einblenden, sobald
      // transaktionaler Versand (SMTP) eingerichtet ist. Vorerst leer übergeben.
      primaryButton('account.btn.register', () => {
        if (busy) return
        void submit(() => registerAccount(opts.serverUrl, user.value.trim(), pass.value, ''), true)
      })
      linkRow([['account.switch.toLogin', () => switchTo('login')]])
    } else {
      heading('account.title.recover')
      const user = field('account.username', 'text', 'username')
      const code = field('account.recoveryCode', 'text', 'off')
      const pass = field('account.newPassword', 'password', 'new-password')
      primaryButton('account.btn.recover', () => {
        if (busy) return
        void submit(() => recoverAccount(opts.serverUrl, user.value.trim(), code.value, pass.value))
      })
      linkRow([['account.switch.toLogin', () => switchTo('login')]])
    }
  }

  function switchTo(m: Mode): void {
    mode = m
    render()
  }

  async function submit(
    action: () => Promise<{ ok: boolean; error?: string; recoveryCode?: string }>,
    isRegister = false,
  ): Promise<void> {
    busy = true
    const res = await action()
    busy = false
    if (!res.ok) {
      msg(errorText(res.error ?? 'invalid'), true)
      return
    }
    opts.onChange?.()
    if (isRegister && res.recoveryCode !== undefined && res.recoveryCode.length > 0) {
      showRecoveryCode(res.recoveryCode)
    } else {
      render()
    }
  }

  function showRecoveryCode(code: string): void {
    panel.textContent = ''
    heading('account.recoveryTitle')
    const box = document.createElement('div')
    box.textContent = code
    box.style.cssText = [
      'margin-top: 12px',
      'padding: 14px',
      'background: rgba(0,0,0,0.25)',
      `border: 1px solid ${ACCENT}`,
      'border-radius: 8px',
      'font-family: ui-monospace, monospace',
      'font-size: 20px',
      'letter-spacing: 2px',
      'text-align: center',
      'font-weight: 700',
    ].join(';')
    panel.appendChild(box)
    msg(t('account.recoveryHint'), false)
    primaryButton('account.btn.savedIt', destroy)
  }

  render()
  document.body.appendChild(overlay)
  return { destroy }
}
