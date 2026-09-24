import { describe, expect, it } from 'vitest';
import { awardsSummary, bumpDaily, dayOf, rolloverDay } from '../src/engine/awards';
import { playerProfile } from '../src/engine/view';
import { createWorld, defaultConfig, spawnPlayer } from '../src/engine/world';

describe('daily awards', () => {
  it('the day\'s best attacker and defender win, with their score and the runner-up\'s', () => {
    const w = createWorld({ worldName: 'T', playerName: '', villageName: '', multiplayer: true, seed: 3, config: { ...defaultConfig(), aiCount: 4, size: 50 } });
    const a = spawnPlayer(w, 'Alda', 'A')!;
    const b = spawnPlayer(w, 'Bram', 'B')!;
    rolloverDay(w);
    const day = dayOf(w);
    bumpDaily(w, a, 'defender', 3038);
    bumpDaily(w, b, 'defender', 3);
    bumpDaily(w, b, 'attacker', 900);
    // midnight passes
    w.now += 86_400_000;
    rolloverDay(w);
    expect(a.dailyAwards).toEqual([{ kind: 'defender', day, score: 3038, runnerUp: 3 }]);
    expect(b.dailyAwards).toEqual([{ kind: 'attacker', day, score: 900, runnerUp: null }]);
    // today starts from zero
    expect(a.daily).toBeUndefined();
    const prof = playerProfile(w, a.id)!;
    expect(prof.awards.map((x) => [x.title, x.count])).toEqual([['Defender of the day', 1]]);
    expect(awardsSummary(b)[0].history[0].score).toBe(900);
    // nothing to hand out on a quiet day
    w.now += 86_400_000;
    rolloverDay(w);
    expect(a.dailyAwards!.length).toBe(1);
  });
});

describe('AI rulers keep human hours', () => {
  it('each plays in sessions, about six and a half hours a day, and sleeps eight', async () => {
    const { aiAwake } = await import('../src/engine/ai/ai');
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 4, config: { ...defaultConfig(), aiCount: 5, size: 50 } });
    for (const p of Object.values(w.players).filter((x) => x.kind === 'ai')) {
      let awake = 0, sessions = 0, was = false, longestAway = 0, away = 0;
      // (after the opening rush, when nobody sleeps)
      const start = w.now + 6 * 3_600_000;
      // two days, so the night is never cut in half by the edge of the sample
      for (let m = 0; m < 2880; m++) {
        w.now = start + m * 60_000;
        const on = aiAwake(w, p);
        if (on) away = 0; else { away++; longestAway = Math.max(longestAway, away); }
        if (m < 1440) {
          if (on) awake++;
          if (on && !was) sessions++;
        }
        was = on;
      }
      w.now = 0;
      // at the keyboard 3-8 hours a day (casual to dedicated), spread over several sessions, with one long night
      expect(awake).toBeGreaterThan(3 * 60);
      expect(awake).toBeLessThan(8 * 60);
      expect(sessions).toBeGreaterThanOrEqual(6);
      expect(longestAway).toBeGreaterThanOrEqual(8 * 60);
    }
  });

  it('nobody sleeps through the opening of a new realm', async () => {
    const { aiAsleep } = await import('../src/engine/ai/ai');
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 4, config: { ...defaultConfig(), aiCount: 8, size: 60 } });
    const ais = Object.values(w.players).filter((x) => x.kind === 'ai');
    for (let m = 0; m < 4 * 60; m += 10) {
      w.now = m * 60_000;
      expect(ais.some((p) => aiAsleep(w, p))).toBe(false);
    }
  });

  it('between sessions a ruler still glances in and keeps the builders busy', async () => {
    const { aiAwake, aiThink } = await import('../src/engine/ai/ai');
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 4, config: { ...defaultConfig(), aiCount: 5, size: 50 } });
    const p = Object.values(w.players).find((x) => x.kind === 'ai')!;
    const v = w.villages[p.villages[0]];
    // find a moment the ruler is away from the keyboard, well after the opening
    w.now = 6 * 3_600_000;
    while (aiAwake(w, p)) w.now += 60_000;
    v.res = { wood: 50_000, clay: 50_000, iron: 50_000 };
    v.buildQueue = [];
    p.ai!.lastGlance = undefined;
    aiThink(w, p);
    expect(v.buildQueue.length).toBeGreaterThan(0);
    // but no war and no raids from a glance
    expect(Object.values(w.commands).filter((c) => c.ownerId === p.id).length).toBe(0);
  });
});
