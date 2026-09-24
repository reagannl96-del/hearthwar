import { describe, expect, it } from 'vitest';
import { handleArrival, merchantTime, sendResources } from '../src/engine/commands';
import { MERCHANT_SPEED, OWN_SHIPMENT_SPEED } from '../src/engine/data/units';
import { distance, MINUTE } from '../src/engine/formulas';
import { EXCHANGE_RATE, exchangeQuote } from '../src/engine/market';
import type { World } from '../src/engine/types';
import { createWorld, defaultConfig } from '../src/engine/world';

function peacefulWorld(): World {
  return createWorld({
    worldName: 'T', playerName: 'P', villageName: 'Home', seed: 7,
    config: { ...defaultConfig(), difficulty: 'peaceful', aiCount: 4, size: 60 },
  });
}

function setup() {
  const w = peacefulWorld();
  const p = w.players[w.humanId];
  const v = w.villages[p.villages[0]];
  v.buildings.market = 10;
  const barb = Object.values(w.villages)
    .filter((b) => b.ownerId === null)
    .sort((a, b) => distance(a.x, a.y, v.x, v.y) - distance(b.x, b.y, v.x, v.y))[0];
  const other = Object.values(w.players).find((x) => x.id !== p.id)!;
  return { w, p, v, barb, other };
}

describe('trading post', () => {
  it('pays about 1 for 4 at balanced stock', () => {
    const { w, v } = setup();
    expect(EXCHANGE_RATE).toBeCloseTo(0.25);
    const q = exchangeQuote(w, v, 'iron', 'wood', 1000);
    expect(q.rate).toBeGreaterThan(0.2);
    expect(q.rate).toBeLessThanOrEqual(0.25);
  });
});

describe('merchant travel', () => {
  it('merchants cover a field in MERCHANT_SPEED minutes at unit speed 1', () => {
    const { w, v, barb, other } = setup();
    barb.ownerId = other.id;
    const expected = (distance(v.x, v.y, barb.x, barb.y) * MERCHANT_SPEED * MINUTE) / w.config.unitSpeed;
    expect(merchantTime(w, v, barb)).toBeCloseTo(expected, -1);
  });

  it('shipments between your own villages take 1/0.15 as long', () => {
    const { w, p, v, barb, other } = setup();
    barb.ownerId = other.id;
    const foreign = merchantTime(w, v, barb);
    barb.ownerId = p.id;
    const own = merchantTime(w, v, barb);
    expect(own / foreign).toBeCloseTo(1 / OWN_SHIPMENT_SPEED, 1);
  });

  it('merchants sent to your own village are away twice the slow trip', () => {
    const { w, p, v, barb } = setup();
    barb.ownerId = p.id;
    p.villages.push(barb.id);
    v.res = { wood: 5000, clay: 5000, iron: 5000 };
    const trip = merchantTime(w, v, barb);
    expect(sendResources(w, p.id, v.id, barb.id, { wood: 1000, clay: 0, iron: 0 }).ok).toBe(true);
    const out = Object.values(w.commands).find((c) => c.kind === 'trade' && c.fromVid === v.id)!;
    expect(out.arrive - out.depart).toBe(trip);
    w.now = out.arrive;
    handleArrival(w, out.id, { onConquest() {}, onBattle() {}, onReturn() {} });
    const back = Object.values(w.commands).find((c) => c.kind === 'tradeback' && c.fromVid === v.id)!;
    expect(back.arrive - back.depart).toBe(trip);
  });
});
