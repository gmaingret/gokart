// Synthesized audio: engines, layered sound effects and a sequenced soundtrack.
// Everything is generated with Web Audio, so there are no sound files to load.

let ctx = null;
let master, comp, sfxBus, musicBus, engineBus, reverb, reverbSend, noiseBuf;

export function audioReady() {
  return !!ctx && ctx.state === 'running';
}

function makeImpulse(seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC({ latencyHint: 'interactive' });
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(comp).connect(ctx.destination);

    reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(2.2, 3);
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.22;
    reverbSend.connect(reverb).connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
    sfxBus.connect(reverbSend);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.42;
    musicBus.connect(master);
    const musicVerb = ctx.createGain();
    musicVerb.gain.value = 0.3;
    musicBus.connect(musicVerb).connect(reverbSend);
    engineBus = ctx.createGain();
    engineBus.gain.value = 0.55;
    engineBus.connect(master);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

const now = () => ctx.currentTime;
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------- building blocks
function env(g, t, a, peak, d, sustain, rel, end) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), t + a + d);
  g.gain.setValueAtTime(Math.max(0.0001, peak * sustain), end);
  g.gain.exponentialRampToValueAtTime(0.0001, end + rel);
}

function osc(type, freq, t, dur, { vol = 0.3, slide = 0, slideTime, attack = 0.005, decay = 0.08, sustain = 0.6, release = 0.08, dest = sfxBus, detune = 0, filter, vib } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.detune.value = detune;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + (slideTime ?? dur));
  const g = ctx.createGain();
  env(g, t, attack, vol, decay, sustain, release, t + dur);
  let node = o;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter.type || 'lowpass';
    f.frequency.setValueAtTime(filter.freq, t);
    if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t + (filter.time ?? dur));
    f.Q.value = filter.q ?? 1;
    node = node.connect(f);
  }
  node.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + release + 0.05);
  if (vib) {
    // Vibrato: [rate Hz, depth cents], fading in after the attack.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = vib[0];
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(vib[1], t + Math.min(0.25, dur));
    lfo.connect(depth).connect(o.detune);
    lfo.start(t);
    lfo.stop(t + dur + release + 0.05);
  }
  return o;
}

function noise(t, dur, { vol = 0.3, type = 'bandpass', freq = 1200, to, q = 1, attack = 0.003, release = 0.05, dest = sfxBus } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
  s.connect(f).connect(g).connect(dest);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + release + 0.05);
}

function bell(freq, t, vol = 0.2, dur = 1.2, dest = sfxBus) {
  for (const [m, a] of [[1, 1], [2.76, 0.45], [5.4, 0.25], [8.93, 0.12]]) {
    osc('sine', freq * m, t, 0.01, { vol: vol * a, attack: 0.002, decay: dur / m, sustain: 0.001, release: 0.05, dest });
  }
}

// ---------------------------------------------------------------- sound effects
export function sfx(name, arg) {
  if (!ctx) return;
  const t = now() + 0.005;
  switch (name) {
    case 'count':
      osc('square', 523, t, 0.28, { vol: 0.22, filter: { freq: 2500 } });
      osc('sine', 1046, t, 0.28, { vol: 0.1 });
      break;
    case 'go':
      osc('square', 1046, t, 0.7, { vol: 0.22, filter: { freq: 3500 } });
      osc('sine', 2093, t, 0.7, { vol: 0.08 });
      osc('sawtooth', 523, t, 0.7, { vol: 0.08, filter: { freq: 1500 } });
      sfx('cheer', 0.7);
      break;
    case 'box': {
      noise(t, 0.12, { vol: 0.35, type: 'highpass', freq: 3000 });
      for (let i = 0; i < 6; i++) osc('triangle', 1500 + Math.random() * 3000, t + i * 0.018, 0.05, { vol: 0.08, decay: 0.05, sustain: 0.01 });
      break;
    }
    case 'tick':
      osc('square', 1800 + Math.random() * 300, t, 0.012, { vol: 0.05, decay: 0.01, sustain: 0.01, release: 0.01 });
      break;
    case 'gotitem':
      [72, 76, 79, 84].forEach((m, i) => {
        osc('square', midiHz(m), t + i * 0.055, 0.09, { vol: 0.09, filter: { freq: 3000 } });
        osc('triangle', midiHz(m + 12), t + i * 0.055, 0.12, { vol: 0.06 });
      });
      break;
    case 'boost':
      noise(t, 0.7, { vol: 0.32, freq: 500, to: 3500, q: 1.4, attack: 0.03 });
      osc('sawtooth', 140, t, 0.6, { vol: 0.12, slide: 520, filter: { freq: 900, to: 3000 } });
      osc('sine', 70, t, 0.5, { vol: 0.25, slide: 60 });
      break;
    case 'tier': {
      const base = [880, 1175, 1568][arg ?? 0];
      osc('square', base, t, 0.06, { vol: 0.07, filter: { freq: 4000 } });
      osc('square', base * 1.5, t + 0.05, 0.08, { vol: 0.06, filter: { freq: 4000 } });
      noise(t, 0.08, { vol: 0.06, type: 'highpass', freq: 6000 });
      break;
    }
    case 'star':
      [0, 4, 7, 12, 16, 19, 24].forEach((m, i) => osc('square', midiHz(76 + m), t + i * 0.04, 0.06, { vol: 0.07, filter: { freq: 5000 } }));
      break;
    case 'zap': {
      // Thunder: bright crack, then a long rolling rumble.
      noise(t, 0.08, { vol: 0.6, type: 'highpass', freq: 2000 });
      for (let i = 0; i < 6; i++) noise(t + 0.03 + Math.random() * 0.3, 0.04, { vol: 0.3, type: 'highpass', freq: 3000 });
      noise(t + 0.05, 1.8, { vol: 0.55, type: 'lowpass', freq: 1800, to: 80, attack: 0.02, release: 0.4 });
      osc('sine', 55, t, 1.4, { vol: 0.35, slide: -25, attack: 0.05, decay: 1.2, sustain: 0.2 });
      osc('sawtooth', 1600, t, 0.4, { vol: 0.08, slide: -1500 });
      break;
    }
    case 'throw':
      noise(t, 0.22, { vol: 0.25, freq: 900, to: 2500, q: 2 });
      osc('triangle', 380, t, 0.18, { vol: 0.16, slide: 500 });
      break;
    case 'drop':
      osc('sine', 340, t, 0.12, { vol: 0.25, slide: -230 });
      noise(t, 0.06, { vol: 0.15, type: 'lowpass', freq: 800 });
      break;
    case 'hit':
      noise(t, 0.35, { vol: 0.55, type: 'lowpass', freq: 3000, to: 300 });
      osc('square', 700, t, 0.55, { vol: 0.12, slide: -580, filter: { freq: 2000 } });
      // cartoon "boing" wobble
      for (let i = 0; i < 4; i++) osc('sine', 300 - i * 40, t + 0.15 + i * 0.09, 0.08, { vol: 0.12, slide: 120 });
      break;
    case 'slip':
      osc('sine', 600, t, 0.25, { vol: 0.18, slide: -480 });
      noise(t, 0.2, { vol: 0.2, freq: 2500, to: 600, q: 3 });
      break;
    case 'explode':
      noise(t, 0.5, { vol: 0.5, type: 'lowpass', freq: 2500, to: 120 });
      osc('sine', 120, t, 0.35, { vol: 0.35, slide: -80 });
      break;
    case 'pop':
      noise(t, 0.06, { vol: 0.5, type: 'highpass', freq: 1500 });
      osc('sine', 900, t, 0.08, { vol: 0.2, slide: -600 });
      osc('triangle', 1400, t + 0.04, 0.12, { vol: 0.08, slide: 900 });
      break;
    case 'bump':
      osc('sine', 130, t, 0.12, { vol: 0.35, slide: -70 });
      noise(t, 0.08, { vol: 0.2, type: 'lowpass', freq: 900 });
      break;
    case 'bonk':
      osc('sine', 90, t, 0.18, { vol: 0.4, slide: -40 });
      noise(t, 0.12, { vol: 0.3, type: 'lowpass', freq: 600 });
      osc('square', 1900, t, 0.1, { vol: 0.04, filter: { type: 'bandpass', freq: 2200, q: 8 } });
      osc('square', 2140, t, 0.12, { vol: 0.04, filter: { type: 'bandpass', freq: 2300, q: 8 } });
      break;
    // Air hockey: puck off a mallet / a rail (arg = 0..1 strength), and a goal horn.
    case 'puck': {
      const k = Math.min(1, arg ?? 0.5);
      noise(t, 0.025, { vol: 0.25 + k * 0.4, type: 'bandpass', freq: 2200 + k * 1800, q: 1.5 });
      osc('sine', 700 + k * 500, t, 0.05, { vol: 0.12 + k * 0.2, slide: -300, decay: 0.04, sustain: 0.05 });
      break;
    }
    case 'rail': {
      const k = Math.min(1, arg ?? 0.5);
      noise(t, 0.04, { vol: 0.15 + k * 0.3, type: 'bandpass', freq: 900 + k * 600, q: 2 });
      osc('triangle', 220 + k * 80, t, 0.08, { vol: 0.1 + k * 0.15, slide: -60 });
      break;
    }
    case 'goal':
      [55, 59, 62, 67].forEach((m) => {
        osc('sawtooth', midiHz(m), t, 0.9, { vol: 0.07, attack: 0.02, decay: 0.2, sustain: 0.8, release: 0.3, filter: { freq: 2400 } });
        osc('square', midiHz(m + 12), t, 0.9, { vol: 0.03, attack: 0.02, release: 0.3, filter: { freq: 3000 } });
      });
      noise(t, 0.6, { vol: 0.25, type: 'lowpass', freq: 3000, to: 300 });
      sfx('cheer', 1.2);
      break;
    case 'pad':
      noise(t, 0.4, { vol: 0.2, freq: 1500, to: 5000, q: 2 });
      osc('square', 600, t, 0.25, { vol: 0.06, slide: 900, filter: { freq: 3000 } });
      break;
    case 'lap':
      bell(1318, t, 0.16);
      bell(1760, t + 0.14, 0.16);
      break;
    case 'final':
      [60, 64, 67, 72].forEach((m, i) => brass(m, t + i * 0.13, i === 3 ? 0.5 : 0.12, 0.13));
      break;
    case 'finish':
      [[60, 0], [64, 0.15], [67, 0.3], [72, 0.45], [67, 0.75], [72, 0.9]].forEach(([m, d], i) => brass(m, t + d, i === 5 ? 0.9 : 0.14, 0.14));
      [72, 76, 79, 84].forEach((m) => bell(midiHz(m), t + 0.9, 0.06, 2));
      sfx('cheer', 1.4);
      break;
    case 'cheer': {
      const amt = arg ?? 1;
      for (let i = 0; i < 4; i++) noise(t + i * 0.04, 1.4 * amt, { vol: 0.07 * amt, freq: 900 + i * 500, q: 0.8, attack: 0.3, release: 0.8 });
      for (let i = 0; i < 10 * amt; i++) osc('sine', 1200 + Math.random() * 1600, t + Math.random() * amt, 0.1, { vol: 0.02, slide: 400 });
      break;
    }
    case 'beep': {
      const f = 1400 + (arg ?? 0) * 800;
      osc('square', f, t, 0.05, { vol: 0.06, filter: { freq: 4000 } });
      break;
    }
    case 'join':
      osc('triangle', midiHz(76), t, 0.08, { vol: 0.2 });
      osc('triangle', midiHz(83), t + 0.07, 0.14, { vol: 0.2 });
      bell(midiHz(88), t + 0.07, 0.05);
      break;
    case 'menu':
      osc('triangle', 1320, t, 0.03, { vol: 0.12, decay: 0.03, sustain: 0.1 });
      break;
  }
}

function brass(m, t, dur, vol) {
  osc('sawtooth', midiHz(m), t, dur, { vol, attack: 0.03, decay: 0.1, sustain: 0.8, release: 0.15, filter: { freq: 600, to: 3500, time: 0.08 } });
  osc('sawtooth', midiHz(m), t, dur, { vol: vol * 0.6, detune: 9, attack: 0.03, release: 0.15, filter: { freq: 2500 } });
}

// ---------------------------------------------------------------- engines
const engines = new Map();

// A soft, rounded "electric go-kart" hum: triangle + sine voices through a gentle
// low-pass, with a slow tremolo for texture. No distortion, so it stays easy on
// the ears over a whole race.
function makeEngine() {
  const out = ctx.createGain();
  out.gain.value = 0;
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.7;
  const mix = ctx.createGain();
  mix.gain.value = 0.5;
  mix.connect(lp).connect(out).connect(pan).connect(engineBus);

  const voice = (type, gain, detune = 0) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g).connect(mix);
    return o;
  };
  const o1 = voice('triangle', 0.6); // main tone
  const o2 = voice('sine', 0.7); // body, an octave down
  const o3 = voice('triangle', 0.25, 7); // slight chorus
  const o4 = voice('sine', 0.08); // airy overtone
  // Gentle tremolo gives a soft "purr" instead of a buzz.
  const trem = ctx.createOscillator();
  trem.type = 'sine';
  const tremDepth = ctx.createGain();
  tremDepth.gain.value = 0.1;
  trem.connect(tremDepth).connect(mix.gain);
  for (const o of [o1, o2, o3, o4, trem]) o.start();

  // Tyre squeal (drift), off-road rumble and wind, all kept soft.
  const nz = ctx.createBufferSource(); nz.buffer = noiseBuf; nz.loop = true;
  const screechF = ctx.createBiquadFilter(); screechF.type = 'bandpass'; screechF.frequency.value = 1300; screechF.Q.value = 1.5;
  const screechLp = ctx.createBiquadFilter(); screechLp.type = 'lowpass'; screechLp.frequency.value = 2800;
  const screech = ctx.createGain(); screech.gain.value = 0;
  const wob = ctx.createOscillator(); wob.frequency.value = 5;
  const wobD = ctx.createGain(); wobD.gain.value = 150;
  wob.connect(wobD).connect(screechF.frequency);
  nz.connect(screechF).connect(screechLp).connect(screech).connect(pan);
  const rumbleF = ctx.createBiquadFilter(); rumbleF.type = 'lowpass'; rumbleF.frequency.value = 160;
  const rumble = ctx.createGain(); rumble.gain.value = 0;
  nz.connect(rumbleF).connect(rumble).connect(pan);
  const windF = ctx.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 600; windF.Q.value = 0.5;
  const wind = ctx.createGain(); wind.gain.value = 0;
  nz.connect(windF).connect(wind).connect(pan);
  nz.start();
  wob.start();
  return { out, pan, lp, o1, o2, o3, o4, trem, screech, rumble, wind, nodes: [o1, o2, o3, o4, trem, nz, wob] };
}

// state: {speed, max, gas, boost, drifting, offroad, pan, on, scale}
export function updateEngine(id, s) {
  if (!ctx) return;
  let e = engines.get(id);
  if (!e) engines.set(id, (e = makeEngine()));
  const t = now();
  const sp = Math.max(0, s.speed) / s.max;
  // Three soft "gears": the pitch rises through each and eases back on the shift.
  const gears = [0, 0.3, 0.65, 1.6];
  let g = 0;
  while (g < 2 && sp > gears[g + 1]) g++;
  const frac = Math.min(1, (sp - gears[g]) / (gears[g + 1] - gears[g]));
  let rpm = 0.35 + frac * 0.5 + g * 0.08;
  if (sp < 0.03) rpm = 0.3;
  if (s.boost) rpm *= 1.12;
  const f = 90 + rpm * 120;
  const tc = 0.09;
  e.o1.frequency.setTargetAtTime(f, t, tc);
  e.o2.frequency.setTargetAtTime(f / 2, t, tc);
  e.o3.frequency.setTargetAtTime(f, t, tc);
  e.o4.frequency.setTargetAtTime(f * 3, t, tc);
  e.trem.frequency.setTargetAtTime(6 + rpm * 10, t, tc);
  e.lp.frequency.setTargetAtTime(s.gas ? 450 + rpm * 700 : 300 + rpm * 300, t, 0.12);
  const sc = s.scale ?? 1;
  const vol = s.on ? (s.gas ? 0.3 : 0.18) * sc : 0;
  e.out.gain.setTargetAtTime(vol, t, 0.12);
  e.screech.gain.setTargetAtTime(s.on && s.drifting && sp > 0.3 ? 0.035 * sc : 0, t, 0.08);
  e.rumble.gain.setTargetAtTime(s.on && s.offroad && sp > 0.05 ? 0.25 * sc : 0, t, 0.1);
  e.wind.gain.setTargetAtTime(s.on ? Math.max(0, sp - 0.6) * 0.06 * sc : 0, t, 0.3);
  if (e.pan.pan) e.pan.pan.setTargetAtTime(s.pan ?? 0, t, 0.1);
}

export function stopEngines() {
  for (const e of engines.values()) {
    e.out.gain.setTargetAtTime(0, now(), 0.05);
    e.screech.gain.setTargetAtTime(0, now(), 0.05);
    e.rumble.gain.setTargetAtTime(0, now(), 0.05);
    e.wind.gain.setTargetAtTime(0, now(), 0.05);
    const nodes = e.nodes;
    setTimeout(() => nodes.forEach((n) => n.stop()), 400);
  }
  engines.clear();
}

// ---------------------------------------------------------------- music
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  hijaz: [0, 1, 4, 5, 7, 8, 10],
  minpent: [0, 3, 5, 7, 10],
};

// Each circuit has its own style: tempo, metre, groove and instruments.
//   meter: steps per bar, div: steps per beat, swing: delay of odd steps (fraction of a step)
//   drums: DRUMS pattern, bass: bass line style + bassInst, chords: accompaniment style
//   arp: { pat, inst, vol, oct }, lead: { inst, style: pop | busy | long, vol }
const SONGS = {
  // Sunny Circuit: bright pop-rock with strummed guitar.
  0: { bpm: 142, root: 60, scale: 'major', prog: [0, 4, 5, 3, 0, 4, 3, 4], seed: 11, drums: 'pop', bass: 'bounce', chords: 'strum', arp: { pat: 'eighths', inst: 'triangle', vol: 0.7 }, lead: { inst: 'square', style: 'pop' } },
  // Dune Dash: desert groove, darbuka and an oud-like plucked melody over a drone.
  1: { bpm: 108, root: 62, scale: 'hijaz', prog: [0, 0, 6, 0, 3, 3, 1, 0], seed: 23, drums: 'darbuka', bass: 'drone', bassInst: 'sine', chords: 'pad', arp: null, lead: { inst: 'pluck', style: 'busy', vol: 1.2 } },
  // Frosty Peaks: a waltz with sleigh bells and a celesta.
  2: { bpm: 168, meter: 12, root: 64, scale: 'major', prog: [0, 3, 4, 0, 5, 1, 4, 0], seed: 37, drums: 'waltz', bass: 'tuba', bassInst: 'sine', chords: 'waltz', arp: null, lead: { inst: 'bell', style: 'pop' } },
  // Neon Night: synthwave, gated snare, octave bass and a vibrato saw lead.
  3: { bpm: 100, root: 57, scale: 'minor', prog: [0, 5, 2, 6], seed: 53, drums: 'synthwave', bass: 'octave8', bassInst: 'synth', chords: 'pad', arp: { pat: 'up', inst: 'sawtooth', vol: 0.5 }, lead: { inst: 'synthlead', style: 'long' } },
  // Autumn Woods: Celtic jig in 12/8, flute and bodhrán.
  4: { bpm: 116, meter: 12, div: 3, root: 62, scale: 'dorian', prog: [0, 0, 6, 6, 0, 0, 4, 0], seed: 101, drums: 'jig', bass: 'jig', bassInst: 'sine', chords: 'strum', arp: null, lead: { inst: 'flute', style: 'busy' } },
  // Beach Bay: laid-back reggae with off-beat skank and steel drums.
  5: { bpm: 98, root: 65, scale: 'mixolydian', prog: [0, 3, 4, 3], seed: 113, swing: 0.15, drums: 'reggae', bass: 'reggae', bassInst: 'sine', chords: 'stab', arp: null, lead: { inst: 'steel', style: 'pop' } },
  // Lava Castle: metal, double kick, distorted power chords and lead.
  6: { bpm: 168, root: 52, scale: 'phrygian', prog: [0, 0, 1, 0, 5, 5, 6, 4], seed: 127, drums: 'metal', bass: 'chug', bassInst: 'dist', chords: 'power', arp: null, lead: { inst: 'distlead', style: 'long' } },
  // Candy Land: bouncy chiptune.
  7: { bpm: 156, root: 67, scale: 'major', prog: [0, 3, 4, 0, 5, 3, 1, 4], seed: 139, drums: 'chip', bass: 'octave8', bassInst: 'square', chords: 'none', arp: { pat: 'fast', inst: 'chip', vol: 0.45 }, lead: { inst: 'chip', style: 'busy' } },
  // Jungle Ruins: tribal toms, marimba and pan flute.
  8: { bpm: 116, root: 57, scale: 'minpent', prog: [0, 0, 3, 0, 2, 3, 0, 0], seed: 151, drums: 'jungle', bass: 'drone', bassInst: 'sine', chords: 'none', arp: { pat: 'updown', inst: 'marimba', vol: 1.3 }, lead: { inst: 'panflute', style: 'long' } },
  // Cosmic Way: trance, rolling off-beat bass and supersaws.
  9: { bpm: 138, root: 61, scale: 'minor', prog: [0, 5, 3, 6], seed: 163, drums: 'trance', bass: 'offbeat', bassInst: 'synth', chords: 'gated', arp: { pat: 'fast', inst: 'sawtooth', vol: 0.3, oct: 2 }, lead: { inst: 'supersaw', style: 'long' } },
  // Air hockey: driving electro.
  hockey: { bpm: 124, root: 57, scale: 'minor', prog: [0, 5, 2, 6, 0, 5, 3, 4], seed: 211, drums: 'synthwave', bass: 'offbeat', bassInst: 'synth', chords: 'gated', arp: { pat: 'up', inst: 'sawtooth', vol: 0.4 }, lead: { inst: 'synthlead', style: 'long', vol: 0.8 } },
  lobby: { bpm: 96, root: 65, scale: 'major', prog: [0, 5, 3, 4, 0, 5, 1, 4], seed: 71, drums: 'soft', bass: 'bounce', chords: 'pad', arp: { pat: 'up', inst: 'triangle', vol: 1.4 }, lead: null },
  results: { bpm: 118, root: 60, scale: 'major', prog: [0, 3, 4, 0, 5, 3, 4, 4], seed: 89, drums: 'pop', bass: 'bounce', chords: 'pad', arp: { pat: 'up', inst: 'triangle' }, lead: { inst: 'square', style: 'pop' } },
  star: { bpm: 172, root: 67, scale: 'major', prog: [0, 0, 3, 4], seed: 97, drums: 'four', bass: 'bounce', chords: 'pad', arp: { pat: 'fast', inst: 'triangle' }, lead: { inst: 'square', style: 'pop' } },
};

const DRUMS = {
  // One token per step ('' = rest, '+' joins hits):
  // k kick, q light kick (double bass), s snare, S big snare, C clap, h closed hat, o open hat, t low tom, T high tom,
  // d doum, x tek, g shaker, j sleigh bells, r rim, K kick + rim
  pop: ['k', 'h', 'h', 'h', 's', 'h', 'k', 'h', 'k', 'h', 'h', 'h', 's', 'h', 'h', 'o'],
  soft: ['k', '', '', '', '', '', 'h', '', 'k', '', '', '', '', '', 'h', ''],
  four: ['k', 'h', 'o', 'h', 'k', 'h', 'o', 'h', 'k', 'h', 'o', 'h', 'k', 'h', 'o', 'h'],
  darbuka: ['d', '', 'x', 'g', '', 'g', 'x', '', 'd', 'g', '', 'g', 'x', '', 'x', 'g'],
  waltz: ['k+j', 'j', 'j', 'j', 's+j', 'j', 'j', 'j', 's+j', 'j', 'j', 'j'],
  synthwave: ['k', '', 'h', '', 'k+S', '', 'h', '', 'k', '', 'h', '', 'k+S', '', 'h', 'o'],
  jig: ['d', 'h', 'h', 't', 'h', 'h', 'd', 'h', 'h', 's', 'h', 't'],
  reggae: ['', 'h', '', 'h', '', 'h', '', 'h', 'K', 'h', '', 'h', '', 'h', 'r', 'h'],
  metal: ['k+h', 'q', 'q+h', 'q', 'S+k+h', 'q', 'q+h', 'q', 'k+h', 'q', 'q+h', 'q', 'S+k+h', 'q', 'q+h', 'q'],
  chip: ['k', '', 'h', '', 's', '', 'h', 'h', 'k', 'k', 'h', '', 's', '', 'h', 's'],
  jungle: ['k+g', 'g', 't', 'g', 'T', 'g', 't', 't', 'k+g', 'g', 't', 'g', 'T', 't', 'T', 'g'],
  trance: ['k', '', 'o', '', 'k+C', '', 'o', '', 'k', '', 'o', '', 'k+C', '', 'o', 'h'],
};

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// Melody built from a two-bar phrase over the chords, arranged A A' B A so it
// sounds like a tune rather than random notes. Strong beats land on chord
// tones; in between the line moves mostly by step.
function composeLead(song) {
  const r = seeded(song.seed);
  const meter = song.meter ?? 16, div = song.div ?? 4;
  const style = song.lead.style ?? 'pop';
  const grid = style === 'busy' ? 1 : style === 'long' ? div : 2;
  const pick = (a) => a[Math.floor(r() * a.length)];
  const phrase = () => {
    const out = [];
    let deg = 0;
    for (let step = 0; step < meter * 2; step += grid) {
      const strong = step % div === 0;
      const rest = style === 'busy' ? 0.1 : style === 'long' ? 0.15 : 0.28;
      if (step % meter !== 0 && !strong && r() < rest) continue;
      if (style === 'long' && step % meter !== 0 && r() < rest) continue;
      if (strong) {
        const near = [0, 2, 4, 7].filter((c) => Math.abs(c - deg) <= 3);
        deg = pick(near.length ? near : [0, 2, 4]);
      } else {
        deg = Math.max(-2, Math.min(8, deg + pick([-1, 1, -1, 1, 2, -2])));
      }
      let len = style === 'busy' ? (r() < 0.15 ? 2 : 1) : style === 'long' ? div * (r() < 0.45 ? 2 : 1) : r() < 0.25 ? 4 : 2;
      len = Math.min(len, meter * 2 - step);
      out.push({ step, deg, len, oct: r() < 0.12 ? 1 : 0 });
      if (style === 'long') step += len - grid;
    }
    return out;
  };
  const A = phrase(), B = phrase();
  const A2 = A.map((n, i) => (i === A.length - 1 ? { ...n, deg: 0 } : n));
  return [A, A2, B, A];
}

const music = { timer: null, song: null, step: 0, next: 0, lead: null, tempoMul: 1, finalLap: false, prev: null, name: null };

function scaleNote(song, degree, octave = 0) {
  const sc = SCALES[song.scale];
  const o = Math.floor(degree / sc.length);
  const d = ((degree % sc.length) + sc.length) % sc.length;
  return song.root + sc[d] + 12 * (o + octave);
}

// Soft-clipping bus for the metal guitars, created on first use.
let distBus = null;
function getDist() {
  if (!distBus) {
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 7);
    shaper.curve = curve;
    shaper.oversample = '2x';
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3200;
    const out = ctx.createGain();
    out.gain.value = 0.2;
    distBus = ctx.createGain();
    distBus.connect(shaper).connect(tone).connect(out).connect(musicBus);
  }
  return distBus;
}

// Melodic instruments: (frequency, start, duration, volume).
const M = () => musicBus;
const INST = {
  square(f, t, d, v) {
    osc('square', f, t, d, { vol: v, attack: 0.008, decay: 0.12, sustain: 0.55, release: 0.06, filter: { freq: 3200 }, dest: M() });
    osc('square', f, t, d, { vol: v * 0.55, detune: 10, attack: 0.008, release: 0.06, filter: { freq: 2400 }, dest: M() });
  },
  triangle(f, t, d, v) {
    osc('triangle', f, t, d, { vol: v, attack: 0.003, decay: 0.08, sustain: 0.2, dest: M() });
  },
  sawtooth(f, t, d, v) {
    osc('sawtooth', f, t, d, { vol: v * 0.7, attack: 0.003, decay: 0.1, sustain: 0.25, release: 0.05, filter: { freq: 3000, to: 900, time: 0.12 }, dest: M() });
  },
  synthlead(f, t, d, v) {
    for (const det of [-7, 7]) osc('sawtooth', f, t, d, { vol: v * 0.6, detune: det, attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.2, vib: [5.5, 18], filter: { freq: 2600 }, dest: M() });
  },
  supersaw(f, t, d, v) {
    for (const det of [-16, -6, 6, 16]) osc('sawtooth', f, t, d, { vol: v * 0.4, detune: det, attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.25, filter: { freq: 4200 }, dest: M() });
  },
  pluck(f, t, d, v) {
    const len = Math.min(d, 0.45);
    osc('sawtooth', f, t, len, { vol: v * 0.9, attack: 0.002, decay: 0.25, sustain: 0.05, release: 0.12, filter: { freq: 4500, to: 500, time: 0.25, q: 2 }, dest: M() });
    osc('triangle', f * 2, t, len * 0.5, { vol: v * 0.3, attack: 0.001, decay: 0.12, sustain: 0.05, dest: M() });
  },
  flute(f, t, d, v) {
    osc('sine', f, t, d, { vol: v * 1.3, attack: 0.04, decay: 0.15, sustain: 0.8, release: 0.08, vib: [5.5, 12], dest: M() });
    osc('triangle', f * 2, t, d, { vol: v * 0.12, attack: 0.05, sustain: 0.6, dest: M() });
    noise(t, 0.05, { vol: v * 0.25, type: 'bandpass', freq: f * 3, q: 3, dest: M() });
  },
  panflute(f, t, d, v) {
    osc('sine', f, t, d, { vol: v * 1.4, attack: 0.07, decay: 0.3, sustain: 0.7, release: 0.25, vib: [4.5, 16], dest: M() });
    noise(t, d * 0.8, { vol: v * 0.12, type: 'bandpass', freq: f * 2, q: 6, attack: 0.05, dest: M() });
  },
  bell(f, t, d, v) {
    bell(f * 2, t, v * 0.9, 1.4, M());
  },
  steel(f, t, d, v) {
    for (const [m, a] of [[1, 1], [2, 0.5], [3.01, 0.22], [4.2, 0.08]]) {
      osc('sine', f * m, t, 0.01, { vol: v * 1.2 * a, attack: 0.002, decay: 0.45 / m, sustain: 0.001, release: 0.05, dest: M() });
    }
  },
  marimba(f, t, d, v) {
    osc('sine', f, t, 0.01, { vol: v, attack: 0.002, decay: 0.3, sustain: 0.001, release: 0.05, dest: M() });
    osc('sine', f * 3.93, t, 0.01, { vol: v * 0.3, attack: 0.001, decay: 0.05, sustain: 0.001, release: 0.02, dest: M() });
  },
  chip(f, t, d, v) {
    osc('square', f, t, d * 0.8, { vol: v * 0.8, attack: 0.001, decay: 0.04, sustain: 0.6, release: 0.01, dest: M() });
  },
  distlead(f, t, d, v) {
    osc('sawtooth', f, t, d, { vol: v * 2.2, attack: 0.005, decay: 0.2, sustain: 0.8, release: 0.1, vib: [6, 22], dest: getDist() });
  },
};

function playDrum(kind, t) {
  const dest = musicBus;
  switch (kind) {
    case 'k':
      osc('sine', 150, t, 0.16, { vol: 0.9, slide: -110, slideTime: 0.11, attack: 0.002, decay: 0.15, sustain: 0.01, dest });
      noise(t, 0.01, { vol: 0.15, type: 'highpass', freq: 3000, dest });
      break;
    case 'q':
      osc('sine', 130, t, 0.1, { vol: 0.45, slide: -80, slideTime: 0.08, attack: 0.002, decay: 0.09, sustain: 0.01, dest });
      break;
    case 's':
      noise(t, 0.12, { vol: 0.35, type: 'highpass', freq: 1400, dest });
      osc('triangle', 200, t, 0.06, { vol: 0.25, slide: -60, dest });
      break;
    case 'S':
      noise(t, 0.3, { vol: 0.42, type: 'highpass', freq: 900, dest });
      osc('triangle', 180, t, 0.1, { vol: 0.3, slide: -60, dest });
      break;
    case 'C':
      for (const dt of [0, 0.011, 0.022]) noise(t + dt, 0.012, { vol: 0.28, type: 'bandpass', freq: 1500, q: 1.5, dest });
      noise(t + 0.03, 0.14, { vol: 0.18, type: 'bandpass', freq: 1500, dest });
      break;
    case 'h':
      noise(t, 0.02, { vol: 0.12, type: 'highpass', freq: 8000, dest });
      break;
    case 'o':
      noise(t, 0.12, { vol: 0.1, type: 'highpass', freq: 7000, dest });
      break;
    case 't':
      osc('sine', 220, t, 0.12, { vol: 0.35, slide: -90, dest });
      break;
    case 'T':
      osc('sine', 330, t, 0.1, { vol: 0.3, slide: -120, dest });
      break;
    case 'd':
      osc('sine', 120, t, 0.22, { vol: 0.6, slide: -55, attack: 0.002, decay: 0.2, sustain: 0.05, dest });
      noise(t, 0.03, { vol: 0.12, type: 'lowpass', freq: 500, dest });
      break;
    case 'x':
      noise(t, 0.035, { vol: 0.3, type: 'bandpass', freq: 3500, q: 3, dest });
      osc('triangle', 900, t, 0.03, { vol: 0.08, dest });
      break;
    case 'g':
      noise(t, 0.03, { vol: 0.07, type: 'bandpass', freq: 6500, q: 2, dest });
      break;
    case 'j':
      noise(t, 0.05, { vol: 0.07, type: 'highpass', freq: 8500, dest });
      if (Math.random() < 0.4) osc('sine', 5200 + Math.random() * 800, t, 0.01, { vol: 0.02, decay: 0.08, sustain: 0.001, dest });
      break;
    case 'r':
      noise(t, 0.02, { vol: 0.3, type: 'bandpass', freq: 1800, q: 4, dest });
      osc('sine', 800, t, 0.02, { vol: 0.12, dest });
      break;
    case 'K':
      playDrum('k', t);
      playDrum('r', t);
      break;
  }
}

function bassNote(inst, m, t, dur, vol = 1) {
  const f = midiHz(m);
  const dest = musicBus;
  if (inst === 'sine') {
    osc('sine', f, t, dur, { vol: 0.4 * vol, attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.08, dest });
    osc('triangle', f * 2, t, dur * 0.5, { vol: 0.05 * vol, dest });
  } else if (inst === 'square') {
    osc('square', f, t, dur, { vol: 0.11 * vol, attack: 0.002, decay: 0.05, sustain: 0.7, release: 0.02, filter: { freq: 2500 }, dest });
  } else if (inst === 'dist') {
    osc('sawtooth', f, t, dur, { vol: 0.35 * vol, attack: 0.002, decay: 0.06, sustain: 0.4, release: 0.03, filter: { freq: 900 }, dest: getDist() });
  } else if (inst === 'synth') {
    osc('sawtooth', f, t, dur, { vol: 0.2 * vol, attack: 0.003, decay: 0.12, sustain: 0.3, release: 0.05, filter: { freq: 2200, to: 250, time: 0.14, q: 4 }, dest });
    osc('sine', f, t, dur, { vol: 0.22 * vol, dest });
  } else {
    osc('sawtooth', f, t, dur, { vol: 0.22 * vol, attack: 0.004, decay: 0.1, sustain: 0.5, release: 0.05, filter: { freq: 1400, to: 300, time: 0.15 }, dest });
    osc('sine', f, t, dur, { vol: 0.25 * vol, dest });
  }
}

function playBass(song, s, meter, chord, t, spb) {
  const root = chord[0] - 24, third = chord[1] - 24, fifth = chord[2] - 24, oct = root + 12;
  const play = (m, len, vol) => bassNote(song.bassInst, m, t, spb * len, vol);
  switch (song.bass) {
    case 'drone':
      if (s === 0) play(root, meter * 0.95, 0.9);
      else if (s === meter / 2) play(fifth, meter * 0.45, 0.5);
      break;
    case 'octave8':
      if (s % 2 === 0) play(s % 4 === 0 ? root : oct, 1.5);
      break;
    case 'offbeat':
      if (s % 4 === 2) play(root, 1.6);
      break;
    case 'reggae': {
      const p = { 0: [root, 3], 3: [root, 1.5], 6: [fifth, 2], 10: [oct, 1.5], 11: [fifth, 1], 14: [third, 2] }[s];
      if (p) play(p[0], p[1]);
      break;
    }
    case 'chug':
      if (s % 2 === 0) play(s % 8 === 6 ? fifth : root, s % 4 === 0 ? 1.4 : 0.8, s % 4 === 0 ? 1 : 0.7);
      break;
    case 'tuba':
      if (s === 0) play(root, 3);
      else if (meter === 16 && s === 8) play(fifth, 3);
      break;
    case 'jig':
      if (s % 3 === 0) play([root, fifth, root, fifth][s / 3], 2);
      break;
    default: {
      const p = { 0: 0, 3: 0, 6: 2, 8: 0, 11: 1, 14: 2 }[s];
      if (p !== undefined) play(p === 1 ? fifth : p === 2 ? oct : root, 1.6);
    }
  }
}

function playChords(song, s, meter, chord, t, spb) {
  const dest = musicBus;
  switch (song.chords) {
    case 'pad':
      if (s === 0) {
        for (const m of chord) {
          for (const det of [-8, 8]) osc('sawtooth', midiHz(m - 12), t, spb * (meter - 1), { vol: 0.03, detune: det, attack: 0.25, decay: 0.5, sustain: 0.8, release: 0.4, filter: { freq: 1100 }, dest });
        }
      }
      break;
    case 'strum': {
      // Down strokes on the beat, lighter up strokes in between.
      const hits = meter === 12 ? { 0: 1, 6: 0.7 } : { 0: 1, 6: 0.45, 8: 0.8, 14: 0.45 };
      const v = hits[s];
      if (v) {
        const notes = s % 8 === 0 || meter === 12 ? chord : [...chord].reverse();
        notes.forEach((m, i) => INST.pluck(midiHz(m - 12), t + i * 0.015, spb * 3, 0.05 * v));
      }
      break;
    }
    case 'stab':
      if (s === 4 || s === 12) {
        for (const m of chord) osc('square', midiHz(m), t, spb * 0.6, { vol: 0.03, attack: 0.003, decay: 0.06, sustain: 0.3, release: 0.04, filter: { freq: 1800 }, dest });
      }
      break;
    case 'waltz':
      if (s === 4 || s === 8) {
        for (const m of chord) osc('triangle', midiHz(m), t, spb * 1.5, { vol: 0.05, attack: 0.003, decay: 0.25, sustain: 0.2, release: 0.1, dest });
      }
      break;
    case 'gated':
      if (s % 2 === 0) {
        for (const m of chord) for (const det of [-12, 12]) osc('sawtooth', midiHz(m), t, spb * 0.8, { vol: 0.02, detune: det, attack: 0.004, decay: 0.1, sustain: 0.4, release: 0.04, filter: { freq: 2600 }, dest });
      }
      break;
    case 'power':
      if (s === 0 || s === 8) {
        for (const m of [chord[0] - 12, chord[0] - 5, chord[0]]) osc('sawtooth', midiHz(m), t, spb * 7, { vol: 0.12, attack: 0.005, decay: 0.3, sustain: 0.6, release: 0.1, filter: { freq: 1800 }, dest: getDist() });
      }
      break;
  }
}

function tickMusic(ahead = 0.15) {
  const song = music.song;
  if (!song) return;
  const meter = song.meter ?? 16, div = song.div ?? 4;
  const spb = 60 / (song.bpm * music.tempoMul) / div;
  while (music.next < now() + ahead) {
    const step = music.step;
    const s = step % meter;
    const bar = Math.floor(step / meter);
    const t = music.next + (s % 2 ? (song.swing ?? 0) * spb : 0);
    const chordDeg = song.prog[bar % song.prog.length];
    const chord = [0, 2, 4].map((k) => scaleNote(song, chordDeg + k));

    // Drums, with a cymbal every four bars.
    const pat = DRUMS[song.drums];
    const hit = pat[s % pat.length];
    if (hit) for (const d of hit.split('+')) playDrum(d, t);
    if (song.drums !== 'soft' && s === 0 && bar % 4 === 0) noise(t, 0.6, { vol: 0.08, type: 'highpass', freq: 5000, dest: musicBus });

    playBass(song, s, meter, chord, t, spb);
    playChords(song, s, meter, chord, t, spb);

    // Arpeggio
    const arp = song.arp;
    if (arp) {
      const every = arp.pat === 'eighths' ? 2 : 1;
      if (s % every === 0) {
        const notes = [...chord, chord[0] + 12];
        const idx = arp.pat === 'updown' ? [0, 1, 2, 3, 2, 1][step % 6] : step % 4;
        const m = notes[idx] + 12 * (arp.oct ?? 1);
        INST[arp.inst](midiHz(m), t, spb * 0.6, 0.05 * (arp.vol ?? 1));
      }
    }

    // Lead melody
    if (song.lead && music.lead) {
      const phrase = music.lead[Math.floor(bar / 2) % 4];
      const local = (bar % 2) * meter + s;
      for (const n of phrase) {
        if (n.step !== local) continue;
        const m = scaleNote(song, chordDeg + n.deg, 1 + n.oct);
        INST[song.lead.inst](midiHz(m), t, spb * n.len * 0.92, 0.07 * (song.lead.vol ?? 1));
      }
    }

    music.step++;
    music.next += spb;
  }
}

export function startMusic(name) {
  if (!ctx) return;
  if (name !== 'star') music.prev = null;
  if (music.name === name && music.timer) return;
  stopMusic();
  const song = SONGS[name];
  if (!song) return;
  music.name = name;
  music.song = song;
  music.lead = song.lead ? composeLead(song) : null;
  music.step = 0;
  music.tempoMul = music.finalLap && name !== 'star' ? 1.12 : 1;
  music.next = now() + 0.08;
  musicBus.gain.cancelScheduledValues(now());
  musicBus.gain.setValueAtTime(0.42, now());
  music.timer = setInterval(tickMusic, 25);
}

// Schedule the current song `seconds` ahead in one go (offline rendering in tests).
export function scheduleMusic(seconds) {
  tickMusic(seconds);
}

export function stopMusic() {
  if (music.timer) clearInterval(music.timer);
  music.timer = null;
  music.name = null;
  music.song = null;
}

export function fadeMusic(to, time = 0.5) {
  if (!ctx) return;
  musicBus.gain.setTargetAtTime(to, now(), time / 3);
}

export function setFinalLap(on) {
  music.finalLap = on;
  if (music.name !== 'star') music.tempoMul = on ? 1.12 : 1;
}

// Star power temporarily swaps the soundtrack for the star theme.
export function setStar(on) {
  if (!ctx) return;
  if (on && music.name !== 'star') {
    music.prev = music.name;
    startMusic('star');
  } else if (!on && music.name === 'star' && music.prev) {
    const prev = music.prev;
    music.prev = null;
    startMusic(prev);
  }
}
