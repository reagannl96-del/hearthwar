import { describe, expect, it } from 'vitest';
import { resolveBattle } from '../src/engine/combat';
import { ITEMS, HEROES, HERO_INFO, UNITS } from '../src/engine/data/units';
import { themeOfHero, THEMED_UNITS } from '../src/engine/data/themes';
import type { Units } from '../src/engine/types';
import { createWorld, defaultConfig } from '../src/engine/world';
import { farmMax } from '../src/engine/village';

const fight = (att: Units, def: Units, wall: number) =>
  resolveBattle({ att, attTech: {}, attItem: null, defStacks: [{ units: def, tech: {} }], defItems: [], wall, luck: 0, morale: 1 });

describe('the Orc King', () => {
  it('is a statue hero with his own village style, troop names and items', () => {
    expect(HEROES).toContain('orc');
    expect(UNITS.orc.building).toBe('statue');
    expect(HERO_INFO.orc.perks.length).toBeGreaterThanOrEqual(3);
    expect(themeOfHero('orc')).toBe('orc');
    expect(THEMED_UNITS.orc?.axe).toBeTruthy();
    expect(ITEMS.filter((i) => i.hero === 'orc').length).toBe(6);
  });

  it('warcry: his rams bring the wall down further', () => {
    const army = { axe: 2000, ram: 60 };
    const plain = fight(army, { spear: 500 }, 20);
    const led = fight({ ...army, orc: 1 }, { spear: 500 }, 20);
    expect(led.wallAfter).toBeLessThan(plain.wallAfter);
    expect(led.effects).toContain('warcry');
  });

  it('bloodlust: his warband loses fewer men in the same fight', () => {
    const att = { axe: 3000 };
    const def = { spear: 1500 };
    const plain = fight(att, def, 0);
    const led = fight({ ...att, orc: 1 }, def, 0);
    expect(plain.winner).toBe('attacker');
    expect(led.attLost.axe ?? 0).toBeLessThan((plain.attLost.axe ?? 0) * 0.9);
  });

  it('the horde: his village feeds more people', () => {
    const w = createWorld({ worldName: 'O', playerName: 'P', villageName: 'Home', seed: 3, config: { ...defaultConfig(), aiCount: 2, size: 60 } });
    const v = w.villages[w.players[w.humanId].villages[0]];
    v.buildings.farm = 20;
    const before = farmMax(v);
    v.heroKind = 'orc';
    expect(farmMax(v)).toBe(Math.round(before * 1.1));
  });
});
