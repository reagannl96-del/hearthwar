// Hand-drawn SVG icons in the Tribal Wars manner: small full-colour pictures with
// a dark ink outline and a highlight. Only the control glyphs (play, close, …)
// stay one-colour so they follow the button's text colour.

import type { JSX } from 'preact';
import type { BuildingId, UnitId } from '../../engine/types';
import type { VillageTheme } from '../../engine/data/themes';

type IconName = 'wood' | 'clay' | 'iron' | 'pop' | 'storage' | 'time' | 'points' | 'loyalty' | 'coin' | 'merchant' | 'hide'
  | UnitId | `b_${BuildingId}`
  | 'attack' | 'support' | 'return' | 'report' | 'map' | 'village' | 'quest' | 'rank' | 'settings' | 'overview' | 'pause' | 'play' | 'ff' | 'bell' | 'close' | 'copy' | 'check' | 'link' | 'star' | 'shield' | 'trade' | 'news' | 'prev' | 'next' | 'flag' | 'tribe';

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
  // the clans: blackened iron, war-paint red and tusk ivory on dark timber
  orc: {
    blade: '#858079', bladeLt: '#c4bdb0', bladeDk: '#4a4540', wood: '#6a4226', woodLt: '#9a6a3e', woodDk: '#3a2414',
    accent: '#b02a1e', accentLt: '#e0503a', trim: '#e8dcc0', trimLt: '#fbf3de', trimDk: '#a8977a', gem: '#ff8a2a', roof: '#7a4a2c', shot: '#8e877b',
  },
  // the Frost Queen's north: ice and pale birch, winter-navy cloth, white fur and silver
  frost: {
    blade: '#d6eefc', bladeLt: '#ffffff', bladeDk: '#7fb0d8', wood: '#8e99a8', woodLt: '#c9d3de', woodDk: '#4c586c',
    accent: '#27528f', accentLt: '#6a9bd8', trim: '#f3f1ec', trimLt: '#ffffff', trimDk: '#a9b8c8', gem: '#7fdcff', roof: '#f6f9fc', shot: '#c4e6fa',
  },
  // the Forgelord's dwarves: dark iron and bronze, forge-red, runes glowing like coals
  dwarf: {
    blade: '#a39e96', bladeLt: '#dcd6cc', bladeDk: '#5a5550', wood: '#6e4526', woodLt: '#9e6c3e', woodDk: '#3c2412',
    accent: '#b3402a', accentLt: '#e8703c', trim: '#d4a03c', trimLt: '#f4d27a', trimDk: '#8a6220', gem: '#ff9a2a', roof: '#56504a', shot: '#6a6560',
  },
  // the Djinn's desert: bright steel, turquoise and gold, ruby and sand
  djinn: {
    blade: '#eef1f4', bladeLt: '#ffffff', bladeDk: '#98a2ac', wood: '#9a6436', woodLt: '#c8925a', woodDk: '#5a3818',
    accent: '#17979c', accentLt: '#5cd4d0', trim: '#ecb83a', trimLt: '#ffe38a', trimDk: '#9a7420', gem: '#e0384e', roof: '#17979c', shot: '#f4b82a',
  },
  // the Saurian King's jungle: knapped obsidian, temple gold, jade, and feathers red as blood
  saurian: {
    blade: '#2e2a3a', bladeLt: '#8a84a4', bladeDk: '#16121c', wood: '#7a5430', woodLt: '#a87c48', woodDk: '#44301a',
    accent: '#d8402a', accentLt: '#f5824a', trim: '#e2b23a', trimLt: '#ffe07a', trimDk: '#8e6a18', gem: '#34d07e', roof: '#5f8a3a', shot: '#b8ae90',
  },
};

const BONE = '#e6dfcc', BONE_DK = '#b9b19c', GHOST = '#5cff9a';
// the clans: olive-green hide, tusk ivory, war-paint red, and eyes like coals
const ORC_SKIN = '#5f8c36', ORC_SKIN_LT = '#8fbc58', ORC_SKIN_DK = '#3c5e20', TUSK = '#f3ead2', EMBER = '#ff7a2a';

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

/** a warg: a great dark wolf with a coal-red eye, fangs bared and a scar across the brow */
const WargHead = ({ coat, band, collar }: { coat: string; band?: string; collar?: string }) => (
  <>
    <path d={wolfHead} fill={coat} />
    <path d="M7.6 5.6c.6-1.2 1.6-2 2.8-2.2" fill="none" stroke="#8a7a6a" stroke-width=".9" />
    {band && <path d="M8 13.2c3 .6 6 .2 9-1.4" fill="none" stroke={band} stroke-width="1.5" />}
    {collar && (
      <>
        <path d="M6.4 15.4c2.6 1 5.2 1 7.8 0l-.4 2.4c-2.4.9-4.8.9-7.2 0Z" fill={collar} stroke-width=".8" />
        <path d="m8.4 17.6.2 1.4.8-1.2M11 17.8l.4 1.4.6-1.4" fill={TUSK} stroke-width=".4" />
      </>
    )}
    <path d="M11.4 7.2 14.6 7.9" stroke={O} stroke-width="1.1" />
    <circle cx="13.2" cy="8.8" r=".95" fill={EMBER} stroke-width=".5" />
    <path d="M9.6 9.4 10.6 12" stroke="#c98a7a" stroke-width=".7" />
    <circle cx="22.4" cy="11.8" r=".8" fill={O} />
    <path d="m16.8 14.1.6 1.9.9-2.1M19.3 13.9l.5 1.6.7-1.8" fill={TUSK} stroke-width=".4" />
  </>
);
/** one ivory tusk, curling up out of a lower jaw */
const orcTusk = (x: number, y: number, flip = false) =>
  flip
    ? `M${x} ${y}c.6-1.3.5-2.8-.3-4-1 1-1.6 2.4-1.6 3.8Z`
    : `M${x} ${y}c-.6-1.3-.5-2.8.3-4 1 1 1.6 2.4 1.6 3.8Z`;
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
      ) : t === 'orc' ? (
        // a crude, broad-bladed boar spear hammered out of scrap, with a barb on each side
        <path d="M14.8 7.4 15.4 5 17 4.8 18 3 22 1.8 20.8 5.8 19 6.8 19.2 8.6 16.8 9.2Z" fill={P.blade} />
      ) : (
        <path d="M15.2 5.8 21.8 2.2 18.2 8.8 16.6 9.4 14.6 7.4Z" fill={P.blade} />
      )}
      <path d="m17 6.6 3-2.6" stroke={P.bladeLt} stroke-width="1" />
      <path d="m13.2 8.2 2.6 2.6" stroke={P.accent} stroke-width="1.8" />
      {t === 'druid' && <Leaf x={12.4} y={10.6} r={120} c={P.accentLt} />}
      {t === 'sorcerer' && <Sparkle x={20.4} y={7.4} c={P.gem} />}
      {t === 'necromancer' && <Skull x={5.6} y={16.4} r={1.9} />}
      {t === 'orc' && <path d="M13.4 10.6c-1.2 1.2-1.4 2.8-.8 4.2.8-1.2 1.6-2.2 2.6-2.8Z" fill={TUSK} stroke-width=".6" />}
      {t === 'orc' && <path d="M12.8 9.6C11.2 9.8 9.8 9 9 7.6c1.4.2 2.6 0 3.6-.8Z" fill={P.accent} stroke-width=".6" />}
    </Ink>
  ),
  sword: (P, t) =>
    t === 'orc' ? (
      // a cleaver: a slab of black iron with a hole in the spine, blooded along the edge
      <Ink>
        <path d="M8.8 14.4 3.6 19.6" stroke={O} stroke-width="3.4" />
        <path d="M8.8 14.4 3.6 19.6" stroke={P.woodLt} stroke-width="1.8" />
        <path d="m5.8 16.6 1.2 1.2M4.4 18 5.6 19.2" stroke={P.accent} stroke-width="1" />
        <circle cx="3.2" cy="20.4" r="1.5" fill={TUSK} />
        <path d="M6.4 11.6 15.4 2.6 21 7.4C19.4 10.4 15 14.8 11.6 16.8Z" fill={P.blade} stroke-width="1.1" />
        <path d="M7.8 11.6 15.4 4" stroke={P.bladeDk} stroke-width=".8" />
        <path d="M12.2 15.2C15 13.4 18.4 10 19.6 7.8" fill="none" stroke={P.bladeLt} stroke-width="1" />
        <circle cx="15.8" cy="5.4" r="1.1" fill={O} stroke="none" />
        <path d="m15.4 13.6-.7-.7M18.2 10.6l-.7-.7" stroke={O} stroke-width=".9" />
        <path d="M13 16.4c.4.8.4 1.6-.2 2.2-.4-.6-.4-1.4.2-2.2ZM16.8 13.2c.3.6.3 1.2-.1 1.6-.3-.4-.3-1 .1-1.6Z" fill={P.accentLt} stroke-width=".5" />
      </Ink>
    ) : (
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
    t === 'orc' ? (
      // a berserker's double-bitted war-axe, notched and blooded, a tusk spike on top
      <Ink>
        <g transform="rotate(45 12 12)">
          <path d="M11.1 1.6 12 -1 12.9 1.6Z" fill={TUSK} stroke-width=".7" />
          <rect x="11.1" y="1.4" width="1.8" height="24" rx=".6" fill={P.woodLt} />
          <path d="M12.8 4.6C15 4.4 16.6 3.4 17.6 2.2 19.8 4.6 20.2 8.6 18.6 11.6 17.2 10.4 15 9.8 12.8 9.8Z" fill={P.blade} />
          <path d="M11.2 4.6C9 4.4 7.4 3.4 6.4 2.2 4.2 4.6 3.8 8.6 5.4 11.6 6.8 10.4 9 9.8 11.2 9.8Z" fill={P.blade} />
          <path d="M18.2 3.8c1.2 2 1.4 4.4.6 6.4M5.8 3.8c-1.2 2-1.4 4.4-.6 6.4" fill="none" stroke={P.bladeLt} stroke-width=".9" />
          <path d="m19.6 6.2-1 .2M4.4 7.6l1 .2" stroke={O} stroke-width=".9" />
          <path d="M10.8 11.2h2.4v2.2h-2.4Z" fill={P.accent} stroke-width=".7" />
          <path d="M18.8 9.4c.8.4 1 1.2.6 1.8-.6-.2-.8-1-.6-1.8Z" fill={P.accentLt} stroke-width=".4" />
        </g>
      </Ink>
    ) : t === 'sorcerer' ? (
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
      {t === 'orc' && (
        // horn nocks and a red-bound grip
        <>
          <path d="M5.6 2.8C4.6 2.2 4.2 1.2 4.6.4c1 .2 1.8 1 2 2Z" fill={TUSK} stroke-width=".6" />
          <path d="M5.6 21.2c-1 .6-1.4 1.6-1 2.4 1-.2 1.8-1 2-2Z" fill={TUSK} stroke-width=".6" />
          <path d="M10.2 9.8h3.2v4.4h-3.2Z" fill={P.accent} stroke-width=".6" />
        </>
      )}
      <path d="M3 12h15.4" stroke={P.woodDk} stroke-width="1.4" />
      {t === 'orc' ? (
        <path d="M17.2 8.8 22.4 12l-5.2 3.2 1.4-3.2Z" fill={P.blade} />
      ) : (
        <path d="M17.6 9.2 22 12l-4.4 2.8Z" fill={t === 'sorcerer' ? P.gem : P.blade} />
      )}
      <path d="M2 10.2 4.2 12 2 13.8" fill="none" stroke={P.accent} stroke-width="1.3" />
      {t === 'druid' && <Leaf x={10.4} y={4.2} r={40} c={P.accentLt} />}
      {t === 'goblin' && <path d="M9.6 5.6 11.4 5M10.4 18.4l1.8.6" stroke={P.accent} stroke-width="1.4" />}
      {t === 'sorcerer' && <Sparkle x={20.6} y={7} c={P.gem} />}
      {t === 'necromancer' && <path d="M18.6 12h3" stroke={GHOST} stroke-width=".8" />}
    </Ink>
  ),
  scout: (P, t) =>
    t === 'orc' ? (
      // a warg on the prowl, in a spiked red collar
      <Ink>
        <WargHead coat="#5a4a3e" collar={P.accent} />
      </Ink>
    ) : t === 'necromancer' ? (
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
    t === 'orc' ? (
      <Ink>
        <Lance shaft={P.woodLt} flag={P.accent} tip={P.blade} />
        <WargHead coat="#4e4038" band={P.accent} />
      </Ink>
    ) : t === 'necromancer' ? (
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
        ) : t === 'orc' ? (
          <WargHead coat="#3e342e" band={P.accentLt} />
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
    t === 'orc' ? (
      // a war boar in a spiked iron faceplate, great tusks up, behind a hide-and-iron buckler
      <Ink>
        <path d={boarHead} fill="#4a3428" />
        <path d="M7 5.2 8.2 2.6M9.6 4.2l.8-2.6" stroke={O} stroke-width="1.1" />
        <path d="M8.6 6.4c2.8-1 6.2-.4 8.8 1.8l-1.6 3.2-6.8.6c-.9-1.8-1-3.8-.4-5.6Z" fill={P.blade} />
        <path d="M12.2 5.8 13.2 1.8 14.4 6.2Z" fill={P.bladeLt} stroke-width=".7" />
        <path d="M9.6 7.4c1.8-.6 4-.4 5.8.6" fill="none" stroke={P.bladeLt} stroke-width=".8" />
        <circle cx="10.2" cy="10.4" r=".45" fill={O} stroke="none" />
        <circle cx="15.4" cy="10" r=".45" fill={O} stroke="none" />
        <ellipse cx="22" cy="11.9" rx="1" ry="2.2" fill="#b57a6a" stroke-width=".8" />
        <circle cx="16.8" cy="9.4" r=".9" fill={EMBER} stroke-width=".5" />
        <path d="M18 14.6c2.6.4 4.6-1 5.4-4.6.4 2.8-.6 5.6-3.2 6.6-1 .4-1.8.2-2.2-.4Z" fill={TUSK} stroke-width=".8" />
        <path d="M8 13.6 13.6 12.8" stroke={P.accent} stroke-width="1.4" />
        <circle cx="5.2" cy="17.6" r="4.2" fill={P.woodLt} stroke-width="1.1" />
        <path d="M2.6 15.2 7.8 20" stroke={P.accent} stroke-width="1.5" />
        <circle cx="5.2" cy="17.6" r="3.3" fill="none" stroke={P.bladeDk} stroke-width=".8" />
        <circle cx="5.2" cy="17.6" r="1.5" fill={P.blade} stroke-width=".7" />
      </Ink>
    ) : t === 'necromancer' ? (
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
  ram: (P, t) =>
    t === 'orc' ? (
      // the battering tusk: a hide-roofed log shod in iron, with one great tusk for a head
      <Ink>
        <path d="M3.4 10 10.6 4.2 17.8 10Z" fill={P.roof} />
        <path d="M6.4 10 10.6 5.6 14.8 10" fill="none" stroke={TUSK} stroke-width=".9" />
        <path d="M10 4.8 10.6 1.4 11.2 4.8Z" fill={TUSK} stroke-width=".7" />
        <path d="M4 10.8 2 7.8l3 .6" fill={P.accent} stroke-width=".7" />
        <path d="M3.4 10h14.4v3H3.4Z" fill={P.woodDk} />
        <rect x="1.4" y="11" width="17.6" height="3.6" rx="1.6" fill={P.wood} />
        <path d="M3 12h13.4" stroke={P.woodLt} stroke-width=".9" />
        <path d="M5.4 11v3.6M9.6 11v3.6" stroke={P.bladeDk} stroke-width="1.2" />
        <path d="M17 10.4c1.8-.8 3.6-.6 4.6.6l.8 1.8-.8 1.8c-1 1.2-2.8 1.4-4.6.6Z" fill={P.blade} />
        <circle cx="19.2" cy="12" r=".6" fill={EMBER} stroke-width=".4" />
        <path d="M20.2 14.4c1.8-.2 2.8-1.8 3-4.4.8 1.8.6 4.2-.8 5.6-.8.6-1.6.4-2.2-.2Z" fill={TUSK} stroke-width=".8" />
        <circle cx="6" cy="18" r="2.8" fill={P.woodLt} />
        <circle cx="16" cy="18" r="2.8" fill={P.woodLt} />
        <circle cx="6" cy="18" r="1.2" fill="none" stroke={P.woodDk} stroke-width=".7" />
        <circle cx="16" cy="18" r="1.2" fill="none" stroke={P.woodDk} stroke-width=".7" />
      </Ink>
    ) : (
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
      {t === 'orc' ? (
        // a jagged boulder, torn out of a hillside
        <>
          <path d="M15.4 3.6 16.8 1.4 19.6.8 22.2 2.2 22.6 5 20.4 6.8 17.4 6.6Z" fill={P.shot} />
          <path d="M17 2.2 19.4 1.8M20.4 4.4l1.2-.4" fill="none" stroke="#c4bcae" stroke-width=".8" />
          <path d="m17.6 4.4 1.2.8" stroke={O} stroke-width=".7" />
        </>
      ) : t === 'goblin' ? (
        <path d="M16.2 2.2h4.6v3.8h-4.6Z" fill={P.shot} />
      ) : (
        <circle cx="18.6" cy="3.6" r="2.6" fill={P.shot} />
      )}
      {t === 'goblin' && <path d="M16.2 4.1h4.6" stroke={P.bladeDk} stroke-width=".8" />}
      {t === 'sorcerer' && <circle cx="17.9" cy="2.9" r=".8" fill="#fff" stroke="none" />}
      {t === 'druid' && <path d="M16.4 2.6c1.2-1.2 3-1.2 4.2 0" fill="none" stroke={P.accentLt} stroke-width="1.2" />}
      {t === 'necromancer' && <><circle cx="17.7" cy="3.6" r=".55" fill="#1a1414" stroke="none" /><circle cx="19.5" cy="3.6" r=".55" fill="#1a1414" stroke="none" /></>}
      <path d="M10 15.6 12.6 9h1.8l-1.6 6.6Z" fill={P.woodDk} />
      {t === 'orc' && <path d="m11.2 10.4 2.4 1.6M10.6 11.4l2.4 1.6" stroke={P.accent} stroke-width="1" />}
      <rect x="2" y="15" width="17" height="3" rx=".8" fill={P.wood} />
      <circle cx="5" cy="19.6" r="2.2" fill={P.woodLt} />
      <circle cx="16" cy="19.6" r="2.2" fill={P.woodLt} />
      {t === 'orc' && <path d="M2.4 16.4h1.4M17.4 16.4h1.2" stroke={TUSK} stroke-width="1" />}
    </Ink>
  ),
  noble: (P, t) => (
    <Ink>
      {t === 'orc' ? (
        // the warchief's crown of tusks: five great tusks set in a black iron band
        <>
          <path d="M2.8 17.6C1.8 14.8 1.6 11.8 2.4 8.8 3.8 11.2 5 14.2 5.6 17.6Z" fill={P.trim} />
          <path d="M21.2 17.6C22.2 14.8 22.4 11.8 21.6 8.8 20.2 11.2 19 14.2 18.4 17.6Z" fill={P.trim} />
          <path d="M6.6 17.6C6.2 14 6.8 10.4 8.6 6.8 9 10.6 9.4 14.2 9.6 17.6Z" fill={P.trim} />
          <path d="M17.4 17.6C17.8 14 17.2 10.4 15.4 6.8 15 10.6 14.6 14.2 14.4 17.6Z" fill={P.trim} />
          <path d="M10.6 17.6C10.4 12.8 10.8 8.4 12 3.6 13.2 8.4 13.6 12.8 13.4 17.6Z" fill={P.trimLt} />
          <path d="M3.4 16.4c-.4-1.6-.6-3.4-.4-5.2M7.8 16.4c-.2-2-.1-4 .4-6M11.6 16.4c-.2-2.6-.1-5.4.4-8.2M16.2 16.4c.2-2 .1-4-.4-6M20.6 16.4c.4-1.6.6-3.4.4-5.2" fill="none" stroke={P.trimDk} stroke-width=".7" />
        </>
      ) : t === 'necromancer' ? (
        // a lich's crown of black iron spikes
        <path d="M2.8 17.8 3.6 6.4 7 12 8.6 3.6 12 11 15.4 3.6 17 12l3.4-5.6.8 11.4Z" fill="#2e2a33" />
      ) : t === 'druid' ? (
        // an elder's crown of antler and leaf
        <path d="M2.8 17.8 3.4 9 6 11.6 5.4 6.8 8.6 11 12 4.4l3.4 6.6 3.2-4.2-.6 4.8 2.6-2.6.6 8.8Z" fill={P.woodLt} />
      ) : t === 'goblin' ? (
        // a goblin chief's crown: bent, dented, one spike snapped off
        <path d="M2.6 18.2 3.4 8.6 7.4 12.6 9.8 5.6 12.8 11 14.6 9.4l3.4 3.2 3.6-5.2-.4 10.8Z" fill={P.trim} transform="rotate(-6 12 12)" />
      ) : t === 'paladin' ? (
        // the Order's crown: a circlet rising to a cross, a sun at its heart
        <><path d="M2.8 17.8 4.2 9.4l3.6 3.4L12 7l4.2 5.8 3.6-3.4 1.4 8.4Z" fill={P.trim} /><path d="M11 2.2h2v6h-2Z M9.2 4h5.6v1.8H9.2Z" fill={P.trimLt} /><circle cx="12" cy="13.4" r="1.9" fill="#ffd35a" /></>
      ) : (
        <path d="M2.8 17.8 4.6 7l4.3 5.1L12 5.2l3.1 6.9L19.4 7l1.8 10.8Z" fill={P.trim} />
      )}
      <path d="M2.4 17.4h19.2v3.6H2.4Z" fill={t === 'druid' ? P.trim : t === 'orc' ? P.bladeDk : P.trimDk} />
      <circle cx="12" cy="19.2" r="1.1" fill={t === 'classic' ? RED : P.gem} />
      <circle cx="6.4" cy="19.2" r=".9" fill={t === 'classic' ? BLUE_LT : t === 'orc' ? P.blade : P.accentLt} />
      <circle cx="17.6" cy="19.2" r=".9" fill={t === 'classic' ? BLUE_LT : t === 'orc' ? P.blade : P.accentLt} />
      {t === 'orc' ? (
        <path d="M3.2 18.4h1.6M19.2 18.4h1.6M8.4 18.4h1.6M14 18.4h1.6" stroke={P.accent} stroke-width="1" />
      ) : t === 'druid' ? (
        <><Leaf x={7} y={17.4} r={-60} c={P.trimLt} /><Leaf x={15.4} y={16.6} r={-120} c={P.trimLt} /></>
      ) : t === 'necromancer' ? (
        <Skull x={12} y={14.2} r={2} />
      ) : t === 'paladin' ? (
        <><circle cx="4.2" cy="9.4" r="1.1" fill={P.trimLt} /><circle cx="19.8" cy="9.4" r="1.1" fill={P.trimLt} /></>
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
  // Horse merchants: every realm hauls its goods its own way
  trader: (P, t) =>
    t === 'sorcerer' ? (
      // a spellbound wagon: no wheels, no horse, just a crate of goods riding on violet light
      <Ink>
        <ellipse cx="11.6" cy="21.2" rx="8.4" ry="1.6" fill="#8fb8ff" stroke="none" opacity=".55" />
        <path d="M5.2 19.6c1.8.8 3.8.8 5.6 0M12.6 19.6c1.8.8 3.8.8 5.6 0" fill="none" stroke={P.gem} stroke-width=".8" />
        <path d="M3 11.4h17.2l-1.4 6.4H4.4Z" fill={P.wood} />
        <path d="M4.2 13.6h14.8" stroke={P.woodLt} stroke-width=".9" />
        <path d="M6.4 11.4c0-3 1.8-5 4.2-5s4.2 2 4.2 5Z" fill="#d8c08a" />
        <path d="M11.8 11.4c0-2.2 1.2-3.8 3-3.8s3 1.6 3 3.8Z" fill="#c9ad72" />
        <path d="M20.2 11.4 22 7.4" stroke={P.woodDk} stroke-width="1.2" />
        <path d="M21 5.2 22.6 7.2 21 9.4 19.4 7.2Z" fill={P.gem} stroke-width=".7" />
        <path d="M8.8 15.6h.01M11.6 15.6h.01M14.4 15.6h.01" stroke={P.gem} stroke-width="1.4" />
        <Sparkle x={3.4} y={6.8} c={P.gem} />
        <Sparkle x={17.6} y={3.2} />
      </Ink>
    ) : t === 'goblin' ? (
      // a goblin hauling a stolen loot sack on a crude one-wheeled cart
      <Ink>
        <path d="M2 16.4h10.4" stroke={P.woodDk} stroke-width="1.6" />
        <path d="M2.4 16C1.2 11.6 3 6.6 7.2 6.6s6 4.8 4.8 9.4Z" fill="#b89560" />
        <path d="M5.4 7.2 6.6 4.6h1.8l1 2.6" fill="#b89560" stroke-width=".8" />
        <path d="M5.8 11.8 9.2 9.8M5.4 13.8h4.4" stroke="#7a5a30" stroke-width=".8" />
        <circle cx="4.6" cy="4.4" r="1.2" fill={P.trimLt} stroke-width=".6" />
        <circle cx="7" cy="19" r="3" fill={P.wood} />
        <path d="M4.4 19h5.2M7 16.4v5.2" stroke={P.woodDk} stroke-width=".8" />
        <path d="m11.6 15.4 5-2.6" stroke={P.woodDk} stroke-width="1.1" />
        <path d="M15.4 22 16.6 15.6 20 15.4 21 22Z" fill={P.accent} />
        <path d="m16.6 15.6-2.4-2" stroke="#6f9a3a" stroke-width="1.6" />
        <circle cx="18.4" cy="11.4" r="3" fill="#7ea64a" />
        <path d="M15.6 10.4 12.8 8.6l2.8.2M21.2 10.4l2.6-1.8-2.4 0" fill="#7ea64a" stroke-width=".7" />
        <circle cx="17.4" cy="11" r=".6" fill="#f4e04a" stroke="none" />
        <circle cx="19.4" cy="11" r=".6" fill="#f4e04a" stroke="none" />
        <path d="M17.2 12.8h2.4" stroke={O} stroke-width=".6" />
      </Ink>
    ) : t === 'orc' ? (
      // a pack boar: a shaggy tusker with hide bundles roped across its back
      <Ink>
        <g transform="translate(4.4 .8) scale(.84)">
          <path d={boarHead} fill="#7a5638" />
          <path d="M7 5.2 8.2 2.6M9.6 4.2l.8-2.6M12.2 4l.4-2.4" stroke={O} stroke-width="1.1" />
          <path d="M8.6 7c1.6-1 3.6-1.4 5.4-1" fill="none" stroke="#a8805a" stroke-width="1" />
          <ellipse cx="22" cy="11.9" rx="1" ry="2.2" fill="#c98a7a" stroke-width=".8" />
          <path d="M19.4 14.4c1.8 0 3-1.2 3.4-3.4.6 2.2-.2 4.2-2 4.8-.6.2-1.2 0-1.4-.4Z" fill={TUSK} stroke-width=".7" />
          <Eye x={14.4} y={9} />
        </g>
        <path d="M1.2 13.8c0-1.8 1.4-3 3.2-3h4.2c1.8 0 3 1.2 3 3v5.4c0 1.6-1.2 2.8-2.8 2.8H4c-1.6 0-2.8-1.2-2.8-2.8Z" fill="#b08456" />
        <path d="M2.8 13.2c.6-.8 1.4-1.2 2.4-1.2" fill="none" stroke="#d8b07e" stroke-width=".9" />
        <path d="M1.4 15.8h10.2M6.6 10.8v11.2" stroke={P.accent} stroke-width="1.2" />
        <path d="M3.2 9.6 8.8 8.2" stroke={O} stroke-width="2.6" />
        <path d="M3.2 9.6 8.8 8.2" stroke={TUSK} stroke-width="1.2" />
        <circle cx="2.9" cy="9.7" r="1" fill={TUSK} stroke-width=".6" />
        <circle cx="9.1" cy="8.1" r="1" fill={TUSK} stroke-width=".6" />
      </Ink>
    ) : t === 'necromancer' ? (
      // a skeletal horse drawing a cart of bones
      <Ink>
        <g transform="translate(6.6 1.4) scale(.74)"><BoneHorse /></g>
        <path d="M1.4 12.4h9.6l-.8 5.2H2.2Z" fill="#3a3230" />
        <path d="M2.6 12.4c0-2 1-3 2.4-3M5.6 12.4c0-2.4 1.2-3.6 2.8-3.6M8.4 12.4c0-1.8.8-2.8 2-2.8" fill="none" stroke={BONE} stroke-width="1.1" />
        <Skull x={5.8} y={14.6} r={1.3} />
        <path d="M10.4 15.2 13 14.6" stroke={BONE_DK} stroke-width="1" />
        <circle cx="5.6" cy="19.4" r="2.6" fill="#2e2a33" />
        <path d="M3.4 18 7.8 20.8M3.4 20.8 7.8 18" stroke={BONE} stroke-width=".7" />
        <circle cx="5.6" cy="19.4" r=".6" fill={GHOST} stroke="none" />
      </Ink>
    ) : t === 'druid' ? (
      // a stag courier: antlers, and leafy saddlebags slung over the withers
      <Ink>
        <g transform="translate(4 1.6) scale(.86)">
          <Antlers c={P.woodLt} />
          <path d={horseHead} fill="#a8703e" />
          <path d="M17.6 10.8c1.4-.2 2.4.2 3 1.4" fill="none" stroke="#efe0c0" stroke-width="1.4" />
          <Eye x={12.6} y={8.4} />
        </g>
        <path d="M1.6 14c0-1.6 1.2-2.6 2.8-2.6h3.4c1.6 0 2.8 1 2.8 2.6v5.4c0 1.4-1 2.4-2.4 2.4H4c-1.4 0-2.4-1-2.4-2.4Z" fill={P.accent} />
        <path d="M1.8 15.4h8.6" stroke={P.woodDk} stroke-width="1" />
        <circle cx="6" cy="15.4" r=".8" fill={P.gem} stroke-width=".5" />
        <Leaf x={3.2} y={19.4} r={-30} c={P.accentLt} />
        <Leaf x={7.2} y={12.2} r={-80} c={P.trimLt} />
      </Ink>
    ) : t === 'paladin' ? (
      // the royal quartermaster's horse: blue barding trimmed in gold, a supply chest bearing the sun
      <Ink>
        <g transform="translate(4 .4) scale(.86)">
          <path d={horseHead} fill="#e8e2d6" />
          <path d="M6 22 7.4 15c2.8 1 6.2.9 9.4-.9L13.6 22Z" fill={P.accent} />
          <path d="M7.4 15c2.8 1 6.2.9 9.4-.9" fill="none" stroke={P.trim} stroke-width="1.1" />
          <path d="M8.4 5.8 11.2 5c.8 1.8.6 3.4-.4 4.6L8.2 9.2Z" fill={P.bladeDk} stroke-width=".8" />
          <Eye x={12.6} y={8.4} />
        </g>
        <rect x="1.2" y="14.2" width="8.8" height="7.6" rx=".8" fill={P.accent} />
        <path d="M1.2 16.4h8.8" stroke={P.trim} stroke-width="1.2" />
        <circle cx="5.6" cy="19.2" r="1.6" fill="#ffd35a" stroke-width=".7" />
      </Ink>
    ) : (
      // a horse merchant: a sturdy horse with bales of goods roped on
      <Ink>
        <g transform="translate(4 .6) scale(.86)">
          <path d={horseHead} fill="#9a5f2e" />
          <path d="M8.2 6.2c1.8-.2 3.6.2 4.8 1.2M16.2 12.6l-3.4-1.4" fill="none" stroke={WOOD_DK} stroke-width="1" />
          <Eye x={12.6} y={8.4} />
        </g>
        <path d="M1.4 13.6c0-1.6 1.2-2.8 2.8-2.8h4.4c1.6 0 2.8 1.2 2.8 2.8v5.8c0 1.4-1 2.4-2.4 2.4H3.8c-1.4 0-2.4-1-2.4-2.4Z" fill="#d8c08a" />
        <path d="M4.6 10.8 5.6 8.6h1.6l1 2.2" fill="#c9ad72" stroke-width=".8" />
        <path d="M1.6 15.2h9.6M6.4 10.8v11" stroke={WOOD_DK} stroke-width="1" />
        <circle cx="16.8" cy="19.6" r="2" fill={GOLD} stroke-width=".8" />
        <path d="M16.8 18.4v2.4" stroke={GOLD_DK} stroke-width=".8" />
      </Ink>
    ),
};

// ---- the wilds: four peoples who answer only their own lands ----
// Each draws its whole army its own way (no shared silhouettes with the realms above):
// the Frost Queen's court in ice, birch and fur on white wolves and mammoths; the
// Forgelord's dwarves in iron and bronze with runes like live coals, on goats and
// war-rams; the Djinn's host in steel, turquoise and gold on camels; the Saurian
// King's cold-blooded warband in obsidian, jade and feathers on raptors.

const ICE = '#cdeafb', ICE_LT = '#f5fcff', ICE_DK = '#86b8de', ICE_SHADE = '#a8d2f0', FUR = '#f4f1ea', FUR_DK = '#b3ac9e';
const BIRCH = '#eee9de', BIRCH_DK = '#5e564c', SNOWWOLF = '#eef3f7', MAMMOTH = '#7a5234', MAMMOTH_LT = '#a8784e', MAMMOTH_DK = '#4e3220';
const BRONZE = '#c9893a', BRONZE_LT = '#ecb86a', RUNE = '#ff9a2a', RUNE_LT = '#ffe08a', IRON = '#5c5650', IRON_LT = '#8f8a82';
const BEARD = '#b9572a', BEARD_LT = '#e08a4e', BEARD_DK = '#7a3416', GREYBEARD = '#e4dfd4', GREYBEARD_DK = '#a39c8e';
const GOAT = '#8e7a62', GOAT_DK = '#6e5c48', RAM_WOOL = '#6e5846', HORN = '#dccfae';
const LINEN = '#f7f1e3', SAND_DK = '#b8975a', CAMEL = '#c9955a', CAMEL_LT = '#e8c08a', CAMEL_DK = '#8a5c30';
const DJINN = '#3f86d8', DJINN_LT = '#8ac0f4', DJINN_DK = '#23559c';
const SCALE = '#5f9a3a', SCALE_LT = '#9acb5a', SCALE_DK = '#35601f', BELLY = '#ead9a0', JADE = '#34c07a', QUETZAL = '#1f9e6e', PLUME = '#2f78c8', MAW = '#7a2016';

const f2 = (n: number) => Math.round(n * 100) / 100;
/** a six-armed snowflake; drawn big, each arm grows two little branches */
function flakePath(x: number, y: number, r: number, branches: boolean) {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3, dx = Math.sin(a), dy = -Math.cos(a);
    d += `M${f2(x)} ${f2(y)}L${f2(x + dx * r)} ${f2(y + dy * r)}`;
    if (branches) {
      const px = x + dx * r * 0.58, py = y + dy * r * 0.58;
      for (const s of [-1, 1]) {
        const b = a + (s * Math.PI) / 4;
        d += `M${f2(px)} ${f2(py)}L${f2(px + Math.sin(b) * r * 0.34)} ${f2(py - Math.cos(b) * r * 0.34)}`;
      }
    }
  }
  return d;
}
const Snowflake = ({ x, y, r = 1.8, c = ICE_LT }: { x: number; y: number; r?: number; c?: string }) => {
  const d = flakePath(x, y, r, r >= 2.6);
  return (
    <>
      <path d={d} fill="none" stroke={O} stroke-width={f2(Math.max(1.4, r * 0.6))} />
      <path d={d} fill="none" stroke={c} stroke-width={f2(Math.max(0.6, r * 0.24))} />
    </>
  );
};
/** an n-pointed star (the desert's eight-pointed star, a sun's rays) */
function starPath(x: number, y: number, R: number, r: number, n: number) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (i * Math.PI) / n, k = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${f2(x + Math.sin(a) * k)} ${f2(y - Math.cos(a) * k)}`;
  }
  return `${d}Z`;
}
/** a feather, quill at (x, y), pointing along a (degrees clockwise from straight up) */
const Feather = ({ x, y, a, len, c, w = 1.2 }: { x: number; y: number; a: number; len: number; c: string; w?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${a})`}>
    <path d={`M0 0C${-w} ${f2(-len * 0.3)} ${-w} ${f2(-len * 0.72)} 0 ${-len}C${w} ${f2(-len * 0.72)} ${w} ${f2(-len * 0.3)} 0 0Z`} fill={c} stroke-width=".6" />
    <path d={`M0 ${f2(-len * 0.12)}V${f2(-len * 0.82)}`} stroke={O} stroke-width=".35" />
  </g>
);
/** a rune cut into iron or bronze, glowing like a coal */
const Rune = ({ d, w = 0.8 }: { d: string; w?: number }) => (
  <>
    <path d={d} fill="none" stroke={RUNE_LT} stroke-width={f2(w + 1.2)} opacity=".45" />
    <path d={d} fill="none" stroke={RUNE} stroke-width={w} />
  </>
);
/** a flickering flame, base at (x, y) */
const Flame = ({ x, y, s = 1, c = '#f0a030' }: { x: number; y: number; s?: number; c?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M0 0C-1.8-.4-2.6-2-2-3.6c.4 .6 .8.8 1.2.6-.2-1.4.4-2.8 1.8-3.6-.2 1 .2 1.8.8 2.4 1 .8 1.4 2 .8 3.2C2 -.2 1.2.2 0 0Z" fill={c} stroke-width=".7" />
    <path d="M.2-1c-.8-.4-1-1.2-.6-2 .2.6.6.8 1 .6" fill="none" stroke="#fde38a" stroke-width=".7" />
  </g>
);

// more mounts, all facing right like the horse
const goatHead = 'M5.4 22 6.8 14.4C5.4 12.2 5.6 9 7.6 7 9.4 5.2 12 4.6 14.2 5.4L18.8 8C20.4 8.8 21.6 10.2 21.8 11.6 22 12.8 21.2 13.6 20 13.6L17.4 13.4 15 14.4 13.4 22Z';
const warRamHead = 'M4.8 22 6.2 14.6C4.4 12.4 4.6 8.6 7 6.4 9.2 4.4 12.6 4 15.4 5.2L19.8 8C21.4 9 22.2 10.8 21.8 12.4 21.4 13.8 20.2 14.6 18.8 14.4L15.8 13.8 14 22Z';
const ramHorn = 'M12.6 5.6C9.2 3.8 5.2 5.4 4.6 9c-.6 3.2 1.6 5.8 4.6 5.8 2.6 0 4.2-2 3.8-4.2-.4-1.8-2-2.8-3.6-2.4-1.4.4-2 1.8-1.4 3';
const camelHead = 'M4 23C4 18.4 5.4 14.6 8 11.6 9.6 9.8 10.6 7.8 11.4 5.6 12 4 13.4 3 15 3.2L15.6 1.8 16.6 3.4C18.8 3.6 21 4.6 22.4 5.8 23.4 6.8 23.6 8.2 23 9.2L22.6 10.4C22 11.2 21 11.4 20.2 11L18.4 10.4 16.2 10C14.6 10.8 13.6 12.8 13.2 15.4L12.6 23Z';
const raptorHead = 'M5.4 22 6.4 14.6C4.8 12 5.2 8.4 7.6 6.2 10 4 13.8 3.8 17 5L21.8 7.4C22.8 8 23 9.2 22.4 10L21.2 11 17.8 11.4 18 12.4 21 12.8C20.4 14 19 14.8 17.4 14.6L14.6 14.2 13 22Z';
const lizardHead = 'M5 22.4 6 14.8C4.4 12.4 4.8 9 7.2 7 9.6 5 13.4 4.8 16.4 5.8L21 7.6C22.4 8.2 23 9.6 22.6 11L22 12.6 17.4 13.2C16.4 14.6 15.2 15.4 13.8 15.6L13 22.4Z';

/** a white wolf of the north, eyes like blue ice */
const SnowWolf = ({ band }: { band?: string }) => (
  <>
    <path d={wolfHead} fill={SNOWWOLF} />
    <path d="M10.2 4.4 11.4 3l.5 1.9Z" fill="#9fb6cc" stroke-width=".4" />
    <path d="M9.4 14.8c1-1.6 2.8-2.4 4.8-2.2M6.8 13c.6-1.2 1.4-2 2.4-2.4" fill="none" stroke="#b6c4d2" stroke-width=".9" />
    {band && <path d="M8 13.2c3 .6 6 .2 9-1.4" fill="none" stroke={band} stroke-width="1.5" />}
    <path d="M11.6 7.4 14.4 8" stroke={O} stroke-width=".9" />
    <circle cx="13.1" cy="8.8" r=".95" fill="#3fb4f4" stroke-width=".5" />
    <circle cx="22.4" cy="11.8" r=".8" fill={O} />
    <path d="m17.6 14.2.4 1.4.8-1.6M19.6 14l.4 1.2.6-1.4" fill="#fff" stroke-width=".4" />
  </>
);
/** a reindeer: great swept antlers, a pale muzzle and a white ruff, a bell at the throat */
const Reindeer = ({ band }: { band: string }) => (
  <>
    <path d="M10.4 5C9.6 3 7.8 1.6 5.2 1.2M8.4 3.2 8.6.6M6.8 2.1 6-.2M10.8 4.8c.8-1.4 1.8-2.4 3-3M12.6 3.4 12.6.8" fill="none" stroke={O} stroke-width="2.2" />
    <path d="M10.4 5C9.6 3 7.8 1.6 5.2 1.2M8.4 3.2 8.6.6M6.8 2.1 6-.2M10.8 4.8c.8-1.4 1.8-2.4 3-3M12.6 3.4 12.6.8" fill="none" stroke="#eadfc4" stroke-width="1" />
    <path d={horseHead} fill="#8a6c52" />
    <path d="M7.3 15.2c2.4 1 5.2 1 7.8-.2l-.4 2.4c-2.4 1-5 1-7.8.2Z" fill={FUR} stroke-width=".8" />
    <path d="M17.4 10.4c1.6.2 2.8 1 3.2 2.2l-1.9 2.2-2.6-1.4Z" fill="#e6ddd0" stroke-width=".7" />
    <path d="M8.2 12.4c3 .6 6.2.2 9.4-1.6" fill="none" stroke={band} stroke-width="1.4" />
    <circle cx="11.2" cy="14.2" r="1.1" fill={GOLD} stroke-width=".6" />
    <Eye x={12.6} y={8.4} />
  </>
);
/** a mountain goat: long horns swept back, a beard at the chin, a bronze browband */
const GoatHead = ({ coat, band }: { coat: string; band: string }) => (
  <>
    <path d="M9 6.6C8.4 4 6.8 2.2 4.4 1.6c-.8-.2-1.4.2-1.4 1 2 .6 3.4 2.4 3.8 5Z" fill="#b8ab90" />
    <path d={goatHead} fill={coat} />
    <path d="M11.8 6.2C11.2 3.4 9.4 1.2 6.6.6c-.9-.2-1.6.3-1.5 1.1 2.4.6 4.2 2.6 4.8 5.4Z" fill={HORN} />
    <path d="M9.2 3.4l.9-.7M7.8 2.4l.6-.9M10.4 4.8l1-.5" stroke={O} stroke-width=".55" />
    <path d="M8.6 8.6C7 8.4 5.6 9 4.8 10.2c1.4.4 2.8.2 4.2-.6Z" fill={coat} stroke-width=".7" />
    <path d="M17.2 13.4c.6 1.8.4 3.6-.6 5-.8-1.4-1.6-3-1.6-4.8Z" fill="#4e3e2e" stroke-width=".7" />
    <path d="M9.4 12.4c2.8.4 5.8 0 8.6-1.4" fill="none" stroke={band} stroke-width="1.5" />
    <circle cx="13.6" cy="8.6" r="1" fill="#e8c24a" stroke-width=".5" />
    <path d="M13 8.6h1.2" stroke={O} stroke-width=".55" />
    <path d="M20.8 11.2l.6.4" stroke={O} stroke-width=".8" />
  </>
);
/** a camel: long neck, droopy lip, a turquoise headstall with red tassels */
const CamelHead = ({ coat, P }: { coat: string; P: Pal }) => (
  <>
    <path d={camelHead} fill={coat} />
    <path d="M6.6 14.4c.8-2.6 2.2-4.6 3.8-6.2" fill="none" stroke={CAMEL_LT} stroke-width="1" />
    <path d="M13.3 16c-.2 1.6-.2 3.2 0 4.8" fill="none" stroke={CAMEL_DK} stroke-width=".8" />
    <path d="M15.2 4c.6 2 .8 4 .6 6M20 5.2c.6 1.8.6 3.6 0 5.6" fill="none" stroke={P.accent} stroke-width="1.4" />
    <path d="M15.6 7 20.2 7.4" stroke={P.accent} stroke-width="1.1" />
    <circle cx="15.6" cy="7" r=".6" fill={P.trim} stroke-width=".4" />
    <path d="M16 10.2 15.7 12.8M20 10.8l-.2 2.4" stroke={P.gem} stroke-width="1.1" />
    <path d="M16.8 4.8c.8-.4 1.6-.4 2.2.2" fill="none" stroke={O} stroke-width=".8" />
    <circle cx="17.8" cy="5.7" r=".75" fill={O} />
    <path d="M23 9.2c-.8.4-1.6.4-2.4.2M22.2 6.8l.6.3" fill="none" stroke={O} stroke-width=".7" />
  </>
);
/** a raptor: a crest of feathers, a slit-eyed stare, a mouthful of teeth */
const RaptorHead = ({ coat, crest }: { coat: string; crest: string }) => (
  <>
    <Feather x={9.4} y={6.6} a={-26} len={6} c={crest} />
    <Feather x={10.8} y={5.4} a={2} len={5} c={GOLD} />
    <path d="M17.8 11.4 21.2 11 21 12.8 18 12.4Z" fill={MAW} stroke="none" />
    <path d={raptorHead} fill={coat} />
    <path d="M9.2 9.4c.6 1.4.6 2.8 0 4M11.6 9.8c.4 1.2.4 2.4 0 3.6M7.2 15.4c1.4.4 2.8.4 4.2 0M7.6 18.6c1.4.4 2.8.4 4.2 0" fill="none" stroke={SCALE_DK} stroke-width=".8" />
    <path d="M13 6.9 16 7.3" stroke={O} stroke-width="1" />
    <circle cx="14.6" cy="8.4" r="1.05" fill="#ffd23a" stroke-width=".5" />
    <path d="M14.6 7.6v1.6" stroke={O} stroke-width=".55" />
    <path d="M18.4 11.3l.4 1 .5-1.1M19.8 11.2l.4 1 .5-1.1M18.8 12.5l.4-.9.4.9" fill="#fff" stroke-width=".35" />
    <path d="M21.2 8.2l.5.4" stroke={O} stroke-width=".8" />
  </>
);

type WildSet = Partial<Record<UnitId, (P: Pal) => JSX.Element>>;

const FROST_ART: WildSet = {
  // ice wardens: a birch spear crowned with a long crystal of ice, bound in fur
  spear: (P) => (
    <Ink>
      <g transform="rotate(45 12 12)">
        <rect x="11.2" y="6.2" width="1.6" height="20.4" rx=".7" fill={BIRCH} />
        <path d="M11.3 12.6h.9M12.1 16.8h.8M11.3 21h.9" stroke={BIRCH_DK} stroke-width=".7" />
        <path d="M10.4 6.2 8.2 2.8l2.7 1.6ZM13.6 6.2l2.2-3.4-2.7 1.6Z" fill={P.blade} stroke-width=".6" />
        <path d="M12-3.2 14.4 1.4 13.4 6.6h-2.8l-1-5.2Z" fill={P.blade} />
        <path d="M12-3.2 14.4 1.4 13.4 6.6H12Z" fill={ICE_SHADE} stroke-width=".5" />
        <path d="M11.6-.8 10.6 1.6l.6 3.6" fill="none" stroke={P.bladeLt} stroke-width=".8" />
        <rect x="10.1" y="6.4" width="3.8" height="2.4" rx="1.1" fill={P.trim} />
        <path d="M10.9 7.2l.5.8M12.5 7l.5.9" stroke={FUR_DK} stroke-width=".5" />
        <path d="M11.2 10h1.6M11.2 11.3h1.6" stroke={P.accent} stroke-width=".9" />
      </g>
      <Snowflake x={19.6} y={13.2} r={1.7} />
    </Ink>
  ),
  // frostguards: a winter-navy shield bearing a great snowflake, a sword of pale steel
  sword: (P) => (
    <Ink>
      <g transform="rotate(18 17.4 12)">
        <path d="M16.2 15.2V3.4L17.4.4l1.2 3v11.8Z" fill={P.blade} />
        <path d="M17.4 2.6v11.8" stroke={P.bladeLt} stroke-width=".8" />
        <path d="M13.2 16.1 14.4 15h6l1.2 1.1-1.2 1.1h-6Z" fill={ICE_DK} />
        <rect x="16.6" y="17.2" width="1.6" height="3.4" fill={P.woodDk} />
        <circle cx="17.4" cy="21.4" r="1.2" fill={P.gem} />
      </g>
      <path d="M1.4 6.6c4.2-1.4 8.4-1.4 12.6 0v6c0 4.8-2.8 7.8-6.3 9.6-3.5-1.8-6.3-4.8-6.3-9.6Z" fill={ICE} stroke-width="1.1" />
      <path d="M2.9 7.8c3.2-1 6.4-1 9.6 0v4.8c0 3.8-2.1 6.3-4.8 7.8-2.7-1.5-4.8-4-4.8-7.8Z" fill={P.accent} stroke-width=".6" />
      <Snowflake x={7.7} y={13} r={3.3} />
    </Ink>
  ),
  // rime reavers: a bearded axe whose blade is a slab of ice, icicles hanging from its horn
  axe: (P) => (
    <Ink>
      <path d="m4 22-1.6-1.4L17.4 4.6 19 6Z" fill={BIRCH} />
      <path d="m4.4 18.6 1.4 1.2M5.7 17.2 7 18.4" stroke={P.accent} stroke-width="1.1" />
      <path d="M9.9 12.6 11.4 11l1.6 1.4-1.5 1.6Z" fill={P.trim} stroke-width=".7" />
      <path d="M13.6 9.2C12 9.6 10 9.8 8.2 9.4 7.4 6.8 8 3.4 10.4 1c1.4.2 3 1 4.6 2.2.6.6 1.2 1.4 1.8 2.2Z" fill={P.blade} />
      <path d="M15.2 6.8 8.6 7M15.2 6.8 9 3.6M15.2 6.8 11.6 1.6" fill="none" stroke={ICE_DK} stroke-width=".6" />
      <path d="M9.2 7.8c-.4-1.8 0-3.8 1.4-5.6" fill="none" stroke={P.bladeLt} stroke-width="1" />
      <path d="m9.4 9.5.3 2.9.9-2.8ZM11.4 9.5l.3 2.2.8-2.3Z" fill={P.blade} stroke-width=".55" />
      <path d="M13.4 7.2 15.6 4.8l2 1.9-2.2 2.4Z" fill={P.woodDk} />
      <path d="M17.6 4.6 21.6 1.4 19.4 6Z" fill={P.blade} stroke-width=".7" />
    </Ink>
  ),
  // frost archers: a pale birch bow tipped with icicles, an arrow headed with ice
  archer: (P) => (
    <Ink>
      <path d="M5.6 2.8 4.2.2l2.6 2ZM5.6 21.2l-1.4 2.6 2.6-2Z" fill={P.blade} stroke-width=".6" />
      <path d="M6 2.2c9.6 3.6 9.6 16 0 19.6l-1.2-1.4c7.8-3.6 7.8-13.2 0-16.8Z" fill={BIRCH} />
      <path d="M8.8 5.4l.9-.4M11.4 9.2h1M11.4 14.8h1M8.8 18.6l.9.4" stroke={BIRCH_DK} stroke-width=".6" />
      <path d="M5.4 3v18" stroke={P.bladeLt} stroke-width=".8" />
      <path d="M10.6 10h3v4h-3Z" fill={P.accent} stroke-width=".6" />
      <path d="M3 12h14.4" stroke={P.woodDk} stroke-width="1.4" />
      <path d="M16.4 12 18.6 9.4 23 12l-4.4 2.6Z" fill={P.blade} />
      <path d="M18.6 9.4 19.4 12l-.8 2.6" fill="none" stroke={ICE_DK} stroke-width=".5" />
      <path d="M1.2 9.6 4.4 12l-3.2 2.4L2.8 12Z" fill={P.trim} stroke-width=".7" />
      <Snowflake x={20.4} y={5.4} r={1.7} />
    </Ink>
  ),
  // snow owls: white wings spread wide, flecked with black, yellow eyes
  scout: () => (
    <Ink>
      <path d="M8.6 9.4C6.4 6.6 3.8 5.2.8 5.4c.2 2 .8 3.8 1.6 5.2l-1 .6 1.8.6-.6 1 2 .4-.2 1 2 .2c.8.2 1.6.2 2.4-.2Z" fill={FUR} />
      <path d="M15.4 9.4c2.2-2.8 4.8-4.2 7.8-4-.2 2-.8 3.8-1.6 5.2l1 .6-1.8.6.6 1-2 .4.2 1-2 .2c-.8.2-1.6.2-2.4-.2Z" fill={FUR} />
      <path d="M3.4 8.4l.9.5M5.4 10.6l.9.5M20.6 8.4l-.9.5M18.6 10.6l-.9.5" stroke="#5a6272" stroke-width=".6" />
      <path d="M12 4.4c-3.2 0-5.2 2.4-5.2 5.8 0 5 2.2 9.6 5.2 9.6s5.2-4.6 5.2-9.6c0-3.4-2-5.8-5.2-5.8Z" fill="#fff" />
      <path d="M9.8 15.2l.6.5.6-.5M12.6 16.8l.6.5.6-.5M11.4 18.2l.5.4.5-.4" fill="none" stroke="#5a6272" stroke-width=".55" />
      <circle cx="10.1" cy="9.6" r="1.6" fill="#ffd23a" stroke-width=".6" />
      <circle cx="13.9" cy="9.6" r="1.6" fill="#ffd23a" stroke-width=".6" />
      <circle cx="10.2" cy="9.7" r=".75" fill={O} stroke="none" />
      <circle cx="13.8" cy="9.7" r=".75" fill={O} stroke="none" />
      <path d="M11.2 11.4h1.6L12 13.2Z" fill="#4a4e58" stroke-width=".5" />
      <path d="M10.4 19.6v1.6M11.4 19.8l-.2 1.4M13.6 19.6v1.6M12.6 19.8l.2 1.4" stroke="#4a4e58" stroke-width=".7" />
    </Ink>
  ),
  light: (P) => (
    <Ink>
      <Lance shaft={BIRCH} flag={P.accent} tip={P.blade} edge={ICE_LT} />
      <SnowWolf band={P.accent} />
    </Ink>
  ),
  // sleigh archers: a winter-navy sleigh on silver runners, a fur thrown over the back
  marcher: (P) => (
    <Ink>
      <RiderBow wood={BIRCH} string={P.bladeLt} tip={P.blade} />
      <path d="M.8 21.4h12.4c2 0 3.2-1.2 3.2-2.8 0-1-.7-1.6-1.5-1.4" fill="none" stroke={O} stroke-width="2.4" />
      <path d="M.8 21.4h12.4c2 0 3.2-1.2 3.2-2.8 0-1-.7-1.6-1.5-1.4" fill="none" stroke={P.trimDk} stroke-width="1" />
      <path d="M3.4 18.8v2.4M10.6 18.8v2.4" stroke={O} stroke-width="1.2" />
      <path d="M1.2 12.4c0-.9.6-1.4 1.4-1.4h2.2v4.2h6.4c.9 0 1.5-.5 1.7-1.4l.2-.7c.3-1.1 1.3-1.6 2.2-1.1.8.4 1 1.3.5 2-1.2 2.4-2.6 5-5.4 5H3.2c-1.1 0-2-.9-2-2Z" fill={P.accent} />
      <path d="M2.2 16.8h9.4" stroke={P.trimDk} stroke-width=".8" />
      <path d="M1.8 11.6c1-.8 2.6-.9 3.6 0l.6 4c-1 .6-2.6.8-3.8.2Z" fill={FUR} stroke-width=".7" />
      <path d="M2.8 13.2l.3.8M4.4 13l.3.8" stroke={FUR_DK} stroke-width=".5" />
      <circle cx="14.4" cy="13" r=".6" fill={P.trimLt} stroke-width=".4" />
    </Ink>
  ),
  // mammoth riders: a shaggy mammoth in a winter-navy browplate, great tusks curling up
  heavy: (P) => (
    <Ink>
      <path d="M3.2 22.6C2.4 17.6 2.6 12 4.4 8 6.2 4.2 9.2 2.2 12.6 2.4c3.4.2 5.8 2.4 6.2 5.6.2 1.4 0 2.6-.4 3.6L16 15l-2.8.2-.4 7.4Z" fill={MAMMOTH} />
      <path d="M4.8 12.4c.6-2 1.6-3.6 3-4.8M4.2 17.4c.2-1.4.6-2.6 1.2-3.6M11 20.2c0-1.4.4-2.6 1-3.6" fill="none" stroke={MAMMOTH_LT} stroke-width=".9" />
      <path d="M16.2 10.8c1.8.2 3 1.2 3.4 2.8.6 2.2.4 4.6.6 6.4.1.8.6 1.2 1.2 1l.3-1.1c.9.2 1.3.9 1.1 1.7-.4 1.3-1.7 2.1-3.1 1.9-1.7-.3-2.6-1.8-2.8-3.6l-.7-4.4Z" fill={MAMMOTH} />
      <path d="M17.4 14.4h2.2M17.8 16.8h2.3" stroke={MAMMOTH_DK} stroke-width=".6" />
      <path d="M10 8.2C8.4 8 7.2 9.2 7.2 10.8s1.2 2.4 2.6 2Z" fill={MAMMOTH_DK} stroke-width=".7" />
      <path d="M10.6 3c2.8-.6 5.6.6 7.2 3l-.6 2.6-5.6-.2c-1-1.8-1.4-3.6-1-5.4Z" fill={P.accent} />
      <path d="M11.4 3.8c1.8-.4 3.4 0 4.8 1" fill="none" stroke={P.accentLt} stroke-width=".8" />
      <Snowflake x={13.8} y={6} r={1.4} />
      <circle cx="15.6" cy="9.8" r=".8" fill={O} />
      <path d="M14.6 12.6c-.4 4.2 1.4 7.6 4.8 8.4 2.2.5 3.8-.8 4.2-3.4-1 1.2-2.2 1.6-3.4 1.4-2.4-.4-4-2.8-4.2-6.2Z" fill={TUSK} />
      <path d="M16.2 15.4c.6 1.6 1.6 2.8 3 3.4" fill="none" stroke="#c9bd9e" stroke-width=".7" />
      <KiteShield fill={P.accent} trim={ICE_LT} />
      <Snowflake x={5.4} y={17.2} r={1.9} />
    </Ink>
  ),
  // ice rams: a snow-laden roof, a log shod with a great wedge of ice, icicles underneath
  ram: (P) => (
    <Ink>
      <path d="M4 10 11 4.4 18 10Z" fill={P.wood} />
      <path d="M11 4.4 16.4 8.7c-.7.7-1.7.6-2.2 0-.6.7-1.6.7-2.2 0-.6.7-1.6.7-2.2 0-.6.7-1.6.7-2.2 0-.6.6-1.4.6-2 .1Z" fill={P.roof} stroke-width=".8" />
      <path d="M4 10h14v3H4Z" fill={P.woodDk} />
      <rect x="1.8" y="11" width="17" height="3.6" rx="1.6" fill={P.wood} />
      <path d="M3.4 12h4.4M10.6 13.4h5.6" stroke={P.woodDk} stroke-width=".7" />
      <path d="M8.8 12h3" stroke={P.woodLt} stroke-width=".8" />
      <path d="m9.4 14.6.4 2.2.5-2.2M11.4 14.6l.3 1.6.4-1.6" fill={P.blade} stroke-width=".5" />
      <path d="M18 10.2 21.2 10.6 23.6 12.8 21.2 15 18 15.4Z" fill={P.blade} />
      <path d="M18 10.2 21.2 10.6 23.6 12.8H18Z" fill={P.bladeLt} stroke-width=".5" />
      <path d="M21.2 10.6V15" stroke={ICE_DK} stroke-width=".5" />
      <circle cx="6" cy="18" r="2.8" fill={P.woodLt} />
      <circle cx="16" cy="18" r="2.8" fill={P.woodLt} />
      <path d="M6 15.2v5.6M3.2 18h5.6M16 15.2v5.6M13.2 18h5.6" stroke={P.woodDk} stroke-width=".7" />
      <circle cx="6" cy="18" r=".8" fill={P.gem} stroke-width=".5" />
      <circle cx="16" cy="18" r=".8" fill={P.gem} stroke-width=".5" />
    </Ink>
  ),
  // frost trebuchets: an A-frame and a long arm, a snowflake-marked counterweight, a block of ice to throw
  catapult: (P) => (
    <Ink>
      <path d="M4.6 19.4 10.2 8l5.6 11.4M7.2 15h6" fill="none" stroke={O} stroke-width="2.6" />
      <path d="M4.6 19.4 10.2 8l5.6 11.4M7.2 15h6" fill="none" stroke={P.wood} stroke-width="1.2" />
      <path d="M6.6 10.7 18.4 1.9" stroke={O} stroke-width="2.8" />
      <path d="M6.6 10.7 18.4 1.9" stroke={P.woodLt} stroke-width="1.3" />
      <path d="M6.6 10.7v1.4" stroke={O} stroke-width="1" />
      <rect x="4" y="12" width="5.2" height="4.4" rx=".5" fill={P.accent} />
      <Snowflake x={6.6} y={14.2} r={1.4} />
      <circle cx="10.2" cy="8" r="1" fill={P.trimDk} stroke-width=".6" />
      <path d="M17.6 2.2 19.6.6l2.8.6.8 2.4-1.4 2.2-3 .4Z" fill={P.shot} />
      <path d="M19.6.6 20.2 3.4l3-.2M20.2 3.4l-1.4 2.8" fill="none" stroke={ICE_DK} stroke-width=".5" />
      <path d="M18.4 2.4c.4-.6 1-1 1.6-1.2" fill="none" stroke="#fff" stroke-width=".7" />
      <rect x="2" y="19" width="17.2" height="2.4" rx=".6" fill={P.woodDk} />
      <circle cx="4.8" cy="21.4" r="1.6" fill={P.woodLt} />
      <circle cx="16.4" cy="21.4" r="1.6" fill={P.woodLt} />
    </Ink>
  ),
  // ice heralds: a crown of ice crystals on a silver band
  noble: (P) => (
    <Ink>
      <path d="M2.8 17.8 3.4 10.2 5.6 12.8 6.8 6.6 9 11.2 12 1.6 15 11.2 17.2 6.6 18.4 12.8 20.6 10.2 21.2 17.8Z" fill={ICE} />
      <path d="M12 1.6 15 11.2H12ZM6.8 6.6 9 11.2H6.8ZM17.2 6.6l1.2 6.2h-1.2Z" fill={ICE_SHADE} stroke="none" />
      <path d="M12 3v14.4M6.8 8v9.4M17.2 8v9.4" stroke={ICE_DK} stroke-width=".6" />
      <path d="M11.2 4.6 9.8 9.6" stroke="#fff" stroke-width=".8" />
      <path d="M2.4 17.4h19.2v3.6H2.4Z" fill={P.trimDk} />
      <circle cx="12" cy="19.2" r="1.1" fill={P.accent} />
      <circle cx="6.4" cy="19.2" r=".9" fill={P.gem} />
      <circle cx="17.6" cy="19.2" r=".9" fill={P.gem} />
      <Snowflake x={12} y={13.8} r={2.2} c={P.accent} />
    </Ink>
  ),
  // hearth guard: a torch and a woodcutter's axe
  militia: (P) => (
    <Ink>
      <path d="m20.6 21.8 1.2-1.2L9.6 8.4 8.4 9.6Z" fill={P.woodDk} />
      <path d="m10.6 11.8 1.4-1.4 1.4 1.4-1.4 1.4Z" fill={FUR} stroke-width=".6" />
      <Flame x={7.6} y={9.6} s={1.15} />
      <path d="m3.4 21.8-1.2-1.2L16 6.8 17.2 8Z" fill={BIRCH} />
      <path d="m4.6 19.4 1.2 1.2" stroke={P.accent} stroke-width="1.2" />
      <path d="M15.6 10.2 17.8 8l3.8 1c.2 2.2-.8 4.2-2.6 5.4Z" fill={P.blade} />
      <path d="M18.4 9.2c1 .2 1.8.6 2.4 1.2" fill="none" stroke={P.bladeLt} stroke-width=".8" />
    </Ink>
  ),
  // reindeer sledges: a reindeer in harness, a sledge of furs behind
  trader: (P) => (
    <Ink>
      <g transform="translate(3.8 .4) scale(.88)">
        <Reindeer band={P.accent} />
      </g>
      <path d="M10.8 16.6 13.8 17.2" stroke={O} stroke-width="1" />
      <path d="M.6 21.4h11.8c1.6 0 2.6-1 2.6-2.4 0-.8-.6-1.4-1.4-1.2" fill="none" stroke={O} stroke-width="2.2" />
      <path d="M.6 21.4h11.8c1.6 0 2.6-1 2.6-2.4 0-.8-.6-1.4-1.4-1.2" fill="none" stroke={P.trimDk} stroke-width=".9" />
      <path d="M2.6 19v2.4M9.4 19v2.4" stroke={O} stroke-width="1.1" />
      <path d="M.8 15.4h10.4v2.8c0 .7-.6 1.2-1.2 1.2H2c-.7 0-1.2-.5-1.2-1.2Z" fill={P.accent} />
      <path d="M1.6 17.2h8.8" stroke={P.trimDk} stroke-width=".7" />
      <rect x="1.4" y="10.8" width="5" height="4.6" rx=".5" fill={WOOD} />
      <path d="M1.4 12.4h5" stroke={WOOD_DK} stroke-width=".8" />
      <rect x="3.3" y="11.8" width="1.2" height="1.4" fill={GOLD} stroke-width=".5" />
      <path d="M6 15.4c-.4-2.8.8-4.6 2.6-4.6s3 1.8 2.6 4.6Z" fill={FUR} />
      <path d="M7.6 11.6c-.3 1.2-.3 2.6 0 3.8M9.6 11.6c.3 1.2.3 2.6 0 3.8" fill="none" stroke={FUR_DK} stroke-width=".6" />
    </Ink>
  ),
};

const DWARF_ART: WildSet = {
  // shieldbearers: a great round shield, bronze-rimmed, an inscription of runes burning round its boss
  spear: (P) => (
    <Ink>
      <path d="m2.4 22.6-1-1L16.4 6.8l1 1Z" fill={P.wood} />
      <path d="M15.2 6.6 16.4 3.6 22.4 1.6l-2 6-3 1.2Z" fill={P.blade} />
      <path d="m17.2 6.4 3.6-3.4" stroke={P.bladeLt} stroke-width="1" />
      <path d="m13.6 7.6 2.8 2.8" stroke={P.trim} stroke-width="2" />
      <circle cx="9.2" cy="13.8" r="8" fill={P.trim} stroke-width="1.1" />
      <path d="M3.2 9.4c1.2-1.8 3-3 5-3.4" fill="none" stroke={P.trimLt} stroke-width=".9" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <circle cx={f2(9.2 + Math.sin((a * Math.PI) / 180) * 7.15)} cy={f2(13.8 - Math.cos((a * Math.PI) / 180) * 7.15)} r=".42" fill={P.trimDk} stroke="none" />
      ))}
      <circle cx="9.2" cy="13.8" r="6.3" fill={IRON} stroke-width=".7" />
      <circle cx="9.2" cy="13.8" r="4.3" fill="none" stroke={RUNE_LT} stroke-width="1.9" opacity=".3" />
      <circle cx="9.2" cy="13.8" r="4.3" fill="none" stroke={RUNE} stroke-width=".9" stroke-dasharray="1.7 .9" />
      <circle cx="9.2" cy="13.8" r="2.2" fill={P.trim} stroke-width=".8" />
      <circle cx="8.6" cy="13.2" r=".7" fill={P.trimLt} stroke="none" />
    </Ink>
  ),
  // ironbreakers: a heavy rune-hammer, and an iron shield with a rune burning on it
  sword: (P) => (
    <Ink>
      <g transform="rotate(45 12 12)">
        <rect x="11.1" y="6.6" width="1.8" height="18.4" rx=".6" fill={P.wood} />
        <path d="M11.1 19.4h1.8M11.1 21.2h1.8" stroke={P.trim} stroke-width=".9" />
        <path d="M6.8 1.8h10.4v5.4H6.8Z" fill={P.blade} />
        <path d="M5.8 1.4 6.8 1.8v5.4l-1 .4ZM18.2 1.4l-1 .4v5.4l1 .4Z" fill={P.bladeDk} />
        <path d="M9.6 1.8h4.8v5.4H9.6Z" fill={P.trim} stroke-width=".7" />
        <Rune d="M12 2.8v3.4M12 3.6l1.1.9-1.1.9" w={0.7} />
        <path d="M7.4 2.8h1.4" stroke={P.bladeLt} stroke-width=".8" />
      </g>
      <path d="M1.4 12h9.6v5.4c0 3-2.2 4.8-4.8 5.8-2.6-1-4.8-2.8-4.8-5.8Z" fill={P.trim} />
      <path d="M2.6 13.2h7.2v4.2c0 2.2-1.6 3.6-3.6 4.4-2-.8-3.6-2.2-3.6-4.4Z" fill={IRON} stroke-width=".6" />
      <Rune d="M6.2 14.4v5.4M6.2 15.4l1.8 1.3-1.8 1.3" />
    </Ink>
  ),
  // longbeards: a grey-bearded veteran under an iron helm, his great axe at his shoulder
  axe: (P) => (
    <Ink>
      <path d="M17.2 4.6 21.2 23" stroke={O} stroke-width="2.8" />
      <path d="M17.2 4.6 21.2 23" stroke={P.woodLt} stroke-width="1.3" />
      <path d="M16.8 4.2 14.6 4.8l2.4 1.4Z" fill={P.bladeDk} stroke-width=".6" />
      <path d="M16.8 3.4C19.2 1.4 21.8.8 23.4 1.2c.4 3.4 0 6.8-1.6 9.6-1-1.4-2.6-2.4-4.4-2.8Z" fill={P.blade} />
      <path d="M22.4 2.2c.2 2.6-.2 5.2-1.2 7.2" fill="none" stroke={P.bladeLt} stroke-width=".9" />
      <Rune d="M19.4 3.8v3.6M19.4 4.8l1.1.8" w={0.7} />
      <path d="M3.4 10.4c0-4.6 2.8-7.6 6.4-7.6s6.4 3 6.4 7.6Z" fill={P.blade} />
      <path d="M9.8 2.8v7.6" stroke={P.trim} stroke-width="1.3" />
      <path d="M5.4 7.8c.3-2 1.4-3.4 2.8-4" fill="none" stroke={P.bladeLt} stroke-width="1" />
      <path d="M4.6 11.4h10.4v3.4H4.6Z" fill={SKIN} />
      <circle cx="7.6" cy="12.7" r=".6" fill={O} stroke="none" />
      <circle cx="12" cy="12.7" r=".6" fill={O} stroke="none" />
      <path d="M3 10.2h13.6V12H3Z" fill={P.trim} />
      <path d="M9 10.6v2.8c0 .8.4 1.2.8 1.4.4-.2.8-.6.8-1.4v-2.8Z" fill={P.blade} stroke-width=".6" />
      <path d="M3.8 13.4c-.6 3.8 0 7 2 9.4l1.3-1.2 1.2 1.6 1.3-1.6 1.3 1.6 1.2-1.6 1.3 1.2c2-2.4 2.6-5.6 2-9.4-1.6.9-3.6 1.3-5.8 1.3s-4.2-.4-5.8-1.3Z" fill={GREYBEARD} />
      <path d="M7 16.6c0 1.6.2 3 .8 4.2M9.8 16.8v4.4M12.6 16.6c0 1.6-.2 3-.8 4.2" fill="none" stroke={GREYBEARD_DK} stroke-width=".6" />
      <path d="M5.6 14.2c1.4-.8 3-.8 4.2.4 1.2-1.2 2.8-1.2 4.2-.4-.6 1.6-2.4 2-4.2 1.4-1.8.6-3.6.2-4.2-1.4Z" fill="#fff" stroke-width=".6" />
      <path d="M7.4 20h1.6M10.6 20h1.6" stroke={P.trim} stroke-width="1.2" />
    </Ink>
  ),
  // quarrellers: a heavy crossbow with a steel prod, cocked, a bolt on the rail
  archer: (P) => (
    <Ink>
      <Crossbow P={P} />
    </Ink>
  ),
  // tunnel scouts: a miner's lantern, glowing, hung from a pick
  scout: (P) => (
    <Ink>
      <g transform="rotate(45 12 12)">
        <rect x="11.2" y="3.6" width="1.6" height="21" rx=".6" fill={P.wood} />
        <path d="M2.8 6.6C5.6 4 8.6 2.6 12 2.6s6.4 1.4 9.2 4C18.4 5.6 15.4 5 12 5S5.6 5.6 2.8 6.6Z" fill={P.blade} />
        <path d="M6 4.6c1.8-.8 3.8-1.2 5.8-1.2" fill="none" stroke={P.bladeLt} stroke-width=".8" />
        <path d="M10.8 2.4h2.4v3.4h-2.4Z" fill={P.trim} stroke-width=".6" />
      </g>
      <circle cx="15.8" cy="16.4" r="6.6" fill={RUNE_LT} stroke="none" opacity=".4" />
      <circle cx="15.8" cy="9.8" r="1.1" fill="none" stroke={O} stroke-width="1.7" />
      <circle cx="15.8" cy="9.8" r="1.1" fill="none" stroke={P.trim} stroke-width=".7" />
      <path d="M13.4 13.2 14.6 10.8h2.4l1.2 2.4Z" fill={P.trim} />
      <path d="M13 13.2h5.6v6.4H13Z" fill="#ffd45a" />
      <path d="M15.8 14.4c-1.2 1.2-1.4 2.6-.6 3.4.6.6 1.4.4 1.8-.2.6-1-.2-2.2-1.2-3.2Z" fill="#fff4c0" stroke="#e8801a" stroke-width=".6" />
      <path d="M14.8 13.2v6.4M16.8 13.2v6.4" stroke={P.trimDk} stroke-width=".8" />
      <path d="M12.4 19.6h6.8v1.8h-6.8Z" fill={P.trim} />
    </Ink>
  ),
  light: (P) => (
    <Ink>
      <Lance shaft={P.woodLt} flag={P.accent} tip={P.blade} edge={P.trimLt} />
      <GoatHead coat={GOAT} band={P.trim} />
    </Ink>
  ),
  marcher: (P) => (
    <Ink>
      <g transform="translate(9.4 -.6) scale(.6)"><Crossbow P={P} /></g>
      <g transform="translate(-1.2 5.6) scale(.76)"><GoatHead coat={GOAT_DK} band={P.trim} /></g>
    </Ink>
  ),
  // anvil knights: a war-ram with a great curled horn, steel-faced, behind a rune shield
  heavy: (P) => (
    <Ink>
      <path d={warRamHead} fill={RAM_WOOL} />
      <path d="M7.4 17.6c.6.6 1.4.6 2 0M10.2 19.4c.6.6 1.4.6 2 0M8 20.8c.6.6 1.4.6 2 0" fill="none" stroke="#a09486" stroke-width=".7" />
      <path d={ramHorn} fill="none" stroke={O} stroke-width="3.6" />
      <path d={ramHorn} fill="none" stroke={HORN} stroke-width="2.1" />
      <path d="M10.4 4.6l-.3 1M7.4 5.2l.4.9M5.2 7.6l.9.3M5.2 11.4l.9-.3" stroke={O} stroke-width=".5" />
      <path d="M13.4 5.2c2.6-.2 4.8 1 6.4 2.8L22 11l-2.2 1.4-5-.6c-1.2-2.2-1.6-4.4-1.4-6.6Z" fill={P.blade} />
      <path d="M14.2 6c1.8 0 3.4.8 4.6 2" fill="none" stroke={P.bladeLt} stroke-width=".8" />
      <path d="M14 8.6h2" stroke={O} stroke-width="1.1" />
      <Rune d="M17.8 7.6l.9 1.6.9-1.6" w={0.6} />
      <circle cx="5.2" cy="17.8" r="4.4" fill={P.trim} stroke-width="1.1" />
      <circle cx="5.2" cy="17.8" r="3.2" fill={IRON} stroke-width=".6" />
      <Rune d="M5.2 15.6v4.4M5.2 17.2l1.4-1.2M5.2 17.2l-1.4-1.2" w={0.7} />
    </Ink>
  ),
  // steam drills: a riveted bronze boiler on iron wheels, smoke-stack puffing, a spiral bit
  ram: (P) => (
    <Ink>
      <circle cx="5.4" cy="2.6" r="1.6" fill="#efebe4" stroke-width=".6" />
      <circle cx="8" cy="1.8" r="1.2" fill="#efebe4" stroke-width=".6" />
      <circle cx="3.2" cy="1.4" r=".9" fill="#efebe4" stroke-width=".5" />
      <path d="M4 4.2h2.6v5.4H4Z" fill={IRON} />
      <path d="M3.4 3.6h3.8v1.2H3.4Z" fill={P.trim} stroke-width=".6" />
      <rect x="1.8" y="9" width="12.6" height="7.2" rx="3" fill={P.trim} />
      <path d="M5.8 9v7.2M11 9v7.2" stroke={P.trimDk} stroke-width=".9" />
      <path d="M3.4 10.6h9" stroke={P.trimLt} stroke-width=".8" />
      <Rune d="M8.4 11.2v3.6M8.4 12l1.1.9-1.1.9" w={0.7} />
      <path d="M14 8.4h1.8v8.6H14Z" fill={IRON} />
      <path d="M15.8 8.6 23.6 12.7 15.8 16.8Z" fill={P.blade} />
      <path d="M17.2 9.4 18 15.6M19.4 10.6l.6 4M21.4 11.6l.4 2" stroke={P.bladeDk} stroke-width=".8" />
      <path d="M16.6 9.6l5.4 2.8" stroke={P.bladeLt} stroke-width=".7" />
      <rect x="1.4" y="16" width="14" height="2" rx=".4" fill={P.woodDk} />
      <circle cx="5" cy="19.4" r="2.6" fill={IRON} />
      <circle cx="12" cy="19.4" r="2.6" fill={IRON} />
      <circle cx="5" cy="19.4" r="1" fill={P.trim} stroke-width=".6" />
      <circle cx="12" cy="19.4" r="1" fill={P.trim} stroke-width=".6" />
    </Ink>
  ),
  // flame ballistae: a bolt-thrower on an iron-wheeled carriage, its bolt wrapped in fire
  catapult: (P) => (
    <Ink>
      <path d="M9.4 17.6 11 12.8h2.4l-1 4.8Z" fill={P.woodDk} />
      <rect x="2" y="17.2" width="16.8" height="2.6" rx=".6" fill={P.wood} />
      <circle cx="5.2" cy="20.4" r="2.2" fill={IRON} />
      <circle cx="15.6" cy="20.4" r="2.2" fill={IRON} />
      <circle cx="5.2" cy="20.4" r=".8" fill={P.trim} stroke-width=".5" />
      <circle cx="15.6" cy="20.4" r=".8" fill={P.trim} stroke-width=".5" />
      <g transform="translate(12.4 10.4) rotate(45)">
        <path d="M-1.1-4h2.2v9.6h-2.2Z" fill={P.wood} />
        <path d="M-6.4 0C-4.4-2.4-2.2-3.4 0-3.4S4.4-2.4 6.4 0" fill="none" stroke={O} stroke-width="2.8" />
        <path d="M-6.4 0C-4.4-2.4-2.2-3.4 0-3.4S4.4-2.4 6.4 0" fill="none" stroke={P.trim} stroke-width="1.4" />
        <path d="M-6.2 0 0 4.2 6.2 0" fill="none" stroke="#efe3c8" stroke-width=".7" />
        <path d="M0 4V-9" stroke={O} stroke-width="1.8" />
        <path d="M0 4V-9" stroke={P.woodLt} stroke-width=".8" />
        <path d="M-1.2-8.6 0-11.4l1.2 2.8Z" fill={P.blade} stroke-width=".6" />
      </g>
      <Flame x={18.2} y={5.6} s={1.05} c="#ff7a2a" />
    </Ink>
  ),
  // thanes: a squat, heavy crown of gold, square-toothed, a rune-gem at its heart
  noble: (P) => (
    <Ink>
      <path d="M3 13.4 3.6 8.4h3.8l.6 5ZM16 13.4l.6-5h3.8l.6 5ZM8.6 13.4 9.4 4.2h5.2l.8 9.2Z" fill={P.trim} />
      <path d="M10.4 5.4v6.4M4.6 9.6v3" stroke={P.trimLt} stroke-width=".9" />
      <path d="M2.4 13h19.2l-.6 8H3Z" fill={P.trim} />
      <path d="M3.2 15h17.6M3.4 19h17.2" stroke={P.trimDk} stroke-width=".8" />
      <path d="M10 17 11 15.2h2l1 1.8-1 1.8h-2Z" fill={P.gem} stroke-width=".7" />
      <path d="M11.4 16.2h.8" stroke="#fff4c0" stroke-width=".6" />
      <Rune d="M5.6 15.6v2.8M5.6 16.2l1 .7M18.4 15.6v2.8M18.4 16.4l-1 .7-.1 1" w={0.6} />
      <circle cx="5.5" cy="10.8" r=".9" fill={P.accent} stroke-width=".5" />
      <circle cx="18.5" cy="10.8" r=".9" fill={P.accent} stroke-width=".5" />
      <circle cx="12" cy="8.4" r="1.3" fill={P.gem} stroke-width=".6" />
    </Ink>
  ),
  // mine carts: an iron-banded cart on the rails, heaped with ore, gold and a fire-gem
  trader: (P) => (
    <Ink>
      <path d="M3.4 9 4.4 6.2 7.2 5.4 9 7 8.6 9Z" fill={IRON_LT} />
      <path d="M13 9l.8-2.6 2.8-.6 2.2 1.6.6 1.6Z" fill={IRON_LT} />
      <path d="M8.2 9 9 5.6l2.8-1 1.8 1.6-.4 2.8Z" fill={GOLD} />
      <path d="M11.6 5.6 12.8 2.8l1.6 2.2-1.2 2Z" fill={P.gem} stroke-width=".7" />
      <path d="M9.6 6.8c.4-.6 1-.8 1.6-.8M5.4 6.8l1-.4" fill="none" stroke={GOLD_LT} stroke-width=".7" />
      <path d="M2 8.6h19.6l-1.8 8.2H3.8Z" fill={P.wood} />
      <path d="M2 8.6h19.6v1.8H2Z" fill={P.bladeDk} />
      <path d="M7.6 10.4v6.4M15.8 10.4v6.4" stroke={P.bladeDk} stroke-width="1.2" />
      <path d="M4.4 12h1.6M9.4 12h4.6" stroke={P.woodLt} stroke-width=".8" />
      <path d="M21.4 10.2h1.4l.8-1.8" fill="none" stroke={O} stroke-width="1.1" />
      <path d="M.6 21.4h22.8" stroke={O} stroke-width="1.8" />
      <path d="M.6 21.4h22.8" stroke={P.blade} stroke-width=".8" />
      <path d="M2.6 22.2v1.2M8.2 22.2v1.2M14 22.2v1.2M19.8 22.2v1.2" stroke={P.woodDk} stroke-width="1" />
      <circle cx="7" cy="18.4" r="2.4" fill={IRON} />
      <circle cx="16.4" cy="18.4" r="2.4" fill={IRON} />
      <circle cx="7" cy="18.4" r=".8" fill={P.trim} stroke-width=".5" />
      <circle cx="16.4" cy="18.4" r=".8" fill={P.trim} stroke-width=".5" />
    </Ink>
  ),
  // miners: pick and shovel, crossed
  militia: (P) => (
    <Ink>
      <path d="m3.4 21.8-1.2-1.2L13 9.8l1.2 1.2Z" fill={P.wood} />
      <path d="M1.2 19.8 4.2 22.8" stroke={O} stroke-width="2.4" />
      <path d="M1.2 19.8 4.2 22.8" stroke={P.woodDk} stroke-width="1.1" />
      <path d="M12 9.8 16.4 5.4c1.6-1.6 4-2 5.6-1.2.8 1.6.4 4-1.2 5.6L16.4 14.2Z" fill={P.blade} />
      <path d="M16.8 6.4c1.2-1 2.6-1.4 4-1.2" fill="none" stroke={P.bladeLt} stroke-width=".8" />
      <g transform="rotate(-45 12 12)">
        <rect x="11.2" y="4.6" width="1.6" height="19.8" rx=".6" fill={P.woodLt} />
        <path d="M3.6 7C6.2 4.6 9 3.4 12 3.4s5.8 1.2 8.4 3.6C17.8 6.2 15 5.8 12 5.8S6.2 6.2 3.6 7Z" fill={P.blade} />
        <path d="M10.8 3.2h2.4v3h-2.4Z" fill={P.trim} stroke-width=".6" />
      </g>
    </Ink>
  ),
};

/** a heavy crossbow, aimed up and to the right (the quarreller's, and the goat crossbowman's) */
function Crossbow({ P }: { P: Pal }) {
  return (
    <g transform="rotate(45 12 12)">
      <path d="M10.9 5.4h2.2v11.8l1 1.4v5.6c0 .5-.4.9-.9.9h-2.4c-.5 0-.9-.4-.9-.9v-5.6l1-1.4Z" fill={P.wood} />
      <path d="M11.4 7v9" stroke={P.woodLt} stroke-width=".7" />
      <Rune d="M12 19.2v3.2M12 20l.9.7-.9.7" w={0.6} />
      <path d="M3.4 8.8C6 5.6 9 4.4 12 4.4s6 1.2 8.6 4.4" fill="none" stroke={O} stroke-width="2.8" />
      <path d="M3.4 8.8C6 5.6 9 4.4 12 4.4s6 1.2 8.6 4.4" fill="none" stroke={P.blade} stroke-width="1.3" />
      <path d="M3.6 8.8 12 13l8.4-4.2" fill="none" stroke="#efe3c8" stroke-width=".7" />
      <path d="M12 12.8V-1" stroke={O} stroke-width="1.8" />
      <path d="M12 12.8V-1" stroke={P.woodLt} stroke-width=".7" />
      <path d="M10.8 12.6 12 10.6l1.2 2Z" fill={P.accent} stroke-width=".5" />
      <path d="M10.8-.4 12-3.2l1.2 2.8Z" fill={P.blade} stroke-width=".6" />
      <path d="M10.4 4.2h3.2v2h-3.2Z" fill={P.trim} stroke-width=".6" />
      <circle cx="12" cy="13" r="1" fill={P.trim} stroke-width=".6" />
      <path d="m13.2 15.8 1.2 1.8" stroke={O} stroke-width="1" />
    </g>
  );
}

/** a scimitar: a broad curved blade, a gilded guard, a turquoise grip */
const Scimitar = ({ P }: { P: Pal }) => (
  <>
    <path d="M6.8 16.6C10.8 12.4 15.4 6.8 21.8 1.4 21.4 6.8 16.8 12.6 8.8 18.6Z" fill={P.blade} />
    <path d="M9.2 16.6c3.8-3.4 7.6-7.8 11.2-12.4" fill="none" stroke={P.bladeLt} stroke-width=".8" />
    <path d="M4.8 15 10.4 20.6" stroke={O} stroke-width="2.6" />
    <path d="M4.8 15 10.4 20.6" stroke={P.trim} stroke-width="1.2" />
    <path d="M7.2 18.4 4.4 21.2" stroke={O} stroke-width="3" />
    <path d="M7.2 18.4 4.4 21.2" stroke={P.accent} stroke-width="1.6" />
    <circle cx="3.8" cy="21.8" r="1.2" fill={P.trim} />
  </>
);

const DJINN_ART: WildSet = {
  // sand guards: a long leaf-bladed spear with a ruby tassel, a turquoise buckler with a golden star
  spear: (P) => (
    <Ink>
      <path d="m3.2 21.8-1-1L16 7l1 1Z" fill={P.wood} />
      <path d="M15.2 7.2C16.2 4.8 18.6 2.8 22 2c-.8 3.4-2.8 5.8-5.2 6.8Z" fill={P.blade} />
      <path d="M16.8 6.6c1.2-1.6 2.8-2.8 4.4-3.6" fill="none" stroke={P.bladeLt} stroke-width=".8" />
      <path d="m13.8 8.6 1.8 1.8" stroke={P.trim} stroke-width="2" />
      <path d="M13.8 10.6c-1 1.2-1 2.8-.2 4.2.5-.9 1.1-1.6 1.9-2 0-.9-.6-1.7-1.7-2.2Z" fill={P.gem} stroke-width=".6" />
      <circle cx="7" cy="16.6" r="5.2" fill={P.trim} stroke-width="1.1" />
      <circle cx="7" cy="16.6" r="4" fill={P.accent} stroke-width=".6" />
      <path d="M3.6 14.2c.6-1.2 1.6-2 2.8-2.4" fill="none" stroke={P.accentLt} stroke-width=".7" />
      <path d={starPath(7, 16.6, 2.8, 1.3, 8)} fill={P.trimLt} stroke-width=".5" />
      <circle cx="7" cy="16.6" r=".8" fill={P.gem} stroke-width=".4" />
    </Ink>
  ),
  // blade dancers: two scimitars, crossed
  sword: (P) => (
    <Ink>
      <g transform="matrix(-1 0 0 1 24 0)"><Scimitar P={P} /></g>
      <Scimitar P={P} />
    </Ink>
  ),
  // dune raiders: a crescent-bladed axe on a long haft, spiked at the top
  axe: (P) => (
    <Ink>
      <g transform="rotate(45 12 12)">
        <rect x="11.1" y="1.6" width="1.8" height="24" rx=".6" fill={P.wood} />
        <path d="M11.1 1.8 12-1.6l.9 3.4Z" fill={P.blade} stroke-width=".6" />
        <path d="M10.8.4C7 .6 4.2 3 3.4 6.6c-.6 3 1.4 5.8 7.2 5.8-2.2-.8-3.8-2.8-3.8-5.6 0-2.6 1.6-4.8 4-6.4Z" fill={P.blade} />
        <path d="M6.8 5.8h4.4v1.8H6.8Z" fill={P.trim} stroke-width=".6" />
        <path d="M5 4.8c-.8 1.4-1 3-.6 4.6" fill="none" stroke={P.bladeLt} stroke-width=".9" />
        <path d="M10.8 4.4h2.4v4.4h-2.4Z" fill={P.trim} stroke-width=".6" />
        <path d="M11.1 18h1.8M11.1 19.6h1.8M11.1 21.2h1.8" stroke={P.accent} stroke-width="1" />
      </g>
      <path d="M17.4 9.4c.4 1.4 1.2 2.4 2.4 3 .2-1.2-.2-2.4-1.2-3.2Z" fill={P.gem} stroke-width=".6" />
    </Ink>
  ),
  // desert archers: a sharply recurved bow, gold at the tips, a ruby-fletched arrow
  archer: (P) => (
    <Ink>
      <path d="M8.8 1C6.6.8 5.8 2.6 6.8 4.4c1.8 2.8 5.6 3.8 5.6 7.6s-3.8 4.8-5.6 7.6c-1 1.8-.2 3.6 2 3.4" fill="none" stroke={O} stroke-width="3" />
      <path d="M8.8 1C6.6.8 5.8 2.6 6.8 4.4c1.8 2.8 5.6 3.8 5.6 7.6s-3.8 4.8-5.6 7.6c-1 1.8-.2 3.6 2 3.4" fill="none" stroke={P.wood} stroke-width="1.5" />
      <path d="M8.8 1c-.8 0-1.4.3-1.8.8M8.8 23c-.8 0-1.4-.3-1.8-.8" fill="none" stroke={P.trim} stroke-width="1.5" />
      <path d="M6.6 3.8v16.4" stroke="#efe3c8" stroke-width=".8" />
      <path d="M11 10.2h2.8v3.6H11Z" fill={P.accent} stroke-width=".6" />
      <path d="M3 12h15.6" stroke={P.woodDk} stroke-width="1.4" />
      <path d="M17.6 9.4 22.6 12l-5 2.6 1.2-2.6Z" fill={P.blade} />
      <path d="M1.4 10 4.4 12l-3 2L3 12Z" fill={P.gem} stroke-width=".6" />
    </Ink>
  ),
  // desert falcons: a falcon on the wing, a jess and a golden bell trailing
  scout: (P) => (
    <Ink>
      <path d="M12.4 11.6C12.6 8 14.2 4.6 17.2 2.2c.2 3.4-.8 6.8-3 9.6Z" fill="#6e4a2c" />
      <path d="M6.6 15.4 1.4 18.6l.6 1.4 1.2-.2.4 1.2 5-3.2Z" fill="#9a6a42" />
      <path d="M5.8 15.8C8 13.4 11.4 12 14.6 12.2c2.2.2 3.6 1.2 4.2 2.4-1 2.2-3.4 3.6-6.4 3.8-2.6.2-4.8-.6-6.6-2.6Z" fill="#f2e2c0" />
      <path d="M9.4 15.6l.6.5M12 16l.6.5M14.4 15.6l.6.5" stroke="#8a6a42" stroke-width=".6" />
      <path d="M16.6 13.4c.2-1.8 1.4-3 3-3.2 1.4-.2 2.6.6 3 1.8l-1.2.8c-.8-.4-1.8-.4-2.6.2Z" fill="#9a6a42" />
      <path d="M21.4 12.8 22.6 12c.4.6.4 1.4 0 2Z" fill="#f0c040" stroke-width=".5" />
      <circle cx="19.6" cy="11.8" r=".75" fill={O} />
      <path d="M19.2 12.8c-.2.6-.2 1.2 0 1.8" stroke={O} stroke-width=".8" />
      <path d="M13.8 12.8C12 9.2 8.6 5.2 3 1.8c.4 3 1.6 5.8 3.4 8.2l-1.2.4 1.8 1.2-.6.8 2.2.6c1.6.8 3.4 1.2 5.2-.2Z" fill="#9a6a42" />
      <path d="M6.4 5.4c1.4 1 2.6 2.2 3.6 3.6M9 4.8c1.2 1 2.2 2.2 3 3.4" fill="none" stroke="#6e4a2c" stroke-width=".7" />
      <path d="M11 18.2c-.4 1.6-1.4 2.8-2.8 3.4" fill="none" stroke={P.accent} stroke-width="1.1" />
      <circle cx="8" cy="21.8" r=".9" fill={P.trim} stroke-width=".5" />
    </Ink>
  ),
  light: (P) => (
    <Ink>
      <Lance shaft={P.woodLt} flag={P.accent} tip={P.blade} edge={P.trimLt} />
      <CamelHead coat={CAMEL} P={P} />
    </Ink>
  ),
  marcher: (P) => (
    <Ink>
      <RiderBow wood={P.wood} string="#efe3c8" tip={P.blade} />
      <g transform="translate(-1.2 5.6) scale(.76)"><CamelHead coat={CAMEL_DK} P={P} /></g>
    </Ink>
  ),
  // sun lancers: a white desert charger in a golden sun-mask and plume, behind a sun-shield
  heavy: (P) => (
    <Ink>
      <path d={horseHead} fill="#f3eee6" />
      <path d="M6 22 7.4 15.2c2.8 1 6.2.9 9.4-.9L13.6 22Z" fill={P.accent} />
      <path d="M8.2 18c.6.6 1.4.6 2 0 .6.6 1.4.6 2 0M8.8 20.4c.6.6 1.4.6 2 0 .6.6 1.4.6 2 0" fill="none" stroke={P.accentLt} stroke-width=".7" />
      <path d="M7.4 15.2c2.8 1 6.2.9 9.4-.9" fill="none" stroke={P.trim} stroke-width="1.1" />
      <path d="M8.4 5.4 11.2 5c3.2 0 5.8 1.6 7.4 4l-2.6 2.2-7.6.4c-.9-2.2-.9-4.4 0-6.2Z" fill={P.trim} />
      <path d="M9.6 6.4c2.4-.4 4.8.4 6.6 2" fill="none" stroke={P.trimLt} stroke-width="1" />
      <circle cx="12.8" cy="8.6" r=".9" fill={O} />
      <path d="M9.6 5.2C8.6 3 9 1 10.8 0c.2 1.8.6 3.4 1.4 4.8Z" fill={P.gem} />
      <circle cx="5.4" cy="17.4" r="4.6" fill={P.trim} stroke-width="1.1" />
      <path d={starPath(5.4, 17.4, 3.4, 2.2, 12)} fill="#fff1a8" stroke-width=".5" />
      <circle cx="5.4" cy="17.4" r="1.7" fill={P.trimDk} stroke-width=".6" />
      <circle cx="5.4" cy="17.4" r=".8" fill={P.trimLt} stroke="none" />
    </Ink>
  ),
  // brass rams: an onion dome of turquoise over the frame, a log capped with a brass ram's head
  ram: (P) => (
    <Ink>
      <path d="M11 2V.6" stroke={O} stroke-width="1" />
      <circle cx="11" cy=".9" r=".7" fill={P.trim} stroke-width=".5" />
      <path d="M4.2 10.2C4 7.6 6 6.2 8.4 5.2 9.8 4.6 10.8 3.6 11 2c.2 1.6 1.2 2.6 2.6 3.2 2.4 1 4.4 2.4 4.2 5Z" fill={P.roof} />
      <path d="M5 8.6c3.8-1 8.2-1 12 0" fill="none" stroke={P.trim} stroke-width="1" />
      <path d="M6.6 7.2c.8-.8 2-1.4 3-1.8" fill="none" stroke={P.accentLt} stroke-width=".8" />
      <path d="M4 10h14v3H4Z" fill={P.trimDk} />
      <rect x="1.8" y="11" width="17" height="3.6" rx="1.6" fill={P.wood} />
      <path d="M5.4 11v3.6M10 11v3.6M14.4 11v3.6" stroke={P.trim} stroke-width="1.2" />
      <path d="M17.4 10.4c2-.8 4-.4 5.2 1l.8 2-1 1.8c-1 1-2.8 1.2-5 .6Z" fill={P.trim} />
      <path d="M19.8 11.4c-1.4-.8-2.8.2-2.6 1.6.2 1.2 1.6 1.6 2.4.8.6-.6.2-1.4-.4-1.4" fill="none" stroke={P.trimDk} stroke-width=".8" />
      <circle cx="21.4" cy="12" r=".5" fill={O} stroke="none" />
      <circle cx="6" cy="18" r="2.8" fill={P.woodLt} />
      <circle cx="16" cy="18" r="2.8" fill={P.woodLt} />
      <circle cx="6" cy="18" r="1" fill={P.trim} stroke-width=".6" />
      <circle cx="16" cy="18" r="1" fill={P.trim} stroke-width=".6" />
    </Ink>
  ),
  // sun engines: a gilded mangonel that flings a blazing sun
  catapult: (P) => (
    <Ink>
      <path d="m7.4 15.4 1.6 1 9.4-12.2-1.6-1.2Z" fill={P.woodLt} />
      <path d={starPath(18.4, 4.6, 4.1, 2.5, 8)} fill="#ffb02a" stroke-width=".6" />
      <circle cx="18.4" cy="4.6" r="2.2" fill={P.trimLt} stroke-width=".8" />
      <path d="M10 15.6 12.6 9h1.8l-1.6 6.6Z" fill={P.woodDk} />
      <rect x="2" y="15" width="17" height="3" rx=".8" fill={P.wood} />
      <path d="M3.2 16.5h14.6" stroke={P.accent} stroke-width="1" />
      <circle cx="5" cy="19.6" r="2.2" fill={P.woodLt} />
      <circle cx="16" cy="19.6" r="2.2" fill={P.woodLt} />
      <circle cx="5" cy="19.6" r=".8" fill={P.trim} stroke-width=".5" />
      <circle cx="16" cy="19.6" r=".8" fill={P.trim} stroke-width=".5" />
    </Ink>
  ),
  // viziers: a great white turban, a ruby in a golden setting, a turquoise plume
  noble: (P) => (
    <Ink>
      <path d="M3 17.6C2.4 11.6 6.4 6.4 12 6.4s9.6 5.2 9 11.2Z" fill={LINEN} />
      <path d="M4.2 13.4c4.4-2.4 11-2.4 15.6 1.4M4 16.2c5-3 11.4-2.6 16 .4M6.4 9.6c3.6-.6 7.2.4 10 2.8" fill="none" stroke={SAND_DK} stroke-width=".8" />
      <path d="M12.2 9.6C11 6.8 11.6 3.4 14.2.8c1 3 .4 6.4-2 8.8Z" fill={P.accentLt} />
      <path d="M12.6 8.6c.2-2.4.8-4.6 1.8-6.6" fill="none" stroke="#fff" stroke-width=".6" />
      <circle cx="12" cy="11.4" r="2.2" fill={P.trim} />
      <circle cx="12" cy="11.4" r="1.2" fill={P.gem} stroke-width=".5" />
      <path d="M2.4 17.4h19.2v3.6H2.4Z" fill={P.accent} />
      <circle cx="12" cy="19.2" r="1.1" fill={P.trim} />
      <circle cx="6.4" cy="19.2" r=".9" fill={P.gem} />
      <circle cx="17.6" cy="19.2" r=".9" fill={P.gem} />
    </Ink>
  ),
  // oasis watch: a torch and a tasselled spear
  militia: (P) => (
    <Ink>
      <path d="m20.6 21.8 1.2-1.2L9.6 8.4 8.4 9.6Z" fill={P.woodDk} />
      <path d="m10.6 11.8 1.4-1.4 1.4 1.4-1.4 1.4Z" fill={P.accent} stroke-width=".6" />
      <Flame x={7.6} y={9.6} s={1.15} />
      <path d="m3.4 21.8-1.2-1.2L15.6 7.2l1.2 1.2Z" fill={P.wood} />
      <path d="M15 7.6C16 5.2 18.2 3.2 21.4 2.4c-.8 3.2-2.8 5.4-5.2 6.4Z" fill={P.blade} />
      <path d="m13.8 9.2 1.6 1.6" stroke={P.trim} stroke-width="1.8" />
      <path d="M14.2 11.2c-.6 1-.6 2.2 0 3.2.4-.6.8-1.2 1.4-1.4 0-.8-.6-1.4-1.4-1.8Z" fill={P.gem} stroke-width=".6" />
    </Ink>
  ),
  // camel caravans: a camel under a rolled carpet and turquoise saddlebags
  trader: (P) => (
    <Ink>
      <g transform="translate(3.2 1.2) scale(.86)">
        <CamelHead coat={CAMEL} P={P} />
      </g>
      <path d="M1.4 15c0-1.4 1-2.4 2.4-2.4h4.8c1.4 0 2.4 1 2.4 2.4v5c0 1.2-1 2.2-2.2 2.2H3.6c-1.2 0-2.2-1-2.2-2.2Z" fill={P.accent} />
      <path d="M1.6 16.4h9.4" stroke={P.trim} stroke-width=".9" />
      <path d={starPath(6.2, 19.2, 1.5, .7, 4)} fill={P.trimLt} stroke-width=".45" />
      <rect x=".8" y="9.4" width="10.6" height="3.2" rx="1.6" fill={P.gem} />
      <path d="M3 9.4v3.2M5.6 9.4v3.2M8.2 9.4v3.2" stroke={P.trim} stroke-width=".7" />
      <ellipse cx="10.9" cy="11" rx="1.1" ry="1.55" fill="#f0c890" stroke-width=".7" />
      <path d="M10.9 10.5c.4.2.4.8 0 1" fill="none" stroke={P.gem} stroke-width=".5" />
    </Ink>
  ),
};

const SAURIAN_ART: WildSet = {
  // skink spears: a knapped obsidian point, gold-bound, hung with red and green feathers
  spear: (P) => (
    <Ink>
      <path d="m3.2 21.8-1-1L16 7l1 1Z" fill={P.wood} />
      <path d="M14.8 7.8 16 5.2 22.2 1.8 18.8 8 16.2 9.2Z" fill={P.blade} />
      <path d="M16.9 5.6l.8 1.1M18.6 4.5l.7 1.1M20.2 3.4l.5 1" stroke={P.bladeLt} stroke-width=".6" />
      <path d="m13.2 8.2 2.6 2.6" stroke={P.trim} stroke-width="1.8" />
      <Feather x={13.2} y={10.6} a={205} len={6.4} c={P.accent} />
      <Feather x={14.2} y={11.2} a={180} len={5.4} c={QUETZAL} />
    </Ink>
  ),
  // saurus guards: a round feathered shield of gold and jade, an obsidian-edged club behind
  sword: (P) => (
    <Ink>
      <g transform="rotate(45 12 12)">
        <path d="M13.4 3.2l1.6 1-1.6 1.2ZM13.4 6.6l1.6 1-1.6 1.2ZM10.6 3.2 9 4.2l1.6 1.2ZM10.6 6.6 9 7.6l1.6 1.2Z" fill={P.blade} stroke-width=".5" />
        <path d="M10.4 11V2.4C10.4 1.2 11.1.4 12 .4s1.6.8 1.6 2V11Z" fill={P.woodLt} />
        <path d="M12 1.6V10" stroke={P.trim} stroke-width=".9" />
      </g>
      <Feather x={4.6} y={16.6} a={200} len={6} c={P.accent} />
      <Feather x={7.2} y={17.6} a={188} len={6.2} c={QUETZAL} />
      <Feather x={9.8} y={17.8} a={176} len={6} c={PLUME} />
      <Feather x={12.4} y={17.2} a={164} len={5.6} c={P.accent} />
      <circle cx="8.6" cy="11.2" r="7" fill={P.trim} stroke-width="1.1" />
      <circle cx="8.6" cy="11.2" r="5.6" fill={QUETZAL} stroke-width=".6" />
      <path d={starPath(8.6, 11.2, 4.6, 2.8, 8)} fill={P.accent} stroke-width=".5" />
      <circle cx="8.6" cy="11.2" r="2.3" fill={P.trim} stroke-width=".6" />
      <circle cx="8.6" cy="11.2" r=".9" fill={P.gem} stroke-width=".4" />
      <path d="M3.4 7.6c1-1.6 2.6-2.6 4.4-3" fill="none" stroke={P.trimLt} stroke-width=".9" />
    </Ink>
  ),
  // saurus warriors: a great war-club edged along both sides with obsidian teeth
  axe: (P) => (
    <Ink>
      <g transform="rotate(45 12 12)">
        {[1.4, 4.4, 7.4, 10.4, 13.4].map((y) => (
          <path d={`M9.6 ${y}l-2 1.2 2 1.4ZM14.4 ${y}l2 1.2-2 1.4Z`} fill={P.blade} stroke-width=".6" />
        ))}
        <path d="M9.4 17V2.4C9.4.8 10.6-.2 12-.2s2.6 1 2.6 2.6V17Z" fill={P.woodLt} />
        <path d="M10.6 2.6v13M13.4 2.6v13" stroke={P.wood} stroke-width=".6" />
        <path d="M11 4.4 12 3l1 1.4-1 1.4ZM11 9.4 12 8l1 1.4-1 1.4Z" fill={P.gem} stroke-width=".5" />
        <rect x="11.1" y="17" width="1.8" height="8" rx=".6" fill={P.woodDk} />
        <path d="M11.1 17.4h1.8M11.1 19h1.8" stroke={P.trim} stroke-width=".9" />
      </g>
      <Feather x={4.6} y={19.4} a={210} len={4.6} c={P.accent} />
    </Ink>
  ),
  // blowpipers: a long gold-banded cane, a poisoned dart just leaving it
  archer: (P) => (
    <Ink>
      <path d="M2.6 21.4 16.2 7.8" stroke={O} stroke-width="3.8" />
      <path d="M2.6 21.4 16.2 7.8" stroke="#c9b870" stroke-width="2.3" />
      <path d="M3.8 19.2 14.4 8.6" stroke="#e8dca0" stroke-width=".7" />
      <path d="m5.8 17 1.5 1.5M9.6 13.2l1.5 1.5M13.4 9.4l1.5 1.5" stroke={P.trimDk} stroke-width="1.1" />
      <circle cx="2.4" cy="21.6" r="1.3" fill={P.trim} />
      <Feather x={4.4} y={19.6} a={200} len={4.2} c={P.accent} />
      <path d="M17.4 6.6 20.6 3.4" stroke={P.woodDk} stroke-width="1" />
      <path d="m20.2 2.6 3-1.8-1.8 3Z" fill={P.blade} stroke-width=".5" />
      <path d="M16.8 6.2c-.4.8-.2 1.6.6 1.8.2-.8 0-1.4-.6-1.8Z" fill={P.accent} stroke-width=".4" />
      <path d="M22.4 4.6c-.7.9-.7 1.8 0 2.2.7-.4.7-1.3 0-2.2Z" fill={P.gem} stroke-width=".5" />
      <path d="M17.6 9.6c.6.2 1.2.2 1.8-.2M18.8 11c.6.2 1.2 0 1.6-.4" fill="none" stroke="#c9b870" stroke-width=".7" />
    </Ink>
  ),
  // chameleons: a casque-headed chameleon on a branch, turret eye rolling, tail curled tight
  scout: (P) => (
    <Ink>
      <path d="M1 20.4c4-.8 9-1.4 13.4-1.6 3-.2 5.8-.8 8.6-1.8" fill="none" stroke={O} stroke-width="2.4" />
      <path d="M1 20.4c4-.8 9-1.4 13.4-1.6 3-.2 5.8-.8 8.6-1.8" fill="none" stroke={P.wood} stroke-width="1.1" />
      <Leaf x={19.6} y={17.8} r={-30} c={SCALE_LT} />
      <path d="M7 13.4c-1.8.4-3 1.6-3 3.2 0 1.4 1.2 2.4 2.4 2.2 1.2-.2 1.6-1.4 1-2.2-.6-.6-1.4-.4-1.4.2" fill="none" stroke={O} stroke-width="2.6" />
      <path d="M7 13.4c-1.8.4-3 1.6-3 3.2 0 1.4 1.2 2.4 2.4 2.2 1.2-.2 1.6-1.4 1-2.2-.6-.6-1.4-.4-1.4.2" fill="none" stroke="#4cb04a" stroke-width="1.3" />
      <path d="M9.2 15.4 8.4 19.6M15 15.2l.8 3.8" stroke={O} stroke-width="1.6" />
      <path d="M9.2 15.4 8.4 19.6M15 15.2l.8 3.8" stroke="#3a9a3a" stroke-width=".7" />
      <path d="M5.8 12.6C6.6 8.8 9.8 7 13.4 7.4L16.8 5.4C19.4 5 21.8 6.6 22.6 9 23 10.8 22 12.4 20.4 12.6L17.4 13.2C16.2 15.2 13.6 16.4 10.4 16.2 7.8 16 6 14.6 5.8 12.6Z" fill="#5cc04a" />
      <path d="M8.2 13.6c1.6.8 3.6 1 5.6.6M7.6 11.2c.6.6 1.2.8 1.8.6M10.6 9.8c.4.6 1 1 1.6 1" fill="none" stroke="#f0d040" stroke-width=".9" />
      <path d="M7.4 9.8 8 8.8l.6.9M9.6 8.2l.6-1 .6.9M12 7.4l.6-1 .6.9" fill="#3a9a3a" stroke-width=".5" />
      <path d="M22.4 10.6c-1 .6-2.2.8-3.4.6" fill="none" stroke={O} stroke-width=".7" />
      <circle cx="18.6" cy="9" r="2.1" fill="#8ad05a" stroke-width=".7" />
      <circle cx="18.6" cy="9" r="1.2" fill="#f0d040" stroke-width=".5" />
      <circle cx="18.9" cy="8.9" r=".55" fill={O} stroke="none" />
    </Ink>
  ),
  light: (P) => (
    <Ink>
      <Lance shaft={P.wood} flag={QUETZAL} tip={P.blade} edge={P.trimLt} />
      <RaptorHead coat="#7a9a3a" crest={P.accent} />
    </Ink>
  ),
  marcher: (P) => (
    <Ink>
      <RiderBow wood={P.wood} string="#efe3c8" tip={P.blade} />
      <g transform="translate(-1.2 5.6) scale(.76)"><RaptorHead coat="#5e7e2e" crest={PLUME} /></g>
    </Ink>
  ),
  // horned riders: a three-horned beast behind its great spiked frill, studded with gold
  heavy: (P) => (
    <Ink>
      <path d="M13.4 5.2C11.2 2.2 7.4 1 4 2.2l.6 1.6-2.2.8 1 1.6-2 1.2 1.4 1.4-1.8 1.8 1.8 1-1.2 2 2 .6-.6 2.2h2.2l.4 2.4 2-1.2L9.4 16Z" fill="#c9542c" />
      <path d="M11.6 5.8C9.4 4.2 6.8 4 4.6 5M10.8 8.2C8.8 7 6.6 7 4.4 8" fill="none" stroke="#e88a4a" stroke-width=".8" />
      <circle cx="5.2" cy="5.4" r=".6" fill={P.trim} stroke-width=".4" />
      <circle cx="3.6" cy="9.4" r=".6" fill={P.trim} stroke-width=".4" />
      <circle cx="4.4" cy="13.4" r=".6" fill={P.trim} stroke-width=".4" />
      <path d="M4.8 22.6 6.4 16.4 13 13.4 14.6 22.6Z" fill="#7e8a5a" />
      <path d="M8.4 8.6C10 6.2 13 5.2 16 6.2L20.6 9C22 9.8 22.8 11.4 22.8 13L21.8 15.4 19.4 15.4C18 16.6 15.6 16.8 13.6 16 10.6 15 8.6 12.4 8.4 8.6Z" fill="#7e8a5a" />
      <path d="M20.6 11.4 23.4 13.2 22.2 15.8 20 15Z" fill="#3e3a2e" stroke-width=".7" />
      <path d="M13.4 7.2 20 1.2 15.6 8.4Z" fill={BONE} />
      <path d="M15.4 8 22.6 3.4l-5.4 5.8Z" fill={BONE} />
      <path d="M19 9.8 20.2 6.6l.8 3.4Z" fill={BONE} stroke-width=".7" />
      <circle cx="15.6" cy="10.8" r=".85" fill="#ffd23a" stroke-width=".5" />
      <path d="M10.4 12.6c1.4 1.4 3.4 2 5.4 1.8" fill="none" stroke="#a8b47a" stroke-width=".8" />
      <path d="M12.2 5.6c-.6 1.8-.6 3.8 0 5.6" fill="none" stroke={P.trim} stroke-width="1.3" />
      <circle cx="12.2" cy="8.4" r=".8" fill={P.gem} stroke-width=".4" />
    </Ink>
  ),
  // boneheads: a thick-skulled beast charging head-down, its dome ringed with knobs of bone
  ram: (P) => (
    <Ink>
      <path d="M7 11.4C4.4 10.4 2.2 9.4.6 7.4c1.4 3 3.4 5 6 6.2Z" fill="#b0763a" />
      <path d="M7.4 14.8c-.8 2.4-.6 4.6.6 6.4l-1.8 1.2h4.2l.6-1.6c-.6-1.8-.4-3.6.4-5.2Z" fill="#8a5a2a" />
      <ellipse cx="11" cy="12.8" rx="6.4" ry="4.4" fill="#b0763a" />
      <path d="M11.2 15.2c-.6 2.2-.4 4.2.6 6l-1.6 1.2h4l.4-1.4c-.6-1.8-.6-3.6 0-5.2Z" fill="#b0763a" />
      <path d="M6.6 11.2c1.2-.6 2.4-.8 3.6-.6M9.8 9.2c1-.4 2.2-.4 3.2 0" fill="none" stroke="#7a4a1e" stroke-width=".8" />
      <path d="M5.4 10.4c2.2-1.6 5.4-2.2 8.4-1.8l-.6 2.6c-2.6-.2-5 .2-7 1.2Z" fill={P.accent} />
      <path d="M6.6 10.4l.2-1.4M9.4 9.4l.2-1.2M12.2 9l.2-1.2" stroke={P.trim} stroke-width=".9" />
      <path d="M15.4 11c1-2.4 3.4-3.8 5.8-3.4 2 .4 3 2.2 2.6 4.2-.2 1.4-1.2 2.6-2.4 3l.4 2.2-1.8.4-.8-1.8c-1.6 0-3-.6-3.8-1.8Z" fill="#b0763a" />
      <path d="M16.6 9.4c.8-1.8 2.6-2.8 4.4-2.6 1.8.2 3 1.6 3 3.4 0 1-.4 1.8-1 2.4-1.8 0-3.6-.6-5-1.8Z" fill={BONE} />
      <path d="M17.8 9c.6-.8 1.6-1.2 2.6-1.2" fill="none" stroke="#fff" stroke-width=".7" />
      <circle cx="16.4" cy="11.8" r=".55" fill={BONE_DK} stroke-width=".4" />
      <circle cx="17.6" cy="13" r=".55" fill={BONE_DK} stroke-width=".4" />
      <circle cx="16.2" cy="9.6" r=".55" fill={BONE_DK} stroke-width=".4" />
      <circle cx="20" cy="13" r=".7" fill="#ffd23a" stroke-width=".4" />
      <path d="M22.6 15.2c-.4.4-1 .6-1.6.4" fill="none" stroke={O} stroke-width=".6" />
    </Ink>
  ),
  // temple slingers: a war-engine on a stepped stone base, flinging a golden sunstone
  catapult: (P) => (
    <Ink>
      <path d="m7.4 15 1.6 1 9.4-12.2-1.6-1.2Z" fill={P.woodLt} />
      <circle cx="18.6" cy="3.6" r="2.8" fill={P.trim} />
      <circle cx="18.6" cy="3.6" r="1.8" fill="none" stroke={P.trimDk} stroke-width=".6" stroke-dasharray=".8 .6" />
      <circle cx="18.6" cy="3.6" r=".9" fill={P.gem} stroke-width=".5" />
      <path d="M10.2 14.6 12.6 9h1.8l-1.4 5.6Z" fill={P.woodDk} />
      <Feather x={12.6} y={10.4} a={-120} len={3.6} c={P.accent} />
      <path d="M1.6 22V19h2.4v-2.4H7V14.4h10v2.2h3V19h2.4v3Z" fill={P.shot} />
      <path d="M1.6 19h20.8M4 16.6h16M7 14.4h10" fill="none" stroke="#8a8068" stroke-width=".8" />
      <path d="M8.6 15.4h6.8" stroke={P.gem} stroke-width="1" />
      <path d="M4 20.4h2.4M10.8 20.4h2.4M17.6 20.4H20" stroke={P.trim} stroke-width="1.1" />
    </Ink>
  ),
  // sun priests: a headdress of long plumes around a golden sun, on a jade-set band
  noble: (P) => (
    <Ink>
      <Feather x={12} y={16} a={-62} len={10} c={QUETZAL} w={1.4} />
      <Feather x={12} y={16} a={62} len={10} c={QUETZAL} w={1.4} />
      <Feather x={12} y={16} a={-40} len={12} c={P.accent} w={1.5} />
      <Feather x={12} y={16} a={40} len={12} c={P.accent} w={1.5} />
      <Feather x={12} y={16} a={-18} len={13.4} c={PLUME} w={1.5} />
      <Feather x={12} y={16} a={18} len={13.4} c={PLUME} w={1.5} />
      <Feather x={12} y={16} a={0} len={14.6} c={QUETZAL} w={1.5} />
      <circle cx="12" cy="13.2" r="3.4" fill={P.trim} />
      <path d={starPath(12, 13.2, 2.6, 1.6, 8)} fill={P.trimLt} stroke-width=".5" />
      <circle cx="12" cy="13.2" r="1" fill={P.accent} stroke-width=".5" />
      <path d="M2.4 17.4h19.2v3.6H2.4Z" fill={P.trim} />
      <path d="M4 19.2h2.2M17.8 19.2H20" stroke={P.trimDk} stroke-width="1" />
      <circle cx="12" cy="19.2" r="1.1" fill={P.gem} />
      <circle cx="8.4" cy="19.2" r=".9" fill={P.gem} />
      <circle cx="15.6" cy="19.2" r=".9" fill={P.gem} />
    </Ink>
  ),
  // jungle folk: a torch and a hunter's club, a feather tied at the grip
  militia: (P) => (
    <Ink>
      <path d="m20.6 21.8 1.2-1.2L9.6 8.4 8.4 9.6Z" fill={P.woodDk} />
      <path d="m10.6 11.8 1.4-1.4 1.4 1.4-1.4 1.4Z" fill={P.trim} stroke-width=".6" />
      <Flame x={7.6} y={9.6} s={1.15} />
      <path d="M3.4 21.8 2.2 20.6 13 9.8C13.4 7.4 15.4 5.6 18 5.4c2.4-.2 3.6 1.4 3.2 3.4-.4 2.4-2.8 4-5.6 3.6Z" fill={P.woodLt} />
      <path d="m16.6 6.4.4-1.4M19.8 7.6l1.2-.6M18.6 11.2l.4 1.2" stroke={P.blade} stroke-width="1.2" />
      <circle cx="17.2" cy="8.8" r="1" fill={P.gem} stroke-width=".5" />
      <Feather x={5.4} y={18.8} a={220} len={4.4} c={P.accent} />
    </Ink>
  ),
  // pack lizards: a great slow lizard with woven baskets of the jungle's goods
  trader: (P) => (
    <Ink>
      <g transform="translate(4 .8) scale(.86)">
        <path d="M6.4 8.4 5 6.8l2 .2L6.8 5l1.8.8.2-2 1.4 1.6" fill="#8a6e2a" stroke-width=".6" />
        <path d={lizardHead} fill="#a8903e" />
        <path d="M13.8 15.6c.2 2 1.4 3.4 3 3.8.2-1.6-.4-3.4-1.4-4.6Z" fill={P.accent} stroke-width=".7" />
        <path d="M8.4 9c.6 1.4.6 2.8 0 4.2M11 9.4c.4 1.2.4 2.4 0 3.6M7.2 16.4c1.4.4 2.8.4 4.2 0" fill="none" stroke="#6e5a1e" stroke-width=".8" />
        <path d="M14 7.6 17 8" stroke={O} stroke-width="1" />
        <circle cx="15.6" cy="9.2" r=".9" fill="#ffd23a" stroke-width=".5" />
        <path d="M15.6 8.5v1.4" stroke={O} stroke-width=".5" />
        <path d="M22 11.2c-1.4.6-3.2.8-5 .6" fill="none" stroke={O} stroke-width=".7" />
      </g>
      <path d="M1.4 12.4h10l-1 8.6c-.1.8-.8 1.4-1.6 1.4H4c-.8 0-1.5-.6-1.6-1.4Z" fill="#c9a060" />
      <path d="M2 15.2h9M2.4 18.2h8.2M4.6 12.4l.6 10M8.2 12.4l-.6 10" stroke="#8a6230" stroke-width=".7" />
      <path d="M2.4 12.4c0-2 1.2-3.6 3-3.6.4-1.2 1.6-1.8 2.8-1.4 1.6.4 2.6 2 2.2 3.6l.2 1.4Z" fill="#e8c83a" />
      <circle cx="4.8" cy="10.8" r="1.2" fill={P.accent} stroke-width=".6" />
      <path d="M8 8.4c.4 1 .4 2 0 3" fill="none" stroke="#a88a1e" stroke-width=".6" />
      <path d="M1 13.6h11" stroke={P.accent} stroke-width="1.2" />
    </Ink>
  ),
};

/** the wilds' troops, by village theme (the older realms are drawn in UNIT_ART) */
const WILD_ART: Partial<Record<VillageTheme, WildSet>> = { frost: FROST_ART, dwarf: DWARF_ART, djinn: DJINN_ART, saurian: SAURIAN_ART };

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
  // the Orc King: a great tusked warlord in a crown of iron and gold, his war-axe over his shoulder
  orc: () => (
    <Ink>
      <path d="M17.6 7.6 21.8 22.4" stroke={O} stroke-width="3" />
      <path d="M17.6 7.6 21.8 22.4" stroke={WOOD} stroke-width="1.5" />
      <path d="M18 5.8c1.4-2 3-3.4 5.4-3.8-.2 3.2 0 6 .4 8.6-2.2-.2-4 .4-5.4 1.6Z" fill={STEEL} stroke-width="1" />
      <path d="M22.2 3.4c-.2 2.2 0 4.4.4 6.2" fill="none" stroke={STEEL_LT} stroke-width=".9" />
      <path d="m20.6 8.6.8-.2" stroke={O} stroke-width=".8" />
      <path d="M1.4 23c.2-3.8 2-6.2 5-7.4h9.4c3 1.2 4.8 3.6 5 7.4Z" fill="#5a3e28" stroke-width="1.1" />
      <path d="M2.6 21.4c.4-1.8 1.4-3.2 2.8-4M19.6 21.4c-.4-1.8-1.4-3.2-2.8-4" fill="none" stroke="#8a6a48" stroke-width=".9" />
      <path d="M3.4 17.6C2.6 15.8 3.4 14 5.4 13.8l2.2 2.6Z" fill="#6a6560" stroke-width=".8" />
      <path d="M18.8 17.6c.8-1.8 0-3.6-2-3.8l-2.2 2.6Z" fill="#6a6560" stroke-width=".8" />
      <path d="M6.4 9.2 3.2 7.6l1 4.6 2.4.6ZM17 9.2l3.2-1.6-1 4.6-2.4.6Z" fill={ORC_SKIN} />
      <path d="M11.7 4.8c3.2 0 5.6 1.8 5.6 5.2v2.8c0 3.4-2.4 5.8-5.6 5.8s-5.6-2.4-5.6-5.8V10c0-3.4 2.4-5.2 5.6-5.2Z" fill={ORC_SKIN} />
      <path d="M7.6 8.6c.4-1.4 1.4-2.4 2.8-2.8" fill="none" stroke={ORC_SKIN_LT} stroke-width="1" />
      <path d="M8.4 15.2c1.8 1.2 4.8 1.2 6.6 0-.4 1.8-1.8 2.8-3.3 2.8s-2.9-1-3.3-2.8Z" fill={ORC_SKIN_DK} stroke-width=".7" />
      <path d="M6.3 10.6c3.6-.9 7.2-.9 10.8 0v2.2c-3.6-.7-7.2-.7-10.8 0Z" fill="#b02a1e" stroke="none" />
      <path d="M7.4 9.4 10.8 10.6M16 9.4l-3.4 1.2" stroke={O} stroke-width="1.4" />
      <circle cx="9.4" cy="11.7" r=".85" fill="#ffc83a" stroke-width=".5" />
      <circle cx="14" cy="11.7" r=".85" fill="#ffc83a" stroke-width=".5" />
      <path d="M11 13.6h1.4" stroke={ORC_SKIN_DK} stroke-width="1" />
      <path d={orcTusk(9.2, 15.6)} fill={TUSK} stroke-width=".6" />
      <path d={orcTusk(14.2, 15.6, true)} fill={TUSK} stroke-width=".6" />
      <path d="M6 7.4 5.8 2.8l2.2 2L9.4 1l2.3 3.2L14 1l1.4 3.8 2.2-2-.2 4.6Z" fill={GOLD} />
      <path d="M6 6.2h11.4v1.8H6Z" fill={GOLD_DK} stroke-width=".8" />
      <circle cx="11.7" cy="7.1" r=".9" fill="#b02a1e" stroke-width=".5" />
      <path d="M7.4 6.8h3" stroke={GOLD_LT} stroke-width=".7" />
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
  // the Frost Queen: silver hair, a crown of ice, a high crystal collar, her staff crowned with a star of ice
  frost: () => (
    <Ink>
      <path d="M19 8.6 20.8 22.8" stroke={O} stroke-width="2.6" />
      <path d="M19 8.6 20.8 22.8" stroke="#e4ecf4" stroke-width="1.2" />
      <path d={starPath(18.8, 4.6, 4, 1.3, 6)} fill={ICE} stroke-width=".8" />
      <circle cx="18.8" cy="4.6" r="1" fill="#3f7fc6" stroke-width=".5" />
      <path d="M4.6 17.2 3.4 9.8 6 12.2l.4-4.8 2.2 3.6h6.8l2.2-3.6.4 4.8 2.6-2.4-1.2 7.4Z" fill={ICE} />
      <path d="M3.4 9.8 6 12.2M20.6 9.8 18 12.2" stroke={ICE_DK} stroke-width=".6" />
      <path d="M2.2 23.2c.4-3.8 2.4-6.2 5.6-7h8.4c3.2.8 5.2 3.2 5.6 7Z" fill="#9ccaee" />
      <path d="M12 18.6v4.6" stroke="#6fa4d4" stroke-width=".8" />
      <path d="M4.4 18.6c2.2 1 4.6.6 6-.8l1.6 1.2 1.6-1.2c1.4 1.4 3.8 1.8 6 .8-1-1.6-2.4-2.6-3.8-3H8.2c-1.4.4-2.8 1.4-3.8 3Z" fill={FUR} />
      <circle cx="12" cy="18.8" r="1" fill="#3f7fc6" stroke-width=".5" />
      <path d="M6.8 17.4c-1-3.4-1-7.2.4-9.8 1.2-2 3-3 4.8-3s3.6 1 4.8 3c1.4 2.6 1.4 6.4.4 9.8-1.2-.8-2-2.4-2.2-4.4H9c-.2 2-1 3.6-2.2 4.4Z" fill="#eef2f8" />
      <path d="M8.2 15.2c-.6-2-.6-4.2.2-6M15.8 15.2c.6-2 .6-4.2-.2-6" fill="none" stroke="#b9c6da" stroke-width=".8" />
      <path d="M12 7.2c1.9 0 3 1.5 3 3.7 0 2.5-1.3 4.3-3 4.3s-3-1.8-3-4.3c0-2.2 1.1-3.7 3-3.7Z" fill="#f7e8e0" />
      <path d="M10.2 10.8h1.2M12.6 10.8h1.2" stroke="#2c5a9a" stroke-width=".85" />
      <path d="M11.5 13.4h1" stroke="#b86a86" stroke-width=".7" />
      <path d="M8.4 7.6 7.8 3.6l2 1.6L10.8 2 12 .2 13.2 2l1 3.2 2-1.6-.6 4Z" fill={ICE} />
      <path d="M12 .2 13.2 2l1 3.2-2.2 2.4ZM7.8 3.6l2 1.6-.2 2.4" fill={ICE_SHADE} stroke-width=".4" />
      <path d="M8.4 7h7.2v1.4H8.4Z" fill="#9fb8d0" stroke-width=".6" />
      <circle cx="12" cy="7.7" r=".6" fill="#3f7fc6" stroke="none" />
    </Ink>
  ),
  // the Forgelord: a dwarf-king in bronze, a great braided beard ringed with gold, a heavy crown, his rune-hammer on his shoulder
  dwarf: () => (
    <Ink>
      <path d="M17 7.6 21 22.8" stroke={O} stroke-width="3" />
      <path d="M17 7.6 21 22.8" stroke={WOOD} stroke-width="1.5" />
      <g transform="translate(-1.2 .2) rotate(-15 18.6 5.6)">
        <path d="M14.6 3h8v5.2h-8Z" fill="#8f8a82" />
        <path d="M13.6 2.6h1v6h-1ZM22.6 2.6h1v6h-1Z" fill={IRON} />
        <path d="M17.2 3H20v5.2h-2.8Z" fill={BRONZE} stroke-width=".6" />
        <Rune d="M18.6 3.8v3.6M18.6 4.6l1 .8-1 .8" w={0.6} />
      </g>
      <path d="M1.2 23.2c.2-3.8 2-6.4 5-7.6h11.6c3 1.2 4.8 3.8 5 7.6Z" fill="#8a2a1e" />
      <path d="M3.6 23.2c.2-2.8 1.4-4.8 3.4-5.8h10c2 1 3.2 3 3.4 5.8Z" fill={BRONZE} />
      <path d="M2.6 18.8c-.6-1.8.2-3.6 2.2-4l2.4 2.6ZM21.4 18.8c.6-1.8-.2-3.6-2.2-4l-2.4 2.6Z" fill={BRONZE_LT} />
      <path d="M12 4.8c2.8 0 4.8 2 4.8 5v1.6c0 1.4-.4 2.6-1.2 3.4H8.4c-.8-.8-1.2-2-1.2-3.4V9.8c0-3 2-5 4.8-5Z" fill={SKIN} />
      <path d="M6.8 10.6c-.8 3.8 0 7.4 2.2 10l1.4-1.2 1.6 2.2 1.6-2.2 1.4 1.2c2.2-2.6 3-6.2 2.2-10-1.2 1.8-3 2.8-5.2 2.8s-4-1-5.2-2.8Z" fill={BEARD} />
      <path d="M9.6 15.2c0 1.6.4 3 1 4M14.4 15.2c0 1.6-.4 3-1 4M12 15.4v4" fill="none" stroke={BEARD_DK} stroke-width=".6" />
      <path d="M9.6 18.4h1.6M12.8 18.4h1.6" stroke={GOLD} stroke-width="1.2" />
      <path d="M8.4 12c1.2-.8 2.6-.8 3.6.2 1-1 2.4-1 3.6-.2-.4 1.4-2 1.8-3.6 1.2-1.6.6-3.2.2-3.6-1.2Z" fill={BEARD_LT} stroke-width=".6" />
      <path d="M11.2 9.6c0 1.2.2 2 .8 2.4.6-.4.8-1.2.8-2.4Z" fill="#d89a6a" stroke-width=".6" />
      <path d="M8.8 8.4 11 9M15.2 8.4 13 9" stroke={BEARD_DK} stroke-width="1.1" />
      <circle cx="10" cy="9.9" r=".6" fill={O} stroke="none" />
      <circle cx="14" cy="9.9" r=".6" fill={O} stroke="none" />
      <path d="M7 7.4 6.8 3.4h2.4V5h1.6V2.2h2.4V5h1.6V3.4h2.4l-.2 4Z" fill={GOLD} />
      <path d="M7 6.4h10V8H7Z" fill={GOLD_DK} stroke-width=".7" />
      <circle cx="12" cy="4" r=".8" fill={RUNE} stroke-width=".5" />
      <path d="M8 4.4v1.6" stroke={GOLD_LT} stroke-width=".7" />
    </Ink>
  ),
  // the Djinn: blue-skinned, arms folded in golden bracers, a topknot, trailing smoke down into his lamp
  djinn: () => (
    <Ink>
      <path d="M8 15.4h8.2c.4 2.4-.6 4.2-2.6 5-1.6.6-3.2.4-4.2 1.2-.8.6-1 1.4-.8 2-1.4-.4-2-1.4-1.8-2.6.2-1.2 1.2-2 2.4-2.4-1.2-.8-1.6-1.8-1.2-3.2Z" fill={DJINN_LT} />
      <path d="M14.6 17c-.6 1.2-1.8 1.8-3.2 2" fill="none" stroke={DJINN} stroke-width=".7" />
      <path d="M5.4 16.2c-.2-2.8.8-4.8 3-5.4h7.2c2.2.6 3.2 2.6 3 5.4Z" fill={DJINN} />
      <path d="M9.4 11c1.6 1 3.6 1 5.2 0" fill="none" stroke={GOLD} stroke-width=".9" />
      <path d="M4.4 12.8c2.4-.6 5-.6 7.6.2 2.6-.8 5.2-.8 7.6-.2l.2 2.6c-2.6.6-5.2.6-7.8 0-2.6.6-5.2.6-7.8 0Z" fill={DJINN} />
      <path d="M6.8 13.4c1.6-.2 3.2 0 4.6.6" fill="none" stroke={DJINN_LT} stroke-width=".7" />
      <path d="M4.2 12.8h2.6v2.8H4.2ZM17.2 12.8h2.6v2.8h-2.6Z" fill={GOLD} stroke-width=".8" />
      <path d="M8.8 6.4 6.4 5.4l1.8 2.8ZM15.2 6.4l2.4-1-1.8 2.8Z" fill={DJINN} stroke-width=".8" />
      <path d="M12 3.2c2.1 0 3.4 1.6 3.4 3.8S14.1 10.8 12 10.8 8.6 9.2 8.6 7 9.9 3.2 12 3.2Z" fill={DJINN} />
      <path d="M9.6 6.6c.2-1.4 1-2.4 2-2.8" fill="none" stroke={DJINN_LT} stroke-width=".8" />
      <path d="M10 7.2h1.4M12.6 7.2H14" stroke="#ffe08a" stroke-width="1" />
      <path d="M9.6 6.2 11.4 6.8M14.4 6.2l-1.8.6" stroke={DJINN_DK} stroke-width=".8" />
      <path d="M11.2 9.6h1.6" stroke={DJINN_DK} stroke-width=".7" />
      <path d="M11.4 10.6 12 12.2l.6-1.6Z" fill="#1e1a2a" stroke-width=".4" />
      <path d="M11.2 3.4c-.2-1.2.2-2 .8-2.6.6.6 1 1.4.8 2.6Z" fill="#1e1a2a" stroke-width=".6" />
      <path d="M12 .9c1.6-.8 3.6-.4 5 1-1.6-.2-3 .2-4 1Z" fill="#1e1a2a" stroke-width=".6" />
      <path d="M13 1.1c1-.3 2-.2 2.8.3M11.7 1.4c-.2.4-.2.9 0 1.3" fill="none" stroke="#6a5aa0" stroke-width=".5" />
      <path d="M11.2 2.8h1.6" stroke={GOLD} stroke-width=".9" />
      <circle cx="7" cy="7.8" r=".6" fill={GOLD} stroke-width=".4" />
      <circle cx="17" cy="7.8" r=".6" fill={GOLD} stroke-width=".4" />
      <path d="M11.2 21.2c1.6-.4 3.2-.4 4.8 0h3.4c.6-.8 1.6-1.2 2.6-1l.2.8c-.8.2-1.2.8-1.4 1.4-.4 1-1.4 1.6-2.6 1.6h-4.8c-1 0-1.8-.4-2.2-1.2Z" fill={GOLD} />
      <path d="M6.8 21.8c1.4-.8 3-1 4.4-.6l.8 1.2c-1.4-.4-2.8-.4-4 .2Z" fill={GOLD} stroke-width=".7" />
      <path d="M15.8 21.2c.2-.8.8-1.2 1.4-1.2s1.2.4 1.4 1.2" fill={GOLD_DK} stroke-width=".6" />
      <path d="M13.4 22.2h4.4" stroke={GOLD_LT} stroke-width=".6" />
    </Ink>
  ),
  // the Saurian King: a great saurian in a diadem of gold and a fan of jungle plumes, jaws full of teeth
  saurian: () => (
    <Ink>
      <path d="M1.2 23.2c.4-4 2.6-6.6 6-7.6h7.2c2.8.8 4.6 2.8 5.4 5.6l.2 2Z" fill={SCALE_DK} />
      <path d="M4.6 17.6c3 1.8 7.8 2 11.2.2l.8 2.4c-4 2-9.4 1.8-12.8-.4Z" fill={GOLD} />
      <circle cx="10.4" cy="19.6" r="1" fill={JADE} stroke-width=".5" />
      <Feather x={7.6} y={9.4} a={-92} len={7} c={QUETZAL} />
      <Feather x={7.8} y={8.4} a={-66} len={8} c="#d8402a" />
      <Feather x={8.4} y={7.6} a={-40} len={8.4} c={PLUME} />
      <Feather x={9.4} y={7} a={-16} len={7.8} c={QUETZAL} />
      <Feather x={10.6} y={6.6} a={8} len={6.4} c={GOLD} />
      <path d="M13.8 12.2 20.8 11.8 20.4 13.6 14.8 13.6Z" fill={MAW} stroke="none" />
      <path d="M5.4 16C4.2 13.2 4.8 9.6 7.4 7.6 9.6 5.8 13 5.4 16 6.6l5 2.2c1.2.6 1.8 1.8 1.4 3l-.6 1.2-5.4.2.2.8 3.8.2c-.6 1.4-2 2.2-3.6 2l-4.4-.4c-1.2 1.2-2.8 1.8-4.6 1.6Z" fill={SCALE} />
      <path d="M17.2 12.1l.4.9.4-.9M18.6 12.1l.4.9.4-.9M19.8 12.1l.3.8.3-.8M17.6 13.7l.4-.8.4.8" fill="#fff" stroke-width=".35" />
      <path d="M8 12.4c1.2 1 2.8 1.4 4.4 1.2M6.8 9.8c.4.8 1 1.2 1.8 1.2" fill="none" stroke={SCALE_LT} stroke-width=".8" />
      <circle cx="9.8" cy="13.8" r=".45" fill={SCALE_DK} stroke="none" />
      <circle cx="11.8" cy="15" r=".45" fill={SCALE_DK} stroke="none" />
      <circle cx="8.2" cy="15.4" r=".45" fill={SCALE_DK} stroke="none" />
      <path d="M12.8 7.8 16.2 8.6" stroke={O} stroke-width="1.2" />
      <circle cx="14.6" cy="9.6" r="1.1" fill="#ffd23a" stroke-width=".5" />
      <path d="M14.6 8.8v1.6" stroke={O} stroke-width=".6" />
      <path d="M21.2 9.4l.6.4" stroke={O} stroke-width=".8" />
      <path d="M8.2 8.2C10.4 6.2 13.4 5.4 16.4 5.8l.4 1.8c-2.8-.4-5.6.2-7.8 1.8Z" fill={GOLD} />
      <circle cx="12.6" cy="6.6" r=".9" fill={JADE} stroke-width=".5" />
      <path d="M1.8 21.8c.6-1.6 1.6-2.8 2.8-3.4" fill="none" stroke={SCALE} stroke-width=".8" />
      <circle cx="4" cy="21.4" r=".45" fill={SCALE} stroke="none" />
      {/* and his raptor at his side */}
      <g transform="translate(12.8 13.2) scale(.45)">
        <RaptorHead coat="#b07a34" crest={PLUME} />
      </g>
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
  manager: () => (
    <Ink>
      <path d="M4.2 2.6h11.6l3.2 3.2v15.6H4.2Z" fill="#f3e2bd" />
      <path d="M15.8 2.6v3.2H19" fill="#d9c28f" />
      <path d="m6.4 8 1.1 1.1 2-2.2M6.4 12.4l1.1 1.1 2-2.2M6.4 16.8l1.1 1.1 2-2.2" fill="none" stroke="#4c7524" stroke-width="1.3" />
      <path d="M11 8.6h5.4M11 13h5.4M11 17.4h3.6" stroke="#8a6a2a" stroke-width="1.2" />
      <path d="m16.6 14.6 5 5-1.6 1.6-5-5Z" fill="#8b5a2b" />
      <path d="m13.6 12.4 3.4-1.6 2 2-1.6 3.4-1.4-1.4-1.4 1.4-1.4-1.4 1.4-1.4Z" fill={STEEL} />
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
  // two sheets, one over the other: copy to the clipboard
  copy: () => (
    <g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
      <rect x="8.5" y="8.5" width="11.5" height="12.5" rx="2" />
      <path d="M15.5 5.5V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9.5a2 2 0 0 0 2 2h.5" />
    </g>
  ),
  link: () => (
    <path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l3.2-3.2a3.6 3.6 0 0 0-5.1-5.1l-1.2 1.2m1.6 5.3a3.6 3.6 0 0 0-5.1 0l-3.2 3.2a3.6 3.6 0 0 0 5.1 5.1l1.2-1.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  ),
  check: () => <path d="m4 12.6 5.2 5.2L20 7l-1.6-1.6-9.2 9.2-3.6-3.6Z" fill="currentColor" />,
};

// every troop in each village's style: 'spear' is the classic, 'goblin_spear' the goblin one
const DRAWN_THEMES: VillageTheme[] = ['classic', 'paladin', 'goblin', 'sorcerer', 'druid', 'necromancer', 'orc', 'frost', 'dwarf', 'djinn', 'saurian'];
for (const [u, art] of Object.entries(UNIT_ART) as [UnitId, Art][]) {
  for (const t of DRAWN_THEMES) {
    const own = WILD_ART[t]?.[u];
    paths[t === 'classic' ? u : `${t}_${u}`] = own ? () => own(PAL[t]) : () => art(PAL[t], t);
  }
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
