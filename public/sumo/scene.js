import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Post } from '../tv/post.js';
import { FX } from '../tv/fx.js';
import { Sky } from '../tv/sky.js';
import { R0, BALL_R, CHARGE_MAX } from './arena.js';

// Frozen lake at dusk: an ice ring (dohyō) floating on dark water, icebergs,
// snow, and round little sumo wrestlers.

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function iceTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, '#cdeafb');
    grd.addColorStop(0.7, '#94cdee');
    grd.addColorStop(1, '#5fa8d8');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    // Cracks
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 26; i++) {
      g.lineWidth = 1 + Math.random() * 2;
      g.beginPath();
      let x = Math.random() * w, y = Math.random() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (Math.random() - 0.5) * 120;
        y += (Math.random() - 0.5) * 120;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // Sumo ring markings: start lines (shikiri-sen) and a circle.
    g.strokeStyle = 'rgba(30,60,110,0.55)';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(w / 2, h / 2, w * 0.2, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(30,60,110,0.55)';
    g.fillRect(w / 2 - 70, h / 2 - 60, 16, 120);
    g.fillRect(w / 2 + 54, h / 2 - 60, 16, 120);
  });
}

function wrestler(color) {
  const g = new THREE.Group();
  const body = new THREE.Group(); // squash/stretch + tilt
  g.add(body);
  const skin = new THREE.MeshStandardMaterial({ color: 0xffd6b0, roughness: 0.55 });
  const col = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1b24, roughness: 0.5 });
  const belly = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), skin);
  belly.scale.set(1, 0.92, 1);
  belly.position.y = BALL_R * 0.92;
  belly.castShadow = true;
  body.add(belly);
  // Mawashi (belt) in the player's colour.
  const belt = new THREE.Mesh(new THREE.TorusGeometry(BALL_R * 0.93, BALL_R * 0.17, 12, 40).rotateX(Math.PI / 2), col);
  belt.position.y = BALL_R * 0.55;
  belt.castShadow = true;
  body.add(belt);
  const knot = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.25), col);
  knot.position.set(0, BALL_R * 0.55, -BALL_R * 0.95);
  body.add(knot);
  // Head with a topknot.
  const head = new THREE.Mesh(new THREE.SphereGeometry(BALL_R * 0.45, 24, 18), skin);
  head.position.set(0, BALL_R * 1.95, 0.1);
  head.castShadow = true;
  body.add(head);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), dark);
  bun.scale.set(1, 0.7, 1.4);
  bun.position.set(0, BALL_R * 2.4, -0.05);
  body.add(bun);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(BALL_R * 0.46, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), dark);
  hair.position.copy(head.position);
  hair.rotation.x = -0.35;
  body.add(hair);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), dark);
    eye.position.set(s * 0.17, BALL_R * 2.0, 0.55);
    body.add(eye);
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), skin);
    arm.scale.set(0.8, 1.2, 0.8);
    arm.position.set(s * BALL_R * 0.98, BALL_R * 1.05, 0.15);
    arm.castShadow = true;
    body.add(arm);
    const leg = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), skin);
    leg.position.set(s * 0.5, 0.25, 0.05);
    body.add(leg);
  }
  // Charge ring on the ice.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(BALL_R * 1.05, BALL_R * 1.45, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false })
  );
  ring.position.y = 0.04;
  g.add(ring);
  return { group: g, body, ring };
}

export class SumoScene {
  constructor(canvas, colors) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.95;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = r;
    const scene = (this.scene = new THREE.Scene());
    scene.fog = new THREE.Fog(0xcfe2ff, 70, 260);
    this.envMap = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 1200);
    this.post = new Post(r);
    this.post.setTheme({ bloom: 0.35, bloomThreshold: 1.6 });
    this.fx = new FX(scene);
    this.sky = new Sky(scene);
    this.sky.setTheme({ top: 0x36508f, horizon: 0xffc9a8, bottom: 0x9cc4e8, sunDir: [-0.6, 0.18, -0.5], sunColor: 0xffb48a, sunSize: 2.2, clouds: 18, cloudColor: 0xffe6f0 }, new THREE.Vector3());
    this.colors = colors;
    this.high = true;
    this.shake = 0;
    this.orbit = 0;

    scene.add(new THREE.HemisphereLight(0xdfeaff, 0x30507a, 0.75));
    const sun = (this.sun = new THREE.DirectionalLight(0xffe0c8, 1.7));
    sun.position.set(-20, 30, -14);
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    // Ice ring: a thick floe with a glossy top.
    const ice = new THREE.MeshStandardMaterial({ map: iceTexture(), roughness: 0.3, metalness: 0.0, envMapIntensity: 0.5 });
    const side = new THREE.MeshStandardMaterial({ color: 0x9fd6f0, roughness: 0.2, transparent: true, opacity: 0.92 });
    this.ring = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0 * 0.94, 2.2, 72, 1), [side, ice, side]);
    this.ring.position.y = -1.1;
    this.ring.receiveShadow = true;
    scene.add(this.ring);
    // Straw-bale edge (tawara) that turns red as the ring shrinks.
    this.edge = new THREE.Mesh(
      new THREE.TorusGeometry(R0, 0.22, 10, 96).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xe8d39a, roughness: 0.8, emissive: 0xff3b1f, emissiveIntensity: 0 })
    );
    this.edge.position.y = 0.05;
    this.edge.castShadow = true;
    scene.add(this.edge);

    // Water
    this.water = new THREE.Mesh(
      new THREE.CircleGeometry(400, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1d5f8a, roughness: 0.12, metalness: 0.3 })
    );
    this.water.position.y = -1.6;
    this.water.receiveShadow = true;
    scene.add(this.water);
    // Icebergs and floes around.
    const berg = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.35, flatShading: true });
    this.floes = [];
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, d = 26 + Math.random() * 90;
      const big = d > 60;
      const geo = big ? new THREE.ConeGeometry(4 + Math.random() * 8, 8 + Math.random() * 16, 5 + Math.floor(Math.random() * 3)) : new THREE.CylinderGeometry(1 + Math.random() * 2.5, 1.5 + Math.random() * 2.5, 0.8, 7);
      const m = new THREE.Mesh(geo, berg);
      m.position.set(Math.cos(a) * d, big ? 0 : -1.4, Math.sin(a) * d);
      m.rotation.y = Math.random() * 6;
      m.castShadow = !big;
      m.userData.phase = Math.random() * 6;
      scene.add(m);
      if (!big) this.floes.push(m);
    }

    this.wrestlers = [];
  }

  setPlayers(n) {
    for (const w of this.wrestlers) this.scene.remove(w.group);
    this.wrestlers = [];
    for (let i = 0; i < n; i++) {
      const w = wrestler(this.colors[i]);
      this.scene.add(w.group);
      this.wrestlers.push(w);
    }
  }

  setQuality(high) {
    this.high = high;
    const r = this.renderer;
    const dpr = window.devicePixelRatio || 1;
    r.setPixelRatio(high ? Math.min(dpr, 1.5) : Math.min(dpr, 1) * 0.75);
    r.shadowMap.enabled = high;
    this.sun.castShadow = high;
    this.scene.environment = high ? this.envMap : null;
    this.fx.density = high ? 1 : 0.4;
    this.scene.traverse((o) => {
      if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true;
    });
    this.resize();
  }

  resize() {
    const W = window.innerWidth, H = window.innerHeight;
    this.W = W;
    this.H = H;
    this.renderer.setSize(W, H, false);
    this.post.setSize(W, H, this.renderer.getPixelRatio());
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
  }

  splash(x, z) {
    for (let i = 0; i < 40 * this.fx.density; i++) {
      this.fx.spawn(false, x, -1.4, z, { color: i % 3 ? 0xd8f2ff : 0xffffff, vy: 9, spread: 7, g: 18, drag: 0.6, life: 1.1, s0: 0.7, s1: 0.3, a: 0.9, floor: -1.6 });
    }
    this.shake = 0.35;
  }

  render(arena, dt, mode) {
    const t = performance.now() / 1000;
    const cam = this.camera;
    const aspect = this.W / this.H || 16 / 9;
    const fit = Math.max(1, 1.7 / aspect);
    const rad = arena ? arena.radius : R0;
    if (mode === 'lobby') {
      this.orbit += dt * 0.1;
      cam.position.set(Math.sin(this.orbit) * 34 * fit, 16, Math.cos(this.orbit) * 34 * fit);
      cam.lookAt(0, 0, 0);
    } else {
      // Ease in as the ring shrinks.
      const z = (0.55 + 0.45 * (rad / R0)) * fit;
      cam.position.set(0, 27 * z, 21 * z);
      cam.lookAt(0, -1, 2.6);
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
    }

    const s = rad / R0;
    this.ring.scale.set(s, 1, s);
    this.edge.scale.set(s, 1, s);
    this.edge.material.emissiveIntensity = (1 - s) * 1.6 * (0.6 + 0.4 * Math.sin(t * 6));
    for (const f of this.floes) f.position.y = -1.45 + Math.sin(t * 0.8 + f.userData.phase) * 0.12;

    if (arena) {
      arena.balls.forEach((b, i) => {
        const w = this.wrestlers[i];
        if (!w) return;
        w.group.visible = !b.out || b.y > -12;
        w.group.position.set(b.x, b.y, b.z);
        w.group.rotation.y = b.facing;
        // Squash while charging (with a shiver), stretch while dashing, wobble while sliding.
        const ch = b.charging ? b.charge / CHARGE_MAX : 0;
        const sp = Math.hypot(b.vx, b.vz);
        const sq = b.dash > 0 ? 0.85 : 1 - ch * 0.18;
        w.body.scale.set(1 / Math.sqrt(sq), sq, b.dash > 0 ? 1.25 : 1 / Math.sqrt(sq));
        w.body.rotation.x = b.falling ? Math.min(2.5, -b.vy * 0.15) : Math.min(0.35, sp * 0.02) + (b.dash > 0 ? 0.25 : 0);
        w.body.position.x = ch > 0 ? (Math.random() - 0.5) * ch * 0.12 : 0;
        w.body.rotation.z = Math.sin(t * 9 + i) * Math.min(0.08, sp * 0.006);
        // Always show a coloured ring under each wrestler: that's how you spot yourself.
        w.ring.material.opacity = b.falling ? 0 : 0.6 + ch * 0.4;
        w.ring.scale.setScalar(1 + ch * 0.5);
        if (b.dash > 0 && this.high) this.fx.trail(b.x, 0.8, b.z, this.colors[i]);
        if (!b.falling && sp > 6 && Math.random() < 0.3 * this.fx.density) this.fx.spawn(false, b.x, 0.1, b.z, { color: 0xffffff, vy: 0.8, spread: 1.2, drag: 1.5, life: 0.5, s0: 0.4, s1: 1, a: 0.5 });
      });
    }
    this.fx.ambient(dt, 0, 0, 'snow', -2);
    this.fx.update(dt);
    this.fx.setViewport(cam, this.H);
    this.sky.update(dt);
    this.sky.follow(cam);

    const r = this.renderer;
    if (this.high) {
      const tg = this.post.target;
      tg.viewport.set(0, 0, tg.width, tg.height);
      tg.scissor.copy(tg.viewport);
      tg.scissorTest = false;
      r.setRenderTarget(tg);
      r.render(this.scene, cam);
      this.post.finish();
      r.setScissorTest(false);
    } else {
      r.setRenderTarget(null);
      r.render(this.scene, cam);
    }
  }
}
