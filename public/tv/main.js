import * as THREE from 'three';
import { DRIVERS, TRACK_NAMES, CC_OPTIONS, MAX_RACERS, POINTS, ordinal } from '../shared/config.js';
import { buildTrack, TRACKS } from './track.js';
import { Kart, collideKarts } from './kart.js';
import { Items } from './items.js';
import { driveBot, botSpeedMult } from './ai.js';
import { layout, drawViewportHud, drawMinimap, drawStandings, drawCountdown } from './hud.js';
import * as audio from './audio.js';

const CC = {
  50: { maxSpeed: 19, accel: 13, skill: 0.35, bot: 0.86 },
  100: { maxSpeed: 23, accel: 15, skill: 0.6, bot: 0.93 },
  150: { maxSpeed: 27, accel: 17, skill: 0.85, bot: 0.97 },
};
const STEP = 1 / 60;
const COUNTDOWN = 4;
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- state
const cfg = { track: 0, laps: 3, cc: 100, bots: 4 };
const players = new Map(); // pid -> {pid, name, driver, connected, input, points, kb}
let roomCode = null;
let phase = 'lobby'; // lobby | countdown | race | results
let race = null;
let lastResults = null;

// ---------------------------------------------------------------- renderer
const glCanvas = $('gl');
const hudCanvas = $('hud');
const hud = hudCanvas.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setScissorTest(true);
const scene = new THREE.Scene();
const hemi = new THREE.HemisphereLight(0xffffff, 0x446644, 1);
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(120, 200, 60);
scene.add(hemi, sun);
const lobbyCam = new THREE.PerspectiveCamera(50, 1, 1, 3000);

let W = 0, H = 0;
function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  renderer.setSize(W, H, false);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  hudCanvas.width = W * dpr;
  hudCanvas.height = H * dpr;
  hud.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- track
let track = null;
let trackIndex = -1;

function disposeTree(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      m.map?.dispose();
      m.dispose();
    }
  });
}

function loadTrack(i) {
  if (i === trackIndex) return;
  if (track) {
    scene.remove(track.group);
    disposeTree(track.group);
  }
  trackIndex = i;
  track = buildTrack(i);
  scene.add(track.group);
  const t = track.theme;
  scene.background = new THREE.Color(t.sky);
  scene.fog = new THREE.Fog(t.fog[0], t.fog[1], t.fog[2]);
  hemi.color.setHex(t.hemi[0]);
  hemi.groundColor.setHex(t.hemi[1]);
  hemi.intensity = t.hemi[2];
  sun.color.setHex(t.sun[0]);
  sun.intensity = t.sun[1];
}

// ---------------------------------------------------------------- networking
let ws = null;
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => {
    $('conn').classList.add('hidden');
    ws.send(JSON.stringify({ t: 'host', code: sessionStorage.getItem('gokart.room') || undefined }));
  };
  ws.onmessage = (e) => onServer(JSON.parse(e.data));
  ws.onclose = () => {
    $('conn').classList.remove('hidden');
    setTimeout(connect, 1500);
  };
}

function sendTo(pid, m) {
  if (pid === 'kb') return;
  if (ws?.readyState === 1) ws.send(JSON.stringify({ t: 'to', pid, m }));
}

function onServer(msg) {
  switch (msg.t) {
    case 'room':
      roomCode = msg.code;
      sessionStorage.setItem('gokart.room', roomCode);
      updateJoinInfo();
      break;
    case 'join': {
      let p = players.get(msg.pid);
      if (!p) {
        p = { pid: msg.pid, name: msg.name, driver: -1, connected: true, input: blankInput(), points: 0 };
        players.set(msg.pid, p);
      }
      p.name = msg.name;
      p.connected = true;
      if (p.driver < 0 || driverTaken(p.driver, p)) p.driver = freeDriver();
      toast(`${p.name} joined!`);
      audio.sfx('join');
      lobbyChanged();
      if (phase !== 'lobby') sendRaceState(p);
      if (phase === 'results' && lastResults) sendTo(p.pid, lastResults);
      break;
    }
    case 'leave': {
      const p = players.get(msg.pid);
      if (!p) break;
      p.connected = false;
      p.input = blankInput();
      toast(`${p.name} disconnected`);
      lobbyChanged();
      break;
    }
    case 'from':
      onPlayer(players.get(msg.pid), msg.m);
      break;
  }
}

function blankInput() {
  return { steer: 0, gas: false, brake: false, drift: false, itemCount: 0, lastItem: 0 };
}

function captainPid() {
  let best = null;
  for (const p of players.values()) if (p.connected && !p.kb && (best === null || p.pid < best)) best = p.pid;
  return best ?? (players.get('kb')?.connected ? 'kb' : null);
}

function onPlayer(p, m) {
  if (!p || !m) return;
  const isCaptain = p.pid === captainPid();
  switch (m.t) {
    case 'hello':
      if (typeof m.name === 'string' && m.name.trim()) p.name = m.name.trim().slice(0, 12);
      if (Number.isInteger(m.driver) && m.driver >= 0 && m.driver < DRIVERS.length && !driverTaken(m.driver, p)) p.driver = m.driver;
      lobbyChanged();
      if (phase !== 'lobby') sendRaceState(p);
      if (phase === 'results' && lastResults) sendTo(p.pid, lastResults);
      break;
    case 'pick':
      if (phase === 'lobby' && Number.isInteger(m.driver) && m.driver >= 0 && m.driver < DRIVERS.length && !driverTaken(m.driver, p)) {
        p.driver = m.driver;
        audio.sfx('menu');
        lobbyChanged();
      }
      break;
    case 'in': {
      const i = p.input;
      i.steer = Math.max(-1, Math.min(1, Number(m.s) || 0));
      i.gas = !!m.g;
      i.brake = !!m.b;
      i.drift = !!m.d;
      if (Number.isInteger(m.ic)) i.itemCount = m.ic;
      break;
    }
    case 'cfg':
      if (isCaptain && phase === 'lobby') changeCfg(m.k, m.d);
      break;
    case 'start':
      if (isCaptain && phase === 'lobby') startRace();
      break;
    case 'next':
      if (isCaptain && phase === 'results') toLobby();
      break;
    case 'quit':
      if (isCaptain && (phase === 'race' || phase === 'countdown')) toLobby();
      break;
  }
}

function driverTaken(d, except) {
  for (const p of players.values()) if (p !== except && p.connected && p.driver === d) return true;
  return false;
}
function freeDriver() {
  for (let d = 0; d < DRIVERS.length; d++) if (!driverTaken(d)) return d;
  return 0;
}

// ---------------------------------------------------------------- lobby UI
let focusRow = 4;
const ROWS = ['track', 'laps', 'cc', 'bots', 'start'];

function changeCfg(k, dir) {
  dir = Math.sign(dir) || 1;
  if (k === 'track') cfg.track = (cfg.track + dir + TRACKS.length) % TRACKS.length;
  if (k === 'laps') cfg.laps = Math.max(1, Math.min(7, cfg.laps + dir));
  if (k === 'cc') {
    const i = CC_OPTIONS.indexOf(cfg.cc);
    cfg.cc = CC_OPTIONS[Math.max(0, Math.min(CC_OPTIONS.length - 1, i + dir))];
  }
  if (k === 'bots') cfg.bots = Math.max(0, Math.min(MAX_RACERS - 1, cfg.bots + dir));
  audio.sfx('menu');
  loadTrack(cfg.track);
  lobbyChanged();
}

function connectedPlayers() {
  return [...players.values()].filter((p) => p.connected);
}

function lobbyChanged() {
  const list = $('playerList');
  const ps = connectedPlayers().sort((a, b) => (a.kb ? 1 : 0) - (b.kb ? 1 : 0) || a.pid - b.pid);
  const cap = captainPid();
  list.innerHTML = '';
  for (let i = 0; i < MAX_RACERS; i++) {
    const p = ps[i];
    const li = document.createElement('li');
    if (p) {
      const d = DRIVERS[p.driver];
      li.innerHTML = `<span class="dot"></span><span class="nm"></span>${p.pid === cap ? '<span class="tag">👑</span>' : ''}`;
      li.querySelector('.dot').style.background = d.color;
      li.querySelector('.nm').textContent = `${p.name}${p.points ? ` · ${p.points} pts` : ''}`;
    } else {
      li.className = 'empty';
      li.innerHTML = `<span class="dot" style="border-style:dashed;background:transparent"></span><span class="nm">${i < ps.length + Math.min(cfg.bots, MAX_RACERS - ps.length) ? 'CPU' : 'Open'}</span>`;
    }
    list.appendChild(li);
  }
  $('playerCount').textContent = `${ps.length}/${MAX_RACERS}`;
  $('vTrack').textContent = TRACK_NAMES[cfg.track];
  $('vLaps').textContent = cfg.laps;
  $('vCc').textContent = `${cfg.cc}cc`;
  $('vBots').textContent = cfg.bots;
  $('startBtn').disabled = ps.length === 0;
  document.querySelectorAll('#settings .row').forEach((r, i) => r.classList.toggle('focus', i === focusRow));

  const msg = {
    t: 'lobby',
    phase,
    captain: cap,
    cfg,
    tracks: TRACK_NAMES,
    players: ps.map((p) => ({ pid: p.pid, name: p.name, driver: p.driver, points: p.points })),
  };
  sendTo('*', msg);
}

async function updateJoinInfo() {
  let host = location.hostname;
  let port = location.port || (location.protocol === 'https:' ? '443' : '80');
  if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    try {
      const info = await (await fetch('/api/info')).json();
      if (info.addresses?.[0]) host = info.addresses[0].address;
      port = String(info.port);
    } catch {}
  }
  const base = `${location.protocol}//${host}${port === '80' || port === '443' ? '' : ':' + port}`;
  const url = `${base}/play?room=${roomCode}`;
  $('qr').src = `/api/qr?u=${encodeURIComponent(url)}`;
  $('joinUrl').textContent = `${base.replace(/^https?:\/\//, '')}/play`;
  $('roomCode').textContent = roomCode;
}

document.querySelectorAll('#settings .row').forEach((row, i) => {
  row.querySelector('.dec')?.addEventListener('click', () => changeCfg(row.dataset.k, -1));
  row.querySelector('.inc')?.addEventListener('click', () => changeCfg(row.dataset.k, 1));
  row.addEventListener('mouseenter', () => {
    focusRow = i;
    lobbyChanged();
  });
});
$('startBtn').addEventListener('click', () => startRace());

let toastTimer = null;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------------------------------------------------------------- keyboard / TV remote
const keys = new Set();
function enableSound() {
  audio.initAudio();
  if (audio.audioReady()) $('soundHint').classList.add('hidden');
  else setTimeout(() => audio.audioReady() && $('soundHint').classList.add('hidden'), 200);
}
window.addEventListener('pointerdown', enableSound);
window.addEventListener('keydown', (e) => {
  enableSound();
  keys.add(e.code);
  const kb = players.get('kb');
  if (phase === 'lobby') {
    if (e.code === 'ArrowUp') focusRow = (focusRow + ROWS.length - 1) % ROWS.length;
    else if (e.code === 'ArrowDown') focusRow = (focusRow + 1) % ROWS.length;
    else if (e.code === 'ArrowLeft' && focusRow < 4) changeCfg(ROWS[focusRow], -1);
    else if (e.code === 'ArrowRight' && focusRow < 4) changeCfg(ROWS[focusRow], 1);
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      if (focusRow === 4) startRace();
      else changeCfg(ROWS[focusRow], 1);
    } else if (e.code === 'KeyK') {
      if (kb?.connected) kb.connected = false;
      else {
        const p = kb || { pid: 'kb', kb: true, name: 'Keyboard', driver: -1, input: blankInput(), points: 0 };
        p.connected = true;
        p.driver = freeDriver();
        players.set('kb', p);
        audio.sfx('join');
      }
    } else return;
    e.preventDefault();
    lobbyChanged();
  } else if (phase === 'results') {
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') toLobby();
  } else if (e.code === 'Escape' || e.code === 'Backspace') {
    toLobby();
  } else if (kb && (e.code === 'KeyX' || e.code === 'KeyL')) {
    kb.input.itemCount++;
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

function readKeyboard() {
  const kb = players.get('kb');
  if (!kb?.connected) return;
  const i = kb.input;
  const left = keys.has('ArrowLeft') || keys.has('KeyA');
  const right = keys.has('ArrowRight') || keys.has('KeyD');
  i.steer = (right ? 1 : 0) - (left ? 1 : 0);
  i.gas = keys.has('ArrowUp') || keys.has('KeyW');
  i.brake = keys.has('ArrowDown') || keys.has('KeyS');
  i.drift = keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight');
}

// ---------------------------------------------------------------- race
function startRace() {
  const humans = connectedPlayers();
  if (!humans.length) return;
  audio.initAudio();
  loadTrack(cfg.track);
  if (race) race.items.dispose();
  for (const k of race?.karts || []) scene.remove(k.model.root);

  const used = new Set(humans.map((p) => p.driver));
  const botDrivers = DRIVERS.map((_, i) => i).filter((i) => !used.has(i));
  const nBots = Math.min(cfg.bots, MAX_RACERS - humans.length, botDrivers.length);
  const karts = [];
  for (let b = 0; b < nBots; b++) {
    const d = DRIVERS[botDrivers[b]];
    karts.push(new Kart({ id: `cpu${b}`, driver: d, name: d.name, human: false }));
  }
  for (const p of humans) {
    const k = new Kart({ id: p.pid, driver: DRIVERS[p.driver], name: p.name, human: true });
    k.player = p;
    p.kart = k;
    p.input.lastItem = p.input.itemCount;
    karts.push(k);
  }
  karts.forEach((k, i) => {
    k.reset(track.grid[i]);
    scene.add(k.model.root);
  });
  const humanKarts = karts.filter((k) => k.human);
  const cams = humanKarts.map(() => new THREE.PerspectiveCamera(62, 1, 0.5, 1500));
  race = {
    karts,
    humanKarts,
    cams,
    track,
    items: new Items(scene, track, playSfx),
    order: [...karts],
    laps: cfg.laps,
    cc: CC[cfg.cc],
    skill: CC[cfg.cc].skill,
    phase: 'countdown',
    countdown: COUNTDOWN,
    clock: 0,
    flash: new Map(),
    endTimer: -1,
    firstHumanFinish: -1,
    lastCount: 99,
    statusTimer: 0,
    time: 0,
  };
  for (const [k, cam] of humanKarts.map((k, i) => [k, cams[i]])) snapCamera(cam, k);
  phase = 'countdown';
  race.phase = phase;
  $('lobby').classList.add('hidden');
  $('results').classList.add('hidden');
  lastResults = null;
  audio.startMusic(cfg.track);
  lobbyChanged();
  for (const p of humans) sendRaceState(p);
}

function toLobby() {
  if (race) {
    race.items.dispose();
    for (const k of race.karts) scene.remove(k.model.root);
  }
  for (const p of players.values()) p.kart = null;
  if (phase === 'results') {
    // Rotate to the next track like a cup.
    cfg.track = (cfg.track + 1) % TRACKS.length;
    loadTrack(cfg.track);
  }
  race = null;
  phase = 'lobby';
  lastResults = null;
  audio.stopMusic();
  audio.setEngine(0, false);
  $('results').classList.add('hidden');
  $('lobby').classList.remove('hidden');
  lobbyChanged();
}

function playSfx(name) {
  audio.sfx(name);
}

function flash(k, text, color = '#fff', dur = 1.6) {
  race.flash.set(k, { text, color, until: race.time + dur });
}

function stepRace(dt) {
  const r = race;
  r.time += dt;
  readKeyboard();

  if (r.phase === 'countdown') {
    r.countdown -= dt;
    const c = Math.ceil(r.countdown - 1);
    if (c !== r.lastCount && c >= 0) {
      r.lastCount = c;
      if (c > 0) audio.sfx('count');
    }
    // Rocket start: press the gas late in "1" (holding it from earlier doesn't count).
    for (const k of r.humanKarts) {
      const gas = k.player.input.gas;
      if (gas && !k.gasPrev && k.rocket === 0) k.rocket = r.countdown > 1.0 && r.countdown < 1.7 ? 1 : -1;
      k.gasPrev = gas;
    }
    if (r.countdown <= 1) {
      r.phase = phase = 'race';
      audio.sfx('go');
      for (const k of r.humanKarts) {
        if (k.rocket === 1 && k.player.input.gas) {
          k.giveBoost(1.1);
          flash(k, 'ROCKET START!', '#ffe14d', 1.2);
        }
      }
    }
    for (const k of r.karts) k.updateModel(dt, r.time);
    return;
  }

  if (r.phase === 'race') r.clock += dt;
  const leaderHuman = r.order.find((k) => k.human);

  for (const k of r.karts) {
    const p = k.player;
    const auto = !k.human || !p?.connected || k.finished || r.phase === 'results';
    if (auto) {
      driveBot(k, dt, r);
    } else {
      const i = p.input;
      k.input.steer = i.steer;
      k.input.gas = i.gas;
      k.input.brake = i.brake;
      k.input.drift = i.drift;
      k.input.item = i.itemCount !== i.lastItem;
      i.lastItem = i.itemCount;
    }
    if (k.input.item) r.items.use(k, r.order, r.karts);
    const mult = k.human && !auto ? 1 : k.human ? r.cc.bot : botSpeedMult(k, leaderHuman, r.cc.bot);
    k.step(dt, r.track, r.cc, mult);

    // Boost pads.
    k.padCd = Math.max(0, (k.padCd || 0) - dt);
    for (const pad of r.track.padSpots) {
      let di = k.idx - pad.idx;
      if (di > r.track.cl.n / 2) di -= r.track.cl.n;
      if (di < -r.track.cl.n / 2) di += r.track.cl.n;
      if (k.padCd <= 0 && Math.abs(di) <= 2 && Math.abs(k.lateral - pad.lat) < 2.3) {
        k.giveBoost(0.9);
        k.padCd = 1;
      }
    }

    // Laps.
    k.maxLap = Math.max(k.maxLap || 0, k.lap);
    if (k.lap > (k.shownLap || 0)) {
      k.shownLap = k.lap;
      if (k.lap > r.laps && !k.finished) {
        k.finished = true;
        k.finishTime = r.clock;
        k.emit('finish');
        if (k.human && r.firstHumanFinish < 0) r.firstHumanFinish = r.clock;
      } else if (k.lap > 1 && k.human) {
        if (k.lap === r.laps) {
          flash(k, 'FINAL LAP!', '#ff5a5a');
          audio.sfx('final');
        } else {
          flash(k, `LAP ${k.lap}`, '#fff');
          audio.sfx('lap');
        }
      }
    }
  }
  collideKarts(r.karts);
  r.items.update(dt, r.karts, r.order, r.time);

  // Race order.
  r.order.sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished) return a.finishTime - b.finishTime;
    return b.progress - a.progress;
  });
  r.order.forEach((k, i) => (k.place = i + 1));

  // Events -> sound + phone vibration.
  for (const k of r.karts) {
    for (const ev of k.events) {
      if (k.human) {
        if (['box', 'gotitem', 'boost', 'bonk', 'bump'].includes(ev)) audio.sfx(ev);
        if (ev === 'finish') audio.sfx('finish');
        if (k.player) sendTo(k.player.pid, { t: 'fx', k: ev });
      }
      if (ev === 'hit' && !k.human) audio.sfx('bump');
    }
    k.events.length = 0;
    k.updateModel(dt, r.time);
  }

  // End of race.
  if (r.phase === 'race') {
    // Disconnected players' karts drive on autopilot, so a Wi-Fi blip doesn't end the race.
    const humansLeft = r.humanKarts.some((k) => !k.finished);
    if (!humansLeft && r.endTimer < 0) r.endTimer = 3.5;
    if (r.firstHumanFinish >= 0 && r.clock - r.firstHumanFinish > 30 && r.endTimer < 0) r.endTimer = 0.01;
    if (r.endTimer > 0) {
      r.endTimer -= dt;
      if (r.endTimer <= 0) showResults();
    }
  }

  // Engine sound follows the human karts.
  const lvl = r.humanKarts.length
    ? r.humanKarts.reduce((s, k) => s + Math.min(1, Math.abs(k.speed) / r.cc.maxSpeed), 0) / r.humanKarts.length
    : 0;
  audio.setEngine(lvl, r.phase === 'race');

  r.statusTimer -= dt;
  if (r.statusTimer <= 0) {
    r.statusTimer = 0.15;
    for (const k of r.humanKarts) if (k.player?.connected) sendRaceState(k.player);
  }
}

function sendRaceState(p) {
  if (!race || !p.kart) {
    sendTo(p.pid, { t: 'st', phase: phase === 'lobby' ? 'lobby' : 'watch' });
    return;
  }
  const k = p.kart;
  sendTo(p.pid, {
    t: 'st',
    phase: race.phase,
    cd: race.phase === 'countdown' ? Math.max(0, Math.ceil(race.countdown - 1)) : 0,
    place: k.place,
    n: race.karts.length,
    lap: Math.max(1, Math.min(race.laps, k.lap)),
    laps: race.laps,
    item: k.roulette > 0 ? 'roulette' : k.item,
    ic: k.itemCount,
    fin: k.finished,
    captain: p.pid === captainPid(),
  });
}

function showResults() {
  const r = race;
  r.phase = phase = 'results';
  audio.setEngine(0, false);
  // Unfinished racers keep their current order.
  const rows = r.order.map((k, i) => {
    const pts = POINTS[i] || 0;
    if (k.player) k.player.points += pts;
    return {
      pid: k.player?.pid ?? null,
      place: i + 1,
      name: k.name,
      color: k.driver.color,
      human: k.human,
      time: k.finished ? k.finishTime : null,
      pts,
      total: k.player ? k.player.points : null,
    };
  });
  const body = $('resultsBody');
  body.innerHTML = '';
  for (const row of rows) {
    const tr = document.createElement('tr');
    if (!row.human) tr.className = 'cpu';
    const t = row.time == null ? '—' : `${Math.floor(row.time / 60)}:${(row.time % 60).toFixed(2).padStart(5, '0')}`;
    tr.innerHTML = `<td>${ordinal(row.place)}</td><td><span class="sw"></span><span class="nm"></span></td><td>${t}</td><td>+${row.pts}</td><td>${row.total ?? ''}</td>`;
    tr.querySelector('.sw').style.background = row.color;
    tr.querySelector('.nm').textContent = row.name + (row.human ? '' : ' (CPU)');
    body.appendChild(tr);
  }
  $('resultsTitle').textContent = `${TRACK_NAMES[cfg.track]} — Results`;
  $('results').classList.remove('hidden');
  lastResults = { t: 'results', rows, captain: captainPid() };
  sendTo('*', lastResults);
  audio.sfx('finish');
}

// ---------------------------------------------------------------- cameras + render
const tmpV = new THREE.Vector3();
function snapCamera(cam, k) {
  cam.position.set(k.x - k.forwardX * 7.5, 3.4, k.z - k.forwardZ * 7.5);
  cam.lookAt(k.x + k.forwardX * 4, 1.2, k.z + k.forwardZ * 4);
}

function updateCamera(cam, k, dt) {
  const back = 7.5, up = 3.4;
  tmpV.set(k.x - k.forwardX * back, up, k.z - k.forwardZ * back);
  cam.position.lerp(tmpV, 1 - Math.exp(-dt * 7));
  cam.lookAt(k.x + k.forwardX * 4, 1.2, k.z + k.forwardZ * 4);
  const fov = 62 + (k.boost > 0 ? 10 : 0);
  cam.fov += (fov - cam.fov) * Math.min(1, dt * 4);
  cam.updateProjectionMatrix();
}

function renderView(cam, r) {
  // three.js viewport origin is bottom-left.
  renderer.setViewport(r.x, H - r.y - r.h, r.w, r.h);
  renderer.setScissor(r.x, H - r.y - r.h, r.w, r.h);
  cam.aspect = r.w / r.h;
  cam.updateProjectionMatrix();
  renderer.render(scene, cam);
}

let lobbyAngle = 0;
function renderLobby(dt) {
  if (!track) return;
  lobbyAngle += dt * 0.06;
  const cl = track.cl;
  let cx = 0, cz = 0;
  for (let i = 0; i < cl.n; i++) ((cx += cl.px[i]), (cz += cl.pz[i]));
  cx /= cl.n; cz /= cl.n;
  lobbyCam.position.set(cx + Math.cos(lobbyAngle) * 300, 150, cz + Math.sin(lobbyAngle) * 300);
  lobbyCam.lookAt(cx, 0, cz);
  renderView(lobbyCam, { x: 0, y: 0, w: W, h: H });
}

const overviewCam = new THREE.PerspectiveCamera(62, 1, 0.5, 1500);
function render(dt) {
  hud.clearRect(0, 0, W, H);
  if (!race) {
    renderLobby(dt);
    return;
  }
  const r = race;
  const views = r.humanKarts;
  if (r.phase === 'results' || views.length === 0) {
    const lead = r.order[0];
    updateCamera(overviewCam, lead, dt);
    renderView(overviewCam, { x: 0, y: 0, w: W, h: H });
    return;
  }
  const rects = layout(views.length, W, H);
  views.forEach((k, i) => {
    updateCamera(r.cams[i], k, dt);
    k.model.tag.visible = false;
    renderView(r.cams[i], rects[i]);
    k.model.tag.visible = true;
  });
  views.forEach((k, i) => drawViewportHud(hud, rects[i], k, r, r.time));

  // Spare cell (3, 5, 7 players) shows the map + standings; otherwise a corner minimap.
  if (rects.length > views.length) {
    const spare = rects[views.length];
    renderer.setScissor(spare.x, H - spare.y - spare.h, spare.w, spare.h);
    renderer.setClearColor(0x10132e);
    renderer.clear();
    drawMinimap(hud, { x: spare.x, y: spare.y, w: spare.w * 0.6, h: spare.h }, r.track, r.karts);
    drawStandings(hud, { x: spare.x + spare.w * 0.6, y: spare.y, w: spare.w * 0.4, h: spare.h }, r.order);
  } else {
    const m = views.length === 1 ? Math.min(W, H) * 0.32 : Math.min(W, H) * 0.24;
    const mx = views.length === 1 ? 16 : W / 2 - m / 2;
    const my = views.length === 1 ? H - m - 16 : H / 2 - m / 2;
    hud.fillStyle = 'rgba(0,0,0,0.25)';
    hud.beginPath();
    hud.roundRect(mx, my, m, m, 16);
    hud.fill();
    drawMinimap(hud, { x: mx, y: my, w: m, h: m }, r.track, r.karts);
  }
  if (r.phase === 'countdown') drawCountdown(hud, W, H, Math.ceil(r.countdown - 1));
  else if (r.clock < 1) drawCountdown(hud, W, H, 0);
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (race) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) {
      stepRace(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 6) acc = 0;
  }
  render(dt);
  requestAnimationFrame(frame);
}

loadTrack(cfg.track);
lobbyChanged();
connect();
requestAnimationFrame(frame);

// Debug / test hook.
window.gokart = {
  get race() { return race; },
  get phase() { return phase; },
  players,
  cfg,
  startRace,
  toLobby,
  // Fast-forward the simulation (used by the end-to-end smoke test).
  simulate(seconds) {
    for (let t = 0; t < seconds && race; t += STEP) stepRace(STEP);
  },
};
