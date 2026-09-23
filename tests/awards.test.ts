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
