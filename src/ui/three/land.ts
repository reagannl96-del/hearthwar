// The land a village stands in, as the 3D village draws it: the four wilds each have
// their own ground, sky and weather; the heartland is autumn.

import { regionAt } from '../../engine/regions';
import type { Season } from './kit';

export function seasonAt(x: number, y: number, size: number): Season {
  const r = regionAt(x, y, size);
  return r === 'winter' ? 'winter' : r === 'volcanic' ? 'volcanic' : r === 'desert' ? 'desert' : r === 'jungle' ? 'jungle' : 'fall';
}
