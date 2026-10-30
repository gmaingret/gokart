// Ice Sumo physics, pure 2D on the ice (x, z) plus a fall height. No DOM or
// THREE, so it can be unit-tested in Node. Wrestlers slide with little
// friction; holding the button charges a dash that hits much harder.

export const R0 = 14; // starting ring radius
export const R_MIN = 5.5;
export const SHRINK_START = 10; // seconds into a round
export const SHRINK_TIME = 45; // seconds from full size to the smallest ring
export const BALL_R = 1.15;
const ACCEL = 24;
const DRAG = 0.5; // per second
const MAX_V = 12;
const DASH_V = 26;
export const CHARGE_MAX = 0.8;
const DASH_COOL = 0.9;
const DASH_TIME = 0.35;
const GRAVITY = 30;

export class Arena {
  constructor(n) {
    this.radius = R0;
    this.time = 0;
    this.events = [];
    this.balls = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(a) * R0 * 0.55, z = Math.sin(a) * R0 * 0.55;
      this.balls.push({
        i, x, z, y: 0, vx: 0, vz: 0, vy: 0,
        facing: Math.atan2(-x, -z), // heading (0 = +z), towards the middle
        charge: 0, charging: false, cool: 0, dash: 0,
        falling: false, out: false, outAt: 0, lastHit: -1, lastHitAt: -9,
      });
    }
  }

  alive() {
    return this.balls.filter((b) => !b.falling);
  }

  // inputs[i] = { x, y, dash } (joystick -1..1, button held)
  step(dt, inputs) {
    this.time += dt;
    if (this.time > SHRINK_START) {
      const k = Math.min(1, (this.time - SHRINK_START) / SHRINK_TIME);
      this.radius = R0 - (R0 - R_MIN) * k;
    }
    for (const b of this.balls) {
      const inp = inputs[b.i] || { x: 0, y: 0, dash: false };
      if (b.falling) {
        b.vy -= GRAVITY * dt;
        b.y += b.vy * dt;
        b.x += b.vx * dt * 0.6;
        b.z += b.vz * dt * 0.6;
        if (b.y < -6 && !b.out) {
          b.out = true;
          b.outAt = this.time;
          this.events.push({ type: 'splash', i: b.i, x: b.x, z: b.z });
        }
        continue;
      }
      b.cool = Math.max(0, b.cool - dt);
      b.dash = Math.max(0, b.dash - dt);
      const ix = inp.x || 0, iz = inp.y || 0;
      const mag = Math.hypot(ix, iz);
      // Charging slows you down: you're bracing for the shove.
      if (inp.dash && b.cool <= 0) {
        if (!b.charging) this.events.push({ type: 'charge', i: b.i });
        b.charging = true;
        b.charge = Math.min(CHARGE_MAX, b.charge + dt);
      } else if (b.charging) {
        // Release: dash where the stick points (or where you face).
        const k = 0.4 + 0.6 * (b.charge / CHARGE_MAX);
        const dx = mag > 0.2 ? ix / mag : Math.sin(b.facing);
        const dz = mag > 0.2 ? iz / mag : Math.cos(b.facing);
        b.vx = b.vx * 0.2 + dx * DASH_V * k;
        b.vz = b.vz * 0.2 + dz * DASH_V * k;
        b.dash = DASH_TIME * (0.6 + 0.4 * k);
        b.cool = DASH_COOL;
        b.charging = false;
        b.charge = 0;
        this.events.push({ type: 'dash', i: b.i, k });
      }
      const accel = ACCEL * (b.charging ? 0.3 : 1);
      b.vx += ix * accel * dt;
      b.vz += iz * accel * dt;
      const drag = Math.exp(-DRAG * dt);
      b.vx *= drag;
      b.vz *= drag;
      const sp = Math.hypot(b.vx, b.vz);
      if (b.dash <= 0 && sp > MAX_V) {
        // Over the top speed after a dash or a hit: bleed it off gradually.
        const s = Math.max(MAX_V, sp - 30 * dt) / sp;
        b.vx *= s;
        b.vz *= s;
      }
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      if (mag > 0.2) b.facing = Math.atan2(ix, iz);
      else if (sp > 1.5) b.facing = Math.atan2(b.vx, b.vz);
    }
    this.collide();
    // Off the edge?
    for (const b of this.balls) {
      if (b.falling) continue;
      if (Math.hypot(b.x, b.z) > this.radius + BALL_R * 0.3) {
        b.falling = true;
        b.charging = false;
        b.vy = 2;
        this.events.push({ type: 'fall', i: b.i, by: this.time - b.lastHitAt < 2.5 ? b.lastHit : -1 });
      }
    }
  }

  collide() {
    const bs = this.balls;
    for (let a = 0; a < bs.length; a++) {
      for (let c = a + 1; c < bs.length; c++) {
        const A = bs[a], B = bs[c];
        if (A.falling || B.falling) continue;
        const dx = B.x - A.x, dz = B.z - A.z;
        const d = Math.hypot(dx, dz);
        const min = BALL_R * 2;
        if (d >= min || d < 1e-6) continue;
        const nx = dx / d, nz = dz / d;
        // Separate.
        const push = (min - d) / 2;
        A.x -= nx * push;
        A.z -= nz * push;
        B.x += nx * push;
        B.z += nz * push;
        // Dashing wrestlers are much heavier; bracing (charging) ones too.
        const mA = 1 + (A.dash > 0 ? 2.2 : 0) + (A.charging ? 0.8 : 0);
        const mB = 1 + (B.dash > 0 ? 2.2 : 0) + (B.charging ? 0.8 : 0);
        const rel = (A.vx - B.vx) * nx + (A.vz - B.vz) * nz;
        if (rel <= 0) continue;
        const e = 1.25; // bouncier than real life: it's sumo on ice
        const j = ((1 + e) * rel) / (1 / mA + 1 / mB);
        A.vx -= (j / mA) * nx;
        A.vz -= (j / mA) * nz;
        B.vx += (j / mB) * nx;
        B.vz += (j / mB) * nz;
        A.lastHit = B.i;
        B.lastHit = A.i;
        A.lastHitAt = B.lastHitAt = this.time;
        this.events.push({ type: 'bump', a: A.i, b: B.i, x: (A.x + B.x) / 2, z: (A.z + B.z) / 2, speed: rel });
      }
    }
  }
}

// ---------------------------------------------------------------- CPU
export const LEVELS = [
  { name: 'Easy', react: 0.35, aim: 0.6, dashChance: 0.4 },
  { name: 'Normal', react: 0.18, aim: 0.35, dashChance: 0.75 },
  { name: 'Hard', react: 0.08, aim: 0.18, dashChance: 1 },
];

export function createBot(i, level) {
  return { i, level: LEVELS[level], wait: 0, x: 0, y: 0, dash: false, target: -1, hold: 0 };
}

// Push someone off: get between them and the middle, then charge and dash outwards.
export function driveBot(bot, arena, dt) {
  const me = arena.balls[bot.i];
  if (me.falling) return { x: 0, y: 0, dash: false };
  bot.wait -= dt;
  if (bot.hold > 0) {
    bot.hold -= dt;
    return { x: bot.x, y: bot.y, dash: bot.hold > 0 };
  }
  if (bot.wait > 0) return { x: bot.x, y: bot.y, dash: false };
  bot.wait = bot.level.react * (0.7 + Math.random() * 0.6);

  const R = arena.radius;
  const dist = Math.hypot(me.x, me.z);
  let tx, tz;
  // Too close to the edge: get back to the middle first.
  if (dist > R * 0.72) {
    tx = 0;
    tz = 0;
  } else {
    let best = null, bd = Infinity;
    for (const o of arena.balls) {
      if (o === me || o.falling) continue;
      const d = Math.hypot(o.x - me.x, o.z - me.z);
      if (d < bd) ((bd = d), (best = o));
    }
    if (!best) return { x: 0, y: 0, dash: false };
    const od = Math.hypot(best.x, best.z) || 1;
    const ox = best.x / od, oz = best.z / od; // outward from the middle, through them
    const stand = Math.min(od - BALL_R * 2.6, R * 0.6);
    tx = ox * stand;
    tz = oz * stand;
    const behind = Math.hypot(me.x - tx, me.z - tz) < BALL_R * 1.8;
    // Lined up (they're between us and the water) and in range: charge and go.
    const tox = best.x - me.x, toz = best.z - me.z;
    const align = (tox * ox + toz * oz) / (bd || 1);
    if ((behind || align > 0.8) && bd < BALL_R * 5.5 && me.cool <= 0 && Math.random() < bot.level.dashChance) {
      const err = (Math.random() - 0.5) * bot.level.aim;
      const a = Math.atan2(tox, toz) + err;
      bot.x = Math.sin(a);
      bot.y = Math.cos(a);
      bot.hold = 0.25 + Math.random() * 0.45;
      return { x: bot.x, y: bot.y, dash: true };
    }
  }
  let dx = tx - me.x, dz = tz - me.z;
  // Counter-steer against the current slide so we don't overshoot on the ice.
  dx -= me.vx * 0.35;
  dz -= me.vz * 0.35;
  const l = Math.hypot(dx, dz);
  bot.x = l > 0.3 ? dx / l : 0;
  bot.y = l > 0.3 ? dz / l : 0;
  return { x: bot.x, y: bot.y, dash: false };
}
