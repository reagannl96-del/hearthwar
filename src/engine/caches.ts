// Resource caches: now and then a hoard of supplies is found out on open ground. For an
// hour and a half the realm fights over it. Rules (shown to players on the Realm page):
//
//  - It appears with guards and a wall, stronger the older the realm is.
//  - To claim it you must win an attack there (clearing the guards, or whoever holds it).
//    Winning gives you a claim; then you send it support. Support can only be sent once
//    the guards are gone, and only a claimant's stationed troops count.
//  - The holder is the claimant with the most troops (population) stationed there.
//  - When the time runs out, the holder's village that sent the most troops there has its
//    wood, clay and iron filled to the warehouse's brim. Every army still there then goes home.
//  - Nobody learns who holds it except by fighting there: every battle report at the cache
//    names the holder (never the village the troops came from).
//  - No noblemen (it can't be conquered), catapults only at the wall, no loot, no points.

import { addReport, news, travelTime } from './commands';
import { pushEvent } from './events';
import { HOUR, MINUTE, unitsPop } from './formulas';
import { nextRandom, randInt } from './rng';
import { invalidateSpatial } from './spatial';
import type { Command, UnitId, Units, Village, World } from './types';
import { RES_KEYS } from './types';
import { commandsTo, removeCommand, addCommand } from './cmdindex';
import { createVillage, storageOf, updateVillage } from './village';
import { buildable, inRealm, paceOf, realmDayMs, terrainAt } from './world';

/** How long a cache lasts, from the moment it's found. */
export const CACHE_DURATION = 90 * MINUTE;
/** On a fast (short) round a cache is shorter-lived and turns up more often, but stays special. */
export const cacheDuration = (w: World) => Math.max(30 * MINUTE, CACHE_DURATION / paceOf(w));
const gapScale = (w: World) => 1 / Math.min(2.5, paceOf(w));
/** A new cache turns up this long after the last one ended, give or take (real time). */
const CACHE_GAP_MIN = 6 * HOUR, CACHE_GAP_MAX = 12 * HOUR;
/** The realm must be at least this old before the first one. */
const CACHE_FIRST = 8 * HOUR;
const DAY = 24 * HOUR;

export function isCache(v: Village | undefined): boolean {
  return !!v?.cache;
}

/** The cache being fought over, if any. */
export function activeCache(w: World): Village | null {
  const v = w.cacheVid !== undefined ? w.villages[w.cacheVid] : undefined;
  return v && v.cache ? v : null;
}

/** The guard strength of a cache found now: 1 on the first day, rising a level a day to 10. */
export function cacheLevel(w: World): number {
  return Math.max(1, Math.min(10, 1 + Math.floor(w.now / realmDayMs(w))));
}

/** The guards and wall of a cache at a given strength. */
export function cacheGuards(level: number, archers: boolean): { units: Units; wall: number } {
  const L = level - 1;
  const units: Units = {
    spear: 150 + 280 * L,
    sword: 100 + 200 * L,
    heavy: 10 + 30 * L,
  };
  if (archers) units.archer = 50 + 140 * L;
  else units.spear! += 50 + 140 * L;
  return { units, wall: Math.min(20, 3 + 2 * L) };
}

/** Who holds the cache now: the claimant with the most troops stationed there. */
export function cacheHolder(w: World, v: Village): number | null {
  if (!v.cache) return null;
  const pop = new Map<number, number>();
  for (const s of v.support) {
    if (s.ownerId === null || !v.cache.claims.includes(s.ownerId)) continue;
    pop.set(s.ownerId, (pop.get(s.ownerId) ?? 0) + unitsPop(s.units));
  }
  let best: number | null = null, bestPop = 0;
  // ties go to whoever claimed it first
  for (const pid of v.cache.claims) {
    const n = pop.get(pid) ?? 0;
    if (n > bestPop) { best = pid; bestPop = n; }
  }
  return best;
}

/** Guards still standing at the cache (support can only go in once they are gone). */
export const cacheGuarded = (v: Village) => Object.values(v.units).some((n) => (n ?? 0) > 0);

/** A place for a cache: open, buildable ground with nobody within three fields, somewhere people live. */
function findSpot(w: World): [number, number] | null {
  const size = w.config.size;
  const lived = Object.values(w.villages).filter((v) => v.ownerId !== null);
  for (let tries = 0; tries < 400; tries++) {
    let x: number, y: number;
    if (lived.length && tries < 300) {
      const near = lived[Math.floor(nextRandom(w) * lived.length)];
      x = near.x + randInt(w, -9, 9);
      y = near.y + randInt(w, -9, 9);
    } else {
      x = randInt(w, 4, size - 5);
      y = randInt(w, 4, size - 5);
    }
    if (!inRealm(x, y, size) || !buildable(terrainAt(w, x, y))) continue;
    let crowded = false;
    for (const o of Object.values(w.villages)) if (Math.abs(o.x - x) <= 3 && Math.abs(o.y - y) <= 3) { crowded = true; break; }
    if (!crowded) return [x, y];
  }
  return null;
}

/** Find a cache now (returns it, or null if there is no room). */
export function spawnCache(w: World): Village | null {
  if (activeCache(w)) return null;
  const spot = findSpot(w);
  if (!spot) return null;
  const level = cacheLevel(w);
  const v = createVillage(w, spot[0], spot[1], 'Resource cache', null);
  const g = cacheGuards(level, w.config.archers);
  v.units = g.units;
  v.buildings.wall = g.wall;
  v.res = { wood: 0, clay: 0, iron: 0 };
  v.points = 0;
  v.cache = { level, endsAt: w.now + cacheDuration(w), claims: [] };
  w.cacheVid = v.id;
  invalidateSpatial();
  w.mapRev++;
  pushEvent(w, 'cache', v.cache.endsAt, v.id);
  news(w, `A resource cache has been found at ${v.x}|${v.y} (guards: level ${level}). Whoever holds it in ${Math.round(cacheDuration(w) / MINUTE)} minutes fills their stores to the brim.`, 'world', v.id);
  return v;
}

/** Called on the realm's regular tick: find a new cache when one is due. */
export function cacheTick(w: World): void {
  if (w.finished || activeCache(w)) return;
  if (w.nextCacheAt === undefined) {
    w.nextCacheAt = Math.max(w.now, CACHE_FIRST * gapScale(w)) + randInt(w, 0, Math.round((CACHE_GAP_MAX - CACHE_GAP_MIN) * gapScale(w)));
    return;
  }
  if (w.now < w.nextCacheAt) return;
  if (spawnCache(w)) w.nextCacheAt = undefined;
  else w.nextCacheAt = w.now + HOUR; // no room: try again later
}

/** Troops marching on the cache when it's gone simply turn round. */
function turnBack(w: World, v: Village): void {
  for (const c of [...commandsTo(w, v.id)]) {
    if (c.kind !== 'attack' && c.kind !== 'support') continue;
    removeCommand(w, c);
    const back: Command = {
      id: w.nextId++, kind: 'return', ownerId: c.ownerId, fromVid: c.fromVid, toVid: c.fromVid, origin: c.toVid,
      units: c.units, depart: w.now, arrive: w.now + Math.max(1000, w.now - c.depart),
    };
    addCommand(w, back);
    pushEvent(w, 'arrive', back.arrive, back.id);
  }
}

/** The cache's time is up: pay the holder, send everyone home and clear it away. */
export function endCache(w: World, vid: number): void {
  const v = w.villages[vid];
  if (!v || !v.cache) return;
  const holder = cacheHolder(w, v);
  let prize: Village | null = null;
  if (holder !== null) {
    // the holder's village with the most troops stationed at the cache
    let best = -1;
    for (const s of v.support) {
      if (s.ownerId !== holder) continue;
      const home = w.villages[s.fromVid];
      const n = unitsPop(s.units);
      if (home && home.ownerId === holder && n > best) { best = n; prize = home; }
    }
  }
  const name = holder !== null ? w.players[holder]?.name ?? 'Someone' : null;
  if (prize && holder !== null) {
    updateVillage(w, prize, w.now);
    const cap = storageOf(prize);
    const gained = { wood: 0, clay: 0, iron: 0 };
    for (const k of RES_KEYS) { gained[k] = Math.max(0, Math.floor(cap - prize.res[k])); prize.res[k] = cap; }
    addReport(w, holder, {
      kind: 'info', color: 'green', vid: prize.id,
      title: `You held the resource cache: ${prize.name} is full`,
      text: `Your troops held the resource cache at ${v.x}|${v.y} to the end. ${prize.name}'s warehouse has been filled with wood, clay and iron.`,
      res: gained,
    });
    news(w, `${name} held the resource cache at ${v.x}|${v.y} and filled their stores to the brim.`, 'world', prize.id);
  } else {
    news(w, `The resource cache at ${v.x}|${v.y} went unclaimed and has been carted off.`, 'world');
  }
  // everyone still there goes home
  for (const s of v.support) {
    const home = w.villages[s.fromVid];
    if (!home || s.ownerId === null) continue;
    const back: Command = {
      id: w.nextId++, kind: 'return', ownerId: s.ownerId, fromVid: s.fromVid, toVid: s.fromVid, origin: v.id,
      units: s.units, depart: w.now, arrive: w.now + travelTime(w, v, home, s.units, s.ownerId, true),
    };
    addCommand(w, back);
    pushEvent(w, 'arrive', back.arrive, back.id);
    if (s.ownerId !== holder) {
      addReport(w, s.ownerId, {
        kind: 'info', color: 'yellow', vid: v.id, title: 'The resource cache is gone',
        text: name ? `${name} held the resource cache at ${v.x}|${v.y} when time ran out. Your troops are on their way home.` : `The resource cache at ${v.x}|${v.y} went unclaimed. Your troops are on their way home.`,
      });
    }
  }
  v.support = [];
  turnBack(w, v);
  delete w.villages[v.id];
  if (w.cacheVid === v.id) w.cacheVid = undefined;
  w.nextCacheAt = w.now + randInt(w, Math.round(CACHE_GAP_MIN * gapScale(w)), Math.round(CACHE_GAP_MAX * gapScale(w)));
  invalidateSpatial();
  w.mapRev++;
}

/** What an attacker's battle at the cache tells them. */
export function cacheIntel(w: World, v: Village): { holder?: string; holderId?: number; endsAt: number; level: number } | undefined {
  if (!v.cache) return undefined;
  const h = cacheHolder(w, v);
  return { holder: h !== null ? w.players[h]?.name : undefined, holderId: h ?? undefined, endsAt: v.cache.endsAt, level: v.cache.level };
}

/** Units a cache's garrison could field as the defender (for AI estimates). */
export function cacheGuardEstimate(w: World, v: Village): Units {
  return cacheGuards(v.cache?.level ?? cacheLevel(w), w.config.archers).units;
}

export type { UnitId };
