import test from 'node:test';
import assert from 'node:assert/strict';
import { makeArenaPhysics, layout, SHAPES } from '../public/tv/arena.js';

test('karts are kept inside the arena wall', () => {
  const a = makeArenaPhysics('circle');
  const o = { x: a.R + 0.5, z: 0 };
  const hits = a.constrain(o, 1);
  assert.ok(hits.length >= 1);
  assert.ok(Math.hypot(o.x, o.z) <= a.R - 1 + 1e-6);
  assert.ok(hits[0].nx < 0, 'wall normal points back toward the centre');
});

test('karts are pushed out of obstacles', () => {
  const a = makeArenaPhysics('circle');
  const tower = a.obstacles[0];
  const o = { x: tower.x + 1, z: tower.z };
  a.constrain(o, 1);
  assert.ok(Math.hypot(o.x - tower.x, o.z - tower.z) >= tower.r + 1 - 1e-9);
});

test('line of sight is blocked by the central tower', () => {
  const a = makeArenaPhysics('circle');
  assert.ok(a.blocked(-30, 0, 30, 0));
  assert.equal(a.blocked(-30, 12, 30, 12), null);
});

for (const shape of SHAPES) {
  test(`${shape}: spawns and item boxes are inside and clear of obstacles`, () => {
    const L = layout(shape);
    const a = makeArenaPhysics(shape, L);
    assert.equal(L.spawns.length, 8);
    for (const p of [...L.spawns, ...L.boxes]) {
      assert.ok(a.inside(p.x, p.z, 2.5), `${shape}: (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) not clear`);
      assert.equal(a.groundAt(p.x, p.z), p.y ?? 0, `${shape}: height at (${p.x}, ${p.z})`);
    }
    for (let i = 0; i < 20; i++) {
      const q = a.randomPoint();
      assert.ok(a.inside(q.x, q.z, 3));
    }
  });
}

test('cross: the inner corners block driving diagonally between arms', () => {
  const a = makeArenaPhysics('cross');
  const o = { x: 25, z: 25.5, y: 0 }; // just past the corner at (24, 24)
  a.constrain(o, 1);
  assert.ok(Math.abs(o.x) < 24 || Math.abs(o.z) < 24, `ended at ${o.x}, ${o.z}`);
  assert.ok(a.blocked(50, 10, 10, 50));
});

test('pyramid: platform walls block from below, ramps lead up, the edge can be driven off', () => {
  const a = makeArenaPhysics('pyramid');
  const { half, h, rampL } = a.platform;
  assert.equal(a.groundAt(0, 0), h);
  assert.ok(Math.abs(a.groundAt(half + rampL / 2, 0) - h / 2) < 1e-6);
  assert.equal(a.groundAt(half + rampL + 1, 0), 0);
  // Below, against the face away from a ramp: pushed back out.
  const low = { x: half + 0.5, z: 12, y: 0 };
  a.constrain(low, 1);
  assert.ok(low.x >= half + 1 - 1e-6, `low kart at ${low.x}`);
  // On the deck at the same spot: free to go over the edge.
  const high = { x: half - 0.5, z: 12, y: h };
  assert.equal(a.constrain(high, 1).length, 0);
  // Heading for a box on the platform from the floor goes via a ramp.
  const wp = a.waypoint(50, 40, 0, 9, 9);
  assert.ok(wp && (Math.abs(wp.x) < 1 || Math.abs(wp.z) < 1), 'waypoint lies on a ramp axis');
});
