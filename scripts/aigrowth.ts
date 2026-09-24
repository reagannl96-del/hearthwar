// How AI rulers' points grow over the first day of a fresh online realm, hour by hour:
// the spread matters as much as the average (a ruler stuck for hours looks dead).
//
//   npx vite build --ssr scripts/aigrowth.ts --outDir .bench --emptyOutDir && node .bench/aigrowth.js [hours] [seed]

import { advance } from '../src/engine/game';
import { aiAwake } from '../src/engine/ai/ai';
import { createWorld, defaultConfig } from '../src/engine/world';
import type { World } from '../src/engine/types';

const HOUR = 3_600_000;
const hours = Number(process.argv[2] || 24);
const seed = Number(process.argv[3] || 7);
const w: World = createWorld({
  worldName: 'Bench', playerName: '', villageName: '', multiplayer: true, seed,
  config: { ...defaultConfig(), size: 180, aiCount: 34, difficulty: 'normal' },
});
const ais = () => Object.values(w.players).filter((p) => p.kind === 'ai' && !p.eliminated);
let prev = new Map(ais().map((p) => [p.id, p.points]));
console.log('hour | awake | min  p10  median  max | rulers that gained nothing this hour');
for (let h = 1; h <= hours; h++) {
  const start = w.now;
  for (let m = 1; m <= 60; m++) advance(w, start + m * 60_000);
  const pts = ais().map((p) => p.points).sort((a, b) => a - b);
  const q = (f: number) => pts[Math.min(pts.length - 1, Math.floor(f * pts.length))];
  const stuck = ais().filter((p) => (prev.get(p.id) ?? 0) >= p.points).length;
  const awake = ais().filter((p) => aiAwake(w, p)).length;
  console.log(`${String(h).padStart(4)} | ${String(awake).padStart(5)} | ${String(q(0)).padStart(5)} ${String(q(0.1)).padStart(5)} ${String(q(0.5)).padStart(7)} ${String(q(0.999)).padStart(6)} | ${stuck}/${pts.length}`);
  prev = new Map(ais().map((p) => [p.id, p.points]));
}
void HOUR;
