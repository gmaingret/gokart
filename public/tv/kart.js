import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROAD_HALF, CURB, WALL } from './track.js';

export const KART_RADIUS = 1.3;
export const DRIFT_TIERS = [
  { at: 0.9, boost: 0.6, color: 0x3fa9ff },
  { at: 2.0, boost: 1.0, color: 0xff9a1f },
  { at: 3.3, boost: 1.5, color: 0xff3fd2 },
];

function nameTag(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 38px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.strokeStyle = 'rgba(0,0,0,0.75)';
  g.strokeText(text, 128, 34);
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Fixed on-screen size, so a kart right in front of the camera doesn't get a giant label.
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
  s.scale.set(0.3, 0.075, 1);
  s.position.y = 3.4;
  s.renderOrder = 10;
  return s;
}

function plateTexture(letter, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = color;
  g.stroke();
  g.fillStyle = '#111';
  g.font = '900 78px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let shadowTex = null;
function blobShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.75)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

// Side profile of the body (z forward, y up), extruded across the kart's width.
function bodyGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-1.35, 0.22);
  s.lineTo(-1.4, 0.7);
  s.quadraticCurveTo(-1.2, 0.92, -0.85, 0.88);
  s.lineTo(-0.55, 0.62);
  s.lineTo(0.55, 0.62);
  s.quadraticCurveTo(0.9, 0.72, 1.2, 0.6);
  s.quadraticCurveTo(1.85, 0.45, 2.0, 0.3);
  s.lineTo(1.9, 0.2);
  s.lineTo(-1.35, 0.22);
  const depth = 1.1;
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.16, bevelThickness: 0.18, bevelSegments: 3, curveSegments: 10 });
  // shape (x, y) + extrusion z  ->  kart (z, y) + width x
  g.rotateY(-Math.PI / 2);
  g.translate(depth / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

// Collects transformed part geometries per material bucket and merges them, so a
// whole kart renders in about a dozen draw calls instead of ~50.
class PartBuilder {
  constructor() {
    this.buckets = new Map();
    this.m = new THREE.Matrix4();
    this.e = new THREE.Euler();
    this.q = new THREE.Quaternion();
  }
  add(bucket, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, color = null, scale = null) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    this.q.setFromEuler(this.e.set(rx, ry, rz));
    this.m.compose(new THREE.Vector3(x, y, z), this.q, scale || new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(this.m);
    if (color !== null) {
      const c = new THREE.Color(color);
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) ((arr[i * 3] = c.r), (arr[i * 3 + 1] = c.g), (arr[i * 3 + 2] = c.b));
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    if (!this.buckets.has(bucket)) this.buckets.set(bucket, []);
    this.buckets.get(bucket).push(g);
    geo.dispose();
  }
  mesh(bucket, material) {
    const list = this.buckets.get(bucket);
    const geo = mergeGeometries(list);
    list.forEach((g) => g.dispose());
    return new THREE.Mesh(geo, material);
  }
}

let lowQuality = false;
export function setLowQuality(on) {
  lowQuality = on;
}

function buildModel(driver, name) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // tilts / spins; root carries position + heading
  root.add(body);
  const std = (color, metalness = 0.3, roughness = 0.4, o = {}) =>
    lowQuality ? new THREE.MeshLambertMaterial({ color, ...o }) : new THREE.MeshStandardMaterial({ color, metalness, roughness, ...o });
  const paint = std(driver.color, 0.45, 0.28);
  const trim = std(0xffffff, 0.3, 0.5, { vertexColors: true });
  const chrome = std(0xffffff, 1, 0.18);
  const visorMat = std(0x0a0a14, 0.9, 0.06, { side: THREE.DoubleSide });
  const ACC = driver.accent, DARK = 0x1b1d22;
  const b = new PartBuilder();

  b.add('paint', bodyGeometry());
  // floor pan + side pods
  b.add('trim', new THREE.BoxGeometry(1.9, 0.12, 3.0), 0, 0.2, 0.1, 0, 0, 0, DARK);
  for (const sx of [-1, 1]) b.add('trim', new THREE.CapsuleGeometry(0.26, 1.5, 4, 10), sx * 0.92, 0.42, -0.05, Math.PI / 2, 0, 0, ACC);
  // front wing with end plates
  b.add('trim', new THREE.BoxGeometry(2.2, 0.08, 0.5), 0, 0.26, 2.0, 0, 0, 0, ACC);
  for (const sx of [-1, 1]) b.add('paint', new THREE.BoxGeometry(0.06, 0.3, 0.55), sx * 1.1, 0.34, 2.0);
  // rear wing
  b.add('trim', new THREE.BoxGeometry(2.0, 0.1, 0.6), 0, 1.42, -1.5, -0.12, 0, 0, ACC);
  for (const sx of [-1, 1]) {
    b.add('paint', new THREE.BoxGeometry(0.07, 0.5, 0.7), sx * 1.0, 1.35, -1.5);
    b.add('trim', new THREE.BoxGeometry(0.08, 0.6, 0.08), sx * 0.45, 1.05, -1.45, 0, 0, 0, DARK);
  }
  // engine + exhausts
  b.add('trim', new THREE.BoxGeometry(0.95, 0.5, 0.65), 0, 0.78, -1.15, 0, 0, 0, DARK);
  b.add('chrome', new THREE.CylinderGeometry(0.42, 0.42, 0.7, 12), 0, 1.0, -1.1, 0, 0, Math.PI / 2, null, new THREE.Vector3(1, 1, 0.5));
  const exhausts = [];
  for (const sx of [-0.32, 0.32]) {
    b.add('chrome', new THREE.CylinderGeometry(0.11, 0.13, 0.6, 10), sx, 0.78, -1.6, Math.PI / 2 - 0.25);
    exhausts.push(new THREE.Vector3(sx, 0.85, -1.95));
  }
  // steering wheel + column
  b.add('trim', new THREE.TorusGeometry(0.24, 0.05, 6, 16), 0, 1.05, 0.45, -0.7, 0, 0, DARK);
  b.add('trim', new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), 0, 0.85, 0.65, 0.9, 0, 0, DARK);
  // Driver
  b.add('trim', new THREE.CapsuleGeometry(0.34, 0.45, 4, 10), 0, 1.15, -0.45, -0.15, 0, 0, ACC);
  for (const sx of [-1, 1]) b.add('trim', new THREE.CapsuleGeometry(0.1, 0.55, 3, 6), sx * 0.28, 1.12, -0.05, 1.1, 0, -sx * 0.35, ACC);
  b.add('paint', new THREE.SphereGeometry(0.42, 20, 14), 0, 1.78, -0.42);
  b.add('trim', new THREE.TorusGeometry(0.42, 0.045, 6, 24), 0, 1.8, -0.42, Math.PI / 2 - 0.2, 0, 0, 0xffffff);
  b.add('visor', new THREE.SphereGeometry(0.36, 16, 10, -Math.PI / 2.6, Math.PI / 1.3, Math.PI / 2.9, Math.PI / 3.6), 0, 1.78, -0.32);

  body.add(b.mesh('paint', paint), b.mesh('trim', trim), b.mesh('chrome', chrome), b.mesh('visor', visorMat));
  // Headlights: bright enough to bloom, which really shows at night.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff4c8 });
  lampMat.color.multiplyScalar(4);
  for (const sx of [-0.45, 0.45]) {
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), lampMat);
    lamp.position.set(sx, 0.55, 2.07);
    body.add(lamp);
  }
  // Brake lights (lit when braking, see updateModel).
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0x551010 });
  for (const sx of [-0.3, 0.3]) {
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.12), brakeMat);
    tail.position.set(sx, 0.95, -1.49);
    tail.rotation.y = Math.PI;
    body.add(tail);
  }
  // number plate on the nose (textured, so it stays its own mesh)
  const plate = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshStandardMaterial({ map: plateTexture(name[0]?.toUpperCase() || '?', driver.color), roughness: 0.5 }));
  plate.position.set(0, 0.82, 1.15);
  plate.rotation.x = -Math.PI / 2 + 0.28;
  body.add(plate);

  // Wheels: tyre, rim and spokes merged into one vertex-coloured mesh each.
  const wheelMat = std(0xffffff, 0.55, 0.45, { vertexColors: true });
  const wheels = [];
  for (const [x, z, front] of [[-1.0, 1.15, 1], [1.0, 1.15, 1], [-1.05, -0.95, 0], [1.05, -0.95, 0]]) {
    const r = front ? 0.4 : 0.47, w = front ? 0.38 : 0.5;
    const wb = new PartBuilder();
    wb.add('w', new THREE.CylinderGeometry(r, r, w, 22), 0, 0, 0, 0, 0, Math.PI / 2, 0x161616);
    wb.add('w', new THREE.TorusGeometry(r * 0.98, 0.04, 4, 22), x > 0 ? w / 2 : -w / 2, 0, 0, 0, Math.PI / 2, 0, 0x101010);
    wb.add('w', new THREE.CylinderGeometry(r * 0.6, r * 0.6, w + 0.02, 14), 0, 0, 0, 0, 0, Math.PI / 2, 0xd8d8d8);
    for (let k = 0; k < 3; k++) wb.add('w', new THREE.BoxGeometry(w + 0.04, r * 1.1, 0.08), 0, 0, 0, (k / 3) * Math.PI, 0, 0, ACC);
    const spin = wb.mesh('w', wheelMat);
    const wg = new THREE.Group();
    wg.add(spin);
    wg.position.set(x, r, z);
    wg.userData.front = !!front;
    wg.userData.spin = spin;
    body.add(wg);
    wheels.push(wg);
  }

  const flameMat = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flameGeo = new THREE.ConeGeometry(0.16, 0.9, 8).rotateX(-Math.PI / 2).translate(0, 0, -0.45);
  const flames = exhausts.map((p) => {
    const f = new THREE.Mesh(flameGeo, flameMat);
    f.position.copy(p);
    f.visible = false;
    body.add(f);
    return f;
  });

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 4.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.position.y = 0.08;
  root.add(shadow);

  const tag = nameTag(name, driver.color);
  root.add(tag);

  body.traverse((o) => {
    if (o.isMesh && o.material !== flameMat) o.castShadow = true;
  });
  return { root, body, wheels, flames, exhausts, tag, paint, shadow, brakeMat };
}

export class Kart {
  constructor({ id, driver, name, human }) {
    this.id = id;
    this.driver = driver;
    this.name = name;
    this.human = human;
    this.model = buildModel(driver, name);
    this.input = { steer: 0, gas: false, brake: false, drift: false, item: false };
    this.reset({ x: 0, z: 0, heading: 0, idx: 0 });
  }

  reset(spot) {
    this.x = spot.x; this.z = spot.z;
    this.heading = spot.heading;
    this.vx = 0; this.vz = 0;
    this.speed = 0;
    this.steer = 0;
    this.idx = spot.idx; this.f = 0; this.lateral = 0;
    this.lap = 0;
    this.progress = 0;
    this.finished = false;
    this.finishTime = 0;
    this.place = 1;
    this.drifting = false; this.driftDir = 0; this.driftCharge = 0; this.driftPrev = false;
    this.hop = 0;
    this.boost = 0;
    this.spin = 0; this.spinAngle = 0;
    this.star = 0;
    this.shrink = 0;
    this.invuln = 0;
    this.item = null; this.itemCount = 0; this.roulette = 0;
    this.offroad = false;
    this.wrongWay = 0;
    this.bonk = 0;
    this.lastLapTime = 0;
    this.lapStart = 0;
    this.rocket = 0; // rocket-start state: 0 none, 1 good window pressed, -1 too early
    this.ai = { line: (Math.random() - 0.5) * 6, phase: Math.random() * 10, itemDelay: 0, driftHold: 0 };
    this.events = [];
    this.updateModel(0);
  }

  get forwardX() { return Math.sin(this.heading); }
  get forwardZ() { return Math.cos(this.heading); }

  // Push an event the game turns into sound / phone vibration.
  emit(kind) {
    this.events.push(kind);
  }

  hit(kind = 'spin') {
    if (this.star > 0 || this.invuln > 0 || this.finished) return false;
    this.spin = kind === 'bump' ? 0.6 : 1.15;
    this.speed *= kind === 'bump' ? 0.6 : 0.25;
    this.drifting = false;
    this.driftCharge = 0;
    this.boost = 0;
    this.invuln = this.spin + 1.2;
    this.emit('hit');
    return true;
  }

  giveBoost(t) {
    this.boost = Math.max(this.boost, t);
    this.emit('boost');
  }

  // cfg: {maxSpeed, accel}; mult: rubber-band multiplier for bots.
  step(dt, track, cfg, mult = 1) {
    const cl = track.cl;
    const inp = this.input;
    this.invuln = Math.max(0, this.invuln - dt);
    this.star = Math.max(0, this.star - dt);
    this.shrink = Math.max(0, this.shrink - dt);
    this.bonk = Math.max(0, this.bonk - dt);
    this.hop = Math.max(0, this.hop - dt);

    let top = cfg.maxSpeed * mult;
    if (this.shrink > 0) top *= 0.72;
    if (this.star > 0) top *= 1.15;
    if (this.offroad && this.boost <= 0 && this.star <= 0) top *= 0.45;
    if (this.finished) top *= 0.6;

    this.steer += ((inp.steer || 0) - this.steer) * Math.min(1, dt * 12);

    if (this.spin > 0) {
      this.spin -= dt;
      this.spinAngle += dt * 14;
      this.speed *= Math.exp(-2.5 * dt);
    } else {
      this.spinAngle = 0;
      if (this.boost > 0) {
        this.boost -= dt;
        top *= 1.4;
        if (this.speed < top) this.speed = Math.min(top, this.speed + 45 * dt);
      }
      if (inp.gas && !inp.brake) {
        if (this.speed < top) this.speed = Math.min(top, this.speed + cfg.accel * dt * (1 - 0.55 * Math.max(0, this.speed) / top));
      } else if (inp.brake) {
        if (this.speed > 0.5) this.speed -= 32 * dt;
        else this.speed = Math.max(-9, this.speed - 14 * dt);
      } else {
        this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 7 * dt);
      }
      if (this.speed > top) this.speed -= (this.speed - top) * Math.min(1, 2.5 * dt);

      // Drifting (hop + mini-turbo charge).
      const driftPressed = inp.drift && !this.driftPrev;
      if (driftPressed && this.hop <= 0 && !this.drifting) this.hop = 0.28;
      if (!this.drifting && inp.drift && Math.abs(this.steer) > 0.35 && this.speed > 11) {
        this.drifting = true;
        this.driftDir = Math.sign(this.steer);
        this.driftCharge = 0;
      }
      if (this.drifting && (!inp.drift || this.speed < 7)) {
        const tier = this.driftTier();
        if (tier >= 0 && this.speed >= 7) this.giveBoost(DRIFT_TIERS[tier].boost);
        this.drifting = false;
        this.driftCharge = 0;
      }

      const absSpeed = Math.abs(this.speed);
      const turnScale = Math.min(1, absSpeed / 5) * (1 - 0.3 * Math.min(1, absSpeed / cfg.maxSpeed));
      let turn;
      if (this.drifting) {
        const along = this.steer * this.driftDir; // -1..1, pushing into or out of the drift
        turn = this.driftDir * (0.75 + 0.55 * along) * 1.85;
        this.driftCharge += dt * (this.offroad ? 0.3 : 0.75 + 0.6 * Math.max(0, along));
      } else {
        turn = this.steer * 1.9;
      }
      this.heading -= turn * turnScale * dt * Math.sign(this.speed || 1);
    }
    this.driftPrev = !!inp.drift;

    // Velocity follows heading with limited grip (gives a slidey arcade feel).
    const grip = this.spin > 0 ? 1.5 : this.drifting ? 4 : 9;
    const k = Math.min(1, grip * dt);
    this.vx += (this.forwardX * this.speed - this.vx) * k;
    this.vz += (this.forwardZ * this.speed - this.vz) * k;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    if (track.arena) {
      // Battle arena: round wall + obstacles, no laps or off-road.
      for (const h of track.arena.constrain(this, KART_RADIUS * 0.9)) this.bounce(h.nx, h.nz);
      this.offroad = false;
      this.wrongWay = 0;
      return;
    }

    // Track position, walls, off-road.
    const prevIdx = this.idx;
    let loc = cl.locate(this.x, this.z, this.idx);
    const limit = WALL - KART_RADIUS * 0.8;
    if (Math.abs(loc.lateral) > limit) {
      const i = loc.i;
      const nx = cl.nx[i], nz = cl.nz[i];
      const over = Math.abs(loc.lateral) - limit;
      const s = Math.sign(loc.lateral);
      this.x -= nx * over * s;
      this.z -= nz * over * s;
      const vn = this.vx * nx + this.vz * nz;
      if (vn * s > 0) {
        this.vx -= nx * vn * 1.3;
        this.vz -= nz * vn * 1.3;
        if (Math.abs(vn) > 6 && this.bonk <= 0) {
          this.speed *= 0.75;
          this.bonk = 0.4;
          this.emit('bonk');
        }
      }
      loc = cl.locate(this.x, this.z, this.idx);
    }
    this.idx = loc.idx;
    this.f = loc.f;
    this.lateral = loc.lateral;
    this.offroad = Math.abs(loc.lateral) > ROAD_HALF + CURB + 0.4;

    const d = this.idx - prevIdx;
    if (d < -cl.n / 2) this.lap++;
    else if (d > cl.n / 2) this.lap--;
    this.progress = this.lap * cl.n + this.idx + this.f;

    const dot = this.forwardX * cl.tx[this.idx] + this.forwardZ * cl.tz[this.idx];
    this.wrongWay = dot < -0.35 && this.spin <= 0 ? this.wrongWay + dt : 0;
  }

  // Collision response against a surface with outward normal (nx, nz).
  bounce(nx, nz) {
    const vn = this.vx * nx + this.vz * nz;
    if (vn >= 0) return;
    this.vx -= nx * vn * 1.3;
    this.vz -= nz * vn * 1.3;
    if (-vn > 6 && this.bonk <= 0) {
      this.speed *= 0.75;
      this.bonk = 0.4;
      this.emit('bonk');
    }
  }

  // Battle mode: a cluster of balloons tied behind the driver.
  setBalloons(n) {
    const m = this.model;
    if (!m.balloons) {
      m.balloons = new THREE.Group();
      m.balloons.position.set(0, 2.1, -1.35);
      m.body.add(m.balloons);
    }
    const g = m.balloons;
    while (g.children.length > n) {
      const b = g.children.pop();
      g.remove(b);
    }
    const mat = (m.balloonMat ??= new THREE.MeshStandardMaterial({ color: this.driver.color, roughness: 0.2, metalness: 0.05, emissive: this.driver.color, emissiveIntensity: 0.15 }));
    const geo = (Kart.balloonGeo ??= new THREE.SphereGeometry(0.45, 16, 12).scale(1, 1.2, 1));
    const knot = (Kart.knotGeo ??= new THREE.ConeGeometry(0.12, 0.2, 6).rotateX(Math.PI));
    const str = (Kart.stringGeo ??= new THREE.CylinderGeometry(0.015, 0.015, 1.4, 4).translate(0, -0.75, 0));
    const strMat = (Kart.stringMat ??= new THREE.MeshBasicMaterial({ color: 0xffffff }));
    while (g.children.length < n) {
      const k = g.children.length;
      const b = new THREE.Group();
      const ball = new THREE.Mesh(geo, mat);
      b.add(ball);
      const kn = new THREE.Mesh(knot, mat);
      kn.position.y = -0.68;
      b.add(kn);
      b.add(new THREE.Mesh(str, strMat));
      const a = (k / 5) * Math.PI * 2;
      b.userData.base = new THREE.Vector3(Math.cos(a) * 0.55 * Math.min(1, k), 0.7 + (k % 2) * 0.3, Math.sin(a) * 0.4 * Math.min(1, k));
      b.position.copy(b.userData.base);
      b.userData.phase = Math.random() * 6;
      g.add(b);
    }
  }

  // Eliminated in battle: drives on as a see-through ghost (karts are rebuilt each race).
  setGhost() {
    this.ghost = true;
    this.model.body.traverse((o) => {
      if (!o.material) return;
      o.material.transparent = true;
      o.material.opacity = 0.3;
      o.material.depthWrite = false;
    });
    this.model.shadow.visible = false;
  }

  driftTier() {
    let t = -1;
    DRIFT_TIERS.forEach((d, i) => this.driftCharge >= d.at && (t = i));
    return t;
  }

  updateModel(dt, time = 0) {
    const m = this.model;
    m.root.position.set(this.x, 0, this.z);
    m.root.rotation.y = this.heading;
    const hopY = this.hop > 0 ? Math.sin((this.hop / 0.28) * Math.PI) * 0.5 : 0;
    // Engine rumble + bumpy suspension.
    const rumble = Math.sin(time * 38 + this.x) * 0.012 * (this.offroad ? 4 : 1) * Math.min(1, Math.abs(this.speed) / 5 + 0.3);
    m.body.position.y = hopY + rumble;
    m.body.rotation.y = (this.drifting ? this.driftDir * -0.38 : 0) + this.spinAngle;
    m.body.rotation.z = this.drifting ? this.driftDir * 0.07 : -this.steer * 0.05 * Math.min(1, Math.abs(this.speed) / 10);
    // Squat under acceleration / boost.
    m.body.rotation.x = this.boost > 0 ? -0.05 : 0;
    const sc = this.shrink > 0 ? 0.6 : 1;
    m.body.scale.setScalar(sc);
    m.shadow.scale.setScalar(sc * (1 - hopY * 0.4));
    const roll = (this.speed * dt) / 0.44;
    for (const w of m.wheels) {
      w.userData.spin.rotation.x += roll;
      if (w.userData.front) w.rotation.y = -this.steer * 0.45;
    }
    for (const f of m.flames) {
      f.visible = this.boost > 0;
      if (f.visible) f.scale.set(1, 1, 0.6 + Math.random() * 0.8);
    }
    if (m.brakeMat) m.brakeMat.color.setHex(this.input.brake ? 0xff2020 : 0x551010).multiplyScalar(this.input.brake ? 4 : 1);
    if (m.balloons) {
      for (const b of m.balloons.children) {
        const p = b.userData.phase;
        b.position.set(b.userData.base.x + Math.sin(time * 2 + p) * 0.08, b.userData.base.y + Math.sin(time * 2.6 + p) * 0.1, b.userData.base.z - Math.min(0.5, Math.abs(this.speed) * 0.02));
        b.rotation.x = -Math.min(0.5, Math.abs(this.speed) * 0.02);
      }
    }
    if (this.star > 0) m.paint.color.setHSL((time * 2.5) % 1, 0.9, 0.55);
    else m.paint.color.set(this.driver.color);
    // Blink while invulnerable after a hit.
    m.body.visible = this.invuln > 0 && this.spin <= 0 ? Math.floor(time * 16) % 2 === 0 : true;
  }

  // World position of a point given in the kart's local frame.
  toWorld(lx, ly, lz) {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    return { x: this.x + lx * c + lz * s, y: ly, z: this.z - lx * s + lz * c };
  }
}

// Push overlapping karts apart and trade a little momentum.
export function collideKarts(karts) {
  const r2 = KART_RADIUS * 2;
  for (let a = 0; a < karts.length; a++) {
    for (let b = a + 1; b < karts.length; b++) {
      const A = karts[a], B = karts[b];
      const dx = B.x - A.x, dz = B.z - A.z;
      const ra = A.shrink > 0 ? 0.6 : 1, rb = B.shrink > 0 ? 0.6 : 1;
      const min = KART_RADIUS * (ra + rb);
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min || d2 === 0 || min > r2 + 1) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d, nz = dz / d;
      const push = (min - d) / 2;
      A.x -= nx * push; A.z -= nz * push;
      B.x += nx * push; B.z += nz * push;
      // Stars and full-size karts flatten the other one.
      if (A.star > 0 && B.star <= 0) B.hit();
      else if (B.star > 0 && A.star <= 0) A.hit();
      else if (A.shrink > 0 && B.shrink <= 0) A.hit('bump');
      else if (B.shrink > 0 && A.shrink <= 0) B.hit('bump');
      const rel = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
      if (rel < 0) {
        const j = rel * 0.6;
        A.vx += nx * j; A.vz += nz * j;
        B.vx -= nx * j; B.vz -= nz * j;
        if (rel < -5) {
          A.emit('bump');
          B.emit('bump');
        }
      }
    }
  }
}
