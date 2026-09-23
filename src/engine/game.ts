// The simulation loop: pops timed events in order and applies them.
// `advance(world, t)` is deterministic and knows nothing about the UI, so a
// multiplayer server can run exactly the same code.

import { aiOnBattle, aiOnConquest, aiThink } from './ai/ai';
import { handleArrival, addReport, type ArrivalHooks, sendTroops, updateIntel } from './commands';
import { BUILDINGS } from './data/buildings';
import { ITEMS, ITEM_BY_ID, UNITS } from './data/units';
import { peekEvent, popEvent, pushEvent } from './events';
import { addUnits, unitsPop } from './formulas';
import { replenishExchange } from './market';
import { nextRandom, pick } from './rng';
import type { Command, GameEvent, Player, UnitId, Village, World } from './types';
import { RES_KEYS } from './types';
import { refreshPoints, storageOf, updateVillage } from './village';
import { BARB_BUILDINGS, aiThinkInterval, barbInterval, itemInterval, sampleInterval } from './world';

const hooks: ArrivalHooks = {
  onConquest(w, v, oldOwner, newOwner) {
    aiOnConquest(w, v, oldOwner, newOwner);
  },
  onBattle(w, c, target, data) {
    aiOnBattle(w, c, target, data);
  },
  onReturn(w, c) {
    if (!c.repeat || c.origin === undefined) return;
    const target = w.villages[c.origin];
    const owner = w.players[c.ownerId];
    if (!target || !owner) return;
    const intel = owner.intel[target.id];
    // keep raiding only while the raids come back clean
    if (intel && intel.lastColor !== 'green') {
      if (owner.kind === 'human') {
        addReport(w, owner.id, {
          kind: 'info', color: 'grey', vid: target.id,
          title: `Repeat raid on ${target.name} stopped`,
          text: 'The last raid took losses, so your troops stayed home.',
          read: false,
        });
      }
      return;
    }
    if (target.ownerId !== null && owner.kind === 'human') return;
    sendTroops(w, {
      ownerId: c.ownerId, fromVid: c.fromVid, toVid: target.id, kind: 'attack', units: c.units, repeat: true,
      catTarget: c.catTarget, tag: c.tag,
    });
  },
};

function completeBuild(w: World, e: GameEvent): void {
  const v = w.villages[e.a];
  if (!v) return;
  const job = v.buildQueue[0];
  if (!job || job.id !== e.b) return; // cancelled or re-chained
  updateVillage(w, v, e.t);
  v.buildQueue.shift();
  const d = BUILDINGS[job.building];
  v.buildings[job.building] = Math.max(d.min, Math.min(d.max, job.level));
  refreshPoints(w, v);
  if (v.ownerId !== null) {
    const p = w.players[v.ownerId];
    if (p) p.stats.built++;
  }
  // resources above a shrunken warehouse (after demolition) are lost
  const cap = storageOf(v);
  for (const k of RES_KEYS) if (v.res[k] > cap) v.res[k] = cap;
}

function completeResearch(w: World, e: GameEvent): void {
  const v = w.villages[e.a];
  if (!v) return;
  const job = v.research[0];
  if (!job || job.id !== e.b) return;
  updateVillage(w, v, e.t);
  v.research.shift();
  v.tech[job.unit] = Math.max(v.tech[job.unit] ?? 0, job.level);
}

function scavengeReturn(w: World, e: GameEvent): void {
  const v = w.villages[e.a];
  if (!v) return;
  const tier = e.b ?? 0;
  const run = v.scavenge[tier];
  if (!run || run.end > e.t) return;
  updateVillage(w, v, e.t);
  addUnits(v.units, run.units);
  v.outPop = Math.max(0, v.outPop - unitsPop(run.units));
  const cap = storageOf(v);
  for (const k of RES_KEYS) v.res[k] = Math.min(cap, Math.max(v.res[k], v.res[k] + run.loot[k]));
  v.scavenge[tier] = null;
  if (v.ownerId !== null) {
    const p = w.players[v.ownerId];
    if (p) p.stats.loot += run.loot.wood + run.loot.clay + run.loot.iron;
  }
}

function barbGrowth(w: World): void {
  // barbarian villages slowly rebuild over the life of the world
  const ageDays = (w.now * w.config.speed) / 86_400_000;
  const cap = Math.min(3000, 160 + ageDays * 25);
  const barbs: Village[] = [];
  for (const id in w.villages) if (w.villages[id].ownerId === null) barbs.push(w.villages[id]);
  const n = Math.max(1, Math.round(barbs.length * 0.025));
  for (let i = 0; i < n && barbs.length > 0; i++) {
    const v = barbs[Math.floor(nextRandom(w) * barbs.length)];
    if (v.points >= cap) continue;
    const b = pick(w, BARB_BUILDINGS);
    if (b === 'wall' && nextRandom(w) < 0.5) continue;
    if (v.buildings[b] >= Math.min(BUILDINGS[b].max, b === 'wall' ? 8 : 25)) continue;
    updateVillage(w, v, w.now);
    v.buildings[b]++;
    refreshPoints(w, v);
  }
  // Barbarians never attack, but they slowly gather a few defenders (a bigger
  // village keeps a bigger garrison), so old barbs are no longer free loot.
  const share = barbs.length * 0.015;
  const m = Math.floor(share) + (nextRandom(w) < share % 1 ? 1 : 0);
  for (let i = 0; i < m && barbs.length > 0; i++) {
    const v = barbs[Math.floor(nextRandom(w) * barbs.length)];
    const have = (v.units.spear ?? 0) + (v.units.sword ?? 0) + (v.units.archer ?? 0);
    if (have >= Math.floor(v.points * 0.25)) continue;
    v.units.spear = (v.units.spear ?? 0) + 1 + Math.floor(nextRandom(w) * 2);
    if (nextRandom(w) < 0.4) v.units.sword = (v.units.sword ?? 0) + 1 + Math.floor(nextRandom(w) * 2);
    else if (w.config.archers && nextRandom(w) < 0.3) v.units.archer = (v.units.archer ?? 0) + 1;
  }
}

function sample(w: World): void {
  for (const id in w.players) {
    const p = w.players[id];
    if (p.eliminated) continue;
    p.history.push([w.now, p.points]);
    if (p.history.length > 400) p.history = p.history.filter((_, i) => i % 2 === 0 || i === p.history.length - 1);
  }
  replenishExchange(w, sampleInterval(w) / 3_600_000);
}

function paladinItem(w: World, e: GameEvent): void {
  const p = w.players[e.a];
  if (!p) return;
  pushEvent(w, 'item', w.now + itemInterval(w), p.id);
  const pal = p.paladin;
  if (!pal || pal.vid === null) return;
  const missing = ITEMS.filter((i) => !pal.items.includes(i.id) && (w.config.archers || (i.unit !== 'archer' && i.unit !== 'marcher')));
  if (missing.length === 0) return;
  const item = pick(w, missing);
  pal.items.push(item.id);
  if (!pal.equipped) pal.equipped = item.id;
  addReport(w, p.id, {
    kind: 'info', color: 'blue',
    title: `${pal.name} found the ${item.name}!`,
    text: `${item.description} Equip it at the statue.`,
  });
}

export function processEvent(w: World, e: GameEvent): void {
  switch (e.type) {
    case 'build': completeBuild(w, e); break;
    case 'research': completeResearch(w, e); break;
    case 'arrive': handleArrival(w, e.a, hooks); break;
    case 'scav': scavengeReturn(w, e); break;
    case 'ai': {
      const p = w.players[e.a];
      if (p && !p.eliminated && p.ai) {
        aiThink(w, p);
        pushEvent(w, 'ai', w.now + aiThinkInterval(w) * (0.85 + nextRandom(w) * 0.3), p.id);
      }
      break;
    }
    case 'barb':
      barbGrowth(w);
      pushEvent(w, 'barb', w.now + barbInterval(w), 0);
      break;
    case 'sample':
      sample(w);
      pushEvent(w, 'sample', w.now + sampleInterval(w), 0);
      break;
    case 'item': paladinItem(w, e); break;
  }
}

/**
 * Advance the world to time `to`, processing every event on the way.
 * Returns false if it stopped early because `budgetMs` of wall-clock time ran out.
 */
export function advance(w: World, to: number, budgetMs = Infinity): boolean {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let n = 0;
  for (;;) {
    const e = peekEvent(w);
    if (!e || e.t > to) break;
    popEvent(w);
    if (e.t > w.now) w.now = e.t;
    processEvent(w, e);
    if (++n % 200 === 0 && budgetMs !== Infinity) {
      const el = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
      if (el > budgetMs) return false;
    }
  }
  if (to > w.now) w.now = to;
  return true;
}

export function nextEventTime(w: World): number | undefined {
  return peekEvent(w)?.t;
}

export { updateIntel };
export type { Command, Player, UnitId };
export { UNITS, ITEM_BY_ID };
