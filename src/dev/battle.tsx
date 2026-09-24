// Dev sandbox for the attack theatre: a village, an army, and the real combat
// engine deciding how it goes. /dev/battle.html
//
// "Replay" plays a battle report straight away (a 14 s march, then the fight).
// "Live" feeds the theatre the way the game does: an incoming attack that comes
// into sight, the alarm and the muster, and the report arriving as it lands.

import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { resolveBattle } from '../engine/combat';
import type { BattleData, BuildingId, Buildings, UnitId, Units } from '../engine/types';
import { VillageRenderer } from '../ui/three/VillageRenderer';
import type { Theme } from '../ui/three/kit';
import type { TheatreInput, TheatreReport } from '../ui/three/battle/theatre';

const ARMIES: Record<string, Units> = {
  'Axe nuke with rams and catapults': { axe: 3000, light: 1200, ram: 200, catapult: 60, marcher: 300 },
  'Noble train': { axe: 1500, light: 600, noble: 3, heavy: 100 },
  'Farming raid': { light: 40, axe: 20 },
  'Scouts only': { scout: 30 },
  'Archers and spears': { spear: 1200, archer: 900, sword: 400, catapult: 40 },
  'Knights': { heavy: 800, paladin: 1, light: 300, ram: 40, catapult: 30 },
  'Goblin horde (hero)': { axe: 2500, goblin: 1, light: 500, ram: 120 },
  'Necromancer host': { axe: 2000, necromancer: 1, light: 300, catapult: 80 },
  'Sorcerer warband': { sorcerer: 1, axe: 1500, marcher: 500, catapult: 50 },
  'Orc horde (hero)': { orc: 1, axe: 2500, sword: 600, light: 800, heavy: 200, scout: 20, ram: 150, catapult: 60 },
  'Frost Queen host (hero)': { frost: 1, axe: 1500, sword: 400, light: 800, marcher: 200, heavy: 300, scout: 20, ram: 100, catapult: 40 },
};
const DEFENCES: Record<string, Units> = {
  'Full defence': { spear: 3000, sword: 2500, archer: 800, heavy: 150 },
  'Half defence': { spear: 1200, sword: 900, archer: 300 },
  'A few spears': { spear: 80, sword: 20 },
  'Empty': {},
  'Sorcerer and archers': { sorcerer: 1, spear: 900, archer: 700 },
  'Druid grove': { druid: 1, spear: 1500, sword: 900, archer: 200 },
  'Orc warband': { orc: 1, spear: 1500, sword: 900, archer: 400, marcher: 150 },
  'Frost court (rime, frostbite)': { frost: 1, spear: 1500, sword: 900, archer: 600, heavy: 100 },
  'Paladin and cavalry': { paladin: 1, heavy: 500, spear: 1000, sword: 500 },
  'Scouts at home': { scout: 60, spear: 300 },
};
const THEMES: Theme[] = ['classic', 'paladin', 'goblin', 'sorcerer', 'druid', 'necromancer', 'orc', 'frost'];
const TARGETS: BuildingId[] = ['main', 'warehouse', 'barracks', 'farm', 'smithy', 'market', 'stable', 'wall'];

function village(wall: number, tower: number, hiding: number): Buildings {
  return {
    main: 20, barracks: 18, stable: 14, workshop: 8, academy: 1, smithy: 18, rally: 1, statue: 1, market: 12,
    timber: 22, claypit: 22, ironmine: 20, farm: 24, warehouse: 20, hiding, wall, watchtower: tower,
  } as Buildings;
}

let nextId = 1000;

/** The battle as the engine would report it to the defender. */
function battleReport(att: Units, def: Units, b: Buildings, target: BuildingId, attTheme: Theme, defTheme: Theme): BattleData {
  const catIsWall = target === 'wall';
  const r = resolveBattle({
    att, attTech: {}, attItem: null, defStacks: [{ units: def, tech: {} }], defItems: [], wall: b.wall, luck: 0, morale: 1,
    catTargetLevel: (att.catapult ?? 0) > 0 ? (catIsWall ? b.wall : b[target]) : undefined,
    catTargetMin: 0, catTargetIsWall: catIsWall,
  });
  const building = (att.catapult ?? 0) > 0 && !catIsWall ? { id: target, before: b[target], after: Math.max(0, b[target] - r.catLevelsDestroyed) } : undefined;
  const lost = r.defLost[0] ?? {};
  const won = r.winner === 'attacker';
  const loot = won && !r.pureScout ? { wood: 4200, clay: 3900, iron: 3100 } : undefined;
  return {
    attacker: { playerId: 2, playerName: 'Ivar Oakheart', vid: 2, vname: 'Raven Hold', x: 0, y: 0, theme: attTheme },
    defender: { playerId: 1, playerName: 'You', vid: 1, vname: 'Home', x: 0, y: 0, theme: defTheme },
    luck: 0, morale: 1, attUnits: att, attLost: r.attLost, defUnits: def, defLost: lost, winner: r.winner,
    wall: b.wall > 0 ? { before: b.wall, after: r.wallAfter } : undefined,
    building, loot,
    loyalty: (att.noble ?? 0) > 0 && won ? { before: 100, after: 100 - 27 * (att.noble ?? 0) } : undefined,
    conquered: (att.noble ?? 0) >= 4 && won,
    effects: r.effects,
  };
}

function Sandbox() {
  const host = useRef<HTMLDivElement>(null);
  const vr = useRef<VillageRenderer | null>(null);
  const [army, setArmy] = useState(Object.keys(ARMIES)[0]);
  const [defence, setDefence] = useState(Object.keys(DEFENCES)[1]);
  const [attTheme, setAttTheme] = useState<Theme>('goblin');
  const [defTheme, setDefTheme] = useState<Theme>('classic');
  const [wall, setWall] = useState(14);
  const [tower, setTower] = useState(6);
  const [hiding, setHiding] = useState(5);
  const [target, setTarget] = useState<BuildingId>('warehouse');
  const [bearing, setBearing] = useState(35);
  const [night, setNight] = useState(false);
  const [log, setLog] = useState('');
  const live = useRef<{ input: TheatreInput; report: TheatreReport; landAt: number } | null>(null);
  const clock = useRef(0);

  useEffect(() => {
    if (!host.current) return;
    const r = new VillageRenderer(host.current, { theme: defTheme, night });
    vr.current = r;
    (window as unknown as { __vr: VillageRenderer }).__vr = r;
    return () => { r.dispose(); vr.current = null; };
  }, [defTheme, night]);

  const b = village(wall, tower, hiding);
  const def = DEFENCES[defence];
  useEffect(() => {
    vr.current?.update(b, {}, 0xe0a526, 9000);
    vr.current?.setTroops(def);
  });

  // the live path: a fake game clock running at real speed
  useEffect(() => {
    const id = setInterval(() => {
      clock.current += 250;
      const L = live.current;
      const r = vr.current;
      if (!r) return;
      const input: TheatreInput = L ? { ...L.input, now: clock.current } : {
        now: clock.current, rate: 1, incoming: [], reports: [],
        village: { id: 1, x: 500, y: 500, buildings: b, units: def, support: [], hide: 1500, res: { wood: 20000, clay: 20000, iron: 20000 }, theme: defTheme },
      };
      if (L) {
        if (clock.current >= L.landAt) { input.incoming = []; input.reports = [L.report]; input.village = { ...input.village, units: {} }; }
      }
      r.setBattle(input);
    }, 250);
    return () => clearInterval(id);
  });

  const report = (): TheatreReport => {
    const battle = battleReport(ARMIES[army], def, b, target, attTheme, defTheme);
    setLog(`${battle.winner === 'attacker' ? 'Attacker wins' : 'Defender wins'} · wall ${battle.wall ? `${battle.wall.before}→${battle.wall.after}` : '-'} · ${battle.building ? `${battle.building.id} ${battle.building.before}→${battle.building.after}` : 'no catapult damage'} · effects ${(battle.effects ?? []).join(', ') || 'none'}`);
    return { id: nextId++, t: clock.current, battle };
  };
  const from = () => {
    const a = (bearing * Math.PI) / 180;
    return { x: 500 + Math.cos(a) * 12, y: 500 + Math.sin(a) * 12 };
  };

  const replay = () => {
    live.current = null;
    const f = from();
    vr.current?.replayBattle(report(), f.x, f.y);
  };
  const goLive = () => {
    const r = report();
    const f = from();
    const travel = 150_000; // 2.5 minutes, so the last fifth is 30 s
    const depart = clock.current - travel * 0.79;
    const arrive = depart + travel;
    r.t = arrive;
    live.current = {
      landAt: arrive,
      report: r,
      input: {
        now: clock.current, rate: 1,
        village: { id: 1, x: 500, y: 500, buildings: b, units: def, support: [], hide: 1500, res: { wood: 20000, clay: 20000, iron: 20000 }, theme: defTheme },
        incoming: [{ id: nextId++, fromVid: 2, fromX: f.x, fromY: f.y, toX: 500, toY: 500, depart, arrive, theme: attTheme, kinds: (Object.keys(ARMIES[army]) as UnitId[]), ownerName: 'Ivar' }],
        reports: [],
      },
    };
  };

  const sel = (label: string, value: string, set: (v: string) => void, opts: string[]) => (
    <label>{label}<select value={value} onChange={(e) => set((e.currentTarget as HTMLSelectElement).value)}>{opts.map((o) => <option value={o}>{o}</option>)}</select></label>
  );
  const num = (label: string, value: number, set: (v: number) => void, max: number) => (
    <label>{label}<input type="number" min={0} max={max} value={value} onInput={(e) => set(Number((e.currentTarget as HTMLInputElement).value))} /></label>
  );
  return (
    <div class="sb">
      <div class="sb-panel">
        {sel('Army', army, setArmy, Object.keys(ARMIES))}
        {sel('Army look', attTheme, (v) => setAttTheme(v as Theme), THEMES)}
        {sel('Defence', defence, setDefence, Object.keys(DEFENCES))}
        {sel('Village look', defTheme, (v) => setDefTheme(v as Theme), THEMES)}
        {sel('Catapult target', target, (v) => setTarget(v as BuildingId), TARGETS)}
        {num('Wall', wall, setWall, 20)}
        {num('Watchtower', tower, setTower, 20)}
        {num('Hiding place', hiding, setHiding, 10)}
        {num('From (deg)', bearing, setBearing, 360)}
        <label><input type="checkbox" checked={night} onChange={(e) => setNight((e.currentTarget as HTMLInputElement).checked)} /> night</label>
        <button onClick={replay}>Replay</button>
        <button onClick={goLive}>Live</button>
        <button onClick={() => vr.current?.watchBattle()}>Watch</button>
        <div class="sb-log">{log}</div>
      </div>
      <div class="sb-scene" ref={host} />
    </div>
  );
}

render(<Sandbox />, document.getElementById('app')!);
