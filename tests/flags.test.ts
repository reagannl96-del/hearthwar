// Rulers' banners: every design the client can send becomes one that exists, and
// the poles at the gate stand clear of the wall, the road and every walker.

import { describe, expect, it } from 'vitest';
import { DEFAULT_FLAG, FLAG_CHARGES, FLAG_COLORS, FLAG_OPTIONS, FLAG_PATTERNS, FLAG_SHAPES, sanitizeFlag } from '../src/engine/data/flags';
import { BANNER_POLES, CLOTH_W, POLE_H } from '../src/ui/three/flags3d';
import { GATE_A, GATE_HALF, WALL_R } from '../src/ui/three/scene';
import { distToPaths } from '../src/ui/three/paths';

describe('banner designs', () => {
  it('offers well over a thousand designs', () => {
    expect(FLAG_OPTIONS).toBeGreaterThan(1000);
    expect(FLAG_OPTIONS).toBe(FLAG_SHAPES.length * FLAG_PATTERNS.length * FLAG_CHARGES.length * FLAG_COLORS.length ** 3);
  });

  it('turns junk into a design that exists', () => {
    expect(sanitizeFlag(null)).toEqual(DEFAULT_FLAG);
    expect(sanitizeFlag('red')).toEqual(DEFAULT_FLAG);
    const f = sanitizeFlag({ shape: 99, pattern: -1, charge: 'x', field: 2.7, accent: Infinity, chargeColor: FLAG_COLORS.length });
    expect(f).toEqual({ ...DEFAULT_FLAG, field: 2 });
    for (const [k, len] of [['shape', FLAG_SHAPES.length], ['pattern', FLAG_PATTERNS.length], ['charge', FLAG_CHARGES.length], ['field', FLAG_COLORS.length]] as const) {
      expect(f[k]).toBeGreaterThanOrEqual(0);
      expect(f[k]).toBeLessThan(len);
    }
    const ok = { shape: 7, pattern: 11, charge: 15, field: 13, accent: 0, chargeColor: 6 };
    expect(sanitizeFlag({ ...ok, extra: 'ignored' })).toEqual(ok);
  });
});

describe('the banners at the gate', () => {
  it('stand outside the wall, clear of the gate towers, the road and every walking route', () => {
    const towers = [-1, 1].map((s) => [Math.cos(GATE_A + s * GATE_HALF) * WALL_R, Math.sin(GATE_A + s * GATE_HALF) * WALL_R]);
    for (const [x, z] of BANNER_POLES) {
      expect(Math.hypot(x, z)).toBeGreaterThan(WALL_R + 4);
      for (const [tx, tz] of towers) expect(Math.hypot(x - tx, z - tz)).toBeGreaterThan(4);
      expect(Math.abs(x)).toBeGreaterThan(2.5 + 3); // the road is 5 wide, lamps and arches line it at ±3.9
      expect(distToPaths(x, z)).toBeGreaterThan(1.5);
      // the riders' ring outside the wall passes wide of the pole
      expect(Math.abs(Math.hypot(x, z) - 52)).toBeGreaterThan(1.5);
    }
    // a pole on each side of the gate, and the cloth flies away from the road
    expect(BANNER_POLES.some(([x]) => x < 0) && BANNER_POLES.some(([x]) => x > 0)).toBe(true);
    expect(CLOTH_W).toBeLessThan(POLE_H);
  });
});
