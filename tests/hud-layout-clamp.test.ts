/**
 * Regressionstest (Nacht-Fix): HUD-Panels dürfen nicht aus dem Bild wandern. Gespeicherte absolute
 * Pixel-Positionen werden beim Anwenden UND bei einem Fenster-Resize an den Viewport geklemmt.
 * Prüft den echten Event-Flow (window 'resize'), nicht nur den Ruhezustand.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { registerPanel, setPanel, unregisterPanel } from '../src/ui/hud-layout'

function mockRect(el: HTMLElement, w: number, h: number): void {
  el.getBoundingClientRect = () =>
    ({
      width: w,
      height: h,
      top: 0,
      left: 0,
      right: w,
      bottom: h,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect
}

function setViewport(w: number, h: number): void {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true })
}

const created: string[] = []
function panel(id: string, w: number, h: number): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  mockRect(el, w, h)
  registerPanel(id, el)
  created.push(id)
  return el
}

afterEach(() => {
  for (const id of created) unregisterPanel(id)
  created.length = 0
})

describe('HUD-Layout: Panels bleiben im Viewport', () => {
  it('klemmt eine out-of-bounds-Position schon beim Anwenden in den sichtbaren Bereich', () => {
    setViewport(500, 400)
    const el = panel('clamp-1', 100, 50)
    setPanel('clamp-1', { x: 9999, y: 9999 }) // weit ausserhalb
    expect(el.style.left).toBe('476px') // vw 500 - MARGIN 24 (24px bleiben sichtbar)
    expect(el.style.top).toBe('376px') // vh 400 - MARGIN 24
  })

  it('zieht ein Panel bei einem Fenster-Resize zurück ins Bild', () => {
    setViewport(1200, 800)
    const el = panel('clamp-2', 100, 50)
    setPanel('clamp-2', { x: 1000, y: 700 }) // im grossen Fenster ok
    expect(el.style.left).toBe('1000px')
    setViewport(500, 400) // Fenster verkleinern
    window.dispatchEvent(new Event('resize'))
    expect(el.style.left).toBe('476px')
    expect(el.style.top).toBe('376px')
  })

  it('lässt eine gültige Position unverändert', () => {
    setViewport(1000, 800)
    const el = panel('clamp-3', 120, 60)
    setPanel('clamp-3', { x: 200, y: 150 })
    expect(el.style.left).toBe('200px')
    expect(el.style.top).toBe('150px')
  })
})
