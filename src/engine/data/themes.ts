// Each statue hero gives its village a look, and its army the matching troops:
// goblin camps raise goblin stabbers and wolf riders, sorcerer towers raise
// spellguards and storm riders, druid groves raise thornguards and stag riders,
// and a paladin's citadel of the Radiant Order raises pikemen, lancers and knights.
// They are the same units underneath (same costs, stats and rules), so a village's
// whole army simply takes the new form when its first hero is trained.

import type { UnitId } from '../types';
import { UNITS } from './units';

export type VillageTheme = 'classic' | 'paladin' | 'sorcerer' | 'druid' | 'goblin' | 'necromancer' | 'orc' | 'frost' | 'dwarf' | 'djinn' | 'saurian';

export function themeOfHero(hero: UnitId | null | undefined): VillageTheme {
  return hero === 'paladin' || hero === 'sorcerer' || hero === 'druid' || hero === 'goblin' || hero === 'necromancer' || hero === 'orc'
    || hero === 'frost' || hero === 'dwarf' || hero === 'djinn' || hero === 'saurian' ? hero : 'classic';
}

type Names = Partial<Record<UnitId, [name: string, plural: string]>>;

export const THEMED_UNITS: Record<Exclude<VillageTheme, 'classic'>, Names> = {
  paladin: {
    spear: ['Pikeman', 'Pikemen'],
    sword: ['Man-at-Arms', 'Men-at-Arms'],
    axe: ['Crusader', 'Crusaders'],
    archer: ['Longbowman', 'Longbowmen'],
    scout: ['Outrider', 'Outriders'],
    light: ['Lancer', 'Lancers'],
    marcher: ['Horse Archer', 'Horse Archers'],
    heavy: ['Knight', 'Knights'],
    ram: ['Siege Ram', 'Siege Rams'],
    catapult: ['Trebuchet', 'Trebuchets'],
    noble: ['Lord', 'Lords'],
    trader: ['Royal Quartermaster', 'Royal Quartermasters'],
    militia: ['Yeomanry', 'Yeomanry'],
  },
  goblin: {
    spear: ['Goblin Stabber', 'Goblin Stabbers'],
    sword: ['Goblin Cutthroat', 'Goblin Cutthroats'],
    axe: ['Goblin Chopper', 'Goblin Choppers'],
    archer: ['Goblin Sniper', 'Goblin Snipers'],
    scout: ['Goblin Sneak', 'Goblin Sneaks'],
    light: ['Wolf Rider', 'Wolf Riders'],
    marcher: ['Wolf Archer', 'Wolf Archers'],
    heavy: ['Boar Knight', 'Boar Knights'],
    ram: ['Log Basher', 'Log Bashers'],
    catapult: ['Junk Flinger', 'Junk Flingers'],
    noble: ['Goblin Boss', 'Goblin Bosses'],
    trader: ['Loot Hauler', 'Loot Haulers'],
    militia: ['Goblin Rabble', 'Goblin Rabble'],
  },
  sorcerer: {
    spear: ['Spellguard', 'Spellguards'],
    sword: ['Runeblade', 'Runeblades'],
    axe: ['Warmage', 'Warmages'],
    archer: ['Arcane Archer', 'Arcane Archers'],
    scout: ['Owl Familiar', 'Owl Familiars'],
    light: ['Storm Rider', 'Storm Riders'],
    marcher: ['Spell Rider', 'Spell Riders'],
    heavy: ['Crystal Knight', 'Crystal Knights'],
    ram: ['Arcane Ram', 'Arcane Rams'],
    catapult: ['Orb Thrower', 'Orb Throwers'],
    noble: ['Archmage Envoy', 'Archmage Envoys'],
    trader: ['Spellbound Wagon', 'Spellbound Wagons'],
    militia: ['Apprentice Levy', 'Apprentice Levy'],
  },
  druid: {
    spear: ['Thornguard', 'Thornguards'],
    sword: ['Grove Warden', 'Grove Wardens'],
    axe: ['Wildling', 'Wildlings'],
    archer: ['Ranger', 'Rangers'],
    scout: ['Spirit Hawk', 'Spirit Hawks'],
    light: ['Stag Rider', 'Stag Riders'],
    marcher: ['Stag Archer', 'Stag Archers'],
    heavy: ['Bear Rider', 'Bear Riders'],
    ram: ['Treant Ram', 'Treant Rams'],
    catapult: ['Boulder Treant', 'Boulder Treants'],
    noble: ['Elder', 'Elders'],
    trader: ['Stag Courier', 'Stag Couriers'],
    militia: ['Grove Folk', 'Grove Folk'],
  },
  // the clans: green-skinned grunts in crude iron, wargs and war boars for horses
  // the Frost Queen's court of the north: ice and fur, wolves, owls and mammoths
  frost: {
    spear: ['Ice Warden', 'Ice Wardens'],
    sword: ['Frostguard', 'Frostguards'],
    axe: ['Rime Reaver', 'Rime Reavers'],
    archer: ['Frost Archer', 'Frost Archers'],
    scout: ['Snow Owl', 'Snow Owls'],
    light: ['Snow-Wolf Rider', 'Snow-Wolf Riders'],
    marcher: ['Sleigh Archer', 'Sleigh Archers'],
    heavy: ['Mammoth Rider', 'Mammoth Riders'],
    ram: ['Ice Ram', 'Ice Rams'],
    catapult: ['Frost Trebuchet', 'Frost Trebuchets'],
    noble: ['Ice Herald', 'Ice Heralds'],
    trader: ['Reindeer Sledge', 'Reindeer Sledges'],
    militia: ['Hearth Guard', 'Hearth Guard'],
  },
  // the Forgelord's dwarves of the burning mountain: shields, runes, goats and steam
  dwarf: {
    spear: ['Shieldbearer', 'Shieldbearers'],
    sword: ['Ironbreaker', 'Ironbreakers'],
    axe: ['Longbeard', 'Longbeards'],
    archer: ['Quarreller', 'Quarrellers'],
    scout: ['Tunnel Scout', 'Tunnel Scouts'],
    light: ['Goat Rider', 'Goat Riders'],
    marcher: ['Goat Crossbow', 'Goat Crossbows'],
    heavy: ['Anvil Knight', 'Anvil Knights'],
    ram: ['Steam Drill', 'Steam Drills'],
    catapult: ['Flame Ballista', 'Flame Ballistae'],
    noble: ['Thane', 'Thanes'],
    trader: ['Mine Cart', 'Mine Carts'],
    militia: ['Miners', 'Miners'],
  },
  // the Djinn's desert host: blades, camels, falcons and brass
  djinn: {
    spear: ['Sand Guard', 'Sand Guards'],
    sword: ['Blade Dancer', 'Blade Dancers'],
    axe: ['Dune Raider', 'Dune Raiders'],
    archer: ['Desert Archer', 'Desert Archers'],
    scout: ['Desert Falcon', 'Desert Falcons'],
    light: ['Camel Rider', 'Camel Riders'],
    marcher: ['Camel Archer', 'Camel Archers'],
    heavy: ['Sun Lancer', 'Sun Lancers'],
    ram: ['Brass Ram', 'Brass Rams'],
    catapult: ['Sun Engine', 'Sun Engines'],
    noble: ['Vizier', 'Viziers'],
    trader: ['Camel Caravan', 'Camel Caravans'],
    militia: ['Oasis Watch', 'Oasis Watch'],
  },
  // the Saurian King's cold-blooded host: skinks, saurus and raptors, horned beasts
  saurian: {
    spear: ['Skink Spear', 'Skink Spears'],
    sword: ['Saurus Guard', 'Saurus Guards'],
    axe: ['Saurus Warrior', 'Saurus Warriors'],
    archer: ['Blowpiper', 'Blowpipers'],
    scout: ['Chameleon', 'Chameleons'],
    light: ['Raptor Rider', 'Raptor Riders'],
    marcher: ['Raptor Archer', 'Raptor Archers'],
    heavy: ['Horned Rider', 'Horned Riders'],
    ram: ['Bonehead', 'Boneheads'],
    catapult: ['Temple Slinger', 'Temple Slingers'],
    noble: ['Sun Priest', 'Sun Priests'],
    trader: ['Pack Lizard', 'Pack Lizards'],
    militia: ['Jungle Folk', 'Jungle Folk'],
  },
  orc: {
    spear: ['Spear Grunt', 'Spear Grunts'],
    sword: ['Cleaver', 'Cleavers'],
    axe: ['Berserker', 'Berserkers'],
    archer: ['Bow Orc', 'Bow Orcs'],
    scout: ['Warg Scout', 'Warg Scouts'],
    light: ['Warg Rider', 'Warg Riders'],
    marcher: ['Warg Archer', 'Warg Archers'],
    heavy: ['Boar Rider', 'Boar Riders'],
    ram: ['Battering Tusk', 'Battering Tusks'],
    catapult: ['Rock Hurler', 'Rock Hurlers'],
    noble: ['Warchief', 'Warchiefs'],
    trader: ['Pack Boar', 'Pack Boars'],
    militia: ['Clan Rabble', 'Clan Rabble'],
  },
  // the paladin's army, dug back up: skeletons in rusted mail, bats for eyes, bone horses
  necromancer: {
    spear: ['Skeleton Spearman', 'Skeleton Spearmen'],
    sword: ['Bone Swordsman', 'Bone Swordsmen'],
    axe: ['Grave Reaver', 'Grave Reavers'],
    archer: ['Skeleton Archer', 'Skeleton Archers'],
    scout: ['Bat Swarm', 'Bat Swarms'],
    light: ['Bone Rider', 'Bone Riders'],
    marcher: ['Wraith Archer', 'Wraith Archers'],
    heavy: ['Death Knight', 'Death Knights'],
    ram: ['Bone Ram', 'Bone Rams'],
    catapult: ['Skull Catapult', 'Skull Catapults'],
    noble: ['Lich Lord', 'Lich Lords'],
    trader: ['Bone Cart', 'Bone Carts'],
    militia: ['Risen Dead', 'Risen Dead'],
  },
};

/** A unit's name as a village of this theme calls it; heroes keep their own names. */
export function themedUnitName(u: UnitId, theme: VillageTheme, plural: boolean, fallback: [string, string]): string {
  if (theme === 'classic') return plural ? fallback[1] : fallback[0];
  const n = THEMED_UNITS[theme][u];
  return n ? (plural ? n[1] : n[0]) : plural ? fallback[1] : fallback[0];
}

/** A unit's name as this village calls it. */
export function unitNameAt(v: { heroKind?: UnitId }, u: UnitId, plural = false): string {
  return themedUnitName(u, themeOfHero(v.heroKind), plural, [UNITS[u].name, UNITS[u].plural]);
}
