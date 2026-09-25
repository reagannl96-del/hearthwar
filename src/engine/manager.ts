// The village manager, like Tribal Wars' account manager: build templates (an
// ordered list of "this building to this level") and army templates (troops to
// keep in a village), assigned village by village. The server works through them
// on its own, so the villages keep building and recruiting while you are away.
//
// Buildings come first: troops are only recruited from what is left over once the
// next building on the template can be paid for.

import { applyAction, buildQueueSlots, checkBuild } from './actions';
import { BUILDINGS, BUILDING_ORDER } from './data/buildings';
import { UNITS, isHero } from './data/units';
import { pushEvent } from './events';
import type { BuildingId, Player, RecruitBuilding, Res, UnitId, Units, Village, World } from './types';
import { RES_KEYS } from './types';
import { popFree, queuedLevel, recruitQueueEnd, updateVillage } from './village';
import { recruitTime } from './formulas';

export interface BuildStep { b: BuildingId; to: number }
export interface BuildTemplate { id: number; name: string; steps: BuildStep[] }
export interface ArmyTemplate { id: number; name: string; units: Units }
export interface ManagedVillage { build?: number; army?: number; paused?: boolean }
export interface ManagerState {
  build: BuildTemplate[];
  army: ArmyTemplate[];
  villages: Record<number, ManagedVillage>;
  /** when the manager next looks over this player's villages (world time) */
  tickAt?: number;
}

const MAX_TEMPLATES = 20, MAX_STEPS = 80, NAME_LEN = 40;
/** how often the manager looks over the villages (real time, whatever the world speed) */
export const MANAGER_TICK = 45_000;
/** keep each barracks, stable and workshop queued this far ahead */
const RECRUIT_AHEAD = 2 * 3_600_000;

export const emptyManager = (): ManagerState => ({ build: [], army: [], villages: {} });

/** The manager is a tool for running an empire: it unlocks at this many villages. */
export const MANAGER_MIN_VILLAGES = 5;
export const managerUnlocked = (p: Player) => p.villages.length >= MANAGER_MIN_VILLAGES;

/**
 * At most this many villages may follow templates at once (a paused village still
 * holds its slot). The templates themselves are not limited. Kept low so the
 * manager helps without playing the game for you.
 */
export const MANAGER_MAX_VILLAGES = 3;

/** Drop managed villages past the cap, keeping the first ones in the record's order. */
export function capManagedVillages(m: ManagerState): void {
  const keys = Object.keys(m.villages);
  for (const k of keys.slice(MANAGER_MAX_VILLAGES)) delete m.villages[Number(k)];
}

/**
 * Below the villages it needs, the manager is switched off: no village follows a
 * template any more (the templates themselves are kept for when it unlocks again).
 */
export function switchOffManager(p: Player): void {
  if (!p.manager) return;
  p.manager.villages = {};
  p.manager.tickAt = undefined;
}

// ---------- ready-made templates ----------

const ladder = (...rungs: [BuildingId, number][][]): BuildStep[] => rungs.flat().map(([b, to]) => ({ b, to }));

export const BUILD_PRESETS: Omit<BuildTemplate, 'id'>[] = [
  {
    name: 'Economy first',
    steps: ladder(
      [['timber', 5], ['claypit', 5], ['ironmine', 5], ['farm', 5], ['warehouse', 5], ['main', 5]],
      [['timber', 10], ['claypit', 10], ['ironmine', 10], ['farm', 10], ['warehouse', 10], ['main', 10]],
      [['hiding', 5], ['market', 5], ['timber', 15], ['claypit', 15], ['ironmine', 15], ['warehouse', 15], ['farm', 15]],
      [['main', 15], ['timber', 20], ['claypit', 20], ['ironmine', 20], ['warehouse', 20], ['farm', 20], ['main', 20]],
      [['timber', 25], ['claypit', 25], ['ironmine', 25], ['warehouse', 25], ['farm', 25], ['timber', 30], ['claypit', 30], ['ironmine', 30], ['warehouse', 30], ['farm', 30]],
    ),
  },
  {
    name: 'Offensive village',
    steps: ladder(
      [['timber', 10], ['claypit', 10], ['ironmine', 10], ['farm', 10], ['warehouse', 10], ['main', 10]],
      [['barracks', 10], ['smithy', 5], ['rally', 1], ['stable', 5], ['wall', 5]],
      [['timber', 20], ['claypit', 20], ['ironmine', 20], ['farm', 20], ['warehouse', 20], ['main', 20]],
      [['barracks', 20], ['smithy', 15], ['stable', 15], ['workshop', 5], ['wall', 10], ['market', 10]],
      [['farm', 30], ['barracks', 25], ['stable', 20], ['smithy', 20], ['workshop', 10], ['timber', 30], ['claypit', 30], ['ironmine', 30], ['warehouse', 30]],
    ),
  },
  {
    name: 'Defensive village',
    steps: ladder(
      [['timber', 10], ['claypit', 10], ['ironmine', 10], ['farm', 10], ['warehouse', 10], ['main', 10]],
      [['barracks', 10], ['wall', 10], ['smithy', 5], ['watchtower', 3], ['hiding', 5]],
      [['timber', 20], ['claypit', 20], ['ironmine', 20], ['farm', 20], ['warehouse', 20], ['main', 20]],
      [['wall', 20], ['barracks', 20], ['smithy', 15], ['stable', 10], ['watchtower', 10], ['market', 10]],
      [['farm', 30], ['barracks', 25], ['timber', 30], ['claypit', 30], ['ironmine', 30], ['warehouse', 30], ['watchtower', 20]],
    ),
  },
  {
    name: 'Noble factory',
    steps: ladder(
      [['main', 20], ['farm', 20], ['warehouse', 20], ['smithy', 20], ['market', 10]],
      [['academy', 1], ['timber', 25], ['claypit', 25], ['ironmine', 25], ['warehouse', 28], ['farm', 28]],
    ),
  },
];

export const ARMY_PRESETS: Omit<ArmyTemplate, 'id'>[] = [
  { name: 'Full attack', units: { axe: 6500, light: 3000, ram: 300, scout: 100 } },
  { name: 'Full defence', units: { spear: 9000, sword: 9000, heavy: 500, scout: 100 } },
  { name: 'Farmer', units: { light: 800, spear: 1000, scout: 50 } },
  { name: 'Scout post', units: { scout: 500, spear: 2000 } },
];

// ---------- keeping it sane (it comes from the player) ----------

const isBuilding = (b: unknown): b is BuildingId => typeof b === 'string' && b in BUILDINGS;
const isUnit = (u: unknown): u is UnitId => typeof u === 'string' && u in UNITS;
const cleanName = (s: unknown, fallback: string) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, NAME_LEN) : fallback);

/** A manager as the player sent it, checked and trimmed so nothing in it can do harm. */
export function sanitizeManager(w: World, p: Player, raw: unknown): ManagerState {
  const m = (raw ?? {}) as Partial<ManagerState>;
  const build: BuildTemplate[] = [];
  const ids = new Set<number>();
  const takeId = (id: unknown) => {
    let n = typeof id === 'number' && Number.isFinite(id) && id > 0 ? Math.floor(id) : 1;
    while (ids.has(n)) n++;
    ids.add(n);
    return n;
  };
  for (const t of (Array.isArray(m.build) ? m.build : []).slice(0, MAX_TEMPLATES)) {
    const steps = (Array.isArray(t?.steps) ? t.steps : [])
      .filter((st: BuildStep) => isBuilding(st?.b) && Number.isFinite(st?.to))
      .slice(0, MAX_STEPS)
      .map((st: BuildStep) => ({ b: st.b, to: Math.max(1, Math.min(BUILDINGS[st.b].max, Math.floor(st.to))) }));
    build.push({ id: takeId(t?.id), name: cleanName(t?.name, 'Build template'), steps });
  }
  ids.clear();
  const army: ArmyTemplate[] = [];
  for (const t of (Array.isArray(m.army) ? m.army : []).slice(0, MAX_TEMPLATES)) {
    const units: Units = {};
    for (const [k, n] of Object.entries(t?.units ?? {})) {
      if (!isUnit(k) || !UNITS[k].building || k === 'noble' || isHero(k)) continue;
      const v = Math.floor(Number(n));
      if (v > 0) units[k] = Math.min(50_000, v);
    }
    army.push({ id: takeId(t?.id), name: cleanName(t?.name, 'Army template'), units });
  }
  // only MANAGER_MAX_VILLAGES villages may be managed: the ones already managed keep
  // their slots, then the rest in the order sent
  const clean: [number, ManagedVillage][] = [];
  for (const [k, mv] of Object.entries(m.villages ?? {})) {
    const vid = Number(k);
    if (!p.villages.includes(vid) || !mv) continue;
    const e: ManagedVillage = {};
    if (build.some((t) => t.id === mv.build)) e.build = mv.build;
    if (army.some((t) => t.id === mv.army)) e.army = mv.army;
    if (mv.paused === true) e.paused = true;
    if (e.build !== undefined || e.army !== undefined) clean.push([vid, e]);
  }
  const before = p.manager?.villages ?? {};
  const held = (vid: number) => (vid in before ? 0 : 1);
  clean.sort((a, b) => held(a[0]) - held(b[0])); // stable: keeps the sent order within each group
  const villages: Record<number, ManagedVillage> = {};
  for (const [vid, e] of clean.slice(0, MANAGER_MAX_VILLAGES)) villages[vid] = e;
  return { build, army, villages, tickAt: p.manager?.tickAt };
}

/** Save the manager and make sure it is looking over the villages. */
export function setManager(w: World, p: Player, raw: unknown): void {
  p.manager = sanitizeManager(w, p, raw);
  if (!managerUnlocked(p)) { switchOffManager(p); return; }
  if (Object.keys(p.manager.villages).length === 0) return;
  if (p.manager.tickAt === undefined || p.manager.tickAt < w.now) {
    p.manager.tickAt = w.now + 1000;
    pushEvent(w, 'mgr', p.manager.tickAt, p.id);
  }
}

// ---------- the work ----------

/** The first step of the template this village has not reached yet (counting what is queued). */
export function nextStep(v: Village, t: BuildTemplate): BuildStep | null {
  for (const st of t.steps) if (queuedLevel(v, st.b) < st.to) return st;
  return null;
}

/** What the next building on the template will cost (nothing if the template is done). */
function reserveFor(w: World, v: Village, t: BuildTemplate | undefined): Res {
  const st = t ? nextStep(v, t) : null;
  if (!st) return { wood: 0, clay: 0, iron: 0 };
  return checkBuild(w, v, st.b).cost;
}

function manageBuild(w: World, p: Player, v: Village, t: BuildTemplate): void {
  // fill the free queue slots, in template order; stop at the first step that can't start yet
  for (let n = 0; n < buildQueueSlots(v); n++) {
    if (v.buildQueue.length >= buildQueueSlots(v)) return;
    // the first step the village can take: a step still waiting on another building is passed over for now
    let pick: BuildingId | null = null;
    for (const st of t.steps) {
      if (queuedLevel(v, st.b) >= st.to) continue;
      const chk = checkBuild(w, v, st.b);
      if (chk.ok) { pick = st.b; break; }
      if (chk.reason?.startsWith('Requires')) continue;
      // out of room: the farm or the warehouse has to grow first, as Tribal Wars' manager does it
      const helper: BuildingId | null = chk.reason?.includes('population') ? 'farm' : chk.reason?.includes('warehouse') ? 'warehouse' : null;
      if (helper && checkBuild(w, v, helper).ok) pick = helper;
      break; // otherwise wait for the resources
    }
    if (!pick || !applyAction(w, p.id, { type: 'build', vid: v.id, building: pick }).ok) return;
  }
}

function manageArmy(w: World, p: Player, v: Village, t: ArmyTemplate, reserve: Res): void {
  const have: Units = { ...v.units };
  for (const rb in v.recruit) for (const j of v.recruit[rb as RecruitBuilding]) have[j.unit] = (have[j.unit] ?? 0) + j.count - j.done;
  for (const s of v.support) if (s.ownerId === p.id) for (const k in s.units) have[k as UnitId] = (have[k as UnitId] ?? 0) + (s.units[k as UnitId] ?? 0);
  const spare: Res = { wood: v.res.wood - reserve.wood, clay: v.res.clay - reserve.clay, iron: v.res.iron - reserve.iron };
  const used = new Set<string>();
  // the unit furthest short of its target first
  const wants = (Object.entries(t.units) as [UnitId, number][])
    .map(([u, target]) => ({ u, short: target - (have[u] ?? 0), frac: (have[u] ?? 0) / Math.max(1, target) }))
    .filter((x) => x.short > 0)
    .sort((a, b) => a.frac - b.frac);
  let pop = popFree(v);
  for (const { u, short } of wants) {
    const d = UNITS[u];
    const rb = d.building as RecruitBuilding | undefined;
    if (!rb || used.has(rb) || v.buildings[rb] < 1) continue;
    if (recruitQueueEnd(w, v, rb) - w.now > RECRUIT_AHEAD) continue;
    const per = recruitTime(u, v.buildings[rb], w.config.speed * (w.config.recruitBoost ?? 1), v.bonus);
    let n = Math.min(short, Math.floor(RECRUIT_AHEAD / Math.max(1, per)), Math.floor(pop / Math.max(1, d.pop)));
    for (const k of RES_KEYS) if (d.cost[k] > 0) n = Math.min(n, Math.floor(Math.max(0, spare[k]) / d.cost[k]));
    if (n < 1) continue;
    if (!applyAction(w, p.id, { type: 'recruit', vid: v.id, unit: u, count: n }).ok) continue;
    used.add(rb);
    pop -= n * d.pop;
    for (const k of RES_KEYS) spare[k] -= d.cost[k] * n;
  }
}

/** The manager's turn: every managed village builds and recruits what its templates say. */
export function runManager(w: World, p: Player): void {
  const m = p.manager;
  if (!m || p.eliminated) return;
  // fell below the villages it needs: it switches off
  if (!managerUnlocked(p)) { switchOffManager(p); return; }
  // villages lost since the last look free their slots; saves from before the cap are trimmed to it
  for (const k of Object.keys(m.villages)) {
    const v = w.villages[Number(k)];
    if (!v || v.ownerId !== p.id) delete m.villages[Number(k)];
  }
  capManagedVillages(m);
  let any = false;
  for (const [k, mv] of Object.entries(m.villages)) {
    const vid = Number(k);
    const v = w.villages[vid];
    if (!v) continue;
    any = true;
    if (mv.paused) continue;
    updateVillage(w, v, w.now);
    const bt = m.build.find((t) => t.id === mv.build);
    const at = m.army.find((t) => t.id === mv.army);
    if (bt) manageBuild(w, p, v, bt);
    if (at) manageArmy(w, p, v, at, reserveFor(w, v, bt));
  }
  if (any && !w.finished) {
    m.tickAt = w.now + MANAGER_TICK;
    pushEvent(w, 'mgr', m.tickAt, p.id);
  } else m.tickAt = undefined;
}

/** Buildings in the order the game lists them (for the template editor). */
export const MANAGER_BUILDINGS: BuildingId[] = BUILDING_ORDER;
