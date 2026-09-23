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

/** A charred, leafless tree for the volcanic west. */
function deadTree(ctx: CanvasRenderingContext2D, x: number, y: number, k: number) {
  ctx.fillStyle = 'rgba(10,5,2,0.35)';
  ctx.beginPath(); ctx.ellipse(x + 2, y + 1, 3.5 * k, 1.5 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a211d';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x, y - 10 * k);
  ctx.moveTo(x, y - 6 * k); ctx.lineTo(x + 3.5 * k, y - 9.5 * k);
  ctx.moveTo(x, y - 4 * k); ctx.lineTo(x - 3 * k, y - 7.5 * k);
  ctx.stroke();
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

/**
 * A village on the world map, by size (points):
 *   0: under 300    a hamlet inside a palisade: two thatched cottages round a campfire
 *   1: 300-1000     a bigger stockade with a wooden watchtower and a longhouse
 *   2: 1000-3000    stone walls with round towers and banners, timber houses, a fountain and a field
 *   3: 3000-9000    a walled town around a stone keep, with a market stall
 *   4: 9000+        a castle on its hill above the town, towers and flags everywhere
 * Player villages fly blue flags under blue roofs; barbarian villages are drab and
 * ragged, with no banners. Snow in the north, ash in the volcanic west.
 */
export function villageSprite(tier: number, kind: Kind, winter = false, volcanic = false): HTMLCanvasElement {
  tier = Math.max(0, Math.min(4, tier));
  const key = `v2|${tier}|${kind}|${winter ? 1 : 0}|${volcanic ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  const RES = 2;
  c.width = c.height = SIZE * RES;
  const ctx = c.getContext('2d')!;
  ctx.scale(RES, RES);
  const barb = kind === 'barb';
  let seed = tier * 131 + (barb ? 7 : 3) + (winter ? 17 : 0);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const ink = 'rgba(35,20,8,0.75)';

  const cx = SIZE / 2, cy = SIZE * 0.62;
  const rx = [30, 38, 45, 50, 55][tier], ry = rx * 0.52;

  // ---- palette ----
  const grass = volcanic ? '#5a504a' : winter ? '#e8edf0' : barb ? '#7c8a44' : '#7f9c3c';
  const grassLt = volcanic ? '#685c54' : winter ? '#f7fafb' : barb ? '#8a9750' : '#94ae4c';
  const earthSide = volcanic ? '#2e2624' : winter ? '#a7a39a' : '#6b4a28';
  const dirt = volcanic ? '#453c37' : winter ? '#d9d4ca' : barb ? '#a08a62' : '#c2a46c';
  const cobble = volcanic ? '#3d3533' : winter ? '#c9ccd0' : '#a89e8c';
  const stone = volcanic ? '#6a6260' : barb ? '#8f887c' : '#b9b2a2';
  const blue = barb ? '#6a5e50' : '#3d63a8', blueDk = barb ? '#4f463c' : '#2a4680';
  const thatch = winter ? '#eef2f5' : barb ? '#8f8065' : '#d4a441', thatchDk = winter ? '#cfd6dc' : barb ? '#6c604b' : '#a0762a';
  const snowCap = winter;

  // ---- the plot: an eight-sided island of grass with an earthen edge ----
  const plot = (dy: number, grow: number): Pt[] => {
    const pts: Pt[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      pts.push([cx + Math.cos(a) * (rx + 8 + grow), cy + dy + Math.sin(a) * (ry + 5 + grow * 0.52)]);
    }
    return pts;
  };
  ctx.save(); ctx.translate(3, 5); poly(ctx, plot(0, 0), 'rgba(20,12,4,0.35)'); ctx.restore();
  poly(ctx, plot(4, 0), earthSide, 'rgba(25,15,5,0.7)');
  poly(ctx, plot(0, 0), grass, 'rgba(25,15,5,0.5)');
  // light patches of grass and a trodden yard
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2, rr = rnd() * 0.95;
    ctx.fillStyle = i % 2 ? grassLt : shadeHex(grass, -0.08);
    ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr, 3 + rnd() * 3, 1.5 + rnd() * 1.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = tier >= 2 ? cobble : dirt;
  ctx.beginPath(); ctx.ellipse(cx, cy + 1, rx * 0.55, ry * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  // the road in from the gate
  ctx.strokeStyle = tier >= 2 ? cobble : dirt;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(cx, cy + ry + 8); ctx.lineTo(cx, cy + ry * 0.4); ctx.stroke();

  // ---- things to draw, sorted back to front ----
  type Item = { y: number; draw: () => void };
  const items: Item[] = [];
  const at = (y: number, draw: () => void) => items.push({ y, draw });

  const house = (x: number, y: number, w: number, d: number, h: number, roofH: number, roof: string, roofDk: string, timber: boolean, ruin = false) => at(y, () => {
    isoHouse(ctx, x, y, w, d, h, roofH, {
      roof, roofDark: roofDk, wallL: barb ? '#b3a78f' : timber ? '#efe1bf' : '#e6d6b0', wallR: barb ? '#8d826c' : timber ? '#c9b48b' : '#bfa97e', ruin, snow: snowCap,
    });
    if (timber && !ruin) {
      // dark timber framing on the lit wall
      const u: Pt = [-d * ISO_X, -d * ISO_Y];
      ctx.strokeStyle = 'rgba(70,40,18,0.85)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (const k of [0.33, 0.66]) { const p = add([x, y], [u[0] * k, u[1] * k]); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - h); }
      const m = up([x, y], h * 0.5); const m2 = add(m, u); ctx.moveTo(m[0], m[1]); ctx.lineTo(m2[0], m2[1]);
      ctx.stroke();
    }
  });
  const pine = (x: number, y: number, k: number) => at(y, () => {
    ctx.fillStyle = 'rgba(25,15,5,0.3)';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 1, 4.5 * k, 1.8 * k, 0, 0, Math.PI * 2); ctx.fill();
    if (volcanic) { deadTree(ctx, x, y, k); return; }
    ctx.fillStyle = '#4a3220'; ctx.fillRect(x - 0.7, y - 3 * k, 1.4, 3 * k);
    const g = winter ? '#3d5a3d' : '#2d5a2a', gd = winter ? '#2e4a30' : '#1f4420';
    for (let i = 0; i < 3; i++) {
      const top = y - (8 + i * 4) * k, base = y - (2 + i * 3.6) * k, half = (5 - i * 1.2) * k;
      poly(ctx, [[x, top], [x + half, base], [x - half, base]], i % 2 ? g : gd, 'rgba(15,30,10,0.55)');
      if (winter) poly(ctx, [[x, top], [x + half * 0.5, top + (base - top) * 0.5], [x - half * 0.5, top + (base - top) * 0.5]], '#ffffff');
    }
  });
  const flag = (x: number, y: number, h: number, color: string) => {
    ctx.fillStyle = '#4a2f1a'; ctx.fillRect(x - 0.5, y - h, 1.1, h);
    poly(ctx, [[x + 0.6, y - h], [x + 7, y - h + 1.2], [x + 5.2, y - h + 2.6], [x + 7, y - h + 4], [x + 0.6, y - h + 4.2]], color, 'rgba(20,20,40,0.6)');
    ctx.fillStyle = '#e8c860'; ctx.beginPath(); ctx.arc(x, y - h - 0.6, 0.8, 0, Math.PI * 2); ctx.fill();
  };
  const smoke = (x: number, y: number) => {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = `rgba(215,215,210,${0.45 - i * 0.09})`;
      ctx.beginPath(); ctx.arc(x + Math.sin(i * 1.3) * 1.6 + i * 0.6, y - i * 3.2, 1.6 + i * 0.7, 0, Math.PI * 2); ctx.fill();
    }
  };
  const campfire = (x: number, y: number) => at(y, () => {
    ctx.fillStyle = '#6e665c';
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 2.8, y + Math.sin(a) * 1.4, 0.9, 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
    poly(ctx, [[x - 1.6, y], [x, y - 4.2], [x + 1.6, y]], '#ff8a2a');
    poly(ctx, [[x - 0.8, y], [x, y - 2.6], [x + 0.8, y]], '#ffd35a');
    smoke(x + 0.4, y - 6);
  });
  const fountain = (x: number, y: number) => at(y, () => {
    ctx.fillStyle = shadeHex(stone, -0.15); ctx.beginPath(); ctx.ellipse(x, y + 1, 5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = stone; ctx.beginPath(); ctx.ellipse(x, y, 5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = winter ? '#cfe3ee' : '#6fb0d8'; ctx.beginPath(); ctx.ellipse(x, y - 0.2, 3.8, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = stone; ctx.fillRect(x - 0.8, y - 5, 1.6, 5);
    ctx.fillStyle = '#a8d8f0'; ctx.beginPath(); ctx.arc(x, y - 5.4, 1.4, 0, Math.PI * 2); ctx.fill();
  });
  const field = (x: number, y: number, w: number, d: number) => at(y - d * ISO_Y, () => {
    const u: Pt = [w * ISO_X, -w * ISO_Y], v: Pt = [-d * ISO_X, -d * ISO_Y];
    const F: Pt = [x, y];
    poly(ctx, [F, add(F, u), add(add(F, u), v), add(F, v)], winter ? '#f0f3f5' : '#d9b441', 'rgba(90,60,20,0.6)');
    ctx.strokeStyle = winter ? 'rgba(180,190,200,0.8)' : 'rgba(150,110,30,0.8)'; ctx.lineWidth = 0.7;
    for (let i = 1; i < 5; i++) { const a = add(F, [v[0] * i / 5, v[1] * i / 5]), b = add(a, u); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  });
  const stall = (x: number, y: number) => at(y, () => {
    ctx.fillStyle = '#6e4a2a'; ctx.fillRect(x - 4, y - 5, 0.9, 5); ctx.fillRect(x + 3.2, y - 5, 0.9, 5);
    poly(ctx, [[x - 5, y - 5], [x, y - 9], [x + 5, y - 5]], '#c9412f', ink);
    poly(ctx, [[x - 2.5, y - 7], [x, y - 9], [x + 2.5, y - 7], [x + 1.2, y - 5], [x - 1.2, y - 5]], '#f4ecd8');
    ctx.fillStyle = '#d8b04e'; ctx.fillRect(x - 3, y - 2, 6, 2);
  });
  const watchtower = (x: number, y: number) => at(y, () => {
    ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x - 2, y - 16); ctx.moveTo(x + 3, y); ctx.lineTo(x + 2, y - 16);
    ctx.moveTo(x - 3, y - 4); ctx.lineTo(x + 2.5, y - 11); ctx.moveTo(x + 3, y - 4); ctx.lineTo(x - 2.5, y - 11); ctx.stroke();
    poly(ctx, [[x - 4, y - 16], [x + 4, y - 16], [x + 4, y - 19], [x - 4, y - 19]], '#8a5a30', ink);
    poly(ctx, [[x - 5, y - 19], [x, y - 24], [x + 5, y - 19]], thatch, ink);
    if (!barb) flag(x, y - 24, 6, blue);
  });

  // ---- the enclosure ----
  const wallRx = rx - 1, wallRy = ry - 1;
  const gateA = Math.PI / 2, gateHalf = tier >= 2 ? 0.22 : 0.16;
  const onRing = (a: number): Pt => [cx + Math.cos(a) * wallRx, cy + Math.sin(a) * wallRy];
  const wallH = [6, 7, 9, 10, 11][tier];
  const palisade = tier <= 1;
  const drawRing = (front: boolean) => {
    const n = palisade ? 44 : 20;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const inFront = Math.sin(am) > 0;
      if (inFront !== front) continue;
      if (Math.abs(((am - gateA + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < gateHalf) continue;
      const p0 = onRing(a0), p1 = onRing(a1);
      if (palisade) {
        const x = p0[0], y = p0[1];
        const h = wallH + (i % 3) * 0.6;
        ctx.fillStyle = front ? '#8a5a30' : '#6e4524';
        ctx.fillRect(x - 1.1, y - h, 2.2, h);
        ctx.fillStyle = front ? '#5a3a20' : '#4a2f1a';
        ctx.fillRect(x + 0.4, y - h, 0.7, h);
        poly(ctx, [[x - 1.1, y - h], [x, y - h - 2.2], [x + 1.1, y - h]], front ? '#a06a38' : '#7a4f2a');
      } else {
        const col = front ? stone : shadeHex(stone, -0.14);
        poly(ctx, [p0, p1, up(p1, wallH), up(p0, wallH)], col, 'rgba(35,20,8,0.6)');
        // stones and crenellations
        ctx.strokeStyle = 'rgba(60,50,40,0.35)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); const m0 = up(p0, wallH * 0.5), m1 = up(p1, wallH * 0.5); ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m1[0], m1[1]); ctx.stroke();
        const t = up(mid(p0, p1), wallH);
        ctx.fillStyle = col; ctx.fillRect(t[0] - 1.2, t[1] - 2.2, 2.4, 2.4);
        ctx.strokeStyle = 'rgba(35,20,8,0.5)'; ctx.strokeRect(t[0] - 1.2, t[1] - 2.2, 2.4, 2.4);
      }
    }
    if (front) {
      // the gate
      const g = onRing(gateA);
      if (palisade) {
        ctx.fillStyle = '#7a4f2a';
        ctx.fillRect(g[0] - 7, g[1] - wallH - 3, 1.8, wallH + 3); ctx.fillRect(g[0] + 5.2, g[1] - wallH - 3, 1.8, wallH + 3);
        ctx.fillRect(g[0] - 7, g[1] - wallH - 3, 14, 1.4);
      } else {
        poly(ctx, [[g[0] - 8, g[1] + 1], [g[0] + 8, g[1] + 1], [g[0] + 8, g[1] - wallH - 4], [g[0] - 8, g[1] - wallH - 4]], stone, ink);
        ctx.fillStyle = '#3a2414';
        ctx.beginPath(); ctx.moveTo(g[0] - 3, g[1] + 1); ctx.lineTo(g[0] - 3, g[1] - 4); ctx.arc(g[0], g[1] - 4, 3, Math.PI, 0); ctx.lineTo(g[0] + 3, g[1] + 1); ctx.fill();
        for (const k of [-6.5, -2.2, 2.2, 6.5]) { ctx.fillStyle = stone; ctx.fillRect(g[0] + k - 1, g[1] - wallH - 6.5, 2, 2.5); }
      }
    }
  };
  const tower = (a: number, big = false) => {
    const p = onRing(a);
    at(p[1] + 0.5, () => {
      const r = big ? 4.6 : 3.6, h = wallH + (big ? 8 : 5);
      isoTower(ctx, p[0], p[1], r, h, stone, barb ? undefined : winter ? '#eef2f5' : blue, winter);
      if (!barb && Math.sin(a) > 0.2) {
        // a blue banner with a white star on the towers facing us
        poly(ctx, [[p[0] - 1.8, p[1] - h + 2], [p[0] + 1.8, p[1] - h + 2], [p[0] + 1.8, p[1] - h + 8], [p[0], p[1] - h + 6.8], [p[0] - 1.8, p[1] - h + 8]], blue, 'rgba(20,20,40,0.6)');
        ctx.fillStyle = '#f4f1e6'; ctx.beginPath(); ctx.arc(p[0], p[1] - h + 4.4, 0.8, 0, Math.PI * 2); ctx.fill();
      }
      if (!barb && big) flag(p[0], p[1] - h - r * 2.6, 6, blue);
    });
  };

  // ---- trees round the back ----
  const treeSpots: [number, number, number][] = [[-0.95, -0.55, 1], [-0.7, -0.95, 1.1], [0.1, -1.1, 1], [0.75, -0.85, 1.05], [1.0, -0.35, 0.9], [-1.08, 0.1, 0.9]];
  for (const [ox, oy, k] of treeSpots.slice(0, tier <= 1 ? 6 : 4)) pine(cx + ox * (rx + 4), cy + oy * (ry + 3), k * (tier >= 3 ? 0.9 : 1));

  // ---- the village inside, by size ----
  const roofOf = (i: number) => (tier >= 2 && i % 3 !== 2 ? [blue, blueDk] : [thatch, thatchDk]);
  if (tier === 0) {
    house(cx - 15, cy - 1, 8, 7, 5, 5, thatch, thatchDk, false, barb);
    house(cx + 5, cy - 5, 8, 6, 5, 4.5, thatch, thatchDk, false);
    campfire(cx - 1, cy + 5);
    if (!barb) at(cy - ry, () => flag(cx + rx * 0.6, cy - ry * 0.7, 16, blue));
  } else if (tier === 1) {
    house(cx - 8, cy - 9, 14, 8, 6, 6, thatch, thatchDk, true); // the longhouse
    house(cx - 22, cy + 1, 8, 7, 5, 5, thatch, thatchDk, false);
    house(cx + 10, cy - 3, 8, 6, 5, 4.5, thatch, thatchDk, false, barb);
    house(cx + 2, cy + 8, 8, 6, 5, 4.5, thatch, thatchDk, false);
    house(cx - 14, cy + 11, 7, 6, 4.5, 4, thatch, thatchDk, false);
    campfire(cx - 3, cy + 3);
    watchtower(cx + rx * 0.62, cy - ry * 0.45);
    at(cy + 7, () => { ctx.fillStyle = '#6e4a2a'; ctx.fillRect(cx + 16, cy + 5, 6, 2.5); ctx.fillStyle = '#3a2414'; ctx.beginPath(); ctx.arc(cx + 17, cy + 8, 1.2, 0, Math.PI * 2); ctx.arc(cx + 21, cy + 8, 1.2, 0, Math.PI * 2); ctx.fill(); });
  } else {
    // stone towns: timber-framed houses under blue roofs, a fountain, a field
    const spots: [number, number, number, number][] = tier === 2
      ? [[-18, -10, 10, 7], [0, -14, 12, 8], [14, -8, 9, 7], [-26, 4, 9, 7], [18, 6, 9, 6], [-8, 12, 8, 6]]
      : [[-24, -10, 10, 7], [-8, -16, 11, 8], [18, -12, 10, 7], [26, 0, 9, 7], [-30, 4, 9, 7], [20, 10, 9, 6], [-16, 14, 8, 6], [4, 16, 8, 6]];
    spots.forEach(([ox, oy, w, d], i) => {
      const [r0, r1] = roofOf(i);
      house(cx + ox, cy + oy, w, d, 6 + (i % 2), 5, r0, r1, true, barb && i % 4 === 1);
    });
    fountain(cx + 2, cy + 3);
    if (tier === 2) field(cx - 30, cy + 12, 10, 7);
    if (tier >= 3) { stall(cx - 6, cy + 6); stall(cx + 10, cy + 3); }
    if (tier === 3) {
      // the keep: a square stone tower under a blue roof
      at(cy - 6, () => {
        isoHouse(ctx, cx - 4, cy - 6, 11, 10, 16, 8, { roof: barb ? '#6a5e50' : winter ? '#eef2f5' : blue, roofDark: barb ? '#4f463c' : blueDk, wallL: shadeHex(stone, 0.05), wallR: shadeHex(stone, -0.15), snow: winter });
        if (!barb) flag(cx - 4 + 5, cy - 6 - 16 - 11, 7, blue);
        smoke(cx - 10, cy - 30);
      });
    }
    if (tier === 4) {
      // the castle on its hill: a rocky mound, curtain walls, a great keep and towers
      at(cy - 10, () => {
        const hx = cx + 2, hy = cy - 8;
        poly(ctx, [[hx - 26, hy + 6], [hx - 18, hy - 6], [hx, hy - 12], [hx + 18, hy - 6], [hx + 26, hy + 6], [hx, hy + 12]], volcanic ? '#3d3533' : '#8a8274', ink);
        poly(ctx, [[hx - 18, hy - 6], [hx, hy - 12], [hx + 18, hy - 6], [hx, hy]], volcanic ? '#4a403c' : '#6f8a3a');
        // curtain wall round the top
        const cw: Pt[] = [[hx - 16, hy - 4], [hx, hy - 11], [hx + 16, hy - 4], [hx, hy + 3]];
        for (let i = 0; i < 4; i++) {
          const p0 = cw[i], p1 = cw[(i + 1) % 4];
          const fr = i >= 2;
          poly(ctx, [p0, p1, up(p1, 7), up(p0, 7)], fr ? stone : shadeHex(stone, -0.15), ink);
        }
        // the great keep and its towers
        isoHouse(ctx, hx - 3, hy - 1, 12, 11, 20, 10, { roof: barb ? '#6a5e50' : winter ? '#eef2f5' : blue, roofDark: barb ? '#4f463c' : blueDk, wallL: shadeHex(stone, 0.06), wallR: shadeHex(stone, -0.14), snow: winter });
        const roofC = barb ? undefined : winter ? '#eef2f5' : blue;
        isoTower(ctx, hx - 16, hy - 2, 3.6, 20, stone, roofC, winter);
        isoTower(ctx, hx + 16, hy - 2, 3.6, 20, stone, roofC, winter);
        isoTower(ctx, hx, hy - 12, 3.4, 24, stone, roofC, winter);
        isoTower(ctx, hx + 2, hy + 4, 4.4, 26, stone, roofC, winter);
        if (!barb) { flag(hx + 2, hy + 4 - 26 - 11.4, 7, blue); flag(hx - 16, hy - 2 - 20 - 9.4, 6, blue); flag(hx + 16, hy - 2 - 20 - 9.4, 6, blue); }
        smoke(hx - 22, hy - 20);
      });
    }
  }

  // ---- draw: back wall, the village by depth, towers, the front wall ----
  drawRing(false);
  const towers = tier >= 2 ? (tier === 2 ? [Math.PI * 1.25, Math.PI * 1.75, Math.PI * 0.18, Math.PI * 0.82] : [Math.PI * 1.15, Math.PI * 1.5, Math.PI * 1.85, Math.PI * 0.12, Math.PI * 0.88, Math.PI * 0.35, Math.PI * 0.65]) : [];
  for (const a of towers) if (Math.sin(a) <= 0) tower(a, tier >= 3 && Math.abs(Math.cos(a)) > 0.9);
  items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());
  items.length = 0;
  drawRing(true);
  for (const a of towers) if (Math.sin(a) > 0) tower(a, tier >= 3 && Math.abs(Math.cos(a)) > 0.9);
  items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());
  // a couple of trees in front of the walls
  items.length = 0;
  pine(cx + rx * 0.98, cy + ry * 0.55, 0.8);
  if (tier <= 1) pine(cx - rx * 0.95, cy + ry * 0.6, 0.85);
  items.forEach((it) => it.draw());

  cache.set(key, c);
  return c;
}

function shadeHex(hex: string, amt: number): string {
  return shade(hex, amt);
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
