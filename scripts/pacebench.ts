// Pace bench: a two-day round at the online realm's settings (economy x7, marches x4),
// checked every few hours: how far the AI rulers have come, and how many caches there were.
//
//   npx vite build --ssr scripts/pacebench.ts --outDir .bench --emptyOutDir && node .bench/pacebench.js

import { advance } from '../src/engine/game';
import { createWorld, defaultConfig } from '../src/engine/world';

const w = createWorld({ worldName: 'P', playerName: 'P', villageName: 'Home', seed: 9, multiplayer: true, config: { ...defaultConfig(), speed: 1050, unitSpeed: 320, roundDays: 2, aiCount: 60, size: 200 } });
w.accounts = {};
const start = w.now;
let caches = 0, last = -1;
for (let m = 2; m <= 48 * 60; m += 2) {
  advance(w, start + m * 60_000);
  if (w.cacheVid !== undefined && w.cacheVid !== last) { caches++; last = w.cacheVid; }
  if (m % (6 * 60) === 0) {
    const ais = Object.values(w.players).filter((p) => p.kind === 'ai' && !p.eliminated);
    const vs = ais.map((p) => p.villages.length).sort((a, b) => b - a);
    const pts = ais.map((p) => p.points).sort((a, b) => b - a);
    console.log(`hour ${m / 60}: rulers ${ais.length}, villages avg ${(vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(1)} top ${vs.slice(0, 5).join('/')}, points top ${pts[0]} median ${pts[pts.length >> 1]}, caches so far ${caches}${w.finished ? ', ROUND OVER' : ''}`);
  }
}
