// Painted map sprites, stamped onto the world map at any zoom.
//
// Villages are hand-painted little islands in eight stages, from two cottages on a
// patch of grass to a castle with towers everywhere (src/ui/art/villages, baked from
// the sheets in art-src/villages by src/dev/bake.ts). Everyone else's villages wear
// the plain red-roofed set; your own wear the set of the hero at their statue.
// Barbarian villages are the plain set, weathered; the snowy north, the volcanic
// west, the eastern desert and the southern jungle repaint the grass as snow, ash,
// sand or deep jungle green.

import generic from './art/villages/generic.webp';
import paladin from './art/villages/paladin.webp';
import sorcerer from './art/villages/sorcerer.webp';
import druid from './art/villages/druid.webp';
import goblin from './art/villages/goblin.webp';
import necromancer from './art/villages/necromancer.webp';

export type VillageLook = 'generic' | 'paladin' | 'sorcerer' | 'druid' | 'goblin' | 'necromancer';
const ART: Record<VillageLook, string> = { generic, paladin, sorcerer, druid, goblin, necromancer };

/** Each atlas is 4 x 2 cells of this many pixels; every island stands on the bottom edge of its cell. */
const CELL = 208;
export const VILLAGE_STAGES = 8;

/** Which of the eight stages a village of this many points shows. */
export function villageStage(points: number): number {
  return points < 120 ? 0 : points < 300 ? 1 : points < 600 ? 2 : points < 1000 ? 3 : points < 1800 ? 4 : points < 3000 ? 5 : points < 9000 ? 6 : 7;
}

/** The look of a village's own hero (a village without a hero looks plain). */
export function lookOfHero(hero: string | null | undefined): VillageLook {
  return hero === 'paladin' || hero === 'sorcerer' || hero === 'druid' || hero === 'goblin' || hero === 'necromancer' ? hero : 'generic';
}

const sheets = new Map<VillageLook, HTMLImageElement>();
const listeners = new Set<() => void>();

/** Call back once more village art has loaded (so the map can redraw). */
export function onVillageArt(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function sheet(look: VillageLook): HTMLImageElement | null {
  let img = sheets.get(look);
  if (!img) {
    img = new Image();
    img.onload = () => { for (const fn of listeners) fn(); };
    img.src = ART[look];
    sheets.set(look, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export type Ground = 'grass' | 'snow' | 'ash' | 'sand' | 'jungle';
const cache = new Map<string, HTMLCanvasElement>();

/**
 * A village's sprite: a square canvas with the island standing on its bottom edge.
 * Null until the art has loaded (onVillageArt says when).
 */
export function villageSprite(stage: number, look: VillageLook, opts: { barb?: boolean; ground?: Ground } = {}): HTMLCanvasElement | null {
  stage = Math.max(0, Math.min(VILLAGE_STAGES - 1, stage));
  const ground = opts.ground ?? 'grass';
  const key = `${look}|${stage}|${opts.barb ? 1 : 0}|${ground}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const img = sheet(look);
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = c.height = CELL;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, (stage % 4) * CELL, Math.floor(stage / 4) * CELL, CELL, CELL, 0, 0, CELL, CELL);
  if (opts.barb || ground !== 'grass') repaint(ctx, !!opts.barb, ground);
  cache.set(key, c);
  return c;
}

const boxes = new WeakMap<HTMLCanvasElement, { w: number; h: number }>();

/**
 * How much of its square a village sprite's island really fills: the width and height of
 * its opaque pixels, as fractions of the side (measured once per sprite). The map uses it
 * to shrink an island just enough that it never paints over a close neighbour.
 */
export function spriteBox(sprite: HTMLCanvasElement | null): { w: number; h: number } {
  if (!sprite) return { w: 0.93, h: 0.8 };
  const hit = boxes.get(sprite);
  if (hit) return hit;
  const n = sprite.width;
  const d = sprite.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, n, n).data;
  let x0 = n, x1 = -1, y0 = n, y1 = -1;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (d[(y * n + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const box = x1 < 0 ? { w: 0.93, h: 0.8 } : { w: (x1 - x0 + 1) / n, h: (y1 - y0 + 1) / n };
  boxes.set(sprite, box);
  return box;
}

/**
 * Weather and neglect, pixel by pixel: grass and leaves (anything clearly green,
 * but not a bright magical glow) turn to snow, ash, sand or jungle green; a barbarian village loses
 * most of its colour and darkens, like a place nobody looks after.
 */
function repaint(ctx: CanvasRenderingContext2D, barb: boolean, ground: Ground) {
  const im = ctx.getImageData(0, 0, CELL, CELL);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    if (ground !== 'grass') {
      const green = g - (r + b) / 2;
      const glow = g > 200 && r < 150;
      const t = glow ? 0 : Math.max(0, Math.min(1, (green - 12) / 30));
      if (t > 0) {
        let tr: number, tg: number, tb: number;
        if (ground === 'snow') {
          const s = Math.min(255, lum * 1.15 + 70);
          tr = s - 8; tg = s - 2; tb = s + 6;
        } else if (ground === 'sand') {
          // warm sand, keeping the painted light and shade
          tr = Math.min(255, lum * 1.5 + 44); tg = Math.min(255, lum * 1.24 + 36); tb = lum * 0.78 + 22;
        } else if (ground === 'jungle') {
          // a deeper, wetter green
          tr = lum * 0.42; tg = Math.min(255, lum * 1.08 + 10); tb = lum * 0.42 + 4;
        } else {
          const s = lum * 0.5 + 18;
          tr = s + 10; tg = s + 2; tb = s - 4;
        }
        r += (tr - r) * t; g += (tg - g) * t; b += (tb - b) * t;
      }
    }
    if (barb) {
      const l2 = 0.3 * r + 0.59 * g + 0.11 * b;
      r = (r + (l2 + 12 - r) * 0.62) * 0.86;
      g = (g + (l2 + 4 - g) * 0.62) * 0.86;
      b = (b + (l2 - 8 - b) * 0.62) * 0.86;
    }
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  ctx.putImageData(im, 0, 0);
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

// ---------- the wilds of the east and the south ----------

const TAU = Math.PI * 2;
const wildCache = new Map<string, HTMLCanvasElement>();

function seeded(seed: number): () => number {
  let s = seed % 233280;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

function sprite64(key: string, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const hit = wildCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  paint(c.getContext('2d')!);
  wildCache.set(key, c);
  return c;
}

function groundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.28) {
  ctx.fillStyle = `rgba(70,40,10,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

/** A date palm standing at (x, y): a leaning, ringed trunk, a crown of arching fronds and a bunch of dates. */
function drawPalm(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, lean: number, rnd: () => number) {
  groundShadow(ctx, x + 6 * k, y + 1, 10 * k, 3 * k);
  const tx = x + lean * k, ty = y - 21 * k;
  const mx = x + lean * 0.15 * k, my = y - 11 * k;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#7b5836';
  ctx.lineWidth = 2.8 * k;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(mx, my, tx, ty);
  ctx.stroke();
  // the rings of old leaf bases
  ctx.strokeStyle = 'rgba(58,34,14,0.6)';
  ctx.lineWidth = 0.9 * k;
  for (let i = 1; i < 6; i++) {
    const t = i / 6, u = 1 - t;
    const px = u * u * x + 2 * u * t * mx + t * t * tx, py = u * u * y + 2 * u * t * my + t * t * ty;
    ctx.beginPath();
    ctx.moveTo(px - 1.3 * k, py + 0.4 * k);
    ctx.lineTo(px + 1.3 * k, py - 0.2 * k);
    ctx.stroke();
  }
  // fronds: the far ones in shade first, the near ones sunlit on top
  const fr: number[] = [];
  for (let i = 0; i < 7; i++) fr.push((i / 7) * TAU + rnd() * 0.5);
  fr.sort((a, b) => Math.sin(a) - Math.sin(b));
  for (const a of fr) {
    const back = Math.sin(a) < -0.1;
    const len = (10 + rnd() * 3.5) * k;
    const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.42 + 5.5 * k;
    const cx = tx + Math.cos(a) * len * 0.55, cy = ty + Math.sin(a) * len * 0.25 - 4 * k;
    ctx.fillStyle = back ? '#3d6a2b' : Math.cos(a) < 0 ? '#5f9138' : '#4f7f31';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(cx, cy - 2 * k, ex, ey);
    ctx.quadraticCurveTo(cx, cy + 1.6 * k, tx, ty + 0.6 * k);
    ctx.fill();
    if (!back) {
      ctx.strokeStyle = 'rgba(214,232,150,0.5)';
      ctx.lineWidth = 0.6 * k;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(cx, cy - 1 * k, ex, ey);
      ctx.stroke();
    }
  }
  // dates hanging under the crown
  ctx.fillStyle = '#b8642a';
  for (const [dx, dy] of [[-1.6, 1.8], [1.2, 2.2], [0, 2.9]]) {
    ctx.beginPath();
    ctx.arc(tx + dx * k, ty + dy * k, 1.05 * k, 0, TAU);
    ctx.fill();
  }
}

/** A saguaro: a ribbed green column with two arms raised. */
function drawCactus(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, flip: number) {
  groundShadow(ctx, x + 4 * k, y + 1, 6.5 * k, 2.4 * k);
  const body = '#5d8c3e', shade = '#44703a', light = '#8cb85e';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = body;
  ctx.lineWidth = 3 * k;
  ctx.beginPath();
  ctx.moveTo(x + 1 * k * flip, y - 7 * k);
  ctx.lineTo(x + 5 * k * flip, y - 7 * k);
  ctx.lineTo(x + 5 * k * flip, y - 12.5 * k);
  ctx.moveTo(x - 1 * k * flip, y - 10.5 * k);
  ctx.lineTo(x - 4.2 * k * flip, y - 10.5 * k);
  ctx.lineTo(x - 4.2 * k * flip, y - 14.5 * k);
  ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(x - 2.3 * k, y - 18 * k, 4.6 * k, 18 * k, 2.3 * k);
  ctx.fill();
  // shade on the side away from the sun, a sunlit rib on the other
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.roundRect(x + 0.5 * k, y - 17.4 * k, 1.8 * k, 17.4 * k, [0, 2 * k, 0, 0]);
  ctx.fill();
  ctx.strokeStyle = light;
  ctx.lineWidth = 0.8 * k;
  ctx.beginPath();
  ctx.moveTo(x - 1.1 * k, y - 16.5 * k);
  ctx.lineTo(x - 1.1 * k, y - 1 * k);
  ctx.stroke();
  // a flower on top
  ctx.fillStyle = '#f2d8e0';
  ctx.beginPath();
  ctx.arc(x, y - 18.2 * k, 0.9 * k, 0, TAU);
  ctx.fill();
}

/** A dry, wind-bitten bush of the dunes. */
function drawShrub(ctx: CanvasRenderingContext2D, x: number, y: number, k: number) {
  groundShadow(ctx, x + 2 * k, y + 0.5, 5 * k, 1.8 * k, 0.22);
  ctx.strokeStyle = '#6b5335';
  ctx.lineWidth = 0.8 * k;
  ctx.beginPath();
  for (const d of [-3, 0, 3]) { ctx.moveTo(x, y); ctx.lineTo(x + d * k, y - 4 * k); }
  ctx.stroke();
  for (const [dx, dy, r, col] of [[-2.2, -3.4, 2.4, '#857f45'], [2, -3.8, 2.3, '#8f8a4c'], [0, -5, 2.6, '#a39c5c']] as [number, number, number, string][]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x + dx * k, y + dy * k, r * k, 0, TAU);
    ctx.fill();
  }
}

/**
 * The desert's groves ('forest' fields there): date palms in twos and threes, a stand of
 * saguaros, or a lone palm among dry bushes.
 */
export function palmSprite(variant: number): HTMLCanvasElement {
  const v = ((variant % 8) + 8) % 8;
  return sprite64(`palm|${v}`, (ctx) => {
    const rnd = seeded(v * 7919 + 1301);
    const items: [number, number, number, 'palm' | 'cactus' | 'shrub'][] = [];
    if (v < 5) {
      const n = v < 3 ? 3 : 2;
      for (let i = 0; i < n; i++) items.push([20 + i * (24 / (n - 1)) + (rnd() - 0.5) * 4, 36 + rnd() * 22, 1.1 + rnd() * 0.3, 'palm']);
      if (v === 4) items.push([12 + rnd() * 40, 54 + rnd() * 6, 0.9, 'shrub']);
    } else if (v < 7) {
      items.push([18 + rnd() * 10, 40 + rnd() * 14, 1.1 + rnd() * 0.3, 'cactus'], [38 + rnd() * 12, 46 + rnd() * 12, 0.9 + rnd() * 0.3, 'cactus'], [28 + rnd() * 20, 57, 1, 'shrub']);
    } else {
      items.push([30, 44, 1.4, 'palm'], [14, 57, 1, 'shrub'], [50, 55, 0.9, 'cactus']);
    }
    items.sort((a, b) => a[1] - b[1]);
    for (const [x, y, k, kind] of items) {
      if (kind === 'palm') drawPalm(ctx, x, y, k, (rnd() - 0.5) * 12, rnd);
      else if (kind === 'cactus') drawCactus(ctx, x, y, k, rnd() < 0.5 ? 1 : -1);
      else drawShrub(ctx, x, y, k);
    }
  });
}

/** One palm, for the green rim of an oasis. */
export function lonePalmSprite(variant: number): HTMLCanvasElement {
  const v = ((variant % 4) + 4) % 4;
  return sprite64(`lonepalm|${v}`, (ctx) => {
    const rnd = seeded(v * 4561 + 77);
    drawPalm(ctx, 30 + rnd() * 8, 58, 1.25, (rnd() - 0.5) * 16, rnd);
  });
}

const JUNGLE_LEAF = ['#2e6b2a', '#377a2f', '#2a6328', '#418a35', '#316f2c'];
const JUNGLE_FLOWER = ['#f05a7a', '#ffc83a', '#e8483a', '#f7f0e6', '#c85ad0'];

/** A jungle crown: a lumpy dome of overlapping leaf masses, shaded below and sunlit on top. */
function drawCrown(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, rnd: () => number) {
  // the trunk, a dark shadow on the canopy below it, then the leaves
  ctx.fillStyle = '#4a3522';
  ctx.fillRect(x - r * 0.12, y, r * 0.24, r * 0.7);
  ctx.fillStyle = 'rgba(8,30,10,0.4)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.25, y + r * 0.45, r * 1.05, r * 0.6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = col;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + rnd();
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.32, r * (0.55 + rnd() * 0.15), 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y - r * 0.2, r * 0.65, 0, TAU);
  ctx.fill();
  // the sunlit top
  ctx.fillStyle = 'rgba(150,215,95,0.4)';
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.42, r * 0.38, 0, TAU);
  ctx.arc(x + r * 0.2, y - r * 0.55, r * 0.26, 0, TAU);
  ctx.fill();
}

/**
 * The jungle ('forest' fields there): a dense, many-storeyed canopy of broad crowns, now and
 * then a giant rising above the rest, banana fans at the edge, vines and bright flowers.
 */
export function jungleSprite(variant: number): HTMLCanvasElement {
  const v = ((variant % 8) + 8) % 8;
  return sprite64(`jungle|${v}`, (ctx) => {
    const rnd = seeded(v * 6373 + 211);
    // the dark understorey, so the crowns read as one mass
    ctx.fillStyle = 'rgba(24,64,26,0.9)';
    ctx.beginPath();
    ctx.roundRect(3, 12, 58, 50, 14);
    ctx.fill();
    // crowns of every size, scattered in three loose storeys (a giant now and then above them all)
    const crowns: [number, number, number][] = [];
    for (let row = 0; row < 3; row++) {
      const shift = (rnd() - 0.5) * 12;
      for (let col = 0; col < 3; col++) {
        if (rnd() < 0.18) continue;
        const r = 7.5 + rnd() * 4.5;
        // (kept inside the sprite, so no crown is cut off square at its edge)
        crowns.push([Math.max(r * 1.1, Math.min(64 - r * 1.3, 12 + col * 20 + shift + (rnd() - 0.5) * 8)), Math.max(r * 1.2, 24 + row * 14 + (rnd() - 0.5) * 7), r]);
      }
    }
    if (v % 3 === 0) crowns.push([22 + rnd() * 20, 20 + rnd() * 4, 13]);
    crowns.sort((a, b) => a[1] - b[1]);
    for (const [x, y, r] of crowns) drawCrown(ctx, x, y, r, JUNGLE_LEAF[Math.floor(rnd() * JUNGLE_LEAF.length)], rnd);
    // vines hanging off the crowns
    ctx.strokeStyle = 'rgba(24,70,26,0.85)';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 3; i++) {
      const [x, y, r] = crowns[Math.floor(rnd() * crowns.length)];
      const vx = x + (rnd() - 0.5) * r;
      ctx.beginPath();
      ctx.moveTo(vx, y + r * 0.2);
      ctx.quadraticCurveTo(vx + 2, y + r * 0.6, vx - 1, y + r * 0.9);
      ctx.stroke();
    }
    // a banana plant's fan of broad leaves at the front
    if (v % 2 === 1) {
      const bx = 8 + rnd() * 48, by = 58;
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (1.1 + (i / 4) * 0.8);
        ctx.fillStyle = i % 2 ? '#5cae3e' : '#4a9a36';
        ctx.beginPath();
        ctx.ellipse(bx + Math.cos(a) * 5, by - 4 + Math.sin(a) * 5, 6, 2, a, 0, TAU);
        ctx.fill();
      }
    }
    // bright flowers among the leaves
    for (let i = 0; i < 2 + (v % 3); i++) {
      const [x, y, r] = crowns[Math.floor(rnd() * crowns.length)];
      ctx.fillStyle = JUNGLE_FLOWER[Math.floor(rnd() * JUNGLE_FLOWER.length)];
      ctx.beginPath();
      ctx.arc(x + (rnd() - 0.5) * r * 1.2, y - r * (0.1 + rnd() * 0.5), 1.4, 0, TAU);
      ctx.fill();
    }
  });
}

// ---------- the resource cache ----------

const cacheSprites = new Map<Ground, HTMLCanvasElement>();
/** Trodden earth under the depot, by the land it stands in. */
const DEPOT_GROUND: Record<Ground, [string, string]> = {
  grass: ['#b8945a', '#8f6f3e'], snow: ['#e3e9ed', '#b9c4cc'], ash: ['#6e625a', '#4d433d'], sand: ['#dcc088', '#b39456'], jungle: ['#8f7a4c', '#6a5732'],
};
const INK = '#2a180a';

/**
 * A resource cache on the map: a strongbox heaped with gold, timber, brick and iron,
 * crates and a lumber pile beside it inside a ring of stakes, and a gold pennant over it.
 * A square canvas (128 px) with the depot standing on its bottom edge; drawn big and
 * bright so it reads as treasure even a few pixels wide.
 */
export function cacheSprite(ground: Ground = 'grass'): HTMLCanvasElement {
  const hit = cacheSprites.get(ground);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const [earth, rim] = DEPOT_GROUND[ground];
  const outline = (w = 3) => { g.strokeStyle = INK; g.lineWidth = w; g.stroke(); };
  // the trodden yard
  g.fillStyle = 'rgba(40,24,8,0.28)';
  g.beginPath(); g.ellipse(66, 106, 58, 19, 0, 0, TAU); g.fill();
  g.fillStyle = earth;
  g.beginPath(); g.ellipse(64, 102, 56, 19, 0, 0, TAU); g.fill();
  g.strokeStyle = rim; g.lineWidth = 3; g.stroke();
  // a ring of sharpened stakes: the back half first
  const stake = (a: number) => {
    const x = 64 + Math.cos(a) * 54, y = 101 + Math.sin(a) * 18;
    g.fillStyle = Math.sin(a) < 0 ? '#6a4524' : '#8a5a2e';
    g.beginPath();
    g.moveTo(x - 3, y + 2); g.lineTo(x - 3, y - 11); g.lineTo(x, y - 16); g.lineTo(x + 3, y - 11); g.lineTo(x + 3, y + 2); g.closePath();
    g.fill(); outline(1.6);
  };
  const stakes: number[] = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    if (Math.abs(a - Math.PI / 2) < 0.28) continue; // the gate, facing the viewer
    stakes.push(a);
  }
  for (const a of stakes) if (Math.sin(a) < 0) stake(a);
  // the pennant pole
  g.fillStyle = '#5a3a1e';
  g.beginPath(); g.rect(97, 14, 4, 80); g.fill(); outline(1.6);
  g.fillStyle = '#f0bd45';
  g.beginPath(); g.moveTo(101, 16); g.lineTo(124, 22); g.lineTo(110, 27); g.lineTo(124, 33); g.lineTo(101, 36); g.closePath(); g.fill(); outline(2);
  g.fillStyle = '#b8392b';
  g.beginPath(); g.arc(108, 26, 3, 0, TAU); g.fill();
  g.fillStyle = '#fde38a';
  g.beginPath(); g.arc(99, 13, 3.4, 0, TAU); g.fill(); outline(1.4);
  // crates, stacked on the left
  const crate = (x: number, y: number, s: number) => {
    g.fillStyle = '#b8864e';
    g.beginPath(); g.rect(x, y, s, s * 0.8); g.fill(); outline(2);
    g.fillStyle = '#d6a868';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * 0.3, y - s * 0.28); g.lineTo(x + s * 1.3, y - s * 0.28); g.lineTo(x + s, y); g.closePath(); g.fill(); outline(2);
    g.fillStyle = '#8a5f32';
    g.beginPath(); g.moveTo(x + s, y); g.lineTo(x + s * 1.3, y - s * 0.28); g.lineTo(x + s * 1.3, y + s * 0.52); g.lineTo(x + s, y + s * 0.8); g.closePath(); g.fill(); outline(2);
    g.strokeStyle = '#6e4220'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x + 2, y + 2); g.lineTo(x + s - 2, y + s * 0.8 - 2); g.moveTo(x + s - 2, y + 2); g.lineTo(x + 2, y + s * 0.8 - 2); g.stroke();
  };
  crate(14, 78, 20);
  crate(20, 60, 17);
  // the lumber pile on the right
  const log = (x: number, y: number) => {
    g.fillStyle = '#a86b36';
    g.beginPath(); g.rect(x - 16, y - 5, 16, 10); g.fill(); outline(1.8);
    g.fillStyle = '#ecc690';
    g.beginPath(); g.ellipse(x, y, 4.2, 5.2, 0, 0, TAU); g.fill(); outline(1.8);
    g.strokeStyle = '#a86b36'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(x, y, 1.8, 2.3, 0, 0, TAU); g.stroke();
  };
  for (const [x, y] of [[106, 92], [114, 92], [110, 83]] as [number, number][]) log(x, y);
  // the strongbox: lid thrown back, the hoard heaped over the brim
  g.fillStyle = '#5c3719';
  g.beginPath(); g.moveTo(38, 70); g.lineTo(42, 44); g.quadraticCurveTo(43, 38, 50, 38); g.lineTo(78, 38); g.quadraticCurveTo(85, 38, 86, 44); g.lineTo(90, 70); g.closePath(); g.fill(); outline(3);
  g.fillStyle = '#3e2410';
  g.beginPath(); g.moveTo(45, 68); g.lineTo(48, 47); g.lineTo(80, 47); g.lineTo(83, 68); g.closePath(); g.fill();
  // the heap, glowing gold
  const glow = g.createRadialGradient(64, 62, 2, 64, 62, 34);
  glow.addColorStop(0, 'rgba(255,236,150,0.95)');
  glow.addColorStop(1, 'rgba(255,200,60,0)');
  g.fillStyle = glow;
  g.beginPath(); g.arc(64, 62, 34, 0, TAU); g.fill();
  g.fillStyle = '#f0bd45';
  g.beginPath(); g.moveTo(34, 76); g.quadraticCurveTo(40, 54, 64, 52); g.quadraticCurveTo(88, 54, 94, 76); g.closePath(); g.fill(); outline(2.6);
  // a log, a brick and an iron bar poking out of the gold
  g.save(); g.translate(44, 58); g.rotate(-0.45);
  g.fillStyle = '#a86b36'; g.beginPath(); g.rect(-4, -5, 26, 10); g.fill(); outline(2);
  g.fillStyle = '#ecc690'; g.beginPath(); g.ellipse(-4, 0, 4, 5, 0, 0, TAU); g.fill(); outline(2);
  g.restore();
  g.save(); g.translate(78, 54); g.rotate(0.35);
  g.fillStyle = '#c2603e'; g.beginPath(); g.rect(-9, -6, 18, 11); g.fill(); outline(2);
  g.strokeStyle = '#e08a62'; g.lineWidth = 2; g.beginPath(); g.moveTo(-5, -2); g.lineTo(5, -2); g.stroke();
  g.restore();
  g.fillStyle = '#b9c4cc';
  g.beginPath(); g.moveTo(54, 68); g.lineTo(58, 58); g.lineTo(72, 58); g.lineTo(76, 68); g.closePath(); g.fill(); outline(2);
  g.strokeStyle = '#eef3f6'; g.lineWidth = 2; g.beginPath(); g.moveTo(60, 61); g.lineTo(68, 61); g.stroke();
  for (const [x, y] of [[46, 70], [83, 69], [64, 53]] as [number, number][]) {
    g.fillStyle = '#fde38a'; g.beginPath(); g.arc(x, y, 4.2, 0, TAU); g.fill(); outline(1.8);
  }
  // the box itself
  g.fillStyle = '#a86b36';
  g.beginPath(); g.roundRect(34, 74, 60, 28, 3); g.fill(); outline(3);
  g.strokeStyle = '#6e4220'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(36, 88); g.lineTo(92, 88); g.stroke();
  g.fillStyle = '#a8741a';
  for (const x of [40, 82]) { g.beginPath(); g.rect(x, 76, 6, 26); g.fill(); outline(1.6); }
  g.fillStyle = '#f0bd45';
  g.beginPath(); g.roundRect(32, 70, 64, 8, 2); g.fill(); outline(2.6);
  g.fillStyle = '#fde38a';
  g.beginPath(); g.rect(36, 72, 18, 2.4); g.fill();
  g.fillStyle = '#f0bd45';
  g.beginPath(); g.moveTo(58, 78); g.lineTo(70, 78); g.lineTo(70, 88); g.lineTo(64, 93); g.lineTo(58, 88); g.closePath(); g.fill(); outline(2);
  g.fillStyle = INK; g.beginPath(); g.arc(64, 84, 2.2, 0, TAU); g.fill();
  // clay bricks and iron ingots set out in front
  g.fillStyle = '#c2603e';
  for (const [x, y] of [[22, 100], [30, 100], [26, 94]] as [number, number][]) { g.beginPath(); g.rect(x, y, 9, 6); g.fill(); outline(1.6); }
  g.fillStyle = '#b9c4cc';
  for (const [x, y] of [[92, 104], [101, 104]] as [number, number][]) { g.beginPath(); g.moveTo(x, y + 5); g.lineTo(x + 2, y); g.lineTo(x + 8, y); g.lineTo(x + 10, y + 5); g.closePath(); g.fill(); outline(1.6); }
  // the front half of the stakes
  for (const a of stakes) if (Math.sin(a) >= 0) stake(a);
  cacheSprites.set(ground, c);
  return c;
}
