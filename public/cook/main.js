import * as audio from '../tv/audio.js';
import { PartyTV } from '../shared/party-tv.js';
import { Kitchen, RECIPES, DIFFICULTY } from './kitchen.js';
import { CookScene } from './scene.js';
import { iconCanvas } from './icons.js';

// Kitchen Rush: cook together. Orders come in; chop, cook, plate and serve
// them before their tickets run out. 1–4 chefs, best with 2.

const $ = (id) => document.getElementById(id);
const COLORS = ['#e53935', '#1e88e5', '#fdd835', '#43a047'];
const STEP = 1 / 60;
// Words for what a chef is holding (shown on their phone).
function itemName(h) {
  if (!h) return 'empty hands';
  const plated = { tomato: 'tomato', lettuce: 'lettuce', bun: 'bun', meat: 'patty' };
  if (h.type === 'plate') return h.contents.length ? `plate (${h.contents.map((c) => plated[c]).join(', ')})` : 'empty plate';
  if (h.kind === 'meat') return { raw: 'raw meat', chopped: 'raw patty', cooked: 'cooked patty', burnt: 'burnt patty' }[h.state];
  return h.state === 'raw' ? h.kind : `${h.state} ${h.kind}`;
}

let kitchen = new Kitchen({ chefs: 0 });
const view = new CookScene($('gl'), kitchen);
window.addEventListener('resize', () => view.resize());

const party = new PartyTV({
  game: 'cook',
  title: 'Kitchen <span>Rush</span>',
  tagline: 'Cook together! Grab ingredients, chop them, cook the patties, plate up and serve before the tickets run out.',
  maxPlayers: 4,
  colors: COLORS,
  roleNames: ['Red chef', 'Blue chef', 'Yellow chef', 'Green chef'],
  buttons: ['GRAB', 'CHOP'],
  playersHint: 'Up to 4 chefs, best with 2. GRAB picks up / puts down / plates up; hold CHOP at a chopping board.',
  rows: [
    { k: 'time', label: 'Shift', options: [120, 180, 240].map((v) => ({ label: `${v / 60} min`, value: v })), i: 1 },
    { k: 'diff', label: 'Pace', options: DIFFICULTY.map((d, i) => ({ label: d.name, value: i })), i: 1 },
  ],
  slotLabel: () => 'Open',
  startLabel: 'Open the kitchen',
  lobbyMusic: 'lobby',
  onStart: startShift,
  onLobby: toLobby,
  onGfx: (high) => view.setQuality(high),
});
view.setQuality(party.gfx === 'high');

let state = 'lobby'; // lobby | countdown | cook | over
let timer = 0;
let lastCount = 0;
let chefs = []; // { pid, slot, name } in kitchen order
let lastHud = 0;

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function startShift() {
  const ps = party.connected();
  chefs = ps.map((p) => ({ pid: p.pid, slot: p.slot, name: p.name }));
  kitchen = new Kitchen({ chefs: chefs.length, difficulty: party.cfg('diff'), duration: party.cfg('time') });
  view.setChefs(chefs.map((c) => COLORS[c.slot]));
  state = 'countdown';
  timer = 3.2;
  lastCount = 4;
  for (const id of ['orders', 'clock', 'scorebox']) $(id).classList.remove('hidden');
  $('orders').innerHTML = '';
  party.setPhase('play');
  audio.startMusic('cook');
  audio.fadeMusic(0.32);
  party.banner('Ready?', 'Orders are coming in!', '#fff', 1.2);
  hud(true);
}

function toLobby() {
  state = 'lobby';
  kitchen = new Kitchen({ chefs: 0 });
  view.setChefs([]);
  for (const id of ['orders', 'clock', 'scorebox']) $(id).classList.add('hidden');
  audio.fadeMusic(0.42);
  party.setPhase('lobby');
}

// ---------------------------------------------------------------- HUD
function ticketHtml(o) {
  const r = RECIPES[o.recipe];
  const main = iconCanvas(`plate:${r.items.join('+')}`).toDataURL();
  const parts = r.items.map((it) => `<img src="${iconCanvas(`${it}:${it === 'meat' ? 'cooked' : it === 'bun' ? 'raw' : 'chopped'}`, 64).toDataURL()}">`).join('');
  return `<div class="ticket" data-id="${o.id}"><div>${r.name}</div><img class="main" src="${main}"><div class="ic">${parts}</div><div class="tm"><i></i></div></div>`;
}

function hud(force = false) {
  const k = kitchen;
  // Tickets: add new ones, drop finished ones, update timers.
  const box = $('orders');
  const ids = new Set(k.orders.map((o) => String(o.id)));
  for (const el of [...box.children]) if (!ids.has(el.dataset.id)) el.remove();
  for (const o of k.orders) {
    let el = box.querySelector(`[data-id="${o.id}"]`);
    if (!el) {
      box.insertAdjacentHTML('beforeend', ticketHtml(o));
      el = box.lastElementChild;
    }
    const f = Math.max(0, o.left / o.time);
    el.querySelector('.tm i').style.width = `${f * 100}%`;
    el.classList.toggle('late', f < 0.25);
  }
  const left = Math.max(0, k.duration - k.time);
  $('clock').textContent = fmt(state === 'countdown' ? k.duration : left);
  $('clock').classList.toggle('low', left < 20);
  $('scorebox').textContent = `★ ${k.score}`;
  // Phones: time, score and what you're holding.
  const now = performance.now();
  if (force || now - lastHud > 500) {
    lastHud = now;
    party.hud = (p) => {
      const i = chefs.findIndex((c) => c.pid === p.pid);
      return `${fmt(left)} · ★ ${k.score} · ${itemName(k.chefs[i]?.holding)}`;
    };
    party.changed();
  }
}

function popText(text, color = '#ffcf33') {
  const el = document.createElement('div');
  el.className = 'pop';
  el.textContent = text;
  el.style.color = color;
  el.style.right = '3vw';
  el.style.top = '10vh';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

function finish() {
  state = 'over';
  const k = kitchen;
  const stars = k.stars();
  audio.sfx(stars >= 2 ? 'finish' : 'final');
  party.over = () => ({ title: `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, sub: `${k.score} points · ${k.served} served · ${k.failed} missed` });
  for (const c of chefs) party.fx(party.players.get(c.pid), stars >= 2 ? 'win' : 'lose');
  party.setPhase('over');
  const title = ['Kitchen nightmare…', 'Not bad!', 'Great service!', 'Master chefs!'][stars];
  party.showResults(
    title,
    '#ffcf33',
    `<div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div><div class="big">${k.score} points</div><div>${k.served} orders served · ${k.failed} missed</div>`
  );
}

// ---------------------------------------------------------------- loop
const chopSound = new Map();
function step(dt) {
  if (state === 'countdown') {
    timer -= dt;
    const c = Math.ceil(timer - 0.2);
    if (c !== lastCount && c > 0 && c <= 3) {
      lastCount = c;
      party.banner(String(c), '', '#fff', 0.7);
      audio.sfx('count');
    }
    if (timer <= 0) {
      state = 'cook';
      party.banner('SERVICE!', '', '#ff8a3d', 0.9);
      audio.sfx('go');
    }
    return;
  }
  if (state !== 'cook') return;
  const inputs = chefs.map((c) => {
    const p = party.players.get(c.pid);
    if (!p?.connected) return {};
    return { x: p.in.x, y: p.in.y, a: p.in.b0, b: p.in.b1 };
  });
  kitchen.step(dt, inputs);
  for (const e of kitchen.events) {
    const p = e.chef !== undefined ? party.players.get(chefs[e.chef]?.pid) : null;
    switch (e.type) {
      case 'pick':
      case 'drop':
      case 'plate':
        audio.sfx('menu');
        party.fx(p, 'pick');
        break;
      case 'nope':
        audio.sfx('beep', -0.5);
        break;
      case 'chopped':
        audio.sfx('pop');
        party.fx(p, 'ok');
        break;
      case 'cooked':
        audio.sfx('ding');
        break;
      case 'burnt':
        audio.sfx('buzz');
        party.toast('🔥 A patty burnt! Bin it.');
        break;
      case 'trash':
        audio.sfx('bump');
        break;
      case 'order':
        audio.sfx('lap');
        break;
      case 'served':
        audio.sfx('pad');
        audio.sfx('cheer', 0.5);
        popText(`+${20 + e.tip}`);
        for (const c of chefs) party.fx(party.players.get(c.pid), 'point');
        view.fx.confetti(13.5, 1, 3.5, 40);
        break;
      case 'wrong':
        audio.sfx('buzz');
        party.fx(p, 'bad');
        party.toast('Nobody ordered that!');
        break;
      case 'expired':
        audio.sfx('buzz');
        popText('-10', '#ff6b6b');
        party.toast(`Too slow: the ${RECIPES[e.order.recipe].name.toLowerCase()} was cancelled`);
        break;
    }
  }
  kitchen.events.length = 0;
  // Chopping noise while someone works a board.
  kitchen.chefs.forEach((c) => {
    const t = (chopSound.get(c.i) || 0) - dt;
    chopSound.set(c.i, c.chopping && t <= 0 ? 0.22 : t);
    if (c.chopping && t <= 0) audio.sfx('chop');
  });
  if (kitchen.over) finish();
}

let last = performance.now();
let acc = 0;
let hudT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  party.frame(dt);
  acc += dt;
  while (acc >= STEP) {
    step(STEP);
    acc -= STEP;
  }
  hudT += dt;
  if (state !== 'lobby' && hudT > 0.1) {
    hudT = 0;
    hud();
  }
  view.render(kitchen, dt, state === 'lobby' ? 'lobby' : 'match');
  requestAnimationFrame(frame);
}

toLobby();
view.resize();
requestAnimationFrame(frame);

window.cook = {
  party,
  get kitchen() { return kitchen; },
  get state() { return state; },
  simulate(seconds) {
    party.readKeyboard();
    for (let t = 0; t < seconds; t += STEP) step(STEP);
    hud(true);
  },
};
