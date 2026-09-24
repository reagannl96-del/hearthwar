import { useState } from 'preact/hooks';
import { Icon } from '../art/icons';
import { Btn, Empty, Modal, Section, Tabs } from '../components/common';
import { Sparkline } from '../components/Sparkline';
import { continent, coords, fmt } from '../format';
import { Growth, JoinButton, RecruitingPill } from './TribeScreen';
import { host, view, usePane } from '../store';

type Tab = 'players' | 'tribes' | 'continent' | 'oda' | 'odd';

const PERSONA: Record<string, string> = { farmer: 'Raider', warlord: 'Warlord', turtle: 'Defender', expander: 'Conqueror' };

export function RankingScreen({ player }: { player?: number }) {
  const pane = usePane();
  const h = host.value!;
  view.value;
  const [tab, setTab] = useState<Tab>('players');
  if (player !== undefined) return <Profile pid={player} />;
  const rank = h.ranking();
  const me = view.value!.me.id;
  const tribes = h.tribes().sort((a, b) => b.points - a.points);
  const sorted = tab === 'oda' ? [...rank].sort((a, b) => b.killsAtt - a.killsAtt) : tab === 'odd' ? [...rank].sort((a, b) => b.killsDef - a.killsDef) : rank;
  return (
    <div class="stack">
      <div class="page-head"><h1>Rankings</h1></div>
      <Tabs<Tab> active={tab} onChange={setTab} tabs={[{ id: 'players', label: 'Rulers' }, { id: 'tribes', label: 'Tribes' }, { id: 'continent', label: 'Continents' }, { id: 'oda', label: 'Attackers' }, { id: 'odd', label: 'Defenders' }]} />
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
 * The realm is split into continents of 10 by 10 fields (K55 is x 50-59, y 50-59).
 * Each has its own leaderboard: the rulers and tribes with the most points there,
 * counting only their villages inside it.
 */
function ContinentRanking() {
  const pane = usePane();
  const h = host.value!;
  const map = h.map();
  const me = view.value!.me.id;
  const home = pane.village.value!;
  const [k, setK] = useState(continent(home.x, home.y));
  // every continent anyone rules land in, with how many villages each ruler and tribe holds there
  const byK = new Map<string, Map<number, { points: number; villages: number }>>();
  const span = new Map<string, [number, number]>([[continent(home.x, home.y), [Math.floor(home.x / 10) * 10, Math.floor(home.y / 10) * 10]]]);
  for (const v of map.villages) {
    if (v.ownerId === null) continue;
    const key = continent(v.x, v.y);
    span.set(key, [Math.floor(v.x / 10) * 10, Math.floor(v.y / 10) * 10]);
    const m = byK.get(key) ?? byK.set(key, new Map()).get(key)!;
    const e = m.get(v.ownerId) ?? { points: 0, villages: 0 };
    e.points += v.points;
    e.villages++;
    m.set(v.ownerId, e);
  }
  const keys = [...new Set([...byK.keys(), k])].sort((a, b) => (span.get(a)?.[1] ?? 0) - (span.get(b)?.[1] ?? 0) || (span.get(a)?.[0] ?? 0) - (span.get(b)?.[0] ?? 0));
  const here = byK.get(k) ?? new Map<number, { points: number; villages: number }>();
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
  return (
    <>
      <Section>
        <div class="row gap wrap">
          <label for="continent-pick"><b>Continent</b></label>
          <select id="continent-pick" value={k} onChange={(e) => setK((e.currentTarget as HTMLSelectElement).value)}>
            {keys.map((c) => <option value={c}>{c}{c === continent(home.x, home.y) ? ' (yours)' : ''}</option>)}
          </select>
          <span class="muted small">
            {span.has(k) && <>{k}: fields {span.get(k)![0]}–{span.get(k)![0] + 9} across, {span.get(k)![1]}–{span.get(k)![1] + 9} down</>}
            {myRank >= 0 && <> · you are <b>#{myRank + 1}</b> here</>}
          </span>
        </div>
      </Section>
      <Section title={`Rulers of ${k}`}>
        {rulers.length === 0 ? <Empty>Nobody rules a village in {k} yet.</Empty> : (
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
      <Section title={`Tribes of ${k}`}>
        {tribes.length === 0 ? <Empty>No tribe holds land in {k}.</Empty> : (
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

function Profile({ pid }: { pid: number }) {
  const pane = usePane();
  const h = host.value!;
  const p = h.profile(pid);
  const me = view.value!.me.id;
  if (!p) return <Section><Empty>That ruler is gone.</Empty></Section>;
  return (
    <div class="stack">
      <div class="crumbs">
        <button type="button" class="link" onClick={() => pane.go({ name: 'ranking' })}>Rankings</button>
        <span aria-hidden="true">›</span>
        <span>{p.name}</span>
      </div>
      <div class="page-head">
        <h1><i class="sw lg" style={{ background: p.id === me ? 'var(--me)' : p.color }} /> {p.name}</h1>
        {p.tribe && <button type="button" class="pill link" onClick={() => pane.go({ name: 'tribe', id: p.tribe!.id })}>[{p.tribe.tag}] {p.tribe.name}</button>}
      </div>
      <div class="grid-2">
        <Section title="Standing">
          <dl class="facts">
            <dt>Points</dt><dd class="num">{fmt(p.points)}</dd>
            <dt>Villages</dt><dd class="num">{p.villages.length}</dd>
            <dt>Enemy troops defeated attacking</dt><dd class="num">{fmt(p.stats.killsAtt)}</dd>
            <dt>Enemy troops defeated defending</dt><dd class="num">{fmt(p.stats.killsDef)}</dd>
            <dt>Enemy troops defeated supporting</dt><dd class="num">{fmt(p.stats.killsSup ?? 0)}</dd>
            <dt>Villages conquered</dt><dd class="num">{p.stats.conquered}</dd>
            {p.personality && <><dt>Temperament</dt><dd>{PERSONA[p.personality]}</dd></>}
          </dl>
        </Section>
        <Section title="Growth">
          {p.history.length > 1 ? <Sparkline points={p.history} /> : <p class="muted">Not enough history yet.</p>}
        </Section>
      </div>
      <Awards p={p} />
      <Section title="Villages">
        <div class="table-scroll">
          <table class="rank-table">
            <thead><tr><th>Village</th><th>Coordinates</th><th class="right">Points</th><th /></tr></thead>
            <tbody>
              {p.villages.sort((a, b) => b.points - a.points).map((v) => (
                <tr>
                  <td>{v.name}</td>
                  <td class="num">{coords(v.x, v.y)}</td>
                  <td class="right num">{fmt(v.points)}</td>
                  <td class="right"><Btn small variant="ghost" onClick={() => pane.go({ name: 'map', focus: v.id })}><Icon name="map" size={14} /> Map</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

const MEDAL = ['None yet', 'Bronze', 'Silver', 'Gold', 'Diamond'];
const MEDAL_CLASS = ['m0', 'm1', 'm2', 'm3', 'm4'];

type ProfileData = NonNullable<ReturnType<NonNullable<typeof host.value>['profile']>>;

function Medal({ tier, size = 34 }: { tier: number; size?: number }) {
  return (
    <span class={`medal ${MEDAL_CLASS[tier]}`} style={{ width: `${size}px`, height: `${size}px` }} aria-label={MEDAL[tier]}>
      <Icon name="star" size={Math.round(size * 0.55)} />
    </span>
  );
}

/** Opponents defeated, achievements and daily awards, the way a Tribal Wars profile shows them. */
function Awards({ p }: { p: ProfileData }) {
  const [open, setOpen] = useState<ProfileData['awards'][number] | null>(null);
  const fights = ['oda', 'odd', 'ods'].map((id) => p.achievements.find((a) => a.id === id)!).filter(Boolean);
  const others = p.achievements.filter((a) => !['oda', 'odd', 'ods'].includes(a.id));
  const today = p.today;
  const when = (day: number) => (day === today - 1 ? 'yesterday' : `on ${new Date(day * 86_400_000).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
  const label: Record<string, string> = { oda: 'As attacker', odd: 'As defender', ods: 'As supporter' };
  return (
    <>
      <Section title="Opponents defeated">
        <div class="fight-grid">
          {fights.map((a) => (
            <div class="fight-card">
              <Medal tier={a.tier} size={42} />
              <div>
                <div class="muted small">{label[a.id]}</div>
                <div class="big num">{fmt(a.value)}</div>
                <div class="small">{MEDAL[a.tier]}{a.next !== null && <span class="muted"> · next at {fmt(a.next)}</span>}</div>
                {a.next !== null && <div class="bar"><span style={{ width: `${Math.min(100, (a.value / a.next) * 100)}%` }} /></div>}
              </div>
            </div>
          ))}
        </div>
      </Section>
      <div class="grid-2">
        <Section title="Daily awards">
          {p.awards.length === 0 ? <Empty>No daily awards yet. Top the day's attackers, defenders, supporters, plunderers or conquerors to win one.</Empty> : (
            <div class="daily-grid">
              {p.awards.map((a) => (
                <button type="button" class="daily-card" onClick={() => setOpen(a)}>
                  <span class={`daily-badge daily-${a.kind}`}><Icon name={a.kind === 'defender' ? 'shield' : a.kind === 'supporter' ? 'support' : a.kind === 'looter' ? 'wood' : a.kind === 'conqueror' ? 'noble' : 'attack'} size={22} /></span>
                  <span class="grow"><b>{a.title}</b><span class="muted small">won {a.count} time{a.count === 1 ? '' : 's'}</span></span>
                  <span class="daily-count">×{a.count}</span>
                </button>
              ))}
            </div>
          )}
        </Section>
        <Section title="Achievements">
          <ul class="ach-list">
            {others.map((a) => (
              <li>
                <Medal tier={a.tier} size={28} />
                <div class="grow">
                  <b>{a.title}</b> <span class="muted small">· {a.text}</span>
                  <div class="small num">{fmt(a.value)}{a.next !== null ? <span class="muted"> / {fmt(a.next)} for {MEDAL[a.tier + 1]}</span> : <span class="muted"> · top level</span>}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
      {open && (
        <Modal title={open.title} onClose={() => setOpen(null)}>
          <p class="muted">{open.text}</p>
          <table class="table award-table">
            <thead><tr><th>Achieved</th><th class="right">{p.name.split(' ')[0]}'s score</th><th class="right">Runner-up</th></tr></thead>
            <tbody>
              {open.history.map((h) => (
                <tr><td>{when(h.day)}</td><td class="right num">{fmt(h.score)}</td><td class="right num">{h.runnerUp === null ? 'unknown' : fmt(h.runnerUp)}</td></tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}
