// Dev sandbox scene for the heroes of the wilds: /dev/forum.html?heroes
//
// Gives the sandbox ruler a village in each wild land (a statue in each, some already sworn
// to their land's hero), fights a few real battles so the reports show the new heroes'
// abilities (frostbite, rime, bolt-throwers, pack hunt, a djinn's tribute), crafts one report
// the realm can't easily stage (a defending djinn's tribute), and leaves attacks on the road:
// one led by a Saurian King in its last stretch (its troops can't be made out), an ordinary
// one beside it (its troops in sight), and one just setting out. Everything stays in memory.

import { addReport } from '../engine/commands';
import { advance } from '../engine/game';
import { applyAction } from '../engine/actions';
import { regionAt, type Region } from '../engine/regions';
import type { BattleData, Buildings, UnitId, Units, Village, World } from '../engine/types';
import { buildable, inRealm, terrainAt } from '../engine/world';
import { createVillage, refreshPoints } from '../engine/village';
import { distance } from '../engine/formulas';

const BIG: Partial<Buildings> = { main: 15, farm: 30, warehouse: 28, rally: 1, statue: 1, barracks: 10, stable: 10, workshop: 5, smithy: 10, hiding: 3 };

/** A free, buildable field in this land, as near to `near` as can be found. */
function spotIn(w: World, land: Region, near: Village): [number, number] | null {
  const n = w.config.size;
  const taken = new Set(Object.values(w.villages).map((v) => v.y * n + v.x));
  let best: [number, number] | null = null, bd = Infinity;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!inRealm(x, y, n) || taken.has(y * n + x) || !buildable(terrainAt(w, x, y)) || regionAt(x, y, n) !== land) continue;
    const d = distance(x, y, near.x, near.y);
    if (d < bd) { bd = d; best = [x, y]; }
  }
  return best;
}

function found(w: World, pid: number, land: Region, name: string, near: Village, b: Partial<Buildings>, units: Units, hero?: UnitId): Village | null {
  const at = spotIn(w, land, near);
  if (!at) { console.warn('no room in', land); return null; }
  const v = createVillage(w, at[0], at[1], name, pid);
  Object.assign(v.buildings, b);
  v.units = { ...units };
  if (hero) { v.heroKind = hero; v.units[hero] = 1; }
  v.res = { wood: 60000, clay: 60000, iron: 60000 };
  w.players[pid].villages.push(v.id);
  refreshPoints(w, v);
  w.players[pid].points += v.points;
  return v;
}

export function setupHeroes(w: World, me: number, cora: number): void {
  const pMe = w.players[me], pCora = w.players[cora];
  const home = w.villages[pMe.villages[0]];
  const cv = w.villages[pCora.villages[0]];
  pMe.protectedUntil = w.now;
  pCora.protectedUntil = w.now;
  const send = (pid: number, from: Village, to: Village, units: Units) => {
    const r = applyAction(w, pid, { type: 'send', vid: from.id, target: to.id, kind: 'attack', units });
    if (!r.ok) console.warn('send', r.error);
    return r.ok ? (r.data as { id: number }).id : null;
  };

  // home: a statue and plenty of everything, so every heartland hero can be trained here
  Object.assign(home.buildings, BIG, { watchtower: 4, wall: 10 });
  home.res = { wood: 60000, clay: 60000, iron: 60000 };
  home.units = { spear: 200, sword: 200 };
  refreshPoints(w, home);

  // the wilds: the Frost Queen's two northern villages (one without a statue yet), the Forgelord's hold,
  // an unsworn desert village and the Djinn's own, and the Saurian King's
  const frost = found(w, me, 'winter', 'Rimehold', cv, { ...BIG, wall: 8 }, { spear: 400, sword: 300, heavy: 40 }, 'frost');
  found(w, me, 'winter', 'Snowmere', cv, { main: 5, farm: 10, warehouse: 10, rally: 1 }, { spear: 50 });
  const dwarf = found(w, me, 'volcanic', 'Emberdeep', cv, { ...BIG, wall: 12 }, { spear: 500, sword: 400 }, 'dwarf');
  found(w, me, 'desert', 'Dunewell', cv, BIG, { axe: 100 });
  const djinn = found(w, me, 'desert', 'Sunspire', cv, BIG, { axe: 900, light: 300 }, 'djinn');
  const saurian = found(w, me, 'jungle', 'Fangmoor', cv, BIG, { light: 500, heavy: 150, ram: 20 }, 'saurian');

  // Cora keeps a Frost Queen at home (frostbite and rime against the Saurian King's raid), and an army to strike with
  Object.assign(cv.buildings, { rally: 1, wall: 6, farm: 30, statue: 1 });
  cv.heroKind = 'frost';
  cv.units = { frost: 1, spear: 250, sword: 250, heavy: 60, axe: 1500, light: 700, ram: 80 };
  refreshPoints(w, cv);
  // a barbarian village near the Djinn with a garrison worth taking tribute from
  const barb = Object.values(w.villages)
    .filter((v) => v.ownerId === null && djinn)
    .sort((a, b) => distance(a.x, a.y, djinn!.x, djinn!.y) - distance(b.x, b.y, djinn!.x, djinn!.y))[0];
  if (barb) barb.units = { spear: 150, sword: 100, axe: 60 };

  // the battles
  const ids: (number | null)[] = [];
  if (saurian) ids.push(send(me, saurian, cv, { saurian: 1, light: 400, heavy: 150, ram: 20 }));
  if (djinn && barb) ids.push(send(me, djinn, barb, { djinn: 1, axe: 900, light: 300 }));
  if (dwarf) ids.push(send(cora, cv, dwarf, { axe: 700, light: 150, ram: 40 }));
  if (frost) ids.push(send(cora, cv, frost, { light: 300, ram: 30, axe: 300 }));
  const last = Math.max(...ids.map((id) => (id !== null ? w.commands[id]?.arrive ?? 0 : 0)));
  if (last > w.now) advance(w, last + 1000);
  pMe.protectedUntil = w.now;
  pCora.protectedUntil = w.now;

  // a report the realm can't easily stage: a defending djinn claims tribute from the attackers who fell
  const side = (v: Village, pid: number | null) => ({ theme: 'djinn' as const, playerId: pid, playerName: pid !== null ? w.players[pid].name : 'Barbarians', vid: v.id, vname: v.name, x: v.x, y: v.y });
  if (djinn) {
    const battle: BattleData = {
      attacker: { ...side(cv, cora), theme: 'frost' }, defender: side(djinn, me),
      luck: -0.04, morale: 1, winner: 'defender',
      attUnits: { axe: 600, light: 200, ram: 20 }, attLost: { axe: 600, light: 200, ram: 20 },
      defUnits: { djinn: 1, axe: 900, light: 300 }, defLost: { axe: 120, light: 18 },
      wall: { before: 0, after: 0 }, spirit: { before: 100, after: 96 },
      tribute: { side: 'defender', res: { wood: 4378, clay: 4378, iron: 4378 } },
    };
    addReport(w, me, { kind: 'defense', color: 'green', vid: djinn.id, battle, title: `Cora attacks ${djinn.name} (${djinn.x}|${djinn.y})` });
  }

  // attacks on the road to the home village: a hidden one in its last stretch, an ordinary one beside it, one just setting out
  cv.units.saurian = 2;
  cv.units.light = (cv.units.light ?? 0) + 200;
  cv.units.axe = (cv.units.axe ?? 0) + 200;
  const onRoad = (units: Units, done: number) => {
    const id = send(cora, cv, home, units);
    const c = id !== null ? w.commands[id] : undefined;
    if (c) c.depart = w.now - ((c.arrive - w.now) * done) / (1 - done);
  };
  onRoad({ saurian: 1, light: 100 }, 0.86);
  onRoad({ axe: 100, light: 50 }, 0.88);
  onRoad({ saurian: 1, axe: 50 }, 0.05);
}
