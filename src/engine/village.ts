// Village economy: lazy resource accrual, recruitment delivery, population & capacity.

import { BUILDINGS, BUILDING_ORDER } from './data/buildings';
import { UNITS } from './data/units';
import {
  HOUR, bonusMultiplier, buildingPop, farmCap, hideCap, mineRate, res, storageCap, unitsPop, villagePoints,
} from './formulas';
import type { BuildingId, Buildings, RecruitBuilding, Res, UnitId, Village, World } from './types';
import { RES_KEYS } from './types';
import { invalidateSpatial } from './spatial';

export const RECRUIT_BUILDINGS: RecruitBuilding[] = ['barracks', 'stable', 'workshop', 'academy', 'statue'];

/** Loyalty points regained per hour. Grows slower than world speed so a single nobleman can still conquer. */
export const loyaltyRegen = (speed: number) => speed ** 0.6;

export function emptyBuildings(): Buildings {
  const b = {} as Buildings;
  for (const id of BUILDING_ORDER) b[id] = 0;
  return b;
}

export function createVillage(w: World, x: number, y: number, name: string, ownerId: number | null): Village {
  const id = w.nextId++;
  const v: Village = {
    id, name, x, y, ownerId,
    buildings: emptyBuildings(),
    res: res(500, 500, 500),
    resAt: w.now,
    loyalty: 100,
    loyaltyAt: w.now,
    units: {},
    support: [],
    buildQueue: [],
    recruit: { barracks: [], stable: [], workshop: [], academy: [], statue: [] },
    research: [],
    tech: {},
    points: 0,
    scavengeUnlocked: 0,
    scavenge: [null, null, null, null],
    foundedAt: w.now,
    outPop: 0,
    merchantsOut: 0,
  };
  v.buildings.main = 1;
  v.buildings.farm = 1;
  v.buildings.warehouse = 1;
  v.points = villagePoints(v.buildings);
  w.villages[id] = v;
  invalidateSpatial();
  return v;
}

/** production per hour for each resource */
/** Computer rulers are less efficient than people, so they get a small production edge. */
export function aiEconomyBonus(w: World, v: Village): number {
  if (v.ownerId === null) return 1;
  const p = w.players[v.ownerId];
  if (!p || p.kind !== 'ai') return 1;
  const d = w.config.difficulty;
  // rulers play on a human's footing: no bonus on normal, a small edge on hard
  return d === 'hard' ? 1.15 : d === 'easy' ? 0.9 : 1;
}

export function productionRates(w: World, v: Village, t = w.now): Res {
  const s = w.config.speed * aiEconomyBonus(w, v);
  const militia = v.militiaUntil && v.militiaUntil > t ? 0.5 : 1;
  return {
    wood: mineRate(v.buildings.timber, s) * bonusMultiplier(v.bonus, 'wood') * militia,
    clay: mineRate(v.buildings.claypit, s) * bonusMultiplier(v.bonus, 'clay') * militia,
    iron: mineRate(v.buildings.ironmine, s) * bonusMultiplier(v.bonus, 'iron') * militia,
  };
}

export function storageOf(v: Village): number {
  const cap = storageCap(v.buildings.warehouse, v.bonus);
  // a barbarian village with a resource bonus hoards: its stores run three times as deep, so
  // what the bonus produces piles up for raiders to find (it keeps a normal warehouse once taken)
  return v.ownerId === null && resourceBonus(v) ? cap * 3 : cap;
}

/** Does this village's bonus make more of a resource (not storage, farm or recruiting)? */
export const resourceBonus = (v: Village) => v.bonus === 'wood' || v.bonus === 'clay' || v.bonus === 'iron' || v.bonus === 'all';

export function hideOf(v: Village): number {
  return hideCap(v.buildings.hiding);
}

export function farmMax(v: Village): number {
  return farmCap(v.buildings.farm, v.bonus);
}

/** level a building will have once everything in the queue has finished */
export function queuedLevel(v: Village, b: BuildingId): number {
  let l = v.buildings[b];
  for (const j of v.buildQueue) if (j.building === b) l = j.level;
  return l;
}

export function buildingsPop(v: Village): number {
  let p = 0;
  for (const b of BUILDING_ORDER) p += buildingPop(b, Math.max(v.buildings[b], queuedLevel(v, b)));
  return p;
}

export function recruitQueuePop(v: Village): number {
  let p = 0;
  for (const rb of RECRUIT_BUILDINGS) for (const j of v.recruit[rb]) p += (j.count - j.done) * UNITS[j.unit].pop;
  return p;
}

export function troopsPop(v: Village): number {
  return unitsPop(v.units) + v.outPop + recruitQueuePop(v);
}

export function popUsed(v: Village): number {
  return buildingsPop(v) + troopsPop(v);
}

export function popFree(v: Village): number {
  return farmMax(v) - popUsed(v);
}

/** Bring a village's lazy state (resources, recruits, loyalty, militia) forward to time t. */
export function updateVillage(w: World, v: Village, t: number): void {
  if (t > v.resAt) {
    const cap = storageOf(v);
    // resources are linear between events; militia halves production for part of the span
    let from = v.resAt;
    const segments: [number, number][] = [];
    if (v.militiaUntil && v.militiaUntil > from && v.militiaUntil < t) {
      segments.push([from, v.militiaUntil], [v.militiaUntil, t]);
    } else segments.push([from, t]);
    for (const [a, b] of segments) {
      const rates = productionRates(w, v, a);
      const hours = (b - a) / HOUR;
      for (const k of RES_KEYS) {
        if (v.res[k] < cap) v.res[k] = Math.min(cap, v.res[k] + rates[k] * hours);
      }
    }
    for (const k of RES_KEYS) if (v.res[k] > cap) v.res[k] = cap;
    v.resAt = t;
  }
  if (v.militiaUntil && v.militiaUntil <= t) {
    delete v.units.militia;
    v.militiaUntil = undefined;
  }
  if (t > v.loyaltyAt) {
    if (v.loyalty < 100) {
      v.loyalty = Math.min(100, v.loyalty + ((t - v.loyaltyAt) / HOUR) * loyaltyRegen(w.config.speed));
    }
    v.loyaltyAt = t;
  }
  deliverRecruits(w, v, t);
}

function deliverRecruits(w: World, v: Village, t: number): void {
  for (const rb of RECRUIT_BUILDINGS) {
    const q = v.recruit[rb];
    while (q.length > 0) {
      const job = q[0];
      if (t < job.start) break;
      const finished = Math.min(job.count, Math.floor((t - job.start) / job.per));
      if (finished > job.done) {
        const n = finished - job.done;
        v.units[job.unit] = (v.units[job.unit] ?? 0) + n;
        job.done = finished;
        const owner = v.ownerId !== null ? w.players[v.ownerId] : null;
        if (owner) {
          owner.stats.recruited += n;
          if (job.unit === 'paladin' && owner.paladin) owner.paladin.vid = v.id;
        }
      }
      if (job.done >= job.count) q.shift();
      else break;
    }
  }
}

/** Re-chain recruit jobs after a cancellation so there are no gaps. */
export function rechainRecruit(w: World, v: Village, rb: RecruitBuilding): void {
  const q = v.recruit[rb];
  for (let i = 0; i < q.length; i++) {
    const j = q[i];
    if (i === 0) {
      if (j.start > w.now) j.start = w.now;
    } else {
      const p = q[i - 1];
      j.start = p.start + p.count * p.per;
    }
  }
}

export function recruitQueueEnd(w: World, v: Village, rb: RecruitBuilding): number {
  const q = v.recruit[rb];
  if (q.length === 0) return w.now;
  const last = q[q.length - 1];
  return Math.max(w.now, last.start + last.count * last.per);
}

export function refreshPoints(w: World, v: Village): void {
  const before = v.points;
  v.points = villagePoints(v.buildings);
  if (before !== v.points) {
    w.mapRev++;
    if (v.ownerId !== null) {
      const p = w.players[v.ownerId];
      if (p) p.points += v.points - before;
    }
  }
}

export function recomputePlayerPoints(w: World): void {
  for (const id in w.players) {
    const p = w.players[id];
    p.points = p.villages.reduce((s, vid) => s + (w.villages[vid]?.points ?? 0), 0);
  }
}

/** Recompute cached away-population & merchant counters from scratch (used after loading). */
export function recomputeCounters(w: World): void {
  for (const id in w.villages) {
    w.villages[id].outPop = 0;
    w.villages[id].merchantsOut = 0;
  }
  for (const id in w.commands) {
    const c = w.commands[id];
    const home = w.villages[c.fromVid];
    if (!home) continue;
    if (c.kind === 'trade' || c.kind === 'tradeback') home.merchantsOut += c.merchants ?? 0;
    else if (home.ownerId === c.ownerId) home.outPop += unitsPop(c.units);
  }
  for (const id in w.villages) {
    const v = w.villages[id];
    for (const s of v.support) {
      const home = w.villages[s.fromVid];
      if (home && home.ownerId === s.ownerId) home.outPop += unitsPop(s.units);
    }
    for (const run of v.scavenge) if (run) v.outPop += unitsPop(run.units);
  }
}

export function canBuildReq(v: Village, b: BuildingId): { ok: boolean; missing: [BuildingId, number][] } {
  const missing: [BuildingId, number][] = [];
  const req = BUILDINGS[b].req;
  for (const k in req) {
    const need = req[k as BuildingId]!;
    if (v.buildings[k as BuildingId] < need) missing.push([k as BuildingId, need]);
  }
  return { ok: missing.length === 0, missing };
}

export function unitAvailable(w: World, v: Village, u: UnitId): { ok: boolean; reason?: string } {
  const d = UNITS[u];
  if (u === 'militia') return { ok: false, reason: 'Militia cannot be recruited.' };
  if (u === 'archer' || u === 'marcher') if (!w.config.archers) return { ok: false, reason: 'Archers are disabled in this world.' };
  if (u === 'paladin' && !w.config.paladin) return { ok: false, reason: 'The paladin is disabled in this world.' };
  for (const k in d.req) {
    const need = d.req[k as BuildingId]!;
    if (v.buildings[k as BuildingId] < need) return { ok: false, reason: `Requires ${BUILDINGS[k as BuildingId].name} level ${need}.` };
  }
  if (d.research && !(v.tech[u] && v.tech[u]! >= 1)) return { ok: false, reason: 'Research it in the smithy first.' };
  return { ok: true };
}
