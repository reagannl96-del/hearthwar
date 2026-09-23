// The village grounds: terrain, roads, stream, scenery and the wall ring.

import * as THREE from 'three';
import type { BuildingId } from '../../engine/types';
import { C, bake, box, cone, cyl, darker, getSeason, getTheme, mat, rng, roundTower, seasonal } from './kit';
import { rock, tree, pumpkin, hayBale, barrel, crate, crystalSpire, greatTree, skullTotem } from './props';
import { blob, mesh } from './kit';
import { distToPaths } from './paths';

export const WALL_R = 44;
export const GATE_A = Math.PI / 2; // gate faces +Z (towards the viewer)
const GATE_HALF = 0.12;

/**
 * Where each building stands (x, z, rotation y). Worked out so that no two
 * buildings touch at any size, everything clears the wall, and the plaza, main
 * street and ring road stay open; tests/scene.test.ts keeps it that way.
 */
export const LAYOUT: Record<BuildingId, [number, number, number]> = {
  main: [1.9, -13.4, 0],
  statue: [0, 3.8, 0],
  rally: [-8.1, 7.9, -1.2708],
  market: [14.9, 6.5, -1.77],
  barracks: [-22, -13.1, 0],
  stable: [-24.6, 8.8, -0.2],
  workshop: [-14.5, 28, 2.07],
  smithy: [-6, -31.1, 3.39],
  academy: [20.3, -14.6, -1.5708],
  warehouse: [11.7, 20.2, -2.07],
  hiding: [6.4, 33.8, 0],
  watchtower: [29.9, 5.7, -1.5708],
  wall: [0, 0, 0],
  timber: [-63, 4, 0.2],
  claypit: [-48, 50, 0.4],
  ironmine: [-43, -58, 0.5],
  farm: [50, -50, -0.3],
};

/** Buildings that stand outside the wall, on the rolling land. */
export const OUTSIDE: BuildingId[] = ['timber', 'claypit', 'ironmine', 'farm'];
/** Models are built at a small unit size and scaled up where they stand. */
export const buildingScale = (id: BuildingId) => (OUTSIDE.includes(id) ? 1.25 : 1.3);

/** The ring road just inside the wall. */
export const RING_R = WALL_R - 4;

// x1, z1, x2, z2, width
const ROADS: [number, number, number, number, number][] = [
  [0, 10, 0, 100, 5], // main street out through the gate
  [0, 4, 0, -4, 4.5],
  // lanes from the plaza to the buildings around it
  ...(['rally', 'market', 'barracks', 'stable', 'workshop', 'academy', 'warehouse', 'watchtower', 'hiding'] as BuildingId[]).map(
    (id) => [0, 4, LAYOUT[id][0], LAYOUT[id][1], 2.4] as [number, number, number, number, number],
  ),
  // tracks out to the timber camp, clay pit, iron mine and farm
  ...(['timber', 'claypit', 'ironmine', 'farm'] as BuildingId[]).map((id) => {
    const [x, z] = LAYOUT[id];
    const d = Math.hypot(x, z);
    return [(x / d) * (WALL_R + 2), (z / d) * (WALL_R + 2), x, z, 3] as [number, number, number, number, number];
  }),
];

function distToSeg(px: number, pz: number, x1: number, z1: number, x2: number, z2: number): number {
  const dx = x2 - x1, dz = z2 - z1;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / l2));
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

function noise(x: number, z: number, s: number): number {
  const fx = x / s, fz = z / s;
  return (Math.sin(fx * 1.7 + Math.cos(fz * 1.3)) + Math.sin(fz * 1.9 + Math.cos(fx * 0.7) * 2)) * 0.25 + 0.5;
}

const streamX = (z: number) => 76 + Math.sin(z / 18) * 7 + Math.sin(z / 7) * 1.5;

function onRoad(x: number, z: number): boolean {
  if (Math.abs(Math.hypot(x, z) - RING_R) < 1.4) return true;
  for (const [x1, z1, x2, z2, w] of ROADS) if (w > 0 && distToSeg(x, z, x1, z1, x2, z2) < w / 2) return true;
  return false;
}

export function heightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  let h = 0;
  if (r > WALL_R + 6) {
    const f = Math.min(1, (r - WALL_R - 6) / 25);
    h += (noise(x, z, 14) - 0.5) * 5 * f + Math.max(0, r - 110) * 0.08;
  }
  // hills behind the mine
  const md = Math.hypot(x + 48, z + 70);
  if (md < 32) h += (1 - md / 32) ** 2 * 16;
  const md2 = Math.hypot(x + 78, z + 44);
  if (md2 < 26) h += (1 - md2 / 26) ** 2 * 11;
  const md3 = Math.hypot(x + 14, z + 80);
  if (md3 < 22) h += (1 - md3 / 22) ** 2 * 9;
  // a level plateau under the outer workplaces, big enough for their largest size, easing into the hills
  for (const [id, flat, ease] of [['timber', 17, 8], ['claypit', 16, 8], ['farm', 24, 10], ['ironmine', 16, 7]] as [BuildingId, number, number][]) {
    const [bx, bz] = LAYOUT[id];
    const d = Math.hypot(x - bx, z - bz);
    if (d < flat) h = 0;
    else if (d < flat + ease) h *= (d - flat) / ease;
  }
  const sd = Math.abs(x - streamX(z));
  if (sd < 5) h = Math.min(h, -0.6 + sd * 0.12);
  if (onRoad(x, z)) h *= 0.4;
  return h;
}

export function buildTerrain(seed = 7): THREE.Mesh {
  const size = 320, seg = 84;
  let geo: THREE.BufferGeometry = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const r0 = rng(seed);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const jitter = Math.hypot(x, z) > WALL_R + 4 ? (r0() - 0.5) * 0.35 : 0;
    pos.setY(i, heightAt(x, z) + jitter);
  }
  geo = geo.toNonIndexed();
  const p = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(p.count * 3);
  const col = new THREE.Color();
  const r = rng(seed + 1);
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const rr = Math.hypot(cx, cz);
    let c: number;
    const sd = Math.abs(cx - streamX(cz));
    if (sd < 3.2) c = C.water;
    else if (sd < 4.2) c = C.dirtDark;
    else if (onRoad(cx, cz)) c = r() < 0.5 ? C.dirt : darker(C.dirt, 0.94);
    else if (Math.hypot(cx - 0, cz - 8) < 10) c = r() < 0.6 ? C.dirt : darker(C.dirt, 0.95);
    else if (Math.hypot(cx - LAYOUT.claypit[0], cz - LAYOUT.claypit[1]) < 8) c = r() < 0.5 ? C.clay : C.clayDark;
    else if (cy > 5) c = r() < 0.55 ? C.rock : C.rockDark;
    else if (cy > 3) c = r() < 0.5 ? C.grassRust : C.rockDark;
    else if (rr < WALL_R - 1) {
      const n = noise(cx, cz, 11);
      c = getSeason() === 'winter'
        ? (n > 0.66 ? 0xf2f6f8 : n < 0.36 ? 0xdbe3e9 : 0xe8eef2)
        : (n > 0.66 ? 0x97a24e : n < 0.36 ? 0x7f8d43 : 0x8b984a);
    } else {
      const n = noise(cx + 40, cz - 13, 22);
      c = n > 0.74 ? C.grassRust : n > 0.56 ? C.grassLight : n < 0.3 ? C.grassDark : C.grass;
    }
    // goblin camps sit in a swamp: dark pools and mud flats between the tussocks
    if (getTheme() === 'goblin' && !onRoad(cx, cz) && getSeason() !== 'winter') {
      const bog = noise(cx * 1.7 + 11, cz * 1.7 - 5, 9);
      if (rr > WALL_R + 5 && bog > 0.74) c = C.water;
      else if (bog > 0.7) c = C.dirtDark;
    }
    // the volcanic west: glowing cracks of lava run through the ash outside the walls
    if (getSeason() === 'volcanic' && !onRoad(cx, cz) && rr > WALL_R + 4) {
      // thin, winding cracks where the noise crosses its middle; darker basalt beside them
      const crack = Math.abs(noise(cx * 0.9 + 31, cz * 0.9 - 17, 9) - 0.5);
      if (crack < 0.018) c = C.water;
      else if (crack < 0.05) c = C.rockDark;
    }
    if (getSeason() === 'fall' && !onRoad(cx, cz) && sd >= 4.2 && cy <= 3) {
      const patch = noise(cx * 1.4 - 7, cz * 1.4 + 3, 8);
      if (getTheme() === 'sorcerer' && patch > 0.72) c = rr > WALL_R ? 0x8a7aa8 : 0x7f86a8; // lavender heather
      else if (getTheme() === 'druid' && patch > 0.7) c = 0x3f6d2a; // deep moss
      else if (getTheme() === 'druid' && patch < 0.24) c = 0x86a84a; // sunlit clover
    }
    col.set(getTheme() !== 'classic' && (c === 0x8a7aa8 || c === 0x7f86a8 || c === 0x3f6d2a || c === 0x86a84a) ? c : seasonal(c));
    const v = 0.97 + r() * 0.05;
    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = col.r * v;
      colors[(i + k) * 3 + 1] = col.g * v;
      colors[(i + k) * 3 + 2] = col.b * v;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  m.receiveShadow = true;
  return m;
}

function freeForTree(x: number, z: number): boolean {
  const r = Math.hypot(x, z);
  if (r < WALL_R + 5) return false;
  if (onRoad(x, z)) return false;
  if (distToPaths(x, z) < 3) return false;
  if (Math.abs(x - streamX(z)) < 6) return false;
  for (const id of ['timber', 'claypit', 'ironmine', 'farm'] as BuildingId[]) {
    const [bx, bz] = LAYOUT[id];
    const rad = id === 'farm' ? 27 : id === 'ironmine' ? 19 : id === 'timber' ? 16 : 15;
    if (Math.hypot(x - bx, z - bz) < rad) return false;
  }
  return true;
}

export interface SceneryItem {
  kind: 'oak' | 'pine' | 'birch' | 'rock' | 'pumpkin' | 'hay' | 'barrel' | 'crate';
  x: number;
  z: number;
  /** how much room it takes (radius) */
  r: number;
  scale: number;
}

/** Where every tree, rock and prop goes. Deterministic, so tests can check it. */
export function sceneryPlan(seed = 11): SceneryItem[] {
  const out: SceneryItem[] = [];
  const r = rng(seed);
  let placed = 0;
  for (let tries = 0; placed < 230 && tries < 6000; tries++) {
    const a = r() * Math.PI * 2;
    const d = WALL_R + 6 + Math.pow(r(), 0.7) * 110;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(x) > 155 || Math.abs(z) > 155) continue;
    if (!freeForTree(x, z)) continue;
    // forest thickens to the west (behind the timber camp); fields stay open to the north-east
    if (x > 20 && r() < 0.35) continue;
    if (x > 20 && z < -20 && Math.hypot(x - 48, z + 46) < 34) continue;
    const kind = r() < (getSeason() === 'winter' ? 0.6 : 0.28) ? 'pine' : r() < 0.18 ? 'birch' : 'oak';
    const scale = 1.1 + (d > 100 ? 0.3 : 0);
    out.push({ kind, x, z, r: (kind === 'pine' ? 1.3 : 1.7) * scale, scale });
    placed++;
  }
  for (let i = 0; i < 40; i++) {
    const x = (r() - 0.5) * 280, z = (r() - 0.5) * 280;
    if (!freeForTree(x, z)) continue;
    const scale = 1 + r();
    out.push({ kind: 'rock', x, z, r: 1.1 * scale, scale });
  }
  // a few trees and bits of life inside the walls
  for (const [x, z, k] of [[-34, 2, 'oak'], [-24, -24, 'birch'], [28, -18, 'oak'], [32, 14, 'oak'], [10, -31, 'birch'], [-5, 31, 'oak']] as const) {
    out.push({ kind: k, x, z, r: 1.5, scale: 0.9 });
  }
  out.push(
    { kind: 'pumpkin', x: -4, z: 18, r: 0.5, scale: 1 }, { kind: 'pumpkin', x: -4.8, z: 18.8, r: 0.4, scale: 0.8 }, { kind: 'pumpkin', x: -3.6, z: 19.6, r: 0.55, scale: 1.1 },
    { kind: 'hay', x: -30, z: -2, r: 1, scale: 0.5 }, { kind: 'barrel', x: 4, z: -26, r: 0.5, scale: 1 }, { kind: 'crate', x: 5.2, z: -26.8, r: 0.5, scale: 1 }, { kind: 'crate', x: 24, z: 10, r: 0.5, scale: 1 },
  );
  return out;
}

export function buildScenery(seed = 11): THREE.Group {
  const g = new THREE.Group();
  const r = rng(seed + 1000);
  for (const it of sceneryPlan(seed)) {
    const inside = Math.hypot(it.x, it.z) < WALL_R;
    const y = inside ? 0 : heightAt(it.x, it.z);
    const theme = getTheme();
    if (inside && theme !== 'classic' && (it.kind === 'oak' || it.kind === 'birch')) {
      const lm = theme === 'sorcerer' ? crystalSpire() : theme === 'druid' ? greatTree(r) : skullTotem();
      if (theme === 'goblin') lm.scale.setScalar(1.5);
      lm.position.set(it.x, 0, it.z);
      lm.rotation.y = r() * Math.PI * 2;
      g.add(lm);
    } else if (it.kind === 'oak' || it.kind === 'pine' || it.kind === 'birch') {
      const t = tree(it.kind, r, it.scale);
      t.position.set(it.x, inside ? 0 : y - 0.1, it.z);
      g.add(t);
    } else if (it.kind === 'rock') {
      const rk = rock(r, it.scale);
      rk.position.set(it.x, y, it.z);
      g.add(rk);
    } else if (it.kind === 'pumpkin') g.add(pumpkin(it.x, it.z, it.scale));
    else if (it.kind === 'hay') g.add(hayBale(it.x, it.z, it.scale));
    else if (it.kind === 'barrel') g.add(barrel(it.x, it.z));
    else g.add(crate(it.x, it.z));
  }
  if (getTheme() === 'goblin') addSwamp(g, r);
  if (getTheme() === 'sorcerer') addArcane(g, r);
  if (getTheme() === 'druid') addGlade(g, r);
  if (getSeason() === 'volcanic') addVolcanic(g, r);
  return bake(g);
}

/** The volcanic west: basalt columns, black boulders, smoking vents and drifting embers. */
function addVolcanic(g: THREE.Group, r: () => number): void {
  const basalt = (x: number, z: number) => {
    const c = new THREE.Group();
    const n = 3 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const h = 1.2 + r() * 3.2;
      const col = cyl(0.42, 0.46, h, i % 2 ? 0x2e2624 : 0x3a302d, 6, (r() - 0.5) * 1.6, 0, (r() - 0.5) * 1.6);
      c.add(col);
    }
    c.position.set(x, heightAt(x, z) - 0.1, z);
    c.rotation.y = r() * Math.PI;
    g.add(c);
  };
  const vent = (x: number, z: number) => {
    const y = heightAt(x, z);
    g.add(cone(1.1, 0.8, 0x2b2422, 7, x, y - 0.1, z));
    const glow = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 8), 0xff8a2a, { emissive: 0xd0500a });
    glow.position.set(x, y + 0.72, z);
    g.add(glow);
    // a column of smoke, left unbaked so the renderer can drift it
    const smoke = new THREE.MeshBasicMaterial({ color: 0x4a4240, transparent: true, opacity: 0.32, depthWrite: false });
    for (let i = 0; i < 4; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + i * 0.35, 0), smoke);
      puff.position.set(x + i * 0.3, y + 1.4 + i * 1.3, z);
      puff.userData.dynamic = true;
      puff.userData.mote = { x: x + i * 0.3, y: y + 1.4 + i * 1.3, z, phase: r() * Math.PI * 2, speed: 0.25 + r() * 0.2 };
      g.add(puff);
    }
  };
  let placed = 0;
  for (let tries = 0; tries < 900 && placed < 30; tries++) {
    const a = r() * Math.PI * 2, d = WALL_R + 7 + r() * 75;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!freeForTree(x, z)) continue;
    if (placed % 5 === 0) vent(x, z);
    else if (placed % 2 === 0) basalt(x, z);
    else g.add(Object.assign(blob(0.9 + r() * 0.9, 0x2e2624, x, heightAt(x, z) + 0.2, z, 1.3, 0.7, 1.1), {}));
    placed++;
  }
  motes(g, r, 36, 0xffa040, 0xd0500a, () => {
    const a = r() * Math.PI * 2, d = 8 + r() * 80;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    return [x, (Math.hypot(x, z) > WALL_R ? heightAt(x, z) : 0) + 1 + r() * 5, z];
  });
}

/** Floating motes of light (arcane sparks, fireflies): animated by the renderer. */
function motes(g: THREE.Group, r: () => number, n: number, color: number, emissive: number, around: (i: number) => [number, number, number]) {
  for (let i = 0; i < n; i++) {
    const [x, y, z] = around(i);
    const m = mesh(new THREE.OctahedronGeometry(0.16, 0), color, { emissive });
    m.position.set(x, y, z);
    m.userData.dynamic = true;
    m.userData.mote = { x, y, z, phase: r() * Math.PI * 2, speed: 0.6 + r() * 0.8 };
    g.add(m);
  }
}

/** The sorcerers' twilight meadow: crystal outcrops, rune stones, rune circles and drifting sparks. */
function addArcane(g: THREE.Group, r: () => number): void {
  const crystal = (x: number, z: number, s: number) => {
    const c = new THREE.Group();
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const h = (0.8 + r() * 1.6) * s;
      const sh = mesh(new THREE.OctahedronGeometry(0.3 * s, 0), r() < 0.5 ? 0xb58cff : 0x8fb8ff, { emissive: r() < 0.5 ? 0x4a2a9a : 0x2a4a9a });
      sh.scale.set(1, h / (0.3 * s) / 2, 1);
      sh.position.set((r() - 0.5) * 0.9 * s, h / 2, (r() - 0.5) * 0.9 * s);
      sh.rotation.z = (r() - 0.5) * 0.6;
      c.add(sh);
    }
    c.add(blob(0.5 * s, 0x6d6a82, 0, 0.1, 0, 1.3, 0.4, 1.1));
    c.position.set(x, heightAt(x, z), z);
    g.add(c);
  };
  const runeStone = (x: number, z: number) => {
    const st = new THREE.Group();
    const h = 2 + r() * 1.2;
    st.add(box(0.7, h, 0.45, 0x8f8ca8));
    const rune = mesh(new THREE.BoxGeometry(0.28, 0.5, 0.04), 0xb58cff, { emissive: 0x6a3fd0 });
    rune.position.set(0, h * 0.55, 0.24);
    st.add(rune);
    st.position.set(x, heightAt(x, z), z);
    st.rotation.y = r() * Math.PI * 2;
    g.add(st);
  };
  let placed = 0;
  for (let tries = 0; tries < 900 && placed < 26; tries++) {
    const a = r() * Math.PI * 2, d = WALL_R + 7 + r() * 75;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!freeForTree(x, z)) continue;
    if (placed % 3 === 0) runeStone(x, z);
    else crystal(x, z, 0.8 + r() * 0.8);
    placed++;
  }
  // glowing rune circles around the spires inside the walls
  for (const [x, z] of [[-34, 2], [-24, -24], [28, -18], [32, 14], [10, -31], [-5, 31]]) {
    const ring = mesh(new THREE.TorusGeometry(2.1, 0.07, 4, 28), 0xb58cff, { emissive: 0x5a2fb0 });
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.06, z);
    g.add(ring);
  }
  motes(g, r, 40, 0xd9c2ff, 0x7a4ad0, () => {
    const a = r() * Math.PI * 2, d = 8 + r() * 80;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    return [x, (Math.hypot(x, z) > WALL_R ? heightAt(x, z) : 0) + 1.5 + r() * 4, z];
  });
}

/** The druids' glade: great oaks, mossy boulders, ferns, mushroom rings, wildflowers and fireflies. */
function addGlade(g: THREE.Group, r: () => number): void {
  const flowers = (x: number, z: number, y: number) => {
    const cols = [0xf2e46a, 0xf4f1e6, 0xb58cd8, 0xe88aa6];
    for (let i = 0; i < 6; i++) g.add(blob(0.13, cols[Math.floor(r() * cols.length)], x + (r() - 0.5) * 2.4, y + 0.12, z + (r() - 0.5) * 2.4));
  };
  const fern = (x: number, z: number, y: number) => {
    const f = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const leaf = box(0.28, 0.05, 1.1, 0x4f8a32, 0, 0.25, 0.45);
      const arm = new THREE.Group();
      arm.add(leaf);
      arm.rotation.y = (i / 5) * Math.PI * 2;
      arm.rotation.x = -0.35;
      f.add(arm);
    }
    f.position.set(x, y, z);
    g.add(f);
  };
  const shrooms = (x: number, z: number, y: number) => {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const mx = x + Math.cos(a) * 1.3, mz = z + Math.sin(a) * 1.3;
      g.add(cyl(0.07, 0.09, 0.32, 0xefe6d0, 5, mx, y, mz));
      g.add(blob(0.19, i % 3 === 0 ? 0xd96b3a : 0xc0392b, mx, y + 0.36, mz, 1, 0.5, 1));
    }
  };
  let placed = 0;
  for (let tries = 0; tries < 1200 && placed < 90; tries++) {
    const a = r() * Math.PI * 2, d = WALL_R + 6 + r() * 80;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!freeForTree(x, z)) continue;
    const y = heightAt(x, z);
    const k = placed % 6;
    if (k === 0) {
      // another great oak
      const t = tree('oak', r, 1.5 + r() * 0.6);
      t.position.set(x, y - 0.1, z);
      g.add(t);
    } else if (k === 1) {
      const b = blob(0.9 + r() * 0.8, 0x7d8570, x, y + 0.3, z, 1.3, 0.8, 1.1);
      g.add(b);
      g.add(blob(0.7, 0x4f7f32, x, y + 0.85, z, 1.2, 0.35, 1));
    } else if (k === 2) fern(x, z, y);
    else if (k === 3) shrooms(x, z, y);
    else flowers(x, z, y);
    placed++;
  }
  // flowers, ferns and toadstools around the great trees inside the walls
  for (const [x, z] of [[-34, 2], [-24, -24], [28, -18], [32, 14], [10, -31], [-5, 31]]) {
    flowers(x + 2, z + 1.5, 0);
    fern(x - 2, z - 1, 0);
  }
  motes(g, r, 34, 0xf4ff9a, 0x9aff3a, () => {
    const a = r() * Math.PI * 2, d = 10 + r() * 75;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    return [x, (Math.hypot(x, z) > WALL_R ? heightAt(x, z) : 0) + 1 + r() * 2.5, z];
  });
}

/** Reeds, cattails and drifting mist for a goblin swamp, kept off the paths and away from buildings. */
function addSwamp(g: THREE.Group, r: () => number): void {
  const reed = (x: number, z: number, y: number) => {
    const clump = new THREE.Group();
    const n = 4 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const h = 1 + r() * 1.2;
      const blade = box(0.06, h, 0.06, 0x6f7a3a, (r() - 0.5) * 0.9, 0, (r() - 0.5) * 0.9);
      blade.rotation.z = (r() - 0.5) * 0.35;
      clump.add(blade);
      if (r() < 0.45) clump.add(cyl(0.08, 0.08, 0.35, 0x5a3a22, 5, blade.position.x, h - 0.1, blade.position.z));
    }
    clump.position.set(x, y, z);
    g.add(clump);
  };
  // outside the walls
  let placed = 0;
  for (let tries = 0; tries < 900 && placed < 70; tries++) {
    const a = r() * Math.PI * 2, d = WALL_R + 6 + r() * 70;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!freeForTree(x, z)) continue;
    reed(x, z, heightAt(x, z));
    placed++;
  }
  // inside, only around the camp's totems (the spots the trees used to hold)
  for (const [x, z] of [[-34, 2], [-24, -24], [28, -18], [32, 14], [10, -31], [-5, 31]]) {
    for (let i = 0; i < 2; i++) reed(x + (r() - 0.5) * 3, z + (r() - 0.5) * 3, 0);
  }
  // low mist banks hanging over the bog
  const mistMat = new THREE.MeshBasicMaterial({ color: 0xcfd8c4, transparent: true, opacity: 0.16, depthWrite: false });
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = WALL_R + 10 + r() * 60;
    const m = new THREE.Mesh(new THREE.CircleGeometry(6 + r() * 6, 12), mistMat);
    m.rotation.x = -Math.PI / 2;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    m.position.set(x, heightAt(x, z) + 1.2 + r() * 0.8, z);
    m.userData.dynamic = true;
    g.add(m);
  }
}

/**
 * Spots where defenders can stand on the wall, nearest the viewer first, each
 * with the direction to look out over (radians about Y). Wooden walls only have
 * room on their watch towers; stone walls have a walkway between the towers.
 */
export function wallGuardPosts(level: number): { x: number; y: number; z: number; face: number }[] {
  const tier = level <= 0 ? 0 : level < 5 ? 1 : level < 10 ? 2 : level < 15 ? 3 : 4;
  const R = WALL_R;
  const start = GATE_A + GATE_HALF, end = GATE_A + Math.PI * 2 - GATE_HALF;
  const angles: number[] = [];
  let y = 0;
  if (tier === 2) {
    for (let i = 0; i < 8; i++) angles.push(GATE_A + GATE_HALF + 0.35 + (i / 8) * (Math.PI * 2 - GATE_HALF * 2 - 0.5));
    y = 6.7;
  } else if (tier >= 3) {
    const towers = tier === 3 ? 8 : 12;
    for (let i = 0; i < towers - 1; i++) {
      const a0 = start + ((end - start) * i) / (towers - 1), a1 = start + ((end - start) * (i + 1)) / (towers - 1);
      angles.push(a0 + (a1 - a0) * 0.33, a0 + (a1 - a0) * 0.67);
    }
    y = (tier === 3 ? 3.4 : 4.6) + 0.3;
  }
  // nearest the viewer (the gate side, +Z) first
  const ang = (a: number) => Math.abs(Math.atan2(Math.sin(a - GATE_A), Math.cos(a - GATE_A)));
  return angles
    .sort((a, b) => ang(a) - ang(b))
    .map((a) => ({ x: Math.cos(a) * R, y, z: Math.sin(a) * R, face: Math.atan2(Math.cos(a), Math.sin(a)) }));
}

/** The wall ring for a given level. */
export function buildWall(level: number, color: number): THREE.Group {
  const g = new THREE.Group();
  if (level <= 0) return g;
  const tier = level < 5 ? 1 : level < 10 ? 2 : level < 15 ? 3 : 4;
  const R = WALL_R;
  const start = GATE_A + GATE_HALF, end = GATE_A + Math.PI * 2 - GATE_HALF;
  if (tier <= 2) {
    const h = tier === 1 ? 2.6 : 3.6;
    const step = 0.72 / R;
    for (let a = start; a <= end; a += step) {
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      const hh = h + ((Math.sin(a * 37) + 1) * 0.25);
      g.add(cyl(0.34, 0.38, hh, 0x8a6038, 6, x, 0, z));
      g.add(cone(0.36, 0.7, 0x6e4a2a, 6, x, hh, z));
    }
    // walkway posts and a simple gate
    for (const s of [-1, 1]) {
      const a = GATE_A + s * GATE_HALF;
      g.add(box(0.8, h + 1.8, 0.8, C.timber, Math.cos(a) * R, 0, Math.sin(a) * R));
    }
    g.add(box(GATE_HALF * 2 * R + 1, 0.5, 0.6, C.timber, 0, h + 1.2, R));
    if (tier === 2) {
      for (let i = 0; i < 8; i++) {
        const a = GATE_A + GATE_HALF + 0.35 + (i / 8) * (Math.PI * 2 - GATE_HALF * 2 - 0.5);
        const tw = new THREE.Group();
        tw.add(box(2.6, 6.4, 2.6, C.timberLight));
        tw.add(box(3.2, 0.3, 3.2, C.timber, 0, 6.4, 0));
        tw.add(cone(2.5, 2.4, C.thatch, 4, 0, 6.6, 0).rotateY(Math.PI / 4));
        tw.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
        tw.rotation.y = -a;
        g.add(tw);
      }
    }
    return bake(g, { building: 'wall' });
  }
  const h = tier === 3 ? 3.4 : 4.6;
  const thick = tier === 3 ? 1.6 : 2.0;
  const segs = 40;
  for (let i = 0; i < segs; i++) {
    const a0 = start + ((end - start) * i) / segs;
    const a1 = start + ((end - start) * (i + 1)) / segs;
    const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
    const len = Math.hypot(x1 - x0, z1 - z0) + 0.15;
    const seg = new THREE.Group();
    seg.add(box(len, h, thick, C.stone));
    seg.add(box(len, 0.3, thick + 0.2, C.stoneDark, 0, h, 0));
    const merlons = Math.max(2, Math.round(len / 1.2));
    for (let k = 0; k < merlons; k++) {
      seg.add(box(0.6, 0.7, 0.45, C.stone, -len / 2 + (k + 0.5) * (len / merlons), h + 0.3, thick / 2 - 0.1));
      seg.add(box(0.6, 0.7, 0.45, C.stone, -len / 2 + (k + 0.5) * (len / merlons), h + 0.3, -thick / 2 + 0.1));
    }
    if (getTheme() === 'goblin') {
      // sharpened stakes bristling outward from the battlements
      for (let k = 0; k < merlons; k++) {
        const st = cone(0.13, 1.3, C.timber, 4, -len / 2 + (k + 0.5) * (len / merlons), h - 0.4, thick / 2 + 0.2);
        st.rotation.x = 1.25;
        seg.add(st);
      }
    }
    seg.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    seg.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(seg);
  }
  const towers = tier === 3 ? 8 : 12;
  for (let i = 0; i < towers; i++) {
    const a = start + ((end - start) * i) / (towers - 1);
    const tw = roundTower(tier === 3 ? 2.3 : 2.7, tier === 3 ? 6 : 8, { roof: tier === 4 ? C.tile : null });
    tw.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    g.add(tw);
  }
  // gatehouse
  const gate = new THREE.Group();
  gate.add(box(GATE_HALF * 2 * R + 3, 2.2, thick + 0.6, C.stone, 0, h + 0.2, 0));
  gate.add(box(GATE_HALF * 2 * R, 0.5, 0.3, C.woodDark, 0, h - 0.4, thick / 2 + 0.2));
  gate.position.set(0, 0, R);
  g.add(gate);
  const baked = bake(g, { building: 'wall' });
  if (tier === 4) {
    for (const s of [-1, 1]) {
      const pole = new THREE.Group();
      pole.add(cyl(0.08, 0.08, 3, C.woodDark, 5));
      const flag = box(1.6, 1.0, 0.06, color, 0.8, 1.8, 0);
      const fg = new THREE.Group();
      fg.add(flag);
      fg.userData.flag = true;
      pole.add(fg);
      const a = GATE_A + s * (GATE_HALF + 0.05);
      pole.position.set(Math.cos(a) * R, h + 2.4, Math.sin(a) * R + 0.5);
      pole.traverse((c) => (c.userData.building = 'wall'));
      baked.add(pole);
    }
  }
  return baked;
}

export { mat };
