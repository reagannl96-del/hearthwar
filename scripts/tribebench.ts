// How big AI tribes grow, and how close together their members live, over a fresh online realm.
//
//   npx vite build --ssr scripts/tribebench.ts --outDir .bench --emptyOutDir && node .bench/tribebench.js [hours] [seed]

import { advance } from '../src/engine/game';
import { greatTribes } from '../src/engine/ai/ai';
import { tribePoints } from '../src/engine/tribes';
import { createWorld, defaultConfig } from '../src/engine/world';
import type { World } from '../src/engine/types';

const hours = Number(process.argv[2] || 96);
const seed = Number(process.argv[3] || 7);
const w: World = createWorld({
  worldName: 'Bench', playerName: '', villageName: '', multiplayer: true, seed,
  config: { ...defaultConfig(), size: 180, aiCount: 70, difficulty: 'normal' },
});
for (let h = 1; h <= hours; h++) {
  const start = w.now;
  for (let m = 1; m <= 60; m++) advance(w, start + m * 60_000);
  if (h % 12) continue;
  const great = greatTribes(w);
  const rows = Object.values(w.tribes).filter((t) => t.members.length).sort((a, b) => b.members.length - a.members.length).slice(0, 6).map((t) => {
    // spread: average distance of members' first villages from the tribe's centre
    const vs = t.members.map((m) => w.villages[w.players[m].villages[0]]).filter(Boolean);
    const cx = vs.reduce((a, v) => a + v.x, 0) / vs.length, cy = vs.reduce((a, v) => a + v.y, 0) / vs.length;
    const spread = vs.reduce((a, v) => a + Math.hypot(v.x - cx, v.y - cy), 0) / vs.length;
    return `[${t.tag}]${great.has(t.id) ? '*' : ''} ${t.members.length}m ~${spread.toFixed(0)}f ${Math.round(tribePoints(w, t) / 1000)}k`;
  });
  console.log(`h${h}: ${rows.join(' | ')}`);
}
