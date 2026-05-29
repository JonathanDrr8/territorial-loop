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

import { canReachByLand, effectiveMaxTroops, factoryYield, type GameState } from '../core/game'
import {
  BUILDING_LABEL,
  CITY_CAP_BONUS,
  DEFENSE_MAG_MULTIPLIER,
  defenseRange,
  isBuildingComplete,
  upgradeCost,
  type Building,
} from '../core/buildings'
import { FACTORY_LINK_RANGE } from '../core/config'
import { areAllied, directedKey, pairKey } from '../core/diplomacy'
import { shipWorldPos, WARSHIP_HP } from '../core/ships'
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

/** Kompakte Zahl für die Cursor-Notiz (z.B. 35100 → "35.1k"). */
function fmtCompact(value: number): string {
  const v = Math.round(value)
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(v)
}

/** Konkreter Effektwert eines Gebäudes je Typ/Level (für den Hover-Tooltip). */
function buildingEffect(b: Building): string {
  switch (b.type) {
    case 'city':
      return `+${fmtCompact(CITY_CAP_BONUS * b.level)} Truppen-Cap`
    case 'defense':
      return `${String(DEFENSE_MAG_MULTIPLIER)}× Eroberungskosten · Reichweite ${String(defenseRange(b.level))} Tiles`
    case 'port':
      return 'Schiffe & Handel · zählt als Netz-Ziel'
    case 'factory':
      return `Netzwerk-Gold · Reichweite ${String(FACTORY_LINK_RANGE)} Tiles`
  }
}

/** Sim-Ticks pro Sekunde (Anzeige-Umrechnung Gold/Tick → Gold/s). */
const SIM_TICKS_PER_SECOND = 10

/** Kompakte Gold/s-Zeile für eine eigene fertige Fabrik (Live-Beitrag). */
function factoryYieldLine(state: GameState, tile: number, level: number): string | null {
  const y = factoryYield(state, tile)
  if (y === null) return null
  const perSec = fmtCompact(y.goldPerTick * SIM_TICKS_PER_SECOND)
  const dests = `${String(y.dests)} Ziel${y.dests === 1 ? '' : 'e'}`
  return `<span style="color:#e8d24a">+${perSec}/s</span> <span style="opacity:0.7">(${dests} × Lvl ${String(level)})</span>`
}

/**
 * Was ein Upgrade auf die nächste Stufe konkret brächte (Effekt bei `level+1`). `null`, wenn
 * die Stufe keinen Zusatzeffekt hat (Hafen: Level wirkt aktuell nicht). Für Fabriken live aus
 * dem Netz gerechnet.
 */
function upgradeBenefit(state: GameState, b: Building): string | null {
  const next = b.level + 1
  switch (b.type) {
    case 'city':
      return `+${fmtCompact(CITY_CAP_BONUS * next)} Truppen-Cap`
    case 'defense':
      return `Reichweite ${String(defenseRange(next))} Tiles`
    case 'factory': {
      const y = factoryYield(state, b.tile)
      if (y === null || b.level <= 0) return null
      const nextGold = (y.goldPerTick / b.level) * next
      return `<span style="color:#e8d24a">+${fmtCompact(nextGold * SIM_TICKS_PER_SECOND)}/s</span>`
    }
    case 'port':
      return null // Hafen-Level hat aktuell keinen Effekt
  }
}

export function createHoverTooltip(
  container: HTMLElement,
  state: GameState,
  humanId: number,
  /** Truppenzahl, die ein Linksklick gerade losschicken würde (Slider-% der freien Truppen). */
  getAttackTroops: () => number,
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

  /** Name eines Spielers (oder '?'), gefärbt. */
  const playerLabel = (id: number): string => {
    const p = state.players.get(id)
    return p === undefined
      ? '?'
      : `<b style="color:${rgbaToCss(p.color)}">${escapeHtml(p.name)}</b>`
  }

  function show(worldX: number, worldY: number, screenX: number, screenY: number): void {
    const { width: w, height: h } = state.map

    // Zuerst Schiffe prüfen (sie liegen über dem Tile) — Hover zeigt den Besitzer.
    const place = (html: string): void => {
      tooltip.innerHTML = html
      tooltip.style.display = 'block'
      tooltip.style.left = String(screenX + 14) + 'px'
      tooltip.style.top = String(screenY + 14) + 'px'
    }
    const near = (wx: number, wy: number): boolean => {
      let dx = Math.abs(wx - worldX)
      let dy = Math.abs(wy - worldY)
      if (dx > w / 2) dx = w - dx
      if (dy > h / 2) dy = h - dy
      return dx * dx + dy * dy <= 3.2 * 3.2
    }
    for (const boat of state.boats) {
      const { wx, wy } = shipWorldPos(boat, w, h)
      if (near(wx, wy)) {
        place(
          `Transportboot · ${playerLabel(boat.ownerId)}<br><span style="opacity:0.75">${boat.troops.toLocaleString('de-DE')} Truppen</span>`,
        )
        return
      }
    }
    for (const ship of state.tradeShips) {
      const { wx, wy } = shipWorldPos(ship, w, h)
      if (near(wx, wy)) {
        place(`Handelsschiff · ${playerLabel(ship.fromOwnerId)} → ${playerLabel(ship.toOwnerId)}`)
        return
      }
    }
    for (const ws of state.warships) {
      const { wx, wy } = shipWorldPos(ws, w, h)
      if (near(wx, wy)) {
        const hp = Math.max(0, Math.round(ws.hp))
        const status = ws.returning ? ' · kehrt um' : ''
        place(
          `⚓ Kriegsschiff · ${playerLabel(ws.ownerId)}<br><span style="opacity:0.75">${String(hp)} / ${String(WARSHIP_HP)} HP${status}</span>`,
        )
        return
      }
    }

    const ref = tileRef(Math.floor(worldX), Math.floor(worldY), w, h)
    const owner = getOwner(state.map, ref)

    // Gebäude auf dem Tile → Typ/Level/Effekt zeigen (auch über eigenem Gebiet).
    const building = state.buildings.get(ref)
    if (building !== undefined) {
      const isOwn = building.ownerId === humanId
      const ownerName = isOwn ? 'Du' : (state.players.get(building.ownerId)?.name ?? '?')
      const complete = isBuildingComplete(building, state.tick)
      const status = complete ? '' : ' <span style="opacity:0.6">(im Bau)</span>'
      // Aktueller Effekt — für eigene fertige Fabriken der Live-Netz-Beitrag.
      let effect = buildingEffect(building)
      if (building.type === 'factory' && isOwn && complete) {
        effect = factoryYieldLine(state, ref, building.level) ?? effect
      }
      // Upgrade-Vorschau: was die nächste Stufe brächte (+ Kosten), nur für eigene fertige
      // Gebäude mit wirksamem Level.
      let upgradeLine = ''
      if (isOwn && complete) {
        const benefit = upgradeBenefit(state, building)
        if (benefit !== null) {
          const cost = upgradeCost(building.type, building.level)
          upgradeLine = `<br><span style="color:#7fd0ff">↑ Lvl ${String(building.level + 1)}: ${benefit} <span style="opacity:0.7">· ${fmtCompact(cost)} Gold</span></span>`
        }
      }
      place(
        `<b>${escapeHtml(BUILDING_LABEL[building.type])}</b> <span style="opacity:0.7">Lvl ${String(building.level)}</span>${status}<br>` +
          `<span style="opacity:0.8">${effect}</span>${upgradeLine}<br>` +
          `<span style="opacity:0.55">${escapeHtml(ownerName)}</span>`,
      )
      return
    }

    if (owner === humanId) {
      hide()
      return
    }

    // Angriffs-Notiz: wie viele Truppen ein Linksklick HIER losschicken würde — nur über
    // gültigen Land-Angriffszielen (Gegner/Wildnis, über Land erreichbar, nicht verbündet).
    const atkTroops = getAttackTroops()
    const attackNote = (over: 'inline' | 'line'): string => {
      if (atkTroops <= 0 || humanId < 0) return ''
      if (owner > 0 && areAllied(state.alliances, humanId, owner)) return ''
      if (!canReachByLand(state, humanId, ref)) return ''
      const chip = `<span style="color:#e8d24a">⚔ ${fmtCompact(atkTroops)}</span>`
      return over === 'inline' ? ` · ${chip}` : `<br>${chip}`
    }

    if (owner === 0) {
      tooltip.innerHTML = `<span style="opacity: 0.7">neutrales Land</span>${attackNote('inline')}`
    } else {
      const player = state.players.get(owner)
      if (player === undefined) {
        hide()
        return
      }
      const totalTiles = w * h
      const pct = ((player.tilesOwned / totalTiles) * 100).toFixed(2)
      const cap = effectiveMaxTroops(state, owner)
      const avgPerTile = player.tilesOwned > 0 ? Math.floor(player.troops / player.tilesOwned) : 0
      const dead = player.isAlive ? '' : ' <span style="opacity:0.6">†</span>'
      // Verbündet? → Restzeit der Allianz anzeigen.
      let alliance = ''
      if (humanId >= 0 && areAllied(state.alliances, humanId, owner)) {
        const expiry = state.allianceExpiry.get(pairKey(humanId, owner))
        const remain =
          expiry !== undefined ? Math.max(0, Math.floor((expiry - state.tick) / 10)) : 0
        const mm = Math.floor(remain / 60)
        const ss = remain % 60
        alliance = `<br><span style="color:#5adc78">🤝 Verbündet · noch ${mm.toString()}:${ss < 10 ? '0' : ''}${ss.toString()}</span>`
      }
      // Beziehungs-Indikator (Gunst/Groll aus Sicht des Menschen) — die dominante Stimmung
      // mit Wert; spiegelt den Grenz-Tint wider.
      let relation = ''
      if (humanId >= 0) {
        const gw = state.goodwill.get(directedKey(owner, humanId)) ?? 0
        const gr = state.grudge.get(directedKey(owner, humanId)) ?? 0
        if (gr >= 5 && gr >= gw) {
          relation = `<br><span style="color:#e8736b">😠 Groll ${fmtCompact(gr)}${gw >= 5 ? ` <span style="opacity:0.7">· Gunst ${fmtCompact(gw)}</span>` : ''}</span>`
        } else if (gw >= 5) {
          relation = `<br><span style="color:#5adcb0">🤝 Gunst ${fmtCompact(gw)}${gr >= 5 ? ` <span style="opacity:0.7">· Groll ${fmtCompact(gr)}</span>` : ''}</span>`
        }
      }
      tooltip.innerHTML =
        `<b style="color:${rgbaToCss(player.color)}">${escapeHtml(player.name)}</b>${dead}<br>` +
        `${player.troops.toLocaleString('de-DE')} / ${cap.toLocaleString('de-DE')} Truppen · ${pct}%<br>` +
        `<span style="opacity:0.7">~${avgPerTile.toLocaleString('de-DE')}/Tile</span>${relation}${alliance}${attackNote('line')}`
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
