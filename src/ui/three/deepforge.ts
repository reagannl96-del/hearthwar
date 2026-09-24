// The Deepforge: the Forgelord's hold under the burning mountain. His seat grows from a timbered mine-mouth
// with a lantern over it into a squat forge-hall under a bronze roof, then a mountain hall with a great
// stone face carved over its door, then a throne hall under a stone dome with a giant anvil and a brazier
// before it, and at last a colossal gate cut into the living rock, two dwarf-kings in stone keeping it,
// hammers planted, a ring of runes turning over it and lava falling in channels either side.
//
// Everything is dwarf-built: squat, heavy and geometric; warm granite on black basalt, bronze and copper
// roofs, dark oak, gold for the proudest things, and runes cut into the stone glowing with forge-fire.
// Everything that stands still is baked with its building (one mesh per material); the only moving parts
// are a few live flames, a turning gear or saw, the rune ring and one merged swarm of embers.

import * as THREE from 'three';
import type { BuildingId } from '../../engine/types';
import type { Built } from './buildings';
import {
  C, DW_BASALT, DW_BASALT_MD, DW_BRONZE, DW_BRONZE_DK, DW_GOLD, DW_GRANITE, DW_GRANITE_LT, DW_LAVA, DW_LAVA_E, DW_OAK, DW_RUNE, DW_RUNE_E, DW_SLAB,
  IRON_BK, bake, blob, box, cone, cyl, detailMat, forgeRune, frustum, horn, house, limb, mesh, rng, roundTower, swarm,
} from './kit';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** the dark of a doorway, a shaft or a furnace's throat */
const SOOT = 0x17110d;
const ORE = 0x55504c, ORE_GLINT = 0xd0d8e0, COAL = 0x221c1a, HAY = 0xc9a24e, STEEL = 0x9ea4aa, CLOTH = 0x9a2e22;
const FLAME_C = 0xffa845, FLAME_E = 0xc8581a, LAMP = 0xffc76a, LAMP_E = 0xc8741a, HORN_C = 0xd8ccb4, GOAT_HORN = 0x4a4038;

/** A colour a little darker (for the shaded side of a figure). */
const dk = (c: number, f = 0.75) => new THREE.Color(c).multiplyScalar(f).getHex();

/** A small bright thing that glows and casts no shadow (coals, runes, molten metal, lava). */
function glow(geo: THREE.BufferGeometry, c = DW_RUNE, e = DW_RUNE_E): THREE.Mesh {
  return new THREE.Mesh(geo, detailMat(c, { emissive: e }));
}
const lava = (geo: THREE.BufferGeometry) => glow(geo, DW_LAVA, DW_LAVA_E);
const at = (m: THREE.Object3D, x: number, y: number, z: number) => { m.position.set(x, y, z); return m; };

/** A flame that flickers (kept apart from the bake so it can move): a warm outer tongue and a bright core. */
function flame(s = 1): THREE.Group {
  const f = new THREE.Group();
  f.add(glow(new THREE.ConeGeometry(0.34 * s, 0.95 * s, 6).translate(0, 0.47 * s, 0), FLAME_C, FLAME_E));
  f.add(glow(new THREE.ConeGeometry(0.18 * s, 0.6 * s, 5).translate(0, 0.3 * s, 0), 0xffd070, 0xd08a20));
  f.userData.dynamic = true;
  f.userData.fire = true;
  return f;
}

/** A plume of smoke (or steam) rising from here. */
function smokeAt(x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.userData.dynamic = true;
  o.userData.smoke = true;
  o.position.set(x, y, z);
  return o;
}

/** A dwarf house whose gable will carry the building's sign: its rune-disc taken down to make room. */
function signed(h: THREE.Group): THREE.Group {
  for (const c of [...h.children]) if (c.userData.gableDisc) h.remove(c);
  return h;
}

/** A row of runes cut in a face (centred on x, at height y, facing +Z at depth z), `n` of them over `w`. */
function runeRow(g: THREE.Group, n: number, w: number, x: number, y: number, z: number, s = 0.36, seed = 0): void {
  for (let i = 0; i < n; i++) {
    const rn = forgeRune(s, i + seed);
    rn.position.set(x - w / 2 + ((i + 0.5) * w) / n, y, z);
    g.add(rn);
  }
}

// ---------- the pieces of the hold ----------

/** A lantern of bronze and amber glass (it burns day and night: the deeps are always dark). */
export function lantern(s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.34 * s, 0.06 * s, 0.34 * s, DW_BRONZE_DK, 0, 0, 0));
  g.add(glow(new THREE.BoxGeometry(0.24 * s, 0.32 * s, 0.24 * s).translate(0, 0.22 * s, 0), LAMP, LAMP_E));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.04 * s, 0.34 * s, 0.04 * s, DW_BRONZE_DK, x * 0.14 * s, 0.05 * s, z * 0.14 * s));
  g.add(cone(0.24 * s, 0.2 * s, DW_BRONZE, 4, 0, 0.4 * s, 0).rotateY(Math.PI / 4));
  g.add(box(0.05 * s, 0.14 * s, 0.05 * s, DW_BRONZE_DK, 0, 0.58 * s, 0));
  return g;
}

/** A fire bowl of bronze on a squat stone pillar, heaped with coals (a live flame on the grander ones). */
export function fireBowl(h: number, live = false, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(frustum(0.78 * s, 0.78 * s, 0.5 * s, 0.5 * s, 0.3 * s, DW_BASALT));
  g.add(box(0.4 * s, h, 0.4 * s, DW_GRANITE, 0, 0.3 * s, 0));
  g.add(frustum(0.42 * s, 0.42 * s, 0.7 * s, 0.7 * s, 0.22 * s, DW_GRANITE_LT, 0, h + 0.3 * s, 0));
  const top = h + 0.52 * s;
  g.add(cyl(0.66 * s, 0.36 * s, 0.34 * s, DW_BRONZE, 8, 0, top));
  g.add(cyl(0.7 * s, 0.7 * s, 0.07 * s, DW_GOLD, 8, 0, top + 0.32 * s));
  g.add(glow(new THREE.CylinderGeometry(0.6 * s, 0.6 * s, 0.08 * s, 8), 0xff8a3a, 0xb8420c).translateY(top + 0.3 * s));
  if (live) {
    const f = flame(1.15 * s);
    f.position.y = top + 0.34 * s;
    g.add(f);
  } else g.add(glow(new THREE.ConeGeometry(0.34 * s, 0.6 * s, 5).translate(0, 0.3 * s, 0), FLAME_C, FLAME_E).translateY(top + 0.34 * s));
  return g;
}

/** A great anvil of dark iron: a spreading foot, a waist, a steel face and a long horn, a rune in its flank. */
export function greatAnvil(s: number, runes = true): THREE.Group {
  const g = new THREE.Group();
  g.add(frustum(1.2 * s, 0.84 * s, 0.62 * s, 0.46 * s, 0.46 * s, IRON_BK));
  g.add(box(0.52 * s, 0.34 * s, 0.4 * s, IRON_BK, 0, 0.46 * s, 0));
  g.add(frustum(0.62 * s, 0.44 * s, 1.26 * s, 0.56 * s, 0.34 * s, IRON_BK, 0, 0.8 * s, 0));
  g.add(box(1.3 * s, 0.1 * s, 0.56 * s, STEEL, -0.02 * s, 1.14 * s, 0));
  g.add(cone(0.24 * s, 0.9 * s, IRON_BK, 6, 0.62 * s, 0.97 * s, 0).rotateZ(-Math.PI / 2));
  g.add(box(0.3 * s, 0.3 * s, 0.5 * s, IRON_BK, -0.72 * s, 0.9 * s, 0));
  if (runes) for (const z of [-1, 1]) {
    const rn = forgeRune(0.28 * s, 3);
    rn.position.set(0, 0.62 * s, z * 0.21 * s);
    if (z < 0) rn.rotation.y = Math.PI;
    g.add(rn);
  }
  return g;
}

/** A war-hammer of the kind the great smiths carry: a long haft, a block of a head with gold caps and runes. */
function bigHammer(len: number, s: number, glowing = true): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.07 * s, 0.08 * s, len, DW_OAK, 5));
  g.add(box(0.8 * s, 0.46 * s, 0.46 * s, IRON_BK, 0, len - 0.1 * s, 0));
  for (const x of [-1, 1]) g.add(box(0.1 * s, 0.5 * s, 0.5 * s, DW_GOLD, x * 0.42 * s, len - 0.12 * s, 0));
  if (glowing) {
    const rn = forgeRune(0.32 * s, 0);
    rn.position.set(0, len + 0.13 * s, 0.24 * s);
    g.add(rn);
  }
  return g;
}

/** A bolt-thrower of bronze on a turning post: a stock, two great bow-arms swept back, the string drawn to
 *  the slider and a bolt laid ready, a shield-plate with a rune in front. Faces +Z. */
export function ballista(s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.36 * s, 0.44 * s, 0.34 * s, DW_BASALT_MD, 6));
  g.add(cyl(0.12 * s, 0.15 * s, 0.62 * s, DW_BRONZE_DK, 6, 0, 0.34 * s));
  const top = 0.96 * s;
  g.add(box(0.3 * s, 0.2 * s, 2.2 * s, DW_OAK, 0, top - 0.1 * s, 0.1 * s));
  g.add(box(0.36 * s, 0.07 * s, 2.24 * s, DW_BRONZE, 0, top + 0.1 * s, 0.1 * s));
  for (const x of [-1, 1]) {
    g.add(limb(V(x * 0.14 * s, top + 0.08 * s, 1.0 * s), V(x * 1.2 * s, top + 0.1 * s, 0.52 * s), 0.08 * s, 0.05 * s, DW_BRONZE, 5));
    g.add(blob(0.08 * s, DW_GOLD, x * 1.2 * s, top + 0.1 * s, 0.52 * s));
    g.add(limb(V(x * 1.2 * s, top + 0.12 * s, 0.52 * s), V(0, top + 0.16 * s, -0.5 * s), 0.016 * s, 0.016 * s, 0x2a2420, 3));
  }
  g.add(limb(V(0, top + 0.2 * s, -0.6 * s), V(0, top + 0.2 * s, 1.42 * s), 0.04 * s, 0.04 * s, DW_OAK, 4));
  g.add(cone(0.09 * s, 0.34 * s, IRON_BK, 4, 0, top + 0.2 * s, 1.4 * s).rotateX(Math.PI / 2));
  g.add(mesh(new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 0.56 * s, 6).rotateZ(Math.PI / 2), DW_BRONZE_DK).translateY(top).translateZ(-0.86 * s));
  g.add(frustum(0.96 * s, 0.08 * s, 0.72 * s, 0.08 * s, 0.56 * s, DW_BRONZE, 0, top - 0.52 * s, 1.24 * s));
  const rn = forgeRune(0.26 * s, 1);
  rn.position.set(0, top - 0.24 * s, 1.3 * s);
  g.add(rn);
  return g;
}

/** An ore cart of iron-bound oak on little wheels, heaped with ore that glints. Along +Z. */
export function mineCart(s = 1, load = true, gold = false): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 0.1 * s, 8).rotateZ(Math.PI / 2), IRON_BK).translateX(x * 0.42 * s).translateY(0.2 * s).translateZ(z * 0.42 * s));
  g.add(frustum(0.84 * s, 1.14 * s, 1.0 * s, 1.34 * s, 0.62 * s, DW_OAK, 0, 0.24 * s, 0));
  for (const y of [0.3, 0.72]) g.add(frustum(0.88 * s + y * 0.2 * s, 1.18 * s + y * 0.2 * s, 0.9 * s + y * 0.2 * s, 1.2 * s + y * 0.2 * s, 0.08 * s, IRON_BK, 0, y * s, 0));
  g.add(box(1.04 * s, 0.06 * s, 1.38 * s, DW_BRONZE, 0, 0.84 * s, 0));
  if (load) {
    g.add(blob(0.5 * s, ORE, 0, 0.86 * s, 0, 1.0, 0.55, 1.25));
    for (let i = 0; i < 4; i++) g.add(glow(new THREE.OctahedronGeometry(0.08 * s, 0), gold && i % 2 ? DW_GOLD : ORE_GLINT, gold && i % 2 ? 0x6a4a10 : 0x3a4450).translateX((i % 2 ? 0.18 : -0.2) * s).translateY((1.0 + (i % 3) * 0.06) * s).translateZ((i - 1.5) * 0.24 * s));
  }
  return g;
}

/** A pair of iron rails on oak sleepers, `len` long along +Z from z = 0. */
export function rails(len: number, sleepers = true): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.42, 0.42]) g.add(box(0.1, 0.1, len, IRON_BK, x, 0.06, len / 2));
  if (sleepers) for (let z = 0.3; z < len; z += 0.75) g.add(box(1.2, 0.08, 0.24, DW_OAK, 0, 0.02, z));
  return g;
}

/** A heap of ore on the ground, glinting. */
function oreHeap(s: number, gold = false): THREE.Group {
  const g = new THREE.Group();
  g.add(blob(0.9 * s, ORE, 0, 0.1 * s, 0, 1.3, 0.55, 1.1));
  g.add(blob(0.5 * s, dk(ORE, 0.85), 0.35 * s, 0.35 * s, -0.2 * s, 1, 0.8, 1));
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    g.add(glow(new THREE.OctahedronGeometry(0.1 * s, 0), gold && i % 2 ? DW_GOLD : ORE_GLINT, gold && i % 2 ? 0x6a4a10 : 0x3a4450).translateX(Math.cos(a) * 0.6 * s).translateY((0.42 + (i % 2) * 0.12) * s).translateZ(Math.sin(a) * 0.45 * s));
  }
  return g;
}

/** Squared timbers for the mine's props, stacked in a crib. */
function beamStack(n: number, len = 2.6): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 3), k = i % 3;
    g.add(box(len, 0.3, 0.3, i % 4 === 1 ? 0x7a5636 : DW_OAK, 0, row * 0.31, (k - 1) * 0.34 + (row % 2) * 0.04));
  }
  for (const x of [-len * 0.38, len * 0.38]) g.add(box(0.14, 0.12, 1.2, IRON_BK, x, -0.04, 0));
  return g;
}

/** Ingots stacked crosswise: iron, or gold. */
function ingots(n: number, gold = false): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 3), k = i % 3;
    const b = frustum(0.62, 0.22, 0.5, 0.14, 0.14, gold ? DW_GOLD : 0x6e7074, 0, row * 0.14, 0);
    if (row % 2) { b.rotation.y = Math.PI / 2; b.position.set((k - 1) * 0.24, row * 0.14, 0); } else b.position.set(0, row * 0.14, (k - 1) * 0.24);
    g.add(b);
  }
  return g;
}

/** A crate of oak with bronze corners. */
function dwarfCrate(x: number, z: number, s = 1, ry = 0): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.8 * s, 0.76 * s, 0.8 * s, 0x8a6440));
  g.add(box(0.84 * s, 0.1 * s, 0.84 * s, DW_BRONZE_DK, 0, 0.68 * s, 0));
  g.add(box(0.84 * s, 0.1 * s, 0.84 * s, DW_BRONZE_DK, 0, 0.02 * s, 0));
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  return g;
}

/** A keg of ale, bound in bronze. */
function keg(x: number, z: number, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.36 * s, 0.32 * s, 0.86 * s, 0x7a5232, 8));
  for (const y of [0.16, 0.62]) g.add(cyl(0.38 * s, 0.38 * s, 0.08 * s, DW_BRONZE, 8, 0, y * s));
  g.position.set(x, 0, z);
  return g;
}

/** A standing stone of black basalt, runes glowing down its face. */
export function runeStone(h: number, k = 0): THREE.Group {
  const g = new THREE.Group();
  g.add(frustum(0.9, 0.5, 0.62, 0.36, h, DW_BASALT_MD));
  g.add(frustum(0.66, 0.4, 0.2, 0.2, 0.34, DW_BASALT_MD, 0, h, 0));
  for (let i = 0; i < Math.max(1, Math.floor(h / 0.7)); i++) {
    const rn = forgeRune(0.34, k + i);
    rn.position.set(0, h - 0.45 - i * 0.62, 0.24 - (h - 0.45 - i * 0.62) * 0.02);
    g.add(rn);
  }
  return g;
}

/** A standard of the hold: an oak pole on a stone foot, a gold crossbar and a long banner hanging from it
 *  (waving in the wind when `live`), a gold anvil on its head. */
export function holdStandard(color: number, h: number, live = true): THREE.Group {
  const g = new THREE.Group();
  g.add(frustum(0.7, 0.7, 0.46, 0.46, 0.4, DW_BASALT));
  g.add(cyl(0.07, 0.09, h, DW_OAK, 6, 0, 0.3));
  g.add(box(1.5, 0.1, 0.1, DW_GOLD, 0, h - 0.3, 0));
  const cloth = new THREE.Group();
  cloth.add(box(1.24, 2.0, 0.05, color, 0, -2.0, 0));
  for (const x of [-0.4, 0.4]) cloth.add(cone(0.22, 0.4, color, 3, x, -2.0, 0).rotateZ(Math.PI));
  cloth.add(box(1.26, 0.07, 0.07, DW_GOLD, 0, -0.5, 0.02));
  const rn = forgeRune(0.55, 4);
  rn.position.set(0, -1.1, 0.05);
  cloth.add(rn);
  cloth.position.set(0, h - 0.34, 0.08);
  if (live) {
    cloth.userData.dynamic = true;
    cloth.userData.flag = true;
  }
  g.add(cloth);
  const an = greatAnvil(0.3, false);
  an.position.set(0, h + 0.3, 0);
  g.add(an);
  return g;
}

/** A heap of dark rock: the mountain the hold is cut into. Each entry: x, z, radius, height, tone. */
function crag(g: THREE.Group, pts: [number, number, number, number, number][], r: () => number): void {
  for (const [x, z, s, h, k] of pts) {
    const m = blob(s, k ? DW_BASALT : DW_BASALT_MD, x, h * 0.3, z, 1.12, h / s, 1.0);
    m.rotation.y = r() * 3;
    g.add(m);
  }
}

/** A great door sunk in a stepped portal (its outer face at z): bronze-bound leaves with a seam of fire
 *  between them, stepped jambs, a trapezoid lintel over every step and a rune over it all. */
function portal(g: THREE.Group, z: number, w: number, h: number, steps = 2, x = 0): void {
  g.add(box(w, h, 0.3, DW_BRONZE_DK, x, 0, z - 0.5));
  g.add(lava(new THREE.BoxGeometry(0.1, h * 0.94, 0.06)).translateX(x).translateY(h * 0.47).translateZ(z - 0.33));
  for (const y of [0.22, 0.52, 0.82]) g.add(box(w, 0.13, 0.08, DW_BRONZE, x, h * y, z - 0.34));
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) g.add(blob(0.07, DW_GOLD, x + sx * w * 0.25, h * (0.3 + i * 0.22), z - 0.31));
  for (let k = 0; k < steps; k++) {
    const ww = w + 0.36 + k * 0.72, hh = h + 0.12 + k * 0.46, zz = z - 0.46 + ((k + 1) * 0.46) / steps;
    for (const sx of [-1, 1]) g.add(box(0.36, hh, 0.46, k % 2 ? DW_GRANITE : DW_GRANITE_LT, x + sx * (ww / 2), 0, zz - 0.23));
    g.add(frustum(ww + 0.36, 0.46, ww + 0.9, 0.46, 0.5, k % 2 ? DW_GRANITE : DW_GRANITE_LT, x, hh, zz - 0.23));
  }
  const rn = forgeRune(0.5, 2);
  rn.position.set(x, h + 0.12 + (steps - 1) * 0.46 + 0.25, z + 0.02);
  g.add(rn);
}

/** A squat square tower of dressed stone, battered, a band of corbels and a bronze pyramid on top. */
function bastion(w: number, h: number, capped = true): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w + 0.4, 0.5, w + 0.4, DW_BASALT));
  g.add(frustum(w + 0.1, w + 0.1, w - 0.3, w - 0.3, h, DW_GRANITE, 0, 0.5, 0));
  g.add(box(w + 0.2, 0.36, w + 0.2, DW_GRANITE_LT, 0, h + 0.3, 0));
  for (const z of [1, -1]) for (const x of [-1, 0, 1]) g.add(box(0.3, 0.3, 0.2, DW_GRANITE_LT, x * (w / 2 - 0.4), h + 0.02, z * (w / 2 - 0.1)));
  const win = box(0.3, 0.6, 0.1, C.window, 0, h * 0.62, (w - 0.25) / 2 + 0.02);
  win.userData.window = true;
  g.add(win);
  if (capped) {
    g.add(cone((w + 0.3) * 0.72, w * 0.6, DW_BRONZE, 4, 0, h + 0.66).rotateY(Math.PI / 4));
    g.add(blob(0.16, DW_GOLD, 0, h + 0.7 + w * 0.6, 0));
  } else for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(box(0.5, 0.55, 0.5, DW_GRANITE_LT, x * (w / 2 - 0.1), h + 0.66, z * (w / 2 - 0.1)));
  return g;
}

/** A dome of dressed stone on an eight-sided drum, runes round the drum, bronze ribs, a lantern of bronze and a gold finial. */
function stoneDome(r: number, drum: number): THREE.Group {
  const g = new THREE.Group();
  const oct = (m: THREE.Mesh) => { m.rotation.y = Math.PI / 12; return m; };
  g.add(oct(cyl(r * 1.06, r * 1.1, drum, DW_GRANITE_LT, 12)));
  g.add(oct(cyl(r * 1.13, r * 1.13, 0.26, DW_BASALT_MD, 12, 0, drum - 0.2)));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
    const rn = forgeRune(Math.min(0.5, drum * 0.36), i);
    rn.position.set(Math.cos(a) * r * 1.07, drum * 0.45, Math.sin(a) * r * 1.07);
    rn.rotation.y = Math.PI / 2 - a;
    g.add(rn);
  }
  g.add(mesh(new THREE.SphereGeometry(r, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), DW_GRANITE).translateY(drum));
  for (let i = 0; i < 4; i++) {
    const rib = mesh(new THREE.TorusGeometry(r + 0.04, 0.1, 4, 14, Math.PI), DW_BRONZE_DK);
    rib.rotation.y = (i / 4) * Math.PI;
    rib.position.y = drum;
    g.add(rib);
  }
  const ly = drum + r - 0.2;
  g.add(cyl(r * 0.22, r * 0.26, r * 0.34, DW_BRONZE, 8, 0, ly));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const w = box(0.16, r * 0.18, 0.08, C.window, Math.cos(a) * r * 0.235, ly + r * 0.08, Math.sin(a) * r * 0.235);
    w.rotation.y = Math.PI / 2 - a;
    w.userData.window = true;
    g.add(w);
  }
  g.add(cone(r * 0.3, r * 0.3, DW_BRONZE_DK, 8, 0, ly + r * 0.34));
  g.add(blob(0.2, DW_GOLD, 0, ly + r * 0.66, 0));
  g.add(cone(0.08, 0.6, DW_GOLD, 5, 0, ly + r * 0.7, 0));
  return g;
}

/**
 * A dwarf-king in stone (or bronze), facing +Z: broad as he is tall, a crowned helm, a beard in braids to
 * his belt, a cloak behind, both hands resting on the pommel of a great hammer planted head-down before him.
 * About 6.4 tall at s = 1.
 */
export function kingStatue(s: number, body = DW_GRANITE_LT, shade = DW_GRANITE, trim = DW_GOLD, raised = false): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-1, 1]) g.add(box(0.62 * s, 0.46 * s, 0.9 * s, shade, x * 0.4 * s, 0, 0.08 * s));
  g.add(frustum(2.0 * s, 1.36 * s, 1.56 * s, 1.14 * s, 1.36 * s, shade, 0, 0.42 * s, 0));
  g.add(frustum(1.56 * s, 1.14 * s, 2.3 * s, 1.34 * s, 1.84 * s, body, 0, 1.72 * s, 0));
  g.add(box(1.7 * s, 0.32 * s, 1.24 * s, trim, 0, 1.66 * s, 0));
  g.add(box(0.46 * s, 0.4 * s, 0.1 * s, trim, 0, 1.62 * s, 0.62 * s));
  for (const x of [-1, 1]) {
    g.add(frustum(0.9 * s, 1.0 * s, 0.6 * s, 0.7 * s, 0.5 * s, shade, x * 1.12 * s, 3.26 * s, 0));
    g.add(box(0.9 * s, 0.1 * s, 1.02 * s, trim, x * 1.12 * s, 3.24 * s, 0));
  }
  if (!raised) {
    // arms coming down and forward to the pommel of the hammer, its head on the ground before him
    for (const x of [-1, 1]) {
      g.add(limb(V(x * 1.14 * s, 3.3 * s, 0.05 * s), V(x * 0.9 * s, 2.46 * s, 0.56 * s), 0.3 * s, 0.26 * s, body, 6));
      g.add(limb(V(x * 0.9 * s, 2.46 * s, 0.56 * s), V(x * 0.22 * s, 2.72 * s, 1.08 * s), 0.25 * s, 0.22 * s, body, 6));
      g.add(blob(0.24 * s, shade, x * 0.2 * s, 2.74 * s, 1.1 * s));
    }
    g.add(cyl(0.11 * s, 0.13 * s, 2.7 * s, shade, 6, 0, 0.3 * s, 1.14 * s));
    g.add(blob(0.2 * s, trim, 0, 3.02 * s, 1.14 * s));
    g.add(box(1.3 * s, 0.72 * s, 0.76 * s, shade, 0, 0, 1.14 * s));
    for (const x of [-1, 1]) g.add(box(0.12 * s, 0.78 * s, 0.8 * s, trim, x * 0.66 * s, 0, 1.14 * s));
    const hr = forgeRune(0.5 * s, 0);
    hr.position.set(0, 0.38 * s, 1.54 * s);
    g.add(hr);
  } else {
    // the left fist on his belt, the right raising the rune hammer to the sky, runes blazing in its head
    g.add(limb(V(-1.14 * s, 3.3 * s, 0.05 * s), V(-1.36 * s, 2.44 * s, 0.3 * s), 0.3 * s, 0.26 * s, body, 6));
    g.add(limb(V(-1.36 * s, 2.44 * s, 0.3 * s), V(-0.72 * s, 1.9 * s, 0.62 * s), 0.25 * s, 0.22 * s, body, 6));
    g.add(blob(0.24 * s, shade, -0.66 * s, 1.88 * s, 0.66 * s));
    g.add(limb(V(1.14 * s, 3.3 * s, 0.05 * s), V(1.5 * s, 4.1 * s, 0.25 * s), 0.3 * s, 0.26 * s, body, 6));
    g.add(limb(V(1.5 * s, 4.1 * s, 0.25 * s), V(1.3 * s, 4.95 * s, 0.35 * s), 0.25 * s, 0.22 * s, body, 6));
    g.add(blob(0.26 * s, shade, 1.3 * s, 5.0 * s, 0.35 * s));
    g.add(cyl(0.11 * s, 0.13 * s, 2.6 * s, shade, 6, 1.3 * s, 3.9 * s, 0.35 * s));
    g.add(box(1.4 * s, 0.8 * s, 0.8 * s, shade, 1.3 * s, 6.3 * s, 0.35 * s));
    for (const x of [-1, 1]) g.add(box(0.14 * s, 0.86 * s, 0.86 * s, trim, 1.3 * s + x * 0.72 * s, 6.27 * s, 0.35 * s));
    for (const z of [-1, 1]) {
      const hr = forgeRune(0.62 * s, 0);
      hr.position.set(1.3 * s, 6.7 * s, 0.35 * s + z * 0.42 * s);
      if (z < 0) hr.rotation.y = Math.PI;
      g.add(hr);
    }
  }
  // the cloak behind, falling to the plinth
  g.add(frustum(2.2 * s, 0.24 * s, 2.0 * s, 0.24 * s, 3.1 * s, shade, 0, 0.36 * s, -0.66 * s));
  // the head: a crowned helm, a heavy brow, embers for eyes, a great nose
  g.add(box(0.84 * s, 0.86 * s, 0.84 * s, body, 0, 3.5 * s, 0.1 * s));
  g.add(frustum(1.0 * s, 1.0 * s, 0.7 * s, 0.7 * s, 0.5 * s, shade, 0, 4.16 * s, 0.1 * s));
  g.add(cyl(0.58 * s, 0.6 * s, 0.24 * s, trim, 8, 0, 4.12 * s, 0.1 * s));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    g.add(cone(0.12 * s, 0.42 * s, trim, 4, Math.cos(a) * 0.5 * s, 4.34 * s, 0.1 * s + Math.sin(a) * 0.5 * s));
  }
  g.add(box(0.96 * s, 0.22 * s, 0.4 * s, shade, 0, 3.98 * s, 0.4 * s));
  for (const x of [-1, 1]) g.add(glow(new THREE.BoxGeometry(0.16 * s, 0.08 * s, 0.06 * s)).translateX(x * 0.2 * s).translateY(3.9 * s).translateZ(0.54 * s));
  g.add(frustum(0.3 * s, 0.34 * s, 0.18 * s, 0.26 * s, 0.4 * s, body, 0, 3.52 * s, 0.56 * s));
  // the beard: broad at the jaw, narrowing to two braids ringed in gold
  g.add(frustum(0.66 * s, 0.4 * s, 1.1 * s, 0.5 * s, 1.5 * s, body, 0, 2.04 * s, 0.54 * s));
  g.add(box(0.9 * s, 0.14 * s, 0.2 * s, body, 0, 3.4 * s, 0.66 * s));
  for (const x of [-1, 1]) {
    g.add(box(0.2 * s, 0.7 * s, 0.2 * s, body, x * 0.2 * s, 1.44 * s, 0.66 * s));
    g.add(box(0.26 * s, 0.14 * s, 0.26 * s, trim, x * 0.2 * s, 1.7 * s, 0.66 * s));
  }
  return g;
}

/** A dwarf's face carved in the rock (facing +Z, centred on its nose): a helm, a scowling brow, embers for
 *  eyes, a great nose and moustache, and a beard in stone braids tapering down. Some 4.4 high at s = 1. */
function carvedFace(s: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.9 * s, 1.5 * s, 0.6 * s, DW_GRANITE_LT, 0, -0.55 * s, 0));
  g.add(frustum(2.1 * s, 0.9 * s, 1.4 * s, 0.7 * s, 0.8 * s, DW_BRONZE, 0, 1.2 * s, -0.06 * s));
  g.add(frustum(1.3 * s, 0.6 * s, 0.4 * s, 0.3 * s, 0.4 * s, DW_BRONZE_DK, 0, 2.0 * s, -0.06 * s));
  g.add(box(2.2 * s, 0.34 * s, 0.9 * s, DW_GOLD, 0, 0.98 * s, 0.02 * s));
  for (const x of [-1, 1]) g.add(box(0.3 * s, 0.9 * s, 0.5 * s, DW_BRONZE, x * 1.0 * s, 0.2 * s, 0.1 * s));
  for (const x of [-1, 1]) {
    const brow = box(0.92 * s, 0.26 * s, 0.4 * s, DW_GRANITE_LT, x * 0.44 * s, 0.62 * s, 0.32 * s);
    brow.rotation.z = x * -0.22;
    g.add(brow);
    g.add(box(0.4 * s, 0.24 * s, 0.1 * s, SOOT, x * 0.42 * s, 0.42 * s, 0.3 * s));
    g.add(glow(new THREE.BoxGeometry(0.2 * s, 0.1 * s, 0.06 * s)).translateX(x * 0.42 * s).translateY(0.52 * s).translateZ(0.36 * s));
    const mo = box(0.8 * s, 0.2 * s, 0.34 * s, DW_GRANITE_LT, x * 0.44 * s, -0.24 * s, 0.4 * s);
    mo.rotation.z = x * 0.28;
    g.add(mo);
  }
  g.add(frustum(0.5 * s, 0.56 * s, 0.26 * s, 0.34 * s, 0.8 * s, DW_GRANITE_LT, 0, -0.18 * s, 0.42 * s));
  g.add(frustum(0.86 * s, 0.5 * s, 1.9 * s, 0.66 * s, 1.9 * s, DW_GRANITE_LT, 0, -2.42 * s, 0.14 * s));
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.34 * s;
    g.add(box(0.07 * s, 1.5 * s, 0.1 * s, DW_BASALT_MD, x, -2.2 * s + Math.abs(i - 2) * 0.12 * s, 0.46 * s - Math.abs(i - 2) * 0.03 * s));
  }
  for (const x of [-0.26, 0.26]) g.add(box(0.3 * s, 0.16 * s, 0.4 * s, DW_GOLD, x * s, -2.0 * s, 0.4 * s));
  return g;
}

// ---------- the folk of the hold ----------

const BEARDS = [0x7a4a2a, 0xa8522a, 0xbdb5aa, 0xcf9f52, 0x3a2e28, 0x8a3c20];
const SKINS = [0xd9a07a, 0xc98e68, 0xe2b08c];
/** what the hold's folk wear: rust, slate, loden, heather, moss and ochre */
export const DWARF_KIT = [0x8a3a2a, 0x3e5868, 0x6a5a3a, 0x5a4868, 0x4a5a3c, 0x8a5c2a];
let folkCount = 0;

interface FolkOpts { head?: boolean; beard?: number; long?: boolean; skin?: number }

/**
 * A dwarf of the hold: short and broad as a door, a barrel of a body belted at the waist, a big nose and a beard
 * down the chest (brown, red, grey, flaxen or black), braided and ringed with gold on some; an iron cap, a hood,
 * a miner's leather cap with its lamp lit, or a bald pate fringed with hair.
 */
export function dwarfFolk(g: THREE.Group, tunic: number, k = folkCount++, o: FolkOpts = {}): void {
  // (merged into one mesh per material: a village of them costs few draws)
  const p = new THREE.Group();
  folkParts(p, tunic, k, o);
  g.add(bake(p));
}

/** Merge a figure's body into one mesh per material, leaving apart what it holds out in its right hand (anything at
 *  x > 0.25), so a battle can still swing it. */
function mergeBody(g: THREE.Group): THREE.Group {
  const body = new THREE.Group();
  for (const c of [...g.children]) if (c.position.x <= 0.25 && !c.userData.dynamic) body.add(c);
  g.add(bake(body));
  for (const c of g.children) c.castShadow = true;
  return g;
}

function folkParts(g: THREE.Group, tunic: number, k: number, o: FolkOpts): void {
  const beard = o.beard ?? BEARDS[k % BEARDS.length], skin = o.skin ?? SKINS[k % SKINS.length];
  g.add(box(0.42, 0.28, 0.26, 0x2e2218, 0, 0, 0));
  g.add(cyl(0.3, 0.33, 0.5, tunic, 7, 0, 0.24));
  g.add(cyl(0.335, 0.335, 0.09, 0x3a2618, 7, 0, 0.34));
  g.add(box(0.12, 0.1, 0.04, DW_GOLD, 0, 0.34, 0.34));
  g.add(blob(0.2, tunic, 0, 0.76, -0.02, 1.8, 0.6, 1.15));
  g.add(blob(0.19, skin, 0, 0.97, 0.03, 1, 0.95, 1));
  g.add(blob(0.07, dk(skin, 0.86), 0, 0.95, 0.22));
  for (const x of [-0.075, 0.075]) g.add(box(0.05, 0.035, 0.02, 0x1a1210, x, 0.995, 0.205));
  const bottom = o.long ? 0.1 : 0.42;
  g.add(frustum(o.long ? 0.1 : 0.14, 0.1, 0.34, 0.16, 0.92 - bottom, beard, 0, bottom, 0.31));
  g.add(box(0.32, 0.06, 0.08, beard, 0, 0.89, 0.27));
  if (k % 2 === 0 || o.long) for (const x of [-0.09, 0.09]) {
    g.add(box(0.05, 0.22, 0.05, beard, x, bottom - 0.14, 0.34));
    g.add(box(0.07, 0.05, 0.07, DW_GOLD, x, bottom - 0.1, 0.34));
  }
  if (o.head === false) return;
  switch (k % 4) {
    case 0:
      g.add(cyl(0.19, 0.215, 0.14, IRON_BK, 7, 0, 1.03));
      g.add(box(0.05, 0.08, 0.36, IRON_BK, 0, 1.15, 0));
      break;
    case 1:
      g.add(blob(0.22, dk(tunic, 0.85), 0, 1.03, -0.05, 1, 1.05, 1));
      break;
    case 2:
      g.add(cyl(0.2, 0.21, 0.1, 0x5a4030, 7, 0, 1.06));
      g.add(glow(new THREE.BoxGeometry(0.1, 0.08, 0.06), LAMP, LAMP_E).translateY(1.12).translateZ(0.2));
      break;
    default:
      g.add(blob(0.1, beard, -0.15, 1.0, -0.04), blob(0.1, beard, 0.15, 1.0, -0.04), blob(0.12, beard, 0, 0.98, -0.14));
  }
}

/** A dwarf helm: a round bowl on a rim, cheek-plates and a nose-guard; a crest, or a full face-plate. */
function dwarfHelm(g: THREE.Group, c: number, crest = false, face = false, y = 0): void {
  g.add(cyl(0.2, 0.225, 0.14, c, 8, 0, y + 1.03));
  g.add(blob(0.2, c, 0, y + 1.15, 0, 1, 0.55, 1));
  g.add(cyl(0.235, 0.235, 0.05, c === DW_BRONZE ? DW_GOLD : DW_BRONZE, 8, 0, y + 1.03));
  for (const x of [-1, 1]) g.add(box(0.06, 0.24, 0.16, c, x * 0.2, y + 0.84, 0.05));
  if (face) {
    g.add(box(0.34, 0.24, 0.05, c, 0, y + 0.88, 0.2));
    g.add(box(0.26, 0.04, 0.03, DW_GOLD, 0, y + 0.99, 0.22));
  } else g.add(box(0.05, 0.16, 0.04, c, 0, y + 0.96, 0.225));
  if (crest) g.add(box(0.06, 0.14, 0.44, crest === true ? DW_GOLD : c, 0, y + 1.18, 0));
}

/** A round shield of bronze with a gold rim and boss (a rune on it), turned to face front-left. */
function roundShield(r: number, x: number, y: number, z: number, face = -0.45): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r, 0.07, 10).rotateX(Math.PI / 2), DW_BRONZE));
  g.add(mesh(new THREE.TorusGeometry(r, 0.04, 4, 10), DW_GOLD));
  g.add(blob(r * 0.24, DW_GOLD, 0, 0, 0.05, 1, 1, 0.6));
  g.position.set(x, y, z);
  g.rotation.y = face;
  return g;
}

/** A crossbow held level at the chest (its group sits in the right hand). */
function crossbow(s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.08 * s, 0.08 * s, 0.72 * s, DW_OAK, 0, 0, 0.1 * s));
  g.add(box(0.8 * s, 0.05 * s, 0.07 * s, IRON_BK, -0.02 * s, 0.03 * s, 0.42 * s));
  for (const x of [-1, 1]) g.add(limb(V(x * 0.4 * s - 0.02 * s, 0.05 * s, 0.42 * s), V(0, 0.06 * s, 0.04 * s), 0.01, 0.01, 0x2a2420, 3));
  g.add(box(0.03 * s, 0.03 * s, 0.5 * s, 0xd8c8a0, 0, 0.08 * s, 0.3 * s));
  return g;
}

/**
 * A soldier of the hold: shieldbearers behind great round shields of bronze, ironbreakers in black iron plate
 * with face-plated helms and war-hammers, longbeards with beards to their boots and a great axe on the shoulder,
 * quarrellers with crossbows, and tunnel scouts hooded, lantern in hand and a pick on the back.
 */
export function dwarfSoldier(kind: string): THREE.Group {
  const g = new THREE.Group();
  const k = folkCount++;
  switch (kind) {
    case 'spear': {
      dwarfFolk(g, DWARF_KIT[1], k, { head: false });
      dwarfHelm(g, DW_BRONZE, true);
      g.add(roundShield(0.44, -0.2, 0.55, 0.36));
      g.add(cyl(0.03, 0.035, 2.05, DW_OAK, 5, 0.34, 0.05, 0.12));
      g.add(cone(0.08, 0.32, STEEL, 4, 0.34, 2.1, 0.12));
      break;
    }
    case 'sword': {
      dwarfFolk(g, 0x3a3634, k, { head: false });
      dwarfHelm(g, IRON_BK, true, true);
      for (const x of [-1, 1]) g.add(blob(0.15, IRON_BK, x * 0.33, 0.8, 0, 1.2, 0.8, 1.1));
      g.add(cyl(0.315, 0.345, 0.26, IRON_BK, 7, 0, 0.4));
      const sh = new THREE.Group();
      sh.add(box(0.08, 0.62, 0.52, IRON_BK, 0, 0, 0), box(0.1, 0.66, 0.06, DW_BRONZE, 0, -0.02, 0.26), box(0.1, 0.66, 0.06, DW_BRONZE, 0, -0.02, -0.26));
      const rn = forgeRune(0.3, 2);
      rn.rotation.y = -Math.PI / 2;
      rn.position.set(-0.05, 0.3, 0);
      sh.add(rn);
      sh.position.set(-0.36, 0.34, 0.05);
      g.add(sh);
      const hm = new THREE.Group();
      hm.add(box(0.05, 0.78, 0.05, DW_OAK, 0, 0, 0));
      hm.add(box(0.3, 0.18, 0.18, IRON_BK, 0, 0.72, 0), box(0.06, 0.2, 0.2, DW_GOLD, 0.16, 0.71, 0));
      hm.position.set(0.38, 0.46, 0.16);
      hm.rotation.set(-0.3, 0, -0.12);
      g.add(hm);
      break;
    }
    case 'axe': {
      dwarfFolk(g, DWARF_KIT[0], k, { head: false, beard: 0xc4bcb0, long: true });
      dwarfHelm(g, DW_BRONZE, false);
      const handle = box(0.06, 1.2, 0.06, DW_OAK);
      handle.position.set(0.32, 0.62, -0.08);
      handle.rotation.x = -0.55;
      g.add(handle);
      for (const s of [-1, 1]) {
        const geo = new THREE.CylinderGeometry(0.26, 0.26, 0.05, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX((s * Math.PI) / 2);
        geo.scale(1, 1.2, 1);
        geo.translate(0, 0.02, s * 0.03);
        const head = mesh(geo, STEEL);
        head.position.set(0.32, 1.52, -0.66);
        head.rotation.x = -0.55;
        g.add(head);
      }
      g.add(box(0.1, 0.12, 0.12, DW_GOLD, 0.32, 1.52, -0.62).rotateX(-0.55));
      break;
    }
    case 'archer': {
      dwarfFolk(g, DWARF_KIT[2], k, { head: false });
      g.add(cyl(0.2, 0.22, 0.12, 0x5a4030, 7, 0, 1.02), blob(0.2, 0x5a4030, 0, 1.1, 0, 1, 0.5, 1));
      const cb = crossbow();
      cb.position.set(0.3, 0.6, 0.18);
      g.add(cb);
      g.add(box(0.14, 0.42, 0.14, 0x5a3a24, -0.14, 0.4, -0.3));
      for (let i = 0; i < 3; i++) g.add(box(0.03, 0.12, 0.03, 0xd8c8a0, -0.18 + i * 0.04, 0.86, -0.3));
      break;
    }
    case 'scout': {
      dwarfFolk(g, 0x3a3432, k, { head: false });
      g.add(blob(0.23, 0x2e2a28, 0, 1.03, -0.05, 1, 1.05, 1));
      g.add(box(0.5, 0.62, 0.06, 0x2e2a28, 0, 0.28, -0.26));
      g.add(cyl(0.025, 0.03, 0.9, DW_OAK, 4, 0.34, 0.4, 0.14));
      const l = lantern(0.8);
      l.position.set(0.34, 0.7, 0.3);
      g.add(l);
      const pick = new THREE.Group();
      pick.add(box(0.05, 0.9, 0.05, DW_OAK), box(0.6, 0.07, 0.07, IRON_BK, 0, 0.82, 0));
      pick.position.set(-0.06, 0.25, -0.34);
      pick.rotation.z = 0.5;
      g.add(pick);
      break;
    }
    default:
      dwarfFolk(g, DWARF_KIT[k % DWARF_KIT.length], k);
  }
  return mergeBody(g);
}

/** A mountain goat, long along +X like a horse: stocky and shaggy, a tuft of beard, horns sweeping back. */
export function goat(color = 0x9a8a72, s = 1): THREE.Group {
  const g = new THREE.Group();
  const d = dk(color, 0.72);
  for (const [x, z] of [[-0.42, 0.16], [0.42, 0.16], [-0.42, -0.16], [0.42, -0.16]]) g.add(box(0.13 * s, 0.62 * s, 0.13 * s, d, x * s, 0, z * s));
  g.add(box(1.06 * s, 0.5 * s, 0.48 * s, color, 0, 0.56 * s, 0));
  g.add(box(0.92 * s, 0.18 * s, 0.52 * s, d, 0, 0.5 * s, 0));
  const neck = box(0.26 * s, 0.46 * s, 0.28 * s, color, 0.6 * s, 0.82 * s, 0);
  neck.rotation.z = -0.5;
  g.add(neck);
  g.add(box(0.38 * s, 0.24 * s, 0.26 * s, color, 0.86 * s, 1.1 * s, 0));
  g.add(box(0.2 * s, 0.18 * s, 0.2 * s, d, 1.06 * s, 1.04 * s, 0));
  g.add(cone(0.06 * s, 0.22 * s, d, 4, 1.0 * s, 0.84 * s, 0));
  for (const z of [-1, 1]) {
    g.add(horn(V(0.8 * s, 1.2 * s, z * 0.08 * s), V(0.66 * s, 1.52 * s, z * 0.2 * s), V(0.42 * s, 1.32 * s, z * 0.26 * s), 0.055 * s, GOAT_HORN, 3));
    const ear = box(0.16 * s, 0.05 * s, 0.08 * s, color, 0.78 * s, 1.14 * s, z * 0.18 * s);
    ear.rotation.x = z * 0.4;
    g.add(ear);
  }
  const tail = box(0.1 * s, 0.18 * s, 0.1 * s, d, -0.56 * s, 0.84 * s, 0);
  tail.rotation.z = 0.4;
  g.add(tail);
  return g;
}

/** A war-ram: a great goat-ram of the mountains, horns curling round its ears, barded in bronze plates. Along +X. */
export function warRam(barded = true): THREE.Group {
  const g = goat(0x6e6254, 1.24);
  for (const z of [-1, 1]) {
    g.add(horn(V(0.98, 1.44, z * 0.12), V(1.0, 1.62, z * 0.46), V(0.76, 1.44, z * 0.5), 0.1, HORN_C, 4));
    g.add(horn(V(0.76, 1.44, z * 0.5), V(0.62, 1.1, z * 0.52), V(0.98, 1.08, z * 0.42), 0.07, HORN_C, 3));
  }
  if (barded) {
    g.add(box(1.0, 0.44, 0.66, DW_BRONZE, -0.04, 0.62, 0));
    g.add(box(1.02, 0.07, 0.68, DW_GOLD, -0.04, 1.03, 0));
    g.add(box(0.3, 0.26, 0.36, DW_BRONZE, 1.1, 1.3, 0));
    const rn = forgeRune(0.3, 1);
    rn.rotation.y = Math.PI / 2;
    rn.position.set(-0.04, 0.84, 0.34);
    g.add(rn);
  }
  return g;
}

/** Goat riders with spears, goat crossbowmen, and anvil knights in iron plate on barded war-rams, hammers aloft. */
export function dwarfRider(kind: string): THREE.Group {
  const g = new THREE.Group();
  const heavy = kind === 'heavy';
  const mount = heavy ? warRam() : goat(kind === 'marcher' ? 0x6a5c4c : 0x9a8a72, 1.08);
  mount.rotation.y = -Math.PI / 2;
  g.add(mount);
  const seat = heavy ? 1.34 : 1.04;
  g.add(box(0.5, 0.12, 0.62, heavy ? DW_BRONZE_DK : 0x6a3a24, 0, seat - 0.06, 0));
  const man = new THREE.Group();
  dwarfFolk(man, heavy ? 0x3a3634 : kind === 'marcher' ? DWARF_KIT[2] : DWARF_KIT[0], folkCount++, { head: false });
  if (heavy) {
    dwarfHelm(man, IRON_BK, true, true);
    for (const x of [-1, 1]) man.add(blob(0.15, IRON_BK, x * 0.33, 0.8, 0, 1.2, 0.8, 1.1));
  } else dwarfHelm(man, DW_BRONZE, kind !== 'marcher');
  man.scale.setScalar(0.92);
  man.position.set(0, seat, -0.08);
  g.add(man);
  if (kind === 'marcher') {
    const cb = crossbow(0.9);
    cb.position.set(0.3, seat + 0.56, 0.1);
    g.add(cb);
  } else if (heavy) {
    const hm = bigHammer(1.6, 0.5, true);
    hm.position.set(0.36, seat + 0.2, 0.05);
    g.add(hm);
  } else {
    g.add(cyl(0.03, 0.035, 2.2, DW_OAK, 5, 0.34, seat + 0.1, 0.05));
    g.add(cone(0.07, 0.3, STEEL, 4, 0.34, seat + 2.3, 0.05));
    g.add(roundShield(0.34, -0.32, seat + 0.5, 0.05, -1.2));
  }
  return mergeBody(g);
}

/** The hold's trader: a mine cart piled with ore, ingots and a strongbox, pushed along by a dwarf leaning into it. */
export function mineCartTrader(): THREE.Group {
  const g = new THREE.Group();
  const c = mineCart(1.1, true, true);
  c.position.z = 0.35;
  g.add(c);
  const ch = new THREE.Group();
  ch.add(box(0.5, 0.3, 0.36, 0x6a4428), box(0.52, 0.06, 0.38, DW_GOLD, 0, 0.3, 0));
  ch.position.set(0.1, 1.08, 0.1);
  g.add(ch);
  const man = new THREE.Group();
  dwarfFolk(man, DWARF_KIT[5], folkCount++);
  for (const x of [-1, 1]) {
    const arm = box(0.09, 0.42, 0.09, DWARF_KIT[5], x * 0.22, 0.52, 0.18);
    arm.rotation.x = -1.1;
    man.add(arm);
  }
  man.rotation.x = 0.22;
  man.position.set(0, 0, -0.78);
  g.add(man);
  return mergeBody(g);
}

/**
 * The Forgelord: broad as a barrel and a head taller than his folk, in bronze plate banded with gold, great
 * pauldrons and a cloak of rune-red, a gold crown on his helm, a fiery beard braided to his belt, and in his
 * fist the rune hammer, runes glowing in its head.
 */
export function forgelord(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const skin = 0xd9a07a, beard = 0xb8522a;
  body.add(box(0.6, 0.34, 0.36, 0x2e2218, 0, 0, 0));
  body.add(frustum(0.9, 0.64, 0.7, 0.54, 0.38, IRON_BK, 0, 0.24, 0));
  body.add(cyl(0.44, 0.46, 0.66, DW_BRONZE, 9, 0, 0.5));
  body.add(cyl(0.47, 0.47, 0.08, DW_GOLD, 9, 0, 0.98));
  body.add(cyl(0.475, 0.475, 0.12, 0x3a2618, 9, 0, 0.56));
  body.add(box(0.2, 0.16, 0.05, DW_GOLD, 0, 0.54, 0.47));
  body.add(glow(new THREE.OctahedronGeometry(0.06, 0), 0xff5a2a, 0xb82a0a).translateY(0.62).translateZ(0.5));
  for (const x of [-1, 1]) {
    body.add(blob(0.26, DW_BRONZE, x * 0.5, 1.08, 0, 1.2, 0.8, 1.1));
    body.add(cyl(0.28, 0.3, 0.06, DW_GOLD, 8, x * 0.5, 0.94, 0));
  }
  // his left fist on his hip
  body.add(limb(V(-0.52, 1.0, 0), V(-0.56, 0.62, 0.1), 0.12, 0.1, DW_BRONZE, 5), blob(0.1, skin, -0.5, 0.6, 0.14));
  body.add(blob(0.25, skin, 0, 1.36, 0.04, 1, 0.95, 1));
  body.add(blob(0.09, dk(skin, 0.86), 0, 1.33, 0.28));
  for (const x of [-0.09, 0.09]) body.add(box(0.06, 0.04, 0.02, 0x1a1210, x, 1.39, 0.265));
  body.add(box(0.44, 0.1, 0.2, DW_BRONZE, 0, 1.52, 0.1));
  body.add(cyl(0.26, 0.27, 0.12, DW_GOLD, 9, 0, 1.5));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
    body.add(cone(0.05, i === 0 ? 0.3 : 0.2, DW_GOLD, 4, Math.cos(a) * 0.24, 1.6, Math.sin(a) * 0.24));
  }
  body.add(glow(new THREE.OctahedronGeometry(0.06, 0), 0xff5a2a, 0xb82a0a).translateY(1.56).translateZ(0.27));
  // the beard, fiery red, to the belt; braids ringed in gold
  body.add(frustum(0.2, 0.14, 0.5, 0.2, 0.74, beard, 0, 0.6, 0.44));
  body.add(box(0.44, 0.08, 0.1, beard, 0, 1.28, 0.38));
  for (const x of [-0.12, 0.12]) {
    body.add(box(0.07, 0.3, 0.07, beard, x, 0.36, 0.48));
    body.add(box(0.1, 0.07, 0.1, DW_GOLD, x, 0.42, 0.48));
  }
  const cape = box(0.92, 1.18, 0.06, CLOTH, 0, 0.18, -0.44);
  cape.rotation.x = 0.08;
  body.add(cape);
  g.add(body);
  // the rune hammer, upright at his side
  const hm = bigHammer(1.9, 0.62, true);
  hm.position.set(0.62, 0, 0.14);
  g.add(hm);
  g.add(blob(0.11, skin, 0.62, 0.98, 0.14));
  return mergeBody(g);
}

/** A thane of the hold (the dwarves' nobleman): a gold circlet, a white fur collar over a long rune-red mantle,
 *  and a staff crowned with a gold anvil. */
export function thane(): THREE.Group {
  const g = new THREE.Group();
  dwarfFolk(g, 0x5a2a22, folkCount++, { head: false, beard: 0xd8d0c4, long: true });
  g.add(cyl(0.21, 0.21, 0.08, DW_GOLD, 8, 0, 1.06));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; g.add(cone(0.035, 0.12, DW_GOLD, 4, Math.cos(a) * 0.2, 1.12, Math.sin(a) * 0.2)); }
  g.add(cyl(0.36, 0.36, 0.12, 0xf2eee4, 8, 0, 0.72));
  g.add(box(0.8, 0.9, 0.05, CLOTH, 0, 0.0, -0.3));
  g.add(cyl(0.03, 0.035, 1.7, DW_OAK, 5, 0.38, 0, 0.1));
  const an = greatAnvil(0.22, false);
  an.position.set(0.38, 1.7, 0.1);
  g.add(an);
  return mergeBody(g);
}

// ---------- the Forgelord's seat ----------

/** A timbered adit into the rock: a black mouth, two posts and a heavy header with a rune cut in it, knee-braces,
 *  and a lantern hung from the header. Its front is at z = 0.3. */
function adit(w = 2.2, h = 2.5, lamp = true): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, h, 0.8, SOOT, 0, 0, -0.1));
  for (const s of [-1, 1]) {
    g.add(box(0.34, h + 0.2, 0.36, DW_OAK, s * (w / 2 + 0.12), 0, 0.3));
    g.add(limb(V(s * (w / 2 + 0.1), h - 0.75, 0.32), V(s * (w / 2 - 0.5), h + 0.04, 0.32), 0.08, 0.08, DW_OAK, 4));
  }
  g.add(box(w + 1.1, 0.44, 0.48, DW_OAK, 0, h + 0.05, 0.3));
  g.add(box(w + 1.16, 0.1, 0.52, IRON_BK, 0, h + 0.49, 0.3));
  const rn = forgeRune(0.3, 2);
  rn.position.set(0, h + 0.27, 0.56);
  g.add(rn);
  if (lamp) {
    g.add(box(0.03, 0.4, 0.03, 0x2a2420, w * 0.3, h - 0.38, 0.62));
    const l = lantern(0.8);
    l.position.set(w * 0.3, h - 0.9, 0.62);
    g.add(l);
  }
  return g;
}

/**
 * The Forgelord's seat: a mine-mouth timbered into the mountain's flank with a stone hut beside it; a squat forge-hall
 * of granite under a bronze roof, bastions at its corners; a mountain hall cut into the rock, a great dwarf's face
 * carved over its door; a throne hall under a stone dome, a giant anvil and a brazier before its portico; and at last
 * a colossal gate in the living rock, two stone kings keeping it, a ring of runes turning over it and lava falling
 * in stone channels either side.
 */
export function forgeHall(t: number, color: number): Built {
  const g = new THREE.Group();
  const r = rng(71 + t);
  if (t === 1) {
    crag(g, [[0, -3.6, 3.0, 3.2, 0], [-3.0, -2.9, 2.2, 2.4, 1], [3.1, -3.2, 2.4, 2.8, 1], [0.8, -5.4, 2.6, 4.0, 1], [-2.2, -5.0, 2.0, 3.0, 0]], r);
    const ad = adit(2.2, 2.4);
    ad.position.set(0, 0, -0.55);
    g.add(ad);
    const rl = rails(5.0);
    rl.position.set(0, 0, -0.4);
    g.add(rl);
    const cart = mineCart(1, true);
    cart.position.set(0, 0.08, 2.6);
    g.add(cart);
    const hut = house({ w: 3.8, d: 3.2, h: 2.2, roofH: 1.7, roof: C.thatch, windows: 1 });
    hut.position.set(3.9, 0, 0.9);
    hut.rotation.y = -0.4;
    g.add(hut);
    const an = greatAnvil(0.55);
    an.position.set(-2.9, 0, 2.3);
    an.rotation.y = 0.5;
    g.add(an);
    const fb = fireBowl(0.5, false, 0.7);
    fb.position.set(-3.9, 0, 0.9);
    g.add(fb);
    const bs = beamStack(6, 2.2);
    bs.position.set(-3.6, 0.1, -1.1);
    bs.rotation.y = 0.3;
    g.add(bs);
    const oh = oreHeap(0.9);
    oh.position.set(2.6, 0, 3.5);
    g.add(oh);
    const st = holdStandard(color, 4.4);
    st.position.set(-4.3, 0, 3.4);
    g.add(st);
    return { obj: g, h: 6.4, w: 9, d: 9 };
  }
  if (t === 2) {
    crag(g, [[-0.6, -6.2, 3.4, 3.4, 0], [3.4, -5.6, 2.6, 2.6, 1], [-4.2, -5.2, 2.4, 2.4, 1]], r);
    const hall = house({ w: 8.4, d: 6, h: 3.4, roofH: 2.6, windows: 2, chimney: true });
    hall.position.set(0, 0, -1.2);
    g.add(hall);
    g.add(smokeAt(8.4 * 0.24, 3.4 + 2.6 * 0.62 + 2.0, -1.2 - 6 * 0.18));
    // the forge glowing through a side door
    g.add(box(1.0, 1.7, 0.2, SOOT, -3.4, 0.5, 1.82));
    g.add(glow(new THREE.BoxGeometry(0.8, 1.2, 0.05), 0xff8a3a, 0xa8400c).translateX(-3.4).translateY(1.1).translateZ(1.93));
    for (const s of [-1, 1]) {
      const b = bastion(2.0, 3.9);
      b.position.set(s * 5.1, 0, 1.5);
      g.add(b);
    }
    g.add(box(3.2, 0.22, 1.3, DW_BASALT_MD, 0, 0, 2.4), box(2.6, 0.2, 0.8, DW_GRANITE, 0, 0.22, 2.2));
    const an = greatAnvil(0.7);
    an.position.set(2.6, 0, 3.8);
    an.rotation.y = -0.3;
    g.add(an);
    const fb = fireBowl(0.9, true, 0.9);
    fb.position.set(-2.6, 0, 3.7);
    g.add(fb);
    const rs = runeStone(2.2, 1);
    rs.position.set(-5.2, 0, 3.8);
    rs.rotation.y = 0.3;
    g.add(rs);
    const st = holdStandard(color, 5.2);
    st.position.set(5.2, 0, 3.9);
    g.add(st);
    g.add(keg(3.7, -3.8), keg(4.3, -3.2), dwarfCrate(-4.6, -2.8, 1, 0.3));
    return { obj: g, h: 10, w: 13, d: 11 };
  }
  if (t === 3) {
    crag(g, [[0, -6.6, 4.4, 5.8, 0], [-4.8, -5.2, 3.0, 4.0, 1], [4.9, -5.4, 3.2, 4.4, 1], [-1.8, -7.6, 3.0, 6.4, 1], [2.4, -7.2, 3.0, 6.0, 0]], r);
    // the facade, dressed and battered, stepped at its head
    g.add(box(10.2, 0.5, 5.0, DW_BASALT, 0, 0, -1.5));
    g.add(frustum(9.2, 4.6, 8.6, 4.0, 5.0, DW_GRANITE, 0, 0.5, -1.6));
    g.add(frustum(9.0, 4.3, 8.2, 3.8, 0.7, DW_GRANITE_LT, 0, 5.5, -1.7));
    // the middle of the front rises in a great block, the face of a dwarf carved into it
    g.add(frustum(5.4, 3.8, 4.4, 3.0, 5.2, DW_GRANITE, 0, 5.5, -1.1));
    g.add(frustum(4.8, 3.3, 3.4, 2.4, 0.8, DW_GRANITE_LT, 0, 10.7, -1.2));
    for (const sx of [-1, 1]) g.add(frustum(1.8, 3.0, 1.2, 2.4, 1.2, DW_GRANITE_LT, sx * 3.4, 6.2, -1.6));
    // quoins up the facade's corners
    for (const s of [-1, 1]) for (let y = 0.6, k = 0; y < 5.2; y += 0.7, k++) g.add(box(k % 2 ? 0.6 : 0.9, 0.62, 0.5, DW_GRANITE_LT, s * (4.4 - y * 0.03 - (k % 2 ? 0.2 : 0.35)), y, 0.62 - y * 0.058));
    portal(g, 0.72, 2.4, 3.3, 2);
    // the great stern face over the door
    const face = carvedFace(1.32);
    face.position.set(0, 8.0, 0.66);
    g.add(face);
    // rune channels either side of the door, glowing
    for (const s of [-1, 1]) {
      const ch = lava(new THREE.BoxGeometry(0.1, 3.6, 0.06));
      ch.position.set(s * 2.35, 2.5, 0.6);
      ch.rotation.x = 0.058;
      g.add(ch);
      runeRow(g, 3, 1.6, s * 3.35, 4.2, 0.52, 0.34, s > 0 ? 2 : 0);
    }
    for (const s of [-1, 1]) {
      const tw = roundTower(1.45, 7.0, { roof: C.tile, banner: color });
      tw.position.set(s * 6.0, 0, 0.1);
      g.add(tw);
      const fb = fireBowl(1.0, true, 1.0);
      fb.position.set(s * 2.4, 0, 3.5);
      g.add(fb);
    }
    for (let i = 0; i < 3; i++) g.add(box(4.0 - i * 0.5, 0.22, 0.8, i % 2 ? DW_GRANITE : DW_BASALT_MD, 0, i * 0.22, 2.9 - i * 0.62));
    return { obj: g, h: 14, w: 15, d: 12 };
  }
  if (t === 4) {
    crag(g, [[0, -7.8, 4.0, 4.4, 0], [-5.6, -6.6, 2.8, 3.4, 1], [5.7, -6.8, 3.0, 3.6, 1]], r);
    // the throne hall: a great block of dressed stone on a basalt plinth, pylons at its corners
    g.add(box(11.0, 0.6, 9.2, DW_BASALT, 0, 0, -2.6));
    g.add(frustum(10.2, 8.4, 9.6, 7.8, 5.0, DW_GRANITE, 0, 0.6, -2.7));
    g.add(box(10.4, 0.46, 8.6, DW_GRANITE_LT, 0, 5.6, -2.7));
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const px = x * 4.9, pz = -2.7 + z * 3.9;
      g.add(frustum(1.5, 1.5, 1.1, 1.1, 6.6, DW_GRANITE_LT, px, 0.6, pz));
      g.add(cone(0.9, 0.9, DW_BRONZE, 4, px, 7.2, pz).rotateY(Math.PI / 4));
    }
    // the drum and the dome
    const dome = stoneDome(3.6, 1.5);
    dome.position.set(0, 6.06, -2.9);
    g.add(dome);
    // forge-stacks at the back corners, smoking
    for (const s of [-1, 1]) {
      g.add(box(1.0, 3.2, 1.0, DW_BASALT_MD, s * 3.4, 5.8, -5.6));
      g.add(box(1.24, 0.26, 1.24, DW_BRONZE_DK, s * 3.4, 9.0, -5.6));
      g.add(smokeAt(s * 3.4, 9.4, -5.6));
    }
    // the portico: square pillars under a heavy entablature, the doors behind, a stepped pediment and the face in it
    for (const x of [-4.0, -1.9, 1.9, 4.0]) {
      g.add(box(0.8, 0.3, 0.8, DW_BASALT_MD, x, 0.6, 2.7));
      g.add(box(0.62, 4.0, 0.62, DW_GRANITE_LT, x, 0.9, 2.7));
      g.add(frustum(0.66, 0.66, 0.96, 0.96, 0.34, DW_GRANITE, x, 4.9, 2.7));
    }
    g.add(box(9.4, 0.9, 1.3, DW_GRANITE, 0, 5.24, 2.4));
    runeRow(g, 9, 8.2, 0, 5.68, 3.07, 0.4, 3);
    g.add(frustum(6.4, 1.2, 4.6, 1.0, 0.8, DW_GRANITE_LT, 0, 6.14, 2.2));
    g.add(frustum(4.4, 1.0, 2.8, 0.8, 0.7, DW_GRANITE, 0, 6.94, 2.1));
    portal(g, 1.66, 2.6, 3.8, 2);
    const face = carvedFace(0.66);
    face.position.set(0, 7.25, 2.45);
    g.add(face);
    // before the doors: the giant anvil on its plinth, and the great brazier
    g.add(frustum(3.6, 2.4, 3.0, 1.9, 0.6, DW_BASALT_MD, -3.0, 0, 5.2));
    const an = greatAnvil(1.5);
    an.position.set(-3.0, 0.6, 5.2);
    an.rotation.y = 0.2;
    g.add(an);
    const hm = bigHammer(2.6, 1.1, true);
    hm.position.set(-1.4, 0.2, 5.8);
    hm.rotation.set(0, 0.6, 0.62);
    g.add(hm);
    const fb = fireBowl(1.2, true, 1.5);
    fb.position.set(3.0, 0, 5.2);
    g.add(fb);
    for (let i = 0; i < 3; i++) g.add(box(5.4 - i * 0.6, 0.2, 0.9, i % 2 ? DW_GRANITE : DW_BASALT_MD, 0, 0.4 + i * 0.2 - 0.4, 4.6 - i * 0.7));
    for (const s of [-1, 1]) {
      const st = holdStandard(color, 5.6);
      st.position.set(s * 5.4, 0, 3.6);
      g.add(st);
    }
    return { obj: g, h: 16, w: 15, d: 15 };
  }
  // the gate in the mountain
  crag(g, [[-6.8, -6.8, 2.6, 4.4, 0], [6.8, -6.9, 2.6, 4.6, 0], [-3.4, -8.2, 3.0, 8.4, 1], [3.4, -8.2, 3.0, 8.2, 1], [0, -8.4, 2.6, 10.6, 0]], r);
  // the rock face either side of the gate, and the dressed face it is cut into
  for (const s of [-1, 1]) {
    g.add(frustum(4.6, 5.6, 3.2, 3.8, 8.0, DW_BASALT_MD, s * 6.3, 0, -5.0));
    g.add(frustum(3.2, 3.8, 1.6, 2.2, 1.8, DW_BASALT, s * 6.3, 8.0, -5.2));
  }
  g.add(box(8.6, 12.6, 4.6, DW_GRANITE, 0, 0, -4.6));
  g.add(frustum(9.2, 5.0, 6.8, 3.8, 1.2, DW_GRANITE_LT, 0, 12.6, -4.6));
  g.add(frustum(6.0, 3.4, 4.2, 2.6, 1.0, DW_GRANITE, 0, 13.8, -4.7));
  // quoins down the dressed face's edges, and a band of runes over the gate
  for (const s of [-1, 1]) for (let y = 0.4, k = 0; y < 12.2; y += 0.9, k++) g.add(box(k % 2 ? 0.7 : 1.1, 0.8, 0.5, DW_GRANITE_LT, s * (4.3 - (k % 2 ? 0.25 : 0.45)), y, -2.2));
  runeRow(g, 9, 7.2, 0, 9.35, -2.2, 0.42, 1);
  // the gate: three receding frames and doors of bronze with a seam of fire
  portal(g, -1.7, 4.4, 7.0, 3);
  for (const s of [-1, 1]) {
    const ring = mesh(new THREE.TorusGeometry(0.62, 0.08, 4, 14), DW_GOLD);
    ring.position.set(s * 1.1, 3.6, -2.14);
    g.add(ring);
    const rn = forgeRune(0.66, s > 0 ? 4 : 0);
    rn.position.set(s * 1.1, 3.6, -2.14);
    g.add(rn);
  }
  // the ring of runes turning over the gate, in a round recess
  g.add(mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.3, 16).rotateX(Math.PI / 2), DW_BASALT).translateY(11.0).translateZ(-2.2));
  g.add(mesh(new THREE.TorusGeometry(2.85, 0.16, 4, 20), DW_GRANITE_LT).translateY(11.0).translateZ(-2.1));
  const ringParts = new THREE.Group();
  ringParts.add(glow(new THREE.TorusGeometry(2.1, 0.1, 4, 28)));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rn = forgeRune(0.5, i);
    rn.position.set(Math.cos(a) * 1.55, Math.sin(a) * 1.55, 0);
    rn.rotation.z = a - Math.PI / 2;
    ringParts.add(rn);
  }
  ringParts.add(glow(new THREE.TorusGeometry(1.0, 0.07, 4, 20)));
  const ring = swarm(ringParts, { spin: true });
  ring.position.set(0, 11.0, -1.9);
  g.add(ring);
  // the two stone kings, hammers planted
  for (const s of [-1, 1]) {
    g.add(frustum(3.0, 3.0, 2.6, 2.6, 1.3, DW_BASALT_MD, s * 4.8, 0, 0.2));
    g.add(box(2.9, 0.2, 2.9, DW_GRANITE_LT, s * 4.8, 1.2, 0.2));
    runeRow(g, 3, 2.0, s * 4.8, 0.7, 1.52, 0.32, s > 0 ? 3 : 0);
    const k = kingStatue(1.24);
    k.position.set(s * 4.8, 1.4, -0.1);
    g.add(k);
  }
  // the lava falls, from mouths high in the rock, into stone channels running out before the gate
  for (const s of [-1, 1]) {
    const x = s * 7.2;
    g.add(box(1.4, 1.1, 0.5, SOOT, x, 6.0, -2.62));
    g.add(frustum(1.9, 0.9, 1.6, 0.7, 0.4, DW_GRANITE_LT, x, 5.8, -2.3));
    g.add(lava(new THREE.BoxGeometry(0.72, 5.9, 0.18)).translateX(x).translateY(3.2).translateZ(-2.28));
    g.add(glow(new THREE.BoxGeometry(1.0, 5.9, 0.12), 0xc8421a, 0x8a2408).translateX(x).translateY(3.2).translateZ(-2.42));
    g.add(box(2.2, 0.6, 1.8, DW_BASALT, x, 0, -1.6));
    g.add(lava(new THREE.BoxGeometry(1.7, 0.08, 1.3)).translateX(x).translateY(0.58).translateZ(-1.6));
    for (const w of [-1, 1]) g.add(box(0.32, 0.56, 6.4, DW_GRANITE, x + w * 0.58, 0, 2.0));
    g.add(box(0.9, 0.3, 6.4, DW_BASALT, x, 0, 2.0));
    g.add(lava(new THREE.BoxGeometry(0.8, 0.06, 6.4)).translateX(x).translateY(0.34).translateZ(2.0));
    g.add(cyl(1.15, 1.25, 0.56, DW_BASALT, 8, x, 0, 5.8));
    g.add(lava(new THREE.CylinderGeometry(0.92, 0.92, 0.06, 8)).translateX(x).translateY(0.54).translateZ(5.8));
  }
  // the steps up to the gate, the giant anvil and the great brazier before it
  for (let i = 0; i < 4; i++) g.add(box(7.6 - i * 0.7, 0.24, 1.0, i % 2 ? DW_GRANITE : DW_BASALT_MD, 0, i * 0.24, 1.9 - i * 0.9));
  g.add(box(6.2, 0.96, 1.4, DW_GRANITE, 0, 0, -1.2));
  g.add(frustum(2.6, 2.0, 2.2, 1.6, 0.5, DW_BASALT_MD, -2.5, 0, 4.8));
  const an = greatAnvil(1.3);
  an.position.set(-2.5, 0.5, 4.8);
  an.rotation.y = 0.25;
  g.add(an);
  const fb = fireBowl(1.1, true, 1.35);
  fb.position.set(2.5, 0, 4.8);
  g.add(fb);
  // the dome crowning the mountain, forge-stacks smoking beside it
  const dome = stoneDome(2.5, 1.2);
  dome.position.set(0, 14.8, -4.8);
  g.add(dome);
  for (const s of [-1, 1]) {
    g.add(box(1.0, 3.0, 1.0, DW_BASALT_MD, s * 3.2, 11.4, -6.4));
    g.add(box(1.24, 0.26, 1.24, DW_BRONZE_DK, s * 3.2, 14.4, -6.4));
    g.add(smokeAt(s * 3.2, 14.8, -6.4));
  }
  for (const s of [-1, 1]) {
    const st = holdStandard(color, 5.4);
    st.position.set(s * 3.2, 0, 6.3);
    g.add(st);
  }
  // embers drifting up the face of the mountain
  const parts = new THREE.Group();
  for (let i = 0; i < 24; i++) {
    const a = r() * Math.PI, d = 3 + r() * 5;
    parts.add(glow(new THREE.OctahedronGeometry(0.09 + r() * 0.06, 0), i % 3 ? 0xff8a3a : 0xffc060, i % 3 ? 0xb8420c : 0xd07a20).translateX(Math.cos(a) * d).translateY(r() * 12).translateZ(Math.sin(a) * d * 0.5));
  }
  const embers = swarm(parts, { bob: 0.6 });
  embers.position.set(0, 1.5, -0.5);
  g.add(embers);
  return { obj: g, h: 20, w: 17, d: 16 };
}

// ---------- the other buildings ----------

/** A bronze cog-wheel facing +Z (merged into one mesh; it turns when `spin`). */
function gear(r: number, spin = true): THREE.Group {
  const parts = new THREE.Group();
  parts.add(mesh(new THREE.TorusGeometry(r, r * 0.16, 4, 16), DW_BRONZE));
  const n = Math.max(8, Math.round(r * 10));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const tooth = mesh(new THREE.BoxGeometry(r * 0.24, r * 0.24, r * 0.2), DW_BRONZE);
    tooth.position.set(Math.cos(a) * r * 1.18, Math.sin(a) * r * 1.18, 0);
    tooth.rotation.z = a;
    parts.add(tooth);
  }
  for (let i = 0; i < 3; i++) {
    const sp = mesh(new THREE.BoxGeometry(r * 2, r * 0.14, r * 0.12), DW_BRONZE_DK);
    sp.rotation.z = (i / 3) * Math.PI;
    parts.add(sp);
  }
  parts.add(mesh(new THREE.CylinderGeometry(r * 0.26, r * 0.26, r * 0.3, 8).rotateX(Math.PI / 2), DW_GOLD));
  return spin ? swarm(parts, { spin: true }) : parts;
}

/** A boiler of riveted bronze lying along X on stone saddles, its firebox glowing, a stack of iron rising from it. */
function boiler(len: number, r: number, stack: number): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-len * 0.3, len * 0.3]) g.add(box(0.5, r * 0.9, r * 1.6, DW_BASALT_MD, x, 0, 0));
  g.add(mesh(new THREE.CylinderGeometry(r, r, len, 10).rotateZ(Math.PI / 2), DW_BRONZE).translateY(r * 1.4));
  for (const x of [-len * 0.36, 0, len * 0.36]) g.add(mesh(new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.1, 10).rotateZ(Math.PI / 2), DW_BRONZE_DK).translateX(x).translateY(r * 1.4));
  g.add(mesh(new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2), DW_BRONZE_DK).translateX(len / 2).translateY(r * 1.4));
  g.add(glow(new THREE.BoxGeometry(0.5, 0.3, 0.06), 0xff8a3a, 0xb8420c).translateX(-len * 0.1).translateY(r * 0.5).translateZ(r * 0.8));
  if (stack > 0) {
    g.add(cyl(0.16, 0.2, stack, IRON_BK, 6, -len * 0.32, r * 2.2, 0));
    g.add(cyl(0.26, 0.2, 0.26, IRON_BK, 6, -len * 0.32, r * 2.2 + stack, 0));
    g.add(smokeAt(-len * 0.32, r * 2.2 + stack + 0.3, 0));
  }
  // a gauge and a valve wheel
  g.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 8).rotateX(Math.PI / 2), DW_GOLD).translateX(len * 0.2).translateY(r * 1.4 + r * 0.72).translateZ(r * 0.6));
  g.add(mesh(new THREE.TorusGeometry(0.16, 0.03, 3, 8), IRON_BK).translateX(len * 0.36).translateY(r * 2.5).translateZ(0));
  return g;
}

/** A steam drill: a wheeled chassis, a bronze boiler and stack, and a great bronze drill-bit cut with a spiral, pointing +X. */
function steamDrill(s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.6 * s, 0.3 * s, 1.3 * s, DW_OAK, 0, 0.45 * s, 0));
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(0.42 * s, 0.42 * s, 0.16 * s, 8).rotateX(Math.PI / 2), IRON_BK).translateX(x * 0.85 * s).translateY(0.42 * s).translateZ(z * 0.74 * s));
    g.add(mesh(new THREE.CylinderGeometry(0.12 * s, 0.12 * s, 0.2 * s, 6).rotateX(Math.PI / 2), DW_BRONZE).translateX(x * 0.85 * s).translateY(0.42 * s).translateZ(z * 0.76 * s));
  }
  g.add(mesh(new THREE.CylinderGeometry(0.5 * s, 0.5 * s, 1.3 * s, 10).rotateZ(Math.PI / 2), DW_BRONZE).translateX(-0.45 * s).translateY(1.2 * s));
  for (const x of [-0.95, 0.05]) g.add(mesh(new THREE.CylinderGeometry(0.53 * s, 0.53 * s, 0.08 * s, 10).rotateZ(Math.PI / 2), DW_GOLD).translateX(x * s).translateY(1.2 * s));
  g.add(cyl(0.13 * s, 0.17 * s, 1.1 * s, IRON_BK, 6, -0.85 * s, 1.55 * s, 0));
  g.add(smokeAt(-0.85 * s, 2.8 * s, 0));
  g.add(glow(new THREE.BoxGeometry(0.4 * s, 0.24 * s, 0.05), 0xff8a3a, 0xb8420c).translateX(-0.3 * s).translateY(0.82 * s).translateZ(0.66 * s));
  g.add(mesh(new THREE.CylinderGeometry(0.42 * s, 0.42 * s, 0.5 * s, 8).rotateZ(Math.PI / 2), DW_BRONZE_DK).translateX(0.52 * s).translateY(1.1 * s));
  g.add(cone(0.42 * s, 1.5 * s, DW_BRONZE, 8, 0.76 * s, 1.1 * s, 0).rotateZ(-Math.PI / 2));
  for (let i = 0; i < 9; i++) {
    const k = i / 9, a = i * 1.1, rr = 0.42 * s * (1 - k) + 0.02;
    const rib = mesh(new THREE.BoxGeometry(0.12 * s, 0.07 * s, 0.07 * s), DW_BRONZE_DK);
    rib.position.set(0.84 * s + k * 1.4 * s, 1.1 * s + Math.cos(a) * rr, Math.sin(a) * rr);
    g.add(rib);
  }
  return g;
}

/** A dry-stone wall from (x0, z0) to (x1, z1): rough blocks of basalt and granite, capped. */
function dryWall(g: THREE.Group, x0: number, z0: number, x1: number, z1: number, h = 0.8, gap?: [number, number]): void {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 0.72));
  const a = Math.atan2(z1 - z0, x1 - x0);
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n;
    const x = x0 + (x1 - x0) * k, z = z0 + (z1 - z0) * k;
    if (gap && k > gap[0] && k < gap[1]) continue;
    const b = box(len / n + 0.04, h * (0.8 + (i % 3) * 0.12), 0.56, i % 3 === 1 ? DW_GRANITE : DW_BASALT_MD, x, 0, z);
    b.rotation.y = -a;
    g.add(b);
    if (i % 2 === 0) { const c = box(0.5, 0.2, 0.62, DW_GRANITE_LT, x, h * 0.9, z); c.rotation.y = -a + 0.1; g.add(c); }
  }
}

/** A lantern on a stone post, a rune in the post: the hold's mark by a doorstep or a track. */
export function forgePost(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(frustum(0.56, 0.56, 0.36, 0.36, h, DW_GRANITE));
  g.add(box(0.52, 0.12, 0.52, DW_GRANITE_LT, 0, h, 0));
  g.add(box(0.06, 0.3, 0.06, DW_BRONZE_DK, 0, h + 0.1, 0));
  const l = lantern(1);
  l.position.y = h + 0.12;
  g.add(l);
  const rn = forgeRune(0.3, Math.round(h * 5));
  rn.position.set(0, h * 0.55, 0.24);
  g.add(rn);
  return g;
}

/** Barracks: the Hall of Shields, round shields hung along its eaves, and a paved drill yard before it where a shield
 *  wall of three stands at drill before its sergeant; pells of stone, a rack of axes and hammers, a stone target. */
function barracks(t: number, color: number): Built {
  const g = new THREE.Group();
  g.add(signed(house({ w: 7, d: 5, h: 3.2, roofH: 2.4, windows: 2, stone: t === 3 })));
  for (const x of [-2.75, 2.75]) g.add(roundShield(0.34, x, 2.5, 2.62, 0));
  const yz = 5.7;
  g.add(box(6.6, 0.06, 4.6, DW_BASALT_MD, 0, 0, yz));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.add(box(1.5, 0.06, 1.38, (i + j) % 2 ? DW_GRANITE : DW_SLAB, -2.4 + i * 1.6, 0.05, yz - 1.5 + j * 1.5));
  g.add(box(6.9, 0.3, 0.3, DW_GRANITE_LT, 0, 0, yz + 2.4));
  for (const x of [-1, 1]) g.add(box(0.3, 0.3, 4.6, DW_GRANITE_LT, x * 3.45, 0, yz + 0.1));
  // the shield wall at drill, its sergeant before it
  for (let i = 0; i < 3; i++) {
    const d = dwarfSoldier('spear');
    d.position.set(-1.1 + i * 1.1, 0.1, yz - 0.3);
    g.add(d);
  }
  const sg = dwarfSoldier('sword');
  sg.position.set(0.5, 0.1, yz + 1.5);
  sg.rotation.y = Math.PI;
  g.add(sg);
  // pells and a stone target
  for (const z of [yz - 0.9, yz + 1.1]) {
    g.add(frustum(0.4, 0.4, 0.3, 0.3, 1.5, DW_GRANITE, -2.7, 0.1, z));
    g.add(box(0.44, 0.14, 0.44, IRON_BK, -2.7, 1.2, z));
  }
  g.add(frustum(0.5, 0.3, 0.4, 0.3, 1.1, DW_GRANITE, 2.7, 0.1, yz + 1.2));
  g.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 12).rotateX(Math.PI / 2), 0xd8c8a0).translateX(2.7).translateY(1.55).translateZ(yz + 1.2));
  g.add(mesh(new THREE.TorusGeometry(0.34, 0.06, 4, 12), CLOTH).translateX(2.7).translateY(1.55).translateZ(yz + 1.28));
  g.add(glow(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 8).rotateX(Math.PI / 2)).translateX(2.7).translateY(1.55).translateZ(yz + 1.3));
  // the rack of axes and hammers
  const rack = new THREE.Group();
  rack.add(box(1.9, 0.12, 0.14, DW_OAK, 0, 1.2, 0));
  for (const x of [-0.9, 0.9]) rack.add(box(0.14, 1.34, 0.14, DW_OAK, x, 0, 0));
  for (let i = 0; i < 4; i++) {
    const x = -0.6 + i * 0.4;
    rack.add(box(0.05, 1.2, 0.05, DW_OAK, x, 0.05, 0.1));
    rack.add(box(i % 2 ? 0.3 : 0.2, i % 2 ? 0.2 : 0.3, i % 2 ? 0.2 : 0.06, i % 2 ? IRON_BK : STEEL, x + (i % 2 ? 0 : 0.1), 1.02, 0.14));
  }
  rack.position.set(-4.0, 0, 3.2);
  rack.rotation.y = 0.5;
  g.add(rack);
  if (t >= 2) {
    const wing = house({ w: 5, d: 4, h: 2.8, roofH: 2, windows: 1 });
    wing.position.set(-6.2, 0, 0.5);
    wing.rotation.y = Math.PI / 2;
    g.add(wing);
    const st = holdStandard(color, 4.8);
    st.position.set(4.1, 0, 2.7);
    g.add(st);
  }
  if (t >= 3) {
    const fb = fireBowl(0.9, false, 0.8);
    fb.position.set(-2.9, 0, yz + 2.2);
    g.add(fb);
    g.add(keg(4.2, -0.2), keg(4.3, 0.7), dwarfCrate(4.2, -1.3, 0.9));
  }
  return { obj: g, h: 7.5, w: 9, d: 8 };
}

/** Stable: the goat-byre, three stall-mouths under stone lintels, and a pen of dry-stone walls where mountain
 *  goats and great war-rams stand about (barded in bronze for the anvil knights), one of them on a crag. */
function stable(t: number, r: () => number): Built {
  const g = new THREE.Group();
  g.add(signed(house({ w: 9, d: 4.6, h: 2.8, roofH: 2.1, windows: 0, door: false })));
  for (const x of [-2.8, 0, 2.8]) {
    g.add(box(1.4, 1.85, 0.14, SOOT, x, 0.5, 2.4));
    g.add(box(1.36, 0.82, 0.1, DW_OAK, x, 0.5, 2.5));
    g.add(box(1.4, 0.08, 0.06, DW_BRONZE, x, 1.1, 2.56));
    g.add(frustum(1.8, 0.4, 2.1, 0.4, 0.38, DW_GRANITE_LT, x, 2.34, 2.42));
  }
  // a goat looking out over the middle half-door
  const peek = new THREE.Group();
  peek.add(box(0.32, 0.26, 0.4, 0x9a8a72, 0, 0, 0), box(0.2, 0.18, 0.2, 0x6e6252, 0, -0.04, 0.24));
  for (const x of [-1, 1]) peek.add(horn(V(x * 0.08, 0.12, -0.06), V(x * 0.22, 0.42, -0.2), V(x * 0.26, 0.2, -0.38), 0.05, GOAT_HORN, 3));
  peek.position.set(0, 1.5, 2.46);
  g.add(peek);
  dryWall(g, -4.3, 7.1, 4.3, 7.1, 0.8, [0.62, 0.8]);
  dryWall(g, -4.3, 2.9, -4.3, 7.1, 0.8);
  dryWall(g, 4.3, 2.9, 4.3, 7.1, 0.8);
  const kinds = t === 1 ? ['g', 'g'] : t === 2 ? ['g', 'r', 'g'] : ['g', 'R', 'g', 'R'];
  const spots: [number, number, number][] = [[-1.6, 4.3, 0.5], [1.6, 5.6, 2.6], [2.4, 3.8, -2.4], [-0.4, 6.1, 1.4]];
  kinds.forEach((k, i) => {
    const m = k === 'g' ? goat(i % 2 ? 0x8a7a64 : 0xb0a28a) : warRam(k === 'R');
    m.userData.mount = true;
    m.position.set(spots[i][0], 0, spots[i][1] + (r() - 0.5) * 0.4);
    m.rotation.y = spots[i][2];
    m.scale.setScalar(k === 'g' ? 1.15 : 0.95);
    g.add(m);
  });
  if (t >= 2) {
    // the goats' crag in the corner of the pen, one of them up on it
    g.add(blob(1.0, DW_BASALT_MD, -3.1, 0.3, 5.9, 1.1, 0.95, 1.0), blob(0.6, DW_BASALT, -2.5, 0.2, 6.5, 1, 0.8, 1));
    const up = goat(0xd8d0c0, 0.9);
    up.position.set(-3.1, 1.05, 5.8);
    up.rotation.y = 0.9;
    g.add(up);
  }
  // a stone trough of water and a hay rack
  g.add(box(1.8, 0.5, 0.6, DW_GRANITE, 3.0, 0, 3.3));
  g.add(box(1.6, 0.04, 0.44, 0x3a4c56, 3.0, 0.46, 3.3));
  const hr = new THREE.Group();
  for (const x of [-0.7, 0.7]) hr.add(box(0.12, 1.3, 0.12, DW_OAK, x, 0, 0));
  hr.add(frustum(1.3, 0.3, 1.5, 0.7, 0.6, DW_OAK, 0, 0.6, 0));
  hr.add(blob(0.5, HAY, 0, 1.15, 0, 1.4, 0.55, 0.7));
  hr.position.set(-3.2, 0, 3.4);
  g.add(hr);
  return { obj: g, h: 6, w: 10, d: 10 };
}

/** Workshop: the engine works. A hall of stone pillars under a bronze roof, a boiler against its back wall steaming,
 *  a gear turning in the wall, a flame ballista under it; outside, a steam drill and (at its greatest) a gantry crane. */
function workshop(t: number): Built {
  const g = new THREE.Group();
  for (const [x, z] of [[-3.5, -2], [3.5, -2], [-3.5, 2], [3.5, 2]]) {
    g.add(box(0.84, 0.3, 0.84, DW_BASALT, x, 0, z));
    g.add(box(0.56, 3.3, 0.56, DW_GRANITE, x, 0.3, z));
    g.add(frustum(0.6, 0.6, 0.92, 0.92, 0.3, DW_GRANITE_LT, x, 3.6, z));
  }
  for (const z of [-2, 2]) g.add(box(8.0, 0.42, 0.6, DW_GRANITE_LT, 0, 3.9, z));
  // a low bronze roof, standing seams on it, ridge along X
  for (const s of [-1, 1]) {
    const sl = new THREE.Group();
    sl.add(box(8.8, 0.2, 2.8, DW_BRONZE, 0, 0, 0));
    for (let i = 0; i < 10; i++) sl.add(box(0.08, 0.08, 2.8, DW_BRONZE_DK, -4.2 + i * 0.93, 0.2, 0));
    sl.position.set(0, 4.62, s * 1.3);
    sl.rotation.x = s * 0.34;
    g.add(sl);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 9.0, 6).rotateZ(Math.PI / 2), DW_BRONZE_DK).translateY(5.2));
  g.add(box(7.2, 3.3, 0.5, DW_GRANITE, 0, 0.3, -2.3));
  g.add(box(7.3, 0.2, 0.6, DW_BASALT_MD, 0, 2.0, -2.3));
  const bl = boiler(2.6, 0.72, 3.4);
  bl.position.set(-1.6, 0, -1.3);
  g.add(bl);
  g.add(limb(V(-0.3, 2.3, -1.3), V(2.8, 2.3, -1.8), 0.1, 0.1, DW_BRONZE, 6), limb(V(2.8, 2.3, -1.8), V(2.8, 0.3, -1.8), 0.1, 0.1, DW_BRONZE, 6));
  const gw = gear(0.7, t >= 2);
  gw.position.set(1.7, 2.3, -2.0);
  g.add(gw);
  const fb = ballista(1.1);
  fb.position.set(0.8, 0, 0.5);
  fb.rotation.y = 0.5;
  g.add(fb);
  g.add(glow(new THREE.IcosahedronGeometry(0.16, 0), 0xff8a3a, 0xc0400a).translateX(0.8 + Math.sin(0.5) * 1.56).translateY(1.3).translateZ(0.5 + Math.cos(0.5) * 1.56));
  if (t >= 2) {
    const dr = steamDrill(1);
    dr.position.set(-1.2, 0, 4.3);
    dr.rotation.y = 0.3;
    g.add(dr);
  }
  if (t >= 3) {
    // an iron gantry over the yard, a drill-bit hanging from its chain
    for (const x of [3.0, 5.6]) g.add(box(0.3, 4.4, 0.3, IRON_BK, x, 0, 3.4));
    g.add(box(3.0, 0.3, 0.36, IRON_BK, 4.3, 4.4, 3.4));
    g.add(box(0.04, 1.4, 0.04, 0x2a2420, 4.6, 3.0, 3.4));
    g.add(cone(0.3, 1.0, DW_BRONZE, 8, 4.6, 2.0, 3.4).rotateZ(Math.PI));
  }
  // coal and plate stacked for the engines
  g.add(blob(0.9, COAL, 5.0, 0.15, 0.6, 1.2, 0.55, 1.1));
  const ig = ingots(9);
  ig.position.set(5.1, 0, -1.2);
  g.add(ig);
  return { obj: g, h: 6, w: 9, d: 8 };
}

/** Academy: the lorehall of the runesmiths, a long stone hall, its tower of eight sides under a bronze roof, lore-stones
 *  standing at its door, a rune-anvil on which the runes are struck. */
function academy(): Built {
  const g = new THREE.Group();
  const nave = house({ w: 6, d: 10, h: 5, roofH: 3.2, stone: true, windows: 0 });
  nave.rotation.y = Math.PI / 2;
  g.add(nave);
  // tall deep-set windows down both long walls, runes over them
  for (const x of [-3, 0, 3]) for (const s of [-1, 1]) {
    const w = box(0.6, 1.9, 0.12, C.window, x, 1.9, s * 3.02);
    w.userData.window = true;
    g.add(w);
    g.add(box(1.0, 0.24, 0.3, DW_BASALT_MD, x, 3.8, s * 3.04));
    const rn = forgeRune(0.34, (x + 3) / 3 + (s > 0 ? 0 : 2));
    rn.position.set(x, 4.3, s * 3.07);
    if (s < 0) rn.rotation.y = Math.PI;
    g.add(rn);
  }
  const tw = roundTower(1.7, 9.5, { roof: C.tile });
  tw.position.set(6.2, 0, 0);
  g.add(tw);
  g.add(box(1.1, 2.1, 0.2, DW_OAK, 6.2, 0, 1.62));
  g.add(frustum(1.5, 0.3, 1.8, 0.3, 0.4, DW_GRANITE_LT, 6.2, 2.1, 1.66));
  for (const [x, z, h] of [[4.4, 2.6, 2.2], [8.3, 1.4, 1.8]] as [number, number, number][]) {
    const rs = runeStone(h, Math.round(x));
    rs.position.set(x, 0, z);
    rs.rotation.y = x > 6 ? -0.6 : 0.3;
    g.add(rs);
  }
  const an = greatAnvil(0.62);
  an.position.set(-6.3, 0, 1.6);
  an.rotation.y = 1.2;
  g.add(an);
  return { obj: g, h: 18, w: 14, d: 8 };
}

/** Smithy: the great forge. A stone forge-house under a slab roof, its tapering stack bound in bronze and smoking; before
 *  it the hearth glowing under its hood with a great bellows beside, a crucible tipped on a gantry pouring a stream of
 *  molten metal into the moulds, and the anvil with a blade on it still red. */
function smithy(t: number): Built {
  const g = new THREE.Group();
  g.add(signed(house({ w: 6, d: 5, h: 3.2, roofH: 2.2, stone: true, roof: C.slate, windows: 1 })));
  g.add(frustum(1.5, 1.5, 1.0, 1.0, 7.4, DW_BASALT_MD, 1.8, 0, -1.2));
  for (const y of [2.8, 5.0, 7.0]) { const w = 1.5 - (y / 7.4) * 0.5 + 0.1; g.add(box(w, 0.2, w, DW_BRONZE_DK, 1.8, y, -1.2)); }
  g.add(box(1.3, 0.3, 1.3, DW_BRONZE, 1.8, 7.3, -1.2));
  g.add(smokeAt(1.8, 7.9, -1.2));
  // the hearth and its hood
  g.add(box(1.8, 0.9, 1.3, DW_GRANITE, -2.3, 0, 3.3));
  g.add(glow(new THREE.BoxGeometry(1.4, 0.1, 0.9), 0xff7a2a, 0xb83a0a).translateX(-2.3).translateY(0.92).translateZ(3.3));
  for (let i = 0; i < 4; i++) g.add(glow(new THREE.OctahedronGeometry(0.12, 0), 0xffc060, 0xd07a20).translateX(-2.8 + i * 0.3).translateY(1.0).translateZ(3.2 + (i % 2) * 0.2));
  g.add(frustum(1.9, 1.2, 0.8, 0.6, 1.6, DW_BASALT_MD, -2.3, 1.7, 2.9));
  for (const x of [-3.05, -1.55]) g.add(box(0.2, 0.9, 0.2, DW_GRANITE_LT, x, 0.9, 3.8));
  // the great bellows
  const bw = new THREE.Group();
  bw.add(box(1.1, 0.1, 0.8, DW_OAK, 0, 0.3, 0), frustum(1.1, 0.8, 0.2, 0.8, 0.4, 0x5a3a24, 0, 0.4, 0), box(1.1, 0.1, 0.8, DW_OAK, 0.1, 0.78, 0));
  bw.add(limb(V(0.6, 0.55, 0), V(1.1, 0.7, 0), 0.08, 0.05, DW_BRONZE, 5));
  bw.position.set(-4.0, 0, 3.4);
  bw.rotation.y = -0.2;
  g.add(bw);
  // the crucible pouring into the moulds
  for (const x of [-0.5, 1.9]) g.add(box(0.28, 3.1, 0.28, IRON_BK, x, 0, 4.1));
  g.add(box(2.7, 0.24, 0.3, IRON_BK, 0.7, 3.0, 4.1));
  g.add(box(0.04, 0.6, 0.04, 0x2a2420, 0.9, 2.4, 4.1));
  const cr = new THREE.Group();
  cr.add(cyl(0.44, 0.3, 0.62, DW_BRONZE_DK, 8, 0, -0.31, 0));
  cr.add(glow(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 8), DW_LAVA, DW_LAVA_E).translateY(0.28));
  cr.position.set(0.9, 2.1, 4.1);
  cr.rotation.z = 0.75;
  g.add(cr);
  g.add(lava(new THREE.BoxGeometry(0.13, 1.72, 0.13)).translateX(0.52).translateY(1.1).translateZ(4.1));
  g.add(box(2.8, 0.26, 0.5, DW_BASALT, 0.9, 0, 4.1));
  g.add(lava(new THREE.BoxGeometry(2.6, 0.05, 0.22)).translateX(0.9).translateY(0.26).translateZ(4.1));
  for (let i = 0; i < 3; i++) g.add(glow(new THREE.OctahedronGeometry(0.1, 0), 0xffd070, 0xd08a20).translateX(0.4 + i * 0.15).translateY(0.42).translateZ(4.0 + i * 0.1));
  // the anvil, a blade on it still red
  const an = greatAnvil(0.62);
  an.position.set(3.1, 0, 3.3);
  an.rotation.y = -0.4;
  g.add(an);
  g.add(glow(new THREE.BoxGeometry(0.55, 0.05, 0.12), 0xff7a2a, 0xb83a0a).translateX(3.1).translateY(0.8).translateZ(3.3).rotateY(-0.4));
  if (t >= 2) {
    // a quench trough, and a rack of new-forged axes and hammers
    g.add(box(0.6, 0.5, 1.6, DW_GRANITE, 4.2, 0, 1.0));
    g.add(box(0.44, 0.04, 1.4, 0x2a2c30, 4.2, 0.46, 1.0));
    const rack = new THREE.Group();
    rack.add(box(1.7, 0.12, 0.12, DW_OAK, 0, 1.2, 0));
    for (const x of [-0.8, 0.8]) rack.add(box(0.12, 1.3, 0.12, DW_OAK, x, 0, 0));
    for (let i = 0; i < 3; i++) rack.add(box(0.05, 1.1, 0.05, DW_OAK, -0.5 + i * 0.5, 0.1, 0.1), box(0.34, 0.22, 0.08, i % 2 ? IRON_BK : STEEL, -0.5 + i * 0.5 + 0.1, 1.0, 0.12));
    rack.position.set(-4.4, 0, 0.8);
    rack.rotation.y = Math.PI / 2;
    g.add(rack);
    g.add(blob(0.7, COAL, -4.4, 0.1, -1.4, 1.2, 0.55, 1));
  }
  if (t >= 3) {
    // a second stack, gold ingots, and the master's hammer mounted over the door
    g.add(frustum(1.1, 1.1, 0.7, 0.7, 6.0, DW_BASALT_MD, -1.6, 0, -1.9));
    g.add(box(0.95, 0.24, 0.95, DW_BRONZE, -1.6, 5.9, -1.9));
    g.add(smokeAt(-1.6, 6.4, -1.9));
    const ig = ingots(9, true);
    ig.position.set(4.4, 0, 3.2);
    g.add(ig);
    const hm = bigHammer(2.2, 0.8, true);
    hm.rotation.z = Math.PI / 2;
    hm.position.set(1.1, 4.1, 2.62);
    g.add(hm);
  }
  return { obj: g, h: 8.5, w: 8, d: 7 };
}

/** Rally point: the muster-stone. A stepped dais of basalt and a rune-cut block on it, the standard of the hold raised
 *  from it; the great war-horn on its frame, a fire in a bronze bowl, and stone benches round it. */
function rally(color: number): Built {
  const g = new THREE.Group();
  g.add(frustum(2.6, 2.6, 2.1, 2.1, 0.4, DW_BASALT_MD));
  g.add(frustum(1.6, 1.6, 1.2, 1.2, 1.2, DW_GRANITE, 0, 0.4, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const rn = forgeRune(0.4, i);
    rn.position.set(Math.sin(a) * 0.72, 1.0, Math.cos(a) * 0.72);
    rn.rotation.y = a;
    g.add(rn);
  }
  const st = holdStandard(color, 6.6);
  st.position.y = 1.6;
  g.add(st);
  // the war-horn on its frame
  const hn = new THREE.Group();
  for (const x of [-0.5, 0.5]) hn.add(box(0.14, 1.4, 0.14, DW_OAK, x, 0, 0));
  hn.add(box(1.2, 0.12, 0.14, DW_OAK, 0, 1.3, 0));
  hn.add(horn(V(-0.9, 1.55, 0), V(0.2, 2.1, 0), V(0.9, 1.3, 0), 0.2, DW_BRONZE, 6));
  hn.add(cone(0.3, 0.3, DW_GOLD, 8, 0.92, 1.1, 0).rotateZ(0.3));
  hn.add(box(0.12, 0.12, 0.12, DW_GOLD, -0.9, 1.55, 0));
  hn.position.set(1.2, 0, 3.3);
  hn.rotation.y = 0.3;
  g.add(hn);
  const fb = fireBowl(0.5, true, 0.9);
  fb.position.set(2.6, 0, 1.6);
  g.add(fb);
  for (const [x, z, ry] of [[4.2, 2.6, -0.8], [3.8, -0.2, 1.2]] as [number, number, number][]) {
    const b = new THREE.Group();
    b.add(box(0.36, 0.34, 0.5, DW_GRANITE, -0.6, 0, 0), box(0.36, 0.34, 0.5, DW_GRANITE, 0.6, 0, 0), box(1.7, 0.16, 0.56, DW_GRANITE_LT, 0, 0.34, 0));
    b.position.set(x, 0, z);
    b.rotation.y = ry;
    g.add(b);
  }
  return { obj: g, h: 10, w: 6, d: 6 };
}

/** Statue: the Forgelord in bronze, rune hammer raised to the sky, on a stepped plinth of basalt and granite cut with
 *  runes that glow, gold at its corners, fire bowls at its feet. */
function statue(): Built {
  const g = new THREE.Group();
  g.add(frustum(4.6, 4.6, 4.1, 4.1, 0.4, DW_BASALT));
  g.add(frustum(3.3, 3.3, 2.8, 2.8, 1.5, DW_GRANITE, 0, 0.4, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const face = new THREE.Group();
    runeRow(face, 3, 1.9, 0, 1.15, 0, 0.36, i * 2);
    face.position.set(Math.sin(a) * 1.55, 0, Math.cos(a) * 1.55);
    face.rotation.y = a;
    g.add(face);
  }
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(box(0.36, 1.5, 0.36, DW_GOLD, x * 1.45, 0.4, z * 1.45));
  g.add(frustum(3.1, 3.1, 2.7, 2.7, 0.35, DW_GRANITE_LT, 0, 1.9, 0));
  const k = kingStatue(0.64, DW_BRONZE, DW_BRONZE_DK, DW_GOLD, true);
  k.position.set(0, 2.25, -0.2);
  g.add(k);
  for (const x of [-1, 1]) {
    const fb = fireBowl(0.34, false, 0.6);
    fb.position.set(x * 1.85, 0.4, 1.85);
    g.add(fb);
  }
  return { obj: g, h: 7.4, w: 5, d: 5 };
}

/** A market stall of the hold: a stone counter under a sloping sheet of bronze on stone posts, wares laid out on it. */
function stoneStall(wares: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.4, 0.86, 1.2, DW_GRANITE));
  g.add(box(2.5, 0.12, 1.3, DW_GRANITE_LT, 0, 0.86, 0));
  for (const x of [-1.1, 1.1]) g.add(box(0.24, 2.3, 0.24, DW_GRANITE_LT, x, 0, -0.62));
  const aw = new THREE.Group();
  aw.add(box(2.7, 0.08, 1.9, wares % 2 ? DW_BRONZE : DW_BRONZE_DK, 0, 0, 0));
  for (let i = 0; i < 5; i++) aw.add(box(0.06, 0.06, 1.9, wares % 2 ? DW_BRONZE_DK : DW_BRONZE, -1.2 + i * 0.6, 0.07, 0));
  aw.add(box(2.72, 0.22, 0.06, DW_GOLD, 0, -0.18, 0.95));
  aw.position.set(0, 2.2, 0.1);
  aw.rotation.x = 0.28;
  g.add(aw);
  const top = 0.98;
  switch (wares % 4) {
    case 0: { const ig = ingots(6, true); ig.position.set(-0.5, top, 0); g.add(ig); const ig2 = ingots(6); ig2.position.set(0.6, top, 0); g.add(ig2); break; }
    case 1: for (let i = 0; i < 6; i++) g.add(glow(new THREE.OctahedronGeometry(0.11, 0), [0xff5a4a, 0x5ad0ff, 0x7aff8a, 0xffd24a][i % 4], [0x8a1a10, 0x1a6a9a, 0x1a8a2a, 0x8a6a10][i % 4]).translateX(-0.8 + i * 0.32).translateY(top + 0.12).translateZ((r() - 0.5) * 0.5)); g.add(box(1.6, 0.06, 0.6, CLOTH, 0, top, 0)); break;
    case 2: g.add(keg(-0.6, 0, 0.6).translateY(top), keg(0.2, 0.1, 0.6).translateY(top)); for (let i = 0; i < 3; i++) g.add(cyl(0.08, 0.07, 0.2, 0x8a6a40, 6, 0.7 + i * 0.2, top, 0.2)); break;
    default: for (let i = 0; i < 5; i++) { g.add(cyl(0.05, 0.06, 0.16, 0xe8dcc8, 5, -0.8 + i * 0.4, top, 0)); g.add(cyl(0.18, 0.06, 0.1, i % 2 ? 0xc8603a : 0xd8c8a8, 7, -0.8 + i * 0.4, top + 0.14, 0)); }
  }
  return g;
}

/** Market: the trading hall. Stone stalls under bronze awnings, ingots, gems, ale and mushrooms; a mine cart of ore on its
 *  rails, crates and kegs; a great bronze balance on a pillar; lanterns on posts. */
function market(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const spots: [number, number, number][] = [[-2.8, 0, 0.2], [0.4, -1.8, -0.2], [3.4, 0.6, 0.4], [-0.6, 2.6, -0.1]];
  const n = Math.min(4, t + 1);
  for (let i = 0; i < n; i++) {
    const s = stoneStall(i, r);
    s.position.set(spots[i][0], 0, spots[i][1]);
    s.rotation.y = spots[i][2];
    g.add(s);
  }
  g.add(dwarfCrate(-4.2, 2.0), dwarfCrate(-4.4, 3.0, 0.9, 0.4), keg(4.4, 2.8), keg(3.8, 3.5));
  const rl = rails(3.6);
  rl.rotation.y = Math.PI / 2;
  rl.position.set(-0.4, 0, 4.4);
  g.add(rl);
  const mc = mineCart(1, true, true);
  mc.rotation.y = Math.PI / 2;
  mc.position.set(1.5, 0.08, 4.4);
  g.add(mc);
  if (t >= 3) {
    // the great balance, where the ore is weighed
    const sc = new THREE.Group();
    sc.add(frustum(0.7, 0.7, 0.5, 0.5, 0.3, DW_BASALT), box(0.3, 2.2, 0.3, DW_GRANITE, 0, 0.3, 0));
    sc.add(box(2.2, 0.1, 0.1, DW_BRONZE, 0, 2.5, 0), cone(0.14, 0.3, DW_GOLD, 5, 0, 2.5, 0));
    for (const x of [-1, 1]) {
      sc.add(box(0.03, 0.7, 0.03, 0x2a2420, x * 1.0, 1.8, 0));
      sc.add(cyl(0.34, 0.26, 0.1, DW_BRONZE, 8, x * 1.0, 1.72, 0));
    }
    sc.add(blob(0.2, ORE, -1.0, 1.9, 0, 1, 0.6, 1), blob(0.16, DW_GOLD, 1.0, 1.86, 0, 1, 0.6, 1));
    sc.position.set(-4.0, 0, -1.9);
    g.add(sc);
  }
  if (t >= 4) for (const [x, z] of [[4.6, -1.6], [-4.6, 4.4]]) { const p = forgePost(2.4); p.position.set(x, 0, z); g.add(p); }
  return { obj: g, h: 5.5, w: 10, d: 8 };
}

/** A barrel vault of dressed stone on a basalt plinth, its front at +Z: bronze ribs over it, a stone arch round its face,
 *  buttresses down its flanks and great bronze doors under a rune. */
function vault(w: number, d: number, h: number, doorW: number, doorH: number, rune = true): THREE.Group {
  const g = new THREE.Group();
  const r = w / 2;
  g.add(box(w + 0.5, 0.5, d + 0.4, DW_BASALT));
  g.add(box(w, h, d, DW_GRANITE, 0, 0.5, 0));
  // a low vault (flattened, as the dwarves build them), stone ribs over it and a ridge of bronze
  const vk = 0.7;
  g.add(mesh(new THREE.CylinderGeometry(r, r, d, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(1, vk, 1), DW_GRANITE).translateY(h + 0.5));
  for (let i = 0; i < 4; i++) {
    const rib = mesh(new THREE.TorusGeometry(r + 0.05, 0.14, 4, 12, Math.PI).scale(1, vk, 1), DW_BASALT_MD);
    rib.position.set(0, h + 0.5, -d / 2 + 0.4 + (i * (d - 0.8)) / 3);
    g.add(rib);
  }
  g.add(box(0.5, 0.2, d + 0.2, DW_BRONZE, 0, h + 0.4 + r * vk, 0));
  g.add(mesh(new THREE.TorusGeometry(r - 0.1, 0.32, 4, 12, Math.PI).scale(1, vk, 1), DW_GRANITE_LT).translateY(h + 0.5).translateZ(d / 2 + 0.05));
  g.add(frustum(0.7, 0.7, 0.9, 0.7, 0.6, DW_GRANITE_LT, 0, h + 0.5 + r * vk - 0.5, d / 2 + 0.05));
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.add(frustum(0.7, 0.9, 0.4, 0.7, h + 0.4, DW_GRANITE_LT, s * (w / 2 + 0.3), 0.3, -d / 2 + 0.8 + (i * (d - 1.6)) / 2));
  g.add(box(doorW, doorH, 0.2, DW_BRONZE, 0, 0.5, d / 2 + 0.05));
  g.add(box(0.06, doorH, 0.08, DW_BRONZE_DK, 0, 0.5, d / 2 + 0.16));
  for (const y of [0.3, 0.62]) g.add(box(doorW + 0.04, 0.12, 0.08, DW_BRONZE_DK, 0, 0.5 + doorH * y, d / 2 + 0.17));
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) g.add(blob(0.07, DW_GOLD, sx * doorW * 0.28, 0.5 + doorH * (0.18 + i * 0.3), d / 2 + 0.18));
  for (const s of [-1, 1]) g.add(box(0.34, doorH + 0.1, 0.36, DW_GRANITE_LT, s * (doorW / 2 + 0.17), 0.5, d / 2 + 0.08));
  g.add(frustum(doorW + 0.7, 0.44, doorW + 1.1, 0.44, 0.5, DW_GRANITE_LT, 0, 0.5 + doorH, d / 2 + 0.1));
  if (rune) {
    const rn = forgeRune(0.44, 1);
    rn.position.set(0, 0.5 + doorH + 0.25, d / 2 + 0.34);
    g.add(rn);
  }
  return g;
}

/** Warehouse: the vaulted storehouse, bronze-doored, crates and kegs stacked by it; a second vault behind it as it grows,
 *  and at its greatest a stone derrick lifting a crate, gold ingots stacked below. */
function warehouse(t: number): Built {
  const g = new THREE.Group();
  g.add(vault(8, 6, 3.0 - 0.5, 2.6, 2.7, false));
  for (let i = 0; i < 3 + t; i++) g.add(dwarfCrate(4.7 + (i % 2) * 0.9, 2.6 - Math.floor(i / 2) * 0.9, 0.9, (i % 3) * 0.2));
  g.add(keg(-4.8, 2.4), keg(-4.4, 3.2), keg(-5.0, 1.5));
  if (t >= 2) {
    const v2 = vault(5.6, 4.6, 2.2, 1.8, 2.0);
    v2.position.set(-1.8, 0, -5.8);
    g.add(v2);
  }
  if (t >= 3) {
    const dr = new THREE.Group();
    dr.add(frustum(1.2, 1.2, 0.9, 0.9, 0.6, DW_BASALT_MD), box(0.36, 5.2, 0.36, DW_OAK, 0, 0.6, 0));
    const jib = limb(V(0, 5.4, 0), V(0, 4.1, 2.4), 0.14, 0.1, DW_OAK, 5);
    dr.add(jib, box(0.04, 1.8, 0.04, 0x2a2420, 0, 2.3, 2.4));
    dr.add(dwarfCrate(0, 2.4, 0.8).translateY(1.5));
    dr.position.set(4.6, 0, -2.0);
    dr.rotation.y = 0.5;
    g.add(dr);
    const ig = ingots(9, true);
    ig.position.set(5.6, 0, -0.4);
    g.add(ig);
  }
  return { obj: g, h: 8, w: 10, d: 8 };
}

/** Hiding place: a knoll of black rock with a round vault-door of bronze in its face, locked by a ring of runes. */
function hiding(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const s = t >= 2 ? 1.18 : 1;
  crag(g, [[0, -0.7, 1.4 * s, 1.3 * s, 1], [-1.2, -0.5, 0.9, 0.9, 0], [1.2, -0.6, 1.0, 1.0, 0]], r);
  const y = 0.95 * s, z = 0.5;
  g.add(mesh(new THREE.CylinderGeometry(0.98 * s, 0.98 * s, 0.34, 12).rotateX(Math.PI / 2), DW_GRANITE_LT).translateY(y).translateZ(z));
  g.add(mesh(new THREE.CylinderGeometry(0.76 * s, 0.76 * s, 0.2, 12).rotateX(Math.PI / 2), DW_BRONZE).translateY(y).translateZ(z + 0.12));
  g.add(mesh(new THREE.TorusGeometry(0.58 * s, 0.05, 4, 12), DW_GOLD).translateY(y).translateZ(z + 0.24));
  g.add(mesh(new THREE.TorusGeometry(0.28 * s, 0.05, 4, 10), IRON_BK).translateY(y).translateZ(z + 0.3));
  for (let i = 0; i < 2; i++) { const sp = box(0.6 * s, 0.05, 0.05, IRON_BK, 0, 0, 0); sp.geometry.translate(0, -0.025, 0); sp.position.set(0, y, z + 0.3); sp.rotation.z = (i * Math.PI) / 2 + 0.4; g.add(sp); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.add(blob(0.05, DW_GOLD, Math.cos(a) * 0.68 * s, y + Math.sin(a) * 0.68 * s, z + 0.24)); }
  g.add(box(1.6, 0.14, 0.5, DW_BASALT_MD, 0, 0, z + 0.4));
  if (t >= 2) {
    g.add(glow(new THREE.TorusGeometry(0.7 * s, 0.03, 3, 20)).translateY(y).translateZ(z + 0.26));
    for (const x of [-1.7, 1.7]) { const rs = runeStone(1.0, x > 0 ? 3 : 1); rs.scale.setScalar(0.8); rs.position.set(x, 0, 0.1); g.add(rs); }
  }
  return { obj: g, h: 2.8, w: 3, d: 3 };
}

/** Watchtower: a square tower of granite, battered, stepped buttresses at its corners, bronze bands and slit windows, a
 *  column of runes glowing down its face; at its head a parapet on corbels under a bronze-roofed lookout on four piers,
 *  where the great bronze spyglass is trained on the road, the war-horn hangs on its frame and a signal fire burns. */
function watchtower(t: number, color: number): Built {
  const g = new THREE.Group();
  const h = 7 + t * 1.6;
  const wAt = (y: number) => 3.0 - 0.6 * ((y - 0.5) / (h - 0.5));
  g.add(box(3.8, 0.5, 3.8, DW_BASALT));
  g.add(frustum(3.0, 3.0, 2.4, 2.4, h - 0.5, DW_GRANITE, 0, 0.5, 0));
  // stepped buttresses up the corners
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    g.add(frustum(0.9, 0.9, 0.6, 0.6, h * 0.42, DW_GRANITE_LT, x * 1.42, 0.5, z * 1.42));
    g.add(frustum(0.6, 0.6, 0.42, 0.42, h * 0.3, DW_GRANITE_LT, x * (wAt(h * 0.45) / 2), h * 0.42 + 0.5, z * (wAt(h * 0.45) / 2)));
  }
  for (let y = 3.0; y < h - 1.2; y += 3.0) g.add(box(wAt(y) + 0.14, 0.24, wAt(y) + 0.14, y > h * 0.5 ? DW_BRONZE : DW_BASALT_MD, 0, y, 0));
  for (let y = 3.9; y < h - 1.6; y += 3.0) for (const s of [1, -1]) {
    const w = box(0.26, 0.8, 0.1, C.window, 0, y, s * (wAt(y + 0.4) / 2 + 0.01));
    w.userData.window = true;
    g.add(w);
  }
  for (let i = 0; i < Math.min(4, 1 + Math.floor(t / 2)); i++) {
    const y = 2.2 + i * 0.75;
    const rn = forgeRune(0.5, t + i);
    rn.position.set(0, y, wAt(y) / 2 + 0.04);
    rn.rotation.x = -0.02;
    g.add(rn);
  }
  g.add(box(0.9, 1.5, 0.16, DW_OAK, 0, 0.5, 1.48), box(0.94, 0.08, 0.2, DW_BRONZE, 0, 1.3, 1.5));
  g.add(frustum(1.3, 0.4, 1.6, 0.4, 0.36, DW_GRANITE_LT, 0, 2.0, 1.5));
  // the parapet on its corbels
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const k of [-0.8, 0, 0.8]) {
    const c = frustum(0.3, 0.2, 0.3, 0.5, 0.46, DW_GRANITE_LT, dx * 1.25 + dz * k, h - 0.52, dz * 1.25 + dx * k);
    c.rotation.y = Math.atan2(dx, dz);
    g.add(c);
  }
  g.add(box(3.6, 0.4, 3.6, DW_GRANITE_LT, 0, h - 0.1, 0));
  // the lookout: four piers at the corners, a low wall between them (open to the front), a bronze roof over it all
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(box(0.44, 2.3, 0.44, DW_GRANITE, x * 1.52, h + 0.3, z * 1.52));
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, -1]]) g.add(box(dz ? 2.6 : 0.3, 0.55, dz ? 0.3 : 2.6, DW_GRANITE, dx * 1.56, h + 0.3, dz * 1.56));
  g.add(box(3.7, 0.3, 3.7, DW_BRONZE_DK, 0, h + 2.6, 0));
  g.add(cone(2.75, 1.35, DW_BRONZE, 4, 0, h + 2.9).rotateY(Math.PI / 4));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(limb(V(Math.cos(a) * 1.9, h + 2.95, Math.sin(a) * 1.9), V(0, h + 4.2, 0), 0.06, 0.05, DW_BRONZE_DK, 4));
  }
  g.add(blob(0.18, DW_GOLD, 0, h + 4.3, 0), cone(0.07, 0.5, DW_GOLD, 5, 0, h + 4.4, 0));
  // the great spyglass on its mount
  g.add(cyl(0.14, 0.22, 0.8, DW_BRONZE_DK, 6, 0.5, h + 0.3, 0.2));
  const sg = new THREE.Group();
  sg.add(mesh(new THREE.CylinderGeometry(0.13, 0.24, 2.3, 8).rotateX(Math.PI / 2), DW_BRONZE));
  for (const z of [-0.8, 0.1, 0.9]) sg.add(mesh(new THREE.CylinderGeometry(0.26 - z * 0.04, 0.26 - z * 0.04, 0.1, 8).rotateX(Math.PI / 2), DW_GOLD).translateZ(z));
  sg.add(glow(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 8).rotateX(Math.PI / 2), 0x9fe0ff, 0x2a6a9a).translateZ(1.16));
  sg.position.set(0.5, h + 1.2, 0.5);
  sg.rotation.set(-0.12, 0.3, 0);
  g.add(sg);
  // the war-horn hung on its frame, the signal fire
  g.add(box(0.12, 1.3, 0.12, DW_OAK, -1.0, h + 0.3, -0.6), box(0.12, 1.3, 0.12, DW_OAK, -1.0, h + 0.3, 0.6));
  g.add(box(0.12, 0.12, 1.4, DW_OAK, -1.0, h + 1.55, 0));
  g.add(horn(V(-1.0, h + 1.35, -0.7), V(-1.2, h + 1.0, 0.1), V(-0.9, h + 1.5, 0.8), 0.16, DW_BRONZE, 5));
  g.add(cone(0.24, 0.26, DW_GOLD, 8, -0.9, h + 1.5, 0.8).rotateX(-Math.PI / 2));
  const fb = fireBowl(0.1, t >= 4, 0.62);
  fb.position.set(0.8, h + 0.3, -0.8);
  g.add(fb);
  if (t >= 3) {
    // the ruler's banner hung long from the lookout's roof down the tower's face
    const bh = Math.min(4.2, h * 0.3), bw = 1.2;
    g.add(box(bw + 0.3, 0.1, 0.1, DW_GOLD, 0, h - 0.5, 1.86));
    g.add(box(bw, bh, 0.05, color, 0, h - 0.5 - bh, 1.86));
    for (const x of [-bw / 3, bw / 3]) g.add(cone(bw / 6, 0.4, color, 3, x, h - 0.5 - bh, 1.86).rotateZ(Math.PI));
    const rn = forgeRune(0.6, 4);
    rn.position.set(0, h - 0.5 - bh * 0.5, 1.9);
    g.add(rn);
  }
  return { obj: g, h: h + 5, w: 4, d: 4 };
}

/** What the forge-folk need from outside this module (trees are the village's own, drawn by props). */
export interface ForgeKit {
  tree: (kind: 'oak' | 'pine' | 'birch', r: () => number, scale?: number, detail?: number) => THREE.Group;
}

/** Timber camp: the prop-wrights' yard. The wood thins as it is felled; the logs are squared into props for the mines and
 *  stacked in cribs; a stone lean-to, a lodge, a saw-bench, a cart on rails, a derrick, and a steam saw turning. */
function timberCamp(t: number, r: () => number, kit: ForgeKit): Built {
  const g = new THREE.Group();
  const n = 13 - t;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.3 - r() * Math.PI * 0.65, d = 7 + r() * 4;
    const tr = kit.tree(r() < 0.35 ? 'pine' : r() < 0.2 ? 'birch' : 'oak', r, 1.05);
    tr.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    g.add(tr);
  }
  for (let i = 0; i < 2 + t; i++) {
    const a = -Math.PI * 0.1 - r() * Math.PI * 0.8, d = 3.5 + r() * 4;
    g.add(cyl(0.36, 0.44, 0.45, 0x4a3422, 7, Math.cos(a) * d, 0, Math.sin(a) * d), cyl(0.35, 0.35, 0.02, 0xb08a5a, 7, Math.cos(a) * d, 0.45, Math.sin(a) * d));
  }
  const piles = Math.min(5, 1 + Math.floor(t * 0.7));
  for (let i = 0; i < piles; i++) {
    const p = beamStack(Math.min(9, 4 + t), 2.4);
    p.position.set(-3.6 + i * 2.2, 0.1, 3.4 + (i % 2) * 1.3);
    p.rotation.y = 0.15 * i;
    g.add(p);
  }
  // the chopping block, an axe bitten into it
  g.add(cyl(0.45, 0.55, 0.5, 0x4a3422, 7, 2.8, 0, 0.6));
  g.add(limb(V(2.8, 0.45, 0.6), V(3.2, 1.2, 0.6), 0.04, 0.04, DW_OAK, 4), box(0.3, 0.22, 0.05, STEEL, 2.86, 0.48, 0.6));
  if (t === 1) {
    for (const x of [-5, -3]) g.add(box(0.36, 1.9, 0.36, DW_GRANITE, x, 0, -0.6));
    const lean = box(2.7, 0.18, 2.3, DW_SLAB, -4, 1.3, 0.2);
    lean.rotation.x = 0.5;
    g.add(lean);
  }
  if (t >= 2) {
    const hut = house({ w: 4.4, d: 3.6, h: 2.3, roofH: 1.8, roof: C.thatch, windows: 1 });
    hut.position.set(-6.3, 0, -1.4);
    hut.rotation.y = 0.5;
    g.add(hut);
  }
  if (t >= 3) {
    // a saw-bench of stone trestles, a squared log on it and the long saw
    const sb = new THREE.Group();
    for (const x of [-0.9, 0.9]) sb.add(frustum(0.5, 0.8, 0.3, 0.6, 0.9, DW_GRANITE, x, 0, 0));
    sb.add(box(3.0, 0.4, 0.4, 0x7a5636, 0.4, 0.9, 0));
    sb.add(box(0.05, 1.3, 0.34, STEEL, 0.3, 0.6, 0.3));
    sb.position.set(2.2, 0, 3.8);
    g.add(sb);
  }
  if (t >= 4) {
    const rl = rails(4.4);
    rl.rotation.y = Math.PI / 2 + 0.3;
    rl.position.set(3.2, 0, 2.2);
    g.add(rl);
    const c = mineCart(1, false);
    for (let i = 0; i < 3; i++) c.add(box(0.26, 0.26, 1.7, DW_OAK, -0.3 + i * 0.3, 0.9, 0));
    c.position.set(5.0, 0.08, 2.6);
    c.rotation.y = Math.PI / 2 + 0.3;
    g.add(c);
  }
  if (t >= 5) {
    // a derrick for the great trunks
    const cr = new THREE.Group();
    cr.add(frustum(1.2, 1.2, 0.9, 0.9, 0.6, DW_BASALT_MD), box(0.3, 5.0, 0.3, DW_OAK, 0, 0.6, 0));
    cr.add(limb(V(0, 5.4, 0), V(2.4, 4.4, 0), 0.13, 0.1, DW_OAK, 5), box(0.04, 1.6, 0.04, 0x2a2420, 2.4, 2.9, 0));
    cr.add(box(2.8, 0.36, 0.36, 0x7a5636, 2.4, 2.5, 0));
    cr.position.set(5.6, 0, -3.8);
    cr.rotation.y = -0.5;
    g.add(cr);
  }
  if (t >= 6) {
    // the steam saw under its shed
    const mill = new THREE.Group();
    for (const x of [-2.4, 2.4]) for (const z of [-1.5, 1.5]) mill.add(box(0.4, 2.6, 0.4, DW_GRANITE, x, 0, z));
    const roof = box(5.6, 0.18, 3.8, DW_SLAB, 0, 2.6, 0);
    roof.rotation.x = 0.1;
    mill.add(roof);
    mill.add(box(3.4, 0.9, 1.0, DW_GRANITE, 0.4, 0, 0));
    const bl = boiler(1.6, 0.5, 2.4);
    bl.position.set(-1.8, 0, -0.6);
    mill.add(bl);
    const sawParts = new THREE.Group();
    sawParts.add(mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.05, 16).rotateX(Math.PI / 2), STEEL));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const tth = mesh(new THREE.BoxGeometry(0.16, 0.12, 0.06), 0x8a959c); tth.position.set(Math.cos(a) * 0.88, Math.sin(a) * 0.88, 0); tth.rotation.z = a; sawParts.add(tth); }
    sawParts.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8).rotateX(Math.PI / 2), DW_BRONZE));
    const saw = swarm(sawParts, { spin: true });
    saw.position.set(0.8, 1.2, 0);
    mill.add(saw);
    mill.add(box(3.2, 0.4, 0.4, 0x7a5636, -0.4, 0.9, 0));
    mill.position.set(0.4, 0, -4.4);
    g.add(mill);
  }
  if (t >= 7) {
    const lodge = house({ w: 5.6, d: 4.4, h: 3.2, roofH: 2.3, windows: 2, stone: true });
    lodge.position.set(-7.6, 0, 4.2);
    lodge.rotation.y = 1.1;
    g.add(lodge);
  }
  const post = forgePost(2.2);
  post.position.set(4.2, 0, 6.2);
  g.add(post);
  return { obj: g, h: 6 + (t >= 5 ? 1.5 : 0), w: 10, d: 10 };
}

/** A kiln of the hold: a dome of granite blocks bound in bronze, a squat stack, its mouth glowing. */
function forgeKiln(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(1.8, 1.85, 0.4, DW_BASALT, 10));
  g.add(mesh(new THREE.SphereGeometry(1.6, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), DW_GRANITE).translateY(0.35));
  for (const y of [0.9, 1.5]) g.add(cyl(Math.sqrt(Math.max(0.1, 2.56 - (y - 0.35) ** 2)) + 0.04, Math.sqrt(Math.max(0.1, 2.56 - (y - 0.35) ** 2)) + 0.04, 0.14, DW_BRONZE_DK, 10, 0, y - 0.07, 0));
  g.add(box(0.7, 0.9, 0.4, DW_GRANITE_LT, 0.5, 1.5, -0.4));
  g.add(smokeAt(0.5, 2.7, -0.4));
  g.add(frustum(1.2, 0.5, 1.4, 0.5, 1.0, DW_GRANITE_LT, 0, 0.3, 1.4));
  g.add(glow(new THREE.BoxGeometry(0.7, 0.55, 0.1), 0xff8a3a, 0xc0501a).translateY(0.62).translateZ(1.66));
  return g;
}

/** Clay pit: dug in stone-kerbed terraces, a stair cut down into it, water in the bottom, a steam pump drawing it off;
 *  bricks drying and stacked, a cart on rails, a stone hut, kilns and the brickworks, and a tall stack at its greatest. */
function clayPit(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const pr = 2.4 + t * 0.4;
  const pit = cyl(pr + 0.8, pr, 0.35, C.clay, 12, 0, -0.2);
  pit.scale.set(1.25, 1, 1);
  g.add(pit);
  // a kerb of dressed blocks round the rim (a gap left where the stair goes down)
  const nk = 26;
  for (let i = 0; i < nk; i++) {
    const a = (i / nk) * Math.PI * 2;
    if (t >= 2 && Math.abs(Math.atan2(Math.sin(a - 2.62), Math.cos(a - 2.62))) < 0.2) continue;
    const x = Math.cos(a) * (pr + 0.95) * 1.25, z = Math.sin(a) * (pr + 0.95);
    const b = box(((pr + 0.95) * 2 * Math.PI * 1.1) / nk, 0.34 + (i % 3) * 0.05, 0.5, i % 4 === 1 ? DW_GRANITE_LT : DW_GRANITE, x, -0.05, z);
    b.rotation.y = -Math.atan2(Math.cos(a) * (pr + 0.95), -Math.sin(a) * (pr + 0.95) * 1.25);
    g.add(b);
  }
  const steps = Math.min(3, Math.floor((t + 1) / 2));
  for (let k = 1; k <= steps; k++) {
    const ring = cyl(pr - k * 0.8 + 0.3, pr - k * 0.8, 0.1, k % 2 ? C.clayDark : C.clay, 12, 0, 0.04 + k * 0.03);
    ring.scale.set(1.25, 1, 1);
    g.add(ring);
    // the terrace's edge, faced in stone
    const lip = mesh(new THREE.TorusGeometry(pr - k * 0.8 + 0.3, 0.07, 3, 18).rotateX(Math.PI / 2), DW_GRANITE_LT);
    lip.scale.set(1.25, 1, 1);
    lip.position.y = 0.13 + k * 0.03;
    g.add(lip);
  }
  if (t >= 3) {
    const water = cyl(pr * 0.35, pr * 0.35, 0.06, 0x3a4c56, 10, 0, 0.16);
    water.scale.set(1.25, 1, 1);
    g.add(water);
    // the steam pump drawing the water off
    const pm = new THREE.Group();
    const bl = boiler(1.8, 0.5, 2.2);
    pm.add(bl);
    pm.add(box(0.3, 2.4, 0.3, IRON_BK, 0.6, 0, 0.7), box(2.6, 0.18, 0.18, IRON_BK, 0.2, 2.4, 0.7));
    pm.position.set(-pr * 1.25 - 1.2, 0, -1.6);
    pm.rotation.y = 0.3;
    g.add(pm);
    g.add(limb(V(-pr * 1.25 - 0.6, 1.0, -0.8), V(-pr * 0.3, 0.2, -0.3), 0.1, 0.1, DW_BRONZE, 6));
  }
  if (t >= 2) {
    // a stair cut down into the pit
    for (let i = 0; i < 4; i++) g.add(box(0.9, 0.16, 0.5, DW_GRANITE, -pr * 0.95 + i * 0.4, 0.14 - i * 0.02, 1.2 + i * 0.1));
  }
  const stacks = Math.min(8, t + 1);
  for (let i = 0; i < stacks; i++) {
    const st = new THREE.Group();
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) st.add(box(0.5, 0.26, 0.9, (x + y + i) % 2 ? C.brick : 0x96402a, x * 0.55 - 0.55, y * 0.27, 0));
    st.add(box(1.7, 0.08, 1.0, DW_OAK, 0, -0.06, 0));
    st.position.set(6.6 + (i % 2) * 1.8, 0.06, -3.4 + Math.floor(i / 2) * 1.6);
    g.add(st);
  }
  if (t >= 2) {
    const rows = Math.min(4, t - 1);
    for (let rr = 0; rr < rows; rr++) for (let i = 0; i < 7; i++) g.add(box(0.42, 0.18, 0.24, C.clay, -2.2 + i * 0.6, 0, 5.2 + rr * 0.55));
    const rl = rails(3.2);
    rl.rotation.y = Math.PI / 2 + 0.6;
    rl.position.set(2.2, 0, 4.4);
    g.add(rl);
    const c = mineCart(1, false);
    c.add(box(0.8, 0.3, 1.1, C.clay, 0, 0.8, 0));
    c.position.set(3.4, 0.08, 5.2);
    c.rotation.y = Math.PI / 2 + 0.6;
    g.add(c);
  }
  for (let i = 0; i < 3; i++) g.add(blob(0.7 + r() * 0.2, DW_BASALT_MD, -6 + r() * 1.5, 0.2, -4 + i * 1.6, 1.2, 0.7, 1.1));
  if (t >= 3) {
    const hut = house({ w: 4.2, d: 3.4, h: 2.2, roofH: 1.7, roof: C.thatch, windows: 1 });
    hut.position.set(-7, 0, 3.2);
    hut.rotation.y = 0.8;
    g.add(hut);
  }
  if (t >= 4) { const k = forgeKiln(); k.position.set(4.6, 0, -5.8); g.add(k); }
  if (t >= 5) {
    const shed = new THREE.Group();
    for (const x of [-2.6, 2.6]) for (const z of [-1.4, 1.4]) shed.add(box(0.36, 2.4, 0.36, DW_GRANITE, x, 0, z));
    const roof = box(6.0, 0.18, 3.6, DW_SLAB, 0, 2.4, 0);
    roof.rotation.x = -0.12;
    shed.add(roof);
    shed.add(box(4.2, 0.9, 1.0, DW_GRANITE_LT, 0, 0, 0));
    for (let i = 0; i < 6; i++) shed.add(box(0.4, 0.16, 0.24, C.clay, -1.6 + i * 0.64, 0.9, 0));
    shed.position.set(-3.2, 0, -6.4);
    g.add(shed);
  }
  if (t >= 6) { const k = forgeKiln(); k.position.set(8.4, 0, 2.6); k.rotation.y = -1.2; g.add(k); }
  if (t >= 7) {
    g.add(frustum(1.5, 1.5, 0.9, 0.9, 7.6, DW_GRANITE, 1.2, 0, -8.4));
    for (const y of [2.5, 5.0, 7.2]) g.add(box(1.5 - (y / 7.6) * 0.6 + 0.12, 0.2, 1.5 - (y / 7.6) * 0.6 + 0.12, DW_BRONZE_DK, 1.2, y, -8.4));
    g.add(smokeAt(1.2, 7.9, -8.4));
  }
  const post = forgePost(2.2);
  post.position.set(1.4, 0, 6.8);
  g.add(post);
  return { obj: g, h: 4 + (t >= 7 ? 5 : t >= 4 ? 2 : 0), w: 12, d: 10 };
}

/** A headframe over a shaft: a stone collar round the black mouth, an A-frame of iron beams, the great winding wheel
 *  turning at its head and a cage hung below it. */
function headframe(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.4, 0.5, 2.4, DW_GRANITE_LT));
  g.add(box(1.7, 0.06, 1.7, SOOT, 0, 0.5, 0));
  for (const s of [-1, 1]) for (const z of [-0.8, 0.8]) g.add(limb(V(s * 1.1, 0.4, z), V(s * 0.3, h, z * 0.6), 0.12, 0.1, IRON_BK, 4));
  for (const z of [-0.5, 0.5]) g.add(limb(V(-0.95, h * 0.5, z * 1.4), V(0.95, h * 0.5, z * 1.4), 0.06, 0.06, IRON_BK, 4));
  g.add(box(1.2, 0.3, 1.4, IRON_BK, 0, h, 0));
  // the winding wheel spins about its own Z, so it is set in a holder turned to face along X
  const spinner = new THREE.Group();
  spinner.add(mesh(new THREE.TorusGeometry(0.95, 0.08, 4, 16), DW_BRONZE));
  for (let i = 0; i < 4; i++) { const sp = mesh(new THREE.BoxGeometry(0.06, 1.9, 0.06), DW_BRONZE_DK); sp.rotation.z = (i / 4) * Math.PI; spinner.add(sp); }
  const spin = swarm(spinner, { spin: true });
  const hold = new THREE.Group();
  hold.add(spin);
  hold.position.set(0, h + 0.9, 0);
  hold.rotation.y = Math.PI / 2;
  g.add(hold);
  g.add(box(0.04, h - 1.0, 0.04, 0x2a2420, 0, 1.9, 0.5));
  g.add(box(0.7, 0.9, 0.6, IRON_BK, 0, 1.0, 0.45));
  return g;
}

/** Iron mine: the deep workings. The mountain grows craggier as they spread; the adit, timbered at first and then a
 *  stone portal with a rune over it, rails running out to an ore tip with carts on them; a headframe over the shaft,
 *  its wheel turning and the winding engine steaming; a blast furnace pouring iron; a second adit; at its greatest a
 *  great stone gate into the hill with an ancestor keeping it. The Forgelord's mines run deep and rich. */
function ironMine(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const grow = 0.75 + t * 0.06;
  const hill: [number, number, number, number][] = [
    [0, -3.4, 5.4, 4.6], [-5, -1.8, 4, 3.2], [5, -2.2, 4.5, 3.6], [-2, -6.2, 5, 6.0], [3.5, -6.6, 4.5, 5.0], [-6.5, -5.6, 3.6, 4.2], [7, -5.8, 3.4, 3.6],
  ].slice(0, 4 + Math.min(3, Math.floor(t / 2))) as [number, number, number, number][];
  hill.forEach(([x, z, sc, h], i) => {
    const k = i === 0 ? 1 : grow;
    const m = blob(sc * k, i % 2 ? DW_BASALT : DW_BASALT_MD, x, h * k * 0.32, z - (k - 1) * 5, 1.1, h / sc, 1.0);
    m.rotation.y = r() * 3;
    g.add(m);
  });
  // the rock shouldering in round the mouth of the mine
  for (const s of [-1, 1]) {
    const m = blob(1.6, s > 0 ? DW_BASALT_MD : DW_BASALT, s * 3.3, 0.9, 0.5, 1.1, 1.5, 1.0);
    m.rotation.y = s;
    g.add(m);
  }
  g.add(blob(2.2, DW_BASALT_MD, 0, 3.5 + (t >= 3 ? 0.6 : 0), -1.3, 1.4, 0.7, 1.0));
  // the adit: timbered at first, then a portal of dressed stone
  if (t < 3) {
    const ad = adit(2.4, 2.7);
    ad.position.set(0, 0, 1.3);
    g.add(ad);
  } else {
    g.add(box(2.6, 2.9, 1.0, SOOT, 0, 0, 1.2));
    portal(g, 2.1, 2.6, 2.9, t >= 5 ? 3 : 2);
    if (t >= 5) {
      const f = carvedFace(0.46);
      f.position.set(0, 5.5, 1.6);
      g.add(f);
    }
  }
  const railLen = 3 + Math.min(4, t) * 0.8;
  const rl = rails(railLen);
  rl.position.set(0, 0, 1.7);
  g.add(rl);
  // the ore tip at the end of the line: a trestle and an end-stop, ore spilled down its side
  g.add(box(1.6, 0.6, 0.4, DW_OAK, 0, 0, 1.9 + railLen));
  g.add(box(1.8, 0.16, 0.5, IRON_BK, 0, 0.6, 1.9 + railLen));
  const cart = mineCart(1, true, t >= 5);
  cart.position.set(0, 0.1, 1.7 + railLen - 0.8);
  g.add(cart);
  for (let i = 0; i < Math.min(5, t); i++) {
    const oh = oreHeap(0.9 + r() * 0.3, t >= 5 && i % 2 === 1);
    oh.position.set(-4.6 + i * 1.5, 0, 4.2 + (i % 2) * 0.9);
    g.add(oh);
  }
  if (t >= 2) {
    const p = forgePost(2.0);
    p.position.set(-2, 0, 2.4);
    g.add(p);
    const bs = beamStack(6, 2.2);
    bs.position.set(2.6, 0.1, 3.0);
    bs.rotation.y = -0.4;
    g.add(bs);
  }
  if (t >= 3) {
    const hut = house({ w: 4, d: 3.2, h: 2.2, roofH: 1.6, roof: C.slate, windows: 1 });
    hut.position.set(5, 0, 3.8);
    hut.rotation.y = -0.5;
    g.add(hut);
  }
  if (t >= 4) {
    // the headframe over the shaft, and its winding engine steaming beside it
    const hf = headframe(5.6);
    hf.position.set(-5.8, 0, 1.6);
    g.add(hf);
    const bl = boiler(1.8, 0.55, 2.4);
    bl.position.set(-7.8, 0, 3.4);
    bl.rotation.y = 0.5;
    g.add(bl);
  }
  if (t >= 5) {
    // the blast furnace, iron pouring from its tap into the pig-moulds
    const fu = new THREE.Group();
    fu.add(frustum(2.6, 2.6, 1.6, 1.6, 4.2, DW_GRANITE));
    for (const y of [1.2, 2.6, 3.8]) { const w = 2.6 - (y / 4.2) * 1.0 + 0.1; fu.add(box(w, 0.2, w, DW_BRONZE_DK, 0, y, 0)); }
    fu.add(box(1.8, 0.5, 1.8, DW_GRANITE_LT, 0, 4.2, 0));
    fu.add(smokeAt(0, 5.0, 0));
    fu.add(box(0.8, 0.7, 0.3, SOOT, 0, 0.3, 1.2));
    fu.add(glow(new THREE.BoxGeometry(0.6, 0.5, 0.06), DW_LAVA, DW_LAVA_E).translateY(0.62).translateZ(1.36));
    fu.add(box(0.5, 0.2, 2.2, DW_BASALT, 0, 0, 2.3));
    fu.add(lava(new THREE.BoxGeometry(0.26, 0.05, 2.1)).translateY(0.2).translateZ(2.3));
    for (let i = 0; i < 3; i++) { fu.add(box(0.44, 0.2, 0.3, DW_BASALT, (i - 1) * 0.55, 0, 3.6)); fu.add(lava(new THREE.BoxGeometry(0.3, 0.04, 0.18)).translateX((i - 1) * 0.55).translateY(0.2).translateZ(3.6)); }
    fu.position.set(7.0, 0, -0.8);
    fu.rotation.y = -0.4;
    g.add(fu);
    g.add(blob(1.1, 0x3a3432, 8.8, 0.2, 2.6, 1.2, 0.45, 1.1));
  }
  if (t >= 6) {
    // a second adit into the hill, and another cart
    const e2 = adit(1.9, 2.2, false);
    e2.position.set(-3.2, 0, -1.4);
    e2.rotation.y = 0.4;
    g.add(e2);
    const c2 = mineCart(1, true, true);
    c2.position.set(0, 0.1, 2.5);
    g.add(c2);
  }
  if (t >= 7) {
    const lodge = house({ w: 5, d: 3.8, h: 2.8, roofH: 1.9, roof: C.slate, windows: 2, stone: true });
    lodge.position.set(-7.5, 0, 7.2);
    lodge.rotation.y = 0.4;
    g.add(lodge);
    // an ancestor with his pick, keeping the mine
    g.add(frustum(1.4, 1.4, 1.1, 1.1, 0.9, DW_BASALT_MD, 3.6, 0, 1.8));
    const k = kingStatue(0.42);
    k.position.set(3.6, 0.9, 1.7);
    k.rotation.y = -0.3;
    g.add(k);
  }
  for (let i = 0; i < 5; i++) g.add(blob(0.8 * (0.8 + r() * 0.4), r() < 0.5 ? DW_BASALT_MD : DW_BASALT, -6 + r() * 12, 0.2, 2 + r() * 4, 1.3, 0.6, 1.1));
  const post = forgePost(2.2);
  post.position.set(2.4, 0, 6.6);
  g.add(post);
  return { obj: g, h: 8 + (t >= 4 ? 1.5 : 0), w: 12, d: 12 };
}

/** A terrace of hardy mountain grain, kerbed with stone (or its stubble, cut). */
function grainTerrace(w: number, d: number, r: () => number, ripe: boolean): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.1, d, 0x5a4a38));
  for (const [x, z, ww, dd] of [[0, d / 2, w + 0.3, 0.3], [0, -d / 2, w + 0.3, 0.3], [w / 2, 0, 0.3, d], [-w / 2, 0, 0.3, d]] as [number, number, number, number][]) g.add(box(ww, 0.32, dd, DW_GRANITE, x, 0, z));
  const rows = Math.max(2, Math.floor(d / 0.9));
  for (let i = 0; i < rows; i++) {
    const z = -d / 2 + (i + 0.5) * (d / rows);
    g.add(box(w - 0.6, 0.42 + r() * 0.12, 0.46, ripe ? 0xc8a24a : 0x8e8a44, 0, 0.06, z));
  }
  return g;
}

/** Mushroom beds: dark tilled rows under low slate shades, pale caps and the orange ember-caps that glow faintly. */
function mushroomBeds(w: number, d: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.1, d, 0x2e2622));
  for (const [x, z, ww, dd] of [[0, d / 2, w + 0.3, 0.3], [0, -d / 2, w + 0.3, 0.3], [w / 2, 0, 0.3, d], [-w / 2, 0, 0.3, d]] as [number, number, number, number][]) g.add(box(ww, 0.32, dd, DW_BASALT_MD, x, 0, z));
  const rows = 3;
  for (let i = 0; i < rows; i++) {
    const z = -d / 2 + (i + 0.5) * (d / rows);
    g.add(box(w - 0.8, 0.24, 0.9, 0x3a2e28, 0, 0.06, z));
    for (let k = 0; k < 6; k++) {
      const x = -w / 2 + 0.8 + k * ((w - 1.6) / 5) + (r() - 0.5) * 0.3;
      const hot = (i + k) % 3 === 0;
      g.add(cyl(0.05, 0.07, 0.18, 0xe8dcc8, 5, x, 0.28, z + (r() - 0.5) * 0.3));
      const cap = hot ? glow(new THREE.CylinderGeometry(0.1, 0.24, 0.14, 7), 0xff9a4a, 0x9a3a0a) : mesh(new THREE.CylinderGeometry(0.1, 0.24, 0.14, 7), k % 2 ? 0xd8c8a8 : 0xb89a78);
      cap.position.set(x, 0.52, z);
      g.add(cap);
    }
  }
  return g;
}

/** A steam mill: a round stone tower under a bronze cone, a boiler at its foot, and a great gear turning on its face. */
function steamMill(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(1.5, 1.9, 5.2, DW_GRANITE, 10));
  g.add(cyl(1.65, 1.65, 0.3, DW_BASALT_MD, 10, 0, 2.6));
  g.add(cone(1.9, 1.8, DW_BRONZE, 10, 0, 5.2));
  g.add(blob(0.18, DW_GOLD, 0, 7.1, 0));
  g.add(box(0.8, 1.4, 0.2, DW_OAK, 0, 0, 1.8));
  const w = box(0.4, 0.6, 0.1, C.window, 0, 3.6, 1.58);
  w.userData.window = true;
  g.add(w);
  const bl = boiler(1.4, 0.45, 2.0);
  bl.position.set(1.8, 0, 0.8);
  bl.rotation.y = -0.6;
  g.add(bl);
  const gw = gear(1.1, true);
  gw.position.set(0, 3.4, 1.72);
  g.add(gw);
  return g;
}

/** Farm: the hold's steading. A stone farmhouse, terraces of hardy grain kerbed in stone, mushroom beds, stooks of sheaves;
 *  a stone well, a steam mill with its gear turning, stone barns, a pen of goats in dry-stone walls and a granary under
 *  a bronze dome. */
function farm(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const fh = t >= 7
    ? house({ w: 7, d: 5, h: 3.4, roofH: 2.6, windows: 3, stone: true })
    : house({ w: 4.6 + Math.min(3, t) * 0.4, d: 4.0, h: 2.5, roofH: 2.1, roof: C.thatch, windows: 1 });
  g.add(fh);
  const spots: [number, number][] = [[-8, -6], [0, -8.5], [8, -6], [-9.5, 3], [-4.5, -15.5], [4.5, -15.5], [13.5, -12], [15.5, -3.5], [-13.5, -12]];
  const fields = Math.min(spots.length, t + 1);
  for (let i = 0; i < fields; i++) {
    const f = i % 3 === 1 ? mushroomBeds(6.5, 5, r) : grainTerrace(6.5, 5, r, i % 3 !== 2);
    f.position.set(spots[i][0], 0, spots[i][1]);
    f.rotation.y = (r() - 0.5) * 0.3;
    g.add(f);
  }
  for (let i = 0; i < Math.min(6, 1 + t); i++) {
    const st = new THREE.Group();
    st.add(cone(0.4, 1.1, HAY, 6), box(0.5, 0.08, 0.5, 0x8a6a30, 0, 0.5, 0));
    st.position.set(0.5 + r() * 2.5, 0, 5.6 + r() * 1.2);
    g.add(st);
  }
  if (t >= 2) {
    // the well: a stone drum, a bronze crank and a little slab roof
    g.add(cyl(0.8, 0.85, 0.8, DW_GRANITE, 8, -3.2, 0, 3.8));
    g.add(cyl(0.62, 0.62, 0.04, 0x3a4c56, 8, -3.2, 0.76, 3.8));
    for (const x of [-3.9, -2.5]) g.add(box(0.2, 1.8, 0.2, DW_GRANITE_LT, x, 0.8, 3.8));
    g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6).rotateZ(Math.PI / 2), DW_BRONZE).translateX(-3.2).translateY(2.1).translateZ(3.8));
    g.add(cone(1.1, 0.6, DW_SLAB, 4, -3.2, 2.6, 3.8).rotateY(Math.PI / 4));
  }
  if (t >= 3) {
    const sm = steamMill();
    sm.position.set(-14, 0, -3.5);
    sm.rotation.y = 0.6;
    g.add(sm);
  }
  if (t >= 4) {
    const b = vault(6, 7.5, 2.6, 2.4, 2.2);
    b.position.set(10, 0, 2.5);
    b.rotation.y = -Math.PI / 2;
    g.add(b);
  }
  if (t >= 5) {
    // the goat pen
    const pen = new THREE.Group();
    dryWall(pen, -3.3, -2.4, 3.3, -2.4, 0.7);
    dryWall(pen, -3.3, 2.4, 3.3, 2.4, 0.7, [0.4, 0.6]);
    dryWall(pen, -3.3, -2.4, -3.3, 2.4, 0.7);
    dryWall(pen, 3.3, -2.4, 3.3, 2.4, 0.7);
    for (let i = 0; i < 4; i++) { const gt = goat(i % 2 ? 0xd8d0c0 : 0x8a7a64, 0.85); gt.position.set(-2 + i * 1.3, 0, (i % 2 ? 1 : -1) * 0.8); gt.rotation.y = r() * 6; pen.add(gt); }
    pen.position.set(-7.5, 0, 7.5);
    g.add(pen);
  }
  if (t >= 6) {
    const gr = new THREE.Group();
    gr.add(cyl(1.4, 1.5, 4.0, DW_GRANITE, 10));
    gr.add(cyl(1.55, 1.55, 0.26, DW_BRONZE_DK, 10, 0, 3.9));
    gr.add(mesh(new THREE.SphereGeometry(1.45, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), DW_BRONZE).translateY(4.1));
    gr.add(blob(0.16, DW_GOLD, 0, 5.6, 0));
    gr.add(box(0.8, 1.4, 0.1, DW_OAK, 0, 0, 1.45));
    gr.scale.setScalar(0.8);
    gr.position.set(-5, 0, -1.4);
    g.add(gr);
  }
  if (t >= 8) {
    const b2 = vault(4.6, 5.2, 2.2, 1.8, 1.8);
    b2.position.set(4.6, 0, -2.2);
    b2.rotation.y = Math.PI;
    g.add(b2);
  }
  dryWall(g, -5, 4.4, 5, 4.4, 0.7, [0.44, 0.58]);
  const post = forgePost(2.2);
  post.position.set(5.6, 0, 5.4);
  g.add(post);
  return { obj: g, h: 6 + (t >= 4 ? 2 : 0), w: 8, d: 8 };
}

/** Every building of the hold, in the Forgelord's own way. */
export function dwarfModel(id: BuildingId, t: number, color: number, r: () => number, kit: ForgeKit): Built | null {
  switch (id) {
    case 'main': return forgeHall(t, color);
    case 'barracks': return barracks(t, color);
    case 'stable': return stable(t, r);
    case 'workshop': return workshop(t);
    case 'academy': return academy();
    case 'smithy': return smithy(t);
    case 'rally': return rally(color);
    case 'statue': return statue();
    case 'market': return market(t, r);
    case 'warehouse': return warehouse(t);
    case 'hiding': return hiding(t, r);
    case 'watchtower': return watchtower(t, color);
    case 'timber': return timberCamp(t, r, kit);
    case 'claypit': return clayPit(t, r);
    case 'ironmine': return ironMine(t, r);
    case 'farm': return farm(t, r);
    default: return null;
  }
}

/** The board behind a door-sign: a plate of bronze in a frame of stone, a rivet at each corner. */
export function forgePlaque(): THREE.Group {
  const g = new THREE.Group();
  g.add(frustum(1.36, 0.1, 1.12, 0.1, 1.16, DW_GRANITE_LT, 0, -0.58, -0.02));
  g.add(frustum(1.14, 0.08, 0.94, 0.08, 0.98, DW_BRONZE, 0, -0.49, 0.04));
  for (const [x, y] of [[-0.4, 0.4], [0.4, 0.4], [-0.5, -0.4], [0.5, -0.4]]) g.add(blob(0.05, DW_GOLD, x, y, 0.1));
  return g;
}

// ---------- the walls ----------

/** A tower of the great wall: eight-sided and battered, bound in bronze (its upper storey plated in bronze on the
 *  greatest wall), a parapet on corbels, a bolt-thrower on its deck facing out (+Z), a rune on its outer face and a
 *  lantern on its inner one. */
function wallTower(tr: number, th: number, tier: number, k: number): THREE.Group {
  const g = new THREE.Group();
  const oct = (m: THREE.Mesh) => { m.rotation.y = Math.PI / 8; return m; };
  const rAt = (y: number) => (tr * 1.14 - tr * 0.18 * (y / th)) * Math.cos(Math.PI / 8);
  g.add(oct(cyl(tr * 1.2, tr * 1.26, 0.7, DW_BASALT, 8)));
  g.add(oct(cyl(tr * 0.96, tr * 1.14, th, DW_GRANITE, 8)));
  if (tier === 4) {
    g.add(oct(cyl(tr * 1.0, tr * 1.03, th * 0.34, DW_BRONZE, 8, 0, th * 0.62)));
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      g.add(box(0.1, th * 0.34, 0.1, DW_BRONZE_DK, Math.sin(a) * tr * 1.07, th * 0.62, Math.cos(a) * tr * 1.07));
    }
    g.add(oct(cyl(tr * 1.06, tr * 1.06, 0.14, DW_GOLD, 8, 0, th * 0.955)));
  } else for (const y of [0.4, 0.78]) g.add(oct(cyl(tr * (1.14 - 0.18 * y) + 0.05, tr * (1.14 - 0.18 * y) + 0.05, 0.26, DW_BRONZE, 8, 0, th * y)));
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const c = frustum(0.4, 0.22, 0.4, 0.6, 0.55, DW_GRANITE_LT, Math.sin(a) * rAt(th - 0.6), th - 0.64, Math.cos(a) * rAt(th - 0.6));
    c.rotation.y = a;
    g.add(c);
  }
  g.add(oct(cyl(tr * 1.24, tr * 1.18, 0.9, DW_GRANITE_LT, 8, 0, th - 0.1)));
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const m = box(tr * 0.46, 0.66, 0.4, DW_GRANITE_LT, Math.sin(a) * tr * 1.04, th + 0.8, Math.cos(a) * tr * 1.04);
    m.rotation.y = a;
    g.add(m);
    if (tier === 4) g.add(box(tr * 0.5, 0.08, 0.46, DW_BRONZE, Math.sin(a) * tr * 1.04, th + 1.46, Math.cos(a) * tr * 1.04).rotateY(a));
  }
  const b = ballista(tier === 4 ? 1.0 : 0.86);
  b.position.set(0, th + 0.8, 0.15);
  g.add(b);
  const rn = forgeRune(0.9, k);
  rn.position.set(0, th * 0.42, rAt(th * 0.42) + 0.04);
  g.add(rn);
  g.add(box(0.1, 0.1, 0.5, DW_BRONZE_DK, 0, th * 0.58 + 0.5, -rAt(th * 0.58) - 0.2));
  const l = lantern(1.1);
  l.position.set(0, th * 0.58 - 0.05, -rAt(th * 0.58) - 0.42);
  g.add(l);
  return g;
}

/** A squat square bastion of the middle wall: its deck (where the guards stand at 6.7) with merlons at the corners, a
 *  bolt-thrower beside them facing out (+Z), a rune on its outer face and a lantern on its inner one. */
function wallBastion(k: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(3.4, 0.5, 3.4, DW_BASALT));
  g.add(frustum(3.1, 3.1, 2.6, 2.6, 5.9, DW_GRANITE, 0, 0.5, 0));
  g.add(box(3.1, 0.2, 3.1, DW_BASALT_MD, 0, 3.4, 0));
  g.add(box(3.3, 0.3, 3.3, DW_GRANITE_LT, 0, 6.4, 0));
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(box(0.6, 0.62, 0.6, DW_GRANITE_LT, x * 1.35, 6.7, z * 1.35));
  const b = ballista(0.78);
  b.position.set(0.7, 6.7, 0.35);
  g.add(b);
  const rn = forgeRune(0.8, k);
  rn.position.set(0, 2.2, 1.46);
  g.add(rn);
  const l = lantern(1.0);
  l.position.set(0, 3.9, -1.6);
  g.add(l, box(0.1, 0.1, 0.4, DW_BRONZE_DK, 0, 4.5, -1.45));
  return g;
}

/** A door of the gate, standing open: carved with runes that glow, bound in bronze. Hinged at x = 0 on its outer
 *  face, it reaches `w` toward -X before it is swung. */
function gateDoor(w: number, h: number, stone: boolean): THREE.Group {
  const g = new THREE.Group();
  const d = new THREE.Group();
  d.add(box(w, h, 0.5, stone ? DW_GRANITE : DW_OAK, -w / 2, 0, 0));
  for (const y of [0.18, 0.5, 0.82]) d.add(box(w + 0.04, 0.16, 0.56, DW_BRONZE, -w / 2, h * y, 0));
  if (stone) {
    d.add(lava(new THREE.BoxGeometry(0.1, h * 0.8, 0.04)).translateX(-w * 0.2).translateY(h * 0.5).translateZ(0.27));
    for (let i = 0; i < 3; i++) {
      const rn = forgeRune(0.7, i + 1);
      rn.position.set(-w * 0.6, h * (0.3 + i * 0.25), 0.28);
      d.add(rn);
    }
    const rn2 = forgeRune(1.0, 4);
    rn2.rotation.y = Math.PI;
    rn2.position.set(-w * 0.5, h * 0.55, -0.28);
    d.add(rn2);
  } else for (const x of [0.25, 0.5, 0.75]) d.add(box(0.06, h, 0.54, dk(DW_OAK, 0.8), -w * x, 0, 0));
  g.add(d);
  return g;
}

/**
 * The hold's wall. First a rampart of great fitted blocks of basalt and granite, capped, a gate of two stone pillars
 * and a rune-cut lintel; then a wall of dressed stone with squat bastions, a bolt-thrower on each; then massive
 * ramparts battered out at the foot, towers of eight sides bound in bronze, a ballista on every one; and at its
 * greatest the towers plated in bronze, a channel of rune-fire running round the outer face, and a gate between two
 * great towers whose doors are slabs of carved stone flung open. (Local -z of a stretch faces out of the village.)
 */
export function forgeWall(level: number, color: number, R: number, gateA: number, gateHalf: number): THREE.Group {
  const g = new THREE.Group();
  if (level <= 0) return g;
  const tier = level < 5 ? 1 : level < 10 ? 2 : level < 15 ? 3 : 4;
  const start = gateA + gateHalf, end = gateA + Math.PI * 2 - gateHalf;
  const h = tier === 1 ? 2.6 : tier === 2 ? 3.6 : tier === 3 ? 3.4 : 4.6;
  const thick = tier === 1 ? 1.4 : tier === 2 ? 1.5 : tier === 3 ? 1.6 : 2.0;
  const segs = tier === 1 ? 64 : 40;
  for (let i = 0; i < segs; i++) {
    const a0 = start + ((end - start) * i) / segs, a1 = start + ((end - start) * (i + 1)) / segs;
    const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
    const len = Math.hypot(x1 - x0, z1 - z0) + 0.15;
    const seg = new THREE.Group();
    if (tier === 1) {
      // great fitted blocks, no two alike, a capstone on each
      for (let k = 0; k < 2; k++) {
        const hh = h * (0.86 + ((i * 7 + k * 3) % 5) * 0.06);
        const x = -len / 4 + (k * len) / 2;
        seg.add(box(len / 2 + 0.03, hh, thick, (i + k) % 3 === 0 ? DW_GRANITE : (i + k) % 3 === 1 ? DW_BASALT_MD : DW_BASALT, x, 0, 0));
        seg.add(box(len / 2 - 0.12, 0.26, thick + 0.16, DW_GRANITE_LT, x, hh, 0));
      }
      seg.add(box(len, 0.4, thick + 0.5, DW_BASALT, 0, 0, 0));
    } else if (tier === 2) {
      seg.add(box(len, 0.5, thick + 0.5, DW_BASALT, 0, 0, 0));
      seg.add(box(len, h, thick, DW_GRANITE, 0, 0, 0));
      seg.add(box(len, 0.16, thick + 0.08, DW_BASALT_MD, 0, h * 0.5, 0));
      seg.add(box(len, 0.28, thick + 0.2, DW_GRANITE_LT, 0, h, 0));
      const n = Math.max(2, Math.round(len / 1.3));
      for (let k = 0; k < n; k++) seg.add(box(0.72, 0.62, 0.42, DW_GRANITE_LT, -len / 2 + (k + 0.5) * (len / n), h + 0.28, -thick / 2 + 0.2));
    } else {
      const batter = tier === 4 ? 1.1 : 0.8;
      seg.add(box(len, 0.6, thick + batter + 0.5, DW_BASALT, 0, 0, 0));
      seg.add(frustum(len, thick + batter, len, thick, h, DW_GRANITE, 0, 0, 0));
      seg.add(box(len, 0.16, thick + batter * 0.45 + 0.08, DW_BASALT_MD, 0, h * 0.55, 0));
      seg.add(box(len, 0.3, thick + 0.24, DW_GRANITE_LT, 0, h, 0));
      seg.add(box(len, 0.34, 0.3, DW_GRANITE_LT, 0, h + 0.3, thick / 2 - 0.15));
      const n = Math.max(2, Math.round(len / 1.3));
      for (let k = 0; k < n; k++) {
        const x = -len / 2 + (k + 0.5) * (len / n);
        seg.add(box(0.74, 0.8, 0.46, DW_GRANITE_LT, x, h + 0.3, -thick / 2 + 0.2));
        if (tier === 4) seg.add(box(0.8, 0.08, 0.52, DW_BRONZE, x, h + 1.1, -thick / 2 + 0.2));
      }
      if (tier === 4) {
        // the channel of rune-fire round the outer face
        const y = h * 0.72, zf = -(thick + batter * (1 - 0.72)) / 2 - 0.02;
        seg.add(lava(new THREE.BoxGeometry(len, 0.09, 0.05)).translateY(y).translateZ(zf));
        seg.add(box(len, 0.12, 0.14, DW_BASALT, 0, y - 0.14, zf + 0.04));
      }
      if (i % 3 === 1) {
        const y = h * 0.4, zf = -(thick + batter * (1 - 0.4)) / 2 - 0.03;
        const rn = forgeRune(1.0, i);
        rn.rotation.set(-batter / h / 2, Math.PI, 0);
        rn.position.set(0, y, zf);
        seg.add(rn);
      }
    }
    seg.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    seg.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(seg);
  }
  const face = (a: number) => Math.PI / 2 - a;
  if (tier === 2) {
    for (let i = 0; i < 8; i++) {
      const a = gateA + gateHalf + 0.35 + (i / 8) * (Math.PI * 2 - gateHalf * 2 - 0.5);
      const b = wallBastion(i);
      b.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      b.rotation.y = face(a);
      g.add(b);
    }
  } else if (tier >= 3) {
    const towers = tier === 3 ? 8 : 12;
    for (let i = 1; i < towers - 1; i++) {
      const a = start + ((end - start) * i) / (towers - 1);
      const tw = wallTower(tier === 3 ? 2.2 : 2.6, tier === 3 ? 6 : 8, tier, i);
      tw.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      tw.rotation.y = face(a);
      g.add(tw);
    }
  }
  // the gate
  const gx = Math.cos(start) * R, gz = Math.sin(start) * R;
  if (tier === 1) {
    for (const s of [-1, 1]) {
      g.add(frustum(1.9, 1.9, 1.4, 1.4, 4.2, DW_GRANITE, s * gx, 0, gz));
      g.add(box(2.1, 0.4, 2.1, DW_BASALT, s * gx, 0, gz));
      const l = lantern(1.0);
      l.position.set(s * (gx - 0.6), 3.2, gz + 0.8);
      g.add(l, box(0.1, 0.1, 0.4, DW_BRONZE_DK, s * (gx - 0.6), 3.8, gz + 0.72));
    }
    g.add(frustum(gx * 2 + 1.8, 1.4, gx * 2 + 2.6, 1.4, 0.9, DW_GRANITE_LT, 0, 4.2, gz));
    runeRow(g, 7, gx * 1.6, 0, 4.65, gz + 0.72, 0.42, 2);
  } else {
    const big = tier >= 3;
    const tw = tier === 2 ? 3.4 : tier === 3 ? 4.0 : 4.6, th = tier === 2 ? 6.8 : tier === 3 ? 8.2 : 10.2;
    for (const s of [-1, 1]) {
      const x = s * (gx + tw * 0.25);
      g.add(box(tw + 0.5, 0.6, tw + 0.5, DW_BASALT, x, 0, gz));
      g.add(frustum(tw, tw, tw - 0.6, tw - 0.6, th, DW_GRANITE, x, 0.5, gz));
      for (const y of [th * 0.35, th * 0.7]) g.add(box(tw - 0.6 * (y / th) + 0.14, 0.24, tw - 0.6 * (y / th) + 0.14, big ? DW_BRONZE : DW_BASALT_MD, x, y, gz));
      g.add(box(tw + 0.1, 0.4, tw + 0.1, DW_GRANITE_LT, x, th + 0.3, gz));
      // corbels under the cornice, slits of light, and a quoin at each corner
      const wt = tw - 0.6 * ((th - 0.3) / th);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const k of [-0.34, 0, 0.34]) {
        const c = frustum(0.34, 0.22, 0.34, 0.5, 0.5, DW_GRANITE_LT, x + dx * (wt / 2) + dz * k * wt, th - 0.2, gz + dz * (wt / 2) + dx * k * wt);
        c.rotation.y = Math.atan2(dx, dz);
        g.add(c);
      }
      for (const y of [th * 0.22, th * 0.56]) for (const sx of [-1, 1]) {
        const sl = box(0.24, 0.8, 0.1, C.window, x + sx * (tw * 0.28), y, gz + (tw - 0.6 * (y / th)) / 2 + 0.02);
        sl.userData.window = true;
        g.add(sl);
      }
      for (const cx of [-1, 1]) for (let y = 0.8, q = 0; y < th - 0.8; y += 0.9, q++) g.add(box(q % 2 ? 0.44 : 0.7, 0.8, 0.12, DW_GRANITE_LT, x + cx * ((tw - 0.6 * (y / th)) / 2 - (q % 2 ? 0.22 : 0.35)), y, gz + (tw - 0.6 * (y / th)) / 2 + 0.03));
      g.add(cone((tw + 0.2) * 0.72, tw * 0.62, DW_BRONZE, 4, x, th + 0.7, gz).rotateY(Math.PI / 4));
      g.add(blob(0.22, DW_GOLD, x, th + 0.78 + tw * 0.62, gz));
      const rn = forgeRune(1.1, s > 0 ? 3 : 1);
      rn.position.set(x, th * 0.52, gz + (tw - 0.6 * 0.52) / 2 + 0.05);
      g.add(rn);
      // a long banner of the ruler's colour down the tower's face
      const bh = th * 0.42, bw = tw * 0.42;
      g.add(box(bw + 0.3, 0.12, 0.12, DW_GOLD, x, th - 0.6, gz + (tw - 0.6) / 2 + 0.2));
      g.add(box(bw, bh, 0.05, color, x, th - 0.6 - bh, gz + (tw - 0.6) / 2 + 0.2));
      for (const bx of [-bw / 3, bw / 3]) g.add(cone(bw / 6, 0.5, color, 3, x + bx, th - 0.6 - bh, gz + (tw - 0.6) / 2 + 0.2).rotateZ(Math.PI));
      // the door, flung open against the road
      const inner = s * (gx - tw * 0.25);
      const dw = Math.abs(inner), dh = h + (big ? 2.4 : 1.2);
      const door = gateDoor(dw, dh, big);
      door.position.set(inner, 0, gz + thick / 2 + 0.3);
      door.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      door.scale.x = s < 0 ? 1 : -1;
      g.add(door);
    }
    // the lintel over the way through: a great block of stone, runes cut in it (and a stone face on the greatest)
    const lw = gx * 2 + tw * 0.5, ly = h + (big ? 2.4 : 1.2);
    g.add(box(lw, big ? 3.0 : 2.2, thick + 1.0, DW_GRANITE_LT, 0, ly, gz));
    g.add(box(lw + 0.3, 0.3, thick + 1.2, DW_BASALT_MD, 0, ly, gz));
    for (let k = 0; k < Math.round(lw / 1.3); k++) g.add(box(0.7, 0.66, 0.5, DW_GRANITE, -lw / 2 + (k + 0.5) * (lw / Math.round(lw / 1.3)), ly + (big ? 3.0 : 2.2), gz + thick / 2 + 0.25));
    if (tier === 4) {
      const f = carvedFace(0.62);
      f.position.set(0, ly + 1.65, gz + thick / 2 + 0.52);
      g.add(f);
    } else runeRow(g, 5, lw * 0.6, 0, ly + (big ? 1.5 : 1.1), gz + thick / 2 + 0.52, 0.5, 1);
    if (level >= 20) {
      // the crest: a great bronze shield on the lintel, the ruler's colour in its field and a rune of fire at its boss
      const crest = new THREE.Group();
      crest.add(mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.2, 14).rotateX(Math.PI / 2), DW_BRONZE));
      crest.add(mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.24, 14).rotateX(Math.PI / 2), color));
      crest.add(mesh(new THREE.TorusGeometry(1.25, 0.08, 4, 14), DW_GOLD));
      const rn = forgeRune(0.9, 4);
      rn.position.z = 0.16;
      crest.add(rn);
      crest.scale.setScalar(0.82);
      crest.position.set(-2.1, ly + 1.5, gz + thick / 2 + 0.72);
      g.add(crest);
      const c2 = crest.clone();
      c2.position.x = 2.1;
      g.add(c2);
    }
  }
  return bake(g, { building: 'wall' });
}

// ---------- the streets and the land round the hold ----------

/** A street lamp of the hold: a squat stone post, a bronze arm, a lantern hung from it; a rune in the post. */
export function forgeLamp(): THREE.Group {
  const g = new THREE.Group();
  g.add(frustum(0.6, 0.6, 0.36, 0.36, 2.7, DW_GRANITE));
  g.add(box(0.5, 0.16, 0.5, DW_GRANITE_LT, 0, 2.7, 0));
  g.add(frustum(0.3, 0.3, 0.12, 0.12, 0.4, DW_BRONZE, 0, 2.86, 0));
  g.add(box(0.8, 0.08, 0.08, DW_BRONZE_DK, 0.36, 2.72, 0));
  g.add(box(0.04, 0.24, 0.04, 0x2a2420, 0.7, 2.5, 0));
  const l = lantern(1.05);
  l.position.set(0.7, 1.98, 0);
  g.add(l);
  const rn = forgeRune(0.34, 3);
  rn.position.set(0, 1.4, 0.23);
  g.add(rn);
  return g;
}

/** A monument of the hold for the open spots inside the walls: an ancestor in stone, a great anvil with its hammer and
 *  a fire bowl, or a ring of runestones round a steam-pipe breathing from the deep. */
export function forgeLandmark(r: () => number): THREE.Group {
  const g = new THREE.Group();
  const k = Math.floor(r() * 3);
  g.add(frustum(2.8, 2.8, 2.3, 2.3, 0.3, DW_BASALT_MD));
  if (k === 0) {
    g.add(frustum(1.4, 1.4, 1.1, 1.1, 1.0, DW_GRANITE, 0, 0.3, 0));
    runeRow(g, 2, 0.8, 0, 0.8, 0.66, 0.3, 1);
    const ks = kingStatue(0.46);
    ks.position.y = 1.3;
    g.add(ks);
    for (const x of [-1, 1]) { const fb = fireBowl(0.3, false, 0.45); fb.position.set(x * 0.95, 0.3, 0.95); g.add(fb); }
  } else if (k === 1) {
    const an = greatAnvil(0.9);
    an.position.set(0, 0.3, -0.1);
    g.add(an);
    const hm = bigHammer(1.5, 0.6, true);
    hm.position.set(0.8, 0.3, 0.6);
    hm.rotation.set(0, 0.3, 0.5);
    g.add(hm);
    const fb = fireBowl(0.5, false, 0.6);
    fb.position.set(-0.8, 0.3, 0.7);
    g.add(fb);
  } else {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const rs = runeStone(1.3 + i * 0.3, i);
      rs.scale.setScalar(0.8);
      rs.position.set(Math.cos(a) * 0.85, 0.3, Math.sin(a) * 0.85);
      rs.rotation.y = Math.PI / 2 - a;
      g.add(rs);
    }
    g.add(cyl(0.16, 0.16, 1.1, DW_BRONZE, 6, 0, 0.3, 0));
    g.add(mesh(new THREE.TorusGeometry(0.26, 0.05, 4, 10), IRON_BK).translateY(0.9));
    g.add(cone(0.24, 0.3, DW_BRONZE_DK, 6, 0, 1.4, 0));
  }
  return g;
}

interface ForgeGround {
  at: (x: number, z: number) => number;
  free: (x: number, z: number) => boolean;
  wallR: number;
}

/**
 * The land round the hold: the Ancestors' Forge outside the gate (a colossal anvil on an eight-sided dais, an ancestor in
 * stone behind it, a lava-rill running into a quenching basin, rune-pillars and braziers round it), runestones and
 * lanterns down the road, and out in the ash: ore breaking out of the rock and glinting, basalt cairns, carts left on
 * stubs of rail, brass steam-pipes breathing from the deep, rune-arches and the odd ancestor keeping watch.
 */
export function addDeepforge(g: THREE.Group, r: () => number, k: ForgeGround): void {
  const { at } = k;
  const cx = 21, cz = 57.5;
  const y0 = at(cx, cz) - 0.1;
  const dais = new THREE.Group();
  dais.add(cyl(6.8, 7.2, 0.5, DW_BASALT, 8).rotateY(Math.PI / 8));
  dais.add(cyl(5.2, 5.6, 0.4, DW_GRANITE, 8, 0, 0.5).rotateY(Math.PI / 8));
  dais.add(cyl(3.0, 3.2, 0.36, DW_GRANITE_LT, 8, 0, 0.9).rotateY(Math.PI / 8));
  const an = greatAnvil(2.3);
  an.position.set(0, 1.26, 0.3);
  an.rotation.y = -0.3;
  dais.add(an);
  const hm = bigHammer(3.2, 1.3, true);
  hm.position.set(2.2, 1.26, 1.4);
  hm.rotation.set(0, -0.4, 0.45);
  dais.add(hm);
  dais.add(frustum(2.2, 2.2, 1.8, 1.8, 1.6, DW_GRANITE, -0.6, 0.5, -3.6));
  const ks = kingStatue(0.95);
  ks.position.set(-0.6, 2.1, -3.7);
  ks.rotation.y = -0.25;
  dais.add(ks);
  // the lava-rill from a vent at the dais's edge into a quenching basin by the anvil
  dais.add(cone(1.4, 1.1, DW_BASALT, 7, 4.8, 0.3, -2.6));
  dais.add(lava(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 7)).translateX(4.8).translateY(1.36).translateZ(-2.6));
  dais.add(box(0.6, 0.3, 3.4, DW_GRANITE, 3.6, 0.9, -1.0).rotateY(0.5));
  dais.add(lava(new THREE.BoxGeometry(0.3, 0.05, 3.4)).translateX(3.6).translateY(1.21).translateZ(-1.0).rotateY(0.5));
  dais.add(cyl(0.9, 1.0, 0.5, DW_BASALT, 8, 2.6, 0.9, 1.0));
  dais.add(lava(new THREE.CylinderGeometry(0.72, 0.72, 0.05, 8)).translateX(2.6).translateY(1.38).translateZ(1.0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const rs = runeStone(2.8 + (i % 2) * 0.6, i);
    rs.position.set(Math.cos(a) * 6.0, 0.5, Math.sin(a) * 6.0);
    rs.rotation.y = -Math.PI / 2 - a;
    dais.add(rs);
  }
  for (const [x, z] of [[-3.6, 2.8], [3.4, 3.4]]) { const fb = fireBowl(0.8, true, 1.0); fb.position.set(x, 0.9, z); dais.add(fb); }
  dais.position.set(cx, y0, cz);
  g.add(dais);
  // runestones and lanterns down the road out of the gate
  for (const [i, z] of [56, 64, 72, 80].entries()) for (const x of [-3.9, 3.9]) {
    const o = i % 2 ? forgeLamp() : runeStone(2.2, i + (x > 0 ? 2 : 0));
    o.position.set(x, at(x, z) - 0.05, z);
    o.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(o);
  }
  // out in the ash
  let placed = 0;
  for (let tries = 0; tries < 1000 && placed < 60; tries++) {
    const a = r() * Math.PI * 2, d = k.wallR + 7 + r() * 76;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!k.free(x, z)) continue;
    if (Math.hypot(x - cx, z - cz) < 13) continue;
    const y = at(x, z);
    const kind = placed % 8;
    if (kind === 0 || kind === 4) {
      // ore breaking out of the rock
      g.add(blob(1.0 + r() * 0.5, DW_BASALT_MD, x, y + 0.3, z, 1.2, 0.75, 1.1));
      for (let j = 0; j < 3; j++) g.add(glow(new THREE.OctahedronGeometry(0.16, 0), j % 2 ? ORE_GLINT : DW_GOLD, j % 2 ? 0x3a4450 : 0x6a4a10).translateX(x + (r() - 0.5) * 1.4).translateY(y + 0.7 + r() * 0.4).translateZ(z + (r() - 0.5) * 1.2));
    } else if (kind === 1) {
      // a cairn of basalt, a rune-slab leaned on it
      for (let j = 0; j < 3; j++) g.add(blob(0.55 - j * 0.12, j % 2 ? DW_BASALT : DW_BASALT_MD, x, y + 0.3 + j * 0.55, z, 1.1, 0.7, 1.1));
      const rs = runeStone(1.1, placed);
      rs.position.set(x + 0.7, y - 0.05, z + 0.3);
      rs.rotation.set(0, r() * 6, -0.2);
      g.add(rs);
    } else if (kind === 2) {
      // a cart left on a stub of rail
      const rl = rails(3.0);
      rl.position.set(x, y - 0.02, z - 1.5);
      const cart = mineCart(1, r() < 0.5);
      cart.position.set(x, y + 0.06, z + 0.3);
      cart.rotation.z = 0.12;
      const grp = new THREE.Group();
      grp.add(rl, cart);
      grp.rotation.y = r() * 6;
      grp.position.set(0, 0, 0);
      rl.position.set(0, y - 0.02, -1.5);
      cart.position.set(0, y + 0.06, 0.3);
      grp.position.set(x, 0, z);
      g.add(grp);
    } else if (kind === 3) {
      // a brass steam-pipe breathing from the deep, a valve wheel on it
      const p = new THREE.Group();
      p.add(cyl(0.2, 0.2, 1.4, DW_BRONZE, 6, 0, 0, 0));
      p.add(limb(V(0, 1.3, 0), V(0.8, 1.6, 0), 0.2, 0.2, DW_BRONZE, 6));
      p.add(cyl(0.26, 0.26, 0.12, DW_BRONZE_DK, 6, 0, 0.5, 0));
      p.add(mesh(new THREE.TorusGeometry(0.28, 0.04, 3, 8).rotateX(Math.PI / 2), IRON_BK).translateY(1.0));
      p.add(blob(0.5, DW_BASALT_MD, 0, 0.05, 0, 1.3, 0.5, 1.2));
      p.position.set(x, y - 0.05, z);
      p.rotation.y = r() * 6;
      g.add(p);
    } else if (kind === 5 && placed % 16 === 5) {
      // a rune-arch: two standing stones and a lintel
      const ar = new THREE.Group();
      for (const s of [-1, 1]) ar.add(frustum(0.8, 0.6, 0.6, 0.5, 2.8, DW_BASALT_MD, s * 1.1, 0, 0));
      ar.add(box(3.2, 0.5, 0.7, DW_GRANITE, 0, 2.8, 0));
      runeRow(ar, 4, 2.4, 0, 3.05, 0.36, 0.3, placed);
      ar.position.set(x, y - 0.1, z);
      ar.rotation.y = r() * 6;
      g.add(ar);
    } else if (kind === 6 && placed % 16 === 6) {
      // an ancestor keeping watch over the ash
      const an2 = new THREE.Group();
      an2.add(frustum(1.3, 1.3, 1.0, 1.0, 0.9, DW_BASALT_MD));
      const ks2 = kingStatue(0.4);
      ks2.position.y = 0.9;
      an2.add(ks2);
      an2.position.set(x, y - 0.1, z);
      an2.rotation.y = r() * 6;
      g.add(an2);
    } else {
      g.add(blob(0.5 + r() * 0.4, r() < 0.5 ? DW_BASALT : DW_BASALT_MD, x, y + 0.15, z, 1.3, 0.6, 1.1));
    }
    placed++;
  }
}

// ---------- the Forgelord at home, the camp, mastery ----------

export interface ForgeAura { group: THREE.Group; step(dt: number, t: number): void; dispose(): void }

/**
 * The Forgelord at home: six rune-pillars stand round his statue, a ring of runes on the ground flares with every blow
 * of his hammer (a slow beat, like a smith at the anvil), sparks burst from the hammer's head at each blow, and embers
 * rise over it all.
 */
export function forgeAura(sx: number, sz: number, r: () => number): ForgeAura {
  const g = new THREE.Group();
  const pillars = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    const p = new THREE.Group();
    p.add(frustum(0.62, 0.62, 0.42, 0.42, 2.3, DW_BASALT_MD));
    p.add(frustum(0.5, 0.5, 0.2, 0.2, 0.36, DW_BRONZE, 0, 2.3, 0));
    const rn = forgeRune(0.44, i);
    rn.position.set(0, 1.4, 0.27);
    p.add(rn);
    p.position.set(sx + Math.cos(a) * 3.9, 0, sz + Math.sin(a) * 3.9);
    p.rotation.y = Math.PI / 2 - a;
    pillars.add(p);
  }
  g.add(bake(pillars));
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.25, 3.55, 48).rotateX(-Math.PI / 2), ringMat);
  ring.position.set(sx, 0.07, sz);
  g.add(ring);
  const glyphs = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    for (const [len, off] of [[0.7, 0], [0.34, 0.14]] as [number, number][]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, len), ringMat);
      m.position.set(sx + Math.cos(a) * (4.05 + off), 0.08, sz + Math.sin(a) * (4.05 + off));
      m.rotation.y = -a + (off ? 0.7 : 0);
      glyphs.add(m);
    }
  }
  g.add(bake(glyphs));
  // sparks off the hammer's head: a small pool that bursts at each blow
  const hx = sx + 1.08, hy = 8.6, hz = sz + 0.05;
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffc060, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparkGeo = new THREE.OctahedronGeometry(0.1, 0);
  const sparks: { m: THREE.Mesh; v: THREE.Vector3; age: number }[] = [];
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(sparkGeo, sparkMat);
    m.visible = false;
    g.add(m);
    sparks.push({ m, v: new THREE.Vector3(), age: 9 });
  }
  const embers: { m: THREE.Mesh; x: number; z: number; y: number; v: number; ph: number }[] = [];
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const emberGeo = new THREE.OctahedronGeometry(0.12, 0);
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(emberGeo, emberMat);
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 3.2;
    embers.push({ m, x: sx + Math.cos(a) * d, z: sz + Math.sin(a) * d, y: r() * 10, v: 0.8 + r() * 1.2, ph: r() * 6 });
    g.add(m);
  }
  const period = 1.6;
  let lastBeat = -1;
  return {
    group: g,
    step(dt, t) {
      const beat = Math.floor(t / period);
      const k = (t / period) % 1;
      ringMat.opacity = 0.14 + Math.max(0, 1 - k * 3.5) * 0.5;
      if (beat !== lastBeat) {
        lastBeat = beat;
        for (const s of sparks) {
          s.age = 0;
          const a = Math.random() * Math.PI * 2, up = 1.5 + Math.random() * 3;
          s.v.set(Math.cos(a) * (1.5 + Math.random() * 2.5), up, Math.sin(a) * (1.5 + Math.random() * 2.5));
          s.m.position.set(hx, hy, hz);
          s.m.visible = true;
        }
      }
      for (const s of sparks) {
        if (s.age > 1.2) { s.m.visible = false; continue; }
        s.age += dt;
        s.v.y -= 9 * dt;
        s.m.position.addScaledVector(s.v, dt);
        s.m.scale.setScalar(Math.max(0.1, 1 - s.age / 1.2));
      }
      for (const e of embers) {
        e.y += e.v * dt;
        if (e.y > 11) e.y = 0.4;
        e.m.position.set(e.x + Math.sin(t + e.ph) * 0.4, e.y, e.z + Math.cos(t * 0.8 + e.ph) * 0.4);
        e.m.scale.setScalar(0.5 + 0.6 * Math.sin(Math.PI * (e.y / 11)));
      }
    },
    dispose() {
      g.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      ringMat.dispose();
      sparkMat.dispose();
      emberMat.dispose();
    },
  };
}

/** A support tent of the hold: a squat square pavilion of heavy rune-red canvas on bronze-capped poles, weighted at
 *  its skirt with stones, a bronze rune-shield over its door and a lantern by it. Its door faces +Z. */
export function forgeTent(): THREE.Group {
  const g = new THREE.Group();
  g.add(frustum(2.5, 2.5, 2.2, 2.2, 1.2, CLOTH));
  g.add(cone(1.95, 1.1, 0x7a2a20, 4, 0, 1.2).rotateY(Math.PI / 4));
  g.add(box(2.3, 0.12, 2.3, DW_GOLD, 0, 1.16, 0));
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    g.add(cyl(0.06, 0.07, 1.5, DW_OAK, 5, x * 1.2, 0, z * 1.2));
    g.add(blob(0.09, DW_GOLD, x * 1.2, 1.55, z * 1.2));
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    g.add(blob(0.18, DW_BASALT_MD, Math.cos(a) * 1.3, 0.06, Math.sin(a) * 1.3, 1.2, 0.6, 1));
  }
  g.add(cyl(0.05, 0.05, 1.0, DW_OAK, 4, 0, 2.2));
  g.add(box(0.7, 1.0, 0.08, SOOT, 0, 0, 1.26));
  g.add(roundShield(0.3, 0, 1.0, 1.3, 0));
  const l = lantern(0.8);
  l.position.set(0.85, 0.9, 1.35);
  g.add(l, cyl(0.03, 0.03, 0.9, DW_OAK, 4, 0.85, 0, 1.35));
  return g;
}

/** A mastery standard of the hold: a stone foot, an oak pole, a gold bar and a rune-red banner with a rune on it. */
export function forgeStandard(h: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  g.add(frustum(0.5, 0.5, 0.34, 0.34, 0.4, DW_BASALT));
  g.add(cyl(0.06, 0.07, h, DW_OAK, 5, 0, 0.3));
  g.add(box(0.9, 0.08, 0.08, DW_GOLD, 0, h - 0.2, 0));
  g.add(box(0.72, 1.2, 0.04, accent, 0, h - 1.42, 0.05));
  const rn = forgeRune(0.36, 1);
  rn.position.set(0, h - 0.84, 0.09);
  g.add(rn);
  g.add(cone(0.1, 0.36, DW_GOLD, 4, 0, h + 0.3));
  return g;
}

/** The mastery piece at the hold's stable: a golden war-ram on a plinth of basalt. */
export function forgeGoldGoat(): THREE.Group {
  const g = new THREE.Group();
  g.add(frustum(1.4, 0.8, 1.2, 0.66, 0.5, DW_BASALT));
  const r = goat(DW_GOLD, 0.8);
  r.position.y = 0.5;
  g.add(r);
  for (const z of [-1, 1]) g.add(horn(V(0.68, 1.46, z * 0.1), V(0.74, 1.64, z * 0.38), V(0.52, 1.5, z * 0.42), 0.08, DW_GOLD, 3));
  return g;
}

/** A mastery crown of the hold: a golden anvil on a basalt block, a hammer across it and sparks circling. */
export function forgeCrown(s: number): THREE.Group {
  const g = new THREE.Group();
  g.add(frustum(0.9 * s, 0.7 * s, 0.7 * s, 0.56 * s, 0.26 * s, DW_BASALT));
  g.add(frustum(0.7 * s, 0.4 * s, 0.4 * s, 0.3 * s, 0.24 * s, DW_GOLD, 0, 0.26 * s, 0));
  g.add(frustum(0.4 * s, 0.3 * s, 0.9 * s, 0.4 * s, 0.24 * s, DW_GOLD, 0, 0.5 * s, 0));
  g.add(cone(0.14 * s, 0.5 * s, DW_GOLD, 5, 0.45 * s, 0.62 * s, 0).rotateZ(-Math.PI / 2));
  const parts = new THREE.Group();
  for (let i = 0; i < 7; i++) parts.add(glow(new THREE.OctahedronGeometry(0.08, 0), i % 2 ? 0xffa24a : 0xffd070, i % 2 ? 0xc8560e : 0xd08a20).translateX(Math.cos(i * 0.9) * 0.9 * s).translateY(0.4 * s + (i % 4) * 0.3).translateZ(Math.sin(i * 0.9) * 0.9 * s));
  g.add(swarm(parts, { orbit: 0.5, bob: 0.3 }));
  return g;
}

/** The ram's frame in the Forgelord's army: a steam drill, a boiler and its stack riding on the frame. */
export function forgeRamFrame(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.4, 10).rotateX(Math.PI / 2), DW_BRONZE).translateY(2.95).translateZ(-0.6));
  for (const z of [-1.1, -0.1]) g.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 10).rotateX(Math.PI / 2), DW_GOLD).translateY(2.95).translateZ(z));
  g.add(cyl(0.12, 0.15, 1.0, IRON_BK, 6, 0, 3.2, -1.1));
  return g;
}

/** The head of the steam drill: a long bronze bit cut with a spiral (it points +Z on the ram's log). */
export function forgeRamBit(): THREE.Group {
  const g = new THREE.Group();
  g.add(cone(0.38, 0.95, DW_BRONZE, 8, 0, 0, 1.9).rotateX(Math.PI / 2));
  g.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 8).rotateX(Math.PI / 2), DW_GOLD).translateZ(1.88));
  for (let i = 0; i < 8; i++) {
    const k = i / 8, a = i * 1.1, rr = 0.38 * (1 - k) + 0.02;
    const rib = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.12), DW_BRONZE_DK);
    rib.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 1.95 + k * 0.85);
    g.add(rib);
  }
  return g;
}

/** Where the wall's bolt-throwers stand (the heads of their towers), the nearest three to an attack from bearing `theta`
 *  (for the Forgelord's volley in a battle: any village's towers stand at these same places). */
export function boltThrowers(level: number, theta: number, R: number, gateA: number, gateHalf: number): THREE.Vector3[] {
  const tier = level <= 0 ? 0 : level < 5 ? 1 : level < 10 ? 2 : level < 15 ? 3 : 4;
  if (!tier) return [];
  const start = gateA + gateHalf, end = gateA + Math.PI * 2 - gateHalf;
  let angles: number[] = [theta - 0.1, theta + 0.1];
  let y = 3.4;
  if (tier === 2) {
    angles = Array.from({ length: 8 }, (_, i) => gateA + gateHalf + 0.35 + (i / 8) * (Math.PI * 2 - gateHalf * 2 - 0.5));
    y = 7.7;
  } else if (tier >= 3) {
    const n = tier === 3 ? 8 : 12;
    angles = Array.from({ length: n - 2 }, (_, i) => start + ((end - start) * (i + 1)) / (n - 1));
    y = tier === 3 ? 7.9 : 9.9;
  }
  const off = (a: number) => Math.abs(Math.atan2(Math.sin(a - theta), Math.cos(a - theta)));
  return angles.sort((a, b) => off(a) - off(b)).slice(0, 3).map((a) => new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R));
}
