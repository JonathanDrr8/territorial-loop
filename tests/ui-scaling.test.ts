/**
 * Regressionstests (Audit-Funde „UI verschiebt sich"): das Zusammenspiel von ui-scale (zoom)
 * und hud-layout (Override per transform: scale) darf nie doppelt skalieren, und der Viewport-
 * Clamp darf Prozent-Positionen (zentrierte Aktionsleiste, left: 50%) nicht als Pixel lesen.
 * Prüft den echten Event-Flow (refreshAutoScale wie beim Fenster-Resize), nicht nur Ruhezustand.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { registerPanel, setPanel, unregisterPanel, resetLayout } from '../src/ui/hud-layout'
import { registerScalable, clearScalables, refreshAutoScale } from '../src/ui/ui-scale'

function setViewport(w: number, h: number): void {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true })
}

function fixedRect(el: HTMLElement, r: { left: number; top: number; w: number; h: number }): void {
  el.getBoundingClientRect = () =>
    ({
      width: r.w,
      height: r.h,
      top: r.top,
      left: r.left,
      right: r.left + r.w,
      bottom: r.top + r.h,
      x: r.left,
      y: r.top,
      toJSON: () => ({}),
    }) as DOMRect
}

const created: string[] = []
function panel(id: string): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  fixedRect(el, { left: 10, top: 10, w: 100, h: 50 })
  created.push(id)
  return el
}

afterEach(() => {
  for (const id of created) unregisterPanel(id)
  created.length = 0
  resetLayout()
  clearScalables()
  window.localStorage.clear()
})

describe('ui-scale × hud-layout (Doppel-Skalierungs-Schutz)', () => {
  it('Override-Panel bekommt beim Auto-Rescale KEIN zoom zurück (kein Doppel-Zoom)', () => {
    setViewport(1900, 1060)
    const el = panel('p1')
    registerScalable(el)
    expect(el.style.zoom).not.toBe('') // skaliert normal mit
    registerPanel('p1', el)
    setPanel('p1', { x: 40, y: 40, s: 1.5 }) // HUD-Editor-Override → Layout besitzt die Skalierung
    expect(el.style.zoom).toBe('1')
    expect(el.style.transform).toBe('scale(1.5)')
    // Fenster-Resize → Auto-Rescale (der frühere Bug schrieb hier zoom auf ALLE Elemente zurück).
    setViewport(900, 700)
    refreshAutoScale()
    expect(el.style.zoom).toBe('1') // bleibt beim Layout — keine Doppel-Skalierung
    expect(el.style.transform).toBe('scale(1.5)')
  })

  it('resetLayout gibt das Panel an die Auto-Skalierung zurück', () => {
    setViewport(1900, 1060)
    refreshAutoScale() // Modul-globalen Maßstab auf diese Fenstergröße syncen (1.3)
    const el = panel('p2')
    registerScalable(el)
    registerPanel('p2', el)
    setPanel('p2', { x: 40, y: 40, s: 1.5 })
    expect(el.style.zoom).toBe('1')
    resetLayout()
    expect(el.style.zoom).not.toBe('1') // wieder normal skaliert (aktueller Auto-Maßstab)
    expect(el.style.transform).toBe('')
    // und folgt wieder dem Fenster:
    setViewport(900, 700)
    const before = el.style.zoom
    refreshAutoScale()
    expect(el.style.zoom).not.toBe(before)
  })

  it('app-lebenslange Elemente überleben clearScalables (Feedback-Knopf)', () => {
    setViewport(1900, 1060)
    refreshAutoScale() // Maßstab auf 1.3 syncen, damit der spätere Resize ihn wirklich ändert
    const keep = panel('keep')
    const drop = panel('drop')
    registerScalable(keep, true) // app-lebenslang
    registerScalable(drop)
    clearScalables() // Match-Start
    setViewport(900, 700)
    const keepBefore = keep.style.zoom
    const dropBefore = drop.style.zoom
    refreshAutoScale()
    expect(keep.style.zoom).not.toBe(keepBefore) // skaliert weiter mit
    expect(drop.style.zoom).toBe(dropBefore) // raus aus der Registry — unverändert
  })

  it('persistentes Element mit Override bleibt auch nach Match-Wechsel beim Layout (Audit-Fund)', () => {
    // Szenario Feedback-Knopf auf Mobile: app-lebenslang registriert, bekommt vom Default-Layout
    // einen Geometrie-Override — clearScalables (Match 2) darf ihn NICHT zurück in die Registry
    // holen, sonst schreibt der nächste Resize wieder zoom drauf (Doppel-Skalierung).
    setViewport(1900, 1060)
    refreshAutoScale()
    const el = panel('pfeedback')
    registerScalable(el, true) // app-lebenslang
    registerPanel('pfeedback', el)
    setPanel('pfeedback', { x: 0, y: 0 }) // Geometrie-Override → Layout besitzt die Skalierung
    expect(el.style.zoom).toBe('1')
    clearScalables() // Match-Start Nr. 2
    setViewport(900, 700)
    refreshAutoScale() // Resize/Rotation
    expect(el.style.zoom).toBe('1') // bleibt suspendiert — keine Doppel-Skalierung
    resetLayout() // „Standard" → zurück in die Auto-Skalierung, Persistenz bleibt
    expect(el.style.zoom).not.toBe('1')
    clearScalables()
    setViewport(1900, 1060)
    const before = el.style.zoom
    refreshAutoScale()
    expect(el.style.zoom).not.toBe(before) // überlebt clearScalables weiterhin (persistent)
  })
})

describe('clampToViewport mit Prozent-Position (zentrierte Aktionsleiste)', () => {
  it('kehrt nach einem Überlauf zu seinem Anker zurück, sobald wieder Platz ist', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    el.style.left = '50%'
    el.style.transform = 'translateX(-50%)'
    const W = 400 // Panel-Breite
    // Dynamisches Rect: spiegelt die AKTUELLEN Styles (Anker-Zentrierung vs. absolute px).
    el.getBoundingClientRect = () => {
      const vw = window.innerWidth
      const left = el.style.left.endsWith('%')
        ? (vw * parseFloat(el.style.left)) / 100 -
          (el.style.transform.includes('translate') ? W / 2 : 0)
        : parseFloat(el.style.left) || 0
      return {
        width: W,
        height: 60,
        top: 100,
        left,
        right: left + W,
        bottom: 160,
        x: left,
        y: 100,
        toJSON: () => ({}),
      } as DOMRect
    }
    created.push('anchor')
    registerPanel('anchor', el)
    // 1) Schmales Fenster → Überlauf → Clamp konvertiert auf absolute px (Anker gesichert).
    setViewport(300, 600)
    window.dispatchEvent(new Event('resize'))
    expect(el.style.left).toBe('0px')
    expect(el.style.transform).toBe('none')
    // 2) Fenster wieder breit → Anker wird wiederhergestellt (Zentrierung kehrt zurück).
    setViewport(800, 600)
    window.dispatchEvent(new Event('resize'))
    expect(el.style.left).toBe('50%')
    expect(el.style.transform).toBe('translateX(-50%)')
  })

  it('liest left:50% nicht als 50px und neutralisiert den Translate-Anteil', () => {
    setViewport(300, 600)
    const el = document.createElement('div')
    document.body.appendChild(el)
    el.style.left = '50%'
    el.style.transform = 'translateX(-50%)'
    // Visuell: 400 breit, zentriert auf 300-Viewport → rect.left = -50, right = 350 (Überlauf).
    fixedRect(el, { left: -50, top: 100, w: 400, h: 60 })
    created.push('center')
    registerPanel('center', el) // apply ohne Override → kein Clamp; Resize löst ihn aus:
    window.dispatchEvent(new Event('resize'))
    // Früher: parseFloat('50%') = 50 → left = 100px + translate blieb → völlig falsche Position.
    // Jetzt: Basis aus dem Rect (-50), Überlauf-Korrektur → linksbündig, Translate entfernt.
    expect(el.style.transform).toBe('none')
    expect(el.style.left).toBe('0px')
  })
})
