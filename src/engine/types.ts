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
  | 'heavy' | 'ram' | 'catapult' | 'paladin' | 'sorcerer' | 'druid' | 'goblin' | 'necromancer' | 'noble' | 'militia';

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
  /** how many real days a round of this realm lasts (14 if unset) */
  roundDays?: number;
  /** testing: AI rulers never sleep or take breaks */
  aiAlwaysAwake?: boolean;
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
  /** the village's look, so reports can name its troops (goblin, sorcerer, druid or classic) */
  theme?: 'classic' | 'sorcerer' | 'druid' | 'goblin' | 'necromancer';
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
  /** a necromancer raised some of the fallen as skeleton spearmen for his side */
  risen?: { side: 'attacker' | 'defender'; n: number };
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

/** A hero kind's legendary items: those found, and the one carried into battle. */
export interface HeroGear { items: string[]; equipped: string | null }

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
  /** village id -> a scouting mission waiting for its report */
  plans?: Record<number, { target: number; since: number; scoutCmd: number }>;
  /** target village -> until when it is left alone (scouted and not worth it, or too strong) */
  avoid?: Record<number, number>;
  /** what each village is built for, as a Tribal Wars player would set it up */
  roles?: Record<number, VillageRole>;
  /** which village the ruler looks at next: a person works through their villages a few at a time */
  cursor?: number;
  /** raids still to click out in the current look */
  raidBudget?: number;
  /** when the last noble train set out */
  lastConquest?: number;
}

/** Offensive (all attack troops), defensive (all defence, a few light cavalry to farm), mixed, or a random assortment. */
export interface VillageRole {
  kind: 'offense' | 'defense' | 'mixed' | 'random';
  /** the random assortment's recipe */
  weights?: Partial<Record<UnitId, number>>;
}

export interface PlayerStats {
  loot: number;
  killsAtt: number;             // population of enemy units defeated as attacker (ODA)
  killsDef: number;             // as defender (ODD)
  /** as a supporter in someone else's village (ODS) */
  killsSup?: number;
  lostUnits: number;
  conquered: number;
  attacks: number;
  scouted: number;
  built: number;
  recruited: number;
}

export type DailyKind = 'attacker' | 'defender' | 'supporter' | 'looter' | 'conqueror';
export interface DailyAward { kind: DailyKind; day: number; score: number; runnerUp: number | null }

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
  /** legendary items of the other heroes (the paladin's live in `paladin`) */
  heroGear?: Partial<Record<UnitId, HeroGear>>;
  protectedUntil: number;
  createdAt: number;
  history: [number, number][];  // [time, points]
  ai?: AIState;
  notes: Record<number, string>;
  eliminated?: boolean;
  /** today's tally towards the daily awards */
  daily?: { day: number } & Record<DailyKind, number>;
  /** every daily award this ruler has won */
  dailyAwards?: DailyAward[];
  /** tribe forum: thread id -> last post id this ruler has read */
  forumSeen?: Record<number, number>;
}

/** What a tribe member may do, as in Tribal Wars. */
export type TribeRight = 'lead' | 'invite' | 'diplomacy' | 'forum' | 'internal';
export type Diplomacy = 'ally' | 'nap' | 'enemy';

/** A report shared in the tribe forum: a frozen copy, so it reads the same for everyone and survives the original being deleted. */
export interface SharedReport { kind: Report['kind']; title: string; color: ReportColor; t: number; battle?: BattleData; text?: string; res?: Res }
export interface ForumPost { id: number; by: number; t: number; text: string; report?: SharedReport }
export interface ForumThread { id: number; title: string; by: number; t: number; posts: ForumPost[]; sticky?: boolean }
export interface TribeInvite { pid: number; by: number; t: number }

/** Someone in the tribe is under attack (members with the "internal" right see these). */
export interface TribeAlert { cid: number; memberId: number; vid: number; vname: string; x: number; y: number; attacker: string; arrive: number }

export interface Tribe {
  id: number;
  name: string;
  tag: string;
  color: string;
  members: number[];
  founderId?: number;
  createdAt?: number;
  /** public profile text */
  description?: string;
  /** members-only announcement */
  internal?: string;
  /** rights per member; the founder always has them all */
  rights?: Record<number, TribeRight[]>;
  invites?: TribeInvite[];
  /** other tribe id -> relation */
  diplomacy?: Record<number, Diplomacy>;
  forum?: ForumThread[];
}

export type GameEventType = 'build' | 'arrive' | 'research' | 'ai' | 'barb' | 'scav' | 'item' | 'sample' | 'end';

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
  /** the day the daily awards are currently being counted for */
  dayKey?: number;
  /** online worlds: sign-in account id -> player id */
  accounts?: Record<string, number>;
  /** when this round ends (world time) */
  endsAt?: number;
  /** the final standings, once the round is over (the realm is frozen then) */
  finished?: RoundResult;
  /** earlier rounds on this server: the hall of fame */
  pastRounds?: RoundResult[];
  /** the realm is the round island (older worlds were square and get grown on load) */
  round?: boolean;
  /** client-side shadow only: attacks on fellow tribe members, as sent by the server */
  tribeAlerts?: TribeAlert[];
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  data?: unknown;
}

export interface RoundResult {
  world: string;
  /** world time the round ended */
  at: number;
  /** wall-clock time it ended */
  endedReal: number;
  days: number;
  winner: { name: string; tag: string; color: string; share: number; villages: number; domination: boolean } | null;
  tribes: { name: string; tag: string; share: number }[];
  topRuler: { name: string; tag: string | null; points: number } | null;
}
