// Mastery: every building that reaches its highest level earns a finishing touch in
// its village's style, sized to the building. A roof crown, standards at its front
// corners, a paved and inlaid apron, and something of its own trade (a gilded anvil
// at the smithy, a golden horse at the stable, a beacon on the watchtower...).
//
// Everything stays inside the building's own footprint, so the village layout holds.

import * as THREE from 'three';
import type { BuildingId } from '../../engine/types';
import { BLOOD, BONE_W, C, EMBER, EMBER_E, IRON_BK, blob, box, cone, cyl, getTheme, hornPair, leafCluster, mesh, orcSkull, swarm, type Theme } from './kit';
import { oasisCrown, oasisStandard } from './oasis';
import { forgeCrown, forgeGoldGoat, forgeStandard } from './deepforge';
import { saurianCrown, saurianStandard, saurianTrophy } from './templecity';
import { frostMasteryCrown, frostMasteryStandard } from './frosthold';

const GOLD = 0xe9b83a, GOLD_E = 0x6a4a10;

interface Box2 { x0: number; x1: number; z0: number; z1: number; top: number; w: number; d: number }

/** The glowing and gilded colours of each village's mastery. */
const LOOK: Record<Theme, { main: number; glow: number; glowE: number; accent: number }> = {
  classic: { main: GOLD, glow: 0xffd27a, glowE: 0xa06a10, accent: 0xb3332a },
  paladin: { main: GOLD, glow: 0xffe39a, glowE: 0xb08020, accent: 0x2c56b0 },
  sorcerer: { main: 0xd9c6ff, glow: 0xc6a2ff, glowE: 0x6a38d0, accent: 0x5b36b0 },
  druid: { main: 0xe8c86a, glow: 0xf4ff9a, glowE: 0x7a9a20, accent: 0x4f7a2e },
  goblin: { main: GOLD, glow: 0x9aff3a, glowE: 0x4a9a10, accent: 0x6f9a2a },
  necromancer: { main: 0xe6dfcc, glow: 0x5cff9a, glowE: 0x1f9a4a, accent: 0x2f7a4a },
  orc: { main: BONE_W, glow: EMBER, glowE: EMBER_E, accent: BLOOD },
  frost: { main: 0xdff0fc, glow: 0xd8f7ff, glowE: 0x3cb2e8, accent: 0x5b9bd8 },
  dwarf: { main: GOLD, glow: 0xffa04a, glowE: 0xa04a10, accent: 0xb8452a },
  djinn: { main: GOLD, glow: 0x7af0e8, glowE: 0x1a8a8a, accent: 0x2a9a9a },
  saurian: { main: 0x5ab48a, glow: 0x7affb0, glowE: 0x1a8a4a, accent: 0xc8402a },
};

const glowMesh = (geo: THREE.BufferGeometry, c: number, e: number) => mesh(geo, c, { emissive: e });

/** A standard at a corner, in the village's fashion. */
function standard(th: Theme, h: number): THREE.Group {
  const g = new THREE.Group();
  const L = LOOK[th];
  switch (th) {
    case 'sorcerer': {
      g.add(cyl(0.18, 0.24, 0.4, C.stoneDark, 6));
      g.add(cyl(0.05, 0.06, h, 0x2c2340, 5, 0, 0.4));
      const c = glowMesh(new THREE.OctahedronGeometry(0.32, 0), L.glow, L.glowE);
      c.scale.set(1, 1.8, 1);
      c.position.y = h + 0.9;
      c.userData.dynamic = true;
      c.userData.orbit = 1.2;
      c.userData.bob = 0.15;
      g.add(c);
      break;
    }
    case 'druid': {
      // a living staff: ivy wound up it, a leaf crown and a glowing seed at its tip
      g.add(cyl(0.1, 0.16, h, 0x5a3f28, 5));
      for (let i = 0; i < 4; i++) g.add(leafCluster(0.3, i % 2 ? 'deep' : 'mid', Math.cos(i * 1.6) * 0.3, h * (0.4 + i * 0.15), Math.sin(i * 1.6) * 0.3, 1, 0.8, 1, 0, i));
      g.add(leafCluster(0.34, 'sun', 0, h + 0.05, 0, 1.2, 0.6, 1.2, 0, 7));
      g.add(glowMesh(new THREE.IcosahedronGeometry(0.16, 0), L.glow, L.glowE).translateY(h + 0.42));
      g.add(blob(0.13, 0xe88aa6, 0.25, h * 0.7, 0.2), blob(0.13, 0xf4f1e6, -0.2, h * 0.85, 0.15));
      break;
    }
    case 'goblin': {
      g.add(cyl(0.07, 0.1, h, C.timber, 4));
      g.add(blob(0.3, 0xe6dfcc, 0, h + 0.2, 0, 1, 0.9, 1));
      g.add(cyl(0.2, 0.2, 0.06, GOLD, 6, 0, h + 0.46, 0));
      const rag = box(0.8, 0.55, 0.05, L.accent, 0.45, h - 0.7, 0);
      rag.userData.flag = true;
      g.add(rag);
      break;
    }
    case 'djinn': {
      // a brass lamp-post flying a teal pennant, its lantern lit at night
      g.add(oasisStandard(h));
      break;
    }
    case 'dwarf': {
      // an oak pole on a stone foot, a gold bar, a rune-red banner with a rune on it
      g.add(forgeStandard(h, L.accent));
      break;
    }
    case 'saurian': {
      // a pole crowned with a gilded serpent's head, a jade orb under it and a red streamer
      g.add(saurianStandard(h));
      break;
    }
    case 'frost': {
      // a silver pole, a crystal of ice glowing on its top, a frost pennant under a band of fur
      g.add(frostMasteryStandard(h));
      break;
    }
    case 'orc': {
      // a war pike: a horned skull on top, a blood-red rag, a fire basket glowing under the skull
      g.add(cyl(0.07, 0.1, h, C.timber, 5));
      g.add(cyl(0.26, 0.16, 0.26, IRON_BK, 6, 0, h - 0.9));
      g.add(glowMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 6), L.glow, L.glowE).translateY(h - 0.64));
      const sk = orcSkull(0.4, true);
      sk.position.y = h + 0.2;
      g.add(sk);
      g.add(hornPair(0.16, h + 0.3, 0, 0.3, 0.5, 0.05, 0.06));
      const rag = box(0.5, 0.8, 0.04, L.accent, 0.3, h - 1.8, 0);
      rag.userData.flag = true;
      g.add(rag);
      break;
    }
    case 'necromancer': {
      g.add(cyl(0.07, 0.09, h, 0x2e2a33, 4));
      g.add(cyl(0.3, 0.2, 0.3, 0x2e2a33, 6, 0, h));
      const f = glowMesh(new THREE.ConeGeometry(0.24, 0.7, 6).translate(0, 0.35, 0), L.glow, L.glowE);
      f.position.y = h + 0.25;
      f.userData.dynamic = true;
      f.userData.fire = true;
      g.add(f);
      break;
    }
    case 'paladin': {
      g.add(box(0.22, h, 0.22, C.stoneLight));
      const sun = new THREE.Group();
      sun.add(glowMesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12).rotateX(Math.PI / 2), 0xffd35a, 0x8a5a10));
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const ray = glowMesh(new THREE.ConeGeometry(0.06, 0.26, 4), 0xffd35a, 0x8a5a10); ray.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0); ray.rotation.z = a - Math.PI / 2; sun.add(ray); }
      sun.position.y = h + 0.5;
      sun.userData.dynamic = true;
      sun.userData.spin = true;
      g.add(sun);
      const p = box(0.6, 0.9, 0.04, L.accent, 0.35, h - 1.1, 0);
      p.userData.flag = true;
      g.add(p);
      break;
    }
    default: {
      g.add(cyl(0.06, 0.07, h, C.woodDark, 5));
      g.add(cone(0.12, 0.3, GOLD, 5, 0, h));
      const fl = box(0.9, 0.55, 0.04, L.accent, 0.48, h - 0.7, 0);
      fl.userData.flag = true;
      g.add(fl);
      g.add(box(0.9, 0.08, 0.05, GOLD, 0.48, h - 0.72, 0));
    }
  }
  return g;
}

/** Something over the roof: bigger on bigger buildings. */
function crown(th: Theme, s: number): THREE.Group {
  const g = new THREE.Group();
  const L = LOOK[th];
  switch (th) {
    case 'sorcerer': {
      const ring = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const c = glowMesh(new THREE.OctahedronGeometry(0.2 * s, 0), i % 2 ? 0x8fe8ff : L.glow, i % 2 ? 0x2a8ab8 : L.glowE);
        c.scale.set(1, 1.7, 1);
        c.position.set(Math.cos(a) * 1.1 * s, 0, Math.sin(a) * 1.1 * s);
        ring.add(c);
      }
      ring.userData.dynamic = true;
      ring.userData.orbit = 0.7;
      ring.userData.bob = 0.2 * s;
      g.add(ring);
      break;
    }
    case 'druid': {
      // a crown of blossom, and fireflies circling it (merged into one mesh)
      g.add(leafCluster(0.55 * s, 'mid', 0, 0, 0, 1, 0.6, 1, 1, 11));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(blob(0.14 * s, i % 2 ? 0xe88aa6 : 0xf4f1e6, Math.cos(a) * 0.45 * s, 0.25 * s, Math.sin(a) * 0.45 * s)); }
      const parts = new THREE.Group();
      for (let i = 0; i < 6; i++) parts.add(glowMesh(new THREE.OctahedronGeometry(0.09, 0), L.glow, L.glowE).translateX(Math.cos(i) * 1.3 * s).translateY((i % 3) * 0.4).translateZ(Math.sin(i) * 1.3 * s));
      g.add(swarm(parts, { orbit: 0.4, bob: 0.3 }));
      break;
    }
    case 'goblin': {
      // the chief's biggest gold coin, stood on edge, turning
      const coin = new THREE.Group();
      coin.add(glowMesh(new THREE.CylinderGeometry(0.55 * s, 0.55 * s, 0.12 * s, 14).rotateX(Math.PI / 2), GOLD, GOLD_E));
      coin.add(box(0.2 * s, 0.5 * s, 0.14 * s, 0xc98a20, 0, -0.25 * s, 0));
      coin.userData.dynamic = true;
      coin.userData.orbit = 1.0;
      coin.position.y = 0.7 * s;
      g.add(coin);
      g.add(cyl(0.05, 0.05, 0.7 * s, C.timber, 4));
      break;
    }
    case 'djinn': {
      // a little golden lamp turning in the air, a wisp of blue smoke over it and gold motes about it
      g.add(oasisCrown(s));
      break;
    }
    case 'dwarf': {
      // a golden anvil on a block of basalt, sparks circling it
      g.add(forgeCrown(s));
      break;
    }
    case 'saurian': {
      // a sun-disc of glowing gold turning on a stepped stand, jade and gold motes about it
      g.add(saurianCrown(s));
      break;
    }
    case 'frost': {
      // a little crown of ice, turning slowly
      g.add(frostMasteryCrown(s));
      break;
    }
    case 'orc': {
      // a great horned skull, embers for eyes, and sparks drifting up about it
      const sk = orcSkull(0.6 * s, true);
      sk.position.y = 0.45 * s;
      g.add(sk);
      g.add(hornPair(0.25 * s, 0.6 * s, 0, 0.55 * s, 0.9 * s, 0.1 * s, 0.1 * s));
      const parts = new THREE.Group();
      for (let i = 0; i < 7; i++) parts.add(glowMesh(new THREE.OctahedronGeometry(0.08, 0), i % 2 ? L.glow : 0xffc060, i % 2 ? L.glowE : 0xd07a20).translateX(Math.cos(i * 0.9) * 0.9 * s).translateY((i % 4) * 0.35).translateZ(Math.sin(i * 0.9) * 0.9 * s));
      g.add(swarm(parts, { orbit: 0.3, bob: 0.4 }));
      break;
    }
    case 'necromancer': {
      const wisps = new THREE.Group();
      for (let i = 0; i < 4; i++) wisps.add(glowMesh(new THREE.IcosahedronGeometry(0.14 * s, 1), L.glow, L.glowE).translateX(Math.cos(i * 1.57) * 0.9 * s).translateY((i % 2) * 0.4 * s).translateZ(Math.sin(i * 1.57) * 0.9 * s));
      wisps.userData.dynamic = true;
      wisps.userData.orbit = -0.9;
      wisps.userData.bob = 0.2 * s;
      g.add(wisps);
      g.add(cone(0.1 * s, 0.9 * s, 0x2e2a33, 4));
      break;
    }
    case 'paladin': {
      const sun = new THREE.Group();
      sun.add(glowMesh(new THREE.CylinderGeometry(0.4 * s, 0.4 * s, 0.08, 14).rotateX(Math.PI / 2), 0xffd35a, 0x8a5a10));
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const ray = glowMesh(new THREE.ConeGeometry(0.07 * s, (i % 2 ? 0.3 : 0.5) * s, 4), 0xffd35a, 0x8a5a10); ray.position.set(Math.cos(a) * 0.6 * s, Math.sin(a) * 0.6 * s, 0); ray.rotation.z = a - Math.PI / 2; sun.add(ray); }
      sun.position.y = 0.9 * s;
      sun.userData.dynamic = true;
      sun.userData.spin = true;
      g.add(sun, cyl(0.05, 0.05, 0.9 * s, GOLD, 5));
      break;
    }
    default: {
      // a gilded weathervane with a star
      g.add(cyl(0.05, 0.05, 1.0 * s, GOLD, 5));
      g.add(box(0.9 * s, 0.05, 0.05, GOLD, 0, 0.7 * s, 0));
      g.add(glowMesh(new THREE.OctahedronGeometry(0.2 * s, 0), 0xffe39a, 0xa06a10).translateY(1.15 * s));
    }
  }
  return g;
}

/** A paved apron round the foot of the building, with an inlaid border in the village's colours. */
function apron(th: Theme, b: Box2): THREE.Group {
  const g = new THREE.Group();
  const L = LOOK[th];
  const w = b.w + 0.2, d = b.d + 0.2;
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  const edge = th === 'druid' ? 0x6f9a3a : th === 'goblin' ? 0x7a5a2a : th === 'necromancer' ? 0x3a3440 : th === 'orc' ? 0x33241a : th === 'dwarf' ? 0x3a3432 : th === 'saurian' ? 0x777b67 : th === 'frost' ? 0x8a97a8 : C.stoneLight;
  for (const [x, z, ww, dd] of [[cx, b.z1, w, 0.18], [cx, b.z0, w, 0.18], [b.x0, cz, 0.18, d], [b.x1, cz, 0.18, d]] as [number, number, number, number][]) {
    g.add(box(ww, 0.08, dd, edge, x, 0.02, z));
    g.add(box(Math.max(0.06, ww - 0.1), 0.03, Math.max(0.06, dd - 0.1), L.main, x, 0.1, z));
  }
  return g;
}

/** What each building gets for its own trade. */
function trade(id: BuildingId, th: Theme, b: Box2): THREE.Object3D | null {
  const L = LOOK[th];
  const g = new THREE.Group();
  const fx = (b.x0 + b.x1) / 2, fz = b.z1 - 0.9; // at the front
  // (the temple-city sets a golden raptor at its stable)
  const own = th === 'saurian' ? saurianTrophy(id) : null;
  if (own) { own.position.set(b.x0 + 1.0, 0, fz); return own; }
  switch (id) {
    case 'smithy': {
      g.add(box(0.9, 0.7, 0.7, C.stoneDark));
      g.add(glowMesh(new THREE.BoxGeometry(0.8, 0.25, 0.32).translate(0, 0.83, 0), GOLD, GOLD_E));
      g.add(cone(0.16, 0.4, GOLD, 4, 0.52, 0.72, 0).rotateZ(-Math.PI / 2));
      g.position.set(b.x1 - 1.0, 0, fz);
      return g;
    }
    case 'stable': {
      // (the Forgelord's stable keeps a golden war-ram)
      if (th === 'dwarf') { g.add(forgeGoldGoat()); g.position.set(b.x0 + 1.0, 0, fz); return g; }
      // a gilded horse on a plinth
      g.add(box(1.2, 0.5, 0.6, C.stoneLight));
      g.add(box(0.9, 0.45, 0.32, GOLD, 0, 0.9, 0));
      for (const [x, z] of [[-0.35, -0.1], [0.35, -0.1], [-0.35, 0.1], [0.35, 0.1]]) g.add(box(0.08, 0.4, 0.08, GOLD, x, 0.5, z));
      const neck = box(0.18, 0.55, 0.2, GOLD, 0.45, 1.15, 0);
      neck.rotation.z = -0.5;
      g.add(neck, box(0.32, 0.18, 0.18, GOLD, 0.72, 1.55, 0));
      g.position.set(b.x0 + 1.0, 0, fz);
      return g;
    }
    case 'barracks': {
      // a trophy rack: crossed blades and a shield
      g.add(box(1.6, 0.12, 0.12, C.woodDark, 0, 1.4, 0));
      for (const s of [-1, 1]) { const bl = box(0.08, 1.4, 0.04, 0xe6eef4, s * 0.3, 0.4, 0.05); bl.rotation.z = s * 0.5; g.add(bl); }
      g.add(cyl(0.4, 0.4, 0.08, L.accent, 10, 0, 1.0, 0.1).rotateX(Math.PI / 2));
      g.add(blob(0.12, GOLD, 0, 1.0, 0.16));
      for (const x of [-0.8, 0.8]) g.add(box(0.1, 1.6, 0.1, C.woodDark, x, 0, 0));
      g.position.set(b.x1 - 1.2, 0, fz);
      return g;
    }
    case 'warehouse': {
      // stores piled to overflowing, a chest of coin on top
      for (let i = 0; i < 5; i++) g.add(box(0.7, 0.6, 0.7, i % 2 ? 0x8a6a48 : 0x6e4a2a, (i % 3) * 0.75 - 0.75, i > 2 ? 0.6 : 0, (i % 2) * 0.3));
      g.add(blob(0.3, GOLD, 0, 1.3, 0.1, 1.2, 0.5, 1));
      g.position.set(b.x0 + 1.2, 0, fz);
      return g;
    }
    case 'market': {
      // bunting strung across the stalls
      const n = 9;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const x = b.x0 + 0.4 + k * (b.w - 0.8);
        const y = 3.0 - Math.sin(k * Math.PI) * 0.5;
        g.add(cone(0.16, 0.3, i % 2 ? L.accent : L.main, 3, x, y - 0.3, fz).rotateZ(Math.PI));
      }
      g.add(box(b.w - 0.6, 0.03, 0.03, 0x8a7a5a, (b.x0 + b.x1) / 2, 2.95, fz));
      return g;
    }
    case 'workshop': {
      // a great golden cog on the gable
      const cog = new THREE.Group();
      cog.add(mesh(new THREE.TorusGeometry(0.55, 0.14, 6, 12), GOLD));
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; cog.add(box(0.16, 0.22, 0.16, GOLD, Math.cos(a) * 0.72, Math.sin(a) * 0.72 - 0.11, 0)); }
      cog.userData.dynamic = true;
      cog.userData.spin = true;
      cog.position.set(fx, b.top * 0.7, b.z1 + 0.05);
      return cog;
    }
    case 'watchtower': {
      // a beacon burning on the very top
      g.add(cyl(0.4, 0.3, 0.3, C.iron, 7));
      const own = th === 'necromancer' || th === 'goblin' || th === 'sorcerer' || th === 'druid' || th === 'orc' || th === 'djinn' || th === 'dwarf' || th === 'saurian' || th === 'frost';
      const f = glowMesh(new THREE.ConeGeometry(0.35, 1.0, 6).translate(0, 0.5, 0), own ? L.glow : 0xffa53a, own ? L.glowE : 0xd0501a);
      f.position.y = 0.25;
      f.userData.dynamic = true;
      f.userData.fire = true;
      g.add(f);
      g.position.set(0, b.top + 0.1, 0);
      return g;
    }
    case 'hiding': {
      g.add(glowMesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 12), L.main, GOLD_E).translateY(0.72).translateZ(0.2));
      return g;
    }
    case 'farm': {
      // golden sheaves stooked by the yard
      for (let i = 0; i < 4; i++) {
        const st = new THREE.Group();
        st.add(cone(0.35, 1.1, 0xf2c94a, 6));
        st.add(box(0.5, 0.08, 0.08, 0xc9a040, 0, 0.55, 0));
        st.position.set((b.x0 + b.x1) / 2 - 1.6 + i * 1.1, 0, b.z1 - 0.6);
        g.add(st);
      }
      return g;
    }
    case 'timber': {
      // the golden axe in the great stump
      g.add(cyl(0.9, 1.05, 0.7, 0x5a3f28, 9));
      g.add(cyl(0.88, 0.88, 0.03, 0xd9a66a, 9, 0, 0.7));
      const h = box(0.1, 1.3, 0.1, 0x6e4a2a, 0.2, 0.6, 0);
      h.rotation.z = -0.4;
      g.add(h, glowMesh(new THREE.BoxGeometry(0.5, 0.35, 0.08).translate(0.55, 1.65, 0), GOLD, GOLD_E));
      g.position.set((b.x0 + b.x1) / 2, 0, b.z1 - 1.2);
      return g;
    }
    case 'claypit': {
      // a stepped pyramid of golden bricks
      for (let y = 0; y < 3; y++) for (let i = 0; i <= 2 - y; i++) g.add(box(0.5, 0.26, 0.8, GOLD, (i - (2 - y) / 2) * 0.52, y * 0.27, 0));
      g.position.set((b.x0 + b.x1) / 2, 0, b.z1 - 0.6);
      return g;
    }
    case 'ironmine': {
      // a heap of glittering ore
      g.add(blob(0.9, 0x5c554a, 0, 0.2, 0, 1.3, 0.6, 1.1));
      for (let i = 0; i < 6; i++) g.add(glowMesh(new THREE.OctahedronGeometry(0.16, 0), i % 2 ? GOLD : 0xc8d4dc, i % 2 ? GOLD_E : 0x4a5a6a).translateX(Math.cos(i) * 0.6).translateY(0.6 + (i % 3) * 0.12).translateZ(Math.sin(i) * 0.5));
      g.position.set((b.x0 + b.x1) / 2, 0, b.z1 - 1.0);
      return g;
    }
    default: return null;
  }
}

/**
 * Crown a building at its highest level. `obj` is the finished model, before it is
 * placed; `size` scales the touches (the headquarters gets the grandest).
 */
export function addMastery(id: BuildingId, obj: THREE.Group): void {
  const th = getTheme();
  obj.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(obj);
  if (bb.isEmpty()) return;
  // work on the building's core (well inside its outline, which is rarely a full rectangle)
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  const hw = ((bb.max.x - bb.min.x) / 2) * 0.62, hd = ((bb.max.z - bb.min.z) / 2) * 0.62;
  const b: Box2 = { x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd, top: bb.max.y, w: hw * 2, d: hd * 2 };
  const s = Math.max(0.8, Math.min(2.2, Math.max(b.w, b.d) / 5)) * (id === 'main' ? 1.4 : 1);
  const g = new THREE.Group();
  g.userData.mastery = true;
  if (!['timber', 'claypit', 'ironmine', 'farm'].includes(id)) g.add(apron(th, b));
  // standards at the front corners
  const sh = Math.min(4.5, 2.4 + s * 0.8);
  for (const x of [b.x0 + 0.2, b.x1 - 0.2]) {
    const st = standard(th, sh);
    st.position.set(x, 0, b.z1 - 0.2);
    g.add(st);
  }
  // the crown over the roof (the watchtower's beacon takes its place)
  if (id !== 'watchtower') {
    const c = crown(th, s);
    c.position.set((b.x0 + b.x1) / 2, b.top + 0.1, (b.z0 + b.z1) / 2);
    g.add(c);
  }
  const t = trade(id, th, b);
  if (t) g.add(t);
  obj.add(g);
}
