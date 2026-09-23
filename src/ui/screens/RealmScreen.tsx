// World progress: the race for the realm. Which tribes hold how much of it, how
// close the leader is to dominating (60% of all ruled villages), how long the
// round has left, and the winners of earlier rounds.

import { Icon } from '../art/icons';
import { Countdown, Empty, Section } from '../components/common';
import { fmt } from '../format';
import { go, host, now, view } from '../store';

const DAY = 86_400_000;
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

export function RealmScreen() {
  const h = host.value!;
  view.value;
  const r = h.realm();
  const total = r.days * DAY;
  const left = r.endsAt !== null ? Math.max(0, r.endsAt - now.value) : null;
  const elapsed = left !== null ? Math.min(1, 1 - left / total) : 0;
  const lead = r.tribes[0];
  const rows = r.tribes.slice(0, 8);
  const scale = Math.max(r.threshold + 0.1, ...rows.map((t) => t.share), r.tribeless.share);

  return (
    <div class="stack">
      <div class="page-head"><h1>The Realm</h1></div>

      {r.finished ? (
        <div class={`realm-banner ${r.finished.winner?.domination ? 'is-domination' : ''}`}>
          <Icon name="star" size={28} />
          <div>
            <div class="realm-banner-title">
              {r.finished.winner
                ? <>[{r.finished.winner.tag}] {r.finished.winner.name} {r.finished.winner.domination ? 'dominated' : 'won'} the realm</>
                : 'The round is over'}
            </div>
            <div class="small">
              {r.finished.winner && <>They held {pct(r.finished.winner.share)} of all ruled villages when time ran out. </>}
              {h.multiplayer ? 'The realm is frozen on its final standings; a new realm opens shortly.' : 'The realm is frozen on its final standings. Start a new realm from the title screen to play again.'}
            </div>
          </div>
        </div>
      ) : (
        <Section title="This round">
          <div class="realm-clock">
            <div>
              <div class="muted small">Time left</div>
              <div class="realm-left">{r.endsAt !== null ? <Countdown until={r.endsAt} done="ending…" /> : '—'}</div>
            </div>
            <div class="grow">
              <div class="progress"><div style={{ width: `${elapsed * 100}%` }} /></div>
              <div class="muted small">Day {Math.min(r.days, Math.floor(elapsed * r.days) + 1)} of {r.days}</div>
            </div>
          </div>
          <p class="small">
            A tribe that holds <b>{pct(r.threshold)}</b> of all ruled villages (barbarians don't count) is <b>dominating</b> the realm.
            When the round ends, the tribe holding the most of the realm wins it, and a fresh realm opens for the next round.
          </p>
          {lead && (
            <p class={`realm-status ${r.dominating ? 'is-domination' : ''}`}>
              {r.dominating
                ? <><b>[{lead.tag}] {lead.name}</b> is dominating the realm with {pct(lead.share)}.</>
                : <><b>[{lead.tag}] {lead.name}</b> leads with {pct(lead.share)}, {pct(r.threshold - lead.share)} short of domination.</>}
            </p>
          )}
        </Section>
      )}

      <Section title="Race for the realm">
        {rows.length === 0 && r.tribeless.villages === 0 ? <Empty>No one rules any villages yet.</Empty> : (
          <div class="realm-bars" role="table" aria-label="Share of ruled villages by tribe">
            {rows.map((t, i) => (
              <button type="button" role="row" class={`realm-row ${t.id === r.myTribeId ? 'is-mine' : ''}`} onClick={() => go({ name: 'tribe', id: t.id })} title={`${t.name}: ${t.villages} villages, ${t.members} members, ${fmt(t.points)} points`}>
                <span role="cell" class="realm-rank num">{i + 1}</span>
                <span role="cell" class="realm-name"><i class="sw" style={{ background: t.color }} /> <b>[{t.tag}]</b> {t.name}</span>
                <span role="cell" class="realm-track">
                  <span class="realm-fill" style={{ width: `${(t.share / scale) * 100}%`, background: t.color }} />
                  <span class="realm-goal" style={{ left: `${(r.threshold / scale) * 100}%` }} />
                </span>
                <span role="cell" class="realm-val num">{pct(t.share)} <span class="muted">· {fmt(t.villages)}</span></span>
              </button>
            ))}
            {r.tribeless.villages > 0 && (
              <div role="row" class="realm-row is-tribeless">
                <span role="cell" class="realm-rank" />
                <span role="cell" class="realm-name muted">Rulers without a tribe ({r.tribeless.rulers})</span>
                <span role="cell" class="realm-track">
                  <span class="realm-fill" style={{ width: `${(r.tribeless.share / scale) * 100}%` }} />
                  <span class="realm-goal" style={{ left: `${(r.threshold / scale) * 100}%` }} />
                </span>
                <span role="cell" class="realm-val num">{pct(r.tribeless.share)} <span class="muted">· {fmt(r.tribeless.villages)}</span></span>
              </div>
            )}
            <div class="realm-legend small muted"><span class="realm-goal-key" /> {pct(r.threshold)}: domination</div>
          </div>
        )}
        <div class="realm-tiles">
          <div class="realm-tile"><span class="num">{fmt(r.ruled)}</span><span class="muted small">ruled villages</span></div>
          <div class="realm-tile"><span class="num">{fmt(r.barbarians)}</span><span class="muted small">barbarian villages</span></div>
          <div class="realm-tile"><span class="num">{fmt(r.tribes.length)}</span><span class="muted small">tribes holding land</span></div>
        </div>
      </Section>

      <Section title="Mightiest rulers">
        <div class="table-scroll">
          <table class="rank-table">
            <thead><tr><th>#</th><th>Ruler</th><th class="right">Villages</th><th class="right">Points</th></tr></thead>
            <tbody>
              {r.rulers.map((p, i) => (
                <tr class={`clickable ${p.id === r.meId ? 'is-me' : ''}`} onClick={() => go({ name: 'ranking', player: p.id })}>
                  <td class="num">{i + 1}</td>
                  <td>{p.name}{p.tag && <span class="muted"> [{p.tag}]</span>}</td>
                  <td class="right num">{fmt(p.villages)}</td>
                  <td class="right num">{fmt(p.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Hall of fame">
        {r.pastRounds.length === 0 ? <Empty>This is the realm's first round. The winners will be remembered here.</Empty> : (
          <ul class="realm-fame">
            {r.pastRounds.map((p) => (
              <li>
                <Icon name="star" size={18} />
                <div>
                  <b>{p.winner ? `[${p.winner.tag}] ${p.winner.name}` : 'No winner'}</b>
                  {p.winner && <span class="muted"> · {pct(p.winner.share)}{p.winner.domination ? ', domination' : ''}</span>}
                  <div class="muted small">
                    {p.world} · ended {new Date(p.endedReal).toLocaleDateString()}
                    {p.topRuler && <> · mightiest ruler {p.topRuler.name} ({fmt(p.topRuler.points)} points)</>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
