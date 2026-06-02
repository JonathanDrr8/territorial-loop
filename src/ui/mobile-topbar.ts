/**
 * Kompakte Mobile-Top-Leiste (oben rechts verankert, kollidiert nicht mit dem Feedback-Knopf links).
 * Auf dem Handy übernimmt das Eck-Rad-Cockpit die Aktionen — diese Leiste liefert die festen Werte,
 * die im Rad schlecht ablesbar sind: **Truppen-Balken mit Cap-Zahl** + **Gold/Rate**, dazu zwei
 * Knöpfe: **☰ Menü** (öffnet das Pause-/ESC-Menü inkl. „HUD anpassen") und **≣ Rang** (fährt die
 * Rangliste kurz ein/aus). Wird wie das Cockpit-Rad jeden Frame mit {@link WheelStats} gefüttert.
 *
 * Strich-Icons statt Emojis (Projekt-Regel). Theme-getönt über `panelStyle`.
 */

import { troopFillColor, type WheelStats } from './action-wheel'
import { panelStyle } from './theme'
import { icon } from './icons'
import { t } from '../i18n'

export interface MobileTopbarDeps {
  /** ☰ gedrückt → Pause-/ESC-Menü öffnen. */
  readonly onMenu: () => void
  /** ≣ gedrückt → Rangliste ein-/ausfahren. */
  readonly onToggleRank: () => void
}

export interface MobileTopbarApi {
  /** Live-Werte setzen (jeden Frame aus dem HUD-Update — dieselben Stats wie das Cockpit-Rad). */
  setStats(s: WheelStats): void
  setVisible(on: boolean): void
  /** Rang-Knopf optisch als aktiv markieren (Rangliste gerade offen). */
  setRankActive(on: boolean): void
  /** Wurzel-Element (zum Registrieren als verschieb-/skalierbares HUD-Panel im Editor). */
  readonly element: HTMLElement
  destroy(): void
}

/** Kompakt-Formatierung (8.6k, 1.2M) — identisch zur Rad-Mitte, damit Werte übereinstimmen. */
function fmtK(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k'
  return String(Math.round(n))
}

export function createMobileTopbar(
  container: HTMLElement,
  deps: MobileTopbarDeps,
): MobileTopbarApi {
  const bar = document.createElement('div')
  bar.style.cssText = panelStyle([
    'position: absolute',
    'top: 10px',
    'right: 10px',
    'display: none',
    'align-items: center',
    'gap: 8px',
    'padding: 5px 7px',
    'z-index: 20',
    'pointer-events: auto',
    'font-size: 12px',
  ])

  // ── Truppen-Balken mit Cap-Zahl (Fortschritt + überlagerter Text) ──
  const troopWrap = document.createElement('div')
  troopWrap.style.cssText =
    'position:relative;width:92px;height:18px;border-radius:5px;overflow:hidden;' +
    'background:rgba(0,0,0,0.45);flex:none'
  const troopFill = document.createElement('div')
  troopFill.style.cssText =
    'position:absolute;left:0;top:0;bottom:0;width:0%;transition:width 0.25s,background 0.2s'
  const troopText = document.createElement('div')
  troopText.style.cssText =
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
    'font-weight:700;font-size:11px;font-family:var(--tl-num-font);font-variant-numeric:tabular-nums;' +
    'text-shadow:0 1px 2px rgba(0,0,0,0.9);white-space:nowrap'
  troopText.textContent = '—'
  troopWrap.append(troopFill, troopText)

  // ── Gold + Rate ──
  const goldEl = document.createElement('div')
  goldEl.style.cssText =
    'display:flex;align-items:center;gap:3px;color:#e8c14a;font-weight:600;white-space:nowrap;flex:none'
  goldEl.innerHTML = `${icon.gold} <span data-gold>—</span>`

  // ── Knöpfe (Rang-Toggle + Menü) ──
  const btnStyle =
    'display:flex;align-items:center;justify-content:center;width:30px;height:30px;flex:none;' +
    'border:1px solid var(--tl-panel-border-color);border-radius:6px;background:rgba(255,255,255,0.06);' +
    'color:var(--tl-text);cursor:pointer;font-size:17px;line-height:1;padding:0'
  const rankBtn = document.createElement('button')
  rankBtn.type = 'button'
  rankBtn.style.cssText = btnStyle
  rankBtn.innerHTML = icon.rank
  rankBtn.title = t('hud.rank')
  rankBtn.setAttribute('aria-label', t('hud.rank'))
  rankBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    deps.onToggleRank()
  })

  const menuBtn = document.createElement('button')
  menuBtn.type = 'button'
  menuBtn.style.cssText = btnStyle
  menuBtn.innerHTML = icon.menu
  menuBtn.title = t('pause.title')
  menuBtn.setAttribute('aria-label', t('pause.title'))
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    deps.onMenu()
  })

  bar.append(troopWrap, goldEl, rankBtn, menuBtn)
  container.appendChild(bar)

  const goldSpan = goldEl.querySelector<HTMLElement>('[data-gold]')

  return {
    setStats(s: WheelStats): void {
      const frac = s.cap > 0 ? Math.max(0, Math.min(1, s.troops / s.cap)) : 0
      troopFill.style.width = `${String(frac * 100)}%`
      // Farbe nach Wachstums-Effizienz (wie der Cockpit-Ring): grün=wächst gut, gelb=stagnierend,
      // rot=voll/stark stagnierend oder unter Angriff → man sieht sofort, ob man effizient ist.
      troopFill.style.background = troopFillColor(s.troops, s.cap, s.underAttack)
      troopText.textContent = `${fmtK(s.troops)} / ${fmtK(s.cap)}`
      if (goldSpan !== null) {
        const sign = s.rate > 0 ? '+' : ''
        goldSpan.textContent = `${fmtK(s.gold)}  ${sign}${fmtK(s.rate)}/s`
      }
    },
    setVisible(on: boolean): void {
      bar.style.display = on ? 'flex' : 'none'
    },
    setRankActive(on: boolean): void {
      rankBtn.style.background = on ? 'var(--tl-accent)' : 'rgba(255,255,255,0.06)'
      rankBtn.style.color = on ? '#1a1a1a' : 'var(--tl-text)'
    },
    element: bar,
    destroy(): void {
      bar.remove()
    },
  }
}
