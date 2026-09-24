// The village grounds: terrain, roads, stream, scenery and the wall ring.

import * as THREE from 'three';
import type { BuildingId } from '../../engine/types';
import { ARC, ARC_EMIT, C, VIO, VIO_EMIT, arcaneLamp, bake, box, cone, cyl, darker, floatingCrystal, floatingIsle, getSeason, getTheme, mat, rng, roundTower, seasonal } from './kit';
import { rock, tree, pumpkin, hayBale, barrel, crate, crystalSpire, greatTree, skullTotem, necroObelisk, gravestone, sunShrine, banner } from './props';
import { blob, mesh } from './kit';
import { distToPaths } from './paths';

export const WALL_R = 44;
export const GATE_A = Math.PI / 2; // gate faces +Z (towards the viewer)
export const GATE_HALF = 0.12;

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
/** Where visiting armies pitch their tents: west of the road outside the gate, clear of every path. */
export const CAMP: [number, number] = [-24, 57];
/** How far round the camp nothing else is put. */
export const CAMP_R = 10;

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
  if (Math.hypot(x - CAMP[0], z - CAMP[1]) < CAMP_R) return false;
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
    // the tournament ground (paladin) and the stone circle (sorcerer) outside the gate are kept clear
    if (theme !== 'classic' && Math.hypot(it.x - 21, it.z - 57.5) < 13) continue;
    if (inside && theme !== 'classic' && (it.kind === 'oak' || it.kind === 'birch')) {
      const lm = theme === 'paladin' ? sunShrine(r) : theme === 'sorcerer' ? crystalSpire() : theme === 'druid' ? greatTree(r) : theme === 'necromancer' ? necroObelisk(r) : skullTotem();
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
  addLamps(g);
  if (getTheme() === 'goblin') { addSwamp(g, r); addGoblinYard(g, r); }
  if (getTheme() === 'paladin') addTourney(g, r);
  if (getTheme() === 'sorcerer') addArcane(g, r);
  if (getTheme() === 'druid') { addGlade(g, r); addSpring(g, r); }
  if (getTheme() === 'necromancer') addGraveyard(g, r);
  if (getSeason() === 'volcanic') addVolcanic(g, r);
  return bake(g);
}

/**
 * The Radiant Order's grounds: a tournament field outside the gate (the tilt, two
 * pavilions and a grandstand under the Order's colours), heraldic banners lining
 * the road, rose bushes and white waystones in the meadows, and golden motes of
 * light drifting over it all.
 */
function addTourney(g: THREE.Group, r: () => number): void {
  const ROYAL = 0x2c56b0, WHITE = 0xf3eee2, GOLD = 0xd9a441, CRIMSON = 0xb3261a;
  const at = (x: number, z: number) => heightAt(x, z);
  // the lists: a long striped tilt barrier running east-west
  const cx = 21, cz = 57;
  for (let i = 0; i <= 14; i++) {
    const x = cx - 7 + i;
    g.add(box(0.24, 1.3, 0.24, i % 2 ? ROYAL : WHITE, x, at(x, cz), cz));
  }
  for (const y of [0.55, 1.15]) {
    const rail = box(14.4, 0.14, 0.12, i2c(y), cx, at(cx, cz) + y, cz);
    g.add(rail);
  }
  function i2c(y: number) { return y > 1 ? GOLD : WHITE; }
  // a pavilion at each end of the lists, striped in the Order's colours and a guest's
  const pavilion = (x: number, z: number, a: number, b: number) => {
    const p = new THREE.Group();
    const n = 12;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const panel = box(0.95, 2.2, 0.06, i % 2 ? a : b, Math.cos(ang) * 1.7, 0, Math.sin(ang) * 1.7);
      panel.rotation.y = -ang + Math.PI / 2;
      p.add(panel);
    }
    p.add(cone(2.3, 2.2, a, n, 0, 2.2));
    p.add(cyl(2.35, 2.35, 0.2, b, n, 0, 2.1));
    p.add(cyl(0.05, 0.05, 1.3, 0x4a3220, 4, 0, 4.3));
    const pennant = box(1.0, 0.45, 0.04, a === ROYAL ? GOLD : a, 0.5, 5.2, 0);
    pennant.userData.flag = true;
    p.add(pennant);
    p.add(box(1.0, 1.6, 0.08, 0x2a1d12, 0, 0, 1.72)); // the doorway
    p.position.set(x, at(x, z), z);
    g.add(p);
  };
  pavilion(cx - 10.5, cz + 0.5, ROYAL, WHITE);
  pavilion(cx + 10.5, cz - 0.5, CRIMSON, WHITE);
  // the grandstand on the north side, under a blue and gold canopy
  const sx = cx, sz = cz - 4.5;
  const stand = new THREE.Group();
  for (let i = 0; i < 3; i++) stand.add(box(9, 0.5, 1.2, 0x8a6a48, 0, i * 0.55, -i * 1.1));
  for (const x of [-4.4, 4.4]) for (const z of [0.4, -2.6]) stand.add(box(0.2, 3.6, 0.2, 0x5b3e28, x, 0, z));
  for (let i = 0; i < 6; i++) stand.add(box(1.5, 0.12, 3.4, i % 2 ? ROYAL : GOLD, -3.75 + i * 1.5, 3.6, -1.1));
  for (let i = 0; i < 5; i++) {
    const fl = box(0.7, 0.9, 0.04, i % 2 ? ROYAL : WHITE, -3.6 + i * 1.8, 2.55, 0.62);
    stand.add(fl);
    stand.add(blob(0.12, GOLD, -3.6 + i * 1.8, 2.8, 0.66));
  }
  stand.position.set(sx, at(sx, sz), sz);
  g.add(stand);
  // lances racked by the lists, a practice quintain, and a mounting block
  const rack = new THREE.Group();
  rack.add(box(2.4, 0.14, 0.14, 0x5b3e28, 0, 1.6, 0));
  for (let i = 0; i < 5; i++) {
    const l = cyl(0.05, 0.05, 3.4, i % 2 ? ROYAL : WHITE, 5, -1 + i * 0.5, 0, 0);
    l.rotation.x = -0.18;
    rack.add(l);
  }
  rack.position.set(cx - 5, at(cx - 5, cz + 3.5), cz + 3.5);
  g.add(rack);
  const q = new THREE.Group();
  q.add(cyl(0.12, 0.14, 2.6, 0x5b3e28, 6));
  q.add(box(1.8, 0.14, 0.14, 0x5b3e28, 0.5, 2.4, 0));
  q.add(heraldicDisc(ROYAL, GOLD).translateX(1.35).translateY(2.1));
  q.position.set(cx + 5, at(cx + 5, cz + 4), cz + 4);
  g.add(q);
  // banners of the Order lining the road out of the gate
  for (const z of [51, 60, 69, 78]) for (const x of [-3.9, 3.9]) {
    const b = banner(ROYAL, 5.2);
    b.position.set(x, at(x, z), z);
    b.rotation.y = x < 0 ? -0.2 : 0.2;
    g.add(b);
  }
  // white waystones and rose bushes in the meadows
  let placed = 0;
  for (let tries = 0; tries < 700 && placed < 34; tries++) {
    const a = r() * Math.PI * 2, d = WALL_R + 7 + r() * 72;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!freeForTree(x, z)) continue;
    if (Math.hypot(x - cx, z - cz) < 16) continue;
    const y = at(x, z);
    if (placed % 4 === 0) {
      const st = new THREE.Group();
      st.add(box(0.7, 1.9, 0.4, 0xe4ddcb));
      st.add(cone(0.42, 0.5, 0xe4ddcb, 4, 0, 1.9).rotateY(Math.PI / 4));
      st.add(blob(0.14, GOLD, 0, 1.2, 0.22));
      st.position.set(x, y, z);
      st.rotation.y = r() * Math.PI;
      g.add(st);
    } else {
      for (let k = 0; k < 3; k++) {
        const bx = x + (r() - 0.5) * 2, bz = z + (r() - 0.5) * 2;
        g.add(blob(0.5 + r() * 0.3, 0x3f6a2a, bx, at(bx, bz) + 0.3, bz, 1, 0.75, 1));
        for (let j = 0; j < 3; j++) g.add(blob(0.13, r() < 0.6 ? 0xe0506a : 0xf6f2ea, bx + (r() - 0.5) * 0.8, at(bx, bz) + 0.62 + r() * 0.2, bz + (r() - 0.5) * 0.8));
      }
    }
    placed++;
  }
  // golden motes of light
  motes(g, r, 44, 0xffe9a0, 0xb08a20, () => {
    const a = r() * Math.PI * 2, d = 6 + r() * 82;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    return [x, (Math.hypot(x, z) > WALL_R ? heightAt(x, z) : 0) + 1.5 + r() * 5, z];
  });
}

/** A round shield: a coloured field with a gold boss (the quintain's target). */
function heraldicDisc(field: number, boss: number): THREE.Group {
  const g = new THREE.Group();
  const d = cyl(0.55, 0.55, 0.1, field, 12);
  d.rotation.x = Math.PI / 2;
  g.add(d);
  const b = blob(0.18, boss, 0, 0, 0.08);
  g.add(b);
  return g;
}

/** The necromancers' grounds: rows of gravestones, iron fences, open graves, drifting fog and green wisps. */
function addGraveyard(g: THREE.Group, r: () => number): void {
  let placed = 0;
  for (let tries = 0; tries < 900 && placed < 70; tries++) {
    const a = r() * Math.PI * 2, d = WALL_R + 6 + r() * 70;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!freeForTree(x, z)) continue;
    const y = heightAt(x, z);
    const k = placed % 7;
    if (k < 4) {
      const st = gravestone(r, x, z, r() * 0.6 - 0.3);
      st.position.y = y;
      g.add(st);
    } else if (k === 4) {
      // an open grave: a dark pit and its mound of earth
      g.add(box(0.9, 0.06, 1.8, 0x1a1614, x, y + 0.02, z));
      g.add(blob(0.7, 0x544d45, x + 0.9, y + 0.1, z, 0.8, 0.45, 1.3));
    } else if (k === 5) {
      // a length of iron railing
      const fence = new THREE.Group();
      fence.add(box(2.4, 0.06, 0.06, 0x2e2a33, 0, 0.9, 0));
      for (let i = 0; i < 7; i++) fence.add(box(0.05, 1.05, 0.05, 0x2e2a33, -1.1 + i * 0.37, 0, 0), cone(0.05, 0.15, 0x2e2a33, 4, -1.1 + i * 0.37, 1.05, 0));
      fence.position.set(x, y, z);
      fence.rotation.y = r() * Math.PI;
      g.add(fence);
    } else {
      const t = tree('oak', r, 1);
      t.position.set(x, y - 0.1, z);
      g.add(t);
    }
    placed++;
  }
  // a gravestone or two by each obelisk inside the walls
  for (const [x, z] of [[-34, 2], [-24, -24], [28, -18], [32, 14], [10, -31], [-5, 31]]) g.add(gravestone(r, x + 2.4, z + 1.2, 0.2));
  // fog lying low over the graves
  const fogMat = new THREE.MeshLambertMaterial({ color: 0xb8c8bc, transparent: true, opacity: 0.22, depthWrite: false, alphaMap: softDisc() });
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = WALL_R + 8 + r() * 60;
    const m = new THREE.Mesh(new THREE.CircleGeometry(6 + r() * 6, 12), fogMat);
    m.rotation.x = -Math.PI / 2;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    m.position.set(x, heightAt(x, z) + 0.8 + r() * 0.6, z);
    m.userData.dynamic = true;
    g.add(m);
  }
  motes(g, r, 30, 0x8dffb4, 0x1f9a4a, () => {
    const a = r() * Math.PI * 2, d = 8 + r() * 78;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    return [x, (Math.hypot(x, z) > WALL_R ? heightAt(x, z) : 0) + 1 + r() * 3, z];
  });
  addBoneField(g);
}

/** A bone from a to b (for the great skeleton outside the gate). */
function bigBone(a: THREE.Vector3, b: THREE.Vector3, rad: number, color = 0xe6dfcc): THREE.Mesh {
  const d = b.clone().sub(a);
  const m = mesh(new THREE.CylinderGeometry(rad * 0.8, rad, d.length(), 6), color);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

/**
 * The necromancers' field outside the gate: the bones of some enormous beast half
 * sunk in the earth, its ribs arching out of the grass and its skull lying at the
 * end, green light in its eyes; and over the road, a gate of stacked skulls.
 */
function addBoneField(g: THREE.Group): void {
  const cx = 21, cz = 57.5;
  const at = (x: number, z: number) => heightAt(x, z);
  const BONE = 0xe6dfcc, BONE_DK = 0xb9b19c;
  // the backbone, running along the field, sinking into the ground at the tail
  const n = 16;
  const spine: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = cx - 11 + k * 20, z = cz + Math.sin(k * 2.2) * 1.6;
    spine.push(new THREE.Vector3(x, at(x, z) + 0.2 + Math.sin(k * Math.PI) * 1.2, z));
  }
  for (let i = 0; i < n; i++) {
    g.add(bigBone(spine[i], spine[i + 1], 0.42));
    g.add(blob(0.55, BONE_DK, spine[i].x, spine[i].y, spine[i].z));
    g.add(cone(0.18, 1.1, BONE_DK, 4, spine[i].x, spine[i].y + 0.35, spine[i].z));
  }
  // the ribs arching up out of the earth
  for (let i = 3; i < 12; i++) {
    const p = spine[i];
    const R = 3.6 + Math.sin(((i - 3) / 8) * Math.PI) * 2.2;
    for (const side of [-1, 1]) {
      let prev = p.clone();
      for (let j = 1; j <= 5; j++) {
        const a = j * 0.5;
        const q = new THREE.Vector3(p.x + (i % 2 ? 0.3 : -0.3), p.y + Math.sin(a) * R * 0.95 - j * 0.35, p.z + side * (1 - Math.cos(a)) * R * 0.8);
        q.y = Math.max(q.y, at(q.x, q.z) - 0.4);
        g.add(bigBone(prev, q, 0.22 - j * 0.02));
        prev = q;
      }
    }
  }
  // the skull, lying where the neck ends, eyes burning
  const head = spine[n];
  const sk = new THREE.Group();
  sk.add(blob(2.0, BONE, 0, 0, 0, 1.15, 0.8, 1.2));
  sk.add(box(2.0, 1.1, 3.4, BONE, 0, -0.5, 2.6));
  const jaw = box(1.8, 0.4, 3.4, BONE_DK, 0, -1.2, 2.4);
  jaw.rotation.x = 0.25;
  sk.add(jaw);
  for (const x of [-1, 1]) {
    sk.add(mesh(new THREE.IcosahedronGeometry(0.42, 0), 0x5cff9a, { emissive: 0x1f9a4a }).translateX(x * 0.95).translateY(0.2).translateZ(1.5));
    const horn = cone(0.4, 3.6, BONE_DK, 6, x * 1.1, 0.8, -0.8);
    horn.rotation.set(-1.9, 0, -x * 0.4);
    sk.add(horn);
  }
  sk.position.set(head.x + 2.6, at(head.x + 2.6, head.z) + 0.6, head.z);
  sk.rotation.set(0.1, Math.PI / 2 + 0.3, 0.25);
  g.add(sk);
  // a gate of skulls over the road out of the village
  const gz = 60;
  for (const x of [-4.6, 4.6]) {
    const col = new THREE.Group();
    col.add(box(1.4, 0.5, 1.4, 0x2e2a33));
    for (let i = 0; i < 6; i++) {
      const s2 = new THREE.Group();
      s2.add(blob(0.36, BONE, 0, 0, 0, 1, 0.9, 1));
      s2.add(box(0.26, 0.18, 0.2, BONE, 0, -0.36, 0.08));
      for (const ex of [-0.12, 0.12]) s2.add(box(0.11, 0.11, 0.06, 0x141214, ex, 0.02, 0.32));
      s2.position.set(0, 0.85 + i * 0.66, 0);
      s2.rotation.y = i % 2 ? 0.4 : -0.4;
      col.add(s2);
    }
    col.position.set(x, at(x, gz), gz);
    g.add(col);
  }
  const arch: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) { const a = Math.PI * (i / 8); arch.push(new THREE.Vector3(-Math.cos(a) * 4.6, at(0, gz) + 4.6 + Math.sin(a) * 2.6, gz)); }
  for (let i = 0; i < 8; i++) g.add(bigBone(arch[i], arch[i + 1], 0.26));
  const key = new THREE.Group();
  key.add(blob(0.7, BONE, 0, 0, 0, 1, 0.9, 1));
  for (const ex of [-0.24, 0.24]) key.add(mesh(new THREE.BoxGeometry(0.2, 0.2, 0.1), 0x5cff9a, { emissive: 0x1f9a4a }).translateX(ex).translateZ(0.62));
  key.position.set(0, at(0, gz) + 7.4, gz + 0.2);
  g.add(key);
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
  motes(g, r, 24, 0xbff4ff, 0x2a8ab8, () => {
    const a = r() * Math.PI * 2, d = 8 + r() * 80;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    return [x, (Math.hypot(x, z) > WALL_R ? heightAt(x, z) : 0) + 2 + r() * 6, z];
  });
  addHenge(g, r);
}

/**
 * The sorcerers' stone circle outside the gate: standing stones cut with glowing
 * runes, lintels across some, an altar with a great crystal turning over it and a
 * pillar of light rising into the sky; a line of glowing ley-stones leads to it from
 * the road, crystal lamps light the road itself, and isles of rock drift overhead.
 */
function addHenge(g: THREE.Group, r: () => number): void {
  const cx = 21, cz = 58;
  const at = (x: number, z: number) => heightAt(x, z);
  const n = 10, R = 6.8;
  const tops: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
    const h = 3.4 + (i % 2) * 0.6;
    const st = new THREE.Group();
    st.add(box(1.1, h, 0.7, 0x8f8ca8));
    for (const side of [-1, 1]) {
      const rune = mesh(new THREE.BoxGeometry(0.3, 0.9, 0.05), i % 2 ? ARC : VIO, { emissive: i % 2 ? ARC_EMIT : VIO_EMIT });
      rune.position.set(0, h * 0.55, side * 0.37);
      st.add(rune);
    }
    st.position.set(x, at(x, z) - 0.2, z);
    st.rotation.y = -a + Math.PI / 2;
    g.add(st);
    tops.push(new THREE.Vector3(x, at(x, z) - 0.2 + h, z));
  }
  // lintels across every other pair
  for (let i = 0; i < n; i += 2) {
    const p = tops[i], q = tops[(i + 1) % n];
    const len = Math.hypot(q.x - p.x, q.z - p.z) + 1.2;
    const l = box(len, 0.55, 0.8, 0x8f8ca8, (p.x + q.x) / 2, Math.min(p.y, q.y), (p.z + q.z) / 2);
    l.rotation.y = -Math.atan2(q.z - p.z, q.x - p.x);
    g.add(l);
  }
  // the altar, a rune circle round it, and the crystal over it
  const y0 = at(cx, cz);
  g.add(cyl(1.5, 1.7, 0.9, 0x77779c, 8, cx, y0 - 0.1, cz));
  g.add(cyl(1.1, 1.2, 0.3, 0xd2d2e8, 8, cx, y0 + 0.8, cz));
  const ring = mesh(new THREE.TorusGeometry(4.2, 0.09, 4, 40), VIO, { emissive: VIO_EMIT });
  ring.rotation.x = Math.PI / 2;
  ring.position.set(cx, y0 + 0.08, cz);
  g.add(ring);
  const c = floatingCrystal(1.4);
  c.position.set(cx, y0 + 3.6, cz);
  g.add(c);
  const beam = mesh(new THREE.CylinderGeometry(0.7, 1.1, 40, 14, 1, true).translate(0, 20, 0), 0xcbb8ff, { emissive: 0x6a38d0, opacity: 0.2, double: true });
  beam.position.set(cx, y0 + 1.1, cz);
  beam.castShadow = false;
  g.add(beam);
  // ley-stones glowing in the grass from the road to the circle
  const sx = 3.6, sz = 52;
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const x = sx + (cx - R - 0.8 - sx) * k, z = sz + (cz - sz) * k + Math.sin(k * Math.PI) * 2.5;
    const ls = mesh(new THREE.BoxGeometry(0.55, 0.12, 0.3), ARC, { emissive: ARC_EMIT });
    ls.position.set(x, at(x, z) + 0.05, z);
    ls.rotation.y = r() * Math.PI;
    ls.castShadow = false;
    g.add(ls);
  }
  // crystal lamps along the road out of the gate
  for (const z of [51, 60, 69, 78]) for (const x of [-3.9, 3.9]) {
    const l = arcaneLamp(3.4);
    l.position.set(x, at(x, z), z);
    l.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(l);
  }
  // isles of rock adrift over the meadows
  let placed = 0;
  for (let tries = 0; tries < 300 && placed < 6; tries++) {
    const a = r() * Math.PI * 2, d = WALL_R + 16 + r() * 50;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - cx, z - cz) < 14 || Math.abs(x) < 8 && z > 0) continue;
    const s = 0.9 + r() * 0.9;
    const isle = floatingIsle(s, r, s > 1.3 ? tree('pine', r, 0.55) : undefined);
    isle.position.set(x, at(x, z) + 11 + r() * 9, z);
    isle.rotation.y = r() * Math.PI * 2;
    g.add(isle);
    placed++;
  }
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
/**
 * Street lamps round the square, down the main street and along the ring road.
 * Their glass is the same as the windows', so they light up with the village at night.
 */
function addLamps(g: THREE.Group): void {
  const spots: [number, number][] = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; spots.push([Math.cos(a) * 9.4, 3.8 + Math.sin(a) * 9.4]); }
  for (const z of [15, 23, 31, 39]) for (const x of [-3.4, 3.4]) spots.push([x, z]);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.1;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.3) continue;
    spots.push([Math.cos(a) * 41.8, Math.sin(a) * 41.8]);
  }
  const clearOf = (x: number, z: number) => (Object.keys(LAYOUT) as BuildingId[]).every((id) => {
    if (id === 'wall' || OUTSIDE.includes(id)) return true;
    const [bx, bz] = LAYOUT[id];
    const room = id === 'main' ? 11.5 : id === 'statue' || id === 'rally' || id === 'hiding' ? 4.2 : 8;
    return Math.hypot(x - bx, z - bz) > room;
  });
  for (const [x, z] of spots) {
    if (!clearOf(x, z)) continue;
    const l = new THREE.Group();
    l.add(cyl(0.22, 0.28, 0.3, C.stoneDark, 6));
    l.add(cyl(0.06, 0.08, 2.6, C.iron, 5, 0, 0.3));
    l.add(box(0.44, 0.08, 0.44, C.iron, 0, 2.85, 0));
    const glass = box(0.34, 0.46, 0.34, C.window, 0, 2.93, 0);
    glass.userData.window = true;
    l.add(glass);
    l.add(cone(0.34, 0.3, C.slate, 4, 0, 3.39, 0).rotateY(Math.PI / 4));
    l.position.set(x, 0, z);
    g.add(l);
  }
}

/**
 * The druids' sacred spring outside the gate: a pool with lilies, a ring of mossy
 * standing stones round it, deer grazing at its edge, giant toadstools, and a
 * great oak at the back.
 */
function addSpring(g: THREE.Group, r: () => number): void {
  const cx = 21, cz = 57.5;
  const at = (x: number, z: number) => heightAt(x, z);
  const y0 = at(cx, cz);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(4.2, 18), mat(0x4a9aa8, { emissive: 0x0a3a40 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(cx, y0 + 0.08, cz);
  g.add(pool);
  g.add(cyl(4.5, 4.6, 0.12, 0x6a5a40, 18, cx, y0 - 0.02, cz));
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, d = r() * 3.2;
    const lily = new THREE.Mesh(new THREE.CircleGeometry(0.42, 7), mat(0x5e8c34));
    lily.rotation.x = -Math.PI / 2;
    lily.position.set(cx + Math.cos(a) * d, y0 + 0.11, cz + Math.sin(a) * d);
    g.add(lily);
    if (i % 2 === 0) g.add(blob(0.13, 0xf4c0d8, lily.position.x, y0 + 0.2, lily.position.z));
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const x = cx + Math.cos(a) * 7.2, z = cz + Math.sin(a) * 6.4;
    const st = box(0.9, 2.4 + (i % 3) * 0.5, 0.6, 0x8e9a80, x, at(x, z) - 0.2, z);
    st.rotation.y = -a;
    g.add(st);
    g.add(blob(0.5, 0x5e7d32, x, at(x, z) + 2.3 + (i % 3) * 0.5, z, 1, 0.4, 1));
  }
  const deer = (x: number, z: number, rot: number, grazing: boolean) => {
    const d = new THREE.Group();
    d.add(box(0.5, 0.5, 1.3, 0xa0703c, 0, 0.9, 0));
    for (const [lx, lz] of [[-0.18, 0.5], [0.18, 0.5], [-0.18, -0.5], [0.18, -0.5]]) d.add(box(0.1, 0.9, 0.1, 0x7a5230, lx, 0, lz));
    const neck = box(0.2, 0.7, 0.2, 0xa0703c, 0, 1.2, 0.6);
    neck.rotation.x = grazing ? 1.9 : 0.4;
    d.add(neck);
    const head = box(0.26, 0.26, 0.5, 0xa0703c, 0, grazing ? 0.6 : 1.85, grazing ? 1.3 : 0.9);
    d.add(head);
    if (!grazing) for (const s2 of [-1, 1]) { const ant = box(0.05, 0.6, 0.05, 0xe8dcc0, s2 * 0.15, 2.0, 0.75); ant.rotation.z = -s2 * 0.4; d.add(ant); }
    d.add(blob(0.1, 0xf4f1e6, 0, 1.05, -0.7));
    d.position.set(x, at(x, z), z);
    d.rotation.y = rot;
    g.add(d);
  };
  deer(cx - 4.4, cz + 3.2, 2.4, true);
  deer(cx + 5.2, cz - 1.0, -1.4, false);
  deer(cx + 3.6, cz + 4.4, 3.4, true);
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2, d = 9 + r() * 2;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, s2 = 0.8 + r() * 0.8;
    g.add(cyl(0.2 * s2, 0.28 * s2, 1.3 * s2, 0xefe6d0, 6, x, at(x, z), z));
    g.add(blob(0.8 * s2, i % 2 ? 0xc0392b : 0xd96b3a, x, at(x, z) + 1.35 * s2, z, 1, 0.45, 1));
  }
}

/**
 * The goblins' yard outside the gate: a great cauldron bubbling green over a fire,
 * a scrap heap of everything they ever stole, and giant glowing toadstools.
 */
function addGoblinYard(g: THREE.Group, r: () => number): void {
  const cx = 21, cz = 57.5;
  const at = (x: number, z: number) => heightAt(x, z);
  const y0 = at(cx, cz);
  // the cauldron
  g.add(mesh(new THREE.SphereGeometry(2.2, 12, 8, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), 0x2a2622).translateX(cx).translateY(y0 + 2.2).translateZ(cz));
  const brew = new THREE.Mesh(new THREE.CircleGeometry(1.9, 14), mat(0x9aff3a, { emissive: 0x4a9a10 }));
  brew.rotation.x = -Math.PI / 2;
  brew.position.set(cx, y0 + 3.0, cz);
  g.add(brew);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; g.add(box(0.3, 1.2, 0.3, 0x2a2622, cx + Math.cos(a) * 1.6, y0, cz + Math.sin(a) * 1.6)); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const lg = cyl(0.18, 0.18, 1.8, 0x5e4428, 5, cx + Math.cos(a) * 0.9, y0 + 0.1, cz + Math.sin(a) * 0.9); lg.rotation.set(Math.PI / 2, 0, a); g.add(lg); }
  const flame = mesh(new THREE.ConeGeometry(0.9, 1.3, 6).translate(0, 0.65, 0), 0xff8a3a, { emissive: 0xd0501a });
  flame.position.set(cx, y0 + 0.1, cz);
  g.add(flame);
  const bubbles = new THREE.Group();
  for (let i = 0; i < 6; i++) bubbles.add(mesh(new THREE.IcosahedronGeometry(0.2 + r() * 0.15, 0), 0xc8ff7a, { emissive: 0x6ab020 }).translateX((r() - 0.5) * 2.4).translateZ((r() - 0.5) * 2.4));
  bubbles.userData.dynamic = true;
  bubbles.userData.bob = 0.35;
  bubbles.userData.orbit = 0.5;
  bubbles.position.set(cx, y0 + 3.1, cz);
  g.add(bubbles);
  // the scrap heap
  const hx = cx + 9, hz = cz - 1;
  g.add(blob(3.4, 0x55462f, hx, at(hx, hz), hz, 1.3, 0.45, 1.1));
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = r() * 3.2;
    const x = hx + Math.cos(a) * d, z = hz + Math.sin(a) * d, y = at(x, z) + 0.6 + (3.2 - d) * 0.45;
    const k = i % 5;
    const piece = k === 0 ? cyl(0.5, 0.5, 0.12, 0x6e4a2a, 8, x, y, z) : k === 1 ? box(1.2, 0.1, 0.8, 0x8a4b24, x, y, z) : k === 2 ? cyl(0.35, 0.3, 0.8, 0x5c554a, 7, x, y, z) : k === 3 ? box(0.5, 0.5, 0.5, 0x6e4a2a, x, y, z) : cyl(0.4, 0.4, 0.06, 0x8a8a7a, 6, x, y, z);
    piece.rotation.set(r() * 3, r() * 3, r() * 3);
    g.add(piece);
  }
  // giant glowing toadstools
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, d = 5 + r() * 4;
    const x = cx + Math.cos(a) * d - 3, z = cz + Math.sin(a) * d, s2 = 0.9 + r() * 1.1;
    if (Math.hypot(x - hx, z - hz) < 4.5) continue;
    g.add(cyl(0.22 * s2, 0.3 * s2, 1.6 * s2, 0xe8e0c8, 6, x, at(x, z), z));
    g.add(mesh(new THREE.SphereGeometry(0.9 * s2, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), i % 2 ? 0x9ac040 : 0x6ab020, { emissive: 0x2a5a08 }).translateX(x).translateY(at(x, z) + 1.55 * s2).translateZ(z));
  }
}

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
  const mistMat = new THREE.MeshLambertMaterial({ color: 0xcfd8c4, transparent: true, opacity: 0.24, depthWrite: false, alphaMap: softDisc() });
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
/** A long royal-blue banner hung from the parapet: a gold rod, a gold sun, a swallowtail hem. */
function wallBanner(h: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const bh = h * 0.72;
  g.add(box(1.25, bh, 0.05, 0x2c56b0, 0, h - bh - 0.05, 0));
  for (const x of [-0.36, 0.36]) {
    const tail = cone(0.32, 0.55, 0x2c56b0, 3, x, h - bh - 0.05, 0);
    tail.rotation.z = Math.PI;
    tail.scale.z = 0.12;
    g.add(tail);
  }
  g.add(box(1.25, 0.09, 0.07, 0xd9a441, 0, h - bh * 0.3, 0));
  g.add(box(1.45, 0.1, 0.12, 0xd9a441, 0, h - 0.08, 0));
  const sun = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12).rotateX(Math.PI / 2), 0xffd35a, { emissive: 0x6a4a10 });
  sun.position.set(0, h - bh * 0.55, Math.sign(z) * 0.04);
  g.add(sun);
  g.position.z = z;
  return g;
}

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
    if (getTheme() === 'paladin') {
      // a gilt coping along the parapet, and every third stretch of wall hung with the Order's banner, both faces
      seg.add(box(len, 0.08, thick + 0.26, C.gold, 0, h + 0.29, 0));
      if (i % 3 === 1) for (const side of [-1, 1]) seg.add(wallBanner(h, side * (thick / 2 + 0.04)));
    }
    if (getTheme() === 'sorcerer') {
      // a coping that glows faintly, rune plates set in both faces, and crystals hovering over the parapet here and there
      seg.add(mesh(new THREE.BoxGeometry(len, 0.08, thick + 0.26).translate(0, h + 0.33, 0), 0xc9b8f0, { emissive: 0x3a2080 }));
      if (i % 3 === 1) for (const side of [-1, 1]) {
        const plate = mesh(new THREE.BoxGeometry(0.62, 0.9, 0.06), VIO, { emissive: VIO_EMIT });
        plate.position.set(0, h * 0.52, side * (thick / 2 + 0.03));
        seg.add(plate);
        const bar = mesh(new THREE.BoxGeometry(0.1, 0.62, 0.08), ARC, { emissive: ARC_EMIT });
        bar.position.set(0, h * 0.52, side * (thick / 2 + 0.06));
        seg.add(bar);
      }
      if (i % 5 === 2) {
        const c = floatingCrystal(0.5);
        c.position.set(0, h + 1.9, 0);
        seg.add(c);
      }
    }
    if (getTheme() === 'necromancer') {
      // skulls set on the outer merlons, staring out, and green soul-fire burning in iron baskets
      for (let k = 0; k < merlons; k += 2) {
        const sk = new THREE.Group();
        sk.add(blob(0.26, 0xe6dfcc, 0, 0, 0, 1, 0.9, 1));
        sk.add(box(0.2, 0.14, 0.14, 0xe6dfcc, 0, -0.26, 0.06));
        for (const x of [-0.09, 0.09]) sk.add(mesh(new THREE.BoxGeometry(0.09, 0.09, 0.05), 0x5cff9a, { emissive: 0x1f9a4a }).translateX(x).translateZ(0.23));
        sk.position.set(-len / 2 + (k + 0.5) * (len / merlons), h + 1.25, -thick / 2 + 0.1);
        sk.rotation.y = Math.PI;
        seg.add(sk);
      }
      if (i % 4 === 2) {
        seg.add(cyl(0.34, 0.22, 0.42, 0x2e2a33, 7, 0, h + 0.3, 0));
        const fire = cone(0.28, 0.8, 0x5cff9a, 6, 0, h + 0.7, 0);
        fire.material = mat(0x5cff9a, { emissive: 0x1f9a4a });
        seg.add(fire);
      }
    }
    if (getTheme() === 'druid') {
      // ivy grown over both faces, moss along the top, wildflowers here and there
      for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
        seg.add(blob(0.9 + (i % 3) * 0.2, k ? 0x4f7a2e : 0x5e8c34, -len / 4 + k * len / 2, h * (0.45 + ((i + k) % 3) * 0.12), side * (thick / 2 + 0.05), 1.1, 0.9, 0.25));
      }
      seg.add(box(len, 0.16, thick + 0.1, 0x5e7d32, 0, h + 0.3, 0));
      if (i % 3 === 0) for (let k = 0; k < 4; k++) seg.add(blob(0.14, [0xf2e46a, 0xf4f1e6, 0xb58cd8, 0xe88aa6][k], -len / 2 + (k + 0.5) * len / 4, h + 1.05, (k % 2 ? 1 : -1) * thick * 0.25));
    }
    if (getTheme() === 'goblin') {
      // rusty plates hammered over the holes, and a skull on a stake now and then
      if (i % 2 === 0) { const pl = box(1.1, 1.0, 0.08, i % 4 ? 0x8a4b24 : 0x5f3218, (i % 3 - 1) * 0.6, h * 0.35, -thick / 2 - 0.05); pl.rotation.z = (i % 5 - 2) * 0.08; seg.add(pl); }
      if (i % 4 === 1) {
        seg.add(cyl(0.06, 0.07, 1.6, C.timber, 4, 0, h + 0.3, 0));
        seg.add(blob(0.28, 0xe6dfcc, 0, h + 2.0, 0, 1, 0.9, 1));
        for (const x of [-0.1, 0.1]) seg.add(box(0.09, 0.09, 0.05, 0x141010, x, h + 2.0, -0.26));
      }
      if (i % 5 === 3) { const l = mesh(new THREE.IcosahedronGeometry(0.22, 0), 0x9aff3a, { emissive: 0x4a9a10 }); l.position.set(0, h + 0.8, 0); seg.add(l); }
    }
    if (getTheme() === 'goblin') {
      // sharpened stakes bristling outward from the battlements (local -z faces out of the village)
      for (let k = 0; k < merlons; k++) {
        const st = cone(0.13, 1.3, C.timber, 4, -len / 2 + (k + 0.5) * (len / merlons), h - 0.4, -thick / 2 - 0.2);
        st.rotation.x = -1.25;
        seg.add(st);
      }
    }
    seg.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    seg.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(seg);
  }
  const towers = tier === 3 ? 8 : 12;
  const torches: THREE.Object3D[] = [];
  for (let i = 0; i < towers; i++) {
    const a = start + ((end - start) * i) / (towers - 1);
    const tr = tier === 3 ? 2.3 : 2.7, th = tier === 3 ? 6 : 8;
    const tw = roundTower(tr, th, { roof: tier === 4 ? C.tile : null });
    tw.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    g.add(tw);
    // a torch on each side of the tower, facing into the village
    for (const s of [-0.5, 0.5]) {
      const ta = a + Math.PI + s;
      const tx = Math.cos(a) * R + Math.cos(ta) * (tr + 0.15), tz = Math.sin(a) * R + Math.sin(ta) * (tr + 0.15);
      g.add(box(0.12, 0.7, 0.12, C.woodDark, tx, th * 0.62, tz));
      const flame = mesh(new THREE.ConeGeometry(0.22, 0.6, 6).translate(0, 0.3, 0), 0xffb45a, { emissive: 0xff7a1a });
      flame.position.set(tx, th * 0.62 + 0.7, tz);
      flame.userData.dynamic = true;
      flame.userData.fire = true;
      flame.userData.nightOnly = true;
      g.add(flame);
      torches.push(flame);
    }
  }
  // gatehouse
  const gate = new THREE.Group();
  gate.add(box(GATE_HALF * 2 * R + 3, 2.2, thick + 0.6, C.stone, 0, h + 0.2, 0));
  gate.add(box(GATE_HALF * 2 * R, 0.5, 0.3, C.woodDark, 0, h - 0.4, thick / 2 + 0.2));
  gate.position.set(0, 0, R);
  g.add(gate);
  if (level >= 20) {
    for (let i = 0; i < towers; i++) {
      const a = start + ((end - start) * i) / (towers - 1);
      const th = tier === 3 ? 6 : 8, tr = tier === 3 ? 2.3 : 2.7;
      const pole = new THREE.Group();
      pole.add(cyl(0.06, 0.06, 2.4, C.woodDark, 5));
      const fl = box(1.2, 0.7, 0.05, color, 0.62, 1.5, 0);
      fl.userData.flag = true;
      pole.add(fl);
      pole.add(box(1.2, 0.08, 0.06, 0xe9b83a, 0.62, 1.48, 0));
      pole.add(cone(0.1, 0.25, 0xe9b83a, 5, 0, 2.4));
      pole.userData.dynamic = true;
      pole.position.set(Math.cos(a) * (R + tr * 0.4), th + tr * 2.7 * (tier === 4 ? 1 : 0.2) + 0.2, Math.sin(a) * (R + tr * 0.4));
      g.add(pole);
    }
    // the crest over the gate: a great golden shield
    const crest = new THREE.Group();
    crest.add(cyl(1.3, 1.3, 0.2, 0xe9b83a, 12).rotateX(Math.PI / 2));
    crest.add(cyl(1.0, 1.0, 0.24, color, 12).rotateX(Math.PI / 2));
    crest.add(blob(0.35, 0xe9b83a, 0, 0, 0.12));
    crest.position.set(0, h + 3.0, R + thick / 2 + 0.5);
    g.add(crest);
  }
  const baked = bake(g, { building: 'wall' });
  void torches;
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

let disc: THREE.Texture | null = null;
/** A soft round fade (white in the middle, clear at the rim), so fog and mist have no hard edge. */
function softDisc(): THREE.Texture {
  if (disc) return disc;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.55, '#aaa');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  disc = new THREE.CanvasTexture(c);
  return disc;
}
