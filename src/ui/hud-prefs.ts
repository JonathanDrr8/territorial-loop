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

export interface HudPrefs {
  sliderHome: SliderHome
  buttonsLayout: ButtonsLayout
  /** Truppen-Block in Einzelteile (Zahl / Balken / Gold) aufgeteilt? */
  resourceSplit: boolean
  /** Aktions-Block in Einzelteile (Käufe / Boot) aufgeteilt? */
  actionSplit: boolean
}

const KEY = 'territorial-loop:hud-prefs:v1'
const DEFAULTS: HudPrefs = {
  sliderHome: 'action',
  buttonsLayout: 'row',
  resourceSplit: false,
  actionSplit: false,
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
      }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS }
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
