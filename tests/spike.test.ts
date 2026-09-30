import { describe, expect, it } from 'vitest';
import { sendTroops } from '../src/engine/commands';
import { advance } from '../src/engine/game';
import { HOUR } from '../src/engine/formulas';
import { invalidateSpatial } from '../src/engine/spatial';
import { createWorld, defaultConfig } from '../src/engine/world';

/** Spiking: stationing troops in a barbarian village so other people's raids die there. */
function setup() {
  const w = createWorld({ worldName: 'S', playerName: 'P', villageName: 'Home', seed: 12, config: { ...defaultConfig(), difficulty: 'peaceful', aiCount: 3, size: 90 } });
  const me = w.players[w.humanId];
  const v = w.villages[me.villages[0]];
  const ai = Object.values(w.players).find((p) => p.kind === 'ai')!;
  const av = w.villages[ai.villages[0]];
  const barb = Object.values(w.villages).find((x) => x.ownerId === null && !x.cache)!;
  for (const p of [me, ai]) p.protectedUntil = 0;
  for (const x of [v, av]) Object.assign(x.buildings, { rally: 1, farm: 30, warehouse: 25 });
  barb.x = v.x + 2; barb.y = v.y; av.x = v.x + 4; av.y = v.y + 1;
  barb.units = {};
  invalidateSpatial();
  return { w, me, v, ai, av, barb };
}

describe('spiking barbarian villages', () => {
  it('lets troops station in a barbarian village and fight raiders there', () => {
    const { w, me, v, ai, av, barb } = setup();
    v.units = { spear: 500, sword: 500 };
    expect(sendTroops(w, { ownerId: me.id, fromVid: v.id, toVid: barb.id, kind: 'support', units: { spear: 500, sword: 500 } }).ok).toBe(true);
    advance(w, w.now + 2 * HOUR);
    expect(barb.support.find((s) => s.ownerId === me.id)?.units.spear).toBe(500);
    av.units = { axe: 10 };
    expect(sendTroops(w, { ownerId: ai.id, fromVid: av.id, toVid: barb.id, kind: 'attack', units: { axe: 10 } }).ok).toBe(true);
    advance(w, w.now + 2 * HOUR);
    // the raid died on the spike and brought nothing home
    expect(w.commands && Object.values(w.commands).some((c) => c.ownerId === ai.id && c.kind === 'return' && c.origin === barb.id)).toBe(false);
    expect(me.reports.some((r) => r.title.includes('was attacked'))).toBe(true);
  });

  it('still lets you attack a village you are spiking yourself', () => {
    const { w, me, v, barb } = setup();
    v.units = { spear: 50, axe: 10 };
    sendTroops(w, { ownerId: me.id, fromVid: v.id, toVid: barb.id, kind: 'support', units: { spear: 50 } });
    advance(w, w.now + 2 * HOUR);
    expect(sendTroops(w, { ownerId: me.id, fromVid: v.id, toVid: barb.id, kind: 'attack', units: { axe: 10 } }).ok).toBe(true);
  });
});
