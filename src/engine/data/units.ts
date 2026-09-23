import type { BuildingId, RecruitBuilding, Res, UnitId } from '../types';

export type UnitClass = 'inf' | 'cav' | 'arc';

export interface UnitDef {
  id: UnitId;
  name: string;
  plural: string;
  description: string;
  cost: Res;
  pop: number;
  attack: number;
  /** defense vs infantry, cavalry, archers */
  def: [number, number, number];
  /** minutes per field at unit speed 1 */
  speed: number;
  carry: number;
  /** seconds at world speed 1, building level 0 */
  time: number;
  cls: UnitClass;
  building: RecruitBuilding | null;
  /** building level needed to recruit */
  req: Partial<Record<BuildingId, number>>;
  /** needs a smithy research before it can be recruited */
  research: boolean;
  /** smithy level needed for research level 1 */
  smithy: number;
}

const r = (w: number, c: number, i: number): Res => ({ wood: w, clay: c, iron: i });

export const UNITS: Record<UnitId, UnitDef> = {
  spear: {
    id: 'spear', name: 'Spearman', plural: 'Spearmen',
    description: 'Cheap, sturdy defender. Excellent against cavalry.',
    cost: r(50, 30, 10), pop: 1, attack: 10, def: [15, 45, 20], speed: 18, carry: 25, time: 1020,
    cls: 'inf', building: 'barracks', req: { barracks: 1 }, research: false, smithy: 1,
  },
  sword: {
    id: 'sword', name: 'Swordsman', plural: 'Swordsmen',
    description: 'Heavily armored defender, the bane of infantry. Slow on the march.',
    cost: r(30, 30, 70), pop: 1, attack: 25, def: [50, 15, 40], speed: 22, carry: 15, time: 1500,
    cls: 'inf', building: 'barracks', req: { barracks: 1 }, research: true, smithy: 1,
  },
  axe: {
    id: 'axe', name: 'Axeman', plural: 'Axemen',
    description: 'Ferocious attacker. The backbone of any infantry offensive.',
    cost: r(60, 30, 40), pop: 1, attack: 40, def: [10, 5, 10], speed: 18, carry: 10, time: 1320,
    cls: 'inf', building: 'barracks', req: { barracks: 2 }, research: true, smithy: 2,
  },
  archer: {
    id: 'archer', name: 'Archer', plural: 'Archers',
    description: 'Behind a wall, archers are deadly against infantry and cavalry alike.',
    cost: r(100, 30, 60), pop: 1, attack: 15, def: [50, 40, 5], speed: 18, carry: 10, time: 1800,
    cls: 'arc', building: 'barracks', req: { barracks: 5 }, research: true, smithy: 5,
  },
  scout: {
    id: 'scout', name: 'Scout', plural: 'Scouts',
    description: 'Fast riders that spy on resources, buildings and troops.',
    cost: r(50, 50, 20), pop: 2, attack: 0, def: [2, 1, 2], speed: 9, carry: 0, time: 900,
    cls: 'cav', building: 'stable', req: { stable: 1 }, research: true, smithy: 1,
  },
  light: {
    id: 'light', name: 'Light Cavalry', plural: 'Light Cavalry',
    description: 'Fast raiders with big saddlebags. The king of farming.',
    cost: r(125, 100, 250), pop: 4, attack: 130, def: [30, 40, 30], speed: 10, carry: 80, time: 1800,
    cls: 'cav', building: 'stable', req: { stable: 3 }, research: true, smithy: 3,
  },
  marcher: {
    id: 'marcher', name: 'Mounted Archer', plural: 'Mounted Archers',
    description: 'Fast attackers that pick apart defenders who rely on the wall.',
    cost: r(250, 100, 150), pop: 5, attack: 120, def: [40, 30, 50], speed: 10, carry: 50, time: 2700,
    cls: 'arc', building: 'stable', req: { stable: 5 }, research: true, smithy: 5,
  },
  heavy: {
    id: 'heavy', name: 'Heavy Cavalry', plural: 'Heavy Cavalry',
    description: 'Elite armored knights, strong in attack and defense.',
    cost: r(200, 150, 600), pop: 6, attack: 150, def: [200, 80, 180], speed: 11, carry: 50, time: 3600,
    cls: 'cav', building: 'stable', req: { stable: 10 }, research: true, smithy: 15,
  },
  ram: {
    id: 'ram', name: 'Ram', plural: 'Rams',
    description: 'Batters down enemy walls during an attack.',
    cost: r(300, 200, 200), pop: 5, attack: 2, def: [20, 50, 20], speed: 30, carry: 0, time: 4800,
    cls: 'inf', building: 'workshop', req: { workshop: 1 }, research: true, smithy: 5,
  },
  catapult: {
    id: 'catapult', name: 'Catapult', plural: 'Catapults',
    description: 'Hurls stones at a building of your choice.',
    cost: r(320, 400, 100), pop: 8, attack: 100, def: [100, 50, 100], speed: 30, carry: 0, time: 7200,
    cls: 'inf', building: 'workshop', req: { workshop: 2 }, research: true, smithy: 12,
  },
  paladin: {
    id: 'paladin', name: 'Paladin', plural: 'Paladin',
    description: 'Your champion. Strong, fast, and carries a legendary weapon.',
    cost: r(20, 20, 40), pop: 10, attack: 150, def: [250, 400, 150], speed: 10, carry: 100, time: 21600,
    cls: 'cav', building: 'statue', req: { statue: 1 }, research: false, smithy: 0,
  },
  noble: {
    id: 'noble', name: 'Nobleman', plural: 'Noblemen',
    description: 'Lowers the loyalty of a village. At zero loyalty the village is yours.',
    cost: r(40000, 50000, 50000), pop: 100, attack: 30, def: [100, 50, 100], speed: 35, carry: 0, time: 18000,
    cls: 'inf', building: 'academy', req: { academy: 1 }, research: false, smithy: 0,
  },
  militia: {
    id: 'militia', name: 'Militia', plural: 'Militia',
    description: 'Farmers who take up arms to defend their home.',
    cost: r(0, 0, 0), pop: 0, attack: 0, def: [15, 45, 25], speed: 18, carry: 0, time: 0,
    cls: 'inf', building: null, req: {}, research: false, smithy: 0,
  },
};

export const UNIT_ORDER: UnitId[] = [
  'spear', 'sword', 'axe', 'archer', 'scout', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'paladin', 'noble',
];

export const ARMY_ORDER: UnitId[] = [...UNIT_ORDER, 'militia'];

export const MERCHANT_SPEED = 6; // minutes per field
export const MERCHANT_CARRY = 1000;

/** Research level bonuses (attack & defense multipliers). */
export const TECH_BONUS = [0, 0, 0.05, 0.1];
export const TECH_MAX = 3;

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  unit?: UnitId;
  att?: number;
  def?: number;
  special?: 'ramx2' | 'catx2' | 'scout' | 'loyalty' | 'speed' | 'loot';
}

export const ITEMS: ItemDef[] = [
  { id: 'pike', name: 'Ironwood Pike', description: 'Spearmen fight 25% harder in attack and defense.', unit: 'spear', att: 0.25, def: 0.25 },
  { id: 'oathblade', name: 'Oathsworn Blade', description: 'Swordsmen fight 25% harder in attack and defense.', unit: 'sword', att: 0.25, def: 0.25 },
  { id: 'bloodaxe', name: 'Bloodaxe', description: 'Axemen attack with 30% more strength.', unit: 'axe', att: 0.3, def: 0.1 },
  { id: 'yewbow', name: 'Bow of the Old Yew', description: 'Archers fight 25% harder in attack and defense.', unit: 'archer', att: 0.25, def: 0.25 },
  { id: 'owleye', name: "Owl's Eye Lens", description: 'Scouts are twice as effective and see everything.', unit: 'scout', special: 'scout' },
  { id: 'spurs', name: 'Windrunner Spurs', description: 'Light cavalry attack with 30% more strength.', unit: 'light', att: 0.3, def: 0.1 },
  { id: 'stormbow', name: 'Stormbow', description: 'Mounted archers attack with 30% more strength.', unit: 'marcher', att: 0.3, def: 0.1 },
  { id: 'aegis', name: 'Aegis of Dawn', description: 'Heavy cavalry fight 25% harder in attack and defense.', unit: 'heavy', att: 0.25, def: 0.25 },
  { id: 'siegecodex', name: 'Siege Codex', description: 'Rams destroy walls twice as fast.', unit: 'ram', special: 'ramx2' },
  { id: 'firebrand', name: 'Firebrand Manual', description: 'Catapults deal double building damage.', unit: 'catapult', special: 'catx2' },
  { id: 'sceptre', name: 'Crown Sceptre', description: 'Noblemen lower loyalty by 10 extra points.', unit: 'noble', special: 'loyalty' },
  { id: 'banner', name: 'Banner of the March', description: 'The army the paladin leads marches 15% faster.', special: 'speed' },
  { id: 'saddlebags', name: 'Bottomless Saddlebags', description: 'The army the paladin leads carries 20% more loot.', special: 'loot' },
];

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
