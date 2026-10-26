import * as THREE from 'three';

export const ROAD_HALF = 9; // drivable asphalt half-width (m)
export const CURB = 1.4; // curb width beyond the asphalt
export const WALL = 16; // distance from centerline to the barrier
const SPACING = 2; // metres between centerline samples

// Control points are [x, z] in metres. Racing direction follows the array order.
export const TRACKS = [
  {
    name: 'Sunny Circuit',
    points: [
      [0, -150], [90, -150], [150, -110], [160, -30], [115, 20], [130, 90], [80, 140], [0, 125],
      [-60, 150], [-130, 120], [-150, 40], [-105, -20], [-150, -90], [-100, -150],
    ],
    theme: {
      sky: { top: 0x3d8fe0, horizon: 0xbfe6ff, bottom: 0x8fc77a, sunDir: [0.5, 0.55, 0.25], clouds: 22 },
      fog: [0xbfe6ff, 220, 900], ground: 0x58b04a, ground2: 0x86c95a, offroad: 0x6fae45, groundTex: 'grass',
      road: '#4d5057', wallA: 0xf4f4f4, wallB: 0xe53935, curbA: 0xffffff, curbB: 0xe53935,
      banner: ['#e53935', '#ffffff', '#1e88e5', '#ffcf33'],
      hemi: [0xdff1ff, 0x4a7a3a, 1.0], sun: [0xfff4e0, 2.4], deco: 'tree', mountains: 0x5f8f6a, snowcaps: true,
      hills: 22, weather: 'pollen', dust: 0x9a7a4a,
    },
    boxes: [0.16, 0.42, 0.7], pads: [0.3, 0.57, 0.88],
  },
  {
    name: 'Dune Dash',
    points: [
      [0, -200], [120, -195], [185, -135], [145, -70], [50, -60], [25, 0], [100, 45], [190, 60],
      [205, 150], [120, 205], [-20, 195], [-60, 120], [-140, 145], [-205, 85], [-185, -40], [-120, -150],
    ],
    theme: {
      sky: { top: 0x3f86d6, horizon: 0xffe2b0, bottom: 0xe3c07a, sunDir: [-0.4, 0.35, 0.5], sunColor: 0xffe0a0, sunSize: 1.6, clouds: 6 },
      fog: [0xffe2b0, 220, 950], ground: 0xe6c27c, ground2: 0xd4a862, offroad: 0xd9ad5f, groundTex: 'sand',
      road: '#6e6152', wallA: 0xffffff, wallB: 0x1e88e5, curbA: 0xffffff, curbB: 0x1e88e5,
      banner: ['#1e88e5', '#ffffff', '#ff8a1e', '#2bb673'],
      hemi: [0xfff1d6, 0x9c7a4a, 1.05], sun: [0xffe9c4, 2.6], deco: 'cactus', mountains: 0xc98f4e,
      hills: 16, weather: 'sand', dust: 0xe8c588,
    },
    boxes: [0.12, 0.37, 0.62, 0.86], pads: [0.24, 0.5, 0.78],
  },
  {
    name: 'Frosty Peaks',
    points: [
      [0, -120], [100, -140], [170, -80], [145, 0], [65, 15], [55, 75], [130, 110], [105, 175],
      [0, 165], [-50, 95], [-120, 145], [-185, 65], [-145, -30], [-175, -100], [-90, -150],
    ],
    theme: {
      sky: { top: 0x5d9be0, horizon: 0xe6f2ff, bottom: 0xffffff, sunDir: [0.3, 0.3, -0.6], sunColor: 0xfff4e6, clouds: 26, cloudColor: 0xf4f8ff },
      fog: [0xe6f2ff, 160, 760], ground: 0xf4f8fc, ground2: 0xd8e6f4, offroad: 0xe3edf7, groundTex: 'snow',
      road: '#56606e', wallA: 0x1565c0, wallB: 0xffffff, curbA: 0x1565c0, curbB: 0xffffff,
      banner: ['#1565c0', '#ffffff', '#e53935', '#7fd3ff'],
      hemi: [0xffffff, 0x9fb7d6, 1.1], sun: [0xffffff, 1.9], deco: 'pine', mountains: 0xb9c9dc, snowcaps: true,
      hills: 38, weather: 'snow', dust: 0xffffff,
    },
    boxes: [0.14, 0.4, 0.66, 0.9], pads: [0.27, 0.53, 0.8],
  },
  {
    name: 'Neon Night',
    points: [
      [-160, -60], [-60, -165], [60, -165], [165, -60], [165, 40], [95, 60], [70, 120], [150, 145],
      [140, 205], [50, 225], [-60, 150], [-95, 65], [-175, 45],
    ],
    theme: {
      sky: { top: 0x05020f, horizon: 0x3a0f5c, bottom: 0x0b0620, sunDir: [0.2, 0.25, -0.8], sunColor: 0xff2bd6, sunSize: 6, stars: true },
      fog: [0x1a0830, 140, 640], ground: 0x0e0822, ground2: 0x160c34, offroad: 0x1d1240, groundTex: 'grid',
      road: '#221c36', wallA: 0x00e5ff, wallB: 0xff2bd6, curbA: 0x00e5ff, curbB: 0xff2bd6,
      banner: ['#00e5ff', '#ff2bd6', '#7d4dff', '#ffe14d'],
      hemi: [0x8a7dff, 0x200a40, 0.65], sun: [0xb3a6ff, 0.7], deco: 'pillar', mountains: 0x2a1a5a,
      hills: 6, weather: 'motes', dust: 0x7d4dff, night: true, lamps: true, skyline: true,
    },
    boxes: [0.15, 0.4, 0.65, 0.88], pads: [0.25, 0.52, 0.76],
  },
  {
    name: 'Autumn Woods',
    points: [
      [0, -170], [110, -175], [175, -120], [150, -50], [80, -40], [60, 20], [130, 60], [170, 130],
      [110, 185], [20, 160], [-40, 190], [-120, 170], [-170, 100], [-130, 30], [-180, -50], [-110, -130],
    ],
    theme: {
      sky: { top: 0x4f86c6, horizon: 0xffd7a8, bottom: 0xc4872f, sunDir: [0.6, 0.3, 0.2], sunColor: 0xffd0a0, sunSize: 1.4, clouds: 16, cloudColor: 0xfff0e0 },
      fog: [0xffe0bc, 200, 850], ground: 0x9c7a2f, ground2: 0xc4872f, offroad: 0xa8762c, groundTex: 'grass',
      road: '#4a4a4f', wallA: 0xffffff, wallB: 0xe67e22, curbA: 0xffffff, curbB: 0xe67e22,
      banner: ['#d35400', '#ffffff', '#7b3f00', '#f1c40f'],
      hemi: [0xfff0d8, 0x6b4a2a, 1.0], sun: [0xffe2b0, 2.3], deco: 'autumn', mountains: 0x8a6a4a,
      hills: 26, weather: 'leaves', dust: 0x9a7a4a,
    },
    boxes: [0.15, 0.4, 0.65, 0.88], pads: [0.27, 0.52, 0.78],
  },
  {
    name: 'Beach Bay',
    points: [
      [-200, -40], [-150, -140], [-40, -170], [60, -130], [150, -160], [210, -80], [200, 30], [130, 60],
      [150, 140], [60, 190], [-60, 160], [-120, 80], [-190, 60],
    ],
    theme: {
      sky: { top: 0x2e9bea, horizon: 0xc8f1ff, bottom: 0x1fa3c9, sunDir: [0.3, 0.6, 0.4], clouds: 14 },
      fog: [0xc8f1ff, 240, 950], ground: 0xf2dca0, ground2: 0xe8cc88, offroad: 0xead39a, groundTex: 'sand',
      road: '#5b6068', wallA: 0xffffff, wallB: 0x00b4d8, curbA: 0xffffff, curbB: 0x00b4d8,
      banner: ['#00b4d8', '#ffffff', '#ff6b6b', '#ffd166'],
      hemi: [0xffffff, 0xb59b6a, 1.1], sun: [0xfff6e0, 2.6], deco: 'beach', mountains: 0x5fa86a,
      hills: -14, water: 0x1fa3c9, dust: 0xf2dca0,
    },
    boxes: [0.13, 0.38, 0.63, 0.87], pads: [0.25, 0.5, 0.75],
  },
  {
    name: 'Lava Castle',
    points: [
      [0, -160], [80, -160], [130, -110], [110, -50], [160, 0], [150, 90], [80, 130], [20, 90],
      [-40, 140], [-120, 130], [-160, 60], [-110, 0], [-160, -70], [-90, -140],
    ],
    theme: {
      sky: { top: 0x1a0505, horizon: 0x8a2a10, bottom: 0x2a0a05, sunDir: [0.2, 0.2, -0.8], sunColor: 0xff5a1f, sunSize: 4 },
      fog: [0x3a120a, 140, 640], ground: 0x2a2224, ground2: 0x3a2a26, offroad: 0x3a2c28, groundTex: 'rock',
      road: '#2e2a2c', wallA: 0x1a1a1a, wallB: 0xff4d00, curbA: 0xff4d00, curbB: 0x1a1a1a,
      banner: ['#ff4d00', '#1a1a1a', '#ffb000', '#ffffff'],
      hemi: [0xff9a6a, 0x2a0a05, 0.85], sun: [0xff8a50, 1.7], deco: 'lava', mountains: 0x3a1a14,
      hills: 40, weather: 'embers', dust: 0x555555, glowCurbs: true,
    },
    boxes: [0.15, 0.4, 0.65, 0.88], pads: [0.27, 0.53, 0.8],
  },
  {
    name: 'Candy Land',
    points: [
      [-180, 0], [-150, -110], [-60, -150], [20, -90], [80, -160], [170, -120], [180, -20], [120, 30],
      [180, 110], [110, 180], [20, 140], [-60, 190], [-140, 130],
    ],
    theme: {
      sky: { top: 0x9fd3ff, horizon: 0xffe0f0, bottom: 0xffb3d9, sunDir: [0.4, 0.5, 0.3], sunColor: 0xfff0f8, clouds: 24, cloudColor: 0xfff4fb },
      fog: [0xffe0f0, 200, 850], ground: 0xffb3d9, ground2: 0xffd1e8, offroad: 0xffc4e1, groundTex: 'grass',
      road: '#5a3a2a', wallA: 0xffffff, wallB: 0xff6fb5, curbA: 0xffffff, curbB: 0xff6fb5,
      banner: ['#ff6fb5', '#ffffff', '#7fdbff', '#b784ff'],
      hemi: [0xffffff, 0xd08ab0, 1.15], sun: [0xfff0f8, 2.2], deco: 'candy', mountains: 0xffc4e1, snowcaps: true,
      hills: 18, weather: 'sprinkles', dust: 0xffd1e8,
    },
    boxes: [0.14, 0.39, 0.64, 0.88], pads: [0.26, 0.51, 0.77],
  },
  {
    name: 'Jungle Ruins',
    points: [
      [0, -190], [120, -170], [190, -90], [140, -20], [190, 60], [140, 150], [50, 150], [-10, 90],
      [-80, 150], [-150, 150], [-200, 60], [-140, -20], [-190, -110], [-100, -170],
    ],
    theme: {
      sky: { top: 0x5fa0d0, horizon: 0xd9f2d0, bottom: 0x2f7a2f, sunDir: [0.3, 0.7, 0.2], clouds: 18 },
      fog: [0xcfe8c8, 120, 600], ground: 0x2f7a2f, ground2: 0x4f9a3a, offroad: 0x5a7a2a, groundTex: 'grass',
      road: '#5a4a3a', wallA: 0x8d6e63, wallB: 0x2e7d32, curbA: 0xffcf33, curbB: 0x2e7d32,
      banner: ['#2e7d32', '#ffcf33', '#8d6e63', '#ffffff'],
      hemi: [0xe8ffe0, 0x2a4a1a, 1.0], sun: [0xfff6d0, 2.0], deco: 'jungle', mountains: 0x3f6f3f,
      hills: 30, weather: 'pollen', dust: 0x6a5a3a,
    },
    boxes: [0.13, 0.38, 0.63, 0.87], pads: [0.25, 0.5, 0.76],
  },
  {
    name: 'Cosmic Way',
    points: [
      [-170, -120], [-40, -190], [90, -150], [60, -70], [150, -40], [200, 60], [120, 150], [0, 180],
      [-60, 100], [-140, 160], [-210, 70], [-150, -10],
    ],
    theme: {
      sky: { top: 0x02010a, horizon: 0x1a1050, bottom: 0x050318, sunDir: [-0.3, 0.3, 0.7], sunColor: 0x7d4dff, sunSize: 8, stars: true },
      fog: [0x0d0828, 160, 700], ground: 0x0b0a20, ground2: 0x14123a, offroad: 0x1a1640, groundTex: 'grid',
      road: '#1a1a3a', wallA: 0x7d4dff, wallB: 0x00e5ff, curbA: 0x7d4dff, curbB: 0x00e5ff,
      banner: ['#7d4dff', '#00e5ff', '#ff2bd6', '#ffffff'],
      hemi: [0x9a8aff, 0x100830, 0.7], sun: [0xb3a6ff, 0.7], deco: 'crystal', mountains: 0x2a1f6a,
      hills: 20, weather: 'motes', dust: 0x7d4dff, night: true, lamps: true, rainbowRoad: true,
    },
    boxes: [0.15, 0.4, 0.65, 0.88], pads: [0.25, 0.52, 0.76],
  },
];

// Seeded PRNG so decorations are identical every time a track loads.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pure geometry of a track: sampled centerline plus spatial queries. No THREE
// objects, so it can be unit-tested in Node.
export function buildCenterline(def) {
  const curve = new THREE.CatmullRomCurve3(
    def.points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    'centripetal'
  );
  const length = curve.getLength();
  const n = Math.max(64, Math.round(length / SPACING));
  const pts = curve.getSpacedPoints(n).slice(0, n);
  const px = new Float32Array(n), pz = new Float32Array(n);
  const tx = new Float32Array(n), tz = new Float32Array(n);
  const nx = new Float32Array(n), nz = new Float32Array(n);
  pts.forEach((p, i) => ((px[i] = p.x), (pz[i] = p.z)));
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = (i + 1) % n;
    let dx = px[b] - px[a], dz = pz[b] - pz[a];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    tx[i] = dx; tz[i] = dz;
    // "Left" normal when looking along the tangent (y up).
    nx[i] = dz; nz[i] = -dx;
  }
  const seg = length / n;

  const wrap = (i) => ((i % n) + n) % n;

  // Find nearest centerline position. `hint` is the previous index (or -1).
  function locate(x, z, hint = -1) {
    let best = -1, bestD = Infinity;
    const scan = (i) => {
      const dx = x - px[i], dz = z - pz[i];
      const d = dx * dx + dz * dz;
      if (d < bestD) ((bestD = d), (best = i));
    };
    if (hint < 0) for (let i = 0; i < n; i++) scan(i);
    else for (let k = -24; k <= 24; k++) scan(wrap(hint + k));
    // If the local search ended far away (teleport, respawn), do a full scan.
    if (hint >= 0 && bestD > WALL * WALL * 2.2) for (let i = 0; i < n; i++) scan(i);
    // Project onto the segment ahead or behind for a fractional index.
    const i = best, j = wrap(i + 1);
    const sx = px[j] - px[i], sz = pz[j] - pz[i];
    let f = ((x - px[i]) * sx + (z - pz[i]) * sz) / (sx * sx + sz * sz || 1);
    let idx = i;
    if (f < 0) {
      const h = wrap(i - 1);
      const qx = px[i] - px[h], qz = pz[i] - pz[h];
      const g = ((x - px[h]) * qx + (z - pz[h]) * qz) / (qx * qx + qz * qz || 1);
      idx = h; f = Math.min(1, Math.max(0, g));
    } else f = Math.min(1, f);
    const lateral = (x - px[i]) * nx[i] + (z - pz[i]) * nz[i];
    return { idx, f, lateral, i };
  }

  // Point on the centerline at fractional index `s` offset sideways by `lat`.
  function pointAt(s, lat = 0) {
    const i0 = Math.floor(s), f = s - i0;
    const i = wrap(i0), j = wrap(i0 + 1);
    const x = px[i] + (px[j] - px[i]) * f + nx[i] * lat;
    const z = pz[i] + (pz[j] - pz[i]) * f + nz[i] * lat;
    return { x, z, tx: tx[i], tz: tz[i], heading: Math.atan2(tx[i], tz[i]) };
  }

  // Minimum distance between centerline samples that are far apart along the
  // track. Used to verify that a layout never overlaps itself.
  function minSelfDistance() {
    let min = Infinity;
    const skip = Math.ceil((WALL * 3) / seg);
    for (let i = 0; i < n; i += 2) {
      for (let j = i + skip; j < n; j += 2) {
        if (n - (j - i) < skip) continue;
        const d = Math.hypot(px[i] - px[j], pz[i] - pz[j]);
        if (d < min) min = d;
      }
    }
    return min;
  }

  return { n, length, seg, px, pz, tx, tz, nx, nz, wrap, locate, pointAt, minSelfDistance };
}

export function canvasTexture(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------- noise
function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, seed, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += valueNoise(x * f, y * f, seed + i) * a;
    a *= 0.5;
    f *= 2.03;
  }
  return s;
}
export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Distance from any point to the centerline (capped), via a coarse grid.
function distanceField(cl) {
  const CELL = 32;
  const grid = new Map();
  for (let i = 0; i < cl.n; i++) {
    const key = `${Math.floor(cl.px[i] / CELL)},${Math.floor(cl.pz[i] / CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  }
  return (x, z, cap = 100) => {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    let best = cap * cap;
    const r = Math.ceil(cap / CELL);
    for (let a = -r; a <= r; a++)
      for (let b = -r; b <= r; b++) {
        const list = grid.get(`${cx + a},${cz + b}`);
        if (!list) continue;
        for (const i of list) {
          const dx = x - cl.px[i], dz = z - cl.pz[i];
          const d = dx * dx + dz * dz;
          if (d < best) best = d;
        }
      }
    return Math.sqrt(best);
  };
}

// ---------------------------------------------------------------- textures
export function roadTexture(base, night, rainbow = false) {
  return canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const r = rng(7);
    // aggregate speckle
    for (let i = 0; i < 9000; i++) {
      const v = r();
      g.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.16})` : `rgba(0,0,0,${(0.5 - v) * 0.22})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    // worn racing lines
    for (const cx of [0.3, 0.7]) {
      const grd = g.createLinearGradient(cx * w - 26, 0, cx * w + 26, 0);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.5, 'rgba(0,0,0,0.16)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(cx * w - 26, 0, 52, h);
    }
    // patches
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.06})`;
      g.fillRect(r() * w, r() * h, 20 + r() * 50, 30 + r() * 80);
    }
    if (rainbow) {
      const grd = g.createLinearGradient(0, 0, w, 0);
      ['#ff2b2b', '#ff9f1c', '#ffe14d', '#3dff6e', '#00e5ff', '#7d4dff', '#ff2bd6'].forEach((c, i, a) => grd.addColorStop(i / (a.length - 1), c));
      g.globalAlpha = 0.45;
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 1;
    }
    g.fillStyle = night ? '#ffe36e' : 'rgba(255,255,255,0.92)';
    g.fillRect(8, 0, 7, h);
    g.fillRect(w - 15, 0, 7, h);
    g.fillStyle = night ? 'rgba(255,227,110,0.85)' : 'rgba(255,255,255,0.7)';
    g.fillRect(w / 2 - 3, 0, 6, h * 0.42);
  });
}

export function groundTexture(kind) {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(kind.length * 31);
    if (kind === 'grid') {
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#7d4dff';
      g.lineWidth = 3;
      g.strokeRect(0, 0, w, h);
      g.strokeStyle = 'rgba(0,229,255,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(w / 2, 0); g.lineTo(w / 2, h);
      g.moveTo(0, h / 2); g.lineTo(w, h / 2);
      g.stroke();
      return;
    }
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    const n = kind === 'grass' ? 7000 : 4000;
    for (let i = 0; i < n; i++) {
      const v = r();
      if (kind === 'grass') {
        g.strokeStyle = `rgba(${v > 0.5 ? '255,255,200' : '0,40,0'},${0.08 + r() * 0.14})`;
        const x = r() * w, y = r() * h;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 5);
        g.stroke();
      } else if (kind === 'sand') {
        g.fillStyle = `rgba(${v > 0.5 ? '255,255,255' : '120,80,30'},${0.06 + r() * 0.1})`;
        g.fillRect(r() * w, r() * h, 2, 2);
      } else if (kind === 'rock') {
        g.fillStyle = v > 0.97 ? `rgba(255,${90 + r() * 80},0,0.9)` : `rgba(${v > 0.5 ? '255,255,255' : '0,0,0'},${0.05 + r() * 0.12})`;
        g.fillRect(r() * w, r() * h, 1 + r() * 4, 1 + r() * 4);
      } else {
        g.fillStyle = `rgba(${v > 0.6 ? '255,255,255' : '150,180,220'},${0.06 + r() * 0.12})`;
        g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3);
      }
    }
    if (kind === 'sand') {
      // wind ripples
      g.strokeStyle = 'rgba(140,90,30,0.12)';
      g.lineWidth = 2;
      for (let y = 0; y < h; y += 14) {
        g.beginPath();
        for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x / 20 + y) * 4);
        g.stroke();
      }
    }
  });
}

export function checkerTexture(cells = 8) {
  return canvasTexture(256, 64, (g, w, h) => {
    const s = w / (cells * 2);
    for (let y = 0; y < h / s; y++)
      for (let x = 0; x < w / s; x++) {
        g.fillStyle = (x + y) % 2 ? '#111' : '#fff';
        g.fillRect(x * s, y * s, s, s);
      }
  });
}

const BANNER_WORDS = ['GOKART', 'TURBO', 'ZOOM!', 'DRIFT', '★★★', 'GO GO', 'NITRO', 'VROOM'];
export function bannerTexture(colors) {
  return canvasTexture(1024, 64, (g, w, h) => {
    const panel = w / 4;
    for (let i = 0; i < 4; i++) {
      const bg = colors[i % colors.length];
      g.fillStyle = bg;
      g.fillRect(i * panel, 0, panel, h);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(i * panel, h - 6, panel, 6);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(i * panel, 0, panel, 4);
      const light = ['#ffffff', '#ffe14d', '#7fd3ff'].includes(bg.toLowerCase());
      g.font = 'italic 900 40px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = light ? '#1b1b2f' : '#ffffff';
      g.fillText(BANNER_WORDS[(i * 3) % BANNER_WORDS.length], i * panel + panel / 2, h / 2 + 2);
    }
  });
}

export function glowTexture() {
  return canvasTexture(128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  }, false);
}

// ---------------------------------------------------------------- geometry helpers
// Strip of quads following the centerline from lateral offset a to b.
function ribbon(cl, a, b, y, colorFn, uvScale = 0) {
  const { n, px, pz, nx, nz } = cl;
  const pos = [], col = [], uv = [];
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const quad = [
      [i, a], [i, b], [j, b],
      [i, a], [j, b], [j, a],
    ];
    if (colorFn) colorFn(i, c);
    for (const [k, l] of quad) {
      pos.push(px[k] + nx[k] * l, y, pz[k] + nz[k] * l);
      if (colorFn) col.push(c.r, c.g, c.b);
      if (uvScale) uv.push(l === a ? 0 : 1, ((k === j && j === 0 ? n : k) * cl.seg) / uvScale);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (uvScale) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// Barrier with a banner texture on both faces and a rounded top rail.
function barrier(cl, lat, height, group, bannerMat, railMat) {
  // Mirror the texture on the right-hand barrier so its text reads correctly from the road.
  const dir = lat < 0 ? -1 : 1;
  const { n, px, pz, nx, nz, seg } = cl;
  const pos = [], uv = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = px[i] + nx[i] * lat, az = pz[i] + nz[i] * lat;
    const bx = px[j] + nx[j] * lat, bz = pz[j] + nz[j] * lat;
    const u0 = (dir * i * seg) / 24, u1 = (dir * (i + 1) * seg) / 24;
    pos.push(ax, 0, az, bx, 0, bz, bx, height, bz, ax, 0, az, bx, height, bz, ax, height, az);
    uv.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  group.add(new THREE.Mesh(g, bannerMat));
  // Top rail as a tube along the barrier.
  const pts = [];
  for (let i = 0; i <= n; i += 2) {
    const k = i % n;
    pts.push(new THREE.Vector3(px[k] + nx[k] * lat, height + 0.12, pz[k] + nz[k] * lat));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.floor(n / 2), 0.18, 6, true), railMat));
}

export function instanced(geo, mat, transforms) {
  const inst = new THREE.InstancedMesh(geo, mat, Math.max(1, transforms.length));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  transforms.forEach(([x, y, z, sc, rot, sy], k) => {
    q.setFromAxisAngle(up, rot || 0);
    m.compose(p.set(x, y, z), q, s.set(sc, sy ?? sc, sc));
    inst.setMatrixAt(k, m);
  });
  inst.count = transforms.length;
  return inst;
}

// Sea around low-lying tracks (terrain dips below it away from the road).
export function waterPlane(theme, cx, cz) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: theme.water, emissive: theme.water, emissiveIntensity: 0.25, transparent: true, opacity: 0.88 })
  );
  m.position.set(cx, -1.4, cz);
  return m;
}

// ---------------------------------------------------------------- scenery
export function scenery(cl, theme, group, seed, heightAt, distAt, avoid) {
  const r = rng(seed);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < cl.n; i++) {
    minX = Math.min(minX, cl.px[i]); maxX = Math.max(maxX, cl.px[i]);
    minZ = Math.min(minZ, cl.pz[i]); maxZ = Math.max(maxZ, cl.pz[i]);
  }
  const pad = 140;
  const spots = [];
  for (let tries = 0; tries < 5000 && spots.length < 420; tries++) {
    const x = minX - pad + r() * (maxX - minX + pad * 2);
    const z = minZ - pad + r() * (maxZ - minZ + pad * 2);
    const d = distAt(x, z, 60);
    if (d < WALL + 6) continue;
    if (avoid.some(([ax, az, ar]) => (x - ax) ** 2 + (z - az) ** 2 < ar * ar)) continue;
    // Denser near the track so the drive feels lush.
    if (d > 45 && r() < 0.5) continue;
    const y = heightAt(x, z);
    if (theme.water && y < -1) continue; // nothing growing under the sea
    spots.push([x, y, z, 0.7 + r() * 0.8, r() * Math.PI * 2]);
  }

  const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
  const flat = (color) => lam(color, { flatShading: true });
  const split = (k) => spots.filter((_, i) => i % 3 === k);
  const add = (geo, mat, list) => group.add(instanced(geo, mat, list));
  const A = split(0), B = split(1), C = split(2);

  switch (theme.deco) {
    case 'tree': {
      // Round trees
      add(new THREE.CylinderGeometry(0.45, 0.7, 3.2, 7).translate(0, 1.6, 0), lam(0x7a4a24), A);
      add(new THREE.IcosahedronGeometry(3, 1).translate(0, 5.2, 0), flat(0x2e8b3d), A);
      add(new THREE.IcosahedronGeometry(2, 1).translate(1.2, 6.8, 0.4), flat(0x3fa34d), A);
      // Poplars
      add(new THREE.CylinderGeometry(0.3, 0.4, 2, 6).translate(0, 1, 0), lam(0x6a4020), B);
      add(new THREE.SphereGeometry(1.6, 8, 8).scale(1, 2.6, 1).translate(0, 5.5, 0), flat(0x3c9a3c), B);
      // Bushes with flowers
      add(new THREE.IcosahedronGeometry(1.4, 1).scale(1.4, 0.8, 1.2).translate(0, 0.6, 0), flat(0x4caf50), C);
      add(new THREE.IcosahedronGeometry(0.28, 0).translate(0.6, 1.3, 0.3), lam(0xff6fb5), C);
      add(new THREE.IcosahedronGeometry(0.25, 0).translate(-0.7, 1.1, -0.2), lam(0xffe14d), C);
      break;
    }
    case 'cactus': {
      const cm = flat(0x3f8f3f);
      add(new THREE.CylinderGeometry(0.8, 0.9, 6, 8).translate(0, 3, 0), cm, A);
      add(new THREE.CylinderGeometry(0.5, 0.5, 2.6, 6).rotateZ(Math.PI / 2).translate(1.4, 3, 0), cm, A);
      add(new THREE.CylinderGeometry(0.45, 0.45, 2.2, 6).translate(2.6, 4, 0), cm, A);
      add(new THREE.SphereGeometry(0.8, 8, 6).translate(0, 6, 0), cm, A);
      // Sandstone rocks
      add(new THREE.DodecahedronGeometry(2.2, 0).scale(1.3, 0.8, 1).translate(0, 0.8, 0), flat(0xc0814a), B);
      // Palms
      add(new THREE.CylinderGeometry(0.3, 0.45, 7, 6).translate(0, 3.5, 0), lam(0x8a6a3a), C);
      for (let k = 0; k < 5; k++) {
        const leaf = new THREE.ConeGeometry(0.6, 4, 4).rotateZ(Math.PI / 2.4).translate(1.8, 6.8, 0).rotateY((k / 5) * Math.PI * 2);
        add(leaf, flat(0x2f9e44), C);
      }
      // Distant pyramids
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const pyr = [];
      for (let k = 0; k < 3; k++) {
        const a = 0.6 + k * 0.35;
        pyr.push([cx + Math.cos(a) * (420 + k * 40), 0, cz + Math.sin(a) * (420 + k * 40), 60 - k * 12, Math.PI / 4]);
      }
      add(new THREE.ConeGeometry(1.3, 1.3, 4).translate(0, 0.65, 0), flat(0xd9a75a), pyr);
      break;
    }
    case 'pine': {
      add(new THREE.CylinderGeometry(0.4, 0.5, 2, 6).translate(0, 1, 0), lam(0x5d3a1a), [...A, ...B]);
      add(new THREE.ConeGeometry(3.2, 5, 8).translate(0, 4, 0), flat(0x1f5f3f), [...A, ...B]);
      add(new THREE.ConeGeometry(2.3, 4, 8).translate(0, 6.6, 0), flat(0x24704a), [...A, ...B]);
      add(new THREE.ConeGeometry(1.3, 2.4, 8).translate(0, 8.8, 0), flat(0xffffff), [...A, ...B]);
      // Snowmen
      const sm = lam(0xffffff);
      add(new THREE.SphereGeometry(1.1, 12, 10).translate(0, 1, 0), sm, C);
      add(new THREE.SphereGeometry(0.8, 12, 10).translate(0, 2.5, 0), sm, C);
      add(new THREE.SphereGeometry(0.55, 12, 10).translate(0, 3.6, 0), sm, C);
      add(new THREE.ConeGeometry(0.12, 0.6, 6).rotateX(Math.PI / 2).translate(0, 3.6, 0.75), lam(0xff7a1f), C);
      add(new THREE.CylinderGeometry(0.4, 0.45, 0.6, 10).translate(0, 4.2, 0), lam(0x222222), C);
      break;
    }
    case 'autumn': {
      add(new THREE.CylinderGeometry(0.45, 0.7, 3.2, 7).translate(0, 1.6, 0), lam(0x5d3a1a), [...A, ...B, ...C]);
      add(new THREE.IcosahedronGeometry(3, 1).translate(0, 5.2, 0), flat(0xe67e22), A);
      add(new THREE.IcosahedronGeometry(3, 1).translate(0, 5.2, 0), flat(0xc0392b), B);
      add(new THREE.IcosahedronGeometry(3, 1).translate(0, 5.2, 0), flat(0xf1c40f), C);
      add(new THREE.IcosahedronGeometry(2, 1).translate(1.2, 6.8, 0.4), flat(0xd35400), A);
      // Pumpkins and leaf piles
      add(new THREE.SphereGeometry(0.6, 10, 8).scale(1.2, 0.85, 1.2).translate(2.5, 0.5, 1.5), lam(0xff7a1f), B);
      add(new THREE.SphereGeometry(1.4, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.4, 0.5, 1.2).translate(-2.2, 0, -1), flat(0xb5651d), C);
      break;
    }
    case 'beach': {
      const palm = [...A, ...B];
      add(new THREE.CylinderGeometry(0.3, 0.45, 7, 6).translate(0, 3.5, 0).rotateZ(0.12), lam(0x9a7a4a), palm);
      for (let k = 0; k < 6; k++) {
        const leaf = new THREE.ConeGeometry(0.6, 4.2, 4).rotateZ(Math.PI / 2.3).translate(2.2, 6.8, 0).rotateY((k / 6) * Math.PI * 2);
        add(leaf, flat(0x2fae4f), palm);
      }
      add(new THREE.SphereGeometry(0.35, 8, 6).translate(0.6, 6.4, 0.3), lam(0x6b4a2a), palm);
      // Beach umbrellas + towels
      add(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5).translate(0, 1.3, 0), lam(0xffffff), C);
      add(new THREE.ConeGeometry(1.8, 0.7, 8, 1, true).translate(0, 2.6, 0), new THREE.MeshLambertMaterial({ color: 0xff6b6b, side: THREE.DoubleSide }), C);
      add(new THREE.BoxGeometry(1, 0.05, 2).translate(1.6, 0.03, 0.5), lam(0xffd166), C);
      break;
    }
    case 'lava': {
      add(new THREE.DodecahedronGeometry(2.4, 0).scale(1.2, 0.9, 1).translate(0, 1, 0), flat(0x2b2326), A);
      add(new THREE.CircleGeometry(3.5, 14).rotateX(-Math.PI / 2).translate(0, 0.15, 0), new THREE.MeshBasicMaterial({ color: 0xff5a00 }), B);
      add(new THREE.CircleGeometry(2.2, 14).rotateX(-Math.PI / 2).translate(0.4, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xffc040 }), B);
      add(new THREE.ConeGeometry(1.1, 6, 5).translate(0, 3, 0), flat(0x3a1f3a), C);
      add(new THREE.ConeGeometry(0.7, 3.6, 5).translate(1.4, 1.8, 0.6), flat(0x4a2a4a), C);
      break;
    }
    case 'candy': {
      const stick = lam(0xffffff);
      add(new THREE.CylinderGeometry(0.15, 0.15, 5, 6).translate(0, 2.5, 0), stick, [...A, ...B]);
      add(new THREE.CylinderGeometry(1.8, 1.8, 0.4, 20).rotateX(Math.PI / 2).translate(0, 5.6, 0), lam(0xff6fb5), A);
      add(new THREE.CylinderGeometry(1.8, 1.8, 0.4, 20).rotateX(Math.PI / 2).translate(0, 5.6, 0), lam(0x7fdbff), B);
      add(new THREE.TorusGeometry(1.1, 0.12, 6, 20).translate(0, 5.6, 0.22), lam(0xffffff), [...A, ...B]);
      // Gumdrops
      const gum = new THREE.SphereGeometry(1.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.3, 1);
      add(gum, lam(0xb784ff), C.filter((_, i) => i % 3 === 0));
      add(gum, lam(0x7dff6e), C.filter((_, i) => i % 3 === 1));
      add(gum, lam(0xffcf33), C.filter((_, i) => i % 3 === 2));
      break;
    }
    case 'jungle': {
      add(new THREE.CylinderGeometry(0.6, 1.0, 9, 8).translate(0, 4.5, 0), lam(0x5a3d22), A);
      add(new THREE.IcosahedronGeometry(4.5, 1).scale(1.3, 0.55, 1.3).translate(0, 9.5, 0), flat(0x1f6a2a), A);
      for (let k = 0; k < 5; k++) {
        const frond = new THREE.ConeGeometry(0.5, 3, 3).rotateZ(Math.PI / 2.8).translate(1.4, 0.8, 0).rotateY((k / 5) * Math.PI * 2);
        add(frond, flat(0x3f9a3a), B);
      }
      // Mossy ruins
      const stone = flat(0x8a8f7a);
      add(new THREE.BoxGeometry(3, 2, 3).translate(0, 1, 0), stone, C);
      add(new THREE.BoxGeometry(2, 1.6, 2).translate(0.3, 2.8, 0.2), stone, C);
      add(new THREE.BoxGeometry(1.2, 4, 1.2).translate(-2.6, 2, 1.2), stone, C);
      add(new THREE.BoxGeometry(3.1, 0.3, 3.1).translate(0, 2.05, 0), flat(0x4f8a3a), C);
      break;
    }
    case 'crystal': {
      const cry = new THREE.OctahedronGeometry(1.4, 0).scale(0.7, 2.6, 0.7).translate(0, 3, 0);
      add(cry, new THREE.MeshBasicMaterial({ color: 0x00e5ff }), A);
      add(cry.clone().rotateZ(0.4).translate(1.4, -0.6, 0), new THREE.MeshBasicMaterial({ color: 0x7d4dff }), A);
      add(cry, new THREE.MeshBasicMaterial({ color: 0xff2bd6 }), B);
      add(new THREE.DodecahedronGeometry(2.2, 0).translate(0, 9, 0), flat(0x3a3550), C);
      add(new THREE.TorusGeometry(3.2, 0.12, 6, 30).rotateX(1.2).translate(0, 9, 0), new THREE.MeshBasicMaterial({ color: 0xffe14d }), C);
      break;
    }
    case 'pillar': {
      add(new THREE.BoxGeometry(1.4, 12, 1.4).translate(0, 6, 0), lam(0x1a1838), A);
      add(new THREE.BoxGeometry(1.6, 0.5, 1.6).translate(0, 12, 0), new THREE.MeshBasicMaterial({ color: 0xff2bd6 }), A);
      add(new THREE.BoxGeometry(1.6, 0.35, 1.6).translate(0, 6, 0), new THREE.MeshBasicMaterial({ color: 0x00e5ff }), A);
      // Floating glow cubes
      add(new THREE.BoxGeometry(1.4, 1.4, 1.4).rotateX(0.6).rotateZ(0.6).translate(0, 4, 0), new THREE.MeshBasicMaterial({ color: 0x7d4dff }), B);
      // Neon palms
      add(new THREE.CylinderGeometry(0.25, 0.35, 7, 6).translate(0, 3.5, 0), new THREE.MeshBasicMaterial({ color: 0xff2bd6 }), C);
      for (let k = 0; k < 5; k++) {
        const leaf = new THREE.ConeGeometry(0.4, 3.6, 4).rotateZ(Math.PI / 2.3).translate(1.6, 6.8, 0).rotateY((k / 5) * Math.PI * 2);
        add(leaf, new THREE.MeshBasicMaterial({ color: 0x00e5ff }), C);
      }
      break;
    }
  }

  // Distant ring: mountains, or a city skyline at night.
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  if (theme.skyline) {
    const winTex = canvasTexture(64, 128, (g, w, h) => {
      g.fillStyle = '#0d0a1e';
      g.fillRect(0, 0, w, h);
      for (let y = 4; y < h; y += 10)
        for (let x = 4; x < w; x += 10) {
          if (Math.random() < 0.45) continue;
          g.fillStyle = ['#ffd56b', '#00e5ff', '#ff2bd6', '#ffffff'][Math.floor(Math.random() * 4)];
          g.fillRect(x, y, 5, 6);
        }
    });
    const towers = [];
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * Math.PI * 2 + r() * 0.05;
      const rad = 520 + r() * 120;
      towers.push([cx + Math.cos(a) * rad, 0, cz + Math.sin(a) * rad, 30 + r() * 30, -a, 60 + r() * 160]);
    }
    const tg = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    group.add(instanced(tg, new THREE.MeshBasicMaterial({ map: winTex, fog: false }), towers));
  } else {
    const ring = [], caps = [];
    for (let k = 0; k < 30; k++) {
      const a = (k / 30) * Math.PI * 2 + r() * 0.1;
      const rad = 600 + r() * 120;
      const h = 90 + r() * 140, w = 110 + r() * 90;
      ring.push([cx + Math.cos(a) * rad, -2, cz + Math.sin(a) * rad, w, r() * 6, h]);
      caps.push([cx + Math.cos(a) * rad, -2 + h * 0.62, cz + Math.sin(a) * rad, w * 0.385, 0, h * 0.385]);
    }
    const mGeo = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0);
    group.add(instanced(mGeo, new THREE.MeshLambertMaterial({ color: theme.mountains, flatShading: true }), ring));
    if (theme.snowcaps) group.add(instanced(mGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), caps));
  }
}

// Trackside dressing: flags, tyre stacks, night lamps and neon arches.
function trackside(cl, theme, group, seed, glowTex) {
  const r = rng(seed + 5);
  const { n, px, pz, nx, nz, tx, tz } = cl;
  const flagPoles = [], flagCloths = [[], [], [], []];
  const step = Math.round(36 / cl.seg);
  for (let i = 0; i < n; i += step) {
    for (const side of [-1, 1]) {
      if (r() < 0.35) continue;
      const lat = side * (WALL + 2.2);
      const x = px[i] + nx[i] * lat, z = pz[i] + nz[i] * lat;
      const rot = Math.atan2(tx[i], tz[i]);
      flagPoles.push([x, 0, z, 1, rot]);
      flagCloths[Math.floor(r() * 4)].push([x, 0, z, 1, rot + (r() - 0.5) * 0.6]);
    }
  }
  group.add(instanced(new THREE.CylinderGeometry(0.08, 0.1, 7, 5).translate(0, 3.5, 0), new THREE.MeshLambertMaterial({ color: 0xdddddd }), flagPoles));
  const flagGeo = new THREE.PlaneGeometry(2.2, 1.4).translate(1.1, 6.2, 0);
  theme.banner.forEach((c, k) => {
    group.add(instanced(flagGeo, new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }), flagCloths[k]));
  });

  // Tyre stacks on the outside of tight corners.
  const tyres = [], stripes = [];
  const look = Math.round(20 / cl.seg);
  for (let i = 0; i < n; i += Math.round(10 / cl.seg)) {
    const a = Math.atan2(tx[(i + look) % n], tz[(i + look) % n]);
    const b = Math.atan2(tx[(i - look + n) % n], tz[(i - look + n) % n]);
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < 0.55) continue;
    // Turning left (d>0) means the outside is the right side (negative lateral).
    const lat = (d > 0 ? -1 : 1) * (WALL + 1.1);
    for (const off of [-1.4, 0, 1.4]) {
      const x = px[i] + nx[i] * lat + tx[i] * off, z = pz[i] + nz[i] * lat + tz[i] * off;
      for (let h = 0; h < 3; h++) (h === 1 ? stripes : tyres).push([x, 0.25 + h * 0.5, z, 1]);
    }
  }
  const tg = new THREE.TorusGeometry(0.55, 0.25, 6, 12).rotateX(Math.PI / 2);
  group.add(instanced(tg, new THREE.MeshLambertMaterial({ color: 0x1d1d1d }), tyres));
  group.add(instanced(tg, new THREE.MeshLambertMaterial({ color: theme.night ? 0xff2bd6 : 0xffffff }), stripes));

  if (theme.lamps) {
    const poles = [], bulbsA = [], bulbsB = [], poolsA = [], poolsB = [];
    for (let i = 0; i < n; i += Math.round(30 / cl.seg)) {
      for (const side of [-1, 1]) {
        const lat = side * (WALL + 0.8);
        const x = px[i] + nx[i] * lat, z = pz[i] + nz[i] * lat;
        poles.push([x, 0, z, 1]);
        const bx = px[i] + nx[i] * side * (WALL - 1.5), bz = pz[i] + nz[i] * side * (WALL - 1.5);
        const lx = px[i] + nx[i] * side * (ROAD_HALF - 2), lz = pz[i] + nz[i] * side * (ROAD_HALF - 2);
        ((i / Math.round(30 / cl.seg)) % 2 ? bulbsA : bulbsB).push([bx, 8.3, bz, 1]);
        ((i / Math.round(30 / cl.seg)) % 2 ? poolsA : poolsB).push([lx, 0.07, lz, 1]);
      }
    }
    group.add(instanced(new THREE.CylinderGeometry(0.12, 0.16, 8.6, 6).translate(0, 4.3, 0), new THREE.MeshLambertMaterial({ color: 0x2a2a3a }), poles));
    const bulbGeo = new THREE.BoxGeometry(2.6, 0.25, 0.6);
    group.add(instanced(bulbGeo, new THREE.MeshBasicMaterial({ color: 0x00e5ff }), bulbsA));
    group.add(instanced(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xff2bd6 }), bulbsB));
    const poolGeo = new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2);
    const poolMat = (c) => new THREE.MeshBasicMaterial({ color: c, map: glowTex, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false });
    group.add(instanced(poolGeo, poolMat(0x00e5ff), poolsA));
    group.add(instanced(poolGeo, poolMat(0xff2bd6), poolsB));

    // Neon arches over the road.
    const arches = [];
    for (let i = Math.round(60 / cl.seg); i < n; i += Math.round(140 / cl.seg)) arches.push(i);
    const archGeo = new THREE.TorusGeometry(ROAD_HALF + 3, 0.35, 8, 40, Math.PI);
    arches.forEach((i, k) => {
      const m = new THREE.Mesh(archGeo, new THREE.MeshBasicMaterial({ color: k % 2 ? 0x00e5ff : 0xff2bd6 }));
      m.position.set(px[i], 0, pz[i]);
      m.rotation.y = Math.atan2(tx[i], tz[i]);
      m.userData.pulse = k;
      group.add(m);
    });
  }
}

// Grandstand with a bobbing crowd next to the start straight.
function grandstandSpot(cl) {
  const i = cl.wrap(cl.n - Math.round(30 / cl.seg));
  const lat = WALL + 9;
  return { i, x: cl.px[i] + cl.nx[i] * lat, z: cl.pz[i] + cl.nz[i] * lat };
}

function grandstand(cl, theme, group) {
  const { i, x, z } = grandstandSpot(cl);
  // Face the track: local +z points toward the road.
  return grandstandAt(group, theme, x, z, Math.atan2(-cl.nx[i], -cl.nz[i]));
}

// Grandstand at (x, z); local +z (the front row) points along `rotY`.
export function grandstandAt(group, theme, x, z, rotY) {
  const stand = new THREE.Group();
  stand.position.set(x, 0, z);
  stand.rotation.y = rotY;
  const L = 44;
  const concrete = new THREE.MeshLambertMaterial({ color: theme.night ? 0x2a2440 : 0xb0b4bc });
  const seatMats = theme.banner.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  for (let t = 0; t < 6; t++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(L, 0.9 + t * 0.9, 1.6), concrete);
    step.position.set(0, (0.9 + t * 0.9) / 2, 4 - t * 1.6);
    stand.add(step);
    const seats = new THREE.Mesh(new THREE.BoxGeometry(L, 0.15, 0.7), seatMats[t % seatMats.length]);
    seats.position.set(0, 0.9 + t * 0.9 + 0.08, 4.3 - t * 1.6);
    stand.add(seats);
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: theme.night ? 0xff2bd6 : 0xffffff, side: THREE.DoubleSide });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(L + 2, 0.3, 11), roofMat);
  roof.position.set(0, 9.6, 0.5);
  roof.rotation.x = -0.1;
  stand.add(roof);
  for (const px of [-L / 2, 0, L / 2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9.6, 6), concrete);
    post.position.set(px, 4.8, -4.6);
    stand.add(post);
  }
  // Crowd
  const people = [];
  const r = rng(99);
  for (let t = 0; t < 6; t++)
    for (let k = 0; k < 34; k++) {
      if (r() < 0.12) continue;
      people.push({ x: -L / 2 + 1 + k * ((L - 2) / 33) + (r() - 0.5) * 0.3, y: 0.9 + t * 0.9 + 0.75, z: 4.1 - t * 1.6, ph: r() * 6, c: r() });
    }
  const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.5, 3, 6);
  const crowd = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), people.length);
  const col = new THREE.Color();
  const shirt = [0xe53935, 0x1e88e5, 0xffcf33, 0x2bb673, 0xff6fb5, 0xffffff, 0x8e44c9, 0xff8a1e];
  people.forEach((p, k) => crowd.setColorAt(k, col.set(shirt[Math.floor(p.c * shirt.length)])));
  stand.add(crowd);
  group.add(stand);
  const m = new THREE.Matrix4();
  return (time, excitement) => {
    for (let k = 0; k < people.length; k++) {
      const p = people[k];
      const jump = Math.max(0, Math.sin(time * (4 + excitement * 6) + p.ph)) * (0.08 + excitement * 0.5);
      m.makeTranslation(p.x, p.y + jump, p.z);
      crowd.setMatrixAt(k, m);
    }
    crowd.instanceMatrix.needsUpdate = true;
  };
}

// Build the full renderable track.
export function buildTrack(index) {
  const def = TRACKS[index % TRACKS.length];
  const theme = def.theme;
  const cl = buildCenterline(def);
  const group = new THREE.Group();
  const distAt = distanceField(cl);
  const seed = index * 97 + 13;
  const hills = theme.hills ?? 15;
  const heightAt = (x, z) => {
    const d = distAt(x, z, 100);
    if (d < WALL + 12) return -0.3;
    const k = smooth(WALL + 12, WALL + 90, d);
    return -0.3 + k * hills * (0.35 + fbm(x / 140, z / 140, seed, 4) * 1.1);
  };

  // Terrain
  const SIZE = 1700, SEG = 150;
  const tGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
  let cx = 0, cz = 0;
  for (let i = 0; i < cl.n; i++) ((cx += cl.px[i]), (cz += cl.pz[i]));
  cx /= cl.n; cz /= cl.n;
  tGeo.translate(cx, 0, cz);
  const tp = tGeo.attributes.position;
  const tcol = new Float32Array(tp.count * 3);
  const g1 = new THREE.Color(theme.ground), g2 = new THREE.Color(theme.ground2 ?? theme.ground), white = new THREE.Color(0xffffff);
  const c = new THREE.Color();
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    const h = heightAt(x, z);
    tp.setY(i, h);
    c.copy(g1).lerp(g2, fbm(x / 40, z / 40, seed + 9, 3));
    if (theme.snowcaps && hills > 0 && h > hills * 0.75) c.lerp(white, Math.min(1, (h - hills * 0.75) / 6));
    tcol[i * 3] = c.r; tcol[i * 3 + 1] = c.g; tcol[i * 3 + 2] = c.b;
  }
  tGeo.setAttribute('color', new THREE.BufferAttribute(tcol, 3));
  tGeo.computeVertexNormals();
  const gTex = groundTexture(theme.groundTex);
  gTex.repeat.set(SIZE / 12, SIZE / 12);
  const terrainMat = theme.groundTex === 'grid'
    ? new THREE.MeshLambertMaterial({ vertexColors: true, emissiveMap: gTex, emissive: 0xffffff, map: gTex })
    : new THREE.MeshLambertMaterial({ vertexColors: true, map: gTex });
  if (theme.groundTex === 'grid') gTex.repeat.set(SIZE / 10, SIZE / 10);
  group.add(new THREE.Mesh(tGeo, terrainMat));
  if (theme.water) group.add(waterPlane(theme, cx, cz));

  const vc = { vertexColors: true };
  const offTex = groundTexture(theme.groundTex === 'grid' ? 'snow' : theme.groundTex);
  const offUV = (geo) => {
    // Simple planar UVs for the runoff strips.
    const p = geo.attributes.position;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) ((uv[i * 2] = p.getX(i) / 8), (uv[i * 2 + 1] = p.getZ(i) / 8));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geo;
  };
  const off = new THREE.MeshLambertMaterial({ color: theme.offroad, map: offTex, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(offUV(ribbon(cl, -WALL - 1, -ROAD_HALF - CURB, 0.01)), off));
  group.add(new THREE.Mesh(offUV(ribbon(cl, ROAD_HALF + CURB, WALL + 1, 0.01)), off));

  const roadTex = roadTexture(theme.road, theme.night, theme.rainbowRoad);
  const road = new THREE.Mesh(
    ribbon(cl, -ROAD_HALF, ROAD_HALF, 0.03, null, 10),
    new THREE.MeshLambertMaterial({ map: roadTex, side: THREE.DoubleSide })
  );
  group.add(road);

  const ca = new THREE.Color(theme.curbA), cb = new THREE.Color(theme.curbB);
  const curbColor = (i, c) => c.copy(Math.floor(i / 2) % 2 ? ca : cb);
  const CurbMat = theme.night || theme.glowCurbs ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
  const curbMat = new CurbMat({ ...vc, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(ribbon(cl, -ROAD_HALF - CURB, -ROAD_HALF, 0.05, curbColor), curbMat));
  group.add(new THREE.Mesh(ribbon(cl, ROAD_HALF, ROAD_HALF + CURB, 0.05, curbColor), curbMat));

  const banner = bannerTexture(theme.banner);
  const BannerMat = theme.night ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
  const bannerMat = new BannerMat({ map: banner, side: THREE.DoubleSide });
  const railMat = new THREE.MeshLambertMaterial({ color: theme.night ? 0x00e5ff : 0xdedede, emissive: theme.night ? 0x00a0b0 : 0x000000 });
  barrier(cl, -WALL, 1.3, group, bannerMat, railMat);
  barrier(cl, WALL, 1.3, group, bannerMat, railMat);

  // Start/finish line and gantry with countdown lights.
  const start = cl.pointAt(0);
  const heading = start.heading;
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_HALF * 2, 3).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: checkerTexture(9) })
  );
  line.position.set(start.x, 0.06, start.z);
  line.rotation.y = heading;
  group.add(line);
  const gantry = new THREE.Group();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x33363d });
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9.5, 0.8), poleMat);
    pole.position.set(sx * (ROAD_HALF + 2.5), 4.75, 0);
    gantry.add(pole);
  }
  const bannerBox = new THREE.Mesh(new THREE.BoxGeometry((ROAD_HALF + 3) * 2, 2, 0.6), new THREE.MeshBasicMaterial({ map: checkerTexture(12) }));
  bannerBox.position.y = 9.2;
  gantry.add(bannerBox);
  const lampHousing = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 0.6), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  lampHousing.position.set(0, 7.4, -0.4);
  gantry.add(lampHousing);
  const lamps = [-2, 0, 2].map((lx) => {
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), new THREE.MeshBasicMaterial({ color: 0x331111 }));
    lamp.position.set(lx, 7.4, -0.72);
    lamp.rotation.y = Math.PI;
    gantry.add(lamp);
    return lamp;
  });
  gantry.position.set(start.x, 0, start.z);
  gantry.rotation.y = heading;
  group.add(gantry);
  // n: 0 = off, 1..3 = that many red lamps, 4 = all green.
  const setStartLights = (state) => {
    lamps.forEach((l, k) => {
      if (state === 4) l.material.color.setHex(0x3dff6e);
      else l.material.color.setHex(k < state ? 0xff2020 : 0x331111);
    });
  };

  const glowTex = glowTexture();
  const gs = grandstandSpot(cl);
  scenery(cl, theme, group, seed, heightAt, distAt, [[gs.x, gs.z, 32]]);
  trackside(cl, theme, group, seed, glowTex);
  const crowdUpdate = grandstand(cl, theme, group);

  // Item box rows and boost pads.
  const boxSpots = [];
  for (const f of def.boxes) {
    const s = Math.floor(f * cl.n);
    for (const lat of [-6, -2, 2, 6]) boxSpots.push(cl.pointAt(s, lat));
  }
  const padSpots = def.pads.map((f, k) => {
    const s = Math.floor(f * cl.n);
    return { ...cl.pointAt(s, k % 2 ? 4 : -4), idx: s, lat: k % 2 ? 4 : -4 };
  });
  const padTex = canvasTexture(64, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#ff4f1f');
    grd.addColorStop(1, '#ffb01f');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff6a8';
    for (let k = 0; k < 3; k++) {
      const y = 6 + k * 42;
      g.beginPath();
      g.moveTo(8, y + 30); g.lineTo(w / 2, y); g.lineTo(w - 8, y + 30); g.lineTo(w - 8, y + 40);
      g.lineTo(w / 2, y + 12); g.lineTo(8, y + 40); g.closePath(); g.fill();
    }
  });
  for (const pad of padSpots) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: padTex }));
    m.position.set(pad.x, 0.07, pad.z);
    m.rotation.y = pad.heading + Math.PI;
    group.add(m);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 12).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff8a1e, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    glow.position.set(pad.x, 0.08, pad.z);
    glow.rotation.y = pad.heading;
    group.add(glow);
  }

  // Starting grid: two columns, rows behind the line.
  const grid = [];
  const gridMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  for (let k = 0; k < 8; k++) {
    const row = Math.floor(k / 2);
    const s = cl.n - 4 - row * 4 - (k % 2) * 2;
    grid.push(cl.pointAt(s, k % 2 ? -3.5 : 3.5));
    grid[k].idx = s;
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.3).rotateX(-Math.PI / 2), gridMat);
    const p = cl.pointAt(s + 1.6, k % 2 ? -3.5 : 3.5);
    mark.position.set(p.x, 0.06, p.z);
    mark.rotation.y = p.heading;
    group.add(mark);
  }

  const arches = group.children.filter((o) => o.userData.pulse !== undefined);
  const update = (time, excitement = 0) => {
    padTex.offset.y = -(time * 1.5) % 1;
    crowdUpdate(time, excitement);
    for (const a of arches) {
      const k = 0.6 + 0.4 * Math.sin(time * 3 + a.userData.pulse);
      a.material.color.setHex(a.userData.pulse % 2 ? 0x00e5ff : 0xff2bd6).multiplyScalar(k);
    }
  };

  return { def, theme, cl, group, boxSpots, padSpots, grid, center: new THREE.Vector3(cx, 0, cz), setStartLights, update };
}
