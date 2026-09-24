// Hero census: which heroes AI villages swear to, region by region.
//
//   npx vite build --ssr scripts/herocensus.ts --outDir .bench --emptyOutDir && node .bench/herocensus.js

import { advance } from '../src/engine/game';
import { createWorld, defaultConfig } from '../src/engine/world';
import { regionAt } from '../src/engine/regions';

const w = createWorld({ worldName: 'C', playerName: 'P', villageName: 'Home', seed: 11, config: { ...defaultConfig(), aiCount: 60, size: 200 } });
const start = w.now;
for (let m = 5; m <= 48 * 60; m += 5) advance(w, start + m * 60_000);
const tally: Record<string, Record<string, number>> = {};
for (const p of Object.values(w.players)) {
  if (!p.ai) continue;
  for (const vid of p.villages) {
    const v = w.villages[vid];
    const r = regionAt(v.x, v.y, w.config.size);
    const h = v.heroKind ?? '-';
    (tally[r] ??= {})[h] = (tally[r][h] ?? 0) + 1;
  }
}
for (const [r, t] of Object.entries(tally)) console.log(r.padEnd(10), JSON.stringify(t));
