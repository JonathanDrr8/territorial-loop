/**
 * Radiales Kontext-Menü — öffnet bei Rechtsklick (ohne Drag) als Kranz von Aktions-
 * Chips um den Cursor, mit einer Kontext-Info in der Mitte (aktualisiert bei Hover).
 *
 * Liest den GameState read-only und emittiert Intents, kontextabhängig vom Ziel-Tile:
 *  - Eigenes leeres Tile  → Gebäude bauen (Stadt/Verteidigung/Hafen) mit Kosten.
 *  - Eigenes bebautes Tile → Upgrade.
 *  - Gegner/Wildnis über Land → Angriff (Slider-Truppen).
 *  - Gegner/Wildnis über Wasser → Transportboot.
 *  - Lebender Gegner zusätzlich → Allianz + Embargo.
 *  - Wasser/unpassierbar → kein Menü.
 */

import {
  BUILDING_LABEL,
  BUILDING_TYPES,
  CITY_CAP_BONUS,
  DEFENSE_MAG_MULTIPLIER,
  MAX_BUILDING_LEVEL,
  isBuildingComplete,
  upgradeCost,
  type BuildingType,
} from '../core/buildings'
import { buildCostFor, canReachByLand, nearWater, type GameState } from '../core/game'
import { areAllied, directedKey, hasAllianceRequest, pairKey } from '../core/diplomacy'
import { WARSHIP_COST } from '../core/ships'
import type { Intent } from '../core/intent'
import { getOwner } from '../world/map'
import { isLand, isPassable } from '../world/terrain'
import { rgbaToCss } from './colors'

const BUILDING_GLYPH: Record<BuildingType, string> = {
  city: 'C',
  defense: 'D',
  port: 'P',
  factory: 'F',
}

/** Kurzbeschreibung pro Typ mit konkretem Effektwert (pro Stufe). */
const BUILDING_HINT: Record<BuildingType, string> = {
  city: `+${fmtCompact(CITY_CAP_BONUS)} Truppen-Cap/Stufe`,
  defense: `Eroberung bis ${DEFENSE_MAG_MULTIPLIER.toString()}× teurer`,
  port: 'Voraussetzung für Schiffe',
  factory: 'Gold übers Netzwerk (Städte/Häfen in Reichweite)',
}

const ATTACK_ACCENT = '#e8d24a'
const BOAT_ACCENT = '#46d9e6'
const ALLY_ACCENT = '#5adc78'
const HOSTILE_ACCENT = '#e86a6a'

function fmtCompact(value: number): string {
  const v = Math.round(value)
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(v)
}

/** Eine wählbare Aktion im Radialmenü. */
interface MenuAction {
  glyph: string
  label: string
  /** Detailzeile, die bei Hover in der Mitte erscheint. */
  detail: string
  /** Kosten-Text (leer = keine Kosten). */
  costText: string
  affordable: boolean
  enabled: boolean
  accent: string
  run: () => void
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
  /** Aktuelle Angriffs-/Boot-Truppenzahl (Slider-% der freien Truppen). */
  getAttackTroops: () => number,
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

  // Panel = quadratischer Rahmen, in dessen Mitte der Cursor sitzt. Selbst klick-
  // durchlässig (pointer-events: none) — nur Chips/Info fangen Klicks, der Rest
  // fällt auf den Backdrop (= schließen).
  const panel = document.createElement('div')
  panel.style.cssText = [
    'position: absolute',
    'pointer-events: none',
    'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    'z-index: 25',
    'display: none',
  ].join(';')
  container.appendChild(backdrop)
  container.appendChild(panel)

  let open_ = false

  const SVG_NS = 'http://www.w3.org/2000/svg'

  /** Punkt auf dem Kreis (Zentrum c) bei Radius r und Winkel a → "x,y". */
  function polar(c: number, r: number, a: number): string {
    return `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`
  }

  /** SVG-Pfad eines Ring-Segments (innen nicht spitz) zwischen Winkeln a0..a1, Radien rIn..rOut. */
  function sectorPath(c: number, rIn: number, rOut: number, a0: number, a1: number): string {
    const large = a1 - a0 > Math.PI ? 1 : 0
    return (
      `M ${polar(c, rIn, a0)} L ${polar(c, rOut, a0)} ` +
      `A ${String(rOut)} ${String(rOut)} 0 ${String(large)} 1 ${polar(c, rOut, a1)} ` +
      `L ${polar(c, rIn, a1)} A ${String(rIn)} ${String(rIn)} 0 ${String(large)} 0 ${polar(c, rIn, a0)} Z`
    )
  }

  /** Voller Ring (Donut) als ein klickbares Segment — für genau eine Aktion. */
  function ringPath(c: number, rIn: number, rOut: number): string {
    return (
      `M ${String(c + rOut)} ${String(c)} A ${String(rOut)} ${String(rOut)} 0 1 1 ${String(c - rOut)} ${String(c)} ` +
      `A ${String(rOut)} ${String(rOut)} 0 1 1 ${String(c + rOut)} ${String(c)} Z ` +
      `M ${String(c + rIn)} ${String(c)} A ${String(rIn)} ${String(rIn)} 0 1 0 ${String(c - rIn)} ${String(c)} ` +
      `A ${String(rIn)} ${String(rIn)} 0 1 0 ${String(c + rIn)} ${String(c)} Z`
    )
  }

  /**
   * Stellt die Aktionen als Ring aus Kuchenstücken um den Cursor dar (Cursor = Zentrum). Jedes
   * Segment ist auf ganzer Fläche klickbar → eine kleine Mausbewegung in die Richtung genügt.
   * In der Mitte sitzt ein Totbereich mit der Kontext-Info (Titel + Detailzeile bei Hover).
   */
  function renderRadial(
    actions: readonly MenuAction[],
    title: string,
    titleColor: string,
    screenX: number,
    screenY: number,
  ): void {
    panel.textContent = ''
    const n = actions.length
    const rIn = 44
    const rOut = n <= 4 ? 116 : 132
    const pad = 4
    const size = 2 * (rOut + pad)
    const c = size / 2
    panel.style.width = `${String(size)}px`
    panel.style.height = `${String(size)}px`

    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('width', String(size))
    svg.setAttribute('height', String(size))
    svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible'
    panel.appendChild(svg)

    // Mittige Kontext-Info (Titel + dynamische Detailzeile bei Hover) im Totbereich.
    const info = document.createElement('div')
    info.style.cssText = [
      'position: absolute',
      'left: 50%',
      'top: 50%',
      'transform: translate(-50%,-50%)',
      `width: ${String(rIn * 2.05)}px`,
      `height: ${String(rIn * 2.05)}px`,
      'box-sizing: border-box',
      'border-radius: 50%',
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'padding: 6px',
      'text-align: center',
      'pointer-events: none',
      'color: white',
      'background: rgba(10,12,18,0.92)',
    ].join(';')
    const titleEl = document.createElement('div')
    titleEl.textContent = title
    titleEl.style.cssText = `font-weight: bold; font-size: 11px; line-height: 1.2; color: ${titleColor}`
    const detailEl = document.createElement('div')
    detailEl.textContent = 'Aktion wählen'
    detailEl.style.cssText = 'font-size: 9px; opacity: 0.65; margin-top: 3px; line-height: 1.2'
    info.appendChild(titleEl)
    info.appendChild(detailEl)

    const gap = n > 1 ? 0.05 : 0
    const idle = 'rgba(14,16,22,0.92)'

    actions.forEach((a, i) => {
      const clickable = a.enabled && (a.costText === '' || a.affordable)
      const mid = -Math.PI / 2 + (i / n) * Math.PI * 2
      const half = Math.PI / n - gap

      const path = document.createElementNS(SVG_NS, 'path')
      path.setAttribute(
        'd',
        n === 1 ? ringPath(c, rIn, rOut) : sectorPath(c, rIn, rOut, mid - half, mid + half),
      )
      if (n === 1) path.setAttribute('fill-rule', 'evenodd')
      path.setAttribute('fill', idle)
      path.setAttribute('stroke', a.accent)
      path.setAttribute('stroke-width', '2')
      path.setAttribute('stroke-linejoin', 'round')
      path.style.cssText = [
        `pointer-events: ${clickable ? 'auto' : 'none'}`,
        `opacity: ${clickable ? '1' : '0.4'}`,
        `cursor: ${clickable ? 'pointer' : 'default'}`,
        'transition: fill 0.08s',
      ].join(';')

      path.addEventListener('mouseenter', () => {
        const head = a.costText !== '' ? `${a.label} · ${a.costText}` : a.label
        detailEl.textContent = a.detail !== '' ? `${head} — ${a.detail}` : head
        detailEl.style.opacity = '1'
        if (clickable) path.setAttribute('fill', 'rgba(40,44,54,0.97)')
      })
      path.addEventListener('mouseleave', () => {
        detailEl.textContent = 'Aktion wählen'
        detailEl.style.opacity = '0.65'
        path.setAttribute('fill', idle)
      })
      if (clickable) {
        path.addEventListener('click', (e) => {
          e.stopPropagation()
          a.run()
        })
      }
      svg.appendChild(path)

      // Glyph (+ Kosten) mittig im Segment — rein visuell, fängt keine Klicks ab.
      const gr = (rIn + rOut) / 2
      const lbl = document.createElement('div')
      lbl.style.cssText = [
        'position: absolute',
        `left: ${(c + gr * Math.cos(mid)).toFixed(1)}px`,
        `top: ${(c + gr * Math.sin(mid)).toFixed(1)}px`,
        'transform: translate(-50%,-50%)',
        'pointer-events: none',
        'text-align: center',
        'color: white',
        `opacity: ${clickable ? '1' : '0.5'}`,
      ].join(';')
      const glyphEl = document.createElement('div')
      glyphEl.textContent = a.glyph
      glyphEl.style.cssText = 'font-size: 19px; font-weight: bold; line-height: 1'
      lbl.appendChild(glyphEl)
      if (a.costText !== '') {
        const costEl = document.createElement('div')
        costEl.textContent = a.costText
        costEl.style.cssText = `font-size: 10px; font-weight: bold; margin-top: 2px; color: ${a.affordable ? '#5dd75d' : '#ef5350'}`
        lbl.appendChild(costEl)
      }
      panel.appendChild(lbl)
    })

    panel.appendChild(info)

    // Panel so platzieren, dass die Mitte am Cursor sitzt (im Container gehalten).
    const cw = container.clientWidth
    const ch = container.clientHeight
    const left = Math.max(8, Math.min(screenX - c, cw - size - 8))
    const top = Math.max(8, Math.min(screenY - c, ch - size - 8))
    panel.style.left = `${String(left)}px`
    panel.style.top = `${String(top)}px`
    backdrop.style.display = 'block'
    panel.style.display = 'block'
    open_ = true
  }

  /** Sammelt Diplomatie-Aktionen gegenüber einem lebenden fremden Spieler. */
  function diplomacyActions(targetId: number): MenuAction[] {
    const out: MenuAction[] = []
    const allied = areAllied(state.alliances, humanPlayerId, targetId)
    const theyRequested = hasAllianceRequest(state.allianceRequests, targetId, humanPlayerId)
    const weRequested = hasAllianceRequest(state.allianceRequests, humanPlayerId, targetId)

    if (allied) {
      const expiry = state.allianceExpiry.get(pairKey(humanPlayerId, targetId))
      const remainSec = expiry !== undefined ? Math.max(0, (expiry - state.tick) / 10) : 0
      const mm = Math.floor(remainSec / 60)
      const ss = Math.floor(remainSec % 60)
      out.push({
        glyph: '💔',
        label: 'Allianz brechen',
        detail: `Verrat → geächtet · läuft in ${mm.toString()}:${ss < 10 ? '0' : ''}${ss.toString()} aus`,
        costText: '',
        affordable: true,
        enabled: true,
        accent: HOSTILE_ACCENT,
        run: () => {
          emit({ type: 'break-alliance', playerId: humanPlayerId, targetPlayerId: targetId })
          close()
        },
      })
    } else if (theyRequested) {
      out.push({
        glyph: '🤝',
        label: 'Allianz annehmen',
        detail: 'bietet ein Bündnis an',
        costText: '',
        affordable: true,
        enabled: true,
        accent: ALLY_ACCENT,
        run: () => {
          emit({ type: 'accept-alliance', playerId: humanPlayerId, targetPlayerId: targetId })
          close()
        },
      })
    } else if (weRequested) {
      out.push({
        glyph: '🤝',
        label: 'Anfrage gesendet …',
        detail: 'wartet auf Antwort',
        costText: '',
        affordable: false,
        enabled: false,
        accent: ALLY_ACCENT,
        run: () => {},
      })
    } else {
      out.push({
        glyph: '🤝',
        label: 'Allianz anfragen',
        detail: 'Bündnis vorschlagen',
        costText: '',
        affordable: true,
        enabled: true,
        accent: ALLY_ACCENT,
        run: () => {
          emit({ type: 'request-alliance', playerId: humanPlayerId, targetPlayerId: targetId })
          close()
        },
      })
    }

    const embargoed = state.embargoes.has(directedKey(humanPlayerId, targetId))
    out.push({
      glyph: '⛔',
      label: embargoed ? 'Embargo aufheben' : 'Embargo verhängen',
      detail: embargoed ? 'Handel wieder erlauben' : 'stoppt den Handel',
      costText: '',
      affordable: true,
      enabled: true,
      accent: HOSTILE_ACCENT,
      run: () => {
        emit({
          type: 'set-embargo',
          playerId: humanPlayerId,
          targetPlayerId: targetId,
          enabled: !embargoed,
        })
        close()
      },
    })
    return out
  }

  function open(tile: number, screenX: number, screenY: number): void {
    const player = state.players.get(humanPlayerId)
    if (player === undefined || !player.isAlive) return

    const owner = getOwner(state.map, tile)
    const actions: MenuAction[] = []
    let title = ''
    let titleColor = rgbaToCss(player.color)

    if (owner === humanPlayerId) {
      const existing = state.buildings.get(tile)
      if (existing !== undefined) {
        title = `${BUILDING_LABEL[existing.type]} · L${String(existing.level)}`
        if (existing.level >= MAX_BUILDING_LEVEL) {
          actions.push({
            glyph: BUILDING_GLYPH[existing.type],
            label: 'Maximale Stufe',
            detail: '',
            costText: '',
            affordable: false,
            enabled: false,
            accent: titleColor,
            run: () => {},
          })
        } else {
          const cost = upgradeCost(existing.type, existing.level)
          actions.push({
            glyph: BUILDING_GLYPH[existing.type],
            label: `Upgrade → L${String(existing.level + 1)}`,
            detail: BUILDING_HINT[existing.type],
            costText: fmtCompact(cost),
            affordable: player.gold >= cost,
            enabled: true,
            accent: titleColor,
            run: () => {
              emit({ type: 'upgrade', playerId: humanPlayerId, tile })
              close()
            },
          })
        }
        // Eigener fertiger Hafen → Kriegsschiff-Modus umschalten (Ping-Pong ↔ Halten & Heilen).
        if (existing.type === 'port' && isBuildingComplete(existing, state.tick)) {
          const holding = player.warshipHold
          actions.push({
            glyph: holding ? '⚓' : '⇄',
            label: holding ? 'Schiffe: Halten & Heilen' : 'Schiffe: Ping-Pong',
            detail: 'Umschalten — gilt für alle eigenen Kriegsschiffe',
            costText: '',
            affordable: true,
            enabled: true,
            accent: '#9fb2c4',
            run: () => {
              emit({ type: 'toggle-warship-mode', playerId: humanPlayerId })
              close()
            },
          })
          // Handels-Zielwahl zyklisch umschalten (gilt für alle eigenen Häfen).
          const TRADE_MODES = ['random', 'nearest', 'farthest', 'allies'] as const
          const TRADE_LABEL: Record<(typeof TRADE_MODES)[number], string> = {
            random: 'Handel: Zufall',
            nearest: 'Handel: Nächste',
            farthest: 'Handel: Weiteste',
            allies: 'Handel: nur Verbündete',
          }
          const curMode = player.tradeMode
          const nextMode =
            TRADE_MODES[(TRADE_MODES.indexOf(curMode) + 1) % TRADE_MODES.length] ?? 'random'
          actions.push({
            glyph: '⚖',
            label: TRADE_LABEL[curMode],
            detail: `Klick → ${TRADE_LABEL[nextMode]}`,
            costText: '',
            affordable: true,
            enabled: true,
            accent: '#e8c14a',
            run: () => {
              emit({ type: 'set-trade-mode', playerId: humanPlayerId, mode: nextMode })
              close()
            },
          })
          // Kriegsschiffe: neutrale Fracht schonen ↔ alle angreifen.
          const spare = player.warshipSpareNeutral
          actions.push({
            glyph: spare ? '🛡' : '⚔',
            label: spare ? 'Schiffe: neutrale schonen' : 'Schiffe: alle angreifen',
            detail: 'Umschalten — neutrale Handelsschiffe verschonen?',
            costText: '',
            affordable: true,
            enabled: true,
            accent: '#9fb2c4',
            run: () => {
              emit({ type: 'toggle-warship-neutral', playerId: humanPlayerId })
              close()
            },
          })
        }
      } else {
        title = `Gold: ${fmtCompact(player.gold)}`
        const portOk = nearWater(state, tile)
        for (const type of BUILDING_TYPES) {
          const cost = buildCostFor(state, humanPlayerId, type)
          const enabled = type === 'port' ? portOk : true
          actions.push({
            glyph: BUILDING_GLYPH[type],
            label: BUILDING_LABEL[type],
            detail: type === 'port' && !portOk ? 'zu weit vom Wasser' : BUILDING_HINT[type],
            costText: fmtCompact(cost),
            affordable: player.gold >= cost,
            enabled,
            accent: titleColor,
            run: () => {
              emit({ type: 'build', playerId: humanPlayerId, tile, buildingType: type })
              close()
            },
          })
        }
      }
      // Rundum ausbreiten: gleichzeitig in alle angrenzende Wildnis expandieren.
      const omniTroops = getAttackTroops()
      actions.push({
        glyph: '⤢',
        label: 'Rundum ausbreiten',
        detail: `${fmtCompact(omniTroops)} Truppen in alle Richtungen`,
        costText: '',
        affordable: true,
        enabled: omniTroops > 0,
        accent: ATTACK_ACCENT,
        run: () => {
          emit({
            type: 'attack',
            playerId: humanPlayerId,
            targetTile: tile,
            troops: omniTroops,
            omni: true,
          })
          close()
        },
      })
    } else if (!isLand(state.map.terrain, tile)) {
      // Wasser-Tile → Kriegsschiff entsenden (braucht eigenen Hafen + Gold).
      title = 'Wasser'
      titleColor = 'rgba(120,200,235,0.95)'
      let hasPort = false
      for (const b of state.buildings.values()) {
        if (b.type === 'port' && b.ownerId === humanPlayerId && isBuildingComplete(b, state.tick)) {
          hasPort = true
          break
        }
      }
      actions.push({
        glyph: '⚓',
        label: 'Kriegsschiff',
        detail: hasPort
          ? 'patrouilliert & blockiert feindlichen Handel'
          : 'Hafen nötig (vom Hafen entsandt)',
        costText: fmtCompact(WARSHIP_COST),
        affordable: player.gold >= WARSHIP_COST,
        enabled: hasPort,
        accent: '#9fb2c4',
        run: () => {
          emit({ type: 'launch-warship', playerId: humanPlayerId, targetTile: tile })
          close()
        },
      })
    } else if (!isPassable(state.map.terrain, tile)) {
      close()
      return
    } else {
      const other = owner > 0 ? state.players.get(owner) : undefined
      if (owner > 0 && (other === undefined || !other.isAlive)) {
        close()
        return
      }
      title = other !== undefined ? other.name : 'Wildnis'
      titleColor = other !== undefined ? rgbaToCss(other.color) : 'rgba(235,235,235,0.9)'
      const troops = getAttackTroops()
      if (canReachByLand(state, humanPlayerId, tile)) {
        actions.push({
          glyph: '⚔',
          label: 'Angriff',
          detail: `${fmtCompact(troops)} Truppen an die Front`,
          costText: '',
          affordable: true,
          enabled: troops > 0,
          accent: ATTACK_ACCENT,
          run: () => {
            emit({ type: 'attack', playerId: humanPlayerId, targetTile: tile, troops })
            close()
          },
        })
      } else {
        actions.push({
          glyph: '🚢',
          label: 'Transportboot',
          detail: `${fmtCompact(troops)} Truppen übers Wasser`,
          costText: '',
          affordable: true,
          enabled: troops > 0,
          accent: BOAT_ACCENT,
          run: () => {
            emit({ type: 'boat', playerId: humanPlayerId, targetTile: tile, troops })
            close()
          },
        })
      }
      // Diplomatie nur mit echten Nationen — wilde Nationen sind passiv (keine Allianz/Embargo).
      if (other !== undefined && other.isAlive && !other.wild) {
        for (const a of diplomacyActions(owner)) actions.push(a)
      }
    }

    if (actions.length === 0) {
      close()
      return
    }
    renderRadial(actions, title, titleColor, screenX, screenY)
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
