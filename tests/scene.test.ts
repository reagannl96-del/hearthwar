// Geometry checks for the 3D village: buildings must not clip into each other or
// the wall at any size, and nobody should stroll through a tree or a house.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/engine/data/buildings';
import type { BuildingId } from '../src/engine/types';
import { buildModel, visualTier } from '../src/ui/three/buildings';
import { LAYOUT, OUTSIDE, WALL_R, buildingScale, heightAt, sceneryPlan } from '../src/ui/three/scene';
import { WALK_PATHS } from '../src/ui/three/paths';
import { setTheme } from '../src/ui/three/kit';
import { CAMP_TENTS, TENT_MAX, TENT_MIN, TENT_R, campSlots, tentScale } from '../src/ui/three/camp';
import { CAMP } from '../src/ui/three/scene';

type P = [number, number];

/** Convex hull (monotone chain) of points in the XZ plane. */
function hull(pts: P[]): P[] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: P[] = [], hi: P[] = [];
  for (const p of s) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of [...s].reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

/** Separating-axis test for two convex polygons, with a small gap allowed to count as touching. */
function overlaps(a: P[], b: P[], slack = 0.3): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const nx = q[1] - p[1], nz = p[0] - q[0];
      const len = Math.hypot(nx, nz) || 1;
      const proj = (pts: P[]) => pts.map(([x, z]) => (x * nx + z * nz) / len);
      const pa = proj(a), pb = proj(b);
      if (Math.max(...pa) - slack <= Math.min(...pb) || Math.max(...pb) - slack <= Math.min(...pa)) return false;
    }
  }
  return true;
}

function inside(poly: P[], [x, z]: P, pad = 0): boolean {
  // inside a convex polygon grown by `pad`
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const ex = q[0] - p[0], ez = q[1] - p[1];
    const len = Math.hypot(ex, ez) || 1;
    const side = (ex * (z - p[1]) - ez * (x - p[0])) / len;
    if (side < -pad) return false;
  }
  return true;
}

/** Ground footprint of a building as placed in the village. */
function footprint(id: BuildingId, level: number): P[] {
  const obj = buildModel(id, level, 0xe0a526).obj;
  const [x, z, ry] = LAYOUT[id];
  obj.position.set(x, 0, z);
  obj.rotation.y = ry;
  obj.scale.setScalar(buildingScale(id));
  obj.updateMatrixWorld(true);
  const pts: P[] = [];
  const v = new THREE.Vector3();
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || o.userData.dynamic) return;
    const pos = m.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (v.y > 0.05) pts.push([v.x, v.z]);
    }
  });
  return hull(pts);
}

/** One level for every visual size a building goes through. */
function tierLevels(id: BuildingId): number[] {
  const seen = new Map<number, number>();
  for (let l = 1; l <= BUILDINGS[id].max; l++) seen.set(visualTier(id, l), l);
  return [...seen.values()];
}

const IDS = (Object.keys(LAYOUT) as BuildingId[]).filter((id) => id !== 'wall');
const shapes = new Map<BuildingId, P[][]>(IDS.map((id) => [id, tierLevels(id).map((l) => footprint(id, l))]));

describe('village layout', () => {
  it('no two buildings clip into each other at any size', () => {
    const clashes: string[] = [];
    for (let i = 0; i < IDS.length; i++) {
      for (let j = i + 1; j < IDS.length; j++) {
        const a = IDS[i], b = IDS[j];
        for (const sa of shapes.get(a)!) for (const sb of shapes.get(b)!) {
          if (overlaps(sa, sb)) { clashes.push(`${a} × ${b}`); break; }
        }
      }
    }
    expect([...new Set(clashes)]).toEqual([]);
  });

  it('every building still fits in every hero theme', () => {
    const bad: string[] = [];
    for (const theme of ['paladin', 'sorcerer', 'druid', 'goblin', 'necromancer'] as const) {
      setTheme(theme);
      const th = new Map<BuildingId, P[][]>(IDS.map((id) => [id, tierLevels(id).map((l) => footprint(id, l))]));
      setTheme('classic');
      for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) {
        const x = IDS[i], y = IDS[j];
        if (th.get(x)!.some((sa) => th.get(y)!.some((sb) => overlaps(sa, sb)))) bad.push(`${theme}: ${x} × ${y}`);
      }
      for (const id of IDS) {
        const shp = th.get(id)!;
        const r = (fn: (a: number[]) => number) => fn(shp.flatMap((s2) => s2.map(([x, z]) => Math.hypot(x, z))));
        if (!OUTSIDE.includes(id) && r((v) => Math.max(...v)) > WALL_R - 3) bad.push(`${theme}: ${id} reaches the wall`);
        if (OUTSIDE.includes(id) && r((v) => Math.min(...v)) < WALL_R + 4) bad.push(`${theme}: ${id} crowds the wall`);
      }
      const biggest = IDS.map((id) => ({ id, s: th.get(id)![th.get(id)!.length - 1] }));
      for (const [name, path] of Object.entries(WALK_PATHS)) {
        const closed = [...path, path[0]];
        for (let i = 0; i < closed.length - 1; i++) {
          const [x1, z1] = closed[i], [x2, z2] = closed[i + 1];
          const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.5));
          for (let k = 0; k <= n; k++) {
            const p: P = [x1 + ((x2 - x1) * k) / n, z1 + ((z2 - z1) * k) / n];
            for (const bb of biggest) if (inside(bb.s, p, 0.4)) bad.push(`${theme}: ${name} walks through the ${bb.id}`);
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('buildings inside the walls stay clear of the wall', () => {
    const bad: string[] = [];
    for (const id of IDS) {
      if (OUTSIDE.includes(id)) continue;
      for (const s of shapes.get(id)!) {
        const far = Math.max(...s.map(([x, z]) => Math.hypot(x, z)));
        if (far > WALL_R - 3) { bad.push(`${id} reaches ${far.toFixed(1)}`); break; }
      }
    }
    expect(bad).toEqual([]);
  });

  it('buildings outside the walls stay clear of the wall', () => {
    const bad: string[] = [];
    for (const id of OUTSIDE) {
      for (const s of shapes.get(id)!) {
        const near = Math.min(...s.map(([x, z]) => Math.hypot(x, z)));
        if (near < WALL_R + 4) { bad.push(`${id} comes within ${near.toFixed(1)}`); break; }
      }
    }
    expect(bad).toEqual([]);
  });

  it('the ground never swallows fields or buildings outside the walls', () => {
    const bad = new Set<string>();
    for (const id of OUTSIDE) {
      for (const l of tierLevels(id)) {
        const obj = buildModel(id, l, 0).obj;
        const [x, z, ry] = LAYOUT[id];
        const base = heightAt(x, z);
        obj.position.set(x, base, z);
        obj.rotation.y = ry;
        obj.scale.setScalar(buildingScale(id));
        obj.updateMatrixWorld(true);
        const v = new THREE.Vector3();
        obj.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const pos = m.geometry.getAttribute('position');
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
            // the tops of low things (crops, fences, logs) must stay above the ground
            if (v.y - base > 0.2 && v.y - base < 1.2 && heightAt(v.x, v.z) > v.y - 0.05) bad.add(`${id} level ${l} is buried near ${v.x.toFixed(0)},${v.z.toFixed(0)}`);
          }
        });
      }
    }
    expect([...bad].slice(0, 5)).toEqual([]);
  });

  it('no tree, rock or prop stands inside a building', () => {
    const bad: string[] = [];
    for (const t of sceneryPlan()) {
      for (const id of IDS) for (const sh of shapes.get(id)!) {
        if (inside(sh, [t.x, t.z], t.r)) { bad.push(`${t.kind} at ${t.x.toFixed(0)},${t.z.toFixed(0)} in the ${id}`); break; }
      }
    }
    expect(bad).toEqual([]);
  });

  it('walkers never pass through trees, rocks or buildings', () => {
    const plan = sceneryPlan();
    const biggest = IDS.map((id) => ({ id, s: shapes.get(id)![shapes.get(id)!.length - 1] }));
    const bad = new Set<string>();
    for (const [name, path] of Object.entries(WALK_PATHS)) {
      const closed = [...path, path[0]];
      for (let i = 0; i < closed.length - 1; i++) {
        const [x1, z1] = closed[i], [x2, z2] = closed[i + 1];
        const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.5));
        for (let k = 0; k <= n; k++) {
          const x = x1 + ((x2 - x1) * k) / n, z = z1 + ((z2 - z1) * k) / n;
          for (const t of plan) if (Math.hypot(t.x - x, t.z - z) < t.r + 0.6) bad.add(`${name} hits a ${t.kind} at ${t.x.toFixed(0)},${t.z.toFixed(0)}`);
          for (const b of biggest) if (inside(b.s, [x, z], 0.4)) bad.add(`${name} walks through the ${b.id}`);
        }
      }
    }
    expect([...bad]).toEqual([]);
  });

  it('tents grow with the army, within limits', () => {
    expect(tentScale(50)).toBeLessThan(0.6);
    expect(tentScale(1000)).toBeGreaterThan(0.9);
    expect(tentScale(1e6)).toBe(TENT_MAX);
    expect(tentScale(1)).toBe(TENT_MIN);
  });

  it('the support camp stands clear of the wall, the paths, the buildings and the trees', () => {
    const bad: string[] = [];
    // every mix of army sizes: all huts, all great pavilions, and a spread between
    const mixes = [Array(CAMP_TENTS).fill(TENT_MAX), Array(CAMP_TENTS).fill(TENT_MIN), [TENT_MAX, TENT_MAX], [TENT_MIN], [1.6, 1.2, 0.9, 0.7, 0.5, 0.45, 0.45, 0.45]];
    const spots = [{ x: CAMP[0], z: CAMP[1], r: 0.9 }];
    for (const m of mixes) {
      const slots = campSlots(m);
      slots.forEach((a, i) => {
        spots.push({ x: a.x, z: a.z, r: TENT_R * a.scale + 0.2 });
        // neighbouring tents must not overlap each other either
        slots.forEach((b, j) => { if (j > i && Math.hypot(a.x - b.x, a.z - b.z) < TENT_R * (a.scale + b.scale) * 0.95) bad.push(`tents ${i} and ${j} overlap in [${m.join(',')}]`); });
      });
    }
    for (const t of spots) {
      const at = `${t.x.toFixed(0)},${t.z.toFixed(0)}`;
      if (Math.hypot(t.x, t.z) < WALL_R + 4 + t.r) bad.push(`tent at ${at} by the wall`);
      for (const id of IDS) for (const sh of shapes.get(id)!) if (inside(sh, [t.x, t.z], t.r)) bad.push(`tent at ${at} in the ${id}`);
      for (const it of sceneryPlan()) if (Math.hypot(it.x - t.x, it.z - t.z) < it.r + t.r) bad.push(`tent at ${at} on a ${it.kind}`);
      for (const [name, path] of Object.entries(WALK_PATHS)) {
        const closed = [...path, path[0]];
        for (let i = 0; i < closed.length - 1; i++) {
          const [x1, z1] = closed[i], [x2, z2] = closed[i + 1];
          const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz || 1;
          const k = Math.max(0, Math.min(1, ((t.x - x1) * dx + (t.z - z1) * dz) / l2));
          if (Math.hypot(t.x - x1 - dx * k, t.z - z1 - dz * k) < t.r + 1) { bad.push(`${name} runs through the tent at ${at}`); break; }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
