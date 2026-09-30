import { describe, expect, it } from 'vitest';
import { sendTroops } from '../src/engine/commands';
import { advance } from '../src/engine/game';
import { HOUR } from '../src/engine/formulas';
import { invalidateSpatial } from '../src/engine/spatial';
import type { FarmMode } from '../src/engine/types';
import { createWorld, defaultConfig } from '../src/engine/world';

/** A home village with two empty barbarian villages next door. */
function setup() {
  const w = createWorld({ worldName: 'F', playerName: 'P', villageName: 'Home', seed: 5, config: { ...defaultConfig(), difficulty: 'peaceful', aiCount: 3, size: 90 } });
  const me = w.players[w.humanId];
  const v = w.villages[me.villages[0]];
  v.buildings.rally = 1;
  const barbs = Object.values(w.villages).filter((x) => x.ownerId === null && !x.cache).slice(0, 2);
  // everything else far away, so these two are the only choices
  for (const x of Object.values(w.villages)) if (x.ownerId === null && !barbs.includes(x)) { x.x = v.x + 40; x.y = v.y + 40; }
  barbs.forEach((b, i) => { b.x = v.x + 2 + i; b.y = v.y; b.units = {}; b.res = { wood: 0, clay: 0, iron: 0 }; b.buildings.wall = 0; });
  invalidateSpatial();
  return { w, me, v, a: barbs[0], b: barbs[1] };
}

const run = (farmMode?: FarmMode) => {
  const s = setup();
  s.v.units = { light: 20 };
  expect(sendTroops(s.w, { ownerId: s.me.id, fromVid: s.v.id, toVid: s.a.id, kind: 'attack', units: { light: 20 }, repeat: true, farmMode }).ok).toBe(true);
  advance(s.w, s.w.now + 3 * HOUR);
  const out = Object.values(s.w.commands).filter((c) => c.ownerId === s.me.id && c.repeat);
  return { ...s, out };
};

describe('repeating raids that come home empty', () => {
  it('keep raiding the same village by default', () => {
    const { out, a } = run();
    expect(out.some((c) => c.toVid === a.id || c.origin === a.id)).toBe(true);
  });
  it('stop when asked to', () => {
    const { out, me } = run('stop');
    expect(out.length).toBe(0);
    expect(me.reports.some((r) => r.title.includes('stopped'))).toBe(true);
  });
  it('move on to another barbarian village when asked to', () => {
    const { me } = run('switch');
    const log = me.reports.filter((r) => r.title.startsWith('Repeat raid')).map((r) => r.title).reverse();
    expect(log[0]).toContain('moved');
    // both villages empty: it does not bounce between them, it stops once both came up short
    expect(log.at(-1)).toContain('stopped');
  });
});
