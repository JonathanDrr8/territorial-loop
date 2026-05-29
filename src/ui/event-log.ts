/**
 * Ereignislog oben rechts. Zeigt die letzten Spiel-Ereignisse (Eliminierung,
 * Sieg, später Allianzen/Verrat/Embargo) als kurze Liste; ältere Einträge faden
 * mit zunehmendem Tick-Alter aus.
 *
 * Liest `state.events` (vom Core befüllt) read-only.
 */

import type { GameState } from '../core/game'
import { rgbaToCss } from './colors'

export interface EventLogApi {
  update(): void
  /** Verschiebt den Log nach unten (px zusätzlich zum Basis-Top), z. B. unter das Bündnis-Panel. */
  setTopOffset(extraPx: number): void
  destroy(): void
}

/** Basis-Abstand von oben (unter der Rangliste). */
const BASE_TOP = 232

const MAX_VISIBLE = 6
const FADE_START_TICKS = 60
const FADE_END_TICKS = 300

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  )
}

export function createEventLog(container: HTMLElement, state: GameState): EventLogApi {
  const box = document.createElement('div')
  box.style.cssText = [
    'position: absolute',
    // Unter der Rangliste oben rechts (die belegt den oberen Bereich).
    `top: ${BASE_TOP}px`,
    'right: 12px',
    'max-width: 260px',
    'display: flex',
    'flex-direction: column',
    'gap: 3px',
    'align-items: flex-end',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 12px',
    'pointer-events: none',
    'z-index: 12',
    'text-align: right',
  ].join(';')
  container.appendChild(box)

  function update(): void {
    const events = state.events
    if (events.length === 0) {
      if (box.childElementCount > 0) box.textContent = ''
      return
    }
    const start = Math.max(0, events.length - MAX_VISIBLE)
    const html: string[] = []
    for (let i = start; i < events.length; i++) {
      const e = events[i]
      if (e === undefined) continue
      const age = state.tick - e.tick
      let opacity = 1
      if (age > FADE_START_TICKS) {
        const t = (age - FADE_START_TICKS) / (FADE_END_TICKS - FADE_START_TICKS)
        opacity = Math.max(0.25, 1 - t)
      }
      const accent = e.color === undefined ? '#bbb' : rgbaToCss(e.color)
      html.push(
        `<div style="opacity:${opacity.toFixed(2)}; background:rgba(0,0,0,0.5); padding:3px 8px; border-radius:4px; border-left:3px solid ${accent}">${escapeHtml(e.text)}</div>`,
      )
    }
    box.innerHTML = html.join('')
  }

  return {
    update,
    setTopOffset(extraPx: number): void {
      box.style.top = `${BASE_TOP + Math.max(0, Math.round(extraPx))}px`
    },
    destroy(): void {
      box.remove()
    },
  }
}
