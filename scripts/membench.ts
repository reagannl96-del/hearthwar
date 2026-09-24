// Memory benchmark: a realm like the online one, played forward as the server does,
// reporting the JS heap, the event queue and the save size as it goes.
//
//   npx vite build --ssr scripts/membench.ts --outDir .bench --emptyOutDir && node --expose-gc .bench/membench.js [hours]

import { advance } from '../src/engine/game';
import { createWorld, defaultConfig, spawnPlayer } from '../src/engine/world';
import { privatePacket, publicSnapshot } from '../src/engine/shadow';

const hours = Number(process.argv[2] || 48);
const w = createWorld({ worldName: 'M', playerName: '', villageName: '', multiplayer: true, seed: 5, config: { ...defaultConfig(), size: 180, aiCount: 70, difficulty: 'normal' } });
for (let i = 0; i < 10; i++) spawnPlayer(w, 'P' + i, 'H' + i);
const humans = Object.values(w.players).filter((p) => p.kind === 'human');
const gc = (globalThis as { gc?: () => void }).gc;
const mb = (n: number) => (n / 1e6).toFixed(0) + 'MB';
for (let h = 1; h <= hours; h++) {
  advance(w, h * 3_600_000);
  if (h % 6 === 0) {
    // what the server builds for its clients
    for (const p of humans) JSON.stringify(privatePacket(w, p.id));
    JSON.stringify(publicSnapshot(w));
    gc?.();
    const m = process.memoryUsage();
    const intel = Object.values(w.players).reduce((a, p) => a + Object.keys(p.intel).length, 0);
    const reports = Object.values(w.players).reduce((a, p) => a + p.reports.length, 0);
    console.log(`h${h}: heap ${mb(m.heapUsed)} rss ${mb(m.rss)} | events ${w.events.length} commands ${Object.keys(w.commands).length} intel ${intel} reports ${reports} news ${w.news.length} | save ${mb(JSON.stringify(w).length)}`);
  }
}
{
  const priv = humans.map((p) => JSON.stringify(privatePacket(w, p.id)).length);
  console.log(`== packets: private ${Math.round(Math.min(...priv) / 1000)}-${Math.round(Math.max(...priv) / 1000)} KB each, public map ${Math.round(JSON.stringify(publicSnapshot(w)).length / 1000)} KB`);
  let t = performance.now();
  for (let i = 0; i < 20; i++) for (const p of humans) JSON.stringify(privatePacket(w, p.id));
  console.log(`== building 10 private packets: ${((performance.now() - t) / 20).toFixed(1)} ms`);
  t = performance.now();
  for (let i = 0; i < 20; i++) advance(w, w.now + 250);
  console.log(`== one 250 ms tick: ${((performance.now() - t) / 20).toFixed(2)} ms`);
  t = performance.now();
  JSON.stringify(w);
  console.log(`== serialising the world for a save: ${(performance.now() - t).toFixed(0)} ms`);
}
