// Army census: troop population per village point for AI villages, by temperament and size.
//
//   npx vite build --ssr scripts/armycensus.ts --outDir .bench --emptyOutDir && node .bench/armycensus.js
//
// Good human players keep about 2:1 (troop population to points) as villages grow;
// full villages are capped by their farm (about 1.45:1 at max).

import { advance } from '../src/engine/game';
import { createWorld, defaultConfig } from '../src/engine/world';
import { unitsPop } from '../src/engine/formulas';
import { updateVillage } from '../src/engine/village';

const w = createWorld({ worldName: 'C', playerName: 'P', villageName: 'Home', seed: 11, config: { ...defaultConfig(), aiCount: 60, size: 200 } });
const start = w.now;
let last = 0;
for (const h of [24, 48, 72, 96]) {
  for (let m = last + 5; m <= h * 60; m += 5) advance(w, start + m * 60_000);
  last = h * 60;
  const rows: Record<string, number[]> = {};
  const bands = [[300, 1000], [1000, 2500], [2500, 5000], [5000, 99999]];
  for (const p of Object.values(w.players)) {
    if (!p.ai) continue;
    for (const vid of p.villages) {
      const v = w.villages[vid];
      updateVillage(w, v, w.now);
      const pts = v.points;
      const pop = unitsPop(v.units) + v.outPop;
      const b = bands.find(([a, z]) => pts >= a && pts < z);
      if (!b) continue;
      (rows[`${p.ai.personality}:${b[0]}`] ??= []).push(pop / Math.max(1, pts));
      (rows[`ALL:${b[0]}`] ??= []).push(pop / Math.max(1, pts));
    }
  }
  console.log(`--- hour ${h}`);
  for (const k of Object.keys(rows).sort()) {
    const a = rows[k].sort((x, y) => x - y);
    console.log(k.padEnd(20), 'n=' + String(a.length).padEnd(4), 'median ratio', a[a.length >> 1].toFixed(2), ' p90', a[Math.floor(a.length * 0.9)].toFixed(2));
  }
}
