// Hand-drawn SVG icons in the Tribal Wars manner: small full-colour pictures with
// a dark ink outline and a highlight. Only the control glyphs (play, close, …)
// stay one-colour so they follow the button's text colour.

import type { JSX } from 'preact';
import type { BuildingId, UnitId } from '../../engine/types';
import type { VillageTheme } from '../../engine/data/themes';

type IconName = 'wood' | 'clay' | 'iron' | 'pop' | 'storage' | 'time' | 'points' | 'loyalty' | 'coin' | 'merchant' | 'hide'
  | UnitId | `b_${BuildingId}`
  | 'attack' | 'support' | 'return' | 'report' | 'map' | 'village' | 'quest' | 'rank' | 'settings' | 'overview' | 'pause' | 'play' | 'ff' | 'bell' | 'close' | 'star' | 'shield' | 'trade' | 'news' | 'prev' | 'next' | 'flag' | 'tribe';

const S = (props: { children: preact.ComponentChildren; size: number; class?: string; title?: string }) => (
  <svg viewBox="0 0 24 24" width={props.size} height={props.size} class={`icon ${props.class ?? ''}`} aria-hidden={props.title ? undefined : 'true'} role={props.title ? 'img' : undefined}>
    {props.title && <title>{props.title}</title>}
    {props.children}
  </svg>
);

// ---- palette ----
const O = '#2a180a'; // ink outline
const WOOD = '#a86b36', WOOD_LT = '#d19a5c', WOOD_DK = '#6e4220', GRAIN = '#ecc690';
const STEEL = '#b9c4cc', STEEL_LT = '#eef3f6', STEEL_DK = '#6a7782';
const GOLD = '#f0bd45', GOLD_LT = '#fde38a', GOLD_DK = '#a8741a';
const RED = '#b8392b', RED_LT = '#e0654d', RED_DK = '#7a2016';
const ROOF = '#b4482c', ROOF_DK = '#7c2d18';
const STONE = '#c3b69c', STONE_LT = '#e2d8c2', STONE_DK = '#8a7d64';
const BLUE = '#3d6aa3', BLUE_LT = '#6f98cc';
const GREEN = '#4f7a2e', GREEN_LT = '#7ea64a', GREEN_DK = '#2f4d1a';
const CLAY = '#c2603e', CLAY_LT = '#e08a62', CLAY_DK = '#83371f';
const PARCH = '#f1dfb4', PARCH_DK = '#c9aa6c';
const SKIN = '#e9b98a';

/** a stroked group: everything inside gets the ink outline */
const Ink = ({ children, w = 1 }: { children: preact.ComponentChildren; w?: number }) => (
  <g stroke={O} stroke-width={w} stroke-linejoin="round" stroke-linecap="round">{children}</g>
);

const horseHead = 'M6 22 7.6 14.4C5.2 12.6 5.3 8 8.4 5.8L8.9 2.4 11.2 5c4.4-.2 8.2 3 9.4 7.2l-1.9 2.4-3.4-1.6-1.9 2.4L13.6 22Z';

// ---- troops, drawn for each kind of village ----
// Goblin camps field rusty, green-ragged gear on wolves and boars; sorcerer towers
// crystal blades on storm-touched steeds and owl familiars; druid groves flint and
// living wood on stags, bears and hawks.

type Pal = {
  blade: string; bladeLt: string; bladeDk: string;
  wood: string; woodLt: string; woodDk: string;
  accent: string; accentLt: string;
  trim: string; trimLt: string; trimDk: string;
  gem: string; roof: string; shot: string;
};

const PAL: Record<VillageTheme, Pal> = {
  paladin: {
    blade: '#e4ecf2', bladeLt: '#ffffff', bladeDk: '#8a9aa8', wood: '#6e4a2a', woodLt: '#a8784a', woodDk: '#43291a',
    accent: '#2c56b0', accentLt: '#6f98e0', trim: GOLD, trimLt: GOLD_LT, trimDk: GOLD_DK, gem: '#fff1b0', roof: '#2c4f9e', shot: '#f3eee2',
  },
  classic: {
    blade: STEEL, bladeLt: STEEL_LT, bladeDk: STEEL_DK, wood: WOOD, woodLt: WOOD_LT, woodDk: WOOD_DK,
    accent: RED, accentLt: RED_LT, trim: GOLD, trimLt: GOLD_LT, trimDk: GOLD_DK, gem: BLUE_LT, roof: ROOF, shot: STONE,
  },
  goblin: {
    blade: '#978d74', bladeLt: '#cbbf9c', bladeDk: '#5c5342', wood: '#7a5230', woodLt: '#a2723f', woodDk: '#4a2f1a',
    accent: '#5f8a2e', accentLt: '#8fbc50', trim: '#b07a3a', trimLt: '#d9aa62', trimDk: '#6e4a1e', gem: '#9fe04a', roof: '#6a6452', shot: '#7a5230',
  },
  sorcerer: {
    blade: '#b58cff', bladeLt: '#f1e6ff', bladeDk: '#6a3fd0', wood: '#4a3a6a', woodLt: '#7a64a0', woodDk: '#2a1d40',
    accent: '#3f7ad8', accentLt: '#8fb8ff', trim: GOLD, trimLt: GOLD_LT, trimDk: '#5b3596', gem: '#8fe0ff', roof: '#5b3596', shot: '#c9a8ff',
  },
  druid: {
    blade: '#d6cdb0', bladeLt: '#f5efdc', bladeDk: '#8f8468', wood: '#7a5a38', woodLt: '#a88156', woodDk: '#4e3820',
    accent: '#4f7a2e', accentLt: '#8fbc50', trim: '#7ea64a', trimLt: '#c9f07a', trimDk: '#3f6a22', gem: '#e0a040', roof: '#4f7a2e', shot: '#8e9a80',
  },
  necromancer: {
    blade: '#7d8480', bladeLt: '#c9d0cb', bladeDk: '#4a504c', wood: '#3a3230', woodLt: '#5e5450', woodDk: '#221c1b',
    accent: '#3fc47a', accentLt: '#8dffb4', trim: '#e6dfcc', trimLt: '#fbf7ec', trimDk: '#2e2a33', gem: '#5cff9a', roof: '#2e2a33', shot: '#e6dfcc',
  },
};

const BONE = '#e6dfcc', BONE_DK = '#b9b19c', GHOST = '#5cff9a';

/** a skeletal horse: bone head, hollow eye glowing green, bared teeth */
const BoneHorse = ({ armor }: { armor?: boolean }) => (
  <>
    <path d={horseHead} fill={BONE} />
    <path d="M9.4 6.2c1.6-.6 3.4-.4 4.6.6M8.6 9.8c2.2.6 4.2.4 6-.4M8.2 13c1.4.4 2.8.4 4.2 0" fill="none" stroke={BONE_DK} stroke-width="1" />
    <circle cx="12.6" cy="8.4" r="1.4" fill="#1a1414" />
    <circle cx="12.6" cy="8.4" r=".6" fill={GHOST} stroke="none" />
    <path d="m16.6 13.6.5 1.1.6-1.1.5 1.1.6-1.1" fill="none" stroke="#1a1414" stroke-width=".7" />
    {armor && <path d="M8.4 5.4 11.2 5c3.2 0 5.8 1.6 7.4 4l-2.6 2.2-7.6.4c-.9-2.2-.9-4.4 0-6.2Z" fill="#2e2a33" />}
    {armor && <circle cx="12.8" cy="8.6" r=".7" fill={GHOST} stroke="none" />}
  </>
);
/** a little skull, for trimming necromancer gear */
const Skull = ({ x, y, r = 1.6 }: { x: number; y: number; r?: number }) => (
  <>
    <path d={`M${x - r} ${y}a${r} ${r} 0 1 1 ${r * 2} 0v${r * 0.7}h-${r * 2}Z`} fill={BONE} stroke-width=".6" />
    <circle cx={x - r * 0.4} cy={y + r * 0.1} r={r * 0.28} fill="#1a1414" stroke="none" />
    <circle cx={x + r * 0.4} cy={y + r * 0.1} r={r * 0.28} fill="#1a1414" stroke="none" />
  </>
);

// mount heads, all facing right like the horse
const wolfHead = 'M5 22 6.6 14C5 12 4.8 8.8 6.2 6.6L6 1.4 9.2 4.4 11.6 1.8 12.6 5.2C15 5.8 17 7.4 18.4 9.4L22.8 11.2 22.4 13.6 17.6 14.6 15 13.8 13.4 22Z';
const boarHead = 'M4.6 22 5.4 14C3.6 11.6 4 7.4 6.6 5.4L6.4 2 9.4 4.2C13 3.6 17 5.6 19.4 8.4L22.2 9.6 22.6 14.2 19.6 14.6C18 16 15.6 16 14.4 15.2L13.4 22Z';
const bearHead = 'M4.4 22 5.6 14.4C3.6 12 3.8 7.8 6.4 5.6 6 4 6.8 2.6 8.4 2.6 9.6 2.6 10.4 3.4 10.6 4.4 14.6 4 18 6.4 19.4 9.6L21.8 10.8C22.6 12.6 21.8 14.4 20 14.6L16.4 14.8 14 22Z';
const hawkHead = 'M4 22 5.6 13.4C3.8 10.6 4.6 6 8.4 4.2 11.6 2.8 15.6 3.6 18 6.2L21.6 8.4C22.4 10.4 21.6 12.4 20 13.2L19.8 11.2 17.4 11.6C16.6 14.4 15 16.2 14 17L14.2 22Z';

const Eye = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r=".9" fill={O} />;
const Bow = ({ c }: { c: string }) => <path d="M17.4 1.2c4.4 2.2 4.4 7.6 0 9.8" fill="none" stroke={c} stroke-width="1.6" />;
const Bolt = () => <path d="M20.6.8 18.4 4.4h2l-2.4 4 4.2-5h-2.1l1.5-2.6Z" fill="#fde38a" stroke-width=".5" />;
const Antlers = ({ c }: { c: string }) => (
  <path d="M9 4.8 7.2.8M8 2.6 5.4 1.8M10.8 4.6 12.8.6M11.9 2.4 14.6 2" fill="none" stroke={c} stroke-width="1.4" />
);
const Sparkle = ({ x, y, c = '#fde38a' }: { x: number; y: number; c?: string }) => (
  <path d={`M${x} ${y - 1.6}l.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5Z`} fill={c} stroke-width=".4" />
);
const Leaf = ({ x, y, r = 0, c = '#8fbc50' }: { x: number; y: number; r?: number; c?: string }) => (
  <path transform={`rotate(${r} ${x} ${y})`} d={`M${x} ${y}c1.2-1.6 3-2 4.4-1.4-.8 1.6-2.6 2.2-4.4 1.4Z`} fill={c} stroke-width=".6" />
);

/** a light cavalry lance, held upright behind the mount, with a pennant (or a leaf) near the tip */
const Lance = ({ shaft, flag, tip = STEEL, edge, leaf }: { shaft: string; flag: string; tip?: string; edge?: string; leaf?: boolean }) => (
  <>
    <path d="M2.4 23 5.6 3.2" stroke={O} stroke-width="2.8" />
    <path d="M2.4 23 5.6 3.2" stroke={shaft} stroke-width="1.3" />
    <path d="M5.1 3.6 6 .4 6.9 3.9Z" fill={tip} stroke-width=".6" />
    {leaf ? (
      <path d="M4.8 6.4C3 5.2 1.2 5.6.4 7.2c1.4 1.2 3.2 1.2 4.4-.8Z" fill={flag} stroke-width=".6" />
    ) : (
      <path d="M5.2 4.6.6 5.4l2.2 1.3L.6 8.2l4.2.4Z" fill={flag} stroke-width=".7" />
    )}
    {edge && <path d="M1.4 5.6 4.6 5" stroke={edge} stroke-width=".5" />}
  </>
);
/** a drawn bow with an arrow, over a mounted archer's (smaller) mount */
const RiderBow = ({ wood, string, tip }: { wood: string; string: string; tip: string }) => (
  <>
    <path d="M10.4 1.6c6.2-.8 12.2 5 11.8 11.6" fill="none" stroke={O} stroke-width="3" />
    <path d="M10.4 1.6c6.2-.8 12.2 5 11.8 11.6" fill="none" stroke={wood} stroke-width="1.5" />
    <path d="M10.4 1.6 13.4 10.6 22.2 13.2" fill="none" stroke={string} stroke-width=".7" />
    <path d="M13.4 10.6 21.4 2.6" stroke={O} stroke-width="2" />
    <path d="M13.4 10.6 21.4 2.6" stroke={GRAIN} stroke-width=".8" />
    <path d="m23.2.8-1 3.6-2.6-2.6Z" fill={tip} stroke-width=".6" />
  </>
);
/** a heavy rider's kite shield, carried in front of the mount */
const KiteShield = ({ fill, trim }: { fill: string; trim: string }) => (
  <>
    <path d="M1.2 12.8c2.8-.8 5.6-.8 8.4 0v3.4c0 3.2-1.8 5.6-4.2 6.8-2.4-1.2-4.2-3.6-4.2-6.8Z" fill={fill} stroke-width="1.1" />
    <path d="M2.4 13.8c2-.5 4-.5 6 0v2.4c0 2.5-1.3 4.3-3 5.3-1.7-1-3-2.8-3-5.3Z" fill="none" stroke={trim} stroke-width=".6" />
  </>
);

function horseMount(t: VillageTheme, coat: string, P: Pal): JSX.Element {
  return (
    <>
      <path d={horseHead} fill={coat} />
      <path d="M8.2 12.4c3 .6 6.2.2 9.4-1.6" fill="none" stroke={P.accent} stroke-width="1.5" />
      <Eye x={12.6} y={8.4} />
      {t === 'sorcerer' && <Sparkle x={10.6} y={6.6} c={P.gem} />}
    </>
  );
}

type Art = (P: Pal, t: VillageTheme) => JSX.Element;

const UNIT_ART: Partial<Record<UnitId, Art>> = {
  spear: (P, t) => (
    <Ink>
      <path d="m3.2 21.8-1-1L16 7l1 1Z" fill={P.wood} />
      {t === 'goblin' ? (
        <path d="M15.2 5.8 17 4.8 17.4 3.6 18.8 3.6 21.8 2.2 20.4 5.2 20.4 6.6 19.2 7 18.2 8.8 16.6 9.4 14.6 7.4Z" fill={P.blade} />
      ) : t === 'sorcerer' ? (
        <path d="M14.8 7 18.4 2.2 22 1.8 21.6 5.6 16.8 9.2Z" fill={P.blade} />
      ) : t === 'druid' ? (
        <path d="M15 7.2C16 4.4 18.6 2.6 21.8 2.2 21.4 5.4 19.6 8 16.8 9Z" fill={P.blade} />
      ) : (
        <path d="M15.2 5.8 21.8 2.2 18.2 8.8 16.6 9.4 14.6 7.4Z" fill={P.blade} />
      )}
      <path d="m17 6.6 3-2.6" stroke={P.bladeLt} stroke-width="1" />
      <path d="m13.2 8.2 2.6 2.6" stroke={P.accent} stroke-width="1.8" />
      {t === 'druid' && <Leaf x={12.4} y={10.6} r={120} c={P.accentLt} />}
      {t === 'sorcerer' && <Sparkle x={20.4} y={7.4} c={P.gem} />}
      {t === 'necromancer' && <Skull x={5.6} y={16.4} r={1.9} />}
    </Ink>
  ),
  sword: (P, t) => (
    <Ink>
      {t === 'goblin' ? (
        <path d="M21.6 2.4 21.8 7.8 10.6 16.8 7.2 13.4 15.8 3.6C17.8 2.2 19.6 1.8 21.6 2.4Z" fill={P.blade} />
      ) : (
        <path d="M20.8 2.2 21.4 6 10.6 16.8 7.2 13.4 18 2.6Z" fill={P.blade} />
      )}
      <path d="M19.6 4.4 9.6 14.4" stroke={P.bladeLt} stroke-width="1" />
      {t === 'sorcerer' && <path d="M17.4 7.4h.01M15 9.8h.01M12.6 12.2h.01" stroke={P.gem} stroke-width="1.6" />}
      {t === 'goblin' && <path d="m19.4 6.4-1 1M16.6 9.2l-1 1" stroke={P.bladeDk} stroke-width="1" />}
      <path d="m5 12.2 6.8 6.8-1.6 1.6-6.8-6.8Z" fill={P.trim} />
      <path d="m7.6 17.4-3.4 3.4" stroke={P.woodDk} stroke-width="2.4" />
      <circle cx="3.4" cy="21.6" r="1.6" fill={t === 'classic' ? P.trim : P.gem} />
      {t === 'necromancer' && <path d="M18.4 5.4 11 12.8" stroke={GHOST} stroke-width=".7" />}
    </Ink>
  ),
  axe: (P, t) =>
    t === 'sorcerer' ? (
      // a warmage's staff, crowned with fire
      <Ink>
        <path d="m3.6 22.2-1.4-1.2L14.6 8.4 16 9.6Z" fill={P.wood} />
        <path d="M17.6 1.4c-1.2 2 1.4 2.6.2 4.4 2-1 1.4-2.8 2.6-3.6.6 2.6 2 3.4 1 6.4-.8 2.4-3.2 3.6-5.6 3-2.6-.8-3.6-3.4-2.8-5.6.6-1.8 2.6-2.8 4.6-4.6Z" fill="#ff8a3a" />
        <circle cx="17.4" cy="8.2" r="2" fill="#ffd27a" stroke-width=".6" />
        <path d="m13.2 9.4 2 2" stroke={P.trim} stroke-width="1.6" />
      </Ink>
    ) : t === 'druid' ? (
      // a wildling's knotted club
      <Ink>
        <path d="M4 22 2.4 20.6 12.8 10C12.2 6.6 14.4 2.8 18 2.4c3-.2 4.6 2.4 4 5.2-.6 3.2-3.8 5-7.2 4.2Z" fill={P.wood} />
        <circle cx="17.6" cy="6" r="1" fill={P.woodDk} stroke-width=".5" />
        <circle cx="19.6" cy="8.6" r=".8" fill={P.woodDk} stroke-width=".5" />
        <path d="M15.4 4.6c.8-.8 1.8-1.2 2.8-1.2" fill="none" stroke={P.woodLt} stroke-width="1" />
        <Leaf x={20.6} y={3} r={-30} c={P.accentLt} />
      </Ink>
    ) : (
      <Ink>
        <path d="m4 22-1.6-1.4L15 6.4l1.6 1.4Z" fill={P.wood} />
        <path d="M12.6 5.4c1.8-3 5.8-4.4 9-2.8.4 3.6-1.4 7.6-5 9.4Z" fill={P.blade} />
        <path d="M15.6 3.8c1.6-.8 3.6-1 5.2-.4" fill="none" stroke={P.bladeLt} stroke-width="1.1" />
        {t === 'goblin' && <path d="m19.2 7.4 1.4.6M17.4 9.6l1.2 1" stroke={O} stroke-width="1" />}
        {t === 'goblin' && <path d="m11.4 9.4 2.4 2.4" stroke={P.accent} stroke-width="1.8" />}
        {t === 'necromancer' && <Skull x={7.2} y={16.2} r={1.8} />}
      </Ink>
    ),
  archer: (P, t) => (
    <Ink>
      <path d="M6 2.2c9.6 3.6 9.6 16 0 19.6l-1.2-1.4c7.8-3.6 7.8-13.2 0-16.8Z" fill={P.wood} />
      <path d="M5.4 3v18" stroke="#efe3c8" stroke-width=".8" />
      <path d="M3 12h15.4" stroke={P.woodDk} stroke-width="1.4" />
      <path d="M17.6 9.2 22 12l-4.4 2.8Z" fill={t === 'sorcerer' ? P.gem : P.blade} />
      <path d="M2 10.2 4.2 12 2 13.8" fill="none" stroke={P.accent} stroke-width="1.3" />
      {t === 'druid' && <Leaf x={10.4} y={4.2} r={40} c={P.accentLt} />}
      {t === 'goblin' && <path d="M9.6 5.6 11.4 5M10.4 18.4l1.8.6" stroke={P.accent} stroke-width="1.4" />}
      {t === 'sorcerer' && <Sparkle x={20.6} y={7} c={P.gem} />}
      {t === 'necromancer' && <path d="M18.6 12h3" stroke={GHOST} stroke-width=".8" />}
    </Ink>
  ),
  scout: (P, t) =>
    t === 'necromancer' ? (
      // a swarm of bats
      <Ink>
        <path d="M12 9.6c-.8-1.4-2.4-2.2-4-1.6.6-1.4 0-2.8-1.2-3.4-1 1.2-3 1.6-4.6 1.2.8 2.6 2.8 4.6 5.4 5 1.4.2 3-.2 4.4-1.2Zm0 0c.8-1.4 2.4-2.2 4-1.6-.6-1.4 0-2.8 1.2-3.4 1 1.2 3 1.6 4.6 1.2-.8 2.6-2.8 4.6-5.4 5-1.4.2-3-.2-4.4-1.2Z" fill="#2e2a33" />
        <ellipse cx="12" cy="10" rx="1.4" ry="1.8" fill="#3a3440" stroke-width=".6" />
        <circle cx="11.5" cy="9.4" r=".35" fill={GHOST} stroke="none" />
        <circle cx="12.5" cy="9.4" r=".35" fill={GHOST} stroke="none" />
        <path d="M6.6 18c-.4-.8-1.2-1.2-2-.8.3-.8 0-1.4-.6-1.8-.6.6-1.6.8-2.4.6.4 1.4 1.4 2.4 2.8 2.6.8.1 1.6-.1 2.2-.6Zm0 0c.4-.8 1.2-1.2 2-.8-.3-.8 0-1.4.6-1.8.6.6 1.6.8 2.4.6-.4 1.4-1.4 2.4-2.8 2.6-.8.1-1.6-.1-2.2-.6Z" fill="#2e2a33" stroke-width=".7" />
        <path d="M17.4 19.6c-.3-.6-1-.9-1.6-.6.2-.6 0-1.1-.5-1.4-.5.5-1.3.6-1.9.5.3 1.1 1.1 1.9 2.2 2.1.6.1 1.3-.1 1.8-.6Zm0 0c.3-.6 1-.9 1.6-.6-.2-.6 0-1.1.5-1.4.5.5 1.3.6 1.9.5-.3 1.1-1.1 1.9-2.2 2.1-.6.1-1.3-.1-1.8-.6Z" fill="#2e2a33" stroke-width=".6" />
      </Ink>
    ) : t === 'sorcerer' ? (
      // an owl familiar
      <Ink>
        <path d="M6.2 6.4 5 1.8 9.2 4.4ZM17.8 6.4 19 1.8 14.8 4.4Z" fill="#46307a" />
        <path d="M12 3C8 3 5.4 5.8 5.4 10c0 6 2.6 11 6.6 11s6.6-5 6.6-11c0-4.2-2.6-7-6.6-7Z" fill="#5b3596" />
        <path d="M8.4 14c1 3.2 2.2 5 3.6 5s2.6-1.8 3.6-5c-2.4-1-4.8-1-7.2 0Z" fill="#b8a0e0" stroke-width=".6" />
        <circle cx="9.4" cy="9.4" r="2.4" fill={P.trimLt} />
        <circle cx="14.6" cy="9.4" r="2.4" fill={P.trimLt} />
        <circle cx="9.4" cy="9.4" r="1" fill={O} />
        <circle cx="14.6" cy="9.4" r="1" fill={O} />
        <path d="M11 11.6h2L12 13.8Z" fill={P.trim} stroke-width=".5" />
        <Sparkle x={20.4} y={12} c={P.gem} />
      </Ink>
    ) : t === 'druid' ? (
      // a spirit hawk
      <Ink>
        <path d={hawkHead} fill="#8a5a32" />
        <path d="M5.4 13.6c2.4 1.6 5.2 2.2 8.6 2L14.2 22H4Z" fill="#efe0c0" stroke-width=".7" />
        <path d="M18 6.2 21.6 8.4c.8 2 0 4-1.6 4.8l-.2-2-2.4.4Z" fill={GOLD} />
        <circle cx="14.6" cy="7.6" r="1.4" fill={GOLD_LT} stroke-width=".6" />
        <circle cx="14.8" cy="7.6" r=".6" fill={O} stroke="none" />
        <path d="M12.2 6.2c1.4-.8 3.2-.8 4.6 0" fill="none" stroke={O} stroke-width="1.1" />
        <path d="M7 8.4c.8-2 2.4-3.2 4.2-3.4" fill="none" stroke="#b98452" stroke-width="1" />
      </Ink>
    ) : (
      <Ink>
        <path d="m2.6 18.2 3.8-3.8 3.2 3.2-3.8 3.8Z" fill={P.woodDk} />
        <path d="m6 14.8 6.2-6.2 3.2 3.2-6.2 6.2Z" fill={P.trim} />
        <path d="m11.6 9.2 5.6-5.6 3.2 3.2-5.6 5.6Z" fill={P.trimDk} />
        <circle cx="19.6" cy="4.4" r="2.6" fill={t === 'goblin' ? P.gem : BLUE_LT} />
        <path d="m7.4 14.2 4.8-4.8" stroke={P.trimLt} stroke-width="1" />
      </Ink>
    ),
  // Three kinds of riders, three silhouettes: light cavalry carry a lance and pennant,
  // mounted archers are a smaller mount under a drawn bow, heavy cavalry ride armoured
  // behind a kite shield.
  light: (P, t) =>
    t === 'necromancer' ? (
      <Ink>
        <Lance shaft="#3a3230" flag="#2e2a33" edge={GHOST} />
        <BoneHorse />
        <path d="M8.2 12.4c3 .6 6.2.2 9.4-1.6" fill="none" stroke={P.accent} stroke-width="1.3" />
      </Ink>
    ) : t === 'goblin' ? (
      <Ink>
        <Lance shaft={P.wood} flag={P.accent} tip={P.blade} />
        <path d={wolfHead} fill="#7d7a70" />
        <path d="M7.4 8c.4-1.6 1.4-2.6 2.8-3" fill="none" stroke="#a8a496" stroke-width="1" />
        <path d="M8 13.2c3 .6 6 .2 9-1.4" fill="none" stroke={P.accent} stroke-width="1.5" />
        <Eye x={13} y={8.4} />
        <circle cx="22.4" cy="11.8" r=".8" fill={O} />
        <path d="m17.6 14.2.4 1.4.8-1.6M19.6 14l.4 1.2.6-1.4" fill="#fff6e0" stroke-width=".4" />
      </Ink>
    ) : t === 'druid' ? (
      <Ink>
        <Lance shaft={P.wood} flag={P.accentLt} tip={P.blade} leaf />
        <Antlers c={P.woodLt} />
        <path d={horseHead} fill="#a8703e" />
        <path d="M17.6 10.8c1.4-.2 2.4.2 3 1.4" fill="none" stroke="#efe0c0" stroke-width="1.4" />
        <path d="M8.2 12.4c3 .6 6.2.2 9.4-1.6" fill="none" stroke={P.accent} stroke-width="1.5" />
        <Eye x={12.6} y={8.4} />
      </Ink>
    ) : (
      <Ink>
        <Lance shaft={t === 'sorcerer' ? P.woodLt : WOOD} flag={t === 'sorcerer' ? P.accentLt : RED} tip={t === 'sorcerer' ? P.gem : STEEL} />
        {horseMount(t, t === 'sorcerer' ? '#4a3a8a' : '#9a5f2e', P)}
        {t === 'sorcerer' && <Bolt />}
      </Ink>
    ),
  marcher: (P, t) => (
    <Ink>
      <RiderBow wood={t === 'necromancer' ? '#5e5450' : t === 'sorcerer' ? P.woodLt : P.wood} string={t === 'necromancer' ? GHOST : t === 'sorcerer' ? P.gem : '#efe3c8'} tip={t === 'sorcerer' ? P.gem : t === 'necromancer' ? GHOST : P.blade} />
      <g transform="translate(-1.2 5.6) scale(.76)">
        {t === 'necromancer' ? (
          <BoneHorse />
        ) : t === 'goblin' ? (
          <>
            <path d={wolfHead} fill="#5a5448" />
            <path d="M8 13.2c3 .6 6 .2 9-1.4" fill="none" stroke={P.accentLt} stroke-width="1.5" />
            <Eye x={13} y={8.4} />
            <circle cx="22.4" cy="11.8" r=".8" fill={O} />
          </>
        ) : t === 'druid' ? (
          <>
            <Antlers c={P.woodLt} />
            <path d={horseHead} fill="#7e5230" />
            <path d="M8.2 12.4c3 .6 6.2.2 9.4-1.6" fill="none" stroke={P.accentLt} stroke-width="1.5" />
            <Eye x={12.6} y={8.4} />
          </>
        ) : (
          horseMount(t, t === 'sorcerer' ? '#35286a' : '#6e4424', { ...P, accent: t === 'sorcerer' ? P.accentLt : GREEN_LT })
        )}
      </g>
    </Ink>
  ),
  heavy: (P, t) =>
    t === 'necromancer' ? (
      <Ink>
        <BoneHorse armor />
        <path d="M9.6 5.2 8.2.8 10.8 4.6Z" fill="#2e2a33" />
        <KiteShield fill="#2e2a33" trim={GHOST} />
        <Skull x={5.4} y={16.4} r={1.5} />
      </Ink>
    ) : t === 'goblin' ? (
      <Ink>
        <path d={boarHead} fill="#6b4a34" />
        <path d="M7 5.2 8.2 2.6M9.6 4.2l.8-2.6M12.2 4l.4-2.4" stroke={O} stroke-width="1.1" />
        <path d="M8.6 6.4c2.8-1 6.2-.4 8.8 1.8l-1.6 3.2-6.8.6c-.9-1.8-1-3.8-.4-5.6Z" fill={P.trim} />
        <ellipse cx="22" cy="11.9" rx="1" ry="2.2" fill="#c98a7a" stroke-width=".8" />
        <path d="M19.6 14.2c.6 1.6.2 3-1 4 .2-1.4 0-2.6-.6-3.6Z" fill="#fff6e0" stroke-width=".7" />
        <Eye x={14.4} y={9} />
      </Ink>
    ) : t === 'druid' ? (
      <Ink>
        <path d={bearHead} fill="#5e3f28" />
        <circle cx="8.4" cy="4.6" r=".9" fill="#b98452" stroke-width=".5" />
        <ellipse cx="19.8" cy="12.2" rx="2.4" ry="1.8" fill="#a7825a" stroke-width=".7" />
        <circle cx="21.6" cy="11.4" r=".9" fill={O} />
        <Eye x={14} y={8.6} />
        <path d="M7.4 13.4c2.6 1 5.6 1 8.4 0" fill="none" stroke={P.accentLt} stroke-width="1.5" />
        <Leaf x={7.6} y={13.2} r={200} c={P.accentLt} />
      </Ink>
    ) : (
      <Ink>
        <path d={horseHead} fill={t === 'sorcerer' ? '#e6e0f6' : '#e8e0d0'} />
        <path d="M8.4 5.4 11.2 5c3.2 0 5.8 1.6 7.4 4l-2.6 2.2-7.6.4c-.9-2.2-.9-4.4 0-6.2Z" fill={P.blade} />
        <path d="M9.6 6.4c2.4-.4 4.8.4 6.6 2" fill="none" stroke={P.bladeLt} stroke-width="1" />
        <circle cx="12.8" cy="8.6" r=".9" fill={O} />
        {t === 'sorcerer' ? (
          <path d="M9.6 5.2 8.8.6 11 4.8Z" fill={P.gem} />
        ) : (
          <path d="M9.4 2.2c-2 .2-3.2 1.4-3.6 3.2 1.4-.8 2.6-1 3.8-.6Z" fill={RED} />
        )}
        <KiteShield fill={t === 'sorcerer' ? '#5b3596' : BLUE} trim={t === 'sorcerer' ? P.gem : GOLD} />
        {t === 'sorcerer' ? <Sparkle x={5.4} y={17} c={P.gem} /> : <path d="M5.4 14.4v6.4M3 16.8h4.8" stroke={GOLD_LT} stroke-width="1.1" />}
      </Ink>
    ),
  ram: (P, t) => (
    <Ink>
      <path d="M4 10 11 4.4 18 10Z" fill={P.roof} />
      <path d="M4 10h14v3H4Z" fill={P.woodDk} />
      <rect x="1.8" y="11" width="19" height="3.6" rx="1.6" fill={P.wood} />
      {t === 'druid' ? (
        <circle cx="21" cy="12.8" r="1.8" fill={P.woodLt} />
      ) : (
        <path d="M20.6 10.6 22.6 12.8 20.6 15Z" fill={t === 'sorcerer' ? P.blade : P.blade} />
      )}
      <path d="M3.4 12h14" stroke={P.woodLt} stroke-width=".9" />
      {t === 'goblin' && <path d="m8 11-.6-1.6M12 11l-.6-1.6M8 14.6l-.6 1.4M12 14.6l-.6 1.4" stroke={P.bladeDk} stroke-width="1" />}
      {t === 'sorcerer' && <Sparkle x={11} y={7.8} c={P.gem} />}
      {t === 'druid' && <><Leaf x={6} y={7.6} r={-20} c={P.accentLt} /><Leaf x={13.6} y={6.4} r={10} c={P.accentLt} /></>}
      {t === 'necromancer' && <Skull x={21} y={11.6} r={1.7} />}
      <circle cx="6" cy="18" r="2.8" fill={P.woodLt} />
      <circle cx="16" cy="18" r="2.8" fill={P.woodLt} />
      <circle cx="6" cy="18" r=".7" fill={O} />
      <circle cx="16" cy="18" r=".7" fill={O} />
    </Ink>
  ),
  catapult: (P, t) => (
    <Ink>
      <path d="m7.4 15.4 1.6 1 10-13-1.6-1.2Z" fill={P.woodLt} />
      {t === 'goblin' ? (
        <path d="M16.2 2.2h4.6v3.8h-4.6Z" fill={P.shot} />
      ) : (
        <circle cx="18.6" cy="3.6" r="2.6" fill={P.shot} />
      )}
      {t === 'goblin' && <path d="M16.2 4.1h4.6" stroke={P.bladeDk} stroke-width=".8" />}
      {t === 'sorcerer' && <circle cx="17.9" cy="2.9" r=".8" fill="#fff" stroke="none" />}
      {t === 'druid' && <path d="M16.4 2.6c1.2-1.2 3-1.2 4.2 0" fill="none" stroke={P.accentLt} stroke-width="1.2" />}
      {t === 'necromancer' && <><circle cx="17.7" cy="3.6" r=".55" fill="#1a1414" stroke="none" /><circle cx="19.5" cy="3.6" r=".55" fill="#1a1414" stroke="none" /></>}
      <path d="M10 15.6 12.6 9h1.8l-1.6 6.6Z" fill={P.woodDk} />
      <rect x="2" y="15" width="17" height="3" rx=".8" fill={P.wood} />
      <circle cx="5" cy="19.6" r="2.2" fill={P.woodLt} />
      <circle cx="16" cy="19.6" r="2.2" fill={P.woodLt} />
    </Ink>
  ),
  noble: (P, t) => (
    <Ink>
      {t === 'necromancer' ? (
        // a lich's crown of black iron spikes
        <path d="M2.8 17.8 3.6 6.4 7 12 8.6 3.6 12 11 15.4 3.6 17 12l3.4-5.6.8 11.4Z" fill="#2e2a33" />
      ) : t === 'druid' ? (
        // an elder's crown of antler and leaf
        <path d="M2.8 17.8 3.4 9 6 11.6 5.4 6.8 8.6 11 12 4.4l3.4 6.6 3.2-4.2-.6 4.8 2.6-2.6.6 8.8Z" fill={P.woodLt} />
      ) : (
        <path d="M2.8 17.8 4.6 7l4.3 5.1L12 5.2l3.1 6.9L19.4 7l1.8 10.8Z" fill={P.trim} />
      )}
      <path d="M2.4 17.4h19.2v3.6H2.4Z" fill={t === 'druid' ? P.trim : P.trimDk} />
      <circle cx="12" cy="19.2" r="1.1" fill={t === 'classic' ? RED : P.gem} />
      <circle cx="6.4" cy="19.2" r=".9" fill={t === 'classic' ? BLUE_LT : P.accentLt} />
      <circle cx="17.6" cy="19.2" r=".9" fill={t === 'classic' ? BLUE_LT : P.accentLt} />
      {t === 'druid' ? (
        <><Leaf x={7} y={17.4} r={-60} c={P.trimLt} /><Leaf x={15.4} y={16.6} r={-120} c={P.trimLt} /></>
      ) : t === 'necromancer' ? (
        <Skull x={12} y={14.2} r={2} />
      ) : t === 'sorcerer' ? (
        <><Sparkle x={12} y={3.6} /><circle cx="4.6" cy="6.4" r="1.3" fill={P.gem} /><circle cx="19.4" cy="6.4" r="1.3" fill={P.gem} /></>
      ) : (
        <>
          <circle cx="4.6" cy="6.4" r="1.3" fill={P.trimLt} />
          <circle cx="12" cy="4.4" r="1.3" fill={t === 'goblin' ? '#f4efe0' : P.trimLt} />
          <circle cx="19.4" cy="6.4" r="1.3" fill={P.trimLt} />
        </>
      )}
    </Ink>
  ),
  militia: (P, t) => (
    <Ink>
      <path d="m20.6 21.8 1.2-1.2L9.6 8.4 8.4 9.6Z" fill={P.woodDk} />
      <path d="M7.2 9.8c-1.4-.4-2-1.6-1.6-3 .6.4 1 .2 1.2-.4.2-1 .8-1.8 1.8-2.2-.2 1 .2 1.6.8 2 .8.6 1 1.6.4 2.6Z" fill={t === 'necromancer' ? GHOST : t === 'sorcerer' ? '#b58cff' : '#f0a030'} stroke-width=".7" />
      <path d="M7.8 8.6c-.4-.6-.2-1.2.2-1.6.2.6.6.8 1 .6" fill="none" stroke={t === 'necromancer' ? '#d8ffe6' : '#fde38a'} stroke-width=".7" />
      <path d="m3.4 21.8-1.2-1.2 10-10 1.2 1.2Z" fill={P.wood} />
      <path d="M11.2 11.6 9 9.4l3.2-3.2 2.2 2.2Z" fill={P.bladeDk} />
      <path d="M12.8 5.6 17.6.8M15.4 8.2l4.8-4.8M14.2 6.8l6.6-6.6" fill="none" stroke={P.blade} stroke-width="1.4" />
      <path d="M12.8 5.6 17.6.8M15.4 8.2l4.8-4.8M14 7l6.8-6.8" fill="none" stroke={O} stroke-width=".4" />
      {t === 'druid' && <Leaf x={7.4} y={15.6} r={-45} c={P.accentLt} />}
      {t === 'goblin' && <path d="m6.4 16.4 2 2" stroke={P.accent} stroke-width="1.8" />}
      {t === 'necromancer' && <path d="m5.6 17.2 1.6 1.6M4.4 18.4 6 20" stroke={BONE_DK} stroke-width="1" />}
    </Ink>
  ),
};

const paths: Record<string, () => JSX.Element> = {
  // ---- the haul: a stuffed loot sack (drawn solid for a full haul, faded for a partial one) ----
  haul: () => (
    <Ink>
      <path d="M5.2 21.4c-2-1.2-2.6-4.6-1.2-7.8 1.1-2.6 3.1-4.4 5.2-5.2h5.6c2.1.8 4.1 2.6 5.2 5.2 1.4 3.2.8 6.6-1.2 7.8Z" fill="#c9a060" />
      <path d="M6.8 12.4c-.9 1.6-1.3 3.6-1 5.4" fill="none" stroke="#e8c98a" stroke-width="1.1" />
      <path d="M9.2 8.4h5.6l-.6 1.8H9.8Z" fill="#8a6230" />
      <rect x="5.6" y="3.2" width="5.6" height="3" rx="1.5" fill={WOOD} transform="rotate(-18 8.4 4.7)" />
      <ellipse cx="10.9" cy="3.8" rx="1.1" ry="1.3" fill={GRAIN} transform="rotate(-18 8.4 4.7)" stroke-width=".7" />
      <rect x="11.4" y="2.2" width="4.4" height="3" rx=".5" fill={CLAY} transform="rotate(10 13.6 3.7)" />
      <path d="M15.4 6.8 17.2 3.4 19.6 5.6 18.2 8Z" fill={STEEL} />
      <path d="M8 16.4h8" stroke="#8a6230" stroke-width="1" />
    </Ink>
  ),

  // ---- resources ----
  wood: () => (
    <Ink>
      <rect x="2.2" y="12" width="16.6" height="6.8" rx="3.4" fill={WOOD} />
      <path d="M4.5 13.6h11" stroke={WOOD_LT} stroke-width="1" />
      <ellipse cx="18.6" cy="15.4" rx="3.2" ry="3.4" fill={GRAIN} />
      <ellipse cx="18.6" cy="15.4" rx="1.3" ry="1.4" fill="none" stroke={WOOD} stroke-width=".8" />
      <rect x="4.6" y="5" width="14" height="6.8" rx="3.4" fill={WOOD} />
      <path d="M6.8 6.6h9" stroke={WOOD_LT} stroke-width="1" />
      <ellipse cx="18.4" cy="8.4" rx="3.2" ry="3.4" fill={GRAIN} />
      <ellipse cx="18.4" cy="8.4" rx="1.3" ry="1.4" fill="none" stroke={WOOD} stroke-width=".8" />
    </Ink>
  ),
  clay: () => (
    <Ink>
      <rect x="1.8" y="13.2" width="9.8" height="6" rx=".8" fill={CLAY} />
      <rect x="12.4" y="13.2" width="9.8" height="6" rx=".8" fill={CLAY} />
      <rect x="7.1" y="6.6" width="9.8" height="6" rx=".8" fill={CLAY} />
      <g stroke={CLAY_LT} stroke-width="1.1">
        <path d="M3.3 14.8h6.8M13.9 14.8h6.8M8.6 8.2h6.8" />
      </g>
      <g stroke={CLAY_DK} stroke-width=".9">
        <path d="M3.3 17.8h6.8M13.9 17.8h6.8M8.6 11.2h6.8" />
      </g>
    </Ink>
  ),
  iron: () => (
    <Ink>
      <path d="M2.5 18.5 6.4 9h11.2l3.9 9.5Z" fill={STEEL_DK} />
      <path d="M6.4 9 8.6 13h6.8l2.2-4Z" fill={STEEL} />
      <path d="M8.6 13h6.8l2 5.5H6.6Z" fill="#8c98a2" stroke="none" />
      <path d="M8.4 10.2h4.6" stroke={STEEL_LT} stroke-width="1.1" />
    </Ink>
  ),
  pop: () => (
    <Ink>
      <path d="M4.2 21.2c0-4.6 3.4-7.8 7.8-7.8s7.8 3.2 7.8 7.8Z" fill="#7a5a34" />
      <path d="M9.4 13.8 12 17l2.6-3.2" fill="none" stroke="#c7a071" stroke-width="1" />
      <circle cx="12" cy="8" r="4" fill={SKIN} />
      <path d="M7.8 7.2c.6-3 2.4-4.6 4.2-4.6s3.6 1.6 4.2 4.6c-1.4-.8-2.6-1.2-4.2-1.2s-2.8.4-4.2 1.2Z" fill={WOOD_DK} />
    </Ink>
  ),
  storage: () => (
    <Ink>
      <rect x="3" y="5" width="18" height="15" rx="1" fill={WOOD} />
      <path d="M3 12.5h18M3 5l18 15M21 5 3 20" fill="none" stroke={WOOD_DK} stroke-width="1.1" />
      <rect x="3" y="5" width="18" height="15" rx="1" fill="none" />
      <path d="M4.6 6.8h5" stroke={WOOD_LT} stroke-width="1" />
    </Ink>
  ),
  hide: () => (
    <Ink>
      <path d="M3 11c0-3.3 2.7-5.5 9-5.5s9 2.2 9 5.5Z" fill={WOOD} />
      <rect x="3" y="11" width="18" height="9" rx=".8" fill={WOOD_DK} />
      <path d="M3 11h18" />
      <rect x="10" y="9.4" width="4" height="4.6" rx=".6" fill={GOLD} />
      <path d="M5 7.8c1.6-1.2 3.8-1.6 6-1.6" fill="none" stroke={WOOD_LT} stroke-width="1" />
    </Ink>
  ),
  time: () => (
    <Ink>
      <rect x="5" y="2.2" width="14" height="2.6" rx=".8" fill={WOOD} />
      <rect x="5" y="19.2" width="14" height="2.6" rx=".8" fill={WOOD} />
      <path d="M7 4.8h10c0 4-3.6 5.4-3.6 7.2s3.6 3.2 3.6 7.2H7c0-4 3.6-5.4 3.6-7.2S7 8.8 7 4.8Z" fill="#fff6e0" />
      <path d="M9 17.6c.6-1.6 2-2.4 3-3.4 1 1 2.4 1.8 3 3.4Z" fill={GOLD} stroke="none" />
      <path d="M9.6 7.4h4.8c-.6 1.2-1.6 1.8-2.4 2.6-.8-.8-1.8-1.4-2.4-2.6Z" fill={GOLD} stroke="none" />
    </Ink>
  ),
  points: () => (
    <Ink>
      <path d="m12 2.4 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 16.8l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9Z" fill={GOLD} />
      <path d="m12 5.6 1.6 3.4" stroke={GOLD_LT} stroke-width="1.2" />
    </Ink>
  ),
  star: () => (
    <Ink>
      <path d="m12 2.4 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 16.8l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9Z" fill={GOLD} />
    </Ink>
  ),
  loyalty: () => (
    <Ink>
      <path d="M12 21s-8.8-5.3-8.8-11.6C3.2 6.3 5.6 4 8.4 4c1.6 0 2.9.8 3.6 2 .7-1.2 2-2 3.6-2 2.8 0 5.2 2.3 5.2 5.4C20.8 15.7 12 21 12 21Z" fill={RED} />
      <path d="M6 8.2c.4-1.4 1.4-2.2 2.6-2.2" fill="none" stroke={RED_LT} stroke-width="1.4" />
    </Ink>
  ),
  coin: () => (
    <Ink>
      <circle cx="12" cy="12" r="9.3" fill={GOLD} />
      <circle cx="12" cy="12" r="7" fill="none" stroke={GOLD_DK} stroke-width=".8" />
      <path d="m7.6 15 1.1-5.6 2.1 2.4L12 7.6l1.2 4.2 2.1-2.4 1.1 5.6Z" fill={GOLD_DK} stroke-width=".7" />
      <path d="M6 8.4c1-1.8 2.6-2.9 4.4-3.3" fill="none" stroke={GOLD_LT} stroke-width="1.2" />
    </Ink>
  ),
  merchant: () => (
    <Ink>
      <path d="M2.5 15.5h17l1.5-3" fill="none" stroke={WOOD_DK} stroke-width="1.6" />
      <rect x="3" y="11" width="15" height="4.6" rx=".6" fill={WOOD} />
      <path d="M5 11c0-2.6 1.4-4.4 3.4-4.4S11.8 8.4 11.8 11Z" fill="#d8c08a" />
      <path d="M10.4 11c0-2.2 1.2-3.6 2.9-3.6S16.2 8.8 16.2 11Z" fill="#c9ad72" />
      <circle cx="7" cy="18" r="2.6" fill={WOOD_LT} />
      <circle cx="15" cy="18" r="2.6" fill={WOOD_LT} />
      <circle cx="7" cy="18" r=".7" fill={O} />
      <circle cx="15" cy="18" r=".7" fill={O} />
    </Ink>
  ),

  // ---- units ----
  paladin: () => (
    <Ink>
      <path d="M12 3.4C13 1.2 16 .4 19.2 1.4c-2 .8-3.4 2.2-4.2 4Z" fill={BLUE} />
      <path d="M4.6 21.6v-9.8C4.6 6.8 7.8 3.4 12 3.4s7.4 3.4 7.4 8.4v9.8Z" fill={BLUE} stroke-width="1.2" />
      <path d="M6.2 20.4v-8.6C6.2 7.8 8.8 5 12 5s5.8 2.8 5.8 6.8v8.6Z" fill={STEEL} stroke-width=".7" />
      <path d="M6.2 20.4v-8.6C6.2 7.8 8.8 5 12 5s5.8 2.8 5.8 6.8v8.6Z" fill="none" stroke={GOLD} stroke-width="1" />
      <path d="M7.4 11.2h9.2v2H7.4Z" fill={O} stroke-width=".6" />
      <path d="M12 5v6.2M12 13.2v7.2M9.4 16.6h5.2" stroke={GOLD} stroke-width="1.4" />
      <path d="M8 8.6c.8-1.6 2-2.4 3.2-2.6" fill="none" stroke={STEEL_LT} stroke-width="1.1" />
    </Ink>
  ),
  sorcerer: () => (
    <Ink>
      <path d="m18.6 8.4 2.6 13.4" stroke={WOOD_DK} stroke-width="1.6" />
      <circle cx="18.2" cy="6.4" r="2.6" fill="#b58cff" />
      <circle cx="17.6" cy="5.7" r=".8" fill="#f1e6ff" stroke="none" />
      <path d="M3.2 18.4c2.6-1.2 5.2-1.6 8-1.4 1.4.1 2.6.5 3.6 1.2L12.4 3.2c-.6-.8-1.6-.8-2.2.2Z" fill="#5b3596" />
      <path d="M2.4 19.2c3.4-2 9-2.2 13 0 .6.4.4 1.2-.2 1.3-4.2.8-8.6.8-12.6 0-.6-.1-.8-.9-.2-1.3Z" fill="#48297a" />
      <path d="m8.6 9.4.6 1.2 1.3.2-1 .9.2 1.3-1.1-.6-1.2.6.2-1.3-.9-.9 1.3-.2Z" fill={GOLD} stroke-width=".5" />
      <path d="M10.6 5.2c-.8 2.6-1.8 5.6-2.6 8.8" fill="none" stroke="#8a64c8" stroke-width="1" />
    </Ink>
  ),
  druid: () => (
    <Ink>
      <path d="M4 21.6c.4-6 1.2-10.4 3-13.2C8.4 6 10 4.6 12 4.6s3.6 1.4 5 3.8c1.8 2.8 2.6 7.2 3 13.2Z" fill={GREEN} />
      <path d="M8.4 21.6c0-4.6 1.4-8.4 3.6-8.4s3.6 3.8 3.6 8.4Z" fill="#2c2418" />
      <circle cx="10.6" cy="15.6" r=".7" fill="#c9f07a" stroke="none" />
      <circle cx="13.4" cy="15.6" r=".7" fill="#c9f07a" stroke="none" />
      <path d="M7.2 9.6c1-2.4 2.8-4 4.8-4.4" fill="none" stroke={GREEN_LT} stroke-width="1.1" />
      <path d="M3.4 22.2 5 4.2" stroke={WOOD} stroke-width="1.6" />
      <path d="M5 4.2c-1.8-.6-3-2-3-3.4 1.6 0 3 1.2 3 3.4Zm0 0c1.2-1.6 3-2.4 4.4-2-.6 1.6-2.4 2.4-4.4 2Z" fill={GREEN_LT} stroke-width=".7" />
    </Ink>
  ),
  necromancer: () => (
    <Ink>
      <path d="m19 9.4 2.4 12.4" stroke="#221c1b" stroke-width="1.6" />
      <path d="M16.8 7.2a2.4 2.4 0 1 1 4.8 0v1.6h-4.8Z" fill={BONE} stroke-width=".7" />
      <circle cx="18.4" cy="7.4" r=".5" fill={GHOST} stroke="none" />
      <circle cx="20" cy="7.4" r=".5" fill={GHOST} stroke="none" />
      <path d="M2.6 21.6c.4-6 1.4-10.6 3.4-13.4C7.4 5.8 9.4 3.4 12 3.4s4.2 2.4 5.2 4.8c1 2.6 1.6 7.4 1.6 13.4Z" fill="#2e2a33" />
      <path d="M8.2 13.4C8.2 9.8 9.8 7.6 12 7.6s3.8 2.2 3.8 5.8v1.4l-1.2 1.6H9.4l-1.2-1.6Z" fill={BONE} />
      <path d="M9.8 11.6h1.4v1.6H9.8ZM12.8 11.6h1.4v1.6h-1.4Z" fill="#1a1414" stroke="none" />
      <circle cx="10.5" cy="12.3" r=".45" fill={GHOST} stroke="none" />
      <circle cx="13.5" cy="12.3" r=".45" fill={GHOST} stroke="none" />
      <path d="M10.4 15.2v1.4M12 15.2v1.4M13.6 15.2v1.4" stroke="#1a1414" stroke-width=".6" />
      <path d="M6.4 9.4c1-2.4 3-4.2 5.6-4.4" fill="none" stroke="#4a4452" stroke-width="1" />
    </Ink>
  ),
  goblin: () => (
    <Ink>
      <path d="M6.2 10.4 1 6.6l1.4 6.2 4.6.8ZM17.8 10.4 23 6.6l-1.4 6.2-4.6.8Z" fill="#6f9a3a" />
      <path d="M12 3.6c4 0 6.6 3 6.6 7.4 0 5-3 9.2-6.6 9.2s-6.6-4.2-6.6-9.2c0-4.4 2.6-7.4 6.6-7.4Z" fill="#86b04a" />
      <path d="M7.6 9.4 11 10.6M16.4 9.4 13 10.6" stroke={O} stroke-width="1.2" />
      <ellipse cx="9.6" cy="12" rx="1.3" ry="1" fill={GOLD_LT} stroke-width=".6" />
      <ellipse cx="14.4" cy="12" rx="1.3" ry="1" fill={GOLD_LT} stroke-width=".6" />
      <path d="M8.6 15.6c1.8 1.4 5 1.4 6.8 0-.6 2.2-2 3.2-3.4 3.2s-2.8-1-3.4-3.2Z" fill="#3a1f10" stroke-width=".7" />
      <path d="m10.2 16.2.5 1 .6-1M12.8 16.2l.5 1 .6-1" fill="#fff6e0" stroke-width=".4" />
      <path d="M8.2 6.4c1-1 2.4-1.6 3.8-1.6" fill="none" stroke="#b3d677" stroke-width="1.1" />
    </Ink>
  ),

  // ---- buildings ----
  b_main: () => (
    <Ink>
      <path d="M12 1.2v4" />
      <path d="M12 1.2h4.4l-1.2 1.2 1.2 1.2H12Z" fill={RED} />
      <path d="M2.4 11.6 12 4.6l9.6 7Z" fill={ROOF} />
      <path d="M5 8.8 12 3.8" fill="none" stroke="#d2694a" stroke-width="1" />
      <rect x="4.2" y="11.6" width="15.6" height="9.4" fill={STONE} />
      <path d="M4.2 15h15.6M8 11.6V15M16 11.6V15M12 15v6" fill="none" stroke={STONE_DK} stroke-width=".8" />
      <path d="M9.6 21v-3.4a2.4 2.4 0 0 1 4.8 0V21Z" fill={WOOD_DK} />
    </Ink>
  ),
  b_barracks: () => (
    <Ink>
      <path d="m3.6 19.6 14-14 1.4 1.4-14 14Z" fill={STEEL} />
      <path d="m20.4 19.6-14-14L5 7l14 14Z" fill={STEEL} />
      <path d="M12 6.4 7.2 8.6V13c0 3.4 2.2 5.4 4.8 6.4 2.6-1 4.8-3 4.8-6.4V8.6Z" fill={RED} />
      <path d="M12 8.2V17M8.8 11.4h6.4" stroke={GOLD} stroke-width="1.3" />
      <path d="M2.4 18.4 5.6 21.6M21.6 18.4l-3.2 3.2" stroke={WOOD_DK} stroke-width="1.8" />
    </Ink>
  ),
  b_stable: () => (
    <Ink>
      <path d="M5.4 3h4.2v4c0 5.2 1 8.8 2.4 8.8s2.4-3.6 2.4-8.8V3h4.2v4.4C18.6 15.6 16 21 12 21S5.4 15.6 5.4 7.4Z" fill={STEEL} />
      <path d="M7 5.6c0 6 .8 10.4 2.6 12.6" fill="none" stroke={STEEL_LT} stroke-width="1.1" />
      <g fill={O} stroke="none">
        <circle cx="7.5" cy="6.4" r=".7" /><circle cx="7.8" cy="10.2" r=".7" /><circle cx="16.5" cy="6.4" r=".7" /><circle cx="16.2" cy="10.2" r=".7" />
      </g>
    </Ink>
  ),
  b_workshop: () => (
    <Ink>
      <path d="M11 2.4h2.4l.5 2.3 1.8.8 2-1.3 1.7 1.7-1.3 2 .8 1.8 2.3.5v2.4l-2.3.5-.8 1.8 1.3 2-1.7 1.7-2-1.3-1.8.8-.5 2.3H11l-.5-2.3-1.8-.8-2 1.3L5 17l1.3-2-.8-1.8-2.3-.5v-2.4l2.3-.5.8-1.8L5 6l1.7-1.7 2 1.3 1.8-.8Z" fill={WOOD} />
      <circle cx="12.2" cy="11.8" r="3" fill={WOOD_DK} />
      <path d="m13.8 13.4 7 7" stroke={WOOD_LT} stroke-width="2" />
      <path d="m17.6 18.8 3.6-3.6 1.6 1.6-3.6 3.6Z" fill={STEEL_DK} />
    </Ink>
  ),
  b_academy: () => (
    <Ink>
      <path d="M12 1.2V4" />
      <path d="M4 10.6a8 8 0 0 1 16 0Z" fill={BLUE} />
      <path d="M7 7.6c1.2-1.6 3-2.6 5-2.6" fill="none" stroke={BLUE_LT} stroke-width="1.1" />
      <rect x="3.2" y="10.6" width="17.6" height="2" fill={STONE_LT} />
      <rect x="4" y="12.6" width="16" height="7.6" fill={STONE} />
      <path d="M7.2 13.6v6M10.4 13.6v6M13.6 13.6v6M16.8 13.6v6" stroke={STONE_DK} stroke-width="1.3" />
      <rect x="2.8" y="20.2" width="18.4" height="1.8" fill={STONE_DK} />
    </Ink>
  ),
  b_smithy: () => (
    <Ink>
      <path d="M2.4 8h13.4c3.2 0 5.6 1.4 6 3.6h-5.4l-1.8 2.6H9.4C6.2 14.2 3.6 11.6 2.4 8Z" fill={STEEL_DK} />
      <path d="M4.4 9.6h11" stroke={STEEL} stroke-width="1.1" />
      <path d="M9 14.2h6.2v2.4h2.6v3.6H6.4v-3.6H9Z" fill="#4c555d" />
      <path d="m15.6 2.2 4.6 4.6" stroke={WOOD} stroke-width="1.8" />
      <path d="m12.6 4.2 3-3 2.4 2.4-3 3Z" fill={STEEL} />
    </Ink>
  ),
  b_rally: () => (
    <Ink>
      <rect x="4.8" y="1.6" width="2" height="20.6" rx=".8" fill={WOOD} />
      <path d="M6.8 2.8h12.6l-3 4.2 3 4.2H6.8Z" fill={RED} />
      <path d="M8.4 4.4h7.6" stroke={RED_LT} stroke-width="1" />
      <path d="M2.8 22.2h6" stroke={WOOD_DK} stroke-width="1.6" />
      <circle cx="5.8" cy="1.6" r="1.2" fill={GOLD} />
    </Ink>
  ),
  b_statue: () => (
    <Ink>
      <circle cx="12" cy="4.2" r="2.4" fill={STONE_LT} />
      <path d="M8.8 7.2h6.4l1.2 7H14l-.6 3.6h-2.8L10 14.2H7.6Z" fill={STONE} />
      <path d="m15.4 7.4 3.8-4.4" stroke={STEEL_DK} stroke-width="1.4" />
      <rect x="5.6" y="17.8" width="12.8" height="4" rx=".6" fill={STONE_DK} />
      <path d="M7 19.2h10" stroke={STONE} stroke-width=".9" />
    </Ink>
  ),
  b_market: () => (
    <Ink>
      <path d="M4 9.6V21M20 9.6V21" stroke={WOOD_DK} stroke-width="1.6" />
      <path d="M2 9.6 4 3.6h16l2 6Z" fill="#f4ead2" />
      <path d="M6.6 3.6 5.6 9.6h3.2L9.4 3.6ZM14.6 3.6l.6 6h3.2l-1-6Z" fill={RED} stroke="none" />
      <path d="M2 9.6 4 3.6h16l2 6Z" fill="none" />
      <path d="M2 9.6c0 1.4 1.2 2 2.2 2s2-.6 2-2c0 1.4 1.2 2 2.2 2s2-.6 2-2c0 1.4 1.2 2 2.2 2s2-.6 2-2c0 1.4 1.2 2 2.2 2s2-.6 2-2c0 1.4 1.2 2 2.2 2S22 11 22 9.6" fill={RED} />
      <rect x="5.2" y="15" width="13.6" height="3.6" fill={WOOD} />
      <circle cx="8.4" cy="14" r="1.4" fill={GOLD} />
      <circle cx="12" cy="14" r="1.4" fill={GREEN_LT} />
      <circle cx="15.6" cy="14" r="1.4" fill={RED_LT} />
    </Ink>
  ),
  b_timber: () => (
    <Ink>
      <path d="M12 1.4 5.2 10.6h3.4L4 17.2h16l-4.6-6.6h3.4Z" fill={GREEN} />
      <path d="M12 3.6 8.4 8.6" fill="none" stroke={GREEN_LT} stroke-width="1.1" />
      <path d="M10.6 17.2h2.8v4.6h-2.8Z" fill={WOOD} />
      <path d="M8 13.4 6.6 15.4M15.4 12.6l1.6 2.2" stroke={GREEN_DK} stroke-width=".9" />
    </Ink>
  ),
  b_claypit: () => (
    <Ink>
      <path d="M1.6 19.4c1.4-3.4 5.4-5.4 10.4-5.4s9 2 10.4 5.4Z" fill={CLAY_DK} />
      <path d="M4.4 18.4c1.6-1.8 4.4-2.8 7.6-2.8s6 1 7.6 2.8Z" fill={CLAY} stroke="none" />
      <rect x="4.6" y="8.6" width="7.4" height="4.4" rx=".6" fill={CLAY} />
      <rect x="12.6" y="8.6" width="7.4" height="4.4" rx=".6" fill={CLAY} />
      <rect x="8.6" y="3.6" width="7.4" height="4.4" rx=".6" fill={CLAY} />
      <path d="M5.8 9.8h5M13.8 9.8h5M9.8 4.8h5" stroke={CLAY_LT} stroke-width=".9" />
    </Ink>
  ),
  b_ironmine: () => (
    <Ink>
      <path d="m10.4 7.2 2.4.2-2.4 15-2.4-.4Z" fill={WOOD} />
      <path d="M2.8 8.2C7.2 3.4 14.6 2.2 21 5.4l-1 2C15 5.4 9.8 5.8 5.8 8.6Z" fill={STEEL} />
      <path d="M5.4 6.6C9 4.2 14 3.6 18.4 5" fill="none" stroke={STEEL_LT} stroke-width="1" />
    </Ink>
  ),
  b_farm: () => (
    <Ink>
      <path d="M12 22V7.4M12 22 7.8 12.6M12 22l4.2-9.4" fill="none" stroke={GOLD_DK} stroke-width="1.4" />
      <g fill={GOLD} stroke-width=".8">
        <ellipse cx="12" cy="4.6" rx="1.7" ry="3.2" />
        <ellipse cx="7.2" cy="8" rx="1.6" ry="3" transform="rotate(-24 7.2 8)" />
        <ellipse cx="16.8" cy="8" rx="1.6" ry="3" transform="rotate(24 16.8 8)" />
        <ellipse cx="9.6" cy="7" rx="1.5" ry="2.8" transform="rotate(-10 9.6 7)" />
        <ellipse cx="14.4" cy="7" rx="1.5" ry="2.8" transform="rotate(10 14.4 7)" />
      </g>
      <path d="M8.6 16.6h6.8" stroke={RED} stroke-width="2" />
    </Ink>
  ),
  b_warehouse: () => (
    <Ink>
      <path d="M1.6 10.4 12 3l10.4 7.4Z" fill={ROOF} />
      <path d="M4.4 8.4 12 3" fill="none" stroke="#d2694a" stroke-width="1" />
      <rect x="3" y="10.4" width="18" height="10.6" fill={WOOD} />
      <path d="M3 13.4h18M3 16.4h18" stroke={WOOD_DK} stroke-width=".7" />
      <rect x="7.6" y="13" width="8.8" height="8" fill={WOOD_DK} />
      <path d="m7.6 13 8.8 8M16.4 13l-8.8 8" stroke={WOOD_LT} stroke-width="1" />
    </Ink>
  ),
  b_hiding: () => (
    <Ink>
      <path d="M2 20.6c0-6 4.4-10.4 10-10.4s10 4.4 10 10.4Z" fill={STONE_DK} />
      <path d="M6.4 20.6c0-3.6 2.4-6.2 5.6-6.2s5.6 2.6 5.6 6.2Z" fill="#2e2418" />
      <path d="M8.6 20.6v-2.4h6.8v2.4Z" fill={WOOD} />
      <rect x="11" y="16.8" width="2" height="1.8" fill={GOLD} />
      <path d="M4.4 15.4c1.2-2 3-3.4 5.2-4" fill="none" stroke={STONE} stroke-width="1" />
      <path d="M3.4 7.8c1.2-2.6 3-4 5-4.4M20.6 7.8c-1.2-2.6-3-4-5-4.4" fill="none" stroke={GREEN_LT} stroke-width="1.8" />
    </Ink>
  ),
  b_wall: () => (
    <Ink>
      <path d="M1.8 8.6h3.4V5.4h3.4v3.2h2.8V5.4h3.4v3.2h2.8V5.4h3.4v3.2h1.2V21H1.8Z" fill={STONE} />
      <path d="M1.8 12.6h20.4M1.8 16.8h20.4M6 8.6v4M12 8.6v4M18 8.6v4M9 12.6v4.2M15 12.6v4.2M4 16.8V21M12 16.8V21M20 16.8V21" fill="none" stroke={STONE_DK} stroke-width=".8" />
      <path d="M2.8 9.8h5" stroke={STONE_LT} stroke-width="1" />
    </Ink>
  ),
  b_watchtower: () => (
    <Ink>
      <path d="M5.6 6.6 12 1.4l6.4 5.2Z" fill={ROOF} />
      <rect x="6.4" y="6.6" width="11.2" height="3.6" fill={WOOD} />
      <path d="M8.4 6.6v3.6M12 6.6v3.6M15.6 6.6v3.6" stroke={WOOD_DK} stroke-width=".8" />
      <path d="M8 10.2 6 22M16 10.2l2 12M7.2 15.4l9.6 4.4M16.8 15.4l-9.6 4.4M7.4 13.6h9.2" fill="none" stroke={WOOD_DK} stroke-width="1.6" />
      <path d="M8 10.2 6 22M16 10.2l2 12" fill="none" stroke={WOOD} stroke-width=".8" />
    </Ink>
  ),

  // ---- ui ----
  attack: () => (
    <Ink>
      <path d="M21.4 2.6 21.6 6 11 16.6 7.4 13 18 2.4Z" fill={STEEL} />
      <path d="M20 4 9.6 14.4" stroke={STEEL_LT} stroke-width="1" />
      <path d="m5.2 11.8 7 7-1.6 1.6-7-7Z" fill={RED} />
      <path d="m7.8 17.2-3.6 3.6" stroke={WOOD_DK} stroke-width="2.4" />
    </Ink>
  ),
  support: () => (
    <Ink>
      <path d="M12 2.2 3.6 5.8V12c0 5.2 3.6 8.6 8.4 9.8 4.8-1.2 8.4-4.6 8.4-9.8V5.8Z" fill={BLUE} />
      <path d="M12 5v14M7 10.6h10" stroke="#f1e6cc" stroke-width="2.2" />
      <path d="M12 5v14M7 10.6h10" stroke={O} stroke-width=".4" />
      <path d="M5.4 7c1.6-.8 3.4-1.6 5-2.2" fill="none" stroke={BLUE_LT} stroke-width="1" />
    </Ink>
  ),
  shield: () => (
    <Ink>
      <path d="M12 2.2 3.6 5.8V12c0 5.2 3.6 8.6 8.4 9.8 4.8-1.2 8.4-4.6 8.4-9.8V5.8Z" fill={BLUE} />
      <path d="M12 2.2v19.6M3.6 11h16.8" stroke={GOLD} stroke-width="1.4" />
      <path d="M5.4 7c1.6-.8 3.4-1.6 5-2.2" fill="none" stroke={BLUE_LT} stroke-width="1" />
    </Ink>
  ),
  return: () => <path d="M10 5 3 11l7 6v-4c4.6 0 8 1.2 11 5-1-5.6-4.5-9.5-11-10Z" fill="currentColor" />,
  trade: () => (
    <Ink>
      <path d="M3 8.4h13.4V5.4l4.6 4.4-4.6 4.4v-3H3Z" fill={GOLD} />
      <path d="M21 15.6H7.6v-3L3 17l4.6 4.4v-3H21Z" fill={GREEN_LT} />
    </Ink>
  ),
  report: () => (
    <Ink>
      <path d="M5 3h11.4l3.6 3.6V21H5Z" fill={PARCH} />
      <path d="M16.4 3v3.6H20" fill={PARCH_DK} />
      <path d="M7.8 9.4h8.4M7.8 12.4h8.4M7.8 15.4h5.2" stroke="#7a5a34" stroke-width="1" />
      <circle cx="16.2" cy="18" r="2.2" fill={RED} />
    </Ink>
  ),
  map: () => (
    <Ink>
      <path d="m2.4 5.6 6.2-2.6 6.8 2.6 6.2-2.6v15.4l-6.2 2.6-6.8-2.6-6.2 2.6Z" fill={PARCH} />
      <path d="M8.6 3v15.4M15.4 5.6V21" stroke={PARCH_DK} stroke-width=".9" />
      <path d="M4.8 15.4c2-.6 3.6-2.4 5.6-2.6s3-2 4.4-3.4" fill="none" stroke={RED} stroke-width="1" stroke-dasharray="1.4 1.2" />
      <path d="m15.2 7.4 2.8 2.8m0-2.8-2.8 2.8" stroke={RED} stroke-width="1.4" />
      <path d="M5 8.4c.8-.8 1.8-.8 2.4 0" fill="none" stroke={GREEN} stroke-width="1.2" />
    </Ink>
  ),
  village: () => (
    <Ink>
      <path d="M11.4 10.4 16.8 5.6l5.4 4.8Z" fill={ROOF_DK} />
      <rect x="12.6" y="10.4" width="8.4" height="9.6" fill={WOOD} />
      <path d="M1.8 12.2 7.6 7l5.8 5.2Z" fill={ROOF} />
      <rect x="3" y="12.2" width="9.2" height="9" fill={STONE} />
      <path d="M6.4 21.2v-4.4h2.4v4.4Z" fill={WOOD_DK} />
      <rect x="15" y="13" width="2.4" height="2.4" fill={GOLD_LT} />
    </Ink>
  ),
  quest: () => (
    <Ink>
      <path d="M5.4 3.4h13.2v18l-6.6-3.8-6.6 3.8Z" fill={RED} />
      <path d="M7.2 5v12.4" stroke={RED_LT} stroke-width="1" />
      <path d="m12 6.4 1.3 2.7 3 .4-2.2 2.1.5 3L12 13.2l-2.6 1.4.5-3-2.2-2.1 3-.4Z" fill={GOLD} stroke-width=".7" />
    </Ink>
  ),
  rank: () => (
    <Ink>
      <rect x="2.4" y="12.6" width="6" height="8.4" fill={STEEL} />
      <rect x="9" y="7.4" width="6" height="13.6" fill={GOLD} />
      <rect x="15.6" y="15" width="6" height="6" fill="#c07a3e" />
      <path d="M12 2.2 12.9 4l2 .3-1.4 1.4.3 2L12 6.8l-1.8.9.3-2-1.4-1.4 2-.3Z" fill={GOLD_LT} stroke-width=".6" />
    </Ink>
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
    <Ink>
      <path d="M4.4 4.4h14v14.8a1.8 1.8 0 0 1-1.8 1.8H4.4Z" fill={PARCH} />
      <path d="M18.4 8h2.8v11a2 2 0 0 1-4 0" fill={PARCH_DK} />
      <rect x="6.6" y="6.8" width="9.6" height="3" fill={RED} stroke-width=".6" />
      <path d="M6.6 12.4h9.6M6.6 15h9.6M6.6 17.6h6" stroke="#7a5a34" stroke-width=".9" />
    </Ink>
  ),
  tribe: () => (
    <Ink>
      <path d="M4 2.5h16v13.5l-8 5.5-8-5.5Z" fill={BLUE} />
      <path d="M4 2.5h16v3H4Z" fill={GOLD} />
      <circle cx="12" cy="9.6" r="2" fill={SKIN} stroke-width=".7" />
      <path d="M8.4 16c0-2.2 1.6-3.8 3.6-3.8s3.6 1.6 3.6 3.8Z" fill={GOLD_LT} stroke-width=".7" />
      <circle cx="7.6" cy="10.8" r="1.4" fill={SKIN} stroke-width=".6" />
      <circle cx="16.4" cy="10.8" r="1.4" fill={SKIN} stroke-width=".6" />
      <path d="M5.4 15.2c0-1.6 1-2.7 2.2-2.7M18.6 15.2c0-1.6-1-2.7-2.2-2.7" fill="none" stroke={GOLD_LT} stroke-width="1.2" />
    </Ink>
  ),
  flag: () => (
    <Ink>
      <rect x="4.8" y="1.6" width="2" height="20.6" rx=".8" fill={WOOD} />
      <path d="M6.8 2.8h12.6l-3 4.2 3 4.2H6.8Z" fill={RED} />
    </Ink>
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
    <Ink>
      <path d="M12 2.8a6 6 0 0 0-6 6v4.6L3.8 17h16.4L18 13.4V8.8a6 6 0 0 0-6-6Z" fill={GOLD} />
      <path d="M8.4 6.4c.8-1.2 2-1.8 3.2-1.8" fill="none" stroke={GOLD_LT} stroke-width="1.2" />
      <circle cx="12" cy="19.4" r="2" fill={GOLD_DK} />
    </Ink>
  ),
  close: () => <path d="m6 4.6 6 6 6-6L19.4 6l-6 6 6 6-1.4 1.4-6-6-6 6L4.6 18l6-6-6-6Z" fill="currentColor" />,
  prev: () => <path d="M15 4 7 12l8 8 1.4-1.4L9.8 12l6.6-6.6Z" fill="currentColor" />,
  next: () => <path d="m9 4 8 8-8 8-1.4-1.4 6.6-6.6-6.6-6.6Z" fill="currentColor" />,
};

// every troop in each village's style: 'spear' is the classic, 'goblin_spear' the goblin one
for (const [u, art] of Object.entries(UNIT_ART) as [UnitId, Art][]) {
  for (const t of ['classic', 'paladin', 'goblin', 'sorcerer', 'druid', 'necromancer'] as VillageTheme[]) paths[t === 'classic' ? u : `${t}_${u}`] = () => art(PAL[t], t);
}

/** The icon name for a troop as a village of this theme fields it (heroes look the same everywhere). */
export const themedUnitIcon = (u: UnitId, t: VillageTheme = 'classic') => (t === 'classic' || !UNIT_ART[u] ? u : `${t}_${u}`);

export function Icon({ name, size = 18, class: cls, title }: { name: IconName | string; size?: number; class?: string; title?: string }) {
  const p = paths[name];
  if (!p) return null;
  return <S size={size} class={cls} title={title}>{p()}</S>;
}

/** every icon name, for the icon sheet in dev */
export const ICON_NAMES = Object.keys(paths);

export const unitIcon = (u: UnitId) => u;
export const buildingIcon = (b: BuildingId) => `b_${b}`;
