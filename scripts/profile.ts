import { advance } from '../src/engine/game';
import { HOUR } from '../src/engine/formulas';
import { createWorld, defaultConfig } from '../src/engine/world';

const w = createWorld({ worldName: 'P', playerName: 'P', villageName: 'P', config: defaultConfig(), seed: 1234 });
advance(w, 12 * HOUR);
const t = performance.now();
advance(w, 14 * HOUR);
console.log('12h->14h', Math.round(performance.now() - t), 'ms', Object.keys(w.villages).length);
