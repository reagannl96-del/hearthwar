// Core game-state types. Everything in World is plain JSON so it can be saved,
// cloned, or shipped over the network by a future multiplayer server.

export type ResKey = 'wood' | 'clay' | 'iron';
export const RES_KEYS: ResKey[] = ['wood', 'clay', 'iron'];
export interface Res { wood: number; clay: number; iron: number }

export type BuildingId =
  | 'main' | 'barracks' | 'stable' | 'workshop' | 'academy' | 'smithy'
  | 'rally' | 'statue' | 'market' | 'timber' | 'claypit' | 'ironmine'
  | 'farm' | 'warehouse' | 'hiding' | 'wall' | 'watchtower';

export type UnitId =
  | 'spear' | 'sword' | 'axe' | 'archer' | 'scout' | 'light' | 'marcher'
  | 'heavy' | 'ram' | 'catapult' | 'paladin' | 'sorcerer' | 'druid' | 'goblin' | 'noble' | 'militia';

export type Units = { [K in UnitId]?: number };
export type Buildings = Record<BuildingId, number>;

export type RecruitBuilding = 'barracks' | 'stable' | 'workshop' | 'academy' | 'statue';

export type BonusType = 'wood' | 'clay' | 'iron' | 'all' | 'farm' | 'storage' | 'recruit';

export type Difficulty = 'peaceful' | 'easy' | 'normal' | 'hard';

export interface WorldConfig {
  /** Economy/build/recruit speed multiplier (Tribal Wars classic = 1). */
  speed: number;
  /** Troop & merchant movement speed multiplier. */
  unitSpeed: number;
  size: number;
  aiCount: number;
  barbDensity: number;
  difficulty: Difficulty;
  morale: boolean;
  archers: boolean;
  paladin: boolean;
  /** Max luck swing, 0..0.25 */
  luck: number;
  /** Beginner protection in game-hours at speed 1 (scaled by speed). */
  protectionHours: number;
}

export interface BuildJob {
  id: number;
  building: BuildingId;
  level: number;          // target level
  start: number;
  end: number;
  cost: Res;
  pop: number;
  demolish?: boolean;
}

export interface RecruitJob {
  id: number;
  unit: UnitId;
  count: number;
  done: number;           // units already delivered
  start: number;          // when first unit started
  per: number;            // ms per unit
  cost: Res;              // per unit
}

export interface ResearchJob {
  id: number;
  unit: UnitId;
  level: number;
  start: number;
  end: number;
  cost: Res;
}

export interface SupportStack {
  fromVid: number;
  ownerId: number;
  units: Units;
}

export interface ScavengeRun {
  tier: number;
  units: Units;
  loot: Res;
  start: number;
  end: number;
}

export interface Village {
  id: number;
  name: string;
  x: number;
  y: number;
  ownerId: number | null;          // null = barbarian
  buildings: Buildings;
  res: Res;
  resAt: number;
  loyalty: number;
  loyaltyAt: number;
  units: Units;                    // own units currently at home
  support: SupportStack[];         // troops from other villages stationed here
  buildQueue: BuildJob[];
  recruit: Record<RecruitBuilding, RecruitJob[]>;
  research: ResearchJob[];
  tech: Units;                     // research level per unit (0/undefined = not researched)
  points: number;
  bonus?: BonusType;
  militiaUntil?: number;
  scavengeUnlocked: number;        // number of scavenge tiers unlocked (0..4)
  scavenge: (ScavengeRun | null)[];
  foundedAt: number;
  /** population of this village's own units currently away (moving, stationed elsewhere, scavenging) */
  outPop: number;
  merchantsOut: number;
  /** barbarians: last time growth was applied */
  grownAt?: number;
  /** the hero this village's statue is sworn to: the first one trained here, for good */
  heroKind?: UnitId;
}

export type CommandKind = 'attack' | 'support' | 'return' | 'trade' | 'tradeback';

export interface Command {
  id: number;
  kind: CommandKind;
  ownerId: number;
  fromVid: number;                 // home village of the units / merchants
  toVid: number;                   // destination
  units: Units;
  res?: Res;
  merchants?: number;
  depart: number;
  arrive: number;
  catTarget?: BuildingId;
  /** farm helper: automatically re-send when troops come home */
  repeat?: boolean;
  /** for returns: which village the troops came back from */
  origin?: number;
  /** ai bookkeeping */
  tag?: string;
  /** owner of the target when the command was sent (support turns back if it changes) */
  targetOwner?: number | null;
  /** returns: some of the army fell in the battle (drawn yellow on the map instead of white) */
  losses?: boolean;
}

export type ReportColor = 'green' | 'yellow' | 'red' | 'blue' | 'grey';

export interface SideInfo {
  playerId: number | null;
  playerName: string;
  vid: number;
  vname: string;
  x: number;
  y: number;
}

export interface ScoutInfo {
  res?: Res;
  /** part of res kept safe in the hiding place (cannot be plundered) */
  hidden?: Res;
  buildings?: Partial<Buildings>;
  unitsOutside?: Units;
}

export interface BattleData {
  attacker: SideInfo;
  defender: SideInfo;
  luck: number;
  morale: number;
  attUnits: Units;
  attLost: Units;
  defUnits?: Units;               // undefined = attacker learned nothing
  defLost?: Units;
  winner: 'attacker' | 'defender';
  wall?: { before: number; after: number };
  building?: { id: BuildingId; before: number; after: number };
  loot?: Res;
  capacity?: number;
  loyalty?: { before: number; after: number };
  conquered?: boolean;
  scout?: ScoutInfo;
  paladinItem?: string;
  militia?: boolean;
  nightOwl?: boolean;
}

export interface Report {
  id: number;
  t: number;
  kind: 'attack' | 'defense' | 'support' | 'trade' | 'info' | 'conquest' | 'lost';
  title: string;
  color: ReportColor;
  read: boolean;
  battle?: BattleData;
  text?: string;
  vid?: number;                   // related village for filtering
  res?: Res;
}

export interface Intel {
  t: number;
  scoutT?: number;
  res?: Res;
  buildings?: Partial<Buildings>;
  units?: Units;
  lastAttackT?: number;
  lastColor?: ReportColor;
  lastLoot?: number;
  lastCapacity?: number;
  wall?: number;
}

export interface PaladinState {
  name: string;
  items: string[];               // discovered item ids
  equipped: string | null;
  nextItemAt: number;
  vid: number | null;            // village where the paladin belongs (home)
}

export interface AIState {
  personality: 'farmer' | 'warlord' | 'turtle' | 'expander';
  nextThink: number;
  targetPlayer?: number | null;
  lastWarCheck: number;
  aggression: number;          // 0..1
  hostile: boolean;            // allowed to attack the human
  memory: Record<number, number>; // target vid -> last time a farm was sent
  /** human player id -> last time this ruler launched an attack at them */
  lastHit?: Record<number, number>;
  /** when the current grudge (targetPlayer) was last renewed */
  grudgeAt?: number;
}

export interface PlayerStats {
  loot: number;
  killsAtt: number;             // population of enemy units defeated as attacker (ODA)
  killsDef: number;             // as defender (ODD)
  lostUnits: number;
  conquered: number;
  attacks: number;
  scouted: number;
  built: number;
  recruited: number;
}

export interface Player {
  id: number;
  name: string;
  kind: 'human' | 'ai';
  color: string;
  tribeId: number | null;
  villages: number[];
  coins: number;
  points: number;
  stats: PlayerStats;
  reports: Report[];
  intel: Record<number, Intel>;
  questsClaimed: string[];
  achievements: Record<string, number>;
  paladin: PaladinState | null;
  protectedUntil: number;
  createdAt: number;
  history: [number, number][];  // [time, points]
  ai?: AIState;
  notes: Record<number, string>;
  eliminated?: boolean;
}

export interface Tribe {
  id: number;
  name: string;
  tag: string;
  color: string;
  members: number[];
}

export type GameEventType = 'build' | 'arrive' | 'research' | 'ai' | 'barb' | 'scav' | 'item' | 'sample';

export interface GameEvent {
  t: number;
  s: number;                    // sequence for stable ordering
  type: GameEventType;
  a: number;
  b?: number;
}

export interface NewsItem {
  t: number;
  text: string;
  kind: 'conquest' | 'player' | 'world';
  vid?: number;
}

export interface World {
  version: number;
  id: string;
  name: string;
  seed: number;
  rng: number;
  now: number;
  config: WorldConfig;
  terrain: string;
  villages: Record<number, Village>;
  players: Record<number, Player>;
  tribes: Record<number, Tribe>;
  commands: Record<number, Command>;
  events: GameEvent[];
  nextId: number;
  seq: number;
  humanId: number;
  mapRev: number;
  news: NewsItem[];
  exchange: Res;                 // NPC trading post stock
  createdReal: number;
  /** online worlds: sign-in account id -> player id */
  accounts?: Record<string, number>;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  data?: unknown;
}
