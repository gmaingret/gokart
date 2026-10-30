import * as audio from '../tv/audio.js';
import { PartyTV } from '../shared/party-tv.js';
import { Arena, createBot, driveBot, LEVELS } from './arena.js';
import { SumoScene } from './scene.js';

// Ice Sumo: shove everyone else off a shrinking ice ring. Up to 4 wrestlers
// (phones, topped up with CPUs); last one standing takes the round.

const $ = (id) => document.getElementById(id);
const COLORS = ['#ff4f7b', '#29b6ff', '#ffcf33', '#5ee36a'];
const STEP = 1 / 120;

const view = new SumoScene($('gl'), COLORS.map((c) => parseInt(c.slice(1), 16)));
window.addEventListener('resize', () => view.resize());

const party = new PartyTV({
  game: 'sumo',
  title: 'Ice <span>Sumo</span>',
  tagline: 'Push everyone off the ice! Joystick to slide, hold DASH to charge a big shove. The ring keeps shrinking…',
  maxPlayers: 4,
  colors: COLORS,
  buttons: ['DASH'],
  rows: [
    { k: 'wins', label: 'Rounds to win', options: [2, 3, 5].map((v) => ({ label: String(v), value: v })), i: 1 },
    { k: 'cpu', label: 'CPU wrestlers', options: [0, 1, 2, 3].map((v) => ({ label: String(v), value: v })), i: 1 },
    { k: 'level', label: 'CPU level', options: LEVELS.map((l, i) => ({ label: l.name, value: i })), i: 1 },
  ],
  slotLabel: (i, n) => (i < n + cpuCount(n) ? 'CPU' : 'Open'),
  canStart: (n) => n > 0,
  startLabel: 'Start sumo',
  lobbyMusic: 'lobby',
  onStart: startMatch,
  onLobby: toLobby,
  onGfx: (high) => view.setQuality(high),
});
view.setQuality(party.gfx === 'high');

// CPUs fill up to 4, and there's always someone to push.
function cpuCount(humans) {
  return Math.max(humans < 2 ? 1 : 0, Math.min(party.cfg('cpu'), 4 - humans));
}

let arena = null;
let fighters = []; // { slot, name, pid?, bot?, wins }
let state = 'lobby'; // lobby | countdown | fight | roundover | over
let timer = 0;
let round = 0;
let lastCount = 0;

function setupFighters(demo = false) {
  const humans = demo ? [] : party.connected();
  const slotsUsed = new Set(humans.map((p) => p.slot));
  fighters = humans.map((p) => ({ slot: p.slot, name: p.name, pid: p.pid, wins: 0 }));
  const nCpu = demo ? 4 : cpuCount(humans.length);
  for (let s = 0, made = 0; s < 4 && made < nCpu; s++) {
    if (slotsUsed.has(s)) continue;
    fighters.push({ slot: s, name: `CPU ${made + 1}`, bot: createBot(0, demo ? 1 + (made % 2) : party.cfg('level')), wins: 0 });
    made++;
  }
  fighters.sort((a, b) => a.slot - b.slot);
  // Colours follow slots, so the scene gets one wrestler per slot used.
  view.colors = fighters.map((f) => parseInt(COLORS[f.slot].slice(1), 16));
}

function newRound() {
  arena = new Arena(fighters.length);
  fighters.forEach((f, i) => f.bot && (f.bot.i = i));
  view.setPlayers(fighters.length);
  round++;
}

function startMatch() {
  setupFighters();
  round = 0;
  newRound();
  state = 'countdown';
  timer = 3.2;
  lastCount = 4;
  party.setPhase('play');
  $('hudbar').classList.remove('hidden');
  audio.startMusic('sumo');
  audio.fadeMusic(0.32);
  party.banner(`ROUND ${round}`, '', '#fff', 1);
  updateHud();
}

function toLobby() {
  state = 'lobby';
  setupFighters(true);
  round = 0;
  newRound();
  $('hudbar').classList.add('hidden');
  audio.fadeMusic(0.42);
  party.setPhase('lobby');
}

function fighterOf(p) {
  return fighters.find((f) => f.pid === p.pid);
}

function updateHud() {
  const need = party.cfg('wins');
  $('hudbar').innerHTML = fighters
    .map((f, i) => {
      const out = arena?.balls[i]?.falling;
      return `<span class="pl${out ? ' out' : ''}" style="color:${COLORS[f.slot]}"><i style="background:${COLORS[f.slot]}"></i><span style="color:#fff">${f.name.replace(/[<&]/g, '')}</span> ${'★'.repeat(f.wins)}${'☆'.repeat(Math.max(0, need - f.wins))}</span>`;
    })
    .join('');
  party.hud = (p) => {
    const f = fighterOf(p);
    return f ? `Round ${round} · ${'★'.repeat(f.wins)}${'☆'.repeat(Math.max(0, need - f.wins))} · hold DASH, let go to shove` : '';
  };
  party.changed();
}

function endRound() {
  const alive = arena.alive();
  const need = party.cfg('wins');
  if (alive.length === 1) {
    const f = fighters[alive[0].i];
    f.wins++;
    party.banner(`${f.name} wins!`, f.wins >= need ? '' : `Round ${round}`, COLORS[f.slot], 2);
    audio.sfx('cheer', 1);
    if (f.pid !== undefined) party.fx(party.players.get(f.pid), 'point');
  } else {
    party.banner('DRAW!', 'Everyone fell in', '#fff', 2);
  }
  const champ = fighters.find((f) => f.wins >= need);
  if (champ) {
    state = 'over';
    timer = 2.4;
    audio.sfx('finish');
    party.over = (p) => {
      const f = fighterOf(p);
      return { title: f === champ ? 'Yokozuna! 🏆' : `${champ.name} wins`, sub: fighters.map((x) => `${x.name} ${x.wins}`).join(' · ') };
    };
    for (const f of fighters) if (f.pid !== undefined) party.fx(party.players.get(f.pid), f === champ ? 'win' : 'lose');
  } else {
    state = 'roundover';
    timer = 2.6;
  }
  updateHud();
}

function step(dt) {
  if (!arena) return;
  if (state === 'countdown') {
    timer -= dt;
    const c = Math.ceil(timer - 0.2);
    if (c !== lastCount && c > 0 && c <= 3) {
      lastCount = c;
      party.banner(String(c), '', '#fff', 0.7);
      audio.sfx('count');
    }
    if (timer <= 0) {
      state = 'fight';
      party.banner('HAKKEYOI!', '', '#ffcf33', 0.9);
      audio.sfx('go');
    }
    return;
  }
  if (state === 'roundover') {
    timer -= dt;
    arena.step(dt, []);
    arena.events.length = 0;
    if (timer <= 0) {
      newRound();
      state = 'countdown';
      timer = 3.2;
      lastCount = 4;
      party.banner(`ROUND ${round}`, '', '#fff', 1);
      updateHud();
    }
    return;
  }
  if (state === 'over') {
    timer -= dt;
    arena.step(dt, []);
    arena.events.length = 0;
    if (timer <= 0 && party.phase !== 'over') {
      const rows = [...fighters].sort((a, b) => b.wins - a.wins).map((f) => `<tr><td><span class="sw" style="background:${COLORS[f.slot]}"></span>${f.name.replace(/[<&]/g, '')}</td><td>${f.wins} ★</td></tr>`).join('');
      const champ = fighters.find((f) => f.wins >= party.cfg('wins'));
      party.setPhase('over');
      party.showResults(`${champ.name} is Yokozuna!`, COLORS[champ.slot], `<table>${rows}</table>`);
    }
    return;
  }

  // Fight (or the lobby demo).
  const inputs = fighters.map((f) => {
    if (f.bot) return driveBot(f.bot, arena, dt);
    const p = party.players.get(f.pid);
    if (!p?.connected) return { x: 0, y: 0, dash: false };
    return { x: p.in.x, y: p.in.y, dash: p.in.b0 };
  });
  arena.step(dt, inputs);
  for (const e of arena.events) {
    if (e.type === 'bump') {
      const k = Math.min(1, e.speed / 25);
      if (state !== 'lobby' || k > 0.5) audio.sfx('bump');
      for (let n = 0; n < 4 + k * 14; n++) view.fx.spark(e.x, 1.2, e.z, 0xffffff);
      if (k > 0.5) view.shake = Math.max(view.shake, k * 0.25);
      for (const i of [e.a, e.b]) {
        const f = fighters[i];
        if (f.pid !== undefined) party.fx(party.players.get(f.pid), 'bump');
      }
    } else if (e.type === 'dash') {
      if (state !== 'lobby') audio.sfx('whoosh');
      const f = fighters[e.i];
      if (f.pid !== undefined) party.fx(party.players.get(f.pid), 'dash');
    } else if (e.type === 'fall') {
      if (state !== 'lobby') audio.sfx('slip');
      const by = e.by >= 0 ? fighters[e.by] : null;
      const f = fighters[e.i];
      if (state === 'fight') {
        party.toast(by ? `${by.name} pushed ${f.name} in! 💦` : `${f.name} slipped in! 💦`);
        if (f.pid !== undefined) party.fx(party.players.get(f.pid), 'out');
        updateHud();
      }
    } else if (e.type === 'splash') {
      view.splash(e.x, e.z);
      if (state !== 'lobby') audio.sfx('splash');
    }
  }
  arena.events.length = 0;

  const standing = arena.alive().length;
  if (state === 'fight' && standing <= 1) {
    // Give a falling loser a moment to hit the water first.
    timer = (timer > 0 ? timer : 0.9) - dt;
    if (timer <= 0.0001) endRound();
  } else if (state === 'lobby' && (standing <= 1 || arena.time > 70)) {
    timer = (timer > 0 ? timer : 1.5) - dt;
    if (timer <= 0.0001) newRound();
  }
}

// ---------------------------------------------------------------- loop
let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  party.frame(dt);
  acc += dt;
  while (acc >= STEP) {
    step(STEP);
    acc -= STEP;
  }
  view.render(arena, dt, state === 'lobby' ? 'lobby' : 'match');
  requestAnimationFrame(frame);
}

toLobby();
view.resize();
requestAnimationFrame(frame);

window.sumo = {
  party,
  get arena() { return arena; },
  get state() { return state; },
  get fighters() { return fighters; },
  simulate(seconds) {
    party.readKeyboard();
    for (let t = 0; t < seconds; t += STEP) step(STEP);
  },
};
