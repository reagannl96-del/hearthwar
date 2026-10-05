// How big the saved world gets (the one JSON row the server writes every 30 seconds) as a realm ages.
//
//   npx vite build --ssr scripts/savesize.ts --outDir .bench --emptyOutDir && node .bench/savesize.js [hours]

import { gzipSync } from 'node:zlib';
import { advance } from '../src/engine/game';
import { createWorld, defaultConfig } from '../src/engine/world';

const hours = Number(process.argv[2] || 48);
const w = createWorld({
  worldName: 'Bench', playerName: '', villageName: '', multiplayer: true, seed: 7,
  config: { ...defaultConfig(), size: 120, aiCount: 70, speed: 150, difficulty: 'normal' },
});
for (let h = 1; h <= hours; h++) {
  const start = w.now;
  for (let m = 1; m <= 60; m++) advance(w, start + m * 60_000);
  if (h % 6) continue;
  const json = JSON.stringify(w);
  const parts = Object.entries(w).map(([k, v]) => [k, JSON.stringify(v)?.length ?? 0] as const).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log(`h${h}: ${(json.length / 1e6).toFixed(1)} MB (gzip ${(gzipSync(json).length / 1e6).toFixed(2)} MB) · ${parts.map(([k, n]) => `${k} ${(n / 1e6).toFixed(1)}`).join(', ')}`);
}
