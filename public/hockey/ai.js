import { HX, GOAL, PUCK_R, MALLET_R, predictZ } from './table.js';

// CPU opponent. Levels change top speed, reaction time and aim.
export const LEVELS = [
  { name: 'Easy', speed: 17, react: 0.22, aim: 3.5, err: 1.8 },
  { name: 'Normal', speed: 25, react: 0.12, aim: 1.8, err: 0.9 },
  { name: 'Hard', speed: 36, react: 0.05, aim: 0.6, err: 0.3 },
];

export function createBot(i, level) {
  return { i, level: LEVELS[level], wait: 0, tx: 0, tz: 0, aimZ: 0, err: 0, mode: 'home', stall: 0, retreat: 0 };
}

// Updates bot.tx / bot.tz (the mallet target) for table mallet `bot.i`.
export function driveBot(bot, table, dt) {
  const m = table.mallets[bot.i];
  const p = table.puck;
  const side = m.side;
  m.maxSpeed = bot.level.speed;
  // Pinning the puck against a rail (or the other mallet) gets nowhere: back off.
  const near = Math.hypot(p.x - m.x, p.z - m.z) < PUCK_R + MALLET_R + 0.6;
  bot.stall = near && Math.hypot(p.vx, p.vz) < 4 ? bot.stall + dt : 0;
  if (bot.stall > 0.8) ((bot.retreat = 0.5), (bot.stall = 0));
  if (bot.retreat > 0) {
    bot.retreat -= dt;
    bot.tx = side * (HX - 2);
    bot.tz = m.z;
    return;
  }
  bot.wait -= dt;
  if (bot.wait > 0) return;
  bot.wait = bot.level.react;

  const mine = p.x * side > 0;
  const coming = p.vx * side > 1;
  const slow = Math.hypot(p.vx, p.vz) < 9;

  if (mine && (slow || !coming)) {
    // Attack: get behind the puck (relative to the other goal), then drive through it.
    if (bot.mode !== 'attack') bot.aimZ = (Math.random() * 2 - 1) * bot.level.aim;
    bot.mode = 'attack';
    const gx = -side * HX, gz = Math.max(-GOAL, Math.min(GOAL, bot.aimZ));
    let dx = gx - p.x, dz = gz - p.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    const behind = (m.x - p.x) * dx + (m.z - p.z) * dz < -(PUCK_R + MALLET_R) * 0.6;
    if (behind) {
      bot.tx = p.x + dx * 3;
      bot.tz = p.z + dz * 3;
    } else {
      // Swing round to the far side of the puck without pushing it home.
      const off = PUCK_R + MALLET_R + 1.3;
      bot.tx = p.x - dx * off;
      bot.tz = p.z - dz * off + (m.z > p.z ? 1 : -1) * 0.8;
    }
  } else if (coming) {
    // Defend: meet the puck on a line in front of the goal.
    if (bot.mode !== 'defend') bot.err = (Math.random() * 2 - 1) * bot.level.err;
    bot.mode = 'defend';
    const lineX = side * (HX - 2.4);
    const z = predictZ(p, lineX);
    bot.tx = lineX;
    bot.tz = (z === null ? p.z * 0.5 : Math.max(-GOAL * 1.4, Math.min(GOAL * 1.4, z))) + bot.err;
  } else {
    bot.mode = 'home';
    bot.tx = side * (HX - 3);
    bot.tz = p.z * 0.35;
  }
}
