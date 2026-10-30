import test from 'node:test';
import assert from 'node:assert/strict';
import { Table, HX, HZ, GOAL, PUCK_R, MALLET_R, predictZ } from '../public/hockey/table.js';
import { createBot, driveBot } from '../public/hockey/ai.js';

const run = (t, seconds) => {
  for (let i = 0; i < seconds * 60; i++) t.step(1 / 60);
};
// Park both mallets out of the way.
const park = (t) => t.mallets.forEach((m, i) => (m.x = m.tx = (i ? 1 : -1) * (HX - 1), m.z = m.tz = HZ - 1));

test('the puck bounces off the side rail and stays on the table', () => {
  const t = new Table();
  park(t);
  Object.assign(t.puck, { x: 0, z: 0, vx: 0, vz: 20 });
  run(t, 0.5);
  assert.ok(t.puck.vz < 0, 'bounced back');
  assert.ok(Math.abs(t.puck.z) <= HZ - PUCK_R + 1e-9);
  assert.ok(t.events.some((e) => e.type === 'wall'));
});

test('a shot into the left goal scores for the right player', () => {
  const t = new Table();
  park(t);
  Object.assign(t.puck, { x: -6, z: 0.5, vx: -25, vz: 0 });
  run(t, 1);
  const g = t.events.find((e) => e.type === 'goal');
  assert.ok(g, 'goal scored');
  assert.equal(g.scorer, 1);
  assert.ok(t.frozen);
});

test('the end rail beside the goal mouth bounces the puck back', () => {
  const t = new Table();
  park(t);
  t.mallets.forEach((m) => (m.z = m.tz = 0));
  Object.assign(t.puck, { x: 6, z: GOAL + 1.5, vx: 25, vz: 0 });
  run(t, 0.6);
  assert.ok(!t.events.some((e) => e.type === 'goal'));
  assert.ok(t.puck.vx < 0);
});

test('mallets stay in their own half', () => {
  const t = new Table();
  t.setTarget(0, 8, 20);
  run(t, 1);
  assert.ok(t.mallets[0].x < 0, `left mallet x ${t.mallets[0].x}`);
  assert.ok(t.mallets[0].z <= HZ - MALLET_R + 1e-9);
  t.setTarget(1, -8, 0);
  run(t, 1);
  assert.ok(t.mallets[1].x > 0);
});

test('a moving mallet hits the puck away', () => {
  const t = new Table();
  Object.assign(t.puck, { x: -5, z: 0, vx: 0, vz: 0 });
  const m = t.mallets[0];
  Object.assign(m, { x: -9, z: 0, tx: -9, tz: 0 });
  t.setTarget(0, -2, 0);
  run(t, 0.15);
  assert.ok(t.puck.vx > 15, `puck vx ${t.puck.vx}`);
  assert.ok(t.events.some((e) => e.type === 'hit' && e.mallet === 0));
});

test('predictZ folds side-rail bounces', () => {
  const p = { x: 0, z: 0, vx: 10, vz: 10 };
  const z = predictZ(p, 10); // travels 10 across: would be z = 10, folds to 2 * (HZ - r) - 10
  assert.ok(Math.abs(z - (2 * (HZ - PUCK_R) - 10)) < 1e-9);
  assert.equal(predictZ({ x: 0, z: 0, vx: -5, vz: 0 }, 10), null);
});

test('CPU vs CPU: goals happen, the puck never escapes and never stalls for long', () => {
  const t = new Table();
  t.serve(-1);
  const bots = [createBot(0, 2), createBot(1, 0)];
  let goals = 0, still = 0, maxStill = 0, wait = 0;
  for (let f = 0; f < 60 * 120; f++) {
    for (const b of bots) {
      driveBot(b, t, 1 / 60);
      t.setTarget(b.i, b.tx, b.tz);
    }
    t.step(1 / 60);
    const p = t.puck;
    assert.ok(Number.isFinite(p.x + p.z + p.vx + p.vz));
    assert.ok(Math.abs(p.z) <= HZ, `puck z ${p.z}`);
    assert.ok(Math.abs(p.x) <= HX + PUCK_R * 2 + 0.5, `puck x ${p.x}`);
    still = Math.hypot(p.vx, p.vz) < 0.5 && !t.frozen ? still + 1 : 0;
    maxStill = Math.max(maxStill, still);
    for (const e of t.events) if (e.type === 'goal') goals++;
    t.events.length = 0;
    if (t.frozen && ++wait > 60) {
      wait = 0;
      t.frozen = false;
      t.serve(p.x < 0 ? -1 : 1);
      t.resetMallets();
    }
  }
  assert.ok(goals >= 3, `goals ${goals}`);
  assert.ok(maxStill < 60 * 3, `stalled ${maxStill / 60}s`);
});
