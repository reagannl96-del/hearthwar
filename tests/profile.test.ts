import { describe, expect, it } from 'vitest';
import { applyAction, type Action } from '../src/engine/actions';
import { mergeShadow, privatePacket, publicSnapshot } from '../src/engine/shadow';
import { TRIBE_MAX_MEMBERS, tribePoints } from '../src/engine/tribes';
import type { World } from '../src/engine/types';
import { playerProfile, tribeProfile } from '../src/engine/view';
import { createWorld, defaultConfig, spawnPlayer } from '../src/engine/world';

function world() {
  const w = createWorld({ worldName: 'T', playerName: '', villageName: '', multiplayer: true, seed: 5, config: { ...defaultConfig(), aiCount: 6, size: 60 } });
  const a = spawnPlayer(w, 'Alda', 'A')!;
  const b = spawnPlayer(w, 'Bram', 'B')!;
  const c = spawnPlayer(w, 'Cora', 'C')!;
  const d = spawnPlayer(w, 'Dunn', 'D')!;
  const ok = (pid: number, act: Action) => {
    const r = applyAction(w, pid, act);
    if (!r.ok) throw new Error(`${act.type}: ${r.error}`);
    return r;
  };
  return { w, a, b, c, d, ok };
}

const tribeRanking = (w: World) => Object.values(w.tribes).sort((x, y) => tribePoints(w, y) - tribePoints(w, x)).map((t) => t.id);

describe('player profile', () => {
  it('shows standing, ranks, the banner and a tribe summary without the tribe\'s secrets', () => {
    const { w, a, b, ok } = world();
    const tid = ok(a.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' }).data as number;
    ok(a.id, { type: 'tribeEdit', internal: 'secret orders' });
    ok(a.id, { type: 'setFlag', flag: { shape: 2, pattern: 3, charge: 4, field: 1, accent: 2, chargeColor: 3 } });
    a.stats.killsAtt = 500;
    b.stats.killsAtt = 900;
    const p = playerProfile(w, a.id, b.id)!;
    expect(p.tribe).toMatchObject({ id: tid, tag: 'IRN', role: 'founder', members: 1 });
    expect(p.tribe!.rank).toBe(tribeRanking(w).indexOf(tid) + 1);
    expect(p.tribe).not.toHaveProperty('internal');
    expect(p.flag).toEqual({ shape: 2, pattern: 3, charge: 4, field: 1, accent: 2, chargeColor: 3 });
    expect(p.odaRank).toBe(2);
    expect(p.oddRank).toBeNull(); // defeated nobody in defence
    expect(p.rank).toBeGreaterThan(0);
    expect(p.rulers).toBe(Object.values(w.players).filter((x) => !x.eliminated).length);
    expect(p.joinedAt).toBe(a.createdAt);
    expect(p.villages[0]).toMatchObject({ id: a.villages[0], theme: 'classic' });
    // no viewer: no actions worked out
    expect(playerProfile(w, a.id)!.you).toBeNull();
  });

  it('offers invite, kick, rights and diplomacy only as the tribe rules allow them', () => {
    const { w, a, b, c, d, ok } = world();
    const iron = ok(a.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' }).data as number;
    ok(a.id, { type: 'tribeInvite', name: 'Bram' });
    ok(b.id, { type: 'tribeAccept', tribe: iron });
    const ash = ok(c.id, { type: 'tribeCreate', name: 'Ash Crows', tag: 'ASH' }).data as number;
    const you = (target: number, viewer: number) => playerProfile(w, target, viewer)!.you!;

    // your own profile: nothing to do to yourself
    expect(you(a.id, a.id)).toMatchObject({ self: true, invite: null, kick: null, rights: null, diplomacy: null, relation: 'own' });

    // the founder looking at a tribe mate: may remove them and change their rights, not attack them
    const mate = you(b.id, a.id);
    expect(mate.relation).toBe('own');
    expect(mate.kick).toEqual({ ok: true });
    expect(mate.rights).toMatchObject({ ok: true, current: [], grantable: ['lead', 'invite', 'diplomacy', 'forum', 'internal'] });
    expect(mate.attack).toEqual({ ok: false, reason: 'You cannot attack a member of your own tribe.' });
    expect(mate.invite).toBeNull();

    // a plain member sees no management at all, and nobody can remove the founder
    expect(you(a.id, b.id)).toMatchObject({ kick: null, rights: null });
    ok(a.id, { type: 'tribeRights', pid: b.id, rights: ['invite'] });
    expect(you(a.id, b.id).kick).toEqual({ ok: false, reason: 'The founder cannot be removed.' });
    expect(you(a.id, b.id).rights).toBeNull(); // a recruiter, not a leader

    // someone in another tribe: invite (they'd have to leave), diplomacy for the founder
    const other = you(c.id, a.id);
    expect(other.invite).toMatchObject({ state: 'can', note: expect.stringContaining('[ASH]') });
    expect(other.diplomacy).toEqual({ ok: true, current: null });
    ok(a.id, { type: 'tribeDiplomacy', tribe: ash, status: 'enemy' });
    expect(you(c.id, a.id)).toMatchObject({ relation: 'enemy', diplomacy: { ok: true, current: 'enemy' } });
    // a recruiter without the diplomacy right sees the relation but can't change it
    expect(you(c.id, b.id)).toMatchObject({ relation: 'enemy', diplomacy: null, invite: { state: 'can' } });

    // invited: shown as such (recruiters may withdraw it)
    ok(a.id, { type: 'tribeInvite', name: 'Dunn' });
    expect(you(d.id, a.id).invite).toEqual({ state: 'invited', mayWithdraw: true });
    ok(a.id, { type: 'tribeRights', pid: b.id, rights: [] });
    expect(you(d.id, b.id).invite).toEqual({ state: 'invited', mayWithdraw: false });
    // no right to invite: greyed out with the reason
    expect(you(c.id, b.id).invite).toMatchObject({ state: 'blocked', reason: expect.stringContaining('recruiters') });
    // the viewer has no tribe: nothing to invite them to
    expect(you(a.id, d.id)).toMatchObject({ invite: null, kick: null, relation: null, myTribe: null });

    // a request to join is answered, not met with an invitation
    ok(d.id, { type: 'tribeDecline', tribe: iron });
    w.tribes[iron].recruiting = true;
    ok(d.id, { type: 'tribeApply', tribe: iron });
    expect(you(d.id, a.id).invite).toEqual({ state: 'applied', mayWithdraw: false });
  });

  it('a leader who is not the founder can neither remove nor re-rank another leader', () => {
    const { w, a, b, c, ok } = world();
    const iron = ok(a.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' }).data as number;
    for (const [pid, name] of [[b.id, 'Bram'], [c.id, 'Cora']] as const) {
      ok(a.id, { type: 'tribeInvite', name });
      ok(pid, { type: 'tribeAccept', tribe: iron });
    }
    ok(a.id, { type: 'tribeRights', pid: b.id, rights: ['lead'] });
    ok(a.id, { type: 'tribeRights', pid: c.id, rights: ['lead'] });
    const p = playerProfile(w, c.id, b.id)!.you!;
    expect(p.kick).toEqual({ ok: false, reason: 'Only the founder can remove a leader.' });
    expect(p.rights).toMatchObject({ ok: false, grantable: ['invite', 'diplomacy', 'forum', 'internal'] });
    // and the engine agrees
    expect(applyAction(w, b.id, { type: 'tribeKick', pid: c.id }).ok).toBe(false);
    // the founder may do both
    expect(playerProfile(w, c.id, a.id)!.you!.kick).toEqual({ ok: true });
  });

  it('a full tribe cannot invite, and an invitation that is allowed really goes through', () => {
    const { w, a, c, d, ok } = world();
    const iron = ok(a.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' }).data as number;
    const t = w.tribes[iron];
    // fill the seats with pretend members
    const others = Object.values(w.players).filter((p) => p.id !== a.id && p.id !== c.id && p.id !== d.id);
    t.invites = others.slice(0, TRIBE_MAX_MEMBERS - 1).map((p) => ({ pid: p.id, by: a.id, t: w.now }));
    while (t.members.length + t.invites.length < TRIBE_MAX_MEMBERS) t.invites.push({ pid: 10_000 + t.invites.length, by: a.id, t: w.now });
    expect(playerProfile(w, c.id, a.id)!.you!.invite).toMatchObject({ state: 'blocked', reason: expect.stringContaining('full') });
    expect(applyAction(w, a.id, { type: 'tribeInvite', name: 'Cora' }).ok).toBe(false);
    t.invites = [];
    expect(playerProfile(w, c.id, a.id)!.you!.invite!.state).toBe('can');
    ok(a.id, { type: 'tribeInvite', name: 'Cora' });
    expect(playerProfile(w, c.id, a.id)!.you!.invite!.state).toBe('invited');
  });

  it('beginner protection greys out attacking', () => {
    const { w, a, c } = world();
    c.protectedUntil = w.now + 3_600_000;
    expect(playerProfile(w, c.id, a.id)!.you!.attack).toEqual({ ok: false, reason: 'Cora is still under beginner protection.' });
    c.protectedUntil = 0;
    expect(playerProfile(w, c.id, a.id)!.you!.attack).toEqual({ ok: true });
  });

  it('works the same from an online client\'s fog-of-war shadow world', () => {
    const { w, a, b, c, ok } = world();
    const iron = ok(a.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' }).data as number;
    ok(a.id, { type: 'tribeInvite', name: 'Bram' });
    ok(b.id, { type: 'tribeAccept', tribe: iron });
    ok(a.id, { type: 'tribeInvite', name: 'Cora' });
    const shadow = mergeShadow(publicSnapshot(w).world, privatePacket(w, a.id));
    expect(playerProfile(shadow, b.id, a.id)!.you).toMatchObject({ kick: { ok: true }, rights: { ok: true } });
    expect(playerProfile(shadow, c.id, a.id)!.you!.invite).toEqual({ state: 'invited', mayWithdraw: true });
    // another client doesn't learn Iron Oath's invitations or rights to hand out
    const theirs = mergeShadow(publicSnapshot(w).world, privatePacket(w, c.id));
    expect(playerProfile(theirs, a.id, c.id)!.you).toMatchObject({ invite: null, kick: null, rights: null });
  });
});

describe('tribe profile', () => {
  it('lists members with their banners and tells a diplomat they may set a relation', () => {
    const { w, a, b, c, ok } = world();
    const iron = ok(a.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' }).data as number;
    const ash = ok(c.id, { type: 'tribeCreate', name: 'Ash Crows', tag: 'ASH' }).data as number;
    ok(c.id, { type: 'setFlag', flag: { shape: 1, pattern: 1, charge: 1, field: 1, accent: 1, chargeColor: 2 } });
    const t = tribeProfile(w, ash, a.id)!;
    expect(t.members[0].flag).toMatchObject({ shape: 1 });
    expect(t.canDiplomacy).toBe(true);
    expect(tribeProfile(w, iron, a.id)!.canDiplomacy).toBe(false); // your own tribe
    expect(tribeProfile(w, ash, b.id)!.canDiplomacy).toBe(false); // no tribe
  });
});
