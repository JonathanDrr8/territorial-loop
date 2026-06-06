/**
 * Festes Hover-Info-Panel. Anders als der mitwandernde Cursor-Tooltip (hover-tooltip.ts) sitzt
 * dieses Panel fest im HUD und zeigt dauerhaft die Infos zum Tile unter dem Mauszeiger:
 *  - Besitzer-Nation (Anzeigename + Farbpunkt in Nationsfarbe), sonst „neutrales Land"/Wasser.
 *  - Truppen der besitzenden Nation (kompakt, wie sonst im HUD).
 *  - Gebäude auf dem Tile (falls vorhanden): Typ + Level.
 * Ohne gültiges Tile (Cursor nicht über der Karte) bleibt es sichtbar und zeigt einen dezenten
 * Leerzustand — das Panel springt nie.
 *
 * Als HUD-Panel (`hover-info`) registriert → über den HUD-Editor verschieb-/skalier-/ausblendbar
 * (ADR-0024). Reine Anzeige: liest den (Schatten-)GameState read-only, mutiert nur DOM. Kein
 * Sim-/State-Hash-Einfluss, multiplayer-sicher.
 */

import { type GameState } from '../core/game'
import type { Building, BuildingType } from '../core/buildings'
import { getOwner } from '../world/map'
import { isLand } from '../world/terrain'
import { tileRef } from '../world/torus'
import { t } from '../i18n'
import { rgbaToCss } from './colors'
import { panelStyle } from './theme'
import { registerPanel, unregisterPanel } from './hud-layout'
import { registerScalable } from './ui-scale'

/** Eindeutige, stabile Panel-ID fürs Layout-/Editor-System. */
export const HOVER_INFO_PANEL_ID = 'hover-info'

export interface HoverInfoApi {
  /**
   * Aktualisiert das Panel auf die Welt-Position unter dem Cursor (oder `null`, wenn der Cursor
   * nicht über der Karte ist → Leerzustand). Pro Frame aufrufbar; liest live aus dem State.
   */
  update(hover: { readonly worldX: number; readonly worldY: number } | null): void
  destroy(): void
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  )
}

/** Kompaktes Zahlenformat (wie sonst im HUD): 1234567 → "1.2M", 12345 → "12k", 842 → "842". */
function fmtCompact(value: number): string {
  const v = Math.round(value)
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(v)
}

/** Übersetzter Anzeige-Name eines Gebäudetyps. */
function buildingLabel(type: BuildingType): string {
  return t(`building.${type}`)
}

export function createHoverInfo(
  container: HTMLElement,
  state: GameState,
  /** Spieler-ID des lokalen Menschen — eigene Tiles werden als „Du" beschriftet. */
  humanId: number,
): HoverInfoApi {
  const box = document.createElement('div')
  box.style.cssText = panelStyle([
    'position: absolute',
    // Linke Spalte, unter dem Info-/Steuerungs-Kasten (top:52). Verschiebbar (HUD-Editor).
    'top: 128px',
    'left: 12px',
    'width: 196px',
    'box-sizing: border-box',
    'padding: 8px 11px',
    'font-size: 12px',
    'line-height: 1.4',
    // Fixe Mindesthöhe → das Panel kollabiert im Leerzustand nicht / springt nicht.
    'min-height: 86px',
    'pointer-events: auto',
    'z-index: 11',
  ])

  // Titelzeile (dezent) — kennzeichnet, worauf sich das Panel bezieht.
  const titleEl = document.createElement('div')
  titleEl.textContent = t('hover.title')
  titleEl.style.cssText =
    'font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--tl-text-dim); margin-bottom: 5px'
  box.appendChild(titleEl)

  // Leerzustand (kein gültiges Tile unter dem Cursor).
  const emptyEl = document.createElement('div')
  emptyEl.textContent = t('hover.empty')
  emptyEl.style.cssText = 'color: var(--tl-text-faint); font-size: 11px'
  box.appendChild(emptyEl)

  // Detail-Block (Besitzer + Truppen + Gebäude).
  const detailEl = document.createElement('div')
  detailEl.style.cssText = 'display: none; flex-direction: column; gap: 4px'

  // Besitzer-Zeile: Farbpunkt + Name (fett).
  const ownerEl = document.createElement('div')
  ownerEl.style.cssText = 'display: flex; align-items: center; gap: 7px; font-weight: bold'
  detailEl.appendChild(ownerEl)

  const makeRow = (): { row: HTMLElement; label: HTMLElement; value: HTMLElement } => {
    const row = document.createElement('div')
    row.style.cssText = 'display: flex; align-items: baseline; gap: 8px; font-size: 11px'
    const label = document.createElement('span')
    label.style.cssText = 'color: var(--tl-text-dim); flex: 0 0 auto'
    const value = document.createElement('span')
    value.style.cssText = 'margin-left: auto; text-align: right; font-variant-numeric: tabular-nums'
    row.appendChild(label)
    row.appendChild(value)
    return { row, label, value }
  }

  const troops = makeRow()
  troops.label.textContent = t('hud.troops')
  detailEl.appendChild(troops.row)

  const building = makeRow()
  building.label.textContent = t('hover.building')
  detailEl.appendChild(building.row)

  box.appendChild(detailEl)
  container.appendChild(box)
  registerScalable(box)
  registerPanel(HOVER_INFO_PANEL_ID, box)

  // Kleiner Farbpunkt in Nationsfarbe (für neutrale Tiles ein dezenter Grau-Punkt).
  const dot = (color: number | null): string => {
    const bg = color === null ? 'var(--tl-text-faint)' : rgbaToCss(color)
    return `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${bg};box-shadow:0 0 0 1px rgba(0,0,0,0.35)"></span>`
  }

  /** Letzte gerenderte Signatur — DOM-Schreiber nur bei echter Änderung (Frame-schonend). */
  let lastSig = ''

  function update(hover: { readonly worldX: number; readonly worldY: number } | null): void {
    if (hover === null) {
      if (lastSig === '') return
      lastSig = ''
      emptyEl.style.display = ''
      detailEl.style.display = 'none'
      return
    }

    const w = state.map.width
    const h = state.map.height
    const ref = tileRef(Math.floor(hover.worldX), Math.floor(hover.worldY), w, h)
    const land = isLand(state.map.terrain, ref)
    const owner = getOwner(state.map, ref)
    const b: Building | undefined = state.buildings.get(ref)

    // Besitzer-Anzeige bestimmen.
    let ownerColor: number | null = null
    let ownerName: string
    let troopsText: string | null = null
    if (!land) {
      ownerName = t('hover.water')
    } else if (owner === 0) {
      ownerName = t('tip.neutralLand')
    } else {
      const player = state.players.get(owner)
      if (player === undefined) {
        ownerName = t('tip.neutralLand')
      } else {
        ownerColor = player.color
        ownerName = owner === humanId ? t('tip.you') : player.wild ? t('nation.wild') : player.name
        troopsText = fmtCompact(player.troops)
      }
    }

    const buildingText =
      b !== undefined ? `${buildingLabel(b.type)} · ${t('tip.lvl')} ${String(b.level)}` : null

    // Signatur → nur bei Änderung neu schreiben.
    const sig = `${String(ownerColor)}|${ownerName}|${troopsText ?? ''}|${buildingText ?? ''}`
    if (sig === lastSig) return
    lastSig = sig

    emptyEl.style.display = 'none'
    detailEl.style.display = 'flex'

    ownerEl.innerHTML = `${dot(ownerColor)}<span>${escapeHtml(ownerName)}</span>`

    if (troopsText === null) {
      troops.row.style.display = 'none'
    } else {
      troops.row.style.display = 'flex'
      troops.value.textContent = troopsText
    }

    if (buildingText === null) {
      building.row.style.display = 'none'
    } else {
      building.row.style.display = 'flex'
      building.value.textContent = buildingText
    }
  }

  return {
    update,
    destroy(): void {
      unregisterPanel(HOVER_INFO_PANEL_ID)
      box.remove()
    },
  }
}
