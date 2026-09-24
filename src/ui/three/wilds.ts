// The wilds of the east and the south, as the 3D village draws them. The seasons 'desert'
// and 'jungle' (kit.ts) already repaint the ground, water and rock; this module gives those
// lands their own growth and shape. In the eastern desert: date palms by the water, saguaros,
// dry scrub and flat-topped acacias, dunes rolling away from the walls, red sandstone buttes
// on the skyline, an oasis of reeds and green along the stream, irrigated barley and melons.
// In the southern jungle: great trees on buttress roots hung with vines, broadleaf canopy,
// banana plants and tree ferns, ferns and giant leaves underfoot, bright flowers, low mist
// drifting between the trees, fireflies at night, rice paddies and a banana grove.
// Everything here is keyed on the season, so the heartland, winter and volcanic villages are
// drawn exactly as before (and no random numbers are drawn for them).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C, blob, box, branch, cone, cyl, detailMat, extrude, fireflies, getSeason, leafCluster, mesh, type LeafPal } from './kit';

type Rand = () => number;
export type WildLand = 'desert' | 'jungle';

/** The wild land the village stands in, if it stands in one. */
export function wildLand(): WildLand | null {
  const s = getSeason();
  return s === 'desert' || s === 'jungle' ? s : null;
}

// the wilds' own colours (none is a palette key, so no season or theme repaints them)
const PALM_BARK = 0x8c6b47, PALM_BOOT = 0x6a5034, FROND = 0x6f9c3c, FROND_DK = 0x4f7d2e, FROND_DRY = 0xa6944e, DATES = 0xb5602a;
const CACTUS = 0x5e8c40, CACTUS_DK = 0x4a7a38, CACTUS_BLOOM = 0xf4d6de, PEAR_FRUIT = 0xc2386e;
const SCRUB = 0x8e8a4e, SCRUB_DK = 0x6d6a3a, DRY_GRASS = 0xc2a862, THORN_BARK = 0x5e4630;
const ACACIA: LeafPal = { top: 0x98aa52, mid: 0x76893f, under: 0x56682f };
const SANDSTONE = 0xc4845a, SANDSTONE_DK = 0x9c5e3e, SANDSTONE_LT = 0xd9a474;
const REED = 0x7f9a44, REED_DK = 0x5f7d34;
const JBARK = 0x5e4a34, JBARK_DK = 0x43352a, VINE = 0x2f6a2a, VINE_LEAF = 0x4c9a3a;
const BANANA = 0x5fae3f, BANANA_DK = 0x479536, BANANA_STEM = 0x7d8f4a, BANANA_FRUIT = 0x9ab43e, BANANA_BELL = 0x7a2a4a;
const FERN = 0x3f9038, FERN_DK = 0x2b6d2a, GIANT_LEAF = 0x3a8a34, BUSH = 0x2f6a2c;
/** Jungle flowers: little bright details that cast no shadow. */
const BLOOMS = [0xf2587a, 0xffc83a, 0xe8443a, 0xc65ad2];

// ---------- shapes ----------

/**
 * A leaf blade along +X: arching up from the origin and drooping to its tip, folded down either
 * side of its midrib so the sun catches one half and not the other (palm fronds, banana leaves, ferns).
 */
function blade(len: number, width: number, droop: number, segs: number, lift = 0.22): THREE.BufferGeometry {
  const spine: THREE.Vector3[] = [], left: THREE.Vector3[] = [], right: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = len * t, y = Math.sin(t * Math.PI * 0.85) * len * lift - t * t * droop * len;
    const w = i === segs ? 0 : width * Math.sin(Math.PI * Math.min(1, 0.14 + t * 0.95));
    spine.push(new THREE.Vector3(x, y, 0));
    left.push(new THREE.Vector3(x, y - w * 0.35, w));
    right.push(new THREE.Vector3(x, y - w * 0.35, -w));
  }
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < segs; i++) {
    tri(spine[i], left[i], spine[i + 1]);
    tri(spine[i], spine[i + 1], right[i]);
    if (i < segs - 1) {
      tri(left[i], left[i + 1], spine[i + 1]);
      tri(right[i], spine[i + 1], right[i + 1]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** A leaf blade (see blade) set on a crown at (x, y, z), reaching out at angle `a`. */
function leaf(geo: THREE.BufferGeometry, color: number, a: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = mesh(geo, color, { double: true });
  m.position.set(x, y, z);
  m.rotation.set(0, -a, 0);
  return m;
}

function octa(r: number, color: number, x: number, y: number, z: number, detail = false): THREE.Mesh {
  const m = detail ? new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), detailMat(color)) : mesh(new THREE.OctahedronGeometry(r, 0), color);
  m.position.set(x, y, z);
  return m;
}

// ---------- the desert ----------

/** A date palm: a leaning, tapering trunk, a crownshaft of old leaf bases, arching fronds and bunches of dates. */
function datePalm(r: Rand, detail: number): THREE.Group {
  const g = new THREE.Group();
  const h = 4.4 + r() * 1.6, lean = 0.4 + r() * 0.8, dir = r() * Math.PI * 2;
  const dx = Math.cos(dir), dz = Math.sin(dir);
  const trunk = new THREE.CylinderGeometry(0.17, 0.27, h, 6, detail ? 4 : 2, true);
  trunk.translate(0, h / 2, 0);
  const p = trunk.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const k = lean * Math.pow(Math.max(0, p.getY(i) / h), 1.8);
    p.setX(i, p.getX(i) + dx * k);
    p.setZ(i, p.getZ(i) + dz * k);
  }
  trunk.computeVertexNormals();
  g.add(mesh(trunk, PALM_BARK));
  const tx = dx * lean, tz = dz * lean;
  g.add(cyl(0.34, 0.2, 0.6, PALM_BOOT, 6, tx, h - 0.55, tz));
  const n = detail ? 8 : 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.35;
    g.add(leaf(blade(2.3 + r() * 0.5, 0.36, i % 2 ? 0.75 : 0.45, detail ? 3 : 2), i % 3 === 0 ? FROND_DK : FROND, a, tx, h, tz));
  }
  if (detail) {
    // a dead frond hanging against the trunk, and the dates
    g.add(leaf(blade(1.5, 0.26, 1.3, 2, 0.05), FROND_DRY, r() * Math.PI * 2, tx, h - 0.15, tz));
    g.add(octa(0.2, DATES, tx + 0.22, h - 0.45, tz + 0.12), octa(0.17, DATES, tx - 0.16, h - 0.5, tz + 0.2));
  }
  return g;
}

/** A saguaro: a ribbed column with arms turning up from elbows (now and then a bloom on top). */
function saguaro(r: Rand, detail: number): THREE.Group {
  const g = new THREE.Group();
  const h = 3.4 + r() * 1.8;
  g.add(cyl(0.4, 0.45, h, CACTUS, 7));
  g.add(cone(0.4, 0.34, CACTUS, 7, 0, h));
  const arms = 1 + Math.floor(r() * 2.4);
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + r() * 1.2, y = h * (0.32 + r() * 0.25), out = 0.72 + r() * 0.25, up = 0.9 + r() * 0.9;
    const ax = Math.cos(a) * out, az = Math.sin(a) * out;
    g.add(branch(new THREE.Vector3(0, y, 0), new THREE.Vector3(ax, y + 0.16, az), 0.27, CACTUS_DK, 6));
    g.add(cyl(0.23, 0.25, up, CACTUS, 6, ax, y, az));
    g.add(cone(0.23, 0.2, CACTUS, 6, ax, y + up, az));
  }
  if (detail && r() < 0.45) g.add(octa(0.15, CACTUS_BLOOM, 0, h + 0.36, 0, true));
  return g;
}

/** A prickly pear: flat pads growing out of each other, a few red fruit on their rims. */
function pricklyPear(r: Rand): THREE.Group {
  const g = new THREE.Group();
  const pad = (x: number, y: number, z: number, s: number, tilt: number, turn: number) => {
    const m = blob(0.42 * s, r() < 0.5 ? CACTUS : CACTUS_DK, x, y, z, 0.9, 1.15, 0.32);
    m.rotation.set(0, turn, tilt);
    g.add(m);
  };
  const turn = r() * Math.PI;
  pad(0, 0.45, 0, 1.1, 0, turn);
  pad(-0.35, 0.95, 0, 0.9, 0.5, turn);
  pad(0.38, 1.05, 0.05, 0.85, -0.45, turn + 0.3);
  if (r() < 0.6) pad(0.1, 1.45, 0, 0.7, -0.1, turn + 0.6);
  for (let i = 0; i < 3; i++) g.add(octa(0.08, PEAR_FRUIT, (r() - 0.5) * 0.9, 1.3 + r() * 0.4, (r() - 0.5) * 0.3, true));
  return g;
}

/** Dry, wind-bitten scrub with a few tufts of pale grass round it. */
function scrub(r: Rand): THREE.Group {
  const g = new THREE.Group();
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) g.add(blob(0.42 + r() * 0.3, i % 2 ? SCRUB : SCRUB_DK, (r() - 0.5) * 0.9, 0.28, (r() - 0.5) * 0.9, 1.2, 0.7, 1.1));
  for (let i = 0; i < 3; i++) g.add(grassTuft(r, DRY_GRASS, (r() - 0.5) * 2, (r() - 0.5) * 2));
  return g;
}

/** A tuft of grass or reeds: three thin blades leaning apart. */
function grassTuft(r: Rand, color: number, x: number, z: number, h = 0.7): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const b = cone(0.06, h * (0.8 + r() * 0.5), color, 3);
    b.rotation.set((r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6);
    g.add(b);
  }
  g.position.set(x, 0, z);
  return g;
}

/** An umbrella thorn: a leaning trunk forking under a wide, flat crown. */
function acacia(r: Rand, detail: number): THREE.Group {
  const g = new THREE.Group();
  const h = 2.4 + r() * 0.8, lean = (r() - 0.5) * 0.6, seed = Math.floor(r() * 1000);
  g.add(branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean, h, 0), 0.2, THORN_BARK, 5));
  for (const s of [-1, 1]) g.add(branch(new THREE.Vector3(lean * 0.7, h * 0.7, 0), new THREE.Vector3(lean + s * 1.1, h + 0.35, s * 0.3), 0.1, THORN_BARK, 4));
  g.add(leafCluster(1.5, ACACIA, lean, h + 0.55, 0, 1.6, 0.3, 1.35, 0, seed));
  if (detail) g.add(leafCluster(0.9, ACACIA, lean + 0.9, h + 0.4, 0.45, 1.5, 0.3, 1.3, 0, seed + 1));
  return g;
}

/** A butte of banded red sandstone, flat-topped, with scree at its foot. */
function butte(r: Rand, w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const bands: [number, number, number][] = [[1.18, 0.3, SANDSTONE_DK], [1.0, 0.42, SANDSTONE], [0.94, 0.28, SANDSTONE_LT]];
  let y = 0;
  for (const [k, f, col] of bands) {
    const m = cyl(w * k * 0.96, w * k, h * f, col, 6, 0, y, 0);
    m.rotation.y = r() * 0.4;
    g.add(m);
    y += h * f;
  }
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2;
    g.add(blob(0.5 + r() * 0.7, i % 2 ? SANDSTONE_DK : SANDSTONE, Math.cos(a) * w * 1.25, 0.2, Math.sin(a) * w * 1.25, 1.3, 0.6, 1.1));
  }
  g.scale.set(1, 1, 0.7 + r() * 0.4);
  return g;
}

// ---------- the jungle ----------

/** Vines hanging from a crown: cords with a leaf at every tip. */
function vines(g: THREE.Group, r: Rand, n: number, rad: number, y: number): void {
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = rad * (0.45 + r() * 0.5), len = 1.2 + r() * 2.2;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    g.add(box(0.05, len, 0.05, VINE, x, y - len, z));
    g.add(octa(0.13, VINE_LEAF, x, y - len, z));
  }
}

/** A canopy tree: a short, stout trunk under a broad dome of deep green, a sunlit crown on top. */
function canopyTree(r: Rand, detail: number): THREE.Group {
  const g = new THREE.Group();
  const h = 2.3 + r() * 0.9, seed = Math.floor(r() * 1000);
  g.add(cyl(0.22, 0.36, h + 0.5, JBARK, 6));
  if (detail) for (const s of [-1, 1]) g.add(branch(new THREE.Vector3(0, h * 0.6, 0), new THREE.Vector3(s * 1.2, h + 0.4, (r() - 0.5) * 0.8), 0.11, JBARK, 4));
  g.add(leafCluster(2.2, 'deep', 0, h + 0.7, 0, 1.3, 0.5, 1.25, 0, seed));
  g.add(leafCluster(1.5, 'sun', (r() - 0.5) * 0.8, h + 1.6, (r() - 0.5) * 0.8, 1.15, 0.6, 1.1, 0, seed + 1));
  if (detail) g.add(leafCluster(1.1, 'mid', 1.5, h + 0.9, 0.6, 1.1, 0.6, 1.1, 0, seed + 2));
  if (detail && r() < 0.4) vines(g, r, 2, 2.2, h + 0.4);
  return g;
}

/** A thicket of the undergrowth: a lumpy mass of dark leaves, head-high. */
function thicket(r: Rand): THREE.Group {
  return leafCluster(1.7 + r() * 0.7, r() < 0.25 ? 'mid' : 'deep', 0, 0.8, 0, 1.35, 0.62, 1.15, 0, Math.floor(r() * 1000));
}

/** A mass of jungle seen from above: one great lumpy dome of leaves, standing for a stand of trees too thick to tell apart. */
function canopyMass(r: Rand): THREE.Group {
  const seed = Math.floor(r() * 1000);
  return leafCluster(5 + r() * 2.5, r() < 0.3 ? 'sun' : 'deep', 0, 2.2, 0, 1.25, 0.46, 1.1, 0, seed);
}

/** A buttress root: a thin fin flaring from the trunk down into the ground (in the XY plane, along +X). */
function buttress(len: number, h: number): THREE.Mesh {
  return extrude([[0, -0.1], [len, -0.1], [len * 0.55, h * 0.16], [len * 0.25, h * 0.42], [0, h]], 0.14, JBARK_DK);
}

/** A giant of the jungle: a tall trunk on buttress roots, limbs spreading to a high, wide crown, vines hanging from it. */
function giantTree(r: Rand, detail: number): THREE.Group {
  const g = new THREE.Group();
  const h = 7 + r() * 2.5, seed = Math.floor(r() * 1000);
  g.add(cyl(0.36, 0.58, h, JBARK, 7));
  const fins = 4 + (r() < 0.5 ? 1 : 0);
  for (let i = 0; i < fins; i++) {
    const f = buttress(1.5 + r() * 0.5, 1.6 + r() * 0.8);
    f.rotation.y = -((i / fins) * Math.PI * 2 + r() * 0.4);
    g.add(f);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + r() * 0.6;
    const ex = Math.cos(a) * 2.1, ez = Math.sin(a) * 2.1;
    g.add(branch(new THREE.Vector3(0, h * 0.78, 0), new THREE.Vector3(ex, h + 0.7, ez), 0.2, JBARK, 5));
    g.add(leafCluster(1.8, i % 2 ? 'deep' : 'mid', ex, h + 1.1, ez, 1.2, 0.55, 1.2, 0, seed + i));
  }
  g.add(leafCluster(2, 'sun', 0, h + 1.9, 0, 1.2, 0.6, 1.2, detail ? 1 : 0, seed + 5));
  vines(g, r, detail ? 5 : 2, 2.4, h + 0.8);
  return g;
}

/** A banana plant: a soft green stem, a fan of big paddle leaves, sometimes a bunch of fruit and its purple bell. */
function banana(r: Rand, detail: number): THREE.Group {
  const g = new THREE.Group();
  const h = 1.6 + r() * 0.8;
  g.add(cyl(0.12, 0.2, h, BANANA_STEM, 5));
  const n = detail ? 6 : 4;
  for (let i = 0; i < n; i++) g.add(leaf(blade(1.6 + r() * 0.5, 0.42, 0.55, 2, 0.35), i % 2 ? BANANA : BANANA_DK, (i / n) * Math.PI * 2 + r() * 0.5, 0, h, 0));
  if (detail && r() < 0.4) g.add(octa(0.2, BANANA_FRUIT, 0.25, h - 0.35, 0), octa(0.12, BANANA_BELL, 0.3, h - 0.7, 0));
  return g;
}

/** A tree fern: a slim dark trunk under a crown of arching fronds. */
function treeFern(r: Rand, detail: number): THREE.Group {
  const g = new THREE.Group();
  const h = 1.8 + r() * 1.2;
  g.add(cyl(0.12, 0.17, h, JBARK_DK, 5));
  const n = detail ? 7 : 5;
  for (let i = 0; i < n; i++) g.add(leaf(blade(1.5 + r() * 0.3, 0.22, 0.6, 2, 0.3), i % 2 ? FERN : FERN_DK, (i / n) * Math.PI * 2 + r() * 0.4, 0, h, 0));
  return g;
}

/** Ferns on the forest floor. */
function groundFern(r: Rand): THREE.Group {
  const g = new THREE.Group();
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) g.add(leaf(blade(0.9 + r() * 0.4, 0.17, 0.45, 2, 0.5), i % 2 ? FERN : FERN_DK, (i / n) * Math.PI * 2 + r() * 0.5, 0, 0.05, 0));
  return g;
}

/** Elephant ears: great leaves held up on stalks. */
function giantLeaves(r: Rand): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + r() * 0.6, rise = 0.9 + r() * 0.5;
    const tx = Math.cos(a) * 0.45, tz = Math.sin(a) * 0.45;
    g.add(branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(tx, rise, tz), 0.05, BANANA_STEM, 4));
    g.add(leaf(blade(1.1 + r() * 0.3, 0.55, 0.3, 2, 0.12), GIANT_LEAF, a, tx, rise, tz));
  }
  return g;
}

/** A dark green bush starred with bright flowers. */
function flowerBush(r: Rand): THREE.Group {
  const g = new THREE.Group();
  g.add(blob(0.6 + r() * 0.2, BUSH, 0, 0.35, 0, 1.25, 0.75, 1.15));
  const bloom = BLOOMS[Math.floor(r() * BLOOMS.length)];
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2;
    g.add(octa(0.13, bloom, Math.cos(a) * 0.55, 0.45 + r() * 0.3, Math.sin(a) * 0.55, true));
  }
  return g;
}

// ---------- trees ----------

/** Where a tree is to stand: its place, and how far it is from the stream. */
export interface WildSpot { x: number; z: number; water?: number }

/**
 * In the desert or the jungle, the tree (or palm, cactus, bush) that grows where the heartland
 * would have an oak, a pine or a birch; null anywhere else. By the water of the desert grow palms,
 * out on the dunes cactus, scrub and a lone acacia, and much of the sand is left bare. The jungle's
 * trees are bigger and denser: canopy trees, now and then a buttressed giant, banana plants and tree ferns.
 */
export function wildTree(kind: 'oak' | 'pine' | 'birch', r: Rand, scale: number, detail: number, at?: WildSpot): THREE.Group | null {
  const land = wildLand();
  if (!land) return null;
  const d = at ? Math.hypot(at.x, at.z) : 60;
  const q = r();
  let g: THREE.Group;
  let k = scale * (0.8 + r() * 0.45);
  if (land === 'desert') {
    const wet = at?.water !== undefined && at.water < 16;
    const home = d < 72;
    if (wet) g = q < 0.85 ? datePalm(r, detail) : scrub(r);
    else if (d < 44) g = datePalm(r, detail); // the palms of the village's courtyards
    else if (!at) g = q < 0.5 ? datePalm(r, detail) : q < 0.85 ? acacia(r, detail) : scrub(r);
    else if (kind === 'pine') g = q < 0.5 ? (r() < 0.7 ? saguaro(r, detail) : pricklyPear(r)) : q < 0.8 ? scrub(r) : new THREE.Group();
    else if (home) g = q < 0.3 ? datePalm(r, detail) : q < 0.5 ? acacia(r, detail) : q < 0.72 ? scrub(r) : q < 0.84 ? saguaro(r, detail) : new THREE.Group();
    else g = q < 0.08 ? datePalm(r, detail) : q < 0.2 ? acacia(r, detail) : q < 0.42 ? scrub(r) : q < 0.62 ? saguaro(r, detail) : new THREE.Group();
  } else {
    if (d < 44) g = q < 0.5 ? canopyTree(r, detail) : banana(r, 1); // a shade tree or a banana plant in a courtyard
    else if (kind === 'birch') g = q < 0.5 ? banana(r, detail) : canopyTree(r, detail);
    else if (kind === 'pine') g = q < 0.45 ? treeFern(r, detail) : q < 0.85 ? canopyTree(r, detail) : banana(r, detail);
    // (the giants stand out beyond the workplaces, where their crowns have room)
    else if (q < 0.13 && d > 72) g = giantTree(r, detail);
    else g = q < 0.72 ? canopyTree(r, detail) : q < 0.86 ? banana(r, detail) : treeFern(r, detail);
    // the jungle grows bigger than the woods at home
    if (g.children.length && d >= 44) k *= 1.2;
  }
  g.scale.setScalar(k);
  g.rotation.y = r() * Math.PI * 2;
  return g;
}

// ---------- the ground ----------

/** Where a field lies across the long dunes (0 to 1, the crest at 0.72) and how high they run there. */
function dunes(x: number, z: number): { p: number; amp: number } {
  const u = (x * 0.82 + z * 0.3) / 27 + Math.sin(z / 23) * 0.55 + Math.sin(x / 41 + z / 57) * 0.4;
  return { p: u - Math.floor(u), amp: 2.3 + Math.sin(x / 37 - z / 29) * 0.9 };
}

/**
 * How much the land rises out in the desert: long dunes, a gentle windward slope up to a sharp
 * crest and a steep lee, beginning well clear of the walls, the fields and the stream.
 * Zero anywhere but the desert. `fromWall` is the distance outside the wall, `fromStream` from the stream.
 */
export function wildRelief(x: number, z: number, fromWall: number, fromStream: number): number {
  if (getSeason() !== 'desert' || fromWall < 30 || fromStream < 7) return 0;
  const f = Math.min(1, (fromWall - 30) / 28) * Math.min(1, (fromStream - 7) / 12);
  const { p, amp } = dunes(x, z);
  const prof = p < 0.72 ? Math.pow(p / 0.72, 1.4) : Math.pow((1 - p) / 0.28, 1.5);
  return prof * amp * f;
}

/**
 * The colour of a piece of ground in the wilds (as the village terrain lays it out), given the
 * colour the heartland would give it: in the desert the dunes' sunlit crests and shaded lee
 * slopes and a band of green along the oasis stream; in the jungle dark mud by the water and
 * patches of deep moss and sunlit clearing. Anything else, and anywhere else, is left as it is.
 */
export function wildGround(c: number, x: number, z: number, y: number, fromWall: number, fromStream: number, road: boolean): number {
  const land = wildLand();
  if (!land || road || fromWall < 0 || fromStream < 4.2) return c;
  // a dune's crest stands high, but it is still sand (the heartland would have taken it for rock)
  const dune = wildRelief(x, z, fromWall, fromStream);
  if (y - dune > 3) return c;
  // only open ground (not roads, water, clay, the hills' rock or a theme's own patches)
  const open = c === C.grass || c === C.grassLight || c === C.grassDark || c === C.grassRust || (dune > 0 && (c === C.rock || c === C.rockDark));
  if (!open) return c;
  const n = Math.sin(x * 0.21 + Math.cos(z * 0.17) * 1.3) * 0.5 + Math.sin(z * 0.19 - x * 0.07) * 0.5;
  if (land === 'desert') {
    // the oasis: grass and reeds along the stream
    if (fromStream < 9 + n * 2) return n > 0.3 ? 0x86a24a : n < -0.3 ? 0x6a8a3c : 0x7a9844;
    if (fromWall > 32 && fromStream > 10) {
      // out on the dunes the sand is all one, so their crests and shadows are what you see
      const { p } = dunes(x, z);
      if (p > 0.74) return n > 0 ? 0xc29c60 : 0xbc965a; // the lee, in shade
      if (p > 0.63) return 0xebd29c; // the crest, catching the sun
      return p < 0.25 ? 0xd4b273 : n > 0.4 ? 0xdcbd7e : 0xd8b979; // the long windward slope
    }
    return c === C.rock || c === C.rockDark ? C.grass : c;
  }
  if (fromStream < 6.5) return 0x4e4029; // mud along the river
  if (n > 0.55) return 0x24532a; // deep shade and moss under the trees
  if (n < -0.72) return 0x4c963c; // a sunny clearing
  return c;
}

// ---------- the scenery ----------

export interface WildEnv {
  at: (x: number, z: number) => number;
  free: (x: number, z: number) => boolean;
  streamX: (z: number) => number;
  wallR: number;
}

/** Mist: pale, soft-edged sheets, lit like everything else so they dim at night (one material, made once and shared like the kit's). */
let mistMat: THREE.MeshLambertMaterial | null = null;
function mistMaterial(): THREE.MeshLambertMaterial {
  if (mistMat) return mistMat;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  mistMat = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c), color: 0xe4f0dc, transparent: true, opacity: 0.3, depthWrite: false });
  return mistMat;
}

/**
 * The rest of the wild land round the village: in the desert, red buttes on the skyline, reeds
 * along the oasis stream and tufts of dry grass; in the jungle, ferns, giant leaves and flowering
 * bushes under the trees, low mist drifting through them and fireflies by night.
 */
export function addWilds(g: THREE.Group, r: Rand, env: WildEnv): void {
  const land = wildLand();
  if (!land) return;
  const { at, free, streamX, wallR } = env;
  // (the ground outside the gate that some villages keep for a tournament, a stone circle or the like stays clear)
  const open = (x: number, z: number) => free(x, z) && Math.hypot(x - 21, z - 57.5) > 14;
  const scatter = (n: number, dMin: number, dMax: number, place: (x: number, z: number, y: number) => void, ok: (x: number, z: number) => boolean = open) => {
    for (let placed = 0, tries = 0; placed < n && tries < n * 30; tries++) {
      const a = r() * Math.PI * 2, d = dMin + r() * (dMax - dMin);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.abs(x) > 150 || Math.abs(z) > 150 || !ok(x, z)) continue;
      place(x, z, at(x, z));
      placed++;
    }
  };
  const put = (o: THREE.Object3D, x: number, y: number, z: number, s = 1) => {
    o.position.set(x, y, z);
    o.rotation.y = r() * Math.PI * 2;
    o.scale.multiplyScalar(s);
    g.add(o);
  };
  if (land === 'desert') {
    // red buttes along the skyline, behind the village and off to the sides (never in front of it)
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1.02 + (i / 6) * 0.96) + (r() - 0.5) * 0.18, d = 118 + r() * 30;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!free(x, z)) continue;
      put(butte(r, 3 + r() * 3.5, 5 + r() * 7), x, at(x, z) - 0.3, z);
    }
    // reeds and rushes along the oasis stream
    for (let i = 0; i < 46; i++) {
      const z = -150 + r() * 300, side = r() < 0.5 ? -1 : 1, x = streamX(z) + side * (3.4 + r() * 2.2);
      put(grassTuft(r, r() < 0.5 ? REED : REED_DK, 0, 0, 1.2 + r() * 0.5), x, at(x, z), z);
    }
    // scrub, wind-worn boulders and tufts of dry grass on the sand round the walls
    scatter(16, wallR + 5, 85, (x, z, y) => put(scrub(r), x, y, z, 1 + r() * 0.4));
    scatter(10, wallR + 5, 90, (x, z, y) => put(blob(0.7 + r() * 0.8, r() < 0.5 ? SANDSTONE : SANDSTONE_DK, 0, 0.25, 0, 1.3, 0.6, 1.1), x, y, z));
    scatter(40, wallR + 6, 110, (x, z, y) => put(grassTuft(r, DRY_GRASS, 0, 0), x, y, z, 0.9 + r() * 0.5));
    return;
  }
  // the jungle closing in: masses of canopy standing together in thick stands, clearings between them
  const stand = (x: number, z: number) => Math.sin(x / 19 + Math.cos(z / 23) * 1.7) + Math.sin(z / 17 - x / 31) > 0.35;
  // (each one clear of the buildings, the paths and the river all round, not just at its middle)
  const roomy = (x: number, z: number, rad: number) => open(x, z) && [0, 1, 2, 3, 4, 5].every((k) => open(x + Math.cos(k * 1.05) * rad, z + Math.sin(k * 1.05) * rad));
  scatter(46, wallR + 20, 130, (x, z, y) => put(canopyMass(r), x, y, z), (x, z) => stand(x, z) && Math.abs(x - streamX(z)) > 10 && roomy(x, z, 6.5));
  // thickets right up to the walls
  scatter(90, wallR + 5, 92, (x, z, y) => put(thicket(r), x, y, z, 0.9 + r() * 0.5), (x, z) => roomy(x, z, 3.5));
  // the jungle floor: ferns, giant leaves and flowering bushes, thickest near the village
  scatter(32, wallR + 5, 110, (x, z, y) => put(groundFern(r), x, y, z, 1.1 + r() * 0.6));
  scatter(20, wallR + 6, 100, (x, z, y) => put(giantLeaves(r), x, y, z, 1 + r() * 0.4));
  scatter(26, wallR + 5, 100, (x, z, y) => put(flowerBush(r), x, y, z, 0.9 + r() * 0.5));
  // low mist hanging between the trees, drifting slowly round the village
  const sheets: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = wallR + 14 + r() * 80, s = 14 + r() * 16;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const p = new THREE.PlaneGeometry(s * 1.7, s);
    p.rotateX(-Math.PI / 2);
    p.rotateY(r() * Math.PI);
    p.translate(x, at(x, z) + 1.4 + r() * 1.8, z);
    sheets.push(p);
  }
  const mist = new THREE.Mesh(mergeGeometries(sheets, false), mistMaterial());
  for (const s of sheets) s.dispose();
  mist.renderOrder = 1;
  Object.assign(mist.userData, { dynamic: true, orbit: 0.012 });
  g.add(mist);
  // fireflies by the river and at the forest's edge, only at night
  scatter(5, wallR + 12, 95, (x, z, y) => {
    const ff = fireflies(16, 7, 3.5, r);
    ff.position.set(x, y + 0.6, z);
    ff.userData.nightOnly = true;
    g.add(ff);
  }, (x, z) => roomy(x, z, 7));
}

// ---------- the fields ----------

/**
 * A field sown the wild land's way, in place of the heartland's wheat (`ripe` or green) or
 * pumpkins: irrigated barley and melon patches in the desert, rice paddies and a banana grove
 * in the jungle. Null anywhere else. Same size as the field it stands for (w by d).
 */
export function wildCrop(w: number, d: number, r: Rand, crop: 'wheat' | 'pumpkin', ripe = true): THREE.Group | null {
  const land = wildLand();
  if (!land) return null;
  const g = new THREE.Group();
  if (land === 'desert') {
    g.add(box(w, 0.08, d, 0x8a6a44, 0, 0, 0)); // dark, watered soil
    // the channel that waters it, lined with stone, along its far edge
    g.add(box(w, 0.1, 0.4, 0xb0906a, 0, 0, d / 2 - 0.2), box(w - 0.1, 0.12, 0.22, 0x3aa8b0, 0, 0.01, d / 2 - 0.2));
    const span = d - 0.5, z0 = -d / 2;
    if (crop === 'pumpkin') {
      // melons among their vines
      for (let i = 0; i < 4; i++) g.add(box(w - 0.6, 0.06, 0.3, 0x5e8a36, 0, 0.06, z0 + (i + 0.5) * (span / 4)));
      for (let i = 0; i < 12; i++) g.add(blob(0.3 + r() * 0.08, r() < 0.7 ? 0x6a9a3e : 0xd8b060, (r() - 0.5) * (w - 1), 0.28, z0 + ((i % 4) + 0.5) * (span / 4) + (r() - 0.5) * 0.3, 1.3, 0.8, 1));
      return g;
    }
    const rows = Math.max(2, Math.floor(span / 0.9));
    for (let i = 0; i < rows; i++) g.add(box(w - 0.4, 0.4 + r() * 0.1, 0.46, ripe ? 0xd9b54e : 0x86a84a, 0, 0.05, z0 + (i + 0.5) * (span / rows)));
    return g;
  }
  if (crop === 'pumpkin') {
    // a banana grove on dark soil
    g.add(box(w, 0.08, d, 0x4e3a26, 0, 0, 0));
    for (let i = 0; i < 6; i++) {
      const b = banana(r, 0);
      b.position.set(-w / 2 + 1.1 + (i % 3) * ((w - 2.2) / 2), 0, i < 3 ? -d / 4 : d / 4);
      b.rotation.y = r() * Math.PI * 2;
      b.scale.setScalar(0.7 + r() * 0.15);
      g.add(b);
    }
    return g;
  }
  // a rice paddy: water held in by a low bank of mud, rows of bright green shoots standing in it
  g.add(box(w, 0.18, d, 0x6a5a3a, 0, 0, 0));
  g.add(box(w - 0.5, 0.06, d - 0.5, 0x4a9a8c, 0, 0.14, 0));
  const rows = Math.max(3, Math.floor(d / 0.8));
  for (let i = 0; i < rows; i++) {
    const z = -d / 2 + 0.5 + (i + 0.5) * ((d - 1) / rows);
    for (let j = 0; j < 4; j++) g.add(box((w - 1.4) / 4 - 0.25, 0.32 + r() * 0.1, 0.24, ripe ? 0x9cc84e : 0x78b43e, -w / 2 + 0.7 + (j + 0.5) * ((w - 1.4) / 4), 0.14, z));
  }
  return g;
}
