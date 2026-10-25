import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, WALL, buildCenterline } from '../public/tv/track.js';

for (const def of TRACKS) {
  test(`${def.name}: layout never overlaps itself`, () => {
    const cl = buildCenterline(def);
    // Two stretches of road must be further apart than both barriers combined.
    assert.ok(cl.minSelfDistance() > WALL * 2 + 4, `min distance ${cl.minSelfDistance().toFixed(1)}`);
    assert.ok(cl.length > 700 && cl.length < 1800, `length ${cl.length.toFixed(0)}`);
  });

  test(`${def.name}: locate() finds the point it was given`, () => {
    const cl = buildCenterline(def);
    for (const s of [0, 37.5, cl.n / 2, cl.n - 3]) {
      const p = cl.pointAt(s, 5);
      const hit = cl.locate(p.x, p.z, -1);
      assert.ok(Math.abs(hit.lateral - 5) < 0.6, `lateral ${hit.lateral}`);
      const d = Math.abs(hit.idx + hit.f - s);
      assert.ok(Math.min(d, cl.n - d) < 1.5, `idx ${hit.idx + hit.f} vs ${s}`);
    }
  });
}
