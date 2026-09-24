// The resource cache as a player sees it: which one is up, and what your own reports
// tell you about it. Nobody is told who holds a cache; you learn it by fighting there,
// so everything here is read from the reports in your inbox.

import { activeCache, cacheGuards } from '../engine/caches';
import type { BattleData, Report, Units, World } from '../engine/types';

/** The cache being fought over, as the map shows it to anyone. */
export interface CacheView { id: number; x: number; y: number; level: number; endsAt: number }

export function currentCache(w: World): CacheView | null {
  const v = activeCache(w);
  return v && v.cache ? { id: v.id, x: v.x, y: v.y, level: v.cache.level, endsAt: v.cache.endsAt } : null;
}

/** A report of a battle at this cache (the same cache: its village and its deadline). */
export function atCache(r: Report, c: { id: number; endsAt: number }): boolean {
  const b = r.battle;
  return !!b?.cache && b.defender.vid === c.id && b.cache.endsAt === c.endsAt;
}

/** Only scouts went: a scouting run wins nothing, not even a claim. */
const scoutsOnly = (u: Units) => {
  let any = false;
  for (const [k, n] of Object.entries(u)) {
    if ((n ?? 0) <= 0) continue;
    if (k !== 'scout') return false;
    any = true;
  }
  return any;
};

/** Your won attack there, if any: winning one is what gives you a claim on the cache. */
export function cacheClaim(reports: Report[], c: { id: number; endsAt: number }, me: number): Report | null {
  let best: Report | null = null;
  for (const r of reports) {
    const b = r.battle;
    if (r.kind !== 'attack' || !b || !atCache(r, c)) continue;
    if (b.attacker.playerId !== me || b.winner !== 'attacker' || scoutsOnly(b.attUnits)) continue;
    if (!best || r.t < best.t) best = r;
  }
  return best;
}

/** Whether you may send the cache support, and why not when you may not. */
export function cacheSupport(reports: Report[], c: { id: number; endsAt: number }, me: number): { ok: boolean; reason?: string } {
  if (cacheClaim(reports, c, me)) return { ok: true };
  return { ok: false, reason: 'Win an attack here first: only rulers who have won a battle at the cache may station troops in it.' };
}

/** What your latest battle report there says: who held the cache after that fight, and when it was. */
export interface CacheIntel { id: number; t: number; holder?: string; holderId?: number; won: boolean; mine: boolean }

export function cacheIntel(reports: Report[], c: { id: number; endsAt: number }, me: number): CacheIntel | null {
  let best: Report | null = null;
  for (const r of reports) if (atCache(r, c) && (!best || r.t > best.t)) best = r;
  if (!best) return null;
  const b = best.battle!;
  return { id: best.id, t: best.t, holder: b.cache!.holder, holderId: b.cache!.holderId, won: b.winner === 'attacker', mine: b.attacker.playerId === me };
}

/**
 * Remember which caches this player has been told about, so the toast comes once per
 * cache. Returns true the first time it sees this one.
 */
export function firstSight(store: Pick<Storage, 'getItem' | 'setItem'> | null, world: string, c: { id: number; endsAt: number }): boolean {
  const key = `hw-cache-seen:${world}`;
  const tag = `${c.id}:${c.endsAt}`;
  try {
    if (!store || store.getItem(key) === tag) return false;
    store.setItem(key, tag);
    return true;
  } catch {
    return false;
  }
}

const scaled = (u: Units, k: number): Units => {
  const o: Units = {};
  for (const [id, n] of Object.entries(u)) if ((n ?? 0) > 0) o[id as keyof Units] = Math.round((n ?? 0) * k);
  return o;
};

/**
 * A lost battle at a cache never showed the defenders. To play it out anyway, stand up
 * the guards as strong as the cache's level (or, once someone holds it, a garrison about
 * the size of the army that broke on it), a few of them falling in the fight.
 */
export function cacheReplayBattle(b: BattleData, archers: boolean): BattleData {
  if (!b.cache || b.defUnits) return b;
  const att = Object.values(b.attUnits).reduce((s: number, n) => s + (n ?? 0), 0);
  const guess: Units = b.cache.holder
    ? { spear: Math.max(100, Math.round(att * 0.7)), sword: Math.max(60, Math.round(att * 0.5)), heavy: Math.max(10, Math.round(att * 0.05)) }
    : cacheGuards(b.cache.level, archers).units;
  return { ...b, defUnits: guess, defLost: scaled(guess, 0.2) };
}
