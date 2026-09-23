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
