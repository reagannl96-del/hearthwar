// Painted map sprites, stamped onto the world map at any zoom.
//
// Villages are hand-painted little islands in eight stages, from two cottages on a
// patch of grass to a castle with towers everywhere (src/ui/art/villages, baked from
// the sheets in art-src/villages by src/dev/bake.ts). Everyone else's villages wear
// the plain red-roofed set; your own wear the set of the hero at their statue.
// Barbarian villages are the plain set, weathered; the snowy north and the volcanic
// west repaint the grass as snow or ash.

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

type Ground = 'grass' | 'snow' | 'ash';
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

/**
 * Weather and neglect, pixel by pixel: grass and leaves (anything clearly green,
 * but not a bright magical glow) turn to snow or ash; a barbarian village loses
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
