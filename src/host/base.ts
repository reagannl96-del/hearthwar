// Everything the UI can ask of a game host. Both the single-player LocalHost and
// the online RemoteHost read from a World (the real one locally, the fog-of-war
// shadow online) with the same engine functions.

import { checkBuild, recruitCheck, researchCheck, type Action } from '../engine/actions';
import { resolveBattle, type CombatInput } from '../engine/combat';
import { merchantTime, travelTime } from '../engine/commands';
import { UNITS } from '../engine/data/units';
import { recruitTime, scavengeDuration, scavengeLoot, unitsCarry } from '../engine/formulas';
import { exchangeQuote } from '../engine/market';
import { villageAt } from '../engine/spatial';
import type { ActionResult, BuildingId, Report, UnitId, Units, World } from '../engine/types';
import { unitAvailable, updateVillage } from '../engine/village';
import {
  achievementsFor, buildMap, buildView, playerProfile, rankingFor, realmProgress, tribeHome, tribeProfile, villageInfo, type MapData, type PlayerView,
} from '../engine/view';

export abstract class HostBase {
  world: World;
  pid: number;
  /** true for the shared online world (no pausing, no time warp, no speed changes) */
  multiplayer = false;
  offline = true;
  paused = false;
  warp = 1;
  protected cached: PlayerView | null = null;
  protected cachedAt = -Infinity;
  protected dirty = true;
  private mapCache: MapData | null = null;
  private listeners = new Set<() => void>();

  constructor(world: World, pid: number) {
    this.world = world;
    this.pid = pid;
  }

  abstract tick(): void;
  abstract act(a: Action): ActionResult;
  abstract respawn(name: string): boolean;
  abstract save(): Promise<void>;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  protected emit() {
    for (const fn of this.listeners) fn();
  }

  protected invalidate() {
    this.dirty = true;
    this.cached = null;
  }

  get now(): number {
    return this.world.now;
  }

  view(): PlayerView {
    if (!this.cached) {
      this.cached = buildView(this.world, this.pid);
      this.cachedAt = this.world.now;
      this.dirty = false;
    }
    return this.cached;
  }

  map(): MapData {
    if (!this.mapCache || this.mapCache.rev !== this.world.mapRev) this.mapCache = buildMap(this.world);
    return this.mapCache;
  }

  protected resetMapCache() {
    this.mapCache = null;
  }

  villageInfo(vid: number, fromVid?: number) {
    return villageInfo(this.world, this.pid, vid, fromVid);
  }

  reports(): Report[] {
    return this.world.players[this.pid]?.reports ?? [];
  }

  ranking() {
    return rankingFor(this.world);
  }

  profile(pid: number) {
    return playerProfile(this.world, pid);
  }

  achievements() {
    return achievementsFor(this.world, this.pid);
  }

  tribes() {
    return Object.values(this.world.tribes).map((t) => ({
      ...t,
      points: t.members.reduce((s, m) => s + (this.world.players[m]?.points ?? 0), 0),
      villages: t.members.reduce((s, m) => s + (this.world.players[m]?.villages.length ?? 0), 0),
      memberNames: t.members.map((m) => this.world.players[m]?.name ?? '?'),
    }));
  }

  tribeHome() {
    return tribeHome(this.world, this.pid);
  }

  realm() {
    return realmProgress(this.world, this.pid);
  }

  tribeProfile(tid: number) {
    return tribeProfile(this.world, tid, this.pid);
  }

  simulate(input: CombatInput) {
    return resolveBattle(input);
  }

  exchangeQuote(vid: number, give: 'wood' | 'clay' | 'iron', get: 'wood' | 'clay' | 'iron', amount: number) {
    return exchangeQuote(this.world, this.world.villages[vid], give, get, amount);
  }

  exchangeStock() {
    return { ...this.world.exchange };
  }

  protected liveVillage(vid: number) {
    const v = this.world.villages[vid];
    if (v) updateVillage(this.world, v, this.world.now);
    return v;
  }

  checkBuild(vid: number, b: BuildingId) {
    return checkBuild(this.world, this.liveVillage(vid), b);
  }

  recruitCheck(vid: number, u: UnitId, n: number) {
    return recruitCheck(this.world, this.liveVillage(vid), u, n);
  }

  researchCheck(vid: number, u: UnitId) {
    return researchCheck(this.world, this.liveVillage(vid), u);
  }

  unitAvailable(vid: number, u: UnitId) {
    return unitAvailable(this.world, this.liveVillage(vid), u);
  }

  recruitTime(vid: number, u: UnitId) {
    const v = this.world.villages[vid];
    const b = UNITS[u].building;
    return b ? recruitTime(u, v.buildings[b], this.world.config.speed, v.bonus) : 0;
  }

  travelTime(fromVid: number, toVid: number, units: Units, support = false): number {
    const a = this.world.villages[fromVid], b = this.world.villages[toVid];
    if (!a || !b) return 0;
    return travelTime(this.world, a, b, units, this.pid, support);
  }

  merchantTime(fromVid: number, toVid: number): number {
    const a = this.world.villages[fromVid], b = this.world.villages[toVid];
    if (!a || !b) return 0;
    return merchantTime(this.world, a, b);
  }

  villageAt(x: number, y: number) {
    return villageAt(this.world, x, y)?.id;
  }

  scavengePreview(units: Units, tier: number) {
    const carry = unitsCarry(units);
    return { loot: scavengeLoot(carry, tier), duration: scavengeDuration(carry, tier, this.world.config.speed) };
  }

  // single-player only; online hosts ignore these
  skipToNext(_maxMs?: number): number { return 0; }
  skip(_ms: number): void {}
  setSpeed(_speed: number, _unitSpeed: number): void {}
  exportSave(): string { return ''; }
}
