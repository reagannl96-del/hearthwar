import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/actions';
import { privatePacket, publicSnapshot } from '../src/engine/shadow';
import { hasRight } from '../src/engine/tribes';
import { tribeHome } from '../src/engine/view';
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
