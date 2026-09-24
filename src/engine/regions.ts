// The realm's regions. The heartland is green meadow and forest; around it lie four
// wilds, each with its own hero who answers only villages there: the volcanic west,
// the frozen north, the desert east and the jungle south. A region depends only on
// where a field lies, so every realm (and every saved one) has them in the same places.

import { fractalNoise } from './rng';

export type Region = 'heartland' | 'volcanic' | 'winter' | 'desert' | 'jungle';

/** The far west of every realm is a volcanic waste: ash plains, lava lakes and smoking peaks. */
export function isVolcanic(x: number, y: number, size: number): boolean {
  const edge = size * 0.22 + (fractalNoise(0, y, 613, 9) - 0.5) * size * 0.1 + (fractalNoise(x, y, 719, 4) - 0.5) * 3;
  return x < edge;
}

/** The northern frontier of every realm lies under snow. */
export function isWinter(x: number, y: number, size: number): boolean {
  if (isVolcanic(x, y, size)) return false;
  const edge = size * 0.28 + (fractalNoise(x, 0, 911, 9) - 0.5) * size * 0.12 + (fractalNoise(x, y, 377, 4) - 0.5) * 3;
  return y < edge;
}

/** The far east of every realm is desert: dunes, dry wadis, rare oases and red mesas. */
export function isDesert(x: number, y: number, size: number): boolean {
  if (isVolcanic(x, y, size) || isWinter(x, y, size)) return false;
  const edge = size * 0.76 + (fractalNoise(0, y, 827, 9) - 0.5) * size * 0.1 + (fractalNoise(x, y, 541, 4) - 0.5) * 3;
  return x > edge;
}

/** The south of every realm is jungle: steaming green, vines, rivers and ruined temples. */
export function isJungle(x: number, y: number, size: number): boolean {
  if (isVolcanic(x, y, size) || isWinter(x, y, size) || isDesert(x, y, size)) return false;
  const edge = size * 0.73 + (fractalNoise(x, 0, 1291, 9) - 0.5) * size * 0.12 + (fractalNoise(x, y, 463, 4) - 0.5) * 3;
  return y > edge;
}

export function regionAt(x: number, y: number, size: number): Region {
  if (isVolcanic(x, y, size)) return 'volcanic';
  if (isWinter(x, y, size)) return 'winter';
  if (isDesert(x, y, size)) return 'desert';
  if (isJungle(x, y, size)) return 'jungle';
  return 'heartland';
}

/** How a region is named in the game's text ("… villages in the frozen north"). */
export const REGION_NAMES: Record<Region, string> = {
  heartland: 'the heartland',
  volcanic: 'the volcanic west',
  winter: 'the frozen north',
  desert: 'the eastern desert',
  jungle: 'the southern jungle',
};
