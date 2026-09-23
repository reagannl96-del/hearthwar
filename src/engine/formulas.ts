// All balance math in one place.

import { BUILDINGS } from './data/buildings';
import { UNITS, TECH_BONUS } from './data/units';
import type { BonusType, BuildingId, Buildings, Res, UnitId, Units } from './types';

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;

export const res = (wood = 0, clay = 0, iron = 0): Res => ({ wood, clay, iron });
export const resSum = (r: Res) => r.wood + r.clay + r.iron;
export const resAdd = (a: Res, b: Res): Res => res(a.wood + b.wood, a.clay + b.clay, a.iron + b.iron);
export const resSub = (a: Res, b: Res): Res => res(a.wood - b.wood, a.clay - b.clay, a.iron - b.iron);
export const resMul = (a: Res, k: number): Res => res(a.wood * k, a.clay * k, a.iron * k);
export const resFloor = (a: Res): Res => res(Math.floor(a.wood), Math.floor(a.clay), Math.floor(a.iron));
export const resGte = (a: Res, b: Res) => a.wood >= b.wood - 1e-6 && a.clay >= b.clay - 1e-6 && a.iron >= b.iron - 1e-6;

// ---------- buildings ----------

export function buildCost(b: BuildingId, level: number): Res {
  const d = BUILDINGS[b];
  const e = level - 1;
  return res(
    Math.round(d.cost.wood * d.factor.wood ** e),
    Math.round(d.cost.clay * d.factor.clay ** e),
    Math.round(d.cost.iron * d.factor.iron ** e),
  );
}

const POP_CACHE: Partial<Record<BuildingId, number[]>> = {};
/** total population used by a building at `level` */
export function buildingPop(b: BuildingId, level: number): number {
  if (level <= 0) return 0;
  let t = POP_CACHE[b];
  if (!t) {
    const d = BUILDINGS[b];
    t = [0];
    for (let l = 1; l <= d.max + 1; l++) t.push(Math.round(d.pop * d.popFactor ** (l - 1)));
    POP_CACHE[b] = t;
  }
  return t[Math.min(level, t.length - 1)];
}

export function buildPopDelta(b: BuildingId, level: number): number {
  return buildingPop(b, level) - buildingPop(b, level - 1);
}

/** Build time in ms for upgrading `b` to `level` with headquarters at `hq`. */
export function buildTime(b: BuildingId, level: number, hq: number, speed: number): number {
  const d = BUILDINGS[b];
  // Early levels finish quickly so the first minutes of a village feel snappy.
  const early = b === 'academy' ? 1 : Math.min(1, 0.3 + 0.07 * level);
  const sec = d.time * d.timeFactor ** (level - 1) * early * 1.05 ** -hq;
  return Math.max(1000, Math.round((sec * SECOND) / speed));
}

const POINTS_CACHE: Partial<Record<BuildingId, number[]>> = {};
export function buildingPoints(b: BuildingId, level: number): number {
  let table = POINTS_CACHE[b];
  if (!table) {
    table = [0];
    const d = BUILDINGS[b];
    let acc = 0;
    for (let l = 1; l <= d.max; l++) {
      acc += d.points * 1.2 ** (l - 1);
      table.push(acc);
    }
    POINTS_CACHE[b] = table;
  }
  return table[Math.max(0, Math.min(level, table.length - 1))];
}

export function villagePoints(bl: Buildings): number {
  let p = 0;
  for (const k in bl) p += buildingPoints(k as BuildingId, bl[k as BuildingId]);
  return Math.max(1, Math.round(p));
}

// ---------- economy ----------

/** resources per hour for a mine level */
export function mineRate(level: number, speed: number): number {
  const base = level <= 0 ? 5 : 30 * 1.163118 ** (level - 1);
  return base * speed;
}

const STORAGE = Array.from({ length: 32 }, (_, l) => Math.round(1000 * 1.2294934 ** (Math.max(1, l) - 1)));
const FARM = Array.from({ length: 32 }, (_, l) => Math.round(240 * 1.172103 ** (Math.max(1, l) - 1)));

export function storageCap(level: number, bonus?: BonusType): number {
  const c = STORAGE[Math.max(0, Math.min(31, level))];
  return bonus === 'storage' ? Math.round(c * 1.5) : c;
}

export function farmCap(level: number, bonus?: BonusType): number {
  const c = FARM[Math.max(0, Math.min(31, level))];
  return bonus === 'farm' ? Math.round(c * 1.1) : c;
}

export function hideCap(level: number): number {
  if (level <= 0) return 0;
  return Math.round(150 * 1.3335 ** (level - 1));
}

export function bonusMultiplier(bonus: BonusType | undefined, k: keyof Res): number {
  if (!bonus) return 1;
  if (bonus === 'all') return 1.3;
  if (bonus === k) return 2;
  return 1;
}

export const MERCHANTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 19, 26, 35, 46, 59, 74, 91, 110, 131, 154, 179, 206, 235, 266];
export function merchantCount(level: number, bonus?: BonusType): number {
  const m = MERCHANTS[Math.max(0, Math.min(level, 25))];
  return bonus === 'storage' ? Math.round(m * 1.5) : m;
}

export function wallMultiplier(level: number): number {
  return 1.037 ** level;
}
export function wallBase(level: number): number {
  return level > 0 ? 20 + 50 * level : 0;
}

/** watchtower detection radius in fields */
export function watchtowerRange(level: number): number {
  if (level <= 0) return 0;
  return Math.round((1.1 * 1.305 ** (level - 1)) * 10) / 10;
}

// ---------- units ----------

export function recruitTime(u: UnitId, buildingLevel: number, speed: number, bonus?: BonusType): number {
  const d = UNITS[u];
  let sec = d.time * (2 / 3) * 1.06 ** -buildingLevel;
  if (bonus === 'recruit' && (d.building === 'barracks' || d.building === 'stable')) sec /= 1.33;
  return Math.max(250, Math.round((sec * SECOND) / speed));
}

export function researchCost(u: UnitId, level: number): Res {
  const d = UNITS[u];
  const mult = [0, 10, 25, 55][level] ?? 55;
  return res(
    Math.max(200, Math.round(d.cost.wood * mult)),
    Math.max(200, Math.round(d.cost.clay * mult)),
    Math.max(200, Math.round(d.cost.iron * mult)),
  );
}

export function researchSmithyReq(u: UnitId, level: number): number {
  const base = UNITS[u].smithy;
  if (level <= 1) return base;
  return Math.min(20, base + (level === 2 ? 5 : 10));
}

export function researchTime(u: UnitId, level: number, smithy: number, speed: number): number {
  const d = UNITS[u];
  const sec = d.time * [0, 3, 5, 8][level] * 1.05 ** -smithy;
  return Math.max(1000, Math.round((sec * SECOND) / speed));
}

export function techMultiplier(level: number | undefined): number {
  return 1 + (TECH_BONUS[level ?? 0] ?? 0);
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** ms per field for the slowest unit in the group */
export function armyMsPerField(units: Units, unitSpeed: number, speedBonus = 0): number {
  let slowest = 0;
  for (const k in units) {
    const n = units[k as UnitId] ?? 0;
    if (n > 0) slowest = Math.max(slowest, UNITS[k as UnitId].speed);
  }
  if (slowest === 0) slowest = 18;
  return (slowest * MINUTE) / unitSpeed / (1 + speedBonus);
}

export function unitsPop(units: Units): number {
  let p = 0;
  for (const k in units) p += (units[k as UnitId] ?? 0) * UNITS[k as UnitId].pop;
  return p;
}

export function unitsCount(units: Units): number {
  let c = 0;
  for (const k in units) c += units[k as UnitId] ?? 0;
  return c;
}

export function unitsCarry(units: Units): number {
  let c = 0;
  for (const k in units) c += (units[k as UnitId] ?? 0) * UNITS[k as UnitId].carry;
  return c;
}

export function addUnits(into: Units, add: Units, mult = 1): Units {
  for (const k in add) {
    const key = k as UnitId;
    const v = (into[key] ?? 0) + (add[key] ?? 0) * mult;
    if (v > 0) into[key] = v; else delete into[key];
  }
  return into;
}

export function cloneUnits(u: Units): Units {
  const o: Units = {};
  for (const k in u) if ((u[k as UnitId] ?? 0) > 0) o[k as UnitId] = u[k as UnitId];
  return o;
}

export function hasUnits(u: Units): boolean {
  for (const k in u) if ((u[k as UnitId] ?? 0) > 0) return true;
  return false;
}

// ---------- nobles ----------

export const COIN_COST = res(28000, 30000, 25000);

/** total nobles (incl. already-conquered villages) the coin count supports */
export function noblesFromCoins(coins: number): number {
  return Math.floor((Math.sqrt(8 * coins + 1) - 1) / 2);
}

export function coinsForNoble(n: number): number {
  return (n * (n + 1)) / 2;
}

export function moraleFor(defPoints: number, attPoints: number): number {
  if (attPoints <= 0) return 1;
  return Math.max(0.3, Math.min(1, 0.3 + (3 * defPoints) / attPoints));
}

// ---------- scavenging ----------

export const SCAVENGE_TIERS = [
  { name: 'Lazy Looters', ratio: 0.1, cost: res(25, 30, 25) },
  { name: 'Humble Haulers', ratio: 0.25, cost: res(250, 300, 250) },
  { name: 'Clever Collectors', ratio: 0.5, cost: res(1000, 1200, 1000) },
  { name: 'Great Gatherers', ratio: 0.75, cost: res(10000, 12000, 10000) },
];

export function scavengeDuration(carry: number, tier: number, speed: number): number {
  const loot = carry * SCAVENGE_TIERS[tier].ratio;
  const sec = ((loot * loot * 100) ** 0.45 + 1800) * 1;
  return Math.max(5000, Math.round((sec * SECOND) / speed ** 0.7));
}

export function scavengeLoot(carry: number, tier: number): number {
  return Math.floor(carry * SCAVENGE_TIERS[tier].ratio);
}

export function fmtDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
