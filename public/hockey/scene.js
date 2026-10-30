import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Post } from '../tv/post.js';
import { FX } from '../tv/fx.js';
import { HX, HZ, GOAL, CORNER, PUCK_R, MALLET_R } from './table.js';

export const COLORS = [0x29e0ff, 0xff3d9a]; // left, right
const RAIL_H = 0.45, RAIL_W = 0.55;

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

// Playing surface: deep blue ice with air holes and the markings.
function surfaceTexture() {
  const W = 2048, H = Math.round((W * HZ) / HX);
  return canvasTex(W, H, (g) => {
    const sx = W / (2 * HX), sz = H / (2 * HZ);
    const X = (x) => (x + HX) * sx, Z = (z) => (z + HZ) * sz;
    const grd = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
    grd.addColorStop(0, '#1b2a7a');
    grd.addColorStop(1, '#0a1038');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    // Air holes.
    g.fillStyle = 'rgba(0,0,0,0.45)';
    for (let x = -HX + 0.5; x < HX; x += 0.5) for (let z = -HZ + 0.5; z < HZ; z += 0.5) {
      g.beginPath();
      g.arc(X(x), Z(z), 2.2, 0, Math.PI * 2);
      g.fill();
    }
    const line = (color, width, path) => {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.beginPath();
      path();
      g.stroke();
    };
    // Centre line and circle.
    line('rgba(255,255,255,0.85)', 10, () => {
      g.moveTo(X(0), Z(-HZ));
      g.lineTo(X(0), Z(HZ));
    });
    line('rgba(255,255,255,0.7)', 8, () => g.arc(X(0), Z(0), 2.6 * sx, 0, Math.PI * 2));
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath();
    g.arc(X(0), Z(0), 0.25 * sx, 0, Math.PI * 2);
    g.fill();
    // Goal creases and zone lines in each player's colour.
    ['#29e0ff', '#ff3d9a'].forEach((c, i) => {
      const s = i ? 1 : -1;
      line(c, 10, () => g.arc(X(s * HX), Z(0), 3.4 * sx, s < 0 ? -Math.PI / 2 : Math.PI / 2, s < 0 ? Math.PI / 2 : (Math.PI * 3) / 2));
      line(c, 6, () => {
        g.moveTo(X(s * (HX - 7)), Z(-HZ));
        g.lineTo(X(s * (HX - 7)), Z(HZ));
      });
      g.globalAlpha = 0.12;
      g.fillStyle = c;
      g.beginPath();
      g.arc(X(s * HX), Z(0), 3.4 * sx, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    });
    // Logo in the centre circle.
    g.save();
    g.translate(X(0), Z(0));
    g.font = `900 italic ${Math.round(0.9 * sx)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillText('AIR HOCKEY', 0, 0);
    g.restore();
  });
}

function floorTexture() {
  const t = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#05060f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(125,77,255,0.5)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, w, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 24);
  return t;
}

function glowTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}

function malletModel(color) {
  const g = new THREE.Group();
  const pts = [
    [0, 0], [MALLET_R, 0], [MALLET_R, 0.22], [MALLET_R * 0.92, 0.3], [0.62, 0.42], [0.42, 0.55],
    [0.32, 0.62], [0.3, 1.0], [0.38, 1.12], [0.4, 1.22], [0.34, 1.32], [0.18, 1.38], [0, 1.4],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 40),
    new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), roughness: 0.25, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.15 })
  );
  body.castShadow = true;
  g.add(body);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(MALLET_R * 0.98, 0.06, 8, 48).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4) })
  );
  ring.position.y = 0.06;
  g.add(ring);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.62, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
  cap.position.y = 0.425;
  cap.scale.setScalar(0.98);
  g.add(cap);
  return g;
}

function puckModel() {
  const g = new THREE.Group();
  const side = new THREE.MeshStandardMaterial({ color: 0xffd84d, emissive: 0xffc21a, emissiveIntensity: 1.1, roughness: 0.4 });
  const top = new THREE.MeshStandardMaterial({ color: 0x15151f, roughness: 0.35, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(PUCK_R, PUCK_R, 0.18, 40), [side, top, top]);
  body.position.y = 0.09;
  body.castShadow = true;
  g.add(body);
  const inner = new THREE.Mesh(new THREE.RingGeometry(PUCK_R * 0.45, PUCK_R * 0.6, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd84d }));
  inner.position.y = 0.185;
  g.add(inner);
  return g;
}

export class HockeyScene {
  constructor(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = r;
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x05060f);
    scene.fog = new THREE.Fog(0x05060f, 40, 110);
    this.envMap = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 300);
    this.post = new Post(r);
    this.post.setTheme({ bloom: 0.55, bloomThreshold: 1.15 });
    this.fx = new FX(scene);
    this.high = true;
    this.shake = 0;
    this.orbit = 0;
    this.goalFlash = [0, 0];

    scene.add(new THREE.HemisphereLight(0x8090ff, 0x100818, 0.6));
    const spot = (this.spot = new THREE.SpotLight(0xffffff, 380, 60, 0.75, 0.6, 1.6));
    spot.position.set(0, 22, 3);
    spot.target.position.set(0, 0, 0);
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.bias = -0.0004;
    scene.add(spot, spot.target);
    this.endLights = COLORS.map((c, i) => {
      const l = new THREE.PointLight(c, 60, 22, 1.6);
      l.position.set((i ? 1 : -1) * (HX + 2), 3, 0);
      scene.add(l);
      return l;
    });
    this.puckLight = new THREE.PointLight(0xffc860, 14, 7, 1.8);
    scene.add(this.puckLight);

    this.buildTable();
    this.mallets = COLORS.map((c) => {
      const m = malletModel(c);
      scene.add(m);
      return m;
    });
    this.puck = puckModel();
    scene.add(this.puck);
    // Puck trail: a few additive glows following its recent path.
    const glow = glowTexture();
    this.trail = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffb030, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.scale.setScalar(1.4 * (1 - i / 16));
      scene.add(s);
      this.trail.push(s);
    }
    this.history = [];
  }

  buildTable() {
    const scene = this.scene;
    // Surface
    const surf = new THREE.Mesh(
      new THREE.PlaneGeometry(2 * HX, 2 * HZ).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: surfaceTexture(), roughness: 0.18, metalness: 0.15 })
    );
    surf.receiveShadow = true;
    scene.add(surf);
    // Body and legs
    const dark = new THREE.MeshStandardMaterial({ color: 0x161a3a, roughness: 0.35, metalness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2 * HX + 2 * RAIL_W + 0.6, 1.4, 2 * HZ + 2 * RAIL_W + 0.6), dark);
    body.position.y = -0.71;
    body.receiveShadow = true;
    scene.add(body);
    const skirt = new THREE.Mesh(
      new THREE.BoxGeometry(2 * HX + 2 * RAIL_W + 0.7, 0.12, 2 * HZ + 2 * RAIL_W + 0.7),
      new THREE.MeshBasicMaterial({ color: 0x7d4dff })
    );
    skirt.position.y = -1.3;
    scene.add(skirt);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 6, 16), dark);
      leg.position.set(sx * (HX - 1), -4.4, sz * (HZ - 1));
      scene.add(leg);
    }
    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: floorTexture(), color: 0xffffff, roughness: 0.25, metalness: 0.4, emissive: 0x2a1060, emissiveMap: floorTexture(), emissiveIntensity: 0.6 })
    );
    floor.position.y = -7.4;
    floor.receiveShadow = true;
    scene.add(floor);

    // Rails: dark bodies with a neon strip on top, in each player's colour.
    const railMat = new THREE.MeshStandardMaterial({ color: 0x232850, roughness: 0.3, metalness: 0.5 });
    const strip = COLORS.map((c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.8) }));
    const add = (w, d, x, z, side) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, RAIL_H, d), railMat);
      m.position.set(x, RAIL_H / 2, z);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      const s = new THREE.Mesh(new THREE.BoxGeometry(w > d ? w : 0.22, 0.06, w > d ? 0.22 : d), strip[side]);
      s.position.set(x, RAIL_H + 0.03, z);
      scene.add(s);
    };
    // Side rails, split at the centre line so each half shows its owner's colour.
    for (const sz of [-1, 1]) {
      for (const side of [0, 1]) {
        const sx = side ? 1 : -1;
        add(HX + RAIL_W, RAIL_W, (sx * (HX + RAIL_W)) / 2, sz * (HZ + RAIL_W / 2), side);
      }
    }
    // End rails with the goal mouths.
    for (const side of [0, 1]) {
      const sx = side ? 1 : -1;
      const len = HZ - GOAL + RAIL_W;
      for (const sz of [-1, 1]) add(RAIL_W, len, sx * (HX + RAIL_W / 2), sz * (GOAL + len / 2), side);
      // Goal pocket glowing in the defender's colour.
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2 * GOAL), new THREE.MeshStandardMaterial({ color: 0x05060f, roughness: 1 }));
      pocket.position.set(sx * (HX + 0.7), -0.2, 0);
      scene.add(pocket);
      const mouth = new THREE.Mesh(new THREE.PlaneGeometry(2 * GOAL, 0.7), new THREE.MeshBasicMaterial({ color: COLORS[side], transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      mouth.rotation.y = Math.PI / 2;
      mouth.position.set(sx * (HX + 1.35), 0.2, 0);
      scene.add(mouth);
      this.goalFlash[side] = 0;
      (this.mouths ||= [])[side] = mouth;
    }
    // Rounded corner fillers matching the physics.
    const outer = new THREE.Shape();
    outer.moveTo(CORNER, 0);
    outer.lineTo(CORNER, CORNER);
    outer.lineTo(0, CORNER);
    outer.absarc(0, 0, CORNER, Math.PI / 2, 0, true);
    const cornerGeo = new THREE.ExtrudeGeometry(outer, { depth: RAIL_H, bevelEnabled: false }).rotateX(-Math.PI / 2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const m = new THREE.Mesh(cornerGeo, railMat);
      m.position.set(sx * (HX - CORNER), 0, sz * (HZ - CORNER));
      m.scale.set(sx, 1, -sz);
      m.castShadow = true;
      scene.add(m);
    }
  }

  setQuality(high) {
    this.high = high;
    const r = this.renderer;
    const dpr = window.devicePixelRatio || 1;
    r.setPixelRatio(high ? Math.min(dpr, 1.5) : Math.min(dpr, 1) * 0.75);
    r.shadowMap.enabled = high;
    this.spot.castShadow = high;
    this.scene.environment = high ? this.envMap : null;
    this.puckLight.visible = high;
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

  flashGoal(side) {
    this.goalFlash[side] = 1;
    this.shake = 0.6;
  }

  // Sync models with the simulation and draw a frame.
  render(table, dt, mode) {
    const t = performance.now() / 1000;
    const cam = this.camera;
    // Camera: fixed broadcast view in a match, slow orbit in the lobby.
    const aspect = this.W / this.H || 16 / 9;
    const fit = Math.max(1, 1.75 / aspect); // pull back on narrow screens
    if (mode === 'lobby') {
      this.orbit += dt * 0.12;
      const a = Math.sin(this.orbit) * 0.5;
      cam.position.set(Math.sin(a) * 26 * fit, 13, Math.cos(a) * 22 * fit);
      cam.lookAt(0, -1, 0);
    } else {
      cam.position.set(0, 19 * fit, 13.5 * fit);
      cam.lookAt(0, -0.6, 0.9);
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.6;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
    }

    table.mallets.forEach((m, i) => this.mallets[i].position.set(m.x, 0, m.z));
    const p = table.puck;
    const sunk = Math.abs(p.x) > HX;
    this.puck.position.set(p.x, sunk ? -0.25 : 0, p.z);
    this.puck.rotation.y += Math.hypot(p.vx, p.vz) * dt * 0.3;
    this.puckLight.position.set(p.x, 1.2, p.z);
    // Trail
    this.history.unshift([p.x, p.z]);
    this.history.length = Math.min(this.history.length, this.trail.length * 2);
    const speed = Math.hypot(p.vx, p.vz);
    this.trail.forEach((s, i) => {
      const h = this.history[i * 2] || this.history[this.history.length - 1];
      s.position.set(h[0], 0.12, h[1]);
      s.material.opacity = Math.min(1, speed / 25) * (1 - i / this.trail.length) * 0.8;
      s.visible = !sunk;
    });
    // Goal mouths pulse, and flash after a goal.
    this.mouths.forEach((m, i) => {
      this.goalFlash[i] = Math.max(0, this.goalFlash[i] - dt * 0.8);
      const f = this.goalFlash[i];
      m.material.color.setHex(COLORS[i]).multiplyScalar(1 + f * 4 + Math.sin(t * 3) * 0.15);
      this.endLights[i].intensity = 60 + f * 400;
    });
    if (this.high) this.fx.ambient(dt, 0, 0, 'motes', -2);
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
