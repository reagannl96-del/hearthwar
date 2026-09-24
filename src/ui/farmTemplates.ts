// Farm assistant templates: named troop mixes the player sends at barbarian villages.
// A personal convenience, so they live in this browser ('hw-farm'), shared by the
// Rally point's farm assistant and the map's quick-farm buttons.

import type { Units } from '../engine/types';
import { lsGet, lsSet } from '../host/storage';

export interface FarmTemplate { id: number; name: string; units: Units }

export const MAX_TEMPLATES = 8;
export const TEMPLATE_NAME_MAX = 16;
const KEY = 'hw-farm';

/** What a template is called when the player left the name blank: A, B, C… by position. */
export const defaultTplName = (i: number) => String.fromCharCode(65 + i);
export const tplName = (t: FarmTemplate, i: number) => t.name.trim() || defaultTplName(i);

/** Read whatever was saved, including the old fixed `{ a, b }` shape; null when nothing usable is there. */
export function parseTemplates(raw: string | null): FarmTemplate[] | null {
  let data: unknown;
  try { data = JSON.parse(raw ?? ''); } catch { return null; }
  const units = (u: unknown): Units => (u && typeof u === 'object' ? { ...(u as Units) } : {});
  if (Array.isArray(data)) {
    const list = data
      .filter((t) => t && typeof t === 'object')
      .slice(0, MAX_TEMPLATES)
      .map((t, i) => ({
        id: typeof t.id === 'number' ? t.id : i + 1,
        name: typeof t.name === 'string' ? t.name.slice(0, TEMPLATE_NAME_MAX) : '',
        units: units(t.units),
      }));
    return list.length ? list : null;
  }
  // the first version kept exactly two templates, A and B
  const old = data as { a?: Units; b?: Units } | null;
  if (old && typeof old === 'object' && (old.a || old.b)) {
    return [{ id: 1, name: 'A', units: units(old.a) }, { id: 2, name: 'B', units: units(old.b) }];
  }
  return null;
}

/** Templates saved on this device, or two starters (A from `guessA`, B a mixed foot raid). */
export function loadFarmTemplates(guessA: Units = { light: 5 }): FarmTemplate[] {
  return parseTemplates(lsGet(KEY)) ?? [
    { id: 1, name: 'A', units: guessA },
    { id: 2, name: 'B', units: { spear: 20, axe: 10 } },
  ];
}

export function saveFarmTemplates(list: FarmTemplate[]) {
  lsSet(KEY, JSON.stringify(list));
}
