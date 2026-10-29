import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Post-processing for the whole split-screen frame: every viewport is drawn
// into one HDR render target, then bloom + colour grading run once over it.

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 1.12 },
    uContrast: { value: 1.06 },
    uVignette: { value: 0.28 },
    uViews: { value: new THREE.Vector4(1, 1, 0, 0) }, // cols, rows
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uSaturation, uContrast, uVignette;
    uniform vec4 uViews;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSaturation);
      c.rgb = (c.rgb - 0.18) * uContrast + 0.18;
      // Vignette per split-screen cell.
      vec2 cell = fract(vUv * uViews.xy) - 0.5;
      float v = 1.0 - uVignette * smoothstep(0.25, 0.75, length(cell * vec2(1.0, 0.9)));
      c.rgb *= v;
      gl_FragColor = vec4(max(c.rgb, 0.0), c.a);
    }`,
};

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.4, 2.2);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.enabled = true;
  }

  setSize(w, h, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    // Bloom at half resolution is plenty and much cheaper.
    this.bloom.resolution.set((w * pixelRatio) / 2, (h * pixelRatio) / 2);
  }

  setTheme(theme) {
    // Daylight scenes are bright everywhere, so only real light sources
    // (sun, sparks, flames, lamps) should cross the threshold.
    this.bloom.strength = theme.bloom ?? 0.3;
    this.bloom.threshold = theme.bloomThreshold ?? 2.2;
  }

  // The target the scene should be rendered into this frame.
  get target() {
    return this.composer.readBuffer;
  }

  setViews(cols, rows) {
    this.grade.uniforms.uViews.value.set(cols, rows, 0, 0);
  }

  // Run the passes over the whole frame. The views left the target (and the
  // renderer) clipped to the last viewport, so reset both to full size first.
  finish() {
    const r = this.renderer;
    const t = this.target;
    t.viewport.set(0, 0, t.width, t.height);
    t.scissor.set(0, 0, t.width, t.height);
    t.scissorTest = false;
    r.setRenderTarget(null);
    const size = r.getSize(new THREE.Vector2());
    r.setViewport(0, 0, size.x, size.y);
    r.setScissorTest(false);
    this.composer.render();
    r.setScissorTest(true);
  }
}
