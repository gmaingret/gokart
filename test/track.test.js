import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, buildCenterline } from '../public/tv/track.js';

for (const def of TRACKS) {
  test(`${def.name}: layout never overlaps itself`, () => {
    const cl = buildCenterline(def);
    // Barriers of two different stretches of road must stay apart (bridges excepted).
    assert.ok(cl.minClearance() > 4, `clearance ${cl.minClearance().toFixed(1)}`);
    assert.ok(cl.length > 700 && cl.length < 1900, `length ${cl.length.toFixed(0)}`);
  });

  test(`${def.name}: locate() finds the point it was given`, () => {
    const cl = buildCenterline(def);
    for (const s of [0, 37.5, cl.n / 2, cl.n - 3]) {
      const p = cl.pointAt(s, 5);
      const hit = cl.locate(p.x, p.z, -1, p.y);
      assert.ok(Math.abs(hit.lateral - 5) < 0.6, `lateral ${hit.lateral}`);
      const d = Math.abs(hit.idx + hit.f - s);
      assert.ok(Math.min(d, cl.n - d) < 1.5, `idx ${hit.idx + hit.f} vs ${s}`);
    }
  });

  test(`${def.name}: road is wide enough and elevation is sane`, () => {
    const cl = buildCenterline(def);
    for (let i = 0; i < cl.n; i++) {
      assert.ok(cl.hw[i] >= 6.5 && cl.hw[i] <= 12, `half-width ${cl.hw[i]} at ${i}`);
      assert.ok(cl.py[i] > -2 && cl.py[i] < 20, `elevation ${cl.py[i]} at ${i}`);
    }
    // Start straight is flat and standard width (grid + gantry).
    assert.ok(Math.abs(cl.py[0] - cl.py[cl.n - 20]) < 1.2, 'start area roughly flat');
  });

  test(`${def.name}: shortcut, jumps and hazards are laid out sensibly`, () => {
    const cl = buildCenterline(def);
    if (def.shortcut) assert.ok(cl.shortcut, 'shortcut opening found');
    const near = (a, b) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b)) * cl.length < 25;
    const spots = [...def.boxes, ...def.pads];
    for (const j of def.jumps || []) assert.ok(!spots.some((s) => near(s, j)), `jump at ${j} clashes with a box/pad`);
    for (const [, f] of def.hazards || []) {
      assert.ok(!spots.some((s) => near(s, f)), `hazard at ${f} clashes with a box/pad`);
      assert.ok(!(def.jumps || []).some((j) => near(j, f)), `hazard at ${f} clashes with a jump`);
      assert.ok(f > 0.08 && f < 0.95, 'no hazard on the start grid');
    }
  });
}
