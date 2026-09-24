// Scenery and small props, all built from primitives.

import * as THREE from 'three';
import {
  BLOOD, BLOSSOM, BLOSSOM_W, BONE_SH, BONE_W, C, EMBER, EMBER_E, HIDE_C, HIDE_DK, IRON_BK, LEAF_MID, LEAF_SUN, ORC_SKIN, ORC_SKIN_DK, ROPE, SOCKET,
  blob, box, branch, cone, cyl, darker, detailMat, druidCanopy, fireflies, getSeason, getTheme, gnarledTrunk, horn, hornPair, leafCluster, limb, mesh, orcSkull, type Theme,
} from './kit';
import { runeStone, toadstools } from './grove';

const AUTUMN = [C.leafOrange, C.leafRed, C.leafYellow, C.leafGold, C.leafOrange, C.leafGreen];

export function tree(kind: 'oak' | 'pine' | 'birch', r: () => number, scale = 1, detail = 1): THREE.Group {
  const g = new THREE.Group();
  if (getSeason() === 'volcanic') {
    // a charred snag: black trunk, a few bare branches, embers still glowing in the bark
    const h = kind === 'pine' ? 3.2 : 2.6;
    g.add(cyl(0.14, 0.3, h, 0x241c19, 5));
    for (let i = 0; i < 3; i++) {
      const b = cyl(0.05, 0.1, 1.1 + r() * 0.6, 0x2c2320, 4);
      b.position.set(0, h * (0.45 + i * 0.18), 0);
      b.rotation.set((r() - 0.5) * 1.6, r() * Math.PI * 2, 0.7 + r() * 0.5);
      g.add(b);
    }
    if (r() < 0.4) {
      const ember = mesh(new THREE.IcosahedronGeometry(0.1, 0), 0xff7a2a, { emissive: 0xc0400a });
      ember.position.set(0.18, 0.5 + r() * 1.2, 0.12);
      g.add(ember);
    }
    g.scale.setScalar(scale * (0.8 + r() * 0.45));
    g.rotation.y = r() * Math.PI * 2;
    return g;
  }
  if (getTheme() === 'druid' && kind !== 'pine') return groveTree(kind, r, scale, detail);
  if (kind === 'pine') {
    g.add(cyl(0.18, 0.28, 1.4, C.trunk, 5));
    const col = r() < 0.5 ? C.pine : C.pineDark;
    g.add(cone(1.5, 2.4, col, 6, 0, 1.0));
    g.add(cone(1.15, 2.0, col, 6, 0, 2.2));
    g.add(cone(0.75, 1.6, darker(col, 1.1), 6, 0, 3.3));
    if (getSeason() === 'winter') {
      // snow resting on each tier of branches
      g.add(cone(1.2, 0.9, 0xf3f7fa, 6, 0, 2.5));
      g.add(cone(0.9, 0.8, 0xf3f7fa, 6, 0, 3.4));
      g.add(cone(0.55, 0.75, 0xf3f7fa, 6, 0, 4.15));
    }
  } else if (kind === 'birch') {
    g.add(cyl(0.12, 0.18, 2.6, 0xe8e2d4, 5));
    const col = r() < 0.7 ? C.leafYellow : C.leafGold;
    g.add(blob(1.1, col, 0, 3.0, 0, 1, 1.3, 1));
    g.add(blob(0.8, darker(col, 0.92), 0.5, 2.5, 0.3));
  } else {
    g.add(cyl(0.22, 0.34, 1.8, C.trunk, 6));
    const col = AUTUMN[Math.floor(r() * AUTUMN.length)];
    g.add(blob(1.5, col, 0, 2.6, 0, 1.1, 0.95, 1.1));
    g.add(blob(1.05, darker(col, 0.9), 0.8, 2.2, 0.4));
    g.add(blob(0.95, darker(col, 1.08), -0.7, 2.9, -0.3));
  }
  g.scale.setScalar(scale * (0.8 + r() * 0.45));
  g.rotation.y = r() * Math.PI * 2;
  return g;
}

/**
 * A tree of the druids' grove: lush and green the year round (a gold leaf or two in autumn, snow on
 * the tops in winter). Oaks with a crown of faceted leaf masses, some in blossom; pale-barked birches
 * in light green; and now and then a weeping willow trailing long strands.
 */
function groveTree(kind: 'oak' | 'birch', r: () => number, scale: number, det: number): THREE.Group {
  const g = new THREE.Group();
  const seed = Math.floor(r() * 1000);
  const fall = getSeason() === 'fall';
  if (kind === 'oak' && r() < 0.16) {
    // a weeping willow
    g.add(cyl(0.2, 0.34, 2.0, C.trunk, 6));
    g.add(leafCluster(1.35, 'mid', 0, 2.5, 0, 1.15, 0.7, 1.15, det, seed));
    g.add(leafCluster(0.8, 'sun', 0.1, 3.15, -0.1, 1, 0.75, 1, 0, seed + 1));
    const strand = getSeason() === 'winter' ? 0x3a6a36 : LEAF_SUN;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + r() * 0.3, d = 1.15 + r() * 0.35, len = 1.3 + r() * 0.9;
      g.add(box(0.1, len, 0.1, i % 2 ? strand : LEAF_MID, Math.cos(a) * d, 2.35 - len, Math.sin(a) * d));
    }
  } else if (kind === 'birch') {
    g.add(cyl(0.12, 0.18, 2.6, 0xe8e2d4, 5));
    for (const y of [0.7, 1.4, 2.0]) g.add(box(0.2, 0.06, 0.05, 0x3a3530, 0, y, 0.15));
    g.add(leafCluster(0.95, 'sun', 0, 3.0, 0, 1, 1.25, 1, det, seed));
    g.add(leafCluster(0.6, fall && r() < 0.3 ? 'gold' : 'mid', 0.45, 2.45, 0.3, 1, 1, 1, 0, seed + 1));
    g.add(leafCluster(0.5, 'sun', -0.4, 3.6, -0.2, 1, 1.1, 1, 0, seed + 2));
  } else {
    g.add(cyl(0.22, 0.36, 1.9, C.trunk, 6));
    if (det > 0) for (const s of [-1, 1]) {
      const b = cyl(0.07, 0.12, 1.0, C.trunk, 4, s * 0.25, 1.4, 0);
      b.rotation.z = -s * 0.8;
      g.add(b);
    }
    g.add(leafCluster(1.4, 'mid', 0, 2.75, 0, 1.1, 0.8, 1.1, det, seed));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + r();
      const tone = i === 0 && fall && r() < 0.35 ? 'gold' : i % 2 ? 'deep' : 'mid';
      g.add(leafCluster(0.75 + r() * 0.2, tone, Math.cos(a) * 1.1, 2.2 + r() * 0.3, Math.sin(a) * 1.1, 1.1, 0.75, 1.1, 0, seed + 2 + i));
    }
    g.add(leafCluster(0.8, 'sun', (r() - 0.5) * 0.4, 3.55, (r() - 0.5) * 0.4, 1, 0.8, 1, 0, seed + 9));
    if (getSeason() !== 'winter' && r() < 0.3) {
      // in blossom
      for (let i = 0; i < 6; i++) {
        const a = r() * Math.PI * 2, d = 0.6 + r() * 0.8;
        g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), detailMat(i % 3 ? BLOSSOM : BLOSSOM_W)).translateX(Math.cos(a) * d).translateY(3.2 + r() * 0.8 - d * 0.35).translateZ(Math.sin(a) * d));
      }
    }
  }
  g.scale.setScalar(scale * (0.8 + r() * 0.45));
  g.rotation.y = r() * Math.PI * 2;
  return g;
}

export function rock(r: () => number, s = 1, color: number = C.rock): THREE.Mesh {
  const m = blob(0.8 * s, r() < 0.5 ? color : C.rockDark, 0, 0.25 * s, 0, 1 + r() * 0.5, 0.55 + r() * 0.3, 1 + r() * 0.4);
  m.rotation.set(r(), r() * 3, r());
  return m;
}

export function crate(x = 0, z = 0, s = 1): THREE.Group {
  const g = new THREE.Group();
  // body stops just under the lid's top so the two tops aren't coplanar (z-fighting)
  g.add(box(0.8 * s, 0.78 * s, 0.8 * s, 0xb08452));
  g.add(box(0.84 * s, 0.1 * s, 0.84 * s, C.woodDark, 0, 0.7 * s, 0));
  g.position.set(x, 0, z);
  return g;
}

export function barrel(x = 0, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.38, 0.34, 0.9, 0x8c5a2e, 8));
  g.add(cyl(0.4, 0.4, 0.08, C.iron, 8, 0, 0.2));
  g.add(cyl(0.4, 0.4, 0.08, C.iron, 8, 0, 0.65));
  g.position.set(x, 0, z);
  return g;
}

export function hayBale(x = 0, z = 0, rot = 0): THREE.Mesh {
  const g = new THREE.CylinderGeometry(0.55, 0.55, 1.1, 10);
  g.rotateZ(Math.PI / 2);
  g.translate(0, 0.55, 0);
  const m = mesh(g, C.hay);
  m.position.set(x, 0, z);
  m.rotation.y = rot;
  return m;
}

export function pumpkin(x = 0, z = 0, s = 1): THREE.Group {
  const g = new THREE.Group();
  const b = blob(0.38 * s, C.pumpkin, 0, 0.3 * s, 0, 1.2, 0.8, 1.2, 1);
  g.add(b);
  g.add(cyl(0.05 * s, 0.07 * s, 0.22 * s, C.leafGreen, 5, 0, 0.55 * s));
  g.position.set(x, 0, z);
  return g;
}

export function fence(len: number, color: number = C.woodDark): THREE.Group {
  const g = new THREE.Group();
  const posts = Math.max(2, Math.round(len / 1.6) + 1);
  for (let i = 0; i < posts; i++) g.add(box(0.15, 1.0, 0.15, color, -len / 2 + (i * len) / (posts - 1), 0, 0));
  g.add(box(len, 0.1, 0.08, color, 0, 0.45, 0));
  g.add(box(len, 0.1, 0.08, color, 0, 0.8, 0));
  return g;
}

export function logPile(n = 6): THREE.Group {
  const g = new THREE.Group();
  let i = 0;
  for (let row = 0; i < n; row++) {
    const per = Math.max(1, 3 - row);
    for (let k = 0; k < per && i < n; k++, i++) {
      const geo = new THREE.CylinderGeometry(0.3, 0.3, 2.4, 7);
      geo.rotateZ(Math.PI / 2);
      const m = mesh(geo, C.wood);
      m.position.set(0, 0.3 + row * 0.52, (k - (per - 1) / 2) * 0.62);
      g.add(m);
      const endGeo = new THREE.CircleGeometry(0.29, 7);
      endGeo.rotateY(Math.PI / 2);
      const e = mesh(endGeo, C.logEnd);
      e.position.set(1.21, 0.3 + row * 0.52, (k - (per - 1) / 2) * 0.62);
      g.add(e);
    }
  }
  return g;
}

export function stump(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.45, 0.55, 0.5, C.trunk, 7));
  g.add(cyl(0.44, 0.44, 0.02, C.logEnd, 7, 0, 0.5));
  const axe = box(0.08, 1.0, 0.08, C.woodDark, 0.1, 0.45, 0);
  axe.rotation.z = -0.5;
  g.add(axe);
  g.add(box(0.35, 0.25, 0.06, C.iron, 0.42, 1.2, 0));
  return g;
}

export function cart(color: number = C.wood): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.6, 0.5, 1.0, color, 0, 0.45, 0));
  for (const [x, z] of [[-0.55, 0.55], [0.55, 0.55], [-0.55, -0.55], [0.55, -0.55]]) {
    const w = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 8);
    w.rotateX(Math.PI / 2);
    const m = mesh(w, C.woodDark);
    m.position.set(x, 0.35, z);
    g.add(m);
  }
  const shaft = box(1.4, 0.08, 0.08, C.woodDark, 1.4, 0.45, 0.25);
  g.add(shaft);
  g.add(box(1.4, 0.08, 0.08, C.woodDark, 1.4, 0.45, -0.25));
  return g;
}

/** Market stall / tent with a striped canopy. */
export function stall(c1: number, c2: number = C.white): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.4, 0.9, 1.3, C.wood, 0, 0, 0));
  for (const [x, z] of [[-1.15, -0.6], [1.15, -0.6], [-1.15, 0.6], [1.15, 0.6]]) g.add(box(0.1, 2.1, 0.1, C.woodDark, x, 0, z));
  for (let i = 0; i < 4; i++) {
    const s = box(0.65, 0.1, 1.8, i % 2 ? c2 : c1, -0.975 + i * 0.65, 2.1, 0.15);
    s.rotation.x = -0.25;
    g.add(s);
  }
  g.add(pumpkin(-0.6, 0, 0.8).translateY(0.9));
  g.add(blob(0.18, C.red, 0.1, 1.05, 0.2));
  g.add(blob(0.18, C.leafYellow, 0.4, 1.05, -0.1));
  g.add(blob(0.18, C.red, 0.7, 1.05, 0.25));
  return g;
}

export function tent(c1: number, c2: number = C.white): THREE.Group {
  const g = new THREE.Group();
  const seg = 10;
  for (let i = 0; i < seg; i++) {
    const geo = new THREE.ConeGeometry(1.6, 2.6, seg, 1, true, (i / seg) * Math.PI * 2, (Math.PI * 2) / seg);
    geo.translate(0, 1.3, 0);
    const m = mesh(geo, i % 2 ? c2 : c1, { double: true });
    g.add(m);
  }
  g.add(cyl(0.04, 0.04, 0.8, C.woodDark, 4, 0, 2.5));
  return g;
}

export function banner(color: number, h = 4): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.09, h, C.woodDark, 5));
  const flag = new THREE.Group();
  flag.userData.dynamic = true;
  flag.userData.flag = true;
  const f = box(1.6, 1.0, 0.05, color, 0.8, 0, 0);
  flag.add(f);
  flag.position.set(0, h - 1.1, 0);
  g.add(flag);
  return g;
}

export function campfire(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const s = blob(0.22, C.rockDark, Math.cos(a) * 0.7, 0.1, Math.sin(a) * 0.7);
    g.add(s);
  }
  for (let i = 0; i < 3; i++) {
    const l = box(0.14, 0.14, 1.1, C.woodDark, 0, 0.12, 0);
    l.rotation.y = (i / 3) * Math.PI;
    g.add(l);
  }
  const fire = new THREE.Group();
  fire.userData.dynamic = true;
  fire.userData.fire = true;
  const f1 = cone(0.42, 1.1, C.fire, 6);
  f1.material = new THREE.MeshBasicMaterial({ color: C.fire });
  const f2 = cone(0.24, 0.8, C.flame, 6);
  f2.material = new THREE.MeshBasicMaterial({ color: C.flame });
  f1.castShadow = f2.castShadow = false;
  fire.add(f1, f2);
  fire.position.y = 0.1;
  g.add(fire);
  return g;
}

export function anvil(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.5, 0.6, 0.5, C.woodDark));
  g.add(box(0.9, 0.3, 0.35, C.iron, 0, 0.6, 0));
  g.add(cone(0.18, 0.45, C.iron, 4, 0.62, 0.62, 0).rotateZ(-Math.PI / 2));
  return g;
}

export function well(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(1.0, 1.05, 0.9, C.stone, 10));
  g.add(cyl(0.8, 0.8, 0.02, C.water, 10, 0, 0.85));
  g.add(box(0.12, 2.2, 0.12, C.woodDark, -0.9, 0, 0));
  g.add(box(0.12, 2.2, 0.12, C.woodDark, 0.9, 0, 0));
  const roof = box(2.3, 0.12, 1.4, C.tile, 0, 2.2, 0);
  g.add(roof);
  return g;
}

export function dummy(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.14, 1.8, 0.14, C.woodDark));
  g.add(box(1.1, 0.12, 0.12, C.woodDark, 0, 1.3, 0));
  g.add(blob(0.35, C.hay, 0, 1.2, 0, 1, 1.3, 0.8));
  g.add(blob(0.24, C.hay, 0, 1.85, 0));
  return g;
}

export function weaponRack(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.0, 0.1, 0.12, C.woodDark, 0, 1.2, 0));
  g.add(box(0.12, 1.4, 0.12, C.woodDark, -0.95, 0, 0));
  g.add(box(0.12, 1.4, 0.12, C.woodDark, 0.95, 0, 0));
  for (let i = 0; i < 5; i++) {
    const s = box(0.05, 2.2, 0.05, C.wood, -0.7 + i * 0.35, 0, 0.1);
    s.rotation.x = -0.12;
    g.add(s);
    g.add(cone(0.09, 0.3, C.iron, 4, -0.7 + i * 0.35, 2.2, 0.36));
  }
  return g;
}

export function catapult(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.6, 0.35, 1.4, C.wood, 0, 0.4, 0));
  for (const [x, z] of [[-0.9, 0.75], [0.9, 0.75], [-0.9, -0.75], [0.9, -0.75]]) {
    const w = new THREE.CylinderGeometry(0.4, 0.4, 0.12, 8);
    w.rotateX(Math.PI / 2);
    const m = mesh(w, C.woodDark);
    m.position.set(x, 0.4, z);
    g.add(m);
  }
  g.add(box(0.2, 1.4, 0.2, C.woodDark, 0.3, 0.7, 0.5));
  g.add(box(0.2, 1.4, 0.2, C.woodDark, 0.3, 0.7, -0.5));
  const arm = box(0.16, 2.8, 0.16, C.wood, 0.3, 1.9, 0);
  arm.rotation.z = 0.9;
  arm.position.set(-0.4, 1.5, 0);
  g.add(arm);
  g.add(blob(0.3, C.rockDark, -1.6, 2.7, 0));
  return g;
}

export function ram(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.6, 0.3, 1.2, C.wood, 0, 0.35, 0));
  const log = new THREE.CylinderGeometry(0.28, 0.28, 3.2, 8);
  log.rotateZ(Math.PI / 2);
  const l = mesh(log, C.trunk);
  l.position.set(0.2, 1.1, 0);
  g.add(l);
  g.add(cone(0.34, 0.6, C.iron, 8, 1.95, 1.1, 0).rotateZ(-Math.PI / 2));
  const roof = box(2.8, 0.12, 1.6, C.thatch, 0, 1.8, 0);
  g.add(roof);
  return g;
}

export function horse(color: number = C.horse): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.5, 0.6, 0.5, color, 0, 0.9, 0));
  for (const [x, z] of [[-0.55, 0.18], [0.55, 0.18], [-0.55, -0.18], [0.55, -0.18]]) g.add(box(0.14, 0.9, 0.14, darker(color, 0.8), x, 0, z));
  const neck = box(0.3, 0.8, 0.3, color, 0.75, 1.2, 0);
  neck.rotation.z = -0.5;
  g.add(neck);
  g.add(box(0.6, 0.28, 0.28, color, 1.1, 1.75, 0));
  g.add(box(0.14, 0.6, 0.1, C.horseDark, 0.72, 1.45, 0));
  return g;
}

/** A tiny villager. Animated by the renderer. */
const DRUID_ROBES = [0x6b5a44, 0x55503c, 0x7a6a4e, 0x4d4436, 0x6a5e46];
const DRUID_COWLS = [0x2e2a22, 0x3a2f24, 0x262b22, 0x3b3328];
const SORCERER_CLOAKS = [0x3c2470, 0x1f2f6e, 0x5b3596, 0x2a1d4a, 0x46307a];
const NECRO_CLOAKS = [0x2e2a33, 0x3a2f3f, 0x26302a, 0x352a2a, 0x1f1d24];
const BONE = 0xe6dfcc, BONE_DARK = 0xb9b19c;
/** hands out a little variety between otherwise identical villagers */
let figureCount = 0;

export function person(tunic: number): THREE.Group {
  const g = new THREE.Group();
  const theme = getTheme();
  if (theme === 'goblin') {
    // a little goblin: short and stooped, green-skinned, all ears
    const skin = 0x7fa843;
    g.add(box(0.28, 0.28, 0.2, C.dark, 0, 0, 0));
    g.add(cyl(0.2, 0.27, 0.62, tunic, 6, 0, 0.26));
    g.add(blob(0.23, skin, 0, 1.08, 0.04, 1, 0.9, 1));
    for (const s of [-1, 1]) {
      const ear = cone(0.07, 0.34, skin, 4, s * 0.28, 1.1, 0);
      ear.rotation.z = -s * 1.25;
      g.add(ear);
    }
    g.add(blob(0.04, 0xf2d64b, -0.08, 1.12, 0.21), blob(0.04, 0xf2d64b, 0.08, 1.12, 0.21));
  } else if (theme === 'druid') {
    // druid folk: undyed robes, a rope belt and a deep dark cowl over a shadowed face
    const k = figureCount++;
    const robe = DRUID_ROBES[k % DRUID_ROBES.length];
    const cowl = DRUID_COWLS[(k >> 1) % DRUID_COWLS.length];
    g.add(box(0.3, 0.32, 0.2, C.dark, 0, 0, 0));
    g.add(cyl(0.22, 0.36, 0.95, robe, 7, 0, 0.1));
    g.add(cyl(0.23, 0.23, 0.07, 0xc9a86a, 7, 0, 0.62)); // rope belt
    g.add(cyl(0.3, 0.26, 0.2, cowl, 7, 0, 0.98)); // mantle over the shoulders
    g.add(blob(0.25, cowl, 0, 1.24, -0.02, 1, 1.15, 1)); // the cowl
    g.add(blob(0.13, 0x2a2018, 0, 1.2, 0.13, 1, 1.1, 0.5)); // face in shadow
    g.add(blob(0.1, C.skin, 0, 1.17, 0.17, 1, 1, 0.5));
    if (k % 3 === 0) g.add(box(0.22, 0.26, 0.1, 0x6e4a2a, -0.26, 0.4, 0.04)); // satchel
    if (k % 3 === 1) {
      g.add(cyl(0.035, 0.04, 1.7, 0x5a3f28, 5, 0.34, 0, 0.08));
      const gem = mesh(new THREE.IcosahedronGeometry(0.08, 0), 0x9fe07a, { emissive: 0x3a7a1a });
      gem.position.set(0.34, 1.75, 0.08);
      g.add(gem);
    }
  } else if (theme === 'sorcerer') {
    // robed apprentices in pointed hats and cloaks worked with stars, moons and sparks
    const k = figureCount++;
    const cloak = SORCERER_CLOAKS[k % SORCERER_CLOAKS.length];
    g.add(box(0.3, 0.32, 0.2, C.dark, 0, 0, 0));
    g.add(cyl(0.22, 0.34, 0.95, tunic, 7, 0, 0.1));
    g.add(blob(0.2, C.skin, 0, 1.25, 0));
    g.add(cyl(0.3, 0.3, 0.04, cloak, 8, 0, 1.38));
    g.add(cone(0.17, 0.5, cloak, 8, 0, 1.4));
    // the cloak, flaring out behind
    const cape = box(0.58, 1.05, 0.05, cloak, 0, 0.05, -0.27);
    cape.rotation.x = 0.12;
    g.add(cape);
    const pattern = k % 3;
    const dots: [number, number][] = [[-0.16, 0.85], [0.14, 0.7], [-0.05, 0.5], [0.18, 0.3], [-0.18, 0.22], [0.02, 0.95]];
    for (const [x, y] of dots) {
      if (pattern === 0) {
        const star = mesh(new THREE.OctahedronGeometry(0.055, 0), 0xf3d36a, { emissive: 0x7a5a10 });
        star.scale.set(1, 1, 0.3);
        star.position.set(x, y + 0.05, -0.31 - y * 0.12);
        g.add(star);
      } else if (pattern === 1) {
        const moon = mesh(new THREE.TorusGeometry(0.055, 0.018, 3, 8, Math.PI * 1.3), 0xdfe6ef, { emissive: 0x404a5a });
        moon.position.set(x, y + 0.05, -0.31 - y * 0.12);
        g.add(moon);
      } else {
        const spark = blob(0.035, 0xb58cff, x, y + 0.05, -0.31 - y * 0.12);
        g.add(spark);
      }
    }
    g.add(box(0.6, 0.05, 0.06, pattern === 1 ? 0xdfe6ef : 0xf3d36a, 0, 0.05, -0.28)); // hem
  } else if (theme === 'orc') {
    orcFolk(g, tunic);
  } else if (theme === 'necromancer') {
    // the risen: bare bones under a tattered cape, a green light where the eyes were
    const k = figureCount++;
    const cloak = NECRO_CLOAKS[k % NECRO_CLOAKS.length];
    for (const x of [-0.09, 0.09]) g.add(box(0.07, 0.34, 0.07, BONE, x, 0, 0));
    g.add(box(0.26, 0.08, 0.14, BONE, 0, 0.32, 0));
    g.add(cyl(0.035, 0.035, 0.5, BONE_DARK, 5, 0, 0.36));
    g.add(blob(0.19, BONE, 0, 0.74, 0, 1, 1.15, 0.8));
    for (const y of [0.64, 0.74, 0.84]) g.add(box(0.34, 0.035, 0.22, 0x2a2424, 0, y, 0));
    for (const x of [-0.24, 0.24]) g.add(box(0.06, 0.52, 0.06, BONE, x, 0.46, 0));
    g.add(blob(0.18, BONE, 0, 1.18, 0.02, 1, 1.05, 1));
    g.add(box(0.13, 0.08, 0.12, BONE_DARK, 0, 1.02, 0.06)); // jaw
    for (const x of [-0.07, 0.07]) {
      g.add(box(0.07, 0.07, 0.04, 0x141010, x, 1.19, 0.17));
      g.add(mesh(new THREE.OctahedronGeometry(0.025, 0), 0x5cff9a, { emissive: 0x1f9a4a }).translateX(x).translateY(1.22).translateZ(0.19));
    }
    // the cape, ragged at the hem, and for some a hood
    const cape = box(0.5, 0.95, 0.04, cloak, 0, 0.25, -0.2);
    cape.rotation.x = 0.1;
    g.add(cape);
    for (const x of [-0.18, 0, 0.18]) g.add(box(0.12, 0.14, 0.04, cloak, x + (k % 2 ? 0.04 : -0.03), 0.12, -0.19));
    if (k % 2 === 0) g.add(blob(0.23, cloak, 0, 1.22, -0.06, 1, 1.1, 1));
  } else {
    const body = cyl(0.2, 0.28, 0.75, tunic, 6, 0, 0.3);
    const head = blob(0.2, C.skin, 0, 1.25, 0);
    const legs = box(0.3, 0.32, 0.2, C.dark, 0, 0, 0);
    g.add(legs, body, head);
  }
  for (const c of g.children) c.castShadow = true;
  return g;
}

/** The Horde's own war-gear colours: a soldier's jerkin is one of these, a villager's is a hide. */
const ORC_KIT = [0x6e4a2a, 0x5a3a24, 0x7a5a3a, 0x4a3a2c, 0x8a3a24, 0x3e3a36];
const ORC_SKINS = [ORC_SKIN, 0x7a9442, 0x62803a, 0x6a7a3a];

/**
 * Orc folk: broad and hunched, moss-green, tusks jutting from a heavy jaw, a hide jerkin belted at the
 * waist, and each their own touch: a topknot, a bone necklace, a scar of red war paint.
 */
function orcFolk(g: THREE.Group, tunic: number): void {
  const k = figureCount++;
  const skin = ORC_SKINS[k % ORC_SKINS.length];
  const jerkin = ORC_KIT.includes(tunic) ? tunic : ORC_KIT[k % 4];
  g.add(box(0.36, 0.34, 0.24, 0x2e2218, 0, 0, 0));
  g.add(cyl(0.29, 0.31, 0.7, jerkin, 7, 0, 0.3));
  g.add(cyl(0.32, 0.32, 0.08, HIDE_DK, 7, 0, 0.5));
  g.add(blob(0.2, skin, 0, 0.98, -0.02, 1.7, 0.62, 1.1));
  g.add(blob(0.21, skin, 0, 1.18, 0.07, 1, 0.92, 1));
  g.add(box(0.26, 0.12, 0.14, skin, 0, 1.04, 0.16));
  for (const x of [-0.08, 0.08]) {
    g.add(cone(0.028, 0.1, BONE_W, 4, x, 1.06, 0.24));
    g.add(box(0.05, 0.04, 0.03, SOCKET, x, 1.22, 0.26));
  }
  for (const x of [-1, 1]) {
    const ear = cone(0.05, 0.18, skin, 4, x * 0.2, 1.2, 0.02);
    ear.rotation.z = -x * 1.3;
    g.add(ear);
  }
  if (k % 3 === 0) g.add(cone(0.08, 0.26, 0x1e1a16, 5, 0, 1.34, -0.04)); // a topknot
  if (k % 3 === 1) g.add(mesh(new THREE.TorusGeometry(0.2, 0.03, 3, 8).rotateX(Math.PI / 2 - 0.4), BONE_W).translateY(0.9).translateZ(0.04)); // bones strung round the neck
  if (k % 3 === 2) g.add(box(0.26, 0.05, 0.02, BLOOD, 0, 1.17, 0.27)); // war paint
}

/** A farmer called up as militia: arms raised, often waving a pitchfork. */
export function militiaman(tunic: number, pitchfork: boolean): THREE.Group {
  const g = person(tunic);
  for (const s of [-1, 1]) {
    const arm = box(0.1, 0.55, 0.1, tunic, s * 0.24, 1.0, 0);
    arm.rotation.z = -s * 0.35;
    g.add(arm);
  }
  if (pitchfork) {
    g.add(cyl(0.035, 0.035, 2.1, 0x7a5230, 5, 0.34, 0.6, 0.05));
    g.add(box(0.36, 0.05, 0.05, 0x6a7782, 0.34, 2.7, 0.05));
    for (const x of [-0.14, 0, 0.14]) g.add(box(0.04, 0.3, 0.04, 0x6a7782, 0.34 + x, 2.72, 0.05));
  } else {
    // a torch
    g.add(cyl(0.05, 0.05, 0.9, 0x5a3a22, 5, -0.36, 1.2, 0.05));
    const flame = mesh(new THREE.IcosahedronGeometry(0.14, 0), 0xffb347, { emissive: 0xff7a1a });
    flame.position.set(-0.36, 2.15, 0.05);
    g.add(flame);
  }
  return g;
}

export function windmill(): { group: THREE.Group; blades: THREE.Group } {
  const g = new THREE.Group();
  g.add(cyl(1.3, 1.9, 6, C.plasterWarm, 8));
  g.add(cone(1.8, 2.2, C.thatchDark, 8, 0, 6));
  g.add(box(0.8, 1.4, 0.2, C.door, 0, 0, 1.75));
  const blades = new THREE.Group();
  blades.userData.dynamic = true;
  blades.userData.spin = true;
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.add(box(0.18, 4.2, 0.12, C.woodDark, 0, 0, 0));
    arm.add(box(0.9, 3.2, 0.05, C.white, 0.5, 0.9, 0));
    arm.rotation.z = (i * Math.PI) / 2;
    blades.add(arm);
  }
  blades.position.set(0, 5.6, 1.9);
  g.add(blades);
  return { group: g, blades };
}

export function wheatField(w: number, d: number, r: () => number, ripe = true): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.08, d, ripe ? C.wheatDark : 0x8a7a3a, 0, 0, 0));
  const rows = Math.max(2, Math.floor(d / 0.9));
  for (let i = 0; i < rows; i++) {
    const z = -d / 2 + (i + 0.5) * (d / rows);
    const row = box(w - 0.4, 0.45 + r() * 0.1, 0.5, ripe ? C.wheat : 0x9c8b44, 0, 0.05, z);
    g.add(row);
  }
  return g;
}

export function scaffold(w: number, d: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const c = 0xa77b4c;
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) g.add(box(0.14, h, 0.14, c, x, 0, z));
  for (let y = h * 0.33; y < h; y += h * 0.33) {
    g.add(box(w, 0.12, 0.3, c, 0, y, d / 2 + 0.1));
    g.add(box(w, 0.12, 0.3, c, 0, y, -d / 2 - 0.1));
    g.add(box(0.3, 0.12, d, c, w / 2 + 0.1, y, 0));
    g.add(box(0.3, 0.12, d, c, -w / 2 - 0.1, y, 0));
  }
  const brace = box(0.1, Math.hypot(w, h), 0.1, c, 0, 0, d / 2 + 0.15);
  brace.rotation.z = Math.atan2(w, h);
  brace.position.set(-w / 2 + 0.1, 0, d / 2 + 0.15);
  g.add(brace);
  return g;
}

export function plot(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, 0.06, d, C.dirtDark, 0, 0.01, 0));
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) g.add(box(0.12, 0.7, 0.12, C.woodDark, x, 0, z));
  const sign = new THREE.Group();
  sign.add(box(0.1, 1.2, 0.1, C.woodDark));
  sign.add(box(0.9, 0.5, 0.08, C.wood, 0, 0.9, 0));
  sign.position.set(w / 2 - 0.4, 0, d / 2 + 0.6);
  g.add(sign);
  return g;
}

// ---------- troops ----------

const STEEL = 0xb9c4cc;
const STEEL_DK = 0x6a7782;
const SHAFT = 0x7a5230;

export type TroopModel = 'spear' | 'sword' | 'axe' | 'archer' | 'scout' | 'noble' | 'light' | 'marcher' | 'heavy' | 'paladin' | 'sorcerer' | 'druid' | 'goblin' | 'necromancer' | 'orc';

function helmet(g: THREE.Group, color = STEEL) {
  g.add(cyl(0.16, 0.23, 0.2, color, 7, 0, 1.3));
}

function bow(color = SHAFT): THREE.Mesh {
  const m = mesh(new THREE.TorusGeometry(0.45, 0.035, 4, 10, Math.PI), color);
  m.rotation.set(0, Math.PI / 2, Math.PI / 2);
  return m;
}

/** Each kind of village arms its troops its own way: rusty goblin iron, sorcerers' crystal, druids' flint. */
const GEAR = {
  paladin: { blade: 0xe6eef4, shield: 0x2c56b0, glow: 0 },
  classic: { blade: STEEL, shield: C.red, glow: 0 },
  goblin: { blade: 0x978d74, shield: 0x6e4a2a, glow: 0 },
  sorcerer: { blade: 0xb58cff, shield: 0x3f6ad8, glow: 0x5a2fb0 },
  druid: { blade: 0xd6cdb0, shield: 0x4f7a2e, glow: 0 },
  necromancer: { blade: 0x7d8480, shield: 0x2e2a33, glow: 0 },
  orc: { blade: 0x5e5a56, shield: 0x6e4a2a, glow: 0 },
};
const bladeMesh = (geo: THREE.BufferGeometry) => {
  const k = GEAR[getTheme()];
  return mesh(geo, k.blade, k.glow ? { emissive: k.glow } : undefined);
};
/** a cone standing on y=0, in the village's blade material */
function tip(r: number, h: number, x: number, y: number, z: number): THREE.Mesh {
  const g = new THREE.ConeGeometry(r, h, 5);
  g.translate(0, h / 2, 0);
  const m = bladeMesh(g);
  m.position.set(x, y, z);
  return m;
}

/** A familiar on the wing: an owl for sorcerers, a hawk for druids. Scouts in those villages fly. */
function bird(owl: boolean): THREE.Group {
  const g = new THREE.Group();
  const body = owl ? 0x5b3596 : 0x8a5a32;
  const wingCol = owl ? 0x46307a : 0x6e4424;
  const b = new THREE.Group();
  b.add(blob(0.24, body, 0, 0, 0, 0.9, 1.1, 1));
  b.add(blob(0.15, owl ? 0xb8a0e0 : 0xefe0c0, 0, -0.02, 0.14, 1, 1.2, 0.6));
  b.add(blob(0.17, body, 0, 0.28, 0.04));
  if (owl) {
    for (const x of [-0.07, 0.07]) b.add(blob(0.055, 0xfde38a, x, 0.3, 0.19));
    for (const x of [-0.1, 0.1]) b.add(cone(0.04, 0.12, body, 4, x, 0.4, 0));
  } else {
    b.add(blob(0.04, 0xf2d64b, 0.07, 0.31, 0.14), blob(0.04, 0xf2d64b, -0.07, 0.31, 0.14));
    const beak = cone(0.04, 0.12, 0xf0bd45, 4, 0, 0.24, 0.2);
    beak.rotation.x = Math.PI / 2 + 0.5;
    b.add(beak);
  }
  // the wings on hinges at the shoulders, so they can beat
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.add(box(0.5, 0.05, 0.26, wingCol, side * 0.25, 0, 0));
    hinge.position.set(side * 0.08, 0.04, -0.02);
    hinge.userData.flap = side;
    b.add(hinge);
  }
  b.add(box(0.16, 0.04, 0.26, wingCol, 0, -0.12, -0.26));
  b.position.y = 1.9;
  g.add(b);
  g.userData.flapping = true;
  if (owl) {
    const spark = mesh(new THREE.OctahedronGeometry(0.06, 0), 0xd9c2ff, { emissive: 0x7a4ad0 });
    spark.position.set(0.3, 2.25, -0.2);
    g.add(spark);
  }
  return g;
}

/** A necromancer's scouts: a little swarm of bats flitting about. */
function bats(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, y, z, s] of [[0, 2.0, 0, 1], [0.5, 2.4, -0.3, 0.7], [-0.45, 1.7, 0.25, 0.75]]) {
    const b = new THREE.Group();
    b.add(blob(0.12, 0x2e2a33, 0, 0, 0, 1, 1.2, 1));
    for (const side of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.add(box(0.36, 0.03, 0.2, 0x221f27, side * 0.18, 0, 0));
      hinge.position.x = side * 0.04;
      hinge.userData.flap = side;
      b.add(hinge);
      b.add(mesh(new THREE.OctahedronGeometry(0.025, 0), 0x5cff9a, { emissive: 0x1f9a4a }).translateX(side * 0.04).translateY(0.06).translateZ(0.1));
    }
    b.position.set(x, y, z);
    b.scale.setScalar(s);
    g.add(b);
  }
  g.userData.flapping = true;
  return g;
}

/**
 * A nobleman, dressed as his village's lords dress: a crowned lord in ermine, a
 * knight-commander under the Order's sun banner, an archmage with his orb, an elder
 * of the grove, a fat goblin chief with his gold, a lich in bone and green fire.
 */
function nobleman(theme: Theme): THREE.Group {
  const g = new THREE.Group();
  const glow = (geo: THREE.BufferGeometry, c: number, e: number) => mesh(geo, c, { emissive: e });
  const head = (skin: number, y = 1.28) => g.add(blob(0.2, skin, 0, y, 0));
  const crown = (c: number, y: number, r = 0.19, spikes = 5) => {
    g.add(cyl(r, r, 0.1, c, 8, 0, y));
    for (let i = 0; i < spikes; i++) { const a = (i / spikes) * Math.PI * 2; g.add(cone(0.04, 0.16, c, 4, Math.cos(a) * r * 0.9, y + 0.08, Math.sin(a) * r * 0.9)); }
  };
  switch (theme) {
    case 'paladin': {
      // a knight-commander: white steel, a blue surcoat with the sun, a gold circlet, the Order's banner
      g.add(cyl(0.24, 0.38, 1.05, 0xe6eef4, 8, 0, 0));
      g.add(box(0.42, 0.8, 0.06, 0x2c56b0, 0, 0.2, 0.24));
      g.add(glow(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 10).rotateX(Math.PI / 2), 0xffd35a, 0x8a5a10).translateY(0.72).translateZ(0.28));
      g.add(box(0.72, 1.1, 0.05, 0xf3eee2, 0, 0.1, -0.26));
      head(C.skin);
      crown(C.gold, 1.4, 0.2, 7);
      g.add(cyl(0.035, 0.035, 2.8, C.gold, 5, 0.4, 0, 0));
      const flag = box(0.04, 0.8, 0.55, 0x2c56b0, 0.42, 1.9, 0.3);
      g.add(flag);
      g.add(glow(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10).rotateZ(Math.PI / 2), 0xffd35a, 0x8a5a10).translateX(0.46).translateY(2.3).translateZ(0.3));
      break;
    }
    case 'sorcerer': {
      // an archmage: a long star-worked robe, a towering bent hat, an orb floating over his hand
      g.add(cyl(0.2, 0.42, 1.15, 0x3a2470, 8, 0, 0));
      for (let i = 0; i < 6; i++) g.add(glow(new THREE.OctahedronGeometry(0.05, 0), 0xf4ecc8, 0x8a7a40).translateX(Math.sin(i * 2.1) * 0.3).translateY(0.2 + i * 0.14).translateZ(Math.cos(i * 2.1) * 0.3 + 0.05));
      head(C.skin);
      g.add(box(0.14, 0.3, 0.12, 0xe8e6ea, 0, 1.0, 0.18)); // a long white beard
      g.add(cyl(0.34, 0.34, 0.04, 0x2e1d63, 10, 0, 1.4));
      g.add(cyl(0.1, 0.22, 0.5, 0x2e1d63, 8, 0, 1.42));
      const tip = cone(0.1, 0.45, 0x2e1d63, 6, 0, 1.9);
      tip.rotation.z = -0.6;
      g.add(tip);
      g.add(cyl(0.03, 0.035, 1.8, 0x2a1d40, 5, 0.38, 0, 0.1));
      g.add(glow(new THREE.IcosahedronGeometry(0.16, 1), 0xc6a2ff, 0x6a38d0).translateX(0.38).translateY(2.0).translateZ(0.1));
      g.add(glow(new THREE.IcosahedronGeometry(0.12, 1), 0x8fe8ff, 0x2a8ab8).translateX(-0.35).translateY(1.0).translateZ(0.3));
      break;
    }
    case 'druid': {
      // an elder of the grove: a green hooded cloak, a crown of antlers, a staff in leaf
      g.add(cyl(0.22, 0.4, 1.1, 0x3f6a2a, 8, 0, 0));
      g.add(box(0.7, 1.0, 0.05, 0x2f5a22, 0, 0.15, -0.25));
      head(0xd9b48a);
      g.add(blob(0.24, 0x3f6a2a, 0, 1.34, -0.05, 1, 1.05, 1));
      g.add(box(0.12, 0.34, 0.1, 0xd8d2c0, 0, 0.98, 0.18));
      for (const x of [-1, 1]) {
        const a1 = box(0.05, 0.42, 0.05, 0xd9cfae, x * 0.14, 1.45, 0);
        a1.rotation.z = -x * 0.5;
        g.add(a1);
        const a2 = box(0.04, 0.22, 0.04, 0xd9cfae, x * 0.3, 1.72, 0);
        a2.rotation.z = -x * 0.15;
        g.add(a2);
      }
      g.add(cyl(0.035, 0.045, 1.95, 0x5a3f28, 5, 0.38, 0, 0.1));
      g.add(blob(0.18, 0x6f9a3a, 0.38, 2.0, 0.1, 1.2, 0.8, 1.2));
      break;
    }
    case 'goblin': {
      // a goblin chief: fat, green, a crooked crown and a sack of loot over the shoulder
      g.add(blob(0.36, 0x7a5a2a, 0, 0.42, 0, 1, 1.05, 0.95));
      for (const x of [-0.12, 0.12]) g.add(box(0.1, 0.22, 0.1, 0x3b3530, x, 0, 0));
      g.add(blob(0.24, 0x7fa843, 0, 0.95, 0.04, 1, 0.9, 1));
      for (const x of [-1, 1]) { const ear = cone(0.07, 0.36, 0x7fa843, 4, x * 0.28, 0.98, 0); ear.rotation.z = -x * 1.25; g.add(ear); }
      g.add(blob(0.04, 0xf2d64b, -0.08, 1.0, 0.24), blob(0.04, 0xf2d64b, 0.08, 1.0, 0.24));
      const cr = new THREE.Group();
      cr.add(cyl(0.17, 0.17, 0.1, 0xb07a3a, 6));
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; cr.add(cone(0.04, 0.14, 0xb07a3a, 4, Math.cos(a) * 0.15, 0.08, Math.sin(a) * 0.15)); }
      cr.position.set(0.04, 1.15, 0);
      cr.rotation.z = 0.3;
      g.add(cr);
      g.add(blob(0.24, 0x9a8a5a, -0.28, 0.9, -0.22, 1, 1.1, 1));
      g.add(blob(0.07, C.gold, -0.2, 1.12, -0.12));
      break;
    }
    case 'necromancer': {
      // a lich: tattered black robes, a skull under a crown of bone, green fire where the eyes were, a skull lantern
      g.add(cyl(0.2, 0.44, 1.15, 0x1c1a20, 8, 0, 0));
      g.add(box(0.8, 1.1, 0.05, 0x2a262e, 0, 0.05, -0.26));
      g.add(blob(0.2, 0xe6dfcc, 0, 1.28, 0, 1, 1.1, 0.9));
      for (const x of [-0.08, 0.08]) g.add(glow(new THREE.BoxGeometry(0.07, 0.07, 0.05), 0x5cff9a, 0x1f9a4a).translateX(x).translateY(1.3).translateZ(0.18));
      crown(0xd8d0bc, 1.43, 0.18, 6);
      g.add(cyl(0.03, 0.035, 1.9, 0x221c1b, 5, 0.38, 0, 0.1));
      g.add(box(0.3, 0.05, 0.05, 0x221c1b, 0.38, 1.9, 0.1));
      g.add(blob(0.13, 0xe6dfcc, 0.52, 1.72, 0.1));
      g.add(glow(new THREE.IcosahedronGeometry(0.08, 0), 0x5cff9a, 0x1f9a4a).translateX(0.52).translateY(1.72).translateZ(0.2));
      break;
    }
    case 'orc': {
      // a warchief: a hulking orc in a wolf-fur mantle over black iron, a horned helm, the clan's standard in his fist
      const body = new THREE.Group();
      body.add(box(0.4, 0.36, 0.26, IRON_BK, 0, 0, 0));
      body.add(cyl(0.32, 0.36, 0.8, IRON_BK, 8, 0, 0.3));
      body.add(box(0.3, 0.55, 0.05, BLOOD, 0, 0.35, 0.31));
      body.add(blob(0.26, 0x4a3a2c, 0, 1.08, -0.02, 1.8, 0.6, 1.2));
      body.add(blob(0.22, ORC_SKIN_DK, 0, 1.3, 0.07, 1, 0.92, 1));
      body.add(box(0.28, 0.12, 0.14, ORC_SKIN_DK, 0, 1.15, 0.17));
      for (const x of [-0.09, 0.09]) body.add(cone(0.03, 0.12, BONE_W, 4, x, 1.17, 0.25));
      body.add(cyl(0.23, 0.25, 0.16, IRON_BK, 8, 0, 1.42));
      body.add(hornPair(0.2, 1.5, 0, 0.18, 0.32, 0.12, 0.05));
      body.add(box(0.7, 1.05, 0.05, BLOOD, 0, 0.1, -0.3));
      g.add(body);
      g.add(cyl(0.04, 0.045, 2.8, 0x3a2618, 5, 0.42, 0, 0.05));
      g.add(box(0.04, 0.9, 0.6, BLOOD, 0.44, 1.75, 0.35));
      g.add(blob(0.12, BONE_W, 0.48, 2.0, 0.35, 0.3, 1, 1));
      const sk = orcSkull(0.26);
      sk.position.set(0.42, 2.92, 0.05);
      g.add(sk);
      break;
    }
    default: {
      // a lord: a crimson robe with an ermine collar, a gold crown, a sceptre and orb
      g.add(cyl(0.22, 0.4, 1.1, 0x9a1f1a, 8, 0, 0));
      g.add(cyl(0.3, 0.3, 0.16, 0xf6f2ea, 8, 0, 1.0));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(box(0.04, 0.06, 0.02, 0x111111, Math.cos(a) * 0.3, 1.06, Math.sin(a) * 0.3)); }
      g.add(box(0.8, 1.1, 0.05, 0x7a1612, 0, 0.05, -0.26));
      head(C.skin);
      crown(C.gold, 1.42);
      g.add(blob(0.05, 0xd0302a, 0, 1.52, 0.18));
      g.add(cyl(0.03, 0.03, 1.1, C.gold, 5, 0.36, 0.55, 0.12));
      g.add(blob(0.09, C.gold, 0.36, 1.7, 0.12));
      g.add(blob(0.1, C.gold, -0.32, 0.8, 0.22));
    }
  }
  g.scale.setScalar(1.1);
  return g;
}

/** One of your soldiers on foot, carrying what their unit is known for. */
function footSoldier(kind: TroopModel): THREE.Group {
  if (kind === 'goblin') return goblin();
  if (kind === 'orc') return orcKing();
  if (kind === 'noble') return nobleman(getTheme());
  const theme = getTheme();
  if (theme === 'orc') return orcSoldier(kind);
  if (kind === 'scout' && (theme === 'sorcerer' || theme === 'druid')) return bird(theme === 'sorcerer');
  if (kind === 'scout' && theme === 'necromancer') return bats();
  const gear = GEAR[theme];
  // helmets are a village-folk thing; goblins, sorcerers and druids go bare-headed, hatted or hooded;
  // the Order's men wear bright great helms with a golden crest
  const helm = (g: THREE.Group) => {
    if (theme === 'classic') helmet(g);
    if (theme === 'paladin') { helmet(g, 0xe6eef4); g.add(cone(0.07, 0.3, C.gold, 5, 0, 1.5)); }
  };
  const tunic = theme === 'paladin'
    ? ({ spear: 0x2c56b0, sword: 0xf3eee2, axe: 0xf3eee2, archer: 0x2c56b0, scout: 0x3a4a6a, noble: 0x2c56b0 }[kind as 'spear'] ?? 0x2c56b0)
    : ({ spear: 0x2f5d99, sword: 0x8e3a1f, axe: 0x5a3a22, archer: 0x4f7a2e, scout: 0x3b3a30, noble: C.red, sorcerer: 0x5b3596, druid: 0x4f7a2e, necromancer: 0x221f27 }[kind as 'spear'] ?? 0x6f7c35);
  const g = person(tunic);
  if (theme === 'paladin' && kind !== 'scout') {
    // a tabard with the golden sun over the chest
    g.add(box(0.36, 0.52, 0.05, tunic === 0x2c56b0 ? 0xf3eee2 : 0x2c56b0, 0, 0.42, 0.22));
    g.add(blob(0.07, C.gold, 0, 0.72, 0.26));
  }
  switch (kind) {
    case 'spear':
      helm(g);
      g.add(cyl(0.035, 0.035, 2.3, SHAFT, 5, 0.34, 0.1, 0.1));
      g.add(tip(0.09, theme === 'sorcerer' ? 0.5 : 0.32, 0.34, 2.4, 0.1));
      if (theme === 'goblin') g.add(box(0.12, 0.22, 0.03, 0x6f9a2a, 0.4, 2.2, 0.1)); // a green rag
      if (theme === 'druid') g.add(blob(0.1, C.leafGreen, 0.34, 2.36, 0.1, 1.4, 0.6, 1));
      break;
    case 'sword': {
      helm(g);
      const bgeo = new THREE.BoxGeometry(theme === 'goblin' ? 0.14 : 0.07, 0.8, 0.03);
      bgeo.translate(0, 0.4, 0);
      const blade = bladeMesh(bgeo);
      blade.position.set(0.34, 0.55, 0.22);
      blade.rotation.x = 0.5;
      g.add(blade);
      const shield = cyl(0.36, 0.36, 0.06, gear.shield, theme === 'goblin' ? 5 : 10);
      shield.rotation.z = Math.PI / 2;
      shield.position.set(-0.26, 0.72, 0);
      g.add(shield);
      break;
    }
    case 'axe': {
      if (theme === 'sorcerer') {
        // a warmage: a staff crowned with fire
        g.add(cyl(0.035, 0.04, 1.9, 0x2a1d40, 5, 0.36, 0, 0.1));
        const fire = mesh(new THREE.IcosahedronGeometry(0.2, 0), 0xff8a3a, { emissive: 0xd0501a });
        fire.position.set(0.36, 2.02, 0.1);
        g.add(fire);
        break;
      }
      if (theme === 'druid') {
        // a wildling's knotted club over the shoulder
        const club = cyl(0.07, 0.17, 1.1, 0x5e4228, 6);
        club.position.set(0.3, 0.9, -0.1);
        club.rotation.x = -0.55;
        g.add(club);
        g.add(blob(0.09, C.leafGreen, 0.3, 1.8, -0.62));
        break;
      }
      const handle = box(0.06, 1.1, 0.06, SHAFT);
      handle.position.set(0.3, 0.9, -0.1);
      handle.rotation.x = -0.55;
      g.add(handle);
      const hgeo = new THREE.BoxGeometry(0.05, 0.3, theme === 'goblin' ? 0.34 : 0.26);
      hgeo.translate(0, 0.15, 0);
      const head = bladeMesh(hgeo);
      head.position.set(0.3, 1.78, -0.62);
      head.rotation.x = -0.55;
      g.add(head);
      break;
    }
    case 'archer': {
      const b = bow(theme === 'sorcerer' ? 0x7a64a0 : SHAFT);
      b.position.set(0.32, 0.8, 0);
      g.add(b);
      g.add(box(0.16, 0.5, 0.12, 0x6e4220, 0, 0.6, -0.26));
      if (theme === 'classic') g.add(cone(0.24, 0.35, 0x3a4f22, 6, 0, 1.3));
      if (theme === 'paladin') g.add(cyl(0.2, 0.24, 0.16, 0xe6eef4, 7, 0, 1.3));
      break;
    }
    case 'scout':
      if (theme === 'classic') g.add(cone(0.26, 0.5, 0x2a2a22, 6, 0, 1.2));
      g.add(box(0.5, 0.7, 0.06, 0x2a2a22, 0, 0.35, -0.24));
      break;
    case 'sorcerer':
      // a tall star-spangled hat, a long robe and a staff with a glowing orb
      g.add(cyl(0.34, 0.34, 0.05, 0x48297a, 10, 0, 1.36));
      g.add(cone(0.2, 0.75, 0x5b3596, 8, 0, 1.38));
      g.add(cyl(0.3, 0.36, 0.5, 0x5b3596, 7, 0, -0.02));
      g.add(cyl(0.035, 0.035, 1.9, 0x3b2a1c, 5, 0.36, 0, 0.1));
      const orb = mesh(new THREE.IcosahedronGeometry(0.16, 1), 0xc9a6ff, { emissive: 0x7a4ad0 });
      orb.position.set(0.36, 1.98, 0.1);
      orb.userData.pulse = true;
      g.add(orb);
      break;
    case 'druid': {
      // hooded green robe, a gnarled staff sprouting leaves
      g.add(cone(0.27, 0.5, 0x3f6424, 7, 0, 1.12));
      g.add(cyl(0.3, 0.38, 0.5, 0x3f6424, 7, 0, -0.02));
      g.add(blob(0.13, 0xd9d2c0, 0, 1.08, 0.14, 1, 1.3, 0.6));
      const staff = cyl(0.04, 0.05, 2, 0x6e4a2a, 5, 0.36, 0, 0.1);
      staff.rotation.z = -0.06;
      g.add(staff);
      g.add(blob(0.2, C.leafGreen, 0.42, 2.05, 0.1, 1.2, 0.8, 1));
      g.add(blob(0.12, C.leafGold, 0.3, 2.15, 0.2));
      const seed = mesh(new THREE.IcosahedronGeometry(0.09, 0), 0xc9f07a, { emissive: 0x5a9a1a });
      seed.position.set(0.36, 2.35, 0.1);
      seed.userData.pulse = true;
      g.add(seed);
      break;
    }
    case 'necromancer': {
      // a skeleton lord in a long black robe and hood, his staff crowned by a skull burning green
      g.add(cyl(0.3, 0.42, 0.62, 0x221f27, 7, 0, -0.02));
      g.add(blob(0.25, 0x221f27, 0, 1.22, -0.07, 1, 1.15, 1));
      const cape = box(0.6, 1.2, 0.05, 0x221f27, 0, 0.05, -0.26);
      cape.rotation.x = 0.12;
      g.add(cape);
      g.add(box(0.62, 0.06, 0.07, 0x2f7a4a, 0, 0.06, -0.27));
      g.add(cyl(0.035, 0.04, 2.0, 0x221c1b, 5, 0.36, 0, 0.1));
      g.add(blob(0.13, BONE, 0.36, 2.06, 0.1, 1, 1.05, 1));
      const flame = mesh(new THREE.IcosahedronGeometry(0.12, 0), 0x5cff9a, { emissive: 0x1f9a4a });
      flame.position.set(0.36, 2.3, 0.1);
      flame.userData.pulse = true;
      g.add(flame);
      break;
    }
  }
  for (const c of g.children) c.castShadow = true;
  return g;
}

const ROYAL = 0x2f5fb0;
const GOLD_TRIM = 0xe9b83a;

/** The goblin chief: small, green, all ears, with a spiked club and a loot sack. */
function goblin(): THREE.Group {
  const g = new THREE.Group();
  const skin = 0x7fa843;
  g.add(box(0.28, 0.26, 0.18, 0x3b2a1c, 0, 0, 0));
  g.add(cyl(0.18, 0.26, 0.55, 0x6e4a2a, 6, 0, 0.24));
  g.add(blob(0.22, skin, 0, 0.98, 0.02, 1, 0.9, 1));
  for (const x of [-1, 1]) {
    const ear = cone(0.08, 0.36, skin, 4, x * 0.3, 1.0, 0);
    ear.rotation.z = -x * 1.25;
    g.add(ear);
  }
  g.add(blob(0.05, 0xf2d64b, -0.08, 1.02, 0.19));
  g.add(blob(0.05, 0xf2d64b, 0.08, 1.02, 0.19));
  const club = cyl(0.05, 0.1, 0.8, 0x6e4a2a, 5, 0.3, 0.3, 0.12);
  club.rotation.x = -0.4;
  g.add(club);
  g.add(blob(0.24, 0xc9ad72, -0.1, 0.55, -0.26, 1, 1.1, 0.9));
  for (const c of g.children) c.castShadow = true;
  return g;
}

// ---------- the Horde ----------

/** An iron cap: a spike on the grunts' and a pair of horns on the cleavers'. */
function orcHelm(g: THREE.Group, horns: boolean): void {
  g.add(cyl(0.2, 0.24, 0.16, IRON_BK, 7, 0, 1.3));
  if (horns) g.add(hornPair(0.18, 1.38, 0, 0.14, 0.26, 0.08, 0.04));
  else g.add(cone(0.05, 0.22, IRON_BK, 4, 0, 1.45));
}

/**
 * A soldier of the Horde: spear grunts in iron caps, cleavers behind a hide shield with a skull boss,
 * berserkers stripped to the waist and daubed in red with a great double axe, bow orcs under hide hoods;
 * the scouts are wargs running loose.
 */
function orcSoldier(kind: TroopModel): THREE.Group {
  if (kind === 'scout') {
    const g = new THREE.Group();
    const w = warg(0x5a5046);
    w.rotation.y = -Math.PI / 2;
    w.scale.setScalar(0.85);
    g.add(w);
    for (const c of g.children) c.castShadow = true;
    return g;
  }
  const kit: Record<string, number> = { spear: ORC_KIT[0], sword: ORC_KIT[1], axe: ORC_SKIN_DK, archer: ORC_KIT[3] };
  const g = person(ORC_KIT.includes(kit[kind] ?? 0) ? kit[kind] : ORC_KIT[4]);
  const blade = GEAR.orc.blade;
  switch (kind) {
    case 'spear':
      orcHelm(g, false);
      g.add(box(0.46, 0.4, 0.06, IRON_BK, 0, 0.5, 0.29));
      g.add(cyl(0.035, 0.04, 2.3, 0x4a3220, 5, 0.36, 0.1, 0.1));
      g.add(tip(0.1, 0.38, 0.36, 2.4, 0.1));
      g.add(box(0.12, 0.26, 0.03, BLOOD, 0.42, 2.12, 0.1));
      break;
    case 'sword': {
      orcHelm(g, true);
      const cl = new THREE.BoxGeometry(0.22, 0.72, 0.04);
      cl.translate(0.05, 0.36, 0);
      const c = mesh(cl, blade);
      c.position.set(0.36, 0.55, 0.22);
      c.rotation.x = 0.5;
      g.add(c);
      const shield = cyl(0.4, 0.4, 0.07, HIDE_C, 7);
      shield.rotation.z = Math.PI / 2;
      shield.position.set(-0.34, 0.72, 0);
      g.add(shield);
      g.add(blob(0.12, BONE_W, -0.39, 0.74, 0, 0.5, 1, 1));
      break;
    }
    case 'axe': {
      // a berserker: a mohawk, red war paint and a great double axe over the shoulder
      g.add(box(0.06, 0.12, 0.34, 0x1e1a16, 0, 1.36, 0));
      g.add(box(0.5, 0.07, 0.02, BLOOD, 0, 0.7, 0.3), box(0.07, 0.4, 0.02, BLOOD, -0.12, 0.45, 0.31));
      const handle = box(0.06, 1.25, 0.06, 0x4a3220);
      handle.position.set(0.32, 0.85, -0.1);
      handle.rotation.x = -0.55;
      g.add(handle);
      for (const s of [-1, 1]) {
        // a crescent blade either side of the haft
        const hgeo = new THREE.CylinderGeometry(0.24, 0.24, 0.05, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(s * Math.PI / 2);
        hgeo.scale(1, 1.25, 1);
        hgeo.translate(0, 0.05, s * 0.03);
        const head = bladeMesh(hgeo);
        head.position.set(0.32, 1.8, -0.72);
        head.rotation.x = -0.55;
        g.add(head);
      }
      break;
    }
    case 'archer': {
      g.add(blob(0.25, HIDE_DK, 0, 1.24, -0.04, 1, 1.05, 1));
      const b = bow(BONE_SH);
      b.position.set(0.32, 0.8, 0);
      g.add(b);
      g.add(box(0.16, 0.5, 0.12, HIDE_DK, 0, 0.6, -0.3));
      break;
    }
  }
  for (const c of g.children) c.castShadow = true;
  return g;
}

/**
 * The Orc King: a head taller than his warriors, in black iron under a wolf-fur mantle, spiked pauldrons,
 * a crown of tusks on his brow, embers for eyes, a blood-red cape and a great crescent axe in his fist.
 */
function orcKing(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const skin = ORC_SKIN_DK;
  body.add(box(0.5, 0.44, 0.32, IRON_BK, 0, 0, 0));
  body.add(cyl(0.44, 0.5, 0.36, HIDE_DK, 8, 0, 0.3));
  body.add(cyl(0.4, 0.4, 0.8, IRON_BK, 8, 0, 0.56));
  body.add(box(0.36, 0.62, 0.05, BLOOD, 0, 0.42, 0.38));
  body.add(blob(0.12, BONE_W, 0, 0.9, 0.4, 1, 1, 0.4));
  body.add(blob(0.3, 0x3a2e24, 0, 1.36, -0.04, 2.0, 0.55, 1.25));
  for (const s of [-1, 1]) {
    body.add(blob(0.22, IRON_BK, s * 0.46, 1.34, 0, 1.2, 0.8, 1.1));
    for (let k = 0; k < 3; k++) {
      const sp = cone(0.045, 0.24, BONE_W, 4, s * (0.4 + k * 0.1), 1.46, -0.08 + k * 0.08);
      sp.rotation.z = -s * 0.5;
      body.add(sp);
    }
  }
  body.add(blob(0.25, skin, 0, 1.68, 0.08, 1, 0.95, 1));
  body.add(box(0.32, 0.15, 0.16, skin, 0, 1.52, 0.2));
  for (const x of [-0.1, 0.1]) {
    body.add(cone(0.045, 0.2, BONE_W, 4, x, 1.54, 0.3));
    body.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), detailMat(EMBER, { emissive: EMBER_E })).translateX(x).translateY(1.72).translateZ(0.3));
  }
  body.add(cyl(0.23, 0.23, 0.1, IRON_BK, 8, 0, 1.84));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
    body.add(cone(0.035, i === 0 ? 0.32 : 0.22, BONE_W, 4, Math.cos(a) * 0.2, 1.9, Math.sin(a) * 0.2));
  }
  const cape = box(0.8, 1.3, 0.05, BLOOD, 0, 0.35, -0.38);
  cape.rotation.x = 0.12;
  body.add(cape);
  g.add(body);
  // the great axe: a long haft, a crescent blade either side, a spike at its head
  g.add(cyl(0.045, 0.05, 2.5, 0x2e2018, 5, 0.56, 0, 0.14));
  for (const s of [-1, 1]) {
    const bl = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 8, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(s > 0 ? 0 : Math.PI), GEAR.orc.blade);
    bl.scale.set(0.8, 1.15, 1);
    bl.position.set(0.56 + s * 0.02, 2.2, 0.14);
    g.add(bl);
  }
  g.add(cone(0.05, 0.3, BONE_W, 4, 0.56, 2.5, 0.14));
  g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), detailMat(EMBER, { emissive: EMBER_E })).translateX(0.56).translateY(2.2).translateZ(0.2));
  for (const c of g.children) c.castShadow = true;
  return g;
}

/** A warg: a great shaggy wolf, long along +x like the horse, jaws agape, a spiked iron collar. */
export function warg(color = 0x4e463e): THREE.Group {
  const g = new THREE.Group();
  const dk = darker(color, 0.75);
  for (const [x, z] of [[-0.55, 0.18], [0.55, 0.18], [-0.55, -0.18], [0.55, -0.18]]) g.add(box(0.16, 0.85, 0.16, dk, x, 0, z));
  g.add(box(1.5, 0.58, 0.54, color, 0, 0.78, 0));
  g.add(box(0.62, 0.72, 0.64, dk, 0.5, 0.74, 0));
  g.add(box(1.0, 0.14, 0.2, dk, -0.1, 1.12, 0));
  const neck = box(0.34, 0.55, 0.36, color, 0.72, 1.05, 0);
  neck.rotation.z = -0.65;
  g.add(neck);
  g.add(box(0.52, 0.36, 0.38, color, 1.14, 1.38, 0));
  g.add(box(0.4, 0.16, 0.26, darker(color, 1.15), 1.5, 1.4, 0));
  const jaw = box(0.38, 0.1, 0.22, dk, 1.46, 1.22, 0);
  jaw.rotation.z = -0.3;
  g.add(jaw);
  for (const z of [-0.08, 0.08]) g.add(cone(0.03, 0.12, BONE_W, 4, 1.62, 1.26, z));
  for (const z of [-0.12, 0.12]) {
    g.add(cone(0.08, 0.26, color, 4, 1.02, 1.56, z));
    g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), detailMat(EMBER, { emissive: EMBER_E })).translateX(1.34).translateY(1.48).translateZ(z * 1.5));
  }
  g.add(cyl(0.24, 0.24, 0.1, IRON_BK, 6, 0.8, 1.1, 0).rotateZ(-0.65));
  const tail = box(0.6, 0.14, 0.14, color, -0.95, 1.0, 0);
  tail.rotation.z = 0.5;
  g.add(tail);
  return g;
}

/** A war boar: huge, bristle-backed, its great tusks curling up (armoured in iron plates and a red cloth for battle). */
export function warBoar(armoured = true): THREE.Group {
  const g = new THREE.Group();
  const hide = 0x4e3626;
  for (const [x, z] of [[-0.55, 0.26], [0.55, 0.26], [-0.55, -0.26], [0.55, -0.26]]) g.add(box(0.2, 0.6, 0.2, 0x2e2016, x, 0, z));
  g.add(blob(0.55, hide, 0, 0.9, 0, 1.45, 0.8, 0.8));
  g.add(blob(0.38, hide, 0.72, 0.88, 0, 1.1, 0.95, 0.95));
  g.add(box(1.2, 0.18, 0.14, 0x241810, -0.05, 1.36, 0));
  const snout = cyl(0.17, 0.17, 0.1, 0x9a6a5a, 8, 1.12, 0.82, 0);
  snout.rotation.z = Math.PI / 2;
  g.add(snout);
  for (const z of [-1, 1]) {
    g.add(horn(new THREE.Vector3(1.0, 0.72, z * 0.18), new THREE.Vector3(1.3, 0.6, z * 0.34), new THREE.Vector3(1.3, 1.08, z * 0.3), 0.06, BONE_W, 3));
    g.add(cone(0.08, 0.2, hide, 4, 0.72, 1.18, z * 0.2));
    g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), detailMat(EMBER, { emissive: EMBER_E })).translateX(1.0).translateY(1.02).translateZ(z * 0.22));
  }
  if (armoured) {
    g.add(box(0.9, 0.12, 0.84, IRON_BK, -0.05, 1.26, 0));
    g.add(box(0.95, 0.3, 0.9, BLOOD, -0.05, 0.98, 0));
  }
  return g;
}

/** A skeletal horse: bone-white, ribs showing, green light in the eye; the knights' in black barding. */
function boneHorse(barded: boolean): THREE.Group {
  const g = horse(BONE);
  for (let i = 0; i < 4; i++) for (const z of [-0.26, 0.26]) g.add(box(0.1, 0.46, 0.02, 0x2a2424, -0.35 + i * 0.22, 0.97, z));
  for (const z of [-0.15, 0.15]) g.add(mesh(new THREE.OctahedronGeometry(0.05, 0), 0x5cff9a, { emissive: 0x1f9a4a }).translateX(1.18).translateY(1.92).translateZ(z));
  if (barded) {
    g.add(box(1.3, 0.4, 0.56, 0x221f27, 0, 0.84, 0));
    for (const x of [-0.4, 0, 0.4]) for (const z of [-0.29, 0.29]) g.add(mesh(new THREE.OctahedronGeometry(0.05, 0), 0x5cff9a, { emissive: 0x1f9a4a }).translateX(x).translateY(1.05).translateZ(z));
  }
  return g;
}

/** A wolf, long along +x like the horse: goblin raiders ride these. */
function wolf(color: number): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.5, 0.16], [0.5, 0.16], [-0.5, -0.16], [0.5, -0.16]]) g.add(box(0.13, 0.75, 0.13, darker(color, 0.8), x, 0, z));
  g.add(box(1.3, 0.5, 0.46, color, 0, 0.72, 0));
  g.add(box(0.5, 0.56, 0.5, darker(color, 0.9), 0.45, 0.7, 0)); // shaggy ruff
  const neck = box(0.28, 0.5, 0.3, color, 0.62, 1.0, 0);
  neck.rotation.z = -0.6;
  g.add(neck);
  g.add(box(0.44, 0.3, 0.32, color, 0.98, 1.3, 0));
  g.add(box(0.32, 0.16, 0.2, darker(color, 1.15), 1.3, 1.3, 0)); // muzzle
  g.add(box(0.06, 0.06, 0.06, 0x1a1a1a, 1.47, 1.4, 0));
  for (const z of [-0.1, 0.1]) g.add(cone(0.07, 0.22, color, 4, 0.88, 1.58, z));
  for (const z of [-0.17, 0.17]) g.add(box(0.05, 0.05, 0.02, 0xf2d64b, 1.12, 1.48, z));
  const tail = box(0.5, 0.12, 0.12, color, -0.9, 1.0, 0);
  tail.rotation.z = 0.45;
  g.add(tail);
  return g;
}

/** A war boar with tusks and a bristled back: the goblins' heavy cavalry. */
function boar(): THREE.Group {
  const g = new THREE.Group();
  const hide = 0x5e4230;
  for (const [x, z] of [[-0.5, 0.22], [0.5, 0.22], [-0.5, -0.22], [0.5, -0.22]]) g.add(box(0.18, 0.55, 0.18, 0x3e2a1c, x, 0, z));
  g.add(box(1.45, 0.75, 0.72, hide, 0, 0.5, 0));
  g.add(box(1.1, 0.14, 0.14, 0x2e2016, 0, 1.25, 0)); // bristles
  g.add(box(0.52, 0.5, 0.56, hide, 0.86, 0.55, 0));
  const snout = cyl(0.16, 0.16, 0.08, 0xc98a7a, 8, 1.15, 0.72, 0);
  snout.rotation.z = Math.PI / 2;
  g.add(snout);
  for (const z of [-0.2, 0.2]) {
    const tusk = cone(0.05, 0.28, 0xf4efe0, 4, 1.12, 0.62, z);
    tusk.rotation.z = -0.5;
    g.add(tusk);
    g.add(box(0.05, 0.05, 0.02, 0xf2d64b, 1.0, 0.92, z * 1.3));
    g.add(cone(0.08, 0.18, hide, 4, 0.75, 1.02, z * 0.9));
  }
  // rusty armour plates over the back
  g.add(box(0.8, 0.12, 0.8, 0xb07a3a, -0.05, 1.18, 0));
  return g;
}

/** A great stag: the druids' riders go on these. */
function stag(color: number): THREE.Group {
  const g = horse(color);
  g.add(box(0.26, 0.1, 0.26, 0xefe0c0, 1.3, 1.72, 0)); // pale muzzle
  for (const z of [-1, 1]) {
    const a = new THREE.Group();
    a.add(cyl(0.035, 0.045, 0.7, 0xe8dcc0, 4, 0, 0, 0));
    const t1 = cyl(0.03, 0.035, 0.36, 0xe8dcc0, 4, 0, 0.3, 0);
    t1.rotation.x = z * 0.9;
    a.add(t1);
    const t2 = cyl(0.03, 0.035, 0.3, 0xe8dcc0, 4, 0, 0.55, 0);
    t2.rotation.z = -0.8;
    a.add(t2);
    a.position.set(0.95, 1.98, z * 0.1);
    a.rotation.x = z * 0.45;
    g.add(a);
  }
  return g;
}

/** A great brown bear: the druids' heavy cavalry. */
function bear(): THREE.Group {
  const g = new THREE.Group();
  const fur = 0x5e3f28;
  for (const [x, z] of [[-0.55, 0.24], [0.55, 0.24], [-0.55, -0.24], [0.55, -0.24]]) g.add(box(0.26, 0.6, 0.26, darker(fur, 0.8), x, 0, z));
  g.add(blob(0.62, fur, 0, 0.95, 0, 1.45, 0.75, 0.8));
  g.add(blob(0.42, fur, 0.5, 1.2, 0, 1, 0.9, 1)); // shoulder hump
  g.add(blob(0.3, fur, 1.0, 1.15, 0));
  g.add(box(0.24, 0.18, 0.22, 0xa7825a, 1.24, 1.04, 0));
  g.add(box(0.07, 0.07, 0.07, 0x1a1a1a, 1.37, 1.17, 0));
  for (const z of [-0.2, 0.2]) g.add(blob(0.09, fur, 0.92, 1.42, z));
  g.add(box(0.7, 0.1, 0.78, 0x4f7a2e, -0.05, 1.42, 0)); // a mossy saddle-cloth
  return g;
}

/**
 * A rider: a mount (facing +z like everyone else) with a soldier on its back.
 * Classic villages ride horses; goblins wolves and boars; druids stags and bears;
 * sorcerers storm-dark steeds, their knights in crystal-studded barding.
 */
function rider(kind: TroopModel): THREE.Group {
  if (kind === 'paladin') return paladinRider();
  const theme = getTheme();
  const g = new THREE.Group();
  let mount: THREE.Group;
  let seat = 1.3;
  if (theme === 'goblin') {
    mount = kind === 'heavy' ? boar() : wolf(kind === 'marcher' ? 0x5a5448 : 0x7d7a70);
    seat = kind === 'heavy' ? 1.2 : 1.1;
  } else if (theme === 'druid') {
    mount = kind === 'heavy' ? bear() : stag(kind === 'marcher' ? 0x7e5230 : 0xa8703e);
    seat = kind === 'heavy' ? 1.42 : 1.3;
  } else if (theme === 'sorcerer') {
    mount = horse({ light: 0x3a2f6a, marcher: 0x2a2350, heavy: 0xe6e0f6 }[kind as 'light'] ?? 0x3a2f6a);
  } else if (theme === 'necromancer') {
    mount = boneHorse(kind === 'heavy');
  } else if (theme === 'orc') {
    // warg riders and boar riders
    mount = kind === 'heavy' ? warBoar() : warg(kind === 'marcher' ? 0x2e2a28 : 0x5a5046);
    seat = kind === 'heavy' ? 1.32 : 1.26;
  } else if (theme === 'paladin') {
    // white and dapple-grey chargers
    mount = horse({ light: 0xe8e2d6, marcher: 0xc9c0b0, heavy: 0xf4f0e8 }[kind as 'light'] ?? 0xe8e2d6);
  } else {
    mount = horse({ light: C.horse, marcher: 0x4a3222, heavy: 0xd8d0c0 }[kind as 'light'] ?? C.horse);
  }
  mount.rotation.y = -Math.PI / 2;
  g.add(mount);
  if (theme === 'paladin') {
    // blue barding with a gold hem for every horse of the Order; the knights' goes down to the hooves
    g.add(box(0.66, kind === 'heavy' ? 0.62 : 0.34, 1.34, 0x2c56b0, 0, kind === 'heavy' ? 0.55 : 0.85, 0));
    g.add(box(0.68, 0.07, 1.36, C.gold, 0, kind === 'heavy' ? 0.55 : 0.85, 0));
  }
  if (kind === 'heavy' && (theme === 'classic' || theme === 'sorcerer')) {
    g.add(box(0.62, 0.3, 1.2, theme === 'sorcerer' ? 0x3c2470 : C.red, 0, 0.8, 0));
    if (theme === 'sorcerer') {
      for (const z of [-0.4, 0.1, 0.55]) {
        const c = mesh(new THREE.OctahedronGeometry(0.14, 0), 0xb58cff, { emissive: 0x5a2fb0 });
        c.position.set(0.34, 1.0, z);
        g.add(c);
      }
    }
  }
  if (theme === 'sorcerer' && kind !== 'heavy') {
    // a crackle of storm light in the mane
    const spark = mesh(new THREE.OctahedronGeometry(0.1, 0), 0x8fb8ff, { emissive: 0x3f6ad8 });
    spark.position.set(0, 2.1, 0.8);
    g.add(spark);
  }
  const tunic = { light: 0x8e3a1f, marcher: 0x4f7a2e, heavy: STEEL_DK }[kind as 'light'] ?? 0x8e3a1f;
  const man = person(tunic);
  man.scale.setScalar(0.85);
  man.position.set(0, seat, -0.1);
  g.add(man);
  if (kind === 'marcher') {
    const b = bow(theme === 'sorcerer' ? 0x7a64a0 : SHAFT);
    b.position.set(0.3, seat + 0.8, -0.1);
    g.add(b);
  } else {
    if (theme === 'classic') helmet(man, STEEL);
    if (theme === 'paladin') { helmet(man, 0xe6eef4); man.add(cone(0.07, 0.3, C.gold, 5, 0, 1.5)); }
    if (theme === 'orc') orcHelm(man, kind === 'heavy');
    g.add(cyl(0.035, 0.035, 2.4, SHAFT, 5, 0.34, seat + 0.3, 0));
    g.add(tip(0.08, 0.3, 0.34, seat + 2.7, 0));
    if (theme === 'paladin') g.add(box(0.03, 0.3, 0.5, 0x2c56b0, 0.34, seat + 2.25, 0.22)); // a pennant on the lance
  }
  for (const c of g.children) c.castShadow = true;
  return g;
}

/**
 * The paladin: a knight in full plate on a white charger. Royal blue barding,
 * tabard and cape, every edge picked out in gold, a gold-crested great helm and
 * a lance flying a blue-and-gold pennant.
 */
function paladinRider(): THREE.Group {
  const g = new THREE.Group();
  const h = horse(0xf1ece2);
  h.rotation.y = -Math.PI / 2;
  g.add(h);
  // barding: blue caparison with gold hems, and a steel chanfron on the head
  g.add(box(0.7, 0.42, 1.36, ROYAL, 0, 0.66, 0));
  g.add(box(0.74, 0.07, 1.4, GOLD_TRIM, 0, 0.62, 0));
  g.add(box(0.74, 0.07, 1.4, GOLD_TRIM, 0, 1.06, 0));
  g.add(box(0.32, 0.3, 0.62, STEEL, 0, 1.62, 0.95));
  g.add(box(0.34, 0.05, 0.64, GOLD_TRIM, 0, 1.9, 0.95));
  // the knight: steel plate under a blue tabard with a gold cross and gold edges
  const man = new THREE.Group();
  man.add(box(0.32, 0.32, 0.22, STEEL_DK, 0, 0, 0));
  man.add(cyl(0.22, 0.3, 0.78, STEEL, 7, 0, 0.3));
  man.add(box(0.46, 0.62, 0.04, ROYAL, 0, 0.36, 0.25));
  man.add(box(0.07, 0.5, 0.02, GOLD_TRIM, 0, 0.42, 0.28));
  man.add(box(0.32, 0.07, 0.02, GOLD_TRIM, 0, 0.72, 0.28));
  man.add(box(0.5, 0.05, 0.05, GOLD_TRIM, 0, 0.34, 0.25));
  // pauldrons with gold rims
  for (const x of [-0.3, 0.3]) {
    man.add(blob(0.17, STEEL, x, 1.0, 0, 1, 0.75, 1));
    man.add(box(0.3, 0.04, 0.3, GOLD_TRIM, x, 0.9, 0));
  }
  // great helm: steel, gold band and visor slit, gold crest with a blue plume
  man.add(cyl(0.21, 0.21, 0.42, STEEL, 8, 0, 1.08));
  man.add(cyl(0.225, 0.225, 0.06, GOLD_TRIM, 8, 0, 1.28));
  man.add(box(0.3, 0.04, 0.02, 0x1a1a1a, 0, 1.36, 0.2));
  man.add(box(0.05, 0.22, 0.34, GOLD_TRIM, 0, 1.5, 0));
  man.add(blob(0.12, ROYAL, 0, 1.68, -0.12, 0.8, 1.2, 1.6));
  // cape
  const cape = box(0.5, 1.0, 0.04, ROYAL, 0, -0.1, -0.24);
  cape.rotation.x = 0.18;
  man.add(cape);
  man.add(box(0.52, 0.05, 0.05, GOLD_TRIM, 0, -0.1, -0.25));
  // kite shield on the left arm: blue field, gold rim and cross
  const shield = new THREE.Group();
  shield.add(box(0.06, 0.62, 0.44, GOLD_TRIM, 0, 0, 0));
  shield.add(box(0.07, 0.54, 0.36, ROYAL, 0, 0.04, 0));
  shield.add(box(0.08, 0.4, 0.06, GOLD_TRIM, 0, 0.1, 0));
  shield.add(box(0.08, 0.06, 0.28, GOLD_TRIM, 0, 0.3, 0));
  shield.position.set(-0.36, 0.3, 0.05);
  man.add(shield);
  man.scale.setScalar(0.85);
  man.position.set(0, 1.3, -0.1);
  g.add(man);
  // lance with a swallow-tail pennant
  g.add(cyl(0.04, 0.04, 2.8, 0xf1ece2, 6, 0.34, 1.5, 0.1));
  g.add(cyl(0.06, 0.06, 0.08, GOLD_TRIM, 6, 0.34, 2.2, 0.1));
  g.add(cone(0.08, 0.34, STEEL, 5, 0.34, 4.3, 0.1));
  const glint = mesh(new THREE.OctahedronGeometry(0.1, 0), 0xfff0b0, { emissive: 0xc08a1a });
  glint.position.set(0.34, 4.5, 0.1);
  glint.userData.pulse = true;
  g.add(glint);
  g.add(box(0.03, 0.3, 0.5, ROYAL, 0.34, 3.9, -0.16));
  g.add(box(0.035, 0.05, 0.5, GOLD_TRIM, 0.34, 4.18, -0.16));
  for (const c of g.children) c.castShadow = true;
  for (const c of man.children) c.castShadow = true;
  return g;
}

export function troop(kind: TroopModel): THREE.Group {
  return kind === 'light' || kind === 'marcher' || kind === 'heavy' || kind === 'paladin' ? rider(kind) : footSoldier(kind);
}

export const isRider = (k: TroopModel) => k === 'light' || k === 'marcher' || k === 'heavy' || k === 'paladin';

// ---------- hero themes: landmarks ----------

/** A shrine of the sun: a white column on stepped marble, a golden sun shining on its top (paladin villages). */
export function sunShrine(r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(1.6, 1.7, 0.3, 0xd9d1bd, 8));
  g.add(cyl(1.15, 1.2, 0.3, 0xece6d6, 8, 0, 0.3));
  g.add(cyl(0.34, 0.4, 3.6, 0xf6f1e4, 10, 0, 0.6));
  g.add(cyl(0.52, 0.42, 0.34, C.gold, 10, 0, 4.2));
  const sun = new THREE.Group();
  sun.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.14, 16).rotateX(Math.PI / 2), 0xffd35a, { emissive: 0xa0701a }));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const ray = mesh(new THREE.ConeGeometry(0.1, i % 2 ? 0.38 : 0.62, 4), 0xffd35a, { emissive: 0xa0701a });
    ray.position.set(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0);
    ray.rotation.z = a - Math.PI / 2;
    sun.add(ray);
  }
  sun.position.set(0, 5.4, 0);
  sun.rotation.y = r() * Math.PI;
  g.add(sun);
  // roses at its foot
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r();
    g.add(blob(0.32, 0x3f6a2a, Math.cos(a) * 1.9, 0.2, Math.sin(a) * 1.9, 1, 0.7, 1));
    g.add(blob(0.12, r() < 0.5 ? 0xe0506a : 0xf0f0f0, Math.cos(a) * 1.9, 0.5, Math.sin(a) * 1.9));
  }
  return g;
}

/** A cluster of glowing arcane crystals on a rune stone (sorcerer villages). */
export function crystalSpire(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(1.1, 1.3, 0.5, 0x5b5a72, 6));
  const shards: [number, number, number, number, number][] = [
    [0, 0, 0.42, 3.4, 0], [0.55, 0.2, 0.3, 2.2, 0.35], [-0.5, -0.25, 0.28, 1.9, -0.3], [0.1, -0.55, 0.22, 1.5, 0.2],
  ];
  for (const [x, z, r, h, tilt] of shards) {
    const s = mesh(new THREE.OctahedronGeometry(r, 0), 0xb58cff, { emissive: 0x5a2fb0 });
    s.scale.set(1, h / r / 2, 1);
    s.position.set(x, 0.5 + h / 2, z);
    s.rotation.z = tilt;
    g.add(s);
  }
  return g;
}

/** An ancient oak of the grove (druid villages): a gnarled trunk on buttress roots under a layered crown hung
 *  with lanterns and vines, a ring of rune stones glowing faintly round it, toadstools and fireflies at its feet. */
export function greatTree(r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(gnarledTrunk(0.45, 0.72, 3.6, r, { roots: 5, rootR: 0.22, spread: 1.6 }));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    g.add(branch(new THREE.Vector3(0, 2.8, 0), new THREE.Vector3(Math.cos(a) * 1.5, 4.0, Math.sin(a) * 1.5), 0.18));
  }
  const can = druidCanopy({ r: 2.3, h: 2.3, rand: r, droop: 4, blossom: 5, vines: 6, lanterns: 2, dense: 0.8, glow: 4 });
  can.position.y = 3.3;
  g.add(can);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const st = runeStone(1.1 + r() * 0.5, r, i % 2 === 0);
    st.scale.setScalar(0.85);
    st.position.set(Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35);
    st.rotation.y = Math.PI / 2 - a;
    g.add(st);
  }
  g.add(toadstools(5, r, 0.9, false, 0.5).translateX(0.9).translateZ(-0.6));
  const ff = fireflies(7, 2.4, 2.4, r);
  ff.position.y = 0.8;
  g.add(ff);
  return g;
}

/** A black obelisk among leaning gravestones, a green flame on top (necromancer villages). */
export function necroObelisk(r: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.2, 0.3, 1.2, 0x4e4c52));
  g.add(box(0.7, 3.4, 0.7, 0x2e2a33, 0, 0.3, 0));
  g.add(cone(0.5, 0.9, 0x2e2a33, 4, 0, 3.7, 0).rotateY(Math.PI / 4));
  const flame = mesh(new THREE.IcosahedronGeometry(0.22, 0), 0x5cff9a, { emissive: 0x1f9a4a });
  flame.position.y = 4.85;
  g.add(flame);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    g.add(gravestone(r, Math.cos(a) * 1.9, Math.sin(a) * 1.9, -a));
  }
  return g;
}

/** A leaning gravestone with a rounded top. */
export function gravestone(r: () => number, x: number, z: number, face = 0): THREE.Group {
  const g = new THREE.Group();
  const col = r() < 0.5 ? 0x8a8890 : 0x74727a;
  g.add(box(0.6, 0.75, 0.16, col));
  const top = cyl(0.3, 0.3, 0.16, col, 8, 0, 0.75, 0);
  top.rotation.x = Math.PI / 2;
  top.position.set(0, 0.75, 0);
  g.add(top);
  g.add(box(0.05, 0.3, 0.02, 0x3a3840, 0, 0.45, 0.09), box(0.2, 0.05, 0.02, 0x3a3840, 0, 0.62, 0.09));
  g.position.set(x, 0, z);
  g.rotation.set((r() - 0.5) * 0.25, face, (r() - 0.5) * 0.25);
  return g;
}

/** A crooked pole of skulls and green rags (goblin camps). */
export function skullTotem(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.12, 0.18, 3.6, 0x3e2a18, 5));
  for (const y of [1.6, 2.6, 3.5]) {
    g.add(blob(0.3, 0xe8dfc8, 0, y, 0.12, 1, 0.9, 1));
    g.add(box(0.1, 0.1, 0.06, 0x1a1a1a, -0.1, y, 0.4));
    g.add(box(0.1, 0.1, 0.06, 0x1a1a1a, 0.1, y, 0.4));
  }
  g.add(box(0.9, 0.5, 0.05, 0x6f9a2a, 0.5, 3.0, 0));
  for (const a of [0, 2.1, 4.2]) {
    const sp = cone(0.12, 0.9, 0x3e2a18, 4, Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
    sp.rotation.z = Math.cos(a) * 0.4;
    sp.rotation.x = -Math.sin(a) * 0.4;
    g.add(sp);
  }
  return g;
}

/** What crowns the headquarters in each hero's village. */
export function hqCrown(theme: 'sorcerer' | 'druid' | 'goblin' | 'necromancer' | 'orc', r: () => number): THREE.Group {
  const g = new THREE.Group();
  if (theme === 'orc') {
    // a horned skull on a stake, embers in its eyes
    g.add(cyl(0.1, 0.12, 2.4, C.timber, 5));
    const sk = orcSkull(0.7, true);
    sk.position.set(0, 2.6, 0);
    g.add(sk);
    g.add(hornPair(0.3, 2.8, 0, 0.6, 1.0, 0.1, 0.12));
    return g;
  }
  if (theme === 'necromancer') {
    // a black gothic spire with a great skull, green fire in its eyes and crown
    g.add(cyl(1.5, 1.8, 0.4, 0x2e2a33, 8));
    g.add(cone(1.1, 3.6, 0x221f27, 8, 0, 0.35));
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) g.add(cone(0.35, 1.6, 0x221f27, 6, Math.cos(a) * 1.25, 0.35, Math.sin(a) * 1.25));
    const sk = new THREE.Group();
    sk.add(blob(0.62, BONE, 0, 0, 0, 1, 0.95, 1));
    sk.add(box(0.5, 0.3, 0.36, BONE_DARK, 0, -0.62, 0.16));
    for (const x of [-0.22, 0.22]) {
      sk.add(box(0.2, 0.2, 0.1, 0x141010, x, -0.05, 0.56));
      sk.add(mesh(new THREE.OctahedronGeometry(0.09, 0), 0x5cff9a, { emissive: 0x1f9a4a }).translateX(x).translateY(0.05).translateZ(0.6));
    }
    sk.position.set(0, 2.0, 0.95);
    g.add(sk);
    const fire = mesh(new THREE.IcosahedronGeometry(0.35, 0), 0x5cff9a, { emissive: 0x1f9a4a });
    fire.position.set(0, 4.2, 0);
    g.add(fire);
    return g;
  }
  if (theme === 'sorcerer') {
    // a giant wizard hat, bent at the tip, with a gold band and stars
    g.add(cyl(2.3, 2.3, 0.22, 0x3c2470, 16));
    g.add(cyl(1.45, 1.55, 0.45, 0xe9b83a, 16, 0, 0.2));
    g.add(cone(1.45, 3.1, 0x4b2f86, 16, 0, 0.62));
    const tip = cone(0.72, 1.9, 0x4b2f86, 12);
    tip.position.set(0.35, 3.25, 0);
    tip.rotation.z = -0.6;
    g.add(tip);
    for (const [x, y, z] of [[0.9, 1.5, 0.75], [-0.8, 1.9, 0.6], [0.2, 2.6, 0.62], [-0.4, 1.2, -1.0]]) {
      const st = mesh(new THREE.OctahedronGeometry(0.18, 0), 0xf3d36a, { emissive: 0x7a5a10 });
      st.position.set(x, y, z);
      g.add(st);
    }
  } else if (theme === 'druid') {
    // an old tree has grown right through the roof
    g.add(cyl(0.35, 0.5, 2.2, 0x4a3420, 6));
    for (const [x, y, z, s] of [[0, 2.8, 0, 1.6], [1.1, 2.4, 0.3, 1.1], [-1, 2.5, -0.3, 1.2], [0.1, 3.7, 0, 1]]) {
      g.add(blob(s, r() < 0.5 ? 0x5e8c34 : 0x4f7a2e, x, y, z, 1, 0.8, 1, 1));
    }
  } else {
    // crude iron spikes, a skull and a green rag
    for (let i = -2; i <= 2; i++) g.add(cone(0.18, 1.1, 0x3b3530, 4, i * 0.7, 0, 0));
    g.add(cyl(0.08, 0.08, 2.6, 0x3e2a18, 5, 0, 0));
    g.add(blob(0.32, 0xe8dfc8, 0, 2.7, 0));
    g.add(box(0.1, 0.1, 0.06, 0x1a1a1a, -0.11, 2.72, 0.3));
    g.add(box(0.1, 0.1, 0.06, 0x1a1a1a, 0.11, 2.72, 0.3));
    g.add(box(1.1, 0.6, 0.05, 0x6f9a2a, 0.6, 1.9, 0));
  }
  return g;
}
