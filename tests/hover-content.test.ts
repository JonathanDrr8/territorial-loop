import { describe, it, expect, beforeAll } from 'vitest'
import { createGame, type GameConfig } from '../src/core/game'
import { setLocale } from '../src/i18n'
import { getOwner } from '../src/world/map'
import {
  resolveHover,
  subjectHtml,
  titleHtml,
  bodyHtml,
  fmtCompact,
  type HoverSubject,
} from '../src/ui/hover-content'
import type { Building } from '../src/core/buildings'

function cfg(): GameConfig {
  return {
    mapWidth: 48,
    mapHeight: 48,
    seed: 'hover-content-test',
    victoryPct: 90,
    terrain: 'flat',
    players: [
      { id: 1, name: 'Mensch', color: 0xff0000ff, isHuman: true },
      { id: 2, name: 'Gegner', color: 0x00ff00ff, isHuman: false },
    ],
  }
}

type State = ReturnType<typeof createGame>

function center(state: State, tile: number): { worldX: number; worldY: number } {
  const w = state.map.width
  return { worldX: (tile % w) + 0.5, worldY: Math.floor(tile / w) + 0.5 }
}

function firstOwned(state: State, pid: number): number {
  for (let i = 0; i < state.map.state.length; i++) {
    if (getOwner(state.map, i) === pid) return i
  }
  return -1
}

/** Resolver-Aufruf an einem Tile (Standard-Zoom, kein Angriffs-Chip). */
function at(state: State, humanId: number, tile: number): HoverSubject {
  return resolveHover(state, humanId, { ...center(state, tile), zoom: 1, getAttackTroops: () => 0 })
}

// Der Resolver liefert übersetzte Texte → für stabile Assertions die Locale fest auf Deutsch.
beforeAll(() => {
  setLocale('de')
})

describe('hover-content resolveHover', () => {
  it('fremde Nation: kind=nation, Name + Truppen/Cap/% in den Zeilen', () => {
    const state = createGame(cfg())
    state.buildings.clear() // Gebäude isolieren, damit der Snap nicht greift
    const enemyTile = firstOwned(state, 2)
    expect(enemyTile).toBeGreaterThanOrEqual(0)

    const s = at(state, 1, enemyTile)
    expect(s.kind).toBe('nation')
    expect(s.title.text).toBe('Gegner')
    expect(s.titleColor).not.toBeNull()
    const body = bodyHtml(s)
    expect(body).toContain('Truppen')
    expect(body).toContain('%')
    expect(s.signature.length).toBeGreaterThan(0)
  })

  it('eigenes Land (ohne Gebäude): kind=own, Titel „Du"', () => {
    const state = createGame(cfg())
    state.buildings.clear()
    const myTile = firstOwned(state, 1)
    expect(myTile).toBeGreaterThanOrEqual(0)

    const s = at(state, 1, myTile)
    expect(s.kind).toBe('own')
    expect(s.title.text).toBe('Du')
  })

  it('unbeanspruchtes Land: kind=neutral', () => {
    const state = createGame(cfg())
    state.buildings.clear()
    const freeTile = firstOwned(state, 0)
    expect(freeTile).toBeGreaterThanOrEqual(0)

    const s = at(state, 1, freeTile)
    expect(s.kind).toBe('neutral')
  })

  it('Gebäude wird gesnappt: kind=building, Typ + Level + Effekt', () => {
    const state = createGame(cfg())
    state.buildings.clear()
    const tile = firstOwned(state, 1)
    const b: Building = { type: 'city', ownerId: 1, tile, level: 2, completesAtTick: 0 }
    state.buildings.set(tile, b)

    const s = at(state, 1, tile)
    expect(s.kind).toBe('building')
    expect(s.highlight).not.toBeNull()
    expect(s.highlight?.kind).toBe('building')
    // Level steht in den Titel-Extras, der Cap-Effekt in den Zeilen.
    expect(s.titleExtra.some((seg) => seg.text.includes('2'))).toBe(true)
    expect(bodyHtml(s)).toContain('Cap')
  })

  it('Signatur unterscheidet verschiedene Subjekte (Panel re-rendert nur bei Änderung)', () => {
    const state = createGame(cfg())
    state.buildings.clear()
    const a = at(state, 1, firstOwned(state, 2))
    const b = at(state, 1, firstOwned(state, 1))
    expect(a.signature).not.toBe(b.signature)
  })

  it('subjectHtml/titleHtml: Tooltip färbt den Namen, Panel zeigt einen Farbpunkt', () => {
    const state = createGame(cfg())
    state.buildings.clear()
    const s = at(state, 1, firstOwned(state, 2))
    // Tooltip-Stil: Name farbig (kein Punkt-Span).
    expect(subjectHtml(s)).toContain('Gegner')
    // Panel-Stil: führender Farbpunkt (border-radius:50%).
    expect(titleHtml(s, { dot: true })).toContain('border-radius:50%')
  })
})

describe('fmtCompact', () => {
  it('formatiert kompakt', () => {
    expect(fmtCompact(842)).toBe('842')
    expect(fmtCompact(12345)).toBe('12.3k')
    expect(fmtCompact(1_500_000)).toBe('1.5M')
  })
})
