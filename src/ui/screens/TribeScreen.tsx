import { SharedReportCard } from './ReportsScreen';
import { useEffect, useRef, useState } from 'preact/hooks';
import { FORUM_MAX_TEXT, RIGHT_LABEL, TRIBE_MAX_MEMBERS, TRIBE_RIGHTS, TRIBE_TEXT_MAX } from '../../engine/tribes';
import type { Diplomacy, TribeRight } from '../../engine/types';
import type { MyTribeView, TribeProfileView } from '../../engine/view';
import { Icon } from '../art/icons';
import { BBEditor, appendQuote } from '../bbcode/Editor';
import { excerpt } from '../bbcode/parse';
import { BBCode } from '../bbcode/render';
import { Btn, CopyButton, Countdown, Empty, Section, Tabs } from '../components/common';
import { threadLink } from '../deepLink';
import { coords, fmt, fmtAgo } from '../format';
import { act, host, now, view, usePane } from '../store';

type Tab = 'overview' | 'members' | 'invites' | 'diplomacy' | 'forum' | 'settings';
type Home = ReturnType<NonNullable<typeof host.value>['tribeHome']>;

const REL_LABEL: Record<Diplomacy | 'own', string> = { ally: 'Ally', nap: 'Non-aggression pact', enemy: 'Enemy', own: 'Your tribe' };

export function TribeScreen({ id, tab, thread, post }: { id?: number; tab?: string; thread?: number; post?: number }) {
  const h = host.value!;
  view.value; // re-render on updates
  const home = h.tribeHome();
  if (id !== undefined && id !== home.tribe?.id) return <TribeProfile id={id} />;
  if (!home.tribe) return <NoTribe home={home} />;
  return <MyTribe t={home.tribe} tab={(tab as Tab) ?? 'overview'} thread={thread} post={post} />;
}

/** The tag, as Tribal Wars shows it: [TAG], clickable to the tribe's profile. */
export function TribeTag({ id, tag }: { id: number; tag: string }) {
  const pane = usePane();
  return (
    <button type="button" class="link tribe-tag" onClick={() => pane.go({ name: 'tribe', id })} title="Show this tribe">
      [{tag}]
    </button>
  );
}

/** "+3 this week": new members over the last week, when there are any. */
export function Growth({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span class="growth" title="New members in the last week">+{n} this week</span>;
}

export function RecruitingPill() {
  return <span class="pill pill-recruiting" title="This tribe is taking new members: rulers without a tribe can ask to join">Recruiting</span>;
}

/** Ask to join / waiting on an answer, for a tribe that is recruiting. */
export function JoinButton({ t, small = true }: { t: { id: number; tag: string; applied: boolean; canApply: boolean; invited?: boolean }; small?: boolean }) {
  if (t.invited) return <Btn small={small} onClick={() => act({ type: 'tribeAccept', tribe: t.id }, `You joined [${t.tag}].`)}>Accept invitation</Btn>;
  if (t.applied) {
    return (
      <span class="row gap-sm nowrap">
        <span class="muted small">Request sent</span>
        <Btn small variant="quiet" onClick={() => act({ type: 'tribeWithdraw', tribe: t.id }, 'Request withdrawn.')}>Withdraw</Btn>
      </span>
    );
  }
  if (!t.canApply) return null;
  return <Btn small={small} onClick={() => act({ type: 'tribeApply', tribe: t.id }, `You asked to join [${t.tag}]. Their recruiters will answer soon.`)}>Ask to join</Btn>;
}

function NoTribe({ home }: { home: Home }) {
  const pane = usePane();
  const { invitations, recruiting } = home;
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const asked = new Set(home.requests.map((r) => r.id));
  return (
    <div class="stack">
      <div class="page-head"><h1>Tribe</h1></div>
      <Section title="Tribes recruiting">
        {recruiting.length === 0 ? <Empty>No tribe is taking new members right now. Found your own, or wait for an invitation.</Empty> : (
          <ul class="tribe-invites">
            {recruiting.map((r) => (
              <li>
                <div class="grow">
                  <TribeTag id={r.id} tag={r.tag} /> <b>{r.name}</b> <Growth n={r.joinedThisWeek} />
                  <div class="muted small">{r.members}/{TRIBE_MAX_MEMBERS} members · <span class="num">{fmt(r.points)}</span> points</div>
                </div>
                <JoinButton t={{ id: r.id, tag: r.tag, applied: asked.has(r.id), canApply: true, invited: invitations.some((i) => i.id === r.id) }} />
              </li>
            ))}
          </ul>
        )}
        <p class="muted small">You can wait on one request at a time; asking another tribe withdraws the first. Their recruiters decide.</p>
      </Section>
      <div class="grid-2">
        <Section title="Invitations">
          {invitations.length === 0 ? <Empty>No tribe has invited you yet. Tribes invite rulers they want at their side.</Empty> : (
            <ul class="tribe-invites">
              {invitations.map((i) => (
                <li>
                  <div class="grow">
                    <TribeTag id={i.id} tag={i.tag} /> <b>{i.name}</b>
                    <div class="muted small">{i.members} members · <span class="num">{fmt(i.points)}</span> points · invited by {i.by} {fmtAgo(i.t, now.value)}</div>
                  </div>
                  <Btn small onClick={() => act({ type: 'tribeAccept', tribe: i.id }, `You joined [${i.tag}].`)}>Accept</Btn>
                  <Btn small variant="ghost" onClick={() => act({ type: 'tribeDecline', tribe: i.id })}>Decline</Btn>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Found a tribe">
          <p class="muted">Gather rulers under one banner. Members can't attack each other, can see each other on the map in blue, share a forum and plan together.</p>
          <form class="stack-sm" onSubmit={(e) => { e.preventDefault(); act({ type: 'tribeCreate', name, tag }, `The tribe ${name} is founded.`); }}>
            <label class="field"><span>Name</span><input type="text" maxLength={32} value={name} onInput={(e) => setName(e.currentTarget.value)} placeholder="The Iron Oath" /></label>
            <label class="field"><span>Tag (up to 6 letters)</span><input type="text" maxLength={6} value={tag} onInput={(e) => setTag(e.currentTarget.value.replace(/\s/g, ''))} placeholder="IRN" /></label>
            <div><Btn type="submit" disabled={name.trim().length < 3 || !tag}>Found tribe</Btn></div>
          </form>
        </Section>
      </div>
      <Section title="Tribes of the realm" actions={<Btn small variant="ghost" onClick={() => pane.go({ name: 'ranking' })}>Rankings</Btn>}>
        <TribeList />
      </Section>
    </div>
  );
}

function TribeList() {
  const pane = usePane();
  const tribes = host.value!.tribes().sort((a, b) => b.points - a.points);
  if (tribes.length === 0) return <Empty>No tribes yet.</Empty>;
  return (
    <table class="table">
      <thead><tr><th>#</th><th>Tribe</th><th class="right">Members</th><th class="right">Points</th></tr></thead>
      <tbody>
        {tribes.map((t, i) => (
          <tr class="clickable" onClick={() => pane.go({ name: 'tribe', id: t.id })}>
            <td class="num">{i + 1}</td>
            <td><span class="tribe-dot" style={{ background: t.color }} /> <b>[{t.tag}]</b> {t.name}{t.recruiting && !t.full && <RecruitingPill />}</td>
            <td class="right num">{t.members.length} <Growth n={t.joinedThisWeek} /></td>
            <td class="right num">{fmt(t.points)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RightsBadges({ rights, founder }: { rights: TribeRight[]; founder: boolean }) {
  if (founder) return <span class="pill pill-gold">Founder</span>;
  if (rights.includes('lead')) return <span class="pill pill-gold">Leader</span>;
  return <>{rights.map((r) => <span class="pill">{RIGHT_LABEL[r]}</span>)}</>;
}

function MembersTable({ t, manage }: { t: TribeProfileView; manage?: MyTribeView }) {
  const pane = usePane();
  const me = view.value!.me.id;
  const canKick = manage && (manage.myRights.includes('invite') || manage.myRights.includes('lead'));
  const canRights = manage && manage.myRights.includes('lead');
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <table class="table tribe-members">
      <thead><tr><th>#</th><th>Ruler</th><th class="right">Rank</th><th class="right">Points</th><th class="right">Villages</th><th>Rights</th>{manage && <th />}</tr></thead>
      <tbody>
        {t.members.map((m, i) => (
          <>
            <tr>
              <td class="num">{i + 1}</td>
              <td><button type="button" class="link" onClick={() => pane.go({ name: 'ranking', player: m.id })}>{m.name}</button>{m.kind === 'ai' && <span class="muted small"> (ruler)</span>}</td>
              <td class="right num">{m.rank}</td>
              <td class="right num">{fmt(m.points)}</td>
              <td class="right num">{m.villages}</td>
              <td><RightsBadges rights={m.rights} founder={m.founder} /></td>
              {manage && (
                <td class="right nowrap">
                  {canRights && !m.founder && m.id !== me && <Btn small variant="ghost" onClick={() => setEditing(editing === m.id ? null : m.id)}>Rights</Btn>}
                  {canKick && !m.founder && m.id !== me && <Btn small variant="quiet" onClick={() => { if (confirm(`Remove ${m.name} from the tribe?`)) act({ type: 'tribeKick', pid: m.id }, `${m.name} was removed.`); }}>Remove</Btn>}
                </td>
              )}
            </tr>
            {editing === m.id && manage && (
              <tr class="rights-row">
                <td colSpan={7}>
                  <div class="rights-edit">
                    {TRIBE_RIGHTS.filter((r) => r !== 'lead' || manage.isFounder).map((r) => (
                      <label class="check">
                        <input
                          type="checkbox"
                          checked={m.rights.includes(r)}
                          onChange={(e) => {
                            const next = e.currentTarget.checked ? [...m.rights, r] : m.rights.filter((x) => x !== r);
                            act({ type: 'tribeRights', pid: m.id, rights: next });
                          }}
                        />
                        {RIGHT_LABEL[r]}
                      </label>
                    ))}
                  </div>
                </td>
              </tr>
            )}
          </>
        ))}
      </tbody>
    </table>
  );
}

function ProfileHead({ t }: { t: TribeProfileView }) {
  return (
    <div class="tribe-head">
      <span class="tribe-crest" style={{ background: t.color }}><Icon name="shield" size={30} /></span>
      <div class="grow">
        <h1>[{t.tag}] {t.name}</h1>
        <div class="muted small">
          Rank <b class="num">{t.rank}</b> · <b class="num">{fmt(t.points)}</b> points · {t.members.length}/{TRIBE_MAX_MEMBERS} members <Growth n={t.joinedThisWeek} /> · <b class="num">{t.villages}</b> villages · founded by {t.founder}
        </div>
      </div>
      {t.recruiting && !t.full && <RecruitingPill />}
      {t.myRelation && t.myRelation !== 'own' && <span class={`pill rel-${t.myRelation}`}>{REL_LABEL[t.myRelation]}</span>}
    </div>
  );
}

function Relations({ t }: { t: TribeProfileView }) {
  if (t.relations.length === 0) return <Empty>No allies, pacts or enemies declared.</Empty>;
  return (
    <ul class="rel-list">
      {t.relations.map((r) => (
        <li><span class={`pill rel-${r.status}`}>{REL_LABEL[r.status]}</span> <TribeTag id={r.id} tag={r.tag} /> {r.name}</li>
      ))}
    </ul>
  );
}

/** Another tribe's public page: who is in it, its profile and its diplomacy. */
function TribeProfile({ id }: { id: number }) {
  const pane = usePane();
  const t = host.value!.tribeProfile(id);
  if (!t) return <Section><Empty>That tribe no longer exists.</Empty></Section>;
  return (
    <div class="stack">
      <div class="crumbs">
        <button type="button" class="link" onClick={() => pane.go({ name: 'tribe' })}>Tribe</button>
        <span aria-hidden="true">›</span>
        <span>[{t.tag}] {t.name}</span>
      </div>
      <Section><ProfileHead t={t} /></Section>
      {(t.recruiting || t.invited || t.applied) && t.myRelation !== 'own' && (
        <Section title="Join this tribe">
          <div class="row gap wrap">
            <p class="grow muted">
              {t.invited ? 'They have invited you.'
                : t.applied ? 'You asked to join. Their recruiters will answer soon.'
                : t.canApply ? 'The tribe is taking new members. Ask to join and their recruiters will answer.'
                : view.value!.me.tribeId != null ? 'The tribe is taking new members, but you are already in a tribe.'
                : t.full ? 'The tribe is full right now.'
                : 'You cannot ask to join right now.'}
            </p>
            <JoinButton t={t} small={false} />
          </div>
        </Section>
      )}
      {t.description && <Section title="About"><BBCode text={t.description} /></Section>}
      <Section title={`Members (${t.members.length})`}><MembersTable t={t} /></Section>
      <Section title="Diplomacy"><Relations t={t} /></Section>
    </div>
  );
}

function MyTribe({ t, tab, thread, post }: { t: MyTribeView; tab: Tab; thread?: number; post?: number }) {
  const pane = usePane();
  const can = (r: TribeRight) => t.myRights.includes(r) || t.myRights.includes('lead');
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview', badge: t.alerts.length || undefined },
    { id: 'members', label: 'Members' },
    ...(can('invite') ? [{ id: 'invites' as Tab, label: 'Recruiting', badge: t.applications.length || undefined }] : []),
    { id: 'diplomacy', label: 'Diplomacy' },
    { id: 'forum', label: 'Forum' },
    { id: 'settings', label: can('lead') ? 'Properties' : 'Leave' },
  ];
  return (
    <div class="stack">
      <Section><ProfileHead t={t} /></Section>
      <Tabs<Tab> tabs={tabs} active={tab} onChange={(x) => pane.go({ name: 'tribe', tab: x })} />
      {tab === 'overview' && <Overview t={t} />}
      {tab === 'members' && <Section title={`Members (${t.members.length}/${TRIBE_MAX_MEMBERS})`}><MembersTable t={t} manage={t} /></Section>}
      {tab === 'invites' && <Invites t={t} />}
      {tab === 'diplomacy' && <DiplomacyTab t={t} canEdit={can('diplomacy')} />}
      {tab === 'forum' && <Forum t={t} thread={thread} post={post} />}
      {tab === 'settings' && <Settings t={t} />}
    </div>
  );
}

function Overview({ t }: { t: MyTribeView }) {
  const pane = usePane();
  return (
    <div class="grid-2">
      <div class="stack">
        <Section title="Announcement">
          {t.internal ? <BBCode text={t.internal} /> : <Empty>The leaders haven't posted an announcement.</Empty>}
        </Section>
        <Section title="About the tribe">
          {t.description ? <BBCode text={t.description} /> : <Empty>No public description yet.</Empty>}
        </Section>
      </div>
      <div class="stack">
        {t.myRights.includes('internal') && (
          <Section title="Members under attack">
            {t.alerts.length === 0 ? <Empty>No attacks are heading for the tribe.</Empty> : (
              <ul class="cmd-list">
                {t.alerts.map((a) => (
                  <li class="cmd is-incoming">
                    <Icon name="attack" size={16} />
                    <div class="grow">
                      <b>{t.names[a.memberId]}</b>: {a.vname} <span class="muted">({coords(a.x, a.y)})</span>
                      <div class="muted small">from {a.attacker}</div>
                    </div>
                    <Countdown until={a.arrive} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
        <Section title="Latest in the forum" actions={<Btn small variant="ghost" onClick={() => pane.go({ name: 'tribe', tab: 'forum' })}>Forum</Btn>}>
          {t.forum.length === 0 ? <Empty>The forum is quiet.</Empty> : (
            <ul class="forum-mini">
              {t.forum.slice(0, 5).map((th) => {
                const last = th.posts[th.posts.length - 1];
                const said = last?.text ? excerpt(last.text, 80) : last?.report ? 'shared a report' : '';
                return (
                  <li>
                    <button type="button" class="link" onClick={() => pane.go({ name: 'tribe', tab: 'forum', thread: th.id })}><b>{th.title}</b></button> <span class="muted small">· {t.names[last?.by ?? th.by]} {fmtAgo(last?.t ?? th.t, now.value)}</span>
                    {said && <div class="forum-excerpt muted small">{said}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function Invites({ t }: { t: MyTribeView }) {
  const pane = usePane();
  const [name, setName] = useState('');
  const everyone = Object.values(host.value!.map().players).filter((p) => p.tribeId !== t.id).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div class="stack">
    <Section title="Recruiting">
      <label class="check">
        <input type="checkbox" checked={t.recruiting} onChange={(e) => act({ type: 'tribeRecruiting', on: e.currentTarget.checked }, e.currentTarget.checked ? 'The tribe is recruiting: it shows so on the rankings.' : 'The tribe is no longer recruiting.')} />
        Recruiting: show the tribe as recruiting on the rankings, and let rulers without a tribe ask to join
      </label>
      {t.applications.length === 0 ? <Empty>{t.recruiting ? 'No requests to join right now.' : 'Turn recruiting on to receive requests to join.'}</Empty> : (
        <ul class="tribe-invites">
          {t.applications.map((a) => (
            <li>
              <div class="grow">
                <button type="button" class="link" onClick={() => pane.go({ name: 'ranking', player: a.pid })}><b>{a.name}</b></button>{a.kind === 'ai' && <span class="muted small"> (ruler)</span>}
                <div class="muted small"><span class="num">{fmt(a.points)}</span> points · {a.villages} village{a.villages === 1 ? '' : 's'} · asked {fmtAgo(a.t, now.value)}</div>
              </div>
              <Btn small onClick={() => act({ type: 'tribeAnswer', pid: a.pid, accept: true }, `${a.name} joined the tribe.`)}>Accept</Btn>
              <Btn small variant="ghost" onClick={() => act({ type: 'tribeAnswer', pid: a.pid, accept: false })}>Decline</Btn>
            </li>
          ))}
        </ul>
      )}
    </Section>
    <div class="grid-2">
      <Section title="Invite a ruler">
        <form class="row gap" onSubmit={(e) => { e.preventDefault(); if (act({ type: 'tribeInvite', name }, `${name} has been invited.`)) setName(''); }}>
          <input type="text" list="invite-names" value={name} onInput={(e) => setName(e.currentTarget.value)} placeholder="Ruler name" aria-label="Ruler name" />
          <datalist id="invite-names">{everyone.map((p) => <option value={p.name} />)}</datalist>
          <Btn type="submit" disabled={!name.trim()}>Invite</Btn>
        </form>
        <p class="muted small">They'll see the invitation on their Tribe page and can accept or decline.</p>
      </Section>
      <Section title="Open invitations">
        {t.invites.length === 0 ? <Empty>No open invitations.</Empty> : (
          <ul class="tribe-invites">
            {t.invites.map((i) => (
              <li>
                <div class="grow"><b>{i.name}</b><div class="muted small">invited by {i.by} {fmtAgo(i.t, now.value)}</div></div>
                <Btn small variant="quiet" onClick={() => act({ type: 'tribeCancelInvite', pid: i.pid })}>Withdraw</Btn>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
    </div>
  );
}

function DiplomacyTab({ t, canEdit }: { t: MyTribeView; canEdit: boolean }) {
  const [tag, setTag] = useState('');
  const [status, setStatus] = useState<Diplomacy>('ally');
  const tribes = host.value!.tribes().filter((x) => x.id !== t.id);
  const pick = () => tribes.find((x) => x.tag.toLowerCase() === tag.trim().toLowerCase().replace(/[[\]]/g, ''));
  return (
    <div class="grid-2">
      <Section title="Our relations">
        <Relations t={t} />
        {canEdit && t.relations.length > 0 && (
          <div class="rel-edit">
            {t.relations.map((r) => (
              <Btn small variant="quiet" onClick={() => act({ type: 'tribeDiplomacy', tribe: r.id, status: null }, `Relation with [${r.tag}] ended.`)}>End [{r.tag}]</Btn>
            ))}
          </div>
        )}
        <p class="muted small">On the map, allies show in turquoise, pacts in purple and enemies in red. Your own tribe shows in blue.</p>
      </Section>
      {canEdit && (
        <Section title="Declare">
          <form class="stack-sm" onSubmit={(e) => { e.preventDefault(); const o = pick(); if (o) act({ type: 'tribeDiplomacy', tribe: o.id, status }, `[${o.tag}] is now marked ${REL_LABEL[status].toLowerCase()}.`); }}>
            <label class="field"><span>Tribe tag</span>
              <input type="text" list="dip-tags" value={tag} onInput={(e) => setTag(e.currentTarget.value)} placeholder="ABC" />
              <datalist id="dip-tags">{tribes.map((x) => <option value={x.tag}>{x.name}</option>)}</datalist>
            </label>
            <div class="seg">
              {(['ally', 'nap', 'enemy'] as Diplomacy[]).map((s) => (
                <button type="button" class={status === s ? 'is-on' : ''} onClick={() => setStatus(s)}>{REL_LABEL[s]}</button>
              ))}
            </div>
            <div><Btn type="submit" disabled={!pick()}>Set relation</Btn></div>
          </form>
        </Section>
      )}
    </div>
  );
}

/** A quoted post without the quotes inside it, so replies don't nest forever. */
function withoutQuotes(text: string): string {
  let s = text;
  for (let i = 0; i < 10; i++) {
    const next = s.replace(/\[quote(?:=[^\]\n]*)?\](?:(?!\[quote[\]=])[\s\S])*?\[\/quote\]\n?/gi, '');
    if (next === s) break;
    s = next;
  }
  return s.trim();
}

function Forum({ t, thread, post }: { t: MyTribeView; thread?: number; post?: number }) {
  const pane = usePane();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [reply, setReply] = useState('');
  const [flash, setFlash] = useState<number | null>(null);
  const replyBox = useRef<HTMLTextAreaElement | null>(null);
  const me = view.value!.me.id;
  const mod = t.myRights.includes('forum') || t.myRights.includes('lead');
  const th = thread !== undefined ? t.forum.find((x) => x.id === thread) : undefined;
  const unread = new Set(view.value!.forumUnread);
  const names = t.members.map((m) => m.name);
  const openThread = (id: number) => { pane.go({ name: 'tribe', tab: 'forum', thread: id }); if (unread.has(id)) act({ type: 'forumRead', thread: id }); };
  const allThreads = () => pane.go({ name: 'tribe', tab: 'forum' });
  // replies that arrive while the thread is open count as read
  useEffect(() => { if (th && unread.has(th.id)) act({ type: 'forumRead', thread: th.id }); });
  // a link to one post: bring it into view and light it up for a moment
  useEffect(() => {
    if (post === undefined || !th) return;
    const el = document.getElementById(`post-${post}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setFlash(post);
    const off = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(off);
  }, [thread, post, !!th]);

  const quote = (author: string, body: string) => {
    setReply((r) => appendQuote(r, author, withoutQuotes(body)));
    requestAnimationFrame(() => {
      const el = replyBox.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  if (thread !== undefined && !th) {
    return (
      <Section title="Thread not found" actions={<Btn small variant="ghost" onClick={allThreads}>‹ All threads</Btn>}>
        <Empty>This thread has been deleted, or it belongs to another tribe's forum.</Empty>
      </Section>
    );
  }

  if (th) {
    const tooLong = reply.length > FORUM_MAX_TEXT;
    return (
      <Section
        title={<>{th.sticky && <span class="pill">Pinned</span>} {th.title}</>}
        actions={<>
          <CopyButton text={threadLink(th.id)} label="Copy a link to this thread (only your tribe can open it)" icon="link">Copy link</CopyButton>
          <Btn small variant="ghost" onClick={allThreads}>‹ All threads</Btn>
        </>}
      >
        <ol class="forum-posts">
          {th.posts.map((p, i) => {
            const author = t.names[p.by] ?? 'Someone';
            return (
              <li id={`post-${p.id}`} class={flash === p.id ? 'is-target' : ''}>
                <div class="post-head">
                  <button type="button" class="link" onClick={() => pane.go({ name: 'ranking', player: p.by })}>{author}</button>
                  <span class="muted small">{fmtAgo(p.t, now.value)}</span>
                  <span class="post-tools">
                    {p.text && <button type="button" class="link small post-quote" onClick={() => quote(author, p.text)} title={`Quote ${author} in your reply`}>Quote</button>}
                    {(mod || p.by === me) && i > 0 && <button type="button" class="link small" onClick={() => { if (confirm('Delete this post?')) act({ type: 'forumDelete', thread: th.id, post: p.id }); }}>Delete</button>}
                    <CopyButton text={threadLink(th.id, p.id)} label={`Copy a link to post #${i + 1}`} icon="link" class="post-num">#{i + 1}</CopyButton>
                  </span>
                </div>
                {p.text && <BBCode text={p.text} class="post-body" />}
                {p.report && <SharedReportCard r={p.report} />}
              </li>
            );
          })}
        </ol>
        <form class="stack-sm forum-reply" onSubmit={(e) => { e.preventDefault(); if (!tooLong && act({ type: 'forumReply', thread: th.id, text: reply })) setReply(''); }}>
          <BBEditor id="forum-reply" label="Your reply" value={reply} onChange={setReply} rows={4} maxLength={FORUM_MAX_TEXT} placeholder="Write a reply" names={names} inputRef={replyBox} />
          <div class="row gap wrap">
            <Btn type="submit" disabled={!reply.trim() || tooLong}>Reply</Btn>
            {mod && <Btn variant="ghost" onClick={() => act({ type: 'forumPin', thread: th.id, sticky: !th.sticky })}>{th.sticky ? 'Unpin' : 'Pin'}</Btn>}
            {(mod || th.by === me) && <Btn variant="quiet" onClick={() => { if (confirm('Delete this whole thread?')) { act({ type: 'forumDelete', thread: th.id }); allThreads(); } }}>Delete thread</Btn>}
          </div>
        </form>
      </Section>
    );
  }
  const tooLong = text.length > FORUM_MAX_TEXT;
  return (
    <div class="grid-2">
      <Section title="Threads">
        {t.forum.length === 0 ? <Empty>No threads yet. Start the first one.</Empty> : (
          <ul class="forum-threads">
            {t.forum.map((x) => {
              const last = x.posts[x.posts.length - 1];
              const said = last?.text ? excerpt(last.text, 110) : last?.report ? 'shared a report' : '';
              return (
                <li>
                  <button type="button" class={`link ${unread.has(x.id) ? 'is-unread' : ''}`} onClick={() => openThread(x.id)}>{unread.has(x.id) && <span class="unread-dot" aria-label="New posts" />}{x.sticky && <span class="pill">Pinned</span>} <b>{x.title}</b></button>
                  <div class="muted small">{x.posts.length} post{x.posts.length === 1 ? '' : 's'} · last by {t.names[last?.by ?? x.by]} {fmtAgo(last?.t ?? x.t, now.value)}</div>
                  {said && <div class="forum-excerpt small">{said}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      <Section title="New thread">
        <form class="stack-sm" onSubmit={(e) => { e.preventDefault(); if (tooLong) return; const r = act({ type: 'forumThread', title, text }); if (r) { setTitle(''); setText(''); } }}>
          <input type="text" maxLength={80} value={title} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="Title" aria-label="Title" />
          <BBEditor id="forum-new" label="Message" value={text} onChange={setText} rows={6} maxLength={FORUM_MAX_TEXT} placeholder="What's on your mind? Try [b]bold[/b], [spoiler]…[/spoiler] or coordinates like 500|500." names={names} />
          <div><Btn type="submit" disabled={!title.trim() || !text.trim() || tooLong}>Post</Btn></div>
        </form>
      </Section>
    </div>
  );
}

function Settings({ t }: { t: MyTribeView }) {
  const lead = t.myRights.includes('lead');
  const [desc, setDesc] = useState(t.description);
  const [internal, setInternal] = useState(t.internal);
  const [name, setName] = useState(t.name);
  const [tag, setTag] = useState(t.tag);
  return (
    <div class="grid-2">
      {lead && (
        <Section title="Properties">
          <form class="stack-sm" onSubmit={(e) => { e.preventDefault(); act({ type: 'tribeEdit', name, tag, description: desc, internal }, 'Tribe updated.'); }}>
            <div class="row gap">
              <label class="field grow"><span>Name</span><input type="text" maxLength={32} value={name} onInput={(e) => setName(e.currentTarget.value)} /></label>
              <label class="field"><span>Tag</span><input type="text" maxLength={6} value={tag} onInput={(e) => setTag(e.currentTarget.value.replace(/\s/g, ''))} /></label>
            </div>
            <div class="field"><label for="tribe-desc">Public description (anyone can read it)</label><BBEditor id="tribe-desc" label="Public description" rows={5} maxLength={TRIBE_TEXT_MAX} value={desc} onChange={setDesc} names={t.members.map((m) => m.name)} /></div>
            <div class="field"><label for="tribe-internal">Announcement (members only)</label><BBEditor id="tribe-internal" label="Announcement" rows={5} maxLength={TRIBE_TEXT_MAX} value={internal} onChange={setInternal} names={t.members.map((m) => m.name)} /></div>
            <div><Btn type="submit">Save</Btn></div>
          </form>
        </Section>
      )}
      <Section title="Leave">
        <p class="muted">{t.isFounder ? 'If you leave, the founder\'s crown passes to a leader (or the longest-serving member).' : 'You can be invited back later.'}</p>
        <div class="row gap wrap">
          <Btn variant="danger" onClick={() => { if (confirm('Leave the tribe?')) act({ type: 'tribeLeave' }, 'You left the tribe.'); }}>Leave tribe</Btn>
          {t.isFounder && <Btn variant="quiet" onClick={() => { if (confirm('Disband the tribe for everyone? This cannot be undone.')) act({ type: 'tribeDisband' }, 'The tribe is disbanded.'); }}>Disband tribe</Btn>}
        </div>
      </Section>
    </div>
  );
}
