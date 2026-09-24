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
    description: 'Your champion. His touch gets the fallen back on their feet, and his charge breaks cavalry.',
    cost: r(20, 20, 40), pop: 10, attack: 150, def: [250, 400, 150], speed: 10, carry: 100, time: 21600,
    cls: 'cav', building: 'statue', req: { statue: 1 }, research: false, smithy: 0,
  },
  sorcerer: {
    id: 'sorcerer', name: 'Sorcerer', plural: 'Sorcerers',
    description: 'A hero of the statue. Arcane fire tears through massed footmen, and a shimmering barrier shields the village he guards.',
    cost: r(40, 60, 40), pop: 10, attack: 200, def: [200, 200, 300], speed: 12, carry: 0, time: 21600,
    cls: 'arc', building: 'statue', req: { statue: 1 }, research: false, smithy: 0,
  },
  druid: {
    id: 'druid', name: 'Druid', plural: 'Druids',
    description: 'A hero of the statue. Thorns climb the walls he guards, and the old paths of the forest carry his allies swiftly.',
    cost: r(60, 40, 20), pop: 10, attack: 100, def: [300, 250, 300], speed: 12, carry: 50, time: 21600,
    cls: 'inf', building: 'statue', req: { statue: 1 }, research: false, smithy: 0,
  },
  goblin: {
    id: 'goblin', name: 'Goblin Chief', plural: 'Goblin Chiefs',
    description: 'A hero of the statue. Quick, greedy and sly: over the wall and away with every sack he can carry.',
    cost: r(30, 30, 30), pop: 10, attack: 120, def: [120, 120, 80], speed: 8, carry: 300, time: 21600,
    cls: 'inf', building: 'statue', req: { statue: 1 }, research: false, smithy: 0,
  },
  necromancer: {
    id: 'necromancer', name: 'Necromancer', plural: 'Necromancers',
    description: 'A hero of the statue. Death answers his call: the fallen rise again to fight for him.',
    cost: r(50, 40, 50), pop: 10, attack: 150, def: [200, 150, 200], speed: 12, carry: 0, time: 21600,
    cls: 'inf', building: 'statue', req: { statue: 1 }, research: false, smithy: 0,
  },
  orc: {
    id: 'orc', name: 'Orc King', plural: 'Orc Kings',
    description: 'A hero of the statue. The warlord of the clans: his warcry sends rams and rock-hurlers crashing through walls, and his warband eats and grows where he rules.',
    cost: r(50, 40, 40), pop: 10, attack: 180, def: [220, 180, 150], speed: 11, carry: 60, time: 21600,
    cls: 'inf', building: 'statue', req: { statue: 1 }, research: false, smithy: 0,
  },
  noble: {
    id: 'noble', name: 'Nobleman', plural: 'Noblemen',
    description: 'Lowers the loyalty of a village. At zero loyalty the village is yours.',
    cost: r(40000, 50000, 50000), pop: 100, attack: 30, def: [100, 50, 100], speed: 35, carry: 0, time: 18000,
    cls: 'inf', building: 'academy', req: { academy: 1 }, research: false, smithy: 0,
  },
  trader: {
    id: 'trader', name: 'Horse Merchant', plural: 'Horse Merchants',
    description: 'A merchant with a string of horses: carries 20,000 resources and travels five times as fast as a merchant on foot, but he and his horses eat like a hundred men. He trades, never fights.',
    cost: r(10000, 10000, 10000), pop: 100, attack: 0, def: [0, 0, 0], speed: 0, carry: 20000, time: 7200,
    cls: 'cav', building: 'market', req: { market: 5 }, research: false, smithy: 0,
  },
  militia: {
    id: 'militia', name: 'Militia', plural: 'Militia',
    description: 'Farmers who take up arms to defend their home.',
    cost: r(0, 0, 0), pop: 0, attack: 0, def: [15, 45, 25], speed: 18, carry: 0, time: 0,
    cls: 'inf', building: null, req: {}, research: false, smithy: 0,
  },
};

export const UNIT_ORDER: UnitId[] = [
  'spear', 'sword', 'axe', 'archer', 'scout', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'paladin', 'sorcerer', 'druid', 'goblin', 'necromancer', 'orc', 'noble',
];

/** Heroes of the statue: each village may keep one. */
export const HEROES: UnitId[] = ['paladin', 'sorcerer', 'druid', 'goblin', 'necromancer', 'orc'];
export const isHero = (u: UnitId) => HEROES.includes(u);

export interface HeroInfo {
  /** the kind of troops this hero is strong against (+25% strength, scaled by how much of the enemy is that kind) */
  vs?: UnitClass;
  /** how much stronger (defaults to HERO_VS_BONUS) */
  vsBonus?: number;
  /** that strength only counts when the hero attacks */
  vsAttackOnly?: boolean;
  vsLabel: string;
  /** the hero's signature ability, in a few words */
  ability: string;
  perks: string[];
}

/** What each hero's abilities do in battle (tuned with scripts/herobench.ts). */
export const HERO_POWERS = {
  /** the paladin heals this share of his side's fallen after a battle */
  layOnHands: 0.08,
  /** a defending sorcerer's barrier */
  barrier: 0.1,
  /** a defending druid's thorn hedge counts as this many extra wall levels */
  thornwall: 4,
  /** an attacking goblin chief's army slips over this many wall levels */
  sneak: 4,
  /** the goblin chief's army carries this much more loot */
  plunder: 0.4,
  /** the necromancer's dread weakens the enemy's infantry by this much */
  dread: 0.14,
  /** the necromancer raises this share of the enemy's fallen foot soldiers */
  raise: 0.1,
  /** the Orc King's warcry: rams and catapults in the army he leads strike this much harder */
  warcry: 0.5,
  /** the Orc King's bloodlust: every attacker in the army he leads fights this much harder */
  bloodlust: 0.1,
  /** the horde: a village sworn to the Orc King feeds this much more population */
  horde: 0.1,
};

export const HERO_VS_BONUS = 0.25;

export const HERO_INFO: Record<string, HeroInfo> = {
  paladin: {
    vs: 'cav', vsBonus: 0.15, vsLabel: 'Cavalry', ability: 'Lay on Hands',
    perks: ['Lay on Hands: after every battle he fights, 8% of his side\'s fallen troops are healed and fight on', 'Knight\'s charge: +15% strength against cavalry'],
  },
  sorcerer: {
    vs: 'inf', vsBonus: 0.2, vsAttackOnly: true, vsLabel: 'Infantry', ability: 'Arcane Barrier',
    perks: ['Arcane barrier: while he defends, every defender in the village fights 10% harder', 'Arcane fire: +20% strength against infantry when he attacks'],
  },
  druid: {
    vsLabel: 'Holding the wall', ability: 'Thornwall',
    perks: ['Thornwall: defending, a hedge of thorns makes the wall count 4 levels higher', 'Swift paths: support he marches with arrives 25% faster'],
  },
  goblin: {
    vsLabel: 'Raiding', ability: 'Sneak In',
    perks: ['Sneak in: attacking, his goblins slip over 4 levels of the enemy wall', 'Plunder: the army he leads carries 40% more loot'],
  },
  orc: {
    vs: 'arc', vsBonus: 0.2, vsLabel: 'Archers', ability: 'Warcry',
    perks: ['Warcry: rams and rock-hurlers in the army he leads strike 50% harder at walls and buildings', 'Bloodlust: every attacker in the warband he leads fights 10% harder', 'The Horde: a village sworn to him feeds 10% more population', 'Beastbane: +20% strength against archers'],
  },
  necromancer: {
    vsLabel: 'Infantry and the fallen', ability: 'Dread',
    perks: ['Dread: enemy infantry fights 14% weaker against him, in attack and defense', 'Raise the dead: when his side wins, one in ten enemy foot soldiers who fell rise as skeleton spearmen in his army'],
  },
};

export const ARMY_ORDER: UnitId[] = [...UNIT_ORDER, 'militia'];

export const MERCHANT_SPEED = 12; // minutes per field
/** Shipments between two of your own villages crawl at this share of merchant speed. */
export const OWN_SHIPMENT_SPEED = 0.15;
export const MERCHANT_CARRY = 1000;
/** A horse merchant: what he carries, and how much faster than a merchant on foot he travels. */
export const TRADER_CARRY = 20000;
export const TRADER_SPEEDUP = 5;

/** Research level bonuses (attack & defense multipliers). */
export const TECH_BONUS = [0, 0, 0.05, 0.1];
export const TECH_MAX = 3;

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  /** the hero who finds and carries it (the paladin, unless said otherwise) */
  hero?: UnitId;
  unit?: UnitId;
  att?: number;
  def?: number;
  special?: 'ramx2' | 'catx2' | 'scout' | 'loyalty' | 'speed' | 'loot' | 'ward' | 'raise';
}

/**
 * How strong legendary items are. They are a nice edge, never a decider: every
 * effect stays under a 10% swing.
 */
export const ITEM_POWERS = {
  /** troop items that help in attack and defense */
  troop: 0.08,
  /** troop items made for attack: more attack, a little defense */
  assault: 0.09,
  assaultDef: 0.03,
  /** scouts fight this much harder (scout losses follow strength^1.5, so this stays small) */
  scout: 0.06,
  /** rams and catapults hit this much harder */
  siege: 0.05,
  /** extra loyalty each nobleman takes (a drop is 20-35, so 4-7.5%) */
  loyalty: 1.5,
  /** the army marches this much faster */
  speed: 0.06,
  /** the army carries this much more loot */
  loot: 0.08,
  /** every defender fights this much harder */
  ward: 0.05,
  /** this much more of the fallen rise */
  raise: 0.08,
};
const T = ITEM_POWERS.troop, AA = ITEM_POWERS.assault, AD = ITEM_POWERS.assaultDef;

export const ITEMS: ItemDef[] = [
  { id: 'pike', name: 'Ironwood Pike', description: 'Spearmen fight 8% harder in attack and defense.', unit: 'spear', att: T, def: T },
  { id: 'oathblade', name: 'Oathsworn Blade', description: 'Swordsmen fight 8% harder in attack and defense.', unit: 'sword', att: T, def: T },
  { id: 'bloodaxe', name: 'Bloodaxe', description: 'Axemen attack with 9% more strength (and defend 3% better).', unit: 'axe', att: AA, def: AD },
  { id: 'yewbow', name: 'Bow of the Old Yew', description: 'Archers fight 8% harder in attack and defense.', unit: 'archer', att: T, def: T },
  { id: 'owleye', name: "Owl's Eye Lens", description: 'Scouts fight 6% harder.', unit: 'scout', special: 'scout' },
  { id: 'spurs', name: 'Windrunner Spurs', description: 'Light cavalry attack with 9% more strength (and defend 3% better).', unit: 'light', att: AA, def: AD },
  { id: 'stormbow', name: 'Stormbow', description: 'Mounted archers attack with 9% more strength (and defend 3% better).', unit: 'marcher', att: AA, def: AD },
  { id: 'aegis', name: 'Aegis of Dawn', description: 'Heavy cavalry fight 8% harder in attack and defense.', unit: 'heavy', att: T, def: T },
  { id: 'siegecodex', name: 'Siege Codex', description: 'Rams hit walls 5% harder.', unit: 'ram', special: 'ramx2' },
  { id: 'firebrand', name: 'Firebrand Manual', description: 'Catapults deal 5% more building damage.', unit: 'catapult', special: 'catx2' },
  { id: 'sceptre', name: 'Crown Sceptre', description: 'Noblemen lower loyalty by 1.5 extra points.', unit: 'noble', special: 'loyalty' },
  { id: 'banner', name: 'Banner of the March', description: 'The army the paladin leads marches 6% faster.', special: 'speed' },
  { id: 'saddlebags', name: 'Bottomless Saddlebags', description: 'The army the paladin leads carries 8% more loot.', special: 'loot' },
  // the sorcerer's
  { id: 'wardstaff', hero: 'sorcerer', name: 'Staff of Warding', description: 'Defending, every defender in the village fights 5% harder (on top of the arcane barrier).', special: 'ward' },
  { id: 'stormtome', hero: 'sorcerer', name: 'Tome of Storms', description: 'Storm Riders attack with 9% more strength (and defend 3% better).', unit: 'light', att: AA, def: AD },
  { id: 'spellblade', hero: 'sorcerer', name: 'Spellbound Blade', description: 'Runeblades fight 8% harder in attack and defense.', unit: 'sword', att: T, def: T },
  { id: 'seeingorb', hero: 'sorcerer', name: 'Seeing Orb', description: 'Owl familiars fight 6% harder.', unit: 'scout', special: 'scout' },
  { id: 'grimoire', hero: 'sorcerer', name: 'Grimoire of Ruin', description: 'Orb throwers deal 5% more building damage.', unit: 'catapult', special: 'catx2' },
  { id: 'hourglass', hero: 'sorcerer', name: 'Hourglass of Haste', description: 'The army the sorcerer leads marches 6% faster.', special: 'speed' },
  // the druid's
  { id: 'oakstaff', hero: 'druid', name: 'Staff of the Old Oak', description: 'Thornguards fight 8% harder in attack and defense.', unit: 'spear', att: T, def: T },
  { id: 'heartbow', hero: 'druid', name: 'Heartwood Bow', description: 'Rangers fight 8% harder in attack and defense.', unit: 'archer', att: T, def: T },
  { id: 'bearclaw', hero: 'druid', name: 'Bear-Claw Amulet', description: 'Bear Riders fight 8% harder in attack and defense.', unit: 'heavy', att: T, def: T },
  { id: 'hawkfeather', hero: 'druid', name: 'Hawk-Feather Charm', description: 'Spirit hawks fight 6% harder.', unit: 'scout', special: 'scout' },
  { id: 'thornseed', hero: 'druid', name: 'Thornseed Pouch', description: 'Defending, every defender in the village fights 5% harder behind a hedge of thorns.', special: 'ward' },
  { id: 'rootpath', hero: 'druid', name: 'Rootpath Stone', description: 'The army the druid leads marches 6% faster.', special: 'speed' },
  // the goblin chief's
  { id: 'grabsack', hero: 'goblin', name: "Grabbin' Sack", description: 'The army the goblin chief leads carries 8% more loot.', special: 'loot' },
  { id: 'rustycleaver', hero: 'goblin', name: 'Rusty Cleaver', description: 'Goblin choppers attack with 9% more strength (and defend 3% better).', unit: 'axe', att: AA, def: AD },
  { id: 'wolffang', hero: 'goblin', name: 'Wolf-Fang Necklace', description: 'Wolf riders attack with 9% more strength (and defend 3% better).', unit: 'light', att: AA, def: AD },
  { id: 'sneakglass', hero: 'goblin', name: 'Sneaky Spyglass', description: 'Goblin sneaks fight 6% harder.', unit: 'scout', special: 'scout' },
  { id: 'bossbonnet', hero: 'goblin', name: "Boss's Big Hat", description: 'Goblin bosses lower loyalty by 1.5 extra points.', unit: 'noble', special: 'loyalty' },
  { id: 'boomlog', hero: 'goblin', name: 'Boom-Log', description: 'Log bashers hit walls 5% harder.', unit: 'ram', special: 'ramx2' },
  // the orc king's
  { id: 'clanhorn', hero: 'orc', name: 'War Horn of the Clans', description: 'Battering tusks hit walls 5% harder.', unit: 'ram', special: 'ramx2' },
  // (the paladin already owns 'bloodaxe': every item id must be unique)
  { id: 'gorehewer', hero: 'orc', name: 'Gorehewer', description: 'Berserkers attack with 9% more strength (and defend 3% better).', unit: 'axe', att: AA, def: AD },
  { id: 'wargcollar', hero: 'orc', name: "Warg-Mother's Collar", description: 'Warg riders attack with 9% more strength (and defend 3% better).', unit: 'light', att: AA, def: AD },
  { id: 'boarplate', hero: 'orc', name: 'Boar-Hide Plate', description: 'Boar riders fight 8% harder in attack and defense.', unit: 'heavy', att: T, def: T },
  { id: 'skullcrown', hero: 'orc', name: 'Crown of Tusks', description: 'Warchiefs lower loyalty by 1.5 extra points.', unit: 'noble', special: 'loyalty' },
  { id: 'wardrum', hero: 'orc', name: 'Drum of the Warpath', description: 'Rock-hurlers deal 5% more building damage.', unit: 'catapult', special: 'catx2' },
  // the necromancer's
  { id: 'soullantern', hero: 'necromancer', name: 'Soul Lantern', description: 'More of the fallen rise again after a won battle: 10.8 in 100 instead of 10.', special: 'raise' },
  { id: 'bonescythe', hero: 'necromancer', name: 'Bone Scythe', description: 'Grave reavers attack with 9% more strength (and defend 3% better).', unit: 'axe', att: AA, def: AD },
  { id: 'deathplate', hero: 'necromancer', name: "Death Knight's Plate", description: 'Death knights fight 8% harder in attack and defense.', unit: 'heavy', att: T, def: T },
  { id: 'batwhistle', hero: 'necromancer', name: 'Bat Whistle', description: 'Bat swarms fight 6% harder.', unit: 'scout', special: 'scout' },
  { id: 'phylactery', hero: 'necromancer', name: "Lich's Phylactery", description: 'Lich lords lower loyalty by 1.5 extra points.', unit: 'noble', special: 'loyalty' },
  { id: 'wailingskull', hero: 'necromancer', name: 'Wailing Skull', description: 'Skull catapults deal 5% more building damage.', unit: 'catapult', special: 'catx2' },
];

/** The hero an item belongs to. */
export const itemHero = (i: ItemDef): UnitId => i.hero ?? 'paladin';
export const itemsFor = (hero: UnitId, archers = true): ItemDef[] =>
  ITEMS.filter((i) => itemHero(i) === hero && (archers || (i.unit !== 'archer' && i.unit !== 'marcher')));

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
