/**
 * Regressionstest (Nacht-Fix): HUD-Panels dürfen nicht aus dem Bild wandern. Gespeicherte absolute
 * Pixel-Positionen werden beim Anwenden UND bei einem Fenster-Resize an den Viewport geklemmt.
 * Prüft den echten Event-Flow (window 'resize'), nicht nur den Ruhezustand.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { registerPanel, setPanel, unregisterPanel } from '../src/ui/hud-layout'

// Rect spiegelt die gesetzte style-Position wider (die echte Klemme rechnet über das gerenderte Rect).
function mockRect(el: HTMLElement, w: number, h: number): void {
  el.getBoundingClientRect = () => {
    const left = parseFloat(el.style.left) || 0
    const top = parseFloat(el.style.top) || 0
    return {
      width: w,
      height: h,
      top,
      left,
      right: left + w,
      bottom: top + h,
      x: left,
      y: top,
      toJSON: () => ({}),
    } as DOMRect
  }
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
  it('klemmt eine out-of-bounds-Position schon beim Anwenden GANZ ins Bild', () => {
    setViewport(500, 400)
    const el = panel('clamp-1', 100, 50)
    setPanel('clamp-1', { x: 9999, y: 9999 }) // weit ausserhalb
    expect(el.style.left).toBe('400px') // vw 500 - Breite 100 → Panel komplett sichtbar
    expect(el.style.top).toBe('350px') // vh 400 - Höhe 50
  })

  it('zieht ein Panel bei einem Fenster-Resize ganz zurück ins Bild', () => {
    setViewport(1200, 800)
    const el = panel('clamp-2', 100, 50)
    setPanel('clamp-2', { x: 1000, y: 700 }) // im grossen Fenster ok
    expect(el.style.left).toBe('1000px')
    setViewport(500, 400) // Fenster verkleinern
    window.dispatchEvent(new Event('resize'))
    expect(el.style.left).toBe('400px') // vw 500 - Breite 100
    expect(el.style.top).toBe('350px') // vh 400 - Höhe 50
  })

  it('lässt eine gültige Position unverändert', () => {
    setViewport(1000, 800)
    const el = panel('clamp-3', 120, 60)
    setPanel('clamp-3', { x: 200, y: 150 })
    expect(el.style.left).toBe('200px')
    expect(el.style.top).toBe('150px')
  })

  it('setzt ein viewport-größeres Panel links bündig (deckt den Viewport ab)', () => {
    setViewport(400, 300)
    const el = panel('clamp-4', 600, 50) // breiter als der Viewport
    setPanel('clamp-4', { x: 9999, y: 100 })
    expect(el.style.left).toBe('0px') // linke Kante bündig
    setPanel('clamp-4', { x: -9999, y: 100 })
    expect(el.style.left).toBe('0px') // ebenfalls linke Kante bündig (kein großer Rand)
  })
})
