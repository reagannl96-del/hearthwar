// Hero balance bench: how much does each statue hero really add to a fight?
//
//   npx vite build --ssr scripts/herobench.ts --outDir .bench --emptyOutDir && node .bench/herobench.js
//
// Every hero fights in the same battles, attacking and defending against typical
// Tribal Wars armies (an axe/light-cavalry nuke, a spear/sword/archer wall, a mixed
// force, and a scout-and-loot raid). For each one we report the swing it causes,
// in resources: enemy troops destroyed plus own troops saved, next to the same
// battle fought with no hero. Economic abilities (loot, the dead rising, healing)
// are added at their resource worth, so the heroes can be compared on one scale.

import { resolveBattle } from '../src/engine/combat';
import { HEROES, HERO_POWERS, UNITS } from '../src/engine/data/units';
import { unitsCarry } from '../src/engine/formulas';
import type { UnitId, Units } from '../src/engine/types';

const worth = (u: Units) => Object.entries(u).reduce((s, [k, n]) => {
  const d = UNITS[k as UnitId];
  return s + (n ?? 0) * (d.cost.wood + d.cost.clay + d.cost.iron);
}, 0);

const ARMIES: Record<string, Units> = {
  'axe nuke': { axe: 3000, light: 1200, ram: 150 },
  'mixed force': { axe: 1200, spear: 800, light: 500, archer: 300 },
  'defensive wall': { spear: 3000, sword: 2500, archer: 800, heavy: 150 },
  'cav raid': { light: 800, heavy: 300, marcher: 200 },
};

/** A fight where one side's hero is `hero` (or none); returns the resource swing for that side. */
function swing(hero: UnitId | null, side: 'att' | 'def', att: Units, def: Units, wall: number): number {
  const a: Units = { ...att };
  const d: Units = { ...def };
  if (hero && side === 'att') a[hero] = 1;
  if (hero && side === 'def') d[hero] = 1;
  const r = resolveBattle({ att: a, attTech: {}, attItem: null, defStacks: [{ units: d, tech: {} }], defItems: [], wall, luck: 0, morale: 1 });
  const attLost = worth(r.attLost), defLost = worth(r.defLost[0] ?? {});
  let s = side === 'att' ? defLost - attLost : attLost - defLost;
  // abilities worth resources
  const won = (side === 'att') === (r.winner === 'attacker');
  // the plunder bonus, on a haul worth up to 20k (a strong village's storage)
  if (hero === 'goblin' && side === 'att' && won) s += HERO_POWERS.plunder * Math.min(20000, unitsCarry(r.attSurvivors));
  if (hero === 'necromancer' && won) {
    const fallen = side === 'att' ? r.defLost[0] ?? {} : r.attLost;
    const foot = (['spear', 'sword', 'axe', 'archer'] as UnitId[]).reduce((n, k) => n + (fallen[k] ?? 0), 0);
    s += Math.floor(foot * HERO_POWERS.raise) * worth({ spear: 1 });
  }
  if (hero === 'paladin' && ((side === 'att' && (r.attSurvivors.paladin ?? 0) > 0) || (side === 'def' && r.winner === 'defender'))) {
    const own = side === 'att' ? r.attLost : r.defLost[0] ?? {};
    s += worth(own) * HERO_POWERS.layOnHands;
  }
  return s;
}

const pad = (x: string | number, n: number) => String(x).padStart(n);
console.log(`Resource swing per battle, relative to the same battle with no hero (thousands)\n`);
const heroes: (UnitId | null)[] = [...HEROES];
const header = ['situation'.padEnd(34), ...heroes.map((h) => pad(h ? UNITS[h].name.slice(0, 11) : '-', 12))].join('');
console.log(header);
const totals = new Map<UnitId | null, number>();
for (const side of ['att', 'def'] as const) {
  for (const [an, av] of Object.entries(ARMIES)) {
    for (const [dn, dv] of Object.entries(ARMIES)) {
      if (an === dn) continue;
      // scale armies so the fight is close (a hero only matters in a close fight)
      const wall = 10;
      const base = swing(null, side, av, dv, wall);
      const row = heroes.map((h) => {
        const v = swing(h, side, av, dv, wall) - base;
        totals.set(h, (totals.get(h) ?? 0) + v);
        return pad((v / 1000).toFixed(1), 12);
      });
      console.log([`${side === 'att' ? 'attacking' : 'defending'}: ${an} vs ${dn}`.padEnd(34), ...row].join(''));
    }
  }
}
console.log('\n' + ['TOTAL'.padEnd(34), ...heroes.map((h) => pad(((totals.get(h) ?? 0) / 1000).toFixed(0), 12))].join(''));
