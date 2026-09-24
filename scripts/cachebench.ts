// Cache bench: do AI rulers fight over resource caches, and how does it end?
//
//   npx vite build --ssr scripts/cachebench.ts --outDir .bench --emptyOutDir && node .bench/cachebench.js
//
// Runs a realm of AI rulers for a couple of days (caches turn up on their own schedule)
// and reports, for each cache: its level, how many attacks and supports were sent, who
// claimed it, who held it at the end, and any revenge strikes on a holder's village.

import { activeCache, cacheHolder } from '../src/engine/caches';
import { advance } from '../src/engine/game';
import { createWorld, defaultConfig } from '../src/engine/world';

const DAYS = Number(process.env.DAYS || 3);
const w = createWorld({ worldName: 'B', playerName: 'P', villageName: 'Home', seed: Number(process.env.SEED || 5), config: { ...defaultConfig(), aiCount: 60, size: 200 } });
const start = w.now;
let seen: number | null = null;
let stats = { attacks: 0, supports: 0, rulers: new Set<number>(), level: 0, at: '' };
const seenCmd = new Set<number>();
let lastNews = 0;
for (let m = 5; m <= DAYS * 24 * 60; m += 2) {
  advance(w, start + m * 60_000);
  const c = activeCache(w);
  if (c && seen !== c.id) {
    seen = c.id;
    stats = { attacks: 0, supports: 0, rulers: new Set(), level: c.cache!.level, at: `${c.x}|${c.y}` };
    console.log(`\nday ${(m / 1440).toFixed(2)}: cache L${c.cache!.level} at ${stats.at}`);
  }
  if (c) {
    for (const cmd of Object.values(w.commands)) {
      if (cmd.toVid !== c.id || seenCmd.has(cmd.id)) continue;
      seenCmd.add(cmd.id);
      if (cmd.kind === 'attack') stats.attacks++;
      if (cmd.kind === 'support') stats.supports++;
      stats.rulers.add(cmd.ownerId);
    }
    const h = cacheHolder(w, c);
    (stats as { holder?: string }).holder = h !== null ? w.players[h].name : '-';
    (stats as { claims?: number }).claims = c.cache!.claims.length;
  }
  if (c && c.cache!.endsAt - w.now < 3 * 60_000 && !(stats as { dbg?: boolean }).dbg) {
    (stats as { dbg?: boolean }).dbg = true;
    const ais = Object.values(w.players).filter((p) => p.ai);
    const near = ais.filter((p) => p.villages.some((id) => { const v = w.villages[id]; return v && Math.hypot(v.x - c.x, v.y - c.y) <= (p.ai!.traits?.reach ?? 15) + 18; }));
    const goals = ais.filter((p) => p.ai!.cacheGoal?.vid === c.id);
    console.log('  near', near.length, 'goals', goals.length, 'stages', goals.map((p) => p.ai!.cacheGoal!.stage + ':' + p.ai!.cacheGoal!.tries).join(' '), 'skipped', ais.filter((p) => p.ai!.cacheSkip === c.id).length);
  }
  if (!c && seen !== null) {
    console.log(`  attacks ${stats.attacks}, supports ${stats.supports}, rulers ${stats.rulers.size}, claims ${(stats as { claims?: number }).claims ?? 0}, last holder ${(stats as { holder?: string }).holder ?? '-'}`);
    seen = null;
  }
  for (const n of w.news) {
    if (n.t <= lastNews) break;
    if (/cache/.test(n.text)) console.log(`  news: ${n.text}`);
  }
  lastNews = w.news[0]?.t ?? lastNews;
}
