import type { Report } from '../engine/types';

/** A successful raid report: your attack on a barbarian village that came home without losing anyone. */
export const isSrr = (r: Report) =>
  r.kind === 'attack' && r.color === 'green' && !!r.battle && r.battle.defender.playerId == null && !r.battle.cache;
