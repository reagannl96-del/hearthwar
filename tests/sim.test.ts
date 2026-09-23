import { describe, expect, it } from 'vitest';
import { advance } from '../src/engine/game';
import { HOUR } from '../src/engine/formulas';
import { createWorld, defaultConfig } from '../src/engine/world';
import { rankingFor } from '../src/engine/view';
import { recomputeCounters } from '../src/engine/village';

describe('headless world simulation', () => {
  it('runs 10 game hours of AI play without errors', () => {
    const w = createWorld({ worldName: 'Test', playerName: 'Tester', villageName: 'Home', config: defaultConfig(), seed: 1234 });
    const t0 = performance.now();
    const checkpoints = [1, 2, 4, 6, 8, 10, 12, 16];
    for (const h of checkpoints) {
      const s = performance.now();
      advance(w, h * HOUR);
      const el = performance.now() - s;
      const rank = rankingFor(w).filter((p) => p.kind === 'ai');
      const top = rank.slice(0, 3).map((p) => `${p.name.split(' ')[0]}(${p.personality}) ${p.points}p/${p.villages}v`).join(', ');
      const totalV = rank.reduce((s, p) => s + p.villages, 0);
      const cmds = Object.keys(w.commands).length;
      console.log(`t=${h}h: ${el.toFixed(0)}ms, events=${w.events.length}, commands=${cmds}, AI villages=${totalV}, top: ${top}`);
    }
    console.log(`total ${(performance.now() - t0).toFixed(0)}ms`);
    // counters stay consistent with a full recount
    const before = Object.values(w.villages).map((v) => [v.id, v.outPop, v.merchantsOut]);
    recomputeCounters(w);
    const after = Object.values(w.villages).map((v) => [v.id, v.outPop, v.merchantsOut]);
    const diffs = before.filter((b, i) => b[1] !== after[i][1] || b[2] !== after[i][2]);
    if (diffs.length) console.log('counter drift', diffs.slice(0, 5), after.filter((a) => diffs.some((d) => d[0] === a[0])).slice(0, 5));
    expect(diffs.length).toBe(0);
    const news = w.news.slice(0, 8).map((n) => n.text);
    console.log(news.join('\n'));
    expect(rankingFor(w)[0].points).toBeGreaterThan(500);
  }, 120_000);
});
