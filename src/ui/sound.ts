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
  /** Sanfter Zwei-Ton-Hinweis „neues Bündnis-Angebot". */
  alliance(): void
  /** Tiefes Tuten beim Aussenden eines Transportboots (`pan` −1..1). */
  boatHorn(pan: number): void
  /** Aufsteigender Triebwerks-Sweep beim Bomber-Start (`pan` −1..1, `gain` 0..1). */
  planeLaunch(pan: number, gain: number): void
  /** Dumpfer Einschlag + Rausch-Burst beim Bomben-Treffer (`pan` −1..1, `gain` 0..1). */
  bombImpact(pan: number, gain: number): void
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

  /** Routet eine Quelle über optionales Stereo-Panning an den Ausgang (Fallback ohne Panner-Support). */
  function connectOut(c: AudioContext, node: AudioNode, pan: number): void {
    if (pan !== 0 && typeof c.createStereoPanner === 'function') {
      const panner = c.createStereoPanner()
      panner.pan.value = Math.max(-1, Math.min(1, pan))
      node.connect(panner).connect(c.destination)
    } else {
      node.connect(c.destination)
    }
  }

  function playTone(
    frequency: number,
    duration: number,
    opts: {
      readonly type?: OscillatorType
      readonly volume?: number
      readonly attack?: number
      readonly delay?: number
      /** Stereo-Position −1 (links) .. +1 (rechts); 0 = mittig (Standard). */
      readonly pan?: number
      /** Ziel-Frequenz für einen linearen Sweep über die Dauer (Triebwerk-Anlauf o.ä.). */
      readonly sweepTo?: number
    } = {},
  ): void {
    const c = ensureCtx()
    if (c === null) return
    const startAt = c.currentTime + (opts.delay ?? 0)
    const endAt = startAt + duration
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = opts.type ?? 'sine'
    osc.frequency.setValueAtTime(frequency, startAt)
    if (opts.sweepTo !== undefined) osc.frequency.linearRampToValueAtTime(opts.sweepTo, endAt)
    const peak = opts.volume ?? 0.08
    const attack = opts.attack ?? 0.005
    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.exponentialRampToValueAtTime(peak, startAt + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt)
    osc.connect(gain)
    connectOut(c, gain, opts.pan ?? 0)
    osc.start(startAt)
    osc.stop(endAt + 0.02)
  }

  /** Kurzer gefilterter Rausch-Burst (für Explosionen) — weißes Rauschen über ein Tiefpass mit Decay. */
  function playNoise(
    duration: number,
    opts: { readonly volume?: number; readonly cutoff?: number; readonly pan?: number } = {},
  ): void {
    const c = ensureCtx()
    if (c === null) return
    const startAt = c.currentTime
    const frames = Math.max(1, Math.floor(c.sampleRate * duration))
    const buffer = c.createBuffer(1, frames, c.sampleRate)
    const data = buffer.getChannelData(0)
    // Math.random ist hier völlig in Ordnung: reine Präsentation, nicht im Sim-State/Hash.
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
    const src = c.createBufferSource()
    src.buffer = buffer
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = opts.cutoff ?? 900
    const gain = c.createGain()
    const peak = opts.volume ?? 0.12
    gain.gain.setValueAtTime(peak, startAt)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
    src.connect(lp).connect(gain)
    connectOut(c, gain, opts.pan ?? 0)
    src.start(startAt)
    src.stop(startAt + duration + 0.02)
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
    alliance(): void {
      // Sanfter, freundlicher Aufwärts-Zweiklang — „Angebot eingegangen".
      playTone(587, 0.1, { type: 'sine', volume: 0.05 })
      playTone(880, 0.14, { type: 'sine', volume: 0.05, delay: 0.09 })
    },
    boatHorn(pan: number): void {
      // Tiefes „Tuuut" — zwei tiefe Sinus-Töne mit langsamem Attack, leicht versetzt (Nebelhorn).
      playTone(150, 0.42, { type: 'sine', volume: 0.11, attack: 0.06, pan })
      playTone(116, 0.5, { type: 'sine', volume: 0.1, attack: 0.07, delay: 0.16, pan })
    },
    planeLaunch(pan: number, gain: number): void {
      // Aufsteigender Triebwerks-Sweep (Sägezahn 180→520 Hz) + dezentes Rauschen drüber.
      const v = Math.max(0, Math.min(1, gain))
      if (v <= 0.02) return
      playTone(180, 0.55, { type: 'sawtooth', volume: 0.05 * v, attack: 0.05, sweepTo: 520, pan })
      playNoise(0.5, { volume: 0.04 * v, cutoff: 1600, pan })
    },
    bombImpact(pan: number, gain: number): void {
      // Dumpfer Tiefschlag (Sinus 90→40 Hz) + kurzer gefilterter Rausch-Burst (Explosion).
      const v = Math.max(0, Math.min(1, gain))
      if (v <= 0.02) return
      playTone(90, 0.32, { type: 'sine', volume: 0.16 * v, attack: 0.004, sweepTo: 40, pan })
      playNoise(0.26, { volume: 0.14 * v, cutoff: 700, pan })
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
