// The village grounds: terrain, roads, stream, scenery and the wall ring.

import * as THREE from 'three';
import type { BuildingId } from '../../engine/types';
import { C, bake, box, cone, cyl, darker, getSeason, mat, rng, roundTower, seasonal } from './kit';
import { rock, tree, pumpkin, hayBale, barrel, crate } from './props';

export const WALL_R = 40;
export const GATE_A = Math.PI / 2; // gate faces +Z (towards the viewer)
const GATE_HALF = 0.12;

/** Where each building stands (x, z, rotation y). */
export const LAYOUT: Record<BuildingId, [number, number, number]> = {
  main: [0, -10, 0],
  statue: [0, 7, 0],
  rally: [-9, 16, 0.3],
  market: [11, 15, -0.2],
  barracks: [-21, -8, Math.PI / 2],
  stable: [-24, 12, Math.PI / 2 - 0.2],
  workshop: [-14, 28, 0.5],
  smithy: [-12, -26, 0.25],
  academy: [20, -16, -Math.PI / 2],
  warehouse: [19, 29, -0.5],
  hiding: [5, 31, 0],
  watchtower: [31, 6, 0],
  wall: [0, 0, 0],
  timber: [-58, 4, 0.2],
  claypit: [-44, 46, 0.4],
  ironmine: [-40, -54, 0.5],
  farm: [48, -46, -0.3],
};

const ROADS: [number, number, number, number, number][] = [
  // x1, z1, x2, z2, width
  [0, 15, 0, 95, 5],
  [0, 15, 0, -4, 4.5],
  [0, 8, -9, 16, 3],
  [0, 8, 11, 15, 3],
  [-4, 4, -18, -6, 2.6],
  [-4, 10, -21, 12, 2.6],
  [-3, 20, -14, 27, 2.4],
  [3, 20, 18, 28, 2.4],
  [-3, -3, -11, -22, 2.4],
  [4, -4, 17, -15, 2.4],
  [6, 10, 29, 6, 2.2],
  [0, 44, -30, 46, 3],
  [-30, 46, -40, 46, 3],
  [-39, 6, -50, 4, 3],
  [-28, -28, -36, -44, 3],
  [28, -28, 42, -38, 3],
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
  if (Math.abs(Math.hypot(x, z) - 31) < 1.4 && !(z > 28)) return true;
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
  // flatten around outer workplaces
  for (const id of ['timber', 'claypit', 'farm'] as BuildingId[]) {
    const [bx, bz] = LAYOUT[id];
    const d = Math.hypot(x - bx, z - bz);
    if (d < 16) h *= d / 16;
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
    col.set(seasonal(c));
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
  if (Math.abs(x - streamX(z)) < 6) return false;
  for (const id of ['timber', 'claypit', 'ironmine', 'farm'] as BuildingId[]) {
    const [bx, bz] = LAYOUT[id];
    const rad = id === 'farm' ? 24 : id === 'timber' ? 12 : 13;
    if (Math.hypot(x - bx, z - bz) < rad) return false;
  }
  return true;
}

export function buildScenery(seed = 11): THREE.Group {
  const g = new THREE.Group();
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
    const t = tree(kind, r, 1.1 + (d > 100 ? 0.3 : 0));
    t.position.set(x, heightAt(x, z) - 0.1, z);
    g.add(t);
    placed++;
  }
  for (let i = 0; i < 40; i++) {
    const x = (r() - 0.5) * 280, z = (r() - 0.5) * 280;
    if (!freeForTree(x, z)) continue;
    const rk = rock(r, 1 + r());
    rk.position.set(x, heightAt(x, z), z);
    g.add(rk);
  }
  // a few trees and bits of life inside the walls
  for (const [x, z, k] of [[-30, -20, 'oak'], [26, -30, 'birch'], [-31, 20, 'oak'], [28, 18, 'oak'], [9, -30, 'birch'], [-6, 34, 'oak']] as const) {
    const t = tree(k, r, 0.9);
    t.position.set(x, 0, z);
    g.add(t);
  }
  g.add(pumpkin(5, 20), pumpkin(5.8, 20.6, 0.8), pumpkin(-4.6, 22, 1.1));
  g.add(hayBale(-28, 2, 0.5), barrel(8, -24), crate(9, -23.4), crate(24, 10));
  const baked = bake(g);
  return baked;
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
