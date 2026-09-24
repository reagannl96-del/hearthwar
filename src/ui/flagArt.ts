// A ruler's banner, painted onto a canvas: the one drawing used by the banner
// editor, its thumbnails, the profile badge and the cloth flown at the gate in
// the 3D village. The hoist (the side at the pole) is on the left; everything
// outside the banner's shape stays transparent.

import { DEFAULT_FLAG, FLAG_COLORS, type FlagDesign } from '../engine/data/flags';

type Pt = [number, number];

const hex = (i: number) => (FLAG_COLORS[i] ?? FLAG_COLORS[0]).hex;

/** The banner's outline, in pixels. `holes` are cut out with the even-odd rule. */
function shapePath(shape: number, w: number, h: number): Path2D {
  const p = new Path2D();
  const poly = (pts: Pt[]) => {
    p.moveTo(pts[0][0] * w, pts[0][1] * h);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0] * w, pts[i][1] * h);
    p.closePath();
  };
  switch (shape) {
    case 1: // swallowtail
      poly([[0, 0], [1, 0], [0.74, 0.5], [1, 1], [0, 1]]);
      break;
    case 2: // pennant
      poly([[0, 0], [1, 0.47], [1, 0.53], [0, 1]]);
      break;
    case 3: { // gonfalon: three rounded tongues at the fly
      p.moveTo(0, 0);
      const tip = (y0: number, y1: number) => {
        const ym = (y0 + y1) / 2;
        p.quadraticCurveTo(w * 1.02, h * (y0 + (ym - y0) * 0.2), w, h * ym);
        p.quadraticCurveTo(w * 1.02, h * (y1 - (y1 - ym) * 0.2), w * 0.76, h * y1);
      };
      p.lineTo(w * 0.76, 0);
      tip(0, 1 / 3);
      tip(1 / 3, 2 / 3);
      tip(2 / 3, 1);
      p.lineTo(0, h);
      p.closePath();
      break;
    }
    case 4: { // square
      const q = Math.min(w, h);
      p.rect(0, (h - q) / 2, q, q);
      break;
    }
    case 5: // long pennon: a narrow streamer ending in a small fork
      poly([[0, 0.1], [1, 0.43], [0.93, 0.5], [1, 0.57], [0, 0.9]]);
      break;
    case 6: { // tattered: a torn fly, ragged edges and a couple of holes
      const pts: Pt[] = [[0, 0], [0.42, 0], [0.5, 0.03], [0.58, 0], [0.7, 0.01], [0.78, 0.05], [0.86, 0.02]];
      const fly = [0.96, 0.89, 1, 0.92, 0.97, 0.87, 0.95, 1, 0.9, 0.96, 0.91, 0.99, 0.93];
      for (let i = 0; i < fly.length; i++) pts.push([fly[i], 0.06 + (i / (fly.length - 1)) * 0.88]);
      pts.push([0.88, 0.97], [0.76, 1], [0.66, 0.96], [0.55, 1], [0.44, 0.98], [0, 1]);
      poly(pts);
      const hole = (cx: number, cy: number, r: number, n: number) => {
        const hp: Pt[] = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const k = r * (0.7 + ((i * 7) % 5) * 0.12);
          hp.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k * (w / h)]);
        }
        poly(hp);
      };
      hole(0.8, 0.28, 0.035, 7);
      hole(0.72, 0.8, 0.028, 6);
      break;
    }
    case 7: // split banner: a square slot cut into the fly
      poly([[0, 0], [1, 0], [1, 0.4], [0.62, 0.4], [0.62, 0.6], [1, 0.6], [1, 1], [0, 1]]);
      break;
    default: // banner
      p.rect(0, 0, w, h);
  }
  return p;
}

/** Where the emblem sits on each shape (nearer the hoist on the narrow ones), and how big. */
function emblemSpot(shape: number, w: number, h: number): { cx: number; cy: number; r: number } {
  switch (shape) {
    case 1: return { cx: w * 0.38, cy: h / 2, r: h * 0.28 };
    case 2: return { cx: w * 0.28, cy: h / 2, r: h * 0.22 };
    case 3: return { cx: w * 0.4, cy: h / 2, r: h * 0.29 };
    case 4: { const q = Math.min(w, h); return { cx: q / 2, cy: h / 2, r: q * 0.3 }; }
    case 5: return { cx: w * 0.2, cy: h / 2, r: h * 0.2 };
    case 6: return { cx: w * 0.42, cy: h / 2, r: h * 0.28 };
    case 7: return { cx: w * 0.3, cy: h / 2, r: h * 0.28 };
    default: return { cx: w / 2, cy: h / 2, r: h * 0.3 };
  }
}

/** The field's own width (a square banner only uses part of the canvas). */
const fieldWidth = (shape: number, w: number, h: number) => (shape === 4 ? Math.min(w, h) : w);

function drawPattern(ctx: CanvasRenderingContext2D, pattern: number, shape: Path2D, fw: number, fh: number, w: number, h: number, cx: number) {
  const y0 = (h - fh) / 2;
  const band = fh * 0.2;
  ctx.beginPath();
  switch (pattern) {
    case 1: // stripe (a fess)
      ctx.rect(0, y0 + fh / 2 - band * 0.75, fw, band * 1.5);
      break;
    case 2: // two stripes
      ctx.rect(0, y0 + fh * 0.2, fw, band * 0.75);
      ctx.rect(0, y0 + fh * 0.8 - band * 0.75, fw, band * 0.75);
      break;
    case 3: // cross, its upright through the emblem
      ctx.rect(cx - band * 0.55, y0, band * 1.1, fh);
      ctx.rect(0, y0 + fh / 2 - band * 0.55, w, band * 1.1);
      break;
    case 4: { // saltire
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = band * 1.05;
      ctx.lineCap = 'square';
      ctx.moveTo(0, y0); ctx.lineTo(fw, y0 + fh);
      ctx.moveTo(0, y0 + fh); ctx.lineTo(fw, y0);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 5: // chevron, rising to a point over the emblem
      ctx.moveTo(0, y0 + fh * 0.95);
      ctx.lineTo(cx, y0 + fh * 0.12);
      ctx.lineTo(fw * 1.2, y0 + fh * 1.05);
      ctx.lineTo(fw * 1.2, y0 + fh * 1.05 + band * 1.3);
      ctx.lineTo(cx, y0 + fh * 0.12 + band * 1.5);
      ctx.lineTo(0, y0 + fh * 0.95 + band * 1.5);
      ctx.closePath();
      break;
    case 6: // quartered
      ctx.rect(0, y0, fw / 2, fh / 2);
      ctx.rect(fw / 2, y0 + fh / 2, w, fh / 2);
      break;
    case 7: { // border, following the banner's own edge
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = band * 0.9;
      ctx.lineJoin = 'miter';
      ctx.stroke(shape);
      ctx.restore();
      return;
    }
    case 8: // per pale: the fly half
      ctx.rect(fw / 2, 0, w, h);
      break;
    case 9: // per fess: the lower half
      ctx.rect(0, y0 + fh / 2, w, h);
      break;
    case 10: { // bend, from the top of the hoist down to the fly
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = band * 1.25;
      ctx.moveTo(-band, y0 - band * (fh / fw));
      ctx.lineTo(fw + band, y0 + fh + band * (fh / fw));
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 11: { // chequy
      const cell = fh / 4;
      for (let r = 0; r < 4; r++) for (let c = 0; c * cell < w; c++) if ((r + c) % 2 === 0) ctx.rect(c * cell, y0 + r * cell, cell, cell);
      break;
    }
    default:
      return;
  }
  ctx.fill();
}

// ---- emblems, drawn in a box from -1 to 1 ----

type Paint = { fill: (p: Path2D) => void; cut: (p: Path2D) => void; line: (p: Path2D, w: number, cut?: boolean) => void };

const P = (f: (p: Path2D) => void) => { const p = new Path2D(); f(p); return p; };
const polyP = (pts: Pt[]) => P((p) => { p.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) p.lineTo(q[0], q[1]); p.closePath(); });
const circ = (x: number, y: number, r: number) => P((p) => p.arc(x, y, r, 0, Math.PI * 2));

const CHARGES: ((g: Paint) => void)[] = [
  () => {},
  // star
  (g) => {
    const pts: Pt[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 0.42 : 1;
      pts.push([Math.cos(a) * r, Math.sin(a) * r + 0.06]);
    }
    g.fill(polyP(pts));
  },
  // sun
  (g) => {
    g.fill(circ(0, 0, 0.46));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, b = 0.13;
      g.fill(polyP([[Math.cos(a - b) * 0.54, Math.sin(a - b) * 0.54], [Math.cos(a) * (i % 2 ? 0.8 : 0.98), Math.sin(a) * (i % 2 ? 0.8 : 0.98)], [Math.cos(a + b) * 0.54, Math.sin(a + b) * 0.54]]));
    }
  },
  // moon: a crescent, horns to the fly
  (g) => {
    const a1 = Math.atan2(0.742, 0.509), a2 = Math.atan2(0.742, 0.109);
    g.fill(P((p) => {
      p.arc(-0.12, 0, 0.9, a1, Math.PI * 2 - a1, false);
      p.arc(0.28, 0, 0.75, -a2, a2, true);
      p.closePath();
    }));
  },
  // crown
  (g) => {
    g.fill(polyP([[-0.8, 0.5], [0.8, 0.5], [0.9, -0.38], [0.44, 0.02], [0, -0.58], [-0.44, 0.02], [-0.9, -0.38]]));
    g.fill(P((p) => p.rect(-0.82, 0.5, 1.64, 0.3)));
    for (const [x, y] of [[-0.9, -0.44], [0, -0.66], [0.9, -0.44]] as Pt[]) g.fill(circ(x, y, 0.13));
    for (const x of [-0.45, 0, 0.45]) g.cut(circ(x, 0.65, 0.07));
  },
  // sword, point up
  (g) => {
    g.fill(polyP([[-0.17, 0.34], [-0.17, -0.7], [0, -0.98], [0.17, -0.7], [0.17, 0.34]]));
    g.fill(polyP([[-0.6, 0.26], [0.6, 0.26], [0.52, 0.44], [-0.52, 0.44]]));
    g.fill(P((p) => p.rect(-0.09, 0.44, 0.18, 0.34)));
    g.fill(circ(0, 0.86, 0.14));
  },
  // tower
  (g) => {
    g.fill(polyP([[-0.44, 0.92], [-0.4, -0.38], [0.4, -0.38], [0.44, 0.92]]));
    g.fill(P((p) => p.rect(-0.6, -0.52, 1.2, 0.18)));
    for (const x of [-0.6, -0.14, 0.32]) g.fill(P((p) => p.rect(x, -0.82, 0.28, 0.32)));
    g.cut(P((p) => { p.moveTo(-0.16, 0.92); p.lineTo(-0.16, 0.6); p.arc(0, 0.6, 0.16, Math.PI, 0); p.lineTo(0.16, 0.92); p.closePath(); }));
    g.cut(P((p) => p.rect(-0.06, -0.18, 0.12, 0.3)));
  },
  // wolf's head, snarling to the fly
  (g) => {
    g.fill(polyP([
      [-0.62, 0.95], [-0.66, 0.2], [-0.52, -0.3], [-0.42, -0.98], [-0.14, -0.5], [0.06, -0.94], [0.22, -0.36],
      [0.5, -0.2], [0.98, 0.02], [0.92, 0.2], [0.5, 0.26], [0.72, 0.4], [0.62, 0.52], [0.18, 0.5], [0.12, 0.95],
    ]));
    g.cut(polyP([[0.12, -0.12], [0.34, -0.08], [0.16, 0.0]]));
    g.line(P((p) => { p.moveTo(-0.46, -0.66); p.lineTo(-0.34, -0.36); }), 0.06, true);
  },
  // tree
  (g) => {
    g.fill(polyP([[-0.12, 0.2], [0.12, 0.2], [0.14, 0.78], [0.42, 0.95], [-0.42, 0.95], [-0.14, 0.78]]));
    for (const [x, y, r] of [[0, -0.42, 0.44], [-0.42, -0.06, 0.38], [0.42, -0.06, 0.38], [0, 0.04, 0.42], [-0.24, -0.5, 0.3], [0.26, -0.5, 0.3]] as [number, number, number][]) g.fill(circ(x, y, r));
  },
  // skull
  (g) => {
    g.fill(circ(0, -0.22, 0.7));
    g.fill(P((p) => { p.moveTo(-0.42, 0.2); p.lineTo(0.42, 0.2); p.lineTo(0.36, 0.8); p.lineTo(-0.36, 0.8); p.closePath(); }));
    g.cut(circ(-0.27, -0.12, 0.2));
    g.cut(circ(0.27, -0.12, 0.2));
    g.cut(polyP([[0, 0.1], [-0.09, 0.3], [0.09, 0.3]]));
    for (const x of [-0.18, 0, 0.18]) g.cut(P((p) => p.rect(x - 0.035, 0.52, 0.07, 0.28)));
  },
  // flame
  (g) => {
    g.fill(P((p) => {
      p.moveTo(0.05, -0.98);
      p.bezierCurveTo(0.4, -0.55, 0.8, -0.2, 0.62, 0.38);
      p.bezierCurveTo(0.52, 0.8, 0.22, 0.96, 0, 0.96);
      p.bezierCurveTo(-0.3, 0.96, -0.64, 0.74, -0.64, 0.32);
      p.bezierCurveTo(-0.64, -0.02, -0.38, -0.2, -0.32, -0.56);
      p.bezierCurveTo(-0.14, -0.34, -0.04, -0.44, 0.05, -0.98);
      p.closePath();
    }));
    g.cut(P((p) => {
      p.moveTo(0.02, -0.12);
      p.bezierCurveTo(0.22, 0.12, 0.38, 0.34, 0.28, 0.6);
      p.bezierCurveTo(0.2, 0.78, -0.2, 0.8, -0.28, 0.56);
      p.bezierCurveTo(-0.34, 0.34, -0.14, 0.2, 0.02, -0.12);
      p.closePath();
    }));
  },
  // shield, with an inner line
  (g) => {
    const sh = (k: number) => P((p) => {
      p.moveTo(-0.72 * k, -0.84 * k);
      p.lineTo(0.72 * k, -0.84 * k);
      p.lineTo(0.72 * k, -0.02 * k);
      p.quadraticCurveTo(0.7 * k, 0.62 * k, 0, 0.98 * k);
      p.quadraticCurveTo(-0.7 * k, 0.62 * k, -0.72 * k, -0.02 * k);
      p.closePath();
    });
    g.fill(sh(1));
    g.cut(sh(0.78));
    g.fill(sh(0.66));
  },
  // leaf
  (g) => {
    g.fill(P((p) => {
      p.moveTo(0.02, 0.62);
      p.bezierCurveTo(-0.78, 0.42, -0.62, -0.5, 0.06, -0.98);
      p.bezierCurveTo(0.7, -0.46, 0.74, 0.42, 0.02, 0.62);
      p.closePath();
    }));
    g.line(P((p) => { p.moveTo(0.02, 0.98); p.quadraticCurveTo(0.04, 0.2, 0.06, -0.72); }), 0.08);
    g.line(P((p) => { p.moveTo(0.04, 0.62); p.quadraticCurveTo(0.05, -0.1, 0.06, -0.72); }), 0.06, true);
    for (const y of [-0.34, 0.0, 0.32]) g.line(P((p) => { p.moveTo(-0.36, y - 0.16); p.lineTo(0.05, y + 0.06); p.lineTo(0.44, y - 0.16); }), 0.045, true);
  },
  // rune (algiz)
  (g) => {
    g.line(P((p) => { p.moveTo(0, 0.95); p.lineTo(0, -0.95); p.moveTo(0, 0.02); p.lineTo(-0.62, -0.72); p.moveTo(0, 0.02); p.lineTo(0.62, -0.72); }), 0.22);
  },
  // anchor
  (g) => {
    g.line(P((p) => p.arc(0, -0.74, 0.17, 0, Math.PI * 2)), 0.1);
    g.line(P((p) => { p.moveTo(0, -0.56); p.lineTo(0, 0.86); p.moveTo(-0.42, -0.36); p.lineTo(0.42, -0.36); }), 0.16);
    g.line(P((p) => { p.moveTo(-0.66, 0.3); p.quadraticCurveTo(-0.5, 0.9, 0, 0.9); p.quadraticCurveTo(0.5, 0.9, 0.66, 0.3); }), 0.14);
    g.fill(polyP([[-0.84, 0.36], [-0.58, 0.12], [-0.5, 0.42]]));
    g.fill(polyP([[0.84, 0.36], [0.58, 0.12], [0.5, 0.42]]));
  },
  // eagle, displayed
  (g) => {
    const wing: Pt[] = [[-0.14, -0.3], [-0.46, -0.84], [-0.98, -0.62], [-0.8, -0.44], [-0.98, -0.26], [-0.76, -0.14], [-0.9, 0.06], [-0.6, 0.06], [-0.66, 0.24], [-0.18, 0.1]];
    g.fill(polyP(wing));
    g.fill(polyP(wing.map(([x, y]) => [-x, y] as Pt)));
    g.fill(P((p) => p.ellipse(0, 0.02, 0.22, 0.46, 0, 0, Math.PI * 2)));
    g.fill(circ(0.04, -0.62, 0.17));
    g.fill(polyP([[0.18, -0.68], [0.36, -0.6], [0.18, -0.54]]));
    g.fill(polyP([[-0.2, 0.36], [-0.32, 0.9], [-0.1, 0.74], [0, 0.96], [0.1, 0.74], [0.32, 0.9], [0.2, 0.36]]));
    g.cut(circ(0.08, -0.65, 0.04));
  },
];

let scratch: HTMLCanvasElement | null = null;

function drawCharge(ctx: CanvasRenderingContext2D, charge: number, color: string, cx: number, cy: number, r: number) {
  const draw = CHARGES[charge];
  if (!draw || charge === 0) return;
  // painted on its own little canvas first, so cut-outs (eyes, doors, veins) show the flag beneath
  const size = Math.max(8, Math.ceil(r * 2.4));
  const c = (scratch ??= document.createElement('canvas'));
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, size, size);
  g.setTransform(r, 0, 0, r, size / 2, size / 2);
  g.fillStyle = g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const paint: Paint = {
    fill: (p) => { g.globalCompositeOperation = 'source-over'; g.fill(p); },
    cut: (p) => { g.globalCompositeOperation = 'destination-out'; g.fill(p); g.globalCompositeOperation = 'source-over'; },
    line: (p, w, cut) => { g.globalCompositeOperation = cut ? 'destination-out' : 'source-over'; g.lineWidth = w; g.stroke(p); g.globalCompositeOperation = 'source-over'; },
  };
  draw(paint);
  g.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  // a faint dark rim, so an emblem reads even on a stripe of its own colour
  ctx.shadowColor = 'rgba(20, 12, 6, 0.55)';
  ctx.shadowBlur = Math.max(1, r * 0.08);
  ctx.drawImage(c, cx - size / 2, cy - size / 2);
  ctx.restore();
}

/**
 * Paint a banner into the w×h box at the canvas origin (the caller clears it).
 * `plain` leaves off the cloth shading, for a texture that gets its own light.
 */
export function drawFlag(ctx: CanvasRenderingContext2D, design: FlagDesign | null | undefined, w: number, h: number, opts: { plain?: boolean } = {}): void {
  const d = design ?? DEFAULT_FLAG;
  const shape = shapePath(d.shape, w, h);
  const fw = fieldWidth(d.shape, w, h);
  const spot = emblemSpot(d.shape, w, h);
  ctx.save();
  ctx.clip(shape, 'evenodd');
  ctx.fillStyle = hex(d.field);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = hex(d.accent);
  drawPattern(ctx, d.pattern, shape, fw, d.shape === 4 ? fw : h, w, h, spot.cx);
  drawCharge(ctx, d.charge, hex(d.chargeColor), spot.cx, spot.cy, spot.r);
  if (!opts.plain) {
    // soft folds in the cloth, a sheen near the top, and a darker hem
    const folds = ctx.createLinearGradient(0, 0, fw, 0);
    for (let i = 0; i <= 6; i++) {
      const k = i / 6;
      folds.addColorStop(k, i % 2 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)');
    }
    ctx.fillStyle = folds;
    ctx.fillRect(0, 0, w, h);
    const sheen = ctx.createLinearGradient(0, 0, 0, h);
    sheen.addColorStop(0, 'rgba(255,255,255,0.10)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.strokeStyle = 'rgba(30, 18, 8, 0.45)';
  ctx.lineWidth = Math.max(1.2, h * 0.035);
  ctx.stroke(shape);
  ctx.restore();
}

/** A banner as an image URL (for small badges and thumbnails), cached per design and size. */
const urlCache = new Map<string, string>();
export function flagDataUrl(design: FlagDesign | null | undefined, w: number, h: number): string {
  const d = design ?? DEFAULT_FLAG;
  const key = `${d.shape},${d.pattern},${d.charge},${d.field},${d.accent},${d.chargeColor}|${w}x${h}`;
  let url = urlCache.get(key);
  if (!url) {
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    drawFlag(g, d, w, h);
    url = c.toDataURL();
    if (urlCache.size > 400) urlCache.clear();
    urlCache.set(key, url);
  }
  return url;
}

/** Any design at all, picked at random, but always with an emblem that stands out from the field. */
export function randomFlag(rand: () => number = Math.random): FlagDesign {
  const pick = (n: number) => Math.floor(rand() * n);
  const n = FLAG_COLORS.length;
  const field = pick(n);
  let accent = pick(n);
  while (accent === field) accent = pick(n);
  let chargeColor = pick(n);
  while (chargeColor === field || chargeColor === accent) chargeColor = pick(n);
  return { shape: pick(8), pattern: pick(12), charge: 1 + pick(15), field, accent, chargeColor };
}
