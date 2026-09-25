// A round of the realm: it runs for a set number of real days (two weeks unless
// the world says otherwise). The player with the most points when time runs out
// wins it. Tribes race for the realm too: the one holding the most of it is
// remembered alongside, and one holding 60% of all ruled villages (barbarians
// don't count) is dominating the world. When the round ends the realm freezes on its final
// standings, and an online server then opens a fresh realm for the next round.

import { news } from './commands';
import { pushEvent } from './events';
import type { Honour, RoundResult, World } from './types';

export const DOMINATION = 0.6;
const DAY = 86_400_000;

export const roundDays = (w: World) => w.config.roundDays ?? 14;

export interface TribeStanding { id: number; name: string; tag: string; color: string; members: number; villages: number; share: number; points: number }
export interface RulerStanding { id: number; name: string; tag: string | null; villages: number; points: number }
export interface Standings {
  /** villages held by rulers: the whole that shares are taken of */
  ruled: number;
  barbarians: number;
  tribes: TribeStanding[];
  /** rulers outside any tribe, together */
  tribeless: { villages: number; share: number; rulers: number };
  rulers: RulerStanding[];
}

export function standings(w: World): Standings {
  let ruled = 0, barbarians = 0, tribeless = 0;
  const byTribe = new Map<number, number>();
  const byRuler = new Map<number, number>();
  for (const id in w.villages) {
    const v = w.villages[id];
    if (v.cache) continue; // a resource cache is nobody's village
    if (v.ownerId === null) { barbarians++; continue; }
    const p = w.players[v.ownerId];
    if (!p) continue;
    ruled++;
    byRuler.set(p.id, (byRuler.get(p.id) ?? 0) + 1);
    if (p.tribeId != null && w.tribes[p.tribeId]) byTribe.set(p.tribeId, (byTribe.get(p.tribeId) ?? 0) + 1);
    else tribeless++;
  }
  const share = (n: number) => (ruled > 0 ? n / ruled : 0);
  const tribes: TribeStanding[] = [...byTribe].map(([id, n]) => {
    const t = w.tribes[id];
    const points = t.members.reduce((s, m) => s + (w.players[m]?.points ?? 0), 0);
    return { id, name: t.name, tag: t.tag, color: t.color, members: t.members.length, villages: n, share: share(n), points };
  }).sort((a, b) => b.villages - a.villages || b.points - a.points);
  const rulers: RulerStanding[] = [...byRuler].map(([id, n]) => {
    const p = w.players[id];
    return { id, name: p.name, tag: p.tribeId != null ? w.tribes[p.tribeId]?.tag ?? null : null, villages: n, points: p.points };
  }).sort((a, b) => b.points - a.points).slice(0, 10);
  const rulersAlone = new Set<number>();
  for (const [id] of byRuler) { const p = w.players[id]; if (p.tribeId == null || !w.tribes[p.tribeId]) rulersAlone.add(id); }
  return { ruled, barbarians, tribes, tribeless: { villages: tribeless, share: share(tribeless), rulers: rulersAlone.size }, rulers };
}

/** Give a world its end date (new worlds, and older ones the first time they load). */
export function scheduleRoundEnd(w: World): void {
  if (w.endsAt !== undefined) return;
  // only the shared online realm plays in rounds
  if (w.accounts === undefined && w.config.roundDays === undefined) return;
  w.endsAt = w.now + roundDays(w) * DAY;
  pushEvent(w, 'end', w.endsAt, 0);
}

/** Time is up: record the final standings and freeze the realm. */
export function finishRound(w: World): void {
  if (w.finished) return;
  const s = standings(w);
  const lead = s.tribes[0];
  const top = s.rulers[0];
  const result: RoundResult = {
    world: w.name,
    at: w.now,
    endedReal: Date.now(),
    days: roundDays(w),
    champion: top ? { name: top.name, tag: top.tag, points: top.points, villages: top.villages } : null,
    winner: lead ? { name: lead.name, tag: lead.tag, color: lead.color, share: lead.share, villages: lead.villages, domination: lead.share >= DOMINATION } : null,
    tribes: s.tribes.slice(0, 5).map((t) => ({ name: t.name, tag: t.tag, share: t.share })),
    topRuler: top ? { name: top.name, tag: top.tag, points: top.points } : null,
  };
  w.finished = result;
  w.mapRev++;
  news(w, top
    ? `The round is over! ${top.name}${top.tag ? ` [${top.tag}]` : ''} wins the realm with ${top.points.toLocaleString('en-US')} points.`
      + (lead ? ` [${lead.tag}] ${lead.name} ${lead.share >= DOMINATION ? 'dominates' : 'leads'} the tribes with ${Math.round(lead.share * 100)}% of its villages.` : '')
    : 'The round is over. Nobody holds the realm.', 'world');
}

/**
 * The realm's best human ruler is its champion: their account is honoured, and the
 * honour follows them into every realm after this one. Returns the champion's name.
 */
export function honourChampion(w: World): string | null {
  const humans = Object.values(w.players).filter((p) => p.kind === 'human' && !p.eliminated).sort((a, b) => b.points - a.points);
  const top = humans[0];
  if (!top || !w.accounts) return null;
  const account = Object.keys(w.accounts).find((k) => w.accounts![k] === top.id);
  if (!account) return null;
  const h: Honour = { title: 'Champion', realm: w.name, at: Date.now(), points: top.points };
  (w.honours ??= {})[account] = [...(w.honours[account] ?? []), h];
  (top.honours ??= []).push(h);
  return top.name;
}
