// The support camp: every army stationed in a village from somewhere else pitches
// its tents outside the gate, in the fashion of the hero it marches for. A striped
// pavilion for the Radiant Order, a starry cone for a sorcerer's troops, a
// leafy bower for the druids, a patched hide heap for goblins, a bone-ribbed
// shroud for the dead, and a plain canvas tent for everyone else. A soldier of the
// army's main unit keeps watch at each door, and a fire burns in front.
//
// A tent holds a thousand troops. It goes up small and grows with every 250 that
// move in; once it is full, the army pitches another beside it. The tents stand in
// two rows facing the road, so the camp reads at a glance.

import * as THREE from 'three';
import type { Units, UnitId } from '../../engine/types';
import { C, blob, box, cone, cyl, getTheme, mesh, setTheme, type Theme } from './kit';
import { troop, type TroopModel } from './props';
import { CAMP_AREA, CAMP_FIRE, heightAt } from './scene';

/** No more tents than this in the whole camp, however many armies come. */
export const CAMP_TENTS = 12;
/** Troops a tent holds, and how many more make it grow a size. */
export const TENT_FULL = 1000, TENT_STEP = 250;
/** A tent's sizes, from a first 250 troops to a full thousand. */
export const TENT_SIZES = [0.8, 1.0, 1.2, 1.4];
export const TENT_MIN = TENT_SIZES[0], TENT_MAX = TENT_SIZES[TENT_SIZES.length - 1];
/** Ground a tent takes up at scale 1 (its radius). */
export const TENT_R = 1.65;
const GAP = 0.5;

/** Headcount of an army. */
export const headcount = (u: Units) => Object.values(u).reduce((a, b) => a + (b ?? 0), 0);

/** How big a tent with this many troops in it is: a size for every 250, up to a thousand. */
export function tentScale(troops: number): number {
  const step = Math.ceil(Math.min(TENT_FULL, Math.max(1, troops)) / TENT_STEP);
  return TENT_SIZES[Math.min(TENT_SIZES.length, step) - 1];
}

/**
 * How the camp's tents are shared out: every army gets its first tent, then the
 * biggest armies get their further ones, until the camp is full. Each entry is one
 * tent: whose it is and how many troops sleep in it.
 */
export function pitchTents(sizes: number[]): { army: number; troops: number }[] {
  const want = sizes.map((n) => Math.max(1, Math.ceil(n / TENT_FULL)));
  const got = sizes.map(() => 0);
  let left = CAMP_TENTS;
  // everyone gets one (biggest armies first if there are more armies than room)
  for (let i = 0; i < sizes.length && left > 0; i++) { got[i] = 1; left--; }
  // then extra tents go round, biggest armies first
  for (let more = true; more && left > 0;) {
    more = false;
    for (let i = 0; i < sizes.length && left > 0; i++) if (got[i] > 0 && got[i] < want[i]) { got[i]++; left--; more = true; }
  }
  const out: { army: number; troops: number }[] = [];
  sizes.forEach((n, i) => {
    if (!got[i]) return;
    // full tents first; the last one holds what's left over (when the camp ran out
    // of room, the troops are shared across the tents it has)
    const per = got[i] < want[i] ? Math.ceil(n / got[i]) : TENT_FULL;
    for (let k = 0; k < got[i]; k++) out.push({ army: i, troops: Math.max(1, Math.min(per, n - k * per)) });
  });
  return out;
}

/**
 * Where the tents go, given their sizes, in order: two rows facing south (towards
 * the road and the gate), the back row filled first, each row centred. If they
 * somehow can't fit, every tent shrinks alike.
 */
export function campSlots(sizes: number[]): { x: number; z: number; face: number; scale: number }[] {
  const n = Math.min(CAMP_TENTS, sizes.length);
  let sc = sizes.slice(0, n);
  const { x0, x1, rows } = CAMP_AREA;
  const room = x1 - x0;
  const w = (v: number) => v * TENT_R * 2 + GAP;
  // split into rows: fill the back row as far as it goes, the rest in front
  const split = (list: number[]) => {
    const out: number[][] = [[]];
    let used = 0;
    for (const v of list) {
      if (used + w(v) > room && out.length < rows.length) { out.push([]); used = 0; }
      out[out.length - 1].push(v);
      used += w(v);
    }
    return out;
  };
  let lines = split(sc);
  const worst = () => Math.max(...lines.map((l) => l.reduce((a, v) => a + w(v), 0)));
  if (worst() > room) {
    const f = (room - GAP * Math.max(...lines.map((l) => l.length))) / (worst() - GAP * Math.max(...lines.map((l) => l.length)));
    sc = sc.map((v) => v * f);
    lines = split(sc);
  }
  const out: { x: number; z: number; face: number; scale: number }[] = [];
  lines.forEach((line, r) => {
    const len = line.reduce((a, v) => a + w(v), 0);
    let x = x0 + (room - len) / 2;
    for (const v of line) {
      out.push({ x: x + w(v) / 2, z: rows[r], face: 0, scale: v });
      x += w(v);
    }
  });
  return out;
}

/** Draw with another village's palette for a moment (a visiting army keeps its own colours). */
export function withTheme<T>(t: Theme, fn: () => T): T {
  const was = getTheme();
  setTheme(t);
  try {
    return fn();
  } finally {
    setTheme(was);
  }
}

const glow = (geo: THREE.BufferGeometry, c: number, e: number) => mesh(geo, c, { emissive: e });

/** A lantern hanging by the door; it glows softly (brighter at night, with the bloom). */
function lantern(c: number, e: number, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.03, 0.03, y, C.woodDark, 4, 0, 0, 0));
  g.add(glow(new THREE.IcosahedronGeometry(0.16, 0), c, e).translateY(y + 0.05));
  g.position.set(x, 0, z);
  return g;
}

/** A tent of the given village's style. Its door faces +z. */
export function supportTent(th: Theme): THREE.Group {
  const g = new THREE.Group();
  switch (th) {
    case 'paladin': {
      // a round pavilion in blue and white, gold-crowned, with the Order's pennant
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const p = box(0.78, 1.5, 0.05, i % 2 ? 0x2c56b0 : 0xf3eee2, Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2);
        p.rotation.y = -a + Math.PI / 2;
        g.add(p);
      }
      g.add(cone(1.6, 1.5, 0x2c56b0, n, 0, 1.5));
      g.add(cyl(1.62, 1.62, 0.14, 0xd9a441, n, 0, 1.44));
      g.add(cone(0.1, 0.3, 0xd9a441, 5, 0, 3.0));
      g.add(cyl(0.035, 0.035, 0.9, 0x5b3e28, 4, 0, 3.0));
      const pen = box(0.7, 0.34, 0.04, 0x2c56b0, 0.36, 3.5, 0);
      pen.userData.flag = true;
      g.add(pen);
      g.add(box(0.7, 1.1, 0.06, 0x2a1d12, 0, 0, 1.2));
      g.add(lantern(0xffe39a, 0x8a6a20, 0.75, 1.2, 1.45));
      break;
    }
    case 'sorcerer': {
      // a tall violet cone like a wizard's hat, starred, with a crystal floating over it
      g.add(cone(1.4, 2.8, 0x432a8c, 9));
      g.add(cyl(1.42, 1.42, 0.12, 0xd9c6ff, 9, 0, 0.3));
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3, h = 0.8 + (i % 3) * 0.5, r = 1.3 * (1 - h / 2.8) + 0.03;
        g.add(glow(new THREE.OctahedronGeometry(0.08, 0), 0xf4ecc8, 0x8a7a40).translateX(Math.cos(a) * r).translateY(h).translateZ(Math.sin(a) * r));
      }
      g.add(box(0.6, 1.0, 0.06, 0x1e1433, 0, 0, 1.0));
      const c = glow(new THREE.OctahedronGeometry(0.2, 0), 0xc6a2ff, 0x6a38d0);
      c.scale.set(1, 1.7, 1);
      c.position.y = 3.35;
      c.userData.dynamic = true;
      c.userData.orbit = 1.1;
      c.userData.bob = 0.12;
      g.add(c);
      g.add(lantern(0x8fe8ff, 0x2a8ab8, 0.7, 1.1, 1.25));
      break;
    }
    case 'druid': {
      // a bower of bent willow, thatched with leaves and threaded with flowers
      g.add(blob(1.35, 0x5a8a36, 0, 0.2, 0, 1, 0.95, 1.05));
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        g.add(blob(0.45, i % 2 ? 0x6fa044 : 0x4f7f32, Math.cos(a) * 1.0, 0.9 + (i % 3) * 0.2, Math.sin(a) * 1.0));
      }
      for (let i = 0; i < 6; i++) g.add(blob(0.1, [0xe88aa6, 0xf4f1e6, 0xf2e46a][i % 3], Math.cos(i * 1.1) * 1.15, 0.7 + (i % 2) * 0.5, Math.sin(i * 1.1) * 1.15));
      g.add(box(0.6, 0.95, 0.3, 0x3a2a18, 0, 0, 1.15));
      const arch = mesh(new THREE.TorusGeometry(0.4, 0.07, 5, 10, Math.PI), 0x6e5134);
      arch.position.set(0, 0.95, 1.3);
      g.add(arch);
      g.add(lantern(0xf4ff9a, 0x7a9a20, 0.8, 1.0, 1.3));
      break;
    }
    case 'goblin': {
      // hides and rags thrown over crooked poles, a skull on top and a green rag for a flag
      g.add(cone(1.5, 1.9, 0x7a5a3a, 6));
      for (let i = 0; i < 4; i++) {
        const patch = box(0.55, 0.45, 0.05, [0x6f9a2a, 0x8a6a3a, 0x5a4a2a, 0x9a7a4a][i], 0, 0.5 + (i % 2) * 0.5, 0);
        const a = i * 1.5 + 0.4;
        patch.position.set(Math.cos(a) * (1.05 - (i % 2) * 0.3), 0.45 + (i % 2) * 0.5, Math.sin(a) * (1.05 - (i % 2) * 0.3));
        patch.rotation.y = -a + Math.PI / 2;
        patch.rotation.x = -0.6;
        g.add(patch);
      }
      for (const [x, z] of [[0.3, 0.2], [-0.25, -0.2], [0.05, -0.3]]) {
        const p = cyl(0.04, 0.05, 1.0, 0x3e2a18, 4, x, 1.6, z);
        p.rotation.z = x * 0.8;
        g.add(p);
      }
      g.add(blob(0.2, 0xe6dfcc, 0, 2.55, 0, 1, 0.9, 1));
      const rag = box(0.6, 0.4, 0.04, 0x6f9a2a, 0.32, 2.2, 0.25);
      rag.userData.flag = true;
      g.add(rag);
      g.add(box(0.6, 0.8, 0.06, 0x1e140a, 0, 0, 1.15));
      g.add(blob(0.22, 0xe9b83a, 0.9, 0.1, 1.05, 1, 0.5, 1)); // a little pile of loot at the door
      g.add(lantern(0x9aff3a, 0x4a9a10, -0.8, 1.0, 1.2));
      break;
    }
    case 'necromancer': {
      // a black, tattered shroud over a ribcage of bones, soul-green light at the door
      g.add(cone(1.4, 2.2, 0x221f27, 7));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        const rib = mesh(new THREE.TorusGeometry(0.9, 0.05, 4, 8, Math.PI * 0.6), 0xe6dfcc);
        rib.position.set(Math.cos(a) * 0.35, 0.6, Math.sin(a) * 0.35);
        rib.rotation.set(0, -a, Math.PI * 0.2);
        g.add(rib);
      }
      for (let i = 0; i < 4; i++) {
        const tat = box(0.3, 0.35, 0.04, 0x2e2a33, 0, 0, 0);
        const a = i * 1.6 + 0.2;
        tat.position.set(Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35);
        tat.rotation.y = -a + Math.PI / 2;
        g.add(tat);
      }
      g.add(blob(0.2, 0xe6dfcc, 0, 2.25, 0, 1, 0.9, 1));
      g.add(box(0.55, 0.85, 0.06, 0x0a0a0c, 0, 0, 1.08));
      const f = glow(new THREE.ConeGeometry(0.14, 0.4, 6).translate(0, 0.2, 0), 0x5cff9a, 0x1f9a4a);
      f.position.set(0.75, 1.05, 1.25);
      f.userData.dynamic = true;
      f.userData.fire = true;
      g.add(f, cyl(0.03, 0.03, 1.05, 0x2e2a33, 4, 0.75, 0, 1.25));
      break;
    }
    default: {
      // a canvas ridge tent with a red stripe and a pennant on the pole
      // a triangular prism, ridge up, running front to back
      const prism = (r: number, len: number) => new THREE.CylinderGeometry(r, r, len, 3).rotateX(Math.PI / 2).rotateZ(Math.PI).translate(0, r / 2, 0);
      g.add(mesh(prism(1.25, 2.4), 0xe8dcc0));
      g.add(mesh(prism(0.2, 2.5).translate(0, 1.6, 0), 0xb3332a));
      g.add(mesh(new THREE.ConeGeometry(0.42, 1.0, 3).translate(0, 0.5, 1.21), 0x3a2614)); // the open flap
      g.add(cyl(0.035, 0.035, 2.3, C.woodDark, 4, 0, 0, 1.25));
      const pen = box(0.6, 0.32, 0.04, 0xb3332a, 0.31, 2.0, 1.25);
      pen.userData.flag = true;
      g.add(pen);
      g.add(lantern(0xffd27a, 0xa06a10, 0.8, 1.0, 1.35));
    }
  }
  return g;
}

const GUARDS: TroopModel[] = ['spear', 'sword', 'axe', 'archer', 'light', 'marcher', 'heavy', 'scout'];

/** The unit an army has most of, to stand at its tent door. */
export function mainUnit(units: Units): TroopModel | null {
  let best: TroopModel | null = null, n = 0;
  for (const k of GUARDS) {
    const c = units[k as UnitId] ?? 0;
    if (c > n) { n = c; best = k; }
  }
  return best;
}

/** The whole camp's tents, in order: whose they are and how big (the renderer keys on this). */
export function campPlan(armies: { theme: Theme; units: Units }[]): { army: number; scale: number }[] {
  return pitchTents(armies.map((a) => headcount(a.units))).map((t) => ({ army: t.army, scale: tentScale(t.troops) }));
}

/** The whole camp: each army's tents (its own style, sized to the troops in them), a sentry at every door, and a fire in front. */
export function buildCamp(armies: { theme: Theme; units: Units }[]): THREE.Group {
  const g = new THREE.Group();
  const plan = campPlan(armies);
  const slots = campSlots(plan.map((t) => t.scale));
  plan.forEach((t, i) => {
    const s = slots[i];
    if (!s) return;
    const a = armies[t.army];
    const spot = new THREE.Group();
    withTheme(a.theme, () => {
      const tent = supportTent(a.theme);
      tent.scale.setScalar(s.scale);
      spot.add(tent);
      const k = mainUnit(a.units);
      if (!k) return;
      // the guard stands by the door, whatever the tent's size
      const guard = troop(k);
      guard.position.set(-(0.5 + 0.45 * s.scale), 0, TENT_R * s.scale * 0.95 + 0.3);
      spot.add(guard);
    });
    spot.position.set(s.x, heightAt(s.x, s.z), s.z);
    spot.rotation.y = s.face;
    g.add(spot);
  });
  if (plan.length) {
    const [cx, cz] = CAMP_FIRE, y = heightAt(cx, cz);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      g.add(blob(0.22, C.stoneDark, cx + Math.cos(a) * 0.8, y + 0.05, cz + Math.sin(a) * 0.8, 1, 0.6, 1));
    }
    for (let i = 0; i < 3; i++) {
      const log = cyl(0.09, 0.09, 1.1, C.woodDark, 5, cx, y + 0.12, cz);
      log.rotation.set(Math.PI / 2, i * 1.05, 0);
      g.add(log);
    }
    const flame = mesh(new THREE.ConeGeometry(0.35, 0.95, 6).translate(0, 0.47, 0), 0xffa53a, { emissive: 0xb0501a });
    flame.position.set(cx, y + 0.12, cz);
    flame.userData.fire = true;
    g.add(flame);
  }
  return g;
}
