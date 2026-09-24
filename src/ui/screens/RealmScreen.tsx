// World progress: the race for the realm. Who leads on points (the top player
// wins the round), which tribes hold how much of it, how long the round has
// left, and the winners of earlier rounds.

import { Icon } from '../art/icons';
import { Countdown, Empty, Section } from '../components/common';
import { fmt } from '../format';
import { host, now, view, usePane } from '../store';

const DAY = 86_400_000;
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

export function RealmScreen() {
  const pane = usePane();
  const h = host.value!;
  view.value;
  const r = h.realm();
  const total = r.days * DAY;
  const left = r.endsAt !== null ? Math.max(0, r.endsAt - now.value) : null;
  const elapsed = left !== null ? Math.min(1, 1 - left / total) : 0;
  const lead = r.tribes[0];
  const leader = r.rulers[0];
  // rounds finished before the top player won them name the mightiest ruler instead
  const champ = (x: { champion?: { name: string; tag: string | null; points: number } | null; topRuler: { name: string; tag: string | null; points: number } | null }) => x.champion ?? x.topRuler;
  const fin = r.finished ? champ(r.finished) : null;
  const rows = r.tribes.slice(0, 8);
  const scale = Math.max(r.threshold + 0.1, ...rows.map((t) => t.share), r.tribeless.share);

  return (
    <div class="stack">
      <div class="page-head"><h1>The Realm</h1></div>

      {r.finished ? (
        <div class="realm-banner is-domination">
          <Icon name="star" size={28} />
          <div>
            <div class="realm-banner-title">
              {fin ? <>{fin.name}{fin.tag && <> [{fin.tag}]</>} won the realm</> : 'The round is over'}
            </div>
            <div class="small">
              {fin && <>{fmt(fin.points)} points when time ran out. </>}
              {r.finished.winner && <>Top tribe: [{r.finished.winner.tag}] {r.finished.winner.name}, holding {pct(r.finished.winner.share)} of all ruled villages. </>}
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
            When the round ends after <b>{r.days} days</b>, the <b>player with the most points</b> wins the realm, and a fresh realm opens for the next round.
            Tribes race for the realm too: one holding <b>{pct(r.threshold)}</b> of all ruled villages (barbarians don't count) is <b>dominating</b> it.
          </p>
          {leader && (
            <p class="realm-status is-domination">
              {leader.id === r.meId ? <><b>You</b> lead</> : <><b>{leader.name}</b>{leader.tag && <> [{leader.tag}]</>} leads</>} the realm with <b class="num">{fmt(leader.points)}</b> points
              {r.rulers[1] && <>, {fmt(leader.points - r.rulers[1].points)} ahead of {r.rulers[1].id === r.meId ? 'you' : r.rulers[1].name}</>}.
            </p>
          )}
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
          <div class="realm-bars" aria-label="Share of ruled villages by tribe">
            {rows.map((t, i) => (
              <button type="button" class={`realm-row ${t.id === r.myTribeId ? 'is-mine' : ''}`} onClick={() => pane.go({ name: 'tribe', id: t.id })} title={`${t.name}: ${t.villages} villages, ${t.members} members, ${fmt(t.points)} points`}>
                <span class="realm-rank num">{i + 1}</span>
                <span class="realm-name"><i class="sw" style={{ background: t.color }} /> <b>[{t.tag}]</b> {t.name}</span>
                <span class="realm-track">
                  <span class="realm-fill" style={{ width: `${(t.share / scale) * 100}%`, background: t.color }} />
                  <span class="realm-goal" style={{ left: `${(r.threshold / scale) * 100}%` }} />
                </span>
                <span class="realm-val num">{pct(t.share)} <span class="muted">· {fmt(t.villages)}</span></span>
              </button>
            ))}
            {r.tribeless.villages > 0 && (
              <div class="realm-row is-tribeless">
                <span class="realm-rank" />
                <span class="realm-name muted">Rulers without a tribe ({r.tribeless.rulers})</span>
                <span class="realm-track">
                  <span class="realm-fill" style={{ width: `${(r.tribeless.share / scale) * 100}%` }} />
                  <span class="realm-goal" style={{ left: `${(r.threshold / scale) * 100}%` }} />
                </span>
                <span class="realm-val num">{pct(r.tribeless.share)} <span class="muted">· {fmt(r.tribeless.villages)}</span></span>
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
                <tr class={`clickable ${p.id === r.meId ? 'is-me' : ''}`} onClick={() => pane.go({ name: 'ranking', player: p.id })}>
                  <td class="num">{i + 1}</td>
                  <td><button type="button" class="link" onClick={(e) => { e.stopPropagation(); pane.go({ name: 'ranking', player: p.id }); }}>{p.name}</button>{p.tag && <span class="muted"> [{p.tag}]</span>}</td>
                  <td class="right num">{fmt(p.villages)}</td>
                  <td class="right num">{fmt(p.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="How the other rulers play">
        <p class="muted small">The realm's computer rulers play by the same rules as you and keep a person's hours: they sleep, they are online in sessions, and they never act faster than someone at the keyboard could. What they do is fixed, so you can plan against it:</p>
        <ul class="realm-rules small">
          <li><b>Conquest.</b> A ruler with a nobleman goes after one village at a time, within 10 to 22 fields. It scouts first, then sends a clearing attack with its noblemen right behind, and comes back as they return until the village falls. Each nobleman takes 20 to 35 loyalty; loyalty grows back on its own.</li>
          <li><b>Who is safe.</b> Beginner protection, and after it anyone's only village for their first day in the realm. Tribe mates, allies and pacts. Barbarian villages within 5 fields of a person are left for that person. Only one ruler at a time goes after any one person.</li>
          <li><b>When they give up.</b> If scouts or reports show more defence than their army can beat, if two attacks are beaten back, if they lose their noblemen, or after a day. Stack defenders, support each other, and they look elsewhere.</li>
          <li><b>Their pace.</b> This is a fast realm: a keen ruler whose battles go well takes several villages a day, a careful one about one, and each has good days and bad. Winning streaks speed them up, setbacks slow them down, and most eventually have enough. A person who is attacked gets a breather of about three hours before the next ruler may strike, unless they struck first.</li>
          <li><b>Answering attacks.</b> Strike a ruler and it, or its tribe mates, may answer: scouting you, reinforcing the village with troops suited to what hit it, or striking back. Each weighs it by temperament, distance and what it has; most of the time most of them stay out of it.</li>
          <li><b>Their ways.</b> Every ruler raises a hero at its statue. Some send fake attacks alongside real ones, some come to their tribe mates' aid, all want back what was taken from them, and they train troops to counter whatever keeps hitting them.</li>
        </ul>
      </Section>

      <Section title="Hall of fame">
        {r.pastRounds.length === 0 ? <Empty>This is the realm's first round. The winners will be remembered here.</Empty> : (
          <ul class="realm-fame">
            {r.pastRounds.map((p) => (
              <li>
                <Icon name="star" size={18} />
                <div>
                  <b>{champ(p) ? champ(p)!.name : 'No winner'}</b>
                  {champ(p) && <span class="muted"> · {fmt(champ(p)!.points)} points</span>}
                  <div class="muted small">
                    {p.world} · ended {new Date(p.endedReal).toLocaleDateString()}
                    {p.winner && <> · top tribe [{p.winner.tag}] {p.winner.name} ({pct(p.winner.share)}{p.winner.domination ? ', domination' : ''})</>}
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
