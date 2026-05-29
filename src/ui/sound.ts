/**
 * Minimaler Sound-Engine via Web Audio API.
 *
 * Keine externen Assets — jeder Sound wird mit ein paar Oscillatoren generiert.
 * Browser blockieren AudioContext bis zur ersten User-Geste; wir initialisieren
 * lazy beim ersten Klang-Versuch und rufen resume() falls suspended.
 *
 * Toggle via `setEnabled()`. Standard: an.
 */

export interface SoundEngine {
  click(): void
  victory(): void
  defeat(): void
  /** Kurzer Warnton „du wirst angegriffen". */
  alarm(): void
  setEnabled(enabled: boolean): void
  isEnabled(): boolean
  destroy(): void
}

interface AudioCtor {
  new (): AudioContext
}

function getAudioContextCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null
  if ('AudioContext' in window) {
    return (window as unknown as { AudioContext: AudioCtor }).AudioContext
  }
  if ('webkitAudioContext' in window) {
    return (window as unknown as { webkitAudioContext: AudioCtor }).webkitAudioContext
  }
  return null
}

export function createSoundEngine(): SoundEngine {
  let enabled = true
  let ctx: AudioContext | null = null

  function ensureCtx(): AudioContext | null {
    if (!enabled) return null
    if (ctx !== null) {
      if (ctx.state === 'suspended') void ctx.resume()
      return ctx
    }
    const Ctor = getAudioContextCtor()
    if (Ctor === null) return null
    ctx = new Ctor()
    return ctx
  }

  function playTone(
    frequency: number,
    duration: number,
    opts: {
      readonly type?: OscillatorType
      readonly volume?: number
      readonly attack?: number
      readonly delay?: number
    } = {},
  ): void {
    const c = ensureCtx()
    if (c === null) return
    const startAt = c.currentTime + (opts.delay ?? 0)
    const endAt = startAt + duration
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = opts.type ?? 'sine'
    osc.frequency.value = frequency
    const peak = opts.volume ?? 0.08
    const attack = opts.attack ?? 0.005
    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.exponentialRampToValueAtTime(peak, startAt + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt)
    osc.connect(gain).connect(c.destination)
    osc.start(startAt)
    osc.stop(endAt + 0.02)
  }

  return {
    click(): void {
      // Kurzer hoher Pluck — "Angriff geschickt"
      playTone(880, 0.08, { type: 'triangle', volume: 0.06 })
    },
    victory(): void {
      // Aufsteigender Drei-Ton-Akkord
      playTone(523, 0.18, { type: 'triangle', volume: 0.1 })
      playTone(659, 0.18, { type: 'triangle', volume: 0.1, delay: 0.1 })
      playTone(784, 0.32, { type: 'triangle', volume: 0.1, delay: 0.2 })
    },
    defeat(): void {
      // Absteigender Akkord mit dunklerer Welle
      playTone(440, 0.22, { type: 'sawtooth', volume: 0.08 })
      playTone(330, 0.32, { type: 'sawtooth', volume: 0.08, delay: 0.18 })
    },
    alarm(): void {
      // Zwei kurze, dringliche Töne (Warnung) — dezent, aber auffällig.
      playTone(620, 0.1, { type: 'square', volume: 0.07 })
      playTone(620, 0.12, { type: 'square', volume: 0.07, delay: 0.14 })
    },
    setEnabled(value: boolean): void {
      enabled = value
      if (!enabled && ctx !== null && ctx.state === 'running') {
        void ctx.suspend()
      }
    },
    isEnabled(): boolean {
      return enabled
    },
    destroy(): void {
      if (ctx !== null) {
        void ctx.close()
        ctx = null
      }
    },
  }
}
