import { useState } from 'preact/hooks';
import { Empty, Section, Tabs } from '../components/common';
import { QUADRANT_NAME, fmt, quadrant, type Quadrant } from '../format';
import { Growth, JoinButton, RecruitingPill } from './TribeScreen';
import { host, view, usePane } from '../store';
import { PERSONA, PlayerProfile } from './PlayerProfile';

type Tab = 'players' | 'tribes' | 'continent' | 'oda' | 'odd';

export function RankingScreen({ player }: { player?: number }) {
  const pane = usePane();
  const h = host.value!;
  view.value;
  const [tab, setTab] = useState<Tab>('players');
  if (player !== undefined) return <PlayerProfile key={player} pid={player} />;
  const rank = h.ranking();
  const me = view.value!.me.id;
  const tribes = h.tribes().sort((a, b) => b.points - a.points);
  const sorted = tab === 'oda' ? [...rank].sort((a, b) => b.killsAtt - a.killsAtt) : tab === 'odd' ? [...rank].sort((a, b) => b.killsDef - a.killsDef) : rank;
  return (
    <div class="stack">
      <div class="page-head"><h1>Rankings</h1></div>
      <Tabs<Tab> active={tab} onChange={setTab} tabs={[{ id: 'players', label: 'Rulers' }, { id: 'tribes', label: 'Tribes' }, { id: 'continent', label: 'Quadrants' }, { id: 'oda', label: 'Attackers' }, { id: 'odd', label: 'Defenders' }]} />
      {tab === 'continent' ? <ContinentRanking /> : tab === 'tribes' ? (
        <Section>
          {tribes.length === 0 ? <Empty>No tribes in this realm.</Empty> : (
            <div class="table-scroll">
              <table class="rank-table">
                <thead><tr><th>#</th><th>Tribe</th><th class="right">Members</th><th class="right">Villages</th><th class="right">Points</th><th /></tr></thead>
                <tbody>
                  {tribes.map((t, i) => (
                    <tr class="clickable" onClick={() => pane.go({ name: 'tribe', id: t.id })} title="Show the tribe and its members">
                      <td class="num">{i + 1}</td>
                      <td><i class="sw" style={{ background: t.color }} /> <b>[{t.tag}]</b> {t.name}{t.recruiting && !t.full && <RecruitingPill />}</td>
                      <td class="right nowrap" title={t.memberNames.join(', ')}><span class="num">{t.members.length}</span> <Growth n={t.joinedThisWeek} /></td>
                      <td class="right num">{t.villages}</td>
                      <td class="right num">{fmt(t.points)}</td>
                      <td class="right" onClick={(e) => e.stopPropagation()}><JoinButton t={t} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      ) : (
        <Section>
          <div class="table-scroll">
            <table class="rank-table">
              <thead>
                <tr><th>#</th><th>Ruler</th><th>Tribe</th><th class="right">Villages</th><th class="right">{tab === 'oda' ? 'Defeated (attack)' : tab === 'odd' ? 'Defeated (defense)' : 'Points'}</th></tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => (
                  <tr class={p.id === me ? 'is-me' : ''}>
                    <td class="num">{i + 1}</td>
                    <td>
                      <button type="button" class="link" onClick={() => pane.go({ name: 'ranking', player: p.id })}>
                        <i class="sw" style={{ background: p.id === me ? 'var(--me)' : p.color }} /> {p.name}
                      </button>
                      {p.personality && <span class="muted small"> · {PERSONA[p.personality]}</span>}
                    </td>
                    <td>{p.tribe && p.tribeId != null && <button type="button" class="pill link" onClick={(e) => { e.stopPropagation(); pane.go({ name: 'tribe', id: p.tribeId! }); }}>{p.tribe}</button>}</td>
                    <td class="right num">{p.villages}</td>
                    <td class="right num">{fmt(tab === 'oda' ? p.killsAtt : tab === 'odd' ? p.killsDef : p.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

/**
 * The realm is split into four quadrants about its middle (NW, NE, SW, SE). Each has
 * its own leaderboard: the rulers and tribes with the most points there, counting
 * only their villages inside it.
 */
function ContinentRanking() {
  const pane = usePane();
  const h = host.value!;
  const map = h.map();
  const me = view.value!.me.id;
  const home = pane.village.value!;
  const mine = quadrant(home.x, home.y, map.size);
  const [q, setQ] = useState<Quadrant>(mine);
  const here = new Map<number, { points: number; villages: number }>();
  let barbs = 0;
  for (const v of map.villages) {
    if (quadrant(v.x, v.y, map.size) !== q) continue;
    if (v.ownerId === null) { if (!v.cache) barbs++; continue; }
    const e = here.get(v.ownerId) ?? { points: 0, villages: 0 };
    e.points += v.points;
    e.villages++;
    here.set(v.ownerId, e);
  }
  const rulers = [...here].map(([id, e]) => ({ id, ...e, p: map.players[id] })).filter((r) => r.p).sort((a, b) => b.points - a.points);
  const tribeMap = new Map<number, { points: number; villages: number; members: number }>();
  for (const r of rulers) {
    if (r.p.tribeId == null || !map.tribes[r.p.tribeId]) continue;
    const t = tribeMap.get(r.p.tribeId) ?? { points: 0, villages: 0, members: 0 };
    t.points += r.points; t.villages += r.villages; t.members++;
    tribeMap.set(r.p.tribeId, t);
  }
  const tribes = [...tribeMap].map(([id, t]) => ({ id, ...t, t: map.tribes[id] })).sort((a, b) => b.points - a.points);
  const myRank = rulers.findIndex((r) => r.id === me);
  const name = QUADRANT_NAME[q];
  return (
    <>
      <div class="quad-pick" role="tablist" aria-label="Quadrant">
        {(['NW', 'NE', 'SW', 'SE'] as Quadrant[]).map((k) => (
          <button type="button" role="tab" aria-selected={k === q} class={`quad-btn ${k === q ? 'is-active' : ''}`} onClick={() => setQ(k)}>
            <b>{k}</b>
            <span class="small">{QUADRANT_NAME[k]}{k === mine ? ' · yours' : ''}</span>
          </button>
        ))}
      </div>
      <p class="muted small">
        {rulers.length} rulers and {barbs} barbarian villages in the {name.toLowerCase()} quadrant
        {myRank >= 0 && <> · you are <b>#{myRank + 1}</b> here</>}
      </p>
      <Section title={`Rulers of the ${name}`}>
        {rulers.length === 0 ? <Empty>Nobody rules a village in the {name.toLowerCase()} yet.</Empty> : (
          <div class="table-scroll">
            <table class="rank-table">
              <thead><tr><th>#</th><th>Ruler</th><th>Tribe</th><th class="right">Villages here</th><th class="right">Points here</th></tr></thead>
              <tbody>
                {rulers.map((r, i) => (
                  <tr class={r.id === me ? 'is-me' : ''}>
                    <td class="num">{i + 1}</td>
                    <td><button type="button" class="link" onClick={() => pane.go({ name: 'ranking', player: r.id })}><i class="sw" style={{ background: r.id === me ? 'var(--me)' : r.p.color }} /> {r.p.name}</button></td>
                    <td>{r.p.tribeId != null && map.tribes[r.p.tribeId] && <button type="button" class="pill link" onClick={() => pane.go({ name: 'tribe', id: r.p.tribeId! })}>{map.tribes[r.p.tribeId].tag}</button>}</td>
                    <td class="right num">{r.villages}</td>
                    <td class="right num">{fmt(r.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <Section title={`Tribes of the ${name}`}>
        {tribes.length === 0 ? <Empty>No tribe holds land in the {name.toLowerCase()}.</Empty> : (
          <div class="table-scroll">
            <table class="rank-table">
              <thead><tr><th>#</th><th>Tribe</th><th class="right">Members here</th><th class="right">Villages here</th><th class="right">Points here</th></tr></thead>
              <tbody>
                {tribes.map((t, i) => (
                  <tr class="clickable" onClick={() => pane.go({ name: 'tribe', id: t.id })}>
                    <td class="num">{i + 1}</td>
                    <td><i class="sw" style={{ background: t.t.color }} /> <b>[{t.t.tag}]</b> {t.t.name}</td>
                    <td class="right num">{t.members}</td>
                    <td class="right num">{t.villages}</td>
                    <td class="right num">{fmt(t.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
