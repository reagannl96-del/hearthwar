import { useEffect, useRef, useState } from 'preact/hooks';
import { BUILDINGS } from '../../engine/data/buildings';
import type { BuildingId, Buildings, Units } from '../../engine/types';
import { VillageScene } from '../art/VillageScene';
import { VillageRenderer, webglAvailable, type MarchInfo, type Quality } from './VillageRenderer';
import { dayClock } from '../store';
import type { TheatreInput, TheatreReport } from './battle/theatre';
import type { Season, Theme } from './kit';
import type { FlagDesign } from '../../engine/data/flags';

interface Props {
  buildings: Buildings;
  building: Partial<Record<BuildingId, number>>;
  onPick: (b: BuildingId) => void;
  color: number;
  points: number;
  villageId: number;
  winter: boolean;
  /** the village lies in the volcanic west */
  volcanic?: boolean;
  /** the land the village stands in (overrides winter/volcanic when given) */
  season?: Season;
  night: boolean;
  /** how much detail the device can take */
  quality?: Quality;
  /** troops at home; a few of them walk around the village */
  units?: Units;
  /** the village hero's look */
  theme?: Theme;
  /** armies stationed here from other villages: each pitches a tent in its own style */
  support?: { theme: Theme; units: Units }[];
  /** armies leaving and coming home, and the game clock */
  marches?: MarchInfo[];
  now?: number;
  /** the militia has been called up */
  militia?: boolean;
  /** attacks on this village and their reports, acted out in the scene */
  battle?: TheatreInput;
  /** a report to play again (a new `at` replays it) */
  replay?: { report: TheatreReport; at: number; fromX: number; fromY: number } | null;
  /** the replay has been handed to the scene (so it is not played again next time) */
  onReplayed?: () => void;
  /** the winter festival is on: a lit tree, presents and villagers gathered round it */
  festive?: boolean;
  /** the ruler's banner, flown at the gate once the wall reaches level 20 (null: none) */
  banner?: FlagDesign | null;
}

let gl: boolean | null = null;

export function Village3D(p: Props) {
  gl ??= webglAvailable();
  const host = useRef<HTMLDivElement>(null);
  const r = useRef<VillageRenderer | null>(null);
  const pick = useRef(p.onPick);
  pick.current = p.onPick;
  const [tip, setTip] = useState<{ id: BuildingId; x: number; y: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [fighting, setFighting] = useState(false);
  const replayed = useRef(0);

  useEffect(() => {
    if (!gl || !host.current) return;
    try {
      r.current = new VillageRenderer(host.current, {
        onPick: (b) => pick.current(b),
        onHover: (id, x, y) => setTip(id ? { id, x, y } : null),
        season: p.season ?? (p.winter ? 'winter' : p.volcanic ? 'volcanic' : 'fall'),
        night: p.night,
        theme: p.theme,
        quality: p.quality,
      });
      r.current.update(p.buildings, p.building, p.color, p.points);
      r.current.setTroops(p.units ?? {});
      r.current.setSupport(p.support ?? []);
      r.current.setFestive(!!p.festive);
      r.current.setBanner(p.banner ?? null);
      if (import.meta.env.DEV) (window as unknown as { __vr: VillageRenderer }).__vr = r.current;
    } catch {
      setFailed(true);
    }
    return () => {
      r.current?.dispose();
      r.current = null;
    };
  }, [p.winter, p.volcanic, p.season, p.theme, p.quality]);

  useEffect(() => {
    if (!p.battle) return;
    r.current?.setBattle(p.battle);
    const on = !!r.current?.battleOn();
    if (on !== fighting) setFighting(on);
  }, [p.battle]);

  useEffect(() => {
    const rp = p.replay;
    if (!rp || rp.at === replayed.current || !r.current) return;
    replayed.current = rp.at;
    r.current.replayBattle(rp.report, rp.fromX, rp.fromY);
    p.onReplayed?.();
  }, [p.replay, p.theme, p.winter]);

  useEffect(() => {
    r.current?.update(p.buildings, p.building, p.color, p.points);
  }, [p.buildings, p.building, p.color, p.points]);

  useEffect(() => {
    r.current?.setTroops(p.units ?? {});
  }, [p.units]);

  useEffect(() => {
    r.current?.setSupport(p.support ?? []);
  }, [p.support]);

  useEffect(() => {
    if (p.marches && p.now !== undefined) r.current?.setMarches(p.marches, p.now);
  }, [p.marches, p.now]);

  useEffect(() => {
    r.current?.setMilitia(!!p.militia);
  }, [p.militia, p.theme, p.winter]);

  useEffect(() => {
    r.current?.setFestive(!!p.festive);
  }, [p.festive, p.theme, p.winter]);

  useEffect(() => {
    r.current?.setNight(p.night);
  }, [p.night]);

  const b = p.banner;
  useEffect(() => {
    r.current?.setBanner(b ?? null);
  }, [b?.shape, b?.pattern, b?.charge, b?.field, b?.accent, b?.chargeColor, !!b]);

  useEffect(() => {
    r.current?.resetView();
  }, [p.villageId]);

  if (!gl || failed) {
    return <VillageScene buildings={p.buildings} building={p.building} onPick={p.onPick} color="var(--me)" />;
  }
  const lvl = tip ? p.buildings[tip.id] : 0;
  return (
    <div class="village3d" ref={host}>
      {tip && (
        <div class="village3d-tip" style={{ transform: `translate(${tip.x + 14}px, ${tip.y + 12}px)` }}>
          <b>{BUILDINGS[tip.id].name}</b>
          <span>{lvl > 0 ? `Level ${lvl}` : p.building[tip.id] !== undefined ? 'Under construction' : 'Not built yet'}</span>
        </div>
      )}
      <div class="village3d-ctl" role="toolbar" aria-label="View controls">
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => r.current?.zoomBy(1.3)}>+</button>
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => r.current?.zoomBy(1 / 1.3)}>−</button>
        <button type="button" title="Rotate left" aria-label="Rotate left" onClick={() => r.current?.rotateBy(-Math.PI / 4)}>⟲</button>
        <button type="button" title="Rotate right" aria-label="Rotate right" onClick={() => r.current?.rotateBy(Math.PI / 4)}>⟳</button>
        <button type="button" title="Reset view" aria-label="Reset view" onClick={() => r.current?.resetView()}>⌂</button>
      </div>
      {p.now !== undefined && <SkyClock t={p.now} />}
      {fighting && (
        <button type="button" class="village3d-watch" onClick={() => r.current?.watchBattle()} title="Swing the view round to the fighting">
          ⚔ Watch
        </button>
      )}
      <div class="village3d-hint">Drag to move · scroll to zoom · right-drag to turn</div>
    </div>
  );
}

/** The realm's time of day (server time, a two-hour day), and how long until dusk or dawn. */
function SkyClock({ t }: { t: number }) {
  const c = dayClock(t);
  const m = Math.max(1, Math.ceil(c.changeIn / 60_000));
  const left = m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  return (
    <div class={`village3d-sky ${c.night ? 'is-night' : ''}`} title="Day and night follow the server clock: a day lasts two hours, the last 40 minutes of it night.">
      <span aria-hidden="true">{c.night ? '☾' : '☀'}</span>
      <span>{c.night ? 'Night' : 'Day'} · {c.night ? 'dawn' : 'dusk'} in {left}</span>
    </div>
  );
}

/** A slowly turning showcase village for the title screen. */
export function ShowcaseVillage() {
  gl ??= webglAvailable();
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!gl || !host.current) return;
    let vr: VillageRenderer | null = null;
    try {
      vr = new VillageRenderer(host.current, { showcase: true, labels: false });
      const b = {
        main: 22, barracks: 15, stable: 12, workshop: 6, academy: 1, smithy: 18, rally: 1, statue: 1, market: 12,
        timber: 22, claypit: 22, ironmine: 20, farm: 22, warehouse: 20, hiding: 6, wall: 16, watchtower: 8,
      } as Buildings;
      vr.update(b, {}, 0xb3332a, 3000);
      vr.setTroops({ spear: 200, axe: 150, light: 120, heavy: 20, archer: 30 });
    } catch {
      /* no 3D, the title card still works */
    }
    return () => vr?.dispose();
  }, []);
  return <div class="showcase" ref={host} aria-hidden="true" />;
}
