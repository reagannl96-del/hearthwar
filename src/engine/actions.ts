// Player actions. Every UI (or future network client) goes through `applyAction`,
// which validates everything server-side style, so the same code can back multiplayer.

import { BUILDINGS } from './data/buildings';
import { ITEM_BY_ID, UNITS } from './data/units';
import { cancelCommand, sendResources, sendTrain, sendTroops, withdrawSupport } from './commands';
import { commandsOf } from './cmdindex';
import { pushEvent } from './events';
import {
  COIN_COST, SCAVENGE_TIERS, buildCost, buildPopDelta, buildTime, coinsForNoble, noblesFromCoins, recruitTime,
  res, resGte, researchCost, researchSmithyReq, researchTime, scavengeDuration, scavengeLoot, unitsCarry, unitsPop,
} from './formulas';
import type { ActionResult, BuildingId, RecruitBuilding, Res, UnitId, Units, Village, World } from './types';
import { RES_KEYS } from './types';
import {
  canBuildReq, farmMax, popFree, queuedLevel, rechainRecruit, recruitQueueEnd, storageOf, unitAvailable, updateVillage,
} from './village';
import { claimQuest } from './quests';
import { exchangeQuote } from './market';
import { restartPlayer } from './world';

export type Action =
  | { type: 'build'; vid: number; building: BuildingId }
  | { type: 'demolish'; vid: number; building: BuildingId }
  | { type: 'cancelBuild'; vid: number; job: number }
  | { type: 'recruit'; vid: number; unit: UnitId; count: number }
  | { type: 'cancelRecruit'; vid: number; building: RecruitBuilding; job: number }
  | { type: 'research'; vid: number; unit: UnitId }
  | { type: 'cancelResearch'; vid: number; job: number }
  | { type: 'send'; vid: number; target: number; kind: 'attack' | 'support'; units: Units; catTarget?: BuildingId; repeat?: boolean }
  | { type: 'train'; vid: number; target: number; waves: Units[]; catTarget?: BuildingId }
  | { type: 'cancelCommand'; id: number }
  | { type: 'stopRepeat'; id: number }
  | { type: 'withdraw'; host: number; from: number; units?: Units }
  | { type: 'trade'; vid: number; target: number; res: Res }
  | { type: 'exchange'; vid: number; give: keyof Res; get: keyof Res; amount: number }
  | { type: 'mintCoin'; vid: number; count: number }
  | { type: 'militia'; vid: number }
  | { type: 'rename'; vid: number; name: string }
  | { type: 'equip'; item: string | null }
  | { type: 'scavengeUnlock'; vid: number; tier: number }
  | { type: 'scavenge'; vid: number; tier: number; units: Units }
  | { type: 'claimQuest'; quest: string; vid?: number }
  | { type: 'readReport'; id: number | 'all' }
  | { type: 'deleteReport'; id: number | 'all' | 'read' }
  | { type: 'note'; vid: number; text: string }
  | { type: 'restart'; village: string };

const fail = (error: string): ActionResult => ({ ok: false, error });

function ownVillage(w: World, pid: number, vid: number): Village | null {
  const v = w.villages[vid];
  if (!v || v.ownerId !== pid) return null;
  updateVillage(w, v, w.now);
  return v;
}

function pay(v: Village, cost: Res): boolean {
  if (!resGte(v.res, cost)) return false;
  for (const k of RES_KEYS) v.res[k] -= cost[k];
  return true;
}

function refund(v: Village, cost: Res, ratio: number): void {
  const cap = storageOf(v);
  for (const k of RES_KEYS) v.res[k] = Math.min(cap, v.res[k] + cost[k] * ratio);
}

export function buildQueueSlots(v: Village): number {
  return 3 + (v.buildings.main >= 10 ? 1 : 0) + (v.buildings.main >= 20 ? 1 : 0);
}

export function missingResources(v: Village, cost: Res): Res {
  return res(
    Math.max(0, cost.wood - v.res.wood), Math.max(0, cost.clay - v.res.clay), Math.max(0, cost.iron - v.res.iron),
  );
}

export interface BuildCheck {
  ok: boolean;
  reason?: string;
  level: number;
  cost: Res;
  time: number;
  pop: number;
}

export function checkBuild(w: World, v: Village, b: BuildingId): BuildCheck {
  const d = BUILDINGS[b];
  const next = queuedLevel(v, b) + 1;
  const cost = next <= d.max ? buildCost(b, next) : res();
  const time = next <= d.max ? buildTime(b, next, v.buildings.main, w.config.speed) : 0;
  const pop = next <= d.max ? buildPopDelta(b, next) : 0;
  const base = { level: next, cost, time, pop };
  if (next > d.max) return { ...base, ok: false, reason: 'Fully upgraded.' };
  const req = canBuildReq(v, b);
  if (!req.ok) {
    const [rb, rl] = req.missing[0];
    return { ...base, ok: false, reason: `Requires ${BUILDINGS[rb].name} level ${rl}.` };
  }
  if (v.buildQueue.length >= buildQueueSlots(v)) return { ...base, ok: false, reason: 'The construction queue is full.' };
  if (b !== 'farm' && pop > popFree(v)) return { ...base, ok: false, reason: 'Not enough population — upgrade the farm.' };
  const cap = storageOf(v);
  if (cost.wood > cap || cost.clay > cap || cost.iron > cap) return { ...base, ok: false, reason: 'Your warehouse is too small.' };
  if (!resGte(v.res, cost)) return { ...base, ok: false, reason: 'Not enough resources.' };
  return { ...base, ok: true };
}

function build(w: World, pid: number, vid: number, b: BuildingId): ActionResult {
  const v = ownVillage(w, pid, vid);
  if (!v) return fail('That is not your village.');
  const chk = checkBuild(w, v, b);
  if (!chk.ok) return fail(chk.reason!);
  pay(v, chk.cost);
  const last = v.buildQueue[v.buildQueue.length - 1];
  const start = last ? last.end : w.now;
  const job = { id: w.nextId++, building: b, level: chk.level, start, end: start + chk.time, cost: chk.cost, pop: chk.pop };
  v.buildQueue.push(job);
  pushEvent(w, 'build', job.end, v.id, job.id);
  return { ok: true, data: job };
}

function demolish(w: World, pid: number, vid: number, b: BuildingId): ActionResult {
  const v = ownVillage(w, pid, vid);
  if (!v) return fail('That is not your village.');
  if (v.buildings.main < 15) return fail('Demolition needs Headquarters level 15.');
  const cur = queuedLevel(v, b);
  if (cur <= BUILDINGS[b].min) return fail('This building cannot be torn down any further.');
  if (v.buildQueue.length >= buildQueueSlots(v)) return fail('The construction queue is full.');
  const last = v.buildQueue[v.buildQueue.length - 1];
  const start = last ? last.end : w.now;
  const time = Math.round(buildTime(b, cur, v.buildings.main, w.config.speed) * 0.5);
  const job = { id: w.nextId++, building: b, level: cur - 1, start, end: start + time, cost: res(), pop: 0, demolish: true };
  v.buildQueue.push(job);
  pushEvent(w, 'build', job.end, v.id, job.id);
  return { ok: true };
}

function cancelBuild(w: World, pid: number, vid: number, jobId: number): ActionResult {
  const v = ownVillage(w, pid, vid);
  if (!v) return fail('That is not your village.');
  const idx = v.buildQueue.findIndex((j) => j.id === jobId);
  if (idx < 0) return fail('Job not found.');
  const job = v.buildQueue[idx];
  // cancelling a level also cancels later levels of the same building
  const removed = v.buildQueue.filter((j, i) => i >= idx && j.building === job.building);
  v.buildQueue = v.buildQueue.filter((j) => !removed.includes(j));
  for (const r of removed) refund(v, r.cost, r.start <= w.now ? 0.9 : 1);
  // re-chain the remaining jobs; they get fresh event ids so the old events go stale
  let t = w.now;
  v.buildQueue.forEach((j, i) => {
    const dur = j.end - j.start;
    if (i === 0 && j.start <= w.now) { t = j.end; return; }
    j.start = t;
    j.end = t + dur;
    t = j.end;
    const newId = w.nextId++;
    j.id = newId;
    pushEvent(w, 'build', j.end, v.id, j.id);
  });
  return { ok: true };
}

export function recruitCheck(w: World, v: Village, u: UnitId, count: number): { ok: boolean; reason?: string; max: number } {
  const av = unitAvailable(w, v, u);
  const d = UNITS[u];
  let max = Infinity;
  for (const k of RES_KEYS) if (d.cost[k] > 0) max = Math.min(max, Math.floor(v.res[k] / d.cost[k]));
  max = Math.min(max, Math.floor(popFree(v) / Math.max(1, d.pop)));
  if (u === 'paladin') {
    const owner = w.players[v.ownerId!];
    const has = hasPaladin(w, v.ownerId!);
    max = has ? 0 : Math.min(max, 1);
    if (has) return { ok: false, reason: 'You already have a paladin.', max: 0 };
    if (!owner) return { ok: false, reason: 'No owner.', max: 0 };
  }
  if (u === 'noble') {
    const info = nobleInfo(w, v.ownerId!);
    max = Math.min(max, info.canTrain);
    if (info.canTrain <= 0) return { ok: false, reason: 'Mint more crowns in the academy to train another nobleman.', max: 0 };
  }
  max = Math.max(0, max);
  if (!av.ok) return { ok: false, reason: av.reason, max: 0 };
  if (count > max) return { ok: false, reason: max === 0 ? (popFree(v) < d.pop ? 'Not enough population — upgrade the farm.' : 'Not enough resources.') : `You can recruit at most ${max}.`, max };
  return { ok: true, max };
}

export function hasPaladin(w: World, pid: number): boolean {
  const pal = w.players[pid].paladin;
  // the paladin's home is cleared when he dies, so a known home means he is alive somewhere
  if (pal && pal.vid !== null) return true;
  for (const vid of w.players[pid].villages) {
    const v = w.villages[vid];
    if ((v.units.paladin ?? 0) > 0) return true;
    if (v.recruit.statue.some((j) => j.unit === 'paladin')) return true;
  }
  return commandsOf(w, pid).some((c) => (c.units.paladin ?? 0) > 0);
}

export function countNobles(w: World, pid: number): number {
  let n = 0;
  const p = w.players[pid];
  for (const vid of p.villages) {
    const v = w.villages[vid];
    n += v.units.noble ?? 0;
    for (const j of v.recruit.academy) n += j.count - j.done;
    // noblemen only ever end up stationed in villages that became ours
    for (const s of v.support) if (s.ownerId === pid) n += s.units.noble ?? 0;
  }
  for (const c of commandsOf(w, pid)) n += c.units.noble ?? 0;
  return n;
}

export function nobleInfo(w: World, pid: number) {
  const p = w.players[pid];
  const used = countNobles(w, pid) + Math.max(0, p.villages.length - 1);
  const allowed = noblesFromCoins(p.coins);
  const nextCoins = coinsForNoble(used + 1);
  return { used, allowed, canTrain: Math.max(0, allowed - used), coins: p.coins, nextCoins, coinsNeeded: Math.max(0, nextCoins - p.coins) };
}

function recruit(w: World, pid: number, vid: number, u: UnitId, count: number): ActionResult {
  const v = ownVillage(w, pid, vid);
  if (!v) return fail('That is not your village.');
  count = Math.floor(count);
  if (!(count > 0)) return fail('Enter how many to recruit.');
  const d = UNITS[u];
  if (!d.building) return fail('This unit cannot be recruited.');
  const chk = recruitCheck(w, v, u, count);
  if (!chk.ok) return fail(chk.reason!);
  const cost = res(d.cost.wood * count, d.cost.clay * count, d.cost.iron * count);
  if (!pay(v, cost)) return fail('Not enough resources.');
  const per = recruitTime(u, v.buildings[d.building], w.config.speed, v.bonus);
  const start = recruitQueueEnd(w, v, d.building);
  v.recruit[d.building].push({ id: w.nextId++, unit: u, count, done: 0, start, per, cost: { ...d.cost } });
  if (u === 'paladin') {
    const p = w.players[pid];
    if (!p.paladin) p.paladin = { name: 'Sir Aldous', items: [], equipped: null, nextItemAt: 0, vid: null };
  }
  return { ok: true };
}

function cancelRecruit(w: World, pid: number, vid: number, rb: RecruitBuilding, jobId: number): ActionResult {
  const v = ownVillage(w, pid, vid);
  if (!v) return fail('That is not your village.');
  const q = v.recruit[rb];
  const idx = q.findIndex((j) => j.id === jobId);
  if (idx < 0) return fail('Job not found.');
  const job = q[idx];
  const left = job.count - job.done;
  refund(v, { wood: job.cost.wood * left, clay: job.cost.clay * left, iron: job.cost.iron * left }, 0.9);
  q.splice(idx, 1);
  rechainRecruit(w, v, rb);
  return { ok: true };
}

export function researchCheck(w: World, v: Village, u: UnitId): { ok: boolean; reason?: string; level: number; cost: Res; time: number } {
  const d = UNITS[u];
  const queued = v.research.filter((j) => j.unit === u).length;
  const level = (v.tech[u] ?? (d.research ? 0 : 1)) + queued + 1;
  const cost = researchCost(u, Math.min(level, 3));
  const time = researchTime(u, Math.min(level, 3), v.buildings.smithy, w.config.speed);
  const base = { level, cost, time };
  if (u === 'paladin' || u === 'noble' || u === 'militia') return { ...base, ok: false, reason: 'Cannot be researched.' };
  if ((u === 'archer' || u === 'marcher') && !w.config.archers) return { ...base, ok: false, reason: 'Archers are disabled.' };
  if (level > 3) return { ...base, ok: false, reason: 'Fully researched.' };
  const smithy = researchSmithyReq(u, level);
  if (v.buildings.smithy < Math.max(1, smithy)) return { ...base, ok: false, reason: `Requires Smithy level ${Math.max(1, smithy)}.` };
  if (level === 1) {
    for (const k in d.req) {
      if (k === 'barracks' || k === 'stable' || k === 'workshop') {
        const need = d.req[k as BuildingId]!;
        if (v.buildings[k as BuildingId] < need) return { ...base, ok: false, reason: `Requires ${BUILDINGS[k as BuildingId].name} level ${need}.` };
      }
    }
  }
  if (v.research.length >= 2) return { ...base, ok: false, reason: 'The smithy is busy (max 2 in queue).' };
  if (!resGte(v.res, cost)) return { ...base, ok: false, reason: 'Not enough resources.' };
  return { ...base, ok: true };
}

function research(w: World, pid: number, vid: number, u: UnitId): ActionResult {
  const v = ownVillage(w, pid, vid);
  if (!v) return fail('That is not your village.');
  const chk = researchCheck(w, v, u);
  if (!chk.ok) return fail(chk.reason!);
  pay(v, chk.cost);
  const last = v.research[v.research.length - 1];
  const start = last ? last.end : w.now;
  const job = { id: w.nextId++, unit: u, level: chk.level, start, end: start + chk.time, cost: chk.cost };
  v.research.push(job);
  pushEvent(w, 'research', job.end, v.id, job.id);
  return { ok: true };
}

function cancelResearch(w: World, pid: number, vid: number, jobId: number): ActionResult {
  const v = ownVillage(w, pid, vid);
  if (!v) return fail('That is not your village.');
  const idx = v.research.findIndex((j) => j.id === jobId);
  if (idx < 0) return fail('Job not found.');
  const removed = v.research.splice(idx);
  for (const r of removed) refund(v, r.cost, r.start <= w.now ? 0.9 : 1);
  return { ok: true };
}

function mintCoin(w: World, pid: number, vid: number, count: number): ActionResult {
  const v = ownVillage(w, pid, vid);
  if (!v) return fail('That is not your village.');
  if (v.buildings.academy < 1) return fail('Build an academy first.');
  count = Math.floor(count);
  if (!(count > 0)) return fail('Enter how many crowns to mint.');
  const cost = res(COIN_COST.wood * count, COIN_COST.clay * count, COIN_COST.iron * count);
  if (!pay(v, cost)) return fail('Not enough resources.');
  w.players[pid].coins += count;
  return { ok: true };
}

function callMilitia(w: World, pid: number, vid: number): ActionResult {
  const v = ownVillage(w, pid, vid);
  if (!v) return fail('That is not your village.');
  if (v.militiaUntil && v.militiaUntil > w.now) return fail('The militia is already standing guard.');
  const n = Math.floor(farmMax(v) * 0.1 + v.buildings.farm * 20);
  v.units.militia = n;
  v.militiaUntil = w.now + Math.round((6 * 3600_000) / w.config.speed);
  return { ok: true, data: n };
}

function rename(w: World, pid: number, vid: number, name: string): ActionResult {
  const v = ownVillage(w, pid, vid);
  if (!v) return fail('That is not your village.');
  const n = name.trim().slice(0, 32);
  if (n.length < 2) return fail('Village names need at least 2 characters.');
  v.name = n;
  w.mapRev++;
  return { ok: true };
}

function equip(w: World, pid: number, item: string | null): ActionResult {
  const p = w.players[pid];
  if (!p.paladin) return fail('Train a paladin first.');
  if (item !== null && !p.paladin.items.includes(item)) return fail('Your paladin has not found that item yet.');
  if (item !== null && !ITEM_BY_ID[item]) return fail('Unknown item.');
  p.paladin.equipped = item;
  return { ok: true };
}

function scavengeUnlock(w: World, pid: number, vid: number, tier: number): ActionResult {
  const v = ownVillage(w, pid, vid);
  if (!v) return fail('That is not your village.');
  if (tier !== v.scavengeUnlocked) return fail('Unlock the previous option first.');
  const t = SCAVENGE_TIERS[tier];
  if (!t) return fail('Unknown option.');
  if (!pay(v, t.cost)) return fail('Not enough resources.');
  v.scavengeUnlocked = tier + 1;
  return { ok: true };
}

function scavenge(w: World, pid: number, vid: number, tier: number, units: Units): ActionResult {
  const v = ownVillage(w, pid, vid);
  if (!v) return fail('That is not your village.');
  if (tier >= v.scavengeUnlocked) return fail('This option is locked.');
  if (v.scavenge[tier]) return fail('Troops are already out on this run.');
  const send: Units = {};
  for (const k in units) {
    const u = k as UnitId;
    const n = Math.floor(units[u] ?? 0);
    if (n <= 0) continue;
    if (u === 'noble' || u === 'militia' || u === 'scout' || u === 'ram' || u === 'catapult') continue;
    if ((v.units[u] ?? 0) < n) return fail(`Not enough ${UNITS[u].plural.toLowerCase()}.`);
    send[u] = n;
  }
  const carry = unitsCarry(send);
  if (carry <= 0) return fail('Choose troops that can carry loot.');
  for (const k in send) v.units[k as UnitId]! -= send[k as UnitId]!;
  for (const k in v.units) if ((v.units[k as UnitId] ?? 0) <= 0) delete v.units[k as UnitId];
  v.outPop += unitsPop(send);
  const lootTotal = scavengeLoot(carry, tier);
  const each = Math.floor(lootTotal / 3);
  const dur = scavengeDuration(carry, tier, w.config.speed);
  v.scavenge[tier] = { tier, units: send, loot: res(each, each, lootTotal - each * 2), start: w.now, end: w.now + dur };
  pushEvent(w, 'scav', w.now + dur, v.id, tier);
  return { ok: true };
}

function exchange(w: World, pid: number, vid: number, give: keyof Res, get: keyof Res, amount: number): ActionResult {
  const v = ownVillage(w, pid, vid);
  if (!v) return fail('That is not your village.');
  if (v.buildings.market < 1) return fail('Build a market first.');
  if (give === get) return fail('Pick two different resources.');
  amount = Math.floor(amount);
  if (!(amount > 0)) return fail('Enter an amount.');
  if (v.res[give] < amount) return fail(`Not enough ${give}.`);
  const q = exchangeQuote(w, v, give, get, amount);
  if (amount > q.maxAmount) return fail(`Your merchants can only haul ${q.maxAmount.toLocaleString()} right now.`);
  if (q.receive <= 0) return fail('The trading post will not take that deal.');
  const cap = storageOf(v);
  v.res[give] -= amount;
  v.res[get] = Math.min(cap, v.res[get] + q.receive);
  w.exchange[give] += amount;
  w.exchange[get] = Math.max(0, w.exchange[get] - q.receive);
  return { ok: true, data: q.receive };
}

export function applyAction(w: World, pid: number, a: Action): ActionResult {
  const p = w.players[pid];
  if (!p) return fail('Unknown player.');
  switch (a.type) {
    case 'build': return build(w, pid, a.vid, a.building);
    case 'demolish': return demolish(w, pid, a.vid, a.building);
    case 'cancelBuild': return cancelBuild(w, pid, a.vid, a.job);
    case 'recruit': return recruit(w, pid, a.vid, a.unit, a.count);
    case 'cancelRecruit': return cancelRecruit(w, pid, a.vid, a.building, a.job);
    case 'research': return research(w, pid, a.vid, a.unit);
    case 'cancelResearch': return cancelResearch(w, pid, a.vid, a.job);
    case 'send': return sendTroops(w, { ownerId: pid, fromVid: a.vid, toVid: a.target, kind: a.kind, units: a.units, catTarget: a.catTarget, repeat: a.repeat });
    case 'train': return sendTrain(w, pid, a.vid, a.target, a.waves, a.catTarget);
    case 'cancelCommand': return cancelCommand(w, pid, a.id);
    case 'stopRepeat': {
      const c = w.commands[a.id];
      if (!c || c.ownerId !== pid) return fail('Command not found.');
      c.repeat = false;
      return { ok: true };
    }
    case 'withdraw': return withdrawSupport(w, pid, a.host, a.from, a.units);
    case 'trade': return sendResources(w, pid, a.vid, a.target, a.res);
    case 'exchange': return exchange(w, pid, a.vid, a.give, a.get, a.amount);
    case 'mintCoin': return mintCoin(w, pid, a.vid, a.count);
    case 'militia': return callMilitia(w, pid, a.vid);
    case 'rename': return rename(w, pid, a.vid, a.name);
    case 'equip': return equip(w, pid, a.item);
    case 'scavengeUnlock': return scavengeUnlock(w, pid, a.vid, a.tier);
    case 'scavenge': return scavenge(w, pid, a.vid, a.tier, a.units);
    case 'claimQuest': return claimQuest(w, pid, a.quest, a.vid);
    case 'readReport': {
      for (const r of p.reports) if (a.id === 'all' || r.id === a.id) r.read = true;
      return { ok: true };
    }
    case 'deleteReport': {
      p.reports = p.reports.filter((r) => !(a.id === 'all' || (a.id === 'read' && r.read) || r.id === a.id));
      return { ok: true };
    }
    case 'restart': {
      if (p.kind !== 'human') return fail('Only rulers can start over.');
      const v = restartPlayer(w, pid, String(a.village ?? ''));
      return v ? { ok: true, data: v.id } : fail('There is no room left in the realm.');
    }
    case 'note': {
      const text = a.text.slice(0, 500);
      if (text.trim()) p.notes[a.vid] = text; else delete p.notes[a.vid];
      return { ok: true };
    }
  }
  return fail('Unknown action.');
}
