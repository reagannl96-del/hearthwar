// Low-poly toolkit: autumn palette, cached materials, shape helpers and "baking"
// (merging many small parts into one mesh per material for speed).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// (the Oasis's houses and towers; oasis.ts touches nothing of this module at load time, so the cycle is safe)
import { oasisHouse, oasisTower } from './oasis';
// (the Frost Queen's houses and towers; frosthold.ts likewise reads nothing of this module at load time)
import { frostHouse, frostTower } from './frosthold';

export const C = {
  grass: 0x8f9447,
  grassLight: 0xa9a452,
  grassDark: 0x6f7a3a,
  grassRust: 0xa0843f,
  dirt: 0xc8a26a,
  dirtDark: 0xa98654,
  plaster: 0xeadcbf,
  plasterWarm: 0xe2cfa6,
  timber: 0x5a3a22,
  timberLight: 0x8a5f3a,
  tile: 0xb3502c,
  tileDark: 0x8e3a1f,
  tileWarm: 0xc4683a,
  thatch: 0xc9a150,
  thatchDark: 0x9f7a36,
  stone: 0xaba494,
  stoneDark: 0x847d6f,
  stoneLight: 0xc9c2b1,
  slate: 0x5d626b,
  wood: 0x8b5a2b,
  woodDark: 0x5d3a1c,
  logEnd: 0xd8a66a,
  leafOrange: 0xd9772b,
  leafRed: 0xb03f26,
  leafYellow: 0xe2b43c,
  leafGold: 0xc98f2e,
  leafGreen: 0x6f7c35,
  pine: 0x3c5a2c,
  pineDark: 0x2c4422,
  trunk: 0x5a3d25,
  water: 0x4f86a3,
  clay: 0xb8643c,
  clayDark: 0x8e4629,
  brick: 0xa8472e,
  iron: 0x6d7782,
  rock: 0x8d877a,
  rockDark: 0x6a655b,
  wheat: 0xd8b24a,
  wheatDark: 0xb98f2f,
  hay: 0xd6ad55,
  pumpkin: 0xe07b24,
  red: 0xb3332a,
  white: 0xf1e8d4,
  blue: 0x2f5d99,
  gold: 0xd9a441,
  window: 0x2a2018,
  door: 0x4a2f1a,
  dark: 0x241a12,
  fire: 0xff9a3a,
  flame: 0xffd35a,
  horse: 0x6b4a30,
  horseDark: 0x3b2a1c,
  skin: 0xe0b48a,
} as const;

const cache = new Map<string, THREE.MeshLambertMaterial>();

export type Season = 'fall' | 'winter' | 'volcanic' | 'desert' | 'jungle';
let season: Season = 'fall';
export function setSeason(s: Season) {
  season = s;
}
export function getSeason(): Season {
  return season;
}

/** In winter, roofs, fields and foliage are buried under snow. */
const WINTER: Record<number, number> = {
  [C.tile]: 0xe9eef3, [C.tileDark]: 0xc9d3dc, [C.tileWarm]: 0xe4eaef, [C.thatch]: 0xe7ecf0, [C.thatchDark]: 0xc6d0d8,
  [C.slate]: 0xdde5ec, [C.leafOrange]: 0xeef3f7, [C.leafRed]: 0xe2e9ef, [C.leafYellow]: 0xf3f6f8, [C.leafGold]: 0xdde5eb,
  [C.leafGreen]: 0xe6ecf0, [C.hay]: 0xe7ecef, [C.wheat]: 0xf0f4f7, [C.wheatDark]: 0xd3dce3, [C.pumpkin]: 0xdfe7ed,
  [C.grass]: 0xe8eef2, [C.grassLight]: 0xf1f5f8, [C.grassDark]: 0xd6dfe6, [C.grassRust]: 0xdce3e8, [C.pine]: 0x2e4a2e,
  [C.pineDark]: 0x243d26, [C.clay]: 0x9c7a62, [C.clayDark]: 0x85695a, [C.water]: 0x9fc3d8,
  [C.dirt]: 0xcfc5b3, [C.dirtDark]: 0xb3a791, [C.rock]: 0xd0d5da, [C.rockDark]: 0x9aa0a6,
};

/** In the volcanic west the ground is ash and black rock, water runs as lava and the trees are burnt. */
const VOLCANIC: Record<number, number> = {
  [C.grass]: 0x4c4846, [C.grassLight]: 0x5a5552, [C.grassDark]: 0x3b3736, [C.grassRust]: 0x5e4034,
  [C.dirt]: 0x3f3a38, [C.dirtDark]: 0x2e2a29, [C.water]: 0xe0561c, [C.rock]: 0x3d3533, [C.rockDark]: 0x2b2422,
  [C.leafOrange]: 0x3a302c, [C.leafRed]: 0x4a2a22, [C.leafYellow]: 0x4a403a, [C.leafGold]: 0x3f3530, [C.leafGreen]: 0x3a3632,
  [C.pine]: 0x2e2826, [C.pineDark]: 0x241e1c, [C.clay]: 0x6a3a28, [C.clayDark]: 0x4e2a1e, [C.pumpkin]: 0x9a4a1e,
  0x97a24e: 0x55504c, 0x7f8d43: 0x46423f, 0x8b984a: 0x4e4945,
};

/** In the eastern desert the ground is sand, water is an oasis, rock is red mesa and the trees are dusty palms and olives. */
const DESERT: Record<number, number> = {
  [C.grass]: 0xd9b979, [C.grassLight]: 0xe6c98c, [C.grassDark]: 0xc6a266, [C.grassRust]: 0xcc9a5c,
  [C.dirt]: 0xbf9460, [C.dirtDark]: 0xa67c4c, [C.water]: 0x35a9b3, [C.rock]: 0xbb7650, [C.rockDark]: 0x8e5236,
  [C.leafOrange]: 0x8c9c4c, [C.leafRed]: 0x7a8c44, [C.leafYellow]: 0xaaa65a, [C.leafGold]: 0x9c924a, [C.leafGreen]: 0x6c8a3c,
  [C.pine]: 0x5c6c3c, [C.pineDark]: 0x4a5a32, [C.clay]: 0xc27c4c, [C.clayDark]: 0xa4643c, [C.hay]: 0xdcc27e,
  [C.wheat]: 0xd8be70, [C.wheatDark]: 0xbca058, [C.pumpkin]: 0xd89a3a,
  0x97a24e: 0xd4b474, 0x7f8d43: 0xc09e62, 0x8b984a: 0xcaa86a,
};

/** In the southern jungle everything is deep, wet green: dark earth, green rivers, mossy rock. */
const JUNGLE: Record<number, number> = {
  [C.grass]: 0x347a30, [C.grassLight]: 0x418a36, [C.grassDark]: 0x275e27, [C.grassRust]: 0x4d7a2e,
  [C.dirt]: 0x7a5c3a, [C.dirtDark]: 0x5e4629, [C.water]: 0x2c8c7a, [C.rock]: 0x6c7462, [C.rockDark]: 0x4e5646,
  [C.leafOrange]: 0x2f7c34, [C.leafRed]: 0x3a8c3c, [C.leafYellow]: 0x5ca242, [C.leafGold]: 0x4a9239, [C.leafGreen]: 0x2e6e2e,
  [C.pine]: 0x255c2b, [C.pineDark]: 0x1c4a22, [C.hay]: 0x9aa050, [C.wheat]: 0x8aa044, [C.wheatDark]: 0x6c8a34,
  0x97a24e: 0x469a3e, 0x7f8d43: 0x357a32, 0x8b984a: 0x3e8a38,
};

/** Each statue hero gives the village its own look. */
export type Theme = 'classic' | 'paladin' | 'sorcerer' | 'druid' | 'goblin' | 'necromancer' | 'orc' | 'frost' | 'dwarf' | 'djinn' | 'saurian';
let theme: Theme = 'classic';
export function setTheme(t: Theme) {
  // a look the 3D village doesn't know yet (a hero whose village is still being raised) is drawn plain
  theme = t in THEMES ? t : 'classic';
}
export function getTheme(): Theme {
  return theme;
}

const THEMES: Record<Theme, Record<number, number>> = {
  classic: {},
  // the Radiant Order: white limestone and ivory plaster, royal-blue slate trimmed in gold,
  // blue-and-gold banners, pale sandstone paving and a bright, well-kept green
  paladin: {
    [C.tile]: 0x2c4f9e, [C.tileDark]: 0x213c7a, [C.tileWarm]: 0x3661b4, [C.thatch]: 0x33579f, [C.thatchDark]: 0x264378,
    [C.plaster]: 0xf3eee2, [C.plasterWarm]: 0xebe3d0, [C.timber]: 0x5b3e28, [C.timberLight]: 0x8a6a48,
    [C.stone]: 0xe4ddcb, [C.stoneDark]: 0xbdb39c, [C.stoneLight]: 0xf6f1e4, [C.red]: 0x2c56b0, [C.slate]: 0x243f80, [C.door]: 0x5a3a22,
    [C.grass]: 0x7aa447, [C.grassLight]: 0x8cb655, [C.grassDark]: 0x628b39, [C.grassRust]: 0x9aa84a,
    [C.dirt]: 0xdccba2, [C.dirtDark]: 0xc4b186, [C.water]: 0x4a9ad0,
    0x97a24e: 0x86b04e, 0x7f8d43: 0x6c9640, 0x8b984a: 0x7aa447,
  },
  // deep violet slate roofs, moonstone walls, cool starlit stone, violet banners with silver stars
  sorcerer: {
    [C.tile]: 0x432a8c, [C.tileDark]: 0x2e1d63, [C.tileWarm]: 0x5634a6, [C.thatch]: 0x3d4f9a, [C.thatchDark]: 0x2d3a73,
    [C.plaster]: 0xe4e0f4, [C.plasterWarm]: 0xd6cfec, [C.timber]: 0x2c2340, [C.timberLight]: 0x4a3d66,
    [C.stone]: 0xa6a6c6, [C.stoneDark]: 0x77779c, [C.stoneLight]: 0xd2d2e8, [C.red]: 0x5b36b0, [C.slate]: 0x3a3163, [C.door]: 0x2a1d40,
    // the ground turns to an enchanted twilight meadow
    [C.grass]: 0x5f7568, [C.grassLight]: 0x708879, [C.grassDark]: 0x4b5f57, [C.grassRust]: 0x8a7aa8,
    [C.dirt]: 0xbcaecb, [C.dirtDark]: 0x9585ad, [C.water]: 0x4f7fd0,
    0x97a24e: 0x74907c, 0x7f8d43: 0x5d7468, 0x8b984a: 0x688272,
  },
  // moss and turf roofs, weathered wood, lichen-green stone, leaf-green banners
  druid: {
    [C.tile]: 0x5e7d32, [C.tileDark]: 0x445c24, [C.tileWarm]: 0x6f8f3a, [C.thatch]: 0x7c8f3e, [C.thatchDark]: 0x5b6b2c,
    [C.plaster]: 0xd8cfae, [C.plasterWarm]: 0xcdbf98, [C.timber]: 0x4a3420, [C.timberLight]: 0x6e5134,
    [C.stone]: 0x8e9a80, [C.stoneDark]: 0x6c775f, [C.stoneLight]: 0xb0b99f, [C.red]: 0x4f7a2e, [C.slate]: 0x4c5a3a,
    // the ground turns to a deep, lush glade
    [C.grass]: 0x5a8a36, [C.grassLight]: 0x6fa044, [C.grassDark]: 0x40692a, [C.grassRust]: 0x7f8a38,
    [C.dirt]: 0x7a6446, [C.dirtDark]: 0x5e4a33, [C.water]: 0x3a7f86,
    0x97a24e: 0x6aa044, 0x7f8d43: 0x4f7f32, 0x8b984a: 0x5d9038,
  },
  // black slate roofs, bone-grey walls, pitch-dark timber, ghost-green banners
  necromancer: {
    [C.tile]: 0x2e2a33, [C.tileDark]: 0x221f27, [C.tileWarm]: 0x3a3540, [C.thatch]: 0x3a3a36, [C.thatchDark]: 0x2a2a27,
    [C.plaster]: 0xa9a59a, [C.plasterWarm]: 0x9c978b, [C.timber]: 0x1e1a1c, [C.timberLight]: 0x3a3234,
    [C.stone]: 0x6e6c72, [C.stoneDark]: 0x4e4c52, [C.stoneLight]: 0x8e8c92, [C.red]: 0x2f7a4a, [C.slate]: 0x26232b, [C.door]: 0x141214,
    // the ground turns to a grey, dead meadow; the trees keep only a few withered leaves
    [C.grass]: 0x5d6250, [C.grassLight]: 0x6a6e5a, [C.grassDark]: 0x4a4e40, [C.grassRust]: 0x6e6450,
    [C.dirt]: 0x6a6258, [C.dirtDark]: 0x544d45, [C.water]: 0x2e4a3a,
    [C.leafOrange]: 0x6a5a40, [C.leafRed]: 0x5a3a30, [C.leafYellow]: 0x7a7050, [C.leafGold]: 0x6a5a3a, [C.leafGreen]: 0x4a5040,
    0x97a24e: 0x646a55, 0x7f8d43: 0x52584a, 0x8b984a: 0x5c6150,
  },
  // rusty patched roofs, grimy walls, soot-dark wood, goblin-green rags
  goblin: {
    [C.tile]: 0x7a4a2a, [C.tileDark]: 0x5c3520, [C.tileWarm]: 0x8f5a2e, [C.thatch]: 0x8a7a3a, [C.thatchDark]: 0x665a2a,
    [C.plaster]: 0xb9a67c, [C.plasterWarm]: 0xa89468, [C.timber]: 0x3e2a18, [C.timberLight]: 0x5e4428,
    [C.stone]: 0x7d7566, [C.stoneDark]: 0x5c554a, [C.stoneLight]: 0x9c9483, [C.red]: 0x6f9a2a, [C.slate]: 0x4a4036,
    // the ground turns to swamp
    [C.grass]: 0x5b6838, [C.grassLight]: 0x677640, [C.grassDark]: 0x46522e, [C.grassRust]: 0x6a5a34,
    [C.dirt]: 0x6e5a3c, [C.dirtDark]: 0x55462f, [C.water]: 0x24403c,
    0x97a24e: 0x6a7440, 0x7f8d43: 0x56603a, 0x8b984a: 0x626b3d,
  },
  // the Horde: smoked-hide roofs, raw logs and charred timber, dark rough stone, blood-red war cloth
  orc: {
    [C.tile]: 0x4a3326, [C.tileDark]: 0x35241a, [C.tileWarm]: 0x5c3e2a, [C.thatch]: 0x7a5a3a, [C.thatchDark]: 0x5a4028,
    [C.plaster]: 0x7e6e5a, [C.plasterWarm]: 0x6e604e, [C.timber]: 0x33241a, [C.timberLight]: 0x5e4430,
    [C.stone]: 0x625c55, [C.stoneDark]: 0x47433e, [C.stoneLight]: 0x7c766d, [C.red]: 0xa3261a, [C.slate]: 0x3a3532, [C.door]: 0x24170e,
    // the ground turns to trampled, ash-dark earth; the woods keep a duller autumn
    [C.grass]: 0x6b6a3a, [C.grassLight]: 0x7a7642, [C.grassDark]: 0x55552f, [C.grassRust]: 0x7a5c36,
    [C.dirt]: 0x6e5a44, [C.dirtDark]: 0x574634, [C.water]: 0x3c5656,
    [C.leafOrange]: 0xa85a28, [C.leafRed]: 0x8a3322, [C.leafYellow]: 0xae8e38, [C.leafGold]: 0x9a7430, [C.leafGreen]: 0x5e6a32,
    0x97a24e: 0x77743f, 0x7f8d43: 0x605d35, 0x8b984a: 0x6c693a,
  },
  // (starter palettes for the heroes of the wilds; each is refined with its village)
  // the Frost Queen's court: ice-blue roofs, white stone, pale birch, silver-blue banners
  frost: {
    [C.tile]: 0x6f9cc8, [C.tileDark]: 0x4f7aa6, [C.tileWarm]: 0x86b2da, [C.thatch]: 0x8fb4d4, [C.thatchDark]: 0x6a8fb2,
    [C.plaster]: 0xf1f5fa, [C.plasterWarm]: 0xe2eaf2, [C.timber]: 0x6a7584, [C.timberLight]: 0xb8c2cc,
    [C.stone]: 0xd2dbe6, [C.stoneDark]: 0x94a4ba, [C.stoneLight]: 0xebf0f6, [C.red]: 0x4f8fd0, [C.slate]: 0x3c5a80, [C.door]: 0x2c3a52,
    // silver where others gild; birch and pale wood; a snowfield glinting blue where the wind has polished it
    [C.gold]: 0xc9d3de, [C.wood]: 0xcdbf9f, [C.woodDark]: 0x8e8068, [C.logEnd]: 0xe6d2a4, [C.trunk]: 0x6a5a4a, [C.brick]: 0x9a5a48,
    [C.grass]: 0xe6edf3, [C.grassLight]: 0xf0f5f8, [C.grassDark]: 0xd2dde6, [C.grassRust]: 0xd9e2ea, [C.dirt]: 0xc9c6bc, [C.dirtDark]: 0xaaa79c, [C.water]: 0x9fc6de,
    0x97a24e: 0xeef3f7, 0x7f8d43: 0xd6e0e8, 0x8b984a: 0xe4ebf0,
  },
  // the Forgelord's hold: warm granite on black basalt, bronze and copper roofs, stone-slab roofs on the
  // humbler sheds, dark oak, and rune-red banners (the ash and lava of the west come from the season)
  dwarf: {
    [C.tile]: 0xb0763a, [C.tileDark]: 0x7e5228, [C.tileWarm]: 0xc08448, [C.thatch]: 0x5e5650, [C.thatchDark]: 0x46403c,
    [C.plaster]: 0x8c8279, [C.plasterWarm]: 0x7e746b, [C.timber]: 0x46321f, [C.timberLight]: 0x6a4c32,
    [C.stone]: 0x8c8279, [C.stoneDark]: 0x4e4642, [C.stoneLight]: 0xa89c8e, [C.red]: 0xa8382a, [C.slate]: 0x3e3836, [C.door]: 0x7e5228,
    [C.wood]: 0x7a5636, [C.woodDark]: 0x4a3422,
  },
  // the Djinn's oasis city: sandstone and whitewash, turquoise tile, cedar and palm wood, palm-frond thatch,
  // crimson cloth (the city's own colours live in oasis.ts; these dress what is shared)
  djinn: {
    [C.tile]: 0x2aa6a0, [C.tileDark]: 0x1c7a7c, [C.tileWarm]: 0xd9a44a, [C.thatch]: 0xc9a86a, [C.thatchDark]: 0xa88a52,
    [C.plaster]: 0xf4ead6, [C.plasterWarm]: 0xe6d0a4, [C.timber]: 0x6e4628, [C.timberLight]: 0x9a6a40,
    [C.stone]: 0xe0c290, [C.stoneDark]: 0xbe9a62, [C.stoneLight]: 0xf0dcb4, [C.red]: 0xb8303a, [C.slate]: 0x1f8a86, [C.door]: 0x4e2e16,
    [C.wood]: 0x8c6b45, [C.woodDark]: 0x5a3a20,
  },
  // the Saurian King's temple-city: mossy grey-green stone, jade, feathered reds, palm thatch
  // (its buildings, walls and people are drawn in templecity.ts in their own colours; these are what the shared pieces take:
  // the stone wall, the gatehouse, torches, scaffolds, the banner poles' foot)
  saurian: {
    [C.tile]: 0x3f7a4a, [C.tileDark]: 0x2e5c36, [C.tileWarm]: 0x4f8f5a, [C.thatch]: 0xb89e56, [C.thatchDark]: 0x8c7542,
    [C.plaster]: 0xb8b494, [C.plasterWarm]: 0xa8a482, [C.timber]: 0x5e4730, [C.timberLight]: 0x7a6040, [C.woodDark]: 0x3e2e1e,
    [C.stone]: 0x9d9f88, [C.stoneDark]: 0x777b67, [C.stoneLight]: 0xbcbba2, [C.red]: 0xb2452c, [C.slate]: 0x3a5a44, [C.door]: 0x2e2416,
  },
};

/** The colour a palette entry really takes: snow first in winter, then the village's theme. */
function look(c: number): number {
  if (season === 'winter' && WINTER[c] !== undefined) return WINTER[c];
  if (season === 'volcanic' && VOLCANIC[c] !== undefined) return VOLCANIC[c];
  if (season === 'desert' && DESERT[c] !== undefined) return DESERT[c];
  if (season === 'jungle' && JUNGLE[c] !== undefined) return JUNGLE[c];
  return THEMES[theme][c] ?? c;
}

export function seasonal(c: number): number {
  return look(c);
}

export function mat(color: number, opts: { emissive?: number; opacity?: number; double?: boolean } = {}): THREE.MeshLambertMaterial {
  color = look(color);
  const key = `${color}|${opts.emissive ?? 0}|${opts.opacity ?? 1}|${opts.double ? 1 : 0}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      color,
      flatShading: true,
      emissive: opts.emissive ?? 0x000000,
      transparent: opts.opacity !== undefined && opts.opacity < 1,
      opacity: opts.opacity ?? 1,
      side: opts.double ? THREE.DoubleSide : THREE.FrontSide,
    });
    cache.set(key, m);
  }
  return m;
}

export function mesh(geo: THREE.BufferGeometry, color: number, opts?: Parameters<typeof mat>[1]): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Box standing on y=0 */
export function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const m = mesh(g, color);
  m.position.set(x, y, z);
  return m;
}

export function cyl(rTop: number, rBot: number, h: number, color: number, seg = 8, x = 0, y = 0, z = 0): THREE.Mesh {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  g.translate(0, h / 2, 0);
  const m = mesh(g, color);
  m.position.set(x, y, z);
  return m;
}

export function cone(r: number, h: number, color: number, seg = 8, x = 0, y = 0, z = 0): THREE.Mesh {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(0, h / 2, 0);
  const m = mesh(g, color);
  m.position.set(x, y, z);
  return m;
}

export function blob(r: number, color: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, detail = 0): THREE.Mesh {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const m = mesh(g, color);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

/** A prism extruded along Z from a 2D profile (in the XY plane). */
export function extrude(points: [number, number][], depth: number, color: number): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return mesh(g, color);
}

/**
 * A half-timbered house: plaster walls with a gable end, timber framing, a tiled
 * roof with overhang, a door and windows. Ridge runs along Z. Front faces +Z.
 */
export function house(o: {
  w: number; d: number; h: number; roofH: number;
  wall?: number; roof?: number; frame?: number | null; door?: boolean; windows?: number; stone?: boolean; chimney?: boolean;
}): THREE.Group {
  if (theme === 'paladin') return paladinHouse(o);
  if (theme === 'sorcerer') return sorcererHouse(o);
  if (theme === 'druid') return druidHouse(o);
  if (theme === 'goblin') return goblinHouse(o);
  if (theme === 'necromancer') return necroHouse(o);
  if (theme === 'orc') return orcHouse(o);
  if (theme === 'dwarf') return dwarfHouse(o);
  if (theme === 'djinn') return oasisHouse(o);
  if (theme === 'frost') return frostHouse(o);
  return baseHouse(o);
}

function baseHouse(o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const wall = o.wall ?? (o.stone ? C.stone : C.plaster);
  const roof = o.roof ?? C.tile;
  const { w, d, h, roofH } = o;
  // walls + gable ends in one extrusion
  const body = extrude([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0, h + roofH], [-w / 2, h]], d, wall);
  g.add(body);
  // roof slabs, running from the ridge down past the eaves
  const half = w / 2 + 0.45;
  const theta = Math.atan2(roofH, w / 2);
  const len = half / Math.cos(theta) + 0.2;
  for (const side of [-1, 1]) {
    const slab = box(len, 0.28, d + 0.9, roof);
    slab.geometry.translate(0, -0.14, 0);
    slab.rotation.z = -side * theta;
    const mx = side * (half / 2);
    const my = h + roofH - (half / 2) * Math.tan(theta);
    slab.position.set(mx + side * Math.sin(theta) * 0.14, my + Math.cos(theta) * 0.14, 0);
    g.add(slab);
  }
  // ridge
  const ridge = box(0.35, 0.3, d + 0.95, C.tileDark === roof ? C.timber : darker(roof));
  ridge.position.set(0, h + roofH, 0);
  g.add(ridge);
  // framing
  const frame = o.frame === undefined ? (o.stone ? null : C.timber) : o.frame;
  if (frame !== null) {
    const t = 0.16;
    for (const z of [d / 2 + 0.03, -d / 2 - 0.03]) {
      for (const x of [-w / 2 + t / 2, w / 2 - t / 2]) g.add(box(t, h, t, frame, x, 0, z));
      g.add(box(w, t, t, frame, 0, h * 0.5, z));
      g.add(box(w, t, t, frame, 0, h - t, z));
      if (w > 4) {
        const post = box(t, h * 0.5, t, frame, 0, 0, z);
        g.add(post);
      }
    }
    for (const x of [w / 2 + 0.03, -w / 2 - 0.03]) {
      for (const z of [-d / 2 + t / 2, d / 2 - t / 2]) g.add(box(t, h, t, frame, x, 0, z));
      g.add(box(t, t, d, frame, x, h * 0.5, 0));
      // diagonal braces
      const br = box(t, Math.hypot(h * 0.5, d * 0.35), t, frame, x, 0, -d / 4);
      br.rotation.x = Math.atan2(d * 0.35, h * 0.5);
      br.position.set(x, 0, -d / 2 + 0.2);
      g.add(br);
    }
  }
  if (o.door !== false) {
    g.add(box(Math.min(1.3, w * 0.22), Math.min(2.1, h * 0.62), 0.2, C.door, 0, 0, d / 2 + 0.05));
  }
  const nw = o.windows ?? Math.max(0, Math.floor(w / 2.4));
  for (let i = 0; i < nw; i++) {
    const x = -w / 2 + ((i + 1) * w) / (nw + 1);
    if (Math.abs(x) < 1 && o.door !== false) continue;
    const win = box(0.7, 0.8, 0.14, C.window, x, h * 0.58, d / 2 + 0.06);
    win.userData.window = true;
    g.add(win);
  }
  if (o.chimney) g.add(box(0.8, roofH + 1.4, 0.8, C.stoneDark, w * 0.22, h, -d * 0.2));
  return g;
}

export function darker(c: number, f = 0.75): number {
  c = look(c);
  const col = new THREE.Color(c);
  col.multiplyScalar(f);
  return col.getHex();
}

/** Ring of crenellations (merlons) around a circle. */
export function merlonRing(r: number, y: number, count: number, color: number, size = 0.55): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const m = box(size, size * 1.1, size, color, Math.cos(a) * r, y, Math.sin(a) * r);
    m.rotation.y = -a;
    g.add(m);
  }
  return g;
}

type TowerOpts = { color?: number; roof?: number | null; merlons?: boolean; banner?: number };

export function roundTower(r: number, h: number, o: TowerOpts = {}): THREE.Group {
  if (theme === 'paladin') return paladinTower(r, h, o);
  if (theme === 'sorcerer') return sorcererTower(r, h, o);
  if (theme === 'druid') return druidTower(r, h, o);
  if (theme === 'goblin') return goblinTower(r, h, o);
  if (theme === 'necromancer') return necroTower(r, h, o);
  if (theme === 'orc') return orcTower(r, h, o);
  if (theme === 'dwarf') return dwarfTower(r, h, o);
  if (theme === 'djinn') return oasisTower(r, h, o);
  if (theme === 'frost') return frostTower(r, h, o);
  return baseTower(r, h, o);
}

function baseTower(r: number, h: number, o: TowerOpts): THREE.Group {
  const g = new THREE.Group();
  const color = o.color ?? C.stone;
  g.add(cyl(r, r * 1.08, h, color, 10));
  g.add(cyl(r * 1.15, r * 1.15, 0.5, darker(color, 0.9), 10, 0, h - 0.2));
  if (o.merlons !== false) g.add(merlonRing(r * 1.05, h + 0.3, 8, color, r * 0.42));
  if (o.roof) g.add(cone(r * 1.3, r * 2.2, o.roof, 10, 0, h + 0.3));
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + 0.5;
    const s = box(0.35, 0.8, 0.2, C.window, Math.cos(a) * r, h * 0.55, Math.sin(a) * r);
    s.rotation.y = -a + Math.PI / 2;
    g.add(s);
  }
  if (o.banner !== undefined) {
    const top = h + 0.3 + (o.roof ? r * 2.2 : 0.6);
    g.add(cyl(0.06, 0.06, 2.4, C.woodDark, 4, 0, top));
    const flag = box(1.4, 0.8, 0.05, o.banner, 0.7, top + 1.5, 0);
    flag.userData.flag = true;
    g.add(flag);
  }
  return g;
}

/**
 * Merge every static mesh in a group into one mesh per material. Parts flagged
 * with userData.dynamic stay separate so they can animate.
 */
export function bake(root: THREE.Object3D, tag?: Record<string, unknown>): THREE.Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const keep: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o.userData.dynamic) {
      keep.push(o);
      return;
    }
    if (!(o instanceof THREE.Mesh)) return;
    if (hasDynamicAncestor(o, root)) return;
    let geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    const m = o.material as THREE.Material;
    const list = buckets.get(m) ?? [];
    list.push(geo);
    buckets.set(m, list);
  });
  const out = new THREE.Group();
  for (const [m, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mm = new THREE.Mesh(merged, m);
    // tiny bright details (blossom, glow-berries, lantern glass, glowing runes) cast no shadow
    mm.castShadow = !m.userData.noShadow;
    mm.receiveShadow = true;
    if (tag) Object.assign(mm.userData, tag);
    out.add(mm);
  }
  for (const k of keep) {
    const clone = k;
    const world = new THREE.Matrix4().copy(k.matrixWorld);
    clone.removeFromParent();
    world.decompose(clone.position, clone.quaternion, clone.scale);
    if (tag) clone.traverse((c) => Object.assign(c.userData, tag));
    out.add(clone);
  }
  disposeTree(root);
  return out;
}

function hasDynamicAncestor(o: THREE.Object3D, root: THREE.Object3D): boolean {
  let p = o.parent;
  while (p && p !== root) {
    if (p.userData.dynamic) return true;
    p = p.parent;
  }
  return false;
}

/** Dispose geometries (materials are shared and cached, so they stay). */
export function disposeTree(o: THREE.Object3D): void {
  o.traverse((c) => {
    if (c instanceof THREE.Mesh && !c.userData.sharedGeometry) c.geometry.dispose();
  });
}

/** Seeded random for stable scenery. */
export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- hero themes: the same buildings in each hero's style ----------
// Every themed piece keeps the footprint of the classic one, so the village
// layout (and its tests) hold for every theme.

type HouseOpts = Parameters<typeof house>[0];

function windowAt(x: number, y: number, z: number, round = false): THREE.Mesh {
  const w = round ? cyl(0.36, 0.36, 0.14, C.window, 8) : box(0.7, 0.8, 0.14, C.window);
  if (round) w.rotation.x = Math.PI / 2;
  w.position.set(x, y, z);
  w.userData.window = true;
  return w;
}

// ---------- the Arcane (sorcerer) ----------

/** Arcane light: a cool cyan and a deep violet, each with its glow. */
export const ARC = 0x8fe8ff, ARC_EMIT = 0x2a8ab8, VIO = 0xc6a2ff, VIO_EMIT = 0x6a38d0, STAR = 0xf4ecc8, STAR_EMIT = 0x8a7a40;

/** A band of glowing runes set into a round tower's stone (radius r, at height y). */
export function runeRing(r: number, y: number, color = ARC, emissive = ARC_EMIT): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r, 0.1, 18, 1, true), color, { emissive, double: true }).translateY(y));
  // the glyphs: little lit marks above and below the band
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const glyph = mesh(new THREE.BoxGeometry(0.1, i % 2 ? 0.34 : 0.22, 0.05), color, { emissive });
    glyph.position.set(Math.cos(a) * (r + 0.01), y + (i % 3 === 0 ? 0.24 : -0.2), Math.sin(a) * (r + 0.01));
    glyph.rotation.y = -a + Math.PI / 2;
    g.add(glyph);
  }
  return g;
}

/** A witch's hat of a roof: a brim, a steep cone and a tip that bends over, with a band and a star. */
export function witchHat(r: number, h: number, color: number, bend = 0.5): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(r * 1.22, r * 1.22, 0.14, color, 14));
  const low = h * 0.58;
  g.add(cyl(r * 0.46, r, low, color, 14, 0, 0.12));
  g.add(cyl(r * 0.86, r * 0.93, 0.22, C.gold, 14, 0, 0.3));
  const tip = cone(r * 0.46, h * 0.5, color, 12);
  tip.position.y = low + 0.1;
  tip.rotation.z = -bend;
  g.add(tip);
  const star = mesh(new THREE.OctahedronGeometry(Math.max(0.18, r * 0.16), 0), STAR, { emissive: STAR_EMIT });
  star.position.set(Math.sin(bend) * h * 0.5 + 0.05, low + 0.1 + Math.cos(bend) * h * 0.5, 0);
  g.add(star);
  return g;
}

/** A crystal that floats, turns and bobs, shards circling it. */
export function floatingCrystal(s = 1, color = VIO, emissive = VIO_EMIT): THREE.Group {
  const g = new THREE.Group();
  const c = mesh(new THREE.OctahedronGeometry(0.5 * s, 0), color, { emissive });
  c.scale.set(1, 1.9, 1);
  g.add(c);
  g.add(mesh(new THREE.IcosahedronGeometry(0.85 * s, 1), color, { emissive, opacity: 0.18 }));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const sh = mesh(new THREE.OctahedronGeometry(0.16 * s, 0), ARC, { emissive: ARC_EMIT });
    sh.scale.set(1, 1.6, 1);
    sh.position.set(Math.cos(a) * 1.05 * s, (i - 1) * 0.3 * s, Math.sin(a) * 1.05 * s);
    g.add(sh);
  }
  g.userData.dynamic = true;
  g.userData.orbit = 0.8;
  g.userData.bob = 0.22 * s;
  return g;
}

/** A crystal lamp on a dark iron post, a violet pennant with a silver star beneath it. */
export function arcaneLamp(h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.24, 0.32, 0.4, C.stoneDark, 6));
  g.add(cyl(0.07, 0.09, h, 0x2c2340, 6, 0, 0.4));
  g.add(mesh(new THREE.TorusGeometry(0.3, 0.04, 4, 14).rotateX(Math.PI / 2), C.gold).translateY(h + 0.4));
  const pennant = box(0.04, 1.0, 0.55, C.red, 0, h - 0.75, 0.3);
  g.add(pennant);
  const star = mesh(new THREE.OctahedronGeometry(0.12, 0), STAR, { emissive: STAR_EMIT });
  star.position.set(0.04, h - 0.3, 0.3);
  g.add(star);
  const c = floatingCrystal(0.34, ARC, ARC_EMIT);
  c.position.y = h + 0.95;
  g.add(c);
  return g;
}

/** A rock adrift in the air: a grassy top, crystals growing on it, a thread of water falling from its lip. */
export function floatingIsle(s: number, r: () => number, tree?: THREE.Object3D): THREE.Group {
  const g = new THREE.Group();
  const rock = cone(1.7 * s, 3.2 * s, 0x6d6a82, 7);
  rock.rotation.x = Math.PI;
  g.add(rock);
  g.add(cone(1.0 * s, 1.6 * s, 0x5a5770, 6, 0.5 * s, -2.6 * s, 0.3 * s).rotateX(Math.PI));
  g.add(cyl(1.75 * s, 1.7 * s, 0.4 * s, C.grass, 7));
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = r() * 1.1 * s;
    const c = mesh(new THREE.OctahedronGeometry(0.25 * s, 0), i % 2 ? VIO : ARC, { emissive: i % 2 ? VIO_EMIT : ARC_EMIT });
    c.scale.set(1, 2 + r(), 1);
    c.position.set(Math.cos(a) * d, 0.4 * s + 0.5 * s, Math.sin(a) * d);
    c.rotation.z = (r() - 0.5) * 0.6;
    g.add(c);
  }
  if (tree) { tree.position.set(-0.5 * s, 0.35 * s, -0.3 * s); g.add(tree); }
  const fall = mesh(new THREE.BoxGeometry(0.35 * s, 7 * s, 0.08).translate(0, -3.5 * s, 0), 0x9fd4ff, { emissive: 0x2a5a9a, opacity: 0.45 });
  fall.position.set(1.55 * s, 0.1, 0);
  g.add(fall);
  g.userData.dynamic = true;
  g.userData.bob = 0.45 * s;
  return g;
}

/** A ring of glowing runes that turns slowly about a spire, tilted, so it seems to wheel. */
export function orbitRing(r: number, tilt: number, speed: number, color = ARC, emissive = ARC_EMIT): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Group();
  ring.add(mesh(new THREE.TorusGeometry(r, 0.07, 4, 48), color, { emissive }));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const gl = mesh(new THREE.BoxGeometry(0.2, 0.34, 0.06), color, { emissive });
    gl.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    gl.rotation.z = a;
    ring.add(gl);
  }
  ring.rotation.x = Math.PI / 2 + tilt;
  g.add(ring);
  g.userData.dynamic = true;
  g.userData.orbit = speed;
  return g;
}

/** Sorcerer: moonstone walls on a slate plinth, a glowing rune band, a steep violet roof with curled ends,
 *  a corner turret in a crooked hat, round lit windows, a starlit door and a crystal floating over the ridge. */
function sorcererHouse(o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const roofH = o.roofH * 1.9;
  const wall = o.wall ?? (o.stone ? C.stone : C.plaster);
  g.add(extrude([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0, h + roofH], [-w / 2, h]], d, wall));
  const plinth = Math.min(1.0, h * 0.32);
  g.add(box(w + 0.16, plinth, d + 0.16, C.stoneDark));
  g.add(mesh(new THREE.BoxGeometry(w + 0.2, 0.09, d + 0.2).translate(0, plinth + 0.05, 0), ARC, { emissive: ARC_EMIT }));
  // an oculus in the gable, glowing violet
  const oc = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 12).rotateX(Math.PI / 2), VIO, { emissive: VIO_EMIT });
  oc.position.set(0, h + roofH * 0.42, d / 2 + 0.04);
  g.add(oc);
  const half = w / 2 + 0.35;
  const theta = Math.atan2(roofH, w / 2);
  const len = half / Math.cos(theta) + 0.2;
  for (const side of [-1, 1]) {
    const slab = box(len, 0.24, d + 0.7, C.tile);
    slab.geometry.translate(0, -0.12, 0);
    slab.rotation.z = -side * theta;
    slab.position.set(side * (half / 2) + side * Math.sin(theta) * 0.12, h + roofH - (half / 2) * Math.tan(theta) + Math.cos(theta) * 0.12, 0);
    g.add(slab);
  }
  // curled ridge ends and a gold trim band
  for (const z of [d / 2 + 0.35, -d / 2 - 0.35]) {
    const c = cone(0.22, 0.9, C.gold, 6, 0, h + roofH - 0.1, z);
    c.rotation.x = z > 0 ? 0.5 : -0.5;
    g.add(c);
  }
  g.add(box(w + 0.1, 0.18, d + 0.1, C.gold, 0, h - 0.18, 0));
  // a small turret on the front corner, in a crooked hat, a rune band round its middle
  if (w > 3.5) {
    const tx = w / 2 - 0.55, tz = d / 2 - 0.55;
    const th = h + roofH * 0.55;
    g.add(cyl(0.55, 0.62, th, C.stone, 8, tx, 0, tz));
    const band = runeRing(0.57, th * 0.6);
    band.position.set(tx, 0, tz);
    g.add(band);
    const hat = witchHat(0.62, 2.1, C.tileDark, 0.55);
    hat.position.set(tx, th, tz);
    g.add(hat);
  }
  // a crystal floating over the ridge
  const cr = floatingCrystal(0.5);
  cr.position.set(0, h + roofH + 1.0, 0);
  g.add(cr);
  if (o.door !== false) {
    // an arched door under a silver star, a crystal lantern beside it
    const dw = Math.min(1.2, w * 0.22), dh = Math.min(2.2, h * 0.66);
    g.add(box(dw, dh - dw / 2, 0.2, C.door, 0, 0, d / 2 + 0.05));
    g.add(mesh(new THREE.CylinderGeometry(dw / 2, dw / 2, 0.2, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), C.door).translateY(dh - dw / 2).translateZ(d / 2 + 0.05));
    const st = mesh(new THREE.OctahedronGeometry(0.15, 0), STAR, { emissive: STAR_EMIT });
    st.position.set(0, dh + 0.3, d / 2 + 0.1);
    g.add(st);
    const lamp = mesh(new THREE.OctahedronGeometry(0.16, 0), ARC, { emissive: ARC_EMIT });
    lamp.scale.set(1, 1.5, 1);
    lamp.position.set(dw / 2 + 0.35, dh * 0.8, d / 2 + 0.22);
    g.add(lamp, box(0.06, 0.06, 0.3, C.timber, dw / 2 + 0.35, dh * 0.8 + 0.28, d / 2 + 0.1));
  }
  const nw = o.windows ?? Math.max(0, Math.floor(w / 2.4));
  for (let i = 0; i < nw; i++) {
    const x = -w / 2 + ((i + 1) * w) / (nw + 1);
    if (Math.abs(x) < 1 && o.door !== false) continue;
    g.add(windowAt(x, h * 0.6, d / 2 + 0.06, true));
  }
  return g;
}

/** Druid: a rounded cottage of daub and timber on a stone footing under a faceted turf dome, leafy tufts
 *  and wildflowers along the eaves, a sapling growing from the top, ivy up the walls, roots at its feet,
 *  flowers by the door and a lantern hung beside it. */
function druidHouse(o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const rand = rng(Math.round(w * 31 + d * 17 + h * 7));
  const body = cyl(0.5, 0.52, h, o.stone ? C.stone : C.plaster, 12);
  body.scale.set(w, 1, d);
  g.add(body);
  const foot = cyl(0.5, 0.52, 0.35, C.stoneDark, 12);
  foot.scale.set(w + 0.16, 1, d + 0.16);
  g.add(foot);
  // timber ribs around the wall
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(0.18, h, 0.18, C.timber, Math.cos(a) * w * 0.5, 0, Math.sin(a) * d * 0.5));
  }
  // the turf dome: faceted, its crown in the sun and its eaves in shade (snowed over in winter)
  g.add(leafCluster(0.5, { top: C.tileWarm, mid: C.tile, under: C.tileDark }, 0, h, 0, (w + 0.6) / 1.1, o.roofH * 2.1, (d + 0.6) / 1.1, 1, Math.round(w * 10 + d)));
  const skirt = cyl(0.5, 0.5, 0.35, C.tileDark, 12, 0, h - 0.1, 0);
  skirt.scale.set(w + 0.8, 1, d + 0.8);
  g.add(skirt);
  // leafy tufts all along the eaves, wildflowers in the turf
  const nt = Math.round((w + d) * 0.9);
  for (let i = 0; i < nt; i++) {
    const a = (i / nt) * Math.PI * 2 + rand() * 0.3;
    g.add(leafCluster(0.3 + rand() * 0.12, i % 3 ? 'deep' : 'mid', Math.cos(a) * (w + 0.6) * 0.41, h + 0.12 + rand() * 0.2, Math.sin(a) * (d + 0.6) * 0.41, 1.2, 0.7, 1.2, 0, i + nt));
  }
  if (season !== 'winter') {
    for (let i = 0; i < 6; i++) {
      const a = rand() * Math.PI * 2, k = 0.25 + rand() * 0.3;
      const f = mesh(new THREE.OctahedronGeometry(0.13, 0), [BLOSSOM, 0xf2e46a, BLOSSOM_W, 0xb58cd8][i % 4]);
      f.position.set(Math.cos(a) * w * k, h + o.roofH * (0.95 - k * 0.9), Math.sin(a) * d * k);
      g.add(f);
    }
  }
  // a sapling growing from the top of the bigger roofs
  if (w > 4.2) {
    const top = h + o.roofH * 1.0;
    g.add(cyl(0.07, 0.11, 0.9, BARK_C, 5, w * 0.08, top - 0.2, -d * 0.05));
    g.add(leafCluster(0.42, 'sun', w * 0.08, top + 0.85, -d * 0.05, 1, 0.9, 1, 0, Math.round(w)));
  }
  // ivy climbing the walls
  for (const a of [Math.PI * 0.95, Math.PI * 1.7, Math.PI * 0.2]) {
    const x = Math.cos(a) * w * 0.51, z = Math.sin(a) * d * 0.51;
    g.add(box(0.06, h * 0.85, 0.06, MOSS_DK_C, x, 0.1, z));
    for (let k = 0; k < 4; k++) g.add(mesh(new THREE.OctahedronGeometry(0.16, 0), k % 2 ? LEAF_MID : LEAF_DEEP).translateX(x + (k % 2 ? 0.1 : -0.1)).translateY(0.4 + (k / 4) * h * 0.8).translateZ(z));
  }
  // roots at the base
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2;
    if (Math.sin(a) > 0.8) continue;
    const root = box(0.35, 0.45, 0.9, C.timber, Math.cos(a) * w * 0.47, 0, Math.sin(a) * d * 0.47);
    root.rotation.y = -a + Math.PI / 2;
    g.add(root);
  }
  if (o.door !== false) {
    const dw = Math.min(1.2, w * 0.22), dh = Math.min(1.9, h * 0.66);
    g.add(box(dw, dh, 0.25, C.door, 0, 0, d / 2 - 0.02));
    g.add(blob(0.62, C.timber, 0, dh, d / 2 - 0.02, 1, 0.45, 0.3));
    // flowers either side of the door, a lantern hung by it
    for (const s of [-1, 1]) {
      g.add(leafCluster(0.26, 'deep', s * (dw / 2 + 0.4), 0.2, d / 2 + 0.05, 1.2, 0.8, 0.9, 0, s + 3));
      if (season !== 'winter') for (let k = 0; k < 3; k++) g.add(mesh(new THREE.OctahedronGeometry(0.1, 0), k % 2 ? 0xf2e46a : BLOSSOM).translateX(s * (dw / 2 + 0.28 + k * 0.12)).translateY(0.42 + (k % 2) * 0.08).translateZ(d / 2 + 0.2));
    }
    if (h > 2.2) {
      const l = hangingLantern(0.22, 0.75);
      l.position.set(dw / 2 + 0.35, dh + 0.25, d / 2 + 0.22);
      g.add(l, box(0.05, 0.05, 0.4, C.timber, dw / 2 + 0.35, dh + 0.22, d / 2 + 0.05));
    }
  }
  const nw = Math.min(2, o.windows ?? 1);
  for (let i = 0; i < nw; i++) {
    const a = Math.PI / 2 + (i === 0 ? 0.75 : -0.75);
    g.add(windowAt(Math.cos(a) * w * 0.49, h * 0.6, Math.sin(a) * d * 0.49, true));
  }
  if (o.chimney) g.add(cyl(0.35, 0.45, o.roofH + 1.2, C.stoneDark, 6, w * 0.2, h, -d * 0.15));
  return g;
}

/** Goblin: a crooked plank shack under lopsided rusted plates, bones on the ridge. */
function goblinHouse(o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const body = new THREE.Group();
  body.add(box(w, h, d, o.stone ? C.stone : C.timberLight));
  for (let i = 0; i < Math.max(3, Math.floor(w)); i++) {
    body.add(box(0.14, h + 0.2, 0.1, C.timber, -w / 2 + 0.3 + (i * (w - 0.6)) / Math.max(2, Math.floor(w) - 1), 0, d / 2 + 0.03));
  }
  body.rotation.z = 0.04;
  g.add(body);
  // two mismatched roof slabs, one higher than the other
  const roofH = o.roofH * 0.8;
  for (const side of [-1, 1]) {
    const slab = box(w / 2 + 0.7, 0.22, d + 0.6, side < 0 ? C.tile : C.tileDark);
    slab.position.set(side * w * 0.24, h + roofH * (side < 0 ? 0.55 : 0.4), side * 0.08);
    slab.rotation.z = -side * Math.atan2(roofH, w / 2) * (side < 0 ? 1 : 0.8);
    g.add(slab);
  }
  g.add(extrude([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0.3, h + roofH * 0.9], [-w / 2, h]], d - 0.1, C.timberLight));
  // a patched hide flap and stakes along the ridge
  g.add(box(w * 0.35, h * 0.5, 0.06, C.thatch, -w * 0.2, h * 0.35, d / 2 + 0.1));
  for (let i = 0; i < 3; i++) {
    const sp = cone(0.1, 0.8, C.timber, 4, -w * 0.3 + i * w * 0.3, h + roofH * 0.9, 0);
    sp.rotation.z = (i - 1) * 0.3;
    g.add(sp);
  }
  g.add(blob(0.24, 0xe8dfc8, 0.3, h + roofH * 0.95 + 0.2, d / 2 - 0.3));
  if (o.door !== false) g.add(box(Math.min(1.2, w * 0.22), Math.min(1.9, h * 0.62), 0.2, 0x241a12, w * 0.1, 0, d / 2 + 0.08));
  const nw = Math.min(2, o.windows ?? 1);
  for (let i = 0; i < nw; i++) g.add(windowAt(-w / 2 + ((i + 1) * w) / (nw + 1) + 0.6, h * 0.55, d / 2 + 0.09));
  if (o.chimney) g.add(cyl(0.3, 0.35, o.roofH + 1.2, C.iron, 5, w * 0.25, h, -d * 0.2));
  return g;
}

// ---------- the Radiant Order (paladin) ----------

/** Stained glass: jewel colours that glow a little by day and a lot at night. */
export const GLASS = [
  { c: 0x6f9cff, e: 0x2a4ab0 },
  { c: 0xffd36a, e: 0x9a6a10 },
  { c: 0xff7a6a, e: 0x9a2a1a },
  { c: 0x9fe0ff, e: 0x2a7aa0 },
];

/** A tall arched window of stained glass in a white stone frame, facing +Z. */
export function lancet(x: number, y: number, z: number, w = 0.55, h = 1.1, k = 0): THREE.Group {
  const g = new THREE.Group();
  const gl = GLASS[k % GLASS.length];
  g.add(box(w + 0.2, h + 0.2, 0.12, C.stoneLight, 0, -0.1, -0.02));
  const pane = mesh(new THREE.BoxGeometry(w, h, 0.1).translate(0, h / 2, 0), gl.c, { emissive: gl.e });
  g.add(pane);
  const arch = mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.1, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), gl.c, { emissive: gl.e });
  arch.position.set(0, h, 0);
  g.add(arch);
  g.add(box(0.05, h, 0.12, C.gold, 0, 0, 0.02));
  g.position.set(x, y, z);
  return g;
}

/** A blue kite shield with a golden sun: the Order's arms. */
export function heraldry(s = 1): THREE.Group {
  const g = new THREE.Group();
  const shield = extrude([[-0.5, 0.35], [0.5, 0.35], [0.5, -0.1], [0, -0.75], [-0.5, -0.1]], 0.08, 0x2c56b0);
  g.add(shield);
  const rim = extrude([[-0.56, 0.41], [0.56, 0.41], [0.56, -0.12], [0, -0.83], [-0.56, -0.12]], 0.05, C.gold);
  rim.position.z = -0.03;
  g.add(rim);
  const sun = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12).rotateX(Math.PI / 2), 0xffd35a, { emissive: 0x8a5a10 });
  sun.position.set(0, -0.08, 0.06);
  g.add(sun);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const ray = box(0.05, 0.12, 0.04, 0xffd35a, Math.cos(a) * 0.28, -0.08 + Math.sin(a) * 0.28 - 0.06, 0.06);
    ray.rotation.z = a - Math.PI / 2;
    g.add(ray);
  }
  g.scale.setScalar(s);
  return g;
}

/**
 * Paladin: ivory walls on a limestone plinth, a steep royal-blue roof with a gilded
 * ridge and finials, tall stained-glass windows, a heraldic shield on the gable and
 * flower boxes under the windows.
 */
function paladinHouse(o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const roofH = o.roofH * 1.35;
  const wall = o.wall ?? (o.stone ? C.stoneLight : C.plaster);
  g.add(extrude([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0, h + roofH], [-w / 2, h]], d, wall));
  // a limestone plinth and corner quoins
  g.add(box(w + 0.24, 0.6, d + 0.24, C.stoneDark, 0, 0, 0));
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) g.add(box(0.34, h, 0.34, C.stone, x, 0, z));
  // the roof slabs
  const half = w / 2 + 0.4;
  const theta = Math.atan2(roofH, w / 2);
  const len = half / Math.cos(theta) + 0.2;
  for (const side of [-1, 1]) {
    const slab = box(len, 0.26, d + 0.8, o.roof ?? C.tile);
    slab.geometry.translate(0, -0.13, 0);
    slab.rotation.z = -side * theta;
    slab.position.set(side * (half / 2) + side * Math.sin(theta) * 0.13, h + roofH - (half / 2) * Math.tan(theta) + Math.cos(theta) * 0.13, 0);
    g.add(slab);
  }
  // a gilded ridge, and a gold finial at each gable
  g.add(box(0.26, 0.22, d + 0.9, C.gold, 0, h + roofH - 0.02, 0));
  for (const z of [d / 2 + 0.35, -d / 2 - 0.35]) {
    g.add(blob(0.16, C.gold, 0, h + roofH + 0.2, z));
    g.add(cone(0.07, 0.55, C.gold, 5, 0, h + roofH + 0.3, z));
  }
  // a gold string course under the eaves
  g.add(box(w + 0.14, 0.14, d + 0.14, C.gold, 0, h - 0.14, 0));
  // the Order's arms on the front gable
  if (w > 3.2) {
    const arms = heraldry(Math.min(1.1, w * 0.16));
    arms.position.set(0, h + roofH * 0.42, d / 2 + 0.06);
    g.add(arms);
  }
  if (o.door !== false) {
    const dw = Math.min(1.25, w * 0.22), dh = Math.min(2.1, h * 0.64);
    g.add(box(dw + 0.3, dh + 0.25, 0.16, C.stoneLight, 0, 0, d / 2 + 0.03));
    g.add(box(dw, dh, 0.2, C.door, 0, 0, d / 2 + 0.06));
    const top = mesh(new THREE.CylinderGeometry(dw / 2, dw / 2, 0.2, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), C.door);
    top.position.set(0, dh, d / 2 + 0.06);
    g.add(top);
    for (const y of [dh * 0.3, dh * 0.7]) g.add(box(dw * 0.8, 0.07, 0.05, C.gold, 0, y, d / 2 + 0.17));
  }
  const nw = o.windows ?? Math.max(0, Math.floor(w / 2.4));
  for (let i = 0; i < nw; i++) {
    const x = -w / 2 + ((i + 1) * w) / (nw + 1);
    if (Math.abs(x) < 1 && o.door !== false) continue;
    const win = lancet(x, h * 0.3, d / 2 + 0.06, 0.5, Math.min(1.3, h * 0.42), i);
    g.add(win);
    // a flower box under it
    g.add(box(0.8, 0.22, 0.3, C.timber, x, h * 0.3 - 0.35, d / 2 + 0.2));
    for (const fx of [-0.25, 0, 0.25]) g.add(blob(0.13, i % 2 ? 0xe05a7a : 0xf2c04a, x + fx, h * 0.3 - 0.08, d / 2 + 0.24));
  }
  if (o.chimney) g.add(box(0.7, roofH + 1.2, 0.7, C.stone, w * 0.22, h, -d * 0.2));
  return g;
}

/** Paladin tower: white stone with a gold band, a tall royal-blue spire and a golden sun on its tip. */
function paladinTower(r: number, h: number, o: TowerOpts): THREE.Group {
  const g = new THREE.Group();
  const color = o.color ?? C.stoneLight;
  g.add(cyl(r, r * 1.1, h, color, 12));
  g.add(cyl(r * 1.18, r * 1.18, 0.55, C.stone, 12, 0, h - 0.3));
  g.add(cyl(r * 1.2, r * 1.2, 0.16, C.gold, 12, 0, h + 0.25));
  // a band of stained glass slits
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const s = lancet(0, 0, 0, 0.32, 0.8, i);
    s.position.set(Math.cos(a) * r * 1.02, h * 0.55, Math.sin(a) * r * 1.02);
    s.rotation.y = -a + Math.PI / 2;
    g.add(s);
  }
  if (o.roof === null) {
    // crenellated, each merlon capped in gold
    g.add(merlonRing(r * 1.1, h + 0.3, 8, color, r * 0.42));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(box(r * 0.44, 0.08, r * 0.44, C.gold, Math.cos(a) * r * 1.1, h + 0.3 + r * 0.46, Math.sin(a) * r * 1.1));
    }
  } else {
    const ch = r * 2.2;
    g.add(cone(r * 1.22, ch, o.roof ?? C.tile, 12, 0, h + 0.4));
    g.add(cyl(0.07, 0.07, 1.1, C.gold, 5, 0, h + 0.4 + ch - 0.2));
    g.add(blob(0.18, C.gold, 0, h + 0.4 + ch + 0.5, 0));
    const sun = mesh(new THREE.TorusGeometry(0.34, 0.07, 5, 14), 0xffd35a, { emissive: 0x8a5a10 });
    sun.position.set(0, h + 0.4 + ch + 0.95, 0);
    g.add(sun);
  }
  if (o.banner !== undefined) {
    // a long blue banner hung down the tower's face, a gold sun on it
    const flag = new THREE.Group();
    flag.add(box(r * 0.95, h * 0.42, 0.05, o.banner, 0, 0, 0));
    flag.add(cone(r * 0.48, 0.5, o.banner, 3, 0, -0.5, 0).rotateZ(Math.PI));
    const disc = mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.22, 0.04, 10).rotateX(Math.PI / 2), 0xffd35a, { emissive: 0x6a4a10 });
    disc.position.set(0, h * 0.26, 0.04);
    flag.add(disc);
    flag.add(box(r * 1.05, 0.08, 0.08, C.gold, 0, h * 0.42, 0));
    flag.position.set(0, h * 0.4, r * 1.06);
    g.add(flag);
  }
  return g;
}

const GHOST_GREEN = 0x5cff9a, GHOST_EMIT = 0x1f9a4a;

/** Necromancer house: the old stone house under a steep black roof, iron spikes on the ridge, windows lit ghost-green. */
function necroHouse(o: HouseOpts): THREE.Group {
  const g = baseHouse({ ...o, roofH: o.roofH * 1.45, frame: null, chimney: false });
  g.traverse((c) => {
    if (c.userData.window && c instanceof THREE.Mesh) c.material = mat(GHOST_GREEN, { emissive: GHOST_EMIT });
  });
  const top = o.h + o.roofH * 1.45;
  const n = Math.max(2, Math.round(o.d / 1.6));
  for (let i = 0; i < n; i++) g.add(cone(0.09, 0.6, C.iron, 4, 0, top + 0.1, -o.d / 2 + ((i + 0.5) * o.d) / n));
  return g;
}

/** Necromancer tower: dark stone under a needle-thin black spire, a green light burning in the slits. */
function necroTower(r: number, h: number, o: TowerOpts): THREE.Group {
  const g = baseTower(r, h, { ...o, roof: null, merlons: o.merlons });
  g.add(cone(r * 1.1, r * 3.4, C.slate, 8, 0, h + 0.3));
  g.add(cone(0.08, 1.2, C.iron, 4, 0, h + 0.3 + r * 3.4));
  const glow = mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.18, 10), GHOST_GREEN, { emissive: GHOST_EMIT });
  glow.position.y = h * 0.72;
  g.add(glow);
  return g;
}

/** Sorcerer tower: slender and tapering on a slate plinth, banded with glowing runes, in a crooked
 *  witch's hat (or crenellated, crystals on the merlons), a crystal floating over it. */
function sorcererTower(r: number, h: number, o: TowerOpts): THREE.Group {
  const g = new THREE.Group();
  const color = o.color ?? C.stone;
  const hh = h * 1.12;
  g.add(cyl(r * 1.08, r * 1.12, 0.6, C.stoneDark, 10));
  g.add(cyl(r * 0.8, r * 0.98, hh, color, 10));
  g.add(runeRing(r * 0.95, hh * 0.3));
  g.add(runeRing(r * 0.86, hh * 0.72, VIO, VIO_EMIT));
  g.add(cyl(r * 0.98, r * 0.82, 0.45, C.stoneLight, 10, 0, hh - 0.4));
  let top = hh;
  if (o.roof === null) {
    g.add(merlonRing(r * 0.92, hh, 8, C.stoneLight, r * 0.36));
    for (let i = 0; i < 8; i += 2) {
      const a = (i / 8) * Math.PI * 2;
      const c = mesh(new THREE.OctahedronGeometry(r * 0.13, 0), VIO, { emissive: VIO_EMIT });
      c.scale.set(1, 1.8, 1);
      c.position.set(Math.cos(a) * r * 0.92, hh + r * 0.52, Math.sin(a) * r * 0.92);
      g.add(c);
    }
    top = hh + r * 0.6;
  } else {
    const hat = witchHat(r * 0.98, r * 2.6, o.roof ?? C.tile, 0.5);
    hat.position.y = hh;
    g.add(hat);
    top = hh + r * 2.6;
  }
  const cr = floatingCrystal(r * 0.42);
  cr.position.set(0, top + r * 0.9, 0);
  g.add(cr);
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + 0.5;
    const s = windowAt(Math.cos(a) * r * 0.85, hh * 0.55, Math.sin(a) * r * 0.85, true);
    s.rotation.set(Math.PI / 2, 0, -a + Math.PI / 2);
    g.add(s);
  }
  if (o.banner !== undefined) {
    const flag = box(1.2, 0.7, 0.05, o.banner, r + 0.6, hh * 0.8, 0);
    flag.userData.flag = true;
    g.add(flag);
  }
  return g;
}

/** Druid tower: a gnarled living trunk on buttress roots, ivy up its bark, a lit knot-window and a
 *  lookout ringed with a wattle rail under a layered crown of leaves, lanterns hanging from its boughs. */
function druidTower(r: number, h: number, o: TowerOpts): THREE.Group {
  const g = new THREE.Group();
  const rand = rng(Math.round(r * 97 + h * 13));
  g.add(gnarledTrunk(r * 0.6, r * 0.88, h, rand, { roots: 5, rootR: r * 0.26, spread: 1.5 }));
  // a wattle lookout ring at the top of the trunk
  g.add(cyl(r * 1.22, r * 1.12, 0.26, C.timberLight, 12, 0, h - 0.25));
  g.add(mesh(new THREE.TorusGeometry(r * 1.18, 0.07, 4, 16).rotateX(Math.PI / 2), C.timber).translateY(h + 0.55));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(0.09, 0.62, 0.09, C.timber, Math.cos(a) * r * 1.18, h, Math.sin(a) * r * 1.18));
  }
  // boughs spreading up into the crown
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    g.add(branch(new THREE.Vector3(Math.cos(a) * r * 0.3, h - 0.3, Math.sin(a) * r * 0.3), new THREE.Vector3(Math.cos(a) * r * 0.95, h + r * 0.95, Math.sin(a) * r * 0.95), r * 0.2, BARK_C));
  }
  const crownY = h + r * 0.55;
  const can = druidCanopy({ r: r * 1.5, h: r * 1.45, rand, droop: 6, blossom: 5, vines: 6, lanterns: r > 2 ? 2 : 1, dense: 0.72 });
  can.position.y = crownY;
  g.add(can);
  // a lit knot-hole window in the trunk
  const s = windowAt(0, h * 0.55, r * 0.93, true);
  g.add(s);
  g.add(mesh(new THREE.TorusGeometry(0.42, 0.09, 4, 10), BARK_DK_C).translateY(h * 0.55).translateZ(r * 0.95));
  if (o.banner !== undefined) {
    const flag = box(1.2, 0.7, 0.05, o.banner, r + 0.5, h * 0.75, 0);
    flag.userData.flag = true;
    g.add(flag);
  }
  return g;
}

// ---------- the Grove (druid): layered, faceted foliage ----------

export const BARK_C = 0x5a3f28, BARK_DK_C = 0x3f2c1c, MOSS_C = 0x5e7d32, MOSS_DK_C = 0x445c24;
export const LEAF_UNDER = 0x284a1e, LEAF_DEEP = 0x355f27, LEAF_MID = 0x4c8232, LEAF_SUN = 0x78a843, LEAF_LIME = 0xa6c552;
export const BLOSSOM = 0xf3a9c4, BLOSSOM_W = 0xfaf0ee, AMBER = 0xffc76a, AMBER_E = 0xd8842a, FIREFLY = 0xecff9a, FIREFLY_E = 0x9cbc26;
export const SPIRIT = 0xbff7e6, SPIRIT_E = 0x2a8a70, RUNE_G = 0xcdf38a, RUNE_G_E = 0x4f8a14;
const SNOW = 0xf3f7fa;

export type LeafTone = 'deep' | 'mid' | 'sun' | 'gold';
export interface LeafPal { top: number; mid: number; under: number }

/** The three colours of a leaf mass (sunlit top, body, shaded underside), by tone and season:
 *  the grove stays green all year; winter lays snow on the tops, the ash dulls it. */
export function leafPal(tone: LeafTone): LeafPal {
  if (season === 'winter') {
    return tone === 'deep' ? { top: SNOW, mid: 0x2c5230, under: 0x1f3d24 } : { top: SNOW, mid: 0x3a6a36, under: 0x2c5230 };
  }
  if (season === 'desert') {
    return tone === 'deep' ? { top: 0x8a9a4c, mid: 0x6a7c3a, under: 0x4c5a2c } : { top: 0xa6b25e, mid: 0x7e8e44, under: 0x5c6a32 };
  }
  if (season === 'jungle') {
    return tone === 'sun' ? { top: 0x6cc24e, mid: 0x3c9a3c, under: 0x24662a } : { top: 0x4aa846, mid: 0x2c7c32, under: 0x1a5022 };
  }
  if (season === 'volcanic') {
    return tone === 'sun' ? { top: 0x7c8650, mid: 0x5d6a3e, under: 0x414b2e } : { top: 0x5d6a3e, mid: 0x4a5634, under: 0x343d26 };
  }
  switch (tone) {
    case 'deep': return { top: LEAF_MID, mid: LEAF_DEEP, under: LEAF_UNDER };
    case 'sun': return { top: LEAF_LIME, mid: LEAF_SUN, under: LEAF_MID };
    case 'gold': return { top: 0xe8c65a, mid: 0xcf9a38, under: 0x8a6428 };
    default: return { top: LEAF_SUN, mid: LEAF_MID, under: LEAF_DEEP };
  }
}

/** Moss and turf: snowed over in winter. */
export function mossPal(): LeafPal {
  return season === 'winter' ? { top: SNOW, mid: 0x55703e, under: 0x3d5230 } : { top: 0x7ea64a, mid: MOSS_C, under: MOSS_DK_C };
}

function hash3(x: number, y: number, z: number, s: number): number {
  const v = Math.sin(Math.round(x * 997) * 0.0129898 + Math.round(y * 991) * 0.078233 + Math.round(z * 983) * 0.037719 + s * 1.618) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * A mass of leaves: a faceted, lumpy ball (squashed by sx/sy/sz), its facets sorted by which way
 * they face so the top catches the sun, the body is leaf-green and the underside falls into shade
 * (snow on the tops in winter). Three meshes at most, all of shared materials, so it bakes cheaply.
 */
export function leafCluster(r: number, tone: LeafTone | LeafPal, x = 0, y = 0, z = 0, sx = 1, sy = 0.78, sz = 1, detail = 1, seed = 0): THREE.Group {
  const pal = typeof tone === 'string' ? leafPal(tone) : tone;
  const src = new THREE.IcosahedronGeometry(r, detail);
  const p = src.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const h1 = hash3(v.x, v.y, v.z, seed), h2 = hash3(v.z, v.x, v.y, seed + 7);
    v.multiplyScalar(0.82 + h1 * 0.32);
    v.y += (h2 - 0.5) * r * 0.16;
    p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  const buckets: number[][] = [[], [], []];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const topT = season === 'winter' ? 0.5 : 0.34;
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    e1.subVectors(b, a); e2.subVectors(c, a);
    const n = e1.cross(e2).normalize();
    const k = n.y > topT ? 0 : n.y < -0.3 ? 2 : 1;
    buckets[k].push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  src.dispose();
  const g = new THREE.Group();
  [pal.top, pal.mid, pal.under].forEach((col, k) => {
    if (!buckets[k].length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(buckets[k], 3));
    geo.computeVertexNormals();
    g.add(mesh(geo, col));
  });
  g.position.set(x, y, z);
  return g;
}

/** A limb of wood from a to b, tapering (a bough, a root, a vine-thick branch). */
export function branch(a: THREE.Vector3, b: THREE.Vector3, r: number, color = BARK_C, seg = 6): THREE.Mesh {
  const d = b.clone().sub(a);
  const m = mesh(new THREE.CylinderGeometry(r * 0.55, r, d.length(), seg), color);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

/** A gnarled trunk: tapering, a little twisted, ridged bark, buttress roots flaring into the ground and moss at its foot. */
export function gnarledTrunk(rTop: number, rBot: number, h: number, rand: () => number, o: { roots?: number; rootR?: number; spread?: number; color?: number; moss?: boolean; door?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  const color = o.color ?? BARK_C;
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, 9, 3);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / h + 0.5, x = p.getX(i), z = p.getZ(i);
    const tw = y * 0.5, k = 1 + (hash3(Math.round(x * 3), Math.round(y * 6), Math.round(z * 3), 3) - 0.5) * 0.14;
    p.setXYZ(i, (x * Math.cos(tw) - z * Math.sin(tw)) * k, p.getY(i), (x * Math.sin(tw) + z * Math.cos(tw)) * k);
  }
  geo.translate(0, h / 2, 0);
  g.add(mesh(geo, color));
  // ridges of darker bark running up it
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const rr = (rTop + rBot) / 2;
    g.add(branch(new THREE.Vector3(Math.cos(a) * rBot * 0.96, 0, Math.sin(a) * rBot * 0.96), new THREE.Vector3(Math.cos(a + 0.5) * rTop * 0.96, h * (0.55 + rand() * 0.35), Math.sin(a + 0.5) * rTop * 0.96), rr * 0.14, BARK_DK_C, 4));
  }
  const roots = o.roots ?? 5, rootR = o.rootR ?? rBot * 0.35;
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * Math.PI * 2 + rand() * 0.5;
    if (o.door && Math.sin(a) > 0.72) continue; // keep the way to the door clear
    const out = rBot * ((o.spread ?? 1.9) + rand() * 0.4);
    const mid = new THREE.Vector3(Math.cos(a) * rBot * 1.15, h * 0.06 + rootR * 0.6, Math.sin(a) * rBot * 1.15);
    g.add(branch(new THREE.Vector3(Math.cos(a) * rBot * 0.55, h * 0.16 + rootR, Math.sin(a) * rBot * 0.55), mid, rootR, color, 5));
    g.add(branch(mid, new THREE.Vector3(Math.cos(a) * out, -0.1, Math.sin(a) * out), rootR * 0.8, i % 2 ? color : BARK_DK_C, 5));
  }
  if (o.moss !== false) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rand();
      g.add(leafCluster(rBot * 0.45, mossPal(), Math.cos(a) * rBot * 0.9, rBot * 0.25, Math.sin(a) * rBot * 0.9, 1.2, 0.45, 1.2, 0, i + 1));
    }
  }
  return g;
}

/** A lantern of bark and amber glass hanging on a cord (its top at the origin). */
export function hangingLantern(cord = 0.6, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.03, cord, 0.03, 0x3a2a18, 0, -cord, 0));
  g.add(cone(0.2 * s, 0.16 * s, BARK_DK_C, 6, 0, -cord - 0.02 * s));
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.12 * s, 0.32 * s, 6), detailMat(AMBER, { emissive: AMBER_E }));
  glass.position.y = -cord - 0.18 * s;
  g.add(glass);
  g.add(cyl(0.13 * s, 0.15 * s, 0.05 * s, BARK_DK_C, 6, 0, -cord - 0.39 * s));
  return g;
}

/**
 * A druid crown of leaves, its underside at the origin: a broad, drooping lower ring of deep green,
 * a fuller middle, a sunlit top; branch tips hanging below the rim, willow strands and vines, a
 * scatter of blossom, a few gold leaves in autumn, and lanterns hung in the boughs.
 */
export function druidCanopy(o: { r: number; h?: number; rand: () => number; droop?: number; blossom?: number; vines?: number; lanterns?: number; gold?: number; detail?: number; dense?: number; glow?: number }): THREE.Group {
  const g = new THREE.Group();
  const { r, rand } = o;
  const h = o.h ?? r * 0.9;
  const det = o.detail ?? 1;
  const autumn = season === 'fall';
  const pickGold = (t: LeafTone): LeafTone => (autumn && rand() < (o.gold ?? 0) ? 'gold' : t);
  const n0 = Math.round((5 + r * 1.1) * (o.dense ?? 1)), n1 = Math.max(3, n0 - 2);
  const seed = Math.floor(rand() * 1000);
  // the broad lower ring, heavy and dark
  for (let i = 0; i < n0; i++) {
    const a = (i / n0) * Math.PI * 2 + rand() * 0.4;
    const d = r * (0.62 + rand() * 0.14);
    g.add(leafCluster(r * (0.36 + rand() * 0.08), i % 3 === 0 ? 'mid' : 'deep', Math.cos(a) * d, h * (0.16 + rand() * 0.1), Math.sin(a) * d, 1.15, 0.62, 1.15, det, seed + i));
  }
  // the fuller middle
  for (let i = 0; i < n1; i++) {
    const a = (i / n1) * Math.PI * 2 + 0.5 + rand() * 0.4;
    const d = r * (0.34 + rand() * 0.12);
    g.add(leafCluster(r * (0.36 + rand() * 0.06), pickGold(i % 2 ? 'sun' : 'mid'), Math.cos(a) * d, h * (0.48 + rand() * 0.1), Math.sin(a) * d, 1.05, 0.72, 1.05, det, seed + 40 + i));
  }
  // the sunlit top
  g.add(leafCluster(r * 0.4, 'sun', (rand() - 0.5) * r * 0.2, h * 0.78, (rand() - 0.5) * r * 0.2, 1, 0.72, 1, det, seed + 80));
  if (r > 2.2) g.add(leafCluster(r * 0.26, 'sun', r * 0.22, h * 0.94, -r * 0.12, 1, 0.8, 1, det, seed + 81));
  // branch tips drooping below the rim
  const droop = o.droop ?? 0;
  for (let i = 0; i < droop; i++) {
    const a = (i / droop) * Math.PI * 2 + rand() * 0.6;
    const d = r * (0.8 + rand() * 0.12);
    g.add(leafCluster(r * 0.17, 'deep', Math.cos(a) * d, -r * 0.02, Math.sin(a) * d, 0.9, 1.35, 0.9, 0, seed + 100 + i));
  }
  // willow strands and vines hanging from the rim, a leaf at every tip
  const vines = o.vines ?? 0;
  for (let i = 0; i < vines; i++) {
    const a = (i / vines) * Math.PI * 2 + rand() * 0.5;
    const d = r * (0.55 + rand() * 0.3);
    const len = r * (0.35 + rand() * 0.5);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    g.add(box(0.06, len, 0.06, season === 'winter' ? 0x3a5a36 : MOSS_DK_C, x, h * 0.1 - len, z));
    g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), detailMat(season === 'winter' ? 0x3b6b37 : 0x7aab46)).translateX(x).translateY(h * 0.1 - len).translateZ(z));
  }
  // blossom on the sunny top (not in winter)
  const bl = season === 'winter' ? 0 : o.blossom ?? 0;
  for (let i = 0; i < bl; i++) {
    const a = rand() * Math.PI * 2, el = 0.35 + rand() * 0.8;
    const d = r * 0.75 * Math.cos(el);
    const f = new THREE.Mesh(new THREE.OctahedronGeometry(Math.max(0.12, r * 0.05), 0), detailMat(i % 3 ? BLOSSOM : BLOSSOM_W));
    f.position.set(Math.cos(a) * d, h * (0.3 + Math.sin(el) * 0.62), Math.sin(a) * d);
    g.add(f);
  }
  // lanterns hung from the boughs
  const lan = o.lanterns ?? 0;
  for (let i = 0; i < lan; i++) {
    const a = (i / lan) * Math.PI * 2 + 0.9;
    const d = r * 0.86;
    const l = hangingLantern(0.5 + rand() * 0.5, Math.min(1.5, 0.9 + r * 0.1));
    l.position.set(Math.cos(a) * d, h * 0.04, Math.sin(a) * d);
    g.add(l);
  }
  // glow-berries: tiny soft lights among the leaves, that come into their own at night
  const glow = o.glow ?? 0;
  for (let i = 0; i < glow; i++) {
    const a = rand() * Math.PI * 2, el = rand() * 1.1;
    const d = r * (0.72 + rand() * 0.12) * Math.cos(el);
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.11 + r * 0.012, 0), detailMat(FIREFLY, { emissive: FIREFLY_E }));
    m.position.set(Math.cos(a) * d, h * (0.22 + Math.sin(el) * 0.62), Math.sin(a) * d);
    g.add(m);
  }
  return g;
}

/** A material for small bright details that need cast no shadow (see bake). */
export function detailMat(color: number, opts?: Parameters<typeof mat>[1]): THREE.MeshLambertMaterial {
  const m = mat(color, opts);
  m.userData.noShadow = true;
  return m;
}

/** A spiral carved into stone and glowing faintly (lies in the XY plane, facing +Z). */
export function spiralGlyph(s = 1, color = RUNE_G, emissive = RUNE_G_E): THREE.Mesh {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 18; i++) {
    const k = i / 18, a = k * Math.PI * 4.2;
    pts.push(new THREE.Vector3(Math.cos(a) * k * 0.32 * s, Math.sin(a) * k * 0.32 * s, 0));
  }
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.035 * s, 3, false), detailMat(color, { emissive }));
  m.castShadow = false;
  return m;
}

/** A swarm (fireflies, wisps, petals) merged into one mesh per material so it moves as one and costs one draw. */
export function swarm(parts: THREE.Group, flags: Record<string, unknown>): THREE.Group {
  const g = bake(parts);
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = false; });
  Object.assign(g.userData, { dynamic: true }, flags);
  return g;
}

/** Fireflies drifting about a spot: n motes merged into one mesh, turning slowly and bobbing. */
export function fireflies(n: number, rad: number, height: number, rand: () => number, spirit = false): THREE.Group {
  const parts = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, d = rad * (0.35 + rand() * 0.65);
    const big = spirit && i % 3 === 0;
    const m = mesh(big ? new THREE.IcosahedronGeometry(0.24, 0) : new THREE.OctahedronGeometry(0.12, 0), big ? SPIRIT : FIREFLY, { emissive: big ? SPIRIT_E : FIREFLY_E });
    m.position.set(Math.cos(a) * d, rand() * height, Math.sin(a) * d);
    parts.add(m);
  }
  return swarm(parts, { orbit: 0.22 + rand() * 0.1, bob: 0.45 });
}

/** Goblin tower: crates and planks stacked ever higher, capped with rust and spikes. */
function goblinTower(r: number, h: number, o: TowerOpts): THREE.Group {
  const g = new THREE.Group();
  const levels = Math.max(2, Math.round(h / 2));
  const step = h / levels;
  for (let i = 0; i < levels; i++) {
    const s = r * 1.9 * (1 - i * 0.08);
    const lvl = box(s, step, s, i % 2 ? C.timber : C.timberLight, Math.sin(i * 2.3) * 0.15, i * step, Math.cos(i * 1.7) * 0.15);
    lvl.rotation.y = Math.sin(i * 1.3) * 0.25;
    g.add(lvl);
  }
  g.add(cone(r * 1.25, r * 1.4, C.tile, 4, 0, h, 0).rotateY(0.5));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const sp = cone(0.1, 0.9, C.iron, 4, Math.cos(a) * r * 0.9, h - 0.4, Math.sin(a) * r * 0.9);
    sp.rotation.z = -Math.cos(a) * 1.1;
    sp.rotation.x = Math.sin(a) * 1.1;
    g.add(sp);
  }
  g.add(windowAt(0, h * 0.5, r * 0.97));
  if (o.banner !== undefined) {
    const flag = box(1.1, 0.7, 0.05, o.banner, r + 0.5, h * 0.8, 0);
    flag.userData.flag = true;
    g.add(flag);
  }
  return g;
}

// ---------- the Horde (orc): a warlord's stronghold of raw logs, smoked hides, dark stone and bone ----------

/** The Horde's own colours (none is a palette key, so no season or theme repaints them). */
export const ORC_SKIN = 0x6f8a3a, ORC_SKIN_DK = 0x566f2c, BONE_W = 0xe3d8bf, BONE_SH = 0xb5a88b, IRON_BK = 0x4a4645,
  HIDE_C = 0x8a6440, HIDE_DK = 0x5e4028, ROPE = 0xa8905f, BLOOD = 0xa3261a, SOCKET = 0x1c1410,
  EMBER = 0xff8a3a, EMBER_E = 0xb8420c, MOLTEN = 0xffb24a, MOLTEN_E = 0xc8600a;

const UP = new THREE.Vector3(0, 1, 0);

/** A tapering pole from a to b (a log, a lashing pole, a segment of horn). */
export function limb(a: THREE.Vector3, b: THREE.Vector3, rBot: number, rTop: number, color: number, seg = 5): THREE.Mesh {
  const d = b.clone().sub(a);
  const m = mesh(new THREE.CylinderGeometry(rTop, rBot, d.length(), seg), color);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

/** A horn or a tusk: a curve from a (its root, r thick) bending by c to its point at b. */
export function horn(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, r: number, color = BONE_W, segs = 4): THREE.Group {
  const g = new THREE.Group();
  const q = new THREE.QuadraticBezierCurve3(a, c, b);
  let prev = a.clone();
  for (let i = 1; i <= segs; i++) {
    const p = q.getPoint(i / segs);
    // each piece runs a little past the last one's end, so the bend shows no gap
    const from = prev.clone().addScaledVector(p.clone().sub(prev).normalize(), -r * 0.25);
    g.add(limb(from, p, r * (1 - (i - 1) / segs) + 0.012, r * (1 - i / segs) + 0.012, color, 5));
    prev = p;
  }
  return g;
}

/** A pair of horns (or tusks) either side of x = 0, sweeping out by `out`, up by `up` and forward by `fwd`. */
export function hornPair(x: number, y: number, z: number, out: number, up: number, fwd: number, r: number, color = BONE_W, inward = false): THREE.Group {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const a = new THREE.Vector3(s * x, y, z);
    const c = new THREE.Vector3(s * (x + out), y + up * 0.35, z + fwd * 0.3);
    const b = new THREE.Vector3(s * (x + (inward ? out * 0.25 : out * 0.8)), y + up, z + fwd);
    g.add(horn(a, c, b, r, color));
  }
  return g;
}

/** A skull (an orc's, tusks and all): bone, dark sockets, or embers burning in them. */
export function orcSkull(s = 1, glow = false): THREE.Group {
  const g = new THREE.Group();
  g.add(blob(0.5 * s, BONE_W, 0, 0, 0, 1, 0.88, 1.05));
  g.add(box(0.44 * s, 0.24 * s, 0.36 * s, BONE_SH, 0, -0.5 * s, 0.12 * s));
  for (const x of [-1, 1]) {
    g.add(cone(0.06 * s, 0.26 * s, BONE_W, 4, x * 0.17 * s, -0.4 * s, 0.3 * s));
    if (glow) g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.1 * s, 0), detailMat(EMBER, { emissive: EMBER_E })).translateX(x * 0.17 * s).translateY(0.02 * s).translateZ(0.44 * s));
    else g.add(box(0.16 * s, 0.14 * s, 0.08 * s, SOCKET, x * 0.17 * s, -0.04 * s, 0.46 * s));
  }
  return g;
}

/** A cone of sharpened stake leaning outward from the centre (at angle a) by `lean`. */
export function stake(x: number, y: number, z: number, h: number, r: number, a: number, lean: number, color: number = C.timber): THREE.Mesh {
  const st = cone(r, h, color, 5, x, y, z);
  st.rotation.z = -Math.cos(a) * lean;
  st.rotation.x = Math.sin(a) * lean;
  return st;
}

/**
 * Orc house: a longhouse of upright raw logs on a footing of dark stone, a steep roof of smoked hides
 * lashed down with poles, the gable poles crossed high over the ridge and tipped with bone, tusks
 * framing the door, a skull over it, a blood-red war cloth by it and narrow slits of firelight.
 */
function orcHouse(o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const roofH = o.roofH * 1.2;
  const top = h + roofH;
  const wall = o.wall ?? (o.stone ? C.stone : C.timberLight);
  g.add(box(w + 0.3, 0.5, d + 0.3, C.stoneDark));
  g.add(extrude([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0, top], [-w / 2, h]], d, wall));
  const dw = Math.min(1.3, w * 0.22), dh = Math.min(2.1, h * 0.64);
  const n = Math.max(3, Math.round(w / 0.62)), lr = (w / n) * 0.5;
  const face = o.stone ? 0.04 : lr;
  if (o.stone) {
    // a timber hoarding (an overhanging gallery) round the top of the stone walls
    g.add(box(w + 0.36, 0.85, d + 0.36, C.timber, 0, h - 0.9, 0));
    for (const z of [d / 2 + 0.19, -d / 2 - 0.19]) for (let i = 0; i < n; i += 2) g.add(box(0.12, 0.9, 0.06, C.timberLight, -w / 2 + (i + 0.5) * (w / n), h - 0.92, z));
  } else {
    // upright logs on the front and back walls (a gap in them for the door)
    for (const z of [d / 2, -d / 2]) for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * (w / n);
      if (z > 0 && o.door !== false && Math.abs(x) < dw / 2 + lr * 0.4) continue;
      g.add(cyl(lr, lr * 1.05, h, i % 3 === 1 ? C.timber : C.timberLight, 5, x, 0, z));
    }
  }
  // thick corner posts, sharpened where they stand proud of the eaves
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) {
    g.add(cyl(0.22, 0.27, h + 0.5, C.timber, 6, x, 0, z));
    g.add(cone(0.22, 0.5, C.timber, 6, x, h + 0.5, z));
  }
  // the hide roof, with patches stitched over it and poles laid across to hold it down
  const roofC = o.roof ?? C.thatch;
  const patch = roofC === C.thatch ? C.thatchDark : C.tileDark;
  const half = w / 2 + 0.5, theta = Math.atan2(roofH, w / 2), len = half / Math.cos(theta) + 0.2;
  for (const side of [-1, 1]) {
    const s = new THREE.Group();
    s.add(box(len, 0.3, d + 1.0, roofC, 0, 0, 0));
    s.add(box(len * 0.4, 0.06, d * 0.32, patch, side * len * 0.18, 0.3, d * 0.22 * side));
    s.add(box(len * 0.3, 0.06, d * 0.24, patch, -side * len * 0.2, 0.3, -d * 0.26 * side));
    for (const z of [-d * 0.36, d * 0.36]) s.add(box(len + 0.1, 0.12, 0.12, C.timber, 0, 0.32, z));
    s.rotation.z = -side * theta;
    s.position.set(side * (half / 2), top - (half / 2) * Math.tan(theta), 0);
    g.add(s);
  }
  g.add(box(0.34, 0.32, d + 1.1, C.timber, 0, top + 0.12, 0));
  // the gable poles crossed high over the ridge, tipped with bone
  for (const z of [d / 2 + 0.52, -d / 2 - 0.52]) for (const side of [-1, 1]) {
    const a = new THREE.Vector3(side * (half - 0.1), top - (half - 0.1) * Math.tan(theta) + 0.36, z);
    const dir = new THREE.Vector3(-side, Math.tan(theta), 0).normalize();
    const b = new THREE.Vector3(-side * 0.8, top + 0.36 + 0.8 * Math.tan(theta), z);
    g.add(limb(a, b, 0.1, 0.09, C.timber));
    if (z > 0) g.add(limb(b, b.clone().addScaledVector(dir, 0.7).add(new THREE.Vector3(0, 0.25, 0)), 0.1, 0.012, BONE_W));
  }
  if (o.door !== false) {
    const dz = d / 2 + 0.12;
    g.add(box(dw, dh, 0.22, C.door, 0, 0, dz));
    for (const y of [dh * 0.3, dh * 0.72]) g.add(box(dw + 0.04, 0.09, 0.06, IRON_BK, 0, y, dz + 0.12));
    const sk = orcSkull(0.42);
    sk.position.set(0, dh + 0.42, d / 2 + face + 0.12);
    g.add(sk);
    // tusks framing the door on the bigger houses
    if (w > 4.5) g.add(hornPair(dw / 2 + 0.28, 0.1, d / 2 + face + 0.3, 0.45, dh + 0.3, 0.25, 0.14, BONE_W, true));
    // a war cloth hung from the eaves beside it
    if (w > 3.5) {
      const cx = -w * 0.32;
      g.add(box(0.1, 0.1, 0.1, C.timber, cx, h - 0.2, d / 2 + face + 0.05));
      g.add(box(0.7, Math.min(1.4, h * 0.45), 0.05, C.red, cx, h - 0.25 - Math.min(1.4, h * 0.45), d / 2 + face + 0.08));
      g.add(box(0.22, 0.22, 0.06, BONE_W, cx, h - 0.25 - Math.min(1.4, h * 0.45) * 0.55, d / 2 + face + 0.1));
    }
  }
  const nw = o.windows ?? Math.max(0, Math.floor(w / 2.4));
  for (let i = 0; i < nw; i++) {
    const x = -w / 2 + ((i + 1) * w) / (nw + 1);
    if (Math.abs(x) < 1 && o.door !== false) continue;
    if (w > 3.5 && Math.abs(x + w * 0.32) < 0.5) continue;
    const win = box(0.3, 0.64, 0.12, C.window, x, h * 0.52, d / 2 + face + 0.04);
    win.userData.window = true;
    g.add(win);
  }
  if (o.chimney) {
    g.add(cyl(0.42, 0.52, roofH + 1.3, C.stoneDark, 6, w * 0.22, h, -d * 0.2));
    g.add(cyl(0.48, 0.48, 0.14, IRON_BK, 6, w * 0.22, h + roofH + 0.9, -d * 0.2));
  }
  return g;
}

/**
 * Orc tower: a squat base of rough dark stone, boulders heaped at its foot, a stage of upright logs
 * lashed with rope above it, a jutting deck bristling with sharpened stakes, and on top a steep hide
 * roof with bone horns at its peak, or (open) a skull and a great pair of horns.
 */
function orcTower(r: number, h: number, o: TowerOpts): THREE.Group {
  const g = new THREE.Group();
  const color = o.color ?? C.stone;
  const sh = h * 0.5;
  g.add(cyl(r * 0.9, r * 1.12, sh, color, 7));
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26 + 0.3;
    g.add(blob(r * 0.3, C.stoneDark, Math.cos(a) * r * 1.02, r * 0.1, Math.sin(a) * r * 1.02, 1.2, 0.7, 1.1));
  }
  g.add(cyl(r * 0.98, r * 0.92, h - sh, C.timberLight, 8, 0, sh));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    g.add(cyl(r * 0.13, r * 0.14, h - sh + 0.25, C.timber, 5, Math.cos(a) * r * 0.97, sh - 0.2, Math.sin(a) * r * 0.97));
  }
  for (const y of [sh + 0.35, h - 0.45]) g.add(mesh(new THREE.TorusGeometry(r * 1.02, 0.06, 3, 12).rotateX(Math.PI / 2), ROPE).translateY(y));
  // arrow slits, lit at night
  for (const a of [Math.PI / 2, Math.PI / 2 + 2.1]) {
    const s = box(0.26, 0.7, 0.12, C.window, Math.cos(a) * r * 0.97, sh + (h - sh) * 0.3, Math.sin(a) * r * 0.97);
    s.rotation.y = -a + Math.PI / 2;
    s.userData.window = true;
    g.add(s);
  }
  // the fighting deck, bristling with stakes
  g.add(cyl(r * 1.26, r * 1.16, 0.32, C.timber, 8, 0, h));
  const ns = Math.max(8, Math.round(r * 5));
  for (let i = 0; i < ns; i++) {
    const a = (i / ns) * Math.PI * 2;
    g.add(stake(Math.cos(a) * r * 1.18, h + 0.25, Math.sin(a) * r * 1.18, 0.95 + (i % 2) * 0.35, 0.1, a, 0.35));
  }
  if (o.roof === null) {
    // open: a skull staring out and a great pair of horns
    const sk = orcSkull(r * 0.32);
    sk.position.set(0, h + 0.75, r * 1.12);
    g.add(sk);
    g.add(hornPair(r * 0.62, h + 0.3, -r * 0.2, r * 0.75, r * 1.25, r * 0.3, r * 0.14));
  } else {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      g.add(cyl(0.09, 0.1, 1.2, C.timber, 4, Math.cos(a) * r * 0.9, h + 0.3, Math.sin(a) * r * 0.9));
    }
    const rh = r * 1.7;
    g.add(cone(r * 1.42, rh, o.roof ?? C.thatch, 7, 0, h + 1.35));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.add(stake(Math.cos(a) * 0.18, h + 1.35 + rh * 0.8, Math.sin(a) * 0.18, rh * 0.45, 0.06, a, 0.3));
    }
    g.add(hornPair(0.16, h + 1.35 + rh * 0.72, 0, r * 0.45, r * 0.7, 0, r * 0.09));
  }
  if (o.banner !== undefined) {
    // a long war banner down the tower's face, a skull painted on it
    const bw = r * 0.62, bh = h * 0.28;
    const f = new THREE.Group();
    f.add(box(bw + 0.3, 0.1, 0.1, C.timber, 0, 0, 0));
    f.add(box(bw, bh, 0.05, o.banner, 0, -bh, 0.02));
    f.add(cone(bw * 0.5, bh * 0.22, o.banner, 3, 0, -bh - bh * 0.2, 0.02).rotateZ(Math.PI));
    f.add(blob(bw * 0.2, BONE_W, 0, -bh * 0.42, 0.06, 1, 1, 0.3));
    f.position.set(0, h - 0.15, r * 1.02);
    g.add(f);
  }
  return g;
}

// ---------- the Deepforge (dwarf): a hold of carved granite on black basalt, bronze roofs and rune-fire ----------

/** The Forgelord's own colours (none is a palette key, so no season or theme repaints them). */
export const DW_GRANITE = 0x8c8279, DW_GRANITE_LT = 0xa89c8e, DW_BASALT = 0x3a3432, DW_BASALT_MD = 0x544b46,
  DW_BRONZE = 0xb57a3c, DW_BRONZE_DK = 0x7e5228, DW_GOLD = 0xe2ae3e, DW_RUNE = 0xffa24a, DW_RUNE_E = 0xc8560e,
  DW_LAVA = 0xff7a26, DW_LAVA_E = 0xe0480a, DW_OAK = 0x5c4230, DW_SLAB = 0x5e5650;

/** A block that narrows (or widens) toward its top: wb x db at its foot, wt x dt at its head, standing on y = 0. */
export function frustum(wb: number, db: number, wt: number, dt: number, h: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const geo = new THREE.BoxGeometry(wb, h, db);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, p.getX(i) * (wt / wb), p.getY(i), p.getZ(i) * (dt / db));
  geo.translate(0, h / 2, 0);
  geo.computeVertexNormals();
  const m = mesh(geo, color);
  m.position.set(x, y, z);
  return m;
}

/** A rune cut into the stone and glowing with forge-fire: a stave and its branches in the XY plane (facing +Z); `k` picks the rune. */
export function forgeRune(s: number, k: number): THREE.Group {
  const g = new THREE.Group();
  const m = detailMat(DW_RUNE, { emissive: DW_RUNE_E });
  const bar = (len: number, x: number, y: number, a: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.075 * s, len * s, 0.05), m);
    b.position.set(x * s, y * s, 0);
    b.rotation.z = a;
    g.add(b);
  };
  bar(1, 0, 0, 0);
  switch (((k % 5) + 5) % 5) {
    case 0: bar(0.46, 0.15, 0.3, -0.85); bar(0.46, 0.15, 0.04, -0.85); break;
    case 1: bar(0.5, 0.16, 0.18, 0.95); bar(0.5, 0.16, -0.18, -0.95); break;
    case 2: bar(0.66, 0, 0.05, 0.9); bar(0.66, 0, 0.05, -0.9); break;
    case 3: bar(0.4, 0.14, 0.3, 0.8); bar(0.4, 0.14, 0.1, -0.8); break;
    default: bar(1, 0.4, 0, 0); bar(0.56, 0.2, 0.18, -1.05); break;
  }
  return g;
}

/** A straight rake of stone coping from (x0, y0) to (x1, y1), at depth z. */
export function coping(x0: number, y0: number, x1: number, y1: number, z: number, color: number, t = 0.34, d = 0.5): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(Math.hypot(x1 - x0, y1 - y0), t, d), color);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
  m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
  return m;
}

/**
 * Dwarf house: squat walls of granite blocks on a basalt plinth, battered out at the foot, the corners laid
 * in long and short quoins; a low roof of bronze plates with standing seams (plain stone slabs on the humbler
 * sheds) under heavy stone copings, a bronze rune-disc in the gable, small deep-set windows, and a door of
 * bronze-bound oak sunk under a massive lintel with a rune glowing in it.
 */
function dwarfHouse(o: HouseOpts): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const roofH = o.roofH * 0.62;
  const top = h + roofH;
  const humble = o.roof === C.thatch || o.roof === C.thatchDark;
  const wall = o.wall ?? (o.stone ? DW_GRANITE_LT : DW_GRANITE);
  const trim = o.stone ? DW_BASALT_MD : DW_GRANITE_LT;
  g.add(box(w + 0.36, 0.5, d + 0.36, DW_BASALT));
  g.add(frustum(w + 0.26, d + 0.26, w + 0.02, d + 0.02, 0.9, DW_BASALT_MD, 0, 0.5, 0));
  g.add(extrude([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0, top], [-w / 2, h]], d, wall));
  // long-and-short quoins up the corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let y = 1.4, k = 0; y < h - 0.45; y += 0.62, k++) {
      const long = (k + (sx * sz > 0 ? 1 : 0)) % 2 === 0;
      g.add(box(long ? 0.72 : 0.44, 0.54, long ? 0.44 : 0.72, trim, sx * (w / 2 - (long ? 0.31 : 0.17)), y, sz * (d / 2 - (long ? 0.17 : 0.31))));
    }
  }
  // the cornice under the eaves
  g.add(box(w + 0.22, 0.24, d + 0.22, trim, 0, h - 0.24, 0));
  // the roof: bronze plates with standing seams, or stone slabs in courses
  const roofC = humble ? DW_SLAB : o.roof === C.slate ? DW_BASALT_MD : DW_BRONZE;
  const seam = humble ? DW_BASALT_MD : o.roof === C.slate ? DW_BASALT : DW_BRONZE_DK;
  const half = w / 2 + 0.42, theta = Math.atan2(roofH, w / 2), len = half / Math.cos(theta) + 0.12;
  for (const side of [-1, 1]) {
    const s = new THREE.Group();
    s.add(box(len, 0.26, d + 0.5, roofC));
    if (humble) for (let i = 1; i < 3; i++) s.add(box(0.12, 0.1, d + 0.52, seam, -len / 2 + (i * len) / 3, 0.22, 0));
    else {
      const n = Math.max(3, Math.round(d / 0.95));
      for (let i = 0; i <= n; i++) s.add(box(len, 0.1, 0.09, seam, 0, 0.24, -d / 2 - 0.2 + (i * (d + 0.4)) / n));
    }
    s.rotation.z = -side * theta;
    s.position.set(side * (half / 2), top - (half / 2) * Math.tan(theta), 0);
    g.add(s);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, d + 0.66, 6).rotateX(Math.PI / 2), seam).translateY(top + 0.22));
  // heavy stone copings up both gables, kneelers at their feet and a capstone at the apex
  for (const z of [d / 2 + 0.06, -d / 2 - 0.06]) {
    for (const side of [-1, 1]) {
      g.add(coping(side * (w / 2 + 0.28), h + 0.12, side * 0.1, top + 0.3, z, trim));
      g.add(box(0.56, 0.5, 0.6, trim, side * (w / 2 + 0.1), h - 0.3, z));
    }
    g.add(frustum(0.6, 0.6, 0.3, 0.3, 0.45, trim, 0, top + 0.28, z));
  }
  // a bronze rune-disc in the front gable (a rune cut in the stone on the humbler ones)
  // (tagged, so a building that hangs its sign on the gable can take it down)
  if (w > 3.4) {
    const gy = h + roofH * 0.42, rr = Math.min(0.52, roofH * 0.3);
    const disc = new THREE.Group();
    disc.userData.gableDisc = true;
    if (!humble) {
      disc.add(mesh(new THREE.CylinderGeometry(rr, rr, 0.1, 10).rotateX(Math.PI / 2), DW_BRONZE).translateY(gy).translateZ(d / 2 + 0.05));
      disc.add(mesh(new THREE.TorusGeometry(rr, 0.05, 4, 10), DW_GOLD).translateY(gy).translateZ(d / 2 + 0.1));
    }
    const rn = forgeRune(rr * 1.1, Math.round(w * 3 + d));
    rn.position.set(0, gy, d / 2 + (humble ? 0.03 : 0.12));
    disc.add(rn);
    g.add(disc);
  }
  if (o.door !== false) {
    const dw = Math.min(1.25, w * 0.24), dh = Math.min(2.0, h * 0.64), dz = d / 2;
    g.add(box(dw, dh, 0.14, DW_OAK, 0, 0, dz));
    for (const y of [dh * 0.28, dh * 0.72]) g.add(box(dw + 0.02, 0.1, 0.06, DW_BRONZE, 0, y, dz + 0.08));
    g.add(box(0.05, dh, 0.06, DW_BASALT, 0, 0, dz + 0.08));
    for (const s of [-1, 1]) g.add(box(0.3, dh + 0.05, 0.4, trim, s * (dw / 2 + 0.15), 0, dz + 0.06));
    g.add(frustum(dw + 0.62, 0.44, dw + 1.02, 0.44, 0.52, trim, 0, dh + 0.04, dz + 0.08));
    const rn = forgeRune(0.3, Math.round(w * 7));
    rn.position.set(0, dh + 0.3, dz + 0.32);
    g.add(rn);
  }
  const nw = o.windows ?? Math.max(0, Math.floor(w / 2.4));
  for (let i = 0; i < nw; i++) {
    const x = -w / 2 + ((i + 1) * w) / (nw + 1);
    if (Math.abs(x) < 1.1 && o.door !== false) continue;
    const win = box(0.46, 0.6, 0.12, C.window, x, h * 0.46, d / 2 + 0.02);
    win.userData.window = true;
    g.add(win);
    g.add(box(0.78, 0.16, 0.24, trim, x, h * 0.46 + 0.6, d / 2 + 0.05), box(0.66, 0.1, 0.22, trim, x, h * 0.46 - 0.1, d / 2 + 0.05));
  }
  if (o.chimney) {
    const cx = w * 0.24, cz = -d * 0.18;
    g.add(box(0.9, roofH + 1.7, 0.9, DW_BASALT_MD, cx, h, cz));
    g.add(box(1.14, 0.24, 1.14, DW_BRONZE_DK, cx, h + roofH + 1.55, cz));
  }
  return g;
}

/**
 * Dwarf tower: eight-sided and battered out at the foot on a basalt plinth, a string course and a ring of
 * glowing runes round it, a parapet jutting on corbels at the top; a low eight-sided roof of bronze plates
 * with a gold finial, or (open) chunky merlons. Its banner hangs long down its face from a gold rod.
 */
function dwarfTower(r: number, h: number, o: TowerOpts): THREE.Group {
  const g = new THREE.Group();
  const color = o.color ?? DW_GRANITE;
  const oct = (m: THREE.Mesh) => { m.rotation.y = Math.PI / 8; return m; };
  g.add(oct(cyl(r * 0.94, r * 1.14, h, color, 8)));
  g.add(oct(cyl(r * 1.24, r * 1.3, 0.7, DW_BASALT, 8)));
  g.add(oct(cyl(r * 1.06, r * 1.07, 0.22, DW_BASALT_MD, 8, 0, h * 0.48)));
  const rAt = (y: number) => (r * 1.14 - r * 0.2 * (y / h)) * Math.cos(Math.PI / 8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const rn = forgeRune(0.42, i);
    rn.position.set(Math.cos(a) * (rAt(h * 0.68) + 0.03), h * 0.68, Math.sin(a) * (rAt(h * 0.68) + 0.03));
    rn.rotation.y = Math.PI / 2 - a;
    g.add(rn);
  }
  for (const a of [Math.PI / 2 + 0.79, Math.PI / 2 - 2.36]) {
    const s = box(0.24, 0.72, 0.12, C.window, Math.cos(a) * rAt(h * 0.3), h * 0.3, Math.sin(a) * rAt(h * 0.3));
    s.rotation.y = Math.PI / 2 - a;
    s.userData.window = true;
    g.add(s);
  }
  // corbels under the parapet
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const c = frustum(0.34, 0.2, 0.34, 0.56, 0.5, DW_GRANITE_LT, Math.cos(a) * rAt(h - 0.6), h - 0.62, Math.sin(a) * rAt(h - 0.6));
    c.rotation.y = Math.PI / 2 - a;
    g.add(c);
  }
  g.add(oct(cyl(r * 1.24, r * 1.16, 0.95, DW_GRANITE_LT, 8, 0, h - 0.2)));
  if (o.roof === null) {
    if (o.merlons !== false) for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const m = box(r * 0.5, 0.62, 0.42, DW_GRANITE_LT, Math.cos(a) * r * 1.02, h + 0.75, Math.sin(a) * r * 1.02);
      m.rotation.y = Math.PI / 2 - a;
      g.add(m);
    }
  } else {
    const rh = r * 1.25;
    g.add(oct(cone(r * 1.34, rh, o.roof ?? C.tile, 8, 0, h + 0.75)));
    g.add(oct(cyl(r * 1.3, r * 1.3, 0.14, DW_BRONZE_DK, 8, 0, h + 0.7)));
    g.add(cyl(0.18, 0.2, 0.4, DW_BRONZE_DK, 6, 0, h + 0.7 + rh - 0.2));
    g.add(blob(0.2, DW_GOLD, 0, h + 0.95 + rh, 0));
    g.add(cone(0.08, 0.55, DW_GOLD, 5, 0, h + 1.05 + rh, 0));
  }
  if (o.banner !== undefined) {
    const bh = h * 0.36, bw = r * 0.8, fz = rAt(h - 1.2) + 0.1;
    g.add(box(bw + 0.34, 0.1, 0.1, DW_GOLD, 0, h - 1.15, fz));
    g.add(box(bw, bh, 0.05, o.banner, 0, h - 1.15 - bh, fz));
    for (const x of [-bw / 3, bw / 3]) g.add(cone(bw / 6, 0.4, o.banner, 3, x, h - 1.15 - bh, fz).rotateZ(Math.PI));
    g.add(box(bw + 0.02, 0.07, 0.06, DW_GOLD, 0, h - 1.15 - bh * 0.18, fz + 0.02));
    const rn = forgeRune(bw * 0.55, 4);
    rn.position.set(0, h - 1.15 - bh * 0.55, fz + 0.05);
    g.add(rn);
  }
  return g;
}
