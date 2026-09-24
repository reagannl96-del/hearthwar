// The routes villagers and troops stroll along, as closed loops of [x, z]
// points (an out-and-back walk simply lists its way back). Scenery keeps these
// corridors clear, and the layout test checks nothing stands in the way.

export type Path = [number, number][];

const circle = (cx: number, cz: number, r: number, n: number): Path =>
  Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cz + Math.sin((i / n) * Math.PI * 2) * r] as [number, number]);

export const WALK_PATHS = {
  // villagers
  plaza: circle(0, 3.8, 6.4, 18),
  ring: circle(0, 0, 40, 60),
  street: [[0, 10.5], [0, 43]] as Path,
  fields: [[0, 46], [0, 62], [-15, 68], [-33, 66], [-15, 68], [0, 62]] as Path,
  // troops on foot
  drill: circle(0, 3.8, 6.9, 18),
  march: [[0, 11], [0, 42]] as Path,
  rampart: circle(0, 0, 40.3, 60),
  // riders, outside the walls
  outer: circle(0, 0, 52, 64),
  road: [[0, 47], [0, 64], [-15, 69], [-34, 67], [-15, 69], [0, 64]] as Path,
} satisfies Record<string, Path>;

export const PEOPLE_LOOPS: Path[] = [WALK_PATHS.plaza, WALK_PATHS.ring, WALK_PATHS.street, WALK_PATHS.fields];
export const FOOT_LOOPS: Path[] = [WALK_PATHS.drill, WALK_PATHS.march, WALK_PATHS.rampart];
export const RIDE_LOOPS: Path[] = [WALK_PATHS.outer, WALK_PATHS.road];

/** Distance from a point to the nearest walking route. */
export function distToPaths(x: number, z: number): number {
  let best = Infinity;
  for (const p of Object.values(WALK_PATHS)) {
    for (let i = 0; i < p.length; i++) {
      const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length];
      const dx = x2 - x1, dz = z2 - z1;
      const l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / l2));
      best = Math.min(best, Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz)));
    }
  }
  return best;
}
