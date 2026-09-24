import { describe, expect, it } from 'vitest';
import { CACHE_DURATION, activeCache, cacheGuards, cacheHolder, cacheTick, spawnCache } from '../src/engine/caches';
import { sendTroops, travelTime } from '../src/engine/commands';
import { advance } from '../src/engine/game';
import { HOUR, MINUTE, unitsPop } from '../src/engine/formulas';
import { invalidateSpatial } from '../src/engine/spatial';
import type { Village, World } from '../src/engine/types';
import { storageOf } from '../src/engine/village';
import { createWorld, defaultConfig } from '../src/engine/world';

/** A realm with two players ready for war and a cache right next door to both. */
function setup() {
  const w = createWorld({ worldName: 'C', playerName: 'P', villageName: 'Home', seed: 12, config: { ...defaultConfig(), difficulty: 'peaceful', aiCount: 3, size: 90 } });
  const me = w.players[w.humanId];
  const v = w.villages[me.villages[0]];
  const ai = Object.values(w.players).find((p) => p.kind === 'ai')!;
  const av = w.villages[ai.villages[0]];
  for (const p of [me, ai]) p.protectedUntil = 0;
  for (const x of [v, av]) Object.assign(x.buildings, { rally: 1, farm: 30, warehouse: 25 });
  const cache = spawnCache(w)!;
  // move it right between them so marches are quick
  cache.x = v.x + 2; cache.y = v.y;
  av.x = v.x + 4; av.y = v.y + 1;
  invalidateSpatial();
  return { w, me, v, ai, av, cache };
}

const guards = (c: Village) => Object.values(c.units).reduce((a, n) => a + (n ?? 0), 0);

describe('resource caches', () => {
  it('turn up rarely, one at a time, with guards that grow with the realm', () => {
    const w = createWorld({ worldName: 'C', playerName: 'P', villageName: 'Home', seed: 3, config: { ...defaultConfig(), aiCount: 3, size: 90 } });
    cacheTick(w);
    expect(activeCache(w)).toBeNull(); // too young a realm: only the first one is scheduled
    expect(w.nextCacheAt).toBeGreaterThanOrEqual(8 * HOUR);
    const c = spawnCache(w)!;
    expect(c.cache!.endsAt).toBe(w.now + CACHE_DURATION);
    expect(spawnCache(w)).toBeNull(); // never two at once
    expect(w.news[0].text).toContain('resource cache');
    const weak = cacheGuards(1, true), strong = cacheGuards(6, true);
    expect(unitsPop(strong.units)).toBeGreaterThan(unitsPop(weak.units) * 3);
    expect(strong.wall).toBeGreaterThan(weak.wall);
  });

  it('must be cleared before it can be supported, and never conquered', () => {
    const { w, me, v, cache } = setup();
    v.units = { axe: 6000, light: 2000, spear: 1000, noble: 1, ram: 50 };
    expect(sendTroops(w, { ownerId: me.id, fromVid: v.id, toVid: cache.id, kind: 'support', units: { spear: 100 } }).ok).toBe(false);
    expect(sendTroops(w, { ownerId: me.id, fromVid: v.id, toVid: cache.id, kind: 'attack', units: { axe: 100, noble: 1 } }).ok).toBe(false);
    // clear it
    expect(sendTroops(w, { ownerId: me.id, fromVid: v.id, toVid: cache.id, kind: 'attack', units: { axe: 6000, light: 2000, ram: 50 } }).ok).toBe(true);
    advance(w, w.now + 2 * HOUR * 0.4);
    expect(guards(cache)).toBe(0);
    expect(cache.cache!.claims).toContain(me.id);
    expect(cache.ownerId).toBeNull();
    // now support goes in, and makes us the holder
    expect(sendTroops(w, { ownerId: me.id, fromVid: v.id, toVid: cache.id, kind: 'support', units: { spear: 1000 } }).ok).toBe(true);
    advance(w, w.now + 20 * MINUTE);
    expect(cacheHolder(w, cache)).toBe(me.id);
  });

  it('only claimants count, the rival learns who holds it, and the holder is paid at the end', () => {
    const { w, me, v, ai, av, cache } = setup();
    cache.units = {}; // already cleared
    v.units = { axe: 50, spear: 3000, sword: 1000 };
    av.units = { axe: 400, spear: 5000 };
    // the ai sneaks support in without ever winning there: it doesn't hold anything
    expect(sendTroops(w, { ownerId: ai.id, fromVid: av.id, toVid: cache.id, kind: 'support', units: { spear: 5000 } }).ok).toBe(true);
    // we win a (trivial) battle there... but the ai's spearmen are sitting in it: we need a real attack
    expect(sendTroops(w, { ownerId: me.id, fromVid: v.id, toVid: cache.id, kind: 'attack', units: { axe: 50 } }).ok).toBe(true);
    advance(w, w.now + 40 * MINUTE);
    expect(cacheHolder(w, cache)).toBeNull(); // the ai never won there; our attack failed
    const lost = me.reports.find((r) => r.battle?.cache);
    expect(lost?.battle?.cache?.holder).toBeUndefined();
    // the ai wins a fight there (its own support doesn't defend against itself: send an attack from a fresh stack)
    cache.support = [];
    cache.cache!.claims = [ai.id];
    cache.support.push({ fromVid: av.id, ownerId: ai.id, units: { spear: 200 } });
    expect(cacheHolder(w, cache)).toBe(ai.id);
    // our attack now fails and the report names the holder, not the village
    v.units.axe = 60;
    sendTroops(w, { ownerId: me.id, fromVid: v.id, toVid: cache.id, kind: 'attack', units: { axe: 60 } });
    advance(w, w.now + 40 * MINUTE);
    const rep = me.reports.find((r) => r.battle?.cache?.holder);
    expect(rep?.battle?.cache?.holder).toBe(ai.name);
    // time runs out: the ai's village with the most troops there is filled to the brim, and its troops walk home
    const before = { ...av.res };
    advance(w, cache.cache!.endsAt + 1000);
    expect(activeCache(w)).toBeNull();
    expect(w.villages[cache.id]).toBeUndefined();
    const cap = storageOf(av);
    expect(Math.round(av.res.wood)).toBe(Math.round(cap));
    expect(before.wood).toBeLessThan(cap);
    expect(Object.values(w.commands).some((c) => c.kind === 'return' && c.ownerId === ai.id && c.origin === cache.id)).toBe(true);
    expect(w.nextCacheAt).toBeGreaterThan(w.now + 5 * HOUR);
  });

  it('armies still marching when it ends turn round, and nothing breaks after', () => {
    const { w, me, v, cache } = setup();
    v.units = { axe: 3000 };
    w.config.unitSpeed = 1; // a slow realm, so the march easily outlasts the cache
    // far enough that the march outlasts the cache
    for (let d = 10; d < 400; d += 10) {
      cache.x = v.x + d;
      if (travelTime(w, v, cache, { axe: 1 }, me.id) > cache.cache!.endsAt - w.now + 10 * MINUTE) break;
    }
    invalidateSpatial();
    expect(sendTroops(w, { ownerId: me.id, fromVid: v.id, toVid: cache.id, kind: 'attack', units: { axe: 3000 } }).ok).toBe(true);
    advance(w, cache.cache!.endsAt + 1000);
    const back = Object.values(w.commands).find((c) => c.ownerId === me.id);
    expect(back?.kind).toBe('return');
    advance(w, w.now + 24 * HOUR);
    expect(v.units.axe).toBe(3000);
  });

  it('is left alone by barbarian growth and never farmed or targeted as a barbarian village', () => {
    const { w, cache } = setup();
    const lvl = { ...cache.buildings };
    advance(w, w.now + 60 * MINUTE);
    expect(cache.buildings).toEqual(lvl);
    expect(cache.points).toBe(0);
  });
});

export type { World };
