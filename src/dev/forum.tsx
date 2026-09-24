// Dev sandbox for the tribe forum, BBCode and copy buttons: /dev/forum.html
//
// Runs the real game UI on a throwaway world held only in memory. It never saves,
// never touches the resume slot, and forgets everything on reload, so the realms
// in this browser are left alone.

import '@fontsource/grenze-gotisch/latin-600.css';
import '@fontsource/grenze-gotisch/latin-800.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-500.css';
import '@fontsource/alegreya-sans/latin-700.css';
import '../ui/styles.css';
import { render } from 'preact';
import { applyAction, type Action } from '../engine/actions';
import type { ActionResult, World } from '../engine/types';
import { createWorld, defaultConfig, inRealm, isDesert, isJungle, spawnPlayer } from '../engine/world';
import { fractalNoise } from '../engine/rng';
import { setupHeroes } from './heroSandbox';
import { HostBase } from '../host/base';
import { App } from '../ui/App';
import { go, host, now, vid, view } from '../ui/store';

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

// ?size=180 makes the realm bigger (?seed=16 another one); ?legacy lays the old terrain (from before the desert and the
// jungle had their own) over those wilds, as a realm created back then still has it; ?map=x|y opens the map there
const q = new URLSearchParams(location.search);
const w = createWorld({ worldName: 'Sandbox', playerName: '', villageName: '', multiplayer: true, seed: Number(q.get('seed')) || 7, config: { ...defaultConfig(), aiCount: 8, size: Number(q.get('size')) || 80 } });
if (q.has('legacy')) {
  const n = w.config.size, taken = new Set(Object.values(w.villages).map((v) => v.y * n + v.x));
  const t = w.terrain.split('');
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x;
    if (!inRealm(x, y, n) || taken.has(i) || !(isDesert(x, y, n) || isJungle(x, y, n))) continue;
    const e = fractalNoise(x, y, w.seed, 22), m = fractalNoise(x, y, w.seed + 101, 14);
    t[i] = e < 0.26 ? 'w' : e > 0.76 ? 'm' : m > 0.6 ? 'f' : '.';
  }
  w.terrain = t.join('');
}
const me = spawnPlayer(w, 'Alda', 'Alda\'s Hold')!;
const bram = spawnPlayer(w, 'Bram', 'Bramble')!;
const cora = spawnPlayer(w, 'Cora', 'Cora\'s Keep')!;
const as = (pid: number, a: Action) => { const r = applyAction(w, pid, a); if (!r.ok) console.warn(a.type, r.error); return r; };
as(me.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' });
as(me.id, { type: 'tribeInvite', name: 'Bram' });
as(bram.id, { type: 'tribeAccept', tribe: me.tribeId! });
as(cora.id, { type: 'tribeCreate', name: 'Crows', tag: 'CRW' });
const bv = w.villages[bram.villages[0]], cv = w.villages[cora.villages[0]];
as(me.id, {
  type: 'tribeEdit',
  description: '[center][size=large][b]The Iron Oath[/b][/size]\nWe hold the north-west.[/center]\nRecruiting [color=green]active[/color] rulers. Ask [player]Alda[/player].',
  internal: `[b]Orders:[/b] everyone send support to ${bv.x}|${bv.y} by nightfall.\n[spoiler=Next target]Crows at ${cv.x}|${cv.y}[/spoiler]`,
});
const t1 = as(bram.id, {
  type: 'forumThread', title: 'War plans against [CRW]',
  text: `[b]Target:[/b] [coord]${cv.x}|${cv.y}[/coord] ([player]Cora[/player] of [tribe]CRW[/tribe])\n\n[quote=Cora]You'll never take my keep[/quote]\nWe will. Timings:\n[list]\n[*]Nukes land [u]06:00[/u]\n[*]Nobles [color=#b8392b]06:00:01[/color]\n[*]Fakes on 1|1 and 2|2\n[/list]\n[spoiler=Full plan]Send everything from 12|40.\n[code]axe 3000, light 1200, ram 200[/code][/spoiler]\n[hr]\nSee https://example.com/guide. Broken: [b]unclosed and [url=javascript:alert(1)]bad[/url]`,
}).data as number;
as(me.id, { type: 'forumReply', thread: t1, text: `[quote=Bram]Nukes land 06:00[/quote]\nI'll be there. [size=small]small print[/size] [s]old idea[/s] [i]italic[/i]\nAlso read [thread=${t1}]this very thread[/thread].` });
as(bram.id, { type: 'forumThread', title: 'Welcome, new members', text: 'Read the [b]rules[/b] first. Farm barbarians near your home and post your coordinates here.' });
// ?heroes: villages in every wild land, battles fought by the heroes of the wilds, and a hidden attack on the road
if (q.has('heroes')) setupHeroes(w, me.id, cora.id);

const h = new SandboxHost(w, me.id);
host.value = h;
view.value = h.view();
now.value = h.now;
vid.value = view.value.villages[0].id;
h.subscribe(() => { view.value = h.view(); });

render(<App />, document.getElementById('app')!);
const at = q.get('map')?.split('|').map(Number);
if (at && at.length === 2 && at.every(Number.isFinite)) go({ name: 'map', at: [at[0], at[1]] });
