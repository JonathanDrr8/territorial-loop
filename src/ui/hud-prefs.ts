/**
 * Layout-Präferenzen fürs HUD (ADR-0024): **wo der Angriffs-Slider sitzt** (`sliderHome`) und
 * **wie die Kauf-Knöpfe angeordnet sind** (`buttonsLayout`: Reihe oder 3×3-Numpad). Reine
 * Client-Präferenz (localStorage), kein Sim-Determinismus / nicht im State-Hash → multiplayer-sicher.
 *
 * Geteilt zwischen `hud.ts` (rendert das HUD danach) und `hud-editor.ts` (schaltet im Editor um).
 * Listener werden bei jeder Änderung benachrichtigt, damit das HUD **live** re-rendert.
 */

/** Heimat des Angriffs-Sliders: im Aktions-Panel (Default) oder beim Truppen-Block. */
export type SliderHome = 'action' | 'resource'
/** Anordnung der Kauf-Knöpfe: zwei Reihen (Default) oder 3×3-Numpad auf den Hotkey-Positionen. */
export type ButtonsLayout = 'row' | 'numpad'
/** Darstellung der Truppen-Anzeige: klassischer Balken oder füllende Kugel. */
export type TroopStyle = 'bar' | 'orb'
/**
 * Steuerungs-Modus: `auto` erkennt Touch-Geräte selbst; `touch` erzwingt das Mobile-Layout
 * (immer sichtbares Eck-Rad + Minimap oben rechts) auch am Desktop; `desktop` erzwingt das
 * klassische Layout (Tastatur + Rechtsklick/E, kein Eck-Rad).
 */
export type ControlMode = 'auto' | 'desktop' | 'touch'
/** Größe des radialen Kontextmenüs (Rechtsklick/Long-Press) + Eck-Rad. */
export type RadialSize = 'small' | 'normal' | 'large'

/** Skalierungsfaktor je Radialgröße. */
export const RADIAL_SCALE: Record<RadialSize, number> = { small: 0.82, normal: 1, large: 1.25 }

export interface HudPrefs {
  sliderHome: SliderHome
  buttonsLayout: ButtonsLayout
  /** Truppen-Block in Einzelteile (Zahl / Balken / Gold) aufgeteilt? */
  resourceSplit: boolean
  /** Aktions-Block in Einzelteile (Käufe / Boot) aufgeteilt? */
  actionSplit: boolean
  /** Truppen-Anzeige-Stil (Balken/Kugel). Default Kugel auf Touch-Geräten, sonst Balken. */
  troopStyle: TroopStyle
  /** Steuerungs-Modus (siehe [[ControlMode]]). Default `auto`. */
  controlMode: ControlMode
  /** Größe des radialen Menüs (Rechtsklick/Long-Press + Eck-Rad). Default `normal`. */
  radialSize: RadialSize
}

const KEY = 'territorial-loop:hud-prefs:v1'

/** Touch-Gerät? (grobe Heuristik — bestimmt den Default-Truppen-Stil.) */
function isTouchDevice(): boolean {
  try {
    return (
      navigator.maxTouchPoints > 0 ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
    )
  } catch {
    return false
  }
}

const DEFAULTS: HudPrefs = {
  sliderHome: 'action',
  buttonsLayout: 'row',
  resourceSplit: false,
  actionSplit: false,
  troopStyle: 'bar',
  controlMode: 'auto',
  radialSize: 'normal',
}

const listeners = new Set<(p: HudPrefs) => void>()

function load(): HudPrefs {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw) as Partial<HudPrefs>
      return {
        sliderHome: parsed.sliderHome === 'resource' ? 'resource' : 'action',
        buttonsLayout: parsed.buttonsLayout === 'numpad' ? 'numpad' : 'row',
        resourceSplit: parsed.resourceSplit === true,
        actionSplit: parsed.actionSplit === true,
        // Ohne gespeicherten Wert: Kugel auf Touch (Mobile-Default), sonst Balken.
        troopStyle:
          parsed.troopStyle === 'orb'
            ? 'orb'
            : parsed.troopStyle === 'bar'
              ? 'bar'
              : isTouchDevice()
                ? 'orb'
                : 'bar',
        controlMode:
          parsed.controlMode === 'touch' || parsed.controlMode === 'desktop'
            ? parsed.controlMode
            : 'auto',
        radialSize:
          parsed.radialSize === 'small' || parsed.radialSize === 'large'
            ? parsed.radialSize
            : 'normal',
      }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS, troopStyle: isTouchDevice() ? 'orb' : 'bar' }
}

let prefs = load()

function save(): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

/** Aktuelle Präferenzen (Kopie). */
export function getHudPrefs(): HudPrefs {
  return { ...prefs }
}

/** Eine Präferenz setzen + persistieren + alle Listener benachrichtigen. */
export function setHudPref<K extends keyof HudPrefs>(key: K, value: HudPrefs[K]): void {
  if (prefs[key] === value) return
  prefs = { ...prefs, [key]: value }
  save()
  for (const fn of listeners) fn(getHudPrefs())
}

/** Bei Änderungen benachrichtigt werden. Gibt eine Abmelde-Funktion zurück. */
export function onHudPrefsChange(fn: (p: HudPrefs) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
