// Scenery and small props, all built from primitives.

import * as THREE from 'three';
import { C, blob, box, cone, cyl, darker, getSeason, mesh } from './kit';

const AUTUMN = [C.leafOrange, C.leafRed, C.leafYellow, C.leafGold, C.leafOrange, C.leafGreen];

export function tree(kind: 'oak' | 'pine' | 'birch', r: () => number, scale = 1): THREE.Group {
  const g = new THREE.Group();
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

export function rock(r: () => number, s = 1, color: number = C.rock): THREE.Mesh {
  const m = blob(0.8 * s, r() < 0.5 ? color : C.rockDark, 0, 0.25 * s, 0, 1 + r() * 0.5, 0.55 + r() * 0.3, 1 + r() * 0.4);
  m.rotation.set(r(), r() * 3, r());
  return m;
}

export function crate(x = 0, z = 0, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.8 * s, 0.8 * s, 0.8 * s, 0xb08452));
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
export function person(tunic: number): THREE.Group {
  const g = new THREE.Group();
  const body = cyl(0.2, 0.28, 0.75, tunic, 6, 0, 0.3);
  const head = blob(0.2, C.skin, 0, 1.25, 0);
  const legs = box(0.3, 0.32, 0.2, C.dark, 0, 0, 0);
  g.add(legs, body, head);
  for (const c of g.children) c.castShadow = true;
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

export type TroopModel = 'spear' | 'sword' | 'axe' | 'archer' | 'scout' | 'noble' | 'light' | 'marcher' | 'heavy' | 'paladin' | 'sorcerer' | 'druid' | 'goblin';

function helmet(g: THREE.Group, color = STEEL) {
  g.add(cyl(0.16, 0.23, 0.2, color, 7, 0, 1.3));
}

function bow(color = SHAFT): THREE.Mesh {
  const m = mesh(new THREE.TorusGeometry(0.45, 0.035, 4, 10, Math.PI), color);
  m.rotation.set(0, Math.PI / 2, Math.PI / 2);
  return m;
}

/** One of your soldiers on foot, carrying what their unit is known for. */
function footSoldier(kind: TroopModel): THREE.Group {
  if (kind === 'goblin') return goblin();
  const tunic = { spear: 0x2f5d99, sword: 0x8e3a1f, axe: 0x5a3a22, archer: 0x4f7a2e, scout: 0x3b3a30, noble: C.red, sorcerer: 0x5b3596, druid: 0x4f7a2e }[kind as 'spear'] ?? 0x6f7c35;
  const g = person(tunic);
  switch (kind) {
    case 'spear':
      helmet(g);
      g.add(cyl(0.035, 0.035, 2.3, SHAFT, 5, 0.34, 0.1, 0.1));
      g.add(cone(0.09, 0.32, STEEL, 5, 0.34, 2.4, 0.1));
      break;
    case 'sword': {
      helmet(g);
      const blade = box(0.07, 0.8, 0.03, STEEL, 0, 0, 0);
      blade.position.set(0.34, 0.55, 0.22);
      blade.rotation.x = 0.5;
      g.add(blade);
      const shield = cyl(0.36, 0.36, 0.06, C.red, 10);
      shield.rotation.z = Math.PI / 2;
      shield.position.set(-0.26, 0.72, 0);
      g.add(shield);
      break;
    }
    case 'axe': {
      const handle = box(0.06, 1.1, 0.06, SHAFT);
      handle.position.set(0.3, 0.9, -0.1);
      handle.rotation.x = -0.55;
      g.add(handle);
      const head = box(0.05, 0.3, 0.26, STEEL);
      head.position.set(0.3, 1.78, -0.62);
      head.rotation.x = -0.55;
      g.add(head);
      break;
    }
    case 'archer': {
      const b = bow();
      b.position.set(0.32, 0.8, 0);
      g.add(b);
      g.add(box(0.16, 0.5, 0.12, 0x6e4220, 0, 0.6, -0.26));
      g.add(cone(0.24, 0.35, 0x3a4f22, 6, 0, 1.3));
      break;
    }
    case 'scout':
      g.add(cone(0.26, 0.5, 0x2a2a22, 6, 0, 1.2));
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
      break;
    }
    case 'noble':
      g.add(cyl(0.17, 0.17, 0.14, C.gold, 6, 0, 1.4));
      g.add(box(0.55, 0.9, 0.06, 0x2f5d99, 0, 0.2, -0.24));
      break;
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

/** A rider: a horse (facing +z like everyone else) with a soldier on its back. */
function rider(kind: TroopModel): THREE.Group {
  if (kind === 'paladin') return paladinRider();
  const g = new THREE.Group();
  const coat = { light: C.horse, marcher: 0x4a3222, heavy: 0xd8d0c0 }[kind as 'light'] ?? C.horse;
  const h = horse(coat);
  h.rotation.y = -Math.PI / 2;
  g.add(h);
  if (kind === 'heavy') g.add(box(0.62, 0.3, 1.2, C.red, 0, 0.8, 0));
  const tunic = { light: 0x8e3a1f, marcher: 0x4f7a2e, heavy: STEEL_DK }[kind as 'light'] ?? 0x8e3a1f;
  const man = person(tunic);
  man.scale.setScalar(0.85);
  man.position.set(0, 1.3, -0.1);
  g.add(man);
  if (kind === 'marcher') {
    const b = bow();
    b.position.set(0.3, 2.1, -0.1);
    g.add(b);
  } else {
    helmet(man, STEEL);
    g.add(cyl(0.035, 0.035, 2.4, SHAFT, 5, 0.34, 1.6, 0));
    g.add(cone(0.08, 0.3, STEEL, 5, 0.34, 4, 0));
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
