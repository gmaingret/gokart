import test from 'node:test';
import assert from 'node:assert/strict';
import { Kitchen, LAYOUT, W, H } from '../public/cook/kitchen.js';

// Put chef 0 next to a station and face it.
function at(k, x, y, fx, fy) {
  const c = k.chefs[0];
  Object.assign(c, { x, y, fx, fy });
  return c;
}
const press = (k, inp = {}) => {
  k.step(1 / 60, [{ ...inp, a: true }]);
  k.step(1 / 60, [{}]);
};
const hold = (k, seconds, inp) => {
  for (let t = 0; t < seconds; t += 1 / 60) k.step(1 / 60, [inp]);
};
const tile = (k, ch, n = 0) => k.tiles.flat().filter((t) => t?.ch === ch)[n];

test('the map is a closed box with every station reachable from a floor tile', () => {
  assert.equal(LAYOUT.length, H);
  for (const row of LAYOUT) assert.equal(row.length, W);
  const k = new Kitchen({ chefs: 1 });
  for (const t of k.tiles.flat()) {
    if (!t || t.kind === 'counter') continue;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => LAYOUT[t.y + dy]?.[t.x + dx] === '.');
    assert.ok(nb, `${t.kind} at ${t.x},${t.y} has no floor next to it`);
  }
});

test('make and serve a salad', () => {
  const k = new Kitchen({ chefs: 1 });
  k.orders = [];
  k.nextOrder = 999;
  k.addOrder('salad');
  const lettuce = tile(k, 'L'), board = tile(k, 'K'), plates = tile(k, 'P'), win = tile(k, 'W');
  const crate = tile(k, 'T');
  // Lettuce: crate -> board -> chop -> plate (on a counter) ...
  at(k, lettuce.x + 0.5, 1.5, 0, -1);
  press(k);
  assert.equal(k.chefs[0].holding.kind, 'lettuce');
  at(k, 1.5, board.y + 0.5, -1, 0);
  press(k);
  assert.equal(board.item.kind, 'lettuce');
  hold(k, 1.8, { b: true });
  assert.equal(board.item.state, 'chopped');
  // Grab a plate, scoop the lettuce off the board.
  at(k, plates.x + 0.5, 5.5, 0, 1);
  press(k);
  assert.equal(k.chefs[0].holding.type, 'plate');
  at(k, 1.5, board.y + 0.5, -1, 0);
  press(k);
  assert.deepEqual(k.chefs[0].holding.contents, ['lettuce']);
  // Park the plate on the island counter, chop a tomato, add it.
  const island = k.tiles[3][5];
  at(k, 5.5, 2.5, 0, 1);
  press(k);
  assert.equal(island.item.type, 'plate');
  at(k, crate.x + 0.5, 1.5, 0, -1);
  press(k);
  at(k, 1.5, board.y + 0.5, -1, 0);
  press(k);
  hold(k, 1.8, { b: true });
  press(k);
  assert.equal(k.chefs[0].holding.state, 'chopped');
  at(k, 5.5, 2.5, 0, 1);
  press(k);
  assert.deepEqual(island.item.contents.sort(), ['lettuce', 'tomato']);
  // Serve.
  press(k);
  at(k, 12.5, win.y + 0.5, 1, 0);
  press(k);
  assert.equal(k.served, 1);
  assert.ok(k.score >= 20);
  assert.equal(k.orders.length, 0);
});

test('patties cook on the stove, then burn if left', () => {
  const k = new Kitchen({ chefs: 1 });
  const meat = tile(k, 'M'), board = tile(k, 'K'), stove = tile(k, 'S');
  at(k, meat.x + 0.5, 1.5, 0, -1);
  press(k);
  // Raw meat can't go on the stove before it's chopped into a patty.
  at(k, stove.x + 0.5, 1.5, 0, -1);
  press(k);
  assert.equal(stove.item, null);
  at(k, 1.5, board.y + 0.5, -1, 0);
  press(k);
  hold(k, 1.8, { b: true });
  press(k);
  at(k, stove.x + 0.5, 1.5, 0, -1);
  press(k);
  assert.equal(stove.item.state, 'chopped');
  hold(k, 5.2, {});
  assert.equal(stove.item.state, 'cooked');
  hold(k, 8.2, {});
  assert.equal(stove.item.state, 'burnt');
  assert.ok(k.events.some((e) => e.type === 'burnt'));
});

test('a wrong plate is refused and orders expire with a penalty', () => {
  const k = new Kitchen({ chefs: 1, difficulty: 1 });
  k.orders = [];
  k.addOrder('burger');
  k.score = 30;
  const plates = tile(k, 'P'), bun = tile(k, 'B');
  at(k, plates.x + 0.5, 5.5, 0, 1);
  press(k);
  at(k, bun.x + 0.5, 1.5, 0, -1);
  press(k); // bun straight onto the plate
  assert.deepEqual(k.chefs[0].holding.contents, ['bun']);
  at(k, 12.5, 2.5, 1, 0);
  press(k);
  assert.ok(k.events.some((e) => e.type === 'wrong'));
  assert.ok(k.chefs[0].holding, 'still holding the plate');
  k.nextOrder = 999;
  hold(k, 60, {});
  assert.equal(k.orders.length, 0);
  assert.equal(k.score, 20);
});

test('chefs cannot walk through counters', () => {
  const k = new Kitchen({ chefs: 1 });
  const c = at(k, 6.5, 2.5, 0, 1);
  hold(k, 1, { y: 1 }); // the island is right below
  assert.ok(c.y < 3 - 0.3 + 1e-9, `chef y ${c.y}`);
});
