import * as THREE from 'three';
import { addWind } from './wind.js';

export const ROAD_HALF = 9; // drivable asphalt half-width (m)
export const CURB = 1.4; // curb width beyond the asphalt
export const WALL = 16; // distance from centerline to the barrier
const SPACING = 2; // metres between centerline samples

// Control points are [x, z] in metres. Racing direction follows the array order.
export const TRACKS = [
  {
    name: 'Sunny Circuit',
    elev: [[0, 0], [0.1, 0], [0.25, 4], [0.38, 1], [0.55, 5], [0.67, 1.5], [0.83, 1.5], [0.9, 0]],
    width: [[0, 9], [0.2, 9], [0.3, 7.5], [0.42, 9], [0.6, 10.5], [0.75, 8], [0.88, 9]],
    jumps: [0.47], shortcut: [0.71, 0.8],
    points: [
      [0, -150], [90, -150], [150, -110], [160, -30], [115, 20], [130, 90], [80, 140], [0, 125],
      [-60, 150], [-130, 120], [-150, 40], [-105, -20], [-150, -90], [-100, -150],
    ],
    theme: {
      sky: { top: 0x3d8fe0, horizon: 0xbfe6ff, bottom: 0x8fc77a, sunDir: [0.5, 0.55, 0.25], clouds: 22 },
      fog: [0xbfe6ff, 220, 900], ground: 0x58b04a, ground2: 0x86c95a, offroad: 0x6fae45, groundTex: 'grass',
      road: '#4d5057', wallA: 0xf4f4f4, wallB: 0xe53935, curbA: 0xffffff, curbB: 0xe53935,
      banner: ['#e53935', '#ffffff', '#1e88e5', '#ffcf33'],
      hemi: [0xdff1ff, 0x4a7a3a, 1.0], sun: [0xfff4e0, 2.4], deco: 'tree', mountains: 0x5f8f6a, snowcaps: true, grass: 0x7fcf55,
      hills: 22, weather: 'pollen', dust: 0x9a7a4a,
    },
    boxes: [0.16, 0.42, 0.7], pads: [0.3, 0.57, 0.88],
  },
  {
    name: 'Dune Dash',
    elev: [[0, 0], [0.08, 0], [0.2, 6], [0.3, 2], [0.42, 8], [0.55, 3], [0.68, 7], [0.8, 1], [0.9, 0]],
    width: [[0, 9], [0.15, 11], [0.35, 9], [0.5, 11], [0.7, 8.5], [0.85, 10], [0.95, 9]],
    jumps: [0.3, 0.7], hazards: [['tumbleweed', 0.44], ['tumbleweed', 0.82]],
    points: [
      [0, -200], [120, -195], [185, -135], [145, -70], [50, -60], [25, 0], [100, 45], [190, 60],
      [205, 150], [120, 205], [-20, 195], [-60, 120], [-140, 145], [-205, 85], [-185, -40], [-120, -150],
    ],
    theme: {
      sky: { top: 0x3f86d6, horizon: 0xffe2b0, bottom: 0xe3c07a, sunDir: [-0.4, 0.35, 0.5], sunColor: 0xffe0a0, sunSize: 1.6, clouds: 6 },
      fog: [0xffe2b0, 220, 950], ground: 0xe6c27c, ground2: 0xd4a862, offroad: 0xd9ad5f, groundTex: 'sand',
      road: '#6e6152', wallA: 0xffffff, wallB: 0x1e88e5, curbA: 0xffffff, curbB: 0x1e88e5,
      banner: ['#1e88e5', '#ffffff', '#ff8a1e', '#2bb673'],
      hemi: [0xfff1d6, 0x9c7a4a, 1.05], sun: [0xffe9c4, 2.6], deco: 'cactus', mountains: 0xc98f4e, grass: 0xcab06a,
      hills: 16, weather: 'sand', dust: 0xe8c588,
    },
    boxes: [0.12, 0.37, 0.62, 0.86], pads: [0.24, 0.5, 0.78],
  },
  {
    name: 'Frosty Peaks',
    elev: [[0, 0], [0.1, 0], [0.25, 8], [0.38, 14], [0.5, 12], [0.62, 6], [0.75, 3], [0.9, 0]],
    width: [[0, 9], [0.2, 8], [0.35, 7], [0.48, 8.5], [0.6, 7.5], [0.72, 9], [0.85, 8], [0.95, 9]],
    jumps: [0.58], hazards: [['snowball', 0.33], ['snowball', 0.72]],
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
    elev: [[0, 0], [0.1, 0], [0.28, 3], [0.4, 0.5], [0.56, 0.5], [0.7, 4], [0.85, 1], [0.92, 0]],
    width: [[0, 9], [0.2, 10.5], [0.35, 8], [0.5, 11], [0.7, 8.5], [0.9, 9]],
    jumps: [0.33, 0.7], shortcut: [0.43, 0.53], hazards: [['orb', 0.19], ['orb', 0.61], ['orb', 0.83]],
    points: [
      [-160, -60], [-60, -165], [60, -165], [165, -60], [165, 40], [95, 60], [70, 120], [150, 145],
      [140, 205], [50, 225], [-60, 150], [-95, 65], [-175, 45],
    ],
    theme: {
      sky: { top: 0x05020f, horizon: 0x3a0f5c, bottom: 0x0b0620, sunDir: [0.2, 0.25, -0.8], sunColor: 0xff2bd6, sunSize: 6, stars: true },
      fog: [0x1a0830, 140, 640], ground: 0x0e0822, ground2: 0x160c34, offroad: 0x1d1240, groundTex: 'grid',
      road: '#221c36', wallA: 0x00e5ff, wallB: 0xff2bd6, curbA: 0x00e5ff, curbB: 0xff2bd6,
      banner: ['#00e5ff', '#ff2bd6', '#7d4dff', '#ffe14d'],
      hemi: [0x8a7dff, 0x200a40, 0.65], sun: [0xb3a6ff, 0.7], deco: 'pillar', mountains: 0x2a1a5a, bloom: 0.8, bloomThreshold: 1.0,
      hills: 6, weather: 'motes', dust: 0x7d4dff, night: true, lamps: true, skyline: true,
    },
    boxes: [0.15, 0.4, 0.65, 0.88], pads: [0.25, 0.52, 0.76],
  },
  {
    name: 'Autumn Woods',
    elev: [[0, 0], [0.12, 0], [0.21, 3], [0.36, 3], [0.48, 7], [0.6, 2], [0.72, 6], [0.85, 0]],
    width: [[0, 9], [0.18, 7.5], [0.32, 10], [0.48, 8], [0.62, 10.5], [0.8, 8], [0.92, 9]],
    jumps: [0.36], shortcut: [0.25, 0.32], hazards: [['barrel', 0.2], ['barrel', 0.6]],
    points: [
      [0, -170], [110, -175], [175, -120], [150, -50], [80, -40], [60, 20], [130, 60], [170, 130],
      [110, 185], [20, 160], [-40, 190], [-120, 170], [-170, 100], [-130, 30], [-180, -50], [-110, -130],
    ],
    theme: {
      sky: { top: 0x4f86c6, horizon: 0xffd7a8, bottom: 0xc4872f, sunDir: [0.6, 0.3, 0.2], sunColor: 0xffd0a0, sunSize: 1.4, clouds: 16, cloudColor: 0xfff0e0 },
      fog: [0xffe0bc, 200, 850], ground: 0x9c7a2f, ground2: 0xc4872f, offroad: 0xa8762c, groundTex: 'grass',
      road: '#4a4a4f', wallA: 0xffffff, wallB: 0xe67e22, curbA: 0xffffff, curbB: 0xe67e22,
      banner: ['#d35400', '#ffffff', '#7b3f00', '#f1c40f'],
      hemi: [0xfff0d8, 0x6b4a2a, 1.0], sun: [0xffe2b0, 2.3], deco: 'autumn', mountains: 0x8a6a4a, grass: 0xc9a040,
      hills: 26, weather: 'leaves', dust: 0x9a7a4a,
    },
    boxes: [0.15, 0.4, 0.65, 0.88], pads: [0.27, 0.52, 0.78],
  },
  {
    name: 'Beach Bay',
    elev: [[0, 0], [0.1, 0], [0.3, 2.5], [0.47, 0.5], [0.62, 0.5], [0.75, 3], [0.88, 0.5], [0.93, 0]],
    width: [[0, 9], [0.2, 11], [0.4, 10], [0.55, 11], [0.7, 9], [0.85, 10.5], [0.95, 9]],
    jumps: [0.44], shortcut: [0.51, 0.59], hazards: [['crab', 0.2], ['crab', 0.68], ['crab', 0.81]],
    points: [
      [-200, -40], [-150, -140], [-40, -170], [60, -130], [150, -160], [210, -80], [200, 30], [130, 60],
      [150, 140], [60, 190], [-60, 160], [-120, 80], [-190, 60],
    ],
    theme: {
      sky: { top: 0x2e9bea, horizon: 0xc8f1ff, bottom: 0x1fa3c9, sunDir: [0.3, 0.6, 0.4], clouds: 14 },
      fog: [0xc8f1ff, 240, 950], ground: 0xf2dca0, ground2: 0xe8cc88, offroad: 0xead39a, groundTex: 'sand',
      road: '#5b6068', wallA: 0xffffff, wallB: 0x00b4d8, curbA: 0xffffff, curbB: 0x00b4d8,
      banner: ['#00b4d8', '#ffffff', '#ff6b6b', '#ffd166'],
      hemi: [0xffffff, 0xb59b6a, 1.1], sun: [0xfff6e0, 2.6], deco: 'beach', mountains: 0x5fa86a, grass: 0x9fcf5a,
      hills: -14, water: 0x1fa3c9, dust: 0xf2dca0,
    },
    boxes: [0.13, 0.38, 0.63, 0.87], pads: [0.25, 0.5, 0.75],
  },
  {
    name: 'Lava Castle',
    elev: [[0, 0], [0.1, 0], [0.3, 5], [0.48, 12], [0.58, 9], [0.7, 4], [0.85, 0]],
    width: [[0, 9], [0.2, 8], [0.35, 7], [0.5, 8.5], [0.62, 7], [0.75, 8.5], [0.9, 9]],
    jumps: [0.6], hazards: [['geyser', 0.22], ['geyser', 0.34], ['geyser', 0.47], ['geyser', 0.73]],
    points: [
      [0, -160], [80, -160], [130, -110], [110, -50], [160, 0], [150, 90], [80, 130], [20, 90],
      [-40, 140], [-120, 130], [-160, 60], [-110, 0], [-160, -70], [-90, -140],
    ],
    theme: {
      sky: { top: 0x1a0505, horizon: 0x8a2a10, bottom: 0x2a0a05, sunDir: [0.2, 0.2, -0.8], sunColor: 0xff5a1f, sunSize: 4 },
      fog: [0x3a120a, 140, 640], ground: 0x2a2224, ground2: 0x3a2a26, offroad: 0x3a2c28, groundTex: 'rock',
      road: '#2e2a2c', wallA: 0x1a1a1a, wallB: 0xff4d00, curbA: 0xff4d00, curbB: 0x1a1a1a,
      banner: ['#ff4d00', '#1a1a1a', '#ffb000', '#ffffff'],
      hemi: [0xff9a6a, 0x2a0a05, 0.85], sun: [0xff8a50, 1.7], deco: 'lava', mountains: 0x3a1a14, bloom: 0.8, bloomThreshold: 1.0,
      hills: 40, weather: 'embers', dust: 0x555555, glowCurbs: true,
    },
    boxes: [0.15, 0.4, 0.65, 0.88], pads: [0.27, 0.53, 0.8],
  },
  {
    name: 'Candy Land',
    elev: [[0, 0], [0.1, 0], [0.22, 5], [0.32, 1], [0.45, 2], [0.6, 2], [0.72, 7], [0.86, 0]],
    width: [[0, 9], [0.2, 10], [0.35, 7.5], [0.5, 10.5], [0.65, 8], [0.8, 10], [0.92, 9]],
    jumps: [0.2, 0.69], shortcut: [0.48, 0.57], hazards: [['gumdrop', 0.33], ['gumdrop', 0.42], ['gumdrop', 0.82]],
    points: [
      [-180, 0], [-150, -110], [-60, -150], [20, -90], [80, -160], [170, -120], [180, -20], [120, 30],
      [180, 110], [110, 180], [20, 140], [-60, 190], [-140, 130],
    ],
    theme: {
      sky: { top: 0x9fd3ff, horizon: 0xffe0f0, bottom: 0xffb3d9, sunDir: [0.4, 0.5, 0.3], sunColor: 0xfff0f8, clouds: 24, cloudColor: 0xfff4fb },
      fog: [0xffe0f0, 200, 850], ground: 0xffb3d9, ground2: 0xffd1e8, offroad: 0xffc4e1, groundTex: 'grass',
      road: '#5a3a2a', wallA: 0xffffff, wallB: 0xff6fb5, curbA: 0xffffff, curbB: 0xff6fb5,
      banner: ['#ff6fb5', '#ffffff', '#7fdbff', '#b784ff'],
      hemi: [0xffffff, 0xd08ab0, 1.15], sun: [0xfff0f8, 2.2], deco: 'candy', mountains: 0xffc4e1, snowcaps: true, grass: 0xff9ccf,
      hills: 18, weather: 'sprinkles', dust: 0xffd1e8,
    },
    boxes: [0.14, 0.39, 0.64, 0.88], pads: [0.26, 0.51, 0.77],
  },
  {
    name: 'Jungle Ruins',
    elev: [[0, 0], [0.1, 0], [0.22, 4], [0.35, 9], [0.43, 5], [0.57, 5], [0.68, 8], [0.8, 3], [0.9, 0]],
    width: [[0, 9], [0.2, 7.5], [0.35, 8.5], [0.45, 7], [0.6, 9], [0.75, 7.5], [0.9, 9]],
    jumps: [0.6], shortcut: [0.46, 0.54], hazards: [['boulder', 0.27], ['boulder', 0.33], ['boulder', 0.72]],
    points: [
      [0, -190], [120, -170], [190, -90], [140, -20], [190, 60], [140, 150], [50, 150], [-10, 90],
      [-80, 150], [-150, 150], [-200, 60], [-140, -20], [-190, -110], [-100, -170],
    ],
    theme: {
      sky: { top: 0x5fa0d0, horizon: 0xd9f2d0, bottom: 0x2f7a2f, sunDir: [0.3, 0.7, 0.2], clouds: 18 },
      fog: [0xcfe8c8, 120, 600], ground: 0x2f7a2f, ground2: 0x4f9a3a, offroad: 0x5a7a2a, groundTex: 'grass',
      road: '#5a4a3a', wallA: 0x8d6e63, wallB: 0x2e7d32, curbA: 0xffcf33, curbB: 0x2e7d32,
      banner: ['#2e7d32', '#ffcf33', '#8d6e63', '#ffffff'],
      hemi: [0xe8ffe0, 0x2a4a1a, 1.0], sun: [0xfff6d0, 2.0], deco: 'jungle', mountains: 0x3f6f3f, grass: 0x4faf3a,
      hills: 30, weather: 'pollen', dust: 0x6a5a3a,
    },
    boxes: [0.13, 0.38, 0.63, 0.87], pads: [0.25, 0.5, 0.76],
  },
  {
    name: 'Cosmic Way',
    elev: [[0, 0], [0.5, 0], [0.62, 4], [0.75, 9], [0.88, 4], [0.95, 0]],
    width: [[0, 9], [0.3, 10], [0.5, 9], [0.95, 9]],
    jumps: [0.1], bridge: [0.66, 0.84], hazards: [['orb', 0.3], ['orb', 0.56]],
    points: [[210, 0], [189, -66], [131, -83], [47, -37], [-47, 37], [-131, 83], [-189, 66], [-210, 0], [-189, -66], [-131, -83], [-47, -37], [47, 37], [131, 83], [189, 66]],
    theme: {
      sky: { top: 0x02010a, horizon: 0x1a1050, bottom: 0x050318, sunDir: [-0.3, 0.3, 0.7], sunColor: 0x7d4dff, sunSize: 8, stars: true },
      fog: [0x0d0828, 160, 700], ground: 0x0b0a20, ground2: 0x14123a, offroad: 0x1a1640, groundTex: 'grid',
      road: '#1a1a3a', wallA: 0x7d4dff, wallB: 0x00e5ff, curbA: 0x7d4dff, curbB: 0x00e5ff,
      banner: ['#7d4dff', '#00e5ff', '#ff2bd6', '#ffffff'],
      hemi: [0x9a8aff, 0x100830, 0.7], sun: [0xb3a6ff, 0.7], deco: 'crystal', mountains: 0x2a1f6a, bloom: 0.8, bloomThreshold: 1.0,
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

// Smooth cyclic profile through [fraction, value] keys (cosine easing).
export function profile(keys, fallback) {
  if (!keys || !keys.length) return () => fallback;
  const k = [...keys].sort((a, b) => a[0] - b[0]);
  return (t) => {
    t = ((t % 1) + 1) % 1;
    let i = k.findIndex((p) => p[0] > t);
    if (i === -1) i = 0;
    const b = k[i], a = k[(i - 1 + k.length) % k.length];
    let span = b[0] - a[0];
    if (span <= 0) span += 1;
    let u = t - a[0];
    if (u < 0) u += 1;
    const e = (1 - Math.cos(Math.PI * Math.min(1, u / span))) / 2;
    return a[1] + (b[1] - a[1]) * e;
  };
}

export const CUT_HALF = 9; // half-width of a shortcut's dirt path
export const JUMP_LEN = 12; // metres of ramp
export const JUMP_H = 1.7; // lip height

// Pure geometry of a track: sampled centerline plus spatial queries. No THREE
// objects beyond the curve, so it can be unit-tested in Node.
export function buildCenterline(def) {
  const curve = new THREE.CatmullRomCurve3(
    def.points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    'centripetal'
  );
  const length = curve.getLength();
  const n = Math.max(64, Math.round(length / SPACING));
  const pts = curve.getSpacedPoints(n).slice(0, n);
  const px = new Float32Array(n), pz = new Float32Array(n), py = new Float32Array(n);
  const tx = new Float32Array(n), tz = new Float32Array(n);
  const nx = new Float32Array(n), nz = new Float32Array(n);
  const hw = new Float32Array(n), wall = new Float32Array(n);
  const ramp = new Float32Array(n);
  const bridge = new Uint8Array(n);
  const gap = new Int8Array(n); // +1 / -1: barrier missing on that side (shortcut)
  const elev = profile(def.elev, 0);
  const width = profile(def.width, ROAD_HALF);
  pts.forEach((p, i) => {
    px[i] = p.x;
    pz[i] = p.z;
    py[i] = elev(i / n);
    hw[i] = width(i / n);
    wall[i] = hw[i] + (WALL - ROAD_HALF);
  });
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

  // Kicker ramps: rise to JUMP_H over JUMP_LEN, then drop off the lip.
  const rampSamples = Math.round(JUMP_LEN / seg);
  for (const f of def.jumps || []) {
    const s0 = Math.floor(f * n);
    for (let k = 0; k <= rampSamples; k++) ramp[wrap(s0 + k)] = (JUMP_H * k) / rampSamples;
  }
  if (def.bridge) {
    const [a, b] = def.bridge.map((f) => Math.floor(f * n));
    for (let i = a; i !== b; i = wrap(i + 1)) bridge[i] = 1;
  }

  let maxWall = 0;
  for (let i = 0; i < n; i++) maxWall = Math.max(maxWall, wall[i]);

  // Find nearest centerline position. `hint` is the previous index (or -1).
  function locate(x, z, hint = -1, y = null) {
    let best = -1, bestD = Infinity;
    const scan = (i) => {
      const dx = x - px[i], dz = z - pz[i];
      let d = dx * dx + dz * dz;
      // At a crossing, prefer the deck the kart is actually on.
      if (y !== null) d += ((y - py[i]) * 3) ** 2;
      if (d < bestD) ((bestD = d), (best = i));
    };
    if (hint < 0) for (let i = 0; i < n; i++) scan(i);
    else for (let k = -24; k <= 24; k++) scan(wrap(hint + k));
    // If the local search ended far away (teleport, respawn), do a full scan.
    if (hint >= 0 && bestD > (maxWall + 8) ** 2) for (let i = 0; i < n; i++) scan(i);
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

  // Ground height under a located point (road elevation plus any jump ramp).
  function groundAt(loc) {
    const i = loc.idx, j = wrap(i + 1);
    let y = py[i] + (py[j] - py[i]) * loc.f;
    if (Math.abs(loc.lateral) <= hw[loc.i] + 0.5) {
      // No interpolation across the lip, so the drop is a real drop.
      const r = ramp[j] < ramp[i] ? ramp[i] : ramp[i] + (ramp[j] - ramp[i]) * loc.f;
      y += r;
    }
    return y;
  }

  // Point on the centerline at fractional index `s` offset sideways by `lat`.
  function pointAt(s, lat = 0) {
    const i0 = Math.floor(s), f = s - i0;
    const i = wrap(i0), j = wrap(i0 + 1);
    const x = px[i] + (px[j] - px[i]) * f + nx[i] * lat;
    const z = pz[i] + (pz[j] - pz[i]) * f + nz[i] * lat;
    const y = py[i] + (py[j] - py[i]) * f;
    return { x, y, z, tx: tx[i], tz: tz[i], heading: Math.atan2(tx[i], tz[i]) };
  }

  // Smallest gap between the barriers of two stretches of road that are far
  // apart along the track (negative = they overlap). A bridge crossing with a
  // big height difference doesn't count.
  function minClearance() {
    let min = Infinity;
    const skip = Math.ceil((maxWall * 3) / seg);
    for (let i = 0; i < n; i += 2) {
      for (let j = i + skip; j < n; j += 2) {
        if (n - (j - i) < skip) continue;
        if (Math.abs(py[i] - py[j]) > 5 && (bridge[i] || bridge[j])) continue;
        const d = Math.hypot(px[i] - px[j], pz[i] - pz[j]) - wall[i] - wall[j];
        if (d < min) min = d;
      }
    }
    return min;
  }

  // Shortcut: open both facing barriers where two legs of the track pass
  // close by, so you can cut across the rough ground between them.
  if (def.shortcut) {
    let best = null;
    const [fa, fb] = def.shortcut;
    const win = Math.round(0.035 * n);
    for (let di = -win; di <= win; di++) {
      const i = wrap(Math.round(fa * n) + di);
      for (let dj = -win; dj <= win; dj++) {
        const j = wrap(Math.round(fb * n) + dj);
        if (bridge[i] || bridge[j] || Math.abs(py[i] - py[j]) > 0.6) continue;
        const dist = Math.hypot(px[i] - px[j], pz[i] - pz[j]);
        const save = wrap(j - i) * seg - dist;
        if (dist > wall[i] + wall[j] + 4 && dist < wall[i] + wall[j] + 45 && (!best || save > best.save)) {
          best = { i, j, dist, save };
        }
      }
    }
    if (best) {
      // Open each barrier wide enough for the 18 m path crossing it at an angle.
      const ux = (px[best.j] - px[best.i]) / best.dist, uz = (pz[best.j] - pz[best.i]) / best.dist;
      for (const [a, b] of [[best.i, best.j], [best.j, best.i]]) {
        const side = Math.sign((px[b] - px[a]) * nx[a] + (pz[b] - pz[a]) * nz[a]) || 1;
        const sin = Math.max(0.35, Math.abs(ux * nx[a] + uz * nz[a]));
        const span = Math.round(Math.min(30, CUT_HALF / sin + 4) / seg);
        for (let k = -span; k <= span; k++) gap[wrap(a + k)] = side;
        const c = (m) => [px[wrap(a + m)] + nx[wrap(a + m)] * wall[wrap(a + m)] * side, pz[wrap(a + m)] + nz[wrap(a + m)] * wall[wrap(a + m)] * side];
        (best.quad ||= []).push([...c(-span), a], [...c(span), a]);
      }
      // Corners in order around the middle, plus the two side edges that
      // bound the path (inward normals).
      const mx = best.quad.reduce((t, q) => t + q[0], 0) / 4, mz = best.quad.reduce((t, q) => t + q[1], 0) / 4;
      best.quad.sort((p, q) => Math.atan2(p[1] - mz, p[0] - mx) - Math.atan2(q[1] - mz, q[0] - mx));
      best.edges = [];
      for (let k = 0; k < 4; k++) {
        const [ax, az] = best.quad[k], [bx, bz] = best.quad[(k + 1) % 4];
        // Only the edges joining the two legs (the others are the openings).
        if (best.quad[k][2] === best.quad[(k + 1) % 4][2]) continue;
        const len = Math.hypot(bx - ax, bz - az);
        let enx = -(bz - az) / len, enz = (bx - ax) / len;
        if ((mx - ax) * enx + (mz - az) * enz < 0) ((enx = -enx), (enz = -enz));
        best.edges.push({ ax, az, ux: (bx - ax) / len, uz: (bz - az) / len, len, nx: enx, nz: enz });
      }
      def._shortcut = best;
    }
  }

  return {
    n, length, seg, px, py, pz, tx, tz, nx, nz, hw, wall, ramp, bridge, gap, maxWall,
    wrap, locate, groundAt, pointAt, minClearance, shortcut: def._shortcut || null,
  };
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
    if (cl.bridge?.[i]) continue; // terrain follows the road underneath a bridge
    const key = `${Math.floor(cl.px[i] / CELL)},${Math.floor(cl.pz[i] / CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  }
  const nearest = (x, z, cap = 100) => {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    let best = cap * cap, bi = -1;
    const r = Math.ceil(cap / CELL);
    for (let a = -r; a <= r; a++)
      for (let b = -r; b <= r; b++) {
        const list = grid.get(`${cx + a},${cz + b}`);
        if (!list) continue;
        for (const i of list) {
          const dx = x - cl.px[i], dz = z - cl.pz[i];
          const d = dx * dx + dz * dz;
          if (d < best) ((best = d), (bi = i));
        }
      }
    return { d: Math.sqrt(best), i: bi };
  };
  const dist = (x, z, cap = 100) => nearest(x, z, cap).d;
  dist.nearest = nearest;
  return dist;
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
// Lateral offsets a/b can be numbers or functions of the sample index; the
// strip follows the road's elevation. `skip(i)` leaves a segment out.
function ribbon(cl, a, b, y, colorFn, uvScale = 0, skip = null) {
  const { n, px, pz, nx, nz, py } = cl;
  const A = typeof a === 'function' ? a : () => a;
  const B = typeof b === 'function' ? b : () => b;
  const pos = [], col = [], uv = [];
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    if (skip && skip(i)) continue;
    const j = (i + 1) % n;
    const quad = [
      [i, 0], [i, 1], [j, 1],
      [i, 0], [j, 1], [j, 0],
    ];
    if (colorFn) colorFn(i, c);
    for (const [k, side] of quad) {
      const l = side ? B(k) : A(k);
      pos.push(px[k] + nx[k] * l, py[k] + y, pz[k] + nz[k] * l);
      if (colorFn) col.push(c.r, c.g, c.b);
      if (uvScale) uv.push(side, ((k === j && j === 0 ? n : k) * cl.seg) / uvScale);
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
function barrier(cl, side, height, group, bannerMat, railMat) {
  // Mirror the texture on the right-hand barrier so its text reads correctly from the road.
  const dir = side;
  const { n, px, pz, nx, nz, py, wall, gap, seg } = cl;
  const pos = [], uv = [], rail = [];
  for (let i = 0; i < n; i++) {
    if (gap[i] === side) continue; // shortcut opening
    const j = (i + 1) % n;
    const la = side * wall[i], lb = side * wall[j];
    const ax = px[i] + nx[i] * la, az = pz[i] + nz[i] * la, ay = py[i];
    const bx = px[j] + nx[j] * lb, bz = pz[j] + nz[j] * lb, by = py[j];
    const u0 = (dir * i * seg) / 24, u1 = (dir * (i + 1) * seg) / 24;
    pos.push(ax, ay, az, bx, by, bz, bx, by + height, bz, ax, ay, az, bx, by + height, bz, ax, ay + height, az);
    uv.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
    // Rounded-looking rail: a flat cap a bit wider than the banner.
    const w = 0.22, ha = ay + height + 0.08, hb = by + height + 0.08;
    const o = (l, k) => [px[k] + nx[k] * l, pz[k] + nz[k] * l];
    const [a1x, a1z] = o(la - w, i), [a2x, a2z] = o(la + w, i), [b1x, b1z] = o(lb - w, j), [b2x, b2z] = o(lb + w, j);
    rail.push(a1x, ha, a1z, a2x, ha, a2z, b2x, hb, b2z, a1x, ha, a1z, b2x, hb, b2z, b1x, hb, b1z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  group.add(new THREE.Mesh(g, bannerMat));
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(rail, 3));
  rg.computeVertexNormals();
  const rm = railMat.clone();
  rm.side = THREE.DoubleSide;
  group.add(new THREE.Mesh(rg, rm));
}

// Bridge decks: underside, side skirts and support pillars down to the ground.
function bridgeDeck(cl, group, theme, heightAt) {
  const { n, px, pz, nx, nz, py, wall, bridge } = cl;
  if (!bridge.some((b) => b)) return;
  const mat = new THREE.MeshLambertMaterial({ color: theme.night ? 0x2a2450 : 0x9a9aa6, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(ribbon(cl, (i) => -wall[i] - 0.3, (i) => wall[i] + 0.3, -0.9, null, 0, (i) => !bridge[i]), mat));
  for (const side of [-1, 1]) {
    const pos = [];
    for (let i = 0; i < n; i++) {
      if (!bridge[i]) continue;
      const j = (i + 1) % n;
      const a = [px[i] + nx[i] * side * (wall[i] + 0.3), pz[i] + nz[i] * side * (wall[i] + 0.3)];
      const b = [px[j] + nx[j] * side * (wall[j] + 0.3), pz[j] + nz[j] * side * (wall[j] + 0.3)];
      pos.push(a[0], py[i] - 0.9, a[1], b[0], py[j] - 0.9, b[1], b[0], py[j] + 0.02, b[1], a[0], py[i] - 0.9, a[1], b[0], py[j] + 0.02, b[1], a[0], py[i] + 0.02, a[1]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, mat));
  }
  // Pillars, kept off the road passing underneath.
  const pillars = [];
  for (let i = 0; i < n; i += 6) {
    if (!bridge[i] || py[i] < 2.5) continue;
    for (const side of [-1, 1]) {
      const x = px[i] + nx[i] * side * (wall[i] - 1), z = pz[i] + nz[i] * side * (wall[i] - 1);
      let clear = true;
      for (let k = 0; k < n && clear; k += 2) if (!bridge[k] && Math.hypot(x - px[k], z - pz[k]) < wall[k] + 1.5) clear = false;
      if (!clear) continue;
      const g0 = heightAt(x, z);
      const h = py[i] - 0.9 - g0;
      if (h > 0.5) pillars.push([x, g0, z, 1, 0, h]);
    }
  }
  group.add(instanced(new THREE.BoxGeometry(1.6, 1, 1.6).translate(0, 0.5, 0), mat, pillars));
}

// Jump ramps: a wedge across the road with a striped face.
function jumpRamps(cl, group) {
  const { n, px, pz, nx, nz, py, hw, ramp, wrap } = cl;
  const tex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#ffcf33';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d1d1d';
    for (let k = -2; k < 6; k++) {
      g.beginPath();
      g.moveTo(k * 32, 0); g.lineTo(k * 32 + 16, 0); g.lineTo(k * 32 + 16 + h, h); g.lineTo(k * 32 + h, h);
      g.fill();
    }
  });
  const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
  const pos = [], uv = [];
  const quad = (a, b, c, d, ua, ub) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    uv.push(ua[0], ua[1], ub[0], ua[1], ub[0], ub[1], ua[0], ua[1], ub[0], ub[1], ua[0], ub[1]);
  };
  const P = (i, l, dy) => [px[i] + nx[i] * l, py[i] + dy, pz[i] + nz[i] * l];
  for (let i = 0; i < n; i++) {
    const j = wrap(i + 1);
    if (ramp[j] > ramp[i]) {
      // sloped top
      quad(P(i, -hw[i], ramp[i] + 0.04), P(i, hw[i], ramp[i] + 0.04), P(j, hw[j], ramp[j] + 0.04), P(j, -hw[j], ramp[j] + 0.04), [0, 0], [4, 1]);
      // side walls
      for (const s of [-1, 1]) quad(P(i, s * hw[i], 0), P(j, s * hw[j], 0), P(j, s * hw[j], ramp[j] + 0.04), P(i, s * hw[i], ramp[i] + 0.04), [0, 0], [1, 0.3]);
    } else if (ramp[i] > 0 && ramp[j] < ramp[i]) {
      // the lip
      quad(P(i, -hw[i], 0), P(i, hw[i], 0), P(i, hw[i], ramp[i] + 0.04), P(i, -hw[i], ramp[i] + 0.04), [0, 0], [4, 0.4]);
    }
  }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.userData.cast = true;
  group.add(m);
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
function waterNormals() {
  const N = 128;
  const h = new Float32Array(N * N);
  const r = rng(42);
  // A few overlapping sine ripples tile seamlessly.
  const waves = Array.from({ length: 6 }, () => [1 + Math.floor(r() * 4), 1 + Math.floor(r() * 4), r() * 6.28]);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let v = 0;
      for (const [a, b, p] of waves) v += Math.sin(((x * a + y * b) / N) * Math.PI * 2 + p);
      h[y * N + x] = v;
    }
  return canvasTexture(N, N, (g) => {
    const img = g.createImageData(N, N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const dx = h[y * N + ((x + 1) % N)] - h[y * N + ((x - 1 + N) % N)];
        const dy = h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x];
        const i = (y * N + x) * 4;
        img.data[i] = 128 + dx * 18;
        img.data[i + 1] = 128 + dy * 18;
        img.data[i + 2] = 255;
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  });
}

export function waterPlane(theme, cx, cz) {
  const nm = waterNormals();
  nm.colorSpace = THREE.NoColorSpace;
  nm.repeat.set(120, 120);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: theme.water, roughness: 0.12, metalness: 0.35, normalMap: nm, normalScale: new THREE.Vector2(0.6, 0.6), transparent: true, opacity: 0.9 })
  );
  m.position.set(cx, -1.4, cz);
  m.userData.water = nm;
  return m;
}

// Shared finishing touches for a track or arena group: shadow flags, plus an
// animator for water ripples and glowing lava.
export function finishGroup(group) {
  const waters = [], lavas = [];
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.water) waters.push(o.userData.water);
    if (o.material?.userData?.lava) lavas.push(o.material);
    if (o.isInstancedMesh) o.castShadow = !o.userData.noShadow;
    else if (o.userData.cast) o.castShadow = true;
    if (!o.isInstancedMesh) o.receiveShadow = true;
  });
  const base = lavas.map((m) => m.color.clone());
  return (time) => {
    for (const w of waters) {
      w.offset.x = (time * 0.012) % 1;
      w.offset.y = (time * 0.008) % 1;
    }
    lavas.forEach((m, i) => m.color.copy(base[i]).multiplyScalar(1 + 0.35 * Math.sin(time * 2.2 + i)));
  };
}

// Grass tufts along both run-off strips.
function grassTufts(cl, theme, group, seed) {
  if (!theme.grass) return;
  const r = rng(seed + 77);
  const list = [];
  for (let i = 0; i < cl.n; i++) {
    if (cl.bridge[i] || cl.ramp[i] > 0) continue;
    const inner = cl.hw[i] + CURB + 0.4, outer = cl.wall[i] - 0.7;
    for (let k = 0; k < 3; k++) {
      const side = r() < 0.5 ? -1 : 1;
      const lat = side * (inner + r() * (outer - inner));
      const f = r();
      const j = (i + 1) % cl.n;
      const x = cl.px[i] + (cl.px[j] - cl.px[i]) * f + cl.nx[i] * lat;
      const z = cl.pz[i] + (cl.pz[j] - cl.pz[i]) * f + cl.nz[i] * lat;
      list.push([x, cl.py[i] + (cl.py[j] - cl.py[i]) * f, z, 0.6 + r() * 0.8, r() * 6.28]);
    }
  }
  const parts = [];
  for (let b = 0; b < 4; b++) {
    const a = (b / 4) * Math.PI * 2;
    parts.push(new THREE.ConeGeometry(0.07, 0.8, 3).translate(Math.cos(a) * 0.15, 0.4, Math.sin(a) * 0.15).rotateZ(Math.cos(a) * 0.25));
  }
  const geo = mergeGeos(parts);
  const mesh = instanced(geo, addWind(new THREE.MeshLambertMaterial({ color: theme.grass }), 0.12), list);
  mesh.userData.noShadow = true;
  group.add(mesh);
}

function mergeGeos(list) {
  const pos = [], norm = [];
  for (const g of list) {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.computeVertexNormals();
    pos.push(...ng.attributes.position.array);
    norm.push(...ng.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  return out;
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
    if (d < WALL + 9) continue;
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
  const add = (geo, mat, list) => group.add(instanced(geo, addWind(mat), list));
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
      const lava = (c) => {
        const m = new THREE.MeshBasicMaterial({ color: c });
        m.userData.lava = true;
        return m;
      };
      add(new THREE.CircleGeometry(3.5, 14).rotateX(-Math.PI / 2).translate(0, 0.15, 0), lava(0xff5a00), B);
      add(new THREE.CircleGeometry(2.2, 14).rotateX(-Math.PI / 2).translate(0.4, 0.2, 0.2), lava(0xffc040), B);
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
      if (r() < 0.35 || cl.bridge[i] || cl.gap[i] === side) continue;
      const lat = side * (cl.wall[i] + 2.2);
      const x = px[i] + nx[i] * lat, z = pz[i] + nz[i] * lat;
      const rot = Math.atan2(tx[i], tz[i]);
      flagPoles.push([x, cl.py[i], z, 1, rot]);
      flagCloths[Math.floor(r() * 4)].push([x, cl.py[i], z, 1, rot + (r() - 0.5) * 0.6]);
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
    const side = d > 0 ? -1 : 1;
    if (cl.bridge[i] || cl.gap[i] === side) continue;
    const lat = side * (cl.wall[i] + 1.1);
    for (const off of [-1.4, 0, 1.4]) {
      const x = px[i] + nx[i] * lat + tx[i] * off, z = pz[i] + nz[i] * lat + tz[i] * off;
      for (let h = 0; h < 3; h++) (h === 1 ? stripes : tyres).push([x, cl.py[i] + 0.25 + h * 0.5, z, 1]);
    }
  }
  const tg = new THREE.TorusGeometry(0.55, 0.25, 6, 12).rotateX(Math.PI / 2);
  group.add(instanced(tg, new THREE.MeshLambertMaterial({ color: 0x1d1d1d }), tyres));
  group.add(instanced(tg, new THREE.MeshLambertMaterial({ color: theme.night ? 0xff2bd6 : 0xffffff }), stripes));

  if (theme.lamps) {
    const poles = [], bulbsA = [], bulbsB = [], poolsA = [], poolsB = [];
    for (let i = 0; i < n; i += Math.round(30 / cl.seg)) {
      for (const side of [-1, 1]) {
        if (cl.gap[i] === side) continue;
        const W = cl.wall[i], y = cl.py[i];
        const lat = side * (W + 0.8);
        const x = px[i] + nx[i] * lat, z = pz[i] + nz[i] * lat;
        poles.push([x, y, z, 1]);
        const bx = px[i] + nx[i] * side * (W - 1.5), bz = pz[i] + nz[i] * side * (W - 1.5);
        const lx = px[i] + nx[i] * side * (cl.hw[i] - 2), lz = pz[i] + nz[i] * side * (cl.hw[i] - 2);
        ((i / Math.round(30 / cl.seg)) % 2 ? bulbsA : bulbsB).push([bx, y + 8.3, bz, 1]);
        ((i / Math.round(30 / cl.seg)) % 2 ? poolsA : poolsB).push([lx, y + 0.07, lz, 1]);
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
    arches.forEach((i, k) => {
      const archGeo = new THREE.TorusGeometry(cl.hw[i] + 3, 0.35, 8, 40, Math.PI);
      const m = new THREE.Mesh(archGeo, new THREE.MeshBasicMaterial({ color: k % 2 ? 0x00e5ff : 0xff2bd6 }));
      m.position.set(px[i], cl.py[i], pz[i]);
      m.rotation.y = Math.atan2(tx[i], tz[i]);
      m.userData.pulse = k;
      group.add(m);
    });
  }
}

// Grandstand with a bobbing crowd next to the start straight.
function grandstandSpot(cl) {
  const i = cl.wrap(cl.n - Math.round(30 / cl.seg));
  const lat = cl.wall[i] + 9;
  return { i, x: cl.px[i] + cl.nx[i] * lat, z: cl.pz[i] + cl.nz[i] * lat, y: cl.py[i] };
}

function grandstand(cl, theme, group) {
  const { i, x, z, y } = grandstandSpot(cl);
  // Face the track: local +z points toward the road.
  return grandstandAt(group, theme, x, z, Math.atan2(-cl.nx[i], -cl.nz[i]), y);
}

// Grandstand at (x, z); local +z (the front row) points along `rotY`.
export function grandstandAt(group, theme, x, z, rotY, y = 0) {
  const stand = new THREE.Group();
  stand.position.set(x, y, z);
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
  const sc = cl.shortcut;
  const cut = sc && { x: (cl.px[sc.i] + cl.px[sc.j]) / 2, z: (cl.pz[sc.i] + cl.pz[sc.j]) / 2, r2: (sc.dist / 2 + 14) ** 2 };
  // Terrain hugs the road (following its elevation), then rolls into hills.
  const heightAt = (x, z) => {
    const { d, i } = distAt.nearest(x, z, 100);
    const base = i >= 0 ? cl.py[i] - 0.3 : -0.3;
    const W = i >= 0 ? cl.wall[i] : WALL;
    const hill = -0.3 + hills * (0.35 + fbm(x / 140, z / 140, seed, 4) * 1.1);
    if (d < W + 12) return base;
    if (cut && (x - cut.x) ** 2 + (z - cut.z) ** 2 < cut.r2) return base;
    const k = smooth(W + 12, W + 90, d);
    return base + (hill - base) * k;
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
  const { hw, wall } = cl;
  group.add(new THREE.Mesh(offUV(ribbon(cl, (i) => -wall[i] - (cl.gap[i] === -1 ? 0 : 1), (i) => -hw[i] - CURB, 0.01)), off));
  group.add(new THREE.Mesh(offUV(ribbon(cl, (i) => hw[i] + CURB, (i) => wall[i] + (cl.gap[i] === 1 ? 0 : 1), 0.01)), off));
  bridgeDeck(cl, group, theme, heightAt);
  jumpRamps(cl, group);
  if (cl.shortcut) {
    // Packed-dirt path across the gap between the two opened barriers.
    const q = cl.shortcut.quad, y = cl.py[cl.shortcut.i] + 0.005;
    const pathGeo = new THREE.BufferGeometry();
    pathGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 2, 0, 2, 3].flatMap((k) => [q[k][0], y, q[k][1]]), 3));
    pathGeo.computeVertexNormals();
    const path = new THREE.Mesh(
      offUV(pathGeo),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(theme.dust ?? theme.offroad).lerp(new THREE.Color(theme.offroad), 0.4), map: offTex, side: THREE.DoubleSide })
    );
    path.receiveShadow = true;
    group.add(path);
  }

  const roadTex = roadTexture(theme.road, theme.night, theme.rainbowRoad);
  const road = new THREE.Mesh(
    ribbon(cl, (i) => -hw[i], (i) => hw[i], 0.03, null, 10),
    new THREE.MeshLambertMaterial({ map: roadTex, side: THREE.DoubleSide })
  );
  group.add(road);

  const ca = new THREE.Color(theme.curbA), cb = new THREE.Color(theme.curbB);
  const curbColor = (i, c) => c.copy(Math.floor(i / 2) % 2 ? ca : cb);
  const CurbMat = theme.night || theme.glowCurbs ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
  const curbMat = new CurbMat({ ...vc, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(ribbon(cl, (i) => -hw[i] - CURB, (i) => -hw[i], 0.05, curbColor), curbMat));
  group.add(new THREE.Mesh(ribbon(cl, (i) => hw[i], (i) => hw[i] + CURB, 0.05, curbColor), curbMat));

  const banner = bannerTexture(theme.banner);
  const BannerMat = theme.night ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
  const bannerMat = new BannerMat({ map: banner, side: THREE.DoubleSide });
  const railMat = new THREE.MeshLambertMaterial({ color: theme.night ? 0x00e5ff : 0xdedede, emissive: theme.night ? 0x00a0b0 : 0x000000 });
  barrier(cl, -1, 1.3, group, bannerMat, railMat);
  barrier(cl, 1, 1.3, group, bannerMat, railMat);

  // Start/finish line and gantry with countdown lights.
  const start = cl.pointAt(0);
  const heading = start.heading;
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(hw[0] * 2, 3).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: checkerTexture(9) })
  );
  line.position.set(start.x, start.y + 0.06, start.z);
  line.rotation.y = heading;
  group.add(line);
  const gantry = new THREE.Group();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x33363d });
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9.5, 0.8), poleMat);
    pole.position.set(sx * (hw[0] + 2.5), 4.75, 0);
    gantry.add(pole);
  }
  const bannerBox = new THREE.Mesh(new THREE.BoxGeometry((hw[0] + 3) * 2, 2, 0.6), new THREE.MeshBasicMaterial({ map: checkerTexture(12) }));
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
  gantry.position.set(start.x, start.y, start.z);
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
  grassTufts(cl, theme, group, seed);
  const gs = grandstandSpot(cl);
  const avoid = [[gs.x, gs.z, 32]];
  // Keep the shortcut's rough ground clear of trees.
  if (cl.shortcut) {
    const { i, j } = cl.shortcut;
    avoid.push([(cl.px[i] + cl.px[j]) / 2, (cl.pz[i] + cl.pz[j]) / 2, cl.shortcut.dist / 2 + 12]);
  }
  scenery(cl, theme, group, seed, heightAt, distAt, avoid);
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
    m.position.set(pad.x, pad.y + 0.07, pad.z);
    m.rotation.y = pad.heading + Math.PI;
    group.add(m);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 12).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff8a1e, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    glow.position.set(pad.x, pad.y + 0.08, pad.z);
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
    mark.position.set(p.x, p.y + 0.06, p.z);
    mark.rotation.y = p.heading;
    group.add(mark);
  }

  const arches = group.children.filter((o) => o.userData.pulse !== undefined);
  gantry.traverse((o) => (o.userData.cast = true));
  const animate = finishGroup(group);
  const update = (time, excitement = 0) => {
    animate(time);
    padTex.offset.y = -(time * 1.5) % 1;
    crowdUpdate(time, excitement);
    for (const a of arches) {
      const k = 0.6 + 0.4 * Math.sin(time * 3 + a.userData.pulse);
      a.material.color.setHex(a.userData.pulse % 2 ? 0x00e5ff : 0xff2bd6).multiplyScalar(k);
    }
  };

  return { def, theme, cl, group, boxSpots, padSpots, grid, heightAt, center: new THREE.Vector3(cx, 0, cz), setStartLights, update };
}
