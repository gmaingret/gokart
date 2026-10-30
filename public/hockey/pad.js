// Air-hockey phone controller. The screen is your half of the table, laid out
// exactly as it appears on the TV: put your finger where you want your mallet.

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
const params = new URLSearchParams(location.search);
const urlRoom = (params.get('room') || '').toUpperCase();
$('name').value = store.get('name', '');
$('code').value = urlRoom;
if (urlRoom) $('codeField').classList.add('hidden');

let ws = null;
let wantJoin = false;
let joined = false;
let state = null;
let joinRetries = 0;
let pid = null; // ours, from the relay

const screens = ['sJoin', 'sLobby', 'sPlay', 'sOver'];
function show(id) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== id);
  if (id === 'sPlay') resizePad();
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
  send({ t: 'join', game: 'hockey', live: !!params.get('auto'), code: ($('code').value || '').trim().toUpperCase(), cid, name: $('name').value.trim() || 'Player' });
}

function onMsg(m) {
  switch (m.t) {
    case 'joined':
      joined = true;
      pid = m.pid;
      joinRetries = 0;
      $('joinErr').textContent = '';
      send({ t: 'hello', name: $('name').value.trim() || 'Player' });
      if (!state) show('sLobby');
      break;
    case 'error':
      // Arriving from GoKart, the hockey TV may still be loading: keep trying.
      if (params.get('auto') && joinRetries++ < 20 && !joined) {
        setTimeout(doJoin, 1000);
        return;
      }
      $('joinErr').textContent = m.msg;
      wantJoin = false;
      joined = false;
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
      // TV heartbeat: answer at once (it measures our ping and keeps Wi-Fi awake).
      send({ t: 'ka', ts: m.ts, tp: performance.now() });
      if (m.r !== null && m.r !== undefined) $('pPing').textContent = `📶 ${m.r} ms`;
      break;
    case 'switch':
      // The TV changed game: follow it.
      location.href = m.url;
      break;
  }
}

// ---------------------------------------------------------------- state
function onState(s) {
  const prev = state?.phase;
  state = s;
  const me = s.side;
  const color = me >= 0 ? s.colors[me] : '#888';
  document.documentElement.style.setProperty('--me', color);
  document.documentElement.style.setProperty('--them', me >= 0 ? s.colors[1 - me] : '#888');
  const captain = s.captain !== null && s.captain === pid;

  if (s.phase === 'lobby') {
    $('seatTitle').textContent = me < 0 ? 'Next in line' : `You play ${me ? 'RIGHT' : 'LEFT'}`;
    $('seatSub').textContent = me < 0 ? 'The table is full — you play the winner' : 'Your phone is your half of the table';
    $('vsLine').textContent = me < 0 ? `${s.names[0]} vs ${s.names[1]}` : `vs ${s.names[1 - me]}`;
    $('captainBox').classList.toggle('hidden', !captain);
    $('waitText').classList.toggle('hidden', captain);
    $('cPoints').textContent = s.cfg.points;
    $('cCpu').textContent = s.cfg.cpu;
    show('sLobby');
  } else if (s.phase === 'over') {
    const w = s.score[0] > s.score[1] ? 0 : 1;
    $('overTitle').textContent = me === w ? 'You win! 🏆' : me < 0 ? `${s.names[w]} wins` : 'You lose…';
    $('overTitle').style.color = s.colors[w];
    $('overScore').textContent = me === 1 ? `${s.score[1]} – ${s.score[0]}` : `${s.score[0]} – ${s.score[1]}`;
    $('overCaptain').classList.toggle('hidden', !captain);
    $('overWait').classList.toggle('hidden', captain);
    // Let the last goal sink in on the TV first.
    setTimeout(() => state?.phase === 'over' && show('sOver'), prev === 'over' ? 0 : 2200);
  } else if (me < 0) {
    $('seatTitle').textContent = 'Watching';
    $('seatSub').textContent = `${s.names[0]} ${s.score[0]} – ${s.score[1]} ${s.names[1]}`;
    $('vsLine').textContent = 'You play the winner';
    $('captainBox').classList.toggle('hidden', true);
    $('waitText').classList.add('hidden');
    show('sLobby');
  } else {
    $('pScoreMe').textContent = s.score[me];
    $('pScoreThem').textContent = s.score[1 - me];
    $('pInfo').textContent = `First to ${s.cfg.points} · vs ${s.names[1 - me]}`;
    show('sPlay');
  }
}


function vibrate(p) {
  try {
    navigator.vibrate?.(p);
  } catch {}
}
function onFx(k) {
  if (k === 'hit') vibrate(18);
  else if (k === 'goal') vibrate([60, 40, 60]);
  else if (k === 'conceded') vibrate(300);
  else if (k === 'win') vibrate([80, 50, 80, 50, 200]);
  else if (k === 'lose') vibrate(500);
}

// ---------------------------------------------------------------- pad
const pad = $('pad');
const g = pad.getContext('2d');
let pos = { u: 0.5, v: 0.5 };
let touching = false;
let dirty = false;
let lastSend = 0;

function resizePad() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  pad.width = pad.clientWidth * dpr;
  pad.height = pad.clientHeight * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizePad);

function setFromEvent(e) {
  const r = pad.getBoundingClientRect();
  pos.u = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  pos.v = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
  dirty = true;
}
pad.addEventListener('pointerdown', (e) => {
  touching = true;
  pad.setPointerCapture?.(e.pointerId);
  setFromEvent(e);
});
pad.addEventListener('pointermove', (e) => {
  if (touching || e.pointerType === 'mouse') setFromEvent(e);
});
for (const ev of ['pointerup', 'pointercancel']) pad.addEventListener(ev, () => (touching = false));

function drawPad() {
  const w = pad.clientWidth, h = pad.clientHeight;
  const me = state?.side ?? 0;
  const color = getComputedStyle(document.documentElement).getPropertyValue('--me').trim() || '#29e0ff';
  const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  grd.addColorStop(0, '#1b2a7a');
  grd.addColorStop(1, '#0a1038');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  // Your goal on the outer edge, the centre line on the inner edge.
  const goalX = me ? w : 0, midX = me ? 0 : w;
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(midX, 0);
  g.lineTo(midX, h);
  g.stroke();
  g.strokeStyle = color;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(goalX, h / 2, h * 0.26, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = color;
  g.fillRect(me ? w - 10 : 0, h / 2 - h * 0.19, 10, h * 0.38);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(midX, h / 2, h * 0.2, 0, Math.PI * 2);
  g.stroke();
  // Your mallet.
  const x = pos.u * w, y = pos.v * h, r = Math.min(w, h) * 0.09;
  g.shadowColor = color;
  g.shadowBlur = 30;
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.arc(x, y, r * 0.45, 0, Math.PI * 2);
  g.fill();
  if (!touching) {
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.font = '700 16px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('Put your finger down and slide', w / 2, h - 18);
  }
}

function loop(now) {
  if (!$('sPlay').classList.contains('hidden')) {
    drawPad();
    // ~60 updates a second while the finger moves, and a steady 30 a second
    // otherwise so the phone's Wi-Fi never dozes off mid-rally.
    if ((dirty && now - lastSend > 15) || now - lastSend > 33) {
      send({ t: 'p', x: +pos.u.toFixed(4), y: +pos.v.toFixed(4), tp: performance.now() });
      dirty = false;
      lastSend = now;
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------------------------------------------------------------- buttons
document.querySelectorAll('.cfg').forEach((row) => {
  row.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => send({ t: 'cfg', k: row.dataset.k, d: Number(b.dataset.d) })));
});
$('swapBtn').addEventListener('click', () => send({ t: 'swap' }));
$('startBtn').addEventListener('click', () => send({ t: 'start' }));
$('againBtn').addEventListener('click', () => send({ t: 'again' }));
$('lobbyBtn').addEventListener('click', () => send({ t: 'lobby' }));

let wakeLock = null;
async function keepAwake() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wantJoin) keepAwake();
});

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
// Sent over from GoKart with a name already saved: join straight away.
if (params.get('auto') && $('name').value.trim()) {
  wantJoin = true;
  keepAwake();
}
