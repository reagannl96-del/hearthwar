// World creation: terrain, player & barbarian placement, AI personalities, tribes.

import { HEROES } from './data/units';
import { PLAYER_COLORS, rulerName, tribeName, villageName } from './data/names';
import { pushEvent } from './events';
import { HOUR, res, villagePoints } from './formulas';
import { fractalNoise, nextRandom, pick, randInt, shuffle } from './rng';
import { invalidateSpatial } from './spatial';
import type { AIState, BonusType, BuildingId, Player, PlayerStats, Village, World, WorldConfig } from './types';
import { commandsOf, removeCommand } from './cmdindex';
import { addReport, news, withdrawSupport } from './commands';
import { villageHero } from './actions';
import { normalizeTribes } from './tribes';
import { scheduleRoundEnd } from './round';
import { createVillage, updateVillage } from './village';

export const WORLD_VERSION = 1;

export const SPEED_PRESETS = {
  relaxed: { label: 'Relaxed', speed: 60, unitSpeed: 35, blurb: 'Check in a few times a day. First nobleman after a day or two.' },
  standard: { label: 'Standard', speed: 150, unitSpeed: 80, blurb: 'Your first nobleman within a day. Villages grow while you are away.' },
  blitz: { label: 'Blitz', speed: 400, unitSpeed: 200, blurb: 'Everything moves fast. A whole war in one evening.' },
} as const;

export const SIZE_PRESETS = {
  small: { label: 'Small', size: 120, aiCount: 16 },
  medium: { label: 'Medium', size: 180, aiCount: 34 },
  large: { label: 'Large', size: 240, aiCount: 60 },
} as const;

export function defaultConfig(): WorldConfig {
  return {
    speed: 150,
    unitSpeed: 80,
    size: 180,
    aiCount: 34,
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
  return { killsSup: 0, loot: 0, killsAtt: 0, killsDef: 0, lostUnits: 0, conquered: 0, attacks: 0, scouted: 0, built: 0, recruited: 0 };
}

/** The realm is a round island: past its ragged shore there is only open sea. */
export function inRealm(x: number, y: number, size: number): boolean {
  const c = size / 2;
  const shore = c - 2 - fractalNoise(x, y, 4242, 7) * 4;
  return Math.hypot(x + 0.5 - c, y + 0.5 - c) < shore;
}

/** The far west of every realm is a volcanic waste: ash plains, lava lakes and smoking peaks. */
export function isVolcanic(x: number, y: number, size: number): boolean {
  const edge = size * 0.22 + (fractalNoise(0, y, 613, 9) - 0.5) * size * 0.1 + (fractalNoise(x, y, 719, 4) - 0.5) * 3;
  return x < edge;
}

/**
 * Terrain codes: '.' meadow, 'f' forest, 'w' water, 'm' mountains,
 * 'v' volcanic ash (open ground), 'l' lava. Villages stand on '.', 'f' or 'v'.
 */
export const buildable = (t: string | undefined) => t === '.' || t === 'f' || t === 'v';

/** `off` shifts the noise so a grown realm keeps its old landscape in the middle, seamlessly. */
export function genTerrain(size: number, seed: number, off = 0): string {
  const rows: string[] = [];
  for (let y = 0; y < size; y++) {
    let row = '';
    for (let x = 0; x < size; x++) {
      const e = fractalNoise(x - off, y - off, seed, 22);
      const m = fractalNoise(x - off, y - off, seed + 101, 14);
      let c = '.';
      if (!inRealm(x, y, size)) c = 'w';
      else if (isVolcanic(x, y, size)) c = e < 0.24 ? 'l' : e > 0.72 ? 'm' : 'v';
      else if (e < 0.26) c = 'w';
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
  if (isVolcanic(x, y, size)) return false;
  const edge = size * 0.28 + (fractalNoise(x, 0, 911, 9) - 0.5) * size * 0.12 + (fractalNoise(x, y, 377, 4) - 0.5) * 3;
  return y < edge;
}

export function terrainAt(w: World, x: number, y: number): string {
  const s = w.config.size;
  if (x < 0 || y < 0 || x >= s || y >= s) return 'w';
  return w.terrain[y * s + x];
}

/**
 * How often an AI ruler looks at the game while online: every couple of minutes on a
 * fast realm, like a person checking their queues, never every few seconds.
 */
export const aiThinkInterval = (w: World) => Math.min(300_000, Math.max(60_000, Math.round(18_000_000 / w.config.speed)));
/** Beginner protection lasts a fixed 30 real minutes, whatever the world speed. */
export const PROTECTION_MS = 30 * 60_000;
export const protectionEnd = (w: World) => w.now + PROTECTION_MS;

/**
 * Bring an older saved world up to today's rules. Beginner protection used to
 * last hours; anyone still holding more than the current allowance keeps only that.
 */
export function migrateWorld(w: World): void {
  if (!w.round) growRealm(w);
  // rounds belong to the shared online realm; a world of your own never ends
  if (w.accounts === undefined && w.config.roundDays === undefined && w.endsAt !== undefined && !w.finished) {
    w.endsAt = undefined;
    w.events = w.events.filter((e) => e.type !== 'end');
  }
  scheduleRoundEnd(w);
  // heroes trained before each hero kind had its own legendary items get an armory now
  for (const id in w.players) {
    const p = w.players[id];
    for (const vid of p.villages) {
      const v = w.villages[vid];
      const h = v ? villageHero(w, v) ?? v.heroKind : undefined;
      if (h && h !== 'paladin' && HEROES.includes(h)) (p.heroGear ??= {})[h] ??= { items: [], equipped: null };
    }
  }
  const cap = protectionEnd(w);
  normalizeTribes(w);
  for (const id in w.villages) {
    const v = w.villages[id];
    if (!v.heroKind && v.ownerId !== null) v.heroKind = villageHero(w, v) ?? undefined;
  }
  for (const id in w.players) {
    const p = w.players[id];
    if (p.protectedUntil > cap) p.protectedUntil = cap;
  }
}

export const barbInterval = (w: World) => Math.max(15_000, Math.round((2 * HOUR) / w.config.speed));
export const sampleInterval = (w: World) => Math.max(30_000, Math.round((5 * HOUR) / w.config.speed));
/**
 * How often a player's heroes search for a legendary item: every 3 hours on a normal
 * realm (slower realms search less often, never more than every 2 days), and a search
 * turns something up only half the time, so an item is a rare find, about one every 6 hours.
 */
export const itemInterval = (w: { config: { speed: number } }) => Math.min(48 * HOUR, Math.max(2 * HOUR, Math.round((450 * HOUR) / w.config.speed)));
export const ITEM_FIND_CHANCE = 0.5;

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

function aiState(w: World, personality: AIState['personality']): AIState {
  return {
    personality,
    nextThink: 0,
    lastWarCheck: 0,
    aggression: personality === 'warlord' ? 0.8 : personality === 'expander' ? 0.6 : personality === 'farmer' ? 0.4 : 0.2,
    hostile: w.config.difficulty !== 'peaceful',
    memory: {},
    targetPlayer: null,
  };
}

export function createWorld(o: NewWorldOptions): World {
  const seed = o.seed ?? Math.floor(Math.random() * 2 ** 31);
  const cfg = { ...o.config };
  const size = cfg.size;
  const w: World = {
    version: WORLD_VERSION,
    round: true,
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
    return buildable(t) && !occupied.has(key(x, y));
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
    p.ai = aiState(w, personality);
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
    const tribe = {
      id: w.nextId++, name: tn.name, tag: tn.tag, color: members[0].color, members: members.map((m) => m.id), founderId: members[0].id,
      createdAt: 0, description: '', internal: '', rights: {}, invites: [], diplomacy: {}, forum: [],
    };
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
  scheduleRoundEnd(w);
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
    if (!buildable(ter)) continue;
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
function freshSpot(w: World, strict = false): [number, number] | null {
  const size = w.config.size;
  const clear = (x: number, y: number, r: number) => {
    for (const v of Object.values(w.villages)) if (Math.abs(v.x - x) <= r && Math.abs(v.y - y) <= r) return false;
    return true;
  };
  const humanVillages = Object.values(w.villages).filter((v) => v.ownerId !== null && w.players[v.ownerId]?.kind === 'human');
  const rules: [number, number][] = strict ? [[3, 10], [2, 7]] : [[3, 10], [2, 7], [1, 4], [1, 0]];
  for (const [room, gap] of rules) {
    for (let tries = 0; tries < 800; tries++) {
      const x = randInt(w, 5, size - 6), y = randInt(w, 5, size - 6);
      const ter = terrainAt(w, x, y);
      if (!buildable(ter)) continue;
      if (!clear(x, y, room)) continue;
      if (gap > 0 && humanVillages.some((v) => Math.hypot(v.x - x, v.y - y) < gap)) continue;
      return [x, y];
    }
  }
  return null;
}

/** Found a starting village for `p` at a fresh spot, with a few barbarian villages to raid nearby. */
function settle(w: World, p: Player, villageNameText: string, strict = false): Village | null {
  const spot = freshSpot(w, strict);
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
    if (!buildable(bt) || Math.hypot(bx - x, by - y) < 2) continue;
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
 * The realm keeps filling in while it runs, as a real server does: now and then a
 * new AI ruler turns up and settles wherever there is still elbow room (with a
 * few barbarian villages around it and beginner protection, like any newcomer),
 * and the odd barbarian village springs up in open country. Arrivals thin out as
 * the map fills and stop once there is no proper room left. Called on every
 * barbarian tick; the timing is random, about every hour and a half of real time
 * for rulers and every half hour for barbarians on a normal-speed world.
 */
export function realmGrowth(w: World): void {
  if (w.finished) return;
  const tick = barbInterval(w);
  const size = w.config.size;
  const rulers = Object.values(w.players).filter((p) => p.kind === 'ai' && !p.eliminated).length;
  const cap = Math.max(4, Math.round(w.config.aiCount * 2));
  const rulerGap = Math.min(6 * HOUR, Math.max(20 * 60_000, (180 * HOUR) / w.config.speed));
  const crowding = Math.max(0, 1 - rulers / cap);
  if (w.config.aiCount > 0 && nextRandom(w) < (tick / rulerGap) * crowding) {
    const p = foundAiRuler(w);
    if (p) {
      const v = w.villages[p.villages[0]];
      news(w, `${p.name} has arrived in the realm and founded ${v.name}.`, 'player', v.id);
    }
  }
  // a new barbarian village, only while the realm has fewer than it started with
  // and only on open ground with no neighbour within two fields
  const barbGap = Math.min(3 * HOUR, Math.max(10 * 60_000, (75 * HOUR) / w.config.speed));
  const target = Math.round(size * size * w.config.barbDensity);
  let barbs = 0;
  for (const id in w.villages) if (w.villages[id].ownerId === null) barbs++;
  if (barbs < target && nextRandom(w) < tick / barbGap) {
    for (let tries = 0; tries < 60; tries++) {
      if (sproutBarbarian(w, 2)) break;
    }
  }
}

/** Found an AI ruler at a spot with real elbow room; null when the realm has none left. */
function foundAiRuler(w: World, headStart = 0): Player | null {
  const taken = new Set(Object.values(w.players).map((p) => p.color));
  const color = PLAYER_COLORS.find((col) => !taken.has(col)) ?? pick(w, PLAYER_COLORS);
  const p = newPlayer(w, uniqueName(w), 'ai', color);
  const v = settle(w, p, villageName(w), true);
  if (!v) {
    delete w.players[p.id];
    return null;
  }
  p.ai = aiState(w, pick(w, PERSONALITIES));
  if (headStart > 0) {
    const b = v.buildings;
    b.timber = headStart + randInt(w, 0, 2); b.claypit = headStart + randInt(w, 0, 2); b.ironmine = headStart + randInt(w, 0, 1);
    b.main = Math.max(1, headStart - 1); b.farm = Math.max(1, headStart - 2); b.warehouse = headStart; b.barracks = Math.max(1, Math.floor(headStart / 2));
    v.points = villagePoints(b);
    p.points = v.points;
  }
  pushEvent(w, 'ai', w.now + randInt(w, 1000, aiThinkInterval(w)), p.id);
  return p;
}

/** A small barbarian village on a random open field with no neighbour within `room` fields. */
function sproutBarbarian(w: World, room: number): Village | null {
  const size = w.config.size;
  const x = randInt(w, 3, size - 4), y = randInt(w, 3, size - 4);
  if (!buildable(terrainAt(w, x, y))) return null;
  for (const o of Object.values(w.villages)) if (Math.abs(o.x - x) <= room && Math.abs(o.y - y) <= room) return null;
  const b = createVillage(w, x, y, 'Barbarian village', null);
  b.buildings.timber = randInt(w, 1, 3); b.buildings.claypit = randInt(w, 1, 3); b.buildings.ironmine = randInt(w, 1, 2);
  b.buildings.warehouse = randInt(w, 1, 3); b.buildings.main = 1; b.buildings.farm = 1;
  b.points = villagePoints(b.buildings);
  b.res = res(randInt(w, 50, 300), randInt(w, 50, 300), randInt(w, 50, 300));
  b.grownAt = w.now;
  if (nextRandom(w) < 0.06) b.bonus = pick(w, ['wood', 'clay', 'iron', 'all', 'farm', 'storage', 'recruit'] as BonusType[]);
  invalidateSpatial();
  w.mapRev++;
  return b;
}

/**
 * Turn an older square realm into today's bigger round one. Everything shifts to
 * the middle of the new island (villages and the coordinates written in reports),
 * the land is laid out afresh around them (with the volcanic west), every existing
 * village keeps solid ground under its feet, and the new land is settled: AI
 * rulers with a modest head start, and barbarian villages at the usual density.
 */
function growRealm(w: World): void {
  const old = w.config.size;
  const size = Math.max(180, Math.ceil(old * Math.SQRT2) + 10);
  const d = Math.floor((size - old) / 2);
  for (const id in w.villages) {
    w.villages[id].x += d;
    w.villages[id].y += d;
  }
  const shift = (o: unknown): void => {
    if (!o || typeof o !== 'object') return;
    const r = o as Record<string, unknown>;
    if (typeof r.vid === 'number' && typeof r.x === 'number' && typeof r.y === 'number') { r.x += d; r.y += d; }
    for (const k in r) if (r[k] && typeof r[k] === 'object') shift(r[k]);
  };
  for (const id in w.players) for (const rep of w.players[id].reports) shift(rep);
  w.config.size = size;
  const t = genTerrain(size, w.seed, d).split('');
  for (const v of Object.values(w.villages)) {
    t[v.y * size + v.x] = isVolcanic(v.x, v.y, size) ? 'v' : '.';
    // nobody wakes up with lava lapping at the gate
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (t[(v.y + dy) * size + v.x + dx] === 'l') t[(v.y + dy) * size + v.x + dx] = 'v';
  }
  w.terrain = t.join('');
  w.round = true;
  invalidateSpatial();
  w.mapRev++;
  // settle the new land in proportion to the old
  const scale = (Math.PI * (size / 2 - 4) ** 2) / (old * old);
  const oldAi = Object.values(w.players).filter((p) => p.kind === 'ai').length;
  const wantAi = Math.round(Math.max(w.config.aiCount, oldAi) * scale);
  w.config.aiCount = wantAi;
  const head = Math.min(10, 4 + Math.floor(w.now / (24 * HOUR)));
  for (let i = oldAi; i < wantAi; i++) if (!foundAiRuler(w, head)) break;
  const wantBarbs = Math.round(Math.PI * (size / 2 - 4) ** 2 * w.config.barbDensity);
  let barbs = Object.values(w.villages).filter((v) => v.ownerId === null).length;
  for (let tries = 0; barbs < wantBarbs && tries < wantBarbs * 40; tries++) if (sproutBarbarian(w, 1)) barbs++;
}

/**
 * Bring a new human ruler into a running world:

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
    delete v.units.necromancer;
    delete v.units.militia;
  }
  news(w, `${p.name} abandoned their lands to the barbarians and set out to start anew.`, 'player');
  p.villages = [];
  p.points = 0;
  p.coins = 0;
  p.paladin = null;
  p.heroGear = undefined;
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
