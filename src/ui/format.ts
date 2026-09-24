import type { Res } from '../engine/types';

const nf = new Intl.NumberFormat('en-US');

export const fmt = (n: number) => nf.format(Math.floor(n));

export function fmtShort(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(a >= 1e5 ? 0 : 1)}k`;
  return fmt(n);
}

export function fmtDur(ms: number): string {
  if (!isFinite(ms)) return '—';
  if (ms < 0) ms = 0;
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${d}d ${h}:${p(m)}:${p(sec)}`;
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}

/** A game timestamp shown as the wall-clock time it will happen (or happened). */
export function fmtClock(t: number, gameNow: number, warp = 1): string {
  const real = Date.now() + (t - gameNow) / Math.max(warp, 1e-9);
  const d = new Date(real);
  const today = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dayDiff = Math.round((new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86400000);
  if (dayDiff === 0) return time;
  if (dayDiff === 1) return `tomorrow ${time}`;
  if (dayDiff === -1) return `yesterday ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

export function fmtAgo(t: number, gameNow: number): string {
  const ms = gameNow - t;
  if (ms < 60_000) return 'just now';
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)} min ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3600_000)} h ago`;
  return `${Math.floor(ms / 86_400_000)} d ago`;
}

export const coords = (x: number, y: number) => `${x}|${y}`;
export const continent = (x: number, y: number) => `K${Math.floor(y / 10)}${Math.floor(x / 10)}`;

/** The realm is split into four quadrants about its middle: NW, NE, SW and SE. */
export type Quadrant = 'NW' | 'NE' | 'SW' | 'SE';
export const quadrant = (x: number, y: number, size: number): Quadrant => `${y < size / 2 ? 'N' : 'S'}${x < size / 2 ? 'W' : 'E'}` as Quadrant;
export const QUADRANT_NAME: Record<Quadrant, string> = { NW: 'North-west', NE: 'North-east', SW: 'South-west', SE: 'South-east' };

export function interpRes(res: Res, rates: Res, cap: number, resAt: number, t: number): Res {
  const h = Math.max(0, t - resAt) / 3600_000;
  const f = (v: number, r: number) => (v >= cap ? v : Math.min(cap, v + r * h));
  return { wood: f(res.wood, rates.wood), clay: f(res.clay, rates.clay), iron: f(res.iron, rates.iron) };
}

export function parseCoords(s: string): [number, number] | null {
  const m = s.match(/(\d{1,3})\s*[|,;:\s]\s*(\d{1,3})/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
