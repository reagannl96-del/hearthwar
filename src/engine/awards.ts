// Daily awards, as in Tribal Wars: each day the ruler who defeated the most as an
// attacker, defender or supporter, plundered the most or conquered the most wins
// the title for that day. Winners keep a record of every day they won, with their
// score and the runner-up's.

import { news } from './commands';
import type { DailyAward, DailyKind, Player, World } from './types';

export const DAILY_KINDS: DailyKind[] = ['attacker', 'defender', 'supporter', 'looter', 'conqueror'];

export const DAILY_INFO: Record<DailyKind, { title: string; text: string; unit: string }> = {
  attacker: { title: 'Attacker of the day', text: 'Defeat the most enemy troops in this world as an attacker.', unit: 'defeated' },
  defender: { title: 'Defender of the day', text: 'Defeat the most enemy troops in this world as a defender.', unit: 'defeated' },
  supporter: { title: 'Supporter of the day', text: 'Defeat the most enemy troops while supporting another ruler.', unit: 'defeated' },
  looter: { title: 'Plunderer of the day', text: 'Plunder the most resources in this world.', unit: 'plundered' },
  conqueror: { title: 'Conqueror of the day', text: 'Conquer the most villages in this world.', unit: 'conquered' },
};

const DAY = 86_400_000;

/** Which calendar day (UTC) it is in the world. */
export function dayOf(w: World): number {
  return Math.floor((w.createdReal + w.now) / DAY);
}

export function dayLabel(day: number): string {
  return new Date(day * DAY).toISOString().slice(0, 10);
}

function emptyDaily(day: number): NonNullable<Player['daily']> {
  return { day, attacker: 0, defender: 0, supporter: 0, looter: 0, conqueror: 0 };
}

/** Close the previous day and hand out its awards, if the day has turned. */
export function rolloverDay(w: World): void {
  const today = dayOf(w);
  if (w.dayKey === undefined) { w.dayKey = today; return; }
  if (w.dayKey === today) return;
  const closing = w.dayKey;
  w.dayKey = today;
  for (const kind of DAILY_KINDS) {
    const ranked = Object.values(w.players)
      .filter((p) => !p.eliminated && p.daily?.day === closing && (p.daily[kind] ?? 0) > 0)
      .sort((a, b) => (b.daily![kind] ?? 0) - (a.daily![kind] ?? 0));
    const winner = ranked[0];
    if (!winner) continue;
    const award: DailyAward = { kind, day: closing, score: Math.round(winner.daily![kind]), runnerUp: ranked[1] ? Math.round(ranked[1].daily![kind]) : null };
    winner.dailyAwards = [award, ...(winner.dailyAwards ?? [])].slice(0, 120);
    news(w, `${winner.name} is ${DAILY_INFO[kind].title.toLowerCase()} for ${dayLabel(closing)} (${award.score.toLocaleString('en-US')} ${DAILY_INFO[kind].unit}).`, 'player');
  }
  for (const id in w.players) delete w.players[id].daily;
}

/** Count something towards today's awards. */
export function bumpDaily(w: World, p: Player | undefined, kind: DailyKind, n: number): void {
  if (!p || n <= 0) return;
  rolloverDay(w);
  const today = w.dayKey!;
  if (!p.daily || p.daily.day !== today) p.daily = emptyDaily(today);
  p.daily[kind] = (p.daily[kind] ?? 0) + n;
}

/** A player's daily awards, grouped for their profile. */
export function awardsSummary(p: Player): { kind: DailyKind; title: string; text: string; count: number; history: DailyAward[] }[] {
  return DAILY_KINDS.map((kind) => {
    const history = (p.dailyAwards ?? []).filter((a) => a.kind === kind);
    return { kind, title: DAILY_INFO[kind].title, text: DAILY_INFO[kind].text, count: history.length, history };
  }).filter((a) => a.count > 0);
}
