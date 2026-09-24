// The Grove: the druids' own buildings and pieces. The World Tree headquarters, the
// tree-house watchtower, rune stones, leaf-crowned totems and glowing toadstools,
// all dressed in the layered foliage from kit.ts (druidCanopy / leafCluster).
//
// Every static part is baked with its building (one mesh per material); the only
// moving parts are a handful of merged swarms (fireflies, spirit wisps).

import * as THREE from 'three';
import type { Built } from './buildings';
import {
  AMBER, AMBER_E, BARK_C, BARK_DK_C, C, box, branch, cone, cyl, druidCanopy, fireflies, getSeason,
  gnarledTrunk, hangingLantern, leafCluster, mesh, mossPal, rng, spiralGlyph, swarm, type LeafPal,
} from './kit';

const MENHIR = 0x8e9a80, MENHIR_DK = 0x6c775f;
const SHROOM_GLOW = 0x9af2dc, SHROOM_GLOW_E = 0x1c7a64;

/** Pink blossom masses for the very top of the World Tree. */
function blossomPal(): LeafPal {
  return getSeason() === 'winter' ? { top: 0xf6f8fa, mid: 0xe7c9d6, under: 0xb98ba0 } : { top: 0xfbd3e2, mid: 0xf2a8c3, under: 0xc9789a };
}

/** A round window that glows at night. */
function roundWindow(x: number, y: number, z: number, ry = 0): THREE.Group {
  const g = new THREE.Group();
  const w = cyl(0.32, 0.32, 0.12, C.window, 8);
  w.rotation.x = Math.PI / 2;
  w.userData.window = true;
  g.add(w);
  g.add(mesh(new THREE.TorusGeometry(0.36, 0.07, 4, 10), BARK_DK_C));
  g.position.set(x, y, z);
  g.rotation.y = ry;
  return g;
}

/** A standing stone, a spiral carved in its face glowing faintly, moss on its head. */
export function runeStone(h: number, rand: () => number, glyph = true): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.26, 0.36, h, 4, 1);
  geo.rotateY(Math.PI / 4);
  geo.scale(1.25, 1, 0.85);
  geo.translate(0, h / 2, 0);
  const st = mesh(geo, rand() < 0.5 ? MENHIR : MENHIR_DK);
  st.rotation.z = (rand() - 0.5) * 0.12;
  g.add(st);
  g.add(leafCluster(0.3, mossPal(), 0, h - 0.02, 0, 1.3, 0.45, 1.1, 0, Math.floor(rand() * 99)));
  if (glyph) {
    const sp = spiralGlyph(Math.min(1.1, h * 0.42));
    sp.position.set(0, h * 0.56, 0.33);
    g.add(sp);
  }
  return g;
}

/** A carved post with a leaf crown: the druids' totem. */
export function leafTotem(h: number, rand: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.2, 0.26, h, 0x6e5134, 6));
  // carved bands, and a face that watches the path
  for (const y of [h * 0.3, h * 0.62]) g.add(cyl(0.25, 0.25, 0.14, BARK_DK_C, 6, 0, y));
  g.add(box(0.1, 0.07, 0.06, 0x241a12, -0.09, h * 0.8, 0.22), box(0.1, 0.07, 0.06, 0x241a12, 0.09, h * 0.8, 0.22), box(0.16, 0.05, 0.06, 0x241a12, 0, h * 0.72, 0.22));
  const sp = spiralGlyph(0.55);
  sp.position.set(0, h * 0.46, 0.24);
  g.add(sp);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(leafCluster(0.24, i % 2 ? 'deep' : 'mid', Math.cos(a) * 0.26, h + 0.02, Math.sin(a) * 0.26, 1.1, 0.7, 1.1, 0, i + Math.floor(rand() * 50)));
  }
  g.add(leafCluster(0.26, 'sun', 0, h + 0.28, 0, 1, 0.9, 1, 0, 9));
  for (const s of [-1, 1]) {
    const a = box(0.06, 0.55, 0.06, 0xd9cfae, s * 0.22, h + 0.2, 0);
    a.rotation.z = -s * 0.55;
    g.add(a);
  }
  return g;
}

/** A ring (or a scatter) of toadstools, some of them glowing softly. */
export function toadstools(n: number, rand: () => number, spread: number, ring = false, glow = 0.35): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = ring ? Math.cos(a) * spread : (rand() - 0.5) * spread * 2;
    const z = ring ? Math.sin(a) * spread : (rand() - 0.5) * spread * 2;
    const s = 0.7 + rand() * 0.6;
    g.add(mesh(new THREE.CylinderGeometry(0.06 * s, 0.09 * s, 0.34 * s, 5, 1, true).translate(x, 0.17 * s, z), 0xefe6d0));
    const lit = rand() < glow;
    const cap = mesh(new THREE.SphereGeometry(0.21 * s, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2), lit ? SHROOM_GLOW : rand() < 0.6 ? 0xc0392b : 0xd98b2b, lit ? { emissive: SHROOM_GLOW_E } : {});
    cap.position.set(x, 0.3 * s, z);
    g.add(cap);
  }
  return g;
}

/** Wooden steps winding up round a trunk. */
function spiralSteps(g: THREE.Group, r: number, y0: number, y1: number, turns: number, n: number, a0 = 0): void {
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 * turns;
    const st = box(1.0, 0.12, 0.46, C.timberLight, Math.cos(a) * r, y0 + (i / n) * (y1 - y0), Math.sin(a) * r);
    st.rotation.y = -a;
    g.add(st);
    if (i % 3 === 0) g.add(box(0.07, 0.8, 0.07, C.timber, Math.cos(a) * (r + 0.42), y0 + (i / n) * (y1 - y0), Math.sin(a) * (r + 0.42)));
  }
}

/** A round wooden deck with a railing of bent branches. */
function deck(g: THREE.Group, r: number, y: number, x = 0, z = 0): void {
  g.add(cyl(r, r - 0.1, 0.25, C.timberLight, 14, x, y, z));
  const n = Math.max(8, Math.round(r * 4));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.add(box(0.09, 0.7, 0.09, C.timber, x + Math.cos(a) * (r - 0.08), y + 0.25, z + Math.sin(a) * (r - 0.08)));
  }
  g.add(mesh(new THREE.TorusGeometry(r - 0.08, 0.06, 4, n * 2).rotateX(Math.PI / 2), C.timber).translateX(x).translateY(y + 0.95).translateZ(z));
}

/** A rope bridge of planks sagging between two points. */
function ropeBridge(g: THREE.Group, a0: THREE.Vector3, a1: THREE.Vector3, sag: number): void {
  const n = Math.max(6, Math.round(a0.distanceTo(a1) / 0.45));
  const ry = -Math.atan2(a1.z - a0.z, a1.x - a0.x) + Math.PI / 2;
  const side = new THREE.Vector3(a1.z - a0.z, 0, -(a1.x - a0.x)).normalize().multiplyScalar(0.45);
  let prev: THREE.Vector3[] | null = null;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const p = a0.clone().lerp(a1, k);
    p.y -= Math.sin(k * Math.PI) * sag;
    const plank = box(0.9, 0.08, 0.3, C.timberLight, p.x, p.y, p.z);
    plank.rotation.y = ry;
    g.add(plank);
    const ropes = [p.clone().add(side).setY(p.y + 0.75), p.clone().sub(side).setY(p.y + 0.75)];
    if (prev) for (let s = 0; s < 2; s++) g.add(branch(prev[s], ropes[s], 0.035, 0x8a7a5a, 3));
    prev = ropes;
  }
}

/**
 * The druids' World Tree: a sacred grove of rune stones round a young oak, then an oak with a
 * tree-house in its arms, then the World Tree itself: a vast gnarled trunk on arching roots, a
 * door in the roots under a glowing amber heart, runes glowing in the bark, a stair winding up to
 * its decks, and three tiers of leaves hung with lanterns, vines and blossom; a bridge to a
 * daughter tree, a sacred spring and a spirit-wisp host circling its crown at the last.
 */
export function druidHall(t: number): Built {
  const g = new THREE.Group();
  const r = rng(71 + t);
  if (t === 1) {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.2;
      if (Math.sin(a) > 0.8) continue;
      const st = runeStone(1.7 + r() * 0.7, r, i % 2 === 0);
      st.position.set(Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4);
      st.rotation.y = -a - Math.PI / 2;
      g.add(st);
    }
    g.add(gnarledTrunk(0.24, 0.36, 2.4, r, { roots: 4, rootR: 0.13, spread: 1.6 }));
    const can = druidCanopy({ r: 1.55, h: 1.5, rand: r, droop: 3, blossom: 4, vines: 3 });
    can.position.y = 2.1;
    g.add(can);
    g.add(box(1.6, 0.6, 0.9, MENHIR, 0, 0, 2.2));
    g.add(spiralGlyph(0.6).translateY(0.35).translateZ(2.66));
    g.add(toadstools(9, r, 2.3, true, 0.45));
    g.add(fireflies(9, 3, 2.5, r));
    return { obj: g, h: 5.5, w: 8, d: 8 };
  }
  if (t === 2) {
    // a young oak with a round tree-house in its arms, a ladder up to it
    g.add(gnarledTrunk(0.95, 1.35, 6.2, r, { roots: 6, rootR: 0.4, spread: 1.5, door: true }));
    deck(g, 2.8, 3.6);
    g.add(cyl(2.0, 2.0, 1.8, 0xc9a56a, 10, 0, 3.85));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(box(0.16, 1.8, 0.16, C.timber, Math.cos(a) * 2.0, 3.85, Math.sin(a) * 2.0)); }
    g.add(cone(2.6, 1.3, C.tile, 10, 0, 5.6));
    g.add(roundWindow(0, 4.7, 2.04), roundWindow(1.6, 4.7, 1.22, 0.9), roundWindow(-1.6, 4.7, 1.22, -0.9));
    const lad = new THREE.Group();
    for (const x of [-0.3, 0.3]) lad.add(box(0.08, 3.8, 0.08, C.timber, x, 0, 0));
    for (let y = 0.4; y < 3.6; y += 0.5) lad.add(box(0.6, 0.06, 0.06, C.timber, 0, y, 0));
    lad.rotation.x = -0.2;
    lad.position.set(0.8, 0, 3.3);
    g.add(lad);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      g.add(branch(new THREE.Vector3(0, 5.6, 0), new THREE.Vector3(Math.cos(a) * 2.2, 7.2, Math.sin(a) * 2.0), 0.3, BARK_C));
    }
    const can = druidCanopy({ r: 3.3, h: 3.0, rand: r, droop: 6, blossom: 6, vines: 8, lanterns: 3, glow: 8 });
    can.position.y = 6.6;
    g.add(can);
    const l = hangingLantern(0.5, 1.1);
    l.position.set(2.5, 5.2, 0.9);
    g.add(l, box(0.9, 0.08, 0.08, C.timber, 2.1, 5.2, 0.9));
    g.add(toadstools(6, r, 1.6).translateX(-3).translateZ(2.2));
    g.add(fireflies(12, 4, 4, r));
    return { obj: g, h: 11, w: 9, d: 9 };
  }
  // the World Tree
  const R = [0, 0, 0, 2.3, 2.8, 3.1][t];
  const H = [0, 0, 0, 7, 8.6, 10][t];
  const crown = [0, 0, 0, 4.4, 5.4, 6.2][t];
  g.add(gnarledTrunk(R * 0.72, R * 1.0, H + crown * 0.35, r, { roots: 9, rootR: R * 0.3, spread: 1.7, door: true }));
  // great roots arching out over the earth
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.35;
    if (Math.sin(a) > 0.7) continue; // the doorway
    const pts = [0, 1, 2, 3].map((k) => new THREE.Vector3(Math.cos(a) * (R * 0.8 + k * 0.85), 1.6 - k * 0.55 + (k === 1 ? 0.35 : 0), Math.sin(a) * (R * 0.8 + k * 0.85)));
    for (let k = 0; k < 3; k++) g.add(branch(pts[k], pts[k + 1], 0.46 - k * 0.1, BARK_DK_C));
    g.add(leafCluster(0.34, mossPal(), pts[1].x, pts[1].y + 0.25, pts[1].z, 1.3, 0.4, 1.3, 0, i));
  }
  // the door in the roots under a living arch, the amber heart glowing above it
  const dz = R * 0.93;
  g.add(box(1.25, 2.1, 0.4, C.door, 0, 0, dz));
  g.add(mesh(new THREE.TorusGeometry(0.85, 0.2, 5, 10, Math.PI), BARK_DK_C).translateY(1.55).translateZ(dz + 0.1));
  for (const s of [-1, 1]) g.add(box(0.36, 1.6, 0.36, BARK_DK_C, s * 0.85, 0, dz + 0.1));
  for (const s of [-1, 1]) { const l = hangingLantern(0.35, 1.0); l.position.set(s * 1.05, 2.3, dz + 0.4); g.add(l); }
  const heart = mesh(new THREE.IcosahedronGeometry(0.55, 0), AMBER, { emissive: AMBER_E });
  heart.scale.set(1, 1.4, 0.6);
  heart.position.set(0, H * 0.5, R * 0.86);
  g.add(heart);
  g.add(mesh(new THREE.TorusGeometry(0.78, 0.12, 5, 12), BARK_DK_C).translateY(H * 0.5).translateZ(R * 0.84));
  // runes glowing in the bark all round
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + ((i + 1) / 6) * Math.PI * 2;
    const y = H * (0.25 + (i % 2) * 0.3);
    const rr = R * (1 - (y / (H + crown * 0.35)) * 0.28) + 0.02;
    const sp = spiralGlyph(1.1);
    sp.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
    sp.rotation.y = Math.PI / 2 - a;
    g.add(sp);
  }
  // a stair winding up round the trunk to the decks
  spiralSteps(g, R + 0.5, 0.4, H * 0.82, 1.4, 16 + t * 4, 1.2);
  for (let k = 0; k < t - 2; k++) deck(g, R + 1.4, 3.4 + k * 2.7);
  // boughs spreading into the crown
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.6;
    g.add(branch(new THREE.Vector3(Math.cos(a) * R * 0.3, H - 0.6, Math.sin(a) * R * 0.3), new THREE.Vector3(Math.cos(a) * crown * 0.72, H + 0.9, Math.sin(a) * crown * 0.62), R * 0.2, BARK_C));
  }
  // the trunk rises on through the tiers, boughs reaching out into each
  const upper = t >= 4 ? 1.5 : 0.95;
  g.add(branch(new THREE.Vector3(0, H + crown * 0.2, 0), new THREE.Vector3(0.2, H + crown * upper, -0.1), R * 0.5, BARK_C, 8));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.2;
    g.add(branch(new THREE.Vector3(0, H + crown * 0.45, 0), new THREE.Vector3(Math.cos(a) * crown * 0.5, H + crown * 0.88, Math.sin(a) * crown * 0.5), R * 0.15, BARK_C));
    if (t >= 4) g.add(branch(new THREE.Vector3(0, H + crown * 1.05, 0), new THREE.Vector3(Math.cos(a + 0.6) * crown * 0.32, H + crown * 1.48, Math.sin(a + 0.6) * crown * 0.32), R * 0.1, BARK_C));
  }
  // three tiers of leaves: broad and hung with lanterns and vines below, a blossoming dome on top
  const tiers: [number, number, number, object][] = [
    [H, crown, crown * 0.58, { droop: 10, vines: 12, lanterns: 6, blossom: 4, glow: 14 }],
    [H + crown * 0.8, crown * 0.72, crown * 0.52, { droop: 6, vines: 6, blossom: 6, lanterns: 3, glow: 10 }],
  ];
  if (t >= 4) tiers.push([H + crown * 1.42, crown * 0.46, crown * 0.5, { droop: 4, blossom: 10, glow: 6 }]);
  for (const [y, rad, hh, extra] of tiers) {
    const c = druidCanopy({ r: rad, h: hh, rand: r, ...extra });
    c.position.y = y;
    g.add(c);
  }
  const top = tiers[tiers.length - 1];
  const topY = top[0] + top[2];
  if (t === 5) {
    // the crown in full blossom
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      g.add(leafCluster(crown * 0.13, blossomPal(), Math.cos(a) * crown * 0.2, topY - crown * 0.08, Math.sin(a) * crown * 0.2, 1.1, 0.7, 1.1, 1, 200 + i));
    }
    g.add(leafCluster(crown * 0.14, blossomPal(), 0, topY + crown * 0.02, 0, 1, 0.75, 1, 1, 210));
  }
  if (t >= 4) {
    // a ring of glowing seeds wheeling slowly round the gap between the lower tiers
    const seeds = new THREE.Group();
    const n = t === 5 ? 22 : 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = mesh(new THREE.OctahedronGeometry(0.2, 0), i % 3 ? 0xd9f79a : 0xbff7e6, { emissive: i % 3 ? 0x6a9a1a : 0x2a8a70 });
      s.scale.set(1, 0.45, 1.6);
      s.position.set(Math.cos(a) * crown * 0.92, Math.sin(a * 3) * 0.35, Math.sin(a) * crown * 0.92);
      s.rotation.y = -a;
      seeds.add(s);
    }
    const ring = swarm(seeds, { orbit: 0.18 });
    ring.position.y = H + crown * 0.64;
    g.add(ring);
    // a daughter tree beside it with its own deck, a rope bridge across
    const sx = -4.6, sz = 3.4, sy = 4.0;
    const dg = new THREE.Group();
    dg.add(gnarledTrunk(0.4, 0.6, sy + 1.6, r, { roots: 4, rootR: 0.2, spread: 1.4 }));
    deck(dg, 1.35, sy);
    const dc = druidCanopy({ r: 1.7, h: 1.6, rand: r, droop: 3, blossom: 3, vines: 3, lanterns: 1 });
    dc.position.y = sy + 1.4;
    dg.add(dc);
    dg.position.set(sx, 0, sz);
    g.add(dg);
    ropeBridge(g, new THREE.Vector3(sx + 1.1, sy + 0.2, sz - 0.4), new THREE.Vector3(-R * 0.95, 3.6, R * 0.35), 0.6);
  }
  if (t === 5) {
    // a sacred spring glowing at its roots, rune stones round it and more of the old grove behind
    g.add(cyl(1.6, 1.6, 0.08, 0x4aa0a8, 12, 3.4, 0.04, 3.2));
    g.add(mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.04, 12), 0x9ff0e0, { emissive: 0x1f6a5e, opacity: 0.6 }).translateX(3.4).translateY(0.1).translateZ(3.2));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(leafCluster(0.3, mossPal(), 3.4 + Math.cos(a) * 1.85, 0.12, 3.2 + Math.sin(a) * 1.85, 1.4, 0.6, 1.1, 0, 300 + i));
    }
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * 0.2 - i * 0.45;
      const st = runeStone(2 + r() * 0.8, r, i % 2 === 0);
      st.position.set(Math.cos(a) * 5.6, 0, Math.sin(a) * 5.0 - 1);
      st.rotation.y = -a - Math.PI / 2;
      g.add(st);
    }
    // a host of spirit wisps wheeling slowly round the crown
    const w = fireflies(14, crown * 1.05, crown * 0.8, r, true);
    w.position.y = H + crown * 0.2;
    g.add(w);
  }
  g.add(toadstools(8, r, 1.3, true, 0.5).translateX(-3.2).translateZ(4.4));
  const ff = fireflies(10 + t * 3, crown * 0.9, 3, r);
  ff.position.y = 1.2;
  g.add(ff);
  return { obj: g, h: topY + 1.5, w: 14, d: 14 };
}

/**
 * The druids' lookout is a tree-house: a gnarled trunk on buttress roots, a stair winding up it to a
 * railed deck with a round hut, lit windows and a lantern at its door, and over it all a layered crown
 * of leaves, vines hanging, a leaf-green pennant flying from the top and fireflies about the boughs.
 */
export function druidWatchtower(t: number): Built {
  const g = new THREE.Group();
  const r = rng(301 + t);
  const h = 7 + t * 1.6;
  const py = h - 1.4;
  g.add(gnarledTrunk(0.62, 1.12, h + 0.6, r, { roots: 6, rootR: 0.34, spread: 1.75 }));
  spiralSteps(g, 1.2, 0.5, py - 0.2, 1.6 + t * 0.2, 12 + t * 3, 0.3);
  // leafy boughs breaking out of the trunk on the way up
  for (const [k, a] of [[0.42, 2.2], [0.6, -0.9], [0.74, 3.6]] as [number, number][]) {
    if (h * k > py - 1.2) continue;
    const end = new THREE.Vector3(Math.cos(a) * 1.9, h * k + 0.9, Math.sin(a) * 1.9);
    g.add(branch(new THREE.Vector3(0, h * k, 0), end, 0.2, BARK_C));
    g.add(leafCluster(0.62, 'mid', end.x, end.y + 0.25, end.z, 1.2, 0.72, 1.2, 1, Math.round(k * 50)));
    g.add(leafCluster(0.36, 'sun', end.x * 0.8, end.y + 0.65, end.z * 0.8, 1, 0.8, 1, 0, Math.round(k * 60)));
  }
  deck(g, 2.15, py);
  // the hut, to the sunny side of the deck: daub walls ribbed with timber, round windows lit at night, a turf cap
  const hy = py + 0.25, hx = 0.55;
  g.add(cyl(0.98, 1.05, 1.5, 0xc9a56a, 10, hx, hy));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.26; g.add(box(0.12, 1.5, 0.12, C.timber, hx + Math.cos(a) * 1.01, hy, Math.sin(a) * 1.01)); }
  g.add(roundWindow(hx + 1.0, hy + 0.85, 0.1, Math.PI / 2), roundWindow(hx + 0.55, hy + 0.85, 0.85, 0.6));
  g.add(box(0.6, 1.1, 0.12, C.door, hx - 0.35, hy, 0.96));
  const lan = hangingLantern(0.25, 0.9);
  lan.position.set(hx + 0.4, hy + 1.45, 1.3);
  g.add(lan);
  g.add(cone(1.4, 0.95, C.tile, 10, hx, hy + 1.5));
  g.add(leafCluster(0.45, mossPal(), hx + 0.2, hy + 2.1, 0.1, 1.2, 0.6, 1.2, 0, 3));
  // boughs from the trunk up into the crown, which leans back over the deck
  const cx = -1.05, cz = -0.45;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.8;
    g.add(branch(new THREE.Vector3(Math.cos(a) * 0.45, py - 0.8, Math.sin(a) * 0.45), new THREE.Vector3(cx + Math.cos(a) * 1.8, hy + 2.9, cz + Math.sin(a) * 1.8), 0.24, BARK_C));
  }
  g.add(branch(new THREE.Vector3(-0.2, py, 0), new THREE.Vector3(cx, hy + 4.0, cz), 0.4, BARK_C));
  const can = druidCanopy({ r: 2.5, h: 2.5, rand: r, droop: 7, blossom: 7, vines: 9, lanterns: 3, glow: 6 });
  can.position.set(cx, hy + 2.9, cz);
  g.add(can);
  const top = hy + 2.9 + 2.5;
  // the pennant
  g.add(cyl(0.05, 0.06, 2.0, BARK_DK_C, 5, cx + 0.3, top - 0.6, cz));
  const flag = box(1.2, 0.7, 0.05, 0x4f8a32, cx + 0.95, top + 0.85, cz);
  flag.userData.flag = true;
  g.add(flag);
  if (t >= 3) {
    // a crow's nest on a bough reaching out to one side
    const a = new THREE.Vector3(0.2, py - 1.8, -0.3), b = new THREE.Vector3(0.6, py + 0.3, -2.1);
    g.add(branch(a, b, 0.22, BARK_C));
    g.add(cyl(0.5, 0.4, 0.55, 0x8a6a3e, 8, b.x, b.y - 0.1, b.z));
    for (let i = 0; i < 6; i++) { const q = (i / 6) * Math.PI * 2; g.add(box(0.06, 0.4, 0.06, C.timber, b.x + Math.cos(q) * 0.46, b.y + 0.4, b.z + Math.sin(q) * 0.46)); }
  }
  if (t >= 5) {
    // runes glowing in the bark at the foot
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i - 1) * 1.1;
      const sp = spiralGlyph(0.8);
      sp.position.set(Math.cos(a) * 1.1, 1.4 + (i % 2) * 0.6, Math.sin(a) * 1.1);
      sp.rotation.y = Math.PI / 2 - a;
      g.add(sp);
    }
  }
  const ff = fireflies(8 + t, 2.6, 3.2, r, t >= 4);
  ff.position.y = py;
  g.add(ff);
  return { obj: g, h: top + 2.2, w: 4, d: 4 };
}
