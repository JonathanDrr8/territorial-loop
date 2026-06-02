/**
 * Layout-Presets fürs HUD (ADR-0028, „Beides"): **feste** Steuerungs-Modus-Presets (Standard /
 * Maus / Navigations-Rad) PLUS **speicherbare eigene Slots**. Ein Preset bündelt Panel-Overrides
 * (Position/Größe/Sichtbarkeit aus `hud-layout`) UND die HUD-Prefs (Steuerung, Anzeige …).
 *
 * - **Feste Presets** setzen vor allem Prefs (Steuerungs-Modus etc.) + setzen das Layout zurück →
 *   robust auf jeder Bildschirmgröße (Default-Anker bleiben).
 * - **Eigene Slots** erfassen die EXAKTE aktuelle Anordnung (der Nutzer hat sie auf seinem
 *   Bildschirm gebaut) → absolute Positionen sind hier in Ordnung.
 *
 * Reine Client-Präferenz (localStorage), kein Sim-Determinismus → multiplayer-sicher.
 */

import { getLayoutSnapshot, resetLayout, setPanel, type PanelOverride } from './hud-layout'
import { getHudPrefs, setHudPrefs, type HudPrefs } from './hud-prefs'
// Vorgebaute Default-Layouts (ADR-0028): per Dev-Tool („Als Standard speichern", nur `npm run dev`)
// in DIESE Datei geschrieben → ins Spiel eingebaut (für alle Spieler). Leer {} = der hartkodierte
// Fallback unten greift. Siehe `saveFixedAsDefault` + den Vite-Dev-Endpunkt in vite.config.ts.
import builtinDefaults from './hud-presets.defaults.json'

interface PresetData {
  /** Panel-Overrides je Panel-ID. Leer = Default-Anordnung (nach resetLayout). */
  layout: Record<string, PanelOverride>
  /** Zu setzende HUD-Prefs. */
  prefs: Partial<HudPrefs>
}

/** Vorgebaute Defaults aus der JSON (Dev-Tool-Output) — überschreiben den hartkodierten Fallback. */
const PREBUILT = builtinDefaults as Record<string, PresetData>

/** Hartkodierter Fallback. Setzen Layout zurück + wählen einen Steuerungs-Modus (robust). */
const FIXED: Record<string, PresetData> = {
  standard: {
    layout: {},
    prefs: {
      controlMode: 'auto',
      buttonsLayout: 'row',
      sliderHome: 'action',
      resourceSplit: false,
      actionSplit: false,
      troopStyle: 'bar',
      radialSize: 'normal',
    },
  },
  mouse: {
    layout: {},
    prefs: {
      controlMode: 'desktop',
      buttonsLayout: 'row',
      troopStyle: 'bar',
      radialSize: 'normal',
    },
  },
  wheel: {
    layout: {},
    prefs: { controlMode: 'touch', troopStyle: 'orb', radialSize: 'large' },
  },
}

/** IDs der festen Presets (Reihenfolge im Dropdown). */
export const FIXED_PRESET_IDS = ['standard', 'mouse', 'wheel'] as const
export type FixedPresetId = (typeof FIXED_PRESET_IDS)[number]

const KEY = 'territorial-loop:hud-presets:v1'

function loadUser(): Record<string, PresetData> {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw !== null) return JSON.parse(raw) as Record<string, PresetData>
  } catch {
    /* ignore */
  }
  return {}
}

let userPresets = loadUser()

function saveUser(): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(userPresets))
  } catch {
    /* ignore */
  }
}

/** Namen aller eigenen Slots (in Einfüge-Reihenfolge). */
export function listUserPresets(): string[] {
  return Object.keys(userPresets)
}

/** Aktuelle Anordnung (Layout + Prefs) unter `name` als eigenen Slot speichern (überschreibt gleichnamigen). */
export function saveUserPreset(name: string): void {
  const trimmed = name.trim()
  if (trimmed === '') return
  userPresets = { ...userPresets, [trimmed]: { layout: getLayoutSnapshot(), prefs: getHudPrefs() } }
  saveUser()
}

/** Eigenen Slot löschen. */
export function deleteUserPreset(name: string): void {
  if (!(name in userPresets)) return
  const next: Record<string, PresetData> = {}
  for (const [k, v] of Object.entries(userPresets)) {
    if (k !== name) next[k] = v
  }
  userPresets = next
  saveUser()
}

/* ---- Überschreibbare feste Presets ----------------------------------------------------------
 * Standard/Maus/Navigations-Rad lassen sich im Editor mit der aktuellen Anordnung überschreiben
 * (eigener Speicher); „Zurücksetzen" entfernt den Override → der eingebaute Default greift wieder. */
const FIXED_KEY = 'territorial-loop:hud-presets-fixed:v1'

function loadFixedOverrides(): Record<string, PresetData> {
  try {
    const raw = window.localStorage.getItem(FIXED_KEY)
    if (raw !== null) return JSON.parse(raw) as Record<string, PresetData>
  } catch {
    /* ignore */
  }
  return {}
}

let fixedOverrides = loadFixedOverrides()

function saveFixedStore(): void {
  try {
    window.localStorage.setItem(FIXED_KEY, JSON.stringify(fixedOverrides))
  } catch {
    /* ignore */
  }
}

/** Aktuelle Anordnung (Layout + Prefs) als Override für ein festes Preset sichern. */
export function saveFixedPreset(id: FixedPresetId): void {
  fixedOverrides = {
    ...fixedOverrides,
    [id]: { layout: getLayoutSnapshot(), prefs: getHudPrefs() },
  }
  saveFixedStore()
}

/** Override eines festen Presets entfernen → eingebauter Default greift wieder. */
export function resetFixedPreset(id: FixedPresetId): void {
  if (!(id in fixedOverrides)) return
  const next: Record<string, PresetData> = {}
  for (const [k, v] of Object.entries(fixedOverrides)) {
    if (k !== id) next[k] = v
  }
  fixedOverrides = next
  saveFixedStore()
}

/** Hat ein festes Preset einen eigenen Override (≠ eingebauter Default)? */
export function hasFixedOverride(id: FixedPresetId): boolean {
  return id in fixedOverrides
}

function apply(data: PresetData): void {
  // Immer auf einen sauberen Stand: erst alle Overrides löschen, dann die des Presets setzen.
  resetLayout()
  for (const [id, ov] of Object.entries(data.layout)) setPanel(id, ov)
  setHudPrefs(data.prefs)
}

/** Ein festes Preset (per ID) anwenden — lokaler Override, sonst vorgebauter Default (JSON), sonst Fallback. */
export function applyFixedPreset(id: FixedPresetId): void {
  const def = fixedOverrides[id] ?? PREBUILT[id] ?? FIXED[id]
  if (def !== undefined) apply(def)
}

/**
 * NUR DEV (`npm run dev`): speichert die aktuelle Anordnung als **eingebauten Standard** für ein festes
 * Preset — schreibt sie über den Vite-Dev-Endpunkt in `hud-presets.defaults.json` (kommt damit ins
 * Spiel für alle Spieler, nach Commit). Im Live-Build kein Effekt (Endpunkt fehlt). Gibt Erfolg zurück.
 */
export async function saveFixedAsDefault(id: FixedPresetId): Promise<boolean> {
  const data: PresetData = { layout: getLayoutSnapshot(), prefs: getHudPrefs() }
  try {
    const res = await fetch('/__save-hud-default', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, data }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Einen eigenen Slot (per Name) anwenden. */
export function applyUserPreset(name: string): void {
  const def = userPresets[name]
  if (def !== undefined) apply(def)
}
