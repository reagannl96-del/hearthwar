// Frosthold: the Frost Queen's court of the frozen north. Her seat grows from a hunters'
// camp of snow-block igloos round a hearth into a white stone lodge hung with icicles,
// then an ice keep bristling with faceted spires, a crystal palace whose open throne hall
// glows cold blue beside a frozen waterfall, and at last a palace of glittering spires
// crowned by a slowly turning crown of ice under a pillar of aurora light.
//
// The look: faceted ice in pale blues that seem lit from within (cyan glowing in the cores),
// snow-laden white stone, ice-blue slate roofs under a blanket of snow, silver and pale birch,
// frost-blue banners with a snowflake, and white fur. Everything that stands still is baked
// with its building (one mesh per material); the moving parts are a few flames and banners,
// the crown, the owls, the skaters and merged swarms of glints.
//
// NOTE: kit.ts imports this module (for the frost houses and towers), so nothing here may read
// kit's values while the modules load: only plain numbers at the top level, the rest in functions.

import * as THREE from 'three';
import type { BuildingId } from '../../engine/types';
import type { Built } from './buildings';
import { C, bake, blob, box, cone, cyl, detailMat, extrude, getSeason, horn, limb, mat, mesh, rng, swarm } from './kit';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Merge a moving part (built at the origin) into one mesh per material, and flag it to move (wave, spin, orbit). */
function moving(g: THREE.Group, flags: Record<string, unknown>): THREE.Group {
  const b = bake(g);
  Object.assign(b.userData, { dynamic: true }, flags);
  return b;
}

// ---------- the court's colours (none is a palette key, so no season or theme repaints them) ----------

export const SNOWW = 0xf3f7fa;
const SNOW_SH = 0xdbe5ee;
/** faceted ice: pale, mid and deep, each faintly lit from within */
export const ICE = 0xc4e8f9, ICE_E = 0x173f5a;
const ICE_MID = 0x93cdec, ICE_MID_E = 0x143d60;
const ICE_DEEP = 0x5fa2d3, ICE_DEEP_E = 0x0e3256;
/** the cold glow in the heart of the ice (lanterns, cores, the throne) */
export const GLOW = 0xd8f7ff, GLOW_E = 0x3cb2e8;
const ICICLE = 0xdcf2fb;
export const SILVER = 0xcad4df;
const SILVER_DK = 0x8a97a8;
const BIRCH = 0xebe6da, BIRCH_MK = 0x3f3a36, PALE_WD = 0xcdbf9f, PALE_WD_DK = 0x9a8c70;
export const FROST_BLUE = 0x5b9bd8;
const FROST_NAVY = 0x243f6a;
export const FUR_W = 0xf0ece4;
const FUR_G = 0xa9a398, FUR_B = 0x6f5b47, FUR_DK = 0x4b3f33;
const SKIN = 0xf2ddce, HAIR_W = 0xeef3f8, HAIR_G = 0xdcc68e;
const AMBER = 0xffb648, AMBER_E = 0xb8601a;
const FLAME = 0xffa648, FLAME_E = 0xc0561a;
const CFLAME = 0xbff2ff, CFLAME_E = 0x2c9ee0;
/** ice-blue slate under the snow, pale and deep */
const ROOF_SLATE = 0x6390c2, ROOF_PALE = 0x82aad4, ROOF_DEEP = 0x4a6f9c;
/** a frieze of glazed ice-blue tiles under the eaves */
const FRIEZE = 0x9cc4e4;
const DOOR_DK = 0x2c3a52, VOID = 0x162133;
const IVORY = 0xeee6d2;
/** the crystal palace's walls: ice so pale and clear it seems lit from within */
const PALACE = 0xd4ebfa, PALACE_E = 0x12344e;

/** A small bright thing that casts no shadow (glowing cores, lantern glass, glints). */
function glow(geo: THREE.BufferGeometry, c = GLOW, e = GLOW_E): THREE.Mesh {
  return new THREE.Mesh(geo, detailMat(c, { emissive: e }));
}

/** A little repeatable jitter (0..1). */
function jit(i: number, s = 0): number {
  const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

// ---------- ice ----------

/** A faceted crystal of ice standing on y=0: a six-sided shaft that ends in a point. */
function crystalGeo(r: number, h: number, seg = 6): THREE.BufferGeometry {
  return new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(r, 0), new THREE.Vector2(r * 0.94, h * 0.7), new THREE.Vector2(0.001, h)], seg);
}

type IceTone = 'pale' | 'mid' | 'deep' | 'glow';
const TONES: Record<IceTone, [number, number]> = { pale: [ICE, ICE_E], mid: [ICE_MID, ICE_MID_E], deep: [ICE_DEEP, ICE_DEEP_E], glow: [GLOW, GLOW_E] };

export function crystal(r: number, h: number, tone: IceTone = 'pale', seg = 6): THREE.Mesh {
  const [c, e] = TONES[tone];
  return tone === 'glow' ? glow(crystalGeo(r, h, seg), c, e) : mesh(crystalGeo(r, h, seg), c, { emissive: e });
}

/** Lean a standing piece outward from the centre, toward angle a (radians about y), by `lean`. */
function leanOut(o: THREE.Object3D, a: number, lean: number): THREE.Object3D {
  o.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
  return o;
}

/** A cluster of ice crystals: a tall one in the middle, smaller ones leaning out round it, a glowing heart or two. */
export function crystalCluster(s: number, rand: () => number, n = 5, tall = 1, glows = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(crystal(0.34 * s, 2.3 * s * tall, 'pale'));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.6;
    const h = (0.8 + rand() * 1.0) * s * tall;
    const tone: IceTone = i < glows ? 'glow' : i % 3 === 0 ? 'mid' : i % 3 === 1 ? 'pale' : 'deep';
    const c = crystal((0.15 + rand() * 0.09) * s, h, tone);
    c.position.set(Math.cos(a) * 0.3 * s, 0, Math.sin(a) * 0.3 * s);
    leanOut(c, a, 0.3 + rand() * 0.35);
    g.add(c);
  }
  return g;
}

/** A row of icicles hanging from a line (a to b, at height y), longest in the middle of each run. */
function icicles(g: THREE.Object3D, ax: number, y: number, az: number, bx: number, bz: number, n: number, len = 0.55, seed = 0): void {
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n;
    const L = len * (0.45 + jit(i, seed) * 0.8);
    const ic = new THREE.Mesh(new THREE.ConeGeometry(0.06 + L * 0.06, L, 4).rotateX(Math.PI).translate(0, -L / 2, 0), detailMat(ICICLE));
    ic.position.set(ax + (bx - ax) * k, y, az + (bz - az) * k);
    g.add(ic);
  }
}

/** Icicles hanging all round a ring (radius r at height y). */
function icicleRing(g: THREE.Object3D, r: number, y: number, n: number, len = 0.5, seed = 0): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + jit(i, seed) * 0.2;
    const L = len * (0.45 + jit(i, seed + 3) * 0.8);
    const ic = new THREE.Mesh(new THREE.ConeGeometry(0.06 + L * 0.06, L, 4).rotateX(Math.PI).translate(0, -L / 2, 0), detailMat(ICICLE));
    ic.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    g.add(ic);
  }
}

/** A snowflake: six arms, each with two little branches, lying in the XY plane (facing +z). */
export function snowflake(s: number, col = SNOWW, e = 0): THREE.Group {
  const g = new THREE.Group();
  const m = (geo: THREE.BufferGeometry) => (e ? mesh(geo, col, { emissive: e }) : mesh(geo, col));
  for (let i = 0; i < 6; i++) {
    const arm = new THREE.Group();
    arm.add(m(new THREE.BoxGeometry(0.08 * s, 0.5 * s, 0.05).translate(0, 0.25 * s, 0)));
    for (const side of [-1, 1]) {
      const b = m(new THREE.BoxGeometry(0.06 * s, 0.2 * s, 0.05).translate(0, 0.1 * s, 0));
      b.position.y = 0.3 * s;
      b.rotation.z = side * 0.85;
      arm.add(b);
    }
    arm.rotation.z = (i / 6) * Math.PI * 2;
    g.add(arm);
  }
  g.add(m(new THREE.CylinderGeometry(0.11 * s, 0.11 * s, 0.06, 6).rotateX(Math.PI / 2)));
  return g;
}

/** A crown: a silver band, points of ice rising from it, the tallest at the front. */
export function iceCrown(r: number, h: number, band = SILVER): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r * 0.92, h * 0.22, 12, 1, true), band, { double: true }));
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    const tall = i === 0 ? 1 : i % 2 ? 0.62 : 0.8;
    const c = crystal(r * 0.2, h * tall, i === 0 ? 'glow' : 'pale', 5);
    c.position.set(Math.cos(a) * r * 0.96, h * 0.12, Math.sin(a) * r * 0.96);
    leanOut(c, a, 0.18);
    g.add(c);
  }
  return g;
}

// ---------- fire, light and banners ----------

/** A flame that flickers (kept apart from the bake): a warm hearth fire, or the court's blue-white cold fire. */
function flame(s = 1, cold = false): THREE.Group {
  const f = new THREE.Group();
  f.add(glow(new THREE.ConeGeometry(0.34 * s, 0.95 * s, 6).translate(0, 0.47 * s, 0), cold ? CFLAME : FLAME, cold ? CFLAME_E : FLAME_E));
  f.add(glow(new THREE.ConeGeometry(0.18 * s, 0.6 * s, 5).translate(0, 0.3 * s, 0), cold ? 0xffffff : 0xffd070, cold ? 0x6ad0ff : 0xd08a20));
  f.userData.dynamic = true;
  f.userData.fire = true;
  return f;
}

/** A hearth: a ring of snow-capped stones, crossed logs, glowing coals and a warm flame. */
function hearth(s = 1, live = true): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(blob(0.24 * s, C.stoneDark, Math.cos(a) * 0.78 * s, 0.1, Math.sin(a) * 0.78 * s, 1.1, 0.75, 1));
    g.add(blob(0.16 * s, SNOWW, Math.cos(a) * 0.78 * s, 0.26 * s, Math.sin(a) * 0.78 * s, 1.1, 0.4, 1));
  }
  for (let i = 0; i < 3; i++) {
    const l = box(0.16 * s, 0.16 * s, 1.2 * s, PALE_WD_DK, 0, 0.06, 0);
    l.rotation.y = (i * Math.PI) / 3;
    g.add(l);
  }
  g.add(glow(new THREE.CylinderGeometry(0.45 * s, 0.5 * s, 0.1, 7), 0xff9a3a, 0xb8420c).translateY(0.14));
  if (live) {
    const f = flame(1.2 * s);
    f.position.y = 0.16;
    g.add(f);
  } else g.add(glow(new THREE.ConeGeometry(0.34 * s, 0.8 * s, 6).translate(0, 0.4 * s, 0), FLAME, FLAME_E).translateY(0.16));
  return g;
}

/** A silver brazier of cold fire: a bowl on three legs, blue-white flame leaping from it. */
function coldBrazier(h: number, s = 1, live = false): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    g.add(limb(V(Math.cos(a) * 0.42 * s, 0, Math.sin(a) * 0.42 * s), V(Math.cos(a) * 0.14 * s, h, Math.sin(a) * 0.14 * s), 0.05 * s, 0.04 * s, SILVER_DK, 4));
  }
  g.add(cyl(0.48 * s, 0.24 * s, 0.36 * s, SILVER, 8, 0, h));
  g.add(glow(new THREE.CylinderGeometry(0.42 * s, 0.42 * s, 0.07, 8), CFLAME, CFLAME_E).translateY(h + 0.33 * s));
  if (live) {
    const f = flame(s, true);
    f.position.y = h + 0.34 * s;
    g.add(f);
  } else g.add(glow(new THREE.ConeGeometry(0.26 * s, 0.6 * s, 6).translate(0, 0.3 * s, 0), CFLAME, CFLAME_E).translateY(h + 0.34 * s));
  return g;
}

/** A lantern of ice: a white stone foot, a slim silver post, a hooked arm and a crystal lantern glowing blue. */
export function iceLantern(h = 2.6): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.24, 0.3, 0.3, C.stoneDark, 6));
  g.add(cyl(0.05, 0.07, h, SILVER_DK, 5, 0, 0.3));
  g.add(crystal(0.08, 0.4, 'pale', 5).translateY(h + 0.3));
  g.add(box(0.56, 0.05, 0.05, SILVER_DK, 0.24, h + 0.12, 0));
  g.add(box(0.03, 0.18, 0.03, SILVER, 0.48, h - 0.04, 0));
  g.add(cone(0.17, 0.14, SILVER, 6, 0.48, h - 0.14));
  const lamp = glow(new THREE.OctahedronGeometry(0.17, 0));
  lamp.scale.set(1, 1.5, 1);
  lamp.position.set(0.48, h - 0.42, 0);
  g.add(lamp);
  g.add(cyl(0.08, 0.1, 0.06, SILVER, 6, 0.48, h - 0.72));
  return g;
}

/** A birch pole: white bark with the black marks of birch. */
function birchPole(r: number, h: number, x = 0, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(r * 0.82, r, h, BIRCH, 6, x, 0, z));
  for (let i = 0; i < Math.max(1, Math.floor(h / 1.1)); i++) {
    const y = (i + 0.4 + jit(i, h) * 0.3) * (h / Math.max(1, Math.floor(h / 1.1)));
    const mk = box(r * 1.5, 0.05, r * 0.9, BIRCH_MK, x, Math.min(h - 0.2, y), z + r * 0.5);
    mk.rotation.y = jit(i, r * 9) * 3;
    g.add(mk);
  }
  return g;
}

/**
 * A frost banner hanging from a silver rod: a band of white fur at its head, a snowflake on it and its
 * hem cut in icicle points. Its top is at the origin; it faces +z.
 */
export function frostCloth(w: number, h: number, color = FROST_BLUE, flake = true): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w + 0.26, 0.08, 0.08, SILVER, 0, -0.04, 0));
  g.add(box(w, 0.22, 0.1, FUR_W, 0, -0.28, 0));
  g.add(box(w, h - 0.3, 0.04, color, 0, -h, 0));
  for (const x of [-w / 3, 0, w / 3]) g.add(cone(w / 6, h * (x === 0 ? 0.24 : 0.16), color, 3, x, -h, 0).rotateX(Math.PI));
  if (flake) {
    const f = snowflake(w * 0.56);
    f.position.set(0, -h * 0.52, 0.03);
    g.add(f);
  }
  return g;
}

/** A standard of the court: a birch pole, a silver crown on top, a banner hanging from its crossbar. */
export function frostStandard(color: number, h: number, live = true): THREE.Group {
  const g = new THREE.Group();
  g.add(birchPole(0.09, h));
  g.add(box(1.6, 0.1, 0.1, SILVER_DK, 0, h - 0.5, 0));
  // (a banner that waves is merged into a few meshes first, so it costs a handful of draws, not twenty)
  const cloth = live ? moving(frostCloth(1.3, 1.9, color), { flag: true }) : frostCloth(1.3, 1.9, color);
  cloth.position.set(0, h - 0.46, 0.09);
  g.add(cloth);
  const cr = iceCrown(0.24, 0.5);
  cr.position.y = h + 0.02;
  g.add(cr);
  return g;
}

// ---------- snow, igloos and sledges ----------

/** A drift of snow heaped against something. */
function drift(x: number, z: number, s: number, ry = 0): THREE.Mesh {
  const d = blob(s, SNOWW, x, 0.02, z, 1.6, 0.42, 1.0);
  d.rotation.y = ry;
  return d;
}

/** An igloo: a dome of snow blocks (the seams showing), and a tunnel doorway on the +z side with a fur flap. */
function igloo(r: number, door = true): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(r, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), SNOWW));
  for (const k of [0.28, 0.55, 0.8]) {
    const y = r * k;
    g.add(mesh(new THREE.TorusGeometry(Math.sqrt(r * r - y * y) + 0.01, 0.04, 3, 18).rotateX(Math.PI / 2), SNOW_SH).translateY(y));
  }
  g.add(cyl(r * 0.18, r * 0.24, 0.12, SNOW_SH, 7, 0, r - 0.04));
  if (door) {
    const tl = r * 0.85, tr = Math.max(0.55, r * 0.42);
    const tun = mesh(new THREE.CylinderGeometry(tr, tr, tl, 9, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), SNOWW);
    tun.position.set(0, 0, r * 0.72 + tl / 2);
    g.add(tun);
    g.add(mesh(new THREE.CircleGeometry(tr * 0.72, 9, 0, Math.PI), VOID).translateZ(r * 0.72 + tl + 0.01));
    g.add(box(tr * 0.7, tr * 0.8, 0.06, FUR_B, tr * 0.35, 0.02, r * 0.72 + tl + 0.03).rotateZ(0.12));
    g.add(mesh(new THREE.TorusGeometry(tr * 0.86, 0.05, 3, 9, Math.PI), SNOW_SH).translateZ(r * 0.72 + tl - 0.02));
  }
  return g;
}

/** A sledge of pale wood on curved runners (long along z, its front at +z), with furs on it. */
function sledge(len = 2.2, load: 'furs' | 'logs' | 'crates' | 'ice' | 'none' = 'furs'): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.42, 0.42]) {
    g.add(box(0.07, 0.07, len, SILVER_DK, x, 0.02, 0));
    const curl = box(0.07, 0.07, 0.5, SILVER_DK, x, 0.02, len / 2 + 0.12);
    curl.rotation.x = -0.9;
    g.add(curl);
    for (const z of [-len * 0.35, 0, len * 0.35]) g.add(box(0.06, 0.3, 0.06, PALE_WD_DK, x, 0.05, z));
  }
  g.add(box(1.0, 0.1, len * 0.9, PALE_WD, 0, 0.34, -0.05));
  for (const x of [-0.48, 0.48]) g.add(box(0.06, 0.22, len * 0.8, PALE_WD_DK, x, 0.42, -0.08));
  g.add(box(1.0, 0.5, 0.08, PALE_WD_DK, 0, 0.42, -len * 0.45));
  if (load === 'furs') {
    g.add(blob(0.42, FUR_W, 0, 0.55, 0.1, 1.2, 0.45, 1.4), blob(0.34, FUR_G, 0.1, 0.72, -0.35, 1.1, 0.5, 1.1));
  } else if (load === 'logs') {
    for (let i = 0; i < 4; i++) {
      const lg = cyl(0.17, 0.17, len * 0.95, BIRCH, 7);
      lg.rotation.x = Math.PI / 2;
      lg.position.set(-0.22 + (i % 2) * 0.44, 0.58 + Math.floor(i / 2) * 0.3, len * 0.47 - 0.05);
      g.add(lg);
    }
  } else if (load === 'crates') {
    g.add(box(0.55, 0.45, 0.55, PALE_WD, -0.18, 0.44, 0.35), box(0.5, 0.4, 0.5, PALE_WD_DK, 0.2, 0.44, -0.3), blob(0.3, AMBER, 0.2, 0.95, -0.3, 1, 0.5, 1));
  } else if (load === 'ice') {
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(0.62, 0.5, 0.62).translate(0, 0.25, 0), ICE, { emissive: ICE_E }).translateX((i % 2) * 0.1 - 0.05).translateY(0.44 + (i === 2 ? 0.5 : 0)).translateZ(i === 1 ? -0.4 : 0.3));
  }
  return g;
}

// ---------- the frost house and tower (kit.ts sends house() and roundTower() here in the Frost Queen's villages) ----------

export interface FrostHouseOpts { w: number; d: number; h: number; roofH: number; wall?: number; roof?: number; frame?: number | null; door?: boolean; windows?: number; stone?: boolean; chimney?: boolean }

function roofColor(c?: number): number {
  if (c === undefined || c === C.tile || c === C.tileWarm) return ROOF_SLATE;
  if (c === C.thatch || c === C.thatchDark) return ROOF_PALE;
  if (c === C.slate || c === C.tileDark) return ROOF_DEEP;
  return c;
}

/** A window of the court: warm glass in a silver frame, a ledge of snow on its sill. */
function frostWindow(x: number, y: number, z: number, w = 0.62, h = 0.86): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w + 0.16, h + 0.16, 0.08, SILVER, 0, -0.08, -0.02));
  const pane = box(w, h, 0.12, C.window);
  pane.userData.window = true;
  g.add(pane);
  g.add(box(0.05, h, 0.14, SILVER, 0, 0, 0.01));
  g.add(cone(w * 0.62, 0.3, SILVER, 4, 0, h + 0.06, -0.02).rotateY(Math.PI / 4));
  g.add(box(w + 0.26, 0.1, 0.24, SNOWW, 0, -0.14, 0.06));
  g.position.set(x, y, z);
  return g;
}

/**
 * The Frost Queen's houses: white walls on a plinth of blue-grey stone, birch corner posts (or stone quoins),
 * a frieze of ice-blue tiles under the eaves, a steep roof of ice-blue slate with a blanket of snow sliding
 * down it and icicles hanging from its eaves, a crystal of ice rising from each gable, a silver snowflake on
 * the front gable, silver-framed windows lit warm, an arched door under a drape of white fur and a lantern
 * of ice beside it. Ridge along Z, front facing +Z.
 */
export function frostHouse(o: FrostHouseOpts): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const roofH = o.roofH * 1.45;
  const top = h + roofH;
  const wall = o.wall ?? (o.stone ? C.stone : C.plaster);
  const roof = roofColor(o.roof);
  g.add(box(w + 0.24, 0.55, d + 0.24, C.stoneDark));
  g.add(extrude([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0, top], [-w / 2, h]], d, wall));
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) {
    if (o.stone) {
      for (let y = 0.3; y < h - 0.3; y += 0.9) g.add(box(0.42, 0.45, 0.42, C.stoneLight, x, y, z));
    } else g.add(birchPole(0.17, h - 0.1, x, z));
  }
  // the frieze of ice-blue tiles
  g.add(box(w + 0.12, 0.26, d + 0.12, FRIEZE, 0, h - 0.4, 0));
  // the roof: slate slabs, the snow blanket on their upper part rounded off at its lower edge, icicles at the eaves
  const half = w / 2 + 0.45, theta = Math.atan2(roofH, w / 2), len = half / Math.cos(theta) + 0.2;
  for (const side of [-1, 1]) {
    const s = new THREE.Group();
    s.add(box(len, 0.26, d + 0.9, roof, 0, -0.13, 0));
    s.add(box(len * 0.54, 0.16, d + 0.84, SNOWW, -side * len * 0.23, 0.08, 0));
    s.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, d + 0.84, 7).rotateX(Math.PI / 2), SNOWW).translateX(side * len * 0.04).translateY(0.14));
    s.rotation.z = -side * theta;
    s.position.set(side * (half / 2), top - (half / 2) * Math.tan(theta), 0);
    g.add(s);
    const ey = h - 0.45 * (roofH / (w / 2)) - 0.16;
    icicles(g, side * (half - 0.08), ey, -d / 2 - 0.42, side * (half - 0.08), d / 2 + 0.42, Math.max(4, Math.round(d * 2.1)), 0.62, side + w);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.26, 0.26, d + 1.0, 7).rotateX(Math.PI / 2), SNOWW).translateY(top + 0.1));
  // a crystal of ice from each gable
  if (w > 3) for (const z of [d / 2 + 0.4, -d / 2 - 0.4]) {
    const c = crystal(0.15, 0.95, z > 0 ? 'mid' : 'pale', 5);
    c.position.set(0, top + 0.12, z);
    g.add(c);
  }
  if (w > 4.2) {
    const f = snowflake(Math.min(0.95, w * 0.12), SILVER);
    f.position.set(0, h + roofH * 0.42, d / 2 + 0.05);
    g.add(f);
  }
  if (o.door !== false) {
    const dw = Math.min(1.2, w * 0.22), dh = Math.min(2.1, h * 0.64);
    g.add(box(dw + 0.3, dh + 0.2, 0.14, C.stoneLight, 0, 0, d / 2 + 0.03));
    g.add(box(dw, dh - dw / 2, 0.2, DOOR_DK, 0, 0, d / 2 + 0.06));
    g.add(mesh(new THREE.CylinderGeometry(dw / 2, dw / 2, 0.2, 10, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), DOOR_DK).translateY(dh - dw / 2).translateZ(d / 2 + 0.06));
    // a drape of white fur over the doorway, and a lantern of ice beside it
    g.add(box(dw + 0.5, 0.26, 0.2, FUR_W, 0, dh + 0.02, d / 2 + 0.14));
    for (const x of [-dw / 2 - 0.14, dw / 2 + 0.14]) g.add(box(0.2, dh * 0.55, 0.12, FUR_W, x, dh * 0.47, d / 2 + 0.16));
    if (h > 2.1) {
      g.add(box(0.05, 0.05, 0.36, SILVER_DK, dw / 2 + 0.42, dh * 0.86, d / 2 + 0.16));
      g.add(glow(new THREE.OctahedronGeometry(0.14, 0)).translateX(dw / 2 + 0.42).translateY(dh * 0.86 - 0.24).translateZ(d / 2 + 0.34));
    }
  }
  const nw = o.windows ?? Math.max(0, Math.floor(w / 2.4));
  for (let i = 0; i < nw; i++) {
    const x = -w / 2 + ((i + 1) * w) / (nw + 1);
    if (Math.abs(x) < 1 && o.door !== false) continue;
    g.add(frostWindow(x, h * 0.44, d / 2 + 0.05, 0.56, Math.min(0.9, h * 0.3)));
  }
  if (o.chimney) {
    const cx = w * 0.22, cz = -d * 0.2;
    g.add(box(0.72, roofH + 1.2, 0.72, C.stoneLight, cx, h, cz));
    g.add(box(0.9, 0.18, 0.9, C.stoneDark, cx, h + roofH + 1.1, cz));
    g.add(blob(0.36, SNOWW, cx, h + roofH + 1.3, cz, 1.2, 0.45, 1.2));
  }
  return g;
}

export interface FrostTowerOpts { color?: number; roof?: number | null; merlons?: boolean; banner?: number }

/**
 * The court's towers: white stone tapering up from a blue-grey footing, a silver band, a jutting parapet hung
 * with icicles, and on top a faceted spire of ice with smaller crystals round its foot (or, open, crenellations
 * with crystals growing on them); a long frost banner down its face.
 */
export function frostTower(r: number, h: number, o: FrostTowerOpts = {}): THREE.Group {
  const g = new THREE.Group();
  const color = o.color ?? C.stone;
  g.add(cyl(r * 1.14, r * 1.2, 0.6, C.stoneDark, 10));
  g.add(cyl(r * 0.88, r * 1.02, h, color, 10));
  g.add(cyl(r * 0.99, r * 0.99, 0.18, SILVER, 10, 0, h * 0.34));
  g.add(cyl(r * 0.93, r * 0.93, 0.16, FRIEZE, 10, 0, h * 0.7));
  g.add(cyl(r * 1.1, r * 0.9, 0.55, C.stoneLight, 10, 0, h - 0.5));
  icicleRing(g, r * 1.02, h - 0.5, Math.max(8, Math.round(r * 7)), 0.55, r * 10 + h);
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + 0.5;
    const rr = r * 0.95;
    const s = box(0.3, 0.75, 0.12, C.window, Math.cos(a) * rr, h * 0.52, Math.sin(a) * rr);
    s.rotation.y = -a + Math.PI / 2;
    s.userData.window = true;
    g.add(s);
    const hood = cone(0.26, 0.26, SILVER, 4, Math.cos(a) * rr, h * 0.52 + 0.75, Math.sin(a) * rr);
    hood.rotation.y = -a + Math.PI / 4;
    g.add(hood);
  }
  if (o.roof === null) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const m = box(r * 0.4, r * 0.44, r * 0.4, C.stoneLight, Math.cos(a) * r * 0.98, h + 0.05, Math.sin(a) * r * 0.98);
      m.rotation.y = -a;
      g.add(m);
      g.add(box(r * 0.44, 0.08, r * 0.44, SNOWW, Math.cos(a) * r * 0.98, h + 0.05 + r * 0.44, Math.sin(a) * r * 0.98).rotateY(-a));
      if (i % 2 === 0) g.add(crystal(r * 0.09, r * 0.7, i % 4 ? 'mid' : 'pale', 5).translateX(Math.cos(a) * r * 0.98).translateY(h + 0.05 + r * 0.48).translateZ(Math.sin(a) * r * 0.98));
    }
  } else {
    // the spire of ice
    g.add(cyl(r * 0.86, r * 0.9, 0.3, SNOWW, 10, 0, h + 0.05));
    // (the wall's broad towers take a squatter spire, so the palace's own stands above them all)
    const sh = r <= 2 ? r * 3.1 : r * 2.1;
    g.add(crystal(r * 0.72, sh, 'pale', 6).translateY(h + 0.2));
    g.add(glow(crystalGeo(r * 0.2, sh * 0.36, 5)).translateY(h + 0.2 + sh * 0.8));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const c = crystal(r * 0.2, r * (0.9 + (i % 2) * 0.5), i % 2 ? 'mid' : 'deep', 5);
      c.position.set(Math.cos(a) * r * 0.66, h + 0.2, Math.sin(a) * r * 0.66);
      leanOut(c, a, 0.4);
      g.add(c);
    }
  }
  if (o.banner !== undefined) {
    const f = frostCloth(r * 0.78, h * 0.34, o.banner);
    f.position.set(0, h - 0.9, r * 0.99);
    g.add(f);
  }
  return g;
}

// ---------- the court's people ----------

const FOLK_COATS = [0xe8ecf2, 0x9cc0e2, 0x5d7ea6, 0xb6bfcb, 0x2f4b74, 0xcbb895, 0x7a9cc0];
const BLADE = 0xdcecfa, BLADE_E = 0x1c4f78;
let folkCount = 0;

function bladeMat(): THREE.MeshLambertMaterial {
  return mat(BLADE, { emissive: BLADE_E });
}

/** Boots, a long coat with a fur hem, a fur mantle over the shoulders, a pale face. */
function frostBody(g: THREE.Group, coat: number, trim = FUR_W, belt = SILVER_DK): void {
  g.add(box(0.3, 0.32, 0.2, 0x3a3f4a, 0, 0, 0));
  g.add(cyl(0.21, 0.29, 0.78, coat, 7, 0, 0.12));
  g.add(cyl(0.3, 0.3, 0.09, trim, 7, 0, 0.12));
  g.add(cyl(0.22, 0.22, 0.06, belt, 7, 0, 0.56));
  g.add(cyl(0.3, 0.23, 0.18, trim, 7, 0, 0.86));
  g.add(blob(0.19, SKIN, 0, 1.22, 0.03));
}

/**
 * The court's folk: pale, fur-trimmed, dressed for the cold in white wool, ice-blue and silver-grey coats;
 * each their own touch: a fur hood, a tall fur cap, a white-blond braid under a silver circlet, a knitted cap.
 */
export function frostFolk(g: THREE.Group, tunic: number): void {
  const k = folkCount++;
  const coat = FOLK_COATS[(k + (tunic & 7)) % FOLK_COATS.length];
  frostBody(g, coat, k % 5 === 3 ? FUR_G : FUR_W);
  switch (k % 4) {
    case 0:
      g.add(blob(0.24, FUR_W, 0, 1.27, -0.06, 1, 1.05, 1));
      g.add(blob(0.13, SKIN, 0, 1.2, 0.15, 1, 1.1, 0.55));
      break;
    case 1:
      g.add(cyl(0.18, 0.21, 0.28, FUR_G, 7, 0, 1.3));
      g.add(cyl(0.21, 0.21, 0.06, FUR_B, 7, 0, 1.3));
      break;
    case 2:
      g.add(blob(0.2, k % 8 === 2 ? HAIR_G : HAIR_W, 0, 1.27, -0.05, 1, 1, 1));
      g.add(box(0.1, 0.5, 0.08, k % 8 === 2 ? HAIR_G : HAIR_W, 0, 0.8, -0.22));
      g.add(mesh(new THREE.TorusGeometry(0.18, 0.025, 3, 12).rotateX(Math.PI / 2), SILVER).translateY(1.33));
      break;
    default:
      g.add(cone(0.2, 0.4, coat === 0xe8ecf2 ? FROST_BLUE : coat, 7, 0, 1.28));
      g.add(cyl(0.21, 0.21, 0.08, FUR_W, 7, 0, 1.28));
      g.add(blob(0.07, FUR_W, 0, 1.7, 0));
  }
  if (k % 3 === 1) g.add(box(0.22, 0.26, 0.1, FUR_B, -0.26, 0.4, 0.04)); // a satchel
}

function silverHelm(g: THREE.Group, crest: number | null = FROST_BLUE): void {
  g.add(cyl(0.18, 0.21, 0.2, SILVER, 7, 0, 1.27));
  g.add(cone(0.18, 0.2, SILVER, 7, 0, 1.47));
  if (crest !== null) g.add(box(0.04, 0.2, 0.36, crest, 0, 1.52, -0.02));
}

/** An ice blade on a pivot-friendly group: blade, silver guard and grip (its base at the origin, pointing up). */
function iceSword(len = 0.86): THREE.Group {
  const s = new THREE.Group();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, len, 0.03).translate(0, len / 2 + 0.1, 0), bladeMat()));
  s.add(new THREE.Mesh(new THREE.ConeGeometry(0.056, 0.16, 4).translate(0, len + 0.18, 0), bladeMat()));
  s.add(box(0.3, 0.05, 0.07, SILVER, 0, 0.06, 0));
  s.add(box(0.05, 0.16, 0.05, FROST_NAVY, 0, -0.1, 0));
  return s;
}

/** The kite shield of the Frostguard: frost blue, a silver rim, a white snowflake. */
function kiteShield(): THREE.Group {
  const g = new THREE.Group();
  g.add(extrude([[-0.28, 0.3], [0.28, 0.3], [0.28, -0.05], [0, -0.46], [-0.28, -0.05]], 0.06, FROST_BLUE));
  const rim = extrude([[-0.33, 0.35], [0.33, 0.35], [0.33, -0.07], [0, -0.53], [-0.33, -0.07]], 0.04, SILVER);
  rim.position.z = -0.03;
  g.add(rim);
  const f = snowflake(0.34);
  f.position.set(0, -0.02, 0.05);
  g.add(f);
  return g;
}

/**
 * The Frost Queen's soldiers: Ice Wardens in silver breastplates with spears tipped with ice, Frostguards in
 * silver plate behind kite shields, Rime Reavers in wolf pelts with great axes of ice, Frost Archers in white
 * hooded cloaks with birch bows; her scouts are snow owls, her heralds carry the court's banner.
 */
export function frostSoldier(kind: string): THREE.Group | null {
  if (kind === 'scout') return snowOwl();
  if (kind === 'noble') return iceHerald();
  if (kind !== 'spear' && kind !== 'sword' && kind !== 'axe' && kind !== 'archer') return null;
  const g = new THREE.Group();
  switch (kind) {
    case 'spear': {
      frostBody(g, 0x8fb4d8);
      g.add(box(0.38, 0.42, 0.07, SILVER, 0, 0.44, 0.23));
      silverHelm(g);
      const sh = cyl(0.3, 0.3, 0.06, FROST_NAVY, 10);
      sh.rotation.z = Math.PI / 2;
      sh.position.set(-0.3, 0.72, 0.02);
      g.add(sh, blob(0.09, SILVER, -0.34, 0.72, 0.02, 0.6, 1, 1));
      g.add(cyl(0.035, 0.035, 2.4, PALE_WD, 5, 0.34, 0.05, 0.1));
      g.add(new THREE.Mesh(crystalGeo(0.085, 0.55, 4), bladeMat()).translateX(0.34).translateY(2.42).translateZ(0.1));
      g.add(box(0.14, 0.24, 0.03, FROST_BLUE, 0.4, 2.1, 0.1));
      break;
    }
    case 'sword': {
      frostBody(g, SILVER, FUR_W, FROST_NAVY);
      g.add(box(0.34, 0.58, 0.05, FROST_BLUE, 0, 0.26, 0.27));
      g.add(box(0.05, 0.3, 0.02, SNOWW, 0, 0.42, 0.3), box(0.22, 0.05, 0.02, SNOWW, 0, 0.56, 0.3));
      g.add(cyl(0.2, 0.21, 0.36, SILVER, 8, 0, 1.06));
      g.add(box(0.26, 0.04, 0.04, 0x1c2230, 0, 1.24, 0.19));
      g.add(crystal(0.06, 0.34, 'pale', 4).translateY(1.42));
      const sh = kiteShield();
      sh.position.set(-0.32, 0.68, 0.06);
      sh.rotation.y = -1.25;
      g.add(sh);
      const sw = iceSword();
      sw.position.set(0.34, 0.5, 0.22);
      sw.rotation.x = 0.5;
      g.add(sw);
      break;
    }
    case 'axe': {
      // a Rime Reaver: a wolf's pelt for a hood, war paint of ice, a great double axe of ice over the shoulder
      frostBody(g, FUR_G, FUR_W, FUR_DK);
      g.add(blob(0.25, FUR_W, 0, 1.3, -0.06, 1, 0.95, 1.1));
      g.add(box(0.2, 0.12, 0.26, FUR_W, 0, 1.4, 0.14));
      for (const x of [-0.12, 0.12]) {
        g.add(cone(0.06, 0.18, FUR_W, 4, x, 1.5, -0.04));
        g.add(box(0.05, 0.14, 0.02, ICE_MID, x * 0.7, 1.16, 0.21));
      }
      const handle = box(0.06, 1.3, 0.06, PALE_WD_DK);
      handle.position.set(0.32, 0.85, -0.1);
      handle.rotation.x = -0.55;
      g.add(handle);
      for (const s of [-1, 1]) {
        const hgeo = new THREE.CylinderGeometry(0.26, 0.26, 0.05, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(s * Math.PI / 2);
        hgeo.scale(1, 1.3, 1);
        hgeo.translate(0, 0.05, s * 0.03);
        const head = new THREE.Mesh(hgeo, bladeMat());
        head.position.set(0.32, 1.8, -0.72);
        head.rotation.x = -0.55;
        g.add(head);
      }
      break;
    }
    case 'archer': {
      frostBody(g, 0xe4e9f0);
      const sash = box(0.08, 0.72, 0.05, FROST_BLUE, 0, 0.32, 0.25);
      sash.rotation.z = 0.6;
      g.add(sash);
      g.add(blob(0.24, 0xe4e9f0, 0, 1.27, -0.06, 1, 1.06, 1));
      g.add(blob(0.13, SKIN, 0, 1.2, 0.15, 1, 1.1, 0.55));
      g.add(box(0.16, 0.5, 0.12, PALE_WD_DK, 0, 0.6, -0.28));
      for (const x of [-0.04, 0.04]) g.add(box(0.05, 0.14, 0.05, SNOWW, x, 1.12, -0.28));
      const b = mesh(new THREE.TorusGeometry(0.46, 0.035, 4, 10, Math.PI), BIRCH);
      b.rotation.set(0, Math.PI / 2, Math.PI / 2);
      b.position.set(0.32, 0.82, 0);
      g.add(b);
      g.add(box(0.02, 0.9, 0.02, SILVER, 0.33, 0.37, 0));
      break;
    }
  }
  for (const c of g.children) c.castShadow = true;
  return g;
}

/** A snow owl on the wing: white with grey flecks, gold eyes, its wings on hinges so they can beat. */
export function snowOwl(): THREE.Group {
  const g = new THREE.Group();
  const b = new THREE.Group();
  const W = 0xf6f8fa;
  b.add(blob(0.25, W, 0, 0, 0, 0.9, 1.1, 1));
  b.add(blob(0.18, W, 0, 0.27, 0.03));
  b.add(blob(0.14, 0xffffff, 0, 0.26, 0.11, 1, 1, 0.5));
  for (const x of [-0.07, 0.07]) {
    b.add(blob(0.05, 0xf2c83a, x, 0.29, 0.18));
    b.add(box(0.03, 0.03, 0.02, 0x1c1c22, x, 0.29, 0.22));
  }
  b.add(cone(0.035, 0.08, 0x3a3a40, 4, 0, 0.2, 0.2).rotateX(Math.PI));
  for (const [x, y, z] of [[-0.1, 0.06, -0.2], [0.08, -0.08, -0.21], [0.02, 0.12, -0.22]]) b.add(box(0.06, 0.03, 0.03, 0x98a2ac, x, y, z));
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.add(box(0.56, 0.05, 0.3, 0xeef1f4, side * 0.28, 0, 0));
    hinge.add(box(0.14, 0.055, 0.26, 0x9aa4ae, side * 0.52, 0, -0.02));
    hinge.position.set(side * 0.08, 0.05, -0.02);
    hinge.userData.flap = side;
    b.add(hinge);
  }
  b.add(box(0.18, 0.04, 0.26, 0xe6eaee, 0, -0.14, -0.26));
  b.position.y = 1.9;
  g.add(b);
  g.userData.flapping = true;
  return g;
}

/** An Ice Herald: a long white-and-silver robe, a frost-blue mantle trimmed with fur, a silver circlet of
 *  ice points, the court's banner on a silver staff and a horn of ivory at the hip. */
export function iceHerald(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.2, 0.42, 1.12, 0xe8eef6, 8));
  g.add(cyl(0.43, 0.43, 0.08, FUR_W, 8, 0, 0.02));
  g.add(box(0.72, 1.08, 0.05, FROST_BLUE, 0, 0.08, -0.27));
  g.add(cyl(0.32, 0.24, 0.18, FUR_W, 8, 0, 0.98));
  g.add(box(0.36, 0.06, 0.05, SILVER, 0, 0.62, 0.3));
  g.add(blob(0.2, SKIN, 0, 1.28, 0.02));
  g.add(blob(0.2, HAIR_W, 0, 1.33, -0.07, 1, 1, 1));
  const c = iceCrown(0.19, 0.28);
  c.position.y = 1.41;
  g.add(c);
  g.add(horn(V(-0.22, 0.56, 0.18), V(-0.36, 0.42, 0.26), V(-0.28, 0.3, 0.12), 0.06, IVORY, 3));
  g.add(cyl(0.03, 0.035, 2.8, SILVER, 5, 0.4, 0, 0.05));
  g.add(box(0.04, 0.82, 0.56, FROST_BLUE, 0.42, 1.78, 0.33));
  const f = snowflake(0.26);
  f.rotation.y = Math.PI / 2;
  f.position.set(0.45, 2.2, 0.33);
  g.add(f);
  g.add(glow(crystalGeo(0.07, 0.36, 5)).translateX(0.4).translateY(2.8).translateZ(0.05));
  g.scale.setScalar(1.1);
  for (const ch of g.children) ch.castShadow = true;
  return g;
}

/**
 * The Frost Queen: tall and regal in a gown of white and ice-blue that pools into a train, a high collar of
 * ice crystals rising behind her head, a white fur mantle and a long pale cape cut in icicle points, silver
 * hair under a crown of ice, a frost staff crowned with a glowing crystal and a snowflake, and a cold mist
 * trailing at her hem.
 */
export function frostQueen(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.22, 0.6, 1.22, 0xeaf4fc, 10));
  g.add(mesh(new THREE.CylinderGeometry(0.62, 0.64, 0.12, 10), ICE_MID, { emissive: ICE_MID_E }));
  g.add(cyl(0.45, 0.52, 0.06, 0xd2e8f8, 10, 0, 0.38));
  g.add(blob(0.5, 0xd8ecfa, 0, 0.03, -0.62, 0.9, 0.12, 1.3));
  g.add(cyl(0.2, 0.23, 0.44, 0x9ccaee, 8, 0, 1.2));
  g.add(cyl(0.235, 0.235, 0.06, SILVER, 8, 0, 1.2));
  g.add(cyl(0.34, 0.22, 0.16, FUR_W, 8, 0, 1.56));
  // the collar of ice behind her head
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (1.18 + i * 0.16);
    const c = crystal(0.05, 0.5 - Math.abs(i - 2) * 0.08, i === 2 ? 'glow' : 'pale', 4);
    c.position.set(Math.cos(a) * 0.2, 1.62, Math.sin(a) * 0.2);
    leanOut(c, a, 0.35);
    g.add(c);
  }
  const cape = box(0.92, 1.72, 0.05, 0xa8d4f4, 0, -0.02, -0.36);
  cape.rotation.x = 0.16;
  g.add(cape);
  for (const x of [-0.3, 0, 0.3]) g.add(cone(0.15, 0.24, 0xa8d4f4, 3, x, 0.02, -0.64).rotateX(Math.PI));
  const lArm = box(0.12, 0.62, 0.12, 0xeaf4fc, -0.3, 1.0, 0.04);
  lArm.rotation.z = 0.2;
  g.add(lArm);
  g.add(blob(0.2, SKIN, 0, 1.86, 0.03));
  g.add(blob(0.22, HAIR_W, 0, 1.9, -0.06, 1, 1.05, 1));
  g.add(box(0.3, 0.72, 0.08, HAIR_W, 0, 1.22, -0.22));
  const cr = iceCrown(0.2, 0.44);
  cr.position.y = 2.02;
  g.add(cr);
  // the cold mist at her hem
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * (1.1 + i * 0.26);
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 + (i % 2) * 0.1, 0), detailMat(0xeaf6ff, { opacity: 0.38 }));
    puff.position.set(Math.cos(a) * 0.7, 0.18, Math.sin(a) * 0.75);
    g.add(puff);
  }
  // the frost staff held out at her side (its hand and all swing together in battle)
  const rArm = box(0.11, 0.55, 0.11, 0xeaf4fc, 0.34, 1.05, 0.08);
  rArm.rotation.z = -0.3;
  g.add(rArm);
  g.add(cyl(0.035, 0.045, 2.7, SILVER, 5, 0.46, 0, 0.1));
  g.add(crystal(0.1, 0.55, 'glow', 5).translateX(0.46).translateY(2.62).translateZ(0.1));
  for (const s of [-1, 1]) {
    const c = crystal(0.05, 0.3, 'pale', 4);
    c.position.set(0.46 + s * 0.08, 2.62, 0.1);
    leanOut(c, s > 0 ? 0 : Math.PI, 0.5);
    g.add(c);
  }
  const orb = glow(new THREE.IcosahedronGeometry(0.1, 0));
  orb.position.set(0.46, 2.66, 0.1);
  orb.userData.pulse = true;
  g.add(orb);
  const f = snowflake(0.3, GLOW, GLOW_E);
  f.position.set(0.46, 2.45, 0.14);
  g.add(f);
  for (const ch of g.children) ch.castShadow = true;
  return g;
}

// ---------- mounts ----------

/** A great white snow wolf, long along +x like the horse: a shaggy ruff, pale eyes that glow a little. */
export function snowWolf(fur = 0xeef1f5, saddle = false): THREE.Group {
  const g = new THREE.Group();
  const dk = 0xc6ced8;
  for (const [x, z] of [[-0.55, 0.18], [0.55, 0.18], [-0.55, -0.18], [0.55, -0.18]]) g.add(box(0.17, 0.86, 0.17, dk, x, 0, z));
  g.add(box(1.5, 0.58, 0.56, fur, 0, 0.78, 0));
  g.add(box(0.66, 0.8, 0.72, FUR_W, 0.5, 0.72, 0));
  g.add(box(1.0, 0.12, 0.22, dk, -0.1, 1.34, 0));
  const neck = box(0.34, 0.55, 0.38, fur, 0.74, 1.06, 0);
  neck.rotation.z = -0.65;
  g.add(neck);
  g.add(box(0.52, 0.38, 0.4, fur, 1.16, 1.4, 0));
  g.add(box(0.42, 0.17, 0.26, 0xdfe5ea, 1.52, 1.37, 0));
  g.add(box(0.07, 0.07, 0.09, 0x2a2e36, 1.74, 1.43, 0));
  for (const z of [-0.12, 0.12]) {
    g.add(cone(0.08, 0.26, fur, 4, 1.04, 1.58, z));
    g.add(glow(new THREE.OctahedronGeometry(0.035, 0), 0xbff0ff, 0x3aa0d0).translateX(1.36).translateY(1.5).translateZ(z * 1.5));
  }
  const tail = blob(0.2, fur, -0.95, 1.02, 0, 2.0, 0.75, 0.8);
  tail.rotation.z = 0.45;
  g.add(tail);
  if (saddle) {
    g.add(box(0.7, 0.14, 0.72, FROST_BLUE, -0.02, 1.08, 0));
    g.add(box(0.5, 0.12, 0.6, FUR_W, -0.02, 1.18, 0));
  }
  return g;
}

/** A woolly mammoth, long along +x: shaggy brown fur hanging in a fringe, a domed head, a curling trunk and
 *  great tusks sweeping up; for war, a frost-blue caparison and a fur saddle. */
export function mammoth(armoured = false): THREE.Group {
  const g = new THREE.Group();
  const FUR = 0x735c48, FUR_D = 0x4f3f31, FUR_L = 0x8d765e;
  for (const [x, z] of [[-0.62, 0.36], [0.62, 0.36], [-0.62, -0.36], [0.62, -0.36]]) g.add(cyl(0.22, 0.26, 1.2, FUR_D, 7, x, 0, z));
  g.add(blob(0.9, FUR, 0, 1.55, 0, 1.45, 0.92, 0.86, 1));
  g.add(box(2.0, 0.44, 1.26, FUR_D, -0.05, 0.8, 0));
  g.add(blob(0.58, FUR_L, 0.45, 2.22, 0, 1.25, 0.82, 0.92));
  // the high domed head, a crest of darker hair on it, the long trunk hanging and great ivory tusks curling up
  g.add(blob(0.6, FUR, 1.3, 2.0, 0, 0.95, 1.2, 0.92));
  g.add(blob(0.36, FUR_D, 1.2, 2.62, 0, 1.1, 0.8, 0.8));
  g.add(horn(V(1.72, 1.85, 0), V(2.35, 1.2, 0), V(2.05, 0.2, 0), 0.22, FUR_D, 6));
  for (const z of [-1, 1]) {
    g.add(horn(V(1.62, 1.5, z * 0.26), V(2.9, 0.85, z * 0.55), V(2.75, 2.35, z * 0.2), 0.14, IVORY, 6));
    g.add(blob(0.26, FUR_D, 1.02, 2.05, z * 0.52, 0.6, 1, 0.3));
    g.add(box(0.07, 0.07, 0.05, 0x1a1612, 1.72, 2.08, z * 0.3));
  }
  const tail = cyl(0.05, 0.08, 0.6, FUR_D, 5, -1.25, 1.3, 0);
  tail.rotation.z = -0.5;
  g.add(tail);
  if (armoured) {
    g.add(box(1.5, 0.9, 1.72, FROST_BLUE, -0.1, 1.2, 0));
    g.add(box(1.54, 0.08, 1.76, SILVER, -0.1, 1.2, 0));
    g.add(box(1.0, 0.24, 1.1, FUR_W, -0.05, 2.18, 0));
    const plate = box(0.52, 0.5, 0.06, SILVER, 1.62, 1.95, 0);
    plate.rotation.y = Math.PI / 2;
    g.add(plate);
  }
  return g;
}

/** A reindeer, long along +x: grey-brown with a white ruff and rump, and great branching antlers. */
export function reindeer(coat = 0x8a735a): THREE.Group {
  const g = new THREE.Group();
  const dk = 0x5a4a3a, ANT = 0xd8ccb4;
  for (const [x, z] of [[-0.5, 0.15], [0.5, 0.15], [-0.5, -0.15], [0.5, -0.15]]) g.add(box(0.11, 0.92, 0.11, dk, x, 0, z));
  g.add(box(1.3, 0.5, 0.44, coat, 0, 0.88, 0));
  g.add(box(0.36, 0.44, 0.46, 0xe8e2d4, -0.52, 0.9, 0));
  g.add(box(0.44, 0.56, 0.5, 0xece6da, 0.58, 0.9, 0));
  const neck = box(0.26, 0.62, 0.28, coat, 0.74, 1.25, 0);
  neck.rotation.z = -0.4;
  g.add(neck);
  g.add(box(0.52, 0.26, 0.26, coat, 1.02, 1.62, 0));
  g.add(box(0.12, 0.1, 0.12, 0x2a2222, 1.3, 1.62, 0));
  for (const z of [-1, 1]) {
    g.add(limb(V(0.9, 1.74, z * 0.1), V(0.7, 2.1, z * 0.3), 0.035, 0.03, ANT, 4), limb(V(0.7, 2.1, z * 0.3), V(0.62, 2.5, z * 0.42), 0.03, 0.02, ANT, 4));
    g.add(limb(V(0.78, 1.98, z * 0.24), V(1.08, 2.22, z * 0.3), 0.025, 0.015, ANT, 4));
    g.add(limb(V(0.68, 2.2, z * 0.34), V(0.46, 2.42, z * 0.26), 0.02, 0.012, ANT, 4));
    const ear = cone(0.05, 0.14, coat, 4, 0.9, 1.72, z * 0.16);
    ear.rotation.x = z * 1.2;
    g.add(ear);
  }
  g.add(box(0.16, 0.14, 0.1, 0xe8e2d4, -0.7, 1.08, 0));
  return g;
}

/**
 * A rider of the court: a snow-wolf rider in ice-blue with a lance tipped with ice, or a mammoth rider in
 * silver plate high on a fur saddle, the court's banner behind him; the sleigh archers ride a reindeer sledge.
 */
export function frostRider(kind: string): THREE.Group {
  if (kind === 'marcher') return sleighArcher();
  const g = new THREE.Group();
  const heavy = kind === 'heavy';
  const mount = heavy ? mammoth(true) : snowWolf(0xeef1f5, true);
  mount.rotation.y = -Math.PI / 2;
  g.add(mount);
  const seat = heavy ? 2.3 : 1.26;
  const man = new THREE.Group();
  frostBody(man, heavy ? SILVER : 0x8fb4d8);
  silverHelm(man, heavy ? FROST_BLUE : null);
  man.scale.setScalar(0.85);
  man.position.set(0, seat, heavy ? -0.2 : -0.1);
  g.add(man);
  g.add(cyl(0.035, 0.035, 2.5, PALE_WD, 5, 0.34, seat + 0.2, 0));
  g.add(new THREE.Mesh(crystalGeo(0.08, 0.5, 4), bladeMat()).translateX(0.34).translateY(seat + 2.68).translateZ(0));
  if (heavy) {
    const pole = birchPole(0.04, 2.3, -0.25, -0.9);
    pole.position.y = seat;
    const b = frostCloth(0.5, 0.8, FROST_BLUE, false);
    b.position.set(-0.25, seat + 2.1, -0.86);
    g.add(pole, b);
  }
  for (const c of g.children) c.castShadow = true;
  return g;
}

/** A sleigh archer: a reindeer drawing a light sledge, an archer in white standing in it with a birch bow. */
function sleighArcher(): THREE.Group {
  const g = new THREE.Group();
  const rd = reindeer(0x9a8266);
  rd.rotation.y = -Math.PI / 2;
  rd.position.z = 0.5;
  g.add(rd);
  const sl = sledge(1.6, 'none');
  sl.position.z = -1.1;
  g.add(sl);
  for (const x of [-0.3, 0.3]) g.add(limb(V(x, 0.5, -0.24), V(x * 0.5, 0.95, 0.2), 0.02, 0.02, FUR_DK, 3));
  const man = new THREE.Group();
  frostBody(man, 0xe4e9f0);
  man.add(blob(0.24, 0xe4e9f0, 0, 1.27, -0.06, 1, 1.06, 1));
  man.scale.setScalar(0.85);
  man.position.set(0, 0.42, -1.05);
  g.add(man);
  const b = mesh(new THREE.TorusGeometry(0.42, 0.035, 4, 10, Math.PI), BIRCH);
  b.rotation.set(0, Math.PI / 2, Math.PI / 2);
  b.position.set(0.3, 1.15, -1.0);
  g.add(b);
  for (const c of g.children) c.castShadow = true;
  return g;
}

/** A trader of the court: a reindeer sledge heaped with furs, amber and crates, its driver wrapped in furs. */
export function frostTrader(): THREE.Group {
  const g = new THREE.Group();
  const rd = reindeer();
  rd.rotation.y = -Math.PI / 2;
  rd.position.z = 0.6;
  g.add(rd);
  const sl = sledge(1.9, 'crates');
  sl.position.z = -1.15;
  g.add(sl);
  g.add(blob(0.36, FUR_W, 0, 0.9, -1.75, 1.3, 0.6, 0.8));
  for (const x of [-0.3, 0.3]) g.add(limb(V(x, 0.5, -0.2), V(x * 0.5, 0.95, 0.3), 0.02, 0.02, FUR_DK, 3));
  const man = new THREE.Group();
  frostFolk(man, 3);
  man.scale.setScalar(0.8);
  man.position.set(0, 0.42, -0.45);
  g.add(man);
  for (const c of g.children) c.castShadow = true;
  return g;
}

// ---------- pieces of the palace ----------

const ICE_WIN_E = 0x2a78b0;

/** A flat prism from a 2D outline (in the XY plane), `depth` thick, centred on z = 0. */
function prismGeo(points: [number, number][], depth: number, holes: [number, number][][] = []): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  for (const h of holes) {
    const p = new THREE.Path();
    p.moveTo(h[0][0], h[0][1]);
    for (let i = 1; i < h.length; i++) p.lineTo(h[i][0], h[i][1]);
    p.closePath();
    s.holes.push(p);
  }
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -depth / 2);
}

/** A pointed arch outline (for windows and doorways): w wide, springing at `spring`, its point at h; each side is
 *  an arc struck from beyond the opposite springer, as a Gothic arch is. */
function archOutline(w: number, h: number, spring: number, y0 = 0, n = 5): [number, number][] {
  const rise = Math.max(0.01, h - spring);
  const R = ((w / 2) ** 2 + rise ** 2) / w;
  const fmax = Math.asin(Math.min(1, rise / R));
  const pts: [number, number][] = [[-w / 2, y0], [w / 2, y0]];
  for (let i = 0; i <= n; i++) { const f = (i / n) * fmax; pts.push([w / 2 - R + R * Math.cos(f), spring + R * Math.sin(f)]); }
  for (let i = n - 1; i >= 0; i--) { const f = (i / n) * fmax; pts.push([-(w / 2 - R + R * Math.cos(f)), spring + R * Math.sin(f)]); }
  return pts;
}

/** A tall pointed window of ice glass that glows cold, in a silver frame, facing +z. */
function iceWindow(x: number, y: number, z: number, w = 0.5, h = 1.3, ry = 0): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(prismGeo(archOutline(w + 0.2, h + 0.14, h * 0.72, -0.08), 0.08), SILVER).translateZ(-0.03));
  g.add(new THREE.Mesh(prismGeo(archOutline(w, h, h * 0.72), 0.1), detailMat(ICE_MID, { emissive: ICE_WIN_E })));
  g.add(box(0.04, h * 0.9, 0.12, SILVER, 0, 0, 0.01));
  g.add(box(w + 0.3, 0.1, 0.22, SNOWW, 0, -0.14, 0.06));
  g.position.set(x, y, z);
  g.rotation.y = ry;
  return g;
}

/** A hunters' lodge: birch poles leaned into an A-frame, furs lapped over it, antlers on its ridge. */
function huntLodge(): THREE.Group {
  const g = new THREE.Group();
  const H = 2.5, W = 1.35, L = 1.5;
  for (const z of [-L, L]) for (const s of [-1, 1]) g.add(limb(V(s * W, 0, z), V(-s * 0.12, H + 0.25, z), 0.07, 0.06, BIRCH, 5));
  g.add(limb(V(0, H, -L - 0.3), V(0, H, L + 0.3), 0.06, 0.06, BIRCH, 5));
  const sl = Math.hypot(H, W);
  for (const s of [-1, 1]) {
    const f = mesh(new THREE.BoxGeometry(sl, 0.08, 2 * L + 0.2), s < 0 ? FUR_B : FUR_G);
    f.position.set((s * W) / 2 + s * 0.05, H / 2, 0);
    f.rotation.z = Math.atan2(H, -s * W);
    g.add(f);
    const sn = mesh(new THREE.BoxGeometry(sl * 0.55, 0.08, 2 * L + 0.1), SNOWW);
    sn.position.set((s * W) / 4 + s * 0.08, H * 0.72, 0);
    sn.rotation.z = Math.atan2(H, -s * W);
    g.add(sn);
  }
  g.add(mesh(prismGeo([[-W, 0], [W, 0], [0, H]], 0.08), FUR_DK).translateZ(-L + 0.05));
  g.add(box(0.7, 1.1, 0.05, FUR_W, 0.45, 0.1, L + 0.08).rotateY(0.3));
  for (const s of [-1, 1]) {
    g.add(limb(V(0, H + 0.2, L + 0.35), V(s * 0.45, H + 0.75, L + 0.45), 0.035, 0.025, 0xd8ccb4, 4));
    g.add(limb(V(s * 0.25, H + 0.46, L + 0.4), V(s * 0.5, H + 0.5, L + 0.55), 0.025, 0.015, 0xd8ccb4, 4));
  }
  return g;
}

/** A frozen fountain: a white stone basin, its water turned to ice, the jet frozen as it leapt and splashed. */
function frozenFountain(s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(1.05 * s, 1.15 * s, 0.5 * s, C.stoneLight, 10));
  g.add(mesh(new THREE.CylinderGeometry(0.92 * s, 0.92 * s, 0.06, 10).translate(0, 0.47 * s, 0), ICE, { emissive: ICE_E }));
  icicleRing(g, 1.08 * s, 0.46 * s, 12, 0.3, 5);
  g.add(cyl(0.2 * s, 0.28 * s, 0.9 * s, C.stone, 6, 0, 0.3 * s));
  g.add(cyl(0.55 * s, 0.2 * s, 0.22 * s, C.stoneLight, 8, 0, 1.12 * s));
  icicleRing(g, 0.52 * s, 1.14 * s, 8, 0.35, 9);
  g.add(crystal(0.13 * s, 1.7 * s, 'glow', 5).translateY(1.28 * s));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const c = crystal(0.06 * s, 0.75 * s, i % 2 ? 'pale' : 'mid', 4);
    c.position.set(Math.cos(a) * 0.2 * s, 2.6 * s, Math.sin(a) * 0.2 * s);
    leanOut(c, a, 2.2);
    g.add(c);
  }
  return g;
}

/** A frozen waterfall: a crag of blue-grey rock under snow, sheets of ice poured down its face and widening as they
 *  fall, long icicles from its lip, a cold glow still running in the heart of it, and a frozen pool at its foot. */
function frozenFall(): THREE.Group {
  const g = new THREE.Group();
  const ROCK = 0xaebdcc, ROCK_D = 0x8798ac;
  g.add(blob(1.8, ROCK, 0.2, 2.2, -0.9, 1.0, 1.45, 0.85));
  g.add(blob(1.4, ROCK_D, -1.1, 1.3, -0.6, 1.1, 1.0, 0.9));
  g.add(blob(1.2, ROCK_D, 1.3, 1.1, -0.4, 1.0, 0.95, 0.9));
  g.add(blob(1.25, ROCK, 0.4, 4.6, -1.1, 1.1, 0.9, 0.85));
  for (const [x, y, z, s] of [[0.3, 5.5, -1.0, 1.1], [-1.1, 2.5, -0.5, 0.9], [1.3, 2.1, -0.3, 0.8]] as [number, number, number, number][]) g.add(blob(s, SNOWW, x, y, z, 1.1, 0.4, 1.0));
  for (let k = 0; k < 6; k++) {
    const w = 0.8 + k * 0.2;
    const sheet = mesh(new THREE.BoxGeometry(w, 1.25, 0.32), k % 2 ? ICE : ICE_MID, { emissive: k % 2 ? ICE_E : ICE_MID_E });
    sheet.position.set(0.25 - k * 0.05, 5.3 - k * 0.92, 0.25 + k * 0.2);
    sheet.rotation.x = -0.28;
    g.add(sheet);
  }
  g.add(glow(new THREE.BoxGeometry(0.22, 5.0, 0.1)).translateX(0.1).translateY(3.0).translateZ(0.9).rotateX(-0.2));
  for (let i = 0; i < 5; i++) {
    const c = crystal(0.1, 1.2 + (i % 2) * 0.7, 'pale', 4);
    c.rotation.x = Math.PI;
    c.position.set(-0.8 + i * 0.4, 5.9, 0.1 + (i % 2) * 0.12);
    g.add(c);
  }
  g.add(mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.12, 12).translate(0, 0.06, 0), ICE, { emissive: ICE_E }).translateZ(1.7));
  g.add(mesh(new THREE.TorusGeometry(1.5, 0.16, 4, 14).rotateX(Math.PI / 2), SNOWW).translateY(0.1).translateZ(1.7));
  for (let i = 0; i < 4; i++) g.add(crystal(0.14, 0.5 + i * 0.12, i % 2 ? 'mid' : 'pale', 5).translateX(-0.6 + i * 0.4).translateY(0.1).translateZ(1.0 + (i % 2) * 0.3));
  return g;
}

/**
 * A pillar of aurora light rising from the crown into the night: a soft column that ripples green to ice-blue,
 * fading as it climbs. Only lit at night (the renderer shows nightOnly things after dark).
 */
function auroraPillar(h: number, r: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r * 0.3, r, h, 18, 1, true).translate(0, h / 2, 0);
  const u = { uTime: { value: 0 } };
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: u,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      void main() {
        float y = vUv.y;
        float fade = smoothstep(0.0, 0.1, y) * pow(1.0 - y, 1.7);
        float bands = 0.5 + 0.5 * sin(vUv.x * 18.85 + uTime * 0.6 + sin(y * 5.0 - uTime * 0.8) * 1.8);
        float ripple = 0.7 + 0.3 * sin(y * 12.0 - uTime * 1.6);
        vec3 col = mix(vec3(0.38, 1.0, 0.78), vec3(0.5, 0.72, 1.0), y);
        gl_FragColor = vec4(col, fade * bands * ripple * 0.34);
      }`,
  });
  const mm = new THREE.Mesh(geo, m);
  mm.onBeforeRender = () => { u.uTime.value = performance.now() / 1000; };
  mm.userData.dynamic = true;
  mm.userData.nightOnly = true;
  mm.renderOrder = 6;
  // (kept out of the building's measure, so the level badge and the finishing crown sit on the palace itself)
  geo.boundingBox = new THREE.Box3(new THREE.Vector3(-r, 0, -r), new THREE.Vector3(r, 0.4, r));
  return mm;
}

/** The crown of ice that turns slowly over the palace: a ring of ice, a silver band, points of ice glowing and pale. */
function turningCrown(R: number, H: number): THREE.Group {
  const parts = new THREE.Group();
  parts.add(mesh(new THREE.TorusGeometry(R, 0.14, 5, 28).rotateX(Math.PI / 2), ICE_MID, { emissive: ICE_MID_E }));
  parts.add(mesh(new THREE.TorusGeometry(R * 0.97, 0.08, 4, 28).rotateX(Math.PI / 2).translate(0, 0.3, 0), SILVER));
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = crystal(R * 0.16, H * (i % 2 ? 0.66 : 1), i % 2 ? 'pale' : 'glow', 5);
    c.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    leanOut(c, a, 0.24);
    parts.add(c);
  }
  parts.add(glow(new THREE.OctahedronGeometry(R * 0.28, 0)).translateY(H * 0.45));
  return swarm(parts, { orbit: 0.22, bob: 0.25 });
}

/** Snow owls wheeling round a spire, their wings beating. */
function owlFlight(n: number, rad: number, y: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const o = new THREE.Group();
    const body = new THREE.Group();
    body.add(blob(0.3, 0xf6f8fa, 0, 0, 0, 0.9, 0.8, 1.4), blob(0.21, 0xf6f8fa, 0, 0.14, 0.38));
    o.add(swarm(body, {}));
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.add(box(0.75, 0.04, 0.36, 0xeef1f4, side * 0.38, 0, 0));
      wing.position.set(side * 0.12, 0.06, 0);
      wing.userData.flap = side;
      o.add(wing);
    }
    const a = (i / n) * Math.PI * 2 + jit(i, seed) * 0.6;
    const rr = rad * (0.85 + jit(i, seed + 1) * 0.3);
    o.position.set(Math.cos(a) * rr, y + (jit(i, seed + 2) - 0.5) * 1.6, Math.sin(a) * rr);
    o.rotation.set(0, -a, 0.3);
    g.add(o);
  }
  g.userData.dynamic = true;
  g.userData.orbit = -0.4;
  return g;
}

/** Glints of light drifting about the spires (merged into one mesh, turning slowly). */
function glints(n: number, rad: number, h: number, rand: () => number): THREE.Group {
  const parts = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, d = rad * (0.4 + rand() * 0.6);
    parts.add(glow(new THREE.OctahedronGeometry(0.08 + rand() * 0.06, 0)).translateX(Math.cos(a) * d).translateY(rand() * h).translateZ(Math.sin(a) * d));
  }
  return swarm(parts, { orbit: 0.14, bob: 0.4 });
}

// ---------- the Frost Queen's seat ----------

/**
 * The Frost Queen's seat: a hunters' camp of snow-block igloos round a hearth; a white stone lodge hung with
 * icicles beside a tower capped with ice; an ice keep, faceted spires rising from its corners and a great one
 * from its roof; and the crystal palace: a throne hall whose open, pointed arch shows the ice throne glowing
 * within, its great spire of ice behind, and a frozen waterfall pouring down the crag beside it. At the height of
 * her power the palace glitters with more spires, frozen fountains play before it, snow owls wheel round the
 * spire and a crown of ice turns slowly over it all, under a pillar of aurora light at night.
 */
export function frostHall(t: number, color: number): Built {
  const g = new THREE.Group();
  const r = rng(301 + t);
  if (t === 1) {
    const big = igloo(2.5);
    big.position.set(0, 0, -0.8);
    g.add(big);
    for (const [x, z, s, ry] of [[-3.5, -2.2, 1.5, 0.7], [3.4, -2.6, 1.3, -0.6]] as [number, number, number, number][]) {
      const ig = igloo(s);
      ig.position.set(x, 0, z);
      ig.rotation.y = ry;
      g.add(ig);
    }
    // the first gift of the queen: ice crystals growing up out of the snow by the great igloo
    const cc = crystalCluster(0.72, r, 4, 1, 1);
    cc.position.set(-2.1, 0, 1.3);
    g.add(cc);
    const lodge = huntLodge();
    lodge.position.set(3.5, 0, 1.0);
    lodge.rotation.y = -0.35;
    g.add(lodge);
    const hh = hearth(0.95);
    hh.position.set(1.9, 0, 3.7);
    g.add(hh);
    const st = frostStandard(color, 4.4);
    st.position.set(-3.8, 0, 2.3);
    g.add(st);
    const sl = sledge(2.0, 'furs');
    sl.position.set(-1.9, 0, 3.8);
    sl.rotation.y = 1.3;
    g.add(sl);
    const lan = iceLantern(2.1);
    lan.position.set(4.3, 0, 3.4);
    g.add(lan);
    g.add(drift(-4.2, -0.2, 0.9, 0.4), drift(1.8, -3.4, 1.0, 1.2), drift(-0.6, 2.9, 0.6, 0.1));
    return { obj: g, h: 7, w: 9, d: 9 };
  }
  if (t === 2) {
    const lodge = frostHouse({ w: 8, d: 6, h: 3.4, roofH: 2.3, windows: 2, chimney: true });
    lodge.position.set(0.4, 0, -1.0);
    g.add(lodge);
    // a porch of birch posts under a canopy of white fur before the door
    for (const x of [-1.0, 1.0]) g.add(birchPole(0.1, 2.5, 0.4 + x, 3.0));
    const can = box(2.5, 0.12, 1.3, FUR_W, 0.4, 2.45, 2.55);
    can.rotation.x = 0.18;
    g.add(can);
    icicles(g, -0.8, 2.52, 3.2, 1.6, 3.2, 7, 0.4, 7);
    const tw = frostTower(1.35, 7.2, { roof: 0, banner: color });
    tw.position.set(-5.4, 0, 0.6);
    g.add(tw);
    const ig = igloo(1.5);
    ig.position.set(5.0, 0, -2.4);
    ig.rotation.y = -0.9;
    g.add(ig);
    for (const x of [-1.8, 2.6]) {
      const l = iceLantern(2.3);
      l.position.set(x, 0, 3.4);
      g.add(l);
    }
    const st = frostStandard(color, 5.0);
    st.position.set(5.3, 0, 2.3);
    g.add(st);
    const cc = crystalCluster(0.85, r, 5, 1, 1);
    cc.position.set(-3.3, 0, 3.4);
    g.add(cc);
    const sl = sledge(2.0, 'logs');
    sl.position.set(5.1, 0, 0.1);
    sl.rotation.y = 0.2;
    g.add(sl);
    g.add(drift(-2.2, -4.4, 1.1, 0.2), drift(3.4, 4.1, 0.7, 0.9));
    return { obj: g, h: 12.5, w: 13, d: 11 };
  }
  if (t === 3) {
    // the ice keep
    const kz = -2.6, K = 5.6, KH = 8.2;
    g.add(box(K + 0.7, 0.7, K + 0.7, C.stoneDark, 0, 0, kz));
    g.add(box(K, KH, K, C.stone, 0, 0, kz));
    g.add(box(K + 0.26, 0.28, K + 0.26, FRIEZE, 0, KH * 0.46, kz));
    g.add(box(K + 0.5, 0.42, K + 0.5, C.stoneLight, 0, KH - 0.12, kz));
    for (let i = 0; i < 4; i++) for (let j = -1; j <= 1; j++) {
      const side = i % 2 === 0 ? 1 : -1;
      const [x, z] = i < 2 ? [j * 1.8, side * (K / 2 + 0.05)] : [side * (K / 2 + 0.05), j * 1.8];
      g.add(box(0.7, 0.75, 0.5, C.stoneLight, x, KH + 0.3, kz + z).rotateY(i < 2 ? 0 : Math.PI / 2));
      g.add(box(0.74, 0.1, 0.54, SNOWW, x, KH + 1.05, kz + z).rotateY(i < 2 ? 0 : Math.PI / 2));
    }
    icicles(g, -K / 2 - 0.2, KH - 0.14, kz + K / 2 + 0.25, K / 2 + 0.2, kz + K / 2 + 0.25, 14, 0.7, 3);
    for (const s of [-1, 1]) icicles(g, s * (K / 2 + 0.25), KH - 0.14, kz - K / 2, s * (K / 2 + 0.25), kz + K / 2, 12, 0.6, s + 5);
    for (const x of [-1.5, 0, 1.5]) g.add(iceWindow(x, 4.6, kz + K / 2 + 0.04, 0.5, 1.5));
    for (const s of [-1, 1]) g.add(iceWindow(0, 4.6, kz, 0.5, 1.5, s * Math.PI / 2).translateZ(K / 2 + 0.04));
    // spires of ice on the corner turrets, the front ones flying the ruler's banner
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const tw = frostTower(0.95, 10, z > 0 ? { roof: 0, banner: color } : { roof: 0 });
      tw.position.set(x * K / 2, 0, kz + z * K / 2);
      g.add(tw);
    }
    // the great spire rising out of the keep
    g.add(cyl(1.5, 1.7, 0.6, C.stoneLight, 8, 0, KH + 0.2, kz));
    g.add(crystal(1.1, 6.6, 'pale', 6).translateY(KH + 0.7).translateZ(kz));
    g.add(glow(crystalGeo(0.3, 1.6, 5)).translateY(KH + 5.2).translateZ(kz));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const c = crystal(0.28, 1.8 + (i % 2) * 1.1, i % 3 === 0 ? 'mid' : i % 3 === 1 ? 'pale' : 'deep', 6);
      c.position.set(Math.cos(a) * 0.95, KH + 0.7, kz + Math.sin(a) * 0.95);
      leanOut(c, a, 0.32);
      g.add(c);
    }
    // the hall of audience before it
    const hall = frostHouse({ w: 6.2, d: 4.2, h: 3.8, roofH: 2.3, windows: 2, stone: true });
    hall.position.set(0, 0, 3.0);
    g.add(hall);
    for (const x of [-1, 1]) {
      const l = iceLantern(2.4);
      l.position.set(x * 2.4, 0, 5.8);
      g.add(l);
      const cc = crystalCluster(0.9, r, 5, 1.1, 1);
      cc.position.set(x * 4.6, 0, 3.4);
      g.add(cc);
    }
    g.add(drift(-4.9, 0.6, 0.9, 0.3), drift(5.0, -0.2, 0.9, 1.1));
    return { obj: g, h: 16.5, w: 15, d: 12 };
  }
  // the crystal palace
  const big = t === 5;
  const W = 7.2, D = 7.0, H = big ? 5.8 : 5.4, RH = big ? 4.4 : 4.0, hz = 0.5;
  const back = hz - D / 2, front = hz + D / 2, vest = 3.0;
  // the palace is built of ice itself: pale blue walls that seem lit from within
  const palace = (geo: THREE.BufferGeometry) => mesh(geo, PALACE, { emissive: PALACE_E });
  // the hall's rear block, its back gable, and the vestibule's side walls
  g.add(box(W + 0.5, 0.6, D + 0.3, C.stoneDark, 0, 0, hz));
  g.add(palace(new THREE.BoxGeometry(W, H, D - vest).translate(0, H / 2, back + (D - vest) / 2)));
  g.add(palace(prismGeo([[-W / 2, H], [W / 2, H], [0, H + RH]], 0.4).translate(0, 0, back + 0.2)));
  for (const s of [-1, 1]) g.add(palace(new THREE.BoxGeometry(0.7, H, vest).translate(s * (W / 2 - 0.35), H / 2, front - vest / 2)));
  // buttresses of blue ice down the flanks, a crystal on each
  for (const s of [-1, 1]) for (const z of [back + 0.3, back + 2.05, front - 1.2]) {
    g.add(mesh(new THREE.BoxGeometry(0.55, H * 0.8, 0.6).translate(s * (W / 2 + 0.2), H * 0.4, z), ICE_MID, { emissive: ICE_MID_E }));
    g.add(crystal(0.2, 1.3, z > front - 2 ? 'glow' : 'pale', 5).translateX(s * (W / 2 + 0.2)).translateY(H * 0.8).translateZ(z));
  }
  g.add(box(W - 1.4, 0.1, vest, 0x3d5b86, 0, 0.6, front - vest / 2));
  g.add(box(1.4, 0.13, vest + 0.6, FROST_BLUE, 0, 0.6, front - vest / 2 + 0.3));
  g.add(box(W - 1.4, H - 0.6, 0.1, 0x1b2842, 0, 0.6, front - vest + 0.06));
  g.add(mesh(prismGeo(archOutline(2.2, 3.9, 2.6, 0), 0.06), SILVER).translateY(0.6).translateZ(front - vest + 0.13));
  g.add(box(W + 0.14, 0.3, D + 0.14, FRIEZE, 0, H - 0.45, hz));
  // the front: the gable pierced by a great pointed arch through which the throne is seen
  const aw = 2.6, ah = 4.3, spring = 2.9;
  g.add(palace(prismGeo([[-W / 2, 0], [W / 2, 0], [W / 2, H], [0, H + RH], [-W / 2, H]], 0.6, [archOutline(aw, ah, spring, 0.6).reverse()]).translate(0, 0, front - 0.3)));
  g.add(glow(prismGeo(archOutline(aw + 0.22, ah + 0.14, spring, 0.6), 0.04, [archOutline(aw, ah, spring, 0.66).reverse()])).translateZ(front + 0.12));
  g.add(box(aw + 0.6, 0.6, 0.9, C.stoneLight, 0, 0, front + 0.1));
  g.add(mesh(prismGeo(archOutline(aw + 0.5, ah + 0.3, spring, 0.6), 0.12, [archOutline(aw, ah, spring, 0.75).reverse()]), SILVER).translateZ(front + 0.04));
  for (const s of [-1, 1]) g.add(crystal(0.24, ah + 0.9, 'mid', 6).translateX(s * (aw / 2 + 0.45)).translateY(0.6).translateZ(front + 0.25));
  const sf = snowflake(1.2, SILVER);
  sf.position.set(0, H + RH * 0.38, front + 0.05);
  g.add(sf);
  g.add(glow(new THREE.OctahedronGeometry(0.2, 0)).translateY(H + RH * 0.38).translateZ(front + 0.1));
  // the throne of ice within, on a white dais
  const tz = front - vest + 0.75;
  g.add(box(2.6, 0.3, 1.5, C.stoneLight, 0, 0.6, tz));
  g.add(box(1.8, 0.15, 0.5, C.stoneLight, 0, 0.6, tz + 1.0));
  g.add(mesh(new THREE.BoxGeometry(1.1, 0.55, 0.8).translate(0, 0.275, 0), ICE_MID, { emissive: ICE_MID_E }).translateY(0.9).translateZ(tz + 0.1));
  g.add(box(1.0, 0.1, 0.84, FUR_W, 0, 1.44, tz + 0.1));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.2, 0.4, 0.8).translate(0, 0.2, 0), ICE, { emissive: ICE_E }).translateX(s * 0.62).translateY(1.4).translateZ(tz + 0.1));
  g.add(crystal(0.3, 2.9, 'glow', 6).translateY(0.9).translateZ(tz - 0.3));
  for (const s of [-1, 1]) {
    const c = crystal(0.22, 2.1, 'pale', 6);
    c.position.set(s * 0.42, 0.9, tz - 0.25);
    c.rotation.z = -s * 0.2;
    g.add(c);
  }
  // the roof: steep, ice-blue slate under snow, hung with icicles, crystals on its ridge
  const half = W / 2 + 0.5, theta = Math.atan2(RH, W / 2), len = half / Math.cos(theta) + 0.2, top = H + RH;
  for (const side of [-1, 1]) {
    const s = new THREE.Group();
    s.add(box(len, 0.3, D + 1.0, ROOF_PALE, 0, -0.15, 0));
    s.add(box(len * 0.6, 0.18, D + 0.94, SNOWW, -side * len * 0.2, 0.1, 0));
    s.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, D + 0.94, 7).rotateX(Math.PI / 2), SNOWW).translateX(side * len * 0.1).translateY(0.16));
    s.rotation.z = -side * theta;
    s.position.set(side * (half / 2), top - (half / 2) * Math.tan(theta), hz);
    g.add(s);
    icicles(g, side * (half - 0.08), H - 0.5 * (RH / (W / 2)) - 0.18, back - 0.45, side * (half - 0.08), front + 0.45, 18, 0.75, side * 3);
    // tall windows of ice down the flanks
    for (const z of [back + 1.2, back + 2.9]) g.add(iceWindow(side * (W / 2 + 0.03), 1.4, z, 0.55, 2.0, side * Math.PI / 2));
  }
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, D + 1.1, 7).rotateX(Math.PI / 2), SNOWW).translateY(top + 0.1).translateZ(hz));
  const peak = crystalCluster(0.75, r, 5, 1.2, 2);
  peak.position.set(0, top - 0.1, front + 0.35);
  g.add(peak);
  for (const z of big ? [back + 1.4, hz, front - 1.6] : [hz]) g.add(crystalCluster(0.5, r, 4, 1, 1).translateY(top + 0.1).translateZ(z));
  // the great spire behind: a round tower of ice banded in silver, and a spire of ice taller than anything in the land
  const sz = back - 1.1, TR = 2.1, TH = big ? 11 : 9.5, SH = big ? 11 : 8.5;
  g.add(cyl(TR * 1.15, TR * 1.22, 0.7, C.stoneDark, 12, 0, 0, sz));
  g.add(palace(new THREE.CylinderGeometry(TR * 0.88, TR, TH, 12).translate(0, TH / 2, sz)));
  for (const k of [0.4, 0.74]) g.add(cyl(TR * (1 - k * 0.12) + 0.04, TR * (1 - k * 0.12) + 0.04, 0.24, SILVER, 12, 0, TH * k, sz));
  for (const a of [0.25, Math.PI - 0.25, -Math.PI / 2 + 0.8, -Math.PI / 2 - 0.8]) {
    const rr = TR * 0.9;
    g.add(iceWindow(Math.cos(a) * rr, TH - 2.9, sz + Math.sin(a) * rr, 0.45, 1.4, Math.atan2(Math.cos(a), Math.sin(a))));
  }
  g.add(cyl(TR * 1.08, TR * 0.88, 0.6, C.stoneLight, 12, 0, TH - 0.5, sz));
  icicleRing(g, TR * 1.02, TH - 0.5, 18, 0.7, 11);
  g.add(crystal(TR * 0.84, SH, 'pale', 8).translateY(TH).translateZ(sz));
  g.add(glow(crystalGeo(TR * 0.24, SH * 0.38, 6)).translateY(TH + SH * 0.62).translateZ(sz));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const c = crystal(TR * 0.19, SH * (0.3 + (i % 3) * 0.11), i % 3 === 0 ? 'mid' : i % 3 === 1 ? 'deep' : 'pale', 6);
    c.position.set(Math.cos(a) * TR * 0.74, TH, sz + Math.sin(a) * TR * 0.74);
    leanOut(c, a, 0.36);
    g.add(c);
  }
  // a tower before the hall on the left, a second behind the frozen waterfall on the right, both flying the ruler's banner
  for (const [x, z] of [[-5.4, 2.5], [5.2, -4.9]] as [number, number][]) {
    const tw = frostTower(1.3, big ? 9.8 : 8.6, { roof: 0, banner: color, color: PALACE });
    tw.position.set(x, 0, z);
    g.add(tw);
  }
  // a spire of crystals on a plinth at the back left; the frozen waterfall pouring down its crag at the right
  g.add(cyl(1.05, 1.3, 3.0, C.stone, 8, -4.9, 0, -3.3));
  g.add(cyl(1.2, 1.1, 0.3, C.stoneLight, 8, -4.9, 3.0, -3.3));
  g.add(crystalCluster(1.15, r, 6, 1.25, 2).translateX(-4.9).translateY(3.25).translateZ(-3.3));
  const fall = frozenFall();
  fall.position.set(6.0, 0, -0.9);
  fall.rotation.y = -0.5;
  g.add(fall);
  for (const x of [-1, 1]) {
    const l = iceLantern(2.6);
    l.position.set(x * 2.3, 0, front + 1.3);
    g.add(l);
  }
  let hTop = TH + SH + 0.5;
  if (big) {
    // the height of her power: frozen fountains before the hall, owls about the spire, the crown of ice turning over it
    for (const x of [-1, 1]) {
      const f = frozenFountain(1.0);
      f.position.set(x * 3.7, 0, front + 2.0);
      g.add(f);
    }
    const crown = turningCrown(1.9, 2.8);
    crown.position.set(0, TH + SH + 0.8, sz);
    g.add(crown);
    const pillar = auroraPillar(15, 1.6);
    pillar.position.set(0, TH + SH + 1.4, sz);
    g.add(pillar);
    const owls = owlFlight(3, 3.4, TH + SH * 0.4, 7);
    owls.position.set(0, 0, sz + 1);
    g.add(owls);
    const gl = glints(18, 3.4, TH + SH, r);
    gl.position.set(0, 1, sz + 1);
    g.add(gl);
    hTop += 3.6;
  }
  return { obj: g, h: hTop, w: 15, d: 16 };
}

// ---------- the court's smaller pieces ----------

/** A rail fence of birch: white posts, two pale rails (runs along x, centred). */
function birchFence(len: number): THREE.Group {
  const g = new THREE.Group();
  const posts = Math.max(2, Math.round(len / 1.6) + 1);
  for (let i = 0; i < posts; i++) {
    const x = -len / 2 + (i * len) / (posts - 1);
    g.add(cyl(0.08, 0.09, 1.05, BIRCH, 5, x, 0, 0));
    g.add(blob(0.1, SNOWW, x, 1.06, 0, 1, 0.5, 1));
  }
  g.add(box(len, 0.09, 0.08, PALE_WD, 0, 0.42, 0), box(len, 0.09, 0.08, PALE_WD, 0, 0.8, 0));
  return g;
}

/** The court's mark by a workplace's track: a birch post, a lantern of ice hung from its arm, a frost pennant. */
export function frostPost(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(birchPole(0.08, h));
  g.add(box(0.7, 0.07, 0.07, SILVER_DK, 0.26, h - 0.25, 0));
  g.add(box(0.03, 0.2, 0.03, SILVER, 0.5, h - 0.4, 0));
  const l = glow(new THREE.OctahedronGeometry(0.15, 0));
  l.scale.set(1, 1.5, 1);
  l.position.set(0.5, h - 0.66, 0);
  g.add(l, cone(0.15, 0.12, SILVER, 6, 0.5, h - 0.5));
  g.add(box(0.04, 0.6, 0.38, FROST_BLUE, 0, h - 1.1, 0.2));
  g.add(crystal(0.07, 0.34, 'pale', 5).translateY(h));
  return g;
}

/** A pine of the north, bowed under snow, icicles at its lowest boughs. */
function snowPine(r: () => number, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.16, 0.26, 1.3, 0x4a3a2c, 5));
  const col = r() < 0.5 ? 0x2c4a33 : 0x24402c;
  for (const [y, rad, h] of [[0.9, 1.45, 2.3], [2.0, 1.1, 1.9], [3.0, 0.72, 1.6]] as [number, number, number][]) {
    g.add(cone(rad, h, col, 7, 0, y));
    g.add(cone(rad * 0.82, h * 0.42, SNOWW, 7, 0, y + h * 0.5));
  }
  g.add(cone(0.36, 0.7, SNOWW, 6, 0, 4.2));
  g.scale.setScalar(s * (0.85 + r() * 0.4));
  g.rotation.y = r() * Math.PI * 2;
  return g;
}

/** A birch in winter: a white trunk marked black, bare boughs rimed with frost and a few pale gold leaves clinging on. */
function frostBirch(r: () => number, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(birchPole(0.16, 3.4));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + r();
    const y = 1.8 + i * 0.4;
    g.add(limb(V(0, y, 0), V(Math.cos(a) * 1.0, y + 0.9, Math.sin(a) * 1.0), 0.06, 0.03, BIRCH, 4));
    g.add(blob(0.2, SNOWW, Math.cos(a) * 0.6, y + 0.62, Math.sin(a) * 0.6, 1.4, 0.4, 1.0));
  }
  g.add(blob(0.62, 0xe2e8ee, 0, 3.7, 0, 1.2, 0.8, 1.2));
  if (r() < 0.5) g.add(blob(0.22, 0xd8b45a, 0.4, 3.3, 0.3), blob(0.18, 0xe2c26a, -0.3, 3.5, -0.2));
  g.scale.setScalar(s * (0.85 + r() * 0.35));
  g.rotation.y = r() * Math.PI * 2;
  return g;
}

/** A stump capped with snow. */
function snowStump(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.34, 0.42, 0.45, BIRCH, 7), cyl(0.32, 0.32, 0.04, 0xe0cfa8, 7, 0, 0.45));
  g.add(blob(0.3, SNOWW, 0.05, 0.5, 0, 1.1, 0.35, 1.1));
  g.position.set(x, 0, z);
  return g;
}

/** A stack of birch logs: white bark, pale cut ends, snow on the top. */
function birchPile(n = 6): THREE.Group {
  const g = new THREE.Group();
  let i = 0;
  let row = 0;
  for (; i < n; row++) {
    const per = Math.max(1, 3 - row);
    for (let k = 0; k < per && i < n; k++, i++) {
      const lg = cyl(0.28, 0.28, 2.4, BIRCH, 7);
      lg.rotation.z = Math.PI / 2;
      lg.position.set(-1.2, 0.3 + row * 0.5, (k - (per - 1) / 2) * 0.6);
      g.add(lg);
      g.add(mesh(new THREE.CircleGeometry(0.27, 7).rotateY(Math.PI / 2), 0xe6d2a4).translateX(1.21).translateY(0.3 + row * 0.5).translateZ((k - (per - 1) / 2) * 0.6));
    }
  }
  g.add(box(1.9, 0.14, 0.7, SNOWW, 0, 0.3 + (row - 1) * 0.5 + 0.24, 0));
  return g;
}

/** A cabin of birch logs: white logs laid round and notched at the corners, a steep snowy roof of pale slate. */
function birchCabin(w: number, d: number, h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w + 0.2, 0.3, d + 0.2, C.stoneDark));
  const rows = Math.max(4, Math.round(h / 0.36));
  for (let i = 0; i < rows; i++) {
    const y = 0.3 + i * (h - 0.3) / rows + 0.17;
    const odd = i % 2;
    for (const z of [-d / 2, d / 2]) { const lg = cyl(0.18, 0.18, w + (odd ? 0.5 : 0.2), i % 3 === 1 ? 0xdcd6c8 : BIRCH, 6); lg.rotation.z = Math.PI / 2; lg.position.set(0, y, z); g.add(lg); }
    for (const x of [-w / 2, w / 2]) { const lg = cyl(0.18, 0.18, d + (odd ? 0.2 : 0.5), i % 3 === 2 ? 0xdcd6c8 : BIRCH, 6); lg.rotation.x = Math.PI / 2; lg.position.set(x, y + 0.08, 0); g.add(lg); }
  }
  g.add(extrude([[-w / 2, h], [w / 2, h], [0, h + w * 0.55]], d - 0.1, PALE_WD));
  const RH = w * 0.55, half = w / 2 + 0.4, th = Math.atan2(RH, w / 2), len = half / Math.cos(th) + 0.2;
  for (const side of [-1, 1]) {
    const s = new THREE.Group();
    s.add(box(len, 0.2, d + 0.7, ROOF_PALE, 0, -0.1, 0));
    s.add(box(len * 0.75, 0.16, d + 0.64, SNOWW, -side * len * 0.12, 0.05, 0));
    s.rotation.z = -side * th;
    s.position.set(side * (half / 2), h + RH - (half / 2) * Math.tan(th), 0);
    g.add(s);
    icicles(g, side * (half - 0.05), h - 0.4 * (RH / (w / 2)) - 0.12, -d / 2 - 0.3, side * (half - 0.05), d / 2 + 0.3, Math.round(d * 1.8), 0.45, side + d);
  }
  g.add(box(0.9, 1.5, 0.12, DOOR_DK, 0, 0.3, d / 2 + 0.12));
  const win = box(0.5, 0.5, 0.1, C.window, w * 0.28, 1.2, d / 2 + 0.14);
  win.userData.window = true;
  g.add(win, box(0.6, 0.08, 0.2, SNOWW, w * 0.28, 1.14, d / 2 + 0.16));
  g.add(cyl(0.26, 0.3, h * 0.9, C.stoneLight, 6, -w * 0.25, h, -d * 0.2), blob(0.3, SNOWW, -w * 0.25, h * 1.9 + 0.05, -d * 0.2, 1.1, 0.45, 1.1));
  return g;
}

/** A block of cut ice. */
function iceBlock(x: number, y: number, z: number, s = 0.6, ry = 0): THREE.Mesh {
  const b = mesh(new THREE.BoxGeometry(s, s * 0.8, s).translate(0, s * 0.4, 0), ICE, { emissive: ICE_E });
  b.position.set(x, y, z);
  b.rotation.y = ry;
  return b;
}

/** A shed open on every side: birch posts, a pitched roof of ice-blue slate under snow, icicles along its eaves. */
function frostShed(w: number, d: number, h: number): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) g.add(birchPole(0.13, h, x, z));
  for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) g.add(box(w, 0.16, 0.16, PALE_WD_DK, 0, h - 0.1, z));
  const RH = d * 0.34, half = d / 2 + 0.35, th = Math.atan2(RH, d / 2), len = half / Math.cos(th) + 0.2;
  for (const side of [-1, 1]) {
    const s = new THREE.Group();
    s.add(box(w + 0.6, 0.18, len, ROOF_SLATE, 0, -0.09, 0));
    s.add(box(w + 0.5, 0.14, len * 0.7, SNOWW, 0, 0.05, -side * len * 0.15));
    s.rotation.x = side * th;
    s.position.set(0, h + RH - (half / 2) * Math.tan(th), side * (half / 2));
    g.add(s);
    icicles(g, -w / 2 - 0.25, h - 0.3 * (RH / (d / 2)) - 0.1, side * (half - 0.05), w / 2 + 0.25, side * (half - 0.05), Math.round(w * 1.6), 0.45, side * 2 + w);
  }
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) {
    const gab = extrude([[-d / 2, h], [d / 2, h], [0, h + RH]], 0.12, PALE_WD);
    gab.rotation.y = Math.PI / 2;
    gab.position.x = x;
    g.add(gab);
  }
  return g;
}

/** A ram of the court: a frame on sledge runners under a roof of fur, a birch log with a great point of ice for its head. */
function iceRam(): THREE.Group {
  const g = new THREE.Group();
  for (const z of [-0.55, 0.55]) {
    g.add(box(3.0, 0.1, 0.1, SILVER_DK, 0, 0.05, z));
    const curl = box(0.5, 0.1, 0.1, SILVER_DK, 1.62, 0.05, z);
    curl.rotation.z = 0.8;
    g.add(curl);
  }
  g.add(box(2.6, 0.26, 1.2, PALE_WD, 0, 0.2, 0));
  for (const x of [-1.1, 1.1]) for (const z of [-0.5, 0.5]) g.add(birchPole(0.08, 1.7, x, z).translateY(0.3));
  const RH = 0.6, th = Math.atan2(RH, 0.75), sl = Math.hypot(RH, 0.75) + 0.2;
  for (const side of [-1, 1]) {
    const f = mesh(new THREE.BoxGeometry(2.9, 0.1, sl), side < 0 ? FUR_G : FUR_W);
    f.position.set(0, 2.0 + RH / 2, side * 0.38);
    f.rotation.x = side * th;
    g.add(f);
  }
  const lg = cyl(0.28, 0.3, 3.2, BIRCH, 8);
  lg.rotation.z = Math.PI / 2;
  lg.position.set(1.7, 1.1, 0);
  g.add(lg);
  for (const x of [-0.6, 0.6]) g.add(box(0.03, 1.0, 0.03, FUR_DK, x, 1.2, 0));
  const head = crystal(0.42, 1.3, 'mid', 6);
  head.rotation.z = -Math.PI / 2;
  head.position.set(1.72, 1.1, 0);
  g.add(head);
  for (const s of [-1, 1]) {
    const c = crystal(0.14, 0.7, 'pale', 5);
    c.rotation.set(s * 0.6, 0, -Math.PI / 2 + 0.3);
    c.position.set(2.0, 1.1 + 0.15, s * 0.15);
    g.add(c);
  }
  return g;
}

/** A frost trebuchet: A-frames of pale wood, a long arm cocked back, a box of ice for its weight, an ice boulder in its sling. */
function frostTrebuchet(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.8, 0.3, 1.6, PALE_WD_DK, 0, 0.1, 0));
  for (const z of [-0.6, 0.6]) {
    g.add(limb(V(-1.0, 0.4, z), V(0, 2.8, z * 0.8), 0.1, 0.08, PALE_WD));
    g.add(limb(V(1.0, 0.4, z), V(0, 2.8, z * 0.8), 0.1, 0.08, PALE_WD));
  }
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6).rotateX(Math.PI / 2), SILVER).translateY(2.8));
  g.add(limb(V(1.3, 1.9, 0), V(-2.0, 3.6, 0), 0.12, 0.07, PALE_WD));
  g.add(box(0.8, 0.7, 0.8, SILVER_DK, 1.3, 1.2, 0));
  for (let i = 0; i < 2; i++) g.add(iceBlock(1.3, 1.9 + i * 0.1, 0, 0.55 - i * 0.12, i * 0.5));
  g.add(box(0.03, 0.7, 0.03, FUR_DK, -2.0, 2.95, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(0.34, 0), ICE_MID, { emissive: ICE_MID_E }).translateX(-2.0).translateY(2.8));
  for (let i = 0; i < 3; i++) g.add(crystal(0.07, 0.3, 'pale', 4).translateX(-2.0 + (i - 1) * 0.16).translateY(3.0).translateZ((i % 2) * 0.1));
  return g;
}

/** A furnace of the frost forge: white stone, its arched mouth burning blue-white with cold fire, a silver hood over it. */
function frostForge(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.9, 1.1, 1.3, C.stoneLight));
  g.add(box(2.0, 0.16, 1.4, C.stoneDark, 0, 1.1, 0));
  g.add(mesh(prismGeo(archOutline(0.9, 0.85, 0.5), 0.1), VOID).translateY(0.12).translateZ(0.66));
  g.add(glow(prismGeo(archOutline(0.72, 0.66, 0.4), 0.06), CFLAME, CFLAME_E).translateY(0.14).translateZ(0.7));
  const f = flame(0.75, true);
  f.position.set(0, 1.26, 0);
  g.add(f);
  g.add(cone(1.0, 1.1, SILVER, 4, 0, 2.1).rotateY(Math.PI / 4));
  g.add(cyl(0.22, 0.26, 1.8, SILVER_DK, 6, 0, 3.0));
  for (const x of [-0.8, 0.8]) g.add(crystal(0.12, 0.6, 'mid', 5).translateX(x).translateY(1.26).translateZ(-0.45));
  return g;
}

/** A silver anvil on a block of ice. */
function frostAnvil(): THREE.Group {
  const g = new THREE.Group();
  g.add(iceBlock(0, 0, 0, 0.62));
  g.add(box(0.9, 0.3, 0.36, SILVER_DK, 0, 0.5, 0));
  g.add(cone(0.17, 0.44, SILVER_DK, 4, 0.62, 0.52, 0).rotateZ(-Math.PI / 2));
  g.add(glow(new THREE.BoxGeometry(0.55, 0.05, 0.1), BLADE, 0x3a90d0).translateY(0.83));
  return g;
}

/** A horn of ivory on a birch stand (a war horn to call the court's muster). */
function hornStand(): THREE.Group {
  const g = new THREE.Group();
  for (const s of [-1, 1]) g.add(limb(V(s * 0.35, 0, 0), V(s * 0.12, 1.3, 0), 0.05, 0.04, BIRCH, 4));
  g.add(horn(V(-0.4, 1.3, 0), V(0.2, 1.1, 0), V(0.6, 1.55, 0), 0.13, IVORY, 4));
  g.add(cyl(0.1, 0.1, 0.06, SILVER, 6, -0.4, 1.3, 0).rotateZ(Math.PI / 2));
  return g;
}

/** A bench cut from a block of ice, a fur thrown over it. */
function iceBench(len = 1.6): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(len, 0.45, 0.55).translate(0, 0.225, 0), ICE, { emissive: ICE_E }));
  g.add(box(len * 0.7, 0.07, 0.6, FUR_W, 0.1, 0.45, 0));
  return g;
}

/** The queen carved in ice for her plinth: her gown and cape in pale and mid ice, a glowing crown and staff. */
function queenStatue(): THREE.Group {
  const g = new THREE.Group();
  const ice = (geo: THREE.BufferGeometry, tone: IceTone = 'pale') => { const [c, e] = TONES[tone]; return mesh(geo, c, { emissive: e }); };
  g.add(ice(new THREE.CylinderGeometry(0.22, 0.62, 1.25, 10).translate(0, 0.62, 0), 'mid'));
  g.add(ice(new THREE.SphereGeometry(0.6, 10, 3, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.2, 1.4).translate(0, 0.05, -0.35), 'pale'));
  g.add(ice(new THREE.CylinderGeometry(0.2, 0.23, 0.46, 8).translate(0, 1.45, 0)));
  g.add(ice(new THREE.CylinderGeometry(0.34, 0.22, 0.18, 8).translate(0, 1.76, 0)));
  const cape = ice(new THREE.BoxGeometry(0.9, 1.7, 0.08).translate(0, 0.85, 0), 'deep');
  cape.position.set(0, 0.02, -0.36);
  cape.rotation.x = 0.15;
  g.add(cape);
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (1.18 + i * 0.16);
    const c = crystal(0.05, 0.5 - Math.abs(i - 2) * 0.08, 'pale', 4);
    c.position.set(Math.cos(a) * 0.2, 1.84, Math.sin(a) * 0.2);
    leanOut(c, a, 0.35);
    g.add(c);
  }
  g.add(ice(new THREE.IcosahedronGeometry(0.2, 1).translate(0, 2.06, 0.02)));
  g.add(ice(new THREE.IcosahedronGeometry(0.22, 0).scale(1, 1.05, 1).translate(0, 2.1, -0.07), 'mid'));
  const cr = iceCrown(0.2, 0.44);
  cr.position.y = 2.22;
  g.add(cr);
  g.add(cyl(0.035, 0.045, 2.7, SILVER, 5, 0.46, 0, 0.1));
  g.add(crystal(0.1, 0.55, 'glow', 5).translateX(0.46).translateY(2.62).translateZ(0.1));
  const f = snowflake(0.3, GLOW, GLOW_E);
  f.position.set(0.46, 2.45, 0.14);
  g.add(f);
  g.add(ice(new THREE.BoxGeometry(0.11, 0.55, 0.11).translate(0.34, 1.32, 0.08), 'mid'));
  return g;
}

/** A stall of the fur and amber market: a booth of birch under a steep little roof of cloth and snow, its goods on the counter. */
function furStall(kind: number, cloth: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.4, 0.9, 1.2, PALE_WD));
  g.add(box(2.5, 0.08, 1.3, PALE_WD_DK, 0, 0.9, 0));
  for (const x of [-1.15, 1.15]) for (const z of [-0.55, 0.55]) g.add(birchPole(0.06, 2.2, x, z));
  for (const side of [-1, 1]) {
    const s = mesh(new THREE.BoxGeometry(2.8, 0.08, 1.05), cloth);
    s.position.set(0, 2.55, side * 0.42);
    s.rotation.x = side * 0.75;
    g.add(s);
    const sn = mesh(new THREE.BoxGeometry(2.7, 0.08, 0.6), SNOWW);
    sn.position.set(0, 2.72, side * 0.26);
    sn.rotation.x = side * 0.75;
    g.add(sn);
  }
  icicles(g, -1.35, 2.14, 0.8, 1.35, 0.8, 7, 0.35, kind + 11);
  g.add(box(2.6, 0.16, 0.12, FUR_W, 0, 2.12, 0.78));
  switch (kind % 4) {
    case 0:
      for (let i = 0; i < 4; i++) g.add(box(0.7, 0.08, 0.9, [FUR_W, FUR_G, FUR_B, 0xd8cdb8][i], -0.5 + (i % 2) * 0.1, 0.98 + i * 0.08, 0));
      g.add(blob(0.24, FUR_W, 0.6, 1.1, 0.1, 1.4, 0.6, 1));
      break;
    case 1:
      for (let i = 0; i < 6; i++) g.add(glow(new THREE.IcosahedronGeometry(0.1 + (i % 3) * 0.03, 0), AMBER, AMBER_E).translateX(-0.8 + i * 0.3).translateY(1.04).translateZ((i % 2) * 0.2 - 0.1));
      g.add(glow(new THREE.OctahedronGeometry(0.16, 0), AMBER, AMBER_E).translateX(0.8).translateY(1.6).translateZ(0.5));
      break;
    case 2:
      for (let i = 0; i < 3; i++) g.add(cyl(0.1, 0.07, 0.24, SILVER, 6, -0.6 + i * 0.35, 0.98, 0.1));
      for (let i = 0; i < 3; i++) g.add(crystal(0.08, 0.36, i % 2 ? 'mid' : 'glow', 5).translateX(0.3 + i * 0.25).translateY(0.98));
      break;
    default:
      for (let i = 0; i < 4; i++) g.add(box(0.5, 0.14, 0.16, 0xc8a078, -0.7 + i * 0.45, 0.98, 0.1));
      g.add(box(0.1, 0.8, 0.1, PALE_WD_DK, 0.9, 1.3, -0.3));
  }
  return g;
}

/** A field of barley under snow: low white ridges, the stubble and a few golden ears poking through. */
function barleyField(w: number, d: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.08, d, SNOW_SH));
  const rows = Math.max(2, Math.floor(d / 0.9));
  for (let i = 0; i < rows; i++) {
    const z = -d / 2 + (i + 0.5) * (d / rows);
    g.add(box(w - 0.4, 0.3, 0.46, SNOWW, 0, 0.05, z));
    for (let k = 0; k < 7; k++) g.add(cone(0.07, 0.42 + r() * 0.2, k % 3 ? 0xc9a55a : 0xe0bf6a, 4, -w / 2 + 0.5 + k * ((w - 1) / 6) + (r() - 0.5) * 0.3, 0.26, z + (r() - 0.5) * 0.2));
  }
  return g;
}

/** A winter garden under cloches of ice: rows of small glass-bright domes, each over green shoots. */
function clocheField(w: number, d: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.08, d, SNOW_SH));
  for (let i = 0; i < 5; i++) for (let k = 0; k < 3; k++) {
    const x = -w / 2 + 0.7 + i * ((w - 1.4) / 4), z = -d / 2 + 0.9 + k * ((d - 1.8) / 2);
    g.add(blob(0.16, 0x4f8a4a, x, 0.16, z, 1.3, 0.7, 1.3));
    g.add(mesh(new THREE.SphereGeometry(0.42, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.08, 0), ICE, { emissive: 0x2a6a90 }).translateX(x).translateZ(z));
    if (r() < 0.3) g.add(blob(0.12, SNOWW, x + 0.1, 0.46, z, 1.3, 0.5, 1.3));
  }
  for (const z of [-d / 2 + 0.25, d / 2 - 0.25]) g.add(box(w - 0.3, 0.14, 0.22, PALE_WD_DK, 0, 0.04, z));
  return g;
}

/** Hay drying on racks of birch rails, as they dry it in the north: long fences draped in gold under a fringe of snow. */
function hayRacks(w: number, d: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.08, d, SNOW_SH));
  for (const z of [-d * 0.26, d * 0.26]) {
    for (let i = 0; i < 5; i++) g.add(birchPole(0.07, 1.9, -w / 2 + 0.5 + i * ((w - 1) / 4), z));
    for (const y of [0.7, 1.2, 1.7]) g.add(box(w - 0.8, 0.06, 0.06, PALE_WD, 0, y, z));
    for (const s of [-1, 1]) {
      const hay = box(w - 1.0, 1.3, 0.14, 0xd4ae52, 0, 0.35, z + s * 0.16);
      hay.rotation.x = s * 0.18;
      g.add(hay);
    }
    g.add(box(w - 0.9, 0.14, 0.5, SNOWW, 0, 1.78, z));
  }
  void r;
  return g;
}

/** A tall windmill of the north: a round white stone base under a snowy cap, a birch mast and a rotor of pale sails. */
function frostMill(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(1.3, 1.55, 3.4, C.stone, 10));
  g.add(cyl(1.4, 1.4, 0.2, FRIEZE, 10, 0, 2.6));
  g.add(cone(1.6, 1.4, ROOF_SLATE, 10, 0, 3.4));
  g.add(cone(1.25, 0.9, SNOWW, 10, 0, 3.95));
  g.add(box(0.8, 1.4, 0.2, DOOR_DK, 0, 0, 1.45));
  g.add(birchPole(0.16, 4.2).translateY(4.6));
  const rotor = new THREE.Group();
  rotor.add(cyl(0.2, 0.2, 0.3, SILVER, 8).rotateX(Math.PI / 2));
  for (let i = 0; i < 6; i++) {
    const arm = new THREE.Group();
    arm.add(box(0.1, 2.5, 0.08, PALE_WD_DK, 0, 0, 0));
    arm.add(box(0.55, 1.8, 0.04, i % 2 ? SNOWW : 0xa8c8e8, 0.3, 0.6, 0));
    arm.rotation.z = (i / 6) * Math.PI * 2;
    rotor.add(arm);
  }
  const spun = moving(rotor, { spin: true });
  spun.position.set(0, 8.2, 0.35);
  g.add(spun);
  g.add(crystal(0.1, 0.5, 'pale', 5).translateY(8.8));
  return g;
}

/** A snow owl sitting on a perch (or a sculpture's shoulder), its wings folded. */
function perchedOwl(s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(blob(0.26 * s, 0xf6f8fa, 0, 0.3 * s, 0, 0.95, 1.2, 0.9));
  g.add(blob(0.19 * s, 0xf6f8fa, 0, 0.66 * s, 0.03 * s));
  for (const x of [-0.07, 0.07]) g.add(blob(0.045 * s, 0xf2c83a, x * s, 0.69 * s, 0.17 * s));
  for (const x of [-0.18, 0.18]) g.add(box(0.06 * s, 0.34 * s, 0.24 * s, 0xdfe4ea, x * s, 0.14 * s, -0.02));
  g.add(box(0.1 * s, 0.03 * s, 0.03 * s, 0x98a2ac, 0.05 * s, 0.34 * s, 0.24 * s));
  return g;
}

/** A snow mound (a buried hatch, a drift against a wall). */
function mound(x: number, z: number, r: number, h: number): THREE.Mesh {
  return blob(r, SNOWW, x, 0, z, 1.0, h / r, 1.0);
}

// ---------- the court's buildings ----------

/** Barracks: the hall of the Ice Wardens, and their sparring ring of packed ice walled with snow blocks. */
function barracks(t: number, color: number): Built {
  const g = new THREE.Group();
  g.add(frostHouse({ w: 7, d: 5, h: 3, roofH: 2.4, windows: 2, stone: t === 3 }));
  const cz = 6.0;
  g.add(mesh(new THREE.CylinderGeometry(2.55, 2.65, 0.1, 18), 0xcfe4f2, { emissive: 0x0c2638 }).translateZ(cz));
  for (let i = 0; i < 15; i++) {
    const a = -Math.PI * 0.3 + (i / 14) * Math.PI * 1.6;
    const b = box(0.85, 0.5, 0.45, i % 2 ? SNOWW : SNOW_SH, Math.cos(a) * 2.85, 0, cz + Math.sin(a) * 2.85);
    b.rotation.y = -a + Math.PI / 2;
    g.add(b);
  }
  for (const a of [-Math.PI * 0.3, Math.PI * 1.3, Math.PI / 2]) g.add(crystal(0.16, 1.3, 'mid', 6).translateX(Math.cos(a) * 2.9).translateY(0.3).translateZ(cz + Math.sin(a) * 2.9));
  // two wardens sparring: a Frostguard and an Ice Warden face to face
  const a = frostSoldier('sword')!;
  a.position.set(-0.8, 0.1, cz + 0.2);
  a.rotation.y = Math.PI / 2 - 0.3;
  const b = frostSoldier('spear')!;
  b.position.set(0.8, 0.1, cz - 0.1);
  b.rotation.y = -Math.PI / 2 + 0.2;
  g.add(a, b);
  // a rack of spears tipped with ice, and a training post in furs and a silver helm
  const rack = new THREE.Group();
  rack.add(box(2.0, 0.1, 0.12, PALE_WD_DK, 0, 1.25, 0));
  for (const x of [-0.95, 0.95]) rack.add(birchPole(0.07, 1.4, x, 0));
  for (let i = 0; i < 5; i++) {
    const sp = cyl(0.03, 0.03, 2.1, PALE_WD, 4, -0.7 + i * 0.35, 0, 0.1);
    sp.rotation.x = -0.12;
    rack.add(sp);
    rack.add(new THREE.Mesh(crystalGeo(0.07, 0.36, 4), bladeMat()).translateX(-0.7 + i * 0.35).translateY(2.05).translateZ(0.34));
  }
  rack.position.set(-2.9, 0, 3.3);
  g.add(rack);
  const post = new THREE.Group();
  post.add(birchPole(0.09, 1.9));
  post.add(blob(0.36, FUR_G, 0, 1.2, 0, 1, 1.3, 0.8), box(1.1, 0.1, 0.1, PALE_WD_DK, 0, 1.4, 0));
  post.add(cyl(0.2, 0.22, 0.24, SILVER, 7, 0, 1.78), cone(0.2, 0.2, SILVER, 7, 0, 2.02));
  post.position.set(3.2, 0, 3.6);
  g.add(post);
  if (t >= 2) {
    const wing = frostHouse({ w: 5, d: 4, h: 2.6, roofH: 2, windows: 1 });
    wing.position.set(-6.2, 0, 0.5);
    wing.rotation.y = Math.PI / 2;
    g.add(wing);
    const st = frostStandard(color, 4.6);
    st.position.set(4.3, 0, 2.2);
    g.add(st);
  }
  if (t >= 3) {
    const br = coldBrazier(1.0, 0.9);
    br.position.set(-3.5, 0, 6.3);
    g.add(br);
    const hs = hornStand();
    hs.position.set(3.5, 0, 7.6);
    hs.rotation.y = -0.6;
    g.add(hs);
  }
  g.add(drift(3.9, -2.9, 0.8, 0.4));
  return { obj: g, h: 7.5, w: 9, d: 8 };
}

/** Stable: a long byre of pale boards under a snowy roof, and a pen of birch rails where snow wolves and a mammoth are kept. */
function stable(t: number, r: () => number): Built {
  const g = new THREE.Group();
  g.add(frostHouse({ w: 9, d: 4.6, h: 2.6, roofH: 2.1, windows: 0, door: false, wall: PALE_WD }));
  for (const x of [-2.8, 0, 2.8]) {
    g.add(mesh(prismGeo(archOutline(1.4, 1.95, 1.3), 0.14), VOID).translateX(x).translateZ(2.36));
    g.add(box(1.6, 0.2, 0.2, FUR_W, x, 1.96, 2.42));
  }
  const fence = (len: number, x: number, z: number, ry: number) => { const f = birchFence(len); f.position.set(x, 0, z); f.rotation.y = ry; g.add(f); };
  fence(8, 0, 7, 0);
  fence(4.1, -4, 4.95, Math.PI / 2);
  fence(4.1, 4, 4.95, Math.PI / 2);
  const mounts: THREE.Group[] = t === 1 ? [snowWolf(), snowWolf(0xd6dde6)] : t === 2 ? [snowWolf(), mammoth(), snowWolf(0xd6dde6)] : [snowWolf(), mammoth(), snowWolf(0xd6dde6), reindeer()];
  const spots: [number, number, number][] = t === 1 ? [[-1.8, 4.6, 0.6], [1.6, 5.2, 2.6]] : [[-2.7, 5.3, 0.3], [0.3, 4.4, -0.35], [2.9, 5.9, 2.4], [-1.4, 6.2, 3.0]];
  mounts.forEach((m, i) => {
    const [x, z, ry] = spots[i];
    m.userData.mount = true;
    if (i === 1) m.scale.setScalar(0.78);
    m.position.set(x, 0, z + (r() - 0.5) * 0.3);
    m.rotation.y = ry;
    g.add(m);
  });
  // a trough of moss and hay, a kennel of snow blocks for the wolves
  g.add(box(1.6, 0.4, 0.6, PALE_WD_DK, 2.7, 0, 3.3), box(1.4, 0.14, 0.44, 0x7a8a52, 2.7, 0.34, 3.3));
  const k = igloo(0.8, false);
  k.position.set(-3.1, 0, 3.4);
  g.add(k, box(0.5, 0.5, 0.1, VOID, -3.1, 0, 4.16));
  g.add(drift(4.6, 1.2, 0.7, 0.5));
  return { obj: g, h: 6, w: 10, d: 10 };
}

/** Workshop: an open shed under a snowy roof, a wall of cut ice at its back; a frost trebuchet under it and an ice ram before it. */
function workshop(t: number, r: () => number): Built {
  const g = new THREE.Group();
  g.add(frostShed(7.6, 4.6, 3.3));
  for (let i = 0; i < 9; i++) for (let k = 0; k < 2; k++) g.add(iceBlock(-3.3 + i * 0.82 + (k % 2) * 0.4, k * 0.68, -2.3, 0.8, 0));
  const tb = frostTrebuchet();
  tb.position.set(0.3, 0, 0.1);
  g.add(tb);
  if (t >= 2) {
    const rm = iceRam();
    rm.position.set(-1.0, 0, 4.3);
    rm.rotation.y = 0.3;
    g.add(rm);
  }
  for (let i = 0; i < 6; i++) g.add(iceBlock(4.6 + (i % 3) * 0.62 - 0.6, Math.floor(i / 3) * 0.5, 1.4 + (i % 2) * 0.1, 0.58, r() * 0.4));
  const logs = birchPile(5);
  logs.position.set(5.0, 0, -1.0);
  logs.rotation.y = Math.PI / 2;
  g.add(logs);
  const cc = crystalCluster(0.6, r, 4, 1, 1);
  cc.position.set(-4.4, 0, 1.6);
  g.add(cc);
  return { obj: g, h: 6, w: 9, d: 8 };
}

/** Academy: the court's hall of learning, tall windows of ice down its front, and the observatory tower beside it where an
 *  armillary of silver rings turns about a crystal of starlight. */
function academy(r: () => number): Built {
  const g = new THREE.Group();
  const nave = frostHouse({ w: 6, d: 10, h: 5, roofH: 3.2, stone: true, roof: C.slate, windows: 0 });
  nave.rotation.y = Math.PI / 2;
  g.add(nave);
  for (const x of [-3.2, 0, 3.2]) g.add(iceWindow(x, 1.3, 3.04, 0.62, 2.4));
  const tw = frostTower(1.7, 9.5, { roof: null });
  tw.position.set(6.2, 0, 0);
  g.add(tw);
  g.add(mesh(prismGeo(archOutline(1.2, 2.4, 1.7), 0.2), DOOR_DK).translateX(6.2).translateZ(1.62));
  // the armillary: rings of silver turning about a crystal
  const arm = new THREE.Group();
  for (const [rx, rz] of [[0, 0], [Math.PI / 2, 0.4], [Math.PI / 2, -0.8]]) {
    const ring = mesh(new THREE.TorusGeometry(1.0, 0.05, 4, 22), SILVER);
    ring.rotation.set(rx, 0, rz);
    arm.add(ring);
  }
  arm.add(glow(new THREE.OctahedronGeometry(0.32, 0)));
  const turning = moving(arm, { orbit: 0.35 });
  turning.position.set(6.2, 9.5 + 1.9, 0);
  g.add(turning);
  g.add(cyl(0.1, 0.16, 1.0, SILVER_DK, 5, 6.2, 9.6, 0));
  const owl = perchedOwl(1.1);
  owl.position.set(-5.5, 5.0 + 3.2 * 1.45 + 0.35, 0);
  owl.rotation.y = -1.2;
  g.add(owl);
  const cc = crystalCluster(0.55, r, 4, 1, 1);
  cc.position.set(-3.9, 0, 3.7);
  g.add(cc);
  return { obj: g, h: 18, w: 14, d: 8 };
}

/** Smithy: the frost forge. A furnace burning blue-white with cold fire, a silver anvil on a block of ice with a blade of ice
 *  glowing on it, a quenching trough frozen over, and a racks of swords of ice. */
function smithy(t: number): Built {
  const g = new THREE.Group();
  g.add(frostHouse({ w: 6, d: 5, h: 3, roofH: 2.2, stone: true, roof: C.slate, windows: 1 }));
  g.add(cyl(0.6, 0.72, 6.6, C.stoneLight, 8, 1.8, 0, -1.2));
  for (const y of [2.6, 4.6, 6.2]) g.add(cyl(0.74, 0.74, 0.16, SILVER, 8, 1.8, y, -1.2));
  g.add(blob(0.5, SNOWW, 1.8, 6.62, -1.2, 1.2, 0.35, 1.2));
  const smoke = new THREE.Object3D();
  smoke.userData.dynamic = true;
  smoke.userData.smoke = true;
  smoke.position.set(1.8, 6.9, -1.2);
  g.add(smoke);
  const fg = frostForge();
  fg.position.set(-2.3, 0, 3.4);
  g.add(fg);
  const an = frostAnvil();
  an.position.set(0.4, 0, 3.4);
  g.add(an);
  // the quenching trough, frozen over
  g.add(box(1.4, 0.5, 0.7, PALE_WD_DK, 2.3, 0, 3.6));
  g.add(mesh(new THREE.BoxGeometry(1.26, 0.06, 0.56).translate(0, 0.5, 0), ICE, { emissive: ICE_E }).translateX(2.3).translateZ(3.6));
  // fur bellows
  const bl = new THREE.Group();
  bl.add(box(0.9, 0.3, 0.6, FUR_B, 0, 0.35, 0), box(0.9, 0.08, 0.6, PALE_WD, 0, 0.66, 0));
  bl.position.set(-3.8, 0, 2.5);
  bl.rotation.y = 0.4;
  g.add(bl);
  if (t >= 2) {
    const rack = new THREE.Group();
    rack.add(box(1.6, 0.1, 0.1, PALE_WD_DK, 0, 1.2, 0));
    for (const x of [-0.75, 0.75]) rack.add(birchPole(0.06, 1.3, x, 0));
    for (let i = 0; i < 3; i++) { const s = iceSword(0.7); s.position.set(-0.4 + i * 0.4, 0.3, 0.08); rack.add(s); }
    rack.position.set(3.3, 0, 2.6);
    rack.rotation.y = -0.3;
    g.add(rack);
  }
  if (t >= 3) {
    // a great sword of ice hung on the wall: the master's mark
    const s = iceSword(1.9);
    s.position.set(-1.6, 0.8, 2.66);
    s.scale.setScalar(1.2);
    g.add(s);
  }
  return { obj: g, h: 8, w: 8, d: 7 };
}

/** Rally point: the court's muster. Its standard raised tall, a warm hearth ringed with benches of ice, horns of ivory on their stands. */
function rally(color: number, r: () => number): Built {
  const g = new THREE.Group();
  const st = frostStandard(color, 7.4);
  g.add(st);
  g.add(cyl(0.5, 0.62, 0.4, C.stoneDark, 7));
  const hh = hearth(1.05);
  hh.position.set(2.6, 0, 1.6);
  g.add(hh);
  for (const [x, z, ry] of [[1.2, 3.3, 0.3], [4.3, 2.7, -0.8], [3.9, -0.3, 1.2]] as [number, number, number][]) {
    const b = iceBench(1.6);
    b.position.set(x, 0, z);
    b.rotation.y = ry;
    g.add(b);
  }
  for (const [x, z, ry] of [[-0.7, 1.5, 0.6], [1.5, -0.7, -0.9]] as [number, number, number][]) {
    const hs = hornStand();
    hs.position.set(x, 0, z);
    hs.rotation.y = ry;
    g.add(hs);
  }
  const cc = crystalCluster(0.5, r, 4, 1, 1);
  cc.position.set(-0.9, 0, 2.2);
  g.add(cc);
  return { obj: g, h: 10, w: 6, d: 6 };
}

/** The Frost Queen's statue: the queen carved in ice on an octagonal plinth of white stone, crystals growing at its corners,
 *  frost banners hung from it and lanterns of ice at its front. */
function statue(): Built {
  const g = new THREE.Group();
  g.add(cyl(2.2, 2.45, 0.45, C.stoneDark, 8));
  g.add(cyl(1.4, 1.62, 1.65, C.stone, 8, 0, 0.42));
  g.add(cyl(1.62, 1.5, 0.32, C.stoneLight, 8, 0, 2.0));
  g.add(cyl(1.44, 1.44, 0.14, FRIEZE, 8, 0, 1.2));
  g.add(blob(1.2, SNOWW, 0, 2.3, 0, 1.2, 0.08, 1.2));
  const r = rng(77);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const cc = crystalCluster(0.55, r, 4, 1, 1);
    cc.position.set(Math.cos(a) * 1.85, 0.4, Math.sin(a) * 1.85);
    g.add(cc);
  }
  const sf = snowflake(0.8, SILVER);
  sf.position.set(0, 1.2, 1.56);
  g.add(sf);
  for (const x of [-1, 1]) {
    const c = frostCloth(0.5, 1.2);
    c.position.set(x * 0.95, 2.0, 1.2 + 0.1);
    c.rotation.y = x * -0.35;
    g.add(c);
  }
  const q = queenStatue();
  q.position.y = 2.32;
  q.scale.setScalar(1.3);
  g.add(q);
  return { obj: g, h: 7.4, w: 5, d: 5 };
}

/** Market: the fur and amber market. Booths of birch under steep cloths and snow, pelts and amber and silver on their counters,
 *  and a reindeer sledge come in heaped with goods. */
function market(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const cloths = [FROST_BLUE, FUR_W, 0x8fb4d8, FROST_NAVY];
  const spots: [number, number, number][] = [[-2.8, 0, 0.2], [0.4, -1.8, -0.2], [3.4, 0.6, 0.4], [-0.6, 2.6, -0.1]];
  const n = Math.min(4, t + 1);
  for (let i = 0; i < n; i++) {
    const s = furStall(i, cloths[i]);
    s.position.set(spots[i][0], 0, spots[i][1]);
    s.rotation.y = spots[i][2];
    g.add(s);
  }
  // the sledge in from the north, its reindeer still in harness
  const tr = frostTrader();
  tr.position.set(1.6, 0, 4.4);
  tr.rotation.y = Math.PI / 2 - 0.25;
  g.add(tr);
  g.add(box(0.8, 0.7, 0.8, PALE_WD, -4.2, 0, 2.0), box(0.8, 0.7, 0.8, PALE_WD_DK, -4.4, 0, 3.0));
  for (const [x, z] of [[4.4, 2.8], [3.7, 3.5]] as [number, number][]) {
    g.add(blob(0.42, FUR_W, x, 0.3, z, 1.1, 0.8, 1));
    g.add(box(0.08, 0.08, 0.9, FUR_DK, x, 0.62, z));
  }
  if (t >= 3) {
    for (const x of [-1, 1]) {
      const l = iceLantern(2.3);
      l.position.set(x * 4.4, 0, -1.8);
      g.add(l);
    }
  }
  if (t >= 4) {
    const cc = crystalCluster(0.6, r, 4, 1, 1);
    cc.position.set(-4.3, 0, -1.6);
    g.add(cc);
  }
  return { obj: g, h: 5, w: 10, d: 8 };
}

/** Warehouse: the cold store. A long storehouse under a snowy roof with great doors, a house of ice blocks for what must keep,
 *  bales of fur and crates of birch stacked outside. */
function warehouse(t: number): Built {
  const g = new THREE.Group();
  g.add(frostHouse({ w: 8, d: 6, h: 3.6, roofH: 3, windows: 0, door: false, stone: t === 3 }));
  g.add(box(2.6, 2.8, 0.15, DOOR_DK, 0, 0, 3.05));
  for (const y of [0.7, 1.9]) g.add(box(2.7, 0.12, 0.08, SILVER, 0, y, 3.15));
  g.add(box(3.1, 0.3, 0.3, FUR_W, 0, 2.8, 3.12));
  g.add(box(3.0, 0.14, 0.3, SNOWW, 0, 3.1, 3.12));
  const ih = new THREE.Group();
  ih.add(mesh(new THREE.SphereGeometry(1.1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), ICE, { emissive: ICE_E }));
  for (const k of [0.35, 0.7]) ih.add(mesh(new THREE.TorusGeometry(Math.sqrt(1.21 - (1.1 * k) ** 2) + 0.01, 0.04, 3, 14).rotateX(Math.PI / 2), ICE_MID).translateY(1.1 * k));
  ih.add(box(0.5, 0.7, 0.1, VOID, 0, 0, 1.08));
  ih.position.set(-4.4, 0, 1.9);
  g.add(ih);
  for (let i = 0; i < 3 + t; i++) {
    const x = 4.6 + (i % 2) * 0.9, z = 2.6 - Math.floor(i / 2) * 0.9;
    if (i % 3 === 1) {
      g.add(blob(0.42, FUR_G, x, 0.34, z, 1.05, 0.85, 1));
      g.add(box(0.07, 0.07, 0.86, FUR_DK, x, 0.68, z));
    } else {
      g.add(box(0.8, 0.76, 0.8, PALE_WD, x, 0, z), box(0.84, 0.08, 0.84, PALE_WD_DK, x, 0.68, z));
    }
  }
  if (t >= 2) {
    const b2 = frostHouse({ w: 5.6, d: 4.6, h: 3, roofH: 2.3, windows: 0, door: false });
    b2.position.set(-1.8, 0, -5.8);
    g.add(b2);
  }
  return { obj: g, h: 8, w: 10, d: 8 };
}

/** Hiding place: a mound of snow over a hatch of birch, a doorway framed in blocks of ice, a cairn of ice beside it. */
function hiding(t: number): Built {
  const g = new THREE.Group();
  g.add(mound(0, -0.2, 1.3, 0.7));
  for (const x of [-0.6, 0.6]) g.add(iceBlock(x, 0, 0.75, 0.42), iceBlock(x, 0.34, 0.75, 0.38));
  g.add(mesh(new THREE.BoxGeometry(1.6, 0.26, 0.5).translate(0, 0.13, 0), ICE_MID, { emissive: ICE_MID_E }).translateY(0.66).translateZ(0.75));
  const hatch = box(0.9, 0.12, 0.8, PALE_WD, 0, 0.1, 0.9);
  hatch.rotation.x = -0.35;
  g.add(hatch, box(0.8, 0.5, 0.06, VOID, 0, 0.05, 0.55));
  g.add(box(0.14, 0.14, 0.14, SILVER, 0, 0.3, 1.2));
  for (let i = 0; i < (t >= 2 ? 4 : 3); i++) g.add(iceBlock(-1.05 + (i % 2) * 0.1, i * 0.28, -0.9 + (i % 2) * 0.05, 0.4 - i * 0.05, i * 0.4));
  if (t >= 2) g.add(crystal(0.1, 0.55, 'glow', 5).translateX(-1.0).translateY(1.12).translateZ(-0.88), mound(1.1, -0.6, 0.7, 0.4));
  return { obj: g, h: 2.5, w: 3, d: 3 };
}

/**
 * Watchtower: a slender spire of white stone tapering up to a railed balcony hung with icicles, a spire of ice above it and,
 * caged in silver near its point, the cold beacon that burns blue all night.
 */
function watchtower(t: number, color: number, r: () => number): Built {
  const g = new THREE.Group();
  const h = 7 + t * 1.6;
  const deck = h * 0.9;
  g.add(cyl(1.5, 1.6, 0.5, C.stoneDark, 10));
  g.add(cyl(0.95, 1.28, deck, C.stone, 10));
  for (const k of [0.3, 0.62]) g.add(cyl(1.28 - k * 0.33 + 0.04, 1.28 - k * 0.33 + 0.04, 0.16, SILVER, 10, 0, deck * k));
  for (const a of [Math.PI / 2, Math.PI / 2 + 2.2]) {
    const rr = 1.28 - 0.5 * 0.33;
    const s = box(0.26, 0.7, 0.1, C.window, Math.cos(a) * rr, deck * 0.5, Math.sin(a) * rr);
    s.rotation.y = -a + Math.PI / 2;
    s.userData.window = true;
    g.add(s);
  }
  // the balcony and its rail, icicles under it
  g.add(cyl(1.9, 1.6, 0.3, C.stoneLight, 12, 0, deck - 0.3));
  icicleRing(g, 1.78, deck - 0.3, 16, 0.6, t);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    g.add(box(0.07, 0.7, 0.07, SILVER_DK, Math.cos(a) * 1.8, deck, Math.sin(a) * 1.8));
  }
  g.add(mesh(new THREE.TorusGeometry(1.8, 0.05, 4, 28).rotateX(Math.PI / 2), SILVER).translateY(deck + 0.7));
  // above the balcony: the tower's head, then the spire of ice
  g.add(cyl(0.8, 0.9, h - deck + 0.6, C.stone, 10, 0, deck));
  g.add(cyl(1.0, 0.85, 0.3, C.stoneLight, 10, 0, h + 0.5));
  const sh = 3.4 + t * 0.35;
  g.add(crystal(0.62, sh, 'pale', 6).translateY(h + 0.8));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const c = crystal(0.17, 0.9 + (i % 2) * 0.5, i % 2 ? 'mid' : 'deep', 5);
    c.position.set(Math.cos(a) * 0.55, h + 0.8, Math.sin(a) * 0.55);
    leanOut(c, a, 0.42);
    g.add(c);
  }
  // the cold beacon, caged in silver near the spire's point
  const by = h + 0.8 + sh * 0.52;
  g.add(glow(new THREE.OctahedronGeometry(0.46, 0)).translateY(by));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.add(box(0.05, 1.1, 0.05, SILVER, Math.cos(a) * 0.52, by - 0.55, Math.sin(a) * 0.52));
  }
  g.add(mesh(new THREE.TorusGeometry(0.52, 0.04, 3, 12).rotateX(Math.PI / 2), SILVER).translateY(by + 0.52), mesh(new THREE.TorusGeometry(0.52, 0.04, 3, 12).rotateX(Math.PI / 2), SILVER).translateY(by - 0.55));
  const f = frostCloth(0.9, 1.6, color);
  f.position.set(0, deck + 0.62, 1.84);
  g.add(f);
  const cc = crystalCluster(0.55, r, 4, 1, 1);
  cc.position.set(-1.3, 0, 1.2);
  g.add(cc);
  return { obj: g, h: h + sh + 1.2, w: 4, d: 4 };
}

// ---------- the workplaces out on the land ----------

/** The timber camp: birch-cutters in a snowbound wood that thins as it is felled; birch logs stacked by the track, a cabin of
 *  birch logs, log sledges and a reindeer to haul them, a hoist, a frost sawmill and at last the woodcutters' lodge. */
function timberCamp(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const n = 13 - t;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.3 - r() * Math.PI * 0.65, d = 7 + r() * 4;
    const tr = r() < 0.55 ? snowPine(r, 1.05) : frostBirch(r, 1.05);
    tr.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    g.add(tr);
  }
  for (let i = 0; i < 2 + t; i++) {
    const a = -Math.PI * 0.1 - r() * Math.PI * 0.8, d = 3.5 + r() * 4;
    g.add(snowStump(Math.cos(a) * d, Math.sin(a) * d));
  }
  const piles = Math.min(5, 1 + Math.floor(t * 0.7));
  for (let i = 0; i < piles; i++) {
    const p = birchPile(3 + Math.min(4, t));
    p.position.set(-3.6 + i * 2.2, 0, 3.4 + (i % 2) * 1.3);
    p.rotation.y = 0.15 * i;
    g.add(p);
  }
  if (t === 1) {
    for (const x of [-5, -3]) g.add(birchPole(0.08, 1.9, x, -0.6));
    const lean = box(2.6, 0.12, 2.2, FUR_G, -4, 1.2, 0.2);
    lean.rotation.x = 0.55;
    g.add(lean);
  }
  if (t >= 2) {
    const hut = birchCabin(4.0, 3.2, 2.2);
    hut.position.set(-6.3, 0, -1.4);
    hut.rotation.y = 0.5;
    g.add(hut);
  }
  if (t >= 3) {
    const sl = sledge(2.2, 'logs');
    sl.position.set(2.2, 0, 3.8);
    sl.rotation.y = 1.4;
    g.add(sl);
  }
  if (t >= 4) {
    const rd = reindeer();
    rd.position.set(4.6, 0, 1.2);
    rd.rotation.y = -0.4;
    g.add(rd);
    const sl = sledge(2.2, 'logs');
    sl.position.set(4.1, 0, 3.2);
    sl.rotation.y = 0.35;
    g.add(sl);
  }
  if (t >= 5) {
    // a hoist of birch poles for the big trunks, one hanging from it
    const cr = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      cr.add(limb(V(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5), V(0, 5.2, 0), 0.12, 0.09, BIRCH, 5));
    }
    cr.add(box(0.04, 1.8, 0.04, FUR_DK, 0, 3.4, 0));
    const lg = cyl(0.3, 0.3, 3.0, BIRCH, 7);
    lg.rotation.z = Math.PI / 2;
    lg.position.set(1.5, 3.2, 0);
    cr.add(lg);
    cr.position.set(5.8, 0, -3.8);
    g.add(cr);
  }
  if (t >= 6) {
    const mill = frostShed(5.2, 3.6, 2.6);
    mill.add(box(3.6, 0.9, 1.0, PALE_WD_DK, 0, 0, 0));
    const saw = new THREE.Group();
    saw.add(mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.05, 16).rotateX(Math.PI / 2), SILVER));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; saw.add(box(0.16, 0.12, 0.06, SILVER_DK, Math.cos(a) * 0.86, Math.sin(a) * 0.86 - 0.06, 0)); }
    const blade = moving(saw, { spin: true });
    blade.position.set(0.4, 1.2, 0);
    mill.add(blade);
    const lg = cyl(0.3, 0.3, 3.4, BIRCH, 7);
    lg.rotation.z = Math.PI / 2;
    lg.position.set(-0.6, 1.25, 0);
    mill.add(lg);
    mill.position.set(0.4, 0, -4.4);
    g.add(mill);
    const pl = new THREE.Group();
    for (let i = 0; i < 6; i++) pl.add(box(2.6, 0.14, 0.7, i % 2 ? PALE_WD : 0xe6d2a4, 0, i * 0.15, (i % 3) * 0.02));
    pl.add(box(2.5, 0.12, 0.66, SNOWW, 0, 0.9, 0));
    pl.position.set(-3.2, 0.1, -4.2);
    pl.rotation.y = Math.PI / 2;
    g.add(pl);
  }
  if (t >= 7) {
    const lodge = frostHouse({ w: 5.6, d: 4.4, h: 3.2, roofH: 2.3, windows: 2, stone: true });
    lodge.position.set(-7.6, 0, 4.2);
    lodge.rotation.y = 1.1;
    g.add(lodge);
  }
  const post = frostPost(2.6);
  post.position.set(4.2, 0, 6.2);
  g.add(post);
  return { obj: g, h: 6 + (t >= 5 ? 1.5 : 0), w: 10, d: 10 };
}

/** A kiln of the court: a dome of white stone, a crystal on its crown, its mouth burning with cold fire. */
function frostKiln(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(1.75, 1.8, 0.4, C.stoneDark, 10));
  g.add(mesh(new THREE.SphereGeometry(1.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.stoneLight).translateY(0.35));
  g.add(mesh(new THREE.SphereGeometry(1.2, 10, 3, 0, Math.PI * 2, 0, Math.PI / 5), SNOWW).translateY(0.75));
  g.add(glow(prismGeo(archOutline(0.8, 0.9, 0.5), 0.2), CFLAME, CFLAME_E).translateY(0.35).translateZ(1.5));
  g.add(crystal(0.2, 1.0, 'mid', 6).translateY(1.9));
  const smoke = new THREE.Object3D();
  smoke.userData.dynamic = true;
  smoke.userData.smoke = true;
  smoke.position.set(0, 2.6, 0);
  g.add(smoke);
  return g;
}

/** The clay pit: a quarry of clay and ice, dug wider and deeper each level in snowy terraces round a frozen floor; cut blocks of
 *  ice and fired bricks stacked by the track, a block sledge, kilns burning with cold fire and at last a great ice-block hoist. */
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
    const snow = mesh(new THREE.TorusGeometry(pr - k * 0.8 + 0.3, 0.12, 3, 20).rotateX(Math.PI / 2), SNOWW);
    snow.scale.set(1.25, 1, 1);
    snow.position.y = 0.14 + k * 0.03;
    g.add(snow);
  }
  if (t >= 2) {
    const floor = mesh(new THREE.CylinderGeometry(pr * 0.4, pr * 0.4, 0.06, 12), ICE, { emissive: ICE_E });
    floor.scale.set(1.25, 1, 1);
    floor.position.y = 0.2 + steps * 0.03;
    g.add(floor);
    for (let i = 0; i < 3; i++) g.add(box(pr * 0.5, 0.02, 0.04, ICE_DEEP, (i - 1) * 0.3, 0.26 + steps * 0.03, (i - 1) * 0.25).rotateY(i * 0.9));
    const lad = new THREE.Group();
    for (const x of [-0.3, 0.3]) lad.add(box(0.08, 2.2, 0.08, PALE_WD_DK, x, 0, 0));
    for (let y = 0.3; y < 2.1; y += 0.45) lad.add(box(0.6, 0.06, 0.06, PALE_WD_DK, 0, y, 0));
    lad.rotation.x = -1.0;
    lad.position.set(-pr * 0.9, 0.05, 1.2);
    g.add(lad);
  }
  // blocks of ice and stacks of fired brick by the track, more each level
  const stacks = Math.min(8, t + 1);
  for (let i = 0; i < stacks; i++) {
    const st = new THREE.Group();
    if (i % 2 === 0) {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) st.add(iceBlock(x * 0.66 - 0.33, y * 0.52, 0, 0.62, (x + y) * 0.1));
    } else {
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) st.add(box(0.5, 0.26, 0.9, (x + y) % 2 ? C.brick : C.clay, x * 0.55 - 0.55, y * 0.27, 0));
      st.add(box(1.7, 0.1, 0.94, SNOWW, 0, 0.81, 0));
    }
    st.position.set(6.6 + (i % 2) * 1.8, 0, -3.4 + Math.floor(i / 2) * 1.6);
    g.add(st);
  }
  if (t >= 2) {
    const rows = Math.min(4, t - 1);
    for (let rr = 0; rr < rows; rr++) for (let i = 0; i < 7; i++) {
      g.add(box(0.42, 0.18, 0.24, C.clay, -2.2 + i * 0.6, 0, 5.2 + rr * 0.55));
      g.add(box(0.44, 0.05, 0.26, SNOWW, -2.2 + i * 0.6, 0.18, 5.2 + rr * 0.55));
    }
    const sl = sledge(2.1, 'ice');
    sl.position.set(3.4, 0, 5.2);
    sl.rotation.y = 0.6 + Math.PI / 2;
    g.add(sl);
  }
  for (let i = 0; i < 3; i++) {
    const x = -6 + r() * 1.5, z = -4 + i * 1.6;
    g.add(blob(0.7, C.clayDark, x, 0.2, z, 1.2, 0.6, 1.0), blob(0.5, SNOWW, x, 0.48, z, 1.2, 0.3, 1.0));
  }
  if (t >= 3) {
    const hut = birchCabin(3.8, 3.0, 2.1);
    hut.position.set(-7, 0, 3.2);
    hut.rotation.y = 0.8;
    g.add(hut);
  }
  if (t >= 4) { const k = frostKiln(); k.position.set(4.6, 0, -5.8); g.add(k); }
  if (t >= 5) {
    const shed = frostShed(5.6, 3.2, 2.4);
    shed.add(box(4.2, 0.9, 1.0, PALE_WD_DK, 0, 0, 0));
    for (let i = 0; i < 6; i++) shed.add(box(0.4, 0.16, 0.24, C.clay, -1.6 + i * 0.64, 0.9, 0));
    shed.position.set(-3.2, 0, -6.4);
    g.add(shed);
  }
  if (t >= 6) { const k = frostKiln(); k.position.set(8.4, 0, 2.6); k.rotation.y = -1.2; g.add(k); }
  if (t >= 7) {
    // the great hoist: an A-frame of birch over the pit's lip, a block of ice swinging from its chain
    const ho = new THREE.Group();
    for (const s of [-1, 1]) {
      ho.add(limb(V(s * 1.6, 0, -0.6), V(s * 0.2, 7.2, 0), 0.16, 0.12, BIRCH, 6));
      ho.add(limb(V(s * 1.6, 0, 0.6), V(s * 0.2, 7.2, 0), 0.16, 0.12, BIRCH, 6));
    }
    ho.add(box(0.8, 0.3, 0.3, SILVER_DK, 0, 7.1, 0));
    ho.add(limb(V(0, 7.2, 0), V(0, 6.8, 3.2), 0.12, 0.1, BIRCH, 5));
    ho.add(box(0.04, 2.4, 0.04, SILVER_DK, 0, 4.4, 3.2));
    ho.add(iceBlock(0, 3.6, 3.2, 0.9, 0.3));
    ho.add(crystal(0.1, 0.5, 'glow', 5).translateY(7.4));
    ho.position.set(1.2, 0, -8.4);
    g.add(ho);
  }
  const post = frostPost(2.6);
  post.position.set(1.4, 0, 6.8);
  g.add(post);
  return { obj: g, h: 4 + (t >= 7 ? 5 : t >= 4 ? 2 : 0), w: 12, d: 10 };
}

/** The iron mine: a glacier mine. A crag of blue-grey rock under snow and ice, its adit framed by two great crystals under a
 *  silver lintel, a cold glow in its mouth; carts of silver ore, a birch headframe with a silver wheel, a smelter of cold fire. */
function ironMine(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const ROCK = 0xa3b2c4, ROCK_D = 0x7f8fa4;
  const grow = 0.75 + t * 0.06;
  const hill = [
    [0, -3, 5.5, 4.2], [-5, -1.5, 4, 3], [5, -2, 4.5, 3.4], [-2, -6, 5, 5.5], [3.5, -6.5, 4.5, 4.6], [-6.5, -5.5, 3.6, 3.8], [7, -5.8, 3.4, 3.2],
  ].slice(0, 4 + Math.min(3, Math.floor(t / 2)));
  hill.forEach(([x, z, sc, h], i) => {
    const k = i === 0 ? 1 : grow;
    const zz = z - (k - 1) * 5;
    const m = blob(sc * k, r() < 0.5 ? ROCK : ROCK_D, x, h * k * 0.35, zz, 1.1, h / sc, 1.0);
    m.rotation.y = r() * 3;
    g.add(m);
    g.add(blob(sc * k * 0.62, SNOWW, x, h * k * 0.35 + h * k * 0.62, zz, 1.1, (h / sc) * 0.32, 1.0));
    if (i % 2 === 1) g.add(mesh(new THREE.BoxGeometry(sc * k * 0.7, h * k * 0.42, 0.5), ICE, { emissive: ICE_E }).translateX(x).translateY(h * k * 0.3).translateZ(zz + sc * k * 0.62).rotateX(-0.6));
  });
  // the adit: framed by two great crystals under a silver lintel, a cold glow within
  const ent = new THREE.Group();
  ent.add(box(2.6, 2.8, 0.6, VOID));
  for (const x of [-1.5, 1.5]) ent.add(crystal(0.34, 3.4, 'mid', 6).translateX(x).translateZ(0.35));
  ent.add(box(3.6, 0.4, 0.45, SILVER_DK, 0, 3.0, 0.3));
  const sf = snowflake(0.6, SILVER);
  sf.position.set(0, 3.2, 0.56);
  ent.add(sf);
  ent.add(glow(new THREE.BoxGeometry(2.2, 0.3, 0.1)).translateY(0.1).translateZ(0.34));
  ent.position.set(0, 0, 1.5);
  g.add(ent);
  const railLen = 3 + Math.min(4, t) * 0.8;
  for (const x of [-0.5, 0.5]) g.add(box(0.1, 0.08, railLen, SILVER_DK, x, 0.05, 1.8 + railLen / 2));
  const oreCart = (x: number, z: number) => {
    const c = new THREE.Group();
    c.add(box(1.2, 0.7, 1.4, PALE_WD_DK, 0, 0.25, 0));
    c.add(blob(0.5, 0x9aa6b4, 0, 1.0, 0, 1.2, 0.6, 1.2));
    c.add(glow(new THREE.OctahedronGeometry(0.1, 0)).translateY(1.25).translateZ(0.2));
    c.position.set(x, 0, z);
    g.add(c);
  };
  oreCart(0, 1.8 + railLen - 0.8);
  for (let i = 0; i < Math.min(5, t); i++) {
    const x = -4.6 + i * 1.5, z = 4.2 + (i % 2) * 0.9;
    g.add(blob(0.8 + r() * 0.3, 0x8c98a8, x, 0.2, z, 1.2, 0.55, 1.1));
    g.add(glow(new THREE.OctahedronGeometry(0.1, 0)).translateX(x + 0.2).translateY(0.62).translateZ(z + 0.2));
  }
  if (t >= 2) {
    const l = iceLantern(2.1);
    l.position.set(-2.2, 0, 2.4);
    g.add(l);
  }
  if (t >= 3) {
    const hut = birchCabin(3.8, 3.0, 2.1);
    hut.position.set(5, 0, 3.8);
    hut.rotation.y = -0.5;
    g.add(hut);
  }
  if (t >= 4) {
    // a headframe of birch over a shaft, its silver wheel turning
    const hf = new THREE.Group();
    for (const s2 of [-1, 1]) for (const z of [-0.8, 0.8]) hf.add(limb(V(s2 * 1.3, 0, z), V(s2 * 0.6, 5.3, z * 0.8), 0.13, 0.1, BIRCH, 5));
    hf.add(box(2.4, 0.25, 1.8, PALE_WD_DK, 0, 5.2, 0));
    const wheel = new THREE.Group();
    wheel.add(mesh(new THREE.TorusGeometry(0.9, 0.08, 5, 14), SILVER));
    for (let i = 0; i < 4; i++) { const sp = box(0.06, 1.8, 0.06, SILVER_DK, 0, -0.9, 0); sp.rotation.z = (i / 4) * Math.PI; wheel.add(sp); }
    wheel.userData.dynamic = true;
    wheel.userData.spin = true;
    wheel.position.set(0, 5.9, 0);
    hf.add(wheel);
    hf.add(cyl(1.0, 1.0, 0.3, VOID, 8, 0, 0, 0));
    hf.position.set(-5.8, 0, 1.6);
    g.add(hf);
  }
  if (t >= 5) {
    // the smelter of cold fire: a white stone stack glowing blue at its foot, steam rising from it
    const fu = new THREE.Group();
    fu.add(cyl(1.1, 1.5, 3.4, C.stone, 8));
    fu.add(cyl(1.2, 1.2, 0.18, SILVER, 8, 0, 2.2));
    fu.add(cyl(0.7, 0.9, 1.2, C.stoneLight, 8, 0, 3.4));
    fu.add(glow(prismGeo(archOutline(0.7, 0.8, 0.45), 0.2), CFLAME, CFLAME_E).translateY(0.25).translateZ(1.38));
    const smoke = new THREE.Object3D();
    smoke.userData.dynamic = true;
    smoke.userData.smoke = true;
    smoke.position.set(0, 4.8, 0);
    fu.add(smoke);
    fu.position.set(7.2, 0, -0.6);
    g.add(fu);
    const slag = mesh(new THREE.IcosahedronGeometry(1.1, 0), ICE_DEEP, { emissive: ICE_DEEP_E });
    slag.position.set(8.8, 0.2, 2.6);
    slag.scale.set(1.2, 0.4, 1.1);
    g.add(slag);
  }
  if (t >= 6) {
    const e2 = ent.clone();
    e2.position.set(-3.2, 0, -1.4);
    e2.rotation.y = 0.4;
    e2.scale.setScalar(0.8);
    g.add(e2);
    oreCart(0, 2.6);
  }
  if (t >= 7) {
    const lodge = frostHouse({ w: 5, d: 3.8, h: 2.8, roofH: 1.9, roof: C.slate, windows: 2, stone: true });
    lodge.position.set(-7.5, 0, 7.2);
    lodge.rotation.y = 0.4;
    g.add(lodge);
  }
  for (let i = 0; i < 5; i++) {
    const x = -6 + r() * 12, z = 2 + r() * 4;
    g.add(blob(0.55 + r() * 0.3, ROCK_D, x, 0.15, z, 1.2, 0.6, 1.0), blob(0.4, SNOWW, x, 0.4, z, 1.2, 0.3, 1.0));
  }
  const post = frostPost(2.6);
  post.position.set(2.4, 0, 6.6);
  g.add(post);
  return { obj: g, h: 8 + (t >= 4 ? 1 : 0), w: 12, d: 12 };
}

/** The farm: a frost house grown to a stone farmstead; fields of barley under snow, gardens under cloches of ice and hay drying
 *  on racks of birch; a windmill of pale sails, a byre, a paddock of reindeer and a granary of snow blocks. */
function farm(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const fh = t >= 7
    ? frostHouse({ w: 7, d: 5, h: 3.4, roofH: 2.6, roof: C.thatch, windows: 3, stone: true })
    : frostHouse({ w: 4.6 + Math.min(3, t) * 0.4, d: 4.0, h: 2.5, roofH: 2.1, roof: C.thatch, windows: 1 });
  g.add(fh);
  const spots: [number, number][] = [[-8, -6], [0, -8.5], [8, -6], [-9.5, 3], [-4.5, -15.5], [4.5, -15.5], [13.5, -12], [15.5, -3.5], [-13.5, -12]];
  const fields = Math.min(spots.length, t + 1);
  for (let i = 0; i < fields; i++) {
    const f = i % 3 === 1 ? clocheField(6.5, 5, r) : i % 3 === 2 ? hayRacks(6.5, 5, r) : barleyField(6.5, 5, r);
    f.position.set(spots[i][0], 0, spots[i][1]);
    f.rotation.y = (r() - 0.5) * 0.3;
    g.add(f);
  }
  // stooks of barley capped with snow by the yard
  for (let i = 0; i < Math.min(6, 1 + t); i++) {
    const x = 0.5 + r() * 2.5, z = 5.6 + r() * 1.2;
    g.add(cone(0.36, 1.0, 0xcfa656, 6, x, 0, z), cone(0.22, 0.3, SNOWW, 6, x, 0.72, z));
  }
  if (t >= 2) {
    // the well: a white stone ring, a silver windlass, a lid of ice
    g.add(cyl(0.8, 0.85, 0.8, C.stone, 8, -3.2, 0, 3.8));
    g.add(mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.06, 8), ICE, { emissive: ICE_E }).translateX(-3.2).translateY(0.8).translateZ(3.8));
    for (const x of [-3.8, -2.6]) g.add(birchPole(0.06, 1.8, x, 3.8).translateY(0.8));
    g.add(cyl(0.08, 0.08, 1.3, SILVER, 6, -3.2, 2.2, 3.8).rotateZ(Math.PI / 2));
    g.add(cone(0.9, 0.7, ROOF_SLATE, 4, -3.2, 2.6, 3.8).rotateY(Math.PI / 4), cone(0.6, 0.35, SNOWW, 4, -3.2, 2.95, 3.8).rotateY(Math.PI / 4));
  }
  if (t >= 3) {
    const wm = frostMill();
    wm.position.set(-14, 0, -3.5);
    wm.rotation.y = 0.6;
    g.add(wm);
  }
  if (t >= 4) {
    const b = frostHouse({ w: 6, d: 7.5, h: 3.0, roofH: 2.6, windows: 0, wall: PALE_WD });
    b.position.set(10, 0, 2.5);
    b.rotation.y = -Math.PI / 2;
    g.add(b);
  }
  if (t >= 5) {
    // a paddock of reindeer
    const pad = new THREE.Group();
    for (const [x, z, rot, len] of [[0, 2.4, 0, 6.6], [0, -2.4, 0, 6.6], [3.3, 0, Math.PI / 2, 4.8], [-3.3, 0, Math.PI / 2, 4.8]] as [number, number, number, number][]) {
      const fe = birchFence(len);
      fe.position.set(x, 0, z);
      fe.rotation.y = rot;
      pad.add(fe);
    }
    for (let i = 0; i < 4; i++) {
      const rd = reindeer(i % 2 ? 0x8a735a : 0x9d8a70);
      rd.scale.setScalar(0.72);
      rd.position.set(-2 + i * 1.3, 0, (i % 2 ? 1 : -1) * 0.8);
      rd.rotation.y = r() * 6;
      pad.add(rd);
    }
    pad.position.set(-7.5, 0, 7.5);
    g.add(pad);
  }
  if (t >= 6) {
    const gr = igloo(1.3, true);
    gr.position.set(-5, 0, -1.4);
    g.add(gr);
  }
  if (t >= 8) {
    const b2 = frostHouse({ w: 4.6, d: 5.2, h: 2.6, roofH: 2.1, windows: 0, wall: PALE_WD });
    b2.position.set(4.6, 0, -2.2);
    b2.rotation.y = Math.PI;
    g.add(b2);
  }
  const f2 = birchFence(10);
  f2.position.set(0, 0, 4.4);
  g.add(f2);
  const post = frostPost(2.6);
  post.position.set(5.6, 0, 5.4);
  g.add(post);
  // a snow owl on a tall perch keeps the fields
  const perch = new THREE.Group();
  perch.add(birchPole(0.08, 2.6), box(0.9, 0.08, 0.08, PALE_WD_DK, 0, 2.5, 0));
  const ow = perchedOwl(1.1);
  ow.position.set(0.25, 2.55, 0);
  perch.add(ow);
  perch.position.set(0, 0, -12);
  g.add(perch);
  return { obj: g, h: 6 + (t >= 4 ? 2 : 0), w: 8, d: 8 };
}

/** The Frost Queen's own buildings: every one of them, from the igloo camp to the reindeer paddock. */
export function frostModel(id: BuildingId, t: number, color: number, r: () => number): Built | null {
  switch (id) {
    case 'main': return frostHall(t, color);
    case 'barracks': return barracks(t, color);
    case 'stable': return stable(t, r);
    case 'workshop': return workshop(t, r);
    case 'academy': return academy(r);
    case 'smithy': return smithy(t);
    case 'rally': return rally(color, r);
    case 'statue': return statue();
    case 'market': return market(t, r);
    case 'warehouse': return warehouse(t);
    case 'hiding': return hiding(t);
    case 'watchtower': return watchtower(t, color, r);
    case 'timber': return timberCamp(t, r);
    case 'claypit': return clayPit(t, r);
    case 'ironmine': return ironMine(t, r);
    case 'farm': return farm(t, r);
    default: return null;
  }
}

/** The sign board behind a building's emblem, in the court's fashion: a disc of ice in a silver rim set with points of ice. */
export function frostPlaque(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 14).rotateX(Math.PI / 2), 0x9cc8ea, { emissive: 0x10304a }));
  g.add(mesh(new THREE.TorusGeometry(0.62, 0.05, 4, 20), SILVER));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
    const c = crystal(0.05, 0.22, 'pale', 4);
    c.rotation.z = a - Math.PI / 2;
    c.position.set(Math.cos(a) * 0.66, Math.sin(a) * 0.66, 0);
    g.add(c);
  }
  return g;
}

// ---------- the walls ----------

/**
 * The first walls of the court: a rampart of packed snow blocks laid in two courses, a block of clear ice set in it here
 * and there, shards of ice along its top leaning out at the enemy, and a gate between two pillars of ice under a lintel
 * of ice with the snowflake on it. From the second size, towers of snow and ice blocks with a deck to stand on, a crystal
 * spire at its back and icicles under its lip. (Kept at the heights of the old palisade, so ladders and lookouts fit.)
 */
export function frostRampart(g: THREE.Group, tier: number, R: number, start: number, end: number, gateA: number, gateHalf: number): void {
  const h = tier === 1 ? 2.7 : 3.7;
  const step = 1.55 / R;
  let i = 0;
  for (let a = start + step / 2; a <= end - step / 2 + 0.001; a += step, i++) {
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    const lo = box(1.6, h * 0.55, 1.2, i % 7 === 3 ? ICE_MID : SNOW_SH, 0, 0, 0);
    lo.position.set(x, 0, z);
    lo.rotation.y = -a + Math.PI / 2;
    g.add(lo);
    const a2 = a + step / 2;
    if (a2 < end - step * 0.3) {
      const hi = box(1.55, h * 0.45 + (Math.sin(a * 23) + 1) * 0.08, 1.0, i % 9 === 5 ? ICE : SNOWW, 0, 0, 0);
      hi.position.set(Math.cos(a2) * R, h * 0.55, Math.sin(a2) * R);
      hi.rotation.y = -a2 + Math.PI / 2;
      g.add(hi);
    }
    if (i % 4 === 1) {
      const c = crystal(0.12, 0.9 + (i % 3) * 0.25, i % 8 === 1 ? 'mid' : 'pale', 5);
      c.position.set(Math.cos(a) * (R + 0.2), h - 0.05, Math.sin(a) * (R + 0.2));
      leanOut(c, a, 0.55);
      g.add(c);
    }
  }
  // the gate: two pillars of ice, a lintel of ice, the snowflake over the way
  for (const s of [-1, 1]) {
    const a = gateA + s * gateHalf;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    g.add(cyl(0.75, 0.85, 0.5, C.stoneDark, 8, x, 0, z));
    g.add(crystal(0.62, h + 3.2, 'mid', 6).translateX(x).translateY(0.4).translateZ(z));
    for (let k = 0; k < 3; k++) {
      const c = crystal(0.2, 1.2 + k * 0.3, k === 1 ? 'deep' : 'pale', 5);
      const ca = s > 0 ? -0.4 - k * 0.5 : Math.PI + 0.4 + k * 0.5;
      c.position.set(x + Math.cos(ca) * 0.55, 0.3, z + 0.2 + Math.sin(ca) * 0.3);
      leanOut(c, ca, 0.4);
      g.add(c);
    }
  }
  const span = gateHalf * 2 * R + 1.6;
  g.add(mesh(new THREE.BoxGeometry(span, 0.6, 0.8).translate(0, 0.3, 0), ICE_MID, { emissive: ICE_MID_E }).translateY(h + 1.3).translateZ(R));
  icicles(g, -span / 2 + 0.2, h + 1.3, R + 0.42, span / 2 - 0.2, R + 0.42, 12, 0.8, 2);
  const f = snowflake(1.1, SILVER);
  f.position.set(0, h + 2.7, R + 0.3);
  g.add(f);
  g.add(glow(new THREE.OctahedronGeometry(0.22, 0)).translateY(h + 2.7).translateZ(R + 0.4));
  if (tier === 2) {
    for (let k = 0; k < 8; k++) {
      const a = gateA + gateHalf + 0.35 + (k / 8) * (Math.PI * 2 - gateHalf * 2 - 0.5);
      const tw = new THREE.Group();
      tw.add(cyl(1.4, 1.62, 6.4, SNOW_SH, 6));
      for (const y of [1.9, 4.2]) tw.add(mesh(new THREE.CylinderGeometry(1.5 - y * 0.02, 1.5 - y * 0.02, 0.5, 6).translate(0, y, 0), ICE, { emissive: ICE_E }));
      tw.add(cyl(1.8, 1.55, 0.32, SNOWW, 6, 0, 6.4));
      icicleRing(tw, 1.7, 6.4, 12, 0.6, k);
      for (let j = 0; j < 6; j++) {
        const q = (j / 6) * Math.PI * 2 + Math.PI / 6;
        if (j === 1 || j === 2) continue; // (the inner side stays open to the rampart walk)
        tw.add(iceBlock(Math.cos(q) * 1.45, 6.7, Math.sin(q) * 1.45, 0.62, -q));
      }
      tw.add(crystal(0.34, 3.2, 'pale', 6).translateX(-1.2).translateY(6.7));
      tw.add(crystal(0.16, 1.6, 'glow', 5).translateX(-1.25).translateY(6.7).translateZ(0.5));
      const w = box(0.3, 0.7, 0.1, C.window, 1.42, 3.2, 0);
      w.rotation.y = Math.PI / 2;
      w.userData.window = true;
      tw.add(w);
      tw.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      tw.rotation.y = -a;
      g.add(tw);
    }
  }
}

/** A stretch of the stone wall, the court's way: snow along its coping, icicles hanging down its outer face, crystals of ice
 *  grown on its merlons, frost banners hung outside and sheets of rime glazing its foot. (Local -z faces out.) */
export function frostWallDress(seg: THREE.Group, len: number, h: number, thick: number, i: number, merlons: number): void {
  seg.add(box(len, 0.12, thick + 0.28, SNOWW, 0, h + 0.3, 0));
  icicles(seg, -len / 2 + 0.2, h, -thick / 2 - 0.13, len / 2 - 0.2, -thick / 2 - 0.13, Math.max(3, merlons + 2), 0.75, i);
  if (i % 2 === 0) {
    const x = -len / 2 + 0.5 * (len / merlons);
    seg.add(crystal(0.12, 0.8 + (i % 3) * 0.2, i % 4 ? 'pale' : 'mid', 5).translateX(x).translateY(h + 1.0).translateZ(-thick / 2 + 0.1));
  }
  if (i % 4 === 1) {
    const c = frostCloth(0.95, h * 0.62);
    c.position.set(0, h + 0.05, -thick / 2 - 0.08);
    c.rotation.y = Math.PI;
    seg.add(c);
  }
  if (i % 3 === 2) seg.add(mesh(new THREE.BoxGeometry(len * 0.6, h * 0.45, 0.08).translate(0, h * 0.225, 0), ICE, { emissive: ICE_E }).translateX((i % 2) * 0.4 - 0.2).translateZ(-thick / 2 - 0.05));
}

/** The gatehouse's crown: an arch of ice crystals fanning out over the gate, icicles from its lintel, the snowflake (crowned,
 *  once the wall is at its greatest) at its point. It takes the place of the golden crest; the ruler's banners stand clear. */
export function frostGate(g: THREE.Group, R: number, h: number, thick: number, level: number): void {
  const z = R + thick / 2 + 0.45, cy = h + 2.4, AR = 3.9;
  g.add(mesh(new THREE.TorusGeometry(AR, 0.3, 5, 22, Math.PI), ICE_MID, { emissive: ICE_MID_E }).translateY(cy).translateZ(z));
  const n = 11;
  for (let k = 0; k < n; k++) {
    const f = 0.12 + (k / (n - 1)) * 0.76;
    const phi = f * Math.PI;
    const mid = 1 - Math.abs(f - 0.5) * 2;
    const c = crystal(0.17 + mid * 0.1, 0.9 + mid * 1.4, k % 3 === 1 ? 'deep' : k === 5 ? 'glow' : 'pale', 5);
    c.position.set(Math.cos(phi) * AR, cy + Math.sin(phi) * AR, z);
    c.rotation.z = phi - Math.PI / 2;
    g.add(c);
  }
  icicles(g, -5.8, h + 0.2, R + thick / 2 + 0.32, 5.8, R + thick / 2 + 0.32, 16, 0.9, 4);
  const top = level >= 20;
  const f = snowflake(top ? 1.45 : 1.1, SILVER);
  f.position.set(0, cy + AR * 0.52, z + 0.15);
  g.add(f);
  g.add(glow(new THREE.OctahedronGeometry(top ? 0.3 : 0.22, 0)).translateY(cy + AR * 0.52).translateZ(z + 0.25));
  if (top) {
    const cr = iceCrown(0.7, 1.3);
    cr.position.set(0, cy + AR + 0.2, z);
    g.add(cr);
  }
}

// ---------- landmarks, lamps and the land round the court ----------

let landmarkCount = 0;

/** An ice sculpture of a snow wolf: the wolf's shape carved in clear ice on a plinth of white stone. */
function iceWolf(): THREE.Group {
  const g = new THREE.Group();
  const w = snowWolf();
  const icy = mat(ICE, { emissive: ICE_E }), mid = mat(ICE_MID, { emissive: ICE_MID_E });
  let k = 0;
  w.traverse((o) => { if (o instanceof THREE.Mesh && !(o.material as THREE.Material).userData.noShadow) o.material = k++ % 3 ? icy : mid; });
  g.add(w);
  return g;
}

/**
 * A landmark of the court for the open spots inside the walls: an ice sculpture of a snow wolf, a birch snag where the snow
 * owls roost under a lantern, a monument of crystal over a snowflake carved in stone, the queen carved small in ice, or a
 * frozen fountain.
 */
export function frostLandmark(r: () => number): THREE.Group {
  const g = new THREE.Group();
  const k = landmarkCount++ % 5;
  if (k === 0) {
    g.add(box(2.4, 0.6, 1.2, C.stone), box(2.5, 0.12, 1.3, SNOWW, 0, 0.6, 0));
    const w = iceWolf();
    w.position.set(-0.2, 0.7, 0);
    w.scale.setScalar(0.85);
    g.add(w);
  } else if (k === 1) {
    g.add(birchPole(0.18, 3.4));
    for (const [a, y, l] of [[0.4, 2.2, 1.1], [2.6, 2.8, 0.9], [4.4, 1.7, 0.8]] as [number, number, number][]) {
      g.add(limb(V(0, y, 0), V(Math.cos(a) * l, y + 0.5, Math.sin(a) * l), 0.07, 0.04, BIRCH, 4));
      const ow = perchedOwl(0.9);
      ow.position.set(Math.cos(a) * l * 0.8, y + 0.4, Math.sin(a) * l * 0.8);
      ow.rotation.y = r() * 6;
      g.add(ow);
    }
    g.add(blob(0.8, SNOWW, 0, 0, 0, 1.3, 0.35, 1.3));
    const l = iceLantern(2.0);
    l.position.set(0.9, 0, 0.6);
    g.add(l);
  } else if (k === 2) {
    g.add(cyl(1.2, 1.35, 0.5, C.stoneDark, 8), cyl(0.95, 1.05, 0.5, C.stone, 8, 0, 0.5));
    const sf = snowflake(0.9, SILVER);
    sf.rotation.x = -Math.PI / 2;
    sf.position.set(0, 1.03, 0);
    g.add(sf);
    g.add(crystalCluster(0.8, r, 6, 1.35, 2).translateY(1.0));
  } else if (k === 3) {
    g.add(cyl(0.9, 1.05, 0.9, C.stone, 8), cyl(1.0, 0.95, 0.16, C.stoneLight, 8, 0, 0.9));
    const q = queenStatue();
    q.position.y = 1.05;
    q.scale.setScalar(0.85);
    g.add(q);
  } else {
    g.add(frozenFountain(0.95));
  }
  return g;
}

/** A street lamp of the court: a lantern of ice on its silver post. */
export function frostLamp(): THREE.Group {
  return iceLantern(2.7);
}

/** A skater gliding over the ice: leaning into the stride, arms out, silver blades under the boots. */
function skater(i: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  frostFolk(body, i * 3);
  for (const s of [-1, 1]) {
    const arm = box(0.1, 0.55, 0.1, FOLK_COATS[i % FOLK_COATS.length], s * 0.3, 0.78, 0);
    arm.rotation.z = s * 1.1;
    body.add(arm);
  }
  body.rotation.x = 0.28;
  g.add(body);
  for (const x of [-0.09, 0.09]) g.add(box(0.04, 0.04, 0.46, SILVER, x, 0, 0.02));
  g.scale.setScalar(1.3);
  return g;
}

/**
 * A curtain of aurora hanging in the northern sky over the court: a long ribbon that ripples and folds slowly, green at its
 * lower edge fading to ice-blue and violet as it climbs. Shown at night only.
 */
function auroraRibbon(len: number, hgt: number, low: number, high: number, phase: number): THREE.Mesh {
  const u = { uTime: { value: 0 }, uLow: { value: new THREE.Color(low) }, uHigh: { value: new THREE.Color(high) }, uPh: { value: phase } };
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    uniforms: u,
    vertexShader: `uniform float uTime; uniform float uPh; varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin(p.x * 0.045 + uTime * 0.22 + uPh) * 5.0 + sin(p.x * 0.11 - uTime * 0.37 + uPh) * 1.8;
        p.y += sin(p.x * 0.06 + uTime * 0.3 + uPh * 2.0) * 1.4;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform float uTime; uniform float uPh; uniform vec3 uLow; uniform vec3 uHigh; varying vec2 vUv;
      void main() {
        float y = vUv.y;
        float fade = smoothstep(0.0, 0.16, y) * (1.0 - smoothstep(0.28, 1.0, y));
        float rays = 0.5 + 0.5 * sin(vUv.x * 130.0 + uTime * 0.6 + uPh + sin(vUv.x * 19.0 + uTime * 0.17) * 4.0);
        float ends = smoothstep(0.0, 0.16, vUv.x) * (1.0 - smoothstep(0.84, 1.0, vUv.x));
        float breathe = 0.75 + 0.25 * sin(uTime * 0.35 + uPh);
        gl_FragColor = vec4(mix(uLow, uHigh, y), fade * rays * ends * breathe * 0.3);
      }`,
  });
  const mm = new THREE.Mesh(new THREE.PlaneGeometry(len, hgt, 72, 1).translate(0, hgt / 2, 0), m);
  mm.onBeforeRender = () => { u.uTime.value = performance.now() / 1000; };
  mm.userData.dynamic = true;
  mm.userData.nightOnly = true;
  mm.renderOrder = 7;
  mm.frustumCulled = false;
  return mm;
}

interface FrostGround {
  at: (x: number, z: number) => number;
  free: (x: number, z: number) => boolean;
  motes: (g: THREE.Group, r: () => number, n: number, color: number, emissive: number, around: (i: number) => [number, number, number]) => void;
  wallR: number;
}

/**
 * The court's land outside the walls: the frozen pond outside the gate where the court skates (skaters gliding round it, a
 * warming hut, benches of ice, the queen carved in ice watching over it), lanterns of ice and frost banners down the road,
 * crystals of ice breaking out of the snow, snow owls roosting on dead birches, reindeer grazing, a sledge left in a drift,
 * an ice wolf or two, cairns with a snowflake glowing in them; glints of frost adrift in the air, and at night the aurora.
 */
export function addFrosthold(g: THREE.Group, r: () => number, k: FrostGround): void {
  const { at } = k;
  const cx = 21, cz = 57.5;
  const y0 = at(cx, cz);
  // the frozen pond
  g.add(mesh(new THREE.CylinderGeometry(6.0, 6.0, 0.12, 30), 0xaed6f0, { emissive: 0x123c5c }).translateX(cx).translateY(y0 + 0.04).translateZ(cz));
  g.add(mesh(new THREE.TorusGeometry(6.2, 0.5, 4, 30).rotateX(Math.PI / 2), SNOWW).translateX(cx).translateY(y0 + 0.08).translateZ(cz));
  for (let i = 0; i < 6; i++) {
    const cr = box(1.5 + r() * 2.0, 0.02, 0.05, 0x8fb8d8, cx + (r() - 0.5) * 6, y0 + 0.16, cz + (r() - 0.5) * 6);
    cr.rotation.y = r() * Math.PI;
    g.add(cr);
  }
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2;
    g.add(cone(0.05, 0.7 + r() * 0.5, 0xc9a55a, 4, cx + Math.cos(a) * 6.4, y0, cz + Math.sin(a) * 6.4));
  }
  const ring = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const rr = 3.2 + (i % 2) * 1.3;
    const s = skater(i);
    s.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    s.rotation.y = Math.atan2(Math.sin(a), -Math.cos(a));
    ring.add(s);
  }
  const skaters = moving(ring, { orbit: 0.22 });
  skaters.position.set(cx, y0 + 0.1, cz);
  g.add(skaters);
  // the queen in ice watching over the pond, benches, lanterns and a warming hut
  const qx = cx + 8.6, qz = cz - 4.5;
  g.add(cyl(1.0, 1.15, 1.0, C.stone, 8, qx, at(qx, qz) - 0.1, qz));
  const q = queenStatue();
  q.position.set(qx, at(qx, qz) + 0.9, qz);
  q.rotation.y = -2.2;
  g.add(q);
  for (const [bx, bz, ry] of [[cx - 7.4, cz + 2.0, 1.4], [cx + 3.0, cz + 7.2, 0.1]] as [number, number, number][]) {
    const b = iceBench(1.8);
    b.position.set(bx, at(bx, bz), bz);
    b.rotation.y = ry;
    g.add(b);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.9;
    const lx = cx + Math.cos(a) * 7.6, lz = cz + Math.sin(a) * 7.6;
    const l = iceLantern(2.3);
    l.position.set(lx, at(lx, lz), lz);
    l.rotation.y = -a;
    g.add(l);
  }
  const hx = cx - 3.5, hz = cz - 9.0;
  const hut = birchCabin(3.6, 3.0, 2.2);
  hut.position.set(hx, at(hx, hz) - 0.1, hz);
  hut.rotation.y = 0.35;
  g.add(hut);
  const hh = hearth(0.8, false);
  hh.position.set(hx + 2.6, at(hx + 2.6, hz + 1.8), hz + 1.8);
  g.add(hh);
  // lanterns of ice and frost banners down the road out of the gate
  [51, 60, 69, 78].forEach((z, i) => {
    for (const x of [-3.9, 3.9]) {
      if ((i + (x > 0 ? 1 : 0)) % 2 === 0) {
        const l = iceLantern(2.8);
        l.position.set(x, at(x, z), z);
        l.rotation.y = x < 0 ? 0 : Math.PI;
        g.add(l);
      } else {
        const st = frostStandard(FROST_BLUE, 4.6, false);
        st.position.set(x, at(x, z), z);
        st.rotation.y = x < 0 ? -0.35 : 0.35;
        g.add(st);
      }
    }
  });
  // the snowfields
  let placed = 0;
  for (let tries = 0; tries < 1000 && placed < 60; tries++) {
    const a = r() * Math.PI * 2, d = k.wallR + 7 + r() * 76;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!k.free(x, z)) continue;
    if (Math.hypot(x - cx, z - cz) < 13) continue;
    const y = at(x, z);
    const kind = placed % 8;
    if (kind === 0 || kind === 4) {
      const c = crystalCluster(0.7 + r() * 0.6, r, 4 + Math.floor(r() * 3), 1 + r() * 0.4, 1);
      c.position.set(x, y - 0.1, z);
      g.add(c, drift(x + 0.6, z + 0.4, 0.7, r() * 3).translateY(y));
    } else if (kind === 1) {
      const sn = new THREE.Group();
      sn.add(birchPole(0.15, 2.8));
      sn.add(limb(V(0, 2.0, 0), V(0.8, 2.6, 0.2), 0.06, 0.03, BIRCH, 4));
      const ow = perchedOwl(0.85);
      ow.position.set(0.66, 2.48, 0.16);
      sn.add(ow);
      sn.position.set(x, y - 0.05, z);
      sn.rotation.y = r() * 6;
      g.add(sn);
    } else if (kind === 2) {
      const n = 1 + Math.floor(r() * 3);
      for (let j = 0; j < n; j++) {
        const rd = reindeer(j % 2 ? 0x8a735a : 0x9d8a70);
        rd.scale.setScalar(0.75);
        const rx = x + (r() - 0.5) * 3, rz = z + (r() - 0.5) * 3;
        rd.position.set(rx, at(rx, rz) - 0.05, rz);
        rd.rotation.y = r() * 6;
        g.add(rd);
      }
    } else if (kind === 3) {
      g.add(blob(0.9 + r() * 0.5, 0x9fb0c2, x, y + 0.3, z, 1.2, 0.8, 1.1));
      g.add(blob(0.8, SNOWW, x, y + 0.9, z, 1.2, 0.35, 1.1));
      icicles(g, x - 0.8, y + 0.7, z + 0.9, x + 0.8, z + 0.9, 5, 0.5, placed);
    } else if (kind === 5 && placed % 16 === 5) {
      const w = iceWolf();
      w.position.set(x, y + 0.5, z);
      w.rotation.y = r() * 6;
      g.add(w, box(2.2, 0.6, 1.0, C.stone, x, y - 0.1, z).rotateY(w.rotation.y));
    } else if (kind === 6 && placed % 16 === 6) {
      const sl = sledge(2.1, 'furs');
      sl.position.set(x, y, z);
      sl.rotation.y = r() * 6;
      g.add(sl, drift(x + 0.8, z, 0.8, r()).translateY(y));
    } else if (kind === 7) {
      // a cairn of snow-capped stones, a snowflake glowing in the top one
      for (let j = 0; j < 3; j++) g.add(blob(0.5 - j * 0.12, C.stoneDark, x, y + 0.2 + j * 0.42, z, 1.2, 0.7, 1.1));
      g.add(blob(0.24, SNOWW, x, y + 1.18, z, 1.2, 0.5, 1.1));
      g.add(glow(new THREE.OctahedronGeometry(0.14, 0)).translateX(x).translateY(y + 0.92).translateZ(z + 0.28));
    } else {
      g.add(drift(x, z, 0.8 + r() * 0.8, r() * 3).translateY(y));
    }
    placed++;
  }
  // glints of frost adrift over the court
  k.motes(g, r, 26, GLOW, GLOW_E, () => {
    const a = r() * Math.PI * 2, d = 8 + r() * 78;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    return [x, (Math.hypot(x, z) > k.wallR ? at(x, z) : 0) + 1.2 + r() * 4, z];
  });
  // the aurora, in the northern sky over the court
  for (const [x, y, z, len, low, high, ph, ry] of [
    [-6, 23, -30, 170, 0x4dffb0, 0x6a8cff, 0, 0.06],
    [10, 31, -40, 150, 0x5af0d8, 0x9a7aff, 2.1, -0.08],
    [-20, 18, -22, 110, 0x7dffa0, 0x5ab8ff, 4.2, 0.18],
  ] as [number, number, number, number, number, number, number, number][]) {
    const rb = auroraRibbon(len, 15, low, high, ph);
    rb.position.set(x, y, z);
    rb.rotation.y = ry;
    g.add(rb);
  }
  void getSeason;
}

// ---------- the Frost Queen at home ----------

export interface FrostAura { group: THREE.Group; step(dt: number, t: number): void; dispose(): void }

/**
 * While the Frost Queen is at home, rime seals her walls: crystals of ice grow thick along their outer foot; a ring of frost
 * glitters on the ground about her statue, and snowflakes spiral slowly up and round it.
 */
export function frostAura(r: () => number, wallLevel: number, statue: [number, number, number], wallR: number): FrostAura {
  const g = new THREE.Group();
  const tier = wallLevel <= 0 ? 0 : wallLevel < 5 ? 1 : wallLevel < 10 ? 2 : wallLevel < 15 ? 3 : 4;
  const h = tier === 0 ? 1.2 : tier === 1 ? 2.4 : tier === 2 ? 3.2 : 4.2;
  const R = wallR + (tier >= 3 ? 1.35 : 0.85);
  const start = Math.PI / 2 + 0.15, end = Math.PI / 2 + Math.PI * 2 - 0.15;
  const rime = new THREE.Group();
  for (let a = start; a < end; a += 0.05 + r() * 0.03) {
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const c = crystal(0.12 + r() * 0.1, h * (0.35 + r() * 0.5), r() < 0.2 ? 'mid' : 'pale', 5);
      const rr = R + (r() - 0.3) * 0.7, aa = a + (r() - 0.5) * 0.03;
      c.position.set(Math.cos(aa) * rr, -0.05, Math.sin(aa) * rr);
      leanOut(c, aa + (r() - 0.5) * 1.2, 0.35 + r() * 0.3);
      rime.add(c);
    }
  }
  g.add(bakeAll(rime));
  const [sx, , sz] = [statue[0], 0, statue[1]];
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.6, 48).rotateX(-Math.PI / 2), ringMat);
  ring.position.set(sx, 0.07, sz);
  g.add(ring);
  const flakes: { m: THREE.Mesh; a: number; rad: number; y: number; v: number }[] = [];
  const fm = new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), fm);
    flakes.push({ m, a: r() * Math.PI * 2, rad: 1.8 + r() * 2.2, y: r() * 9, v: 0.5 + r() * 0.7 });
    g.add(m);
  }
  return {
    group: g,
    step(dt, t) {
      ringMat.opacity = 0.2 + 0.12 * Math.sin(t * 0.9);
      for (const f of flakes) {
        f.y += f.v * dt;
        f.a += dt * 0.6;
        if (f.y > 9.5) f.y = 0.3;
        f.m.position.set(sx + Math.cos(f.a) * f.rad, f.y, sz + Math.sin(f.a) * f.rad);
        f.m.rotation.y = t * 2 + f.a;
        f.m.scale.setScalar(0.6 + 0.6 * Math.sin(Math.PI * (f.y / 9.5)));
      }
    },
    dispose() {
      g.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      ringMat.dispose();
      fm.dispose();
    },
  };
}

/** Bake a pile of small parts into one mesh per material (for the aura's rime). */
function bakeAll(parts: THREE.Group): THREE.Group {
  return swarm(parts, {});
}

// ---------- a visiting army's tent, and the finishing touches ----------

/** A tent of the court: a round yurt of white felt and fur, a frost-blue band, a snowy roof, a crystal at its crown, a
 *  lantern of ice by the fur-hung door. */
export function frostTent(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(1.3, 1.35, 1.2, FUR_W, 10));
  g.add(cyl(1.37, 1.37, 0.2, FROST_BLUE, 10, 0, 0.8));
  g.add(cone(1.55, 1.1, 0xa8c8e4, 10, 0, 1.2));
  g.add(cone(1.1, 0.7, SNOWW, 10, 0, 1.55));
  g.add(crystal(0.1, 0.6, 'glow', 5).translateY(2.2));
  g.add(box(0.62, 0.95, 0.1, VOID, 0, 0, 1.3), box(0.3, 0.95, 0.08, FUR_B, 0.3, 0, 1.34).rotateY(0.3));
  g.add(cyl(0.03, 0.03, 1.2, SILVER_DK, 4, 0.8, 0, 1.4));
  g.add(glow(new THREE.OctahedronGeometry(0.14, 0)).translateX(0.8).translateY(1.3).translateZ(1.4));
  const pen = box(0.5, 0.32, 0.04, FROST_BLUE, 0.28, 2.2, 0);
  pen.userData.flag = true;
  g.add(pen, cyl(0.025, 0.025, 0.9, SILVER, 4, 0, 1.9));
  return g;
}

/** A standard for a building at its highest level: a silver pole, a crystal of ice glowing on its top, a frost pennant. */
export function frostMasteryStandard(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.06, 0.08, h, SILVER, 5));
  g.add(cyl(0.16, 0.12, 0.2, SILVER_DK, 6, 0, h - 0.05));
  g.add(crystal(0.14, 0.7, 'glow', 5).translateY(h + 0.12));
  const p = box(0.62, 0.9, 0.04, FROST_BLUE, 0.35, h - 1.15, 0);
  p.userData.flag = true;
  g.add(p);
  g.add(box(0.62, 0.1, 0.06, FUR_W, 0.35, h - 0.3, 0));
  return g;
}

/** Over a building at its highest level: a little crown of ice turning slowly. */
export function frostMasteryCrown(s: number): THREE.Group {
  const parts = new THREE.Group();
  parts.add(mesh(new THREE.TorusGeometry(0.5 * s, 0.06 * s, 4, 16).rotateX(Math.PI / 2), SILVER));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const c = crystal(0.08 * s, (i % 2 ? 0.45 : 0.7) * s, i % 2 ? 'pale' : 'glow', 5);
    c.position.set(Math.cos(a) * 0.5 * s, 0, Math.sin(a) * 0.5 * s);
    leanOut(c, a, 0.25);
    parts.add(c);
  }
  const g = swarm(parts, { orbit: 0.5, bob: 0.12 * s });
  g.position.y = 0.3 * s;
  const out = new THREE.Group();
  out.add(g);
  return out;
}

// ---------- in battle ----------

/** The court's ram in battle: crystals along its roof, icicles from its eaves (added to the frame). */
export function frostRamDress(frame: THREE.Group): void {
  for (let i = 0; i < 5; i++) {
    const c = crystal(0.1, 0.5 + (i % 2) * 0.3, i % 2 ? 'mid' : 'pale', 5);
    c.position.set(-0.6 + i * 0.3, 2.56, -1.2 + i * 0.6);
    frame.add(c);
  }
  for (const x of [-0.95, 0.95]) icicles(frame, x, 2.1, -1.6, x, 1.6, 8, 0.4, x * 3);
}

/** The ram's head: a great point of ice (along +z, at the log's front). */
export function frostRamHead(): THREE.Group {
  const g = new THREE.Group();
  const c = crystal(0.4, 1.2, 'mid', 6);
  c.rotation.x = Math.PI / 2;
  g.add(c);
  for (const s of [-1, 1]) {
    const k = crystal(0.12, 0.6, 'pale', 5);
    k.rotation.set(Math.PI / 2 - 0.3, 0, s * 0.5);
    k.position.set(s * 0.15, 0.12, 0.2);
    g.add(k);
  }
  return g;
}

/** A frost trebuchet's shot: a boulder of blue ice bristling with crystals. */
export function iceShot(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.IcosahedronGeometry(0.42, 0), ICE_MID, { emissive: ICE_MID_E }));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const c = crystal(0.09, 0.4, i % 2 ? 'pale' : 'glow', 4);
    c.position.set(Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3);
    leanOut(c, a, 1.2);
    g.add(c);
  }
  return g;
}

/**
 * Rime on the wall where the rams strike: a sheet of ice glazing the wall's face, crystals bristling out of it. Built at
 * the origin facing +z (the enemy's side), its foot on the ground; the theatre grows it and melts it away.
 */
export function rimeGlaze(len: number, h: number): { g: THREE.Group; mats: THREE.Material[] } {
  const g = new THREE.Group();
  const sheet = new THREE.MeshLambertMaterial({ color: 0xd8f4ff, emissive: 0x2a74a8, transparent: true, opacity: 0.84, flatShading: true });
  const shard = new THREE.MeshLambertMaterial({ color: 0xe6faff, emissive: 0x3a9ad8, flatShading: true });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(len, h + 0.4, 0.22).translate(0, (h + 0.4) / 2, 0), sheet);
  g.add(plate);
  // a crust of frost along its top, where the ice has run over the parapet
  g.add(new THREE.Mesh(new THREE.BoxGeometry(len * 0.96, 0.3, 0.5).translate(0, h + 0.3, -0.1), shard));
  for (let i = 0; i < 22; i++) {
    const x = (jit(i, 3) - 0.5) * len * 0.95, y = 0.2 + jit(i, 7) * h * 0.95;
    const c = new THREE.Mesh(crystalGeo(0.14 + jit(i, 9) * 0.12, 0.6 + jit(i, 11) * 1.0, 5), shard);
    c.position.set(x, y, 0.1);
    c.rotation.set(Math.PI / 2 - 0.3 + jit(i, 13) * 0.6, 0, (jit(i, 15) - 0.5) * 1.4);
    g.add(c);
  }
  return { g, mats: [sheet, shard] };
}

/** The winter festival in the court: the lights are ice-blue, white and silver, and the star at the top burns cold. */
export const FROST_BULBS = [0x8fe0ff, 0xffffff, 0x6fa8ff, 0xbfeaff, 0x9ff0e0];
export const FROST_STAR = { color: 0xe8fbff, emissive: 0x5ac8ff };

/** The court's small things about the streets, in place of the plain ones: a heap of cut ice blocks, a bale of furs roped
 *  up, a keg of pale birch bound in silver, a birch crate with snow on its lid. */
export function frostProp(kind: 'pumpkin' | 'hay' | 'barrel' | 'crate', x: number, z: number, s = 1): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'pumpkin') {
    g.add(iceBlock(0, 0, 0, 0.5 * s, 0.3), iceBlock(0.42 * s, 0, 0.2 * s, 0.42 * s, 1.1), iceBlock(0.18 * s, 0.4 * s, 0.1 * s, 0.38 * s, 0.7));
  } else if (kind === 'hay') {
    g.add(blob(0.9 * s, FUR_W, 0, 0.5 * s, 0, 1.2, 0.7, 1.0));
    g.add(box(0.09, 0.09, 1.9 * s, FUR_DK, 0, 0.98 * s, 0), box(2.1 * s, 0.09, 0.09, FUR_DK, 0, 0.98 * s, 0));
  } else if (kind === 'barrel') {
    g.add(cyl(0.38 * s, 0.34 * s, 0.9 * s, PALE_WD, 8));
    for (const y of [0.2, 0.65]) g.add(cyl(0.4 * s, 0.4 * s, 0.08, SILVER, 8, 0, y * s));
    g.add(blob(0.3 * s, SNOWW, 0, 0.92 * s, 0, 1.1, 0.35, 1.1));
  } else {
    g.add(box(0.8 * s, 0.78 * s, 0.8 * s, PALE_WD), box(0.84 * s, 0.1 * s, 0.84 * s, PALE_WD_DK, 0, 0.7 * s, 0));
    g.add(box(0.76 * s, 0.1 * s, 0.76 * s, SNOWW, 0, 0.8 * s, 0));
  }
  g.position.set(x, 0, z);
  return g;
}
