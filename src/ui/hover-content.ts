/**
 * Gemeinsamer Hover-Resolver: bestimmt, was unter dem Cursor liegt (Schiff / Gebäude / Nation /
 * neutrales Land / Wasser / eigenes Land) und liefert eine struktur­ierte, schon übersetzte
 * Beschreibung ({@link HoverSubject}) — render-neutral.
 *
 * Beide Anzeigen teilen sich diesen Resolver:
 *  - der mitwandernde Cursor-Tooltip ({@link ./hover-tooltip.ts}) und
 *  - das feste Hover-Info-Panel ({@link ./hover-info.ts}).
 * Dadurch zeigen Panel und Tooltip für dasselbe Tile garantiert dieselben Werte — Voraussetzung
 * dafür, dass das Panel den Tooltip per Modus-Umschaltung ({@link ./hover-mode.ts}) ersetzen kann.
 *
 * Reine Lese-Logik: liest den (Schatten-)GameState read-only, mutiert nichts. Kein Sim-/
 * State-Hash-Einfluss, multiplayer-sicher.
 */

import { canReachByLand, effectiveMaxTroops, factoryYield, type GameState } from '../core/game'
import {
  airportSlots,
  CITY_CAP_BONUS,
  DEFENSE_MAG_MULTIPLIER,
  defenseRange,
  flakRange,
  isBuildingComplete,
  upgradeCost,
  type Building,
  type BuildingType,
} from '../core/buildings'
import { FACTORY_LINK_RANGE } from '../core/config'
import { areAllied, directedKey, pairKey } from '../core/diplomacy'
import { shipWorldPos, WARSHIP_HP } from '../core/ships'
import { getOwner } from '../world/map'
import { isLand } from '../world/terrain'
import { tileRef } from '../world/torus'
import { t } from '../i18n'
import { rgbaToCss } from './colors'
import { icon } from './icons'

/** Das aktuell gehoverte (gesnappte) Objekt — für die Renderer-Markierung (Ring). */
export interface HoverHighlight {
  readonly wx: number
  readonly wy: number
  readonly kind: 'ship' | 'building'
}

/** Ein farbiges Textsegment einer Hover-Zeile (Tooltip rendert inline, Panel als Zeilen). */
export interface HoverSeg {
  readonly text: string
  /** CSS-Farbe (sonst Standard-Textfarbe). */
  readonly color?: string
  /** Gedimmt (≈0.7 Deckkraft). */
  readonly dim?: boolean
  /** Stark gedimmt (≈0.55 Deckkraft). */
  readonly faint?: boolean
  /** Fett. */
  readonly strong?: boolean
  /** Voranstehendes Icon (HTML-SVG aus {@link ./icons}, erbt die Segmentfarbe). */
  readonly icon?: string
}

/** Eine Zeile = Folge von Segmenten (mit Leerzeichen verbunden). */
export interface HoverLine {
  readonly segs: readonly HoverSeg[]
}

/** Strukturierte, render-neutrale Beschreibung dessen, was unter dem Cursor liegt. */
export interface HoverSubject {
  readonly kind: 'ship' | 'building' | 'nation' | 'neutral' | 'water' | 'own'
  /** Markierungs-Objekt für den Renderer-Ring (nur bei gesnapptem Schiff/Gebäude). */
  readonly highlight: HoverHighlight | null
  /** Farbe für den Titel (Nations-/Spielerfarbe) — Panel zeigt sie als Punkt, Tooltip färbt den Namen. */
  readonly titleColor: string | null
  /** Titel-Segment (Hauptname). */
  readonly title: HoverSeg
  /** Zusatz-Segmente in der Titelzeile (Level/Status/†/Besitzer/Angriffs-Chip bei neutral). */
  readonly titleExtra: readonly HoverSeg[]
  /** Weitere Detailzeilen. */
  readonly lines: readonly HoverLine[]
  /** Änderungs-Signatur (Panel schreibt DOM nur bei echter Änderung). */
  readonly signature: string
}

/** Farbpalette der Hover-Anzeigen (zentral, damit Tooltip + Panel identisch färben). */
const COLOR = {
  gold: '#e8d24a',
  goldLoot: '#e8c14a',
  upgrade: '#7fd0ff',
  ally: '#5adc78',
  favor: '#5adcb0',
  bad: '#e8736b',
} as const

/** Sim-Ticks pro Sekunde (Anzeige-Umrechnung Gold/Tick → Gold/s). */
const SIM_TICKS_PER_SECOND = 10

/** Kompakte Zahl (z.B. 35100 → "35.1k"). */
export function fmtCompact(value: number): string {
  const v = Math.round(value)
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(v)
}

/** Übersetzter Anzeige-Name eines Gebäudetyps. */
function buildingLabel(type: BuildingType): string {
  return t(`building.${type}`)
}

/** Textsegment mit optionaler Farbe — lässt `color` weg, wenn `null` (exactOptionalPropertyTypes). */
function nameSeg(text: string, color: string | null): HoverSeg {
  return color !== null ? { text, color } : { text }
}

/** Konkreter Effektwert eines Gebäudes je Typ/Level. */
function buildingEffect(b: Building): string {
  switch (b.type) {
    case 'city':
      return t('tip.effect.city', { cap: fmtCompact(CITY_CAP_BONUS * b.level) })
    case 'defense':
      return t('tip.effect.defense', { mult: DEFENSE_MAG_MULTIPLIER, range: defenseRange(b.level) })
    case 'port':
      return t('tip.effect.port')
    case 'factory':
      return t('tip.effect.factory', { range: FACTORY_LINK_RANGE })
    case 'airport':
      return t('tip.effect.airport', { slots: airportSlots(b.level) })
    case 'flak':
      return t('tip.effect.flak', { range: flakRange(b.level) })
  }
}

/** Live-Gold/s einer eigenen fertigen Fabrik (Netz-Beitrag) — `null` wenn nichts beigetragen wird. */
function factoryYieldText(state: GameState, tile: number, level: number): string | null {
  const y = factoryYield(state, tile)
  if (y === null) return null
  const perSec = fmtCompact(y.goldPerTick * SIM_TICKS_PER_SECOND)
  return `+${perSec}/s · ${t('tip.dests', { n: y.dests })} × ${t('tip.lvl')} ${String(level)}`
}

/** Was ein Upgrade auf die nächste Stufe brächte — `null`, wenn ohne Zusatzeffekt. */
function upgradeBenefit(state: GameState, b: Building): string | null {
  const next = b.level + 1
  switch (b.type) {
    case 'city':
      return t('tip.effect.city', { cap: fmtCompact(CITY_CAP_BONUS * next) })
    case 'defense':
      return t('tip.upgrade.defense', { range: defenseRange(next) })
    case 'factory': {
      const y = factoryYield(state, b.tile)
      if (y === null || b.level <= 0) return null
      const nextGold = (y.goldPerTick / b.level) * next
      return `+${fmtCompact(nextGold * SIM_TICKS_PER_SECOND)}/s`
    }
    case 'port':
      return null // Hafen-Level hat aktuell keinen Effekt
    case 'airport':
      return t('tip.upgrade.airport', { slots: airportSlots(next) })
    case 'flak':
      return t('tip.upgrade.flak', { range: flakRange(next) })
  }
}

/** Eingaben für den Resolver (eine Cursor-Position + Snap-Zoom + Angriffs-Truppen-Getter). */
export interface ResolveHoverInput {
  readonly worldX: number
  readonly worldY: number
  /** Kamera-Zoom — steuert den (zoom-abhängigen) Snap-Radius beim Picken von Schiff/Gebäude. */
  readonly zoom: number
  /** Truppen, die ein Linksklick gerade losschicken würde (für den Angriffs-Chip). */
  readonly getAttackTroops: () => number
}

/** Baut die Signatur aus allen sichtbaren Segmenten (→ Panel re-rendert nur bei Änderung). */
function buildSignature(
  kind: string,
  highlight: HoverHighlight | null,
  title: HoverSeg,
  titleColor: string | null,
  titleExtra: readonly HoverSeg[],
  lines: readonly HoverLine[],
): string {
  const segSig = (s: HoverSeg): string => `${s.text}#${s.color ?? ''}`
  const parts = [
    kind,
    titleColor ?? '',
    highlight ? `${highlight.kind}:${highlight.wx.toFixed(2)},${highlight.wy.toFixed(2)}` : '',
    segSig(title),
    ...titleExtra.map(segSig),
    ...lines.map((l) => l.segs.map(segSig).join('|')),
  ]
  return parts.join('§')
}

/**
 * Bestimmt das Hover-Subjekt unter `(worldX, worldY)`. Reihenfolge wie beim bisherigen Tooltip:
 * nächstes Schiff im Snap-Radius → nächstes Gebäude im Snap-Radius → Tile (eigenes / Nation /
 * neutral / Wasser).
 */
export function resolveHover(
  state: GameState,
  humanId: number,
  input: ResolveHoverInput,
): HoverSubject {
  const { worldX, worldY, zoom, getAttackTroops } = input
  const { width: w, height: h } = state.map

  // Quadrierte Torus-Distanz vom Cursor zu (wx,wy).
  const dist2 = (wx: number, wy: number): number => {
    let dx = Math.abs(wx - worldX)
    let dy = Math.abs(wy - worldY)
    if (dx > w / 2) dx = w - dx
    if (dy > h / 2) dy = h - dy
    return dx * dx + dy * dy
  }

  const playerName = (id: number): { name: string; color: string | null } => {
    const p = state.players.get(id)
    if (p === undefined) return { name: '?', color: null }
    return { name: p.wild ? t('nation.wild') : p.name, color: rgbaToCss(p.color) }
  }

  const finish = (
    kind: HoverSubject['kind'],
    highlight: HoverHighlight | null,
    titleColor: string | null,
    title: HoverSeg,
    titleExtra: readonly HoverSeg[],
    lines: readonly HoverLine[],
  ): HoverSubject => ({
    kind,
    highlight,
    titleColor,
    title,
    titleExtra,
    lines,
    signature: buildSignature(kind, highlight, title, titleColor, titleExtra, lines),
  })

  // ── Schiffe (liegen über dem Tile): NÄCHSTES im zoom-abhängigen Snap-Radius ───────────────
  const shipR = Math.min(8, Math.max(2.5, 14 / zoom))
  let bestShipD2 = shipR * shipR
  let bestShip: { wx: number; wy: number; subject: HoverSubject } | null = null
  const tryShip = (
    wx: number,
    wy: number,
    titleColor: string | null,
    title: HoverSeg,
    titleExtra: readonly HoverSeg[],
    lines: readonly HoverLine[],
  ): void => {
    const d2 = dist2(wx, wy)
    if (d2 <= bestShipD2) {
      bestShipD2 = d2
      const hl: HoverHighlight = { wx, wy, kind: 'ship' }
      bestShip = { wx, wy, subject: finish('ship', hl, titleColor, title, titleExtra, lines) }
    }
  }
  for (const boat of state.boats) {
    const { wx, wy } = shipWorldPos(boat, w, h)
    const o = playerName(boat.ownerId)
    tryShip(
      wx,
      wy,
      o.color,
      { text: t('hud.boat'), strong: true },
      [{ text: '·', dim: true }, nameSeg(o.name, o.color)],
      [
        {
          segs: [{ text: `${boat.troops.toLocaleString('de-DE')} ${t('hud.troops')}`, dim: true }],
        },
      ],
    )
  }
  for (const ship of state.tradeShips) {
    const { wx, wy } = shipWorldPos(ship, w, h)
    const from = playerName(ship.fromOwnerId)
    const to = playerName(ship.toOwnerId)
    tryShip(
      wx,
      wy,
      from.color,
      { text: t('tip.tradeShip'), strong: true },
      [
        { text: '·', dim: true },
        nameSeg(from.name, from.color),
        { text: '→', dim: true },
        nameSeg(to.name, to.color),
      ],
      [],
    )
  }
  for (const ws of state.warships) {
    const { wx, wy } = shipWorldPos(ws, w, h)
    const o = playerName(ws.ownerId)
    const hp = Math.max(0, Math.round(ws.hp))
    const status = ws.returning ? ` · ${t('hud.returning')}` : ''
    tryShip(
      wx,
      wy,
      o.color,
      { text: t('tip.warship'), strong: true, icon: icon.anchor },
      [{ text: '·', dim: true }, nameSeg(o.name, o.color)],
      [{ segs: [{ text: `${String(hp)} / ${String(WARSHIP_HP)} HP${status}`, dim: true }] }],
    )
  }
  if (bestShip !== null) return (bestShip as { subject: HoverSubject }).subject

  const ref = tileRef(Math.floor(worldX), Math.floor(worldY), w, h)
  const owner = getOwner(state.map, ref)

  // ── Gebäude: NÄCHSTES im (kleineren) Snap-Radius ──────────────────────────────────────────
  const buildR = Math.min(6, Math.max(1.5, 10 / zoom))
  let bestBuildD2 = buildR * buildR
  let building: Building | undefined
  for (const b of state.buildings.values()) {
    const d2 = dist2((b.tile % w) + 0.5, Math.floor(b.tile / w) + 0.5)
    if (d2 <= bestBuildD2) {
      bestBuildD2 = d2
      building = b
    }
  }
  if (building !== undefined) {
    const bx = (building.tile % w) + 0.5
    const by = Math.floor(building.tile / w) + 0.5
    const hl: HoverHighlight = { wx: bx, wy: by, kind: 'building' }
    const isOwn = building.ownerId === humanId
    const ownerName = isOwn ? t('tip.you') : (state.players.get(building.ownerId)?.name ?? '?')
    const complete = isBuildingComplete(building, state.tick)

    const titleExtra: HoverSeg[] = [
      { text: `${t('tip.lvl')} ${String(building.level)}`, dim: true },
    ]
    if (!complete) titleExtra.push({ text: `(${t('tip.underConstruction')})`, faint: true })

    // Aktueller Effekt — für eigene fertige Fabriken der Live-Netz-Beitrag.
    let effectText = buildingEffect(building)
    let factoryGold = false
    if (building.type === 'factory' && isOwn && complete) {
      const fy = factoryYieldText(state, building.tile, building.level)
      if (fy !== null) {
        effectText = fy
        factoryGold = true
      }
    }
    const effectSeg: HoverSeg = factoryGold
      ? { text: effectText, color: COLOR.gold }
      : { text: effectText, dim: true }
    const lines: HoverLine[] = [{ segs: [effectSeg] }]

    // Upgrade-Vorschau: was die nächste Stufe brächte (+ Kosten), nur eigene fertige Gebäude.
    if (isOwn && complete) {
      const benefit = upgradeBenefit(state, building)
      if (benefit !== null) {
        const cost = upgradeCost(building)
        lines.push({
          segs: [
            { text: `↑ ${t('tip.lvl')} ${String(building.level + 1)}:`, color: COLOR.upgrade },
            { text: benefit, color: COLOR.upgrade },
            { text: `· ${fmtCompact(cost)} ${t('hud.gold')}`, color: COLOR.upgrade, dim: true },
          ],
        })
      }
    }
    lines.push({ segs: [{ text: ownerName, faint: true }] })

    return finish(
      'building',
      hl,
      null,
      { text: buildingLabel(building.type), strong: true },
      titleExtra,
      lines,
    )
  }

  // ── Kein Schiff/Gebäude: Tile selbst ──────────────────────────────────────────────────────
  if (!isLand(state.map.terrain, ref)) {
    return finish('water', null, null, { text: t('hover.water'), faint: true }, [], [])
  }

  // Angriffs-Chip: wie viele Truppen ein Linksklick HIER losschicken würde — nur über gültigen
  // Land-Zielen (Gegner/Wildnis, über Land erreichbar, nicht verbündet).
  const attackChip = (): HoverSeg | null => {
    const atk = getAttackTroops()
    if (atk <= 0 || humanId < 0) return null
    if (owner > 0 && areAllied(state.alliances, humanId, owner)) return null
    if (!canReachByLand(state, humanId, ref)) return null
    return { icon: icon.swords, text: fmtCompact(atk), color: COLOR.gold }
  }

  if (owner === humanId) {
    // Eigenes Land (ohne Gebäude/Schiff): „Du" + eigene Truppen. (Tooltip blendet das aus.)
    const me = state.players.get(humanId)
    const meColor = me !== undefined ? rgbaToCss(me.color) : null
    const lines: HoverLine[] =
      me !== undefined ? [{ segs: [{ text: me.troops.toLocaleString('de-DE'), dim: true }] }] : []
    return finish('own', null, meColor, { text: t('tip.you'), strong: true }, [], lines)
  }

  if (owner === 0) {
    const chip = attackChip()
    const extra: HoverSeg[] = chip !== null ? [{ text: '·', dim: true }, chip] : []
    return finish('neutral', null, null, { text: t('tip.neutralLand'), dim: true }, extra, [])
  }

  const player = state.players.get(owner)
  if (player === undefined) {
    // Inkonsistent (Tile beansprucht, Spieler weg) → wie neutral behandeln.
    return finish('neutral', null, null, { text: t('tip.neutralLand'), dim: true }, [], [])
  }

  // ── Fremde Nation: volle Stats ────────────────────────────────────────────────────────────
  const nationColor = rgbaToCss(player.color)
  const totalTiles = w * h
  const pct = ((player.tilesOwned / totalTiles) * 100).toFixed(2)
  const cap = effectiveMaxTroops(state, owner)
  const avgPerTile = player.tilesOwned > 0 ? Math.floor(player.troops / player.tilesOwned) : 0

  const titleExtra: HoverSeg[] = []
  if (!player.isAlive) titleExtra.push({ text: '†', faint: true })

  const lines: HoverLine[] = [
    {
      segs: [
        {
          text: `${player.troops.toLocaleString('de-DE')} / ${cap.toLocaleString('de-DE')} ${t('hud.troops')} · ${pct}%`,
        },
      ],
    },
    { segs: [{ text: t('tip.perTile', { n: avgPerTile.toLocaleString('de-DE') }), dim: true }] },
  ]

  // Verräter (geächtet).
  if (player.traitorUntil > state.tick) {
    lines.push({ segs: [{ icon: icon.warning, text: t('tip.traitor'), color: COLOR.bad }] })
  }

  // Beziehung (Gunst/Groll aus Sicht des Menschen) — dominante Stimmung mit Wert.
  if (humanId >= 0) {
    const gw = state.goodwill.get(directedKey(owner, humanId)) ?? 0
    const gr = Math.max(
      state.grudge.get(directedKey(owner, humanId)) ?? 0,
      state.grudge.get(directedKey(humanId, owner)) ?? 0,
    )
    if (gr >= 5 && gr >= gw) {
      const segs: HoverSeg[] = [
        { icon: icon.grudge, text: t('tip.grudge', { n: fmtCompact(gr) }), color: COLOR.bad },
      ]
      if (gw >= 5) segs.push({ text: `· ${t('tip.favor', { n: fmtCompact(gw) })}`, dim: true })
      lines.push({ segs })
    } else if (gw >= 5) {
      const segs: HoverSeg[] = [
        { icon: icon.alliance, text: t('tip.favor', { n: fmtCompact(gw) }), color: COLOR.favor },
      ]
      if (gr >= 5) segs.push({ text: `· ${t('tip.grudge', { n: fmtCompact(gr) })}`, dim: true })
      lines.push({ segs })
    }
  }

  // Gold-Beute beim Erobern (anteilig) — nur bei nicht-Verbündeten mit Gold.
  if (humanId >= 0 && player.gold > 0 && !areAllied(state.alliances, humanId, owner)) {
    lines.push({
      segs: [
        {
          icon: icon.gold,
          text: t('tip.loot', { gold: fmtCompact(player.gold) }),
          color: COLOR.goldLoot,
        },
      ],
    })
  }

  // Verbündet? → Restzeit der Allianz.
  if (humanId >= 0 && areAllied(state.alliances, humanId, owner)) {
    const expiry = state.allianceExpiry.get(pairKey(humanId, owner))
    const remain = expiry !== undefined ? Math.max(0, Math.floor((expiry - state.tick) / 10)) : 0
    const mm = Math.floor(remain / 60)
    const ss = remain % 60
    lines.push({
      segs: [
        {
          icon: icon.alliance,
          text: t('tip.allied', { time: `${mm.toString()}:${ss < 10 ? '0' : ''}${ss.toString()}` }),
          color: COLOR.ally,
        },
      ],
    })
  }

  // Angriffs-Chip (eigene Zeile bei Nationen).
  const chip = attackChip()
  if (chip !== null) lines.push({ segs: [chip] })

  return finish(
    'nation',
    null,
    nationColor,
    { text: player.wild ? t('nation.wild') : player.name, strong: true, color: nationColor },
    titleExtra,
    lines,
  )
}

// ── Render-Helfer (HTML) — von Tooltip und Panel geteilt, damit beide identisch aussehen ──────

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  )
}

/** Ein Segment → `<span>` mit Farbe/Deckkraft/Fett + optional führendem Icon (erbt die Farbe). */
function segHtml(seg: HoverSeg): string {
  const st: string[] = []
  if (seg.strong === true) st.push('font-weight:bold')
  if (seg.color !== undefined) st.push(`color:${seg.color}`)
  if (seg.faint === true) st.push('opacity:0.55')
  else if (seg.dim === true) st.push('opacity:0.7')
  const ic = seg.icon !== undefined ? `${seg.icon} ` : ''
  const attr = st.length > 0 ? ` style="${st.join(';')}"` : ''
  return `<span${attr}>${ic}${escapeHtml(seg.text)}</span>`
}

function lineHtml(line: HoverLine): string {
  return line.segs.map(segHtml).join(' ')
}

/**
 * Titelzeile als HTML. `dot:true` (Panel) → führender Farbpunkt in {@link HoverSubject.titleColor}
 * + Name in Standard-Textfarbe; `dot:false` (Tooltip) → Name in der Titelfarbe selbst.
 */
export function titleHtml(s: HoverSubject, opts: { readonly dot: boolean }): string {
  const parts: string[] = []
  if (opts.dot && s.titleColor !== null) {
    parts.push(
      `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${s.titleColor};box-shadow:0 0 0 1px rgba(0,0,0,0.35);margin-right:6px;vertical-align:0.02em"></span>`,
    )
  }
  // Panel (dot:true) → Name in Standard-Textfarbe (Farbe steckt im Punkt); Tooltip → Name farbig.
  let titleSeg = s.title
  if (opts.dot) {
    const { color: _color, ...rest } = s.title
    titleSeg = rest
  }
  parts.push(segHtml(titleSeg))
  for (const e of s.titleExtra) parts.push(segHtml(e))
  return parts.join(' ')
}

/** Die Detailzeilen (ohne Titel) als HTML, durch `<br>` getrennt. */
export function bodyHtml(s: HoverSubject): string {
  return s.lines.map(lineHtml).join('<br>')
}

/** Komplettes Subjekt als HTML (Tooltip-Stil: farbiger Name, kein Punkt). */
export function subjectHtml(s: HoverSubject): string {
  const body = bodyHtml(s)
  return titleHtml(s, { dot: false }) + (body !== '' ? '<br>' + body : '')
}
