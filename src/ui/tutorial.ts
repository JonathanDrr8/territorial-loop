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
import type { BuildingType } from '../core/buildings'

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

/** Geschenktes Gold im Bau-Schritt, damit der Spieler ohne Grinden eine Stadt setzen kann. */
const TUTORIAL_GOLD_GIFT = 80_000

const myTiles = (s: GameState, id: number): number => s.players.get(id)?.tilesOwned ?? 0
const livingWild = (s: GameState): number =>
  [...s.players.values()].filter((p) => p.wild && p.isAlive).length
const hasBuilding = (s: GameState, id: number, type: BuildingType): boolean =>
  [...s.buildings.values()].some((b) => b.ownerId === id && b.type === type)
/** Hat der Spieler einen Bomber gebaut (geparkt im Hangar) oder bereits gestartet (in der Luft)? */
const hasBomber = (s: GameState, id: number): boolean =>
  s.bombers.some((b) => b.ownerId === id) ||
  [...s.buildings.values()].some(
    (b) => b.ownerId === id && b.type === 'airport' && (b.aircraft ?? 0) > 0,
  )
/** Schenkt dem Spieler Gold (Regie), damit er den nächsten Bau ohne Grinden ausprobieren kann. */
const giveGold = (s: GameState, id: number, amount: number): void => {
  const p = s.players.get(id)
  if (p !== undefined) p.gold += amount
}

/**
 * Drehbuch Teil 1 — die Kern-Schleife (ausbreiten → erobern → bauen → wachsen). Schwellen sind
 * auf die kleine Tutorial-Karte abgestimmt und beim Testen justierbar. Closure-State merkt sich
 * Startwerte je Schritt.
 */
export function defaultTutorialSteps(): readonly TutorialStep[] {
  let tilesAtExpand = 0
  let wildAtStart = 0

  return [
    {
      id: 'welcome',
      goal: 'Willkommen',
      text: 'Willkommen bei territorial-loop! Das farbige Gebiet in der Mitte ist dein Reich. Dein Ziel: dich ausbreiten und die Insel erobern. Wir gehen die Grundlagen Schritt für Schritt durch.',
    },
    {
      id: 'expand',
      goal: 'Breite dich aus',
      text: 'Klicke ein angrenzendes graues Gebiet an deiner Grenze an — deine Truppen breiten sich dorthin aus.',
      onEnter: (s, id) => {
        tilesAtExpand = myTiles(s, id)
      },
      done: (s, id) => myTiles(s, id) > tilesAtExpand,
    },
    {
      id: 'size',
      goal: 'Angriffsgröße',
      text: 'Mit dem Mausrad stellst du ein, wie viel deiner Truppen ein Angriff einsetzt. Mehr Truppen erobern schneller, lassen dein Kerngebiet aber dünner. Probier es ruhig aus.',
    },
    {
      id: 'wild',
      goal: 'Erobere die Wilden',
      text: 'Die grauen „wilden" Nationen sind passiv und schwach besiedelt — perfekt zum Wachsen. Erobere die wilde Nation neben dir; beim Erobern erbeutest du ihr Gold.',
      onEnter: (s) => {
        wildAtStart = livingWild(s)
      },
      done: (s) => livingWild(s) < wildAtStart,
    },
    {
      id: 'city',
      goal: 'Baue eine Stadt',
      text: 'Mit Gold baust du Gebäude. Wir schenken dir etwas Gold zum Üben. Drücke Taste 1 und setze eine Stadt auf dein Gebiet — eine Stadt hebt dein Truppen-Limit, du kannst also mehr Truppen halten.',
      onEnter: (s, id) => giveGold(s, id, TUTORIAL_GOLD_GIFT),
      done: (s, id) => hasBuilding(s, id, 'city'),
    },
    {
      id: 'factory',
      goal: 'Baue eine Fabrik',
      text: 'Gold ist der Schlüssel zu allem. Baue eine Fabrik (Taste 4) — sie verbindet sich mit deinen Städten und produziert laufend Gold. Fabriken sind das Rückgrat deiner Wirtschaft. Hier ist Gold dafür.',
      onEnter: (s, id) => giveGold(s, id, TUTORIAL_GOLD_GIFT),
      done: (s, id) => hasBuilding(s, id, 'factory'),
    },
    {
      id: 'grow',
      goal: 'Wachse weiter',
      text: 'Stark! Wachsen ist das Wichtigste. Breite dich weiter aus und erobere mehr Gebiet — je größer dein Reich, desto mehr Truppen und Gold.',
      done: (s, id) => myTiles(s, id) >= 45,
    },
    {
      id: 'airport',
      goal: 'Baue einen Flughafen',
      text: 'Zeit für Luftmacht. Baue einen Flughafen (Taste 5) — von hier starten Bomber. Wir schenken dir das Gold dafür.',
      onEnter: (s, id) => giveGold(s, id, TUTORIAL_GOLD_GIFT * 2),
      done: (s, id) => hasBuilding(s, id, 'airport'),
    },
    {
      id: 'bomber',
      goal: 'Starte einen Bomber',
      text: 'Drücke Taste 7, um einen Bomber zu bauen, und klicke dann ein feindliches (graues) Gebiet an. Der Bomber fliegt hin und wirft eine Bombe, die Truppen tötet, Gebiet neutralisiert und Gebäude zerstört — Vorsicht, sie verschont niemanden, auch Verbündete nicht.',
      onEnter: (s, id) => giveGold(s, id, TUTORIAL_GOLD_GIFT),
      done: (s, id) => hasBomber(s, id),
    },
    {
      id: 'finish',
      goal: 'Geschafft',
      text: 'Geschafft! Du beherrschst die Grundlagen: ausbreiten, erobern, Wirtschaft (Städte + Fabriken) und Luftkrieg. Häfen und Schiffe, Diplomatie und die Spielmodi lernst du am besten direkt in einer echten Partie kennen. Viel Erfolg!',
    },
  ]
}

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
