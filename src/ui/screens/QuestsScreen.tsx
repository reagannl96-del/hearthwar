import { useState } from 'preact/hooks';
import { Icon } from '../art/icons';
import { Bar, Btn, Cost, Empty, Section } from '../components/common';
import { fmt } from '../format';
import { act, host, view, usePane } from '../store';

const MEDALS = ['Bronze', 'Silver', 'Gold', 'Legend'];

export function QuestsScreen() {
  const pane = usePane();
  const pv = view.value!;
  const ach = host.value!.achievements();
  const quests = [...pv.quests].sort((a, b) => Number(b.done) - Number(a.done));
  // as in Tribal Wars, a reward goes to the village you have open, unless you pick another
  const [pick, setPick] = useState<number | null>(null);
  const to = pv.villages.find((v) => v.id === pick) ?? pv.villages.find((v) => v.id === pane.vid.value) ?? pv.villages[0];
  // what would not fit in that village's warehouse, per quest
  const overflow = (r: { wood: number; clay: number; iron: number }) =>
    to ? (['wood', 'clay', 'iron'] as const).reduce((n, k) => n + Math.max(0, to.res[k] + r[k] - to.storage), 0) : 0;
  return (
    <div class="stack">
      <div class="page-head">
        <h1>Quests</h1>
        {pv.villages.length > 1 ? (
          <label class="muted small quest-to">Rewards go to{' '}
            <select value={to?.id} onChange={(e) => setPick(Number(e.currentTarget.value))}>
              {pv.villages.map((v) => <option value={v.id}>{v.name} ({v.x}|{v.y})</option>)}
            </select>
          </label>
        ) : <span class="muted">Rewards go to the village you have open.</span>}
      </div>
      <Section>
        {quests.length === 0 ? <Empty>You have completed every quest. The realm is yours to shape.</Empty> : (
          <ul class="quest-list">
            {quests.map((q) => (
              <li class={`quest ${q.done ? 'is-done' : ''}`}>
                <div class="quest-main">
                  <h3><Icon name="quest" size={18} /> {q.title}</h3>
                  <p>{q.text}</p>
                  <div class="quest-progress">
                    <Bar value={q.cur} max={q.max} tone={q.done ? 'ok' : 'accent'} />
                    <span class="num small">{fmt(q.cur)} / {fmt(q.max)}</span>
                  </div>
                </div>
                <div class="quest-reward">
                  <span class="muted small">Reward</span>
                  <Cost cost={q.reward} compact />
                  <Btn small disabled={!q.done} onClick={() => act({ type: 'claimQuest', quest: q.id, vid: to?.id }, `Reward claimed: ${q.title}, sent to ${to?.name ?? 'your village'}.`)}>Claim</Btn>
                  {q.done && overflow(q.reward) > 0 && <span class="small bad-text" title="The warehouse there cannot hold it all">{fmt(overflow(q.reward))} won't fit in {to?.name}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Achievements">
        <div class="achievements">
          {ach.map((a) => (
            <div class={`ach-card tier-${a.tier}`}>
              <div class="ach-badge" aria-hidden="true">{a.tier > 0 ? MEDALS[a.tier - 1][0] : '·'}</div>
              <div class="grow">
                <b>{a.title}</b> {a.tier > 0 && <span class="pill">{MEDALS[a.tier - 1]}</span>}
                <div class="muted small">{a.text}: <span class="num">{fmt(a.value)}</span>{a.next !== null && <> · next at <span class="num">{fmt(a.next)}</span></>}</div>
                {a.next !== null && <Bar value={a.value} max={a.next} />}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
