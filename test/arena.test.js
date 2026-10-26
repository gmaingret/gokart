import test from 'node:test';
import assert from 'node:assert/strict';
import { makeArenaPhysics, ARENA_RADIUS } from '../public/tv/arena.js';

test('karts are kept inside the arena wall', () => {
  const a = makeArenaPhysics();
  const o = { x: ARENA_RADIUS + 10, z: 0 };
  const hits = a.constrain(o, 1);
  assert.equal(hits.length, 1);
  assert.ok(Math.hypot(o.x, o.z) <= ARENA_RADIUS - 1 + 1e-9);
  assert.ok(hits[0].nx < 0, 'wall normal points back toward the centre');
});

test('karts are pushed out of obstacles', () => {
  const a = makeArenaPhysics();
  const tower = a.obstacles[0];
  const o = { x: tower.x + 1, z: tower.z };
  a.constrain(o, 1);
  assert.ok(Math.hypot(o.x - tower.x, o.z - tower.z) >= tower.r + 1 - 1e-9);
});

test('line of sight is blocked by the central tower', () => {
  const a = makeArenaPhysics();
  assert.ok(a.blocked(-30, 0, 30, 0));
  assert.equal(a.blocked(-30, 12, 30, 12), null);
});
