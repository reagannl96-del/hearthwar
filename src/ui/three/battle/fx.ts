// Battle effects: dust, debris, sparks, embers, smoke and splashes (instanced
// particle pools), arrows and spears in flight, fireballs and magic bolts,
// bright flashes, and fires that take hold of a building and can be put out.
// Everything is pooled: a battle can throw a lot around, and none of it may
// allocate per frame.

import * as THREE from 'three';
import { GEO, ammoMesh, type Shot } from './models';

const UP = new THREE.Vector3(0, 1, 0);
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const tmpD = new THREE.Vector3();
const tmpC = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const FWD = new THREE.Vector3(0, 0, 1);

let glowTex: THREE.Texture | null = null;
/** A soft white radial glow; sprites tint it. */
export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

// ---------- particles ----------

export interface Emit {
  n: number;
  color: number;
  /** spread of the starting velocity, and its upward push */
  speed?: number;
  up?: number;
  /** a push in one direction (e.g. debris flying off the wall) */
  dir?: THREE.Vector3;
  dirSpeed?: number;
  gravity?: number;
  drag?: number;
  life?: number;
  size?: number;
  grow?: number;
  /** jitter of the start position */
  spread?: number;
  /** fly out evenly in every direction (a firework's burst) */
  sphere?: boolean;
}

/** A pool of instanced particles: each flies, falls, shrinks (or grows) and is gone. */
class Pool {
  readonly mesh: THREE.InstancedMesh;
  private p: Float32Array;
  private v: Float32Array;
  private a: Float32Array; // age, life, size0, size1, gravity, drag, spin
  private alive: Uint8Array;
  private next = 0;

  constructor(geo: THREE.BufferGeometry, material: THREE.Material, private cap: number) {
    this.mesh = new THREE.InstancedMesh(geo, material, cap);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.userData.sharedGeometry = true;
    this.p = new Float32Array(cap * 3);
    this.v = new Float32Array(cap * 3);
    this.a = new Float32Array(cap * 7);
    this.alive = new Uint8Array(cap);
    for (let i = 0; i < cap; i++) {
      this.mesh.setMatrixAt(i, ZERO);
      this.mesh.setColorAt(i, tmpC.set(0xffffff));
    }
  }

  emit(at: THREE.Vector3, o: Emit): void {
    const speed = o.speed ?? 2, up = o.up ?? 2, spread = o.spread ?? 0.3;
    for (let k = 0; k < o.n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.cap;
      this.alive[i] = 1;
      const ang = Math.random() * Math.PI * 2, r = Math.random();
      this.p[i * 3] = at.x + (Math.random() - 0.5) * spread * 2;
      this.p[i * 3 + 1] = at.y + (Math.random() - 0.5) * spread;
      this.p[i * 3 + 2] = at.z + (Math.random() - 0.5) * spread * 2;
      let vx = Math.cos(ang) * speed * r, vy = up * (0.5 + Math.random() * 0.8), vz = Math.sin(ang) * speed * r;
      if (o.sphere) {
        const cy = Math.random() * 2 - 1, cr = Math.sqrt(1 - cy * cy), sp = speed * (0.85 + Math.random() * 0.15);
        vx = Math.cos(ang) * cr * sp; vy = cy * sp; vz = Math.sin(ang) * cr * sp;
      }
      if (o.dir) {
        const ds = (o.dirSpeed ?? 4) * (0.6 + Math.random() * 0.6);
        vx += o.dir.x * ds; vy += o.dir.y * ds; vz += o.dir.z * ds;
      }
      this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
      const life = (o.life ?? 1) * (0.7 + Math.random() * 0.6);
      const size = (o.size ?? 0.5) * (0.7 + Math.random() * 0.6);
      this.a.set([0, life, size, size * (o.grow ?? 0.2), o.gravity ?? 9, o.drag ?? 0.6, (Math.random() - 0.5) * 8], i * 7);
      this.mesh.setColorAt(i, tmpC.set(o.color));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  step(dt: number): void {
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      if (!this.alive[i]) continue;
      any = true;
      const o = i * 7;
      const age = (this.a[o] += dt);
      const life = this.a[o + 1];
      if (age >= life) {
        this.alive[i] = 0;
        this.mesh.setMatrixAt(i, ZERO);
        continue;
      }
      const drag = Math.max(0, 1 - this.a[o + 5] * dt);
      this.v[i * 3] *= drag; this.v[i * 3 + 2] *= drag;
      this.v[i * 3 + 1] = this.v[i * 3 + 1] * drag - this.a[o + 4] * dt;
      this.p[i * 3] += this.v[i * 3] * dt;
      this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      // debris settles on the ground rather than sinking through it
      if (this.p[i * 3 + 1] < 0.1 && this.a[o + 4] > 0) { this.p[i * 3 + 1] = 0.1; this.v[i * 3] *= 0.5; this.v[i * 3 + 2] *= 0.5; this.v[i * 3 + 1] = 0; }
      const k = age / life;
      const size = this.a[o + 2] + (this.a[o + 3] - this.a[o + 2]) * k;
      tmpV.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]);
      tmpQ.setFromAxisAngle(UP, this.a[o + 6] * age);
      tmpS.setScalar(Math.max(0.001, size));
      tmpM.compose(tmpV, tmpQ, tmpS);
      this.mesh.setMatrixAt(i, tmpM);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.alive.fill(0);
    for (let i = 0; i < this.cap; i++) this.mesh.setMatrixAt(i, ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- projectiles ----------

interface Flight {
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  arc: number;
  /** arrows and spears stick where they land for a while */
  stuck: number;
  landed: boolean;
  onLand?: () => void;
}

/** Arrows or spears: thin shafts on an arc, pointing the way they fly. */
class Shafts {
  readonly mesh: THREE.InstancedMesh;
  private list: (Flight | null)[];
  private next = 0;

  constructor(geo: THREE.BufferGeometry, color: number, private cap: number) {
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color }), cap);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.userData.sharedGeometry = true;
    this.list = new Array(cap).fill(null);
    for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, ZERO);
  }

  fire(from: THREE.Vector3, to: THREE.Vector3, dur: number, arc: number, onLand?: () => void): void {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    this.list[i] = { from: from.clone(), to: to.clone(), t: 0, dur, arc, stuck: 3, landed: false, onLand };
  }

  step(dt: number): void {
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      const f = this.list[i];
      if (!f) continue;
      any = true;
      f.t += dt;
      let k = f.t / f.dur;
      if (k >= 1) {
        if (!f.landed) { f.landed = true; f.onLand?.(); }
        if (f.t > f.dur + f.stuck) {
          this.list[i] = null;
          this.mesh.setMatrixAt(i, ZERO);
          continue;
        }
        k = 1;
      }
      tmpV.lerpVectors(f.from, f.to, k);
      tmpV.y += f.arc * 4 * k * (1 - k);
      tmpD.subVectors(f.to, f.from);
      tmpD.y += f.arc * 4 * (1 - 2 * k);
      if (f.landed) tmpV.addScaledVector(tmpD.normalize(), 0.35); // buried a little way in
      tmpQ.setFromUnitVectors(FWD, tmpD.normalize());
      tmpS.setScalar(1);
      tmpM.compose(tmpV, tmpQ, tmpS);
      this.mesh.setMatrixAt(i, tmpM);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.list.fill(null);
    for (let i = 0; i < this.cap; i++) this.mesh.setMatrixAt(i, ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

interface Ball extends Flight {
  obj: THREE.Object3D;
  glow: THREE.Sprite;
  trail: number;
  color: number;
  spin: number;
}

// ---------- fire ----------

export interface Fire {
  /** 0..1: how fierce it burns */
  level: number;
  /** how fast it dies down by itself (per second) */
  fade: number;
  pos: THREE.Vector3;
  radius: number;
  flames: THREE.Mesh[];
  glow: THREE.Sprite;
  light: THREE.PointLight | null;
  smoke: number;
  core: number;
  smokeT: number;
}

export class Fx {
  readonly group = new THREE.Group();
  private solid: Pool;
  /** soft, see-through puffs: dust, smoke and steam */
  private haze: Pool;
  private glowPool: Pool;
  private arrows: Shafts;
  private spears: Shafts;
  private balls: Ball[] = [];
  private flashes: { s: THREE.Sprite; age: number; life: number; size: number }[] = [];
  private flashPool: THREE.Sprite[] = [];
  readonly fires: Fire[] = [];
  private flameMats = new Map<number, THREE.MeshBasicMaterial>();
  private flameGeo = new THREE.ConeGeometry(0.5, 1.6, 6).translate(0, 0.8, 0);
  /** two lights for the fires, made once and kept (adding lights mid-battle recompiles every shader) */
  private lightPool: THREE.PointLight[] = [];
  night = false;

  constructor() {
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(0xff9a3a, 0, 26, 1.6);
      l.userData.free = true;
      this.lightPool.push(l);
      this.group.add(l);
    }
    this.solid = new Pool(GEO.chunk, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), 260);
    this.haze = new Pool(GEO.puff, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.42, depthWrite: false }), 420);
    this.haze.mesh.renderOrder = 5;
    this.glowPool = new Pool(GEO.spark, new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }), 640);
    this.arrows = new Shafts(GEO.arrow, 0x6e4a2a, 90);
    this.spears = new Shafts(GEO.spear, 0x7a5230, 30);
    this.group.add(this.solid.mesh, this.haze.mesh, this.glowPool.mesh, this.arrows.mesh, this.spears.mesh);
  }

  // ----- particles -----

  dust(at: THREE.Vector3, n = 8, color = 0xcdbf9f): void {
    this.haze.emit(at, { n, color, speed: 2.2, up: 0.9, gravity: -0.4, drag: 2, life: 1.5, size: 0.55, grow: 2.2, spread: 0.8 });
  }
  debris(at: THREE.Vector3, n: number, color: number, dir?: THREE.Vector3): void {
    this.solid.emit(at, { n, color, speed: 3, up: 5, dir, dirSpeed: 5, gravity: 14, drag: 0.3, life: 2.6, size: 0.45, grow: 0.8, spread: 0.6 });
  }
  sparks(at: THREE.Vector3, n = 6, color = 0xffd27a): void {
    this.glowPool.emit(at, { n, color, speed: 5, up: 3, gravity: 9, drag: 1, life: 0.35, size: 0.35, grow: 0.1, spread: 0.1 });
  }
  embers(at: THREE.Vector3, n: number, color = 0xff8a2a, spread = 0.5): void {
    this.glowPool.emit(at, { n, color, speed: 0.8, up: 2.4, gravity: -1.4, drag: 0.9, life: 1.6, size: 0.3, grow: 0.1, spread });
  }
  /** A firework bursting: a great ball of coloured stars that drift down and wink out, with a white heart. */
  firework(at: THREE.Vector3, color: number): void {
    this.glowPool.emit(at, { n: 64, color, speed: 10, sphere: true, gravity: 2.4, drag: 1.4, life: 1.6, size: 0.6, grow: 0.05, spread: 0.2 });
    this.glowPool.emit(at, { n: 18, color: 0xffffff, speed: 5, sphere: true, gravity: 1.6, drag: 1.8, life: 0.9, size: 0.45, grow: 0.05, spread: 0.2 });
    this.flash(at, 24, color, 0.6);
  }

  magic(at: THREE.Vector3, n: number, color: number): void {
    this.glowPool.emit(at, { n, color, speed: 2.2, up: 2, gravity: -0.8, drag: 2, life: 1.1, size: 0.45, grow: 0.1, spread: 0.6 });
  }
  /** Gold showering down (the Djinn's tribute): motes that tumble from overhead and wink out. */
  gold(at: THREE.Vector3, n: number): void {
    this.glowPool.emit(at, { n, color: 0xffd35a, speed: 1.6, up: 0.8, gravity: 3.0, drag: 1.1, life: 2.3, size: 0.46, grow: 0.05, spread: 2.0 });
    this.glowPool.emit(at, { n: Math.ceil(n / 2), color: 0xfff4c0, speed: 1.2, up: 0.4, gravity: 2.6, drag: 1.2, life: 1.6, size: 0.3, grow: 0.05, spread: 1.6 });
  }
  smoke(at: THREE.Vector3, color = 0x7a726a, n = 1, size = 0.7): void {
    this.haze.emit(at, { n, color, speed: 0.35, up: 1.4, gravity: -1, drag: 0.5, life: 3, size, grow: 2.6, spread: 0.5 });
  }
  splash(at: THREE.Vector3, n = 10): void {
    this.glowPool.emit(at, { n, color: 0x9fd4ff, speed: 3.5, up: 3, gravity: 12, drag: 0.4, life: 0.8, size: 0.28, grow: 0.3, spread: 0.3 });
    this.haze.emit(at, { n: 2, color: 0xe8f2f8, speed: 1, up: 1, gravity: -0.4, drag: 1.5, life: 1.2, size: 0.45, grow: 2, spread: 0.4 });
  }

  // ----- flashes -----

  flash(at: THREE.Vector3, size: number, color: number, life = 0.45): void {
    const s = this.flashPool.pop() ?? new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    (s.material as THREE.SpriteMaterial).color.set(color);
    s.position.copy(at);
    s.visible = true;
    this.group.add(s);
    this.flashes.push({ s, age: 0, life, size });
  }

  /** A big hit: flash, debris, sparks and a puff of smoke. */
  explode(at: THREE.Vector3, color: number, debrisColor: number, big = 1): void {
    this.flash(at, 9 * big, color, 0.5);
    this.debris(at, Math.round(10 * big), debrisColor);
    this.embers(at, Math.round(14 * big), color, 1.2);
    this.sparks(at, Math.round(10 * big), color);
    this.smoke(at, 0x6a625a, Math.round(4 * big), 0.9);
  }

  // ----- projectiles -----

  arrow(from: THREE.Vector3, to: THREE.Vector3, dur: number, onLand?: () => void): void {
    const d = from.distanceTo(to);
    this.arrows.fire(from, to, dur, Math.min(9, 1.5 + d * 0.22), onLand);
  }
  spear(from: THREE.Vector3, to: THREE.Vector3, dur: number, onLand?: () => void): void {
    const d = from.distanceTo(to);
    this.spears.fire(from, to, dur, Math.min(6, 1 + d * 0.2), onLand);
  }

  /** A glowing bolt (a sorcerer's lightning, a necromancer's green fire), nearly straight. */
  bolt(from: THREE.Vector3, to: THREE.Vector3, dur: number, color: number, onLand?: () => void, glowSize?: number): void {
    const obj = new THREE.Group();
    this.launch(obj, from, to, dur, 0.8, color, 0, onLand, glowSize);
  }

  /** A catapult's load, lobbed high, trailing fire or magic. */
  lob(from: THREE.Vector3, to: THREE.Vector3, dur: number, shot: Shot, color: number, onLand?: () => void): void {
    const obj = ammoMesh(shot);
    this.launch(obj, from, to, dur, Math.max(8, from.distanceTo(to) * 0.45), color, 6, onLand);
  }

  private launch(obj: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, dur: number, arc: number, color: number, spin: number, onLand?: () => void, glowSize?: number): void {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.setScalar(glowSize ?? (spin ? 3.2 : 2.2));
    obj.add(glow);
    obj.position.copy(from);
    this.group.add(obj);
    this.balls.push({ obj, glow, from: from.clone(), to: to.clone(), t: 0, dur, arc, stuck: 0, landed: false, onLand, trail: 0, color, spin });
  }

  // ----- fire -----

  private flameMat(color: number): THREE.MeshBasicMaterial {
    let m = this.flameMats.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      this.flameMats.set(color, m);
    }
    return m;
  }

  /** Set something ablaze (or feed a fire already burning there). */
  ignite(at: THREE.Vector3, radius: number, colors: { flame: number; core: number; smoke: number }, level = 0.7): Fire {
    const near = this.fires.find((f) => f.pos.distanceTo(at) < radius);
    if (near) { near.level = Math.min(1, near.level + level * 0.6); return near; }
    const flames: THREE.Mesh[] = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.flameGeo, this.flameMat(i % 3 === 0 ? colors.core : colors.flame));
      m.userData.sharedGeometry = true;
      const a = (i / n) * Math.PI * 2, r = radius * (0.25 + (i % 2) * 0.35);
      m.position.set(at.x + Math.cos(a) * r, at.y, at.z + Math.sin(a) * r);
      m.userData.ph = Math.random() * 10;
      this.group.add(m);
      flames.push(m);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: colors.flame, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.position.copy(at).add(tmpV.set(0, 1.2, 0));
    this.group.add(glow);
    const light = this.lightPool.find((l) => l.userData.free) ?? null;
    if (light) {
      light.userData.free = false;
      light.color.set(colors.flame);
      light.position.copy(at).add(tmpV.set(0, 2, 0));
    }
    const f: Fire = { level, fade: 0.018, pos: at.clone(), radius, flames, glow, light, smoke: colors.smoke, core: colors.core, smokeT: 0 };
    this.fires.push(f);
    return f;
  }

  /** The thing burning has come down: the fire goes with it. */
  moveFire(f: Fire, at: THREE.Vector3): void {
    const d = tmpD.copy(at).sub(f.pos);
    if (d.lengthSq() < 0.0001) return;
    for (const m of f.flames) m.position.add(d);
    f.glow.position.add(d);
    f.light?.position.add(d);
    f.pos.copy(at);
  }

  /** A bucket of water on a fire. */
  douse(f: Fire, k: number): void {
    f.level = Math.max(0, f.level - k);
    this.smoke(f.pos, 0xe8e8e0, 3, 1.1); // steam
  }

  // ----- frame -----

  step(dt: number, t: number): void {
    this.solid.step(dt);
    this.haze.step(dt);
    this.glowPool.step(dt);
    this.arrows.step(dt);
    this.spears.step(dt);
    // balls in flight
    this.balls = this.balls.filter((b) => {
      b.t += dt;
      const k = Math.min(1, b.t / b.dur);
      b.obj.position.lerpVectors(b.from, b.to, k);
      b.obj.position.y += b.arc * 4 * k * (1 - k);
      if (b.spin) b.obj.rotation.set(b.t * b.spin, b.t * b.spin * 0.7, 0);
      b.glow.scale.setScalar((b.spin ? 3.2 : 2.2) * (0.85 + Math.sin(t * 30) * 0.15));
      b.trail += dt;
      while (b.trail > 0.03) {
        b.trail -= 0.03;
        this.glowPool.emit(b.obj.position, { n: 1, color: b.color, speed: 0.3, up: 0.2, gravity: -0.5, drag: 2, life: b.spin ? 0.7 : 0.35, size: b.spin ? 0.5 : 0.3, grow: 0.05, spread: 0.15 });
        if (b.spin && Math.random() < 0.3) this.smoke(b.obj.position, 0x8a827a, 1, 0.35);
      }
      if (k >= 1) {
        b.onLand?.();
        this.group.remove(b.obj);
        (b.glow.material as THREE.Material).dispose();
        b.obj.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
        return false;
      }
      return true;
    });
    // flashes
    this.flashes = this.flashes.filter((f) => {
      f.age += dt;
      const k = f.age / f.life;
      if (k >= 1) {
        f.s.visible = false;
        this.group.remove(f.s);
        this.flashPool.push(f.s);
        return false;
      }
      f.s.scale.setScalar(f.size * (0.4 + k * 0.9));
      (f.s.material as THREE.SpriteMaterial).opacity = 1 - k;
      return true;
    });
    // fires
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.level = Math.max(0, f.level - f.fade * dt);
      const L = f.level;
      f.flames.forEach((m, j) => {
        const ph = m.userData.ph as number;
        const flick = 0.75 + Math.sin(t * 13 + ph) * 0.15 + Math.sin(t * 5.3 + ph * 2) * 0.1;
        const s = L * (j % 2 ? 1.25 : 0.9) * f.radius * 0.55;
        m.scale.set(s, s * flick * 1.6, s);
        m.visible = L > 0.03;
      });
      f.glow.scale.setScalar(Math.max(0.01, f.radius * 3.4 * L * (0.9 + Math.sin(t * 9) * 0.1)));
      (f.glow.material as THREE.SpriteMaterial).opacity = Math.min(1, L * 1.4);
      if (f.light) f.light.intensity = L * (30 + Math.sin(t * 11) * 8) * (this.night ? 2.5 : 1);
      f.smokeT += dt * (0.6 + L * 3);
      while (f.smokeT > 1) {
        f.smokeT -= 1;
        if (L > 0.02) {
          tmpV.copy(f.pos).add(tmpD.set((Math.random() - 0.5) * f.radius, 1 + L * 2, (Math.random() - 0.5) * f.radius));
          this.smoke(tmpV, L < 0.15 ? 0xa8a49e : f.smoke, 1, 0.5 + f.radius * 0.14);
          if (Math.random() < L) this.embers(tmpV, 1, f.flames[0] ? ((f.flames[1]?.material as THREE.MeshBasicMaterial)?.color.getHex() ?? 0xff8a2a) : 0xff8a2a, f.radius * 0.5);
        }
      }
      if (L <= 0) {
        for (const m of f.flames) this.group.remove(m);
        this.group.remove(f.glow);
        (f.glow.material as THREE.Material).dispose();
        if (f.light) { f.light.intensity = 0; f.light.userData.free = true; }
        this.fires.splice(i, 1);
      }
    }
  }

  get busy(): boolean {
    return this.balls.length > 0 || this.fires.length > 0 || this.flashes.length > 0;
  }

  clear(): void {
    this.solid.clear();
    this.haze.clear();
    this.glowPool.clear();
    this.arrows.clear();
    this.spears.clear();
    for (const b of this.balls) {
      this.group.remove(b.obj);
      (b.glow.material as THREE.Material).dispose();
      b.obj.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    }
    this.balls = [];
    for (const f of this.fires) f.level = 0;
    this.step(0, 0);
  }

  dispose(): void {
    this.clear();
    for (const l of this.lightPool) l.dispose();
    this.flameGeo.dispose();
    for (const m of this.flameMats.values()) m.dispose();
    for (const s of this.flashPool) (s.material as THREE.Material).dispose();
    (this.solid.mesh.material as THREE.Material).dispose();
    (this.haze.mesh.material as THREE.Material).dispose();
    this.haze.mesh.dispose();
    (this.glowPool.mesh.material as THREE.Material).dispose();
    (this.arrows.mesh.material as THREE.Material).dispose();
    (this.spears.mesh.material as THREE.Material).dispose();
    this.solid.mesh.dispose();
    this.glowPool.mesh.dispose();
    this.arrows.mesh.dispose();
    this.spears.mesh.dispose();
  }
}
