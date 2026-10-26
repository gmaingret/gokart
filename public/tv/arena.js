import * as THREE from 'three';
import {
  TRACKS, WALL, rng, fbm, smooth, canvasTexture, groundTexture, roadTexture, bannerTexture,
  glowTexture, instanced, scenery, grandstandAt,
} from './track.js';

// Balloon-battle arena: a round, walled bowl with pillars and crates to hide
// behind. It reuses the visual theme of the selected track.

export const ARENA_RADIUS = 72;

// Obstacles are circles for collision (boxes get a bounding circle).
function layout() {
  const obstacles = [{ x: 0, z: 0, r: 6, kind: 'tower' }];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    obstacles.push({ x: Math.cos(a) * 33, z: Math.sin(a) * 33, r: 3.6, kind: 'pillar' });
  }
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    obstacles.push({ x: Math.cos(a) * 54, z: Math.sin(a) * 54, r: 2.4, kind: 'crate' });
  }
  const boxes = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    boxes.push({ x: Math.cos(a) * 18, z: Math.sin(a) * 18 });
  }
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    boxes.push({ x: Math.cos(a) * 44, z: Math.sin(a) * 44 });
  }
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    boxes.push({ x: Math.cos(a) * 63, z: Math.sin(a) * 63 });
  }
  // Spawn ring, everyone facing the centre.
  const spawns = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * 60, z = Math.sin(a) * 60;
    spawns.push({ x, z, heading: Math.atan2(-x, -z), idx: 0 });
  }
  return { obstacles, boxes, spawns };
}

// Pure collision helpers (no THREE), unit-testable.
export function makeArenaPhysics(R = ARENA_RADIUS, obstacles = layout().obstacles) {
  // Push a circle (o.x, o.z, radius r) out of walls/obstacles.
  // Returns the outward normals of everything it touched.
  function constrain(o, r) {
    const hits = [];
    const d = Math.hypot(o.x, o.z);
    const lim = R - r;
    if (d > lim) {
      const nx = -o.x / d, nz = -o.z / d;
      o.x = -nx * lim;
      o.z = -nz * lim;
      hits.push({ nx, nz });
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
  // Is the straight line from a to b blocked by an obstacle? (AI line of sight)
  function blocked(ax, az, bx, bz, pad = 1) {
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    for (const ob of obstacles) {
      const t = Math.max(0, Math.min(1, ((ob.x - ax) * dx + (ob.z - az) * dz) / len2));
      const px = ax + dx * t - ob.x, pz = az + dz * t - ob.z;
      if (px * px + pz * pz < (ob.r + pad) ** 2) return ob;
    }
    return null;
  }
  return { R, obstacles, constrain, blocked };
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
  const R = ARENA_RADIUS;
  const { obstacles, boxes, spawns } = layout();
  const physics = makeArenaPhysics(R, obstacles);
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
    if (theme.snowcaps && h > hills * 0.75) c.lerp(white, Math.min(1, (h - hills * 0.75) / 6));
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

  // Arena floor with painted rings, plus a striped kerb around the edge.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 0.5, 72).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: floorTexture(theme) }));
  floor.position.y = 0.03;
  group.add(floor);
  const grain = roadTexture(theme.road, theme.night);
  void grain;
  const kerbGeo = new THREE.RingGeometry(R - 2, R, 64, 1).rotateX(-Math.PI / 2);
  const kc = new Float32Array(kerbGeo.attributes.position.count * 3);
  const ka = new THREE.Color(theme.curbA), kb = new THREE.Color(theme.curbB);
  for (let i = 0; i < kerbGeo.attributes.position.count; i++) {
    const x = kerbGeo.attributes.position.getX(i), z = kerbGeo.attributes.position.getZ(i);
    const seg = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 32);
    const col = seg % 2 ? ka : kb;
    kc[i * 3] = col.r; kc[i * 3 + 1] = col.g; kc[i * 3 + 2] = col.b;
  }
  kerbGeo.setAttribute('color', new THREE.BufferAttribute(kc, 3));
  const KerbMat = theme.night ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
  const kerb = new THREE.Mesh(kerbGeo, new KerbMat({ vertexColors: true }));
  kerb.position.y = 0.05;
  group.add(kerb);

  // Banner wall + rail.
  const banner = bannerTexture(theme.banner);
  banner.repeat.set((2 * Math.PI * R) / 24, 1);
  const BannerMat = theme.night ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.6, 96, 1, true).translate(0, 0.8, 0), new BannerMat({ map: banner, side: THREE.DoubleSide }));
  group.add(wall);
  const rail = new THREE.Mesh(
    new THREE.TorusGeometry(R, 0.2, 6, 96).rotateX(Math.PI / 2).translate(0, 1.72, 0),
    new THREE.MeshLambertMaterial({ color: theme.night ? 0x00e5ff : 0xdedede, emissive: theme.night ? 0x00a0b0 : 0x000000 })
  );
  group.add(rail);

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
  const update = (time, excitement = 0) => {
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
