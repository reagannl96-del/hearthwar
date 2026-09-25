import { describe, expect, it } from 'vitest';
import { finishRound, honourChampion } from '../src/engine/round';
import { createWorld, defaultConfig, spawnPlayer } from '../src/engine/world';

describe('honours', () => {
  it("the realm's best human ruler is honoured as champion, on their account", () => {
    const w = createWorld({ worldName: 'Old Realm', playerName: '', villageName: '', multiplayer: true, seed: 4, config: { ...defaultConfig(), aiCount: 3, size: 90 } });
    w.accounts = {};
    const a = spawnPlayer(w, 'lxve', 'A')!, b = spawnPlayer(w, 'Other', 'B')!;
    w.accounts['acct-lxve'] = a.id; w.accounts['acct-other'] = b.id;
    a.points = 46000; b.points = 12000;
    finishRound(w);
    expect(honourChampion(w)).toBe('lxve');
    expect(w.honours?.['acct-lxve']?.[0]).toMatchObject({ title: 'Champion', realm: 'Old Realm', points: 46000 });
    expect(a.honours?.length).toBe(1);
    expect(w.honours?.['acct-other']).toBeUndefined();
  });
});
