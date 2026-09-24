import { describe, expect, it } from 'vitest';
import { spawnCache } from '../src/engine/caches';
import { sendTroops } from '../src/engine/commands';
import { advance } from '../src/engine/game';
import { MINUTE } from '../src/engine/formulas';
import { invalidateSpatial } from '../src/engine/spatial';
import type { BattleData, Report } from '../src/engine/types';
import { createWorld, defaultConfig } from '../src/engine/world';
import { buildMap } from '../src/engine/view';
import { cacheClaim, cacheIntel, cacheReplayBattle, cacheSupport, currentCache, firstSight } from '../src/ui/caches';

/** A realm with a cache right next door to the human player. */
function setup() {
  const w = createWorld({ worldName: 'C', playerName: 'P', villageName: 'Home', seed: 12, config: { ...defaultConfig(), difficulty: 'peaceful', aiCount: 3, size: 90 } });
  const me = w.players[w.humanId];
  const v = w.villages[me.villages[0]];
  me.protectedUntil = 0;
  Object.assign(v.buildings, { rally: 1, farm: 30, warehouse: 25 });
  const cache = spawnCache(w)!;
  cache.x = v.x + 2; cache.y = v.y;
  invalidateSpatial();
  return { w, me, v, cache };
}

const side = (pid: number | null, vid: number) => ({ playerId: pid, playerName: pid === null ? 'Barbarians' : 'P', vid, vname: 'V', x: 0, y: 0 });
/** A battle report at a cache, as the engine writes them. */
function report(id: number, t: number, o: { me: number; vid: number; endsAt: number; won: boolean; units?: BattleData['attUnits']; holder?: string; kind?: Report['kind'] }): Report {
  return {
    id, t, kind: o.kind ?? 'attack', title: 'x', color: o.won ? 'green' : 'red', read: true, vid: o.vid,
    battle: {
      attacker: side(o.me, 1), defender: side(null, o.vid), luck: 0, morale: 1,
      attUnits: o.units ?? { axe: 100 }, attLost: {}, winner: o.won ? 'attacker' : 'defender',
      cache: { endsAt: o.endsAt, level: 2, holder: o.holder, holderId: o.holder ? 7 : undefined },
    },
  };
}

describe('resource caches as the player sees them', () => {
  it('the map and the banner see the cache, its level and its deadline, but not its claims', () => {
    const { w, cache } = setup();
    expect(currentCache(w)).toEqual({ id: cache.id, x: cache.x, y: cache.y, level: cache.cache!.level, endsAt: cache.cache!.endsAt });
    const mv = buildMap(w).villages.find((m) => m.id === cache.id)!;
    expect(mv.cache).toEqual({ level: cache.cache!.level, endsAt: cache.cache!.endsAt });
    expect(mv.ownerId).toBeNull();
  });

  it('support is allowed only after winning an attack there, read from your own reports', () => {
    const c = { id: 50, endsAt: 1_000_000 };
    const me = 3;
    expect(cacheSupport([], c, me).ok).toBe(false);
    expect(cacheSupport([], c, me).reason).toMatch(/win an attack/i);
    // a lost attack, a won scouting run, someone else's win and a win at an earlier cache on the same spot give no claim
    const noClaim = [
      report(1, 10, { me, vid: 50, endsAt: c.endsAt, won: false }),
      report(2, 20, { me, vid: 50, endsAt: c.endsAt, won: true, units: { scout: 5 } }),
      report(3, 30, { me: 9, vid: 50, endsAt: c.endsAt, won: true }),
      report(4, 40, { me, vid: 50, endsAt: 500, won: true }),
      report(5, 50, { me, vid: 51, endsAt: c.endsAt, won: true }),
      report(6, 60, { me, vid: 50, endsAt: c.endsAt, won: true, kind: 'support' }),
    ];
    expect(cacheClaim(noClaim, c, me)).toBeNull();
    expect(cacheSupport(noClaim, c, me).ok).toBe(false);
    // a won attack with real troops (scouts along are fine) is a claim
    const won = report(7, 70, { me, vid: 50, endsAt: c.endsAt, won: true, units: { axe: 500, scout: 5 } });
    expect(cacheClaim([...noClaim, won], c, me)?.id).toBe(7);
    expect(cacheSupport([won, ...noClaim], c, me)).toEqual({ ok: true });
  });

  it('what you know is your latest report there, whoever fought it', () => {
    const c = { id: 50, endsAt: 1_000_000 };
    expect(cacheIntel([], c, 3)).toBeNull();
    const reps = [
      report(2, 200, { me: 3, vid: 50, endsAt: c.endsAt, won: false, holder: 'Rook' }),
      report(1, 100, { me: 3, vid: 50, endsAt: c.endsAt, won: true }),
      report(3, 300, { me: 3, vid: 50, endsAt: 1, won: true, holder: 'Old' }),
    ];
    expect(cacheIntel(reps, c, 3)).toMatchObject({ id: 2, t: 200, holder: 'Rook', won: false, mine: true });
  });

  it('reads real battle reports: a lost raid names the holder, a won attack is a claim', () => {
    const { w, me, v, cache } = setup();
    const c = currentCache(w)!;
    v.units = { axe: 20, spear: 600 };
    expect(sendTroops(w, { ownerId: me.id, fromVid: v.id, toVid: cache.id, kind: 'attack', units: { axe: 20 } }).ok).toBe(true);
    advance(w, w.now + 20 * MINUTE);
    expect(cacheSupport(me.reports, c, me.id).ok).toBe(false);
    expect(cacheIntel(me.reports, c, me.id)).toMatchObject({ won: false, mine: true, holder: undefined });
    // the guards gone, a real attack wins: now support may go in, and the engine agrees
    cache.units = {};
    v.units.axe = 200;
    expect(sendTroops(w, { ownerId: me.id, fromVid: v.id, toVid: cache.id, kind: 'attack', units: { axe: 200 } }).ok).toBe(true);
    advance(w, w.now + 20 * MINUTE);
    expect(cacheSupport(me.reports, c, me.id).ok).toBe(true);
    expect(sendTroops(w, { ownerId: me.id, fromVid: v.id, toVid: cache.id, kind: 'support', units: { spear: 500 } }).ok).toBe(true);
    advance(w, w.now + 20 * MINUTE);
    // scouting now reports us as the holder
    v.units.scout = 5;
    expect(sendTroops(w, { ownerId: me.id, fromVid: v.id, toVid: cache.id, kind: 'attack', units: { scout: 5 } }).ok).toBe(true);
    advance(w, w.now + 20 * MINUTE);
    expect(cacheIntel(me.reports, c, me.id)).toMatchObject({ holderId: me.id });
    // and nothing was carried off the cache
    expect(me.reports.every((r) => !r.battle?.loot)).toBe(true);
  });

  it('the toast comes once per cache', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
    expect(firstSight(store, 'R', { id: 1, endsAt: 10 })).toBe(true);
    expect(firstSight(store, 'R', { id: 1, endsAt: 10 })).toBe(false);
    expect(firstSight(store, 'Other', { id: 1, endsAt: 10 })).toBe(true);
    expect(firstSight(store, 'R', { id: 2, endsAt: 20 })).toBe(true);
    expect(firstSight(null, 'R', { id: 3, endsAt: 30 })).toBe(false);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => undefined };
    expect(firstSight(broken, 'R', { id: 4, endsAt: 40 })).toBe(false);
  });

  it('a lost battle at a cache can still be replayed, with guards stood up for it', () => {
    const lost = report(1, 1, { me: 3, vid: 50, endsAt: 9, won: false }).battle!;
    const guards = cacheReplayBattle(lost, true);
    expect(Object.values(guards.defUnits!).reduce((a, n) => a + (n ?? 0), 0)).toBeGreaterThan(0);
    expect(guards.defLost).toBeDefined();
    const held = cacheReplayBattle({ ...lost, cache: { ...lost.cache!, holder: 'Rook' } }, true);
    expect(held.defUnits!.spear).toBeGreaterThan(0);
    // a battle whose defenders are known is left as it is
    const known = { ...lost, defUnits: { spear: 3 }, defLost: { spear: 1 } };
    expect(cacheReplayBattle(known, true)).toBe(known);
  });
});
