/**
 * Hover-Tooltip: mitwandernde Cursor-Notiz mit den Stats des Objekts/Tiles unter der Maus.
 *
 * Dünner Renderer über dem gemeinsamen Resolver ({@link ./hover-content.ts}) — die WAS-Logik
 * (Schiff/Gebäude/Nation/…) und die Werte stecken dort, damit Tooltip und festes Panel
 * ({@link ./hover-info.ts}) garantiert dasselbe zeigen.
 *
 * Unsichtbar wenn der Cursor über eigenem Gebiet (ohne Gebäude/Schiff) ist — eigene Truppen
 * stehen im HUD. `pointer-events: none`, damit der Tooltip nie Klicks abfängt.
 */

import { type GameState } from '../core/game'
import { resolveHover, subjectHtml, type HoverHighlight } from './hover-content'

export type { HoverHighlight } from './hover-content'

export interface HoverTooltipApi {
  /** Zeigt den Tooltip; `zoom` steuert den (zoom-abhängigen) Snap-Radius beim Picken. */
  show(worldX: number, worldY: number, screenX: number, screenY: number, zoom: number): void
  hide(): void
  destroy(): void
}

export function createHoverTooltip(
  container: HTMLElement,
  state: GameState,
  humanId: number,
  /** Truppenzahl, die ein Linksklick gerade losschicken würde (Slider-% der freien Truppen). */
  getAttackTroops: () => number,
  /** Meldet das gehoverte (gesnappte) Objekt zum Markieren — `null` = nichts/Land. */
  onHoverObject: (h: HoverHighlight | null) => void,
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

  // Letzte Hover-Parameter — für die periodische Auffrischung (Countdown/Truppen/Gold ticken
  // live weiter, auch wenn die Maus stillsteht und kein neues mousemove kommt).
  let lastArgs: [number, number, number, number, number] | null = null

  function show(
    worldX: number,
    worldY: number,
    screenX: number,
    screenY: number,
    zoom: number,
  ): void {
    lastArgs = [worldX, worldY, screenX, screenY, zoom]
    const subject = resolveHover(state, humanId, { worldX, worldY, zoom, getAttackTroops })
    onHoverObject(subject.highlight)

    // Über eigenem Gebiet (ohne Gebäude/Schiff) zeigt der Cursor-Tooltip nichts.
    if (subject.kind === 'own') {
      hide()
      return
    }

    tooltip.innerHTML = subjectHtml(subject)
    tooltip.style.display = 'block'
    tooltip.style.left = String(screenX + 14) + 'px'
    tooltip.style.top = String(screenY + 14) + 'px'
  }

  function hide(): void {
    tooltip.style.display = 'none'
    lastArgs = null
    onHoverObject(null)
  }

  // Solange der Tooltip sichtbar ist, regelmäßig aus dem Live-State neu rendern (zeitabhängige
  // Werte wie der Allianz-Countdown aktualisieren sich sonst erst beim nächsten Mausmove).
  const refreshTimer = window.setInterval(() => {
    if (lastArgs !== null && tooltip.style.display !== 'none') show(...lastArgs)
  }, 500)

  return {
    show,
    hide,
    destroy(): void {
      window.clearInterval(refreshTimer)
      tooltip.remove()
    },
  }
}
