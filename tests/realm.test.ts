import { describe, expect, it } from 'vitest';
import { THEMED_UNITS, themeOfHero, unitNameAt } from '../src/engine/data/themes';
import { sideInfo } from '../src/engine/commands';
import { UNITS } from '../src/engine/data/units';
import { buildable, createWorld, defaultConfig, inRealm, isVolcanic, migrateWorld, realmGrowth, terrainAt } from '../src/engine/world';

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

describe('the round realm', () => {
  it('new realms are a round island with a volcanic west, and every village stands on open ground', () => {
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 21, config: { ...defaultConfig(), aiCount: 10, size: 120 } });
    for (const v of Object.values(w.villages)) {
      expect(inRealm(v.x, v.y, 120)).toBe(true);
      expect(buildable(terrainAt(w, v.x, v.y))).toBe(true);
    }
    expect(terrainAt(w, 1, 1)).toBe('w');
    expect(Object.values(w.villages).some((v) => isVolcanic(v.x, v.y, 120))).toBe(true);
  });

  it('an older square world grows into the big round one, keeping every village and filling the new land', () => {
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 22, config: { ...defaultConfig(), aiCount: 6, size: 60 } });
    w.round = undefined;
    const home = w.villages[w.players[w.humanId].villages[0]];
    const [hx, hy] = [home.x, home.y];
    const oldTerrain = w.terrain;
    const before = Object.keys(w.villages).length;
    const ais = Object.values(w.players).filter((p) => p.kind === 'ai').length;
    migrateWorld(w);
    expect(w.config.size).toBe(180);
    expect(w.terrain.length).toBe(180 * 180);
    expect(home.x - hx).toBe(60);
    expect(home.y - hy).toBe(60);
    for (const v of Object.values(w.villages)) {
      expect(inRealm(v.x, v.y, 180)).toBe(true);
      expect(buildable(terrainAt(w, v.x, v.y))).toBe(true);
    }
    // the old landscape is still there in the middle (apart from the new volcanic west and the shore)
    let same = 0, n = 0;
    for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) {
      const was = oldTerrain[y * 60 + x];
      if (!'.fm'.includes(was) || isVolcanic(x, y, 60) || isVolcanic(x + 60, y + 60, 180)) continue;
      n++;
      if (w.terrain[(y + 60) * 180 + x + 60] === was || Object.values(w.villages).some((v) => v.x === x + 60 && v.y === y + 60)) same++;
    }
    expect(n).toBeGreaterThan(1000);
    expect(same / n).toBeGreaterThan(0.99);
    expect(Object.keys(w.villages).length).toBeGreaterThan(before * 3);
    expect(Object.values(w.players).filter((p) => p.kind === 'ai').length).toBeGreaterThan(ais * 3);
    // loading it again changes nothing
    const count = Object.keys(w.villages).length;
    migrateWorld(w);
    expect(Object.keys(w.villages).length).toBe(count);
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
