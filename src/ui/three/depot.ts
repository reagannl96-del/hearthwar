// The resource cache as a 3D scene: a supply depot inside the wall where the village
// would stand. The hoard sits on a timber platform in the middle of the camp (an open
// strongbox heaped with gold, smaller chests round it), and the stores stand where
// the village's buildings would: timber stacks, pallets of clay brick, bars of iron,
// piles of crates, barrels and sacks, carts, the guards' tents with a fire before them,
// a wooden lookout, and a tall gold banner over the square.
//
// Every cluster stands on a building's plot (LAYOUT), so the battle's paths, which step
// round those plots, never walk the fighting through a crate. Everything is baked into a
// few meshes; only the banners and the fire move.

import * as THREE from 'three';
import type { BuildingId } from '../../engine/types';
import { C, bake, blob, box, cone, cyl, mat, mesh, rng } from './kit';
import { banner, campfire, cart, hayBale, logPile, tent } from './props';
import { LAYOUT } from './scene';

const GOLD = 0xe8b43c, GOLD_DK = 0xa8741a, CRATE = 0xb08452, CRATE_DK = 0x7a5530, IRON = 0x9aa4ae, IRON_DK = 0x6d7782;
const PLANK = 0x8a5f3a, SACK = 0xd9c49a, CANVAS = 0xe9dcc0;

/** A gold coin lying flat (or tipped up a little). */
function coin(x: number, y: number, z: number, tilt = 0): THREE.Mesh {
  const m = cyl(0.26, 0.26, 0.07, GOLD, 8, x, y, z);
  m.rotation.set(tilt, 0, tilt * 0.6);
  return m;
}

/** A heap of gold coins: a low glinting mound with loose coins round its foot. */
function goldHeap(r: number, h: number, rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const heap = mesh(new THREE.ConeGeometry(r, h, 9).translate(0, h / 2, 0), GOLD, { emissive: 0x2a1a00 });
  g.add(heap);
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2, d = r * (0.85 + rand() * 0.5);
    g.add(coin(Math.cos(a) * d, 0.02, Math.sin(a) * d, rand() * 0.5));
  }
  // a few coins on the mound's flanks catch the light
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2, k = 0.3 + rand() * 0.5;
    g.add(coin(Math.cos(a) * r * (1 - k), h * k, Math.sin(a) * r * (1 - k), 0.7));
  }
  return g;
}

/** A strongbox with iron corners and a gold lock; open, its lid thrown back over a heap of gold. */
function chest(s: number, open: boolean, rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const w = 1.6 * s, d = 1.0 * s, h = 0.9 * s;
  g.add(box(w, h, d, C.wood));
  // corner bands and a middle band
  for (const x of [-w / 2 + 0.12 * s, w / 2 - 0.12 * s]) g.add(box(0.14 * s, h + 0.02, d + 0.04, GOLD_DK, x, 0, 0));
  g.add(box(w + 0.04, 0.12 * s, d + 0.04, GOLD_DK, 0, h * 0.45, 0));
  g.add(box(0.3 * s, 0.34 * s, 0.06, GOLD, 0, h * 0.5, d / 2 + 0.02));
  const lid = new THREE.Group();
  const lidGeo = new THREE.CylinderGeometry(d / 2, d / 2, w, 10, 1, false, 0, Math.PI);
  lidGeo.rotateZ(Math.PI / 2);
  const top = mesh(lidGeo, C.woodDark);
  lid.add(top);
  for (const x of [-w / 2 + 0.12 * s, w / 2 - 0.12 * s]) {
    const bandGeo = new THREE.CylinderGeometry(d / 2 + 0.03, d / 2 + 0.03, 0.14 * s, 10, 1, false, 0, Math.PI);
    bandGeo.rotateZ(Math.PI / 2);
    const band = mesh(bandGeo, GOLD_DK);
    band.position.x = x;
    lid.add(band);
  }
  if (open) {
    // hinged at the back, thrown right over
    lid.position.set(0, h, -d / 2);
    top.position.z = d / 2;
    lid.children.forEach((c, i) => { if (i > 0) c.position.z = d / 2; });
    lid.rotation.x = -1.95;
    const heap = goldHeap(w * 0.42, 0.55 * s, rand);
    heap.scale.set(1, 1, d / w + 0.25);
    heap.position.y = h - 0.05;
    g.add(heap);
  } else lid.position.y = h;
  g.add(lid);
  return g;
}

/** A crate with dark slats round its edges. */
function crate(s: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(s, s * 0.92, s, CRATE));
  g.add(box(s + 0.04, s * 0.1, s + 0.04, CRATE_DK, 0, s * 0.85, 0));
  g.add(box(s + 0.04, s * 0.1, s + 0.04, CRATE_DK, 0, 0, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(s * 0.1, s * 0.92, s * 0.1, CRATE_DK, (x * s) / 2, 0, (z * s) / 2));
  return g;
}

/** Crates stacked up: a row of three, two on them, one on top. */
function crateStack(s: number, rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const rows = [3, 2, 1];
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      const c = crate(s);
      c.position.set((i - (n - 1) / 2) * s * 1.04, r * s * 0.93, (rand() - 0.5) * 0.15);
      c.rotation.y = (rand() - 0.5) * 0.12;
      g.add(c);
    }
  });
  return g;
}

/** A pallet of fired clay bricks, stacked in crossing courses. */
function brickPallet(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(3.1, 0.28, 2.1, PLANK));
  const courses = 4 + Math.floor(rand() * 2);
  for (let c = 0; c < courses; c++) {
    const y = 0.28 + c * 0.42;
    const along = c % 2 === 0;
    for (let i = 0; i < 3; i++) {
      const b = along ? box(2.9, 0.38, 0.62, c % 2 ? C.brick : C.clay, 0, y, (i - 1) * 0.68) : box(0.92, 0.38, 1.95, C.clay, (i - 1) * 0.98, y, 0);
      g.add(b);
    }
  }
  return g;
}

/** Bars of iron laid in crossing courses. */
function ingotStack(courses: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.2, 0.22, 2.2, PLANK));
  for (let c = 0; c < courses; c++) {
    const y = 0.22 + c * 0.32;
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.CylinderGeometry(0.2, 0.26, 2, 4, 1);
      bar.rotateY(Math.PI / 4);
      bar.rotateZ(Math.PI / 2);
      if (c % 2) bar.rotateY(Math.PI / 2);
      bar.translate(c % 2 ? (i - 1.5) * 0.5 : 0, y + 0.16, c % 2 ? 0 : (i - 1.5) * 0.5);
      g.add(mesh(bar, i % 2 ? IRON : IRON_DK));
    }
  }
  return g;
}

/** A barrel with iron hoops. */
function barrel(s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.5 * s, 0.44 * s, 1.2 * s, 0x8c5a2e, 9));
  g.add(cyl(0.52 * s, 0.52 * s, 0.1 * s, IRON_DK, 9, 0, 0.25 * s));
  g.add(cyl(0.52 * s, 0.52 * s, 0.1 * s, IRON_DK, 9, 0, 0.88 * s));
  return g;
}

/** A tied grain sack. */
function sack(): THREE.Group {
  const g = new THREE.Group();
  g.add(blob(0.55, SACK, 0, 0.5, 0, 1, 1.05, 0.85, 1));
  g.add(cyl(0.12, 0.2, 0.3, 0xb8a276, 6, 0, 0.98, 0));
  return g;
}

/** A timber platform with steps, for the great chest in the middle of the camp. */
function platform(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.5, d, PLANK));
  for (let i = 0; i < Math.round(w / 0.9); i++) g.add(box(0.06, 0.02, d, 0x6e4a2a, -w / 2 + (i + 0.5) * (w / Math.round(w / 0.9)), 0.5, 0));
  g.add(box(2.2, 0.25, 0.8, PLANK, 0, 0, d / 2 + 0.4));
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) g.add(box(0.3, 0.62, 0.3, 0x5d3a1c, x, 0, z));
  return g;
}

/** A wooden lookout on four legs, with a railing and a little roof. */
function lookout(): THREE.Group {
  const g = new THREE.Group();
  const H = 6.2;
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
    const leg = box(0.22, H + 1.6, 0.22, C.timber, x, 0, z);
    g.add(leg);
  }
  for (const y of [1.8, 3.9]) {
    g.add(box(2.4, 0.14, 0.14, C.timberLight, 0, y, 1.1));
    g.add(box(2.4, 0.14, 0.14, C.timberLight, 0, y, -1.1));
  }
  g.add(box(2.9, 0.22, 2.9, PLANK, 0, H, 0));
  for (const s of [-1, 1]) {
    g.add(box(2.9, 0.1, 0.1, C.timberLight, 0, H + 0.9, s * 1.4));
    g.add(box(0.1, 0.1, 2.9, C.timberLight, s * 1.4, H + 0.9, 0));
  }
  g.add(cone(2.3, 1.3, C.thatch, 4, 0, H + 1.6, 0).rotateY(Math.PI / 4));
  // a ladder up the front
  g.add(box(0.08, H, 0.08, C.woodDark, -0.35, 0, 1.5));
  g.add(box(0.08, H, 0.08, C.woodDark, 0.35, 0, 1.5));
  for (let i = 1; i < 9; i++) g.add(box(0.7, 0.06, 0.06, C.woodDark, 0, (i * H) / 9, 1.5));
  return g;
}

/** A weapon rack of spears. */
function spearRack(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.2, 0.12, 0.12, C.woodDark, 0, 1.1, 0));
  g.add(box(0.12, 1.3, 0.12, C.woodDark, -1, 0, 0));
  g.add(box(0.12, 1.3, 0.12, C.woodDark, 1, 0, 0));
  for (let i = 0; i < 5; i++) {
    const x = -0.8 + i * 0.4;
    const shaft = box(0.06, 2.4, 0.06, C.wood, x, 0, 0.1);
    shaft.rotation.x = -0.14;
    g.add(shaft);
    g.add(cone(0.08, 0.3, IRON, 4, x, 2.35, -0.22));
  }
  return g;
}

function at(g: THREE.Group, o: THREE.Object3D, x: number, z: number, ry = 0, s = 1): void {
  o.position.set(x, o.position.y, z);
  o.rotation.y += ry;
  if (s !== 1) o.scale.multiplyScalar(s);
  g.add(o);
}

/** The stores are laid out small and set down this much bigger, to stand as tall as the village's houses would. */
const K = 1.5;

/** A cluster set down on a building's plot, turned the way that building faces. */
function plot(g: THREE.Group, id: BuildingId, fill: (c: THREE.Group) => void, k = K): void {
  const c = new THREE.Group();
  fill(c);
  const [x, z, ry] = LAYOUT[id];
  c.position.set(x, 0, z);
  c.rotation.y = ry;
  c.scale.setScalar(k);
  g.add(c);
}

/** A small stockpile out by the wall, at an angle (degrees) and distance from the middle. */
function stockpile(g: THREE.Group, deg: number, r: number, kind: number, rand: () => number): void {
  const c = new THREE.Group();
  if (kind === 0) {
    for (const [x, z] of [[-0.6, 0], [0.5, -0.3], [0, 0.8]]) at(c, barrel(), x, z);
    at(c, sack(), 1.3, 0.8, rand() * 3);
  } else if (kind === 1) {
    at(c, crate(1.3), 0, 0, rand());
    at(c, crate(1.1), 1.4, 0.3, rand());
    const top = crate(1); top.position.y = 1.2; at(c, top, 0.1, 0.1, rand());
  } else if (kind === 2) {
    at(c, logPile(4), 0, 0, 0, 1.3);
  } else {
    at(c, brickPallet(rand), 0, 0, 0, 0.8);
    at(c, sack(), 1.9, 0.6, rand() * 3);
  }
  const a = (deg * Math.PI) / 180;
  c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  c.rotation.y = -a + Math.PI / 2;
  c.scale.setScalar(1.3);
  g.add(c);
}

/**
 * The whole depot, centred on the village's middle. `bannerColor` is the colour of the
 * pennants (gold for a cache: it belongs to nobody).
 */
export function buildDepot(bannerColor = GOLD, seed = 5): THREE.Group {
  const g = new THREE.Group();
  const r = rng(seed);

  // the hoard: a great open strongbox on a platform, smaller chests and heaps of gold round it
  plot(g, 'main', (c) => {
    at(c, platform(9.5, 7), 0, 0);
    const big = chest(2.4, true, r);
    big.position.y = 0.52;
    at(c, big, 0, -0.6);
    for (const [x, z, ry, open] of [[-3.3, 1.2, 0.5, false], [3.4, 1.0, -0.4, true], [-3.0, -2.2, 0.2, true]] as [number, number, number, boolean][]) {
      const ch = chest(1.1, open, r);
      ch.position.y = 0.52;
      at(c, ch, x, z, ry);
    }
    const h1 = goldHeap(1.3, 0.8, r); h1.position.y = 0.52; at(c, h1, 2.6, -2.2);
    const h2 = goldHeap(0.9, 0.55, r); h2.position.y = 0.52; at(c, h2, 0.4, 2.3);
    at(c, sack(), -4.3, -2.8);
    at(c, barrel(0.9), 4.2, -2.6);
  });

  // a tall banner over the square, where the village would raise its statue
  plot(g, 'statue', (c) => {
    c.add(cyl(1.3, 1.6, 0.6, C.stoneDark, 8));
    const pole = banner(bannerColor, 9);
    pole.position.y = 0.6;
    pole.scale.setScalar(2.1);
    c.add(pole);
    c.add(blob(0.45, GOLD, 0, 0.6 + 9 * 2.1 + 0.3, 0));
  }, 1);

  // the guards' tents, a fire before them and their spears racked
  plot(g, 'barracks', (c) => {
    at(c, tent(0xb3332a, CANVAS), -2.1, -0.8, 0, 1.6);
    at(c, tent(0xd9a441, CANVAS), 2.2, -1.4, 0.4, 1.5);
    at(c, campfire(), 0.2, 2.6, 0, 1.3);
    at(c, spearRack(), -1.6, 4.4, 0.2);
  });
  plot(g, 'stable', (c) => {
    at(c, cart(C.wood), -1.8, -1.2, 0.3, 1.7);
    at(c, cart(0x7a5230), 2.0, 2.0, -0.9, 1.7);
    at(c, hayBale(0, 0, 0), -3.8, 2.6, 0.6);
    at(c, hayBale(0, 0, 0), -3.1, 3.8, 1.3);
    // a load of crates on the first cart
    const load = crate(0.8); load.position.y = 1.25; at(c, load, -2.1, -1.2, 0.3);
  });

  // the stores: timber, clay, iron, crates, barrels and sacks
  plot(g, 'workshop', (c) => {
    at(c, logPile(6), -1.4, -1.2, 0, 1.5);
    at(c, logPile(5), 1.8, 1.2, 0.3, 1.4);
    at(c, logPile(3), -1.8, 2.4, -0.2, 1.2);
  });
  plot(g, 'academy', (c) => {
    at(c, brickPallet(r), -2.6, -1.8, 0);
    at(c, brickPallet(r), 1.2, -2.4, 0.15);
    at(c, brickPallet(r), -0.8, 2.2, -0.1);
    at(c, brickPallet(r), 3.2, 1.6, 0.05);
  });
  plot(g, 'smithy', (c) => {
    at(c, ingotStack(5), -1.8, -0.8, 0.1);
    at(c, ingotStack(4), 1.8, 0.6, -0.2);
    at(c, ingotStack(3), -0.4, 3.0, 0.3);
  });
  plot(g, 'warehouse', (c) => {
    at(c, crateStack(1.35, r), -1.8, -1.2, 0.1);
    at(c, crateStack(1.2, r), 2.2, 1.6, -0.3);
  });
  plot(g, 'market', (c) => {
    for (const [x, z] of [[-1.6, -1], [-0.6, -1.5], [-1.1, 0], [0.8, -0.6]]) at(c, barrel(), x, z);
    for (const [x, z] of [[1.8, 1.4], [0.6, 1.8], [2.4, 0.3]]) at(c, sack(), x, z, r() * 3);
  });
  plot(g, 'rally', (c) => {
    at(c, crate(1.2), -0.8, 0, 0.3);
    at(c, barrel(), 1.1, 0.4);
    const top = crate(0.9); top.position.y = 1.1; at(c, top, -0.8, 0, 0.9);
  });
  plot(g, 'hiding', (c) => {
    const ch = chest(0.9, false, r);
    at(c, ch, 0, 0, 0.2);
  });
  plot(g, 'watchtower', (c) => {
    at(c, lookout(), 0, 0);
    const flag = banner(bannerColor, 4);
    flag.position.y = 7.9;
    at(c, flag, 1.1, -1.1);
  });

  // stockpiles out by the wall, between the plots and clear of the gate
  [[-8, 0], [-58, 1], [-122, 2], [-168, 3], [40, 1], [100, 0], [146, 2]].forEach(([deg, kind], i) => stockpile(g, deg, 32 + (i % 2) * 1.5, kind, r));

  const out = bake(g, { depot: true });
  // the treasure glints: an emissive touch on the gold so it reads even at dusk
  out.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material === mat(GOLD)) m.material = mat(GOLD, { emissive: 0x2a1a00 });
  });
  return out;
}
