/**
 * Layout-Speicher fürs konfigurierbare HUD (ADR-0024 Phase 2): Overrides je Panel-ID setzen,
 * persistieren, beim Anmelden anwenden, zurücksetzen. Reine Client-Präferenz (localStorage).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getPanel, registerPanel, resetLayout, setPanel } from '../src/ui/hud-layout'

const KEY = 'territorial-loop:hud-layout:v1'

beforeEach(() => {
  resetLayout()
  window.localStorage.clear()
})

describe('hud-layout (ADR-0024 Phase 2)', () => {
  it('setPanel mergt + persistiert, getPanel liest zurück', () => {
    setPanel('resource', { x: 100 })
    setPanel('resource', { y: 50, s: 1.2 })
    expect(getPanel('resource')).toEqual({ x: 100, y: 50, s: 1.2 })
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    expect(stored.resource).toEqual({ x: 100, y: 50, s: 1.2 })
  })

  it('registerPanel wendet einen vorhandenen Override aufs Element an', () => {
    setPanel('rank', { x: 30, y: 40, s: 1.5 })
    const el = document.createElement('div')
    registerPanel('rank', el)
    expect(el.style.left).toBe('30px')
    expect(el.style.right).toBe('auto')
    expect(el.style.top).toBe('40px')
    expect(el.style.transform).toBe('scale(1.5)')
  })

  it('ohne Override bleibt das Element unangetastet (Standard-Stelle)', () => {
    const el = document.createElement('div')
    el.style.bottom = '12px'
    registerPanel('feed', el)
    expect(el.style.left).toBe('')
    expect(el.style.transform).toBe('')
    expect(el.style.bottom).toBe('12px')
  })

  it('hidden blendet aus; w/h setzen Größe', () => {
    const el = document.createElement('div')
    registerPanel('minimap', el)
    setPanel('minimap', { w: 240, h: 180, hidden: true })
    expect(el.style.width).toBe('240px')
    expect(el.style.height).toBe('180px')
    expect(el.style.display).toBe('none')
  })

  it('resetLayout löscht Overrides + setzt Inline-Styles zurück', () => {
    const el = document.createElement('div')
    registerPanel('action', el)
    setPanel('action', { x: 10, y: 10, s: 1.3 })
    expect(el.style.left).toBe('10px')
    resetLayout()
    expect(getPanel('action')).toBeUndefined()
    expect(el.style.left).toBe('')
    expect(el.style.transform).toBe('')
  })
})
