// Grid index of villages for fast radius queries (villages never move).

import type { Village, World } from './types';

const CELL = 10;

interface Grid {
  worldId: string;
  count: number;
  cols: number;
  cells: number[][];
}

let grid: Grid | null = null;

function build(w: World): Grid {
  const cols = Math.ceil(w.config.size / CELL) + 1;
  const cells: number[][] = Array.from({ length: cols * cols }, () => []);
  let count = 0;
  for (const id in w.villages) {
    const v = w.villages[id];
    cells[Math.floor(v.y / CELL) * cols + Math.floor(v.x / CELL)].push(v.id);
    count++;
  }
  return { worldId: w.id, count, cols, cells };
}

export function invalidateSpatial(): void {
  grid = null;
}

function getGrid(w: World): Grid {
  // villages are only created at world generation and on respawn, which call invalidateSpatial()
  if (!grid || grid.worldId !== w.id) grid = build(w);
  return grid;
}

/** Villages within `r` fields of (x, y), unsorted. */
export function villagesNear(w: World, x: number, y: number, r: number): Village[] {
  const g = getGrid(w);
  const out: Village[] = [];
  const c0 = Math.max(0, Math.floor((x - r) / CELL)), c1 = Math.min(g.cols - 1, Math.floor((x + r) / CELL));
  const r0 = Math.max(0, Math.floor((y - r) / CELL)), r1 = Math.min(g.cols - 1, Math.floor((y + r) / CELL));
  const r2 = r * r;
  for (let cy = r0; cy <= r1; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      for (const id of g.cells[cy * g.cols + cx]) {
        const v = w.villages[id];
        if (!v) continue;
        const dx = v.x - x, dy = v.y - y;
        if (dx * dx + dy * dy <= r2) out.push(v);
      }
    }
  }
  return out;
}

export function villageAt(w: World, x: number, y: number): Village | undefined {
  const g = getGrid(w);
  if (x < 0 || y < 0) return undefined;
  const cell = g.cells[Math.floor(y / CELL) * g.cols + Math.floor(x / CELL)];
  if (!cell) return undefined;
  for (const id of cell) {
    const v = w.villages[id];
    if (v && v.x === x && v.y === y) return v;
  }
  return undefined;
}
