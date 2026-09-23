// LocalHost runs the authoritative simulation in the browser tab and persists it.

import { applyAction, type Action } from '../engine/actions';
import { advance, nextEventTime } from '../engine/game';
import { invalidateSpatial } from '../engine/spatial';
import type { ActionResult, World } from '../engine/types';
import { recomputeCounters, recomputePlayerPoints } from '../engine/village';
import { createWorld, migrateWorld, respawnHuman, WORLD_VERSION, type NewWorldOptions } from '../engine/world';
import { HostBase } from './base';
import { idbDel, idbGet, idbSet } from './storage';

export interface SaveMeta {
  id: string;
  name: string;
  playerName: string;
  points: number;
  villages: number;
  speed: number;
  savedAt: number;
  createdAt: number;
  gameTime: number;
}

interface SaveBlob {
  world: World;
  savedAt: number;
  offline: boolean;
}

const INDEX_KEY = 'index';
const MAX_OFFLINE_MS = 14 * 24 * 3600_000;

export async function listSaves(): Promise<SaveMeta[]> {
  const idx = (await idbGet<SaveMeta[]>(INDEX_KEY)) ?? [];
  return idx.sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteSave(id: string): Promise<void> {
  await idbDel(`world:${id}`);
  const idx = (await listSaves()).filter((m) => m.id !== id);
  await idbSet(INDEX_KEY, idx);
}

export class LocalHost extends HostBase {
  private lastReal = Date.now();
  private lastSave = Date.now();
  saving = false;

  private constructor(world: World) {
    super(world, world.humanId);
    invalidateSpatial();
  }

  static async create(opts: NewWorldOptions): Promise<LocalHost> {
    const w = createWorld(opts);
    const h = new LocalHost(w);
    await h.save();
    return h;
  }

  /** Load a save, simulating the time that passed while the game was closed. */
  static async load(id: string, onProgress?: (done: number, total: number) => void): Promise<LocalHost> {
    const blob = await idbGet<SaveBlob>(`world:${id}`);
    if (!blob) throw new Error('Save not found.');
    return LocalHost.fromBlob(blob, onProgress);
  }

  static async fromBlob(blob: SaveBlob, onProgress?: (done: number, total: number) => void): Promise<LocalHost> {
    const w = blob.world;
    if (!w || w.version !== WORLD_VERSION) throw new Error('This save was made by an incompatible version.');
    recomputeCounters(w);
    migrateWorld(w);
    recomputePlayerPoints(w);
    const h = new LocalHost(w);
    h.offline = blob.offline !== false;
    if (h.offline) {
      const away = Math.min(MAX_OFFLINE_MS, Math.max(0, Date.now() - blob.savedAt));
      const target = w.now + away;
      const start = w.now;
      // catch up in slices so the page can paint a progress bar
      while (w.now < target) {
        const done = advance(w, target, 40);
        onProgress?.(w.now - start, target - start);
        await new Promise((r) => setTimeout(r, 0));
        if (done) break;
      }
    }
    h.lastReal = Date.now();
    return h;
  }

  /** Advance the world by the real time that passed (scaled by warp). */
  tick(): void {
    // wall-clock time so a sleeping laptop still catches up when it wakes
    const real = Date.now();
    const dt = Math.min(MAX_OFFLINE_MS, real - this.lastReal);
    this.lastReal = real;
    if (!this.paused && dt > 0) {
      const before = this.world.seq;
      const eventsBefore = this.world.events.length;
      advance(this.world, this.world.now + dt * this.warp);
      if (this.world.seq !== before || this.world.events.length !== eventsBefore) this.dirty = true;
    }
    if (this.dirty || this.world.now - this.cachedAt >= 1000 * Math.max(1, this.warp)) {
      this.cached = null;
      this.emit();
    }
    if (Date.now() - this.lastSave > 20_000) void this.save();
  }

  /** Jump straight to the next scheduled event (single-player convenience). */
  skipToNext(maxMs = 3600_000): number {
    const t = nextEventTime(this.world);
    const target = t === undefined ? this.world.now + maxMs : Math.min(t, this.world.now + maxMs);
    const jumped = Math.max(0, target - this.world.now);
    advance(this.world, target);
    this.invalidate();
    this.emit();
    return jumped;
  }

  skip(ms: number): void {
    advance(this.world, this.world.now + ms);
    this.invalidate();
    this.emit();
  }

  act(a: Action): ActionResult {
    const r = applyAction(this.world, this.pid, a);
    this.invalidate();
    queueMicrotask(() => this.emit());
    return r;
  }

  respawn(name: string): boolean {
    const v = respawnHuman(this.world, name);
    this.invalidate();
    this.emit();
    return !!v;
  }

  setSpeed(speed: number, unitSpeed: number): void {
    this.world.config.speed = speed;
    this.world.config.unitSpeed = unitSpeed;
    this.invalidate();
    this.emit();
  }

  meta(): SaveMeta {
    const w = this.world;
    const p = w.players[this.pid];
    return {
      id: w.id, name: w.name, playerName: p.name, points: p.points, villages: p.villages.length,
      speed: w.config.speed, savedAt: Date.now(), createdAt: w.createdReal, gameTime: w.now,
    };
  }

  async save(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    this.lastSave = Date.now();
    try {
      const blob: SaveBlob = { world: this.world, savedAt: Date.now(), offline: this.offline };
      await idbSet(`world:${this.world.id}`, blob);
      const idx = (await idbGet<SaveMeta[]>(INDEX_KEY)) ?? [];
      const meta = this.meta();
      const i = idx.findIndex((m) => m.id === meta.id);
      if (i >= 0) idx[i] = meta; else idx.push(meta);
      await idbSet(INDEX_KEY, idx);
    } finally {
      this.saving = false;
    }
  }

  exportSave(): string {
    return JSON.stringify({ world: this.world, savedAt: Date.now(), offline: this.offline } satisfies SaveBlob);
  }
}

export async function importSave(text: string): Promise<string> {
  let blob: SaveBlob;
  try {
    blob = JSON.parse(text);
  } catch {
    throw new Error('That does not look like a Hearthwar save.');
  }
  if (!blob?.world?.id || blob.world.version !== WORLD_VERSION) throw new Error('That does not look like a Hearthwar save.');
  await idbSet(`world:${blob.world.id}`, blob);
  const h = await LocalHost.fromBlob({ ...blob, offline: false });
  await h.save();
  return blob.world.id;
}
