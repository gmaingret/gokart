import * as THREE from 'three';
import {
  TRACKS, WALL, rng, fbm, smooth, canvasTexture, groundTexture, roadTexture, bannerTexture,
  glowTexture, instanced, scenery, grandstandAt, waterPlane, finishGroup,
} from './track.js';

// Balloon-battle arenas: walled floors of different shapes (round bowl,
// square, ring around an island, cross, and a pyramid with a raised centre
// platform reached by ramps). They reuse the visual theme of the selected track.

export const ARENA_RADIUS = 72;
export const SHAPES = ['circle', 'square', 'ring', 'cross', 'pyramid'];
// Which shape each track's arena uses.
const SHAPE_OF = ['circle', 'square', 'ring', 'cross', 'pyramid', 'circle', 'square', 'cross', 'pyramid', 'ring'];

const PLAT = 18, PLAT_H = 4, RAMP_L = 16, RAMP_W = 5; // pyramid centre
const ARM = 24; // cross arm half-width

const polar = (n, r, off = 0) => Array.from({ length: n }, (_, k) => {
  const a = off + (k / n) * Math.PI * 2;
  return [Math.cos(a) * r, Math.sin(a) * r];
});
// Square of half-size h with corners cut by c (counter-clockwise).
const chamfered = (h, c) => [[h, -h + c], [h, h - c], [h - c, h], [-h + c, h], [-h, h - c], [-h, -h + c], [-h + c, -h], [h - c, -h]];

// Outline polygon, obstacles, boxes and spawns for a shape.
export function layout(shape = 'circle') {
  let outline, obstacles = [], boxes = [], spawns = [];
  const face = (x, z, y = 0) => ({ x, z, y, heading: Math.atan2(-x, -z), idx: 0 });
  if (shape === 'circle') {
    outline = polar(48, ARENA_RADIUS);
    obstacles.push({ x: 0, z: 0, r: 6, kind: 'tower' });
    for (const [x, z] of polar(4, 33, Math.PI / 4)) obstacles.push({ x, z, r: 3.6, kind: 'pillar' });
    for (const [x, z] of polar(8, 54, Math.PI / 8)) obstacles.push({ x, z, r: 2.4, kind: 'crate' });
    for (const [x, z] of [...polar(4, 18), ...polar(8, 44), ...polar(8, 63, Math.PI / 8)]) boxes.push({ x, z });
    spawns = polar(8, 60, Math.PI / 8).map(([x, z]) => face(x, z));
  } else if (shape === 'square') {
    outline = chamfered(66, 16);
    obstacles.push({ x: 0, z: 0, r: 6, kind: 'tower' });
    for (const [x, z] of polar(4, 45, Math.PI / 4)) obstacles.push({ x, z, r: 3.6, kind: 'pillar' });
    for (const [x, z] of polar(4, 50)) obstacles.push({ x, z, r: 2.4, kind: 'crate' });
    for (const [x, z] of [...polar(4, 18), ...polar(8, 34, Math.PI / 8), ...polar(4, 62, Math.PI / 4)]) boxes.push({ x, z });
    spawns = polar(8, 56, Math.PI / 8).map(([x, z]) => face(x, z));
  } else if (shape === 'ring') {
    outline = polar(48, 78);
    obstacles.push({ x: 0, z: 0, r: 24, kind: 'island' });
    for (const [x, z] of polar(4, 50, Math.PI / 4)) obstacles.push({ x, z, r: 3.6, kind: 'pillar' });
    for (const [x, z] of polar(4, 66)) obstacles.push({ x, z, r: 2.4, kind: 'crate' });
    for (const [x, z] of [...polar(8, 34, Math.PI / 8), ...polar(8, 60)]) boxes.push({ x, z });
    spawns = polar(8, 56, Math.PI / 8 + 0.2).map(([x, z]) => {
      // Ring: start facing along the lane rather than at the island.
      const s = face(x, z);
      s.heading = Math.atan2(-z, x);
      return s;
    });
  } else if (shape === 'cross') {
    const L = 76, a = ARM;
    outline = [[L, -a], [L, a], [a, a], [a, L], [-a, L], [-a, a], [-L, a], [-L, -a], [-a, -a], [-a, -L], [a, -L], [a, -a]];
    obstacles.push({ x: 0, z: 0, r: 6, kind: 'tower' });
    for (const [x, z] of polar(4, 34)) obstacles.push({ x, z, r: 3.6, kind: 'pillar' });
    for (const [x, z] of polar(4, Math.SQRT2 * a, Math.PI / 4)) obstacles.push({ x, z, r: 1, kind: 'post' });
    for (const [x, z] of polar(4, 58)) obstacles.push({ x, z, r: 2.4, kind: 'crate' });
    for (const [x, z] of polar(4, 16, Math.PI / 4)) boxes.push({ x, z });
    for (const [x, z] of polar(4, 46)) {
      const ux = -z / 46, uz = x / 46;
      boxes.push({ x: x + ux * 12, z: z + uz * 12 }, { x: x - ux * 12, z: z - uz * 12 });
    }
    for (const [x, z] of polar(4, 70)) boxes.push({ x, z });
    for (const [x, z] of polar(4, 64)) {
      const ux = -z / 64, uz = x / 64;
      spawns.push(face(x + ux * 11, z + uz * 11), face(x - ux * 11, z - uz * 11));
    }
  } else {
    // Pyramid: square floor, raised centre platform with a ramp on each side.
    outline = chamfered(70, 14);
    for (const [x, z] of polar(4, 56)) obstacles.push({ x, z, r: 3.2, kind: 'pillar' });
    for (const [x, z] of polar(4, 64, Math.PI / 4)) obstacles.push({ x, z, r: 2.4, kind: 'crate' });
    for (const [x, z] of polar(4, 9 * Math.SQRT2, Math.PI / 4)) boxes.push({ x, z, y: PLAT_H });
    for (const [x, z] of [...polar(8, 44, Math.PI / 8), ...polar(4, 62)]) boxes.push({ x, z });
    spawns = polar(8, 56, Math.PI / 8).map(([x, z]) => face(x, z));
  }
  return { shape, outline, obstacles, boxes, spawns };
}

// The pyramid's ramps: each runs from the platform edge outward along an axis.
function ramps() {
  return [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([ux, uz]) => ({ ux, uz }));
}

// Pure collision helpers (no THREE), unit-testable.
export function makeArenaPhysics(shape = 'circle', L = layout(shape)) {
  const { outline, obstacles } = L;
  const walls = [];
  // Boundary: one-sided segments whose normal points into the arena.
  const addWall = (ax, az, bx, bz, nSign, top0 = Infinity, top1 = top0) => {
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    let nx = -uz, nz = ux;
    // Point the normal toward the origin (inside), or away from it (nSign -1).
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if ((-mx * nx - mz * nz) * nSign < 0) ((nx = -nx), (nz = -nz));
    walls.push({ ax, az, bx, bz, ux, uz, nx, nz, len, top0, top1 });
  };
  outline.forEach(([ax, az], i) => {
    const [bx, bz] = outline[(i + 1) % outline.length];
    addWall(ax, az, bx, bz, 1);
  });
  // At convex corners extend each segment a little so nothing slips out
  // through the vertex; re-entrant corners (the cross) are left exact.
  const nb = walls.length;
  walls.forEach((w, i) => {
    const prev = walls[(i - 1 + nb) % nb], next = walls[(i + 1) % nb];
    w.t0 = w.ux * prev.nx + w.uz * prev.nz > 1e-6 ? -3 / w.len : 0;
    w.t1 = next.ux * w.nx + next.uz * w.nz > 1e-6 ? 1 + 3 / w.len : 1;
  });
  let R = 0;
  for (const [x, z] of outline) R = Math.max(R, Math.hypot(x, z));
  const pyramid = L.shape === 'pyramid';
  const rampList = pyramid ? ramps() : [];
  if (pyramid) {
    // Platform faces block karts below the deck (with gaps for the ramps),
    // and the ramp sides block karts beside them. From above you can drive off.
    for (const { ux, uz } of rampList) {
      const vx = -uz, vz = ux; // along the face
      const fx = ux * PLAT, fz = uz * PLAT;
      addWall(fx + vx * PLAT, fz + vz * PLAT, fx + vx * RAMP_W, fz + vz * RAMP_W, -1, PLAT_H);
      addWall(fx - vx * RAMP_W, fz - vz * RAMP_W, fx - vx * PLAT, fz - vz * PLAT, -1, PLAT_H);
      for (const s of [1, -1]) {
        const ax = fx + vx * RAMP_W * s, az = fz + vz * RAMP_W * s;
        const w = { ax, az, bx: ax + ux * RAMP_L, bz: az + uz * RAMP_L };
        const len = RAMP_L;
        walls.push({ ...w, ux, uz, nx: vx * s, nz: vz * s, len, top0: PLAT_H, top1: 0 });
      }
    }
  }

  // Floor height (the platform and its ramps in the pyramid; flat elsewhere).
  function groundAt(x, z) {
    if (!pyramid) return 0;
    if (Math.abs(x) <= PLAT && Math.abs(z) <= PLAT) return PLAT_H;
    for (const { ux, uz } of rampList) {
      const a = x * ux + z * uz - PLAT, b = Math.abs(-x * uz + z * ux);
      if (a >= 0 && a <= RAMP_L && b <= RAMP_W) return PLAT_H * (1 - a / RAMP_L);
    }
    return 0;
  }

  // Push a circle (o.x, o.z, radius r, height o.y) out of walls/obstacles.
  // Returns the outward normals of everything it touched.
  function constrain(o, r) {
    const hits = [];
    const y = o.y ?? 0;
    for (const w of walls) {
      const dx = o.x - w.ax, dz = o.z - w.az;
      const t = (dx * w.ux + dz * w.uz) / w.len;
      if (t < (w.t0 ?? 0) || t > (w.t1 ?? 1)) continue;
      const s = dx * w.nx + dz * w.nz;
      if (s >= r || s < -4) continue;
      if (w.top0 !== Infinity && y > w.top0 + (w.top1 - w.top0) * t - 0.5) continue;
      const push = r - s;
      o.x += w.nx * push;
      o.z += w.nz * push;
      hits.push({ nx: w.nx, nz: w.nz });
    }
    for (const ob of obstacles) {
      const dx = o.x - ob.x, dz = o.z - ob.z;
      const dd = Math.hypot(dx, dz);
      const min = ob.r + r;
      if (dd < min && dd > 1e-6) {
        const nx = dx / dd, nz = dz / dd;
        o.x = ob.x + nx * min;
        o.z = ob.z + nz * min;
        hits.push({ nx, nz });
      }
    }
    return hits;
  }

  const cross = (ax, az, bx, bz, cx, cz, dx, dz) => {
    const d = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
    if (Math.abs(d) < 1e-9) return false;
    const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / d;
    const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / d;
    return t > 0 && t < 1 && u > 0 && u < 1;
  };

  // Is the straight line from a to b blocked? (AI line of sight.) Returns a
  // circle to steer around: the obstacle, or the end of the wall in the way.
  function blocked(ax, az, bx, bz, pad = 1, y = 0) {
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    for (const ob of obstacles) {
      const t = Math.max(0, Math.min(1, ((ob.x - ax) * dx + (ob.z - az) * dz) / len2));
      const px = ax + dx * t - ob.x, pz = az + dz * t - ob.z;
      if (px * px + pz * pz < (ob.r + pad) ** 2) return ob;
    }
    for (const w of walls) {
      if (w.top0 !== w.top1) continue; // ramp sides are low; ignore for sight
      if (w.top0 !== Infinity && y > w.top0 - 0.5) continue; // already up on the platform
      if (!cross(ax, az, bx, bz, w.ax, w.az, w.bx, w.bz)) continue;
      // Steer around whichever end of the wall is closer to the line.
      const side = (x, z) => Math.abs((x - ax) * dz - (z - az) * dx) / Math.sqrt(len2);
      const e = side(w.ax, w.az) < side(w.bx, w.bz) ? [w.ax, w.az] : [w.bx, w.bz];
      return { x: e[0], z: e[1], r: 2 };
    }
    return null;
  }

  // Point-in-arena test (outline polygon minus obstacles).
  function inside(x, z, margin = 3) {
    let c = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const [xi, zi] = outline[i], [xj, zj] = outline[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    }
    if (!c) return false;
    for (const w of walls) {
      if (w.top0 !== Infinity) continue;
      const t = ((x - w.ax) * w.ux + (z - w.az) * w.uz) / w.len;
      if (t >= 0 && t <= 1 && (x - w.ax) * w.nx + (z - w.az) * w.nz < margin) return false;
    }
    return !obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + margin);
  }

  function randomPoint(random = Math.random) {
    for (let k = 0; k < 50; k++) {
      const x = (random() * 2 - 1) * R, z = (random() * 2 - 1) * R;
      if (inside(x, z, 5) && groundAt(x, z) === 0) return { x, z };
    }
    return { x: L.spawns[0].x, z: L.spawns[0].z };
  }

  // An intermediate target for a kart at (x, z, y) heading for (gx, gz):
  // in the pyramid, getting onto the platform means using a ramp.
  function waypoint(x, z, y, gx, gz) {
    if (!pyramid || groundAt(gx, gz) < PLAT_H - 0.1 || y > PLAT_H - 1) return null;
    let best = null, bd = Infinity;
    for (const { ux, uz } of rampList) {
      const foot = { x: ux * (PLAT + RAMP_L + 6), z: uz * (PLAT + RAMP_L + 6) };
      const d = Math.hypot(foot.x - x, foot.z - z);
      if (d < bd) ((bd = d), (best = { ux, uz, foot }));
    }
    const a = x * best.ux + z * best.uz, b = Math.abs(-x * best.uz + z * best.ux);
    // Lined up in front of (or on) the ramp: drive straight up it.
    if (b < RAMP_W - 1 && a > PLAT - 1) return { x: 0, z: 0 };
    return best.foot;
  }

  return { shape: L.shape, R, outline, obstacles, walls, constrain, blocked, groundAt, inside, randomPoint, waypoint, platform: pyramid ? { half: PLAT, h: PLAT_H, rampL: RAMP_L, rampW: RAMP_W } : null };
}

function crateTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#b07a3c';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6b4520';
    g.lineWidth = 10;
    g.strokeRect(5, 5, w - 10, h - 10);
    g.beginPath();
    g.moveTo(8, 8); g.lineTo(w - 8, h - 8);
    g.moveTo(w - 8, 8); g.lineTo(8, h - 8);
    g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.1)';
    for (let y = 20; y < h; y += 22) g.fillRect(0, y, w, 3);
  }, false);
}

function floorTexture(theme) {
  const road = theme.road;
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = road;
    g.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 16000; i++) {
      const v = r();
      g.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.12})` : `rgba(0,0,0,${(0.5 - v) * 0.18})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    // Painted target rings + spokes, centred.
    const c = w / 2;
    const cols = theme.banner;
    for (let k = 6; k >= 1; k--) {
      g.strokeStyle = cols[k % cols.length];
      g.globalAlpha = 0.55;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(c, c, (k / 6) * (w / 2 - 6), 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 0.25;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(c, c);
      g.lineTo(c + Math.cos(a) * w / 2, c + Math.sin(a) * w / 2);
      g.stroke();
    }
    g.globalAlpha = 1;
  }, false);
}

export function buildArena(index) {
  const def = TRACKS[index % TRACKS.length];
  const theme = def.theme;
  const L = layout(SHAPE_OF[index % SHAPE_OF.length]);
  const { obstacles, boxes, spawns } = L;
  const physics = makeArenaPhysics(L.shape, L);
  const R = physics.R;
  const group = new THREE.Group();
  const seed = index * 131 + 7;
  const hills = theme.hills ?? 15;
  const distAt = (x, z) => Math.abs(Math.hypot(x, z) - (R - WALL));
  const heightAt = (x, z) => {
    const d = Math.hypot(x, z) - R;
    if (d < 14) return -0.3;
    return -0.3 + smooth(14, 110, d) * hills * (0.35 + fbm(x / 140, z / 140, seed, 4) * 1.1);
  };

  // Terrain around the bowl.
  const SIZE = 1500, SEG = 130;
  const tGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
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
  group.add(new THREE.Mesh(tGeo, terrainMat));
  if (theme.water) group.add(waterPlane(theme, 0, 0));

  // Arena floor (the outline polygon) with painted rings.
  const shape = new THREE.Shape(physics.outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const floorGeo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  {
    const fp = floorGeo.attributes.position, fuv = floorGeo.attributes.uv;
    for (let i = 0; i < fp.count; i++) fuv.setXY(i, fp.getX(i) / (2 * R) + 0.5, 0.5 - fp.getZ(i) / (2 * R));
  }
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({ map: floorTexture(theme) }));
  floor.position.y = 0.03;
  floor.receiveShadow = true;
  group.add(floor);

  // Striped kerb, banner wall and rail along every boundary segment.
  const ka = new THREE.Color(theme.curbA), kb = new THREE.Color(theme.curbB);
  const kPos = [], kCol = [], wPos = [], wUv = [], rPos = [];
  let run = 0;
  const tri6 = (arr, a, b, c, d) => arr.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (const w of physics.walls) {
    if (w.top0 !== Infinity) continue;
    const pieces = Math.max(1, Math.round(w.len / 4));
    for (let k = 0; k < pieces; k++) {
      const t0 = k / pieces, t1 = (k + 1) / pieces;
      const x0 = w.ax + (w.bx - w.ax) * t0, z0 = w.az + (w.bz - w.az) * t0;
      const x1 = w.ax + (w.bx - w.ax) * t1, z1 = w.az + (w.bz - w.az) * t1;
      tri6(kPos, [x0, 0.05, z0], [x0 + w.nx * 2, 0.05, z0 + w.nz * 2], [x1 + w.nx * 2, 0.05, z1 + w.nz * 2], [x1, 0.05, z1]);
      const col = (Math.floor(run / 4) + k) % 2 ? ka : kb;
      for (let v = 0; v < 6; v++) kCol.push(col.r, col.g, col.b);
    }
    tri6(wPos, [w.ax, 0, w.az], [w.bx, 0, w.bz], [w.bx, 1.6, w.bz], [w.ax, 1.6, w.az]);
    const u0 = run / 24, u1 = (run + w.len) / 24;
    wUv.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
    const o = 0.3;
    tri6(rPos, [w.ax - w.nx * o, 1.72, w.az - w.nz * o], [w.bx - w.nx * o, 1.72, w.bz - w.nz * o], [w.bx + w.nx * o, 1.72, w.bz + w.nz * o], [w.ax + w.nx * o, 1.72, w.az + w.nz * o]);
    run += w.len;
  }
  const kerbGeo = new THREE.BufferGeometry();
  kerbGeo.setAttribute('position', new THREE.Float32BufferAttribute(kPos, 3));
  kerbGeo.setAttribute('color', new THREE.Float32BufferAttribute(kCol, 3));
  kerbGeo.computeVertexNormals();
  const KerbMat = theme.night ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
  const kerb = new THREE.Mesh(kerbGeo, new KerbMat({ vertexColors: true, side: THREE.DoubleSide }));
  group.add(kerb);

  const banner = bannerTexture(theme.banner);
  const BannerMat = theme.night ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
  wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wUv, 2));
  wallGeo.computeVertexNormals();
  const wall = new THREE.Mesh(wallGeo, new BannerMat({ map: banner, side: THREE.DoubleSide }));
  group.add(wall);
  const railGeo = new THREE.BufferGeometry();
  railGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
  railGeo.computeVertexNormals();
  const rail = new THREE.Mesh(railGeo, new THREE.MeshLambertMaterial({ color: theme.night ? 0x00e5ff : 0xdedede, emissive: theme.night ? 0x00a0b0 : 0x000000, side: THREE.DoubleSide }));
  group.add(rail);

  // Pyramid: raised centre platform with striped ramps.
  if (physics.platform) {
    const { half, h, rampL, rampW } = physics.platform;
    const stone = new THREE.MeshLambertMaterial({ color: theme.night ? 0x2a2050 : 0xc8b89a });
    const side = new BannerMat({ map: bannerTexture(theme.banner) });
    side.map.repeat.set(3, 1);
    const block = new THREE.Mesh(new THREE.BoxGeometry(half * 2, h, half * 2), [side, side, stone, stone, side, side]);
    block.position.y = h / 2;
    block.userData.cast = true;
    group.add(block);
    const topGeo = new THREE.PlaneGeometry(half * 2, half * 2).rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(topGeo, new THREE.MeshLambertMaterial({ map: floorTexture(theme) }));
    top.position.y = h + 0.02;
    group.add(top);
    const edgeMat = new KerbMat({ color: theme.curbB });
    for (const [x, z, w, d] of [[0, half - 0.6, half * 2, 1.2], [0, -half + 0.6, half * 2, 1.2], [half - 0.6, 0, 1.2, half * 2], [-half + 0.6, 0, 1.2, half * 2]]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), edgeMat);
      e.position.set(x, h + 0.05, z);
      group.add(e);
    }
    const stripes = canvasTexture(128, 128, (g, w, hh) => {
      g.fillStyle = '#ffcf33';
      g.fillRect(0, 0, w, hh);
      g.fillStyle = '#1d1d1d';
      for (let k = -2; k < 6; k++) {
        g.beginPath();
        g.moveTo(k * 32, 0); g.lineTo(k * 32 + 16, 0); g.lineTo(k * 32 + 16 + hh, hh); g.lineTo(k * 32 + hh, hh);
        g.fill();
      }
    });
    const rampMat = new THREE.MeshLambertMaterial({ map: stripes, side: THREE.DoubleSide });
    for (const [ux, uz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const vx = -uz, vz = ux;
      const P = (a, b, y) => [ux * a + vx * b, y, uz * a + vz * b];
      const pos = [], uv = [];
      const q = (A, B, C, D, uu, vv) => {
        pos.push(...A, ...B, ...C, ...A, ...C, ...D);
        uv.push(0, 0, uu, 0, uu, vv, 0, 0, uu, vv, 0, vv);
      };
      q(P(half, -rampW, h + 0.03), P(half, rampW, h + 0.03), P(half + rampL, rampW, 0.04), P(half + rampL, -rampW, 0.04), 3, 4);
      for (const s2 of [-1, 1]) {
        pos.push(...P(half, s2 * rampW, 0), ...P(half + rampL, s2 * rampW, 0.04), ...P(half, s2 * rampW, h + 0.03));
        uv.push(0, 0, 1, 0, 0, 0.3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, rampMat);
      m.receiveShadow = true;
      group.add(m);
    }
  }

  // Obstacles.
  const stripeMat = new BannerMat({ map: bannerTexture(theme.banner) });
  const stoneMat = new THREE.MeshLambertMaterial({ color: theme.night ? 0x221c40 : 0xb8b2a6 });
  const crateMat = new THREE.MeshLambertMaterial({ map: crateTexture() });
  const glowMat = new THREE.MeshBasicMaterial({ color: theme.night ? 0xff2bd6 : 0xffcf33 });
  for (const ob of obstacles) {
    if (ob.kind === 'tower') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(ob.r, ob.r + 0.6, 3, 24), stoneMat);
      base.position.set(ob.x, 1.5, ob.z);
      group.add(base);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(ob.r + 0.02, ob.r + 0.02, 1.2, 24, 1, true), stripeMat);
      band.material.map.repeat.set(1.2, 1);
      band.position.set(ob.x, 2, ob.z);
      group.add(band);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 9, 12), stoneMat);
      top.position.set(ob.x, 7.5, ob.z);
      group.add(top);
      // Giant balloon on top: the arena's mascot.
      const bal = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 18).scale(1, 1.2, 1), new THREE.MeshStandardMaterial({ color: 0xff4f7b, roughness: 0.25, metalness: 0.1 }));
      bal.position.set(ob.x, 15.5, ob.z);
      bal.userData.bob = true;
      group.add(bal);
    } else if (ob.kind === 'island') {
      // Ring arena: a raised island in the middle with the mascot on top.
      const side = new THREE.Mesh(new THREE.CylinderGeometry(ob.r, ob.r + 0.8, 2.4, 64, 1, true), new BannerMat({ map: bannerTexture(theme.banner), side: THREE.DoubleSide }));
      side.material.map.repeat.set((2 * Math.PI * ob.r) / 24, 1);
      side.position.set(ob.x, 1.2, ob.z);
      group.add(side);
      const topTex = groundTexture(theme.groundTex);
      topTex.repeat.set(6, 6);
      const top = new THREE.Mesh(new THREE.CircleGeometry(ob.r, 64).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: theme.grass ?? theme.ground2 ?? theme.ground, map: topTex }));
      top.position.set(ob.x, 2.4, ob.z);
      group.add(top);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 12, 12), stoneMat);
      col.position.set(ob.x, 8.4, ob.z);
      group.add(col);
      const bal = new THREE.Mesh(new THREE.SphereGeometry(3.6, 24, 18).scale(1, 1.2, 1), new THREE.MeshStandardMaterial({ color: 0xff4f7b, roughness: 0.25, metalness: 0.1 }));
      bal.position.set(ob.x, 15.5, ob.z);
      bal.userData.bob = true;
      group.add(bal);
      for (const [x, z] of polar(6, ob.r - 5)) {
        const p = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 8), stoneMat);
        p.position.set(ob.x + x, 4.9, ob.z + z);
        group.add(p);
      }
    } else if (ob.kind === 'post') {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(ob.r, ob.r, 2.6, 12), stoneMat);
      p.position.set(ob.x, 1.3, ob.z);
      group.add(p);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(ob.r * 0.9, 12, 8), glowMat);
      cap.position.set(ob.x, 2.8, ob.z);
      group.add(cap);
    } else if (ob.kind === 'pillar') {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(ob.r, ob.r, 4, 20), stoneMat);
      p.position.set(ob.x, 2, ob.z);
      group.add(p);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(ob.r + 0.1, 0.2, 6, 24).rotateX(Math.PI / 2), glowMat);
      ring.position.set(ob.x, 4, ob.z);
      group.add(ring);
    } else {
      const cr = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 3.2), crateMat);
      cr.position.set(ob.x, 1.6, ob.z);
      cr.rotation.y = Math.atan2(ob.x, ob.z);
      group.add(cr);
      const cr2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), crateMat);
      cr2.position.set(ob.x, 4.1, ob.z);
      cr2.rotation.y = Math.atan2(ob.x, ob.z) + 0.5;
      group.add(cr2);
    }
  }

  // Light pools on the floor at night.
  if (theme.night) {
    const glow = glowTexture();
    const pools = obstacles.map((o, k) => [o.x, 0.07, o.z, 1.2 + o.r * 0.4, 0, undefined, k]);
    const poolGeo = new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2);
    group.add(instanced(poolGeo, new THREE.MeshBasicMaterial({ color: 0xff2bd6, map: glow, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }), pools));
  }

  // Grandstands outside the wall, facing in.
  const crowdUpdates = [];
  for (const a of [0.3, Math.PI * 0.8, Math.PI * 1.35]) {
    const x = Math.cos(a) * (R + 9), z = Math.sin(a) * (R + 9);
    crowdUpdates.push(grandstandAt(group, theme, x, z, Math.atan2(-x, -z)));
  }

  // Scenery beyond the stands. A ring "centerline" just inside the wall gives
  // scenery() its bounds; everything inside the bowl is excluded explicitly.
  const ringN = 180;
  const px = new Float32Array(ringN), pz = new Float32Array(ringN);
  for (let i = 0; i < ringN; i++) {
    const a = (i / ringN) * Math.PI * 2;
    px[i] = Math.cos(a) * (R - WALL);
    pz[i] = Math.sin(a) * (R - WALL);
  }
  const avoid = [[0, 0, R + 12]];
  for (const a of [0.3, Math.PI * 0.8, Math.PI * 1.35]) avoid.push([Math.cos(a) * (R + 9), Math.sin(a) * (R + 9), 30]);
  scenery({ n: ringN, px, pz }, theme, group, seed, heightAt, (x, z) => Math.max(distAt(x, z), 0), avoid);

  const bobbers = group.children.filter((o) => o.userData.bob);
  // Obstacles and the mascot balloon cast shadows onto the floor.
  for (const o of group.children) if (o.isMesh && !o.isInstancedMesh && o !== floor && o !== kerb && o !== wall && o.geometry.type !== 'PlaneGeometry') o.userData.cast = true;
  const animate = finishGroup(group);
  const update = (time, excitement = 0) => {
    animate(time);
    for (const u of crowdUpdates) u(time, excitement);
    for (const b of bobbers) b.position.y = 15.5 + Math.sin(time * 1.3) * 0.6;
  };

  return {
    def,
    theme,
    arena: physics,
    group,
    boxSpots: boxes,
    padSpots: [],
    grid: spawns,
    center: new THREE.Vector3(0, 0, 0),
    setStartLights() {},
    update,
  };
}
