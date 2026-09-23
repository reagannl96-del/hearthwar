// Hand-drawn SVG icons for resources, units and buildings.

import type { JSX } from 'preact';
import type { BuildingId, UnitId } from '../../engine/types';

type IconName = 'wood' | 'clay' | 'iron' | 'pop' | 'storage' | 'time' | 'points' | 'loyalty' | 'coin' | 'merchant' | 'hide'
  | UnitId | `b_${BuildingId}`
  | 'attack' | 'support' | 'return' | 'report' | 'map' | 'village' | 'quest' | 'rank' | 'settings' | 'overview' | 'pause' | 'play' | 'ff' | 'bell' | 'close' | 'star' | 'shield' | 'trade' | 'news' | 'prev' | 'next' | 'flag';

const S = (props: { children: preact.ComponentChildren; size: number; class?: string; title?: string }) => (
  <svg viewBox="0 0 24 24" width={props.size} height={props.size} class={`icon ${props.class ?? ''}`} aria-hidden={props.title ? undefined : 'true'} role={props.title ? 'img' : undefined}>
    {props.title && <title>{props.title}</title>}
    {props.children}
  </svg>
);

const horse = 'M5.5 21.5 7.4 13.6C5.3 11.6 5.6 7.4 8.6 5.4L9.3 2.5 11.2 4.9C15.4 4.8 19 8 20.1 12L18.4 14.2 15.2 12.3 13.4 14.4 13.2 21.5Z';

const paths: Record<string, (s: number) => JSX.Element> = {
  wood: () => (
    <>
      <rect x="2.5" y="11.5" width="17" height="6.5" rx="3.2" fill="var(--c-wood)" />
      <circle cx="18.5" cy="14.75" r="3.25" fill="var(--c-wood-end)" stroke="var(--c-wood)" stroke-width="1" />
      <circle cx="18.5" cy="14.75" r="1.1" fill="var(--c-wood)" />
      <rect x="5" y="5" width="14" height="6.5" rx="3.2" fill="var(--c-wood)" />
      <circle cx="18" cy="8.25" r="3.25" fill="var(--c-wood-end)" stroke="var(--c-wood)" stroke-width="1" />
      <circle cx="18" cy="8.25" r="1.1" fill="var(--c-wood)" />
    </>
  ),
  clay: () => (
    <g fill="var(--c-clay)" stroke="var(--c-clay-dark)" stroke-width="0.8">
      <rect x="1.8" y="13.5" width="9.6" height="5.5" rx="1" />
      <rect x="12.6" y="13.5" width="9.6" height="5.5" rx="1" />
      <rect x="7.2" y="7" width="9.6" height="5.5" rx="1" />
    </g>
  ),
  iron: () => (
    <>
      <path d="M3 18 6.8 8.5h10.4L21 18Z" fill="var(--c-iron)" />
      <path d="M6.8 8.5 8.6 12h6.8l1.8-3.5Z" fill="var(--c-iron-light)" />
    </>
  ),
  pop: () => (
    <g fill="var(--c-pop)">
      <circle cx="12" cy="7" r="3.6" />
      <path d="M4.5 20.5c0-4.3 3.3-7.4 7.5-7.4s7.5 3.1 7.5 7.4Z" />
    </g>
  ),
  storage: () => (
    <g fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="3.5" y="5.5" width="17" height="14" rx="1.5" />
      <path d="M3.5 10.5h17M9 5.5v5M15 5.5v5" />
    </g>
  ),
  hide: () => (
    <g fill="currentColor">
      <path d="M12 2.5 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6Z" opacity=".25" />
      <path d="M12 8a3 3 0 0 0-1.2 5.75L10 18h4l-.8-4.25A3 3 0 0 0 12 8Z" />
    </g>
  ),
  time: () => (
    <g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </g>
  ),
  points: () => <path d="m12 2.8 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" fill="var(--accent)" />,
  star: () => <path d="m12 2.8 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" fill="currentColor" />,
  loyalty: () => <path d="M12 21s-8.5-5.2-8.5-11.3C3.5 6.6 5.8 4.5 8.4 4.5c1.6 0 2.9.8 3.6 2 .7-1.2 2-2 3.6-2 2.6 0 4.9 2.1 4.9 5.2C20.5 15.8 12 21 12 21Z" fill="var(--danger)" />,
  coin: () => (
    <>
      <circle cx="12" cy="12" r="9" fill="var(--accent)" />
      <path d="m7.5 14.5 1.2-5.5 2 2.3L12 7.5l1.3 3.8 2-2.3 1.2 5.5Z" fill="var(--accent-ink)" />
    </>
  ),
  merchant: () => (
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
      <path d="M3 16V9h10v7M13 11h4l3 3v2h-7" />
      <circle cx="7" cy="17.5" r="1.8" fill="currentColor" />
      <circle cx="16.5" cy="17.5" r="1.8" fill="currentColor" />
    </g>
  ),
  // ---- units ----
  spear: () => <path d="M12 1.8 14.2 7.4h-1.4v14.8h-1.6V7.4H9.8Z" fill="currentColor" />,
  sword: () => (
    <g fill="currentColor">
      <path d="M12 1.8 13.6 5v10h-3.2V5Z" />
      <rect x="7" y="14.6" width="10" height="2.2" rx="1.1" />
      <rect x="11" y="16.6" width="2" height="4" />
      <circle cx="12" cy="21.4" r="1.4" />
    </g>
  ),
  axe: () => (
    <g fill="currentColor">
      <path d="m5.2 21.8-1.4-1.1L14 5.9l1.4 1.1Z" />
      <path d="M11.9 5.2c2.4-3 6.7-3.3 9.1-.9-.2 2.9-2.4 5.7-5.5 6.1Z" />
    </g>
  ),
  archer: () => (
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <path d="M7 2.5c9 3.5 9 15.5 0 19" />
      <path d="M7 2.5v19" stroke-width="1" />
      <path d="M3 12h17M17 9.5 20 12l-3 2.5" />
    </g>
  ),
  scout: () => (
    <g fill="currentColor">
      <path d="M1.8 12C6.5 5 17.5 5 22.2 12 17.5 19 6.5 19 1.8 12Zm10.2 4.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z" />
      <circle cx="12" cy="12" r="2" />
    </g>
  ),
  light: () => (
    <g fill="currentColor">
      <path d={horse} />
    </g>
  ),
  marcher: () => (
    <g>
      <path d={horse} fill="currentColor" />
      <path d="M17 1.5c4 2 4 7 0 9" fill="none" stroke="currentColor" stroke-width="1.6" />
    </g>
  ),
  heavy: () => (
    <g>
      <path d={horse} fill="currentColor" />
      <path d="M8 9.2c2.6.8 5.6.6 8.4-.6l.8 1.6c-3 1.4-6.4 1.6-9.5.6Z" fill="var(--surface)" />
      <path d="M9.4 2.5 12 .8" stroke="currentColor" stroke-width="1.6" />
    </g>
  ),
  ram: () => (
    <g fill="currentColor">
      <rect x="2" y="9" width="16" height="5" rx="2" />
      <path d="m18 8 4 3.5-4 3.5Z" />
      <circle cx="6" cy="17.5" r="2.5" />
      <circle cx="14" cy="17.5" r="2.5" />
      <path d="M4 9 10 4l6 5Z" opacity=".55" />
    </g>
  ),
  catapult: () => (
    <g fill="currentColor">
      <rect x="2" y="15" width="16" height="3" rx="1" />
      <circle cx="5" cy="19.5" r="2" />
      <circle cx="15" cy="19.5" r="2" />
      <path d="m7.6 15.2 1.4.9 9.4-12.3-1.3-1Z" />
      <circle cx="18.5" cy="3.6" r="2.4" />
      <path d="M11 15 13 10h1l-1 5Z" />
    </g>
  ),
  paladin: () => (
    <g fill="currentColor">
      <path d="M6 21v-9.5C6 7 8.6 4 12 4s6 3 6 7.5V21Z" />
      <rect x="7.5" y="11" width="9" height="1.6" fill="var(--surface)" />
      <path d="M12 4c1.5-2.4 4.5-2.8 6.5-1.8-1.8.2-3.3 1.2-4.2 2.6Z" />
    </g>
  ),
  noble: () => (
    <g fill="currentColor">
      <path d="M3 17.5 4.8 7.2l4.1 4.9L12 5.5l3.1 6.6 4.1-4.9L21 17.5Z" />
      <rect x="3" y="18.5" width="18" height="2.5" rx="1" />
    </g>
  ),
  militia: () => (
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <path d="M12 9v13M7 3v4c0 1.7 2.2 3 5 3s5-1.3 5-3V3M12 3v6" />
    </g>
  ),
  // ---- buildings ----
  b_main: () => (
    <g fill="currentColor">
      <path d="M3 11 12 4l9 7v1.5H3Z" />
      <rect x="5" y="12.5" width="14" height="8" />
      <rect x="10.5" y="15" width="3" height="5.5" fill="var(--surface)" />
      <path d="M12 4V.8h3.5L14 2l1.5 1.2H12.8" />
    </g>
  ),
  b_barracks: () => (
    <g fill="currentColor">
      <path d="M4 20 18.5 5.5l1.2 1.2L5.2 21.2ZM20 20 5.5 5.5 4.3 6.7l14.5 14.5Z" />
      <path d="M12 3 7 5.5v4.8c0 3.4 2.3 5.7 5 6.7 2.7-1 5-3.3 5-6.7V5.5Z" opacity=".35" />
    </g>
  ),
  b_stable: () => <path d="M6.2 3.5h3.2v3.2c0 4.6 1 8.6 2.6 8.6s2.6-4 2.6-8.6V3.5h3.2v3.6c0 7.8-2.5 13.4-5.8 13.4S6.2 14.9 6.2 7.1Z" fill="currentColor" />,
  b_workshop: () => (
    <g fill="currentColor">
      <path d="M13.7 2.3 12 2l-.5 2.6a7.8 7.8 0 0 0-2.4 1L7 4.1 4.6 6.5l1.6 2.2a7.8 7.8 0 0 0-1 2.4L2.6 11.6v3.4l2.6.5c.2.9.6 1.7 1 2.4l-1.5 2.2 2.4 2.4 2.2-1.5c.7.5 1.5.8 2.4 1l.5 2.6h3.4l.5-2.6a7.8 7.8 0 0 0 2.4-1l2.2 1.5 2.4-2.4-1.5-2.2c.5-.7.8-1.5 1-2.4l2.6-.5v-3.4l-2.6-.5a7.8 7.8 0 0 0-1-2.4l1.5-2.2-2.4-2.4-2.2 1.5a7.8 7.8 0 0 0-2.4-1Z" transform="scale(.82) translate(2.6 2.4)" />
      <circle cx="12" cy="12" r="3" fill="var(--surface)" />
    </g>
  ),
  b_academy: () => (
    <g fill="currentColor">
      <path d="M4 11a8 8 0 0 1 16 0Z" />
      <rect x="4" y="11.5" width="16" height="9" />
      <rect x="7" y="14" width="2" height="6.5" fill="var(--surface)" />
      <rect x="11" y="14" width="2" height="6.5" fill="var(--surface)" />
      <rect x="15" y="14" width="2" height="6.5" fill="var(--surface)" />
      <path d="M12 3V.5" stroke="currentColor" stroke-width="1.4" />
    </g>
  ),
  b_smithy: () => (
    <g fill="currentColor">
      <path d="M2.5 7.5h13c3 0 5.5 1.3 6 3.5H16l-1.5 2.5H9.5C6.5 13.5 3.8 11 2.5 7.5Z" />
      <path d="M9 13.5h6.5V16H18v2.5H6.5V16H9Z" />
    </g>
  ),
  b_rally: () => (
    <g fill="currentColor">
      <rect x="5" y="2" width="1.8" height="20" rx=".9" />
      <path d="M6.8 3h12l-3 4 3 4h-12Z" />
    </g>
  ),
  b_statue: () => (
    <g fill="currentColor">
      <circle cx="12" cy="4" r="2.2" />
      <path d="M9 7h6l1 7h-2l-.5 3h-3L10 14H8Z" />
      <rect x="6" y="18" width="12" height="3.5" rx=".6" />
    </g>
  ),
  b_market: () => (
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3v18M7 21h10M4 6h16" />
      <path d="M4 6 1.5 12.5a2.7 2.7 0 0 0 5 0Z M20 6l-2.5 6.5a2.7 2.7 0 0 0 5 0Z" fill="currentColor" />
    </g>
  ),
  b_timber: () => (
    <g fill="currentColor">
      <path d="M12 1.5 5 11h3.5L4 17h7v4.5h2V17h7l-4.5-6H19Z" />
    </g>
  ),
  b_claypit: () => paths.clay(24),
  b_ironmine: () => (
    <g fill="currentColor">
      <path d="M3.5 7.2C7.7 3.4 14 2.6 19.8 5.3l-.7 1.5C15.2 5.3 10.8 5.5 7.3 7.4Z" />
      <path d="m11.2 6.6 2 .1-2.2 15.2-2.1-.3Z" />
    </g>
  ),
  b_farm: () => (
    <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
      <path d="M12 22V6" />
      <path d="M12 8c-2-.3-3.4-1.8-3.6-4 2 .2 3.4 1.7 3.6 4Zm0 0c2-.3 3.4-1.8 3.6-4-2 .2-3.4 1.7-3.6 4Zm0 5c-2-.3-3.4-1.8-3.6-4 2 .2 3.4 1.7 3.6 4Zm0 0c2-.3 3.4-1.8 3.6-4-2 .2-3.4 1.7-3.6 4Zm0 5c-2-.3-3.4-1.8-3.6-4 2 .2 3.4 1.7 3.6 4Zm0 0c2-.3 3.4-1.8 3.6-4-2 .2-3.4 1.7-3.6 4Z" fill="currentColor" />
    </g>
  ),
  b_warehouse: () => (
    <g fill="currentColor">
      <path d="M2 10 12 3l10 7v11H2Z" />
      <path d="M7 21v-8h10v8" fill="var(--surface)" />
      <path d="m7 13 10 8M17 13 7 21" stroke="currentColor" stroke-width="1.2" />
    </g>
  ),
  b_hiding: () => (
    <g fill="currentColor">
      <circle cx="8" cy="12" r="4.6" />
      <circle cx="8" cy="12" r="1.8" fill="var(--surface)" />
      <path d="M12 11h10v2.4h-2v3h-2.2v-3h-1.4v2h-2.2v-2H12Z" />
    </g>
  ),
  b_wall: () => <path d="M2 9h3V6h3v3h2.5V6h3v3H16V6h3v3h3v12H2Z" fill="currentColor" />,
  b_watchtower: () => (
    <g fill="currentColor">
      <path d="M7 2h10v3l-1 1v3H8V6L7 5Z" />
      <path d="M8.5 9h7L17 22H7Z" />
      <rect x="10.5" y="14" width="3" height="4" fill="var(--surface)" />
    </g>
  ),
  // ---- ui ----
  attack: () => (
    <g fill="currentColor">
      <path d="m3 20.2 6.6-6.6 1.2 1.2L4.2 21.4Z" />
      <path d="M21 3 9.7 14.3l-2-2L19 1Z" transform="translate(.5 1)" />
      <path d="m6.2 12.8 5 5-1.2 1.2-5-5Z" />
    </g>
  ),
  support: () => <path d="M12 2.5 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6Z" fill="currentColor" />,
  shield: () => <path d="M12 2.5 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6Z" fill="currentColor" />,
  return: () => <path d="M10 5 3 11l7 6v-4c4.6 0 8 1.2 11 5-1-5.6-4.5-9.5-11-10Z" fill="currentColor" />,
  trade: () => (
    <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 8h14l-3-3M20 16H6l3 3" />
    </g>
  ),
  report: () => (
    <g fill="currentColor">
      <path d="M5 2.5h10l4 4V21a.5.5 0 0 1-.5.5h-13A.5.5 0 0 1 5 21Z" opacity=".3" />
      <path d="M8 10h8v1.6H8Zm0 3.5h8v1.6H8Zm0 3.5h5v1.6H8Z" />
    </g>
  ),
  map: () => (
    <g fill="currentColor">
      <path d="m2.5 5.5 6-2.5 7 2.5 6-2.5V18.5l-6 2.5-7-2.5-6 2.5Z" opacity=".3" />
      <path d="M8.5 3v15.5M15.5 5.5V21" stroke="currentColor" stroke-width="1.6" />
    </g>
  ),
  village: () => (
    <g fill="currentColor">
      <path d="M2 12 8 7l6 5v9H2Z" />
      <path d="M12 9.5 17 5l5 4.5V21h-6v-7h-4Z" opacity=".5" />
    </g>
  ),
  quest: () => (
    <g fill="currentColor">
      <path d="M6 2.5h12v19l-6-4-6 4Z" opacity=".3" />
      <path d="m12 6 1.2 2.5 2.8.4-2 2 .5 2.7L12 12.4l-2.5 1.2.5-2.7-2-2 2.8-.4Z" />
    </g>
  ),
  rank: () => (
    <g fill="currentColor">
      <rect x="3" y="12" width="5" height="9" rx=".8" opacity=".5" />
      <rect x="9.5" y="6" width="5" height="15" rx=".8" />
      <rect x="16" y="9" width="5" height="12" rx=".8" opacity=".7" />
    </g>
  ),
  overview: () => (
    <g fill="currentColor">
      <rect x="3" y="4" width="18" height="3" rx="1" />
      <rect x="3" y="10.5" width="18" height="3" rx="1" opacity=".6" />
      <rect x="3" y="17" width="18" height="3" rx="1" opacity=".35" />
    </g>
  ),
  settings: () => (
    <g fill="currentColor">
      <path d="M10.3 2h3.4l.5 2.6 2 .9 2.2-1.5 2.4 2.4-1.5 2.2.9 2 2.6.5v3.4l-2.6.5-.9 2 1.5 2.2-2.4 2.4-2.2-1.5-2 .9-.5 2.6h-3.4l-.5-2.6-2-.9-2.2 1.5-2.4-2.4 1.5-2.2-.9-2L2 13.7v-3.4l2.6-.5.9-2L4 5.6 6.4 3.2l2.2 1.5 2-.9Z" />
      <circle cx="12" cy="12" r="3.2" fill="var(--surface)" />
    </g>
  ),
  news: () => (
    <g fill="currentColor">
      <path d="M3 5h14v14.5H5A2 2 0 0 1 3 17.5Z" opacity=".3" />
      <path d="M17 8h4v10a1.5 1.5 0 0 1-3 0V8" />
      <path d="M6 8h8v2H6Zm0 4h8v1.6H6Zm0 3.2h5v1.6H6Z" />
    </g>
  ),
  flag: () => (
    <g fill="currentColor">
      <rect x="5" y="2" width="1.8" height="20" rx=".9" />
      <path d="M6.8 3h12l-3 4 3 4h-12Z" />
    </g>
  ),
  pause: () => (
    <g fill="currentColor">
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </g>
  ),
  play: () => <path d="M7 4.5v15l12.5-7.5Z" fill="currentColor" />,
  ff: () => <path d="M3 5v14l9-7Zm9 0v14l9-7Z" fill="currentColor" />,
  bell: () => (
    <g fill="currentColor">
      <path d="M12 3a6 6 0 0 0-6 6v4.5L4 17h16l-2-3.5V9a6 6 0 0 0-6-6Z" />
      <circle cx="12" cy="19.5" r="2" />
    </g>
  ),
  close: () => <path d="m6 4.6 6 6 6-6L19.4 6l-6 6 6 6-1.4 1.4-6-6-6 6L4.6 18l6-6-6-6Z" fill="currentColor" />,
  prev: () => <path d="M15 4 7 12l8 8 1.4-1.4L9.8 12l6.6-6.6Z" fill="currentColor" />,
  next: () => <path d="m9 4 8 8-8 8-1.4-1.4 6.6-6.6-6.6-6.6Z" fill="currentColor" />,
};

export function Icon({ name, size = 18, class: cls, title }: { name: IconName | string; size?: number; class?: string; title?: string }) {
  const p = paths[name];
  if (!p) return null;
  return <S size={size} class={cls} title={title}>{p(size)}</S>;
}

export const unitIcon = (u: UnitId) => u;
export const buildingIcon = (b: BuildingId) => `b_${b}`;
