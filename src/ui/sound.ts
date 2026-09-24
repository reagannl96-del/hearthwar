// Tiny synthesized sound effects (no audio files needed).

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, slide?: number) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  build() {
    tone(660, 0, 0.12, 'triangle', 0.08);
    tone(990, 0.09, 0.18, 'triangle', 0.06);
  },
  click() {
    tone(440, 0, 0.05, 'square', 0.02);
  },
  horn() {
    tone(196, 0, 0.5, 'sawtooth', 0.05, 220);
    tone(196, 0.55, 0.7, 'sawtooth', 0.05, 175);
  },
  report() {
    tone(520, 0, 0.08, 'sine', 0.06);
    tone(780, 0.07, 0.12, 'sine', 0.05);
  },
  quest() {
    tone(523, 0, 0.12, 'triangle', 0.07);
    tone(659, 0.1, 0.12, 'triangle', 0.07);
    tone(784, 0.2, 0.25, 'triangle', 0.07);
  },
  error() {
    tone(180, 0, 0.15, 'square', 0.03);
  },
};

// ---------- the sounds of a battle ----------

let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/** A burst of filtered noise: thuds, clashes, whooshes, splashes and booms are all made of this. */
function hiss(start: number, dur: number, gain: number, type: BiquadFilterType, freq: number, toFreq?: number, q = 1) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t0);
  if (toFreq) f.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.05);
}

export const battleSfx = {
  bell() {
    tone(988, 0, 0.9, 'sine', 0.05);
    tone(1976, 0, 0.5, 'sine', 0.015);
    tone(988, 0.45, 0.9, 'sine', 0.04);
  },
  horn() {
    tone(147, 0, 0.9, 'sawtooth', 0.035, 165);
    tone(220, 0.05, 0.85, 'sawtooth', 0.02, 247);
  },
  clash() {
    hiss(0, 0.12, 0.05, 'bandpass', 3200, 1800, 3);
    tone(2400 + Math.random() * 900, 0, 0.18, 'square', 0.008);
  },
  thud() {
    hiss(0, 0.35, 0.12, 'lowpass', 400, 80);
    tone(70, 0, 0.3, 'sine', 0.1, 40);
  },
  boom() {
    hiss(0, 1.1, 0.16, 'lowpass', 1400, 60);
    tone(55, 0, 0.8, 'sine', 0.12, 30);
  },
  twang() {
    tone(330 + Math.random() * 60, 0, 0.12, 'triangle', 0.025, 180);
    hiss(0.02, 0.25, 0.015, 'highpass', 2500);
  },
  whoosh() {
    hiss(0, 0.5, 0.05, 'bandpass', 500, 2400, 2);
  },
  /** A raptor's hunting shriek: a rising screech that breaks and falls away, a rasp of breath under it. */
  shriek() {
    tone(620, 0, 0.18, 'sawtooth', 0.022, 1500);
    tone(1500, 0.16, 0.32, 'sawtooth', 0.02, 480);
    tone(900, 0.02, 0.4, 'square', 0.006, 1900);
    hiss(0, 0.45, 0.02, 'bandpass', 2600, 1400, 3);
  },
  splash() {
    hiss(0, 0.45, 0.05, 'highpass', 1800, 900);
  },
  cheer() {
    for (let i = 0; i < 6; i++) tone(300 + Math.random() * 250, i * 0.07, 0.4, 'sawtooth', 0.012, 420 + Math.random() * 200);
    hiss(0, 0.9, 0.03, 'bandpass', 1100, 1300, 0.8);
  },
  fanfare() {
    tone(523, 0, 0.18, 'sawtooth', 0.04);
    tone(659, 0.18, 0.18, 'sawtooth', 0.04);
    tone(784, 0.36, 0.5, 'sawtooth', 0.045);
    tone(1047, 0.5, 0.7, 'triangle', 0.03);
  },
};
