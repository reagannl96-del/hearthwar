// The battle, as a script to act out. Everything here is plain data (no three.js),
// worked out from what the defender really knows: the incoming army's direction
// and, in its last stretch, the kinds of troops in it; then, once it has landed,
// the full battle report. The scene is a replay of that report, so the figures
// that fall, the wall levels the rams knock down and the building the catapults
// set on fire all match what actually happened.

import type { BattleData, BuildingId, UnitId, Units } from '../../../engine/types';

export type Side = 'att' | 'def';

/** How a unit fights on screen. */
export type Role = 'melee' | 'shooter' | 'thrower' | 'caster' | 'ram' | 'catapult' | 'noble' | 'scout';

export const HEROES: UnitId[] = ['paladin', 'sorcerer', 'druid', 'goblin', 'necromancer'];

export function roleOf(u: UnitId): Role {
  switch (u) {
    case 'archer': case 'marcher': return 'shooter';
    case 'spear': return 'thrower';
    case 'sorcerer': case 'necromancer': return 'caster';
    case 'ram': return 'ram';
    case 'catapult': return 'catapult';
    case 'noble': return 'noble';
    case 'scout': return 'scout';
    default: return 'melee';
  }
}

export const isMounted = (u: UnitId) => u === 'light' || u === 'marcher' || u === 'heavy' || u === 'paladin';

/**
 * How many figures stand for this many troops: you never see a thousand
 * axemen, just enough of them to read as a big company (1, 3, 6, 9...).
 */
export function figuresFor(u: UnitId, n: number): number {
  if (n <= 0) return 0;
  if (HEROES.includes(u)) return 1;
  if (u === 'noble') return Math.min(n, 4);
  if (u === 'ram' || u === 'catapult') return Math.min(n, n <= 5 ? 1 : n <= 60 ? 2 : 3);
  if (u === 'scout') return Math.min(n, n < 10 ? 1 : n < 100 ? 2 : 3);
  return Math.min(n, Math.max(1, Math.round(Math.log2(n + 1) * 0.95)));
}

/** Front to back, the order an army marches in: horsemen, foot, archers, siege, then the nobles with the banner. */
const MARCH_ORDER: UnitId[] = ['light', 'heavy', 'paladin', 'marcher', 'axe', 'sword', 'spear', 'militia', 'goblin', 'druid', 'archer', 'sorcerer', 'necromancer', 'scout', 'ram', 'catapult', 'noble'];

/**
 * The figures to put on screen for an army, capped at `cap` in all (every kind
 * present keeps at least one). Sorted in marching order.
 */
export function representatives(units: Units, cap = 30): [UnitId, number][] {
  const want = (Object.keys(units) as UnitId[])
    .filter((u) => (units[u] ?? 0) > 0)
    .map((u) => [u, figuresFor(u, units[u] ?? 0)] as [UnitId, number]);
  let total = want.reduce((s, [, n]) => s + n, 0);
  // trim the biggest companies first until it fits
  while (total > cap) {
    want.sort((a, b) => b[1] - a[1]);
    if (want[0][1] <= 1) break;
    want[0][1]--;
    total--;
  }
  return want.sort((a, b) => MARCH_ORDER.indexOf(a[0]) - MARCH_ORDER.indexOf(b[0]));
}

/** An army only glimpsed (kinds, no numbers): a few of each. */
export function glimpsed(kinds: UnitId[]): Units {
  const u: Units = {};
  for (const k of kinds) u[k] = HEROES.includes(k) || k === 'noble' || k === 'ram' || k === 'catapult' || k === 'scout' ? 1 : 12;
  return u;
}

/**
 * Where an attack comes from, as an angle in the village scene (x east, z south;
 * the map's y grows southward too). A village attacked from its own spot comes
 * in by the gate.
 */
export function bearingOf(fromX: number, fromY: number, toX: number, toY: number): number {
  const dx = fromX - toX, dz = fromY - toY;
  if (dx === 0 && dz === 0) return Math.PI / 2;
  return Math.atan2(dz, dx);
}

/**
 * The march in: an army comes into sight (the last fifth of its march), walks up
 * to a staging line out of bowshot, holds there, and charges for the last few
 * seconds. Distances are from the village centre; times in game ms.
 */
export const APPROACH = { edge: 104, stage: 61, contact: 49, emergeS: 16, chargeS: 9 };

export interface ApproachPos { r: number; phase: 'emerge' | 'hold' | 'charge' | 'arrived'; k: number }

export function approachAt(now: number, depart: number, arrive: number, rate: number): ApproachPos | null {
  const span = (arrive - depart) * 0.2;
  const start = arrive - span;
  if (now < start) return null;
  const left = arrive - now;
  if (left <= 0) return { r: APPROACH.contact, phase: 'arrived', k: 1 };
  const rr = Math.max(rate, 0.05);
  let emerge = APPROACH.emergeS * 1000 * rr, charge = APPROACH.chargeS * 1000 * rr;
  if (emerge + charge > span) { const f = span / (emerge + charge); emerge *= f; charge *= f; }
  const since = now - start;
  if (since < emerge) {
    const k = since / emerge;
    return { r: APPROACH.edge + (APPROACH.stage - APPROACH.edge) * k, phase: 'emerge', k };
  }
  if (left > charge) return { r: APPROACH.stage, phase: 'hold', k: 0 };
  const k = 1 - left / charge;
  return { r: APPROACH.stage + (APPROACH.contact - APPROACH.stage) * (k * k * 0.4 + k * 0.6), phase: 'charge', k };
}

// ---------- the battle itself ----------

export interface BattlePlan {
  winner: Side;
  scoutOnly: boolean;
  /** the wall, and the level shown after each ram blow (null: the blow did nothing) */
  wall: { before: number; after: number } | null;
  ramHits: { t: number; level: number | null }[];
  /** catapult shots: when fired, when they land, what they hit and the level it drops to */
  catShots: { fire: number; land: number; target: BuildingId; level: number | null }[];
  /** the catapults' target building (other than the wall) */
  building: { id: BuildingId; before: number; after: number } | null;
  /** the fight: ranged exchange, then hand to hand */
  volleyEnd: number;
  meleeStart: number;
  meleeEnd: number;
  /** the winners act (loot and leave, or cheer), and the scene winds down */
  outcomeAt: number;
  end: number;
  /** what share of each kind falls, per side */
  fall: Record<Side, Partial<Record<UnitId, number>>>;
  loot: number;
  nobles: number;
  loyalty: { before: number; after: number } | null;
  conquered: boolean;
  healed: { side: Side; n: number } | null;
  risen: { side: Side; n: number } | null;
  effects: string[];
}

const total = (u: Units | undefined) => Object.values(u ?? {}).reduce((s, n) => s + (n ?? 0), 0);

function fractions(units: Units | undefined, lost: Units | undefined): Partial<Record<UnitId, number>> {
  const out: Partial<Record<UnitId, number>> = {};
  for (const k of Object.keys(units ?? {}) as UnitId[]) {
    const n = units![k] ?? 0;
    if (n > 0) out[k] = Math.min(1, (lost?.[k] ?? 0) / n);
  }
  return out;
}

/** Share out `drop` levels over `hits` blows, as evenly as can be, the first blows doing the work. */
function steps(before: number, drop: number, hits: number): (number | null)[] {
  const out: (number | null)[] = [];
  let shown = before;
  for (let i = 0; i < hits; i++) {
    const want = before - Math.round((drop * (i + 1)) / hits);
    out.push(want < shown ? want : null);
    shown = Math.min(shown, want);
  }
  return out;
}

export function planBattle(b: BattleData): BattlePlan {
  const winner: Side = b.winner === 'attacker' ? 'att' : 'def';
  const att = b.attUnits ?? {};
  const scoutOnly = total(att) > 0 && total(att) === (att.scout ?? 0);
  const fall = { att: fractions(att, b.attLost), def: fractions(b.defUnits, b.defLost) };
  const common = {
    winner, fall, effects: b.effects ?? [],
    loot: b.loot ? b.loot.wood + b.loot.clay + b.loot.iron : 0,
    loyalty: b.loyalty ?? null, conquered: !!b.conquered,
    healed: b.healed ? { side: (b.healed.side === 'attacker' ? 'att' : 'def') as Side, n: b.healed.n } : null,
    risen: b.risen ? { side: (b.risen.side === 'attacker' ? 'att' : 'def') as Side, n: b.risen.n } : null,
    nobles: Math.max(0, (att.noble ?? 0) - (b.attLost?.noble ?? 0)),
  };
  if (scoutOnly) {
    return {
      ...common, scoutOnly, wall: null, ramHits: [], catShots: [], building: null,
      volleyEnd: 0, meleeStart: 2.4, meleeEnd: 5.2, outcomeAt: 5.6, end: 11,
    };
  }
  const rams = (att.ram ?? 0) > 0;
  const cats = (att.catapult ?? 0) > 0;
  const wall = b.wall && b.wall.before > 0 ? { ...b.wall } : null;
  const building = b.building && b.building.id !== 'wall' ? { ...b.building } : null;
  const wallDrop = wall ? Math.max(0, wall.before - wall.after) : 0;
  // catapults that were not given another target were aimed at the wall: they share its damage with the rams
  const catOnWall = cats && !building;
  const ramDrop = !rams ? 0 : catOnWall ? Math.ceil(wallDrop / 2) : wallDrop;
  const catWallDrop = wallDrop - ramDrop;

  // the rams roll up to the wall and start swinging once they are there
  const ramHits: BattlePlan['ramHits'] = [];
  if (rams && wall) {
    const hits = Math.max(3, Math.min(8, ramDrop + 2));
    for (let i = 0; i < hits; i++) ramHits.push({ t: 2.2 + i * 0.95, level: null });
  }
  const catShots: BattlePlan['catShots'] = [];
  if (cats) {
    const target: BuildingId = building?.id ?? 'wall';
    const drop = building ? Math.max(0, building.before - building.after) : catWallDrop;
    const shots = Math.max(2, Math.min(6, Math.ceil(drop * 0.7) + 1));
    for (let i = 0; i < shots; i++) catShots.push({ fire: 1.1 + i * 1.6, land: 1.1 + i * 1.6 + 1.7, target, level: null });
    if (building) steps(building.before, drop, shots).forEach((level, i) => { catShots[i].level = level; });
  }
  // the wall comes down blow by blow, in the order the blows land, whoever strikes them (so it never goes back up)
  if (wall) {
    const blows: { t: number; set: (l: number | null) => void }[] = [
      ...ramHits.map((h) => ({ t: h.t, set: (l: number | null) => { h.level = l; } })),
      ...(catOnWall ? catShots.map((c) => ({ t: c.land, set: (l: number | null) => { c.level = l; } })) : []),
    ].sort((a, b) => a.t - b.t);
    steps(wall.before, wallDrop, blows.length).forEach((level, i) => blows[i].set(level));
  }
  // the wall is breached (or there is none) and it comes to blows
  const lastRam = ramHits.length ? ramHits[ramHits.length - 1].t : 0;
  const meleeStart = Math.max(3.4, lastRam + 0.5);
  const big = total(att) + total(b.defUnits) > 400;
  const meleeEnd = meleeStart + (big ? 6.5 : 5.2);
  const lastCat = catShots.length ? catShots[catShots.length - 1].land : 0;
  const outcomeAt = Math.max(meleeEnd + 0.4, lastCat + 0.3);
  return {
    ...common, scoutOnly, wall, ramHits, catShots, building,
    volleyEnd: meleeStart, meleeStart, meleeEnd, outcomeAt, end: outcomeAt + 8,
  };
}

/**
 * When each figure of a side falls: the share of each kind that dies in the
 * report, the first ones to the arrows before the lines meet, the rest in the
 * melee. `ids` are the figures of one kind; returns a fall time (s) or null.
 */
export function fallTimes(n: number, share: number, role: Role, plan: BattlePlan, side: Side, seed: number): (number | null)[] {
  const out: (number | null)[] = new Array(n).fill(null);
  const dead = plan.winner === side ? Math.round(n * share) : n;
  let s = seed | 0;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < Math.min(n, dead); i++) {
    // siege engines and those up front fall late; a few go down to the opening volleys
    const early = role !== 'ram' && role !== 'catapult' && role !== 'noble' && rnd() < 0.3;
    const t = plan.scoutOnly
      ? plan.meleeStart + rnd() * (plan.meleeEnd - plan.meleeStart)
      : early
        ? 1.2 + rnd() * Math.max(0.5, plan.meleeStart - 1.6)
        : plan.meleeStart + 0.4 + rnd() * (plan.meleeEnd - plan.meleeStart - 0.4);
    out[i] = t;
  }
  // the very last of a losing side fall as the fight ends
  if (plan.winner !== side && n > 0 && !out.some((t) => t !== null && t > plan.meleeEnd - 1)) out[n - 1] = plan.meleeEnd - 0.2;
  return out;
}

/** Villagers hauling the stores into the hiding place: how many trips' worth, 0 without one. */
export function hidingCrew(hideLevel: number, hideCap: number, res: { wood: number; clay: number; iron: number }): number {
  if (hideLevel <= 0 || hideCap <= 0) return 0;
  const moved = Math.min(res.wood, hideCap) + Math.min(res.clay, hideCap) + Math.min(res.iron, hideCap);
  return moved <= 0 ? 0 : Math.min(4, 1 + Math.floor(Math.log10(moved + 1)));
}
