/**
 * Ereignislog — als Karte in der gemeinsamen Feed-Spalte unten rechts (über der Minimap, unter
 * den Bündnis-Anfragen). Zeigt die letzten Spiel-Ereignisse (Diplomatie, Krieg/Schiffe,
 * Wirtschaft/Beute, Meilensteine) **neueste oben**; ältere Einträge faden mit zunehmendem
 * Tick-Alter aus. Über die Filter-Chips im Kopf lässt sich pro Kategorie ausblenden, damit nicht
 * „alles" kommt (Auswahl in localStorage gemerkt). Meilensteine (Eliminierung/Sieg) bleiben immer
 * sichtbar.
 *
 * Positioniert wird NICHT mehr selbst — der Aufrufer steckt die Box in die Feed-Spalte (`container`
 * ist diese Spalte, sie trägt auch das `zoom`/`registerScalable`).
 *
 * Liest `state.events` (vom Core befüllt, sprach-neutral als {key, params}) read-only.
 */

import type { GameState } from '../core/game'
import { t } from '../i18n'
import { rgbaToCss } from './colors'

export interface EventLogApi {
  update(): void
  destroy(): void
}

const MAX_VISIBLE = 7
const FADE_START_TICKS = 60
const FADE_END_TICKS = 300

type LogCategory = 'diplomacy' | 'war' | 'economy' | 'status'

// Zuordnung Ereignis-Key (ohne `event.`-Präfix) → Kategorie. Was nicht gelistet ist, gilt als
// Meilenstein ('status') und ist immer sichtbar (eliminated/victory).
const DIPLOMACY = new Set([
  'allianceExpired',
  'breakTraitor',
  'betray',
  'allied',
  'allianceOffer',
  'allianceDecline',
  'embargoOn',
  'embargoOff',
])
const WAR = new Set([
  'boatAttack',
  'boatSent',
  'boatLand',
  'defend',
  'warshipSent',
  'boatSunk',
  'warshipSunk',
  'tradeBlocked',
  'warshipNeutralSpare',
  'warshipNeutralAll',
  'warshipHold',
  'warshipPatrol',
  'warshipLimit',
  'warshipNoGold',
  'warshipNoRoute',
  'noCoast',
  'noWaterway',
])
const ECONOMY = new Set([
  'loot',
  'lootWild',
  'annex',
  'annexLoot',
  'tradeMode.random',
  'tradeMode.nearest',
  'tradeMode.farthest',
  'tradeMode.allies',
])

function categoryOf(key: string): LogCategory {
  const suffix = key.startsWith('event.') ? key.slice(6) : key
  if (DIPLOMACY.has(suffix)) return 'diplomacy'
  if (WAR.has(suffix)) return 'war'
  if (ECONOMY.has(suffix)) return 'economy'
  return 'status'
}

const FILTER_KEY = 'territorial-loop:log-filter:v1'
const FILTERABLE = ['diplomacy', 'war', 'economy'] as const

function loadFilter(): Record<LogCategory, boolean> {
  const on: Record<LogCategory, boolean> = {
    diplomacy: true,
    war: true,
    economy: true,
    status: true,
  }
  try {
    const raw = window.localStorage.getItem(FILTER_KEY)
    if (raw !== null) {
      const saved = JSON.parse(raw) as Partial<Record<LogCategory, boolean>>
      for (const c of FILTERABLE) if (typeof saved[c] === 'boolean') on[c] = saved[c]
    }
  } catch {
    /* ignore */
  }
  return on
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  )
}

export function createEventLog(container: HTMLElement, state: GameState): EventLogApi {
  const filter = loadFilter()

  const box = document.createElement('div')
  box.style.cssText = [
    // In-Flow-Karte in der Feed-Spalte (kein eigenes absolutes Anker mehr).
    'width: 100%',
    'box-sizing: border-box',
    // Der Log ist der nachgebende Teil der Spalte: schrumpft, wenn oben Bündnis-Karten Platz
    // brauchen. Da er ganz unten sitzt (über der Minimap), läuft er wie ein Chat: neueste Einträge
    // UNTEN, Filter-Knöpfe ganz unten. `justify-content: flex-end` heftet den Inhalt an die Unterkante
    // → bei Platzmangel werden die ÄLTESTEN (oben, eh am stärksten ausgefadet) oben abgeschnitten.
    'flex: 0 1 auto',
    'min-height: 0',
    'overflow: hidden',
    // Deckende Box, damit die Einträge über jeder Karte gut lesbar sind.
    'background: rgba(12,14,20,0.92)',
    'border: 1px solid rgba(255,255,255,0.12)',
    'border-radius: 8px',
    'box-shadow: 0 4px 16px rgba(0,0,0,0.4)',
    'padding: 6px',
    'display: flex',
    'flex-direction: column',
    'justify-content: flex-end',
    'gap: 5px',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 12px',
    'pointer-events: auto',
  ].join(';')

  // Filter-Kopf: ein Chip je Kategorie (an/aus). Farbe markiert die Kategorie wieder.
  const head = document.createElement('div')
  head.style.cssText = 'display: flex; gap: 4px; justify-content: flex-end'
  const CHIP_COLOR: Record<(typeof FILTERABLE)[number], string> = {
    diplomacy: '#5adc78',
    war: '#e8736b',
    economy: '#e8c14a',
  }
  const chipLabel: Record<(typeof FILTERABLE)[number], string> = {
    diplomacy: 'log.diplomacy',
    war: 'log.war',
    economy: 'log.economy',
  }
  for (const cat of FILTERABLE) {
    const chip = document.createElement('button')
    chip.textContent = t(chipLabel[cat])
    const refresh = (): void => {
      const on = filter[cat]
      chip.style.cssText = [
        'font: inherit',
        'font-size: 10px',
        'cursor: pointer',
        'padding: 2px 7px',
        'border-radius: 10px',
        `border: 1px solid ${on ? CHIP_COLOR[cat] : 'rgba(255,255,255,0.2)'}`,
        `background: ${on ? CHIP_COLOR[cat] + '33' : 'transparent'}`,
        `color: ${on ? CHIP_COLOR[cat] : 'rgba(255,255,255,0.45)'}`,
        on ? '' : 'text-decoration: line-through',
      ].join(';')
    }
    chip.addEventListener('click', () => {
      filter[cat] = !filter[cat]
      refresh()
      try {
        window.localStorage.setItem(FILTER_KEY, JSON.stringify(filter))
      } catch {
        /* ignore */
      }
      update()
    })
    refresh()
    head.appendChild(chip)
  }

  const list = document.createElement('div')
  list.style.cssText = 'display: flex; flex-direction: column; gap: 3px; pointer-events: none'
  // Reihenfolge im Karten-Flow: Einträge OBEN (älteste oben, neueste unten), Filter-Knöpfe UNTEN.
  box.appendChild(list)
  box.appendChild(head)

  container.appendChild(box)

  function update(): void {
    const events = state.events
    const html: string[] = []
    // Von hinten (neueste zuerst) nach vorne, bis MAX_VISIBLE sichtbare gesammelt sind.
    for (let i = events.length - 1; i >= 0 && html.length < MAX_VISIBLE; i--) {
      const e = events[i]
      if (e === undefined) continue
      const cat = categoryOf(e.key)
      if (cat !== 'status' && !filter[cat]) continue
      const age = state.tick - e.tick
      let opacity = 1
      if (age > FADE_START_TICKS) {
        const f = (age - FADE_START_TICKS) / (FADE_END_TICKS - FADE_START_TICKS)
        opacity = Math.max(0.55, 1 - f) // höherer Boden → auch ältere Einträge bleiben lesbar
      }
      const accent = e.color === undefined ? '#bbb' : rgbaToCss(e.color)
      // Kein eigener Hintergrund mehr (die Box deckt) — nur farbiger Rand links + dezente Trennung.
      html.push(
        `<div style="opacity:${opacity.toFixed(2)}; padding:3px 8px; border-left:3px solid ${accent}; background:rgba(255,255,255,0.04); border-radius:3px; text-align:right">${escapeHtml(t(e.key, e.params))}</div>`,
      )
    }
    // Gesammelt wurde neueste→älteste; umdrehen → älteste oben, NEUESTE UNTEN (Chat-Richtung).
    list.innerHTML = html.reverse().join('')
  }

  return {
    update,
    destroy(): void {
      box.remove()
    },
  }
}
