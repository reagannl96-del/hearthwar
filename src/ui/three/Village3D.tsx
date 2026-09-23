import { useEffect, useRef, useState } from 'preact/hooks';
import { BUILDINGS } from '../../engine/data/buildings';
import type { BuildingId, Buildings, Units } from '../../engine/types';
import { VillageScene } from '../art/VillageScene';
import { VillageRenderer, webglAvailable } from './VillageRenderer';
import type { Theme } from './kit';

interface Props {
  buildings: Buildings;
  building: Partial<Record<BuildingId, number>>;
  onPick: (b: BuildingId) => void;
  color: number;
  points: number;
  villageId: number;
  winter: boolean;
  night: boolean;
  /** troops at home; a few of them walk around the village */
  units?: Units;
  /** the village hero's look */
  theme?: Theme;
  onToggleNight?: () => void;
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

  useEffect(() => {
    if (!gl || !host.current) return;
    try {
      r.current = new VillageRenderer(host.current, {
        onPick: (b) => pick.current(b),
        onHover: (id, x, y) => setTip(id ? { id, x, y } : null),
        season: p.winter ? 'winter' : 'fall',
        night: p.night,
        theme: p.theme,
      });
      r.current.update(p.buildings, p.building, p.color, p.points);
      r.current.setTroops(p.units ?? {});
      if (import.meta.env.DEV) (window as unknown as { __vr: VillageRenderer }).__vr = r.current;
    } catch {
      setFailed(true);
    }
    return () => {
      r.current?.dispose();
      r.current = null;
    };
  }, [p.winter, p.theme]);

  useEffect(() => {
    r.current?.update(p.buildings, p.building, p.color, p.points);
  }, [p.buildings, p.building, p.color, p.points]);

  useEffect(() => {
    r.current?.setTroops(p.units ?? {});
  }, [p.units]);

  useEffect(() => {
    r.current?.setNight(p.night);
  }, [p.night]);

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
        {p.onToggleNight && (
          <button type="button" title={p.night ? 'Switch to day' : 'Switch to night'} aria-label={p.night ? 'Switch to day' : 'Switch to night'} onClick={p.onToggleNight}>
            {p.night ? '☀' : '☾'}
          </button>
        )}
      </div>
      <div class="village3d-hint">Drag to move · scroll to zoom · right-drag to turn</div>
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
