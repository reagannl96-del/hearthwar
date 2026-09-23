import { SharedReportCard } from './ReportsScreen';
import { useEffect, useState } from 'preact/hooks';
import { RIGHT_LABEL, TRIBE_MAX_MEMBERS, TRIBE_RIGHTS } from '../../engine/tribes';
import type { Diplomacy, TribeRight } from '../../engine/types';
import type { MyTribeView, TribeProfileView } from '../../engine/view';
import { Icon } from '../art/icons';
import { Btn, Countdown, Empty, Section, Tabs } from '../components/common';
import { coords, fmt, fmtAgo } from '../format';
import { act, go, host, now, view } from '../store';

type Tab = 'overview' | 'members' | 'invites' | 'diplomacy' | 'forum' | 'settings';

const REL_LABEL: Record<Diplomacy | 'own', string> = { ally: 'Ally', nap: 'Non-aggression pact', enemy: 'Enemy', own: 'Your tribe' };

export function TribeScreen({ id, tab }: { id?: number; tab?: string }) {
  const h = host.value!;
  view.value; // re-render on updates
  const home = h.tribeHome();
  if (id !== undefined && id !== home.tribe?.id) return <TribeProfile id={id} />;
  if (!home.tribe) return <NoTribe invitations={home.invitations} />;
  return <MyTribe t={home.tribe} tab={(tab as Tab) ?? 'overview'} />;
}

/** The tag, as Tribal Wars shows it: [TAG], clickable to the tribe's profile. */
export function TribeTag({ id, tag }: { id: number; tag: string }) {
  return (
    <button type="button" class="link tribe-tag" onClick={() => go({ name: 'tribe', id })} title="Show this tribe">
      [{tag}]
    </button>
  );
}

function NoTribe({ invitations }: { invitations: ReturnType<NonNullable<typeof host.value>['tribeHome']>['invitations'] }) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  return (
    <div class="stack">
      <div class="page-head"><h1>Tribe</h1></div>
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
      <Section title="Tribes of the realm" actions={<Btn small variant="ghost" onClick={() => go({ name: 'ranking' })}>Rankings</Btn>}>
        <TribeList />
      </Section>
    </div>
  );
}

function TribeList() {
  const tribes = host.value!.tribes().sort((a, b) => b.points - a.points);
  if (tribes.length === 0) return <Empty>No tribes yet.</Empty>;
  return (
    <table class="table">
      <thead><tr><th>#</th><th>Tribe</th><th class="right">Members</th><th class="right">Points</th></tr></thead>
      <tbody>
        {tribes.map((t, i) => (
          <tr class="clickable" onClick={() => go({ name: 'tribe', id: t.id })}>
            <td class="num">{i + 1}</td>
            <td><span class="tribe-dot" style={{ background: t.color }} /> <b>[{t.tag}]</b> {t.name}</td>
            <td class="right num">{t.members.length}</td>
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
              <td><button type="button" class="link" onClick={() => go({ name: 'ranking', player: m.id })}>{m.name}</button>{m.kind === 'ai' && <span class="muted small"> (ruler)</span>}</td>
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
          Rank <b class="num">{t.rank}</b> · <b class="num">{fmt(t.points)}</b> points · {t.members.length}/{TRIBE_MAX_MEMBERS} members · <b class="num">{t.villages}</b> villages · founded by {t.founder}
        </div>
      </div>
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
  const t = host.value!.tribeProfile(id);
  if (!t) return <Section><Empty>That tribe no longer exists.</Empty></Section>;
  return (
    <div class="stack">
      <div class="crumbs">
        <button type="button" class="link" onClick={() => go({ name: 'tribe' })}>Tribe</button>
        <span aria-hidden="true">›</span>
        <span>[{t.tag}] {t.name}</span>
      </div>
      <Section><ProfileHead t={t} /></Section>
      {t.description && <Section title="About"><p class="prewrap">{t.description}</p></Section>}
      <Section title={`Members (${t.members.length})`}><MembersTable t={t} /></Section>
      <Section title="Diplomacy"><Relations t={t} /></Section>
    </div>
  );
}

function MyTribe({ t, tab }: { t: MyTribeView; tab: Tab }) {
  const can = (r: TribeRight) => t.myRights.includes(r) || t.myRights.includes('lead');
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview', badge: t.alerts.length || undefined },
    { id: 'members', label: 'Members' },
    ...(can('invite') ? [{ id: 'invites' as Tab, label: 'Invitations', badge: t.invites.length || undefined }] : []),
    { id: 'diplomacy', label: 'Diplomacy' },
    { id: 'forum', label: 'Forum' },
    { id: 'settings', label: can('lead') ? 'Properties' : 'Leave' },
  ];
  return (
    <div class="stack">
      <Section><ProfileHead t={t} /></Section>
      <Tabs<Tab> tabs={tabs} active={tab} onChange={(x) => go({ name: 'tribe', tab: x })} />
      {tab === 'overview' && <Overview t={t} />}
      {tab === 'members' && <Section title={`Members (${t.members.length}/${TRIBE_MAX_MEMBERS})`}><MembersTable t={t} manage={t} /></Section>}
      {tab === 'invites' && <Invites t={t} />}
      {tab === 'diplomacy' && <DiplomacyTab t={t} canEdit={can('diplomacy')} />}
      {tab === 'forum' && <Forum t={t} />}
      {tab === 'settings' && <Settings t={t} />}
    </div>
  );
}

function Overview({ t }: { t: MyTribeView }) {
  return (
    <div class="grid-2">
      <div class="stack">
        <Section title="Announcement">
          {t.internal ? <p class="prewrap">{t.internal}</p> : <Empty>The leaders haven't posted an announcement.</Empty>}
        </Section>
        <Section title="About the tribe">
          {t.description ? <p class="prewrap">{t.description}</p> : <Empty>No public description yet.</Empty>}
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
        <Section title="Latest in the forum" actions={<Btn small variant="ghost" onClick={() => go({ name: 'tribe', tab: 'forum' })}>Forum</Btn>}>
          {t.forum.length === 0 ? <Empty>The forum is quiet.</Empty> : (
            <ul class="forum-mini">
              {t.forum.slice(0, 5).map((th) => {
                const last = th.posts[th.posts.length - 1];
                return <li><b>{th.title}</b> <span class="muted small">· {t.names[last?.by ?? th.by]} {fmtAgo(last?.t ?? th.t, now.value)}</span></li>;
              })}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function Invites({ t }: { t: MyTribeView }) {
  const [name, setName] = useState('');
  const everyone = Object.values(host.value!.map().players).filter((p) => p.tribeId !== t.id).sort((a, b) => a.name.localeCompare(b.name));
  return (
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

function Forum({ t }: { t: MyTribeView }) {
  const [open, setOpen] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [reply, setReply] = useState('');
  const me = view.value!.me.id;
  const mod = t.myRights.includes('forum') || t.myRights.includes('lead');
  const th = open !== null ? t.forum.find((x) => x.id === open) : undefined;
  const unread = new Set(view.value!.forumUnread);
  const openThread = (id: number) => { setOpen(id); if (unread.has(id)) act({ type: 'forumRead', thread: id }); };
  // replies that arrive while the thread is open count as read
  useEffect(() => { if (th && unread.has(th.id)) act({ type: 'forumRead', thread: th.id }); });
  if (th) {
    return (
      <Section title={th.title} actions={<Btn small variant="ghost" onClick={() => setOpen(null)}>‹ All threads</Btn>}>
        <ul class="forum-posts">
          {th.posts.map((p, i) => (
            <li>
              <div class="post-head">
                <b>{t.names[p.by] ?? 'Someone'}</b> <span class="muted small">{fmtAgo(p.t, now.value)}</span>
                {(mod || p.by === me) && i > 0 && <button type="button" class="link small" onClick={() => act({ type: 'forumDelete', thread: th.id, post: p.id })}>delete</button>}
              </div>
              {p.text && <p class="prewrap">{p.text}</p>}
              {p.report && <SharedReportCard r={p.report} />}
            </li>
          ))}
        </ul>
        <form class="stack-sm" onSubmit={(e) => { e.preventDefault(); if (act({ type: 'forumReply', thread: th.id, text: reply })) setReply(''); }}>
          <textarea rows={3} value={reply} onInput={(e) => setReply(e.currentTarget.value)} placeholder="Write a reply" />
          <div class="row gap">
            <Btn type="submit" disabled={!reply.trim()}>Reply</Btn>
            {mod && <Btn variant="ghost" onClick={() => act({ type: 'forumPin', thread: th.id, sticky: !th.sticky })}>{th.sticky ? 'Unpin' : 'Pin'}</Btn>}
            {(mod || th.by === me) && <Btn variant="quiet" onClick={() => { if (confirm('Delete this whole thread?')) { act({ type: 'forumDelete', thread: th.id }); setOpen(null); } }}>Delete thread</Btn>}
          </div>
        </form>
      </Section>
    );
  }
  return (
    <div class="grid-2">
      <Section title="Threads">
        {t.forum.length === 0 ? <Empty>No threads yet. Start the first one.</Empty> : (
          <ul class="forum-threads">
            {t.forum.map((x) => {
              const last = x.posts[x.posts.length - 1];
              return (
                <li>
                  <button type="button" class={`link ${unread.has(x.id) ? 'is-unread' : ''}`} onClick={() => openThread(x.id)}>{unread.has(x.id) && <span class="unread-dot" aria-label="New posts" />}{x.sticky && <span class="pill">Pinned</span>} <b>{x.title}</b></button>
                  <div class="muted small">{x.posts.length} post{x.posts.length === 1 ? '' : 's'} · last by {t.names[last?.by ?? x.by]} {fmtAgo(last?.t ?? x.t, now.value)}</div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      <Section title="New thread">
        <form class="stack-sm" onSubmit={(e) => { e.preventDefault(); if (act({ type: 'forumThread', title, text })) { setTitle(''); setText(''); } }}>
          <input type="text" maxLength={80} value={title} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="Title" aria-label="Title" />
          <textarea rows={5} value={text} onInput={(e) => setText(e.currentTarget.value)} placeholder="What's on your mind?" aria-label="Message" />
          <div><Btn type="submit" disabled={!title.trim() || !text.trim()}>Post</Btn></div>
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
            <label class="field"><span>Public description (anyone can read it)</span><textarea rows={4} value={desc} onInput={(e) => setDesc(e.currentTarget.value)} /></label>
            <label class="field"><span>Announcement (members only)</span><textarea rows={4} value={internal} onInput={(e) => setInternal(e.currentTarget.value)} /></label>
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
