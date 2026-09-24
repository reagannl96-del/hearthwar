// Getting about the village without walking through the houses or the wall: a
// small road graph (the ring road inside the wall, the main street out through
// the gate, a ring round the outside of the wall) and a straight line wherever
// nothing stands in the way.

import * as THREE from 'three';
import type { BuildingId } from '../../../engine/types';
import { GATE_A, GATE_HALF, LAYOUT, WALL_R } from '../scene';

/** Roughly how much room each building inside the wall takes up (world units). */
const ROOM: Partial<Record<BuildingId, number>> = {
  main: 10.5, barracks: 7.5, stable: 7.5, workshop: 6.5, academy: 9.5, smithy: 6.5, warehouse: 7.5,
  market: 5.5, statue: 3.2, rally: 3.2, hiding: 2.4, watchtower: 3.2,
};

const OBSTACLES = (Object.keys(ROOM) as BuildingId[]).map((id) => ({ x: LAYOUT[id][0], z: LAYOUT[id][1], r: ROOM[id]! }));

/** The workplaces out on the land, and how much room they take (an army holding its line steps round them). */
const OUTER = (['timber', 'claypit', 'ironmine', 'farm'] as BuildingId[]).map((id) => ({ x: LAYOUT[id][0], z: LAYOUT[id][1], r: 11 }));

const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Does the line from a to b pass through the wall anywhere but the gate? */
function crossesWall(ax: number, az: number, bx: number, bz: number): boolean {
  const dx = bx - ax, dz = bz - az;
  const A = dx * dx + dz * dz;
  if (A < 1e-6) return false;
  const B = 2 * (ax * dx + az * dz), Cc = ax * ax + az * az - WALL_R * WALL_R;
  const disc = B * B - 4 * A * Cc;
  if (disc <= 0) return false;
  const s = Math.sqrt(disc);
  for (const t of [(-B - s) / (2 * A), (-B + s) / (2 * A)]) {
    if (t <= 0 || t >= 1) continue;
    const x = ax + dx * t, z = az + dz * t;
    if (Math.abs(angDiff(Math.atan2(z, x), GATE_A)) > GATE_HALF * 0.8) return true;
  }
  return false;
}

/**
 * Does the straight line from a to b stay clear of every building (and of the
 * wall, while it stands)? A walk may start or end at a building's own door, as
 * long as it heads away from the building rather than through it.
 */
export function clear(ax: number, az: number, bx: number, bz: number, pad = 0.8, wall = true): boolean {
  if (wall && crossesWall(ax, az, bx, bz)) return false;
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  for (const o of OBSTACLES) {
    const t = Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.z - az) * dz) / len2));
    const px = ax + dx * t - o.x, pz = az + dz * t - o.z;
    if (px * px + pz * pz >= (o.r + pad) ** 2) continue;
    // leaving from (or arriving at) this building's door, facing away from it
    const R = o.r + pad + 0.5;
    const atA = Math.hypot(ax - o.x, az - o.z) < R && (ax - o.x) * dx + (az - o.z) * dz > 0;
    const atB = Math.hypot(bx - o.x, bz - o.z) < R && (bx - o.x) * -dx + (bz - o.z) * -dz > 0;
    if (atA || atB) continue;
    return false;
  }
  return true;
}

/** Nudge a spot out of any building it stands in. */
export function freeSpot(p: THREE.Vector3, pad = 0.8): THREE.Vector3 {
  for (let pass = 0; pass < 3; pass++) {
    for (const o of OBSTACLES) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const d = Math.hypot(dx, dz), need = o.r + pad;
      if (d >= need) continue;
      const k = d > 0.01 ? need / d : 1;
      p.x = o.x + (d > 0.01 ? dx : need) * k;
      p.z = o.z + (d > 0.01 ? dz : 0) * k;
    }
  }
  return p;
}

/** Nudge a spot out on the land clear of the timber camp, clay pit, iron mine and farm. */
export function clearOfWorks(p: THREE.Vector3): THREE.Vector3 {
  for (const o of OUTER) {
    const dx = p.x - o.x, dz = p.z - o.z;
    const d = Math.hypot(dx, dz);
    if (d >= o.r) continue;
    const k = d > 0.01 ? o.r / d : 1;
    p.x = o.x + (d > 0.01 ? dx : o.r) * k;
    p.z = o.z + (d > 0.01 ? dz : 0) * k;
  }
  return p;
}

const RING = WALL_R - 5.5, OUT_RING = WALL_R + 7;
const NODES: [number, number][] = [];
for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; NODES.push([Math.cos(a) * RING, Math.sin(a) * RING]); }
for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2 + Math.PI / 28; NODES.push([Math.cos(a) * OUT_RING, Math.sin(a) * OUT_RING]); }
NODES.push([0, WALL_R + 4], [0, WALL_R - 4], [0, 30], [0, 20], [0, 11], [4, 4], [-4, 4], [0, -2]);
const N = NODES.length;
const EDGES: number[][] = NODES.map(() => []);
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
  const [ax, az] = NODES[i], [bx, bz] = NODES[j];
  if (Math.hypot(ax - bx, az - bz) > 16) continue;
  if (!clear(ax, az, bx, bz, 0.4)) continue;
  EDGES[i].push(j);
  EDGES[j].push(i);
}

function visible(x: number, z: number, wall: boolean): number[] {
  const out: number[] = [];
  const reach = Math.hypot(x, z) > WALL_R + 1 ? 80 : 30;
  for (let i = 0; i < N; i++) if (Math.hypot(NODES[i][0] - x, NODES[i][1] - z) < reach && clear(x, z, NODES[i][0], NODES[i][1], 0.8, wall)) out.push(i);
  return out;
}

/**
 * The way from a to b: straight if nothing is in the way, otherwise along the
 * roads (and through the gate, while the wall stands). Returns the points to
 * pass through after `a`, ending with `b`.
 */
export function route(a: THREE.Vector3, b: THREE.Vector3, wall = true): THREE.Vector3[] {
  if (clear(a.x, a.z, b.x, b.z, 0.8, wall)) return [b.clone()];
  const from = visible(a.x, a.z, wall), to = new Set(visible(b.x, b.z, wall));
  if (!from.length || !to.size) return [b.clone()];
  // Dijkstra over a few dozen nodes
  const dist = new Array(N).fill(Infinity);
  const prev = new Array(N).fill(-1);
  const done = new Array(N).fill(false);
  for (const i of from) dist[i] = Math.hypot(NODES[i][0] - a.x, NODES[i][1] - a.z);
  let end = -1, best = Infinity;
  for (let k = 0; k < N; k++) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = true;
    if (to.has(u)) {
      const total = dist[u] + Math.hypot(NODES[u][0] - b.x, NODES[u][1] - b.z);
      if (total < best) { best = total; end = u; }
    }
    for (const w of EDGES[u]) {
      const d = dist[u] + Math.hypot(NODES[u][0] - NODES[w][0], NODES[u][1] - NODES[w][1]);
      if (d < dist[w]) { dist[w] = d; prev[w] = u; }
    }
  }
  if (end < 0) return [b.clone()];
  const chain: number[] = [];
  for (let u = end; u >= 0; u = prev[u]) chain.unshift(u);
  return [...chain.map((i) => new THREE.Vector3(NODES[i][0], 0, NODES[i][1])), b.clone()];
}

/** Length of a walk through these points. */
export function walkLength(from: THREE.Vector3, pts: THREE.Vector3[]): number {
  let l = 0, p = from;
  for (const q of pts) { l += p.distanceTo(q); p = q; }
  return l;
}
