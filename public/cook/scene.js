import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Post } from '../tv/post.js';
import { FX } from '../tv/fx.js';
import { W, H, CRATE_OF } from './kitchen.js';
import { iconCanvas, sigOf } from './icons.js';

// A cosy diner kitchen seen from above. Grid cell (x, y) is world (x + 0.5, z = y + 0.5).

const TOP = 0.9; // counter height

function tex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return tex(c);
}

const iconTex = new Map();
function iconTexture(sig) {
  if (!iconTex.has(sig)) iconTex.set(sig, tex(iconCanvas(sig)));
  return iconTex.get(sig);
}

// Point a sprite at an icon (only touching the material when it changes).
function setIcon(sprite, sig) {
  if (sprite.userData.sig === sig) return;
  sprite.userData.sig = sig;
  sprite.material.map = iconTexture(sig);
  sprite.material.needsUpdate = true;
}

function chefModel(color) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const apron = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xffd0a8, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.35, 6, 16), apron);
  torso.position.y = 0.5;
  torso.castShadow = true;
  body.add(torso);
  const ap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.42, 20, 1, true, -1.2, 2.4), white);
  ap.position.y = 0.45;
  body.add(ap);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), skin);
  head.position.y = 1.0;
  head.castShadow = true;
  body.add(head);
  const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 20), white);
  hatBand.position.y = 1.18;
  body.add(hatBand);
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), white);
  puff.scale.y = 0.75;
  puff.position.y = 1.36;
  puff.castShadow = true;
  body.add(puff);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.03, 8, 24).rotateX(Math.PI / 2), apron);
  band.position.y = 1.12;
  body.add(band);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), dark);
    eye.position.set(s * 0.08, 1.02, 0.2);
    body.add(eye);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), skin);
    hand.position.set(s * 0.22, 0.62, 0.25);
    body.add(hand);
  }
  // Ring on the floor in the player's colour.
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
  ring.position.y = 0.02;
  g.add(ring);
  const held = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }));
  held.scale.setScalar(0.62);
  held.position.set(0, 0.85, 0.45);
  held.visible = false;
  g.add(held);
  return { group: g, body, held };
}

function bar() {
  const g = new THREE.Group();
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x111111, transparent: true, opacity: 0.8, depthTest: false }));
  bg.scale.set(0.8, 0.13, 1);
  const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x5ee36a, depthTest: false }));
  fill.center.set(0, 0.5);
  fill.position.x = -0.37;
  fill.scale.set(0.74, 0.08, 1);
  bg.renderOrder = 10;
  fill.renderOrder = 11;
  g.add(bg, fill);
  g.visible = false;
  return { group: g, fill };
}

export class CookScene {
  constructor(canvas, kitchen) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.9;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = r;
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x2b1d2e);
    this.envMap = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.3, 200);
    this.post = new Post(r);
    this.post.setTheme({ bloom: 0.25, bloomThreshold: 2.5 });
    this.fx = new FX(scene);
    this.high = true;
    this.orbit = 0;
    this.chopT = 0;

    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x5a3a2a, 0.8));
    const sun = (this.sun = new THREE.DirectionalLight(0xfff0d8, 1.4));
    sun.position.set(W / 2 - 6, 14, H / 2 + 4);
    sun.target.position.set(W / 2, 0, H / 2);
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
    sun.shadow.bias = -0.0005;
    scene.add(sun, sun.target);
    // Warm lamps over the kitchen.
    for (const x of [3.5, 10.5]) {
      const l = new THREE.PointLight(0xffc27a, 3, 9, 1.5);
      l.position.set(x, 3.2, H / 2);
      scene.add(l);
    }

    // Floor: diner checkerboard, plus a darker surround.
    const floorTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#f4ead8';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#3aa6a0';
      g.fillRect(0, 0, w / 2, h / 2);
      g.fillRect(w / 2, h / 2, w / 2, h / 2);
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(W / 2, H / 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.4 }));
    floor.position.set(W / 2, 0, H / 2);
    floor.receiveShadow = true;
    scene.add(floor);
    const out = new THREE.Mesh(new THREE.PlaneGeometry(80, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a2632, roughness: 0.9 }));
    out.position.set(W / 2, -0.02, H / 2);
    scene.add(out);
    // Back wall with a menu board.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 3.2, 0.3), new THREE.MeshStandardMaterial({ color: 0xe8d5b5, roughness: 0.8 }));
    wall.position.set(W / 2, 1.6, -0.3);
    wall.receiveShadow = true;
    scene.add(wall);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 1.1),
      new THREE.MeshBasicMaterial({
        map: canvasTex(512, 112, (g, w, h) => {
          g.fillStyle = '#c62828';
          g.fillRect(0, 0, w, h);
          g.fillStyle = '#fff';
          g.font = '900 italic 70px system-ui, sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('KITCHEN RUSH', w / 2, h / 2 + 4);
        }),
      })
    );
    sign.position.set(W / 2, 2.5, -0.14);
    scene.add(sign);

    this.buildStations(kitchen);
    this.chefs = [];
  }

  buildStations(k) {
    const scene = this.scene;
    const top = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.25, metalness: 0.6 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x8d5a3b, roughness: 0.7 });
    const body = new THREE.MeshStandardMaterial({ color: 0x5d7f8f, roughness: 0.6 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x2f3438, roughness: 0.35, metalness: 0.7 });
    this.stationObjs = [];
    for (const t of k.tiles.flat()) {
      if (!t) continue;
      const g = new THREE.Group();
      g.position.set(t.x + 0.5, 0, t.y + 0.5);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.98, TOP - 0.06, 0.98), t.kind === 'stove' ? steel : body);
      base.position.y = (TOP - 0.06) / 2;
      base.castShadow = base.receiveShadow = true;
      g.add(base);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 1), t.kind === 'crate' ? wood : top);
      slab.position.y = TOP - 0.03;
      slab.receiveShadow = true;
      g.add(slab);
      const extra = {};
      if (t.kind === 'crate') {
        const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: iconTexture(`${CRATE_OF[t.ch]}:raw`), transparent: true }));
        icon.position.y = TOP + 0.01;
        g.add(icon);
      } else if (t.kind === 'board') {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.6), new THREE.MeshStandardMaterial({ color: 0xe0b77a, roughness: 0.6 }));
        b.position.y = TOP + 0.025;
        g.add(b);
        const knife = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.07), new THREE.MeshStandardMaterial({ color: 0xdfe6ea, metalness: 0.8, roughness: 0.2 }));
        knife.position.set(0.25, TOP + 0.07, 0.25);
        knife.rotation.y = 0.6;
        g.add(knife);
        extra.knife = knife;
      } else if (t.kind === 'stove') {
        const burner = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x331a10 }));
        burner.position.y = TOP + 0.02;
        g.add(burner);
        const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.08, 24), steel);
        pan.position.y = TOP + 0.07;
        g.add(pan);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.06), steel);
        handle.position.set(0.5, TOP + 0.09, 0);
        g.add(handle);
        extra.burner = burner;
      } else if (t.kind === 'plates') {
        for (let n = 0; n < 4; n++) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.28, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
          p.position.y = TOP + 0.03 + n * 0.055;
          p.castShadow = true;
          g.add(p);
        }
      } else if (t.kind === 'window') {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.01, 0.12, 1.01), new THREE.MeshBasicMaterial({ color: 0xffc400 }));
        stripe.position.y = TOP - 0.2;
        g.add(stripe);
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffd54f, metalness: 0.9, roughness: 0.2 }));
        bell.position.set(0.25, TOP, -0.3);
        g.add(bell);
        const arrow = new THREE.Mesh(
          new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({
            transparent: true,
            map: canvasTex(128, 128, (c, w) => {
              c.fillStyle = '#ffc400';
              c.font = '900 34px system-ui, sans-serif';
              c.textAlign = 'center';
              c.fillText('SERVE', w / 2, 52);
              c.beginPath();
              c.moveTo(30, 70);
              c.lineTo(98, 70);
              c.lineTo(98, 62);
              c.lineTo(118, 82);
              c.lineTo(98, 102);
              c.lineTo(98, 94);
              c.lineTo(30, 94);
              c.fill();
            }),
          })
        );
        arrow.position.y = TOP + 0.01;
        g.add(arrow);
      } else if (t.kind === 'trash') {
        const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.2, 20), new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.5 }));
        bin.position.y = TOP + 0.05;
        g.add(bin);
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
        hole.position.y = TOP + 0.16;
        g.add(hole);
      }
      // Item sitting on the station + a progress bar above it.
      const item = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }));
      item.scale.setScalar(0.8);
      item.position.y = TOP + 0.42;
      item.visible = false;
      g.add(item);
      const pb = bar();
      pb.group.position.y = TOP + 0.95;
      g.add(pb.group);
      scene.add(g);
      this.stationObjs.push({ t, group: g, item, bar: pb, ...extra });
    }
  }

  setChefs(colors) {
    for (const c of this.chefs) this.scene.remove(c.group);
    this.chefs = colors.map((col) => {
      const m = chefModel(col);
      this.scene.add(m.group);
      return m;
    });
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
    const Wd = window.innerWidth, Ht = window.innerHeight;
    this.W = Wd;
    this.H = Ht;
    this.renderer.setSize(Wd, Ht, false);
    this.post.setSize(Wd, Ht, this.renderer.getPixelRatio());
    this.camera.aspect = Wd / Ht;
    this.camera.updateProjectionMatrix();
  }

  render(k, dt, mode) {
    const t = performance.now() / 1000;
    const cam = this.camera;
    const aspect = this.W / this.H || 16 / 9;
    const fit = Math.max(1, 1.75 / aspect);
    if (mode === 'lobby') {
      this.orbit += dt * 0.15;
      cam.position.set(W / 2 + Math.sin(this.orbit) * 9 * fit, 10, H / 2 + 9 * fit + Math.cos(this.orbit) * 2);
      cam.lookAt(W / 2, 0, H / 2);
    } else {
      cam.position.set(W / 2, 12.5 * fit, H / 2 + 8.2 * fit);
      cam.lookAt(W / 2, 0, H / 2 + 0.6);
    }

    // Stations: items, progress bars, burners, smoke.
    for (const s of this.stationObjs) {
      // Look the tile up in the current kitchen (a new one is made per shift).
      const tile = k ? k.tiles[s.t.y][s.t.x] : s.t;
      const it = tile.item;
      s.item.visible = !!it;
      if (it) setIcon(s.item, sigOf(it));
      let p = 0, color = 0x5ee36a, show = false;
      if (it?.type === 'food' && tile.kind === 'board' && it.state === 'raw' && it.progress > 0) ((p = it.progress), (show = true));
      if (tile.kind === 'stove' && it?.kind === 'meat') {
        if (it.state === 'chopped') ((p = it.progress), (show = true), (color = 0xffb300));
        else if (it.state === 'cooked' && it.progress > 0.35) {
          // About to burn: flashing red warning.
          p = it.progress;
          show = true;
          color = Math.sin(t * 14) > 0 ? 0xff3b30 : 0xffffff;
        }
        if (Math.random() < (it.state === 'burnt' ? 0.5 : 0.12) * this.fx.density) {
          this.fx.smoke(s.t.x + 0.5, TOP + 0.3, s.t.y + 0.5, 0, 0, it.state === 'burnt' ? 0x333333 : 0xeeeeee, it.state === 'burnt' ? 0.6 : 0.25);
        }
      }
      s.bar.group.visible = show;
      if (show) {
        s.bar.fill.scale.x = Math.max(0.001, 0.74 * p);
        s.bar.fill.material.color.setHex(color);
      }
      if (s.burner) s.burner.material.color.setHex(it?.kind === 'meat' && it.state !== 'burnt' ? (Math.sin(t * 20) > 0 ? 0xff6a00 : 0xff8f2a) : 0x331a10);
    }
    // Chefs
    this.chopT += dt;
    if (k) {
      k.chefs.forEach((c, i) => {
        const m = this.chefs[i];
        if (!m) return;
        m.group.position.set(c.x, 0, c.y);
        const want = Math.atan2(c.fx, c.fy);
        let d = want - m.group.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        m.group.rotation.y += d * Math.min(1, dt * 14);
        m.body.position.y = c.chopping ? Math.abs(Math.sin(t * 18)) * 0.06 : 0;
        m.body.rotation.x = c.chopping ? 0.15 + Math.sin(t * 18) * 0.1 : 0;
        m.held.visible = !!c.holding;
        if (c.holding) setIcon(m.held, sigOf(c.holding));
        if (c.chopping && Math.random() < 0.25 * this.fx.density) {
          const tx = c.x + c.fx * 0.8, tz = c.y + c.fy * 0.8;
          this.fx.spawn(false, tx, TOP + 0.15, tz, { color: 0x9ccc65, vy: 2, spread: 1.5, g: 9, drag: 1, life: 0.4, s0: 0.12, s1: 0.1, shape: 2, floor: TOP });
        }
      });
    }
    this.fx.update(dt);
    this.fx.setViewport(cam, this.H);

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
