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
      sky: 0x8fd3ff, fog: [0x8fd3ff, 150, 650], ground: 0x5cb85c, offroad: 0x7fbf4d,
      road: '#55585e', wallA: 0xf2f2f2, wallB: 0xe53935, curbA: 0xffffff, curbB: 0xe53935,
      hemi: [0xffffff, 0x4a7a3a, 1.1], sun: [0xffffff, 1.6], deco: 'tree', mountains: 0x6c9a6a,
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
      sky: 0xffd9a0, fog: [0xffd9a0, 160, 700], ground: 0xe3c07a, offroad: 0xd9ad5f,
      road: '#7a6650', wallA: 0xffffff, wallB: 0x1e88e5, curbA: 0xffffff, curbB: 0x1e88e5,
      hemi: [0xfff1d6, 0x9c7a4a, 1.15], sun: [0xfff3e0, 1.7], deco: 'cactus', mountains: 0xc98f4e,
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
      sky: 0xcfe8ff, fog: [0xe6f2ff, 120, 560], ground: 0xf4f8fc, offroad: 0xdbe7f3,
      road: '#5a6472', wallA: 0x1565c0, wallB: 0xffffff, curbA: 0x1565c0, curbB: 0xffffff,
      hemi: [0xffffff, 0x9fb7d6, 1.2], sun: [0xffffff, 1.3], deco: 'pine', mountains: 0xffffff,
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
      sky: 0x0b0620, fog: [0x0b0620, 120, 520], ground: 0x140c2e, offroad: 0x1d1240,
      road: '#2a2340', wallA: 0x00e5ff, wallB: 0xff2bd6, curbA: 0x00e5ff, curbB: 0xff2bd6,
      hemi: [0x8a7dff, 0x200a40, 0.7], sun: [0xb3a6ff, 0.6], deco: 'pillar', mountains: 0x2a1a5a,
      night: true,
    },
    boxes: [0.15, 0.4, 0.65, 0.88], pads: [0.25, 0.52, 0.76],
  },
];

// Seeded PRNG so decorations are identical every time a track loads.
function rng(seed) {
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

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function roadTexture(base, night) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 2200; i++) {
      const v = Math.floor(r() * 40) - 20;
      g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 300})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    g.fillStyle = night ? '#ffe36e' : 'rgba(255,255,255,0.85)';
    g.fillRect(4, 0, 4, h);
    g.fillRect(w - 8, 0, 4, h);
    g.fillStyle = night ? 'rgba(255,227,110,0.7)' : 'rgba(255,255,255,0.55)';
    g.fillRect(w / 2 - 2, 0, 4, h * 0.45);
  });
}

function checkerTexture(cells = 8) {
  return canvasTexture(256, 64, (g, w, h) => {
    const s = w / (cells * 2);
    for (let y = 0; y < h / s; y++)
      for (let x = 0; x < w / s; x++) {
        g.fillStyle = (x + y) % 2 ? '#111' : '#fff';
        g.fillRect(x * s, y * s, s, s);
      }
  });
}

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

// Vertical barrier at lateral offset `lat`.
function wall(cl, lat, height, colorFn) {
  const { n, px, pz, nx, nz } = cl;
  const pos = [], col = [];
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = px[i] + nx[i] * lat, az = pz[i] + nz[i] * lat;
    const bx = px[j] + nx[j] * lat, bz = pz[j] + nz[j] * lat;
    colorFn(i, c);
    pos.push(ax, 0, az, bx, 0, bz, bx, height, bz, ax, 0, az, bx, height, bz, ax, height, az);
    for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function decorations(cl, theme, group, seed) {
  const r = rng(seed);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < cl.n; i++) {
    minX = Math.min(minX, cl.px[i]); maxX = Math.max(maxX, cl.px[i]);
    minZ = Math.min(minZ, cl.pz[i]); maxZ = Math.max(maxZ, cl.pz[i]);
  }
  const pad = 90;
  const spots = [];
  for (let tries = 0; tries < 2500 && spots.length < 260; tries++) {
    const x = minX - pad + r() * (maxX - minX + pad * 2);
    const z = minZ - pad + r() * (maxZ - minZ + pad * 2);
    let d = Infinity;
    for (let i = 0; i < cl.n; i += 3) d = Math.min(d, Math.hypot(x - cl.px[i], z - cl.pz[i]));
    if (d > WALL + 5) spots.push([x, z, 0.7 + r() * 0.8, r() * Math.PI * 2]);
  }

  const parts = [];
  const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
  switch (theme.deco) {
    case 'tree':
      parts.push([new THREE.CylinderGeometry(0.5, 0.7, 3, 6).translate(0, 1.5, 0), lam(0x7a4a24)]);
      parts.push([new THREE.IcosahedronGeometry(3, 0).translate(0, 5, 0), lam(0x2e8b3d, { flatShading: true })]);
      break;
    case 'cactus':
      parts.push([new THREE.CylinderGeometry(0.8, 0.9, 6, 7).translate(0, 3, 0), lam(0x3f8f3f, { flatShading: true })]);
      parts.push([new THREE.CylinderGeometry(0.5, 0.5, 2.6, 6).rotateZ(Math.PI / 2).translate(1.4, 3, 0), lam(0x3f8f3f)]);
      parts.push([new THREE.CylinderGeometry(0.45, 0.45, 2.2, 6).translate(2.6, 4, 0), lam(0x3f8f3f)]);
      break;
    case 'pine':
      parts.push([new THREE.CylinderGeometry(0.4, 0.5, 2, 6).translate(0, 1, 0), lam(0x5d3a1a)]);
      parts.push([new THREE.ConeGeometry(3, 5, 7).translate(0, 4, 0), lam(0x1f5f3f, { flatShading: true })]);
      parts.push([new THREE.ConeGeometry(2, 3, 7).translate(0, 7, 0), lam(0xffffff, { flatShading: true })]);
      break;
    case 'pillar':
      parts.push([new THREE.BoxGeometry(1.4, 12, 1.4).translate(0, 6, 0), lam(0x222244)]);
      parts.push([new THREE.BoxGeometry(1.6, 0.6, 1.6).translate(0, 12, 0), new THREE.MeshBasicMaterial({ color: 0xff2bd6 })]);
      parts.push([new THREE.BoxGeometry(1.6, 0.4, 1.6).translate(0, 6, 0), new THREE.MeshBasicMaterial({ color: 0x00e5ff })]);
      break;
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (const [geo, mat] of parts) {
    const inst = new THREE.InstancedMesh(geo, mat, spots.length);
    spots.forEach(([x, z, sc, rot], k) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      m.compose(p.set(x, 0, z), q, s.set(sc, sc, sc));
      inst.setMatrixAt(k, m);
    });
    group.add(inst);
  }

  // Distant mountains ring.
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const mGeo = new THREE.ConeGeometry(1, 1, 5);
  const mountains = new THREE.InstancedMesh(mGeo, lam(theme.mountains, { flatShading: true }), 28);
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2 + r() * 0.1;
    const rad = 480 + r() * 80;
    const h = 60 + r() * 90, w = 70 + r() * 60;
    m.compose(p.set(cx + Math.cos(a) * rad, h / 2 - 2, cz + Math.sin(a) * rad), q.identity(), s.set(w, h, w));
    mountains.setMatrixAt(k, m);
  }
  group.add(mountains);
}

// Build the full renderable track. Returns {cl, group, def, boxSpots, padSpots, grid}.
export function buildTrack(index) {
  const def = TRACKS[index % TRACKS.length];
  const theme = def.theme;
  const cl = buildCenterline(def);
  const group = new THREE.Group();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: theme.ground })
  );
  ground.position.y = -0.05;
  group.add(ground);

  const vc = { vertexColors: true };
  const off = new THREE.MeshLambertMaterial({ color: theme.offroad, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(ribbon(cl, -WALL, -ROAD_HALF - CURB, 0.01), off));
  group.add(new THREE.Mesh(ribbon(cl, ROAD_HALF + CURB, WALL, 0.01), off));

  const roadTex = roadTexture(theme.road, theme.night);
  const road = new THREE.Mesh(
    ribbon(cl, -ROAD_HALF, ROAD_HALF, 0.03, null, 8),
    new THREE.MeshLambertMaterial({ map: roadTex, side: THREE.DoubleSide })
  );
  group.add(road);

  const ca = new THREE.Color(theme.curbA), cb = new THREE.Color(theme.curbB);
  const curbColor = (i, c) => c.copy(Math.floor(i / 2) % 2 ? ca : cb);
  const CurbMat = theme.night ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
  const curbMat = new CurbMat({ ...vc, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(ribbon(cl, -ROAD_HALF - CURB, -ROAD_HALF, 0.04, curbColor), curbMat));
  group.add(new THREE.Mesh(ribbon(cl, ROAD_HALF, ROAD_HALF + CURB, 0.04, curbColor), curbMat));

  const wa = new THREE.Color(theme.wallA), wb = new THREE.Color(theme.wallB);
  const wallColor = (i, c) => c.copy(Math.floor(i / 3) % 2 ? wa : wb);
  const wallMat = new (theme.night ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial)({ ...vc, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(wall(cl, -WALL, 1.3, wallColor), wallMat));
  group.add(new THREE.Mesh(wall(cl, WALL, 1.3, wallColor), wallMat));

  // Start/finish line and gantry.
  const start = cl.pointAt(0);
  const heading = start.heading;
  const checker = checkerTexture(9);
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_HALF * 2, 3).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: checker })
  );
  line.position.set(start.x, 0.05, start.z);
  line.rotation.y = heading;
  group.add(line);
  const gantry = new THREE.Group();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 9, 8), poleMat);
    pole.position.set(sx * (ROAD_HALF + 2.5), 4.5, 0);
    gantry.add(pole);
  }
  const bannerTex = checkerTexture(12);
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry((ROAD_HALF + 2.5) * 2, 1.8, 0.5),
    new THREE.MeshBasicMaterial({ map: bannerTex })
  );
  banner.position.y = 8.5;
  gantry.add(banner);
  // rotation.y = heading points local +z along the track, so local x spans the road.
  gantry.position.set(start.x, 0, start.z);
  gantry.rotation.y = heading;
  group.add(gantry);

  decorations(cl, theme, group, index * 97 + 13);

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
    g.fillStyle = '#ff7a00';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffe14d';
    for (let k = 0; k < 3; k++) {
      const y = 10 + k * 40;
      g.beginPath();
      g.moveTo(8, y + 30); g.lineTo(w / 2, y); g.lineTo(w - 8, y + 30); g.lineTo(w - 8, y + 40);
      g.lineTo(w / 2, y + 12); g.lineTo(8, y + 40); g.closePath(); g.fill();
    }
  });
  for (const pad of padSpots) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 7).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: padTex, transparent: true })
    );
    m.position.set(pad.x, 0.06, pad.z);
    m.rotation.y = pad.heading + Math.PI;
    group.add(m);
  }

  // Starting grid: two columns, rows behind the line.
  const grid = [];
  for (let k = 0; k < 8; k++) {
    const row = Math.floor(k / 2);
    const s = cl.n - 4 - row * 4 - (k % 2) * 2;
    grid.push(cl.pointAt(s, k % 2 ? -3.5 : 3.5));
    grid[k].idx = s;
  }

  return { def, theme, cl, group, boxSpots, padSpots, grid };
}
