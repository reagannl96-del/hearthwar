// Computer rulers. They play by exactly the same rules as the human: every
// decision goes through applyAction / sendTroops, and they only know what their
// own scouting reports and battles told them.

import { applyAction, buildQueueSlots, checkBuild, nobleInfo, recruitCheck, researchCheck } from '../actions';
import { resolveBattle } from '../combat';
import { isProtected, sendTrain, sendTroops } from '../commands';
import { BUILDINGS, BUILDING_ORDER } from '../data/buildings';
import { UNITS } from '../data/units';
import { COIN_COST, distance, hasUnits, recruitTime, resGte, unitsCount } from '../formulas';
import { nextRandom } from '../rng';
import { villagesNear } from '../spatial';
import { exchangeQuote } from '../market';
import { commandsTo } from '../cmdindex';
import type { BattleData, BuildingId, Command, Player, Res, UnitId, Units, Village, World } from '../types';
import { RES_KEYS } from '../types';
import { farmMax, popFree, queuedLevel, recruitQueueEnd, storageOf, unitAvailable, updateVillage } from '../village';
import { aiThinkInterval } from '../world';

type P = NonNullable<Player['ai']>['personality'];

// ---------- build plans ----------

const BASE_PLAN: [BuildingId, number][] = [
  ['timber', 1], ['claypit', 1], ['ironmine', 1], ['timber', 2], ['claypit', 2], ['main', 2], ['timber', 3], ['claypit', 3],
  ['ironmine', 2], ['main', 3], ['barracks', 1], ['rally', 1], ['farm', 2], ['warehouse', 2], ['timber', 4], ['claypit', 4],
  ['ironmine', 3], ['warehouse', 3], ['farm', 3], ['timber', 5], ['claypit', 5], ['ironmine', 5], ['main', 5], ['smithy', 1],
  ['wall', 1], ['barracks', 3], ['warehouse', 5], ['farm', 5], ['timber', 8], ['claypit', 8], ['ironmine', 6], ['hiding', 2],
  ['smithy', 3], ['main', 8], ['market', 1], ['warehouse', 8], ['farm', 8], ['timber', 10], ['claypit', 10], ['ironmine', 10],
  ['barracks', 5], ['smithy', 5], ['main', 10], ['stable', 3], ['wall', 5], ['warehouse', 10], ['farm', 10], ['timber', 15],
  ['claypit', 15], ['ironmine', 12], ['stable', 5], ['smithy', 10], ['main', 15], ['warehouse', 15], ['farm', 15],
  ['workshop', 1], ['barracks', 10], ['wall', 10], ['timber', 20], ['claypit', 20], ['ironmine', 18], ['market', 5],
  ['main', 20], ['smithy', 15], ['stable', 10], ['warehouse', 20], ['farm', 20], ['smithy', 20], ['market', 10],
  ['academy', 1], ['statue', 1], ['barracks', 15], ['stable', 15], ['wall', 15], ['timber', 25], ['claypit', 25],
  ['ironmine', 25], ['warehouse', 25], ['farm', 25], ['workshop', 5], ['main', 25], ['barracks', 20], ['stable', 20],
  ['wall', 20], ['timber', 30], ['claypit', 30], ['ironmine', 30], ['warehouse', 30], ['farm', 30], ['main', 30],
  ['barracks', 25], ['market', 20], ['watchtower', 5], ['hiding', 10], ['workshop', 10],
];

const planCache: Partial<Record<P, [BuildingId, number][]>> = {};
function planFor(pers: P): [BuildingId, number][] {
  if (planCache[pers]) return planCache[pers]!;
  let plan = [...BASE_PLAN];
  if (pers === 'turtle') {
    plan.splice(30, 0, ['wall', 5], ['barracks', 5]);
    plan.splice(50, 0, ['wall', 12]);
  } else if (pers === 'warlord') {
    plan.splice(26, 0, ['barracks', 5]);
    plan.splice(44, 0, ['stable', 5], ['barracks', 10]);
  } else if (pers === 'expander') {
    // rush the academy a little
    const idx = plan.findIndex(([b, l]) => b === 'academy' && l === 1);
    const aca = plan.splice(idx, 1)[0];
    plan.splice(Math.max(0, idx - 10), 0, aca);
  }
  planCache[pers] = plan;
  return plan;
}

const RESEARCH: Record<P, UnitId[]> = {
  warlord: ['axe', 'scout', 'light', 'ram', 'marcher', 'catapult', 'heavy', 'sword', 'spear'],
  farmer: ['axe', 'scout', 'light', 'sword', 'heavy', 'ram', 'spear'],
  turtle: ['sword', 'archer', 'scout', 'heavy', 'axe', 'light', 'ram', 'spear', 'sword'],
  expander: ['axe', 'sword', 'scout', 'light', 'ram', 'heavy', 'catapult', 'spear'],
};

/** desired share of army population per unit */
const ARMY: Record<P, Partial<Record<UnitId, number>>> = {
  warlord: { spear: 0.08, axe: 0.45, scout: 0.04, light: 0.3, marcher: 0.06, ram: 0.05, catapult: 0.02 },
  farmer: { spear: 0.25, sword: 0.1, axe: 0.2, scout: 0.04, light: 0.35, heavy: 0.06 },
  turtle: { spear: 0.35, sword: 0.3, archer: 0.12, scout: 0.04, heavy: 0.15, light: 0.04 },
  expander: { spear: 0.2, sword: 0.15, axe: 0.25, scout: 0.04, light: 0.25, ram: 0.04, heavy: 0.07 },
};

const TROOP_SHARE: Record<P, number> = { warlord: 0.65, farmer: 0.5, turtle: 0.55, expander: 0.45 };

const OFFENSIVE: UnitId[] = ['axe', 'light', 'marcher', 'heavy', 'ram', 'catapult'];
const RAIDERS: UnitId[] = ['light', 'marcher', 'axe', 'spear', 'heavy'];

// ---------- main entry ----------

export function aiThink(w: World, p: Player): void {
  const ai = p.ai!;
  const incoming = incomingIndex(w, p);
  for (const vid of [...p.villages]) {
    const v = w.villages[vid];
    if (!v || v.ownerId !== p.id) continue;
    updateVillage(w, v, w.now);
    defend(w, p, v, incoming.get(v.id));
    trade(w, p, v);
    build(w, p, v);
    research(w, p, v);
    nobles(w, p, v);
    recruit(w, p, v);
    farm(w, p, v);
    scavenge(w, p, v);
  }
  const period = aiThinkInterval(w) * 4;
  if (w.now - ai.lastWarCheck >= period) {
    ai.lastWarCheck = w.now;
    war(w, p);
  }
  conquestDrive(w, p);
  // forget stale farm memory
  if (nextRandom(w) < 0.05) {
    for (const k in ai.memory) if (ai.memory[k] < w.now - 30 * aiThinkInterval(w)) delete ai.memory[k];
  }
}

function incomingIndex(w: World, p: Player): Map<number, Command[]> {
  const m = new Map<number, Command[]>();
  for (const vid of p.villages) {
    const list = commandsTo(w, vid).filter((c) => c.kind === 'attack' && c.ownerId !== p.id);
    if (list.length) m.set(vid, list);
  }
  return m;
}

// ---------- building ----------

function build(w: World, p: Player, v: Village): void {
  const slots = Math.min(buildQueueSlots(v), 3);
  for (let guard = 0; guard < 3 && v.buildQueue.length < slots; guard++) {
    const b = chooseBuild(w, p, v);
    if (!b) return;
    if (!applyAction(w, p.id, { type: 'build', vid: v.id, building: b }).ok) return;
  }
}

function chooseBuild(w: World, p: Player, v: Village): BuildingId | null {
  const cap = storageOf(v);
  const fullish = RES_KEYS.some((k) => v.res[k] > cap * 0.85);
  if (popFree(v) < farmMax(v) * 0.08 && queuedLevel(v, 'farm') < 30) {
    const c = checkBuild(w, v, 'farm');
    if (c.ok) return 'farm';
    if (c.reason?.includes('warehouse') && checkBuild(w, v, 'warehouse').ok) return 'warehouse';
    return null;
  }
  const plan = planFor(p.ai!.personality);
  const unmet: BuildingId[] = [];
  for (const [b, lvl] of plan) {
    if (queuedLevel(v, b) >= lvl) continue;
    if (b === 'statue' && !w.config.paladin) continue;
    if (unmet.includes(b)) continue;
    unmet.push(b);
    if (unmet.length >= 6) break;
  }
  if (unmet.length === 0) {
    // plan finished: upgrade whatever is cheapest
    const opts = BUILDING_ORDER.filter((b) => checkBuild(w, v, b).ok && b !== 'hiding');
    return opts.length ? opts[Math.floor(nextRandom(w) * opts.length)] : null;
  }
  // take the first affordable item among the next few in the plan, so idle
  // resources keep working while the village saves up for bigger projects
  let considered = 0;
  for (let i = 0; i < unmet.length; i++) {
    const b = unmet[i];
    const c = checkBuild(w, v, b);
    if (c.ok) return b;
    if (i === 0 && c.reason === 'Not enough resources.') {
      // whichever resource keeps us waiting: grow its mine
      const short = RES_KEYS.map((k) => ({ k, gap: (c.cost[k] - v.res[k]) / Math.max(1, v.res[k] + 1) }))
        .sort((a, b2) => b2.gap - a.gap)[0].k;
      const mine = short === 'wood' ? 'timber' : short === 'clay' ? 'claypit' : 'ironmine';
      if (queuedLevel(v, mine) < Math.max(queuedLevel(v, 'main') + 6, 12) && checkBuild(w, v, mine).ok) return mine;
    }
    if (c.reason?.includes('population')) return checkBuild(w, v, 'farm').ok ? 'farm' : null;
    if (c.reason?.includes('warehouse')) return checkBuild(w, v, 'warehouse').ok ? 'warehouse' : null;
    if (c.reason?.includes('Requires')) continue; // requirements come later in the plan
    if (c.reason?.includes('queue')) return null;
    if (++considered >= (fullish ? 6 : 4)) break;
  }
  return null;
}

/** resources the next planned building needs; recruiting leaves these alone */
function buildReserve(w: World, p: Player, v: Village): Res {
  const plan = planFor(p.ai!.personality);
  for (const [b, lvl] of plan) {
    if (queuedLevel(v, b) >= lvl) continue;
    const c = checkBuild(w, v, b);
    if (c.reason?.includes('Requires') || c.reason?.includes('queue')) continue;
    return c.cost;
  }
  return { wood: 0, clay: 0, iron: 0 };
}

// ---------- trading post ----------

function trade(w: World, p: Player, v: Village): void {
  if (v.buildings.market < 1) return;
  const cap = storageOf(v);
  const sorted = [...RES_KEYS].sort((a, b) => v.res[b] - v.res[a]);
  const rich = sorted[0], poor = sorted[2];
  if (v.res[rich] < cap * 0.55 || v.res[poor] > cap * 0.25) return;
  // rulers trade with their own merchants at the same 2:1 rate the trading
  // post gives, so they never drain the shared post the humans use
  const q = exchangeQuote(w, v, rich, poor, 1);
  const amount = Math.floor(Math.min(q.maxAmount, (v.res[rich] - v.res[poor]) / 2));
  if (amount < 200) return;
  v.res[rich] -= amount;
  v.res[poor] = Math.min(cap, v.res[poor] + Math.floor(amount * 0.5));
}

// ---------- research ----------

function research(w: World, p: Player, v: Village): void {
  if (v.buildings.smithy < 1 || v.research.length > 0) return;
  for (const u of RESEARCH[p.ai!.personality]) {
    if ((u === 'archer' || u === 'marcher') && !w.config.archers) continue;
    const have = v.tech[u] ?? (UNITS[u].research ? 0 : 1);
    // unlock first; upgrades only once the village is established
    if (have >= 1 && (v.buildings.smithy < 15 || have >= 3)) continue;
    const c = researchCheck(w, v, u);
    if (c.ok) {
      applyAction(w, p.id, { type: 'research', vid: v.id, unit: u });
      return;
    }
    if (c.reason?.includes('resources')) return; // save up for it
  }
}

// ---------- recruiting ----------

function armyCount(v: Village): Units {
  const u: Units = { ...v.units };
  for (const rb in v.recruit) for (const j of v.recruit[rb as keyof typeof v.recruit]) u[j.unit] = (u[j.unit] ?? 0) + j.count - j.done;
  return u;
}

function recruit(w: World, p: Player, v: Village): void {
  if (v.buildings.barracks < 1) return;
  const pers = p.ai!.personality;
  const diff = w.config.difficulty;
  const share = TROOP_SHARE[pers] * (diff === 'hard' ? 1.15 : diff === 'easy' ? 0.8 : 1);
  if (v.buildings.main < 3) return;
  // troops get a share of whatever is in store; the loot they bring back pays for buildings.
  // Surplus beyond the next building's needs is spent more freely.
  const reserve = buildReserve(w, p, v);
  const budget = {
    wood: v.res.wood * share + Math.max(0, v.res.wood - reserve.wood) * (1 - share) * 0.5,
    clay: v.res.clay * share + Math.max(0, v.res.clay - reserve.clay) * (1 - share) * 0.5,
    iron: v.res.iron * share + Math.max(0, v.res.iron - reserve.iron) * (1 - share) * 0.5,
  };
  const horizon = aiThinkInterval(w) * 3;
  const army = armyCount(v);
  const armyPop = Object.entries(army).reduce((s, [k, n]) => s + (n ?? 0) * UNITS[k as UnitId].pop, 0) + 1;
  const weights = ARMY[pers];
  const options = (Object.keys(weights) as UnitId[])
    .filter((u) => unitAvailable(w, v, u).ok)
    .map((u) => ({ u, deficit: weights[u]! - ((army[u] ?? 0) * UNITS[u].pop) / armyPop }))
    .sort((a, b) => b.deficit - a.deficit);
  const usedBuildings = new Set<string>();
  // keep room on the farm for more buildings and for noblemen
  const popReserve = Math.round(farmMax(v) * 0.06) + (v.buildings.academy > 0 || v.buildings.main >= 18 ? 450 : 0);
  let popLeft = popFree(v) - popReserve;
  for (const { u } of options) {
    const d = UNITS[u];
    const rb = d.building!;
    if (usedBuildings.has(rb)) continue;
    if (recruitQueueEnd(w, v, rb) - w.now > horizon) continue;
    const per = recruitTime(u, v.buildings[rb], w.config.speed, v.bonus);
    let n = Math.floor(horizon / per);
    for (const k of RES_KEYS) if (d.cost[k] > 0) n = Math.min(n, Math.floor(budget[k] / d.cost[k]));
    const chk = recruitCheck(w, v, u, 1);
    n = Math.min(n, chk.max, Math.floor(popLeft / d.pop));
    if (u === 'scout') n = Math.min(n, 60 + v.buildings.stable * 4 - (army.scout ?? 0));
    if (n < 1) continue;
    popLeft -= n * d.pop;
    if (applyAction(w, p.id, { type: 'recruit', vid: v.id, unit: u, count: n }).ok) {
      usedBuildings.add(rb);
      for (const k of RES_KEYS) budget[k] -= d.cost[k] * n;
    }
  }
}

// ---------- nobles ----------

function nobles(w: World, p: Player, v: Village): void {
  if (v.buildings.academy < 1) return;
  const info = nobleInfo(w, p.id);
  const nobleCost = UNITS.noble.cost;
  const busy = v.recruit.academy.length > 0;
  if (info.canTrain > 0 && !busy && resGte(v.res, nobleCost)) {
    if (applyAction(w, p.id, { type: 'recruit', vid: v.id, unit: 'noble', count: 1 }).ok) return;
  }
  const cap = storageOf(v);
  const flush = RES_KEYS.every((k) => v.res[k] > cap * 0.75);
  if ((info.canTrain <= 0 && info.coinsNeeded > 0) || (flush && info.canTrain < 3)) {
    const need = { wood: COIN_COST.wood + nobleCost.wood * 0.3, clay: COIN_COST.clay + nobleCost.clay * 0.3, iron: COIN_COST.iron + nobleCost.iron * 0.3 };
    if (resGte(v.res, need)) applyAction(w, p.id, { type: 'mintCoin', vid: v.id, count: 1 });
  }
}

interface NobleMemory { target: number; since: number }
const nobleTargets = new WeakMap<Player, NobleMemory>();

function conquestDrive(w: World, p: Player): void {
  const ai = p.ai!;
  const homes = p.villages.map((id) => w.villages[id]).filter((v) => (v.units.noble ?? 0) > 0);
  if (homes.length === 0) return;
  let mem = nobleTargets.get(p);
  const tgt = mem ? w.villages[mem.target] : undefined;
  if (!mem || !tgt || tgt.ownerId === p.id || w.now - mem.since > aiThinkInterval(w) * 120) {
    const pick = chooseNobleTarget(w, p, homes[0]);
    if (!pick) return;
    mem = { target: pick.id, since: w.now };
    nobleTargets.set(p, mem);
  }
  const target = w.villages[mem.target];
  if (!target) return;
  const intel = p.intel[target.id];
  for (const home of homes) {
    if (distance(home.x, home.y, target.x, target.y) > 22) continue;
    const n = home.units.noble ?? 0;
    if (n >= 2) {
      // a proper noble train: every nobleman lands back to back
      const per = Math.min(Math.floor((home.units.axe ?? 0) / n), 60);
      const waves: Units[] = [];
      for (let i = 0; i < n; i++) waves.push(per > 0 ? { noble: 1, axe: per } : { noble: 1 });
      if (sendTrain(w, p.id, home.id, target.id, waves).ok) continue;
    }
    for (let i = 0; i < n; i++) {
      const escort: Units = { noble: 1 };
      const wall = intel?.wall ?? 0; // unknown walls are assumed 0 until a report says otherwise
      const need = wall > 0 ? 25 + wall * 25 : 15;
      for (const u of ['axe', 'light', 'heavy', 'spear', 'sword'] as UnitId[]) {
        const have = home.units[u] ?? 0;
        if (have <= 0) continue;
        const take = Math.min(have, Math.ceil(need / Math.max(1, UNITS[u].attack / 40)));
        escort[u] = take;
        break;
      }
      if (wall >= 3 && (home.units.ram ?? 0) > 0) escort.ram = Math.min(home.units.ram!, 5 + wall * 3);
      const r = sendTroops(w, { ownerId: p.id, fromVid: home.id, toVid: target.id, kind: 'attack', units: escort, tag: 'noble' });
      if (!r.ok) break;
    }
  }
  ai.memory[target.id] = w.now;
}

function chooseNobleTarget(w: World, p: Player, from: Village): Village | null {
  let best: Village | null = null;
  let bestScore = -Infinity;
  for (const v of villagesNear(w, from.x, from.y, 18)) {
    if (v.ownerId === p.id) continue;
    const d = distance(from.x, from.y, v.x, v.y);
    let score = v.points / 10 - d * 4;
    if (v.ownerId === null) {
      if (v.points < 60) continue;
      score += 40;
    } else {
      const o = w.players[v.ownerId];
      if (!o || isProtected(w, o.id) || (o.tribeId !== null && o.tribeId === p.tribeId)) continue;
      if (o.kind === 'human' && !p.ai!.hostile) continue;
      const intel = p.intel[v.id];
      // only go after player villages we have recently cleared
      if (!intel || !intel.lastAttackT || w.now - intel.lastAttackT > aiThinkInterval(w) * 20) continue;
      if (intel.units && unitsCount(intel.units) > 5) continue;
      score += 60;
    }
    if (v.bonus) score += 25;
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return best;
}

// ---------- farming ----------

function farm(w: World, p: Player, v: Village): void {
  if (v.buildings.rally < 1) return;
  const ai = p.ai!;
  const hasLight = (v.units.light ?? 0) >= 5;
  const radius = hasLight ? 14 : 8;
  let sends = p.ai!.personality === 'farmer' ? 6 : 4;
  const cooldown = aiThinkInterval(w) * 4;
  const targets = villagesNear(w, v.x, v.y, radius)
    .filter((t) => t.ownerId === null && (ai.memory[t.id] ?? 0) + cooldown < w.now)
    .sort((a, b) => distance(v.x, v.y, a.x, a.y) - distance(v.x, v.y, b.x, b.y));
  for (const t of targets) {
    if (sends <= 0) break;
    const intel = p.intel[t.id];
    if (intel?.lastColor === 'red' && w.now - (intel.lastAttackT ?? 0) < cooldown * 10) continue;
    const wall = intel?.wall ?? 0;
    const group = raidGroup(v, wall);
    if (!group) break;
    const r = sendTroops(w, { ownerId: p.id, fromVid: v.id, toVid: t.id, kind: 'attack', units: group, tag: 'farm' });
    if (!r.ok) break;
    ai.memory[t.id] = w.now;
    sends--;
  }
}

function raidGroup(v: Village, wall: number): Units | null {
  const strength = wall > 0 ? 250 + wall * 180 : 60;
  const g: Units = {};
  let att = 0;
  for (const u of RAIDERS) {
    const have = v.units[u] ?? 0;
    if (have <= 0) continue;
    const per = UNITS[u].attack;
    const need = Math.ceil((strength - att) / per);
    const minGroup = u === 'light' ? 5 : u === 'spear' ? 12 : 8;
    const take = Math.min(have, Math.max(need, minGroup));
    if (take < Math.min(minGroup, need)) continue;
    g[u] = take;
    att += take * per;
    if (att >= strength) break;
  }
  if (att < strength) return null;
  if (wall >= 2 && (v.units.ram ?? 0) >= 2) g.ram = Math.min(v.units.ram!, wall * 4);
  return g;
}

// ---------- scavenging ----------

function scavenge(w: World, p: Player, v: Village): void {
  const pers = p.ai!.personality;
  if (pers !== 'turtle' && pers !== 'farmer') return;
  if (v.buildings.rally < 1) return;
  if (v.scavengeUnlocked < 2) {
    applyAction(w, p.id, { type: 'scavengeUnlock', vid: v.id, tier: v.scavengeUnlocked });
    return;
  }
  for (let tier = v.scavengeUnlocked - 1; tier >= 0; tier--) {
    if (v.scavenge[tier]) continue;
    const units: Units = {};
    for (const u of ['spear', 'sword'] as UnitId[]) {
      const n = Math.floor((v.units[u] ?? 0) * 0.3);
      if (n >= 10) units[u] = n;
    }
    if (!hasUnits(units)) return;
    applyAction(w, p.id, { type: 'scavenge', vid: v.id, tier, units });
    return;
  }
}

// ---------- defense ----------

function defend(w: World, p: Player, v: Village, incoming: Command[] | undefined): void {
  if (!incoming || incoming.length === 0) return;
  const soon = incoming.filter((c) => c.arrive - w.now < aiThinkInterval(w) * 1.6);
  if (soon.length === 0) return;
  // dodge: send the offensive troops away so they don't die on the wall
  const dodge: Units = {};
  for (const u of OFFENSIVE) if ((v.units[u] ?? 0) > 0 && u !== 'heavy') dodge[u] = v.units[u];
  if (unitsCount(dodge) < 20 || v.buildings.rally < 1) return;
  const barbs = villagesNear(w, v.x, v.y, 8).filter((t) => t.ownerId === null);
  if (barbs.length === 0) return;
  barbs.sort((a, b) => distance(v.x, v.y, a.x, a.y) - distance(v.x, v.y, b.x, b.y));
  sendTroops(w, { ownerId: p.id, fromVid: v.id, toVid: barbs[0].id, kind: 'attack', units: dodge, tag: 'dodge' });
}

// ---------- war ----------

function offensiveArmy(v: Village): Units {
  const g: Units = {};
  for (const u of OFFENSIVE) if ((v.units[u] ?? 0) > 0) g[u] = v.units[u];
  if ((v.units.scout ?? 0) > 2) g.scout = Math.min(v.units.scout!, 5);
  return g;
}

function attackValue(units: Units): number {
  let a = 0;
  for (const k in units) a += (units[k as UnitId] ?? 0) * UNITS[k as UnitId].attack;
  return a;
}

function humansTargetedBy(w: World, humanId: number): number {
  let n = 0;
  for (const id in w.players) if (w.players[id].ai?.targetPlayer === humanId) n++;
  return n;
}

function war(w: World, p: Player): void {
  const ai = p.ai!;
  const diff = w.config.difficulty;
  const margin = diff === 'hard' ? 1.15 : diff === 'easy' ? 2.2 : 1.45;
  const minArmy = diff === 'hard' ? 1500 : diff === 'easy' ? 6000 : 3000;
  if (nextRandom(w) > ai.aggression + 0.15) return;
  for (const vid of p.villages) {
    const v = w.villages[vid];
    if (!v || v.buildings.rally < 1) continue;
    const army = offensiveArmy(v);
    const A = attackValue(army);
    if (A < minArmy) continue;
    const target = pickWarTarget(w, p, v);
    if (!target) continue;
    const intel = p.intel[target.id];
    const fresh = intel?.scoutT !== undefined && w.now - intel.scoutT < aiThinkInterval(w) * 12;
    if (!fresh) {
      const scouts = v.units.scout ?? 0;
      if (scouts >= 3) {
        sendTroops(w, { ownerId: p.id, fromVid: v.id, toVid: target.id, kind: 'attack', units: { scout: Math.min(scouts, 5) }, tag: 'scout' });
      }
      continue;
    }
    const wall = intel!.buildings?.wall ?? intel!.wall ?? 0;
    const sim = resolveBattle({
      att: army, attTech: v.tech, attItem: null, defStacks: [{ units: intel!.units ?? {}, tech: {} }], defItems: [],
      wall, luck: 0, morale: 1,
    });
    if (sim.winner !== 'attacker' || sim.attStrength < sim.defStrength * margin) continue;
    const send = { ...army };
    if (wall === 0) delete send.ram;
    const cat = (send.catapult ?? 0) > 0 ? pickCatTarget(intel!.buildings) : undefined;
    sendTroops(w, { ownerId: p.id, fromVid: v.id, toVid: target.id, kind: 'attack', units: send, catTarget: cat, tag: 'war' });
    if (target.ownerId !== null) ai.targetPlayer = target.ownerId;
  }
}

function pickCatTarget(b: Partial<Record<BuildingId, number>> | undefined): BuildingId {
  if (!b) return 'farm';
  if ((b.wall ?? 0) > 0) return 'wall';
  if ((b.barracks ?? 0) > 5) return 'barracks';
  return 'farm';
}

function pickWarTarget(w: World, p: Player, v: Village): Village | null {
  const ai = p.ai!;
  const diff = w.config.difficulty;
  const humanCap = diff === 'hard' ? 4 : diff === 'normal' ? 2 : 1;
  let best: Village | null = null;
  let bestScore = -Infinity;
  for (const t of villagesNear(w, v.x, v.y, 20)) {
    if (t.ownerId === null || t.ownerId === p.id) continue;
    const o = w.players[t.ownerId];
    if (!o || isProtected(w, o.id)) continue;
    if (o.tribeId !== null && o.tribeId === p.tribeId) continue;
    if (o.kind === 'human') {
      if (!ai.hostile) continue;
      if (ai.targetPlayer !== o.id && humansTargetedBy(w, o.id) >= humanCap) continue;
      if (diff === 'easy' && o.points > p.points * 0.8) continue;
    }
    const d = distance(v.x, v.y, t.x, t.y);
    let score = -d * 3 + t.points / 50;
    if (ai.targetPlayer === o.id) score += 40;
    const intel = p.intel[t.id];
    if (intel?.lastColor === 'red' && w.now - (intel.lastAttackT ?? 0) < aiThinkInterval(w) * 30) score -= 80;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return best;
}

// ---------- hooks ----------

export function aiOnConquest(w: World, v: Village, oldOwner: number | null, newOwner: number): void {
  const np = w.players[newOwner];
  if (np?.ai) {
    const mem = nobleTargets.get(np);
    if (mem && mem.target === v.id) nobleTargets.delete(np);
  }
}

export function aiOnBattle(w: World, c: Command, target: Village, data: BattleData): void {
  // rulers remember who hit them and may retaliate
  if (target.ownerId === null) return;
  const victim = w.players[target.ownerId];
  if (!victim?.ai || c.ownerId === victim.id) return;
  const attacker = w.players[c.ownerId];
  if (!attacker) return;
  if (attacker.kind === 'human' && !victim.ai.hostile) return;
  if (data.winner === 'attacker' || nextRandom(w) < 0.3) {
    victim.ai.targetPlayer = attacker.id;
    victim.ai.aggression = Math.min(1, victim.ai.aggression + 0.1);
  }
}

export { BUILDINGS };
