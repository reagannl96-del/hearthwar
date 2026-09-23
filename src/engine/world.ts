// World creation: terrain, player & barbarian placement, AI personalities, tribes.

import { PLAYER_COLORS, rulerName, tribeName, villageName } from './data/names';
import { pushEvent } from './events';
import { HOUR, res, villagePoints } from './formulas';
import { fractalNoise, nextRandom, pick, randInt, shuffle } from './rng';
import { invalidateSpatial } from './spatial';
import type { AIState, BonusType, BuildingId, Player, PlayerStats, Village, World, WorldConfig } from './types';
import { commandsOf, removeCommand } from './cmdindex';
import { addReport, news, withdrawSupport } from './commands';
import { createVillage, updateVillage } from './village';

export const WORLD_VERSION = 1;

export const SPEED_PRESETS = {
  relaxed: { label: 'Relaxed', speed: 60, unitSpeed: 35, blurb: 'Check in a few times a day. First nobleman after a day or two.' },
  standard: { label: 'Standard', speed: 150, unitSpeed: 80, blurb: 'Your first nobleman within a day. Villages grow while you are away.' },
  blitz: { label: 'Blitz', speed: 400, unitSpeed: 200, blurb: 'Everything moves fast. A whole war in one evening.' },
} as const;

export const SIZE_PRESETS = {
  small: { label: 'Small', size: 80, aiCount: 12 },
  medium: { label: 'Medium', size: 120, aiCount: 20 },
  large: { label: 'Large', size: 170, aiCount: 34 },
} as const;

export function defaultConfig(): WorldConfig {
  return {
    speed: 150,
    unitSpeed: 80,
    size: 120,
    aiCount: 20,
    barbDensity: 0.045,
    difficulty: 'normal',
    morale: true,
    archers: true,
    paladin: true,
    luck: 0.25,
    protectionHours: 300,
  };
}

export interface NewWorldOptions {
  worldName: string;
  playerName: string;
  villageName: string;
  config: WorldConfig;
  seed?: number;
  /** shared online world: no built-in human, players join later via spawnPlayer */
  multiplayer?: boolean;
}

export function emptyStats(): PlayerStats {
  return { loot: 0, killsAtt: 0, killsDef: 0, lostUnits: 0, conquered: 0, attacks: 0, scouted: 0, built: 0, recruited: 0 };
}

function genTerrain(size: number, seed: number): string {
  const rows: string[] = [];
  for (let y = 0; y < size; y++) {
    let row = '';
    for (let x = 0; x < size; x++) {
      const e = fractalNoise(x, y, seed, 22);
      const m = fractalNoise(x, y, seed + 101, 14);
      let c = '.';
      if (e < 0.26) c = 'w';
      else if (e > 0.76) c = 'm';
      else if (m > 0.6) c = 'f';
      row += c;
    }
    rows.push(row);
  }
  return rows.join('');
}

/** The northern frontier of every realm lies under snow. */
export function isWinter(x: number, y: number, size: number): boolean {
  const edge = size * 0.28 + (fractalNoise(x, 0, 911, 9) - 0.5) * size * 0.12 + (fractalNoise(x, y, 377, 4) - 0.5) * 3;
  return y < edge;
}

export function terrainAt(w: World, x: number, y: number): string {
  const s = w.config.size;
  if (x < 0 || y < 0 || x >= s || y >= s) return 'w';
  return w.terrain[y * s + x];
}

export const aiThinkInterval = (w: World) => Math.min(300_000, Math.max(10_000, Math.round(3_000_000 / w.config.speed)));
/** Beginner protection lasts a fixed 30 real minutes, whatever the world speed. */
export const PROTECTION_MS = 30 * 60_000;
export const protectionEnd = (w: World) => w.now + PROTECTION_MS;

/**
 * Bring an older saved world up to today's rules. Beginner protection used to
 * last hours; anyone still holding more than the current allowance keeps only that.
 */
export function migrateWorld(w: World): void {
  const cap = protectionEnd(w);
  for (const id in w.players) {
    const p = w.players[id];
    if (p.protectedUntil > cap) p.protectedUntil = cap;
  }
}

export const barbInterval = (w: World) => Math.max(15_000, Math.round((2 * HOUR) / w.config.speed));
export const sampleInterval = (w: World) => Math.max(30_000, Math.round((5 * HOUR) / w.config.speed));
export const itemInterval = (w: World) => Math.max(60_000, Math.round((24 * HOUR) / w.config.speed));

function newPlayer(w: World, name: string, kind: 'human' | 'ai', color: string): Player {
  const p: Player = {
    id: w.nextId++, name, kind, color, tribeId: null, villages: [], coins: 0, points: 0, stats: emptyStats(),
    reports: [], intel: {}, questsClaimed: [], achievements: {}, paladin: null, protectedUntil: 0,
    createdAt: w.now, history: [], notes: {},
  };
  w.players[p.id] = p;
  return p;
}

const PERSONALITIES: AIState['personality'][] = ['farmer', 'warlord', 'turtle', 'expander'];

export function createWorld(o: NewWorldOptions): World {
  const seed = o.seed ?? Math.floor(Math.random() * 2 ** 31);
  const cfg = { ...o.config };
  const size = cfg.size;
  const w: World = {
    version: WORLD_VERSION,
    id: `w${seed.toString(36)}${Date.now().toString(36)}`,
    name: o.worldName || 'New realm',
    seed,
    rng: seed ^ 0x5bd1e995,
    now: 0,
    config: cfg,
    terrain: genTerrain(size, seed),
    villages: {},
    players: {},
    tribes: {},
    commands: {},
    events: [],
    nextId: 1,
    seq: 1,
    humanId: 0,
    mapRev: 1,
    news: [],
    exchange: res(0, 0, 0),
    createdReal: Date.now(),
  };
  invalidateSpatial();

  const occupied = new Set<number>();
  const key = (x: number, y: number) => y * size + x;
  const free = (x: number, y: number) => {
    if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2) return false;
    const t = w.terrain[key(x, y)];
    return (t === '.' || t === 'f') && !occupied.has(key(x, y));
  };
  const place = (x: number, y: number) => occupied.add(key(x, y));
  const findSpotNear = (cx: number, cy: number, rMin: number, rMax: number): [number, number] | null => {
    for (let tries = 0; tries < 400; tries++) {
      const a = nextRandom(w) * Math.PI * 2;
      const r = rMin + nextRandom(w) * (rMax - rMin);
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
      if (free(x, y)) return [x, y];
    }
    return null;
  };

  // --- human ---
  const c = size / 2;
  const hs = findSpotNear(c, c, 0, size * 0.08) ?? findSpotNear(c, c, 0, size * 0.3)!;
  let human: Player | null = null;
  if (!o.multiplayer) {
    human = newPlayer(w, o.playerName || 'You', 'human', '#f2c14e');
    w.humanId = human.id;
    place(hs[0], hs[1]);
    const hv = createVillage(w, hs[0], hs[1], o.villageName || `${o.playerName || 'Your'}'s village`, human.id);
    hv.res = res(600, 600, 600);
    human.villages.push(hv.id);
    human.protectedUntil = protectionEnd(w);
  }

  // --- AI rulers ---
  const minGap = Math.max(7, size / (Math.sqrt(cfg.aiCount + 1) * 1.25));
  const spots: [number, number][] = [[hs[0], hs[1]]];
  const aiPlayers: Player[] = [];
  const colors = shuffle(w, [...PLAYER_COLORS]);
  for (let i = 0; i < cfg.aiCount; i++) {
    let spot: [number, number] | null = null;
    // the first two rulers are placed as neighbours so there is always someone to deal with
    if (i < 2) spot = findSpotNear(hs[0], hs[1], 10, 16);
    for (let tries = 0; !spot && tries < 600; tries++) {
      const x = randInt(w, 4, size - 5), y = randInt(w, 4, size - 5);
      if (!free(x, y)) continue;
      if (spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < minGap * (tries > 300 ? 0.6 : 1))) continue;
      spot = [x, y];
    }
    if (!spot) continue;
    place(spot[0], spot[1]);
    spots.push(spot);
    const p = newPlayer(w, uniqueName(w), 'ai', colors[i % colors.length]);
    const personality = i < 2 ? (i === 0 ? 'warlord' : 'farmer') : pick(w, PERSONALITIES);
    p.ai = {
      personality,
      nextThink: 0,
      lastWarCheck: 0,
      aggression: personality === 'warlord' ? 0.8 : personality === 'expander' ? 0.6 : personality === 'farmer' ? 0.4 : 0.2,
      hostile: cfg.difficulty !== 'peaceful',
      memory: {},
      targetPlayer: null,
    };
    const v = createVillage(w, spot[0], spot[1], villageName(w), p.id);
    p.villages.push(v.id);
    aiPlayers.push(p);
    // harder worlds give rulers a head start
    const head = cfg.difficulty === 'hard' ? 3 : cfg.difficulty === 'normal' ? 1 : 0;
    if (head > 0) {
      v.buildings.timber = head + randInt(w, 0, 1);
      v.buildings.claypit = head + randInt(w, 0, 1);
      v.buildings.ironmine = head;
      v.buildings.main = 1 + head;
      v.points = villagePoints(v.buildings);
    }
  }

  // --- tribes ---
  const tribeless = shuffle(w, [...aiPlayers]);
  const tribeCount = Math.floor(aiPlayers.length / 5);
  for (let t = 0; t < tribeCount; t++) {
    const members = tribeless.splice(0, randInt(w, 2, 3));
    if (members.length < 2) break;
    const tn = tribeName(w);
    const tribe = { id: w.nextId++, name: tn.name, tag: tn.tag, color: members[0].color, members: members.map((m) => m.id) };
    w.tribes[tribe.id] = tribe;
    for (const m of members) m.tribeId = tribe.id;
  }

  // --- barbarians ---
  const barbCount = Math.round(size * size * cfg.barbDensity);
  const barbs: Village[] = [];
  const addBarb = (x: number, y: number) => {
    place(x, y);
    const v = createVillage(w, x, y, 'Barbarian village', null);
    const distC = Math.hypot(x - c, y - c) / (size / 2);
    const lvl = (lo: number, hi: number) => randInt(w, lo, hi);
    const b = v.buildings;
    b.main = lvl(1, 4);
    b.timber = lvl(1, 7);
    b.claypit = lvl(1, 7);
    b.ironmine = lvl(1, 6);
    b.farm = lvl(1, 4);
    b.warehouse = lvl(2, 6);
    b.wall = nextRandom(w) < 0.12 + distC * 0.1 ? lvl(1, 3) : 0;
    b.barracks = nextRandom(w) < 0.3 ? lvl(1, 3) : 0;
    v.points = villagePoints(b);
    v.res = res(randInt(w, 100, 900), randInt(w, 100, 900), randInt(w, 100, 900));
    v.grownAt = 0;
    if (nextRandom(w) < 0.06) v.bonus = pick(w, ['wood', 'clay', 'iron', 'all', 'farm', 'storage', 'recruit'] as BonusType[]);
    barbs.push(v);
  };
  // guaranteed farms around every ruler
  for (const [sx, sy] of spots) {
    const n = sx === hs[0] && sy === hs[1] ? 10 : 6;
    for (let i = 0; i < n; i++) {
      const s = findSpotNear(sx, sy, 2, 7);
      if (s) addBarb(s[0], s[1]);
    }
  }
  for (let tries = 0; barbs.length < barbCount && tries < barbCount * 20; tries++) {
    const x = randInt(w, 2, size - 3), y = randInt(w, 2, size - 3);
    if (!free(x, y)) continue;
    if (spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 1.5)) continue;
    addBarb(x, y);
  }

  for (const id in w.players) {
    const p = w.players[id];
    p.points = p.villages.reduce((s, vid) => s + w.villages[vid].points, 0);
  }

  // --- trading post ---
  const base = Math.round(20000 * Math.sqrt(cfg.speed / 10));
  w.exchange = res(base, base, base);

  // --- schedule recurring events ---
  const ai = aiThinkInterval(w);
  for (const p of aiPlayers) pushEvent(w, 'ai', w.now + randInt(w, 1000, ai), p.id);
  pushEvent(w, 'barb', w.now + barbInterval(w), 0);
  pushEvent(w, 'sample', w.now + 1000, 0);
  if (human) pushEvent(w, 'item', w.now + itemInterval(w), human.id);
  invalidateSpatial();
  return w;
}

function uniqueName(w: World): string {
  const taken = new Set(Object.values(w.players).map((p) => p.name));
  for (let i = 0; i < 50; i++) {
    const n = rulerName(w);
    if (!taken.has(n)) return n;
  }
  return `${rulerName(w)} ${w.nextId}`;
}

/** Give an eliminated human a fresh start somewhere on the frontier. */
export function respawnHuman(w: World, villageName: string, pid = w.humanId): Village | null {
  const human = w.players[pid];
  const size = w.config.size;
  for (let tries = 0; tries < 2000; tries++) {
    const edge = randInt(w, 0, 3);
    const t = randInt(w, 5, size - 6), d = randInt(w, 4, Math.floor(size * 0.18));
    const x = edge === 0 ? d : edge === 1 ? size - 1 - d : t;
    const y = edge === 2 ? d : edge === 3 ? size - 1 - d : t;
    const ter = terrainAt(w, x, y);
    if (ter !== '.' && ter !== 'f') continue;
    if (Object.values(w.villages).some((v) => Math.abs(v.x - x) < 2 && Math.abs(v.y - y) < 2)) continue;
    const v = createVillage(w, x, y, villageName, human.id);
    v.res = res(1500, 1500, 1500);
    v.buildings.timber = 3; v.buildings.claypit = 3; v.buildings.ironmine = 3; v.buildings.main = 3; v.buildings.rally = 1;
    v.points = villagePoints(v.buildings);
    human.villages.push(v.id);
    human.points = v.points;
    human.eliminated = false;
    human.protectedUntil = protectionEnd(w);
    invalidateSpatial();
    w.mapRev++;
    return v;
  }
  return null;
}

/**
 * Pick a spot for a brand-new village: anywhere on the map, on open ground with
 * elbow room, and never right on top of another human ruler. If the realm is
 * crowded, the rules relax.
 */
function freshSpot(w: World): [number, number] | null {
  const size = w.config.size;
  const clear = (x: number, y: number, r: number) => {
    for (const v of Object.values(w.villages)) if (Math.abs(v.x - x) <= r && Math.abs(v.y - y) <= r) return false;
    return true;
  };
  const humanVillages = Object.values(w.villages).filter((v) => v.ownerId !== null && w.players[v.ownerId]?.kind === 'human');
  const rules: [number, number][] = [[3, 10], [2, 7], [1, 4], [1, 0]];
  for (const [room, gap] of rules) {
    for (let tries = 0; tries < 800; tries++) {
      const x = randInt(w, 5, size - 6), y = randInt(w, 5, size - 6);
      const ter = terrainAt(w, x, y);
      if (ter !== '.' && ter !== 'f') continue;
      if (!clear(x, y, room)) continue;
      if (gap > 0 && humanVillages.some((v) => Math.hypot(v.x - x, v.y - y) < gap)) continue;
      return [x, y];
    }
  }
  return null;
}

/** Found a starting village for `p` at a fresh spot, with a few barbarian villages to raid nearby. */
function settle(w: World, p: Player, villageNameText: string): Village | null {
  const spot = freshSpot(w);
  if (!spot) return null;
  const [x, y] = spot;
  const v = createVillage(w, x, y, villageNameText.slice(0, 32) || `${p.name}'s hold`, p.id);
  v.res = res(600, 600, 600);
  p.villages.push(v.id);
  p.points = v.points;
  p.eliminated = false;
  p.protectedUntil = protectionEnd(w);
  let made = 0;
  for (let k = 0; k < 80 && made < 5; k++) {
    const bx = x + randInt(w, -6, 6), by = y + randInt(w, -6, 6);
    const bt = terrainAt(w, bx, by);
    if ((bt !== '.' && bt !== 'f') || Math.hypot(bx - x, by - y) < 2) continue;
    if (Object.values(w.villages).some((o) => o.x === bx && o.y === by)) continue;
    const b = createVillage(w, bx, by, 'Barbarian village', null);
    b.buildings.timber = randInt(w, 1, 5); b.buildings.claypit = randInt(w, 1, 5); b.buildings.ironmine = randInt(w, 1, 4);
    b.buildings.warehouse = randInt(w, 2, 5); b.buildings.main = randInt(w, 1, 3);
    b.points = villagePoints(b.buildings);
    made++;
  }
  invalidateSpatial();
  w.mapRev++;
  return v;
}

/**
 * Bring a new human ruler into a running world: a fresh village somewhere with
 * elbow room, a few barbarian villages to raid, and beginner protection.
 */
export function spawnPlayer(w: World, name: string, villageNameText: string): Player | null {
  if (!freshSpot(w)) return null;
  const taken = new Set(Object.values(w.players).map((p) => p.color));
  const color = PLAYER_COLORS.find((col) => !taken.has(col)) ?? pick(w, PLAYER_COLORS);
  const p = newPlayer(w, name.slice(0, 24) || 'Wanderer', 'human', color);
  settle(w, p, villageNameText);
  pushEvent(w, 'item', w.now + itemInterval(w), p.id);
  return p;
}

/**
 * Start over. Every village the ruler owns is abandoned exactly as it stands:
 * its buildings and the troops at home stay behind as barbarians. Armies and
 * merchants on the road, and troops stationed or scavenging elsewhere, are lost
 * with the old realm; other rulers' support is sent home. The ruler then gets a
 * fresh village somewhere new, with beginner protection.
 */
export function restartPlayer(w: World, pid: number, villageNameText: string): Village | null {
  const p = w.players[pid];
  if (!p || p.kind !== 'human') return null;
  for (const c of commandsOf(w, pid)) removeCommand(w, c);
  for (const id in w.villages) {
    const host = w.villages[id];
    if (host.support.some((s) => s.ownerId === pid)) host.support = host.support.filter((s) => s.ownerId !== pid);
  }
  for (const vid of p.villages) {
    const v = w.villages[vid];
    if (!v) continue;
    updateVillage(w, v, w.now);
    for (const st of [...v.support]) withdrawSupport(w, st.ownerId, v.id, st.fromVid);
    v.ownerId = null;
    v.name = 'Barbarian village';
    v.buildQueue = [];
    for (const rb in v.recruit) v.recruit[rb as keyof typeof v.recruit] = [];
    v.research = [];
    v.scavenge = [null, null, null, null];
    v.outPop = 0;
    v.merchantsOut = 0;
    v.loyalty = 100;
    v.loyaltyAt = w.now;
    v.militiaUntil = undefined;
    v.grownAt = w.now;
    delete v.units.noble;
    delete v.units.paladin;
    delete v.units.sorcerer;
    delete v.units.druid;
    delete v.units.goblin;
    delete v.units.militia;
  }
  news(w, `${p.name} abandoned their lands to the barbarians and set out to start anew.`, 'player');
  p.villages = [];
  p.points = 0;
  p.coins = 0;
  p.paladin = null;
  p.questsClaimed = [];
  p.intel = {};
  p.history = [];
  p.stats = emptyStats();
  const v = settle(w, p, villageNameText);
  if (v) {
    addReport(w, pid, {
      kind: 'info', color: 'blue', vid: v.id,
      title: `A new beginning at ${v.name} (${v.x}|${v.y})`,
      text: 'Your old villages now stand empty of rulers, held only by the troops you left behind.',
    });
  }
  return v;
}

export const BARB_BUILDINGS: BuildingId[] = ['main', 'timber', 'claypit', 'ironmine', 'farm', 'warehouse', 'timber', 'claypit', 'ironmine', 'warehouse', 'wall', 'hiding'];
