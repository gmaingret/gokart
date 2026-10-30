// Shared phone controller for the party games: a joystick on the left, one or
// two buttons on the right. The game (from the URL, /<game>/play) decides the
// button labels and what the lobby shows; all of that comes from the TV.

import { GAMES } from './games.js';

const $ = (id) => document.getElementById(id);
const GAME = location.pathname.split('/')[1] || 'sumo';
const TITLES = { sumo: 'Ice <span>Sumo</span>', cook: 'Kitchen <span>Rush</span>' };
document.title = `${GAMES.find((g) => g.id === GAME)?.name.replace(/^\S+\s/, '') || 'Party'} Controller`;
$('logo').innerHTML = TITLES[GAME] || GAME;

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('gokart.' + k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('gokart.' + k, JSON.stringify(v));
    } catch {}
  },
};
let cid = store.get('cid', null);
if (!cid) {
  cid = Math.random().toString(36).slice(2) + Date.now().toString(36);
  store.set('cid', cid);
}
const params = new URLSearchParams(location.search);
const autoJoin = !!params.get('auto');
$('name').value = store.get('name', '');
$('code').value = (params.get('room') || '').toUpperCase();
if (params.get('room')) $('codeField').classList.add('hidden');

let ws = null;
let wantJoin = false;
let joined = false;
let joinRetries = 0;
let state = null;

const screens = ['sJoin', 'sLobby', 'sPlay', 'sOver'];
function show(id) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== id);
}
function banner(text) {
  $('banner').textContent = text || '';
  $('banner').classList.toggle('hidden', !text);
}
function send(m) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(m));
}

// ---------------------------------------------------------------- network
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => {
    banner('');
    if (wantJoin) doJoin();
  };
  ws.onclose = () => {
    joined = false;
    if (wantJoin) banner('Connection lost — reconnecting…');
    setTimeout(connect, 1200);
  };
  ws.onmessage = (e) => onMsg(JSON.parse(e.data));
}
function doJoin() {
  send({ t: 'join', game: GAME, live: autoJoin, code: ($('code').value || '').trim().toUpperCase(), cid, name: $('name').value.trim() || 'Player' });
}

function onMsg(m) {
  switch (m.t) {
    case 'joined':
      joined = true;
      joinRetries = 0;
      $('joinErr').textContent = '';
      send({ t: 'hello', name: $('name').value.trim() || 'Player' });
      if (!state) show('sLobby');
      break;
    case 'error':
      // Sent over from another game, this TV may still be loading: keep trying.
      if (autoJoin && !joined && joinRetries++ < 20) {
        setTimeout(doJoin, 1000);
        return;
      }
      $('joinErr').textContent = m.msg;
      wantJoin = false;
      show('sJoin');
      break;
    case 'hostgone':
      banner('The TV disconnected — waiting for it to come back…');
      break;
    case 'hostback':
      banner('');
      send({ t: 'hello', name: $('name').value.trim() || 'Player' });
      break;
    case 'state':
      onState(m);
      break;
    case 'fx':
      onFx(m.k);
      break;
    case 'k':
      send({ t: 'ka', ts: m.ts, tp: performance.now() });
      break;
    case 'switch':
      location.href = m.url;
      break;
  }
}

function onState(s) {
  state = s;
  if (s.phase === 'full') {
    $('cardTitle').textContent = 'Game full';
    $('cardSub').textContent = 'Wait for the next round';
    $('captainBox').classList.add('hidden');
    $('waitText').classList.add('hidden');
    show('sLobby');
    return;
  }
  document.documentElement.style.setProperty('--me', s.color || '#ff4f7b');
  if (s.phase === 'lobby') {
    $('cardTitle').textContent = s.role || 'You’re in!';
    $('cardSub').textContent = s.hud || 'This colour is you on the TV';
    $('captainBox').classList.toggle('hidden', !s.captain);
    $('waitText').classList.toggle('hidden', s.captain);
    $('startBtn').disabled = !s.canStart;
    renderRows(s.rows || []);
    show('sLobby');
  } else if (s.phase === 'over') {
    $('overTitle').textContent = s.over?.title || 'Game over';
    $('overSub').textContent = s.over?.sub || '';
    $('overCaptain').classList.toggle('hidden', !s.captain);
    $('overWait').classList.toggle('hidden', s.captain);
    show('sOver');
  } else {
    $('hud').textContent = s.hud || '';
    renderButtons(s.buttons || ['A']);
    show('sPlay');
  }
}

function renderRows(rows) {
  const box = $('rows');
  const sig = JSON.stringify(rows);
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.innerHTML = '';
  for (const r of rows) {
    const d = document.createElement('div');
    d.className = 'cfg';
    d.innerHTML = '<span></span><button data-d="-1">◀</button><b></b><button data-d="1">▶</button>';
    d.querySelector('span').textContent = r.label;
    d.querySelector('b').textContent = r.value;
    d.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => send({ t: 'cfg', k: r.k, d: Number(b.dataset.d) })));
    box.appendChild(d);
  }
}

function vibrate(p) {
  try {
    navigator.vibrate?.(p);
  } catch {}
}
function onFx(k) {
  const patterns = { hit: 25, bump: 40, dash: 15, out: 400, win: [80, 50, 80, 50, 200], lose: 500, point: [40, 30, 40], ok: [30, 30, 60], bad: 250, pick: 12, drop: 12 };
  if (patterns[k]) vibrate(patterns[k]);
}

// ---------------------------------------------------------------- controls
const input = { x: 0, y: 0, b: [0, 0] };
let dirty = true;
let lastSend = 0;

// Floating joystick: put a thumb down anywhere on the left half.
const zone = $('stickZone'), base = $('stickBase'), knob = $('stickKnob');
let stickId = null, ox = 0, oy = 0;
const R = 60;
zone.addEventListener('pointerdown', (e) => {
  if (stickId !== null) return;
  stickId = e.pointerId;
  try {
    zone.setPointerCapture(e.pointerId);
  } catch {}
  const r = zone.getBoundingClientRect();
  ox = e.clientX;
  oy = e.clientY;
  base.style.left = `${e.clientX - r.left}px`;
  base.style.top = `${e.clientY - r.top}px`;
  moveStick(e);
});
zone.addEventListener('pointermove', (e) => e.pointerId === stickId && moveStick(e));
const endStick = (e) => {
  if (e.pointerId !== stickId) return;
  stickId = null;
  input.x = input.y = 0;
  knob.style.transform = '';
  base.style.left = base.style.top = '';
  dirty = true;
};
zone.addEventListener('pointerup', endStick);
zone.addEventListener('pointercancel', endStick);
function moveStick(e) {
  let dx = e.clientX - ox, dy = e.clientY - oy;
  const d = Math.hypot(dx, dy);
  if (d > R) ((dx *= R / d), (dy *= R / d));
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  const dead = 0.12;
  const k = Math.min(1, d / R);
  input.x = k < dead ? 0 : +(dx / R).toFixed(3);
  input.y = k < dead ? 0 : +(dy / R).toFixed(3);
  dirty = true;
}

function renderButtons(labels) {
  const zoneB = $('btnZone');
  const sig = labels.join('|');
  if (zoneB.dataset.sig === sig) return;
  zoneB.dataset.sig = sig;
  zoneB.innerHTML = '';
  labels.forEach((label, i) => {
    const b = document.createElement('button');
    b.className = 'pbtn' + (i ? ' alt' : '');
    b.textContent = label;
    const ids = new Set();
    const set = () => {
      input.b[i] = ids.size ? 1 : 0;
      b.classList.toggle('on', ids.size > 0);
      dirty = true;
      if (ids.size) vibrate(8);
    };
    b.addEventListener('pointerdown', (e) => {
      ids.add(e.pointerId);
      try {
        b.setPointerCapture(e.pointerId);
      } catch {}
      set();
    });
    for (const ev of ['pointerup', 'pointercancel']) b.addEventListener(ev, (e) => (ids.delete(e.pointerId), set()));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    zoneB.appendChild(b);
  });
}

// Send on change, and a steady 30/s so the phone's Wi-Fi stays awake.
function loop(now) {
  if (!$('sPlay').classList.contains('hidden') && ((dirty && now - lastSend > 15) || now - lastSend > 33)) {
    send({ t: 'in', x: input.x, y: input.y, b: input.b, tp: performance.now() });
    dirty = false;
    lastSend = now;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------------------------------------------------------------- buttons / join
$('startBtn').addEventListener('click', () => send({ t: 'start' }));
$('againBtn').addEventListener('click', () => send({ t: 'again' }));
$('lobbyBtn').addEventListener('click', () => send({ t: 'lobby' }));

async function keepAwake() {
  try {
    await navigator.wakeLock?.request('screen');
  } catch {}
}
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && wantJoin && keepAwake());

async function join() {
  const name = $('name').value.trim();
  if (!name) {
    $('name').focus();
    $('joinErr').textContent = 'Enter your name first.';
    return;
  }
  store.set('name', name);
  wantJoin = true;
  $('joinErr').textContent = '';
  try {
    await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    await screen.orientation?.lock?.('landscape');
  } catch {}
  keepAwake();
  if (ws?.readyState === 1) doJoin();
}
$('joinBtn').addEventListener('click', join);
$('name').addEventListener('keydown', (e) => e.key === 'Enter' && join());
document.addEventListener('gesturestart', (e) => e.preventDefault());

connect();
if (autoJoin && $('name').value.trim()) {
  wantJoin = true;
  keepAwake();
}
