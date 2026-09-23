// In-memory indexes over w.commands (not saved; rebuilt on demand after a load).
// All command creation/removal goes through addCommand/removeCommand.

import type { Command, World } from './types';

interface CmdIndex {
  byTarget: Map<number, Set<number>>;
  byOwner: Map<number, Set<number>>;
  byFrom: Map<number, Set<number>>;
}

const indexes = new WeakMap<World, CmdIndex>();

function put(m: Map<number, Set<number>>, k: number, id: number) {
  let s = m.get(k);
  if (!s) m.set(k, (s = new Set()));
  s.add(id);
}
function drop(m: Map<number, Set<number>>, k: number, id: number) {
  const s = m.get(k);
  if (!s) return;
  s.delete(id);
  if (s.size === 0) m.delete(k);
}

function getIndex(w: World): CmdIndex {
  let idx = indexes.get(w);
  if (!idx) {
    idx = { byTarget: new Map(), byOwner: new Map(), byFrom: new Map() };
    for (const id in w.commands) {
      const c = w.commands[id];
      put(idx.byTarget, c.toVid, c.id);
      put(idx.byOwner, c.ownerId, c.id);
      put(idx.byFrom, c.fromVid, c.id);
    }
    indexes.set(w, idx);
  }
  return idx;
}

export function addCommand(w: World, c: Command): void {
  w.commands[c.id] = c;
  const idx = getIndex(w);
  put(idx.byTarget, c.toVid, c.id);
  put(idx.byOwner, c.ownerId, c.id);
  put(idx.byFrom, c.fromVid, c.id);
}

export function removeCommand(w: World, c: Command): void {
  const idx = getIndex(w);
  delete w.commands[c.id];
  drop(idx.byTarget, c.toVid, c.id);
  drop(idx.byOwner, c.ownerId, c.id);
  drop(idx.byFrom, c.fromVid, c.id);
}

function collect(w: World, set: Set<number> | undefined): Command[] {
  if (!set) return [];
  const out: Command[] = [];
  for (const id of set) {
    const c = w.commands[id];
    if (c) out.push(c);
  }
  return out;
}

export const commandsTo = (w: World, vid: number) => collect(w, getIndex(w).byTarget.get(vid));
export const commandsOf = (w: World, pid: number) => collect(w, getIndex(w).byOwner.get(pid));
export const commandsFrom = (w: World, vid: number) => collect(w, getIndex(w).byFrom.get(vid));
