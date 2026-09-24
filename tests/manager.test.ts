import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/actions';
import { advance } from '../src/engine/game';
import { ARMY_PRESETS, BUILD_PRESETS } from '../src/engine/manager';
import { createWorld, defaultConfig } from '../src/engine/world';
import { conquer } from '../src/engine/commands';

const HOUR = 3_600_000;

function world() {
  const w = createWorld({ worldName: 'M', playerName: 'Me', villageName: 'Home', seed: 3, config: { ...defaultConfig(), size: 60, aiCount: 2 } });
  const me = Object.values(w.players).find((p) => p.kind === 'human')!;
  const v = w.villages[me.villages[0]];
  // the manager unlocks at five villages: take four barbarian villages nearby
  const barbs = Object.values(w.villages).filter((b) => b.ownerId === null)
    .sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y)).slice(0, 4);
  for (const b of barbs) conquer(w, b, me.id);
  return { w, me, v };
}

describe('the village manager', () => {
  it('works through a build template on its own, in order', () => {
    const { w, me, v } = world();
    v.res = { wood: 400_000, clay: 400_000, iron: 400_000 };
    const eco = { id: 1, ...BUILD_PRESETS[0] };
    expect(applyAction(w, me.id, { type: 'manager', manager: { build: [eco], army: [], villages: { [v.id]: { build: 1 } } } }).ok).toBe(true);
    const before = v.buildings.timber;
    advance(w, w.now + 6 * HOUR);
    expect(v.buildings.timber).toBeGreaterThan(before);
    expect(v.buildings.timber).toBeGreaterThanOrEqual(5);
    // it never goes past the level the template asks for at the current step
    expect(v.buildings.timber).toBeLessThanOrEqual(30);
  });

  it('recruits toward an army template from what the buildings do not need', () => {
    const { w, me, v } = world();
    Object.assign(v.buildings, { barracks: 10, farm: 20, warehouse: 25, main: 10, smithy: 5 });
    v.res = { wood: 300_000, clay: 300_000, iron: 300_000 };
    const def = { id: 1, ...ARMY_PRESETS[1] };
    applyAction(w, me.id, { type: 'manager', manager: { build: [], army: [def], villages: { [v.id]: { army: 1 } } } });
    advance(w, w.now + 3 * HOUR);
    const queued = Object.values(v.recruit).flat().reduce((n, j) => n + j.count, 0);
    expect((v.units.spear ?? 0) + (v.units.sword ?? 0) + queued).toBeGreaterThan(0);
  });

  it('a paused village is left alone, and junk from the client is cleaned up', () => {
    const { w, me, v } = world();
    v.res = { wood: 400_000, clay: 400_000, iron: 400_000 };
    applyAction(w, me.id, {
      type: 'manager',
      manager: {
        build: [{ id: 7, name: 'x'.repeat(200), steps: [{ b: 'timber', to: 999 }, { b: 'nope', to: 3 }] }],
        army: [{ id: 7, name: 'a', units: { noble: 5, axe: -3, spear: 10 } }],
        villages: { [v.id]: { build: 7, army: 7, paused: true }, 99999: { build: 7 } },
      },
    });
    const m = me.manager!;
    expect(m.build[0].name.length).toBeLessThanOrEqual(40);
    expect(m.build[0].steps).toEqual([{ b: 'timber', to: 30 }]);
    expect(m.army[0].units).toEqual({ spear: 10 });
    expect(Object.keys(m.villages)).toEqual([String(v.id)]);
    const before = JSON.stringify(v.buildings);
    advance(w, w.now + 2 * HOUR);
    expect(JSON.stringify(v.buildings)).toBe(before);
  });

  it('keeps running after the world is saved and loaded', () => {
    const { w, me, v } = world();
    v.res = { wood: 400_000, clay: 400_000, iron: 400_000 };
    applyAction(w, me.id, { type: 'manager', manager: { build: [{ id: 1, ...BUILD_PRESETS[0] }], army: [], villages: { [v.id]: { build: 1 } } } });
    const w2 = JSON.parse(JSON.stringify(w));
    const v2 = w2.villages[v.id];
    const before = v2.buildings.clay ?? v2.buildings.claypit;
    advance(w2, w2.now + 6 * HOUR);
    expect(v2.buildings.claypit).toBeGreaterThan(before);
  });

  it('unlocks at five villages, and switches itself off below that', () => {
    const { w, me, v } = world();
    const m = { build: [{ id: 1, ...BUILD_PRESETS[0] }], army: [], villages: { [v.id]: { build: 1 } } };
    expect(applyAction(w, me.id, { type: 'manager', manager: m }).ok).toBe(true);
    // losing a village takes it under five: the next look finds it switched off, templates kept
    const lost = w.villages[me.villages[me.villages.length - 1]];
    conquer(w, lost, Object.values(w.players).find((p) => p.kind === 'ai')!.id);
    advance(w, w.now + 2 * 60_000);
    expect(Object.keys(me.manager!.villages)).toHaveLength(0);
    expect(me.manager!.build).toHaveLength(1);
    // and it cannot be switched back on until there are five again
    expect(applyAction(w, me.id, { type: 'manager', manager: m }).ok).toBe(false);
  });
});
