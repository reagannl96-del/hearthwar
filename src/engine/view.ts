// Player-scoped read models. The UI only ever sees these projections, never the raw
// world, so a multiplayer server can send exactly this data to each client.

import { hasPaladin, nobleInfo, buildQueueSlots } from './actions';
import { cancelWindow, playerName, travelTime } from './commands';
import { commandsOf, commandsTo } from './cmdindex';
import { UNITS } from './data/units';
import {
  armyMsPerField, distance, hideCap, merchantCount, storageCap, unitsCount, watchtowerRange,
} from './formulas';
import { achievementLevels, questStatus } from './quests';
import type {
  BonusType, BuildJob, Buildings, Intel, PaladinState, PlayerStats, RecruitBuilding, RecruitJob, Report, Res,
  ResearchJob, ScavengeRun, UnitId, Units, World, WorldConfig,
} from './types';
import { farmMax, popUsed, productionRates, updateVillage } from './village';

export interface SupportView { fromVid: number; fromName: string; ownerId: number; ownerName: string; units: Units }
export interface StationedView { hostVid: number; hostName: string; hostX: number; hostY: number; hostOwner: string; units: Units }

export interface VillageView {
  id: number;
  name: string;
  x: number;
  y: number;
  points: number;
  loyalty: number;
  bonus?: BonusType;
  buildings: Buildings;
  buildQueue: BuildJob[];
  buildSlots: number;
  recruit: Record<RecruitBuilding, RecruitJob[]>;
  research: ResearchJob[];
  tech: Units;
  res: Res;
  resAt: number;
  rates: Res;
  storage: number;
  hide: number;
  popUsed: number;
  popMax: number;
  units: Units;
  support: SupportView[];
  stationed: StationedView[];
  merchants: number;
  merchantsOut: number;
  scavengeUnlocked: number;
  scavenge: (ScavengeRun | null)[];
  militiaUntil?: number;
  watchtower: number;
}

export interface CommandView {
  id: number;
  kind: 'attack' | 'support' | 'return' | 'trade' | 'tradeback';
  dir: 'out' | 'in';
  fromVid: number;
  fromName: string;
  fromX: number;
  fromY: number;
  toVid: number;
  toName: string;
  toX: number;
  toY: number;
  ownerId: number;
  ownerName: string;
  depart: number;
  arrive: number;
  units?: Units;
  res?: Res;
  repeat?: boolean;
  cancelUntil?: number;
  detected?: UnitId | null;
  origin?: number;
  originName?: string;
  tag?: string;
  /** returns: the army lost troops on the way */
  losses?: boolean;
}

export interface PlayerView {
  now: number;
  worldName: string;
  config: WorldConfig;
  me: {
    id: number;
    name: string;
    points: number;
    rank: number;
    coins: number;
    nobles: ReturnType<typeof nobleInfo>;
    protectedUntil: number;
    paladin: PaladinState | null;
    hasPaladin: boolean;
    stats: PlayerStats;
    eliminated: boolean;
    history: [number, number][];
    tribeId: number | null;
    /** the village this ruler started from (white halo on the map) */
    homeVid: number | null;
  };
  villages: VillageView[];
  commands: CommandView[];
  incoming: CommandView[];
  unreadReports: number;
  quests: ReturnType<typeof questStatus>;
  news: World['news'];
}

function villageView(w: World, pid: number, vid: number): VillageView {
  const v = w.villages[vid];
  updateVillage(w, v, w.now);
  const stationed: StationedView[] = [];
  return {
    id: v.id,
    name: v.name,
    x: v.x,
    y: v.y,
    points: v.points,
    loyalty: v.loyalty,
    bonus: v.bonus,
    buildings: { ...v.buildings },
    buildQueue: v.buildQueue.map((j) => ({ ...j })),
    buildSlots: buildQueueSlots(v),
    recruit: {
      barracks: v.recruit.barracks.map((j) => ({ ...j })),
      stable: v.recruit.stable.map((j) => ({ ...j })),
      workshop: v.recruit.workshop.map((j) => ({ ...j })),
      academy: v.recruit.academy.map((j) => ({ ...j })),
      statue: v.recruit.statue.map((j) => ({ ...j })),
    },
    research: v.research.map((j) => ({ ...j })),
    tech: { ...v.tech },
    res: { ...v.res },
    resAt: v.resAt,
    rates: productionRates(w, v),
    storage: storageCap(v.buildings.warehouse, v.bonus),
    hide: hideCap(v.buildings.hiding),
    popUsed: popUsed(v),
    popMax: farmMax(v),
    units: { ...v.units },
    support: v.support.map((s) => ({
      fromVid: s.fromVid, fromName: w.villages[s.fromVid]?.name ?? '?', ownerId: s.ownerId,
      ownerName: playerName(w, s.ownerId), units: { ...s.units },
    })),
    stationed,
    merchants: merchantCount(v.buildings.market, v.bonus),
    merchantsOut: v.merchantsOut,
    scavengeUnlocked: v.scavengeUnlocked,
    scavenge: v.scavenge.map((r) => (r ? { ...r, units: { ...r.units }, loot: { ...r.loot } } : null)),
    militiaUntil: v.militiaUntil,
    watchtower: v.buildings.watchtower,
  };
}

function slowestUnit(units: Units): UnitId | null {
  let best: UnitId | null = null;
  for (const k in units) {
    const u = k as UnitId;
    if ((units[u] ?? 0) <= 0) continue;
    if (!best || UNITS[u].speed > UNITS[best].speed) best = u;
  }
  return best;
}

export function buildView(w: World, pid: number): PlayerView {
  const p = w.players[pid];
  const villages = p.villages.map((vid) => villageView(w, pid, vid));
  const byId = new Map(villages.map((v) => [v.id, v]));
  // own troops stationed elsewhere
  for (const id in w.villages) {
    const host = w.villages[id];
    for (const s of host.support) {
      if (s.ownerId !== pid) continue;
      const home = byId.get(s.fromVid);
      if (!home) continue;
      home.stationed.push({
        hostVid: host.id, hostName: host.name, hostX: host.x, hostY: host.y, hostOwner: playerName(w, host.ownerId),
        units: { ...s.units },
      });
    }
  }
  const commands: CommandView[] = [];
  const incoming: CommandView[] = [];
  const mine = new Set(p.villages);
  const relevant = new Set(commandsOf(w, pid));
  for (const vid of p.villages) for (const c of commandsTo(w, vid)) relevant.add(c);
  for (const c of relevant) {
    const from = w.villages[c.fromVid];
    const to = w.villages[c.toVid];
    if (!from || !to) continue;
    const base = {
      id: c.id, kind: c.kind, fromVid: from.id, fromName: from.name, fromX: from.x, fromY: from.y,
      toVid: to.id, toName: to.name, toX: to.x, toY: to.y, ownerId: c.ownerId, ownerName: playerName(w, c.ownerId),
      depart: c.depart, arrive: c.arrive, origin: c.origin, losses: c.losses,
      originName: c.origin !== undefined ? w.villages[c.origin]?.name : undefined,
    };
    if (c.ownerId === pid) {
      commands.push({
        ...base, dir: 'out', units: { ...c.units }, res: c.res ? { ...c.res } : undefined, repeat: c.repeat, tag: c.tag,
        cancelUntil: c.kind === 'attack' || c.kind === 'support' ? c.depart + cancelWindow(c) : undefined,
      });
    } else if (mine.has(c.toVid) && (c.kind === 'attack' || c.kind === 'support' || c.kind === 'trade')) {
      let detected: UnitId | null = null;
      const tower = w.villages[c.toVid].buildings.watchtower;
      if (c.kind === 'attack' && tower > 0) {
        const frac = Math.min(1, Math.max(0, (w.now - c.depart) / Math.max(1, c.arrive - c.depart)));
        const cx = from.x + (to.x - from.x) * frac, cy = from.y + (to.y - from.y) * frac;
        if (distance(cx, cy, to.x, to.y) <= watchtowerRange(tower)) detected = slowestUnit(c.units);
      }
      incoming.push({
        ...base, dir: 'in', detected,
        units: c.kind === 'support' ? { ...c.units } : undefined,
        res: c.kind === 'trade' && c.res ? { ...c.res } : undefined,
      });
    }
  }
  commands.sort((a, b) => a.arrive - b.arrive);
  incoming.sort((a, b) => a.arrive - b.arrive);
  const ranked = Object.values(w.players).filter((x) => !x.eliminated).sort((a, b) => b.points - a.points);
  return {
    now: w.now,
    worldName: w.name,
    config: { ...w.config },
    me: {
      id: p.id,
      name: p.name,
      points: p.points,
      rank: ranked.findIndex((x) => x.id === pid) + 1,
      coins: p.coins,
      nobles: nobleInfo(w, pid),
      protectedUntil: p.protectedUntil,
      paladin: p.paladin ? { ...p.paladin, items: [...p.paladin.items] } : null,
      hasPaladin: hasPaladin(w, pid),
      stats: { ...p.stats },
      eliminated: !!p.eliminated,
      history: p.history,
      tribeId: p.tribeId,
      homeVid: p.villages[0] ?? null,
    },
    villages,
    commands,
    incoming,
    unreadReports: p.reports.reduce((n, r) => n + (r.read ? 0 : 1), 0),
    quests: questStatus(w, p),
    news: w.news.slice(0, 40),
  };
}

// ---------- map ----------

export interface MapVillage {
  id: number;
  x: number;
  y: number;
  name: string;
  ownerId: number | null;
  points: number;
  bonus?: BonusType;
}
export interface MapPlayer { id: number; name: string; color: string; tribeId: number | null; points: number; villages: number; kind: 'human' | 'ai' }
export interface MapTribe { id: number; name: string; tag: string; color: string }
export interface MapData {
  rev: number;
  size: number;
  terrain: string;
  villages: MapVillage[];
  players: Record<number, MapPlayer>;
  tribes: Record<number, MapTribe>;
}

export function buildMap(w: World): MapData {
  const villages: MapVillage[] = [];
  for (const id in w.villages) {
    const v = w.villages[id];
    villages.push({ id: v.id, x: v.x, y: v.y, name: v.name, ownerId: v.ownerId, points: v.points, bonus: v.bonus });
  }
  const players: Record<number, MapPlayer> = {};
  for (const id in w.players) {
    const p = w.players[id];
    if (p.eliminated) continue;
    players[p.id] = { id: p.id, name: p.name, color: p.color, tribeId: p.tribeId, points: p.points, villages: p.villages.length, kind: p.kind };
  }
  const tribes: Record<number, MapTribe> = {};
  for (const id in w.tribes) {
    const t = w.tribes[id];
    tribes[t.id] = { id: t.id, name: t.name, tag: t.tag, color: t.color };
  }
  return { rev: w.mapRev, size: w.config.size, terrain: w.terrain, villages, players, tribes };
}

// ---------- village details for the info panel ----------

export interface VillageInfo {
  id: number;
  name: string;
  x: number;
  y: number;
  points: number;
  ownerId: number | null;
  ownerName: string;
  tribe?: string;
  bonus?: BonusType;
  intel?: Intel;
  note?: string;
  protected: boolean;
  distanceFrom?: number;
  travel?: Partial<Record<UnitId, number>>;
  own: boolean;
  loyalty?: number;
}

export function villageInfo(w: World, pid: number, vid: number, fromVid?: number): VillageInfo | null {
  const v = w.villages[vid];
  if (!v) return null;
  const p = w.players[pid];
  const owner = v.ownerId !== null ? w.players[v.ownerId] : null;
  const info: VillageInfo = {
    id: v.id, name: v.name, x: v.x, y: v.y, points: v.points, ownerId: v.ownerId, ownerName: playerName(w, v.ownerId),
    tribe: owner?.tribeId ? w.tribes[owner.tribeId]?.tag : undefined, bonus: v.bonus, intel: p.intel[v.id],
    note: p.notes[v.id], protected: !!owner && owner.protectedUntil > w.now, own: v.ownerId === pid,
  };
  if (v.ownerId === pid) info.loyalty = v.loyalty;
  const from = fromVid !== undefined ? w.villages[fromVid] : undefined;
  if (from) {
    info.distanceFrom = distance(from.x, from.y, v.x, v.y);
    info.travel = {};
    for (const u of Object.keys(UNITS) as UnitId[]) {
      if (u === 'militia') continue;
      info.travel[u] = Math.round(info.distanceFrom * armyMsPerField({ [u]: 1 }, w.config.unitSpeed));
    }
  }
  return info;
}

export function reportsFor(w: World, pid: number): Report[] {
  return w.players[pid].reports;
}

export function rankingFor(w: World) {
  const tribes = w.tribes;
  return Object.values(w.players)
    .filter((p) => !p.eliminated)
    .map((p) => ({
      id: p.id, name: p.name, kind: p.kind, color: p.color, points: p.points, villages: p.villages.length,
      tribe: p.tribeId ? tribes[p.tribeId]?.tag ?? '' : '', killsAtt: p.stats.killsAtt, killsDef: p.stats.killsDef,
      conquered: p.stats.conquered, personality: p.ai?.personality,
    }))
    .sort((a, b) => b.points - a.points);
}

export function playerProfile(w: World, pid: number) {
  const p = w.players[pid];
  if (!p) return null;
  return {
    id: p.id, name: p.name, color: p.color, kind: p.kind, points: p.points,
    tribe: p.tribeId ? w.tribes[p.tribeId] : null,
    villages: p.villages.map((id) => w.villages[id]).filter(Boolean).map((v) => ({ id: v.id, name: v.name, x: v.x, y: v.y, points: v.points })),
    stats: { ...p.stats },
    personality: p.ai?.personality,
    history: p.history,
  };
}

export function achievementsFor(w: World, pid: number) {
  return achievementLevels(w, w.players[pid]);
}

export { travelTime, unitsCount };
