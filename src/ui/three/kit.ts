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

export type Season = 'fall' | 'winter';
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

export function seasonal(c: number): number {
  return season === 'winter' ? WINTER[c] ?? c : c;
}

export function mat(color: number, opts: { emissive?: number; opacity?: number; double?: boolean } = {}): THREE.MeshLambertMaterial {
  if (season === 'winter') color = WINTER[color] ?? color;
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
  if (season === 'winter' && WINTER[c] !== undefined) c = WINTER[c];
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

export function roundTower(r: number, h: number, o: { color?: number; roof?: number | null; merlons?: boolean; banner?: number } = {}): THREE.Group {
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
