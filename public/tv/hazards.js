import * as THREE from 'three';
import { CURB } from './track.js';
import { KART_RADIUS } from './kart.js';

// Track-specific obstacles, listed per track as `hazards: [[kind, frac], ...]`:
//   rollers  — barrel, boulder, snowball, tumbleweed: roll back and forth across the road
//   geyser   — lava vent that rumbles, then erupts and launches karts
//   bumpers  — orb, gumdrop: fixed, springy, bounce karts away
//   crab     — scuttles sideways, nudges karts it touches

const ROLLERS = {
  barrel: { r: 1.15, period: 5.2, hit: 'spin' },
  boulder: { r: 1.8, period: 6.5, hit: 'spin' },
  snowball: { r: 1.6, period: 5.8, hit: 'spin' },
  tumbleweed: { r: 1.2, period: 4.2, hit: 'bump' },
};
const BUMPERS = { orb: 1.7, gumdrop: 1.9 };
const GEYSER_CYCLE = 4.5, GEYSER_R = 3.2;

function std(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
}

function lumpy(radius, detail, amount, seed) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 2.1 + seed) * Math.cos(v.y * 1.7 - seed) * Math.sin(v.z * 2.3 + seed * 0.5);
    v.multiplyScalar(1 + n * amount);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function rollerModel(kind) {
  const g = new THREE.Group();
  const spin = new THREE.Group(); // rotates as it rolls
  g.add(spin);
  if (kind === 'barrel') {
    // Axis along the track, so it rolls across the road.
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 2.4, 18), std(0x9a5a2a, { roughness: 0.8 }));
    body.rotation.x = Math.PI / 2;
    spin.add(body);
    for (const z of [-0.85, 0, 0.85]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.17, 0.07, 6, 24), std(0x444444, { metalness: 0.7, roughness: 0.4 }));
      hoop.position.z = z;
      spin.add(hoop);
    }
    const lid = new THREE.Mesh(new THREE.CircleGeometry(1.05, 18), std(0xc98a4a));
    lid.position.z = 1.21;
    spin.add(lid);
  } else if (kind === 'boulder') {
    spin.add(new THREE.Mesh(lumpy(1.8, 2, 0.18, 3), std(0x7a6a58, { flatShading: true, roughness: 0.95 })));
    const moss = new THREE.Mesh(lumpy(1.5, 1, 0.3, 7), std(0x4f8a3a, { flatShading: true, roughness: 1 }));
    moss.position.set(0.3, 0.7, 0.2);
    moss.scale.set(0.8, 0.45, 0.8);
    spin.add(moss);
  } else if (kind === 'snowball') {
    spin.add(new THREE.Mesh(lumpy(1.6, 3, 0.05, 1), std(0xf6faff, { roughness: 0.9 })));
  } else {
    // Tumbleweed: a tangle of twig rings.
    const twig = std(0xb08850, { roughness: 1 });
    for (let i = 0; i < 9; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.85 + (i % 3) * 0.15, 0.05, 4, 16), twig);
      t.rotation.set(i * 1.3, i * 0.7, i * 2.1);
      spin.add(t);
    }
    spin.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), std(0x8a6a3a, { wireframe: true })));
  }
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return { group: g, spin };
}

function bumperModel(kind, color) {
  const g = new THREE.Group();
  const r = BUMPERS[kind];
  let body;
  if (kind === 'orb') {
    body = new THREE.Mesh(
      new THREE.SphereGeometry(r, 24, 16),
      std(color, { emissive: color, emissiveIntensity: 0.45, roughness: 0.2, metalness: 0.3 })
    );
    body.position.y = r + 0.3;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 1.1, 0.5, 20), std(0x22223a, { metalness: 0.8, roughness: 0.3 }));
    base.position.y = 0.25;
    g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, 0.08, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.55;
    g.add(ring);
  } else {
    body = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(color, { roughness: 0.25 }));
    body.scale.y = 1.25;
    const sugar = new THREE.Points(
      new THREE.SphereGeometry(r * 1.01, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.1),
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.12 })
    );
    body.add(sugar);
  }
  body.castShadow = true;
  g.add(body);
  return { group: g, body };
}

function crabModel() {
  const g = new THREE.Group();
  const shell = std(0xe8502a, { roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 10), shell);
  body.scale.set(1.3, 0.55, 1);
  body.position.y = 0.75;
  g.add(body);
  const legs = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.9, 5), shell);
      leg.position.set(s * 0.95, 0.4, (i - 1) * 0.4);
      leg.rotation.z = s * 0.9;
      g.add(leg);
      legs.push(leg);
    }
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), shell);
    claw.scale.set(1, 0.7, 1.4);
    claw.position.set(s * 0.8, 0.9, 0.95);
    g.add(claw);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 4), shell);
    stalk.position.set(s * 0.25, 1.2, 0.5);
    g.add(stalk);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), std(0x111111, { roughness: 0.2 }));
    eye.position.set(s * 0.25, 1.42, 0.5);
    g.add(eye);
  }
  g.scale.setScalar(1.3);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return { group: g, legs };
}

function geyserModel() {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.55, 8, 20), std(0x2a2020, { flatShading: true, roughness: 1 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.15;
  rim.scale.z = 0.6;
  g.add(rim);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2, 20), new THREE.MeshBasicMaterial({ color: 0xff5a1f }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.12;
  g.add(pool);
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 2.2, 1, 16, 1, true).translate(0, 0.5, 0),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  column.visible = false;
  g.add(column);
  return { group: g, pool, column };
}

export class Hazards {
  constructor(scene, track, fx, sfx) {
    this.scene = scene;
    this.fx = fx;
    this.sfx = sfx;
    this.cl = track.cl;
    this.group = new THREE.Group();
    this.list = [];
    const cl = this.cl;
    const bumperColors = track.theme.banner.map((c) => new THREE.Color(c));
    (track.def.hazards || []).forEach(([kind, frac], n) => {
      const i = Math.floor(frac * cl.n);
      const reach = cl.hw[i] + CURB - 1.2;
      const base = { kind, i, x: cl.px[i], y: cl.py[i], z: cl.pz[i], phase: n * 1.7, reach, cd: new Map() };
      if (ROLLERS[kind]) {
        const m = rollerModel(kind);
        this.list.push({ ...base, type: 'roller', ...ROLLERS[kind], ...m, lat: 0 });
      } else if (BUMPERS[kind]) {
        // Two bumpers side by side, leaving gaps to thread through.
        for (const s of [-1, 1]) {
          const lat = s * cl.hw[i] * 0.5 + (n % 2 ? 1.5 : -1.5);
          const m = bumperModel(kind, bumperColors[(n * 2 + (s > 0 ? 1 : 0)) % bumperColors.length]);
          this.list.push({ ...base, type: 'bumper', r: BUMPERS[kind], ...m, lat, pulse: 0, cd: new Map() });
        }
      } else if (kind === 'crab') {
        const m = crabModel();
        this.list.push({ ...base, type: 'crab', r: 1.3, ...m, lat: 0, dir: 1, pause: 0 });
      } else if (kind === 'geyser') {
        // Alternate sides of the road so there's always a way past.
        const m = geyserModel();
        const lat = (n % 2 ? 1 : -1) * cl.hw[i] * 0.42;
        this.list.push({ ...base, type: 'geyser', r: GEYSER_R, ...m, lat, t: (n * 1.3) % GEYSER_CYCLE });
      }
    });
    for (const h of this.list) {
      this.place(h, h.lat);
      this.group.add(h.group);
    }
    scene.add(this.group);
  }

  place(h, lat) {
    const cl = this.cl, i = h.i;
    h.lat = lat;
    h.x = cl.px[i] + cl.nx[i] * lat;
    h.z = cl.pz[i] + cl.nz[i] * lat;
    h.group.position.set(h.x, h.y, h.z);
    h.group.rotation.y = Math.atan2(cl.tx[i], cl.tz[i]);
  }

  update(dt, karts, time) {
    const cl = this.cl;
    for (const h of this.list) {
      if (h.type === 'roller') {
        const w = (Math.PI * 2) / h.period;
        const lat = Math.sin(time * w + h.phase) * h.reach;
        const vel = Math.cos(time * w + h.phase) * h.reach * w;
        this.place(h, lat);
        // Rolling sideways = spinning about the track direction.
        h.spin.rotation.z -= (vel / h.r) * dt;
        h.spin.position.y = h.r + (h.kind === 'tumbleweed' ? Math.abs(Math.sin(time * 5 + h.phase)) * 1.2 : 0);
        if (h.kind === 'snowball' && Math.random() < 0.3) this.fx.dust(h.x, h.y + 0.3, h.z, 0xffffff, 0, 0);
        if (h.kind === 'boulder' && Math.random() < 0.15) this.fx.dust(h.x, h.y + 0.3, h.z, 0x8a7a5a, 0, 0);
      } else if (h.type === 'crab') {
        if (h.pause > 0) h.pause -= dt;
        else {
          let lat = h.lat + h.dir * 3.2 * dt;
          if (Math.abs(lat) > h.reach) {
            lat = Math.sign(lat) * h.reach;
            h.dir = -h.dir;
            h.pause = 0.6 + Math.random();
          }
          this.place(h, lat);
          h.legs.forEach((l, k) => (l.rotation.x = Math.sin(time * 18 + k) * 0.5));
        }
      } else if (h.type === 'bumper') {
        h.pulse = Math.max(0, h.pulse - dt * 3);
        const s = 1 + h.pulse * 0.25 + Math.sin(time * 3 + h.phase) * 0.03;
        h.body.scale.set(s, h.kind === 'gumdrop' ? 1.25 * (2 - s) : s, s);
        if (h.kind === 'orb') h.body.material.emissiveIntensity = 0.4 + h.pulse * 1.6;
      } else if (h.type === 'geyser') {
        h.t = (h.t + dt) % GEYSER_CYCLE;
        const warn = h.t > 2.4 && h.t < 3.3;
        h.active = h.t >= 3.3;
        h.warn = warn;
        const top = h.y + 0.3;
        h.pool.material.color.setHSL(0.04, 1, warn ? 0.5 + Math.sin(time * 30) * 0.15 : 0.45);
        if (warn && Math.random() < 0.5) this.fx.smoke(h.x, top, h.z, 0, 0, 0x553322, 0.5);
        h.column.visible = h.active;
        if (h.active) {
          const k = (h.t - 3.3) / (GEYSER_CYCLE - 3.3);
          h.column.scale.set(1, 14 * Math.sin(Math.PI * Math.min(1, k * 1.2)) + 0.5, 1);
          for (let n = 0; n < 3; n++) {
            this.fx.spawn(true, h.x, top + Math.random() * 6, h.z, { color: n ? 0xff7a2a : 0xffd84d, vy: 14, spread: 4, g: 12, drag: 0.6, life: 0.9, s0: 1.6, s1: 0.4, jitter: 2, chance: 1 });
          }
        }
        if (h.t < dt) this.fx.burst(h.x, top, h.z, [0xff5a1f, 0xffb000], 8, 4, 1);
      }
      h.cd.forEach((v, k) => (v - dt <= 0 ? h.cd.delete(k) : h.cd.set(k, v - dt)));
    }

    // Kart contacts.
    for (const k of karts) {
      for (const h of this.list) {
        if (h.cd.has(k)) continue;
        if (k.y - h.y > (h.type === 'geyser' ? 6 : 2.6)) continue; // jumped over it
        const dx = k.x - h.x, dz = k.z - h.z;
        const d = Math.hypot(dx, dz);
        if (d > h.r + KART_RADIUS) continue;
        const nx = dx / (d || 1), nz = dz / (d || 1);
        if (h.type === 'geyser') {
          if (!h.active) continue;
          k.hit('bump');
          k.vy = 14;
          k.y += 0.3;
          k.air = true;
          h.cd.set(k, 1.5);
          if (k.human) this.sfx('explode');
          continue;
        }
        // Push the kart out of the obstacle and bounce it off.
        const push = h.r + KART_RADIUS - d;
        k.x += nx * push;
        k.z += nz * push;
        if (h.type === 'bumper') {
          k.speed *= 0.7;
          k.vx += nx * 14;
          k.vz += nz * 14;
          k.bounce(nx, nz);
          k.emit('bump');
          h.pulse = 1;
          h.cd.set(k, 0.4);
          if (k.human) this.sfx('bonk');
        } else {
          const kind = h.hit ?? 'bump';
          if (k.hit(kind) && h.kind === 'snowball') this.fx.burst(h.x, h.y + 1.5, h.z, [0xffffff, 0xdfefff], 18, 7, 1);
          k.bounce(nx, nz);
          h.cd.set(k, 1.2);
        }
      }
    }
  }

  // Obstacles worth steering around (bots read these through Items.hazardsNear).
  near(x, z, r) {
    const out = [];
    for (const h of this.list) {
      if (h.type === 'geyser' && !h.active && !h.warn) continue;
      const rr = r + h.r;
      if ((h.x - x) ** 2 + (h.z - z) ** 2 < rr * rr) out.push({ x: h.x, z: h.z, owner: null, type: 'hazard' });
    }
    return out;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose?.();
    });
  }
}
