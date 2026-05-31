/**
 * Theme-System fürs In-Game-HUD (ADR-0024, Phase 1). Ein Satz CSS-Variablen (Design-Tokens) auf
 * `:root` bestimmt Panel-Look, Farben, Typografie. Inline-Styles im HUD referenzieren die Tokens
 * über `var(--tl-…)` bzw. {@link panelStyle} → ein Theme-Wechsel ändert nur diese Variablen.
 *
 * Sechs Themes stehen zur Wahl; **Kriegskarte** ist Default (Leder/Bronze, zum Eroberungsspiel
 * passend). Die Auswahl liegt in localStorage (reine Client-Präferenz, kein Sim-Determinismus →
 * multiplayer-sicher). Die Schriften (Saira/Oswald) werden über `@fontsource` gebündelt, also
 * self-hosted ohne CDN-Zwang.
 */

// Gebündelte Schriften (nur die genutzten Gewichte).
import '@fontsource/oswald/400.css'
import '@fontsource/oswald/600.css'
import '@fontsource/oswald/700.css'
import '@fontsource/saira-condensed/400.css'
import '@fontsource/saira-condensed/600.css'
import '@fontsource/saira-condensed/700.css'
import '@fontsource/saira-semi-condensed/500.css'
import '@fontsource/saira-semi-condensed/600.css'
import '@fontsource/saira-semi-condensed/700.css'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace'
const SAIRA = "'Saira Condensed', " + MONO
const SAIRA_SEMI = "'Saira Semi Condensed', " + MONO
const OSWALD = "'Oswald', " + MONO

/** Ein Theme = Werte für die `--tl-…`-Variablen. */
export type ThemeTokens = Record<string, string>

export const THEMES: Record<string, { label: string; tokens: ThemeTokens }> = {
  dezent: {
    label: 'Dezent',
    tokens: {
      '--tl-font': MONO,
      '--tl-num-font': MONO,
      '--tl-text': '#e7edf5',
      '--tl-text-dim': 'rgba(231,237,245,0.62)',
      '--tl-text-faint': 'rgba(231,237,245,0.4)',
      '--tl-accent': '#46d9e6',
      '--tl-good': '#5dd75d',
      '--tl-warn': '#e8c14a',
      '--tl-bad': '#e05a5a',
      '--tl-gold': '#e8c14a',
      '--tl-panel-bg': 'linear-gradient(180deg, rgba(24,30,44,0.93), rgba(12,16,24,0.95))',
      '--tl-panel-border-color': 'rgba(132,152,188,0.22)',
      '--tl-panel-radius': '11px',
      '--tl-panel-shadow': '0 6px 22px rgba(0,0,0,0.5)',
      '--tl-panel-inset': 'inset 0 1px 0 rgba(255,255,255,0.06)',
      '--tl-bar-track': 'rgba(255,255,255,0.08)',
      '--tl-btn-bg': 'rgba(255,255,255,0.06)',
      '--tl-btn-border': 'rgba(255,255,255,0.15)',
      '--tl-btn-radius': '6px',
    },
  },
  taktisch: {
    label: 'Taktisch',
    tokens: {
      '--tl-font': SAIRA,
      '--tl-num-font': SAIRA_SEMI,
      '--tl-text': '#eaf0f8',
      '--tl-text-dim': 'rgba(234,240,248,0.6)',
      '--tl-text-faint': 'rgba(234,240,248,0.4)',
      '--tl-accent': '#ff8a5c',
      '--tl-good': '#6ce06c',
      '--tl-warn': '#f0c44a',
      '--tl-bad': '#f0673a',
      '--tl-gold': '#f0c44a',
      '--tl-panel-bg': 'linear-gradient(180deg, rgba(28,24,30,0.95), rgba(14,12,16,0.96))',
      '--tl-panel-border-color': 'rgba(190,150,130,0.3)',
      '--tl-panel-radius': '8px',
      '--tl-panel-shadow': '0 6px 22px rgba(0,0,0,0.55)',
      '--tl-panel-inset': 'inset 0 1px 0 rgba(255,255,255,0.05)',
      '--tl-bar-track': 'rgba(255,255,255,0.08)',
      '--tl-btn-bg': 'rgba(40,30,28,0.7)',
      '--tl-btn-border': 'rgba(200,150,120,0.3)',
      '--tl-btn-radius': '5px',
    },
  },
  neon: {
    label: 'Neon',
    tokens: {
      '--tl-font': SAIRA,
      '--tl-num-font': SAIRA_SEMI,
      '--tl-text': '#cdeefb',
      '--tl-text-dim': 'rgba(205,238,251,0.6)',
      '--tl-text-faint': 'rgba(205,238,251,0.4)',
      '--tl-accent': '#46d9e6',
      '--tl-good': '#5dffc0',
      '--tl-warn': '#ffd24a',
      '--tl-bad': '#ff5d7a',
      '--tl-gold': '#ffd24a',
      '--tl-panel-bg': 'rgba(8,14,20,0.82)',
      '--tl-panel-border-color': 'rgba(70,217,230,0.5)',
      '--tl-panel-radius': '4px',
      '--tl-panel-shadow': '0 0 18px rgba(70,217,230,0.18)',
      '--tl-panel-inset': 'inset 0 0 22px rgba(70,217,230,0.06)',
      '--tl-bar-track': 'rgba(70,217,230,0.1)',
      '--tl-btn-bg': 'rgba(20,40,48,0.5)',
      '--tl-btn-border': 'rgba(70,217,230,0.4)',
      '--tl-btn-radius': '3px',
    },
  },
  kriegskarte: {
    label: 'Kriegskarte',
    tokens: {
      '--tl-font': SAIRA,
      '--tl-num-font': OSWALD,
      '--tl-text': '#efe2c4',
      '--tl-text-dim': 'rgba(239,226,196,0.58)',
      '--tl-text-faint': 'rgba(239,226,196,0.4)',
      '--tl-accent': '#d9a441',
      '--tl-good': '#a6cf6a',
      '--tl-warn': '#e8c14a',
      '--tl-bad': '#e07a4a',
      '--tl-gold': '#e8c14a',
      '--tl-panel-bg': 'linear-gradient(180deg, #3a2e1e, #241b10)',
      '--tl-panel-border-color': '#7a5e34',
      '--tl-panel-radius': '6px',
      '--tl-panel-shadow': '0 6px 22px rgba(0,0,0,0.55)',
      '--tl-panel-inset': 'inset 0 0 0 1px rgba(160,120,60,0.18)',
      '--tl-bar-track': '#1c150c',
      '--tl-btn-bg': 'rgba(60,46,28,0.7)',
      '--tl-btn-border': '#7a5e34',
      '--tl-btn-radius': '4px',
    },
  },
  bathymetrie: {
    label: 'Bathymetrie',
    tokens: {
      '--tl-font': SAIRA,
      '--tl-num-font': SAIRA_SEMI,
      '--tl-text': '#dce8e4',
      '--tl-text-dim': 'rgba(220,232,228,0.55)',
      '--tl-text-faint': 'rgba(220,232,228,0.4)',
      '--tl-accent': '#e8a23d',
      '--tl-good': '#7fce6e',
      '--tl-warn': '#e8b54a',
      '--tl-bad': '#e26a52',
      '--tl-gold': '#e8a23d',
      '--tl-panel-bg': 'linear-gradient(180deg, #0e2230, #081820)',
      '--tl-panel-border-color': 'rgba(120,200,190,0.3)',
      '--tl-panel-radius': '3px',
      '--tl-panel-shadow': '0 6px 20px rgba(0,0,0,0.5)',
      '--tl-panel-inset': 'inset 0 0 0 1px rgba(120,200,190,0.05)',
      '--tl-bar-track': '#0a1a22',
      '--tl-btn-bg': 'rgba(255,255,255,0.035)',
      '--tl-btn-border': 'rgba(120,200,190,0.3)',
      '--tl-btn-radius': '2px',
    },
  },
  feldemaille: {
    label: 'Feldemaille',
    tokens: {
      '--tl-font': SAIRA,
      '--tl-num-font': OSWALD,
      '--tl-text': '#efe9da',
      '--tl-text-dim': 'rgba(239,233,218,0.55)',
      '--tl-text-faint': 'rgba(239,233,218,0.4)',
      '--tl-accent': '#c8a24a',
      '--tl-good': '#8fcf5e',
      '--tl-warn': '#e6b94a',
      '--tl-bad': '#d6533f',
      '--tl-gold': '#c8a24a',
      '--tl-panel-bg': 'linear-gradient(180deg, #163a35, #0c211e)',
      '--tl-panel-border-color': '#0a1614',
      '--tl-panel-radius': '7px',
      '--tl-panel-shadow': 'inset 0 -2px 5px rgba(0,0,0,0.5), 0 6px 16px rgba(0,0,0,0.5)',
      '--tl-panel-inset': 'inset 0 1px 0 rgba(255,255,255,0.13)',
      '--tl-bar-track': '#0a1614',
      '--tl-btn-bg': 'linear-gradient(180deg, #1f4a43, #143029)',
      '--tl-btn-border': '#0a1614',
      '--tl-btn-radius': '6px',
    },
  },
}

export const DEFAULT_THEME = 'kriegskarte'
const STORAGE_KEY = 'territorial-loop:theme:v1'
let current = DEFAULT_THEME

function loadName(): string {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v !== null && v in THEMES) return v
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME
}

/** Setzt alle `--tl-…`-Variablen des Themes auf `:root`. */
export function applyTheme(name: string): void {
  const theme = THEMES[name] ?? THEMES[DEFAULT_THEME]
  if (theme === undefined) return
  current = name in THEMES ? name : DEFAULT_THEME
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.tokens)) root.style.setProperty(k, v)
}

/** Aktives Theme (Schlüssel). */
export function getTheme(): string {
  return current
}

/** Theme wählen + persistieren (reine Client-Präferenz). */
export function setTheme(name: string): void {
  applyTheme(name)
  try {
    window.localStorage.setItem(STORAGE_KEY, current)
  } catch {
    /* ignore */
  }
}

/** Einmalig zu App-Start: gespeichertes (oder Default-) Theme anwenden. Idempotent. */
export function installTheme(): void {
  applyTheme(loadName())
}

// Beim Import sofort anwenden, damit `var(--tl-…)` in Inline-Styles überall greift.
installTheme()

/**
 * Fertiger cssText für eine Standard-Panel-Karte (Hintergrund, Rand, Radius, Schatten, Schrift).
 * `extra` hängt weitere Deklarationen an (Position, Größe, Layout).
 */
export function panelStyle(extra: readonly string[] = []): string {
  return [
    'background: var(--tl-panel-bg)',
    'border: 1px solid var(--tl-panel-border-color)',
    'border-radius: var(--tl-panel-radius)',
    'box-shadow: var(--tl-panel-shadow), var(--tl-panel-inset)',
    'color: var(--tl-text)',
    'font-family: var(--tl-font)',
    ...extra,
  ].join(';')
}
