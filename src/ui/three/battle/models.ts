// Models for the battle scenes: soldiers of every kind in every village's look,
// siege engines with moving parts, villagers carrying things, and the odd prop.
//
// Figures reuse the village's own troop models, merged into a handful of meshes
// each (a battle puts dozens on screen) with their weapon left on a pivot so it
// can swing. One template is built per kind and look; figures are clones that
// share its geometry, so nothing but the templates ever needs disposing.

import * as THREE from 'three';
import type { UnitId } from '../../../engine/types';
import { C, bake, blob, box, cone, cyl, getTheme, hornPair, mat, mesh, orcSkull, setTheme, type Theme } from '../kit';
import { militiaman, person, troop, type TroopModel } from '../props';

export interface Figure {
  /** placed in the world (position, facing) */
  g: THREE.Group;
  /** leans, lunges and falls */
  body: THREE.Group;
  /** the weapon hand, pivoting at the shoulder (null for those without one) */
  weapon: THREE.Object3D | null;
  /** raised arms (lookouts, cheering villagers) */
  arms: THREE.Object3D[];
  mounted: boolean;
  flyer: boolean;
}

export const FIG_SCALE = 1.3;

const TROOP: Partial<Record<UnitId, TroopModel>> = {
  spear: 'spear', sword: 'sword', axe: 'axe', archer: 'archer', scout: 'scout', noble: 'noble', light: 'light', marcher: 'marcher',
  heavy: 'heavy', paladin: 'paladin', sorcerer: 'sorcerer', druid: 'druid', goblin: 'goblin', necromancer: 'necromancer', orc: 'orc',
};

const templates = new Map<string, { root: THREE.Group; mounted: boolean; flyer: boolean }>();

/** Build under another village's look (an attacking army wears its own colours), then put the look back. */
export function withTheme<T>(theme: Theme, build: () => T): T {
  const was = getTheme();
  if (was === theme) return build();
  setTheme(theme);
  try {
    return build();
  } finally {
    setTheme(was);
  }
}

/**
 * Wrap a figure's right-hand gear (anything held out at x > 0.25) in a pivot at
 * the shoulder, so a sword can come down, a spear be thrown back, a bow raised.
 */
function pivotWeapon(root: THREE.Group, shoulder: THREE.Vector3): THREE.Group | null {
  const held = root.children.filter((c) => c.position.x > 0.25);
  if (held.length === 0) return null;
  const pivot = new THREE.Group();
  pivot.position.copy(shoulder);
  root.add(pivot);
  root.updateMatrixWorld(true);
  for (const c of held) pivot.attach(c);
  pivot.userData.dynamic = true;
  pivot.userData.weapon = true;
  return pivot;
}

/** Tag every mesh as sharing its geometry with the template (so removing a clone never frees it). */
function markShared(o: THREE.Object3D) {
  o.traverse((c) => { if (c instanceof THREE.Mesh) c.userData.sharedGeometry = true; });
}

function template(unit: UnitId, theme: Theme): { root: THREE.Group; mounted: boolean; flyer: boolean } {
  const key = `${unit}|${theme}`;
  const hit = templates.get(key);
  if (hit) return hit;
  const built = withTheme(theme, () => {
    let raw: THREE.Group;
    let mounted = false, flyer = false;
    if (unit === 'militia') raw = militiaman(0x8e3a1f, true);
    else {
      const kind = TROOP[unit] ?? 'axe';
      raw = troop(kind);
      mounted = kind === 'light' || kind === 'marcher' || kind === 'heavy' || kind === 'paladin';
      flyer = kind === 'scout' && theme !== 'classic' && theme !== 'goblin' && theme !== 'orc';
    }
    if (!flyer) pivotWeapon(raw, mounted ? new THREE.Vector3(0.34, 1.7, 0) : new THREE.Vector3(0.3, 1.0, 0));
    const root = bake(raw);
    markShared(root);
    return { root, mounted, flyer };
  });
  templates.set(key, built);
  return built;
}

/** A soldier (or militiaman) of this kind, in this look. */
export function makeFigure(unit: UnitId, theme: Theme): Figure {
  const t = template(unit, theme);
  const body = t.root.clone(true);
  let weapon: THREE.Object3D | null = null;
  body.traverse((o) => { if (o.userData.weapon) weapon = o; });
  const g = new THREE.Group();
  g.add(body);
  g.scale.setScalar(FIG_SCALE);
  return { g, body, weapon, arms: [], mounted: t.mounted, flyer: t.flyer };
}

/** Free the shared templates (the last scene is gone). */
export function disposeTemplates(): void {
  for (const t of templates.values()) t.root.traverse((c) => { if (c instanceof THREE.Mesh) c.geometry.dispose(); });
  templates.clear();
  for (const g of Object.values(PROP_GEO)) g.dispose();
}

// ---------- villagers ----------

const TUNICS = [0x8e3a1f, 0x2f5d99, 0x6f7c35, 0xc98f2e, 0x5a3a22, 0x7a2f4a];

/** A villager of the defending village; `arms` lifts both arms free so they can wave. */
export function makeVillager(theme: Theme, i: number, arms = false): Figure {
  return withTheme(theme, () => {
    const g0 = arms ? militiaman(TUNICS[i % TUNICS.length], false) : person(TUNICS[i % TUNICS.length]);
    const armList: THREE.Object3D[] = [];
    if (arms) {
      // drop the torch: a lookout needs both hands to wave
      for (const c of [...g0.children]) if (c.position.x < -0.3) g0.remove(c);
      for (const c of g0.children) if (Math.abs(Math.abs(c.position.x) - 0.24) < 0.01 && Math.abs(c.position.y - 1.0) < 0.01) armList.push(c);
    }
    const body = new THREE.Group();
    body.add(g0);
    const g = new THREE.Group();
    g.add(body);
    g.scale.setScalar(FIG_SCALE);
    return { g, body, weapon: null, arms: armList, mounted: false, flyer: false };
  });
}

// ---------- carried things and props ----------

const PROP_GEO = {
  sack: new THREE.IcosahedronGeometry(0.34, 0),
  bucket: new THREE.CylinderGeometry(0.2, 0.15, 0.3, 7).translate(0, 0.15, 0),
  arrow: new THREE.BoxGeometry(0.05, 0.05, 1.05),
  spear: new THREE.BoxGeometry(0.06, 0.06, 2.1),
  chunk: new THREE.BoxGeometry(0.6, 0.45, 0.5),
  puff: new THREE.IcosahedronGeometry(0.5, 0),
  spark: new THREE.OctahedronGeometry(0.22, 0),
};
export const GEO = PROP_GEO;

/** A bulging sack of wood, clay or iron, carried over the shoulder. */
export function sack(kind: 'wood' | 'clay' | 'iron' | 'gold'): THREE.Mesh {
  const col = kind === 'wood' ? 0xa0703c : kind === 'clay' ? 0xc2603e : kind === 'iron' ? 0x8a949c : 0xe8c060;
  const m = new THREE.Mesh(PROP_GEO.sack, mat(col));
  m.userData.sharedGeometry = true;
  m.scale.set(1, 0.8, 1);
  m.castShadow = true;
  return m;
}

export function bucket(): THREE.Mesh {
  const m = new THREE.Mesh(PROP_GEO.bucket, mat(0x7a5230));
  m.userData.sharedGeometry = true;
  m.castShadow = true;
  return m;
}

/** A banner on a pole, in the colour of whoever carries it. */
export function standard(color: number, h = 3.6): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.05, 0.05, h, 0x4a3220, 5));
  const cloth = box(0.9, 0.7, 0.04, color, 0.45, h - 0.85, 0);
  cloth.userData.cloth = true;
  g.add(cloth);
  g.add(cone(0.09, 0.22, C.gold, 5, 0, h));
  return g;
}

/** A ladder against the wall, for storming a wall the rams could not break. */
export function ladder(h: number): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.35, 0.35]) g.add(box(0.08, h, 0.08, 0x7a5230, x, 0, 0));
  for (let y = 0.4; y < h - 0.2; y += 0.5) g.add(box(0.7, 0.06, 0.06, 0x8a6238, 0, y, 0));
  return g;
}

// ---------- siege engines ----------

/** Wood and trim for a village's siege engines. */
function siegeLook(theme: Theme) {
  switch (theme) {
    case 'paladin': return { wood: 0x8a6a48, dark: 0x5b3e28, roof: 0x2c4f9e, head: 0xd9a441, accent: 0xf3eee2 };
    case 'goblin': return { wood: 0x6e4a2a, dark: 0x4a2f1a, roof: 0x7a7050, head: 0x978d74, accent: 0x6f9a2a };
    case 'sorcerer': return { wood: 0x4a3a6a, dark: 0x2a1d40, roof: 0x5b3596, head: 0xb58cff, accent: 0x8fe0ff };
    case 'druid': return { wood: 0x7a5a38, dark: 0x4e3820, roof: 0x4f7a2e, head: 0xd6cdb0, accent: 0x8fbc50 };
    case 'necromancer': return { wood: 0x3a3230, dark: 0x221c1b, roof: 0x2e2a33, head: 0xe6dfcc, accent: 0x5cff9a };
    case 'orc': return { wood: 0x5e4430, dark: 0x33241a, roof: 0x7a5a3a, head: 0xe3d8bf, accent: 0xa3261a };
    default: return { wood: 0xa0703c, dark: 0x6e4a2a, roof: 0xd4a441, head: 0x6d7782, accent: 0xb3332a };
  }
}

export interface Ram { g: THREE.Group; log: THREE.Group; crew: Figure[]; wheels: THREE.Object3D[] }

/** A wheel on its axle (the axle runs along x); turn it with rotation.x. */
function wheel(r: number, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const w = cyl(r, r, 0.16, 0x4a3220, 8);
  w.rotation.z = Math.PI / 2;
  w.position.x = 0.08;
  g.add(w);
  g.add(box(0.18, r * 1.7, 0.1, 0x6e4a2a, 0, -r * 0.85, 0));
  g.position.set(x, y, z);
  return g;
}

/**
 * A battering ram: a wheeled frame under a hide roof, and a great log hung on
 * ropes that swings forward (+Z) to strike. Two of the crew push from behind.
 */
export function makeRam(theme: Theme): Ram {
  return withTheme(theme, () => {
    const k = siegeLook(theme);
    const frame = new THREE.Group();
    frame.add(box(1.5, 0.22, 3.2, k.dark, 0, 0.5, 0));
    for (const x of [-0.62, 0.62]) for (const z of [-1.2, 1.2]) frame.add(box(0.14, 1.9, 0.14, k.wood, x, 0.6, z));
    const roof = box(1.9, 0.14, 3.5, k.roof, 0, 2.5, 0);
    roof.rotation.z = 0.0;
    frame.add(roof);
    frame.add(box(0.1, 0.5, 3.5, k.roof, -0.95, 2.1, 0), box(0.1, 0.5, 3.5, k.roof, 0.95, 2.1, 0));
    if (theme === 'goblin') for (let i = 0; i < 5; i++) frame.add(cone(0.1, 0.4, 0x978d74, 4, -0.6 + i * 0.3, 2.64, 1.5));
    if (theme === 'necromancer') frame.add(blob(0.3, 0xe6dfcc, 0, 2.8, 1.4));
    if (theme === 'orc') {
      // a battering tusk: the frame's front hung with a horned skull, stakes along its roof
      frame.add(hornPair(0.5, 2.1, 1.75, 0.45, 0.9, 0.25, 0.1));
      frame.add(orcSkull(0.4).translateY(2.55).translateZ(1.8));
      for (let i = 0; i < 5; i++) frame.add(cone(0.08, 0.5, 0x33241a, 4, -0.6 + i * 0.3, 2.62, -1.2 + i * 0.1));
    }
    const baked = bake(frame);
    const g = new THREE.Group();
    g.add(baked);
    const wheels: THREE.Object3D[] = [];
    for (const x of [-0.72, 0.72]) for (const z of [-1.1, 1.1]) { const w = wheel(0.38, x * 1.06, 0.38, z); g.add(w); wheels.push(w); }
    // the log, hung from the roof
    const log = new THREE.Group();
    log.position.set(0, 1.35, 0);
    const trunk = cyl(0.26, 0.3, 3.6, theme === 'sorcerer' ? 0x3a2f5a : 0x6e4a2a, 8);
    trunk.rotation.x = Math.PI / 2;
    trunk.position.set(0, 0, -1.6);
    log.add(trunk);
    const head = theme === 'necromancer' ? blob(0.42, 0xe6dfcc, 0, 0, 2.05) : cone(0.36, 0.7, k.head, 6, 0, 0, 1.95);
    if (theme !== 'necromancer') head.rotation.x = Math.PI / 2;
    log.add(head);
    if (theme === 'orc') {
      // the log's head is a boar's skull with its tusks
      const sk = orcSkull(0.5);
      sk.position.set(0, 0.05, 1.85);
      log.add(sk);
      log.add(hornPair(0.2, -0.2, 2.0, 0.25, 0.45, 0.35, 0.07));
    }
    if (theme === 'sorcerer') {
      const glow = mesh(new THREE.OctahedronGeometry(0.22, 0), 0xc9a6ff, { emissive: 0x7a4ad0 });
      glow.position.set(0, 0, 2.4);
      log.add(glow);
    }
    for (const z of [-0.8, 0.8]) log.add(box(0.03, 1.1, 0.03, 0xc9b48b, 0, 0.1, z));
    g.add(log);
    const crew: Figure[] = [];
    for (const x of [-0.5, 0.5]) {
      const c = makeVillager(theme, x < 0 ? 0 : 2);
      c.g.scale.setScalar(1);
      c.g.position.set(x, 0, -2.1);
      c.body.rotation.x = 0.35;
      g.add(c.g);
      crew.push(c);
    }
    return { g, log, crew, wheels };
  });
}

export type Shot = 'fire' | 'barrel' | 'orb' | 'boulder' | 'skull' | 'holy' | 'rock';

export interface Catapult { g: THREE.Group; arm: THREE.Group; ammo: THREE.Object3D; shot: Shot; crew: Figure[]; wheels: THREE.Object3D[] }

/**
 * A catapult facing +Z: the arm pivots on the axle and flings its load forward.
 * Cocked, it lies back; `arm.rotation.x` swings it (-1.0 cocked, +0.55 thrown).
 */
export function makeCatapult(theme: Theme): Catapult {
  return withTheme(theme, () => {
    const k = siegeLook(theme);
    const frame = new THREE.Group();
    frame.add(box(1.5, 0.3, 3.0, k.wood, 0, 0.4, 0));
    for (const x of [-0.5, 0.5]) {
      frame.add(box(0.18, 1.6, 0.18, k.dark, x, 0.6, 0.3));
      const brace = box(0.12, 1.6, 0.12, k.dark, x, 0.6, -0.4);
      brace.rotation.x = 0.5;
      frame.add(brace);
    }
    frame.add(box(1.2, 0.2, 0.3, k.dark, 0, 1.9, 0.3)); // the cross beam the arm slams into
    frame.add(box(1.3, 0.8, 0.6, k.dark, 0, 0.7, -1.1)); // counterweight box
    if (theme === 'goblin') frame.add(box(0.2, 0.9, 0.2, k.accent, 0.6, 0.7, 1.2));
    const baked = bake(frame);
    const g = new THREE.Group();
    g.add(baked);
    const wheels: THREE.Object3D[] = [];
    for (const x of [-0.8, 0.8]) for (const z of [-1.05, 1.05]) { const w = wheel(0.42, x * 1.04, 0.42, z); g.add(w); wheels.push(w); }
    const arm = new THREE.Group();
    arm.position.set(0, 1.25, 0.3);
    const beam = box(0.18, 3.2, 0.18, theme === 'necromancer' ? 0xb9b19c : k.wood, 0, -0.4, 0);
    arm.add(beam);
    const cup = cyl(0.34, 0.24, 0.24, k.dark, 7, 0, 2.7, 0);
    arm.add(cup);
    const shot: Shot = theme === 'paladin' ? 'holy' : theme === 'sorcerer' ? 'orb' : theme === 'necromancer' ? 'skull' : theme === 'goblin' ? 'barrel' : theme === 'druid' ? 'boulder' : theme === 'orc' ? 'rock' : 'fire';
    const ammo = ammoMesh(shot);
    ammo.position.set(0, 3.1, 0);
    arm.add(ammo);
    arm.rotation.x = -1.0;
    g.add(arm);
    const crew: Figure[] = [];
    for (const x of [-1.2, 1.2]) {
      const c = makeVillager(theme, x < 0 ? 1 : 3);
      c.g.scale.setScalar(1);
      c.g.position.set(x, 0, -0.9);
      crew.push(c);
      g.add(c.g);
    }
    return { g, arm, ammo, shot, crew, wheels };
  });
}

/** The load in a catapult's cup, and the flying projectile, by the village's look. */
export function ammoMesh(shot: Shot): THREE.Object3D {
  const g = new THREE.Group();
  switch (shot) {
    case 'holy':
      // a stone wrapped in golden light
      g.add(blob(0.36, 0xd8cfb8, 0, 0, 0));
      g.add(mesh(new THREE.IcosahedronGeometry(0.46, 1), 0xffe9a0, { emissive: 0xc08a1a, opacity: 0.6 }));
      break;
    case 'orb':
      g.add(mesh(new THREE.IcosahedronGeometry(0.4, 1), 0xc9a6ff, { emissive: 0x7a4ad0 }));
      break;
    case 'skull': {
      const s = blob(0.36, 0xe6dfcc, 0, 0, 0, 1, 1.05, 1);
      g.add(s);
      g.add(mesh(new THREE.IcosahedronGeometry(0.2, 0), 0x5cff9a, { emissive: 0x1f9a4a }));
      break;
    }
    case 'barrel': {
      const b = cyl(0.3, 0.3, 0.6, 0x7a5230, 8, 0, -0.3, 0);
      g.add(b);
      g.add(cyl(0.31, 0.31, 0.06, 0x4a4a4a, 8, 0, -0.1, 0));
      break;
    }
    case 'boulder':
      g.add(blob(0.42, 0x8e8a78, 0, 0, 0, 1, 0.9, 1.1));
      g.add(blob(0.2, 0x4f7a2e, 0.18, 0.22, 0.1));
      break;
    case 'rock':
      // a jagged black rock, iron spikes driven into it, burning in the cracks
      g.add(blob(0.46, 0x3e3a36, 0, 0, 0, 1.1, 0.9, 1));
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; g.add(cone(0.06, 0.3, 0x2e2b2a, 4, Math.cos(a) * 0.42, 0.1, Math.sin(a) * 0.42).rotateZ(-Math.cos(a) * 1.2).rotateX(Math.sin(a) * 1.2)); }
      g.add(mesh(new THREE.IcosahedronGeometry(0.28, 0), 0xff8a3a, { emissive: 0xc0400a }).translateY(0.12));
      break;
    default:
      g.add(blob(0.4, 0x5a4a3a, 0, 0, 0));
      g.add(mesh(new THREE.IcosahedronGeometry(0.3, 0), 0xffb347, { emissive: 0xff6a1a }));
  }
  return g;
}

/** The colour a projectile burns with, and the fire it starts. */
export function shotFire(shot: Shot): { flame: number; core: number; smoke: number } {
  switch (shot) {
    case 'holy': return { flame: 0xffc84a, core: 0xfff6d0, smoke: 0xd8ccb0 };
    case 'orb': return { flame: 0x9a6aff, core: 0xe6d8ff, smoke: 0x6a5a8a };
    case 'skull': return { flame: 0x3fdc7a, core: 0xc8ffd8, smoke: 0x4a5a50 };
    default: return { flame: 0xff7a2a, core: 0xffd35a, smoke: 0x5e5650 };
  }
}
