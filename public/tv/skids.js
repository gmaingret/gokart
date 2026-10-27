import * as THREE from 'three';

// Tyre marks left on the road while drifting or braking hard. A fixed pool of
// instanced quads; each mark shrinks away over a few seconds.
const POOL = 900;
const LIFE = 7;

export class Skids {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(0.32, 1.1).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, POOL);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
    this.marks = [];
    this.next = 0;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.s = new THREE.Vector3();
    this.p = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
  }

  add(x, z, heading, time, y = 0) {
    const mark = { x, y, z, heading, born: time };
    if (this.marks.length < POOL) this.marks.push(mark);
    else {
      this.marks[this.next] = mark;
      this.next = (this.next + 1) % POOL;
    }
  }

  update(time) {
    let n = 0;
    for (const mk of this.marks) {
      const age = time - mk.born;
      if (age > LIFE || age < 0) continue;
      const k = 1 - age / LIFE;
      this.q.setFromAxisAngle(this.up, mk.heading);
      this.m.compose(this.p.set(mk.x, mk.y + 0.065, mk.z), this.q, this.s.set(k, 1, 1));
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.marks.length = 0;
    this.next = 0;
    this.mesh.count = 0;
  }
}
