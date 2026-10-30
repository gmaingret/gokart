import * as audio from '../tv/audio.js';
import { createNetStat } from './netstat.js';
import { GAMES, switchGame } from './games.js';

// Shared TV side for the party games (Ice Sumo, Kitchen Rush): room + QR code,
// lobby with players and settings (TV-remote friendly), results screen,
// banners, sound unlock, keyboard player, game switching and the network
// readout. A game supplies its rules and rendering through the callbacks.
//
// Phones send {t:'in', x, y, b:[0|1, 0|1], tp} (joystick + two buttons) and the
// usual hello / cfg / start / again / lobby; the TV sends each phone
// {t:'state', ...} whenever something it shows changes.

const $ = (id) => document.getElementById(id);

export class PartyTV {
  /**
   * opts: {
   *   game, title (html), tagline, maxPlayers, colors: [css], roleNames?: [string],
   *   rows: [{ k, label, options: [{ label, value }], i }],
   *   buttons: [label, label]           // phone buttons
   *   slotLabel(i, nPlayers)            // text for an empty lobby slot ('CPU' / 'Open')
   *   canStart(nPlayers)                // default: at least one player
   *   onStart(), onLobby(), onGfx(high), onChanged()
   *   lobbyMusic, resultsHint
   * }
   */
  constructor(opts) {
    this.o = opts;
    this.players = new Map(); // pid -> { pid, name, connected, kb, slot, in: {x, y, b0, b1} }
    this.phase = 'lobby';
    this.roomCode = '····';
    this.hud = '';
    this.over = null;
    this.gfx = 'high';
    try {
      this.gfx = localStorage.getItem('gokart.gfx') === 'low' ? 'low' : 'high';
    } catch {}
    this.rows = [
      { k: 'game', label: 'Game', options: [{ label: GAMES.find((g) => g.id === opts.game).name }], i: 0 },
      ...opts.rows,
      { k: 'gfx', label: 'Graphics', options: [{ label: 'High', value: 'high' }, { label: 'Low (faster)', value: 'low' }], i: this.gfx === 'low' ? 1 : 0 },
    ];
    this.focus = this.rows.length; // the Start button
    this.keys = new Set();
    this.buildDom();
    this.net = createNetStat((pid, m) => this.sendTo(pid, m), () => this.players.values());
    this.bindInput();
    this.connect();
  }

  // ---------------------------------------------------------------- DOM
  buildDom() {
    const o = this.o;
    document.body.insertAdjacentHTML(
      'beforeend',
      `
<section id="lobby" class="screen">
  <header class="brand"><h1>${o.title}</h1><p>${o.tagline}</p></header>
  <div class="lobby-grid">
    <div class="panel join">
      <img id="qr" alt="QR code to join">
      <div class="join-url" id="joinUrl">…</div>
      <div class="join-code">Room code <b id="roomCode">····</b></div>
    </div>
    <div class="panel players">
      <h2>Players <small id="playerCount"></small></h2>
      <ul id="playerList"></ul>
      <p class="hint">${o.playersHint || 'The first player to join is the captain and starts the game from their phone.'}</p>
    </div>
    <div class="panel settings" id="settings">
      <h2>Setup</h2>
      ${this.rows.map((r) => `<div class="row" data-k="${r.k}"><span>${r.label}</span><button class="dec">◀</button><b></b><button class="inc">▶</button></div>`).join('')}
      <div class="row start" data-k="start"><button id="startBtn">Start</button></div>
      <p class="hint">TV remote: ▲▼ choose · ◀▶ change · OK start<br>Keyboard: <kbd>K</kbd> adds a keyboard player (arrows, Space, X)</p>
    </div>
  </div>
</section>
<section id="results" class="screen hidden">
  <h1 id="resultsTitle"></h1>
  <div id="resultsBody"></div>
  <p class="hint">${o.resultsHint || 'Captain: tap <b>Play again</b> on your phone (or press OK on the TV)'}</p>
</section>
<div id="banner" class="hidden"><b id="bannerBig"></b><span id="bannerSmall"></span></div>
<div id="toast"></div>
<div id="soundHint">🔈 Click or press OK to turn on sound</div>
<div id="conn" class="hidden">Reconnecting to the server…</div>`
    );
    document.querySelectorAll('#settings .row').forEach((row, i) => {
      row.querySelector('.dec')?.addEventListener('click', () => this.change(row.dataset.k, -1));
      row.querySelector('.inc')?.addEventListener('click', () => this.change(row.dataset.k, 1));
      row.addEventListener('mouseenter', () => {
        this.focus = i;
        this.render();
      });
    });
    $('startBtn').addEventListener('click', () => this.start());
  }

  cfg(k) {
    const r = this.rows.find((r) => r.k === k);
    return r.options[r.i].value;
  }

  change(k, dir) {
    dir = Math.sign(dir) || 1;
    if (k === 'game') return switchGame(this.o.game, dir, (m) => this.sendTo('*', m), `${this.o.game}.room`);
    const r = this.rows.find((r) => r.k === k);
    if (!r) return;
    r.i = (r.i + dir + r.options.length) % r.options.length;
    if (k === 'gfx') {
      this.gfx = this.cfg('gfx');
      try {
        localStorage.setItem('gokart.gfx', this.gfx);
      } catch {}
      this.o.onGfx?.(this.gfx === 'high');
    }
    audio.sfx('menu');
    this.changed();
  }

  render() {
    const ps = this.connected();
    const cap = this.captainPid();
    const list = $('playerList');
    list.innerHTML = '';
    for (let i = 0; i < this.o.maxPlayers; i++) {
      const p = ps.find((q) => q.slot === i);
      const li = document.createElement('li');
      li.innerHTML = '<span class="dot"></span><span class="nm"></span>';
      const dot = li.querySelector('.dot');
      if (p) {
        dot.style.background = this.o.colors[i];
        li.querySelector('.nm').textContent = `${p.name}${this.o.roleNames ? ` · ${this.o.roleNames[i]}` : ''}`;
        if (p.pid === cap) li.insertAdjacentHTML('beforeend', '<span class="tag">👑</span>');
      } else {
        li.className = 'empty';
        dot.style.borderColor = this.o.colors[i];
        dot.style.borderStyle = 'dashed';
        dot.style.background = 'transparent';
        li.querySelector('.nm').textContent = this.o.slotLabel ? this.o.slotLabel(i, ps.length) : 'Open';
      }
      list.appendChild(li);
    }
    $('playerCount').textContent = `${ps.length}/${this.o.maxPlayers}`;
    document.querySelectorAll('#settings .row').forEach((el, i) => {
      el.classList.toggle('focus', i === this.focus);
      const r = this.rows.find((r) => r.k === el.dataset.k);
      if (r) el.querySelector('b').textContent = r.options[r.i].label;
    });
    $('startBtn').disabled = !this.canStart();
    $('startBtn').textContent = this.o.startLabel || 'Start';
  }

  // ---------------------------------------------------------------- players
  connected() {
    return [...this.players.values()].filter((p) => p.connected).sort((a, b) => a.slot - b.slot);
  }
  captainPid() {
    let best = null;
    for (const p of this.players.values()) if (p.connected && !p.kb && (best === null || p.pid < best)) best = p.pid;
    return best ?? (this.players.get('kb')?.connected ? 'kb' : null);
  }
  canStart() {
    const n = this.connected().length;
    return this.o.canStart ? this.o.canStart(n) : n > 0;
  }
  // Lowest free slot (colour) for a newcomer; reconnecting players keep theirs.
  freeSlot() {
    const used = new Set(this.connected().map((p) => p.slot));
    for (let i = 0; i < this.o.maxPlayers; i++) if (!used.has(i)) return i;
    return -1;
  }
  addPlayer(pid, name, kb = false) {
    let p = this.players.get(pid);
    if (!p) this.players.set(pid, (p = { pid, kb, in: { x: 0, y: 0, b0: false, b1: false }, slot: -1 }));
    p.name = name;
    if (!p.connected) {
      p.connected = true;
      const taken = this.connected().some((q) => q !== p && q.slot === p.slot);
      if (p.slot < 0 || taken) p.slot = this.freeSlot();
    }
    if (p.slot < 0) p.connected = false; // full
    return p;
  }

  // ---------------------------------------------------------------- network
  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const key = `${this.o.game}.room`;
    this.ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws.onopen = () => {
      $('conn').classList.add('hidden');
      this.ws.send(JSON.stringify({ t: 'host', game: this.o.game, code: sessionStorage.getItem(key) || undefined }));
    };
    this.ws.onmessage = (e) => this.onServer(JSON.parse(e.data));
    this.ws.onclose = () => {
      $('conn').classList.remove('hidden');
      setTimeout(() => this.connect(), 1500);
    };
  }
  sendTo(pid, m) {
    if (pid === 'kb') return;
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify({ t: 'to', pid, m }));
  }

  onServer(msg) {
    switch (msg.t) {
      case 'room':
        this.roomCode = msg.code;
        sessionStorage.setItem(`${this.o.game}.room`, msg.code);
        this.updateJoinInfo();
        break;
      case 'join': {
        const p = this.addPlayer(msg.pid, msg.name);
        if (!p.connected) {
          this.sendTo(msg.pid, { t: 'state', phase: 'full' });
          break;
        }
        this.toast(`${p.name} joined!`);
        audio.sfx('join');
        this.changed();
        break;
      }
      case 'leave': {
        const p = this.players.get(msg.pid);
        if (!p) break;
        p.connected = false;
        p.in = { x: 0, y: 0, b0: false, b1: false };
        this.toast(`${p.name} disconnected`);
        this.changed();
        break;
      }
      case 'from':
        this.onPlayer(this.players.get(msg.pid), msg.m);
        break;
      case 'lat':
        this.net.server(msg, this.players);
        break;
    }
  }

  onPlayer(p, m) {
    if (!p || !m || !p.connected) return;
    const captain = p.pid === this.captainPid();
    switch (m.t) {
      case 'ka':
        this.net.pong(p, m);
        break;
      case 'hello':
        if (typeof m.name === 'string' && m.name.trim()) p.name = m.name.trim().slice(0, 12);
        this.changed();
        break;
      case 'in': {
        this.net.input(p, m.tp);
        const x = Number(m.x) || 0, y = Number(m.y) || 0;
        const len = Math.hypot(x, y);
        p.in.x = len > 1 ? x / len : x;
        p.in.y = len > 1 ? y / len : y;
        p.in.b0 = !!m.b?.[0];
        p.in.b1 = !!m.b?.[1];
        break;
      }
      case 'cfg':
        if (captain && this.phase === 'lobby' && this.rows.some((r) => r.k === m.k && r.k !== 'game' && r.k !== 'gfx')) this.change(m.k, m.d);
        break;
      case 'start':
        if (captain && this.phase === 'lobby') this.start();
        break;
      case 'again':
        if (captain && this.phase === 'over') this.start();
        break;
      case 'lobby':
        if (captain && this.phase !== 'lobby') this.o.onLobby();
        break;
    }
  }

  start() {
    if (!this.canStart()) return;
    audio.initAudio();
    this.o.onStart();
  }

  // Tell every phone what to show. `extra(p)` adds per-player fields.
  changed() {
    const cap = this.captainPid();
    const rows = this.rows.filter((r) => r.k !== 'game' && r.k !== 'gfx').map((r) => ({ k: r.k, label: r.label, value: r.options[r.i].label }));
    for (const p of this.connected()) {
      this.sendTo(p.pid, {
        t: 'state',
        game: this.o.game,
        phase: this.phase,
        captain: p.pid === cap,
        canStart: this.canStart(),
        color: this.o.colors[p.slot],
        role: this.o.roleNames?.[p.slot] || '',
        rows,
        buttons: this.o.buttons,
        hud: typeof this.hud === 'function' ? this.hud(p) : this.hud,
        over: this.over && (typeof this.over === 'function' ? this.over(p) : this.over),
      });
    }
    this.render();
    this.o.onChanged?.();
  }

  setPhase(phase) {
    this.phase = phase;
    $('lobby').classList.toggle('hidden', phase !== 'lobby');
    if (phase !== 'over') $('results').classList.add('hidden');
    if (phase === 'lobby') {
      $('banner').classList.add('hidden');
      this.over = null;
      if (this.o.lobbyMusic) audio.startMusic(this.o.lobbyMusic);
    }
    this.changed();
  }

  showResults(title, color, bodyHtml) {
    $('resultsTitle').textContent = title;
    $('resultsTitle').style.color = color || '';
    $('resultsBody').innerHTML = bodyHtml;
    $('results').classList.remove('hidden');
    $('banner').classList.add('hidden');
  }

  fx(p, k) {
    if (p && !p.kb) this.sendTo(p.pid, { t: 'fx', k });
  }

  // ---------------------------------------------------------------- overlays
  toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  banner(big, small = '', color = '#fff', dur = 1.4) {
    const b = $('banner');
    $('bannerBig').textContent = big;
    $('bannerBig').style.color = color;
    $('bannerSmall').textContent = small;
    $('bannerBig').style.animation = 'none';
    void $('bannerBig').offsetWidth;
    $('bannerBig').style.animation = '';
    b.classList.remove('hidden');
    clearTimeout(this.bannerTimer);
    if (dur) this.bannerTimer = setTimeout(() => b.classList.add('hidden'), dur * 1000);
  }

  async updateJoinInfo() {
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
    const pad = GAMES.find((g) => g.id === this.o.game).pad;
    $('qr').src = `/api/qr?u=${encodeURIComponent(`${base}${pad}?room=${this.roomCode}`)}`;
    $('joinUrl').textContent = `${base.replace(/^https?:\/\//, '')}${pad}`;
    $('roomCode').textContent = this.roomCode;
  }

  // ---------------------------------------------------------------- keyboard / remote
  bindInput() {
    const enableSound = () => {
      audio.initAudio();
      if (this.phase === 'lobby' && this.o.lobbyMusic) audio.startMusic(this.o.lobbyMusic);
      setTimeout(() => audio.audioReady() && $('soundHint').classList.add('hidden'), 200);
    };
    window.addEventListener('pointerdown', enableSound);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('keydown', (e) => {
      enableSound();
      this.keys.add(e.code);
      const n = this.rows.length; // rows, then Start
      if (this.phase === 'lobby') {
        if (e.code === 'ArrowUp') this.focus = (this.focus + n) % (n + 1);
        else if (e.code === 'ArrowDown') this.focus = (this.focus + 1) % (n + 1);
        else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && this.focus < n) return this.change(this.rows[this.focus].k, e.code === 'ArrowLeft' ? -1 : 1);
        else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
          if (this.focus === n) this.start();
          else this.change(this.rows[this.focus].k, 1);
          return;
        } else if (e.code === 'KeyK') {
          const kb = this.players.get('kb');
          if (kb?.connected) kb.connected = false;
          else {
            this.addPlayer('kb', 'Keyboard', true);
            audio.sfx('join');
          }
        } else return;
        e.preventDefault();
        this.changed();
      } else if (this.phase === 'over') {
        if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') this.start();
      } else if (e.code === 'Escape' || e.code === 'Backspace') {
        this.o.onLobby();
      }
    });
  }

  // Keyboard player's joystick + buttons, read every frame.
  readKeyboard() {
    const kb = this.players.get('kb');
    if (!kb?.connected) return;
    const k = this.keys;
    const x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    const y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    const len = Math.hypot(x, y) || 1;
    kb.in.x = x / len;
    kb.in.y = y / len;
    kb.in.b0 = k.has('Space');
    kb.in.b1 = k.has('KeyX') || k.has('ShiftLeft');
  }

  frame(dt) {
    this.readKeyboard();
    this.net.frame(dt);
  }
}
