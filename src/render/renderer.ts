/**
 * Pixi.js-Renderer mit Torus-Wrap.
 *
 * Ansatz:
 * - Wir halten einen Offscreen-Canvas in Map-Auflösung (z.B. 256×256), in den
 *   wir pro Frame die State-Bitmap rein-malen (Owner → Player-Farbe).
 * - Dieser Canvas wird als Pixi-Texture genutzt, eingespannt in eine `TilingSprite`
 *   die den gesamten Viewport bedeckt. TilingSprite repliziert die Texture
 *   automatisch in beide Achsen — **das ist unser Torus-Wrap**, ganz ohne Shader.
 * - Camera = `tilePosition` + `tileScale` der TilingSprite.
 *
 * Screen-to-World: invertiert die Camera-Transform; das Resultat sind float-
 * Welt-Koordinaten die der Caller noch via `tileRef(...)` in einen Tile-Index
 * umwandelt (TileRef wrappt selber).
 */

import { Application, TilingSprite, Texture } from 'pixi.js'

import type { GameState } from '../core/game'

export interface Camera {
  /** Welt-Koord die am Screen-Center erscheint. */
  x: number
  y: number
  /** Zoom-Faktor: 1 = pixelgenau, 2 = doppelt gross, 0.5 = halb. */
  zoom: number
}

export interface Renderer {
  readonly app: Application
  readonly camera: Camera
  /** Liest den aktuellen GameState aus und zeichnet einen Frame. */
  render(): void
  /** Konvertiert eine Maus-Position (in CSS-Pixeln relativ zum Canvas) in Welt-Koords. */
  screenToWorld(screenX: number, screenY: number): { readonly x: number; readonly y: number }
  destroy(): void
}

const NEUTRAL_R = 30
const NEUTRAL_G = 30
const NEUTRAL_B = 35

const OWNER_MASK = 0x0fff

export async function createRenderer(container: HTMLElement, state: GameState): Promise<Renderer> {
  const app = new Application()
  await app.init({
    width: container.clientWidth,
    height: container.clientHeight,
    background: '#0a0a10',
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })
  container.appendChild(app.canvas)

  // Offscreen canvas in Map-Auflösung
  const offscreen = document.createElement('canvas')
  offscreen.width = state.map.width
  offscreen.height = state.map.height
  const maybeCtx = offscreen.getContext('2d')
  if (maybeCtx === null) {
    throw new Error('Renderer: 2D context not available')
  }
  const ctx: CanvasRenderingContext2D = maybeCtx
  const imageData = ctx.createImageData(state.map.width, state.map.height)

  const texture = Texture.from(offscreen)
  texture.source.scaleMode = 'nearest'

  const sprite = new TilingSprite({
    texture,
    width: app.screen.width,
    height: app.screen.height,
  })
  app.stage.addChild(sprite)

  const camera: Camera = {
    x: state.map.width / 2,
    y: state.map.height / 2,
    zoom: 2,
  }

  function paintBitmap(): void {
    const data = imageData.data
    const mapState = state.map.state
    const players = state.players
    const len = mapState.length

    // Mini-LUT pro Frame: ownerId → [r,g,b,a]
    const lut = new Map<number, readonly [number, number, number, number]>()
    for (const p of players.values()) {
      lut.set(p.id, [
        (p.color >>> 24) & 0xff,
        (p.color >>> 16) & 0xff,
        (p.color >>> 8) & 0xff,
        p.color & 0xff,
      ])
    }

    for (let i = 0; i < len; i++) {
      const v = mapState[i]
      if (v === undefined) continue
      const owner = v & OWNER_MASK
      const o = i * 4
      if (owner === 0) {
        data[o] = NEUTRAL_R
        data[o + 1] = NEUTRAL_G
        data[o + 2] = NEUTRAL_B
        data[o + 3] = 255
      } else {
        const rgba = lut.get(owner)
        if (rgba === undefined) {
          // Unknown owner — render bright magenta as a warning
          data[o] = 255
          data[o + 1] = 0
          data[o + 2] = 255
          data[o + 3] = 255
        } else {
          data[o] = rgba[0]
          data[o + 1] = rgba[1]
          data[o + 2] = rgba[2]
          data[o + 3] = rgba[3]
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
    texture.source.update()
  }

  function syncCamera(): void {
    const halfW = app.screen.width / 2
    const halfH = app.screen.height / 2
    sprite.tileScale.set(camera.zoom)
    sprite.tilePosition.x = halfW - camera.x * camera.zoom
    sprite.tilePosition.y = halfH - camera.y * camera.zoom
    sprite.width = app.screen.width
    sprite.height = app.screen.height
  }

  function render(): void {
    paintBitmap()
    syncCamera()
  }

  function screenToWorld(
    screenX: number,
    screenY: number,
  ): { readonly x: number; readonly y: number } {
    const halfW = app.screen.width / 2
    const halfH = app.screen.height / 2
    return {
      x: (screenX - halfW) / camera.zoom + camera.x,
      y: (screenY - halfH) / camera.zoom + camera.y,
    }
  }

  function destroy(): void {
    app.destroy(true, { children: true, texture: true })
  }

  // Resize-Handler: TilingSprite an Viewport anpassen
  function handleResize(): void {
    app.renderer.resize(container.clientWidth, container.clientHeight)
    sprite.width = app.screen.width
    sprite.height = app.screen.height
  }
  window.addEventListener('resize', handleResize)

  return { app, camera, render, screenToWorld, destroy }
}
