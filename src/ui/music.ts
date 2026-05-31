/**
 * Prototyp: adaptiver, generativer Soundtrack (ADR-offen, Forts-Vorbild).
 *
 * KEINE Audio-Assets — alles aus Code synthetisiert (Web Audio), wie die SFX. Ein Lookahead-
 * Scheduler spielt eine geloopte Akkord-Progression in vier Schichten, deren Lautstärke von einer
 * **Intensitäts**-Zahl (0..1, aus dem Spielgeschehen) gesteuert wird → mehr Action = vollerer,
 * treibender Klang („horizontale Reorchestrierung"):
 *   - Pad   (immer): getragene Dreiklänge.
 *   - Bass  (ab ~0.12): Wurzel-Puls auf den Beats.
 *   - Arp   (ab ~0.4): Arpeggio der Akkord-Töne, hell.
 *   - Perc  (ab ~0.6): Rausch-Schläge auf den Beats.
 *
 * Reine Präsentation: nicht im Sim-State/Hash, eigener AudioContext, per Toggle opt-in. Erste
 * Fassung — Tempo/Tonart/Pegel sind die Tuning-Kandidaten.
 */

export interface MusicEngine {
  /** Ziel-Intensität setzen (0 = ruhig, 1 = Schlacht); der Motor blendet weich dorthin. */
  setIntensity(value: number): void
  start(): void
  stop(): void
  destroy(): void
}

interface AudioCtor {
  new (): AudioContext
}
function audioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null
  if ('AudioContext' in window)
    return (window as unknown as { AudioContext: AudioCtor }).AudioContext
  if ('webkitAudioContext' in window)
    return (window as unknown as { webkitAudioContext: AudioCtor }).webkitAudioContext
  return null
}

// Akkord-Progression in a-Moll (Am – F – C – G), als Halbton-Versätze zu A3 (220 Hz) + Dreiklang.
interface Chord {
  readonly root: number
  readonly triad: readonly number[]
}
const PROGRESSION: readonly Chord[] = [
  { root: 0, triad: [0, 3, 7] }, // Am
  { root: -4, triad: [0, 4, 7] }, // F
  { root: 3, triad: [0, 4, 7] }, // C
  { root: -2, triad: [0, 4, 7] }, // G
]

const BPM = 90
const STEPS_PER_BEAT = 2 // Achtel
const SECONDS_PER_STEP = 60 / BPM / STEPS_PER_BEAT
const STEPS_PER_CHORD = 8 // ein Akkord pro Takt
const LOOP_STEPS = STEPS_PER_CHORD * PROGRESSION.length

const semiToFreq = (semi: number): number => 220 * Math.pow(2, semi / 12)
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export function createMusicEngine(): MusicEngine {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let step = 0
  let nextNoteTime = 0
  let targetIntensity = 0
  let intensity = 0
  let arpIdx = 0

  function ensure(): boolean {
    if (ctx !== null) {
      if (ctx.state === 'suspended') void ctx.resume()
      return true
    }
    const Ctor = audioCtor()
    if (Ctor === null) return false
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.7
    master.connect(ctx.destination)
    return true
  }

  function note(
    freq: number,
    at: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    pan = 0,
  ): void {
    if (ctx === null || master === null || peak <= 0.0008) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.04, dur * 0.3))
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(g)
    if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner()
      p.pan.value = pan
      g.connect(p).connect(master)
    } else {
      g.connect(master)
    }
    osc.start(at)
    osc.stop(at + dur + 0.02)
  }

  function noiseHit(at: number, peak: number): void {
    if (ctx === null || master === null || peak <= 0.0008) return
    const dur = 0.18
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800
    const g = ctx.createGain()
    g.gain.setValueAtTime(peak, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    src.connect(lp).connect(g).connect(master)
    src.start(at)
    src.stop(at + dur + 0.02)
  }

  function scheduleStep(s: number, at: number): void {
    const chord = PROGRESSION[Math.floor(s / STEPS_PER_CHORD) % PROGRESSION.length]
    if (chord === undefined) return
    const beat = s % STEPS_PER_BEAT === 0
    // Schicht-Lautstärken aus der geglätteten Intensität (Crossfade per Schwellwert).
    const padG = 0.16 + 0.08 * intensity
    const bassG = clamp01((intensity - 0.12) / 0.3) * 0.16
    const arpG = clamp01((intensity - 0.4) / 0.3) * 0.09
    const percG = clamp01((intensity - 0.6) / 0.3) * 0.13

    // Pad: bei Akkordwechsel getragenen Dreiklang anstoßen.
    if (s % STEPS_PER_CHORD === 0) {
      const dur = STEPS_PER_CHORD * SECONDS_PER_STEP * 0.98
      chord.triad.forEach((iv, k) => {
        note(semiToFreq(chord.root + iv), at, dur, 'triangle', padG * (k === 0 ? 1 : 0.7))
      })
    }
    // Bass: Wurzel eine Oktave tiefer auf den Beats.
    if (beat && bassG > 0)
      note(semiToFreq(chord.root - 12), at, SECONDS_PER_STEP * 1.6, 'sine', bassG)
    // Arp: pro Step ein Dreiklang-Ton, hell, abwechselnd links/rechts.
    if (arpG > 0) {
      const iv = chord.triad[arpIdx % chord.triad.length] ?? 0
      note(
        semiToFreq(chord.root + iv + 12),
        at,
        SECONDS_PER_STEP * 0.9,
        'square',
        arpG,
        arpIdx % 2 === 0 ? -0.35 : 0.35,
      )
      arpIdx++
    }
    // Perc: Rausch-Schlag auf den Beats.
    if (beat && percG > 0) noiseHit(at, percG)
  }

  function tick(): void {
    if (ctx === null) return
    // Intensität weich nachziehen (kein Springen).
    intensity += (targetIntensity - intensity) * 0.05
    // Alle fälligen Steps im Lookahead-Fenster (0.1 s) einplanen.
    while (nextNoteTime < ctx.currentTime + 0.1) {
      scheduleStep(step, nextNoteTime)
      nextNoteTime += SECONDS_PER_STEP
      step = (step + 1) % LOOP_STEPS
    }
  }

  return {
    setIntensity(value: number): void {
      targetIntensity = clamp01(value)
    },
    start(): void {
      if (!ensure() || ctx === null) return
      if (timer !== null) return
      step = 0
      arpIdx = 0
      nextNoteTime = ctx.currentTime + 0.1
      timer = setInterval(tick, 25)
    },
    stop(): void {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    },
    destroy(): void {
      this.stop()
      if (ctx !== null) {
        void ctx.close()
        ctx = null
        master = null
      }
    },
  }
}
