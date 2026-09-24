// Watch an attack you won play out in the village you hit: the enemy village as
// far as you know it (from your scouts, or guessed from its size), your army
// marching in from where it was sent, and the battle replayed from the report.
// A battle at a resource cache plays out in its supply depot instead, won or lost.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { BattleData, Buildings, Report } from '../../engine/types';
import { cacheReplayBattle } from '../caches';
import { cacheGuards } from '../../engine/caches';
import { emptyBuildings } from '../../engine/village';
import { DEFAULT_FLAG } from '../../engine/data/flags';
import { seasonAt } from '../three/land';
import { Btn } from '../components/common';
import { host, isNightAt, now, prefs, sceneQuality, view } from '../store';
import { VillageRenderer, webglAvailable } from '../three/VillageRenderer';
import type { Theme } from '../three/kit';

/** A village of about this many points, built the way villages usually grow. */
function guessBuildings(points: number): Buildings {
  const k = Math.max(0.02, Math.min(1, points / 11_000));
  const lv = (max: number, from = 0, pow = 0.6) => (k <= from ? 0 : Math.max(1, Math.round(max * ((k - from) / (1 - from)) ** pow)));
  return {
    main: lv(28), barracks: lv(24, 0.02), stable: lv(18, 0.12), workshop: lv(10, 0.25), academy: k > 0.6 ? 1 : 0,
    smithy: lv(20, 0.06), rally: 1, statue: k > 0.1 ? 1 : 0, market: lv(18, 0.1), timber: lv(28), claypit: lv(28), ironmine: lv(28),
    farm: lv(28), warehouse: lv(28), hiding: lv(8, 0, 0.8), wall: lv(20, 0.05, 0.8), watchtower: lv(12, 0.35),
  } as Buildings;
}

/** The target as the report and your intel tell it (its levels after the attack). */
function targetBuildings(b: BattleData): Buildings {
  const info = host.value?.villageInfo(b.defender.vid);
  const known = b.scout?.buildings ?? info?.intel?.buildings;
  const out = { ...guessBuildings(info?.points ?? 800), ...(known ?? {}) } as Buildings;
  if (b.wall) out.wall = b.wall.after;
  if (b.building) out[b.building.id] = b.building.after;
  return out;
}

/** A cache's depot has no buildings, only its wall: as the report tells it, else as strong as its guards' level. */
function depotBuildings(b: BattleData): Buildings {
  const out = emptyBuildings();
  out.wall = b.wall ? b.wall.after : cacheGuards(b.cache!.level, false).wall;
  return out;
}

export function AttackViewer({ r, onClose }: { r: Report; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const vr = useRef<VillageRenderer | null>(null);
  const [failed, setFailed] = useState(false);
  const depot = !!r.battle!.cache;
  const b = depot ? cacheReplayBattle(r.battle!, !!view.value?.config.archers) : r.battle!;

  const play = () => {
    const v = vr.current;
    if (!v) return;
    v.replayBattle({ id: r.id, t: r.t, battle: b }, b.attacker.x, b.attacker.y);
  };

  useEffect(() => {
    if (!box.current || !webglAvailable()) { setFailed(true); return; }
    const theme = (b.defender.theme ?? 'classic') as Theme;
    const size = view.value?.config.size ?? 100;
    const { x, y } = b.defender;
    const season = seasonAt(x, y, size);
    let r3: VillageRenderer;
    try {
      r3 = new VillageRenderer(box.current, { theme, night: isNightAt(now.value), season, labels: false, quality: sceneQuality(prefs.value), depot });
    } catch {
      setFailed(true);
      return;
    }
    vr.current = r3;
    const buildings = depot ? depotBuildings(b) : targetBuildings(b);
    // (a depot's wall wears gold: the cache belongs to nobody)
    r3.update(buildings, {}, depot ? 0xd9a441 : 0xb3332a, depot ? 0 : host.value?.villageInfo(b.defender.vid)?.points ?? 800);
    // guards stroll about the depot until the attack comes (a village's own troops are not known)
    r3.setTroops(depot ? b.defUnits ?? {} : {});
    // the defender's banner flies at the gate if the wall still stands at level 20 (barbarians and caches fly none)
    const owner = b.defender.playerId;
    r3.setBanner(owner != null && !depot ? host.value?.world.players[owner]?.flag ?? DEFAULT_FLAG : null);
    r3.setBattle({
      now: r.t, rate: 0, incoming: [], reports: [],
      village: {
        id: -1 - b.defender.vid, x, y, buildings, units: b.defUnits ?? {}, support: [], hide: 0,
        res: { wood: 0, clay: 0, iron: 0 }, theme, depot,
      },
    });
    play();
    // swing round to the fighting once the army reaches the wall
    const follow = window.setTimeout(() => r3.watchBattle(), 12_500);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(follow);
      window.removeEventListener('keydown', onKey);
      r3.dispose();
      vr.current = null;
    };
  }, [r.id]);

  return (
    <div class="battle-viewer" role="dialog" aria-modal="true" aria-label={`The attack on ${depot ? 'the resource cache' : b.defender.vname}`}>
      <header class="battle-viewer-bar">
        <div class="grow">
          <b>⚔ {b.attacker.playerId === view.value?.me.id ? 'Your attack' : `${b.attacker.playerName}'s attack`} on {depot ? 'the resource cache' : b.defender.vname}</b>
          <span class="muted small"> ({b.defender.x}|{b.defender.y}) · {depot ? (b.cache!.holder ? `held by ${b.cache!.holder} after the battle` : 'Cache guards') : b.defender.playerName}</span>
        </div>
        <Btn small variant="ghost" onClick={() => vr.current?.watchBattle()}>Follow the fight</Btn>
        <Btn small variant="ghost" onClick={play}>Play again</Btn>
        <Btn small onClick={onClose}>Close</Btn>
      </header>
      {failed
        ? <div class="battle-viewer-none">This device can't show the 3D village.</div>
        : <div class="battle-viewer-scene village3d" ref={box} />}
    </div>
  );
}
