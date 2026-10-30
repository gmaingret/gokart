// Air-hockey table physics, pure 2D (x along the table, z across it), no DOM
// or THREE so it can be unit-tested in Node. The left player (side -1)
// defends the goal at x = -HX, the right player (side +1) the goal at x = +HX.

export const HX = 12; // half length (goal ends)
export const HZ = 6.5; // half width (side rails)
export const GOAL = 2.5; // half width of each goal mouth
export const CORNER = 1.6; // corner rounding radius
export const PUCK_R = 0.55;
export const MALLET_R = 0.95;
export const PUCK_MAX = 40;
const SUBSTEPS = 8;
const DRAG = 0.16; // per second
const WALL_E = 0.9; // restitution off the rails
const HIT_E = 0.8; // restitution off a mallet

export function clampToHalf(side, x, z) {
  const lo = side < 0 ? -HX + MALLET_R : MALLET_R * 0.3;
  const hi = side < 0 ? -MALLET_R * 0.3 : HX - MALLET_R;
  return {
    x: Math.max(lo, Math.min(hi, x)),
    z: Math.max(-HZ + MALLET_R, Math.min(HZ - MALLET_R, z)),
  };
}

export class Table {
  constructor() {
    this.puck = { x: 0, z: 0, vx: 0, vz: 0 };
    this.mallets = [-1, 1].map((side) => ({ side, x: side * (HX - 3), z: 0, vx: 0, vz: 0, tx: side * (HX - 3), tz: 0, maxSpeed: 55 }));
    this.events = [];
    this.frozen = false;
  }

  // Put the puck on the given side's half, at rest (a serve).
  serve(side) {
    Object.assign(this.puck, { x: side * 4, z: 0, vx: 0, vz: 0 });
  }

  resetMallets() {
    for (const m of this.mallets) Object.assign(m, { x: m.side * (HX - 3), z: 0, vx: 0, vz: 0, tx: m.side * (HX - 3), tz: 0 });
  }

  setTarget(i, x, z) {
    const m = this.mallets[i];
    const c = clampToHalf(m.side, x, z);
    m.tx = c.x;
    m.tz = c.z;
  }

  step(dt) {
    const h = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) this.substep(h);
  }

  substep(h) {
    const p = this.puck;
    // Mallets chase their targets, limited to their top speed.
    for (const m of this.mallets) {
      const dx = m.tx - m.x, dz = m.tz - m.z;
      const d = Math.hypot(dx, dz);
      const maxStep = m.maxSpeed * h;
      const k = d > maxStep ? maxStep / d : 1;
      m.vx = (dx * k) / h;
      m.vz = (dz * k) / h;
      m.x += dx * k;
      m.z += dz * k;
    }
    if (this.frozen) return;

    p.x += p.vx * h;
    p.z += p.vz * h;
    const drag = Math.exp(-DRAG * h);
    p.vx *= drag;
    p.vz *= drag;

    for (const [i, m] of this.mallets.entries()) this.hitMallet(p, m, i);
    this.hitWalls(p);

    const sp = Math.hypot(p.vx, p.vz);
    if (sp > PUCK_MAX) {
      p.vx *= PUCK_MAX / sp;
      p.vz *= PUCK_MAX / sp;
    }

    // Goal: the puck has gone through a mouth.
    if (Math.abs(p.x) > HX + PUCK_R && Math.abs(p.z) < GOAL) {
      this.events.push({ type: 'goal', scorer: p.x < 0 ? 1 : 0 });
      this.frozen = true;
    }
  }

  hitMallet(p, m, i) {
    const dx = p.x - m.x, dz = p.z - m.z;
    const d = Math.hypot(dx, dz);
    const min = PUCK_R + MALLET_R;
    if (d >= min || d < 1e-6) return;
    const nx = dx / d, nz = dz / d;
    // Push the puck out, then bounce it off the (much heavier) mallet.
    p.x = m.x + nx * min;
    p.z = m.z + nz * min;
    const rvx = p.vx - m.vx, rvz = p.vz - m.vz;
    const vn = rvx * nx + rvz * nz;
    if (vn < 0) {
      p.vx -= (1 + HIT_E) * vn * nx;
      p.vz -= (1 + HIT_E) * vn * nz;
      this.events.push({ type: 'hit', mallet: i, speed: -vn });
    }
  }

  hitWalls(p) {
    const r = PUCK_R;
    let bounced = 0;
    // Side rails.
    if (p.z > HZ - r) {
      p.z = HZ - r;
      if (p.vz > 0) ((bounced = Math.max(bounced, p.vz)), (p.vz = -p.vz * WALL_E));
    } else if (p.z < -HZ + r) {
      p.z = -HZ + r;
      if (p.vz < 0) ((bounced = Math.max(bounced, -p.vz)), (p.vz = -p.vz * WALL_E));
    }
    // End rails, except the goal mouths.
    const inMouth = Math.abs(p.z) < GOAL - r * 0.2;
    if (!inMouth) {
      if (p.x > HX - r) {
        p.x = HX - r;
        if (p.vx > 0) ((bounced = Math.max(bounced, p.vx)), (p.vx = -p.vx * WALL_E));
      } else if (p.x < -HX + r) {
        p.x = -HX + r;
        if (p.vx < 0) ((bounced = Math.max(bounced, -p.vx)), (p.vx = -p.vx * WALL_E));
      }
    }
    // Goal posts (the corners of each mouth).
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const dx = p.x - sx * HX, dz = p.z - sz * GOAL;
        const d = Math.hypot(dx, dz);
        if (d < r && d > 1e-6) {
          const nx = dx / d, nz = dz / d;
          p.x = sx * HX + nx * r;
          p.z = sz * GOAL + nz * r;
          const vn = p.vx * nx + p.vz * nz;
          if (vn < 0) {
            p.vx -= (1 + WALL_E) * vn * nx;
            p.vz -= (1 + WALL_E) * vn * nz;
            bounced = Math.max(bounced, -vn);
          }
        }
      }
    }
    // Rounded corners so the puck never gets stuck in one.
    const cx = HX - CORNER, cz = HZ - CORNER;
    if (Math.abs(p.x) > cx && Math.abs(p.z) > cz) {
      const ox = Math.sign(p.x) * cx, oz = Math.sign(p.z) * cz;
      const dx = p.x - ox, dz = p.z - oz;
      const d = Math.hypot(dx, dz);
      const lim = CORNER - r;
      if (d > lim) {
        const nx = dx / d, nz = dz / d;
        p.x = ox + nx * lim;
        p.z = oz + nz * lim;
        const vn = p.vx * nx + p.vz * nz;
        if (vn > 0) {
          p.vx -= (1 + WALL_E) * vn * nx;
          p.vz -= (1 + WALL_E) * vn * nz;
          bounced = Math.max(bounced, vn);
        }
      }
    }
    if (bounced > 1.5) this.events.push({ type: 'wall', speed: bounced });
  }
}

// Where will the puck cross the line x = lineX (folding in side-rail bounces)?
// Returns null if it isn't heading there.
export function predictZ(p, lineX) {
  if (Math.abs(p.vx) < 0.5) return null;
  const t = (lineX - p.x) / p.vx;
  if (t < 0) return null;
  const span = 2 * (HZ - PUCK_R);
  let z = p.z + p.vz * t + (HZ - PUCK_R);
  z = ((z % (2 * span)) + 2 * span) % (2 * span);
  if (z > span) z = 2 * span - z;
  return z - (HZ - PUCK_R);
}
