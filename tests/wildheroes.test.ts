import { describe, expect, it } from 'vitest';
import { recruitCheck } from '../src/engine/actions';
import { resolveBattle } from '../src/engine/combat';
import { sendTroops, travelTime } from '../src/engine/commands';
import { HEROES, HERO_INFO, HERO_POWERS, ITEMS, UNITS } from '../src/engine/data/units';
import { THEMED_UNITS, themeOfHero } from '../src/engine/data/themes';
import { advance } from '../src/engine/game';
import { regionAt, type Region } from '../src/engine/regions';
import type { Units, World } from '../src/engine/types';
import { buildView } from '../src/engine/view';
import { productionRates } from '../src/engine/village';
import { createWorld, defaultConfig } from '../src/engine/world';

const WILD: Record<string, Region> = { frost: 'winter', dwarf: 'volcanic', djinn: 'desert', saurian: 'jungle' };

const fight = (att: Units, def: Units, wall = 0) =>
  resolveBattle({ att, attTech: {}, attItem: null, defStacks: [{ units: def, tech: {} }], defItems: [], wall, luck: 0, morale: 1 });

function world(): World {
  return createWorld({ worldName: 'W', playerName: 'P', villageName: 'Home', seed: 21, config: { ...defaultConfig(), difficulty: 'peaceful', aiCount: 3, size: 120 } });
}

/** A field in the given region (the first one found scanning from the middle out). */
function spotIn(size: number, region: Region): [number, number] {
  for (let r = 0; r < size / 2; r++) {
    for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) {
      const x = size / 2 + dx, y = size / 2 + dy;
      if (x >= 0 && y >= 0 && x < size && y < size && regionAt(x, y, size) === region) return [x, y];
    }
  }
  throw new Error(`no ${region}`);
}

describe('the heroes of the wilds', () => {
  it('are statue heroes with a home region, two abilities, troop names and six items each', () => {
    for (const h of Object.keys(WILD)) {
      expect(HEROES).toContain(h);
      expect(UNITS[h as keyof typeof UNITS].building).toBe('statue');
      expect(HERO_INFO[h].region).toBe(WILD[h]);
      expect(HERO_INFO[h].perks.length).toBe(2);
      expect(themeOfHero(h as never)).toBe(h);
      expect(Object.keys(THEMED_UNITS[h as keyof typeof THEMED_UNITS]).length).toBeGreaterThanOrEqual(13);
      expect(ITEMS.filter((i) => i.hero === h).length).toBe(6);
    }
    // every item id stays unique
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });

  it('answer only villages in their own region', () => {
    const w = world();
    const v = w.villages[w.players[w.humanId].villages[0]];
    Object.assign(v.buildings, { statue: 1 });
    v.res = { wood: 9999, clay: 9999, iron: 9999 };
    for (const [h, region] of Object.entries(WILD)) {
      [v.x, v.y] = spotIn(w.config.size, 'heartland');
      expect(recruitCheck(w, v, h as never, 1).ok).toBe(false);
      expect(recruitCheck(w, v, h as never, 1).reason).toContain('answers only villages in');
      [v.x, v.y] = spotIn(w.config.size, region);
      expect(recruitCheck(w, v, h as never, 1).ok).toBe(true);
    }
    // the heroes of the heartland answer anywhere
    [v.x, v.y] = spotIn(w.config.size, 'desert');
    expect(recruitCheck(w, v, 'orc', 1).ok).toBe(true);
  });

  it('frostbite: cavalry charging the Frost Queen fights weaker', () => {
    const plain = fight({ light: 1500 }, { spear: 800, sword: 400 });
    const frozen = fight({ light: 1500 }, { spear: 800, sword: 400, frost: 1 });
    expect(frozen.attStrength).toBeLessThan(plain.attStrength * (1 - HERO_POWERS.frostbite) * 1.01);
    expect(frozen.effects).toContain('frostbite');
  });

  it('rime walls: rams do far less to a wall the Frost Queen guards', () => {
    const plain = fight({ axe: 3000, ram: 80 }, { spear: 100 }, 20);
    const rimed = fight({ axe: 3000, ram: 80 }, { spear: 100, frost: 1 }, 20);
    expect(rimed.wallAfter).toBeGreaterThan(plain.wallAfter);
    expect(rimed.effects).toContain('rime');
  });

  it("bolt-throwers: the Forgelord's wall cuts attackers down before the armies meet", () => {
    const r = fight({ axe: 1000, light: 500, noble: 1 }, { spear: 3000, dwarf: 1 }, 10);
    // everyone is lost in a failed attack; what matters is the volley reported and a weaker attack
    expect(r.effects).toContain('volley');
    const plain = fight({ axe: 1000, light: 500 }, { spear: 3000 }, 10);
    const bolted = fight({ axe: 1000, light: 500 }, { spear: 3000, dwarf: 1 }, 10);
    expect(bolted.attStrength).toBeLessThan(plain.attStrength * (1 - HERO_POWERS.volley * 10) * 1.01);
    // no wall, no bolt-throwers
    expect(fight({ axe: 1000 }, { spear: 100, dwarf: 1 }, 0).effects ?? []).not.toContain('volley');
  });

  it('deep mines: a village sworn to the Forgelord digs more iron', () => {
    const w = world();
    const v = w.villages[w.players[w.humanId].villages[0]];
    v.buildings.ironmine = 20;
    const before = productionRates(w, v).iron;
    v.heroKind = 'dwarf';
    expect(productionRates(w, v).iron).toBeCloseTo(before * (1 + HERO_POWERS.deepMines), 5);
  });

  it('pack hunt: cavalry with the Saurian King strikes harder', () => {
    const plain = fight({ light: 1000 }, { spear: 500 });
    const pack = fight({ light: 1000, saurian: 1 }, { spear: 500 });
    expect(pack.attStrength).toBeGreaterThan(plain.attStrength * 1.1);
    expect(pack.effects).toContain('pack');
  });

  it('desert wind: an army the Djinn leads marches faster', () => {
    const w = world();
    const vs = Object.values(w.villages);
    const [a, b] = [vs[0], vs[vs.length - 1]];
    const slow = travelTime(w, a, b, { axe: 100 }, null);
    const fast = travelTime(w, a, b, { axe: 100, djinn: 1 }, null);
    expect(fast).toBeLessThan(slow * (1 - HERO_POWERS.sandwind) * 1.01);
  });

  it("tribute: the Djinn's victory brings home resources beyond what the army carries", () => {
    const w = world();
    const p = w.players[w.humanId];
    const v = w.villages[p.villages[0]];
    Object.assign(v.buildings, { rally: 1, farm: 30 });
    v.units = { axe: 3000, djinn: 1 };
    const barb = Object.values(w.villages).filter((b) => b.ownerId === null).sort((x, y) => Math.hypot(x.x - v.x, x.y - v.y) - Math.hypot(y.x - v.x, y.y - v.y))[0];
    barb.units = { spear: 400, sword: 200 };
    barb.res = { wood: 0, clay: 0, iron: 0 };
    expect(sendTroops(w, { ownerId: p.id, fromVid: v.id, toVid: barb.id, kind: 'attack', units: { axe: 3000, djinn: 1 } }).ok).toBe(true);
    advance(w, w.now + 6 * 3600_000);
    const rep = p.reports.find((r) => r.battle?.tribute);
    expect(rep).toBeTruthy();
    const t = rep!.battle!.tribute!;
    expect(t.side).toBe('attacker');
    // 11% of 400 spears and 200 swords, in resources
    const cost = (u: 'spear' | 'sword') => UNITS[u].cost.wood + UNITS[u].cost.clay + UNITS[u].cost.iron;
    const worth = 400 * cost('spear') + 200 * cost('sword');
    expect(t.res.wood + t.res.clay + t.res.iron).toBeGreaterThan(worth * HERO_POWERS.tribute * 0.9);
  });

  it("stalkers: nobody makes out what a Saurian King's attack brings", () => {
    const w = world();
    const p = w.players[w.humanId];
    const v = w.villages[p.villages[0]];
    v.buildings.watchtower = 20;
    p.protectedUntil = 0;
    const ai = Object.values(w.players).find((x) => x.kind === 'ai')!;
    const home = w.villages[ai.villages[0]];
    home.buildings.rally = 1;
    home.units = { axe: 100, saurian: 1, light: 100 };
    ai.protectedUntil = 0;
    const plainRes = sendTroops(w, { ownerId: ai.id, fromVid: home.id, toVid: v.id, kind: 'attack', units: { light: 100 } });
    const stalkRes = sendTroops(w, { ownerId: ai.id, fromVid: home.id, toVid: v.id, kind: 'attack', units: { axe: 100, saurian: 1 } });
    expect(plainRes.ok && stalkRes.ok).toBe(true);
    // late in the march, when a sentry would make out what's coming
    const cmds = buildView(w, p.id).incoming;
    const latest = Math.max(...cmds.map((c) => c.arrive));
    const earliestDepart = Math.min(...cmds.map((c) => c.depart));
    advance(w, earliestDepart + (latest - earliestDepart) * 0.95);
    const seen = buildView(w, p.id).incoming;
    const stalked = seen.find((c) => c.arrive === Math.max(...seen.map((x) => x.arrive)));
    expect(stalked?.kinds).toBeUndefined();
    expect(stalked?.detected ?? null).toBeNull();
  });
});
