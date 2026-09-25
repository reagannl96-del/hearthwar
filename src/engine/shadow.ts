// Fog of war for online play. The server never sends the real world to a client;
// it sends a public snapshot (what anyone could see on the map) plus a private
// packet (what this one player knows). The client merges them into a "shadow
// world" that the normal engine query code can read.

import { UNITS } from './data/units';
import { distance, watchtowerRange, sighted } from './formulas';
import { commandsOf, commandsTo } from './cmdindex';
import type { Command, Player, SupportStack, Tribe, TribeAlert, UnitId, Units, Village, World } from './types';
import { applicationsBy, invitesFor, tribeAlerts } from './tribes';
import { emptyBuildings } from './village';

export interface PublicSnapshot {
  rev: number;
  world: World;
}

export interface PrivatePacket {
  now: number;
  pid: number;
  player: Player;
  villages: Village[];
  /** this player's troops stationed in other villages */
  abroad: { host: number; stack: SupportStack }[];
  commands: Command[];
  exchange: World['exchange'];
  news: World['news'];
  /** the player's own tribe in full (forum, invites, internal notes) */
  tribe?: Tribe;
  /** tribes inviting this player (just enough to show the invitation) */
  invitedBy: { tribeId: number; by: number; t: number }[];
  /** tribes this player has asked to join */
  appliedTo?: { tribeId: number; t: number }[];
  /** attacks on fellow tribe members, for those with internal access */
  tribeAlerts: TribeAlert[];
}

function publicVillage(v: Village, now: number): Village {
  return {
    id: v.id, name: v.name, x: v.x, y: v.y, ownerId: v.ownerId, points: v.points, bonus: v.bonus,
    buildings: emptyBuildings(), res: { wood: 0, clay: 0, iron: 0 }, resAt: now, loyalty: 100, loyaltyAt: now,
    units: {}, support: [], buildQueue: [], recruit: { barracks: [], stable: [], workshop: [], academy: [], statue: [], market: [] },
    research: [], tech: {}, scavengeUnlocked: 0, scavenge: [null, null, null, null], foundedAt: v.foundedAt, outPop: 0,
    merchantsOut: 0,
    heroKind: v.heroKind,
    // a resource cache shows its level and deadline; who has won there stays secret
    ...(v.cache ? { cache: { level: v.cache.level, endsAt: v.cache.endsAt, claims: [] } } : {}),
  };
}

function publicPlayer(p: Player): Player {
  return {
    id: p.id, name: p.name, kind: p.kind, color: p.color, tribeId: p.tribeId, villages: [...p.villages], coins: 0,
    points: p.points,
    stats: { ...p.stats },
    reports: [], intel: {}, questsClaimed: [], achievements: {}, paladin: null, protectedUntil: p.protectedUntil,
    createdAt: p.createdAt, history: p.history.slice(-120), notes: {}, eliminated: p.eliminated,
    ai: p.ai ? ({ personality: p.ai.personality } as Player['ai']) : undefined,
    dailyAwards: p.dailyAwards,
    flag: p.flag,
    honours: p.honours,
  };
}

export function publicSnapshot(w: World): PublicSnapshot {
  const villages: World['villages'] = {};
  for (const id in w.villages) villages[id] = publicVillage(w.villages[id], w.now);
  const players: World['players'] = {};
  for (const id in w.players) players[id] = publicPlayer(w.players[id]);
  // what the world may know of a tribe: who is in it, who leads, and its diplomacy
  const tribes: World['tribes'] = {};
  for (const id in w.tribes) {
    const t = w.tribes[id];
    tribes[id] = { ...t, internal: '', invites: [], forum: [], applications: [], incidents: undefined, friction: undefined };
  }
  return {
    rev: w.mapRev,
    world: {
      ...w,
      rng: 0,
      villages,
      players,
      tribes,
      commands: {},
      events: [],
      accounts: undefined,
      // when the next resource cache turns up is nobody's business
      nextCacheAt: undefined,
      honours: undefined,
      news: w.news.slice(0, 60),
    },
  };
}

function slowest(units: Units): UnitId | null {
  let best: UnitId | null = null;
  for (const k in units) {
    const u = k as UnitId;
    if ((units[u] ?? 0) > 0 && (!best || UNITS[u].speed > UNITS[best].speed)) best = u;
  }
  return best;
}

export function privatePacket(w: World, pid: number): PrivatePacket {
  const p = w.players[pid];
  const mine = new Set(p.villages);
  const commands: Command[] = [];
  for (const c of commandsOf(w, pid)) commands.push(c);
  for (const vid of p.villages) {
    for (const c of commandsTo(w, vid)) {
      if (c.ownerId === pid) continue;
      if (c.kind === 'attack') {
        // incoming attacks reveal nothing, except what the watchtower spots
        const to = w.villages[c.toVid], from = w.villages[c.fromVid];
        let units: Units = {};
        const tower = to?.buildings.watchtower ?? 0;
        if (tower > 0 && to && from) {
          const f = Math.min(1, Math.max(0, (w.now - c.depart) / Math.max(1, c.arrive - c.depart)));
          const cx = from.x + (to.x - from.x) * f, cy = from.y + (to.y - from.y) * f;
          const s = slowest(c.units);
          if (s && distance(cx, cy, to.x, to.y) <= watchtowerRange(tower)) units = { [s]: 1 };
        }
        // in the last stretch the army is in plain sight: what kinds of troops, never how many
        if (sighted(w.now, c.depart, c.arrive)) {
          for (const k in c.units) if ((c.units[k as keyof Units] ?? 0) > 0) units[k as keyof Units] = 1;
        }
        commands.push({ ...c, units, res: undefined, catTarget: undefined, tag: undefined, repeat: undefined, targetOwner: undefined });
      } else if (c.kind === 'support' || c.kind === 'trade') commands.push(c);
    }
  }
  const abroad: PrivatePacket['abroad'] = [];
  for (const id in w.villages) {
    if (mine.has(Number(id))) continue;
    for (const s of w.villages[id].support) if (s.ownerId === pid) abroad.push({ host: Number(id), stack: s });
  }
  return {
    now: w.now,
    pid,
    player: p,
    villages: p.villages.map((id) => w.villages[id]).filter(Boolean),
    abroad,
    commands,
    exchange: w.exchange,
    news: w.news.slice(0, 60),
    tribe: p.tribeId != null ? w.tribes[p.tribeId] : undefined,
    invitedBy: invitesFor(w, pid).map((i) => ({ tribeId: i.tribe.id, by: i.by, t: i.t })),
    appliedTo: applicationsBy(w, pid).map((a) => ({ tribeId: a.tribe.id, t: a.t })),
    tribeAlerts: tribeAlerts(w, pid),
  };
}

/** Build the client's shadow world from the latest public snapshot and private packet. */
export function mergeShadow(pub: World, priv: PrivatePacket): World {
  const w: World = {
    ...pub,
    now: priv.now,
    villages: { ...pub.villages },
    players: { ...pub.players },
    commands: {},
    events: [],
    exchange: priv.exchange,
    news: priv.news,
    humanId: priv.pid,
  };
  // villages we used to own but the public snapshot hasn't caught up on yet
  for (const v of priv.villages) w.villages[v.id] = v;
  for (const a of priv.abroad) {
    const host = w.villages[a.host];
    if (host) w.villages[a.host] = { ...host, support: [...host.support.filter((s) => s.fromVid !== a.stack.fromVid), a.stack] };
  }
  w.players[priv.pid] = priv.player;
  w.tribes = { ...pub.tribes };
  if (priv.tribe) w.tribes[priv.tribe.id] = priv.tribe;
  for (const inv of priv.invitedBy ?? []) {
    const t = w.tribes[inv.tribeId];
    if (t) w.tribes[inv.tribeId] = { ...t, invites: [...(t.invites ?? []).filter((i) => i.pid !== priv.pid), { pid: priv.pid, by: inv.by, t: inv.t }] };
  }
  for (const ap of priv.appliedTo ?? []) {
    const t = w.tribes[ap.tribeId];
    if (t) w.tribes[ap.tribeId] = { ...t, applications: [...(t.applications ?? []).filter((a) => a.pid !== priv.pid), { pid: priv.pid, t: ap.t }] };
  }
  w.tribeAlerts = priv.tribeAlerts ?? [];
  for (const c of priv.commands) w.commands[c.id] = c;
  return w;
}
