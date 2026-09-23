// What a statue hero does to the village while he is at home, so his ability can be
// seen as well as read: the paladin's pillar of holy light, the sorcerer's circling
// runes (his barrier dome lives in the renderer), the druid's brambles climbing the
// wall, the goblin chief's heaps of stolen gold, the necromancer's rising souls.
// Everything here is decoration: no picking, and it keeps clear of the buildings.

import * as THREE from 'three';
import { blob, box, cone, cyl, mesh } from './kit';
import { LAYOUT, WALL_R } from './scene';

export type AuraHero = 'paladin' | 'sorcerer' | 'druid' | 'goblin' | 'necromancer';

export interface Aura {
  group: THREE.Group;
  /** advance the animation */
  step(dt: number, t: number): void;
  /** give back geometries and materials */
  dispose(): void;
}

const GATE_A = Math.PI / 2;
const GATE_HALF = 0.12;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Tiny glowing specks that drift upward inside a column and start again at the bottom. */
function risingSparks(n: number, color: number, emissive: number, cx: number, cz: number, radius: number, top: number, r: () => number) {
  const g = new THREE.Group();
  const specks: { m: THREE.Mesh; x: number; z: number; y: number; v: number; ph: number }[] = [];
  for (let i = 0; i < n; i++) {
    const m = mesh(new THREE.OctahedronGeometry(0.12, 0), color, { emissive });
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius;
    const s = { m, x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, y: r() * top, v: 0.8 + r() * 1.4, ph: r() * 6 };
    specks.push(s);
    g.add(m);
  }
  return {
    group: g,
    step(dt: number, t: number) {
      for (const s of specks) {
        s.y += s.v * dt;
        if (s.y > top) s.y = 0.3;
        s.m.position.set(s.x + Math.sin(t + s.ph) * 0.4, s.y, s.z + Math.cos(t * 0.8 + s.ph) * 0.4);
        s.m.scale.setScalar(0.6 + 0.6 * Math.sin(Math.PI * (s.y / top)));
      }
    },
  };
}

function paladinAura(r: () => number): Aura {
  const g = new THREE.Group();
  const [sx, sz] = LAYOUT.statue;
  // a pillar of soft golden light rising from the statue, brightest at its foot
  const h = 24;
  const geo = new THREE.CylinderGeometry(1.5, 2.6, h, 32, 1, true);
  geo.translate(0, h / 2, 0);
  const pillarMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying float vY; void main() { vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; varying float vY;
      void main() { float f = 1.0 - clamp(vY / ${h.toFixed(1)}, 0.0, 1.0); float a = pow(f, 1.3) * (0.42 + 0.1 * sin(uTime * 2.0 + vY * 0.4));
      gl_FragColor = vec4(vec3(1.0, 0.82, 0.4) * a, a); }`,
  });
  const pillar = new THREE.Mesh(geo, pillarMat);
  pillar.position.set(sx, 0, sz);
  g.add(pillar);
  // a narrower, brighter core
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.0, h, 20, 1, true).translate(0, h / 2, 0), pillarMat);
  core.position.set(sx, 0, sz);
  g.add(core);
  // a halo turning slowly above the statue
  const halo = mesh(new THREE.TorusGeometry(2.3, 0.09, 6, 40), 0xffe08a, { emissive: 0xc08a1a });
  halo.rotation.x = Math.PI / 2;
  halo.position.set(sx, 8.5, sz);
  g.add(halo);
  const sparks = risingSparks(18, 0xfff0b0, 0xc08a1a, sx, sz, 2.2, 14, r);
  g.add(sparks.group);
  return {
    group: g,
    step(dt, t) {
      pillarMat.uniforms.uTime.value = t;
      halo.rotation.z = t * 0.4;
      halo.position.y = 8.5 + Math.sin(t * 0.9) * 0.25;
      sparks.step(dt, t);
    },
    dispose() { disposeAll(g); },
  };
}

function sorcererAura(r: () => number): Aura {
  const g = new THREE.Group();
  const [sx, sz] = LAYOUT.statue;
  const ring = new THREE.Group();
  ring.position.set(sx, 5.2, sz);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const rune = mesh(new THREE.BoxGeometry(0.34, 0.5, 0.06), 0xc9a6ff, { emissive: 0x6a3fd0 });
    rune.position.set(Math.cos(a) * 3.2, Math.sin(i * 1.7) * 0.3, Math.sin(a) * 3.2);
    rune.rotation.y = -a;
    ring.add(rune);
  }
  g.add(ring);
  const sparks = risingSparks(10, 0xd9c2ff, 0x7a4ad0, sx, sz, 3, 9, r);
  g.add(sparks.group);
  return {
    group: g,
    step(dt, t) {
      ring.rotation.y = t * 0.5;
      ring.position.y = 5.2 + Math.sin(t * 1.3) * 0.3;
      sparks.step(dt, t);
    },
    dispose() { disposeAll(g); },
  };
}

/** Brambles climbing the outside of the wall (or a thorn hedge where there is no wall yet). */
function druidAura(r: () => number, wallLevel: number): Aura {
  const g = new THREE.Group();
  const tier = wallLevel <= 0 ? 0 : wallLevel < 5 ? 1 : wallLevel < 10 ? 2 : wallLevel < 15 ? 3 : 4;
  const h = tier === 0 ? 1.4 : tier === 1 ? 2.6 : tier === 2 ? 3.6 : 5;
  const R = WALL_R + (tier >= 3 ? 1.25 : 0.6);
  const start = GATE_A + GATE_HALF + 0.03, end = GATE_A + Math.PI * 2 - GATE_HALF - 0.03;
  const blooms = [0xf4a6c8, 0xfff2f2, 0xe86a8a];
  for (let a = start; a < end; a += 0.055 + r() * 0.025) {
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    const clump = new THREE.Group();
    const stems = 2 + Math.floor(r() * 2);
    for (let i = 0; i < stems; i++) {
      const len = h * (0.6 + r() * 0.45);
      const stem = cyl(0.09, 0.15, len, 0x3a2a18, 5, (r() - 0.5) * 0.9, 0, (r() - 0.5) * 0.25);
      stem.rotation.z = (r() - 0.5) * 0.5;
      clump.add(stem);
      // leaves and thorns along the stem
      for (let k = 0; k < 5; k++) {
        const y = len * (0.12 + k * 0.19);
        clump.add(blob(0.34 + r() * 0.12, k % 2 ? 0x3f6a22 : 0x4f8a2a, stem.position.x + (r() - 0.5) * 0.5, y, stem.position.z + 0.1, 1.3, 0.8, 0.6));
        clump.add(cone(0.035, 0.16, 0x4a3420, 4, stem.position.x + 0.1, y + 0.1, stem.position.z + 0.08));
      }
      for (let k = 0; k < 2; k++) if (r() < 0.7) clump.add(blob(0.17, blooms[Math.floor(r() * blooms.length)], stem.position.x + (r() - 0.5) * 0.6, len * (0.35 + r() * 0.6), stem.position.z + 0.3));
    }
    clump.position.set(x, 0, z);
    clump.rotation.y = -a + Math.PI / 2;
    g.add(clump);
  }
  // fireflies over the village
  const flies = risingSparks(22, 0xf4ff9a, 0x9aff3a, 0, 0, WALL_R - 6, 6, r);
  g.add(flies.group);
  return { group: g, step(dt, t) { flies.step(dt * 0.4, t); }, dispose() { disposeAll(g); } };
}

/** Heaps of plundered gold and open chests about the plaza, glinting. */
function goblinAura(r: () => number): Aura {
  const g = new THREE.Group();
  const glints: THREE.Mesh[] = [];
  const heap = (x: number, z: number, s: number) => {
    const hp = new THREE.Group();
    hp.add(blob(0.9 * s, 0xe0b040, 0, 0.2 * s, 0, 1.3, 0.55, 1.1));
    hp.add(blob(0.55 * s, 0xf0c850, 0.3 * s, 0.55 * s, -0.1 * s, 1, 0.6, 1));
    for (let i = 0; i < 12; i++) {
      const c = cyl(0.14, 0.14, 0.05, 0xf2cc55, 8, (r() - 0.5) * 2.4 * s, 0, (r() - 0.5) * 2.4 * s);
      c.rotation.set(r() * 0.4, 0, r() * 0.4);
      hp.add(c);
    }
    const glint = mesh(new THREE.OctahedronGeometry(0.12, 0), 0xffffff, { emissive: 0xffe08a });
    glint.position.set(0.2 * s, 0.95 * s, 0.2 * s);
    glints.push(glint);
    hp.add(glint);
    hp.position.set(x, 0, z);
    g.add(hp);
  };
  const chest = (x: number, z: number, a: number) => {
    const c = new THREE.Group();
    c.add(box(1.1, 0.6, 0.7, 0x6e4a2a));
    c.add(box(1.14, 0.08, 0.74, 0xb07a3a, 0, 0.3, 0));
    c.add(blob(0.42, 0xf0c850, 0, 0.62, 0, 1.2, 0.45, 0.8));
    const lid = box(1.1, 0.12, 0.7, 0x6e4a2a, 0, 0, 0);
    lid.position.set(0, 0.6, -0.35);
    lid.rotation.x = -1.1;
    c.add(lid);
    c.position.set(x, 0, z);
    c.rotation.y = a;
    g.add(c);
  };
  const [sx, sz] = LAYOUT.statue;
  heap(sx - 4.8, sz - 3.4, 1.45);
  heap(sx + 5.0, sz - 3.8, 1.2);
  heap(sx + 4.4, sz + 7.0, 1.3);
  chest(sx - 4.2, sz + 5.8, 0.5);
  chest(sx + 6.2, sz + 1.8, -0.9);
  return {
    group: g,
    step(_dt, t) { glints.forEach((m, i) => m.scale.setScalar(Math.max(0.05, Math.sin(t * 2.2 + i * 1.9)) * 1.4)); },
    dispose() { disposeAll(g); },
  };
}

/** Green souls rising out of the ground, fading as they climb. */
function necromancerAura(r: () => number): Aura {
  const g = new THREE.Group();
  const souls: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; x: number; z: number; y: number; v: number; ph: number; top: number }[] = [];
  const spawn = (s: (typeof souls)[number]) => {
    const a = r() * Math.PI * 2, d = 6 + Math.sqrt(r()) * (WALL_R - 10);
    s.x = Math.cos(a) * d; s.z = Math.sin(a) * d; s.y = 0; s.v = 0.9 + r() * 0.9; s.top = 5 + r() * 4;
  };
  for (let i = 0; i < 22; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x8dffb4, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), mat);
    m.scale.set(1, 1.8, 1);
    // a brighter heart inside each soul
    const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat);
    m.add(heart);
    const s = { m, mat, x: 0, z: 0, y: 0, v: 1, ph: r() * 6, top: 6 };
    spawn(s);
    s.y = r() * s.top;
    souls.push(s);
    g.add(m);
  }
  return {
    group: g,
    step(dt, t) {
      for (const s of souls) {
        s.y += s.v * dt;
        if (s.y > s.top) spawn(s);
        const f = s.y / s.top;
        s.mat.opacity = Math.sin(Math.PI * f) * 0.9;
        s.m.position.set(s.x + Math.sin(t * 1.5 + s.ph) * 0.6 * f, 0.4 + s.y, s.z + Math.cos(t * 1.2 + s.ph) * 0.6 * f);
      }
    },
    dispose() { disposeAll(g); },
  };
}

function disposeAll(g: THREE.Object3D): void {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const m = o.material as THREE.Material;
      // shared kit materials are cached; only the aura's own shader and fading materials are freed
      if (m instanceof THREE.ShaderMaterial || (m instanceof THREE.MeshBasicMaterial && m.transparent)) m.dispose();
    }
  });
}

export function heroAura(hero: AuraHero, wallLevel: number): Aura {
  const r = rng(hero.length * 97 + wallLevel);
  switch (hero) {
    case 'paladin': return paladinAura(r);
    case 'sorcerer': return sorcererAura(r);
    case 'druid': return druidAura(r, wallLevel);
    case 'goblin': return goblinAura(r);
    case 'necromancer': return necromancerAura(r);
  }
}
