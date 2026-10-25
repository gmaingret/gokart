import * as THREE from 'three';
import { ROAD_HALF, CURB, WALL } from './track.js';

export const KART_RADIUS = 1.3;
const DRIFT_TIERS = [
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

function buildModel(driver, name) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // tilts / spins; root carries position + heading
  root.add(body);
  const lam = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });
  const paint = lam(driver.color);
  const dark = lam(0x222222);
  const accent = lam(driver.accent);

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 2.7), paint);
  chassis.position.y = 0.55;
  body.add(chassis);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 0.9), paint);
  nose.position.set(0, 0.5, 1.6);
  body.add(nose);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 0.3), dark);
  bumper.position.set(0, 0.4, 2.1);
  body.add(bumper);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.5), accent);
  spoiler.position.set(0, 1.25, -1.35);
  body.add(spoiler);
  for (const sx of [-0.6, 0.6]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), dark);
    strut.position.set(sx, 0.95, -1.35);
    body.add(strut);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.25), dark);
  seat.position.set(0, 1.0, -0.75);
  body.add(seat);
  const wheelBar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12), dark);
  wheelBar.rotation.x = Math.PI / 2.6;
  wheelBar.position.set(0, 1.1, 0.55);
  body.add(wheelBar);

  // Driver
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.8, 10), accent);
  torso.position.set(0, 1.2, -0.35);
  body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), paint);
  head.position.set(0, 1.85, -0.3);
  body.add(head);
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 12, 8, -Math.PI / 2.4, Math.PI / 1.2, Math.PI / 3, Math.PI / 3),
    lam(0x111111, { side: THREE.DoubleSide })
  );
  visor.position.copy(head.position).add(new THREE.Vector3(0, 0, 0.1));
  body.add(visor);

  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.42, 14).rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.44, 8).rotateZ(Math.PI / 2);
  for (const [x, z, front] of [[-0.98, 1.0, 1], [0.98, 1.0, 1], [-1.0, -0.95, 0], [1.0, -0.95, 0]]) {
    const w = new THREE.Group();
    w.add(new THREE.Mesh(wheelGeo, dark));
    w.add(new THREE.Mesh(hubGeo, accent));
    w.position.set(x, 0.42, z);
    w.userData.front = !!front;
    body.add(w);
    wheels.push(w);
  }

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 1.4, 8).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.9 })
  );
  flame.position.set(0, 0.6, -1.9);
  flame.visible = false;
  body.add(flame);

  const sparks = [];
  for (const x of [-1, 1]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    s.position.set(x, 0.25, -1.3);
    s.visible = false;
    body.add(s);
    sparks.push(s);
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.7, 16).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
  );
  shadow.position.y = 0.07;
  shadow.scale.z = 1.3;
  root.add(shadow);

  const tag = nameTag(name, driver.color);
  root.add(tag);

  return { root, body, wheels, flame, sparks, tag, paint };
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
    m.body.position.y = hopY;
    m.body.rotation.y = (this.drifting ? this.driftDir * -0.38 : 0) + this.spinAngle;
    m.body.rotation.z = this.drifting ? this.driftDir * 0.06 : -this.steer * 0.04;
    const sc = this.shrink > 0 ? 0.6 : 1;
    m.body.scale.setScalar(sc);
    const roll = (this.speed * dt) / 0.42;
    for (const w of m.wheels) {
      w.children[0].rotation.x += roll;
      w.children[1].rotation.x += roll;
      if (w.userData.front) w.rotation.y = -this.steer * 0.45;
    }
    m.flame.visible = this.boost > 0;
    if (m.flame.visible) m.flame.scale.set(1, 1, 0.7 + Math.random() * 0.6);
    const tier = this.drifting ? this.driftTier() : -1;
    for (const s of m.sparks) {
      s.visible = tier >= 0 && Math.random() > 0.2;
      if (s.visible) {
        s.material.color.setHex(DRIFT_TIERS[tier].color);
        s.scale.setScalar(0.7 + Math.random() * 0.8);
      }
    }
    if (this.star > 0) m.paint.color.setHSL((time * 2.5) % 1, 0.9, 0.55);
    else m.paint.color.set(this.driver.color);
    // Blink while invulnerable after a hit.
    m.body.visible = this.invuln > 0 && this.spin <= 0 ? Math.floor(time * 16) % 2 === 0 : true;
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
