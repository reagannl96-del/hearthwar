// Binary min-heap of timed events stored directly in the world (serializable).

import type { GameEvent, GameEventType, World } from './types';

function less(a: GameEvent, b: GameEvent): boolean {
  return a.t < b.t || (a.t === b.t && a.s < b.s);
}

export function pushEvent(w: World, type: GameEventType, t: number, a: number, b?: number): void {
  const h = w.events;
  const e: GameEvent = { t, s: w.seq++, type, a };
  if (b !== undefined) e.b = b;
  h.push(e);
  let i = h.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (!less(h[i], h[p])) break;
    [h[i], h[p]] = [h[p], h[i]];
    i = p;
  }
}

export function peekEvent(w: World): GameEvent | undefined {
  return w.events[0];
}

export function popEvent(w: World): GameEvent | undefined {
  const h = w.events;
  if (h.length === 0) return undefined;
  const top = h[0];
  const last = h.pop()!;
  if (h.length > 0) {
    h[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < h.length && less(h[l], h[m])) m = l;
      if (r < h.length && less(h[r], h[m])) m = r;
      if (m === i) break;
      [h[i], h[m]] = [h[m], h[i]];
      i = m;
    }
  }
  return top;
}

/** Remove events matching a predicate (rare; rebuilds the heap). */
export function removeEvents(w: World, pred: (e: GameEvent) => boolean): void {
  const keep = w.events.filter((e) => !pred(e));
  w.events = [];
  for (const e of keep.sort((a, b) => (less(a, b) ? -1 : 1))) w.events.push(e);
}
