// AI conquest benchmark: plays a standard realm forward and logs every village an
// AI takes, how its campaigns go (noble waves per conquest, give-ups), the heroes
// it raises, the help it sends tribe mates and the fakes it throws, and what
// happens to a few human rulers (some idle and small, some built up and defended).
//
//   npx vite build --ssr scripts/conquestbench.ts --outDir .bench --emptyOutDir && node .bench/conquestbench.js [days] [seed] [ais]

import { advance } from '../src/engine/game';
import { campaignVerdict } from '../src/engine/ai/ai';
import { distance } from '../src/engine/formulas';
import { HEROES } from '../src/engine/data/units';
import { villagePoints } from '../src/engine/formulas';
import { createWorld, defaultConfig, reinforceRulers, spawnPlayer } from '../src/engine/world';
import type { Player, UnitId, World } from '../src/engine/types';

const days = Number(process.argv[2] || 10);
const seed = Number(process.argv[3] || 7);
const aiCount = Number(process.argv[4] || 30);
const quiet = process.argv.includes('--quiet');

const w: World = createWorld({
  worldName: 'Bench', playerName: 'Human', villageName: 'Home', seed,
  config: { ...defaultConfig(), size: Number(process.env.SIZE || 150), aiCount, difficulty: 'normal' },
});
// humans like the ones on the live server: some left small and idle, some built up with a wall and defenders
for (let i = 0; i < 6; i++) spawnPlayer(w, 'Human ' + (i + 1), 'Hold ' + (i + 1));
const humans = Object.values(w.players).filter((p) => p.kind === 'human');
humans.forEach((p, i) => {
  const strong = i % 2 === 1;
  for (const vid of p.villages) {
    const v = w.villages[vid];
    Object.assign(v.buildings, strong
      ? { main: 15, barracks: 10, stable: 5, smithy: 8, rally: 1, farm: 18, warehouse: 15, wall: 10, timber: 16, claypit: 16, ironmine: 14, market: 3, hiding: 3 }
      : { main: 6, barracks: 3, rally: 1, farm: 6, warehouse: 6, wall: 1, timber: 8, claypit: 8, ironmine: 6 });
    v.units = strong ? { spear: 900, sword: 600, archer: 200, scout: 40 } : { spear: 40, sword: 10 };
    v.points = villagePoints(v.buildings);
    p.points = v.points;
  }
});
const ais = (): Player[] => Object.values(w.players).filter((p) => p.kind === 'ai');
const owner = new Map<number, number | null>(Object.values(w.villages).map((v) => [v.id, v.ownerId]));
const start = w.now;
const seenCmd = new Set<number>();
const tally = { trains: 0, fakes: 0, help: 0, scouts: 0, war: 0 };
const taken = { barb: 0, ai: 0, human: 0 };
const humanHits: Record<string, { attacks: number; nobles: number; fakes: number; lost: number }> = {};
const campaignLog = new Map<number, { since: number; waves: number }>();
const finished = { taken: 0, given: 0, wavesToTake: [] as number[] };

const reinforceDay = Number(process.env.REINFORCE_DAY || 0), reinforceTo = Number(process.env.REINFORCE_TO || 0);
const newcomers = new Set<number>();
for (let h = 1; h <= days * 24; h++) {
  if (reinforceDay && h === reinforceDay * 24) {
    const before = new Set(Object.keys(w.players).map(Number));
    console.log(`== day ${reinforceDay}: ${reinforceRulers(w, reinforceTo)} rulers arrive`);
    for (const id of Object.keys(w.players).map(Number)) if (!before.has(id)) newcomers.add(id);
  }
  // step in 5-minute slices so campaigns are watched closely
  for (let k = 1; k <= 12; k++) {
    advance(w, start + (h - 1) * 3_600_000 + k * 300_000);
    for (const p of ais()) {
      const c = p.ai!.campaign;
      const prev = campaignLog.get(p.id);
      if (c && (!prev || prev.since !== c.since)) campaignLog.set(p.id, { since: c.since, waves: c.waves });
      else if (c && prev) prev.waves = c.waves;
      else if (!c && prev) {
        campaignLog.delete(p.id);
      }
    }
  }
  for (const c of Object.values(w.commands)) {
    if (seenCmd.has(c.id)) continue;
    seenCmd.add(c.id);
    const from = w.players[c.ownerId];
    if (from?.kind !== 'ai') continue;
    if (c.tag === 'train' && (c.units.noble ?? 0) > 0) tally.trains++;
    if (c.tag === 'fake') tally.fakes++;
    if (c.tag === 'help') tally.help++;
    if (c.tag === 'scout') tally.scouts++;
    if (c.tag === 'war') tally.war++;
    const to = w.villages[c.toVid];
    const victim = to?.ownerId != null ? w.players[to.ownerId] : undefined;
    if (c.kind === 'attack' && victim?.kind === 'human') {
      const hh = (humanHits[victim.name] ??= { attacks: 0, nobles: 0, fakes: 0, lost: 0 });
      if (c.tag === 'fake') hh.fakes++;
      else hh.attacks++;
      if ((c.units.noble ?? 0) > 0) hh.nobles++;
    }
  }
  for (const v of Object.values(w.villages)) {
    const was = owner.get(v.id);
    if (was !== v.ownerId) {
      const by = v.ownerId !== null ? w.players[v.ownerId] : undefined;
      const prev = was === null || was === undefined ? undefined : w.players[was];
      if (by) {
        if (!prev) taken.barb++;
        else if (prev.kind === 'ai') taken.ai++;
        else { taken.human++; (humanHits[prev.name] ??= { attacks: 0, nobles: 0, fakes: 0, lost: 0 }).lost++; }
        if (!quiet || prev?.kind === 'human') console.log(`day ${(h / 24).toFixed(2)}: ${by.name} (${by.ai?.personality ?? by.kind}) took ${v.name} (${v.points} pts) from ${prev ? `${prev.name} (${prev.kind})` : 'barbarians'}`);
      }
      owner.set(v.id, v.ownerId);
    }
  }
  if (h % 24 === 0) {
    const list = ais();
    const nob = list.reduce((a, p) => a + p.villages.reduce((b, id) => b + (w.villages[id]?.units.noble ?? 0), 0), 0);
    const heroes: Record<string, number> = {};
    for (const v of Object.values(w.villages)) {
      if (v.ownerId === null || w.players[v.ownerId]?.kind !== 'ai') continue;
      for (const hk of HEROES) if ((v.units[hk as UnitId] ?? 0) > 0) heroes[hk] = (heroes[hk] ?? 0) + 1;
    }
    const inCampaign = list.filter((p) => p.ai!.campaign).length;
    const villages = list.reduce((a, p) => a + p.villages.length, 0);
    console.log(`-- day ${h / 24}: ${list.length} AIs, ${villages} villages (${(villages / list.length).toFixed(1)} each), ${nob} noblemen home, ${inCampaign} campaigning now | taken: ${taken.barb} barb, ${taken.ai} AI, ${taken.human} human | noble waves ${tally.trains}, fakes ${tally.fakes}, help ${tally.help}, scouts ${tally.scouts}, war ${tally.war}`);
    console.log(`   heroes at home: ${JSON.stringify(heroes)}`);
    if (process.env.WHY) for (const hp of humans.filter((_, i) => i % 2 === 0)) { const hv = w.villages[hp.villages[0]]; if (!hv) continue; const why: Record<string, number> = {}; for (const a of ais()) { if (!a.villages.some((id) => { const x = w.villages[id]; return x && distance(x.x, x.y, hv.x, hv.y) <= 22; })) continue; const r = campaignVerdict(w, a, hv).replace(/d+/g, '#'); why[r] = (why[r] ?? 0) + 1; } console.log(`   why not ${hp.name}: ${JSON.stringify(why)}`); }
    if (newcomers.size) { const nc = [...newcomers].map((id) => w.players[id]); console.log(`   newcomers: ${nc.filter((p) => p.villages.length > 0).length}/${nc.length} still standing, ${nc.reduce((a, p) => a + p.villages.length, 0)} villages, avg ${Math.round(nc.reduce((a, p) => a + p.points, 0) / nc.length)} pts`); }
    console.log('   humans: ' + humans.map((p) => {
      const hh = humanHits[p.name] ?? { attacks: 0, nobles: 0, fakes: 0, lost: 0 };
      return `${p.name}${p.villages.length ? '' : ' (wiped)'} ${hh.attacks}a/${hh.nobles}n/${hh.fakes}f lost ${hh.lost}`;
    }).join(' | '));
  }
}
void finished;

// how the round ended: the biggest rulers, and how each temperament fared
{
  const list = ais().filter((p) => !p.eliminated).sort((a, b) => b.points - a.points);
  console.log('== top rulers: ' + list.slice(0, 6).map((p) => `${p.name} (${p.ai!.personality}, ${p.ai!.hero ?? '-'}) ${p.villages.length}v ${Math.round(p.points / 1000)}k`).join(' | '));
  const by: Record<string, { n: number; v: number; pts: number; dead: number }> = {};
  for (const p of ais()) {
    const k = p.ai!.personality;
    const b = (by[k] ??= { n: 0, v: 0, pts: 0, dead: 0 });
    b.n++; b.v += p.villages.length; b.pts += p.points; if (p.eliminated || p.villages.length === 0) b.dead++;
  }
  console.log('== by temperament: ' + Object.entries(by).map(([k, b]) => `${k} x${b.n}: ${(b.v / b.n).toFixed(1)}v ${Math.round(b.pts / b.n / 1000)}k, ${b.dead} out`).join(' | '));
  const tribes = Object.values(w.tribes).map((t) => ({ tag: t.tag, n: t.members.length, v: t.members.reduce((a, m) => a + (w.players[m]?.villages.length ?? 0), 0) })).sort((a, b) => b.v - a.v);
  const all = Object.values(w.villages).filter((v) => v.ownerId !== null).length;
  console.log('== top tribes: ' + tribes.slice(0, 5).map((t) => `[${t.tag}] ${t.n}m ${t.v}v (${Math.round((t.v / all) * 100)}%)`).join(' | '));
}
