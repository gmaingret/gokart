import * as THREE from 'three';
import { DRIVERS, TRACK_NAMES, CC_OPTIONS, MAX_RACERS, POINTS, ordinal } from '../shared/config.js';
import { buildTrack, TRACKS } from './track.js';
import { buildArena } from './arena.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Kart, collideKarts, DRIFT_TIERS, setLowQuality } from './kart.js';
import { FX } from './fx.js';
import { Sky } from './sky.js';
import { Post } from './post.js';
import { Skids } from './skids.js';
import { wind } from './wind.js';
import { Items } from './items.js';
import { Hazards } from './hazards.js';
import { driveBot, botSpeedMult, driveBattle } from './ai.js';
import { layout, drawViewportHud, drawMinimap, drawStandings, drawCountdown } from './hud.js';
import * as audio from './audio.js';
import { createNetStat } from '../shared/netstat.js';
import { switchGame } from '../shared/games.js';

const CC = {
  50: { maxSpeed: 19, accel: 13, skill: 0.35, bot: 0.86 },
  100: { maxSpeed: 23, accel: 15, skill: 0.6, bot: 0.93 },
  150: { maxSpeed: 27, accel: 17, skill: 0.85, bot: 0.97 },
};
const STEP = 1 / 60;
const COUNTDOWN = 4;
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- state
const cfg = { mode: 'race', track: 0, laps: 3, cc: 100, bots: 4, gfx: loadGfx() };
const BATTLE_TIME = 180; // seconds
const BALLOONS = 3;

function loadGfx() {
  try {
    return localStorage.getItem('gokart.gfx') === 'low' ? 'low' : 'high';
  } catch {
    return 'high';
  }
}
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
renderer.setScissorTest(true);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
// Soft studio reflections for the shiny kart paint.
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envMap;
scene.environmentIntensity = 0.7;
const hemi = new THREE.HemisphereLight(0xffffff, 0x446644, 1);
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(120, 200, 60);
// Real-time shadows in a box that follows whichever camera is rendering.
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 420 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.04;
renderer.shadowMap.type = THREE.PCFShadowMap;
scene.add(hemi, sun, sun.target);
const sunDir = new THREE.Vector3(0.5, 0.45, 0.3).normalize();
const sky = new Sky(scene);
const fx = new FX(scene);
const post = new Post(renderer);
const skids = new Skids(scene);
const high = () => cfg.gfx !== 'low';
const lobbyCam = new THREE.PerspectiveCamera(55, 1, 0.5, 1500);

function applyGfx() {
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(cfg.gfx === 'low' ? Math.min(dpr, 1) * 0.75 : Math.min(dpr, 1.5));
  fx.density = cfg.gfx === 'low' ? 0.35 : 1;
  // Low: no reflections, shadows, bloom or tyre marks, and plain kart materials (from the next race).
  scene.environment = cfg.gfx === 'low' ? null : envMap;
  setLowQuality(cfg.gfx === 'low');
  const shadows = high();
  if (renderer.shadowMap.enabled !== shadows) {
    renderer.shadowMap.enabled = shadows;
    sun.castShadow = shadows;
    scene.traverse((o) => {
      if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true;
    });
  }
  post.setSize(W || 1, H || 1, renderer.getPixelRatio());
  if (W) renderer.setSize(W, H, false);
}

let W = 0, H = 0;
function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  renderer.setSize(W, H, false);
  post.setSize(W, H, renderer.getPixelRatio());
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  hudCanvas.width = W * dpr;
  hudCanvas.height = H * dpr;
  hud.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();
applyGfx();

// ---------------------------------------------------------------- track
let track = null;
let trackIndex = -1;
let venueKey = '';
let lobbyS = 0;

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

// Loads the circuit, or in battle mode the arena themed like that circuit.
function loadTrack(i) {
  const key = `${cfg.mode}:${i}`;
  if (key === venueKey) return;
  if (track) {
    scene.remove(track.group);
    disposeTree(track.group);
  }
  venueKey = key;
  trackIndex = i;
  track = cfg.mode === 'battle' ? buildArena(i) : buildTrack(i);
  scene.add(track.group);
  const t = track.theme;
  sky.setTheme(t.sky, track.center);
  scene.background = new THREE.Color(t.fog[0]);
  scene.fog = new THREE.Fog(t.fog[0], t.fog[1], t.fog[2]);
  const sd = t.sky.sunDir ?? [0.5, 0.45, 0.3];
  sunDir.set(sd[0], Math.max(0.25, sd[1]), sd[2]).normalize();
  post.setTheme(t);
  skids.clear();
  fx.clear();
  lobbyS = 0;
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

const net = createNetStat((pid, m) => sendTo(pid, m), () => players.values());
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
      if (phase === 'results' && lastResults) sendTo(p.pid, { ...lastResults, captain: captainPid() });
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
    case 'lat':
      net.server(msg, players);
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
    case 'ka':
      net.pong(p, m);
      break;
    case 'hello':
      if (typeof m.name === 'string' && m.name.trim()) p.name = m.name.trim().slice(0, 12);
      if (Number.isInteger(m.driver) && m.driver >= 0 && m.driver < DRIVERS.length && !driverTaken(m.driver, p)) p.driver = m.driver;
      lobbyChanged();
      if (phase !== 'lobby') sendRaceState(p);
      if (phase === 'results' && lastResults) sendTo(p.pid, { ...lastResults, captain: captainPid() });
      break;
    case 'pick':
      if (phase === 'lobby' && Number.isInteger(m.driver) && m.driver >= 0 && m.driver < DRIVERS.length && !driverTaken(m.driver, p)) {
        p.driver = m.driver;
        audio.sfx('menu');
        lobbyChanged();
      }
      break;
    case 'in': {
      net.input(p, m.tp);
      const i = p.input;
      i.steer = Math.max(-1, Math.min(1, Number(m.s) || 0));
      i.gas = !!m.g;
      i.brake = !!m.b;
      i.drift = !!m.d;
      if (Number.isInteger(m.ic)) i.itemCount = m.ic;
      break;
    }
    case 'cfg':
      if (isCaptain && phase === 'lobby' && ['mode', 'track', 'laps', 'cc', 'bots'].includes(m.k)) changeCfg(m.k, m.d);
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
const ROWS = ['game', 'mode', 'track', 'laps', 'cc', 'bots', 'gfx', 'start'];
const START_ROW = ROWS.indexOf('start');
let focusRow = START_ROW;

function changeCfg(k, dir) {
  dir = Math.sign(dir) || 1;
  if (k === 'game') return switchGame('kart', dir, (m) => sendTo('*', m), 'gokart.room');
  if (k === 'mode') cfg.mode = cfg.mode === 'race' ? 'battle' : 'race';
  if (k === 'track') cfg.track = (cfg.track + dir + TRACKS.length) % TRACKS.length;
  if (k === 'laps') cfg.laps = Math.max(1, Math.min(7, cfg.laps + dir));
  if (k === 'cc') {
    const i = CC_OPTIONS.indexOf(cfg.cc);
    cfg.cc = CC_OPTIONS[Math.max(0, Math.min(CC_OPTIONS.length - 1, i + dir))];
  }
  if (k === 'bots') cfg.bots = Math.max(0, Math.min(MAX_RACERS - 1, cfg.bots + dir));
  if (k === 'gfx') {
    cfg.gfx = cfg.gfx === 'high' ? 'low' : 'high';
    try {
      localStorage.setItem('gokart.gfx', cfg.gfx);
    } catch {}
    applyGfx();
  }
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
  const battle = cfg.mode === 'battle';
  $('vMode').textContent = battle ? '🎈 Balloon Battle' : '🏁 Race';
  $('vTrack').textContent = TRACK_NAMES[cfg.track] + (battle ? ' Arena' : '');
  $('vLaps').textContent = battle ? `${BATTLE_TIME / 60} min` : cfg.laps;
  document.querySelector('#settings [data-k="laps"] span').textContent = battle ? 'Time' : 'Laps';
  $('vCc').textContent = `${cfg.cc}cc`;
  $('vBots').textContent = cfg.bots;
  $('vGfx').textContent = cfg.gfx === 'high' ? 'High' : 'Low (faster)';
  $('startBtn').disabled = ps.length === 0;
  $('startBtn').textContent = battle ? 'Start battle' : 'Start race';
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
  let base = null;
  try {
    const info = await (await fetch('/api/info')).json();
    if (info.publicUrl) base = info.publicUrl;
    else if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
      if (info.addresses?.[0]) host = info.addresses[0].address;
      port = String(info.port);
    }
  } catch {}
  base ??= `${location.protocol}//${host}${port === '80' || port === '443' ? '' : ':' + port}`;
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
  if (phase === 'lobby') audio.startMusic('lobby');
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
    else if (e.code === 'ArrowLeft' && focusRow < START_ROW) changeCfg(ROWS[focusRow], -1);
    else if (e.code === 'ArrowRight' && focusRow < START_ROW) changeCfg(ROWS[focusRow], 1);
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      if (focusRow === START_ROW) startRace();
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
  if (race) {
    race.items.dispose();
    race.hazards?.dispose();
  }
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
  const battle = cfg.mode === 'battle';
  karts.forEach((k, i) => {
    k.reset(track.grid[i]);
    if (battle) {
      k.balloons = BALLOONS;
      k.setBalloons(BALLOONS);
    }
    scene.add(k.model.root);
  });
  const humanKarts = karts.filter((k) => k.human);
  const cams = humanKarts.map(() => new THREE.PerspectiveCamera(62, 1, 0.5, 1500));
  race = {
    karts,
    humanKarts,
    cams,
    track,
    items: new Items(scene, track, playSfx, fx),
    mode: cfg.mode,
    outCount: 0,
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
    finalLap: false,
    star: false,
    homingT: 0,
  };
  if (!battle && track.def.hazards) {
    race.hazards = new Hazards(scene, track, fx, playSfx);
    race.items.hazards = race.hazards;
  }
  fx.clear();
  skids.clear();
  track.setStartLights(0);
  for (const [k, cam] of humanKarts.map((k, i) => [k, cams[i]])) snapCamera(cam, k);
  phase = 'countdown';
  race.phase = phase;
  $('lobby').classList.add('hidden');
  $('results').classList.add('hidden');
  lastResults = null;
  audio.stopMusic();
  audio.setFinalLap(false);
  audio.sfx('cheer', 0.6);
  lobbyChanged();
  for (const p of humans) sendRaceState(p);
}

function toLobby() {
  if (race) {
    race.items.dispose();
    race.hazards?.dispose();
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
  audio.stopEngines();
  audio.setFinalLap(false);
  audio.startMusic('lobby');
  fx.clear();
  track.setStartLights(0);
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
      if (c > 0 && c <= 3) {
        audio.sfx('count');
        r.track.setStartLights(4 - c);
      }
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
      audio.startMusic(trackIndex);
      r.track.setStartLights(4);
      for (const k of r.humanKarts) {
        if (k.rocket === 1 && k.player.input.gas) {
          k.giveBoost(1.1);
          flash(k, 'ROCKET START!', '#ffe14d', 1.2);
        }
      }
    }
    for (const k of r.karts) k.updateModel(dt, r.time);
    updateEngines(r);
    return;
  }

  if (r.phase === 'race') r.clock += dt;
  const leaderHuman = r.order.find((k) => k.human);

  for (const k of r.karts) {
    const p = k.player;
    const auto = !k.human || !p?.connected || k.finished || r.phase === 'results';
    if (auto) {
      (r.mode === 'battle' ? driveBattle : driveBot)(k, dt, r);
    } else {
      const i = p.input;
      k.input.steer = i.steer;
      k.input.gas = i.gas;
      k.input.brake = i.brake;
      k.input.drift = i.drift;
      k.input.item = i.itemCount !== i.lastItem;
      i.lastItem = i.itemCount;
    }
    if (k.input.item && !k.ghost) r.items.use(k, r.order, r.karts);
    const mult = k.human && !auto ? 1 : k.human || r.mode === 'battle' ? r.cc.bot : botSpeedMult(k, leaderHuman, r.cc.bot);
    k.step(dt, r.track, r.cc, mult);

    // Boost pads.
    k.padCd = Math.max(0, (k.padCd || 0) - dt);
    for (const pad of r.track.padSpots) {
      let di = k.idx - pad.idx;
      if (di > r.track.cl.n / 2) di -= r.track.cl.n;
      if (di < -r.track.cl.n / 2) di += r.track.cl.n;
      if (k.padCd <= 0 && !k.air && Math.abs(di) <= 2 && Math.abs(k.lateral - pad.lat) < 2.3) {
        k.giveBoost(0.9);
        k.padCd = 1;
        if (k.human) audio.sfx('pad');
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
          if (!r.finalLap) {
            r.finalLap = true;
            audio.setFinalLap(true);
          }
        } else {
          flash(k, `LAP ${k.lap}`, '#fff');
          audio.sfx('lap');
        }
      }
    }
  }
  const alive = r.mode === 'battle' ? r.karts.filter((k) => !k.ghost) : r.karts;
  if (r.mode === 'battle') ramSteals(alive);
  collideKarts(alive);
  r.items.update(dt, alive, r.order, r.time);
  r.hazards?.update(dt, alive, r.time);

  // Order: race by progress; battle by survival, then balloons.
  r.order.sort((a, b) => {
    if (r.mode === 'battle') {
      if (!!a.ghost !== !!b.ghost) return a.ghost ? 1 : -1;
      if (a.ghost) return b.outAt - a.outAt;
      return b.balloons - a.balloons;
    }
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished) return a.finishTime - b.finishTime;
    return b.progress - a.progress;
  });
  if (r.mode === 'battle') {
    // Ties share a place: rank = 1 + rivals still in with more balloons.
    r.order.forEach((k, i) => {
      k.place = k.ghost ? i + 1 : 1 + alive.filter((o) => o.balloons > k.balloons).length;
    });
  } else {
    r.order.forEach((k, i) => (k.place = i + 1));
  }

  // Events -> sound + phone vibration.
  for (const k of r.karts) {
    for (const ev of k.events) {
      if (k.human) {
        if (['box', 'gotitem', 'boost', 'bonk', 'bump'].includes(ev)) audio.sfx(ev);
        if (ev === 'finish') {
          audio.sfx('finish');
          fx.confetti(k.x, k.y, k.z, 90);
          r.cheer = 3;
        }
        if (ev === 'hit' || ev === 'bonk' || ev === 'zap') k.shake = ev === 'bonk' ? 0.25 : 0.6;
        if (k.player) sendTo(k.player.pid, { t: 'fx', k: ev });
      }
      if (ev === 'hit' && r.mode === 'battle') popBalloon(k);
      if (ev === 'hit') {
        fx.burst(k.x, k.y + 1.5, k.z, [0xffe14d, 0xffffff], 14, 6, 1);
        if (!k.human) audio.sfx('bump');
      }
      if (ev === 'box') fx.burst(k.x, k.y + 1.4, k.z, [0xff5ec4, 0xffd84d, 0x4dd2ff, 0x7dff6e], 22, 10, 2);
      if (ev === 'boost') for (let i = 0; i < 8; i++) fx.flame(k.x - k.forwardX * 2, k.y + 0.8, k.z - k.forwardZ * 2, -k.forwardX * 6, -k.forwardZ * 6, true);
      if (ev === 'land') {
        for (let i = 0; i < 6; i++) fx.dust(k.x, k.y + 0.2, k.z, race.track.theme.dust ?? 0x999999, k.vx, k.vz);
        if (k.human) audio.sfx('bump');
      }
      if (ev === 'trickstart' && k.human) audio.sfx('tier', 1);
      if (ev === 'trick') {
        fx.burst(k.x, k.y + 1.5, k.z, [0xffe14d, 0x7fd3ff, 0xffffff], 16, 7, 1);
        if (k.human) flash(k, 'TRICK!', '#7fd3ff', 1);
      }
    }
    k.events.length = 0;
    // Mini-turbo tier-up chirp.
    const tier = k.drifting ? k.driftTier() : -1;
    if (k.human && tier > (k.lastTier ?? -1)) audio.sfx('tier', tier);
    k.lastTier = tier;
    k.updateModel(dt, r.time);
    emitKartFx(k, dt);
  }
  r.cheer = Math.max(0, (r.cheer || 0) - dt);

  // Roulette ticks and red-shell warning beeps for human players.
  for (const k of r.humanKarts) {
    if (k.roulette > 0) {
      k.tickT = (k.tickT || 0) - dt;
      if (k.tickT <= 0) {
        k.tickT = 0.07;
        audio.sfx('tick');
      }
    }
  }
  r.homingT -= dt;
  if (r.homingT <= 0) {
    let closest = Infinity;
    for (const o of r.items.objects) {
      if (o.type !== 'red' || !o.target?.human) continue;
      closest = Math.min(closest, Math.hypot(o.x - o.target.x, o.z - o.target.z));
    }
    if (closest < 60) {
      audio.sfx('beep', 1 - closest / 60);
      r.homingT = 0.08 + (closest / 60) * 0.35;
    } else r.homingT = 0.1;
  }
  const anyStar = r.humanKarts.some((k) => k.star > 0);
  if (anyStar !== r.star) {
    r.star = anyStar;
    if (r.phase === 'race') audio.setStar(anyStar);
  }

  // End of battle: one kart left standing, every human out, or time up.
  if (r.mode === 'battle' && r.phase === 'race') {
    const humansIn = r.humanKarts.some((k) => !k.ghost);
    if (r.endTimer < 0 && ((alive.length <= 1 && r.karts.length > 1) || !humansIn)) {
      r.endTimer = 3;
      const winner = alive.length === 1 ? alive[0] : null;
      if (winner) for (const h of r.humanKarts) flash(h, h === winner ? 'YOU WIN!' : `${winner.name} WINS!`, '#ffe14d', 3);
    }
    if (r.clock >= BATTLE_TIME && r.endTimer < 0) r.endTimer = 0.01;
    if (r.endTimer > 0) {
      r.endTimer -= dt;
      if (r.endTimer <= 0) showResults();
    }
  }
  // End of race.
  if (r.phase === 'race' && r.mode !== 'battle') {
    // Disconnected players' karts drive on autopilot, so a Wi-Fi blip doesn't end the race.
    const humansLeft = r.humanKarts.some((k) => !k.finished);
    if (!humansLeft && r.endTimer < 0) r.endTimer = 3.5;
    if (r.firstHumanFinish >= 0 && r.clock - r.firstHumanFinish > 30 && r.endTimer < 0) r.endTimer = 0.01;
    if (r.endTimer > 0) {
      r.endTimer -= dt;
      if (r.endTimer <= 0) showResults();
    }
  }

  updateEngines(r);

  r.statusTimer -= dt;
  if (r.statusTimer <= 0) {
    r.statusTimer = 0.15;
    for (const k of r.humanKarts) if (k.player?.connected) sendRaceState(k.player);
  }
}

// Battle: a hit pops one balloon; at zero the kart is out and becomes a ghost.
function popBalloon(k) {
  const r = race;
  if (k.ghost || !(k.balloons > 0)) return;
  k.balloons--;
  k.setBalloons(k.balloons);
  fx.burst(k.x, k.y + 3.2, k.z, [new THREE.Color(k.driver.color).getHex(), 0xffffff], 22, 9, 0);
  audio.sfx('pop');
  if (k.stealer && !k.stealer.ghost) {
    const thief = k.stealer;
    thief.balloons = Math.min(5, thief.balloons + 1);
    thief.setBalloons(thief.balloons);
    if (thief.human) flash(thief, 'BALLOON STOLEN!', '#7dff6e', 1.4);
  }
  k.stealer = null;
  if (k.balloons <= 0) {
    k.outAt = r.clock + ++r.outCount * 1e-3;
    k.item = null;
    k.itemCount = 0;
    k.roulette = 0;
    k.setGhost();
    if (k.human) flash(k, 'ELIMINATED', '#ff5a5a', 3);
    audio.sfx('explode');
  } else if (k.human) {
    flash(k, `${k.balloons} 🎈 LEFT`, '#ffffff', 1.2);
  }
}

// Battle: ramming a rival while boosting (mushroom/star) steals a balloon.
function ramSteals(alive) {
  for (const a of alive) {
    if (a.boost <= 0 && a.star <= 0) continue;
    for (const b of alive) {
      if (a === b || b.star > 0) continue;
      if ((a.x - b.x) ** 2 + (a.z - b.z) ** 2 > 2.9 * 2.9) continue;
      if (b.hit('bump')) b.stealer = a;
    }
  }
}

// Particles coming off a kart: drift sparks + tyre smoke, dust off-road, boost flames, star glitter.
function emitKartFx(k, dt) {
  // Only bother for karts someone can see.
  const near = race.humanKarts.length === 0 || race.humanKarts.some((h) => (h.x - k.x) ** 2 + (h.z - k.z) ** 2 < 130 * 130);
  if (!near) return;
  const per = (rate) => Math.random() < rate * dt * fx.density;
  const fwdX = k.forwardX, fwdZ = k.forwardZ;
  const sc = k.shrink > 0 ? 0.6 : 1;
  const speed = Math.abs(k.speed);
  // Tyre marks while drifting, braking hard or spinning out.
  if (high() && !k.air && (k.drifting || k.spin > 0 || (k.input.brake && speed > 12)) && speed > 5) {
    k.skidT = (k.skidT || 0) - dt;
    if (k.skidT <= 0) {
      k.skidT = 0.035;
      for (const sx of [-1.05, 1.05]) {
        const p = k.toWorld(sx * sc, 0, -0.95 * sc);
        skids.add(p.x, p.z, Math.atan2(k.vx, k.vz), race.time, k.y);
      }
    }
  }
  if (k.drifting && speed > 6 && !k.air) {
    const tier = k.driftTier();
    const color = tier >= 0 ? DRIFT_TIERS[tier].color : 0xfff2b0;
    for (const sx of [-1.05, 1.05]) {
      const p = k.toWorld(sx * sc, 0.2, -0.95 * sc);
      if (per(tier >= 0 ? 70 : 25)) fx.spark(p.x, p.y, p.z, color, -fwdX * 3, -fwdZ * 3);
      if (per(14)) fx.smoke(p.x, 0.3, p.z, k.vx, k.vz);
    }
  }
  if (k.offroad && speed > 4 && !k.air) {
    for (const sx of [-1, 1]) {
      const p = k.toWorld(sx * sc, 0.2, -0.9 * sc);
      if (per(18)) fx.dust(p.x, p.y, p.z, race.track.theme.dust, k.vx, k.vz);
    }
  }
  if (k.boost > 0) {
    for (const e of k.model.exhausts) {
      const p = k.toWorld(e.x * sc, e.y * sc, e.z * sc);
      if (per(60)) fx.flame(p.x, p.y, p.z, -fwdX * 8 + k.vx * 0.5, -fwdZ * 8 + k.vz * 0.5, true);
    }
  }
  if (k.star > 0 && per(40)) fx.sparkle(k.x, k.y + 1.2, k.z, new THREE.Color().setHSL(Math.random(), 1, 0.6).getHex());
  if (k.spin > 0 && per(20)) fx.smoke(k.x, k.y + 0.6, k.z, 0, 0, 0xffffff, 0.3);
}

// One engine voice per human player, panned toward their part of the screen.
function updateEngines(r) {
  const rects = layout(r.humanKarts.length, W, H);
  const scale = 1 / Math.sqrt(Math.max(1, r.humanKarts.length));
  r.humanKarts.forEach((k, i) => {
    const rc = rects[i];
    audio.updateEngine(k.id, {
      speed: k.speed,
      max: r.cc.maxSpeed,
      gas: !!k.input.gas || k.boost > 0,
      boost: k.boost > 0,
      drifting: k.drifting,
      offroad: k.offroad,
      pan: rc ? ((rc.x + rc.w / 2) / W - 0.5) * 1.2 : 0,
      on: r.phase !== 'results',
      scale,
    });
  });
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
    mode: race.mode,
    balloons: k.balloons ?? 0,
    out: !!k.ghost,
    left: race.mode === 'battle' ? Math.max(0, Math.ceil(BATTLE_TIME - race.clock)) : 0,
    captain: p.pid === captainPid(),
  });
}

function showResults() {
  const r = race;
  r.phase = phase = 'results';
  audio.stopEngines();
  audio.setStar(false);
  audio.startMusic('results');
  r.cheer = 4;
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
      balloons: r.mode === 'battle' ? (k.ghost ? 0 : k.balloons) : null,
      pts,
      total: k.player ? k.player.points : null,
    };
  });
  const body = $('resultsBody');
  body.innerHTML = '';
  for (const row of rows) {
    const tr = document.createElement('tr');
    if (!row.human) tr.className = 'cpu';
    const t = row.balloons != null
      ? row.balloons > 0 ? '🎈'.repeat(row.balloons) : 'Out'
      : row.time == null ? '—' : `${Math.floor(row.time / 60)}:${(row.time % 60).toFixed(2).padStart(5, '0')}`;
    tr.innerHTML = `<td>${ordinal(row.place)}</td><td><span class="sw"></span><span class="nm"></span></td><td>${t}</td><td>+${row.pts}</td><td>${row.total ?? ''}</td>`;
    tr.querySelector('.sw').style.background = row.color;
    tr.querySelector('.nm').textContent = row.name + (row.human ? '' : ' (CPU)');
    body.appendChild(tr);
  }
  $('resultsTitle').textContent = r.mode === 'battle' ? `${TRACK_NAMES[cfg.track]} Arena — Balloon Battle` : `${TRACK_NAMES[cfg.track]} — Results`;
  $('resultsTimeCol').textContent = r.mode === 'battle' ? 'Balloons' : 'Time';
  $('results').classList.remove('hidden');
  lastResults = { t: 'results', rows, captain: captainPid() };
  sendTo('*', lastResults);
  audio.sfx('cheer', 1.2);
  fx.confetti(r.order[0].x, r.order[0].y, r.order[0].z, 120);
}

// ---------------------------------------------------------------- cameras + render
const tmpV = new THREE.Vector3();
const tmpL = new THREE.Vector3();
function snapCamera(cam, k) {
  cam.position.set(k.x - k.forwardX * 7.5, k.y + 3.4, k.z - k.forwardZ * 7.5);
  cam.lookAt(k.x + k.forwardX * 4, k.y + 1.2, k.z + k.forwardZ * 4);
}

const ease = (t) => t * t * (3 - 2 * t);

function updateCamera(cam, k, dt, r) {
  let back = 6.6, up = 3.1, angle = Math.PI, follow = 11;
  // Intro swoop during the countdown: start in front of the kart and circle behind it.
  if (r && r.phase === 'countdown') {
    const t = ease(Math.min(1, Math.max(0, (COUNTDOWN - r.countdown) / 2.4)));
    angle = 0.5 + (Math.PI - 0.5) * t;
    back = 14 - 6.8 * t;
    up = 7 - 3.7 * t;
    follow = 60;
  }
  const h = k.heading + Math.PI - angle;
  tmpV.set(k.x - Math.sin(h) * back, k.y + up, k.z - Math.cos(h) * back);
  cam.position.lerp(tmpV, 1 - Math.exp(-dt * follow));
  // Shake after hits and wall bonks.
  if (k.shake > 0) {
    k.shake = Math.max(0, k.shake - dt);
    const a = k.shake * 0.5;
    cam.position.x += (Math.random() - 0.5) * a;
    cam.position.y += (Math.random() - 0.5) * a;
  }
  tmpL.set(k.x + k.forwardX * 4, k.y + 1.2, k.z + k.forwardZ * 4);
  cam.lookAt(tmpL);
  // Lean into drifts a little.
  cam.rotateZ(k.drifting ? k.driftDir * 0.04 : 0);
  const fov = 64 + (k.boost > 0 ? 12 : 0) + Math.min(6, Math.max(0, k.speed - 20) * 0.6);
  cam.fov += (fov - cam.fov) * Math.min(1, dt * 4);
  cam.updateProjectionMatrix();
}

// Point rendering at one screen rectangle, either on the HDR post target or
// straight on screen (Low graphics). three.js viewport origin is bottom-left.
function setRect(r) {
  if (high()) {
    const t = post.target, pr = renderer.getPixelRatio();
    t.viewport.set(r.x * pr, (H - r.y - r.h) * pr, r.w * pr, r.h * pr);
    t.scissor.copy(t.viewport);
    t.scissorTest = true;
    renderer.setRenderTarget(t);
  } else {
    renderer.setRenderTarget(null);
    renderer.setViewport(r.x, H - r.y - r.h, r.w, r.h);
    renderer.setScissor(r.x, H - r.y - r.h, r.w, r.h);
  }
}

const camDir = new THREE.Vector3();
function renderView(cam, r) {
  cam.aspect = r.w / r.h;
  cam.updateProjectionMatrix();
  sky.follow(cam);
  fx.setViewport(cam, r.h);
  // Shadow box centred a little ahead of this camera.
  cam.getWorldDirection(camDir);
  const tx = cam.position.x + camDir.x * 30, tz = cam.position.z + camDir.z * 30;
  sun.target.position.set(tx, 0, tz);
  sun.position.set(tx + sunDir.x * 160, sunDir.y * 160, tz + sunDir.z * 160);
  sun.target.updateMatrixWorld();
  setRect(r);
  renderer.render(scene, cam);
}

// Lobby: a slow fly-through along the track.
function renderLobby(dt) {
  if (!track) return;
  if (track.arena) {
    lobbyS += dt * 0.12;
    lobbyCam.position.set(Math.cos(lobbyS) * 95, 32, Math.sin(lobbyS) * 95);
    lobbyCam.lookAt(0, 0, 0);
    renderView(lobbyCam, { x: 0, y: 0, w: W, h: H });
    return;
  }
  const cl = track.cl;
  lobbyS = (lobbyS + (dt * 9) / cl.seg) % cl.n;
  const p = cl.pointAt(lobbyS, Math.sin(lobbyS / 60) * 6);
  const a = cl.pointAt(lobbyS + 22 / cl.seg, 0);
  lobbyCam.position.set(p.x, p.y + 9 + Math.sin(lobbyS / 40) * 3, p.z);
  lobbyCam.lookAt(a.x, a.y + 2, a.z);
  fx.ambient(dt, p.x, p.z, track.theme.weather, p.y);
  renderView(lobbyCam, { x: 0, y: 0, w: W, h: H });
}

const overviewCam = new THREE.PerspectiveCamera(60, 1, 0.5, 1500);
let orbit = 0;
function render(dt) {
  wind.value = performance.now() / 1000;
  skids.update(race ? race.time : 0);
  const views = race && race.phase !== 'results' ? race.humanKarts.length : 0;
  const cells = layout(Math.max(1, views), W, H);
  post.setViews(Math.round(W / cells[0].w), Math.round(H / cells[0].h));
  drawFrame(dt);
  if (high()) post.finish();
}

function drawFrame(dt) {
  hud.clearRect(0, 0, W, H);
  sky.update(dt);
  fx.update(dt);
  const time = performance.now() / 1000;
  if (!race) {
    track?.update(time, 0);
    renderLobby(dt);
    return;
  }
  const r = race;
  track.update(time, r.phase === 'countdown' ? 0.4 : r.cheer > 0 ? 1 : 0.1);
  const views = r.humanKarts;
  if (r.phase === 'results' || views.length === 0) {
    // Orbit the winner.
    const lead = r.order[0];
    orbit += dt * 0.35;
    overviewCam.position.set(lead.x + Math.cos(orbit) * 11, lead.y + 4.5, lead.z + Math.sin(orbit) * 11);
    overviewCam.lookAt(lead.x, lead.y + 1, lead.z);
    fx.ambient(dt, lead.x, lead.z, track.theme.weather, lead.y);
    renderView(overviewCam, { x: 0, y: 0, w: W, h: H });
    return;
  }
  const rects = layout(views.length, W, H);
  views.forEach((k, i) => {
    updateCamera(r.cams[i], k, dt, r);
    if (i < 4) fx.ambient(dt / Math.min(views.length, 4), k.x, k.z, track.theme.weather, k.y);
    // Name tags only for nearby rivals, so distant packs don't turn into a pile of labels.
    for (const o of r.karts) o.model.tag.visible = o !== k && (o.x - k.x) ** 2 + (o.z - k.z) ** 2 < 70 * 70;
    renderView(r.cams[i], rects[i]);
  });
  views.forEach((k, i) => drawViewportHud(hud, rects[i], k, r, r.time));

  // Spare cell (3, 5, 7 players) shows the map + standings; otherwise a corner minimap.
  if (rects.length > views.length) {
    const spare = rects[views.length];
    setRect(spare);
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
  if (r.phase === 'countdown') drawCountdown(hud, W, H, Math.ceil(r.countdown - 1), r.countdown);
  else if (r.clock < 1) drawCountdown(hud, W, H, 0, r.clock);
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
  net.frame(dt);
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
  renderer,
  scene,
  get track() { return track; },
  startRace,
  toLobby,
  // Fast-forward the simulation (used by the end-to-end smoke test).
  simulate(seconds) {
    for (let t = 0; t < seconds && race; t += STEP) stepRace(STEP);
  },
};
