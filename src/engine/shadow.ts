// Fog of war for online play. The server never sends the real world to a client;
// it sends a public snapshot (what anyone could see on the map) plus a private
// packet (what this one player knows). The client merges them into a "shadow
// world" that the normal engine query code can read.

import { UNITS } from './data/units';
import { distance, watchtowerRange } from './formulas';
import { commandsOf, commandsTo } from './cmdindex';
import type { Command, Player, SupportStack, UnitId, Units, Village, World } from './types';
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
}

function publicVillage(v: Village, now: number): Village {
  return {
    id: v.id, name: v.name, x: v.x, y: v.y, ownerId: v.ownerId, points: v.points, bonus: v.bonus,
    buildings: emptyBuildings(), res: { wood: 0, clay: 0, iron: 0 }, resAt: now, loyalty: 100, loyaltyAt: now,
    units: {}, support: [], buildQueue: [], recruit: { barracks: [], stable: [], workshop: [], academy: [], statue: [] },
    research: [], tech: {}, scavengeUnlocked: 0, scavenge: [null, null, null, null], foundedAt: v.foundedAt, outPop: 0,
    merchantsOut: 0,
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
  };
}

export function publicSnapshot(w: World): PublicSnapshot {
  const villages: World['villages'] = {};
  for (const id in w.villages) villages[id] = publicVillage(w.villages[id], w.now);
  const players: World['players'] = {};
  for (const id in w.players) players[id] = publicPlayer(w.players[id]);
  return {
    rev: w.mapRev,
    world: {
      ...w,
      rng: 0,
      villages,
      players,
      commands: {},
      events: [],
      accounts: undefined,
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
        commands.push({ ...c, units, res: undefined, catTarget: undefined, tag: undefined });
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
  for (const c of priv.commands) w.commands[c.id] = c;
  return w;
}
