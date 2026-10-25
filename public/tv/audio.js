// Tiny synthesized sound system (no audio files needed).
let ctx = null;
let master, musicGain, engine;
let musicTimer = null;

export function audioReady() {
  return !!ctx && ctx.state === 'running';
}

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(lp).connect(g).connect(master);
    osc.start();
    engine = { osc, g, lp };
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(freq, dur, { type = 'square', vol = 0.3, slide = 0, delay = 0, dest } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(dest || master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.3, freq = 1200) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(master);
  s.start();
}

export function sfx(name) {
  if (!ctx) return;
  switch (name) {
    case 'count': tone(440, 0.25, { vol: 0.25 }); break;
    case 'go': tone(880, 0.6, { vol: 0.3 }); break;
    case 'box': tone(700, 0.08, { vol: 0.15 }); tone(1050, 0.12, { vol: 0.15, delay: 0.07 }); break;
    case 'gotitem': tone(990, 0.1, { vol: 0.15 }); tone(1320, 0.15, { vol: 0.15, delay: 0.08 }); break;
    case 'boost': tone(200, 0.5, { type: 'sawtooth', vol: 0.18, slide: 600 }); noise(0.4, 0.15, 800); break;
    case 'star': [0, 1, 2, 3].forEach((i) => tone(660 * 1.26 ** i, 0.12, { vol: 0.15, delay: i * 0.07 })); break;
    case 'zap': noise(0.5, 0.4, 3000); tone(1600, 0.4, { type: 'sawtooth', vol: 0.15, slide: -1400 }); break;
    case 'throw': tone(500, 0.15, { type: 'triangle', vol: 0.25, slide: 400 }); break;
    case 'drop': tone(300, 0.12, { type: 'triangle', vol: 0.25, slide: -150 }); break;
    case 'hit': noise(0.3, 0.45, 600); tone(400, 0.5, { type: 'square', vol: 0.15, slide: -300 }); break;
    case 'bump': noise(0.12, 0.3, 400); break;
    case 'bonk': noise(0.15, 0.3, 250); break;
    case 'lap': tone(784, 0.12, { vol: 0.2 }); tone(1046, 0.25, { vol: 0.2, delay: 0.12 }); break;
    case 'final': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, { vol: 0.2, delay: i * 0.12 })); break;
    case 'finish': [523, 523, 523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, { vol: 0.2, delay: i * 0.13 })); break;
    case 'join': tone(660, 0.1, { vol: 0.2 }); tone(990, 0.15, { vol: 0.2, delay: 0.08 }); break;
    case 'menu': tone(880, 0.05, { vol: 0.12 }); break;
  }
}

// `level` 0..1 from the humans' average speed.
export function setEngine(level, on) {
  if (!engine) return;
  const t = ctx.currentTime;
  engine.g.gain.setTargetAtTime(on ? 0.05 + level * 0.05 : 0, t, 0.1);
  engine.osc.frequency.setTargetAtTime(55 + level * 110, t, 0.08);
  engine.lp.frequency.setTargetAtTime(400 + level * 900, t, 0.1);
}

// Simple looping chiptune; each track gets its own key and pattern.
const SCALES = [
  [0, 2, 4, 7, 9, 12, 14, 16],
  [0, 3, 5, 7, 10, 12, 15, 17],
  [0, 2, 4, 5, 7, 9, 11, 12],
  [0, 3, 5, 6, 7, 10, 12, 15],
];

export function startMusic(trackIndex, bpm = 150) {
  stopMusic();
  if (!ctx) return;
  const scale = SCALES[trackIndex % SCALES.length];
  const root = [220, 196, 247, 185][trackIndex % 4];
  let seed = 1234 + trackIndex * 77;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const melody = Array.from({ length: 32 }, (_, i) => (i % 2 && rnd() < 0.35 ? -1 : Math.floor(rnd() * scale.length)));
  const bass = [0, 0, 4, 4, 3, 3, 5, 4];
  const step = 60 / bpm / 2;
  let i = 0;
  let next = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    while (next < ctx.currentTime + 0.25) {
      const n = melody[i % 32];
      const delay = next - ctx.currentTime;
      if (n >= 0) tone(root * 2 ** (scale[n] / 12) * 2, step * 0.9, { type: 'square', vol: 0.18, delay, dest: musicGain });
      if (i % 4 === 0) {
        const b = bass[Math.floor(i / 4) % 8];
        tone(root * 2 ** (scale[b] / 12) / 2, step * 3.5, { type: 'triangle', vol: 0.45, delay, dest: musicGain });
      }
      if (i % 2 === 0) tone(i % 8 === 4 ? 180 : 90, 0.06, { type: 'square', vol: 0.12, slide: -60, delay, dest: musicGain });
      i++;
      next += step;
    }
  }, 60);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}
