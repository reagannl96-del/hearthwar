// Guided quest line with resource rewards, plus achievements computed from stats.

import type { ActionResult, BuildingId, Player, Res, UnitId, World } from './types';
import { RES_KEYS } from './types';
import { storageOf, updateVillage } from './village';
import { HEROES } from './data/units';
import { commandsOf } from './cmdindex';

export interface QuestDef {
  id: string;
  title: string;
  text: string;
  reward: Res;
  requires?: string;
  progress(w: World, p: Player): [number, number];
}

const r = (w: number, c: number, i: number): Res => ({ wood: w, clay: c, iron: i });

/** Villages with a trained hero, at home or out with an army. */
function heroCount(w: World, p: Player): number {
  const withHero = new Set<number>();
  for (const vid of p.villages) {
    const v = w.villages[vid];
    if (v && HEROES.some((h) => (v.units[h] ?? 0) > 0)) withHero.add(vid);
  }
  for (const c of commandsOf(w, p.id)) if (HEROES.some((h) => (c.units[h] ?? 0) > 0)) withHero.add(c.fromVid);
  for (const id in w.villages) for (const st of w.villages[id].support) if (st.ownerId === p.id && HEROES.some((h) => (st.units[h] ?? 0) > 0)) withHero.add(st.fromVid);
  return withHero.size;
}

function maxBuilding(w: World, p: Player, b: BuildingId): number {
  let m = 0;
  for (const vid of p.villages) m = Math.max(m, w.villages[vid]?.buildings[b] ?? 0);
  return m;
}
function minMines(w: World, p: Player): number {
  let best = 0;
  for (const vid of p.villages) {
    const b = w.villages[vid]?.buildings;
    if (b) best = Math.max(best, Math.min(b.timber, b.claypit, b.ironmine));
  }
  return best;
}
function unitsOwned(w: World, p: Player, u: UnitId): number {
  let n = 0;
  for (const vid of p.villages) n += w.villages[vid]?.units[u] ?? 0;
  return n;
}
function researched(w: World, p: Player, u: UnitId): number {
  return p.villages.some((vid) => (w.villages[vid]?.tech[u] ?? 0) >= 1) ? 1 : 0;
}

const bq = (id: string, title: string, text: string, b: BuildingId, lvl: number, reward: Res, requires?: string): QuestDef => ({
  id, title, text, reward, requires, progress: (w, p) => [Math.min(lvl, maxBuilding(w, p, b)), lvl],
});

export const QUESTS: QuestDef[] = [
  bq('timber1', 'Fell the first trees', 'Build a Timber Camp. Wood is needed for nearly everything.', 'timber', 1, r(70, 60, 40)),
  bq('clay1', 'Dig for clay', 'Build a Clay Pit.', 'claypit', 1, r(60, 70, 40), 'timber1'),
  bq('iron1', 'Open the mine', 'Build an Iron Mine.', 'ironmine', 1, r(60, 60, 80), 'clay1'),
  { id: 'mines3', title: 'Steady supply', text: 'Raise all three resource buildings to level 3.', reward: r(200, 200, 200), requires: 'iron1', progress: (w, p) => [Math.min(3, minMines(w, p)), 3] },
  bq('main3', 'Raise the hall', 'Upgrade the Headquarters to level 3 to unlock the barracks.', 'main', 3, r(150, 150, 120), 'mines3'),
  bq('barracks1', 'Call to arms', 'Build the Barracks.', 'barracks', 1, r(200, 170, 90), 'main3'),
  { id: 'spear10', title: 'First recruits', text: 'Have 10 spearmen standing guard at home.', reward: r(300, 200, 100), requires: 'barracks1', progress: (w, p) => [Math.min(10, unitsOwned(w, p, 'spear')), 10] },
  bq('rally1', 'Muster ground', 'Build a Rally Point so you can send out your troops.', 'rally', 1, r(100, 120, 100), 'barracks1'),
  { id: 'raid1', title: 'First blood', text: 'Attack a barbarian village from the map or the rally point.', reward: r(250, 250, 250), requires: 'rally1', progress: (w, p) => [Math.min(1, p.stats.attacks), 1] },
  { id: 'loot1k', title: 'Plunder', text: 'Bring home 1,000 resources from raids.', reward: r(400, 400, 300), requires: 'raid1', progress: (w, p) => [Math.min(1000, p.stats.loot), 1000] },
  bq('warehouse5', 'Room to grow', 'Upgrade the Warehouse to level 5.', 'warehouse', 5, r(400, 400, 350), 'mines3'),
  bq('farm5', 'Feed the people', 'Upgrade the Farm to level 5.', 'farm', 5, r(400, 350, 300), 'warehouse5'),
  { id: 'mines6', title: 'Bustling camps', text: 'Raise all three resource buildings to level 6.', reward: r(600, 600, 600), requires: 'mines3', progress: (w, p) => [Math.min(6, minMines(w, p)), 6] },
  bq('wall3', 'Palisade', 'Build the Wall to level 3. Every level strengthens your defenders.', 'wall', 3, r(300, 500, 200), 'barracks1'),
  bq('main5', 'Hall of stone', 'Upgrade the Headquarters to level 5.', 'main', 5, r(500, 450, 400), 'main3'),
  bq('smithy1', 'The forge', 'Build a Smithy to research new units.', 'smithy', 1, r(500, 400, 500), 'main5'),
  { id: 'axe', title: 'Sharpen the axes', text: 'Research the Axeman in the smithy.', reward: r(700, 500, 600), requires: 'smithy1', progress: (w, p) => [researched(w, p, 'axe'), 1] },
  bq('hiding3', 'Out of sight', 'Build the Hiding Place to level 3 to protect your resources.', 'hiding', 3, r(300, 300, 300), 'raid1'),
  bq('market1', 'Market day', 'Build a Market.', 'market', 1, r(500, 500, 500), 'main5'),
  { id: 'loot10k', title: 'Raider', text: 'Plunder a total of 10,000 resources.', reward: r(1500, 1500, 1200), requires: 'loot1k', progress: (w, p) => [Math.min(10000, p.stats.loot), 10000] },
  bq('main10', 'Seat of power', 'Upgrade the Headquarters to level 10.', 'main', 10, r(1500, 1500, 1200), 'main5'),
  bq('stable1', 'Horses!', 'Build a Stable (needs HQ 10, Barracks 5, Smithy 5).', 'stable', 1, r(1500, 1400, 1500), 'main10'),
  { id: 'scout', title: 'Eyes on the enemy', text: 'Research Scouts and send them to spy on a village.', reward: r(800, 800, 800), requires: 'stable1', progress: (w, p) => [Math.min(1, p.stats.scouted), 1] },
  { id: 'light', title: 'Riders of the plains', text: 'Research Light Cavalry — the best raiders there are.', reward: r(2000, 1800, 2500), requires: 'stable1', progress: (w, p) => [researched(w, p, 'light'), 1] },
  { id: 'mines10', title: 'Industry', text: 'Raise all three resource buildings to level 10.', reward: r(2500, 2500, 2500), requires: 'mines6', progress: (w, p) => [Math.min(10, minMines(w, p)), 10] },
  { id: 'scav2', title: 'Scavengers', text: 'Unlock the second scavenging option at the rally point.', reward: r(1000, 1000, 1000), requires: 'rally1', progress: (w, p) => [p.villages.some((v) => (w.villages[v]?.scavengeUnlocked ?? 0) >= 2) ? 1 : 0, 1] },
  { id: 'paladin', title: 'A champion rises', text: 'Build the Statue and train a hero: a Paladin, Sorcerer, Druid or Goblin Chief.', reward: r(1500, 1500, 1500), requires: 'main10', progress: (w, p) => [heroCount(w, p) > 0 ? 1 : 0, 1] },
  { id: 'heroes2', title: 'Hall of heroes', text: 'Keep heroes in two of your villages.', reward: r(6000, 6000, 6000), requires: 'paladin', progress: (w, p) => [Math.min(2, heroCount(w, p)), 2] },
  { id: 'loot100k', title: 'Master raider', text: 'Plunder a total of 100,000 resources.', reward: r(8000, 8000, 7000), requires: 'loot10k', progress: (w, p) => [Math.min(100000, p.stats.loot), 100000] },
  bq('workshop1', 'Siegecraft', 'Build a Workshop (needs HQ 10, Smithy 10).', 'workshop', 1, r(3000, 2500, 3000), 'stable1'),
  bq('wall10', 'Bulwark', 'Raise the Wall to level 10.', 'wall', 10, r(3000, 5000, 2000), 'wall3'),
  { id: 'mines15', title: 'Prosperity', text: 'Raise all three resource buildings to level 15.', reward: r(6000, 6000, 6000), requires: 'mines10', progress: (w, p) => [Math.min(15, minMines(w, p)), 15] },
  { id: 'oda', title: 'Warmonger', text: 'Defeat 1,000 population worth of enemy troops in your attacks.', reward: r(5000, 5000, 5000), requires: 'raid1', progress: (w, p) => [Math.min(1000, p.stats.killsAtt), 1000] },
  { id: 'odd', title: 'Shieldwall', text: 'Defeat 1,000 population worth of attackers while defending.', reward: r(5000, 5000, 5000), requires: 'wall3', progress: (w, p) => [Math.min(1000, p.stats.killsDef), 1000] },
  bq('main20', 'Great hall', 'Upgrade the Headquarters to level 20.', 'main', 20, r(12000, 12000, 10000), 'main10'),
  bq('smithy20', 'Master smith', 'Upgrade the Smithy to level 20.', 'smithy', 20, r(12000, 12000, 12000), 'main20'),
  bq('market10', 'Trade hub', 'Upgrade the Market to level 10.', 'market', 10, r(8000, 8000, 8000), 'market1'),
  bq('academy', 'House of nobles', 'Build the Academy (HQ 20, Smithy 20, Market 10).', 'academy', 1, r(20000, 20000, 20000), 'main20'),
  { id: 'coin', title: 'The first crown', text: 'Mint a crown in the academy.', reward: r(10000, 10000, 10000), requires: 'academy', progress: (w, p) => [Math.min(1, p.coins), 1] },
  { id: 'noble', title: 'A noble heir', text: 'Train your first nobleman.', reward: r(15000, 15000, 15000), requires: 'coin', progress: (w, p) => [p.stats.conquered > 0 || unitsOwned(w, p, 'noble') > 0 ? 1 : 0, 1] },
  { id: 'v2', title: 'Conqueror', text: 'Conquer a second village. Nobles lower loyalty by 20–35 per hit.', reward: r(25000, 25000, 25000), requires: 'noble', progress: (w, p) => [Math.min(2, p.villages.length), 2] },
  { id: 'v5', title: 'Baron', text: 'Rule 5 villages.', reward: r(50000, 50000, 50000), requires: 'v2', progress: (w, p) => [Math.min(5, p.villages.length), 5] },
  { id: 'v10', title: 'Duke', text: 'Rule 10 villages.', reward: r(100000, 100000, 100000), requires: 'v5', progress: (w, p) => [Math.min(10, p.villages.length), 10] },
  { id: 'v25', title: 'King', text: 'Rule 25 villages.', reward: r(200000, 200000, 200000), requires: 'v10', progress: (w, p) => [Math.min(25, p.villages.length), 25] },
  { id: 'rank1', title: 'Emperor of the realm', text: 'Become the highest-ranked ruler in the world.', reward: r(400000, 400000, 400000), requires: 'v10', progress: (w, p) => [Object.values(w.players).every((o) => o.id === p.id || o.points <= p.points) ? 1 : 0, 1] },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

export function questStatus(w: World, p: Player) {
  return QUESTS.filter((q) => !p.questsClaimed.includes(q.id) && (!q.requires || p.questsClaimed.includes(q.requires)))
    .map((q) => {
      const [cur, max] = q.progress(w, p);
      return { id: q.id, title: q.title, text: q.text, reward: q.reward, cur, max, done: cur >= max };
    });
}

export function claimQuest(w: World, pid: number, id: string, vid?: number): ActionResult {
  const p = w.players[pid];
  const q = QUEST_BY_ID[id];
  if (!q) return { ok: false, error: 'Unknown quest.' };
  if (p.questsClaimed.includes(id)) return { ok: false, error: 'Already claimed.' };
  if (q.requires && !p.questsClaimed.includes(q.requires)) return { ok: false, error: 'Finish the previous quest first.' };
  // bring every village up to date first (troops finish training lazily), so the check sees what the player sees
  for (const vid of p.villages) { const v0 = w.villages[vid]; if (v0) updateVillage(w, v0, w.now); }
  const [cur, max] = q.progress(w, p);
  if (cur < max) return { ok: false, error: 'Not finished yet.' };
  const v = w.villages[vid !== undefined && p.villages.includes(vid) ? vid : p.villages[0]];
  if (!v) return { ok: false, error: 'No village to receive the reward.' };
  updateVillage(w, v, w.now);
  const cap = storageOf(v);
  for (const k of RES_KEYS) v.res[k] = Math.min(cap, v.res[k] + q.reward[k]);
  p.questsClaimed.push(id);
  return { ok: true, data: { vid: v.id } };
}

// ---------- achievements ----------

export interface AchievementDef {
  id: string;
  title: string;
  text: string;
  tiers: number[];
  value(w: World, p: Player): number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'loot', title: 'Plunderer', text: 'Resources plundered', tiers: [5000, 50000, 500000, 5000000], value: (w, p) => p.stats.loot },
  { id: 'oda', title: 'Conqueror of armies', text: 'Enemy population defeated in attack', tiers: [500, 5000, 50000, 250000], value: (w, p) => p.stats.killsAtt },
  { id: 'odd', title: 'Iron wall', text: 'Enemy population defeated in defense', tiers: [500, 5000, 50000, 250000], value: (w, p) => p.stats.killsDef },
  { id: 'ods', title: 'Shield of the realm', text: 'Enemy population defeated while supporting others', tiers: [500, 5000, 50000, 250000], value: (w, p) => p.stats.killsSup ?? 0 },
  { id: 'conquered', title: 'Conqueror', text: 'Villages conquered', tiers: [1, 5, 20, 60], value: (w, p) => p.stats.conquered },
  { id: 'villages', title: 'Lord of the land', text: 'Villages ruled', tiers: [2, 5, 15, 40], value: (w, p) => p.villages.length },
  { id: 'points', title: 'Builder', text: 'Total points', tiers: [1000, 10000, 50000, 200000], value: (w, p) => p.points },
  { id: 'scouted', title: 'Spymaster', text: 'Successful scouting missions', tiers: [5, 50, 250, 1000], value: (w, p) => p.stats.scouted },
  { id: 'attacks', title: 'Warlord', text: 'Attacks launched', tiers: [25, 250, 1500, 6000], value: (w, p) => p.stats.attacks },
  { id: 'recruited', title: 'Drill sergeant', text: 'Units recruited', tiers: [100, 2000, 20000, 100000], value: (w, p) => p.stats.recruited },
];

export function achievementLevels(w: World, p: Player) {
  return ACHIEVEMENTS.map((a) => {
    const v = a.value(w, p);
    let tier = 0;
    while (tier < a.tiers.length && v >= a.tiers[tier]) tier++;
    return { id: a.id, title: a.title, text: a.text, value: v, tier, next: a.tiers[tier] ?? null, tiers: a.tiers };
  });
}
