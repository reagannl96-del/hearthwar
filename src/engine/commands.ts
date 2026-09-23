// Troop & merchant movements: sending, arrival, battles, conquest and reports.

import { bumpDaily } from './awards';
import { themeOfHero, unitNameAt } from './data/themes';
import { computeLoot, resolveBattle, type DefStackInput } from './combat';
import { BUILDINGS, BUILDING_ORDER } from './data/buildings';
import { HEROES, HERO_POWERS, ITEM_BY_ID, MERCHANT_CARRY, MERCHANT_SPEED, UNITS, isHero, type ItemDef } from './data/units';
import { pushEvent } from './events';
import { addCommand, commandsFrom, commandsOf, removeCommand } from './cmdindex';
import {
  MINUTE, addUnits, armyMsPerField, cloneUnits, distance, hasUnits, hideCap, merchantCount, moraleFor, res, resSum,
  unitsCarry, unitsCount, unitsPop,
} from './formulas';
import { nextRandom, randInt } from './rng';
import { villageName } from './data/names';
import type {
  ActionResult, BattleData, BuildingId, Command, Intel, Player, Report, ReportColor, Res, SideInfo, UnitId, Units,
  Village, World,
} from './types';
import { RES_KEYS } from './types';
import { popFree, refreshPoints, storageOf, updateVillage } from './village';

export const REPORT_CAP = 600;

// ---------- helpers ----------

export function playerName(w: World, id: number | null): string {
  if (id === null) return 'Barbarians';
  return w.players[id]?.name ?? 'Unknown';
}

export function sideInfo(w: World, v: Village, ownerId: number | null = v.ownerId): SideInfo {
  return { theme: themeOfHero(v.heroKind), playerId: ownerId, playerName: playerName(w, ownerId), vid: v.id, vname: v.name, x: v.x, y: v.y };
}

export function addReport(w: World, playerId: number | null, r: Omit<Report, 'id' | 't' | 'read'> & { read?: boolean }): Report | null {
  if (playerId === null) return null;
  const p = w.players[playerId];
  if (!p || p.kind !== 'human') return null;
  const rep: Report = { id: w.nextId++, t: w.now, read: false, ...r };
  p.reports.unshift(rep);
  if (p.reports.length > REPORT_CAP) p.reports.length = REPORT_CAP;
  return rep;
}

export function news(w: World, text: string, kind: 'conquest' | 'player' | 'world', vid?: number): void {
  w.news.unshift({ t: w.now, text, kind, vid });
  if (w.news.length > 200) w.news.length = 200;
}

/** The legendary item carried by the hero marching with these troops, if any. */
function equippedItem(w: World, ownerId: number | null, units: Units): ItemDef | null {
  if (ownerId === null) return null;
  const p = w.players[ownerId];
  if (!p) return null;
  for (const h of HEROES) {
    if ((units[h] ?? 0) <= 0) continue;
    const gear = h === 'paladin' ? p.paladin : p.heroGear?.[h];
    if (gear?.equipped) return ITEM_BY_ID[gear.equipped] ?? null;
  }
  return null;
}

/**
 * How long an army takes between two villages. Support marching with a druid
 * takes the forest's old paths and arrives 25% sooner.
 */
export function travelTime(w: World, from: Village, to: Village, units: Units, ownerId: number | null, support = false): number {
  const item = equippedItem(w, ownerId, units);
  const per = armyMsPerField(units, w.config.unitSpeed, item?.special === 'speed' ? 0.15 : 0);
  const druid = support && (units.druid ?? 0) > 0 ? 0.75 : 1;
  return Math.max(1000, Math.round(distance(from.x, from.y, to.x, to.y) * per * druid));
}

export function merchantTime(w: World, from: Village, to: Village): number {
  return Math.max(1000, Math.round((distance(from.x, from.y, to.x, to.y) * MERCHANT_SPEED * MINUTE) / w.config.unitSpeed));
}

export function isProtected(w: World, playerId: number | null): boolean {
  if (playerId === null) return false;
  const p = w.players[playerId];
  return !!p && p.protectedUntil > w.now;
}

// ---------- sending ----------

export interface SendOpts {
  ownerId: number;
  fromVid: number;
  toVid: number;
  kind: 'attack' | 'support';
  units: Units;
  catTarget?: BuildingId;
  repeat?: boolean;
  tag?: string;
  /** force the arrival time (noble trains line up their waves) */
  arriveAt?: number;
}

export function sendTroops(w: World, o: SendOpts): ActionResult {
  const from = w.villages[o.fromVid];
  const to = w.villages[o.toVid];
  if (!from || from.ownerId !== o.ownerId) return { ok: false, error: 'That is not your village.' };
  if (!to) return { ok: false, error: 'Target village not found.' };
  if (from.id === to.id) return { ok: false, error: 'Troops are already there.' };
  if (from.buildings.rally < 1) return { ok: false, error: 'Build a rally point first.' };
  updateVillage(w, from, w.now);
  const units: Units = {};
  for (const k in o.units) {
    const u = k as UnitId;
    const n = Math.floor(o.units[u] ?? 0);
    if (n <= 0) continue;
    if (u === 'militia') return { ok: false, error: 'Militia never leave the village.' };
    if ((from.units[u] ?? 0) < n) return { ok: false, error: `Not enough ${unitNameAt(from, u, true).toLowerCase()} at home.` };
    units[u] = n;
  }
  if (!hasUnits(units)) return { ok: false, error: 'Select some troops first.' };
  if (o.kind === 'support') {
    if (to.ownerId === null) return { ok: false, error: 'You cannot support barbarian villages.' };
    if (units.noble) return { ok: false, error: 'Noblemen can only be sent in attacks.' };
  } else {
    if (to.ownerId === o.ownerId) return { ok: false, error: 'You cannot attack your own village.' };
    if (to.ownerId !== null && isProtected(w, to.ownerId)) {
      return { ok: false, error: `${playerName(w, to.ownerId)} is still under beginner protection.` };
    }
    const me = w.players[o.ownerId];
    if (to.ownerId !== null && me.tribeId !== null && w.players[to.ownerId]?.tribeId === me.tribeId) {
      return { ok: false, error: 'You cannot attack a member of your own tribe.' };
    }
  }
  // attacking a real player ends your own beginner protection
  if (o.kind === 'attack' && to.ownerId !== null) {
    const me = w.players[o.ownerId];
    if (me.protectedUntil > w.now) me.protectedUntil = w.now;
  }
  let dur = travelTime(w, from, to, units, o.ownerId, o.kind === 'support');
  if (o.arriveAt !== undefined && o.arriveAt - w.now > dur) dur = o.arriveAt - w.now;
  for (const k in units) from.units[k as UnitId]! -= units[k as UnitId]!;
  for (const k in from.units) if ((from.units[k as UnitId] ?? 0) <= 0) delete from.units[k as UnitId];
  from.outPop += unitsPop(units);
  const c: Command = {
    id: w.nextId++,
    kind: o.kind,
    ownerId: o.ownerId,
    fromVid: from.id,
    toVid: to.id,
    units,
    depart: w.now,
    arrive: w.now + dur,
  };
  if (o.catTarget && units.catapult) c.catTarget = o.catTarget;
  if (o.repeat) c.repeat = true;
  if (o.tag) c.tag = o.tag;
  c.targetOwner = to.ownerId;
  addCommand(w, c);
  pushEvent(w, 'arrive', c.arrive, c.id);
  if (o.kind === 'attack') w.players[o.ownerId].stats.attacks++;
  return { ok: true, data: { id: c.id, arrive: c.arrive } };
}

/**
 * A noble train: several attacks from one village that land in order, 100 ms
 * apart, all marching at the pace of the slowest wave (usually the nobles).
 */
export function sendTrain(w: World, ownerId: number, fromVid: number, toVid: number, waves: Units[], catTarget?: BuildingId): ActionResult {
  const from = w.villages[fromVid];
  const to = w.villages[toVid];
  if (!from || from.ownerId !== ownerId) return { ok: false, error: 'That is not your village.' };
  if (!to) return { ok: false, error: 'Target village not found.' };
  const list = waves.filter((u) => hasUnits(u));
  if (list.length < 2) return { ok: false, error: 'A train needs at least two waves.' };
  updateVillage(w, from, w.now);
  const need: Units = {};
  for (const u of list) addUnits(need, u);
  for (const k in need) {
    if ((from.units[k as UnitId] ?? 0) < (need[k as UnitId] ?? 0)) return { ok: false, error: `Not enough ${unitNameAt(from, k as UnitId, true).toLowerCase()} for every wave.` };
  }
  const slowest = Math.max(...list.map((u) => travelTime(w, from, to, u, ownerId)));
  const land = w.now + slowest;
  for (let i = 0; i < list.length; i++) {
    const r = sendTroops(w, { ownerId, fromVid, toVid, kind: 'attack', units: list[i], catTarget, arriveAt: land + i * 100, tag: 'train' });
    if (!r.ok) return r;
  }
  return { ok: true, data: { arrive: land, waves: list.length } };
}

export function cancelWindow(c: Command): number {
  return Math.max(10_000, (c.arrive - c.depart) * 0.2);
}

export function cancelCommand(w: World, playerId: number, cid: number): ActionResult {
  const c = w.commands[cid];
  if (!c || c.ownerId !== playerId) return { ok: false, error: 'Command not found.' };
  if (c.kind !== 'attack' && c.kind !== 'support') return { ok: false, error: 'This command cannot be cancelled.' };
  const elapsed = w.now - c.depart;
  if (elapsed > cancelWindow(c)) return { ok: false, error: 'Too late to call the troops back.' };
  removeCommand(w, c);
  const back: Command = {
    id: w.nextId++, kind: 'return', ownerId: c.ownerId, fromVid: c.fromVid, toVid: c.fromVid, origin: c.toVid,
    units: c.units, depart: w.now, arrive: w.now + Math.max(1000, elapsed),
  };
  addCommand(w, back);
  pushEvent(w, 'arrive', back.arrive, back.id);
  return { ok: true };
}

/** Send stationed support in `hostVid` (belonging to `fromVid`) back home. */
export function withdrawSupport(w: World, playerId: number, hostVid: number, fromVid: number, units?: Units): ActionResult {
  const host = w.villages[hostVid];
  const home = w.villages[fromVid];
  if (!host || !home) return { ok: false, error: 'Village not found.' };
  const idx = host.support.findIndex((s) => s.fromVid === fromVid);
  if (idx < 0) return { ok: false, error: 'No such support.' };
  const st = host.support[idx];
  // either the owner of the troops or the owner of the host village can send them home
  if (st.ownerId !== playerId && host.ownerId !== playerId) return { ok: false, error: 'Not your troops.' };
  const send: Units = {};
  if (units) {
    for (const k in units) {
      const u = k as UnitId;
      const n = Math.min(st.units[u] ?? 0, Math.floor(units[u] ?? 0));
      if (n > 0) send[u] = n;
    }
  } else Object.assign(send, st.units);
  if (!hasUnits(send)) return { ok: false, error: 'Select some troops.' };
  addUnits(st.units, send, -1);
  if (!hasUnits(st.units)) host.support.splice(idx, 1);
  const dur = travelTime(w, host, home, send, st.ownerId, true);
  const c: Command = {
    id: w.nextId++, kind: 'return', ownerId: st.ownerId, fromVid: fromVid, toVid: fromVid, origin: hostVid,
    units: send, depart: w.now, arrive: w.now + dur,
  };
  addCommand(w, c);
  pushEvent(w, 'arrive', c.arrive, c.id);
  return { ok: true };
}

export function sendResources(w: World, playerId: number, fromVid: number, toVid: number, goods: Res): ActionResult {
  const from = w.villages[fromVid];
  const to = w.villages[toVid];
  if (!from || from.ownerId !== playerId) return { ok: false, error: 'That is not your village.' };
  if (!to || to.id === from.id) return { ok: false, error: 'Choose another village.' };
  if (to.ownerId === null) return { ok: false, error: 'Barbarians do not trade.' };
  updateVillage(w, from, w.now);
  const amount: Res = res(Math.floor(goods.wood), Math.floor(goods.clay), Math.floor(goods.iron));
  for (const k of RES_KEYS) {
    if (amount[k] < 0) return { ok: false, error: 'Invalid amount.' };
    if (amount[k] > from.res[k] + 1e-6) return { ok: false, error: `Not enough ${k}.` };
  }
  const total = resSum(amount);
  if (total <= 0) return { ok: false, error: 'Enter an amount to send.' };
  const needed = Math.ceil(total / MERCHANT_CARRY);
  const free = merchantCount(from.buildings.market, from.bonus) - from.merchantsOut;
  if (needed > free) return { ok: false, error: `You need ${needed} merchants but only ${free} are available.` };
  for (const k of RES_KEYS) from.res[k] -= amount[k];
  from.merchantsOut += needed;
  const dur = merchantTime(w, from, to);
  const c: Command = {
    id: w.nextId++, kind: 'trade', ownerId: playerId, fromVid, toVid, units: {}, res: amount, merchants: needed,
    depart: w.now, arrive: w.now + dur,
  };
  addCommand(w, c);
  pushEvent(w, 'arrive', c.arrive, c.id);
  return { ok: true };
}

// ---------- arrival ----------

export function handleArrival(w: World, cid: number, hooks: ArrivalHooks): void {
  const c = w.commands[cid];
  if (!c || c.arrive > w.now) return; // cancelled or stale
  removeCommand(w, c);
  switch (c.kind) {
    case 'attack': resolveAttack(w, c, hooks); break;
    case 'support': arriveSupport(w, c); break;
    case 'return': arriveHome(w, c, hooks); break;
    case 'trade': arriveTrade(w, c); break;
    case 'tradeback': {
      const home = w.villages[c.fromVid];
      if (home) home.merchantsOut = Math.max(0, home.merchantsOut - (c.merchants ?? 0));
      break;
    }
  }
}

export interface ArrivalHooks {
  onConquest(w: World, v: Village, oldOwner: number | null, newOwner: number): void;
  onBattle(w: World, c: Command, target: Village, data: BattleData): void;
  onReturn(w: World, c: Command): void;
}

function unitsLostReport(w: World, c: Command, why: string) {
  const p = w.players[c.ownerId];
  if (!p) return;
  p.stats.lostUnits += unitsCount(c.units);
  addReport(w, c.ownerId, { kind: 'lost', title: 'Troops lost', color: 'red', text: why });
}

function arriveSupport(w: World, c: Command): void {
  const to = w.villages[c.toVid];
  const home = w.villages[c.fromVid];
  const expectedOwner = c.targetOwner;
  if (!to || to.ownerId === null || (expectedOwner !== undefined && to.ownerId !== expectedOwner)) {
    // the village changed hands while the troops were marching: turn around
    if (!home) return;
    const back: Command = {
      id: w.nextId++, kind: 'return', ownerId: c.ownerId, fromVid: c.fromVid, toVid: c.fromVid, origin: c.toVid,
      units: c.units, depart: w.now, arrive: w.now + (w.now - c.depart),
    };
    addCommand(w, back);
    pushEvent(w, 'arrive', back.arrive, back.id);
    return;
  }
  updateVillage(w, to, w.now);
  let st = to.support.find((s) => s.fromVid === c.fromVid && s.ownerId === c.ownerId);
  if (!st) {
    st = { fromVid: c.fromVid, ownerId: c.ownerId, units: {} };
    to.support.push(st);
  }
  addUnits(st.units, c.units);
  if (to.ownerId !== c.ownerId) {
    addReport(w, c.ownerId, {
      kind: 'support', color: 'blue', vid: to.id,
      title: `Your support reached ${to.name} (${to.x}|${to.y})`,
      text: `${unitsCount(c.units)} troops are now defending ${playerName(w, to.ownerId)}.`,
    });
    addReport(w, to.ownerId, {
      kind: 'support', color: 'blue', vid: to.id,
      title: `${playerName(w, c.ownerId)} sent support to ${to.name}`,
      text: `${unitsCount(c.units)} troops arrived to defend your village.`,
    });
  }
}

function arriveHome(w: World, c: Command, hooks: ArrivalHooks): void {
  const home = w.villages[c.fromVid];
  if (!home || home.ownerId !== c.ownerId) {
    unitsLostReport(w, c, 'Your troops came home to find the village in enemy hands and scattered.');
    return;
  }
  updateVillage(w, home, w.now);
  addUnits(home.units, c.units);
  home.outPop = Math.max(0, home.outPop - unitsPop(c.units));
  if (c.res) {
    const cap = storageOf(home);
    for (const k of RES_KEYS) home.res[k] = Math.min(cap, Math.max(home.res[k], home.res[k] + c.res[k]));
  }
  hooks.onReturn(w, c);
}

function arriveTrade(w: World, c: Command): void {
  const to = w.villages[c.toVid];
  const from = w.villages[c.fromVid];
  if (to && c.res) {
    updateVillage(w, to, w.now);
    const cap = storageOf(to);
    for (const k of RES_KEYS) to.res[k] = Math.min(cap, Math.max(to.res[k], to.res[k] + c.res[k]));
    const total = resSum(c.res);
    if (to.ownerId !== c.ownerId) {
      addReport(w, to.ownerId, {
        kind: 'trade', color: 'grey', vid: to.id, res: c.res,
        title: `${playerName(w, c.ownerId)} delivered ${total.toLocaleString()} resources to ${to.name}`,
      });
    }
    addReport(w, c.ownerId, {
      kind: 'trade', color: 'grey', vid: to.id, res: c.res,
      title: `Merchants delivered ${total.toLocaleString()} resources to ${to.name}`,
      read: to.ownerId === c.ownerId,
    });
  }
  if (from) {
    const back: Command = {
      id: w.nextId++, kind: 'tradeback', ownerId: c.ownerId, fromVid: c.fromVid, toVid: c.fromVid, origin: c.toVid,
      units: {}, merchants: c.merchants, depart: w.now, arrive: w.now + (c.arrive - c.depart),
    };
    addCommand(w, back);
    pushEvent(w, 'arrive', back.arrive, back.id);
  }
}

// ---------- battle ----------

interface StackRef {
  units: Units;
  tech: Units;
  ownerId: number | null;
  fromVid: number;
  home: boolean;
}

function unitsOutsideOf(w: World, v: Village): Units {
  const out: Units = {};
  for (const c of commandsFrom(w, v.id)) {
    if (c.ownerId === v.ownerId && (c.kind === 'attack' || c.kind === 'support' || c.kind === 'return')) {
      addUnits(out, c.units);
    }
  }
  for (const id in w.villages) {
    for (const s of w.villages[id].support) if (s.fromVid === v.id && s.ownerId === v.ownerId) addUnits(out, s.units);
  }
  for (const run of v.scavenge) if (run) addUnits(out, run.units);
  return out;
}

function pickCatTarget(w: World, v: Village, wanted: BuildingId | undefined): BuildingId {
  if (wanted && v.buildings[wanted] > BUILDINGS[wanted].min) return wanted;
  if (wanted) return wanted;
  const options = BUILDING_ORDER.filter((b) => v.buildings[b] > BUILDINGS[b].min && b !== 'rally');
  if (options.length === 0) return 'main';
  return options[Math.floor(nextRandom(w) * options.length)];
}

export function updateIntel(w: World, p: Player, vid: number, patch: Partial<Intel>): void {
  const cur = p.intel[vid] ?? { t: w.now };
  p.intel[vid] = { ...cur, ...patch, t: w.now };
}

function resolveAttack(w: World, c: Command, hooks: ArrivalHooks): void {
  const target = w.villages[c.toVid];
  const home = w.villages[c.fromVid];
  const attacker = w.players[c.ownerId];
  if (!target || !attacker) return;
  updateVillage(w, target, w.now);
  if (target.ownerId === c.ownerId) {
    // the village became ours while we marched: the troops simply station there
    arriveSupport(w, { ...c, kind: 'support' } as Command);
    return;
  }
  const defender = target.ownerId !== null ? w.players[target.ownerId] : null;

  const stacks: StackRef[] = [
    { units: target.units, tech: target.tech, ownerId: target.ownerId, fromVid: target.id, home: true },
    ...target.support.map((s) => ({
      units: s.units, tech: w.villages[s.fromVid]?.tech ?? {}, ownerId: s.ownerId, fromVid: s.fromVid, home: false,
    })),
  ];
  const attItem = equippedItem(w, c.ownerId, c.units);
  const defItems: ItemDef[] = [];
  for (const st of stacks) {
    const it = equippedItem(w, st.ownerId, st.units);
    if (it) defItems.push(it);
  }

  const luck = (nextRandom(w) * 2 - 1) * w.config.luck;
  const morale = w.config.morale && defender ? moraleFor(defender.points, attacker.points) : 1;
  const catTarget = c.units.catapult ? pickCatTarget(w, target, c.catTarget) : undefined;
  const wallBefore = target.buildings.wall;

  const result = resolveBattle({
    att: c.units,
    attTech: home?.tech ?? {},
    attItem,
    defStacks: stacks.map((s): DefStackInput => ({ units: s.units, tech: s.tech })),
    defItems,
    wall: wallBefore,
    luck,
    morale,
    catTargetLevel: catTarget ? target.buildings[catTarget] : undefined,
    catTargetMin: catTarget ? BUILDINGS[catTarget].min : undefined,
    catTargetIsWall: catTarget === 'wall',
  });

  // snapshot defender army for reports before applying losses
  const defUnitsTotal: Units = {};
  const defLostTotal: Units = {};
  stacks.forEach((st, i) => {
    addUnits(defUnitsTotal, st.units);
    addUnits(defLostTotal, result.defLost[i]);
  });
  const defUnitsHome = cloneUnits(target.units);

  // apply defender losses
  stacks.forEach((st, i) => {
    const lost = result.defLost[i];
    if (!hasUnits(lost)) return;
    addUnits(st.units, lost, -1);
    if (!st.home) {
      const sh = w.villages[st.fromVid];
      if (sh && sh.ownerId === st.ownerId) sh.outPop = Math.max(0, sh.outPop - unitsPop(lost));
    }
    if (lost.paladin && st.ownerId !== null) {
      const pal = w.players[st.ownerId]?.paladin;
      if (pal) pal.vid = null;
    }
  });
  target.support = target.support.filter((s) => hasUnits(s.units));

  // attacker losses reduce the home village's away-population
  if (home && home.ownerId === c.ownerId) home.outPop = Math.max(0, home.outPop - unitsPop(result.attLost));
  if (result.attLost.paladin && attacker.paladin) attacker.paladin.vid = null;

  // stats (ODA/ODD style: population of defeated units)
  const defLostPop = unitsPop(defLostTotal);
  const attLostPop = unitsPop(result.attLost);
  attacker.stats.killsAtt += defLostPop;
  attacker.stats.lostUnits += unitsCount(result.attLost);
  bumpDaily(w, attacker, 'attacker', defLostPop);
  // the kills are shared by everyone who stood in the village, by their part in the fight
  const shareOf = (i: number) => (defLostPop > 0 ? unitsPop(result.defLost[i] ?? {}) / defLostPop : i === 0 ? 1 : 0);
  if (defender) {
    const mine = Math.round(attLostPop * shareOf(0));
    defender.stats.killsDef += mine;
    defender.stats.lostUnits += unitsCount(result.defLost[0] ?? {});
    bumpDaily(w, defender, 'defender', mine);
  }
  stacks.slice(1).forEach((st, i) => {
    if (st.ownerId === null) return;
    const sp = w.players[st.ownerId];
    if (!sp) return;
    const part = Math.round(attLostPop * shareOf(i + 1));
    if (st.ownerId === target.ownerId) {
      sp.stats.killsDef += part;
      bumpDaily(w, sp, 'defender', part);
    } else {
      sp.stats.killsSup = (sp.stats.killsSup ?? 0) + part;
      bumpDaily(w, sp, 'supporter', part);
    }
  });

  // siege
  let wallChange: BattleData['wall'];
  if (result.wallAfter !== wallBefore) {
    target.buildings.wall = result.wallAfter;
    shiftQueuedLevels(target, 'wall', wallBefore - result.wallAfter);
    wallChange = { before: wallBefore, after: result.wallAfter };
  } else if (wallBefore > 0) wallChange = { before: wallBefore, after: wallBefore };
  let buildingChange: BattleData['building'];
  if (catTarget && catTarget !== 'wall') {
    const before = target.buildings[catTarget];
    const after = before - result.catLevelsDestroyed;
    target.buildings[catTarget] = after;
    if (result.catLevelsDestroyed > 0) shiftQueuedLevels(target, catTarget, result.catLevelsDestroyed);
    buildingChange = { id: catTarget, before, after };
  }
  if (wallChange || buildingChange) refreshPoints(w, target);

  const survivors = result.attSurvivors;

  // a paladin lays hands on his side's fallen: a share of them get back up (heroes and noblemen excepted)
  let healed: BattleData['healed'];
  if (!result.pureScout) {
    const heal = (lost: Units): Units => {
      const back: Units = {};
      for (const k in lost) {
        const u = k as UnitId;
        if (isHero(u) || u === 'noble' || u === 'scout') continue;
        const n = Math.floor((lost[u] ?? 0) * HERO_POWERS.layOnHands);
        if (n > 0) back[u] = n;
      }
      return back;
    };
    if ((c.units.paladin ?? 0) > 0 && (survivors.paladin ?? 0) > 0) {
      const back = heal(result.attLost);
      if (hasUnits(back)) {
        addUnits(survivors, back);
        if (home && home.ownerId === c.ownerId) home.outPop += unitsPop(back);
        healed = { side: 'attacker', n: unitsCount(back) };
      }
    } else {
      stacks.forEach((st, i) => {
        if (healed || (st.units.paladin ?? 0) <= 0) return;
        const back = heal(result.defLost[i] ?? {});
        if (!hasUnits(back)) return;
        addUnits(st.units, back);
        if (!st.home) { const sh = w.villages[st.fromVid]; if (sh && sh.ownerId === st.ownerId) sh.outPop += unitsPop(back); }
        healed = { side: 'defender', n: unitsCount(back) };
      });
    }
  }

  // a necromancer on the winning side raises one in ten fallen enemy foot soldiers as skeleton spearmen
  let risen: BattleData['risen'];
  if (!result.pureScout) {
    const fallen = (u: Units) => RAISABLE.reduce((n, k) => n + (u[k] ?? 0), 0);
    const share = (lantern: boolean) => HERO_POWERS.raise * (lantern ? 2 : 1);
    if (result.winner === 'attacker' && (survivors.necromancer ?? 0) > 0 && home && home.ownerId === c.ownerId) {
      const n = Math.min(Math.floor(fallen(defLostTotal) * share(attItem?.special === 'raise')), Math.max(0, popFree(home)));
      if (n > 0) {
        survivors.spear = (survivors.spear ?? 0) + n;
        home.outPop += n * UNITS.spear.pop;
        risen = { side: 'attacker', n };
      }
    } else if (result.winner === 'defender') {
      const st = stacks.find((x) => (x.units.necromancer ?? 0) > 0 && x.ownerId !== null);
      const master = st ? (st.home ? target : w.villages[st.fromVid]) : undefined;
      if (st && master && master.ownerId === st.ownerId) {
        const lantern = equippedItem(w, st.ownerId, st.units)?.special === 'raise';
        const n = Math.min(Math.floor(fallen(result.attLost) * share(lantern)), Math.max(0, popFree(master)));
        if (n > 0) {
          st.units.spear = (st.units.spear ?? 0) + n;
          if (!st.home) master.outPop += n * UNITS.spear.pop;
          risen = { side: 'defender', n };
        }
      }
    }
  }

  // loot
  let loot: Res | undefined;
  let capacity = 0;
  if (result.winner === 'attacker' && !result.pureScout) {
    const lootBonus = (attItem?.special === 'loot' ? 1.2 : 1) * ((survivors.goblin ?? 0) > 0 ? 1 + HERO_POWERS.plunder : 1);
    capacity = Math.floor(unitsCarry(survivors) * lootBonus);
    const hidden = target.ownerId !== null ? hideCap(target.buildings.hiding) : 0;
    const avail = res(
      Math.max(0, target.res.wood - hidden), Math.max(0, target.res.clay - hidden), Math.max(0, target.res.iron - hidden),
    );
    loot = computeLoot(avail, capacity);
    for (const k of RES_KEYS) target.res[k] -= loot[k];
    attacker.stats.loot += resSum(loot);
    bumpDaily(w, attacker, 'looter', resSum(loot));
  }

  // loyalty
  let loyaltyChange: BattleData['loyalty'];
  let conquered = false;
  if (result.winner === 'attacker' && (survivors.noble ?? 0) > 0) {
    const before = Math.floor(target.loyalty);
    let drop = 0;
    for (let i = 0; i < survivors.noble!; i++) drop += randInt(w, 20, 35) + (attItem?.special === 'loyalty' ? 10 : 0);
    const after = before - drop;
    if (after <= 0) {
      conquered = true;
      loyaltyChange = { before, after: 0 };
    } else {
      target.loyalty = after;
      target.loyaltyAt = w.now;
      loyaltyChange = { before, after };
    }
  }

  // scouting
  let scout: BattleData['scout'];
  const scoutRatio = result.scoutsSent > 0 ? result.scoutsSurvived / result.scoutsSent : 0;
  const owl = attItem?.special === 'scout';
  if (result.scoutsSurvived > 0) {
    scout = { res: res(Math.floor(target.res.wood), Math.floor(target.res.clay), Math.floor(target.res.iron)) };
    if (target.ownerId !== null) {
      const hc = hideCap(target.buildings.hiding);
      scout.hidden = res(Math.min(hc, scout.res!.wood), Math.min(hc, scout.res!.clay), Math.min(hc, scout.res!.iron));
    }
    if (scoutRatio >= 0.5 || owl) scout.buildings = { ...target.buildings };
    if (scoutRatio >= 0.75 || owl) scout.unitsOutside = unitsOutsideOf(w, target);
    attacker.stats.scouted++;
  }

  // what the attacker learns about the defenders
  const attackerSees = result.pureScout ? result.scoutsSurvived > 0 : result.winner === 'attacker';

  const data: BattleData = {
    attacker: sideInfo(w, home ?? target, c.ownerId),
    defender: sideInfo(w, target),
    luck,
    morale,
    attUnits: cloneUnits(c.units),
    attLost: cloneUnits(result.attLost),
    defUnits: attackerSees ? cloneUnits(defUnitsTotal) : undefined,
    defLost: attackerSees ? cloneUnits(defLostTotal) : undefined,
    winner: result.winner,
    wall: wallChange,
    building: buildingChange,
    loot,
    capacity: loot ? capacity : undefined,
    loyalty: loyaltyChange,
    conquered,
    scout,
    paladinItem: attItem?.id,
    militia: (defUnitsHome.militia ?? 0) > 0,
    risen,
    healed,
    effects: result.effects,
  };
  if (home) data.attacker = { ...sideInfo(w, home, c.ownerId) };

  // attacker report
  const attLostAny = hasUnits(result.attLost);
  let attColor: ReportColor;
  if (result.pureScout) attColor = result.winner === 'attacker' ? 'blue' : 'red';
  else attColor = result.winner === 'defender' ? 'red' : attLostAny ? 'yellow' : 'green';
  const tName = `${target.name} (${target.x}|${target.y})`;
  const verb = result.pureScout ? 'scouts' : 'attacks';
  addReport(w, c.ownerId, {
    kind: 'attack', color: attColor, vid: target.id, battle: data,
    title: conquered
      ? `${data.attacker.vname} conquers ${tName}!`
      : `${data.attacker.vname} ${verb} ${tName}`,
  });

  // defender report (defender always sees the attacking army)
  if (defender) {
    const full: BattleData = { ...data, defUnits: cloneUnits(defUnitsTotal), defLost: cloneUnits(defLostTotal), scout: undefined };
    const defColor: ReportColor = result.winner === 'attacker' ? 'red' : hasUnits(defLostTotal) ? 'yellow' : 'green';
    addReport(w, defender.id, {
      kind: 'defense', color: result.pureScout ? (result.winner === 'attacker' ? 'yellow' : 'green') : defColor,
      vid: target.id, battle: full,
      title: result.pureScout
        ? `${tName} was scouted by ${attacker.name}`
        : conquered ? `${tName} has fallen to ${attacker.name}!` : `${attacker.name} attacks ${tName}`,
    });
  }
  // support owners who were caught in the battle
  const notified = new Set<number>();
  stacks.slice(1).forEach((st, i) => {
    if (st.ownerId === null || st.ownerId === target.ownerId || notified.has(st.ownerId)) return;
    notified.add(st.ownerId);
    const lost = result.defLost[i + 1];
    addReport(w, st.ownerId, {
      kind: 'support', color: hasUnits(lost) ? (result.winner === 'attacker' ? 'red' : 'yellow') : 'green', vid: target.id,
      title: `Your support in ${tName} was attacked`,
      battle: { ...data, defUnits: cloneUnits(defUnitsTotal), defLost: cloneUnits(defLostTotal), scout: undefined },
    });
  });

  // attacker intel
  const intelPatch: Partial<Intel> = {
    lastAttackT: w.now, lastColor: attColor, lastLoot: loot ? resSum(loot) : undefined,
    lastCapacity: loot ? capacity : undefined,
  };
  if (attackerSees) intelPatch.units = cloneUnits(target.units);
  if (scout) {
    intelPatch.scoutT = w.now;
    intelPatch.res = scout.res;
    if (scout.buildings) intelPatch.buildings = scout.buildings;
    intelPatch.units = cloneUnits(target.units);
    for (const s of target.support) addUnits(intelPatch.units, s.units);
  }
  if (scout?.buildings) intelPatch.wall = target.buildings.wall;
  else if (wallChange) intelPatch.wall = wallChange.after;
  else if (result.winner === 'attacker' && !result.pureScout && wallBefore === 0) intelPatch.wall = 0;
  updateIntel(w, attacker, target.id, intelPatch);

  hooks.onBattle(w, c, target, data);

  // survivors
  if (conquered) {
    const oldOwner = target.ownerId;
    conquer(w, target, c.ownerId, hooks);
    const stay = cloneUnits(survivors);
    stay.noble = (stay.noble ?? 0) - 1;
    if (stay.noble <= 0) delete stay.noble;
    if (home && home.ownerId === c.ownerId) home.outPop = Math.max(0, home.outPop - UNITS.noble.pop);
    if (hasUnits(stay)) target.support.push({ fromVid: c.fromVid, ownerId: c.ownerId, units: stay });
    hooks.onConquest(w, target, oldOwner, c.ownerId);
    return;
  }
  if (hasUnits(survivors)) {
    const back: Command = {
      id: w.nextId++, kind: 'return', ownerId: c.ownerId, fromVid: c.fromVid, toVid: c.fromVid, origin: target.id,
      units: survivors, depart: w.now, arrive: w.now + (c.arrive - c.depart), res: loot,
    };
    if (hasUnits(result.attLost)) back.losses = true;
    if (c.repeat) back.repeat = true;
    if (c.tag) back.tag = c.tag;
    if (c.catTarget) back.catTarget = c.catTarget;
    addCommand(w, back);
    pushEvent(w, 'arrive', back.arrive, back.id);
  }
}

/** foot soldiers a necromancer can raise from the dead */
const RAISABLE: UnitId[] = ['spear', 'sword', 'axe', 'archer', 'militia'];

function shiftQueuedLevels(v: Village, b: BuildingId, by: number): void {
  if (by <= 0) return;
  v.buildQueue = v.buildQueue.filter((j) => {
    if (j.building !== b) return true;
    j.level -= by;
    return j.level > v.buildings[b];
  });
}

export function conquer(w: World, v: Village, newOwner: number, hooks?: ArrivalHooks): void {
  const oldOwnerId = v.ownerId;
  const newP = w.players[newOwner];
  if (oldOwnerId !== null) {
    const oldP = w.players[oldOwnerId];
    if (oldP) {
      oldP.villages = oldP.villages.filter((id) => id !== v.id);
      oldP.points -= v.points;
      if (oldP.paladin && oldP.paladin.vid === v.id) oldP.paladin.vid = null;
      if (oldP.villages.length === 0) {
        oldP.eliminated = true;
        news(w, `${oldP.name} has lost their last village and vanished from the realm.`, 'player');
      }
    }
  }
  if (oldOwnerId === null && v.name === 'Barbarian village') v.name = villageName(w);
  v.ownerId = newOwner;
  newP.villages.push(v.id);
  newP.points += v.points;
  newP.stats.conquered++;
  bumpDaily(w, newP, 'conqueror', 1);
  v.buildQueue = [];
  for (const rb in v.recruit) v.recruit[rb as keyof typeof v.recruit] = [];
  v.research = [];
  v.units = {};
  v.support = v.support.filter((s) => s.ownerId === newOwner);
  v.scavenge = [null, null, null, null];
  v.outPop = 0;
  v.merchantsOut = 0;
  v.loyalty = 25;
  v.loyaltyAt = w.now;
  v.militiaUntil = undefined;
  v.foundedAt = w.now;
  w.mapRev++;
  const oldName = playerName(w, oldOwnerId);
  news(w, `${newP.name} conquered ${v.name} (${v.x}|${v.y}) from ${oldName}.`, 'conquest', v.id);
  if (oldOwnerId !== null) {
    addReport(w, oldOwnerId, {
      kind: 'conquest', color: 'red', vid: v.id,
      title: `${v.name} (${v.x}|${v.y}) was conquered by ${newP.name}`,
      text: 'Loyalty fell to zero and the village swore allegiance to a new ruler.',
    });
  }
  addReport(w, newOwner, {
    kind: 'conquest', color: 'green', vid: v.id,
    title: `You conquered ${v.name} (${v.x}|${v.y})!`,
    text: `The village now belongs to you. Loyalty starts at 25 and recovers over time.`,
  });
}

export function ownTroopsAway(w: World, playerId: number): Command[] {
  return commandsOf(w, playerId);
}

export { unitsOutsideOf };
