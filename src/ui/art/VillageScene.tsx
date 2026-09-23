// The illustrated village. Buildings appear and change as they level up.

import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { BUILDINGS } from '../../engine/data/buildings';
import type { BuildingId, Buildings } from '../../engine/types';
import { Icon } from './icons';

interface Props {
  buildings: Buildings;
  building?: Partial<Record<BuildingId, number>>; // levels under construction
  onPick: (b: BuildingId) => void;
  showLevels?: boolean;
  color?: string;
}

const POS: Record<BuildingId, [number, number]> = {
  academy: [480, 178],
  main: [480, 300],
  barracks: [318, 240],
  smithy: [645, 238],
  stable: [285, 372],
  statue: [392, 372],
  workshop: [372, 468],
  rally: [488, 408],
  hiding: [568, 386],
  market: [676, 372],
  warehouse: [598, 470],
  watchtower: [770, 262],
  timber: [118, 178],
  claypit: [122, 492],
  ironmine: [846, 168],
  farm: [842, 498],
  wall: [480, 330],
};

const D = 14; // depth offset for the 2.5D look

function Hall(p: {
  w: number; h: number; roofH: number; wall?: string; wallSide?: string; roof?: string; roofSide?: string;
  door?: boolean; windows?: number; stone?: boolean; doorW?: number;
}): JSX.Element {
  const { w, h, roofH } = p;
  const wall = p.wall ?? (p.stone ? 'var(--sc-stone)' : 'var(--sc-timber)');
  const wallSide = p.wallSide ?? (p.stone ? 'var(--sc-stone-dark)' : 'var(--sc-timber-dark)');
  const roof = p.roof ?? 'var(--sc-thatch)';
  const roofSide = p.roofSide ?? 'var(--sc-thatch-dark)';
  const hw = w / 2;
  const inset = w * 0.2;
  const win = p.windows ?? 2;
  const doorW = p.doorW ?? Math.min(18, w * 0.18);
  const winXs = Array.from({ length: win }, (_, i) => -hw + ((i + 1) * w) / (win + 1));
  return (
    <g>
      <path d={`M${hw} 0 L${hw + D} ${-D * 0.6} L${hw + D} ${-h - D * 0.6} L${hw} ${-h} Z`} fill={wallSide} />
      <rect x={-hw} y={-h} width={w} height={h} fill={wall} />
      {p.stone && (
        <g stroke="var(--sc-stone-dark)" stroke-width="1" opacity=".5">
          {Array.from({ length: Math.floor(h / 9) }, (_, i) => (
            <line x1={-hw} x2={hw} y1={-h + 9 * (i + 1)} y2={-h + 9 * (i + 1)} />
          ))}
        </g>
      )}
      {!p.stone && (
        <g stroke="var(--sc-timber-dark)" stroke-width="1.2" opacity=".55">
          <line x1={-hw} x2={hw} y1={-h * 0.5} y2={-h * 0.5} />
          <line x1={-hw + 3} x2={-hw + 3} y1={-h} y2={0} />
          <line x1={hw - 3} x2={hw - 3} y1={-h} y2={0} />
        </g>
      )}
      {winXs.map((x) =>
        Math.abs(x) < doorW ? null : (
          <rect class="sc-window" x={x - 4} y={-h * 0.72} width="8" height="9" rx="1" fill="var(--sc-window)" />
        ),
      )}
      {p.door !== false && <path d={`M${-doorW / 2} 0 V${-h * 0.55} a${doorW / 2} ${doorW / 2.4} 0 0 1 ${doorW} 0 V0 Z`} fill="var(--sc-door)" />}
      <path d={`M${hw + 6} ${-h} L${hw + 6 + D} ${-h - D * 0.6} L${hw - inset + D} ${-h - roofH - D * 0.6} L${hw - inset} ${-h - roofH} Z`} fill={roofSide} />
      <path d={`M${-hw - 6} ${-h} L${hw + 6} ${-h} L${hw - inset} ${-h - roofH} L${-hw + inset} ${-h - roofH} Z`} fill={roof} />
      <path d={`M${-hw - 6} ${-h} L${hw + 6} ${-h}`} stroke="var(--sc-outline)" stroke-width="1.2" opacity=".35" />
    </g>
  );
}

function Tower(p: { x: number; h: number; w?: number; stone?: boolean; banner?: string }): JSX.Element {
  const w = p.w ?? 26;
  return (
    <g transform={`translate(${p.x} 0)`}>
      <rect x={-w / 2} y={-p.h} width={w} height={p.h} fill={p.stone ? 'var(--sc-stone)' : 'var(--sc-timber)'} />
      <rect x={w / 2} y={-p.h - D * 0.3} width={D * 0.5} height={p.h} fill={p.stone ? 'var(--sc-stone-dark)' : 'var(--sc-timber-dark)'} transform={`skewY(-30)`} opacity="0" />
      <rect class="sc-window" x={-3} y={-p.h * 0.7} width="6" height="9" rx="3" fill="var(--sc-window)" />
      <path d={`M${-w / 2 - 4} ${-p.h} L0 ${-p.h - w * 1.1} L${w / 2 + 4} ${-p.h} Z`} fill="var(--sc-tile)" />
      {p.banner && (
        <g transform={`translate(0 ${-p.h - w * 1.1})`}>
          <line x1="0" y1="0" x2="0" y2="-16" stroke="var(--sc-outline)" stroke-width="1.5" />
          <path class="sc-flag" d="M0 -16 h13 l-4 4 4 4 h-13 Z" fill={p.banner} />
        </g>
      )}
    </g>
  );
}

function Tree({ x, y, s = 1, kind = 0 }: { x: number; y: number; s?: number; kind?: number }): JSX.Element {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="2" rx="11" ry="4" fill="var(--sc-shadow)" />
      <rect x="-2" y="-10" width="4" height="12" fill="var(--sc-timber-dark)" />
      {kind === 0 ? (
        <>
          <path d="M0 -44 L14 -16 L-14 -16 Z" fill="var(--sc-tree-dark)" />
          <path d="M0 -34 L16 -6 L-16 -6 Z" fill="var(--sc-tree)" />
        </>
      ) : (
        <>
          <circle cx="0" cy="-20" r="14" fill="var(--sc-tree)" />
          <circle cx="-6" cy="-26" r="8" fill="var(--sc-tree-light)" opacity=".6" />
        </>
      )}
    </g>
  );
}

function Scaffold({ w, h }: { w: number; h: number }): JSX.Element {
  return (
    <g class="sc-scaffold" stroke="var(--sc-scaffold)" stroke-width="2" fill="none">
      <rect x={-w / 2 - 4} y={-h - 8} width={w + 8} height={h + 8} />
      <path d={`M${-w / 2 - 4} ${-h - 8} L${w / 2 + 4} 0 M${w / 2 + 4} ${-h - 8} L${-w / 2 - 4} 0`} />
      <line x1={-w / 2 - 4} x2={w / 2 + 4} y1={-h / 2 - 4} y2={-h / 2 - 4} />
    </g>
  );
}

function Plot({ w = 70, h = 34, id }: { w?: number; h?: number; id?: BuildingId }): JSX.Element {
  const s = Math.min(22, h - 8);
  return (
    <g class="sc-plot">
      <rect x={-w / 2} y={-h} width={w} height={h} rx="6" fill="var(--sc-plot)" stroke="var(--sc-plot-line)" stroke-width="1.6" stroke-dasharray="5 4" />
      {id ? (
        <g transform={`translate(${-s / 2} ${-h / 2 - s / 2})`} class="sc-plot-icon">
          <Icon name={`b_${id}`} size={s} />
        </g>
      ) : (
        <path d={`M-6 ${-h / 2} h12 M0 ${-h / 2 - 6} v12`} stroke="var(--sc-plot-line)" stroke-width="2.2" stroke-linecap="round" />
      )}
    </g>
  );
}

// ---------- buildings ----------

function Main({ l, color }: { l: number; color: string }) {
  if (l < 5) return <g><Hall w={104} h={32} roofH={30} windows={2} /><g transform="translate(40 -62)"><line x1="0" y1="0" x2="0" y2="-18" stroke="var(--sc-outline)" stroke-width="1.5" /><path class="sc-flag" d="M0 -18 h12 l-3 4 3 4 h-12Z" fill={color} /></g></g>;
  if (l < 15) return (
    <g>
      <Hall w={130} h={42} roofH={34} windows={4} roof="var(--sc-tile)" roofSide="var(--sc-tile-dark)" />
      <g transform="translate(-72 0)"><Tower x={0} h={70} w={26} banner={color} /></g>
    </g>
  );
  return (
    <g>
      <g transform="translate(-86 0)"><Tower x={0} h={92} w={30} stone banner={color} /></g>
      <g transform="translate(86 0)"><Tower x={0} h={92} w={30} stone banner={color} /></g>
      <Hall w={150} h={54} roofH={40} windows={5} stone roof="var(--sc-tile)" roofSide="var(--sc-tile-dark)" doorW={22} />
      {l >= 25 && <path d="M-52 -54 h104" stroke="var(--accent)" stroke-width="3" />}
      <g transform="translate(0 -104)"><line x1="0" y1="0" x2="0" y2="-22" stroke="var(--sc-outline)" stroke-width="2" /><path class="sc-flag" d="M0 -22 h18 l-5 5 5 5 h-18Z" fill={color} /></g>
    </g>
  );
}

function Barracks({ l }: { l: number }) {
  const big = l >= 10;
  return (
    <g>
      <Hall w={big ? 110 : 92} h={big ? 34 : 28} roofH={24} windows={3} stone={l >= 20} roof={l >= 20 ? 'var(--sc-tile)' : undefined} roofSide={l >= 20 ? 'var(--sc-tile-dark)' : undefined} />
      <g transform="translate(-72 0)" stroke="var(--sc-timber-dark)" stroke-width="2">
        <line x1="-8" y1="0" x2="-8" y2="-30" /><line x1="8" y1="0" x2="8" y2="-30" /><line x1="-12" y1="-22" x2="12" y2="-22" />
        {[-6, -2, 2, 6].map((x) => <line x1={x} y1="-20" x2={x} y2="-42" stroke="var(--sc-iron)" stroke-width="1.4" />)}
      </g>
      {big && (
        <g transform="translate(70 4)">
          <line x1="0" y1="0" x2="0" y2="-26" stroke="var(--sc-timber-dark)" stroke-width="3" />
          <circle cx="0" cy="-30" r="6" fill="var(--sc-thatch)" />
          <line x1="-10" y1="-20" x2="10" y2="-20" stroke="var(--sc-thatch-dark)" stroke-width="3" />
        </g>
      )}
    </g>
  );
}

function Stable({ l }: { l: number }) {
  return (
    <g>
      <g stroke="var(--sc-timber)" stroke-width="2.2" fill="none">
        <path d="M-90 10 H-40 M-90 0 H-40 M-90 10 V-8 M-65 10 V-8 M-40 10 V-8" />
      </g>
      <Hall w={l >= 10 ? 116 : 96} h={26} roofH={22} windows={0} door={false} />
      {[-30, 0, 30].slice(0, l >= 10 ? 3 : 2).map((x) => (
        <rect x={x - 9} y={-22} width="18" height="22" fill="var(--sc-door)" rx="2" />
      ))}
      <path transform="translate(-72 -6) scale(.9)" d="M-6 8 -4.5 1.8C-6.2.2-6 -3 -3.6 -4.6L-3 -7-1.5 -5.1C1.8 -5.2 4.6 -2.7 5.5.5L4.1 2.2 1.6.7.2 2.4 0 8Z" fill="var(--sc-horse)" />
      {l >= 5 && <path transform="translate(-50 -4) scale(-.8 .8)" d="M-6 8 -4.5 1.8C-6.2.2-6 -3 -3.6 -4.6L-3 -7-1.5 -5.1C1.8 -5.2 4.6 -2.7 5.5.5L4.1 2.2 1.6.7.2 2.4 0 8Z" fill="var(--sc-horse-2)" />}
    </g>
  );
}

function Workshop({ l }: { l: number }) {
  return (
    <g>
      <Hall w={88} h={30} roofH={20} windows={0} door={false} />
      <rect x="-30" y="-24" width="60" height="24" fill="var(--sc-door)" />
      <g transform="translate(64 0)" fill="var(--sc-timber-dark)">
        <rect x="-18" y="-8" width="36" height="6" />
        <circle cx="-11" cy="0" r="5" fill="var(--sc-timber)" stroke="var(--sc-timber-dark)" />
        <circle cx="11" cy="0" r="5" fill="var(--sc-timber)" stroke="var(--sc-timber-dark)" />
        <path d="M-6 -8 L14 -34 L17 -32 L-2 -7 Z" />
        <circle cx="15.5" cy="-35" r="4" fill="var(--sc-stone-dark)" />
      </g>
      {l >= 8 && (
        <g transform="translate(-66 0)" fill="var(--sc-timber-dark)">
          <rect x="-16" y="-10" width="32" height="7" rx="2" />
          <circle cx="-9" cy="0" r="4.5" fill="var(--sc-timber)" stroke="var(--sc-timber-dark)" />
          <circle cx="9" cy="0" r="4.5" fill="var(--sc-timber)" stroke="var(--sc-timber-dark)" />
          <path d="M16 -12 l7 5.5 -7 5.5Z" fill="var(--sc-iron)" />
        </g>
      )}
    </g>
  );
}

function Academy() {
  return (
    <g>
      <Hall w={96} h={46} roofH={0} windows={0} stone />
      {[-30, -10, 10, 30].map((x) => <rect x={x - 3} y={-44} width="6" height="40" fill="var(--sc-stone-light)" />)}
      <path d="M-40 -46 a40 34 0 0 1 80 0 Z" fill="var(--sc-dome)" />
      <path d="M-40 -46 a40 34 0 0 1 20 -26" stroke="var(--sc-stone-light)" stroke-width="3" fill="none" opacity=".5" />
      <line x1="0" y1="-80" x2="0" y2="-96" stroke="var(--sc-outline)" stroke-width="2" />
      <circle cx="0" cy="-98" r="3.5" fill="var(--accent)" />
    </g>
  );
}

function Smithy({ l }: { l: number }) {
  return (
    <g>
      <g transform="translate(34 -30)">
        <rect x="-8" y="-40" width="16" height="44" fill="var(--sc-stone-dark)" />
        <g class="sc-smoke" fill="var(--sc-smoke)">
          <circle cx="0" cy="-48" r="6" /><circle cx="5" cy="-60" r="8" /><circle cx="-2" cy="-75" r="10" />
        </g>
      </g>
      <Hall w={86} h={32} roofH={20} windows={1} stone roof="var(--sc-slate)" roofSide="var(--sc-slate-dark)" />
      <rect class="sc-forge" x="-30" y="-20" width="18" height="12" rx="2" fill="var(--sc-forge)" />
      <g transform="translate(-58 0)" fill="var(--sc-iron)">
        <path d="M-12 -12 h16 c5 0 8 2 9 5 h-8 l-2 3 h-8 c-4 0-6-3-7-8Z" />
        <rect x="-6" y="-4" width="8" height="4" />
      </g>
      {l >= 10 && <g transform="translate(-58 -30)" fill="var(--sc-iron)"><rect x="-1" y="0" width="2" height="12" /></g>}
    </g>
  );
}

function Rally({ color }: { color: string }) {
  return (
    <g>
      <ellipse cx="0" cy="2" rx="46" ry="12" fill="var(--sc-dirt)" />
      <line x1="-20" y1="0" x2="-20" y2="-62" stroke="var(--sc-timber-dark)" stroke-width="3" />
      <path class="sc-flag" d="M-20 -62 h30 l-7 8 7 8 h-30 Z" fill={color} />
      <g transform="translate(16 -2)">
        <path d="M-10 4 L10 -2 M-10 -2 L10 4" stroke="var(--sc-timber-dark)" stroke-width="3" />
        <path class="sc-fire" d="M0 -18 C6 -10 8 -4 0 2 C-8 -4 -6 -10 0 -18 Z" fill="var(--sc-fire)" />
        <path class="sc-fire" d="M0 -10 C3 -6 4 -3 0 1 C-4 -3 -3 -6 0 -10 Z" fill="var(--sc-fire-core)" />
      </g>
    </g>
  );
}

function Statue() {
  return (
    <g>
      <ellipse cx="0" cy="2" rx="22" ry="6" fill="var(--sc-shadow)" />
      <rect x="-16" y="-14" width="32" height="14" fill="var(--sc-stone)" />
      <rect x="-12" y="-18" width="24" height="4" fill="var(--sc-stone-light)" />
      <g fill="var(--sc-bronze)">
        <circle cx="0" cy="-46" r="5" />
        <path d="M-7 -40 h14 l2 18 h-18Z" />
        <line x1="10" y1="-54" x2="10" y2="-20" stroke="var(--sc-bronze)" stroke-width="2.5" />
      </g>
    </g>
  );
}

function Market({ l }: { l: number }) {
  const stalls = l >= 15 ? 3 : l >= 5 ? 2 : 1;
  const colors = ['var(--sc-awning-1)', 'var(--sc-awning-2)', 'var(--sc-awning-3)'];
  return (
    <g>
      {Array.from({ length: stalls }, (_, i) => {
        const x = (i - (stalls - 1) / 2) * 44;
        return (
          <g transform={`translate(${x} 0)`}>
            <rect x="-17" y="-16" width="34" height="16" fill="var(--sc-timber)" />
            <line x1="-17" y1="-16" x2="-17" y2="-34" stroke="var(--sc-timber-dark)" stroke-width="2" />
            <line x1="17" y1="-16" x2="17" y2="-34" stroke="var(--sc-timber-dark)" stroke-width="2" />
            <path d="M-21 -32 h42 l-4 10 h-34Z" fill={colors[i]} />
            <path d="M-12 -32 l-2 10 M0 -32 v10 M12 -32 l2 10" stroke="var(--sc-awning-stripe)" stroke-width="3" />
            <circle cx="-8" cy="-19" r="3" fill="var(--sc-fruit)" /><circle cx="0" cy="-19" r="3" fill="var(--sc-fruit-2)" /><circle cx="8" cy="-19" r="3" fill="var(--sc-fruit)" />
          </g>
        );
      })}
    </g>
  );
}

function Warehouse({ l }: { l: number }) {
  return (
    <g>
      {l >= 15 && <g transform="translate(-62 0) scale(.8)"><Hall w={80} h={36} roofH={24} windows={0} /></g>}
      <Hall w={l >= 8 ? 104 : 86} h={l >= 8 ? 40 : 32} roofH={26} windows={0} door={false} roof={l >= 20 ? 'var(--sc-tile)' : undefined} roofSide={l >= 20 ? 'var(--sc-tile-dark)' : undefined} />
      <rect x="-16" y="-28" width="32" height="28" fill="var(--sc-door)" />
      <path d="M-16 -28 L16 0 M16 -28 L-16 0" stroke="var(--sc-timber)" stroke-width="2" />
      <g transform="translate(58 0)">
        <rect x="-10" y="-14" width="14" height="14" fill="var(--sc-crate)" stroke="var(--sc-timber-dark)" />
        <rect x="4" y="-10" width="10" height="10" fill="var(--sc-crate)" stroke="var(--sc-timber-dark)" />
        <rect x="-6" y="-24" width="11" height="10" fill="var(--sc-crate)" stroke="var(--sc-timber-dark)" />
      </g>
    </g>
  );
}

function Hiding({ l }: { l: number }) {
  return (
    <g>
      <ellipse cx="0" cy="0" rx="22" ry="8" fill="var(--sc-dirt)" />
      <rect x="-12" y="-6" width="24" height="10" rx="2" fill="var(--sc-timber)" stroke="var(--sc-timber-dark)" transform="skewX(-12)" />
      <circle cx="3" cy="-1" r="1.6" fill="var(--sc-iron)" />
      {l >= 5 && <circle cx="-22" cy="-2" r="5" fill="var(--sc-stone)" />}
      {l >= 8 && <circle cx="20" cy="2" r="4" fill="var(--sc-stone-dark)" />}
    </g>
  );
}

function Watchtower({ l }: { l: number }) {
  const h = 60 + Math.min(20, l) * 3;
  return (
    <g>
      <g stroke="var(--sc-timber-dark)" stroke-width="3">
        <line x1="-14" y1="0" x2="-8" y2={-h} /><line x1="14" y1="0" x2="8" y2={-h} />
        <line x1="-12" y1={-h * 0.33} x2="12" y2={-h * 0.6} stroke-width="2" /><line x1="12" y1={-h * 0.33} x2="-12" y2={-h * 0.6} stroke-width="2" />
      </g>
      <rect x="-16" y={-h - 16} width="32" height="16" fill="var(--sc-timber)" />
      <rect class="sc-window" x="-4" y={-h - 12} width="8" height="7" fill="var(--sc-window)" />
      <path d={`M-20 ${-h - 16} L0 ${-h - 36} L20 ${-h - 16} Z`} fill="var(--sc-thatch)" />
    </g>
  );
}

function TimberCamp({ l }: { l: number }) {
  const trees: [number, number, number][] = [[-70, -40, 0], [-40, -62, 1], [-10, -70, 0], [30, -60, 0], [60, -44, 1], [-86, 0, 1], [74, -10, 0], [-60, 26, 0]];
  const cleared = Math.min(4, Math.floor(l / 8));
  return (
    <g>
      {trees.slice(cleared).map(([x, y, k]) => <Tree x={x} y={y} kind={k} s={0.95} />)}
      {l > 0 && (
        <g>
          <g transform="translate(-6 10)">
            {Array.from({ length: Math.min(6, 1 + Math.floor(l / 5)) }, (_, i) => (
              <g transform={`translate(${(i % 3) * 13 - 13} ${-Math.floor(i / 3) * 9})`}>
                <rect x="-6" y="-4" width="14" height="8" rx="4" fill="var(--c-wood)" />
                <circle cx="7" cy="0" r="4" fill="var(--c-wood-end)" stroke="var(--c-wood)" />
              </g>
            ))}
          </g>
          <g transform="translate(34 12)">
            <ellipse cx="0" cy="0" rx="9" ry="4" fill="var(--c-wood-end)" stroke="var(--c-wood)" />
            <line x1="2" y1="-2" x2="10" y2="-14" stroke="var(--sc-timber-dark)" stroke-width="2" />
            <path d="M8 -16 l6 2 -3 4Z" fill="var(--sc-iron)" />
          </g>
          {l >= 10 && <g transform="translate(-40 34) scale(.55)"><Hall w={70} h={26} roofH={20} windows={1} /></g>}
        </g>
      )}
    </g>
  );
}

function ClayPit({ l }: { l: number }) {
  const bricks = Math.min(9, Math.ceil(l / 3));
  return (
    <g>
      <path d="M-70 0 C-66 -30 -20 -40 10 -32 C44 -24 70 -10 62 8 C40 26 -40 28 -70 0 Z" fill="var(--sc-clay-bank)" />
      {l > 0 && <path d="M-50 0 C-44 -18 -10 -24 14 -18 C36 -12 44 0 36 10 C16 20 -30 18 -50 0 Z" fill="var(--sc-clay-pit)" />}
      {l > 0 && <path d="M-20 -6 c10 -4 22 -2 30 4" stroke="var(--sc-clay-dark)" stroke-width="2" fill="none" opacity=".5" />}
      <g transform="translate(68 22)">
        {Array.from({ length: bricks }, (_, i) => (
          <rect x={(i % 3) * 11 - 16} y={-Math.floor(i / 3) * 6 - 6} width="10" height="5" fill="var(--c-clay)" stroke="var(--c-clay-dark)" stroke-width=".6" />
        ))}
      </g>
      {l >= 12 && <g transform="translate(-72 30) scale(.5)"><Hall w={70} h={26} roofH={20} windows={1} /></g>}
    </g>
  );
}

function IronMine({ l }: { l: number }) {
  return (
    <g>
      <path d="M-80 10 L-50 -50 L-20 -30 L10 -76 L50 -30 L70 -46 L96 10 Z" fill="var(--sc-rock)" />
      <path d="M-50 -50 L-40 -20 L-20 -30 M10 -76 L16 -40 L50 -30" stroke="var(--sc-rock-dark)" stroke-width="3" fill="none" />
      {l > 0 && (
        <g>
          <path d="M-14 10 V-12 a14 14 0 0 1 28 0 V10 Z" fill="var(--sc-mine)" />
          <path d="M-17 10 V-12 a17 17 0 0 1 34 0 V10" stroke="var(--sc-timber)" stroke-width="4" fill="none" />
          <path d="M-12 16 L40 16 M-12 22 L40 22" stroke="var(--sc-iron)" stroke-width="1.6" />
          <g transform="translate(30 14)">
            <path d="M-10 -12 h20 l-3 10 h-14Z" fill="var(--sc-timber-dark)" />
            <circle cx="-6" cy="0" r="2.5" fill="var(--sc-iron)" /><circle cx="6" cy="0" r="2.5" fill="var(--sc-iron)" />
            <path d="M-7 -12 l4 -4 4 3 4 -3 3 4Z" fill="var(--c-iron)" />
          </g>
          {l >= 10 && <circle class="sc-lamp" cx="-22" cy="-16" r="3" fill="var(--sc-fire)" />}
        </g>
      )}
    </g>
  );
}

function Farm({ l }: { l: number }) {
  const strips = Math.min(8, 2 + Math.floor(l / 4));
  return (
    <g>
      <g transform="skewX(-20)">
        {Array.from({ length: strips }, (_, i) => (
          <rect x={-70 + (i % 4) * 36} y={-58 + Math.floor(i / 4) * 34} width="32" height="30" rx="2" fill={i % 2 ? 'var(--sc-field)' : 'var(--sc-field-2)'} />
        ))}
      </g>
      <g transform="translate(-86 16) scale(.6)"><Hall w={80} h={30} roofH={24} windows={1} /></g>
      <g transform="translate(76 18)">
        <path d="M-10 0 a10 12 0 0 1 20 0Z" fill="var(--sc-thatch)" />
        {l >= 10 && <path d="M8 4 a8 10 0 0 1 16 0Z" fill="var(--sc-thatch-dark)" />}
      </g>
    </g>
  );
}

function wallParts(l: number): { back: JSX.Element; front: JSX.Element } | null {
  if (l <= 0) return null;
  const cx = 480, cy = 330, rx = 318, ry = 206;
  const stone = l >= 10;
  const n = 72;
  const h = 8 + Math.min(20, l) * 0.9;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, a] as const;
  }).filter(([, , a]) => !(a > 1.4 && a < 1.74)); // gate at the bottom
  const back = pts.filter(([, y]) => y < cy);
  const front = pts.filter(([, y]) => y >= cy);
  const seg = ([x, y]: readonly [number, number, number]) =>
    stone ? (
      <rect x={x - 6} y={y - h} width="12.5" height={h} fill="var(--sc-stone)" stroke="var(--sc-stone-dark)" stroke-width=".8" />
    ) : (
      <path d={`M${x - 3.5} ${y} V${y - h + 3} L${x} ${y - h - 2} L${x + 3.5} ${y - h + 3} V${y} Z`} fill="var(--sc-palisade)" stroke="var(--sc-timber-dark)" stroke-width=".6" />
    );
  const towers = stone ? [0, Math.PI * 0.5 - 0.35, Math.PI * 0.5 + 0.35, Math.PI, Math.PI * 1.5].map((a) => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as const) : [];
  return {
    back: <g class="sc-wall">{back.map(seg)}</g>,
    front: (
      <g class="sc-wall">
        {front.map(seg)}
        {towers.map(([x, y]) => (
          <g transform={`translate(${x} ${y})`}>
            <rect x="-11" y={-h - 16} width="22" height={h + 16} fill="var(--sc-stone)" stroke="var(--sc-stone-dark)" />
            <path d={`M-13 ${-h - 16} h26 v-5 h-5 v3 h-5 v-3 h-6 v3 h-5 v-3 h-5 Z`} fill="var(--sc-stone-light)" />
          </g>
        ))}
      </g>
    ),
  };
}

const SIZE: Partial<Record<BuildingId, [number, number]>> = {
  main: [130, 70], barracks: [100, 50], stable: [110, 40], workshop: [100, 40], academy: [96, 80], smithy: [90, 50],
  rally: [70, 60], statue: [40, 50], market: [100, 40], warehouse: [100, 50], hiding: [44, 16], watchtower: [36, 110],
  timber: [150, 90], claypit: [130, 60], ironmine: [160, 90], farm: [170, 80],
};

/** where each building's level badge sits, relative to its anchor */
const BADGE: Partial<Record<BuildingId, [number, number]>> = {
  main: [72, -14], barracks: [58, -8], stable: [64, -6], workshop: [56, -6], academy: [54, -8], smithy: [52, -6],
  rally: [40, -6], statue: [24, -4], market: [54, -4], warehouse: [60, -6], hiding: [28, 2], watchtower: [24, -6],
  timber: [74, 12], claypit: [66, 16], ironmine: [80, 4], farm: [86, 16],
};

const HIT: Partial<Record<BuildingId, [number, number, number, number]>> = {
  main: [-100, -140, 200, 150], barracks: [-100, -80, 200, 90], stable: [-100, -60, 170, 70], workshop: [-90, -60, 180, 66],
  academy: [-60, -110, 120, 116], smithy: [-80, -110, 160, 116], rally: [-50, -70, 100, 80], statue: [-26, -64, 52, 70],
  market: [-70, -44, 140, 50], warehouse: [-80, -76, 170, 82], hiding: [-30, -14, 60, 26], watchtower: [-24, -140, 48, 146],
  timber: [-100, -110, 190, 150], claypit: [-80, -46, 170, 80], ironmine: [-86, -82, 186, 110], farm: [-100, -74, 200, 110],
};

export function VillageScene({ buildings: b, building = {}, onPick, showLevels = true, color = 'var(--accent)' }: Props) {
  const [hover, setHover] = useState<BuildingId | null>(null);
  const wall = wallParts(b.wall);
  const order: BuildingId[] = ['academy', 'smithy', 'barracks', 'watchtower', 'main', 'stable', 'statue', 'market', 'hiding', 'rally', 'workshop', 'warehouse'];
  const outside: BuildingId[] = ['timber', 'ironmine', 'claypit', 'farm'];

  const render = (id: BuildingId) => {
    const l = b[id];
    const [x, y] = POS[id];
    const upgrading = building[id] !== undefined;
    let art: JSX.Element | null = null;
    if (l <= 0 && !['timber', 'claypit', 'ironmine', 'farm'].includes(id)) {
      const [w, h] = SIZE[id] ?? [70, 34];
      art = <Plot w={Math.min(90, w * 0.7)} h={Math.max(28, Math.min(40, h * 0.55))} id={id} />;
    } else {
      switch (id) {
        case 'main': art = <Main l={l} color={color} />; break;
        case 'barracks': art = <Barracks l={l} />; break;
        case 'stable': art = <Stable l={l} />; break;
        case 'workshop': art = <Workshop l={l} />; break;
        case 'academy': art = <Academy />; break;
        case 'smithy': art = <Smithy l={l} />; break;
        case 'rally': art = <Rally color={color} />; break;
        case 'statue': art = <Statue />; break;
        case 'market': art = <Market l={l} />; break;
        case 'warehouse': art = <Warehouse l={l} />; break;
        case 'hiding': art = <Hiding l={l} />; break;
        case 'watchtower': art = <Watchtower l={l} />; break;
        case 'timber': art = <TimberCamp l={l} />; break;
        case 'claypit': art = <ClayPit l={l} />; break;
        case 'ironmine': art = <IronMine l={l} />; break;
        case 'farm': art = <Farm l={l} />; break;
      }
    }
    const hit = HIT[id] ?? [-50, -60, 100, 70];
    const size = SIZE[id] ?? [80, 40];
    return (
      <g
        key={id}
        transform={`translate(${x} ${y})`}
        class={`sc-b ${hover === id ? 'is-hover' : ''} ${l <= 0 ? 'is-empty' : ''}`}
        onClick={() => onPick(id)}
        onMouseEnter={() => setHover(id)}
        onMouseLeave={() => setHover((h) => (h === id ? null : h))}
        role="button"
        tabIndex={0}
        aria-label={`${BUILDINGS[id].name}${l > 0 ? ` level ${l}` : ' (not built)'}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(id); } }}
      >
        <rect x={hit[0]} y={hit[1]} width={hit[2]} height={hit[3]} fill="transparent" />
        {art}
        {upgrading && l > 0 && <Scaffold w={Math.min(120, size[0] * 0.8)} h={Math.min(60, size[1] * 0.7)} />}
        {showLevels && (l > 0 || upgrading) && (
          <g class="sc-level" transform={`translate(${(BADGE[id] ?? [40, -8])[0]} ${(BADGE[id] ?? [40, -8])[1]})`}>
            <circle r="11" fill={upgrading ? 'var(--accent)' : 'var(--sc-badge)'} stroke="var(--sc-badge-line)" stroke-width="1.2" />
            <text y="4" text-anchor="middle">{l}</text>
          </g>
        )}
        {hover === id && (
          <g class="sc-tip" transform={`translate(0 ${hit[1] - 8})`} pointer-events="none">
            <rect x={-70} y={-24} width="140" height="22" rx="5" />
            <text y="-9" text-anchor="middle">{BUILDINGS[id].name}{l > 0 ? ` · ${l}` : ''}</text>
          </g>
        )}
      </g>
    );
  };

  return (
    <svg class="scene" viewBox="0 0 960 600" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Your village">
      <defs>
        <radialGradient id="sc-ground" cx="50%" cy="52%" r="65%">
          <stop offset="0%" stop-color="var(--sc-grass-light)" />
          <stop offset="100%" stop-color="var(--sc-grass)" />
        </radialGradient>
      </defs>
      <rect width="960" height="600" fill="url(#sc-ground)" />
      {/* stream */}
      <path d="M0 330 C60 320 90 360 150 350 S250 400 230 470 S180 560 220 600 L190 600 C150 560 200 480 210 440 S140 380 0 360 Z" fill="var(--sc-water)" opacity=".85" />
      {/* grass tufts */}
      <g fill="var(--sc-grass-dark)" opacity=".5">
        {[[260, 120], [700, 110], [900, 330], [60, 260], [930, 60], [40, 70], [360, 570], [620, 580], [770, 575], [240, 560]].map(([x, y]) => (
          <path d={`M${x} ${y} l3 -9 l2 9 l3 -7 l2 7Z`} />
        ))}
      </g>
      {/* roads */}
      <g fill="none" stroke="var(--sc-dirt)" stroke-linecap="round" stroke-linejoin="round">
        <path d="M480 600 C480 540 484 470 486 330" stroke-width="26" />
        <path d="M486 360 C420 350 360 300 318 250 M486 360 C560 350 610 300 645 244 M486 380 C420 390 330 390 285 376 M486 390 C560 390 640 380 676 374 M486 430 C440 450 400 460 372 470 M486 430 C540 450 580 470 598 474" stroke-width="12" opacity=".9" />
        <path d="M150 190 C230 230 300 250 318 250 M820 190 C760 230 700 240 645 240 M150 480 C220 470 250 420 285 380 M810 480 C760 440 720 400 676 376" stroke-width="9" opacity=".7" />
      </g>
      {/* forest backdrop */}
      <g>
        {[[40, 60, 0], [80, 40, 1], [180, 70, 0], [210, 110, 1], [20, 140, 0], [30, 220, 1], [240, 50, 0]].map(([x, y, k]) => <Tree x={x} y={y} kind={k} s={0.9} />)}
        {[[910, 260, 1], [940, 300, 0], [900, 380, 0], [930, 420, 1], [620, 40, 0], [680, 30, 1], [300, 40, 1], [360, 30, 0]].map(([x, y, k]) => <Tree x={x} y={y} kind={k} s={0.8} />)}
      </g>
      {wall?.back}
      {outside.map(render)}
      {order.map(render)}
      {wall?.front}
      <g
        class={`sc-b ${hover === 'wall' ? 'is-hover' : ''}`}
        transform="translate(480 560)"
        onClick={() => onPick('wall')}
        onMouseEnter={() => setHover('wall')}
        onMouseLeave={() => setHover((h) => (h === 'wall' ? null : h))}
        role="button"
        tabIndex={0}
        aria-label={`Wall${b.wall > 0 ? ` level ${b.wall}` : ' (not built)'}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick('wall'); } }}
      >
        <rect x="-60" y="-30" width="120" height="36" fill="transparent" />
        {b.wall > 0 ? (
          <g>
            <rect x="-22" y="-26" width="8" height="30" fill={b.wall >= 10 ? 'var(--sc-stone)' : 'var(--sc-palisade)'} />
            <rect x="14" y="-26" width="8" height="30" fill={b.wall >= 10 ? 'var(--sc-stone)' : 'var(--sc-palisade)'} />
            <path d="M-26 -26 h52 v-6 h-52Z" fill={b.wall >= 10 ? 'var(--sc-stone-light)' : 'var(--sc-timber-dark)'} />
          </g>
        ) : (
          <g transform="translate(0 -2)"><Plot w={70} h={28} id="wall" /></g>
        )}
        {showLevels && (b.wall > 0 || building.wall !== undefined) && (
          <g class="sc-level" transform="translate(40 -18)">
            <circle r="11" fill={building.wall !== undefined ? 'var(--accent)' : 'var(--sc-badge)'} stroke="var(--sc-badge-line)" stroke-width="1.2" />
            <text y="4" text-anchor="middle">{b.wall}</text>
          </g>
        )}
        {hover === 'wall' && (
          <g class="sc-tip" transform="translate(0 -40)" pointer-events="none">
            <rect x={-70} y={-24} width="140" height="22" rx="5" />
            <text y="-9" text-anchor="middle">Wall{b.wall > 0 ? ` · ${b.wall}` : ''}</text>
          </g>
        )}
      </g>
    </svg>
  );
}
