// Building models by level. Every builder returns a group standing on y=0,
// facing +Z, plus its footprint and the height where the level badge goes.

import * as THREE from 'three';
import type { BuildingId } from '../../engine/types';
import { C, blob, box, cone, cyl, darker, house, mesh, rng, roundTower } from './kit';
import {
  anvil, banner, barrel, campfire, cart, catapult, crate, dummy, fence, hayBale, horse, logPile, pumpkin, ram, rock,
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
  const r = rng(id.length * 131 + t * 17);
  switch (id) {
    case 'main': return mainHall(t, color);
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

export { tree };
