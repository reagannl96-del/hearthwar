import { describe, expect, it } from 'vitest';
import { THEMED_UNITS, themeOfHero, unitNameAt } from '../src/engine/data/themes';
import { sideInfo } from '../src/engine/commands';
import { UNITS } from '../src/engine/data/units';
import { createWorld, defaultConfig, realmGrowth } from '../src/engine/world';

describe('the realm keeps growing', () => {
  it('new AI rulers arrive over time, with room to breathe, and stop when the map is full', () => {
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 11, config: { ...defaultConfig(), aiCount: 6, size: 80 } });
    const rulers = () => Object.values(w.players).filter((p) => p.kind === 'ai' && !p.eliminated);
    const before = rulers().length;
    // two real days of barbarian ticks
    for (let i = 0; i < 2 * 24 * 60 * 60 / 48; i++) {
      w.now += 48_000;
      realmGrowth(w);
    }
    const after = rulers();
    expect(after.length).toBeGreaterThan(before);
    expect(after.length).toBeLessThanOrEqual(12);
    for (const p of after.slice(before)) {
      expect(p.ai).toBeTruthy();
      expect(p.villages.length).toBe(1);
      // nobody founds a village on top of a human
      const v = w.villages[p.villages[0]];
      const home = w.villages[w.players[w.humanId].villages[0]];
      expect(Math.hypot(v.x - home.x, v.y - home.y)).toBeGreaterThanOrEqual(7);
    }
  });

  it('barbarian villages spring up only where they fit, and only while there are fewer than at the start', () => {
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 12, config: { ...defaultConfig(), aiCount: 0, size: 80 } });
    const barbs = () => Object.values(w.villages).filter((v) => v.ownerId === null);
    // clear some barbarians away
    for (const v of barbs().slice(0, 40)) delete w.villages[v.id];
    const start = barbs().length;
    for (let i = 0; i < 24 * 60 * 60 / 48; i++) {
      w.now += 48_000;
      realmGrowth(w);
    }
    const all = Object.values(w.villages);
    const fresh = barbs().filter((v) => v.grownAt !== undefined && v.grownAt > 0);
    expect(barbs().length).toBeGreaterThan(start);
    for (const v of fresh) {
      expect(all.some((o) => o !== v && Math.abs(o.x - v.x) <= 2 && Math.abs(o.y - v.y) <= 2)).toBe(false);
    }
  });
});

describe('each kind of village fields its own troops', () => {
  it('names follow the statue hero, and every classic unit has a goblin, sorcerer and druid form', () => {
    const units = ['spear', 'sword', 'axe', 'archer', 'scout', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'noble', 'militia'] as const;
    for (const t of ['goblin', 'sorcerer', 'druid'] as const) for (const u of units) expect(THEMED_UNITS[t][u]).toBeTruthy();
    expect(unitNameAt({ heroKind: 'goblin' }, 'marcher')).toBe('Wolf Archer');
    expect(unitNameAt({ heroKind: 'druid' }, 'heavy', true)).toBe('Bear Riders');
    expect(unitNameAt({}, 'light')).toBe(UNITS.light.name);
    expect(themeOfHero('paladin')).toBe('classic');
  });

  it('battle reports remember what kind of army each side fielded', () => {
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 13, config: { ...defaultConfig(), aiCount: 2, size: 60 } });
    const v = w.villages[w.players[w.humanId].villages[0]];
    expect(sideInfo(w, v).theme).toBe('classic');
    // training a hero converts the whole army at once
    v.heroKind = 'sorcerer';
    expect(sideInfo(w, v).theme).toBe('sorcerer');
    expect(unitNameAt(v, 'scout')).toBe('Owl Familiar');
  });
});
