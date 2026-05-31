/**
 * LocalStorage-Persistence für Start-Menü-Einstellungen.
 *
 * Speichert nicht-determinismus-relevante Werte (Name, Map-Größe, KI-Anzahl, …),
 * damit Spieler nicht jedes Mal neu konfigurieren müssen. Der Seed des Matches
 * bleibt random — wir merken nur die Defaults.
 *
 * Fehlertolerant: localStorage-Errors (Privacy-Modus, Quota) führen zu Default-
 * Werten ohne Exception.
 */

import type {
  CameraMode,
  Difficulty,
  ExperimentalFlags,
  MatchTempo,
  StartMenuValues,
  TerrainChoice,
} from './start-menu'
import { DIFFICULTIES as AI_DIFFICULTIES } from '../ai/ai'

const STORAGE_KEY = 'territorial-loop:menu-prefs:v1'

const DIFFICULTIES: ReadonlySet<Difficulty> = new Set<Difficulty>(AI_DIFFICULTIES)
const TEMPOS: ReadonlySet<MatchTempo> = new Set<MatchTempo>(['fast', 'normal', 'siege'])
const TERRAINS: ReadonlySet<TerrainChoice> = new Set<TerrainChoice>([
  'flat',
  'continents',
  'islands',
])
const MAP_DIMS: ReadonlySet<number> = new Set<number>([256, 512, 768, 1024, 1536, 2048])
const CAMERA_MODES: ReadonlySet<CameraMode> = new Set<CameraMode>([
  'tiles',
  'period',
  'fixed',
  'dynamic',
])

function isCameraMode(v: unknown): v is CameraMode {
  return typeof v === 'string' && CAMERA_MODES.has(v as CameraMode)
}

function isDifficulty(v: unknown): v is Difficulty {
  return typeof v === 'string' && DIFFICULTIES.has(v as Difficulty)
}

function isTempo(v: unknown): v is MatchTempo {
  return typeof v === 'string' && TEMPOS.has(v as MatchTempo)
}

function isTerrain(v: unknown): v is TerrainChoice {
  return typeof v === 'string' && TERRAINS.has(v as TerrainChoice)
}

/**
 * Lädt gespeicherte Menü-Werte und merged sie über die Defaults. Ungültige /
 * fehlende Werte fallen still auf den Default zurück.
 */
export function loadMenuPrefs(defaults: StartMenuValues): StartMenuValues {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return defaults
    const parsed = JSON.parse(raw) as Record<string, unknown>

    const result: StartMenuValues = { ...defaults }
    if (typeof parsed.playerName === 'string' && parsed.playerName.trim().length > 0) {
      result.playerName = parsed.playerName.slice(0, 16)
    }
    if (typeof parsed.mapWidth === 'number' && MAP_DIMS.has(parsed.mapWidth)) {
      result.mapWidth = parsed.mapWidth
    }
    if (typeof parsed.mapHeight === 'number' && MAP_DIMS.has(parsed.mapHeight)) {
      result.mapHeight = parsed.mapHeight
    }
    if (
      typeof parsed.aiCount === 'number' &&
      Number.isInteger(parsed.aiCount) &&
      parsed.aiCount >= 1 &&
      parsed.aiCount <= 200
    ) {
      result.aiCount = parsed.aiCount
    }
    if (
      typeof parsed.wildCount === 'number' &&
      Number.isInteger(parsed.wildCount) &&
      parsed.wildCount >= 0 &&
      parsed.wildCount <= 600
    ) {
      result.wildCount = parsed.wildCount
    }
    if (
      typeof parsed.victoryPct === 'number' &&
      parsed.victoryPct >= 50 &&
      parsed.victoryPct <= 100
    ) {
      result.victoryPct = parsed.victoryPct
    }
    if (isDifficulty(parsed.difficulty)) result.difficulty = parsed.difficulty
    if (isTempo(parsed.tempo)) result.tempo = parsed.tempo
    if (isTerrain(parsed.terrain)) result.terrain = parsed.terrain
    if (typeof parsed.soundEnabled === 'boolean') result.soundEnabled = parsed.soundEnabled
    if (isCameraMode(parsed.cameraMode)) result.cameraMode = parsed.cameraMode
    if (typeof parsed.rivers === 'boolean') result.rivers = parsed.rivers
    if (
      typeof parsed.riverDensity === 'number' &&
      parsed.riverDensity >= 0.2 &&
      parsed.riverDensity <= 3
    )
      result.riverDensity = parsed.riverDensity
    if (typeof parsed.captureMode === 'boolean') result.captureMode = parsed.captureMode
    if (parsed.teamMode === 'off' || parsed.teamMode === 'allied') result.teamMode = parsed.teamMode
    if (typeof parsed.teamCount === 'number' && parsed.teamCount >= 2 && parsed.teamCount <= 8)
      result.teamCount = Math.round(parsed.teamCount)
    if (typeof parsed.teamSize === 'number' && parsed.teamSize >= 1 && parsed.teamSize <= 6)
      result.teamSize = Math.round(parsed.teamSize)
    if (typeof parsed.allowedBuildings === 'object' && parsed.allowedBuildings !== null) {
      const ab = { ...defaults.allowedBuildings }
      const src = parsed.allowedBuildings as Record<string, unknown>
      for (const type of ['city', 'defense', 'port', 'factory', 'airport', 'flak'] as const) {
        if (typeof src[type] === 'boolean') ab[type] = src[type]
      }
      result.allowedBuildings = ab
    }
    if (typeof parsed.experimental === 'object' && parsed.experimental !== null) {
      // Gespeicherte Flags ÜBER die Defaults legen (nicht ersetzen) → neue Default-Flags wie
      // `rivers: true` bleiben aktiv, außer der Nutzer hat sie explizit anders gespeichert.
      const exp: ExperimentalFlags = { ...defaults.experimental }
      for (const [k, v] of Object.entries(parsed.experimental)) {
        if (typeof v === 'boolean') exp[k] = v
      }
      result.experimental = exp
    }
    return result
  } catch {
    return defaults
  }
}

export function saveMenuPrefs(values: StartMenuValues): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
  } catch {
    // Privacy-Modus / Quota überschritten — silent ignore
  }
}

const SERVER_URL_KEY = 'territorial-loop:server-url:v1'

/** Lädt die zuletzt genutzte Mehrspieler-Server-URL (oder `fallback`). */
export function loadServerUrl(fallback: string): string {
  try {
    const v = window.localStorage.getItem(SERVER_URL_KEY)
    return v !== null && v.length > 0 ? v : fallback
  } catch {
    return fallback
  }
}

export function saveServerUrl(url: string): void {
  try {
    window.localStorage.setItem(SERVER_URL_KEY, url)
  } catch {
    // silent ignore
  }
}

const AUDIO_KEY = 'territorial-loop:audio:v1'

/** Audio-Lautstärken (0..1): Gesamt + getrennt für Soundeffekte und Musik. Standardwerte = die im
 * Einstellungen-Menü gezeigten. Musik startet leiser (Prototyp). */
export interface AudioVolumes {
  master: number
  sfx: number
  music: number
}

const DEFAULT_AUDIO: AudioVolumes = { master: 0.8, sfx: 0.7, music: 0.45 }

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export function loadAudioVolumes(): AudioVolumes {
  try {
    const raw = window.localStorage.getItem(AUDIO_KEY)
    if (raw === null) {
      // Migration vom alten Musik-An/Aus: war es an, Musik auf Standard, sonst 0.
      const oldMusic = window.localStorage.getItem('territorial-loop:music:v1')
      if (oldMusic !== null)
        return { ...DEFAULT_AUDIO, music: oldMusic === '1' ? DEFAULT_AUDIO.music : 0 }
      return { ...DEFAULT_AUDIO }
    }
    const p = JSON.parse(raw) as Partial<AudioVolumes>
    return {
      master: typeof p.master === 'number' ? clamp01(p.master) : DEFAULT_AUDIO.master,
      sfx: typeof p.sfx === 'number' ? clamp01(p.sfx) : DEFAULT_AUDIO.sfx,
      music: typeof p.music === 'number' ? clamp01(p.music) : DEFAULT_AUDIO.music,
    }
  } catch {
    return { ...DEFAULT_AUDIO }
  }
}

export function saveAudioVolumes(v: AudioVolumes): void {
  try {
    window.localStorage.setItem(AUDIO_KEY, JSON.stringify(v))
  } catch {
    // silent ignore
  }
}

const ACTIVE_SESSION_KEY = 'territorial-loop:active-mp:v1'
/** Eine unterbrochene Mehrspieler-Sitzung gilt nach 2 h als veraltet (Match längst vorbei). */
const ACTIVE_SESSION_TTL_MS = 2 * 60 * 60 * 1000

/** Laufende Mehrspieler-Sitzung (für „Wieder verbinden" nach Verbindungsabbruch/Reload). */
export interface ActiveSession {
  readonly serverUrl: string
  readonly room: string
  readonly name: string
}

/**
 * Merkt die laufende MP-Sitzung (mit Zeitstempel). **sessionStorage**, nicht localStorage: pro
 * Tab isoliert (zwei Spieler in zwei Tabs derselben Origin clobbern sich nicht) und übersteht
 * einen Reload bzw. einen In-Tab-Abbruch — genau die Fälle, die „Wieder verbinden" abdeckt.
 */
export function saveActiveSession(s: ActiveSession): void {
  try {
    window.sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({ ...s, ts: Date.now() }))
  } catch {
    // silent ignore
  }
}

/** Lädt eine unterbrochene MP-Sitzung, falls vorhanden und nicht veraltet. */
export function loadActiveSession(): ActiveSession | null {
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_SESSION_KEY)
    if (raw === null) return null
    const p = JSON.parse(raw) as Partial<ActiveSession> & { ts?: number }
    if (
      typeof p.serverUrl !== 'string' ||
      typeof p.room !== 'string' ||
      typeof p.name !== 'string' ||
      p.room.length === 0
    )
      return null
    if (typeof p.ts === 'number' && Date.now() - p.ts > ACTIVE_SESSION_TTL_MS) return null
    return { serverUrl: p.serverUrl, room: p.room, name: p.name }
  } catch {
    return null
  }
}

export function clearActiveSession(): void {
  try {
    window.sessionStorage.removeItem(ACTIVE_SESSION_KEY)
  } catch {
    // silent ignore
  }
}
