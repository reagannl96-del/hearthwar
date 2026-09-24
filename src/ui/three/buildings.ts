// Building models by level. Every builder returns a group standing on y=0,
// facing +Z, plus its footprint and the height where the level badge goes.

import * as THREE from 'three';
import type { BuildingId } from '../../engine/types';
import { BUILDINGS as BUILDINGS_DATA } from '../../engine/data/buildings';
import { addMastery } from './mastery';
import {
  ARC, ARC_EMIT, C, GLASS, STAR, STAR_EMIT, VIO, VIO_EMIT, arcaneLamp, blob, box, cone, cyl, darker, extrude, floatingCrystal, floatingIsle,
  getTheme, heraldry, house, lancet, mat, merlonRing, mesh, orbitRing, rng, roundTower, runeRing, witchHat, type Theme,
} from './kit';
import {
  anvil, banner, barrel, hqCrown, campfire, cart, catapult, crate, dummy, fence, hayBale, horse, logPile, pumpkin, ram, rock,
  stall, stump, tree, weaponRack, wheatField, windmill,
} from './props';

export interface Built {
  obj: THREE.Group;
  /** height of the level badge */
  h: number;
  /** footprint for plots and scaffolds */
  w: number;
  d: number;
}

/** A coarse bucket of the level so we only rebuild models when they visibly change. */
export function visualTier(id: BuildingId, level: number): number {
  if (level <= 0) return 0;
  switch (id) {
    case 'main': return level < 5 ? 1 : level < 10 ? 2 : level < 20 ? 3 : level < 25 ? 4 : 5;
    case 'farm': return Math.min(8, 1 + Math.floor(level / 4));
    case 'timber': case 'claypit': case 'ironmine': return Math.min(7, 1 + Math.floor(level / 5));
    case 'market': return level < 5 ? 1 : level < 10 ? 2 : level < 18 ? 3 : 4;
    case 'watchtower': return Math.min(5, 1 + Math.floor(level / 4));
    case 'wall': return level < 5 ? 1 : level < 10 ? 2 : level < 15 ? 3 : 4;
    case 'academy': case 'rally': case 'statue': return 1;
    case 'hiding': return level < 5 ? 1 : 2;
    default: return level < 10 ? 1 : level < 20 ? 2 : 3;
  }
}

export function buildModel(id: BuildingId, level: number, color: number): Built {
  const t = visualTier(id, level);
  const b = themed(id, t, baseModel(id, t, color));
  hangSign(id, b, getTheme());
  // at its highest level every building earns a finishing touch in the village's style
  const max = BUILDINGS_DATA[id].max;
  if (max > 1 && level >= max && id !== 'wall') addMastery(id, b.obj);
  return b;
}

function baseModel(id: BuildingId, t: number, color: number): Built {
  const r = rng(id.length * 131 + t * 17);
  switch (id) {
    case 'main': {
      const th = getTheme();
      if (th === 'paladin') return paladinHall(t);
      if (th === 'sorcerer') return sorcererHall(t);
      if (th === 'necromancer') return necroHall(t);
      if (th === 'druid') return druidHall(t);
      if (th === 'goblin') return goblinHall(t);
      return crowned(mainHall(t, color), t);
    }
    case 'barracks': return barracks(t, color);
    case 'stable': return stable(t, r);
    case 'workshop': return workshop(t);
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
    case 'wall': return { obj: new THREE.Group(), h: 4, w: 4, d: 4 };
  }
}

/** In a hero's village the headquarters wears that hero's crown on its roof. */
function crowned(b: Built, t: number): Built {
  const theme = getTheme();
  if (theme === 'classic' || theme === 'paladin') return b;
  const top = [0, 5.0, 6.4, 7.3, 10.2, 11.4][t];
  const size = [0, 0.75, 0.85, 0.95, 1.2, 1.3][t];
  const c = hqCrown(theme, rng(t * 7 + 3));
  c.scale.setScalar(size);
  c.position.set(0, top, 0);
  b.obj.add(c);
  return { ...b, h: b.h + 3 * size };
}

function mainHall(t: number, color: number): Built {
  const g = new THREE.Group();
  if (t === 1) {
    g.add(house({ w: 7, d: 5, h: 2.6, roofH: 2.4, roof: C.thatch, windows: 2 }));
    const b = banner(color, 4.2);
    b.position.set(4.3, 0, 2.2);
    g.add(b);
    g.add(barrel(-4.2, 1.5), crate(-4.3, 0.3));
    return { obj: g, h: 6.2, w: 8, d: 6 };
  }
  if (t === 2) {
    g.add(house({ w: 9, d: 6, h: 3.4, roofH: 3, windows: 3, chimney: true }));
    const tw = new THREE.Group();
    tw.add(box(2.6, 7.2, 2.6, C.timberLight));
    tw.add(box(3.0, 0.3, 3.0, C.timber, 0, 7.2, 0));
    tw.add(cone(2.3, 2.6, C.tile, 4, 0, 7.4, 0).rotateY(Math.PI / 4));
    tw.position.set(-5.8, 0, 0.5);
    g.add(tw);
    const b = banner(color, 5);
    b.position.set(5.4, 0, 2.6);
    g.add(b);
    return { obj: g, h: 10.5, w: 13, d: 7 };
  }
  if (t === 3) {
    g.add(house({ w: 10, d: 7, h: 4.2, roofH: 3.2, stone: true, windows: 4, roof: C.tile }));
    for (const x of [-6.2, 6.2]) {
      const tw = roundTower(1.7, 7.5, { roof: C.tile, banner: color });
      tw.position.set(x, 0, 1.5);
      g.add(tw);
    }
    g.add(box(2.4, 0.4, 1.4, C.stoneDark, 0, 0, 4.1));
    return { obj: g, h: 13, w: 15, d: 9 };
  }
  // the keep
  const big = t === 5;
  const k = big ? 1.12 : 1;
  const keep = new THREE.Group();
  keep.add(box(7.5, 9.5, 7.5, C.stone));
  keep.add(box(8.1, 0.5, 8.1, C.stoneDark, 0, 9.3, 0));
  for (let i = 0; i < 4; i++) {
    for (let j = -1; j <= 1; j++) {
      const m = box(0.8, 0.9, 0.8, C.stone, 0, 9.8, 0);
      const side = i % 2 === 0 ? 1 : -1;
      if (i < 2) m.position.set(j * 2.6, 9.8, side * 3.7);
      else m.position.set(side * 3.7, 9.8, j * 2.6);
      keep.add(m);
    }
  }
  for (let y = 3; y < 9; y += 3) for (const x of [-1.8, 1.8]) keep.add(box(0.6, 1.1, 0.15, C.window, x, y, 3.8));
  keep.add(box(2.0, 3.0, 0.3, C.door, 0, 0, 3.8));
  keep.scale.setScalar(k);
  g.add(keep);
  for (const [x, z] of [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]]) {
    const tw = roundTower(1.8, big ? 13 : 11.5, { roof: C.tile, banner: z > 0 ? color : undefined });
    tw.position.set(x * k, 0, z * k);
    g.add(tw);
  }
  const hall = house({ w: 6, d: 5, h: 3.8, roofH: 2.6, stone: true, windows: 2 });
  hall.position.set(-6.5 * k, 0, 1);
  hall.rotation.y = Math.PI / 2;
  g.add(hall);
  if (big) {
    g.add(cyl(0.12, 0.12, 3, C.gold, 5, 0, 10.8 * k));
    const b = banner(color, 4);
    b.position.set(0, 10.6 * k, 0);
    g.add(b);
  }
  return { obj: g, h: big ? 17 : 15, w: 13, d: 13 };
}

function barracks(t: number, color: number): Built {
  const g = new THREE.Group();
  const main = house({ w: 7, d: 5, h: 3, roofH: 2.4, windows: 2, stone: t === 3, roof: t === 3 ? C.slate : C.tile });
  g.add(main);
  const yard = new THREE.Group();
  const f1 = fence(6);
  f1.position.set(0, 0, 3);
  const f2 = fence(4);
  f2.rotation.y = Math.PI / 2;
  f2.position.set(3, 0, 5);
  yard.add(f1, f2);
  const d1 = dummy();
  d1.position.set(-1, 0, 4.8);
  const d2 = dummy();
  d2.position.set(1.4, 0, 5.2);
  yard.add(d1, d2);
  const rack = weaponRack();
  rack.position.set(-2.4, 0, 3.4);
  yard.add(rack);
  yard.position.set(0, 0, 2.6);
  g.add(yard);
  if (t >= 2) {
    const wing = house({ w: 5, d: 4, h: 2.6, roofH: 2, windows: 1, roof: C.tileWarm });
    wing.position.set(-6.2, 0, 0.5);
    wing.rotation.y = Math.PI / 2;
    g.add(wing);
    const b = banner(color, 4.5);
    b.position.set(4, 0, 2.6);
    g.add(b);
  }
  return { obj: g, h: 7.5, w: 9, d: 8 };
}

function stable(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const barn = house({ w: 9, d: 4.6, h: 2.6, roofH: 2.1, roof: C.thatch, windows: 0, door: false });
  g.add(barn);
  for (const x of [-2.8, 0, 2.8]) g.add(box(1.5, 1.9, 0.12, C.door, x, 0, 2.36));
  const pad = new THREE.Group();
  const f = [fence(8), fence(8), fence(5), fence(5)];
  f[0].position.set(0, 0, 7);
  f[1].position.set(0, 0, 2.6);
  f[2].rotation.y = Math.PI / 2;
  f[2].position.set(4, 0, 4.8);
  f[3].rotation.y = Math.PI / 2;
  f[3].position.set(-4, 0, 4.8);
  pad.add(...f.slice(0, 1), f[2], f[3]);
  const n = t === 1 ? 2 : t === 2 ? 3 : 4;
  for (let i = 0; i < n; i++) {
    const h = horse(i % 2 ? C.horse : C.horseDark);
    h.userData.mount = true;
    h.position.set(-2.6 + i * 1.8, 0, 4.4 + (r() - 0.5) * 1.6);
    h.rotation.y = r() * Math.PI * 2;
    pad.add(h);
  }
  pad.add(hayBale(3.2, 3.6, 0.3));
  g.add(pad);
  return { obj: g, h: 6, w: 10, d: 10 };
}

function workshop(t: number): Built {
  const g = new THREE.Group();
  for (const [x, z] of [[-3.5, -2], [3.5, -2], [-3.5, 2], [3.5, 2]]) g.add(box(0.3, 3.4, 0.3, C.woodDark, x, 0, z));
  const roof = box(8, 0.3, 5.2, C.thatchDark, 0, 3.4, 0);
  roof.rotation.x = 0.12;
  g.add(roof);
  g.add(box(7.4, 3.2, 0.3, C.timberLight, 0, 0, -2.2));
  const c = catapult();
  c.position.set(0.5, 0, 0.2);
  g.add(c);
  if (t >= 2) {
    const rm = ram();
    rm.position.set(-1, 0, 4.2);
    rm.rotation.y = 0.3;
    g.add(rm);
  }
  const logs = logPile(5);
  logs.position.set(5.2, 0, 1);
  logs.rotation.y = Math.PI / 2;
  g.add(logs);
  return { obj: g, h: 6, w: 9, d: 8 };
}

function academy(): Built {
  const g = new THREE.Group();
  const nave = house({ w: 6, d: 10, h: 5, roofH: 3.2, stone: true, roof: C.slate, windows: 0 });
  nave.rotation.y = Math.PI / 2;
  g.add(nave);
  for (const z of [-3, 0, 3]) for (const s of [-1, 1]) g.add(box(0.14, 1.8, 0.7, 0x6e8fb3, z, 2, s * 3.02).rotateY(Math.PI / 2));
  if (getTheme() !== 'classic') {
    // in a hero's village the bell tower takes that hero's form
    const tw = roundTower(1.7, 9.5, { roof: C.slate });
    tw.add(box(1.2, 2.2, 0.2, C.door, 0, 0, 1.6));
    tw.position.set(6.2, 0, 0);
    g.add(tw);
    return { obj: g, h: 18, w: 14, d: 8 };
  }
  const tower = new THREE.Group();
  tower.add(box(3.2, 9, 3.2, C.stone));
  tower.add(box(3.6, 0.35, 3.6, C.stoneDark, 0, 9, 0));
  tower.add(cone(2.6, 6, C.slate, 4, 0, 9.3, 0).rotateY(Math.PI / 4));
  tower.add(cyl(0.08, 0.08, 1.4, C.gold, 5, 0, 15.2));
  tower.add(box(0.8, 0.12, 0.12, C.gold, 0, 16.1, 0));
  tower.add(box(1.4, 2.4, 0.15, C.door, 0, 0, 1.62));
  tower.add(box(0.8, 1.2, 0.15, 0x6e8fb3, 0, 5.5, 1.62));
  tower.position.set(6.2, 0, 0);
  g.add(tower);
  return { obj: g, h: 18, w: 14, d: 8 };
}

function smithy(t: number): Built {
  const g = new THREE.Group();
  g.add(house({ w: 6, d: 5, h: 3, roofH: 2.2, stone: true, roof: C.slate, windows: 1 }));
  const ch = box(1.1, 6.6, 1.1, C.stoneDark, 1.8, 0, -1.2);
  g.add(ch);
  const smoke = new THREE.Object3D();
  smoke.userData.dynamic = true;
  smoke.userData.smoke = true;
  smoke.position.set(1.8, 6.8, -1.2);
  g.add(smoke);
  const forge = box(1.6, 1.0, 1.0, C.stoneDark, -2.2, 0, 3.2);
  g.add(forge);
  const glow = box(1.0, 0.3, 0.6, C.fire, -2.2, 1.0, 3.2);
  glow.material = new THREE.MeshBasicMaterial({ color: C.fire });
  glow.castShadow = false;
  g.add(glow);
  const a = anvil();
  a.position.set(0.3, 0, 3.4);
  g.add(a);
  if (t >= 2) {
    const rack = weaponRack();
    rack.position.set(2.8, 0, 3.4);
    rack.scale.setScalar(0.8);
    g.add(rack);
  }
  g.add(barrel(-3.6, 1.8));
  return { obj: g, h: 8, w: 8, d: 7 };
}

function rally(color: number): Built {
  const g = new THREE.Group();
  const b = banner(color, 6.5);
  b.scale.setScalar(1.25);
  g.add(b);
  const fire = campfire();
  fire.position.set(2.6, 0, 1.6);
  g.add(fire);
  for (const [x, z, ry] of [[1.2, 3.2, 0.3], [4.2, 2.6, -0.8], [3.8, -0.2, 1.2]]) {
    const log = new THREE.CylinderGeometry(0.22, 0.22, 1.8, 6);
    log.rotateZ(Math.PI / 2);
    const m = mesh(log, C.wood);
    m.position.set(x, 0.22, z);
    m.rotation.y = ry;
    g.add(m);
  }
  return { obj: g, h: 9, w: 6, d: 6 };
}

function statue(): Built {
  const g = new THREE.Group();
  g.add(cyl(2.2, 2.4, 0.4, C.stoneDark, 8));
  g.add(box(2.2, 1.6, 2.2, C.stone, 0, 0.4, 0));
  g.add(box(2.5, 0.25, 2.5, C.stoneLight, 0, 2.0, 0));
  const fig = new THREE.Group();
  fig.add(cyl(0.45, 0.6, 1.8, 0x8d6e3b, 6));
  fig.add(blob(0.38, 0x8d6e3b, 0, 2.2, 0));
  fig.add(box(0.12, 3.2, 0.12, 0x6e5530, 0.75, 0.2, 0));
  fig.add(box(0.9, 1.0, 0.12, 0x7a5c32, -0.6, 0.9, 0.3));
  fig.position.y = 2.25;
  g.add(fig);
  return { obj: g, h: 6.5, w: 5, d: 5 };
}

function market(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const colors = [C.red, C.blue, C.gold, C.red];
  const spots: [number, number, number][] = [[-2.8, 0, 0.2], [0.4, -1.8, -0.2], [3.4, 0.6, 0.4], [-0.6, 2.6, -0.1]];
  const n = Math.min(4, t + 1);
  for (let i = 0; i < n; i++) {
    const s = stall(colors[i]);
    s.position.set(spots[i][0], 0, spots[i][1]);
    s.rotation.y = spots[i][2];
    g.add(s);
  }
  g.add(crate(-4.2, 2), crate(-4.4, 3), barrel(4.4, 2.8), barrel(3.8, 3.4));
  g.add(cart(0x9c6b3c).translateX(1.5).translateZ(4.4));
  for (let i = 0; i < 3; i++) g.add(pumpkin(-1.5 + r() * 3, 4.2 + r(), 0.8));
  return { obj: g, h: 5, w: 10, d: 8 };
}

function warehouse(t: number): Built {
  const g = new THREE.Group();
  const main = house({ w: 8, d: 6, h: 3.6, roofH: 3, windows: 0, door: false, stone: t === 3, roof: t === 1 ? C.thatch : C.tile });
  g.add(main);
  g.add(box(2.6, 2.8, 0.15, C.door, 0, 0, 3.05));
  g.add(box(2.8, 0.15, 0.2, C.timber, 0, 2.8, 3.1));
  for (let i = 0; i < 3 + t; i++) g.add(crate(4.6 + (i % 2) * 0.9, 2.6 - Math.floor(i / 2) * 0.9, 0.9));
  g.add(barrel(-4.8, 2.4), barrel(-4.4, 3.2));
  if (t >= 2) {
    const b2 = house({ w: 6, d: 5, h: 3, roofH: 2.4, windows: 0, door: false, roof: C.thatch });
    b2.position.set(-2, 0, -6);
    g.add(b2);
  }
  return { obj: g, h: 8, w: 10, d: 8 };
}

function hiding(t: number, r: () => number): Built {
  const g = new THREE.Group();
  g.add(box(2.4, 0.5, 2.0, C.stoneDark));
  const door = box(1.6, 0.14, 1.3, C.wood, 0, 0.5, 0.1);
  door.rotation.x = -0.15;
  g.add(door);
  g.add(box(0.3, 0.1, 0.3, C.iron, 0, 0.62, 0.4));
  for (let i = 0; i < 3 + t; i++) g.add(blob(0.55, C.leafGreen, -1.8 + r() * 3.6, 0.4, -1.5 + r() * 0.6, 1, 0.7, 1));
  return { obj: g, h: 2.5, w: 3, d: 3 };
}

function watchtower(t: number, color: number): Built {
  const g = new THREE.Group();
  const h = 7 + t * 1.6;
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
    const leg = box(0.3, h, 0.3, C.woodDark, x, 0, z);
    g.add(leg);
  }
  for (let y = 1.5; y < h - 1; y += 2.6) {
    for (const [a, b] of [[0, 1.2], [0, -1.2]]) {
      const br = box(2.6, 0.18, 0.18, C.wood, a, y, b);
      g.add(br);
    }
  }
  g.add(box(3.4, 0.3, 3.4, C.wood, 0, h, 0));
  g.add(box(3.4, 1.0, 0.12, C.wood, 0, h + 0.3, 1.64), box(3.4, 1.0, 0.12, C.wood, 0, h + 0.3, -1.64));
  g.add(box(0.12, 1.0, 3.4, C.wood, 1.64, h + 0.3, 0), box(0.12, 1.0, 3.4, C.wood, -1.64, h + 0.3, 0));
  for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) g.add(box(0.15, 2.2, 0.15, C.woodDark, x, h, z));
  g.add(cone(3.0, 2.2, C.thatch, 4, 0, h + 2.2, 0).rotateY(Math.PI / 4));
  const b = banner(color, 2.4);
  b.position.set(0, h + 4.2, 0);
  g.add(b);
  return { obj: g, h: h + 7, w: 4, d: 4 };
}

// ---------- the workplaces out on the land: they grow with every level, in the village's colours ----------

const GHOST = 0x5cff9a, GHOST_EMIT = 0x1f9a4a;

/** The village's mark on a post by the path: how a workplace shows whose it is. */
function themePost(h: number): THREE.Group {
  switch (getTheme()) {
    case 'paladin': return shieldPost(h);
    case 'sorcerer': return arcaneLamp(h);
    case 'druid': return antlerPole(h);
    case 'goblin': return skullOnPole(h);
    case 'necromancer': return gravePost(h);
    default: {
      const g = new THREE.Group();
      g.add(cyl(0.07, 0.09, h, C.woodDark, 5));
      g.add(box(0.5, 0.06, 0.06, C.woodDark, 0.2, h - 0.2, 0));
      const l = glowBit(new THREE.BoxGeometry(0.24, 0.32, 0.24), 0xffd27a, 0xb0701a);
      l.position.set(0.4, h - 0.6, 0);
      g.add(l);
      return g;
    }
  }
}

/** What burns in a kiln or a furnace, by theme. */
function themeFire(): { c: number; e: number } {
  switch (getTheme()) {
    case 'sorcerer': return { c: VIO, e: VIO_EMIT };
    case 'necromancer': return { c: GHOST, e: GHOST_EMIT };
    case 'paladin': return { c: 0xffd35a, e: 0xb07a10 };
    default: return { c: 0xff8a3a, e: 0xd0501a };
  }
}

/** A plume of smoke rising from here. */
function smokeAt(x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.userData.dynamic = true;
  o.userData.smoke = true;
  o.position.set(x, y, z);
  return o;
}

/** A beehive kiln: a dome of brick (or white stone, or bone), a chimney, and a glowing mouth. */
function kiln(): THREE.Group {
  const g = new THREE.Group();
  const th = getTheme();
  const wall = th === 'paladin' ? 0xe4ddcb : th === 'necromancer' ? 0xd8d0bc : th === 'sorcerer' ? 0x77779c : C.brick;
  g.add(cyl(1.75, 1.8, 0.4, darker(wall, 1.15), 10));
  g.add(mesh(new THREE.SphereGeometry(1.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), wall).translateY(0.35));
  g.add(cyl(0.3, 0.36, 1.6, darker(wall, 1.1), 6, 0.5, 1.4, -0.4));
  const fire = themeFire();
  const mouth = glowBit(new THREE.BoxGeometry(0.8, 0.6, 0.2), fire.c, fire.e);
  mouth.position.set(0, 0.35, 1.52);
  g.add(mouth);
  g.add(smokeAt(0.5, 3.1, -0.4));
  if (th === 'necromancer') { const sk = skull(0.5); sk.position.set(0, 2.05, 0.6); g.add(sk); }
  if (th === 'sorcerer') g.add(runeRing(1.62, 0.9));
  return g;
}

/** A shed of posts under a roof, open on every side. */
function openShed(w: number, d: number, h: number, roof: number): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) g.add(box(0.22, h, 0.22, C.timber, x, 0, z));
  const roofL = box(w + 0.6, 0.18, d / 2 + 0.5, roof, 0, 0, 0);
  roofL.rotation.x = 0.35;
  roofL.position.set(0, h + 0.25, -d / 4 - 0.05);
  const roofR = box(w + 0.6, 0.18, d / 2 + 0.5, roof, 0, 0, 0);
  roofR.rotation.x = -0.35;
  roofR.position.set(0, h + 0.25, d / 4 + 0.05);
  g.add(roofL, roofR);
  return g;
}

/** Sawn planks stacked in a crib. */
function planks(n: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) g.add(box(2.6, 0.14, 0.7, i % 2 ? C.wood : C.logEnd, 0, i * 0.15, (i % 3) * 0.02));
  for (const x of [-1.1, 1.1]) g.add(box(0.12, 0.2, 0.9, C.woodDark, x, -0.05, 0));
  return g;
}

function timberCamp(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const th = getTheme();
  // the wood behind the camp thins as it is felled; the stumps are left
  const n = 13 - t;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.3 - r() * Math.PI * 0.65, d = 7 + r() * 4;
    const tr = tree(r() < 0.35 ? 'pine' : r() < 0.2 ? 'birch' : 'oak', r, 1.05);
    tr.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    g.add(tr);
  }
  for (let i = 0; i < 2 + t; i++) {
    const a = -Math.PI * 0.1 - r() * Math.PI * 0.8, d = 3.5 + r() * 4;
    const st = cyl(0.36, 0.44, 0.45, C.trunk, 7, Math.cos(a) * d, 0, Math.sin(a) * d);
    g.add(st, cyl(0.35, 0.35, 0.02, C.logEnd, 7, Math.cos(a) * d, 0.45, Math.sin(a) * d));
  }
  // logs piled up by the track, more with every level
  const piles = Math.min(5, 1 + Math.floor(t * 0.7));
  for (let i = 0; i < piles; i++) {
    const p = logPile(3 + Math.min(4, t));
    p.position.set(-3.6 + i * 2.2, 0, 3.4 + (i % 2) * 1.3);
    p.rotation.y = 0.15 * i;
    g.add(p);
  }
  const s0 = stump();
  s0.position.set(2.8, 0, 0.6);
  g.add(s0);
  if (t === 1) {
    // a lean-to of poles and bark
    g.add(box(0.14, 1.9, 0.14, C.timber, -5, 0, -0.6), box(0.14, 1.9, 0.14, C.timber, -3, 0, -0.6));
    const lean = box(2.6, 0.12, 2.2, C.thatch, -4, 1.2, 0.2);
    lean.rotation.x = 0.55;
    g.add(lean);
  }
  if (t >= 2) {
    const hut = house({ w: 4.4, d: 3.6, h: 2.3, roofH: 1.8, roof: C.thatch, windows: 1 });
    hut.position.set(-6.3, 0, -1.4);
    hut.rotation.y = 0.5;
    g.add(hut);
  }
  if (t >= 3) {
    // a sawpit: a log on trestles and the long saw
    const pit = new THREE.Group();
    for (const x of [-0.9, 0.9]) { const tr = box(0.14, 1.0, 0.9, C.woodDark, x, 0, 0); pit.add(tr); }
    const lg = cyl(0.3, 0.3, 3.2, C.wood, 7);
    lg.rotation.z = Math.PI / 2;
    lg.position.set(1.6, 1.25, 0);
    pit.add(lg);
    pit.add(box(0.06, 1.6, 0.3, C.iron, 0.3, 0.6, 0.35));
    pit.position.set(2.2, 0, 3.8);
    g.add(pit);
  }
  if (t >= 4) {
    const c = cart();
    for (let i = 0; i < 3; i++) { const lg = cyl(0.18, 0.18, 1.9, C.wood, 6); lg.rotation.z = Math.PI / 2; lg.position.set(0, 1.0 + (i % 2) * 0.3, -0.25 + i * 0.25); c.add(lg); }
    c.position.set(5.0, 0, 2.6);
    c.rotation.y = 0.3;
    g.add(c);
    const pl = planks(4 + t);
    pl.position.set(5.6, 0.1, 0.4);
    g.add(pl);
  }
  if (t >= 5) {
    // a crane of poles for lifting the big trunks, one hanging from it
    const cr = new THREE.Group();
    for (const s2 of [-1, 1]) { const leg = box(0.18, 5.2, 0.18, C.timber, s2 * 1.2, 0, 0); leg.rotation.z = s2 * 0.22; cr.add(leg); }
    cr.add(box(3.4, 0.2, 0.2, C.timber, 0, 5.0, 0));
    cr.add(box(0.04, 1.6, 0.04, 0x8a7a5a, 0, 3.4, 0));
    const hang = cyl(0.32, 0.32, 3.0, C.wood, 7);
    hang.rotation.z = Math.PI / 2;
    hang.position.set(1.5, 3.2, 0);
    cr.add(hang);
    cr.position.set(5.8, 0, -3.8);
    cr.rotation.y = -0.5;
    g.add(cr);
  }
  if (t >= 6) {
    // the sawmill: a great saw turning under a shed, plank cribs beside it
    const mill = openShed(5.2, 3.6, 2.6, C.thatch);
    mill.add(box(3.6, 0.9, 1.0, C.woodDark, 0, 0, 0));
    const saw = new THREE.Group();
    const blade = mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.05, 16).rotateX(Math.PI / 2), 0xb9c2c8);
    saw.add(blade);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; saw.add(box(0.16, 0.12, 0.06, 0x8a959c, Math.cos(a) * 0.86, Math.sin(a) * 0.86 - 0.06, 0)); }
    saw.userData.dynamic = true;
    saw.userData.spin = true;
    saw.position.set(0.4, 1.2, 0);
    mill.add(saw);
    const lg = cyl(0.3, 0.3, 3.4, C.wood, 7);
    lg.rotation.z = Math.PI / 2;
    lg.position.set(-0.6, 1.25, 0);
    mill.add(lg);
    mill.position.set(0.4, 0, -4.4);
    g.add(mill);
    const pl = planks(6);
    pl.position.set(-3.2, 0.1, -4.2);
    pl.rotation.y = Math.PI / 2;
    g.add(pl);
  }
  if (t >= 7) {
    // the woodcutters' lodge
    const lodge = house({ w: 5.6, d: 4.4, h: 3.2, roofH: 2.3, roof: C.thatch, windows: 2, stone: true });
    lodge.position.set(-7.6, 0, 4.2);
    lodge.rotation.y = 1.1;
    g.add(lodge);
  }
  // whose camp it is
  const post = themePost(2.6);
  post.position.set(4.2, 0, 6.2);
  g.add(post);
  if (th === 'paladin' && t >= 3) {
    // the logs kept dry under a striped awning of the Order
    for (let i = 0; i < 4; i++) g.add(box(0.12, 2.2, 0.12, C.stoneLight, -4.2 + (i % 2) * 4.6, 0, 2.6 + Math.floor(i / 2) * 2.4));
    for (let i = 0; i < 6; i++) g.add(box(0.8, 0.1, 2.9, i % 2 ? 0x2c56b0 : 0xf3eee2, -4.2 + 0.4 + i * 0.77, 2.2, 3.8));
  }
  if (th === 'sorcerer' && t >= 2) {
    // a log lifted by a spell, turning slowly over the pile, runes glowing on it
    const lift = new THREE.Group();
    const lg = cyl(0.32, 0.32, 2.6, C.wood, 7);
    lg.rotation.z = Math.PI / 2;
    lift.add(lg);
    lift.add(runeRing(0.33, -0.1).rotateZ(Math.PI / 2));
    lift.userData.dynamic = true;
    lift.userData.orbit = 0.4;
    lift.userData.bob = 0.35;
    lift.position.set(-1.4, 3.4, 3.8);
    g.add(lift);
  }
  if (th === 'druid') {
    // saplings planted in rows where the old trees came down
    for (let i = 0; i < 3 + t; i++) {
      const sp = tree('oak', r, 0.28 + r() * 0.08);
      sp.position.set(-5 + (i % 5) * 1.6, 0, -3.8 - Math.floor(i / 5) * 1.5);
      g.add(sp);
    }
  }
  if (th === 'goblin') {
    // rusty saw blades bitten into the stumps, and a line of sharpened stakes
    for (let i = 0; i < Math.min(4, t); i++) {
      const b = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 9).rotateX(Math.PI / 2), 0x7a4a2a);
      b.position.set(-2 + i * 1.8, 0.7, 6.4);
      b.rotation.y = r();
      g.add(b);
    }
    for (let i = 0; i < 6; i++) { const st = cone(0.12, 1.2, C.timber, 4, -6 + i * 1.3, 0, 7.4); st.rotation.x = -0.4; g.add(st); }
  }
  if (th === 'necromancer') {
    // bones in the woodpile and a ghost-lit lantern
    for (let i = 0; i < 3; i++) { const b = box(0.9, 0.12, 0.12, 0xd8d0bc, -2 + i * 0.9, 0.08, 6.2); b.rotation.y = r() * 3; g.add(b); }
    const sk = skull(0.5);
    sk.position.set(-0.4, 0.3, 6.1);
    g.add(sk);
  }
  return { obj: g, h: 6 + (t >= 5 ? 1.5 : 0), w: 10, d: 10 };
}

function clayPit(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const th = getTheme();
  // the pit is dug wider and deeper each level, in terraces, water gathering in the bottom
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
    const water = cyl(pr * 0.35, pr * 0.35, 0.06, C.water, 10, 0, 0.16);
    water.scale.set(1.25, 1, 1);
    g.add(water);
  }
  if (t >= 2) {
    // a ladder down into it
    const lad = new THREE.Group();
    for (const x of [-0.3, 0.3]) lad.add(box(0.08, 2.2, 0.08, C.woodDark, x, 0, 0));
    for (let y = 0.3; y < 2.1; y += 0.45) lad.add(box(0.6, 0.06, 0.06, C.woodDark, 0, y, 0));
    lad.rotation.x = -1.0;
    lad.position.set(-pr * 0.9, 0.05, 1.2);
    g.add(lad);
  }
  // bricks stacked by the track, more each level
  const stacks = Math.min(8, t + 1);
  for (let i = 0; i < stacks; i++) {
    const st = new THREE.Group();
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) st.add(box(0.5, 0.26, 0.9, i % 2 ? C.brick : darker(C.brick, 1.1), x * 0.55 - 0.55, y * 0.27, 0));
    st.position.set(6.6 + (i % 2) * 1.8, 0, -3.4 + Math.floor(i / 2) * 1.6);
    g.add(st);
  }
  if (t >= 2) {
    // fresh bricks laid out to dry
    const rows = Math.min(4, t - 1);
    for (let rr = 0; rr < rows; rr++) for (let i = 0; i < 7; i++) g.add(box(0.42, 0.18, 0.24, C.clay, -2.2 + i * 0.6, 0, 5.2 + rr * 0.55));
  }
  for (let i = 0; i < 3; i++) g.add(rock(r, 0.7, C.clayDark).translateX(-6 + r() * 1.5).translateZ(-4 + i * 1.6));
  if (t >= 2) {
    const c = cart();
    c.position.set(3.4, 0, 5.2);
    c.rotation.y = 0.6;
    g.add(c);
  }
  if (t >= 3) {
    const hut = house({ w: 4.2, d: 3.4, h: 2.2, roofH: 1.7, roof: C.tileWarm, windows: 1 });
    hut.position.set(-7, 0, 3.2);
    hut.rotation.y = 0.8;
    g.add(hut);
  }
  if (t >= 4) { const k = kiln(); k.position.set(4.6, 0, -5.8); g.add(k); }
  if (t >= 5) {
    // the brickworks: a long open shed with the moulding tables
    const shed = openShed(5.6, 3.2, 2.4, C.tileWarm);
    shed.add(box(4.2, 0.9, 1.0, C.woodDark, 0, 0, 0));
    for (let i = 0; i < 6; i++) shed.add(box(0.4, 0.16, 0.24, C.clay, -1.6 + i * 0.64, 0.9, 0));
    shed.position.set(-3.2, 0, -6.4);
    g.add(shed);
  }
  if (t >= 6) { const k = kiln(); k.position.set(8.4, 0, 2.6); k.rotation.y = -1.2; g.add(k); }
  if (t >= 7) {
    // a tall brick chimney, smoking
    g.add(cyl(0.55, 0.8, 7.5, C.brick, 8, 1.2, 0, -8.4));
    g.add(cyl(0.65, 0.65, 0.3, darker(C.brick, 1.2), 8, 1.2, 7.4, -8.4));
    g.add(smokeAt(1.2, 7.9, -8.4));
  }
  const post = themePost(2.6);
  post.position.set(1.4, 0, 6.8);
  g.add(post);
  if (th === 'sorcerer') {
    // the clay is shaped by spells: glowing runes stamped in the drying bricks
    for (let i = 0; i < 3; i++) { const rn = glowBit(new THREE.BoxGeometry(0.3, 0.04, 0.3)); rn.position.set(-1.6 + i * 1.6, 0.2, 5.3); rn.rotation.y = Math.PI / 4; g.add(rn); }
  }
  if (th === 'druid') g.add(mushrooms(5, r, 2).translateX(-5).translateZ(-2));
  if (th === 'goblin') { g.add(barrel(-4.4, 5.8), barrel(-3.8, 6.6)); for (let i = 0; i < 3; i++) g.add(blob(0.7, C.clayDark, -1 + i * 1.3, 0.1, -pr - 1.4, 1, 0.3, 1)); }
  if (th === 'paladin') { const b = banner(0x2c56b0, 3.2); b.position.set(-2.6, 0, 7); g.add(b); }
  if (th === 'necromancer') for (let i = 0; i < 3; i++) { const sk = skull(0.42); sk.position.set(6.6 + i * 0.5, 0.82, -3.4 + (i % 2) * 0.4); g.add(sk); }
  return { obj: g, h: 4 + (t >= 7 ? 5 : t >= 4 ? 2 : 0), w: 12, d: 10 };
}

function ironMine(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const th = getTheme();
  // the hill the mine is dug into grows craggier as the workings spread
  const grow = 0.75 + t * 0.06;
  const hill = [
    [0, -3, 5.5, 4.2], [-5, -1.5, 4, 3], [5, -2, 4.5, 3.4], [-2, -6, 5, 5.5], [3.5, -6.5, 4.5, 4.6], [-6.5, -5.5, 3.6, 3.8], [7, -5.8, 3.4, 3.2],
  ].slice(0, 4 + Math.min(3, Math.floor(t / 2)));
  const rockC = th === 'druid' ? 0x6c775f : undefined;
  hill.forEach(([x, z, sc, h], i) => {
    // the hill grows up and back, never over the mouth of the mine
    const k = i === 0 ? 1 : grow;
    const m = blob(sc * k, rockC ?? (r() < 0.5 ? C.rock : C.rockDark), x, h * k * 0.35, z - (k - 1) * 5, 1.1, h / sc, 1.0);
    m.rotation.y = r() * 3;
    g.add(m);
  });
  // the adit, timbered, with rails running out of it and a cart of ore
  const ent = new THREE.Group();
  ent.add(box(2.6, 2.8, 0.6, C.dark));
  ent.add(box(0.35, 3.0, 0.35, C.timber, -1.4, 0, 0.3), box(0.35, 3.0, 0.35, C.timber, 1.4, 0, 0.3));
  ent.add(box(3.4, 0.4, 0.4, C.timber, 0, 3.0, 0.3));
  ent.position.set(0, 0, 1.5);
  g.add(ent);
  const railLen = 3 + Math.min(4, t) * 0.8;
  for (const x of [-0.5, 0.5]) g.add(box(0.1, 0.08, railLen, C.iron, x, 0.05, 1.8 + railLen / 2));
  const oreCart = (x: number, z: number) => {
    const c = new THREE.Group();
    c.add(box(1.2, 0.7, 1.4, C.woodDark, 0, 0.25, 0));
    c.add(blob(0.5, C.iron, 0, 1.0, 0, 1.2, 0.6, 1.2));
    c.position.set(x, 0, z);
    g.add(c);
  };
  oreCart(0, 1.8 + railLen - 0.8);
  // heaps of ore, more each level
  for (let i = 0; i < Math.min(5, t); i++) g.add(blob(0.8 + r() * 0.3, C.iron, -4.6 + i * 1.5, 0.2, 4.2 + (i % 2) * 0.9, 1.2, 0.55, 1.1));
  if (t >= 2) {
    const lamp = new THREE.Group();
    lamp.add(box(0.1, 2, 0.1, C.woodDark));
    const fire = themeFire();
    lamp.add(glowBit(new THREE.BoxGeometry(0.3, 0.4, 0.3), fire.c, fire.e).translateY(2));
    lamp.position.set(-2, 0, 2.4);
    g.add(lamp);
  }
  if (t >= 3) {
    const hut = house({ w: 4, d: 3.2, h: 2.2, roofH: 1.6, roof: C.slate, windows: 1 });
    hut.position.set(5, 0, 3.8);
    hut.rotation.y = -0.5;
    g.add(hut);
  }
  if (t >= 4) {
    // a headframe over a shaft, its wheel turning
    const hf = new THREE.Group();
    for (const s2 of [-1, 1]) for (const z of [-0.8, 0.8]) { const leg = box(0.2, 5.4, 0.2, C.timber, s2 * 1.0, 0, z); leg.rotation.z = s2 * 0.12; hf.add(leg); }
    hf.add(box(2.6, 0.25, 2.0, C.timber, 0, 5.2, 0));
    const wheel = new THREE.Group();
    wheel.add(mesh(new THREE.TorusGeometry(0.9, 0.08, 5, 14), C.iron));
    for (let i = 0; i < 4; i++) { const sp = box(0.06, 1.8, 0.06, C.iron, 0, -0.9, 0); sp.rotation.z = (i / 4) * Math.PI; wheel.add(sp); }
    wheel.userData.dynamic = true;
    wheel.userData.spin = true;
    wheel.position.set(0, 5.9, 0);
    hf.add(wheel);
    hf.add(cyl(1.0, 1.0, 0.3, C.dark, 8, 0, 0, 0));
    hf.position.set(-5.8, 0, 1.6);
    g.add(hf);
  }
  if (t >= 5) {
    // a bloomery furnace: a squat stone stack glowing at the foot, smoke rising
    const fu = new THREE.Group();
    fu.add(cyl(1.1, 1.5, 3.4, C.stoneDark, 8));
    fu.add(cyl(0.7, 0.9, 1.2, C.stoneDark, 8, 0, 3.4));
    const fire = themeFire();
    fu.add(glowBit(new THREE.BoxGeometry(0.7, 0.6, 0.2), fire.c, fire.e).translateY(0.5).translateZ(1.38));
    fu.add(smokeAt(0, 4.8, 0));
    fu.position.set(7.2, 0, -0.6);
    g.add(fu);
    g.add(blob(1.1, 0x3a3432, 8.8, 0.2, 2.6, 1.2, 0.45, 1.1)); // slag
  }
  if (t >= 6) {
    // a second adit, and more carts on the rails
    const e2 = ent.clone();
    e2.position.set(-3.2, 0, -1.4);
    e2.rotation.y = 0.4;
    e2.scale.setScalar(0.8);
    g.add(e2);
    oreCart(0, 2.6);
  }
  if (t >= 7) {
    const lodge = house({ w: 5, d: 3.8, h: 2.8, roofH: 1.9, roof: C.slate, windows: 2, stone: true });
    lodge.position.set(-7.5, 0, 7.2);
    lodge.rotation.y = 0.4;
    g.add(lodge);
  }
  for (let i = 0; i < 5; i++) g.add(rock(r, 0.8).translateX(-6 + r() * 12).translateZ(2 + r() * 4));
  const post = themePost(2.6);
  post.position.set(2.4, 0, 6.6);
  g.add(post);
  // whose mine it is
  if (th === 'sorcerer') {
    // veins of crystal break out of the rock
    for (let i = 0; i < 3 + t; i++) {
      const a = -Math.PI * 0.1 - r() * Math.PI * 0.8, d = 3 + r() * 4;
      const c = mesh(new THREE.OctahedronGeometry(0.3, 0), i % 2 ? VIO : ARC, { emissive: i % 2 ? VIO_EMIT : ARC_EMIT });
      c.scale.set(1, 2.2, 1);
      c.position.set(Math.cos(a) * d, 1.2 + r() * 2.2, Math.sin(a) * d - 2);
      c.rotation.z = (r() - 0.5) * 1.2;
      g.add(c);
    }
  }
  if (th === 'paladin') {
    // a golden sun over the adit
    const sun = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 12).rotateX(Math.PI / 2), 0xffd35a, { emissive: 0x8a5a10 });
    sun.position.set(0, 3.6, 1.95);
    g.add(sun);
  }
  if (th === 'druid') {
    // roots and moss overgrow the workings
    for (let i = 0; i < 6; i++) g.add(blob(0.8, i % 2 ? 0x5e7d32 : 0x6f9a3a, -5 + i * 2, 2.4 + r() * 1.2, -3 - r() * 3, 1.3, 0.4, 1.1));
    for (const s2 of [-1, 1]) { const root = cyl(0.12, 0.2, 3.2, 0x5a3f28, 5, s2 * 1.6, 0, 1.2); root.rotation.z = s2 * 0.2; g.add(root); }
  }
  if (th === 'goblin') { const sk = skull(0.8); sk.position.set(0, 3.3, 1.95); g.add(sk); g.add(box(1.2, 0.6, 0.05, 0x6f9a2a, 1.6, 2.4, 1.9)); }
  if (th === 'necromancer') {
    // the adit is the mouth of a great skull, green light within
    const sk = skull(2.2);
    sk.position.set(0, 3.6, 1.2);
    g.add(sk);
    g.add(glowBit(new THREE.BoxGeometry(2.2, 2.2, 0.1), GHOST, GHOST_EMIT).translateY(1.2).translateZ(1.78));
  }
  return { obj: g, h: 8 + (t >= 4 ? 1 : 0), w: 12, d: 12 };
}

/** A big barn: a gambrel roof over plank walls, the doors open. */
function barn(w: number, d: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const th = getTheme();
  const wall = th === 'paladin' ? 0xf3eee2 : th === 'necromancer' ? 0x4a4450 : th === 'sorcerer' ? 0x5a4a7a : 0x9a3a28;
  const roof = C.tile;
  g.add(extrude([[-w / 2, 0], [w / 2, 0], [w / 2, h], [w * 0.3, h + h * 0.45], [0, h + h * 0.62], [-w * 0.3, h + h * 0.45], [-w / 2, h]], d, wall));
  // the roof planes over the gambrel
  const hh = h * 0.45, hh2 = h * 0.17;
  for (const s2 of [-1, 1]) {
    const lo = box(Math.hypot(w * 0.2, hh) + 0.2, 0.16, d + 0.5, roof, 0, 0, 0);
    lo.rotation.z = -s2 * Math.atan2(hh, w * 0.2);
    lo.position.set(s2 * w * 0.4, h + hh / 2, 0);
    const hi = box(Math.hypot(w * 0.3, hh2) + 0.2, 0.16, d + 0.5, roof, 0, 0, 0);
    hi.rotation.z = -s2 * Math.atan2(hh2, w * 0.3);
    hi.position.set(s2 * w * 0.15, h + hh + hh2 / 2, 0);
    g.add(lo, hi);
  }
  g.add(box(w * 0.4, h * 0.75, 0.12, C.dark, 0, 0, d / 2 + 0.02));
  for (const s2 of [-1, 1]) {
    const door = box(w * 0.2, h * 0.75, 0.1, darker(wall, 1.2), 0, 0, 0);
    door.position.set(s2 * w * 0.3, 0, d / 2 + 0.4);
    door.rotation.y = s2 * 0.9;
    g.add(door);
  }
  g.add(box(w * 0.42, 0.1, 0.1, C.white, 0, h * 0.75, d / 2 + 0.08));
  g.add(glowWindow(0, h + h * 0.3, d / 2 + 0.05));
  return g;
}

/** A round granary of stone under a cone. */
function granary(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(1.4, 1.5, 4.2, C.stone, 10));
  g.add(cone(1.8, 2.0, C.tile, 10, 0, 4.2));
  g.add(box(0.8, 1.4, 0.1, C.door, 0, 0, 1.45));
  return g;
}

function farm(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const th = getTheme();
  // the farmhouse grows from a cottage to a stone farmstead
  const fh = t >= 7
    ? house({ w: 7, d: 5, h: 3.4, roofH: 2.6, roof: C.thatch, windows: 3, stone: true })
    : house({ w: 4.6 + Math.min(3, t) * 0.4, d: 4.0, h: 2.5, roofH: 2.1, roof: C.thatch, windows: 1 });
  g.add(fh);
  // fields, more and wider every level
  // (laid out round the yard, clear of the barn, and all on the level ground)
  const spots: [number, number][] = [[-8, -6], [0, -8.5], [8, -6], [-9.5, 3], [-4.5, -15.5], [4.5, -15.5], [13.5, -12], [15.5, -3.5], [-13.5, -12]];
  const fields = Math.min(spots.length, t + 1);
  const crop = (i: number): THREE.Group => {
    // the fields are sown in the village's own way
    if (th === 'sorcerer' && i % 3 === 1) return glowField(6.5, 5, r, VIO, VIO_EMIT);
    if (th === 'necromancer' && i % 3 === 1) return pumpkinPatch(6.5, 5, r, true);
    if (th === 'goblin' && i % 3 === 1) return shroomField(6.5, 5, r);
    if (th === 'druid' && i % 3 === 1) return flowerField(6.5, 5, r);
    if (th === 'paladin' && i % 3 === 1) return sunflowerField(6.5, 5, r);
    if (i % 4 === 3) return pumpkinPatch(6.5, 5, r, false);
    return wheatField(6.5, 5, r, i % 3 !== 2);
  };
  for (let i = 0; i < fields; i++) {
    const f = crop(i);
    f.position.set(spots[i][0], 0, spots[i][1]);
    f.rotation.y = (r() - 0.5) * 0.3;
    g.add(f);
  }
  for (let i = 0; i < Math.min(6, 1 + t); i++) g.add(hayBale(0.5 + r() * 2.5, 5.6 + r() * 1.2, r() * 3));
  for (let i = 0; i < 3; i++) g.add(pumpkin(-3.2 - r(), 5.4 + r(), 0.9 + r() * 0.3));
  if (t >= 2) {
    // a well in the yard
    g.add(cyl(0.8, 0.85, 0.8, C.stone, 8, -3.2, 0, 3.8));
    for (const x of [-3.8, -2.6]) g.add(box(0.12, 1.8, 0.12, C.timber, x, 0.8, 3.8));
    g.add(box(1.5, 0.12, 0.12, C.timber, -3.2, 2.5, 3.8), cone(1.0, 0.7, C.thatch, 4, -3.2, 2.5, 3.8).rotateY(Math.PI / 4));
  }
  if (t >= 3) {
    const wm = windmill();
    wm.group.position.set(-14, 0, -3.5);
    wm.group.rotation.y = 0.6;
    g.add(wm.group);
  }
  if (t >= 4) {
    const b = barn(6, 7.5, 3.4);
    b.position.set(10, 0, 2.5);
    b.rotation.y = -Math.PI / 2;
    g.add(b);
  }
  if (t >= 5) {
    // a paddock of cattle
    const pad = new THREE.Group();
    for (const [x, z, rot, len] of [[0, 2.4, 0, 6.6], [0, -2.4, 0, 6.6], [3.3, 0, Math.PI / 2, 4.8], [-3.3, 0, Math.PI / 2, 4.8]] as [number, number, number, number][]) {
      const fe = fence(len);
      fe.position.set(x, 0, z);
      fe.rotation.y = rot;
      pad.add(fe);
    }
    for (let i = 0; i < 4; i++) pad.add(cow(i % 2 ? 0xf2efe6 : 0x6b4a32).translateX(-2 + i * 1.3).translateZ((i % 2 ? 1 : -1) * 0.8).rotateY(r() * 6));
    pad.position.set(-7.5, 0, 7.5);
    g.add(pad);
  }
  if (t >= 6) { const gr = granary(); gr.scale.setScalar(0.8); gr.position.set(-5, 0, -1.4); g.add(gr); }
  if (t >= 8) {
    // a second barn, the old farmhouse's byre
    const b2 = barn(4.6, 5.2, 2.8);
    b2.position.set(4.6, 0, -2.2);
    b2.rotation.y = Math.PI;
    g.add(b2);
  }
  const f2 = fence(10);
  f2.position.set(0, 0, 4.4);
  g.add(f2);
  const post = themePost(2.6);
  post.position.set(5.6, 0, 5.4);
  g.add(post);
  if (th === 'necromancer') {
    // a skeleton keeps the crows off
    const sc = new THREE.Group();
    sc.add(box(0.1, 2.6, 0.1, C.timber), box(1.6, 0.1, 0.1, C.timber, 0, 1.9, 0));
    const sk = skull(0.45);
    sk.position.set(0, 2.55, 0);
    sc.add(sk);
    for (let i = 0; i < 4; i++) sc.add(box(0.6, 0.06, 0.06, 0xd8d0bc, 0, 1.3 + i * 0.16, 0.05));
    sc.position.set(0, 0, -12);
    g.add(sc);
  }
  if (th === 'druid') for (let i = 0; i < 3; i++) g.add(beehive().translateX(11 + i * 1.1).translateZ(7.5));
  if (th === 'goblin') g.add(blob(1.6, 0x55462f, 11, 0.02, 8.5, 1.4, 0.08, 1), pig().translateX(10.4).translateZ(8.2), pig().translateX(11.8).translateZ(9.1).rotateY(2));
  return { obj: g, h: 6 + (t >= 4 ? 2 : 0), w: 8, d: 8 };
}

/** A cow (or an ox), standing about. */
function cow(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.6, 0.55, 1.2, color, 0, 0.55, 0));
  g.add(box(0.36, 0.36, 0.42, color, 0, 0.85, 0.7));
  for (const [x, z] of [[-0.2, 0.45], [0.2, 0.45], [-0.2, -0.45], [0.2, -0.45]]) g.add(box(0.12, 0.55, 0.12, darker(color, 1.3), x, 0, z));
  g.add(box(0.5, 0.06, 0.06, 0xe8dcc0, 0, 1.05, 0.72));
  return g;
}

function pig(): THREE.Group {
  const g = new THREE.Group();
  g.add(blob(0.4, 0xe8a0a0, 0, 0.4, 0, 1, 0.8, 1.4));
  g.add(blob(0.22, 0xe8a0a0, 0, 0.45, 0.55));
  for (const [x, z] of [[-0.18, 0.3], [0.18, 0.3], [-0.18, -0.3], [0.18, -0.3]]) g.add(box(0.1, 0.25, 0.1, 0xd08a8a, x, 0, z));
  return g;
}

function beehive(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.5, 0.5, 0.5, C.timber));
  for (let i = 0; i < 3; i++) g.add(cyl(0.34 - i * 0.07, 0.36 - i * 0.07, 0.2, 0xd9a441, 8, 0, 0.5 + i * 0.2, 0));
  return g;
}

/** Rows of crops whose tips glow at dusk (sorcerers' moon-wheat). */
function glowField(w: number, d: number, r: () => number, c: number, e: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.08, d, C.dirtDark));
  for (let i = 0; i < 7; i++) for (let k = 0; k < 5; k++) {
    const x = -w / 2 + 0.5 + i * ((w - 1) / 6), z = -d / 2 + 0.5 + k * ((d - 1) / 4);
    g.add(box(0.12, 0.7, 0.12, 0x5f7568, x, 0.08, z));
    const tip = mesh(new THREE.OctahedronGeometry(0.12, 0), c, { emissive: e });
    tip.position.set(x, 0.85 + r() * 0.1, z);
    g.add(tip);
  }
  return g;
}

function pumpkinPatch(w: number, d: number, r: () => number, ghostly: boolean): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.08, d, C.dirtDark));
  for (let i = 0; i < 9; i++) {
    const p = pumpkin((r() - 0.5) * (w - 1), (r() - 0.5) * (d - 1), 0.9 + r() * 0.5);
    g.add(p);
    if (ghostly && i % 2 === 0) g.add(glowBit(new THREE.BoxGeometry(0.2, 0.1, 0.05), GHOST, GHOST_EMIT).translateX(p.position.x).translateY(0.35).translateZ(p.position.z + 0.3));
  }
  for (let i = 0; i < 6; i++) g.add(box(w * 0.9, 0.06, 0.1, 0x3f6a2a, 0, 0.08, -d / 2 + 0.6 + i * ((d - 1.2) / 5)));
  return g;
}

function shroomField(w: number, d: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.08, d, 0x55462f));
  for (let i = 0; i < 16; i++) {
    const x = (r() - 0.5) * (w - 0.8), z = (r() - 0.5) * (d - 0.8), s2 = 0.6 + r() * 0.7;
    g.add(cyl(0.07 * s2, 0.09 * s2, 0.4 * s2, 0xefe6d0, 5, x, 0.08, z));
    g.add(blob(0.24 * s2, i % 3 === 0 ? 0x9ac040 : 0xc0392b, x, 0.08 + 0.42 * s2, z, 1, 0.5, 1));
  }
  return g;
}

function flowerField(w: number, d: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.08, d, 0x5a8a36));
  const cols = [0xf2e46a, 0xf4f1e6, 0xb58cd8, 0xe88aa6, 0xe8a040];
  for (let i = 0; i < 40; i++) g.add(blob(0.14, cols[i % cols.length], (r() - 0.5) * (w - 0.4), 0.2, (r() - 0.5) * (d - 0.4)));
  return g;
}

function sunflowerField(w: number, d: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.08, d, C.dirtDark));
  for (let i = 0; i < 6; i++) for (let k = 0; k < 4; k++) {
    const x = -w / 2 + 0.6 + i * ((w - 1.2) / 5), z = -d / 2 + 0.6 + k * ((d - 1.2) / 3);
    const h = 1.2 + r() * 0.4;
    g.add(box(0.08, h, 0.08, 0x4f7a2e, x, 0.08, z));
    const head = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 10).rotateX(1.2), 0xf2c21a);
    head.position.set(x, h + 0.1, z + 0.06);
    g.add(head);
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 8).rotateX(1.2), 0x5a3a1a).translateX(x).translateY(h + 0.12).translateZ(z + 0.09));
  }
  return g;
}

// ---------- hero headquarters ----------

const MOSS = 0x5e7d32, MOSS_DK = 0x445c24, BARK = 0x5a3f28, BARK_DK = 0x3f2c1c, LEAF = 0x4f7a2e, LEAF_LT = 0x6f9a3a, MENHIR = 0x8e9a80;

/** A round window that glows at night. */
// ---------- the Radiant Order: the paladin's headquarters grows from a chapel into a cathedral ----------

const ROYAL = 0x2c56b0, SUNGOLD = 0xffd35a, SUN_EMIT = 0x8a5a10;

/** A golden bell hanging in a belfry. */
function bell(s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cone(0.42 * s, 0.7 * s, C.gold, 10, 0, -0.7 * s));
  g.add(cyl(0.46 * s, 0.46 * s, 0.1 * s, C.gold, 10, 0, -0.75 * s));
  g.add(blob(0.1 * s, C.gold, 0, -0.85 * s, 0));
  return g;
}

/** A square tower with an open belfry, a steep four-sided blue spire and gilded finial. */
function steeple(w: number, h: number, spire: number, withBell = true): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, h, w, C.stoneLight));
  g.add(box(w + 0.3, 0.35, w + 0.3, C.stone, 0, h * 0.62, 0));
  // belfry: four corner piers and a gold rail, the bell in the middle
  const bh = Math.max(1.8, w * 0.9);
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(box(w * 0.22, bh, w * 0.22, C.stoneLight, x * w * 0.39, h, z * w * 0.39));
  g.add(box(w + 0.2, 0.3, w + 0.2, C.stone, 0, h + bh, 0));
  g.add(box(w + 0.24, 0.1, w + 0.24, C.gold, 0, h + bh + 0.3, 0));
  if (withBell) { const b = bell(w * 0.34); b.position.set(0, h + bh - 0.1, 0); g.add(b); }
  // lancets on the tower faces
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const l = lancet(0, 0, 0, w * 0.22, w * 0.45, i);
    l.position.set(Math.sin(a) * (w / 2 + 0.02), h * 0.35, Math.cos(a) * (w / 2 + 0.02));
    l.rotation.y = a;
    g.add(l);
  }
  const sp = cone(w * 0.78, spire, C.tile, 4, 0, h + bh + 0.35);
  sp.rotation.y = Math.PI / 4;
  g.add(sp);
  g.add(cyl(0.08, 0.08, 1.4, C.gold, 5, 0, h + bh + 0.3 + spire - 0.3));
  g.add(blob(0.2, C.gold, 0, h + bh + spire + 0.7, 0));
  return g;
}

/** The great rose window: a wheel of stained glass in a gilded frame, facing +Z. */
function roseWindow(r: number): THREE.Group {
  const g = new THREE.Group();
  const disc = (rad: number, c: number, e: number, z: number) => {
    const m = mesh(new THREE.CylinderGeometry(rad, rad, 0.1, 16).rotateX(Math.PI / 2), c, { emissive: e });
    m.position.z = z;
    g.add(m);
  };
  disc(r + 0.18, C.stoneLight, 0x000000, -0.04);
  disc(r, GLASS[0].c, GLASS[0].e, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const petal = mesh(new THREE.CylinderGeometry(r * 0.24, r * 0.24, 0.12, 8).rotateX(Math.PI / 2), GLASS[1 + (i % 3)].c, { emissive: GLASS[1 + (i % 3)].e });
    petal.position.set(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, 0.02);
    g.add(petal);
    const spoke = box(0.07, r, 0.08, C.gold, 0, 0, 0.07);
    spoke.geometry.translate(0, 0, 0);
    spoke.rotation.z = a;
    g.add(spoke);
  }
  disc(r * 0.26, SUNGOLD, SUN_EMIT, 0.05);
  const ring = mesh(new THREE.TorusGeometry(r, 0.09, 5, 24), C.gold);
  ring.position.z = 0.06;
  g.add(ring);
  return g;
}

/** A golden sun with rays, turning slowly (for the top of the great spire). */
function sunDisc(r: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.14, 16).rotateX(Math.PI / 2), SUNGOLD, { emissive: SUN_EMIT }));
  g.add(mesh(new THREE.TorusGeometry(r * 0.6, r * 0.06, 5, 20), C.gold));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const ray = mesh(new THREE.ConeGeometry(r * 0.11, r * (i % 2 ? 0.45 : 0.7), 4), SUNGOLD, { emissive: SUN_EMIT });
    ray.position.set(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85, 0);
    ray.rotation.z = a - Math.PI / 2;
    g.add(ray);
  }
  g.userData.dynamic = true;
  g.userData.spin = true;
  return g;
}

/** A little flight of white doves wheeling round a spire, their wings beating. */
function doves(n: number, r: number, y: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const rand = rng(seed);
  for (let i = 0; i < n; i++) {
    const d = new THREE.Group();
    d.add(blob(0.2, 0xfbfaf6, 0, 0, 0, 0.8, 0.75, 1.5));
    d.add(blob(0.12, 0xfbfaf6, 0, 0.1, 0.3));
    d.add(cone(0.035, 0.1, 0xe0a040, 4, 0, 0.08, 0.44).rotateX(Math.PI / 2));
    d.add(box(0.2, 0.04, 0.26, 0xf0eee8, 0, 0, -0.32));
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.add(box(0.5, 0.03, 0.26, 0xfbfaf6, side * 0.25, 0, 0));
      wing.position.set(side * 0.1, 0.04, 0);
      wing.userData.flap = side;
      d.add(wing);
    }
    const a = (i / n) * Math.PI * 2 + rand() * 0.5;
    const rr = r * (0.8 + rand() * 0.4);
    d.position.set(Math.cos(a) * rr, y + (rand() - 0.5) * 1.6, Math.sin(a) * rr);
    // flying round the circle (anticlockwise seen from above), banked into the turn
    d.rotation.set(0, -a, 0.35);
    g.add(d);
  }
  g.userData.dynamic = true;
  g.userData.orbit = -0.45; // (the way they face)
  return g;
}

/** A gilded knight: sword raised, the Order's shield on his arm. */
function knightStatue(s = 1): THREE.Group {
  const g = new THREE.Group();
  const gilt = 0xd9a441;
  g.add(box(0.5, 0.55, 0.3, gilt, 0, 0, 0));
  g.add(cyl(0.3, 0.36, 0.8, gilt, 7, 0, 0.5));
  g.add(cyl(0.22, 0.24, 0.36, gilt, 7, 0, 1.3));
  g.add(cone(0.1, 0.35, ROYAL, 5, 0, 1.64));
  const arm = box(0.14, 0.7, 0.14, gilt, 0.38, 1.05, 0);
  arm.rotation.z = -0.35;
  g.add(arm);
  const blade = mesh(new THREE.BoxGeometry(0.08, 1.5, 0.03).translate(0, 0.75, 0), 0xfff4d0, { emissive: 0xc09030 });
  blade.position.set(0.55, 1.7, 0);
  g.add(blade);
  g.add(box(0.36, 0.07, 0.07, gilt, 0.55, 1.66, 0));
  const sh = heraldry(0.5);
  sh.position.set(-0.36, 0.95, 0.12);
  sh.rotation.y = -0.4;
  g.add(sh);
  g.scale.setScalar(s);
  return g;
}

function paladinHall(t: number): Built {
  const g = new THREE.Group();
  if (t === 1) {
    // a white chapel with a little belfry
    g.add(house({ w: 5.6, d: 7.4, h: 2.9, roofH: 2.1, windows: 2 }));
    const b = steeple(1.7, 4.2, 2.4);
    b.position.set(-3.6, 0, 2.2);
    g.add(b);
    const bn = banner(ROYAL, 4.4);
    bn.position.set(3.6, 0, 3.2);
    g.add(bn);
    return { obj: g, h: 9.5, w: 9, d: 9 };
  }
  if (t === 2) {
    // a church: a longer nave and a steeple over the door
    g.add(house({ w: 7, d: 9.6, h: 3.6, roofH: 2.6, windows: 3, stone: true }));
    const st = steeple(2.5, 6.4, 4.8);
    st.position.set(0, 0, 5.3);
    g.add(st);
    const side = house({ w: 3.8, d: 4.2, h: 2.8, roofH: 1.8, windows: 1, door: false });
    side.position.set(5.2, 0, -1.2);
    side.rotation.y = Math.PI / 2;
    g.add(side);
    return { obj: g, h: 17, w: 13, d: 13 };
  }
  const grand = t >= 4;
  const k = t === 5 ? 1.06 : 1;
  const c = new THREE.Group();
  // the nave
  const W = 8, D = 11.5, H = 5, RH = 3.2;
  c.add(house({ w: W, d: D, h: H, roofH: RH, windows: 0, stone: true, door: false }));
  // tall windows down both sides, between flying buttresses
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const z = -D / 2 + 2 + i * 3.4;
      const l = lancet(0, 0, 0, 0.6, 2.2, i + (side > 0 ? 1 : 0));
      l.position.set(side * (W / 2 + 0.03), 1.4, z + 1.7);
      l.rotation.y = side * Math.PI / 2;
      c.add(l);
      // a pier and the arch leaning in to the wall
      c.add(box(0.7, 3.8, 0.7, C.stone, side * (W / 2 + 1.6), 0, z));
      c.add(cone(0.36, 0.9, C.tile, 4, side * (W / 2 + 1.6), 3.8, z).rotateY(Math.PI / 4));
      const strut = box(0.4, 2.2, 0.4, C.stone, 0, 0, 0);
      strut.position.set(side * (W / 2 + 0.8), 3.1, z);
      strut.rotation.z = side * 0.95;
      c.add(strut);
    }
  }
  // the west front: twin towers, a great door and the rose window
  for (const x of [-1, 1]) {
    const tw = steeple(2.6, 8.4, 6.2, x < 0);
    tw.position.set(x * 4.4, 0, D / 2 - 0.9);
    c.add(tw);
  }
  c.add(box(W, H + RH * 1.35 * 0.55, 0.5, C.stoneLight, 0, 0, D / 2 + 0.05));
  const rose = roseWindow(1.35);
  rose.position.set(0, H + 0.9, D / 2 + 0.34);
  c.add(rose);
  // the great door: an arch of gold-banded oak under a carved lintel
  c.add(box(2.6, 3.6, 0.3, C.stone, 0, 0, D / 2 + 0.28));
  c.add(box(2.0, 3.0, 0.3, C.door, 0, 0, D / 2 + 0.36));
  for (const y of [0.9, 2.1]) c.add(box(1.9, 0.09, 0.08, C.gold, 0, y, D / 2 + 0.53));
  const arms = heraldry(0.9);
  arms.position.set(0, 3.7, D / 2 + 0.46);
  c.add(arms);
  c.add(box(3.4, 0.35, 1.0, C.stoneDark, 0, 0, D / 2 + 0.8));
  // the apse behind, round under a blue cone
  c.add(cyl(2.3, 2.4, H - 0.4, C.stoneLight, 12, 0, 0, -D / 2));
  c.add(cone(2.7, 2.6, C.tile, 12, 0, H - 0.4, -D / 2));
  for (let i = 0; i < 3; i++) {
    const a = Math.PI + (i - 1) * 0.7;
    const l = lancet(0, 0, 0, 0.45, 1.8, i);
    l.position.set(Math.sin(a) * 2.42, 1.3, -D / 2 + Math.cos(a) * 2.42);
    l.rotation.y = a;
    c.add(l);
  }
  if (!grand) {
    // a slender gilded flèche over the crossing
    c.add(cyl(0.5, 0.6, 1.4, C.stoneLight, 8, 0, H + RH * 1.35 - 0.4, 0));
    c.add(cone(0.65, 4.2, C.tile, 8, 0, H + RH * 1.35 + 1.0, 0));
    c.add(blob(0.2, C.gold, 0, H + RH * 1.35 + 5.4, 0));
    c.add(doves(5, 4.2, H + RH * 1.35 + 3.4, 31));
    c.scale.setScalar(k);
    g.add(c);
    return { obj: g, h: 19, w: 14, d: 15 };
  }
  // the grand cathedral: a lantern tower over the crossing, a soaring spire, a golden sun that turns
  const top = H + RH * 1.35;
  c.add(box(3.4, 3.2, 3.4, C.stoneLight, 0, top - 0.8, 0));
  c.add(box(3.8, 0.3, 3.8, C.gold, 0, top + 2.4, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const l = lancet(0, 0, 0, 0.5, 1.5, i);
    l.position.set(Math.sin(a) * 1.72, top - 0.2, Math.cos(a) * 1.72);
    l.rotation.y = a;
    c.add(l);
    // pinnacles at the corners of the lantern
    const px = (i % 2 ? 1 : -1) * 1.7, pz = (i < 2 ? 1 : -1) * 1.7;
    c.add(cone(0.28, 1.6, C.stoneLight, 4, px, top + 2.6, pz));
    c.add(blob(0.12, C.gold, px, top + 4.2, pz));
  }
  const spire = cone(1.9, 8.5, C.tile, 8, 0, top + 2.7);
  c.add(spire);
  for (const y of [top + 4.2, top + 6.6]) c.add(cyl(1.9 * (1 - (y - top - 2.7) / 8.5) + 0.05, 1.9 * (1 - (y - top - 2.7) / 8.5) + 0.05, 0.14, C.gold, 8, 0, y));
  const sun = sunDisc(t === 5 ? 1.7 : 1.35);
  sun.position.set(0, top + 12.3, 0);
  c.add(sun);
  c.add(cyl(0.09, 0.09, 1.6, C.gold, 5, 0, top + 10.6));
  c.add(doves(t === 5 ? 9 : 7, 5.4, top + 7.6, 17));
  if (t === 5) {
    // gilded knights keep the door, and the spires fly the Order's banners
    for (const x of [-1, 1]) {
      c.add(box(0.9, 1.0, 0.9, C.stone, x * 2.1, 0, D / 2 + 0.8));
      const kn = knightStatue(1.1);
      kn.position.set(x * 2.1, 1.0, D / 2 + 0.8);
      c.add(kn);
    }
    for (const x of [-1, 1]) {
      const b = banner(ROYAL, 3.2);
      b.position.set(x * 4.4, 8.4 + 1.8 + 0.4, D / 2 - 0.9 + 1.5);
      c.add(b);
    }
  }
  c.scale.setScalar(k);
  g.add(c);
  return { obj: g, h: t === 5 ? 28 : 26, w: 15, d: 16 };
}

// ---------- the Arcane citadel (sorcerer headquarters) ----------

/** A tall arched window, lit from within, facing +Z. */
function archWindow(w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w + 0.18, h + 0.12, 0.1, C.stoneLight, 0, -0.06, -0.03));
  const pane = box(w, h - w / 2, 0.12, C.window);
  pane.userData.window = true;
  g.add(pane);
  const arch = mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.12, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), C.window);
  arch.position.y = h - w / 2;
  arch.userData.window = true;
  g.add(arch);
  return g;
}

/** A mage's tower: a slate plinth, tapering stone banded with runes, lit windows, a railed balcony and a crooked hat. */
function mageTower(R: number, H: number, hat = true): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(R * 1.14, R * 1.2, 0.8, C.stoneDark, 12));
  g.add(cyl(R * 0.84, R, H, C.stone, 12));
  g.add(runeRing(R * 0.97, H * 0.24));
  g.add(runeRing(R * 0.9, H * 0.56, VIO, VIO_EMIT));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    for (const k of [0.38, 0.66]) {
      const rr = R * (1 - k * 0.16) + 0.02;
      const w = archWindow(Math.min(0.5, R * 0.22), Math.min(1.1, R * 0.5));
      w.position.set(Math.sin(a) * rr, H * k, Math.cos(a) * rr);
      w.rotation.y = a;
      g.add(w);
    }
  }
  // a railed balcony near the top
  const by = H * 0.8, br = R * (1 - 0.8 * 0.16) + 0.45;
  g.add(cyl(br, br - 0.15, 0.3, C.stoneLight, 14, 0, by));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    g.add(box(0.1, 0.62, 0.1, C.stoneLight, Math.cos(a) * (br - 0.08), by + 0.3, Math.sin(a) * (br - 0.08)));
  }
  g.add(mesh(new THREE.TorusGeometry(br - 0.08, 0.05, 4, 28).rotateX(Math.PI / 2), C.gold).translateY(by + 0.92));
  g.add(cyl(R * 0.98, R * 0.84, 0.5, C.stoneLight, 12, 0, H - 0.45));
  if (hat) {
    const h = witchHat(R * 0.96, R * 2.7, C.tile, 0.5);
    h.position.y = H;
    g.add(h);
  }
  return g;
}

/** An observatory: a starry dome on a gold ring, its slit open and a brass telescope aimed at the sky. */
function observatory(r: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(r * 1.06, r * 1.06, 0.22, C.gold, 14));
  g.add(mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x2d2a78).translateY(0.2));
  for (let i = 0; i < 10; i++) {
    const a = i * 2.3, el = 0.25 + (i % 3) * 0.38;
    const st = mesh(new THREE.OctahedronGeometry(0.09, 0), STAR, { emissive: STAR_EMIT });
    st.position.set(Math.cos(a) * Math.cos(el) * r * 1.01, 0.2 + Math.sin(el) * r * 1.01, Math.sin(a) * Math.cos(el) * r * 1.01);
    g.add(st);
  }
  const slit = box(0.5, r * 0.95, 0.3, 0x141028, 0, 0.2 + r * 0.05, r * 0.78);
  slit.rotation.x = -0.55;
  g.add(slit);
  const tel = cyl(0.14, 0.22, r * 1.7, 0xd9a441, 8);
  tel.rotation.x = 0.75;
  tel.position.set(0, 0.2 + r * 0.5, r * 0.2);
  g.add(tel);
  return g;
}

/** A bridge of pale stone between two towers (at height y), a glowing rune strip along it. */
function skyBridge(ax: number, az: number, bx: number, bz: number, y: number): THREE.Group {
  const g = new THREE.Group();
  const len = Math.hypot(bx - ax, bz - az);
  g.add(box(len, 0.45, 1.1, C.stoneLight, 0, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(len, 0.06, 0.2).translate(0, 0.48, 0), ARC, { emissive: ARC_EMIT }));
  for (const z of [-0.5, 0.5]) g.add(box(len, 0.5, 0.1, C.stone, 0, 0.45, z));
  g.position.set((ax + bx) / 2, y, (az + bz) / 2);
  g.rotation.y = -Math.atan2(bz - az, bx - ax);
  return g;
}

function sorcererHall(t: number): Built {
  const g = new THREE.Group();
  if (t === 1) {
    // a lone mage's tower with a study leaning on it
    const tw = mageTower(2.0, 8.5);
    tw.position.set(-1.3, 0, -0.9);
    g.add(tw);
    const annex = house({ w: 4.4, d: 4.6, h: 2.8, roofH: 1.6, windows: 1 });
    annex.position.set(2.6, 0, 1.2);
    g.add(annex);
    const c = floatingCrystal(0.9);
    c.position.set(-1.3, 8.5 + 2.0 * 2.7 + 1.8, -0.9);
    g.add(c);
    return { obj: g, h: 15, w: 9, d: 9 };
  }
  if (t === 2) {
    // the tower grows, and a hall of study and a little turret join it
    const tw = mageTower(2.3, 10.5);
    tw.position.set(-1.6, 0, -1.6);
    g.add(tw);
    const hall = house({ w: 6.2, d: 5, h: 3.2, roofH: 2.0, windows: 2, stone: true });
    hall.position.set(1.4, 0, 2.2);
    g.add(hall);
    const small = mageTower(1.1, 6.2);
    small.position.set(4.4, 0, -1.8);
    g.add(small);
    const c = floatingCrystal(1.0);
    c.position.set(-1.6, 10.5 + 2.3 * 2.7 + 2.0, -1.6);
    g.add(c);
    return { obj: g, h: 19, w: 12, d: 12 };
  }
  // the college: a great tower behind a hall, twin towers at its front corners (one an observatory)
  const H = t === 3 ? 12.5 : t === 4 ? 15 : 17;
  const R = t === 3 ? 2.5 : 2.8;
  const main = mageTower(R, H);
  main.position.set(0, 0, -3.2);
  g.add(main);
  const hall = house({ w: 7.6, d: 5.2, h: 3.8, roofH: 2.2, windows: 3, stone: true });
  hall.position.set(0, 0, 2.0);
  g.add(hall);
  const left = mageTower(1.3, 7.8);
  left.position.set(-4.6, 0, 3.4);
  g.add(left);
  const right = mageTower(1.3, 7.2, false);
  right.position.set(4.6, 0, 3.4);
  g.add(right);
  const obs = observatory(1.45);
  obs.position.set(4.6, 7.2, 3.4);
  g.add(obs);
  const rc = runeCircle(1.2);
  rc.position.set(0, 0, 5.4);
  g.add(rc);
  const topY = H + R * 2.7;
  const c = floatingCrystal(t === 5 ? 1.6 : 1.3);
  c.position.set(0, topY + 2.4, -3.2);
  g.add(c);
  if (t >= 4) {
    // rings of runes wheel about the great tower
    const r1 = orbitRing(R * 1.9, 0.35, 0.4);
    r1.position.set(0, H * 0.62, -3.2);
    g.add(r1);
    const r2 = orbitRing(R * 2.25, -0.45, -0.28, VIO, VIO_EMIT);
    r2.position.set(0, H * 0.42, -3.2);
    g.add(r2);
    // and two back towers stand bridged to it
    for (const x of [-1, 1]) {
      const bt = mageTower(1.1, 9.5);
      bt.position.set(x * 4.4, 0, -6.2);
      g.add(bt);
      g.add(skyBridge(x * 4.4, -6.2, 0, -3.2, 6.4));
    }
  }
  if (t === 5) {
    // a crown of shards turns over the spire, and isles of rock drift about the citadel
    const crown = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const sh = mesh(new THREE.OctahedronGeometry(0.4, 0), i % 2 ? ARC : VIO, { emissive: i % 2 ? ARC_EMIT : VIO_EMIT });
      sh.scale.set(1, 2.2, 1);
      sh.position.set(Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4);
      crown.add(sh);
    }
    crown.userData.dynamic = true;
    crown.userData.orbit = -0.6;
    crown.position.set(0, topY + 2.4, -3.2);
    g.add(crown);
    const rr = rng(71);
    for (const [x, y, z, sc] of [[-6.2, 12.5, -1.5, 0.6], [6.3, 14, -5.2, 0.5], [-3.8, 16.5, -7.4, 0.42]]) {
      const isle = floatingIsle(sc, rr);
      isle.position.set(x, y, z);
      g.add(isle);
    }
    // the Order of the Star's banners on the twin towers
    for (const x of [-1, 1]) {
      const bn = banner(C.red, 2.6);
      bn.position.set(x * 4.6, 7.8 + (x < 0 ? 2.6 * 1.3 + 0.2 : 1.8), 3.4);
      if (x < 0) g.add(bn);
    }
  }
  return { obj: g, h: t === 3 ? 22 : t === 4 ? 25 : 28, w: 15, d: 16 };
}

// ---------- the Necropolis (necromancer headquarters): a crypt that grows into a keep with a bone dragon on it ----------

const BONE_DK = 0xb9b19c, BLACK_STONE = 0x2e2a33, GRAVE_DARK = 0x0b0a0c;
const Y_UP = new THREE.Vector3(0, 1, 0);

/** A bone from a to b, thicker at a. */
function boneSeg(a: THREE.Vector3, b: THREE.Vector3, r: number, color = BONE): THREE.Mesh {
  const d = b.clone().sub(a);
  const len = d.length();
  const m = mesh(new THREE.CylinderGeometry(r * 0.78, r, len, 6), color);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(Y_UP, d.normalize());
  return m;
}

/** Bones joined end to end through these points, a knuckle at every joint. */
function boneChain(g: THREE.Group, pts: THREE.Vector3[], r0: number, r1 = r0): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const r = r0 + ((r1 - r0) * i) / Math.max(1, pts.length - 2);
    g.add(boneSeg(pts[i], pts[i + 1], r));
    if (i > 0) g.add(blob(r * 1.25, BONE_DK, pts[i].x, pts[i].y, pts[i].z));
  }
}

/** A frame along a curve at k: its tangent, the "up" across it, and the side. */
function frameAt(curve: THREE.Curve<THREE.Vector3>, k: number) {
  const p = curve.getPointAt(k), T = curve.getTangentAt(k).normalize();
  let U = Y_UP.clone().sub(T.clone().multiplyScalar(T.y));
  if (U.lengthSq() < 1e-4) U = new THREE.Vector3(1, 0, 0);
  U.normalize();
  const S = new THREE.Vector3().crossVectors(T, U).normalize();
  return { p, T, U, S };
}

/** A backbone: vertebrae along a curve, a spine on each, tapering from r0 to r1. */
function backbone(g: THREE.Group, pts: THREE.Vector3[], n: number, r0: number, r1: number, spikes = true): THREE.CatmullRomCurve3 {
  const curve = new THREE.CatmullRomCurve3(pts);
  let prev: THREE.Vector3 | null = null;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const { p, T, U } = frameAt(curve, k);
    const r = r0 + (r1 - r0) * k;
    // the cord of the spine joining each vertebra to the last
    if (prev) g.add(boneSeg(prev, p, r * 0.5, BONE_DK));
    prev = p.clone();
    const v = mesh(new THREE.CylinderGeometry(r, r * 0.85, r * 1.5, 6), BONE);
    v.position.copy(p);
    v.quaternion.setFromUnitVectors(Y_UP, T);
    g.add(v);
    if (spikes) {
      const sp = mesh(new THREE.ConeGeometry(r * 0.32, r * 1.7, 4).translate(0, r * 0.85, 0), BONE_DK);
      sp.position.copy(p).addScaledVector(U, r * 0.7);
      sp.quaternion.setFromUnitVectors(Y_UP, U.clone().addScaledVector(T, -0.35).normalize());
      g.add(sp);
    }
  }
  return curve;
}

/** A dragon's skull, facing +Z: long snout, open jaw full of teeth, swept-back horns, eyes burning green. */
function dragonSkull(sz: number): THREE.Group {
  const g = new THREE.Group();
  g.add(blob(0.8 * sz, BONE, 0, 0, 0, 1.1, 0.85, 1.25));
  g.add(box(0.9 * sz, 0.48 * sz, 1.7 * sz, BONE, 0, -0.18 * sz, 1.3 * sz).translateZ(0));
  g.add(box(0.7 * sz, 0.3 * sz, 0.6 * sz, BONE_DK, 0, 0.22 * sz, 1.9 * sz));
  const jaw = box(0.78 * sz, 0.2 * sz, 1.7 * sz, BONE_DK, 0, 0, 0);
  jaw.geometry.translate(0, 0, 0.85 * sz);
  jaw.position.set(0, -0.42 * sz, 0.35 * sz);
  jaw.rotation.x = 0.42;
  g.add(jaw);
  for (let i = 0; i < 6; i++) {
    for (const x of [-0.36, 0.36]) {
      const tooth = cone(0.06 * sz, 0.28 * sz, 0xf4efe0, 4);
      tooth.rotation.x = Math.PI;
      tooth.position.set(x * sz, -0.4 * sz, (0.75 + i * 0.25) * sz);
      g.add(tooth);
    }
  }
  for (const x of [-1, 1]) {
    const socket = mesh(new THREE.IcosahedronGeometry(0.2 * sz, 0), GHOST, { emissive: GHOST_EMIT });
    socket.position.set(x * 0.42 * sz, 0.12 * sz, 0.72 * sz);
    g.add(socket);
    // horns sweeping back
    const h1 = cone(0.2 * sz, 1.9 * sz, BONE_DK, 6);
    h1.position.set(x * 0.5 * sz, 0.35 * sz, -0.35 * sz);
    h1.rotation.set(-2.0, 0, -x * 0.35);
    g.add(h1);
    const h2 = cone(0.12 * sz, 1.0 * sz, BONE_DK, 5);
    h2.position.set(x * 0.72 * sz, 0.05 * sz, -0.2 * sz);
    h2.rotation.set(-1.8, 0, -x * 0.9);
    g.add(h2);
  }
  return g;
}

/** A bone wing (x outward on this side): arm and finger bones with torn, dark membrane between. */
function boneWing(side: number, sz: number, base: number, amp: number): THREE.Group {
  const g = new THREE.Group();
  const P = (x: number, y: number, z: number) => new THREE.Vector3(x * side * sz, y * sz, z * sz);
  const shoulder = P(0, 0, 0), elbow = P(2.2, 1.3, -0.5), wrist = P(4.3, 2.1, 0.1);
  const tips = [P(7.6, 3.2, -0.7), P(7.5, 1.0, -1.3), P(6.3, -0.9, -1.5), P(4.4, -1.7, -1.3)];
  boneChain(g, [shoulder, elbow, wrist], 0.2 * sz, 0.14 * sz);
  for (const tp of tips) g.add(boneSeg(wrist, tp, 0.08 * sz));
  g.add(cone(0.12 * sz, 0.6 * sz, BONE_DK, 4).translateX(wrist.x).translateY(wrist.y).translateZ(wrist.z));
  // the membrane: a fan from the wrist, scalloped and torn between the fingers
  const pts: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < tips.length - 1; i++) {
    const mid = tips[i].clone().lerp(tips[i + 1], 0.5).lerp(wrist, i === 1 ? 0.45 : 0.28);
    tri(wrist, tips[i], mid);
    tri(wrist, mid, tips[i + 1]);
  }
  const flank = P(0.5, -1.1, -0.9);
  tri(wrist, tips[tips.length - 1], flank);
  tri(shoulder, wrist, flank);
  tri(shoulder, elbow, wrist);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.computeVertexNormals();
  g.add(mesh(geo, 0x2c3a30, { opacity: 0.72, double: true }));
  g.userData.dynamic = true;
  g.userData.wing = side;
  g.userData.wingBase = base;
  g.userData.wingAmp = amp;
  return g;
}

/** A skeletal dragon crouched on a tower top (origin at its feet), facing +Z. */
function boneDragon(sz: number, spread: boolean): THREE.Group {
  const g = new THREE.Group();
  const P = (x: number, y: number, z: number) => new THREE.Vector3(x * sz, y * sz, z * sz);
  // backbone from the root of the tail to the shoulders, then the neck up to the head
  const body = backbone(g, [P(0, 0.9, -2.4), P(0, 1.35, -1.2), P(0, 1.55, 0), P(0, 1.45, 1.1)], 9, 0.26 * sz, 0.3 * sz);
  backbone(g, [P(0, 1.45, 1.1), P(0, 2.3, 1.7), P(0, 3.3, 2.0), P(0, 3.95, 2.55)], 8, 0.24 * sz, 0.17 * sz);
  const head = dragonSkull(0.95 * sz);
  head.position.copy(P(0, 4.05, 2.75));
  head.rotation.x = 0.38;
  g.add(head);
  // the ribcage, and soul-fire burning green inside it
  const ribs = 6;
  for (let i = 0; i < ribs; i++) {
    const k = 0.25 + (0.6 * i) / (ribs - 1);
    const { p, U, S } = frameAt(body, k);
    const R = (0.95 - Math.abs(i - (ribs - 1) / 2) * 0.1) * sz;
    for (const side of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= 4; j++) {
        const a = 0.2 + j * 0.56;
        pts.push(p.clone().addScaledVector(S, side * R * Math.sin(a)).addScaledVector(U, R * (Math.cos(a) - 1) * 1.05));
      }
      boneChain(g, pts, 0.085 * sz, 0.06 * sz);
    }
  }
  const soul = new THREE.Group();
  soul.add(mesh(new THREE.IcosahedronGeometry(0.42 * sz, 1), GHOST, { emissive: GHOST_EMIT }));
  soul.add(mesh(new THREE.IcosahedronGeometry(0.75 * sz, 1), GHOST, { emissive: GHOST_EMIT, opacity: 0.22 }));
  soul.userData.dynamic = true;
  soul.userData.bob = 0.12 * sz;
  soul.userData.orbit = 0.9;
  soul.position.copy(P(0, 0.85, -0.3));
  g.add(soul);
  // legs: forefeet gripping the parapet, hind legs crouched
  for (const x of [-1, 1]) {
    const fore = [P(x * 0.65, 1.15, 0.9), P(x * 1.25, 0.55, 1.35), P(x * 1.3, 0.05, 1.85), P(x * 1.35, -0.15, 2.3)];
    boneChain(g, fore, 0.17 * sz, 0.12 * sz);
    const hind = [P(x * 0.6, 1.0, -1.9), P(x * 1.45, 1.1, -1.1), P(x * 1.35, 0.3, -1.85), P(x * 1.4, -0.1, -1.4)];
    boneChain(g, hind, 0.2 * sz, 0.13 * sz);
    for (const [foot, dz] of [[fore[3], 1], [hind[3], 1]] as [THREE.Vector3, number][]) {
      for (let c = -1; c <= 1; c++) {
        const claw = cone(0.06 * sz, 0.42 * sz, 0x2a2622, 4);
        claw.position.copy(foot).add(new THREE.Vector3(c * 0.14 * sz, 0, 0.05 * sz * dz));
        claw.rotation.x = 1.9;
        g.add(claw);
      }
    }
  }
  // wings from the shoulders: folded and drooping, or spread and slowly beating
  for (const side of [-1, 1]) {
    const w = boneWing(side, sz * (spread ? 1 : 0.8), spread ? 0.15 : -0.55, spread ? 0.2 : 0.06);
    w.position.copy(P(side * 0.55, 1.75, 0.55));
    if (!spread) w.rotation.y = side * 0.6;
    g.add(w);
  }
  return g;
}

/** A column of stacked skulls: an ossuary pillar. */
function skullColumn(n: number, s2 = 0.62): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.9, 0.3, 0.9, BLACK_STONE));
  for (let i = 0; i < n; i++) {
    const sk = skull(s2);
    sk.position.set(0, 0.62 + i * s2 * 0.98, 0);
    sk.rotation.y = (i % 2 ? 0.3 : -0.3);
    g.add(sk);
  }
  g.add(box(1.0, 0.25, 1.0, BLACK_STONE, 0, 0.35 + n * s2 * 0.98, 0));
  return g;
}

/** An iron basket of green soul-fire on a post. */
function soulBrazier(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.08, 0.12, h, BLACK_STONE, 5));
  g.add(cyl(0.45, 0.25, 0.45, BLACK_STONE, 7, 0, h));
  const fire = cone(0.34, 0.9, GHOST, 6, 0, h + 0.35);
  fire.material = mat(GHOST, { emissive: GHOST_EMIT });
  fire.userData.fire = true;
  g.add(fire);
  return g;
}

function necroHall(t: number): Built {
  const g = new THREE.Group();
  if (t === 1) {
    // a crypt: a black-roofed mausoleum behind pillars, a skull over its door, the dead in rows before it
    g.add(box(5.4, 0.5, 6.4, BLACK_STONE, 0, 0, -0.2));
    const crypt = house({ w: 4.4, d: 5.2, h: 3.2, roofH: 2.0, stone: true, windows: 0, door: false });
    crypt.position.set(0, 0.5, -0.4);
    g.add(crypt);
    for (const x of [-1.7, -0.6, 0.6, 1.7]) g.add(cyl(0.22, 0.26, 3.0, C.stoneLight, 8, x, 0.5, 2.5));
    g.add(box(4.4, 0.5, 0.7, C.stone, 0, 3.5, 2.5));
    g.add(box(1.3, 2.2, 0.2, GRAVE_DARK, 0, 0.5, 2.25));
    const sk = skull(0.9);
    sk.position.set(0, 3.2, 2.9);
    g.add(sk);
    for (let i = 0; i < 6; i++) g.add(box(0.7, 1.0 + (i % 2) * 0.3, 0.2, C.stone, -3.8 + (i % 2) * 7.6, 0, -2 + Math.floor(i / 2) * 1.8));
    for (const x of [-2.9, 2.9]) { const b = soulBrazier(1.6); b.position.set(x, 0, 3.4); g.add(b); }
    return { obj: g, h: 9, w: 8, d: 8 };
  }
  if (t === 2) {
    // a chapel of bones: a black chapel, a needle-spired bell tower, ossuary pillars and a gate of bone
    const chapel = house({ w: 5.6, d: 8, h: 3.4, roofH: 2.4, stone: true, windows: 2 });
    chapel.position.set(0.8, 0, -0.6);
    g.add(chapel);
    const tw = new THREE.Group();
    tw.add(box(2.6, 8, 2.6, C.stone));
    tw.add(box(3.0, 0.4, 3.0, BLACK_STONE, 0, 8, 0));
    tw.add(cone(2.0, 5.2, C.slate, 4, 0, 8.4).rotateY(Math.PI / 4));
    tw.add(cone(0.08, 1.2, C.iron, 4, 0, 13.6));
    tw.add(glowBit(new THREE.BoxGeometry(0.4, 1.1, 0.1), GHOST, GHOST_EMIT).translateY(6).translateZ(1.32));
    const sk = skull(0.8);
    sk.position.set(0, 4.6, 1.5);
    tw.add(sk);
    tw.position.set(-3.6, 0, 1.6);
    g.add(tw);
    for (const x of [-1.6, 3.2]) { const c = skullColumn(4); c.position.set(x, 0, 4.6); g.add(c); }
    // an arch of bones over the path, a skull for its keystone
    const arch: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) { const a = Math.PI * (i / 6); arch.push(new THREE.Vector3(0.8 - Math.cos(a) * 2.4, 3.2 + Math.sin(a) * 1.6, 4.6)); }
    boneChain(g, arch, 0.16);
    const ks = skull(0.6);
    ks.position.set(0.8, 5.0, 4.8);
    g.add(ks);
    return { obj: g, h: 16, w: 13, d: 13 };
  }
  // the Bone Keep: a black tower behind a hall whose door is the mouth of a giant skull, rib buttresses along it
  const H = t === 3 ? 12 : t === 4 ? 13 : 14.5;
  const R = t === 3 ? 2.4 : 2.7;
  const keep = new THREE.Group();
  keep.add(cyl(R * 1.15, R * 1.22, 0.9, BLACK_STONE, 10));
  keep.add(cyl(R * 0.9, R, H, C.stone, 10));
  for (const k of [0.3, 0.6]) {
    const band = mesh(new THREE.CylinderGeometry(R * (1 - k * 0.1) + 0.03, R * (1 - k * 0.1) + 0.03, 0.16, 14, 1, true), GHOST, { emissive: GHOST_EMIT, double: true });
    band.position.y = H * k;
    keep.add(band);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    for (const k of [0.45, 0.75]) {
      const rr = R * (1 - k * 0.1) + 0.02;
      const slit = glowBit(new THREE.BoxGeometry(0.28, 1.1, 0.1), GHOST, GHOST_EMIT);
      slit.position.set(Math.sin(a) * rr, H * k, Math.cos(a) * rr);
      slit.rotation.y = a;
      keep.add(slit);
    }
  }
  keep.add(cyl(R * 1.02, R * 0.88, 0.5, BLACK_STONE, 10, 0, H - 0.4));
  keep.add(merlonRing(R * 0.95, H + 0.1, 10, BLACK_STONE, 0.5));
  if (t === 3) {
    keep.add(cone(R * 1.02, R * 3.1, C.slate, 8, 0, H + 0.3));
    keep.add(cone(0.08, 1.4, C.iron, 4, 0, H + 0.3 + R * 3.1));
    const sk = skull(0.9);
    sk.position.set(0, H + 1.4, R * 0.75);
    keep.add(sk);
  }
  keep.position.set(0, 0, -3.2);
  g.add(keep);
  const hall = house({ w: 8, d: 5, h: 4.4, roofH: 2.4, stone: true, windows: 3, door: false });
  hall.position.set(0, 0, 1.4);
  g.add(hall);
  // the skull gate: the hall's door is the mouth of a great skull
  const gate = skull(2.5);
  gate.position.set(0, 3.1, 3.7);
  g.add(gate);
  g.add(box(1.7, 2.4, 0.35, GRAVE_DARK, 0, 0, 4.05));
  for (let i = 0; i < 5; i++) { const tooth = cone(0.13, 0.5, 0xf4efe0, 4, -0.8 + i * 0.4, 2.45, 4.35); tooth.rotation.x = Math.PI; g.add(tooth); }
  for (const x of [-1, 1]) {
    const tw = roundTower(1.2, 7, {});
    tw.position.set(x * 4.6, 0, 3.4);
    g.add(tw);
    // rib buttresses along the hall's flanks
    for (const z of [0.1, 2.5]) boneChain(g, [new THREE.Vector3(x * 5.7, 0, z), new THREE.Vector3(x * 5.4, 2.4, z), new THREE.Vector3(x * 4.9, 3.8, z), new THREE.Vector3(x * 4.1, 4.4, z)], 0.24, 0.16);
    const br = soulBrazier(1.5);
    br.position.set(x * 2.2, 0, 5.5);
    g.add(br);
  }
  if (t >= 4) {
    // the dragon: crouched on the keep, its tail coiled down round the tower
    const sz = t === 5 ? 1.25 : 1.0;
    const dragon = boneDragon(sz, t === 5);
    dragon.position.set(0, H + 0.15, -3.2);
    g.add(dragon);
    const tail: THREE.Vector3[] = [new THREE.Vector3(0, H + 0.15 + 0.9 * sz, -3.2 - 2.4 * sz)];
    const turns = 1.15, steps = 10;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      const a = -Math.PI / 2 - k * turns * Math.PI * 2;
      const rr = R * 1.0 + 0.45 - k * 0.15;
      tail.push(new THREE.Vector3(Math.cos(a) * rr, H - 0.4 - k * (H * 0.55), -3.2 + Math.sin(a) * rr));
    }
    backbone(g, tail, 40, 0.24 * sz, 0.08 * sz);
    const end = tail[tail.length - 1];
    const barb = cone(0.22, 0.9, BONE_DK, 4, end.x, end.y, end.z);
    barb.rotation.z = Math.PI;
    g.add(barb);
  }
  if (t === 5) {
    // lost souls wheel about the keep
    const wisps = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const w = new THREE.Group();
      w.add(mesh(new THREE.IcosahedronGeometry(0.28, 1), GHOST, { emissive: GHOST_EMIT }));
      w.add(mesh(new THREE.ConeGeometry(0.22, 0.9, 6).rotateX(-Math.PI / 2).translate(0, 0, -0.5), GHOST, { emissive: GHOST_EMIT, opacity: 0.4 }));
      w.position.set(Math.cos(a) * 5.4, (i % 3) * 1.6, Math.sin(a) * 5.4);
      w.rotation.y = -a;
      wisps.add(w);
    }
    wisps.userData.dynamic = true;
    wisps.userData.orbit = 0.5;
    wisps.userData.bob = 0.5;
    wisps.position.set(0, H * 0.5, -3.2);
    g.add(wisps);
  }
  return { obj: g, h: t === 3 ? 22 : t === 4 ? 24 : 28, w: 15, d: 16 };
}

function glowWindow(x: number, y: number, z: number, ry = 0): THREE.Group {
  const g = new THREE.Group();
  const w = cyl(0.32, 0.32, 0.12, C.window, 8);
  w.rotation.x = Math.PI / 2;
  w.userData.window = true;
  g.add(w);
  g.position.set(x, y, z);
  g.rotation.y = ry;
  return g;
}

/**
 * The druids' Great Tree Hall: a stump hut that grows into a hollow tree home,
 * then a great tree with platforms and huts, and at last a towering world-tree
 * ringed by standing stones.
 */
function druidHall(t: number): Built {
  const g = new THREE.Group();
  const r = rng(71 + t);
  const AMBER = 0xffc25a, AMBER_E = 0xb0661a, FIREFLY = 0xe8ff8a, FIREFLY_E = 0x8ab020;
  const lantern = (x: number, y: number, z: number) => {
    g.add(box(0.04, 0.5, 0.04, 0x3a2a18, x, y, z));
    const l = mesh(new THREE.IcosahedronGeometry(0.2, 0), AMBER, { emissive: AMBER_E });
    l.position.set(x, y - 0.15, z);
    l.userData.window = true;
    g.add(l);
  };
  const fireflies = (n: number, rad: number, y: number) => {
    const ff = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = rad * (0.4 + r() * 0.6);
      ff.add(mesh(new THREE.OctahedronGeometry(0.09, 0), FIREFLY, { emissive: FIREFLY_E }).translateX(Math.cos(a) * d).translateY(r() * 3).translateZ(Math.sin(a) * d));
    }
    ff.userData.dynamic = true;
    ff.userData.orbit = 0.25;
    ff.userData.bob = 0.6;
    ff.position.y = y;
    g.add(ff);
  };
  if (t === 1) {
    // a sacred grove: a ring of mossy standing stones round a young oak, an altar stone before it
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.2;
      if (Math.sin(a) > 0.8) continue;
      const st = box(0.6, 1.7 + r() * 0.7, 0.45, MENHIR, Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4);
      st.rotation.y = -a;
      g.add(st);
      g.add(blob(0.3, MOSS, Math.cos(a) * 3.4, 1.9, Math.sin(a) * 3.4, 1, 0.4, 1));
    }
    g.add(cyl(0.25, 0.35, 2.4, BARK, 6));
    for (let i = 0; i < 4; i++) g.add(blob(0.9, i % 2 ? LEAF : LEAF_LT, (r() - 0.5) * 1.2, 2.6 + r() * 0.8, (r() - 0.5) * 1.2, 1, 0.8, 1));
    g.add(box(1.6, 0.6, 0.9, MENHIR, 0, 0, 2.2));
    g.add(mushrooms(6, r, 2.6));
    fireflies(8, 3, 0.8);
    return { obj: g, h: 5.5, w: 8, d: 8 };
  }
  if (t === 2) {
    // a young oak with a round treehouse in its arms, a ladder up to it
    g.add(cyl(1.0, 1.5, 5.2, BARK, 9));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const root = box(0.5, 0.7, 1.6, BARK_DK, Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4); root.rotation.y = -a + Math.PI / 2; g.add(root); }
    g.add(cyl(2.8, 2.8, 0.25, C.timberLight, 12, 0, 3.6));
    g.add(cyl(2.0, 2.0, 1.8, 0xc9a56a, 10, 0, 3.85));
    g.add(cone(2.6, 1.8, MOSS, 10, 0, 5.65));
    g.add(glowWindow(0, 4.6, 2.02), glowWindow(1.6, 4.6, 1.2, 0.9));
    const lad = new THREE.Group();
    for (const x of [-0.3, 0.3]) lad.add(box(0.08, 3.8, 0.08, C.timber, x, 0, 0));
    for (let y = 0.4; y < 3.6; y += 0.5) lad.add(box(0.6, 0.06, 0.06, C.timber, 0, y, 0));
    lad.rotation.x = -0.2;
    lad.position.set(0.8, 0, 3.3);
    g.add(lad);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.add(blob(1.6, i % 2 ? LEAF : LEAF_LT, Math.cos(a) * 2.4, 7 + r(), Math.sin(a) * 2.2, 1, 0.75, 1)); }
    g.add(blob(2.2, LEAF, 0, 8.4, 0, 1, 0.7, 1));
    lantern(2.6, 3.6, 0.6);
    fireflies(10, 4, 1.2);
    return { obj: g, h: 10.5, w: 9, d: 9 };
  }
  // the World Tree: three trunks grown into one, roots arching over the earth, a stair winding up it,
  // platforms and lanterns in its boughs, an amber heart glowing in the bark
  const R = [0, 0, 0, 2.3, 2.8, 3.1][t];
  const H = [0, 0, 0, 7, 8.6, 10][t];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const tr = cyl(R * 0.55, R * 0.7, H, i === 1 ? BARK_DK : BARK, 8);
    tr.position.set(Math.cos(a) * R * 0.38, 0, Math.sin(a) * R * 0.38);
    tr.rotation.set(Math.sin(a) * 0.05, 0, -Math.cos(a) * 0.05);
    g.add(tr);
  }
  // arching roots
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.35;
    if (Math.sin(a) > 0.85) continue; // the doorway
    const pts = [0, 1, 2, 3].map((k) => new THREE.Vector3(Math.cos(a) * (R * 0.8 + k * 0.85), 1.6 - k * 0.55 + (k === 1 ? 0.35 : 0), Math.sin(a) * (R * 0.8 + k * 0.85)));
    for (let k = 0; k < 3; k++) g.add(boneSeg(pts[k], pts[k + 1], 0.42 - k * 0.1, BARK_DK));
  }
  // the door in the roots, the amber heart above it
  g.add(box(1.2, 2.0, 0.4, C.door, 0, 0, R * 0.95));
  g.add(blob(0.7, BARK_DK, 0, 2.05, R * 0.92, 1, 0.5, 0.4));
  if (t >= 4) {
    const heart = mesh(new THREE.IcosahedronGeometry(0.55, 0), AMBER, { emissive: AMBER_E });
    heart.scale.set(1, 1.4, 0.6);
    heart.position.set(0, H * 0.55, R * 0.92);
    heart.userData.window = true;
    g.add(heart);
    g.add(mesh(new THREE.TorusGeometry(0.75, 0.1, 5, 12), BARK_DK).translateY(H * 0.55).translateZ(R * 0.9));
  }
  // a stair of planks winding up round the trunk
  const steps = 16 + t * 4;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2 * 1.4 + 1.2;
    const y = 0.4 + (i / steps) * (H * 0.8);
    const st = box(1.1, 0.12, 0.5, C.timberLight, 0, 0, 0);
    st.position.set(Math.cos(a) * (R + 0.55), y, Math.sin(a) * (R + 0.55));
    st.rotation.y = -a;
    g.add(st);
  }
  // platforms and their lanterns
  for (let k = 0; k < t - 2; k++) {
    const y = 3.4 + k * 2.7;
    g.add(cyl(R + 1.4, R + 1.3, 0.25, C.timberLight, 14, 0, y));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(box(0.1, 0.7, 0.1, C.timber, Math.cos(a) * (R + 1.3), y + 0.25, Math.sin(a) * (R + 1.3))); }
    lantern(R + 1.3, y + 1.6, 0.4);
    lantern(-(R + 1.3), y + 1.6, -0.4);
  }
  // the crown: great tiers of leaves
  const crown = [0, 0, 0, 4.4, 5.4, 6.2][t];
  const tiers = t - 1;
  for (let k = 0; k < tiers; k++) {
    // wide, flat layers of leaves: broad at the bottom, a dome on top
    const y = H + k * crown * 0.26;
    const rad = crown * (1.15 - k * 0.3);
    const n = 7 + t;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k * 0.4;
      g.add(blob(rad * 0.4, (i + k) % 2 ? LEAF : LEAF_LT, Math.cos(a) * rad * 0.72, y + r() * 0.6, Math.sin(a) * rad * 0.62, 1, 0.55, 1, 1));
    }
  }
  g.add(blob(crown * 0.62, LEAF_LT, 0, H + tiers * crown * 0.26 + 0.2, 0, 1, 0.5, 1, 1));
  // boughs reaching out under the leaves
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.6;
    g.add(boneSeg(new THREE.Vector3(0, H - 0.5, 0), new THREE.Vector3(Math.cos(a) * crown * 0.75, H + 1.2, Math.sin(a) * crown * 0.6), 0.45, BARK));
  }
  if (t >= 4) {
    // a little tree beside it with its own platform, joined by a rope bridge
    const sx = -4.6, sz = 3.4, sy = 4.0;
    g.add(cyl(0.45, 0.65, sy + 1.6, BARK, 7, sx, 0, sz));
    g.add(cyl(1.3, 1.3, 0.2, C.timberLight, 10, sx, sy, sz));
    g.add(blob(1.6, LEAF_LT, sx, sy + 2.6, sz, 1, 0.75, 1));
    const a0 = new THREE.Vector3(sx + 1.1, sy + 0.1, sz - 0.4), a1 = new THREE.Vector3(-R * 0.8, 3.5, R * 0.3);
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const p = a0.clone().lerp(a1, k);
      p.y -= Math.sin(k * Math.PI) * 0.6;
      const plank = box(0.9, 0.08, 0.3, C.timberLight, p.x, p.y, p.z);
      plank.rotation.y = -Math.atan2(a1.z - a0.z, a1.x - a0.x) + Math.PI / 2;
      g.add(plank);
    }
    lantern(sx, sy + 1.5, sz + 1.2);
    // vines hanging from the boughs
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const len = 1.5 + r() * 2.5;
      g.add(box(0.07, len, 0.07, MOSS_DK, Math.cos(a) * crown * 0.65, H + 0.6 - len, Math.sin(a) * crown * 0.5));
      if (i % 3 === 0) g.add(blob(0.12, 0xe88aa6, Math.cos(a) * crown * 0.65, H + 0.6 - len, Math.sin(a) * crown * 0.5));
    }
  }
  if (t === 5) {
    // a spring at its roots, glowing faintly, and the stones of the old grove
    g.add(cyl(1.5, 1.5, 0.08, 0x4aa0a8, 12, 3.4, 0.04, 3.2).translateY(0));
    g.add(mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.04, 12), 0x9ff0e0, { emissive: 0x2a8a7a, opacity: 0.6 }).translateX(3.4).translateY(0.1).translateZ(3.2));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.add(box(0.5, 0.4, 0.4, MENHIR, 3.4 + Math.cos(a) * 1.8, 0, 3.2 + Math.sin(a) * 1.8)); }
    for (let i = 0; i < 6; i++) { const a = -Math.PI * 0.2 - i * 0.45; const st = box(0.6, 2 + r() * 0.8, 0.45, MENHIR, Math.cos(a) * 5.6, 0, Math.sin(a) * 5.0 - 1); st.rotation.y = -a; g.add(st); }
  }
  fireflies(10 + t * 4, crown, 2);
  const h = H + tiers * crown * 0.26 + crown * 0.5;
  return { obj: g, h, w: 14, d: 14 };
}

const HIDE = 0x8a6a3e, HIDE_DK = 0x6b4f2c, RAG = 0x6f9a2a, RUST = 0x8a4b24, RUST_DK = 0x5f3218, JUNK_WOOD = 0x4e3620, BONE = 0xe8dfc8;

function goblinTent(size: number, r: () => number): THREE.Group {
  const t = new THREE.Group();
  const body = cone(size, size * 1.5, HIDE, 6);
  body.rotation.y = r();
  t.add(body);
  // patches
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    const p = box(size * 0.45, size * 0.4, 0.05, i % 2 ? HIDE_DK : RAG, Math.cos(a) * size * 0.55, size * 0.35, Math.sin(a) * size * 0.55);
    p.rotation.y = -a + Math.PI / 2;
    p.rotation.x = -0.45;
    t.add(p);
  }
  for (const a of [0.3, 1.9, 3.8]) t.add(cyl(0.05, 0.05, 0.9, JUNK_WOOD, 4, Math.cos(a) * 0.25, size * 1.4, Math.sin(a) * 0.25));
  t.add(box(0.8, 1.1, 0.1, 0x241a12, 0, 0, size * 0.72));
  return t;
}

function skull(s: number): THREE.Group {
  const g = new THREE.Group();
  g.add(blob(0.5 * s, BONE, 0, 0, 0, 1, 0.9, 1));
  g.add(box(0.36 * s, 0.25 * s, 0.25 * s, BONE, 0, -0.45 * s, 0.1 * s));
  g.add(box(0.16 * s, 0.16 * s, 0.08 * s, 0x1a1a1a, -0.17 * s, 0.02 * s, 0.44 * s));
  g.add(box(0.16 * s, 0.16 * s, 0.08 * s, 0x1a1a1a, 0.17 * s, 0.02 * s, 0.44 * s));
  return g;
}

/**
 * The goblins' War Camp: a patched hide tent that sprawls into a stake-ringed
 * camp, a lopsided fort under rusted plates, a teetering junk tower, and at last
 * a skull-gated stronghold.
 */
function goblinHall(t: number): Built {
  const g = new THREE.Group();
  const r = rng(53 + t);
  const GOB = 0x7fa843, GOB_DK = 0x5e7f2c, EYE = 0xf2d64b, EYE_E = 0xa08010, SLIME = 0x9aff3a, SLIME_E = 0x4a9a10;
  const lamp = (x: number, y: number, z: number) => {
    g.add(box(0.06, 0.6, 0.06, JUNK_WOOD, x, y - 0.6, z));
    const l = mesh(new THREE.IcosahedronGeometry(0.2, 0), SLIME, { emissive: SLIME_E });
    l.position.set(x, y, z);
    l.userData.window = true;
    g.add(l);
  };
  const rag = (x: number, y: number, z: number, h: number, color = RAG) => {
    g.add(cyl(0.07, 0.08, h, JUNK_WOOD, 4, x, y, z));
    const fl = box(1.0, 0.6, 0.05, color, x + 0.55, y + h - 0.7, z);
    fl.userData.flag = true;
    g.add(fl);
  };
  /** A shack of odd planks under a rusty lean of plates, a little crooked. */
  const shack = (x: number, y: number, z: number, w: number, d: number, h: number, tilt: number) => {
    const sh = new THREE.Group();
    sh.add(box(w, h, d, r() < 0.5 ? JUNK_WOOD : 0x5e4428));
    for (let i = 0; i < Math.round(w / 0.7); i++) sh.add(box(0.16, h + 0.1, 0.1, 0x2f2012, -w / 2 + 0.35 + i * 0.7, 0, d / 2 + 0.04));
    for (let i = 0; i < 3; i++) {
      const p = box(w / 3 + 0.4, 0.14, d + 0.6, i % 2 ? RUST : RUST_DK, -w / 3 + i * (w / 3), h + 0.1 + (r() - 0.5) * 0.3, 0);
      p.rotation.z = (r() - 0.5) * 0.35;
      p.rotation.x = (r() - 0.5) * 0.2;
      sh.add(p);
    }
    sh.add(box(0.5, 0.5, 0.12, SLIME, (r() - 0.5) * w * 0.5, h * 0.55, d / 2 + 0.06).translateX(0));
    (sh.children[sh.children.length - 1] as THREE.Mesh).material = mat(SLIME, { emissive: SLIME_E });
    sh.children[sh.children.length - 1].userData.window = true;
    sh.position.set(x, y, z);
    sh.rotation.z = tilt;
    g.add(sh);
  };
  // the chief's gold: always on show, a bigger heap every level
  const hoard = (x: number, z: number, sz: number) => {
    const hp = new THREE.Group();
    hp.add(blob(1.0 * sz, 0xe0b040, 0, 0.2 * sz, 0, 1.3, 0.55, 1.1));
    hp.add(blob(0.6 * sz, 0xf0c850, 0.3 * sz, 0.6 * sz, -0.1 * sz, 1, 0.6, 1));
    for (let i = 0; i < 10 + t * 3; i++) {
      const c = cyl(0.14, 0.14, 0.05, 0xf2cc55, 8, (r() - 0.5) * 2.6 * sz, 0, (r() - 0.5) * 2.6 * sz);
      c.rotation.set(r() * 0.5, 0, r() * 0.5);
      hp.add(c);
    }
    if (t >= 2) {
      const ch = new THREE.Group();
      ch.add(box(1.0, 0.55, 0.65, 0x6e4a2a), box(1.04, 0.08, 0.69, 0xb07a3a, 0, 0.28, 0), blob(0.4, 0xf0c850, 0, 0.58, 0, 1.2, 0.45, 0.8));
      ch.position.set(1.4 * sz, 0, 0.8 * sz);
      ch.rotation.y = 0.6;
      hp.add(ch);
    }
    const glint = mesh(new THREE.OctahedronGeometry(0.16, 0), 0xffffff, { emissive: 0xffe08a });
    glint.position.set(0.2 * sz, 1.05 * sz, 0.2 * sz);
    glint.userData.dynamic = true;
    glint.userData.orbit = 2.5;
    glint.userData.bob = 0.1;
    hp.add(glint);
    hp.position.set(x, 0, z);
    g.add(hp);
  };
  /** The gate is a goblin's face: yellow eyes, big ears, and its open mouth is the door. */
  const faceGate = (z: number, sz: number) => {
    const fg = new THREE.Group();
    fg.add(blob(1.9, GOB, 0, 2.0, 0, 1.1, 1.0, 0.45));
    for (const x of [-1, 1]) {
      const ear = cone(0.45, 2.2, GOB_DK, 4, x * 1.9, 2.6, 0);
      ear.rotation.z = -x * 1.2;
      fg.add(ear);
      fg.add(mesh(new THREE.IcosahedronGeometry(0.36, 0), EYE, { emissive: EYE_E }).translateX(x * 0.75).translateY(2.75).translateZ(0.72));
      fg.add(box(0.2, 0.2, 0.1, 0x141010, x * 0.75, 2.66, 1.02));
    }
    fg.add(blob(0.35, GOB_DK, 0, 2.2, 0.85, 1, 1.2, 1));
    fg.add(box(1.4, 1.6, 0.4, 0x141010, 0, 0, 0.72));
    for (let i = 0; i < 4; i++) {
      const up = cone(0.13, 0.38, 0xf4efe0, 4, -0.5 + i * 0.33, 1.6, 0.95);
      up.rotation.x = Math.PI;
      fg.add(up);
    }
    fg.add(box(1.6, 0.3, 0.5, GOB_DK, 0, 1.55, 0.75));
    fg.scale.setScalar(sz);
    fg.position.set(0, 0, z);
    g.add(fg);
  };
  if (t <= 2) {
    // a patched hide tent (a crooked shack beside it later), a totem, the fire and the chief's first gold
    const tent = new THREE.Group();
    tent.add(cone(2.6, 3.6, HIDE, 7));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; tent.add(box(0.8, 0.7, 0.05, i % 2 ? HIDE_DK : RAG, Math.cos(a) * 1.5, 1.0 + (i % 2) * 0.5, Math.sin(a) * 1.5).rotateY(-a + Math.PI / 2)); }
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; tent.add(cone(0.06, 1.0, JUNK_WOOD, 4, Math.cos(a) * 0.3, 3.3, Math.sin(a) * 0.3)); }
    tent.add(box(1.0, 1.4, 0.1, 0x241a12, 0, 0, 2.2));
    tent.position.set(-0.8, 0, -0.6);
    g.add(tent);
    if (t === 2) shack(3.6, 0, -1.4, 3.2, 2.6, 2.2, 0.05);
    const totem = new THREE.Group();
    for (let i = 0; i < 3; i++) totem.add(box(0.7, 0.8, 0.7, i % 2 ? JUNK_WOOD : 0x5e4428, 0, i * 0.8, 0));
    const sk = skull(0.7);
    sk.position.set(0, 2.7, 0.1);
    totem.add(sk);
    totem.position.set(-3.6, 0, 2.2);
    g.add(totem);
    const fire = campfire();
    fire.position.set(1.6, 0, 2.6);
    g.add(fire);
    hoard(2.2, -3.2, 0.7 + t * 0.15);
    rag(3.4, 0, 2.4, 3.2);
    lamp(-3.0, 1.6, 3.4);
    return { obj: g, h: 6, w: 10, d: 9 };
  }
  // the Junk Fortress: shacks stacked on shacks, leaning, lashed together with rope and luck
  const levels = t === 3 ? 2 : t === 4 ? 3 : 4;
  let y = 0;
  for (let i = 0; i < levels; i++) {
    const w = 6.2 - i * 1.1, d = 4.8 - i * 0.7, h = 2.3 - i * 0.1;
    shack((r() - 0.5) * 0.8, y, -2.2 + (r() - 0.5) * 0.6, w, d, h, (r() - 0.5) * 0.08);
    y += h + 0.25;
  }
  const top = y;
  // a crooked lookout on stilts to one side, a rope bridge to it
  const lx = 4.4, lz = 0.6, ly = t >= 4 ? 4.4 : 3.2;
  for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
    const leg = box(0.18, ly, 0.18, JUNK_WOOD, lx + dx, 0, lz + dz);
    leg.rotation.z = dx * 0.05;
    g.add(leg);
  }
  shack(lx, ly, lz, 2.2, 2.2, 1.6, -0.06);
  rag(lx + 0.6, ly + 1.8, lz, 2.2, GOB);
  if (t >= 4) {
    const a0 = new THREE.Vector3(lx - 1.1, ly + 0.1, lz), a1 = new THREE.Vector3(2.4, 2.6, -1.0);
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      const p = a0.clone().lerp(a1, k);
      p.y -= Math.sin(k * Math.PI) * 0.5;
      const plank = box(0.3, 0.07, 0.9, i % 3 ? JUNK_WOOD : RUST, p.x, p.y, p.z);
      plank.rotation.y = -Math.atan2(a1.z - a0.z, a1.x - a0.x);
      g.add(plank);
    }
    // a smokestack belching green smoke, and a windmill of old shields
    g.add(cyl(0.35, 0.45, 3.2, RUST_DK, 7, -2.0, top - 0.3, -3.2));
    const sm = new THREE.Object3D();
    sm.userData.dynamic = true;
    sm.userData.smoke = true;
    sm.position.set(-2.0, top + 3.0, -3.2);
    g.add(sm);
    const mill = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.add(box(0.12, 1.8, 0.08, JUNK_WOOD, 0, 0, 0));
      arm.add(cyl(0.45, 0.45, 0.06, i % 2 ? RUST : 0x6e7a6a, 6, 0, 1.6, 0).rotateX(Math.PI / 2));
      arm.rotation.z = (i / 4) * Math.PI * 2;
      mill.add(arm);
    }
    mill.userData.dynamic = true;
    mill.userData.spin = true;
    mill.position.set(1.4, top + 0.9, -0.2);
    g.add(mill);
    g.add(box(0.2, 1.2, 0.2, JUNK_WOOD, 1.4, top - 0.2, -0.35));
  }
  if (t >= 5) {
    // a crane on the top with a cage swinging from it (for whoever annoyed the chief)
    g.add(box(0.25, 3.2, 0.25, JUNK_WOOD, -0.6, top, -2.4));
    const boom = box(4.2, 0.22, 0.22, JUNK_WOOD, 0, 0, 0);
    boom.geometry.translate(2.1, 0, 0);
    boom.position.set(-0.6, top + 3.1, -2.4);
    boom.rotation.z = 0.25;
    g.add(boom);
    const cage = new THREE.Group();
    cage.add(box(0.03, 1.2, 0.03, 0x8a8a7a, 0, -1.2, 0));
    cage.add(cyl(0.55, 0.55, 0.08, RUST_DK, 8, 0, -2.2, 0), cyl(0.55, 0.55, 0.08, RUST_DK, 8, 0, -1.2, 0));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; cage.add(box(0.04, 1.0, 0.04, RUST_DK, Math.cos(a) * 0.52, -2.15, Math.sin(a) * 0.52)); }
    cage.add(skull(0.5).translateY(-1.95));
    cage.userData.dynamic = true;
    cage.userData.flag = true;
    cage.position.set(-0.6 + Math.cos(0.25) * 3.9, top + 3.1 + Math.sin(0.25) * 3.9, -2.4);
    g.add(cage);
    rag(-2.6, top, -1.0, 2.6, GOB);
    rag(2.2, top - 2.5, -3.6, 2.6);
  }
  faceGate(1.2, t === 3 ? 0.85 : 1.0);
  // spikes and skulls along the front
  for (let i = 0; i < 6; i++) {
    const x = -5 + i * 2;
    if (Math.abs(x) < 1.5) continue;
    const sp = cone(0.14, 1.3, 0x3b3530, 4, x, 0, 3.4);
    sp.rotation.x = 0.35;
    g.add(sp);
    if (i % 2) { const sk = skull(0.4); sk.position.set(x, 1.4, 3.8); g.add(sk); }
  }
  hoard(-4.2, 1.6, 1.0 + (t - 3) * 0.25);
  if (t >= 4) hoard(-3.6, -4.6, 0.8 + (t - 4) * 0.3);
  lamp(-1.8, 2.2, 3.2);
  lamp(1.8, 2.2, 3.2);
  lamp(lx, ly + 2.2, lz + 1.2);
  const fire = campfire();
  fire.position.set(2.6, 0, 3.8);
  g.add(fire);
  return { obj: g, h: top + (t >= 5 ? 4.5 : t >= 4 ? 2.5 : 1.5), w: 13, d: 11 };
}

// ---------- hero themes: finishing touches per building ----------
// The walls and roofs already change with the theme (see kit.ts). These add
// each theme's own details while every building keeps the thing that tells you
// what it is: horses at the stable, stalls at the market, engines at the workshop.

const GLOW = 0xb58cff, GLOW_EMIT = 0x5a2fb0;

function glowBit(geo: THREE.BufferGeometry, color = GLOW, emissive = GLOW_EMIT): THREE.Mesh {
  return mesh(geo, color, { emissive });
}

/** A ring of glowing runes laid on the ground. */
function runeCircle(r: number): THREE.Group {
  const g = new THREE.Group();
  const ring = glowBit(new THREE.TorusGeometry(r, 0.07, 4, 24));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.06;
  g.add(ring);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const rune = glowBit(new THREE.BoxGeometry(0.25, 0.04, 0.12));
    rune.position.set(Math.cos(a) * r * 0.78, 0.07, Math.sin(a) * r * 0.78);
    rune.rotation.y = -a;
    g.add(rune);
  }
  return g;
}

function potions(n: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  const cols = [0xb58cff, 0x6fd3ff, 0x8cff9a, 0xff7ac8];
  for (let i = 0; i < n; i++) {
    const c = cols[i % cols.length];
    const p = glowBit(new THREE.CylinderGeometry(0.12, 0.16, 0.34, 6), c, c === 0xb58cff ? GLOW_EMIT : 0x203040);
    p.position.set((r() - 0.5) * 1.2, 0.17, (r() - 0.5) * 0.5);
    g.add(p);
  }
  return g;
}

function herbs(n: number, r: () => number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * 1.6, z = (r() - 0.5) * 0.8;
    g.add(cyl(0.28, 0.22, 0.3, 0x8b5a2b, 7, x, 0, z));
    g.add(blob(0.26, r() < 0.5 ? 0x6f9a3a : 0x9fbf4a, x, 0.35, z, 1, 0.7, 1));
  }
  return g;
}

function mushrooms(n: number, r: () => number, spread: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * spread, z = (r() - 0.5) * spread;
    g.add(cyl(0.07, 0.09, 0.35, 0xefe6d0, 5, x, 0, z));
    g.add(blob(0.2, r() < 0.5 ? 0xc0392b : 0xd98b2b, x, 0.38, z, 1, 0.5, 1));
  }
  return g;
}

function skullOnPole(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.1, h, C.timber, 4));
  const sk = skull(0.7);
  sk.position.set(0, h + 0.2, 0);
  g.add(sk);
  g.add(box(0.7, 0.45, 0.05, 0x6f9a2a, 0.4, h - 0.6, 0));
  return g;
}

/** An iron lantern post burning ghost-green: the necromancers' mark at a doorstep. */
function gravePost(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.06, 0.08, h, 0x2e2a33, 4));
  g.add(box(0.5, 0.06, 0.06, 0x2e2a33, 0.2, h - 0.2, 0));
  g.add(box(0.26, 0.34, 0.26, 0x221f27, 0.4, h - 0.62, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(0.1, 0), 0x5cff9a, { emissive: 0x1f9a4a }).translateX(0.4).translateY(h - 0.45));
  const sk = skull(0.35);
  sk.position.set(0, h + 0.12, 0);
  g.add(sk);
  return g;
}

function antlerPole(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.08, 0.11, h, C.timber, 5));
  for (const s of [-1, 1]) {
    const a = box(0.08, 0.9, 0.08, 0xd9cfae, s * 0.3, h - 0.1, 0);
    a.rotation.z = -s * 0.6;
    g.add(a);
    const b = box(0.06, 0.45, 0.06, 0xd9cfae, s * 0.55, h + 0.45, 0);
    b.rotation.z = -s * 0.2;
    g.add(b);
  }
  g.add(blob(0.25, 0x6f9a3a, 0, h - 0.5, 0.12));
  return g;
}

/** A white post carrying the Order's shield, with a lantern: the paladin's mark at a doorstep. */
function shieldPost(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.28, h, 0.28, C.stoneLight));
  g.add(box(0.4, 0.2, 0.4, C.gold, 0, h, 0));
  const arms = heraldry(0.62);
  arms.position.set(0, h * 0.62, 0.2);
  g.add(arms);
  const lamp = glowBit(new THREE.BoxGeometry(0.26, 0.34, 0.26), 0xffe3a0, 0xb07a20);
  lamp.position.set(0, h + 0.4, 0);
  g.add(lamp);
  g.add(cone(0.24, 0.3, C.tile, 4, 0, h + 0.58, 0));
  return g;
}

/** A sun standard for the rally point: a golden sun that turns above blue pennants. */
function sunStandard(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.09, 0.11, h, C.stoneLight, 6));
  g.add(cyl(0.2, 0.2, 0.2, C.gold, 6, 0, h * 0.7));
  const sun = sunDisc(0.9);
  sun.position.set(0, h + 0.6, 0);
  g.add(sun);
  for (const s of [-1, 1]) {
    const p = box(0.9, 0.45, 0.04, 0x2c56b0, s * 0.5, h * 0.75, 0);
    p.userData.flag = true;
    g.add(p);
  }
  return g;
}

/** Horns, antlers or spikes for the mounts at the stable, by theme. */
function dressMount(hg: THREE.Object3D, theme: Theme): void {
  if (theme === 'paladin') {
    // blue barding with a gold hem, and a white plume on the chanfron
    hg.add(box(1.7, 0.42, 0.62, 0x2c56b0, 0, 0.72, 0));
    hg.add(box(1.72, 0.08, 0.64, C.gold, 0, 0.7, 0));
    hg.add(blob(0.16, 0xffffff, 1.1, 2.1, 0, 0.8, 1.4, 0.8));
  } else if (theme === 'sorcerer') {
    const horn = cone(0.07, 0.55, C.gold, 5, 1.32, 1.95, 0);
    horn.rotation.z = -1.1;
    hg.add(horn);
  } else if (theme === 'druid') {
    for (const s of [-1, 1]) {
      const a = box(0.06, 0.6, 0.06, 0xd9cfae, 1.0, 2.1, s * 0.16);
      a.rotation.x = s * 0.5;
      hg.add(a);
      const b = box(0.05, 0.3, 0.05, 0xd9cfae, 1.15, 2.3, s * 0.3);
      b.rotation.x = s * 0.9;
      hg.add(b);
    }
  } else if (theme === 'goblin') {
    for (let i = 0; i < 4; i++) hg.add(cone(0.07, 0.35, 0x3b3530, 4, -0.55 + i * 0.35, 1.2, 0));
  } else if (theme === 'necromancer') {
    // bare ribs and a green eye: the stable keeps bone horses
    for (let i = 0; i < 4; i++) for (const z of [-0.26, 0.26]) hg.add(box(0.1, 0.46, 0.02, 0x2a2424, -0.35 + i * 0.22, 0.97, z));
    for (const z of [-0.15, 0.15]) hg.add(glowBit(new THREE.OctahedronGeometry(0.05, 0), 0x5cff9a, 0x1f9a4a).translateX(1.18).translateY(1.92).translateZ(z));
  }
}

function themedWatchtower(t: number, theme: Theme): Built {
  const g = new THREE.Group();
  const h = 7 + t * 1.6;
  const tw = roundTower(1.35, h, { roof: null });
  g.add(tw);
  // the lookout itself stays: a railed platform near the top
  const py = theme === 'sorcerer' ? h * 0.82 : theme === 'druid' ? h - 0.6 : h * 0.9;
  g.add(cyl(1.75, 1.75, 0.22, theme === 'goblin' ? C.timber : C.timberLight, 8, 0, py, 0));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(0.1, 0.8, 0.1, C.timber, Math.cos(a) * 1.65, py + 0.2, Math.sin(a) * 1.65));
  }
  if (theme === 'sorcerer') {
    // an armillary sphere of gold rings turns round the crystal over the tower
    const arm = new THREE.Group();
    for (const [rx, rz] of [[0, 0], [Math.PI / 2, 0], [Math.PI / 2, Math.PI / 3], [Math.PI / 2, -Math.PI / 3]]) {
      const ring = mesh(new THREE.TorusGeometry(1.2, 0.05, 4, 28), C.gold);
      ring.rotation.set(rx, 0, rz);
      arm.add(ring);
    }
    arm.userData.dynamic = true;
    arm.userData.orbit = 0.5;
    arm.position.set(0, h * 1.12 + 1.35 * 1.5, 0);
    g.add(arm);
  }
  if (theme === 'goblin') {
    const sk = skull(0.9);
    sk.position.set(0, py - 0.9, 1.35);
    g.add(sk);
  }
  if (theme === 'necromancer') {
    const fire = glowBit(new THREE.IcosahedronGeometry(0.5, 0), 0x5cff9a, 0x1f9a4a);
    fire.position.set(0, py + 1.0, 0);
    g.add(fire, cyl(0.55, 0.35, 0.5, 0x2e2a33, 6, 0, py + 0.2, 0));
    // a cloud of bats wheels about the top of the tower
    const flock = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const bat = new THREE.Group();
      bat.add(blob(0.14, 0x1a161c, 0, 0, 0, 0.8, 0.8, 1.2));
      for (const side of [-1, 1]) {
        const wing = new THREE.Group();
        wing.add(box(0.42, 0.03, 0.26, 0x241e26, side * 0.21, 0, 0));
        wing.userData.flap = side;
        bat.add(wing);
      }
      bat.position.set(Math.cos(a) * (2.4 + (i % 2) * 0.8), py + 2.6 + (i % 3) * 0.9, Math.sin(a) * (2.4 + (i % 2) * 0.8));
      bat.rotation.y = -a;
      flock.add(bat);
    }
    flock.userData.dynamic = true;
    flock.userData.orbit = -1.1;
    g.add(flock);
  }
  if (theme === 'paladin') {
    // a belfry over the lookout: four posts, a blue spire and the alarm bell
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      g.add(box(0.16, 2.3, 0.16, C.stoneLight, Math.cos(a) * 1.4, py + 0.2, Math.sin(a) * 1.4));
    }
    g.add(cyl(1.95, 1.95, 0.2, C.gold, 8, 0, py + 2.5, 0));
    g.add(cone(2.1, 3.2, C.tile, 8, 0, py + 2.7, 0));
    g.add(blob(0.22, C.gold, 0, py + 6.1, 0));
    const b = bell(0.9);
    b.position.set(0, py + 2.45, 0);
    g.add(b);
    const flag = box(1.3, 0.8, 0.05, 0x2c56b0, 0.7, py + 6.6, 0);
    flag.userData.flag = true;
    g.add(cyl(0.05, 0.05, 1.3, C.gold, 4, 0, py + 6.1), flag);
  }
  return { obj: g, h: h + 7, w: 4, d: 4 };
}

function themedStatue(theme: Theme): Built {
  const g = new THREE.Group();
  g.add(cyl(2.2, 2.4, 0.4, C.stoneDark, 8));
  g.add(box(2.2, 1.6, 2.2, C.stone, 0, 0.4, 0));
  g.add(box(2.5, 0.25, 2.5, C.stoneLight, 0, 2.0, 0));
  const fig = new THREE.Group();
  const bronze = 0x8d6e3b;
  if (theme === 'paladin') {
    // white marble steps, a gold band, and the gilded knight raising his sword to the light
    g.add(box(2.6, 0.12, 2.6, C.gold, 0, 2.25, 0));
    for (const [x, z] of [[-1.35, 1.35], [1.35, 1.35], [-1.35, -1.35], [1.35, -1.35]]) g.add(cone(0.18, 0.7, C.gold, 4, x, 2.3, z));
    const kn = knightStatue(1.35);
    kn.position.y = 2.37;
    g.add(kn);
    const arms = heraldry(0.7);
    arms.position.set(0, 1.25, 1.12);
    g.add(arms);
    return { obj: g, h: 7.2, w: 5, d: 5 };
  }
  if (theme === 'sorcerer') {
    fig.add(cyl(0.45, 0.75, 2.0, bronze, 8));
    fig.add(blob(0.36, bronze, 0, 2.3, 0));
    fig.add(cyl(0.7, 0.7, 0.08, bronze, 10, 0, 2.55));
    fig.add(cone(0.4, 1.3, bronze, 8, 0, 2.6));
    fig.add(box(0.1, 3.0, 0.1, 0x6e5530, 0.75, 0, 0.1));
    const orb = glowBit(new THREE.IcosahedronGeometry(0.28, 1));
    orb.position.set(0.75, 3.15, 0.1);
    fig.add(orb);
    // three runestones circle him, and the plinth is ringed with runes
    const stones = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const st = mesh(new THREE.BoxGeometry(0.34, 0.6, 0.14), VIO, { emissive: VIO_EMIT });
      st.position.set(Math.cos(a) * 1.7, 0, Math.sin(a) * 1.7);
      st.rotation.y = -a;
      stones.add(st);
    }
    stones.userData.dynamic = true;
    stones.userData.orbit = 0.6;
    stones.userData.bob = 0.2;
    stones.position.y = 4.1;
    g.add(stones);
    g.add(runeRing(1.12, 1.2));
  } else if (theme === 'druid') {
    fig.add(cyl(0.5, 0.75, 2.0, bronze, 8));
    fig.add(cone(0.5, 1.0, bronze, 8, 0, 1.9));
    fig.add(box(0.12, 3.1, 0.12, 0x6e5530, -0.8, 0, 0.1));
    for (const s of [-1, 1]) {
      const a = box(0.07, 0.6, 0.07, 0x6e5530, -0.8 + s * 0.2, 3.1, 0.1);
      a.rotation.z = -s * 0.6;
      fig.add(a);
    }
    fig.add(blob(0.35, 0x6f9a3a, -0.8, 3.2, 0.1));
  } else if (theme === 'necromancer') {
    // a hooded figure of dark bronze, a skull-topped staff burning green
    fig.add(cyl(0.45, 0.8, 2.1, 0x3a3440, 8));
    fig.add(blob(0.42, 0x3a3440, 0, 2.3, -0.05, 1, 1.15, 1));
    fig.add(blob(0.26, 0xd8d0bc, 0, 2.25, 0.22, 1, 1.05, 0.8));
    fig.add(box(0.1, 3.1, 0.1, 0x221c1b, 0.8, 0, 0.1));
    const sk = skull(0.4);
    sk.position.set(0.8, 3.2, 0.1);
    fig.add(sk);
    const fire = glowBit(new THREE.IcosahedronGeometry(0.2, 0), 0x5cff9a, 0x1f9a4a);
    fire.position.set(0.8, 3.55, 0.1);
    fig.add(fire);
    const wisps = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      wisps.add(mesh(new THREE.IcosahedronGeometry(0.16, 1), GHOST, { emissive: GHOST_EMIT }).translateX(Math.cos(a) * 1.7).translateY((i % 2) * 0.6).translateZ(Math.sin(a) * 1.7));
    }
    wisps.userData.dynamic = true;
    wisps.userData.orbit = -0.8;
    wisps.userData.bob = 0.25;
    wisps.position.y = 3.6;
    g.add(wisps);
  } else {
    fig.add(cyl(0.45, 0.55, 1.3, bronze, 7));
    fig.add(blob(0.42, bronze, 0, 1.6, 0));
    for (const s of [-1, 1]) {
      const ear = cone(0.12, 0.6, bronze, 4, s * 0.5, 1.65, 0);
      ear.rotation.z = -s * 1.25;
      fig.add(ear);
    }
    const club = cyl(0.08, 0.2, 1.3, 0x6e5530, 5, 0.6, 0.5, 0.2);
    club.rotation.z = -0.5;
    fig.add(club);
  }
  fig.position.y = 2.25;
  g.add(fig);
  return { obj: g, h: 6.5, w: 5, d: 5 };
}

/** Dress a finished building in the village's theme. */
function themed(id: BuildingId, t: number, b: Built): Built {
  const theme = getTheme();
  if (theme === 'classic' || id === 'main') return b;
  if (id === 'watchtower') return themedWatchtower(t, theme);
  if (id === 'statue') return themedStatue(theme);
  const r = rng(id.length * 31 + t);
  const g = b.obj;
  switch (id) {
    case 'stable':
      g.traverse((o) => { if (o.userData.mount) dressMount(o, theme); });
      break;
    case 'market': {
      if (theme === 'paladin') {
        // a blue pavilion of the Order and a table of relics: gold chalices and candles
        const tent = new THREE.Group();
        tent.add(cyl(1.15, 1.25, 1.6, 0xf3eee2, 10));
        tent.add(cone(1.5, 1.5, 0x2c56b0, 10, 0, 1.6));
        tent.add(blob(0.14, C.gold, 0, 3.15, 0));
        for (let i = 0; i < 10; i += 2) {
          const a = (i / 10) * Math.PI * 2;
          tent.add(box(0.28, 1.58, 0.05, 0x2c56b0, Math.cos(a) * 1.22, 0.01, Math.sin(a) * 1.22).rotateY(-a + Math.PI / 2));
        }
        tent.position.set(3.2, 0, -2.4);
        g.add(tent);
        for (let i = 0; i < 4; i++) g.add(cyl(0.09, 0.05, 0.28, C.gold, 6, -3.4 + i * 0.4, 1.05, 0.2));
        g.add(glowBit(new THREE.BoxGeometry(0.06, 0.16, 0.06), 0xfff0c0, 0xc08a1a).translateX(-1.9).translateY(1.15).translateZ(0.2));
        break;
      }
      const extra = theme === 'sorcerer' ? potions(8, r) : theme === 'druid' ? herbs(4, r) : new THREE.Group();
      extra.position.set(-2.8, 1.05, 0.2);
      g.add(extra);
      if (theme === 'druid') { const m = mushrooms(6, r, 2); m.position.set(3.8, 0, -1.8); g.add(m); }
      if (theme === 'goblin') { const s = skullOnPole(2.8); s.position.set(-4.2, 0, -1.4); g.add(s); g.add(crate(4.2, -2.2), crate(4.0, -1.4)); }
      if (theme === 'necromancer') {
        const pile = new THREE.Group();
        for (let i = 0; i < 5; i++) { const sk = skull(0.32); sk.position.set((i % 3) * 0.36 - 0.36, i < 3 ? 0 : 0.3, (r() - 0.5) * 0.3); pile.add(sk); }
        pile.position.set(-2.8, 1.25, 0.2);
        g.add(pile);
        const p = gravePost(2.8); p.position.set(-4.2, 0, -1.4); g.add(p);
      }
      break;
    }
    case 'workshop':
      if (theme === 'paladin') { const p = shieldPost(3.2); p.position.set(-3.9, 0, 2.6); g.add(p); }
      if (theme === 'sorcerer') { const rc = runeCircle(2.2); rc.position.set(0.5, 0, 0.2); g.add(rc); }
      if (theme === 'druid') for (const [x, z] of [[-3.5, -2], [3.5, -2], [-3.5, 2], [3.5, 2]]) g.add(blob(0.55, 0x6f9a3a, x, 3.5, z, 1, 0.7, 1));
      if (theme === 'goblin') { const s = skullOnPole(3.4); s.position.set(-3.9, 0, 2.6); g.add(s); }
      if (theme === 'necromancer') { const p = gravePost(3.4); p.position.set(-3.9, 0, 2.6); g.add(p); }
      break;
    case 'rally':
      if (theme === 'paladin') { const s = sunStandard(5.2); s.position.set(-1.4, 0, 1.2); g.add(s); }
      if (theme === 'sorcerer') { const rc = runeCircle(1.6); rc.position.set(2.6, 0, 1.6); g.add(rc); const l = arcaneLamp(3.4); l.position.set(-1.4, 0, 1.2); g.add(l); }
      if (theme === 'druid') { const a = antlerPole(3.2); a.position.set(-1.4, 0, 1.2); g.add(a); }
      if (theme === 'goblin') { const s = skullOnPole(3.2); s.position.set(-1.4, 0, 1.2); g.add(s); }
      if (theme === 'necromancer') { const p = gravePost(3.2); p.position.set(-1.4, 0, 1.2); g.add(p); }
      break;
    case 'hiding':
      if (theme === 'paladin') {
        // the cellar is a crypt, sealed with the golden sun
        const seal = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 12), 0xffd35a, { emissive: 0x6a4a10 });
        seal.position.set(0, 0.68, 0.12);
        seal.rotation.x = -0.15;
        g.add(seal);
      }
      if (theme === 'sorcerer') { const rune = glowBit(new THREE.BoxGeometry(0.6, 0.04, 0.6)); rune.position.set(0, 0.66, 0.1); rune.rotation.y = Math.PI / 4; g.add(rune); }
      if (theme === 'druid') g.add(mushrooms(4, r, 2.2));
      if (theme === 'goblin' || theme === 'necromancer') { const sk = skull(0.5); sk.position.set(0.8, 0.8, 0.3); g.add(sk); }
      break;
    case 'barracks':
    case 'smithy':
    case 'academy':
    case 'warehouse':
      // a small banner-post of the theme at the doorstep
      if (theme === 'paladin') { const p = shieldPost(2.4); p.position.set(b.w * 0.42, 0, b.d * 0.42); g.add(p); }
      if (theme === 'druid') { const a = antlerPole(2.6); a.position.set(b.w * 0.42, 0, b.d * 0.42); g.add(a); }
      if (theme === 'goblin') { const s = skullOnPole(2.6); s.position.set(b.w * 0.42, 0, b.d * 0.42); g.add(s); }
      if (theme === 'necromancer') { const p = gravePost(2.6); p.position.set(b.w * 0.42, 0, b.d * 0.42); g.add(p); }
      if (theme === 'sorcerer') { const l = arcaneLamp(2.2); l.position.set(b.w * 0.42, 0, b.d * 0.42); g.add(l); }
      break;
  }
  return b;
}

// ---------- door signs: what each building is, in the village's style ----------

type SignKind = 'barracks' | 'smithy' | 'stable' | 'academy' | 'warehouse';

/** A flat bar lying in the sign's plane (XY), centred at (x, y), turned by `a`. */
function bar(len: number, thick: number, color: number, x: number, y: number, a: number, glow = false): THREE.Mesh {
  const m = glow ? mesh(new THREE.BoxGeometry(thick, len, thick), color, { emissive: 0x5a2fb0 }) : box(thick, len, thick, color);
  if (!glow) m.geometry.translate(0, -len / 2, 0);
  m.position.set(x, y, 0.12);
  m.rotation.z = a;
  return m;
}

/** The board behind the emblem. */
function plaque(theme: Theme): THREE.Group {
  const g = new THREE.Group();
  if (theme === 'paladin') {
    const board = extrude([[-0.62, 0.55], [0.62, 0.55], [0.62, -0.25], [0, -1.0], [-0.62, -0.25]], 0.09, 0x2c56b0);
    g.add(board);
    const rim = extrude([[-0.7, 0.63], [0.7, 0.63], [0.7, -0.28], [0, -1.1], [-0.7, -0.28]], 0.05, C.gold);
    rim.position.z = -0.04;
    g.add(rim);
    return g;
  }
  if (theme === 'sorcerer') {
    const d = cyl(0.62, 0.62, 0.08, 0x3c2470, 16);
    d.rotation.x = Math.PI / 2;
    g.add(d);
    const rim = mesh(new THREE.TorusGeometry(0.62, 0.05, 4, 20), C.gold);
    g.add(rim);
  } else if (theme === 'druid') {
    const d = cyl(0.6, 0.6, 0.12, 0xc9a36a, 12);
    d.rotation.x = Math.PI / 2;
    g.add(d);
    const bark = mesh(new THREE.TorusGeometry(0.6, 0.08, 4, 14), 0x5a3f28);
    g.add(bark);
    const ring = mesh(new THREE.TorusGeometry(0.32, 0.025, 3, 14), 0x9c7a4a);
    ring.position.z = 0.07;
    g.add(ring);
  } else if (theme === 'necromancer') {
    const d = cyl(0.6, 0.6, 0.08, 0x2e2a33, 6);
    d.rotation.x = Math.PI / 2;
    g.add(d);
    const rim = mesh(new THREE.TorusGeometry(0.6, 0.05, 4, 6), 0xd8d0bc);
    g.add(rim);
  } else if (theme === 'goblin') {
    const p = box(1.2, 1.0, 0.08, 0x8a4b24, 0, -0.5, 0);
    p.rotation.z = 0.08;
    g.add(p);
    for (const [x, y] of [[-0.48, 0.38], [0.48, 0.38], [-0.48, -0.38], [0.48, -0.38]]) g.add(blob(0.06, 0x3b3530, x, y, 0.06));
  } else {
    g.add(box(1.25, 1.05, 0.1, C.timberLight, 0, -0.52, 0));
    g.add(box(1.35, 0.1, 0.12, C.timber, 0, 0.5, 0.01), box(1.35, 0.1, 0.12, C.timber, 0, -0.55, 0.01));
  }
  return g;
}

/** The emblem itself: crossed weapons for the barracks, a hammer for the smithy, and so on. */
function signEmblem(kind: SignKind, theme: Theme): THREE.Group {
  const g = new THREE.Group();
  const X = 0.62;
  if (kind === 'barracks') {
    if (theme === 'sorcerer') {
      for (const s of [-1, 1]) {
        g.add(bar(1.45, 0.08, 0x6e4a2a, s * -0.5, 0.52, s * X));
        const orb = mesh(new THREE.IcosahedronGeometry(0.14, 1), 0xb58cff, { emissive: 0x5a2fb0 });
        orb.position.set(s * -0.5, 0.6, 0.14);
        g.add(orb);
      }
    } else if (theme === 'druid') {
      for (const s of [-1, 1]) {
        g.add(bar(1.45, 0.09, 0x5a3f28, s * -0.5, 0.52, s * X));
        g.add(blob(0.16, 0x6f9a3a, s * -0.52, 0.58, 0.14));
        g.add(blob(0.1, 0x4f7a2e, s * -0.36, 0.5, 0.16));
      }
    } else if (theme === 'necromancer') {
      for (const s of [-1, 1]) {
        g.add(bar(1.3, 0.1, 0xd8d0bc, s * -0.45, 0.45, s * X));
        g.add(blob(0.09, 0xd8d0bc, s * -0.45, 0.45, 0.12), blob(0.09, 0xd8d0bc, s * 0.45, -0.45, 0.12));
      }
      const sk = skull(0.42);
      sk.position.set(0, 0.05, 0.22);
      g.add(sk);
    } else if (theme === 'goblin') {
      for (const s of [-1, 1]) {
        g.add(bar(1.3, 0.1, 0x4e3620, s * -0.45, 0.45, s * X));
        const head = cyl(0.13, 0.17, 0.36, 0x4e3620, 5, s * -0.45, 0.35, 0.12);
        head.rotation.z = s * X;
        g.add(head);
        for (const k of [-1, 1]) g.add(cone(0.04, 0.16, 0x3b3530, 4, s * -0.45 + k * 0.14, 0.5, 0.12));
      }
      g.add(blob(0.2, 0xe8dfc8, 0, 0, 0.2));
      g.add(box(0.06, 0.06, 0.04, 0x1a1a1a, -0.07, 0.02, 0.38), box(0.06, 0.06, 0.04, 0x1a1a1a, 0.07, 0.02, 0.38));
    } else {
      for (const s of [-1, 1]) {
        g.add(bar(1.35, 0.07, 0xc9d2d8, s * -0.47, 0.5, s * X));
        const guard = box(0.3, 0.06, 0.06, C.gold, s * 0.33, -0.33, 0.14);
        guard.rotation.z = s * X;
        g.add(guard);
      }
      const sh = cyl(0.26, 0.26, 0.06, C.red, 10, 0, 0, 0.18);
      sh.rotation.x = Math.PI / 2;
      g.add(sh);
    }
  } else if (kind === 'smithy') {
    const metal = theme === 'goblin' ? 0x5c554a : theme === 'sorcerer' ? 0xb58cff : 0xa7b3bb;
    g.add(bar(1.1, 0.08, theme === 'druid' ? 0x5a3f28 : 0x6e4a2a, -0.25, 0.42, 0.55));
    const head = box(0.5, 0.26, 0.16, metal, -0.02, 0.28, 0.14);
    head.rotation.z = 0.55;
    g.add(head);
    g.add(box(0.7, 0.14, 0.14, 0x4c555d, 0, -0.42, 0.12), box(0.3, 0.2, 0.14, 0x4c555d, 0, -0.34, 0.12));
    if (theme === 'druid') g.add(blob(0.14, 0x6f9a3a, 0.35, 0.3, 0.16));
  } else if (kind === 'stable') {
    const col = theme === 'sorcerer' ? C.gold : theme === 'druid' ? 0x8b5a2b : theme === 'goblin' ? 0x8a4b24 : 0xa7b3bb;
    const shoe = mesh(new THREE.TorusGeometry(0.3, 0.07, 4, 12, Math.PI * 1.35), col);
    shoe.rotation.z = -Math.PI * 0.18 + Math.PI;
    shoe.position.set(0, 0.02, 0.14);
    g.add(shoe);
    if (theme === 'druid') for (const s of [-1, 1]) { const a = box(0.05, 0.35, 0.05, 0xd9cfae, s * 0.2, 0.35, 0.16); a.rotation.z = -s * 0.5; g.add(a); }
    if (theme === 'goblin') for (const s of [-1, 1]) g.add(cone(0.04, 0.14, 0x3b3530, 4, s * 0.34, -0.12, 0.16));
  } else if (kind === 'academy') {
    const page = theme === 'goblin' ? 0xc9b98a : 0xf4ecd8;
    for (const s of [-1, 1]) {
      const p = box(0.42, 0.55, 0.05, page, s * 0.22, -0.27, 0.13);
      p.rotation.y = -s * 0.25;
      g.add(p);
    }
    g.add(box(0.06, 0.58, 0.08, theme === 'sorcerer' ? 0x3c2470 : 0x6e4a2a, 0, -0.29, 0.12));
    if (theme === 'sorcerer') { const r = mesh(new THREE.OctahedronGeometry(0.1, 0), 0xb58cff, { emissive: 0x5a2fb0 }); r.position.set(0, 0.28, 0.16); g.add(r); }
    if (theme === 'druid') g.add(blob(0.12, 0x6f9a3a, 0.3, 0.2, 0.16));
    if (theme === 'goblin') g.add(blob(0.12, 0xe8dfc8, 0, 0.22, 0.16));
  } else {
    // warehouse: a fat sack tied at the neck
    g.add(blob(0.3, theme === 'goblin' ? 0x8a6a3e : 0xd8c08a, 0, -0.1, 0.14, 1, 1.1, 0.6));
    g.add(box(0.16, 0.12, 0.1, 0x6e4a2a, 0, 0.26, 0.16));
    g.add(blob(0.1, theme === 'sorcerer' ? 0xb58cff : theme === 'druid' ? 0x6f9a3a : C.gold, 0.26, -0.28, 0.2));
  }
  return g;
}

/** Where each building's sign hangs (above its front door) and how the walls are built there. */
const SIGN_SPOTS: Partial<Record<BuildingId, { h: number; front: number; x?: number; tower?: boolean }>> = {
  barracks: { h: 3, front: 2.5 },
  smithy: { h: 3, front: 2.5 },
  stable: { h: 2.6, front: 2.3 },
  warehouse: { h: 3.6, front: 3.0 },
  academy: { h: 3.3, front: 1.62, x: 6.2, tower: true },
};

function hangSign(id: BuildingId, b: Built, theme: Theme): void {
  const spot = SIGN_SPOTS[id];
  if (!spot) return;
  const sign = new THREE.Group();
  sign.add(plaque(theme), signEmblem(id as SignKind, theme));
  // gabled walls take the sign on the gable; the druids' round cottages under the turf eave
  const y = spot.tower ? spot.h + 0.5 : theme === 'druid' ? spot.h - 0.6 : spot.h + 0.6;
  const z = spot.tower && theme === 'sorcerer' ? 1.45 : spot.front + (theme === 'druid' && !spot.tower ? 0.05 : 0.06);
  sign.position.set(spot.x ?? 0, y, z);
  if (theme === 'druid' && !spot.tower) sign.scale.setScalar(0.8);
  b.obj.add(sign);
}

export { tree };
