// Painted map sprites: little walled hamlets drawn once into offscreen canvases,
// then stamped onto the world map at any zoom.

const SIZE = 96;
const cache = new Map<string, HTMLCanvasElement>();

type Kind = 'barb' | 'player';

function roofHouse(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, roof: string, wall: string) {
  // wall front
  ctx.fillStyle = wall;
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + w * 0.1, y - h, w * 0.4, h);
  // roof
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 2, y - h);
  ctx.lineTo(x - w * 0.15, y - h - h * 0.95);
  ctx.lineTo(x + w * 0.35, y - h - h * 0.95);
  ctx.lineTo(x + w / 2 + 2, y - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y - h - h * 0.95);
  ctx.lineTo(x + w * 0.35, y - h - h * 0.95);
  ctx.lineTo(x + w / 2 + 2, y - h);
  ctx.lineTo(x + w * 0.2, y - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2a1d12';
  ctx.fillRect(x - 1.5, y - h * 0.55, 3, h * 0.55);
}

function tower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, h: number, stone: string, roof?: string) {
  ctx.fillStyle = stone;
  ctx.fillRect(x - r, y - h, r * 2, h);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x, y - h, r, h);
  ctx.beginPath();
  ctx.ellipse(x, y - h, r, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fillStyle = stone;
  ctx.fill();
  if (roof) {
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - r - 1.5, y - h);
    ctx.lineTo(x, y - h - r * 2.4);
    ctx.lineTo(x + r + 1.5, y - h);
    ctx.closePath();
    ctx.fill();
  }
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
  const cx = SIZE / 2, cy = SIZE * 0.6;
  const rx = SIZE * (0.34 + tier * 0.025), ry = rx * 0.55;
  const roof = winter ? (barb ? '#dfe4e8' : '#f3f6f8') : barb ? '#8a7560' : '#b8502c';
  const roof2 = winter ? (barb ? '#cfd6dc' : '#e6ecf0') : barb ? '#766350' : '#c9663a';
  const wall = barb ? '#b5a88e' : '#ead9b4';
  const stone = barb ? '#8f887a' : '#b3ab98';
  // ground pad
  ctx.fillStyle = 'rgba(40,25,5,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 4, rx + 6, ry + 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = winter ? (barb ? '#c9c2b4' : '#d8cdb8') : barb ? '#b39c74' : '#d2b27a';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 4, ry + 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // back wall
  const hasWall = tier >= 1;
  const wallH = 4 + tier * 1.4;
  if (hasWall) {
    ctx.strokeStyle = barb && tier < 3 ? '#7a5a36' : stone;
    ctx.lineWidth = 3 + tier * 0.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy - wallH * 0.3, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  // houses
  const spots: [number, number, number][] = [
    [-0.45, -0.25, 1], [0.35, -0.35, 0.9], [-0.1, -0.5, 0.8], [0.55, 0.05, 0.85], [-0.55, 0.15, 0.9], [0.1, 0.1, 1],
  ];
  const n = Math.min(spots.length, 2 + tier);
  for (let i = 0; i < n; i++) {
    const [ox, oy, s] = spots[i];
    roofHouse(ctx, cx + ox * rx, cy + oy * ry + 3, 19 * s + tier, 11 * s + tier * 0.6, i % 2 ? roof2 : roof, wall);
  }
  if (tier >= 3) {
    // keep
    const kw = 10 + tier * 2;
    ctx.fillStyle = stone;
    ctx.fillRect(cx - kw / 2, cy - 10 - kw, kw, kw + 6);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(cx, cy - 10 - kw, kw / 2, kw + 6);
    for (let k = 0; k < 3; k++) ctx.fillRect(cx - kw / 2 + k * (kw / 3) + 1, cy - 13 - kw, kw / 6, 3);
    if (!barb) {
      tower(ctx, cx - kw / 2 - 2, cy - 2, 3, kw + 4, stone, winter ? '#f3f6f8' : '#b8502c');
      tower(ctx, cx + kw / 2 + 2, cy - 2, 3, kw + 4, stone, winter ? '#f3f6f8' : '#b8502c');
    }
  }
  // front wall with towers
  if (hasWall) {
    ctx.strokeStyle = barb && tier < 3 ? '#8a6a44' : stone;
    ctx.lineWidth = 4 + tier * 0.6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, rx, ry, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
    if (tier >= 2) {
      const towers = tier >= 4 ? 5 : 3;
      for (let i = 0; i < towers; i++) {
        const a = (i / (towers - 1)) * Math.PI;
        tower(ctx, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry + 2, 3 + tier * 0.3, wallH + 5, stone, barb ? undefined : winter ? '#f3f6f8' : '#b8502c');
      }
    }
  }
  if (barb && tier <= 1) {
    // overgrown ruins
    ctx.fillStyle = winter ? '#f2f5f7' : '#6f7c35';
    for (const [dx, dy] of [[-16, 6], [18, 2], [4, 12]]) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
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
