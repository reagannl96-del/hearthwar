// The Oasis: the Djinn's city of the eastern desert. Sun-baked sandstone and whitewash,
// turquoise domes with gold finials, pointed arches and lattice screens, striped awnings
// in saffron, crimson and teal, brass lamps and date palms. The Djinn's seat grows from a
// nomad's pavilion into a sandstone house with a little dome, a palace of arcades between
// two wind towers, a grand palace under a great turquoise-and-gold dome with a reflecting
// pool and floating orbs, and at last a palace of legend: a colossal golden lamp floating
// over the great dome, blue djinn-smoke spiralling up out of it, flying carpets circling.
//
// Everything that stands still is baked with its building (one mesh per material); the moving
// parts are a few flames, pennants, the lamp, the smoke, the carpets and merged swarms of orbs.
//
// NB: kit.ts imports this module (for the houses and towers), so nothing here may touch a kit
// binding at load time: only plain numbers at the top level, everything else inside functions.

import * as THREE from 'three';
import type { BuildingId } from '../../engine/types';
import type { Built } from './buildings';
import { C, bake, blob, box, cone, cyl, detailMat, extrude, limb, mat, mesh, rng, swarm } from './kit';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------- the Oasis's own colours (none is a palette key, so no season or theme repaints them) ----------

export const SAND = 0xe2c38f, SAND_DK = 0xc19c62, SAND_LT = 0xf1ddb5, MUD = 0xc99a68, MUD_DK = 0xa87a4c;
export const WASH = 0xf6eddb, WASH_SH = 0xe4d4b4;
export const TURQ = 0x2fb2aa, TURQ_DK = 0x1b7d80, TURQ_LT = 0x7fdcd2;
export const GOLD = 0xe6b43c, GOLD_DK = 0xb88a2c, BRASS = 0xcf9e46;
export const CEDAR = 0x6e4628, CEDAR_DK = 0x4a2c16, PALM_WOOD = 0x8c6b45, PALM_RING = 0x6e5234;
export const SAFFRON = 0xe8a22a, CRIMSON = 0xb4283a, INDIGO = 0x333f86, PLUM = 0x6a2c5e, LINEN = 0xf3ead6, ROSE = 0xd8707a;
export const FROND = 0x6c9a3c, FROND_DK = 0x4b7a2e, FROND_LT = 0x8cb04a, DATES = 0xa4502a;
export const SHADOW = 0x2a1a10, IRON_OA = 0x4e4a48, STEEL_OA = 0xdfe4e6, TERRA = 0xb96a42, TERRA_DK = 0x96502e;
/** lamp glass: dark amber by day, glowing warm at night (see oasisNight) */
export const LAMP_GLASS = 0x6a4420;
export const FLAME_C = 0xffb040, FLAME_E = 0xd06010, COAL = 0xff8a3a, COAL_E = 0xb8420c;
export const ORB = 0xcffcff, ORB_E = 0x2ab4c8, WATER_OA = 0x39c3c6, WATER_E = 0x0a3a40, JET = 0xd8fbff;
export const DJINN = 0x3f82dc, DJINN_DK = 0x2b5eac, SMOKE_C = 0x7ab8ff, SMOKE_E = 0x2456b0, EYE = 0xfff0a0, EYE_E = 0xd09a20;
export const CAMEL = 0xc99f6c, CAMEL_DK = 0x9c7446, CAMEL_LT = 0xdcbf92;

const STRIPES: number[][] = [[SAFFRON, LINEN], [CRIMSON, LINEN], [TURQ_DK, LINEN], [INDIGO, SAFFRON], [CRIMSON, SAFFRON], [TURQ, WASH]];
const SPICES = [0xc8401e, 0xe8b020, 0xd86a1c, 0x8a9a3a, 0x9a3a1a, 0xf0d060];

/** Night falls on the Oasis: the lamps light and the glazed domes glow faintly turquoise. */
export function oasisNight(n: boolean): void {
  const glass = mat(LAMP_GLASS);
  glass.emissive.set(n ? 0xffa340 : 0x000000);
  glass.emissiveIntensity = n ? 1.7 : 1;
  for (const [c, e] of [[TURQ, 0x0f4a46], [TURQ_DK, 0x093a3a], [TURQ_LT, 0x125a52]] as [number, number][]) {
    mat(c).emissive.set(n ? e : 0x000000);
  }
}

// ---------- shapes ----------

/** A small bright part that glows and casts no shadow (coals, orbs, flames, jewels). */
function glow(geo: THREE.BufferGeometry, c: number, e: number): THREE.Mesh {
  return new THREE.Mesh(geo, detailMat(c, { emissive: e }));
}

/**
 * A moving part (a wheel, a pennant, a floating lamp): its pieces merged into one mesh per material so it
 * costs a draw or two, flagged to be kept out of the building's bake and animated. Build it at the origin
 * and place the group this returns.
 */
function moving(parts: THREE.Group, flags: Record<string, unknown>): THREE.Group {
  const g = bake(parts);
  Object.assign(g.userData, { dynamic: true }, flags);
  return g;
}

/** A figure merged into one mesh per material for the village's walks (its moving bits, flagged dynamic, stay apart). */
export function bakeFigure(fig: THREE.Group): THREE.Group {
  const flags = { ...fig.userData };
  const g = bake(fig);
  Object.assign(g.userData, flags);
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return g;
}

/** Lamp glass: lit at night by oasisNight. */
function glass(geo: THREE.BufferGeometry): THREE.Mesh {
  return new THREE.Mesh(geo, detailMat(LAMP_GLASS));
}

/** The outline of a pointed arch, w wide and h tall, springing at `spring` of its height (for extrude). */
function archPts(w: number, h: number, spring = 0.6): [number, number][] {
  const hs = h * spring, rh = h - hs;
  return [[-w / 2, 0], [w / 2, 0], [w / 2, hs], [w * 0.44, hs + rh * 0.42], [w * 0.28, hs + rh * 0.74], [w * 0.12, hs + rh * 0.92], [0, h],
    [-w * 0.12, hs + rh * 0.92], [-w * 0.28, hs + rh * 0.74], [-w * 0.44, hs + rh * 0.42], [-w / 2, hs]];
}

/** A pointed arch standing on y=0, facing +z, `depth` thick. */
export function archMesh(w: number, h: number, depth: number, color: number): THREE.Mesh {
  return extrude(archPts(w, h), depth, color);
}

/** An arched window of lamplit glass (dark by day, glowing at night), a sandstone sill under it. */
function archWin(g: THREE.Object3D, x: number, y: number, z: number, w = 0.55, h = 0.95, ry = 0, sill: number = SAND_LT): void {
  const o = new THREE.Group();
  const win = archMesh(w, h, 0.1, C.window);
  win.userData.window = true;
  o.add(win);
  o.add(box(w + 0.18, 0.08, 0.16, sill, 0, -0.06, 0.02));
  o.position.set(x, y, z);
  o.rotation.y = ry;
  g.add(o);
}

/** An onion dome's profile: a bulb swelling past its base and drawn up to a point. */
function domeGeo(r: number, h: number, onion = 0.22, seg = 12, phi0 = 0, phiLen = Math.PI * 2): THREE.BufferGeometry {
  const p: [number, number][] = onion > 0
    ? [[r, 0], [r * (1 + onion * 0.55), h * 0.16], [r * (1 + onion), h * 0.34], [r * (0.95 + onion * 0.45), h * 0.52], [r * 0.72, h * 0.68], [r * 0.42, h * 0.82], [r * 0.16, h * 0.94], [0.001, h]]
    : [[r, 0], [r * 0.97, h * 0.26], [r * 0.87, h * 0.5], [r * 0.68, h * 0.72], [r * 0.4, h * 0.9], [0.001, h]];
  return new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), seg, phi0, phiLen);
}

/** A gilded finial: a collar, stacked orbs and a spike (a glowing star at the tip of the grandest). */
function finial(s = 1, star = false): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.12 * s, 0.18 * s, 0.14 * s, GOLD, 8));
  g.add(blob(0.17 * s, GOLD, 0, 0.3 * s, 0, 1, 1, 1, 1));
  g.add(cyl(0.05 * s, 0.07 * s, 0.22 * s, GOLD, 6, 0, 0.44 * s));
  g.add(blob(0.11 * s, GOLD, 0, 0.72 * s, 0, 1, 1.15, 1, 0));
  g.add(cone(0.05 * s, 0.5 * s, GOLD, 6, 0, 0.8 * s));
  if (star) {
    const st = glow(new THREE.OctahedronGeometry(0.2 * s, 0), 0xfff2b0, 0xd0a020);
    st.position.y = 1.4 * s;
    st.scale.set(1, 1.4, 0.5);
    g.add(st);
  }
  return g;
}

/**
 * A dome on a drum: a ring of lit windows round the drum, a turquoise (or gold, or whitewashed) dome,
 * gold ribs down the grandest, and a gilded finial. Origin at the foot of the drum.
 */
export function domeOn(r: number, h: number, o: { color?: number; drum?: number; drumH?: number; onion?: number; seg?: number; ribs?: number; wins?: number; fin?: number; star?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  const seg = o.seg ?? 12;
  const dh = o.drumH ?? r * 0.45;
  const color = o.color ?? TURQ;
  if (dh > 0) {
    g.add(cyl(r * 1.04, r * 1.08, dh, o.drum ?? SAND_LT, 8));
    g.add(cyl(r * 1.1, r * 1.1, 0.14, TURQ_DK, 8, 0, dh - 0.16));
    const nw = o.wins ?? (r > 1.4 ? 8 : 4);
    for (let i = 0; i < nw && dh > 0.6; i++) {
      const a = (i / nw) * Math.PI * 2 + Math.PI / 8;
      archWin(g, Math.sin(a) * r * 1.05, dh * 0.2, Math.cos(a) * r * 1.05, Math.min(0.5, r * 0.3), Math.min(dh * 0.6, 1.1), a, SAND_LT);
    }
  }
  const d = mesh(domeGeo(r, h, o.onion ?? 0.22, seg), color);
  d.position.y = dh;
  g.add(d);
  const nr = o.ribs ?? 0;
  for (let i = 0; i < nr; i++) {
    const rib = mesh(domeGeo(r * 1.012, h * 1.004, o.onion ?? 0.22, 1, (i / nr) * Math.PI * 2, 0.09), GOLD);
    rib.position.y = dh;
    g.add(rib);
  }
  const f = finial(o.fin ?? Math.max(0.6, r * 0.55), o.star);
  f.position.y = dh + h * 0.97;
  g.add(f);
  return g;
}

/** A pointed merlon (the Oasis's leaf-shaped crenellation), s wide, standing on y=0, facing +z. */
function merlon(s: number, color: number, depth = 0.24): THREE.Mesh {
  return extrude([[-s / 2, 0], [s / 2, 0], [s / 2, s * 0.75], [0, s * 1.35], [-s / 2, s * 0.75]], depth, color);
}

/** A crenellated parapet of pointed merlons along the four edges of a w × d roof at height y. */
function crenels(g: THREE.Group, w: number, d: number, y: number, color: number, s = 0.46, x0 = 0, z0 = 0): void {
  const run = (len: number, place: (k: number) => [number, number, number]) => {
    const n = Math.max(2, Math.floor(len / (s * 1.7)));
    for (let i = 0; i < n; i++) {
      const [x, z, ry] = place(-len / 2 + ((i + 0.5) * len) / n);
      const m = merlon(s, color);
      m.position.set(x0 + x, y, z0 + z);
      m.rotation.y = ry;
      g.add(m);
    }
  };
  run(w, (k) => [k, d / 2 - 0.12, 0]);
  run(w, (k) => [k, -d / 2 + 0.12, Math.PI]);
  run(d, (k) => [w / 2 - 0.12, k, Math.PI / 2]);
  run(d, (k) => [-w / 2 + 0.12, k, -Math.PI / 2]);
}

/**
 * A flat-roofed block of the city: whitewash or sandstone on a darker plinth, a band of turquoise tile
 * under a cornice, pointed merlons round the roof, lit arched windows and an arched doorway.
 */
export function block(w: number, h: number, d: number, o: { wall?: number; plinth?: number; band?: number | null; crenel?: number | null; door?: number | null; wins?: number; winY?: number; sideWins?: boolean; merlon?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  const wall = o.wall ?? WASH;
  g.add(box(w, h, d, wall));
  g.add(box(w + 0.16, Math.min(0.5, h * 0.14), d + 0.16, o.plinth ?? SAND_DK));
  if (o.band !== null) g.add(box(w + 0.06, 0.24, d + 0.06, o.band ?? TURQ_DK, 0, h - 0.62, 0));
  g.add(box(w + 0.22, 0.16, d + 0.22, SAND_LT, 0, h - 0.08, 0));
  if (o.crenel !== null) crenels(g, w + 0.1, d + 0.1, h + 0.06, o.crenel ?? (wall === WASH ? WASH : SAND), o.merlon ?? 0.46);
  if (o.door !== null && o.door !== undefined) doorway(g, 0, d / 2, o.door, Math.min(h - 0.9, o.door * 1.75));
  const nw = o.wins ?? Math.max(0, Math.floor(w / 2.2));
  const wy = o.winY ?? Math.max(0.9, h * 0.42);
  for (let i = 0; i < nw; i++) {
    const x = -w / 2 + ((i + 1) * w) / (nw + 1);
    if (o.door && Math.abs(x) < o.door / 2 + 0.55) continue;
    archWin(g, x, wy, d / 2 + 0.02);
  }
  if (o.sideWins) for (const s of [-1, 1]) archWin(g, s * (w / 2 + 0.02), wy, 0, 0.5, 0.9, s * Math.PI / 2);
  return g;
}

/** A doorway: a carved sandstone surround, a band of tile over it, and cedar doors studded with brass (front at z). */
function doorway(g: THREE.Group, x: number, z: number, w: number, h: number, open = false): void {
  const f = archMesh(w + 0.5, h + 0.34, 0.14, SAND_LT);
  f.position.set(x, 0, z + 0.02);
  g.add(f);
  const t = archMesh(w + 0.24, h + 0.16, 0.08, TURQ_DK);
  t.position.set(x, 0, z + 0.1);
  g.add(t);
  const rec = archMesh(w, h, 0.06, SHADOW);
  rec.position.set(x, 0, z + 0.15);
  g.add(rec);
  if (!open) {
    for (const s of [-1, 1]) {
      const leaf = box(w / 2 - 0.04, h * 0.62, 0.06, CEDAR, x + s * (w / 4), 0, z + 0.19);
      g.add(leaf);
      for (let k = 0; k < 3; k++) g.add(box(0.07, 0.07, 0.03, GOLD, x + s * (w / 4), h * (0.14 + k * 0.18), z + 0.23));
    }
  }
}

/** A mashrabiya: a carved cedar lattice screen jutting from a wall, w wide and h tall (front at +z). */
function lattice(w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w + 0.16, 0.14, 0.62, CEDAR_DK, 0, -0.14, 0.18));
  g.add(box(w, h, 0.5, SHADOW, 0, 0, 0.12));
  const n = Math.max(3, Math.round(w / 0.24));
  for (let i = 0; i <= n; i++) g.add(box(0.05, h, 0.05, CEDAR, -w / 2 + (i * w) / n, 0, 0.4));
  for (let k = 1; k < 4; k++) g.add(box(w, 0.05, 0.05, CEDAR, 0, (k * h) / 4, 0.4));
  g.add(box(w + 0.2, 0.14, 0.66, CEDAR_DK, 0, h, 0.16));
  g.add(cone(0.18, 0.2, CEDAR_DK, 4, 0, h + 0.14, 0.2).rotateY(Math.PI / 4));
  return g;
}

/** A striped awning, w wide and d deep, its front edge dipping by `slope`, a scalloped valance along the hem. Origin at the back edge. */
export function awning(w: number, d: number, cols: number[], slope = 0.28, valance = true): THREE.Group {
  const g = new THREE.Group();
  const n = Math.max(3, Math.round(w / 0.55));
  const sw = w / n;
  for (let i = 0; i < n; i++) {
    const c = cols[i % cols.length];
    g.add(box(sw + 0.004, 0.05, d, c, -w / 2 + (i + 0.5) * sw, 0, d / 2));
    if (valance) {
      g.add(box(sw, 0.2, 0.03, c, -w / 2 + (i + 0.5) * sw, -0.2, d));
      const p = cone(sw * 0.36, 0.2, c, 3, -w / 2 + (i + 0.5) * sw, -0.2, d);
      p.rotation.x = Math.PI;
      g.add(p);
    }
  }
  g.rotation.x = slope;
  return g;
}

/** A brass lantern of pierced metal, its glass lit at night; origin at its heart, a cord up to `cord` above. */
export function lantern(s = 1, cord = 0): THREE.Group {
  const g = new THREE.Group();
  g.add(glass(new THREE.OctahedronGeometry(0.2 * s, 0).scale(1, 1.25, 1)));
  g.add(cone(0.2 * s, 0.24 * s, BRASS, 6, 0, 0.18 * s));
  g.add(cone(0.05 * s, 0.14 * s, BRASS, 4, 0, 0.4 * s));
  const drop = cone(0.07 * s, 0.2 * s, BRASS, 4, 0, -0.22 * s);
  drop.rotation.x = Math.PI;
  g.add(drop);
  if (cord > 0) g.add(box(0.025, cord, 0.025, IRON_OA, 0, 0.46 * s, 0));
  return g;
}

/** A lantern hung from a bracket or a beam at (x, y, z): the cord runs up from it by `cord`. */
function hangLamp(g: THREE.Group, x: number, y: number, z: number, cord = 0.4, s = 1): void {
  const l = lantern(s, cord);
  l.position.set(x, y - cord - 0.46 * s, z);
  g.add(l);
}

/** A brass lamp-post: a sandstone foot, a slender post, a curled arm and a pierced lantern hanging from it. */
export function lampPost(h = 3.2, s = 1, pennant?: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.24 * s, 0.3 * s, 0.34, SAND_DK, 8));
  g.add(cyl(0.05 * s, 0.07 * s, h, BRASS, 6, 0, 0.3));
  g.add(blob(0.09 * s, GOLD, 0, h + 0.36, 0));
  g.add(cone(0.05 * s, 0.34 * s, GOLD, 5, 0, h + 0.4));
  const arm = new THREE.Group();
  arm.add(limb(V(0, 0, 0), V(0.45 * s, 0.18 * s, 0), 0.03, 0.03, BRASS, 4));
  arm.add(limb(V(0.45 * s, 0.18 * s, 0), V(0.62 * s, 0.02 * s, 0), 0.03, 0.03, BRASS, 4));
  arm.position.y = h - 0.1;
  g.add(arm);
  hangLamp(g, 0.62 * s, h - 0.08, 0, 0.12, 0.8 * s);
  if (pennant !== undefined) {
    const pp = new THREE.Group();
    pp.add(box(0.6, 0.3, 0.03, pennant, 0.32, 0, 0));
    pp.add(cone(0.15, 0.3, pennant, 3, 0.68, -0.15, 0).rotateZ(-Math.PI / 2));
    const p = moving(pp, { flag: true });
    p.position.set(0, h - 0.7, 0);
    g.add(p);
  }
  return g;
}

/** An amphora or water jar (a lathe of clay), standing on y=0. */
export function jar(s = 1, color: number = TERRA, handles = false): THREE.Group {
  const g = new THREE.Group();
  const p = [[0.1, 0], [0.26, 0.14], [0.3, 0.34], [0.2, 0.62], [0.1, 0.78], [0.14, 0.88]];
  g.add(mesh(new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x * s, y * s)), 6), color));
  if (handles) for (const sd of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.1 * s, 0.022 * s, 3, 4, Math.PI), color).translateX(sd * 0.2 * s).translateY(0.62 * s).rotateZ(sd * -1.2));
  return g;
}

/** A rug: a border, a field and a lozenge medallion, a fringe at each end. */
export function rug(w: number, d: number, field: number, border: number, motif: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.04, d, border));
  g.add(box(w - 0.22, 0.05, d - 0.22, field));
  const m = box(Math.min(w, d) * 0.42, 0.06, Math.min(w, d) * 0.42, motif);
  m.rotation.y = Math.PI / 4;
  g.add(m);
  for (const s of [-1, 1]) g.add(box(0.06, 0.03, d - 0.1, LINEN, s * (w / 2 + 0.04), 0, 0));
  return g;
}

/** A rug rolled up and laid on its side (along x). */
function rolledRug(len: number, c: number, band: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.16, 0.16, len, c, 7).rotateZ(Math.PI / 2).translateX(0.16));
  g.add(cyl(0.165, 0.165, 0.1, band, 7).rotateZ(Math.PI / 2).translateX(0.16).translateY(len * 0.3));
  g.add(cyl(0.165, 0.165, 0.1, band, 7).rotateZ(Math.PI / 2).translateX(0.16).translateY(-len * 0.3));
  g.position.y = 0;
  return g;
}

/** A plump cushion. */
function cushion(x: number, z: number, c: number, s = 1): THREE.Mesh {
  return blob(0.3 * s, c, x, 0.14 * s, z, 1.2, 0.45, 1);
}

/** A flame that flickers (kept apart from the bake so it can move). */
function flame(s = 1): THREE.Group {
  const f = new THREE.Group();
  f.add(glow(new THREE.ConeGeometry(0.3 * s, 0.85 * s, 6).translate(0, 0.42 * s, 0), FLAME_C, FLAME_E));
  f.add(glow(new THREE.ConeGeometry(0.16 * s, 0.55 * s, 5).translate(0, 0.28 * s, 0), 0xffe08a, 0xd08a20));
  f.userData.dynamic = true;
  f.userData.fire = true;
  return f;
}

/** A brass fire-bowl on three curled legs, coals glowing in it (a live flame on the grander ones). */
export function brazier(h = 1, live = false, s = 1): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    g.add(limb(V(Math.cos(a) * 0.42 * s, 0, Math.sin(a) * 0.42 * s), V(Math.cos(a) * 0.16 * s, h, Math.sin(a) * 0.16 * s), 0.045 * s, 0.035 * s, BRASS, 4));
    g.add(blob(0.07 * s, BRASS, Math.cos(a) * 0.42 * s, 0.05, Math.sin(a) * 0.42 * s));
  }
  g.add(mesh(new THREE.SphereGeometry(0.46 * s, 9, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), BRASS).translateY(h + 0.3 * s));
  g.add(cyl(0.5 * s, 0.5 * s, 0.06, GOLD, 9, 0, h + 0.28 * s));
  g.add(glow(new THREE.CylinderGeometry(0.4 * s, 0.4 * s, 0.06, 8), COAL, COAL_E).translateY(h + 0.3 * s));
  if (live) {
    const f = flame(s);
    f.position.y = h + 0.3 * s;
    g.add(f);
  } else g.add(glow(new THREE.ConeGeometry(0.24 * s, 0.5 * s, 5).translate(0, 0.25 * s, 0), FLAME_C, FLAME_E).translateY(h + 0.3 * s));
  return g;
}

/** A still pool of turquoise water in a sandstone rim (w × d), glowing faintly. */
function pool(w: number, d: number, rim: number = SAND_LT): THREE.Group {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    g.add(box(w + 0.5, 0.42, 0.26, rim, 0, 0, s * (d / 2 + 0.12)));
    g.add(box(0.26, 0.42, d, rim, s * (w / 2 + 0.12), 0, 0));
  }
  g.add(box(w + 0.02, 0.06, d + 0.02, TURQ_DK, 0, 0.04, 0));
  g.add(mesh(new THREE.BoxGeometry(w, 0.05, d).translate(0, 0.3, 0), WATER_OA, { emissive: WATER_E }));
  return g;
}

/** An octagonal fountain: a basin of turquoise water, a pedestal with a bowl, and a jet of water leaping from it. */
export function fountain(r = 1.2, tiers = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(r, r * 1.06, 0.5, SAND_LT, 8));
  g.add(cyl(r * 1.02, r * 1.02, 0.1, TURQ_DK, 8, 0, 0.42));
  g.add(mesh(new THREE.CylinderGeometry(r - 0.14, r - 0.14, 0.05, 8).translate(0, 0.44, 0), WATER_OA, { emissive: WATER_E }));
  let y = 0.4;
  for (let k = 0; k < tiers; k++) {
    const rr = r * (0.42 - k * 0.14);
    g.add(cyl(0.12, 0.2, 0.7, SAND, 6, 0, y));
    y += 0.7;
    g.add(cyl(rr, rr * 0.4, 0.22, SAND_LT, 8, 0, y));
    g.add(mesh(new THREE.CylinderGeometry(rr * 0.85, rr * 0.85, 0.04, 8).translate(0, y + 0.2, 0), WATER_OA, { emissive: WATER_E }));
    // the sheet of water spilling over the bowl's lip
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.98, rr * 1.12, y - 0.4, 8, 1, true).translate(0, 0.4 + (y - 0.4) / 2, 0), detailMat(JET, { opacity: 0.35 })));
    y += 0.2;
  }
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.8, 6).translate(0, y + 0.4, 0), detailMat(JET, { opacity: 0.6, emissive: 0x2a6a70 })));
  return g;
}

// ---------- palms ----------

/** A leaf of a palm frond: a flat, tapering blade lying along +x (in the xz plane). */
function leafGeo(len: number, wid: number): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(wid, len, 3, 1);
  geo.rotateZ(-Math.PI / 2);
  geo.translate(len / 2, 0, 0);
  geo.scale(1, 0.16, 1);
  return geo;
}

/**
 * A date palm: a ringed trunk that leans and curves a little, a crown of arching fronds (each rising out
 * of the crown and drooping at its tip) and, on the fruiting ones, clusters of dates under the crown.
 */
export function palm(h: number, r: () => number, o: { dates?: boolean; fronds?: number; lean?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  const lean = o.lean ?? (r() - 0.5) * 0.5, dir = r() * Math.PI * 2;
  const n = 3;
  let p = V(0, 0, 0);
  for (let i = 0; i < n; i++) {
    const k = (i + 1) / n;
    const q = V(Math.cos(dir) * lean * h * k * k, h * k, Math.sin(dir) * lean * h * k * k);
    g.add(limb(p, q, 0.2 - i * 0.03, 0.17 - i * 0.03, PALM_WOOD, 5));
    if (i < 2) g.add(cyl(0.2 - i * 0.03, 0.21 - i * 0.03, 0.12, PALM_RING, 5, q.x, q.y - 0.06, q.z));
    p = q;
  }
  const top = p;
  g.add(blob(0.24, PALM_RING, top.x, top.y, top.z, 1, 0.8, 1));
  const nf = o.fronds ?? 8;
  for (let j = 0; j < nf; j++) {
    const a = (j / nf) * Math.PI * 2 + r() * 0.4;
    const fr = new THREE.Group();
    const L1 = 1.1 + r() * 0.3, L2 = 1.0 + r() * 0.4;
    const up = 0.35 + r() * 0.3 - (j % 3 === 0 ? 0.5 : 0);
    const c = j % 3 === 0 ? FROND_DK : j % 3 === 1 ? FROND : FROND_LT;
    const l1 = mesh(leafGeo(L1, 0.34), c);
    l1.rotation.z = up;
    fr.add(l1);
    const l2 = mesh(leafGeo(L2, 0.3), c);
    l2.position.set(Math.cos(up) * L1 * 0.94, Math.sin(up) * L1 * 0.94, 0);
    l2.rotation.z = up - 0.9 - r() * 0.3;
    fr.add(l2);
    fr.position.copy(top);
    fr.rotation.y = a;
    g.add(fr);
  }
  if (o.dates ?? r() < 0.6) {
    for (let k = 0; k < 2; k++) {
      const a = k * 3.1 + r();
      g.add(blob(0.16, DATES, top.x + Math.cos(a) * 0.3, top.y - 0.3, top.z + Math.sin(a) * 0.3, 0.9, 1.5, 0.9));
    }
  }
  return g;
}

/** A palm in a glazed pot, for courtyards and terraces. */
function pottedPalm(h: number, r: () => number, pot: number = TURQ_DK): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.42, 0.3, 0.55, pot, 8));
  g.add(cyl(0.44, 0.44, 0.08, GOLD_DK, 8, 0, 0.5));
  const p = palm(h, r, { dates: false, fronds: 6, lean: 0.08 });
  p.position.y = 0.5;
  p.scale.setScalar(0.7);
  g.add(p);
  return g;
}

// ---------- beasts ----------

/**
 * A camel, long along +x like the horse: long knobbly legs, a deep body, one great hump, a long curved
 * neck and a drooping head. `kneel` folds it down to rest. A saddle blanket in `blanket` if given.
 */
export function camel(color: number = CAMEL, o: { kneel?: boolean; blanket?: number; tassels?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  const dk = color === CAMEL ? CAMEL_DK : color === CAMEL_LT ? CAMEL : 0x6e5030;
  const y = o.kneel ? 0.62 : 1.18;
  if (o.kneel) {
    for (const z of [-0.2, 0.2]) {
      g.add(box(0.9, 0.2, 0.14, dk, 0.35, 0, z));
      g.add(box(0.8, 0.22, 0.14, dk, -0.45, 0, z));
    }
  } else {
    for (const [x, z] of [[-0.5, 0.2], [0.55, 0.2], [-0.5, -0.2], [0.55, -0.2]]) {
      g.add(limb(V(x, 0, z), V(x * 0.9, 0.55, z), 0.07, 0.08, dk, 5));
      g.add(blob(0.09, dk, x * 0.9, 0.56, z));
      g.add(limb(V(x * 0.9, 0.56, z), V(x * 0.85, y + 0.05, z), 0.08, 0.11, color, 5));
      g.add(box(0.16, 0.05, 0.14, dk, x, 0, z + 0.01));
    }
  }
  g.add(blob(0.5, color, 0, y + 0.25, 0, 1.55, 0.72, 0.78));
  g.add(blob(0.36, color, -0.05, y + 0.62, 0, 1.2, 0.95, 0.9));
  g.add(blob(0.2, dk, -0.72, y + 0.2, 0, 0.8, 1, 0.8));
  // the neck curving down from the chest and up again to the head
  const a = V(0.62, y + 0.35, 0), b = V(1.05, y + 0.25, 0), c = V(1.2, y + 0.95, 0);
  g.add(limb(a, b, 0.2, 0.15, color, 6), limb(b, c, 0.15, 0.12, color, 6));
  g.add(blob(0.15, color, b.x, b.y, 0));
  const head = box(0.46, 0.2, 0.2, color, 1.36, y + 0.9, 0);
  head.rotation.z = -0.2;
  g.add(head);
  g.add(box(0.14, 0.14, 0.16, dk, 1.56, y + 0.86, 0));
  for (const z of [-0.08, 0.08]) g.add(cone(0.04, 0.12, dk, 4, 1.24, y + 1.06, z));
  const tail = box(0.06, 0.45, 0.06, dk, -0.78, y - 0.1, 0);
  tail.rotation.z = -0.2;
  g.add(tail);
  if (o.blanket !== undefined) {
    // a saddle cloth over the hump, hanging down both flanks, tasselled
    g.add(box(0.8, 0.08, 0.84, o.blanket, -0.05, y + 0.88, 0));
    for (const z of [-0.44, 0.44]) g.add(box(0.8, 0.5, 0.04, o.blanket, -0.05, y + 0.42, z));
    for (const z of [-0.47, 0.47]) for (let k = 0; k < 4; k++) g.add(cone(0.04, 0.14, o.tassels ?? GOLD, 4, -0.36 + k * 0.22, y + 0.42, z).rotateX(Math.PI));
  }
  return g;
}

/** Where a rider sits on a standing camel's hump. */
export const CAMEL_SEAT = 1.98;

/** A desert falcon on the wing (hinged wings that beat): the Djinn's scouts. */
export function falcon(): THREE.Group {
  const g = new THREE.Group();
  const b = new THREE.Group();
  b.add(blob(0.2, 0x8a6a4a, 0, 0, 0, 0.8, 0.8, 1.3));
  b.add(blob(0.13, 0xe8dcc4, 0, -0.04, 0.12, 0.9, 0.9, 1));
  b.add(blob(0.13, 0x6e5238, 0, 0.1, 0.28));
  b.add(cone(0.04, 0.1, 0xe0b040, 4, 0, 0.08, 0.42).rotateX(Math.PI / 2 + 0.4));
  b.add(blob(0.035, 0xffd04a, 0.07, 0.13, 0.36), blob(0.035, 0xffd04a, -0.07, 0.13, 0.36));
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.add(box(0.56, 0.04, 0.3, 0x7a5a3a, side * 0.28, 0, 0));
    hinge.add(box(0.3, 0.03, 0.2, 0x3e2e22, side * 0.62, 0, -0.04));
    hinge.position.set(side * 0.08, 0.04, -0.02);
    hinge.userData.flap = side;
    hinge.userData.dynamic = true;
    b.add(hinge);
  }
  b.add(box(0.18, 0.03, 0.3, 0x6e5238, 0, 0, -0.3));
  // the hood's tassel: a falconer's bird, gold jesses trailing
  b.add(box(0.02, 0.2, 0.02, GOLD, 0.04, -0.14, -0.05), box(0.02, 0.2, 0.02, GOLD, -0.04, -0.14, -0.05));
  b.position.y = 2.0;
  g.add(b);
  g.userData.flapping = true;
  return g;
}

/** A goat, for the farm's pens. */
function goat(color: number): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.25, 0.1], [0.25, 0.1], [-0.25, -0.1], [0.25, -0.1]]) g.add(box(0.07, 0.4, 0.07, 0x3a2a1c, x, 0, z));
  g.add(blob(0.24, color, 0, 0.52, 0, 1.4, 0.8, 0.8));
  g.add(box(0.2, 0.16, 0.14, color, 0.42, 0.7, 0));
  for (const z of [-0.05, 0.05]) { const h = cone(0.025, 0.2, 0x5a4a3a, 4, 0.38, 0.8, z); h.rotation.z = 0.6; g.add(h); }
  return g;
}

// ---------- the Djinn's folk ----------

const ROBES = [LINEN, 0x3a4a8a, 0xd8962a, 0xa8303a, 0x2a8a8a, 0x6a3a6a, 0xcfb088, 0xf0e4c8, 0x4a6a9a, 0xc8783a];
const WRAPS = [LINEN, 0xe8e0cc, 0x2e3a78, 0xb4283a, 0xe8a22a, 0x2a8a8a, 0xf6f0e0];
const SKINS = [0xc68a5a, 0xa8704a, 0xd9a577, 0x8a5a3a, 0xb97c50];
let folkCount = 0;

/** A turban wound round the head (big: a great one with a jewel and a plume). */
function turban(g: THREE.Group, c: number, y = 1.36, big = false, jewel?: number): void {
  g.add(blob(big ? 0.27 : 0.22, c, 0, y, 0, 1.08, big ? 0.9 : 0.72, 1.08, big ? 1 : 0));
  g.add(cyl(0.2, 0.22, 0.1, c, 7, 0, y - 0.14));
  if (big) {
    g.add(blob(0.14, c, 0, y + 0.2, 0));
    if (jewel !== undefined) g.add(glow(new THREE.OctahedronGeometry(0.06, 0), jewel, 0x6a1a2a).translateY(y + 0.04).translateZ(0.26));
    const plume = cone(0.05, 0.4, LINEN, 4, 0.02, y + 0.12, 0.2);
    plume.rotation.x = -0.35;
    g.add(plume);
  }
}

/** A headcloth falling to the shoulders, held by a dark cord. */
function headcloth(g: THREE.Group, c: number, cord = 0x2a1e18): void {
  g.add(blob(0.21, c, 0, 1.3, -0.02, 1.08, 0.9, 1.08));
  g.add(box(0.44, 0.34, 0.3, c, 0, 0.98, -0.08));
  g.add(cyl(0.2, 0.2, 0.05, cord, 8, 0, 1.36));
}

/** A veil over the head and shoulders, the face showing. */
function veil(g: THREE.Group, c: number): void {
  g.add(blob(0.22, c, 0, 1.3, -0.04, 1.05, 1.05, 1.05));
  g.add(cone(0.36, 0.55, c, 7, 0, 0.72, -0.02));
}

/**
 * The Oasis's folk: long robes flaring to the hem, a bright sash, and each their own head: a turban,
 * a headcloth with its cord, or a veil; now and then a water jar carried on the head.
 */
export function desertFolk(g: THREE.Group, tunic: number): void {
  const k = folkCount++;
  const robe = ROBES.includes(tunic) ? tunic : ROBES[k % ROBES.length];
  const sash = [SAFFRON, CRIMSON, TURQ, GOLD, INDIGO][(k * 3) % 5];
  const skin = SKINS[k % SKINS.length];
  g.add(box(0.26, 0.08, 0.3, 0x5a3a20, 0, 0, 0.04));
  g.add(cyl(0.2, 0.33, 1.02, robe, 7, 0, 0.04));
  g.add(cyl(0.215, 0.215, 0.09, sash, 7, 0, 0.6));
  g.add(cyl(0.23, 0.19, 0.18, robe, 7, 0, 0.98));
  g.add(blob(0.18, skin, 0, 1.24, 0.02));
  const head = k % 4;
  if (head === 0) turban(g, WRAPS[k % WRAPS.length]);
  else if (head === 1) headcloth(g, WRAPS[(k + 2) % WRAPS.length]);
  else if (head === 2) veil(g, [INDIGO, CRIMSON, TURQ_DK, PLUM, SAFFRON][k % 5]);
  else { g.add(cyl(0.17, 0.19, 0.14, [CRIMSON, INDIGO, TURQ_DK][k % 3], 8, 0, 1.33)); g.add(box(0.12, 0.08, 0.04, 0x2a1e18, 0, 1.12, 0.16)); }
  if (k % 5 === 2) {
    // a water jar carried on the head
    const j = jar(0.5, k % 2 ? TERRA : WASH_SH);
    j.position.y = head === 0 ? 1.52 : 1.44;
    g.add(j);
  }
}

/** A band of cloth drawn over the lower face (the raiders' and the blade dancers'). */
function faceVeil(g: THREE.Group, c: number): void {
  g.add(box(0.3, 0.12, 0.08, c, 0, 1.17, 0.14));
}

/** A scimitar: a curved blade on a gilt hilt, its point curling back; held at the right hand (x > 0.25). */
function scimitar(x: number, y: number, z: number, s = 1, tilt = 0.5): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.05 * s, 0.2 * s, 0.05 * s, GOLD_DK, 0, -0.2 * s, 0));
  g.add(box(0.05 * s, 0.04 * s, 0.24 * s, GOLD, 0, 0, 0));
  // the blade rises from the guard and sweeps back to its point
  const blade = mesh(new THREE.TorusGeometry(0.85 * s, 0.04 * s, 3, 7, 0.95), STEEL_OA);
  blade.scale.set(1, 1, 0.5);
  blade.rotation.y = -Math.PI / 2;
  blade.position.set(0, 0.02 * s, -0.85 * s);
  g.add(blade);
  g.position.set(x, y, z);
  g.rotation.x = tilt;
  return g;
}

/** A round brass shield with a boss and a ring of studs, on the left arm. */
function roundShield(g: THREE.Group, r = 0.38, face: number = BRASS): void {
  const s = new THREE.Group();
  s.add(cyl(r, r, 0.06, face, 10).rotateZ(Math.PI / 2));
  s.add(cyl(r * 0.72, r * 0.72, 0.07, TURQ_DK, 10).rotateZ(Math.PI / 2));
  s.add(blob(r * 0.26, GOLD, 0.05, 0, 0));
  s.position.set(-0.28, 0.72, 0.02);
  g.add(s);
}

/** A recurve bow held out at the right hand. */
function recurve(g: THREE.Group, x: number, y: number, z: number): void {
  const b = new THREE.Group();
  for (const s of [-1, 1]) {
    const arm = mesh(new THREE.TorusGeometry(0.3, 0.03, 3, 6, 1.4), CEDAR_DK);
    arm.rotation.z = s > 0 ? 0.1 : Math.PI - 1.5;
    arm.position.y = s * 0.26;
    b.add(arm);
  }
  b.add(box(0.012, 1.0, 0.012, LINEN, -0.02, 0, 0));
  b.position.set(x, y, z);
  b.rotation.y = Math.PI / 2;
  g.add(b);
}

/**
 * One of the Djinn's soldiers on foot: sand guards (a spear with a crimson tassel, a round brass shield,
 * a steel cap wound with a turban), blade dancers (a scimitar in each hand, sash and face veil flying),
 * dune raiders (indigo robes drawn over the face, a great crescent glaive), desert archers (headcloth and
 * recurve bow); falcons scout for them.
 */
export function djinnSoldier(kind: string): THREE.Group {
  if (kind === 'scout') return falcon();
  const g = new THREE.Group();
  const robe = kind === 'spear' ? LINEN : kind === 'sword' ? 0xf0e4c8 : kind === 'axe' ? INDIGO : 0xcfb088;
  desertFolkBare(g, robe, kind === 'sword' ? CRIMSON : kind === 'axe' ? 0x1e2450 : kind === 'spear' ? TURQ_DK : SAFFRON);
  switch (kind) {
    case 'spear':
      g.add(cone(0.2, 0.36, STEEL_OA, 8, 0, 1.3));
      g.add(cyl(0.22, 0.24, 0.12, LINEN, 8, 0, 1.28));
      g.add(box(0.44, 0.34, 0.05, BRASS, 0, 0.52, 0.28));
      roundShield(g);
      g.add(cyl(0.035, 0.035, 2.4, CEDAR, 5, 0.34, 0.1, 0.1));
      g.add(cone(0.08, 0.36, STEEL_OA, 5, 0.34, 2.5, 0.1));
      g.add(blob(0.07, CRIMSON, 0.34, 2.42, 0.1, 1, 1.5, 1));
      break;
    case 'sword':
      turban(g, CRIMSON, 1.36);
      g.add(cone(0.05, 0.3, GOLD, 4, 0.04, 1.44, 0.1));
      faceVeil(g, CRIMSON);
      // the sash's long ends flying behind
      g.add(box(0.1, 0.5, 0.03, SAFFRON, 0.1, 0.18, -0.26).rotateX(0.5));
      g.add(scimitar(0.36, 0.72, 0.18, 1, 0.4));
      g.add(scimitar(-0.36, 0.7, 0.1, 0.9, -0.3));
      break;
    case 'axe': {
      g.add(blob(0.22, INDIGO, 0, 1.32, 0, 1.08, 0.95, 1.08));
      faceVeil(g, 0x1e2450);
      g.add(box(0.2, 0.05, 0.04, 0x1a1a1a, 0, 1.26, 0.18));
      // the great glaive over the shoulder: a long haft and a crescent blade
      const h = box(0.06, 1.5, 0.06, CEDAR_DK);
      h.position.set(0.32, 0.72, -0.1);
      h.rotation.x = -0.55;
      g.add(h);
      const bl = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 9, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), STEEL_OA);
      bl.scale.set(1, 1, 0.6);
      bl.position.set(0.32, 1.92, -0.82);
      bl.rotation.x = -0.55;
      g.add(bl);
      break;
    }
    case 'archer':
      headcloth(g, 0xe8dcc0, CRIMSON);
      g.add(box(0.14, 0.52, 0.12, CEDAR, 0, 0.56, -0.28));
      for (let i = 0; i < 3; i++) g.add(box(0.02, 0.2, 0.02, i % 2 ? LINEN : CRIMSON, -0.04 + i * 0.04, 0.9, -0.28));
      recurve(g, 0.34, 0.85, 0.02);
      break;
  }
  for (const c of g.children) c.castShadow = true;
  return g;
}

/** A soldier's robed body without a head-dress (the kit decides that). */
function desertFolkBare(g: THREE.Group, robe: number, sash: number): void {
  const skin = SKINS[folkCount++ % SKINS.length];
  g.add(box(0.26, 0.08, 0.3, 0x3a2a1a, 0, 0, 0.04));
  g.add(cyl(0.2, 0.3, 0.96, robe, 7, 0, 0.04));
  g.add(cyl(0.215, 0.215, 0.1, sash, 7, 0, 0.6));
  g.add(cyl(0.24, 0.2, 0.18, robe, 7, 0, 0.96));
  g.add(blob(0.18, skin, 0, 1.24, 0.02));
}

/** The Djinn's vizier (the nobleman): a towering turban with a ruby and a plume, a plum robe edged in gold, a staff crowned with a little golden lamp. */
export function vizier(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.22, 0.42, 1.15, PLUM, 8, 0, 0));
  g.add(box(0.06, 1.1, 0.03, GOLD, 0, 0.02, 0.33));
  g.add(cyl(0.26, 0.26, 0.1, GOLD, 8, 0, 0.62));
  g.add(box(0.72, 1.08, 0.05, 0x4a1e44, 0, 0.06, -0.27));
  g.add(blob(0.19, 0xc68a5a, 0, 1.28, 0.02));
  g.add(cone(0.1, 0.3, 0x2a1e18, 5, 0, 0.88, 0.15).rotateX(Math.PI));
  turban(g, LINEN, 1.44, true, 0xe0304a);
  g.add(cyl(0.03, 0.035, 1.9, GOLD_DK, 5, 0.4, 0, 0.1));
  const lamp = new THREE.Group();
  lamp.add(blob(0.12, GOLD, 0, 0, 0, 1.5, 0.7, 1));
  lamp.add(cone(0.035, 0.22, GOLD, 5, 0.18, 0.02, 0).rotateZ(-1.1));
  lamp.add(blob(0.05, GOLD, 0, 0.08, 0));
  lamp.position.set(0.4, 1.96, 0.1);
  g.add(lamp);
  const wisp = glow(new THREE.IcosahedronGeometry(0.08, 0), SMOKE_C, SMOKE_E);
  wisp.position.set(0.58, 2.12, 0.1);
  wisp.userData.pulse = true;
  wisp.userData.dynamic = true;
  g.add(wisp);
  g.scale.setScalar(1.08);
  return g;
}

/**
 * A tail of djinn-smoke h tall: a smooth, tapering swirl (a lathe with gentle swells, twisted and swayed
 * so it curls), from a thread at its tip at y=0 to rTop wide at its top.
 */
function smokeTail(h: number, rTop: number, color: number, emissive: number, opacity?: number): THREE.Mesh {
  const prof: THREE.Vector2[] = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    prof.push(new THREE.Vector2(0.012 + rTop * Math.pow(k, 1.25) * (1 + 0.12 * Math.sin(k * Math.PI * 3.5) * (1 - k)), k * h));
  }
  prof.push(new THREE.Vector2(0.001, h));
  const geo = new THREE.LatheGeometry(prof, 9);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = y / h, a = (1 - k) * 2.4, sway = (1 - k) * (1 - k) * 0.24 * (h / 1.06);
    p.setXYZ(i, x * Math.cos(a) - z * Math.sin(a) + Math.sin((1 - k) * 4.2) * sway, y, x * Math.sin(a) + z * Math.cos(a) + (Math.cos((1 - k) * 4.2) - 1) * sway);
  }
  geo.computeVertexNormals();
  return mesh(geo, color, { emissive, opacity });
}

/**
 * The Djinn: blue as the desert sky at dusk, broad-shouldered and bare-chested under a little crimson vest
 * edged in gold, golden bracers on his forearms, a black topknot through a gold ring, gold at his ears,
 * eyes like embers of sunlight; below the waist no legs at all but a curling tail of blue smoke. In his
 * right hand the lamp he is bound to, glowing.
 */
export function djinnHero(): THREE.Group {
  const g = new THREE.Group();
  // the tail of smoke: one unbroken swirl, from a wisp at its tip swelling up into the waist (it runs on up
  // under the sash, so the body flows into it without a seam)
  const tail = smokeTail(1.06, 0.3, 0x5a9ae8, SMOKE_E);
  tail.position.y = 0.1;
  g.add(tail);
  g.add(glow(new THREE.IcosahedronGeometry(0.06, 0), SMOKE_C, SMOKE_E).translateX(0.12).translateY(0.12).translateZ(-0.12));
  g.add(glow(new THREE.IcosahedronGeometry(0.045, 0), SMOKE_C, SMOKE_E).translateX(-0.08).translateY(0.05).translateZ(-0.2));
  // the sash and the waist
  g.add(cyl(0.3, 0.29, 0.2, SAFFRON, 8, 0, 0.98));
  g.add(box(0.1, 0.34, 0.03, SAFFRON, 0.16, 0.72, 0.2).rotateZ(0.2));
  // the torso: broad, bare, blue
  g.add(cyl(0.34, 0.28, 0.55, DJINN, 8, 0, 1.14));
  g.add(blob(0.3, DJINN, 0, 1.66, 0, 1.55, 0.6, 1.0));
  g.add(box(0.16, 0.5, 0.04, CRIMSON, -0.2, 1.2, 0.26), box(0.16, 0.5, 0.04, CRIMSON, 0.2, 1.2, 0.26));
  g.add(box(0.03, 0.5, 0.05, GOLD, -0.12, 1.2, 0.28), box(0.03, 0.5, 0.05, GOLD, 0.12, 1.2, 0.28));
  for (const s of [-1, 1]) {
    // shoulders, upper arms, bracers and hands
    g.add(blob(0.17, DJINN, s * 0.44, 1.64, 0));
    g.add(limb(V(s * 0.48, 1.62, 0), V(s * 0.58, 1.2, 0.08), 0.12, 0.1, DJINN, 6));
    g.add(cyl(0.11, 0.11, 0.24, GOLD, 8, s * 0.6, 0.98, 0.1));
    g.add(limb(V(s * 0.58, 1.2, 0.08), V(s * 0.6, 0.94, 0.14), 0.1, 0.09, DJINN, 6));
    g.add(blob(0.09, DJINN_DK, s * 0.6, 0.9, 0.16));
  }
  // the head: a strong jaw and a little black beard, pointed ears with gold rings, a topknot through a gold band
  g.add(blob(0.24, DJINN, 0, 1.98, 0.02, 1, 1.08, 1));
  g.add(box(0.1, 0.16, 0.08, 0x141424, 0, 1.78, 0.2).rotateX(0.2));
  for (const s of [-1, 1]) {
    g.add(cone(0.06, 0.2, DJINN, 4, s * 0.24, 1.98, 0).rotateZ(-s * 1.1));
    g.add(mesh(new THREE.TorusGeometry(0.05, 0.015, 3, 8), GOLD).translateX(s * 0.24).translateY(1.9).translateZ(0.02));
    g.add(glow(new THREE.OctahedronGeometry(0.035, 0), EYE, EYE_E).translateX(s * 0.08).translateY(2.02).translateZ(0.22));
  }
  // the topknot: a bun through a gold ring, its tail sweeping down behind
  g.add(cyl(0.08, 0.09, 0.08, GOLD, 7, 0, 2.18, -0.04));
  g.add(blob(0.11, 0x141424, 0, 2.32, -0.05, 1, 0.9, 1));
  g.add(limb(V(0, 2.34, -0.1), V(0, 2.3, -0.3), 0.06, 0.05, 0x141424, 5));
  g.add(limb(V(0, 2.3, -0.3), V(0, 1.86, -0.36), 0.05, 0.015, 0x141424, 5));
  // the lamp in his right hand (held out, so it can swing)
  const lamp = new THREE.Group();
  lamp.add(blob(0.14, GOLD, 0, 0, 0, 1.6, 0.7, 1));
  lamp.add(cone(0.04, 0.26, GOLD, 5, 0.2, 0.02, 0).rotateZ(-1.15));
  lamp.add(mesh(new THREE.TorusGeometry(0.07, 0.015, 3, 8, Math.PI), GOLD).translateX(-0.2).rotateZ(Math.PI / 2));
  lamp.add(cyl(0.06, 0.08, 0.06, GOLD, 7, 0, -0.1));
  lamp.position.set(0.62, 0.84, 0.3);
  g.add(lamp);
  const wisp = glow(new THREE.IcosahedronGeometry(0.1, 0), SMOKE_C, SMOKE_E);
  wisp.position.set(0.86, 0.98, 0.3);
  wisp.userData.pulse = true;
  wisp.userData.dynamic = true;
  g.add(wisp);
  g.scale.setScalar(1.1);
  for (const c of g.children) c.castShadow = true;
  return g;
}

/**
 * A rider of the Oasis on a camel (facing +z): camel riders with a lance and a teal pennant, camel archers
 * with a recurve bow, and sun lancers on armoured camels (scale barding, a gilded chest-plate with a sun,
 * a plumed gold helm and a sun-disc shield).
 */
export function camelRider(kind: string): THREE.Group {
  const g = new THREE.Group();
  const heavy = kind === 'heavy';
  const mount = camel(heavy ? CAMEL_LT : kind === 'marcher' ? 0xa87a4a : CAMEL, { blanket: heavy ? TURQ_DK : kind === 'marcher' ? INDIGO : CRIMSON });
  mount.rotation.y = -Math.PI / 2;
  g.add(mount);
  if (heavy) {
    // scale barding over the flanks and a gilded plate on the chest
    for (const x of [-0.42, 0.42]) g.add(box(0.05, 0.5, 1.1, GOLD_DK, x, 1.2, 0));
    g.add(box(0.5, 0.5, 0.06, GOLD, 0, 1.3, 0.72));
    g.add(glow(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 10).rotateX(Math.PI / 2), 0xffe08a, 0xb07a10).translateY(1.32).translateZ(0.76));
    g.add(box(0.22, 0.16, 0.36, GOLD, 0, 2.16, 1.36));
  }
  const seat = CAMEL_SEAT;
  const man = new THREE.Group();
  desertFolkBare(man, heavy ? 0xf0e4c8 : kind === 'marcher' ? 0x3a4a8a : LINEN, heavy ? GOLD : SAFFRON);
  if (heavy) {
    man.add(box(0.46, 0.4, 0.05, GOLD_DK, 0, 0.5, 0.28));
    man.add(cone(0.21, 0.4, GOLD, 8, 0, 1.3));
    man.add(cyl(0.23, 0.23, 0.08, GOLD_DK, 8, 0, 1.28));
    man.add(cone(0.05, 0.4, CRIMSON, 4, 0, 1.6, -0.06).rotateX(-0.4));
    const sh = new THREE.Group();
    sh.add(cyl(0.36, 0.36, 0.06, GOLD, 12).rotateZ(Math.PI / 2));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; sh.add(cone(0.05, 0.16, GOLD, 4, -0.02, Math.cos(a) * 0.4, Math.sin(a) * 0.4).rotateX(a)); }
    sh.position.set(-0.3, 0.72, 0);
    man.add(sh);
  } else if (kind === 'marcher') headcloth(man, 0x2e3a78, GOLD);
  else turban(man, LINEN);
  man.scale.setScalar(0.85);
  man.position.set(0, seat, -0.18);
  g.add(man);
  if (kind === 'marcher') recurve(g, 0.3, seat + 0.8, -0.1);
  else {
    g.add(cyl(0.035, 0.035, 2.6, CEDAR, 5, 0.34, seat + 0.2, 0));
    g.add(cone(0.07, 0.34, STEEL_OA, 5, 0.34, seat + 2.8, 0));
    const pen = box(0.03, 0.26, 0.5, heavy ? GOLD : TURQ, 0.34, seat + 2.4, -0.22);
    g.add(pen);
  }
  for (const c of g.children) c.castShadow = true;
  return g;
}

/** A camel caravan (the Djinn's trader): a camel laden with rolled rugs, sacks and jars, its merchant riding. */
export function caravanCamel(): THREE.Group {
  const g = new THREE.Group();
  const c = camel(CAMEL, { blanket: SAFFRON });
  c.rotation.y = -Math.PI / 2;
  g.add(c);
  for (const x of [-0.5, 0.5]) {
    g.add(blob(0.3, 0xd8c08a, x, 1.32, -0.1, 0.8, 1.1, 1.2));
    g.add(box(0.06, 0.5, 0.04, CEDAR_DK, x * 1.1, 1.4, -0.1));
    const j = jar(0.45, x < 0 ? TERRA : TURQ_DK);
    j.position.set(x * 1.05, 0.9, 0.4);
    g.add(j);
  }
  const rr = rolledRug(1.3, CRIMSON, SAFFRON);
  rr.position.set(-0.65, 2.02, -0.6);
  g.add(rr);
  const man = new THREE.Group();
  desertFolkBare(man, 0xd8962a, INDIGO);
  turban(man, LINEN);
  man.scale.setScalar(0.85);
  man.position.set(0, CAMEL_SEAT, 0.1);
  g.add(man);
  for (const ch of g.children) ch.castShadow = true;
  return g;
}

// ---------- houses and towers ----------

type HouseOpts = { w: number; d: number; h: number; roofH: number; wall?: number; roof?: number; frame?: number | null; door?: boolean; windows?: number; stone?: boolean; chimney?: boolean };

/**
 * A house of the Oasis: a flat-roofed cube of whitewash (or sandstone for the grander), a band of tile and
 * pointed merlons round its roof, an arched door under a striped awning, arched windows and, for the
 * bigger ones, a carved lattice bay. On the roof, by its rank: a shade of palm fronds, a striped canopy, a
 * little turquoise dome, or a wind-catcher tower drawing the breeze down into the rooms.
 */
export function oasisHouse(o: HouseOpts): THREE.Group {
  const { w, d } = o;
  const h = o.h + 0.3;
  const r = rng(Math.round(w * 13 + d * 7 + o.h * 3));
  const wall = o.wall ?? (o.stone ? SAND : WASH);
  const dw = Math.min(1.25, w * 0.24);
  const g = block(w, h, d, { wall, door: o.door === false ? null : dw, wins: o.windows, winY: h * 0.45 });
  const humble = o.roof === C.thatch || o.roof === C.thatchDark;
  const grand = o.roof === C.slate || o.roof === C.tile || o.stone;
  if (o.door !== false) {
    const aw = awning(dw + 1.1, 0.9, STRIPES[Math.floor(r() * STRIPES.length)], 0.35);
    aw.position.set(0, Math.min(h - 0.5, dw * 1.75 + 0.55), d / 2 + 0.05);
    g.add(aw);
    const j = jar(0.7, r() < 0.5 ? TERRA : TURQ_DK, true);
    j.position.set(dw / 2 + 0.55, 0, d / 2 + 0.35);
    g.add(j);
  }
  if (w > 5 && h > 3) {
    const lt = lattice(1.3, 1.1);
    lt.position.set(-w * 0.28, h * 0.5, d / 2);
    g.add(lt);
  }
  // what stands on the roof
  if (o.chimney) {
    // a wind catcher: a square tower open to the breeze on every side
    const wc = windCatcher(0.9, o.roofH + 0.8);
    wc.position.set(w * 0.25, h, -d * 0.2);
    g.add(wc);
  } else if (grand && w >= 4) {
    const dm = domeOn(Math.min(1.1, w * 0.16), Math.min(1.6, w * 0.24), { color: o.roof === C.slate ? TURQ_DK : TURQ, drumH: 0.45, wins: 0, seg: 10 });
    dm.position.set(-w * 0.18, h, -d * 0.12);
    g.add(dm);
  } else if (humble) {
    // a shade of palm fronds on four poles
    const sh = new THREE.Group();
    const sw = Math.min(2.6, w * 0.5), sd = Math.min(2.2, d * 0.5);
    for (const x of [-sw / 2, sw / 2]) for (const z of [-sd / 2, sd / 2]) sh.add(cyl(0.05, 0.05, 1.2, PALM_WOOD, 4, x, 0, z));
    sh.add(box(sw + 0.4, 0.1, sd + 0.4, C.thatch, 0, 1.2, 0));
    for (let i = 0; i < 4; i++) sh.add(box(0.2, 0.06, sd + 0.6, i % 2 ? FROND_DK : FROND, -sw / 2 + (i + 0.5) * (sw / 4), 1.3, 0));
    sh.position.set(w * 0.15, h, -d * 0.1);
    g.add(sh);
  } else {
    const cols = STRIPES[Math.floor(r() * STRIPES.length)];
    const cw = Math.min(2.8, w * 0.55);
    for (const x of [-cw / 2, cw / 2]) g.add(cyl(0.05, 0.05, 1.3, CEDAR, 4, w * 0.12 + x, h, d * 0.25));
    const aw = awning(cw, Math.min(2.2, d * 0.5), cols, -0.12, false);
    aw.position.set(w * 0.12, h + 1.3, d * 0.25 - Math.min(2.2, d * 0.5));
    g.add(aw);
  }
  return g;
}

/** A wind catcher: a square tower on the roof, open on every side in tall slots, a little dome on top. */
function windCatcher(s: number, h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(s, h, s, SAND));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const slot = archMesh(s * 0.46, 0.9, 0.06, SHADOW);
    slot.position.set(Math.sin(a) * (s / 2 + 0.01), h - 1.05, Math.cos(a) * (s / 2 + 0.01));
    slot.rotation.y = a;
    g.add(slot);
  }
  g.add(box(s + 0.16, 0.12, s + 0.16, SAND_LT, 0, h, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(merlon(0.2, SAND, 0.2).translateX(x * s * 0.4).translateY(h + 0.1).translateZ(z * s * 0.4));
  const dm = domeOn(s * 0.34, s * 0.5, { drumH: 0, fin: 0.35 });
  dm.position.y = h + 0.12;
  g.add(dm);
  return g;
}

/**
 * An Oasis tower: a round bastion of sandstone on a darker plinth, bands of turquoise tile, lit slits,
 * a ring of pointed merlons, and (roofed) a kiosk of slender posts under a turquoise dome.
 */
export function oasisTower(r: number, h: number, o: { color?: number; roof?: number | null; merlons?: boolean; banner?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  const color = o.color ?? SAND;
  g.add(cyl(r, r * 1.1, h, color, 10));
  g.add(cyl(r * 1.16, r * 1.2, 0.6, SAND_DK, 10));
  for (const k of [0.42, 0.9]) g.add(cyl(r * 1.02 - k * r * 0.08, r * 1.03 - k * r * 0.08, 0.22, TURQ_DK, 10, 0, h * k - 0.3));
  g.add(cyl(r * 1.14, r * 1.1, 0.3, SAND_LT, 10, 0, h - 0.06));
  const nm = Math.max(6, Math.round(r * 4.5));
  if (o.merlons !== false) for (let i = 0; i < nm; i++) {
    const a = (i / nm) * Math.PI * 2;
    const m = merlon(Math.min(0.6, r * 0.34), color);
    m.position.set(Math.sin(a) * r * 0.98, h + 0.2, Math.cos(a) * r * 0.98);
    m.rotation.y = a;
    g.add(m);
  }
  for (const a of [0.3, 2.4, 4.4]) {
    const s = archMesh(0.34, 0.8, 0.1, C.window);
    s.userData.window = true;
    s.position.set(Math.sin(a) * r * 1.02, h * 0.6, Math.cos(a) * r * 1.02);
    s.rotation.y = a;
    g.add(s);
  }
  if (o.roof !== null && o.roof !== undefined) {
    // a kiosk on the tower top: slender posts under a turquoise dome
    const kr = r * 0.55;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.add(cyl(0.07, 0.08, 1.2, SAND_LT, 5, Math.sin(a) * kr, h + 0.2, Math.cos(a) * kr));
    }
    g.add(cyl(kr + 0.2, kr + 0.2, 0.18, SAND_LT, 10, 0, h + 1.4));
    const dm = domeOn(kr + 0.1, (kr + 0.1) * 1.5, { drumH: 0, color: TURQ, seg: 10 });
    dm.position.y = h + 1.56;
    g.add(dm);
    hangLamp(g, 0, h + 1.4, 0, 0.2, 0.8);
  }
  if (o.banner !== undefined) {
    // a long hanging banner down the tower's face, edged in gold
    const bw = r * 0.6, bh = h * 0.34;
    g.add(box(bw + 0.2, 0.08, 0.08, GOLD, 0, h - 0.5, r * 1.04));
    g.add(box(bw, bh, 0.04, o.banner, 0, h - 0.54 - bh, r * 1.04));
    g.add(cone(bw * 0.5, bh * 0.2, o.banner, 3, 0, h - 0.54 - bh, r * 1.04).rotateZ(Math.PI));
    g.add(box(bw * 0.3, bw * 0.3, 0.05, GOLD, 0, h - 0.54 - bh * 0.45, r * 1.06).rotateZ(Math.PI / 4));
  }
  return g;
}

/**
 * A slender lamp tower (the Oasis's "wind towers"): a tall shaft that tapers as it climbs, bands of tile,
 * one or two railed balconies on corbels, and at the top a lantern room of arches under a turquoise dome.
 * Origin at its foot; `bal` is where the (first) balcony's floor is.
 */
function lampTower(r: number, h: number, o: { bal?: number[]; dome?: number; banner?: number; star?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(r * 1.25, r * 1.35, 0.8, SAND_DK, 8));
  g.add(cyl(r * 0.8, r, h, SAND, 8, 0, 0.6));
  for (let k = 1; k <= 3; k++) g.add(cyl(r * (1 - k * 0.06) + 0.03, r * (1 - k * 0.06) + 0.04, 0.2, TURQ_DK, 8, 0, 0.6 + (h * k) / 4));
  for (let k = 0; k < 3; k++) archWin(g, 0, 1.8 + k * (h / 4), r * (0.97 - k * 0.05), 0.3, 0.6);
  for (const y of o.bal ?? [h * 0.62]) {
    const br = r * 0.9 + 0.55;
    g.add(cyl(br, r * 0.85, 0.5, SAND_LT, 8, 0, y - 0.45));
    g.add(cyl(br, br, 0.08, SAND_LT, 8, 0, y));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.add(box(0.07, 0.55, 0.07, CEDAR, Math.cos(a) * (br - 0.05), y, Math.sin(a) * (br - 0.05)));
    }
    g.add(mesh(new THREE.TorusGeometry(br - 0.05, 0.04, 3, 12).rotateX(Math.PI / 2), CEDAR).translateY(y + 0.55));
  }
  // the lantern room: six arches, a lamp burning within, a turquoise dome and a golden finial
  const top = h + 0.6, lr = r * 0.78;
  g.add(cyl(lr + 0.18, lr + 0.12, 0.2, SAND_LT, 8, 0, top));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(cyl(0.07, 0.07, 1.3, SAND_LT, 5, Math.sin(a) * lr, top + 0.2, Math.cos(a) * lr));
  }
  g.add(glass(new THREE.OctahedronGeometry(lr * 0.45, 0).scale(1, 1.4, 1).translate(0, top + 0.85, 0)));
  g.add(cyl(lr + 0.22, lr + 0.22, 0.16, SAND_LT, 8, 0, top + 1.5));
  const dm = domeOn(lr + 0.12, (lr + 0.12) * (o.dome ?? 1.7), { drumH: 0, seg: 10, star: o.star });
  dm.position.y = top + 1.64;
  g.add(dm);
  if (o.banner !== undefined) {
    const bh = h * 0.3;
    g.add(box(r * 0.9, bh, 0.04, o.banner, 0, (o.bal?.[0] ?? h * 0.62) - 0.6 - bh, r * 0.94));
    g.add(cone(r * 0.45, bh * 0.2, o.banner, 3, 0, (o.bal?.[0] ?? h * 0.62) - 0.6 - bh, r * 0.94).rotateZ(Math.PI));
  }
  return g;
}

// ---------- the other buildings ----------

/** An eight-pointed star laid in the paving (two squares of tile, one turned). */
function star8(g: THREE.Group, x: number, y: number, z: number, s: number, c1: number, c2: number): void {
  g.add(box(s, 0.03, s, c1, x, y, z));
  g.add(box(s, 0.03, s, c1, x, y, z).rotateY(Math.PI / 4));
  g.add(box(s * 0.45, 0.04, s * 0.45, c2, x, y + 0.01, z).rotateY(Math.PI / 4));
}

/** A practice post for the blade dancers: a straw-stuffed body on a cedar post, a head wound in an old turban, arms of wood. */
function practicePost(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.09, 1.9, CEDAR, 5));
  g.add(box(1.0, 0.1, 0.1, CEDAR, 0, 1.35, 0));
  g.add(blob(0.3, 0xd6b878, 0, 1.05, 0, 1, 1.4, 0.8));
  for (const y of [0.9, 1.2]) g.add(cyl(0.29, 0.29, 0.05, CEDAR_DK, 7, 0, y));
  g.add(blob(0.18, 0xd6b878, 0, 1.72, 0));
  g.add(blob(0.2, LINEN, 0, 1.84, 0, 1.08, 0.65, 1.08));
  return g;
}

/** A rack of scimitars and spears. */
function bladeRack(): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.9, 0.9]) g.add(box(0.1, 1.5, 0.1, CEDAR, x, 0, 0));
  g.add(box(2.0, 0.1, 0.12, CEDAR, 0, 1.4, 0));
  g.add(box(2.0, 0.08, 0.12, CEDAR, 0, 0.3, 0));
  for (let i = 0; i < 3; i++) g.add(scimitar(-0.55 + i * 0.3, 0.55, 0.1, 0.9, 0));
  for (let i = 0; i < 2; i++) {
    g.add(box(0.04, 1.9, 0.04, CEDAR_DK, 0.45 + i * 0.25, 0.1, 0.1));
    g.add(cone(0.06, 0.26, STEEL_OA, 5, 0.45 + i * 0.25, 2.0, 0.1));
  }
  return g;
}

/** Barracks: the guardhouse and the court of the blade dancers, paved round a star of tile, where two of them spar. */
function barracks(t: number, color: number, r: () => number): Built {
  const g = new THREE.Group();
  g.add(block(7, 3.4, 5, { wall: SAND, door: 1.3, wins: 2 }));
  if (t >= 2) {
    const lt = lattice(1.2, 1.0);
    lt.position.set(2.2, 1.9, 2.5);
    g.add(lt);
  }
  // the court
  const cz = 5.7;
  g.add(box(6.6, 0.08, 5.0, SAND_LT, 0, 0, cz));
  star8(g, 0, 0.08, cz, 1.6, TURQ_DK, WASH);
  for (const s of [-1, 1]) {
    g.add(box(0.36, 1.0, 4.6, SAND, s * 3.3, 0, cz));
    for (let k = 0; k < 4; k++) g.add(merlon(0.3, SAND, 0.36).translateX(s * 3.3).translateY(1.0).translateZ(cz - 1.7 + k * 1.15).rotateY(Math.PI / 2));
  }
  for (const s of [-1, 1]) {
    // gateposts at the court's mouth, each carrying a lantern
    g.add(box(0.6, 1.8, 0.6, SAND, s * 3.3, 0, 8.3));
    g.add(cone(0.36, 0.5, TURQ, 4, s * 3.3, 1.8, 8.3).rotateY(Math.PI / 4));
    hangLamp(g, s * 3.3, 1.72, 8.72, 0.1, 0.6);
  }
  // two blade dancers sparring in the court
  for (const s of [-1, 1]) {
    const d = djinnSoldier('sword');
    d.position.set(s * 0.9, 0.08, cz + 0.2);
    d.rotation.y = -s * Math.PI / 2;
    g.add(d);
  }
  const pp = practicePost();
  pp.position.set(-2.2, 0.08, cz + 1.6);
  g.add(pp);
  const rack = bladeRack();
  rack.position.set(1.8, 0.08, 3.5);
  g.add(rack);
  roundShieldProp(g, -2.5, 3.3, 0.4);
  roundShieldProp(g, -1.9, 3.25, -0.3);
  const aw = awning(2.4, 1.6, STRIPES[1], 0.3);
  aw.position.set(-2.0, 2.2, 3.05);
  g.add(aw);
  for (const x of [-3.0, -1.0]) g.add(cyl(0.05, 0.05, 2.0, CEDAR, 4, x, 0, 4.5));
  const j = jar(0.8, TERRA, true);
  j.position.set(2.7, 0.08, 7.4);
  g.add(j);
  if (t >= 2) {
    // the dancers' quarters: a whitewashed wing under a small dome, and the host's banner
    const wing = block(4.2, 2.8, 3.8, { wall: WASH, door: 0.9, wins: 1 });
    const dm = domeOn(0.9, 1.3, { drumH: 0.3, wins: 0, seg: 10 });
    dm.position.set(0, 2.8, 0);
    wing.add(dm);
    wing.position.set(-6.0, 0, 0.3);
    wing.rotation.y = Math.PI / 2;
    g.add(wing);
    g.add(standardPole(color, 5.2).translateX(3.9).translateZ(2.8));
  }
  if (t >= 3) {
    // a watch turret on the back corner, and lanterns along the court
    const tw = oasisTower(1.0, 5.4, { roof: TURQ });
    tw.position.set(3.1, 0, -2.1);
    g.add(tw);
    for (const s of [-1, 1]) hangLamp(g, s * 3.3, 1.0, cz, 0.05, 0.6);
    const d = kettleDrum(0.8);
    d.position.set(2.6, 0.08, 5.0);
    g.add(d);
  }
  void r;
  return { obj: g, h: 7.5, w: 9, d: 9 };
}

/** A round shield leaning against a wall. */
function roundShieldProp(g: THREE.Group, x: number, z: number, ry: number): void {
  const s = new THREE.Group();
  s.add(cyl(0.38, 0.38, 0.06, BRASS, 10).rotateX(Math.PI / 2 - 0.25));
  s.add(blob(0.1, GOLD, 0, 0, 0.06));
  s.position.set(x, 0.42, z);
  s.rotation.y = ry;
  g.add(s);
}

/** A tall standard: a gilt pole, the ruler's banner hanging from a crossbar, tassels and a golden lamp-finial. */
function standardPole(color: number, h: number, live = true): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.24, 0.3, 0.3, SAND_DK, 6));
  g.add(cyl(0.06, 0.08, h, GOLD_DK, 6, 0, 0.3));
  g.add(box(1.5, 0.08, 0.08, GOLD, 0, h - 0.4, 0));
  const cloth = new THREE.Group();
  cloth.add(box(1.3, 1.9, 0.05, color, 0, -1.9, 0));
  cloth.add(box(1.3, 0.14, 0.06, GOLD, 0, -0.24, 0));
  for (const x of [-0.43, 0, 0.43]) cloth.add(cone(0.22, 0.4, color, 3, x, -1.9, 0).rotateZ(Math.PI));
  cloth.add(box(0.32, 0.32, 0.06, GOLD, 0, -0.9, 0.03).rotateZ(Math.PI / 4));
  const c = live ? moving(cloth, { flag: true }) : cloth;
  c.position.set(0, h - 0.42, 0.06);
  g.add(c);
  for (const x of [-0.72, 0.72]) g.add(cone(0.05, 0.3, SAFFRON, 4, x, h - 0.72, 0).rotateX(Math.PI));
  const f = finial(0.7, true);
  f.position.y = h + 0.3;
  g.add(f);
  return g;
}

/** A kettle drum of brass, its head stretched hide. */
function kettleDrum(s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.5 * s, 9, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), BRASS).translateY(0.5 * s));
  g.add(cyl(0.52 * s, 0.52 * s, 0.05 * s, 0xe8d6b0, 9, 0, 0.5 * s));
  g.add(cyl(0.2 * s, 0.26 * s, 0.1 * s, BRASS, 7, 0, 0));
  g.add(cyl(0.53 * s, 0.53 * s, 0.06 * s, CRIMSON, 9, 0, 0.44 * s));
  return g;
}

/** A barrel vault running front to back (along z), l long and r wide, its crown at y = r. */
function vault(r: number, l: number, color: number): THREE.Mesh {
  return mesh(new THREE.CylinderGeometry(r, r, l, 8, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), color);
}

/** Stable: the camel yard. Vaulted stalls of sandstone, a shaded yard behind a low mud wall, a trough, saddles on a rail and the camels. */
function stable(t: number, r: () => number): Built {
  const g = new THREE.Group();
  g.add(box(9, 2.1, 4.6, SAND));
  g.add(box(9.16, 0.4, 4.76, SAND_DK));
  g.add(box(9.2, 0.14, 4.8, SAND_LT, 0, 2.05, 0));
  for (const x of [-3, 0, 3]) {
    const v = vault(1.45, 4.6, WASH);
    v.position.set(x, 2.1, 0);
    g.add(v);
    const st = archMesh(1.7, 2.0, 0.08, SHADOW);
    st.position.set(x, 0, 2.32);
    g.add(st);
    g.add(archMesh(2.05, 2.25, 0.06, SAND_LT).translateX(x).translateZ(2.28));
    g.add(box(0.1, 0.1, 4.6, TURQ_DK, x - 1.5, 2.2, 0));
  }
  g.add(box(0.1, 0.1, 4.6, TURQ_DK, 4.5, 2.2, 0));
  // the yard: a low wall of mud brick with rounded tops, and a gap to lead them in and out
  const wall = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const w = box(len, 0.9, 0.3, MUD, (x0 + x1) / 2, 0, (z0 + z1) / 2);
    w.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(w);
    const top = cyl(0.17, 0.17, len, MUD_DK, 5).rotateZ(Math.PI / 2);
    top.position.set((x0 + x1) / 2, 0.92, (z0 + z1) / 2);
    top.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(top);
  };
  wall(-4.2, 2.6, -4.2, 7.3);
  wall(4.2, 2.6, 4.2, 7.3);
  wall(-4.2, 7.3, -1.2, 7.3);
  wall(1.2, 7.3, 4.2, 7.3);
  // a striped shade over the back of the yard
  for (const x of [-3.6, 3.6]) g.add(cyl(0.06, 0.06, 2.4, CEDAR, 4, x, 0, 4.1));
  const aw = awning(7.6, 1.5, STRIPES[0], -0.1, false);
  aw.position.set(0, 2.62, 2.6);
  g.add(aw);
  // the trough, water in it, and bundles of fodder
  g.add(box(2.2, 0.5, 0.6, SAND_DK, 2.4, 0, 3.2));
  g.add(mesh(new THREE.BoxGeometry(2.0, 0.04, 0.42).translate(2.4, 0.46, 3.2), WATER_OA, { emissive: WATER_E }));
  for (let i = 0; i < 3; i++) g.add(cyl(0.25, 0.28, 0.5, 0xd8b868, 6, -3.3 + i * 0.55, 0, 3.2).rotateZ(Math.PI / 2 * (i % 2)));
  // saddles on a rail, their cloths in bright colours
  g.add(box(2.2, 0.08, 0.08, CEDAR, -1.6, 1.1, 3.0), box(0.08, 1.1, 0.08, CEDAR, -2.6, 0, 3.0), box(0.08, 1.1, 0.08, CEDAR, -0.6, 0, 3.0));
  for (let i = 0; i < 3; i++) g.add(box(0.5, 0.5, 0.06, [CRIMSON, TURQ_DK, SAFFRON][i], -2.2 + i * 0.6, 0.62, 3.04));
  const n = t === 1 ? 2 : t === 2 ? 3 : 4;
  for (let i = 0; i < n; i++) {
    const k = i % 3 === 2;
    const m = camel([CAMEL, CAMEL_LT, 0xa87a4a][i % 3], { kneel: k, blanket: i === 1 ? CRIMSON : undefined });
    m.userData.mount = true;
    m.position.set(-2.4 + i * 1.7, 0, 5.0 + (r() - 0.5) * 1.2);
    m.rotation.y = r() * Math.PI * 2;
    g.add(m);
  }
  if (t >= 3) for (const x of [-3.9, 3.9]) hangLamp(g, x, 2.3, 7.35, 0.05, 0.6);
  return { obj: g, h: 6, w: 10, d: 10 };
}

/**
 * A sun engine: a wheeled carriage carrying a great concave mirror of polished gold on a pivot, and on a
 * long arm before it a lens of turquoise glass that gathers the sun to a burning point.
 */
function sunEngine(s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.4 * s, 0.3 * s, 1.6 * s, CEDAR, 0, 0.5 * s, 0));
  for (const x of [-0.8, 0.8]) for (const z of [-0.85, 0.85]) g.add(cyl(0.42 * s, 0.42 * s, 0.14 * s, CEDAR_DK, 8, x * s, 0.42 * s, z * s).rotateX(Math.PI / 2));
  for (const z of [-0.6, 0.6]) g.add(limb(V(0, 0.8 * s, z * s), V(0, 2.0 * s, z * s * 0.9), 0.08 * s, 0.07 * s, BRASS, 5));
  const dish = new THREE.Group();
  const p = [[0.001, 0], [0.5, 0.05], [0.9, 0.18], [1.2, 0.38], [1.24, 0.44]];
  dish.add(mesh(new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x * s, y * s)), 12), GOLD));
  dish.add(cone(0.5 * s, 0.4 * s, BRASS, 8, 0, -0.38 * s));
  dish.add(mesh(new THREE.TorusGeometry(1.24 * s, 0.05 * s, 3, 16).rotateX(Math.PI / 2), BRASS).translateY(0.44 * s));
  dish.add(limb(V(0, 0.2 * s, 0), V(0, 1.7 * s, 0), 0.04 * s, 0.03 * s, BRASS, 4));
  dish.add(glow(new THREE.IcosahedronGeometry(0.2 * s, 1).scale(1, 0.45, 1).translate(0, 1.75 * s, 0), TURQ_LT, 0x1a8a8a));
  dish.add(mesh(new THREE.TorusGeometry(0.22 * s, 0.03 * s, 3, 10).rotateX(Math.PI / 2), GOLD).translateY(1.75 * s));
  dish.position.set(0, 2.0 * s, 0);
  dish.rotation.x = 1.0;
  g.add(dish);
  return g;
}

/** A brass ram: a wheeled frame under a striped canopy, its great beam capped with a brass lion's head. */
function brassRam(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.4, 0.24, 3.0, CEDAR, 0, 0.5, 0));
  for (const x of [-0.7, 0.7]) for (const z of [-1.05, 1.05]) {
    g.add(cyl(0.38, 0.38, 0.14, CEDAR_DK, 8, x * 1.08, 0.38, z).rotateZ(Math.PI / 2));
    g.add(cyl(0.06, 0.06, 1.8, CEDAR, 4, x * 0.85, 0.6, z * 1.1));
  }
  const cw = awning(1.9, 3.2, [TURQ_DK, LINEN], 0, true);
  cw.position.set(0, 2.45, -1.6);
  g.add(cw);
  const beam = cyl(0.24, 0.26, 3.4, CEDAR_DK, 8).rotateX(Math.PI / 2);
  beam.position.set(0, 1.3, -0.2);
  g.add(beam);
  for (const z of [-0.8, 0.6]) g.add(cyl(0.27, 0.27, 0.12, BRASS, 8, 0, 1.3, z).rotateX(Math.PI / 2));
  const head = lionHead(0.55, BRASS);
  head.position.set(0, 1.3, 1.6);
  g.add(head);
  return g;
}

/** A lion's head facing +z: a maned brow and a muzzle (brass on the rams, sandstone on the guardians). */
function lionHead(s: number, c: number, mane: number = c === BRASS ? GOLD_DK : SAND_DK): THREE.Group {
  const g = new THREE.Group();
  // a full, scalloped ruff of mane behind the face
  g.add(blob(0.66 * s, mane, 0, 0.02 * s, -0.16 * s, 1.05, 1.1, 0.7));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    g.add(blob(0.24 * s, mane, Math.cos(a) * 0.58 * s, Math.sin(a) * 0.6 * s, -0.08 * s, 1, 1, 0.8));
  }
  g.add(blob(0.44 * s, c, 0, 0, 0.14 * s, 1, 1.05, 0.95));
  g.add(blob(0.26 * s, c, 0, -0.17 * s, 0.5 * s, 1.15, 0.8, 0.9));
  g.add(box(0.14 * s, 0.1 * s, 0.1 * s, SHADOW, 0, -0.08 * s, 0.72 * s));
  for (const x of [-1, 1]) {
    g.add(glow(new THREE.OctahedronGeometry(0.07 * s, 0), EYE, EYE_E).translateX(x * 0.18 * s).translateY(0.1 * s).translateZ(0.52 * s));
    g.add(cone(0.1 * s, 0.18 * s, c, 4, x * 0.28 * s, 0.36 * s, 0.1 * s));
  }
  return g;
}

/** Workshop: the engine yard, an open hall on carved pillars under a striped awning, a sun engine within and a brass ram before it. */
function workshop(t: number, r: () => number): Built {
  const g = new THREE.Group();
  // the back wall with a great arch, tools hung on it
  g.add(box(7.6, 3.6, 0.5, SAND, 0, 0, -2.3));
  g.add(archMesh(2.6, 2.9, 0.1, SHADOW).translateZ(-2.02));
  g.add(box(7.8, 0.16, 0.7, SAND_LT, 0, 3.6, -2.3));
  for (let i = 0; i < 6; i++) g.add(merlon(0.44, SAND, 0.3).translateX(-3.3 + i * 1.32).translateY(3.72).translateZ(-2.3));
  g.add(box(7.64, 0.24, 0.06, TURQ_DK, 0, 2.6, -2.02));
  // the yard's low side walls, merloned
  for (const x of [-3.7, 3.7]) {
    g.add(box(0.4, 1.2, 4.4, SAND, x, 0, 0));
    for (let k = 0; k < 4; k++) g.add(merlon(0.34, SAND, 0.4).translateX(x).translateY(1.2).translateZ(-1.6 + k * 1.1).rotateY(Math.PI / 2));
  }
  // a striped shade on carved pillars over the workbench, the engine standing out in the sun
  for (const x of [-3.3, -0.3]) {
    g.add(cyl(0.18, 0.22, 3.0, SAND_LT, 8, x, 0, 0.9));
    g.add(box(0.5, 0.3, 0.5, SAND_DK, x, 0, 0.9));
    g.add(cyl(0.3, 0.2, 0.26, TURQ_DK, 8, x, 2.9, 0.9));
  }
  const shade = awning(3.8, 3.4, [TURQ_DK, LINEN], 0.09, true);
  shade.position.set(-1.8, 3.5, -2.3);
  g.add(shade);
  g.add(box(3.2, 0.9, 1.0, CEDAR, -1.8, 0, -1.2), box(3.3, 0.08, 1.1, CEDAR_DK, -1.8, 0.9, -1.2));
  const lens = new THREE.Group();
  lens.add(cyl(0.05, 0.05, 0.6, BRASS, 4));
  lens.add(glow(new THREE.IcosahedronGeometry(0.22, 1).scale(1, 1, 0.4).translate(0, 0.8, 0), TURQ_LT, 0x1a8a8a));
  lens.add(mesh(new THREE.TorusGeometry(0.24, 0.03, 3, 10), GOLD).translateY(0.8));
  lens.position.set(-2.4, 0.98, -1.2);
  g.add(lens);
  const eng = sunEngine(t >= 3 ? 1.15 : 1.0);
  eng.position.set(1.7, 0, -0.1);
  eng.rotation.y = -0.3;
  g.add(eng);
  // gears and brass sheet, crates and palm logs
  for (let i = 0; i < 3; i++) {
    const cog = mesh(new THREE.CylinderGeometry(0.34 - i * 0.07, 0.34 - i * 0.07, 0.1, 8), BRASS);
    cog.position.set(-1.4 + i * 0.32, 1.0 + i * 0.1, -1.3);
    g.add(cog);
  }
  g.add(box(1.0, 0.6, 0.7, CEDAR, -2.3, 0, 2.0), box(0.8, 0.5, 0.6, CEDAR_DK, -2.3, 0.6, 2.0));
  for (let i = 0; i < 4; i++) g.add(cyl(0.2, 0.2, 2.6, PALM_WOOD, 6, 5.0 + (i % 2) * 0.4, 0.2 + Math.floor(i / 2) * 0.36, 0.4 + (i % 2) * 0.1).rotateX(Math.PI / 2));
  if (t >= 2) {
    const ram = brassRam();
    ram.position.set(-1.2, 0, 4.3);
    ram.rotation.y = 0.3;
    g.add(ram);
  }
  if (t >= 3) {
    // a smaller mirror on a tripod, and a lamp for working into the night
    const tri = new THREE.Group();
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; tri.add(limb(V(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6), V(0, 1.6, 0), 0.04, 0.03, BRASS, 4)); }
    const m = mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.08, 10).rotateX(1.1), GOLD);
    m.position.y = 1.8;
    tri.add(m);
    tri.position.set(3.0, 0, 3.6);
    g.add(tri);
    hangLamp(g, -2.0, 3.3, 1.4, 0.3, 0.8);
  }
  void r;
  return { obj: g, h: 6, w: 9, d: 8 };
}

/** An armillary sphere of brass rings round a golden sun. */
function armillary(s: number): THREE.Group {
  const g = new THREE.Group();
  for (const [rx, rz] of [[Math.PI / 2, 0], [0, 0], [Math.PI / 2, Math.PI / 3], [Math.PI / 2, -Math.PI / 3]]) {
    const ring = mesh(new THREE.TorusGeometry(s, 0.05, 3, 20), BRASS);
    ring.rotation.set(rx, 0, rz);
    g.add(ring);
  }
  g.add(glow(new THREE.IcosahedronGeometry(s * 0.28, 0), 0xffe08a, 0xc08a1a));
  return g;
}

/** Academy: the House of Wisdom. A library of lamplit arches under a turquoise dome, and an observatory tower with an armillary sphere on its roof. */
function academy(r: () => number): Built {
  const g = new THREE.Group();
  const hall = block(10, 4.4, 6, { wall: WASH, door: 1.5, wins: 4, sideWins: true });
  g.add(hall);
  for (const x of [-3.2, 3.2]) {
    const lt = lattice(1.4, 1.0);
    lt.position.set(x, 2.6, 3.0);
    g.add(lt);
  }
  const dm = domeOn(1.9, 2.8, { drumH: 1.0, seg: 12, ribs: 6 });
  dm.position.set(-0.6, 4.4, -0.4);
  g.add(dm);
  for (const x of [-4.2, 3.2]) {
    const k = domeOn(0.6, 0.9, { drumH: 0, seg: 8, color: TURQ_DK, fin: 0.4 });
    for (const [px, pz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) g.add(cyl(0.06, 0.06, 1.0, SAND_LT, 4, x + px, 4.5, 1.8 + pz));
    g.add(box(1.4, 0.12, 1.4, SAND_LT, x, 5.5, 1.8));
    k.position.set(x, 5.6, 1.8);
    g.add(k);
  }
  // the observatory tower
  const tw = new THREE.Group();
  tw.add(cyl(1.4, 1.62, 9.4, SAND, 10));
  tw.add(cyl(1.75, 1.75, 0.6, SAND_DK, 10));
  for (const y of [3.2, 6.6]) tw.add(cyl(1.58 - y * 0.02, 1.6 - y * 0.02, 0.24, TURQ_DK, 10, 0, y));
  archWin(tw, 0, 5.0, 1.52);
  archWin(tw, 0, 7.4, 1.46);
  tw.add(cyl(2.0, 1.4, 0.5, SAND_LT, 10, 0, 9.0));
  tw.add(cyl(2.0, 2.0, 0.08, SAND_LT, 10, 0, 9.5));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    tw.add(merlon(0.34, SAND, 0.2).translateX(Math.sin(a) * 1.9).translateY(9.5).translateZ(Math.cos(a) * 1.9).rotateY(a));
  }
  const arm = moving(armillary(0.9), { orbit: 0.35 });
  arm.position.set(0, 11.0, 0);
  tw.add(arm);
  tw.add(cyl(0.1, 0.16, 1.1, BRASS, 5, 0, 9.5));
  tw.position.set(6.2, 0, 0);
  g.add(tw);
  // the garden before it: a fountain and palms in glazed pots
  const f = fountain(0.9);
  f.position.set(-2.6, 0, 4.4);
  g.add(f);
  for (const x of [-4.4, 1.6]) {
    const p = pottedPalm(2.2, r);
    p.position.set(x, 0, 3.9);
    g.add(p);
  }
  return { obj: g, h: 18, w: 14, d: 8 };
}

/** A beehive kiln: a whitewashed dome, a chimney breathing smoke, its mouth glowing. */
function beehiveKiln(s = 1, wall: number = WASH_SH): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(1.3 * s, 1.4 * s, 0.4 * s, SAND_DK, 10));
  g.add(mesh(new THREE.SphereGeometry(1.25 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), wall).translateY(0.35 * s));
  g.add(cyl(0.22 * s, 0.28 * s, 1.0 * s, wall, 6, 0, 1.4 * s));
  g.add(archMesh(0.8 * s, 0.9 * s, 0.1, SAND_DK).translateY(0.1).translateZ(1.16 * s));
  g.add(glow(new THREE.BoxGeometry(0.56 * s, 0.5 * s, 0.1).translate(0, 0.35 * s, 0), COAL, COAL_E).translateZ(1.2 * s));
  const smoke = new THREE.Object3D();
  smoke.userData.dynamic = true;
  smoke.userData.smoke = true;
  smoke.position.set(0, 2.5 * s, 0);
  g.add(smoke);
  return g;
}

/** Smithy: the brass workshop. Two arches open on a forge glowing within, a beehive kiln, an anvil, and brass trays, pots and lamps hung out on racks. */
function smithy(t: number): Built {
  const g = new THREE.Group();
  g.add(block(6, 3.2, 5, { wall: SAND, door: null, wins: 0 }));
  for (const x of [-1.4, 1.4]) {
    g.add(archMesh(1.7, 2.3, 0.1, SHADOW).translateX(x).translateZ(2.52));
    g.add(archMesh(2.0, 2.5, 0.06, SAND_LT).translateX(x).translateZ(2.5));
    g.add(glow(new THREE.BoxGeometry(1.1, 0.5, 0.06).translate(0, 0.35, 0), COAL, COAL_E).translateX(x).translateZ(2.6));
  }
  // the chimney
  g.add(box(1.0, 3.2, 1.0, SAND_DK, 1.8, 3.2, -1.2));
  g.add(box(1.2, 0.2, 1.2, TURQ_DK, 1.8, 6.4, -1.2));
  const smoke = new THREE.Object3D();
  smoke.userData.dynamic = true;
  smoke.userData.smoke = true;
  smoke.position.set(1.8, 6.8, -1.2);
  g.add(smoke);
  const k = beehiveKiln(0.85);
  k.position.set(-2.3, 0, 3.4);
  g.add(k);
  // the anvil, a tray of brass on it being beaten out
  g.add(box(0.5, 0.5, 0.5, SAND_DK, 0.6, 0, 3.6));
  g.add(box(0.8, 0.24, 0.36, IRON_OA, 0.6, 0.5, 3.6));
  g.add(cone(0.14, 0.34, IRON_OA, 4, 1.15, 0.57, 3.6).rotateZ(-Math.PI / 2));
  g.add(cyl(0.34, 0.34, 0.03, GOLD, 10, 0.6, 0.76, 3.6));
  // a rack of brass wares: trays, pots and lamps
  const rack = new THREE.Group();
  for (const x of [-0.9, 0.9]) rack.add(box(0.1, 2.0, 0.1, CEDAR, x, 0, 0));
  rack.add(box(2.0, 0.1, 0.1, CEDAR, 0, 1.9, 0));
  for (let i = 0; i < 3; i++) rack.add(cyl(0.3, 0.3, 0.04, i % 2 ? GOLD : BRASS, 10, -0.55 + i * 0.55, 1.3, 0.06).rotateX(Math.PI / 2));
  for (let i = 0; i < 2; i++) { const l = lantern(0.7, 0.2); l.position.set(-0.3 + i * 0.6, 1.5, 0.1); rack.add(l); }
  rack.position.set(2.6, 0, 3.4);
  rack.rotation.y = -0.3;
  g.add(rack);
  for (let i = 0; i < 3; i++) { const j = jar(0.6, i % 2 ? BRASS : GOLD_DK, true); j.position.set(-0.4 + i * 0.5, 0, 4.6); g.add(j); }
  if (t >= 2) {
    const br = bladeRack();
    br.scale.setScalar(0.8);
    br.position.set(-3.6, 0, 1.2);
    br.rotation.y = Math.PI / 2;
    g.add(br);
  }
  if (t >= 3) {
    // the master's work: a great brass gong in a cedar frame
    const gf = new THREE.Group();
    for (const x of [-0.9, 0.9]) gf.add(box(0.14, 2.4, 0.14, CEDAR_DK, x, 0, 0));
    gf.add(box(2.1, 0.16, 0.16, CEDAR_DK, 0, 2.3, 0));
    gf.add(cyl(0.72, 0.72, 0.08, GOLD, 14, 0, 1.3, 0).rotateX(Math.PI / 2));
    gf.add(blob(0.2, GOLD_DK, 0, 1.3, 0.06, 1, 1, 0.4));
    gf.position.set(0.3, 0, -3.2);
    g.add(gf);
  }
  return { obj: g, h: 8, w: 8, d: 7 };
}

/** Rally point: the war council under the stars. The ruler's standard, a fire in a brass bowl, rugs and cushions in a ring, and kettle drums. */
function rally(color: number): Built {
  const g = new THREE.Group();
  g.add(standardPole(color, 7.2));
  g.add(brazier(0.7, true, 1.1).translateX(2.6).translateZ(1.6));
  const rg = rug(3.4, 2.4, CRIMSON, INDIGO, SAFFRON);
  rg.position.set(2.6, 0.02, 1.6);
  rg.rotation.y = 0.2;
  g.add(rg);
  for (const [x, z, c] of [[1.2, 3.1, TURQ_DK], [3.9, 2.9, SAFFRON], [4.2, 0.5, CRIMSON], [1.1, 0.2, INDIGO]] as [number, number, number][]) g.add(cushion(x, z, c));
  for (const [x, z] of [[-0.8, 1.6], [0.2, 2.6]] as [number, number][]) { const d = kettleDrum(0.7); d.position.set(x, 0, z); g.add(d); }
  g.add(lampPost(2.6, 0.9).translateX(4.6).translateZ(-0.4));
  return { obj: g, h: 10, w: 6, d: 6 };
}

/** The statue: the Djinn in gilded bronze, rising from his lamp on a plinth of carved sandstone, braziers at its foot. */
function statue(): Built {
  const g = new THREE.Group();
  g.add(cyl(2.3, 2.45, 0.4, SAND_DK, 8));
  g.add(cyl(1.9, 2.0, 0.3, SAND_LT, 8, 0, 0.4));
  g.add(cyl(1.3, 1.45, 1.5, SAND, 8, 0, 0.7));
  g.add(cyl(1.47, 1.47, 0.24, TURQ_DK, 8, 0, 1.4));
  g.add(cyl(1.55, 1.35, 0.3, SAND_LT, 8, 0, 2.2));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const w = archMesh(0.5, 0.8, 0.06, TURQ);
    w.position.set(Math.sin(a) * 1.32, 0.78, Math.cos(a) * 1.32);
    w.rotation.y = a;
    g.add(w);
  }
  // the lamp, and the Djinn rising from its spout in a column of smoke
  const BRZ = 0xb8893a, BRZ_DK = 0x8a6428;
  const lamp = new THREE.Group();
  lamp.add(blob(0.62, BRZ, 0, 0.3, 0, 1.55, 0.62, 1.0));
  lamp.add(cyl(0.3, 0.42, 0.22, BRZ_DK, 8));
  lamp.add(blob(0.24, BRZ, -0.1, 0.62, 0, 1, 0.7, 1));
  lamp.add(mesh(new THREE.TorusGeometry(0.34, 0.07, 4, 10, Math.PI), BRZ_DK).translateX(-0.95).translateY(0.3).rotateZ(Math.PI / 2));
  lamp.add(limb(V(0.7, 0.32, 0), V(1.25, 0.72, 0), 0.14, 0.06, BRZ, 6));
  lamp.position.y = 2.5;
  g.add(lamp);
  const fig = djinnHero();
  // (he rises from the great lamp itself, so the little one in his hand is left off)
  for (const c of [...fig.children]) if (c.position.x > 0.61 && c.position.y < 1.05) fig.remove(c);
  fig.traverse((o) => {
    // cast in bronze: every colour of the living djinn turned to metal (the eyes and the lamp's glow stay lit)
    if (o instanceof THREE.Mesh && !(o.material as THREE.Material).userData.noShadow) o.material = mat(o.position.y < 1.0 ? BRZ_DK : BRZ);
  });
  fig.scale.setScalar(1.25);
  fig.position.set(0.05, 2.62, 0);
  g.add(fig);
  // a real wisp of blue smoke curling from the spout
  const w = glow(new THREE.IcosahedronGeometry(0.2, 0), SMOKE_C, SMOKE_E);
  w.position.set(1.3, 3.35, 0);
  g.add(w);
  for (const x of [-1, 1]) {
    const b = brazier(0.8, false, 0.7);
    b.position.set(x * 1.8, 0, 1.8);
    g.add(b);
  }
  return { obj: g, h: 8.4, w: 5, d: 5 };
}

/** A spice heap in a woven basket. */
function spiceBasket(x: number, z: number, c: number, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.32 * s, 0.26 * s, 0.3 * s, 0xa8844a, 8));
  g.add(cone(0.3 * s, 0.34 * s, c, 8, 0, 0.3 * s));
  g.position.set(x, 0, z);
  return g;
}

/**
 * A bazaar stall: cedar posts and a counter under a striped awning, a rug hung at its back, and its wares:
 * spice heaps, pots and jars, rugs, lamps (lit at night) or fruit.
 */
function bazaarStall(cols: number[], ware: 'spice' | 'pots' | 'rugs' | 'lamps' | 'fruit', r: () => number): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-1.1, 1.1]) for (const z of [-0.7, 0.7]) g.add(cyl(0.05, 0.05, z < 0 ? 2.4 : 2.0, CEDAR, 4, x, 0, z));
  const aw = awning(2.6, 1.9, cols, 0.22);
  aw.position.set(0, 2.42, -0.95);
  g.add(aw);
  g.add(box(2.2, 0.8, 0.7, CEDAR, 0, 0, 0.45));
  g.add(box(2.3, 0.06, 0.8, CEDAR_DK, 0, 0.8, 0.45));
  g.add(rug(1.4, 1.8, cols[0], INDIGO, SAFFRON).rotateX(Math.PI / 2).translateY(-0.72).translateZ(-1.4));
  switch (ware) {
    case 'spice':
      for (let i = 0; i < 4; i++) g.add(spiceBasket(-0.8 + i * 0.54, 0.45, SPICES[(i + Math.floor(r() * 6)) % SPICES.length], 0.7).translateY(0.84));
      for (let i = 0; i < 3; i++) g.add(spiceBasket(-0.7 + i * 0.7, 1.25, SPICES[(i * 2 + 1) % SPICES.length], 0.9));
      break;
    case 'pots':
      for (let i = 0; i < 4; i++) { const j = jar(0.45, [TERRA, TURQ_DK, WASH_SH, TERRA_DK][i], true); j.position.set(-0.75 + i * 0.5, 0.84, 0.45); g.add(j); }
      for (let i = 0; i < 3; i++) { const j = jar(0.85, [TURQ, TERRA, SAND_DK][i], true); j.position.set(-0.8 + i * 0.8, 0, 1.3); g.add(j); }
      break;
    case 'rugs':
      for (let i = 0; i < 3; i++) { const rr = rolledRug(1.6, [CRIMSON, INDIGO, TURQ_DK][i], [SAFFRON, LINEN, GOLD][i]); rr.position.set(-0.8, 0.84 + 0.16 + i * 0.3, 0.3 + (i % 2) * 0.1); rr.rotation.y = 0.1 * i; g.add(rr); }
      g.add(rug(1.6, 1.1, PLUM, SAFFRON, TURQ).translateX(0.2).translateZ(1.4));
      break;
    case 'lamps':
      for (let i = 0; i < 4; i++) hangLamp(g, -0.9 + i * 0.6, 2.1, 0.55, 0.1 + (i % 2) * 0.25, 0.6);
      for (let i = 0; i < 3; i++) { const lp = new THREE.Group(); lp.add(blob(0.12, GOLD, 0, 0.08, 0, 1.6, 0.6, 1)); lp.add(cone(0.03, 0.2, GOLD, 4, 0.16, 0.08, 0).rotateZ(-1.2)); lp.position.set(-0.6 + i * 0.6, 0.84, 0.45); g.add(lp); }
      break;
    case 'fruit':
      for (let i = 0; i < 4; i++) g.add(blob(0.24, [0x6a9a3a, DATES, 0xe8a030, 0x9a2a3a][i], -0.75 + i * 0.5, 1.0, 0.45, 1, 0.6, 1));
      for (let i = 0; i < 5; i++) g.add(blob(0.28, 0x6a9a3a, -0.9 + i * 0.45, 0.2, 1.2, 1.2, 0.8, 1));
      break;
  }
  return g;
}

/** Market: the bazaar. Stalls under striped awnings (spices, pots, rugs, lamps, dates), rugs hung on a rail, and a camel caravan unloading. */
function market(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const wares: ('spice' | 'pots' | 'rugs' | 'lamps' | 'fruit')[] = ['spice', 'pots', 'rugs', 'lamps', 'fruit'];
  const spots: [number, number, number][] = [[-2.9, -0.8, 0.2], [0.4, -2.9, -0.1], [3.4, -0.7, -0.3], [-0.5, 1.8, 0.05], [3.3, 2.5, -0.5]];
  const n = Math.min(5, t + 1);
  for (let i = 0; i < n; i++) {
    const s = bazaarStall(STRIPES[i % STRIPES.length], wares[i], r);
    s.position.set(spots[i][0], 0, spots[i][1]);
    s.rotation.y = spots[i][2];
    g.add(s);
  }
  // a rail of rugs hung out for sale
  const rail = new THREE.Group();
  for (const x of [-1.3, 1.3]) rail.add(cyl(0.05, 0.05, 2.2, CEDAR, 4, x, 0, 0));
  rail.add(box(2.8, 0.07, 0.07, CEDAR, 0, 2.1, 0));
  for (let i = 0; i < 3; i++) rail.add(rug(0.8, 1.7, [CRIMSON, INDIGO, TURQ_DK][i], [SAFFRON, LINEN, GOLD][i], [INDIGO, CRIMSON, SAFFRON][i]).rotateX(Math.PI / 2).translateX(-0.85 + i * 0.85).translateY(0).translateZ(-1.2));
  rail.position.set(-4.3, 0, -1.8);
  rail.rotation.y = Math.PI / 2;
  g.add(rail);
  for (let i = 0; i < 4; i++) { const j = jar(0.8, [TERRA, TURQ_DK, TERRA_DK, WASH_SH][i], true); j.position.set(4.4 + (i % 2) * 0.55, 0, -3.0 + Math.floor(i / 2) * 0.6); g.add(j); }
  g.add(spiceBasket(-4.2, 2.4, SPICES[0]), spiceBasket(-3.6, 2.9, SPICES[1]), spiceBasket(-4.3, 3.2, SPICES[2]));
  if (t >= 2) {
    // the caravan in: a camel laden with bales, another kneeling to be unloaded
    const c1 = camel(CAMEL, { blanket: SAFFRON });
    for (const z of [-0.5, 0.5]) c1.add(blob(0.3, 0xd8c08a, -0.1, 1.55, z, 1.1, 1, 0.8));
    c1.position.set(1.0, 0, 4.0);
    c1.rotation.y = -0.2;
    g.add(c1);
    const c2 = camel(CAMEL_LT, { kneel: true, blanket: CRIMSON });
    c2.position.set(-2.4, 0, 3.9);
    c2.rotation.y = 0.4;
    g.add(c2);
    for (let i = 0; i < 3; i++) g.add(blob(0.3, 0xd8c08a, -4.6 + (i % 2) * 0.5, 0.25, 0.9 + i * 0.55, 1.1, 0.8, 1));
  }
  if (t >= 4) {
    // lanterns strung across the lanes
    for (let i = 0; i < 6; i++) {
      const k = i / 5;
      hangLamp(g, -3.2 + k * 6.4, 3.25 - Math.sin(k * Math.PI) * 0.35, 0.5, 0.05, 0.55);
    }
    g.add(box(6.8, 0.03, 0.03, CEDAR_DK, 0, 3.2, 0.5));
    for (const x of [-3.5, 3.5]) g.add(cyl(0.06, 0.07, 3.4, CEDAR, 5, x, 0, 0.5));
  }
  return { obj: g, h: 5.5, w: 10, d: 8 };
}

/** A domed granary: a round silo of whitewashed mud, a ladder up to its hatch. */
function silo(s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(1.4 * s, 1.55 * s, 2.8 * s, WASH_SH, 10));
  g.add(cyl(1.62 * s, 1.62 * s, 0.4 * s, SAND_DK, 10));
  g.add(mesh(new THREE.SphereGeometry(1.42 * s, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.2, 1), WASH_SH).translateY(2.8 * s));
  g.add(cyl(0.3 * s, 0.34 * s, 0.3 * s, SAND_DK, 7, 0, 4.4 * s));
  g.add(archMesh(0.8 * s, 1.3 * s, 0.08, CEDAR).translateZ(1.52 * s));
  const lad = new THREE.Group();
  for (const x of [-0.25, 0.25]) lad.add(box(0.07, 3.6 * s, 0.07, CEDAR, x, 0, 0));
  for (let y = 0.4; y < 3.4 * s; y += 0.5) lad.add(box(0.5, 0.05, 0.05, CEDAR, 0, y, 0));
  lad.rotation.x = -0.22;
  lad.position.set(1.0 * s, 0, 1.3 * s);
  lad.rotation.y = 0.5;
  g.add(lad);
  return g;
}

/** Warehouse: the storehouse. A long hall of sandstone under a row of little domes, great cedar doors, and stores piled before it. */
function warehouse(t: number, r: () => number): Built {
  const g = new THREE.Group();
  g.add(block(8, 3.7, 6, { wall: SAND, door: null, wins: 0, band: TURQ_DK }));
  for (const x of [-2.6, 0, 2.6]) {
    const dm = domeOn(1.05, 1.3, { drumH: 0.35, wins: 0, seg: 10, onion: 0, color: x === 0 ? TURQ : WASH_SH, fin: 0.45 });
    dm.position.set(x, 3.7, -0.2);
    g.add(dm);
  }
  // the great door
  g.add(archMesh(3.3, 3.2, 0.12, SAND_LT).translateZ(3.02));
  g.add(archMesh(2.9, 2.95, 0.08, TURQ_DK).translateZ(3.08));
  g.add(archMesh(2.6, 2.75, 0.06, SHADOW).translateZ(3.12));
  for (const s of [-1, 1]) {
    g.add(box(1.22, 2.1, 0.08, CEDAR, s * 0.64, 0, 3.16));
    for (let k = 0; k < 4; k++) g.add(box(0.08, 0.08, 0.04, GOLD, s * 0.64, 0.3 + k * 0.5, 3.22));
  }
  // stores: sacks, jars in rows, crates and rolled rugs
  for (let i = 0; i < 3 + t; i++) g.add(blob(0.36, i % 2 ? 0xd8c08a : 0xc8a870, 4.6 + (i % 2) * 0.72, 0.3 + Math.floor(i / 4) * 0.5, 2.5 - (Math.floor(i / 2) % 2) * 0.8, 1.05, 0.8, 1));
  for (let i = 0; i < 4 + t; i++) { const j = jar(0.85, i % 3 === 0 ? TURQ_DK : TERRA, true); j.position.set(-4.7 + (i % 2) * 0.62, 0, 2.6 - Math.floor(i / 2) * 0.7); g.add(j); }
  const rr = rolledRug(1.6, CRIMSON, SAFFRON);
  rr.position.set(-2.2, 0.16, 4.0);
  g.add(rr);
  if (t >= 2) {
    const s1 = silo(0.95);
    s1.position.set(-2.2, 0, -5.8);
    g.add(s1);
    const s2 = silo(0.8);
    s2.position.set(1.6, 0, -5.6);
    g.add(s2);
  }
  if (t >= 3) {
    const aw = awning(3.2, 1.8, STRIPES[0], 0.3);
    aw.position.set(4.8, 2.4, 1.0);
    g.add(aw);
    for (const z of [2.7]) for (const x of [3.4, 6.2]) g.add(cyl(0.05, 0.05, 2.1, CEDAR, 4, x, 0, z));
    hangLamp(g, 0, 3.55, 3.3, 0.05, 0.7);
  }
  void r;
  return { obj: g, h: 8, w: 10, d: 8 };
}

/** Hiding place: an old cistern under the sand. A little well-head of sandstone, its cedar lid ajar, a rug thrown over half of it and jars about. */
function hiding(t: number, r: () => number): Built {
  const g = new THREE.Group();
  g.add(cyl(1.0, 1.1, 0.55, SAND, 8));
  g.add(cyl(1.08, 1.08, 0.1, TURQ_DK, 8, 0, 0.5));
  const lid = cyl(0.85, 0.85, 0.1, CEDAR, 8, 0, 0.6, 0.15);
  lid.rotation.x = -0.18;
  g.add(lid);
  g.add(box(0.3, 0.06, 0.1, GOLD, 0, 0.72, 0.8));
  const rg = rug(1.3, 1.1, CRIMSON, INDIGO, SAFFRON);
  rg.position.set(-0.7, 0.62, -0.1);
  rg.rotation.z = 0.25;
  g.add(rg);
  for (let i = 0; i < 2 + t; i++) { const j = jar(0.6, i % 2 ? TERRA : WASH_SH); j.position.set(1.0 + (i % 2) * 0.4, 0, -0.9 + Math.floor(i / 2) * 0.55); g.add(j); }
  for (let i = 0; i < 3; i++) g.add(mesh(leafGeo(1.0, 0.3), FROND_DK).translateX(-1.4 + r() * 0.4).translateY(0.06).translateZ(0.6 + i * 0.3).rotateY(r() * 3));
  if (t >= 2) {
    // an old palm shading it
    const p = palm(3.6, r, { dates: true });
    p.position.set(-1.3, 0, -1.2);
    g.add(p);
  }
  return { obj: g, h: 2.6, w: 3, d: 3 };
}

/**
 * Watchtower: a slender wind tower. A shaft of sandstone that rises in stages banded with tile, lit slits
 * climbing it, a railed cedar balcony near the top for the lookout, and above it a lantern room open to the
 * wind under a turquoise dome, the ruler's pennant flying from its finial.
 */
function watchtower(t: number, color: number): Built {
  const g = new THREE.Group();
  const h = 7 + t * 1.6;
  const py = h * 0.9;
  g.add(box(3.0, 1.2, 3.0, SAND_DK));
  g.add(cyl(1.25, 1.5, py - 0.4, SAND, 8, 0, 1.0));
  for (let k = 1; k <= 3; k++) g.add(cyl(1.5 - (k * 0.25) / 3 + 0.02, 1.5 - (k * 0.25) / 3 + 0.03, 0.22, TURQ_DK, 8, 0, 1.0 + ((py - 1.2) * k) / 4));
  for (let k = 0; k < 3; k++) archWin(g, 0, 2.0 + k * ((py - 3) / 3), 1.46 - k * 0.07, 0.34, 0.7);
  archWin(g, 1.44, 3.4, 0, 0.34, 0.7, Math.PI / 2);
  // the balcony
  g.add(cyl(1.95, 1.3, 0.6, SAND_LT, 8, 0, py - 0.6));
  g.add(cyl(1.95, 1.95, 0.1, SAND_LT, 8, 0, py));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.add(box(0.07, 0.62, 0.07, CEDAR, Math.cos(a) * 1.88, py + 0.1, Math.sin(a) * 1.88));
  }
  g.add(mesh(new THREE.TorusGeometry(1.88, 0.05, 3, 16).rotateX(Math.PI / 2), CEDAR).translateY(py + 0.72));
  // the lantern room open to the wind
  g.add(cyl(1.15, 1.2, 0.3, SAND, 8, 0, py + 0.1));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(cyl(0.09, 0.09, 1.8, SAND_LT, 5, Math.sin(a) * 1.0, py + 0.4, Math.cos(a) * 1.0));
  }
  g.add(glass(new THREE.OctahedronGeometry(0.45, 0).scale(1, 1.4, 1).translate(0, py + 1.25, 0)));
  g.add(cyl(1.3, 1.2, 0.3, SAND_LT, 8, 0, py + 2.2));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    g.add(merlon(0.34, SAND, 0.2).translateX(Math.sin(a) * 1.18).translateY(py + 2.5).translateZ(Math.cos(a) * 1.18).rotateY(a));
  }
  const dm = domeOn(0.95, 1.6, { drumH: 0.3, wins: 0, seg: 10 });
  dm.position.y = py + 2.5;
  g.add(dm);
  const top = py + 2.5 + 0.3 + 1.6;
  const pp = new THREE.Group();
  pp.add(box(1.2, 0.5, 0.04, color, 0.6, 0, 0));
  pp.add(cone(0.25, 0.5, color, 3, 1.4, -0.25, 0).rotateZ(-Math.PI / 2));
  const pen = moving(pp, { flag: true });
  pen.position.set(0, top + 0.8, 0);
  g.add(pen);
  g.add(cyl(0.035, 0.035, 1.4, GOLD, 4, 0, top));
  return { obj: g, h: h + 7, w: 4, d: 4 };
}

// ---------- the workplaces out in the sand ----------

/** The Oasis's mark at a workplace: a brass lamp-post flying a teal pennant. */
export function oasisPost(h: number): THREE.Group {
  return lampPost(h, 0.9, TURQ);
}

/** Palm logs heaped in a pyramid, their cut ends pale. */
function palmLogs(n: number): THREE.Group {
  const g = new THREE.Group();
  let i = 0;
  for (let row = 0; i < n; row++) {
    const inRow = Math.max(1, 4 - row);
    for (let k = 0; k < inRow && i < n; k++, i++) {
      const lg = cyl(0.24, 0.24, 2.6, PALM_WOOD, 7).rotateX(Math.PI / 2);
      lg.position.set(-((inRow - 1) * 0.5) / 2 + k * 0.5, 0.24 + row * 0.42, 0);
      g.add(lg);
      for (const z of [-1.31, 1.31]) g.add(cyl(0.2, 0.2, 0.02, 0xd8b884, 7, lg.position.x, lg.position.y, z).rotateX(Math.PI / 2));
    }
  }
  return g;
}

/** Cedar planks stacked in a crib. */
function planks(n: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) g.add(box(2.6, 0.13, 0.7, i % 2 ? CEDAR : 0xa8784a, 0, 0.1 + i * 0.14, (i % 3) * 0.02));
  for (const x of [-1.1, 1.1]) g.add(box(0.12, 0.12, 0.9, CEDAR_DK, x, 0, 0));
  return g;
}

/**
 * Timber camp: the palm grove. Date palms stand in a crescent behind the camp and come down as it grows,
 * leaving their stumps; palm logs are heaped by the track; a shade of fronds, then a woodcutters' hut, a saw
 * over a pit, a camel dragging logs on a sledge, a tripod hoist, a mill whose saw a camel turns walking
 * its circle, and at last the woodcutters' lodge.
 */
function timberCamp(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const n = 16 - t;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.28 - r() * Math.PI * 0.66, d = 7 + r() * 4.2;
    const p = palm(4.2 + r() * 1.8, r);
    p.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    g.add(p);
  }
  for (let i = 0; i < 2 + t; i++) {
    const a = -Math.PI * 0.1 - r() * Math.PI * 0.8, d = 3.6 + r() * 3.8;
    g.add(cyl(0.2, 0.24, 0.5, PALM_WOOD, 6, Math.cos(a) * d, 0, Math.sin(a) * d));
    g.add(cyl(0.18, 0.18, 0.02, 0xd8b884, 6, Math.cos(a) * d, 0.5, Math.sin(a) * d));
  }
  const piles = Math.min(4, 1 + Math.floor(t * 0.6));
  for (let i = 0; i < piles; i++) {
    const p = palmLogs(3 + Math.min(5, t));
    p.position.set(-3.6 + i * 2.3, 0, 3.6 + (i % 2) * 1.2);
    p.rotation.y = Math.PI / 2 + 0.12 * i;
    g.add(p);
  }
  // fronds cut and bundled
  for (let i = 0; i < 3; i++) g.add(mesh(leafGeo(1.6, 0.4), i % 2 ? FROND_DK : FROND).translateX(2.2 + i * 0.3).translateY(0.08).translateZ(1.2 + i * 0.25).rotateY(0.4 + i * 0.2));
  if (t <= 2) {
    const sh = new THREE.Group();
    for (const x of [-1, 1]) for (const z of [-0.8, 0.8]) sh.add(cyl(0.06, 0.07, 1.9, PALM_WOOD, 4, x, 0, z));
    sh.add(box(2.6, 0.08, 2.2, C.thatch, 0, 1.9, 0));
    for (let i = 0; i < 5; i++) sh.add(box(0.26, 0.05, 2.5, i % 2 ? FROND_DK : FROND, -1.1 + i * 0.55, 1.98, 0));
    sh.position.set(-4.6, 0, -0.4);
    g.add(sh);
  }
  if (t >= 2) {
    const hut = oasisHouse({ w: 4.2, d: 3.4, h: 2.3, roofH: 1.6, roof: C.thatch, windows: 1 });
    hut.position.set(-6.3, 0, -1.4);
    hut.rotation.y = 0.5;
    g.add(hut);
  }
  if (t >= 3) {
    // a log over the saw pit on trestles, the long saw standing in it
    const pit = new THREE.Group();
    pit.add(box(1.4, 0.06, 3.0, SHADOW, 0, 0, 0));
    for (const z of [-1.1, 1.1]) pit.add(box(1.6, 0.8, 0.16, CEDAR_DK, 0, 0, z));
    pit.add(cyl(0.26, 0.26, 3.4, PALM_WOOD, 7, 0, 0.98, 0).rotateX(Math.PI / 2));
    pit.add(box(0.05, 1.8, 0.3, STEEL_OA, 0.1, 0.2, 0.3));
    pit.position.set(2.4, 0, 4.2);
    pit.rotation.y = Math.PI / 2;
    g.add(pit);
  }
  if (t >= 4) {
    // a camel dragging logs on a sledge, and cedar planks stacked to season
    const c = camel(CAMEL, { blanket: CRIMSON });
    c.position.set(5.6, 0, 1.8);
    c.rotation.y = -0.6;
    g.add(c);
    const sl = new THREE.Group();
    sl.add(box(0.7, 0.12, 2.2, CEDAR_DK, 0, 0, 0));
    for (let i = 0; i < 2; i++) sl.add(cyl(0.2, 0.2, 2.2, PALM_WOOD, 6, -0.12 + i * 0.26, 0.3, 0).rotateX(Math.PI / 2));
    sl.position.set(4.6, 0, 3.4);
    sl.rotation.y = 0.3;
    g.add(sl);
    const pl = planks(4 + t);
    pl.position.set(5.8, 0, -1.0);
    g.add(pl);
  }
  if (t >= 5) {
    // a tripod hoist lifting a trunk
    const tri = new THREE.Group();
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; tri.add(limb(V(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4), V(0, 5.0, 0), 0.09, 0.07, PALM_WOOD, 5)); }
    tri.add(box(0.03, 1.8, 0.03, 0x8a7a5a, 0, 3.2, 0));
    tri.add(cyl(0.28, 0.28, 3.0, PALM_WOOD, 7, 0, 3.0, 0).rotateZ(Math.PI / 2));
    tri.position.set(5.8, 0, -4.4);
    g.add(tri);
  }
  if (t >= 6) {
    // the mill: a saw under a shade, and a camel walking its circle to turn it
    const mill = new THREE.Group();
    for (const x of [-2.2, 2.2]) for (const z of [-1.4, 1.4]) mill.add(cyl(0.08, 0.1, 2.6, CEDAR, 5, x, 0, z));
    const aw = awning(5.0, 3.2, STRIPES[2], 0, false);
    aw.position.set(0, 2.6, -1.6);
    mill.add(aw);
    mill.add(box(3.4, 0.9, 1.0, CEDAR_DK, 0, 0, 0));
    const sp = new THREE.Group();
    sp.add(mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.05, 16).rotateX(Math.PI / 2), STEEL_OA));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; sp.add(box(0.14, 0.12, 0.06, 0x8a959c, Math.cos(a) * 0.82, Math.sin(a) * 0.82 - 0.06, 0)); }
    const saw = moving(sp, { spin: true });
    saw.position.set(0.4, 1.2, 0);
    mill.add(saw);
    mill.add(cyl(0.28, 0.28, 3.2, PALM_WOOD, 7, -0.6, 1.2, 0).rotateZ(Math.PI / 2));
    mill.position.set(0.2, 0, -4.6);
    g.add(mill);
    const wp = new THREE.Group();
    wp.add(cyl(0.3, 0.36, 1.0, CEDAR_DK, 6));
    wp.add(box(3.4, 0.14, 0.14, CEDAR, 1.7, 0.9, 0));
    const wc = camel(CAMEL_LT, { blanket: TURQ_DK });
    wc.position.set(3.3, 0, 0);
    wc.rotation.y = Math.PI / 2;
    wp.add(wc);
    const wheel = moving(wp, { orbit: 0.35 });
    wheel.position.set(-3.4, 0, -4.2);
    g.add(wheel);
    g.add(cyl(3.6, 3.7, 0.04, 0xc9a870, 16, -3.4, 0, -4.2));
  }
  if (t >= 7) {
    const lodge = oasisHouse({ w: 5.4, d: 4.2, h: 3.0, roofH: 2.0, roof: C.tile, windows: 2, stone: true });
    lodge.position.set(-7.6, 0, 4.0);
    lodge.rotation.y = 1.1;
    g.add(lodge);
  }
  g.add(oasisPost(2.6).translateX(4.2).translateZ(6.2));
  return { obj: g, h: 7 + (t >= 5 ? 1.5 : 0), w: 10, d: 10 };
}

/** A potter's wheel under a little shade, a pot turning on it. */
function pottersWheel(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.4, 0.45, 0.5, CEDAR_DK, 8));
  const wp = new THREE.Group();
  wp.add(cyl(0.42, 0.42, 0.08, CEDAR, 10));
  const j = jar(0.4, TERRA);
  j.position.y = 0.08;
  wp.add(j);
  const wh = moving(wp, { orbit: 2.2 });
  wh.position.y = 0.5;
  g.add(wh);
  g.add(box(0.6, 0.35, 0.4, CEDAR, 0, 0, -0.75));
  return g;
}

/**
 * Clay pit: the potters' yard. The pit is dug in terraces (water gathering in its bottom), mud bricks dry in
 * rows by it, and pots and amphorae stand ranked in the sun; then come a potter's wheel under a shade, the
 * potters' house, beehive kilns glowing, a long drying shed and a tall kiln chimney.
 */
function clayPit(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const pr = 2.4 + t * 0.4;
  const pit = cyl(pr + 0.8, pr, 0.35, C.clay, 12, 0, -0.2);
  pit.scale.set(1.25, 1, 1);
  g.add(pit);
  const steps = Math.min(3, Math.floor((t + 1) / 2));
  for (let k = 1; k <= steps; k++) {
    const ring = cyl(pr - k * 0.8 + 0.3, pr - k * 0.8, 0.1, k % 2 ? C.clayDark : C.clay, 12, 0, 0.04 + k * 0.03);
    ring.scale.set(1.25, 1, 1);
    g.add(ring);
  }
  if (t >= 3) {
    const w = mesh(new THREE.CylinderGeometry(pr * 0.35, pr * 0.35, 0.06, 10).translate(0, 0.19, 0), WATER_OA, { emissive: WATER_E });
    w.scale.set(1.25, 1, 1);
    g.add(w);
  }
  // a ladder of palm wood into the pit
  const lad = new THREE.Group();
  for (const x of [-0.3, 0.3]) lad.add(box(0.08, 2.2, 0.08, PALM_WOOD, x, 0, 0));
  for (let y = 0.3; y < 2.1; y += 0.45) lad.add(box(0.6, 0.06, 0.06, PALM_WOOD, 0, y, 0));
  lad.rotation.x = -1.0;
  lad.position.set(-pr * 0.9, 0.05, 1.2);
  g.add(lad);
  // mud bricks drying in rows
  const rows = Math.min(4, t);
  for (let rr = 0; rr < rows; rr++) for (let i = 0; i < 7; i++) g.add(box(0.42, 0.16, 0.24, MUD, -2.2 + i * 0.6, 0, 5.2 + rr * 0.55));
  // pots and amphorae ranked in the sun
  const pots = Math.min(16, 4 + t * 2);
  for (let i = 0; i < pots; i++) {
    const j = jar(0.7 + (i % 3) * 0.15, i % 4 === 0 ? WASH_SH : i % 4 === 2 ? TERRA_DK : TERRA, i % 2 === 0);
    j.position.set(6.2 + (i % 4) * 0.62, 0, -3.6 + Math.floor(i / 4) * 0.7);
    g.add(j);
  }
  for (let i = 0; i < 3; i++) g.add(blob(0.7, C.clayDark, -6 + r() * 1.5, 0.1, -4 + i * 1.6, 1.2, 0.5, 1));
  if (t >= 2) {
    const pw = pottersWheel();
    pw.position.set(3.6, 0, 4.6);
    g.add(pw);
    for (const x of [2.6, 4.6]) g.add(cyl(0.05, 0.05, 2.1, CEDAR, 4, x, 0, 5.6));
    const aw = awning(2.6, 1.9, STRIPES[3], 0.25);
    aw.position.set(3.6, 2.2, 3.7);
    g.add(aw);
  }
  if (t >= 3) {
    const hut = oasisHouse({ w: 4.2, d: 3.4, h: 2.3, roofH: 1.7, roof: C.tileWarm, windows: 1 });
    hut.position.set(-7, 0, 3.2);
    hut.rotation.y = 0.8;
    g.add(hut);
  }
  if (t >= 4) { const k = beehiveKiln(1.1); k.position.set(4.4, 0, -6.0); g.add(k); }
  if (t >= 5) {
    // a long drying shed of palm fronds, shelves of pots under it
    const shed = new THREE.Group();
    for (const x of [-2.6, 0, 2.6]) for (const z of [-1.2, 1.2]) shed.add(cyl(0.07, 0.08, 2.2, PALM_WOOD, 5, x, 0, z));
    shed.add(box(5.8, 0.1, 3.0, C.thatch, 0, 2.2, 0));
    for (let i = 0; i < 9; i++) shed.add(box(0.3, 0.06, 3.3, i % 2 ? FROND_DK : FROND, -2.6 + i * 0.65, 2.28, 0));
    for (const y of [0.5, 1.2]) {
      shed.add(box(5.2, 0.06, 0.6, CEDAR, 0, y, 0));
      for (let i = 0; i < 7; i++) { const j = jar(0.4, i % 2 ? TERRA : WASH_SH); j.position.set(-2.3 + i * 0.75, y + 0.06, 0); shed.add(j); }
    }
    shed.position.set(-3.2, 0, -6.6);
    g.add(shed);
  }
  if (t >= 6) { const k = beehiveKiln(1.0); k.position.set(8.4, 0, 2.6); k.rotation.y = -1.2; g.add(k); }
  if (t >= 7) {
    // the great kiln: a tall tapering chimney of sandstone, banded in tile, smoking
    g.add(cyl(0.6, 0.95, 7.2, SAND_DK, 8, 1.2, 0, -8.4));
    for (const y of [2.4, 4.8]) g.add(cyl(0.86 - y * 0.03, 0.88 - y * 0.03, 0.2, TURQ_DK, 8, 1.2, y, -8.4));
    g.add(cyl(0.72, 0.72, 0.3, SAND_LT, 8, 1.2, 7.1, -8.4));
    g.add(glow(new THREE.BoxGeometry(0.7, 0.6, 0.12).translate(0, 0.4, 0), COAL, COAL_E).translateX(1.2).translateZ(-7.5));
    const sm = new THREE.Object3D();
    sm.userData.dynamic = true;
    sm.userData.smoke = true;
    sm.position.set(1.2, 7.6, -8.4);
    g.add(sm);
  }
  g.add(oasisPost(2.6).translateX(1.4).translateZ(6.8));
  return { obj: g, h: 4 + (t >= 7 ? 5 : t >= 4 ? 2 : 0), w: 12, d: 10 };
}

/**
 * Iron mine: dug into a red mesa. The mine's mouth is a carved arch of sandstone framed in turquoise tile, a
 * brass lamp over it; rails run out to a heap of ore; then an overseer's house, a wheel-hoist over a shaft,
 * a smelting furnace glowing at its foot, a camel with ore panniers, a second adit and the miners' lodge.
 */
function ironMine(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const grow = 0.75 + t * 0.06;
  const hill = [
    [0, -3, 5.5, 4.2], [-5, -1.5, 4, 3], [5, -2, 4.5, 3.4], [-2, -6, 5, 5.5], [3.5, -6.5, 4.5, 4.6], [-6.5, -5.5, 3.6, 3.8], [7, -5.8, 3.4, 3.2],
  ].slice(0, 4 + Math.min(3, Math.floor(t / 2)));
  hill.forEach(([x, z, sc, h], i) => {
    const k = i === 0 ? 1 : grow;
    // a flat-topped mesa, banded in its strata
    const m = cyl(sc * k * 0.7, sc * k, h * k * 0.8, i % 2 ? C.rock : C.rockDark, 7, x, 0, z - (k - 1) * 5);
    m.rotation.y = r() * 3;
    g.add(m);
    g.add(cyl(sc * k * 0.8, sc * k * 0.84, 0.3, C.rockDark, 7, x, h * k * 0.34, z - (k - 1) * 5).rotateY(r() * 3));
  });
  // the mouth of the mine: a carved arch in a sandstone face
  const ent = new THREE.Group();
  ent.add(box(3.8, 3.4, 0.9, SAND_DK));
  ent.add(archMesh(3.2, 3.2, 0.12, SAND_LT).translateZ(0.46));
  ent.add(archMesh(2.8, 2.95, 0.08, TURQ_DK).translateZ(0.52));
  ent.add(archMesh(2.4, 2.7, 0.06, SHADOW).translateZ(0.57));
  for (let i = 0; i < 5; i++) ent.add(merlon(0.5, SAND_DK, 0.5).translateX(-1.6 + i * 0.8).translateY(3.4));
  ent.position.set(0, 0, 1.3);
  g.add(ent);
  hangLamp(g, 0, 3.3, 1.95, 0.1, 0.8);
  const railLen = 3 + Math.min(4, t) * 0.8;
  for (const x of [-0.5, 0.5]) g.add(box(0.1, 0.08, railLen, IRON_OA, x, 0.05, 1.8 + railLen / 2));
  for (let i = 0; i < Math.floor(railLen / 0.6); i++) g.add(box(1.3, 0.06, 0.16, CEDAR_DK, 0, 0, 2.0 + i * 0.6));
  const oreCart = (x: number, z: number) => {
    const c = new THREE.Group();
    c.add(box(1.2, 0.7, 1.4, CEDAR, 0, 0.25, 0));
    c.add(box(1.24, 0.08, 1.44, BRASS, 0, 0.8, 0));
    c.add(blob(0.5, IRON_OA, 0, 1.0, 0, 1.2, 0.6, 1.2));
    c.position.set(x, 0, z);
    g.add(c);
  };
  oreCart(0, 1.8 + railLen - 0.8);
  for (let i = 0; i < Math.min(5, t); i++) g.add(blob(0.8 + r() * 0.3, IRON_OA, -4.6 + i * 1.5, 0.2, 4.2 + (i % 2) * 0.9, 1.2, 0.55, 1.1));
  if (t >= 2) {
    const aw = awning(3.0, 1.8, STRIPES[4], 0.3);
    aw.position.set(-3.4, 2.1, 1.6);
    g.add(aw);
    for (const x of [-4.7, -2.1]) g.add(cyl(0.05, 0.05, 1.9, CEDAR, 4, x, 0, 3.2));
    for (let i = 0; i < 3; i++) { const j = jar(0.7, TERRA, true); j.position.set(-4.2 + i * 0.6, 0, 2.4); g.add(j); }
  }
  if (t >= 3) {
    const hut = oasisHouse({ w: 4, d: 3.2, h: 2.2, roofH: 1.6, roof: C.slate, windows: 1 });
    hut.position.set(5, 0, 3.8);
    hut.rotation.y = -0.5;
    g.add(hut);
  }
  if (t >= 4) {
    // a wheel-hoist over a shaft on a sandstone collar
    const hf = new THREE.Group();
    hf.add(cyl(1.2, 1.3, 0.6, SAND_DK, 8));
    hf.add(cyl(0.9, 0.9, 0.05, SHADOW, 8, 0, 0.6));
    for (const s of [-1, 1]) hf.add(limb(V(s * 1.0, 0.5, 0), V(s * 0.25, 4.6, 0), 0.1, 0.08, CEDAR, 5));
    const wp = new THREE.Group();
    wp.add(mesh(new THREE.TorusGeometry(0.9, 0.08, 5, 14), CEDAR_DK));
    for (let i = 0; i < 4; i++) { const sp = box(0.06, 1.8, 0.06, CEDAR_DK, 0, -0.9, 0); sp.rotation.z = (i / 4) * Math.PI; wp.add(sp); }
    const wheel = moving(wp, { spin: true });
    wheel.position.set(0, 4.8, 0);
    hf.add(wheel);
    hf.add(box(0.03, 3.8, 0.03, 0x8a7a5a, 0.9, 1.0, 0));
    hf.position.set(-5.8, 0, 1.6);
    g.add(hf);
  }
  if (t >= 5) {
    // a smelting furnace: a squat tower of sandstone, glowing at its foot, smoke rising
    const fu = new THREE.Group();
    fu.add(cyl(1.0, 1.4, 3.2, SAND_DK, 8));
    fu.add(cyl(1.06, 1.08, 0.2, TURQ_DK, 8, 0, 2.2));
    fu.add(cyl(0.6, 0.8, 1.2, SAND_DK, 8, 0, 3.2));
    fu.add(glow(new THREE.BoxGeometry(0.7, 0.6, 0.2).translate(0, 0.5, 0), COAL, COAL_E).translateZ(1.3));
    const sm = new THREE.Object3D();
    sm.userData.dynamic = true;
    sm.userData.smoke = true;
    sm.position.set(0, 4.6, 0);
    fu.add(sm);
    fu.position.set(7.2, 0, -0.6);
    g.add(fu);
    g.add(blob(1.1, 0x3a3432, 8.8, 0.2, 2.6, 1.2, 0.45, 1.1));
  }
  if (t >= 6) {
    // a second, smaller adit, and a camel laden with ore
    const e2 = ent.clone();
    e2.position.set(-3.4, 0, -1.2);
    e2.rotation.y = 0.4;
    e2.scale.setScalar(0.7);
    g.add(e2);
    const c = camel(CAMEL, { blanket: INDIGO });
    for (const z of [-0.5, 0.5]) c.add(box(0.6, 0.5, 0.3, CEDAR, -0.05, 1.3, z));
    c.position.set(2.8, 0, 6.0);
    c.rotation.y = 0.3;
    g.add(c);
  }
  if (t >= 7) {
    const lodge = oasisHouse({ w: 5, d: 3.8, h: 2.8, roofH: 1.9, roof: C.slate, windows: 2, stone: true });
    lodge.position.set(-7.5, 0, 7.2);
    lodge.rotation.y = 0.4;
    g.add(lodge);
  }
  for (let i = 0; i < 5; i++) g.add(blob(0.5 + r() * 0.3, i % 2 ? C.rock : C.rockDark, -6 + r() * 12, 0.15, 2 + r() * 4, 1.2, 0.6, 1));
  g.add(oasisPost(2.6).translateX(2.4).translateZ(6.6));
  return { obj: g, h: 8 + (t >= 4 ? 1 : 0), w: 12, d: 12 };
}

/** A field of the oasis, w × d: rows of green crop with water running in the channels between. */
function greenField(w: number, d: number, r: () => number, crop: number = 0x5e9a36): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.08, d, 0x8a6a40));
  const rows = Math.max(2, Math.floor(d / 0.9));
  for (let i = 0; i < rows; i++) {
    const z = -d / 2 + (i + 0.5) * (d / rows);
    g.add(box(w - 0.4, 0.36 + r() * 0.1, 0.44, i % 2 ? crop : 0x72ae42, 0, 0.06, z));
    if (i < rows - 1) g.add(mesh(new THREE.BoxGeometry(w - 0.3, 0.04, 0.16).translate(0, 0.1, z + d / rows / 2), WATER_OA, { emissive: WATER_E }));
  }
  return g;
}

/** A grove of date palms in rows on sandy earth, a channel of water feeding their roots. */
function dateGrove(w: number, d: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.08, d, 0xb89260));
  g.add(mesh(new THREE.BoxGeometry(w - 0.2, 0.04, 0.2).translate(0, 0.1, 0), WATER_OA, { emissive: WATER_E }));
  for (let i = 0; i < 3; i++) for (const z of [-d * 0.28, d * 0.28]) {
    const p = palm(3.4 + r() * 1.0, r, { dates: true, lean: (r() - 0.5) * 0.2 });
    p.position.set(-w / 2 + (i + 0.5) * (w / 3), 0.08, z);
    g.add(p);
  }
  return g;
}

/** A melon patch: sprawling vines and fat melons. */
function melonPatch(w: number, d: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.08, d, 0x8a6a40));
  for (let i = 0; i < 14; i++) {
    const x = (r() - 0.5) * (w - 0.6), z = (r() - 0.5) * (d - 0.6);
    g.add(blob(0.36, i % 2 ? 0x4e8a30 : 0x68a23c, x, 0.12, z, 1.3, 0.35, 1.1));
    if (i % 2 === 0) g.add(blob(0.24, i % 4 ? 0x7aa84a : 0xe8c040, x + 0.3, 0.2, z, 1.2, 0.9, 1));
  }
  return g;
}

/** A shaduf: a well of sandstone and a long sweep on a post, a bucket at one end and a stone at the other. */
function shaduf(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.8, 0.85, 0.8, SAND, 8));
  g.add(cyl(0.86, 0.86, 0.1, TURQ_DK, 8, 0, 0.72));
  g.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 8).translate(0, 0.7, 0), WATER_OA, { emissive: WATER_E }));
  for (const z of [-0.2, 0.2]) g.add(box(0.14, 2.2, 0.14, PALM_WOOD, 1.2, 0, z));
  const sweep = new THREE.Group();
  sweep.add(box(4.2, 0.1, 0.1, PALM_WOOD, 0.2, 0, 0));
  sweep.add(blob(0.3, SAND_DK, 2.1, -0.1, 0));
  sweep.add(box(0.03, 1.0, 0.03, 0x8a7a5a, -1.8, -0.5, 0));
  sweep.add(cyl(0.16, 0.12, 0.3, CEDAR, 6, -1.8, -1.1, 0));
  sweep.position.set(1.2, 2.2, 0);
  sweep.rotation.z = -0.35;
  g.add(sweep);
  return g;
}

/** A noria: a great wooden water-wheel on sandstone piers, clay pots round its rim, turning slowly; a channel leads the water off. */
function noria(): THREE.Group {
  const g = new THREE.Group();
  for (const z of [-0.8, 0.8]) g.add(box(0.8, 3.4, 0.5, SAND, 0, 0, z));
  g.add(box(4.8, 0.5, 1.0, SAND_DK, 0, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(4.6, 0.06, 0.8).translate(0, 0.46, 0), WATER_OA, { emissive: WATER_E }));
  const wp = new THREE.Group();
  wp.add(mesh(new THREE.TorusGeometry(2.3, 0.1, 4, 18), CEDAR));
  wp.add(mesh(new THREE.TorusGeometry(1.2, 0.08, 4, 14), CEDAR));
  for (let i = 0; i < 6; i++) { const sp = box(0.1, 4.6, 0.1, CEDAR_DK, 0, -2.3, 0); sp.rotation.z = (i / 6) * Math.PI; wp.add(sp); }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    wp.add(cyl(0.16, 0.12, 0.3, TERRA, 6, Math.cos(a) * 2.35, Math.sin(a) * 2.35, 0.18).rotateX(Math.PI / 2));
  }
  const wheel = moving(wp, { spin: true });
  wheel.position.set(0, 2.9, 0);
  g.add(wheel);
  g.add(cyl(0.14, 0.14, 1.9, CEDAR_DK, 6, 0, 2.9, 0).rotateX(Math.PI / 2));
  // the channel carrying the water off on stilts
  g.add(box(0.5, 0.3, 4.2, SAND_DK, 0, 4.9, 2.4));
  g.add(mesh(new THREE.BoxGeometry(0.34, 0.05, 4.2).translate(0, 5.2, 2.4), WATER_OA, { emissive: WATER_E }));
  for (const z of [1.2, 3.2]) g.add(box(0.4, 4.9, 0.4, SAND, 0, 0, z));
  return g;
}

/** A dovecote: a tapering tower of whitewashed mud, pierced all over with nesting holes, pinnacles on its crown and doves about it. */
function dovecote(s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.95 * s, 1.35 * s, 4.2 * s, WASH_SH, 10));
  g.add(cyl(1.45 * s, 1.45 * s, 0.4 * s, SAND_DK, 10));
  for (let k = 0; k < 4; k++) for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + k * 0.4;
    const rr = (1.3 - k * 0.1) * s;
    g.add(box(0.14 * s, 0.18 * s, 0.1, SHADOW, Math.sin(a) * rr, (1.0 + k * 0.8) * s, Math.cos(a) * rr).rotateY(a));
  }
  g.add(mesh(new THREE.SphereGeometry(0.98 * s, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1), WASH_SH).translateY(4.2 * s));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.add(cone(0.14 * s, 0.7 * s, WASH_SH, 5, Math.sin(a) * 0.8 * s, 4.1 * s, Math.cos(a) * 0.8 * s));
  }
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    g.add(blob(0.1 * s, 0xf4f4f0, Math.sin(a) * 1.05 * s, (1.6 + (i % 3) * 0.9) * s, Math.cos(a) * 1.05 * s, 1.3, 0.8, 0.8));
  }
  return g;
}

/** A pen walled in mud brick, goats and a camel inside. */
function goatPen(r: () => number): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z, w, d] of [[0, 2.3, 6.4, 0.3], [0, -2.3, 6.4, 0.3], [3.2, 0, 0.3, 4.6], [-3.2, 0, 0.3, 4.6]] as [number, number, number, number][]) {
    g.add(box(w, 0.8, d, MUD, x, 0, z));
  }
  for (let i = 0; i < 4; i++) {
    const gt = goat([0xe8e0d0, 0x3a2e28, 0x8a6a4a, 0xd8c8a8][i]);
    gt.position.set(-2.2 + i * 1.3, 0, (r() - 0.5) * 2.4);
    gt.rotation.y = r() * 6;
    g.add(gt);
  }
  const c = camel(CAMEL_LT, { kneel: true });
  c.position.set(1.6, 0, -0.9);
  c.scale.setScalar(0.85);
  g.add(c);
  return g;
}

/**
 * Farm: the oasis gardens. A farmhouse by a well, and round it fields watered by channels: rows of green
 * crops, groves of date palms, golden barley and melon patches, more with every level; then a shaduf, a
 * great noria turning, dovecotes, a goat pen, a domed granary, and a second dovecote.
 */
function farm(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const fh = t >= 7
    ? oasisHouse({ w: 7, d: 5, h: 3.4, roofH: 2.6, roof: C.tile, windows: 3, stone: true })
    : oasisHouse({ w: 4.6 + Math.min(3, t) * 0.4, d: 4.0, h: 2.5, roofH: 2.1, roof: C.thatch, windows: 1 });
  g.add(fh);
  const spots: [number, number][] = [[-8, -6], [0, -8.5], [8, -6], [-9.5, 3], [-4.5, -15.5], [4.5, -15.5], [13.5, -12], [15.5, -3.5], [-13.5, -12]];
  const fields = Math.min(spots.length, t + 1);
  const crop = (i: number): THREE.Group => {
    if (i % 4 === 1) return dateGrove(6.5, 5, r);
    if (i % 4 === 3) return melonPatch(6.5, 5, r);
    if (i % 4 === 2) return greenField(6.5, 5, r, 0xc8b050);
    return greenField(6.5, 5, r);
  };
  for (let i = 0; i < fields; i++) {
    const f = crop(i);
    f.position.set(spots[i][0], 0, spots[i][1]);
    f.rotation.y = (r() - 0.5) * 0.3;
    g.add(f);
  }
  // baskets of dates and sacks of grain by the house
  for (let i = 0; i < Math.min(5, 1 + t); i++) g.add(spiceBasket(0.5 + r() * 2.5, 5.4 + r() * 1.0, i % 2 ? DATES : 0xd8b85a, 0.9));
  // the low mud wall along the yard
  g.add(box(10, 0.7, 0.3, MUD, 0, 0, 4.4));
  g.add(cyl(0.17, 0.17, 10, MUD_DK, 5, 0, 0.72, 4.4).rotateZ(Math.PI / 2));
  if (t >= 2) {
    const sh = shaduf();
    sh.position.set(-3.2, 0, 3.0);
    g.add(sh);
  }
  if (t >= 3) {
    const nr = noria();
    nr.position.set(-14, 0, -3.5);
    nr.rotation.y = 0.6;
    g.add(nr);
  }
  if (t >= 4) {
    const dc = dovecote(1.1);
    dc.position.set(10, 0, 2.5);
    g.add(dc);
  }
  if (t >= 5) {
    const pen = goatPen(r);
    pen.position.set(-7.5, 0, 7.5);
    g.add(pen);
  }
  if (t >= 6) { const s = silo(0.8); s.position.set(-5, 0, -1.4); g.add(s); }
  if (t >= 8) { const dc = dovecote(0.9); dc.position.set(4.6, 0, -2.2); g.add(dc); }
  g.add(oasisPost(2.6).translateX(5.6).translateZ(5.4));
  return { obj: g, h: 6 + (t >= 4 ? 2 : 0), w: 8, d: 8 };
}

// ---------- the Djinn's seat ----------

/** The Djinn's lamp, of gold: a round belly on a foot, a domed lid, a handle curling behind and a long spout. Spout tip at (1.45, 0.8)·s. */
export function magicLamp(s: number, gem = true): THREE.Group {
  const g = new THREE.Group();
  g.add(blob(0.62 * s, GOLD, 0, 0.34 * s, 0, 1.6, 0.62, 1.0, 1));
  const band = cyl(0.99 * s, 0.99 * s, 0.07 * s, GOLD_DK, 14, 0, 0.3 * s);
  band.scale.set(1, 1, 0.63);
  g.add(band);
  g.add(cyl(0.3 * s, 0.44 * s, 0.24 * s, GOLD_DK, 10));
  g.add(blob(0.3 * s, GOLD, -0.1 * s, 0.62 * s, 0, 1, 0.7, 1, 1));
  g.add(blob(0.09 * s, GOLD_DK, -0.1 * s, 0.86 * s, 0));
  g.add(cone(0.05 * s, 0.22 * s, GOLD, 5, -0.1 * s, 0.9 * s));
  g.add(mesh(new THREE.TorusGeometry(0.36 * s, 0.07 * s, 5, 10, Math.PI * 1.2), GOLD).translateX(-1.0 * s).translateY(0.42 * s).rotateZ(Math.PI / 2 - 0.3));
  g.add(limb(V(0.75 * s, 0.34 * s, 0), V(1.45 * s, 0.8 * s, 0), 0.16 * s, 0.07 * s, GOLD, 7));
  g.add(cyl(0.085 * s, 0.085 * s, 0.05 * s, GOLD_DK, 7, 1.45 * s, 0.8 * s, 0).rotateZ(-1.0));
  if (gem) for (const z of [-1, 1]) g.add(glow(new THREE.OctahedronGeometry(0.1 * s, 0), TURQ_LT, 0x1a8a8a).translateY(0.34 * s).translateZ(z * 0.6 * s));
  return g;
}

/** A spiral of blue djinn-smoke rising from a point, widening as it climbs, merged into one mesh per colour and turning. */
function djinnSmoke(h: number, turns: number, n = 30): THREE.Group {
  const parts = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const a = k * turns * Math.PI * 2;
    const rad = 0.2 + k * k * 1.5;
    const sz = 0.3 + k * 0.62;
    const m = mesh(new THREE.IcosahedronGeometry(sz, 0), i % 3 === 0 ? 0xa8d8ff : SMOKE_C, { emissive: SMOKE_E, opacity: 0.62 });
    m.position.set(Math.cos(a) * rad, k * h, Math.sin(a) * rad);
    parts.add(m);
  }
  return swarm(parts, { orbit: 0.8 });
}

/** The Djinn himself, towering out of the smoke over his palace: half seen, blue and glowing, arms folded, golden eyes. */
function ghostDjinn(s: number): THREE.Group {
  const g = new THREE.Group();
  const SK = 0x5b9cf0, SK_E = 0x1f4aa0;
  const skin = (geo: THREE.BufferGeometry) => mesh(geo, SK, { emissive: SK_E, opacity: 0.72 });
  g.add(skin(new THREE.CylinderGeometry(0.34 * s, 0.22 * s, 0.7 * s, 8).translate(0, 0.35 * s, 0)));
  // his own tail of smoke, running down into the plume from the lamp
  const tl = smokeTail(1.3 * s, 0.24 * s, SK, SK_E, 0.72);
  tl.position.y = -1.22 * s;
  g.add(tl);
  g.add(skin(new THREE.IcosahedronGeometry(0.3 * s, 1).scale(1.6, 0.62, 1.0).translate(0, 0.78 * s, 0)));
  for (const sd of [-1, 1]) {
    g.add(skin(new THREE.IcosahedronGeometry(0.18 * s, 0).translate(sd * 0.46 * s, 0.76 * s, 0)));
    // the arms folded across the chest
    const up = limb(V(sd * 0.5 * s, 0.74 * s, 0), V(sd * 0.54 * s, 0.4 * s, 0.22 * s), 0.12 * s, 0.1 * s, SK);
    up.material = mat(SK, { emissive: SK_E, opacity: 0.72 });
    g.add(up);
    const fore = limb(V(sd * 0.54 * s, 0.42 * s, 0.26 * s), V(-sd * 0.28 * s, 0.52 * s, 0.34 * s), 0.1 * s, 0.09 * s, SK);
    fore.material = mat(SK, { emissive: SK_E, opacity: 0.72 });
    g.add(fore);
    g.add(glow(new THREE.CylinderGeometry(0.11 * s, 0.11 * s, 0.2 * s, 8).rotateZ(Math.PI / 2 - sd * 0.2).translate(sd * 0.2 * s, 0.47 * s, 0.3 * s), GOLD, 0x8a5a10));
  }
  g.add(skin(new THREE.IcosahedronGeometry(0.24 * s, 1).scale(1, 1.08, 1).translate(0, 1.12 * s, 0.02 * s)));
  for (const sd of [-1, 1]) {
    g.add(glow(new THREE.OctahedronGeometry(0.05 * s, 0).translate(sd * 0.08 * s, 1.16 * s, 0.22 * s), EYE, EYE_E));
    g.add(skin(new THREE.ConeGeometry(0.06 * s, 0.22 * s, 4).rotateZ(-sd * 1.1).translate(sd * 0.26 * s, 1.12 * s, 0)));
  }
  g.add(glow(new THREE.CylinderGeometry(0.07 * s, 0.09 * s, 0.1 * s, 7).translate(0, 1.36 * s, -0.04 * s), GOLD, 0x8a5a10));
  g.add(mesh(new THREE.ConeGeometry(0.1 * s, 0.5 * s, 6).translate(0, 1.64 * s, -0.04 * s), 0x1a2448, { opacity: 0.8 }));
  g.add(mesh(new THREE.BoxGeometry(0.1 * s, 0.18 * s, 0.08 * s).translate(0, 0.94 * s, 0.2 * s), 0x1a2448, { opacity: 0.8 }));
  return g;
}

/** A flying carpet (travelling along +x): three panels rippling, a border, a medallion, gold tassels, and someone aboard. */
function flyingCarpet(field: number, border: number, rider: number): THREE.Group {
  const g = new THREE.Group();
  const segs: [number, number, number][] = [[-0.72, -0.02, 0.16], [0, 0.04, 0], [0.72, -0.02, -0.14]];
  for (const [x, y, rz] of segs) {
    const p = new THREE.Group();
    p.add(box(0.76, 0.05, 1.12, border));
    p.add(box(0.64, 0.06, 0.94, field));
    p.position.set(x, y, 0);
    p.rotation.z = rz;
    g.add(p);
  }
  g.add(box(0.42, 0.08, 0.42, GOLD, 0, 0.04, 0).rotateY(Math.PI / 4));
  for (const x of [-1.1, 1.1]) for (const z of [-0.5, 0.5]) g.add(cone(0.05, 0.2, GOLD, 4, x, -0.02, z).rotateZ(x < 0 ? Math.PI / 2 : -Math.PI / 2));
  // a rider sitting cross-legged
  const m = new THREE.Group();
  m.add(cyl(0.3, 0.36, 0.2, rider, 7, 0, 0.06));
  m.add(cyl(0.18, 0.26, 0.5, rider, 7, 0, 0.22));
  m.add(blob(0.16, SKINS[2], 0, 0.86, 0.02));
  m.add(blob(0.19, LINEN, 0, 0.98, 0, 1.08, 0.72, 1.08));
  m.position.set(-0.1, 0.05, 0);
  m.rotation.y = Math.PI / 2;
  g.add(m);
  return g;
}

/** Orbs of turquoise light drifting about a point, merged into one mesh, turning and bobbing. */
function orbs(n: number, rad: number, spread: number, r: () => number, size = 0.26): THREE.Group {
  const parts = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.4, d = rad * (0.85 + r() * 0.3);
    parts.add(glow(new THREE.IcosahedronGeometry(size * (0.8 + r() * 0.5), 1), i % 4 === 3 ? 0xfff0b0 : ORB, i % 4 === 3 ? 0xc09020 : ORB_E).translateX(Math.cos(a) * d).translateY((r() - 0.5) * spread).translateZ(Math.sin(a) * d));
  }
  return swarm(parts, { orbit: 0.22, bob: 0.3 });
}

/** A pillared arcade along a front face at z, from x0 to x1: pointed arches in shadow, slender columns before them, a lamp in every bay. */
function arcade(g: THREE.Group, x0: number, x1: number, z: number, h: number, bays: number, skip = -1): void {
  const bw = (x1 - x0) / bays;
  for (let i = 0; i < bays; i++) {
    if (i === skip) continue;
    const x = x0 + (i + 0.5) * bw;
    g.add(archMesh(bw * 0.72, h * 0.9, 0.08, SHADOW).translateX(x).translateZ(z));
    g.add(archMesh(bw * 0.86, h * 0.97, 0.06, TURQ_DK).translateX(x).translateZ(z - 0.02));
    hangLamp(g, x, h * 0.8, z + 0.5, 0.15, 0.55);
  }
  for (let i = 0; i <= bays; i++) {
    const x = x0 + i * bw;
    g.add(cyl(0.13, 0.15, h, WASH, 8, x, 0, z + 0.45));
    g.add(box(0.36, 0.18, 0.36, SAND_LT, x, h - 0.1, z + 0.45));
    g.add(box(0.34, 0.2, 0.34, SAND_DK, x, 0, z + 0.45));
  }
  g.add(box(x1 - x0 + 0.5, 0.3, 1.1, SAND_LT, (x0 + x1) / 2, h, z + 0.35));
  crenels(g, x1 - x0 + 0.4, 0.9, h + 0.3, SAND, 0.36, (x0 + x1) / 2, z + 0.35);
}

/** A great arched portal (an iwan) projecting from a front: a tall frame, tile borders, a deep arch, brass-studded doors. */
function portal(g: THREE.Group, z: number, w: number, h: number, gold = false): void {
  g.add(box(w, h, 1.0, SAND_LT, 0, 0, z));
  g.add(box(w + 0.3, 0.3, 1.2, SAND, 0, h, z));
  crenels(g, w + 0.2, 1.1, h + 0.28, SAND_LT, 0.4, 0, z);
  const aw = w * 0.66, ah = h * 0.82;
  g.add(archMesh(aw + 0.5, ah + 0.35, 0.1, gold ? GOLD : TURQ_DK).translateZ(z + 0.52));
  g.add(archMesh(aw + 0.2, ah + 0.14, 0.1, TURQ).translateZ(z + 0.56));
  g.add(archMesh(aw, ah, 0.08, SHADOW).translateZ(z + 0.6));
  // the tile panel framing the arch (the spandrels) and a band of script-like tile over it
  g.add(box(w - 0.3, 0.26, 0.06, TURQ_DK, 0, h - 0.55, z + 0.52));
  for (const s of [-1, 1]) {
    g.add(box(0.2, h - 0.8, 0.06, TURQ_DK, s * (w / 2 - 0.25), 0.3, z + 0.52));
    const leaf = box(aw / 2 - 0.1, ah * 0.6, 0.08, CEDAR, s * (aw / 4), 0, z + 0.66);
    g.add(leaf);
    for (let k = 0; k < 4; k++) g.add(box(0.08, 0.08, 0.04, GOLD, s * (aw / 4), ah * (0.1 + k * 0.14), z + 0.72));
  }
  hangLamp(g, 0, ah * 0.95, z + 0.9, 0.5, 0.9);
}

/**
 * The Djinn's seat, by level: a nomad's pavilion of striped cloth over rugs and cushions; a sandstone house
 * with a little turquoise dome, a wind catcher and a walled court with a palm and a fountain; a palace of
 * arcades under a turquoise dome between two slender wind towers; a grand palace under a great dome of
 * turquoise and gold, a reflecting pool before it and orbs of light drifting round it; and at last the palace
 * of legend, the Djinn's own golden lamp floating over the great dome, his smoke spiralling up out of it and
 * the Djinn himself looming half-seen in it, while flying carpets circle.
 */
function djinnPalace(t: number, color: number): Built {
  const g = new THREE.Group();
  const r = rng(173 + t);
  if (t === 1) {
    // the nomad's pavilion
    const W = 6.4, D = 4.4, H = 2.8, E = 1.45;
    const cols = [INDIGO, SAFFRON, CRIMSON, LINEN];
    const n = 8, sw = W / n;
    const back = Math.atan2(H - E, D / 2), bl = Math.hypot(H - E, D / 2) + 0.1;
    const frontL = Math.hypot(H - 1.95, D / 2 + 1.3), front = Math.atan2(H - 1.95, D / 2 + 1.3);
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + (i + 0.5) * sw;
      const b = box(sw + 0.01, 0.06, bl, cols[i % 4], 0, 0, 0);
      b.geometry.translate(0, 0, -bl / 2);
      b.position.set(x, H, 0);
      b.rotation.x = -back;
      g.add(b);
      const f = box(sw + 0.01, 0.06, frontL, cols[(i + 2) % 4], 0, 0, 0);
      f.geometry.translate(0, 0, frontL / 2);
      f.position.set(x, H, 0);
      f.rotation.x = front;
      g.add(f);
      // the scalloped hem of the canopy
      const p = cone(sw * 0.4, 0.26, cols[(i + 2) % 4], 3, x, 1.93, D / 2 + 1.32);
      p.rotation.x = Math.PI;
      g.add(p);
    }
    g.add(box(W, E, 0.06, INDIGO, 0, 0, -D / 2));
    for (const s of [-1, 1]) {
      const side = extrude([[-D / 2, 0], [0.8, 0], [0.8, H * 0.85], [0, H], [-D / 2, E]], 0.06, INDIGO);
      side.rotation.y = -Math.PI / 2;
      side.position.x = s * W / 2;
      g.add(side);
    }
    // the tent poles standing through the ridge, gold-knobbed, and the poles holding the canopy up
    for (const x of [-2.2, 0, 2.2]) {
      g.add(cyl(0.07, 0.08, H + 0.5, CEDAR, 5, x, 0, 0));
      g.add(blob(0.12, GOLD, x, H + 0.55, 0));
    }
    for (const x of [-3.0, -1.0, 1.0, 3.0]) g.add(cyl(0.05, 0.06, 1.95, CEDAR, 4, x, 0, D / 2 + 1.3));
    for (const s of [-1, 1]) {
      g.add(limb(V(s * 3.0, 1.95, D / 2 + 1.3), V(s * 4.2, 0, D / 2 + 2.4), 0.02, 0.02, 0x8a7a5a, 3));
      g.add(limb(V(s * 3.2, 1.4, -D / 2), V(s * 4.1, 0, -D / 2 - 1.0), 0.02, 0.02, 0x8a7a5a, 3));
    }
    // within: rugs over the sand, cushions, a brass tray on a low stand, a lantern over the door
    g.add(rug(5.6, 3.6, CRIMSON, INDIGO, SAFFRON).translateY(0.02).translateZ(0.4));
    g.add(rug(2.4, 1.6, TURQ_DK, SAFFRON, CRIMSON).translateX(0.3).translateY(0.05).translateZ(3.0).rotateY(0.1));
    for (const [x, z, c] of [[-2.2, -1.2, SAFFRON], [-1.2, -1.5, TURQ_DK], [1.4, -1.4, CRIMSON], [2.4, -1.0, INDIGO], [-2.6, 0.6, PLUM]] as [number, number, number][]) g.add(cushion(x, z, c));
    g.add(cyl(0.2, 0.26, 0.3, CEDAR_DK, 6, 0, 0, -0.3), cyl(0.62, 0.62, 0.04, GOLD, 12, 0, 0.3, -0.3));
    for (let i = 0; i < 3; i++) g.add(cyl(0.07, 0.06, 0.14, BRASS, 6, -0.25 + i * 0.25, 0.34, -0.3));
    hangLamp(g, 0, 2.3, D / 2 + 0.6, 0.2, 0.8);
    // before it: a brazier, a kneeling camel, palms, water jars and the chief's standard
    g.add(brazier(0.8, true, 0.9).translateX(2.2).translateZ(4.6));
    const c = camel(CAMEL, { kneel: true, blanket: CRIMSON });
    c.position.set(-3.5, 0, 3.4);
    c.rotation.y = -0.6;
    g.add(c);
    for (const [x, z, h] of [[-3.9, -3.0, 4.2], [3.9, -2.8, 3.6]] as [number, number, number][]) {
      const p = palm(h, r, { dates: true });
      p.position.set(x, 0, z);
      g.add(p);
    }
    for (let i = 0; i < 3; i++) { const j = jar(0.75, i === 1 ? TURQ_DK : TERRA, true); j.position.set(-4.0 + i * 0.5, 0, 0.9 + (i % 2) * 0.4); g.add(j); }
    g.add(standardPole(color, 4.6).translateX(4.2).translateZ(1.6));
    return { obj: g, h: 7, w: 9, d: 9 };
  }
  if (t === 2) {
    // the sandstone house with its little dome, and a walled court before it
    const pz = -1.7;
    const main = block(6.4, 3.8, 4.6, { wall: WASH, door: 1.2, wins: 3, sideWins: true });
    main.position.z = pz;
    g.add(main);
    const up = block(3.0, 1.9, 2.8, { wall: WASH, door: null, wins: 1 });
    up.position.set(1.6, 3.8, pz - 0.7);
    g.add(up);
    const lt = lattice(1.2, 1.0);
    lt.position.set(-1.6, 1.9, pz + 2.3);
    g.add(lt);
    const dm = domeOn(1.25, 2.0, { drumH: 0.6, seg: 12 });
    dm.position.set(-1.4, 3.8, pz - 0.2);
    g.add(dm);
    const wc = windCatcher(0.8, 1.7);
    wc.position.set(2.5, 5.7, pz - 1.3);
    g.add(wc);
    const aw = awning(2.2, 1.4, STRIPES[0], -0.1, false);
    for (const x of [0.6, 2.6]) g.add(cyl(0.05, 0.05, 1.3, CEDAR, 4, x, 3.8, pz + 1.9));
    aw.position.set(1.6, 5.1, pz + 0.6);
    g.add(aw);
    // the court: a low wall with merlons, a gate between two posts, a palm and a fountain within, tile underfoot
    const cz0 = 0.8, cz1 = 4.9;
    g.add(box(7.2, 0.06, cz1 - cz0, SAND_LT, 0, 0, (cz0 + cz1) / 2));
    star8(g, 1.4, 0.06, 2.9, 1.6, TURQ_DK, WASH);
    const seg = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ry = -Math.atan2(z1 - z0, x1 - x0);
      const w = box(len, 1.2, 0.36, WASH, (x0 + x1) / 2, 0, (z0 + z1) / 2);
      w.rotation.y = ry;
      g.add(w);
      const n = Math.max(1, Math.floor(len / 0.8));
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n;
        g.add(merlon(0.3, WASH, 0.36).translateX(x0 + (x1 - x0) * k).translateY(1.2).translateZ(z0 + (z1 - z0) * k).rotateY(ry));
      }
    };
    seg(-3.6, cz0, -3.6, cz1);
    seg(3.6, cz0, 3.6, cz1);
    seg(-3.6, cz1, -1.0, cz1);
    seg(1.0, cz1, 3.6, cz1);
    for (const s of [-1, 1]) {
      g.add(box(0.5, 2.2, 0.5, SAND, s * 1.0, 0, cz1));
      g.add(cone(0.34, 0.5, TURQ, 4, s * 1.0, 2.2, cz1).rotateY(Math.PI / 4));
      hangLamp(g, s * 1.0, 2.1, cz1 + 0.4, 0.05, 0.55);
    }
    const p = palm(4.6, r, { dates: true, lean: 0.12 });
    p.position.set(-2.1, 0, 2.7);
    g.add(p);
    const f = fountain(0.8);
    f.position.set(1.4, 0.06, 2.9);
    g.add(f);
    for (const x of [-3.0, 3.0]) { const pp = pottedPalm(1.8, r); pp.position.set(x, 0, 1.4); pp.scale.setScalar(0.8); g.add(pp); }
    // a lower wing to one side under a striped awning
    const wing = block(2.8, 2.6, 3.4, { wall: SAND, door: 0.8, wins: 0 });
    wing.position.set(-4.8, 0, pz + 0.4);
    wing.rotation.y = Math.PI / 2;
    g.add(wing);
    const aw2 = awning(2.4, 1.2, STRIPES[1], 0.3);
    aw2.position.set(-6.2, 2.0, pz + 0.4);
    aw2.rotation.y = -Math.PI / 2;
    g.add(aw2);
    g.add(standardPole(color, 5.4).translateX(4.6).translateZ(3.4));
    return { obj: g, h: 10, w: 13, d: 11 };
  }
  if (t === 3) {
    // the palace of arcades between two wind towers
    const pz = -1.8;
    const body = block(9.6, 5.0, 6.2, { wall: SAND, door: null, wins: 0 });
    body.position.z = pz;
    g.add(body);
    arcade(g, -4.6, 4.6, pz + 3.12, 3.0, 5, 2);
    const up = block(7.0, 2.4, 4.4, { wall: WASH, door: null, wins: 4, winY: 0.8 });
    up.position.set(0, 5.0, pz - 0.5);
    g.add(up);
    for (const x of [-2.2, 2.2]) {
      const lt = lattice(1.3, 1.1);
      lt.position.set(x, 5.6, pz + 1.72);
      g.add(lt);
    }
    const dm = domeOn(2.0, 3.2, { drumH: 1.0, seg: 12, ribs: 0 });
    dm.position.set(0, 7.4, pz - 0.5);
    g.add(dm);
    portal(g, pz + 3.4, 3.2, 6.0);
    for (const s of [-1, 1]) {
      const tw = lampTower(0.72, 10.4, { bal: [7.6], banner: color });
      tw.position.set(s * 6.2, 0, pz + 1.9);
      g.add(tw);
      const aw = awning(2.6, 1.3, STRIPES[s < 0 ? 1 : 2], 0.3);
      aw.position.set(s * 3.3, 7.0, pz + 1.72);
      g.add(aw);
      g.add(brazier(0.8, true, 0.9).translateX(s * 2.5).translateZ(3.4));
      const pp = pottedPalm(2.4, r);
      pp.position.set(s * 4.4, 0, 3.0);
      g.add(pp);
    }
    g.add(box(3.4, 0.22, 1.4, SAND_LT, 0, 0, pz + 4.6));
    return { obj: g, h: 15, w: 15, d: 12 };
  }
  // the grand palace (and, at the height of his power, the palace of legend)
  const big = t === 5;
  const k = big ? 1.08 : 1;
  const pz = -2.6;
  const H = 5.4 * k;
  const body = block(10 * k, H, 7, { wall: SAND, door: null, wins: 0, sideWins: true });
  body.position.z = pz;
  g.add(body);
  arcade(g, -5 * k + 0.4, 5 * k - 0.4, pz + 3.52, 3.2, 7, 3);
  const upH = 2.6;
  const up = block(8.2 * k, upH, 5.4, { wall: WASH, door: null, wins: 0 });
  up.position.set(0, H, pz - 0.4);
  g.add(up);
  for (let i = 0; i < 7; i++) {
    const x = -3.3 * k + (i * 6.6 * k) / 6;
    if (i === 3) continue;
    archWin(g, x, H + 0.5, pz + 2.32, 0.6, 1.3);
  }
  for (const x of [-2.2 * k, 2.2 * k]) { const lt = lattice(1.2, 1.2); lt.position.set(x, H + 0.7, pz + 2.3); g.add(lt); }
  // the great dome: turquoise with ribs of gold, on a drum ringed with lit windows
  const DR = 3.0 * k, DH = 5.0 * k, drumH = 1.8;
  const dm = domeOn(DR, DH, { drumH, seg: 16, ribs: 8, wins: 8, star: big, onion: 0.24, fin: 1.7 * k });
  const top = H + upH;
  dm.position.set(0, top, pz - 0.4);
  g.add(dm);
  // kiosks with little domes at the corners of the upper storey
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const kx = x * 3.5 * k, kz = pz - 0.4 + z * 2.1;
    for (const [px, pz2] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) g.add(cyl(0.06, 0.06, 1.1, WASH, 4, kx + px, top + 0.2, kz + pz2));
    g.add(box(1.3, 0.14, 1.3, SAND_LT, kx, top + 1.28, kz));
    const kd = domeOn(0.6, 1.0, { drumH: 0, seg: 8, fin: 0.45 });
    kd.position.set(kx, top + 1.4, kz);
    g.add(kd);
  }
  portal(g, pz + 3.72, 3.6, 7.2, big);
  for (const s of [-1, 1]) {
    const tw = lampTower(0.85, 12.6 * k, { bal: [8.2 * k, 11.0 * k], banner: color, star: big, dome: 1.9 });
    tw.position.set(s * 6.5, 0, pz + 2.3);
    g.add(tw);
    g.add(brazier(0.9, true, 1.0).translateX(s * 3.2).translateZ(2.6));
    const pp = pottedPalm(2.6, r);
    pp.position.set(s * 5.0, 0, 3.4);
    g.add(pp);
    for (const z of [3.0, 6.2]) g.add(lampPost(2.2, 0.8).translateX(s * 2.3).translateZ(z));
  }
  // the steps and the reflecting pool, a jet of water leaping in its middle
  g.add(box(4.2, 0.24, 1.2, SAND_LT, 0, 0, 1.9));
  const pl = pool(3.0, 4.0);
  pl.position.set(0, 0, 4.7);
  g.add(pl);
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.4, 6).translate(0, 1.0, 4.7), detailMat(JET, { opacity: 0.6, emissive: 0x2a6a70 })));
  g.add(cyl(0.3, 0.36, 0.3, SAND_LT, 8, 0, 0, 4.7));
  const orbC = orbs(big ? 12 : 8, DR + 1.4, 3.0, r);
  orbC.position.set(0, top + drumH + DH * 0.4, pz - 0.4);
  g.add(orbC);
  const domeTop = top + drumH + DH;
  if (!big) return { obj: g, h: domeTop + 3, w: 15, d: 16 };
  // the palace of legend: the golden lamp floating over the great dome, the smoke, the Djinn, the carpets
  const lampY = domeTop + 3.4;
  const lamp = new THREE.Group();
  const LS = 2.4;
  const L = magicLamp(LS);
  L.position.set(-1.2, 0, 0);
  lamp.add(L);
  const smoke = djinnSmoke(7.6, 1.6, 34);
  smoke.position.set(-1.2 + 1.45 * LS, 0.8 * LS, 0);
  lamp.add(smoke);
  const ghost = ghostDjinn(4.2);
  ghost.position.set(-1.2 + 1.45 * LS + 0.2, 0.8 * LS + 6.9, 0);
  ghost.rotation.y = -Math.PI / 2 + 0.3;
  lamp.add(ghost);
  const lampM = moving(lamp, { bob: 0.35, orbit: 0.12 });
  lampM.position.set(0, lampY, pz - 0.4);
  g.add(lampM);
  // gold motes sifting down from the lamp
  const motes = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = 0.6 + r() * 2.6;
    motes.add(glow(new THREE.OctahedronGeometry(0.1 + r() * 0.06, 0), 0xffe08a, 0xc08a1a).translateX(Math.cos(a) * d).translateY(-r() * 5).translateZ(Math.sin(a) * d));
  }
  const ms = swarm(motes, { orbit: -0.3, bob: 0.4 });
  ms.position.set(0, lampY, pz - 0.4);
  g.add(ms);
  const ring = new THREE.Group();
  for (const [side, y, f, b, rd] of [[1, domeTop - 1.0, CRIMSON, GOLD, INDIGO], [-1, domeTop + 1.2, TURQ_DK, SAFFRON, PLUM]] as [number, number, number, number, number][]) {
    const c = moving(flyingCarpet(f, b, rd), { bob: 0.3 });
    c.scale.setScalar(1.5);
    c.position.set(side * 6.4, y, 0);
    c.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    ring.add(c);
  }
  ring.position.set(0, 0, pz - 0.4);
  ring.userData.dynamic = true;
  ring.userData.orbit = 0.24;
  g.add(ring);
  return { obj: g, h: domeTop + 4, w: 15, d: 16 };
}

/** An Oasis building, by id (null for the wall, which scene.ts builds with oasisWall). */
export function oasisModel(id: BuildingId, t: number, color: number, r: () => number): Built | null {
  switch (id) {
    case 'main': return djinnPalace(t, color);
    case 'barracks': return barracks(t, color, r);
    case 'stable': return stable(t, r);
    case 'workshop': return workshop(t, r);
    case 'academy': return academy(r);
    case 'smithy': return smithy(t);
    case 'rally': return rally(color);
    case 'statue': return statue();
    case 'market': return market(t, r);
    case 'warehouse': return warehouse(t, r);
    case 'hiding': return hiding(t, r);
    case 'watchtower': return watchtower(t, color);
    case 'timber': return timberCamp(t, r);
    case 'claypit': return clayPit(t, r);
    case 'ironmine': return ironMine(t, r);
    case 'farm': return farm(t, r);
    default: return null;
  }
}

// ---------- the walls ----------

export interface WallKit { R: number; gateA: number; gateHalf: number }

/** The outline of a gate front W wide and H tall with a pointed arch aw × ah cut through it (for extrude). */
function gatePts(W: number, H: number, aw: number, ah: number): [number, number][] {
  // along the bottom to the arch, up its left side, over its point, down its right side, and round the top
  const hs = ah * 0.6, rh = ah - hs;
  const edge: [number, number][] = [[-aw / 2, 0], [-aw / 2, hs], [-aw * 0.44, hs + rh * 0.42], [-aw * 0.28, hs + rh * 0.74], [-aw * 0.12, hs + rh * 0.92], [0, ah],
    [aw * 0.12, hs + rh * 0.92], [aw * 0.28, hs + rh * 0.74], [aw * 0.44, hs + rh * 0.42], [aw / 2, hs], [aw / 2, 0]];
  return [[-W / 2, 0], ...edge, [W / 2, 0], [W / 2, H], [-W / 2, H]];
}

/** Wooden beams jutting from a mud wall (the scaffold they are built with, left in place). */
function toron(g: THREE.Group, len: number, y: number, z: number, every = 1.1): void {
  const n = Math.max(1, Math.floor(len / every));
  for (let i = 0; i < n; i++) g.add(cyl(0.07, 0.07, 0.6, PALM_WOOD, 4, -len / 2 + (i + 0.5) * (len / n), y, z).rotateX(Math.PI / 2));
}

/**
 * The Oasis's walls, by size: a wall of mud brick crowned with little pinnacles and bristling with palm-wood
 * beams; then taller, with round mud towers carrying shaded lookouts; then ramparts of sandstone with a band
 * of turquoise tile, pointed merlons and round bastions; and at last the great walls, their bastions under
 * domed kiosks. The gate is a pointed arch between two towers, its brass doors standing open, a golden lamp
 * over it once the walls are at their height.
 */
export function oasisWall(level: number, color: number, k: WallKit, bakeFn: (o: THREE.Object3D, tag?: Record<string, unknown>) => THREE.Group): THREE.Group {
  const g = new THREE.Group();
  if (level <= 0) return g;
  const tier = level < 5 ? 1 : level < 10 ? 2 : level < 15 ? 3 : 4;
  const { R, gateA, gateHalf } = k;
  const start = gateA + gateHalf, end = gateA + Math.PI * 2 - gateHalf;
  const stone = tier >= 3;
  const h = tier === 1 ? 2.6 : tier === 2 ? 3.6 : tier === 3 ? 3.4 : 4.6;
  const thick = tier === 1 ? 0.9 : tier === 2 ? 1.2 : tier === 3 ? 1.6 : 2.0;
  const wall = stone ? SAND : MUD, dark = stone ? SAND_DK : MUD_DK;
  const segs = 40;
  for (let i = 0; i < segs; i++) {
    const a0 = start + ((end - start) * i) / segs, a1 = start + ((end - start) * (i + 1)) / segs;
    const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
    const len = Math.hypot(x1 - x0, z1 - z0) + 0.15;
    const seg = new THREE.Group();
    // (local -z faces out of the village)
    seg.add(box(len, h, thick, wall));
    seg.add(box(len, 0.5, thick + 0.24, dark));
    if (stone) {
      for (const s of [-1, 1]) seg.add(box(len, 0.28, 0.06, TURQ_DK, 0, h * 0.7, s * (thick / 2 + 0.03)));
      seg.add(box(len, 0.2, thick + 0.3, SAND_LT, 0, h - 0.12, 0));
      const nm = Math.max(2, Math.round(len / 1.25));
      for (let m = 0; m < nm; m++) {
        const x = -len / 2 + (m + 0.5) * (len / nm);
        seg.add(merlon(0.62, wall, 0.4).translateX(x).translateY(h).translateZ(-thick / 2 + 0.2));
      }
      // a low parapet along the walk on the village side
      seg.add(box(len, 0.45, 0.28, wall, 0, h, thick / 2 - 0.14));
      if (i % 3 === 1) hangLamp(seg, 0, h - 0.45, thick / 2 + 0.4, 0.05, 0.6);
      if (i % 4 === 2) star8(seg, 0, h * 0.42, -thick / 2 - 0.02, 0.7, TURQ, GOLD);
    } else {
      // a rounded coping, little pinnacles along the top and palm-wood beams jutting out of both faces
      seg.add(cyl(thick * 0.5, thick * 0.5, len, dark, 6, 0, h, 0).rotateZ(Math.PI / 2));
      const np = Math.max(2, Math.round(len / 1.1));
      for (let m = 0; m < np; m++) seg.add(cone(0.2, 0.62, wall, 5, -len / 2 + (m + 0.5) * (len / np), h + 0.2, 0));
      for (const s of [-1, 1]) toron(seg, len, h * 0.6, s * (thick / 2 + 0.1), 1.2);
      if (i % 2 === 0) {
        seg.add(box(0.6, h + 0.3, thick + 0.5, wall, len / 2, 0, 0));
        seg.add(cone(0.34, 0.9, wall, 5, len / 2, h + 0.3, 0));
      }
    }
    seg.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    seg.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(seg);
  }
  // towers
  if (tier === 2) {
    for (let i = 0; i < 8; i++) {
      const a = gateA + gateHalf + 0.35 + (i / 8) * (Math.PI * 2 - gateHalf * 2 - 0.5);
      const tw = mudTower(1.5, 6.4);
      tw.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      tw.rotation.y = -a;
      g.add(tw);
    }
  } else if (tier >= 3) {
    const towers = tier === 3 ? 8 : 12;
    for (let i = 1; i < towers - 1; i++) {
      const a = start + ((end - start) * i) / (towers - 1);
      const tw = oasisTower(tier === 3 ? 2.3 : 2.7, tier === 3 ? 6 : 8, { roof: tier === 4 ? TURQ : null });
      tw.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      g.add(tw);
      // lanterns on the tower's inner face
      const ia = a + Math.PI;
      const tr = (tier === 3 ? 2.3 : 2.7) + 0.35;
      for (const s of [-0.45, 0.45]) hangLamp(g, Math.cos(a) * R + Math.cos(ia + s) * tr, (tier === 3 ? 6 : 8) * 0.62, Math.sin(a) * R + Math.sin(ia + s) * tr, 0.1, 0.7);
    }
  }
  // the gate
  const gz = R * Math.cos(gateHalf), W = 2 * R * Math.sin(gateHalf);
  if (tier === 1) {
    for (const s of [-1, 1]) {
      const p = new THREE.Group();
      p.add(box(1.4, h + 1.6, 1.4, MUD));
      p.add(cone(0.5, 1.1, MUD, 5, 0, h + 1.6, 0));
      for (const z of [-0.8, 0.8]) toron(p, 1.2, h * 0.7, z, 0.5);
      p.position.set(s * W / 2, 0, gz);
      g.add(p);
    }
    for (let i = 0; i < 3; i++) g.add(cyl(0.16, 0.16, W + 1.2, PALM_WOOD, 6, 0, h + 1.1 + i * 0.3, gz + (i - 1) * 0.1).rotateZ(Math.PI / 2));
    for (let i = 0; i < 6; i++) g.add(mesh(leafGeo(1.4, 0.34), i % 2 ? FROND : FROND_DK).translateX(-W / 2 + 1.2 + i * 1.6).translateY(h + 1.6).translateZ(gz).rotateY(Math.PI / 2 + (i % 2 ? 0.3 : -0.3)).rotateZ(-0.4));
  } else {
    const gh = tier === 2 ? 7.2 : tier === 3 ? 7.6 : 9.8;
    const gr = tier === 2 ? 1.8 : tier === 3 ? 2.5 : 2.9;
    const aw = 4.4, ah = h + (stone ? 1.4 : 1.0), fh = ah + (stone ? 2.2 : 1.7);
    const front = extrude(gatePts(W, fh, aw, ah), thick + 0.7, stone ? SAND : MUD);
    front.position.set(0, 0, gz);
    g.add(front);
    const band = extrude(gatePts(aw + 0.9, ah + 0.7, aw + 0.02, ah + 0.02), 0.12, stone ? TURQ_DK : MUD_DK);
    band.position.set(0, 0, gz + (thick + 0.7) / 2 + 0.05);
    g.add(band);
    if (stone) {
      const gold = extrude(gatePts(aw + 0.4, ah + 0.32, aw + 0.02, ah + 0.02), 0.08, GOLD);
      gold.position.set(0, 0, gz + (thick + 0.7) / 2 + 0.12);
      g.add(gold);
      crenels(g, W - 2 * gr + 0.6, thick + 0.7, fh, SAND, 0.5, 0, gz);
      g.add(box(W - 2 * gr + 0.8, 0.22, thick + 1.0, SAND_LT, 0, fh - 0.1, gz));
      g.add(box(W - 2 * gr + 0.6, 0.3, 0.06, TURQ_DK, 0, fh - 0.75, gz + (thick + 0.7) / 2 + 0.03));
    } else {
      for (let m = 0; m < 3; m++) g.add(cone(0.22, 0.7, MUD, 5, -1.0 + m, fh, gz));
      for (const z of [-1, 1]) toron(g, W - 2 * gr, fh - 1.0, gz + z * ((thick + 0.7) / 2 + 0.1), 0.8);
    }
    // the doors, brass-studded cedar, swung open against the inner walls of the arch
    for (const s of [-1, 1]) {
      const d = new THREE.Group();
      d.add(box(aw / 2 - 0.1, ah * 0.66, 0.14, CEDAR));
      for (let r0 = 0; r0 < 3; r0++) for (let c0 = 0; c0 < 2; c0++) d.add(box(0.1, 0.1, 0.05, stone ? GOLD : IRON_OA, -aw / 8 + c0 * aw / 4 - 0.02, ah * (0.12 + r0 * 0.2), 0.09));
      d.position.set(s * (aw / 2 - 0.1), 0, gz - (thick + 0.7) / 2 - aw / 4);
      d.rotation.y = s * (Math.PI / 2 - 0.25);
      g.add(d);
    }
    // the gate towers
    for (const s of [-1, 1]) {
      const tw = stone ? oasisTower(gr, gh, { roof: TURQ, banner: tier === 4 ? color : undefined }) : mudTower(gr, gh);
      tw.position.set(s * W / 2, 0, gz);
      if (!stone) tw.rotation.y = -gateA;
      g.add(tw);
    }
    // over the arch: a star of tile, or (the walls at their height) the Djinn's golden lamp
    if (stone) {
      if (level >= 20) {
        const lamp = magicLamp(0.9, true);
        lamp.position.set(0.1, ah + 0.4, gz + (thick + 0.7) / 2 + 0.3);
        g.add(lamp);
        for (let i = 0; i < 9; i++) {
          const a = (i / 8) * Math.PI;
          g.add(box(0.1, 0.9, 0.04, GOLD, Math.cos(a) * 1.35, ah + 0.9 + Math.sin(a) * 1.0, gz + (thick + 0.7) / 2 + 0.1).rotateZ(a - Math.PI / 2));
        }
      } else star8(g, 0, ah + 1.0, gz + (thick + 0.7) / 2 + 0.1, 1.1, TURQ, GOLD);
    }
  }
  const baked = bakeFn(g, { building: 'wall' });
  // (at level 20 the ruler's own banners take over: flags3d.ts)
  if (tier === 4 && level < 20) {
    for (const s of [-1, 1]) {
      const pole = new THREE.Group();
      pole.add(cyl(0.07, 0.07, 3, GOLD_DK, 5));
      const fg = new THREE.Group();
      fg.add(box(1.6, 1.0, 0.06, color, 0.8, 1.8, 0));
      fg.userData.flag = true;
      pole.add(fg);
      pole.position.set(s * W / 2, 9.8 + 3.6, gz);
      pole.traverse((c) => (c.userData.building = 'wall'));
      baked.add(pole);
    }
  }
  return baked;
}

/** A round tower of mud brick, beams jutting from it, a crenellated deck on top under a shade of palm fronds. */
function mudTower(r: number, h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(r * 0.84, r, h, MUD, 9));
  g.add(cyl(r * 1.04, r * 1.08, 0.5, MUD_DK, 9));
  for (let k = 0; k < 2; k++) for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + k * 0.4;
    const rr = r * (0.97 - k * 0.07);
    g.add(cyl(0.07, 0.07, 0.6, PALM_WOOD, 4, Math.cos(a) * rr, h * (0.35 + k * 0.3), Math.sin(a) * rr).rotateZ(Math.PI / 2).rotateX(0).rotateY(0));
  }
  g.add(cyl(r * 0.95, r * 0.9, 0.3, MUD_DK, 9, 0, h - 0.1));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    g.add(cone(0.18, 0.55, MUD, 5, Math.cos(a) * r * 0.86, h + 0.2, Math.sin(a) * r * 0.86));
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(cyl(0.05, 0.05, 1.7, PALM_WOOD, 4, x * r * 0.5, h, z * r * 0.5));
  g.add(box(r * 1.3, 0.08, r * 1.3, C.thatch, 0, h + 1.7, 0));
  for (let i = 0; i < 4; i++) g.add(box(0.22, 0.06, r * 1.5, i % 2 ? FROND_DK : FROND, -r * 0.5 + i * r * 0.34, h + 1.78, 0));
  archWin(g, 0, h * 0.6, r * 0.9, 0.3, 0.6);
  return g;
}

// ---------- the land round the Oasis ----------

export interface GroundKit {
  at: (x: number, z: number) => number;
  free: (x: number, z: number) => boolean;
  motes: (g: THREE.Group, r: () => number, n: number, color: number, emissive: number, around: (i: number) => [number, number, number]) => void;
  wallR: number;
}

/**
 * A winged lion, the Oasis's guardian: couched on a plinth of sandstone banded in tile, its wings raised
 * behind it, a maned head held high with eyes of gold, a gilded collar.
 */
export function wingedLion(s = 1, color: number = SAND_LT): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.6 * s, 0.9 * s, 2.6 * s, SAND_DK));
  g.add(box(1.66 * s, 0.16 * s, 2.66 * s, TURQ_DK, 0, 0.5 * s, 0));
  g.add(box(1.72 * s, 0.14 * s, 2.72 * s, SAND_LT, 0, 0.88 * s, 0));
  const y = 0.98 * s;
  g.add(blob(0.62 * s, color, 0, y + 0.5 * s, -0.3 * s, 0.85, 0.72, 1.45));
  g.add(blob(0.46 * s, color, 0, y + 0.55 * s, 0.35 * s, 1, 1.1, 0.9));
  for (const x of [-1, 1]) {
    g.add(blob(0.36 * s, color, x * 0.36 * s, y + 0.36 * s, -0.75 * s, 0.8, 0.9, 1.2));
    g.add(box(0.24 * s, 0.22 * s, 0.9 * s, color, x * 0.26 * s, y, 0.62 * s));
    g.add(blob(0.16 * s, color, x * 0.26 * s, y + 0.1 * s, 1.1 * s, 1, 0.7, 1.2));
  }
  const head = lionHead(0.62 * s, color);
  head.position.set(0, y + 1.25 * s, 0.62 * s);
  g.add(head);
  g.add(mesh(new THREE.TorusGeometry(0.34 * s, 0.06 * s, 4, 12).rotateX(Math.PI / 2 - 0.4), GOLD).translateY(y + 0.82 * s).translateZ(0.5 * s));
  // the wings: feathered fans raised and swept back
  const pts: [number, number][] = [[0, 0], [0.6, -0.1], [1.5, 0.2], [2.3, 1.0], [2.05, 1.0], [2.05, 1.45], [1.75, 1.35], [1.62, 1.8], [1.32, 1.6], [1.1, 1.95], [0.85, 1.62], [0.5, 1.6], [0.2, 0.9]];
  for (const x of [-1, 1]) {
    const wg = new THREE.Group();
    const w = extrude(pts.map(([a, b]) => [a * s, b * s] as [number, number]), 0.1 * s, color);
    w.rotation.y = Math.PI / 2;
    wg.add(w);
    const w2 = extrude(pts.map(([a, b]) => [a * s * 0.72, b * s * 0.55] as [number, number]), 0.14 * s, GOLD);
    w2.rotation.y = Math.PI / 2;
    w2.position.set(x * 0.02 * s, 0.1 * s, 0);
    wg.add(w2);
    wg.position.set(x * 0.46 * s, y + 0.72 * s, 0.4 * s);
    wg.rotation.z = x * 0.62;
    wg.rotation.x = 0.18;
    g.add(wg);
  }
  const tail = limb(V(0, y + 0.4 * s, -1.0 * s), V(0.5 * s, y + 0.1 * s, -0.6 * s), 0.06 * s, 0.05 * s, color);
  g.add(tail);
  return g;
}

/** A little nomad tent of striped cloth, open at the front on two poles. */
function nomadTent(s: number, cols: number[]): THREE.Group {
  const g = new THREE.Group();
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = (-n / 2 + i + 0.5) * 0.7 * s;
    for (const side of [-1, 1]) {
      const b = box(0.71 * s, 0.05, 1.5 * s, cols[i % cols.length], 0, 0, 0);
      b.geometry.translate(0, 0, side * 0.75 * s);
      b.position.set(x, 1.6 * s, 0);
      b.rotation.x = side * 0.62;
      g.add(b);
    }
  }
  for (const x of [-1.6, 1.6]) g.add(cyl(0.05, 0.05, 1.6 * s, CEDAR, 4, x * s, 0, 0));
  g.add(box(3.5 * s, 0.06, 0.06, CEDAR, 0, 1.62 * s, 0));
  g.add(box(3.4 * s, 0.8 * s, 0.05, INDIGO, 0, 0, -1.2 * s));
  return g;
}

/** A broken colonnade half-sunk in the sand, a fallen lintel still showing its tiles. */
function ruin(r: () => number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const h = 1.2 + r() * 2.2;
    g.add(cyl(0.3, 0.34, h, SAND_LT, 8, i * 1.4, 0, 0));
    g.add(box(0.8, 0.26, 0.8, SAND, i * 1.4, 0, 0));
    if (h > 2.6) g.add(box(0.8, 0.3, 0.8, SAND_LT, i * 1.4, h, 0));
  }
  const l = box(3.2, 0.5, 0.7, SAND, 0, 0, 0);
  l.position.set(1.6, 0.2, 1.3);
  l.rotation.set(0.1, 0.3, 0.06);
  g.add(l);
  g.add(box(2.4, 0.16, 0.05, TURQ_DK, 1.6, 0.5, 1.66).rotateY(0.3));
  g.add(blob(0.9, 0xd8b878, 0.6, 0, 0.6, 1.8, 0.4, 1.2));
  return g;
}

/**
 * The Oasis's land outside the walls: before the gate, the oasis itself (a pool of turquoise water ringed
 * with reeds and date palms, a nomad camp at its edge with kneeling camels and a fire), winged lions
 * guarding the road and lamp-posts down it; in the dunes, ruins of an older city, lone palms and tents,
 * a caravan resting, and specks of gold drifting on the wind.
 */
export function addOasis(g: THREE.Group, r: () => number, k: GroundKit): void {
  const { at } = k;
  const cx = 21, cz = 57.5;
  const y0 = at(cx, cz);
  const water = (x: number, z: number, rad: number, dy: number) => {
    g.add(cyl(rad + 1.0, rad + 1.2, 0.2, 0x8a9a4c, 16, x, at(x, z) - 0.1, z));
    const w = mesh(new THREE.CylinderGeometry(rad, rad, 0.1, 16), WATER_OA, { emissive: WATER_E });
    w.position.set(x, y0 + 0.12 + dy, z);
    g.add(w);
  };
  water(cx, cz, 3.6, 0);
  water(cx + 2.4, cz + 1.6, 2.6, 0.005);
  water(cx - 2.2, cz + 1.2, 2.2, 0.01);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r() * 0.3, d = 4.1 + r() * 0.8;
    const x = cx + 0.3 + Math.cos(a) * d * 1.1, z = cz + 0.6 + Math.sin(a) * d * 0.9;
    for (let j = 0; j < 3; j++) g.add(cone(0.06, 1.0 + r() * 0.6, j % 2 ? 0x6a8a3a : 0x8aa24a, 3, x + (r() - 0.5) * 0.5, at(x, z) - 0.05, z + (r() - 0.5) * 0.5));
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3, d = 6.2 + r() * 1.8;
    const x = cx + Math.cos(a) * d * 1.15, z = cz + Math.sin(a) * d * 0.95;
    const p = palm(4.5 + r() * 2.2, r, { dates: r() < 0.6 });
    p.position.set(x, at(x, z) - 0.1, z);
    g.add(p);
  }
  // the camp at its edge
  for (const [dx, dz, ry, c] of [[-8.6, -2.6, 0.6, 0], [8.2, 5.2, -2.2, 1], [3.5, -8.6, 0.1, 3]] as [number, number, number, number][]) {
    const x = cx + dx, z = cz + dz;
    const tn = nomadTent(1, STRIPES[c]);
    tn.position.set(x, at(x, z) - 0.05, z);
    tn.rotation.y = ry;
    g.add(tn);
  }
  for (const [dx, dz, ry] of [[-6.4, 2.6, 1.2], [-4.4, 4.4, 2.4], [6.8, -3.4, -0.6]] as [number, number, number][]) {
    const x = cx + dx, z = cz + dz;
    const c = camel([CAMEL, CAMEL_LT, 0xa87a4a][Math.floor(r() * 3)], { kneel: true, blanket: r() < 0.5 ? CRIMSON : TURQ_DK });
    c.position.set(x, at(x, z), z);
    c.rotation.y = ry;
    g.add(c);
  }
  {
    const x = cx - 7.2, z = cz + 6.4, y = at(x, z);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(blob(0.2, SAND_DK, x + Math.cos(a) * 0.6, y + 0.05, z + Math.sin(a) * 0.6, 1, 0.6, 1)); }
    g.add(glow(new THREE.CylinderGeometry(0.4, 0.45, 0.1, 7), COAL, COAL_E).translateX(x).translateY(y + 0.08).translateZ(z));
    g.add(glow(new THREE.ConeGeometry(0.3, 0.7, 6).translate(0, 0.35, 0), FLAME_C, FLAME_E).translateX(x).translateY(y + 0.1).translateZ(z));
    for (const [dx, dz, c] of [[1.0, 0.5, CRIMSON], [-0.9, 0.7, SAFFRON], [0.2, -1.1, INDIGO]] as [number, number, number][]) g.add(cushion(x + dx, z + dz, c).translateY(y));
  }
  // winged lions at the road out of the gate, lamp-posts down it
  for (const x of [-4.4, 4.4]) {
    const z = 52.5;
    const l = wingedLion(1.0);
    l.position.set(x, at(x, z), z);
    l.rotation.y = x < 0 ? 0.25 : -0.25;
    g.add(l);
  }
  for (const z of [61, 70, 79]) for (const x of [-3.9, 3.9]) {
    const lp = lampPost(3.0, 1.0);
    lp.position.set(x, at(x, z), z);
    lp.rotation.y = x < 0 ? 0 : Math.PI;
    g.add(lp);
  }
  // the dunes: ruins, lone palms, tents, a caravan at rest, scrub
  let placed = 0;
  for (let tries = 0; tries < 1200 && placed < 56; tries++) {
    const a = r() * Math.PI * 2, d = k.wallR + 7 + r() * 76;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!k.free(x, z)) continue;
    if (Math.hypot(x - cx, z - cz) < 14) continue;
    const y = at(x, z);
    const kind = placed % 9;
    if (kind === 0 && placed % 18 === 0) {
      const ru = ruin(r);
      ru.position.set(x, y - 0.2, z);
      ru.rotation.y = r() * Math.PI;
      g.add(ru);
    } else if (kind === 1 || kind === 5) {
      for (let j = 0; j < 1 + Math.floor(r() * 3); j++) {
        const p = palm(3.6 + r() * 2.4, r);
        p.position.set(x + (r() - 0.5) * 3, y - 0.1, z + (r() - 0.5) * 3);
        g.add(p);
      }
    } else if (kind === 2 && placed % 18 === 2) {
      const tn = nomadTent(0.8, STRIPES[Math.floor(r() * STRIPES.length)]);
      tn.position.set(x, y - 0.05, z);
      tn.rotation.y = r() * 6;
      g.add(tn);
    } else if (kind === 3 && placed % 27 === 3) {
      // a caravan at rest: camels in a line, knelt in the sand
      const ry = r() * 6;
      for (let j = 0; j < 3; j++) {
        const c = camel([CAMEL, CAMEL_LT, 0xa87a4a][j], { kneel: true, blanket: [CRIMSON, SAFFRON, TURQ_DK][j] });
        c.position.set(x + Math.cos(ry) * j * 2.2, y, z - Math.sin(ry) * j * 2.2);
        c.rotation.y = ry;
        g.add(c);
      }
    } else if (kind === 4) {
      g.add(blob(0.9 + r() * 0.6, C.rock, x, y + 0.25, z, 1.3, 0.7, 1.1));
      g.add(blob(0.5 + r() * 0.3, C.rockDark, x + 0.9, y + 0.1, z + 0.4, 1.2, 0.6, 1));
    } else {
      for (let j = 0; j < 3; j++) g.add(blob(0.3 + r() * 0.2, j % 2 ? 0x8a8a5a : 0x7a7a4a, x + (r() - 0.5) * 1.6, y + 0.12, z + (r() - 0.5) * 1.6, 1.2, 0.6, 1));
    }
    placed++;
  }
  // specks of gold on the wind
  k.motes(g, r, 22, 0xffe08a, 0xc08a1a, () => {
    const a = r() * Math.PI * 2, d = 8 + r() * 70;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    return [x, (Math.hypot(x, z) > k.wallR ? at(x, z) : 0) + 1.5 + r() * 5, z];
  });
}

/** A landmark for the open spots inside the walls: a fountain among palms, a winged lion, a tiled well under palms, or a lamp pillar. */
export function oasisLandmark(r: () => number, i: number): THREE.Group {
  const g = new THREE.Group();
  switch (i % 4) {
    case 0: {
      g.add(fountain(1.2, 2));
      for (const a of [0.8, 3.6]) { const p = pottedPalm(2.4, r); p.position.set(Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9); g.add(p); }
      break;
    }
    case 1: {
      const l = wingedLion(0.85);
      g.add(l);
      break;
    }
    case 2: {
      g.add(cyl(0.7, 0.75, 0.7, SAND, 8));
      g.add(cyl(0.76, 0.76, 0.1, TURQ_DK, 8, 0, 0.6));
      g.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 8).translate(0, 0.62, 0), WATER_OA, { emissive: WATER_E }));
      for (const x of [-0.6, 0.6]) g.add(box(0.12, 1.6, 0.12, CEDAR, x, 0.6, 0));
      g.add(box(1.4, 0.12, 0.12, CEDAR, 0, 2.2, 0));
      g.add(cone(0.9, 0.6, TURQ, 4, 0, 2.2, 0).rotateY(Math.PI / 4));
      for (const a of [0.4, 2.5, 4.4]) { const p = palm(3.4 + r() * 1.2, r); p.position.set(Math.cos(a) * 1.7, 0, Math.sin(a) * 1.7); g.add(p); }
      break;
    }
    default: {
      g.add(cyl(0.6, 0.7, 0.5, SAND_DK, 8));
      g.add(cyl(0.3, 0.36, 3.4, SAND_LT, 8, 0, 0.5));
      for (const y of [1.4, 2.6]) g.add(cyl(0.34, 0.34, 0.14, TURQ_DK, 8, 0, y));
      g.add(cyl(0.5, 0.36, 0.3, SAND, 8, 0, 3.9));
      const l = lantern(1.6);
      l.position.y = 4.8;
      g.add(l);
      g.add(finial(0.5).translateY(5.6));
    }
  }
  return g;
}

/** A street lamp of the Oasis. */
export function oasisStreetLamp(): THREE.Group {
  return lampPost(3.0, 1.0);
}

// ---------- the smaller hooks ----------

/** A visiting army's tent in the Oasis's fashion: a round pavilion in saffron and linen stripes under a teal roof, a gold finial, a rug at the door. */
export function oasisTent(): THREE.Group {
  const g = new THREE.Group();
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = box(0.78, 1.3, 0.05, i % 2 ? SAFFRON : LINEN, Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2);
    p.rotation.y = -a + Math.PI / 2;
    g.add(p);
  }
  g.add(cone(1.55, 1.5, TURQ_DK, n, 0, 1.3));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    const sc = cone(0.24, 0.3, i % 2 ? CRIMSON : SAFFRON, 3, Math.cos(a) * 1.45, 1.32, Math.sin(a) * 1.45);
    sc.rotation.x = Math.PI;
    g.add(sc);
  }
  g.add(finial(0.55).translateY(2.75));
  g.add(archMesh(0.7, 1.1, 0.06, SHADOW).translateZ(1.21));
  g.add(rug(1.0, 0.5, CRIMSON, INDIGO, SAFFRON).translateY(0.02).translateZ(1.5));
  g.add(lampPost(1.0, 0.6).translateX(0.85).translateZ(1.3));
  return g;
}

/** The board a door sign hangs on: a pointed arch of teal tile in a rim of gold. */
export function oasisPlaque(): THREE.Group {
  const g = new THREE.Group();
  const board = extrude(archPts(1.2, 1.4), 0.09, TURQ_DK);
  board.position.y = -0.96;
  g.add(board);
  const rim = extrude(archPts(1.36, 1.56), 0.05, GOLD);
  rim.position.set(0, -1.04, -0.04);
  g.add(rim);
  return g;
}

/** Mastery's standards at a finished building's corners: brass lamp-posts flying teal pennants. */
export function oasisStandard(h: number): THREE.Group {
  return lampPost(h, 1.0, TURQ);
}

/** Mastery's crown over a finished building: a little golden lamp turning in the air, a wisp of smoke above it and gold motes about it. */
export function oasisCrown(s: number): THREE.Group {
  const g = new THREE.Group();
  const l = magicLamp(0.4 * s);
  l.position.set(-0.2 * s, 0.4 * s, 0);
  g.add(l);
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.IcosahedronGeometry(0.08 * s + i * 0.03 * s, 0), SMOKE_C, { emissive: SMOKE_E, opacity: 0.7 }).translateX(0.4 * s + Math.sin(i * 1.4) * 0.1 * s).translateY(0.8 * s + i * 0.22 * s));
  for (let i = 0; i < 6; i++) g.add(glow(new THREE.OctahedronGeometry(0.07 * s, 0), 0xffe08a, 0xc08a1a).translateX(Math.cos(i) * 0.9 * s).translateY(0.3 * s + (i % 3) * 0.3 * s).translateZ(Math.sin(i) * 0.9 * s));
  return moving(g, { orbit: 0.5, bob: 0.15 * s });
}

/**
 * The Djinn at home: a whirl of sand and gold spinning up round his statue (the desert wind he commands,
 * and the tribute it brings), blue smoke curling from his lamp, and orbs of light drifting over the village.
 */
export function oasisAura(sx: number, sz: number, r: () => number): { group: THREE.Group; step: (dt: number, t: number) => void } {
  const g = new THREE.Group();
  const sand = new THREE.Group();
  for (let i = 0; i < 34; i++) {
    const k = i / 33;
    const a = k * 3.2 * Math.PI * 2;
    const rad = 2.6 + k * 1.6;
    sand.add(mesh(new THREE.IcosahedronGeometry(0.22 + k * 0.28, 0), i % 3 ? 0xe8cf9a : 0xd8b878, { opacity: 0.42 }).translateX(Math.cos(a) * rad).translateY(0.3 + k * 7.5).translateZ(Math.sin(a) * rad));
  }
  const sw = swarm(sand, {});
  sw.position.set(sx, 0, sz);
  g.add(sw);
  const gold = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, y = 1.2 + (i % 5) * 1.3;
    gold.add(glow(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 8).rotateX(Math.PI / 2 - 0.3), 0xffd35a, 0xb07a10).translateX(Math.cos(a) * 3.0).translateY(y).translateZ(Math.sin(a) * 3.0));
  }
  const gs = swarm(gold, {});
  gs.position.set(sx, 0, sz);
  g.add(gs);
  const smoke = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const k = i / 13, a = k * 1.6 * Math.PI * 2;
    smoke.add(mesh(new THREE.IcosahedronGeometry(0.18 + k * 0.45, 0), SMOKE_C, { emissive: SMOKE_E, opacity: 0.5 }).translateX(Math.cos(a) * (0.2 + k * 1.0)).translateY(k * 6).translateZ(Math.sin(a) * (0.2 + k * 1.0)));
  }
  const sm = swarm(smoke, {});
  sm.position.set(sx + 0.5, 4.3, sz);
  g.add(sm);
  const drift = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = 8 + Math.sqrt(r()) * 28;
    drift.add(glow(new THREE.IcosahedronGeometry(0.22, 1), ORB, ORB_E).translateX(Math.cos(a) * d).translateY(5 + r() * 6).translateZ(Math.sin(a) * d));
  }
  const dr = swarm(drift, {});
  g.add(dr);
  return {
    group: g,
    step(_dt, t) {
      sw.rotation.y = t * 1.3;
      gs.rotation.y = -t * 0.9;
      gs.position.y = Math.sin(t * 1.1) * 0.5;
      sm.rotation.y = t * 0.7;
      dr.rotation.y = t * 0.035;
      dr.position.y = Math.sin(t * 0.5) * 0.5;
    },
  };
}

// ---------- the battle's siege engines ----------

/** The brass ram, as it rolls into battle: a canopy striped teal and linen over the frame, brass rings round the beam and a brass lion's head on its end. */
export function oasisRamDress(frame: THREE.Group | null, log: THREE.Group | null): void {
  if (frame) for (let i = 0; i < 6; i++) frame.add(box(0.33, 0.06, 3.54, i % 2 ? LINEN : TURQ_DK, -0.82 + i * 0.33, 2.57, 0));
  if (!log) return;
  for (const z of [-2.4, -0.8, 0.8]) log.add(cyl(0.33, 0.33, 0.14, BRASS, 8, 0, 0, z).rotateX(Math.PI / 2));
  const head = lionHead(0.5, BRASS);
  head.position.set(0, 0, 2.15);
  log.add(head);
}

/** The sun engine in the field: a great mirror of gold on the frame's front, turned to the sky. */
export function oasisEngineDress(frame: THREE.Group): void {
  const p = [[0.001, 0], [0.4, 0.04], [0.72, 0.14], [0.9, 0.28]];
  const dish = mesh(new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), 10), GOLD);
  // (on the frame's flank, clear of the throwing arm)
  dish.position.set(-1.15, 1.35, 0.9);
  dish.rotation.set(0.9, 0, 0.5);
  frame.add(dish);
  frame.add(limb(V(-0.75, 0.5, 0.8), V(-1.1, 1.3, 0.9), 0.07, 0.06, BRASS, 5));
}

/** A sun engine's shot: a ball of gathered sunlight, white-hot at the heart. */
export function sunShot(): THREE.Group {
  const g = new THREE.Group();
  g.add(glow(new THREE.IcosahedronGeometry(0.3, 1), 0xfff4c0, 0xffc840));
  g.add(mesh(new THREE.IcosahedronGeometry(0.5, 1), 0xffd060, { emissive: 0xd08a10, opacity: 0.5 }));
  return g;
}

/** The stable's sign in the Oasis: a golden camel (in the sign's plane, facing +x). */
export function oasisStableEmblem(): THREE.Group {
  const g = new THREE.Group();
  const z = 0.14;
  g.add(box(0.5, 0.18, 0.05, GOLD, -0.02, -0.08, z));
  g.add(blob(0.13, GOLD, -0.04, 0.12, z, 1.3, 0.9, 0.35));
  for (const x of [-0.2, -0.1, 0.1, 0.18]) g.add(box(0.05, 0.34, 0.05, GOLD, x, -0.42, z));
  const neck = box(0.07, 0.3, 0.05, GOLD, 0.26, -0.04, z);
  neck.rotation.z = -0.6;
  g.add(neck);
  g.add(box(0.16, 0.08, 0.05, GOLD, 0.4, 0.2, z));
  return g;
}

/** The odd things left about the streets, in the Oasis's way: melons for pumpkins, sacks for hay, water jars for barrels, brass-bound chests for crates. */
export function oasisProp(kind: string, x: number, z: number, s = 1): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'pumpkin') {
    g.add(blob(0.36 * s, 0x4e8a30, 0, 0.26 * s, 0, 1.25, 0.8, 1));
    g.add(box(0.5 * s, 0.03, 0.06, 0x2e5a1e, 0, 0.5 * s, 0));
  } else if (kind === 'hay') {
    for (let i = 0; i < 3; i++) g.add(blob(0.4 * s, i % 2 ? 0xd8c08a : 0xc8a870, (i - 1) * 0.55 * s, 0.3 * s, (i % 2) * 0.3 * s, 1.1, 0.8, 1));
    g.add(blob(0.36 * s, 0xd8c08a, 0, 0.8 * s, 0.1 * s, 1.1, 0.8, 1));
  } else if (kind === 'barrel') {
    g.add(jar(1.1 * s, TERRA, true));
  } else {
    g.add(box(0.8 * s, 0.5 * s, 0.55 * s, CEDAR));
    g.add(box(0.84 * s, 0.08 * s, 0.59 * s, BRASS, 0, 0.5 * s, 0));
    for (const x0 of [-0.25, 0.25]) g.add(box(0.06 * s, 0.52 * s, 0.6 * s, BRASS, x0 * s, 0, 0));
  }
  g.position.set(x, 0, z);
  return g;
}
