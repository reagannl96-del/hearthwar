// Building models by level. Every builder returns a group standing on y=0,
// facing +Z, plus its footprint and the height where the level badge goes.

import * as THREE from 'three';
import type { BuildingId } from '../../engine/types';
import { C, blob, box, cone, cyl, darker, getTheme, house, mesh, rng, roundTower, type Theme } from './kit';
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
  return b;
}

function baseModel(id: BuildingId, t: number, color: number): Built {
  const r = rng(id.length * 131 + t * 17);
  switch (id) {
    case 'main': {
      const th = getTheme();
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
  if (theme === 'classic') return b;
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

function timberCamp(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const n = 14 - Math.min(6, t);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = 5 + r() * 6;
    const tr = tree(r() < 0.35 ? 'pine' : r() < 0.2 ? 'birch' : 'oak', r, 1.05);
    tr.position.set(Math.cos(a) * d, 0, Math.sin(a) * d - 2);
    g.add(tr);
  }
  const piles = Math.min(4, 1 + Math.floor(t / 2));
  for (let i = 0; i < piles; i++) {
    const p = logPile(3 + Math.min(3, t));
    p.position.set(-2 + i * 2.2, 0, 2 + (i % 2) * 1.4);
    p.rotation.y = 0.2 * i;
    g.add(p);
  }
  const s = stump();
  s.position.set(2.8, 0, -0.5);
  g.add(s);
  if (t >= 2) {
    const hut = house({ w: 4.5, d: 3.6, h: 2.3, roofH: 1.8, roof: C.thatch, windows: 1 });
    hut.position.set(-4, 0, -2.6);
    hut.rotation.y = 0.4;
    g.add(hut);
  }
  if (t >= 4) g.add(cart().translateX(4.5).translateZ(3));
  return { obj: g, h: 6, w: 10, d: 10 };
}

function clayPit(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const pit = cyl(4.6, 3.6, 0.35, C.clay, 10, 0, -0.2);
  pit.scale.set(1.3, 1, 1);
  g.add(pit);
  g.add(cyl(3.4, 2.8, 0.2, C.clayDark, 10, 0, 0.05).translateY(0));
  const stacks = Math.min(6, t + 1);
  for (let i = 0; i < stacks; i++) {
    const st = new THREE.Group();
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) st.add(box(0.5, 0.26, 0.9, i % 2 ? C.brick : darker(C.brick, 1.1), x * 0.55 - 0.55, y * 0.27, 0));
    st.position.set(6.4 + (i % 2) * 1.8, 0, -2 + Math.floor(i / 2) * 1.6);
    g.add(st);
  }
  for (let i = 0; i < 3; i++) g.add(rock(r, 0.7, C.clayDark).translateX(-5 + r() * 2).translateZ(-3 + i * 2.5));
  if (t >= 3) {
    const hut = house({ w: 4.2, d: 3.4, h: 2.2, roofH: 1.7, roof: C.tileWarm, windows: 1 });
    hut.position.set(-6.5, 0, 3.4);
    hut.rotation.y = 0.8;
    g.add(hut);
  }
  if (t >= 2) {
    const c = cart();
    c.position.set(3.2, 0, 4.4);
    c.rotation.y = 0.6;
    g.add(c);
  }
  return { obj: g, h: 4, w: 12, d: 10 };
}

function ironMine(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const hill = [
    [0, 0, -3, 5.5, 4.2], [-5, 0, -1.5, 4, 3], [5, 0, -2, 4.5, 3.4], [-2, 0, -6, 5, 5.5], [3.5, 0, -6.5, 4.5, 4.6],
  ];
  for (const [x, , z, s, h] of hill) {
    const m = blob(s, r() < 0.5 ? C.rock : C.rockDark, x, h * 0.35, z, 1.1, h / s, 1.0);
    m.rotation.y = r() * 3;
    g.add(m);
  }
  if (t >= 1) {
    const ent = new THREE.Group();
    ent.add(box(2.6, 2.8, 0.6, C.dark));
    ent.add(box(0.35, 3.0, 0.35, C.timber, -1.4, 0, 0.3), box(0.35, 3.0, 0.35, C.timber, 1.4, 0, 0.3));
    ent.add(box(3.4, 0.4, 0.4, C.timber, 0, 3.0, 0.3));
    ent.position.set(0, 0, 1.5);
    g.add(ent);
    for (const x of [-0.5, 0.5]) g.add(box(0.1, 0.08, 6, C.iron, x, 0.05, 4.6));
    const cartG = new THREE.Group();
    cartG.add(box(1.2, 0.7, 1.4, C.woodDark, 0, 0.25, 0));
    cartG.add(blob(0.5, C.iron, 0, 1.0, 0, 1.2, 0.6, 1.2));
    cartG.position.set(0, 0, 5.4);
    g.add(cartG);
  }
  if (t >= 3) {
    const lamp = new THREE.Group();
    lamp.add(box(0.1, 2, 0.1, C.woodDark));
    const l = box(0.3, 0.4, 0.3, C.flame, 0, 2, 0);
    l.material = new THREE.MeshBasicMaterial({ color: C.flame });
    lamp.add(l);
    lamp.position.set(-2, 0, 2.4);
    g.add(lamp);
    const hut = house({ w: 4, d: 3.2, h: 2.2, roofH: 1.6, roof: C.slate, windows: 1 });
    hut.position.set(4.6, 0, 3.4);
    hut.rotation.y = -0.5;
    g.add(hut);
  }
  for (let i = 0; i < 5; i++) g.add(rock(r, 0.8).translateX(-6 + r() * 12).translateZ(2 + r() * 4));
  return { obj: g, h: 8, w: 12, d: 12 };
}

function farm(t: number, r: () => number): Built {
  const g = new THREE.Group();
  const fh = house({ w: 5.5, d: 4.2, h: 2.6, roofH: 2.2, roof: C.thatch, windows: 1 });
  g.add(fh);
  const fields = Math.min(8, t + 1);
  const spots: [number, number][] = [[-8, -6], [0, -8], [8, -6], [-9, 3], [9, 3], [-4, -15], [5, -15], [13, -12]];
  for (let i = 0; i < fields; i++) {
    const f = wheatField(6.5, 5, r, i % 3 !== 2);
    f.position.set(spots[i][0], 0, spots[i][1]);
    f.rotation.y = (r() - 0.5) * 0.3;
    g.add(f);
  }
  for (let i = 0; i < Math.min(5, 1 + t); i++) g.add(hayBale(4 + r() * 3, 3 + r() * 3, r() * 3));
  for (let i = 0; i < 4; i++) g.add(pumpkin(-4 - r() * 2, 3 + r() * 2, 0.9 + r() * 0.3));
  if (t >= 3) {
    const wm = windmill();
    wm.group.position.set(-13, 0, -4);
    wm.group.rotation.y = 0.6;
    g.add(wm.group);
  }
  const f2 = fence(10);
  f2.position.set(0, 0, 4.4);
  g.add(f2);
  return { obj: g, h: 6, w: 8, d: 8 };
}

// ---------- hero headquarters ----------

const MOSS = 0x5e7d32, MOSS_DK = 0x445c24, BARK = 0x5a3f28, BARK_DK = 0x3f2c1c, LEAF = 0x4f7a2e, LEAF_LT = 0x6f9a3a, MENHIR = 0x8e9a80;

/** A round window that glows at night. */
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
  const trunkR = [0, 1.7, 2.2, 2.8, 3.3, 3.7][t];
  const trunkH = [0, 2.8, 4.6, 6.2, 7.6, 9][t];
  // the trunk, flared at the roots
  g.add(cyl(trunkR * 0.85, trunkR * 1.15, trunkH, BARK, 9));
  if (t >= 2) {
    for (let i = 0; i < 5 + t; i++) {
      const a = (i / (5 + t)) * Math.PI * 2 + 0.3;
      const root = box(0.5 + t * 0.12, 0.7 + t * 0.15, trunkR * 0.9, BARK_DK, Math.cos(a) * trunkR * 0.95, 0, Math.sin(a) * trunkR * 0.95);
      root.rotation.y = -a + Math.PI / 2;
      g.add(root);
    }
  }
  // doorway and glowing windows
  g.add(box(1.1, 1.9, 0.3, C.door, 0, 0, trunkR * 1.02));
  g.add(blob(0.62, BARK_DK, 0, 1.9, trunkR * 1.0, 1, 0.5, 0.35));
  for (let i = 0; i < t; i++) {
    const a = Math.PI / 2 + (i % 2 === 0 ? 0.7 : -0.7);
    g.add(glowWindow(Math.cos(a) * trunkR * 0.98, 2.6 + i * 1.3, Math.sin(a) * trunkR * 0.98, Math.PI / 2 - a));
  }
  if (t === 1) {
    // a stump with a mossy cap
    g.add(blob(2.1, MOSS, 0, trunkH + 0.2, 0, 1, 0.45, 1));
    g.add(blob(0.5, LEAF_LT, 1.1, trunkH + 0.7, 0.3));
    return { obj: g, h: 5.5, w: 5, d: 5 };
  }
  // the crown of leaves
  const crown = [0, 0, 3.4, 4.6, 5.8, 6.8][t];
  const blobs = 3 + t * 2;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2;
    const rr = crown * (0.35 + r() * 0.35);
    g.add(blob(crown * (0.42 + r() * 0.15), r() < 0.5 ? LEAF : LEAF_LT, Math.cos(a) * rr, trunkH + crown * 0.35 + r() * crown * 0.4, Math.sin(a) * rr * 0.8, 1, 0.75, 1, 1));
  }
  g.add(blob(crown * 0.6, LEAF, 0, trunkH + crown * 0.85, 0, 1, 0.7, 1, 1));
  // platforms ringing the trunk
  if (t >= 3) {
    for (let k = 0; k < t - 2; k++) {
      const y = 3.2 + k * 2.6;
      g.add(cyl(trunkR + 1.3, trunkR + 1.3, 0.25, C.timberLight, 12, 0, y, 0));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.add(box(0.12, 0.8, 0.12, C.timber, Math.cos(a) * (trunkR + 1.2), y + 0.25, Math.sin(a) * (trunkR + 1.2)));
      }
      const lamp = blob(0.2, 0xffd27a, trunkR + 1.2, y + 1.2, 0.3);
      lamp.userData.window = true;
      g.add(lamp);
    }
  }
  // moss-roofed huts at the roots
  if (t >= 3) {
    for (const s of t >= 4 ? [-1, 1] : [-1]) {
      const hut = house({ w: 3.2, d: 2.8, h: 1.8, roofH: 1.6, roof: MOSS, windows: 1 });
      hut.position.set(s * (trunkR + 2.6), 0, 1.2);
      hut.rotation.y = s * -0.4;
      g.add(hut);
    }
  }
  // standing stones and hanging vines on the oldest trees
  if (t >= 4) {
    const ring = trunkR + 4.4;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2;
      if (Math.sin(a) > 0.75) continue; // keep the doorway open
      const st = box(0.55, 1.8 + r() * 0.8, 0.4, MENHIR, Math.cos(a) * ring, 0, Math.sin(a) * ring * 0.85);
      st.rotation.y = -a;
      g.add(st);
    }
  }
  if (t >= 5) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const len = 2 + r() * 2.5;
      g.add(box(0.08, len, 0.08, MOSS_DK, Math.cos(a) * crown * 0.7, trunkH + crown * 0.2 - len, Math.sin(a) * crown * 0.55));
    }
  }
  const h = trunkH + crown * 1.3;
  const span = Math.max(crown * 2, (trunkR + 4.6) * 2 * (t >= 4 ? 1 : 0.6));
  return { obj: g, h, w: span, d: span * 0.85 };
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
  if (t <= 2) {
    g.add(goblinTent(t === 1 ? 2.4 : 3, r));
    if (t === 2) {
      const t2 = goblinTent(2, r);
      t2.position.set(-4.2, 0, -0.8);
      g.add(t2);
      for (let i = -4; i <= 4; i++) {
        const st = cone(0.18, 1.6 + r() * 0.6, JUNK_WOOD, 4, i * 1.05, 0, 3.6 + Math.abs(i) * 0.12);
        st.rotation.x = 0.25;
        st.rotation.z = (r() - 0.5) * 0.3;
        g.add(st);
      }
    }
    const fire = campfire();
    fire.position.set(2.6, 0, 2.4);
    g.add(fire);
    const b = new THREE.Group();
    b.add(cyl(0.08, 0.08, 3.4, JUNK_WOOD, 4));
    b.add(box(1.1, 0.7, 0.05, RAG, 0.6, 2.6, 0));
    b.position.set(3, 0, -1.2);
    g.add(b);
    return { obj: g, h: t === 1 ? 5 : 6, w: t === 1 ? 7 : 11, d: t === 1 ? 6 : 8 };
  }
  // the lopsided fort
  const fw = t === 3 ? 8 : 9.5, fd = t === 3 ? 6.5 : 7.5, fh = t === 3 ? 3.6 : 4.2;
  const fort = new THREE.Group();
  fort.add(box(fw, fh, fd, JUNK_WOOD));
  for (let i = 0; i < 6; i++) fort.add(box(0.2, fh + 0.3, 0.12, 0x2f2012, -fw / 2 + 0.6 + i * ((fw - 1.2) / 5), 0, fd / 2 + 0.05));
  // rusted plate roof, crooked
  for (let i = 0; i < 4; i++) {
    const p = box(fw / 4 + 0.5, 0.2, fd + 0.8, i % 2 ? RUST : RUST_DK, -fw / 2 + fw / 8 + i * (fw / 4), fh + 0.4 + (r() - 0.5) * 0.4, 0);
    p.rotation.x = (r() - 0.5) * 0.25;
    p.rotation.z = (r() - 0.5) * 0.3;
    fort.add(p);
  }
  fort.add(box(1.4, 2.2, 0.25, 0x241a12, 0, 0, fd / 2 + 0.1));
  const s1 = skull(1.1);
  s1.position.set(0, 2.9, fd / 2 + 0.3);
  fort.add(s1);
  fort.rotation.z = 0.03;
  g.add(fort);
  // spikes along the roof edge
  for (let i = 0; i < 7; i++) {
    const sp = cone(0.14, 1.1, 0x3b3530, 4, -fw / 2 + 0.5 + i * ((fw - 1) / 6), fh + 0.5, fd / 2 + 0.3);
    sp.rotation.x = 0.7;
    g.add(sp);
  }
  // a teetering junk tower (or two)
  const tower = (x: number, z: number, levels: number) => {
    const tw = new THREE.Group();
    let y = 0;
    for (let i = 0; i < levels; i++) {
      const s = 2.6 - i * 0.35;
      const lvl = box(s, 1.8, s, i % 2 ? JUNK_WOOD : 0x5e4428, (r() - 0.5) * 0.4, y, (r() - 0.5) * 0.4);
      lvl.rotation.y = (r() - 0.5) * 0.4;
      tw.add(lvl);
      y += 1.8;
    }
    tw.add(cone(1.5, 1.6, RUST, 4, 0, y, 0).rotateY(0.4));
    const fl = new THREE.Group();
    fl.add(cyl(0.06, 0.06, 2, JUNK_WOOD, 4));
    fl.add(box(1, 0.6, 0.05, RAG, 0.55, 1.4, 0));
    fl.position.set(0, y + 1.3, 0);
    tw.add(fl);
    tw.position.set(x, 0, z);
    g.add(tw);
    return y + 3.2;
  };
  let h = fh + 2.5;
  if (t >= 4) h = Math.max(h, tower(-fw / 2 - 1.8, -1.2, 4));
  if (t >= 5) h = Math.max(h, tower(fw / 2 + 1.8, -1.6, 5));
  if (t >= 5) {
    // the great skull gate in front
    const gate = new THREE.Group();
    gate.add(box(0.5, 4.2, 0.5, JUNK_WOOD, -2.2, 0, 0));
    gate.add(box(0.5, 4.2, 0.5, JUNK_WOOD, 2.2, 0, 0));
    gate.add(box(5.2, 0.5, 0.6, JUNK_WOOD, 0, 4, 0));
    const big = skull(2.4);
    big.position.set(0, 5.6, 0);
    gate.add(big);
    gate.position.set(0, 0, fd / 2 + 2.6);
    g.add(gate);
  }
  const bn = new THREE.Group();
  bn.add(cyl(0.08, 0.08, 3.6, JUNK_WOOD, 4));
  bn.add(box(1.2, 0.8, 0.05, RAG, 0.65, 2.7, 0));
  bn.position.set(fw / 2 - 0.6, 0, fd / 2 + 1.2);
  g.add(bn);
  const fire = campfire();
  fire.position.set(-fw / 2 + 0.8, 0, fd / 2 + 1.6);
  g.add(fire);
  return { obj: g, h, w: fw + (t >= 4 ? 5 : 0) + (t >= 5 ? 4 : 0), d: fd + (t >= 5 ? 5.5 : 1.5) };
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

/** Horns, antlers or spikes for the mounts at the stable, by theme. */
function dressMount(hg: THREE.Object3D, theme: Theme): void {
  if (theme === 'sorcerer') {
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
    const orb = glowBit(new THREE.IcosahedronGeometry(0.45, 1));
    orb.position.set(0, py + 1.2, 0);
    g.add(orb);
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
  if (theme === 'sorcerer') {
    fig.add(cyl(0.45, 0.75, 2.0, bronze, 8));
    fig.add(blob(0.36, bronze, 0, 2.3, 0));
    fig.add(cyl(0.7, 0.7, 0.08, bronze, 10, 0, 2.55));
    fig.add(cone(0.4, 1.3, bronze, 8, 0, 2.6));
    fig.add(box(0.1, 3.0, 0.1, 0x6e5530, 0.75, 0, 0.1));
    const orb = glowBit(new THREE.IcosahedronGeometry(0.28, 1));
    orb.position.set(0.75, 3.15, 0.1);
    fig.add(orb);
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
      if (theme === 'sorcerer') { const rc = runeCircle(2.2); rc.position.set(0.5, 0, 0.2); g.add(rc); }
      if (theme === 'druid') for (const [x, z] of [[-3.5, -2], [3.5, -2], [-3.5, 2], [3.5, 2]]) g.add(blob(0.55, 0x6f9a3a, x, 3.5, z, 1, 0.7, 1));
      if (theme === 'goblin') { const s = skullOnPole(3.4); s.position.set(-3.9, 0, 2.6); g.add(s); }
      if (theme === 'necromancer') { const p = gravePost(3.4); p.position.set(-3.9, 0, 2.6); g.add(p); }
      break;
    case 'rally':
      if (theme === 'sorcerer') { const rc = runeCircle(1.6); rc.position.set(2.6, 0, 1.6); g.add(rc); }
      if (theme === 'druid') { const a = antlerPole(3.2); a.position.set(-1.4, 0, 1.2); g.add(a); }
      if (theme === 'goblin') { const s = skullOnPole(3.2); s.position.set(-1.4, 0, 1.2); g.add(s); }
      if (theme === 'necromancer') { const p = gravePost(3.2); p.position.set(-1.4, 0, 1.2); g.add(p); }
      break;
    case 'hiding':
      if (theme === 'sorcerer') { const rune = glowBit(new THREE.BoxGeometry(0.6, 0.04, 0.6)); rune.position.set(0, 0.66, 0.1); rune.rotation.y = Math.PI / 4; g.add(rune); }
      if (theme === 'druid') g.add(mushrooms(4, r, 2.2));
      if (theme === 'goblin' || theme === 'necromancer') { const sk = skull(0.5); sk.position.set(0.8, 0.8, 0.3); g.add(sk); }
      break;
    case 'barracks':
    case 'smithy':
    case 'academy':
    case 'warehouse':
      // a small banner-post of the theme at the doorstep
      if (theme === 'druid') { const a = antlerPole(2.6); a.position.set(b.w * 0.42, 0, b.d * 0.42); g.add(a); }
      if (theme === 'goblin') { const s = skullOnPole(2.6); s.position.set(b.w * 0.42, 0, b.d * 0.42); g.add(s); }
      if (theme === 'necromancer') { const p = gravePost(2.6); p.position.set(b.w * 0.42, 0, b.d * 0.42); g.add(p); }
      if (theme === 'sorcerer') { const cr = glowBit(new THREE.OctahedronGeometry(0.3, 0)); cr.scale.set(1, 2, 1); cr.position.set(b.w * 0.42, 1.6, b.d * 0.42); g.add(cr); g.add(cyl(0.25, 0.35, 0.9, C.stone, 6, b.w * 0.42, 0, b.d * 0.42)); }
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
