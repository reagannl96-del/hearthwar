// Tribes, the way Tribal Wars does them: a founder, invitations, member rights,
// diplomacy (allies, non-aggression pacts, enemies), a profile, an internal
// announcement and a members-only forum.

import { commandsTo } from './cmdindex';
import { addReport, news } from './commands';
import type { ActionResult, Diplomacy, Player, Tribe, TribeAlert, TribeRight, World, ForumPost, SharedReport } from './types';

export const TRIBE_MAX_MEMBERS = 25;
export const TRIBE_RIGHTS: TribeRight[] = ['lead', 'invite', 'diplomacy', 'forum', 'internal'];
export const RIGHT_LABEL: Record<TribeRight, string> = {
  lead: 'Leader',
  invite: 'Recruiter',
  diplomacy: 'Diplomat',
  forum: 'Forum moderator',
  internal: 'Internal access',
};
/** how far back the rankings count new members ("+3 this week") */
export const JOIN_WINDOW = 7 * 24 * 3_600_000;
const FORUM_MAX_THREADS = 60;
const FORUM_MAX_POSTS = 200;
/** a forum post, room for BBCode tags on top of what it says */
export const FORUM_MAX_TEXT = 5000;
/** the tribe's public description and members-only announcement */
export const TRIBE_TEXT_MAX = 3000;

const fail = (error: string): ActionResult => ({ ok: false, error });

export function tribeOf(w: World, pid: number): Tribe | null {
  const p = w.players[pid];
  return p?.tribeId != null ? w.tribes[p.tribeId] ?? null : null;
}

/** Does this member have the right? The founder and leaders can do everything. */
export function hasRight(t: Tribe, pid: number, right: TribeRight): boolean {
  if (t.founderId === pid) return true;
  const r = t.rights?.[pid] ?? [];
  return r.includes('lead') || r.includes(right);
}

export function relation(w: World, fromTribe: number | null, toTribe: number | null): Diplomacy | 'own' | null {
  if (fromTribe == null || toTribe == null) return null;
  if (fromTribe === toTribe) return 'own';
  return w.tribes[fromTribe]?.diplomacy?.[toTribe] ?? null;
}

/** Tribe points: the sum of its members' points. */
export function tribePoints(w: World, t: Tribe): number {
  return t.members.reduce((s, id) => s + (w.players[id]?.points ?? 0), 0);
}

/**
 * Longer text players write (posts, descriptions): kept as plain text, line breaks
 * and all. Control characters go; BBCode tags stay as typed (they are only ever
 * drawn by the client, never turned into HTML).
 */
export function cleanText(s: unknown, max: number): string {
  return String(s ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);
}

function clean(s: unknown, max: number): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function joinTribe(w: World, t: Tribe, p: Player): void {
  // an old tribe loses them first
  if (p.tribeId != null && p.tribeId !== t.id) removeMember(w, w.tribes[p.tribeId], p.id);
  if (!t.members.includes(p.id)) t.members.push(p.id);
  p.tribeId = t.id;
  t.invites = (t.invites ?? []).filter((i) => i.pid !== p.id);
  // a ruler in a tribe asks nobody else to take them in
  for (const id in w.tribes) {
    const o = w.tribes[id];
    if (o.applications?.some((a) => a.pid === p.id)) o.applications = o.applications.filter((a) => a.pid !== p.id);
  }
  // remember when they came, for the rankings (a few weeks back is plenty)
  t.joins = [...(t.joins ?? []).filter((at) => w.now - at < JOIN_WINDOW * 4), w.now];
  w.mapRev++;
}

/** New members over the last week. */
export function joinedThisWeek(w: World, t: Tribe): number {
  return (t.joins ?? []).filter((at) => w.now - at < JOIN_WINDOW).length;
}

/** No room for another member (open invitations hold a seat, as they do for inviting). */
export function tribeFull(t: Tribe): boolean {
  return t.members.length + (t.invites?.length ?? 0) >= TRIBE_MAX_MEMBERS;
}

/** A ruler who lost their last village leaves their tribe (the crown passes on, as when leaving). */
export function dropFromTribe(w: World, pid: number): void {
  const p = w.players[pid];
  if (!p) return;
  if (p.tribeId != null) removeMember(w, w.tribes[p.tribeId], pid);
  p.tribeId = null;
  for (const id in w.tribes) {
    const t = w.tribes[id];
    if (t.applications?.some((a) => a.pid === pid)) t.applications = t.applications.filter((a) => a.pid !== pid);
    if (t.invites?.some((i) => i.pid === pid)) t.invites = t.invites.filter((i) => i.pid !== pid);
  }
}

/**
 * One tribe folds into another: every member moves over, the smaller tribe's name
 * and diplomacy are gone, and the realm hears of it. False if it would not fit.
 */
export function mergeTribes(w: World, fromId: number, intoId: number): boolean {
  const a = w.tribes[fromId], b = w.tribes[intoId];
  if (!a || !b || a.id === b.id) return false;
  if (a.members.length + b.members.length > TRIBE_MAX_MEMBERS) return false;
  const moving = [...a.members];
  // empty the old tribe first, so nobody's leaving disbands it along the way
  a.members = [];
  for (const m of moving) {
    const p = w.players[m];
    if (!p) continue;
    p.tribeId = null;
    joinTribe(w, b, p);
  }
  for (const id in w.tribes) delete w.tribes[id].diplomacy?.[a.id];
  delete w.tribes[a.id];
  news(w, `The tribe ${a.name} [${a.tag}] has joined ${b.name} [${b.tag}]: ${moving.length} more ${moving.length === 1 ? 'ruler' : 'rulers'} under one banner.`, 'world');
  w.mapRev++;
  return true;
}

function removeMember(w: World, t: Tribe | undefined, pid: number): void {
  if (!t) return;
  t.members = t.members.filter((m) => m !== pid);
  if (t.rights) delete t.rights[pid];
  const p = w.players[pid];
  if (p && p.tribeId === t.id) p.tribeId = null;
  if (t.members.length === 0) {
    disband(w, t);
    return;
  }
  if (t.founderId === pid) {
    // the crown passes to a leader if there is one, otherwise the longest-serving member
    t.founderId = t.members.find((m) => t.rights?.[m]?.includes('lead')) ?? t.members[0];
  }
  w.mapRev++;
}

function disband(w: World, t: Tribe): void {
  for (const m of t.members) if (w.players[m]) w.players[m].tribeId = null;
  for (const id in w.tribes) delete w.tribes[id].diplomacy?.[t.id];
  delete w.tribes[t.id];
  news(w, `The tribe ${t.name} [${t.tag}] has been disbanded.`, 'world');
  w.mapRev++;
}

export function createTribe(w: World, pid: number, name: string, tag: string): ActionResult {
  const p = w.players[pid];
  if (p.tribeId != null) return fail('Leave your current tribe first.');
  const n = clean(name, 32), g = clean(tag, 6).replace(/\s/g, '');
  if (n.length < 3) return fail('The name needs at least 3 letters.');
  if (g.length < 1) return fail('Pick a short tag, like HWR.');
  for (const id in w.tribes) {
    if (w.tribes[id].tag.toLowerCase() === g.toLowerCase()) return fail(`The tag [${g}] is taken.`);
    if (w.tribes[id].name.toLowerCase() === n.toLowerCase()) return fail('A tribe with that name already exists.');
  }
  const t: Tribe = {
    id: w.nextId++, name: n, tag: g, color: p.color, members: [p.id], founderId: p.id, createdAt: w.now,
    description: '', internal: '', rights: {}, invites: [], diplomacy: {}, forum: [],
    recruiting: p.kind === 'ai', applications: [], joins: [],
  };
  w.tribes[t.id] = t;
  p.tribeId = t.id;
  for (const id in w.tribes) {
    const o = w.tribes[id];
    if (o.applications?.some((a) => a.pid === p.id)) o.applications = o.applications.filter((a) => a.pid !== p.id);
  }
  news(w, `${p.name} founded the tribe ${t.name} [${t.tag}].`, 'world');
  w.mapRev++;
  return { ok: true, data: t.id };
}

export function invitePlayer(w: World, pid: number, name: string): ActionResult {
  const t = tribeOf(w, pid);
  if (!t) return fail('You are not in a tribe.');
  if (!hasRight(t, pid, 'invite')) return fail('You do not have the right to invite.');
  const q = clean(name, 40).toLowerCase();
  const target = Object.values(w.players).find((x) => !x.eliminated && x.name.toLowerCase() === q);
  if (!target) return fail('No ruler by that name.');
  if (target.tribeId === t.id) return fail(`${target.name} is already in your tribe.`);
  if (t.members.length + (t.invites?.length ?? 0) >= TRIBE_MAX_MEMBERS) return fail(`A tribe can have at most ${TRIBE_MAX_MEMBERS} members (open invitations count).`);
  t.invites ??= [];
  if (t.invites.some((i) => i.pid === target.id)) return fail(`${target.name} already has an invitation.`);
  t.invites.push({ pid: target.id, by: pid, t: w.now });
  return { ok: true, data: target.id };
}

export function cancelInvite(w: World, pid: number, target: number): ActionResult {
  const t = tribeOf(w, pid);
  if (!t) return fail('You are not in a tribe.');
  if (!hasRight(t, pid, 'invite')) return fail('You do not have the right to invite.');
  t.invites = (t.invites ?? []).filter((i) => i.pid !== target);
  return { ok: true };
}

/** Invitations waiting for this player. */
export function invitesFor(w: World, pid: number): { tribe: Tribe; by: number; t: number }[] {
  const out: { tribe: Tribe; by: number; t: number }[] = [];
  for (const id in w.tribes) {
    const t = w.tribes[id];
    const inv = t.invites?.find((i) => i.pid === pid);
    if (inv) out.push({ tribe: t, by: inv.by, t: inv.t });
  }
  return out;
}

export function acceptInvite(w: World, pid: number, tribeId: number): ActionResult {
  const t = w.tribes[tribeId];
  const p = w.players[pid];
  if (!t || !t.invites?.some((i) => i.pid === pid)) return fail('That invitation is gone.');
  if (p.tribeId != null) return fail('Leave your current tribe first.');
  if (t.members.length >= TRIBE_MAX_MEMBERS) return fail('That tribe is full.');
  joinTribe(w, t, p);
  news(w, `${p.name} joined the tribe ${t.name} [${t.tag}].`, 'player');
  return { ok: true };
}

export function declineInvite(w: World, pid: number, tribeId: number): ActionResult {
  const t = w.tribes[tribeId];
  if (t) t.invites = (t.invites ?? []).filter((i) => i.pid !== pid);
  return { ok: true };
}

export function leaveTribe(w: World, pid: number): ActionResult {
  const t = tribeOf(w, pid);
  if (!t) return fail('You are not in a tribe.');
  const p = w.players[pid];
  news(w, `${p.name} left the tribe ${t.name} [${t.tag}].`, 'player');
  removeMember(w, t, pid);
  return { ok: true };
}

export function kickMember(w: World, pid: number, target: number): ActionResult {
  const t = tribeOf(w, pid);
  if (!t || !t.members.includes(target)) return fail('That ruler is not in your tribe.');
  if (target === pid) return fail('Use "Leave tribe" instead.');
  if (!hasRight(t, pid, 'invite')) return fail('You do not have the right to remove members.');
  if (target === t.founderId) return fail('The founder cannot be removed.');
  if (hasRight(t, target, 'lead') && t.founderId !== pid) return fail('Only the founder can remove a leader.');
  const who = w.players[target];
  removeMember(w, t, target);
  news(w, `${who?.name ?? 'A ruler'} was removed from ${t.name} [${t.tag}].`, 'player');
  return { ok: true };
}

export function setRights(w: World, pid: number, target: number, rights: TribeRight[]): ActionResult {
  const t = tribeOf(w, pid);
  if (!t || !t.members.includes(target)) return fail('That ruler is not in your tribe.');
  if (!hasRight(t, pid, 'lead')) return fail('Only leaders can change rights.');
  if (target === t.founderId) return fail('The founder always has every right.');
  if (rights.includes('lead') && t.founderId !== pid) return fail('Only the founder can make someone a leader.');
  t.rights ??= {};
  t.rights[target] = TRIBE_RIGHTS.filter((r) => rights.includes(r));
  return { ok: true };
}

export function setDiplomacy(w: World, pid: number, other: number, status: Diplomacy | null): ActionResult {
  const t = tribeOf(w, pid);
  if (!t) return fail('You are not in a tribe.');
  if (!hasRight(t, pid, 'diplomacy')) return fail('You do not have the right to handle diplomacy.');
  if (!w.tribes[other] || other === t.id) return fail('Pick another tribe.');
  t.diplomacy ??= {};
  if (status) t.diplomacy[other] = status;
  else delete t.diplomacy[other];
  w.mapRev++;
  return { ok: true };
}

export function editTribe(w: World, pid: number, patch: { description?: string; internal?: string; name?: string; tag?: string }): ActionResult {
  const t = tribeOf(w, pid);
  if (!t) return fail('You are not in a tribe.');
  if (!hasRight(t, pid, 'lead')) return fail('Only leaders can edit the tribe.');
  if (patch.description !== undefined) t.description = cleanText(patch.description, TRIBE_TEXT_MAX);
  if (patch.internal !== undefined) t.internal = cleanText(patch.internal, TRIBE_TEXT_MAX);
  if (patch.name !== undefined) {
    const n = clean(patch.name, 32);
    if (n.length < 3) return fail('The name needs at least 3 letters.');
    t.name = n;
    w.mapRev++;
  }
  if (patch.tag !== undefined) {
    const g = clean(patch.tag, 6).replace(/\s/g, '');
    if (!g) return fail('Pick a short tag.');
    for (const id in w.tribes) if (Number(id) !== t.id && w.tribes[id].tag.toLowerCase() === g.toLowerCase()) return fail(`The tag [${g}] is taken.`);
    t.tag = g;
    w.mapRev++;
  }
  return { ok: true };
}

// ---------- recruiting ----------

/** Open or close the tribe to applications (and the "recruiting" badge on the rankings). */
export function setRecruiting(w: World, pid: number, on: boolean): ActionResult {
  const t = tribeOf(w, pid);
  if (!t) return fail('You are not in a tribe.');
  if (!hasRight(t, pid, 'invite')) return fail('Only recruiters can open or close the tribe.');
  t.recruiting = !!on;
  if (!on) {
    // closing the doors turns away everyone still waiting
    for (const a of t.applications ?? []) answered(w, t, a.pid, false);
    t.applications = [];
  }
  return { ok: true };
}

/** Tribes this ruler has asked to join (and is still waiting on). */
export function applicationsBy(w: World, pid: number): { tribe: Tribe; t: number }[] {
  const out: { tribe: Tribe; t: number }[] = [];
  for (const id in w.tribes) {
    const t = w.tribes[id];
    const a = t.applications?.find((x) => x.pid === pid);
    if (a) out.push({ tribe: t, t: a.t });
  }
  return out;
}

/** A tribeless ruler asks a recruiting tribe to take them in (one request at a time). */
export function applyToTribe(w: World, pid: number, tribeId: number): ActionResult {
  const p = w.players[pid];
  const t = w.tribes[tribeId];
  if (!p || p.eliminated) return fail('You are not in this realm.');
  if (p.tribeId != null) return fail('You are already in a tribe.');
  if (!t) return fail('That tribe is gone.');
  if (!t.recruiting) return fail(`[${t.tag}] is not recruiting right now.`);
  if (tribeFull(t)) return fail('That tribe is full.');
  // already invited: then the answer is simply yes
  if (t.invites?.some((i) => i.pid === pid)) return acceptInvite(w, pid, tribeId);
  if (t.applications?.some((a) => a.pid === pid)) return fail('You have already asked to join.');
  // a new request replaces any other one still waiting
  for (const id in w.tribes) {
    const o = w.tribes[id];
    if (o.applications?.some((a) => a.pid === pid)) o.applications = o.applications.filter((a) => a.pid !== pid);
  }
  t.applications = [...(t.applications ?? []), { pid, t: w.now }].slice(-40);
  return { ok: true };
}

export function withdrawApplication(w: World, pid: number, tribeId: number): ActionResult {
  const t = w.tribes[tribeId];
  if (t?.applications) t.applications = t.applications.filter((a) => a.pid !== pid);
  return { ok: true };
}

/** A recruiter takes an applicant in, or turns them away. */
export function answerApplication(w: World, pid: number, applicant: number, accept: boolean): ActionResult {
  const t = tribeOf(w, pid);
  if (!t) return fail('You are not in a tribe.');
  if (!hasRight(t, pid, 'invite')) return fail('Only recruiters can answer requests to join.');
  if (!t.applications?.some((a) => a.pid === applicant)) return fail('That request is gone.');
  const who = w.players[applicant];
  const drop = () => { t.applications = (t.applications ?? []).filter((a) => a.pid !== applicant); };
  if (!who || who.eliminated) { drop(); return fail('That ruler is no longer in the realm.'); }
  if (accept) {
    if (who.tribeId != null) { drop(); return fail(`${who.name} has joined another tribe.`); }
    // (a full tribe keeps the request, so it can still be declined or accepted once a seat frees up)
    if (t.members.length >= TRIBE_MAX_MEMBERS) return fail('The tribe is full.');
  }
  drop();
  if (accept) {
    joinTribe(w, t, who);
    news(w, `${who.name} joined the tribe ${t.name} [${t.tag}].`, 'player');
  }
  answered(w, t, applicant, accept);
  return { ok: true };
}

/** Let the applicant know how it went (a report for a person; an AI ruler just remembers). */
function answered(w: World, t: Tribe, applicant: number, accepted: boolean) {
  const who = w.players[applicant];
  if (!who) return;
  if (who.ai) {
    if (!accepted) (who.ai.turnedAway ??= {})[t.id] = w.now;
    return;
  }
  addReport(w, applicant, accepted
    ? { kind: 'info', color: 'blue', title: `Welcome to ${t.name} [${t.tag}]!`, text: `Your request to join was accepted. You are now a member of ${t.name}.` }
    : { kind: 'info', color: 'yellow', title: `${t.name} [${t.tag}] turned down your request`, text: `The tribe did not take you in this time. Other tribes may be recruiting.` });
}

export function disbandTribe(w: World, pid: number): ActionResult {
  const t = tribeOf(w, pid);
  if (!t) return fail('You are not in a tribe.');
  if (t.founderId !== pid) return fail('Only the founder can disband the tribe.');
  disband(w, t);
  return { ok: true };
}

/** A frozen copy of one of the player's own reports, for posting in the forum. */
function shareable(w: World, pid: number, reportId: number | undefined): SharedReport | null | undefined {
  if (reportId === undefined) return undefined;
  const r = w.players[pid]?.reports.find((x) => x.id === reportId);
  if (!r) return null;
  const copy = JSON.parse(JSON.stringify({ kind: r.kind, title: r.title, color: r.color, t: r.t, battle: r.battle, text: r.text, res: r.res })) as SharedReport;
  return copy;
}

export function forumNewThread(w: World, pid: number, title: string, text: string, reportId?: number): ActionResult {
  const t = tribeOf(w, pid);
  if (!t) return fail('You are not in a tribe.');
  const ti = clean(title, 80), tx = cleanText(text, FORUM_MAX_TEXT);
  const report = shareable(w, pid, reportId);
  if (report === null) return fail('That report is gone.');
  if (!ti) return fail('Give the thread a title.');
  if (!tx && !report) return fail('Write something first.');
  t.forum ??= [];
  const first: ForumPost = { id: w.nextId++, by: pid, t: w.now, text: tx };
  if (report) first.report = report;
  const thread = { id: w.nextId++, title: ti, by: pid, t: w.now, posts: [first] };
  t.forum.unshift(thread);
  (w.players[pid].forumSeen ??= {})[thread.id] = thread.posts[0].id;
  if (t.forum.length > FORUM_MAX_THREADS) t.forum.length = FORUM_MAX_THREADS;
  return { ok: true, data: thread.id };
}

export function forumReply(w: World, pid: number, threadId: number, text: string, reportId?: number): ActionResult {
  const t = tribeOf(w, pid);
  const th = t?.forum?.find((x) => x.id === threadId);
  if (!t || !th) return fail('That thread is gone.');
  const tx = cleanText(text, FORUM_MAX_TEXT);
  const report = shareable(w, pid, reportId);
  if (report === null) return fail('That report is gone.');
  if (!tx && !report) return fail('Write something first.');
  const post: ForumPost = { id: w.nextId++, by: pid, t: w.now, text: tx };
  if (report) post.report = report;
  th.posts.push(post);
  (w.players[pid].forumSeen ??= {})[th.id] = post.id;
  if (th.posts.length > FORUM_MAX_POSTS) th.posts.splice(1, th.posts.length - FORUM_MAX_POSTS);
  // active threads rise to the top (pinned ones stay above)
  t.forum = [th, ...t.forum!.filter((x) => x !== th)];
  return { ok: true };
}

export function forumDelete(w: World, pid: number, threadId: number, postId?: number): ActionResult {
  const t = tribeOf(w, pid);
  const th = t?.forum?.find((x) => x.id === threadId);
  if (!t || !th) return fail('That thread is gone.');
  const mod = hasRight(t, pid, 'forum');
  if (postId === undefined || th.posts[0]?.id === postId) {
    if (!mod && th.by !== pid) return fail('Only forum moderators can delete other people\'s threads.');
    t.forum = t.forum!.filter((x) => x !== th);
  } else {
    const post = th.posts.find((x) => x.id === postId);
    if (!post) return fail('That post is gone.');
    if (!mod && post.by !== pid) return fail('You can only delete your own posts.');
    th.posts = th.posts.filter((x) => x !== post);
  }
  return { ok: true };
}

export function forumRead(w: World, pid: number, threadId: number): ActionResult {
  const t = tribeOf(w, pid);
  const th = t?.forum?.find((x) => x.id === threadId);
  if (!t || !th) return { ok: true };
  const p = w.players[pid];
  p.forumSeen ??= {};
  p.forumSeen[threadId] = th.posts[th.posts.length - 1]?.id ?? 0;
  // forget threads that no longer exist
  for (const k in p.forumSeen) if (!t.forum!.some((x) => x.id === Number(k))) delete p.forumSeen[k];
  return { ok: true };
}

/** Threads with posts this ruler hasn't read yet. */
export function unreadThreads(w: World, pid: number): number[] {
  const t = tribeOf(w, pid);
  if (!t) return [];
  const seen = w.players[pid]?.forumSeen ?? {};
  return (t.forum ?? []).filter((th) => {
    const last = th.posts[th.posts.length - 1];
    return last && last.by !== pid && last.id > (seen[th.id] ?? 0);
  }).map((th) => th.id);
}

export function forumPin(w: World, pid: number, threadId: number, sticky: boolean): ActionResult {
  const t = tribeOf(w, pid);
  const th = t?.forum?.find((x) => x.id === threadId);
  if (!t || !th) return fail('That thread is gone.');
  if (!hasRight(t, pid, 'forum')) return fail('Only forum moderators can pin threads.');
  th.sticky = sticky;
  return { ok: true };
}

/** Attacks heading for any tribe member (for members with internal access). */
export function tribeAlerts(w: World, pid: number): TribeAlert[] {
  const t = tribeOf(w, pid);
  if (!t || !hasRight(t, pid, 'internal')) return [];
  const out: TribeAlert[] = [];
  for (const m of t.members) {
    const mp = w.players[m];
    if (!mp) continue;
    for (const vid of mp.villages) {
      const v = w.villages[vid];
      if (!v) continue;
      for (const c of commandsTo(w, vid)) {
        if (c.kind !== 'attack' || c.ownerId === m) continue;
        if (w.players[c.ownerId]?.tribeId === t.id) continue;
        out.push({ cid: c.id, memberId: m, vid, vname: v.name, x: v.x, y: v.y, attacker: w.players[c.ownerId]?.name ?? 'Unknown', arrive: c.arrive });
      }
    }
  }
  return out.sort((a, b) => a.arrive - b.arrive).slice(0, 100);
}

/** Older saves: make sure every tribe has a founder and the newer fields. */
export function normalizeTribes(w: World): void {
  for (const id in w.tribes) {
    const t = w.tribes[id];
    for (const m of t.members) {
      const p = w.players[m];
      if (p?.eliminated && p.tribeId === t.id) p.tribeId = null;
    }
    t.members = t.members.filter((m) => w.players[m] && !w.players[m].eliminated);
    if (t.members.length === 0) { delete w.tribes[id]; continue; }
    if (t.founderId === undefined || !t.members.includes(t.founderId)) t.founderId = t.members.find((m) => t.rights?.[m]?.includes('lead')) ?? t.members[0];
    t.createdAt ??= 0;
    t.description ??= '';
    t.internal ??= '';
    t.rights ??= {};
    t.invites ??= [];
    t.diplomacy ??= {};
    t.forum ??= [];
    t.applications ??= [];
    t.joins ??= [];
    if (t.recruiting === undefined) t.recruiting = w.players[t.founderId]?.kind === 'ai';
  }
}
