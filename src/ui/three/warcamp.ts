// The Warcamp: the Horde's own buildings and pieces. The Orc King's seat grows from a
// chieftain's hide yurt round a fire pit into a mead-hall framed by giant tusks, then a
// great hall of dark stone with a skull-throne glowing through its door, and at last a
// warlord's fortress: a battered keep under a timber gallery, crowned by the horned skull
// of some colossal beast, the hall's door the mouth of another. Around it: fighting pits,
// warg dens, a war forge running with molten iron, siege yards, war drums and bonfires.
//
// Everything that stands still is baked with its building (one mesh per material); the
// only moving parts are a few live flames, war banners and one merged swarm of embers.

import * as THREE from 'three';
import type { BuildingId } from '../../engine/types';
import type { Built } from './buildings';
import {
  BLOOD, BONE_SH, BONE_W, C, EMBER, EMBER_E, HIDE_C, HIDE_DK, IRON_BK, MOLTEN, MOLTEN_E, ROPE, SOCKET, blob, box, cone, cyl, detailMat,
  getSeason, horn, hornPair, house, limb, mesh, orcSkull, rng, roundTower, stake, swarm,
} from './kit';
import { anvil, barrel, crate, logPile, stall, warBoar, warg } from './props';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const SAND = 0x7a6448, GORE = 0x5e3a2a, SKIN_TOP = 0xcdb58a, FLAME = 0xffa040, FLAME_E = 0xc05010;

/** A small bright thing that glows and casts no shadow (coals, molten iron, embers in a skull). */
function glow(geo: THREE.BufferGeometry, c = EMBER, e = EMBER_E): THREE.Mesh {
  return new THREE.Mesh(geo, detailMat(c, { emissive: e }));
}

/** A flame that flickers (kept apart from the bake so it can move): a warm outer tongue and a bright core. */
function flame(s = 1): THREE.Group {
  const f = new THREE.Group();
  f.add(glow(new THREE.ConeGeometry(0.34 * s, 0.95 * s, 6).translate(0, 0.47 * s, 0), FLAME, FLAME_E));
  f.add(glow(new THREE.ConeGeometry(0.18 * s, 0.6 * s, 5).translate(0, 0.3 * s, 0), 0xffd070, 0xd08a20));
  f.userData.dynamic = true;
  f.userData.fire = true;
  return f;
}

/** An iron fire basket on three splayed legs, heaped with glowing coals (a live flame on the grander ones). */
export function brazier(h: number, live = false, s = 1): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    g.add(limb(V(Math.cos(a) * 0.45 * s, 0, Math.sin(a) * 0.45 * s), V(Math.cos(a) * 0.14 * s, h, Math.sin(a) * 0.14 * s), 0.05 * s, 0.04 * s, IRON_BK, 4));
  }
  g.add(cyl(0.5 * s, 0.26 * s, 0.4 * s, IRON_BK, 7, 0, h));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.add(cone(0.05 * s, 0.26 * s, IRON_BK, 4, Math.cos(a) * 0.48 * s, h + 0.36 * s, Math.sin(a) * 0.48 * s));
  }
  g.add(glow(new THREE.CylinderGeometry(0.44 * s, 0.44 * s, 0.08, 7)).translateY(h + 0.36 * s));
  if (live) {
    const f = flame(s);
    f.position.y = h + 0.36 * s;
    g.add(f);
  } else g.add(glow(new THREE.ConeGeometry(0.26 * s, 0.55 * s, 5).translate(0, 0.27 * s, 0), FLAME, FLAME_E).translateY(h + 0.36 * s));
  return g;
}

/** A war drum: a great hide-topped barrel on short legs, rope laced round it, bone beaters laid on it. */
export function warDrum(s = 1): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    g.add(cyl(0.06 * s, 0.07 * s, 0.4 * s, C.timber, 4, Math.cos(a) * 0.42 * s, 0, Math.sin(a) * 0.42 * s));
  }
  g.add(cyl(0.64 * s, 0.56 * s, 0.95 * s, C.timberLight, 9, 0, 0.35 * s));
  g.add(cyl(0.66 * s, 0.66 * s, 0.07 * s, SKIN_TOP, 9, 0, 1.28 * s));
  for (const y of [0.42, 1.2]) g.add(cyl(0.67 * s, 0.67 * s, 0.07 * s, ROPE, 9, 0, y * s));
  // the rope laced zig-zag round the barrel
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const l = box(0.04 * s, 0.85 * s, 0.04 * s, ROPE, Math.cos(a) * 0.62 * s, 0.4 * s, Math.sin(a) * 0.62 * s);
    l.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35 * (i % 2 ? 1 : -1));
    g.add(l);
  }
  for (const k of [-1, 1]) {
    const b = limb(V(k * 0.2 * s, 1.36 * s, 0.1 * s), V(k * 0.5 * s, 1.4 * s, 0.55 * s), 0.035 * s, 0.03 * s, BONE_W, 4);
    g.add(b, blob(0.07 * s, BONE_W, k * 0.5 * s, 1.4 * s, 0.55 * s));
  }
  return g;
}

/** A war standard: a pole with a crossbar, a long ragged cloth hanging from it with a skull daubed on, a horned skull on top. */
export function warStandard(color: number, h: number, live = true): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.08, 0.11, h, C.timber, 5));
  g.add(box(1.5, 0.12, 0.12, C.timber, 0, h - 0.5, 0));
  const cloth = new THREE.Group();
  cloth.add(box(1.3, 1.7, 0.05, color, 0, -1.7, 0));
  for (const x of [-0.43, 0, 0.43]) cloth.add(cone(0.22, 0.42, color, 3, x, -1.7, 0).rotateZ(Math.PI));
  cloth.add(blob(0.24, BONE_W, 0, -0.85, 0.04, 1, 1, 0.25));
  cloth.add(box(0.26, 0.07, 0.02, BONE_W, 0, -1.2, 0.04));
  cloth.position.set(0, h - 0.52, 0.09);
  if (live) {
    cloth.userData.dynamic = true;
    cloth.userData.flag = true;
  }
  g.add(cloth);
  const sk = orcSkull(0.4);
  sk.position.set(0, h + 0.18, 0);
  g.add(sk);
  g.add(hornPair(0.16, h + 0.3, 0, 0.32, 0.55, 0.05, 0.07));
  return g;
}

/** A carved post: stacked blocks with faces cut in them, skulls, a blood-red rag, a horned skull on top with embers for eyes. */
export function orcTotem(h: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.2, 0.27, h, C.timber, 6));
  for (const [y, s] of [[h * 0.3, 0.55], [h * 0.62, 0.48]]) {
    const b = box(s, s * 1.1, s, C.timberLight, 0, y - s * 0.55, 0);
    b.rotation.y = r() * 0.6;
    g.add(b);
    g.add(box(0.1, 0.06, 0.05, SOCKET, -0.1, y + 0.08, s / 2 + 0.01), box(0.1, 0.06, 0.05, SOCKET, 0.1, y + 0.08, s / 2 + 0.01), box(0.24, 0.06, 0.05, SOCKET, 0, y - 0.14, s / 2 + 0.01));
  }
  g.add(box(0.9, 0.1, 0.1, C.timber, 0, h * 0.82, 0));
  g.add(box(0.36, 0.8, 0.04, C.red, 0.36, h * 0.82 - 0.8, 0.02));
  const sk = orcSkull(0.5, true);
  sk.position.set(0, h + 0.22, 0.02);
  g.add(sk);
  g.add(hornPair(0.2, h + 0.35, -0.05, 0.4, 0.7, 0.1, 0.09));
  const low = orcSkull(0.3);
  low.position.set(-0.3, h * 0.45, 0.2);
  g.add(low);
  return g;
}

/** A fire pit: a ring of stones, crossed logs, glowing coals and a live flame. */
function firePit(x: number, z: number, s = 1, live = true): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(blob(0.22 * s, C.stoneDark, Math.cos(a) * 0.75 * s, 0.08, Math.sin(a) * 0.75 * s, 1.1, 0.7, 1));
  }
  for (let i = 0; i < 3; i++) {
    const l = box(0.16 * s, 0.16 * s, 1.2 * s, C.timber, 0, 0.06, 0);
    l.rotation.y = (i * Math.PI) / 3;
    g.add(l);
  }
  g.add(glow(new THREE.CylinderGeometry(0.45 * s, 0.5 * s, 0.1, 7)).translateY(0.14));
  if (live) {
    const f = flame(1.25 * s);
    f.position.y = 0.16;
    g.add(f);
  } else g.add(glow(new THREE.ConeGeometry(0.35 * s, 0.8 * s, 6).translate(0, 0.4 * s, 0), FLAME, FLAME_E).translateY(0.16));
  g.position.set(x, 0, z);
  return g;
}

/** A run of sharpened stakes along an arc (centre cx, cz; radius R; from a0 to a1), leaning out. */
function stakeArc(g: THREE.Group, cx: number, cz: number, R: number, a0: number, a1: number, n: number, h = 1.5, lean = 0.4): void {
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / Math.max(1, n - 1);
    g.add(stake(cx + Math.cos(a) * R, 0, cz + Math.sin(a) * R, h * (0.85 + (i % 3) * 0.12), 0.13, a, lean));
  }
}

/** A straight run of sharpened stakes from (x0, z0) to (x1, z1), leaning to one side. */
function stakeLine(g: THREE.Group, x0: number, z0: number, x1: number, z1: number, n: number, h = 1.3, out = 0): void {
  const a = Math.atan2(z1 - z0, x1 - x0) + Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const k = i / Math.max(1, n - 1);
    g.add(stake(x0 + (x1 - x0) * k, 0, z0 + (z1 - z0) * k, h * (0.85 + (i % 3) * 0.12), 0.12, a, out));
  }
  // a rail lashed across them
  g.add(limb(V(x0, h * 0.45, z0), V(x1, h * 0.45, z1), 0.06, 0.06, C.timber, 4));
}

/** A pole hung with skulls: the tally of a warband's kills. */
function skullRack(n: number): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.75, 0.75]) g.add(cyl(0.08, 0.1, 2.4, C.timber, 5, x, 0, 0));
  g.add(box(1.8, 0.12, 0.12, C.timber, 0, 2.3, 0));
  for (let i = 0; i < n; i++) {
    const x = -0.5 + (i * 1.0) / Math.max(1, n - 1);
    g.add(box(0.02, 0.35, 0.02, ROPE, x, 1.95, 0));
    const sk = orcSkull(0.3);
    sk.position.set(x, 1.8, 0);
    g.add(sk);
  }
  return g;
}

/** The skull of some colossal beast, facing +z: a great cranium, a long snout, embers burning in its sockets,
 *  tusks curling up from its jaw and horns sweeping out and up. Its origin is under the brow. */
export function beastSkull(s: number, jaw = false): THREE.Group {
  const g = new THREE.Group();
  // a broad, low cranium
  g.add(blob(1.0 * s, BONE_W, 0, 0.05 * s, -0.2 * s, 1.15, 0.7, 1.0, 1));
  // a heavy brow slanting down to the middle in a scowl, deep sockets under it with embers burning in them
  for (const x of [-1, 1]) {
    const br = box(0.95 * s, 0.24 * s, 0.5 * s, BONE_SH, 0, 0, 0);
    br.geometry.translate(0, -0.12 * s, 0);
    br.position.set(x * 0.46 * s, 0.24 * s, 0.6 * s);
    br.rotation.z = x * 0.3;
    g.add(br);
    g.add(box(0.36 * s, 0.26 * s, 0.1 * s, SOCKET, x * 0.42 * s, -0.16 * s, 0.8 * s));
    g.add(glow(new THREE.OctahedronGeometry(0.12 * s, 0)).translateX(x * 0.42 * s).translateY(-0.05 * s).translateZ(0.86 * s));
    g.add(blob(0.3 * s, BONE_SH, x * 0.78 * s, -0.36 * s, 0.42 * s, 1, 0.8, 1));
    g.add(box(0.1 * s, 0.14 * s, 0.06 * s, SOCKET, x * 0.14 * s, -0.24 * s, 1.72 * s));
    // great horns sweeping out, up and forward
    g.add(horn(V(x * 0.85 * s, 0.3 * s, -0.05 * s), V(x * 2.4 * s, 0.4 * s, 0.2 * s), V(x * 2.15 * s, 2.0 * s, 0.8 * s), 0.3 * s));
    // tusks curling up out of the jaw
    g.add(horn(V(x * 0.45 * s, -0.8 * s, 1.2 * s), V(x * 1.05 * s, -1.3 * s, 1.6 * s), V(x * 0.95 * s, -0.25 * s, 2.05 * s), 0.17 * s));
  }
  // the long snout, tapering to the nose
  const sn = mesh(new THREE.CylinderGeometry(0.36 * s, 0.6 * s, 1.5 * s, 4).rotateY(Math.PI / 4).rotateX(Math.PI / 2), BONE_W);
  sn.scale.set(1.2, 0.8, 1);
  sn.position.set(0, -0.42 * s, 0.98 * s);
  sn.rotation.x = 0.1;
  g.add(sn);
  // fangs along the upper jaw, the biggest at the front
  for (let i = 0; i < 6; i++) {
    const k = i - 2.5;
    const t = cone(0.06 * s, (Math.abs(k) > 2 ? 0.42 : 0.26) * s, BONE_W, 4, k * 0.14 * s, -0.66 * s, (1.1 + Math.abs(k) * 0.06) * s);
    t.rotation.x = Math.PI;
    g.add(t);
  }
  if (jaw) {
    const j = box(1.1 * s, 0.26 * s, 1.3 * s, BONE_SH, 0, 0, 0);
    j.geometry.translate(0, 0, 0.6 * s);
    j.position.set(0, -1.12 * s, 0.25 * s);
    j.rotation.x = 0.35;
    g.add(j);
  }
  return g;
}

/** A doorway into firelight: dark within, the glow of the hearth and the silhouette of a horned throne. */
function throneDoor(g: THREE.Group, z: number, w: number, h: number): void {
  g.add(box(w, h, 0.2, SOCKET, 0, 0, z));
  g.add(glow(new THREE.BoxGeometry(w * 0.8, h * 0.78, 0.04).translate(0, h * 0.39, 0), 0xff7a30, 0x8a2808).translateZ(z + 0.12));
  // the throne against the fire: a high back, a skull at its crown, horns either side
  g.add(box(w * 0.46, h * 0.5, 0.04, SOCKET, 0, 0, z + 0.16));
  g.add(box(w * 0.62, h * 0.14, 0.04, SOCKET, 0, h * 0.2, z + 0.17));
  for (const x of [-1, 1]) g.add(limb(V(x * w * 0.2, h * 0.46, z + 0.18), V(x * w * 0.34, h * 0.66, z + 0.18), 0.05, 0.015, SOCKET, 4));
  g.add(glow(new THREE.CylinderGeometry(w * 0.5, w * 0.5, 0.06, 6), 0xff7a30, 0x8a2808).translateY(0.04).translateZ(z + 0.5));
}

/** A lookout on stilts: four legs, a staked deck, a hide canopy and a ladder up. */
function lookout(h: number): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    g.add(limb(V(x * 1.15, 0, z * 1.15), V(x * 0.95, h, z * 0.95), 0.14, 0.12, C.timber));
  }
  for (const z of [-1, 1]) g.add(limb(V(-1.1, 0.4, z * 1.1), V(1.0, h - 0.4, z * 1.0), 0.06, 0.06, C.timberLight, 4));
  g.add(box(2.5, 0.25, 2.5, C.timberLight, 0, h, 0));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    if (Math.abs(a - Math.PI / 2) < 0.4) continue;
    g.add(stake(Math.cos(a) * 1.2, h + 0.2, Math.sin(a) * 1.2, 1.0, 0.08, a, 0.25));
  }
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(cyl(0.06, 0.07, 1.6, C.timber, 4, x * 1.0, h + 0.2, z * 1.0));
  g.add(cone(1.9, 1.1, C.thatch, 4, 0, h + 1.8).rotateY(Math.PI / 4));
  g.add(hornPair(0.12, h + 2.7, 0, 0.3, 0.6, 0.05, 0.07));
  // the ladder
  const lad = new THREE.Group();
  for (const x of [-0.28, 0.28]) lad.add(box(0.08, h + 0.3, 0.08, C.timber, x, 0, 0));
  for (let y = 0.4; y < h; y += 0.5) lad.add(box(0.56, 0.06, 0.06, C.timber, 0, y, 0));
  lad.rotation.x = -0.18;
  lad.position.set(0.3, 0, 1.55);
  g.add(lad);
  return g;
}

// ---------- the Orc King's seat ----------

/**
 * The Warlord's Seat: a chieftain's hide yurt round a fire pit; a mead-hall of logs framed by giant tusks;
 * a great hall of dark stone between two lashed towers, the skull-throne glowing through its door; and at
 * last the fortress: a battered keep under a timber gallery, the hall's door the mouth of a beast's skull,
 * braziers blazing before it, and (at the height of his power) the horned skull of a colossal beast
 * crowning the keep, embers drifting up all round it.
 */
export function orcHall(t: number, color: number): Built {
  const g = new THREE.Group();
  const r = rng(91 + t);
  if (t === 1) {
    // the great yurt: a ring of logs under a cone of hides
    g.add(cyl(2.7, 2.8, 1.3, C.timberLight, 10));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.add(cyl(0.16, 0.18, 1.45, C.timber, 5, Math.cos(a) * 2.78, 0, Math.sin(a) * 2.78));
    }
    g.add(cone(3.3, 3.1, C.thatch, 10, 0, 1.3));
    const slope = Math.atan2(3.1, 3.3);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const pg = new THREE.Group();
      const p = box(1.0, 0.06, 0.8, C.thatchDark, 0, 0, 0);
      p.rotation.x = slope;
      pg.add(p);
      pg.position.set(Math.cos(a) * 1.8, 1.3 + 3.1 * (1 - 1.8 / 3.3), Math.sin(a) * 1.8);
      pg.rotation.y = Math.PI / 2 - a;
      g.add(pg);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(stake(Math.cos(a) * 0.22, 3.7, Math.sin(a) * 0.22, 1.4, 0.06, a, 0.4));
    }
    // the doorway, a hide flap drawn back, tusks framing it and a skull over it
    g.add(box(1.1, 1.6, 0.3, C.door, 0, 0, 2.72));
    const flap = box(0.6, 1.5, 0.08, C.thatchDark, 0.85, 0.05, 2.85);
    flap.rotation.y = 0.5;
    g.add(flap);
    g.add(hornPair(0.72, 0, 3.05, 0.55, 2.4, 0.25, 0.16, BONE_W, true));
    const sk = orcSkull(0.5, true);
    sk.position.set(0, 1.9, 3.2);
    g.add(sk);
    g.add(firePit(2.9, 3.1));
    const tt = orcTotem(3.2, r);
    tt.position.set(-3.5, 0, 2.3);
    g.add(tt);
    // a rack of hides stretched to dry, and the war standard
    const rack = new THREE.Group();
    for (const x of [-0.8, 0.8]) rack.add(cyl(0.07, 0.08, 2.0, C.timber, 4, x, 0, 0));
    rack.add(box(1.9, 0.1, 0.1, C.timber, 0, 1.95, 0));
    rack.add(box(1.4, 1.2, 0.05, HIDE_C, 0, 0.65, 0.04));
    rack.position.set(3.6, 0, -1.6);
    rack.rotation.y = -0.5;
    g.add(rack);
    const st = warStandard(color, 4.4);
    st.position.set(3.9, 0, 0.9);
    g.add(st);
    stakeArc(g, 0, 0, 4.1, -Math.PI * 0.88, -Math.PI * 0.12, 11, 1.5);
    g.add(blob(0.5, BONE_SH, -2.6, 0.1, -3.1, 1.3, 0.45, 1));
    return { obj: g, h: 7, w: 9, d: 9 };
  }
  if (t === 2) {
    // the mead-hall
    const hall = house({ w: 8, d: 6, h: 3.2, roofH: 2.6, windows: 2, chimney: true });
    hall.position.set(0.3, 0, -0.9);
    g.add(hall);
    g.add(hornPair(1.05, 0, 2.95, 0.95, 3.9, 0.7, 0.26, BONE_W, true));
    const lk = lookout(4.4);
    lk.position.set(-5.3, 0, 1.0);
    g.add(lk);
    for (const x of [-1.7, 2.3]) { const b = brazier(1.1); b.position.set(x, 0, 3.9); g.add(b); }
    const dr = warDrum(0.9);
    dr.position.set(3.9, 0, 3.1);
    g.add(dr);
    const sr = skullRack(4);
    sr.position.set(5.2, 0, -2.2);
    sr.rotation.y = -1.2;
    g.add(sr);
    const st = warStandard(color, 5.2);
    st.position.set(5.5, 0, 1.6);
    g.add(st);
    stakeArc(g, 0.3, -0.9, 5.4, -Math.PI * 0.85, -Math.PI * 0.18, 13, 1.7);
    return { obj: g, h: 11, w: 13, d: 11 };
  }
  if (t === 3) {
    // the great hall of stone, the throne glowing through its door
    const hall = house({ w: 9, d: 6.4, h: 4.0, roofH: 3.0, stone: true, windows: 3, door: false });
    hall.position.set(0, 0, -1.2);
    g.add(hall);
    throneDoor(g, 2.12, 1.9, 2.8);
    for (const x of [-1, 1]) g.add(box(0.46, 3.4, 0.46, C.timber, x * 1.25, 0, 2.35));
    g.add(box(3.3, 0.5, 0.56, C.timber, 0, 3.3, 2.35));
    const sk = orcSkull(0.75, true);
    sk.position.set(0, 4.15, 2.5);
    g.add(sk);
    g.add(hornPair(1.35, 0, 2.85, 1.05, 4.5, 0.8, 0.3, BONE_W, true));
    for (const x of [-1, 1]) {
      const tw = roundTower(1.5, 7.5, { roof: C.thatch, banner: color });
      tw.position.set(x * 5.8, 0, 1.2);
      g.add(tw);
      const b = brazier(1.2, true);
      b.position.set(x * 2.5, 0, 3.8);
      g.add(b);
      const d = warDrum(0.85);
      d.position.set(x * 3.3, 0, 4.7);
      g.add(d);
    }
    stakeArc(g, 0, -1.2, 5.8, -Math.PI * 0.82, -Math.PI * 0.18, 14, 1.8);
    return { obj: g, h: 15, w: 15, d: 12 };
  }
  // the fortress
  const big = t === 5;
  const H = big ? 12.5 : 10, R = big ? 3.3 : 3.0, kz = -3.0;
  const rAt = (y: number) => (R * 1.08 - R * 0.22 * (y / H)) * Math.cos(Math.PI / 6);
  const keep = cyl(R * 0.86, R * 1.08, H, C.stone, 6, 0, 0, kz);
  keep.rotation.y = Math.PI / 6;
  g.add(keep);
  for (const k of [0.34, 0.67]) {
    const band = cyl(rAt(H * k) / Math.cos(Math.PI / 6) + 0.08, rAt(H * k) / Math.cos(Math.PI / 6) + 0.1, 0.32, C.stoneDark, 6, 0, H * k, kz);
    band.rotation.y = Math.PI / 6;
    g.add(band);
  }
  // slits of firelight on every face
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
    for (const k of [0.45, 0.78]) {
      if (i === 0 && k < 0.5) continue;
      const rr = rAt(H * k) + 0.03;
      const s = box(0.32, 0.9, 0.1, C.window, Math.cos(a) * rr, H * k, kz + Math.sin(a) * rr);
      s.rotation.y = -a + Math.PI / 2;
      s.userData.window = true;
      g.add(s);
    }
  }
  // blood-red war cloths down the keep's face either side of a daubed tusk sigil
  const fz = kz + rAt(H * 0.6) + 0.06;
  for (const x of [-1, 1]) {
    g.add(box(0.8, H * 0.42, 0.05, C.red, x * 1.05, H * 0.36, fz - 0.02));
    g.add(blob(0.2, BONE_W, x * 1.05, H * 0.62, fz + 0.02, 1, 1, 0.3));
  }
  for (const x of [-1, 1]) g.add(horn(V(x * 0.1, H * 0.46, fz), V(x * 0.55, H * 0.52, fz), V(x * 0.28, H * 0.66, fz), 0.12, C.red, 3));
  // the timber gallery round the top, beams jutting under it, and a roof of smoked hides
  const gal = cyl(R * 1.05, R * 0.98, 1.5, C.timberLight, 6, 0, H - 0.2, kz);
  gal.rotation.y = Math.PI / 6;
  g.add(gal);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const beam = box(0.28, 0.28, 1.2, C.timber, Math.cos(a) * R * 0.9, H - 0.55, kz + Math.sin(a) * R * 0.9);
    beam.rotation.y = -a + Math.PI / 2;
    g.add(beam);
    g.add(box(0.16, 1.5, 0.16, C.timber, Math.cos(a) * R * 1.02, H - 0.2, kz + Math.sin(a) * R * 1.02));
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    g.add(stake(Math.cos(a) * R * 1.0, H + 1.2, kz + Math.sin(a) * R * 1.0, 0.8, 0.08, a, 0.3));
  }
  const roofH = R * 1.05;
  const roof = cone(R * 1.24, roofH, C.tile, 6, 0, H + 1.25, kz);
  roof.rotation.y = Math.PI / 6;
  g.add(roof);
  // skulls hung on cords from the gallery
  for (const a of [Math.PI * 0.35, Math.PI * 0.65, Math.PI * 1.2, Math.PI * 1.8]) {
    const x = Math.cos(a) * R * 1.07, z = kz + Math.sin(a) * R * 1.07;
    g.add(box(0.03, 1.0, 0.03, ROPE, x, H - 1.2, z));
    const sk = orcSkull(0.32);
    sk.position.set(x, H - 1.35, z);
    g.add(sk);
  }
  // the hall before it, its door the mouth of a beast's skull
  const hall = house({ w: 9.4, d: 5.4, h: 4.0, roofH: 2.8, stone: true, windows: 2, door: false });
  hall.position.set(0, 0, 1.5);
  g.add(hall);
  throneDoor(g, 4.3, 2.0, 2.9);
  const bs = beastSkull(big ? 1.15 : 1.0);
  bs.position.set(0, 4.35, 4.45);
  g.add(bs);
  g.add(hornPair(1.45, 0, 4.85, 1.1, 3.9, 0.75, 0.34, BONE_W, true));
  for (const x of [-1, 1]) {
    const tw = roundTower(1.4, 7.4, { roof: C.thatch, banner: color });
    tw.position.set(x * 5.7, 0, 3.3);
    g.add(tw);
    const b = brazier(1.3, true, 1.1);
    b.position.set(x * 2.55, 0, 5.8);
    g.add(b);
  }
  let top = H + 1.25 + roofH;
  if (!big) {
    g.add(hornPair(0.25, top - 0.5, kz, 0.7, 1.4, 0.2, 0.16));
    const st = warStandard(color, 3.4);
    st.position.set(0, top - 0.6, kz);
    g.add(st);
    stakeArc(g, 0, kz, 5.3, -Math.PI * 0.85, -Math.PI * 0.15, 13, 1.9);
    return { obj: g, h: top + 4, w: 15, d: 15 };
  }
  // the Warlord's crown: a colossal horned skull on the keep, a standard from its brow
  const crown = beastSkull(1.55);
  crown.position.set(0, H + 2.4, kz + R * 0.55);
  g.add(crown);
  const st = warStandard(color, 5.2);
  st.position.set(0, top - 0.5, kz - 0.9);
  g.add(st);
  top += 4.4;
  // two back towers with open, horned tops, plank walks to the gallery
  for (const x of [-1, 1]) {
    const tw = roundTower(1.2, 8.6, { roof: null });
    tw.position.set(x * 4.9, 0, -5.4);
    g.add(tw);
    const a = V(x * 4.1, 8.7, -5.0), b = V(x * R * 0.85, H - 1.0, kz - 0.6);
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      p.y -= Math.sin((i / n) * Math.PI) * 0.35;
      const pl = box(0.32, 0.08, 1.0, C.timberLight, p.x, p.y, p.z);
      pl.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x) + Math.PI / 2;
      g.add(pl);
    }
  }
  for (const x of [-1, 1]) {
    const d = warDrum(0.95);
    d.position.set(x * 4.3, 0, 6.3);
    g.add(d);
  }
  stakeArc(g, 0, kz, 5.6, -Math.PI * 0.72, -Math.PI * 0.28, 9, 2.0);
  // embers drifting up about the keep
  const parts = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 3.2 + r() * 3.4;
    parts.add(glow(new THREE.OctahedronGeometry(0.1 + r() * 0.07, 0), i % 3 ? EMBER : 0xffc060, i % 3 ? EMBER_E : 0xd07a20).translateX(Math.cos(a) * d).translateY(r() * 11).translateZ(Math.sin(a) * d));
  }
  const embers = swarm(parts, { orbit: 0.14, bob: 0.6 });
  embers.position.set(0, 2.5, kz + 1.2);
  g.add(embers);
  return { obj: g, h: top + 1, w: 15, d: 16 };
}

// ---------- the other buildings ----------

/** A rack of cleavers and axes. */
function cleaverRack(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.0, 0.1, 0.12, C.timber, 0, 1.25, 0));
  for (const x of [-0.95, 0.95]) g.add(box(0.12, 1.4, 0.12, C.timber, x, 0, 0));
  for (let i = 0; i < 4; i++) {
    const x = -0.6 + i * 0.4;
    const h = box(0.05, 1.3, 0.05, C.timberLight, x, 0.05, 0.1);
    h.rotation.x = -0.1;
    g.add(h);
    g.add(box(i % 2 ? 0.32 : 0.26, i % 2 ? 0.22 : 0.3, 0.04, IRON_BK, x + 0.12, 1.08, 0.2));
  }
  return g;
}

/** A training post: a stake with a crossbar, a hide sack for a body and a skull for a head. */
function dummyPost(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.08, 0.1, 2.0, C.timber, 5));
  g.add(box(1.1, 0.12, 0.12, C.timber, 0, 1.35, 0));
  g.add(blob(0.36, HIDE_C, 0, 1.15, 0, 1, 1.3, 0.8));
  g.add(box(0.74, 0.06, 0.74, ROPE, 0, 1.2, 0));
  const sk = orcSkull(0.34);
  sk.position.set(0, 1.9, 0.02);
  g.add(sk);
  return g;
}

/** Barracks: a longhouse with a fighting pit before it, a ring of stakes round a floor of bloodied sand. */
function barracks(t: number, color: number): Built {
  const g = new THREE.Group();
  g.add(house({ w: 7, d: 5, h: 3, roofH: 2.4, windows: 2, stone: t === 3 }));
  const cz = 6.0;
  g.add(cyl(2.55, 2.65, 0.1, SAND, 14, 0, 0, cz));
  g.add(cyl(1.2, 1.3, 0.12, GORE, 10, 0.4, 0, cz - 0.2));
  stakeArc(g, 0, cz, 2.75, -Math.PI * 0.32, Math.PI * 1.32, 15, 1.35, 0.25);
  g.add(mesh(new THREE.TorusGeometry(2.72, 0.05, 3, 20, Math.PI * 1.64).rotateX(Math.PI / 2).rotateY(Math.PI * 0.32), ROPE).translateY(0.75).translateZ(cz));
  for (const [x, z] of [[-1.1, 6.4], [1.1, 5.4]] as [number, number][]) {
    const d = dummyPost();
    d.position.set(x, 0, z);
    d.rotation.y = x;
    g.add(d);
  }
  const rack = cleaverRack();
  rack.position.set(-2.7, 0, 3.3);
  g.add(rack);
  const sr = skullRack(3);
  sr.position.set(3.3, 0, 3.4);
  sr.rotation.y = 0.3;
  g.add(sr);
  if (t >= 2) {
    const wing = house({ w: 5, d: 4, h: 2.6, roofH: 2, windows: 1 });
    wing.position.set(-6.2, 0, 0.5);
    wing.rotation.y = Math.PI / 2;
    g.add(wing);
    const st = warStandard(color, 4.6);
    st.position.set(4.1, 0, 2.2);
    g.add(st);
  }
  if (t >= 3) {
    const d = warDrum(0.8);
    d.position.set(3.6, 0, 7.6);
    g.add(d);
    const b = brazier(1.0);
    b.position.set(-3.4, 0, 6.2);
    g.add(b);
  }
  return { obj: g, h: 7.5, w: 9, d: 8 };
}

/** Stable: the warg den (a long, low hide-roofed barn with dark den mouths) and a staked pen of wargs and war boars. */
function stable(t: number, r: () => number): Built {
  const g = new THREE.Group();
  g.add(house({ w: 9, d: 4.6, h: 2.6, roofH: 2.1, windows: 0, door: false }));
  for (const x of [-2.8, 0, 2.8]) {
    g.add(box(1.5, 1.8, 0.2, SOCKET, x, 0, 2.5));
    g.add(horn(V(x - 0.85, 0, 2.75), V(x - 0.9, 1.9, 2.8), V(x + 0.05, 2.25, 2.8), 0.1, BONE_W, 3));
    g.add(horn(V(x + 0.85, 0, 2.75), V(x + 0.9, 1.9, 2.8), V(x - 0.05, 2.25, 2.8), 0.1, BONE_W, 3));
  }
  stakeLine(g, -4, 7, 4, 7, 11, 1.3, 0.25);
  stakeLine(g, -4, 2.9, -4, 7, 6, 1.3, 0.25);
  stakeLine(g, 4, 2.9, 4, 7, 6, 1.3, -0.25);
  const n = t === 1 ? 2 : t === 2 ? 3 : 4;
  for (let i = 0; i < n; i++) {
    const m = i % 2 ? warBoar() : warg(i % 4 === 0 ? 0x4e463e : 0x2e2a28);
    m.userData.mount = true;
    m.position.set(-2.6 + i * 1.8, 0, 4.6 + (r() - 0.5) * 1.4);
    m.rotation.y = r() * Math.PI * 2;
    g.add(m);
  }
  // a trough and the bones they've gnawed
  g.add(box(1.6, 0.4, 0.6, C.timber, 2.8, 0, 3.4));
  g.add(blob(0.5, BONE_SH, -3.0, 0.08, 3.6, 1.3, 0.4, 1));
  for (let i = 0; i < 3; i++) { const b = box(0.7, 0.1, 0.1, BONE_W, -3.0 + (i - 1) * 0.3, 0.2, 3.6 + i * 0.1); b.rotation.y = i * 1.1; g.add(b); }
  return { obj: g, h: 6, w: 10, d: 10 };
}

/** A rock-hurler: a crude throwing-engine of lashed logs, its long arm cocked, a boulder in the sling. */
function rockHurler(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.8, 0.35, 1.5, C.timber, 0, 0.35, 0));
  for (const [x, z] of [[-0.95, 0.8], [0.95, 0.8], [-0.95, -0.8], [0.95, -0.8]]) {
    g.add(cyl(0.42, 0.42, 0.14, C.timberLight, 7, x, 0.42, z).rotateX(Math.PI / 2));
  }
  for (const z of [-0.55, 0.55]) {
    g.add(limb(V(-0.9, 0.7, z), V(0.2, 2.4, z * 0.8), 0.12, 0.1, C.timberLight));
    g.add(limb(V(1.0, 0.7, z), V(0.2, 2.4, z * 0.8), 0.12, 0.1, C.timberLight));
  }
  g.add(mesh(new THREE.TorusGeometry(0.14, 0.05, 3, 6), ROPE).translateX(0.2).translateY(2.4));
  // the arm: lashed at the axle, a net of rocks for the counterweight, the sling at its end
  g.add(limb(V(1.4, 1.2, 0), V(-1.7, 3.3, 0), 0.13, 0.08, C.timber));
  g.add(blob(0.55, C.stoneDark, 1.5, 0.95, 0, 1.1, 0.9, 1));
  g.add(blob(0.35, 0x6a655b, -1.8, 3.2, 0));
  for (let i = 0; i < 3; i++) g.add(cone(0.05, 0.2, IRON_BK, 4, -1.8 + (i - 1) * 0.2, 3.45, (i - 1) * 0.12));
  return g;
}

/** A battering tusk: a great log on a hide-roofed frame, its head the skull of a boar, tusks and all. */
function batteringTusk(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.6, 0.3, 1.2, C.timber, 0, 0.35, 0));
  for (const x of [-1.1, 1.1]) for (const z of [-0.5, 0.5]) g.add(cyl(0.08, 0.09, 1.6, C.timberLight, 4, x, 0.4, z));
  g.add(box(2.9, 0.12, 1.6, C.thatch, 0, 1.95, 0));
  const log = cyl(0.3, 0.3, 3.2, C.timberLight, 7);
  log.rotation.z = Math.PI / 2;
  log.position.set(1.6, 1.1, 0);
  g.add(log);
  const sk = orcSkull(0.6);
  sk.rotation.y = Math.PI / 2;
  sk.position.set(2.0, 1.2, 0);
  g.add(sk);
  for (const z of [-1, 1]) g.add(horn(V(2.1, 0.85, z * 0.2), V(2.6, 0.6, z * 0.45), V(2.75, 1.35, z * 0.35), 0.1));
  return g;
}

/** Workshop: the siege yard, an open shed of raw logs under hides, a rock-hurler under it and a battering tusk out front. */
function workshop(t: number, r: () => number): Built {
  const g = new THREE.Group();
  for (const [x, z] of [[-3.5, -2], [3.5, -2], [-3.5, 2], [3.5, 2]]) g.add(cyl(0.18, 0.22, 3.6, C.timber, 6, x, 0, z));
  const roof = new THREE.Group();
  roof.add(box(8, 0.3, 5.2, C.thatch, 0, 0, 0));
  roof.add(box(2.6, 0.06, 1.6, C.thatchDark, -1.8, 0.3, 0.8), box(2.0, 0.06, 1.4, C.thatchDark, 2.2, 0.3, -1.2));
  for (const x of [-2.5, 0, 2.5]) roof.add(box(0.12, 0.12, 5.4, C.timber, x, 0.32, 0));
  roof.position.set(0, 3.4, 0);
  roof.rotation.x = 0.12;
  g.add(roof);
  for (let i = 0; i < 11; i++) g.add(cyl(0.2, 0.22, 3.0 + (i % 2) * 0.3, C.timberLight, 5, -3.4 + i * 0.68, 0, -2.3));
  for (let i = 0; i < 11; i++) g.add(cone(0.2, 0.4, C.timberLight, 5, -3.4 + i * 0.68, 3.0 + (i % 2) * 0.3, -2.3));
  const c = rockHurler();
  c.position.set(0.4, 0, 0.1);
  g.add(c);
  if (t >= 2) {
    const tk = batteringTusk();
    tk.position.set(-1, 0, 4.2);
    tk.rotation.y = 0.3;
    g.add(tk);
  }
  // boulders heaped for throwing, and logs for the next engine
  for (let i = 0; i < 5; i++) g.add(blob(0.36 + r() * 0.12, i % 2 ? C.stoneDark : 0x6a655b, 4.9 + (i % 3) * 0.55 - 0.5, 0.3, 1.2 + Math.floor(i / 3) * 0.7 - 0.3));
  const logs = logPile(4);
  logs.position.set(5.0, 0, -0.9);
  logs.rotation.y = Math.PI / 2;
  g.add(logs);
  const sk = orcSkull(0.5);
  sk.position.set(0, 3.1, 2.62);
  g.add(sk);
  return { obj: g, h: 6, w: 9, d: 8 };
}

/** Smithy: the war forge. A squat furnace with molten iron running from its mouth down a channel to the moulds,
 *  bellows of hide, an anvil with a blade glowing on it, a rack of cleavers and a stack pouring smoke. */
function smithy(t: number): Built {
  const g = new THREE.Group();
  g.add(house({ w: 6, d: 5, h: 3, roofH: 2.2, stone: true, roof: C.slate, windows: 1 }));
  g.add(cyl(0.6, 0.72, 6.6, C.stoneDark, 6, 1.8, 0, -1.2));
  for (const y of [2.4, 4.6, 6.4]) g.add(cyl(0.72, 0.72, 0.16, IRON_BK, 6, 1.8, y, -1.2));
  const smoke = new THREE.Object3D();
  smoke.userData.dynamic = true;
  smoke.userData.smoke = true;
  smoke.position.set(1.8, 6.9, -1.2);
  g.add(smoke);
  // the furnace: a dome of dark stone, its mouth glowing
  const fx = -2.3, fz = 3.2;
  g.add(cyl(0.95, 1.1, 1.2, C.stoneDark, 8, fx, 0, fz));
  g.add(mesh(new THREE.SphereGeometry(0.95, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), C.stoneDark).translateX(fx).translateY(1.2).translateZ(fz));
  g.add(cyl(0.3, 0.36, 1.0, C.stoneDark, 6, fx, 1.9, fz));
  g.add(glow(new THREE.BoxGeometry(0.7, 0.55, 0.12), MOLTEN, MOLTEN_E).translateX(fx).translateY(0.55).translateZ(fz + 1.02));
  g.add(smokeAt(fx, 3.0, fz));
  // molten iron running down a channel from the furnace to a row of moulds
  g.add(box(0.4, 0.3, 2.0, C.stoneDark, fx + 0.9, 0, fz + 0.4).rotateY(-0.9));
  g.add(glow(new THREE.BoxGeometry(0.2, 0.06, 2.0), MOLTEN, MOLTEN_E).translateX(fx + 0.9).translateY(0.31).translateZ(fz + 0.4).rotateY(-0.9));
  for (let i = 0; i < 3; i++) {
    g.add(box(0.5, 0.2, 0.34, C.stoneDark, -0.9 + i * 0.6, 0, 4.3));
    g.add(glow(new THREE.BoxGeometry(0.36, 0.04, 0.2), MOLTEN, MOLTEN_E).translateX(-0.9 + i * 0.6).translateY(0.21).translateZ(4.3));
  }
  // hide bellows
  const bl = new THREE.Group();
  bl.add(box(0.9, 0.3, 0.6, HIDE_DK, 0, 0.35, 0), box(0.9, 0.1, 0.6, C.timber, 0, 0.66, 0));
  bl.position.set(fx - 1.3, 0, fz - 0.2);
  bl.rotation.y = 0.4;
  g.add(bl);
  const a = anvil();
  a.position.set(0.5, 0, 3.3);
  g.add(a);
  g.add(glow(new THREE.BoxGeometry(0.5, 0.05, 0.1), MOLTEN, MOLTEN_E).translateX(0.5).translateY(0.93).translateZ(3.32));
  g.add(barrel(-3.8, 1.9));
  if (t >= 2) {
    const rack = cleaverRack();
    rack.position.set(2.9, 0, 3.4);
    rack.scale.setScalar(0.8);
    g.add(rack);
  }
  if (t >= 3) {
    // a great war-axe hung on the wall as the master's mark
    g.add(box(0.1, 2.2, 0.1, C.timber, -1.6, 0.8, 2.62));
    g.add(box(0.8, 0.6, 0.06, IRON_BK, -1.6, 2.4, 2.66), box(0.5, 0.5, 0.06, IRON_BK, -1.6, 2.45, 2.66));
  }
  return { obj: g, h: 8, w: 8, d: 7 };
}

function smokeAt(x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.userData.dynamic = true;
  o.userData.smoke = true;
  o.position.set(x, y, z);
  return o;
}

/** Rally point: the war-drum circle. The warband's standard raised tall, a fire in the middle and drums around it. */
function rally(color: number): Built {
  const g = new THREE.Group();
  const st = warStandard(color, 7.4);
  g.add(st);
  g.add(firePit(2.6, 1.6, 1.05));
  for (const [x, z] of [[1.2, 3.2], [4.2, 2.6], [3.8, -0.2]] as [number, number][]) {
    const d = warDrum(0.72);
    d.position.set(x, 0, z);
    g.add(d);
  }
  for (const [x, z] of [[-0.6, 1.4], [1.5, -0.6]] as [number, number][]) {
    g.add(stake(x, 0, z, 2.2, 0.1, 0, 0));
    const sk = orcSkull(0.34);
    sk.position.set(x, 1.9, z);
    g.add(sk);
  }
  return { obj: g, h: 10, w: 6, d: 6 };
}

/** Market: the plunder market. Hide-roofed stalls, heaps of loot, a pack boar laden with sacks. */
function market(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const cols: [number, number][] = [[C.red, HIDE_C], [HIDE_DK, SKIN_TOP], [C.red, BONE_W], [HIDE_C, HIDE_DK]];
  const spots: [number, number, number][] = [[-2.8, 0, 0.2], [0.4, -1.8, -0.2], [3.4, 0.6, 0.4], [-0.6, 2.6, -0.1]];
  const n = Math.min(4, t + 1);
  for (let i = 0; i < n; i++) {
    const s = stall(cols[i][0], cols[i][1]);
    s.position.set(spots[i][0], 0, spots[i][1]);
    s.rotation.y = spots[i][2];
    g.add(s);
  }
  g.add(crate(-4.2, 2), crate(-4.4, 3), barrel(4.4, 2.8), barrel(3.8, 3.4));
  // the pack boar, loaded with sacks
  const pb = warBoar(false);
  pb.rotation.y = -0.3;
  pb.position.set(1.4, 0, 4.3);
  for (const z of [-0.45, 0.45]) pb.add(blob(0.34, SKIN_TOP, -0.1, 1.05, z, 1.2, 1, 0.8));
  pb.add(box(0.9, 0.12, 1.1, C.red, -0.1, 1.28, 0));
  g.add(pb);
  // loot heaped on hides: a shield, a helm, a pile of coin
  g.add(box(1.6, 0.05, 1.2, HIDE_C, -1.6, 0, 4.4));
  g.add(cyl(0.36, 0.36, 0.08, IRON_BK, 7, -2.0, 0.1, 4.3).rotateX(0.3));
  g.add(blob(0.3, 0xe0b040, -1.2, 0.08, 4.5, 1.3, 0.5, 1.1));
  for (let i = 0; i < 3; i++) g.add(blob(0.14, 0xf0c850, -1.4 + r() * 0.6, 0.12, 4.2 + r() * 0.5));
  const sk = orcSkull(0.4);
  sk.position.set(4.6, 2.7, 1.6);
  g.add(sk, stake(4.6, 0, 1.6, 2.4, 0.08, 0, 0));
  return { obj: g, h: 5, w: 10, d: 8 };
}

/** Warehouse: the hoard. A great hide-roofed storehouse, heaped crates, and piles lashed under hides. */
function warehouse(t: number): Built {
  const g = new THREE.Group();
  g.add(house({ w: 8, d: 6, h: 3.6, roofH: 3, windows: 0, door: false, stone: t === 3 }));
  const fz = 3.0 + (t === 3 ? 0.04 : 0.33);
  g.add(box(2.6, 2.8, 0.15, C.door, 0, 0, fz + 0.04));
  for (const y of [0.7, 1.9]) g.add(box(2.7, 0.12, 0.08, IRON_BK, 0, y, fz + 0.14));
  g.add(box(2.9, 0.2, 0.3, C.timber, 0, 2.8, fz + 0.1));
  const sk = orcSkull(0.45);
  sk.position.set(0, 3.3, fz + 0.2);
  g.add(sk);
  for (let i = 0; i < 3 + t; i++) g.add(crate(4.6 + (i % 2) * 0.9, 2.6 - Math.floor(i / 2) * 0.9, 0.9));
  // piles lashed under hides (snowed over in winter)
  for (const [x, z, s] of [[-4.2, 2.6, 0.85], [-4.1, 0.8, 0.7]] as [number, number, number][]) {
    g.add(blob(0.95 * s, C.thatch, x, 0.2, z, 1.1, 0.85, 1.0));
    g.add(box(0.07, 0.07, 2.0 * s, ROPE, x, 0.95 * s, z), box(2.0 * s, 0.07, 0.07, ROPE, x, 0.95 * s, z));
  }
  if (t >= 2) {
    const b2 = house({ w: 5.6, d: 4.6, h: 3, roofH: 2.3, windows: 0, door: false });
    b2.position.set(-1.8, 0, -5.8);
    g.add(b2);
  }
  return { obj: g, h: 8, w: 10, d: 8 };
}

/** Watchtower: a rickety tower of leaning logs lashed together, a staked deck under a hide roof with horns,
 *  a signal fire, skulls hung from its corners and the war banner over it all. */
function watchtower(t: number, color: number): Built {
  const g = new THREE.Group();
  const h = 7 + t * 1.6;
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(limb(V(x * 1.5, 0, z * 1.5), V(x * 1.1, h, z * 1.1), 0.2, 0.16, C.timber, 6));
  // cross-braces up each face
  for (let y = 0.6; y < h - 1.8; y += 2.6) {
    const k0 = y / h, k1 = (y + 2.4) / h;
    const w0 = 1.5 - 0.4 * k0, w1 = 1.5 - 0.4 * k1;
    for (const s of [-1, 1]) {
      g.add(limb(V(-w0, y, s * w0), V(w1, y + 2.4, s * w1), 0.07, 0.07, C.timberLight, 4));
      g.add(limb(V(s * w0, y, -w0), V(s * w1, y + 2.4, w1), 0.07, 0.07, C.timberLight, 4));
    }
    g.add(mesh(new THREE.TorusGeometry(w1 * 1.02, 0.05, 3, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 4), ROPE).translateY(y + 2.4));
  }
  g.add(box(3.4, 0.3, 3.4, C.timberLight, 0, h, 0));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    g.add(stake(Math.cos(a) * 1.6, h + 0.25, Math.sin(a) * 1.6, 1.0 + (i % 2) * 0.3, 0.09, a, 0.3));
  }
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(cyl(0.08, 0.09, 2.3, C.timber, 4, x * 1.5, h + 0.2, z * 1.5));
  g.add(cone(2.9, 2.0, C.thatch, 4, 0, h + 2.4).rotateY(Math.PI / 4));
  g.add(hornPair(0.14, h + 4.0, 0, 0.55, 1.0, 0.1, 0.1));
  const sk = orcSkull(0.55);
  sk.position.set(0, h + 2.6, 1.95);
  g.add(sk);
  for (const [x, z] of [[1.7, 1.7], [-1.7, 1.7], [1.7, -1.7]]) {
    g.add(box(0.03, 0.9, 0.03, ROPE, x, h - 0.9, z));
    const s = orcSkull(0.28);
    s.position.set(x, h - 1.0, z);
    g.add(s);
  }
  const b = brazier(0.3, false, 0.8);
  b.position.set(-0.6, h + 0.3, -0.5);
  g.add(b);
  // the war horn hung ready
  g.add(horn(V(0.6, h + 1.5, 1.4), V(1.1, h + 1.1, 1.5), V(1.3, h + 1.7, 1.4), 0.16));
  const st = warStandard(color, 2.4);
  st.position.set(0, h + 3.9, 0);
  st.scale.setScalar(0.8);
  g.add(st);
  return { obj: g, h: h + 7, w: 4, d: 4 };
}

/** The Orc King's statue: a hulking warlord in dark bronze, great axe raised, on a plinth of rough stone
 *  heaped with skulls, braziers glowing at its front corners. */
function statue(): Built {
  const g = new THREE.Group();
  const BRZ = 0x5a4a34, BRZ_DK = 0x3e3326;
  g.add(cyl(2.2, 2.45, 0.45, C.stoneDark, 7));
  g.add(cyl(1.35, 1.6, 1.6, C.stone, 6, 0, 0.4));
  g.add(cyl(1.55, 1.45, 0.3, C.stoneDark, 6, 0, 1.95));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const sk = orcSkull(0.34);
    sk.position.set(Math.cos(a) * 1.72, 0.6, Math.sin(a) * 1.72);
    sk.rotation.y = Math.PI / 2 - a;
    g.add(sk);
  }
  const fig = new THREE.Group();
  fig.add(box(0.8, 0.8, 0.5, BRZ_DK, 0, 0, 0));
  fig.add(cyl(0.62, 0.72, 0.5, BRZ_DK, 8, 0, 0.6));
  fig.add(cyl(0.72, 0.58, 1.15, BRZ, 8, 0, 1.05));
  fig.add(blob(0.5, BRZ_DK, 0, 2.2, -0.05, 2.0, 0.6, 1.2));
  for (const s of [-1, 1]) {
    fig.add(blob(0.36, BRZ, s * 0.78, 2.15, 0, 1.2, 0.85, 1.1));
    for (let k = 0; k < 3; k++) fig.add(cone(0.07, 0.36, BRZ_DK, 4, s * (0.66 + k * 0.14), 2.42, -0.1 + k * 0.1));
    // both arms up, gripping the axe overhead
    fig.add(limb(V(s * 0.8, 2.1, 0), V(s * 0.45, 3.25, 0.12), 0.2, 0.16, BRZ));
  }
  fig.add(blob(0.42, BRZ, 0, 2.62, 0.1, 1, 0.95, 1));
  fig.add(box(0.5, 0.24, 0.3, BRZ, 0, 2.38, 0.34));
  for (const s of [-1, 1]) fig.add(cone(0.07, 0.3, BONE_W, 4, s * 0.16, 2.44, 0.5));
  fig.add(glow(new THREE.OctahedronGeometry(0.06, 0)).translateX(-0.14).translateY(2.72).translateZ(0.48), glow(new THREE.OctahedronGeometry(0.06, 0)).translateX(0.14).translateY(2.72).translateZ(0.48));
  fig.add(cyl(0.38, 0.38, 0.14, BRZ_DK, 8, 0, 2.95));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; fig.add(cone(0.06, 0.38, BONE_W, 4, Math.cos(a) * 0.34, 3.05, Math.sin(a) * 0.34)); }
  // the great axe, lifted across above his head
  fig.add(limb(V(-1.1, 3.3, 0.12), V(1.3, 3.5, 0.12), 0.07, 0.07, BRZ_DK));
  fig.add(box(0.7, 1.0, 0.08, BRZ, 1.2, 3.0, 0.12), box(0.7, 0.8, 0.08, BRZ, 1.2, 3.1, 0.12));
  fig.add(cone(0.08, 0.4, BRZ, 4, 1.35, 3.5, 0.12).rotateZ(-1.4));
  fig.add(box(0.7, 1.3, 0.05, C.red, 0, 1.0, -0.62));
  fig.position.y = 2.1;
  fig.scale.setScalar(0.92);
  g.add(fig);
  for (const x of [-1, 1]) {
    const b = brazier(0.9, false, 0.7);
    b.position.set(x * 1.75, 0, 1.75);
    g.add(b);
  }
  return { obj: g, h: 7.6, w: 5, d: 5 };
}

/** The Horde's mark at a workplace's track or a doorstep: a horned skull on a stake, a blood-red rag under it. */
export function orcPost(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.1, h, C.timber, 5));
  g.add(box(0.7, 0.07, 0.07, C.timber, 0.2, h - 0.35, 0));
  g.add(box(0.42, 0.7, 0.04, C.red, 0.34, h - 1.1, 0));
  const sk = orcSkull(0.38);
  sk.position.set(0, h + 0.16, 0);
  g.add(sk);
  g.add(hornPair(0.14, h + 0.26, -0.02, 0.28, 0.45, 0.04, 0.06));
  return g;
}

/** A pen of wallowing boars (the Horde's crop), fenced with stakes, a trough of slops. */
export function boarPen(w: number, d: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.08, d, GORE));
  g.add(blob(1.1, 0x4a3a2a, (r() - 0.5) * 1.5, 0.02, (r() - 0.5) * 1.2, 1.4, 0.06, 1));
  stakeLine(g, -w / 2, -d / 2, w / 2, -d / 2, 7, 1.0);
  stakeLine(g, -w / 2, d / 2, w / 2, d / 2, 7, 1.0);
  stakeLine(g, -w / 2, -d / 2, -w / 2, d / 2, 5, 1.0);
  stakeLine(g, w / 2, -d / 2, w / 2, d / 2, 5, 1.0);
  for (let i = 0; i < 3; i++) {
    const b = warBoar(false);
    b.scale.setScalar(0.62);
    b.position.set(-1.8 + i * 1.8, 0, (r() - 0.5) * 1.8);
    b.rotation.y = r() * Math.PI * 2;
    g.add(b);
  }
  g.add(box(1.4, 0.3, 0.4, C.timber, w * 0.3, 0, d * 0.3));
  return g;
}

/** An orc's own workplace or building, in place of the plain one (null where the plain one serves, dressed by the theme). */
export function orcModel(id: BuildingId, t: number, color: number, r: () => number): Built | null {
  switch (id) {
    case 'main': return orcHall(t, color);
    case 'barracks': return barracks(t, color);
    case 'stable': return stable(t, r);
    case 'workshop': return workshop(t, r);
    case 'smithy': return smithy(t);
    case 'rally': return rally(color);
    case 'statue': return statue();
    case 'market': return market(t, r);
    case 'warehouse': return warehouse(t);
    case 'watchtower': return watchtower(t, color);
    default: return null;
  }
}

/** The Horde's finishing touches on the buildings that keep their plain shape. */
export function orcDress(id: BuildingId, t: number, b: Built, r: () => number): Built {
  const g = b.obj;
  switch (id) {
    case 'academy': {
      // the shamans' lodge: a totem at the door, bones and a brazier of glowing coals
      const tt = orcTotem(3.2, r);
      tt.position.set(-3.6, 0, 3.6);
      g.add(tt);
      const br = brazier(0.9);
      br.position.set(3.2, 0, 3.4);
      g.add(br);
      break;
    }
    case 'hiding': {
      const sk = orcSkull(0.5);
      sk.position.set(0.8, 0.8, 0.3);
      g.add(sk, box(0.8, 0.1, 0.1, BONE_W, -0.6, 0.55, 0.6).rotateY(0.5));
      break;
    }
  }
  void t;
  return b;
}

// ---------- the walls ----------

/**
 * The palisade: raw logs sharpened to points, iron spikes driven through near the top pointing out, a rail
 * lashed along it, and bone trophies (skulls on the tallest stakes) all round; the gate framed by tall posts
 * and tusks. From the second size, lashed towers of logs with staked decks and horned hide roofs.
 */
export function orcPalisade(g: THREE.Group, tier: number, R: number, start: number, end: number, gateA: number, gateHalf: number): void {
  const h = tier === 1 ? 2.6 : 3.6;
  const step = 0.72 / R;
  let i = 0;
  for (let a = start; a <= end; a += step, i++) {
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    const hh = h + (Math.sin(a * 37) + 1) * 0.25;
    g.add(cyl(0.34, 0.38, hh, i % 4 === 1 ? 0x4e3a28 : 0x6e5036, 6, x, 0, z));
    g.add(cone(0.36, 0.8, 0x6e5036, 6, x, hh, z));
    // an iron spike through every other log, pointing out of the village
    if (i % 2 === 0) {
      const sp = cone(0.07, 0.8, IRON_BK, 4, x * 1.012, hh * 0.72, z * 1.012);
      sp.rotation.z = -Math.cos(a) * 1.45;
      sp.rotation.x = Math.sin(a) * 1.45;
      g.add(sp);
    }
    if (i % 9 === 4) {
      const sk = orcSkull(0.34);
      sk.position.set(x * 1.01, hh + 0.55, z * 1.01);
      sk.rotation.y = Math.PI / 2 - a;
      g.add(sk);
    }
    if (i % 14 === 7) g.add(box(0.5, 0.9, 0.04, C.red, Math.cos(a) * (R + 0.4), hh * 0.35, Math.sin(a) * (R + 0.4)).rotateY(Math.PI / 2 - a));
  }
  // the rails lashed along both faces
  const segs = 48;
  for (let k = 0; k < segs; k++) {
    const a0 = start + ((end - start) * k) / segs, a1 = start + ((end - start) * (k + 1)) / segs;
    for (const rr of [R - 0.36, R + 0.36]) {
      g.add(limb(V(Math.cos(a0) * rr, h * 0.62, Math.sin(a0) * rr), V(Math.cos(a1) * rr, h * 0.62, Math.sin(a1) * rr), 0.06, 0.06, C.timber, 4));
    }
  }
  // the gate: tall posts, a lintel with a skull, tusks either side
  for (const s of [-1, 1]) {
    const a = gateA + s * gateHalf;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    g.add(cyl(0.5, 0.58, h + 2.2, C.timber, 7, x, 0, z));
    g.add(cone(0.5, 0.9, C.timber, 7, x, h + 2.2, z));
    g.add(horn(V(x + s * 0.2, 0, z + 0.7), V(x + s * 0.9, 1.6, z + 1.2), V(x - s * 0.3, h + 1.1, z + 1.0), 0.22));
  }
  g.add(box(gateHalf * 2 * R + 1.4, 0.55, 0.7, C.timber, 0, h + 1.2, R));
  const sk = orcSkull(0.8, true);
  sk.position.set(0, h + 2.2, R + 0.35);
  g.add(sk);
  g.add(hornPair(0.45, h + 2.4, R + 0.2, 0.9, 1.4, 0.2, 0.14));
  if (tier === 2) {
    for (let k = 0; k < 8; k++) {
      const a = gateA + gateHalf + 0.35 + (k / 8) * (Math.PI * 2 - gateHalf * 2 - 0.5);
      const tw = new THREE.Group();
      for (const x of [-1, 1]) for (const z of [-1, 1]) tw.add(limb(V(x * 1.35, 0, z * 1.35), V(x * 1.15, 6.4, z * 1.15), 0.18, 0.15, C.timber, 6));
      for (const s of [-1, 1]) tw.add(limb(V(-1.3, 0.8, s * 1.3), V(1.2, 5.6, s * 1.2), 0.07, 0.07, C.timberLight, 4));
      tw.add(box(3.1, 0.3, 3.1, C.timberLight, 0, 6.4, 0));
      for (let j = 0; j < 10; j++) {
        const q = (j / 10) * Math.PI * 2;
        tw.add(stake(Math.cos(q) * 1.45, 6.6, Math.sin(q) * 1.45, 0.9, 0.08, q, 0.3));
      }
      for (const x of [-1, 1]) for (const z of [-1, 1]) tw.add(cyl(0.07, 0.08, 1.7, C.timber, 4, x * 1.3, 6.6, z * 1.3));
      tw.add(cone(2.5, 1.9, C.thatch, 4, 0, 8.2, 0).rotateY(Math.PI / 4));
      tw.add(hornPair(0.12, 9.7, 0, 0.45, 0.8, 0.08, 0.09));
      tw.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      tw.rotation.y = -a;
      g.add(tw);
    }
  }
}

/** A stretch of the stone wall, the Horde's way: a timber hoarding along the top, iron spikes out of its
 *  face, skulls on stakes along the parapet, blood-red war cloths and a brazier now and then. (Local -z faces out.) */
export function orcWallDress(seg: THREE.Group, len: number, h: number, thick: number, i: number, merlons: number): void {
  // the hoarding: a timber gallery jutting over the outer face, beams under it
  seg.add(box(len, 0.9, 0.5, C.timber, 0, h - 0.2, -thick / 2 - 0.2));
  seg.add(box(len, 0.12, 0.7, C.timberLight, 0, h + 0.7, -thick / 2 - 0.15));
  for (let k = 0; k < 2; k++) seg.add(box(0.2, 0.2, 0.9, C.timber, -len / 4 + k * len / 2, h - 0.35, -thick / 2 - 0.2));
  // iron spikes out of the face, low down
  for (let k = 0; k < merlons; k++) {
    const sp = cone(0.08, 0.9, IRON_BK, 4, -len / 2 + (k + 0.5) * (len / merlons), h * 0.4, -thick / 2 - 0.05);
    sp.rotation.x = -Math.PI / 2;
    seg.add(sp);
  }
  if (i % 3 === 1) {
    for (const side of [-1, 1]) {
      seg.add(box(0.9, h * 0.62, 0.05, C.red, 0, h * 0.28, side * (thick / 2 + (side < 0 ? 0.47 : 0.04))));
      seg.add(blob(0.2, BONE_W, 0, h * 0.62, side * (thick / 2 + (side < 0 ? 0.5 : 0.07)), 1, 1, 0.3));
    }
  }
  if (i % 2 === 0) {
    seg.add(cyl(0.06, 0.07, 1.7, C.timber, 4, len * 0.25, h + 0.3, 0));
    const sk = orcSkull(0.34);
    sk.position.set(len * 0.25, h + 2.1, 0);
    sk.rotation.y = Math.PI;
    seg.add(sk);
  }
  if (i % 4 === 3) {
    const b = brazier(0.4, false, 0.7);
    b.position.set(0, h + 0.3, 0.2);
    seg.add(b);
  }
}

/** The stone gatehouse's crown: a beast's skull over the gate, tusks either side of the way through. */
export function orcGate(g: THREE.Group, R: number, h: number, thick: number): void {
  const bs = beastSkull(1.0);
  bs.position.set(0, h + 2.6, R + thick / 2 + 0.9);
  g.add(bs);
  for (const s of [-1, 1]) {
    const x = s * 3.2;
    g.add(horn(V(x, 0, R + thick / 2 + 0.6), V(x + s * 1.3, 2.4, R + thick / 2 + 1.6), V(x - s * 0.4, h + 1.2, R + thick / 2 + 1.1), 0.34));
  }
}

// ---------- the land round the camp ----------

interface GroundKit {
  at: (x: number, z: number) => number;
  free: (x: number, z: number) => boolean;
  motes: (g: THREE.Group, r: () => number, n: number, color: number, emissive: number, around: (i: number) => [number, number, number]) => void;
  wallR: number;
}

/** A hide tent: poles crossing out of its top, hides lapped over it, a skull on a stake at the door. */
export function hideTent(s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cone(1.5 * s, 2.3 * s, C.thatch, 7));
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.3;
    const p = box(0.7 * s, 0.6 * s, 0.05, i % 2 ? C.thatchDark : HIDE_DK, Math.cos(a) * 0.95 * s, 0.7 * s, Math.sin(a) * 0.95 * s);
    p.rotation.y = -a + Math.PI / 2;
    p.rotation.x = -0.55;
    g.add(p);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    g.add(stake(Math.cos(a) * 0.12 * s, 1.9 * s, Math.sin(a) * 0.12 * s, 1.0 * s, 0.05 * s, a, 0.35));
  }
  g.add(box(0.7 * s, 1.0 * s, 0.1, SOCKET, 0, 0, 1.1 * s));
  return g;
}

/** A carved war-shrine for the open spots inside the walls: a totem among stakes, a brazier glowing before it. */
export function warShrine(r: () => number): THREE.Group {
  const g = new THREE.Group();
  const tt = orcTotem(3.4, r);
  g.add(tt);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.6;
    g.add(stake(Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05, 1.2 + (i % 2) * 0.4, 0.1, a, 0.3));
  }
  const b = brazier(0.7, false, 0.7);
  b.position.set(0, 0, 0.95);
  g.add(b);
  g.add(blob(0.35, BONE_SH, -0.7, 0.05, 0.7, 1.3, 0.4, 1));
  return g;
}

/**
 * The Horde's land outside the walls: the clan moot outside the gate (a great bonfire in a ring of stakes
 * and skulls, war drums, a boar roasting on a spit and the tents of the clans), war banners down the road,
 * spiked barricades, bone heaps, scorched stumps, painted boulders and lone tents in the fields, and
 * embers drifting over it all.
 */
export function addWarcamp(g: THREE.Group, r: () => number, k: GroundKit): void {
  const { at } = k;
  const cx = 21, cz = 57.5;
  const y0 = at(cx, cz);
  // the great bonfire
  g.add(cyl(2.2, 2.4, 0.12, 0x3a3230, 10, cx, y0 - 0.02, cz));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const l = limb(V(cx + Math.cos(a) * 1.6, y0, cz + Math.sin(a) * 1.6), V(cx + Math.cos(a) * 0.2, y0 + 2.6, cz + Math.sin(a) * 0.2), 0.2, 0.14, C.timber, 5);
    g.add(l);
  }
  g.add(glow(new THREE.CylinderGeometry(1.4, 1.6, 0.25, 9)).translateX(cx).translateY(y0 + 0.1).translateZ(cz));
  const bf = flame(3.0);
  bf.position.set(cx, y0 + 0.2, cz);
  g.add(bf);
  // the ring of stakes and skulls round it
  const RR = 7.0;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = cx + Math.cos(a) * RR, z = cz + Math.sin(a) * RR * 0.85;
    g.add(stake(x, at(x, z) - 0.1, z, i % 2 ? 2.2 : 2.9, 0.13, a, 0.1));
    if (i % 2 === 0) {
      const sk = orcSkull(0.36);
      sk.position.set(x, at(x, z) + 2.5, z);
      sk.rotation.y = -Math.PI / 2 - a;
      g.add(sk);
    }
  }
  // drums round the fire, and the boar on its spit over a second fire
  for (const a of [0.5, 2.1, 3.9]) {
    const x = cx + Math.cos(a) * 4.2, z = cz + Math.sin(a) * 3.6;
    const d = warDrum(0.9);
    d.position.set(x, at(x, z), z);
    g.add(d);
  }
  {
    const x = cx - 3.8, z = cz - 3.2, y = at(x, z);
    for (const s of [-1, 1]) {
      g.add(limb(V(x + s * 1.2, y, z - 0.3), V(x + s * 1.1, y + 1.5, z), 0.07, 0.06, C.timber, 4));
      g.add(limb(V(x + s * 1.2, y, z + 0.3), V(x + s * 1.1, y + 1.5, z), 0.07, 0.06, C.timber, 4));
    }
    g.add(limb(V(x - 1.5, y + 1.45, z), V(x + 1.5, y + 1.45, z), 0.05, 0.05, C.timber, 4));
    g.add(blob(0.55, 0x8a4a2a, x, y + 1.35, z, 1.6, 0.85, 0.9));
    g.add(glow(new THREE.CylinderGeometry(0.5, 0.55, 0.1, 7)).translateX(x).translateY(y + 0.08).translateZ(z));
    g.add(glow(new THREE.ConeGeometry(0.35, 0.6, 5).translate(0, 0.3, 0), FLAME, FLAME_E).translateX(x).translateY(y + 0.1).translateZ(z));
  }
  // the clans' tents behind the ring
  for (const [dx, dz, s] of [[-9.5, -1.5, 1.2], [10, -3, 1.3], [8.5, 5.5, 1.0], [-3, -9.2, 1.1]] as [number, number, number][]) {
    const x = cx + dx, z = cz + dz;
    const tn = hideTent(s);
    tn.position.set(x, at(x, z) - 0.05, z);
    tn.rotation.y = Math.atan2(cx - x, cz - z);
    g.add(tn);
  }
  // war standards down the road out of the gate
  for (const z of [51, 60, 69, 78]) for (const x of [-3.9, 3.9]) {
    const st = warStandard(C.red, 5.0, false);
    st.position.set(x, at(x, z), z);
    st.rotation.y = x < 0 ? -0.35 : 0.35;
    g.add(st);
  }
  // the fields: barricades of crossed stakes, bone heaps, burnt stumps, painted boulders and lone tents
  let placed = 0;
  for (let tries = 0; tries < 1000 && placed < 64; tries++) {
    const a = r() * Math.PI * 2, d = k.wallR + 7 + r() * 76;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!k.free(x, z)) continue;
    if (Math.hypot(x - cx, z - cz) < 13) continue;
    const y = at(x, z);
    const kind = placed % 8;
    if (kind === 0 || kind === 4) {
      // a barricade: stakes crossed in pairs on a rail
      const bg = new THREE.Group();
      for (let j = 0; j < 4; j++) for (const s of [-1, 1]) {
        const st = cone(0.1, 2.0, C.timber, 4, -1.5 + j, 0, 0);
        st.rotation.x = s * 0.7;
        bg.add(st);
      }
      bg.add(limb(V(-1.8, 0.45, 0), V(1.8, 0.45, 0), 0.08, 0.08, C.timber, 4));
      bg.position.set(x, y, z);
      bg.rotation.y = r() * Math.PI;
      g.add(bg);
    } else if (kind === 1) {
      g.add(blob(0.7, BONE_SH, x, y + 0.05, z, 1.3, 0.45, 1.1));
      const sk = orcSkull(0.4);
      sk.position.set(x + 0.3, y + 0.55, z);
      sk.rotation.y = r() * 6;
      g.add(sk);
      for (let j = 0; j < 3; j++) g.add(box(0.8, 0.1, 0.1, BONE_W, x - 0.3 + j * 0.2, y + 0.3, z + (j - 1) * 0.3).rotateY(r() * 3));
    } else if (kind === 2) {
      g.add(cyl(0.34, 0.46, 0.7 + r() * 0.6, 0x2a221e, 6, x, y - 0.05, z));
      g.add(cone(0.16, 0.5, 0x2a221e, 4, x + 0.15, y + 0.6, z));
    } else if (kind === 3) {
      g.add(blob(0.9 + r() * 0.5, C.rock, x, y + 0.3, z, 1.2, 0.8, 1.1));
      g.add(box(0.5, 0.5, 0.05, C.red, x, y + 0.75, z + 0.95).rotateY(r() * 0.4));
    } else if (kind === 5 && placed % 16 === 5) {
      const tn = hideTent(1.1);
      tn.position.set(x, y - 0.05, z);
      tn.rotation.y = r() * 6;
      g.add(tn);
    } else if (kind === 6 && placed % 16 === 6) {
      const tt = orcTotem(2.8, r);
      tt.position.set(x, y - 0.05, z);
      tt.rotation.y = r() * 6;
      g.add(tt);
    } else {
      // a patch of scrub and thistles
      for (let j = 0; j < 3; j++) g.add(blob(0.45 + r() * 0.2, j % 2 ? 0x5a5a2e : 0x4a4a28, x + (r() - 0.5) * 1.6, y + 0.2, z + (r() - 0.5) * 1.6, 1.1, 0.7, 1));
    }
    placed++;
  }
  // embers adrift over the camp
  k.motes(g, r, 28, EMBER, EMBER_E, () => {
    const a = r() * Math.PI * 2, d = 8 + r() * 78;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    return [x, (Math.hypot(x, z) > k.wallR ? at(x, z) : 0) + 1.2 + r() * 4, z];
  });
  void getSeason;
  void BLOOD;
}

/** A torch post for the orc streets: a stake with an iron cage of coals on top and a skull below it. */
export function torchPost(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.1, 0.13, 3.0, C.timber, 5));
  g.add(cyl(0.3, 0.18, 0.4, IRON_BK, 6, 0, 2.9));
  const glass = box(0.34, 0.34, 0.34, C.window, 0, 3.0, 0);
  glass.userData.window = true;
  g.add(glass);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.add(cone(0.04, 0.3, IRON_BK, 4, Math.cos(a) * 0.28, 3.25, Math.sin(a) * 0.28));
  }
  const sk = orcSkull(0.26);
  sk.position.set(0, 2.2, 0.14);
  g.add(sk);
  return g;
}
