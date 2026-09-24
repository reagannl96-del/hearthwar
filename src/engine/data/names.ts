// Name generators for AI rulers, villages and tribes.
//
// Rulers should read like the people on a real server: some take a proper
// medieval name ("Aldric the Bold", "Maren Blackwood", "Sven of Ravenholm",
// "Lady Isolde"), and plenty just pick a handle ("grimwolf", "IronFang88",
// "ash_king"), so the computer rulers blend in with the people.

import { nextRandom, pick, type RngHolder } from '../rng';

const FIRST = [
  // norse
  'Aldric', 'Brynja', 'Dagny', 'Freya', 'Gunnar', 'Hilde', 'Ivar', 'Jorunn', 'Kjell', 'Njal', 'Ragna', 'Sigurd',
  'Thyra', 'Ulf', 'Vigdis', 'Eirik', 'Alva', 'Bjorn', 'Halvard', 'Ingrid', 'Liv', 'Sven', 'Astrid', 'Torvald',
  'Solveig', 'Hakon', 'Runa', 'Leif', 'Sigrun', 'Brand', 'Ylva', 'Orm', 'Gyda', 'Knut', 'Ase', 'Styr',
  // anglo-saxon and english
  'Cedric', 'Edmund', 'Leofric', 'Osric', 'Wulfric', 'Godric', 'Aelfric', 'Edith', 'Maud', 'Wendel', 'Ethel',
  'Hereward', 'Aethel', 'Oswin', 'Mildred', 'Eadgyth', 'Rowan', 'Tamsin', 'Percival', 'Kestrel', 'Fenwick',
  // celtic
  'Morwen', 'Orla', 'Elowen', 'Ysolde', 'Bran', 'Cormac', 'Niamh', 'Aoife', 'Tadhg', 'Eilidh', 'Rhys', 'Gwen',
  'Cai', 'Deirdre', 'Fergus', 'Maelis', 'Cadoc', 'Brigid', 'Ronan', 'Siwan',
  // slavic
  'Mirek', 'Vesna', 'Radoslav', 'Zora', 'Bogdan', 'Milena', 'Stanislav', 'Dragana', 'Vlad', 'Lada', 'Borys',
  'Jarek', 'Miroslava', 'Dobromir', 'Ksenia',
  // frankish, latin and byzantine
  'Castor', 'Drusa', 'Sabine', 'Aurelia', 'Theodric', 'Clovis', 'Adela', 'Baldwin', 'Lucan', 'Octavia',
  'Basil', 'Irene', 'Anselm', 'Matilda', 'Roland', 'Isolde', 'Gisela', 'Alaric', 'Livia', 'Tiberius',
  // moorish and eastern
  'Tariq', 'Zahra', 'Idris', 'Layla', 'Rashid', 'Samira', 'Karim', 'Yasmin', 'Farid', 'Soraya',
];
const EPITHET = [
  'the Bold', 'Ironhand', 'the Grim', 'Stormborn', 'the Red', 'Oakheart', 'the Wise', 'Longstride',
  'the Cruel', 'Ashfall', 'the Patient', 'Wolfsbane', 'the Young', 'Greymantle', 'the Just', 'Blackthorn',
  'Hammerfell', 'the Silent', 'Goldtongue', 'Frostbeard', 'the Fair', 'Ravencrest', 'the Unbowed', 'Halfhand',
  'the Lame', 'Truesword', 'the Elder', 'Bloodaxe', 'the Pious', 'Swiftfoot', 'the Tall', 'Ironside',
  'the Wanderer', 'Emberheart', 'the Mad', 'Stonejaw', 'the Quiet', 'Crowfeeder', 'the Merciful', 'Thornhelm',
  'the Black', 'Skullsplitter', 'the Gentle', 'Nightshade', 'the Hound', 'Brightblade', 'the Old', 'Ashborn',
];
const SURNAME = [
  'Blackwood', 'Ashford', 'Thornwall', 'Holloway', 'Redmane', 'Stormway', 'Greyhelm', 'Oakenshaw', 'Vance',
  'Harrow', 'Wolfe', 'Crane', 'Draven', 'Marsh', 'Kestrel', 'Varga', 'Novak', 'Duval', 'Moreau', 'Sorensen',
  'Halloran', 'Mac Tire', 'Ironwood', 'Fairweather', 'Stone', 'Lindqvist', 'Brandt', 'Corvus', 'Aldane', 'Rook',
];
const PLACE = [
  'Ravenholm', 'the Marches', 'Ashvale', 'Coldharbour', 'Thornfield', 'the Fens', 'Highcrag', 'Duskmere',
  'the North', 'Emberfall', 'Saltmarsh', 'Kingsbarrow', 'the Reach', 'Wolfden', 'Greymoor', 'the Isles',
];
const TITLE = ['Lord', 'Lady', 'Jarl', 'Baron', 'Baroness', 'Chieftain', 'Countess', 'Sir', 'Dame', 'Warden', 'Thane', 'Prince'];
// handles: bits people glue together for a username
const HANDLE_A = [
  'iron', 'grim', 'ash', 'dark', 'red', 'storm', 'frost', 'night', 'blood', 'wolf', 'raven', 'shadow', 'ember',
  'stone', 'silent', 'mad', 'lone', 'wild', 'gold', 'steel', 'crow', 'bone', 'rune', 'thorn', 'void', 'hex',
];
const HANDLE_B = [
  'fang', 'wolf', 'king', 'blade', 'reaper', 'hawk', 'fist', 'lord', 'slayer', 'heart', 'bane', 'walker', 'born',
  'crown', 'jaw', 'skull', 'hunter', 'rider', 'queen', 'smith', 'wind', 'song', 'tide', 'mark', 'ward', 'maw',
];
const SHORT_HANDLES = [
  'vex', 'morrow', 'kael', 'nyx', 'zed', 'oryn', 'sable', 'tovi', 'rook', 'ashe', 'jinx', 'wren', 'quill', 'bram',
  'lux', 'odin', 'fenn', 'kira', 'drax', 'milo', 'raze', 'skye', 'vale', 'yuki', 'zara', 'grog', 'tank', 'pip',
];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** A username, the way people make them up. */
function handle(r: RngHolder): string {
  const x = nextRandom(r);
  const n = () => String(Math.floor(nextRandom(r) * (nextRandom(r) < 0.5 ? 100 : 2000)));
  const a = pick(r, HANDLE_A), b = pick(r, HANDLE_B);
  if (x < 0.22) return a + b;                              // grimwolf
  if (x < 0.4) return cap(a) + cap(b);                     // IronFang
  if (x < 0.55) return cap(a) + cap(b) + n();              // IronFang88
  if (x < 0.65) return `${a}_${b}`;                        // ash_king
  if (x < 0.8) return pick(r, SHORT_HANDLES) + (nextRandom(r) < 0.5 ? n() : '');  // vex, kael42
  if (x < 0.88) return `x${cap(pick(r, SHORT_HANDLES))}x`;  // xNyxx
  if (x < 0.94) return `The${cap(a)}${cap(b)}`;            // TheStormWard
  return pick(r, FIRST).toLowerCase() + n();               // bjorn1977
}

export function rulerName(r: RngHolder): string {
  const x = nextRandom(r);
  if (x < 0.3) return `${pick(r, FIRST)} ${pick(r, EPITHET)}`;
  if (x < 0.45) return `${pick(r, FIRST)} ${pick(r, SURNAME)}`;
  if (x < 0.53) return `${pick(r, FIRST)} of ${pick(r, PLACE)}`;
  if (x < 0.62) return `${pick(r, TITLE)} ${pick(r, FIRST)}`;
  return handle(r).slice(0, 24);
}

const PRE = [
  'Oak', 'Ash', 'Stone', 'Iron', 'Elder', 'Raven', 'Wolf', 'Thorn', 'Mill', 'Brook', 'Frost', 'Hollow',
  'Red', 'Black', 'Gold', 'Moss', 'Fern', 'Hart', 'Wind', 'Salt', 'Birch', 'Barrow', 'Crag', 'Dun', 'Holly',
  'Kings', 'Marsh', 'North', 'Shep', 'Tall', 'Wither', 'Yew', 'Amber', 'Bram', 'Cold', 'Deep', 'Eagle',
];
const SUF = [
  'ford', 'haven', 'wick', 'stead', 'mere', 'hold', 'dale', 'bury', 'crest', 'field', 'gate', 'hollow',
  'moor', 'ridge', 'thorpe', 'ton', 'vale', 'watch', 'wood', 'barrow', 'brook', 'cliff', 'fell', 'garth',
];
const TRIBE_A = ['Iron', 'Crimson', 'Silver', 'Night', 'Storm', 'Ember', 'Frost', 'Golden', 'Shadow', 'Wild', 'Ashen', 'Stone', 'Black', 'Broken', 'Burning', 'Hollow', 'Northern', 'Pale', 'Red', 'Sworn', 'Thorned', 'Veiled', 'Winter', 'Blood', 'Oathbound', 'Grey', 'Lost', 'Sunken'];
const TRIBE_B = ['Wolves', 'Crowns', 'Oaths', 'Ravens', 'Banners', 'Lances', 'Hounds', 'Covenant', 'Brotherhood', 'Legion', 'Stags', 'Serpents', 'Company', 'Kin', 'Host', 'Order', 'Wardens', 'Blades', 'Shields', 'Riders', 'Circle', 'Pact', 'Horde', 'Vanguard', 'Watch', 'Crows', 'Bears', 'Lions', 'Keep', 'Council'];

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
