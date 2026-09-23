import type { BuildingId, Res } from '../types';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  short: string;
  description: string;
  max: number;
  min: number;
  cost: Res;
  factor: Res;
  pop: number;
  popFactor: number;
  /** seconds at world speed 1 for level 1 */
  time: number;
  timeFactor: number;
  /** points per level base (grows 1.2x per level) */
  points: number;
  req: Partial<Record<BuildingId, number>>;
}

const f = (w: number, c: number, i: number): Res => ({ wood: w, clay: c, iron: i });

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  main: {
    id: 'main', name: 'Headquarters', short: 'HQ',
    description: 'The seat of your village. Every level makes construction faster, and higher levels unlock new buildings.',
    max: 30, min: 1, cost: f(90, 80, 70), factor: f(1.26, 1.275, 1.26), pop: 5, popFactor: 1.17,
    time: 900, timeFactor: 1.2, points: 1.2, req: {},
  },
  barracks: {
    id: 'barracks', name: 'Barracks', short: 'Barracks',
    description: 'Trains infantry. Higher levels train faster.',
    max: 25, min: 0, cost: f(200, 170, 90), factor: f(1.26, 1.28, 1.26), pop: 7, popFactor: 1.17,
    time: 1800, timeFactor: 1.2, points: 1.5, req: { main: 3 },
  },
  stable: {
    id: 'stable', name: 'Stable', short: 'Stable',
    description: 'Trains scouts and cavalry. Higher levels train faster.',
    max: 20, min: 0, cost: f(270, 240, 260), factor: f(1.26, 1.28, 1.26), pop: 8, popFactor: 1.17,
    time: 6000, timeFactor: 1.2, points: 3, req: { main: 10, barracks: 5, smithy: 5 },
  },
  workshop: {
    id: 'workshop', name: 'Workshop', short: 'Workshop',
    description: 'Builds rams and catapults for sieges.',
    max: 15, min: 0, cost: f(300, 240, 260), factor: f(1.26, 1.28, 1.26), pop: 8, popFactor: 1.17,
    time: 6000, timeFactor: 1.2, points: 5, req: { main: 10, smithy: 10 },
  },
  academy: {
    id: 'academy', name: 'Academy', short: 'Academy',
    description: 'Mints crowns and trains noblemen — the only way to conquer other villages.',
    max: 1, min: 0, cost: f(15000, 25000, 10000), factor: f(2, 2, 2), pop: 80, popFactor: 1.17,
    time: 586800, timeFactor: 1.2, points: 500, req: { main: 20, smithy: 20, market: 10 },
  },
  smithy: {
    id: 'smithy', name: 'Smithy', short: 'Smithy',
    description: 'Researches new unit types and forges better weapons for existing ones.',
    max: 20, min: 0, cost: f(220, 180, 240), factor: f(1.26, 1.275, 1.26), pop: 20, popFactor: 1.17,
    time: 6000, timeFactor: 1.2, points: 2.5, req: { main: 5, barracks: 1 },
  },
  rally: {
    id: 'rally', name: 'Rally Point', short: 'Rally',
    description: 'Command center for your troops: attack, support, and see every movement.',
    max: 1, min: 0, cost: f(10, 40, 30), factor: f(1, 1, 1), pop: 0, popFactor: 1,
    time: 10860, timeFactor: 1.2, points: 5, req: {},
  },
  statue: {
    id: 'statue', name: 'Statue', short: 'Statue',
    description: 'Honors your paladin — a powerful hero who finds legendary weapons for your army.',
    max: 1, min: 0, cost: f(220, 220, 220), factor: f(1, 1, 1), pop: 10, popFactor: 1,
    time: 1500, timeFactor: 1.2, points: 25, req: {},
  },
  market: {
    id: 'market', name: 'Market', short: 'Market',
    description: 'Merchants carry resources between villages. Also hosts the trading post.',
    max: 25, min: 0, cost: f(100, 100, 100), factor: f(1.26, 1.275, 1.26), pop: 20, popFactor: 1.17,
    time: 2700, timeFactor: 1.2, points: 1.2, req: { main: 3, warehouse: 2 },
  },
  timber: {
    id: 'timber', name: 'Timber Camp', short: 'Timber',
    description: 'Woodcutters fell trees in the forests around your village.',
    max: 30, min: 0, cost: f(50, 60, 40), factor: f(1.25, 1.275, 1.245), pop: 5, popFactor: 1.155,
    time: 900, timeFactor: 1.2, points: 1, req: {},
  },
  claypit: {
    id: 'claypit', name: 'Clay Pit', short: 'Clay',
    description: 'Workers dig clay for bricks and fortifications.',
    max: 30, min: 0, cost: f(65, 50, 40), factor: f(1.27, 1.265, 1.24), pop: 10, popFactor: 1.14,
    time: 900, timeFactor: 1.2, points: 1, req: {},
  },
  ironmine: {
    id: 'ironmine', name: 'Iron Mine', short: 'Iron',
    description: 'Miners dig the ore that becomes weapons and armor.',
    max: 30, min: 0, cost: f(75, 65, 70), factor: f(1.252, 1.275, 1.24), pop: 10, popFactor: 1.17,
    time: 1080, timeFactor: 1.2, points: 1, req: {},
  },
  farm: {
    id: 'farm', name: 'Farm', short: 'Farm',
    description: 'Feeds your workers and soldiers. Each level raises the population limit.',
    max: 30, min: 1, cost: f(45, 40, 30), factor: f(1.3, 1.32, 1.29), pop: 0, popFactor: 1,
    time: 1200, timeFactor: 1.2, points: 0.9, req: {},
  },
  warehouse: {
    id: 'warehouse', name: 'Warehouse', short: 'Storage',
    description: 'Stores your resources. Anything beyond capacity is lost.',
    max: 30, min: 1, cost: f(60, 50, 40), factor: f(1.265, 1.27, 1.245), pop: 0, popFactor: 1,
    time: 1020, timeFactor: 1.2, points: 0.9, req: {},
  },
  hiding: {
    id: 'hiding', name: 'Hiding Place', short: 'Hideout',
    description: 'Resources hidden here cannot be plundered by raiders.',
    max: 10, min: 0, cost: f(50, 60, 50), factor: f(1.25, 1.25, 1.25), pop: 2, popFactor: 1.17,
    time: 1800, timeFactor: 1.2, points: 3, req: {},
  },
  wall: {
    id: 'wall', name: 'Wall', short: 'Wall',
    description: 'Every level strengthens all defenders and adds basic defense of its own.',
    max: 20, min: 0, cost: f(50, 100, 20), factor: f(1.26, 1.275, 1.26), pop: 5, popFactor: 1.17,
    time: 3600, timeFactor: 1.2, points: 3, req: { barracks: 1 },
  },
  watchtower: {
    id: 'watchtower', name: 'Watchtower', short: 'Tower',
    description: 'Lookouts identify the troops in incoming attacks while they are still on the road.',
    max: 20, min: 0, cost: f(600, 700, 500), factor: f(1.17, 1.17, 1.18), pop: 50, popFactor: 1.17,
    time: 5000, timeFactor: 1.2, points: 4, req: { main: 5, farm: 5 },
  },
};

export const BUILDING_ORDER: BuildingId[] = [
  'main', 'barracks', 'stable', 'workshop', 'academy', 'smithy', 'rally', 'statue', 'market',
  'timber', 'claypit', 'ironmine', 'farm', 'warehouse', 'hiding', 'wall', 'watchtower',
];

export const RESOURCE_BUILDING = { wood: 'timber', clay: 'claypit', iron: 'ironmine' } as const;
