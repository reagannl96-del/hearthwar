// Low-poly toolkit: autumn palette, cached materials, shape helpers and "baking"
// (merging many small parts into one mesh per material for speed).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const C = {
  grass: 0x8f9447,
  grassLight: 0xa9a452,
  grassDark: 0x6f7a3a,
  grassRust: 0xa0843f,
  dirt: 0xc8a26a,
  dirtDark: 0xa98654,
  plaster: 0xeadcbf,
  plasterWarm: 0xe2cfa6,
  timber: 0x5a3a22,
  timberLight: 0x8a5f3a,
  tile: 0xb3502c,
  tileDark: 0x8e3a1f,
  tileWarm: 0xc4683a,
  thatch: 0xc9a150,
  thatchDark: 0x9f7a36,
  stone: 0xaba494,
  stoneDark: 0x847d6f,
  stoneLight: 0xc9c2b1,
  slate: 0x5d626b,
  wood: 0x8b5a2b,
  woodDark: 0x5d3a1c,
  logEnd: 0xd8a66a,
  leafOrange: 0xd9772b,
  leafRed: 0xb03f26,
  leafYellow: 0xe2b43c,
  leafGold: 0xc98f2e,
  leafGreen: 0x6f7c35,
  pine: 0x3c5a2c,
  pineDark: 0x2c4422,
  trunk: 0x5a3d25,
  water: 0x4f86a3,
  clay: 0xb8643c,
  clayDark: 0x8e4629,
  brick: 0xa8472e,
  iron: 0x6d7782,
  rock: 0x8d877a,
  rockDark: 0x6a655b,
  wheat: 0xd8b24a,
  wheatDark: 0xb98f2f,
  hay: 0xd6ad55,
  pumpkin: 0xe07b24,
  red: 0xb3332a,
  white: 0xf1e8d4,
  blue: 0x2f5d99,
  gold: 0xd9a441,
  window: 0x2a2018,
  door: 0x4a2f1a,
  dark: 0x241a12,
  fire: 0xff9a3a,
  flame: 0xffd35a,
  horse: 0x6b4a30,
  horseDark: 0x3b2a1c,
  skin: 0xe0b48a,
} as const;

const cache = new Map<string, THREE.MeshLambertMaterial>();

export type Season = 'fall' | 'winter' | 'volcanic';
let season: Season = 'fall';
export function setSeason(s: Season) {
  season = s;
}
export function getSeason(): Season {
  return season;
}

/** In winter, roofs, fields and foliage are buried under snow. */
const WINTER: Record<number, number> = {
  [C.tile]: 0xe9eef3, [C.tileDark]: 0xc9d3dc, [C.tileWarm]: 0xe4eaef, [C.thatch]: 0xe7ecf0, [C.thatchDark]: 0xc6d0d8,
  [C.slate]: 0xdde5ec, [C.leafOrange]: 0xeef3f7, [C.leafRed]: 0xe2e9ef, [C.leafYellow]: 0xf3f6f8, [C.leafGold]: 0xdde5eb,
  [C.leafGreen]: 0xe6ecf0, [C.hay]: 0xe7ecef, [C.wheat]: 0xf0f4f7, [C.wheatDark]: 0xd3dce3, [C.pumpkin]: 0xdfe7ed,
  [C.grass]: 0xe8eef2, [C.grassLight]: 0xf1f5f8, [C.grassDark]: 0xd6dfe6, [C.grassRust]: 0xdce3e8, [C.pine]: 0x2e4a2e,
  [C.pineDark]: 0x243d26, [C.clay]: 0x9c7a62, [C.clayDark]: 0x85695a, [C.water]: 0x9fc3d8,
  [C.dirt]: 0xcfc5b3, [C.dirtDark]: 0xb3a791, [C.rock]: 0xd0d5da, [C.rockDark]: 0x9aa0a6,
};

/** In the volcanic west the ground is ash and black rock, water runs as lava and the trees are burnt. */
const VOLCANIC: Record<number, number> = {
  [C.grass]: 0x4c4846, [C.grassLight]: 0x5a5552, [C.grassDark]: 0x3b3736, [C.grassRust]: 0x5e4034,
  [C.dirt]: 0x3f3a38, [C.dirtDark]: 0x2e2a29, [C.water]: 0xe0561c, [C.rock]: 0x3d3533, [C.rockDark]: 0x2b2422,
  [C.leafOrange]: 0x3a302c, [C.leafRed]: 0x4a2a22, [C.leafYellow]: 0x4a403a, [C.leafGold]: 0x3f3530, [C.leafGreen]: 0x3a3632,
  [C.pine]: 0x2e2826, [C.pineDark]: 0x241e1c, [C.clay]: 0x6a3a28, [C.clayDark]: 0x4e2a1e, [C.pumpkin]: 0x9a4a1e,
  0x97a24e: 0x55504c, 0x7f8d43: 0x46423f, 0x8b984a: 0x4e4945,
};

/** Each statue hero gives the village its own look. */
export type Theme = 'classic' | 'sorcerer' | 'druid' | 'goblin' | 'necromancer';
let theme: Theme = 'classic';
export function setTheme(t: Theme) {
  theme = t;
}
export function getTheme(): Theme {
  return theme;
}

const THEMES: Record<Theme, Record<number, number>> = {
  classic: {},
  // violet slate roofs, pale lavender walls, blue-grey stone, purple banners
  sorcerer: {
    [C.tile]: 0x4b2f86, [C.tileDark]: 0x36205f, [C.tileWarm]: 0x5d3b9e, [C.thatch]: 0x3d4f9a, [C.thatchDark]: 0x2d3a73,
    [C.plaster]: 0xdcd6ee, [C.plasterWarm]: 0xcfc6e6, [C.timber]: 0x2c2340, [C.timberLight]: 0x4a3d66,
    [C.stone]: 0x9d9bb3, [C.stoneDark]: 0x747290, [C.stoneLight]: 0xc4c2d8, [C.red]: 0x6a3fa0, [C.slate]: 0x3a3163, [C.door]: 0x2a1d40,
    // the ground turns to an enchanted twilight meadow
    [C.grass]: 0x5f7568, [C.grassLight]: 0x708879, [C.grassDark]: 0x4b5f57, [C.grassRust]: 0x8a7aa8,
    [C.dirt]: 0xbcaecb, [C.dirtDark]: 0x9585ad, [C.water]: 0x4f7fd0,
    0x97a24e: 0x74907c, 0x7f8d43: 0x5d7468, 0x8b984a: 0x688272,
  },
  // moss and turf roofs, weathered wood, lichen-green stone, leaf-green banners
  druid: {
    [C.tile]: 0x5e7d32, [C.tileDark]: 0x445c24, [C.tileWarm]: 0x6f8f3a, [C.thatch]: 0x7c8f3e, [C.thatchDark]: 0x5b6b2c,
    [C.plaster]: 0xd8cfae, [C.plasterWarm]: 0xcdbf98, [C.timber]: 0x4a3420, [C.timberLight]: 0x6e5134,
    [C.stone]: 0x8e9a80, [C.stoneDark]: 0x6c775f, [C.stoneLight]: 0xb0b99f, [C.red]: 0x4f7a2e, [C.slate]: 0x4c5a3a,
    // the ground turns to a deep, lush glade
    [C.grass]: 0x5a8a36, [C.grassLight]: 0x6fa044, [C.grassDark]: 0x40692a, [C.grassRust]: 0x7f8a38,
    [C.dirt]: 0x7a6446, [C.dirtDark]: 0x5e4a33, [C.water]: 0x3a7f86,
    0x97a24e: 0x6aa044, 0x7f8d43: 0x4f7f32, 0x8b984a: 0x5d9038,
  },
  // black slate roofs, bone-grey walls, pitch-dark timber, ghost-green banners
  necromancer: {
    [C.tile]: 0x2e2a33, [C.tileDark]: 0x221f27, [C.tileWarm]: 0x3a3540, [C.thatch]: 0x3a3a36, [C.thatchDark]: 0x2a2a27,
    [C.plaster]: 0xa9a59a, [C.plasterWarm]: 0x9c978b, [C.timber]: 0x1e1a1c, [C.timberLight]: 0x3a3234,
    [C.stone]: 0x6e6c72, [C.stoneDark]: 0x4e4c52, [C.stoneLight]: 0x8e8c92, [C.red]: 0x2f7a4a, [C.slate]: 0x26232b, [C.door]: 0x141214,
    // the ground turns to a grey, dead meadow; the trees keep only a few withered leaves
    [C.grass]: 0x5d6250, [C.grassLight]: 0x6a6e5a, [C.grassDark]: 0x4a4e40, [C.grassRust]: 0x6e6450,
    [C.dirt]: 0x6a6258, [C.dirtDark]: 0x544d45, [C.water]: 0x2e4a3a,
    [C.leafOrange]: 0x6a5a40, [C.leafRed]: 0x5a3a30, [C.leafYellow]: 0x7a7050, [C.leafGold]: 0x6a5a3a, [C.leafGreen]: 0x4a5040,
    0x97a24e: 0x646a55, 0x7f8d43: 0x52584a, 0x8b984a: 0x5c6150,
  },
  // rusty patched roofs, grimy walls, soot-dark wood, goblin-green rags
  goblin: {
    [C.tile]: 0x7a4a2a, [C.tileDark]: 0x5c3520, [C.tileWarm]: 0x8f5a2e, [C.thatch]: 0x8a7a3a, [C.thatchDark]: 0x665a2a,
    [C.plaster]: 0xb9a67c, [C.plasterWarm]: 0xa89468, [C.timber]: 0x3e2a18, [C.timberLight]: 0x5e4428,
    [C.stone]: 0x7d7566, [C.stoneDark]: 0x5c554a, [C.stoneLight]: 0x9c9483, [C.red]: 0x6f9a2a, [C.slate]: 0x4a4036,
    // the ground turns to swamp
    [C.grass]: 0x5b6838, [C.grassLight]: 0x677640, [C.grassDark]: 0x46522e, [C.grassRust]: 0x6a5a34,
    [C.dirt]: 0x6e5a3c, [C.dirtDark]: 0x55462f, [C.water]: 0x24403c,
    0x97a24e: 0x6a7440, 0x7f8d43: 0x56603a, 0x8b984a: 0x626b3d,
  },
};

/** The colour a palette entry really takes: snow first in winter, then the village's theme. */
function look(c: number): number {
  if (season === 'winter' && WINTER[c] !== undefined) return WINTER[c];
  if (season === 'volcanic' && VOLCANIC[c] !== undefined) return VOLCANIC[c];
  return THEMES[theme][c] ?? c;
}

export function seasonal(c: number): number {
  return look(c);
}

export function mat(color: number, opts: { emissive?: number; opacity?: number; double?: boolean } = {}): THREE.MeshLambertMaterial {
  color = look(color);
  const key = `${color}|${opts.emissive ?? 0}|${opts.opacity ?? 1}|${opts.double ? 1 : 0}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      color,
      flatShading: true,
      emissive: opts.emissive ?? 0x000000,
      transparent: opts.opacity !== undefined && opts.opacity < 1,
      opacity: opts.opacity ?? 1,
      side: opts.double ? THREE.DoubleSide : THREE.FrontSide,
    });
    cache.set(key, m);
  }
  return m;
}

export function mesh(geo: THREE.BufferGeometry, color: number, opts?: Parameters<typeof mat>[1]): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Box standing on y=0 */
export function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const m = mesh(g, color);
  m.position.set(x, y, z);
  return m;
}

export function cyl(rTop: number, rBot: number, h: number, color: number, seg = 8, x = 0, y = 0, z = 0): THREE.Mesh {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  g.translate(0, h / 2, 0);
  const m = mesh(g, color);
  m.position.set(x, y, z);
  return m;
}

export function cone(r: number, h: number, color: number, seg = 8, x = 0, y = 0, z = 0): THREE.Mesh {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(0, h / 2, 0);
  const m = mesh(g, color);
  m.position.set(x, y, z);
  return m;
}

export function blob(r: number, color: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, detail = 0): THREE.Mesh {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const m = mesh(g, color);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

/** A prism extruded along Z from a 2D profile (in the XY plane). */
export function extrude(points: [number, number][], depth: number, color: number): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return mesh(g, color);
}

/**
 * A half-timbered house: plaster walls with a gable end, timber framing, a tiled
 * roof with overhang, a door and windows. Ridge runs along Z. Front faces +Z.
 */
export function house(o: {
  w: number; d: number; h: number; roofH: number;
  wall?: number; roof?: number; frame?: number | null; door?: boolean; windows?: number; stone?: boolean; chimney?: boolean;
}): THREE.Group {
  if (theme === 'sorcerer') return sorcererHouse(o);
  if (theme === 'druid') return druidHouse(o);
  if (theme === 'goblin') return goblinHouse(o);
  if (theme === 'necromancer') return necroHouse(o);
  return baseHouse(o);
}

function baseHouse(o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const wall = o.wall ?? (o.stone ? C.stone : C.plaster);
  const roof = o.roof ?? C.tile;
  const { w, d, h, roofH } = o;
  // walls + gable ends in one extrusion
  const body = extrude([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0, h + roofH], [-w / 2, h]], d, wall);
  g.add(body);
  // roof slabs, running from the ridge down past the eaves
  const half = w / 2 + 0.45;
  const theta = Math.atan2(roofH, w / 2);
  const len = half / Math.cos(theta) + 0.2;
  for (const side of [-1, 1]) {
    const slab = box(len, 0.28, d + 0.9, roof);
    slab.geometry.translate(0, -0.14, 0);
    slab.rotation.z = -side * theta;
    const mx = side * (half / 2);
    const my = h + roofH - (half / 2) * Math.tan(theta);
    slab.position.set(mx + side * Math.sin(theta) * 0.14, my + Math.cos(theta) * 0.14, 0);
    g.add(slab);
  }
  // ridge
  const ridge = box(0.35, 0.3, d + 0.95, C.tileDark === roof ? C.timber : darker(roof));
  ridge.position.set(0, h + roofH, 0);
  g.add(ridge);
  // framing
  const frame = o.frame === undefined ? (o.stone ? null : C.timber) : o.frame;
  if (frame !== null) {
    const t = 0.16;
    for (const z of [d / 2 + 0.03, -d / 2 - 0.03]) {
      for (const x of [-w / 2 + t / 2, w / 2 - t / 2]) g.add(box(t, h, t, frame, x, 0, z));
      g.add(box(w, t, t, frame, 0, h * 0.5, z));
      g.add(box(w, t, t, frame, 0, h - t, z));
      if (w > 4) {
        const post = box(t, h * 0.5, t, frame, 0, 0, z);
        g.add(post);
      }
    }
    for (const x of [w / 2 + 0.03, -w / 2 - 0.03]) {
      for (const z of [-d / 2 + t / 2, d / 2 - t / 2]) g.add(box(t, h, t, frame, x, 0, z));
      g.add(box(t, t, d, frame, x, h * 0.5, 0));
      // diagonal braces
      const br = box(t, Math.hypot(h * 0.5, d * 0.35), t, frame, x, 0, -d / 4);
      br.rotation.x = Math.atan2(d * 0.35, h * 0.5);
      br.position.set(x, 0, -d / 2 + 0.2);
      g.add(br);
    }
  }
  if (o.door !== false) {
    g.add(box(Math.min(1.3, w * 0.22), Math.min(2.1, h * 0.62), 0.2, C.door, 0, 0, d / 2 + 0.05));
  }
  const nw = o.windows ?? Math.max(0, Math.floor(w / 2.4));
  for (let i = 0; i < nw; i++) {
    const x = -w / 2 + ((i + 1) * w) / (nw + 1);
    if (Math.abs(x) < 1 && o.door !== false) continue;
    const win = box(0.7, 0.8, 0.14, C.window, x, h * 0.58, d / 2 + 0.06);
    win.userData.window = true;
    g.add(win);
  }
  if (o.chimney) g.add(box(0.8, roofH + 1.4, 0.8, C.stoneDark, w * 0.22, h, -d * 0.2));
  return g;
}

export function darker(c: number, f = 0.75): number {
  c = look(c);
  const col = new THREE.Color(c);
  col.multiplyScalar(f);
  return col.getHex();
}

/** Ring of crenellations (merlons) around a circle. */
export function merlonRing(r: number, y: number, count: number, color: number, size = 0.55): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const m = box(size, size * 1.1, size, color, Math.cos(a) * r, y, Math.sin(a) * r);
    m.rotation.y = -a;
    g.add(m);
  }
  return g;
}

type TowerOpts = { color?: number; roof?: number | null; merlons?: boolean; banner?: number };

export function roundTower(r: number, h: number, o: TowerOpts = {}): THREE.Group {
  if (theme === 'sorcerer') return sorcererTower(r, h, o);
  if (theme === 'druid') return druidTower(r, h, o);
  if (theme === 'goblin') return goblinTower(r, h, o);
  if (theme === 'necromancer') return necroTower(r, h, o);
  return baseTower(r, h, o);
}

function baseTower(r: number, h: number, o: TowerOpts): THREE.Group {
  const g = new THREE.Group();
  const color = o.color ?? C.stone;
  g.add(cyl(r, r * 1.08, h, color, 10));
  g.add(cyl(r * 1.15, r * 1.15, 0.5, darker(color, 0.9), 10, 0, h - 0.2));
  if (o.merlons !== false) g.add(merlonRing(r * 1.05, h + 0.3, 8, color, r * 0.42));
  if (o.roof) g.add(cone(r * 1.3, r * 2.2, o.roof, 10, 0, h + 0.3));
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + 0.5;
    const s = box(0.35, 0.8, 0.2, C.window, Math.cos(a) * r, h * 0.55, Math.sin(a) * r);
    s.rotation.y = -a + Math.PI / 2;
    g.add(s);
  }
  if (o.banner !== undefined) {
    const top = h + 0.3 + (o.roof ? r * 2.2 : 0.6);
    g.add(cyl(0.06, 0.06, 2.4, C.woodDark, 4, 0, top));
    const flag = box(1.4, 0.8, 0.05, o.banner, 0.7, top + 1.5, 0);
    flag.userData.flag = true;
    g.add(flag);
  }
  return g;
}

/**
 * Merge every static mesh in a group into one mesh per material. Parts flagged
 * with userData.dynamic stay separate so they can animate.
 */
export function bake(root: THREE.Object3D, tag?: Record<string, unknown>): THREE.Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const keep: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o.userData.dynamic) {
      keep.push(o);
      return;
    }
    if (!(o instanceof THREE.Mesh)) return;
    if (hasDynamicAncestor(o, root)) return;
    let geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    const m = o.material as THREE.Material;
    const list = buckets.get(m) ?? [];
    list.push(geo);
    buckets.set(m, list);
  });
  const out = new THREE.Group();
  for (const [m, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mm = new THREE.Mesh(merged, m);
    mm.castShadow = true;
    mm.receiveShadow = true;
    if (tag) Object.assign(mm.userData, tag);
    out.add(mm);
  }
  for (const k of keep) {
    const clone = k;
    const world = new THREE.Matrix4().copy(k.matrixWorld);
    clone.removeFromParent();
    world.decompose(clone.position, clone.quaternion, clone.scale);
    if (tag) clone.traverse((c) => Object.assign(c.userData, tag));
    out.add(clone);
  }
  disposeTree(root);
  return out;
}

function hasDynamicAncestor(o: THREE.Object3D, root: THREE.Object3D): boolean {
  let p = o.parent;
  while (p && p !== root) {
    if (p.userData.dynamic) return true;
    p = p.parent;
  }
  return false;
}

/** Dispose geometries (materials are shared and cached, so they stay). */
export function disposeTree(o: THREE.Object3D): void {
  o.traverse((c) => {
    if (c instanceof THREE.Mesh && !c.userData.sharedGeometry) c.geometry.dispose();
  });
}

/** Seeded random for stable scenery. */
export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- hero themes: the same buildings in each hero's style ----------
// Every themed piece keeps the footprint of the classic one, so the village
// layout (and its tests) hold for every theme.

type HouseOpts = Parameters<typeof house>[0];

function windowAt(x: number, y: number, z: number, round = false): THREE.Mesh {
  const w = round ? cyl(0.36, 0.36, 0.14, C.window, 8) : box(0.7, 0.8, 0.14, C.window);
  if (round) w.rotation.x = Math.PI / 2;
  w.position.set(x, y, z);
  w.userData.window = true;
  return w;
}

/** Sorcerer: tall walls, a steep witch-hat roof with curled ends, a corner turret and a crystal on the ridge. */
function sorcererHouse(o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const roofH = o.roofH * 1.9;
  const wall = o.wall ?? (o.stone ? C.stone : C.plaster);
  g.add(extrude([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0, h + roofH], [-w / 2, h]], d, wall));
  const half = w / 2 + 0.35;
  const theta = Math.atan2(roofH, w / 2);
  const len = half / Math.cos(theta) + 0.2;
  for (const side of [-1, 1]) {
    const slab = box(len, 0.24, d + 0.7, C.tile);
    slab.geometry.translate(0, -0.12, 0);
    slab.rotation.z = -side * theta;
    slab.position.set(side * (half / 2) + side * Math.sin(theta) * 0.12, h + roofH - (half / 2) * Math.tan(theta) + Math.cos(theta) * 0.12, 0);
    g.add(slab);
  }
  // curled ridge ends and a gold trim band
  for (const z of [d / 2 + 0.35, -d / 2 - 0.35]) {
    const c = cone(0.22, 0.9, C.gold, 6, 0, h + roofH - 0.1, z);
    c.rotation.x = z > 0 ? 0.5 : -0.5;
    g.add(c);
  }
  g.add(box(w + 0.1, 0.18, d + 0.1, C.gold, 0, h - 0.18, 0));
  // a small turret on the front corner
  if (w > 3.5) {
    const tx = w / 2 - 0.55, tz = d / 2 - 0.55;
    g.add(cyl(0.55, 0.6, h + roofH * 0.55, wall, 8, tx, 0, tz));
    g.add(cone(0.75, 1.8, C.tileDark, 8, tx, h + roofH * 0.55, tz));
  }
  // a crystal floating over the ridge
  const cr = mesh(new THREE.OctahedronGeometry(0.28, 0), 0xb58cff, { emissive: 0x5a2fb0 });
  cr.scale.set(1, 1.8, 1);
  cr.position.set(0, h + roofH + 0.9, 0);
  g.add(cr);
  if (o.door !== false) g.add(box(Math.min(1.2, w * 0.22), Math.min(2.2, h * 0.66), 0.2, C.door, 0, 0, d / 2 + 0.05));
  const nw = o.windows ?? Math.max(0, Math.floor(w / 2.4));
  for (let i = 0; i < nw; i++) {
    const x = -w / 2 + ((i + 1) * w) / (nw + 1);
    if (Math.abs(x) < 1 && o.door !== false) continue;
    g.add(windowAt(x, h * 0.6, d / 2 + 0.06, true));
  }
  return g;
}

/** Druid: a rounded cottage of daub and timber under a mossy turf dome, roots at its feet. */
function druidHouse(o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const body = cyl(0.5, 0.52, h, o.stone ? C.stone : C.plaster, 12);
  body.scale.set(w, 1, d);
  g.add(body);
  // timber ribs around the wall
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(0.18, h, 0.18, C.timber, Math.cos(a) * w * 0.5, 0, Math.sin(a) * d * 0.5));
  }
  // the turf dome, with a skirt of moss hanging over the eaves
  const dome = blob(0.5, C.tile, 0, h, 0, w + 0.7, o.roofH * 2.2, d + 0.7, 1);
  g.add(dome);
  const skirt = cyl(0.5, 0.5, 0.35, C.tileDark, 12, 0, h - 0.1, 0);
  skirt.scale.set(w + 0.8, 1, d + 0.8);
  g.add(skirt);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    g.add(blob(0.3, 0x7ea64a, Math.cos(a) * w * 0.3, h + o.roofH * 0.9, Math.sin(a) * d * 0.3));
  }
  // roots at the base
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2;
    if (Math.sin(a) > 0.8) continue;
    const root = box(0.35, 0.45, 0.9, C.timber, Math.cos(a) * w * 0.47, 0, Math.sin(a) * d * 0.47);
    root.rotation.y = -a + Math.PI / 2;
    g.add(root);
  }
  if (o.door !== false) {
    g.add(box(Math.min(1.2, w * 0.22), Math.min(1.9, h * 0.66), 0.25, C.door, 0, 0, d / 2 - 0.02));
    g.add(blob(0.62, C.timber, 0, Math.min(1.9, h * 0.66), d / 2 - 0.02, 1, 0.45, 0.3));
  }
  const nw = Math.min(2, o.windows ?? 1);
  for (let i = 0; i < nw; i++) {
    const a = Math.PI / 2 + (i === 0 ? 0.75 : -0.75);
    g.add(windowAt(Math.cos(a) * w * 0.49, h * 0.6, Math.sin(a) * d * 0.49, true));
  }
  if (o.chimney) g.add(cyl(0.35, 0.45, o.roofH + 1.2, C.stoneDark, 6, w * 0.2, h, -d * 0.15));
  return g;
}

/** Goblin: a crooked plank shack under lopsided rusted plates, bones on the ridge. */
function goblinHouse(o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const body = new THREE.Group();
  body.add(box(w, h, d, o.stone ? C.stone : C.timberLight));
  for (let i = 0; i < Math.max(3, Math.floor(w)); i++) {
    body.add(box(0.14, h + 0.2, 0.1, C.timber, -w / 2 + 0.3 + (i * (w - 0.6)) / Math.max(2, Math.floor(w) - 1), 0, d / 2 + 0.03));
  }
  body.rotation.z = 0.04;
  g.add(body);
  // two mismatched roof slabs, one higher than the other
  const roofH = o.roofH * 0.8;
  for (const side of [-1, 1]) {
    const slab = box(w / 2 + 0.7, 0.22, d + 0.6, side < 0 ? C.tile : C.tileDark);
    slab.position.set(side * w * 0.24, h + roofH * (side < 0 ? 0.55 : 0.4), side * 0.08);
    slab.rotation.z = -side * Math.atan2(roofH, w / 2) * (side < 0 ? 1 : 0.8);
    g.add(slab);
  }
  g.add(extrude([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0.3, h + roofH * 0.9], [-w / 2, h]], d - 0.1, C.timberLight));
  // a patched hide flap and stakes along the ridge
  g.add(box(w * 0.35, h * 0.5, 0.06, C.thatch, -w * 0.2, h * 0.35, d / 2 + 0.1));
  for (let i = 0; i < 3; i++) {
    const sp = cone(0.1, 0.8, C.timber, 4, -w * 0.3 + i * w * 0.3, h + roofH * 0.9, 0);
    sp.rotation.z = (i - 1) * 0.3;
    g.add(sp);
  }
  g.add(blob(0.24, 0xe8dfc8, 0.3, h + roofH * 0.95 + 0.2, d / 2 - 0.3));
  if (o.door !== false) g.add(box(Math.min(1.2, w * 0.22), Math.min(1.9, h * 0.62), 0.2, 0x241a12, w * 0.1, 0, d / 2 + 0.08));
  const nw = Math.min(2, o.windows ?? 1);
  for (let i = 0; i < nw; i++) g.add(windowAt(-w / 2 + ((i + 1) * w) / (nw + 1) + 0.6, h * 0.55, d / 2 + 0.09));
  if (o.chimney) g.add(cyl(0.3, 0.35, o.roofH + 1.2, C.iron, 5, w * 0.25, h, -d * 0.2));
  return g;
}

const GHOST_GREEN = 0x5cff9a, GHOST_EMIT = 0x1f9a4a;

/** Necromancer house: the old stone house under a steep black roof, iron spikes on the ridge, windows lit ghost-green. */
function necroHouse(o: HouseOpts): THREE.Group {
  const g = baseHouse({ ...o, roofH: o.roofH * 1.45, frame: null, chimney: false });
  g.traverse((c) => {
    if (c.userData.window && c instanceof THREE.Mesh) c.material = mat(GHOST_GREEN, { emissive: GHOST_EMIT });
  });
  const top = o.h + o.roofH * 1.45;
  const n = Math.max(2, Math.round(o.d / 1.6));
  for (let i = 0; i < n; i++) g.add(cone(0.09, 0.6, C.iron, 4, 0, top + 0.1, -o.d / 2 + ((i + 0.5) * o.d) / n));
  return g;
}

/** Necromancer tower: dark stone under a needle-thin black spire, a green light burning in the slits. */
function necroTower(r: number, h: number, o: TowerOpts): THREE.Group {
  const g = baseTower(r, h, { ...o, roof: null, merlons: o.merlons });
  g.add(cone(r * 1.1, r * 3.4, C.slate, 8, 0, h + 0.3));
  g.add(cone(0.08, 1.2, C.iron, 4, 0, h + 0.3 + r * 3.4));
  const glow = mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.18, 10), GHOST_GREEN, { emissive: GHOST_EMIT });
  glow.position.y = h * 0.72;
  g.add(glow);
  return g;
}

/** Sorcerer tower: slender, tall and needle-roofed, with a crystal above. */
function sorcererTower(r: number, h: number, o: TowerOpts): THREE.Group {
  const g = new THREE.Group();
  const color = o.color ?? C.stone;
  const hh = h * 1.15;
  g.add(cyl(r * 0.82, r * 0.95, hh, color, 10));
  g.add(cyl(r * 0.95, r * 0.95, 0.35, C.gold, 10, 0, hh - 0.2));
  g.add(cone(r * 1.15, r * 3.4, C.tile, 10, 0, hh + 0.1));
  const cr = mesh(new THREE.OctahedronGeometry(r * 0.28, 0), 0xb58cff, { emissive: 0x5a2fb0 });
  cr.scale.set(1, 1.8, 1);
  cr.position.set(0, hh + r * 3.4 + r * 0.7, 0);
  g.add(cr);
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + 0.5;
    const s = windowAt(Math.cos(a) * r * 0.85, hh * 0.55, Math.sin(a) * r * 0.85, true);
    s.rotation.set(Math.PI / 2, 0, -a + Math.PI / 2);
    g.add(s);
  }
  if (o.banner !== undefined) {
    const flag = box(1.2, 0.7, 0.05, o.banner, r + 0.6, hh * 0.8, 0);
    flag.userData.flag = true;
    g.add(flag);
  }
  return g;
}

/** Druid tower: a living trunk with a lookout platform in its leafy crown. */
function druidTower(r: number, h: number, o: TowerOpts): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(r * 0.8, r * 1.1, h, C.timber, 9));
  g.add(cyl(r * 1.1, r * 1.1, 0.3, C.timberLight, 10, 0, h - 0.2));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    g.add(blob(r * 0.7, i % 2 ? 0x4f7a2e : 0x6f9a3a, Math.cos(a) * r * 0.55, h + r * 0.7, Math.sin(a) * r * 0.55, 1, 0.8, 1));
  }
  g.add(blob(r * 0.8, 0x4f7a2e, 0, h + r * 1.3, 0, 1, 0.8, 1));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(box(0.1, h * 0.6, 0.1, 0x445c24, Math.cos(a) * r * 0.85, h * 0.35, Math.sin(a) * r * 0.85));
  }
  const s = windowAt(0, h * 0.55, r * 0.95, true);
  g.add(s);
  if (o.banner !== undefined) {
    const flag = box(1.2, 0.7, 0.05, o.banner, r + 0.5, h * 0.75, 0);
    flag.userData.flag = true;
    g.add(flag);
  }
  return g;
}

/** Goblin tower: crates and planks stacked ever higher, capped with rust and spikes. */
function goblinTower(r: number, h: number, o: TowerOpts): THREE.Group {
  const g = new THREE.Group();
  const levels = Math.max(2, Math.round(h / 2));
  const step = h / levels;
  for (let i = 0; i < levels; i++) {
    const s = r * 1.9 * (1 - i * 0.08);
    const lvl = box(s, step, s, i % 2 ? C.timber : C.timberLight, Math.sin(i * 2.3) * 0.15, i * step, Math.cos(i * 1.7) * 0.15);
    lvl.rotation.y = Math.sin(i * 1.3) * 0.25;
    g.add(lvl);
  }
  g.add(cone(r * 1.25, r * 1.4, C.tile, 4, 0, h, 0).rotateY(0.5));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const sp = cone(0.1, 0.9, C.iron, 4, Math.cos(a) * r * 0.9, h - 0.4, Math.sin(a) * r * 0.9);
    sp.rotation.z = -Math.cos(a) * 1.1;
    sp.rotation.x = Math.sin(a) * 1.1;
    g.add(sp);
  }
  g.add(windowAt(0, h * 0.5, r * 0.97));
  if (o.banner !== undefined) {
    const flag = box(1.1, 0.7, 0.05, o.banner, r + 0.5, h * 0.8, 0);
    flag.userData.flag = true;
    g.add(flag);
  }
  return g;
}
