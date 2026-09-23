// Tribes, the way Tribal Wars does them: a founder, invitations, member rights,
// diplomacy (allies, non-aggression pacts, enemies), a profile, an internal
// announcement and a members-only forum.

import { commandsTo } from './cmdindex';
import { news } from './commands';
import type { ActionResult, Diplomacy, Player, Tribe, TribeAlert, TribeRight, World } from './types';

export const TRIBE_MAX_MEMBERS = 25;
export const TRIBE_RIGHTS: TribeRight[] = ['lead', 'invite', 'diplomacy', 'forum', 'internal'];
export const RIGHT_LABEL: Record<TribeRight, string> = {
  lead: 'Leader',
  invite: 'Recruiter',
  diplomacy: 'Diplomat',
  forum: 'Forum moderator',
  internal: 'Internal access',
};
const FORUM_MAX_THREADS = 60;
const FORUM_MAX_POSTS = 200;

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

function clean(s: unknown, max: number): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function joinTribe(w: World, t: Tribe, p: Player): void {
  // an old tribe loses them first
  if (p.tribeId != null && p.tribeId !== t.id) removeMember(w, w.tribes[p.tribeId], p.id);
  if (!t.members.includes(p.id)) t.members.push(p.id);
  p.tribeId = t.id;
  t.invites = (t.invites ?? []).filter((i) => i.pid !== p.id);
  w.mapRev++;
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
  };
  w.tribes[t.id] = t;
  p.tribeId = t.id;
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
  if (patch.description !== undefined) t.description = String(patch.description).slice(0, 2000);
  if (patch.internal !== undefined) t.internal = String(patch.internal).slice(0, 2000);
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

export function disbandTribe(w: World, pid: number): ActionResult {
  const t = tribeOf(w, pid);
  if (!t) return fail('You are not in a tribe.');
  if (t.founderId !== pid) return fail('Only the founder can disband the tribe.');
  disband(w, t);
  return { ok: true };
}

export function forumNewThread(w: World, pid: number, title: string, text: string): ActionResult {
  const t = tribeOf(w, pid);
  if (!t) return fail('You are not in a tribe.');
  const ti = clean(title, 80), tx = String(text ?? '').trim().slice(0, 4000);
  if (!ti) return fail('Give the thread a title.');
  if (!tx) return fail('Write something first.');
  t.forum ??= [];
  const thread = { id: w.nextId++, title: ti, by: pid, t: w.now, posts: [{ id: w.nextId++, by: pid, t: w.now, text: tx }] };
  t.forum.unshift(thread);
  (w.players[pid].forumSeen ??= {})[thread.id] = thread.posts[0].id;
  if (t.forum.length > FORUM_MAX_THREADS) t.forum.length = FORUM_MAX_THREADS;
  return { ok: true, data: thread.id };
}

export function forumReply(w: World, pid: number, threadId: number, text: string): ActionResult {
  const t = tribeOf(w, pid);
  const th = t?.forum?.find((x) => x.id === threadId);
  if (!t || !th) return fail('That thread is gone.');
  const tx = String(text ?? '').trim().slice(0, 4000);
  if (!tx) return fail('Write something first.');
  const post = { id: w.nextId++, by: pid, t: w.now, text: tx };
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
    t.members = t.members.filter((m) => w.players[m] && !w.players[m].eliminated);
    if (t.members.length === 0) { delete w.tribes[id]; continue; }
    t.founderId ??= t.members[0];
    t.createdAt ??= 0;
    t.description ??= '';
    t.internal ??= '';
    t.rights ??= {};
    t.invites ??= [];
    t.diplomacy ??= {};
    t.forum ??= [];
  }
}
