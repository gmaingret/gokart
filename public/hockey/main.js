import * as audio from '../tv/audio.js';
import { Table, HX, HZ } from './table.js';
import { createBot, driveBot, LEVELS } from './ai.js';
import { HockeyScene, COLORS } from './scene.js';
import { createNetStat } from '../shared/netstat.js';

// Air hockey on the TV: two phones are the mallets (or one phone vs the CPU).
// Phones send their finger position on their half of the table; the TV runs
// the physics and renders. Shares the server, relay and audio with GoKart.

const $ = (id) => document.getElementById(id);
const POINTS = [5, 7, 10];
const CSS_COLORS = COLORS.map((c) => '#' + c.toString(16).padStart(6, '0'));
const STEP = 1 / 120;

const cfg = { points: 7, cpu: 1, gfx: 'high' };
try {
  cfg.gfx = localStorage.getItem('gokart.gfx') === 'low' ? 'low' : 'high';
} catch {}

const view = new HockeyScene($('gl'));
view.setQuality(cfg.gfx === 'high');
window.addEventListener('resize', () => view.resize());

const players = new Map(); // pid -> { pid, name, connected, kb, u, v }
let seats = [null, null]; // pid per side; null = CPU
let phase = 'lobby'; // lobby | countdown | play | goal | over
let table = new Table();
let bots = [createBot(0, 1), createBot(1, 1)];
let score = [0, 0];
let timer = 0;
let lastServe = 0;
let roomCode = '····';

// ---------------------------------------------------------------- seats
function connected() {
  return [...players.values()].filter((p) => p.connected);
}
function captainPid() {
  let best = null;
  for (const p of players.values()) if (p.connected && !p.kb && (best === null || p.pid < best)) best = p.pid;
  return best ?? (players.get('kb')?.connected ? 'kb' : null);
}
function seatOf(pid) {
  return seats.indexOf(pid);
}
// Keep seated players, fill free seats with whoever is waiting (phones first).
function assignSeats() {
  seats = seats.map((pid) => (pid !== null && players.get(pid)?.connected ? pid : null));
  const waiting = connected()
    .filter((p) => !seats.includes(p.pid))
    .sort((a, b) => (a.kb ? 1 : 0) - (b.kb ? 1 : 0) || a.pid - b.pid);
  for (let i = 0; i < 2; i++) if (seats[i] === null && waiting.length) seats[i] = waiting.shift().pid;
}
function nameOf(side) {
  const p = players.get(seats[side]);
  return p ? p.name : `CPU (${LEVELS[cfg.cpu].name})`;
}

// ---------------------------------------------------------------- networking
let ws = null;
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => {
    $('conn').classList.add('hidden');
    ws.send(JSON.stringify({ t: 'host', game: 'hockey', code: sessionStorage.getItem('hockey.room') || undefined }));
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
      sessionStorage.setItem('hockey.room', roomCode);
      updateJoinInfo();
      break;
    case 'join': {
      let p = players.get(msg.pid);
      if (!p) players.set(msg.pid, (p = { pid: msg.pid, u: 0.5, v: 0.5 }));
      p.name = msg.name;
      p.connected = true;
      toast(`${p.name} joined!`);
      audio.sfx('join');
      changed();
      break;
    }
    case 'leave': {
      const p = players.get(msg.pid);
      if (!p) break;
      p.connected = false;
      toast(`${p.name} disconnected`);
      // Mid-match the CPU steps in until they're back.
      changed();
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

function onPlayer(p, m) {
  if (!p || !m) return;
  const captain = p.pid === captainPid();
  switch (m.t) {
    case 'ka':
      net.pong(p, m);
      break;
    case 'hello':
      if (typeof m.name === 'string' && m.name.trim()) p.name = m.name.trim().slice(0, 12);
      changed();
      break;
    case 'p':
      net.input(p, m.tp);
      p.u = Math.max(0, Math.min(1, Number(m.x) || 0));
      p.v = Math.max(0, Math.min(1, Number(m.y) || 0));
      break;
    case 'cfg':
      if (captain && phase === 'lobby' && ['points', 'cpu'].includes(m.k)) changeCfg(m.k, m.d);
      break;
    case 'swap':
      if (captain && phase === 'lobby') {
        seats.reverse();
        audio.sfx('menu');
        changed();
      }
      break;
    case 'start':
      if (captain && phase === 'lobby') startMatch();
      break;
    case 'again':
      if (captain && phase === 'over') startMatch();
      break;
    case 'lobby':
    case 'quit':
      if (captain && phase !== 'lobby') toLobby();
      break;
  }
}

// Everyone gets the lobby/match state (small, so just resend it on changes).
function changed() {
  assignSeats();
  const cap = captainPid();
  const base = {
    t: 'state',
    phase,
    captain: cap,
    cfg: { points: cfg.points, cpu: LEVELS[cfg.cpu].name },
    names: [nameOf(0), nameOf(1)],
    colors: CSS_COLORS,
    score,
  };
  for (const p of connected()) sendTo(p.pid, { ...base, side: seatOf(p.pid) });
  renderLobby();
  renderScore();
}

// ---------------------------------------------------------------- lobby UI
const ROWS = ['game', 'points', 'cpu', 'gfx', 'start'];
const START_ROW = ROWS.indexOf('start');
let focusRow = START_ROW;

function changeCfg(k, dir) {
  dir = Math.sign(dir) || 1;
  if (k === 'game') return switchGame();
  if (k === 'points') cfg.points = POINTS[(POINTS.indexOf(cfg.points) + dir + POINTS.length) % POINTS.length];
  if (k === 'cpu') cfg.cpu = Math.max(0, Math.min(LEVELS.length - 1, cfg.cpu + dir));
  if (k === 'gfx') {
    cfg.gfx = cfg.gfx === 'high' ? 'low' : 'high';
    try {
      localStorage.setItem('gokart.gfx', cfg.gfx);
    } catch {}
    view.setQuality(cfg.gfx === 'high');
  }
  audio.sfx('menu');
  changed();
}

// Back to GoKart, taking the phones along.
function switchGame() {
  sendTo('*', { t: 'switch', url: '/play?auto=1' });
  sessionStorage.removeItem('hockey.room');
  setTimeout(() => (location.href = '/'), 150);
}

function renderLobby() {
  const cap = captainPid();
  ['seatL', 'seatR'].forEach((id, i) => {
    const el = $(id);
    const p = players.get(seats[i]);
    el.classList.toggle('cpu', !p);
    el.querySelector('.nm').textContent = p ? `${p.name}${p.pid === cap ? ' 👑' : ''}` : `CPU · ${LEVELS[cfg.cpu].name}`;
  });
  const bench = connected().filter((p) => !seats.includes(p.pid));
  $('benchHint').textContent = bench.length ? `Next up: ${bench.map((p) => p.name).join(', ')}` : '';
  $('vPoints').textContent = cfg.points;
  $('vCpu').textContent = LEVELS[cfg.cpu].name;
  $('vGfx').textContent = cfg.gfx === 'high' ? 'High' : 'Low (faster)';
  $('startBtn').disabled = !connected().length;
  document.querySelectorAll('#settings .row').forEach((r, i) => r.classList.toggle('focus', i === focusRow));
}

function renderScore() {
  $('nameL').textContent = nameOf(0);
  $('nameR').textContent = nameOf(1);
  $('scoreL').textContent = score[0];
  $('scoreR').textContent = score[1];
  $('scoreTo').textContent = `First to ${cfg.points}`;
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
  const url = `${base}/hockey/play?room=${roomCode}`;
  $('qr').src = `/api/qr?u=${encodeURIComponent(url)}`;
  $('joinUrl').textContent = `${base.replace(/^https?:\/\//, '')}/hockey/play`;
  $('roomCode').textContent = roomCode;
}

document.querySelectorAll('#settings .row').forEach((row, i) => {
  row.querySelector('.dec')?.addEventListener('click', () => changeCfg(row.dataset.k, -1));
  row.querySelector('.inc')?.addEventListener('click', () => changeCfg(row.dataset.k, 1));
  row.addEventListener('mouseenter', () => {
    focusRow = i;
    renderLobby();
  });
});
$('startBtn').addEventListener('click', () => startMatch());

let toastTimer = null;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

let bannerTimer = null;
function banner(big, small = '', color = '#fff', dur = 1.4) {
  const b = $('banner');
  $('bannerBig').textContent = big;
  $('bannerBig').style.color = color;
  $('bannerSmall').textContent = small;
  // Restart the pop animation.
  $('bannerBig').style.animation = 'none';
  void $('bannerBig').offsetWidth;
  $('bannerBig').style.animation = '';
  b.classList.remove('hidden');
  clearTimeout(bannerTimer);
  if (dur) bannerTimer = setTimeout(() => b.classList.add('hidden'), dur * 1000);
}

// ---------------------------------------------------------------- match flow
function startMatch() {
  if (!connected().length) return;
  audio.initAudio();
  assignSeats();
  table = new Table();
  bots = [createBot(0, cfg.cpu), createBot(1, cfg.cpu)];
  score = [0, 0];
  // The left player serves first.
  table.serve(-1);
  table.frozen = true;
  phase = 'countdown';
  timer = 3;
  lastCount = 4;
  $('lobby').classList.add('hidden');
  $('results').classList.add('hidden');
  $('score').classList.remove('hidden');
  audio.startMusic('hockey');
  audio.fadeMusic(0.3);
  changed();
}

function toLobby() {
  phase = 'lobby';
  table = new Table();
  bots = [createBot(0, 2), createBot(1, 1)];
  score = [0, 0];
  $('lobby').classList.remove('hidden');
  $('results').classList.add('hidden');
  $('score').classList.add('hidden');
  $('banner').classList.add('hidden');
  audio.startMusic('lobby');
  audio.fadeMusic(0.42);
  changed();
}

function goal(scorer) {
  score[scorer]++;
  const conceded = 1 - scorer;
  phase = 'goal';
  timer = 1.8;
  lastServe = conceded;
  const sx = conceded ? 1 : -1;
  view.flashGoal(conceded);
  view.fx.confetti(sx * HX, 0.5, 0, 90);
  view.fx.burst(sx * HX, 0.5, 0, [COLORS[scorer], 0xffffff, 0xffd84d], 40, 14, 1);
  audio.sfx('goal');
  const el = scorer ? $('scoreR') : $('scoreL');
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  const won = score[scorer] >= cfg.points;
  banner(won ? 'WINNER!' : 'GOAL!', nameOf(scorer), CSS_COLORS[scorer], won ? 0 : 1.6);
  for (const [side, k] of [[scorer, won ? 'win' : 'goal'], [conceded, won ? 'lose' : 'conceded']]) {
    if (seats[side] !== null) sendTo(seats[side], { t: 'fx', k });
  }
  if (won) {
    phase = 'over';
    timer = 2.2;
    audio.sfx('finish');
  }
  changed();
}

function showResults() {
  const w = score[0] > score[1] ? 0 : 1;
  $('resultsTitle').textContent = `${nameOf(w)} wins!`;
  $('resultsTitle').style.color = CSS_COLORS[w];
  $('resultsScore').innerHTML = `<span class="l">${score[0]}</span> – <span class="r">${score[1]}</span>`;
  $('results').classList.remove('hidden');
  $('banner').classList.add('hidden');
}

let lastCount = 4;
const hitCooldown = [0, 0];
function step(dt) {
  // Mallet targets: phones (their half of the table, as seen on the TV),
  // the keyboard player, or the CPU.
  for (let i = 0; i < 2; i++) {
    const p = players.get(seats[i]);
    if (phase === 'lobby' || !p?.connected) {
      driveBot(bots[i], table, dt);
      table.setTarget(i, bots[i].tx, bots[i].tz);
    } else if (p.kb) {
      // Arrow keys move the mallet across this half (fractions of it per second).
      p.kx = (p.kx ?? 0.5) + ((keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0)) * dt * 1.2;
      p.kz = (p.kz ?? 0.5) + ((keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0)) * dt * 1.2;
      p.kx = Math.max(0, Math.min(1, p.kx));
      p.kz = Math.max(0, Math.min(1, p.kz));
      table.mallets[i].maxSpeed = 30;
      table.setTarget(i, i ? p.kx * HX : -HX + p.kx * HX, -HZ + p.kz * 2 * HZ);
    } else {
      table.mallets[i].maxSpeed = 55;
      table.setTarget(i, i ? p.u * HX : -HX + p.u * HX, -HZ + p.v * 2 * HZ);
    }
  }

  if (phase === 'countdown') {
    timer -= dt;
    const c = Math.ceil(timer);
    if (c !== lastCount && c > 0) {
      lastCount = c;
      banner(String(c), '', '#fff', 0.8);
      audio.sfx('count');
    }
    if (timer <= 0) {
      phase = 'play';
      table.frozen = false;
      banner('GO!', '', '#ffd84d', 0.7);
      audio.sfx('go');
      changed();
    }
  } else if (phase === 'goal') {
    timer -= dt;
    if (timer <= 0) {
      table.frozen = false;
      table.serve(lastServe ? 1 : -1);
      phase = 'play';
      changed();
    }
  } else if (phase === 'over') {
    timer -= dt;
    if (timer <= 0 && $('results').classList.contains('hidden')) showResults();
  }

  table.step(dt);
  hitCooldown[0] -= dt;
  hitCooldown[1] -= dt;
  for (const e of table.events) {
    if (e.type === 'goal') {
      if (phase === 'play') goal(e.scorer);
      else if (phase === 'lobby') setTimeout(() => ((table.frozen = false), table.serve(e.scorer ? -1 : 1)), 900);
    } else if (e.type === 'hit') {
      const k = Math.min(1, e.speed / 30);
      const p = table.puck;
      if (phase !== 'lobby' || k > 0.3) audio.sfx('puck', k);
      for (let n = 0; n < 2 + k * 10; n++) view.fx.spark(p.x, 0.3, p.z, COLORS[e.mallet], p.vx * 0.2, p.vz * 0.2);
      if (seats[e.mallet] !== null && hitCooldown[e.mallet] <= 0 && phase === 'play') {
        sendTo(seats[e.mallet], { t: 'fx', k: 'hit' });
        hitCooldown[e.mallet] = 0.25;
      }
    } else if (e.type === 'wall') {
      const k = Math.min(1, e.speed / 30);
      if (phase !== 'lobby') audio.sfx('rail', k);
      const p = table.puck;
      if (k > 0.3) for (let n = 0; n < k * 8; n++) view.fx.spark(p.x, 0.3, p.z, 0xffd84d);
    }
  }
  table.events.length = 0;
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
  if (phase === 'lobby') {
    if (e.code === 'ArrowUp') focusRow = (focusRow + ROWS.length - 1) % ROWS.length;
    else if (e.code === 'ArrowDown') focusRow = (focusRow + 1) % ROWS.length;
    else if (e.code === 'ArrowLeft' && focusRow < START_ROW) return changeCfg(ROWS[focusRow], -1);
    else if (e.code === 'ArrowRight' && focusRow < START_ROW) return changeCfg(ROWS[focusRow], 1);
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      if (focusRow === START_ROW) startMatch();
      else changeCfg(ROWS[focusRow], 1);
      return;
    } else if (e.code === 'KeyK') {
      const kb = players.get('kb');
      if (kb?.connected) kb.connected = false;
      else {
        players.set('kb', { pid: 'kb', kb: true, name: 'Keyboard', connected: true });
        audio.sfx('join');
      }
    } else return;
    e.preventDefault();
    changed();
  } else if (phase === 'over') {
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') startMatch();
  } else if (e.code === 'Escape' || e.code === 'Backspace') {
    toLobby();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

// ---------------------------------------------------------------- main loop
let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= STEP) {
    step(STEP);
    acc -= STEP;
  }
  view.render(table, dt, phase === 'lobby' ? 'lobby' : 'match');
  net.frame(dt);
  requestAnimationFrame(frame);
}

// Lobby: the CPU plays itself on the table behind the menu.
bots = [createBot(0, 2), createBot(1, 1)];
table.serve(-1);
view.resize();
changed();
connect();
requestAnimationFrame(frame);

// Debug / test hook.
window.hockey = {
  get table() { return table; },
  get phase() { return phase; },
  get score() { return score; },
  cfg,
  players,
  seats: () => seats,
  startMatch,
  toLobby,
  simulate(seconds) {
    for (let t = 0; t < seconds; t += STEP) step(STEP);
  },
};
