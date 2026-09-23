// AI pace benchmark: plays a normal-speed realm forward and measures how hard the
// AI rulers work, day by day, next to what a dedicated human manages.
//
//   npx vite build --ssr scripts/aibench.ts --outDir .bench --emptyOutDir && node .bench/aibench.js [days] [seed]
//
// For every AI ruler it counts attacks sent (raids and war), what they looted,
// the points and army they built, and how many minutes of the day they were at
// the keyboard. A dedicated human on a speed-150 realm is online about 6-7 hours
// a day, in sessions, clicking every minute or two while there; the AI must land
// in the same range, not outwork everyone around the clock.

import { advance } from '../src/engine/game';
import { aiAwake } from '../src/engine/ai/ai';
import { createWorld, defaultConfig } from '../src/engine/world';
import { unitsPop } from '../src/engine/formulas';
import type { Player, World } from '../src/engine/types';

const DAY = 86_400_000;
const days = Number(process.argv[2] || 3);
const seed = Number(process.argv[3] || 7);

const w: World = createWorld({
  worldName: 'Bench', playerName: 'Human', villageName: 'Home', seed,
  config: { ...defaultConfig(), size: 120, aiCount: 20, difficulty: 'normal' },
});
const ais = (): Player[] => Object.values(w.players).filter((p) => p.kind === 'ai');

interface Snap { attacks: number; loot: number; points: number; villages: number; army: number }
const snap = (p: Player): Snap => ({
  attacks: p.stats.attacks,
  loot: p.stats.loot,
  points: p.points,
  villages: p.villages.length,
  army: p.villages.reduce((s, vid) => s + unitsPop(w.villages[vid]?.units ?? {}), 0),
});

const started = Date.now();
let prev = new Map(ais().map((p) => [p.id, snap(p)]));
console.log(`Realm: ${w.config.size}x${w.config.size}, speed ${w.config.speed}, ${ais().length} AI rulers, ${days} days\n`);
console.log('day | online h/day | attacks/day (avg, max) | attacks/online-h | loot/day (avg) | points (avg, max) | army pop (avg) | villages (avg, max)');
for (let d = 1; d <= days; d++) {
  // minutes online today, sampled every minute
  const online = new Map<number, number>();
  const start = w.now;
  for (let m = 0; m < 1440; m += 1) {
    advance(w, start + m * 60_000);
    for (const p of ais()) if (aiAwake(w, p)) online.set(p.id, (online.get(p.id) ?? 0) + 1);
  }
  advance(w, start + DAY);
  const rows = ais().map((p) => {
    const a = prev.get(p.id) ?? { attacks: 0, loot: 0, points: 0, villages: 0, army: 0 };
    const b = snap(p);
    const hours = (online.get(p.id) ?? 0) / 60;
    return { attacks: b.attacks - a.attacks, loot: b.loot - a.loot, hours, perHour: hours > 0 ? (b.attacks - a.attacks) / hours : 0, points: b.points, army: b.army, villages: b.villages };
  });
  const avg = (k: keyof (typeof rows)[number]) => rows.reduce((s, r) => s + (r[k] as number), 0) / Math.max(1, rows.length);
  const max = (k: keyof (typeof rows)[number]) => Math.max(...rows.map((r) => r[k] as number));
  console.log(
    `${d.toString().padStart(3)} | ${avg('hours').toFixed(1).padStart(12)} | ${avg('attacks').toFixed(0).padStart(10)}, ${max('attacks').toFixed(0).padStart(6)} | ${avg('perHour').toFixed(1).padStart(16)} | ${avg('loot').toFixed(0).padStart(14)} | ${avg('points').toFixed(0).padStart(8)}, ${max('points').toFixed(0).padStart(7)} | ${avg('army').toFixed(0).padStart(14)} | ${avg('villages').toFixed(1).padStart(6)}, ${max('villages').toFixed(0).padStart(4)}`,
  );
  prev = new Map(ais().map((p) => [p.id, snap(p)]));
}
console.log(`\n(simulated in ${((Date.now() - started) / 1000).toFixed(1)} s)`);
