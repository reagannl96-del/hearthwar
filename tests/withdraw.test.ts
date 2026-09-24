import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/actions';
import { advance } from '../src/engine/game';
import { createWorld, defaultConfig } from '../src/engine/world';

describe('withdrawing support', () => {
  it('a partial withdraw leaves the rest stationed and marches only the chosen troops home', () => {
    const w = createWorld({
      worldName: 'T', playerName: 'P', villageName: 'Home', seed: 7,
      config: { ...defaultConfig(), difficulty: 'peaceful', aiCount: 4, size: 60 },
    });
    const p = w.players[w.humanId];
    const v = w.villages[p.villages[0]];
    // the nearest village of another player hosts the support
    const host = Object.values(w.villages)
      .filter((x) => x.ownerId !== null && x.ownerId !== p.id)
      .sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
    v.buildings.rally = 1;
    v.units = { ...v.units, spear: 30, axe: 10 };

    const sent = applyAction(w, p.id, { type: 'send', vid: v.id, target: host.id, kind: 'support', units: { spear: 30, axe: 10 } });
    expect(sent.ok).toBe(true);
    const out = Object.values(w.commands).find((c) => c.ownerId === p.id && c.kind === 'support' && c.toVid === host.id)!;
    advance(w, out.arrive + 1000);
    const stack = () => host.support.find((s) => s.fromVid === v.id);
    expect(stack()?.units).toEqual({ spear: 30, axe: 10 });

    // pull back 12 spears only (asking for more axes than exist is clamped, zero is ignored)
    const r = applyAction(w, p.id, { type: 'withdraw', host: host.id, from: v.id, units: { spear: 12, axe: 0 } });
    expect(r.ok).toBe(true);
    expect(stack()?.units).toEqual({ spear: 18, axe: 10 });
    const back = Object.values(w.commands).filter((c) => c.kind === 'return' && c.ownerId === p.id && c.origin === host.id);
    expect(back.length).toBe(1);
    expect(back[0].units).toEqual({ spear: 12 });

    // nothing chosen is refused
    expect(applyAction(w, p.id, { type: 'withdraw', host: host.id, from: v.id, units: {} }).ok).toBe(false);

    // call the rest back: the stack disappears
    expect(applyAction(w, p.id, { type: 'withdraw', host: host.id, from: v.id }).ok).toBe(true);
    expect(stack()).toBeUndefined();
  });
});
