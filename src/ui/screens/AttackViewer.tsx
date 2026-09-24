// Watch an attack you won play out in the village you hit: the enemy village as
// far as you know it (from your scouts, or guessed from its size), your army
// marching in from where it was sent, and the battle replayed from the report.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { BattleData, Buildings, Report } from '../../engine/types';
import { isVolcanic, isWinter } from '../../engine/world';
import { Btn } from '../components/common';
import { host, isNightNow, prefs, view } from '../store';
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

export function AttackViewer({ r, onClose }: { r: Report; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const vr = useRef<VillageRenderer | null>(null);
  const [failed, setFailed] = useState(false);
  const b = r.battle!;

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
    const season = prefs.value.season === 'auto' ? (isWinter(x, y, size) ? 'winter' : isVolcanic(x, y, size) ? 'volcanic' : 'fall') : prefs.value.season === 'winter' ? 'winter' : 'fall';
    let r3: VillageRenderer;
    try {
      r3 = new VillageRenderer(box.current, { theme, night: isNightNow(prefs.value), season, labels: false });
    } catch {
      setFailed(true);
      return;
    }
    vr.current = r3;
    const buildings = targetBuildings(b);
    r3.update(buildings, {}, 0xb3332a, host.value?.villageInfo(b.defender.vid)?.points ?? 800);
    r3.setTroops({});
    r3.setBattle({
      now: r.t, rate: 0, incoming: [], reports: [],
      village: {
        id: -1 - b.defender.vid, x, y, buildings, units: b.defUnits ?? {}, support: [], hide: 0,
        res: { wood: 0, clay: 0, iron: 0 }, theme,
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
    <div class="battle-viewer" role="dialog" aria-modal="true" aria-label={`The attack on ${b.defender.vname}`}>
      <header class="battle-viewer-bar">
        <div class="grow">
          <b>⚔ {b.attacker.playerId === view.value?.me.id ? 'Your attack' : `${b.attacker.playerName}'s attack`} on {b.defender.vname}</b>
          <span class="muted small"> ({b.defender.x}|{b.defender.y}) · {b.defender.playerName}</span>
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
