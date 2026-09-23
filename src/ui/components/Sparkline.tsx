// Points-over-time chart for a single ruler: area fill, 2px line, emphasized
// endpoint, recessive grid, and a hover crosshair with a tooltip.

import { useState } from 'preact/hooks';
import { fmt, fmtAgo } from '../format';
import { now } from '../store';

const W = 360, H = 120, PL = 44, PR = 12, PT = 12, PB = 22;

export function Sparkline({ points }: { points: [number, number][] }) {
  const [hover, setHover] = useState<number | null>(null);
  const t0 = points[0][0], t1 = points[points.length - 1][0];
  const maxV = Math.max(1, ...points.map((p) => p[1]));
  const niceMax = niceCeil(maxV);
  const x = (t: number) => PL + ((t - t0) / Math.max(1, t1 - t0)) * (W - PL - PR);
  const y = (v: number) => PT + (1 - v / niceMax) * (H - PT - PB);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ');
  const area = `${line} L${x(t1).toFixed(1)} ${y(0)} L${x(t0).toFixed(1)} ${y(0)} Z`;
  const last = points[points.length - 1];
  const ticks = [0, niceMax / 2, niceMax];
  const hp = hover !== null ? points[hover] : null;
  return (
    <div class="spark">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Points over time, now ${fmt(last[1])}`}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          for (let i = 1; i < points.length; i++) if (Math.abs(x(points[i][0]) - px) < Math.abs(x(points[best][0]) - px)) best = i;
          setHover(best);
        }}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} class="spark-grid" />
            <text x={PL - 6} y={y(t) + 4} text-anchor="end" class="spark-label">{fmtCompact(t)}</text>
          </g>
        ))}
        <path d={area} class="spark-area" />
        <path d={line} class="spark-line" />
        <circle cx={x(last[0])} cy={y(last[1])} r="4" class="spark-end" />
        <text x={PL} y={H - 6} class="spark-label">{fmtAgo(t0, now.value)}</text>
        <text x={W - PR} y={H - 6} text-anchor="end" class="spark-label">now</text>
        {hp && (
          <g pointer-events="none">
            <line x1={x(hp[0])} x2={x(hp[0])} y1={PT} y2={H - PB} class="spark-cross" />
            <circle cx={x(hp[0])} cy={y(hp[1])} r="4" class="spark-end" />
          </g>
        )}
        <rect x={PL} y={PT} width={W - PL - PR} height={H - PT - PB} fill="transparent" />
      </svg>
      <div class="spark-tip" aria-live="polite">
        {hp ? <><b class="num">{fmt(hp[1])}</b> points · {fmtAgo(hp[0], now.value)}</> : <><b class="num">{fmt(last[1])}</b> points now</>}
      </div>
    </div>
  );
}

function niceCeil(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function fmtCompact(n: number): string {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}
