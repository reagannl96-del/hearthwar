import { describe, expect, it } from 'vitest';
import { aiAwake } from '../src/engine/ai/ai';
import { advance } from '../src/engine/game';
import { createWorld, defaultConfig } from '../src/engine/world';

// The long version of this lives in scripts/aibench.ts; this keeps the headline numbers honest.
describe('AI rulers play at a human pace', () => {
  it('about one attack a minute while online, and no runaway expansion in the first days', () => {
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 7, config: { ...defaultConfig(), size: 110, aiCount: 12, difficulty: 'normal' } });
    // the rulers' hours follow the real clock the realm was made at: pin it, so the test is the same every run
    w.createdReal = 0;
    const ais = Object.values(w.players).filter((p) => p.kind === 'ai');
    const online = new Map<number, number>();
    for (let m = 0; m < 2 * 1440; m++) {
      advance(w, m * 60_000);
      for (const p of ais) if (aiAwake(w, p)) online.set(p.id, (online.get(p.id) ?? 0) + 1);
    }
    for (const p of ais) {
      const hours = (online.get(p.id) ?? 0) / 60;
      // at most eight hours a day, plus the realm's opening rush when nobody sleeps
      expect(hours).toBeLessThan(2 * 8 + 2);
      // a person clicking out raids between everything else: not hundreds an hour
      expect(p.stats.attacks / Math.max(1, hours)).toBeLessThan(120);
      // a speedy realm: the hungriest rulers take several villages a day once they get going, but never
      // more than about six a day, and the first conquests only come late on day one
      expect(p.villages.length).toBeLessThanOrEqual(1 + 2 * 6);
    }
  }, 60_000);
});
