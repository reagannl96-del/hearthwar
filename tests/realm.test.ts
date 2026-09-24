import { describe, expect, it } from 'vitest';
import { THEMED_UNITS, themeOfHero, unitNameAt } from '../src/engine/data/themes';
import { sideInfo } from '../src/engine/commands';
import { UNITS } from '../src/engine/data/units';
import { applyAction } from '../src/engine/actions';
import { advance } from '../src/engine/game';
import { pushEvent } from '../src/engine/events';
import { buildable, createWorld, defaultConfig, inRealm, isVolcanic, migrateWorld, realmGrowth, terrainAt } from '../src/engine/world';

describe('the realm keeps growing', () => {
  it('new AI rulers arrive over time, with room to breathe, and stop when the map is full', () => {
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 11, config: { ...defaultConfig(), aiCount: 6, size: 80 } });
    const rulers = () => Object.values(w.players).filter((p) => p.kind === 'ai' && !p.eliminated);
    const before = rulers().length;
    // a week of barbarian ticks: newcomers trickle in, a couple a day at most
    for (let i = 0; i < 7 * 24 * 60 * 60 / 48; i++) {
      w.now += 48_000;
      realmGrowth(w);
    }
    const after = rulers();
    expect(after.length).toBeGreaterThan(before);
    expect(after.length).toBeLessThanOrEqual(8);
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
    // three days: a few new barbarian villages a day, no flood
    for (let i = 0; i < 3 * 24 * 60 * 60 / 48; i++) {
      w.now += 48_000;
      realmGrowth(w);
    }
    const all = Object.values(w.villages);
    const fresh = barbs().filter((v) => v.grownAt !== undefined && v.grownAt > 0);
    expect(barbs().length).toBeGreaterThan(start);
    expect(barbs().length - start).toBeLessThanOrEqual(20);
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
    expect(themeOfHero('paladin')).toBe('paladin');
    expect(themeOfHero(undefined)).toBe('classic');
    expect(unitNameAt({ heroKind: 'paladin' }, 'heavy', true)).toBe('Knights');
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

describe('the necromancer', () => {
  it('raises one in ten fallen enemy foot soldiers as skeleton spearmen for his side', () => {
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 31, config: { ...defaultConfig(), difficulty: 'peaceful', aiCount: 2, size: 60 } });
    const p = w.players[w.humanId];
    const v = w.villages[p.villages[0]];
    Object.assign(v.buildings, { main: 20, barracks: 10, farm: 30, rally: 1, statue: 1 });
    v.units = { axe: 600, necromancer: 1 };
    v.heroKind = 'necromancer';
    const target = Object.values(w.villages).filter((b) => b.ownerId === null).sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
    target.units = { spear: 200, sword: 50 };
    target.buildings.wall = 0;
    expect(applyAction(w, p.id, { type: 'send', vid: v.id, target: target.id, kind: 'attack', units: { axe: 600, necromancer: 1 } }).ok).toBe(true);
    const out = Object.values(w.commands).find((c) => c.ownerId === p.id)!;
    advance(w, out.arrive + 1);
    const back = Object.values(w.commands).find((c) => c.ownerId === p.id && c.kind === 'return')!;
    expect(back.units.spear).toBe(25);
    const rep = p.reports.find((r) => r.battle?.risen);
    expect(rep?.battle?.risen).toEqual({ side: 'attacker', n: 25 });
    expect(unitNameAt(v, 'spear', true)).toBe('Skeleton Spearmen');
  });
});

describe('a round of the realm', () => {
  it('runs two weeks, ranks tribes by their share of ruled villages, then freezes on the final standings', async () => {
    const { standings, DOMINATION } = await import('../src/engine/round');
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 41, config: { ...defaultConfig(), difficulty: 'peaceful', aiCount: 10, size: 90, roundDays: 14 } });
    expect(w.endsAt).toBe(14 * 86_400_000);
    const s = standings(w);
    const ruled = Object.values(w.villages).filter((v) => v.ownerId !== null).length;
    expect(s.ruled).toBe(ruled);
    expect(s.barbarians).toBe(Object.keys(w.villages).length - ruled);
    const total = s.tribes.reduce((n, t) => n + t.share, 0) + s.tribeless.share;
    expect(total).toBeCloseTo(1, 5);
    // hand one tribe most of the realm: it is dominating
    const t = Object.values(w.tribes)[0];
    for (const v of Object.values(w.villages)) if (v.ownerId !== null) v.ownerId = t.members[0];
    w.players[t.members[0]].villages = Object.values(w.villages).filter((v) => v.ownerId === t.members[0]).map((v) => v.id);
    expect(standings(w).tribes[0].share).toBeGreaterThanOrEqual(DOMINATION);
    // time runs out (jump straight to the end instead of playing out two weeks)
    w.events = [];
    w.now = w.endsAt! - 1;
    pushEvent(w, 'end', w.endsAt!, 0);
    advance(w, w.endsAt! + 1);
    expect(w.finished?.winner?.tag).toBe(t.tag);
    expect(w.finished?.winner?.domination).toBe(true);
    const p = w.players[w.humanId];
    expect(applyAction(w, p.id, { type: 'build', vid: p.villages[0] ?? 0, building: 'main' }).ok).toBe(false);
    expect(applyAction(w, p.id, { type: 'note', vid: 0, text: 'gg' } as never).error ?? '').not.toMatch(/round is over/);
  });

  it('older worlds get an end date the first time they load', () => {
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 42, config: { ...defaultConfig(), aiCount: 2, size: 60 } });
    w.endsAt = undefined;
    w.accounts = {}; // an online realm
    w.now = 5 * 86_400_000;
    migrateWorld(w);
    expect(w.endsAt).toBe(19 * 86_400_000);
  });
});

describe('heroes, rebalanced', () => {
  it("the sorcerer's arcane barrier and warding items make every defender fight harder", async () => {
    const { resolveBattle } = await import('../src/engine/combat');
    const { ITEM_BY_ID } = await import('../src/engine/data/units');
    const fight = (def: Record<string, number>, items: string[] = []) => resolveBattle({
      att: { axe: 400 }, attTech: {}, attItem: null, defStacks: [{ units: def, tech: {} }],
      defItems: items.map((i) => ITEM_BY_ID[i]), wall: 0, luck: 0, morale: 1,
    }).defStrength;
    const plain = fight({ spear: 100 });
    const barrier = fight({ spear: 100, sorcerer: 1 });
    expect(barrier).toBeGreaterThan((plain + 200) * 1.09);
    // a warding item helps a little (items never swing a fight by 10% or more)
    const warded = fight({ spear: 100, sorcerer: 1 }, ['wardstaff']);
    expect(warded).toBeGreaterThan(barrier * 1.04);
    expect(warded).toBeLessThan(barrier * 1.1);
  });

  it('every legendary item stays under a 10% swing, even where the engine amplifies it', async () => {
    const { ITEMS, ITEM_POWERS } = await import('../src/engine/data/units');
    const { ramDemolish, catDemolish } = await import('../src/engine/combat');
    for (const i of ITEMS) {
      expect(i.att ?? 0).toBeLessThan(0.1);
      expect(i.def ?? 0).toBeLessThan(0.1);
    }
    for (const k of ['troop', 'assault', 'assaultDef', 'speed', 'loot', 'ward', 'raise'] as const) expect(ITEM_POWERS[k]).toBeLessThan(0.1);
    // scout losses scale with strength^1.5
    expect((1 + ITEM_POWERS.scout) ** 1.5).toBeLessThan(1.1);
    // a nobleman's drop is 20-35: even on the lowest roll the item adds under 10%
    expect(ITEM_POWERS.loyalty / 20).toBeLessThan(0.1);
    // low wall and building levels are cheaper, so extra siege power knocks down a little more than it adds
    for (const lvl of [10, 20]) {
      let base = 0, boosted = 0, baseC = 0, boostedC = 0;
      for (let p = 1; p <= 300; p++) {
        base += ramDemolish(p, lvl); boosted += ramDemolish(p * (1 + ITEM_POWERS.siege), lvl);
        baseC += catDemolish(p, lvl, 0); boostedC += catDemolish(p * (1 + ITEM_POWERS.siege), lvl, 0);
      }
      expect(boosted / base).toBeLessThan(1.1);
      expect(boostedC / baseC).toBeLessThan(1.1);
    }
  });

  it('support marching with a druid arrives a quarter sooner', async () => {
    const { travelTime } = await import('../src/engine/commands');
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 51, config: { ...defaultConfig(), aiCount: 2, size: 60 } });
    const vs = Object.values(w.villages);
    const [a, b] = [vs[0], vs[vs.length - 1]];
    const units = { spear: 10, druid: 1 };
    expect(travelTime(w, a, b, units, w.humanId, true)).toBeCloseTo(travelTime(w, a, b, units, w.humanId) * 0.75, -2);
    expect(travelTime(w, a, b, { spear: 10 }, w.humanId, true)).toBe(travelTime(w, a, b, { spear: 10 }, w.humanId));
  });

  it('every hero finds its own themed legendary items, and they are equipped per hero', () => {
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 52, config: { ...defaultConfig(), difficulty: 'peaceful', aiCount: 2, size: 60 } });
    const p = w.players[w.humanId];
    const v = w.villages[p.villages[0]];
    Object.assign(v.buildings, { statue: 1 });
    v.res = { wood: 9999, clay: 9999, iron: 9999 };
    expect(applyAction(w, p.id, { type: 'recruit', vid: v.id, unit: 'goblin', count: 1 }).ok).toBe(true);
    // enough searches that some of them turn something up
    for (let i = 0; i < 40 && (p.heroGear?.goblin?.items.length ?? 0) < 4; i++) {
      w.events = w.events.filter((e) => e.type !== 'item');
      pushEvent(w, 'item', w.now + 1, p.id);
      advance(w, w.now + 2);
    }
    const gear = p.heroGear?.goblin;
    expect(gear?.items.length).toBe(4);
    expect(gear?.items.every((id) => ['grabsack', 'rustycleaver', 'wolffang', 'sneakglass', 'bossbonnet', 'boomlog'].includes(id))).toBe(true);
    expect(p.paladin).toBeNull();
    const other = gear!.items.find((id) => id !== gear!.equipped)!;
    expect(applyAction(w, p.id, { type: 'equip', item: other }).ok).toBe(true);
    expect(gear!.equipped).toBe(other);
    // nobody can wear another hero's items
    expect(applyAction(w, p.id, { type: 'equip', item: 'wardstaff' }).ok).toBe(false);
  });
});

describe('review fixes', () => {
  it('rejects equipping for a made-up hero, and never touches inherited object keys', () => {
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 61, config: { ...defaultConfig(), aiCount: 2, size: 60 } });
    const p = w.players[w.humanId];
    p.heroGear = { goblin: { items: [], equipped: null } };
    for (const hero of ['__proto__', 'constructor', 'xyz', 'spear']) {
      expect(applyAction(w, p.id, { type: 'equip', item: null, hero } as never).ok).toBe(false);
    }
    expect(({} as Record<string, unknown>).equipped).toBeUndefined();
  });

  it('gives heroes trained before per-hero items an armory, and keeps rounds out of worlds of your own', () => {
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 62, config: { ...defaultConfig(), aiCount: 2, size: 60 } });
    expect(w.endsAt).toBeUndefined();
    const p = w.players[w.humanId];
    const v = w.villages[p.villages[0]];
    v.units.sorcerer = 1;
    v.heroKind = 'sorcerer';
    migrateWorld(w);
    expect(p.heroGear?.sorcerer).toEqual({ items: [], equipped: null });
    expect(w.endsAt).toBeUndefined();
  });
});

describe('hero abilities', () => {
  const fight = async (att: Record<string, number>, def: Record<string, number>, wall = 5) => {
    const { resolveBattle } = await import('../src/engine/combat');
    return resolveBattle({ att, attTech: {}, attItem: null, defStacks: [{ units: def, tech: {} }], defItems: [], wall, luck: 0, morale: 1 });
  };
  it('thornwall, sneak in and dread each change the fight, and say so', async () => {
    const base = await fight({ axe: 1000 }, { spear: 500 });
    const thorn = await fight({ axe: 1000 }, { spear: 500, druid: 1 });
    expect(thorn.effects).toContain('thornwall');
    expect(thorn.defStrength).toBeGreaterThan(base.defStrength * 1.15);
    const sneak = await fight({ axe: 1000, goblin: 1 }, { spear: 500 });
    expect(sneak.effects).toContain('sneak');
    expect(sneak.battleWall).toBe(1);
    const dread = await fight({ axe: 1000, necromancer: 1 }, { spear: 500 });
    expect(dread.effects).toContain('dread-att');
    expect(dread.defStrength).toBeLessThan(base.defStrength * 0.9);
  });

  it('lay on hands: a paladin gets some of his fallen back on their feet', () => {
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'H', seed: 71, config: { ...defaultConfig(), difficulty: 'peaceful', aiCount: 2, size: 60 } });
    const p = w.players[w.humanId];
    const v = w.villages[p.villages[0]];
    Object.assign(v.buildings, { farm: 30, rally: 1 });
    v.units = { axe: 1000, paladin: 1 };
    const target = Object.values(w.villages).filter((b) => b.ownerId === null).sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
    target.units = { spear: 400 };
    target.buildings.wall = 3;
    expect(applyAction(w, p.id, { type: 'send', vid: v.id, target: target.id, kind: 'attack', units: { axe: 1000, paladin: 1 } }).ok).toBe(true);
    const out = Object.values(w.commands).find((c) => c.ownerId === p.id)!;
    advance(w, out.arrive + 1);
    const rep = p.reports.find((r) => r.battle?.healed);
    expect(rep?.battle?.healed?.side).toBe('attacker');
    const lost = rep!.battle!.attLost.axe ?? 0;
    expect(rep!.battle!.healed!.n).toBe(Math.floor(lost * 0.08));
    const back = Object.values(w.commands).find((c) => c.ownerId === p.id && c.kind === 'return')!;
    expect(back.units.axe).toBe(1000 - lost + Math.floor(lost * 0.08));
  });
});
