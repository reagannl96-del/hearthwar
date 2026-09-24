import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/actions';
import { privatePacket } from '../src/engine/shadow';
import { buildView } from '../src/engine/view';
import { createWorld, defaultConfig, spawnPlayer } from '../src/engine/world';
import type { BattleData } from '../src/engine/types';
import {
  APPROACH, approachAt, bearingOf, fallTimes, figuresFor, hidingCrew, planBattle, representatives,
} from '../src/ui/three/battle/script';

const battle = (o: Partial<BattleData>): BattleData => ({
  attacker: { playerId: 2, playerName: 'A', vid: 2, vname: 'A', x: 0, y: 0 },
  defender: { playerId: 1, playerName: 'D', vid: 1, vname: 'D', x: 0, y: 0 },
  luck: 0, morale: 1, attUnits: { axe: 1000 }, attLost: { axe: 200 }, defUnits: { spear: 500 }, defLost: { spear: 500 },
  winner: 'attacker', ...o,
});

describe('the attack theatre: casting an army', () => {
  it('a few figures stand for many troops, every kind shows, and the whole cast fits', () => {
    expect(figuresFor('axe', 1)).toBe(1);
    expect(figuresFor('axe', 1000)).toBeGreaterThan(figuresFor('axe', 10));
    expect(figuresFor('paladin', 1)).toBe(1);
    expect(figuresFor('ram', 300)).toBeLessThanOrEqual(3);
    const cast = representatives({ axe: 9000, light: 3000, ram: 300, catapult: 100, noble: 4, marcher: 800, paladin: 1 }, 20);
    expect(cast.reduce((s, [, n]) => s + n, 0)).toBeLessThanOrEqual(20);
    expect(cast.map(([u]) => u).sort()).toEqual(['axe', 'catapult', 'light', 'marcher', 'noble', 'paladin', 'ram']);
    // horsemen lead, the siege and the nobles bring up the rear
    expect(cast[0][0]).toBe('light');
    expect(cast[cast.length - 1][0]).toBe('noble');
  });

  it('an army comes from the side it was sent from', () => {
    expect(bearingOf(10, 0, 0, 0)).toBeCloseTo(0);           // east
    expect(bearingOf(0, 10, 0, 0)).toBeCloseTo(Math.PI / 2); // south (the map's y grows southward)
    expect(bearingOf(-10, 0, 0, 0)).toBeCloseTo(Math.PI);    // west
    expect(bearingOf(0, -10, 0, 0)).toBeCloseTo(-Math.PI / 2); // north
  });

  it('it comes into sight for the last fifth of the march: emerge, hold, charge, arrive', () => {
    const depart = 0, arrive = 600_000; // a ten minute march: two minutes in sight
    expect(approachAt(470_000, depart, arrive, 1)).toBeNull();
    const phases = [480_100, 490_000, 560_000, 595_000, 600_000].map((t) => approachAt(t, depart, arrive, 1)!);
    expect(phases.map((p) => p.phase)).toEqual(['emerge', 'emerge', 'hold', 'charge', 'arrived']);
    expect(phases[0].r).toBeGreaterThan(phases[2].r);
    expect(phases[2].r).toBe(APPROACH.stage);
    expect(phases[4].r).toBe(APPROACH.contact);
    // a short march squeezes the show into what time there is
    const quick = approachAt(9_000, 0, 10_000, 1)!;
    expect(quick.phase).not.toBe('hold');
  });
});

describe('the attack theatre: acting out the report', () => {
  it('the rams knock the wall down to exactly the level it was left at', () => {
    const p = planBattle(battle({ attUnits: { axe: 3000, ram: 200 }, attLost: { axe: 100, ram: 5 }, wall: { before: 14, after: 3 } }));
    const shown = p.ramHits.filter((h) => h.level !== null).map((h) => h.level!);
    expect(shown[shown.length - 1]).toBe(3);
    for (let i = 1; i < shown.length; i++) expect(shown[i]).toBeLessThan(shown[i - 1]);
    // the lines meet once the wall is down
    expect(p.meleeStart).toBeGreaterThan(p.ramHits[p.ramHits.length - 1].t);
  });

  it('rams that do nothing still swing, and nothing comes down', () => {
    const p = planBattle(battle({ attUnits: { axe: 50, ram: 5 }, attLost: { axe: 50, ram: 5 }, winner: 'defender', wall: { before: 20, after: 20 } }));
    expect(p.ramHits.length).toBeGreaterThan(0);
    expect(p.ramHits.every((h) => h.level === null)).toBe(true);
  });

  it('catapults bring their target down to its real level (and share the wall with the rams when aimed at it)', () => {
    const p = planBattle(battle({ attUnits: { axe: 3000, catapult: 100 }, attLost: {}, building: { id: 'warehouse', before: 20, after: 16 } }));
    const hits = p.catShots.filter((s) => s.level !== null);
    expect(p.catShots.every((s) => s.target === 'warehouse')).toBe(true);
    expect(hits[hits.length - 1].level).toBe(16);
    const w = planBattle(battle({ attUnits: { axe: 3000, ram: 100, catapult: 100 }, attLost: {}, wall: { before: 15, after: 5 } }));
    // in the order they land, the wall only ever comes down, and it ends at the report's level
    const blows = [...w.ramHits, ...w.catShots.map((s) => ({ t: s.land, level: s.level }))].sort((a, b) => a.t - b.t).filter((h) => h.level !== null).map((h) => h.level!);
    for (let i = 1; i < blows.length; i++) expect(blows[i]).toBeLessThan(blows[i - 1]);
    expect(blows[blows.length - 1]).toBe(5);
    expect(w.catShots.every((s) => s.target === 'wall')).toBe(true);
    // catapults alone on the wall do all its damage
    const c = planBattle(battle({ attUnits: { axe: 3000, catapult: 100 }, attLost: {}, wall: { before: 10, after: 9 } }));
    expect(c.catShots.map((s) => s.level).filter((l) => l !== null)).toEqual([9]);
  });

  it('the losing side falls to the last man; the winner loses its share', () => {
    const p = planBattle(battle({ attUnits: { axe: 1000 }, attLost: { axe: 250 }, defUnits: { spear: 400 }, defLost: { spear: 400 } }));
    const lost = fallTimes(8, 1, 'thrower', p, 'def', 3);
    expect(lost.every((t) => t !== null)).toBe(true);
    expect(Math.max(...(lost as number[]))).toBeLessThanOrEqual(p.meleeEnd);
    const won = fallTimes(8, p.fall.att.axe!, 'melee', p, 'att', 4);
    expect(won.filter((t) => t !== null).length).toBe(2);
  });

  it('a scouting run is a scouting run', () => {
    const p = planBattle(battle({ attUnits: { scout: 30 }, attLost: { scout: 4 }, defUnits: { scout: 10, spear: 200 }, defLost: { scout: 10 } }));
    expect(p.scoutOnly).toBe(true);
    expect(p.ramHits).toEqual([]);
    expect(p.catShots).toEqual([]);
  });

  it('villagers haul the stores into the hiding place only if there is one', () => {
    expect(hidingCrew(0, 0, { wood: 5000, clay: 5000, iron: 5000 })).toBe(0);
    expect(hidingCrew(5, 474, { wood: 5000, clay: 5000, iron: 5000 })).toBeGreaterThan(0);
    expect(hidingCrew(5, 474, { wood: 0, clay: 0, iron: 0 })).toBe(0);
  });
});

describe('what a defender sees of an incoming attack', () => {
  it('in its last fifth the kinds of troops show (never how many); before that, nothing', () => {
    const w = createWorld({ worldName: 'T', playerName: '', villageName: '', multiplayer: true, seed: 5, config: { ...defaultConfig(), aiCount: 2, size: 60 } });
    const a = spawnPlayer(w, 'Alda', 'A')!;
    const d = spawnPlayer(w, 'Dora', 'D')!;
    a.protectedUntil = 0; d.protectedUntil = 0;
    const av = w.villages[a.villages[0]];
    av.buildings.rally = 1;
    av.units = { axe: 500, ram: 20, light: 100 };
    w.villages[d.villages[0]].buildings.watchtower = 0;
    expect(applyAction(w, a.id, { type: 'send', vid: av.id, target: d.villages[0], kind: 'attack', units: { axe: 500, ram: 20, light: 100 } }).ok).toBe(true);
    const c = Object.values(w.commands).find((x) => x.ownerId === a.id)!;
    const seen = () => buildView(w, d.id).incoming.find((x) => x.id === c.id)!;
    expect(seen().kinds).toBeUndefined();
    expect(Object.keys(privatePacket(w, d.id).commands.find((x) => x.id === c.id)!.units)).toEqual([]);
    w.now = c.depart + (c.arrive - c.depart) * 0.85;
    expect(seen().kinds?.sort()).toEqual(['axe', 'light', 'ram']);
    const units = privatePacket(w, d.id).commands.find((x) => x.id === c.id)!.units;
    expect(units).toEqual({ axe: 1, ram: 1, light: 1 });
  });
});
