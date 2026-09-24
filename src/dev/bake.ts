// Dev tool: bakes the painted village sheets (art-src/villages/*.webp, eight stages
// each, 4 across and 2 down) into compact atlases for the map. Open /dev/bake.html with
// the dev server running and the local writer listening on 127.0.0.1:5198.
//
// Every island is cut out by its own pixels (flags and smoke that float free are
// kept with the nearest island), then all 48 are scaled by one common factor and
// stood on the bottom edge of their cell, so a bigger stage stays bigger on the map.

import generic from '../../art-src/villages/generic.webp?url';
import paladin from '../../art-src/villages/paladin.webp?url';
import sorcerer from '../../art-src/villages/sorcerer.webp?url';
import druid from '../../art-src/villages/druid.webp?url';
import goblin from '../../art-src/villages/goblin.webp?url';
import necromancer from '../../art-src/villages/necromancer.webp?url';

const SHEETS: Record<string, string> = { generic, paladin, sorcerer, druid, goblin, necromancer };
const q = new URLSearchParams(location.search);
const CELL = Number(q.get('cell') ?? 208);
const QUALITY = Number(q.get('q') ?? 0.86);
const SAVE = q.get('save') === '1';

interface Box { x0: number; y0: number; x1: number; y1: number; n: number; cx: number; cy: number; px?: number[] }

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });
}

/** Connected blobs of visible pixels (8-connected). */
function blobs(a: Uint8ClampedArray, W: number, H: number): Box[] {
  const seen = new Uint8Array(W * H);
  const out: Box[] = [];
  const stack: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || a[i * 4 + 3] < 20) continue;
    const b: Box = { x0: W, y0: H, x1: 0, y1: 0, n: 0, cx: 0, cy: 0, px: [] };
    stack.push(i); seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % W, y = (p / W) | 0;
      b.n++; b.cx += x; b.cy += y; b.px!.push(p);
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = ny * W + nx;
        if (!seen[k] && a[k * 4 + 3] >= 20) { seen[k] = 1; stack.push(k); }
      }
    }
    b.cx /= b.n; b.cy /= b.n;
    out.push(b);
  }
  return out;
}

function boxOf(px: number[], W: number): Box {
  const b: Box = { x0: Infinity, y0: Infinity, x1: 0, y1: 0, n: px.length, cx: 0, cy: 0 };
  for (const p of px) {
    const x = p % W, y = (p / W) | 0;
    b.cx += x; b.cy += y;
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
  }
  b.cx /= b.n; b.cy /= b.n;
  return b;
}

/** A blob wider or taller than one cell is two islands touching: cut where it is thinnest near the cell line. */
function split(px: number[], W: number, H: number): Box[] {
  const b = boxOf(px, W);
  const cw = W / 4, ch = H / 2;
  const cut = (axis: 'x' | 'y', line: number, reach: number): Box[] => {
    const lo = Math.round(line - reach), hi = Math.round(line + reach);
    const hist = new Map<number, number>();
    for (const p of px) { const v = axis === 'x' ? p % W : (p / W) | 0; if (v >= lo && v <= hi) hist.set(v, (hist.get(v) ?? 0) + 1); }
    let best = lo, bestN = Infinity;
    for (let v = lo; v <= hi; v++) { const n = hist.get(v) ?? 0; if (n < bestN) { bestN = n; best = v; } }
    const a: number[] = [], c: number[] = [];
    for (const p of px) ((axis === 'x' ? p % W : (p / W) | 0) < best ? a : c).push(p);
    return [...split(a, W, H), ...split(c, W, H)];
  };
  if (b.y1 - b.y0 > ch * 1.15) return cut('y', ch, ch * 0.2);
  if (b.x1 - b.x0 > cw * 1.15) {
    const line = Math.round((b.x0 + b.x1) / 2 / cw) * cw;
    return cut('x', line, cw * 0.15);
  }
  return px.length > 4000 ? [b] : [];
}

const gap = (a: Box, b: Box) => Math.max(0, a.x0 - b.x1, b.x0 - a.x1) + Math.max(0, a.y0 - b.y1, b.y0 - a.y1);

async function main() {
  const log = document.getElementById('log')!;
  const say = (s: string) => { log.textContent += s + '\n'; };
  const cut: Record<string, { img: HTMLImageElement; boxes: Box[] }> = {};
  for (const [name, src] of Object.entries(SHEETS)) {
    const img = await load(src);
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0);
    const all = blobs(g.getImageData(0, 0, W, H).data, W, H);
    const big = all.filter((b) => b.n > 4000);
    // one island per cell of the 4 x 2 grid (a big blob belongs to the cell its middle is in)
    const cells: (Box | null)[] = Array(8).fill(null);
    // (two islands that touch come out as one blob: it is cut apart at its narrowest point)
    for (const b of big.flatMap((b) => split(b.px!, W, H))) {
      const i = Math.min(1, Math.floor(b.cy / (H / 2))) * 4 + Math.min(3, Math.floor(b.cx / (W / 4)));
      const o = cells[i];
      cells[i] = o ? { x0: Math.min(o.x0, b.x0), y0: Math.min(o.y0, b.y0), x1: Math.max(o.x1, b.x1), y1: Math.max(o.y1, b.y1), n: o.n + b.n, cx: o.cx, cy: o.cy } : b;
    }
    if (cells.some((b) => !b)) { say(`${name}: could not find all eight islands (${big.length} big blobs: ${big.map((b) => `${b.x0},${b.y0}-${b.x1},${b.y1}`).join(' ')})`); return; }
    // loose bits (a flag, a puff of smoke) join the island they are closest to
    for (const b of all) {
      if (b.n > 4000 || b.n < 6) continue;
      let best = 0, bestD = Infinity;
      cells.forEach((cb, i) => { const d = gap(b, cb!); if (d < bestD) { bestD = d; best = i; } });
      if (bestD > 40) continue;
      const cb = cells[best]!;
      cells[best] = { ...cb, x0: Math.min(cb.x0, b.x0), y0: Math.min(cb.y0, b.y0), x1: Math.max(cb.x1, b.x1), y1: Math.max(cb.y1, b.y1) };
    }
    cut[name] = { img, boxes: cells as Box[] };
    say(`${name}: ${W}x${H}, islands ${cells.map((b) => `${b!.x1 - b!.x0 + 1}x${b!.y1 - b!.y0 + 1}`).join(' ')}`);
  }
  // one scale for every island of every sheet
  let maxW = 0, maxH = 0;
  for (const { boxes } of Object.values(cut)) for (const b of boxes) { maxW = Math.max(maxW, b.x1 - b.x0 + 1); maxH = Math.max(maxH, b.y1 - b.y0 + 1); }
  const pad = 2;
  const scale = (CELL - pad * 2) / Math.max(maxW, maxH);
  say(`largest island ${maxW}x${maxH}, scale ${scale.toFixed(4)}, cell ${CELL}`);
  const meta: Record<string, number[][]> = {};
  const show = document.getElementById('show')!;
  for (const [name, { img, boxes }] of Object.entries(cut)) {
    const atlas = document.createElement('canvas');
    atlas.width = CELL * 4; atlas.height = CELL * 2;
    const g = atlas.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    meta[name] = [];
    boxes.forEach((b, i) => {
      const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
      const dw = w * scale, dh = h * scale;
      const dx = (i % 4) * CELL + (CELL - dw) / 2, dy = Math.floor(i / 4) * CELL + CELL - pad - dh;
      g.drawImage(img, b.x0, b.y0, w, h, dx, dy, dw, dh);
      // where the island's ground sits in its cell (0..1): the base of the island
      meta[name].push([Math.round(dw), Math.round(dh)]);
    });
    atlas.style.background = '#7a9a44';
    atlas.style.display = 'block';
    atlas.style.marginBottom = '6px';
    show.appendChild(atlas);
    const url = atlas.toDataURL('image/webp', QUALITY);
    say(`${name}: atlas ${atlas.width}x${atlas.height}, ${Math.round((url.length * 3) / 4 / 1024)} KB`);
    if (SAVE) {
      const r = await fetch(`http://127.0.0.1:5198/save?name=${name}.webp`, { method: 'POST', body: url });
      say(`  saved: ${await r.text()}`);
    }
  }
  if (SAVE) await fetch('http://127.0.0.1:5198/save?name=sizes.json', { method: 'POST', body: JSON.stringify({ cell: CELL, sizes: meta }) });
  say('done');
}

void main();
