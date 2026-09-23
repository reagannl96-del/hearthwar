import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { UNITS } from '../../engine/data/units';
import { hasUnits } from '../../engine/formulas';
import type { UnitId, Units } from '../../engine/types';
import type { MapData, MapVillage } from '../../engine/view';
import { lsGet } from '../../host/storage';
import { forestSprite, villageSprite } from '../mapSprites';
import { isWinter } from '../../engine/world';
import { Icon } from '../art/icons';
import { Btn, UnitList } from '../components/common';
import { coords, continent, fmt, fmtAgo, fmtDur, parseCoords } from '../format';
import { act, go, host, marketTarget, now, rallyTarget, view, vid, village, warp } from '../store';

const TERRAIN_COLORS: Record<string, [string, string]> = {
  '.': ['--map-grass', '--map-grass-2'],
  f: ['--map-forest', '--map-forest-2'],
  w: ['--map-water', '--map-water-2'],
  m: ['--map-hill', '--map-hill-2'],
};

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

function tier(points: number): number {
  return points < 100 ? 0 : points < 500 ? 1 : points < 2000 ? 2 : points < 5000 ? 3 : points < 9000 ? 4 : 5;
}

export function MapScreen({ focus }: { focus?: number }) {
  const h = host.value!;
  const pv = view.value!;
  const cur = village.value!;
  const data: MapData = h.map();
  const byId = useMemo(() => new Map(data.villages.map((v) => [v.id, v])), [data.rev]);
  const grid = useMemo(() => {
    const g = new Map<number, MapVillage>();
    for (const v of data.villages) g.set(v.y * data.size + v.x, v);
    return g;
  }, [data.rev]);
  const snow = useMemo(() => {
    const a = new Uint8Array(data.size * data.size);
    for (let y = 0; y < data.size; y++) for (let x = 0; x < data.size; x++) a[y * data.size + x] = isWinter(x, y, data.size) ? 1 : 0;
    return a;
  }, [data.size]);
  const start = (focus !== undefined ? byId.get(focus) : undefined) ?? byId.get(cur.id)!;
  const [center, setCenter] = useState<[number, number]>([start.x + 0.5, start.y + 0.5]);
  const [zoom, setZoom] = useState<number>(() => Number(lsGet('hw-map-zoom')) || 22);
  const [sel, setSel] = useState<number | null>(focus ?? null);
  const [hover, setHover] = useState<number | null>(null);
  const [jump, setJump] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const mini = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const colors = useRef<Record<string, string>>({});

  useEffect(() => {
    if (focus !== undefined) {
      const f = byId.get(focus);
      if (f) { setCenter([f.x + 0.5, f.y + 0.5]); setSel(focus); }
    }
  }, [focus]);

  // resolve theme colors once per render pass
  const readColors = () => {
    const names = ['--map-grass', '--map-grass-2', '--map-forest', '--map-forest-2', '--map-water', '--map-water-2', '--map-hill', '--map-hill-2',
      '--map-grid', '--map-barb', '--me', '--danger', '--support-c', '--ok', '--map-label', '--map-label-bg', '--map-tree', '--surface', '--ink'];
    for (const n of names) colors.current[n] = cssVar(n);
  };

  const draw = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const col = colors.current;
    const z = zoom;
    const x0 = center[0] - W / 2 / z, y0 = center[1] - H / 2 / z;
    const sx = (x: number) => (x - x0) * z, sy = (y: number) => (y - y0) * z;
    ctx.fillStyle = col['--map-water'];
    ctx.fillRect(0, 0, W, H);
    const fx0 = Math.max(0, Math.floor(x0)), fy0 = Math.max(0, Math.floor(y0));
    const fx1 = Math.min(data.size - 1, Math.ceil(x0 + W / z)), fy1 = Math.min(data.size - 1, Math.ceil(y0 + H / z));
    // terrain
    for (let y = fy0; y <= fy1; y++) {
      for (let x = fx0; x <= fx1; x++) {
        const t = data.terrain[y * data.size + x];
        const pair = TERRAIN_COLORS[t] ?? TERRAIN_COLORS['.'];
        const cold = snow[y * data.size + x] === 1;
        const hsh = (x * 73856093) ^ (y * 19349663);
        // forests keep the meadow colour underneath; the trees are drawn on top
        ctx.fillStyle = cold
          ? SNOW[t === 'w' ? 'w' : 'g']
          : col[t === 'f' || t === 'm' ? '--map-grass-2' : pair[0]];
        ctx.fillRect(Math.floor(sx(x)), Math.floor(sy(y)), Math.ceil(z) + 1, Math.ceil(z) + 1);
        if (t === 'f' && !grid.has(y * data.size + x) && (hsh & 3) !== 0) {
          if (z >= 12) ctx.drawImage(forestSprite(hsh & 7, cold), sx(x) - z * 0.05, sy(y) - z * 0.15, z * 1.05, z * 1.05);
          else {
            ctx.fillStyle = cold ? SNOW.f : col['--map-forest'];
            ctx.fillRect(Math.floor(sx(x)), Math.floor(sy(y)), Math.ceil(z) + 1, Math.ceil(z) + 1);
          }
        } else if (t === 'm' && !grid.has(y * data.size + x)) {
          // a craggy peak with a snowy cap
          const px = sx(x), py = sy(y);
          const k = 0.85 + ((hsh >> 3) & 3) * 0.1;
          const tipX = px + z * (0.4 + ((hsh >> 5) & 3) * 0.05), tipY = py + z * (1 - 0.95 * k);
          ctx.fillStyle = cold ? '#9aa3ab' : '#8a8068';
          ctx.beginPath();
          ctx.moveTo(px - z * 0.05, py + z);
          ctx.lineTo(tipX, tipY);
          ctx.lineTo(px + z * 1.05, py + z);
          ctx.fill();
          ctx.fillStyle = cold ? '#7d868f' : '#6e654f';
          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(px + z * 1.05, py + z);
          ctx.lineTo(tipX + z * 0.08, py + z);
          ctx.fill();
          ctx.fillStyle = cold ? '#f6f9fb' : '#e9e4d6';
          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(tipX + z * 0.16, tipY + z * 0.28);
          ctx.lineTo(tipX - z * 0.02, tipY + z * 0.22);
          ctx.lineTo(tipX - z * 0.15, tipY + z * 0.3);
          ctx.fill();
        }
      }
    }
    // continent grid
    ctx.strokeStyle = col['--map-grid'];
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = Math.ceil(fx0 / 10) * 10; k <= fx1 + 1; k += 10) { ctx.moveTo(Math.round(sx(k)) + 0.5, sy(fy0)); ctx.lineTo(Math.round(sx(k)) + 0.5, sy(fy1 + 1)); }
    for (let k = Math.ceil(fy0 / 10) * 10; k <= fy1 + 1; k += 10) { ctx.moveTo(sx(fx0), Math.round(sy(k)) + 0.5); ctx.lineTo(sx(fx1 + 1), Math.round(sy(k)) + 0.5); }
    ctx.stroke();
    if (z >= 8) {
      ctx.fillStyle = col['--map-grid'];
      ctx.font = `600 ${Math.min(14, 6 + z * 0.25)}px system-ui, sans-serif`;
      for (let cy2 = Math.floor(fy0 / 10) * 10; cy2 <= fy1; cy2 += 10)
        for (let cx2 = Math.floor(fx0 / 10) * 10; cx2 <= fx1; cx2 += 10)
          ctx.fillText(`K${cy2 / 10}${cx2 / 10}`, sx(cx2) + 4, sy(cy2) + 14);
    }
    // villages
    const me = pv.me.id;
    const myTribe = pv.me.tribeId;
    for (let y = fy0; y <= fy1; y++) {
      for (let x = fx0; x <= fx1; x++) {
        const v = grid.get(y * data.size + x);
        if (!v) continue;
        const owner = v.ownerId !== null ? data.players[v.ownerId] : null;
        let fill = col['--map-barb'];
        if (v.ownerId === me) fill = col['--me'];
        else if (owner) fill = owner.color;
        const px = sx(x), py = sy(y);
        if (v.ownerId === me) glow(ctx, px + z / 2, py + z * (z < 10 ? 0.5 : 0.62), Math.max(z * (v.id === cur.id ? 1.35 : 1.1), 10), v.id === cur.id);
        if (z < 10) {
          const s = Math.max(2, z - 1);
          ctx.fillStyle = fill;
          ctx.fillRect(px + (z - s) / 2, py + (z - s) / 2, s, s);
        } else {
          const t = tier(v.points);
          const sprite = villageSprite(t, v.ownerId === null ? 'barb' : 'player', snow[y * data.size + x] === 1);
          ctx.drawImage(sprite, px - z * 0.12, py - z * 0.2, z * 1.24, z * 1.24);
          // owner marker, Tribal Wars style
          const d = Math.max(4, z * 0.16);
          ctx.fillStyle = fill;
          ctx.strokeStyle = 'rgba(30,15,5,0.8)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(px + d * 0.8, py + d * 0.8, d / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (owner) {
            ctx.fillStyle = '#3a2614';
            ctx.fillRect(px + z * 0.78, py + z * 0.02, 1.5, z * 0.3);
            ctx.fillStyle = v.ownerId === me ? col['--me'] : owner.color;
            ctx.fillRect(px + z * 0.78 + 1.5, py + z * 0.03, z * 0.16, z * 0.1);
          }
          if (v.bonus) {
            ctx.strokeStyle = col['--me'];
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(px + z * 0.82, py + z * 0.2, z * 0.1, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (owner && myTribe !== null && owner.tribeId === myTribe && v.ownerId !== me) {
            ctx.strokeStyle = '#3a73c0';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(px + z / 2, py + z * 0.6, z * 0.5, z * 0.32, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (z >= 30) {
            ctx.font = `600 ${Math.min(12, z * 0.3)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            const label = z >= 40 && v.ownerId !== null ? `${v.name.slice(0, 16)} · ${fmt(v.points)}` : fmt(v.points);
            const tw = ctx.measureText(label).width + 6;
            ctx.fillStyle = col['--map-label-bg'];
            ctx.fillRect(px + z / 2 - tw / 2, py + z * 0.98, tw, 14);
            ctx.fillStyle = col['--map-label'];
            ctx.fillText(label, px + z / 2, py + z * 0.98 + 11);
            ctx.textAlign = 'start';
          }
        }
        if (v.id === sel || (v.id === hover && v.ownerId !== me)) {
          ctx.strokeStyle = v.id === sel ? 'rgba(255,255,255,0.95)' : 'rgba(255,245,215,0.7)';
          ctx.lineWidth = v.id === sel ? 2.5 : 1.8;
          ctx.setLineDash(v.id === sel ? [] : [4, 3]);
          ctx.beginPath();
          ctx.ellipse(px + z / 2, py + z * (z < 10 ? 0.5 : 0.62), Math.max(z * 0.62, 6), Math.max(z * 0.42, 6), 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
    // movements
    const t = now.value;
    const lines = [...pv.commands, ...pv.incoming];
    for (const c of lines) {
      if (c.kind === 'tradeback' || c.kind === 'trade') continue;
      const from = c.kind === 'return' ? byId.get(c.origin ?? c.toVid) : byId.get(c.fromVid);
      const to = c.kind === 'return' ? byId.get(c.fromVid) : byId.get(c.toVid);
      if (!from || !to) continue;
      const p = Math.max(0, Math.min(1, (t - c.depart) / Math.max(1, c.arrive - c.depart)));
      const ax = sx(from.x + 0.5), ay = sy(from.y + 0.5), bx2 = sx(to.x + 0.5), by2 = sy(to.y + 0.5);
      const color = c.dir === 'in' && c.kind === 'attack' ? col['--danger'] : c.kind === 'attack' ? col['--danger'] : c.kind === 'support' ? col['--support-c'] : col['--ok'];
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = c.dir === 'in' ? 2 : 1.5;
      ctx.setLineDash(c.dir === 'in' ? [6, 4] : c.kind === 'return' ? [2, 4] : []);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx2, by2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ax + (bx2 - ax) * p, ay + (by2 - ay) * p, Math.max(2.5, Math.min(5, z * 0.15)), 0, Math.PI * 2);
      ctx.fill();
    }
    drawMini();
  };

  const drawMini = () => {
    const m = mini.current;
    const c = canvas.current;
    if (!m || !c) return;
    const ctx = m.getContext('2d')!;
    const S = m.width;
    const k = S / data.size;
    const col = colors.current;
    if (!(m as HTMLCanvasElement & { _base?: ImageData })._base || (m as unknown as { _rev?: number })._rev !== data.rev) {
      ctx.fillStyle = col['--map-water'];
      ctx.fillRect(0, 0, S, S);
      for (let y = 0; y < data.size; y++)
        for (let x = 0; x < data.size; x++) {
          const t = data.terrain[y * data.size + x];
          ctx.fillStyle = snow[y * data.size + x] ? SNOW[t === 'w' ? 'w' : t === 'm' ? 'm' : t === 'f' ? 'f' : 'g'] : col[(TERRAIN_COLORS[t] ?? TERRAIN_COLORS['.'])[0]];
          ctx.fillRect(x * k, y * k, Math.ceil(k), Math.ceil(k));
        }
      for (const v of data.villages) {
        ctx.fillStyle = v.ownerId === pv.me.id ? col['--me'] : v.ownerId !== null ? data.players[v.ownerId]?.color ?? col['--map-barb'] : col['--map-barb'];
        ctx.fillRect(v.x * k - 0.5, v.y * k - 0.5, Math.max(1.5, k), Math.max(1.5, k));
      }
      (m as HTMLCanvasElement & { _base?: ImageData })._base = ctx.getImageData(0, 0, S, S);
      (m as unknown as { _rev?: number })._rev = data.rev;
    } else {
      ctx.putImageData((m as HTMLCanvasElement & { _base?: ImageData })._base!, 0, 0);
    }
    const W = c.clientWidth / zoom, H = c.clientHeight / zoom;
    ctx.strokeStyle = col['--ink'];
    ctx.lineWidth = 1.5;
    ctx.strokeRect((center[0] - W / 2) * k, (center[1] - H / 2) * k, W * k, H * k);
  };

  useEffect(() => {
    readColors();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onTheme = () => { readColors(); (mini.current as unknown as { _rev?: number })._rev = -1; draw(); };
    mq.addEventListener('change', onTheme);
    const obs = new MutationObserver(onTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const ro = new ResizeObserver(() => draw());
    if (wrap.current) ro.observe(wrap.current);
    return () => { mq.removeEventListener('change', onTheme); obs.disconnect(); ro.disconnect(); };
  }, []);

  useEffect(() => { draw(); });

  const toField = (e: { clientX: number; clientY: number }): [number, number] => {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    const x = center[0] + (e.clientX - r.left - r.width / 2) / zoom;
    const y = center[1] + (e.clientY - r.top - r.height / 2) / zoom;
    return [Math.floor(x), Math.floor(y)];
  };

  const setZoomAround = (nz: number, cx?: number, cy?: number) => {
    nz = Math.max(4, Math.min(64, nz));
    const c = canvas.current;
    if (c && cx !== undefined && cy !== undefined) {
      const r = c.getBoundingClientRect();
      const ox = cx - r.left - r.width / 2, oy = cy - r.top - r.height / 2;
      const wx = center[0] + ox / zoom, wy = center[1] + oy / zoom;
      setCenter([wx - ox / nz, wy - oy / nz]);
    }
    setZoom(nz);
    try { localStorage.setItem('hw-map-zoom', String(nz)); } catch { /* ignore */ }
  };

  const onPointerDown = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: center[0], cy: center[1], moved: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (d) {
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (d.moved) setCenter([d.cx - dx / zoom, d.cy - dy / zoom]);
      return;
    }
    const [x, y] = toField(e);
    const v = grid.get(y * data.size + x);
    setHover(v ? v.id : null);
  };
  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      const [x, y] = toField(e);
      const v = grid.get(y * data.size + x);
      setSel(v ? v.id : null);
    }
  };

  const selected = sel !== null ? byId.get(sel) : undefined;
  const hovered = hover !== null && hover !== sel ? byId.get(hover) : undefined;

  return (
    <div class="map-layout">
      <div class="map-col">
        <div class="map-toolbar">
          <form class="row gap" onSubmit={(e) => {
            e.preventDefault();
            const xy = parseCoords(jump);
            if (xy) { setCenter([xy[0] + 0.5, xy[1] + 0.5]); const v = grid.get(xy[1] * data.size + xy[0]); if (v) setSel(v.id); }
          }}>
            <input id="map-jump" class="coord-input" placeholder="x|y" value={jump} onInput={(e) => setJump(e.currentTarget.value)} aria-label="Jump to coordinates" />
            <button type="submit" class="btn btn-ghost btn-sm">Go</button>
          </form>
          <Btn small variant="ghost" onClick={() => { setCenter([cur.x + 0.5, cur.y + 0.5]); setSel(cur.id); }}>My village</Btn>
          <div class="row gap">
            <button type="button" class="icon-btn" aria-label="Zoom out" onClick={() => setZoomAround(zoom / 1.4)}>−</button>
            <button type="button" class="icon-btn" aria-label="Zoom in" onClick={() => setZoomAround(zoom * 1.4)}>+</button>
          </div>
          <span class="muted small num">{coords(Math.floor(center[0]), Math.floor(center[1]))} · {continent(Math.floor(center[0]), Math.floor(center[1]))}</span>
        </div>
        <div class="map-wrap" ref={wrap}>
          <canvas
            ref={canvas}
            class="map-canvas"
            tabIndex={0}
            aria-label="World map. Drag to move, scroll to zoom, click a village for details."
            onPointerDown={onPointerDown as unknown as (e: Event) => void}
            onPointerMove={onPointerMove as unknown as (e: Event) => void}
            onPointerUp={onPointerUp as unknown as (e: Event) => void}
            onPointerLeave={() => setHover(null)}
            onWheel={(e: WheelEvent) => { e.preventDefault(); setZoomAround(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); }}
            onKeyDown={(e: KeyboardEvent) => {
              const step = 20 / zoom * 3;
              if (e.key === 'ArrowLeft') setCenter([center[0] - step, center[1]]);
              else if (e.key === 'ArrowRight') setCenter([center[0] + step, center[1]]);
              else if (e.key === 'ArrowUp') setCenter([center[0], center[1] - step]);
              else if (e.key === 'ArrowDown') setCenter([center[0], center[1] + step]);
              else if (e.key === '+' || e.key === '=') setZoomAround(zoom * 1.25);
              else if (e.key === '-') setZoomAround(zoom / 1.25);
              else return;
              e.preventDefault();
            }}
          />
          {hovered && <HoverCard v={hovered} data={data} />}
          <canvas
            ref={mini}
            class="minimap"
            width={150}
            height={150}
            onClick={(e) => {
              const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
              setCenter([((e.clientX - r.left) / r.width) * data.size, ((e.clientY - r.top) / r.height) * data.size]);
            }}
            aria-label="Minimap"
          />
        </div>
        <Legend data={data} />
      </div>
      <aside class="map-side">
        {selected ? <VillagePanel v={selected} data={data} /> : (
          <div class="panel">
            <p class="muted">Click a village to see who rules it, how far away it is, and what your scouts know.</p>
            <p class="muted small">Drag to move · scroll or +/− to zoom · arrow keys pan</p>
          </div>
        )}
      </aside>
    </div>
  );
}

const SNOW = { g: '#e7edf1', g2: '#dce4ea', f: '#c9d4d6', w: '#a7c4d6', m: '#c5cacf', peak: '#f5f8fa' };

/** The warm golden halo Tribal Wars puts around your own villages. */
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, strong: boolean) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, strong ? 'rgba(255, 236, 140, 0.95)' : 'rgba(255, 226, 120, 0.8)');
  g.addColorStop(0.45, strong ? 'rgba(255, 196, 60, 0.6)' : 'rgba(255, 190, 60, 0.45)');
  g.addColorStop(1, 'rgba(255, 170, 40, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = strong ? 'rgba(255, 224, 110, 0.95)' : 'rgba(255, 214, 100, 0.7)';
  ctx.lineWidth = strong ? 2 : 1.4;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.62, r * 0.44, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function shade(hex: string, amt: number): string {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  const f = (s: string) => Math.max(0, Math.min(255, Math.round(parseInt(s, 16) * (1 + amt))));
  return `rgb(${f(m[1])},${f(m[2])},${f(m[3])})`;
}

function HoverCard({ v, data }: { v: MapVillage; data: MapData }) {
  const owner = v.ownerId !== null ? data.players[v.ownerId] : null;
  const tribe = owner?.tribeId ? data.tribes[owner.tribeId] : null;
  return (
    <div class="map-hover" role="tooltip">
      <b>{v.name}</b> <span class="muted">({coords(v.x, v.y)})</span>
      <div class="small">{owner ? owner.name : 'Barbarians'}{tribe ? ` [${tribe.tag}]` : ''} · <span class="num">{fmt(v.points)}</span> pts{v.bonus ? ' · bonus' : ''}</div>
    </div>
  );
}

function Legend({ data }: { data: MapData }) {
  const pv = view.value!;
  const near = Object.values(data.players).filter((p) => p.id !== pv.me.id).sort((a, b) => b.points - a.points).slice(0, 8);
  return (
    <div class="legend">
      <span><i class="sw" style={{ background: 'var(--me)' }} /> You</span>
      <span><i class="sw" style={{ background: 'var(--map-barb)' }} /> Barbarians</span>
      {near.map((p) => (
        <button type="button" class="link" onClick={() => go({ name: 'ranking', player: p.id })}>
          <i class="sw" style={{ background: p.color }} /> {p.name}
        </button>
      ))}
    </div>
  );
}

function loadTpl(): { a: Units; b: Units } {
  try {
    return JSON.parse(lsGet('hw-farm') ?? '');
  } catch {
    return { a: { light: 5 }, b: { spear: 20, axe: 10 } };
  }
}

function VillagePanel({ v, data }: { v: MapVillage; data: MapData }) {
  const h = host.value!;
  const pv = view.value!;
  const cur = village.value!;
  const info = h.villageInfo(v.id, cur.id)!;
  const [note, setNote] = useState(info.note ?? '');
  useEffect(() => setNote(info.note ?? ''), [v.id]);
  const owner = v.ownerId !== null ? data.players[v.ownerId] : null;
  const own = v.ownerId === pv.me.id;
  const tpl = loadTpl();
  const canSend = (u: Units) => hasUnits(u) && Object.entries(u).every(([k, n]) => (cur.units[k as UnitId] ?? 0) >= (n ?? 0));
  const it = info.intel;
  const quick: UnitId[] = ['spear', 'axe', 'scout', 'light', 'heavy', 'ram', 'noble'];
  return (
    <div class="panel map-info">
      <header>
        <h3>{v.name}</h3>
        <div class="muted small">{coords(v.x, v.y)} · {continent(v.x, v.y)} · <span class="num">{fmt(v.points)}</span> points</div>
      </header>
      <dl class="facts">
        <dt>Ruler</dt>
        <dd>{owner ? <button type="button" class="link" onClick={() => go({ name: 'ranking', player: owner.id })}>{owner.name}</button> : 'Barbarians'}{info.tribe && <span class="muted"> [{info.tribe}]</span>}</dd>
        {info.bonus && <><dt>Bonus</dt><dd>{info.bonus === 'all' ? '+30% all resources' : info.bonus === 'farm' ? '+10% population' : info.bonus === 'storage' ? '+50% storage' : info.bonus === 'recruit' ? 'faster recruitment' : `+100% ${info.bonus}`}</dd></>}
        {!own && <><dt>Distance</dt><dd class="num">{info.distanceFrom?.toFixed(1)} fields</dd></>}
        {info.protected && <><dt>Status</dt><dd>Beginner protection</dd></>}
        {own && info.loyalty !== undefined && <><dt>Loyalty</dt><dd class="num">{Math.floor(info.loyalty)}</dd></>}
      </dl>
      {own ? (
        <div class="row gap wrap">
          <Btn small onClick={() => { vid.value = v.id; go({ name: 'village' }); }}>Open village</Btn>
          {v.id !== cur.id && <Btn small variant="ghost" onClick={() => { rallyTarget.value = { x: v.x, y: v.y, kind: 'support' }; go({ name: 'building', id: 'rally', tab: 'send' }); }}>Send troops</Btn>}
          {v.id !== cur.id && <Btn small variant="ghost" onClick={() => { marketTarget.value = { x: v.x, y: v.y }; go({ name: 'building', id: 'market', tab: 'send' }); }}>Send resources</Btn>}
        </div>
      ) : (
        <>
          <div class="row gap wrap">
            <Btn small variant="danger" onClick={() => { rallyTarget.value = { x: v.x, y: v.y, kind: 'attack' }; go({ name: 'building', id: 'rally', tab: 'send' }); }}><Icon name="attack" size={14} /> Attack</Btn>
            {owner && <Btn small variant="ghost" onClick={() => { rallyTarget.value = { x: v.x, y: v.y, kind: 'support' }; go({ name: 'building', id: 'rally', tab: 'send' }); }}><Icon name="support" size={14} /> Support</Btn>}
            <Btn small variant="ghost" disabled={(cur.units.scout ?? 0) < 1} onClick={() => act({ type: 'send', vid: cur.id, target: v.id, kind: 'attack', units: { scout: Math.min(cur.units.scout ?? 0, owner ? 5 : 1) } }, 'Scouts are riding out.')}>
              <Icon name="scout" size={14} /> Scout
            </Btn>
          </div>
          {v.ownerId === null && (
            <div class="row gap wrap">
              <Btn small disabled={!canSend(tpl.a)} onClick={() => act({ type: 'send', vid: cur.id, target: v.id, kind: 'attack', units: tpl.a }, 'Raid sent.')}>Farm A</Btn>
              <Btn small disabled={!canSend(tpl.b)} onClick={() => act({ type: 'send', vid: cur.id, target: v.id, kind: 'attack', units: tpl.b }, 'Raid sent.')}>Farm B</Btn>
              <Btn small variant="ghost" disabled={!canSend(tpl.a)} onClick={() => act({ type: 'send', vid: cur.id, target: v.id, kind: 'attack', units: tpl.a, repeat: true }, 'Repeating raid sent.')}>A ↻ repeat</Btn>
            </div>
          )}
          {owner && <Btn small variant="quiet" onClick={() => { marketTarget.value = { x: v.x, y: v.y }; go({ name: 'building', id: 'market', tab: 'send' }); }}>Send resources</Btn>}
        </>
      )}
      {!own && info.travel && (
        <details class="travel">
          <summary>Travel times</summary>
          <table class="level-table">
            <tbody>
              {quick.map((u) => (
                <tr><td><Icon name={u} size={16} /> {UNITS[u].name}</td><td class="right num">{fmtDur((info.travel![u] ?? 0) / warp.value)}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      {it && !own && (
        <div class="intel">
          <h4>What you know</h4>
          {it.lastAttackT && <p class="small"><span class={`dot dot-${it.lastColor}`} /> Last battle {fmtAgo(it.lastAttackT, now.value)}{it.lastLoot !== undefined && <> · looted <span class="num">{fmt(it.lastLoot)}</span>/{fmt(it.lastCapacity ?? 0)}</>}</p>}
          {it.wall !== undefined && <p class="small">Wall: <b class="num">{it.wall}</b></p>}
          {it.scoutT && it.res && <p class="small">Scouted {fmtAgo(it.scoutT, now.value)}: <span class="num">{fmt(it.res.wood)} / {fmt(it.res.clay)} / {fmt(it.res.iron)}</span></p>}
          {it.units && <div class="small">Troops seen: <UnitList units={it.units} empty="none" /></div>}
          {it.buildings && <p class="small muted">Buildings: {Object.entries(it.buildings).filter(([, l]) => (l ?? 0) > 0).map(([b, l]) => `${b} ${l}`).join(', ')}</p>}
        </div>
      )}
      <label class="field">
        <span>Notes</span>
        <textarea id="village-note" rows={2} value={note} onInput={(e) => setNote(e.currentTarget.value)} onBlur={() => act({ type: 'note', vid: v.id, text: note })} placeholder="Private notes about this village" />
      </label>
    </div>
  );
}
