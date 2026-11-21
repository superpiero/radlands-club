// Procedural sound effects (WebAudio) – no audio files needed.

let ctx: AudioContext | null = null;
let muted = (() => { try { return localStorage.getItem('pk.muted') === '1'; } catch { return false; } })();
let volume = 0.5;

let unlocked = false;
if (typeof window !== 'undefined') {
  const unlock = () => { unlocked = true; window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function ac(): AudioContext | null {
  if (muted || !unlocked) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted() { return muted; }
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem('pk.muted', m ? '1' : '0'); } catch { /* ignore */ }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.3, slideTo?: number, delay = 0) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain * volume, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain = 0.3, filterFreq = 1200, type: BiquadFilterType = 'lowpass', delay = 0) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.value = gain * volume;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}

export const sfx = {
  click: () => tone(660, 0.05, 'triangle', 0.12),
  card: () => noise(0.18, 0.25, 2500, 'bandpass'),
  play: () => { noise(0.12, 0.2, 1800, 'bandpass'); tone(180, 0.15, 'triangle', 0.25, 120, 0.05); },
  hit: () => { noise(0.25, 0.5, 600); tone(110, 0.25, 'square', 0.15, 50); },
  destroy: () => { noise(0.8, 0.7, 400); tone(80, 0.6, 'sawtooth', 0.2, 30); },
  heal: () => { tone(520, 0.12, 'sine', 0.2); tone(780, 0.18, 'sine', 0.2, undefined, 0.09); },
  water: () => { tone(900, 0.15, 'sine', 0.22, 400); },
  draw: () => noise(0.1, 0.18, 3500, 'highpass'),
  raid: () => { tone(140, 0.5, 'sawtooth', 0.18, 90); tone(210, 0.5, 'sawtooth', 0.12, 140, 0.05); noise(0.5, 0.25, 900, 'lowpass', 0.05); },
  turn: () => { tone(523, 0.18, 'triangle', 0.25); tone(784, 0.3, 'triangle', 0.25, undefined, 0.14); },
  stun: () => { tone(1200, 0.25, 'square', 0.08, 300); },
  boom: () => { noise(1.0, 0.8, 300); tone(60, 0.8, 'sine', 0.4, 30); },
  error: () => tone(160, 0.18, 'square', 0.12, 120),
  win: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.25, undefined, i * 0.13)); },
  lose: () => { [392, 330, 262].forEach((f, i) => tone(f, 0.45, 'sawtooth', 0.12, undefined, i * 0.2)); },
  chat: () => tone(880, 0.06, 'sine', 0.12),
  rumble: () => { noise(1.0, 0.35, 160); tone(55, 1.0, 'sine', 0.25, 70); },
  tear: () => { noise(0.35, 0.6, 3000, 'highpass'); noise(0.5, 0.4, 500); },
  flip: () => { noise(0.12, 0.25, 2200, 'bandpass'); tone(600, 0.08, 'triangle', 0.12, 900); },
  rare: () => { noise(0.12, 0.25, 2200, 'bandpass'); [660, 880, 1320].forEach((f, i) => tone(f, 0.25, 'triangle', 0.2, undefined, 0.05 + i * 0.08)); },
  legendary: () => { tone(110, 0.9, 'sawtooth', 0.15, 55); [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.5, 'triangle', 0.24, undefined, 0.1 + i * 0.1)); noise(0.6, 0.3, 800, 'lowpass', 0.05); },
  whoosh: () => noise(0.22, 0.22, 1400, 'bandpass'),
  impact: () => { noise(0.18, 0.45, 700); tone(90, 0.2, 'sine', 0.3, 45); },
};
