// Map markers: colour whole players, tribes or single villages on the map.
// They are a personal note-taking aid, so they live in this browser, per world.

import { signal } from '@preact/signals';
import { lsGet, lsSet } from '../host/storage';

export interface Marks {
  players: Record<number, string>;
  tribes: Record<number, string>;
  villages: Record<number, string>;
}

export const MARK_COLORS = ['#3fd16b', '#e5484d', '#3b8cff', '#b86bff', '#ff8a1f', '#19d3d3', '#ff5fb4', '#f2f2f2'];

const empty = (): Marks => ({ players: {}, tribes: {}, villages: {} });

let key = '';
export const marks = signal<Marks>(empty());

/** Load the markers for a world (call when the map opens). */
export function useWorldMarks(world: string): void {
  const k = `hw-marks-${world}`;
  if (k === key) return;
  key = k;
  try {
    marks.value = { ...empty(), ...JSON.parse(lsGet(k) ?? '{}') };
  } catch {
    marks.value = empty();
  }
}

export function setMark(kind: keyof Marks, id: number, color: string | null): void {
  const next: Marks = { players: { ...marks.value.players }, tribes: { ...marks.value.tribes }, villages: { ...marks.value.villages } };
  if (color) next[kind][id] = color;
  else delete next[kind][id];
  marks.value = next;
  if (key) lsSet(key, JSON.stringify(next));
}

/** The colour a village should be drawn in, if anything marks it (village beats player beats tribe). */
export function markFor(m: Marks, vid: number, ownerId: number | null, tribeId: number | null | undefined): string | undefined {
  return m.villages[vid] ?? (ownerId !== null ? m.players[ownerId] : undefined) ?? (tribeId ? m.tribes[tribeId] : undefined);
}
