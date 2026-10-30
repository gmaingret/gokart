import { DRIVERS, ITEMS, ordinal } from '../shared/config.js';

const $ = (id) => document.getElementById(id);
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
const opts = {
  steer: store.get('steer', 'drag'),
  auto: store.get('auto', true),
  invert: store.get('invert', false),
  vibe: store.get('vibe', true),
};
let myDriver = store.get('driver', Math.floor(Math.random() * DRIVERS.length));
let myPid = null;
let joined = false;
let lobby = null;
let status = { phase: 'lobby' };
let ws = null;
let wantJoin = false;

const params = new URLSearchParams(location.search);
const urlRoom = (params.get('room') || '').toUpperCase();
$('name').value = store.get('name', '');
// Arriving from another game (auto=1) the old room code is stale: let the server pick.
const autoJoin = !!params.get('auto');
let joinRetries = 0;
$('code').value = urlRoom || (autoJoin ? '' : store.get('code', ''));
if (urlRoom) $('codeField').classList.add('hidden');

// ---------------------------------------------------------------- screens
const screens = ['sJoin', 'sLobby', 'sRace', 'sResults', 'sWatch'];
function show(id) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== id);
}
function banner(text) {
  $('banner').textContent = text || '';
  $('banner').classList.toggle('hidden', !text);
}

function setMeColor() {
  document.documentElement.style.setProperty('--me', DRIVERS[myDriver]?.color || '#ff4f7b');
}

function renderDrivers(el, taken, onPick) {
  el.innerHTML = '';
  DRIVERS.forEach((d, i) => {
    const b = document.createElement('button');
    b.style.background = d.color;
    b.style.setProperty('--acc', d.accent);
    b.textContent = d.name;
    if (i === myDriver) b.classList.add('sel');
    if (taken.has(i) && i !== myDriver) b.classList.add('taken');
    b.addEventListener('click', () => !(taken.has(i) && i !== myDriver) && onPick(i));
    el.appendChild(b);
  });
}

function pickDriver(i) {
  myDriver = i;
  store.set('driver', i);
  setMeColor();
  if (joined) send({ t: 'pick', driver: i });
  refresh();
}

function refresh() {
  const taken = new Set((lobby?.players || []).filter((p) => p.pid !== myPid).map((p) => p.driver));
  renderDrivers($('joinDrivers'), taken, pickDriver);
  renderDrivers($('lobbyDrivers'), taken, pickDriver);
  if (!lobby) return;
  const me = lobby.players.find((p) => p.pid === myPid);
  if (me && me.driver !== myDriver) {
    myDriver = me.driver;
    setMeColor();
    renderDrivers($('lobbyDrivers'), taken, pickDriver);
  }
  const others = $('others');
  others.innerHTML = '';
  for (const p of lobby.players) {
    const s = document.createElement('span');
    s.innerHTML = '<i></i>';
    s.querySelector('i').style.background = DRIVERS[p.driver]?.color;
    s.append(p.name + (p.pid === lobby.captain ? ' 👑' : '') + (p.points ? ` · ${p.points}` : ''));
    others.appendChild(s);
  }
  const captain = lobby.captain === myPid;
  $('captainBox').classList.toggle('hidden', !captain);
  $('waitBox').classList.toggle('hidden', captain);
  const c = lobby.cfg;
  const battle = c.mode === 'battle';
  $('cMode').textContent = battle ? '🎈 Balloons' : '🏁 Race';
  $('cTrack').textContent = lobby.tracks[c.track] + (battle ? ' Arena' : '');
  $('cLaps').textContent = battle ? '3 min' : c.laps;
  $('cLaps').parentElement.querySelector('span').textContent = battle ? 'Time' : 'Laps';
  $('cCc').textContent = c.cc + 'cc';
  $('cBots').textContent = c.bots;
  $('waitCfg').textContent = battle
    ? `🎈 Balloon Battle · ${lobby.tracks[c.track]} Arena · ${c.cc}cc · ${c.bots} CPU`
    : `${lobby.tracks[c.track]} · ${c.laps} laps · ${c.cc}cc · ${c.bots} CPU`;
  $('quitBtn').classList.toggle('hidden', !captain);
}

// ---------------------------------------------------------------- network
function send(m) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(m));
}

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
  const name = $('name').value.trim() || 'Player';
  const code = ($('code').value || '').trim().toUpperCase();
  send({ t: 'join', code, cid, name, live: autoJoin });
}

function hello() {
  send({ t: 'hello', name: $('name').value.trim() || 'Player', driver: myDriver });
}

function onMsg(m) {
  switch (m.t) {
    case 'joined':
      joined = true;
      myPid = m.pid;
      store.set('code', m.code);
      $('joinErr').textContent = '';
      hello();
      if (status.phase === 'lobby') show('sLobby');
      break;
    case 'error':
      // Sent over from Air Hockey, the GoKart TV may still be loading: keep trying.
      if (autoJoin && !joined && joinRetries++ < 20) {
        setTimeout(doJoin, 1000);
        return;
      }
      $('joinErr').textContent = m.msg;
      wantJoin = false;
      joined = false;
      show('sJoin');
      banner('');
      break;
    case 'hostgone':
      banner('The TV disconnected — waiting for it to come back…');
      break;
    case 'hostback':
      banner('');
      hello();
      break;
    case 'lobby':
      lobby = m;
      refresh();
      if (m.phase === 'lobby') {
        status = { phase: 'lobby' };
        show('sLobby');
      }
      break;
    case 'st':
      onStatus(m);
      break;
    case 'fx':
      onFx(m.k);
      break;
    case 'results':
      showResults(m);
      break;
    case 'switch':
      // The TV changed game: follow it.
      location.href = m.url;
      break;
  }
}

// ---------------------------------------------------------------- race status
let lastPhase = null;
function onStatus(s) {
  status = s;
  if (s.phase === 'lobby') {
    show('sLobby');
    return;
  }
  if (s.phase === 'watch') {
    show('sWatch');
    return;
  }
  if (s.phase === 'results') return;
  if (lastPhase !== s.phase || $('sRace').classList.contains('hidden')) {
    show('sRace');
    applyOpts();
  }
  lastPhase = s.phase;
  $('rPlace').textContent = s.place ? ordinal(s.place) : '–';
  if (s.mode === 'battle') {
    const m = Math.floor(s.left / 60), sec = String(s.left % 60).padStart(2, '0');
    $('rLap').textContent = `${s.out ? 'OUT' : '🎈'.repeat(s.balloons)}  ${m}:${sec}`;
  } else {
    $('rLap').textContent = `Lap ${s.lap}/${s.laps}`;
  }
  const cd = $('countdown');
  if (s.phase === 'countdown') {
    cd.classList.remove('hidden');
    cd.textContent = s.cd > 0 ? s.cd : 'GO!';
  } else cd.classList.add('hidden');
  const item = $('item');
  item.classList.toggle('roll', s.item === 'roulette');
  item.classList.toggle('has', !!s.item && s.item !== 'roulette');
  $('itemIcon').textContent =
    s.item === 'roulette' ? '❓' : s.item ? ITEMS[s.item].icon + (s.item === 'triple' && s.ic > 1 ? `×${s.ic}` : '') : '';
  const fin = $('finishMsg');
  fin.classList.toggle('hidden', !s.fin && !s.out);
  if (s.fin) fin.innerHTML = `🏁 FINISHED<br>${ordinal(s.place)}`;
  else if (s.out) fin.innerHTML = '💥 ELIMINATED<br><small>Keep driving as a ghost!</small>';
  if (lobby) lobby.captain = s.captain ? myPid : lobby.captain === myPid ? null : lobby.captain;
  $('quitBtn').classList.toggle('hidden', !s.captain);
}

function vibrate(p) {
  if (opts.vibe && navigator.vibrate) navigator.vibrate(p);
}
function onFx(k) {
  if (k === 'hit') vibrate([80, 40, 160, 40, 80]);
  else if (k === 'zap') vibrate([40, 30, 40, 30, 200]);
  else if (k === 'bump' || k === 'bonk') vibrate(40);
  else if (k === 'boost') vibrate(25);
  else if (k === 'gotitem') vibrate(15);
  else if (k === 'finish') vibrate([100, 60, 100, 60, 300]);
}

function showResults(m) {
  show('sResults');
  status = { phase: 'results' };
  const ol = $('resList');
  ol.innerHTML = '';
  for (const r of m.rows) {
    const li = document.createElement('li');
    if (r.pid === myPid) li.classList.add('me');
    li.innerHTML = '<span class="pl"></span><span class="nm"></span><span class="pts"></span>';
    li.querySelector('.pl').textContent = ordinal(r.place);
    li.querySelector('.nm').textContent = r.name + (r.human ? '' : ' (CPU)');
    li.querySelector('.nm').style.color = r.color;
    li.querySelector('.pts').textContent = `+${r.pts}`;
    ol.appendChild(li);
  }
  const captain = m.captain === myPid;
  $('nextBtn').classList.toggle('hidden', !captain);
  $('resWait').classList.toggle('hidden', captain);
  vibrate(60);
}

// ---------------------------------------------------------------- controls
const input = { s: 0, g: false, b: false, d: false, ic: 0 };
let lastSent = '';
let held = { left: false, right: false };
let dragSteer = 0;
let tiltSteer = 0;

function computeSteer() {
  if (opts.steer === 'buttons') return (held.right ? 1 : 0) - (held.left ? 1 : 0);
  if (opts.steer === 'tilt') return tiltSteer;
  return dragSteer;
}

function pushInput(force = false) {
  input.s = Math.round(computeSteer() * 100) / 100;
  if (opts.auto) input.g = !input.b;
  const msg = JSON.stringify(input);
  if (force || msg !== lastSent) {
    lastSent = msg;
    send({ t: 'in', ...input });
  }
}
setInterval(() => {
  if (!$('sRace').classList.contains('hidden')) pushInput(true);
}, 120);

// Generic hold button supporting multi-touch.
function holdButton(el, onChange) {
  const ids = new Set();
  const update = () => {
    const on = ids.size > 0;
    el.classList.toggle('on', on);
    onChange(on);
    pushInput();
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture?.(e.pointerId);
    ids.add(e.pointerId);
    update();
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    el.addEventListener(ev, (e) => {
      if (ids.delete(e.pointerId)) update();
    });
  }
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

holdButton($('gas'), (on) => (input.g = on));
holdButton($('brake'), (on) => (input.b = on));
holdButton($('drift'), (on) => {
  if (on && !input.d) vibrate(10);
  input.d = on;
});
holdButton($('left'), (on) => (held.left = on));
holdButton($('right'), (on) => (held.right = on));
$('item').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  input.ic++;
  $('item').classList.add('on');
  setTimeout(() => $('item').classList.remove('on'), 120);
  pushInput(true);
});

// Slide-to-steer: the thumb's horizontal offset from where it landed.
(() => {
  const zone = $('steer');
  const knob = $('knob');
  let id = null, x0 = 0;
  const range = () => Math.max(50, zone.clientWidth * 0.28);
  const set = (v) => {
    dragSteer = Math.max(-1, Math.min(1, v));
    knob.style.transform = `translateX(${dragSteer * range()}px)`;
    pushInput();
  };
  zone.addEventListener('pointerdown', (e) => {
    if (opts.steer !== 'drag' || id !== null) return;
    e.preventDefault();
    id = e.pointerId;
    zone.setPointerCapture?.(id);
    // Landing off-centre steers immediately (feels better than a dead zone).
    const rect = zone.getBoundingClientRect();
    const fromCentre = (e.clientX - (rect.left + rect.width / 2)) / range();
    x0 = e.clientX - Math.max(-1, Math.min(1, fromCentre)) * range() * 0.5;
    set((e.clientX - x0) / range());
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === id) set((e.clientX - x0) / range());
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    zone.addEventListener(ev, (e) => {
      if (e.pointerId !== id) return;
      id = null;
      set(0);
    });
  }
})();

// Tilt steering from gravity along the phone's long axis.
function onMotion(e) {
  const g = e.accelerationIncludingGravity;
  if (!g || g.x == null) return;
  const angle = screen.orientation?.angle ?? window.orientation ?? 0;
  let raw;
  if (angle === 90) raw = g.y;
  else if (angle === 270 || angle === -90) raw = -g.y;
  else raw = -g.x;
  raw /= 9.81;
  // iOS reports gravity with the opposite sign to Android.
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) raw = -raw;
  if (opts.invert) raw = -raw;
  const dead = 0.04;
  const v = Math.abs(raw) < dead ? 0 : (raw - Math.sign(raw) * dead) / 0.4;
  tiltSteer = Math.max(-1, Math.min(1, v));
  pushInput();
}
async function enableTilt() {
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const r = await DeviceMotionEvent.requestPermission();
      if (r !== 'granted') throw new Error('denied');
    }
    if (!window.isSecureContext && /iPhone|iPad|iPod/.test(navigator.userAgent)) throw new Error('insecure');
    window.addEventListener('devicemotion', onMotion);
    return true;
  } catch {
    alert('Tilt steering is not available in this browser over plain http. Using slide steering instead.');
    opts.steer = 'drag';
    store.set('steer', 'drag');
    $('optSteer').value = 'drag';
    applyOpts();
    return false;
  }
}

function applyOpts() {
  const z = $('steer');
  z.classList.toggle('mode-buttons', opts.steer === 'buttons');
  $('tiltInfo').classList.toggle('hidden', opts.steer !== 'tilt');
  $('knob').style.display = opts.steer === 'drag' ? '' : 'none';
  $('buttons').classList.toggle('manual', !opts.auto);
  if (opts.steer !== 'tilt') window.removeEventListener('devicemotion', onMotion);
}

// ---------------------------------------------------------------- settings
$('optSteer').value = opts.steer;
$('optAuto').checked = opts.auto;
$('optInvert').checked = opts.invert;
$('optVibe').checked = opts.vibe;
$('optSteer').addEventListener('change', async (e) => {
  opts.steer = e.target.value;
  store.set('steer', opts.steer);
  applyOpts();
  if (opts.steer === 'tilt') await enableTilt();
});
$('optAuto').addEventListener('change', (e) => {
  opts.auto = e.target.checked;
  store.set('auto', opts.auto);
  if (!opts.auto) input.g = false;
  applyOpts();
});
$('optInvert').addEventListener('change', (e) => store.set('invert', (opts.invert = e.target.checked)));
$('optVibe').addEventListener('change', (e) => store.set('vibe', (opts.vibe = e.target.checked)));
const openSettings = () => $('settings').classList.remove('hidden');
$('settingsBtn').addEventListener('click', openSettings);
$('rMenu').addEventListener('click', openSettings);
$('closeSettings').addEventListener('click', () => $('settings').classList.add('hidden'));
$('quitBtn').addEventListener('click', () => {
  if (confirm('End the race for everyone?')) send({ t: 'quit' });
  $('settings').classList.add('hidden');
});

// ---------------------------------------------------------------- lobby actions
document.querySelectorAll('.cfg').forEach((row) => {
  row.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => send({ t: 'cfg', k: row.dataset.k, d: Number(b.dataset.d) }))
  );
});
$('startBtn').addEventListener('click', () => send({ t: 'start' }));
$('nextBtn').addEventListener('click', () => send({ t: 'next' }));

let wakeLock = null;
async function keepAwake() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wantJoin) keepAwake();
});

$('joinBtn').addEventListener('click', async () => {
  const name = $('name').value.trim();
  if (!name) {
    $('name').focus();
    $('joinErr').textContent = 'Enter your name first.';
    return;
  }
  store.set('name', name);
  wantJoin = true;
  $('joinErr').textContent = '';
  // Fullscreen + landscape lock where supported (Android Chrome).
  try {
    await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    await screen.orientation?.lock?.('landscape');
  } catch {}
  keepAwake();
  if (opts.steer === 'tilt') enableTilt();
  if (ws?.readyState === 1) doJoin();
});
$('name').addEventListener('keydown', (e) => e.key === 'Enter' && $('joinBtn').click());

// Prevent pinch-zoom / double-tap zoom on iOS.
document.addEventListener('gesturestart', (e) => e.preventDefault());
let lastTouch = 0;
document.addEventListener(
  'touchend',
  (e) => {
    const now = Date.now();
    if (now - lastTouch < 350 && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') e.preventDefault();
    lastTouch = now;
  },
  { passive: false }
);

setMeColor();
refresh();
applyOpts();
connect();
if (autoJoin && $('name').value.trim()) {
  wantJoin = true;
  keepAwake();
}
