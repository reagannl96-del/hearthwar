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
export type Theme = 'classic' | 'paladin' | 'sorcerer' | 'druid' | 'goblin' | 'necromancer';
let theme: Theme = 'classic';
export function setTheme(t: Theme) {
  theme = t;
}
export function getTheme(): Theme {
  return theme;
}

const THEMES: Record<Theme, Record<number, number>> = {
  classic: {},
  // the Radiant Order: white limestone and ivory plaster, royal-blue slate trimmed in gold,
  // blue-and-gold banners, pale sandstone paving and a bright, well-kept green
  paladin: {
    [C.tile]: 0x2c4f9e, [C.tileDark]: 0x213c7a, [C.tileWarm]: 0x3661b4, [C.thatch]: 0x33579f, [C.thatchDark]: 0x264378,
    [C.plaster]: 0xf3eee2, [C.plasterWarm]: 0xebe3d0, [C.timber]: 0x5b3e28, [C.timberLight]: 0x8a6a48,
    [C.stone]: 0xe4ddcb, [C.stoneDark]: 0xbdb39c, [C.stoneLight]: 0xf6f1e4, [C.red]: 0x2c56b0, [C.slate]: 0x243f80, [C.door]: 0x5a3a22,
    [C.grass]: 0x7aa447, [C.grassLight]: 0x8cb655, [C.grassDark]: 0x628b39, [C.grassRust]: 0x9aa84a,
    [C.dirt]: 0xdccba2, [C.dirtDark]: 0xc4b186, [C.water]: 0x4a9ad0,
    0x97a24e: 0x86b04e, 0x7f8d43: 0x6c9640, 0x8b984a: 0x7aa447,
  },
  // deep violet slate roofs, moonstone walls, cool starlit stone, violet banners with silver stars
  sorcerer: {
    [C.tile]: 0x432a8c, [C.tileDark]: 0x2e1d63, [C.tileWarm]: 0x5634a6, [C.thatch]: 0x3d4f9a, [C.thatchDark]: 0x2d3a73,
    [C.plaster]: 0xe4e0f4, [C.plasterWarm]: 0xd6cfec, [C.timber]: 0x2c2340, [C.timberLight]: 0x4a3d66,
    [C.stone]: 0xa6a6c6, [C.stoneDark]: 0x77779c, [C.stoneLight]: 0xd2d2e8, [C.red]: 0x5b36b0, [C.slate]: 0x3a3163, [C.door]: 0x2a1d40,
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
  if (theme === 'paladin') return paladinHouse(o);
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
  if (theme === 'paladin') return paladinTower(r, h, o);
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

// ---------- the Arcane (sorcerer) ----------

/** Arcane light: a cool cyan and a deep violet, each with its glow. */
export const ARC = 0x8fe8ff, ARC_EMIT = 0x2a8ab8, VIO = 0xc6a2ff, VIO_EMIT = 0x6a38d0, STAR = 0xf4ecc8, STAR_EMIT = 0x8a7a40;

/** A band of glowing runes set into a round tower's stone (radius r, at height y). */
export function runeRing(r: number, y: number, color = ARC, emissive = ARC_EMIT): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r, 0.1, 18, 1, true), color, { emissive, double: true }).translateY(y));
  // the glyphs: little lit marks above and below the band
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const glyph = mesh(new THREE.BoxGeometry(0.1, i % 2 ? 0.34 : 0.22, 0.05), color, { emissive });
    glyph.position.set(Math.cos(a) * (r + 0.01), y + (i % 3 === 0 ? 0.24 : -0.2), Math.sin(a) * (r + 0.01));
    glyph.rotation.y = -a + Math.PI / 2;
    g.add(glyph);
  }
  return g;
}

/** A witch's hat of a roof: a brim, a steep cone and a tip that bends over, with a band and a star. */
export function witchHat(r: number, h: number, color: number, bend = 0.5): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(r * 1.22, r * 1.22, 0.14, color, 14));
  const low = h * 0.58;
  g.add(cyl(r * 0.46, r, low, color, 14, 0, 0.12));
  g.add(cyl(r * 0.86, r * 0.93, 0.22, C.gold, 14, 0, 0.3));
  const tip = cone(r * 0.46, h * 0.5, color, 12);
  tip.position.y = low + 0.1;
  tip.rotation.z = -bend;
  g.add(tip);
  const star = mesh(new THREE.OctahedronGeometry(Math.max(0.18, r * 0.16), 0), STAR, { emissive: STAR_EMIT });
  star.position.set(Math.sin(bend) * h * 0.5 + 0.05, low + 0.1 + Math.cos(bend) * h * 0.5, 0);
  g.add(star);
  return g;
}

/** A crystal that floats, turns and bobs, shards circling it. */
export function floatingCrystal(s = 1, color = VIO, emissive = VIO_EMIT): THREE.Group {
  const g = new THREE.Group();
  const c = mesh(new THREE.OctahedronGeometry(0.5 * s, 0), color, { emissive });
  c.scale.set(1, 1.9, 1);
  g.add(c);
  g.add(mesh(new THREE.IcosahedronGeometry(0.85 * s, 1), color, { emissive, opacity: 0.18 }));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const sh = mesh(new THREE.OctahedronGeometry(0.16 * s, 0), ARC, { emissive: ARC_EMIT });
    sh.scale.set(1, 1.6, 1);
    sh.position.set(Math.cos(a) * 1.05 * s, (i - 1) * 0.3 * s, Math.sin(a) * 1.05 * s);
    g.add(sh);
  }
  g.userData.dynamic = true;
  g.userData.orbit = 0.8;
  g.userData.bob = 0.22 * s;
  return g;
}

/** A crystal lamp on a dark iron post, a violet pennant with a silver star beneath it. */
export function arcaneLamp(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.24, 0.32, 0.4, C.stoneDark, 6));
  g.add(cyl(0.07, 0.09, h, 0x2c2340, 6, 0, 0.4));
  g.add(mesh(new THREE.TorusGeometry(0.3, 0.04, 4, 14).rotateX(Math.PI / 2), C.gold).translateY(h + 0.4));
  const pennant = box(0.04, 1.0, 0.55, C.red, 0, h - 0.75, 0.3);
  g.add(pennant);
  const star = mesh(new THREE.OctahedronGeometry(0.12, 0), STAR, { emissive: STAR_EMIT });
  star.position.set(0.04, h - 0.3, 0.3);
  g.add(star);
  const c = floatingCrystal(0.34, ARC, ARC_EMIT);
  c.position.y = h + 0.95;
  g.add(c);
  return g;
}

/** A rock adrift in the air: a grassy top, crystals growing on it, a thread of water falling from its lip. */
export function floatingIsle(s: number, r: () => number, tree?: THREE.Object3D): THREE.Group {
  const g = new THREE.Group();
  const rock = cone(1.7 * s, 3.2 * s, 0x6d6a82, 7);
  rock.rotation.x = Math.PI;
  g.add(rock);
  g.add(cone(1.0 * s, 1.6 * s, 0x5a5770, 6, 0.5 * s, -2.6 * s, 0.3 * s).rotateX(Math.PI));
  g.add(cyl(1.75 * s, 1.7 * s, 0.4 * s, C.grass, 7));
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = r() * 1.1 * s;
    const c = mesh(new THREE.OctahedronGeometry(0.25 * s, 0), i % 2 ? VIO : ARC, { emissive: i % 2 ? VIO_EMIT : ARC_EMIT });
    c.scale.set(1, 2 + r(), 1);
    c.position.set(Math.cos(a) * d, 0.4 * s + 0.5 * s, Math.sin(a) * d);
    c.rotation.z = (r() - 0.5) * 0.6;
    g.add(c);
  }
  if (tree) { tree.position.set(-0.5 * s, 0.35 * s, -0.3 * s); g.add(tree); }
  const fall = mesh(new THREE.BoxGeometry(0.35 * s, 7 * s, 0.08).translate(0, -3.5 * s, 0), 0x9fd4ff, { emissive: 0x2a5a9a, opacity: 0.45 });
  fall.position.set(1.55 * s, 0.1, 0);
  g.add(fall);
  g.userData.dynamic = true;
  g.userData.bob = 0.45 * s;
  return g;
}

/** A ring of glowing runes that turns slowly about a spire, tilted, so it seems to wheel. */
export function orbitRing(r: number, tilt: number, speed: number, color = ARC, emissive = ARC_EMIT): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Group();
  ring.add(mesh(new THREE.TorusGeometry(r, 0.07, 4, 48), color, { emissive }));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const gl = mesh(new THREE.BoxGeometry(0.2, 0.34, 0.06), color, { emissive });
    gl.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    gl.rotation.z = a;
    ring.add(gl);
  }
  ring.rotation.x = Math.PI / 2 + tilt;
  g.add(ring);
  g.userData.dynamic = true;
  g.userData.orbit = speed;
  return g;
}

/** Sorcerer: moonstone walls on a slate plinth, a glowing rune band, a steep violet roof with curled ends,
 *  a corner turret in a crooked hat, round lit windows, a starlit door and a crystal floating over the ridge. */
function sorcererHouse(o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const roofH = o.roofH * 1.9;
  const wall = o.wall ?? (o.stone ? C.stone : C.plaster);
  g.add(extrude([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0, h + roofH], [-w / 2, h]], d, wall));
  const plinth = Math.min(1.0, h * 0.32);
  g.add(box(w + 0.16, plinth, d + 0.16, C.stoneDark));
  g.add(mesh(new THREE.BoxGeometry(w + 0.2, 0.09, d + 0.2).translate(0, plinth + 0.05, 0), ARC, { emissive: ARC_EMIT }));
  // an oculus in the gable, glowing violet
  const oc = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 12).rotateX(Math.PI / 2), VIO, { emissive: VIO_EMIT });
  oc.position.set(0, h + roofH * 0.42, d / 2 + 0.04);
  g.add(oc);
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
  // a small turret on the front corner, in a crooked hat, a rune band round its middle
  if (w > 3.5) {
    const tx = w / 2 - 0.55, tz = d / 2 - 0.55;
    const th = h + roofH * 0.55;
    g.add(cyl(0.55, 0.62, th, C.stone, 8, tx, 0, tz));
    const band = runeRing(0.57, th * 0.6);
    band.position.set(tx, 0, tz);
    g.add(band);
    const hat = witchHat(0.62, 2.1, C.tileDark, 0.55);
    hat.position.set(tx, th, tz);
    g.add(hat);
  }
  // a crystal floating over the ridge
  const cr = floatingCrystal(0.5);
  cr.position.set(0, h + roofH + 1.0, 0);
  g.add(cr);
  if (o.door !== false) {
    // an arched door under a silver star, a crystal lantern beside it
    const dw = Math.min(1.2, w * 0.22), dh = Math.min(2.2, h * 0.66);
    g.add(box(dw, dh - dw / 2, 0.2, C.door, 0, 0, d / 2 + 0.05));
    g.add(mesh(new THREE.CylinderGeometry(dw / 2, dw / 2, 0.2, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), C.door).translateY(dh - dw / 2).translateZ(d / 2 + 0.05));
    const st = mesh(new THREE.OctahedronGeometry(0.15, 0), STAR, { emissive: STAR_EMIT });
    st.position.set(0, dh + 0.3, d / 2 + 0.1);
    g.add(st);
    const lamp = mesh(new THREE.OctahedronGeometry(0.16, 0), ARC, { emissive: ARC_EMIT });
    lamp.scale.set(1, 1.5, 1);
    lamp.position.set(dw / 2 + 0.35, dh * 0.8, d / 2 + 0.22);
    g.add(lamp, box(0.06, 0.06, 0.3, C.timber, dw / 2 + 0.35, dh * 0.8 + 0.28, d / 2 + 0.1));
  }
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

// ---------- the Radiant Order (paladin) ----------

/** Stained glass: jewel colours that glow a little by day and a lot at night. */
export const GLASS = [
  { c: 0x6f9cff, e: 0x2a4ab0 },
  { c: 0xffd36a, e: 0x9a6a10 },
  { c: 0xff7a6a, e: 0x9a2a1a },
  { c: 0x9fe0ff, e: 0x2a7aa0 },
];

/** A tall arched window of stained glass in a white stone frame, facing +Z. */
export function lancet(x: number, y: number, z: number, w = 0.55, h = 1.1, k = 0): THREE.Group {
  const g = new THREE.Group();
  const gl = GLASS[k % GLASS.length];
  g.add(box(w + 0.2, h + 0.2, 0.12, C.stoneLight, 0, -0.1, -0.02));
  const pane = mesh(new THREE.BoxGeometry(w, h, 0.1).translate(0, h / 2, 0), gl.c, { emissive: gl.e });
  g.add(pane);
  const arch = mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.1, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), gl.c, { emissive: gl.e });
  arch.position.set(0, h, 0);
  g.add(arch);
  g.add(box(0.05, h, 0.12, C.gold, 0, 0, 0.02));
  g.position.set(x, y, z);
  return g;
}

/** A blue kite shield with a golden sun: the Order's arms. */
export function heraldry(s = 1): THREE.Group {
  const g = new THREE.Group();
  const shield = extrude([[-0.5, 0.35], [0.5, 0.35], [0.5, -0.1], [0, -0.75], [-0.5, -0.1]], 0.08, 0x2c56b0);
  g.add(shield);
  const rim = extrude([[-0.56, 0.41], [0.56, 0.41], [0.56, -0.12], [0, -0.83], [-0.56, -0.12]], 0.05, C.gold);
  rim.position.z = -0.03;
  g.add(rim);
  const sun = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12).rotateX(Math.PI / 2), 0xffd35a, { emissive: 0x8a5a10 });
  sun.position.set(0, -0.08, 0.06);
  g.add(sun);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const ray = box(0.05, 0.12, 0.04, 0xffd35a, Math.cos(a) * 0.28, -0.08 + Math.sin(a) * 0.28 - 0.06, 0.06);
    ray.rotation.z = a - Math.PI / 2;
    g.add(ray);
  }
  g.scale.setScalar(s);
  return g;
}

/**
 * Paladin: ivory walls on a limestone plinth, a steep royal-blue roof with a gilded
 * ridge and finials, tall stained-glass windows, a heraldic shield on the gable and
 * flower boxes under the windows.
 */
function paladinHouse(o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const roofH = o.roofH * 1.35;
  const wall = o.wall ?? (o.stone ? C.stoneLight : C.plaster);
  g.add(extrude([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0, h + roofH], [-w / 2, h]], d, wall));
  // a limestone plinth and corner quoins
  g.add(box(w + 0.24, 0.6, d + 0.24, C.stoneDark, 0, 0, 0));
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) g.add(box(0.34, h, 0.34, C.stone, x, 0, z));
  // the roof slabs
  const half = w / 2 + 0.4;
  const theta = Math.atan2(roofH, w / 2);
  const len = half / Math.cos(theta) + 0.2;
  for (const side of [-1, 1]) {
    const slab = box(len, 0.26, d + 0.8, o.roof ?? C.tile);
    slab.geometry.translate(0, -0.13, 0);
    slab.rotation.z = -side * theta;
    slab.position.set(side * (half / 2) + side * Math.sin(theta) * 0.13, h + roofH - (half / 2) * Math.tan(theta) + Math.cos(theta) * 0.13, 0);
    g.add(slab);
  }
  // a gilded ridge, and a gold finial at each gable
  g.add(box(0.26, 0.22, d + 0.9, C.gold, 0, h + roofH - 0.02, 0));
  for (const z of [d / 2 + 0.35, -d / 2 - 0.35]) {
    g.add(blob(0.16, C.gold, 0, h + roofH + 0.2, z));
    g.add(cone(0.07, 0.55, C.gold, 5, 0, h + roofH + 0.3, z));
  }
  // a gold string course under the eaves
  g.add(box(w + 0.14, 0.14, d + 0.14, C.gold, 0, h - 0.14, 0));
  // the Order's arms on the front gable
  if (w > 3.2) {
    const arms = heraldry(Math.min(1.1, w * 0.16));
    arms.position.set(0, h + roofH * 0.42, d / 2 + 0.06);
    g.add(arms);
  }
  if (o.door !== false) {
    const dw = Math.min(1.25, w * 0.22), dh = Math.min(2.1, h * 0.64);
    g.add(box(dw + 0.3, dh + 0.25, 0.16, C.stoneLight, 0, 0, d / 2 + 0.03));
    g.add(box(dw, dh, 0.2, C.door, 0, 0, d / 2 + 0.06));
    const top = mesh(new THREE.CylinderGeometry(dw / 2, dw / 2, 0.2, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), C.door);
    top.position.set(0, dh, d / 2 + 0.06);
    g.add(top);
    for (const y of [dh * 0.3, dh * 0.7]) g.add(box(dw * 0.8, 0.07, 0.05, C.gold, 0, y, d / 2 + 0.17));
  }
  const nw = o.windows ?? Math.max(0, Math.floor(w / 2.4));
  for (let i = 0; i < nw; i++) {
    const x = -w / 2 + ((i + 1) * w) / (nw + 1);
    if (Math.abs(x) < 1 && o.door !== false) continue;
    const win = lancet(x, h * 0.3, d / 2 + 0.06, 0.5, Math.min(1.3, h * 0.42), i);
    g.add(win);
    // a flower box under it
    g.add(box(0.8, 0.22, 0.3, C.timber, x, h * 0.3 - 0.35, d / 2 + 0.2));
    for (const fx of [-0.25, 0, 0.25]) g.add(blob(0.13, i % 2 ? 0xe05a7a : 0xf2c04a, x + fx, h * 0.3 - 0.08, d / 2 + 0.24));
  }
  if (o.chimney) g.add(box(0.7, roofH + 1.2, 0.7, C.stone, w * 0.22, h, -d * 0.2));
  return g;
}

/** Paladin tower: white stone with a gold band, a tall royal-blue spire and a golden sun on its tip. */
function paladinTower(r: number, h: number, o: TowerOpts): THREE.Group {
  const g = new THREE.Group();
  const color = o.color ?? C.stoneLight;
  g.add(cyl(r, r * 1.1, h, color, 12));
  g.add(cyl(r * 1.18, r * 1.18, 0.55, C.stone, 12, 0, h - 0.3));
  g.add(cyl(r * 1.2, r * 1.2, 0.16, C.gold, 12, 0, h + 0.25));
  // a band of stained glass slits
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const s = lancet(0, 0, 0, 0.32, 0.8, i);
    s.position.set(Math.cos(a) * r * 1.02, h * 0.55, Math.sin(a) * r * 1.02);
    s.rotation.y = -a + Math.PI / 2;
    g.add(s);
  }
  if (o.roof === null) {
    // crenellated, each merlon capped in gold
    g.add(merlonRing(r * 1.1, h + 0.3, 8, color, r * 0.42));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(box(r * 0.44, 0.08, r * 0.44, C.gold, Math.cos(a) * r * 1.1, h + 0.3 + r * 0.46, Math.sin(a) * r * 1.1));
    }
  } else {
    const ch = r * 2.2;
    g.add(cone(r * 1.22, ch, o.roof ?? C.tile, 12, 0, h + 0.4));
    g.add(cyl(0.07, 0.07, 1.1, C.gold, 5, 0, h + 0.4 + ch - 0.2));
    g.add(blob(0.18, C.gold, 0, h + 0.4 + ch + 0.5, 0));
    const sun = mesh(new THREE.TorusGeometry(0.34, 0.07, 5, 14), 0xffd35a, { emissive: 0x8a5a10 });
    sun.position.set(0, h + 0.4 + ch + 0.95, 0);
    g.add(sun);
  }
  if (o.banner !== undefined) {
    // a long blue banner hung down the tower's face, a gold sun on it
    const flag = new THREE.Group();
    flag.add(box(r * 0.95, h * 0.42, 0.05, o.banner, 0, 0, 0));
    flag.add(cone(r * 0.48, 0.5, o.banner, 3, 0, -0.5, 0).rotateZ(Math.PI));
    const disc = mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.22, 0.04, 10).rotateX(Math.PI / 2), 0xffd35a, { emissive: 0x6a4a10 });
    disc.position.set(0, h * 0.26, 0.04);
    flag.add(disc);
    flag.add(box(r * 1.05, 0.08, 0.08, C.gold, 0, h * 0.42, 0));
    flag.position.set(0, h * 0.4, r * 1.06);
    g.add(flag);
  }
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

/** Sorcerer tower: slender and tapering on a slate plinth, banded with glowing runes, in a crooked
 *  witch's hat (or crenellated, crystals on the merlons), a crystal floating over it. */
function sorcererTower(r: number, h: number, o: TowerOpts): THREE.Group {
  const g = new THREE.Group();
  const color = o.color ?? C.stone;
  const hh = h * 1.12;
  g.add(cyl(r * 1.08, r * 1.12, 0.6, C.stoneDark, 10));
  g.add(cyl(r * 0.8, r * 0.98, hh, color, 10));
  g.add(runeRing(r * 0.95, hh * 0.3));
  g.add(runeRing(r * 0.86, hh * 0.72, VIO, VIO_EMIT));
  g.add(cyl(r * 0.98, r * 0.82, 0.45, C.stoneLight, 10, 0, hh - 0.4));
  let top = hh;
  if (o.roof === null) {
    g.add(merlonRing(r * 0.92, hh, 8, C.stoneLight, r * 0.36));
    for (let i = 0; i < 8; i += 2) {
      const a = (i / 8) * Math.PI * 2;
      const c = mesh(new THREE.OctahedronGeometry(r * 0.13, 0), VIO, { emissive: VIO_EMIT });
      c.scale.set(1, 1.8, 1);
      c.position.set(Math.cos(a) * r * 0.92, hh + r * 0.52, Math.sin(a) * r * 0.92);
      g.add(c);
    }
    top = hh + r * 0.6;
  } else {
    const hat = witchHat(r * 0.98, r * 2.6, o.roof ?? C.tile, 0.5);
    hat.position.y = hh;
    g.add(hat);
    top = hh + r * 2.6;
  }
  const cr = floatingCrystal(r * 0.42);
  cr.position.set(0, top + r * 0.9, 0);
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
