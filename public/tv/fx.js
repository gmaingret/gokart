import * as THREE from 'three';

// GPU point-sprite particles. Two pools: additive (sparks, flames, glows) and
// alpha-blended (smoke, dust, confetti, snow). Simulation runs on the CPU.

const VERT = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
attribute float aShape;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
varying float vShape;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // Cap on-screen size so a particle drifting right past the camera doesn't fill the view.
  gl_PointSize = min(aSize * uScale / max(0.1, -mv.z), 90.0);
  vAlpha = aAlpha;
  vColor = aColor;
  vShape = aShape;
}`;

const FRAG = `
varying float vAlpha;
varying vec3 vColor;
varying float vShape;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float a;
  if (vShape > 1.5) {
    // square confetti
    a = 1.0;
  } else if (vShape > 0.5) {
    // 4-point star
    float d = abs(p.x) * abs(p.y) * 60.0 + length(p) * 1.6;
    a = clamp(1.0 - d, 0.0, 1.0);
  } else {
    // soft disc
    a = smoothstep(0.5, 0.0, length(p));
  }
  if (a * vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;

class Pool {
  constructor(size, additive) {
    this.size = size;
    this.n = 0;
    this.p = []; // particle structs
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(size * 3);
    this.col = new Float32Array(size * 3);
    this.siz = new Float32Array(size);
    this.alp = new Float32Array(size);
    this.shp = new Float32Array(size);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.siz, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alp, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aShape', new THREE.BufferAttribute(this.shp, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.geo = geo;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: 300 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
  }

  add(o) {
    if (this.p.length >= this.size) this.p.shift();
    this.p.push(o);
  }

  update(dt) {
    const list = this.p;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      o.t += dt;
      if (o.t >= o.life) continue;
      o.vy -= o.g * dt;
      const d = Math.exp(-o.drag * dt);
      o.vx *= d; o.vy *= d; o.vz *= d;
      o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
      if (o.y < o.fl && o.g > 0) {
        o.y = o.fl;
        o.vy = -o.vy * 0.3;
        o.vx *= 0.7; o.vz *= 0.7;
      }
      list[w++] = o;
    }
    list.length = w;
    for (let i = 0; i < w; i++) {
      const o = list[i];
      const k = o.t / o.life;
      this.pos[i * 3] = o.x; this.pos[i * 3 + 1] = o.y; this.pos[i * 3 + 2] = o.z;
      this.col[i * 3] = o.r; this.col[i * 3 + 1] = o.gC; this.col[i * 3 + 2] = o.b;
      this.siz[i] = o.s0 + (o.s1 - o.s0) * k;
      // quick fade-in, eased fade-out
      this.alp[i] = o.a * Math.min(1, o.t * 12) * (1 - k * k);
      this.shp[i] = o.shape;
    }
    this.geo.setDrawRange(0, w);
    for (const name of ['position', 'aColor', 'aSize', 'aAlpha', 'aShape']) this.geo.attributes[name].needsUpdate = true;
  }
}

const tmpC = new THREE.Color();

export class FX {
  constructor(scene) {
    this.add = new Pool(2500, true);
    this.alpha = new Pool(2500, false);
    scene.add(this.add.points, this.alpha.points);
    this.density = 1;
    this.weather = null;
  }

  // Called before each viewport render: points scale with viewport height.
  setViewport(cam, heightPx) {
    const s = (heightPx * 0.5) / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    this.add.material.uniforms.uScale.value = s;
    this.alpha.material.uniforms.uScale.value = s;
  }

  // Low-level spawn.
  spawn(additive, x, y, z, o) {
    if (o.chance !== undefined && Math.random() > o.chance * this.density) return;
    tmpC.set(o.color ?? 0xffffff);
    const sp = o.spread ?? 1;
    (additive ? this.add : this.alpha).add({
      x: x + (Math.random() - 0.5) * (o.jitter ?? 0),
      y: y + (Math.random() - 0.5) * (o.jitter ?? 0) * 0.5,
      z: z + (Math.random() - 0.5) * (o.jitter ?? 0),
      vx: (o.vx ?? 0) + (Math.random() - 0.5) * sp,
      vy: (o.vy ?? 0) + (Math.random() - 0.5) * sp * (o.spreadY ?? 1),
      vz: (o.vz ?? 0) + (Math.random() - 0.5) * sp,
      g: o.g ?? 0,
      // Bounce height: the ground just below where it was emitted.
      fl: o.floor ?? y - 1.5,
      drag: o.drag ?? 1,
      t: 0,
      life: (o.life ?? 0.5) * (0.75 + Math.random() * 0.5),
      s0: o.s0 ?? 1,
      s1: o.s1 ?? o.s0 ?? 1,
      a: o.a ?? 1,
      r: tmpC.r, gC: tmpC.g, b: tmpC.b,
      shape: o.shape ?? 0,
    });
  }

  // ---- presets
  spark(x, y, z, color, vx = 0, vz = 0) {
    this.spawn(true, x, y, z, { color, vx, vz, vy: 2.5, spread: 5, spreadY: 0.8, g: 14, drag: 2, life: 0.35, s0: 0.45, s1: 0.1, chance: 1 });
  }
  smoke(x, y, z, vx = 0, vz = 0, color = 0xdddddd, a = 0.35) {
    this.spawn(false, x, y, z, { color, vx: vx * 0.3, vz: vz * 0.3, vy: 1.2, spread: 1.2, drag: 1.5, life: 0.9, s0: 0.8, s1: 3.2, a, chance: 1 });
  }
  dust(x, y, z, color, vx = 0, vz = 0) {
    this.spawn(false, x, y, z, { color, vx: vx * 0.2, vz: vz * 0.2, vy: 1.6, spread: 2.5, g: 1.5, drag: 1.8, life: 0.7, s0: 0.9, s1: 2.6, a: 0.55, chance: 1 });
  }
  flame(x, y, z, vx, vz, hot) {
    this.spawn(true, x, y, z, { color: hot ? 0x66c8ff : 0xff8a1e, vx, vz, vy: 0.4, spread: 0.8, drag: 4, life: 0.18, s0: 1.1, s1: 0.2, chance: 1 });
    this.spawn(true, x, y, z, { color: 0xffe08a, vx, vz, spread: 0.4, drag: 4, life: 0.1, s0: 0.6, s1: 0.1, chance: 1 });
  }
  burst(x, y, z, colors, n = 24, speed = 9, shape = 1) {
    for (let i = 0; i < n * this.density; i++) {
      const c = colors[i % colors.length];
      this.spawn(true, x, y, z, { color: c, vy: 3, spread: speed, g: 8, drag: 1.2, life: 0.7, s0: 0.9, s1: 0.2, shape });
    }
  }
  explosion(x, y, z, color) {
    this.burst(x, y + 0.6, z, [color, 0xffffff, 0xffd84d], 28, 12, 1);
    for (let i = 0; i < 10 * this.density; i++) this.smoke(x, y + 0.5, z, 0, 0, 0xbbbbbb, 0.5);
  }
  confetti(x, y, z, n = 60) {
    const cols = [0xff4f7b, 0xffcf33, 0x3fd2ff, 0x7dff6e, 0xb784ff, 0xffffff];
    for (let i = 0; i < n * this.density; i++) {
      this.spawn(false, x, y + 4, z, { floor: y + 0.05, color: cols[i % cols.length], vy: 7, spread: 12, spreadY: 0.6, g: 6, drag: 2.2, life: 2.4, s0: 0.45, s1: 0.4, a: 1, shape: 2 });
    }
  }
  sparkle(x, y, z, color) {
    this.spawn(true, x, y, z, { color, vy: 0.8, spread: 1.5, jitter: 2.5, drag: 2, life: 0.5, s0: 0.6, s1: 0.1, shape: 1, chance: 1 });
  }
  trail(x, y, z, color) {
    this.spawn(true, x, y, z, { color, spread: 0.3, drag: 2, life: 0.3, s0: 0.7, s1: 0.1, chance: 1 });
  }

  // Ambient weather around a point (each human camera).
  ambient(dt, x, z, kind, y0 = 0) {
    if (!kind) return;
    const rate = kind === 'snow' ? 90 : kind === 'leaves' || kind === 'sprinkles' ? 40 : 25;
    const r = rate * dt * this.density;
    const n = Math.floor(r) + (Math.random() < r % 1 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const px = x + (Math.random() - 0.5) * 70, pz = z + (Math.random() - 0.5) * 70;
      if (kind === 'snow') {
        this.spawn(false, px, y0 + 14 + Math.random() * 6, pz, { color: 0xffffff, vy: -3, vx: 1, spread: 1, drag: 0.2, life: 5, s0: 0.35, s1: 0.35, a: 0.9 });
      } else if (kind === 'motes') {
        const c = Math.random() < 0.5 ? 0x00e5ff : 0xff2bd6;
        this.spawn(true, px, y0 + 0.5 + Math.random() * 8, pz, { color: c, vy: 0.5, spread: 0.6, drag: 0.2, life: 3.5, s0: 0.5, s1: 0.2, a: 0.8 });
      } else if (kind === 'sand') {
        this.spawn(false, px, y0 + 0.3 + Math.random() * 2, pz, { color: 0xf0d39a, vx: 6, vy: 0.2, spread: 1.5, drag: 0.3, life: 2.5, s0: 0.6, s1: 1.4, a: 0.25 });
      } else if (kind === 'leaves') {
        const c = [0xe67e22, 0xc0392b, 0xf1c40f, 0xb5651d][Math.floor(Math.random() * 4)];
        this.spawn(false, px, y0 + 8 + Math.random() * 8, pz, { color: c, vy: -1.6, vx: 1.2, spread: 2, drag: 0.4, life: 6, s0: 0.5, s1: 0.45, a: 0.95, shape: 2 });
      } else if (kind === 'embers') {
        this.spawn(true, px, y0 + 0.3 + Math.random() * 2, pz, { color: Math.random() < 0.5 ? 0xff5a00 : 0xffb040, vy: 2.5, spread: 1.2, drag: 0.3, life: 3, s0: 0.35, s1: 0.05, a: 1 });
      } else if (kind === 'sprinkles') {
        const c = [0xff6fb5, 0x7fdbff, 0xffe14d, 0x7dff6e, 0xb784ff][Math.floor(Math.random() * 5)];
        this.spawn(false, px, y0 + 10 + Math.random() * 6, pz, { color: c, vy: -3, spread: 0.6, drag: 0.2, life: 5, s0: 0.18, s1: 0.18, a: 1 });
      } else if (kind === 'pollen') {
        this.spawn(true, px, y0 + 1 + Math.random() * 6, pz, { color: 0xfff6b0, vy: 0.2, spread: 0.5, drag: 0.3, life: 4, s0: 0.25, s1: 0.2, a: 0.6 });
      }
    }
  }

  update(dt) {
    this.add.update(dt);
    this.alpha.update(dt);
  }

  clear() {
    this.add.p.length = 0;
    this.alpha.p.length = 0;
    this.update(0);
  }
}
