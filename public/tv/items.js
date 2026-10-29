import * as THREE from 'three';
import { KART_RADIUS } from './kart.js';

export const ITEM_TYPES = ['banana', 'green', 'red', 'mushroom', 'triple', 'star', 'lightning'];

// Weights per position tier: leaders get defensive items, the back of the pack
// gets the strong catch-up ones.
const WEIGHTS = [
  { banana: 45, green: 35, red: 5, mushroom: 15 },
  { banana: 20, green: 25, red: 25, mushroom: 20, triple: 5, star: 5 },
  { banana: 5, green: 15, red: 30, mushroom: 20, triple: 15, star: 10, lightning: 5 },
  { red: 20, mushroom: 15, triple: 30, star: 25, lightning: 10 },
];

// Battle has no "position" to balance against, and no lightning.
const BATTLE_WEIGHTS = { banana: 22, green: 28, red: 18, mushroom: 14, triple: 8, star: 10 };

export function rollItem(place, racers, random = Math.random, battle = false) {
  const frac = racers > 1 ? (place - 1) / (racers - 1) : 0.4;
  const table = battle ? BATTLE_WEIGHTS : WEIGHTS[Math.min(3, Math.floor(frac * 4))];
  const total = Object.values(table).reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (const [k, w] of Object.entries(table)) {
    if ((r -= w) < 0) return k;
  }
  return 'mushroom';
}

const ROULETTE_TIME = 1.6;
const BOX_RESPAWN = 3;

function questionTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, '#ff5ec4');
  grad.addColorStop(0.5, '#ffd84d');
  grad.addColorStop(1, '#4dd2ff');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 118, 118);
  g.font = 'bold 92px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.strokeStyle = '#5a2a00';
  g.strokeText('?', 64, 70);
  g.fillStyle = '#fff';
  g.fillText('?', 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function bananaMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffd93b });
  const curve = new THREE.TorusGeometry(0.55, 0.22, 8, 12, Math.PI * 1.1);
  const m = new THREE.Mesh(curve, mat);
  m.rotation.z = Math.PI * 0.95;
  m.position.y = 0.7;
  g.add(m);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), new THREE.MeshLambertMaterial({ color: 0x5a3a12 }));
  tip.position.set(0.55, 0.75, 0);
  g.add(tip);
  return g;
}

function shellMesh(color) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(0.75, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.1, emissive: color, emissiveIntensity: 0.25 })
  );
  top.position.y = 0.35;
  g.add(top);
  // hex plates
  const plates = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.78, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.55 })
  );
  plates.scale.y = 0.6;
  plates.position.y = 0.35;
  g.add(plates);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.14, 8, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  rim.position.y = 0.32;
  g.add(rim);
  return g;
}

export class Items {
  constructor(scene, track, sfx, fx) {
    this.scene = scene;
    this.track = track;
    this.sfx = sfx;
    this.fx = fx;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.objects = [];
    this.boxes = [];
    const tex = questionTexture();
    // Shared materials so the rainbow shimmer is one update per frame.
    this.boxShell = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.2, emissive: 0xff66cc, emissiveIntensity: 0.6, depthWrite: false });
    const inner = new THREE.MeshBasicMaterial({ map: tex });
    const geo = new THREE.BoxGeometry(1.7, 1.7, 1.7);
    const innerGeo = new THREE.BoxGeometry(1.05, 1.05, 1.05);
    for (const s of track.boxSpots) {
      const mesh = new THREE.Group();
      mesh.add(new THREE.Mesh(innerGeo, inner));
      mesh.add(new THREE.Mesh(geo, this.boxShell));
      const y = s.y ?? 0;
      mesh.position.set(s.x, y + 1.3, s.z);
      mesh.rotation.set(0.6, Math.random() * 6, 0.6);
      this.group.add(mesh);
      this.boxes.push({ x: s.x, y, z: s.z, mesh, wait: 0 });
    }
  }

  dispose() {
    this.scene.remove(this.group);
  }

  // Ground height for an item at (o.x, o.z), near height `nearY`.
  groundAt(o, nearY) {
    if (this.track.arena) return this.track.arena.groundAt(o.x, o.z, nearY);
    const loc = this.track.cl.locate(o.x, o.z, o.idx ?? -1, nearY);
    o.idx = loc.idx;
    return this.track.cl.groundAt(loc);
  }

  spawn(type, owner, opts = {}) {
    const mesh = type === 'banana' ? bananaMesh() : shellMesh(type === 'red' ? 0xe53935 : 0x2fbf4a);
    const o = { type, owner, mesh, life: type === 'banana' ? 120 : type === 'red' ? 10 : 7, bounces: 0, grace: 0.35, ...opts };
    o.idx = this.track.arena ? 0 : this.track.cl.locate(o.x, o.z, owner.idx, owner.y).idx;
    o.y = this.groundAt(o, owner.y);
    mesh.position.set(o.x, o.y, o.z);
    this.group.add(mesh);
    this.objects.push(o);
    return o;
  }

  remove(o) {
    o.dead = true;
    this.group.remove(o.mesh);
  }

  // Racer `k` presses the item button. `order` is the current race order.
  use(k, order, all) {
    if (!k.item || k.roulette > 0 || k.spin > 0) return;
    const back = k.input.brake; // hold brake to throw backwards (shells) / forwards (bananas)
    const fx = k.forwardX, fz = k.forwardZ;
    const type = k.item;
    const consume = () => {
      if (--k.itemCount <= 0) {
        k.item = null;
        k.itemCount = 0;
      }
    };
    switch (type) {
      case 'mushroom':
      case 'triple':
        k.giveBoost(1.3);
        consume();
        this.sfx('boost');
        break;
      case 'star':
        k.star = 7.5;
        k.invuln = 0;
        k.giveBoost(0.5);
        consume();
        this.sfx('star');
        break;
      case 'lightning':
        for (const o of all) {
          if (o === k || o.star > 0 || o.finished) continue;
          o.shrink = 5;
          o.spin = Math.max(o.spin, 0.7);
          o.speed *= 0.5;
          o.drifting = false;
          o.emit('zap');
        }
        consume();
        this.sfx('zap');
        break;
      case 'banana': {
        const dir = back ? 1 : -1;
        const dist = back ? 16 : 3;
        this.spawn('banana', k, { x: k.x + fx * dist * dir, z: k.z + fz * dist * dir, vx: 0, vz: 0 });
        consume();
        this.sfx('drop');
        break;
      }
      case 'green':
      case 'red': {
        const dir = back ? -1 : 1;
        const speed = type === 'red' ? 40 : 46;
        const sp = Math.max(0, k.speed * dir);
        let target = null;
        if (type === 'red' && !back) {
          if (this.track.arena) {
            // Battle: lock on to the nearest rival still in the game.
            let best = Infinity;
            for (const o of all) {
              if (o === k || o.ghost) continue;
              const d = (o.x - k.x) ** 2 + (o.z - k.z) ** 2;
              if (d < best) ((best = d), (target = o));
            }
          } else {
            const i = order.indexOf(k);
            target = i > 0 ? order[i - 1] : null;
          }
        }
        this.spawn(type, k, {
          x: k.x + fx * 2.6 * dir, z: k.z + fz * 2.6 * dir,
          vx: fx * (speed + sp) * dir, vz: fz * (speed + sp) * dir,
          speed: speed + sp, target,
        });
        consume();
        this.sfx('throw');
        break;
      }
    }
  }

  update(dt, karts, order, time) {
    const cl = this.track.cl;
    this.boxShell.emissive.setHSL((time * 0.25) % 1, 1, 0.5);
    // Item boxes.
    for (const b of this.boxes) {
      if (b.wait > 0) {
        b.wait -= dt;
        const s = b.wait > 0 ? 0 : 1;
        b.mesh.visible = s > 0;
        b.mesh.scale.setScalar(1);
        continue;
      }
      b.mesh.rotation.y += dt * 1.5;
      b.mesh.rotation.x += dt * 0.7;
      b.mesh.position.y = b.y + 1.3 + Math.sin(time * 2 + b.x) * 0.2;
      for (const k of karts) {
        const dx = k.x - b.x, dz = k.z - b.z;
        if (dx * dx + dz * dz < (KART_RADIUS + 1.0) ** 2 && Math.abs(k.y - b.y) < 3) {
          b.wait = BOX_RESPAWN;
          b.mesh.visible = false;
          if (!k.item && k.roulette <= 0) {
            k.roulette = ROULETTE_TIME;
            k.emit('box');
          }
          break;
        }
      }
    }
    // Roulettes finishing.
    for (const k of karts) {
      if (k.roulette > 0) {
        k.roulette -= dt;
        if (k.roulette <= 0) {
          k.item = rollItem(k.place, karts.length, Math.random, !!this.track.arena);
          k.itemCount = k.item === 'triple' ? 3 : 1;
          k.emit('gotitem');
        }
      }
    }

    // Moving projectiles.
    for (const o of this.objects) {
      if (o.dead) continue;
      o.life -= dt;
      o.grace -= dt;
      if (o.life <= 0) {
        this.remove(o);
        continue;
      }
      if (o.type !== 'banana') {
        if (o.type === 'red') this.steerRed(o, dt, order);
        o.x += o.vx * dt;
        o.z += o.vz * dt;
        if (this.track.arena) {
          let dead = false;
          for (const h of this.track.arena.constrain(o, 0.8)) {
            const vn = o.vx * h.nx + o.vz * h.nz;
            if (vn >= 0) continue;
            o.vx -= 2 * vn * h.nx;
            o.vz -= 2 * vn * h.nz;
            if (++o.bounces > 6 || o.type === 'red') dead = true;
          }
          if (dead) {
            this.boom(o);
            this.remove(o);
            continue;
          }
          o.mesh.rotation.y += dt * 12;
        }
      }
      if (o.type !== 'banana' && !this.track.arena) {
        const loc = cl.locate(o.x, o.z, o.idx, o.y);
        o.idx = loc.idx;
        const limit = cl.wall[loc.i] - 0.8;
        if (Math.abs(loc.lateral) > limit && cl.gap[loc.i] !== Math.sign(loc.lateral)) {
          const nx = cl.nx[loc.i], nz = cl.nz[loc.i];
          const s = Math.sign(loc.lateral);
          o.x -= nx * (Math.abs(loc.lateral) - limit) * s;
          o.z -= nz * (Math.abs(loc.lateral) - limit) * s;
          const vn = o.vx * nx + o.vz * nz;
          if (vn * s > 0) {
            o.vx -= 2 * vn * nx;
            o.vz -= 2 * vn * nz;
            if (++o.bounces > 6 || o.type === 'red') {
              this.remove(o);
              continue;
            }
          }
        }
        o.mesh.rotation.y += dt * 12;
      }
      // Shells hug the ground (and fly off jump lips briefly, which is fine).
      if (o.type !== 'banana') {
        o.y = this.groundAt(o, o.y);
        if (this.fx && Math.random() < 0.8) this.fx.trail(o.x, o.y + 0.5, o.z, o.type === 'red' ? 0xff4040 : 0x40ff70);
      }
      o.mesh.position.set(o.x, o.y, o.z);

      // Hits on karts.
      for (const k of karts) {
        if (k === o.owner && o.grace > 0) continue;
        const dx = k.x - o.x, dz = k.z - o.z;
        const r = KART_RADIUS * (k.shrink > 0 ? 0.6 : 1) + 0.6;
        if (dx * dx + dz * dz < r * r && Math.abs(k.y - o.y) < 2) {
          if (k.hit()) this.sfx(o.type === 'banana' ? 'slip' : 'hit');
          else if (k.star > 0) this.sfx('bump');
          this.boom(o);
          this.remove(o);
          break;
        }
      }
      if (o.dead) continue;
      // Projectiles destroy each other.
      for (const p of this.objects) {
        if (p === o || p.dead) continue;
        const dx = p.x - o.x, dz = p.z - o.z;
        if (dx * dx + dz * dz < 1.6 * 1.6 && Math.abs(p.y - o.y) < 2) {
          this.boom(o);
          this.remove(o);
          this.remove(p);
          this.sfx('explode');
          break;
        }
      }
    }
    this.objects = this.objects.filter((o) => !o.dead);
  }

  boom(o) {
    if (!this.fx) return;
    if (o.type === 'banana') this.fx.burst(o.x, o.y + 0.8, o.z, [0xffe14d, 0xfff7c2], 12, 5, 0);
    else this.fx.explosion(o.x, o.y, o.z, o.type === 'red' ? 0xff4040 : 0x40ff70);
  }

  steerRed(o, dt, order) {
    const cl = this.track.cl;
    const t = o.target && !o.target.finished && !o.target.ghost ? o.target : null;
    let gx, gz;
    const tdx = t ? t.x - o.x : 0, tdz = t ? t.z - o.z : 0;
    if (this.track.arena) {
      if (!t) return; // no one left to chase: fly straight
      gx = t.x; gz = t.z;
    } else if (t && tdx * tdx + tdz * tdz < 30 * 30) {
      gx = t.x; gz = t.z;
    } else {
      // Follow the track a little ahead, drifting toward the target's lane.
      const lat = t ? t.lateral * 0.6 : 0;
      const p = cl.pointAt(o.idx + 8, lat);
      gx = p.x; gz = p.z;
    }
    const want = Math.atan2(gx - o.x, gz - o.z);
    const cur = Math.atan2(o.vx, o.vz);
    let d = want - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const nh = cur + Math.max(-1, Math.min(1, d)) * Math.min(1, dt * 7);
    o.vx = Math.sin(nh) * o.speed;
    o.vz = Math.cos(nh) * o.speed;
  }

  // Bananas near a point (AI avoidance).
  hazardsNear(x, z, r) {
    const list = this.objects.filter((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < r * r);
    // Track hazards (rollers, bumpers, geysers) are worth dodging too.
    if (this.hazards) for (const h of this.hazards.near(x, z, r)) list.push(h);
    return list;
  }
}
