/**
 * Kontext-Menü — Popup am Cursor bei Rechtsklick (ohne Drag) auf ein Tile.
 *
 * Liest den GameState read-only und emittiert Intents:
 *  - Eigenes leeres Tile → vier Gebäudetypen mit Kosten + Leistbarkeit.
 *  - Eigenes bebautes Tile → Upgrade-Option.
 *  - Tile eines lebenden Gegners → Diplomatie (Allianz / Embargo).
 *  - Neutrales Tile → kein Menü.
 *
 * Bewusst ein anliegendes Panel statt eines echten Radialkranzes: Kosten und
 * Leistbarkeit pro Option müssen lesbar danebenstehen, das schlägt Optik.
 */

import {
  BUILDING_LABEL,
  BUILDING_TYPES,
  CITY_CAP_BONUS,
  DEFENSE_MAG_MULTIPLIER,
  MARKET_GOLD_PER_TICK,
  MAX_BUILDING_LEVEL,
  buildCost,
  upgradeCost,
  type BuildingType,
} from '../core/buildings'
import { countBuildingsOfType, nearWater, type GameState } from '../core/game'
import { areAllied, directedKey, hasAllianceRequest } from '../core/diplomacy'
import type { Intent } from '../core/intent'
import { getOwner } from '../world/map'
import { rgbaToCss } from './colors'

const BUILDING_GLYPH: Record<BuildingType, string> = {
  city: 'C',
  defense: 'D',
  market: '$',
  port: 'P',
}

/** Kurzbeschreibung pro Typ mit konkretem Effektwert (pro Stufe). */
const BUILDING_HINT: Record<BuildingType, string> = {
  city: `+${fmtCompact(CITY_CAP_BONUS)} Truppen-Cap/Stufe`,
  defense: `Eroberung bis ${DEFENSE_MAG_MULTIPLIER.toString()}× teurer`,
  market: `+${fmtCompact(MARKET_GOLD_PER_TICK * 10)} Gold/s/Stufe`,
  port: 'Voraussetzung für Schiffe',
}

function fmtCompact(value: number): string {
  const v = Math.round(value)
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(v)
}

export interface BuildMenuApi {
  /** Öffnet das Menü für `tile` an der Screen-Position (CSS-Pixel, container-relativ). */
  open(tile: number, screenX: number, screenY: number): void
  close(): void
  isOpen(): boolean
  destroy(): void
}

export function createBuildMenu(
  container: HTMLElement,
  state: GameState,
  humanPlayerId: number,
  emit: (intent: Intent) => void,
): BuildMenuApi {
  // Klick-Fänger im Hintergrund: schließt das Menü bei Klick daneben.
  const backdrop = document.createElement('div')
  backdrop.style.cssText = ['position: absolute', 'inset: 0', 'z-index: 24', 'display: none'].join(
    ';',
  )
  backdrop.addEventListener('mousedown', (e) => {
    e.stopPropagation()
    close()
  })
  backdrop.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    close()
  })

  const panel = document.createElement('div')
  panel.style.cssText = [
    'position: absolute',
    'min-width: 200px',
    'background: rgba(12,14,20,0.92)',
    'color: white',
    'padding: 6px',
    'border-radius: 8px',
    'border: 1px solid rgba(255,255,255,0.12)',
    'box-shadow: 0 6px 24px rgba(0,0,0,0.5)',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 12px',
    'z-index: 25',
    'display: none',
  ].join(';')
  panel.addEventListener('mousedown', (e) => {
    e.stopPropagation()
  })
  panel.addEventListener('contextmenu', (e) => {
    e.preventDefault()
  })

  container.appendChild(backdrop)
  container.appendChild(panel)

  let open_ = false

  function makeRow(
    glyph: string,
    title: string,
    subtitle: string,
    costText: string,
    affordable: boolean,
    enabled: boolean,
    onClick: () => void,
  ): HTMLElement {
    const row = document.createElement('button')
    row.disabled = !enabled
    const dim = !enabled || !affordable
    row.style.cssText = [
      'display: flex',
      'align-items: center',
      'gap: 8px',
      'width: 100%',
      'text-align: left',
      'background: transparent',
      'border: none',
      'border-radius: 6px',
      'padding: 7px 8px',
      'color: white',
      'font: inherit',
      `opacity: ${dim ? '0.4' : '1'}`,
      enabled ? 'cursor: pointer' : 'cursor: not-allowed',
    ].join(';')
    if (enabled) {
      row.addEventListener('mouseenter', () => {
        row.style.background = 'rgba(255,255,255,0.10)'
      })
      row.addEventListener('mouseleave', () => {
        row.style.background = 'transparent'
      })
      row.addEventListener('click', (e) => {
        e.stopPropagation()
        onClick()
      })
    }

    const glyphEl = document.createElement('span')
    glyphEl.textContent = glyph
    glyphEl.style.cssText = [
      'flex: 0 0 22px',
      'height: 22px',
      'line-height: 22px',
      'text-align: center',
      'font-weight: bold',
      'border-radius: 4px',
      'background: rgba(255,255,255,0.10)',
    ].join(';')

    const textWrap = document.createElement('div')
    textWrap.style.cssText = 'flex: 1; min-width: 0'
    const titleEl = document.createElement('div')
    titleEl.textContent = title
    const subEl = document.createElement('div')
    subEl.textContent = subtitle
    subEl.style.cssText = 'opacity: 0.6; font-size: 10px'
    textWrap.appendChild(titleEl)
    textWrap.appendChild(subEl)

    const costEl = document.createElement('span')
    costEl.textContent = costText
    costEl.style.cssText = [
      'flex: 0 0 auto',
      'font-weight: bold',
      affordable ? 'color: #e8c14a' : 'color: #d66',
    ].join(';')

    row.appendChild(glyphEl)
    row.appendChild(textWrap)
    row.appendChild(costEl)
    return row
  }

  function header(text: string): HTMLElement {
    const h = document.createElement('div')
    h.textContent = text
    h.style.cssText = 'opacity: 0.6; padding: 4px 8px 6px; font-size: 11px'
    return h
  }

  /** Befüllt das Panel mit Diplomatie-Optionen gegenüber einem fremden Spieler. */
  function fillDiplomacy(targetId: number): void {
    const other = state.players.get(targetId)
    if (other === undefined) return
    panel.appendChild(header(other.name))

    const allied = areAllied(state.alliances, humanPlayerId, targetId)
    const theyRequested = hasAllianceRequest(state.allianceRequests, targetId, humanPlayerId)
    const weRequested = hasAllianceRequest(state.allianceRequests, humanPlayerId, targetId)

    if (allied) {
      panel.appendChild(
        makeRow('!', 'Allianz brechen', 'Verrat → 300 Ticks geächtet', '', true, true, () => {
          emit({ type: 'break-alliance', playerId: humanPlayerId, targetPlayerId: targetId })
          close()
        }),
      )
    } else if (theyRequested) {
      panel.appendChild(
        makeRow('A', 'Allianz annehmen', `${other.name} bietet ein Bündnis`, '', true, true, () => {
          emit({ type: 'accept-alliance', playerId: humanPlayerId, targetPlayerId: targetId })
          close()
        }),
      )
    } else if (weRequested) {
      panel.appendChild(
        makeRow('A', 'Anfrage gesendet …', 'wartet auf Antwort', '', true, false, () => {}),
      )
    } else {
      panel.appendChild(
        makeRow('A', 'Allianz anfragen', '', '', true, true, () => {
          emit({ type: 'request-alliance', playerId: humanPlayerId, targetPlayerId: targetId })
          close()
        }),
      )
    }

    const embargoed = state.embargoes.has(directedKey(humanPlayerId, targetId))
    panel.appendChild(
      makeRow(
        'E',
        embargoed ? 'Embargo aufheben' : 'Embargo verhängen',
        embargoed ? 'Handel wieder erlauben' : 'stoppt den Handel',
        '',
        true,
        true,
        () => {
          emit({
            type: 'set-embargo',
            playerId: humanPlayerId,
            targetPlayerId: targetId,
            enabled: !embargoed,
          })
          close()
        },
      ),
    )
  }

  function open(tile: number, screenX: number, screenY: number): void {
    const player = state.players.get(humanPlayerId)
    if (player === undefined || !player.isAlive) return

    const owner = getOwner(state.map, tile)
    // Fremdes Tile eines lebenden Spielers → Diplomatie; neutrales Tile → nichts.
    if (owner !== humanPlayerId) {
      const other = owner > 0 ? state.players.get(owner) : undefined
      if (other === undefined || !other.isAlive) {
        close()
        return
      }
      panel.textContent = ''
      fillDiplomacy(owner)
      panel.style.borderColor = rgbaToCss(other.color)
      backdrop.style.display = 'block'
      panel.style.display = 'block'
      open_ = true
      positionPanel(screenX, screenY)
      return
    }

    panel.textContent = ''
    const existing = state.buildings.get(tile)

    if (existing !== undefined) {
      // Bebautes Tile → Upgrade-Option
      panel.appendChild(
        header(`${BUILDING_LABEL[existing.type]} · Level ${String(existing.level)}`),
      )
      if (existing.level >= MAX_BUILDING_LEVEL) {
        const max = document.createElement('div')
        max.textContent = 'Maximale Stufe erreicht'
        max.style.cssText = 'opacity: 0.6; padding: 7px 8px'
        panel.appendChild(max)
      } else {
        const cost = upgradeCost(existing.type, existing.level)
        const affordable = player.gold >= cost
        panel.appendChild(
          makeRow(
            BUILDING_GLYPH[existing.type],
            `Upgrade → Level ${String(existing.level + 1)}`,
            BUILDING_HINT[existing.type],
            fmtCompact(cost),
            affordable,
            true,
            () => {
              emit({ type: 'upgrade', playerId: humanPlayerId, tile })
              close()
            },
          ),
        )
      }
    } else {
      // Leeres Tile → vier Bau-Optionen
      panel.appendChild(header(`Gold: ${fmtCompact(player.gold)}`))
      const portOk = nearWater(state, tile)
      for (const type of BUILDING_TYPES) {
        const cost = buildCost(type, countBuildingsOfType(state, humanPlayerId, type))
        const affordable = player.gold >= cost
        const enabled = type === 'port' ? portOk : true
        const subtitle = type === 'port' && !portOk ? 'zu weit vom Wasser' : BUILDING_HINT[type]
        panel.appendChild(
          makeRow(
            BUILDING_GLYPH[type],
            BUILDING_LABEL[type],
            subtitle,
            fmtCompact(cost),
            affordable,
            enabled,
            () => {
              emit({ type: 'build', playerId: humanPlayerId, tile, buildingType: type })
              close()
            },
          ),
        )
      }
    }

    // Akzent-Rand in Spielerfarbe
    panel.style.borderColor = rgbaToCss(player.color)
    backdrop.style.display = 'block'
    panel.style.display = 'block'
    open_ = true
    positionPanel(screenX, screenY)
  }

  /** Platziert das Panel am Cursor, hält es aber im Container. */
  function positionPanel(screenX: number, screenY: number): void {
    const cw = container.clientWidth
    const ch = container.clientHeight
    const pw = panel.offsetWidth
    const ph = panel.offsetHeight
    const left = Math.min(screenX, cw - pw - 8)
    const top = Math.min(screenY, ch - ph - 8)
    panel.style.left = `${String(Math.max(8, left))}px`
    panel.style.top = `${String(Math.max(8, top))}px`
  }

  function close(): void {
    if (!open_) return
    open_ = false
    panel.style.display = 'none'
    backdrop.style.display = 'none'
  }

  return {
    open,
    close,
    isOpen(): boolean {
      return open_
    },
    destroy(): void {
      panel.remove()
      backdrop.remove()
    },
  }
}
