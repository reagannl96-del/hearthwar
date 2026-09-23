// Pure battle math. Used by the engine and by the in-game battle simulator.

import { HEROES, HERO_INFO, HERO_VS_BONUS, UNITS, type ItemDef, type UnitClass } from './data/units';
import { techMultiplier, wallBase, wallMultiplier } from './formulas';
import type { Res, UnitId, Units } from './types';
import { RES_KEYS } from './types';

export interface DefStackInput {
  units: Units;
  tech: Units;
}

export interface CombatInput {
  att: Units;
  attTech: Units;
  attItem: ItemDef | null;
  defStacks: DefStackInput[];
  defItems: ItemDef[];
  wall: number;
  /** -0.25..0.25 */
  luck: number;
  /** 0.3..1 */
  morale: number;
  /** level of the catapult target building before the battle (if catapults present) */
  catTargetLevel?: number;
  catTargetMin?: number;
  catTargetIsWall?: boolean;
}

export interface CombatResult {
  winner: 'attacker' | 'defender';
  attLost: Units;
  defLost: Units[];
  attSurvivors: Units;
  attStrength: number;
  defStrength: number;
  wallAfter: number;
  battleWall: number;
  catLevelsDestroyed: number;
  scoutsSurvived: number;
  scoutsSent: number;
  pureScout: boolean;
}

const CLS_INDEX: Record<UnitClass, 0 | 1 | 2> = { inf: 0, cav: 1, arc: 2 };

function itemFor(items: ItemDef[] | ItemDef | null, u: UnitId): ItemDef | null {
  if (!items) return null;
  if (Array.isArray(items)) return items.find((i) => i.unit === u) ?? null;
  return items.unit === u ? items : null;
}

export function unitAttackValue(u: UnitId, tech: Units, item: ItemDef | null): number {
  const it = itemFor(item, u);
  return UNITS[u].attack * techMultiplier(tech[u]) * (1 + (it?.att ?? 0));
}

export function ramDemolish(power: number, level: number): number {
  let l = level;
  let p = power;
  while (l > 0) {
    const need = 1 + 0.9 * l;
    if (p + 1e-9 >= need) { p -= need; l--; } else break;
  }
  return level - l;
}

export function catDemolish(power: number, level: number, min: number): number {
  let l = level;
  let p = power;
  while (l > min) {
    const need = 2 + 1.2 * l;
    if (p + 1e-9 >= need) { p -= need; l--; } else break;
  }
  return level - l;
}

/** Heroes present on each side of a battle. */
function heroesIn(units: Units[]): UnitId[] {
  return HEROES.filter((h) => units.some((u) => (u[h] ?? 0) > 0));
}

export function resolveBattle(input: CombatInput): CombatResult {
  const { att, attTech, attItem, defStacks, defItems } = input;
  const attHeroes = heroesIn([att]);
  const defHeroes = heroesIn(defStacks.map((s) => s.units));

  // --- scouts fight scouts ---
  const scoutsSent = att.scout ?? 0;
  const defScouts = defStacks.reduce((s, st) => s + (st.units.scout ?? 0), 0);
  const scoutMultA = (attItem?.special === 'scout' ? 2 : 1) * (attHeroes.includes('goblin') ? 2 : 1);
  const scoutMultD = (defItems.some((i) => i.special === 'scout') ? 2 : 1) * (defHeroes.includes('goblin') ? 2 : 1);
  let scoutLost = 0;
  if (scoutsSent > 0) {
    const pa = scoutsSent * scoutMultA;
    const pd = defScouts * scoutMultD;
    if (pa > pd) scoutLost = pd > 0 ? Math.round(scoutsSent * (pd / pa) ** 1.5) : 0;
    else scoutLost = scoutsSent;
  }

  const main: Units = { ...att };
  delete main.scout;
  const pureScout = !Object.values(main).some((n) => (n ?? 0) > 0);

  const attLost: Units = {};
  const defLost: Units[] = defStacks.map(() => ({}));
  if (scoutLost > 0) attLost.scout = scoutLost;

  if (pureScout) {
    const survived = scoutsSent - scoutLost;
    return {
      winner: survived > 0 ? 'attacker' : 'defender',
      attLost,
      defLost,
      attSurvivors: survived > 0 ? { scout: survived } : {},
      attStrength: 0,
      defStrength: 0,
      wallAfter: input.wall,
      battleWall: input.wall,
      catLevelsDestroyed: 0,
      scoutsSurvived: survived,
      scoutsSent,
      pureScout: true,
    };
  }

  // --- main battle ---
  const mod = (1 + input.luck) * input.morale;
  const A = [0, 0, 0];
  for (const k in main) {
    const u = k as UnitId;
    const n = main[u] ?? 0;
    if (n <= 0) continue;
    A[CLS_INDEX[UNITS[u].cls]] += n * unitAttackValue(u, attTech, attItem) * mod;
  }
  // heroes hit harder against the kind of troops they are good against,
  // in proportion to how much of the enemy army is that kind
  const defPop = [0, 0, 0];
  for (const st of defStacks) for (const k in st.units) {
    const u = k as UnitId;
    defPop[CLS_INDEX[UNITS[u].cls]] += (st.units[u] ?? 0) * Math.max(1, UNITS[u].pop);
  }
  const defPopTot = defPop[0] + defPop[1] + defPop[2];
  let attHeroMult = 1;
  for (const h of attHeroes) {
    const vs = HERO_INFO[h]?.vs;
    if (vs && defPopTot > 0) attHeroMult += HERO_VS_BONUS * (defPop[CLS_INDEX[vs]] / defPopTot);
  }
  for (let i = 0; i < 3; i++) A[i] *= attHeroMult;
  const Atot = A[0] + A[1] + A[2];

  // a defending druid snares siege engines
  const siegeMult = defHeroes.includes('druid') ? 0.5 : 1;
  const ramMult = (attItem?.special === 'ramx2' ? 2 : 1) * siegeMult;
  const ramsSent = main.ram ?? 0;
  const ramPowerSent = ramsSent * ramMult * techMultiplier(attTech.ram);
  const battleWall = Math.max(0, input.wall - Math.floor(ramDemolish(ramPowerSent, input.wall) / 2));

  let D = 0;
  if (Atot > 0) {
    const w0 = A[0] / Atot, w1 = A[1] / Atot, w2 = A[2] / Atot;
    for (const st of defStacks) {
      for (const k in st.units) {
        const u = k as UnitId;
        const n = st.units[u] ?? 0;
        if (n <= 0) continue;
        const d = UNITS[u].def;
        const it = itemFor(defItems, u);
        const m = techMultiplier(st.tech[u]) * (1 + (it?.def ?? 0));
        D += n * (d[0] * w0 + d[1] * w1 + d[2] * w2) * m;
      }
    }
  }
  let defHeroMult = 1;
  for (const h of defHeroes) {
    const vs = HERO_INFO[h]?.vs;
    if (vs && Atot > 0) defHeroMult += HERO_VS_BONUS * (A[CLS_INDEX[vs]] / Atot);
  }
  D *= defHeroMult;
  // a defending sorcerer raises an arcane barrier, and warding items add to it
  if (defHeroes.includes('sorcerer')) D *= 1.1;
  if (defItems.some((i) => i.special === 'ward')) D *= 1.1;
  D = D * wallMultiplier(battleWall) + wallBase(battleWall);

  let winner: 'attacker' | 'defender';
  let attRatio: number, defRatio: number;
  if (Atot > D) {
    winner = 'attacker';
    attRatio = D > 0 ? (D / Atot) ** 1.5 : 0;
    defRatio = 1;
  } else {
    winner = 'defender';
    attRatio = 1;
    defRatio = D > 0 ? (Atot / D) ** 1.5 : 0;
  }

  for (const k in main) {
    const u = k as UnitId;
    const n = main[u] ?? 0;
    if (n <= 0) continue;
    const lost = attRatio >= 1 ? n : Math.round(n * attRatio);
    if (lost > 0) attLost[u] = (attLost[u] ?? 0) + lost;
  }
  // scouts die with a lost army
  if (winner === 'defender' && scoutsSent > 0) attLost.scout = scoutsSent;

  defStacks.forEach((st, i) => {
    for (const k in st.units) {
      const u = k as UnitId;
      const n = st.units[u] ?? 0;
      if (n <= 0) continue;
      const lost = defRatio >= 1 ? n : Math.round(n * defRatio);
      if (lost > 0) defLost[i][u] = lost;
    }
  });

  const attSurvivors: Units = {};
  for (const k in att) {
    const u = k as UnitId;
    const s = (att[u] ?? 0) - (attLost[u] ?? 0);
    if (s > 0) attSurvivors[u] = s;
  }

  // --- siege damage ---
  let wallAfter = input.wall;
  const ramFactor = winner === 'attacker' ? 1 : defRatio;
  const ramsLeft = winner === 'attacker' ? attSurvivors.ram ?? 0 : ramsSent;
  if (ramsLeft > 0 && input.wall > 0) {
    wallAfter -= ramDemolish(ramsLeft * ramMult * techMultiplier(attTech.ram) * ramFactor, input.wall);
  }

  let catLevelsDestroyed = 0;
  const catsLeft = winner === 'attacker' ? attSurvivors.catapult ?? 0 : main.catapult ?? 0;
  if (catsLeft > 0 && input.catTargetLevel !== undefined) {
    const catMult = (attItem?.special === 'catx2' ? 2 : 1) * siegeMult;
    const power = catsLeft * catMult * techMultiplier(attTech.catapult) * ramFactor;
    if (input.catTargetIsWall) {
      catLevelsDestroyed = catDemolish(power, wallAfter, 0);
      wallAfter -= catLevelsDestroyed;
    } else {
      catLevelsDestroyed = catDemolish(power, input.catTargetLevel, input.catTargetMin ?? 0);
    }
  }

  return {
    winner,
    attLost,
    defLost,
    attSurvivors,
    attStrength: Atot,
    defStrength: D,
    wallAfter: Math.max(0, wallAfter),
    battleWall,
    catLevelsDestroyed,
    scoutsSurvived: winner === 'attacker' ? scoutsSent - scoutLost : 0,
    scoutsSent,
    pureScout: false,
  };
}

/** Split `capacity` across the available resources as evenly as possible. */
export function computeLoot(available: Res, capacity: number): Res {
  const out: Res = { wood: 0, clay: 0, iron: 0 };
  let cap = Math.max(0, capacity);
  let keys = RES_KEYS.filter((k) => available[k] >= 1);
  while (cap >= 1 && keys.length > 0) {
    const share = cap / keys.length;
    const next: typeof keys = [];
    for (const k of keys) {
      const take = Math.min(share, available[k] - out[k]);
      out[k] += take;
      cap -= take;
      if (available[k] - out[k] >= 1) next.push(k);
    }
    if (next.length === keys.length) break; // every resource took its full share
    keys = next;
  }
  return { wood: Math.floor(out.wood), clay: Math.floor(out.clay), iron: Math.floor(out.iron) };
}
