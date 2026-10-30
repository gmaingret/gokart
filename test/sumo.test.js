import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, R0, R_MIN, SHRINK_START, SHRINK_TIME, createBot, driveBot } from '../public/sumo/arena.js';

const run = (a, s, inputs = []) => {
  for (let t = 0; t < s; t += 1 / 60) a.step(1 / 60, typeof inputs === 'function' ? inputs() : inputs);
};

test('sliding off the ring makes you fall and splash', () => {
  const a = new Arena(2);
  run(a, 3, [{ x: 1, y: 0 }]);
  const b = a.balls[0];
  assert.ok(b.falling);
  run(a, 2);
  assert.ok(b.out);
  assert.ok(a.events.some((e) => e.type === 'fall' && e.i === 0));
  assert.ok(a.events.some((e) => e.type === 'splash' && e.i === 0));
});

test('a charged dash shoves much harder than a plain bump', () => {
  const shove = (dash) => {
    const a = new Arena(2);
    Object.assign(a.balls[0], { x: -3, z: 0, facing: Math.PI / 2 });
    Object.assign(a.balls[1], { x: 0, z: 0 });
    // Fastest the target is sent flying.
    let top = 0;
    for (let t = 0; t < 1.1; t += 1 / 60) {
      a.step(1 / 60, [{ x: 1, y: 0, dash: dash && t < 0.5 }]);
      top = Math.max(top, a.balls[1].vx);
    }
    return top;
  };
  const plain = shove(false), dashed = shove(true);
  assert.ok(dashed > plain * 1.8, `dash ${dashed.toFixed(1)} vs plain ${plain.toFixed(1)}`);
});

test('the ring shrinks to its minimum', () => {
  const a = new Arena(2);
  run(a, SHRINK_START + SHRINK_TIME / 2);
  assert.ok(a.radius < R0 && a.radius > R_MIN);
  run(a, SHRINK_TIME);
  assert.equal(a.radius, R_MIN);
});

test('CPU wrestlers finish rounds with a single winner', () => {
  let decided = 0;
  for (let r = 0; r < 10; r++) {
    const a = new Arena(4);
    const bots = [0, 1, 2, 2].map((l, i) => createBot(i, l));
    for (let t = 0; t < 120 && a.alive().length > 1; t += 1 / 60) a.step(1 / 60, bots.map((b) => driveBot(b, a, 1 / 60)));
    if (a.alive().length === 1) decided++;
  }
  assert.ok(decided >= 8, `${decided}/10 rounds had a winner`);
});
