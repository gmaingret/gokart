import * as THREE from 'three';

// Gradient sky dome with a sun glow, drifting cloud sprites and (at night) stars.
// The dome follows whichever camera is rendering, so it never clips.

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // always at the far plane
}`;

const SKY_FRAG = `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunSize;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(uHorizon, uBottom, clamp(-h * 4.0, 0.0, 1.0));
  float s = max(0.0, dot(d, normalize(uSunDir)));
  col += uSunColor * (pow(s, 900.0 / uSunSize) * 4.0 + pow(s, 12.0) * 0.28);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const blob = (x, y, r, a) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(255,255,255,${a})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };
  for (let i = 0; i < 14; i++) blob(50 + Math.random() * 156, 60 + Math.random() * 25, 25 + Math.random() * 35, 0.55);
  for (let i = 0; i < 8; i++) blob(70 + Math.random() * 116, 50 + Math.random() * 20, 18 + Math.random() * 20, 0.7);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Sky {
  constructor(scene) {
    this.group = new THREE.Group();
    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.3) },
      uSunColor: { value: new THREE.Color(1, 0.95, 0.8) },
      uSunSize: { value: 1 },
    };
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(1000, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: this.uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      })
    );
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    this.cloudTex = cloudTexture();
    this.clouds = new THREE.Group();
    this.group.add(this.clouds);

    // Stars (only visible at night).
    const starPos = [];
    for (let i = 0; i < 900; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.random() * 0.9 + 0.08;
      const r = 900;
      starPos.push(Math.cos(u) * Math.cos(v * 1.4) * r, Math.sin(v * 1.4) * r, Math.sin(u) * Math.cos(v * 1.4) * r);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 }));
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
    scene.add(this.group);
  }

  setTheme(sky, center) {
    const u = this.uniforms;
    u.uTop.value.set(sky.top);
    u.uHorizon.value.set(sky.horizon);
    u.uBottom.value.set(sky.bottom ?? sky.horizon);
    u.uSunColor.value.set(sky.sunColor ?? 0xfff2cc);
    u.uSunDir.value.set(...(sky.sunDir ?? [0.5, 0.45, 0.3])).normalize();
    u.uSunSize.value = sky.sunSize ?? 1;
    this.stars.visible = !!sky.stars;

    for (const c of [...this.clouds.children]) {
      this.clouds.remove(c);
      c.material.dispose();
    }
    const n = sky.clouds ?? 0;
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({ map: this.cloudTex, color: sky.cloudColor ?? 0xffffff, transparent: true, opacity: 0.85, fog: false, depthWrite: false });
      const s = new THREE.Sprite(m);
      const a = Math.random() * Math.PI * 2, r = 380 + Math.random() * 380;
      s.position.set(center.x + Math.cos(a) * r, 90 + Math.random() * 110, center.z + Math.sin(a) * r);
      const w = 120 + Math.random() * 160;
      s.scale.set(w, w * 0.45, 1);
      s.userData.speed = 2 + Math.random() * 3;
      this.clouds.add(s);
    }
    this.center = center;
  }

  update(dt) {
    for (const c of this.clouds.children) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > this.center.x + 800) c.position.x -= 1600;
    }
  }

  // Keep the dome and stars centred on the camera that's about to render.
  follow(cam) {
    this.dome.position.copy(cam.position);
    this.stars.position.copy(cam.position);
  }
}
