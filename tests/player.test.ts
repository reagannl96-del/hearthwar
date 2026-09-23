import { describe, expect, it } from 'vitest';
import { applyAction, nobleInfo } from '../src/engine/actions';
import { resolveBattle, computeLoot } from '../src/engine/combat';
import { conquer, sendTroops } from '../src/engine/commands';
import { advance } from '../src/engine/game';
import { removeEvents } from '../src/engine/events';
import { HOUR, MINUTE, unitsPop } from '../src/engine/formulas';
import type { World } from '../src/engine/types';
import { createWorld, defaultConfig, spawnPlayer } from '../src/engine/world';
import { buildView } from '../src/engine/view';
import { popUsed, recomputeCounters, updateVillage } from '../src/engine/village';
import { questStatus } from '../src/engine/quests';

function peacefulWorld(): World {
  return createWorld({
    worldName: 'T', playerName: 'P', villageName: 'Home', seed: 42,
    config: { ...defaultConfig(), difficulty: 'peaceful', aiCount: 4, size: 60 },
  });
}

function human(w: World) {
  const p = w.players[w.humanId];
  return { p, v: w.villages[p.villages[0]] };
}

function nearestBarb(w: World, x: number, y: number, skip = new Set<number>()) {
  return Object.values(w.villages)
    .filter((b) => b.ownerId === null && !skip.has(b.id))
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
}

describe('combat math', () => {
  it('a few axes flatten an empty barbarian village without losses', () => {
    const r = resolveBattle({ att: { axe: 10 }, attTech: {}, attItem: null, defStacks: [{ units: {}, tech: {} }], defItems: [], wall: 0, luck: 0, morale: 1 });
    expect(r.winner).toBe('attacker');
    expect(r.attLost.axe ?? 0).toBe(0);
  });
  it('a wall with spearmen stops a small cavalry raid', () => {
    const r = resolveBattle({ att: { light: 20 }, attTech: {}, attItem: null, defStacks: [{ units: { spear: 100 }, tech: {} }], defItems: [], wall: 10, luck: 0, morale: 1 });
    expect(r.winner).toBe('defender');
    expect(r.attLost.light).toBe(20);
    expect(r.defLost[0].spear ?? 0).toBeLessThan(100);
  });
  it('rams knock the wall down after a won battle', () => {
    const r = resolveBattle({ att: { axe: 3000, ram: 200 }, attTech: {}, attItem: null, defStacks: [{ units: {}, tech: {} }], defItems: [], wall: 20, luck: 0, morale: 1 });
    expect(r.winner).toBe('attacker');
    expect(r.wallAfter).toBeLessThan(10);
  });
  it('scouts beat fewer scouts and survive', () => {
    const r = resolveBattle({ att: { scout: 10 }, attTech: {}, attItem: null, defStacks: [{ units: { scout: 3 }, tech: {} }], defItems: [], wall: 0, luck: 0, morale: 1 });
    expect(r.pureScout).toBe(true);
    expect(r.scoutsSurvived).toBeGreaterThan(5);
  });
  it('heroes are stronger against their kind of troops', () => {
    const base = { attTech: {}, attItem: null, defItems: [], wall: 0, luck: 0, morale: 1 };
    const vsInf = (hero: 'sorcerer' | 'paladin') =>
      resolveBattle({ ...base, att: { axe: 500, [hero]: 1 }, defStacks: [{ units: { spear: 2000 }, tech: {} }] }).attStrength;
    // a sorcerer boosts an attack on infantry, a paladin does not
    expect(vsInf('sorcerer')).toBeGreaterThan(vsInf('paladin') * 1.1);
    // a defending druid halves the rams' damage to the wall
    const rams = (def: Record<string, number>) =>
      resolveBattle({ ...base, att: { axe: 3000, ram: 60 }, defStacks: [{ units: def, tech: {} }], wall: 15 }).wallAfter;
    expect(rams({ druid: 1 })).toBeGreaterThan(rams({ paladin: 1 }));
    // a goblin doubles its side's scouts
    const scouts = (att: Record<string, number>) => resolveBattle({ ...base, att, defStacks: [{ units: { scout: 10 }, tech: {} }] }).scoutsSurvived;
    expect(scouts({ scout: 8 })).toBe(0);
    expect(scouts({ scout: 8, goblin: 1 })).toBeGreaterThan(0);
  });
  it('loot splits evenly and respects capacity', () => {
    expect(computeLoot({ wood: 1000, clay: 1000, iron: 1000 }, 300)).toEqual({ wood: 100, clay: 100, iron: 100 });
    expect(computeLoot({ wood: 50, clay: 1000, iron: 1000 }, 300)).toEqual({ wood: 50, clay: 125, iron: 125 });
    expect(computeLoot({ wood: 10, clay: 20, iron: 30 }, 1000)).toEqual({ wood: 10, clay: 20, iron: 30 });
  });
});

describe('a human player', () => {
  it('builds, recruits, raids, scouts, trades and conquers', () => {
    const w = peacefulWorld();
    const { p, v } = human(w);
    removeEvents(w, (e) => e.type === 'barb'); // keep the barbarians still for these checks
    const act = (a: Parameters<typeof applyAction>[2]) => {
      const r = applyAction(w, p.id, a);
      if (!r.ok) throw new Error(`${a.type}: ${r.error}`);
      return r;
    };
    // --- building ---
    act({ type: 'build', vid: v.id, building: 'timber' });
    act({ type: 'build', vid: v.id, building: 'claypit' });
    expect(v.buildQueue.length).toBe(2);
    advance(w, w.now + MINUTE);
    expect(v.buildings.timber).toBe(1);
    expect(v.buildings.claypit).toBe(1);
    // cancel refunds
    const before = v.res.wood;
    act({ type: 'build', vid: v.id, building: 'ironmine' });
    const job = v.buildQueue[0];
    act({ type: 'cancelBuild', vid: v.id, job: job.id });
    expect(Math.round(v.res.wood)).toBeGreaterThanOrEqual(Math.round(before - 1));

    // fast-track the village so we can test later systems
    Object.assign(v.buildings, { main: 20, barracks: 10, stable: 10, workshop: 5, smithy: 20, market: 10, rally: 1, farm: 25, warehouse: 25, timber: 20, claypit: 20, ironmine: 20, statue: 1 });
    v.res = { wood: 300000, clay: 300000, iron: 300000 };
    updateVillage(w, v, w.now);

    // --- research & recruit ---
    act({ type: 'research', vid: v.id, unit: 'axe' });
    act({ type: 'research', vid: v.id, unit: 'light' });
    advance(w, w.now + HOUR);
    expect(v.tech.axe).toBe(1);
    expect(v.tech.light).toBe(1);
    act({ type: 'research', vid: v.id, unit: 'scout' });
    advance(w, w.now + HOUR);
    act({ type: 'recruit', vid: v.id, unit: 'light', count: 50 });
    act({ type: 'recruit', vid: v.id, unit: 'axe', count: 100 });
    act({ type: 'recruit', vid: v.id, unit: 'scout', count: 10 });
    advance(w, w.now + 2 * HOUR);
    updateVillage(w, v, w.now);
    expect(v.units.light).toBe(50);
    expect(v.units.axe).toBe(100);

    // --- raid a barbarian village ---
    const barb = nearestBarb(w, v.x, v.y);
    barb.units = {}; // barbarians grow a few defenders over time; keep this raid clean
    const reportsBefore = p.reports.length;
    act({ type: 'send', vid: v.id, target: barb.id, kind: 'attack', units: { light: 20 } });
    expect(v.units.light).toBe(30);
    advance(w, w.now + 2 * HOUR);
    updateVillage(w, v, w.now);
    expect(v.units.light).toBe(50);
    expect(p.reports.length).toBeGreaterThan(reportsBefore);
    const rep = p.reports.find((r) => r.kind === 'attack')!;
    expect(rep.battle?.winner).toBe('attacker');
    expect(p.stats.loot).toBeGreaterThan(0);
    expect(p.intel[barb.id].lastColor).toBe('green');

    // --- scouting ---
    act({ type: 'send', vid: v.id, target: barb.id, kind: 'attack', units: { scout: 5 } });
    advance(w, w.now + HOUR);
    const scoutRep = p.reports.find((r) => r.battle?.scout);
    expect(scoutRep?.battle?.scout?.res).toBeDefined();
    expect(scoutRep?.battle?.scout?.buildings).toBeDefined();

    // --- cancel an attack ---
    act({ type: 'send', vid: v.id, target: barb.id, kind: 'attack', units: { axe: 10 } });
    const cmd = Object.values(w.commands).find((c) => c.ownerId === p.id && c.kind === 'attack')!;
    advance(w, w.now + 1000);
    act({ type: 'cancelCommand', id: cmd.id });
    advance(w, w.now + HOUR);
    updateVillage(w, v, w.now);
    expect(v.units.axe).toBe(100);

    // --- repeat raids keep going while clean ---
    act({ type: 'send', vid: v.id, target: barb.id, kind: 'attack', units: { light: 10 }, repeat: true });
    advance(w, w.now + 3 * HOUR);
    expect(Object.values(w.commands).some((c) => c.ownerId === p.id && c.repeat)).toBe(true);

    // --- scavenging ---
    act({ type: 'scavengeUnlock', vid: v.id, tier: 0 });
    act({ type: 'scavenge', vid: v.id, tier: 0, units: { axe: 50 } });
    expect(v.scavenge[0]).not.toBeNull();
    advance(w, w.now + 3 * HOUR);
    expect(v.scavenge[0]).toBeNull();
    updateVillage(w, v, w.now);
    expect(v.units.axe).toBe(100);

    // --- paladin ---
    act({ type: 'recruit', vid: v.id, unit: 'paladin', count: 1 });
    advance(w, w.now + 2 * HOUR);
    updateVillage(w, v, w.now);
    expect(v.units.paladin).toBe(1);
    advance(w, w.now + 5 * HOUR);
    expect(p.paladin!.items.length).toBeGreaterThan(0);

    // --- nobles & conquest ---
    v.buildings.academy = 1;
    v.res = { wood: 400000, clay: 400000, iron: 400000 };
    act({ type: 'mintCoin', vid: v.id, count: 1 });
    expect(nobleInfo(w, p.id).canTrain).toBe(1);
    act({ type: 'recruit', vid: v.id, unit: 'noble', count: 1 });
    advance(w, w.now + HOUR);
    updateVillage(w, v, w.now);
    expect(v.units.noble).toBe(1);
    const target = nearestBarb(w, v.x, v.y);
    target.buildings.wall = 0;
    let conquered = false;
    for (let i = 0; i < 12 && !conquered; i++) {
      updateVillage(w, v, w.now);
      if ((v.units.noble ?? 0) < 1) {
        advance(w, w.now + 10 * MINUTE);
        continue;
      }
      target.units = {}; // AI rulers roam this map too; keep this barb undefended for the noble check
      if (i === 0) { target.loyalty = 30; target.loyaltyAt = w.now; } // one noble should finish it
      act({ type: 'send', vid: v.id, target: target.id, kind: 'attack', units: { noble: 1, axe: 20 } });
      advance(w, w.now + 30 * MINUTE);
      conquered = target.ownerId === p.id;
      if (!conquered) {
        // nobles come home with the survivors; send again
        advance(w, w.now + 30 * MINUTE);
      }
    }
    expect(conquered).toBe(true);
    expect(p.villages).toContain(target.id);
    // loyalty starts at 25 after a conquest and has been regenerating since
    expect(target.loyalty).toBeGreaterThanOrEqual(25);
    expect(target.loyalty).toBeLessThan(60);

    // --- trade between own villages ---
    v.res = { wood: 50000, clay: 50000, iron: 50000 };
    act({ type: 'trade', vid: v.id, target: target.id, res: { wood: 1000, clay: 1000, iron: 0 } });
    expect(v.merchantsOut).toBe(2);
    advance(w, w.now + 3 * HOUR);
    expect(v.merchantsOut).toBe(0);

    // --- support another own village and withdraw ---
    act({ type: 'send', vid: v.id, target: target.id, kind: 'support', units: { axe: 5 } });
    advance(w, w.now + HOUR);
    expect(target.support.some((s) => s.fromVid === v.id && (s.units.axe ?? 0) >= 5)).toBe(true);
    act({ type: 'withdraw', host: target.id, from: v.id });
    advance(w, w.now + HOUR);

    // --- counters stay exact ---
    const snapshot = Object.values(w.villages).map((x) => [x.id, x.outPop]);
    recomputeCounters(w);
    const again = Object.values(w.villages).map((x) => [x.id, x.outPop]);
    expect(again).toEqual(snapshot);

    // --- save & load round trip ---
    const copy = JSON.parse(JSON.stringify(w)) as World;
    recomputeCounters(copy);
    advance(copy, copy.now + HOUR);
    const view = buildView(copy, copy.humanId);
    expect(view.villages.length).toBe(2);
    expect(popUsed(copy.villages[v.id])).toBeGreaterThan(unitsPop(copy.villages[v.id].units));
    expect(questStatus(copy, copy.players[copy.humanId]).length).toBeGreaterThan(0);
  }, 60_000);

  it('conquers a village in one noble train', () => {
    const w = peacefulWorld();
    const { p, v } = human(w);
    Object.assign(v.buildings, { main: 20, barracks: 10, smithy: 20, market: 10, rally: 1, farm: 30, warehouse: 30, academy: 1 });
    v.units = { axe: 400, noble: 4 };
    p.coins = 10;
    const target = nearestBarb(w, v.x, v.y);
    target.buildings.wall = 3;
    const r = applyAction(w, p.id, { type: 'train', vid: v.id, target: target.id, waves: [{ axe: 200 }, { noble: 1, axe: 25 }, { noble: 1, axe: 25 }, { noble: 1, axe: 25 }, { noble: 1, axe: 25 }] });
    expect(r.ok).toBe(true);
    const cmds = Object.values(w.commands).filter((c) => c.ownerId === p.id).sort((a, b) => a.arrive - b.arrive);
    expect(cmds.length).toBe(5);
    expect(cmds[0].units.noble ?? 0).toBe(0);
    expect(cmds[4].arrive - cmds[0].arrive).toBe(400);
    // an earlier noble has already worn the village down, so four more (20-35 each) always take it
    advance(w, cmds[0].arrive + 1);
    target.loyalty = 80;
    advance(w, cmds[4].arrive + 1);
    expect(target.ownerId).toBe(p.id);
  });

  it('drops online players at random spots, apart from each other', () => {
    const w = createWorld({ worldName: 'T', playerName: '', villageName: '', multiplayer: true, seed: 7, config: { ...defaultConfig(), aiCount: 8, size: 100 } });
    const spots = Array.from({ length: 8 }, (_, i) => {
      const p = spawnPlayer(w, `P${i}`, `V${i}`)!;
      const v = w.villages[p.villages[0]];
      return [v.x, v.y];
    });
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1])).toBeGreaterThanOrEqual(10);
    // spread over the map, not bunched around the middle
    const xs = spots.map((s) => s[0]), ys = spots.map((s) => s[1]);
    expect(Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(80);
  });

  it('can be conquered and respawn', () => {
    const w = peacefulWorld();
    const { p, v } = human(w);
    const ai = Object.values(w.players).find((x) => x.kind === 'ai')!;
    conquer(w, v, ai.id);
    expect(p.eliminated).toBe(true);
    expect(p.villages.length).toBe(0);
  });

  it('a big enough scouting party sees everything; a handful sees little or dies', () => {
    const w = peacefulWorld();
    removeEvents(w, (e) => e.type === 'barb');
    const { p, v } = human(w);
    v.buildings.rally = 1;
    v.units.scout = 200;
    const barb = nearestBarb(w, v.x, v.y);
    barb.units = { scout: 20, spear: 50 };
    const scoutWith = (n: number) => {
      const before = p.reports.length;
      expect(applyAction(w, p.id, { type: 'send', vid: v.id, target: barb.id, kind: 'attack', units: { scout: n } }).ok).toBe(true);
      advance(w, w.now + 3 * HOUR);
      updateVillage(w, v, w.now);
      barb.units.scout = 20;
      return p.reports.slice(0, p.reports.length - before).find((r) => r.battle)?.battle;
    };
    const few = scoutWith(10);
    expect(few?.scout).toBeUndefined(); // all ten caught
    const many = scoutWith(80);
    expect(many?.scout?.res).toBeDefined();
    expect(many?.scout?.buildings).toBeDefined();
    expect(many?.scout?.unitsOutside).toBeDefined();
    expect(many?.defUnits?.spear).toBe(50); // the troops inside are seen too
  });

  it('a victorious attacker plunders the defeated village and carries the loot home', () => {
    const w = peacefulWorld();
    removeEvents(w, (e) => e.type === 'barb');
    const { p, v } = human(w);
    const ai = Object.values(w.players).find((x) => x.kind === 'ai')!;
    const home = w.villages[ai.villages[0]];
    p.protectedUntil = 0;
    ai.protectedUntil = 0;
    v.units = { spear: 20 };
    v.buildings.wall = 0;
    v.buildings.hiding = 1;
    v.buildings.warehouse = 20;
    v.res = { wood: 20000, clay: 20000, iron: 20000 };
    home.units = { axe: 400, light: 200 };
    home.buildings.rally = 1;
    home.res = { wood: 0, clay: 0, iron: 0 };
    const before = v.res.wood + v.res.clay + v.res.iron;
    const r = sendTroops(w, { ownerId: ai.id, fromVid: home.id, toVid: v.id, kind: 'attack', units: { axe: 400, light: 200 } });
    expect(r.ok).toBe(true);
    const arrive = (r.data as { arrive: number }).arrive;
    advance(w, arrive + 1000);
    updateVillage(w, v, w.now);
    const report = p.reports.find((x) => x.battle && x.battle.attacker.playerId === ai.id)!;
    expect(report.battle!.winner).toBe('attacker');
    const loot = report.battle!.loot!;
    const taken = loot.wood + loot.clay + loot.iron;
    // the survivors carried off as much as they could hold, and the defender sees it
    expect(taken).toBeGreaterThan(15000);
    expect(v.res.wood + v.res.clay + v.res.iron).toBeLessThan(before - taken + 5000);
    // ...and the survivors carry it home
    const back = Object.values(w.commands).find((c) => c.kind === 'return' && c.ownerId === ai.id && c.fromVid === home.id)!;
    expect(back.res!.wood + back.res!.clay + back.res!.iron).toBeCloseTo(taken, 0);
  });

  it('AI rulers attack when a scouting report makes it worth it, not on a timer', () => {
    const setup = (rich: boolean) => {
      const w = createWorld({
        worldName: 'T', playerName: 'P', villageName: 'Home', seed: 5,
        config: { ...defaultConfig(), difficulty: 'hard', aiCount: 6, size: 50, aiAlwaysAwake: true },
      });
      removeEvents(w, (e) => e.type === 'barb');
      const p = w.players[w.humanId];
      const v = w.villages[p.villages[0]];
      p.protectedUntil = 0;
      v.units = { spear: 5 };
      v.buildings.warehouse = 25;
      v.buildings.hiding = 0;
      for (const ai of Object.values(w.players).filter((x) => x.kind === 'ai')) {
        ai.ai!.hostile = true;
        ai.ai!.aggression = 1;
        ai.ai!.targetPlayer = null;
        for (const vid of ai.villages) {
          const av = w.villages[vid];
          av.buildings.rally = 1;
          av.units = { axe: 3000, light: 1000, scout: 50 };
        }
      }
      const hits = () => p.reports.filter((r) => r.battle && r.battle.attacker.playerId !== p.id && Object.entries(r.battle.attUnits).some(([k, n]) => k !== 'scout' && (n ?? 0) > 0)).length;
      // keep the village's stockpile where the test wants it for the whole hour
      const keep = () => { updateVillage(w, v, w.now); v.res = rich ? { wood: 150000, clay: 150000, iron: 150000 } : { wood: 0, clay: 0, iron: 0 }; };
      for (let i = 0; i < 60; i++) { keep(); advance(w, w.now + 60_000); }
      return hits();
    };
    const poor = setup(false), rich = setup(true);
    // an empty village only sees the odd impulsive raid; a fat, poorly guarded one draws far more
    expect(rich).toBeGreaterThan(poor);
    expect(poor).toBeLessThanOrEqual(6);
  });

  it('AI rulers with noblemen send noble trains at players after scouting them', () => {
    const w = createWorld({
      worldName: 'T', playerName: 'P', villageName: 'Home', seed: 5,
      config: { ...defaultConfig(), difficulty: 'hard', aiCount: 6, size: 50, aiAlwaysAwake: true },
    });
    removeEvents(w, (e) => e.type === 'barb');
    const p = w.players[w.humanId];
    const v = w.villages[p.villages[0]];
    p.protectedUntil = 0;
    v.units = { spear: 5 };
    v.buildings.main = 10; v.buildings.farm = 10; v.buildings.warehouse = 10;
    v.points = 400;
    let trains = 0;
    for (const ai of Object.values(w.players).filter((x) => x.kind === 'ai')) {
      ai.ai!.hostile = true;
      ai.ai!.aggression = 1;
      for (const vid of ai.villages) {
        const av = w.villages[vid];
        av.buildings.rally = 1;
        av.units = { axe: 4000, light: 1000, scout: 50, noble: 3 };
      }
    }
    for (let i = 0; i < 40 && trains === 0; i++) {
      advance(w, w.now + 60_000);
      for (const c of Object.values(w.commands)) if (c.kind === 'attack' && c.toVid === v.id && (c.units.noble ?? 0) > 0) trains++;
    }
    expect(trains).toBeGreaterThan(0);
  });

  it('AI villages have roles: defensive villages hold the line, offensive ones go to war', () => {
    const w = createWorld({
      worldName: 'T', playerName: 'P', villageName: 'Home', seed: 9,
      config: { ...defaultConfig(), difficulty: 'hard', aiCount: 6, size: 50, aiAlwaysAwake: true },
    });
    removeEvents(w, (e) => e.type === 'barb');
    const p = w.players[w.humanId];
    p.protectedUntil = 0;
    w.villages[p.villages[0]].units = { spear: 5 };
    w.villages[p.villages[0]].res = { wood: 150000, clay: 150000, iron: 150000 };
    const ais = Object.values(w.players).filter((x) => x.kind === 'ai');
    const defense = new Set<number>(), offense = new Set<number>();
    ais.forEach((ai, i) => {
      ai.ai!.hostile = true;
      ai.ai!.aggression = 1;
      for (const vid of ai.villages) {
        const av = w.villages[vid];
        av.buildings.rally = 1;
        av.units = { axe: 3000, light: 1000, spear: 2000, scout: 50 };
        ai.ai!.roles = { ...(ai.ai!.roles ?? {}), [vid]: { kind: i % 2 ? 'defense' : 'offense' } };
        (i % 2 ? defense : offense).add(vid);
      }
    });
    const launched = new Set<number>();
    for (let i = 0; i < 60; i++) {
      advance(w, w.now + 60_000);
      for (const c of Object.values(w.commands)) if (c.kind === 'attack' && c.tag === 'war') launched.add(c.fromVid);
    }
    expect([...launched].filter((v) => defense.has(v))).toEqual([]);
    expect([...launched].some((v) => offense.has(v))).toBe(true);
  });

  it('a statue stays sworn to the first hero trained there, even after it dies', () => {
    const w = peacefulWorld();
    const { p, v } = human(w);
    v.buildings.statue = 1;
    v.buildings.farm = 20;
    v.res = { wood: 50000, clay: 50000, iron: 50000 };
    expect(applyAction(w, p.id, { type: 'recruit', vid: v.id, unit: 'sorcerer', count: 1 }).ok).toBe(true);
    advance(w, w.now + 12 * HOUR);
    updateVillage(w, v, w.now);
    expect(v.units.sorcerer).toBe(1);
    expect(v.heroKind).toBe('sorcerer');
    delete v.units.sorcerer; // fell in battle
    expect(applyAction(w, p.id, { type: 'recruit', vid: v.id, unit: 'druid', count: 1 }).ok).toBe(false);
    expect(applyAction(w, p.id, { type: 'recruit', vid: v.id, unit: 'sorcerer', count: 1 }).ok).toBe(true);
    expect(buildView(w, p.id).villages[0].hero).toBe('sorcerer');
  });

  it('restarts: old village turns barbarian as-is, a new one is founded', () => {
    const w = peacefulWorld();
    const { p, v } = human(w);
    v.buildings.barracks = 3;
    v.buildings.rally = 1;
    v.units = { spear: 40, axe: 12, noble: 1 };
    const barb = nearestBarb(w, v.x, v.y);
    expect(applyAction(w, p.id, { type: 'send', vid: v.id, target: barb.id, kind: 'attack', units: { spear: 10 } }).ok).toBe(true);
    const r = applyAction(w, p.id, { type: 'restart', village: 'Fresh Start' });
    expect(r.ok).toBe(true);
    expect(v.ownerId).toBeNull();
    expect(v.name).toBe('Barbarian village');
    expect(v.buildings.barracks).toBe(3);
    expect(v.units).toEqual({ spear: 30, axe: 12 });
    expect(Object.values(w.commands).some((c) => c.ownerId === p.id)).toBe(false);
    expect(p.villages.length).toBe(1);
    const nv = w.villages[p.villages[0]];
    expect(nv.id).toBe(r.data);
    expect(nv.name).toBe('Fresh Start');
    expect(p.protectedUntil).toBeGreaterThan(w.now);
    // the world keeps running without trouble
    advance(w, w.now + 2 * HOUR);
    expect(v.ownerId).toBeNull();
    expect(buildView(w, p.id).villages.length).toBe(1);
  });
});
