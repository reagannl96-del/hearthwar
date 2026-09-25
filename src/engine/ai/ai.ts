// Computer rulers. They play by exactly the same rules as the human: every
// decision goes through applyAction / sendTroops, and they only know what their
// own scouting reports and battles told them.

import { applyAction, buildQueueSlots, checkBuild, nobleInfo, recruitCheck, researchCheck, villageHero } from '../actions';
import { resolveBattle } from '../combat';
import { isProtected, news, sendTrain, sendTroops, travelTime, withdrawSupport } from '../commands';
import { BUILDINGS, BUILDING_ORDER } from '../data/buildings';
import { HEROES, HERO_INFO, UNITS } from '../data/units';
import { regionAt, type Region } from '../regions';
import { activeCache, cacheGuarded, cacheGuardEstimate, cacheHolder } from '../caches';
import { COIN_COST, distance, farmCap, hasUnits, unitsPop, hideCap, moraleFor, recruitTime, resGte, unitsCarry, unitsCount } from '../formulas';
import { nextRandom } from '../rng';
import { villagesNear } from '../spatial';
import { EXCHANGE_RATE, exchangeQuote } from '../market';
import { commandsOf, commandsTo } from '../cmdindex';
import { TRIBE_MAX_MEMBERS, mergeTribes, tribeFull, acceptInvite, answerApplication, applicationsBy, applyToTribe, cancelInvite, createTribe, declineInvite, hasRight, invitePlayer, invitesFor, leaveTribe, relation, setDiplomacy, tribeOf, tribePoints, withdrawApplication } from '../tribes';
import { tribeName } from '../data/names';
import type { AITraits, BattleData, Incident, BuildingId, Command, Player, Res, Tribe, UnitId, Units, Village, VillageRole, World } from '../types';
import { RES_KEYS } from '../types';
import { buildingsPop, farmMax, loyaltyRegen, popFree, troopsPop, queuedLevel, recruitQueueEnd, storageOf, unitAvailable, updateVillage } from '../village';
import { aiThinkInterval, paceOf, realmDayMs } from '../world';

type P = NonNullable<Player['ai']>['personality'];

// ---------- build plans ----------

/** A minute of game time, for the waits below. */
const MIN = 60_000;

const BASE_PLAN: [BuildingId, number][] = [
  ['timber', 1], ['claypit', 1], ['ironmine', 1], ['timber', 2], ['claypit', 2], ['main', 2], ['timber', 3], ['claypit', 3],
  ['ironmine', 2], ['main', 3], ['barracks', 1], ['rally', 1], ['farm', 2], ['warehouse', 2], ['timber', 4], ['claypit', 4],
  ['ironmine', 3], ['warehouse', 3], ['farm', 3], ['timber', 5], ['claypit', 5], ['ironmine', 5], ['main', 5], ['smithy', 1],
  ['statue', 1], ['wall', 1], ['barracks', 3], ['warehouse', 5], ['farm', 5], ['timber', 8], ['claypit', 8], ['ironmine', 6], ['hiding', 2],
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
  } else if (pers === 'guardian') {
    plan.splice(30, 0, ['wall', 5]);
    plan.splice(46, 0, ['wall', 10], ['barracks', 8]);
  } else if (pers === 'opportunist') {
    plan.splice(40, 0, ['stable', 5]);
  }
  if (pers === 'expander' || pers === 'opportunist' || pers === 'warlord') {
    // the noble rush players do: once the basics stand, straight for the academy's
    // requirements (headquarters 20, smithy 20, market 10) and the academy itself
    // (and a warehouse big enough to hold what a nobleman costs)
    const rush: [BuildingId, number][] = [['main', 20], ['smithy', 20], ['market', 10], ['warehouse', 20], ['academy', 1]];
    plan = plan.filter(([b, l]) => !rush.some(([rb, rl]) => rb === b && rl === l));
    const at = plan.findIndex(([b, l]) => b === 'main' && l === 15) + 1;
    plan.splice(at, 0, ...rush);
  }
  planCache[pers] = plan;
  return plan;
}

const RESEARCH: Record<P, UnitId[]> = {
  warlord: ['axe', 'scout', 'light', 'ram', 'marcher', 'catapult', 'heavy', 'sword', 'spear'],
  farmer: ['axe', 'scout', 'light', 'sword', 'heavy', 'ram', 'spear'],
  turtle: ['sword', 'archer', 'scout', 'heavy', 'axe', 'light', 'ram', 'spear', 'sword'],
  expander: ['axe', 'sword', 'scout', 'light', 'ram', 'heavy', 'catapult', 'spear'],
  opportunist: ['axe', 'scout', 'light', 'ram', 'marcher', 'heavy', 'sword', 'spear'],
  guardian: ['sword', 'scout', 'archer', 'heavy', 'light', 'axe', 'ram', 'spear'],
};

/** desired share of army population per unit */
const ARMY: Record<P, Partial<Record<UnitId, number>>> = {
  warlord: { spear: 0.08, axe: 0.43, scout: 0.08, light: 0.28, marcher: 0.06, ram: 0.05, catapult: 0.02 },
  farmer: { spear: 0.24, sword: 0.1, axe: 0.19, scout: 0.08, light: 0.33, heavy: 0.06 },
  turtle: { spear: 0.34, sword: 0.29, archer: 0.12, scout: 0.07, heavy: 0.14, light: 0.04 },
  expander: { spear: 0.19, sword: 0.14, axe: 0.24, scout: 0.08, light: 0.24, ram: 0.04, heavy: 0.07 },
  opportunist: { spear: 0.14, sword: 0.08, axe: 0.34, scout: 0.1, light: 0.26, marcher: 0.04, ram: 0.04 },
  guardian: { spear: 0.3, sword: 0.26, archer: 0.1, scout: 0.07, heavy: 0.15, axe: 0.08, light: 0.04 },
};

const TROOP_SHARE: Record<P, number> = { warlord: 0.5, farmer: 0.38, turtle: 0.42, expander: 0.35, opportunist: 0.44, guardian: 0.45 };

/**
 * The army a village should carry, as troop population per point of the village (good
 * players keep 2:1, full-offense growers 3:1). Each ruler has its own taste within its
 * temperament, so some villages are loaded and some lean.
 */
const ARMY_RATIO: Record<P, number> = { warlord: 2.6, opportunist: 2.3, guardian: 2.1, turtle: 2.0, expander: 1.7, farmer: 1.4 };

function armyRatio(p: Player): number {
  const h = ((p.id * 2654435761) >>> 0) % 1000 / 1000; // steady per ruler
  return ARMY_RATIO[p.ai!.personality] * (0.8 + h * 0.45);
}

/** Troop population a village is after, within what a full farm could feed (the farm grows to fit it). */
function armyTarget(p: Player, v: Village): number {
  const full = farmCap(30, v.bonus);
  const room = full - buildingsPop(v) - Math.round(full * 0.06);
  return Math.max(0, Math.min(room, Math.round(v.points * armyRatio(p))));
}

/** Troop population of a village: home, in training and away. */
const armyPopOf = (v: Village) => troopsPop(v);

/** How far along a village's army is towards what it should carry (1 = there). */
function armyFill(p: Player, v: Village): number {
  const target = armyTarget(p, v);
  return target <= 0 ? 1 : Math.min(1, armyPopOf(v) / target);
}

const OFFENSIVE: UnitId[] = ['axe', 'light', 'marcher', 'heavy', 'ram', 'catapult'];

/** Troop recipes by village role. Mixed villages use the ruler's own blend. */
const ROLE_ARMY: Record<'offense' | 'defense', Partial<Record<UnitId, number>>> = {
  offense: { axe: 0.52, light: 0.28, marcher: 0.05, scout: 0.07, ram: 0.06, catapult: 0.02 },
  defense: { spear: 0.43, sword: 0.29, archer: 0.1, heavy: 0.07, light: 0.05, scout: 0.06 },
};

/** How likely each personality is to set a new village up for attack, defence, a mix or at random. */
const ROLE_ODDS: Record<P, [number, number, number, number]> = {
  warlord: [0.6, 0.15, 0.15, 0.1],
  farmer: [0.3, 0.2, 0.35, 0.15],
  turtle: [0.15, 0.6, 0.15, 0.1],
  expander: [0.35, 0.25, 0.25, 0.15],
  opportunist: [0.45, 0.15, 0.25, 0.15],
  guardian: [0.15, 0.55, 0.2, 0.1],
};

/** The role of one of this ruler's villages, decided the first time we look at it and kept for good. */
export function villageRole(w: World, p: Player, v: Village): VillageRole {
  const ai = p.ai!;
  ai.roles ??= {};
  let role = ai.roles[v.id];
  if (!role) {
    const odds = ROLE_ODDS[ai.personality];
    let x = nextRandom(w);
    const kinds: VillageRole['kind'][] = ['offense', 'defense', 'mixed', 'random'];
    let kind: VillageRole['kind'] = 'mixed';
    for (let i = 0; i < 4; i++) { if (x < odds[i]) { kind = kinds[i]; break; } x -= odds[i]; }
    role = { kind };
    if (kind === 'random') {
      // a random assortment: a handful of unit types in random amounts
      const pool: UnitId[] = ['spear', 'sword', 'axe', 'archer', 'light', 'marcher', 'heavy', 'ram'];
      const weights: Partial<Record<UnitId, number>> = { scout: 0.07 };
      let total = 0;
      for (const u of pool) if (nextRandom(w) < 0.55) { const wt = 0.05 + nextRandom(w); weights[u] = wt; total += wt; }
      if (total === 0) { weights.spear = 0.5; weights.axe = 0.5; total = 1; }
      for (const u of pool) if (weights[u]) weights[u] = (weights[u]! / total) * 0.93;
      role.weights = weights;
    }
    ai.roles[v.id] = role;
  }
  return role;
}

function roleWeights(p: Player, role: VillageRole): Partial<Record<UnitId, number>> {
  if (role.kind === 'offense' || role.kind === 'defense') return ROLE_ARMY[role.kind];
  if (role.kind === 'random' && role.weights) return role.weights;
  return ARMY[p.ai!.personality];
}

/**
 * What the attacks on this ruler have been made of lately: if it is mostly cavalry,
 * more spearmen; mostly infantry, more swordsmen; mostly archers, more archers of
 * our own. Offensive villages keep their recipe.
 */
function counterWeights(w: World, p: Player, role: VillageRole, base: Partial<Record<UnitId, number>>): Partial<Record<UnitId, number>> {
  const th = p.ai!.threat;
  if (!th || role.kind === 'offense' || w.now - th.t > 2 * realmDayMs(w)) return base;
  const total = th.cav + th.inf + th.arc;
  if (total < 50) return base;
  const out = { ...base };
  const lean = (u: UnitId, share: number) => { if (out[u] !== undefined) out[u] = out[u]! * (1 + 0.8 * share); };
  lean('spear', th.cav / total);
  lean('sword', th.inf / total);
  lean('archer', th.arc / total);
  return out;
}

/** Can this village go to war? Defensive villages hold the line and only farm. */
function warVillage(w: World, p: Player, v: Village): boolean {
  return villageRole(w, p, v).kind !== 'defense';
}
const RAIDERS: UnitId[] = ['light', 'marcher', 'axe', 'spear', 'heavy'];

// ---------- main entry ----------

/**
 * Rulers keep a dedicated human's hours: about eight hours of sleep, and through the
 * rest of the day they drop in for play sessions of half an hour to an hour, with
 * an hour or so away in between: roughly six and a half hours at the keyboard a day
 * (more on hard realms, less on easy ones). While away nothing new is queued, sent
 * or traded; queued work carries on, as it does for a person.
 */
const LAUNCH_RUSH = 4 * 3_600_000;

/** Whether this ruler is in bed right now (about eight hours a day, at their own time). */
export function aiAsleep(w: World, p: Player): boolean {
  if (w.config.aiAlwaysAwake) return false;
  // nobody sleeps through the opening of a new realm
  if (w.now < LAUNCH_RUSH) return false;
  const minute = Math.floor((w.createdReal + w.now) / 60_000);
  const ofDay = ((minute % 1440) + 1440) % 1440;
  const sleepStart = (p.id * 397) % 1440;
  return (ofDay - sleepStart + 1440) % 1440 < 8 * 60;
}

export function aiAwake(w: World, p: Player): boolean {
  if (w.config.aiAlwaysAwake) return true;
  if (aiAsleep(w, p)) return false;
  const minute = Math.floor((w.createdReal + w.now) / 60_000);
  const diff = w.config.difficulty;
  const cycle = diff === 'hard' ? 85 : diff === 'easy' ? 130 : 105;
  const t = minute + p.id * 37;
  const session = Math.floor(t / cycle);
  const len = (30 + (((session * 2654435761 + p.id * 40503) >>> 0) % 26)) * activityOf(p);
  return t % cycle < len;
}

/**
 * How much of a dedicated player's time this ruler puts in: some are at it every
 * spare minute, some are casual and look in now and then (0.5 to 1.1, the same for
 * a ruler all round; warlords and opportunists lean keen, defenders lean casual).
 */
export function activityOf(p: Player): number {
  const base = 0.5 + (((p.id * 2654435761) >>> 0) % 1000) / 1000 * 0.62;
  const pers = p.ai?.personality;
  const lean = pers === 'warlord' || pers === 'opportunist' ? 0.12 : pers === 'turtle' || pers === 'guardian' ? -0.08 : 0;
  return Math.max(0.5, Math.min(1.1, base + lean));
}

/**
 * Between sessions a person still glances at the game now and then, the way you
 * check your phone: a quick look to keep the builders and the barracks busy, and to
 * send the next wave of a conquest under way, and nothing more (no raids, no war).
 * Now and then even in the night, but no attacks then.
 */
const GLANCE_AWAKE = 20 * 60_000;
const GLANCE_ASLEEP = 90 * 60_000;

function glance(w: World, p: Player): void {
  const ai = p.ai!;
  const gap = aiAsleep(w, p) ? GLANCE_ASLEEP : GLANCE_AWAKE;
  // spread the glances out: every ruler has their own rhythm
  if (w.now - (ai.lastGlance ?? -Infinity) < gap + ((p.id * 7919) % 7) * 60_000) return;
  ai.lastGlance = w.now;
  const n = p.villages.length;
  const from = (ai.glanceCursor ?? 0) % Math.max(1, n);
  ai.glanceCursor = from + 12;
  for (let i = 0; i < Math.min(12, n); i++) {
    const v = w.villages[p.villages[(from + i) % n]];
    if (!v || v.ownerId !== p.id) continue;
    updateVillage(w, v, w.now);
    // before looking away again: a nobleman or crown first if it can (people save for those), then fill the building queue
    nobles(w, p, v);
    build(w, p, v);
    research(w, p, v);
    hero(w, p, v);
    recruit(w, p, v);
  }
  // a quick look on the phone is enough to send the next noble train (never in the night, though)
  if (!aiAsleep(w, p)) campaignDrive(w, p);
}

export function aiThink(w: World, p: Player): void {
  const ai = p.ai!;
  if (!aiAwake(w, p)) { glance(w, p); return; }
  const incoming = incomingIndex(w, p);
  // incoming attacks show up as alerts, so every village under threat gets a look
  for (const [vid, list] of incoming) {
    const v = w.villages[vid];
    if (v && v.ownerId === p.id) { updateVillage(w, v, w.now); defend(w, p, v, list); }
  }
  // the day-to-day work goes a few villages per look, in turn, as a person clicks through their list
  const per = w.config.difficulty === 'hard' ? 4 : w.config.difficulty === 'easy' ? 2 : 3;
  // and only so many raids get clicked out per look, however many villages there are
  ai.raidBudget = (ai.personality === 'farmer' ? 3 : 2) + (w.config.difficulty === 'hard' ? 1 : 0);
  const list = [...p.villages];
  const start = (ai.cursor ?? 0) % Math.max(1, list.length);
  ai.cursor = start + per;
  for (let i = 0; i < Math.min(per, list.length); i++) {
    const vid = list[(start + i) % list.length];
    const v = w.villages[vid];
    if (!v || v.ownerId !== p.id) continue;
    updateVillage(w, v, w.now);
    trade(w, p, v);
    // noblemen and crowns before the builders spend everything
    nobles(w, p, v);
    build(w, p, v);
    research(w, p, v);
    hero(w, p, v);
    recruit(w, p, v);
    if (ai.campaign?.from !== v.id) farm(w, p, v);
    scavenge(w, p, v);
  }
  if (w.now - ai.lastWarCheck >= Math.max(aiThinkInterval(w), WAR_WAIT.check)) {
    ai.lastWarCheck = w.now;
    war(w, p);
  }
  campaignDrive(w, p);
  cacheHunt(w, p);
  respondToIncidents(w, p);
  scoutRound(w, p);
  helpAllies(w, p);
  tribeLife(w, p);
  tribeRecruiting(w, p);
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
  const slots = buildQueueSlots(v);
  // an established village well short of its army puts its resources into troops first
  const lean = v.points >= 600 && v.buildings.barracks > 0 && armyFill(p, v) < 0.5;
  for (let guard = 0; guard < slots && v.buildQueue.length < slots; guard++) {
    // short of troops: a faster barracks and stable come before anything else
    // (and a smithy, without which a taken village can only make spearmen)
    const FAST: [BuildingId, number][] = [['smithy', 5], ['barracks', 20], ['stable', 15], ['smithy', 15]];
    // the farm first, if it can't feed the army the village is after
    const farmShort = lean && farmMax(v) - buildingsPop(v) < armyTarget(p, v) * 1.05 && queuedLevel(v, 'farm') < 30;
    const fast = farmShort && checkBuild(w, v, 'farm').ok ? 'farm' : lean ? FAST.find(([x, lvl]) => queuedLevel(v, x) < lvl && checkBuild(w, v, x).ok)?.[0] : undefined;
    const b = fast ?? chooseBuild(w, p, v);
    if (!b) return;
    if (lean && b !== 'farm' && b !== 'warehouse' && b !== 'wall' && b !== 'barracks' && b !== 'stable' && b !== 'smithy') return;
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
  // an academy is no use while the warehouse can't hold what a nobleman costs
  if (v.buildings.academy > 0 && cap < Math.max(...RES_KEYS.map((k) => UNITS.noble.cost[k])) * 1.05 && queuedLevel(v, 'warehouse') < 30 && checkBuild(w, v, 'warehouse').ok) return 'warehouse';
  // a wall the catapults brought down comes back first
  const wallWas = p.ai!.wallWas?.[v.id] ?? 0;
  if (v.buildings.wall > wallWas) (p.ai!.wallWas ??= {})[v.id] = v.buildings.wall;
  else if (queuedLevel(v, 'wall') < wallWas && checkBuild(w, v, 'wall').ok) return 'wall';
  const plan = planFor(p.ai!.personality);
  const unmet: BuildingId[] = [];
  for (const [b, lvl] of plan) {
    if (queuedLevel(v, b) >= lvl) continue;
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
  // rulers trade with their own merchants at the same balanced-stock rate the
  // trading post gives (about 4:1), so they never drain the shared post the humans use
  const q = exchangeQuote(w, v, rich, poor, 1);
  const amount = Math.floor(Math.min(q.maxAmount, (v.res[rich] - v.res[poor]) / 2));
  if (amount < 200) return;
  v.res[rich] -= amount;
  v.res[poor] = Math.min(cap, v.res[poor] + Math.floor(amount * EXCHANGE_RATE));
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
  const base = TROOP_SHARE[pers] * (diff === 'hard' ? 1.15 : diff === 'easy' ? 0.8 : 1);
  if (v.buildings.main < 3) return;
  // troops get a share of whatever is in store; the loot they bring back pays for buildings.
  // A village short of the army it should carry spends far more on troops, and doesn't
  // hold back for the next building; one at strength spends its usual share.
  const fill = armyFill(p, v);
  const share = Math.min(0.9, base + (1 - base) * Math.max(0, 0.9 - fill));
  const reserve = fill < 0.6 ? { wood: 0, clay: 0, iron: 0 } : buildReserve(w, p, v);
  const budget = {
    wood: v.res.wood * share + Math.max(0, v.res.wood - reserve.wood) * (1 - share) * 0.5,
    clay: v.res.clay * share + Math.max(0, v.res.clay - reserve.clay) * (1 - share) * 0.5,
    iron: v.res.iron * share + Math.max(0, v.res.iron - reserve.iron) * (1 - share) * 0.5,
  };
  // a village at strength tops up a little at a time; one short of its army queues
  // hours of training, the way a person fills the barracks before going to bed
  const horizon = fill < 0.6 ? 8 * 60 * MIN : fill < 0.9 ? 3 * 60 * MIN : aiThinkInterval(w) * 3;
  const army = armyCount(v);
  const armyPop = Object.entries(army).reduce((s, [k, n]) => s + (n ?? 0) * UNITS[k as UnitId].pop, 0) + 1;
  const role = villageRole(w, p, v);
  const weights = counterWeights(w, p, role, roleWeights(p, role));
  let options = (Object.keys(weights) as UnitId[])
    .filter((u) => unitAvailable(w, v, u).ok)
    .map((u) => ({ u, deficit: weights[u]! - ((army[u] ?? 0) * UNITS[u].pop) / armyPop }))
    .sort((a, b) => b.deficit - a.deficit);
  // none of the village's own recipe can be made yet (a taken village without a smithy):
  // it trains what it can meanwhile rather than sitting on its resources
  if (options.length === 0 || (fill < 0.6 && options.every((o) => o.u === 'scout'))) {
    options = (['axe', 'light', 'sword', 'spear'] as UnitId[]).filter((u) => unitAvailable(w, v, u).ok).map((u) => ({ u, deficit: 1 }));
  }
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
    if (u === 'scout') n = Math.min(n, 150 + v.buildings.stable * 12 - (army.scout ?? 0));
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
  // enough noblemen for a train (alive, away or in training): no more crowns for now
  const owned = info.used - Math.max(0, p.villages.length - 1);
  if (owned >= NOBLES_WANTED) return;
  const cap = storageOf(v);
  const flush = RES_KEYS.every((k) => v.res[k] > cap * 0.75);
  if ((info.canTrain <= 0 && info.coinsNeeded > 0) || (flush && info.canTrain < 2)) {
    const need = { wood: COIN_COST.wood + nobleCost.wood * 0.3, clay: COIN_COST.clay + nobleCost.clay * 0.3, iron: COIN_COST.iron + nobleCost.iron * 0.3 };
    if (resGte(v.res, need)) applyAction(w, p.id, { type: 'mintCoin', vid: v.id, count: 1 });
  }
}

/** noblemen an AI keeps ready: a full train, and one to spare */
const NOBLES_WANTED = 6;

// ---------- character ----------

type Span = [number, number];
/** hours between conquests */
const PATIENCE: Record<P, Span> = { warlord: [2.5, 5], expander: [2.5, 4.5], farmer: [7, 12], turtle: [15, 26], opportunist: [3, 6], guardian: [11, 18] };
/** fields a ruler will march to take a village */
const REACH: Record<P, Span> = { warlord: [16, 22], expander: [14, 20], farmer: [12, 16], turtle: [10, 14], opportunist: [15, 20], guardian: [11, 15] };
const HELPER: Record<P, number> = { warlord: 0.3, expander: 0.4, farmer: 0.35, turtle: 0.8, opportunist: 0.15, guardian: 1 };
const FAKER: Record<P, number> = { warlord: 0.6, expander: 0.3, farmer: 0.2, turtle: 0.05, opportunist: 0.6, guardian: 0 };
const CAUTION: Record<P, Span> = { warlord: [1.1, 1.3], expander: [1.2, 1.4], farmer: [1.3, 1.5], turtle: [1.4, 1.7], opportunist: [1.2, 1.4], guardian: [1.4, 1.6] };
const BARB_FIRST: Record<P, number> = { warlord: 0.3, expander: 0.7, farmer: 0.8, turtle: 0.9, opportunist: 0.15, guardian: 0.9 };

const TRAITS_V = 3;

/** Conquests a day by temperament, when its battles go well: a speedy realm, so keen rulers take several a day. */
const TEMPO: Record<P, Span> = { warlord: [3.5, 7], expander: [3.2, 6.5], opportunist: [2.6, 6], farmer: [1.8, 3.4], guardian: [1.3, 2.6], turtle: [1, 2] };
/** Villages that would content a ruler of each temperament (past them it slows right down). */
const AMBITION: Record<P, Span> = { warlord: [30, 90], expander: [35, 100], opportunist: [20, 60], farmer: [15, 40], guardian: [12, 30], turtle: [10, 25] };

/** A ruler's own habits, drawn once from its temperament (so no two warlords are quite alike). */
export function traitsOf(w: World, p: Player): AITraits {
  const ai = p.ai!;
  if (!ai.traits || ai.traits.v !== TRAITS_V) {
    const pers = ai.personality;
    const between = ([lo, hi]: Span) => lo + nextRandom(w) * (hi - lo);
    const diff = w.config.difficulty;
    const pace = diff === 'hard' ? 0.7 : diff === 'easy' ? 1.5 : diff === 'peaceful' ? 2 : 1;
    ai.traits = {
      v: TRAITS_V,
      // and an appetite of its own on top: some are hungrier than their kind, some lazier
      patienceH: Math.round(between(PATIENCE[pers]) * pace * (0.65 + nextRandom(w) * 0.9) * 10) / 10,
      // its own appetite on top of its kind's: some are far hungrier than others
      tempo: Math.round((between(TEMPO[pers]) / pace) * (0.7 + nextRandom(w) * 0.6) * 100) / 100,
      ambition: Math.round(between(AMBITION[pers])),
      reach: Math.round(between(REACH[pers])),
      helper: Math.min(1, Math.max(0, HELPER[pers] + (nextRandom(w) - 0.5) * 0.3)),
      faker: nextRandom(w) < FAKER[pers],
      caution: Math.round(between(CAUTION[pers]) * 100) / 100,
      barbFirst: nextRandom(w) < BARB_FIRST[pers],
    };
  }
  return ai.traits;
}

// ---------- heroes ----------

/** Which heroes each temperament likes (weights). */
const HERO_TASTE: Record<P, Partial<Record<UnitId, number>>> = {
  warlord: { goblin: 3, necromancer: 3, orc: 3.5, paladin: 2, sorcerer: 1, druid: 0.5 },
  expander: { paladin: 3, necromancer: 2, sorcerer: 2, orc: 2, goblin: 1, druid: 1 },
  farmer: { goblin: 4, paladin: 1.5, orc: 1.2, druid: 1, sorcerer: 0.5, necromancer: 0.5 },
  turtle: { druid: 3, sorcerer: 3, paladin: 2, necromancer: 0.5, orc: 0.5, goblin: 0.3 },
  opportunist: { goblin: 3, necromancer: 3, orc: 3, sorcerer: 1, paladin: 1, druid: 0.5 },
  guardian: { paladin: 3, druid: 3, sorcerer: 2, orc: 1, necromancer: 0.5, goblin: 0.3 },
};

/** How much each temperament likes the wilds' own heroes, for its villages out there. */
const WILD_TASTE: Record<P, Partial<Record<UnitId, number>>> = {
  warlord: { saurian: 0.8, djinn: 0.7, dwarf: 0.5, frost: 0.4 },
  expander: { djinn: 0.8, saurian: 0.6, frost: 0.5, dwarf: 0.5 },
  farmer: { djinn: 0.8, dwarf: 0.7, frost: 0.5, saurian: 0.4 },
  turtle: { dwarf: 0.85, frost: 0.85, djinn: 0.4, saurian: 0.3 },
  opportunist: { saurian: 0.8, djinn: 0.7, frost: 0.4, dwarf: 0.4 },
  guardian: { frost: 0.8, dwarf: 0.8, djinn: 0.5, saurian: 0.4 },
};
const WILD_HERO: Partial<Record<Region, UnitId>> = { winter: 'frost', volcanic: 'dwarf', desert: 'djinn', jungle: 'saurian' };

function pickHero(w: World, p: Player): UnitId {
  const taste = HERO_TASTE[p.ai!.personality];
  // a ruler's favourite is one it can raise anywhere (the wilds' heroes answer only their own land)
  const opts = HEROES.filter((h) => (h !== 'paladin' || w.config.paladin) && !HERO_INFO[h]?.region);
  const total = opts.reduce((a, h) => a + (taste[h] ?? 0.2), 0);
  let x = nextRandom(w) * total;
  for (const h of opts) {
    x -= taste[h] ?? 0.2;
    if (x <= 0) return h;
  }
  return opts[0];
}

/**
 * Every ruler raises a hero at its statue: its favourite in its first village, and
 * mostly the same elsewhere, with now and then another kind for a village's own
 * purpose. A village taken from someone keeps the hero its statue was sworn to.
 */
function hero(w: World, p: Player, v: Village): void {
  if (v.buildings.statue < 1 || villageHero(w, v)) return;
  const ai = p.ai!;
  ai.hero ??= pickHero(w, p);
  let kind = v.heroKind;
  if (!kind) {
    // out in the wilds, the land's own hero is a strong pull (how strong depends on the ruler)
    const wild = WILD_HERO[regionAt(v.x, v.y, w.config.size)];
    const pull = wild ? WILD_TASTE[ai.personality][wild] ?? 0.5 : 0;
    const roll = ((v.id * 2246822519) >>> 0) % 1000 / 1000;
    if (wild && roll < pull) kind = wild;
    else {
      const anywhere = HEROES.filter((h) => !HERO_INFO[h]?.region);
      kind = v.id === p.villages[0] || (v.id * 2654435761 >>> 0) % 10 < 7 ? ai.hero : anywhere[(v.id * 7) % anywhere.length];
    }
  }
  if (kind === 'paladin' && !w.config.paladin) return;
  if (recruitCheck(w, v, kind, 1).ok) applyAction(w, p.id, { type: 'recruit', vid: v.id, unit: kind, count: 1 });
}

/** Heroes who do their best work on the attack go along with a real one. */
const ATTACK_HEROES: UnitId[] = ['goblin', 'necromancer', 'orc', 'saurian', 'djinn'];
function attackHero(v: Village): UnitId | null {
  for (const h of ATTACK_HEROES) if ((v.units[h] ?? 0) > 0) return h;
  return null;
}

// ---------- conquest ----------

/**
 * How a ruler takes villages. The rules are the same for every ruler, so they can
 * be read and planned against:
 *
 *  - It starts as soon as it has a nobleman at home and has rested since its last
 *    conquest. Every ruler has a tempo, the conquests a day it goes for when its
 *    battles go its way (a keen warlord 3 to 6, a careful defender about one), and an
 *    ambition, the villages that would content it (past them it slows right down).
 *    A winning streak quickens it, setbacks slow it, and like anyone it has days
 *    when it is on fire and days when it barely plays.
 *  - It picks a village within its reach (10 to 22 fields): a barbarian village of
 *    100 points or more, or a player's village (people's too, their first one
 *    included) that is out of beginner protection, not in its tribe and not an ally
 *    or under a pact. Close, rich, weakly held villages come first; a village it
 *    lost comes before anything. Only one ruler at a time goes after any one person,
 *    anyone's only village is left alone for their first day in the realm, and
 *    barbarian villages on a person's doorstep (5 fields) are left for them to take.
 *  - It scouts first, then sends a clearing attack with its noblemen right behind,
 *    and keeps coming back as the noblemen return (each takes 20 to 35 loyalty, and
 *    loyalty grows back about 20 an hour on a standard realm) until the village falls.
 *  - A village taken from it is struck back at once (loyalty starts low after a
 *    conquest), without the usual rest, for the first few hours.
 *  - It gives up when the village turns out too strong for its army, when two of
 *    its attacks are beaten back, when its noblemen are gone, or after a day.
 */
const CAMPAIGN_MAX = 24 * 3_600_000;
const CAMPAIGN_FAILS = 2;
/** a report this recent is good enough to plan the next wave on */
const INTEL_FRESH = 45 * MIN;

function campaignReady(w: World, p: Player): boolean {
  if (recentLoss(w, p) !== null) return true;
  const ai = p.ai!;
  const last = ai.lastCampaignEnd;
  if (last === undefined) return true;
  return w.now - last >= campaignGapH(w, p) * 3_600_000;
}

/**
 * Hours of rest before the next conquest: the ruler's patience, three quarters as
 * long again for every village it holds, shorter on a winning streak (a bully on a
 * roll, from the third day on), longer after setbacks, and never under three hours
 * (twelve at the realm's start, easing down over the first two days).
 */
export function campaignGapH(w: World, p: Player): number {
  const ai = p.ai!;
  const t = traitsOf(w, p);
  const n = p.villages.length;
  // its pace: a day divided by the conquests it goes for, a little slower as the realm it runs grows
  let gap = (24 / Math.max(0.3, t.tempo ?? 1)) * (1 + 0.02 * Math.max(0, n - 1)) / paceOf(w);
  // content with what it has: past its ambition it slows right down
  if (n >= (t.ambition ?? 99)) gap *= 3;
  // on a roll it keeps rolling; setbacks slow it down
  gap *= Math.pow(0.85, Math.min(3, ai.streak ?? 0)) * (1 + 0.35 * Math.min(4, ai.cold ?? 0));
  // and people have their days: some it is on fire, some it barely plays
  gap *= dayMood(w, p);
  // the opening is a little slower for everyone, and no ruler takes villages back to back
  const floor = Math.max(1.5, 8 - 8 * (w.now / realmDayMs(w))) / paceOf(w);
  return Math.max(floor, gap);
}

/**
 * How today is going for this ruler, the same all day (from its id and the day, so
 * it costs no dice): mostly an ordinary day, now and then a day on fire (x0.6 the
 * rest), now and then a day it barely plays (x3).
 */
export function dayMood(w: World, p: Player): number {
  const day = Math.floor(w.now / realmDayMs(w));
  const roll = (((p.id * 2654435761) ^ (day * 40503 + 17)) >>> 0) % 100;
  return roll < 14 ? 3 : roll > 85 ? 0.6 : 1;
}

/** A village taken from this ruler in the last few hours, still in someone else's hands. */
function recentLoss(w: World, p: Player): number | null {
  for (const [k, at] of Object.entries(p.ai!.lost ?? {})) {
    const v = w.villages[Number(k)];
    if (w.now - at < (6 * 3_600_000) / paceOf(w) && v && v.ownerId !== p.id && (p.ai!.avoid?.[v.id] ?? 0) <= w.now) return v.id;
  }
  return null;
}

function endCampaign(w: World, p: Player, taken: boolean): void {
  const ai = p.ai!;
  const c = ai.campaign;
  if (!c) return;
  if (taken) {
    // another one soon after the last: the streak grows; a long pause lets it cool
    const recent = ai.lastCampaignEnd !== undefined && w.now - ai.lastCampaignEnd < campaignGapH(w, p) * 3_600_000 * 2.5;
    ai.streak = recent ? (ai.streak ?? 0) + 1 : 1;
    ai.cold = Math.max(0, (ai.cold ?? 0) - 1);
  } else if (c.waves > 0) {
    ai.streak = Math.max(0, (ai.streak ?? 0) - 1);
    ai.cold = (ai.cold ?? 0) + 1;
  }
  if (!taken) (ai.avoid ??= {})[c.target] = w.now + 3 * 60 * MIN;
  ai.campaign = undefined;
  // a campaign that never sent a nobleman costs no rest
  if (taken || c.waves > 0) ai.lastCampaignEnd = w.now;
}

/** May this ruler set out to take this village at all? */
function campaignTargetOk(w: World, p: Player, v: Village): boolean {
  if (v.ownerId === p.id) return false;
  if (v.cache) return false; // a resource cache can't be taken
  if (v.ownerId === null) return true;
  const o = w.players[v.ownerId];
  if (!o || o.eliminated || isProtected(w, o.id)) return false;
  if (o.tribeId !== null && o.tribeId === p.tribeId) return false;
  const rel = relation(w, p.tribeId, o.tribeId);
  if (rel === 'ally' || rel === 'nap') return false;
  if (o.kind === 'human' && !p.ai!.hostile) return false;
  // a newcomer's only village (a person's or a ruler's): a day's grace after they settle (protection ends after 2.5 hours)
  if (o.villages.length <= 1 && w.now < o.protectedUntil + NEWCOMER_GRACE) return false;
  return true;
}

/** How long after settling a person's only village is safe from conquest (counted from the end of beginner protection). */
const NEWCOMER_GRACE = 21.5 * 3_600_000;

/** Is this barbarian village on a person's doorstep? */
function nearPerson(w: World, v: Village): boolean {
  for (const o of villagesNear(w, v.x, v.y, 5)) {
    if (o.ownerId !== null && w.players[o.ownerId]?.kind === 'human' && distance(o.x, o.y, v.x, v.y) <= 5) return true;
  }
  return false;
}

/** Is another ruler already after one of this person's villages? */
function personTaken(w: World, p: Player, ownerId: number): boolean {
  for (const id in w.players) {
    const o = w.players[id];
    if (o.id === p.id || !o.ai?.campaign) continue;
    if (w.villages[o.ai.campaign.target]?.ownerId === ownerId) return true;
  }
  return false;
}

function chooseCampaignTarget(w: World, p: Player, from: Village): Village | null {
  const ai = p.ai!;
  const t = traitsOf(w, p);
  let best: Village | null = null;
  let bestScore = -Infinity;
  for (const v of villagesNear(w, from.x, from.y, t.reach)) {
    if (!campaignTargetOk(w, p, v)) continue;
    if ((ai.avoid?.[v.id] ?? 0) > w.now) continue;
    const d = distance(from.x, from.y, v.x, v.y);
    if (d > t.reach) continue;
    const intel = p.intel[v.id];
    const wall = intel?.buildings?.wall ?? intel?.wall ?? 0;
    const defence = unitsCount(intel?.units ?? {}) - (intel?.units?.scout ?? 0);
    let score = Math.min(v.points, 3000) / 12 - d * 5 - wall * 6 - Math.min(defence, 4000) * 0.03;
    const lost = ai.lost?.[v.id];
    if (lost !== undefined && w.now - lost < 3 * realmDayMs(w)) score += 120;
    if (v.ownerId === null) {
      if (v.points < 100) continue;
      if (nearPerson(w, v)) continue;
      if (t.barbFirst) score += 40;
    } else {
      const o = w.players[v.ownerId];
      // nobody spends a nobleman on a hamlet (a village of ours they took is another matter)
      if (v.points < 100 && lost === undefined) continue;
      if (o.kind === 'human') {
        if (personTaken(w, p, o.id)) continue;
        if (!mayHit(w, p, o.id)) continue;
      }
      if (!t.barbFirst) score += ai.personality === 'warlord' || ai.personality === 'opportunist' ? 50 : 30;
      if (ai.targetPlayer === o.id) score += 50;
      // a soft target our own reports vouch for: few defenders and a low wall, seen lately
      const seenAt = Math.max(intel?.scoutT ?? 0, intel?.lastAttackT ?? 0);
      if (intel?.units && w.now - seenAt < 12 * 3_600_000 && defence <= 60 && wall <= 3) score += 90;
      if (intel?.lastColor === 'green' && w.now - (intel.lastAttackT ?? 0) < 6 * 3_600_000) score += ai.personality === 'opportunist' ? 60 : 25;
      // the tribe is at war with them
      if (tribeEnemy(w, p, o)) score += 35;
      // the weaker the owner next to us, the better the odds
      score += Math.max(-40, Math.min(40, ((p.points - o.points) / Math.max(1, p.points)) * 40));
    }
    if (v.bonus) score += 20;
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return best;
}

function campaignDrive(w: World, p: Player): void {
  const ai = p.ai!;
  let c = ai.campaign;
  if (c) {
    const tv = w.villages[c.target], home = w.villages[c.from];
    const noblesLeft = home && home.ownerId === p.id ? nobleInfo(w, p.id).used - Math.max(0, p.villages.length - 1) : 0;
    if (!tv || !home || home.ownerId !== p.id || tv.ownerId === p.id || w.now - c.since > CAMPAIGN_MAX
      || c.fails >= CAMPAIGN_FAILS || !campaignTargetOk(w, p, tv) || noblesLeft <= 0) {
      endCampaign(w, p, tv?.ownerId === p.id);
      c = undefined;
    }
  }
  if (!c) {
    if (!campaignReady(w, p)) return;
    // the village with noblemen at home and the strongest army leads
    const homes = p.villages.map((id) => w.villages[id]).filter((v): v is Village => !!v && (v.units.noble ?? 0) > 0 && v.buildings.rally > 0);
    if (!homes.length) return;
    homes.sort((a, b) => attackValue(offensiveArmy(b)) - attackValue(offensiveArmy(a)));
    for (const home of homes) {
      const target = chooseCampaignTarget(w, p, home);
      if (target) { c = ai.campaign = { target: target.id, from: home.id, since: w.now, waves: 0, fails: 0 }; break; }
    }
    if (!c) return;
  }
  const home = w.villages[c.from], target = w.villages[c.target];
  // our attacks (and scouts) still on the road there: wait for them
  if (commandsOf(w, p.id).some((cm) => cm.toVid === target.id && cm.kind === 'attack' && cm.tag !== 'fake')) return;
  // the noblemen come home before the next wave
  const nobles = home.units.noble ?? 0;
  if (nobles < 1) return;
  // never march out with the enemy at the gates
  if (commandsTo(w, home.id).some((cm) => cm.kind === 'attack' && cm.ownerId !== p.id && cm.arrive - w.now < aiThinkInterval(w) * 6)) return;
  const intel = p.intel[target.id];
  const seen = Math.max(intel?.scoutT ?? 0, intel?.lastAttackT ?? 0);
  const fresh = intel?.units !== undefined && w.now - seen < INTEL_FRESH;
  // a fresh look first. A party that never came back means they keep scouts: send a bigger one, and
  // after that give up on a player's village (nobody sends noblemen in blind); barbarians rarely hide much
  if (!fresh) {
    if (c.scoutAt !== undefined) {
      c.scoutAt = undefined;
      (ai.scoutFails ??= {})[target.id] = (ai.scoutFails[target.id] ?? 0) + 1;
      if (target.ownerId !== null) { c.fails++; if (c.fails >= CAMPAIGN_FAILS) { endCampaign(w, p, false); return; } }
    }
    const party = Math.min(home.units.scout ?? 0, scoutParty(ai, target.id));
    if (party >= 3 && sendTroops(w, { ownerId: p.id, fromVid: home.id, toVid: target.id, kind: 'attack', units: { scout: party }, tag: 'scout' }).ok) {
      c.scoutAt = w.now;
      return;
    }
    if (target.ownerId !== null) return; // no scouts to spare: wait for some
  }
  const t = traitsOf(w, p);
  const wall = intel?.buildings?.wall ?? intel?.wall ?? 0;
  const known = fresh ? intel!.units ?? {} : undefined;
  // loyalty now, and noblemen enough to finish it in one go if we have them
  const loyal = Math.min(100, target.loyalty + ((w.now - target.loyaltyAt) / 3_600_000) * loyaltyRegen(w.config.speed));
  const count = Math.min(nobles, Math.max(1, Math.ceil(loyal / 22)), 5);
  // each nobleman rides with an escort; the rest of the army goes first to clear the way
  const escort: Units = {};
  for (const u of ['axe', 'light', 'heavy', 'marcher', 'sword', 'spear'] as UnitId[]) {
    const k = Math.min(Math.floor(((home.units[u] ?? 0) * 0.05) / count), u === 'axe' || u === 'spear' ? 50 : 20);
    if (k > 0) escort[u] = k;
  }
  const clear: Units = {};
  for (const u of OFFENSIVE) {
    const left = (home.units[u] ?? 0) - (escort[u] ?? 0) * count;
    if (left > 0) clear[u] = left;
  }
  if (wall === 0) delete clear.ram;
  else if (clear.ram) clear.ram = Math.min(clear.ram, 10 + wall * 12);
  const def = known ?? {};
  const sim = resolveBattle({
    att: clear, attTech: home.tech, attItem: null, defStacks: [{ units: def, tech: {} }], defItems: [],
    wall, luck: 0, morale: moraleAgainst(w, p, target),
  });
  // an empty village needs no clearing; an unknown one needs a real army
  const emptyish = known !== undefined && unitsCount(def) - (def.scout ?? 0) <= 5 && wall <= 1;
  const blindNeed = target.ownerId === null ? 600 + target.points * 2 : 2500 + target.points * 3;
  const wins = hasUnits(clear) && sim.winner === 'attacker' && sim.attStrength >= sim.defStrength * t.caution
    && (known !== undefined || sim.attStrength >= blindNeed);
  let helpers: { v: Village; units: Units }[] | null = null;
  if (!wins && !emptyish && known !== undefined) {
    // too strong for the noble village's army alone: our other villages clear it, landing just ahead of the noblemen
    const joint = gatherArmies(w, p, home, target, clear, t.caution);
    helpers = joint ? joint.filter((j) => j.v.id !== home.id) : null;
  }
  if (!wins && !emptyish && !helpers?.length) {
    // too strong for us: find something else (and come back to it another day)
    endCampaign(w, p, false);
    return;
  }
  const h = attackHero(home);
  if (h && hasUnits(clear)) clear[h] = 1;
  const waves: Units[] = [];
  if (hasUnits(clear)) waves.push(clear);
  for (let i = 0; i < count; i++) waves.push({ noble: 1, ...escort });
  // catapults only ever go for the wall: nobody wrecks the village they are about to own
  const cat = (clear.catapult ?? 0) > 0 && wall > 0 ? 'wall' as BuildingId : undefined;
  if (!cat) delete clear.catapult;
  // the helpers must be able to land a little ahead of the train
  if (helpers?.length) {
    const trainTime = Math.max(...waves.map((u) => travelTime(w, home, target, u, p.id)));
    const land = w.now + trainTime - 1500;
    if (helpers.some((hlp) => w.now + travelTime(w, hlp.v, target, hlp.units, p.id) > land)) { endCampaign(w, p, false); return; }
    if (!launchTogether(w, p, target, helpers, 'wall', land)) { endCampaign(w, p, false); return; }
  }
  const ok = waves.length >= 2
    ? sendTrain(w, p.id, home.id, target.id, waves, cat).ok
    : sendTroops(w, { ownerId: p.id, fromVid: home.id, toVid: target.id, kind: 'attack', units: waves[0], tag: 'train' }).ok;
  if (!ok) return;
  c.waves++;
  c.lastSent = w.now;
  c.scoutAt = undefined;
  ai.lastConquest = w.now;
  noteHit(w, p, target);
  if (t.faker && target.ownerId !== null) sendFakes(w, p, home, target);
}

/**
 * A couple of fake attacks (a single ram or axeman each) at the same player's other
 * villages, sent with a real one, so the defender can't tell which to hold.
 */
function sendFakes(w: World, p: Player, home: Village, target: Village): void {
  const owner = w.players[target.ownerId!];
  if (!owner) return;
  const reach = traitsOf(w, p).reach + 5;
  const others = owner.villages
    .filter((id) => id !== target.id)
    .map((id) => w.villages[id])
    .filter((v): v is Village => !!v && distance(home.x, home.y, v.x, v.y) <= reach)
    .slice(0, 2);
  for (const o of others) {
    const u: UnitId | null = (home.units.ram ?? 0) > 3 ? 'ram' : (home.units.axe ?? 0) > 50 ? 'axe' : (home.units.spear ?? 0) > 50 ? 'spear' : null;
    if (!u) return;
    sendTroops(w, { ownerId: p.id, fromVid: home.id, toVid: o.id, kind: 'attack', units: { [u]: 1 }, tag: 'fake' });
  }
}

/** Is a tribe mate trying to take this very village? */
function mateCampaignOn(w: World, p: Player, vid: number): boolean {
  if (p.tribeId === null) return false;
  return !!w.tribes[p.tribeId]?.members.some((m) => m !== p.id && w.players[m]?.ai?.campaign?.target === vid);
}

/** Is this player someone our tribe is at war with, or someone a tribe mate is taking villages from? */
function tribeEnemy(w: World, p: Player, o: Player): boolean {
  if (p.tribeId === null) return false;
  if (relation(w, p.tribeId, o.tribeId) === 'enemy') return true;
  const t = w.tribes[p.tribeId];
  return !!t?.members.some((m) => {
    const c = m !== p.id ? w.players[m]?.ai?.campaign : undefined;
    return c !== undefined && w.villages[c.target]?.ownerId === o.id;
  });
}

/**
 * Now and then a ruler scouts a player's village nearby that it knows nothing
 * recent about, as people keep tabs on their neighbours: careful and opportunistic
 * rulers more often. One small party at a time.
 */
function scoutRound(w: World, p: Player): void {
  const ai = p.ai!;
  const pers = ai.personality;
  const every = (pers === 'opportunist' ? 2 : pers === 'turtle' || pers === 'guardian' ? 6 : 3) * 3_600_000;
  if (w.now - (ai.lastScoutRound ?? -Infinity) < every) return;
  ai.lastScoutRound = w.now;
  const reach = traitsOf(w, p).reach;
  for (const vid of p.villages) {
    const home = w.villages[vid];
    if (!home || (home.units.scout ?? 0) < 10 || home.buildings.rally < 1) continue;
    let best: Village | null = null, bestD = Infinity;
    for (const t of villagesNear(w, home.x, home.y, reach)) {
      if (t.ownerId === null || t.ownerId === p.id) continue;
      const o = w.players[t.ownerId];
      if (!o || isProtected(w, o.id) || (o.tribeId !== null && o.tribeId === p.tribeId)) continue;
      if (o.kind === 'human' && (!ai.hostile || !mayHit(w, p, o.id))) continue;
      const intel = p.intel[t.id];
      if (intel?.scoutT !== undefined && w.now - intel.scoutT < 12 * 3_600_000) continue;
      const d = distance(home.x, home.y, t.x, t.y);
      if (d < bestD) { best = t; bestD = d; }
    }
    if (!best) continue;
    const n = Math.min(home.units.scout ?? 0, scoutParty(ai, best.id));
    sendTroops(w, { ownerId: p.id, fromVid: home.id, toVid: best.id, kind: 'attack', units: { scout: n }, tag: 'scout' });
    return;
  }
}

// ---------- helping tribe mates ----------

/**
 * A real attack on one of our own villages (not a scout, not a lone fake) that we
 * see coming: the nearest of our other villages sends a share of its defenders, if
 * they can get there first. Brought home with the tribe help below.
 */
function holdTheLine(w: World, p: Player): void {
  const ai = p.ai!;
  if (p.villages.length < 2) return;
  for (const vid of p.villages) {
    if (ai.support?.[vid]) continue;
    const hv = w.villages[vid];
    if (!hv) continue;
    const threats = commandsTo(w, vid).filter((cm) => cm.kind === 'attack' && cm.ownerId !== p.id && cm.tag !== 'scout' && cm.tag !== 'fake' && unitsCount(cm.units) > 20);
    if (!threats.length) continue;
    const first = Math.min(...threats.map((cm) => cm.arrive));
    let best: Village | null = null, bestD = Infinity;
    for (const ovid of p.villages) {
      const o = w.villages[ovid];
      if (!o || o.id === vid || o.buildings.rally < 1 || ai.campaign?.from === o.id) continue;
      if (commandsTo(w, o.id).some((cm) => cm.kind === 'attack' && cm.ownerId !== p.id)) continue;
      const d = distance(o.x, o.y, hv.x, hv.y);
      if (d > 12 || d >= bestD) continue;
      best = o;
      bestD = d;
    }
    if (!best) continue;
    const send: Units = {};
    for (const u of ['spear', 'sword', 'archer', 'heavy'] as UnitId[]) {
      const n = Math.floor((best.units[u] ?? 0) * 0.5);
      if (n >= 10) send[u] = n;
    }
    if (unitsCount(send) < 30) continue;
    if (w.now + travelTime(w, best, hv, send, p.id, true) > first) continue;
    if (sendTroops(w, { ownerId: p.id, fromVid: best.id, toVid: vid, kind: 'support', units: send, tag: 'help' }).ok) {
      (ai.support ??= {})[vid] = { from: best.id, at: w.now };
      return; // one village at a time per look, as a person would
    }
  }
}

/** Support stays at most this long, and goes home sooner once the danger has passed. */
const SUPPORT_STAY = 3 * 3_600_000;

/**
 * A tribe mate under attack gets help from rulers who are the helping kind: a share
 * of the defenders from their nearest village that can get there before the attack
 * does. The troops come home once nothing more is on the way, or when they are
 * needed at home.
 */
function helpAllies(w: World, p: Player): void {
  const ai = p.ai!;
  holdTheLine(w, p);
  for (const k in ai.support ?? {}) {
    const hostId = Number(k), s = ai.support![hostId];
    const hv = w.villages[hostId];
    const stationed = hv?.support.some((st) => st.fromVid === s.from && st.ownerId === p.id);
    const marching = commandsOf(w, p.id).some((cm) => cm.kind === 'support' && cm.toVid === hostId);
    if (marching) continue;
    const threatened = !!hv && commandsTo(w, hostId).some((cm) => cm.kind === 'attack' && cm.ownerId !== hv.ownerId);
    const homeHit = commandsTo(w, s.from).some((cm) => cm.kind === 'attack' && cm.ownerId !== p.id);
    const done = !hv || hv.ownerId === null || (hv.ownerId !== p.id && (p.tribeId === null || w.players[hv.ownerId]?.tribeId !== p.tribeId));
    if (!stationed || done || homeHit || w.now - s.at > SUPPORT_STAY || (!threatened && w.now - s.at > 45 * MIN)) {
      if (stationed) withdrawSupport(w, p.id, hostId, s.from);
      delete ai.support![hostId];
    }
  }
  const t = traitsOf(w, p);
  if (t.helper <= 0 || p.tribeId === null) return;
  const tribe = w.tribes[p.tribeId];
  if (!tribe) return;
  for (const m of tribe.members) {
    if (m === p.id) continue;
    const mate = w.players[m];
    if (!mate || mate.eliminated) continue;
    for (const vid of mate.villages) {
      if (ai.support?.[vid]) continue;
      const hv = w.villages[vid];
      if (!hv) continue;
      const threats = commandsTo(w, vid).filter((cm) => cm.kind === 'attack' && cm.ownerId !== m && w.players[cm.ownerId]?.tribeId !== tribe.id && cm.tag !== 'farm');
      if (!threats.length) continue;
      // make up our mind once per threat, not every look
      const key = threats[0].id;
      if (((key * 2654435761) >>> 0) % 1000 >= t.helper * 1000) continue;
      const first = Math.min(...threats.map((cm) => cm.arrive));
      let best: Village | null = null, bestD = Infinity;
      for (const ovid of p.villages) {
        const o = w.villages[ovid];
        if (!o || o.buildings.rally < 1 || ai.campaign?.from === o.id) continue;
        if (commandsTo(w, o.id).some((cm) => cm.kind === 'attack' && cm.ownerId !== p.id)) continue;
        const d = distance(o.x, o.y, hv.x, hv.y);
        if (d > 15 || d >= bestD) continue;
        best = o;
        bestD = d;
      }
      if (!best) continue;
      const send: Units = {};
      for (const u of ['spear', 'sword', 'archer', 'heavy'] as UnitId[]) {
        const n = Math.floor((best.units[u] ?? 0) * 0.4);
        if (n >= 10) send[u] = n;
      }
      if (unitsCount(send) < 30) continue;
      if (w.now + travelTime(w, best, hv, send, p.id, true) > first) continue;
      if (sendTroops(w, { ownerId: p.id, fromVid: best.id, toVid: vid, kind: 'support', units: send, tag: 'help' }).ok) {
        (ai.support ??= {})[vid] = { from: best.id, at: w.now };
        return; // one call for help answered per look
      }
    }
  }
}

// ---------- farming ----------

function farm(w: World, p: Player, v: Village): void {
  if (v.buildings.rally < 1) return;
  const ai = p.ai!;
  const hasLight = (v.units.light ?? 0) >= 5;
  const radius = hasLight ? 14 : 8;
  // a person clicks out a few raids per look, and leaves each farm a while to refill
  let sends = ai.raidBudget ?? 2;
  const cooldown = Math.max(aiThinkInterval(w) * 5, 10 * 60_000);
  const targets = villagesNear(w, v.x, v.y, radius)
    .filter((t) => t.ownerId === null && !t.cache && (ai.memory[t.id] ?? 0) + cooldown < w.now)
    .sort((a, b) => distance(v.x, v.y, a.x, a.y) - distance(v.x, v.y, b.x, b.y));
  for (const t of targets) {
    if (sends <= 0) break;
    const intel = p.intel[t.id];
    if (intel?.lastColor === 'red' && w.now - (intel.lastAttackT ?? 0) < cooldown * 10) continue;
    const wall = intel?.wall ?? 0;
    const group = raidGroup(v, wall, expectedHaul(w, intel));
    if (!group) break;
    const r = sendTroops(w, { ownerId: p.id, fromVid: v.id, toVid: t.id, kind: 'attack', units: group, tag: 'farm' });
    if (!r.ok) break;
    ai.memory[t.id] = w.now;
    sends--;
  }
  // a player's village that the scouts found almost undefended is worth a raid too
  if (sends > 0) {
    const group0 = raidGroup(v, 0);
    for (const t of villagesNear(w, v.x, v.y, radius)) {
      if (sends <= 0 || !group0) break;
      if (t.ownerId === null || t.ownerId === p.id) continue;
      const o = w.players[t.ownerId];
      if (!o || o.eliminated || isProtected(w, o.id)) continue;
      if (o.kind === 'human' && !ai.hostile) continue;
      if (o.tribeId != null && o.tribeId === p.tribeId) continue;
      const rel = relation(w, p.tribeId, o.tribeId);
      if (rel === 'ally' || rel === 'nap') continue;
      if ((ai.memory[t.id] ?? 0) + PLAYER_RAID_COOLDOWN > w.now) continue;
      if (!mayHit(w, p, o.id)) continue;
      if ((ai.avoid?.[t.id] ?? 0) > w.now) continue;
      const intel = p.intel[t.id];
      const seenAt = Math.max(intel?.scoutT ?? 0, intel?.lastAttackT ?? 0);
      if (!intel?.units || w.now - seenAt > 2 * 60 * MIN) continue;
      const defenders = unitsCount(intel.units) - (intel.units.scout ?? 0);
      const wall = intel.buildings?.wall ?? intel.wall ?? 0;
      if (defenders > 25 || wall > 3) continue;
      // a person's village is hit hard, not tickled: a fifth of the attackers at home ride along
      const group = raidGroup(v, wall);
      if (group) for (const u of ['axe', 'light', 'marcher', 'heavy'] as UnitId[]) {
        const spare = (v.units[u] ?? 0) - (group[u] ?? 0);
        const add = Math.floor(Math.max(0, spare) * 0.2);
        if (add > 0) group[u] = (group[u] ?? 0) + add;
      }
      if (!group) break;
      if (!sendTroops(w, { ownerId: p.id, fromVid: v.id, toVid: t.id, kind: 'attack', units: group, tag: 'farm' }).ok) break;
      ai.memory[t.id] = w.now;
      noteHit(w, p, t);
      sends--;
    }
  }
  ai.raidBudget = sends;
}

/** A player's village is raided at most this often by one ruler. */
const PLAYER_RAID_COOLDOWN = 30 * 60_000;

/**
 * How much a barbarian village is likely holding: what the scouts last saw, or,
 * if the last raid came home full, a good deal more than it carried. Unknown: nothing to go on.
 */
function expectedHaul(w: World, intel: Player['intel'][number] | undefined): number {
  if (!intel) return 0;
  if (intel.res && intel.scoutT !== undefined && w.now - intel.scoutT < 2 * 60 * MIN) return intel.res.wood + intel.res.clay + intel.res.iron;
  if (intel.lastCapacity && (intel.lastLoot ?? 0) >= intel.lastCapacity * 0.95) return intel.lastCapacity * 1.6;
  return 0;
}

/** Enough to win (a wall calls for more), and enough carriers for the haul we expect, within reason. */
function raidGroup(v: Village, wall: number, haul = 0): Units | null {
  const g0 = raidCore(v, wall);
  if (!g0 || haul <= 0) return g0;
  // top up with carriers (light cavalry first: fast, and they carry the most) until the haul fits
  let carry = unitsCarry(g0);
  const cap = Math.min(haul, carry * 4);
  for (const u of ['light', 'marcher', 'axe', 'spear'] as UnitId[]) {
    if (carry >= cap) break;
    const spare = (v.units[u] ?? 0) - (g0[u] ?? 0);
    if (spare <= 0 || UNITS[u].carry <= 0) continue;
    const add = Math.min(spare, Math.ceil((cap - carry) / UNITS[u].carry));
    g0[u] = (g0[u] ?? 0) + add;
    carry += add * UNITS[u].carry;
  }
  return g0;
}

function raidCore(v: Village, wall: number): Units | null {
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
  const barbs = villagesNear(w, v.x, v.y, 8).filter((t) => t.ownerId === null && !t.cache);
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

/** What a unit is worth to its owner, in resources. */
const unitWorth = (units: Units) => {
  let n = 0;
  for (const k in units) { const u = k as UnitId; const c = UNITS[u].cost; n += (units[u] ?? 0) * (c.wood + c.clay + c.iron); }
  return n;
};
/** How long a ruler waits on things of war, in real time (a person's patience, not a count of looks). */
const WAR_WAIT = {
  /** a scouting plan is dropped if no report comes back in time */
  plan: 20 * MIN,
  /** scouts lost again and again: leave it a while */
  scoutsLost: 60 * MIN,
  /** scouts lost: try again soon, with more of them */
  scoutRetry: 15 * MIN,
  /** the report says it would be a bloodbath */
  tooStrong: 45 * MIN,
  /** the report says it is not worth the trip */
  notWorth: 30 * MIN,
  /** how often, while online, a ruler looks over its war plans */
  check: 4 * MIN,
  /** a scouting report this recent is trusted without scouting again */
  freshReport: 60 * MIN,
  /** a village this ruler just emptied is left alone for a while: nothing to kill, little to take */
  justCleared: 40 * MIN,
};

/** How many scouts to send: a good party to start, three times as many after every party that died. */
function scoutParty(ai: NonNullable<Player['ai']>, target: number): number {
  return Math.min(300, 15 * 3 ** (ai.scoutFails?.[target] ?? 0));
}

/** A grudge fades after this long without fresh fighting. */
const GRUDGE_MS = 60 * 60_000;

/**
 * War, the way a sensible ruler wages it: pick a target, send scouts, wait for the
 * report, then strike only if the report says it will go well (with a noble train
 * if there are noblemen to spare). Now and then a ruler acts on impulse and throws
 * a full or partial attack at someone without scouting first.
 */
function war(w: World, p: Player): void {
  const ai = p.ai!;
  const diff = w.config.difficulty;
  if (ai.targetPlayer != null && w.players[ai.targetPlayer]?.kind === 'human' && w.now - (ai.grudgeAt ?? 0) > GRUDGE_MS) ai.targetPlayer = null;
  const minArmy = diff === 'hard' ? 1500 : diff === 'easy' ? 6000 : 3000;
  const think = aiThinkInterval(w);
  ai.plans ??= {};
  ai.avoid ??= {};
  for (const k in ai.avoid) if (ai.avoid[k] < w.now) delete ai.avoid[k];
  for (const vid of p.villages) {
    const v = w.villages[vid];
    if (!v || v.buildings.rally < 1) continue;
    const army = offensiveArmy(v);
    // a scouting mission is out: wait for its report, then decide
    const plan = ai.plans[vid];
    if (plan) {
      const target = w.villages[plan.target];
      if (!target || target.ownerId === p.id || w.now - plan.since > WAR_WAIT.plan) { delete ai.plans[vid]; continue; }
      const intel = p.intel[plan.target];
      const reported = intel?.scoutT !== undefined && intel.scoutT >= plan.since;
      if (!reported) {
        if (w.commands[plan.scoutCmd]?.kind === 'attack') continue; // still on the road
        // the scouts never came back: the village keeps scouts of its own. Send more next time, and
        // after a couple of lost parties, find out the hard way with a probing attack
        delete ai.plans[vid];
        ai.scoutFails ??= {};
        const fails = (ai.scoutFails[plan.target] = (ai.scoutFails[plan.target] ?? 0) + 1);
        if (fails >= 2 && mayHit(w, p, target.ownerId) && attackValue(army) >= minArmy) {
          const probe: Units = {};
          for (const k in army) {
            const n = Math.floor((army[k as UnitId] ?? 0) * 0.5);
            if (n > 0) probe[k as UnitId] = n;
          }
          probe.scout = Math.min(v.units.scout ?? 0, scoutParty(ai, plan.target));
          if (!probe.scout) delete probe.scout;
          if (sendTroops(w, { ownerId: p.id, fromVid: v.id, toVid: target.id, kind: 'attack', units: probe, tag: 'war' }).ok) {
            noteHit(w, p, target);
            ai.scoutFails[plan.target] = 0;
            continue;
          }
        }
        ai.avoid[plan.target] = w.now + (fails >= 4 ? WAR_WAIT.scoutsLost : WAR_WAIT.scoutRetry);
        continue;
      }
      delete ai.plans[vid];
      if (ai.scoutFails) delete ai.scoutFails[plan.target];
      strike(w, p, v, target, army);
      continue;
    }
    if (!warVillage(w, p, v)) continue;
    // the army of the village running a conquest is spoken for
    if (ai.campaign?.from === v.id) continue;
    if (attackValue(army) < minArmy) continue;
    if (nextRandom(w) > ai.aggression + 0.25) continue;
    // never march out with the enemy at the gates
    if (commandsTo(w, v.id).some((c) => c.kind === 'attack' && c.ownerId !== p.id && c.arrive - w.now < think * 6)) continue;
    const target = pickWarTarget(w, p, v);
    if (!target) continue;
    // every so often a ruler acts on impulse: a blind full or partial attack
    if (nextRandom(w) < 0.025 * (0.5 + ai.aggression)) {
      const share = nextRandom(w) < 0.5 ? 1 : 0.4 + nextRandom(w) * 0.3;
      const send: Units = {};
      for (const k in army) {
        const n = Math.floor((army[k as UnitId] ?? 0) * share);
        if (n > 0) send[k as UnitId] = n;
      }
      if (attackValue(send) >= minArmy * 0.5 && sendTroops(w, { ownerId: p.id, fromVid: v.id, toVid: target.id, kind: 'attack', units: send, tag: 'war' }).ok) noteHit(w, p, target);
      continue;
    }
    const fresh = p.intel[target.id];
    if (fresh?.scoutT !== undefined && w.now - fresh.scoutT < WAR_WAIT.freshReport) { strike(w, p, v, target, army); continue; }
    const scouts = v.units.scout ?? 0;
    const party = scoutParty(ai, target.id);
    if (scouts < Math.min(5, party)) continue;
    const r = sendTroops(w, { ownerId: p.id, fromVid: v.id, toVid: target.id, kind: 'attack', units: { scout: Math.min(scouts, party) }, tag: 'scout' });
    if (r.ok) ai.plans[vid] = { target: target.id, since: w.now, scoutCmd: (r.data as { id: number }).id };
  }
}

/**
 * However many rulers eye the same player, a person gets a breather between
 * attacks: after one lands, the rest of the realm leaves them be for a while.
 * A ruler the player attacked may still strike back sooner.
 */
const HUMAN_BREATHER = 2 * 60 * MIN;
const PAYBACK_WAIT = 30 * MIN;

function lastHitOn(w: World, humanId: number): number {
  let t = 0;
  for (const id in w.players) {
    const h = w.players[id].ai?.lastHit?.[humanId];
    if (h !== undefined && h > t) t = h;
  }
  return t;
}

/** May this ruler attack (or scout for an attack on) this village's owner right now? */
function mayHit(w: World, p: Player, ownerId: number | null, campaign = false): boolean {
  if (ownerId === null || w.players[ownerId]?.kind !== 'human') return true;
  if (campaign) return true;
  const last = lastHitOn(w, ownerId);
  if (!last || w.now - last >= HUMAN_BREATHER / paceOf(w)) return true;
  const ai = p.ai!;
  const mine = ai.lastHit?.[ownerId] ?? 0;
  const wronged = ai.provoked?.[ownerId] ?? 0;
  return wronged > mine && w.now - mine >= PAYBACK_WAIT / paceOf(w);
}

/** Remember who we hit (grudges and the human's attack history). */
function noteHit(w: World, p: Player, target: Village): void {
  const ai = p.ai!;
  if (target.ownerId === null) return;
  if (ai.targetPlayer !== target.ownerId) ai.grudgeAt = w.now;
  ai.targetPlayer = target.ownerId;
  if (w.players[target.ownerId]?.kind === 'human') (ai.lastHit ??= {})[target.ownerId] = w.now;
}

/** The scouting report is in: attack, send a noble train, or let this one be. */
function strike(w: World, p: Player, v: Village, target: Village, army: Units): void {
  const ai = p.ai!;
  const diff = w.config.difficulty;
  const think = aiThinkInterval(w);
  const margin = diff === 'hard' ? 1.1 : diff === 'easy' ? 1.8 : 1.3;
  const intel = p.intel[target.id]!;
  const wall = intel.buildings?.wall ?? intel.wall ?? 0;
  const sim = resolveBattle({
    att: army, attTech: v.tech, attItem: null, defStacks: [{ units: intel.units ?? {}, tech: {} }], defItems: [],
    wall, luck: 0, morale: moraleAgainst(w, p, target),
  });
  if (!mayHit(w, p, target.ownerId)) return;
  if (sim.winner !== 'attacker' || sim.attStrength < sim.defStrength * margin) {
    // too much for this army alone: armies from our other villages, landing together, might do it
    const joint = gatherArmies(w, p, v, target, army, margin);
    if (joint && launchTogether(w, p, target, joint, pickCatTarget(intel.buildings))) { noteHit(w, p, target); return; }
    ai.avoid![target.id] = w.now + WAR_WAIT.tooStrong;
    return;
  }
  if (commandsTo(w, v.id).some((c) => c.kind === 'attack' && c.ownerId !== p.id && c.arrive - w.now < think * 6)) return;
  const send = { ...army };
  if (wall === 0) delete send.ram;
  const cat = (send.catapult ?? 0) > 0 ? pickCatTarget(intel.buildings) : undefined;
  // a hero who fights best on the attack (the goblin chief, the necromancer, the orc king) rides with a real attack
  const h = attackHero(v);
  if (h) send[h] = 1;
  // is a plain attack worth it? loot we can carry and troops we'd destroy, against what we'd lose
  const hidden = hideCap(intel.buildings?.hiding ?? 0);
  const r0 = intel.res;
  const lootable = r0 ? Math.max(0, r0.wood - hidden) + Math.max(0, r0.clay - hidden) + Math.max(0, r0.iron - hidden) : 0;
  const gain = Math.min(lootable, unitsCarry(sim.attSurvivors)) + unitWorth(intel.units ?? {}) * 0.5
    + (target.ownerId !== null && ai.targetPlayer === target.ownerId ? 600 : 0);
  const cost = unitWorth(sim.attLost);
  if (gain < 1500 || gain < cost * 0.8) { ai.avoid![target.id] = w.now + WAR_WAIT.notWorth; return; }
  if (sendTroops(w, { ownerId: p.id, fromVid: v.id, toVid: target.id, kind: 'attack', units: send, catTarget: cat, tag: 'war' }).ok) noteHit(w, p, target);
}

/**
 * A combined strike, the way players time one: when a single village's army can't
 * win, the offensive armies of our other villages within reach are added, strongest
 * first (at most four villages in all), until the battle would be won with the
 * margin we want. Null when even all of them together would not do it.
 */
function gatherArmies(w: World, p: Player, lead: Village, target: Village, leadArmy: Units, margin: number): { v: Village; units: Units }[] | null {
  const ai = p.ai!;
  const intel = p.intel[target.id];
  const wall = intel?.buildings?.wall ?? intel?.wall ?? 0;
  const reach = traitsOf(w, p).reach;
  const others = p.villages
    .map((id) => w.villages[id])
    .filter((o): o is Village => !!o && o.id !== lead.id && o.buildings.rally > 0 && ai.campaign?.from !== o.id
      && warVillage(w, p, o) && distance(o.x, o.y, target.x, target.y) <= reach
      && !commandsTo(w, o.id).some((c) => c.kind === 'attack' && c.ownerId !== p.id))
    .map((o) => ({ v: o, units: offensiveArmy(o) }))
    .filter((x) => attackValue(x.units) > 0)
    .sort((a, b) => attackValue(b.units) - attackValue(a.units));
  const picked: { v: Village; units: Units }[] = hasUnits(leadArmy) ? [{ v: lead, units: leadArmy }] : [];
  const total: Units = { ...leadArmy };
  for (const o of others) {
    if (picked.length >= 4) break;
    picked.push(o);
    for (const k in o.units) total[k as UnitId] = (total[k as UnitId] ?? 0) + (o.units[k as UnitId] ?? 0);
    if (wall === 0) delete total.ram;
    const sim = resolveBattle({
      att: total, attTech: lead.tech, attItem: null, defStacks: [{ units: intel?.units ?? {}, tech: {} }], defItems: [],
      wall, luck: 0, morale: moraleAgainst(w, p, target),
    });
    if (sim.winner === 'attacker' && sim.attStrength >= sim.defStrength * margin) return picked.length > 1 ? picked : null;
  }
  return null;
}

/**
 * Send armies from several villages so they land together (the slowest sets the
 * time; the others wait to leave). `before` makes them all land that long before a
 * given moment instead, as a clearing wave ahead of a noble train. False if any
 * could not get there in time.
 */
function launchTogether(w: World, p: Player, target: Village, armies: { v: Village; units: Units }[], cat?: BuildingId, landBy?: number): boolean {
  const legs = armies.map((a) => {
    const units = { ...a.units };
    if ((units.catapult ?? 0) === 0) delete units.catapult;
    return { ...a, units, dur: travelTime(w, a.v, target, units, p.id) };
  });
  const slowest = Math.max(...legs.map((l) => l.dur));
  const land = landBy ?? w.now + slowest + 60_000;
  if (legs.some((l) => w.now + l.dur > land)) return false;
  let sent = 0;
  legs.forEach((l, i) => {
    const r = sendTroops(w, {
      ownerId: p.id, fromVid: l.v.id, toVid: target.id, kind: 'attack', units: l.units,
      catTarget: (l.units.catapult ?? 0) > 0 ? cat : undefined, arriveAt: land + i * 150, tag: 'war',
    });
    if (r.ok) sent++;
  });
  return sent > 0;
}

/** The morale our troops would fight with against this village (a much smaller player's people fight harder). */
function moraleAgainst(w: World, p: Player, target: Village): number {
  if (!w.config.morale || target.ownerId === null) return 1;
  const o = w.players[target.ownerId];
  return o ? moraleFor(o.points, p.points) : 1;
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
    const rel = relation(w, p.tribeId, o.tribeId);
    if (rel === 'ally' || rel === 'nap') continue;
    if ((ai.avoid?.[t.id] ?? 0) > w.now) continue;
    if (Object.values(ai.plans ?? {}).some((pl) => pl.target === t.id)) continue;
    if (o.kind === 'human') {
      if (!ai.hostile) continue;
      if (!mayHit(w, p, o.id)) continue;
      if (ai.targetPlayer !== o.id && humansTargetedBy(w, o.id) >= humanCap) continue;
      if (diff === 'easy' && o.points > p.points * 0.8) continue;
    }
    const seen = p.intel[t.id];
    if (seen?.lastColor === 'green' && w.now - (seen.lastAttackT ?? 0) < WAR_WAIT.justCleared) continue;
    const d = distance(v.x, v.y, t.x, t.y);
    let score = -d * 3 + t.points / 50;
    if (ai.targetPlayer === o.id) score += 40;
    if (tribeEnemy(w, p, o)) score += 30;
    if (mateCampaignOn(w, p, t.id)) score += 60;
    const intel = p.intel[t.id];
    if (intel?.lastColor === 'red' && w.now - (intel.lastAttackT ?? 0) < aiThinkInterval(w) * 30) score -= 80;
    // what our reports say (if they are recent): an army we can beat, and something to carry home
    const seenAt = Math.max(intel?.scoutT ?? 0, intel?.lastAttackT ?? 0);
    if (intel?.units && w.now - seenAt < 3 * 3_600_000) {
      const army = offensiveArmy(v);
      const sim = resolveBattle({
        att: army, attTech: v.tech, attItem: null, defStacks: [{ units: intel.units, tech: {} }], defItems: [],
        wall: intel.buildings?.wall ?? intel.wall ?? 0, luck: 0, morale: moraleAgainst(w, p, t),
      });
      score += sim.winner === 'attacker' ? 25 : -40;
      if (intel.res) score += Math.min(20, (intel.res.wood + intel.res.clay + intel.res.iron) / 5000);
    }
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return best;
}

// ---------- hooks ----------

export function aiOnConquest(w: World, v: Village, oldOwner: number | null, newOwner: number): void {
  const np = w.players[newOwner];
  if (np?.ai?.campaign?.target === v.id) endCampaign(w, np, true);
  const op = oldOwner !== null ? w.players[oldOwner] : undefined;
  if (op?.ai) {
    // the first loss starts the clock; losing it again the same day does not restart the counter-attack
    // losing a village breaks a streak
    op.ai.streak = 0;
    op.ai.cold = (op.ai.cold ?? 0) + 1;
    const lost = (op.ai.lost ??= {});
    if (lost[v.id] === undefined || w.now - lost[v.id] > realmDayMs(w)) lost[v.id] = w.now;
    op.ai.targetPlayer = newOwner;
    op.ai.grudgeAt = w.now;
    if (op.ai.campaign && w.villages[op.ai.campaign.from]?.ownerId !== op.id) endCampaign(w, op, false);
  }
  // whoever was after this village from someone else starts over
  for (const id in w.players) {
    const o = w.players[id];
    if (o.id !== newOwner && o.ai?.campaign?.target === v.id && o.ai.campaign.since < w.now) {
      const inRange = o.villages.some((vid) => { const h = w.villages[vid]; return h && distance(h.x, h.y, v.x, v.y) <= traitsOf(w, o).reach; });
      if (!inRange || v.ownerId === null) endCampaign(w, o, false);
    }
  }
}

export function aiOnBattle(w: World, c: Command, target: Village, data: BattleData): void {
  logIncident(w, c, target, data);
  // a campaign's noble wave beaten back counts against it
  const att = w.players[c.ownerId];
  if (att?.ai?.campaign?.target === target.id && c.tag === 'train' && data.winner !== 'attacker') att.ai.campaign.fails++;
  // rulers remember who hit them and may retaliate
  if (target.ownerId === null) return;
  const victim = w.players[target.ownerId];
  if (!victim?.ai || c.ownerId === victim.id) return;
  // and what they were hit with (it fades: every new attack counts, older ones count less)
  if (c.tag !== 'scout' && c.tag !== 'fake') {
    const th = victim.ai.threat && w.now - victim.ai.threat.t < 2 * realmDayMs(w) ? victim.ai.threat : { cav: 0, inf: 0, arc: 0, t: w.now };
    th.cav *= 0.8; th.inf *= 0.8; th.arc *= 0.8;
    for (const k in data.attUnits) {
      const u = k as UnitId, n = data.attUnits[u] ?? 0;
      const cls = UNITS[u].cls;
      if (u === 'scout' || u === 'noble' || n <= 0) continue;
      if (cls === 'cav') th.cav += n * UNITS[u].pop; else if (cls === 'arc') th.arc += n * UNITS[u].pop; else th.inf += n * UNITS[u].pop;
    }
    th.t = w.now;
    victim.ai.threat = th;
  }
  const attacker = w.players[c.ownerId];
  if (!attacker) return;
  if (attacker.kind === 'human' && !victim.ai.hostile) return;
  if (attacker.kind === 'human' && data.winner === 'attacker') (victim.ai.provoked ??= {})[attacker.id] = w.now;
  if (data.winner === 'attacker' || nextRandom(w) < 0.3) {
    victim.ai.targetPlayer = attacker.id;
    victim.ai.grudgeAt = w.now;
    victim.ai.aggression = Math.min(1, victim.ai.aggression + 0.1);
  }
}

// ---------- tribes ----------

/**
 * Rulers take part in tribe life: they answer invitations (joining tribes that are
 * worth it), tribe leaders recruit nearby rulers now and then, and they answer
 * other tribes' diplomacy: a pact from an equal is returned, a declaration of war
 * is returned in kind.
 */
/**
 * How much a tribe is worth to this ruler: its strength next to theirs, and how
 * many of its members live close enough to help (a tribe on the other side of the
 * realm is little use when the axes arrive).
 */
function tribeAppeal(w: World, p: Player, t: Tribe): number {
  const home = w.villages[p.villages[0]];
  const strength = Math.min(5, tribePoints(w, t) / Math.max(1, p.points));
  let near = 0;
  for (const m of t.members) {
    if (m === p.id) continue;
    const o = w.players[m];
    const ov = o && !o.eliminated ? w.villages[o.villages[0]] : undefined;
    if (home && ov && distance(home.x, home.y, ov.x, ov.y) <= 30) near++;
  }
  return strength + near * 0.6;
}


/**
 * A ruler's life in the tribes, as people play it: take a good invitation, move
 * on to a clearly better tribe nearby after a while, walk out of a tribe that has
 * dwindled to nothing or whose members all live far away, and, left on their own
 * long enough, found a tribe and start recruiting. Nothing is forced; each step is
 * taken only when it pays.
 */
function tribeLife(w: World, p: Player): void {
  if (nextRandom(w) > 0.12) return;
  const ai = p.ai!;
  const myPts = p.points;
  const t0 = tribeOf(w, p.id);
  if (t0) { ai.tribeSince ??= w.now; ai.tribelessSince = undefined; } else { ai.tribelessSince ??= w.now; ai.tribeSince = undefined; }
  const settled = t0 ? w.now - ai.tribeSince! : 0;
  // invitations waiting for us
  for (const inv of invitesFor(w, p.id)) {
    const appeal = tribeAppeal(w, p, inv.tribe);
    if (!t0) {
      if (appeal >= 0.6 || nextRandom(w) < 0.25) {
        if (acceptInvite(w, p.id, inv.tribe.id).ok) { ai.tribeSince = w.now; return; }
      }
      if (nextRandom(w) < 0.3) declineInvite(w, p.id, inv.tribe.id);
    } else if (settled > realmDayMs(w) && appeal > tribeAppeal(w, p, t0) * 1.8 + 0.5 && !(t0.founderId === p.id && t0.members.length > 1)) {
      // a much better offer close by: say goodbye and go
      leaveTribe(w, p.id);
      if (acceptInvite(w, p.id, inv.tribe.id).ok) { ai.tribeSince = w.now; return; }
    } else if (nextRandom(w) < 0.2) declineInvite(w, p.id, inv.tribe.id);
  }
  // a tribe that no longer makes sense: alone in it for days, or every tribe mate lives far away
  if (t0 && settled > 2 * realmDayMs(w)) {
    const mates = t0.members.filter((m) => m !== p.id && !w.players[m]?.eliminated);
    const lonely = mates.length === 0;
    const scattered = mates.length > 0 && tribeAppeal(w, p, t0) < Math.min(5, tribePoints(w, t0) / Math.max(1, myPts)) + 0.3;
    if ((lonely && nextRandom(w) < 0.15) || (scattered && t0.founderId !== p.id && nextRandom(w) < 0.06)) {
      leaveTribe(w, p.id);
      ai.tribelessSince = w.now;
      return;
    }
  }
  // on our own: ask a good tribe nearby that is recruiting to take us in (one request at a time)
  if (!t0) {
    const waiting = applicationsBy(w, p.id)[0];
    if (waiting && w.now - waiting.t > 12 * HOUR_MS) withdrawApplication(w, p.id, waiting.tribe.id);
    else if (!waiting && w.now - (ai.tribelessSince ?? w.now) > 3 * HOUR_MS && nextRandom(w) < 0.35) {
      let best: Tribe | null = null, bestAppeal = 0.5;
      for (const id in w.tribes) {
        const t = w.tribes[id];
        if (!t.recruiting || tribeFull(t)) continue;
        if (w.now - (ai.turnedAway?.[t.id] ?? -Infinity) < 2 * realmDayMs(w)) continue;
        const a = tribeAppeal(w, p, t);
        // a tribe with nobody close by is no help (and would soon be left again)
        const near = a - Math.min(5, tribePoints(w, t) / Math.max(1, p.points));
        if (near < 0.6) continue;
        if (a > bestAppeal) { bestAppeal = a; best = t; }
      }
      if (best && applyToTribe(w, p.id, best.id).ok) return;
    }
  }
  // on our own for a while: found a tribe and gather the neighbours (likelier for a born leader,
  // and far likelier with several rulers nearby who have no tribe either)
  if (!t0 && w.now - (ai.tribelessSince ?? w.now) > FOUND_AFTER && myPts >= 600) {
    const lead = ai.personality === 'warlord' || ai.personality === 'expander' || ai.personality === 'opportunist' ? 0.12 : 0.05;
    const loners = tribelessNear(w, p, 25);
    const chance = lead * (loners >= 3 ? 2.5 : loners >= 1 ? 1.3 : 0.5);
    if (nextRandom(w) < chance) {
      for (let tries = 0; tries < 4; tries++) {
        const tn = tribeName(w);
        if (createTribe(w, p.id, tn.name, tn.tag).ok) { ai.tribeSince = w.now; break; }
      }
    }
    return;
  }
  const t = tribeOf(w, p.id);
  if (!t || !hasRight(t, p.id, 'invite')) return;
  const tp = tribePoints(w, t);
  if (t.founderId === p.id && seekMerger(w, p, t, tp)) return;
  // answer other tribes' diplomacy
  if (!hasRight(t, p.id, 'diplomacy')) return;
  tribeDiplomacy(w, p, t, tp);
  // a tribe that took one of ours is an enemy
  for (const [vid, at] of Object.entries(ai.lost ?? {})) {
    if (w.now - at > realmDayMs(w)) continue;
    const taker = w.villages[Number(vid)]?.ownerId;
    const tt = taker != null ? w.players[taker]?.tribeId : null;
    if (tt != null && tt !== t.id && t.diplomacy?.[tt] !== 'enemy' && t.diplomacy?.[tt] !== 'ally') setDiplomacy(w, p.id, tt, 'enemy');
  }
  // a neighbour tribe three times our size: offer a pact (once in a while, and only once)
  if (nextRandom(w) < 0.05) {
    for (const id in w.tribes) {
      const other = w.tribes[id];
      if (other.id === t.id || t.diplomacy?.[other.id]) continue;
      if (tribePoints(w, other) < tp * 3) continue;
      const home = w.villages[p.villages[0]];
      const near = home && other.members.some((m) => {
        const ov = w.villages[w.players[m]?.villages[0] ?? -1];
        return ov && distance(home.x, home.y, ov.x, ov.y) <= 25;
      });
      if (near) { setDiplomacy(w, p.id, other.id, 'nap'); break; }
    }
  }
  for (const id in w.tribes) {
    const other = w.tribes[id];
    if (other.id === t.id) continue;
    const theirView = other.diplomacy?.[t.id];
    const ours = t.diplomacy?.[other.id];
    if (!theirView || ours === theirView) continue;
    const op = tribePoints(w, other);
    if (theirView === 'enemy') {
      setDiplomacy(w, p.id, other.id, 'enemy');
      ((t.friction ??= {})[other.id] ??= { n: 0, at: w.now }).warSince ??= w.now;
    }
    else if (theirView === 'nap' && !ours && op >= tp * 0.6) setDiplomacy(w, p.id, other.id, 'nap');
    else if (theirView === 'ally' && !ours && op >= tp * 0.8) setDiplomacy(w, p.id, other.id, nextRandom(w) < 0.5 ? 'ally' : 'nap');
  }
}

const HOUR_MS = 3_600_000;
/** A ruler without a tribe thinks about founding one after this long. */
const FOUND_AFTER = 5 * HOUR_MS;

/** Rulers without a tribe living within this many fields of us. */
function tribelessNear(w: World, p: Player, r: number): number {
  const home = w.villages[p.villages[0]];
  if (!home) return 0;
  const seen = new Set<number>();
  for (const v of villagesNear(w, home.x, home.y, r)) {
    const o = v.ownerId !== null ? w.players[v.ownerId] : null;
    if (o && o.id !== p.id && o.kind === 'ai' && o.tribeId === null && !o.eliminated) seen.add(o.id);
  }
  return seen.size;
}

/** Tribes that have members within this many fields of ours. */
function neighbourTribes(w: World, t: Tribe, r: number): Tribe[] {
  const out = new Set<number>();
  for (const m of t.members) {
    const home = w.villages[w.players[m]?.villages[0] ?? -1];
    if (!home) continue;
    for (const v of villagesNear(w, home.x, home.y, r)) {
      const o = v.ownerId !== null ? w.players[v.ownerId] : null;
      if (o?.tribeId != null && o.tribeId !== t.id) out.add(o.tribeId);
    }
  }
  return [...out].map((id) => w.tribes[id]).filter((x): x is Tribe => !!x);
}

/**
 * A tribe's dealings with the tribes around it, decided by its leader now and then:
 *  - war on a tribe whose attacks have built up bad blood (people's tribes too), or,
 *    for a warlike leader, on a rival of about its own size right next door;
 *  - an alliance with a tribe fighting the same enemy (their leaders answer as they see fit);
 *  - peace with an enemy once the fighting has died down for a couple of days.
 * Tribes of people keep their own counsel; only rulers' tribes are steered here.
 */
function tribeDiplomacy(w: World, p: Player, t: Tribe, tp: number): void {
  if (nextRandom(w) > 0.06) return;
  const ai = p.ai!;
  const warlike = ai.personality === 'warlord' || ai.personality === 'opportunist' ? 1 : ai.personality === 'turtle' || ai.personality === 'guardian' ? 0.35 : 0.6;
  const around = neighbourTribes(w, t, 25);
  const fr = (t.friction ??= {});
  for (const o of around) {
    const cur = t.diplomacy?.[o.id];
    const bad = fr[o.id] ? frictionNow(w, fr[o.id]) : 0;
    const op = tribePoints(w, o);
    if (cur === 'enemy') {
      // peace, when the war has gone quiet for a while
      const since = fr[o.id]?.warSince ?? w.now;
      if (bad < 0.5 && w.now - since > 2 * realmDayMs(w) && nextRandom(w) < 0.3) {
        setDiplomacy(w, p.id, o.id, null);
        const theirLead = w.players[o.founderId ?? -1];
        if (theirLead?.kind === 'ai' && o.diplomacy?.[t.id] === 'enemy') setDiplomacy(w, theirLead.id, t.id, null);
        news(w, `[${t.tag}] and [${o.tag}] have made peace.`, 'world');
      }
      continue;
    }
    if (cur === 'ally') continue;
    // war: enough bad blood, or a warlike leader eyeing a rival its own size
    const rival = op > tp * 0.6 && op < tp * 1.5;
    if (bad >= 4 / warlike || (rival && nextRandom(w) < 0.08 * warlike)) {
      setDiplomacy(w, p.id, o.id, 'enemy');
      (fr[o.id] ??= { n: bad, at: w.now }).warSince = w.now;
      news(w, `[${t.tag}] ${t.name} has declared war on [${o.tag}] ${o.name}.`, 'world');
      return;
    }
    // an alliance against a common enemy
    const ours = Object.entries(t.diplomacy ?? {}).filter(([, d]) => d === 'enemy').map(([id]) => Number(id));
    const common = ours.some((e) => o.diplomacy?.[e] === 'enemy');
    if (common && !cur && op >= tp * 0.4 && nextRandom(w) < 0.5) {
      setDiplomacy(w, p.id, o.id, 'ally');
      news(w, `[${t.tag}] offers an alliance to [${o.tag}] against their common enemy.`, 'world');
      return;
    }
  }
}

/**
 * Tribes grow the way they do on a real server: a small tribe of rulers, a few days
 * old, now and then folds into a much stronger tribe close by (one that is not its
 * enemy and has room), so over the round tribes of five become tribes of ten and
 * fifteen. Its founder decides; only tribes of computer rulers merge (people choose
 * their own tribe). About one chance in a day or so per small tribe.
 */
function seekMerger(w: World, p: Player, t: Tribe, tp: number): boolean {
  if (nextRandom(w) > 0.04) return false;
  if (w.now - (t.createdAt ?? 0) < 2 * realmDayMs(w)) return false;
  if (t.members.some((m) => w.players[m]?.kind !== 'ai')) return false;
  const target = aiTribeTarget(w);
  let best: Tribe | null = null, bestScore = 0;
  for (const id in w.tribes) {
    const o = w.tribes[id];
    if (o.id === t.id || o.members.length + t.members.length > target) continue;
    if (w.players[o.founderId ?? -1]?.kind !== 'ai') continue;
    if (t.diplomacy?.[o.id] === 'enemy' || o.diplomacy?.[t.id] === 'enemy') continue;
    const op = tribePoints(w, o);
    if (op < tp * 1.5 || o.members.length < t.members.length) continue;
    // how many of theirs live close to ours
    const appeal = tribeAppeal(w, p, o);
    const near = appeal - Math.min(5, op / Math.max(1, p.points));
    if (near < 1) continue;
    const score = near + Math.min(3, op / Math.max(1, tp));
    if (score > bestScore) { bestScore = score; best = o; }
  }
  return !!best && mergeTribes(w, t.id, best.id);
}

/**
 * How big a tribe led by AI rulers aims to be: small at first, growing with the
 * realm, so tribes fill up steadily over the round instead of all at once.
 */
export function aiTribeTarget(w: World): number {
  return Math.min(TRIBE_MAX_MEMBERS, 6 + Math.floor((w.now / realmDayMs(w)) * 1.5));
}
/** A recruiting tribe sends out an invitation about this often (while its recruiter is online). */
const RECRUIT_GAP = 75 * 60_000;

/**
 * Recruiting, the way an active tribe does it: requests to join get an answer, and
 * a tribe led by AI rulers keeps its doors open (the "recruiting" badge on the
 * rankings) and keeps inviting neighbours without a tribe until it is as big as it
 * wants to be.
 */
function tribeRecruiting(w: World, p: Player): void {
  const t = tribeOf(w, p.id);
  if (!t || !hasRight(t, p.id, 'invite')) return;
  const ai = p.ai!;
  // a tribe run by AI rulers manages its own doors; once a person is among its recruiters, they decide
  const aiLed = w.players[t.founderId ?? -1]?.kind === 'ai'
    && !t.members.some((m) => w.players[m]?.kind === 'human' && hasRight(t, m, 'invite'));
  const target = aiLed ? aiTribeTarget(w) : TRIBE_MAX_MEMBERS;
  if (aiLed) t.recruiting = t.members.length < target;
  const avg = tribePoints(w, t) / Math.max(1, t.members.length);
  // requests to join: read, then answered (a ruler that just raided the tribe need not ask)
  for (const a of [...(t.applications ?? [])]) {
    if (w.now - a.t < 10 * 60_000) continue;
    const who = w.players[a.pid];
    if (!who || who.eliminated || who.tribeId != null) { t.applications = (t.applications ?? []).filter((x) => x.pid !== a.pid); continue; }
    const hostile = t.members.some((m) => {
      const at = w.players[m]?.ai?.provoked?.[who.id];
      return at !== undefined && at > w.now - realmDayMs(w);
    });
    answerApplication(w, p.id, who.id, !hostile && t.members.length < target && who.points >= avg * 0.08);
  }
  if (!aiLed) return;
  // invitations nobody answered for two days lapse, so they do not block the tribe
  for (const inv of [...(t.invites ?? [])]) if (inv.by === p.id && w.now - inv.t > 2 * realmDayMs(w)) cancelInvite(w, p.id, inv.pid);
  if (!t.recruiting || w.now - (ai.lastRecruit ?? -Infinity) < RECRUIT_GAP) return;
  if (t.members.length + (t.invites?.length ?? 0) >= target) return;
  const home = w.villages[p.villages[0]];
  if (!home) return;
  ai.lastRecruit = w.now;
  ai.invited ??= {};
  for (const k in ai.invited) if (w.now - ai.invited[k] > 2 * realmDayMs(w)) delete ai.invited[k];
  let best: Player | null = null, bestScore = -Infinity;
  const seen = new Set<number>();
  for (const v of villagesNear(w, home.x, home.y, 30)) {
    const o = v.ownerId !== null ? w.players[v.ownerId] : null;
    if (!o || seen.has(o.id)) continue;
    seen.add(o.id);
    if (o.id === p.id || o.tribeId != null || o.eliminated || ai.invited[o.id] !== undefined) continue;
    if (t.invites?.some((i) => i.pid === o.id)) continue;
    if (o.points < avg * 0.08) continue;
    const d = distance(home.x, home.y, v.x, v.y);
    // people get an invitation only from fairly close neighbours, and only now and then: a
    // person hears from a tribe of rulers once every few days at most, and not often even then
    if (o.kind === 'human') {
      if (d > 24 || nextRandom(w) > 0.08) continue;
      if (w.now - (o.aiInviteAt ?? -Infinity) < 3 * realmDayMs(w)) continue;
    }
    const score = Math.min(2, o.points / Math.max(1, avg)) - d / 30;
    if (score > bestScore) { bestScore = score; best = o; }
  }
  if (best && invitePlayer(w, p.id, best.name).ok) {
    ai.invited[best.id] = w.now;
    if (best.kind === 'human') best.aiInviteAt = w.now;
  }
}

export { BUILDINGS };

/** Why this ruler would or would not set out to take this village right now (for the benches). */
export function campaignVerdict(w: World, p: Player, v: Village): string {
  const ai = p.ai!;
  if (ai.campaign) return `busy with ${ai.campaign.target}`;
  if (!campaignReady(w, p)) return 'resting';
  const homes = p.villages.map((id) => w.villages[id]).filter((h): h is Village => !!h && (h.units.noble ?? 0) > 0);
  if (!homes.length) return 'no nobleman home';
  const t = traitsOf(w, p);
  const near = homes.some((h) => distance(h.x, h.y, v.x, v.y) <= t.reach);
  if (!near) return `out of reach (${t.reach})`;
  if (!campaignTargetOk(w, p, v)) return 'not allowed';
  if ((ai.avoid?.[v.id] ?? 0) > w.now) return 'avoiding';
  if (v.ownerId !== null && w.players[v.ownerId]?.kind === 'human') {
    if (personTaken(w, p, v.ownerId)) return 'someone else is on them';
    if (!mayHit(w, p, v.ownerId)) return 'breather';
  }
  const pick = chooseCampaignTarget(w, p, homes[0]);
  return pick?.id === v.id ? 'picked' : `prefers ${pick ? `${pick.ownerId === null ? 'barb' : 'player'} ${pick.points}pts` : 'nothing'}`;
}

/** What is holding this ruler's next conquest back right now (for the benches). */
export function campaignState(w: World, p: Player): string {
  const ai = p.ai!;
  if (ai.campaign) return ai.campaign.scoutAt !== undefined ? 'campaign: scouting' : commandsOf(w, p.id).some((c) => c.toVid === ai.campaign!.target && c.kind === 'attack') ? 'campaign: marching' : (w.villages[ai.campaign.from]?.units.noble ?? 0) < 1 ? 'campaign: nobles away' : 'campaign: ready';
  if (!aiAwake(w, p)) return 'offline';
  if (!campaignReady(w, p)) return 'resting';
  const homes = p.villages.map((id) => w.villages[id]).filter((h): h is Village => !!h && (h.units.noble ?? 0) > 0 && h.buildings.rally > 0);
  if (!homes.length) {
    const info = nobleInfo(w, p.id);
    return info.canTrain > 0 ? 'no noble: can train' : info.coinsNeeded > 0 ? 'no noble: needs crowns' : 'no noble: other';
  }
  return chooseCampaignTarget(w, p, homes[0]) ? 'target ready' : 'nothing to take';
}

// ---------- answering attacks ----------

/**
 * When someone attacks a ruler, the ruler (and its tribe mates) weigh how to answer,
 * the way a tribe does on a real server. Each attack is written down as an incident
 * (who struck, at which village, whether it won, and what the army was mostly made
 * of). On a look while online, a ruler takes one fresh incident and scores its
 * options: scout the attacker, reinforce the village with troops that suit what hit
 * it, strike back (or scout first, if it knows too little), or stay out of it. What
 * it picks depends on its temperament and habits, on how far away it is, on what its
 * own villages hold, on what the tribe has already done about it, and on whether it
 * is under attack itself. A few answers per incident at most, so an attack draws a
 * response, not an avalanche.
 */
const INCIDENT_FRESH = 3 * 3_600_000;
/** How the rulers have been answering attacks (for the benches). */
export const incidentStats = { logged: 0, weighed: 0, scout: 0, support: 0, strike: 0, none: 0 };
/** Answers of each kind an incident gets at most, from the whole tribe. */
const INCIDENT_CAP = { scouts: 2, supports: 3, strikes: 2 };

/** What the attacking army was mostly made of: which defenders it takes to stop it. */
function attackClass(units: Units): Incident['cls'] {
  const pop = { inf: 0, cav: 0, arc: 0 };
  for (const k in units) {
    const u = k as UnitId, n = units[u] ?? 0;
    if (n <= 0 || u === 'scout' || u === 'noble') continue;
    const cls = UNITS[u].cls;
    pop[cls === 'cav' ? 'cav' : cls === 'arc' ? 'arc' : 'inf'] += n * UNITS[u].pop;
  }
  const total = pop.inf + pop.cav + pop.arc;
  if (total === 0) return 'inf';
  const top = (Object.keys(pop) as ('inf' | 'cav' | 'arc')[]).sort((a, b) => pop[b] - pop[a])[0];
  return pop[top] / total >= 0.6 ? top : 'mixed';
}

/** How much an attack sours things between two tribes: a lost battle stings more. */
const inc_weight = (data: BattleData) => (data.winner === 'attacker' ? 1.5 : 1);
/** Bad blood fades: about a third a day. */
function frictionNow(w: World, fr: { n: number; at: number }): number {
  return fr.n * Math.pow(0.67, (w.now - fr.at) / realmDayMs(w));
}

/** Write an attack down for whoever will answer it: the victim's tribe, or the victim alone. */
function logIncident(w: World, c: Command, target: Village, data: BattleData): void {
  if (target.ownerId === null || c.tag === 'scout' || c.tag === 'fake' || c.tag === 'farm') return;
  const victim = w.players[target.ownerId];
  const attacker = w.players[c.ownerId];
  if (!victim || !attacker || attacker.id === victim.id) return;
  if (victim.tribeId !== null && attacker.tribeId === victim.tribeId) return;
  // barely an army: not worth anyone's attention
  if (unitsCount(data.attUnits) - (data.attUnits.scout ?? 0) < 20) return;
  const inc: Incident = {
    id: c.id, attacker: attacker.id, victim: victim.id, vid: target.id, at: w.now,
    won: data.winner === 'attacker', cls: attackClass(data.attUnits), scouts: 0, supports: 0, strikes: 0, seen: [],
  };
  const t = victim.tribeId !== null ? w.tribes[victim.tribeId] : undefined;
  if (t && attacker.tribeId !== null && w.tribes[attacker.tribeId]) {
    const fr = ((t.friction ??= {})[attacker.tribeId] ??= { n: 0, at: w.now });
    fr.n = frictionNow(w, fr) + (data.conquered ? 4 : inc_weight(data));
    fr.at = w.now;
  }
  const list = t ? (t.incidents ??= []) : victim.ai ? (victim.ai.incidents ??= []) : null;
  if (!list) return;
  list.unshift(inc);
  incidentStats.logged++;
  // the latest few, and nothing stale
  for (let i = list.length - 1; i >= 0; i--) if (i >= 8 || w.now - list[i].at > INCIDENT_FRESH) list.splice(i, 1);
}

/** Defence our village could lend against this kind of army, per unit kind (only the kinds that suit it). */
function suitedDefenders(v: Village, cls: Incident['cls']): Units {
  const idx = cls === 'cav' ? 1 : cls === 'arc' ? 2 : 0;
  const out: Units = {};
  for (const u of ['spear', 'sword', 'archer', 'heavy'] as UnitId[]) {
    const n = Math.floor((v.units[u] ?? 0) * 0.4);
    if (n < 10) continue;
    const d = UNITS[u].def;
    // against a mixed army anything solid helps; otherwise the unit must be good against this kind
    const good = cls === 'mixed' ? Math.min(...d) >= 15 : d[idx] >= Math.max(...d) * 0.8;
    if (good) out[u] = n;
  }
  return out;
}

const defenceValue = (units: Units, cls: Incident['cls']) => {
  const idx = cls === 'cav' ? 1 : cls === 'arc' ? 2 : 0;
  let n = 0;
  for (const k in units) n += (units[k as UnitId] ?? 0) * (cls === 'mixed' ? Math.min(...UNITS[k as UnitId].def) : UNITS[k as UnitId].def[idx]);
  return n;
};

function respondToIncidents(w: World, p: Player): void {
  const ai = p.ai!;
  const t = p.tribeId !== null ? w.tribes[p.tribeId] : undefined;
  const list = [...(t?.incidents ?? []), ...(ai.incidents ?? [])];
  const inc = list.find((x) => w.now - x.at < INCIDENT_FRESH && !x.seen.includes(p.id) && x.attacker !== p.id);
  if (!inc) return;
  inc.seen.push(p.id);
  const attacker = w.players[inc.attacker];
  const victimV = w.villages[inc.vid];
  if (!attacker || attacker.eliminated || !victimV) return;
  // never against a tribe mate, an ally or a pact
  if (attacker.tribeId !== null && attacker.tribeId === p.tribeId) return;
  const rel = relation(w, p.tribeId, attacker.tribeId);
  if (rel === 'ally' || rel === 'nap') return;
  const traits = traitsOf(w, p);
  const own = inc.victim === p.id;
  const underFire = p.villages.some((vid) => commandsTo(w, vid).some((cm) => cm.kind === 'attack' && cm.ownerId !== p.id));
  // our village closest to the trouble
  let home: Village | null = null, homeD = Infinity;
  for (const vid of p.villages) {
    const v = w.villages[vid];
    if (!v || v.buildings.rally < 1 || v.id === inc.vid) continue;
    const d = distance(v.x, v.y, victimV.x, victimV.y);
    if (d < homeD) { home = v; homeD = d; }
  }
  // the attacker's village nearest to us, and what we know of it
  const from = home ?? victimV;
  let foe: Village | null = null, foeD = Infinity;
  for (const vid of attacker.villages) {
    const v = w.villages[vid];
    if (!v) continue;
    const d = distance(from.x, from.y, v.x, v.y);
    if (d < foeD) { foe = v; foeD = d; }
  }
  const intel = foe ? p.intel[foe.id] : undefined;
  const known = !!intel?.units && w.now - Math.max(intel.scoutT ?? 0, intel.lastAttackT ?? 0) < 6 * 3_600_000;
  const humanFoe = attacker.kind === 'human';
  if (humanFoe && !ai.hostile) return;

  // what each answer is worth to this ruler right now
  const options: { kind: 'scout' | 'support' | 'strike' | 'none'; score: number }[] = [{ kind: 'none', score: 30 + (underFire ? 40 : 0) }];
  if (foe && home && foeD <= traits.reach + 6 && !known && inc.scouts < INCIDENT_CAP.scouts && (home.units.scout ?? 0) >= 10) {
    options.push({ kind: 'scout', score: 25 + (ai.personality === 'opportunist' || ai.personality === 'guardian' ? 20 : 10) + (inc.won ? 15 : 5) - foeD });
  }
  const lend = home && !own && homeD <= 15 ? suitedDefenders(home, inc.cls) : {};
  if (home && !own && homeD <= 15 && inc.supports < INCIDENT_CAP.supports && hasUnits(lend) && !underFire) {
    // worth more if the village fell short, and if what we can lend really counts against this army
    const weight = Math.min(1.5, defenceValue(lend, inc.cls) / 20_000);
    options.push({ kind: 'support', score: traits.helper * 70 * weight + (inc.won ? 25 : 5) - homeD * 1.5 });
  }
  if (foe && home && foeD <= traits.reach && inc.strikes < INCIDENT_CAP.strikes && !underFire && warVillage(w, p, home)) {
    const army = offensiveArmy(home);
    if (attackValue(army) >= 1500) {
      // a ruler answers blows to itself harder than blows to its tribe
      const grudge = own ? 35 : 15;
      options.push({ kind: 'strike', score: ai.aggression * 60 + grudge + (inc.won ? 15 : 0) + (known ? 10 : -5) - foeD * 1.5 - (traits.caution - 1) * 40 });
    }
  }
  // people are not perfectly predictable
  for (const o of options) o.score += nextRandom(w) * 20;
  const pick = options.sort((a, b) => b.score - a.score)[0];
  incidentStats.weighed++;
  incidentStats[pick.kind]++;

  if (pick.kind === 'scout' && foe && home) {
    const n = Math.min(home.units.scout ?? 0, scoutParty(ai, foe.id));
    if (sendTroops(w, { ownerId: p.id, fromVid: home.id, toVid: foe.id, kind: 'attack', units: { scout: n }, tag: 'scout' }).ok) inc.scouts++;
  } else if (pick.kind === 'support' && home) {
    const send = suitedDefenders(home, inc.cls);
    if (sendTroops(w, { ownerId: p.id, fromVid: home.id, toVid: inc.vid, kind: 'support', units: send, tag: 'help' }).ok) {
      (ai.support ??= {})[inc.vid] = { from: home.id, at: w.now };
      inc.supports++;
    }
  } else if (pick.kind === 'strike' && foe && home) {
    // the grudge is taken up; a person who struck first may be paid back past the realm's breather
    ai.targetPlayer = attacker.id;
    ai.grudgeAt = w.now;
    if (humanFoe) (ai.provoked ??= {})[attacker.id] = w.now;
    inc.strikes++;
    if (known) strike(w, p, home, foe, offensiveArmy(home));
    else if ((home.units.scout ?? 0) >= 5 && !(ai.plans ??= {})[home.id]) {
      // find out first; the war plans follow up when the report is in
      const r = sendTroops(w, { ownerId: p.id, fromVid: home.id, toVid: foe.id, kind: 'attack', units: { scout: Math.min(home.units.scout ?? 0, scoutParty(ai, foe.id)) }, tag: 'scout' });
      if (r.ok) ai.plans![home.id] = { target: foe.id, since: w.now, scoutCmd: (r.data as { id: number }).id };
    }
  }
}

// ---------- resource caches ----------

/** How keen each temperament is to fight over a resource cache. */
const CACHE_KEEN: Record<P, number> = { warlord: 0.85, opportunist: 0.8, expander: 0.6, guardian: 0.4, farmer: 0.4, turtle: 0.25 };
/** At most this many rulers go after one cache (the rest have their own business). */
const CACHE_CROWD = 7;

/**
 * A resource cache is up: a ruler within reach may go for it. It clears it with its best
 * army (if a battle simulation says it can), then holds it with support from a defensive
 * village, reinforcing while time allows. If it keeps losing there, it learns who holds it
 * (as anyone does from the reports) and may strike that ruler's village nearest the cache
 * instead, guessing that is where the troops came from.
 */
function cacheHunt(w: World, p: Player): void {
  const ai = p.ai!;
  const c = activeCache(w);
  if (!c || !c.cache) { delete ai.cacheGoal; return; }
  if (w.config.difficulty === 'peaceful' || !ai.hostile) return;
  const left = c.cache.endsAt - w.now;
  let goal = ai.cacheGoal?.vid === c.id ? ai.cacheGoal : undefined;
  if (!goal) {
    if (ai.cacheSkip === c.id || left < 20 * MIN) return;
    const reach = (ai.traits?.reach ?? 15) + 18; // a prize like this draws rulers from farther than their usual reach
    const near = p.villages.some((vid) => { const v = w.villages[vid]; return v && distance(v.x, v.y, c.x, c.y) <= reach; });
    const crowd = Object.values(w.players).filter((o) => o.ai?.cacheGoal?.vid === c.id).length;
    if (!near || crowd >= CACHE_CROWD || nextRandom(w) > CACHE_KEEN[ai.personality]) { ai.cacheSkip = c.id; return; }
    goal = ai.cacheGoal = { vid: c.id, stage: 'clear', at: 0, tries: 0 };
  }
  if (goal.stage === 'done' || w.now - goal.at < 6 * MIN) return;
  const mine = (vid: number) => { const v = w.villages[vid]; return v && v.ownerId === p.id ? v : null; };
  const onTheWay = commandsOf(w, p.id).some((cmd) => cmd.toVid === c.id && (cmd.kind === 'attack' || cmd.kind === 'support'));
  const claimed = c.cache.claims.includes(p.id);
  const holder = cacheHolder(w, c);

  // holding (or entitled to): station a defensive army there, and top it up while there is time
  if (claimed && !cacheGuarded(c)) {
    goal.stage = 'hold';
    const stationed = c.support.filter((st) => st.ownerId === p.id).reduce((a, st) => a + unitsPop(st.units), 0);
    if (holder === p.id && stationed >= 2500) return;
    const homes = p.villages.map(mine).filter((v): v is Village => !!v)
      .sort((a, b) => distance(a.x, a.y, c.x, c.y) - distance(b.x, b.y, c.x, c.y));
    for (const v of homes) {
      const send: Units = {};
      for (const u of ['spear', 'sword', 'archer', 'heavy'] as UnitId[]) {
        const n = Math.floor((v.units[u] ?? 0) * 0.7);
        if (n > 0) send[u] = n;
      }
      // short of defenders (early on), any troops will do to sit on it
      if (unitsPop(send) < 150) for (const u of ['axe', 'light', 'marcher'] as UnitId[]) {
        const n = Math.floor((v.units[u] ?? 0) * 0.5);
        if (n > 0) send[u] = (send[u] ?? 0) + n;
      }
      if (unitsPop(send) < 100) continue;
      if (travelTime(w, v, c, send, p.id, true) > left - 2 * MIN) continue;
      if (sendTroops(w, { ownerId: p.id, fromVid: v.id, toVid: c.id, kind: 'support', units: send, tag: 'cache' }).ok) { goal.at = w.now; return; }
    }
    // no defenders to spare: if someone else holds it now, win it back
    if (holder === p.id) return;
  }
  if (onTheWay) return;

  // after two failed goes, hit the holder where it hurts: their village nearest the cache
  if (goal.fought && goal.tries >= 2 && holder !== null && holder !== p.id) {
    const h = w.players[holder];
    const hv = h?.villages.map((id) => w.villages[id]).filter(Boolean)
      .sort((a, b) => distance(a.x, a.y, c.x, c.y) - distance(b.x, b.y, c.x, c.y))[0];
    const tribeMate = h && p.tribeId !== null && h.tribeId === p.tribeId;
    if (hv && !tribeMate && !isProtected(w, holder) && mayHit(w, p, holder) && nextRandom(w) < (ai.personality === 'warlord' ? 0.75 : 0.5)) {
      const from = p.villages.map(mine).filter((v): v is Village => !!v)
        .sort((a, b) => attackValue(offensiveArmy(b)) - attackValue(offensiveArmy(a)))[0];
      const army = from ? offensiveArmy(from) : {};
      if (from && attackValue(army) >= 3000 && sendTroops(w, { ownerId: p.id, fromVid: from.id, toVid: hv.id, kind: 'attack', units: army, tag: 'war' }).ok) {
        noteHit(w, p, hv);
        news(w, `${p.name}, beaten back at the resource cache, marches on ${hv.name} instead.`, 'player', hv.id);
      }
    }
    goal.stage = 'done';
    return;
  }
  if (goal.tries >= 3) { goal.stage = 'done'; return; }

  // clear it: the strongest army that gets there in time and wins in a simulated battle
  const guards = cacheGuarded(c) ? cacheGuardEstimate(w, c) : {};
  // who might be sitting in it: a guess at a held cache's garrison, bigger once the battle is known to be close
  const held: Units = !cacheGuarded(c) && holder !== null && holder !== p.id ? { spear: 1200 + goal.tries * 800, sword: 800 + goal.tries * 500 } : {};
  const defence = { ...guards };
  for (const k in held) defence[k as UnitId] = (defence[k as UnitId] ?? 0) + (held[k as UnitId] ?? 0);
  let best: { v: Village; army: Units } | null = null;
  for (const vid of p.villages) {
    const v = mine(vid);
    if (!v || v.buildings.rally < 1 || ai.campaign?.from === v.id) continue;
    const army = offensiveArmy(v);
    if (attackValue(army) < 1200) continue;
    if (travelTime(w, v, c, army, p.id) > left - 8 * MIN) continue;
    const sim = resolveBattle({ att: army, attTech: v.tech, attItem: null, defStacks: [{ units: defence, tech: {} }], defItems: [], wall: c.buildings.wall, luck: 0, morale: 1 });
    if (sim.winner !== 'attacker' || sim.attStrength < sim.defStrength * 1.2) continue;
    if (!best || attackValue(army) < attackValue(best.army)) best = { v, army };
  }
  if (!best) { goal.tries++; goal.at = w.now; if (goal.tries >= 3 && !goal.fought) goal.stage = 'done'; return; }
  const send = { ...best.army };
  const h = attackHero(best.v);
  if (h) send[h] = 1;
  if (sendTroops(w, { ownerId: p.id, fromVid: best.v.id, toVid: c.id, kind: 'attack', units: send, catTarget: 'wall', tag: 'cache' }).ok) {
    goal.tries++;
    goal.fought = true;
    goal.at = w.now;
  }
}
