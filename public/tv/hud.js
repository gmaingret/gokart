import { ITEMS, ordinal } from '../shared/config.js';
import { ITEM_TYPES } from './items.js';

// Split-screen rectangles (top-left origin, CSS pixels).
export function layout(count, W, H) {
  const grid = (cols, rows) => {
    const out = [];
    const w = W / cols, h = H / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: c * w, y: r * h, w, h });
    return out;
  };
  if (count <= 1) return [{ x: 0, y: 0, w: W, h: H }];
  if (count === 2) return grid(1, 2);
  if (count <= 4) return grid(2, 2);
  if (count <= 6) return grid(3, 2);
  return grid(4, 2);
}

const PLACE_COLORS = ['#ffd700', '#d9d9d9', '#e0904a', '#7fd3ff', '#9fe870', '#ff9ad5', '#c8a2ff', '#ffffff'];

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

function outlined(g, text, x, y, size, fill, align = 'left') {
  g.font = `900 ${size}px system-ui, "Segoe UI", sans-serif`;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(3, size / 7);
  g.strokeStyle = 'rgba(0,0,0,0.8)';
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

export function drawViewportHud(g, r, k, race, time) {
  const s = Math.min(r.w, r.h * 1.6) / 900; // scale factor
  const pad = 18 * s + 6;
  g.save();
  g.beginPath();
  g.rect(r.x, r.y, r.w, r.h);
  g.clip();

  // Speed lines while boosting.
  if (k.boost > 0 || k.star > 0) {
    const cx = r.x + r.w / 2, cy = r.y + r.h * 0.55;
    const rad = Math.hypot(r.w, r.h) / 2;
    g.strokeStyle = k.star > 0 ? `hsla(${(time * 400) % 360},100%,75%,0.35)` : 'rgba(255,255,255,0.32)';
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = rad * (0.55 + Math.random() * 0.25), r1 = r0 + rad * (0.2 + Math.random() * 0.3);
      g.lineWidth = 1 + Math.random() * 3;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.7);
      g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.7);
      g.stroke();
    }
  }
  // Red vignette while spinning out.
  if (k.spin > 0) {
    const grd = g.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.3, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.7);
    grd.addColorStop(0, 'rgba(255,0,0,0)');
    grd.addColorStop(1, `rgba(255,30,30,${Math.min(0.45, k.spin * 0.5)})`);
    g.fillStyle = grd;
    g.fillRect(r.x, r.y, r.w, r.h);
  }

  // Lap + timer, top-left.
  const lap = Math.min(race.laps, Math.max(1, k.lap));
  outlined(g, `LAP ${lap}/${race.laps}`, r.x + pad, r.y + pad + 40 * s, 40 * s + 8, '#fff');
  const t = k.finished ? k.finishTime : race.phase === 'race' ? race.clock : 0;
  outlined(g, fmtTime(t), r.x + pad, r.y + pad + 80 * s + 8, 28 * s + 6, '#ffe66d');
  outlined(g, k.name, r.x + pad, r.y + pad + 115 * s + 12, 22 * s + 6, k.driver.color);

  // Item box, top-center.
  const bs = 90 * s + 30;
  const bx = r.x + r.w / 2 - bs / 2, by = r.y + pad;
  const boxGrad = g.createLinearGradient(bx, by, bx, by + bs);
  boxGrad.addColorStop(0, 'rgba(40,40,80,0.75)');
  boxGrad.addColorStop(1, 'rgba(10,10,30,0.75)');
  g.fillStyle = boxGrad;
  g.lineWidth = 4;
  g.strokeStyle = k.roulette > 0 ? `hsl(${(time * 600) % 360},100%,65%)` : 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.roundRect(bx, by, bs, bs, bs * 0.22);
  g.fill();
  g.stroke();
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.beginPath();
  g.roundRect(bx + 5, by + 5, bs - 10, bs - 10, bs * 0.18);
  g.stroke();
  let icon = null;
  if (k.roulette > 0) icon = ITEMS[ITEM_TYPES[Math.floor(time * 14) % ITEM_TYPES.length]].icon;
  else if (k.item) icon = ITEMS[k.item].icon;
  if (icon) {
    g.font = `${bs * 0.62}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.fillText(icon, bx + bs / 2, by + bs / 2 + 2);
    if (k.item === 'triple' && k.roulette <= 0) outlined(g, `×${k.itemCount}`, bx + bs - 4, by + bs - 6, 22 * s + 6, '#fff', 'right');
  }

  // Place, bottom-right.
  if (race.phase !== 'countdown') {
    const place = k.place;
    const txt = ordinal(place);
    const size = 110 * s + 24;
    // Pop when the position changes.
    if (k.hudPlace !== place) {
      k.hudPlace = place;
      k.hudPop = time;
    }
    const pop = 1 + Math.max(0, 0.35 - (time - (k.hudPop || 0))) * 1.2;
    const x = r.x + r.w - pad, y = r.y + r.h - pad;
    g.save();
    g.translate(x, y);
    g.scale(pop, pop);
    const base = PLACE_COLORS[place - 1] || '#ffffff';
    const grad = g.createLinearGradient(0, -size, 0, 0);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, base);
    grad.addColorStop(1, base);
    outlined(g, txt, 0, 0, size, grad, 'right');
    g.restore();
  }

  // Drift charge / boost meter, bottom-left.
  if (k.drifting) {
    const tier = k.driftTier();
    const label = ['', 'MINI-TURBO', 'SUPER', 'ULTRA'][tier + 1];
    if (label) outlined(g, label, r.x + r.w / 2, r.y + r.h - pad, 34 * s + 10, ['#3fa9ff', '#ff9a1f', '#ff3fd2'][tier], 'center');
  }

  if (k.wrongWay > 1.2 && !k.finished) {
    if (Math.floor(time * 3) % 2 === 0) outlined(g, 'WRONG WAY!', r.x + r.w / 2, r.y + r.h / 2, 60 * s + 14, '#ff4040', 'center');
  }
  if (race.flash.get(k) && race.flash.get(k).until > time) {
    outlined(g, race.flash.get(k).text, r.x + r.w / 2, r.y + r.h * 0.38, 70 * s + 16, race.flash.get(k).color, 'center');
  }
  if (k.finished) {
    outlined(g, 'FINISH!', r.x + r.w / 2, r.y + r.h * 0.45, 100 * s + 20, '#fff', 'center');
    outlined(g, `${ordinal(k.place)} place`, r.x + r.w / 2, r.y + r.h * 0.45 + 70 * s + 24, 50 * s + 12, PLACE_COLORS[k.place - 1] || '#fff', 'center');
  }
  g.restore();

  // Viewport separator.
  g.strokeStyle = 'rgba(0,0,0,0.9)';
  g.lineWidth = 4;
  g.strokeRect(r.x, r.y, r.w, r.h);
}

export function drawMinimap(g, r, track, karts) {
  const cl = track.cl;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < cl.n; i++) {
    minX = Math.min(minX, cl.px[i]); maxX = Math.max(maxX, cl.px[i]);
    minZ = Math.min(minZ, cl.pz[i]); maxZ = Math.max(maxZ, cl.pz[i]);
  }
  const sc = Math.min(r.w / (maxX - minX), r.h / (maxZ - minZ)) * 0.9;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const mx = (minX + maxX) / 2, mz = (minZ + maxZ) / 2;
  // Mirror x so the map matches the view from above with the camera's right = -x.
  const P = (x, z) => [cx - (x - mx) * sc, cy - (z - mz) * sc];
  g.save();
  g.lineJoin = g.lineCap = 'round';
  for (const [w, c] of [[Math.max(8, 16 * sc), 'rgba(0,0,0,0.55)'], [Math.max(4, 9 * sc), 'rgba(255,255,255,0.85)']]) {
    g.beginPath();
    for (let i = 0; i <= cl.n; i += 2) {
      const [x, y] = P(cl.px[i % cl.n], cl.pz[i % cl.n]);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.lineWidth = w;
    g.strokeStyle = c;
    g.stroke();
  }
  const [sx, sy] = P(cl.px[0], cl.pz[0]);
  g.fillStyle = '#111';
  g.fillRect(sx - 5, sy - 5, 10, 10);
  const dot = Math.max(5, Math.min(r.w, r.h) / 32);
  for (const k of [...karts].sort((a, b) => b.place - a.place)) {
    const [x, y] = P(k.x, k.z);
    g.beginPath();
    g.arc(x, y, k.human ? dot : dot * 0.75, 0, Math.PI * 2);
    g.fillStyle = k.driver.color;
    g.fill();
    g.lineWidth = k.human ? 3 : 1.5;
    g.strokeStyle = k.human ? '#fff' : '#000';
    g.stroke();
  }
  g.restore();
}

export function drawStandings(g, r, order) {
  const rowH = Math.min(46, (r.h - 20) / 8);
  g.save();
  order.forEach((k, i) => {
    const y = r.y + 10 + i * rowH;
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(r.x + 10, y, r.w - 20, rowH - 4);
    g.fillStyle = k.driver.color;
    g.fillRect(r.x + 10, y, 8, rowH - 4);
    outlined(g, `${i + 1}. ${k.name}`, r.x + 28, y + rowH * 0.7, rowH * 0.55, k.human ? '#fff' : '#ccc');
  });
  g.restore();
}

export function drawCountdown(g, W, H, value, t = 0) {
  if (value > 3) return;
  const txt = value > 0 ? String(value) : 'GO!';
  const color = ['#3dff6e', '#ffe14d', '#ffa64d', '#ff4d4d'][Math.max(0, Math.min(3, value))];
  // Each number punches in big and settles; GO! grows and fades.
  const f = value > 0 ? t % 1 : t;
  const scale = value > 0 ? 1 + Math.max(0, f - 0.75) * 2.4 : 1 + f * 0.6;
  g.save();
  g.globalAlpha = value > 0 ? 1 : Math.max(0, 1 - f);
  g.translate(W / 2, H / 2);
  g.scale(scale, scale);
  outlined(g, txt, 0, Math.min(W, H) * 0.08, Math.min(W, H) * 0.25, color, 'center');
  g.restore();
}
