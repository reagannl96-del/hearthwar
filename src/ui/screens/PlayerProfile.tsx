import { Honours } from '../components/common';
// A ruler's profile: their banner, where they stand, what you can do about them
// (invite, remove, rights, diplomacy, mark them on the map), their villages with
// quick attack and support buttons, and their honours.

import { createContext, type ComponentChildren, type JSX } from 'preact';
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { UNITS } from '../../engine/data/units';
import type { VillageTheme } from '../../engine/data/themes';
import { distance } from '../../engine/formulas';
import { RIGHT_LABEL } from '../../engine/tribes';
import type { Diplomacy, TribeRight } from '../../engine/types';
import type { Can, PlayerProfile as ProfileData, ProfileVillage } from '../../engine/view';
import { Icon } from '../art/icons';
import { Btn, CopyButton, Countdown, Empty, Modal, Section, VillageLink } from '../components/common';
import { Sparkline } from '../components/Sparkline';
import { fmt, fmtShort, quadrant, QUADRANT_NAME } from '../format';
import { MARK_COLORS, marks, setMark, useWorldMarks } from '../mapMarks';
import { act, host, now, rallyTarget, toast, usePane, view } from '../store';
import { HangingBanner } from './BannerScreen';

/** What an AI ruler's temperament is called (the rankings show it too). */
export const PERSONA: Record<string, string> = { farmer: 'Raider', warlord: 'Warlord', turtle: 'Defender', expander: 'Conqueror', opportunist: 'Opportunist', guardian: 'Guardian' };

const REL_CHIP: Record<Diplomacy | 'own', string> = { own: 'Tribe mate', ally: 'Ally', nap: 'Non-aggression pact', enemy: 'Enemy' };
const STANCE: Record<Diplomacy, string> = { ally: 'Ally', nap: 'Non-aggression pact', enemy: 'Enemy' };
const DAY = 86_400_000;
/** villages shown before "show all" */
const VILLAGE_CAP = 10;

/**
 * Dialogs open from deep inside the page but are drawn beside it: the page is a size
 * container (for its responsive grid), and some browsers pin fixed-position children
 * of a container inside it.
 */
const DialogCtx = createContext<(d: ComponentChildren | null) => void>(() => {});

export function PlayerProfile({ pid }: { pid: number }) {
  const pane = usePane();
  const h = host.value!;
  const pv = view.value!;
  const [dialog, setDialog] = useState<ComponentChildren | null>(null);
  useWorldMarks(pv.worldName);
  const p = h.profile(pid);
  const crumbs = (
    <div class="crumbs">
      <button type="button" class="link" onClick={() => pane.go({ name: 'ranking' })}>Rankings</button>
      <span aria-hidden="true">›</span>
      <span>{p?.name ?? 'Unknown ruler'}</span>
    </div>
  );
  if (!p) return <div class="stack">{crumbs}<Section><Empty>That ruler is gone.</Empty></Section></div>;
  return (
    <DialogCtx.Provider value={setDialog}>
      <div class="stack profile">
        {crumbs}
        <ProfileHeader p={p} />
        <div class="profile-grid">
          <GrowthPanel p={p} />
          <FightsPanel p={p} />
          <VillagesPanel p={p} />
          <DailyAwards p={p} />
          <AchievementsPanel p={p} />
        </div>
      </div>
      {dialog}
    </DialogCtx.Provider>
  );
}

// ---------- the header ----------

function ProfileHeader({ p }: { p: ProfileData }) {
  const pane = usePane();
  const you = p.you!;
  const t = now.value;
  const days = Math.floor((t - p.joinedAt) / DAY);
  const heroes = heroCounts(p.villages);
  const avg = p.villages.length ? p.points / p.villages.length : 0;
  const lastDay = gainSince(p.history, t - DAY);
  return (
    <section class="panel profile-head" aria-label={`${p.name}'s profile`}>
      <div class="ph-top">
        <HangingBanner
          flag={p.flag}
          label={p.flag ? `${p.name}'s banner` : `${p.name} flies the realm's plain banner`}
          onEdit={you.self ? () => pane.go({ name: 'banner' }) : undefined}
        />
        <div class="ph-id">
          <div class="ph-name-row">
            <h1 class="ph-name">{p.name}</h1>
            {you.self ? <span class="pill rel-self">You</span> : you.relation && <span class={`pill rel-${you.relation}`}>{REL_CHIP[you.relation]}</span>}
          </div>
          <div class="ph-tribe">
            {p.tribe ? (
              <>
                <i class="sw" style={{ background: p.tribe.color }} aria-hidden="true" />
                <button type="button" class="link" onClick={() => pane.go({ name: 'tribe', id: p.tribe!.id })} title="Show the tribe">
                  [{p.tribe.tag}] {p.tribe.name}
                </button>
                <RoleBadges role={p.tribe.role} rights={p.tribe.rights} />
              </>
            ) : <span class="muted">{p.eliminated ? 'No tribe' : 'Not in a tribe'}</span>}
          </div>
        </div>
        <ul class="ph-meta">
          {p.honours?.length ? <li class="ph-honours"><Honours list={p.honours} big /></li> : null}
          {p.eliminated
            ? <li class="bad-text">Fallen: lost every village</li>
            : <li title="Time in this realm">{days >= 1 ? `In the realm ${days} ${days === 1 ? 'day' : 'days'}` : 'New to the realm'}</li>}
          {p.personality && <li>Temperament: <b>{PERSONA[p.personality]}</b></li>}
          {!p.eliminated && p.protectedUntil > t && <li class="ph-protect" title="Nobody can attack them until it ends (attacking a real ruler ends it early)"><Icon name="shield" size={14} /> Beginner protection · <Countdown until={p.protectedUntil} /></li>}
          {heroes.map(([theme, n]) => (
            <li class="ph-hero" title={`${n} ${n === 1 ? 'village is' : 'villages are'} sworn to the ${UNITS[theme as keyof typeof UNITS]?.name ?? theme}`}>
              <Icon name={theme} size={15} /> {UNITS[theme as keyof typeof UNITS]?.name ?? theme}{n > 1 && <span class="muted"> ×{n}</span>}
            </li>
          ))}
        </ul>
        {p.rank !== null && (
          <button type="button" class="ph-rank" onClick={() => pane.go({ name: 'ranking' })} title="Open the rankings">
            <span class="ph-rank-num">#{p.rank}</span>
            <span class="ph-rank-of">of {p.rulers} rulers</span>
          </button>
        )}
      </div>
      <dl class="ph-stats">
        <Stat label="Points" value={fmt(p.points)} sub={lastDay === null ? 'no history yet' : lastDay === 0 ? 'no change in a day' : `${lastDay > 0 ? '+' : '−'}${fmt(Math.abs(lastDay))} in the last day`} tone={lastDay && lastDay > 0 ? 'up' : lastDay && lastDay < 0 ? 'down' : undefined} />
        <Stat label="Villages" value={fmt(p.villages.length)} sub={p.villages.length ? `${fmt(avg)} points each on average` : 'none left'} />
        <Stat label="Conquered" value={fmt(p.stats.conquered)} sub={p.stats.conquered === 1 ? 'village taken' : 'villages taken'} />
        <Stat label="Plundered" value={fmtShort(p.stats.loot)} sub="resources carried home" title={`${fmt(p.stats.loot)} resources`} />
      </dl>
      <ActionBar p={p} />
    </section>
  );
}

function Stat({ label, value, sub, tone, title }: { label: string; value: string; sub: string; tone?: 'up' | 'down'; title?: string }) {
  return (
    <div class="ph-stat" title={title}>
      <dt>{label}</dt>
      <dd>
        <b class="num">{value}</b>
        <span class={`ph-stat-sub ${tone ? `is-${tone}` : ''}`}>{sub}</span>
      </dd>
    </div>
  );
}

function RoleBadges({ role, rights }: { role: 'founder' | 'leader' | null; rights: TribeRight[] }) {
  if (role === 'founder') return <span class="pill pill-gold">Founder</span>;
  if (role === 'leader') return <span class="pill pill-gold">Leader</span>;
  return <>{rights.map((r) => <span class="pill">{RIGHT_LABEL[r]}</span>)}</>;
}

/** Villages by the hero their statue is sworn to (the look anyone can see on the map), most first. */
function heroCounts(villages: ProfileVillage[]): [VillageTheme, number][] {
  const n = new Map<VillageTheme, number>();
  for (const v of villages) if (v.theme !== 'classic') n.set(v.theme, (n.get(v.theme) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]);
}

/** Points gained since `t` (null without enough history to tell). */
function gainSince(history: [number, number][], t: number): number | null {
  if (history.length < 2) return null;
  let before = history[0];
  for (const h of history) { if (h[0] > t) break; before = h; }
  return history[history.length - 1][1] - before[1];
}

// ---------- actions ----------

/** A button that is always there, greyed out with the reason when it can't be used (a tap tells why). */
function GateBtn({ can, onClick, children, ...rest }: { can: Can; onClick: () => void; children: ComponentChildren } & Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & { variant?: 'primary' | 'ghost' | 'danger' | 'quiet'; small?: boolean }) {
  return (
    <Btn
      {...rest}
      aria-disabled={can.ok ? undefined : 'true'}
      title={can.ok ? (rest.title as string | undefined) : can.reason}
      onClick={() => (can.ok ? onClick() : toast(can.reason ?? 'Not possible right now.', 'info'))}
    >
      {children}
    </Btn>
  );
}

/** A small menu that drops down from a button and closes on a click outside or Escape. */
function Pop({ label, title, children, class: cls }: { label: ComponentChildren; title?: string; children: ComponentChildren; class?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<'left' | 'right'>('left');
  useEffect(() => {
    if (!open) return;
    const off = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', off);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); window.removeEventListener('keydown', esc); };
  }, [open]);
  // keep the menu on screen: open it leftwards from the button when there's no room to the right
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const w = body.current?.offsetWidth ?? 260;
    setEdge(r.left + w > document.documentElement.clientWidth - 12 ? 'right' : 'left');
  }, [open]);
  return (
    <div class={`pop ${cls ?? ''}`} ref={ref}>
      <Btn small variant="ghost" aria-expanded={open} aria-haspopup="true" title={title} onClick={() => setOpen(!open)}>{label}<span class="pop-caret" aria-hidden="true">▾</span></Btn>
      {open && <div class={`pop-body is-${edge}`} ref={body}>{children}</div>}
    </div>
  );
}

function MarkSwatches({ value, onPick }: { value?: string; onPick: (c: string | null) => void }) {
  return (
    <div class="swatches">
      {MARK_COLORS.map((c) => (
        <button type="button" class={`swatch ${value === c ? 'is-on' : ''}`} style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={value === c} onClick={() => onPick(c)} />
      ))}
      <label class="swatch swatch-custom" title="Any colour">
        <input type="color" value={value ?? '#3fd16b'} onInput={(e) => onPick(e.currentTarget.value)} aria-label="Pick any colour" />
      </label>
      {value && <button type="button" class="link small" onClick={() => onPick(null)}>clear</button>}
    </div>
  );
}

/** Colour all of a ruler's (or a tribe's) villages on the map, the way the map's markers do. */
export function MarkMenu({ kind, id, what }: { kind: 'players' | 'tribes'; id: number; what: string }) {
  const color = marks.value[kind][id];
  return (
    <Pop
      label={<><span class={`mark-dot ${color ? '' : 'is-empty'}`} style={color ? { background: color } : undefined} aria-hidden="true" /> {color ? 'Marked' : 'Mark on map'}</>}
      title={color ? 'Change or clear the colour their villages show in on the map' : 'Colour their villages on the map so they stand out'}
    >
      <p class="small"><b>Colour {what} on the map</b></p>
      <MarkSwatches value={color} onPick={(c) => setMark(kind, id, c)} />
      <p class="muted small">Markers are kept in this browser, for this realm.</p>
    </Pop>
  );
}

function ActionBar({ p }: { p: ProfileData }) {
  const pane = usePane();
  const pv = view.value!;
  const you = p.you!;
  const show = useContext(DialogCtx);
  const biggest = [...p.villages].sort((a, b) => b.points - a.points)[0];
  const tag = you.myTribe ? `[${you.myTribe.tag}]` : '';
  const copy = (
    <span class="ph-copy">
      <CopyButton text={p.name} label={`Copy the name ${p.name}`}>Name</CopyButton>
      <CopyButton text={`[player]${p.name}[/player]`} label="Copy as BBCode, for the tribe forum" class="is-bb">BBCode</CopyButton>
    </span>
  );
  if (you.self) {
    const home = p.villages.find((v) => v.id === pv.me.homeVid) ?? biggest;
    return (
      <div class="ph-actions" role="toolbar" aria-label="Your profile">
        <Btn small onClick={() => pane.go({ name: 'banner' })}><Icon name="flag" size={14} /> {p.flag ? 'Edit your banner' : 'Design your banner'}</Btn>
        <Btn small variant="ghost" onClick={() => pane.go({ name: 'tribe' })}><Icon name="tribe" size={14} /> {p.tribe ? 'Your tribe' : 'Find a tribe'}</Btn>
        {home && <Btn small variant="ghost" onClick={() => pane.go({ name: 'map', focus: home.id })}><Icon name="map" size={14} /> Show on map</Btn>}
        <span class="grow" />
        {copy}
      </div>
    );
  }
  const inv = you.invite;
  return (
    <div class="ph-actions" role="toolbar" aria-label={`Actions for ${p.name}`}>
      {inv?.state === 'can' && (
        <Btn small onClick={() => act({ type: 'tribeInvite', name: p.name }, `${p.name} has been invited to ${tag}.`)} title={inv.note ?? `Invite ${p.name} to ${tag}`}>
          <Icon name="tribe" size={14} /> Invite to {tag}
        </Btn>
      )}
      {inv?.state === 'blocked' && <GateBtn small can={{ ok: false, reason: inv.reason }} onClick={() => {}}><Icon name="tribe" size={14} /> Invite to {tag}</GateBtn>}
      {inv?.state === 'invited' && (
        <span class="ph-state">
          <span class="pill pill-recruiting">Invited to {tag}</span>
          {inv.mayWithdraw && <Btn small variant="quiet" onClick={() => act({ type: 'tribeCancelInvite', pid: p.id }, 'Invitation withdrawn.')}>Withdraw</Btn>}
        </span>
      )}
      {inv?.state === 'applied' && (
        <span class="ph-state">
          <span class="pill" title={`${p.name} asked to join your tribe`}>Asked to join {tag}</span>
          <Btn small onClick={() => act({ type: 'tribeAnswer', pid: p.id, accept: true }, `${p.name} joined the tribe.`)}>Accept</Btn>
          <Btn small variant="ghost" onClick={() => act({ type: 'tribeAnswer', pid: p.id, accept: false }, 'Request declined.')}>Decline</Btn>
        </span>
      )}
      {you.rights && (you.rights.ok ? (
        <Pop label={<><Icon name="settings" size={14} /> Rights</>} title={`What ${p.name} may do in the tribe`}>
          <p class="small"><b>{p.name}'s rights in {tag}</b></p>
          <div class="ph-rights">
            {you.rights.grantable.map((r) => (
              <label class="check">
                <input
                  type="checkbox"
                  checked={you.rights!.current.includes(r)}
                  onChange={(e) => {
                    const next = e.currentTarget.checked ? [...you.rights!.current, r] : you.rights!.current.filter((x) => x !== r);
                    act({ type: 'tribeRights', pid: p.id, rights: next }, `${RIGHT_LABEL[r]}: ${e.currentTarget.checked ? 'granted to' : 'taken from'} ${p.name}.`);
                  }}
                />
                {RIGHT_LABEL[r]}
              </label>
            ))}
          </div>
        </Pop>
      ) : <GateBtn small variant="ghost" can={you.rights} onClick={() => {}}><Icon name="settings" size={14} /> Rights</GateBtn>)}
      {you.kick && (
        <GateBtn small variant="danger" can={you.kick} onClick={() => show(
          <Modal title={`Remove ${p.name}?`} onClose={() => show(null)}>
            <p>{p.name} will no longer be a member of {you.myTribe?.name} {tag}. They can be invited back later.</p>
            <div class="row gap end dialog-actions">
              <Btn variant="ghost" onClick={() => show(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={() => { show(null); act({ type: 'tribeKick', pid: p.id }, `${p.name} was removed from the tribe.`); }}>Remove from tribe</Btn>
            </div>
          </Modal>,
        )}>Remove from tribe</GateBtn>
      )}
      {you.diplomacy && p.tribe && <StanceSelect tribeId={p.tribe.id} tag={p.tribe.tag} current={you.diplomacy.current} />}
      {!p.eliminated && <MarkMenu kind="players" id={p.id} what={`all of ${p.name}'s villages`} />}
      {biggest && <Btn small variant="ghost" onClick={() => pane.go({ name: 'map', focus: biggest.id })} title={`Centre the map on ${biggest.name}, their biggest village`}><Icon name="map" size={14} /> Show on map</Btn>}
      <span class="grow" />
      {copy}
    </div>
  );
}

/** A diplomat sets how their tribe sees another one. */
export function StanceSelect({ tribeId, tag, current }: { tribeId: number; tag: string; current: Diplomacy | null }) {
  return (
    <label class={`ph-stance ${current ? `rel-${current}` : ''}`} title={`How your tribe sees [${tag}] (allies show turquoise on the map, pacts purple, enemies red)`}>
      <span>[{tag}] is</span>
      <select
        value={current ?? ''}
        onChange={(e) => {
          const s = (e.currentTarget.value || null) as Diplomacy | null;
          act({ type: 'tribeDiplomacy', tribe: tribeId, status: s }, s ? `[${tag}] is now marked: ${STANCE[s].toLowerCase()}.` : `Relation with [${tag}] ended.`);
        }}
      >
        <option value="">No relation</option>
        <option value="ally">{STANCE.ally}</option>
        <option value="nap">{STANCE.nap}</option>
        <option value="enemy">{STANCE.enemy}</option>
      </select>
    </label>
  );
}

// ---------- villages ----------

type Sort = 'points' | 'distance' | 'name';

function VillagesPanel({ p }: { p: ProfileData }) {
  const pane = usePane();
  const pv = view.value!;
  const cur = pane.village.value;
  const [sort, setSort] = useState<Sort>('points');
  const [all, setAll] = useState(false);
  const you = p.you!;
  const dist = (v: ProfileVillage) => (cur ? distance(cur.x, cur.y, v.x, v.y) : 0);
  const list = [...p.villages].sort((a, b) => (sort === 'points' ? b.points - a.points : sort === 'distance' ? dist(a) - dist(b) : a.name.localeCompare(b.name)));
  const shown = all ? list : list.slice(0, VILLAGE_CAP);
  const send = (v: ProfileVillage, kind: 'attack' | 'support') => {
    rallyTarget.value = { x: v.x, y: v.y, kind };
    pane.go({ name: 'building', id: 'rally', tab: 'send' });
  };
  const size = pv.config.size;
  return (
    <Section
      title={<>Villages <span class="ph-count">{p.villages.length}</span></>}
      class="pg-vills"
      actions={p.villages.length > 1 && (
        <div class="seg seg-sm" role="group" aria-label="Sort villages">
          {(['points', 'distance', 'name'] as Sort[]).map((s) => (
            <button type="button" class={sort === s ? 'is-on' : ''} aria-pressed={sort === s} onClick={() => setSort(s)}>{s === 'points' ? 'Points' : s === 'distance' ? 'Nearest' : 'Name'}</button>
          ))}
        </div>
      )}
    >
      {p.villages.length === 0 ? <Empty>{p.name} holds no villages.</Empty> : (
        <>
          <div class="pv-list" role="table" aria-label={`${p.name}'s villages`}>
            <div class="pv-row pv-head" role="row">
              <span role="columnheader">Village</span>
              <span role="columnheader" class="pv-quad">Quadrant</span>
              <span role="columnheader" class="right">Points</span>
              <span role="columnheader" class="right" title={cur ? `Fields from ${cur.name}` : undefined}>Distance</span>
              <span role="columnheader" class="pv-acts"><span class="sr-only">Actions</span></span>
            </div>
            {shown.map((v) => {
              const q = quadrant(v.x, v.y, size);
              const here = cur?.id === v.id;
              return (
                <div class="pv-row" role="row" key={v.id}>
                  <span class="pv-name" role="cell">
                    {v.theme !== 'classic' && <span class="pv-hero" title={`Sworn to the ${UNITS[v.theme as keyof typeof UNITS]?.name ?? v.theme}`}><Icon name={v.theme} size={15} /></span>}
                    <VillageLink vid={v.id} name={v.name} x={v.x} y={v.y} />
                  </span>
                  <span class="pv-quad muted small" role="cell" title={`${QUADRANT_NAME[q]} quadrant`}>{q}</span>
                  <span class="pv-pts num right" role="cell"><Icon name="points" size={13} /> {fmt(v.points)}</span>
                  <span class="pv-dist num right muted" role="cell" title={cur && !here ? `${dist(v).toFixed(1)} fields from ${cur.name}` : undefined}>{here ? 'you are here' : cur ? <>{dist(v).toFixed(1)}<span class="pv-unit"> fields</span></> : '—'}</span>
                  <span class="pv-acts" role="cell">
                    {you.self ? (
                      <>
                        <Btn small variant="ghost" onClick={() => { pane.vid.value = v.id; pane.go({ name: 'village' }); }} title={`Open ${v.name}`} aria-label={`Open ${v.name}`}><Icon name="village" size={14} /><span class="pv-lbl">Open</span></Btn>
                        {!here && <Btn small variant="ghost" onClick={() => send(v, 'support')} title={`Send troops from ${cur?.name ?? 'your village'} to ${v.name}`} aria-label={`Send troops to ${v.name}`}><Icon name="support" size={14} /><span class="pv-lbl">Send</span></Btn>}
                      </>
                    ) : (
                      <>
                        <GateBtn small variant="ghost" class="pv-attack" can={you.attack} onClick={() => send(v, 'attack')} title={`Attack ${v.name} from ${cur?.name ?? 'your village'}`} aria-label={`Attack ${v.name}`}><Icon name="attack" size={14} /><span class="pv-lbl">Attack</span></GateBtn>
                        <Btn small variant="ghost" onClick={() => send(v, 'support')} title={`Send support to ${v.name}`} aria-label={`Support ${v.name}`}><Icon name="support" size={14} /><span class="pv-lbl">Support</span></Btn>
                      </>
                    )}
                    <Btn small variant="quiet" class="pv-map" onClick={() => pane.go({ name: 'map', focus: v.id })} title={`Show ${v.name} on the map`} aria-label={`Show ${v.name} on the map`}><Icon name="map" size={15} /></Btn>
                  </span>
                </div>
              );
            })}
          </div>
          {list.length > VILLAGE_CAP && (
            <button type="button" class="link small pv-more" onClick={() => setAll(!all)}>
              {all ? 'Show fewer' : `Show all ${list.length} villages`}
            </button>
          )}
        </>
      )}
    </Section>
  );
}

// ---------- growth, fights and honours ----------

function GrowthPanel({ p }: { p: ProfileData }) {
  const week = gainSince(p.history, now.value - 7 * DAY);
  // draw the chart at the size it is shown, so its labels stay the same size on a phone and a wide screen
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(360);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setW(Math.max(260, Math.round(el.clientWidth)));
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <Section title="Growth" class="pg-growth" actions={week !== null && week !== 0 && <span class={`ph-delta ${week > 0 ? 'is-up' : 'is-down'}`} title="Points gained over the last week">{week > 0 ? '+' : '−'}{fmt(Math.abs(week))} this week</span>}>
      <div class="pg-chart" ref={box}>
        {p.history.length > 1 ? <Sparkline points={p.history} w={w} h={Math.round(Math.min(230, Math.max(130, w * 0.34)))} /> : (
          <div class="pg-empty">
            <Icon name="rank" size={40} />
            <span>No history yet: the chart fills in as the realm goes on.</span>
          </div>
        )}
      </div>
    </Section>
  );
}

const MEDAL = ['None yet', 'Bronze', 'Silver', 'Gold', 'Diamond'];
const MEDAL_CLASS = ['m0', 'm1', 'm2', 'm3', 'm4'];

function Medal({ tier, size = 34 }: { tier: number; size?: number }) {
  return (
    <span class={`medal ${MEDAL_CLASS[tier]}`} style={{ width: `${size}px`, height: `${size}px` }} aria-label={MEDAL[tier]} role="img">
      <Icon name="star" size={Math.round(size * 0.55)} />
    </span>
  );
}

function Progress({ value, next }: { value: number; next: number | null }) {
  if (next === null) return null;
  return <div class="bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (value / next) * 100)}%` }} /></div>;
}

/** Opponents defeated in attack, defence and support (ODA, ODD, ODS), with medals and places. */
function FightsPanel({ p }: { p: ProfileData }) {
  const fights = (['oda', 'odd', 'ods'] as const).map((id) => p.achievements.find((a) => a.id === id)!).filter(Boolean);
  const label: Record<string, string> = { oda: 'As attacker', odd: 'As defender', ods: 'As supporter' };
  const place: Record<string, number | null> = { oda: p.odaRank, odd: p.oddRank, ods: null };
  const board: Record<string, string> = { oda: 'attackers', odd: 'defenders' };
  return (
    <Section title="Opponents defeated" class="pg-fights">
      <div class="fight-grid">
        {fights.map((a) => (
          <div class="fight-card">
            <Medal tier={a.tier} size={40} />
            <div class="grow">
              <div class="fight-top">
                <span class="muted small">{label[a.id]}</span>
                {place[a.id] !== null && <span class="fight-rank" title={`Place among the realm's ${board[a.id]}`}>#{place[a.id]}</span>}
              </div>
              <div class="big num">{fmt(a.value)}</div>
              <div class="small">{MEDAL[a.tier]}{a.next !== null && <span class="muted"> · next at {fmt(a.next)}</span>}</div>
              <Progress value={a.value} next={a.next} />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function DailyAwards({ p }: { p: ProfileData }) {
  const show = useContext(DialogCtx);
  const when = (day: number) => (day === p.today - 1 ? 'yesterday' : `on ${new Date(day * DAY).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })}`);
  const total = p.awards.reduce((s, a) => s + a.count, 0);
  return (
    <Section title="Daily awards" class="pg-daily" actions={total > 0 && <span class="ph-count" title="Daily awards won">{total}</span>}>
      {p.awards.length === 0 ? <Empty>No daily awards yet. Top the day's attackers, defenders, supporters, plunderers or conquerors to win one.</Empty> : (
        <div class="daily-grid">
          {p.awards.map((a) => (
            <button type="button" class="daily-card" onClick={() => show(<AwardHistory p={p} a={a} when={when} onClose={() => show(null)} />)} title="See every time it was won">
              <span class={`daily-badge daily-${a.kind}`}><Icon name={a.kind === 'defender' ? 'shield' : a.kind === 'supporter' ? 'support' : a.kind === 'looter' ? 'wood' : a.kind === 'conqueror' ? 'noble' : 'attack'} size={22} /></span>
              <span class="grow"><b>{a.title}</b><span class="muted small">won {a.count} time{a.count === 1 ? '' : 's'}</span></span>
              <span class="daily-count">×{a.count}</span>
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

function AwardHistory({ p, a, when, onClose }: { p: ProfileData; a: ProfileData['awards'][number]; when: (day: number) => string; onClose: () => void }) {
  return (
    <Modal title={a.title} onClose={onClose}>
      <p class="muted">{a.text}</p>
      <table class="table award-table">
        <thead><tr><th>Achieved</th><th class="right">{p.name.split(' ')[0]}'s score</th><th class="right">Runner-up</th></tr></thead>
        <tbody>
          {a.history.map((h) => (
            <tr><td>{when(h.day)}</td><td class="right num">{fmt(h.score)}</td><td class="right num">{h.runnerUp === null ? 'unknown' : fmt(h.runnerUp)}</td></tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

function AchievementsPanel({ p }: { p: ProfileData }) {
  const others = p.achievements.filter((a) => !['oda', 'odd', 'ods'].includes(a.id));
  const earned = others.filter((a) => a.tier > 0).length;
  return (
    <Section title="Achievements" class="pg-ach" actions={<span class="ph-count" title="Achievements with at least a bronze medal">{earned}/{others.length}</span>}>
      <ul class="ach-list">
        {others.map((a) => (
          <li>
            <Medal tier={a.tier} size={30} />
            <div class="grow">
              <div class="ach-line"><b>{a.title}</b> <span class="muted small">{a.text}</span></div>
              <div class="small num">{fmt(a.value)}{a.next !== null ? <span class="muted"> / {fmt(a.next)} for {MEDAL[a.tier + 1]}</span> : <span class="muted"> · top level</span>}</div>
              <Progress value={a.value} next={a.next} />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
