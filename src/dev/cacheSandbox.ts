// Dev sandbox scene for resource caches: /dev/forum.html?cache
//
// Finds a cache and moves it a few fields from the sandbox ruler's home, then fights real
// battles there: Cora clears the guards and stations support (so she holds it), our small
// raid is beaten back (its report names Cora as the holder), our big attack wins (a claim,
// and nobody holds it after), and our support marches in and stays. A crafted "you held the
// resource cache" report shows how the prize reads. Everything stays in memory.

import { addReport } from '../engine/commands';
import { advance } from '../engine/game';
import { applyAction } from '../engine/actions';
import { cacheGuards, spawnCache } from '../engine/caches';
import { invalidateSpatial } from '../engine/spatial';
import type { Units, Village, World } from '../engine/types';
import { buildable, inRealm, terrainAt } from '../engine/world';
import { createVillage, refreshPoints } from '../engine/village';

/** A free, buildable field `d` or so fields from (x, y), with nobody right next to it. */
function spotNear(w: World, x: number, y: number, d: number, avoid: Village[] = []): [number, number] | null {
  const n = w.config.size;
  const all = [...Object.values(w.villages), ...avoid];
  for (let r = d; r < d + 6; r++) {
    for (let a = 0; a < 16; a++) {
      const px = Math.round(x + Math.cos((a / 16) * Math.PI * 2) * r), py = Math.round(y + Math.sin((a / 16) * Math.PI * 2) * r);
      if (!inRealm(px, py, n) || !buildable(terrainAt(w, px, py))) continue;
      if (all.some((v) => Math.abs(v.x - px) <= 1 && Math.abs(v.y - py) <= 1)) continue;
      return [px, py];
    }
  }
  return null;
}

export function setupCache(w: World, me: number, cora: number): void {
  const pMe = w.players[me], pCora = w.players[cora];
  const home = w.villages[pMe.villages[0]];
  pMe.protectedUntil = w.now;
  pCora.protectedUntil = w.now;
  const act = (pid: number, from: Village, to: Village, kind: 'attack' | 'support', units: Units) => {
    const r = applyAction(w, pid, { type: 'send', vid: from.id, target: to.id, kind, units, catTarget: 'wall' });
    if (!r.ok) console.warn('send', kind, r.error);
    const id = r.ok ? (r.data as { id: number }).id : null;
    const c = id !== null ? w.commands[id] : undefined;
    if (c) advance(w, c.arrive + 1000);
  };

  // the cache: level 3 guards, a few fields from home
  const cache = spawnCache(w);
  if (!cache || !cache.cache) { console.warn('no cache'); return; }
  const at = spotNear(w, home.x, home.y, 3);
  if (at) { cache.x = at[0]; cache.y = at[1]; }
  cache.cache.level = 3;
  const g = cacheGuards(3, w.config.archers);
  cache.units = g.units;
  cache.buildings.wall = g.wall;
  invalidateSpatial();
  w.mapRev++;
  // (the heralds cry out where it ended up)
  const cry = w.news.find((n) => n.vid === cache.id);
  if (cry) cry.text = `A resource cache has been found at ${cache.x}|${cache.y} (guards: level 3). Whoever holds it in an hour and a half fills their stores to the brim.`;

  // our army at home
  Object.assign(home.buildings, { rally: 1, farm: 30, warehouse: 25, barracks: 10, stable: 10, workshop: 5, smithy: 10, wall: 10 });
  home.units = { spear: 1500, sword: 600, axe: 4000, light: 1400, heavy: 200, ram: 40, catapult: 20, scout: 30 };
  home.res = { wood: 12000, clay: 9000, iron: 15000 };
  refreshPoints(w, home);

  // Cora's outpost by the cache, and her army
  const cs = spotNear(w, cache.x, cache.y, 2, [cache]);
  if (!cs) { console.warn('no room for Cora'); return; }
  const cv = createVillage(w, cs[0], cs[1], 'Crowfield', cora);
  Object.assign(cv.buildings, { rally: 1, farm: 30, warehouse: 20, wall: 5 });
  cv.units = { axe: 5000, light: 1500, ram: 50, spear: 2000, sword: 1200 };
  pCora.villages.push(cv.id);
  refreshPoints(w, cv);
  invalidateSpatial();
  w.mapRev++;

  // Cora clears the guards and settles in: she holds it
  act(cora, cv, cache, 'attack', { axe: 5000, light: 1500, ram: 50 });
  act(cora, cv, cache, 'support', { spear: 1500, sword: 1000 });
  // our raid is beaten back; its report names her as the holder
  act(me, home, cache, 'attack', { axe: 250, light: 60 });
  // our full strike wins: a claim, and nobody holds it after
  act(me, home, cache, 'attack', { axe: 3700, light: 1300, heavy: 150, ram: 40, catapult: 20 });
  // and our support marches in to hold it
  act(me, home, cache, 'support', { spear: 1200, sword: 500 });
  pMe.protectedUntil = w.now;
  pCora.protectedUntil = w.now;

  // how the prize reads, from a cache held to the end some other day
  addReport(w, me, {
    kind: 'info', color: 'green', vid: home.id,
    title: `You held the resource cache: ${home.name} is full`,
    text: `Your troops held the resource cache at ${cache.x - 20}|${cache.y + 6} to the end. ${home.name}'s warehouse has been filled with wood, clay and iron.`,
    res: { wood: 14812, clay: 17930, iron: 11204 },
  });
}
