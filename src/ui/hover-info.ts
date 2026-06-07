/**
 * Festes Hover-Info-Panel. Anders als der mitwandernde Cursor-Tooltip ({@link ./hover-tooltip.ts})
 * sitzt dieses Panel fest im HUD und zeigt dauerhaft — in voller Tiefe — die Infos zum Objekt/Tile
 * unter dem Mauszeiger: Besitzer-Nation (mit Farbpunkt), Truppen/Cap/%, Ø pro Tile, Beziehung
 * (Gunst/Groll), Allianz-Countdown, Verräter, Gold-Beute, Angriffs-Chip, Gebäude-Effekt +
 * Upgrade-Vorschau, sowie Schiffe (Boot/Handels-/Kriegsschiff). Inhalt + Werte kommen aus dem
 * gemeinsamen Resolver ({@link ./hover-content.ts}) → garantiert identisch zum Tooltip.
 *
 * Ohne gültiges Tile (Cursor nicht über der Karte) bleibt das Panel sichtbar und zeigt einen
 * dezenten Leerzustand — es springt nie.
 *
 * Sichtbarkeit: kombiniert den Hover-Modus ({@link ./hover-mode.ts}; im Modus „tooltip" aus) mit
 * dem HUD-Editor-Status (`getPanel(...).hidden`) — beide leiten aus derselben Quelle ab, kein Fight.
 *
 * Als HUD-Panel (`hover-info`) registriert → über den HUD-Editor verschieb-/skalier-/ausblendbar
 * (ADR-0024). Reine Anzeige: liest den (Schatten-)GameState read-only, mutiert nur DOM. Kein
 * Sim-/State-Hash-Einfluss, multiplayer-sicher.
 */

import { type GameState } from '../core/game'
import { t } from '../i18n'
import { panelStyle } from './theme'
import { getPanel, registerPanel, unregisterPanel } from './hud-layout'
import { registerScalable } from './ui-scale'
import { resolveHover, titleHtml, bodyHtml, type HoverHighlight } from './hover-content'
import { getHoverMode, type HoverMode } from './hover-mode'

/** Eindeutige, stabile Panel-ID fürs Layout-/Editor-System. */
export const HOVER_INFO_PANEL_ID = 'hover-info'

export interface HoverInfoApi {
  /**
   * Aktualisiert das Panel auf die Welt-Position unter dem Cursor (oder `null` → Leerzustand).
   * `zoom` steuert den Snap-Radius (identisch zum Tooltip). Gibt das gehoverte (gesnappte) Objekt
   * zurück, damit der Aufrufer im Modus „panel" den Renderer-Ring setzen kann.
   */
  update(
    hover: { readonly worldX: number; readonly worldY: number } | null,
    zoom: number,
  ): HoverHighlight | null
  /** Modus setzen (steuert die Panel-Sichtbarkeit zusammen mit dem HUD-Editor-Status). */
  setMode(mode: HoverMode): void
  destroy(): void
}

export function createHoverInfo(
  container: HTMLElement,
  state: GameState,
  /** Spieler-ID des lokalen Menschen — eigene Tiles werden als „Du" beschriftet. */
  humanId: number,
  /** Truppenzahl, die ein Linksklick gerade losschicken würde (für den Angriffs-Chip). */
  getAttackTroops: () => number,
): HoverInfoApi {
  const box = document.createElement('div')
  box.style.cssText = panelStyle([
    'position: absolute',
    // Linke Spalte, unter dem Info-/Steuerungs-Kasten (top:52). Verschiebbar (HUD-Editor).
    'top: 128px',
    'left: 12px',
    'width: 200px',
    'box-sizing: border-box',
    'padding: 8px 11px',
    'font-size: 12px',
    'line-height: 1.45',
    // Fixe Mindesthöhe → das Panel kollabiert im Leerzustand nicht / springt nicht.
    'min-height: 86px',
    'pointer-events: auto',
    'z-index: 11',
  ])

  // Titelzeile (dezent) — kennzeichnet, worauf sich das Panel bezieht.
  const captionEl = document.createElement('div')
  captionEl.textContent = t('hover.title')
  captionEl.style.cssText =
    'font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--tl-text-dim); margin-bottom: 5px'
  box.appendChild(captionEl)

  // Leerzustand (kein gültiges Tile unter dem Cursor).
  const emptyEl = document.createElement('div')
  emptyEl.textContent = t('hover.empty')
  emptyEl.style.cssText = 'color: var(--tl-text-faint); font-size: 11px'
  box.appendChild(emptyEl)

  // Inhalt: Kopfzeile (Farbpunkt + Name + Level/Status) + Detailzeilen.
  const contentEl = document.createElement('div')
  contentEl.style.cssText = 'display: none'
  const headEl = document.createElement('div')
  headEl.style.cssText = 'margin-bottom: 3px'
  const detailEl = document.createElement('div')
  detailEl.style.cssText = 'font-size: 11px'
  contentEl.appendChild(headEl)
  contentEl.appendChild(detailEl)
  box.appendChild(contentEl)

  container.appendChild(box)
  registerScalable(box)
  registerPanel(HOVER_INFO_PANEL_ID, box)

  let mode: HoverMode = getHoverMode()
  /** Letzte gerenderte Signatur — DOM-Schreiber nur bei echter Änderung (Frame-schonend). */
  let lastSig = ''
  /** Throttle: Schlüssel aus Tile + Zoom — Resolver nur bei Wechsel (oder Zeit-Refresh) neu. */
  let lastKey = ''
  let lastHighlight: HoverHighlight | null = null
  let frame = 0

  /** Soll das Panel sichtbar sein? (Modus ≠ tooltip UND nicht per HUD-Editor ausgeblendet). */
  function visible(): boolean {
    if (mode === 'tooltip') return false
    return getPanel(HOVER_INFO_PANEL_ID)?.hidden !== true
  }

  /** Display aus Modus + Layout-Status ableiten (gleiche Quelle wie der HUD-Editor → kein Fight). */
  function applyDisplay(): void {
    if (mode === 'tooltip') box.style.display = 'none'
    // sonst überlässt das Panel das Ein-/Ausblenden dem Layout-System (HUD-Editor).
    else if (getPanel(HOVER_INFO_PANEL_ID)?.hidden !== true) box.style.removeProperty('display')
  }

  function setMode(next: HoverMode): void {
    if (next === mode) return
    mode = next
    applyDisplay()
    // Bei Re-Aktivierung neu rendern erzwingen.
    lastKey = ''
    lastSig = ''
  }

  function update(
    hover: { readonly worldX: number; readonly worldY: number } | null,
    zoom: number,
  ): HoverHighlight | null {
    applyDisplay()
    if (!visible()) {
      lastHighlight = null
      return null
    }

    if (hover === null) {
      if (lastSig !== 'empty') {
        lastSig = 'empty'
        lastKey = ''
        emptyEl.style.display = ''
        contentEl.style.display = 'none'
      }
      lastHighlight = null
      return null
    }

    frame++
    // Resolver nur bei Tile-/Zoom-Wechsel neu laufen lassen — plus ~alle 0.5 s für zeitabhängige
    // Werte (Gold/s, Allianz-Countdown, Angriffs-Chip). Schont die Frames (läuft im renderLoop).
    const key = `${Math.floor(hover.worldX)},${Math.floor(hover.worldY)},${Math.round(zoom * 4)}`
    const timeRefresh = frame % 30 === 0
    if (key === lastKey && !timeRefresh) return lastHighlight
    lastKey = key

    const subject = resolveHover(state, humanId, {
      worldX: hover.worldX,
      worldY: hover.worldY,
      zoom,
      getAttackTroops,
    })
    lastHighlight = subject.highlight

    if (subject.signature === lastSig) return lastHighlight
    lastSig = subject.signature

    emptyEl.style.display = 'none'
    contentEl.style.display = ''
    headEl.innerHTML = titleHtml(subject, { dot: true })
    const body = bodyHtml(subject)
    detailEl.innerHTML = body
    detailEl.style.display = body === '' ? 'none' : ''
    return lastHighlight
  }

  return {
    update,
    setMode,
    destroy(): void {
      unregisterPanel(HOVER_INFO_PANEL_ID)
      box.remove()
    },
  }
}
