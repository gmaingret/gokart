// GoKart server: serves the TV page and the phone controller page, and relays
// messages between them over WebSocket. The TV browser runs the actual game
// simulation; this server only routes controller input to the TV and TV state
// back to each phone.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import { createRelay } from './src/relay.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
// Address phones should use, e.g. http://192.168.1.42:8080. Needed when running
// in Docker, where the server only sees the container's internal IP.
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const PUBLIC_DIR = path.join(__dirname, 'public');
const THREE_DIR = path.join(__dirname, 'node_modules', 'three', 'build');
const THREE_ADDONS_DIR = path.join(__dirname, 'node_modules', 'three', 'examples', 'jsm');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

export function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      out.push({ name, address: a.address });
    }
  }
  // Prefer typical home-network ranges over docker/VPN bridges.
  const score = (ip) =>
    ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : ip.startsWith('172.') ? 2 : 3;
  out.sort((a, b) => score(a.address) - score(b.address));
  return out;
}

function sendFile(res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'content-length': st.size,
      'cache-control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  });
}

// Resolve a URL path inside a root directory, refusing traversal.
function safeJoin(root, urlPath) {
  const p = path.normalize(path.join(root, decodeURIComponent(urlPath)));
  return p.startsWith(root + path.sep) || p === root ? p : null;
}

const relay = createRelay();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (p === '/' || p === '/tv' || p === '/tv/') return sendFile(res, path.join(PUBLIC_DIR, 'tv', 'index.html'));
  if (p === '/play' || p === '/play/' || p === '/p') return sendFile(res, path.join(PUBLIC_DIR, 'controller', 'index.html'));

  if (p === '/api/info') {
    const body = JSON.stringify({ port: PORT, publicUrl: PUBLIC_URL || null, addresses: lanAddresses(), rooms: relay.roomCodes() });
    res.writeHead(200, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
    return res.end(body);
  }

  if (p === '/api/qr') {
    const text = url.searchParams.get('u') || '';
    if (!text || text.length > 300) {
      res.writeHead(400);
      return res.end();
    }
    try {
      const svg = await QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
      res.writeHead(200, { 'content-type': MIME['.svg'], 'cache-control': 'no-store' });
      return res.end(svg);
    } catch {
      res.writeHead(500);
      return res.end();
    }
  }

  if (p.startsWith('/vendor/three-addons/')) {
    const f = safeJoin(THREE_ADDONS_DIR, p.slice('/vendor/three-addons/'.length));
    return f ? sendFile(res, f) : (res.writeHead(403), res.end());
  }
  if (p.startsWith('/vendor/three/')) {
    const f = safeJoin(THREE_DIR, p.slice('/vendor/three/'.length));
    return f ? sendFile(res, f) : (res.writeHead(403), res.end());
  }

  const f = safeJoin(PUBLIC_DIR, p);
  if (!f) {
    res.writeHead(403);
    return res.end();
  }
  sendFile(res, f);
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
wss.on('connection', (ws) => relay.attach(ws));

// Keep-alive so dead phones (screen locked, Wi-Fi dropped) are noticed.
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 5000).unref();

server.listen(PORT, '0.0.0.0', () => {
  const addrs = lanAddresses();
  const base = PUBLIC_URL || `http://${addrs[0]?.address || 'localhost'}:${PORT}`;
  console.log('\n  GoKart is running!\n');
  console.log(`  TV  : open  ${base}/   in the TV browser`);
  console.log(`  Phone: open ${base}/play  (or scan the QR code on the TV)\n`);
  if (!PUBLIC_URL && addrs.length > 1) {
    console.log('  Other addresses: ' + addrs.slice(1).map((a) => `${a.address} (${a.name})`).join(', ') + '\n');
  }
});
