import { Icon } from '../art/icons';
import { Bar, Btn, Cost, Empty, Section } from '../components/common';
import { fmt } from '../format';
import { act, host, view, vid } from '../store';

const MEDALS = ['Bronze', 'Silver', 'Gold', 'Legend'];

export function QuestsScreen() {
  const pv = view.value!;
  const ach = host.value!.achievements();
  const quests = [...pv.quests].sort((a, b) => Number(b.done) - Number(a.done));
  return (
    <div class="stack">
      <div class="page-head"><h1>Quests</h1><span class="muted">Rewards go to the village you have open.</span></div>
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
                  <Btn small disabled={!q.done} onClick={() => act({ type: 'claimQuest', quest: q.id, vid: vid.value }, `Reward claimed: ${q.title}.`)}>Claim</Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Achievements">
        <div class="achievements">
          {ach.map((a) => (
            <div class={`medal tier-${a.tier}`}>
              <div class="medal-badge" aria-hidden="true">{a.tier > 0 ? MEDALS[a.tier - 1][0] : '·'}</div>
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
