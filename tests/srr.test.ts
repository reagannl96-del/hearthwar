import { describe, expect, it } from 'vitest';
import { sendTroops } from '../src/engine/commands';
import { advance } from '../src/engine/game';
import { HOUR } from '../src/engine/formulas';
import { invalidateSpatial } from '../src/engine/spatial';
import { createWorld, defaultConfig } from '../src/engine/world';
import { isSrr } from '../src/ui/reportFilters';

describe('successful raid reports', () => {
  it('are recognised for a clean raid (scouts along included) on a barbarian village', () => {
    const w = createWorld({ worldName: 'R', playerName: 'P', villageName: 'Home', seed: 5, config: { ...defaultConfig(), difficulty: 'peaceful', aiCount: 3, size: 90 } });
    const me = w.players[w.humanId];
    const v = w.villages[me.villages[0]];
    v.buildings.rally = 1;
    const b = Object.values(w.villages).find((x) => x.ownerId === null && !x.cache)!;
    b.x = v.x + 2; b.y = v.y; b.units = {}; b.buildings.wall = 0;
    invalidateSpatial();
    v.units = { light: 10, scout: 1 };
    expect(sendTroops(w, { ownerId: me.id, fromVid: v.id, toVid: b.id, kind: 'attack', units: { light: 10, scout: 1 } }).ok).toBe(true);
    advance(w, w.now + HOUR);
    const r = me.reports.find((x) => x.kind === 'attack')!;
    expect(r.color).toBe('green');
    expect(isSrr(r)).toBe(true);
  });
});
