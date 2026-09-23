// NPC trading post: a constant-product exchange whose rates move with supply.

import { MERCHANT_CARRY } from './data/units';
import { merchantCount } from './formulas';
import type { Res, Village, World } from './types';
import { RES_KEYS } from './types';

/** The trading post keeps half: at balanced stock you get about 1 for 2. */
export const EXCHANGE_FEE = 0.5;

export function exchangeBaseline(w: World): number {
  // the post grows with the strongest human ruler
  let pts = 0;
  for (const id in w.players) if (w.players[id].kind === 'human') pts = Math.max(pts, w.players[id].points);
  return Math.round(Math.max(20000, pts * 12) * Math.sqrt(w.config.speed / 10));
}

export function exchangeQuote(w: World, v: Village, give: keyof Res, get: keyof Res, amount: number) {
  const sGive = Math.max(1, w.exchange[give]);
  const sGet = Math.max(1, w.exchange[get]);
  const k = sGive * sGet;
  const raw = sGet - k / (sGive + amount);
  const receive = Math.max(0, Math.floor(raw * (1 - EXCHANGE_FEE)));
  const freeMerchants = merchantCount(v.buildings.market, v.bonus) - v.merchantsOut;
  const maxAmount = freeMerchants * MERCHANT_CARRY;
  return { receive, rate: amount > 0 ? receive / amount : 0, maxAmount };
}

/** Called periodically: stock drifts back toward the baseline. */
export function replenishExchange(w: World, hours: number): void {
  const base = exchangeBaseline(w);
  const f = 1 - Math.exp(-hours * 0.5 * w.config.speed / 10);
  for (const k of RES_KEYS) w.exchange[k] += (base - w.exchange[k]) * f;
}
