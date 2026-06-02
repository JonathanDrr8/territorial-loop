/**
 * In-Game-Einstellungen, erreichbar über das Pause-/Esc-Menü. Bündelt die Settings, die man
 * **während** einer Partie ändern will: Audio-Lautstärken (live auf die Sound-/Musik-Engine) und
 * die Radialmenü-Größe. Reine Client-Präferenz (kein Sim/MP-Einfluss), folgt dem Theme.
 */

import { t } from '../i18n'
import { panelStyle } from './theme'
import { makeSelectRow, makeSliderRow } from './start-menu'
import { loadAudioVolumes, saveAudioVolumes, type AudioVolumes } from './preferences'
import { getHudPrefs, setHudPref, type RadialSize } from './hud-prefs'
import { createKeybindSection } from './keybind-settings'

export interface GameSettingsDeps {
  /** Live anwenden: Master/SFX/Musik (je 0..1) auf die laufende Sound-/Musik-Engine. */
  onAudio: (v: AudioVolumes) => void
}

export interface GameSettingsApi {
  open(): void
  close(): void
  isOpen(): boolean
  destroy(): void
}

export function createGameSettings(
  container: HTMLElement,
  deps: GameSettingsDeps,
): GameSettingsApi {
  let open = false

  const backdrop = document.createElement('div')
  backdrop.style.cssText = [
    'position: absolute',
    'inset: 0',
    'background: rgba(0,0,0,0.5)',
    'display: none',
    'align-items: center',
    'justify-content: center',
    'z-index: 49',
    'pointer-events: auto',
  ].join(';')

  const box = document.createElement('div')
  box.style.cssText = panelStyle([
    'min-width: 300px',
    'max-width: 420px',
    'max-height: 84vh',
    'overflow-y: auto',
    'padding: 20px 22px',
    'display: flex',
    'flex-direction: column',
    'gap: 8px',
    'box-shadow: 0 18px 60px rgba(0,0,0,0.55)',
  ])
  backdrop.appendChild(box)

  const title = document.createElement('div')
  title.textContent = t('pause.settings')
  title.style.cssText =
    'font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: var(--tl-accent); margin-bottom: 4px'
  box.appendChild(title)

  /** Kleine Abschnitts-Überschrift. */
  function header(label: string): void {
    const h = document.createElement('div')
    h.textContent = label
    h.style.cssText =
      'font-size: 12px; font-weight: 700; opacity: 0.75; margin: 8px 0 2px; color: var(--tl-text)'
    box.appendChild(h)
  }

  // ---- Audio (live + persistiert) ----
  header(t('settings.audio'))
  const av = loadAudioVolumes()
  const master = makeSliderRow(t('field.master'), 0, 100, 5, Math.round(av.master * 100), '%')
  const sfx = makeSliderRow(t('field.sound'), 0, 100, 5, Math.round(av.sfx * 100), '%')
  const music = makeSliderRow(t('field.music'), 0, 100, 5, Math.round(av.music * 100), '%')
  const applyAudio = (): void => {
    const v: AudioVolumes = {
      master: master.getValue() / 100,
      sfx: sfx.getValue() / 100,
      music: music.getValue() / 100,
    }
    saveAudioVolumes(v)
    deps.onAudio(v)
  }
  for (const r of [master, sfx, music]) {
    r.element.querySelector('input[type=range]')?.addEventListener('input', applyAudio)
    box.appendChild(r.element)
  }

  // ---- Anzeige (Radialmenü-Größe; makeSelectRow beschriftet sich selbst) ----
  const radial = makeSelectRow<RadialSize>(
    t('settings.radialSize'),
    [
      ['small', t('settings.radialSize.small')],
      ['normal', t('settings.radialSize.normal')],
      ['large', t('settings.radialSize.large')],
    ],
    getHudPrefs().radialSize,
  )
  radial.element.querySelector('select')?.addEventListener('change', () => {
    setHudPref('radialSize', radial.getValue())
  })
  box.appendChild(radial.element)

  // ---- Tastenbelegung (umbelegbare Aktions-Tasten) ----
  const keybinds = createKeybindSection()
  box.appendChild(keybinds.element)

  // ---- Fertig ----
  const done = document.createElement('button')
  done.type = 'button'
  done.textContent = t('hud.editor.done')
  done.style.cssText = [
    'margin-top: 14px',
    'padding: 11px 14px',
    'font-family: var(--tl-font)',
    'font-size: 14px',
    'font-weight: 700',
    'cursor: pointer',
    'border-radius: 8px',
    'border: none',
    'background: var(--tl-accent)',
    'color: #0c0c10',
  ].join(';')
  done.addEventListener('click', () => {
    setOpen(false)
  })
  box.appendChild(done)

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) setOpen(false)
  })

  function setOpen(v: boolean): void {
    open = v
    backdrop.style.display = v ? 'flex' : 'none'
    if (!v) keybinds.cancelCapture() // beim Schließen keine offene Tasten-Erfassung stehen lassen
  }

  container.appendChild(backdrop)

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => open,
    destroy(): void {
      keybinds.destroy()
      backdrop.remove()
    },
  }
}
