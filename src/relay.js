// Room-based message relay between one TV host and many phone controllers.
//
// Protocol (JSON text frames):
//   TV    -> server  {t:'host', code?, game?}    create a room (or reclaim `code` after a reload)
//   server-> TV      {t:'room', code}
//   phone -> server  {t:'join', code?, cid, name, game?} join a room; `cid` is a stable per-phone id
//                    (`game` defaults to 'kart'; without a code, the only live room of that game is picked;
//                    `live: true` refuses a room whose TV is offline)
//   server-> phone   {t:'joined', code, pid} | {t:'error', msg}
//   server-> TV      {t:'join', pid, name, re} | {t:'leave', pid} | {t:'from', pid, m}
//   TV    -> server  {t:'to', pid, m}            pid may be '*' for every phone
//   server-> phone   m (the TV's payload, verbatim) | {t:'hostgone'} | {t:'hostback'}
//   phone -> server  anything else is wrapped and forwarded to the TV as {t:'from'}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_PLAYERS = 16;
const HOST_GRACE_MS = 60_000;

const gameOf = (g) => (typeof g === 'string' && /^[a-z]{1,12}$/.test(g) ? g : 'kart');

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj));
}

export function createRelay({ random = Math.random } = {}) {
  const rooms = new Map();

  function newCode() {
    for (;;) {
      let c = '';
      for (let i = 0; i < 4; i++) c += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
      if (!rooms.has(c)) return c;
    }
  }

  function closeRoom(room) {
    for (const p of room.players.values()) {
      send(p.ws, { t: 'error', msg: 'The TV closed the game.' });
      p.ws?.close();
    }
    rooms.delete(room.code);
  }

  function onHost(ws, msg) {
    let room = msg.code && rooms.get(String(msg.code).toUpperCase());
    if (room && room.host && room.host.readyState === 1) room = null; // in use by another TV
    if (room) {
      clearTimeout(room.hostTimer);
      room.host = ws;
      room.game = gameOf(msg.game);
      send(ws, { t: 'room', code: room.code });
      for (const [pid, p] of room.players) {
        if (!p.ws) continue;
        send(ws, { t: 'join', pid, name: p.name, re: true });
        send(p.ws, { t: 'hostback' });
      }
    } else {
      room = { code: newCode(), game: gameOf(msg.game), host: ws, players: new Map(), byCid: new Map(), nextPid: 1, hostTimer: null };
      rooms.set(room.code, room);
      send(ws, { t: 'room', code: room.code });
    }
    ws.role = 'host';
    ws.room = room;
  }

  function onJoin(ws, msg) {
    let code = msg.code ? String(msg.code).toUpperCase().trim() : '';
    const game = gameOf(msg.game);
    const title = { hockey: 'Air Hockey', sumo: 'Ice Sumo', cook: 'Kitchen Rush' }[game] || 'GoKart';
    if (!code) {
      // No code typed: pick the only room of this game whose TV is online (rooms
      // whose TV just closed linger for HOST_GRACE_MS and shouldn't block this).
      const mine = [...rooms.values()].filter((r) => r.game === game);
      const live = mine.filter((r) => r.host && r.host.readyState === 1);
      if (live.length === 1) code = live[0].code;
      // A TV that's reloading comes back to its room, so a lone dead room is a
      // good guess, unless the phone asked for a live one (following a game switch).
      else if (live.length === 0 && mine.length === 1 && !msg.live) code = mine[0].code;
      else if (live.length > 1) {
        send(ws, { t: 'error', msg: `Several TVs are running ${title} — enter the room code shown on yours.` });
        return;
      }
    }
    const room = rooms.get(code);
    if (!room) {
      send(ws, { t: 'error', msg: code ? `No game with code ${code}.` : `No game found. Open ${title} on the TV first.` });
      return;
    }
    if (room.game !== game) {
      send(ws, { t: 'error', msg: `Code ${code} is for a different game on the TV.` });
      return;
    }
    const cid = String(msg.cid || '').slice(0, 64) || Math.random().toString(36).slice(2);
    const name = String(msg.name || 'Player').replace(/[^\p{L}\p{N} _.!-]/gu, '').slice(0, 12) || 'Player';
    let pid = room.byCid.get(cid);
    const re = pid !== undefined;
    if (re) {
      const old = room.players.get(pid);
      if (old.ws && old.ws !== ws) {
        old.ws.room = null;
        old.ws.close();
      }
      old.ws = ws;
      old.name = name;
    } else {
      if (room.players.size >= MAX_PLAYERS) {
        send(ws, { t: 'error', msg: 'This game is full.' });
        return;
      }
      pid = room.nextPid++;
      room.byCid.set(cid, pid);
      room.players.set(pid, { ws, cid, name });
    }
    ws.role = 'player';
    ws.room = room;
    ws.pid = pid;
    send(ws, { t: 'joined', code: room.code, pid });
    send(room.host, { t: 'join', pid, name, re });
    if (!room.host || room.host.readyState !== 1) send(ws, { t: 'hostgone' });
  }

  function onMessage(ws, data) {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;

    if (!ws.role) {
      if (msg.t === 'host') onHost(ws, msg);
      else if (msg.t === 'join') onJoin(ws, msg);
      return;
    }
    const room = ws.room;
    if (!room) return;

    if (ws.role === 'host') {
      if (msg.t !== 'to') return;
      const payload = JSON.stringify(msg.m);
      if (msg.pid === '*') {
        for (const p of room.players.values()) send(p.ws, payload);
      } else {
        send(room.players.get(msg.pid)?.ws, payload);
      }
    } else {
      send(room.host, { t: 'from', pid: ws.pid, m: msg });
    }
  }

  function onClose(ws) {
    const room = ws.room;
    if (!room) return;
    if (ws.role === 'host' && room.host === ws) {
      room.host = null;
      for (const p of room.players.values()) send(p.ws, { t: 'hostgone' });
      room.hostTimer = setTimeout(() => closeRoom(room), HOST_GRACE_MS);
      room.hostTimer.unref?.();
    } else if (ws.role === 'player') {
      const p = room.players.get(ws.pid);
      if (p && p.ws === ws) {
        p.ws = null;
        send(room.host, { t: 'leave', pid: ws.pid });
      }
    }
  }

  return {
    attach(ws) {
      ws.isAlive = true;
      ws.on('pong', (data) => {
        ws.isAlive = true;
        // Our measuring pings carry their send time (keep-alive pings don't).
        const sent = Number(data?.toString());
        if (sent > 0) ws.lat = Date.now() - sent;
      });
      ws.on('message', (d) => onMessage(ws, d.toString()));
      ws.on('close', () => onClose(ws));
      ws.on('error', () => {});
    },
    // Ping every TV and phone, and tell each TV the latest times (in ms) for
    // itself and its phones, so it can show which leg of the trip is slow.
    measure() {
      const ping = (ws) => {
        if (ws?.readyState === 1) ws.ping(String(Date.now()));
      };
      for (const room of rooms.values()) {
        if (!room.host || room.host.readyState !== 1) continue;
        const p = {};
        for (const [pid, pl] of room.players) {
          if (pl.ws?.lat !== undefined) p[pid] = pl.ws.lat;
          ping(pl.ws);
        }
        send(room.host, { t: 'lat', tv: room.host.lat ?? null, p });
        ping(room.host);
      }
    },
    roomCodes: () => [...rooms.keys()],
    _rooms: rooms,
  };
}
