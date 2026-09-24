// The Temple-City: the Saurian King's own buildings and pieces, grown out of the southern
// jungle. The king's seat rises from a thatched hut on stilts beside a carved totem, to a
// longhouse on stilts by a serpent post, to a stepped pyramid with a shrine on top, a great
// pyramid whose stairs are flanked by feathered serpents with braziers burning at its summit,
// and at last a colossal pyramid crowned by a golden sun-disc, a waterfall pouring from its
// terrace and winged lizards wheeling round it. Around it: stone plazas where the saurus
// drill, raptor pens of lashed bamboo, a stilt market over a river of canoes, terraced
// fields of maize, an obsidian quarry, and giant stone heads half swallowed by the vines.
//
// The style is its own: weathered grey-green stone laid in steps, jade that glows at night,
// gold sun-discs, red-ochre friezes, feathers in red, gold and turquoise, palm thatch and
// lashed bamboo. Everything that stands still is baked with its building (one mesh per
// material); the moving parts are a few live flames, banners, sun-discs, the flyers and
// merged swarms of fireflies.
//
// (Nothing here runs when the module loads: it only defines things, so it can be imported
// from anywhere in the three/ folder without caring about import order.)

import * as THREE from 'three';
import type { BuildingId } from '../../engine/types';
import type { Built } from './buildings';
import type { Aura } from './heroAura';
import { C, bake, blob, box, cone, cyl, darker, detailMat, extrude, getSeason, leafCluster, limb, mesh, rng, swarm, type LeafPal } from './kit';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------- the temple-city's colours (none is a palette key, so no season or theme repaints them) ----------

/** Weathered temple stone: grey-green limestone, its shaded courses, and fresh-cut trim. */
export const ST = 0x9d9f88, ST_DK = 0x777b67, ST_LT = 0xbcbba2, ST_OLD = 0x878b73;
/** Red-ochre and turquoise paint on the friezes. */
export const PAINT = 0xb2452c, PAINT_TQ = 0x2b9a92;
/** Gold (sun-discs, the king's armour) and jade (inlays that glow at night). */
export const GOLD = 0xe3ae3a, GOLD_DK = 0xe3ae3a, GOLD_E = 0x7a5210;
export const JADE = 0x4ccf9c, JADE_E = 0x0f7048, JADE_DK = 0x2f8a68;
/** Obsidian: black volcanic glass for blades and the quarry. */
export const OBSID = 0x24212c, OBSID_LT = 0x24212c;
/** Palm thatch (dry and golden, and its shaded underside), fresh fronds, bamboo, timber and rope. */
export const THATCH = 0xb89e56, THATCH_DK = 0x8c7542, FROND = 0x5e9636, FROND_DK = 0x3f7228;
export const BAMBOO = 0xc4b068, BAMBOO_DK = 0x8c7542, WOOD = 0x5e4730, WOOD_DK = 0x3e2e1e, ROPE_T = 0xa8905f, WATTLE = 0xb49a66;
/** Feathers. */
export const F_RED = 0xd8452c, F_YEL = 0xf2c232, F_TQ = 0x2ab8ae, F_BLU = 0x2c5cb8, F_GRN = 0x3fae5a;
/** Hide drum tops, red earth, a dark doorway, foam and a waterfall's light. */
const HIDE_T = 0xb89e56, EARTH = 0xa8522f, EARTH_DK = 0x7e3c24, DOORWAY = 0x1a1612, FOAM = 0xe6f6f0, FALL = 0xa6ecec, FALL_E = 0x1e6a6a;
const FLAME = 0xffa040, FLAME_E = 0xc05010, COAL = 0xff8a3a, COAL_E = 0xb8420c;
/** Vines, and moss on the old stone. */
const VINE = 0x3f7228, VLEAF = 0x5e9636, VLEAF_DK = 0x3f7228;
const MOSS: LeafPal = { top: 0x5e9636, mid: 0x3f7228, under: 0x2f5a22 };
/** Lizard skins: the little bright skinks, and the big blue-green saurus. */
export const SKINKS = [0x3faa5a, 0x2a9ab8, 0xe0a83a, 0xd8663a, FROND, 0x3fb8a0];
export const SAURUS = 0x3f7c78, SAURUS_DK = 0x2b5956, BELLY = 0xcfc58e, CLAW = 0xe8dfc4;

// ---------- small shared pieces ----------

/** A small bright thing that glows and casts no shadow (jade inlay, coals, eyes). */
function glow(geo: THREE.BufferGeometry, c = JADE, e = JADE_E): THREE.Mesh {
  return new THREE.Mesh(geo, detailMat(c, { emissive: e }));
}

/** Merge a moving part's pieces into one mesh per material (it moves as one, so it may as well draw as one). */
function settle<T extends THREE.Object3D>(dyn: T): T {
  const inner = new THREE.Group();
  for (const c of [...dyn.children]) inner.add(c);
  const b = bake(inner);
  for (const c of [...b.children]) dyn.add(c);
  return dyn;
}

/**
 * Merge a figure's body (everything within reach of its middle) into one mesh per material, leaving what it
 * holds out in its right hand (x > 0.25) loose, so a battle can still swing it.
 */
function compact<T extends THREE.Object3D>(g: T): T {
  const body = new THREE.Group();
  for (const c of [...g.children]) if (c.position.x <= 0.25 && !c.userData.dynamic) body.add(c);
  const b = bake(body);
  for (const c of [...b.children]) g.add(c);
  return g;
}

/** Colours used only for small or flush details: their meshes need cast no shadow (a shadow pass fewer per building). */
let quieted = false;
function quietDetails(): void {
  if (quieted) return;
  quieted = true;
  for (const c of [PAINT, PAINT_TQ, GOLD, F_RED, F_YEL, F_TQ, DOORWAY, ROPE_T, CLAW, FOAM, 0xa8603a]) detailMat(c);
}

/** A little bit that casts no shadow (leaves, flowers, feathers on the small things). */
function bit(geo: THREE.BufferGeometry, c: number): THREE.Mesh {
  return new THREE.Mesh(geo, detailMat(c));
}

/** A flame that flickers (kept apart from the bake so it can move). */
function flame(s = 1): THREE.Group {
  const f = new THREE.Group();
  f.add(glow(new THREE.ConeGeometry(0.32 * s, 0.9 * s, 6).translate(0, 0.45 * s, 0), FLAME, FLAME_E));
  f.add(glow(new THREE.ConeGeometry(0.17 * s, 0.58 * s, 5).translate(0, 0.29 * s, 0), 0xffd070, 0xd08a20));
  f.userData.dynamic = true;
  f.userData.fire = true;
  return f;
}

/** A still flame (for the small or far-off fires that need not move). */
function stillFlame(s = 1): THREE.Mesh {
  return glow(new THREE.ConeGeometry(0.26 * s, 0.7 * s, 5).translate(0, 0.35 * s, 0), FLAME, FLAME_E);
}

/** A feather: a long diamond, its quill at the origin, pointing up (+y), flat in XY. */
export function feather(len: number, w: number, color: number): THREE.Mesh {
  const g = new THREE.OctahedronGeometry(1, 0);
  g.scale(w / 2, len / 2, 0.035).translate(0, len / 2, 0);
  return mesh(g, color);
}

/** A fan of feathers spread in the XY plane (a crest, a headdress, a standard's plume). */
export function featherFan(n: number, len: number, spread: number, colors: number[], w = 0.26): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : i / (n - 1) - 0.5;
    const f = feather(len * (1 - Math.abs(k) * 0.35), w, colors[i % colors.length]);
    f.rotation.z = -k * spread;
    f.position.z = -Math.abs(k) * 0.02;
    g.add(f);
  }
  return g;
}

/** A length of bamboo from a to b, with a node ring or two. */
function bamboo(a: THREE.Vector3, b: THREE.Vector3, r = 0.09, color = BAMBOO): THREE.Group {
  const g = new THREE.Group();
  g.add(limb(a, b, r, r * 0.9, color, 5));
  const d = b.clone().sub(a);
  const n = Math.max(1, Math.floor(d.length() / 1.1));
  for (let i = 1; i <= n; i++) {
    const p = a.clone().addScaledVector(d, i / (n + 1));
    const ring = limb(p.clone().addScaledVector(d.clone().normalize(), -0.03), p.clone().addScaledVector(d.clone().normalize(), 0.03), r * 1.18, r * 1.18, BAMBOO_DK, 5);
    g.add(ring);
  }
  return g;
}

/** An upright bamboo pole standing at (x, z). */
function pole(x: number, z: number, h: number, r = 0.1, y = 0): THREE.Group {
  return bamboo(V(x, y, z), V(x, y + h, z), r);
}

/** A vine hanging down a face: a strand with leaves along it (its top at the origin, hanging down). */
function vine(len: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.05, len, 0.05, VINE, 0, -len, 0));
  const n = Math.max(2, Math.round(len / 0.45));
  for (let i = 0; i < n; i++) {
    const s = 0.1 + ((seed * 7 + i * 3) % 5) * 0.02;
    const leaf = bit(new THREE.OctahedronGeometry(s, 0), (seed + i) % 2 ? VLEAF : VLEAF_DK);
    leaf.scale.set(1.3, 1, 0.5);
    leaf.position.set(((i % 2) - 0.5) * 0.14, -((i + 0.5) / n) * len, 0.04);
    g.add(leaf);
  }
  return g;
}

/** A clump of moss on a ledge. */
function moss(r: number, x: number, y: number, z: number, seed: number, sx = 1.3, sz = 1.1): THREE.Group {
  return leafCluster(r, MOSS, x, y, z, sx, 0.42, sz, 0, seed);
}

/** A woven basket, open at the top, heaped with what it holds. */
function basket(s: number, fill: number | null, x: number, z: number, y = 0): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.34 * s, 0.26 * s, 0.4 * s, BAMBOO, 7));
  g.add(cyl(0.36 * s, 0.36 * s, 0.06 * s, BAMBOO_DK, 7, 0, 0.36 * s));
  if (fill !== null) g.add(blob(0.3 * s, fill, 0, 0.42 * s, 0, 1, 0.45, 1));
  g.position.set(x, y, z);
  return g;
}

/** A tall clay jar with a painted band. */
function jar(s: number, x: number, z: number, y = 0): THREE.Group {
  const g = new THREE.Group();
  g.add(blob(0.3 * s, 0xa8603a, 0, 0.34 * s, 0, 1, 1.15, 1));
  g.add(cyl(0.13 * s, 0.17 * s, 0.22 * s, 0xa8603a, 6, 0, 0.62 * s));
  g.add(cyl(0.31 * s, 0.31 * s, 0.08 * s, DOORWAY, 7, 0, 0.36 * s));
  g.position.set(x, y, z);
  return g;
}

// ---------- carved serpents and suns ----------

/**
 * The head of a feathered serpent carved in stone, facing +z: a blocky skull with a stepped brow and a
 * curling nose-horn, jaws gaping over long fangs, a forked tongue, jade eyes, and a crest of feathers
 * fanning back from its crown (stone, or painted in red, gold and turquoise). Its origin is under the
 * back of its head.
 */
export function serpentHead(s = 1, body = ST, painted = true): THREE.Group {
  const g = new THREE.Group();
  const dk = darker(body, 0.86);
  // the neck, the long skull and the blunt snout
  g.add(box(0.92 * s, 1.0 * s, 0.7 * s, body, 0, 0, -0.2 * s));
  g.add(box(1.0 * s, 0.5 * s, 1.4 * s, body, 0, 0.56 * s, 0.6 * s));
  g.add(box(0.82 * s, 0.42 * s, 0.58 * s, body, 0, 0.6 * s, 1.46 * s));
  // a heavy stepped brow over the eyes, a knob for each nostril, a nose-horn curling up
  g.add(box(1.1 * s, 0.2 * s, 0.56 * s, dk, 0, 1.04 * s, 0.92 * s));
  g.add(box(0.7 * s, 0.16 * s, 0.4 * s, dk, 0, 1.22 * s, 0.7 * s));
  for (const x of [-1, 1]) {
    g.add(box(0.14 * s, 0.1 * s, 0.1 * s, DOORWAY, x * 0.22 * s, 0.98 * s, 1.72 * s));
    // jade eyes, set so they catch the eye from the front and the side
    g.add(glow(new THREE.BoxGeometry(0.24 * s, 0.16 * s, 0.1 * s)).translateX(x * 0.3 * s).translateY(0.92 * s).translateZ(1.32 * s));
    g.add(glow(new THREE.BoxGeometry(0.08 * s, 0.16 * s, 0.34 * s)).translateX(x * 0.5 * s).translateY(0.88 * s).translateZ(1.05 * s));
    // gold ear-spools
    g.add(cyl(0.2 * s, 0.2 * s, 0.1 * s, painted ? GOLD : dk, 8, x * 0.54 * s, 0.7 * s, 0.2 * s).rotateZ(Math.PI / 2));
  }
  const nh = cone(0.13 * s, 0.5 * s, dk, 4, 0, 1.0 * s, 1.62 * s);
  nh.rotation.x = -0.7;
  g.add(nh);
  // the gaping mouth: red within, the lower jaw dropped open, great white fangs, a forked tongue lolling out
  g.add(box(0.78 * s, 0.4 * s, 1.3 * s, painted ? PAINT : DOORWAY, 0, 0.22 * s, 0.8 * s));
  const jaw = box(0.88 * s, 0.22 * s, 1.5 * s, dk, 0, 0, 0);
  jaw.geometry.translate(0, 0, 0.72 * s);
  jaw.position.set(0, 0.24 * s, 0.05 * s);
  jaw.rotation.x = 0.42;
  g.add(jaw);
  for (const x of [-1, 1]) {
    const f = cone(0.1 * s, 0.5 * s, CLAW, 4, x * 0.3 * s, 0.1 * s, 1.6 * s);
    f.rotation.x = Math.PI;
    f.position.y = 0.62 * s;
    g.add(f);
    const lf = cone(0.08 * s, 0.34 * s, CLAW, 4, x * 0.3 * s, -0.36 * s, 1.34 * s);
    lf.rotation.x = -0.35;
    g.add(lf);
  }
  const tongue = box(0.16 * s, 0.06 * s, 0.9 * s, painted ? F_RED : dk, 0, 0, 0);
  tongue.geometry.translate(0, 0, 0.45 * s);
  tongue.position.set(0, 0.24 * s, 1.2 * s);
  tongue.rotation.x = 0.35;
  g.add(tongue);
  // the crest of feathers, standing up and fanned back from its crown
  const cols = painted ? [F_RED, F_YEL, F_TQ, F_RED, F_TQ, F_YEL, F_RED] : [dk];
  const crest = featherFan(7, 1.35 * s, 2.0, cols, 0.32 * s);
  crest.position.set(0, 1.1 * s, 0.1 * s);
  crest.rotation.x = -0.4;
  g.add(crest);
  return g;
}

/**
 * The sun-disc: an eight-sided plate of gold stood on edge (facing +z), a band of turquoise and a jade heart
 * that glows, long pointed rays between short stepped ones (like a pyramid's stair). `glowing` makes the
 * gold itself shine (the great disc).
 */
export function sunDisc(r: number, glowing = false): THREE.Group {
  const g = new THREE.Group();
  const gold = (geo: THREE.BufferGeometry) => (glowing ? glow(geo, 0xffd060, 0x9a6410) : mesh(geo, GOLD));
  g.add(gold(new THREE.CylinderGeometry(r, r, 0.18 * r, 16).rotateX(Math.PI / 2)));
  g.add(mesh(new THREE.CylinderGeometry(r * 0.76, r * 0.76, 0.22 * r, 16).rotateX(Math.PI / 2), PAINT_TQ));
  g.add(gold(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.26 * r, 8).rotateX(Math.PI / 2).rotateZ(Math.PI / 8)));
  g.add(glow(new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.3 * r, 8).rotateX(Math.PI / 2).rotateZ(Math.PI / 8)));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const ray = new THREE.Group();
    if (i % 2 === 0) {
      // a long pointed ray: a flat blade tapering out
      ray.add(gold(new THREE.ConeGeometry(0.2 * r, 0.8 * r, 4).scale(1, 1, 0.35).translate(0, r * 1.36, 0)));
    } else {
      // a short stepped ray
      ray.add(gold(new THREE.BoxGeometry(0.26 * r, 0.2 * r, 0.12 * r).translate(0, r * 1.06, 0)));
      ray.add(gold(new THREE.BoxGeometry(0.12 * r, 0.16 * r, 0.1 * r).translate(0, r * 1.22, 0)));
    }
    ray.rotation.z = a;
    g.add(ray);
  }
  return g;
}

// ---------- fire ----------

/** A stone fire-bowl on a stepped stand, coals glowing in it (and a live flame on the grander ones). */
export function brazier(h: number, live = false, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.9 * s, 0.25 * s, 0.9 * s, ST_DK));
  g.add(box(0.5 * s, h, 0.5 * s, ST, 0, 0.25 * s, 0));
  g.add(box(0.66 * s, 0.14 * s, 0.66 * s, PAINT, 0, 0.25 * s + h * 0.7, 0));
  g.add(cyl(0.62 * s, 0.34 * s, 0.42 * s, ST_LT, 8, 0, 0.25 * s + h));
  g.add(glow(new THREE.CylinderGeometry(0.54 * s, 0.54 * s, 0.08, 8), COAL, COAL_E).translateY(0.25 * s + h + 0.36 * s));
  const top = 0.25 * s + h + 0.4 * s;
  if (live) {
    const f = flame(s);
    f.position.y = top;
    g.add(f);
  } else g.add(stillFlame(s).translateY(top));
  return g;
}

/** A bamboo torch lashed to a post, a clay cup of fire on top; its glow is window-glass so it lights up at night. */
export function bambooTorch(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(pole(0, 0, h, 0.07));
  g.add(cyl(0.12, 0.1, 0.1, ROPE_T, 5, 0, h * 0.55));
  g.add(cyl(0.2, 0.12, 0.24, 0xa8603a, 6, 0, h));
  const glass = box(0.2, 0.28, 0.2, C.window, 0, h + 0.18, 0);
  glass.userData.window = true;
  g.add(glass);
  return g;
}

// ---------- roofs, stilts and houses ----------

/**
 * A roof of palm thatch over a w × d plan: a steep hip of layered fronds (a darker lower course under
 * a golden upper one), a ragged fringe hanging at the eaves, and a knot of fronds at the top.
 */
export function thatchRoof(w: number, d: number, h: number, o: { over?: number; color?: number; fringe?: boolean; knot?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  const over = o.over ?? 0.55, col = o.color ?? THATCH;
  const W = w / 2 + over, D = d / 2 + over;
  const pyr = (hw: number, hd: number, hh: number, c: number, y: number) => {
    const m = mesh(new THREE.ConeGeometry(Math.SQRT2, hh, 4).rotateY(Math.PI / 4).translate(0, hh / 2, 0), c);
    m.scale.set(hw, 1, hd);
    m.position.y = y;
    return m;
  };
  // the lower course, broad and shallow, then the steep upper one set into it
  g.add(pyr(W, D, h * 0.55, THATCH_DK, 0));
  g.add(pyr(W * 0.86, D * 0.86, h, col, h * 0.06));
  // the courses of fronds lapped over one another, as darker lines across the slopes
  for (const f of [0.34, 0.62]) {
    const band = mesh(new THREE.CylinderGeometry(Math.SQRT2 * (1 - f - 0.06) * 1.02, Math.SQRT2 * (1 - f) * 1.02, h * 0.06, 4, 1, true).rotateY(Math.PI / 4).translate(0, h * 0.03, 0), THATCH_DK);
    band.scale.set(W * 0.86, 1, D * 0.86);
    band.position.y = h * 0.06 + f * h;
    g.add(band);
  }
  if (o.fringe !== false) {
    // ragged ends of the fronds hanging down all round the eaves
    const edge = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(2, Math.round(len / 0.7));
      const a = Math.atan2(z1 - z0, x1 - x0);
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n;
        const t = box(0.46, 0.34 + ((i * 7) % 3) * 0.06, 0.07, i % 2 ? THATCH_DK : col, x0 + (x1 - x0) * k, -0.3, z0 + (z1 - z0) * k);
        t.rotation.y = -a;
        g.add(t);
      }
    };
    edge(-W, D, W, D);
    edge(-W, -D, W, -D);
    edge(-W, -D, -W, D);
    edge(W, -D, W, D);
  }
  if (o.knot !== false) {
    g.add(cone(0.36, 0.7, THATCH_DK, 5, 0, h * 1.02));
    g.add(cyl(0.12, 0.12, 0.14, ROPE_T, 5, 0, h * 1.02 + 0.2));
  }
  return g;
}

/** Bamboo stilts under a floor of w × d at height `up`, and the floor itself. */
function stilts(w: number, d: number, up: number): THREE.Group {
  const g = new THREE.Group();
  const nx = Math.max(2, Math.round(w / 2.2) + 1), nz = Math.max(2, Math.round(d / 2.2) + 1);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (i > 0 && i < nx - 1 && j > 0 && j < nz - 1) continue;
    const x = -w / 2 + 0.2 + (i * (w - 0.4)) / (nx - 1), z = -d / 2 + 0.2 + (j * (d - 0.4)) / (nz - 1);
    g.add(pole(x, z, up + 0.05, 0.12));
    g.add(blob(0.2, ST_DK, x, 0.05, z, 1, 0.5, 1));
  }
  // cross-bracing between the front and back legs
  for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) g.add(limb(V(-w / 2 + 0.2, 0.3, z), V(w / 2 - 0.2, up - 0.2, z), 0.05, 0.05, BAMBOO_DK, 4));
  g.add(box(w + 0.3, 0.22, d + 0.3, WOOD, 0, up, 0));
  g.add(box(w + 0.36, 0.08, d + 0.36, BAMBOO_DK, 0, up + 0.22, 0));
  return g;
}

/** A ladder from the ground up to a height, leaning in toward -z (put it in front of a door). */
function ladder(h: number, w = 0.6): THREE.Group {
  const g = new THREE.Group();
  const lean = 0.35;
  for (const x of [-w / 2, w / 2]) g.add(limb(V(x, 0, lean * h * 0.3), V(x, h + 0.3, 0), 0.05, 0.045, BAMBOO, 4));
  for (let y = 0.35; y < h; y += 0.42) g.add(limb(V(-w / 2, y, lean * h * 0.3 * (1 - y / h)), V(w / 2, y, lean * h * 0.3 * (1 - y / h)), 0.035, 0.035, BAMBOO_DK, 4));
  return g;
}

/**
 * A hut on bamboo stilts: a floor of planks, walls of woven cane with slats down the front, a door and a
 * lit window, a veranda rail, a tall palm-thatch roof, and a ladder up to the door. Front faces +z.
 */
export function stiltHut(o: { w: number; d: number; up: number; h: number; roofH: number; windows?: number; veranda?: number; ladderX?: number }): THREE.Group {
  const g = new THREE.Group();
  const { w, d, up, h, roofH } = o;
  const ver = o.veranda ?? 0;
  const fd = d + ver;
  const fl = stilts(w, fd, up);
  fl.position.z = ver / 2;
  g.add(fl);
  const y0 = up + 0.3;
  g.add(box(w, h, d, WATTLE, 0, y0, 0));
  // cane slats down the front and back, a darker band where the walls meet the roof
  const n = Math.max(3, Math.round(w / 0.5));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    if (Math.abs(x) < 0.55) continue;
    g.add(box(0.08, h, 0.06, BAMBOO_DK, x, y0, d / 2 + 0.02));
  }
  g.add(box(w + 0.08, 0.22, d + 0.08, BAMBOO_DK, 0, y0 + h - 0.26, 0));
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) g.add(pole(x, z, h + 0.1, 0.1, y0));
  // the door and the windows
  g.add(box(0.9, Math.min(1.6, h * 0.8), 0.1, DOORWAY, 0, y0, d / 2 + 0.04));
  g.add(box(1.1, 0.12, 0.12, WOOD_DK, 0, y0 + Math.min(1.6, h * 0.8), d / 2 + 0.06));
  const nw = o.windows ?? (w > 4 ? 2 : 1);
  for (let i = 0; i < nw; i++) {
    const x = (i % 2 ? 1 : -1) * Math.min(w / 2 - 0.6, 1.2 + Math.floor(i / 2) * 1.4);
    const win = box(0.46, 0.46, 0.08, C.window, x, y0 + h * 0.45, d / 2 + 0.05);
    win.userData.window = true;
    g.add(win);
  }
  if (ver > 0) {
    // a rail round the veranda
    const vz = d / 2 + ver - 0.1;
    for (const x of [-w / 2 - 0.05, -0.7, 0.7, w / 2 + 0.05]) g.add(pole(x, vz, 0.8, 0.05, up + 0.3));
    for (const s of [-1, 1]) g.add(limb(V(s * 0.7, up + 1.0, vz), V(s * (w / 2 + 0.05), up + 1.0, vz), 0.04, 0.04, BAMBOO, 4));
  }
  const roof = thatchRoof(w, d + ver * 0.6, roofH, { over: 0.6 });
  roof.position.set(0, y0 + h, ver * 0.3);
  g.add(roof);
  const lad = ladder(up + 0.3);
  lad.position.set(o.ladderX ?? 0, 0, d / 2 + ver + 0.45);
  g.add(lad);
  return g;
}

type HouseOpts = { w: number; d: number; h: number; roofH: number; wall?: number; roof?: number; frame?: number | null; door?: boolean; windows?: number; stone?: boolean; chimney?: boolean; over?: number };

/**
 * The temple-city's house: walls of grey-green stone on a stepped plinth, a red-ochre frieze under the
 * eaves with jade set in it, a stone lintel over the door and small lit windows; a steep hip of palm
 * thatch over it all (or, for the stone halls, a flat roof with stepped crenellations and a roof comb).
 */
export function saurianHouse(o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const wall = o.wall ?? (o.stone ? ST : ST_OLD);
  // a stepped plinth
  g.add(box(w + 0.5, 0.35, d + 0.5, ST_DK));
  g.add(box(w + 0.2, 0.25, d + 0.2, ST, 0, 0.35, 0));
  g.add(box(w, h, d, wall, 0, 0.6, 0));
  // courses of block along the walls, the corner stones standing proud
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) g.add(box(0.36, h, 0.36, ST_LT, x, 0.6, z));
  g.add(box(w + 0.06, 0.1, d + 0.06, ST_DK, 0, 0.6 + h * 0.45, 0));
  // the frieze under the eaves: red, with jade inlays along the front
  const fy = 0.6 + h - 0.55;
  g.add(box(w + 0.12, 0.55, d + 0.12, PAINT, 0, fy, 0));
  const nj = Math.max(1, Math.round(w / 1.6));
  for (let i = 0; i < nj; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / nj;
    g.add(glow(new THREE.BoxGeometry(0.22, 0.22, 0.06)).translateX(x).translateY(fy + 0.28).translateZ(d / 2 + 0.08));
    g.add(box(0.1, 0.4, 0.04, GOLD_DK, x + 0.32, fy + 0.08, d / 2 + 0.07));
  }
  const top = 0.6 + h;
  if (o.door !== false) {
    const dw = Math.min(1.2, w * 0.24), dh = Math.min(2.0, h * 0.7);
    g.add(box(dw, dh, 0.12, DOORWAY, 0, 0.6, d / 2 + 0.02));
    g.add(box(dw + 0.5, 0.3, 0.3, ST_LT, 0, 0.6 + dh, d / 2 + 0.06));
    for (const x of [-1, 1]) g.add(box(0.2, dh, 0.22, ST_LT, x * (dw / 2 + 0.1), 0.6, d / 2 + 0.05));
  }
  const nw = o.windows ?? Math.max(0, Math.floor(w / 2.6));
  for (let i = 0; i < nw; i++) {
    const x = -w / 2 + ((i + 1) * w) / (nw + 1);
    if (Math.abs(x) < 1.1 && o.door !== false) continue;
    const win = box(0.46, 0.56, 0.1, C.window, x, 0.6 + h * 0.5, d / 2 + 0.03);
    win.userData.window = true;
    g.add(win);
    g.add(box(0.7, 0.12, 0.16, ST_LT, x, 0.6 + h * 0.5 + 0.56, d / 2 + 0.05));
  }
  if (o.stone) {
    // a flat roof, stepped crenellations along its edge and a pierced roof comb along the ridge
    g.add(box(w + 0.3, 0.3, d + 0.3, ST_LT, 0, top, 0));
    const merl = (x: number, z: number, ry: number) => {
      const m = new THREE.Group();
      m.add(box(0.5, 0.3, 0.3, ST, 0, 0, 0), box(0.26, 0.26, 0.3, ST, 0, 0.3, 0));
      m.position.set(x, top + 0.3, z);
      m.rotation.y = ry;
      g.add(m);
    };
    const nx = Math.max(2, Math.round(w / 1.0)), nz = Math.max(2, Math.round(d / 1.0));
    for (let i = 0; i < nx; i++) for (const z of [-1, 1]) merl(-w / 2 + ((i + 0.5) * w) / nx, z * (d / 2), 0);
    for (let i = 0; i < nz; i++) for (const x of [-1, 1]) merl(x * (w / 2), -d / 2 + ((i + 0.5) * d) / nz, Math.PI / 2);
    const comb = roofComb(Math.min(w * 0.7, 4.2), o.roofH * 0.9);
    comb.position.set(0, top + 0.3, 0);
    g.add(comb);
  } else {
    const roof = thatchRoof(w, d, o.roofH * 1.25, { over: o.over ?? 0.55 });
    roof.position.y = top;
    g.add(roof);
  }
  if (o.chimney) {
    g.add(box(0.7, o.roofH + 1.0, 0.7, ST_DK, w * 0.24, top - 0.5, -d * 0.2));
    g.add(box(0.86, 0.16, 0.86, ST_LT, w * 0.24, top + o.roofH + 0.5, -d * 0.2));
  }
  return g;
}

/** A roof comb: a crest wall of stone standing on a temple's roof, stepped at its top and pierced, painted red. */
function roofComb(w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const t = 0.34;
  g.add(box(w, h * 0.55, t, ST, 0, 0, 0));
  g.add(box(w * 0.7, h * 0.28, t, ST, 0, h * 0.55, 0));
  g.add(box(w * 0.36, h * 0.2, t, ST, 0, h * 0.83, 0));
  // the openings through it, and its red face
  for (const x of [-0.3, 0, 0.3]) g.add(box(w * 0.12, h * 0.3, t + 0.04, DOORWAY, x * w, h * 0.12, 0));
  g.add(box(w + 0.04, 0.12, t + 0.06, PAINT, 0, h * 0.5, 0));
  g.add(box(w * 0.7 + 0.04, 0.12, t + 0.06, PAINT, 0, h * 0.78, 0));
  return g;
}

/**
 * A tower of the temple-city: square and stepped in three stages of stone, each stage set back from the
 * one below, a red band and jade at every step, lit slits, and on top either a thatched lookout (roof) or
 * an open platform with stepped crenellations (roof: null). A long red banner with a sun-disc hangs down
 * its front when it flies one.
 */
export function saurianTower(r: number, h: number, o: { color?: number; roof?: number | null; merlons?: boolean; banner?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  const col = o.color ?? ST;
  const stages = [[1.0, 0.44], [0.86, 0.34], [0.74, 0.22]] as const;
  let y = 0;
  const hw0 = r * 0.95;
  g.add(box(hw0 * 2 + 0.5, 0.4, hw0 * 2 + 0.5, ST_DK));
  stages.forEach(([k, f], i) => {
    const hw = hw0 * k, sh = h * f;
    g.add(box(hw * 2, sh, hw * 2, i === 1 ? ST_OLD : col, 0, y, 0));
    g.add(box(hw * 2 + 0.2, 0.2, hw * 2 + 0.2, ST_LT, 0, y + sh - 0.2, 0));
    if (i < 2) g.add(box(hw * 2 + 0.06, 0.3, hw * 2 + 0.06, PAINT, 0, y + sh - 0.55, 0));
    // a lit slit on each face, and jade at the corners of the band
    if (sh > 1.6) for (let s = 0; s < 4; s++) {
      const a = (s / 4) * Math.PI * 2;
      const sl = box(0.24, Math.min(0.9, sh * 0.35), 0.1, C.window, Math.sin(a) * (hw + 0.01), y + sh * 0.35, Math.cos(a) * (hw + 0.01));
      sl.rotation.y = a;
      sl.userData.window = true;
      g.add(sl);
    }
    if (i < 2) for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(glow(new THREE.BoxGeometry(0.16, 0.16, 0.16)).translateX(x * (hw + 0.04)).translateY(y + sh - 0.4).translateZ(z * (hw + 0.04)));
    y += sh;
  });
  const hwTop = hw0 * 0.74;
  if (o.roof === null) {
    // an open platform with stepped merlons
    g.add(box(hwTop * 2 + 0.4, 0.26, hwTop * 2 + 0.4, ST_LT, 0, y, 0));
    for (let s = 0; s < 4; s++) for (const k of [-0.6, 0, 0.6]) {
      const a = (s / 4) * Math.PI * 2;
      const m = new THREE.Group();
      m.add(box(0.46, 0.34, 0.3, col), box(0.24, 0.26, 0.3, col, 0, 0.34, 0));
      m.position.set(Math.sin(a) * (hwTop + 0.05) + Math.cos(a) * k * hwTop, y + 0.26, Math.cos(a) * (hwTop + 0.05) - Math.sin(a) * k * hwTop);
      m.rotation.y = a;
      g.add(m);
    }
  } else {
    // a thatched lookout on four posts
    for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(box(0.18, 1.4, 0.18, WOOD, x * (hwTop - 0.1), y, z * (hwTop - 0.1)));
    g.add(box(hwTop * 2 + 0.1, 0.12, hwTop * 2 + 0.1, WOOD_DK, 0, y + 0.55, 0));
    const roof = thatchRoof(hwTop * 2, hwTop * 2, r * 1.5, { over: 0.4 });
    roof.position.y = y + 1.4;
    g.add(roof);
  }
  if (o.banner !== undefined) {
    const f = new THREE.Group();
    const bw = r * 0.7, bh = h * 0.3;
    f.add(box(bw + 0.3, 0.1, 0.1, WOOD, 0, 0, 0));
    f.add(box(bw, bh, 0.05, o.banner, 0, -bh, 0.02));
    for (const x of [-1, 0, 1]) f.add(feather(0.5, 0.18, x ? F_YEL : F_RED).rotateZ(Math.PI).translateX(x * bw * 0.32).translateY(bh - 0.02));
    const disc = sunDisc(bw * 0.22);
    disc.position.set(0, -bh * 0.45, 0.06);
    f.add(disc);
    f.position.set(0, h * 0.8, hw0 + 0.02);
    g.add(f);
  }
  return g;
}

// ---------- the stepped platforms ----------

interface Pyramid { g: THREE.Group; top: number; topW: number; topD: number; front: (level: number) => number; stepH: number; levels: number; cz: number }

/**
 * A stepped pyramid centred at (0, cz): `levels` courses of stone from w0 × d0 at the foot to w1 × d1 at the
 * top, each capped with a trim of fresh stone and every other one banded in red; a stair up the middle of
 * the front flanked by balustrades that end in feathered serpent heads; moss on the ledges and vines down
 * the faces.
 */
function stepPyramid(o: { levels: number; w0: number; d0: number; w1: number; d1: number; stepH: number; cz?: number; stairW?: number; heads?: number; seed?: number; painted?: boolean; vines?: number; y0?: number }): Pyramid {
  const g = new THREE.Group();
  const { levels: n, w0, d0, w1, d1, stepH } = o;
  const cz = o.cz ?? 0, y0 = o.y0 ?? 0;
  const r = rng(o.seed ?? 7);
  const W = (i: number) => w0 + (w1 - w0) * (n === 1 ? 0 : i / (n - 1));
  const D = (i: number) => d0 + (d1 - d0) * (n === 1 ? 0 : i / (n - 1));
  const sw = o.stairW ?? Math.min(3.2, W(n - 1) * 0.5);
  for (let i = 0; i < n; i++) {
    const y = y0 + i * stepH;
    g.add(box(W(i), stepH, D(i), i % 2 ? ST : ST_OLD, 0, y, cz));
    g.add(box(W(i) + 0.14, 0.16, D(i) + 0.14, ST_LT, 0, y + stepH - 0.16, cz));
    // the recessed panel band on each course, red on every other one
    g.add(box(W(i) + 0.12, stepH * 0.32, D(i) + 0.12, i % 2 === 1 && o.painted !== false ? PAINT : ST_DK, 0, y + stepH * 0.3, cz));
    // carved panels in a row along each face above the band
    const ph = stepH * 0.24, py = y + stepH * 0.66;
    for (const [len, along, off, facing] of [[W(i), 'x', D(i) / 2, 1], [W(i), 'x', -D(i) / 2, -1], [D(i), 'z', W(i) / 2, 1], [D(i), 'z', -W(i) / 2, -1]] as [number, string, number, number][]) {
      const np = Math.max(1, Math.floor(len / 1.7));
      for (let k = 0; k < np; k++) {
        const t = -len / 2 + ((k + 0.5) * len) / np;
        if (along === 'x' && facing > 0 && Math.abs(t) < sw / 2 + 0.9) continue;
        const p = along === 'x' ? box(0.9, ph, 0.06, ST_DK, t, py, cz + off + facing * 0.06) : box(0.06, ph, 0.9, ST_DK, off + facing * 0.06, py, cz + t);
        g.add(p);
        // on the red courses, a jade stud between the panels that glows at night
        if (i % 2 === 1 && o.painted !== false) {
          const jy = y + stepH * 0.46, e = 0.1;
          const j = along === 'x' ? glow(new THREE.BoxGeometry(0.18, 0.18, 0.06)).translateX(t).translateY(jy).translateZ(cz + off + facing * e) : glow(new THREE.BoxGeometry(0.06, 0.18, 0.18)).translateX(off + facing * e).translateY(jy).translateZ(cz + t);
          g.add(j);
        }
      }
    }
    // moss gathering on the ledge corners
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) {
      if (r() < 0.45) g.add(moss(0.35 + r() * 0.25, sx * (W(i) / 2 - 0.2), y + stepH, cz + sz * (D(i) / 2 - 0.2), i * 4 + sx + sz * 2));
    }
  }
  const top = y0 + n * stepH;
  // the stair: a flight of steps from the foot of the front up onto the top
  const zf = cz + D(0) / 2, zt = cz + D(n - 1) / 2 - 0.3;
  const steps = n * 3;
  const run = (zf - zt) / steps, rise = (top - y0) / steps;
  // (each step stands a touch proud of the ledge trims it meets, so their tops never flicker)
  for (let k = 0; k < steps; k++) g.add(box(sw, rise * (k + 1) + 0.04, run + 0.02, k % 3 === 2 ? ST : ST_LT, 0, y0, zf - k * run - run / 2));
  // the balustrades: sloped rails running up either side, a serpent head at the foot of each
  const slope = Math.atan2(top - y0, zf - zt);
  const len = Math.hypot(top - y0, zf - zt);
  for (const s of [-1, 1]) {
    const bal = box(0.55, 0.62, len + 0.3, ST, 0, 0, 0);
    bal.geometry.translate(0, -0.31, 0);
    bal.position.set(s * (sw / 2 + 0.27), (y0 + top) / 2 + 0.34, (zf + zt) / 2);
    bal.rotation.x = slope;
    g.add(bal);
    const strip = box(0.62, 0.1, len + 0.3, ST_LT, 0, 0, 0);
    strip.geometry.translate(0, 0.3, 0);
    strip.position.set(s * (sw / 2 + 0.27), (y0 + top) / 2 + 0.34, (zf + zt) / 2);
    strip.rotation.x = slope;
    g.add(strip);
    if (o.heads !== 0) {
      const hs = o.heads ?? 0.6;
      const hd = serpentHead(hs, ST, true);
      hd.position.set(s * (sw / 2 + 0.27), y0, zf - 0.2 * hs);
      g.add(hd);
    }
  }
  // vines hanging from the ledges
  const nv = o.vines ?? n * 3;
  for (let k = 0; k < nv; k++) {
    const i = Math.floor(r() * n);
    const y = y0 + (i + 1) * stepH;
    const side = Math.floor(r() * 4);
    const t = r() - 0.5;
    const hw = W(i) / 2, hd = D(i) / 2;
    const [x, z, ry] = side === 0 ? [t * W(i), cz - hd, Math.PI] : side === 1 ? [hw, cz + t * D(i), Math.PI / 2] : side === 2 ? [-hw, cz + t * D(i), -Math.PI / 2] : [t * W(i), cz + hd, 0];
    if (side === 3 && Math.abs(x) < sw / 2 + 0.8) continue; // never over the stair
    const v = vine(Math.min(y - y0, stepH * (1 + r() * 1.6)), k);
    v.position.set(x, y, z);
    v.rotation.y = ry;
    g.add(v);
  }
  return { g, top, topW: W(n - 1), topD: D(n - 1), front: (i) => cz + D(i) / 2, stepH, levels: n, cz };
}

/**
 * A shrine: a small house of stone on a temple top, its doorway framed in jade and gold, a stepped cornice,
 * and a roof of thatch or a tall pierced roof comb. Front faces +z.
 */
function shrine(w: number, d: number, h: number, o: { comb?: number; thatch?: number; idol?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, h, d, ST));
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) g.add(box(0.3, h, 0.3, ST_LT, x, 0, z));
  g.add(box(w + 0.2, 0.5, d + 0.2, PAINT, 0, h - 0.6, 0));
  g.add(box(w + 0.4, 0.22, d + 0.4, ST_LT, 0, h - 0.1, 0));
  // the doorway: dark within, a jade frame that glows, a gold band over it
  const dw = Math.min(1.3, w * 0.36), dh = h * 0.66;
  g.add(box(dw, dh, 0.1, DOORWAY, 0, 0, d / 2 + 0.01));
  for (const x of [-1, 1]) g.add(glow(new THREE.BoxGeometry(0.1, dh, 0.08)).translateX(x * (dw / 2 + 0.06)).translateY(dh / 2).translateZ(d / 2 + 0.05));
  g.add(glow(new THREE.BoxGeometry(dw + 0.22, 0.1, 0.08)).translateY(dh + 0.05).translateZ(d / 2 + 0.05));
  g.add(box(dw + 0.8, 0.22, 0.14, GOLD, 0, dh + 0.14, d / 2 + 0.05));
  if (o.idol) {
    // the idol in the doorway, a squat jade figure glowing against the firelit room behind it
    g.add(glow(new THREE.BoxGeometry(0.36, 0.6, 0.2)).translateY(0.3).translateZ(d / 2 + 0.16));
    g.add(glow(new THREE.BoxGeometry(0.46, 0.3, 0.22)).translateY(0.72).translateZ(d / 2 + 0.16));
    const lit = box(dw * 0.7, dh * 0.78, 0.04, C.window, 0, 0, d / 2 + 0.07);
    lit.userData.window = true;
    g.add(lit);
  }
  // carved masks at the front corners of the cornice
  for (const x of [-1, 1]) {
    const m = serpentHead(0.22, ST_LT, false);
    m.position.set(x * (w / 2 - 0.05), h - 0.55, d / 2 + 0.1);
    g.add(m);
  }
  if (o.comb) {
    const c = roofComb(w * 0.8, o.comb);
    c.position.y = h + 0.12;
    g.add(c);
  } else {
    const roof = thatchRoof(w, d, o.thatch ?? 1.8, { over: 0.35 });
    roof.position.y = h + 0.12;
    g.add(roof);
  }
  return g;
}

// ---------- the jungle's own plants ----------

/** A palm: a leaning, ringed trunk, a crown of long drooping fronds and a few nuts under them. */
export function palm(h: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  const lean = (r() - 0.5) * 0.5, dir = r() * Math.PI * 2;
  const segs = 4;
  let p = V(0, 0, 0);
  for (let i = 0; i < segs; i++) {
    const k = (i + 1) / segs;
    const q = V(Math.cos(dir) * lean * h * k * k, h * k, Math.sin(dir) * lean * h * k * k);
    g.add(limb(p, q, 0.2 - i * 0.03, 0.18 - i * 0.03, i % 2 ? BARK : BARK_DK, 6));
    p = q;
  }
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r();
    const fr = new THREE.Group();
    // a frond: rising from the crown, then drooping, leaflets as a flat diamond
    const f1 = mesh(new THREE.OctahedronGeometry(1, 0).scale(0.34, 0.03, 1.1).translate(0, 0, 1.0), i % 2 ? FROND : FROND_DK);
    f1.rotation.x = -0.35;
    const f2 = mesh(new THREE.OctahedronGeometry(1, 0).scale(0.28, 0.03, 0.9).translate(0, 0, 0.8), i % 2 ? FROND_DK : FROND);
    f2.position.set(0, 0.6, 1.8);
    f2.rotation.x = 0.55;
    fr.add(f1, f2);
    fr.position.copy(p);
    fr.rotation.y = a;
    g.add(fr);
  }
  for (let i = 0; i < 3; i++) g.add(blob(0.13, WOOD, p.x + Math.cos(i * 2.1) * 0.2, p.y - 0.15, p.z + Math.sin(i * 2.1) * 0.2));
  return g;
}

/** A banana plant: a thick soft stem, broad torn leaves arching out, a hanging bunch and its purple flower. */
export function banana(s: number, r: () => number, fruit = true): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.12 * s, 0.17 * s, 1.5 * s, 0x7a8e3c, 6));
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.5;
    const leaf = new THREE.Group();
    const l = mesh(new THREE.BoxGeometry(0.42 * s, 0.04, 1.5 * s).translate(0, 0, 0.75 * s), i % 2 ? FROND : FROND_DK);
    l.rotation.x = -0.5 + (i % 3) * 0.35;
    leaf.add(l);
    leaf.position.y = 1.35 * s;
    leaf.rotation.y = a;
    g.add(leaf);
  }
  if (fruit) {
    for (let i = 0; i < 5; i++) g.add(blob(0.09 * s, F_YEL, 0.22 * s + (i % 2) * 0.08 * s, (1.0 - i * 0.07) * s, (i - 2) * 0.05 * s, 1.6, 0.7, 0.7));
    g.add(blob(0.1 * s, 0x7a2a4a, 0.28 * s, 0.62 * s, 0, 0.8, 1.3, 0.8));
  }
  return g;
}

/** A maize plant: a tall stalk, long leaf blades arching off it, a tassel on top and a cob in its husk. */
function maize(h: number, k: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.035, 0.05, h, 0x7e9a38, 4));
  for (let i = 0; i < 2; i++) {
    const b = box(0.1, 0.03, 0.8, i ? FROND : 0x7e9a38, 0, 0, 0);
    b.geometry.translate(0, 0, 0.4);
    b.position.y = h * (0.35 + i * 0.28);
    b.rotation.set(0.45, (k * 1.7 + i * Math.PI) % (Math.PI * 2), 0);
    g.add(b);
  }
  g.add(cone(0.06, 0.34, F_YEL, 4, 0, h));
  const cob = cyl(0.05, 0.07, 0.3, k % 3 ? F_YEL : 0xd86a3a, 5, 0.07, h * 0.5, 0);
  cob.rotation.z = -0.4;
  g.add(cob);
  return g;
}

/** A great bloom of the jungle floor: five fleshy petals round a gold heart, the size of a shield. */
export function bloom(s: number, color = 0xd8452c): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = blob(0.34 * s, color, Math.cos(a) * 0.32 * s, 0.1 * s, Math.sin(a) * 0.32 * s, 1.1, 0.35, 0.8);
    p.rotation.y = -a;
    g.add(p);
    g.add(bit(new THREE.OctahedronGeometry(0.05 * s, 0), FOAM).translateX(Math.cos(a) * 0.38 * s).translateY(0.22 * s).translateZ(Math.sin(a) * 0.38 * s));
  }
  g.add(blob(0.16 * s, F_YEL, 0, 0.2 * s, 0, 1, 0.6, 1));
  return g;
}

/** A bromeliad: a rosette of stiff spiky leaves, red at the heart. */
function bromeliad(s: number, heart = F_RED): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const l = cone(0.1 * s, 0.7 * s, i % 2 ? FROND : FROND_DK, 4, Math.cos(a) * 0.12 * s, 0, Math.sin(a) * 0.12 * s);
    l.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
    g.add(l);
  }
  g.add(cone(0.1 * s, 0.4 * s, heart, 5));
  return g;
}

/** Ferns: a low clump of arching fronds. */
function ferns(s: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r();
    const f = mesh(new THREE.OctahedronGeometry(1, 0).scale(0.18 * s, 0.03, 0.7 * s).translate(0, 0, 0.6 * s), i % 2 ? FROND : FROND_DK);
    f.rotation.set(-0.5, a, 0);
    f.position.y = 0.2 * s;
    g.add(f);
  }
  return g;
}

// ---------- the beasts of the jungle (long along +x, like the horse) ----------

/**
 * A raptor: a lean running lizard on two great hind legs, its long tail held out stiff behind it,
 * a narrow toothy head, little clawed arms, feathers on its crown, neck and arms, dark bands down
 * its back and a sickle claw on each foot. Riders sit on it at y ≈ 1.5.
 */
export function raptor(skin = 0x6e7b3e, plume = F_RED, saddle: number | null = PAINT): THREE.Group {
  const g = new THREE.Group();
  const dk = darker(skin, 0.7), lt = darker(skin, 1.35);
  g.add(blob(0.46, skin, 0.05, 1.24, 0, 1.45, 0.72, 0.62));
  g.add(blob(0.3, lt, 0.36, 1.1, 0, 1.2, 0.62, 0.62));
  const tail = cone(0.26, 1.9, skin, 6);
  tail.rotation.z = Math.PI / 2 - 0.12;
  tail.position.set(-0.45, 1.32, 0);
  g.add(tail);
  for (let i = 0; i < 4; i++) g.add(box(0.13, 0.08, 0.5 - i * 0.08, dk, 0.25 - i * 0.42, 1.52 - Math.max(0, i - 1) * 0.02, 0));
  const tuft = featherFan(3, 0.5, 0.7, [plume, F_YEL, plume], 0.18);
  tuft.rotation.z = Math.PI / 2 - 0.1;
  tuft.position.set(-2.2, 1.56, 0);
  g.add(tuft);
  // the neck and head
  g.add(limb(V(0.45, 1.3, 0), V(0.98, 1.84, 0), 0.21, 0.13, skin, 6));
  g.add(box(0.48, 0.24, 0.26, skin, 1.12, 1.76, 0));
  g.add(box(0.38, 0.16, 0.2, skin, 1.47, 1.8, 0));
  const jaw = box(0.52, 0.08, 0.18, dk, 0, 0, 0);
  jaw.geometry.translate(0.26, 0, 0);
  jaw.position.set(1.02, 1.72, 0);
  jaw.rotation.z = -0.16;
  g.add(jaw);
  for (let i = 0; i < 3; i++) for (const z of [-0.07, 0.07]) g.add(cone(0.025, 0.09, CLAW, 3, 1.36 + i * 0.1, 1.72, z).rotateX(Math.PI));
  for (const z of [-1, 1]) g.add(box(0.07, 0.08, 0.03, F_YEL, 1.24, 1.9, z * 0.135), box(0.03, 0.06, 0.02, DOORWAY, 1.25, 1.91, z * 0.15));
  const crest = featherFan(3, 0.46, 0.8, [plume, F_YEL, plume], 0.16);
  crest.rotation.z = 0.95;
  crest.position.set(1.0, 1.95, 0);
  g.add(crest);
  for (let i = 0; i < 3; i++) {
    const f = feather(0.34, 0.14, i % 2 ? F_YEL : plume);
    f.position.set(0.62 + i * 0.14, 1.52 + i * 0.13, 0);
    f.rotation.z = 1.2;
    g.add(f);
  }
  // little arms, folded, with a fringe of feathers
  for (const s of [-1, 1]) {
    g.add(limb(V(0.52, 1.2, s * 0.22), V(0.74, 0.98, s * 0.27), 0.065, 0.05, skin, 4));
    g.add(cone(0.03, 0.12, CLAW, 3, 0.78, 0.92, s * 0.27).rotateZ(-2.4));
    g.add(box(0.28, 0.14, 0.03, plume, 0.62, 1.0, s * 0.3).rotateZ(-0.6));
  }
  // the legs: a heavy thigh, a long shin raked back, a raised ankle, splayed toes and the sickle claw
  for (const s of [-1, 1]) {
    const z = s * 0.26;
    g.add(blob(0.27, skin, -0.05, 1.02, z, 1.15, 1.45, 0.72));
    g.add(limb(V(0.06, 0.8, z), V(-0.24, 0.3, z), 0.11, 0.08, skin, 5));
    g.add(limb(V(-0.24, 0.3, z), V(-0.08, 0.05, z), 0.07, 0.06, dk, 4));
    g.add(box(0.36, 0.07, 0.18, dk, 0.06, 0, z));
    const sc = cone(0.035, 0.18, CLAW, 3, -0.02, 0.12, z);
    sc.rotation.z = 0.9;
    g.add(sc);
  }
  if (saddle !== null) {
    g.add(box(0.62, 0.1, 0.62, saddle, -0.02, 1.5, 0));
    g.add(box(0.64, 0.04, 0.64, GOLD_DK, -0.02, 1.49, 0));
    for (const z of [-1, 1]) g.add(box(0.5, 0.3, 0.03, saddle, -0.02, 1.22, z * 0.32));
  }
  return g;
}

/**
 * A horned beast: a great four-footed lizard, heavy as a hut, with a bony frill fanning up behind its
 * head (painted red and gold), two long horns over its eyes and a short one on its beak. Its rider sits
 * in a wicker saddle at y ≈ 2.1.
 */
export function hornedBeast(skin = 0x8a6d4c, frill = PAINT): THREE.Group {
  const g = new THREE.Group();
  const dk = darker(skin, 0.72);
  g.add(blob(0.9, skin, -0.1, 1.25, 0, 1.5, 0.82, 0.88));
  g.add(blob(0.55, darker(skin, 1.18), 0.1, 0.92, 0, 1.6, 0.6, 0.9));
  for (let i = 0; i < 5; i++) g.add(cone(0.1, 0.2, dk, 4, -0.9 + i * 0.4, 1.92 - Math.abs(i - 2) * 0.05, 0));
  for (const [x, z] of [[0.72, 0.45], [0.72, -0.45], [-0.78, 0.45], [-0.78, -0.45]] as [number, number][]) {
    g.add(cyl(0.2, 0.25, 0.95, dk, 6, x, 0, z));
    g.add(box(0.36, 0.08, 0.36, dk, x + 0.04, 0, z));
  }
  const tail = cone(0.32, 1.25, skin, 6);
  tail.rotation.z = Math.PI / 2 + 0.28;
  tail.position.set(-1.25, 1.22, 0);
  g.add(tail);
  // the head, beaked, low and forward
  g.add(box(0.72, 0.62, 0.64, skin, 1.42, 0.7, 0));
  const beak = cone(0.2, 0.5, 0x5a4a3a, 5, 1.8, 0.92, 0);
  beak.rotation.z = -Math.PI / 2;
  g.add(beak);
  for (const z of [-1, 1]) g.add(box(0.06, 0.08, 0.03, DOORWAY, 1.66, 1.16, z * 0.33));
  // the frill: a half-disc standing up behind the head, a painted field, spikes round its rim
  const fr = new THREE.Group();
  fr.add(mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.12, 12, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2), skin));
  fr.add(mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.14, 10, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2), frill).translateX(0.02));
  for (const z of [-0.32, 0.32]) fr.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 8).rotateZ(Math.PI / 2), GOLD).translateY(0.42).translateZ(z));
  for (let i = 0; i < 7; i++) {
    const a = (i / 6) * Math.PI;
    const sp = cone(0.07, 0.24, CLAW, 4, 0, Math.sin(a) * 0.98, Math.cos(a) * 0.98);
    sp.rotation.x = -Math.PI / 2 + a;
    fr.add(sp);
  }
  fr.position.set(1.12, 1.18, 0);
  fr.rotation.z = 0.42;
  g.add(fr);
  // the horns
  for (const z of [-1, 1]) {
    const h = cone(0.09, 0.95, CLAW, 5, 1.52, 1.26, z * 0.22);
    h.rotation.z = -1.15;
    g.add(h);
  }
  const nh = cone(0.08, 0.36, CLAW, 4, 1.74, 1.2, 0);
  nh.rotation.z = -0.55;
  g.add(nh);
  return g;
}

/** Saddle a horned beast for a rider: a wicker seat on a painted blanket, tassels of feathers. */
function beastSaddle(g: THREE.Group): void {
  g.add(box(1.2, 0.08, 1.1, PAINT, -0.1, 1.95, 0));
  g.add(box(0.76, 0.3, 0.7, BAMBOO, -0.1, 2.0, 0));
  g.add(box(0.8, 0.06, 0.74, BAMBOO_DK, -0.1, 2.3, 0));
  for (const z of [-1, 1]) {
    const f = feather(0.45, 0.16, F_YEL);
    f.rotation.x = Math.PI;
    f.position.set(-0.1, 1.95, z * 0.56);
    g.add(f);
  }
}

/**
 * A bonehead: a stocky two-legged lizard with a great dome of bone for a skull (knobbed round the back,
 * a stripe of war paint over it). The temple-city's siege beast: it batters gates with its head.
 */
export function bonehead(skin = 0x8a7a52): THREE.Group {
  const g = new THREE.Group();
  const dk = darker(skin, 0.72);
  g.add(blob(0.55, skin, 0, 1.2, 0, 1.3, 0.86, 0.76));
  g.add(blob(0.36, darker(skin, 1.3), 0.3, 1.04, 0, 1.1, 0.7, 0.66));
  const tail = cone(0.3, 1.6, skin, 6);
  tail.rotation.z = Math.PI / 2 - 0.05;
  tail.position.set(-0.55, 1.26, 0);
  g.add(tail);
  g.add(limb(V(0.45, 1.3, 0), V(0.86, 1.55, 0), 0.24, 0.2, skin, 6));
  g.add(blob(0.2, skin, 1.08, 1.52, 0, 1.4, 0.8, 0.9));
  g.add(blob(0.33, 0xdcd2b0, 0.92, 1.78, 0, 1.1, 0.92, 1.0));
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 0.55 + (i / 4) * Math.PI * 0.9;
    g.add(cone(0.06, 0.16, 0xc8bc98, 4, 0.92 + Math.cos(a) * 0.36, 1.68, Math.sin(a) * 0.3));
  }
  const paint = box(0.5, 0.05, 0.08, PAINT, 0.92, 2.06, 0);
  paint.rotation.z = -0.2;
  g.add(paint);
  for (const z of [-1, 1]) g.add(box(0.06, 0.07, 0.03, F_YEL, 1.2, 1.6, z * 0.16));
  for (const s of [-1, 1]) {
    const z = s * 0.3;
    g.add(blob(0.3, skin, -0.05, 1.0, z, 1.1, 1.4, 0.75));
    g.add(limb(V(0.05, 0.78, z), V(-0.18, 0.3, z), 0.13, 0.1, skin, 5));
    g.add(limb(V(-0.18, 0.3, z), V(-0.05, 0.05, z), 0.09, 0.08, dk, 4));
    g.add(box(0.4, 0.08, 0.22, dk, 0.08, 0, z));
    g.add(limb(V(0.5, 1.15, s * 0.26), V(0.66, 0.96, s * 0.3), 0.06, 0.05, skin, 4));
  }
  return g;
}

/**
 * A pack lizard: long, low and patient, sprawled on four bowed legs, a ridge of spines down its back,
 * a long tail dragging and a forked red tongue. The caravans load it with baskets and bales.
 */
export function packLizard(skin = 0x7a7048): THREE.Group {
  const g = new THREE.Group();
  const dk = darker(skin, 0.72);
  g.add(blob(0.6, skin, 0, 0.82, 0, 1.9, 0.58, 0.82));
  for (let i = 0; i < 6; i++) g.add(cone(0.07, 0.18, dk, 4, -0.9 + i * 0.36, 1.12, 0));
  for (const [x, s] of [[0.7, 1], [0.7, -1], [-0.7, 1], [-0.7, -1]] as [number, number][]) {
    g.add(limb(V(x, 0.78, s * 0.34), V(x + 0.06, 0.48, s * 0.74), 0.12, 0.1, skin, 5));
    g.add(limb(V(x + 0.06, 0.48, s * 0.74), V(x + 0.12, 0.02, s * 0.78), 0.1, 0.08, dk, 4));
    g.add(box(0.3, 0.06, 0.26, dk, x + 0.18, 0, s * 0.8));
  }
  const tail = cone(0.3, 2.1, skin, 6);
  tail.rotation.z = Math.PI / 2 + 0.22;
  tail.position.set(-1.0, 0.82, 0);
  g.add(tail);
  g.add(limb(V(0.95, 0.85, 0), V(1.3, 0.92, 0), 0.26, 0.22, skin, 6));
  g.add(box(0.56, 0.28, 0.4, skin, 1.5, 0.78, 0));
  g.add(box(0.34, 0.16, 0.3, skin, 1.86, 0.8, 0));
  g.add(box(0.36, 0.08, 0.3, dk, 1.7, 0.7, 0));
  for (const z of [-1, 1]) g.add(box(0.06, 0.07, 0.03, F_YEL, 1.6, 1.0, z * 0.2));
  g.add(box(0.4, 0.02, 0.06, PAINT, 2.1, 0.76, 0));
  return g;
}

/**
 * A chameleon of the war-bands, big as a dog: a tall narrow body striped in bright bands, a crested
 * casque on its head, turret eyes, a crest of spines and its tail curled in a spiral. (The temple-city's
 * scouts: nobody sees them coming.)
 */
export function chameleon(skin = 0x5ab84a, band = 0xd8e060): THREE.Group {
  const g = new THREE.Group();
  const dk = darker(skin, 0.72);
  g.add(blob(0.42, skin, 0, 0.74, 0, 1.25, 0.95, 0.55));
  for (const x of [-0.2, 0.12]) g.add(box(0.1, 0.5, 0.48, band, x, 0.52, 0));
  for (let i = 0; i < 5; i++) g.add(cone(0.05, 0.16, dk, 4, -0.34 + i * 0.16, 1.1 + Math.sin((i / 4) * Math.PI) * 0.06, 0));
  g.add(blob(0.25, skin, 0.52, 0.86, 0, 1.25, 0.9, 0.8));
  const casque = cone(0.2, 0.46, dk, 4, 0.44, 0.98, 0);
  casque.rotation.z = 0.7;
  g.add(casque);
  for (const z of [-1, 1]) {
    g.add(blob(0.1, darker(skin, 1.3), 0.62, 0.92, z * 0.17));
    g.add(box(0.04, 0.05, 0.05, DOORWAY, 0.68, 0.93, z * 0.25));
  }
  for (const [x, s] of [[0.3, 1], [0.3, -1], [-0.3, 1], [-0.3, -1]] as [number, number][]) {
    g.add(limb(V(x, 0.6, s * 0.16), V(x + 0.12, 0.34, s * 0.26), 0.06, 0.05, skin, 4));
    g.add(limb(V(x + 0.12, 0.34, s * 0.26), V(x + 0.06, 0.02, s * 0.26), 0.05, 0.05, dk, 4));
  }
  g.add(limb(V(-0.42, 0.72, 0), V(-0.62, 0.5, 0), 0.1, 0.07, skin, 4));
  const curl = mesh(new THREE.TorusGeometry(0.2, 0.06, 4, 10, Math.PI * 1.6), skin);
  curl.position.set(-0.6, 0.34, 0);
  curl.rotation.z = 1.4;
  g.add(curl);
  return g;
}

/** A winged lizard (a pterosaur), built facing +z: a long beak, a red crest, wings of skin on hinges that beat slowly. */
export function pterosaur(s = 1, body = 0x7a4a3a, wing = 0xa65a3c): THREE.Group {
  const g = new THREE.Group();
  const core = new THREE.Group();
  core.add(blob(0.24, body, 0, 0, 0, 0.8, 0.7, 1.7));
  core.add(blob(0.15, body, 0, 0.12, 0.42));
  const beak = cone(0.08, 0.95, 0xd8b060, 4, 0, 0.1, 0.42);
  beak.rotation.x = Math.PI / 2;
  core.add(beak);
  const crest = cone(0.14, 0.75, F_RED, 4, 0, 0.18, 0.36);
  crest.rotation.x = -2.3;
  crest.scale.set(0.35, 1, 1);
  core.add(crest);
  core.add(box(0.06, 0.04, 0.6, body, 0, -0.04, -0.62));
  g.add(bake(core));
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.add(mesh(new THREE.BoxGeometry(1.4, 0.04, 0.78).translate(side * 0.7, 0, -0.08), wing));
    const tip = mesh(new THREE.BoxGeometry(1.3, 0.035, 0.42).translate(side * 0.65, 0, 0), wing);
    tip.position.set(side * 1.36, 0, 0.1);
    tip.rotation.y = side * 0.35;
    hinge.add(tip);
    hinge.position.set(side * 0.14, 0.04, 0.05);
    settle(hinge);
    hinge.userData.wing = side;
    hinge.userData.wingBase = 0.12;
    hinge.userData.wingAmp = 0.42;
    g.add(hinge);
  }
  g.scale.setScalar(s);
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = false; });
  return g;
}

/** A few winged lizards wheeling round in a ring (radius `r`, heights from y0 to y0 + spread). */
export function flock(n: number, r: number, y0: number, spread: number, speed: number, seed: number, s = 1): THREE.Group {
  const g = new THREE.Group();
  const rr = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rr() * 0.6;
    const d = r * (0.8 + rr() * 0.4);
    const p = pterosaur(s * (0.85 + rr() * 0.35), i % 2 ? 0x7a4a3a : 0x5e4a3a, i % 3 ? 0xa65a3c : 0x8a4a3a);
    p.position.set(Math.cos(a) * d, y0 + rr() * spread, Math.sin(a) * d);
    p.rotation.set(0, Math.PI - a, -0.22, 'YXZ');
    g.add(p);
  }
  g.userData.dynamic = true;
  g.userData.orbit = speed;
  return g;
}

// ---------- the folk and the host ----------

/**
 * A skink of the temple-city: small, quick and bright-scaled (green, blue, gold, orange...), a
 * wrap round its middle in its own colour, a pale throat, a snouted head with eyes on the sides, a
 * crest (a fan of feathers, a row of spines or a gold band with a plume) and a long tail. Drawn
 * into a person's group (see props.person).
 */
export function skinkFolk(g: THREE.Group, tunic: number, k: number, skinOver?: number): void {
  const skin = skinOver ?? SKINKS[k % SKINKS.length];
  const dk = darker(skin, 0.7);
  g.add(box(0.26, 0.3, 0.2, dk, 0, 0, 0));
  g.add(box(0.36, 0.06, 0.32, dk, 0, 0, 0.05));
  g.add(cyl(0.2, 0.24, 0.36, tunic, 6, 0, 0.26));
  g.add(cyl(0.17, 0.2, 0.36, skin, 6, 0, 0.6));
  g.add(box(0.2, 0.26, 0.05, BELLY, 0, 0.64, 0.15));
  g.add(blob(0.16, skin, 0, 1.07, 0, 1, 0.95, 1.05));
  g.add(box(0.18, 0.12, 0.26, skin, 0, 0.95, 0.15));
  for (const x of [-1, 1]) {
    g.add(box(0.05, 0.07, 0.08, F_YEL, x * 0.14, 1.09, 0.07));
    g.add(box(0.02, 0.05, 0.05, DOORWAY, x * 0.165, 1.09, 0.08));
    g.add(box(0.07, 0.4, 0.08, skin, x * 0.22, 0.46, 0.02));
  }
  const kind = k % 3;
  if (kind === 0) {
    const c = featherFan(3, 0.32, 0.7, [F_RED, F_YEL, F_RED], 0.12);
    c.position.set(0, 1.16, -0.02);
    c.rotation.x = -0.45;
    g.add(c);
  } else if (kind === 1) {
    for (let i = 0; i < 3; i++) g.add(cone(0.04, 0.16 - i * 0.02, i % 2 ? F_TQ : dk, 4, 0, 1.18 - i * 0.05, 0.02 - i * 0.12));
  } else {
    g.add(cyl(0.17, 0.17, 0.05, GOLD, 7, 0, 1.08));
    const f = feather(0.36, 0.12, F_TQ);
    f.position.set(0, 1.1, -0.12);
    f.rotation.x = -0.4;
    g.add(f);
  }
  const tail = cone(0.1, 0.9, skin, 5);
  tail.position.set(0, 0.42, -0.12);
  tail.rotation.x = -2.05;
  g.add(tail);
  if (k % 4 === 1) g.add(box(0.2, 0.24, 0.1, BAMBOO_DK, -0.24, 0.34, 0.06));
  if (k % 4 === 3) g.add(mesh(new THREE.TorusGeometry(0.16, 0.025, 3, 8).rotateX(Math.PI / 2 - 0.3), GOLD).translateY(0.84).translateZ(0.03));
  compact(g);
}

/**
 * A saurus: a head taller than a skink and twice as broad, blue-green scaled with a pale belly, a heavy
 * jaw full of teeth, a crest of red spines, thick arms, a thick tail, and a loincloth in `kit`.
 */
function saurusBody(g: THREE.Group, kit: number, o: { skin?: number; crest?: number; gold?: boolean } = {}): void {
  const skin = o.skin ?? SAURUS, dk = darker(skin, 0.7), crest = o.crest ?? F_RED;
  g.add(box(0.42, 0.4, 0.28, dk, 0, 0, 0));
  g.add(box(0.52, 0.08, 0.44, dk, 0, 0, 0.06));
  g.add(cyl(0.3, 0.33, 0.3, kit, 7, 0, 0.36));
  g.add(box(0.26, 0.36, 0.04, kit, 0, 0.3, 0.31));
  g.add(cyl(0.37, 0.3, 0.6, skin, 7, 0, 0.64));
  g.add(box(0.3, 0.5, 0.06, BELLY, 0, 0.68, 0.28));
  for (const x of [-1, 1]) {
    g.add(blob(0.2, skin, x * 0.38, 1.18, 0, 1.1, 0.85, 1));
    g.add(limb(V(x * 0.42, 1.14, 0), V(x * 0.48, 0.7, 0.12), 0.11, 0.09, skin, 5));
    if (o.gold) g.add(cyl(0.12, 0.12, 0.1, GOLD, 6, x * 0.46, 0.84, 0.08));
  }
  g.add(cyl(0.17, 0.21, 0.16, skin, 6, 0, 1.24));
  g.add(box(0.36, 0.28, 0.42, skin, 0, 1.34, 0.04));
  g.add(box(0.3, 0.2, 0.3, skin, 0, 1.34, 0.36));
  g.add(box(0.28, 0.08, 0.42, dk, 0, 1.27, 0.3));
  for (const x of [-1, 1]) {
    g.add(cone(0.025, 0.08, CLAW, 3, x * 0.1, 1.28, 0.5).rotateX(Math.PI));
    g.add(box(0.05, 0.07, 0.08, F_YEL, x * 0.18, 1.5, 0.16));
    g.add(box(0.12, 0.05, 0.22, dk, x * 0.12, 1.6, 0.16));
  }
  for (let i = 0; i < 4; i++) g.add(cone(0.05, 0.24 - i * 0.03, crest, 4, 0, 1.6 - i * 0.03, 0.2 - i * 0.16));
  const tail = cone(0.18, 1.05, skin, 6);
  tail.position.set(0, 0.46, -0.2);
  tail.rotation.x = -2.1;
  g.add(tail);
}

/** A round hide shield (its face turned to -x, worn on the left arm) painted with a red ring, feathers hanging from its rim. */
function hideShield(r: number, field: number, x: number, y: number, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(r, r, 0.07, field, 9).rotateZ(Math.PI / 2));
  const ring = mesh(new THREE.TorusGeometry(r * 0.55, r * 0.09, 3, 10).rotateY(Math.PI / 2), PAINT);
  ring.position.x = -0.045;
  g.add(ring);
  g.add(cyl(r * 0.2, r * 0.2, 0.1, GOLD, 6).rotateZ(Math.PI / 2));
  for (const k of [-1, 1]) {
    const f = feather(r * 0.9, 0.12, k > 0 ? F_RED : F_YEL);
    f.rotation.set(0, Math.PI / 2, Math.PI);
    f.position.set(-0.04, -r * 0.55, k * r * 0.45);
    g.add(f);
  }
  g.position.set(x, y, z);
  return g;
}

/**
 * One of the Saurian King's host on foot: skink spears behind hide shields, saurus guards with a
 * turquoise shield and an obsidian-edged blade, saurus warriors with a great studded club, blowpipers
 * in leaf cloaks; chameleons for scouts.
 */
export function saurianSoldier(kind: string, k: number): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'scout') {
    const c = chameleon(k % 2 ? 0x5ab84a : 0x3aa8a0, k % 2 ? 0xd8e060 : 0xf2a03a);
    c.rotation.y = -Math.PI / 2;
    g.add(c);
    return compact(g);
  }
  if (kind === 'sword' || kind === 'axe') {
    saurusBody(g, kind === 'sword' ? 0x2b8a86 : PAINT, { gold: kind === 'sword' });
    if (kind === 'sword') {
      // a turquoise shield with a gold boss, and a blade of wood edged with obsidian teeth
      g.add(hideShield(0.4, F_TQ, -0.48, 0.76, 0.06));
      const bl = new THREE.Group();
      bl.add(box(0.14, 0.86, 0.05, WOOD));
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) bl.add(box(0.06, 0.12, 0.04, OBSID, s * 0.09, 0.2 + i * 0.17, 0));
      bl.position.set(0.48, 0.58, 0.26);
      bl.rotation.x = 0.5;
      g.add(bl);
    } else {
      // a great club, its head studded with obsidian, over the shoulder; red paint across the chest
      g.add(box(0.5, 0.07, 0.02, PAINT, 0, 0.98, 0.37));
      const handle = box(0.07, 1.3, 0.07, WOOD_DK);
      handle.position.set(0.44, 0.85, -0.1);
      handle.rotation.x = -0.55;
      g.add(handle);
      const head = new THREE.Group();
      head.add(box(0.2, 0.6, 0.16, WOOD));
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) head.add(box(0.05, 0.1, 0.14, OBSID, s * 0.12, 0.08 + i * 0.14, 0));
      head.position.set(0.44, 1.72, -0.62);
      head.rotation.x = -0.55;
      g.add(head);
    }
    return compact(g);
  }
  const tunic = kind === 'spear' ? 0x2c5cb8 : kind === 'archer' ? 0x4f7a2e : 0xb8862a;
  skinkFolk(g, tunic, kind === 'archer' ? 1 : k, kind === 'archer' ? 0x3a8a6a : undefined);
  if (kind === 'spear') {
    g.add(hideShield(0.34, 0xc8a878, -0.3, 0.62, 0.04));
    g.add(cyl(0.03, 0.035, 2.2, BAMBOO, 5, 0.34, 0.1, 0.1));
    g.add(cone(0.08, 0.36, OBSID, 4, 0.34, 2.3, 0.1));
    const f = feather(0.3, 0.1, F_RED);
    f.rotation.z = Math.PI;
    f.position.set(0.4, 2.24, 0.1);
    g.add(f);
  } else if (kind === 'archer') {
    // a blowpipe as long as he is tall, darts in a cane quiver, a cloak of leaves over the back
    g.add(cyl(0.03, 0.035, 1.8, BAMBOO_DK, 5, 0.3, 0.2, 0.1));
    g.add(cyl(0.05, 0.05, 0.08, GOLD, 5, 0.3, 1.9, 0.1));
    g.add(box(0.1, 0.46, 0.1, BAMBOO, -0.1, 0.5, -0.24));
    const cloak = box(0.5, 0.8, 0.05, FROND_DK, 0, 0.3, -0.22);
    cloak.rotation.x = 0.12;
    g.add(cloak);
    for (const x of [-0.16, 0.02, 0.18]) {
      const t = cone(0.08, 0.26, FROND, 3, x, 0.34, -0.25);
      t.rotation.x = Math.PI;
      g.add(t);
    }
  }
  return compact(g);
}

/** A sun priest: a skink elder in a cloak of feathers, a gold sun on the breast, a towering headdress, a staff crowned with a sun-disc. */
export function sunPriest(): THREE.Group {
  const g = new THREE.Group();
  skinkFolk(g, F_YEL, 2, 0x3fa8a0);
  g.add(cyl(0.22, 0.4, 0.72, F_TQ, 8, 0, 0));
  const cloak = box(0.72, 1.0, 0.05, F_RED, 0, 0.12, -0.24);
  cloak.rotation.x = 0.1;
  g.add(cloak);
  for (let i = 0; i < 4; i++) g.add(box(0.16, 0.2, 0.04, i % 2 ? F_YEL : F_TQ, -0.27 + i * 0.18, 0.1, -0.27));
  g.add(glow(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8).rotateX(Math.PI / 2), 0xffd060, 0x9a6410).translateY(0.72).translateZ(0.2));
  const hd = featherFan(7, 0.7, 1.9, [F_RED, F_YEL, F_TQ, F_GRN, F_TQ, F_YEL, F_RED], 0.16);
  hd.position.set(0, 1.12, -0.08);
  hd.rotation.x = -0.2;
  g.add(hd);
  g.add(cyl(0.035, 0.04, 2.3, WOOD_DK, 5, 0.4, 0, 0.1));
  const disc = sunDisc(0.2, true);
  disc.position.set(0.4, 2.45, 0.1);
  g.add(disc);
  return compact(g);
}

/** Put a rider on a mount: the mount turned to face +z, the rider in the saddle. */
function mounted(mount: THREE.Group, man: THREE.Group, seat: number): THREE.Group {
  const g = new THREE.Group();
  mount.rotation.y = -Math.PI / 2;
  g.add(mount);
  man.scale.setScalar(0.85);
  man.position.set(0, seat, -0.1);
  g.add(man);
  return g;
}

/** Raptor riders with a lance, raptor archers with a bow, and horned riders: a saurus on a horned beast with a long spear. */
export function saurianRider(kind: string): THREE.Group {
  if (kind === 'heavy') {
    const beast = hornedBeast(0x8a6d4c);
    beastSaddle(beast);
    const man = new THREE.Group();
    saurusBody(man, 0x2b8a86, { gold: true });
    const g = mounted(beast, man, 2.08);
    g.add(cyl(0.04, 0.045, 3.0, WOOD_DK, 5, 0.42, 2.0, 0.1));
    g.add(cone(0.1, 0.46, OBSID, 4, 0.42, 5.0, 0.1));
    const f = feather(0.4, 0.14, F_RED);
    f.rotation.z = Math.PI;
    f.position.set(0.42, 4.9, 0.1);
    g.add(f);
    return compact(g);
  }
  const archer = kind === 'marcher';
  const r = raptor(archer ? 0x56697a : 0xa8784a, archer ? 0xf2a03a : F_RED, archer ? PAINT_TQ : PAINT);
  const man = new THREE.Group();
  skinkFolk(man, archer ? 0x4f7a2e : F_RED, archer ? 1 : 0);
  const g = mounted(r, man, 1.5);
  if (archer) {
    const b = mesh(new THREE.TorusGeometry(0.45, 0.035, 4, 10, Math.PI), BAMBOO_DK);
    b.rotation.set(0, Math.PI / 2, Math.PI / 2);
    b.position.set(0.3, 1.5 + 0.7, -0.1);
    g.add(b);
  } else {
    g.add(cyl(0.035, 0.035, 2.5, BAMBOO, 5, 0.34, 1.5 + 0.3, 0));
    g.add(cone(0.08, 0.34, OBSID, 4, 0.34, 1.5 + 2.8, 0));
    g.add(box(0.03, 0.3, 0.46, F_YEL, 0.34, 1.5 + 2.3, 0.2));
  }
  return compact(g);
}

/**
 * The Saurian King: a hulking saurus a head taller than his guard, in armour of gold (breastplate,
 * pauldrons, bracers), a towering fan of red, gold and turquoise feathers for a crown, a cloak of
 * feathers, and a glaive with a jade haft and a great obsidian blade; riding a great dark raptor in gold
 * harness.
 */
export function saurianKing(): THREE.Group {
  const r = raptor(0x8a2e26, F_YEL, 0x2b2530);
  // the great raptor's gold harness: a band round its chest and brow, and discs at its flanks
  r.add(box(0.1, 0.5, 0.66, GOLD, 0.4, 1.02, 0));
  r.add(box(0.12, 0.1, 0.3, GOLD, 1.12, 1.98, 0));
  for (const z of [-1, 1]) {
    const d = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 8).rotateX(Math.PI / 2), GOLD);
    d.position.set(-0.1, 1.3, z * 0.34);
    r.add(d);
  }
  r.scale.setScalar(1.18);
  const man = new THREE.Group();
  saurusBody(man, 0x8a1e1a, { skin: 0x2f6f6a, crest: F_YEL, gold: true });
  man.add(box(0.56, 0.5, 0.1, GOLD, 0, 0.66, 0.3));
  man.add(glow(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8).rotateX(Math.PI / 2)).translateY(0.92).translateZ(0.36));
  for (const x of [-1, 1]) man.add(blob(0.22, GOLD, x * 0.4, 1.24, 0, 1.2, 0.6, 1.1));
  man.add(cyl(0.22, 0.22, 0.1, GOLD, 8, 0, 1.56, 0.06));
  const hd = featherFan(9, 1.15, 2.4, [F_RED, F_YEL, F_TQ, F_RED, F_YEL, F_RED, F_TQ, F_YEL, F_RED], 0.2);
  hd.position.set(0, 1.58, -0.02);
  hd.rotation.x = -0.25;
  man.add(hd);
  // and a crest of long plumes sweeping back over his head, so the crown shows from the side too
  const side = featherFan(5, 1.3, 1.3, [F_TQ, F_RED, F_YEL, F_RED, F_TQ], 0.22);
  side.rotation.set(0, Math.PI / 2, 0);
  const sideTilt = new THREE.Group();
  sideTilt.add(side);
  sideTilt.rotation.x = -0.55;
  sideTilt.position.set(0, 1.62, -0.1);
  man.add(sideTilt);
  const cape = box(0.8, 1.1, 0.05, 0x8a1e1a, 0, 0.3, -0.34);
  cape.rotation.x = 0.14;
  man.add(cape);
  for (let i = 0; i < 5; i++) {
    const f = feather(0.38, 0.16, [F_RED, F_YEL, F_TQ][i % 3]);
    f.rotation.z = Math.PI;
    f.position.set(-0.3 + i * 0.15, 0.3, -0.38);
    man.add(f);
  }
  const g = mounted(r, man, 1.5 * 1.18);
  // the glaive: a jade haft, gold collars, a long curved blade of obsidian
  const y0 = 1.5 * 1.18 + 0.2;
  g.add(cyl(0.05, 0.055, 2.8, JADE_DK, 6, 0.5, y0, 0.12));
  for (const y of [0.8, 2.6]) g.add(cyl(0.08, 0.08, 0.1, GOLD, 6, 0.5, y0 + y, 0.12));
  const blade = extrude([[0, 0], [0.22, 0.1], [0.3, 0.6], [0.16, 1.05], [0.02, 1.2], [-0.08, 0.6]], 0.06, OBSID);
  blade.position.set(0.5, y0 + 2.75, 0.12);
  g.add(blade);
  g.add(glow(new THREE.OctahedronGeometry(0.09, 0)).translateX(0.5).translateY(y0 + 2.7).translateZ(0.16));
  g.scale.setScalar(1.08);
  return compact(g);
}

/** A pack lizard of a trading caravan: baskets either side, bales lashed on its back, a skink in the saddle. */
export function lizardCaravan(): THREE.Group {
  const lz = packLizard();
  for (const z of [-1, 1]) {
    lz.add(cyl(0.3, 0.24, 0.5, BAMBOO, 7, -0.1, 0.6, z * 0.66));
    lz.add(blob(0.26, z > 0 ? F_YEL : 0xd8452c, -0.1, 1.1, z * 0.66, 1, 0.5, 1));
  }
  lz.add(box(0.9, 0.36, 0.7, THATCH, -0.5, 1.12, 0));
  lz.add(box(0.92, 0.06, 0.1, ROPE_T, -0.5, 1.3, 0));
  lz.add(box(0.6, 0.1, 0.56, PAINT, 0.35, 1.18, 0));
  const man = new THREE.Group();
  skinkFolk(man, 0xd8a030, 3);
  return compact(mounted(lz, man, 1.26));
}

// ---------- carved posts, standards and altars ----------

/** The temple-city's standard: a bamboo pole and crossbar, a long cloth in the owner's colour with a sun-disc on it and feathers along its stepped hem, a plume on top. */
export function featherStandard(color: number, h: number, live = true): THREE.Group {
  const g = new THREE.Group();
  g.add(pole(0, 0, h, 0.08));
  g.add(box(1.4, 0.1, 0.1, WOOD, 0, h - 0.45, 0));
  const cloth = new THREE.Group();
  cloth.add(box(1.1, 1.7, 0.05, color, 0, -1.7, 0));
  cloth.add(box(0.66, 0.3, 0.05, color, 0, -2.0, 0));
  const disc = sunDisc(0.2);
  disc.position.set(0, -0.8, 0.05);
  cloth.add(disc);
  [-0.42, -0.2, 0.2, 0.42].forEach((x, i) => {
    const f = feather(0.5, 0.15, [F_YEL, F_RED, F_TQ, F_YEL][i]);
    f.rotation.z = Math.PI;
    f.position.set(x, Math.abs(x) > 0.3 ? -1.7 : -2.0, 0.03);
    cloth.add(f);
  });
  settle(cloth);
  cloth.position.set(0, h - 0.45, 0.07);
  if (live) {
    cloth.userData.dynamic = true;
    cloth.userData.flag = true;
  }
  g.add(cloth);
  const plume = featherFan(5, 0.6, 1.4, [F_RED, F_YEL, F_TQ, F_YEL, F_RED], 0.15);
  plume.position.y = h;
  g.add(plume);
  return g;
}

/** A carved totem: two painted faces stacked on a post with jade eyes and gold ear-plugs, carved wings, and a feathered serpent's head on top. */
export function serpentTotem(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.2, 0.26, h, WOOD, 6));
  for (const [y, c] of [[h * 0.16, PAINT_TQ], [h * 0.48, PAINT]] as [number, number][]) {
    g.add(box(0.62, 0.7, 0.56, c, 0, y, 0));
    for (const x of [-1, 1]) {
      g.add(glow(new THREE.BoxGeometry(0.12, 0.1, 0.05)).translateX(x * 0.14).translateY(y + 0.46).translateZ(0.29));
      g.add(cyl(0.12, 0.12, 0.06, GOLD, 6, x * 0.33, y + 0.34, 0).rotateZ(Math.PI / 2));
    }
    g.add(box(0.3, 0.08, 0.05, DOORWAY, 0, y + 0.16, 0.29));
  }
  for (const x of [-1, 1]) {
    const w = new THREE.Group();
    w.add(box(0.9, 0.26, 0.06, WOOD_DK, x * 0.45, 0, 0));
    for (let i = 0; i < 3; i++) w.add(box(0.2, 0.16, 0.07, i % 2 ? F_YEL : F_RED, x * (0.3 + i * 0.25), -0.18, 0));
    w.position.set(x * 0.15, h * 0.78, 0);
    w.rotation.z = x * 0.35;
    g.add(w);
  }
  const hd = serpentHead(0.4, 0x7a5a3a, true);
  hd.position.set(0, h - 0.05, -0.2);
  g.add(hd);
  return g;
}

/** A tall post with a feathered serpent carved coiling up it, painted turquoise and banded in gold, its head at the top. */
export function serpentPost(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.18, 0.24, h, WOOD, 6));
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = i * 0.72, y = 0.4 + (i / n) * (h - 1.3);
    g.add(blob(0.17, i % 3 === 0 ? GOLD : PAINT_TQ, Math.cos(a) * 0.3, y, Math.sin(a) * 0.3, 1.25, 0.85, 1.25));
  }
  const hd = serpentHead(0.4, PAINT_TQ, true);
  hd.position.set(0, h - 0.55, 0.05);
  g.add(hd);
  return g;
}

/** A column of stone with a stone serpent coiled round it, a jade band, a stepped capital and the serpent's head on top. */
export function serpentColumn(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.4, 0.35, 1.4, ST_DK));
  g.add(box(1.05, 0.25, 1.05, ST, 0, 0.35, 0));
  g.add(cyl(0.42, 0.48, h, ST, 8, 0, 0.6));
  g.add(glow(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 8)).translateY(0.6 + h * 0.55));
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = i * 0.8, y = 0.8 + (i / n) * (h - 0.8);
    g.add(blob(0.19, i % 4 === 0 ? PAINT : ST_LT, Math.cos(a) * 0.5, y, Math.sin(a) * 0.5, 1.2, 0.8, 1.2));
  }
  g.add(box(1.15, 0.3, 1.15, ST_LT, 0, h + 0.6, 0));
  const hd = serpentHead(0.5, ST, true);
  hd.position.set(0, h + 0.9, -0.25);
  g.add(hd);
  return g;
}

/** A stela: an upright slab carved with panels (a red band, a jade sun, rows of glyphs), under a stepped cap. */
export function stela(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.3, 0.3, 0.8, ST_DK));
  g.add(box(1.0, h, 0.42, ST, 0, 0.3, 0));
  g.add(box(1.12, 0.22, 0.52, ST_LT, 0, 0.3 + h, 0), box(0.7, 0.2, 0.46, ST_LT, 0, 0.52 + h, 0));
  g.add(box(1.02, 0.18, 0.44, PAINT, 0, 0.3 + h * 0.72, 0));
  g.add(glow(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8).rotateX(Math.PI / 2)).translateY(0.3 + h * 0.52).translateZ(0.22));
  for (let i = 0; i < 3; i++) for (const x of [-0.24, 0.24]) g.add(box(0.28, 0.16, 0.05, ST_DK, x, 0.5 + i * 0.28, 0.21));
  return g;
}

/** A stone altar on two steps, a jade idol squatting on it and a bowl of offerings. */
function altar(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.6, 0.3, 1.2, ST_DK), box(1.2, 0.5, 0.9, ST, 0, 0.3, 0));
  g.add(box(1.24, 0.1, 0.94, PAINT, 0, 0.62, 0));
  g.add(glow(new THREE.BoxGeometry(0.34, 0.42, 0.26)).translateY(0.98).translateZ(-0.1));
  g.add(glow(new THREE.BoxGeometry(0.44, 0.24, 0.3)).translateY(1.3).translateZ(-0.1));
  g.add(cyl(0.2, 0.14, 0.14, 0xa8603a, 6, 0.36, 0.8, 0.22));
  g.add(blob(0.12, F_YEL, 0.36, 0.96, 0.22, 1, 0.6, 1));
  return g;
}

/** A ring of stones round a fire. */
function firePit(x: number, z: number, s = 1, live = true): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(blob(0.2 * s, ST_DK, Math.cos(a) * 0.7 * s, 0.08, Math.sin(a) * 0.7 * s, 1.1, 0.7, 1));
  }
  g.add(glow(new THREE.CylinderGeometry(0.44 * s, 0.5 * s, 0.1, 7), COAL, COAL_E).translateY(0.12));
  if (live) {
    const f = flame(1.2 * s);
    f.position.y = 0.14;
    g.add(f);
  } else g.add(stillFlame(1.2 * s).translateY(0.14));
  g.position.set(x, 0, z);
  return g;
}

/** A drying rack of bamboo: fish, hides and strings of peppers hung from a crossbar. */
function dryingRack(): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.9, 0.9]) g.add(pole(x, 0, 1.9, 0.06));
  g.add(limb(V(-1, 1.8, 0), V(1, 1.8, 0), 0.05, 0.05, BAMBOO, 4));
  for (let i = 0; i < 5; i++) {
    const x = -0.7 + i * 0.35;
    g.add(box(0.02, 0.3, 0.02, ROPE_T, x, 1.5, 0));
    g.add(i % 2 ? box(0.16, 0.5, 0.05, i === 3 ? WOOD : ST_LT, x, 1.02, 0) : box(0.08, 0.5, 0.08, F_RED, x, 1.02, 0));
  }
  return g;
}

/** A war drum of the temple-city: a tall hollow log, carved and painted, a lizard-hide head, on three short feet. */
function logDrum(s = 1): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    g.add(box(0.14 * s, 0.3 * s, 0.14 * s, WOOD_DK, Math.cos(a) * 0.36 * s, 0, Math.sin(a) * 0.36 * s));
  }
  g.add(cyl(0.44 * s, 0.4 * s, 1.1 * s, WOOD, 8, 0, 0.25 * s));
  for (const y of [0.45, 0.95]) g.add(cyl(0.46 * s, 0.46 * s, 0.1 * s, y > 0.5 ? PAINT : PAINT_TQ, 8, 0, y * s + 0.25 * s));
  g.add(cyl(0.46 * s, 0.46 * s, 0.06 * s, HIDE_T, 8, 0, 1.35 * s));
  g.add(glow(new THREE.BoxGeometry(0.12 * s, 0.12 * s, 0.04)).translateY(0.95 * s).translateZ(0.44 * s));
  return g;
}

// ---------- water ----------

/** A still pool with a stone rim, lily pads (some flowering) and a reed or two. */
export function pool(r: number, rr: () => number, lilies = 5): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(r, r, 0.1, C.water, 14, 0, 0.02));
  g.add(mesh(new THREE.TorusGeometry(r, 0.2, 4, 16).rotateX(Math.PI / 2), ST_DK).translateY(0.1));
  for (let i = 0; i < lilies; i++) {
    const a = rr() * Math.PI * 2, d = rr() * r * 0.7;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    g.add(bit(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 7, 1, false, 0.4, Math.PI * 1.8), i % 2 ? FROND : FROND_DK).translateX(x).translateY(0.13).translateZ(z));
    if (i % 2 === 0) g.add(bit(new THREE.OctahedronGeometry(0.1, 0), 0xf2b8d0).translateX(x + 0.08).translateY(0.2).translateZ(z));
  }
  return g;
}

/** A waterfall pouring from (0, h) down to the ground: a bright sheet, foam at its foot and a veil of spray. */
function waterfall(w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1).translate(0, h / 2, 0), detailMat(FALL, { emissive: FALL_E, opacity: 0.72 })));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, h, 0.12).translate(0, h / 2, 0.02), detailMat(0xe6fbfa, { emissive: 0x2a7a7a, opacity: 0.55 })));
  for (let i = 0; i < 5; i++) g.add(bit(new THREE.IcosahedronGeometry(0.22 + (i % 2) * 0.1, 0), FOAM).translateX((i - 2) * w * 0.22).translateY(0.1).translateZ(0.25 + (i % 2) * 0.15));
  return g;
}

// ---------- the Saurian King's seat ----------

/**
 * The seat of the Saurian King. A thatched hut on stilts beside a carved serpent totem and a fire; a
 * longhouse on stilts with a veranda, a serpent post and a jade idol's altar; a stepped pyramid with a
 * shrine on top, braziers at the stair foot; a great pyramid, serpent-headed balustrades down its stair,
 * braziers burning at its summit before a temple with a roof comb; and at last the colossus on its
 * terrace: a golden sun-disc turning over the temple, waterfalls pouring from serpents' mouths on its
 * terraces into pools at its foot, serpent columns at its corners and winged lizards wheeling round it.
 */
export function templeHall(t: number, color: number): Built {
  const g = new THREE.Group();
  const r = rng(301 + t);
  if (t === 1) {
    g.add(stiltHut({ w: 5.0, d: 4.0, up: 1.3, h: 1.9, roofH: 2.3, windows: 2, veranda: 0.8 }));
    const tt = serpentTotem(3.8);
    tt.position.set(-3.7, 0, 1.9);
    g.add(tt);
    g.add(firePit(2.9, 2.7, 0.85));
    const st = featherStandard(color, 4.4);
    st.position.set(3.7, 0, -1.3);
    g.add(st);
    g.add(basket(1, F_YEL, -2.1, 2.9), jar(1, -2.7, 3.3), basket(0.8, 0xd8452c, 1.7, 3.5));
    const b = banana(1.1, r);
    b.position.set(-3.3, 0, -1.9);
    g.add(b);
    return { obj: g, h: 7, w: 9, d: 8 };
  }
  if (t === 2) {
    const lh = stiltHut({ w: 8.4, d: 4.2, up: 1.5, h: 2.1, roofH: 2.5, windows: 4, veranda: 1.2, ladderX: -2.1 });
    lh.position.set(0, 0, -0.9);
    g.add(lh);
    const sp = serpentPost(6.2);
    sp.position.set(-5.6, 0, 1.7);
    g.add(sp);
    const al = altar();
    al.position.set(5.0, 0, 2.2);
    g.add(al);
    const st = featherStandard(color, 5.2);
    st.position.set(5.5, 0, -2.0);
    g.add(st);
    const dr = dryingRack();
    dr.position.set(-5.3, 0, -1.6);
    dr.rotation.y = 1.2;
    g.add(dr);
    g.add(firePit(2.4, 3.4, 0.75));
    // the first stones of something greater, cut and stacked ready
    g.add(box(1.0, 0.5, 0.8, ST, 0.6, 0, 3.6), box(0.9, 0.45, 0.8, ST_OLD, -0.3, 0, 3.9), box(0.9, 0.45, 0.7, ST, 0.2, 0.5, 3.7));
    g.add(basket(0.9, F_YEL, 3.4, 3.4), jar(1, 4.0, 3.9));
    return { obj: g, h: 10, w: 13, d: 9 };
  }
  if (t === 3) {
    const py = stepPyramid({ levels: 3, w0: 9.4, d0: 8.2, w1: 5.8, d1: 4.8, stepH: 1.35, cz: -0.8, heads: 0.55, seed: 3, vines: 9 });
    g.add(py.g);
    const sh = shrine(3.8, 3.0, 2.3, { thatch: 2.2, idol: true });
    sh.position.set(0, py.top, py.cz - 0.3);
    g.add(sh);
    for (const x of [-1, 1]) {
      const b = brazier(0.9, true, 0.8);
      b.position.set(x * 2.5, 0, py.front(0) + 0.9);
      g.add(b);
    }
    const hut = stiltHut({ w: 2.0, d: 2.2, up: 1.1, h: 1.5, roofH: 1.6, windows: 1 });
    hut.position.set(-6.4, 0, 0.4);
    hut.rotation.y = 0.5;
    g.add(hut);
    const col = serpentColumn(4.2);
    col.position.set(6.4, 0, 1.6);
    g.add(col);
    const st = featherStandard(color, 5.4);
    st.position.set(6.2, 0, -2.6);
    g.add(st);
    return { obj: g, h: py.top + 5.5, w: 15, d: 10 };
  }
  // the great pyramid, and the colossus
  const big = t === 5;
  const y0 = big ? 0.8 : 0;
  if (big) {
    // the terrace it stands on, a flight of steps up to it
    g.add(box(15.2, y0, 14.4, ST_DK, 0, 0, -0.9));
    g.add(box(15.4, 0.14, 14.6, ST_LT, 0, y0 - 0.1, -0.9));
    g.add(box(15.3, 0.26, 14.5, PAINT, 0, y0 * 0.3, -0.9));
    for (let k = 0; k < 3; k++) g.add(box(4.0, (y0 / 3) * (k + 1), 0.3, ST_LT, 0, 0, 6.8 - k * 0.3));
  }
  const py = big
    ? stepPyramid({ levels: 6, w0: 13.4, d0: 12.4, w1: 6.0, d1: 5.4, stepH: 1.6, cz: -1.4, y0, stairW: 3.0, heads: 1.0, seed: 5, vines: 22 })
    : stepPyramid({ levels: 5, w0: 12.2, d0: 11.8, w1: 5.8, d1: 5.2, stepH: 1.5, cz: -1.0, stairW: 2.8, heads: 0.8, seed: 4, vines: 16 });
  g.add(py.g);
  const tw = big ? 5.0 : 4.4, td = big ? 4.0 : 3.6, th = big ? 3.0 : 2.6;
  const tz = py.cz - 0.4;
  const temple = shrine(tw, td, th, { comb: big ? 3.2 : 2.4, idol: true });
  temple.position.set(0, py.top, tz);
  g.add(temple);
  // braziers at the corners of the summit, the front two burning high
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const b = brazier(0.5, z > 0, z > 0 ? 0.8 : 0.6);
    b.position.set(x * (py.topW / 2 - 0.5), py.top, py.cz + z * (py.topD / 2 - 0.5));
    g.add(b);
  }
  // great braziers flanking the foot of the stair
  for (const x of [-1, 1]) {
    const b = brazier(big ? 1.1 : 1.0, true, big ? 1.0 : 0.9);
    b.position.set(x * (big ? 2.6 : 2.9), y0, py.front(0) + (big ? 0.75 : 1.0));
    g.add(b);
  }
  if (!big) {
    for (const x of [-1, 1]) {
      const s = stela(2.4);
      s.position.set(x * 5.0, 0, 5.9);
      g.add(s);
    }
    const st = featherStandard(color, 3.2);
    st.position.set(py.topW / 2 - 0.6, py.top, py.cz - py.topD / 2 + 0.6);
    g.add(st);
    return { obj: g, h: py.top + th + 4, w: 13, d: 13 };
  }
  // the golden sun-disc over the temple, turning slowly
  const discY = py.top + th + 0.12 + 3.2 * 0.62;
  const disc = sunDisc(1.6, true);
  const spin = new THREE.Group();
  spin.add(disc);
  settle(spin);
  spin.userData.dynamic = true;
  spin.userData.spin = true;
  spin.position.set(0, discY, tz + td / 2 - 1.3);
  g.add(spin);
  // waterfalls pouring from serpents' mouths on the third terrace, down the steps into pools on the terrace
  for (const s of [-1, 1]) {
    const x = s * 4.3;
    const lv = 3;
    const spout = serpentHead(0.55, ST, true);
    spout.position.set(x, y0 + lv * py.stepH - 0.9, py.front(lv) - 0.5);
    g.add(spout);
    for (let k = lv - 1; k >= 0; k--) {
      const yTop = y0 + (k + 1) * py.stepH, yBot = y0 + k * py.stepH;
      const fall = waterfall(1.1, yTop - yBot + (k === lv - 1 ? 0.7 : 0.05));
      fall.position.set(x, yBot, py.front(k) + 0.06);
      g.add(fall);
      const tread = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, py.front(k) - py.front(k + 1) + 0.1), detailMat(FALL, { emissive: FALL_E, opacity: 0.72 }));
      tread.position.set(x, yTop + 0.03, (py.front(k) + py.front(k + 1)) / 2);
      g.add(tread);
    }
    const p = pool(0.72, r, 3);
    p.position.set(x, y0, py.front(0) + 0.8);
    g.add(p);
    // serpent columns at the terrace's front corners
    const col = serpentColumn(4.6);
    col.position.set(s * 6.7, y0, 5.6);
    g.add(col);
    const st = featherStandard(color, 3.6);
    st.position.set(s * (py.topW / 2 - 0.6), py.top, py.cz - py.topD / 2 + 0.6);
    g.add(st);
  }
  // winged lizards circling the summit
  const fl = flock(3, 6.2, py.top + 3, 4, 0.26, 88, 1.25);
  fl.position.set(0, 0, py.cz);
  g.add(fl);
  return { obj: g, h: discY + 3, w: 15, d: 15 };
}

// ---------- the other buildings ----------

/** A stone gateway before a door: two jambs, a lintel banded in red, a stepped crest with jade in it (the building's sign hangs on the lintel). */
function portal(w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-1, 1]) {
    g.add(box(0.62, 0.22, 0.62, ST_DK, x * (w / 2 + 0.25), 0, 0));
    g.add(box(0.48, h, 0.48, ST, x * (w / 2 + 0.25), 0.22, 0));
  }
  g.add(box(w + 1.2, 0.66, 0.6, ST, 0, h + 0.22, 0));
  g.add(box(w + 1.26, 0.18, 0.66, PAINT, 0, h + 0.44, 0));
  g.add(box(w * 0.72, 0.34, 0.5, ST_LT, 0, h + 0.88, 0), box(w * 0.36, 0.3, 0.44, ST_LT, 0, h + 1.22, 0));
  g.add(glow(new THREE.BoxGeometry(0.24, 0.16, 0.06)).translateY(h + 1.05).translateZ(0.26));
  return g;
}

/** A straight fence of lashed bamboo from (x0, z0) to (x1, z1): posts and two rails. */
function fenceLine(g: THREE.Group, x0: number, z0: number, x1: number, z1: number, h = 1.2): void {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(2, Math.round(len / 0.9) + 1);
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    g.add(cyl(0.06, 0.07, h + (i % 2) * 0.12, BAMBOO, 5, x0 + (x1 - x0) * k, 0, z0 + (z1 - z0) * k));
  }
  for (const y of [h * 0.45, h * 0.88]) g.add(limb(V(x0, y, z0), V(x1, y, z1), 0.045, 0.045, BAMBOO_DK, 4));
}

/** A training post: a bamboo stake with a crossbar, a bundle of straw bound with rope, a painted target and a carved head. */
function trainingPost(): THREE.Group {
  const g = new THREE.Group();
  g.add(pole(0, 0, 2.0, 0.07));
  g.add(box(1.1, 0.1, 0.1, BAMBOO_DK, 0, 1.4, 0));
  g.add(blob(0.36, THATCH, 0, 1.12, 0, 1, 1.3, 0.8));
  for (const y of [0.9, 1.3]) g.add(box(0.72, 0.06, 0.62, ROPE_T, 0, y, 0));
  g.add(cyl(0.2, 0.2, 0.04, PAINT, 8, 0, 1.1, 0.28).rotateX(Math.PI / 2));
  g.add(box(0.3, 0.34, 0.3, WOOD, 0, 1.78, 0));
  return g;
}

/** A rack of the host's weapons: obsidian-edged clubs and spears leaning on a bamboo frame. */
function weaponRack(): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.95, 0.95]) g.add(pole(x, 0, 1.5, 0.06));
  g.add(limb(V(-1, 1.3, 0), V(1, 1.3, 0), 0.05, 0.05, BAMBOO_DK, 4));
  for (let i = 0; i < 4; i++) {
    const x = -0.6 + i * 0.4;
    const w = new THREE.Group();
    if (i % 2) {
      w.add(box(0.05, 1.7, 0.05, BAMBOO));
      w.add(cone(0.06, 0.3, OBSID, 4, 0, 1.7, 0));
    } else {
      w.add(box(0.12, 1.2, 0.04, WOOD));
      for (let k = 0; k < 3; k++) for (const s of [-1, 1]) w.add(box(0.05, 0.1, 0.04, OBSID, s * 0.08, 0.6 + k * 0.18, 0));
    }
    w.position.set(x, 0, 0.12);
    w.rotation.x = -0.12;
    g.add(w);
  }
  return g;
}

/** Barracks: the warriors' hall behind a stone portal, and before it a paved training plaza where saurus spar and skinks drill. */
function barracks(t: number, color: number): Built {
  const g = new THREE.Group();
  const hall = saurianHouse({ w: 7, d: 4.4, h: 2.4, roofH: 2.0, windows: 2, stone: t === 3, over: 0.4 });
  hall.position.z = -0.5;
  g.add(hall);
  const pt = portal(1.6, 2.5);
  pt.position.set(0, 0, 2.3);
  g.add(pt);
  // the plaza: paved, curbed, a gold sun inlaid at its heart, jade-capped pillars at its corners
  const cz = 6.35;
  g.add(box(8.0, 0.12, 5.6, ST_LT, 0, 0, cz));
  for (const [x, z, w, d] of [[0, cz - 2.8, 8.0, 0.3], [0, cz + 2.8, 8.0, 0.3], [-4.0, cz, 0.3, 5.9], [4.0, cz, 0.3, 5.9]] as [number, number, number, number][]) g.add(box(w, 0.26, d, ST_DK, x, 0, z));
  g.add(mesh(new THREE.TorusGeometry(1.1, 0.12, 3, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 8), GOLD).translateY(0.14).translateZ(cz));
  g.add(glow(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 8)).translateY(0.13).translateZ(cz));
  for (const x of [-3.8, 3.8]) for (const z of [cz - 2.6, cz + 2.6]) {
    g.add(box(0.5, 1.1, 0.5, ST, x, 0, z));
    g.add(glow(new THREE.BoxGeometry(0.34, 0.2, 0.34)).translateX(x).translateY(1.2).translateZ(z));
  }
  // the fighters
  const a = saurianSoldier('sword', 0);
  a.position.set(-1.0, 0.12, cz + 0.2);
  a.rotation.y = Math.PI / 2 - 0.2;
  g.add(a);
  const b = saurianSoldier('axe', 1);
  b.position.set(1.1, 0.12, cz);
  b.rotation.y = -Math.PI / 2 + 0.2;
  g.add(b);
  const tp = trainingPost();
  tp.position.set(2.5, 0.12, cz + 1.9);
  g.add(tp);
  const sk = saurianSoldier('spear', 2);
  sk.position.set(2.5, 0.12, cz + 0.9);
  g.add(sk);
  const rack = weaponRack();
  rack.position.set(-2.6, 0.12, cz + 1.9);
  g.add(rack);
  if (t >= 2) {
    const wing = stiltHut({ w: 4.4, d: 3.0, up: 0.9, h: 1.8, roofH: 1.8, windows: 1 });
    wing.position.set(-6.1, 0, 0.3);
    wing.rotation.y = Math.PI / 2;
    g.add(wing);
    const st = featherStandard(color, 4.6);
    st.position.set(3.6, 0, 2.3);
    g.add(st);
  }
  if (t >= 3) {
    for (const x of [-3.2, 3.2]) {
      const br = brazier(0.7, true, 0.7);
      br.position.set(x, 0.12, cz + 2.0);
      g.add(br);
    }
    const d = logDrum(0.75);
    d.position.set(-3.1, 0, 2.6);
    g.add(d);
  }
  return { obj: g, h: 7.5, w: 9, d: 8 };
}

/** Stable: a long low stall-house of stone and thatch, and before it pens of lashed bamboo where the raptors pace and a horned beast stands. */
function stable(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const hs = saurianHouse({ w: 9, d: 3.8, h: 2.0, roofH: 1.5, windows: 0, door: false, over: 0.35 });
  hs.position.z = -0.4;
  g.add(hs);
  for (const x of [-2.9, 2.9]) {
    g.add(box(1.6, 1.6, 0.1, DOORWAY, x, 0.6, 1.52));
    g.add(box(2.0, 0.24, 0.3, ST_LT, x, 2.2, 1.56));
  }
  const pt = portal(1.3, 2.1);
  pt.position.set(0, 0, 1.95);
  g.add(pt);
  // the pens
  const z0 = 2.7, z1 = 7.1;
  fenceLine(g, -4.1, z1, 4.1, z1);
  fenceLine(g, -4.1, z0, -4.1, z1);
  fenceLine(g, 4.1, z0, 4.1, z1);
  if (t >= 2) fenceLine(g, 1.1, z0, 1.1, z1);
  const nr = t >= 3 ? 3 : 2;
  const cols = [0xa8784a, 0x56697a, 0x8a2e26];
  for (let i = 0; i < nr; i++) {
    const rp = raptor(cols[i], i === 1 ? 0xf2a03a : F_RED, null);
    rp.scale.setScalar(0.7);
    const left = t >= 2;
    rp.position.set(left ? -1.4 + (i % 2) * 0.4 : -1.8 + i * 3.2, 0, 3.7 + i * 1.3);
    rp.rotation.y = (i % 2 ? Math.PI : 0) + (r() - 0.5) * 0.4;
    rp.userData.mount = true;
    g.add(rp);
  }
  if (t >= 2) {
    const hb = hornedBeast();
    hb.scale.setScalar(0.6);
    hb.position.set(2.6, 0, 5.1);
    hb.rotation.y = -Math.PI / 2 + 0.2;
    hb.userData.mount = true;
    g.add(hb);
    // a stone water trough
    g.add(box(1.4, 0.4, 0.5, ST_DK, 2.6, 0, 3.2));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.34).translate(0, 0.4, 0), detailMat(C.water)).translateX(2.6).translateZ(3.2));
  }
  // a trough of meat for the raptors, and fern fodder heaped by the stalls
  g.add(box(1.2, 0.3, 0.46, WOOD, -3.0, 0, 3.2));
  g.add(blob(0.2, PAINT, -3.2, 0.36, 3.2, 1.4, 0.6, 1), blob(0.16, F_RED, -2.8, 0.36, 3.2, 1.3, 0.6, 1));
  if (t >= 3) {
    for (const x of [-4.4, 4.4]) g.add(ferns(1.1, r).translateX(x).translateZ(2.2));
    const post = serpentTotem(2.6);
    post.scale.setScalar(0.8);
    post.position.set(-4.5, 0, 7.4);
    g.add(post);
  }
  return { obj: g, h: 6, w: 10, d: 10 };
}

/** The temple slinger's frame: two log runners, an A-frame of lashed bamboo, a basket of stones behind, a sun-disc on its brow. Faces +z. */
export function slingerFrame(): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.62, 0.62]) g.add(box(0.28, 0.28, 3.0, WOOD, x, 0, 0));
  for (const z of [-1.1, 0.1, 1.1]) g.add(box(1.6, 0.18, 0.22, WOOD_DK, 0, 0.28, z));
  for (const x of [-0.55, 0.55]) {
    g.add(bamboo(V(x, 0.4, 1.0), V(x * 0.8, 2.1, 0.3), 0.11));
    g.add(bamboo(V(x, 0.4, -0.5), V(x * 0.8, 2.1, 0.3), 0.11));
  }
  g.add(box(1.2, 0.2, 0.26, BAMBOO_DK, 0, 1.95, 0.3));
  for (const x of [-0.46, 0.46]) g.add(cyl(0.14, 0.14, 0.12, ROPE_T, 6, x, 2.0, 0.3).rotateZ(Math.PI / 2));
  const disc = sunDisc(0.26);
  disc.position.set(0, 2.2, 0.48);
  g.add(disc);
  g.add(basket(1.1, ST_DK, 0, -1.1, 0.46));
  return g;
}

/** The slinger's throwing arm (its pivot at the origin): a lashed bamboo beam, a net pouch at its end with a glowing sunstone in it. */
export function slingerArm(): { arm: THREE.Group; ammo: THREE.Object3D } {
  const arm = new THREE.Group();
  arm.add(box(0.2, 3.1, 0.2, BAMBOO, 0, -0.4, 0));
  for (const y of [0.2, 1.3, 2.2]) arm.add(box(0.26, 0.08, 0.26, ROPE_T, 0, y, 0));
  arm.add(box(0.6, 0.5, 0.5, ST_DK, 0, -0.8, 0));
  arm.add(cyl(0.3, 0.2, 0.26, ROPE_T, 6, 0, 2.62, 0));
  const ammo = sunstone();
  ammo.position.set(0, 3.0, 0);
  arm.add(ammo);
  return { arm, ammo };
}

/** A sunstone: a round stone clad in beaten gold, a glowing heart showing through its cracks. */
export function sunstone(): THREE.Group {
  const g = new THREE.Group();
  g.add(blob(0.36, 0xd8a848, 0, 0, 0, 1, 0.92, 1));
  g.add(glow(new THREE.IcosahedronGeometry(0.28, 0), 0xffd060, 0x9a6410).translateY(0.08));
  return g;
}

/** Workshop: an open shed of great bamboo under palm thatch, the temple slinger standing in it; a bonehead tethered out front with its handler. */
function workshop(t: number, r: () => number): Built {
  const g = new THREE.Group();
  for (const [x, z] of [[-3.3, -1.9], [3.3, -1.9], [-3.3, 1.8], [3.3, 1.8]]) g.add(pole(x, z, 3.2, 0.17));
  g.add(box(6.8, 2.4, 0.12, WATTLE, 0, 0, -2.05));
  for (let i = 0; i < 9; i++) g.add(box(0.08, 2.4, 0.06, BAMBOO_DK, -3.2 + i * 0.8, 0, -1.97));
  const roof = thatchRoof(6.8, 3.9, 1.5, { over: 0.2 });
  roof.position.set(0, 3.15, -0.05);
  g.add(roof);
  const sf = slingerFrame();
  sf.position.set(0.3, 0, 0.1);
  g.add(sf);
  const { arm } = slingerArm();
  arm.position.set(0.3, 1.25, 0.4);
  arm.rotation.x = -1.0;
  g.add(arm);
  if (t >= 2) {
    const bh = bonehead();
    bh.scale.setScalar(0.8);
    bh.position.set(-1.0, 0, 4.2);
    bh.rotation.y = -Math.PI / 2 + 0.3;
    g.add(bh);
    const sk = new THREE.Group();
    skinkFolk(sk, 0x2c5cb8, 5);
    sk.add(cyl(0.03, 0.03, 1.5, BAMBOO, 4, 0.3, 0.1, 0.1));
    sk.position.set(0.6, 0, 4.4);
    sk.rotation.y = -0.8;
    g.add(sk);
  }
  // sunstones heaped for throwing, and a bundle of bamboo for the next engine
  for (let i = 0; i < 5; i++) g.add(blob(0.3 + r() * 0.08, i % 2 ? 0xd8a848 : GOLD_DK, 4.8 + (i % 3) * 0.5 - 0.4, 0.28, 1.2 + Math.floor(i / 3) * 0.6 - 0.3));
  for (let i = 0; i < 5; i++) g.add(limb(V(4.6 + (i % 3) * 0.2, 0.1 + Math.floor(i / 3) * 0.18, -1.9), V(4.6 + (i % 3) * 0.2, 0.1 + Math.floor(i / 3) * 0.18, 0.4), 0.08, 0.08, BAMBOO, 5));
  return { obj: g, h: 6, w: 9, d: 8 };
}

/** Academy: the house of the sun priests (a long stone hall with a roof comb) and the tower of the sky-readers, a gold orrery turning over a jade sphere on its top. */
function academy(): Built {
  const g = new THREE.Group();
  const hall = saurianHouse({ w: 9.0, d: 5.6, h: 3.2, roofH: 2.4, stone: true, windows: 3 });
  hall.position.x = -0.6;
  g.add(hall);
  for (let k = 0; k < 3; k++) g.add(box(2.4 - k * 0.3, 0.2 * (k + 1), 0.3, ST_LT, -0.6, 0, 3.5 - k * 0.3));
  const tw = saurianTower(1.7, 9.8, { roof: null });
  tw.position.set(6.2, 0, 0);
  g.add(tw);
  const orr = new THREE.Group();
  orr.add(glow(new THREE.IcosahedronGeometry(0.42, 1)));
  for (const [rx, rz, rad] of [[Math.PI / 2, 0, 1.0], [0.4, 0.5, 0.86], [1.2, -0.7, 0.74]] as [number, number, number][]) {
    const ring = mesh(new THREE.TorusGeometry(rad, 0.05, 4, 24), GOLD);
    ring.rotation.set(rx, 0, rz);
    orr.add(ring);
  }
  orr.add(glow(new THREE.OctahedronGeometry(0.14, 0), 0xffd060, 0x9a6410).translateX(1.0));
  settle(orr);
  orr.userData.dynamic = true;
  orr.userData.orbit = 0.45;
  orr.position.set(6.2, 9.8 + 0.26 + 1.35, 0);
  g.add(orr);
  g.add(box(0.5, 0.9, 0.5, ST_LT, 6.2, 9.8 + 0.26, 0));
  for (const x of [-2.2, 1.0]) {
    const b = brazier(0.5, false, 0.55);
    b.position.set(x, 0, 3.35);
    g.add(b);
  }
  return { obj: g, h: 15, w: 14, d: 8 };
}

/** Smithy: the obsidian forge. A workshop of stone and thatch, a stone flue smoking over it; out front a kiln glowing, a knapping bench of black glass cores and blades, and at the highest levels a jade grinding wheel. */
function smithy(t: number): Built {
  const g = new THREE.Group();
  const hs = saurianHouse({ w: 6, d: 4.0, h: 2.4, roofH: 1.9, windows: 1, over: 0.35 });
  hs.position.z = -0.6;
  g.add(hs);
  const pt = portal(1.3, 2.4);
  pt.position.set(0, 0, 1.9);
  g.add(pt);
  g.add(box(0.9, 5.6, 0.9, ST_DK, 1.8, 0, -1.4));
  g.add(box(1.1, 0.2, 1.1, ST_LT, 1.8, 5.6, -1.4));
  const smoke = new THREE.Object3D();
  smoke.userData.dynamic = true;
  smoke.userData.smoke = true;
  smoke.position.set(1.8, 6.0, -1.4);
  g.add(smoke);
  // the kiln: a dome of stone, its mouth glowing
  const kx = -2.3, kz = 2.9;
  g.add(cyl(0.95, 1.05, 0.9, ST_DK, 8, kx, 0, kz));
  g.add(mesh(new THREE.SphereGeometry(0.95, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), ST).translateX(kx).translateY(0.9).translateZ(kz));
  g.add(glow(new THREE.BoxGeometry(0.6, 0.5, 0.12), COAL, COAL_E).translateX(kx).translateY(0.5).translateZ(kz + 0.96));
  // the knapping bench: black cores, blades laid out in rows, a hammerstone
  g.add(box(1.5, 0.7, 0.8, ST, 0.5, 0, 3.0));
  for (let i = 0; i < 3; i++) {
    const c = mesh(new THREE.OctahedronGeometry(0.16, 0), OBSID);
    c.position.set(0.0 + i * 0.3, 0.84, 2.84);
    c.scale.set(1, 1.3, 1);
    g.add(c);
  }
  for (let i = 0; i < 5; i++) g.add(box(0.07, 0.03, 0.34, i % 2 ? OBSID_LT : OBSID, 0.2 + i * 0.16, 0.71, 3.2));
  g.add(blob(0.1, ST_LT, 1.1, 0.8, 2.9));
  if (t >= 2) {
    const rack = weaponRack();
    rack.position.set(2.9, 0, 3.0);
    rack.scale.setScalar(0.8);
    g.add(rack);
  }
  if (t >= 3) {
    const wh = new THREE.Group();
    wh.add(mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.2, 10).rotateX(Math.PI / 2), ST_LT));
    wh.add(glow(new THREE.CylinderGeometry(0.22, 0.22, 0.24, 8).rotateX(Math.PI / 2)));
    settle(wh);
    wh.userData.dynamic = true;
    wh.userData.spin = true;
    wh.position.set(-3.3, 1.0, 0.9);
    wh.rotation.y = Math.PI / 2;
    g.add(wh);
    for (const z of [0.6, 1.2]) g.add(pole(-3.3, z, 1.2, 0.05));
    g.add(glow(new THREE.BoxGeometry(0.2, 0.2, 0.2)).translateX(-3.3).translateY(0.2).translateZ(1.6));
  }
  return { obj: g, h: 7, w: 8, d: 7 };
}

/** Rally point: the war standard raised on a stone step, a great fire-bowl burning, log drums round it and serpent stones. */
function rally(color: number): Built {
  const g = new THREE.Group();
  g.add(box(1.5, 0.3, 1.5, ST, 0, 0, 0));
  g.add(glow(new THREE.BoxGeometry(1.1, 0.04, 1.1)).translateY(0.31));
  const st = featherStandard(color, 7.4);
  st.position.y = 0.3;
  g.add(st);
  // the fire bowl
  g.add(cyl(1.0, 1.1, 0.35, ST_DK, 8, 2.6, 0, 1.6));
  g.add(cyl(0.9, 0.6, 0.5, ST, 8, 2.6, 0.35, 1.6));
  g.add(glow(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 8), COAL, COAL_E).translateX(2.6).translateY(0.8).translateZ(1.6));
  const f = flame(1.3);
  f.position.set(2.6, 0.84, 1.6);
  g.add(f);
  for (const [x, z] of [[1.2, 3.2], [4.2, 2.6], [3.8, -0.2]] as [number, number][]) {
    const d = logDrum(0.7);
    d.position.set(x, 0, z);
    g.add(d);
  }
  for (const [x, z, a] of [[-0.3, 1.8, 0.3], [1.8, -0.5, -0.6]] as [number, number, number][]) {
    g.add(box(0.8, 0.5, 0.8, ST_DK, x, 0, z));
    const hd = serpentHead(0.36, ST, true);
    hd.position.set(x, 0.5, z);
    hd.rotation.y = a;
    g.add(hd);
  }
  return { obj: g, h: 10, w: 6, d: 6 };
}

/** The Saurian King's statue: the king in beaten gold on his great raptor of carved jade, on a stepped plinth banded in red, braziers at its front corners. */
function statue(): Built {
  const g = new THREE.Group();
  g.add(box(4.4, 0.4, 4.4, ST_DK));
  g.add(box(3.7, 0.5, 3.7, ST, 0, 0.4, 0));
  g.add(box(3.0, 1.1, 3.0, ST_LT, 0, 0.9, 0));
  g.add(box(3.06, 0.24, 3.06, PAINT, 0, 1.3, 0));
  for (let s = 0; s < 4; s++) {
    const a = (s / 4) * Math.PI * 2;
    g.add(glow(new THREE.BoxGeometry(0.4, 0.4, 0.06)).translateX(Math.sin(a) * 1.53).translateY(1.0).translateZ(Math.cos(a) * 1.53).rotateY(a));
  }
  g.add(box(3.2, 0.2, 3.2, ST, 0, 2.0, 0));
  const JD = JADE_DK, GD = GOLD;
  const rp = raptor(JD, GD, GD);
  rp.rotation.y = -Math.PI / 2;
  rp.scale.setScalar(0.92);
  rp.position.set(0, 2.2, 0.28);
  g.add(rp);
  const man = new THREE.Group();
  saurusBody(man, GD, { skin: GD, crest: GD, gold: true });
  const hd = featherFan(7, 1.0, 2.2, [GD, JD, GD, JD, GD, JD, GD], 0.2);
  hd.position.set(0, 1.58, -0.02);
  hd.rotation.x = -0.25;
  man.add(hd);
  man.add(cyl(0.05, 0.055, 2.6, JD, 6, 0.5, 0.4, 0.12));
  const blade = extrude([[0, 0], [0.22, 0.1], [0.3, 0.6], [0.16, 1.05], [0.02, 1.2], [-0.08, 0.6]], 0.06, GD);
  blade.position.set(0.5, 2.95, 0.12);
  man.add(blade);
  man.scale.setScalar(0.8);
  man.position.set(0, 2.2 + 1.5 * 0.92, 0.18);
  g.add(man);
  for (const x of [-1, 1]) {
    const b = brazier(0.3, false, 0.45);
    b.position.set(x * 1.95, 0, 1.95);
    g.add(b);
  }
  return { obj: g, h: 7.6, w: 5, d: 5 };
}

/** A stall on stilts at the river's edge: a plank deck, a palm-thatch roof on four posts, baskets and jars and cloth on show. */
function marketStall(goods: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.9, 0.9]) for (const z of [-0.7, 0.7]) g.add(pole(x, z, 2.4, 0.07));
  g.add(box(2.2, 0.14, 1.8, WOOD, 0, 0.55, 0));
  const roof = thatchRoof(2.0, 1.6, 1.0, { over: 0.25, knot: false });
  roof.position.y = 2.4;
  g.add(roof);
  g.add(basket(0.8, goods, -0.5, 0.3, 0.69), basket(0.7, [F_YEL, 0xd8452c, FROND][Math.floor(r() * 3)], 0.1, 0.4, 0.69));
  g.add(jar(0.7, 0.6, -0.3, 0.69));
  g.add(box(0.5, 0.18, 0.4, [F_TQ, F_RED, F_YEL][Math.floor(r() * 3)], 0.5, 0.69, 0.35));
  return g;
}

/** A dugout canoe, its cargo and a skink at the paddle. */
function canoe(k: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.4, 0.34, 0.66, WOOD, 0, 0, 0));
  for (const s of [-1, 1]) {
    const e = cone(0.33, 0.6, WOOD, 4, s * 1.5, 0.17, 0);
    e.rotation.z = -s * Math.PI / 2;
    e.scale.set(1, 1, 0.9);
    g.add(e);
  }
  g.add(box(2.2, 0.04, 0.46, WOOD_DK, 0, 0.32, 0));
  g.add(basket(0.7, k % 2 ? F_YEL : 0xd8452c, 0.5, 0, 0.2), jar(0.6, 0.0, 0.1, 0.2));
  const sk = new THREE.Group();
  skinkFolk(sk, [F_TQ, F_YEL, F_RED][k % 3], k + 2);
  sk.scale.setScalar(0.7);
  sk.position.set(-0.8, 0.1, 0);
  sk.rotation.y = Math.PI / 2;
  g.add(sk);
  g.add(limb(V(-0.5, 0.2, 0.45), V(-0.9, 1.0, 0.2), 0.03, 0.03, WOOD_DK, 4));
  return g;
}

/** Market: a river runs through the plot, stalls on stilts along its banks, canoes laden with fruit on the water, a plank bridge, and a caravan's pack lizard. */
function market(t: number, r: () => number): Built {
  const g = new THREE.Group();
  g.add(box(9.4, 0.05, 2.6, EARTH_DK, 0, 0, 0.9));
  g.add(box(9.2, 0.09, 2.1, C.water, 0, 0, 0.9));
  for (let i = 0; i < 10; i++) {
    const x = -4.4 + i * 0.95 + r() * 0.3, z = i % 2 ? -0.35 : 2.15;
    g.add(cone(0.05, 0.7 + r() * 0.3, FROND, 3, x, 0, z));
  }
  const spots: [number, number, number][] = [[-2.9, -1.1, 0.08], [0.5, -1.2, -0.06], [3.6, -1.0, 0.1], [-0.6, 3.5, Math.PI + 0.05]];
  const n = Math.min(4, t + 1);
  const goods = [F_YEL, 0xd8452c, FROND, F_YEL];
  for (let i = 0; i < n; i++) {
    const s = marketStall(goods[i], r);
    s.position.set(spots[i][0], 0, spots[i][1]);
    s.rotation.y = spots[i][2];
    g.add(s);
  }
  const c1 = canoe(0);
  c1.position.set(-1.2, 0.04, 1.0);
  c1.rotation.y = 0.12;
  g.add(c1);
  if (t >= 3) {
    const c2 = canoe(1);
    c2.position.set(2.8, 0.04, 0.8);
    c2.rotation.y = Math.PI - 0.15;
    g.add(c2);
    // a plank bridge over the river, rope rails
    for (let i = 0; i < 7; i++) g.add(box(1.2, 0.08, 0.36, i % 2 ? WOOD : WOOD, -4.1, 0.28 + Math.sin((i / 6) * Math.PI) * 0.2, -0.2 + i * 0.4));
    for (const x of [-4.7, -3.5]) {
      for (const z of [-0.3, 2.3]) g.add(pole(x, z, 1.2, 0.05));
      g.add(limb(V(x, 1.1, -0.3), V(x, 1.2, 2.3), 0.025, 0.025, ROPE_T, 3));
    }
  }
  if (t >= 4) {
    const c3 = canoe(2);
    c3.position.set(0.9, 0.04, 1.2);
    c3.rotation.y = -0.1;
    g.add(c3);
    const lc = lizardCaravan();
    lc.scale.setScalar(0.72);
    lc.position.set(1.9, 0, 4.4);
    lc.rotation.y = Math.PI / 2;
    g.add(lc);
  }
  // wares laid out on a mat on the near bank
  g.add(box(1.8, 0.03, 1.1, PAINT, -3.1, 0, 3.8));
  g.add(basket(0.7, F_YEL, -3.6, 3.7), basket(0.6, FROND, -2.7, 3.9), jar(0.7, -3.2, 4.4));
  const bn = banana(0.7, r);
  bn.position.set(4.2, 0, 4.0);
  g.add(bn);
  return { obj: g, h: 5, w: 10, d: 8 };
}

/** A round granary on stilts: woven walls under a tall cone of thatch, a ladder to its door. */
function granary(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(pole(Math.cos(a) * 1.2, Math.sin(a) * 1.2, 1.3, 0.1));
  }
  g.add(cyl(1.6, 1.6, 0.2, WOOD, 10, 0, 1.2));
  g.add(cyl(1.35, 1.4, 1.8, WATTLE, 10, 0, 1.4));
  g.add(cyl(1.42, 1.42, 0.14, BAMBOO_DK, 10, 0, 2.1));
  g.add(box(0.7, 1.1, 0.1, DOORWAY, 0, 1.45, 1.36));
  g.add(cone(2.1, 1.2, THATCH_DK, 10, 0, 3.1));
  g.add(cone(1.8, 2.0, THATCH, 10, 0, 3.25));
  g.add(cone(0.3, 0.5, THATCH_DK, 5, 0, 5.1));
  const lad = ladder(1.4);
  lad.position.set(0, 0, 1.9);
  g.add(lad);
  return g;
}

/** Warehouse: a storehouse of stone under a great thatch (a flat roof and roof comb at the highest levels), its heavy timber door in a stone portal; jars and baskets stacked in rows; a round granary on stilts behind it. */
function warehouse(t: number): Built {
  const g = new THREE.Group();
  const hs = saurianHouse({ w: 8, d: 5.2, h: 2.8, roofH: 2.2, windows: 0, door: false, stone: t === 3, over: 0.4 });
  hs.position.z = 0.1;
  g.add(hs);
  g.add(box(2.2, 2.2, 0.12, WOOD_DK, 0, 0.6, 2.78));
  for (const y of [1.2, 2.2]) g.add(box(2.24, 0.1, 0.06, GOLD_DK, 0, y, 2.86));
  if (t >= 3) g.add(glow(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 8).rotateX(Math.PI / 2)).translateY(1.7).translateZ(2.9));
  const pt = portal(2.3, 2.9);
  pt.position.set(0, 0, 3.15);
  g.add(pt);
  for (let i = 0; i < 3 + t; i++) {
    const x = 4.7 + (i % 2) * 0.8, z = 2.6 - Math.floor(i / 2) * 0.85;
    g.add(i % 3 === 0 ? jar(1.1, x, z) : basket(1.1, [F_YEL, 0xd8452c, THATCH][i % 3], x, z));
  }
  for (const [x, z] of [[-4.6, 2.6], [-4.7, 1.6], [-4.5, 0.7]] as [number, number][]) g.add(jar(1.0, x, z));
  if (t >= 2) {
    const gr = granary();
    gr.position.set(-2.0, 0, -5.9);
    g.add(gr);
  }
  return { obj: g, h: 8, w: 10, d: 8 };
}

/** Hiding place: a pit under a stone slab, pushed half aside, ferns and bromeliads round it; later a stone serpent guards it. */
function hiding(t: number, r: () => number): Built {
  const g = new THREE.Group();
  g.add(box(2.2, 0.36, 1.9, ST_DK, 0.2, 0, -0.4));
  g.add(box(1.6, 0.02, 1.3, DOORWAY, 0.2, 0.36, -0.4));
  const lid = box(1.5, 0.16, 1.2, ST, 0, 0, 0);
  lid.position.set(0.55, 0.38, -0.2);
  lid.rotation.set(0.05, 0.25, 0.06);
  g.add(lid);
  g.add(glow(new THREE.BoxGeometry(0.3, 0.03, 0.3)).translateX(0.55).translateY(0.56).translateZ(-0.2));
  g.add(ferns(0.9, r).translateX(-0.9).translateZ(0.4), bromeliad(0.7).translateX(1.5).translateZ(0.5), ferns(0.8, r).translateX(1.4).translateZ(-1.4));
  if (t >= 2) {
    g.add(box(0.8, 0.7, 0.9, ST, -0.8, 0, -1.3));
    const hd = serpentHead(0.55, ST_OLD, true);
    hd.position.set(-0.8, 0.7, -1.4);
    g.add(hd);
    const v = vine(1.0, 3);
    v.position.set(-0.8, 1.9, -1.25);
    g.add(v);
  }
  return { obj: g, h: t >= 2 ? 3.4 : 2.2, w: 3, d: 3 };
}

/**
 * Watchtower: a tall square tower of stone in three stepped stages, a parapet round a lookout deck, a
 * thatched roof on four posts over it and a jade beacon on its peak; the owner's banner hanging down
 * its front. (The lookout stands on the deck at h * 0.9, as in every other village.)
 */
function watchtower(t: number, color: number): Built {
  const g = new THREE.Group();
  const h = 7 + t * 1.6;
  const deck = h * 0.9;
  const stages: [number, number, number][] = [[0, h * 0.42, 1.7], [h * 0.42, h * 0.74, 1.46], [h * 0.74, deck - 0.11, 1.28]];
  g.add(box(4.0, 0.4, 4.0, ST_DK));
  stages.forEach(([y0, y1, hw], i) => {
    g.add(box(hw * 2, y1 - y0, hw * 2, i === 1 ? ST_OLD : ST, 0, y0, 0));
    g.add(box(hw * 2 + 0.16, 0.2, hw * 2 + 0.16, ST_LT, 0, y1 - 0.2, 0));
    if (i < 2) g.add(box(hw * 2 + 0.04, 0.3, hw * 2 + 0.04, PAINT, 0, y1 - 0.6, 0));
    for (let s = 0; s < 4; s++) {
      const a = (s / 4) * Math.PI * 2;
      const sl = box(0.22, 0.7, 0.1, C.window, Math.sin(a) * (hw + 0.01), (y0 + y1) / 2 - 0.2, Math.cos(a) * (hw + 0.01));
      sl.rotation.y = a;
      sl.userData.window = true;
      g.add(sl);
    }
  });
  // the deck and its parapet
  g.add(box(3.7, 0.22, 3.7, ST_LT, 0, deck - 0.11, 0));
  for (let s = 0; s < 4; s++) for (const k of [-1, 0, 1]) {
    const a = (s / 4) * Math.PI * 2;
    const m = box(0.8, 0.5, 0.18, ST, 0, 0, 0);
    m.position.set(Math.sin(a) * 1.76 + Math.cos(a) * k * 1.15, deck + 0.11, Math.cos(a) * 1.76 - Math.sin(a) * k * 1.15);
    m.rotation.y = a;
    g.add(m);
  }
  // a pavilion of four stone pillars over the deck, a stepped stone roof and a pierced crest, jade set in its eaves
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    g.add(box(0.42, 2.1, 0.42, ST, x * 1.45, deck + 0.11, z * 1.45));
    g.add(glow(new THREE.BoxGeometry(0.2, 0.2, 0.2)).translateX(x * 1.45).translateY(deck + 1.7).translateZ(z * 1.45));
  }
  const ry = deck + 2.2;
  g.add(box(3.8, 0.34, 3.8, ST_LT, 0, ry, 0));
  g.add(box(3.86, 0.2, 3.86, PAINT, 0, ry + 0.34, 0));
  g.add(box(3.0, 0.4, 3.0, ST, 0, ry + 0.54, 0));
  g.add(box(2.1, 0.36, 2.1, ST_LT, 0, ry + 0.94, 0));
  const comb = roofComb(1.9, 1.2);
  comb.position.set(0, ry + 1.3, 0);
  g.add(comb);
  // the jade beacon on its peak: a great crystal in a gold cradle (bigger as the tower grows)
  const bs = 0.7 + t * 0.1;
  const top = ry + 1.3 + 1.2 * 1.03;
  g.add(cyl(0.3 * bs, 0.2 * bs, 0.3 * bs, GOLD, 6, 0, top));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.add(cone(0.05, 0.5 * bs, GOLD, 4, Math.cos(a) * 0.28 * bs, top + 0.25 * bs, Math.sin(a) * 0.28 * bs));
  }
  const cr = glow(new THREE.OctahedronGeometry(0.34 * bs, 0));
  cr.scale.set(1, 1.7, 1);
  cr.position.y = top + 0.7 * bs;
  g.add(cr);
  // the banner down the front, and a ladder up the side to the first stage
  const f = new THREE.Group();
  f.add(box(1.1, 0.1, 0.1, WOOD, 0, 0, 0));
  f.add(box(0.9, h * 0.3, 0.05, color, 0, -h * 0.3, 0.02));
  const disc = sunDisc(0.2);
  disc.position.set(0, -h * 0.13, 0.06);
  f.add(disc);
  for (const x of [-0.3, 0, 0.3]) {
    const fe = feather(0.4, 0.14, x ? F_YEL : F_RED);
    fe.rotation.z = Math.PI;
    fe.position.set(x, -h * 0.3, 0.03);
    f.add(fe);
  }
  f.position.set(0, h * 0.72, 1.48);
  g.add(f);
  return { obj: g, h: top + 2, w: 4, d: 4 };
}

// ---------- the workplaces out in the jungle ----------

const BARK = 0x7c6d56, BARK_DK = 0x5e5040, LOG_END = 0xd8a66a;

/** The temple-city's mark on a post by a workplace's track: a carved block with jade eyes, a plume of feathers and a little clay lamp. */
export function saurianPost(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.08, 0.1, h, WOOD, 5));
  g.add(box(0.34, 0.4, 0.34, PAINT_TQ, 0, h - 0.7, 0));
  for (const x of [-0.08, 0.08]) g.add(glow(new THREE.BoxGeometry(0.06, 0.05, 0.04)).translateX(x).translateY(h - 0.45).translateZ(0.18));
  const fan = featherFan(3, 0.45, 0.8, [F_RED, F_YEL, F_RED], 0.14);
  fan.position.y = h;
  g.add(fan);
  g.add(box(0.5, 0.06, 0.06, WOOD, 0.22, h - 0.2, 0));
  g.add(box(0.02, 0.22, 0.02, ROPE_T, 0.42, h - 0.4, 0));
  g.add(cyl(0.1, 0.08, 0.12, 0xa8603a, 5, 0.42, h - 0.56, 0));
  const lamp = box(0.12, 0.12, 0.12, C.window, 0.42, h - 0.5, 0);
  lamp.userData.window = true;
  g.add(lamp);
  return g;
}

/** A giant of the jungle: a pale trunk on flaring buttress roots, boughs spreading into a broad flat crown, lianas hanging from it. */
function giantTree(s: number, r: () => number, crown = true): THREE.Group {
  const g = new THREE.Group();
  const H = 6.2 * s;
  g.add(cyl(0.34 * s, 0.52 * s, H, BARK, 7));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r() * 0.6;
    const fin = extrude([[0, 0], [1.25 * s, 0], [0, 1.9 * s]], 0.16 * s, i % 2 ? BARK_DK : BARK);
    fin.position.set(Math.cos(a) * 0.3 * s, 0, Math.sin(a) * 0.3 * s);
    fin.rotation.y = -a;
    g.add(fin);
  }
  if (!crown) return g;
  const seed = Math.floor(r() * 1000);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + r();
    g.add(limb(V(0, H * 0.8, 0), V(Math.cos(a) * 1.5 * s, H * 0.98, Math.sin(a) * 1.5 * s), 0.17 * s, 0.1 * s, BARK, 5));
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r();
    const d = i ? 1.45 * s : 0;
    g.add(leafCluster(1.15 * s, i % 2 ? 'deep' : 'mid', Math.cos(a) * d, H + (i ? 0.1 : 0.5) * s, Math.sin(a) * d, 1.3, 0.55, 1.3, 0, seed + i));
  }
  g.add(leafCluster(0.85 * s, 'sun', 0, H + 0.95 * s, 0, 1.2, 0.6, 1.2, 0, seed + 9));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const v = vine(H * 0.45, i + seed);
    v.position.set(Math.cos(a) * 1.3 * s, H * 0.96, Math.sin(a) * 1.3 * s);
    v.rotation.y = -a;
    g.add(v);
  }
  g.add(bromeliad(0.6 * s).translateX(0.35 * s).translateY(H * 0.55).translateZ(0.3 * s));
  return g;
}

/** A stump of a felled giant, its buttresses still standing round it, the cut face pale. */
function giantStump(s: number, r: () => number): THREE.Group {
  const g = giantTree(s * 0.9, r, false);
  g.children[0].scale.set(1, 0.6 / (6.2 * s * 0.9), 1);
  g.add(cyl(0.5 * s, 0.5 * s, 0.04, LOG_END, 7, 0, 0.6, 0));
  return g;
}

/** A stack of great logs, bark on and pale at the ends, lashed with rope. */
function logStack(n: number, len = 2.4): THREE.Group {
  const g = new THREE.Group();
  let i = 0;
  for (let row = 0; i < n; row++) {
    const inRow = Math.max(1, 3 - row);
    for (let k = 0; k < inRow && i < n; k++, i++) {
      const x = (k - (inRow - 1) / 2) * 0.62, y = 0.3 + row * 0.52;
      const l = cyl(0.3, 0.3, len, BARK, 7);
      l.rotation.x = Math.PI / 2;
      l.position.set(x, y, -len / 2);
      g.add(l);
      for (const z of [-len / 2 - 0.01, len / 2 + 0.01]) g.add(cyl(0.27, 0.27, 0.02, LOG_END, 7, x, y, z).rotateX(Math.PI / 2));
    }
  }
  g.add(box(1.9, 0.06, 0.08, ROPE_T, 0, 0.9, len * 0.3), box(1.9, 0.06, 0.08, ROPE_T, 0, 0.9, -len * 0.3));
  return g;
}

/** A skink at work: an axe (a blade of obsidian lashed to a haft) raised over its shoulder. */
function axeman(k: number): THREE.Group {
  const g = new THREE.Group();
  skinkFolk(g, [0xb8862a, 0x2c5cb8, F_RED][k % 3], k);
  const h = box(0.05, 0.9, 0.05, WOOD_DK);
  h.position.set(0.28, 0.7, -0.05);
  h.rotation.x = -0.7;
  g.add(h);
  g.add(box(0.05, 0.22, 0.2, OBSID, 0.28, 1.3, -0.62).rotateX(-0.7));
  return g;
}

/**
 * Timber camp: giants of the jungle standing round the clearing, fewer with every level; the buttressed
 * stumps of those already down, a felled trunk across the clearing, great logs stacked by the track;
 * later a woodcutters' hut on stilts, a sawpit, a sledge of logs hauled by a pack lizard, a bamboo crane,
 * a giant being brought down from a ring of scaffolding, and a longhouse on stilts.
 */
function timberCamp(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const n = 8 - Math.floor(t / 2);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.36 - (i / Math.max(1, n - 1)) * Math.PI * 0.58 + (r() - 0.5) * 0.12, d = 7.0 + r() * 1.5;
    const tr = giantTree(0.76 + r() * 0.12, r);
    tr.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    tr.rotation.y = r() * 6;
    g.add(tr);
  }
  for (let i = 0; i < 2 + t; i++) {
    const a = -Math.PI * 0.12 - r() * Math.PI * 0.76, d = 3.8 + r() * 2.6;
    const st = giantStump(0.8, r);
    st.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    g.add(st);
  }
  // the felled giant across the clearing
  const trunk = cyl(0.42, 0.5, 6.0, BARK, 8);
  trunk.rotation.z = Math.PI / 2;
  trunk.position.set(3.0, 0.48, 1.2);
  g.add(trunk);
  g.add(cyl(0.48, 0.48, 0.03, LOG_END, 8, 3.02, 0.48, 1.2).rotateZ(Math.PI / 2));
  const ax = axeman(0);
  ax.position.set(-1.2, 0, 2.1);
  ax.rotation.y = 2.6;
  g.add(ax);
  const piles = Math.min(4, 1 + Math.floor(t * 0.6));
  for (let i = 0; i < piles; i++) {
    const p = logStack(3 + Math.min(3, t));
    p.position.set(-3.6 + i * 2.3, 0, 4.4 + (i % 2) * 1.0);
    p.rotation.y = Math.PI / 2 + 0.1 * i;
    g.add(p);
  }
  if (t === 1) {
    // a lean-to of fronds on two poles
    for (const x of [-5, -3]) g.add(pole(x, -0.6, 1.9, 0.07));
    const lean = box(2.6, 0.1, 2.2, FROND_DK, -4, 1.2, 0.2);
    lean.rotation.x = 0.55;
    g.add(lean);
  }
  if (t >= 2) {
    const hut = stiltHut({ w: 3.4, d: 2.8, up: 1.0, h: 1.6, roofH: 1.6, windows: 1 });
    hut.position.set(-6.2, 0, -1.2);
    hut.rotation.y = 0.5;
    g.add(hut);
  }
  if (t >= 3) {
    // a sawpit: a log on bamboo trestles, the long saw with its obsidian teeth
    const pit = new THREE.Group();
    for (const x of [-0.9, 0.9]) pit.add(bamboo(V(x, 0, -0.4), V(x, 1.1, 0), 0.07), bamboo(V(x, 0, 0.4), V(x, 1.1, 0), 0.07));
    const lg = cyl(0.3, 0.3, 3.2, BARK, 7);
    lg.rotation.z = Math.PI / 2;
    lg.position.set(1.6, 1.25, 0);
    pit.add(lg);
    pit.add(box(0.06, 1.6, 0.3, WOOD, 0.3, 0.6, 0.35));
    for (let i = 0; i < 5; i++) pit.add(box(0.04, 0.12, 0.06, OBSID, 0.3, 0.7 + i * 0.28, 0.52));
    pit.position.set(2.2, 0, 3.8);
    g.add(pit);
  }
  if (t >= 4) {
    // a sledge of logs hauled by a pack lizard
    const sl = new THREE.Group();
    for (const z of [-0.5, 0.5]) sl.add(box(2.8, 0.16, 0.16, WOOD_DK, 0, 0, z));
    for (let i = 0; i < 3; i++) {
      const l = cyl(0.24, 0.24, 2.6, BARK, 7);
      l.rotation.z = Math.PI / 2;
      l.position.set(0, 0.4 + (i === 2 ? 0.4 : 0), i === 2 ? 0 : (i - 0.5) * 0.5);
      sl.add(l);
    }
    const lz = packLizard();
    lz.scale.setScalar(0.62);
    lz.position.set(2.6, 0, 0);
    sl.add(lz);
    sl.add(limb(V(1.4, 0.3, 0), V(2.0, 0.55, 0), 0.03, 0.03, ROPE_T, 3));
    sl.position.set(4.0, 0, 2.4);
    sl.rotation.y = 0.35;
    g.add(sl);
  }
  if (t >= 5) {
    // a bamboo crane of shear legs, a log swinging from it
    const cr = new THREE.Group();
    for (const s2 of [-1, 1]) cr.add(bamboo(V(s2 * 1.5, 0, 0), V(s2 * 0.2, 5.2, 0), 0.12));
    cr.add(bamboo(V(0, 0, -2.0), V(0, 5.2, 0), 0.1));
    cr.add(box(0.03, 1.6, 0.03, ROPE_T, 0, 3.6, 0));
    const hang = cyl(0.3, 0.3, 2.8, BARK, 7);
    hang.rotation.z = Math.PI / 2;
    hang.position.set(0, 3.3, 0);
    cr.add(hang);
    cr.position.set(5.6, 0, -3.3);
    cr.rotation.y = -0.5;
    g.add(cr);
  }
  if (t >= 6) {
    // a giant coming down: a notch cut in it, a ring of bamboo scaffold round it, two axemen at work up there
    const gt = giantTree(0.92, r);
    gt.position.set(0.4, 0, -4.3);
    g.add(gt);
    g.add(box(0.5, 0.5, 0.3, DOORWAY, 0.4, 2.0, -3.9));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      g.add(pole(0.4 + Math.cos(a) * 1.3, -4.3 + Math.sin(a) * 1.3, 2.8, 0.07));
    }
    g.add(mesh(new THREE.TorusGeometry(1.3, 0.12, 3, 8).rotateX(Math.PI / 2), WOOD).translateX(0.4).translateY(2.5).translateZ(-4.3));
    for (const [a, k] of [[0.7, 1], [2.6, 2]] as [number, number][]) {
      const m = axeman(k);
      m.scale.setScalar(0.9);
      m.position.set(0.4 + Math.cos(a) * 1.3, 2.62, -4.3 + Math.sin(a) * 1.3);
      m.rotation.y = -a - Math.PI / 2;
      g.add(m);
    }
  }
  if (t >= 7) {
    const lodge = stiltHut({ w: 5.0, d: 3.2, up: 1.2, h: 2.0, roofH: 2.0, windows: 2 });
    lodge.position.set(-7.4, 0, 4.0);
    lodge.rotation.y = 1.1;
    g.add(lodge);
  }
  const post = saurianPost(2.6);
  post.position.set(4.2, 0, 6.2);
  g.add(post);
  return { obj: g, h: 9 + (t >= 5 ? 1 : 0), w: 10, d: 10 };
}

/** A kiln of stone: a squat dome, its mouth glowing, a flue on its back with smoke rising. */
function kiln(s = 1, smoke = true): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(1.6 * s, 1.7 * s, 0.5 * s, ST_DK, 9));
  g.add(mesh(new THREE.SphereGeometry(1.5 * s, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), ST).translateY(0.45 * s));
  g.add(cyl(1.62 * s, 1.62 * s, 0.14 * s, PAINT, 9, 0, 0.3 * s));
  g.add(glow(new THREE.BoxGeometry(0.8 * s, 0.6 * s, 0.2), COAL, COAL_E).translateY(0.45 * s).translateZ(1.45 * s));
  g.add(box(0.5 * s, 1.8 * s, 0.5 * s, ST_DK, 0.4 * s, 1.2 * s, -0.5 * s));
  const sm = new THREE.Object3D();
  sm.userData.dynamic = true;
  sm.userData.smoke = true;
  sm.position.set(0.4 * s, 3.1 * s, -0.5 * s);
  if (smoke) g.add(sm);
  return g;
}

/** An open shed: bamboo posts under a roof of thatch. */
function openShed(w: number, d: number, h: number): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) g.add(pole(x, z, h, 0.1));
  const roof = thatchRoof(w - 0.4, d - 0.4, 1.2, { over: 0.3, knot: false });
  roof.position.y = h;
  g.add(roof);
  return g;
}

/**
 * Clay pit: a pit of red earth dug deeper every level in terraces, water gathering in the bottom; mud
 * bricks drying in rows and stacked by the track, pots and jars; later a potters' hut on stilts, kilns of
 * stone, a thatched moulding shed and at last a tall stepped kiln-tower of stone, smoking.
 */
function clayPit(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const pr = 2.4 + t * 0.4;
  const pit = cyl(pr + 0.8, pr, 0.35, EARTH, 12, 0, -0.2);
  pit.scale.set(1.25, 1, 1);
  g.add(pit);
  const steps = Math.min(3, Math.floor((t + 1) / 2));
  for (let k = 1; k <= steps; k++) {
    const ring = cyl(pr - k * 0.8 + 0.3, pr - k * 0.8, 0.1, k % 2 ? EARTH_DK : EARTH, 12, 0, 0.04 + k * 0.03);
    ring.scale.set(1.25, 1, 1);
    g.add(ring);
  }
  if (t >= 3) {
    const water = cyl(pr * 0.35, pr * 0.35, 0.06, C.water, 10, 0, 0.16);
    water.scale.set(1.25, 1, 1);
    g.add(water);
  }
  if (t >= 2) {
    const lad = ladder(2.0);
    lad.rotation.y = Math.PI / 2;
    lad.position.set(-pr * 0.95, 0, 1.2);
    g.add(lad);
  }
  // mud bricks stacked by the track, more each level, some under a little thatch
  const stacks = Math.min(8, t + 1);
  for (let i = 0; i < stacks; i++) {
    const st = new THREE.Group();
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) st.add(box(0.5, 0.24, 0.9, (x + y + i) % 3 ? EARTH_DK : EARTH, x * 0.55 - 0.55, y * 0.25, 0));
    if (i % 3 === 2) {
      for (const [px, pz] of [[-0.9, -0.55], [0.9, -0.55], [-0.9, 0.55], [0.9, 0.55]]) st.add(pole(px, pz, 1.3, 0.04));
      st.add(box(2.1, 0.08, 1.4, THATCH, 0, 1.3, 0));
    }
    st.position.set(6.6 + (i % 2) * 1.8, 0, -3.4 + Math.floor(i / 2) * 1.6);
    g.add(st);
  }
  if (t >= 2) {
    const rows = Math.min(4, t - 1);
    for (let rr = 0; rr < rows; rr++) for (let i = 0; i < 7; i++) g.add(box(0.42, 0.16, 0.24, EARTH, -2.2 + i * 0.6, 0, 5.2 + rr * 0.55));
  }
  for (let i = 0; i < 3; i++) g.add(blob(0.7, EARTH_DK, -6 + r() * 1.5, 0.2, -4 + i * 1.6, 1.2, 0.6, 1.1));
  for (let i = 0; i < 3; i++) g.add(jar(0.9, 2.6 + i * 0.6, 5.9 - (i % 2) * 0.3));
  if (t >= 2) {
    // clay carried up in baskets on a yoke
    g.add(basket(0.8, EARTH, 3.5, 4.8), basket(0.8, EARTH, 4.3, 4.6));
    g.add(limb(V(3.5, 0.5, 4.8), V(4.3, 0.5, 4.6), 0.03, 0.03, BAMBOO, 4));
  }
  if (t >= 3) {
    const hut = stiltHut({ w: 3.4, d: 2.8, up: 1.0, h: 1.6, roofH: 1.6, windows: 1 });
    hut.position.set(-7.0, 0, 3.2);
    hut.rotation.y = 0.8;
    g.add(hut);
  }
  if (t >= 4) { const k = kiln(1, t < 7); k.position.set(4.6, 0, -5.8); g.add(k); }
  if (t >= 5) {
    const shed = openShed(5.2, 3.0, 2.3);
    shed.add(box(4.0, 0.8, 0.9, WOOD_DK, 0, 0, 0));
    for (let i = 0; i < 6; i++) shed.add(box(0.4, 0.16, 0.24, EARTH, -1.5 + i * 0.6, 0.8, 0));
    shed.position.set(-3.2, 0, -6.4);
    g.add(shed);
  }
  if (t >= 6) { const k = kiln(0.9, false); k.position.set(8.4, 0, 2.6); k.rotation.y = -1.2; g.add(k); }
  if (t >= 7) {
    // a tall kiln-tower of stone, stepped like a temple, smoking from its top
    const kt = new THREE.Group();
    for (const [y0, y1, hw] of [[0, 3, 1.1], [3, 5.6, 0.85], [5.6, 7.4, 0.62]] as [number, number, number][]) {
      kt.add(box(hw * 2, y1 - y0, hw * 2, ST, 0, y0, 0));
      kt.add(box(hw * 2 + 0.14, 0.2, hw * 2 + 0.14, ST_LT, 0, y1 - 0.2, 0));
    }
    kt.add(box(2.24, 0.3, 2.24, PAINT, 0, 2.2, 0));
    kt.add(glow(new THREE.BoxGeometry(0.7, 0.8, 0.12), COAL, COAL_E).translateY(0.3).translateZ(1.12));
    const sm = new THREE.Object3D();
    sm.userData.dynamic = true;
    sm.userData.smoke = true;
    sm.position.set(0, 7.8, 0);
    kt.add(sm);
    kt.position.set(1.2, 0, -8.4);
    g.add(kt);
  }
  const post = saurianPost(2.6);
  post.position.set(1.4, 0, 6.8);
  g.add(post);
  return { obj: g, h: 4 + (t >= 7 ? 5 : t >= 4 ? 2 : 0), w: 12, d: 10 };
}

/**
 * Iron mine: the obsidian quarry. Hills of dark, mossy volcanic rock with veins of black glass breaking
 * out of them, a quarry face cut in benches, a cave into the hill (at the higher levels under the gaping
 * jaws of a great stone serpent), a sledge-track of logs out of it, heaps of obsidian; later a hut on
 * stilts, a hoist over a shaft, a knapping yard with its fire, a second cut and a stone lodge.
 */
function ironMine(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const ROCK = 0x5c6058, ROCK_DK = 0x464a42, ROCK_LT = 0x7a7e70;
  const grow = 0.75 + t * 0.06;
  const hill = [
    [0, -3, 5.5, 4.2], [-5, -1.5, 4, 3], [5, -2, 4.5, 3.4], [-2, -6, 5, 5.5], [3.5, -6.5, 4.5, 4.6], [-6.5, -5.5, 3.6, 3.8], [7, -5.8, 3.4, 3.2],
  ].slice(0, 4 + Math.min(3, Math.floor(t / 2)));
  hill.forEach(([x, z, sc, h], i) => {
    const k = i === 0 ? 1 : grow;
    const m = blob(sc * k, r() < 0.5 ? ROCK : ROCK_DK, x, h * k * 0.35, z - (k - 1) * 5, 1.1, h / sc, 1.0);
    m.rotation.y = r() * 3;
    g.add(m);
    g.add(moss(sc * 0.5, x + (r() - 0.5), h * k * 0.35 + h * k * 0.62, z - (k - 1) * 5 - 0.5, i + 20, 1.6, 1.3));
  });
  // veins of obsidian breaking out of the rock
  hill.forEach(([x, z, sc, h], i) => {
    const k = i === 0 ? 1 : grow;
    const cy = h * k * 0.35, cz = z - (k - 1) * 5, rx = sc * k * 1.1, ry = h * k, rz = sc * k;
    const n = 1 + Math.min(2, Math.floor(t / 3)) + (i === 0 ? 1 : 0);
    for (let j = 0; j < n; j++) {
      const ph = (r() - 0.5) * 1.3, th = 0.25 + r() * 0.45;
      const nx = Math.sin(ph) * Math.cos(th), ny = Math.sin(th), nz = Math.cos(ph) * Math.cos(th);
      const px = x + nx * rx * 0.9, py = cy + ny * ry * 0.9, pz = cz + nz * rz * 0.9;
      for (let q = 0; q < 3; q++) {
        const c = mesh(new THREE.OctahedronGeometry(0.34 - q * 0.07, 0), OBSID);
        c.scale.set(1, 2.3, 1);
        c.position.set(px + (q - 1) * 0.3, py + (q % 2) * 0.1, pz);
        c.rotation.set(nz * 0.9 + (r() - 0.5) * 0.4, 0, -nx * 0.9 + (q - 1) * 0.3);
        g.add(c);
      }
    }
  });
  // the quarry face, cut in benches, black glass showing in the fresh stone
  for (const [w, h, z] of [[4.4, 0.8, 1.9], [3.8, 1.6, 1.0], [3.2, 2.4, 0.1]] as [number, number, number][]) {
    g.add(box(w, h, 1.0, ROCK_LT, 0, 0, z));
    g.add(box(w * 0.6, 0.12, 0.05, OBSID, -w * 0.1, h * 0.55, z + 0.5));
  }
  // the cave into the hill
  g.add(box(1.8, 2.0, 0.3, DOORWAY, -2.4, 0, 1.4));
  if (t >= 3) {
    const hd = serpentHead(1.2, ROCK_LT, true);
    hd.position.set(-2.4, 1.6, 0.4);
    g.add(hd);
  } else {
    for (const x of [-3.4, -1.4]) g.add(pole(x, 1.55, 2.2, 0.12));
    g.add(bamboo(V(-3.6, 2.2, 1.55), V(-1.2, 2.2, 1.55), 0.1));
  }
  // the sledge track out of the cave, and a sledge of obsidian on it
  const railLen = 3 + Math.min(4, t) * 0.8;
  for (const x of [-2.9, -1.9]) g.add(box(0.14, 0.1, railLen, WOOD, x, 0.02, 1.7 + railLen / 2));
  const sled = new THREE.Group();
  sled.add(box(1.3, 0.16, 1.4, WOOD_DK, 0, 0.1, 0));
  for (let i = 0; i < 4; i++) sled.add(mesh(new THREE.OctahedronGeometry(0.26, 0), OBSID).translateX((i % 2 - 0.5) * 0.5).translateY(0.46 + Math.floor(i / 2) * 0.2).translateZ((Math.floor(i / 2) - 0.5) * 0.4));
  sled.position.set(-2.4, 0, 1.7 + railLen - 0.9);
  g.add(sled);
  // heaps of obsidian, more each level
  for (let i = 0; i < Math.min(5, t); i++) {
    const hx = -5.4 + i * 1.4, hz = 4.4 + (i % 2) * 0.9;
    g.add(blob(0.7, OBSID, hx, 0.15, hz, 1.2, 0.5, 1.1));
    for (let k = 0; k < 3; k++) g.add(mesh(new THREE.OctahedronGeometry(0.2, 0), k % 2 ? OBSID_LT : OBSID).translateX(hx + (k - 1) * 0.35).translateY(0.5).translateZ(hz + (k % 2) * 0.2));
  }
  if (t >= 2) { const tr = bambooTorch(2.2); tr.position.set(-4.0, 0, 2.2); g.add(tr); }
  if (t >= 3) {
    const hut = stiltHut({ w: 3.2, d: 2.6, up: 1.0, h: 1.6, roofH: 1.5, windows: 1 });
    hut.position.set(5.0, 0, 3.8);
    hut.rotation.y = -0.5;
    g.add(hut);
  }
  if (t >= 4) {
    // a hoist over a shaft: a bamboo tripod, a rope wheel turning
    const hf = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      hf.add(bamboo(V(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4), V(0, 4.8, 0), 0.1));
    }
    const wheel = new THREE.Group();
    wheel.add(mesh(new THREE.TorusGeometry(0.6, 0.07, 4, 12), WOOD));
    for (let i = 0; i < 3; i++) { const sp = box(0.05, 1.2, 0.05, WOOD, 0, -0.6, 0); sp.rotation.z = (i / 3) * Math.PI; wheel.add(sp); }
    settle(wheel);
    wheel.userData.dynamic = true;
    wheel.userData.spin = true;
    wheel.position.set(0, 4.3, 0);
    hf.add(wheel);
    hf.add(box(0.03, 2.6, 0.03, ROPE_T, 0.6, 1.7, 0));
    hf.add(cyl(0.9, 0.9, 0.3, DOORWAY, 8, 0, 0, 0));
    hf.add(mesh(new THREE.TorusGeometry(0.95, 0.16, 4, 10).rotateX(Math.PI / 2), ST_DK).translateY(0.2));
    hf.position.set(-6.0, 0, 1.4);
    g.add(hf);
  }
  if (t >= 5) {
    // the knapping yard: a stone table of blades, a fire for tempering the glass
    const ky = new THREE.Group();
    ky.add(box(1.6, 0.7, 0.9, ST));
    for (let i = 0; i < 5; i++) ky.add(box(0.07, 0.03, 0.36, i % 2 ? OBSID_LT : OBSID, -0.5 + i * 0.25, 0.71, 0));
    ky.add(firePit(1.8, 0.2, 0.6));
    ky.position.set(6.6, 0, -0.2);
    ky.rotation.y = -0.4;
    g.add(ky);
  }
  if (t >= 6) {
    const cut = new THREE.Group();
    for (const [w, h, z] of [[3.0, 0.7, 0.8], [2.4, 1.4, 0]] as [number, number, number][]) cut.add(box(w, h, 0.9, ROCK_LT, 0, 0, z));
    for (let i = 0; i < 3; i++) {
      const c = mesh(new THREE.OctahedronGeometry(0.28, 0), OBSID);
      c.scale.set(1, 2, 1);
      c.position.set(-0.8 + i * 0.8, 1.7, -0.2);
      cut.add(c);
    }
    cut.position.set(2.8, 0, -0.6);
    cut.rotation.y = -0.3;
    g.add(cut);
  }
  if (t >= 7) {
    const lodge = saurianHouse({ w: 5, d: 3.6, h: 2.2, roofH: 1.6, windows: 2, stone: true });
    lodge.position.set(-7.5, 0, 7.0);
    lodge.rotation.y = 0.4;
    g.add(lodge);
  }
  const post = saurianPost(2.6);
  post.position.set(2.4, 0, 6.6);
  g.add(post);
  return { obj: g, h: 8 + (t >= 4 ? 1 : 0), w: 12, d: 12 };
}

/** A terrace of maize: a stone retaining wall, dark earth, rows of tall maize (and a second, higher step at the back). */
function maizeTerrace(w: number, d: number, r: () => number, tiers: boolean): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.3, d, ST_DK));
  g.add(box(w - 0.2, 0.06, d - 0.2, 0x5e4630, 0, 0.3, 0));
  if (tiers) {
    g.add(box(w - 0.3, 0.32, d / 2 - 0.1, ST_DK, 0, 0.3, -d / 4));
    g.add(box(w - 0.5, 0.06, d / 2 - 0.3, 0x5e4630, 0, 0.62, -d / 4));
  }
  const rows = 5, cols = 7;
  for (let i = 0; i < rows; i++) for (let k = 0; k < cols; k++) {
    const x = -w / 2 + 0.5 + k * ((w - 1) / (cols - 1)), z = -d / 2 + 0.5 + i * ((d - 1) / (rows - 1));
    const back = tiers && z < -0.05;
    const m = maize(1.7 + r() * 0.5, i * cols + k);
    m.position.set(x + (r() - 0.5) * 0.15, back ? 0.68 : 0.36, z);
    g.add(m);
  }
  return g;
}

/** A banana grove on a raised bed of earth. */
function bananaGrove(w: number, d: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.25, d, ST_DK));
  g.add(box(w - 0.2, 0.06, d - 0.2, 0x5e4630, 0, 0.25, 0));
  for (let i = 0; i < 6; i++) {
    const b = banana(1.1 + r() * 0.25, r, i % 2 === 0);
    b.position.set(-w / 2 + 1.1 + (i % 3) * ((w - 2.2) / 2), 0.3, (i < 3 ? -1 : 1) * d * 0.22);
    g.add(b);
  }
  return g;
}

/** A patch of squash and beans: vines along the rows, fat orange squash, bean poles in tripods. */
function squashPatch(w: number, d: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.25, d, ST_DK));
  g.add(box(w - 0.2, 0.06, d - 0.2, 0x5e4630, 0, 0.25, 0));
  for (let i = 0; i < 4; i++) g.add(box(w - 0.8, 0.14, 0.3, FROND_DK, 0, 0.3, -d / 2 + 0.9 + i * ((d - 1.8) / 3)));
  for (let i = 0; i < 9; i++) g.add(blob(0.24 + r() * 0.1, i % 3 ? 0xd86a3a : F_YEL, (r() - 0.5) * (w - 1), 0.42, (r() - 0.5) * (d - 1), 1.2, 0.8, 1));
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + 1.2 + i * ((w - 2.4) / 2), z = d / 2 - 0.9;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      g.add(limb(V(x + Math.cos(a) * 0.4, 0.3, z + Math.sin(a) * 0.4), V(x, 2.0, z), 0.03, 0.03, BAMBOO, 4));
    }
    g.add(leafCluster(0.4, 'mid', x, 1.3, z, 1, 1.6, 1, 0, i + 30));
  }
  return g;
}

/** A drying shed: an open frame of bamboo under thatch, cobs hung in strings from its beams. */
function dryingShed(w: number, d: number, h: number): THREE.Group {
  const g = openShed(w, d, h);
  const n = Math.max(2, Math.round(d / 1.2));
  for (let i = 0; i < n; i++) {
    const z = -d / 2 + 0.6 + (i * (d - 1.2)) / (n - 1);
    g.add(limb(V(-w / 2 + 0.2, h - 0.3, z), V(w / 2 - 0.2, h - 0.3, z), 0.04, 0.04, BAMBOO_DK, 4));
    for (let k = 0; k < 4; k++) g.add(box(0.14, 0.6, 0.14, k % 2 ? F_YEL : 0xd86a3a, -w / 2 + 0.8 + (k * (w - 1.6)) / 3, h - 1.0, z));
  }
  g.add(basket(1.0, F_YEL, -w / 2 + 0.8, d / 2 - 0.8), basket(1.0, 0xd86a3a, w / 2 - 0.8, d / 2 - 0.9));
  return g;
}

/**
 * Farm: terraced fields of tall maize, banana groves and squash-and-bean patches round a farmhouse on
 * stilts (of stone, at the end); a cistern with lilies, a field-watch hut on tall stilts, drying sheds
 * hung with cobs, a paddock of grazing lizards and a round granary on stilts.
 */
function farm(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const fh = t >= 7
    ? saurianHouse({ w: 6.6, d: 4.6, h: 2.6, roofH: 2.0, windows: 3, over: 0.45 })
    : stiltHut({ w: 4.0 + Math.min(3, t) * 0.4, d: 3.4, up: 1.1, h: 1.8, roofH: 2.0, windows: 1 });
  g.add(fh);
  const spots: [number, number][] = [[-8, -6], [0, -8.5], [8, -6], [-9.5, 3], [-4.5, -15.5], [4.5, -15.5], [13.5, -12], [15.5, -3.5], [-13.5, -12]];
  const fields = Math.min(spots.length, t + 1);
  for (let i = 0; i < fields; i++) {
    const f = i % 3 === 1 ? bananaGrove(6.5, 5, r) : i % 4 === 3 ? squashPatch(6.5, 5, r) : maizeTerrace(6.5, 5, r, i % 2 === 0);
    f.position.set(spots[i][0], 0, spots[i][1]);
    f.rotation.y = (r() - 0.5) * 0.3;
    g.add(f);
  }
  for (let i = 0; i < Math.min(6, 1 + t); i++) g.add(basket(0.9, i % 2 ? F_YEL : 0xd86a3a, 0.5 + r() * 2.5, 5.6 + r() * 1.2));
  if (t >= 2) {
    const p = pool(1.0, r, 4);
    p.position.set(-3.2, 0, 3.8);
    g.add(p);
  }
  if (t >= 3) {
    // a field-watch hut up on tall stilts
    const wt = new THREE.Group();
    wt.add(stilts(2.2, 2.2, 3.4));
    wt.add(box(2.0, 1.3, 2.0, WATTLE, 0, 3.7, 0));
    wt.add(box(0.7, 0.9, 0.08, DOORWAY, 0, 3.7, 1.02));
    const rf = thatchRoof(2.0, 2.0, 1.4, { over: 0.35 });
    rf.position.y = 5.0;
    wt.add(rf);
    const lad = ladder(3.6);
    lad.position.set(0, 0, 1.6);
    wt.add(lad);
    wt.position.set(-14, 0, -3.5);
    wt.rotation.y = 0.6;
    g.add(wt);
  }
  if (t >= 4) {
    const ds = dryingShed(6, 7.5, 2.8);
    ds.position.set(10, 0, 2.5);
    ds.rotation.y = -Math.PI / 2;
    g.add(ds);
  }
  if (t >= 5) {
    const pad = new THREE.Group();
    fenceLine(pad, -3.3, 2.4, 3.3, 2.4, 1.0);
    fenceLine(pad, -3.3, -2.4, 3.3, -2.4, 1.0);
    fenceLine(pad, -3.3, -2.4, -3.3, 2.4, 1.0);
    fenceLine(pad, 3.3, -2.4, 3.3, 2.4, 1.0);
    for (let i = 0; i < 2; i++) {
      const lz = packLizard(i ? 0x8a7a4a : 0x6a7a4a);
      lz.scale.setScalar(0.55);
      lz.position.set(-1.2 + i * 2.2, 0, (i ? 0.7 : -0.6));
      lz.rotation.y = i ? 2.6 : 0.3;
      pad.add(lz);
    }
    pad.add(box(1.4, 0.3, 0.4, WOOD, 1.8, 0, -1.6));
    pad.position.set(-7.5, 0, 7.5);
    g.add(pad);
  }
  if (t >= 6) { const gr = granary(); gr.scale.setScalar(0.8); gr.position.set(-5, 0, -1.4); g.add(gr); }
  if (t >= 8) {
    const d2 = dryingShed(4.6, 5.2, 2.5);
    d2.position.set(4.6, 0, -2.2);
    d2.rotation.y = Math.PI;
    g.add(d2);
  }
  fenceLine(g, -5, 4.4, 5, 4.4, 1.0);
  const post = saurianPost(2.6);
  post.position.set(5.6, 0, 5.4);
  g.add(post);
  return { obj: g, h: 6 + (t >= 4 ? 2 : 0), w: 8, d: 8 };
}

/** The temple-city's own building for each id (the wall is drawn by the wall ring). */
export function saurianModel(id: BuildingId, t: number, color: number, r: () => number): Built | null {
  quietDetails();
  switch (id) {
    case 'main': return templeHall(t, color);
    case 'barracks': return barracks(t, color);
    case 'stable': return stable(t, r);
    case 'workshop': return workshop(t, r);
    case 'academy': return academy();
    case 'smithy': return smithy(t);
    case 'rally': return rally(color);
    case 'statue': return statue();
    case 'market': return market(t, r);
    case 'warehouse': return warehouse(t);
    case 'hiding': return hiding(t, r);
    case 'watchtower': return watchtower(t, color);
    case 'timber': return timberCamp(t, r);
    case 'claypit': return clayPit(t, r);
    case 'ironmine': return ironMine(t, r);
    case 'farm': return farm(t, r);
    default: return null;
  }
}

/** Where the door signs hang on the temple-city's buildings (on the lintel of each stone portal, the tower's face at the academy). */
export function saurianSignAt(id: BuildingId): [number, number, number] | null {
  switch (id) {
    case 'barracks': return [0, 3.0, 2.64];
    case 'smithy': return [0, 2.9, 2.24];
    case 'stable': return [0, 2.6, 2.29];
    case 'warehouse': return [0, 3.4, 3.49];
    case 'academy': return [6.2, 3.1, 1.66];
    default: return null;
  }
}

/** The finishing touches on buildings that keep another shape (the temple-city draws all of its own, so nothing is left to dress). */
export function saurianDress(id: BuildingId, t: number, b: Built, r: () => number): Built {
  void id; void t; void r;
  return b;
}

/**
 * A door sign of the temple-city: a round stone plaque rimmed in gold with a red ring, and on it the
 * building's mark: crossed obsidian clubs (barracks), an obsidian blade over a hammerstone (smithy), a
 * raptor's head (stable), a sun-disc (academy), a stoppered jar (warehouse). Centred at the origin, facing +z.
 */
export function saurianSign(kind: string): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.56, 0.56, 0.12, ST_LT, 10).rotateX(Math.PI / 2));
  g.add(mesh(new THREE.TorusGeometry(0.56, 0.05, 3, 12), GOLD));
  g.add(mesh(new THREE.TorusGeometry(0.44, 0.03, 3, 12), PAINT).translateZ(0.06));
  const e = new THREE.Group();
  if (kind === 'barracks') {
    for (const s of [-1, 1]) {
      const c = new THREE.Group();
      c.add(box(0.08, 0.7, 0.04, WOOD));
      for (let i = 0; i < 3; i++) for (const k of [-1, 1]) c.add(box(0.05, 0.08, 0.04, OBSID, k * 0.06, 0.3 + i * 0.12, 0));
      c.position.set(-s * 0.18, -0.34, 0);
      c.rotation.z = s * 0.6;
      e.add(c);
    }
  } else if (kind === 'smithy') {
    e.add(blob(0.16, ST_DK, 0, -0.2, 0, 1.4, 0.8, 0.6));
    const bl = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0).scale(0.1, 0.34, 0.04), mat0(OBSID));
    bl.position.set(0.04, 0.16, 0.02);
    bl.rotation.z = -0.4;
    e.add(bl);
  } else if (kind === 'stable') {
    e.add(box(0.44, 0.16, 0.08, 0x6e7b3e, 0.08, 0.02, 0), box(0.2, 0.22, 0.08, 0x6e7b3e, -0.14, -0.04, 0));
    e.add(box(0.36, 0.05, 0.07, 0x4c5a2c, 0.08, -0.04, 0.01));
    e.add(featherFan(3, 0.2, 0.7, [F_RED, F_YEL, F_RED], 0.07).rotateZ(0.9).translateX(-0.2).translateY(0.08));
    e.add(box(0.04, 0.04, 0.02, F_YEL, 0.0, 0.07, 0.05));
  } else if (kind === 'academy') {
    e.add(sunDisc(0.22));
  } else {
    e.add(blob(0.2, 0xa8603a, 0, -0.08, 0, 1, 1.15, 0.6));
    e.add(box(0.14, 0.1, 0.1, 0xa8603a, 0, 0.14, 0));
    e.add(box(0.2, 0.05, 0.1, PAINT, 0, 0.02, 0.04));
  }
  e.position.z = 0.08;
  g.add(e);
  return g;
}

function mat0(c: number): THREE.MeshLambertMaterial {
  return detailMat(c);
}

// ---------- the walls ----------

/**
 * The wooden wall of the temple-city: a footing of stone blocks and above it a fence of great logs lashed
 * with bamboo rails, vines trailing down its face, a carved post with jade eyes now and then; the gate
 * between two stone posts, each carrying a feathered serpent's head that stares down the road, under a
 * thatched hood. From the second size, watch-platforms of stone and bamboo, thatched, round the ring.
 */
export function saurianPalisade(g: THREE.Group, tier: number, R: number, start: number, end: number, gateA: number, gateHalf: number): void {
  quietDetails();
  const h = tier === 1 ? 2.6 : 3.6;
  const segs = 56;
  for (let k = 0; k < segs; k++) {
    const a0 = start + ((end - start) * k) / segs, a1 = start + ((end - start) * (k + 1)) / segs;
    const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
    const len = Math.hypot(x1 - x0, z1 - z0) + 0.08;
    const f = new THREE.Group();
    f.add(box(len, 0.7, 1.1, k % 2 ? ST_DK : ST_OLD));
    f.add(box(len, 0.1, 1.2, ST_LT, 0, 0.7, 0));
    for (const rr of [-0.4, 0.4]) f.add(limb(V(-len / 2, h * 0.58, rr), V(len / 2, h * 0.58, rr), 0.06, 0.06, BAMBOO, 4));
    f.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    f.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(f);
  }
  const step = 0.72 / R;
  let i = 0;
  for (let a = start; a <= end; a += step, i++) {
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    const hh = h + (Math.sin(a * 37) + 1) * 0.2;
    g.add(cyl(0.3, 0.33, hh, i % 3 === 1 ? WOOD_DK : WOOD, 6, x, 0.2, z));
    if (i % 11 === 5) {
      // a carved post-head: a painted block with jade eyes staring out
      const ph = new THREE.Group();
      ph.add(box(0.62, 0.56, 0.62, i % 2 ? PAINT_TQ : PAINT, 0, 0, 0));
      for (const s of [-0.13, 0.13]) ph.add(glow(new THREE.BoxGeometry(0.1, 0.08, 0.05)).translateX(s).translateY(0.36).translateZ(0.32));
      ph.add(box(0.3, 0.06, 0.04, DOORWAY, 0, 0.14, 0.32));
      ph.position.set(x, hh + 0.2, z);
      ph.rotation.y = Math.PI / 2 - a;
      g.add(ph);
    }
    if (i % 4 === 1) {
      const v = vine(hh * (0.5 + ((i * 7) % 5) * 0.08), i);
      v.position.set(x + Math.cos(a) * 0.34, hh + 0.2, z + Math.sin(a) * 0.34);
      v.rotation.y = Math.PI / 2 - a;
      g.add(v);
    }
    if (i % 9 === 3) g.add(leafCluster(0.5, 'deep', x, hh + 0.3, z, 1.3, 0.7, 1.3, 0, i));
  }
  // the gate
  for (const s of [-1, 1]) {
    const a = gateA + s * gateHalf;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    g.add(box(1.5, h + 1.4, 1.5, ST, x, 0, z));
    g.add(box(1.7, 0.2, 1.7, ST_LT, x, h + 1.4, z));
    g.add(box(1.54, 0.3, 1.54, PAINT, x, h + 0.7, z));
    const hd = serpentHead(0.8, ST, true);
    hd.position.set(x, h + 1.6, z - 0.1);
    g.add(hd);
  }
  const gw = gateHalf * 2 * R;
  g.add(box(gw + 1.4, 0.5, 0.7, WOOD, 0, h + 0.9, R));
  for (const x of [-gw / 4, 0, gw / 4]) g.add(glow(new THREE.BoxGeometry(0.24, 0.2, 0.06)).translateX(x).translateY(h + 1.15).translateZ(R + 0.36));
  const hood = thatchRoof(gw - 0.4, 1.0, 0.9, { over: 0.3, knot: false });
  hood.position.set(0, h + 1.4, R);
  g.add(hood);
  if (tier === 2) {
    for (let k = 0; k < 8; k++) {
      const a = gateA + gateHalf + 0.35 + (k / 8) * (Math.PI * 2 - gateHalf * 2 - 0.5);
      const tw = new THREE.Group();
      tw.add(box(2.9, 2.4, 2.9, ST));
      tw.add(box(3.0, 0.3, 3.0, PAINT, 0, 1.6, 0));
      tw.add(box(3.1, 0.14, 3.1, ST_LT, 0, 2.4, 0));
      for (const x of [-1, 1]) for (const z of [-1, 1]) tw.add(pole(x * 1.2, z * 1.2, 6.4 - 2.4, 0.13, 2.4));
      for (const s of [-1, 1]) tw.add(limb(V(-1.2, 2.6, s * 1.2), V(1.2, 6.0, s * 1.2), 0.06, 0.06, BAMBOO_DK, 4), limb(V(s * 1.2, 2.6, -1.2), V(s * 1.2, 6.0, 1.2), 0.06, 0.06, BAMBOO_DK, 4));
      tw.add(box(3.2, 0.3, 3.2, WOOD, 0, 6.4, 0));
      for (const x of [-1, 1]) for (const z of [-1, 1]) tw.add(pole(x * 1.35, z * 1.35, 2.2, 0.08, 6.7));
      for (const s of [-1, 1]) tw.add(limb(V(-1.4, 7.3, s * 1.4), V(1.4, 7.3, s * 1.4), 0.04, 0.04, BAMBOO, 4), limb(V(s * 1.4, 7.3, -1.4), V(s * 1.4, 7.3, 1.4), 0.04, 0.04, BAMBOO, 4));
      const rf = thatchRoof(2.8, 2.8, 1.5, { over: 0.35 });
      rf.position.y = 8.9;
      tw.add(rf);
      const plume = featherFan(3, 0.6, 0.9, [F_RED, F_YEL, F_RED], 0.18);
      plume.position.y = 10.5;
      tw.add(plume);
      tw.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      tw.rotation.y = -a;
      g.add(tw);
    }
  }
}

/** A stretch of the stone wall, the temple-city's way: a stepped footing, stepped caps on the merlons, a red band, jade set in its face, serpent heads spouting from it and vines over it. (Local -z faces out.) */
export function saurianWallDress(seg: THREE.Group, len: number, h: number, thick: number, i: number, merlons: number): void {
  quietDetails();
  seg.add(box(len, 0.9, 0.5, ST_DK, 0, 0, -thick / 2 - 0.25));
  seg.add(box(len, 0.4, 0.3, ST_DK, 0, 0.9, -thick / 2 - 0.15));
  for (let k = 0; k < merlons; k++) {
    const x = -len / 2 + (k + 0.5) * (len / merlons);
    for (const z of [thick / 2 - 0.1, -thick / 2 + 0.1]) seg.add(box(0.34, 0.26, 0.4, ST, x, h + 1.0, z));
  }
  for (const s of [-1, 1]) seg.add(box(len, 0.3, 0.05, PAINT, 0, h - 0.75, s * (thick / 2 + 0.03)));
  if (i % 3 === 1) seg.add(glow(new THREE.BoxGeometry(0.4, 0.4, 0.06)).translateY(h * 0.55).translateZ(-thick / 2 - 0.04));
  if (i % 2 === 0) {
    for (const k of [-1, 1]) {
      const v = vine(h * (0.55 + ((i + k + 3) % 3) * 0.12), i + k);
      v.position.set(k * len * 0.22, h + 0.3, -thick / 2 - 0.06);
      v.rotation.y = Math.PI;
      seg.add(v);
    }
    seg.add(moss(0.45, (i % 3 - 1) * 0.5, h + 0.3, -thick / 2 + 0.2, i));
  }
  if (i % 5 === 2) {
    const hd = serpentHead(0.32, ST, false);
    hd.position.set(0, h - 1.2, -thick / 2 + 0.3);
    hd.rotation.y = Math.PI;
    seg.add(hd);
  }
}

/** A tower of the stone wall: square, in two stepped stages, jade at the corners; open with stepped merlons and a fire-bowl, or under a thatched lookout. */
export function saurianWallTower(tr: number, th: number, roofed: boolean): THREE.Group {
  const g = new THREE.Group();
  const w1 = tr, w2 = tr * 0.9, y1 = th * 0.58;
  g.add(box(w1 * 2 + 0.6, 0.5, w1 * 2 + 0.6, ST_DK));
  g.add(box(w1 * 2, y1, w1 * 2, ST));
  g.add(box(w1 * 2 + 0.06, 0.34, w1 * 2 + 0.06, PAINT, 0, y1 - 0.7, 0));
  g.add(box(w1 * 2 + 0.2, 0.2, w1 * 2 + 0.2, ST_LT, 0, y1 - 0.2, 0));
  g.add(box(w2 * 2, th - y1, w2 * 2, ST_OLD, 0, y1, 0));
  g.add(box(w2 * 2 + 0.24, 0.24, w2 * 2 + 0.24, ST_LT, 0, th - 0.24, 0));
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(glow(new THREE.BoxGeometry(0.2, 0.2, 0.2)).translateX(x * (w1 + 0.04)).translateY(y1 - 0.53).translateZ(z * (w1 + 0.04)));
  for (let s = 0; s < 4; s++) {
    const a = (s / 4) * Math.PI * 2;
    const sl = box(0.26, 0.8, 0.1, C.window, Math.sin(a) * (w2 + 0.01), y1 + (th - y1) * 0.4, Math.cos(a) * (w2 + 0.01));
    sl.rotation.y = a;
    sl.userData.window = true;
    g.add(sl);
  }
  if (roofed) {
    for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(box(0.2, 1.6, 0.2, WOOD, x * (w2 - 0.2), th, z * (w2 - 0.2)));
    const rf = thatchRoof(w2 * 2 - 0.2, w2 * 2 - 0.2, tr * 1.1, { over: 0.4 });
    rf.position.y = th + 1.6;
    g.add(rf);
  } else {
    for (let s = 0; s < 4; s++) for (const k of [-0.6, 0, 0.6]) {
      const a = (s / 4) * Math.PI * 2;
      const m = new THREE.Group();
      m.add(box(0.5, 0.36, 0.34, ST), box(0.26, 0.28, 0.34, ST, 0, 0.36, 0));
      m.position.set(Math.sin(a) * (w2 - 0.1) + Math.cos(a) * k * w2, th, Math.cos(a) * (w2 - 0.1) - Math.sin(a) * k * w2);
      m.rotation.y = a;
      g.add(m);
    }
    const b = brazier(0.3, false, 0.7);
    b.position.y = th;
    g.add(b);
  }
  return g;
}

/** The stone gatehouse's crown: great serpent heads on pedestals either side of the way through, a stepped crest over the gate, and (at the height of the walls) a golden sun-disc. */
export function saurianGate(g: THREE.Group, R: number, h: number, thick: number, level: number): void {
  for (const s of [-1, 1]) {
    const x = s * 3.5, z = R + thick / 2 + 1.7;
    g.add(box(2.3, 1.5, 2.8, ST_DK, x, 0, z), box(2.5, 0.2, 3.0, ST_LT, x, 1.5, z));
    g.add(box(2.36, 0.3, 2.86, PAINT, x, 0.9, z));
    const hd = serpentHead(1.55, ST, true);
    hd.position.set(x, 1.7, z - 1.1);
    g.add(hd);
  }
  g.add(box(8.4, 0.8, 1.1, ST, 0, h + 2.4, R));
  g.add(box(8.5, 0.24, 1.2, PAINT, 0, h + 2.7, R));
  g.add(box(4.8, 0.7, 1.0, ST_LT, 0, h + 3.2, R));
  for (const x of [-2.6, 2.6]) g.add(glow(new THREE.BoxGeometry(0.4, 0.3, 0.06)).translateX(x).translateY(h + 2.8).translateZ(R + 0.62));
  if (level >= 20) {
    const d = sunDisc(1.3, true);
    d.position.set(0, h + 5.4, R + 0.3);
    g.add(d);
  }
}

// ---------- lamps and landmarks ----------

/** A street lamp of the temple-city: a stepped pillar of stone, a jade inlay on its face and a stone bowl of fire on top (its fire is window-glass, so it lights up at night). */
export function saurianLamp(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.72, 0.3, 0.72, ST_DK));
  g.add(box(0.46, 2.0, 0.46, ST, 0, 0.3, 0));
  g.add(box(0.52, 0.14, 0.52, PAINT, 0, 1.7, 0));
  g.add(glow(new THREE.BoxGeometry(0.16, 0.16, 0.05)).translateY(1.25).translateZ(0.24));
  g.add(cyl(0.38, 0.22, 0.28, ST_LT, 7, 0, 2.3));
  const f = box(0.3, 0.3, 0.3, C.window, 0, 2.5, 0);
  f.userData.window = true;
  g.add(f);
  return g;
}

/** The odds and ends lying about the streets, the temple-city's way: a basket of fruit, a bundle of cut fronds, a tall jar, baskets stacked. */
export function saurianProp(kind: string, x: number, z: number, s: number): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'pumpkin') g.add(basket(1.1 * s, s > 1 ? F_RED : F_YEL, 0, 0));
  else if (kind === 'hay') {
    for (let i = 0; i < 4; i++) {
      const f = limb(V(-0.9, 0.12 + (i % 2) * 0.12, (i - 1.5) * 0.18), V(0.9, 0.18, (i - 1.5) * 0.2), 0.12, 0.05, i % 2 ? FROND : FROND_DK, 4);
      g.add(f);
    }
    g.add(box(0.1, 0.34, 0.9, ROPE_T, 0, 0, 0));
    g.scale.setScalar(s * 1.6);
  } else if (kind === 'barrel') g.add(jar(1.3, 0, 0));
  else g.add(basket(1.0, THATCH, 0, 0), basket(0.8, F_YEL, 0.1, 0.05, 0.4));
  g.position.set(x, 0, z);
  return g;
}

/** The mastery trophy of a building's own trade, where the temple-city has one: a golden raptor at the stable. (null: the usual one.) */
export function saurianTrophy(id: BuildingId): THREE.Group | null {
  if (id !== 'stable') return null;
  const g = new THREE.Group();
  g.add(box(1.4, 0.5, 0.8, ST_LT));
  g.add(box(1.5, 0.12, 0.9, PAINT, 0, 0.36, 0));
  const rp = raptor(GOLD, GOLD, null);
  rp.scale.setScalar(0.42);
  rp.position.y = 0.5;
  g.add(rp);
  return g;
}

/** A giant stone head, sunk to the chin and tilted, half swallowed by the jungle: a crested helm, jade eyes that still glow, ear-spools and a snarl of fangs, vines over it. */
export function stoneHead(s: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  const hd = new THREE.Group();
  hd.add(box(2.2 * s, 2.4 * s, 2.0 * s, ST_OLD));
  hd.add(box(2.4 * s, 0.5 * s, 2.1 * s, ST, 0, 2.3 * s, 0), box(1.4 * s, 0.5 * s, 1.6 * s, ST, 0, 2.8 * s, -0.1 * s));
  hd.add(box(2.42 * s, 0.2 * s, 2.12 * s, PAINT, 0, 2.2 * s, 0));
  hd.add(box(2.3 * s, 0.35 * s, 0.4 * s, ST_DK, 0, 1.55 * s, 0.95 * s));
  for (const x of [-1, 1]) {
    hd.add(glow(new THREE.BoxGeometry(0.44 * s, 0.22 * s, 0.08 * s)).translateX(x * 0.5 * s).translateY(1.36 * s).translateZ(1.02 * s));
    hd.add(cyl(0.42 * s, 0.42 * s, 0.2 * s, ST, 8, x * 1.15 * s, 1.1 * s, 0).rotateZ(Math.PI / 2));
    hd.add(cone(0.08 * s, 0.3 * s, ST_LT, 4, x * 0.3 * s, 0.1 * s, 1.08 * s));
  }
  hd.add(box(0.5 * s, 0.6 * s, 0.4 * s, ST, 0, 0.8 * s, 1.05 * s));
  hd.add(box(1.2 * s, 0.24 * s, 0.1 * s, DOORWAY, 0, 0.3 * s, 1.02 * s));
  hd.position.y = -0.6 * s;
  hd.rotation.set(0.1, 0, (r() - 0.5) * 0.25);
  g.add(hd);
  const seed = Math.floor(r() * 1000);
  g.add(leafCluster(1.0 * s, 'deep', -0.3 * s, 2.6 * s, -0.3 * s, 1.4, 0.6, 1.3, 0, seed));
  g.add(leafCluster(0.7 * s, 'mid', 0.6 * s, 2.3 * s, 0.4 * s, 1.2, 0.6, 1.1, 0, seed + 1));
  for (let i = 0; i < 4; i++) {
    const v = vine((1.2 + (i % 2) * 0.6) * s, seed + i);
    const x = (-0.9 + i * 0.6) * s;
    v.position.set(x, 2.4 * s, (i % 2 ? 1.08 : -1.05) * s);
    if (i % 2 === 0) v.rotation.y = Math.PI;
    g.add(v);
  }
  g.add(ferns(1.2 * s, r).translateX(1.3 * s).translateZ(0.8 * s), bromeliad(0.8 * s).translateX(-1.4 * s).translateZ(0.9 * s));
  return g;
}

/** A small swarm of fireflies in jade and gold, merged into one mesh, drifting round a spot. */
export function jadeFlies(n: number, rad: number, height: number, r: () => number): THREE.Group {
  const parts = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = rad * (0.3 + r() * 0.7);
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(i % 3 ? 0.11 : 0.15, 0), detailMat(i % 2 ? 0x9affc8 : 0xffe070, { emissive: i % 2 ? 0x1f9a60 : 0xa07a10 }));
    m.position.set(Math.cos(a) * d, r() * height, Math.sin(a) * d);
    parts.add(m);
  }
  return swarm(parts, { orbit: 0.16 + r() * 0.1, bob: 0.4 });
}

let mistMat: THREE.MeshBasicMaterial | null = null;
/** Low banks of mist: soft pale blobs merged into one, that rise and settle a little. */
export function mist(spots: [number, number, number, number][]): THREE.Group {
  mistMat ??= new THREE.MeshBasicMaterial({ color: 0xe6f2ea, transparent: true, opacity: 0.16, depthWrite: false });
  const parts = new THREE.Group();
  for (const [x, y, z, s] of spots) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), mistMat);
    m.scale.set(1.6, 0.28, 1.2);
    m.position.set(x, y, z);
    parts.add(m);
  }
  return swarm(parts, { bob: 0.25 });
}

/** A landmark for the open ground inside the walls: a serpent column, a giant stone head in the vines, a jade idol in a lily pool, or a stela among palms and blooms. */
export function templeLandmark(r: () => number): THREE.Group {
  const k = Math.floor(r() * 4);
  const g = new THREE.Group();
  if (k === 0) {
    g.add(serpentColumn(3.4));
    g.add(ferns(1.0, r).translateX(1.1).translateZ(0.6), bromeliad(0.8).translateX(-1.0).translateZ(0.8));
  } else if (k === 1) {
    g.add(stoneHead(0.72, r));
  } else if (k === 2) {
    g.add(pool(1.5, r, 5));
    g.add(box(0.7, 0.8, 0.7, ST, 0, 0, 0), box(0.8, 0.12, 0.8, ST_LT, 0, 0.8, 0));
    g.add(glow(new THREE.BoxGeometry(0.34, 0.44, 0.26)).translateY(1.14));
    g.add(glow(new THREE.BoxGeometry(0.44, 0.24, 0.3)).translateY(1.46));
    const ff = jadeFlies(6, 1.8, 2.2, r);
    ff.position.y = 0.6;
    g.add(ff);
  } else {
    g.add(stela(2.2));
    const p = palm(3.8, r);
    p.position.set(-0.9, 0, -0.8);
    g.add(p);
    g.add(bloom(0.9).translateX(1.1).translateZ(0.7), bromeliad(0.7).translateX(-1.2).translateZ(0.8));
  }
  return g;
}

interface GroundKit {
  at: (x: number, z: number) => number;
  free: (x: number, z: number) => boolean;
  wallR: number;
}

/** A lookout platform on bamboo legs, railed and thatched (the rope bridges run between them). */
function stiltPlatform(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(stilts(2.4, 2.4, h));
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(pole(x * 1.15, z * 1.15, 2.0, 0.07, h + 0.2));
  for (const s of [-1, 1]) g.add(limb(V(-1.2, h + 1.0, s * 1.2), V(1.2, h + 1.0, s * 1.2), 0.04, 0.04, BAMBOO, 4), limb(V(s * 1.2, h + 1.0, -1.2), V(s * 1.2, h + 1.0, 1.2), 0.04, 0.04, BAMBOO, 4));
  const rf = thatchRoof(2.3, 2.3, 1.3, { over: 0.35 });
  rf.position.y = h + 2.2;
  g.add(rf);
  const lad = ladder(h);
  lad.position.set(0, 0, 1.6);
  g.add(lad);
  return g;
}

/** A rope bridge sagging between two points: planks on ropes, rope rails either side. */
function ropeBridge(a: THREE.Vector3, b: THREE.Vector3, sag: number): THREE.Group {
  const g = new THREE.Group();
  const n = Math.max(6, Math.round(a.distanceTo(b) / 0.5));
  const yaw = Math.atan2(b.x - a.x, b.z - a.z);
  const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const at = (k: number) => a.clone().lerp(b, k).add(new THREE.Vector3(0, -Math.sin(k * Math.PI) * sag, 0));
  for (let i = 0; i <= n; i++) {
    const p = at(i / n);
    const pl = box(1.0, 0.07, 0.34, i % 3 ? WOOD : WOOD, 0, 0, 0);
    pl.position.copy(p);
    pl.rotation.y = yaw + Math.PI / 2;
    g.add(pl);
  }
  for (const s of [-0.55, 0.55]) {
    for (let i = 0; i < n; i++) {
      const p = at(i / n).addScaledVector(side, s).setY(at(i / n).y + 0.9), q = at((i + 1) / n).addScaledVector(side, s).setY(at((i + 1) / n).y + 0.9);
      g.add(limb(p, q, 0.025, 0.025, ROPE_T, 3));
    }
  }
  return g;
}

/**
 * The jungle round the temple-city: at the clearing outside the gate the ruin of an older temple, a
 * waterfall pouring from a serpent's mouth into a lily pool, giant stone heads sunk in the ferns, and two
 * lookouts on stilts joined by a rope bridge; stelae and torches down the road; stone heads, broken
 * serpent columns, pools, palms, bromeliads and great blooms out in the green; mist over the water,
 * fireflies in jade and gold, and winged lizards wheeling overhead.
 */
export function addTempleJungle(g: THREE.Group, r: () => number, k: GroundKit): void {
  quietDetails();
  const { at } = k;
  const cx = 21, cz = 57.5;
  const y0 = at(cx, cz);
  // the old temple, its top fallen in
  const ruin = stepPyramid({ levels: 3, w0: 8.0, d0: 6.6, w1: 4.6, d1: 3.4, stepH: 1.3, heads: 0.6, seed: 71, vines: 10, stairW: 2.0 });
  ruin.g.position.set(cx + 2.5, y0 - 0.25, cz - 5.2);
  g.add(ruin.g);
  for (let i = 0; i < 5; i++) {
    const b = box(0.9 + r() * 0.5, 0.6, 0.7, i % 2 ? ST_OLD : ST, cx + 2.5 + (r() - 0.5) * 3.6, y0 - 0.25 + ruin.top, cz - 5.2 + (r() - 0.5) * 2.4);
    b.rotation.set((r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4);
    g.add(b);
  }
  g.add(leafCluster(1.4, 'deep', cx + 2.0, y0 + ruin.top + 0.4, cz - 5.6, 1.4, 0.7, 1.2, 0, 7), leafCluster(1.0, 'mid', cx + 3.8, y0 + ruin.top + 0.3, cz - 4.6, 1.3, 0.6, 1.1, 0, 8));
  // a waterfall from a serpent's mouth on its flank into a lily pool
  const sx = cx - 2.4, sz = cz - 4.0;
  g.add(box(1.6, 3.6, 1.6, ST_OLD, sx, y0 - 0.2, sz));
  const sp = serpentHead(0.6, ST_OLD, true);
  sp.position.set(sx, y0 + 2.4, sz + 0.5);
  g.add(sp);
  const wf = waterfall(0.9, 2.6);
  wf.position.set(sx, y0 - 0.1, sz + 1.55);
  g.add(wf);
  const lp = pool(2.6, r, 8);
  lp.position.set(sx + 0.4, y0 - 0.12, sz + 3.6);
  g.add(lp);
  g.add(mist([[sx + 0.4, y0 + 0.5, sz + 3.4, 1.6], [sx - 1.2, y0 + 0.7, sz + 2.2, 1.2], [sx + 1.9, y0 + 0.6, sz + 4.6, 1.3]]));
  for (const [dx, dz, s] of [[-8.4, 2.4, 1.45], [9.6, 3.6, 1.3]] as [number, number, number][]) {
    const x = cx + dx, z = cz + dz;
    const hd = stoneHead(s, r);
    hd.position.set(x, at(x, z), z);
    hd.rotation.y = Math.atan2(cx - x, cz - z) + (r() - 0.5) * 0.6;
    g.add(hd);
  }
  // two lookouts on stilts, a rope bridge between them
  const pa = V(cx - 7.0, 0, cz - 7.6), pb = V(cx + 9.4, 0, cz - 6.4);
  for (const p of [pa, pb]) {
    const pl = stiltPlatform(3.4);
    pl.position.set(p.x, at(p.x, p.z) - 0.1, p.z);
    pl.rotation.y = Math.atan2(cx - p.x, cz - p.z);
    g.add(pl);
  }
  g.add(ropeBridge(V(pa.x + 1.2, at(pa.x, pa.z) + 3.5, pa.z + 0.1), V(pb.x - 1.2, at(pb.x, pb.z) + 3.5, pb.z), 1.4));
  for (const [dx, dz] of [[-3.8, 3.8], [4.6, 5.8], [-5.4, -1.0], [6.0, -1.6]] as [number, number][]) {
    const x = cx + dx, z = cz + dz;
    const p = palm(4.2 + r() * 1.2, r);
    p.position.set(x, at(x, z) - 0.1, z);
    g.add(p);
  }
  for (const [dx, dz] of [[-1.0, 6.2], [2.6, 3.4], [-6.0, 5.2]] as [number, number][]) {
    const x = cx + dx, z = cz + dz;
    g.add(bloom(1.1, [0xd8452c, 0xf08a2a, 0xc8305a][Math.floor(r() * 3)]).translateX(x).translateY(at(x, z)).translateZ(z));
  }
  const ff = jadeFlies(14, 7, 3.5, r);
  ff.position.set(cx, y0 + 0.5, cz - 2);
  g.add(ff);
  const fl = flock(4, 12, y0 + 13, 5, 0.18, 131, 1.4);
  fl.position.set(cx + 2, 0, cz - 4);
  g.add(fl);
  // stelae and torches down the road out of the gate
  for (const z of [51, 60, 69, 78]) for (const x of [-4.1, 4.1]) {
    const y = at(x, z);
    if ((z / 9) % 2 < 1) {
      const s = stela(1.8);
      s.scale.setScalar(0.8);
      s.position.set(x, y - 0.05, z);
      s.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(s);
    } else {
      const tr = bambooTorch(2.6);
      tr.position.set(x, y - 0.05, z);
      g.add(tr);
    }
  }
  // out in the green: stone heads, fallen columns, pools, palms, bromeliads and blooms
  let placed = 0;
  const flies: [number, number, number][] = [];
  for (let tries = 0; tries < 1200 && placed < 70; tries++) {
    const a = r() * Math.PI * 2, d = k.wallR + 7 + r() * 76;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!k.free(x, z)) continue;
    if (Math.hypot(x - cx, z - cz) < 14) continue;
    const y = at(x, z);
    const kind = placed % 10;
    if (kind === 0 && placed % 20 === 0) {
      const hd = stoneHead(0.95 + r() * 0.4, r);
      hd.position.set(x, y, z);
      hd.rotation.y = r() * 6;
      g.add(hd);
    } else if (kind === 1) {
      // a serpent column, broken: its stump standing, drums of it fallen in the ferns
      g.add(box(1.2, 0.35, 1.2, ST_DK, x, y - 0.05, z), cyl(0.42, 0.46, 1.2 + r() * 1.4, ST_OLD, 8, x, y + 0.3, z));
      for (let i = 0; i < 2; i++) {
        const c = cyl(0.42, 0.42, 0.9, ST_OLD, 8, 0, 0, 0);
        c.rotation.set(Math.PI / 2, r() * 3, 0);
        c.position.set(x + 1.2 + i * 0.9, y + 0.35, z + (r() - 0.5) * 1.2);
        g.add(c);
      }
      g.add(moss(0.5, x, y + 1.6, z, placed));
    } else if (kind === 2 || kind === 7) {
      const p = palm(4 + r() * 2, r);
      p.position.set(x, y - 0.1, z);
      g.add(p);
    } else if (kind === 3) {
      const p = pool(1.2 + r() * 0.8, r, 4);
      p.position.set(x, y - 0.08, z);
      g.add(p);
      if (flies.length < 4) flies.push([x, y, z]);
    } else if (kind === 4 || kind === 8) {
      for (let i = 0; i < 3; i++) g.add(bromeliad(0.8 + r() * 0.5, i % 2 ? F_RED : 0xf08a2a).translateX(x + (r() - 0.5) * 1.8).translateY(y).translateZ(z + (r() - 0.5) * 1.8));
    } else if (kind === 5) {
      g.add(bloom(0.9 + r() * 0.5, [0xd8452c, 0xf08a2a, 0xc8305a][Math.floor(r() * 3)]).translateX(x).translateY(y).translateZ(z));
      g.add(ferns(1.1, r).translateX(x + 0.9).translateY(y).translateZ(z + 0.4));
    } else if (kind === 6 && placed % 20 === 6) {
      const s = stela(1.6 + r() * 0.8);
      s.position.set(x, y - 0.1, z);
      s.rotation.set((r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.2);
      g.add(s);
    } else {
      const b = banana(1.0 + r() * 0.4, r, r() < 0.5);
      b.position.set(x, y, z);
      g.add(b);
    }
    placed++;
  }
  for (const [x, y, z] of flies) {
    const f = jadeFlies(8, 2.6, 2.4, r);
    f.position.set(x, y + 0.4, z);
    g.add(f);
  }
  const wide = flock(5, 64, 26, 8, 0.06, 173, 1.6);
  g.add(wide);
  void getSeason;
}

// ---------- the hero at home, the camp, the mastery ----------

/**
 * The Saurian King at home: his pack prowls round his statue (three raptors loping in a ring), the ground
 * under them throbbing jade with a slow cold-blooded heartbeat, and motes of jade and gold rising.
 */
export function saurianAura(r: () => number, statue: [number, number]): Aura {
  const g = new THREE.Group();
  const [sx, sz] = statue;
  const ring = new THREE.Group();
  const pack = new THREE.Group();
  const cols = [0xa8784a, 0x56697a, 0x8a2e26];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const rp = raptor(cols[i], i === 1 ? 0xf2a03a : F_RED, null);
    rp.scale.setScalar(0.62);
    // running round the ring (anticlockwise as the ring turns), so each faces along it
    rp.position.set(Math.cos(a) * 4.7, 0, Math.sin(a) * 4.7);
    rp.rotation.y = -a - Math.PI / 2;
    pack.add(rp);
  }
  ring.add(bake(pack));
  ring.position.set(sx, 0, sz);
  g.add(ring);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x5affb0, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
  const glowRing = new THREE.Mesh(new THREE.RingGeometry(3.6, 5.8, 48).rotateX(-Math.PI / 2), ringMat);
  glowRing.position.set(sx, 0.07, sz);
  g.add(glowRing);
  const specks: { m: THREE.Mesh; x: number; z: number; y: number; v: number; ph: number }[] = [];
  for (let i = 0; i < 18; i++) {
    const m = mesh(new THREE.OctahedronGeometry(0.12, 0), i % 2 ? 0x9affc8 : 0xffe070, { emissive: i % 2 ? 0x1f9a60 : 0xa07a10 });
    const a = r() * Math.PI * 2, d = 3.4 + r() * 2.6;
    const s = { m, x: sx + Math.cos(a) * d, z: sz + Math.sin(a) * d, y: r() * 7, v: 0.6 + r() * 0.9, ph: r() * 6 };
    specks.push(s);
    g.add(m);
  }
  return {
    group: g,
    step(dt, t) {
      ring.rotation.y = -t * 0.55;
      ring.position.y = Math.abs(Math.sin(t * 7.5)) * 0.1;
      // a slow double beat, then a long rest
      const p = (t * 0.55) % 1;
      const beat = Math.max(0, 1 - Math.abs(p - 0.08) * 10) + Math.max(0, 1 - Math.abs(p - 0.24) * 10) * 0.7;
      ringMat.opacity = 0.12 + beat * 0.3;
      for (const s of specks) {
        s.y += s.v * dt;
        if (s.y > 7) s.y = 0.2;
        s.m.position.set(s.x + Math.sin(t + s.ph) * 0.4, s.y, s.z + Math.cos(t * 0.8 + s.ph) * 0.4);
        s.m.scale.setScalar(0.6 + 0.6 * Math.sin(Math.PI * (s.y / 7)));
      }
    },
    dispose() {
      g.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      ringMat.dispose();
    },
  };
}

/** A support tent of the temple-city: a round hut of woven cane under a tall palm thatch, a feathered pennant, a jade lantern at the door. (Its door faces +z.) */
export function saurianTent(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(1.3, 1.35, 0.2, ST_DK, 9));
  g.add(cyl(1.15, 1.2, 1.2, WATTLE, 9, 0, 0.2));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    g.add(cyl(0.05, 0.05, 1.2, BAMBOO_DK, 4, Math.cos(a) * 1.2, 0.2, Math.sin(a) * 1.2));
  }
  g.add(cone(1.6, 0.5, THATCH_DK, 9, 0, 1.3));
  g.add(cone(1.35, 1.5, THATCH, 9, 0, 1.4));
  g.add(cone(0.24, 0.4, THATCH_DK, 5, 0, 2.8));
  g.add(box(0.6, 0.95, 0.1, DOORWAY, 0, 0.2, 1.17));
  g.add(pole(0, 0, 0.9, 0.04, 2.8));
  const pen = new THREE.Group();
  pen.add(box(0.6, 0.3, 0.04, F_RED, 0.3, 0, 0));
  pen.add(feather(0.3, 0.1, F_YEL).rotateZ(-Math.PI / 2).translateY(0.15));
  pen.position.y = 3.5;
  settle(pen);
  pen.userData.flag = true;
  g.add(pen);
  g.add(cyl(0.03, 0.03, 1.1, WOOD, 4, 0.8, 0, 1.3));
  g.add(glow(new THREE.OctahedronGeometry(0.15, 0)).translateX(0.8).translateY(1.2).translateZ(1.3));
  return g;
}

/** A mastery standard: a pole with a jade-eyed serpent's head and its crest on top, a streamer of red and gold, a jade orb glowing under the head. */
export function saurianStandard(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.5, 0.3, 0.5, ST_DK));
  g.add(pole(0, 0, h, 0.07, 0.3));
  const hd = serpentHead(0.3, GOLD, true);
  hd.position.set(0, h + 0.3, -0.15);
  g.add(hd);
  g.add(glow(new THREE.IcosahedronGeometry(0.16, 0)).translateY(h + 0.1));
  const st = new THREE.Group();
  st.add(box(0.5, 1.0, 0.04, PAINT, 0.28, -1.0, 0));
  st.add(box(0.5, 0.12, 0.05, GOLD, 0.28, -0.35, 0));
  st.add(feather(0.4, 0.14, F_YEL).rotateZ(Math.PI).translateX(-0.28).translateY(0.98));
  st.position.y = h - 0.1;
  settle(st);
  st.userData.flag = true;
  g.add(st);
  return g;
}

/** The mastery crown: a bowl of gold on a stepped stand burning with a jade flame, a fan of feathers behind it, jade and gold motes wheeling round it. */
export function saurianCrown(s: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.9 * s, 0.2 * s, 0.9 * s, ST), box(0.56 * s, 0.24 * s, 0.56 * s, ST_LT, 0, 0.2 * s, 0));
  g.add(cyl(0.42 * s, 0.24 * s, 0.3 * s, GOLD, 8, 0, 0.44 * s));
  const fan = featherFan(7, 1.0 * s, 1.8, [F_RED, F_YEL, F_TQ, F_RED, F_TQ, F_YEL, F_RED], 0.24 * s);
  fan.position.set(0, 0.7 * s, -0.28 * s);
  fan.rotation.x = -0.15;
  g.add(fan);
  const f = new THREE.Group();
  f.add(glow(new THREE.ConeGeometry(0.3 * s, 0.9 * s, 6).translate(0, 0.45 * s, 0)));
  f.add(glow(new THREE.ConeGeometry(0.16 * s, 0.6 * s, 5).translate(0, 0.3 * s, 0), 0xd8ffe8, 0x3aa878));
  f.position.y = 0.72 * s;
  f.userData.dynamic = true;
  f.userData.fire = true;
  g.add(f);
  const parts = new THREE.Group();
  for (let i = 0; i < 6; i++) parts.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), detailMat(i % 2 ? 0x9affc8 : 0xffe070, { emissive: i % 2 ? 0x1f9a60 : 0xa07a10 })).translateX(Math.cos(i) * 1.1 * s).translateY(0.6 * s + (i % 3) * 0.3 * s).translateZ(Math.sin(i) * 1.1 * s));
  g.add(swarm(parts, { orbit: 0.35, bob: 0.25 }));
  return g;
}

// ---------- in battle ----------

/** The bonehead brought to batter a gate: gold plate studded on its dome, a war-blanket, ropes to its handlers. `log` is the beast itself, which lunges forward (+z) at every blow. */
export function boneheadRam(): { g: THREE.Group; log: THREE.Group } {
  const g = new THREE.Group();
  const log = new THREE.Group();
  const b = bonehead(0x8a6a48);
  b.add(box(0.5, 0.1, 0.5, GOLD, 0.95, 2.06, 0));
  for (let i = 0; i < 3; i++) b.add(cone(0.06, 0.16, GOLD, 4, 0.8 + i * 0.15, 2.1, (i - 1) * 0.16));
  b.add(box(1.0, 0.1, 0.9, PAINT, -0.05, 1.62, 0), box(1.02, 0.4, 0.04, PAINT, -0.05, 1.25, 0.46), box(1.02, 0.4, 0.04, PAINT, -0.05, 1.25, -0.46));
  b.rotation.y = -Math.PI / 2;
  b.position.z = 1.0;
  log.add(b);
  for (const x of [-0.45, 0.45]) log.add(limb(V(x * 0.5, 1.3, 0.2), V(x, 1.0, -1.4), 0.025, 0.025, ROPE_T, 3));
  log.position.y = 0;
  g.add(log);
  return { g, log };
}
