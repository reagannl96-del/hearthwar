// An Orc King player goes through the hero quests and the legendary items
// exactly like any other hero's player.

import { describe, expect, it } from 'vitest';
import { applyAction, gearOf } from '../src/engine/actions';
import { advance, processEvent } from '../src/engine/game';
import { HOUR } from '../src/engine/formulas';
import { HEROES, ITEMS, ITEM_BY_ID, itemHero, itemsFor } from '../src/engine/data/units';
import { THEMED_UNITS, themeOfHero, unitNameAt } from '../src/engine/data/themes';
import { questStatus } from '../src/engine/quests';
import { updateVillage } from '../src/engine/village';
import { createWorld, defaultConfig } from '../src/engine/world';

const DAY = 24 * HOUR;

function orcWorld() {
  const w = createWorld({
    worldName: 'T', playerName: 'P', villageName: 'Home', seed: 7,
    config: { ...defaultConfig(), difficulty: 'peaceful', aiCount: 2, size: 60 },
  });
  const p = w.players[w.humanId];
  const v = w.villages[p.villages[0]];
  Object.assign(v.buildings, { main: 10, barracks: 5, smithy: 5, farm: 20, warehouse: 20, statue: 1, rally: 1 });
  v.res = { wood: 50000, clay: 50000, iron: 50000 };
  p.questsClaimed = ['main10'];
  const act = (a: Parameters<typeof applyAction>[2]) => applyAction(w, p.id, a);
  return { w, p, v, act };
}

describe('items', () => {
  it('every legendary item has its own id', () => {
    const ids = ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    // the paladin's Bloodaxe is still the paladin's
    expect(itemHero(ITEM_BY_ID.bloodaxe)).toBe('paladin');
  });
  it('every hero has a full set of items, and every themed troop an item names exists', () => {
    for (const h of HEROES) expect(itemsFor(h).length).toBeGreaterThanOrEqual(4);
    for (const i of itemsFor('orc')) if (i.unit) expect(THEMED_UNITS.orc[i.unit]).toBeTruthy();
  });
});

describe('an Orc King player', () => {
  it('trains the Orc King at the statue and completes the hero quest', () => {
    const { w, p, v, act } = orcWorld();
    expect(questStatus(w, p).find((q) => q.id === 'paladin')?.done).toBe(false);
    const r = act({ type: 'recruit', vid: v.id, unit: 'orc', count: 1 });
    expect(r.ok).toBe(true);
    expect(v.heroKind).toBe('orc');
    expect(themeOfHero(v.heroKind)).toBe('orc');
    expect(unitNameAt(v, 'axe')).toBe('Berserker');
    expect(unitNameAt(v, 'trader', true)).toBe('Pack Boars');
    // a village sworn to the Orc King raises no other hero
    expect(act({ type: 'recruit', vid: v.id, unit: 'paladin', count: 1 }).ok).toBe(false);
    // training counts toward the quest only once he stands in the village
    advance(w, w.now + DAY);
    updateVillage(w, v, w.now); // troops finish training lazily
    expect(v.units.orc).toBe(1);
    expect(questStatus(w, p).find((q) => q.id === 'paladin')?.done).toBe(true);
    expect(act({ type: 'claimQuest', quest: 'paladin' }).ok).toBe(true);
    expect(questStatus(w, p).some((q) => q.id === 'heroes2')).toBe(true);
  });

  it('finds, equips and puts away the Orc King\'s own items', () => {
    const { w, p, v, act } = orcWorld();
    act({ type: 'recruit', vid: v.id, unit: 'orc', count: 1 });
    advance(w, w.now + DAY);
    const gear = gearOf(p, 'orc')!;
    expect(gear).toBeTruthy();
    // run the item search until he has turned up every one of his items
    for (let k = 0; k < 400 && gear.items.length < itemsFor('orc', w.config.archers).length; k++) processEvent(w, { t: w.now, s: 0, type: 'item', a: p.id });
    expect(gear.items.length).toBe(itemsFor('orc', w.config.archers).length);
    expect(gear.items.every((id) => ITEM_BY_ID[id]?.hero === 'orc')).toBe(true);
    expect(act({ type: 'equip', item: 'gorehewer' }).ok).toBe(true);
    expect(gear.equipped).toBe('gorehewer');
    // the paladin's items are not his to wear
    expect(act({ type: 'equip', item: 'bloodaxe' }).ok).toBe(false);
    expect(act({ type: 'equip', item: null, hero: 'orc' }).ok).toBe(true);
    expect(gear.equipped).toBe(null);
  });
});
