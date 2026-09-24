// Little icons for a tribe member's rights, drawn in the ink-and-brass style of the
// member table: a crown for the leaders, a figure with a plus for recruiters, a sealed
// scroll for diplomats, a speech bubble with a shield for forum moderators and a key
// for those who may read the internal announcements.

import type { TribeRight } from '../../engine/types';

const INK = '#4a2e14', BRASS = '#d9a441', BRASS_LT = '#f5d27a', RED = '#b3261a', PAPER = '#f3e3bc';

function Glyph({ right, founder }: { right: TribeRight; founder?: boolean }) {
  switch (right) {
    case 'lead':
      return (
        <>
          <path d="M3 17 L4.5 7 L9 11.5 L12 5 L15 11.5 L19.5 7 L21 17 Z" fill={founder ? BRASS_LT : BRASS} stroke={INK} stroke-width="1.4" stroke-linejoin="round" />
          <rect x="3" y="17" width="18" height="3" rx="1" fill={BRASS} stroke={INK} stroke-width="1.4" />
          <circle cx="12" cy="13.5" r="1.6" fill={founder ? RED : '#2c56b0'} stroke={INK} stroke-width="0.8" />
        </>
      );
    case 'invite':
      return (
        <>
          <circle cx="9.5" cy="7.5" r="3.6" fill={PAPER} stroke={INK} stroke-width="1.4" />
          <path d="M2.5 20.5 C3 14.5 6 12.5 9.5 12.5 C13 12.5 16 14.5 16.5 20.5 Z" fill={PAPER} stroke={INK} stroke-width="1.4" stroke-linejoin="round" />
          <circle cx="18" cy="8" r="4.2" fill="#3f8a3a" stroke={INK} stroke-width="1.2" />
          <path d="M18 5.6 V10.4 M15.6 8 H20.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" />
        </>
      );
    case 'diplomacy':
      return (
        <>
          <path d="M5 4.5 H17 V17.5 H5 Z" fill={PAPER} stroke={INK} stroke-width="1.4" />
          <path d="M5 4.5 a2 2 0 0 0 0 4 M17 17.5 a2 2 0 0 0 0 -4" fill="none" stroke={INK} stroke-width="1.2" />
          <path d="M7.5 8 H14.5 M7.5 10.5 H14.5 M7.5 13 H11.5" stroke={INK} stroke-width="1.1" stroke-linecap="round" />
          <circle cx="16.5" cy="18" r="3.4" fill={RED} stroke={INK} stroke-width="1.2" />
          <path d="M14.8 21 L13.8 23 M18.2 21 L19.2 23" stroke={RED} stroke-width="1.6" stroke-linecap="round" />
        </>
      );
    case 'forum':
      return (
        <>
          <path d="M3 4 H18 a2 2 0 0 1 2 2 V13 a2 2 0 0 1 -2 2 H10 L5.5 19 V15 H3 a2 2 0 0 1 -2 -2 V6 a2 2 0 0 1 2 -2 Z" fill={PAPER} stroke={INK} stroke-width="1.4" stroke-linejoin="round" />
          <path d="M16.5 11 L22 12.5 V16.5 C22 19.5 19.5 21.3 16.5 22.5 C13.5 21.3 11 19.5 11 16.5 V12.5 Z" fill="#2c56b0" stroke={INK} stroke-width="1.3" stroke-linejoin="round" />
          <path d="M14 16.5 L15.8 18.3 L19.2 14.8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </>
      );
    case 'internal':
      return (
        <>
          <circle cx="7.5" cy="12" r="4.8" fill={BRASS} stroke={INK} stroke-width="1.4" />
          <circle cx="7.5" cy="12" r="1.8" fill={INK} />
          <path d="M12 11 H21.5 V13 H12 Z" fill={BRASS} stroke={INK} stroke-width="1.2" />
          <path d="M18 13 V16.5 M21 13 V15.5" stroke={INK} stroke-width="1.8" stroke-linecap="round" />
        </>
      );
  }
}

/** One right's icon: lit when the member holds it, a faint ghost when not. */
export function RightIcon({ right, on = true, founder, size = 20, title }: { right: TribeRight; on?: boolean; founder?: boolean; size?: number; title?: string }) {
  return (
    <svg class={`right-icon ${on ? 'is-on' : 'is-off'}`} viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={title} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <Glyph right={right} founder={founder} />
    </svg>
  );
}
