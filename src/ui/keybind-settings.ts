/**
 * Wiederverwendbarer „Tastenbelegung"-Abschnitt für Einstellungs-Dialoge (In-Game + Hauptmenü).
 * Listet alle belegbaren Aktionen mit ihrer aktuellen Taste; ein Klick auf die Taste startet die
 * Erfassung (nächster Tastendruck belegt neu), Esc bricht ab, reservierte Tasten werden abgelehnt.
 * Reine Client-Präferenz (siehe `input/keybinds`), kein Sim/MP-Einfluss.
 */

import { t } from '../i18n'
import {
  KEY_ACTIONS,
  KEY_ACTION_LABEL,
  getKey,
  isReservedKey,
  onKeybindsChange,
  resetKeybinds,
  setKey,
  type KeyAction,
} from '../input/keybinds'

export interface KeybindSectionApi {
  /** Das fertige DOM-Element (Überschrift + Zeilen + Zurücksetzen). */
  element: HTMLElement
  /** Laufende Tasten-Erfassung abbrechen (z. B. beim Schließen des Dialogs). */
  cancelCapture(): void
  destroy(): void
}

/** Taste lesbar darstellen. */
function fmtKey(k: string): string {
  if (k === '') return '—'
  if (k === ' ') return 'Space'
  return k.toUpperCase()
}

export function createKeybindSection(): KeybindSectionApi {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px'

  const h = document.createElement('div')
  h.textContent = t('settings.keybinds')
  h.style.cssText =
    'font-size:12px;font-weight:700;opacity:0.75;margin:8px 0 2px;color:var(--tl-text)'
  wrap.appendChild(h)

  const buttons = new Map<KeyAction, HTMLButtonElement>()
  let capturing: KeyAction | null = null

  function refresh(): void {
    for (const [a, b] of buttons) {
      b.textContent = capturing === a ? t('keybind.press') : fmtKey(getKey(a))
      b.style.borderColor = capturing === a ? 'var(--tl-accent)' : 'var(--tl-panel-border-color)'
    }
  }

  for (const action of KEY_ACTIONS) {
    const row = document.createElement('div')
    row.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px'
    const label = document.createElement('span')
    label.textContent = t(KEY_ACTION_LABEL[action])
    label.style.cssText = 'color:var(--tl-text)'
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = fmtKey(getKey(action))
    btn.style.cssText =
      'min-width:54px;padding:4px 10px;border-radius:5px;border:1px solid var(--tl-panel-border-color);background:transparent;color:var(--tl-text);cursor:pointer;font-family:var(--tl-font);font-size:12px'
    btn.addEventListener('click', () => {
      capturing = capturing === action ? null : action
      refresh()
    })
    buttons.set(action, btn)
    row.append(label, btn)
    wrap.appendChild(row)
  }

  const reset = document.createElement('button')
  reset.type = 'button'
  reset.textContent = t('settings.keybinds.reset')
  reset.style.cssText =
    'margin-top:6px;align-self:flex-start;padding:5px 12px;font-size:12px;border-radius:6px;border:1px solid var(--tl-panel-border-color);background:transparent;color:var(--tl-text);cursor:pointer;font-family:var(--tl-font)'
  reset.addEventListener('click', () => {
    capturing = null
    resetKeybinds()
  })
  wrap.appendChild(reset)

  // Tasten-Erfassung in der Capture-Phase → fängt VOR dem Spiel-Input ab, damit die gedrückte
  // Taste nur belegt und nicht zugleich eine Aktion auslöst.
  function onCapture(e: KeyboardEvent): void {
    if (capturing === null) return
    e.preventDefault()
    e.stopImmediatePropagation()
    const k = e.key.toLowerCase()
    if (k === 'escape') {
      capturing = null
      refresh()
      return
    }
    if (isReservedKey(k)) return // reservierte Taste (WASD/Space/Esc/Modifier) ignorieren
    setKey(capturing, e.key)
    capturing = null
    refresh()
  }
  window.addEventListener('keydown', onCapture, { capture: true })

  const off = onKeybindsChange(refresh)

  return {
    element: wrap,
    cancelCapture(): void {
      if (capturing !== null) {
        capturing = null
        refresh()
      }
    },
    destroy(): void {
      window.removeEventListener('keydown', onCapture, { capture: true })
      off()
    },
  }
}
