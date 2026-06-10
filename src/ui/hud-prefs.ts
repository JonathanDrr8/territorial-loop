/**
 * Layout-Präferenzen fürs HUD (ADR-0024): **wo der Angriffs-Slider sitzt** (`sliderHome`) und
 * **wie die Kauf-Knöpfe angeordnet sind** (`buttonsLayout`: Reihe oder 3×3-Numpad). Reine
 * Client-Präferenz (localStorage), kein Sim-Determinismus / nicht im State-Hash → multiplayer-sicher.
 *
 * Geteilt zwischen `hud.ts` (rendert das HUD danach) und `hud-editor.ts` (schaltet im Editor um).
 * Listener werden bei jeder Änderung benachrichtigt, damit das HUD **live** re-rendert.
 */

import { MAX_BUILDING_LEVEL } from '../core/buildings'

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
  /**
   * Wie viele Nationen-Namen außerhalb des Bildschirms (an den Rand geklemmt) gezeigt werden —
   * die jeweils **nächsten X** zur Bildmitte. 0 = aus. Default 7. (Wilde zählen nie mit; eine
   * Nation, die dich gerade angreift, bleibt zur Warnung immer sichtbar.)
   */
  offscreenLabelCount: number
  /**
   * Verzögerung (ms), bevor ein Touch-Tipp als Angriff feuert — das Fenster, in dem ein zweiter
   * Tipp stattdessen den Doppeltipp-Zoom auslöst. 0 = aus (Angriff sofort, kein Doppeltipp-Zoom,
   * dafür schnelleres Antippen). Default 250.
   */
  tapAttackDelayMs: number
  /**
   * RTS-Kommandoleiste (ADR-0010/Design-Doc, Opt-in): Truppen/Gold + Aktions-Block wandern in eine
   * durchgehende Leiste am unteren Rand (klassisches RTS-Layout). Default aus — bestehendes HUD
   * unverändert. Nur Desktop (breite Viewports); reine Client-Präferenz, kein Sim-Einfluss.
   */
  commandBar: boolean
  /**
   * Zuletzt gewähltes Bau-Level (Level-Direktbau): 1..MAX_BUILDING_LEVEL. Wird gemerkt und beim
   * nächsten Bau-Modus vorgewählt (Jonathans „merkt sich, was man zuletzt gedrückt hat"). Reine
   * Client-Präferenz — geht nicht in den Sim-State (jeder Build-Intent trägt sein Level explizit).
   */
  buildLevel: number
}

/** Erlaubter Bereich für [[HudPrefs.offscreenLabelCount]]. */
export const OFFSCREEN_LABEL_MIN = 0
export const OFFSCREEN_LABEL_MAX = 30
export const OFFSCREEN_LABEL_DEFAULT = 7

/** Erlaubter Bereich für [[HudPrefs.tapAttackDelayMs]] (ms). */
export const TAP_ATTACK_DELAY_MIN = 0
export const TAP_ATTACK_DELAY_MAX = 400
export const TAP_ATTACK_DELAY_DEFAULT = 250

/** Default-Bau-Level (Level-Direktbau). */
export const BUILD_LEVEL_DEFAULT = 1

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
  offscreenLabelCount: OFFSCREEN_LABEL_DEFAULT,
  tapAttackDelayMs: TAP_ATTACK_DELAY_DEFAULT,
  buildLevel: BUILD_LEVEL_DEFAULT,
  commandBar: false,
}

/** Clamped/validierter Off-Screen-Label-Wert aus rohem Input (Fallback = Default). */
function clampOffscreen(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return OFFSCREEN_LABEL_DEFAULT
  return Math.max(OFFSCREEN_LABEL_MIN, Math.min(OFFSCREEN_LABEL_MAX, Math.round(v)))
}

/** Clamped/validierte Tipp-Angriff-Verzögerung (ms) aus rohem Input (Fallback = Default). */
function clampTapDelay(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return TAP_ATTACK_DELAY_DEFAULT
  return Math.max(TAP_ATTACK_DELAY_MIN, Math.min(TAP_ATTACK_DELAY_MAX, Math.round(v)))
}

/** Clamped/validiertes Bau-Level (1..MAX) aus rohem Input (Fallback = Default). */
function clampBuildLevel(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return BUILD_LEVEL_DEFAULT
  return Math.max(1, Math.min(MAX_BUILDING_LEVEL, Math.round(v)))
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
        offscreenLabelCount: clampOffscreen(parsed.offscreenLabelCount),
        tapAttackDelayMs: clampTapDelay(parsed.tapAttackDelayMs),
        buildLevel: clampBuildLevel(parsed.buildLevel),
        commandBar: parsed.commandBar === true,
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

/** Mehrere Präferenzen auf einmal setzen (z. B. ein Layout-Preset) — eine Benachrichtigung. */
export function setHudPrefs(patch: Partial<HudPrefs>): void {
  const next = { ...prefs, ...patch }
  let changed = false
  for (const k of Object.keys(next) as (keyof HudPrefs)[]) {
    if (prefs[k] !== next[k]) changed = true
  }
  if (!changed) return
  prefs = next
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
