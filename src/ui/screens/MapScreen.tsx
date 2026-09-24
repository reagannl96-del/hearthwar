import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { UNITS } from '../../engine/data/units';
import { hasUnits } from '../../engine/formulas';
import type { BonusType, UnitId, Units } from '../../engine/types';
import type { MapData, MapVillage } from '../../engine/view';
import { lsGet } from '../../host/storage';
import { forestSprite, lookOfHero, onVillageArt, spriteBox, villageSprite, villageStage } from '../mapSprites';
import { isVolcanic, isWinter } from '../../engine/world';
import { Icon } from '../art/icons';
import { Btn, CopyButton, UnitList, UnitIcon, unitName } from '../components/common';
import { loadFarmTemplates, tplName } from '../farmTemplates';
import { coords, fmt, fmtAgo, fmtDur, parseCoords, quadrant } from '../format';
import { TribeTag } from './TribeScreen';
import { MARK_COLORS, markFor, marks, setMark, useWorldMarks, type Marks } from '../mapMarks';
import { act, host, marketTarget, now, rallyTarget, view, warp, usePane } from '../store';

const TERRAIN_COLORS: Record<string, [string, string]> = {
  '.': ['--map-grass', '--map-grass-2'],
  f: ['--map-forest', '--map-forest-2'],
  w: ['--map-water', '--map-water-2'],
  m: ['--map-hill', '--map-hill-2'],
};

const clampField = (n: number, size: number) => Math.max(0, Math.min(size - 1, Math.floor(n)));

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

export function MapScreen({ focus, at }: { focus?: number; at?: [number, number] }) {
  const pane = usePane();
  const h = host.value!;
  const pv = view.value!;
  const cur = pane.village.value!;
  const data: MapData = h.map();
  const byId = useMemo(() => new Map(data.villages.map((v) => [v.id, v])), [data.rev]);
  const grid = useMemo(() => {
    const g = new Map<number, MapVillage>();
    for (const v of data.villages) g.set(v.y * data.size + v.x, v);
    return g;
  }, [data.rev]);
  const snow = useMemo(() => {
    const a = new Uint8Array(data.size * data.size);
    for (let y = 0; y < data.size; y++) for (let x = 0; x < data.size; x++) a[y * data.size + x] = isWinter(x, y, data.size) ? 1 : isVolcanic(x, y, data.size) ? 2 : 0;
    return a;
  }, [data.size]);
  // my own villages wear the look of their hero; everyone else's look plain
  const myLooks = useMemo(() => new Map(pv.villages.map((vv) => [vv.id, lookOfHero(vv.hero)])), [pv.villages]);
  const [, setArtLoaded] = useState(0);
  useEffect(() => {
    const off = onVillageArt(() => setArtLoaded((n) => n + 1));
    return () => { off(); };
  }, []);
  const start = (focus !== undefined ? byId.get(focus) : undefined) ?? (at ? { x: clampField(at[0], data.size), y: clampField(at[1], data.size) } : undefined) ?? byId.get(cur.id)!;
  const [center, setCenter] = useState<[number, number]>([start.x + 0.5, start.y + 0.5]);
  const [zoom, setZoom] = useState<number>(() => Number(lsGet('hw-map-zoom')) || 22);
  const [sel, setSel] = useState<number | null>(focus ?? null);
  const [hover, setHover] = useState<number | null>(null);
  // phones and tablets have no hover: a crosshair in the middle of the map reads out whatever sits under it
  const [touchUi, setTouchUi] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  const [jump, setJump] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const mini = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const colors = useRef<Record<string, string>>({});
  useWorldMarks(pv.worldName);
  const mk = marks.value;
  const markKey = JSON.stringify(mk);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const on = () => setTouchUi(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // the village under the crosshair: the field at the centre, else the nearest one a thumb's width away
  const aimed = useMemo(() => {
    if (!touchUi) return undefined;
    const cx = Math.floor(center[0]), cy = Math.floor(center[1]);
    const hit = cx >= 0 && cy >= 0 && cx < data.size && cy < data.size ? grid.get(cy * data.size + cx) : undefined;
    if (hit) return hit;
    const reach = Math.max(0.75, AIM_RADIUS_PX / zoom);
    const r = Math.ceil(reach);
    let best: MapVillage | undefined, bestD = reach * reach;
    for (let y = Math.max(0, cy - r); y <= Math.min(data.size - 1, cy + r); y++)
      for (let x = Math.max(0, cx - r); x <= Math.min(data.size - 1, cx + r); x++) {
        const v = grid.get(y * data.size + x);
        if (!v) continue;
        const d = (x + 0.5 - center[0]) ** 2 + (y + 0.5 - center[1]) ** 2;
        if (d <= bestD) { best = v; bestD = d; }
      }
    return best;
  }, [touchUi, center[0], center[1], zoom, grid]);

  useEffect(() => {
    if (focus !== undefined) {
      const f = byId.get(focus);
      if (f) { setCenter([f.x + 0.5, f.y + 0.5]); setSel(focus); }
    }
  }, [focus]);
  // a spot on the map with or without a village on it (a [coord] link from the forum)
  const atKey = at ? `${at[0]}|${at[1]}` : '';
  useEffect(() => {
    if (!at || focus !== undefined) return;
    const x = clampField(at[0], data.size), y = clampField(at[1], data.size);
    setCenter([x + 0.5, y + 0.5]);
    setSel(grid.get(y * data.size + x)?.id ?? null);
  }, [atKey]);

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
        const hot = snow[y * data.size + x] === 2 && t !== 'w';
        const hsh = (x * 73856093) ^ (y * 19349663);
        // forests keep the meadow colour underneath; the trees are drawn on top
        ctx.fillStyle = cold
          ? SNOW[t === 'w' ? 'w' : 'g']
          : t === 'l' ? ASH.lava
          : hot ? ((hsh & 1) ? ASH.g : ASH.g2)
          : col[t === 'f' || t === 'm' ? '--map-grass-2' : pair[0]];
        ctx.fillRect(Math.floor(sx(x)), Math.floor(sy(y)), Math.ceil(z) + 1, Math.ceil(z) + 1);
        if (t === 'l' && z >= 6 && (hsh & 3) === 0) {
          // glowing pools and a dark cooling crust
          const px = sx(x), py = sy(y);
          ctx.fillStyle = ASH.lava2;
          ctx.beginPath();
          ctx.ellipse(px + z * (0.3 + ((hsh >> 2) & 3) * 0.12), py + z * (0.35 + ((hsh >> 4) & 3) * 0.1), z * 0.22, z * 0.13, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = ASH.crust;
          ctx.lineWidth = Math.max(1, z * 0.06);
          ctx.beginPath();
          ctx.moveTo(px, py + z * (0.2 + ((hsh >> 6) & 3) * 0.15));
          ctx.lineTo(px + z * 0.5, py + z * (0.5 + ((hsh >> 8) & 1) * 0.2));
          ctx.lineTo(px + z, py + z * (0.3 + ((hsh >> 9) & 3) * 0.15));
          ctx.stroke();
        } else if (t === 'v' && !grid.has(y * data.size + x) && z >= 12) {
          const px = sx(x), py = sy(y);
          if ((hsh & 7) === 0) {
            // a jagged black boulder
            ctx.fillStyle = ASH.rock;
            ctx.beginPath();
            ctx.moveTo(px + z * 0.2, py + z * 0.85);
            ctx.lineTo(px + z * 0.35, py + z * 0.45);
            ctx.lineTo(px + z * 0.55, py + z * 0.6);
            ctx.lineTo(px + z * 0.72, py + z * 0.35);
            ctx.lineTo(px + z * 0.85, py + z * 0.85);
            ctx.fill();
          } else if ((hsh & 15) === 5) {
            ctx.fillStyle = ASH.ember;
            ctx.fillRect(px + z * 0.5, py + z * 0.5, Math.max(1.5, z * 0.08), Math.max(1.5, z * 0.08));
          }
        }
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
          ctx.fillStyle = cold ? '#9aa3ab' : hot ? ASH.rock : '#8a8068';
          ctx.beginPath();
          ctx.moveTo(px - z * 0.05, py + z);
          ctx.lineTo(tipX, tipY);
          ctx.lineTo(px + z * 1.05, py + z);
          ctx.fill();
          ctx.fillStyle = cold ? '#7d868f' : hot ? ASH.rock2 : '#6e654f';
          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(px + z * 1.05, py + z);
          ctx.lineTo(tipX + z * 0.08, py + z);
          ctx.fill();
          ctx.fillStyle = cold ? '#f6f9fb' : hot ? ASH.lava2 : '#e9e4d6';
          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(tipX + z * 0.16, tipY + z * 0.28);
          ctx.lineTo(tipX - z * 0.02, tipY + z * 0.22);
          ctx.lineTo(tipX - z * 0.15, tipY + z * 0.3);
          ctx.fill();
          if (hot && z >= 12 && (hsh & 3) === 0) {
            // a lazy plume of smoke from the crater
            ctx.fillStyle = 'rgba(70,62,60,0.45)';
            for (let i = 0; i < 3; i++) {
              ctx.beginPath();
              ctx.arc(tipX + z * (0.08 + i * 0.12), tipY - z * (0.18 + i * 0.22), z * (0.12 + i * 0.05), 0, Math.PI * 2);
              ctx.fill();
            }
          }
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
          void cx2;
    }
    // the quadrant lines through the middle of the realm, and each quadrant's name
    {
      const mid = data.size / 2;
      ctx.strokeStyle = col['--map-grid'];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(Math.round(sx(mid)) + 0.5, sy(fy0)); ctx.lineTo(Math.round(sx(mid)) + 0.5, sy(fy1 + 1));
      ctx.moveTo(sx(fx0), Math.round(sy(mid)) + 0.5); ctx.lineTo(sx(fx1 + 1), Math.round(sy(mid)) + 0.5);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = col['--map-grid'];
      ctx.font = `700 ${Math.min(18, 8 + z * 0.35)}px system-ui, sans-serif`;
      for (const [qx, qy, q] of [[mid - 1, mid - 1, 'NW'], [mid + 1, mid - 1, 'NE'], [mid - 1, mid + 1, 'SW'], [mid + 1, mid + 1, 'SE']] as [number, number, string][]) {
        const px = sx(qx), py = sy(qy);
        ctx.textAlign = qx < mid ? 'right' : 'left';
        ctx.fillText(q, px, qy < mid ? py - 4 : py + 14);
      }
      ctx.textAlign = 'left';
    }
    // villages: every island first (back to front), then every marker on top, so a
    // big island never hides its neighbour's flag, tribe ring or selection
    const me = pv.me.id;
    const myTribe = pv.me.tribeId;
    const shown: { v: (typeof data.villages)[number]; px: number; py: number; gx: number; gy: number; k: number; sprite: HTMLCanvasElement | null; owner: (typeof data.players)[number] | null; fill: string; mark: string | undefined }[] = [];
    // rows top to bottom, so a nearer (lower) island is always painted over a farther one
    for (let y = fy0; y <= fy1; y++) {
      for (let x = fx0; x <= fx1; x++) {
        const v = grid.get(y * data.size + x);
        if (!v) continue;
        const owner = v.ownerId !== null ? data.players[v.ownerId] ?? null : null;
        const mark = v.ownerId === me ? undefined : markFor(mk, v.id, v.ownerId, owner?.tribeId);
        let fill = col['--map-barb'];
        const rel = owner ? tribeColor(data, myTribe, owner.tribeId) : undefined;
        if (v.ownerId === me) fill = v.id === pv.me.homeVid ? '#ffffff' : col['--me'];
        else if (mark) fill = mark;
        else if (rel) fill = rel;
        else if (owner) fill = owner.color;
        const px = sx(x), py = sy(y);
        let k = 1, sprite: HTMLCanvasElement | null = null;
        if (z >= 10) {
          const ground = snow[y * data.size + x];
          const look = v.ownerId === me ? myLooks.get(v.id) ?? 'generic' : 'generic';
          const stage = villageStage(v.points);
          sprite = villageSprite(stage, look, { barb: v.ownerId === null, ground: ground === 1 ? 'snow' : ground === 2 ? 'ash' : 'grass' });
          k = stageFit(stage, spriteBox(sprite));
        }
        // the island's ground centre: rings, glows and markers are laid out around it
        const gx = px + z / 2, gy = py + z * (z < 10 ? 0.5 : 0.5 + 0.12 * k);
        shown.push({ v, px, py, gx, gy, k, sprite, owner, fill, mark });
      }
    }
    for (const { v, px, py, gx, gy, k, sprite, fill, mark } of shown) {
      const zk = z * k;
      // bonus villages wear a brass ring, but only up close: from afar it would only be noise
      if (v.bonus && z >= BONUS_RING_ZOOM) bonusRing(ctx, gx, gy, zk, 'back');
      if (v.ownerId === me) glow(ctx, gx, gy, Math.max(zk * (v.id === cur.id ? 1.35 : 1.1), 10), v.id === cur.id, v.id === pv.me.homeVid ? '#ffffff' : '#ffc43c');
      else if (mark) glow(ctx, gx, gy, Math.max(zk * 1.1, 10), false, mark);
      if (z < 10) {
        const s = Math.max(2, z - 1);
        ctx.fillStyle = fill;
        ctx.fillRect(px + (z - s) / 2, py + (z - s) / 2, s, s);
      } else if (sprite) {
        // the painted island stands on its field, centred, its walls and towers rising above it,
        // as wide as every other village of its size
        const S = zk * ISLAND;
        ctx.drawImage(sprite, gx - S / 2, gy + zk * ISLAND_FOOT - S, S, S);
      }
    }
    for (const { v, gx, gy, k, owner, fill } of shown) {
      const zk = z * k;
      if (z >= 10) {
        // owner marker, Tribal Wars style, at the island's back-left corner
        const d = Math.max(4, z * 0.16 * Math.max(k, 0.7));
        ctx.fillStyle = fill;
        ctx.strokeStyle = 'rgba(30,15,5,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(gx - zk * 0.372, gy - zk * 0.492, d / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (owner) {
          ctx.fillStyle = '#3a2614';
          ctx.fillRect(gx + zk * 0.28, gy - zk * 0.6, 1.5, zk * 0.3);
          ctx.fillStyle = fill;
          ctx.fillRect(gx + zk * 0.28 + 1.5, gy - zk * 0.59, zk * 0.16, zk * 0.1);
        }
        if (v.bonus && z >= BONUS_RING_ZOOM) {
          // the front of the ring passes before the island, with a medallion naming the bonus
          bonusRing(ctx, gx, gy, zk, 'front');
          bonusBadge(ctx, gx + zk * 0.6, gy + zk * 0.3, Math.max(6, zk * 0.15), v.bonus);
        }
        if (owner && myTribe !== null && owner.tribeId === myTribe && v.ownerId !== me) {
          ctx.strokeStyle = '#3a73c0';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(gx, gy - zk * 0.02, zk * 0.5, zk * 0.32, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      if (v.id === sel || ((v.id === hover || v.id === aimed?.id) && v.ownerId !== me)) {
        ctx.strokeStyle = v.id === sel ? 'rgba(255,255,255,0.95)' : 'rgba(255,245,215,0.7)';
        ctx.lineWidth = v.id === sel ? 2.5 : 1.8;
        ctx.setLineDash(v.id === sel ? [] : [4, 3]);
        ctx.beginPath();
        ctx.ellipse(gx, gy, Math.max(zk * 0.62, 6), Math.max(zk * 0.42, 6), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
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
      // attacks: bright red; returns: white after a clean sweep, yellow if troops were lost
      const color = c.kind === 'attack' ? '#ff2b2b' : c.kind === 'return' ? (c.losses ? '#ffd23f' : '#ffffff') : c.kind === 'support' ? col['--support-c'] : col['--ok'];
      const dotted = c.kind === 'attack' || c.kind === 'return';
      const lw = c.dir === 'in' ? 3.6 : 3;
      ctx.lineCap = 'round';
      ctx.setLineDash(dotted ? [0.1, lw * 2.4] : c.dir === 'in' ? [6, 4] : []);
      // a dark rim under the dots keeps them readable on grass and snow alike
      ctx.strokeStyle = 'rgba(20, 10, 0, 0.55)';
      ctx.lineWidth = lw + 1.6;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx2, by2);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx2, by2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineCap = 'butt';
      ctx.strokeStyle = 'rgba(20, 10, 0, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ax + (bx2 - ax) * p, ay + (by2 - ay) * p, Math.max(3, Math.min(6, z * 0.17)), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    drawMini();
  };

  /** fields shown across the minimap: a close-up of the neighbourhood, not the whole world */
  const MINI_SPAN = 40;
  /** the close-up widens when the main map is zoomed out, so your view always fits inside it */
  const miniSpan = () => {
    const c = canvas.current;
    const view = c ? Math.max(c.clientWidth, c.clientHeight) / zoom : 0;
    return Math.min(data.size, Math.max(MINI_SPAN, Math.ceil(view * 1.5)));
  };
  const miniOrigin = (): [number, number] => {
    const span = miniSpan();
    const clamp = (c: number) => Math.max(0, Math.min(data.size - span, c - span / 2));
    return [clamp(center[0]), clamp(center[1])];
  };

  const drawMini = () => {
    const m = mini.current;
    const c = canvas.current;
    if (!m || !c) return;
    const ctx = m.getContext('2d')!;
    const S = m.width;
    const col = colors.current;
    // the whole world, pre-rendered once (and again when villages or markers change)
    const store = m as HTMLCanvasElement & { _base?: HTMLCanvasElement; _rev?: string };
    const rev = `${data.rev}:${markKey}`;
    const P = 4; // pixels per field in the pre-render
    if (!store._base || store._rev !== rev) {
      const base = store._base ?? document.createElement('canvas');
      base.width = base.height = data.size * P;
      const b = base.getContext('2d')!;
      for (let y = 0; y < data.size; y++)
        for (let x = 0; x < data.size; x++) {
          const t = data.terrain[y * data.size + x];
          const zone = snow[y * data.size + x];
          b.fillStyle = t === 'l' ? ASH.lava
            : zone === 1 ? SNOW[t === 'w' ? 'w' : t === 'm' ? 'm' : t === 'f' ? 'f' : 'g']
            : zone === 2 && t !== 'w' ? (t === 'm' ? ASH.rock : ASH.g)
            : col[(TERRAIN_COLORS[t] ?? TERRAIN_COLORS['.'])[0]];
          b.fillRect(x * P, y * P, P, P);
        }
      for (const v of data.villages) {
        const owner = v.ownerId !== null ? data.players[v.ownerId] : undefined;
        const mine = v.ownerId === pv.me.id;
        const mark = mine ? undefined : markFor(mk, v.id, v.ownerId, owner?.tribeId);
        b.fillStyle = mine ? (v.id === pv.me.homeVid ? '#ffffff' : col['--me']) : mark ?? (owner ? tribeColor(data, pv.me.tribeId, owner.tribeId) : undefined) ?? owner?.color ?? col['--map-barb'];
        b.fillRect(v.x * P, v.y * P, P, P);
        if (mine || mark) {
          b.strokeStyle = 'rgba(20, 10, 0, 0.85)';
          b.lineWidth = 1;
          b.strokeRect(v.x * P + 0.5, v.y * P + 0.5, P - 1, P - 1);
        }
      }
      store._base = base;
      store._rev = rev;
    }
    const span = miniSpan();
    const [ox, oy] = miniOrigin();
    const k = S / span;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = col['--map-water'];
    ctx.fillRect(0, 0, S, S);
    ctx.drawImage(store._base, ox * P, oy * P, span * P, span * P, 0, 0, S, S);
    const W = c.clientWidth / zoom, H = c.clientHeight / zoom;
    ctx.strokeStyle = '#fff6dc';
    ctx.lineWidth = 1.5;
    ctx.strokeRect((center[0] - W / 2 - ox) * k, (center[1] - H / 2 - oy) * k, W * k, H * k);
    ctx.fillStyle = 'rgba(20, 10, 0, 0.55)';
    ctx.fillRect(0, S - 16, S, 16);
    ctx.fillStyle = '#f3e3bd';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText(`${quadrant(Math.floor(center[0]), Math.floor(center[1]), data.size)} · ${coords(Math.floor(center[0]), Math.floor(center[1]))}`, 6, S - 5);
  };

  useEffect(() => {
    readColors();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onTheme = () => { readColors(); (mini.current as unknown as { _rev?: string })._rev = ''; draw(); };
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

  // fingers on the map: one drags it around, two pinch to zoom around the point between them
  const onPointerDown = (e: PointerEvent) => {
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not every pointer can be captured */ }
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // a touchscreen laptop reports a fine pointer, so a real finger switches the crosshair on too
    if (e.pointerType === 'touch' && !touchUi) setTouchUi(true);
    if (touches.current.size === 2) {
      const [a, b] = [...touches.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom };
      drag.current = null;
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, cx: center[0], cy: center[1], moved: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pinch.current;
    if (p && touches.current.size >= 2) {
      const [a, b] = [...touches.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setZoomAround(p.zoom * (dist / p.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    const d = drag.current;
    if (d) {
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) > 4) {
        d.moved = true;
        // panning hands the read-out over to the crosshair
        if (e.pointerType !== 'mouse' && hover !== null) setHover(null);
      }
      if (d.moved) setCenter([d.cx - dx / zoom, d.cy - dy / zoom]);
      return;
    }
    const [x, y] = toField(e);
    const v = grid.get(y * data.size + x);
    setHover(v ? v.id : null);
  };
  const onPointerUp = (e: PointerEvent) => {
    touches.current.delete(e.pointerId);
    if (pinch.current) {
      // lifting one finger of a pinch ends it; the other finger does not start a drag
      if (touches.current.size < 2) pinch.current = null;
      drag.current = null;
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      const [x, y] = toField(e);
      const v = grid.get(y * data.size + x);
      setSel(v ? v.id : null);
      // phones have no hover: show the village's card where it was tapped
      if (e.pointerType !== 'mouse') setHover(v ? v.id : null);
    }
  };

  const selected = sel !== null ? byId.get(sel) : undefined;
  const hovered = hover !== null ? byId.get(hover) : undefined;

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
          <span class="muted small num">{coords(Math.floor(center[0]), Math.floor(center[1]))} · {quadrant(Math.floor(center[0]), Math.floor(center[1]), data.size)}</span>
        </div>
        <div class="map-wrap" ref={wrap}>
          <canvas
            ref={canvas}
            class="map-canvas"
            tabIndex={0}
            aria-label="World map. Drag to move, scroll or pinch to zoom, click or tap a village for details."
            onPointerDown={onPointerDown as unknown as (e: Event) => void}
            onPointerMove={onPointerMove as unknown as (e: Event) => void}
            onPointerUp={onPointerUp as unknown as (e: Event) => void}
            onPointerLeave={(e: PointerEvent) => { if (e.pointerType === 'mouse') setHover(null); }}
            onPointerCancel={(e: PointerEvent) => { touches.current.delete(e.pointerId); pinch.current = null; drag.current = null; }}
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
          {hovered && canvas.current && (
            <HoverCard
              v={hovered}
              data={data}
              x={(hovered.x + 0.5 - center[0]) * zoom + canvas.current.clientWidth / 2}
              y={(hovered.y + 0.1 - center[1]) * zoom + canvas.current.clientHeight / 2}
              mine={hovered.ownerId === pv.me.id}
              home={hovered.id === pv.me.homeVid}
            />
          )}
          {touchUi && <div class={`map-crosshair${aimed ? ' is-on' : ''}`} aria-hidden="true" />}
          {aimed && aimed.id !== hovered?.id && (
            <HoverCard v={aimed} data={data} docked mine={aimed.ownerId === pv.me.id} home={aimed.id === pv.me.homeVid} />
          )}
          <canvas
            ref={mini}
            class="minimap"
            width={220}
            height={220}
            onClick={(e) => {
              const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
              const span = miniSpan();
              const [ox, oy] = miniOrigin();
              setCenter([ox + ((e.clientX - r.left) / r.width) * span, oy + ((e.clientY - r.top) / r.height) * span]);
            }}
            aria-label="Minimap"
          />
        </div>
        <Legend data={data} />
      </div>
      <aside class="map-side">
        {selected ? <VillagePanel v={selected} data={data} onClose={() => { setSel(null); setHover(null); }} /> : (
          <div class="panel">
            <p class="muted">Click a village to see who rules it, how far away it is, and what your scouts know.</p>
            <p class="muted small">Drag to move · scroll or +/− to zoom · arrow keys pan</p>
          </div>
        )}
        <MarkersPanel data={data} />
      </aside>
    </div>
  );
}

const SNOW = { g: '#e7edf1', g2: '#dce4ea', f: '#c9d4d6', w: '#a7c4d6', m: '#c5cacf', peak: '#f5f8fa' };
/** the volcanic west: ash plains, black rock and lava */
const ASH = { g: '#5d534c', g2: '#5a504a', rock: '#3d3533', rock2: '#2b2422', lava: '#b3401c', lava2: '#f08a2c', crust: 'rgba(50,20,12,0.45)', ember: '#ff7a2a' };

/** Bonus rings only appear once you are looking closely (fields drawn at least this many pixels wide). */
const BONUS_RING_ZOOM = 16;
/** A village sprite's side at full size, in fields: roomy islands spill a little past their own field. */
const ISLAND = 1.95;
/** How far (in fields, at full size) the sprite's bottom edge sits below the island's ground centre. */
const ISLAND_FOOT = 0.38;
/**
 * How wide a village's island is drawn, in fields, by its size (villageStage): a hamlet
 * well inside its field, a great stronghold filling most of it. Every village of the same
 * size is drawn the same wherever it stands, and even the biggest stays inside its own
 * field (its height too), so two villages side by side never touch.
 */
const STAGE_WIDTH = [0.62, 0.66, 0.7, 0.74, 0.78, 0.82, 0.86, 0.9];
/** No island is drawn taller than this (fields), towers and all. */
const MAX_HEIGHT = 0.9;

/** The scale (1 = the full-size sprite) that gives this village's island its size, inside its field. */
function stageFit(stage: number, box: { w: number; h: number }): number {
  const want = STAGE_WIDTH[Math.max(0, Math.min(STAGE_WIDTH.length - 1, stage))];
  return Math.min(1, want / (ISLAND * Math.max(0.2, box.w)), MAX_HEIGHT / (ISLAND * Math.max(0.2, box.h)));
}
/** How far (in screen pixels) the touch crosshair reaches for a village when none sits right under it. */
const AIM_RADIUS_PX = 18;
/** The medallion's enamel, one per kind of bonus. */
const BONUS_TINT: Record<BonusType, string> = {
  wood: '#40682b', clay: '#9a4a27', iron: '#4d5966', farm: '#8a7322', storage: '#6b4a24', recruit: '#7a2828', all: '#8a6a2a',
};
const BRASS = { hi: '#f0cf7e', mid: '#c9a24a', dark: '#8a6a2a', ink: '#fbeec8' };

/**
 * A thin brass ring lying on the ground around a bonus village. The back half (and a soft
 * halo) goes under the island, the front half over it, so the ring seems to wrap around it.
 */
function bonusRing(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, part: 'back' | 'front') {
  const rx = z * 0.82, ry = z * 0.42;
  const lw = Math.max(1.4, z * 0.045);
  ctx.save();
  if (part === 'back') {
    // a warm glow hugging the ring, clear in the middle so the island stays crisp
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 1.3);
    g.addColorStop(0, 'rgba(240, 207, 126, 0)');
    g.addColorStop(0.55, 'rgba(240, 207, 126, 0)');
    g.addColorStop(0.77, 'rgba(240, 207, 126, 0.32)');
    g.addColorStop(1, 'rgba(240, 207, 126, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx * 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 0.75;
  }
  const [a0, a1] = part === 'back' ? [Math.PI, Math.PI * 2] : [0, Math.PI];
  // a dark bed under the metal keeps it readable on snow and ash alike
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(40, 22, 4, 0.5)';
  ctx.lineWidth = lw + 1.6;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, a0, a1);
  ctx.stroke();
  // polished brass: bright where the light catches it, darker at the flanks
  const sheen = ctx.createLinearGradient(x - rx, y, x + rx, y);
  sheen.addColorStop(0, BRASS.dark);
  sheen.addColorStop(0.3, BRASS.hi);
  sheen.addColorStop(0.55, BRASS.mid);
  sheen.addColorStop(0.8, BRASS.hi);
  sheen.addColorStop(1, BRASS.dark);
  ctx.strokeStyle = sheen;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, a0, a1);
  ctx.stroke();
  ctx.restore();
}

/** A small brass-rimmed enamel medallion with a glyph for the kind of bonus. */
function bonusBadge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, type: BonusType) {
  const tint = BONUS_TINT[type];
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  const face = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  face.addColorStop(0, shade(tint, 0.45));
  face.addColorStop(1, tint);
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  const rim = ctx.createLinearGradient(x, y - r, x, y + r);
  rim.addColorStop(0, BRASS.hi);
  rim.addColorStop(1, BRASS.dark);
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(1.2, r * 0.2);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  // the glyph
  const u = r * 0.55;
  ctx.fillStyle = BRASS.ink;
  ctx.strokeStyle = BRASS.ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (type === 'wood') {
    // a fir tree
    ctx.moveTo(x, y - u * 1.05);
    ctx.lineTo(x + u * 0.8, y + u * 0.4);
    ctx.lineTo(x - u * 0.8, y + u * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - u * 0.16, y + u * 0.35, u * 0.32, u * 0.55);
  } else if (type === 'clay') {
    // a stack of bricks
    ctx.fillRect(x - u, y - u * 0.65, u * 2, u * 1.3);
    ctx.strokeStyle = tint;
    ctx.lineWidth = Math.max(0.8, u * 0.16);
    ctx.moveTo(x - u, y); ctx.lineTo(x + u, y);
    ctx.moveTo(x, y - u * 0.65); ctx.lineTo(x, y);
    ctx.moveTo(x - u * 0.5, y); ctx.lineTo(x - u * 0.5, y + u * 0.65);
    ctx.moveTo(x + u * 0.5, y); ctx.lineTo(x + u * 0.5, y + u * 0.65);
    ctx.stroke();
  } else if (type === 'iron') {
    // an ingot
    ctx.moveTo(x - u * 0.55, y - u * 0.45);
    ctx.lineTo(x + u * 0.55, y - u * 0.45);
    ctx.lineTo(x + u, y + u * 0.5);
    ctx.lineTo(x - u, y + u * 0.5);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'farm') {
    // an ear of wheat
    ctx.lineWidth = Math.max(0.8, u * 0.16);
    ctx.moveTo(x, y + u); ctx.lineTo(x, y - u * 0.6);
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      const gy = y + u * 0.3 - k * u * 0.45;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + side * u * 0.3, gy - u * 0.12, u * 0.17, u * 0.32, side * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.beginPath();
    ctx.ellipse(x, y - u * 0.85, u * 0.16, u * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'storage') {
    // a crate
    ctx.lineWidth = Math.max(0.8, u * 0.2);
    ctx.strokeRect(x - u * 0.8, y - u * 0.8, u * 1.6, u * 1.6);
    ctx.moveTo(x - u * 0.8, y - u * 0.8); ctx.lineTo(x + u * 0.8, y + u * 0.8);
    ctx.moveTo(x + u * 0.8, y - u * 0.8); ctx.lineTo(x - u * 0.8, y + u * 0.8);
    ctx.stroke();
  } else if (type === 'recruit') {
    // crossed swords
    ctx.lineWidth = Math.max(0.9, u * 0.24);
    ctx.moveTo(x - u * 0.85, y - u * 0.85); ctx.lineTo(x + u * 0.85, y + u * 0.85);
    ctx.moveTo(x + u * 0.85, y - u * 0.85); ctx.lineTo(x - u * 0.85, y + u * 0.85);
    ctx.moveTo(x + u * 0.3, y + u * 0.75); ctx.lineTo(x + u * 0.75, y + u * 0.3);
    ctx.moveTo(x - u * 0.3, y + u * 0.75); ctx.lineTo(x - u * 0.75, y + u * 0.3);
    ctx.stroke();
  } else {
    // everything: a star
    ctx.strokeStyle = tint;
    ctx.lineWidth = Math.max(0.6, u * 0.1);
    star(ctx, x, y + u * 0.05, u * 1.1);
  }
  ctx.restore();
}

/** The halo Tribal Wars puts around villages: gold for yours, white for your home, any colour for markers. */
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, strong: boolean, color: string) {
  const [cr, cg, cb] = rgbOf(color);
  const rgba = (a: number, lift = 0) =>
    `rgba(${Math.round(cr + (255 - cr) * lift)}, ${Math.round(cg + (255 - cg) * lift)}, ${Math.round(cb + (255 - cb) * lift)}, ${a})`;
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
  g.addColorStop(0, rgba(strong ? 0.5 : 0.38, 0.35));
  g.addColorStop(0.5, rgba(strong ? 0.26 : 0.18));
  g.addColorStop(1, rgba(0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = rgba(0.9);
  ctx.shadowBlur = strong ? 8 : 5;
  ctx.strokeStyle = rgba(strong ? 1 : 0.85, 0.25);
  ctx.lineWidth = strong ? 2.2 : 1.6;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.62, r * 0.44, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Tribal Wars map colours: your tribe blue, allies turquoise, pacts purple, enemies red. */
export const TRIBE_COLORS = { own: '#3b7bff', ally: '#19c7cf', nap: '#a66bff', enemy: '#ff3b30' } as const;
function tribeColor(data: MapData, myTribe: number | null, theirs: number | null): string | undefined {
  if (myTribe == null || theirs == null) return undefined;
  if (myTribe === theirs) return TRIBE_COLORS.own;
  const rel = data.tribes[myTribe]?.diplomacy?.[theirs];
  return rel ? TRIBE_COLORS[rel] : undefined;
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function rgbOf(hex: string): [number, number, number] {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 196, 60];
}

function shade(hex: string, amt: number): string {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  const f = (s: string) => Math.max(0, Math.min(255, Math.round(parseInt(s, 16) * (1 + amt))));
  return `rgb(${f(m[1])},${f(m[2])},${f(m[3])})`;
}

/** What a bonus village gives its ruler, in a few words. */
function bonusLabel(b: BonusType): string {
  return b === 'all' ? '+30% all resources' : b === 'farm' ? '+10% population' : b === 'storage' ? '+50% storage' : b === 'recruit' ? 'faster recruitment' : `+100% ${b}`;
}

/** The game icon that stands for each kind of bonus (the map medallion's glyph, in the top bar's art). */
const BONUS_ICON: Record<BonusType, string> = { wood: 'wood', clay: 'clay', iron: 'iron', farm: 'pop', storage: 'storage', recruit: 'attack', all: 'star' };

/** A bonus spelled out: its icon in a brass medallion, the bonus beside it. */
function BonusChip({ type }: { type: BonusType }) {
  return (
    <span class="bonus-chip" style={{ '--bonus-tint': BONUS_TINT[type] }}>
      <span class="bonus-chip-medal" aria-hidden="true"><Icon name={BONUS_ICON[type]} size={20} /></span>
      <span class="bonus-chip-text">{bonusLabel(type)}</span>
    </span>
  );
}

/** The village read-out: floats over the village under the cursor, or sits docked atop the map for the touch crosshair. */
function HoverCard({ v, data, x, y, mine, home, docked }: { v: MapVillage; data: MapData; x?: number; y?: number; mine: boolean; home: boolean; docked?: boolean }) {
  const owner = v.ownerId !== null ? data.players[v.ownerId] : null;
  const tribe = owner?.tribeId ? data.tribes[owner.tribeId] : null;
  const m = marks.value;
  const color = mine ? (home ? '#ffffff' : '#ffc43c') : markFor(m, v.id, v.ownerId, owner?.tribeId) ?? owner?.color ?? '#9c8f7a';
  return (
    <div class={`map-hover${docked ? ' is-docked' : ''}`} role={docked ? 'status' : 'tooltip'} style={docked ? undefined : { left: `${x}px`, top: `${y}px` }}>
      <div class="mh-name">{v.name}</div>
      <div class="mh-owner">
        <i class="mh-dot" style={{ background: color }} />
        {owner ? owner.name : 'Barbarians'}{tribe && <span class="mh-tribe"> [{tribe.tag}]</span>}
        {home && <span class="mh-tag">Home</span>}
      </div>
      {v.bonus && <div class="mh-bonus"><BonusChip type={v.bonus} /></div>}
      <div class="mh-meta">
        <span><Icon name="points" size={12} /> <b class="num">{fmt(v.points)}</b></span>
        <span class="num">{coords(v.x, v.y)} · {quadrant(v.x, v.y, view.value!.config.size)}</span>
      </div>
    </div>
  );
}

function Legend({ data }: { data: MapData }) {
  const pane = usePane();
  const pv = view.value!;
  const near = Object.values(data.players).filter((p) => p.id !== pv.me.id).sort((a, b) => b.points - a.points).slice(0, 8);
  return (
    <div class="legend">
      <span><i class="sw" style={{ background: '#ffffff' }} /> Your home</span>
      <span><i class="sw" style={{ background: 'var(--me)' }} /> Your other villages</span>
      <span><i class="sw" style={{ background: 'var(--map-barb)' }} /> Barbarians</span>
      <span><i class="sw sw-bonus" /> Bonus village (up close)</span>
      {pv.me.tribeId != null && <>
        <span><i class="sw" style={{ background: TRIBE_COLORS.own }} /> Tribe</span>
        <span><i class="sw" style={{ background: TRIBE_COLORS.ally }} /> Allies</span>
        <span><i class="sw" style={{ background: TRIBE_COLORS.nap }} /> Pact</span>
        <span><i class="sw" style={{ background: TRIBE_COLORS.enemy }} /> Enemies</span>
      </>}
      {near.map((p) => (
        <button type="button" class="link" onClick={() => pane.go({ name: 'ranking', player: p.id })}>
          <i class="sw" style={{ background: p.color }} /> {p.name}
        </button>
      ))}
    </div>
  );
}

/** Invite a real ruler straight from the map, if you are in a tribe and may recruit. */
function TribeInvite({ pid, name, tribeId }: { pid: number; name: string; tribeId: number | null }) {
  const pv = view.value!;
  if (pv.me.tribeId == null || tribeId === pv.me.tribeId) return null;
  const mine = host.value!.tribeHome().tribe;
  if (!mine || !mine.myRights.includes('invite')) return null;
  if (mine.invites.some((i) => i.pid === pid)) return <p class="muted small">{name} has an invitation to your tribe.</p>;
  return (
    <Btn small variant="ghost" onClick={() => act({ type: 'tribeInvite', name }, `${name} has been invited to [${mine.tag}].`)}>
      <Icon name="tribe" size={14} /> Invite to tribe{tribeId != null ? ' (already in a tribe)' : ''}
    </Btn>
  );
}

function VillagePanel({ v, data, onClose }: { v: MapVillage; data: MapData; onClose: () => void }) {
  const pane = usePane();
  const h = host.value!;
  const pv = view.value!;
  const cur = pane.village.value!;
  const info = h.villageInfo(v.id, cur.id)!;
  const [note, setNote] = useState(info.note ?? '');
  useEffect(() => setNote(info.note ?? ''), [v.id]);
  const owner = v.ownerId !== null ? data.players[v.ownerId] : null;
  const own = v.ownerId === pv.me.id;
  const tpls = loadFarmTemplates();
  const canSend = (u: Units) => hasUnits(u) && Object.entries(u).every(([k, n]) => (cur.units[k as UnitId] ?? 0) >= (n ?? 0));
  const it = info.intel;
  const quick: UnitId[] = ['spear', 'axe', 'scout', 'light', 'heavy', 'ram', 'noble'];
  return (
    <div class="panel map-info">
      <header>
        <button type="button" class="icon-btn map-info-close" aria-label="Close" onClick={onClose}><Icon name="close" size={14} /></button>
        <h3>{v.name}</h3>
        {info.bonus && <div class="map-info-bonus"><BonusChip type={info.bonus} /></div>}
        <div class="muted small map-info-meta">
          <span class="num coord-text">{coords(v.x, v.y)}</span>
          <CopyButton text={coords(v.x, v.y)} label={`Copy coordinates ${coords(v.x, v.y)}`} />
          <CopyButton text={`[coord]${coords(v.x, v.y)}[/coord]`} label="Copy as BBCode for the forum" class="is-bb">BBCode</CopyButton>
          <span>· {quadrant(v.x, v.y, view.value!.config.size)} · <span class="num">{fmt(v.points)}</span> points</span>
        </div>
      </header>
      <dl class="facts">
        <dt>Ruler</dt>
        <dd>{owner ? <button type="button" class="link" onClick={() => pane.go({ name: 'ranking', player: owner.id })}>{owner.name}</button> : 'Barbarians'}{owner?.tribeId != null && data.tribes[owner.tribeId] && <> <TribeTag id={owner.tribeId} tag={data.tribes[owner.tribeId].tag} /></>}</dd>
        {!own && <><dt>Distance</dt><dd class="num">{info.distanceFrom?.toFixed(1)} fields</dd></>}
        {info.protected && <><dt>Status</dt><dd>Beginner protection</dd></>}
        {own && info.loyalty !== undefined && <><dt>Loyalty</dt><dd class="num">{Math.floor(info.loyalty)}</dd></>}
      </dl>
      {own ? (
        <div class="row gap wrap">
          <Btn small onClick={() => { pane.vid.value = v.id; pane.go({ name: 'village' }); }}>Open village</Btn>
          {v.id !== cur.id && <Btn small variant="ghost" onClick={() => { rallyTarget.value = { x: v.x, y: v.y, kind: 'support' }; pane.go({ name: 'building', id: 'rally', tab: 'send' }); }}>Send troops</Btn>}
          {v.id !== cur.id && <Btn small variant="ghost" onClick={() => { marketTarget.value = { x: v.x, y: v.y }; pane.go({ name: 'building', id: 'market', tab: 'send' }); }}>Send resources</Btn>}
        </div>
      ) : (
        <>
          <div class="row gap wrap">
            <Btn small variant="danger" onClick={() => { rallyTarget.value = { x: v.x, y: v.y, kind: 'attack' }; pane.go({ name: 'building', id: 'rally', tab: 'send' }); }}><Icon name="attack" size={14} /> Attack</Btn>
            {owner && <Btn small variant="ghost" onClick={() => { rallyTarget.value = { x: v.x, y: v.y, kind: 'support' }; pane.go({ name: 'building', id: 'rally', tab: 'send' }); }}><Icon name="support" size={14} /> Support</Btn>}
            <Btn small variant="ghost" disabled={(cur.units.scout ?? 0) < 1} onClick={() => act({ type: 'send', vid: cur.id, target: v.id, kind: 'attack', units: { scout: Math.min(cur.units.scout ?? 0, owner ? 5 : 1) } }, 'Scouts are riding out.')}>
              <Icon name="scout" size={14} /> Scout
            </Btn>
          </div>
          {v.ownerId === null && (
            <div class="row gap wrap">
              {tpls.map((t, i) => (
                <Btn small class="farm-quick" disabled={!canSend(t.units)} title={`Send farm template ${tplName(t, i)}`} onClick={() => act({ type: 'send', vid: cur.id, target: v.id, kind: 'attack', units: t.units }, 'Raid sent.')}><span class="trunc">Farm {tplName(t, i)}</span></Btn>
              ))}
              <Btn small variant="ghost" class="farm-quick" disabled={!canSend(tpls[0].units)} title={`Send ${tplName(tpls[0], 0)} and keep repeating`} onClick={() => act({ type: 'send', vid: cur.id, target: v.id, kind: 'attack', units: tpls[0].units, repeat: true }, 'Repeating raid sent.')}><span class="trunc">{tplName(tpls[0], 0)}</span> ↻ repeat</Btn>
            </div>
          )}
          {owner && <Btn small variant="quiet" onClick={() => { marketTarget.value = { x: v.x, y: v.y }; pane.go({ name: 'building', id: 'market', tab: 'send' }); }}>Send resources</Btn>}
          {owner && owner.kind === 'human' && <TribeInvite pid={owner.id} name={owner.name} tribeId={owner.tribeId} />}
        </>
      )}
      {!own && info.travel && (
        <details class="travel">
          <summary>Travel times</summary>
          <table class="level-table">
            <tbody>
              {quick.map((u) => (
                <tr><td><UnitIcon u={u} size={16} /> {unitName(u)}</td><td class="right num">{fmtDur((info.travel![u] ?? 0) / warp.value)}</td></tr>
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
          {it.units && <div class="small">Troops seen: <UnitList units={it.units} empty="none" theme={v.theme ?? 'classic'} /></div>}
          {it.buildings && <p class="small muted">Buildings: {Object.entries(it.buildings).filter(([, l]) => (l ?? 0) > 0).map(([b, l]) => `${b} ${l}`).join(', ')}</p>}
        </div>
      )}
      {!own && <MarkRow v={v} data={data} />}
      <label class="field">
        <span>Notes</span>
        <textarea id="village-note" rows={2} value={note} onInput={(e) => setNote(e.currentTarget.value)} onBlur={() => act({ type: 'note', vid: v.id, text: note })} placeholder="Private notes about this village" />
      </label>
    </div>
  );
}

function Swatches({ value, onPick }: { value?: string; onPick: (c: string | null) => void }) {
  return (
    <div class="swatches">
      {MARK_COLORS.map((c) => (
        <button type="button" class={`swatch ${value === c ? 'is-on' : ''}`} style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => onPick(c)} />
      ))}
      <label class="swatch swatch-custom" title="Any colour">
        <input type="color" value={value ?? '#3fd16b'} onInput={(e) => onPick(e.currentTarget.value)} aria-label="Pick any colour" />
      </label>
      {value && <button type="button" class="link small" onClick={() => onPick(null)}>clear</button>}
    </div>
  );
}

/** Mark the ruler (all their villages) or just this village, straight from the village panel. */
function MarkRow({ v, data }: { v: MapVillage; data: MapData }) {
  const m = marks.value;
  const owner = v.ownerId !== null ? data.players[v.ownerId] : null;
  return (
    <div class="mark-row">
      <h4>Mark on the map</h4>
      {owner && (
        <div class="small">
          <b>All of {owner.name}'s villages</b>
          <Swatches value={m.players[owner.id]} onPick={(c) => setMark('players', owner.id, c)} />
        </div>
      )}
      <div class="small">
        <b>Only this village</b>
        <Swatches value={m.villages[v.id]} onPick={(c) => setMark('villages', v.id, c)} />
      </div>
    </div>
  );
}

/** Every marker in one place, plus a way to mark any ruler or tribe by name. */
function MarkersPanel({ data }: { data: MapData }) {
  const pv = view.value!;
  const m = marks.value;
  const [kind, setKind] = useState<'players' | 'tribes'>('players');
  const [name, setName] = useState('');
  const [color, setColor] = useState(MARK_COLORS[0]);
  const players = Object.values(data.players).filter((p) => p.id !== pv.me.id).sort((a, b) => a.name.localeCompare(b.name));
  const tribes = Object.values(data.tribes).sort((a, b) => a.name.localeCompare(b.name));
  const add = () => {
    const q = name.trim().toLowerCase();
    if (!q) return;
    const hit = kind === 'players'
      ? players.find((p) => p.name.toLowerCase() === q) ?? players.find((p) => p.name.toLowerCase().includes(q))
      : tribes.find((t) => t.name.toLowerCase() === q || t.tag.toLowerCase() === q) ?? tribes.find((t) => t.name.toLowerCase().includes(q));
    if (!hit) return;
    setMark(kind, hit.id, color);
    setName('');
  };
  const rows: { kind: keyof Marks; id: number; label: string; sub: string; color: string }[] = [];
  for (const [id, c] of Object.entries(m.players)) {
    const p = data.players[Number(id)];
    rows.push({ kind: 'players', id: Number(id), label: p?.name ?? 'Fallen ruler', sub: p ? `${p.villages} villages` : '', color: c });
  }
  for (const [id, c] of Object.entries(m.tribes)) {
    const t = data.tribes[Number(id)];
    rows.push({ kind: 'tribes', id: Number(id), label: t ? `[${t.tag}] ${t.name}` : 'Disbanded tribe', sub: 'tribe', color: c });
  }
  const byId = new Map(data.villages.map((v) => [v.id, v]));
  for (const [id, c] of Object.entries(m.villages)) {
    const v = byId.get(Number(id));
    rows.push({ kind: 'villages', id: Number(id), label: v ? v.name : 'Lost village', sub: v ? coords(v.x, v.y) : '', color: c });
  }
  return (
    <div class="panel markers">
      <h3>Map markers</h3>
      <p class="muted small">Colour a ruler's or tribe's villages so they stand out, with a glow like your own.</p>
      <form class="mark-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <div class="seg">
          <button type="button" class={kind === 'players' ? 'is-on' : ''} onClick={() => setKind('players')}>Player</button>
          <button type="button" class={kind === 'tribes' ? 'is-on' : ''} onClick={() => setKind('tribes')}>Tribe</button>
        </div>
        <input type="text" list="mark-names" value={name} onInput={(e) => setName(e.currentTarget.value)} placeholder={kind === 'players' ? 'Ruler name' : 'Tribe name or tag'} aria-label="Name to mark" />
        <datalist id="mark-names">
          {kind === 'players' ? players.map((p) => <option value={p.name} />) : tribes.map((t) => <option value={t.name} />)}
        </datalist>
        <Swatches value={color} onPick={(c) => c && setColor(c)} />
        <Btn small type="submit" disabled={!name.trim()}>Mark</Btn>
      </form>
      {rows.length > 0 && (
        <ul class="mark-list">
          {rows.map((r) => (
            <li>
              <label class="mark-chip" style={{ background: r.color }} title="Change colour">
                <input type="color" value={r.color} onInput={(e) => setMark(r.kind, r.id, e.currentTarget.value)} aria-label={`Colour for ${r.label}`} />
              </label>
              <span class="grow"><b>{r.label}</b> <span class="muted small">{r.sub}</span></span>
              <button type="button" class="icon-btn" aria-label={`Remove marker for ${r.label}`} onClick={() => setMark(r.kind, r.id, null)}><Icon name="close" size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
