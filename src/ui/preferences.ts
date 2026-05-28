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
  Difficulty,
  ExperimentalFlags,
  MatchTempo,
  StartMenuValues,
  TerrainChoice,
} from './start-menu'

const STORAGE_KEY = 'territorial-loop:menu-prefs:v1'

const DIFFICULTIES: ReadonlySet<Difficulty> = new Set<Difficulty>(['easy', 'normal', 'hard'])
const TEMPOS: ReadonlySet<MatchTempo> = new Set<MatchTempo>(['fast', 'normal', 'siege'])
const TERRAINS: ReadonlySet<TerrainChoice> = new Set<TerrainChoice>([
  'flat',
  'continents',
  'islands',
])
const MAP_DIMS: ReadonlySet<number> = new Set<number>([256, 512, 768, 1024, 1536, 2048])

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
      parsed.aiCount <= 32
    ) {
      result.aiCount = parsed.aiCount
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
    if (typeof parsed.experimental === 'object' && parsed.experimental !== null) {
      const exp: ExperimentalFlags = {}
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
