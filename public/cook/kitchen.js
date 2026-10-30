// Kitchen Rush rules, pure logic (no DOM / THREE) so it can be unit-tested.
//
// The kitchen is a grid. Chefs walk on floor tiles ('.') and work at the
// station they face. GRAB picks up / puts down / combines; CHOP (held) chops
// whatever is on a chopping board. Stoves cook patties by themselves, and
// burn them if they're left too long.

export const LAYOUT = [
  '#T#L#B#M#S#S##',
  '#............#',
  'K............W',
  '#....####....#',
  'K............W',
  '#............#',
  '##P#X#P###K###',
];
export const W = LAYOUT[0].length;
export const H = LAYOUT.length;

// Station kinds by map letter.
export const STATIONS = {
  '#': 'counter',
  T: 'crate',
  L: 'crate',
  B: 'crate',
  M: 'crate',
  K: 'board',
  S: 'stove',
  P: 'plates',
  W: 'window',
  X: 'trash',
};
export const CRATE_OF = { T: 'tomato', L: 'lettuce', B: 'bun', M: 'meat' };

// What each ingredient must be before it can go on a plate.
const READY = { tomato: 'chopped', lettuce: 'chopped', bun: 'raw', meat: 'cooked' };
const CHOPPABLE = new Set(['tomato', 'lettuce', 'meat']);

export const RECIPES = {
  salad: { name: 'Salad', items: ['lettuce', 'tomato'], time: 45 },
  burger: { name: 'Burger', items: ['bun', 'meat'], time: 55 },
  deluxe: { name: 'Deluxe burger', items: ['bun', 'meat', 'lettuce'], time: 65 },
  veggie: { name: 'Veggie burger', items: ['bun', 'lettuce', 'tomato'], time: 55 },
};
export const DIFFICULTY = [
  { name: 'Chill', every: 22, timeMul: 1.35, max: 3 },
  { name: 'Normal', every: 17, timeMul: 1, max: 4 },
  { name: 'Rush', every: 12, timeMul: 0.8, max: 5 },
];

const CHOP_TIME = 1.6;
const COOK_TIME = 5;
const BURN_TIME = 8; // after cooked
const SPEED = 4.6; // tiles per second
export const CHEF_R = 0.32;

export function ingredient(kind) {
  return { type: 'food', kind, state: 'raw', progress: 0 };
}
export function plate() {
  return { type: 'plate', contents: [] };
}
const isReady = (it) => it?.type === 'food' && READY[it.kind] === it.state;

export class Kitchen {
  constructor({ difficulty = 1, duration = 180, chefs = 2, random = Math.random } = {}) {
    this.diff = DIFFICULTY[difficulty];
    this.duration = duration;
    this.time = 0;
    this.random = random;
    this.score = 0;
    this.served = 0;
    this.failed = 0;
    this.events = [];
    this.orders = [];
    this.nextOrder = 2;
    this.orderId = 1;
    // Tiles: station state per non-floor cell.
    this.tiles = LAYOUT.map((row, y) =>
      [...row].map((ch, x) => (ch === '.' ? null : { ch, kind: STATIONS[ch], x, y, item: null, progress: 0 }))
    );
    // Start with a couple of plates out to get going.
    const starts = [
      [1.5, 1.5], [12.5, 1.5], [1.5, 5.5], [12.5, 5.5],
    ];
    this.chefs = [];
    for (let i = 0; i < chefs; i++) {
      const [x, y] = starts[i % starts.length];
      this.chefs.push({ i, x, y, fx: 0, fy: 1, holding: null, chopping: false, lastA: false });
    }
  }

  tile(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return { kind: 'wall', ch: '#' };
    return this.tiles[y][x];
  }
  solid(x, y) {
    return this.tile(x, y) !== null;
  }

  // The station a chef is facing (tile in front of them), or null.
  facing(c) {
    const tx = Math.floor(c.x + c.fx * 0.75), ty = Math.floor(c.y + c.fy * 0.75);
    const t = this.tile(tx, ty);
    return t && t.kind !== 'wall' ? t : null;
  }

  // inputs[i] = { x, y, a, b } (joystick, GRAB held, CHOP held)
  step(dt, inputs) {
    this.time += dt;
    for (const c of this.chefs) this.moveChef(c, inputs[c.i] || {}, dt);
    this.separate();
    for (const c of this.chefs) {
      const inp = inputs[c.i] || {};
      if (inp.a && !c.lastA) this.grab(c);
      c.lastA = !!inp.a;
      c.chopping = false;
      if (inp.b) this.chop(c, dt);
    }
    this.cook(dt);
    this.updateOrders(dt);
  }

  moveChef(c, inp, dt) {
    let ix = inp.x || 0, iy = inp.y || 0;
    const m = Math.hypot(ix, iy);
    if (m < 0.15) return;
    if (m > 1) ((ix /= m), (iy /= m));
    // Face the dominant direction (stations are on a grid).
    if (Math.abs(ix) > Math.abs(iy)) ((c.fx = Math.sign(ix)), (c.fy = 0));
    else ((c.fx = 0), (c.fy = Math.sign(iy)));
    const sp = SPEED * Math.min(1, m);
    this.slide(c, ix * sp * dt, 0);
    this.slide(c, 0, iy * sp * dt);
  }

  // Move along one axis, stopping at solid tiles (circle vs grid).
  slide(c, dx, dy) {
    const nx = c.x + dx, ny = c.y + dy;
    const r = CHEF_R;
    for (const [px, py] of [[nx - r, ny - r], [nx + r, ny - r], [nx - r, ny + r], [nx + r, ny + r]]) {
      if (this.solid(Math.floor(px), Math.floor(py))) return;
    }
    c.x = nx;
    c.y = ny;
  }

  separate() {
    for (let a = 0; a < this.chefs.length; a++) {
      for (let b = a + 1; b < this.chefs.length; b++) {
        const A = this.chefs[a], B = this.chefs[b];
        const dx = B.x - A.x, dy = B.y - A.y;
        const d = Math.hypot(dx, dy);
        if (d >= CHEF_R * 2 || d < 1e-6) continue;
        const p = (CHEF_R * 2 - d) / 2;
        this.slide(A, (-dx / d) * p, 0);
        this.slide(A, 0, (-dy / d) * p);
        this.slide(B, (dx / d) * p, 0);
        this.slide(B, 0, (dy / d) * p);
      }
    }
  }

  emit(type, c, extra = {}) {
    this.events.push({ type, chef: c?.i, ...extra });
  }

  // GRAB: pick up, put down, or combine with whatever is on the station.
  grab(c) {
    const t = this.facing(c);
    if (!t) return;
    const h = c.holding;
    if (t.kind === 'crate') {
      const kind = CRATE_OF[t.ch];
      if (!h) return this.give(c, ingredient(kind), 'pick');
      // Buns go straight onto a plate.
      if (h.type === 'plate' && kind === 'bun') return this.addToPlate(c, h, ingredient('bun'));
      return;
    }
    if (t.kind === 'plates') {
      if (!h) return this.give(c, plate(), 'pick');
      if (h.type === 'food' && isReady(h)) {
        const p = plate();
        if (this.tryAdd(p, h)) {
          c.holding = p;
          this.emit('plate', c);
        }
      }
      return;
    }
    if (t.kind === 'trash') {
      if (!h) return;
      if (h.type === 'plate') h.contents = [];
      else c.holding = null;
      return this.emit('trash', c);
    }
    if (t.kind === 'window') {
      if (h?.type === 'plate') this.serve(c, h);
      return;
    }
    // Counter, board, stove: hold one thing each.
    const it = t.item;
    if (!h) {
      if (!it) return;
      c.holding = it;
      t.item = null;
      t.progress = 0;
      return this.emit('pick', c);
    }
    if (!it) {
      if (t.kind === 'board' && !(h.type === 'food' && CHOPPABLE.has(h.kind) && h.state === 'raw')) return this.emit('nope', c);
      if (t.kind === 'stove' && !(h.type === 'food' && h.kind === 'meat' && h.state === 'chopped')) return this.emit('nope', c);
      t.item = h;
      c.holding = null;
      return this.emit('drop', c);
    }
    // Combine: plate in hand + food there, or food in hand + plate there.
    if (h.type === 'plate' && it.type === 'food') {
      if (this.tryAdd(h, it)) {
        t.item = null;
        t.progress = 0;
        this.emit('plate', c);
      } else this.emit('nope', c);
    } else if (h.type === 'food' && it.type === 'plate') {
      if (this.tryAdd(it, h)) {
        c.holding = null;
        this.emit('plate', c);
      } else this.emit('nope', c);
    }
  }

  give(c, item, ev) {
    c.holding = item;
    this.emit(ev, c);
  }
  tryAdd(p, food) {
    if (!isReady(food) || p.contents.includes(food.kind) || p.contents.length >= 3) return false;
    p.contents.push(food.kind);
    return true;
  }
  addToPlate(c, p, food) {
    if (this.tryAdd(p, food)) this.emit('plate', c);
    else this.emit('nope', c);
  }

  // CHOP (held): work the chopping board in front.
  chop(c, dt) {
    const t = this.facing(c);
    if (!t || t.kind !== 'board' || !t.item || t.item.state !== 'raw') return;
    c.chopping = true;
    t.item.progress = Math.min(1, t.item.progress + dt / CHOP_TIME);
    if (t.item.progress >= 1) {
      t.item.state = 'chopped';
      t.item.progress = 0;
      this.emit('chopped', c);
    }
  }

  cook(dt) {
    for (const row of this.tiles) {
      for (const t of row) {
        if (!t || t.kind !== 'stove' || !t.item || t.item.kind !== 'meat') continue;
        const it = t.item;
        if (it.state === 'chopped') {
          it.progress += dt / COOK_TIME;
          if (it.progress >= 1) {
            it.state = 'cooked';
            it.progress = 0;
            this.emit('cooked', null, { x: t.x, y: t.y });
          }
        } else if (it.state === 'cooked') {
          it.progress += dt / BURN_TIME;
          if (it.progress >= 1) {
            it.state = 'burnt';
            this.emit('burnt', null, { x: t.x, y: t.y });
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- orders
  updateOrders(dt) {
    if (this.time >= this.duration) return;
    this.nextOrder -= dt;
    if (this.nextOrder <= 0 && this.orders.length < this.diff.max) {
      this.addOrder();
      this.nextOrder = this.diff.every * (0.8 + this.random() * 0.4) * (this.time < 30 ? 0.7 : 1);
    }
    for (const o of this.orders) o.left -= dt;
    for (const o of this.orders.filter((o) => o.left <= 0)) {
      this.orders.splice(this.orders.indexOf(o), 1);
      this.score = Math.max(0, this.score - 10);
      this.failed++;
      this.emit('expired', null, { order: o });
    }
  }

  addOrder(recipe) {
    const keys = Object.keys(RECIPES);
    const r = recipe || keys[Math.floor(this.random() * keys.length)];
    const time = RECIPES[r].time * this.diff.timeMul;
    const o = { id: this.orderId++, recipe: r, left: time, time };
    this.orders.push(o);
    this.emit('order', null, { order: o });
    return o;
  }

  serve(c, p) {
    const key = [...p.contents].sort().join('+');
    const o = this.orders.find((o) => [...RECIPES[o.recipe].items].sort().join('+') === key);
    if (!o) return this.emit('wrong', c);
    this.orders.splice(this.orders.indexOf(o), 1);
    const tip = Math.round((o.left / o.time) * 12);
    this.score += 20 + tip;
    this.served++;
    c.holding = null;
    this.emit('served', c, { order: o, tip });
  }

  get over() {
    return this.time >= this.duration;
  }

  // Star thresholds scale with the round length (and team size a little).
  stars() {
    const k = (this.duration / 180) * (0.75 + 0.25 * Math.min(4, this.chefs.length) / 2);
    const s = this.score;
    return s >= 260 * k ? 3 : s >= 160 * k ? 2 : s >= 70 * k ? 1 : 0;
  }
}
