// Food and plate icons drawn on canvases (no emoji fonts needed on the TV).
// iconCanvas(sig) returns a 128px canvas; sig is 'tomato:raw', 'meat:cooked',
// 'plate:bun+meat', etc. Results are cached.

const cache = new Map();

function tomato(g, s, chopped) {
  if (chopped) {
    for (const [x, y, r] of [[-0.18, 0.05, 0.2], [0.18, 0.08, 0.2], [0, -0.16, 0.2]]) {
      g.fillStyle = '#e53935';
      g.beginPath();
      g.arc(s * (0.5 + x), s * (0.5 + y), s * r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ff8a80';
      g.beginPath();
      g.arc(s * (0.5 + x), s * (0.5 + y), s * r * 0.7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffe082';
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(s * (0.5 + x + Math.cos(k * 2.1) * r * 0.4), s * (0.5 + y + Math.sin(k * 2.1) * r * 0.4), s * 0.025, 0, Math.PI * 2);
        g.fill();
      }
    }
    return;
  }
  const grd = g.createRadialGradient(s * 0.4, s * 0.4, s * 0.05, s * 0.5, s * 0.55, s * 0.4);
  grd.addColorStop(0, '#ff8a80');
  grd.addColorStop(1, '#c62828');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(s * 0.5, s * 0.56, s * 0.38, s * 0.33, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2e7d32';
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    g.beginPath();
    g.ellipse(s * 0.5 + Math.cos(a) * s * 0.08, s * 0.26 + Math.sin(a) * s * 0.04, s * 0.09, s * 0.03, a, 0, Math.PI * 2);
    g.fill();
  }
}

function lettuce(g, s, chopped) {
  if (chopped) {
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4, r = 0.08 + (k % 3) * 0.08;
      g.fillStyle = k % 2 ? '#7cb342' : '#aed581';
      g.beginPath();
      g.ellipse(s * (0.5 + Math.cos(a) * r), s * (0.5 + Math.sin(a) * r), s * 0.13, s * 0.06, a, 0, Math.PI * 2);
      g.fill();
    }
    return;
  }
  for (let k = 7; k >= 0; k--) {
    const a = (k / 8) * Math.PI * 2;
    g.fillStyle = k % 2 ? '#558b2f' : '#7cb342';
    g.beginPath();
    g.ellipse(s * 0.5 + Math.cos(a) * s * 0.14, s * 0.52 + Math.sin(a) * s * 0.12, s * 0.24, s * 0.18, a, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#c5e1a5';
  g.beginPath();
  g.arc(s * 0.5, s * 0.52, s * 0.14, 0, Math.PI * 2);
  g.fill();
}

function bun(g, s) {
  g.fillStyle = '#d68a3c';
  g.beginPath();
  g.ellipse(s * 0.5, s * 0.66, s * 0.38, s * 0.12, 0, 0, Math.PI * 2);
  g.fill();
  const grd = g.createLinearGradient(0, s * 0.25, 0, s * 0.6);
  grd.addColorStop(0, '#f6b860');
  grd.addColorStop(1, '#c97a2c');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(s * 0.5, s * 0.55, s * 0.38, s * 0.28, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = '#fff6d6';
  for (let k = 0; k < 7; k++) {
    g.beginPath();
    g.ellipse(s * (0.3 + k * 0.07), s * (0.4 + (k % 2) * 0.06), s * 0.022, s * 0.012, 0.6, 0, Math.PI * 2);
    g.fill();
  }
}

function meat(g, s, state) {
  if (state === 'raw') {
    g.fillStyle = '#d84343';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.52, s * 0.38, s * 0.28, -0.3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffe0e0';
    g.lineWidth = s * 0.05;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.52, s * 0.3, s * 0.2, -0.3, 0.3, 2.4);
    g.stroke();
    return;
  }
  const col = { chopped: ['#f28b8b', '#d65f5f'], cooked: ['#8d5a33', '#5d3a1e'], burnt: ['#2b2422', '#0f0c0b'] }[state];
  const grd = g.createRadialGradient(s * 0.45, s * 0.45, s * 0.05, s * 0.5, s * 0.5, s * 0.36);
  grd.addColorStop(0, col[0]);
  grd.addColorStop(1, col[1]);
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(s * 0.5, s * 0.52, s * 0.36, s * 0.3, 0, 0, Math.PI * 2);
  g.fill();
  if (state === 'cooked') {
    g.strokeStyle = '#3e2512';
    g.lineWidth = s * 0.035;
    for (const o of [-0.12, 0, 0.12]) {
      g.beginPath();
      g.moveTo(s * (0.3 + o), s * 0.36);
      g.lineTo(s * (0.55 + o), s * 0.68);
      g.stroke();
    }
  }
}

function food(g, s, kind, state) {
  if (kind === 'tomato') tomato(g, s, state === 'chopped');
  else if (kind === 'lettuce') lettuce(g, s, state === 'chopped');
  else if (kind === 'bun') bun(g, s);
  else if (kind === 'meat') meat(g, s, state);
}

const READY = { tomato: 'chopped', lettuce: 'chopped', bun: 'raw', meat: 'cooked' };

export function iconCanvas(sig, size = 128) {
  const key = `${sig}@${size}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const [kind, rest = ''] = sig.split(':');
  if (kind === 'plate') {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(size * 0.5, size * 0.56, size * 0.46, size * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fafafa';
    g.beginPath();
    g.ellipse(size * 0.5, size * 0.5, size * 0.46, size * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#d6dde6';
    g.lineWidth = size * 0.04;
    g.beginPath();
    g.ellipse(size * 0.5, size * 0.5, size * 0.33, size * 0.29, 0, 0, Math.PI * 2);
    g.stroke();
    const items = rest ? rest.split('+') : [];
    const spots = items.length === 1 ? [[0.5, 0.5]] : items.length === 2 ? [[0.36, 0.5], [0.64, 0.5]] : [[0.5, 0.33], [0.33, 0.62], [0.67, 0.62]];
    items.forEach((it, i) => {
      g.save();
      const sz = size * (items.length === 1 ? 0.62 : 0.42);
      g.translate(size * spots[i][0] - sz / 2, size * spots[i][1] - sz / 2);
      food(g, sz, it, READY[it]);
      g.restore();
    });
  } else {
    food(g, size, kind, rest || 'raw');
  }
  cache.set(key, c);
  return c;
}

export const sigOf = (item) => (item.type === 'plate' ? `plate:${item.contents.join('+')}` : `${item.kind}:${item.state}`);
