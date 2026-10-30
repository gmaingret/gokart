import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRelay } from '../src/relay.js';

class FakeWs extends EventEmitter {
  constructor() {
    super();
    this.readyState = 1;
    this.sent = [];
  }
  send(s) {
    this.sent.push(JSON.parse(s));
  }
  close() {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    this.emit('close');
  }
  msg(o) {
    this.emit('message', Buffer.from(JSON.stringify(o)));
  }
  last(t) {
    return [...this.sent].reverse().find((m) => !t || m.t === t);
  }
}

function setup() {
  const relay = createRelay();
  const tv = new FakeWs();
  relay.attach(tv);
  tv.msg({ t: 'host' });
  const code = tv.last('room').code;
  const join = (cid, name, c = code) => {
    const ws = new FakeWs();
    relay.attach(ws);
    ws.msg({ t: 'join', code: c, cid, name });
    return ws;
  };
  return { relay, tv, code, join };
}

test('host gets a 4-letter room code', () => {
  const { code } = setup();
  assert.match(code, /^[A-Z]{4}$/);
});

test('phones join, and messages flow both ways', () => {
  const { tv, join } = setup();
  const a = join('a', 'Alice');
  const b = join('b', 'Bob');
  assert.equal(a.last('joined').pid, 1);
  assert.equal(b.last('joined').pid, 2);
  assert.deepEqual(tv.last('join'), { t: 'join', pid: 2, name: 'Bob', re: false });

  a.msg({ t: 'in', s: 0.5 });
  assert.deepEqual(tv.last('from'), { t: 'from', pid: 1, m: { t: 'in', s: 0.5 } });

  tv.msg({ t: 'to', pid: 2, m: { t: 'fx', k: 'hit' } });
  assert.deepEqual(b.last(), { t: 'fx', k: 'hit' });
  assert.notDeepEqual(a.last(), { t: 'fx', k: 'hit' });

  tv.msg({ t: 'to', pid: '*', m: { t: 'lobby' } });
  assert.equal(a.last().t, 'lobby');
  assert.equal(b.last().t, 'lobby');
});

test('joining without a code picks the only live room', () => {
  const { join } = setup();
  const a = join('a', 'Alice', '');
  assert.equal(a.last().t, 'joined');
});

test('unknown room code is rejected', () => {
  const { join } = setup();
  const a = join('a', 'Alice', 'ZZZZ');
  assert.equal(a.last().t, 'error');
});

test('a phone reconnecting with the same cid keeps its pid', () => {
  const { tv, join } = setup();
  const a = join('same', 'Alice');
  a.close();
  assert.deepEqual(tv.last(), { t: 'leave', pid: 1 });
  const a2 = join('same', 'Alice');
  assert.equal(a2.last('joined').pid, 1);
  assert.equal(tv.last('join').re, true);
});

test('names are sanitised and truncated', () => {
  const { tv, join } = setup();
  join('x', '<b>Évelyne the Great</b>');
  assert.equal(tv.last('join').name, 'bÉvelyne the');
});

test('a reloaded TV reclaims its room and phones are told', () => {
  const { relay, tv, code, join } = setup();
  const a = join('a', 'Alice');
  tv.close();
  assert.equal(a.last().t, 'hostgone');
  const tv2 = new FakeWs();
  relay.attach(tv2);
  tv2.msg({ t: 'host', code });
  assert.equal(tv2.last('room').code, code);
  assert.equal(tv2.last('join').pid, 1);
  assert.equal(a.last().t, 'hostback');
});

test('rooms are per game: a phone without a code finds the TV of its own game', () => {
  const relay = createRelay();
  const kartTv = new FakeWs();
  const hockeyTv = new FakeWs();
  relay.attach(kartTv);
  relay.attach(hockeyTv);
  kartTv.msg({ t: 'host' });
  hockeyTv.msg({ t: 'host', game: 'hockey' });
  const kartCode = kartTv.last('room').code;
  const hockeyCode = hockeyTv.last('room').code;
  const phone = (game, code = '') => {
    const ws = new FakeWs();
    relay.attach(ws);
    ws.msg({ t: 'join', code, cid: Math.random().toString(36), name: 'P', game });
    return ws;
  };
  assert.equal(phone('hockey').last('joined').code, hockeyCode);
  assert.equal(phone(undefined).last('joined').code, kartCode);
  // A code for the other game is refused rather than joining the wrong TV.
  assert.equal(phone('hockey', kartCode).last().t, 'error');
});

test('a phone following a game switch waits for a live TV instead of a closed room', () => {
  const relay = createRelay();
  const tv = new FakeWs();
  relay.attach(tv);
  tv.msg({ t: 'host' });
  tv.close(); // the TV left (its room lingers for a while)
  const ws = new FakeWs();
  relay.attach(ws);
  ws.msg({ t: 'join', code: '', cid: 'x', name: 'P', live: true });
  assert.equal(ws.last().t, 'error');
});
