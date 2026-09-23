// Name generators for AI rulers, villages and tribes.

import { pick, type RngHolder } from '../rng';

const FIRST = [
  'Aldric', 'Brynja', 'Cedric', 'Dagny', 'Edmund', 'Freya', 'Gunnar', 'Hilde', 'Ivar', 'Jorunn', 'Kjell',
  'Leofric', 'Maud', 'Njal', 'Osric', 'Petra', 'Ragna', 'Sigurd', 'Thyra', 'Ulf', 'Vigdis', 'Wulfric',
  'Ysolde', 'Eirik', 'Alva', 'Bjorn', 'Castor', 'Drusa', 'Elowen', 'Fenwick', 'Godric', 'Halvard',
  'Ingrid', 'Jarl', 'Kestrel', 'Liv', 'Morwen', 'Orla', 'Percival', 'Rowan', 'Sabine', 'Tamsin', 'Wendel',
];
const EPITHET = [
  'the Bold', 'Ironhand', 'the Grim', 'Stormborn', 'the Red', 'Oakheart', 'the Wise', 'Longstride',
  'the Cruel', 'Ashfall', 'the Patient', 'Wolfsbane', 'the Young', 'Greymantle', 'the Just', 'Blackthorn',
  'Hammerfell', 'the Silent', 'Goldtongue', 'Frostbeard', 'the Fair', 'Ravencrest',
];
const PRE = [
  'Oak', 'Ash', 'Stone', 'Iron', 'Elder', 'Raven', 'Wolf', 'Thorn', 'Mill', 'Brook', 'Frost', 'Hollow',
  'Red', 'Black', 'Gold', 'Moss', 'Fern', 'Hart', 'Wind', 'Salt', 'Birch', 'Barrow', 'Crag', 'Dun', 'Holly',
  'Kings', 'Marsh', 'North', 'Shep', 'Tall', 'Wither', 'Yew', 'Amber', 'Bram', 'Cold', 'Deep', 'Eagle',
];
const SUF = [
  'ford', 'haven', 'wick', 'stead', 'mere', 'hold', 'dale', 'bury', 'crest', 'field', 'gate', 'hollow',
  'moor', 'ridge', 'thorpe', 'ton', 'vale', 'watch', 'wood', 'barrow', 'brook', 'cliff', 'fell', 'garth',
];
const TRIBE_A = ['Iron', 'Crimson', 'Silver', 'Night', 'Storm', 'Ember', 'Frost', 'Golden', 'Shadow', 'Wild', 'Ashen', 'Stone'];
const TRIBE_B = ['Wolves', 'Crowns', 'Oaths', 'Ravens', 'Banners', 'Lances', 'Hounds', 'Covenant', 'Brotherhood', 'Legion', 'Stags', 'Serpents'];

export function rulerName(r: RngHolder): string {
  return `${pick(r, FIRST)} ${pick(r, EPITHET)}`;
}

export function villageName(r: RngHolder): string {
  return pick(r, PRE) + pick(r, SUF);
}

export function tribeName(r: RngHolder): { name: string; tag: string } {
  const a = pick(r, TRIBE_A), b = pick(r, TRIBE_B);
  return { name: `The ${a} ${b}`, tag: (a[0] + b[0] + b[b.length - 1]).toUpperCase() };
}

export const PALADIN_NAMES = ['Sir Aldous', 'Dame Evaine', 'Sir Gawen', 'Dame Isolde', 'Sir Roland', 'Dame Brienne'];

export const PLAYER_COLORS = [
  '#c0392b', '#8e44ad', '#2471a3', '#17a589', '#d35400', '#b7950b', '#7d3c98', '#1f618d',
  '#a93226', '#148f77', '#ca6f1e', '#6c3483', '#2e86c1', '#229954', '#af601a', '#5b2c6f',
  '#cb4335', '#138d75', '#b9770e', '#884ea0', '#2874a6', '#1e8449', '#dc7633', '#7b241c',
];
