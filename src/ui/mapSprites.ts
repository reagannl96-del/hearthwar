// Painted map sprites, drawn once into offscreen canvases and stamped onto the
// world map at any zoom. Villages are little isometric hamlets on their own plot
// of land, in the manner of the Tribal Wars map: houses with a lit and a shaded
// side, thatch roofs that turn to tile as a village grows, then palisades, stone
// walls with towers and a keep.

const SIZE = 128;
const cache = new Map<string, HTMLCanvasElement>();

type Kind = 'barb' | 'player';
type Pt = [number, number];

const ISO_X = 0.87, ISO_Y = 0.5;

function poly(ctx: CanvasRenderingContext2D, pts: Pt[], fill: string, stroke?: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

const up = (p: Pt, h: number): Pt => [p[0], p[1] - h];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

interface HouseStyle { roof: string; roofDark: string; wallL: string; wallR: string; ruin?: boolean; snow?: boolean }

/**
 * An isometric house standing on its front corner (x, y): w runs up-right, d runs
 * up-left, h is the wall height and the ridge runs along w.
 */
function isoHouse(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number, roofH: number, s: HouseStyle) {
  const u: Pt = [w * ISO_X, -w * ISO_Y];
  const v: Pt = [-d * ISO_X, -d * ISO_Y];
  const F: Pt = [x, y], R = add(F, u), L = add(F, v), B = add(R, v);
  const ink = 'rgba(35,20,8,0.75)';
  // soft shadow on the ground
  ctx.fillStyle = 'rgba(30,18,5,0.28)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.45 + 3, y - d * 0.2, (w + d) * 0.55, (w + d) * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  const rL = up(mid(F, L), h + roofH), rR = up(mid(R, B), h + roofH);
  if (!s.ruin) poly(ctx, [up(L, h), up(B, h), rR, rL], s.roofDark, ink); // back slope
  poly(ctx, [F, L, up(L, h), up(F, h)], s.wallL, ink); // lit front-left wall
  if (!s.ruin) poly(ctx, [up(F, h), up(L, h), rL], s.wallL, ink); // gable
  poly(ctx, [F, R, up(R, h), up(F, h)], s.wallR, ink); // shaded front-right wall
  // door and a window
  const door = mid(F, L);
  poly(ctx, [add(door, [-1.2, 0.6]), add(door, [1.2, -0.6]), add(up(door, h * 0.6), [1.2, -0.6]), add(up(door, h * 0.6), [-1.2, 0.6])], '#3a2414');
  const win = add(F, [u[0] * 0.5, u[1] * 0.5]);
  poly(ctx, [add(up(win, h * 0.45), [-1.1, 0.6]), add(up(win, h * 0.45), [1.1, -0.6]), add(up(win, h * 0.72), [1.1, -0.6]), add(up(win, h * 0.72), [-1.1, 0.6])], s.ruin ? '#2a1d12' : '#f3cf7a');
  if (s.ruin) {
    // broken wall tops and scattered stones instead of a roof
    ctx.fillStyle = s.wallR;
    for (let i = 0; i < 3; i++) ctx.fillRect(F[0] + i * 3 - 2, F[1] - h - 2 - (i % 2) * 2, 2, 2);
    return;
  }
  poly(ctx, [up(F, h), up(R, h), rR, rL], s.roof, ink); // front slope
  // roof texture: a couple of darker courses
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 0.7;
  for (const k of [0.35, 0.68]) {
    const a = [up(F, h)[0] + (rL[0] - up(F, h)[0]) * k, up(F, h)[1] + (rL[1] - up(F, h)[1]) * k];
    const b = [up(R, h)[0] + (rR[0] - up(R, h)[0]) * k, up(R, h)[1] + (rR[1] - up(R, h)[1]) * k];
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  if (s.snow) {
    poly(ctx, [add(rL, [0, 2.2]), add(rR, [0, 2.2]), rR, rL], '#ffffff');
  }
  // highlight along the ridge
  ctx.strokeStyle = 'rgba(255,240,210,0.45)';
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(rL[0], rL[1] + 0.6); ctx.lineTo(rR[0], rR[1] + 0.6); ctx.stroke();
}

/** A round tower: stone drum, darker right side, conical roof or battlements. */
function isoTower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, h: number, stone: string, roof?: string, snow = false) {
  ctx.fillStyle = 'rgba(30,18,5,0.3)';
  ctx.beginPath(); ctx.ellipse(x + 3, y + 1, r * 1.5, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = stone;
  ctx.fillRect(x - r, y - h, r * 2, h);
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x + r * 0.15, y - h, r * 0.85, h);
  ctx.strokeStyle = 'rgba(35,20,8,0.7)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(x - r, y - h, r * 2, h);
  if (roof) {
    poly(ctx, [[x - r - 1.2, y - h], [x, y - h - r * 2.6], [x + r + 1.2, y - h]], roof, 'rgba(35,20,8,0.75)');
    poly(ctx, [[x, y - h - r * 2.6], [x + r + 1.2, y - h], [x + r * 0.2, y - h]], 'rgba(0,0,0,0.2)');
    if (snow) poly(ctx, [[x - r * 0.45, y - h - r * 1.4], [x, y - h - r * 2.6], [x + r * 0.45, y - h - r * 1.4]], '#ffffff');
  } else {
    ctx.fillStyle = stone;
    for (let i = 0; i < 3; i++) ctx.fillRect(x - r + i * r * 0.8, y - h - 2.2, r * 0.45, 2.4);
  }
}

function tinyTree(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, winter: boolean) {
  ctx.fillStyle = 'rgba(30,18,5,0.3)';
  ctx.beginPath(); ctx.ellipse(x + 2, y + 1, 4 * k, 1.8 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4a3220';
  ctx.fillRect(x - 0.6, y - 3 * k, 1.4, 3 * k);
  poly(ctx, [[x, y - 13 * k], [x + 4.5 * k, y - 2 * k], [x - 4.5 * k, y - 2 * k]], winter ? '#3d5a3d' : '#2f4d24', 'rgba(20,30,10,0.6)');
  poly(ctx, [[x, y - 13 * k], [x + 4.5 * k, y - 2 * k], [x + 0.6, y - 2 * k]], 'rgba(0,0,0,0.2)');
  if (winter) poly(ctx, [[x, y - 13 * k], [x + 2.2 * k, y - 7.5 * k], [x - 2.2 * k, y - 7.5 * k]], '#ffffff');
}

/** A ring of palisade stakes (or a stone wall) around the plot, drawn back half or front half. */
function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, front: boolean, stone: string | null, h: number) {
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const a = front ? (i / n) * Math.PI : Math.PI + (i / n) * Math.PI;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    if (stone) {
      const nx = cx + Math.cos(a + Math.PI / n) * rx, ny = cy + Math.sin(a + Math.PI / n) * ry;
      if (i === n) break;
      poly(ctx, [[x, y], [nx, ny], [nx, ny - h], [x, y - h]], front ? stone : shade(stone, -0.12), 'rgba(35,20,8,0.55)');
      if (i % 2 === 0) ctx.fillStyle = stone, ctx.fillRect(x - 1, y - h - 1.8, 2.2, 2);
    } else {
      ctx.fillStyle = front ? '#8a5a30' : '#6e4524';
      ctx.fillRect(x - 0.9, y - h, 1.8, h);
      ctx.fillStyle = '#5a3a20';
      ctx.beginPath(); ctx.moveTo(x - 0.9, y - h); ctx.lineTo(x, y - h - 1.6); ctx.lineTo(x + 0.9, y - h); ctx.fill();
    }
  }
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** tier 0..5 by points */
export function villageSprite(tier: number, kind: Kind, winter = false): HTMLCanvasElement {
  const key = `${tier}|${kind}|${winter ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  const barb = kind === 'barb';
  let seed = tier * 131 + (barb ? 7 : 3);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const cx = SIZE / 2, cy = SIZE * 0.6;
  const rx = SIZE * (0.3 + tier * 0.03), ry = rx * 0.52;

  // the plot: a rounded eight-sided patch of beaten earth with a dark rim
  const plot: Pt[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    plot.push([cx + Math.cos(a) * (rx + 7), cy + Math.sin(a) * (ry + 5)]);
  }
  ctx.save();
  ctx.translate(2, 3);
  poly(ctx, plot, 'rgba(25,15,5,0.35)');
  ctx.restore();
  const earth = winter ? (barb ? '#cfc9bf' : '#e3dccd') : barb ? '#a89470' : '#c9a86c';
  poly(ctx, plot, earth, winter ? '#9aa2a8' : '#5c4526');
  // grass tufts and worn paths on the plot
  ctx.fillStyle = winter ? '#f4f7f9' : barb ? '#7d8a45' : '#8a9a48';
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, rr = 0.55 + rnd() * 0.4;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr, 2.4, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = winter ? 'rgba(160,150,135,0.5)' : 'rgba(120,85,45,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy + ry + 4); ctx.lineTo(cx + 4, cy - 2); ctx.lineTo(cx - rx * 0.6, cy - ry * 0.3); ctx.stroke();

  const stone = barb ? '#8a8479' : '#b8ae98';
  const tile = winter ? '#e9eef2' : barb ? '#7c756c' : '#c0512d';
  const tileDark = winter ? '#c7d0d8' : barb ? '#5f5a53' : '#8e3a1f';
  const thatch = winter ? '#eef2f5' : barb ? '#8f8065' : '#d6a64a';
  const thatchDark = winter ? '#cdd5dc' : barb ? '#6c604b' : '#a47a30';
  const useTile = tier >= 2;
  const house = (ruin = false): HouseStyle => ({
    roof: useTile ? tile : thatch,
    roofDark: useTile ? tileDark : thatchDark,
    wallL: barb ? '#b3a78f' : '#f0e2c0',
    wallR: barb ? '#8d826c' : '#c9b48b',
    ruin,
    snow: winter,
  });

  // back half of the enclosure
  const walled = tier >= 4;
  const fenced = tier >= 2 && !walled;
  if (fenced) ring(ctx, cx, cy, rx - 1, ry - 1, false, null, 5);
  if (walled) ring(ctx, cx, cy, rx - 1, ry - 1, false, stone, 6 + tier);

  // trees at the edge of the plot, behind the houses
  tinyTree(ctx, cx - rx * 0.78, cy - ry * 0.45, 1, winter);
  tinyTree(ctx, cx + rx * 0.72, cy - ry * 0.55, 0.9, winter);

  // the buildings, back to front
  const spots: [number, number, number, number][] = [
    // x, y (relative to plot), width, depth
    [-0.1, -0.55, 11, 7], [0.4, -0.3, 10, 6], [-0.55, -0.15, 10, 7], [0.1, 0.05, 12, 8], [0.55, 0.25, 9, 6], [-0.35, 0.35, 10, 6], [0.2, 0.55, 9, 6],
  ];
  const count = [2, 3, 4, 5, 6, 7][tier] ?? 7;
  const placed = spots.slice(0, count).sort((a, b) => a[1] - b[1]);
  const keepAt = tier >= 3 ? Math.floor(placed.length / 2) : -1;
  placed.forEach(([ox, oy, w, d], i) => {
    const x = cx + ox * rx - w * 0.4, y = cy + oy * ry + 4;
    const grow = 1.3 + tier * 0.03;
    if (i === keepAt) {
      // the hall: a tall stone keep (or a big manor for barbarians)
      const kw = 9 + tier * 1.6;
      isoHouse(ctx, x - 2, y + 2, kw, kw * 0.8, 10 + tier * 2.2, 5 + tier, {
        roof: barb ? tileDark : tile, roofDark: tileDark, wallL: barb ? '#a39a88' : '#d8cfbc', wallR: barb ? '#7f7768' : '#a99f8a', snow: winter,
      });
      if (!barb && tier >= 4) {
        // a banner on the keep
        ctx.fillStyle = '#4a2f1a';
        ctx.fillRect(x + kw * 0.3, y - 30 - tier * 3, 1, 12);
        ctx.fillStyle = '#e0a526';
        ctx.fillRect(x + kw * 0.3 + 1, y - 30 - tier * 3, 6, 4);
      }
      return;
    }
    const ruin = barb && tier <= 2 && i % 3 === 1;
    isoHouse(ctx, x, y, w * grow, d * grow, 6 + tier * 0.6, 4.5 + tier * 0.3, house(ruin));
    if (i === 0 && tier >= 1 && !barb) {
      // a hay stack by the first house
      ctx.fillStyle = winter ? '#eef2f5' : '#d8b04e';
      ctx.beginPath(); ctx.ellipse(x - 5, y - 2, 3, 2.2, 0, Math.PI, 0); ctx.fill();
    }
  });

  // front half of the enclosure, with towers on stone walls
  if (fenced) ring(ctx, cx, cy, rx - 1, ry - 1, true, null, 5);
  if (walled) {
    ring(ctx, cx, cy, rx - 1, ry - 1, true, stone, 6 + tier);
    const roof = barb ? undefined : winter ? '#eef2f5' : '#b8502c';
    for (const a of [0.15, Math.PI / 2, Math.PI - 0.15]) {
      isoTower(ctx, cx + Math.cos(a) * (rx - 1), cy + Math.sin(a) * (ry - 1), 3.4 + tier * 0.25, 11 + tier * 1.4, stone, roof, winter);
    }
  }
  // a couple of trees in front
  tinyTree(ctx, cx + rx * 0.85, cy + ry * 0.35, 0.8, winter);
  if (barb) tinyTree(ctx, cx - rx * 0.6, cy + ry * 0.6, 0.9, winter);

  cache.set(key, c);
  return c;
}

const treeCache = new Map<string, HTMLCanvasElement>();
const TREE_COLORS = ['#c9702a', '#b3432a', '#d9a83a', '#3f5a2e', '#c98f2e', '#34502a'];

/** A small clump of autumn trees for forest tiles. */
export function forestSprite(variant: number, winter = false): HTMLCanvasElement {
  const key = `${variant % 6}|${winter ? 1 : 0}`;
  const hit = treeCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  let s = variant * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const trees: [number, number, number, string, boolean][] = [];
  for (let i = 0; i < 3; i++) {
    const pine = winter ? rnd() < 0.75 : rnd() < 0.4;
    trees.push([10 + rnd() * 44, 18 + rnd() * 38, 0.8 + rnd() * 0.5, pine ? (rnd() < 0.5 ? '#3f5a2e' : '#34502a') : TREE_COLORS[Math.floor(rnd() * 3) + (rnd() < 0.3 ? 4 : 0)], pine]);
  }
  trees.sort((a, b) => a[1] - b[1]);
  for (const [x, y, k, col, pine] of trees) {
    ctx.fillStyle = 'rgba(30,20,5,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 2, 7 * k, 3 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3d25';
    ctx.fillRect(x - 1, y - 5 * k, 2.4, 6 * k);
    ctx.fillStyle = col;
    if (pine) {
      ctx.beginPath();
      ctx.moveTo(x, y - 22 * k);
      ctx.lineTo(x + 8 * k, y - 3 * k);
      ctx.lineTo(x - 8 * k, y - 3 * k);
      ctx.closePath();
      ctx.fill();
      if (winter) {
        ctx.fillStyle = '#f4f7f9';
        ctx.beginPath();
        ctx.moveTo(x, y - 22 * k);
        ctx.lineTo(x + 4.5 * k, y - 12 * k);
        ctx.lineTo(x - 4.5 * k, y - 12 * k);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.moveTo(x, y - 22 * k);
      ctx.lineTo(x + 8 * k, y - 3 * k);
      ctx.lineTo(x + 1, y - 3 * k);
      ctx.closePath();
      ctx.fill();
    } else if (winter) {
      // bare winter branches
      ctx.strokeStyle = '#5a4535';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y - 4 * k); ctx.lineTo(x, y - 16 * k);
      ctx.moveTo(x, y - 10 * k); ctx.lineTo(x - 6 * k, y - 17 * k);
      ctx.moveTo(x, y - 12 * k); ctx.lineTo(x + 6 * k, y - 19 * k);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y - 11 * k, 8 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,0.18)';
      ctx.beginPath();
      ctx.arc(x - 3 * k, y - 14 * k, 4 * k, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  treeCache.set(key, c);
  return c;
}
