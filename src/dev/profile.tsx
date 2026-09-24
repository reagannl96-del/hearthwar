// Dev sandbox for rulers' and tribes' profiles: /dev/profile.html
//
// Runs the real game UI on a throwaway world held only in memory. It never saves,
// never touches the resume slot, and forgets everything on reload, so the realms
// in this browser are left alone.
//
//   ?as=alda|bram|cora|dunn|esme   whose eyes to look through (default Alda, a tribe founder)
//   ?p=alda|bram|cora|dunn|esme|ai open that ruler's profile (ai: the strongest computer ruler)
//   ?t=irn|crw                     open that tribe's page instead

import '@fontsource/grenze-gotisch/latin-600.css';
import '@fontsource/grenze-gotisch/latin-800.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-500.css';
import '@fontsource/alegreya-sans/latin-700.css';
import '../ui/styles.css';
import { render } from 'preact';
import { applyAction, type Action } from '../engine/actions';
import { dayOf } from '../engine/awards';
import type { ActionResult, Player, UnitId, World } from '../engine/types';
import { createWorld, defaultConfig, spawnPlayer } from '../engine/world';
import { HostBase } from '../host/base';
import { App } from '../ui/App';
import { host, now, route, split, vid, view } from '../ui/store';

class SandboxHost extends HostBase {
  constructor(w: World, pid: number) { super(w, pid); this.multiplayer = true; }
  tick(): void { /* time stands still in the sandbox */ }
  act(a: Action): ActionResult {
    const r = applyAction(this.world, this.pid, a);
    this.invalidate();
    this.emit();
    return r;
  }
  respawn(): boolean { return false; }
  async save(): Promise<void> { /* never saved */ }
}

const w = createWorld({ worldName: 'Sandbox', playerName: '', villageName: '', multiplayer: true, seed: 11, config: { ...defaultConfig(), aiCount: 10, size: 90 } });
const alda = spawnPlayer(w, 'Alda', 'Alda\'s Hold')!;
const bram = spawnPlayer(w, 'Bram', 'Bramble')!;
const cora = spawnPlayer(w, 'Cora Ravenswood', 'Cora\'s Keep')!;
const dunn = spawnPlayer(w, 'Dunn', 'Dunmoor')!;
const esme = spawnPlayer(w, 'Esme', 'Esmeholt')!;
const as = (pid: number, a: Action) => { const r = applyAction(w, pid, a); if (!r.ok) console.warn(a.type, r.error); return r; };

// Iron Oath: Alda founds it, Bram joins as a plain member, Esme as a leader
const irn = as(alda.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' }).data as number;
for (const p of [bram, esme]) { as(alda.id, { type: 'tribeInvite', name: p.name }); as(p.id, { type: 'tribeAccept', tribe: irn }); }
as(alda.id, { type: 'tribeRights', pid: esme.id, rights: ['lead'] });
as(alda.id, { type: 'tribeEdit', description: '[b]The Iron Oath[/b] holds the north-west. Recruiting active rulers: ask [player]Alda[/player].' });
as(alda.id, { type: 'tribeRecruiting', on: true });
// the Crows: Cora's tribe, at war with the Oath
const crw = as(cora.id, { type: 'tribeCreate', name: 'Ash Crows', tag: 'CRW' }).data as number;
as(alda.id, { type: 'tribeDiplomacy', tribe: crw, status: 'enemy' });
as(cora.id, { type: 'tribeDiplomacy', tribe: irn, status: 'enemy' });
as(cora.id, { type: 'tribeEdit', description: 'We fly black. [i]Nevermore.[/i]' });
// Dunn has no tribe and asks to join the Oath
as(dunn.id, { type: 'tribeApply', tribe: irn });

// banners: Alda and Cora made their own; the others fly the default
as(alda.id, { type: 'setFlag', flag: { shape: 1, pattern: 3, charge: 7, field: 2, accent: 0, chargeColor: 5 } });
as(cora.id, { type: 'setFlag', flag: { shape: 6, pattern: 5, charge: 9, field: 7, accent: 3, chargeColor: 1 } });

// Cora is a big ruler: a dozen villages (some sworn to heroes), a long history, fights won and awards
const barbs = Object.values(w.villages).filter((v) => v.ownerId === null).slice(0, 13);
const heroes: UnitId[] = ['sorcerer', 'sorcerer', 'necromancer', 'druid', 'goblin'];
barbs.forEach((v, i) => {
  v.ownerId = cora.id;
  cora.villages.push(v.id);
  v.points = 300 + ((i * 977) % 9000);
  if (heroes[i]) v.heroKind = heroes[i];
  v.name = ['Rookery', 'Blackwater', 'Gallows Hill', 'Ashford', 'Crowmere', 'Thornby', 'Nightfall', 'Cinderfen', 'Ravenmoor', 'Hollow End', 'Grimsby', 'Duskhold', 'Wraithwood'][i];
});
const total = (p: Player) => p.villages.reduce((s, id) => s + w.villages[id].points, 0);
cora.points = total(cora);
cora.stats = { ...cora.stats, killsAtt: 48_210, killsDef: 9_730, killsSup: 1_240, conquered: 13, loot: 1_845_000, attacks: 640, scouted: 71, recruited: 22_000 };
const hist = (p: Player, from: number, to: number) => {
  p.history = [];
  for (let i = 0; i <= 40; i++) {
    const f = i / 40;
    p.history.push([w.now - (40 - i) * 4 * 3_600_000, Math.round(from + (to - from) * f * f)]);
  }
};
hist(cora, 200, cora.points);
hist(alda, 150, alda.points + 1000);
alda.points += 1000;
const today = dayOf(w);
cora.dailyAwards = [
  { kind: 'attacker', day: today - 1, score: 6_120, runnerUp: 2_380 },
  { kind: 'attacker', day: today - 3, score: 4_870, runnerUp: 4_100 },
  { kind: 'conqueror', day: today - 2, score: 3, runnerUp: 1 },
  { kind: 'looter', day: today - 4, score: 98_000, runnerUp: 61_000 },
];
alda.stats = { ...alda.stats, killsAtt: 1_900, killsDef: 7_400, loot: 42_000, conquered: 1 };
// beginner protection: Dunn still has it, Cora is fair game
dunn.protectedUntil = w.now + 5 * 3_600_000;
cora.protectedUntil = 0;
w.mapRev++;

const q = new URLSearchParams(location.search);
const byName: Record<string, Player> = { alda, bram, cora, dunn, esme };
const viewer = byName[q.get('as') ?? 'alda'] ?? alda;
const strongestAi = Object.values(w.players).filter((p) => p.kind === 'ai').sort((a, b) => b.points - a.points)[0];

const h = new SandboxHost(w, viewer.id);
host.value = h;
view.value = h.view();
now.value = h.now;
vid.value = view.value.villages[0].id;
h.subscribe(() => { view.value = h.view(); });
// one pane unless asked (?split=1); set in memory only, so this browser's own split-screen setting is left alone
split.value = q.get('split') === '1';
const pq = q.get('p'), tq = q.get('t');
if (tq) route.value = { name: 'tribe', id: tq === 'crw' ? crw : irn };
else route.value = { name: 'ranking', player: pq === 'ai' ? strongestAi.id : (byName[pq ?? 'cora'] ?? cora).id };

render(<App />, document.getElementById('app')!);
