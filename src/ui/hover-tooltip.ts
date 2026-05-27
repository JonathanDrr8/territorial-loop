/**
 * Hover-Tooltip: zeigt beim Mouse-Over über einem fremden Territorium die
 * Stats des Eigentümers (Spielername, Truppen, %-Anteil).
 *
 * Unsichtbar wenn der Cursor:
 *  - über eigenem Gebiet ist (eigene Truppen siehst du im HUD)
 *  - während eines Drags (vom Aufrufer per show()/hide() gesteuert)
 *
 * Pointer-events: none, damit der Tooltip nie Klicks abfängt.
 */

import type { GameState } from '../core/game'
import { getOwner } from '../world/map'
import { tileRef } from '../world/torus'
import { rgbaToCss } from './colors'

export interface HoverTooltipApi {
  /** Zeigt den Tooltip an Welt-Position (in Welt-Pixeln); positioniert via Maus-Screen-Koords. */
  show(worldX: number, worldY: number, screenX: number, screenY: number): void
  hide(): void
  destroy(): void
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  )
}

export function createHoverTooltip(
  container: HTMLElement,
  state: GameState,
  humanId: number,
): HoverTooltipApi {
  const tooltip = document.createElement('div')
  tooltip.style.cssText = [
    'position: absolute',
    'background: rgba(0,0,0,0.8)',
    'color: white',
    'padding: 6px 10px',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'font-size: 12px',
    'line-height: 1.4',
    'border-radius: 4px',
    'pointer-events: none',
    'z-index: 15',
    'white-space: nowrap',
    'box-shadow: 0 2px 8px rgba(0,0,0,0.4)',
    'display: none',
  ].join(';')
  container.appendChild(tooltip)

  function show(worldX: number, worldY: number, screenX: number, screenY: number): void {
    const { width: w, height: h } = state.map
    const ref = tileRef(Math.floor(worldX), Math.floor(worldY), w, h)
    const owner = getOwner(state.map, ref)

    if (owner === humanId) {
      hide()
      return
    }

    if (owner === 0) {
      tooltip.innerHTML = '<span style="opacity: 0.7">neutrales Land</span>'
    } else {
      const player = state.players.get(owner)
      if (player === undefined) {
        hide()
        return
      }
      const totalTiles = w * h
      const pct = ((player.tilesOwned / totalTiles) * 100).toFixed(2)
      const avgPerTile = player.tilesOwned > 0 ? Math.floor(player.troops / player.tilesOwned) : 0
      const dead = player.isAlive ? '' : ' <span style="opacity:0.6">†</span>'
      tooltip.innerHTML =
        `<b style="color:${rgbaToCss(player.color)}">${escapeHtml(player.name)}</b>${dead}<br>` +
        `${player.troops.toLocaleString('de-DE')} Truppen · ${pct}%<br>` +
        `<span style="opacity:0.7">~${avgPerTile.toLocaleString('de-DE')}/Tile</span>`
    }

    tooltip.style.display = 'block'
    // Position rechts unten neben der Maus; bei Rand-Nähe könnte man clampen — im MVP ignorieren
    tooltip.style.left = String(screenX + 14) + 'px'
    tooltip.style.top = String(screenY + 14) + 'px'
  }

  function hide(): void {
    tooltip.style.display = 'none'
  }

  return {
    show,
    hide,
    destroy(): void {
      tooltip.remove()
    },
  }
}
