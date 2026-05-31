/**
 * Radiales Kontext-Menü — öffnet bei Rechtsklick (ohne Drag) als Kranz von Aktions-
 * Chips um den Cursor, mit einer Kontext-Info in der Mitte (aktualisiert bei Hover).
 *
 * Liest den GameState read-only und emittiert Intents, kontextabhängig vom Ziel-Tile:
 *  - Eigenes Tile → Diplomatie/Wirtschaft: „Handel mit allen stoppen" (globales Embargo) +
 *    Upgrade eines vorhandenen Gebäudes + Hafen-/Schiff-Optionen. Neubau NICHT hier (HUD-Knöpfe).
 *  - Gegner/Wildnis über Land → Angriff (Slider-Truppen).
 *  - Gegner/Wildnis über Wasser → Transportboot.
 *  - Lebender Gegner zusätzlich → Allianz + Embargo.
 *  - Wasser/unpassierbar → kein Menü.
 */

import {
  CITY_CAP_BONUS,
  DEFENSE_MAG_MULTIPLIER,
  MAX_BUILDING_LEVEL,
  isBuildingComplete,
  upgradeCost,
  type BuildingType,
} from '../core/buildings'
import { bomberLaunchInfo, canReachByLand, type GameState } from '../core/game'
import { areAllied, directedKey, hasAllianceRequest, pairKey } from '../core/diplomacy'
import { WARSHIP_COST } from '../core/ships'
import type { Intent } from '../core/intent'
import { getOwner } from '../world/map'
import { isLand, isPassable } from '../world/terrain'
import { t } from '../i18n'
import { rgbaToCss } from './colors'

/** Übersetzter Anzeige-Name eines Gebäudetyps. */
function buildingLabel(type: BuildingType): string {
  return t(`building.${type}`)
}

const BUILDING_GLYPH: Record<BuildingType, string> = {
  city: 'C',
  defense: 'D',
  port: 'P',
  factory: 'F',
  airport: 'A',
  flak: 'K',
}

/** Kurzbeschreibung pro Typ mit konkretem Effektwert (pro Stufe), übersetzt zur Aufruf-Zeit. */
function buildingHint(type: BuildingType): string {
  switch (type) {
    case 'city':
      return t('menu.hint.city', { cap: fmtCompact(CITY_CAP_BONUS) })
    case 'defense':
      return t('menu.hint.defense', { mult: DEFENSE_MAG_MULTIPLIER })
    case 'port':
      return t('menu.hint.port')
    case 'factory':
      return t('menu.hint.factory')
    case 'airport':
      return t('menu.hint.airport')
    case 'flak':
      return t('menu.hint.flak')
  }
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
  /** Optionales Untermenü (ADR-0022): Klick öffnet diese Kind-Aktionen statt `run` auszuführen. */
  submenu?: readonly MenuAction[]
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
    detailEl.textContent = t('menu.chooseAction')
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
        detailEl.textContent = t('menu.chooseAction')
        detailEl.style.opacity = '0.65'
        path.setAttribute('fill', idle)
      })
      if (clickable) {
        path.addEventListener('click', (e) => {
          e.stopPropagation()
          // Untermenü (ADR-0022): an Ort und Stelle in die Kind-Aktionen wechseln statt auszuführen.
          if (a.submenu !== undefined) renderRadial(a.submenu, a.label, a.accent, screenX, screenY)
          else a.run()
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
        label: t('menu.breakAlliance'),
        detail: t('menu.breakAllianceDetail', {
          time: `${mm.toString()}:${ss < 10 ? '0' : ''}${ss.toString()}`,
        }),
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
        label: t('menu.acceptAlliance'),
        detail: t('menu.acceptAllianceDetail'),
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
        label: t('menu.requestSent'),
        detail: t('menu.requestSentDetail'),
        costText: '',
        affordable: false,
        enabled: false,
        accent: ALLY_ACCENT,
        run: () => {},
      })
    } else {
      out.push({
        glyph: '🤝',
        label: t('menu.requestAlliance'),
        detail: t('menu.requestAllianceDetail'),
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
      label: embargoed ? t('menu.embargoLift') : t('menu.embargoImpose'),
      detail: embargoed ? t('menu.embargoLiftDetail') : t('menu.embargoImposeDetail'),
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

    // Gunst-Spenden (ADR-0022): Gold an jeden (Untermenü: Slider-Betrag + 10/25/50/100%),
    // Truppen nur an Verbündete (Menge über den Angriffs-Slider).
    const me = state.players.get(humanPlayerId)
    if (me !== undefined) {
      const sliderPct = me.troops > 0 ? Math.min(1, getAttackTroops() / me.troops) : 0.25
      const goldGift = (label: string, amount: number): MenuAction => ({
        glyph: '⊕',
        label,
        detail: t('menu.donateGoldDetail', { n: fmtCompact(amount) }),
        costText: '',
        affordable: amount > 0 && me.gold >= amount,
        enabled: amount > 0 && me.gold >= amount,
        accent: ALLY_ACCENT,
        run: () => {
          emit({ type: 'donate-gold', playerId: humanPlayerId, targetPlayerId: targetId, amount })
          close()
        },
      })
      out.push({
        glyph: '⊕',
        label: t('menu.donateGold'),
        detail: t('menu.donateGoldParent'),
        costText: '',
        affordable: me.gold > 0,
        enabled: me.gold > 0,
        accent: ALLY_ACCENT,
        run: () => {},
        submenu: [
          goldGift(t('menu.donateSlider'), Math.floor(me.gold * sliderPct)),
          goldGift('10 %', Math.floor(me.gold * 0.1)),
          goldGift('25 %', Math.floor(me.gold * 0.25)),
          goldGift('50 %', Math.floor(me.gold * 0.5)),
          goldGift('100 %', me.gold),
        ],
      })
      if (allied) {
        const troops = getAttackTroops()
        out.push({
          glyph: '⊕',
          label: t('menu.donateTroops'),
          detail: t('menu.donateTroopsDetail', { n: fmtCompact(troops) }),
          costText: '',
          affordable: troops > 0,
          enabled: troops > 0,
          accent: ALLY_ACCENT,
          run: () => {
            emit({
              type: 'donate-troops',
              playerId: humanPlayerId,
              targetPlayerId: targetId,
              amount: troops,
            })
            close()
          },
        })
      }
    }
    return out
  }

  /**
   * Globaler „Handel stoppen/erlauben"-Schalter: verhängt/hebt ein Embargo gegen ALLE lebenden
   * fremden Nationen auf einmal. Ein Embargo schneidet sowohl Handelsschiffe als auch
   * Fabrik-Auslandslinks ab (`isTradeEmbargoed`) → betrifft Häfen und Fabriken.
   */
  function tradeStopAllAction(): MenuAction {
    const targets: number[] = []
    for (const p of state.players.values()) {
      if (p.id === humanPlayerId || !p.isAlive) continue
      targets.push(p.id)
    }
    const embargoed = targets.filter((id) =>
      state.embargoes.has(directedKey(humanPlayerId, id)),
    ).length
    const allStopped = targets.length > 0 && embargoed === targets.length
    return {
      glyph: '⛔',
      label: allStopped ? t('menu.tradeAllowAll') : t('menu.tradeStopAll'),
      detail: allStopped ? t('menu.tradeAllowAllDetail') : t('menu.tradeStopAllDetail'),
      costText: '',
      affordable: true,
      enabled: targets.length > 0,
      accent: HOSTILE_ACCENT,
      run: () => {
        const enable = !allStopped
        for (const id of targets) {
          const has = state.embargoes.has(directedKey(humanPlayerId, id))
          if (enable !== has) {
            emit({
              type: 'set-embargo',
              playerId: humanPlayerId,
              targetPlayerId: id,
              enabled: enable,
            })
          }
        }
        close()
      },
    }
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
        title = `${buildingLabel(existing.type)} · L${String(existing.level)}`
        if (existing.level >= MAX_BUILDING_LEVEL) {
          actions.push({
            glyph: BUILDING_GLYPH[existing.type],
            label: t('menu.maxLevel'),
            detail: '',
            costText: '',
            affordable: false,
            enabled: false,
            accent: titleColor,
            run: () => {},
          })
        } else {
          const cost = upgradeCost(existing)
          actions.push({
            glyph: BUILDING_GLYPH[existing.type],
            label: t('menu.upgrade', { level: existing.level + 1 }),
            detail: buildingHint(existing.type),
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
            label: holding ? t('menu.warshipHoldLabel') : t('menu.warshipPingPong'),
            detail: t('menu.warshipModeDetail'),
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
            random: t('menu.trade.random'),
            nearest: t('menu.trade.nearest'),
            farthest: t('menu.trade.farthest'),
            allies: t('menu.trade.allies'),
          }
          const curMode = player.tradeMode
          const nextMode =
            TRADE_MODES[(TRADE_MODES.indexOf(curMode) + 1) % TRADE_MODES.length] ?? 'random'
          actions.push({
            glyph: '⚖',
            label: TRADE_LABEL[curMode],
            detail: t('menu.tradeNext', { next: TRADE_LABEL[nextMode] }),
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
            label: spare ? t('menu.warshipSpare') : t('menu.warshipAttackAll'),
            detail: t('menu.warshipNeutralDetail'),
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
        // Leeres eigenes Tile: kein Neubau mehr im Radialmenü (Bauen läuft über die HUD-Knöpfe
        // 1–4: Gebäude wählen → Tile klicken). Das Eigen-Menü ist jetzt für Diplomatie/Wirtschaft.
        title = t('menu.goldTitle', { gold: fmtCompact(player.gold) })
      }
      // Globaler Handels-Schalter: Embargo gegen alle lebenden Nationen auf einmal (betrifft
      // Häfen UND Fabrik-Auslandslinks). „Rundum ausbreiten" liegt jetzt auf Shift+Linksklick.
      actions.push(tradeStopAllAction())
    } else if (!isLand(state.map.terrain, tile)) {
      // Wasser-Tile → Kriegsschiff entsenden (braucht eigenen Hafen + Gold).
      title = t('menu.water')
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
        label: t('menu.warship'),
        detail: hasPort ? t('menu.warshipHasPort') : t('menu.warshipNoPort'),
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
      title = other !== undefined ? other.name : t('hud.wilderness')
      titleColor = other !== undefined ? rgbaToCss(other.color) : 'rgba(235,235,235,0.9)'
      const troops = getAttackTroops()
      if (canReachByLand(state, humanPlayerId, tile)) {
        actions.push({
          glyph: '⚔',
          label: t('menu.attack'),
          detail: t('menu.attackDetail', { n: fmtCompact(troops) }),
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
          label: t('hud.boat'),
          detail: t('menu.boatDetail', { n: fmtCompact(troops) }),
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

    // Bomber starten (ADR-0019): auf JEDES Ziel-Tile, wenn der Spieler einen Flughafen mit Flugzeug
    // oder freiem Hangar-Platz hat. Niemand wird verschont — daher universell angeboten. Kosten
    // dynamisch (nur Munition für ein geparktes Flugzeug, sonst Flugzeug-Kauf + Munition).
    const hasAirport = [...state.buildings.values()].some(
      (b) =>
        b.type === 'airport' && b.ownerId === humanPlayerId && isBuildingComplete(b, state.tick),
    )
    if (hasAirport) {
      const bi = bomberLaunchInfo(state, humanPlayerId)
      actions.push({
        glyph: 'A',
        label: t('menu.bomber'),
        detail: bi.available ? t('menu.bomberDetail') : t('menu.bomberFull'),
        costText: fmtCompact(bi.cost),
        affordable: player.gold >= bi.cost,
        enabled: bi.available && player.gold >= bi.cost,
        accent: '#e8884a',
        run: () => {
          emit({
            type: 'launch-bomber',
            playerId: humanPlayerId,
            targetTile: tile,
            route: 'direct',
          })
          close()
        },
      })
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
