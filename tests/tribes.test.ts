import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/actions';
import { mergeShadow, privatePacket, publicSnapshot } from '../src/engine/shadow';
import { hasRight, joinedThisWeek } from '../src/engine/tribes';
import { advance } from '../src/engine/game';
import { tribeHome, tribeProfile } from '../src/engine/view';
import { createWorld, defaultConfig, spawnPlayer } from '../src/engine/world';

function world() {
  const w = createWorld({ worldName: 'T', playerName: '', villageName: '', multiplayer: true, seed: 3, config: { ...defaultConfig(), aiCount: 6, size: 60 } });
  const a = spawnPlayer(w, 'Alda', 'A')!;
  const b = spawnPlayer(w, 'Bram', 'B')!;
  const c = spawnPlayer(w, 'Cora', 'C')!;
  return { w, a, b, c };
}

describe('tribes', () => {
  it('found, invite, accept, rights, kick, leave and disband like Tribal Wars', () => {
    const { w, a, b, c } = world();
    const ok = (pid: number, act: Parameters<typeof applyAction>[2]) => {
      const r = applyAction(w, pid, act);
      if (!r.ok) throw new Error(`${act.type}: ${r.error}`);
      return r;
    };
    const tid = ok(a.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' }).data as number;
    expect(w.tribes[tid].founderId).toBe(a.id);
    expect(applyAction(w, b.id, { type: 'tribeCreate', name: 'Other', tag: 'irn' }).ok).toBe(false); // tags are unique

    // only people with the right may invite
    ok(a.id, { type: 'tribeInvite', name: 'Bram' });
    expect(tribeHome(w, b.id).invitations.map((i) => i.tag)).toEqual(['IRN']);
    ok(b.id, { type: 'tribeAccept', tribe: tid });
    expect(b.tribeId).toBe(tid);
    expect(applyAction(w, b.id, { type: 'tribeInvite', name: 'Cora' }).ok).toBe(false);
    ok(a.id, { type: 'tribeRights', pid: b.id, rights: ['invite', 'forum'] });
    expect(hasRight(w.tribes[tid], b.id, 'invite')).toBe(true);
    ok(b.id, { type: 'tribeInvite', name: 'Cora' });
    ok(c.id, { type: 'tribeDecline', tribe: tid });
    expect(tribeHome(w, c.id).invitations).toEqual([]);

    // tribe members cannot attack each other
    const bv = w.villages[b.villages[0]];
    w.villages[a.villages[0]].buildings.rally = 1;
    w.villages[a.villages[0]].units = { axe: 10 };
    a.protectedUntil = 0; b.protectedUntil = 0;
    expect(applyAction(w, a.id, { type: 'send', vid: a.villages[0], target: bv.id, kind: 'attack', units: { axe: 10 } }).ok).toBe(false);

    // diplomacy
    const other = ok(c.id, { type: 'tribeCreate', name: 'Ash Crows', tag: 'ASH' }).data as number;
    ok(a.id, { type: 'tribeDiplomacy', tribe: other, status: 'enemy' });
    expect(tribeHome(w, a.id).tribe!.relations[0].status).toBe('enemy');

    // forum
    const thread = ok(b.id, { type: 'forumThread', title: 'Plans', text: 'Hit the crows at dawn' }).data as number;
    ok(a.id, { type: 'forumReply', thread, text: 'Agreed' });
    expect(tribeHome(w, a.id).tribe!.forum[0].posts.length).toBe(2);

    // the founder leaves: the crown passes on, the tribe survives
    ok(a.id, { type: 'tribeLeave' });
    expect(a.tribeId).toBeNull();
    expect(w.tribes[tid].founderId).toBe(b.id);
    // last one out disbands it
    ok(b.id, { type: 'tribeLeave' });
    expect(w.tribes[tid]).toBeUndefined();
  });

  it('keeps tribe secrets out of the public map data', () => {
    const { w, a, b } = world();
    const tid = applyAction(w, a.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' }).data as number;
    applyAction(w, a.id, { type: 'tribeEdit', internal: 'Stash is at 12|40' });
    applyAction(w, a.id, { type: 'forumThread', title: 'Secret', text: 'shh' });
    applyAction(w, a.id, { type: 'tribeInvite', name: 'Bram' });
    const pub = publicSnapshot(w).world.tribes[tid];
    expect(pub.internal).toBe('');
    expect(pub.forum).toEqual([]);
    expect(pub.invites).toEqual([]);
    expect(pub.members).toEqual([a.id]);
    // the member gets it all; the invitee only learns of the invitation
    expect(privatePacket(w, a.id).tribe?.forum?.length).toBe(1);
    const pb = privatePacket(w, b.id);
    expect(pb.tribe).toBeUndefined();
    expect(pb.invitedBy.map((i) => i.tribeId)).toEqual([tid]);
  });
});

describe('recruiting', () => {
  it('a recruiting tribe takes requests to join; recruiters accept or decline; the rankings count new members', () => {
    const { w, a, b, c } = world();
    const ok = (pid: number, act: Parameters<typeof applyAction>[2]) => {
      const r = applyAction(w, pid, act);
      if (!r.ok) throw new Error(`${act.type}: ${r.error}`);
      return r;
    };
    const tid = ok(a.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' }).data as number;
    // a tribe founded by a person starts closed
    expect(w.tribes[tid].recruiting).toBe(false);
    expect(applyAction(w, b.id, { type: 'tribeApply', tribe: tid }).ok).toBe(false);
    ok(a.id, { type: 'tribeRecruiting', on: true });
    expect(tribeProfile(w, tid, b.id)!.canApply).toBe(true);
    ok(b.id, { type: 'tribeApply', tribe: tid });
    ok(c.id, { type: 'tribeApply', tribe: tid });
    expect(applyAction(w, b.id, { type: 'tribeApply', tribe: tid }).ok).toBe(false); // once is enough
    expect(tribeHome(w, b.id).requests.map((r) => r.tag)).toEqual(['IRN']);
    expect(tribeHome(w, a.id).tribe!.applications.map((x) => x.name).sort()).toEqual(['Bram', 'Cora']);
    // only recruiters answer
    ok(a.id, { type: 'tribeAnswer', pid: b.id, accept: true });
    expect(b.tribeId).toBe(tid);
    expect(applyAction(w, b.id, { type: 'tribeAnswer', pid: c.id, accept: true }).ok).toBe(false);
    expect(joinedThisWeek(w, w.tribes[tid])).toBe(1);
    // closing the doors turns the rest away, and they hear about it
    const before = c.reports.length;
    ok(a.id, { type: 'tribeRecruiting', on: false });
    expect(w.tribes[tid].applications).toEqual([]);
    expect(c.tribeId).toBeNull();
    expect(c.reports.length).toBe(before + 1);
    // a week later the new member no longer counts as new
    w.now += 8 * 24 * 3_600_000;
    expect(joinedThisWeek(w, w.tribes[tid])).toBe(0);
  });

  it('a request to join stays between the ruler and the tribe', () => {
    const { w, a, b, c } = world();
    const tid = applyAction(w, a.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' }).data as number;
    applyAction(w, a.id, { type: 'tribeRecruiting', on: true });
    applyAction(w, b.id, { type: 'tribeApply', tribe: tid });
    const pub = publicSnapshot(w).world;
    expect(pub.tribes[tid].applications).toEqual([]);
    expect(pub.tribes[tid].recruiting).toBe(true);
    // the applicant still sees their own request after the shadow merge; nobody else does
    const mine = mergeShadow(pub, privatePacket(w, b.id));
    expect(tribeProfile(mine, tid, b.id)!.applied).toBe(true);
    const theirs = mergeShadow(pub, privatePacket(w, c.id));
    expect(theirs.tribes[tid].applications).toEqual([]);
    // the recruiter sees it
    expect(privatePacket(w, a.id).tribe?.applications?.map((x) => x.pid)).toEqual([b.id]);
  });

  it('tribes led by AI rulers recruit and answer requests to join on their own', () => {
    const w = createWorld({ worldName: 'T', playerName: '', villageName: '', multiplayer: true, seed: 8, config: { ...defaultConfig(), aiCount: 14, size: 80, aiAlwaysAwake: true } });
    const me = spawnPlayer(w, 'Dara', 'D')!;
    const aiTribes = Object.values(w.tribes).filter((t) => w.players[t.founderId!]?.kind === 'ai');
    expect(aiTribes.length).toBeGreaterThan(0);
    // an AI tribe is open to newcomers
    const t = aiTribes.sort((x, y) => x.members.length - y.members.length)[0];
    t.recruiting = true;
    // a ruler of some standing, on the realm's very first day
    me.points = Math.max(...t.members.map((m) => w.players[m].points));
    expect(applyAction(w, me.id, { type: 'tribeApply', tribe: t.id }).ok).toBe(true);
    // its recruiters read the request and take them in within a few hours
    advance(w, w.now + 6 * 3_600_000);
    expect(t.applications?.some((x) => x.pid === me.id) ?? false).toBe(false);
    expect(me.tribeId).toBe(t.id);
    // and AI tribes keep taking members in over the days
    advance(w, w.now + 2 * 24 * 3_600_000);
    const joined = Object.values(w.tribes).reduce((n, x) => n + joinedThisWeek(w, x), 0);
    expect(joined).toBeGreaterThan(0);
  }, 30_000);
});

describe('tribe housekeeping', () => {
  it('a founder who loses their last village leaves the tribe and the crown passes on', async () => {
    const { conquer } = await import('../src/engine/commands');
    const { w, a, b, c } = world();
    const tid = applyAction(w, a.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' }).data as number;
    applyAction(w, a.id, { type: 'tribeInvite', name: 'Bram' });
    applyAction(w, b.id, { type: 'tribeAccept', tribe: tid });
    // Cora conquers Alda's only village (the game's conquest hook then drops Alda from the tribe)
    conquer(w, w.villages[a.villages[0]], c.id);
    expect(a.eliminated).toBe(true);
    const { dropFromTribe } = await import('../src/engine/tribes');
    dropFromTribe(w, a.id);
    expect(a.tribeId).toBeNull();
    expect(w.tribes[tid].members).toEqual([b.id]);
    expect(w.tribes[tid].founderId).toBe(b.id);
  });

  it('accepting a request into a full tribe keeps the request for later', async () => {
    const { TRIBE_MAX_MEMBERS } = await import('../src/engine/tribes');
    const { w, a, b } = world();
    const tid = applyAction(w, a.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' }).data as number;
    applyAction(w, a.id, { type: 'tribeRecruiting', on: true });
    applyAction(w, b.id, { type: 'tribeApply', tribe: tid });
    const t = w.tribes[tid];
    t.members = [...t.members, ...Array.from({ length: TRIBE_MAX_MEMBERS - 1 }, (_, i) => 90_000 + i)];
    expect(applyAction(w, a.id, { type: 'tribeAnswer', pid: b.id, accept: true }).ok).toBe(false);
    expect(t.applications?.map((x) => x.pid)).toEqual([b.id]);
    expect(b.tribeId).toBeNull();
  });
});

describe('sharing reports in the tribe forum', () => {
  it('posts a frozen copy of a report, in a new thread or an old one', () => {
    const w = createWorld({ worldName: 'T', playerName: '', villageName: '', multiplayer: true, seed: 5, config: { ...defaultConfig(), aiCount: 2, size: 60 } });
    const a = spawnPlayer(w, 'Alda', 'A')!;
    const b = spawnPlayer(w, 'Bram', 'B')!;
    expect(applyAction(w, a.id, { type: 'tribeCreate', name: 'Hearth Wardens', tag: 'HWD' }).ok).toBe(true);
    applyAction(w, a.id, { type: 'tribeInvite', name: 'Bram' });
    applyAction(w, b.id, { type: 'tribeAccept', tribe: a.tribeId! });
    a.reports.unshift({ id: 999, t: w.now, kind: 'attack', title: 'A attacks Barbarian village', color: 'green', read: true, battle: undefined, text: 'Easy pickings.' });
    const r1 = applyAction(w, a.id, { type: 'forumThread', title: 'Look at this', text: '', report: 999 });
    expect(r1.ok).toBe(true);
    const th = w.tribes[a.tribeId!].forum![0];
    expect(th.posts[0].report?.title).toBe('A attacks Barbarian village');
    // the copy stays even when the report is deleted
    applyAction(w, a.id, { type: 'deleteReport', id: 999 });
    expect(th.posts[0].report?.text).toBe('Easy pickings.');
    // someone else's report cannot be shared
    expect(applyAction(w, b.id, { type: 'forumReply', thread: th.id, text: 'nice', report: 999 }).ok).toBe(false);
    b.reports.unshift({ id: 1000, t: w.now, kind: 'defense', title: 'Held the wall', color: 'green', read: true });
    expect(applyAction(w, b.id, { type: 'forumReply', thread: th.id, text: '', report: 1000 }).ok).toBe(true);
    expect(th.posts[1].report?.title).toBe('Held the wall');
    // and the tribe mates see it
    expect(tribeHome(w, b.id).tribe!.forum[0].posts.length).toBe(2);
  });
});

describe('tribes merging', () => {
  it('a small tribe folds into a bigger one: everyone moves over, the old name is gone', async () => {
    const { mergeTribes } = await import('../src/engine/tribes');
    const { w, a, b, c } = world();
    const big = applyAction(w, a.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' }).data as number;
    applyAction(w, a.id, { type: 'tribeInvite', name: 'Bram' });
    applyAction(w, b.id, { type: 'tribeAccept', tribe: big });
    const small = applyAction(w, c.id, { type: 'tribeCreate', name: 'Ash Crowns', tag: 'ASH' }).data as number;
    expect(mergeTribes(w, small, big)).toBe(true);
    expect(w.tribes[small]).toBeUndefined();
    expect(w.tribes[big].members).toEqual(expect.arrayContaining([a.id, b.id, c.id]));
    expect(c.tribeId).toBe(big);
    expect(w.news[0].text).toContain('has joined');
  });
});

describe('tribes answering attacks', () => {
  it('when a person attacks a ruler in a tribe, a tribe mate answers: scouts, support or a strike back', async () => {
    const { advance } = await import('../src/engine/game');
    const { conquer } = await import('../src/engine/commands');
    const w = createWorld({ worldName: 'T', playerName: 'P', villageName: 'Home', seed: 11, config: { ...defaultConfig(), aiCount: 8, size: 70, aiAlwaysAwake: true, difficulty: 'hard' } });
    const me = w.players[w.humanId];
    me.protectedUntil = 0;
    const home = w.villages[me.villages[0]];
    Object.assign(home.buildings, { rally: 1, barracks: 10, farm: 25, wall: 5 });
    home.units = { axe: 3000, spear: 500, scout: 20 };
    // two rulers in one tribe, both near us and ready for anything
    const ais = Object.values(w.players).filter((p) => p.kind === 'ai')
      .sort((a, b) => Math.hypot(w.villages[a.villages[0]].x - home.x, w.villages[a.villages[0]].y - home.y) - Math.hypot(w.villages[b.villages[0]].x - home.x, w.villages[b.villages[0]].y - home.y));
    const [victim, mate] = ais;
    for (const p of [victim, mate]) { if (p.tribeId !== null) applyAction(w, p.id, { type: 'tribeLeave' }); p.tribeId = null; }
    const tid = applyAction(w, victim.id, { type: 'tribeCreate', name: 'Test Oath', tag: 'TST' }).data as number;
    applyAction(w, victim.id, { type: 'tribeInvite', name: mate.name });
    applyAction(w, mate.id, { type: 'tribeAccept', tribe: tid });
    for (const p of [victim, mate]) {
      p.ai!.hostile = true;
      const v = w.villages[p.villages[0]];
      Object.assign(v.buildings, { rally: 1, barracks: 10, stable: 5, farm: 25 });
      v.units = { spear: 800, sword: 600, axe: 1500, light: 400, scout: 60 };
    }
    const target = w.villages[victim.villages[0]];
    expect(applyAction(w, me.id, { type: 'send', vid: home.id, target: target.id, kind: 'attack', units: { axe: 2500 } }).ok).toBe(true);
    let answered = false;
    for (let i = 0; i < 240 && !answered; i++) {
      advance(w, w.now + 60_000);
      answered = Object.values(w.commands).some((c) => c.ownerId === mate.id && (me.villages.includes(c.toVid) || (c.kind === 'support' && c.toVid === target.id)))
        || Object.values(w.villages).some((v) => v.support.some((s) => s.ownerId === mate.id));
    }
    expect(answered).toBe(true);
  });
});
