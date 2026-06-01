/**
 * Tutorial-Drehbuch (geführtes erstes Match, Option im Menü).
 *
 * Das Spiel läuft auf der echten Engine; das Drehbuch hält an festgelegten Punkten an, erklärt in
 * einer Box und läuft weiter (Jonathans „pausieren → erklären → weiter"-Modell). Links ein
 * angeheftetes **Ziel-Panel** (Quest-Tracker mit Haken). „Regie-Aktionen" (Gold schenken, einen
 * Gegner wecken) greifen direkt in den Spielzustand ein — nur Solo, kein Determinismus-/MP-Bezug.
 *
 * Reine UI-/Ablauf-Schicht: kennt den GameState lesend (Auslöser) und darf ihn für die Regie
 * gezielt mutieren. Texte vorerst direkt (de) — i18n folgt, sobald der Ablauf steht.
 */

import type { GameState } from '../core/game'

/** Ein Drehbuch-Schritt: Erklärung + (optional) Auslöser zum Weiterkommen + (optional) Regie. */
export interface TutorialStep {
  readonly id: string
  /** Überschrift im Ziel-Panel (kurz). */
  readonly goal: string
  /** Erklärtext in der Pause-Box. */
  readonly text: string
  /** Beim Betreten ausgeführt — Regie (Gold geben, Gegner wecken, Ziel markieren …). */
  readonly onEnter?: (state: GameState, humanId: number) => void
  /**
   * Erfüllt? → Schritt geschafft, weiter. Fehlt der Auslöser, ist es ein reiner Info-Schritt,
   * den der „Weiter"-Knopf abschließt.
   */
  readonly done?: (state: GameState, humanId: number) => boolean
}

export interface TutorialApi {
  /** Das angeheftete Ziel-Panel (links) — vom Aufrufer ins Match-DOM gehängt. */
  readonly element: HTMLElement
  /** Pro Sim-Frame aufrufen: prüft den Auslöser des aktiven Schritts und schaltet ggf. weiter. */
  tick(state: GameState): void
  destroy(): void
}

export interface TutorialOptions {
  readonly steps: readonly TutorialStep[]
  readonly humanId: number
  /** Steuert die Sim-Pause des Matches (true = anhalten zum Erklären). */
  readonly setPaused: (paused: boolean) => void
  /** Tutorial vollständig durchlaufen (oder abgebrochen) → zurück ins Menü / weiterspielen. */
  readonly onFinish: () => void
}

const ACCENT = 'var(--tl-accent)'

export function createTutorial(opts: TutorialOptions): TutorialApi {
  let index = -1
  /** Wartet die Pause-Box gerade auf „Weiter"? Solange wird der Auslöser nicht geprüft. */
  let awaitingContinue = false
  let lastState: GameState | null = null

  // ── Ziel-Panel (links, angeheftet) ───────────────────────────────────────────
  const panel = document.createElement('div')
  panel.style.cssText = [
    'position: absolute',
    'top: 90px',
    'left: 16px',
    'z-index: 40',
    'width: 230px',
    'max-width: 40vw',
    'background: var(--tl-panel-bg)',
    'color: var(--tl-text)',
    'border: 1px solid var(--tl-panel-border-color)',
    'border-radius: 10px',
    'padding: 12px 14px',
    'font-family: var(--tl-font)',
    'box-shadow: 0 8px 28px rgba(0,0,0,0.45)',
  ].join(';')

  const panelTitle = document.createElement('div')
  panelTitle.textContent = 'Tutorial'
  panelTitle.style.cssText = `font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.6; margin-bottom: 8px`
  panel.appendChild(panelTitle)

  const stepList = document.createElement('div')
  stepList.style.cssText = 'display: flex; flex-direction: column; gap: 6px; font-size: 13px'
  panel.appendChild(stepList)

  function renderPanel(): void {
    stepList.textContent = ''
    for (const [i, step] of opts.steps.entries()) {
      const isDone = i < index
      const isActive = i === index

      const row = document.createElement('div')
      row.style.cssText = 'display: flex; align-items: flex-start; gap: 8px; line-height: 1.35'

      // Status-Marker per CSS (kein Symbol-/Emoji-Zeichen): gefüllt = erledigt, Ring = aktiv, leer = offen.
      const dot = document.createElement('span')
      dot.style.cssText = [
        'flex: 0 0 auto',
        'width: 9px',
        'height: 9px',
        'margin-top: 4px',
        'border-radius: 50%',
        'box-sizing: border-box',
        isDone
          ? `background: ${ACCENT}; border: 1px solid ${ACCENT}`
          : isActive
            ? `background: transparent; border: 2px solid ${ACCENT}`
            : 'background: transparent; border: 1px solid var(--tl-text)',
        isActive || isDone ? '' : 'opacity: 0.4',
      ].join(';')

      const label = document.createElement('span')
      label.textContent = step.goal
      label.style.cssText = [
        `opacity: ${isDone ? '0.5' : isActive ? '1' : '0.45'}`,
        isActive ? `color: ${ACCENT}; font-weight: 700` : '',
        isDone ? 'text-decoration: line-through' : '',
      ].join(';')

      row.append(dot, label)
      stepList.appendChild(row)
    }
  }

  // ── Pause-Erklärbox (zentriert oben) ─────────────────────────────────────────
  const box = document.createElement('div')
  box.style.cssText = [
    'position: absolute',
    'top: 80px',
    'left: 50%',
    'transform: translateX(-50%)',
    'z-index: 60',
    'width: 460px',
    'max-width: 90vw',
    'background: var(--tl-panel-bg)',
    'color: var(--tl-text)',
    'border: 1px solid ' + ACCENT,
    'border-radius: 12px',
    'padding: 18px 22px',
    'font-family: var(--tl-font)',
    'box-shadow: 0 14px 50px rgba(0,0,0,0.55)',
    'display: none',
  ].join(';')

  const boxText = document.createElement('div')
  boxText.style.cssText = 'font-size: 15px; line-height: 1.55; margin-bottom: 14px'
  box.appendChild(boxText)

  const contBtn = document.createElement('button')
  contBtn.textContent = 'Weiter'
  contBtn.style.cssText = [
    'padding: 9px 18px',
    `background: ${ACCENT}`,
    'color: #1a1a1a',
    'border: none',
    'border-radius: 8px',
    'font-weight: 700',
    'font-size: 14px',
    'cursor: pointer',
    'font-family: var(--tl-font)',
    'float: right',
  ].join(';')
  contBtn.addEventListener('click', () => continueFromBox())
  box.appendChild(contBtn)

  // Beide Elemente in einem Wrapper (vom Aufrufer einmal eingehängt).
  const wrap = document.createElement('div')
  wrap.appendChild(panel)
  wrap.appendChild(box)

  function showBox(text: string, isLast: boolean): void {
    boxText.textContent = text
    contBtn.textContent = isLast ? 'Fertig' : 'Weiter'
    box.style.display = 'block'
    awaitingContinue = true
    opts.setPaused(true)
  }

  function enterStep(i: number): void {
    index = i
    renderPanel()
    if (i >= opts.steps.length) {
      opts.setPaused(false)
      opts.onFinish()
      return
    }
    const step = opts.steps[i]
    if (step === undefined) return
    if (lastState !== null) step.onEnter?.(lastState, opts.humanId)
    showBox(step.text, i === opts.steps.length - 1)
  }

  /** „Weiter" gedrückt: Box weg, Spiel läuft. Info-Schritte (ohne Auslöser) springen direkt weiter. */
  function continueFromBox(): void {
    box.style.display = 'none'
    awaitingContinue = false
    const step = opts.steps[index]
    if (step === undefined) return
    if (step.done === undefined) {
      // Reiner Info-Schritt: „Weiter" schließt ihn ab → nächster Schritt.
      enterStep(index + 1)
    } else {
      // Aufgaben-Schritt: Spiel läuft weiter, tick() wartet auf die Erfüllung.
      opts.setPaused(false)
    }
  }

  return {
    element: wrap,

    tick(state) {
      lastState = state
      if (index < 0) {
        enterStep(0)
        return
      }
      if (awaitingContinue) return
      const step = opts.steps[index]
      if (step?.done?.(state, opts.humanId) === true) {
        enterStep(index + 1)
      }
    },

    destroy() {
      wrap.remove()
    },
  }
}
