// The attack theatre: acts out an attack on the village you are looking at.
//
//  - In the last fifth of its march an army comes into sight from the direction
//    it was sent from, in its own colours, and marches up to a staging line.
//  - The alarm goes up: a lookout on the watchtower jumps and waves (or, without
//    one, a villager runs to the square ringing a bell once the enemy is close),
//    villagers haul the stores into the hiding place, and the defenders turn out
//    to their posts: archers on the wall, spearmen behind it, the rest in reserve.
//  - The army charges. When it lands, the battle report arrives and the fight is
//    replayed from it: archers and spearmen exchange volleys, rams batter the wall
//    down by exactly the levels it lost, catapults set their target on fire and
//    knock it down to its real level, the lines meet and every figure that falls
//    falls to an arrow, a thrown spear, a bolt or a blade. Heroes do what heroes do.
//  - Then the winners act: the attackers carry off the loot (or plant a banner
//    at the headquarters), or the defenders cheer. Fires burn on while the
//    villagers run buckets of water to them, and rubble lies where the wall broke.
//  - When the defenders have beaten off the last of a wave of attacks (all of a
//    noble train, and nothing else on its way), the whole village throws a party
//    in the square: everyone dances, and fireworks go up.

import * as THREE from 'three';
import type { BattleData, BuildingId, Buildings, Res, UnitId, Units } from '../../../engine/types';
import type { Theme } from '../kit';
import { GATE_A, LAYOUT, OUTSIDE, WALL_R, buildingScale, heightAt, wallGuardPosts } from '../scene';
import { Fx, type Fire } from './fx';
import { boltThrowers } from '../deepforge';
import { rimeGlaze } from '../frosthold';
import { clearOfWorks, freeSpot, route } from './paths';
import {
  FIG_SCALE, disposeTemplates, ladder, makeCatapult, makeFigure, makeRam, makeVillager, sack, shotFire, standard, withTheme,
  bucket as makeBucket, type Catapult, type Figure, type Ram, type Shot,
} from './models';
import {
  APPROACH, approachAt, bearingOf, fallTimes, glimpsed, hidingCrew, planBattle, representatives, roleOf,
  type BattlePlan, type Role, type Side,
} from './script';

// ---------- what the theatre is told ----------

export interface TheatreIncoming {
  id: number;
  fromVid: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  depart: number;
  arrive: number;
  theme: Theme;
  /** the kinds of troops coming, once the army is in sight */
  kinds?: UnitId[];
  ownerName: string;
}

export interface TheatreReport { id: number; t: number; battle: BattleData }

export interface TheatreVillage {
  id: number;
  x: number;
  y: number;
  buildings: Buildings;
  /** own troops at home, and support from others (each in its own colours) */
  units: Units;
  support: { units: Units; theme: Theme }[];
  /** the hiding place protects this much of each resource */
  hide: number;
  res: Res;
  theme: Theme;
  /** a resource cache's supply depot: guards and stores, no villagers to come out and dance */
  depot?: boolean;
}

export interface TheatreInput {
  /** game time (ms) and how fast it runs against real time (0 while paused) */
  now: number;
  rate: number;
  village: TheatreVillage;
  incoming: TheatreIncoming[];
  /** recent defence reports for this village, newest first */
  reports: TheatreReport[];
}

export interface BattleSound {
  bell(): void;
  horn(): void;
  clash(): void;
  thud(): void;
  boom(): void;
  twang(): void;
  whoosh(): void;
  splash(): void;
  cheer(): void;
  fanfare(): void;
  /** a raptor's hunting shriek (the Saurian King's pack) */
  shriek?(): void;
}

/** What the theatre needs from the village scene around it. */
export interface Stage {
  scene: THREE.Scene;
  /** the wall level on screen (after any hold) */
  wallLevel(): number;
  /** a point on a building's roof to aim at, and roughly how big it is */
  aim(id: BuildingId): { pos: THREE.Vector3; radius: number } | null;
  /** the held levels changed: rebuild those buildings */
  holdsChanged(): void;
  /** hide the idle villagers and troops strolling about while a battle is on */
  quiet(on: boolean): void;
  /** the sorcerer's barrier takes a hit */
  flashBarrier(k: number): void;
  night(): boolean;
  sound: BattleSound;
}

// ---------- the cast ----------

type Mode = 'formation' | 'scripted';

interface Move { t0: number; t1: number; from: THREE.Vector3; to: THREE.Vector3; hop: number; run: boolean; climb?: number }

interface Actor {
  f: Figure;
  unit: UnitId | 'villager';
  side: Side;
  role: Role;
  theme: Theme;
  mode: Mode;
  row: number;
  col: number;
  cols: number;
  pos: THREE.Vector3;
  face: number;
  moves: Move[];
  /** when it falls (theatre time), and whether it has */
  fallAt: number | null;
  fallen: boolean;
  fallT: number;
  gone: boolean;
  fadeFrom: number | null;
  partner: Actor | null;
  lookAt: THREE.Vector3 | null;
  swingT: number;
  shootT: number;
  throwT: number;
  cheerT: number;
  castT: number;
  nextAmbient: number;
  carry: THREE.Object3D | null;
  ph: number;
  siege: Ram | Catapult | null;
  flying: number;
  home: BuildingId | null;
  /** a wall archer, standing on a post */
  post: boolean;
  /** the blow (or arrow) that fells it has been set in motion */
  killScheduled?: boolean;
  /** dancing in the square, from and until (theatre time) */
  partyFrom: number;
  partyUntil: number;
}

interface Army {
  key: string;
  fromVid: number;
  ids: Set<number>;
  owner: string;
  theta: number;
  theme: Theme;
  depart: number;
  /** when its first wave lands, and its last (a noble train comes in a few waves) */
  arrive: number;
  last: number;
  kindsKey: string;
  actors: Actor[];
  banner: THREE.Group | null;
  seenAt: number;
  arrivedAt: number | null;
  battle: Battle | null;
  /** a replay runs on real time, not the game clock */
  replay: { t0: number; report: TheatreReport } | null;
  scoutOnly: boolean;
  done: boolean;
  /** its report, waiting for the battle before it to finish */
  pending: TheatreReport | null;
}

interface Battle {
  plan: BattlePlan;
  report: TheatreReport;
  t0: number;
  P: THREE.Vector3;
  u: THREE.Vector3;
  v: THREE.Vector3;
  theta: number;
  events: { t: number; run: () => void }[];
  defenders: Actor[];
  breached: boolean;
  ladders: THREE.Group[];
  /** where the ladders stand (sideways from the breach point), and how high the wall is */
  ladLat: number[];
  wallH: number;
  extras: THREE.Object3D[];
  ended: boolean;
}

interface Walker {
  f: Figure;
  moves: Move[];
  job: 'lookout' | 'carry' | 'bucket' | 'bell' | 'party';
  /** a party-goer dances from and until */
  dance?: [number, number];
  carry: THREE.Object3D | null;
  loopAt: number;
  ph: number;
  target?: Fire;
  gone: boolean;
  hidden: boolean;
}

const ORIGIN: Partial<Record<UnitId, BuildingId>> = {
  spear: 'barracks', sword: 'barracks', axe: 'barracks', archer: 'barracks', scout: 'main', militia: 'farm',
  light: 'stable', marcher: 'stable', heavy: 'stable',
  paladin: 'statue', sorcerer: 'statue', druid: 'statue', goblin: 'statue', necromancer: 'statue', orc: 'statue',
  frost: 'statue', dwarf: 'statue', djinn: 'statue', saurian: 'statue',
};

const THEME_COLOR: Record<Theme, number> = { classic: 0xb3332a, paladin: 0x2c56b0, sorcerer: 0x6a3fa0, druid: 0x4f7a2e, goblin: 0x6f9a2a, necromancer: 0x2f7a4a, orc: 0xa3261a, frost: 0x3f7fc6, dwarf: 0xb8452a, djinn: 0xd8a018, saurian: 0xc8402a };
const WALL_COLOR = (level: number) => (level >= 10 ? 0xb9b09c : 0x8a5a30);
const wallTier = (l: number) => (l <= 0 ? 0 : l < 5 ? 1 : l < 10 ? 2 : l < 15 ? 3 : 4);
const wallHeight = (l: number) => (l <= 0 ? 0 : l < 5 ? 2.9 : l < 10 ? 3.8 : l < 15 ? 3.6 : 4.8);
/** waves from one village landing this close together are one army (a noble train) */
const TRAIN_GAP = 2500;
/** no party while another attack lands within this long (game time), or since one went the enemy's way */
const PARTY_QUIET = 15 * 60_000;
/** how long the party lasts (seconds after the battle is won) */
const PARTY_S = 11.5;
/** the middle of the square */
const PARTY_C = new THREE.Vector3(0, 0, 4.5);

/** A place in the crowd round the square. */
function partySpot(i: number): THREE.Vector3 {
  const a = i * 2.39996, r = 5.6 + (i % 4) * 1.5;
  return freeSpot(new THREE.Vector3(PARTY_C.x + Math.cos(a) * r, 0, PARTY_C.z + Math.sin(a) * r));
}

/** Free the geometry a model made for itself (shared template geometry stays). */
function disposeGeo(o: THREE.Object3D): void {
  o.traverse((c) => { if (c instanceof THREE.Mesh && !c.userData.sharedGeometry) c.geometry.dispose(); });
}

/** Several waves of one army (a noble train), told as one battle. */
function mergeReports(rs: TheatreReport[]): TheatreReport {
  if (rs.length === 1) return rs[0];
  const first = rs[0].battle, last = rs[rs.length - 1].battle;
  const bs = rs.map((r) => r.battle);
  const add = (list: (Units | undefined)[]) => {
    const o: Units = {};
    for (const u of list) for (const k of Object.keys(u ?? {}) as UnitId[]) o[k] = (o[k] ?? 0) + (u![k] ?? 0);
    return o;
  };
  const walls = bs.filter((b) => b.wall);
  const blds = bs.filter((b) => b.building && b.building.id === first.building?.id);
  const loy = bs.filter((b) => b.loyalty);
  const loots = bs.filter((b) => b.loot);
  const battle: BattleData = {
    ...first,
    attUnits: add(bs.map((b) => b.attUnits)),
    attLost: add(bs.map((b) => b.attLost)),
    defLost: add(bs.map((b) => b.defLost)),
    winner: last.winner,
    wall: walls.length ? { before: walls[0].wall!.before, after: walls[walls.length - 1].wall!.after } : undefined,
    building: blds.length ? { ...blds[0].building!, after: blds[blds.length - 1].building!.after } : first.building,
    loot: loots.length ? { wood: loots.reduce((n, b) => n + b.loot!.wood, 0), clay: loots.reduce((n, b) => n + b.loot!.clay, 0), iron: loots.reduce((n, b) => n + b.loot!.iron, 0) } : undefined,
    loyalty: loy.length ? { before: loy[0].loyalty!.before, after: loy[loy.length - 1].loyalty!.after } : undefined,
    conquered: bs.some((b) => b.conquered),
    effects: [...new Set(bs.flatMap((b) => b.effects ?? []))],
  };
  return { id: rs[0].id, t: rs[0].t, battle };
}

const ground = (x: number, z: number) => (Math.hypot(x, z) > WALL_R + 2 ? heightAt(x, z) : 0);
const yawTo = (dx: number, dz: number) => Math.atan2(dx, dz);
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/** A spot at bearing `theta`, `r` from the centre, `lat` to the side. */
function spot(theta: number, r: number, lat = 0): THREE.Vector3 {
  const x = Math.cos(theta) * r - Math.sin(theta) * lat, z = Math.sin(theta) * r + Math.cos(theta) * lat;
  return new THREE.Vector3(x, ground(x, z), z);
}

/** In front of a building's door. */
function doorstep(id: BuildingId, out = 4.5): THREE.Vector3 {
  const [x, z, ry] = LAYOUT[id];
  const s = buildingScale(id);
  const px = x + Math.sin(ry) * out * s, pz = z + Math.cos(ry) * out * s;
  return new THREE.Vector3(px, OUTSIDE.includes(id) ? heightAt(px, pz) : 0, pz);
}

/** A floating caption (loyalty drops, a conquest): a sprite with text on it. */
function caption(text: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d')!;
  g.font = 'bold 54px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = 'rgba(30,18,6,0.9)';
  g.strokeText(text, 256, 50);
  g.fillStyle = color;
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  s.scale.set(16, 3, 1);
  s.renderOrder = 20;
  return s;
}

/** The lookout's warning: a red "!" in a bubble. */
function alarmSprite(): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff4dc';
  g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
  g.lineWidth = 5; g.strokeStyle = '#b3261a'; g.stroke();
  g.fillStyle = '#b3261a';
  g.font = 'bold 44px Georgia, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('!', 32, 35);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, depthTest: false }));
  s.scale.set(2.4, 2.4, 1);
  s.renderOrder = 20;
  return s;
}

// ---------- the theatre ----------

export class BattleTheatre {
  readonly group = new THREE.Group();
  private fx = new Fx();
  private T = 0;
  private input: TheatreInput | null = null;
  private gameAt = 0;
  private realAt = 0;
  private rate = 1;
  private villageId = -1;
  private armies = new Map<string, Army>();
  private defenders: Actor[] = [];
  private musterKey = '';
  private musterTheta = GATE_A;
  private walkers: Walker[] = [];
  private lookout: Walker | null = null;
  private alarm: THREE.Sprite | null = null;
  private alarmUntil = 0;
  private bellAt = 0;
  private holds: Partial<Record<BuildingId, number>> = {};
  private seen = new Set<number>();
  private rubble: { m: THREE.Mesh; until: number }[] = [];
  private captions: { s: THREE.Sprite; t0: number; life: number; y0: number }[] = [];
  private thorns: { g: THREE.Group; mat: THREE.Material; t0: number; until: number } | null = null;
  /** the Frost Queen's rime, glazing the wall where the rams strike */
  private rime: { g: THREE.Group; mats: THREE.Material[]; t0: number; until: number } | null = null;
  /** the fire burning on each building the catapults hit */
  private fires = new Map<BuildingId, Fire>();
  /** when (game time) an attack last went the enemy's way: the village is in no mood for a party */
  private lostAt = -Infinity;
  private chunkMats = new Map<number, THREE.MeshLambertMaterial>();
  private sfxAt: Record<string, number> = {};
  private quietOn = false;
  private active = false;

  constructor(private stage: Stage) {
    this.group.add(this.fx.group);
    stage.scene.add(this.group);
  }

  /** A battle, an approach or its aftermath is on screen. */
  get busy(): boolean {
    return this.active;
  }

  /** Buildings to show at an earlier level while the scene knocks them down. */
  held(): Partial<Record<BuildingId, number>> {
    return this.holds;
  }

  /** Where the fighting is (for a "watch" button), if anywhere. */
  focusPoint(): THREE.Vector3 | null {
    for (const a of this.armies.values()) {
      if (a.battle && !a.battle.ended) return a.battle.P.clone();
      const first = a.actors.find((x) => !x.gone);
      if (first) return first.pos.clone();
    }
    return null;
  }

  // ---------- input ----------

  set(input: TheatreInput): void {
    const now = performance.now();
    if (input.village.id !== this.villageId) this.reset(input.village.id);
    this.input = input;
    this.gameAt = input.now;
    this.realAt = now;
    this.rate = input.rate;
    this.fx.night = this.stage.night();
    // group incoming attacks into armies: waves from one village landing within moments of each other are one army (a noble train)
    const groups: TheatreIncoming[][] = [];
    for (const c of [...input.incoming].sort((a, b) => a.arrive - b.arrive)) {
      const g = groups.find((x) => x[0].fromVid === c.fromVid && c.arrive - x[x.length - 1].arrive <= TRAIN_GAP);
      if (g) g.push(c);
      else groups.push([c]);
    }
    for (const cs of groups) {
      const first = cs[0], lastWave = cs[cs.length - 1];
      const kinds = [...new Set(cs.flatMap((c) => c.kinds ?? []))];
      if (kinds.length === 0) continue; // not in sight yet
      let army = [...this.armies.values()].find((a) => !a.replay && !a.done && a.fromVid === first.fromVid
        && (cs.some((c) => a.ids.has(c.id)) || (first.arrive <= a.last + TRAIN_GAP && lastWave.arrive >= a.arrive - TRAIN_GAP)));
      if (!army) {
        army = this.newArmy(`${first.fromVid}:${first.id}`, first, kinds);
        this.armies.set(army.key, army);
      }
      army.seenAt = now;
      for (const c of cs) {
        army.ids.add(c.id);
        if (!army.battle) army.arrive = Math.min(army.arrive, c.arrive);
        army.last = Math.max(army.last, c.arrive);
      }
      const kk = kinds.sort().join(',');
      if (kk !== army.kindsKey && !army.battle) {
        army.kindsKey = kk;
        this.castArmy(army, glimpsed(kinds));
      }
    }
    // reports, oldest first: a battle that just landed on one of our armies, or one we only hear about afterwards
    const fresh = input.reports.filter((r) => !this.seen.has(r.id)).sort((a, b) => a.t - b.t || a.id - b.id);
    const landed = new Map<Army, TheatreReport[]>();
    for (const r of fresh) {
      this.seen.add(r.id);
      const army = [...this.armies.values()].find((a) => !a.replay && !a.done && a.fromVid === r.battle.attacker.vid
        && r.t >= a.arrive - TRAIN_GAP && r.t <= a.last + TRAIN_GAP);
      if (army) { (landed.get(army) ?? landed.set(army, []).get(army)!).push(r); continue; }
      // a battle we missed: if it is fresh, show what it left behind
      const age = (input.now - r.t) / Math.max(1, input.rate || 1);
      if (age < 60_000) this.aftermathOnly(r);
    }
    for (const [army, rs] of landed) {
      if (army.battle) { for (const r of rs) this.laterWave(army, r); continue; }
      // every wave of a train that has landed so far, as one battle
      const r = mergeReports(army.pending ? [army.pending, ...rs] : rs);
      army.pending = null;
      if (this.fighting()) army.pending = r; // one battle at a time: it waits its turn at the wall
      else this.startBattle(army, r);
    }
  }

  /** A battle is being fought right now. */
  private fighting(): boolean {
    for (const a of this.armies.values()) if (a.battle && !a.battle.ended) return true;
    return false;
  }

  /** Play a battle report again: the army marches up and it all happens once more. */
  replay(report: TheatreReport, fromX: number, fromY: number): void {
    const v = this.input?.village;
    if (!v) return;
    const key = `replay:${report.id}:${this.T.toFixed(2)}`;
    const b = report.battle;
    const kinds = (Object.keys(b.attUnits) as UnitId[]).filter((k) => (b.attUnits[k] ?? 0) > 0);
    const army = this.newArmy(key, {
      id: -report.id, fromVid: b.attacker.vid, fromX, fromY, toX: v.x, toY: v.y, depart: 0, arrive: 0,
      theme: (b.attacker.theme ?? 'classic') as Theme, kinds, ownerName: b.attacker.playerName,
    }, kinds);
    // a replay marches for ~14 real seconds and then fights
    army.replay = { t0: this.T, report };
    army.arrive = (this.T + 14) * 1000;
    army.depart = army.arrive - 5 * 14_000;
    this.armies.set(key, army);
    this.castArmy(army, b.attUnits);
    // while it marches up, the wall and the target stand as they were before the attack
    if (!this.fighting()) {
      const plan = planBattle(b);
      let held = false;
      if (plan.wall && plan.wall.after < plan.wall.before) { this.holds.wall = plan.wall.before; held = true; }
      if (plan.building && plan.building.after < plan.building.before) { this.holds[plan.building.id] = plan.building.before; held = true; }
      if (held) this.stage.holdsChanged();
    }
    this.active = true;
  }

  private reset(villageId: number): void {
    for (const a of this.armies.values()) this.dropArmy(a);
    this.armies.clear();
    this.clearDefenders();
    for (const w of this.walkers) this.dropWalker(w);
    this.walkers = [];
    this.lookout = null;
    this.dropAlarm();
    for (const r of this.rubble) this.group.remove(r.m);
    this.rubble = [];
    for (const c of this.captions) this.dropCaption(c.s);
    this.captions = [];
    this.dropThorns();
    this.dropRime();
    this.fx.clear();
    this.fires.clear();
    this.holds = {};
    this.alarmUntil = 0;
    this.bellAt = 0;
    this.musterKey = '';
    this.villageId = villageId;
    this.seen.clear();
    this.setQuiet(false);
  }

  private dropWalker(w: Walker): void {
    this.group.remove(w.f.g);
    disposeGeo(w.f.g);
  }

  private dropAlarm(): void {
    if (!this.alarm) return;
    this.group.remove(this.alarm);
    const m = this.alarm.material as THREE.SpriteMaterial;
    m.map?.dispose();
    m.dispose();
    this.alarm = null;
  }

  private dropCaption(sp: THREE.Sprite): void {
    this.group.remove(sp);
    const m = sp.material as THREE.SpriteMaterial;
    m.map?.dispose();
    m.dispose();
  }

  private dropThorns(): void {
    if (!this.thorns) return;
    this.group.remove(this.thorns.g);
    this.thorns.g.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.thorns.mat.dispose();
    this.thorns = null;
  }

  private dropRime(): void {
    if (!this.rime) return;
    this.group.remove(this.rime.g);
    this.rime.g.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    for (const m of this.rime.mats) m.dispose();
    this.rime = null;
  }

  /** The Frost Queen's rime: a sheet of ice spreads over the wall's outer face where the rams will strike. */
  private glazeWall(P: THREE.Vector3, u: THREE.Vector3, level: number): void {
    this.dropRime();
    const tier = wallTier(level);
    const { g, mats } = rimeGlaze(9, wallHeight(level) + 0.3);
    g.position.copy(P).addScaledVector(u, tier >= 3 ? (tier === 3 ? 0.9 : 1.1) : 0.72);
    g.position.y = 0;
    g.rotation.y = Math.atan2(u.x, u.z);
    g.scale.set(0.05, 1, 1);
    this.group.add(g);
    this.rime = { g, mats, t0: this.T, until: this.T + 16 };
    const c = g.position.clone().setY(wallHeight(level) * 0.5);
    this.fx.flash(c, 7, 0x9fe6ff, 0.7);
    this.fx.magic(c, 16, 0xdff6ff);
    this.fx.smoke(c, 0xe8f4fa, 3, 1.0);
  }

  private gameNow(): number {
    return this.gameAt + (performance.now() - this.realAt) * this.rate;
  }

  // ---------- armies ----------

  private newArmy(key: string, c: TheatreIncoming, kinds: UnitId[]): Army {
    return {
      key, fromVid: c.fromVid, ids: new Set([c.id]), owner: c.ownerName,
      theta: bearingOf(c.fromX, c.fromY, c.toX, c.toY), theme: c.theme,
      depart: c.depart, arrive: c.arrive, last: c.arrive, kindsKey: '', actors: [], banner: null,
      seenAt: performance.now(), arrivedAt: null, battle: null, replay: null,
      scoutOnly: kinds.length > 0 && kinds.every((k) => k === 'scout'), done: false, pending: null,
    };
  }

  /** (Re)build the figures standing for an army. */
  private castArmy(army: Army, units: Units): void {
    for (const a of army.actors) this.removeActor(a);
    army.actors = [];
    const reps = representatives(units, 30);
    const list: UnitId[] = [];
    for (const [u, n] of reps) for (let i = 0; i < n; i++) list.push(u);
    // rows of up to six, siege and nobles at the back
    let row = 0, col = 0;
    const perRow = 6;
    const rows: UnitId[][] = [];
    let cur: UnitId[] = [];
    let lastSiege = false;
    for (const u of list) {
      const siege = u === 'ram' || u === 'catapult' || u === 'noble';
      if (cur.length >= perRow || (siege && !lastSiege && cur.length)) { rows.push(cur); cur = []; }
      cur.push(u);
      lastSiege = siege;
    }
    if (cur.length) rows.push(cur);
    for (row = 0; row < rows.length; row++) {
      for (col = 0; col < rows[row].length; col++) {
        const a = this.makeActor(rows[row][col], 'att', army.theme);
        a.row = row;
        a.col = col;
        a.cols = rows[row].length;
        army.actors.push(a);
      }
    }
    if (!army.banner) {
      army.banner = withTheme(army.theme, () => standard(THEME_COLOR[army.theme], 4.2));
      army.banner.scale.setScalar(FIG_SCALE);
      this.group.add(army.banner);
    }
  }

  private makeActor(unit: UnitId | 'villager', side: Side, theme: Theme, i = 0): Actor {
    let f: Figure;
    let siege: Ram | Catapult | null = null;
    if (unit === 'ram') {
      siege = makeRam(theme);
      f = { g: new THREE.Group(), body: new THREE.Group(), weapon: null, arms: [], mounted: false, flyer: false };
      f.body.add(siege.g);
      f.g.add(f.body);
      f.g.scale.setScalar(FIG_SCALE);
    } else if (unit === 'catapult') {
      siege = makeCatapult(theme);
      f = { g: new THREE.Group(), body: new THREE.Group(), weapon: null, arms: [], mounted: false, flyer: false };
      f.body.add(siege.g);
      f.g.add(f.body);
      f.g.scale.setScalar(FIG_SCALE);
    } else if (unit === 'villager') f = makeVillager(theme, i);
    else f = makeFigure(unit, theme);
    f.g.visible = false;
    this.group.add(f.g);
    return {
      f, unit, side, role: unit === 'villager' ? 'melee' : roleOf(unit), theme, mode: 'formation', row: 0, col: 0, cols: 1,
      pos: new THREE.Vector3(), face: 0, moves: [], fallAt: null, fallen: false, fallT: 0, gone: false, fadeFrom: null,
      partner: null, lookAt: null, swingT: -9, shootT: -9, throwT: -9, cheerT: -9, castT: -9, nextAmbient: 0, carry: null,
      ph: Math.random() * 10, siege, flying: 0, home: null, post: false, partyFrom: 0, partyUntil: 0,
    };
  }

  private removeActor(a: Actor): void {
    this.group.remove(a.f.g);
    a.gone = true;
    if (a.siege) a.siege.g.traverse((o) => { if (o instanceof THREE.Mesh && !o.userData.sharedGeometry) o.geometry.dispose(); });
  }

  private dropArmy(a: Army): void {
    for (const x of a.actors) this.removeActor(x);
    if (a.banner) { this.group.remove(a.banner); a.banner.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); }
    if (a.battle) {
      for (const l of a.battle.ladders) { this.group.remove(l); disposeGeo(l); }
      for (const e of a.battle.extras) { this.group.remove(e); disposeGeo(e); }
      a.battle.ladders = [];
      a.battle.extras = [];
    }
    a.done = true;
  }

  /** Formation slot of an actor during the approach: rows behind a front line facing the village. */
  private formationPos(army: Army, a: Actor, r: number): THREE.Vector3 {
    const back = a.row * 2.7 + (a.unit === 'ram' || a.unit === 'catapult' ? 2.5 : 0);
    const lat = (a.col - (a.cols - 1) / 2) * 2.4 + (a.row % 2 ? 0.9 : 0);
    const p = clearOfWorks(spot(army.theta, r + back, lat));
    p.y = ground(p.x, p.z);
    return p;
  }

  // ---------- the alarm, the muster, the hiding place ----------

  private raiseAlarm(army: Army): void {
    const v = this.input!.village;
    const tower = v.buildings.watchtower ?? 0;
    if (this.alarmUntil > this.T) return;
    this.alarmUntil = this.T + 1e9;
    this.stage.sound.horn();
    if (tower > 0) {
      // a lookout jumps and waves on the watchtower deck
      const f = makeVillager(v.theme, 5, true);
      const tier = Math.min(5, 1 + Math.floor(tower / 4));
      const h = 7 + tier * 1.6;
      const sc = buildingScale('watchtower');
      const [x, z] = LAYOUT.watchtower;
      // on the open top of the old tower; out on the railed balcony (on the enemy's side) of a themed one
      const p = v.theme === 'classic'
        ? new THREE.Vector3(x, (h + 0.3) * sc, z)
        : new THREE.Vector3(
          x + Math.cos(army.theta) * 1.62 * sc,
          ((v.theme === 'sorcerer' ? h * 0.82 : v.theme === 'druid' ? h - 0.6 : v.theme === 'orc' || v.theme === 'dwarf' ? h + 0.19 : h * 0.9) + 0.11) * sc,
          z + Math.sin(army.theta) * 1.62 * sc,
        );
      f.g.position.copy(p);
      f.g.rotation.y = yawTo(Math.cos(army.theta), Math.sin(army.theta));
      this.group.add(f.g);
      this.lookout = { f, moves: [], job: 'lookout', carry: null, loopAt: 0, ph: 0, gone: false, hidden: false };
      this.walkers.push(this.lookout);
      this.alarm = alarmSprite();
      this.alarm.position.copy(p).add(new THREE.Vector3(0, 4.2, 0));
      this.group.add(this.alarm);
    }
    this.bellAt = this.T;
    this.muster(army);
    this.startHiding();
  }

  /** Without a watchtower the enemy is only noticed close up: a villager runs to the square ringing a bell. */
  private lateAlarm(army: Army): void {
    if (this.alarmUntil > this.T) return;
    const v = this.input!.village;
    this.alarmUntil = this.T + 1e9;
    const f = makeVillager(v.theme, 4, true);
    const from = doorstep('main', 3);
    const to = new THREE.Vector3(2.5, 0, 9.5);
    this.group.add(f.g);
    const w: Walker = { f, moves: [{ t0: this.T, t1: this.T + 3, from, to, hop: 0, run: true }], job: 'bell', carry: null, loopAt: 0, ph: 1, gone: false, hidden: false };
    this.walkers.push(w);
    this.lookout = w;
    this.alarm = alarmSprite();
    this.alarm.position.copy(from).add(new THREE.Vector3(0, 4, 0));
    this.group.add(this.alarm);
    this.stage.sound.horn();
    this.bellAt = this.T;
    this.muster(army);
    this.startHiding();
  }

  /** The defenders turn out: each kind from its own building to its post facing the enemy. */
  private muster(army: Army): void {
    const v = this.input!.village;
    if (army.scoutOnly) return; // for a few scouts nobody leaves their post
    const key = `${army.key}`;
    if (this.musterKey === key) return;
    this.clearDefenders();
    this.musterKey = key;
    // fight at the gate if the enemy comes from near it
    const theta = Math.abs(angDiff(army.theta, GATE_A)) < 0.55 ? GATE_A : army.theta;
    this.musterTheta = theta;
    const stacks: { units: Units; theme: Theme }[] = [{ units: v.units, theme: v.theme }, ...v.support];
    const cast: { u: UnitId; theme: Theme }[] = [];
    for (const s of stacks) {
      const units: Units = { ...s.units };
      delete units.ram; delete units.catapult; delete units.noble; delete units.scout;
      for (const [u, n] of representatives(units, 16)) for (let i = 0; i < n; i++) cast.push({ u, theme: s.theme });
    }
    const posts = wallGuardPosts(this.stage.wallLevel())
      .map((p) => ({ ...p, d: Math.abs(angDiff(Math.atan2(p.z, p.x), theta)) }))
      .sort((a, b) => a.d - b.d);
    let postI = 0, lineI = 0, backI = 0, horseI = 0;
    cast.forEach(({ u, theme }, i) => {
      const a = this.makeActor(u, 'def', theme, i);
      a.mode = 'scripted';
      a.home = ORIGIN[u] ?? 'barracks';
      const from = OUTSIDE.includes(a.home) ? spot(GATE_A, WALL_R - 3, (Math.random() - 0.5) * 4) : doorstep(a.home);
      from.x += (Math.random() - 0.5) * 2; from.z += (Math.random() - 0.5) * 2;
      let to: THREE.Vector3;
      const role = a.role;
      if (role === 'shooter' && u !== 'marcher' && postI < posts.length && posts[postI].d < 1.2) {
        const p = posts[postI++];
        to = new THREE.Vector3(p.x, p.y, p.z);
        a.post = true;
      } else if (role === 'shooter' || role === 'thrower') {
        to = freeSpot(spot(theta, WALL_R - 3.2, ((lineI++ % 7) - 3) * 2.2));
      } else if (a.f.mounted) {
        to = freeSpot(spot(theta, WALL_R - 13, ((horseI++ % 5) - 2) * 3));
      } else {
        to = freeSpot(spot(theta, WALL_R - 7.5 - Math.floor(backI / 6) * 2, ((backI % 6) - 2.5) * 2.2));
        backI++;
      }
      a.pos.copy(from);
      this.walk(a.moves, from, to, this.T + i * 0.12 + Math.random() * 0.8, a.f.mounted ? 7 : 4.5, true);
      a.lookAt = spot(theta, WALL_R + 20);
      this.defenders.push(a);
    });
    this.setQuiet(true);
  }

  private clearDefenders(): void {
    for (const a of this.defenders) this.removeActor(a);
    this.defenders.length = 0; // the same array the battle holds
    this.musterKey = '';
  }

  /** Where a defender goes when it is over: its own door, or out through the gate to the farm. */
  private homeSpot(a: Actor): THREE.Vector3 {
    const home = a.home ?? 'barracks';
    return OUTSIDE.includes(home) ? spot(GATE_A, WALL_R - 2, (Math.random() - 0.5) * 3) : doorstep(home);
  }

  /** Back home: down off the wall first, then along the roads, fading at the door. */
  private sendHome(a: Actor, t: number): void {
    const cur = a.f.g.position.clone();
    const last = a.moves[a.moves.length - 1];
    const from = last && last.t1 <= t ? last.to.clone() : cur;
    a.moves = a.moves.filter((m) => m.t1 <= t);
    if (a.post) {
      const down = spot(Math.atan2(from.z, from.x), WALL_R - 3, 0);
      a.moves.push({ t0: t, t1: t + 0.6, from, to: down, hop: 1, run: false });
      t += 0.6;
      from.copy(down);
      a.post = false;
    }
    const end = this.walk(a.moves, from, this.homeSpot(a), t, a.f.mounted ? 6 : 4.2, false);
    a.fadeFrom = end - 1;
    a.lookAt = null;
  }

  /** The enemy never came (the attack was called off): the alarm is over and everyone goes back. */
  private stoodDown(): void {
    if ([...this.armies.values()].some((a) => !a.done)) return;
    this.standDown();
    this.allClear();
    this.defenders.forEach((a, i) => { if (!a.fallen && !a.gone) this.sendHome(a, this.T + 0.4 + i * 0.1); });
    this.musterKey = '';
  }

  /** Villagers carry the stores into the hiding place until the enemy is at the gates. */
  private startHiding(): void {
    const v = this.input!.village;
    const n = hidingCrew(v.buildings.hiding ?? 0, v.hide, v.res);
    const kinds: ('wood' | 'clay' | 'iron')[] = ['wood', 'clay', 'iron'];
    for (let i = 0; i < n; i++) {
      const f = makeVillager(v.theme, i + 1);
      const s = sack(kinds[i % 3]);
      s.position.set(0, 1.55, -0.2);
      f.body.add(s);
      this.group.add(f.g);
      this.walkers.push({ f, moves: [], job: 'carry', carry: s, loopAt: this.T + i * 2.2, ph: i, gone: false, hidden: false });
    }
  }

  private stepWalkers(dt: number): void {
    const T = this.T;
    const hatch = doorstep('hiding', 0.6);
    const store = doorstep('warehouse', 4);
    for (const w of this.walkers) {
      if (w.gone) continue;
      const f = w.f;
      if (w.job === 'lookout') {
        // jumping up and down, arms waving over the head
        f.g.position.y += 0; // stands on the deck
        f.body.position.y = Math.abs(Math.sin(T * 9 + w.ph)) * 0.55;
        f.arms.forEach((arm, i) => { arm.rotation.z = (i === 0 ? 1 : -1) * (0.35 + Math.abs(Math.sin(T * 12 + i)) * 1.8); });
        continue;
      }
      if (w.job === 'bell') {
        this.follow(f, w.moves, T, dt, w.ph);
        if (T > (w.moves[0]?.t1 ?? 0)) {
          f.body.position.y = Math.abs(Math.sin(T * 8)) * 0.35;
          f.arms.forEach((arm, i) => { arm.rotation.z = (i === 0 ? 1 : -1) * (0.3 + Math.abs(Math.sin(T * 10 + i * 2)) * 1.4); });
        }
        if (this.alarm) this.alarm.position.copy(f.g.position).add(new THREE.Vector3(0, 4, 0));
        continue;
      }
      if (w.job === 'carry') {
        // warehouse -> hiding place, vanish down the hatch, come back for more
        if (w.hidden) continue;
        if (!w.moves.length && T >= w.loopAt) {
          w.moves = [];
          this.walk(w.moves, store.clone().add(new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5)), hatch.clone(), T, 4.5, true);
          f.g.visible = true;
          f.g.scale.setScalar(FIG_SCALE);
        }
        if (w.moves.length) {
          this.follow(f, w.moves, T, dt, w.ph);
          const end = w.moves[w.moves.length - 1].t1;
          if (T > end) {
            // down the hatch
            const k = Math.min(1, (T - end) / 0.5);
            f.g.scale.setScalar(FIG_SCALE * (1 - k));
            f.g.position.y = -k * 0.8;
            if (k >= 1) { w.moves = []; w.loopAt = T + 1.4; f.g.visible = false; }
          }
        }
        continue;
      }
      if (w.job === 'party') {
        this.follow(f, w.moves, T, dt, w.ph);
        const [a0, a1] = w.dance ?? [0, 0];
        if (T >= a0 && T < a1) {
          f.body.position.y = Math.abs(Math.sin(T * 8 + w.ph)) * 0.5;
          f.arms.forEach((arm, i) => { arm.rotation.z = (i === 0 ? 1 : -1) * (0.6 + Math.abs(Math.sin(T * 9 + w.ph + i)) * 1.6); });
          if (Math.sin(T * 0.9 + w.ph) > 0.3) f.g.rotation.y += dt * 5; // a twirl now and then
        } else f.arms.forEach((arm) => { arm.rotation.z *= 0.8; });
        if (T > w.loopAt) w.gone = true;
        continue;
      }
      if (w.job === 'bucket') this.stepBucket(w, dt);
    }
    this.walkers = this.walkers.filter((w) => {
      if (!w.gone) return true;
      this.dropWalker(w);
      return false;
    });
  }

  /** The alarm is over: the lookout climbs down, the haulers stay hidden until it is safe. */
  private standDown(): void {
    if (this.lookout) { this.lookout.gone = true; this.lookout = null; }
    this.dropAlarm();
    for (const w of this.walkers) if (w.job === 'carry') { w.hidden = true; w.f.g.visible = false; }
  }

  /** Coast is clear: the haulers climb out of the hiding place and go back to work. */
  private allClear(): void {
    const hatch = doorstep('hiding', 0.6);
    const store = doorstep('warehouse', 4);
    for (const w of this.walkers) {
      if (w.job !== 'carry') continue;
      if (w.carry) { w.f.body.remove(w.carry); w.carry = null; }
      w.hidden = false;
      w.job = 'bucket'; // reuse the walking, then they leave
      w.moves = [{ t0: this.T, t1: this.T + 4, from: hatch.clone(), to: store.clone(), hop: 0, run: false }];
      w.f.g.visible = true;
      w.f.g.scale.setScalar(FIG_SCALE);
      w.loopAt = this.T + 4.2;
      w.target = undefined;
    }
    this.alarmUntil = 0;
  }

  // ---------- the battle ----------

  private startBattle(army: Army, report: TheatreReport): void {
    const plan = planBattle(report.battle);
    const b = report.battle;
    // a noble train's later waves come in as reports of their own; they only add to the noble part
    army.kindsKey = 'battle';
    // the real army, as the report tells it
    const want = representatives(b.attUnits, 30);
    // a noble train's noblemen may still be coming in a later wave: keep the one already seen
    if (!want.some(([u]) => u === 'noble') && army.actors.some((a) => a.unit === 'noble')) want.push(['noble', 1]);
    const have = new Map<string, Actor[]>();
    for (const a of army.actors) (have.get(a.unit) ?? have.set(a.unit, []).get(a.unit)!).push(a);
    const keep: Actor[] = [];
    for (const [u, n] of want) {
      const list = have.get(u) ?? [];
      for (let i = 0; i < n; i++) {
        let a = list.shift();
        if (!a) {
          a = this.makeActor(u, 'att', army.theme);
          a.row = keep.length ? keep[keep.length - 1].row + 1 : 0;
          a.col = i;
          a.cols = n;
          a.pos.copy(this.formationPos(army, a, APPROACH.contact + 6));
        }
        keep.push(a);
      }
    }
    for (const a of army.actors) if (!keep.includes(a)) this.removeActor(a);
    army.actors = keep;
    army.scoutOnly = plan.scoutOnly;
    // make sure the defenders are out (the page may have opened just now)
    if (!plan.scoutOnly && this.musterKey !== army.key) {
      this.muster(army);
      for (const d of this.defenders) { const m = d.moves[d.moves.length - 1]; if (m) { m.t0 = this.T - 1; m.t1 = this.T; } }
    }
    if (!plan.scoutOnly) this.castDefenders(b);
    else this.castScouts(b);
    const theta = plan.scoutOnly ? army.theta : this.musterTheta;
    const u = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const v = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
    const P = new THREE.Vector3(u.x * WALL_R, 0, u.z * WALL_R);
    const battle: Battle = { plan, report, t0: this.T, P, u, v, theta, events: [], defenders: this.defenders, breached: false, ladders: [], ladLat: [], wallH: 0, extras: [], ended: false };
    army.battle = battle;
    for (const a of army.actors) { a.mode = 'scripted'; a.moves = []; }
    this.standDown();
    // hold the wall and the target building at their old levels until they are knocked down
    let held = false;
    if (plan.wall && plan.wall.after < plan.wall.before) { this.holds.wall = plan.wall.before; held = true; }
    if (plan.building && plan.building.after < plan.building.before) { this.holds[plan.building.id] = plan.building.before; held = true; }
    if (held) this.stage.holdsChanged();
    if (plan.scoutOnly) this.scriptScouts(army, battle);
    else this.scriptBattle(army, battle);
    battle.events.sort((a, b2) => a.t - b2.t);
    this.active = true;
  }

  /** The defenders as the report tells it (the real numbers, both home and support). */
  private castDefenders(b: BattleData): void {
    const want = new Map<UnitId, number>();
    const units: Units = { ...(b.defUnits ?? {}) };
    delete units.ram; delete units.catapult; delete units.noble; delete units.scout;
    for (const [u, n] of representatives(units, 24)) want.set(u, n);
    // drop figures for kinds that are not there after all
    const keep = this.defenders.filter((a) => {
      const n = want.get(a.unit as UnitId) ?? 0;
      if (n <= 0) { this.removeActor(a); return false; }
      want.set(a.unit as UnitId, n - 1);
      return true;
    });
    this.defenders.length = 0;
    this.defenders.push(...keep);
    // and add any missing ones straight at the back line
    const v = this.input!.village;
    let i = 0;
    for (const [u, n] of want) for (let k = 0; k < n; k++) {
      const a = this.makeActor(u, 'def', v.theme, i);
      a.mode = 'scripted';
      a.home = ORIGIN[u] ?? 'barracks';
      const to = freeSpot(spot(this.musterTheta, WALL_R - 9 - (i % 3) * 2, ((i % 7) - 3) * 2.2));
      a.pos.copy(to);
      a.moves.push({ t0: this.T - 1, t1: this.T, from: to.clone(), to, hop: 0, run: false });
      a.lookAt = spot(this.musterTheta, WALL_R + 20);
      this.defenders.push(a);
      i++;
    }
  }

  private castScouts(b: BattleData): void {
    this.clearDefenders();
    const v = this.input!.village;
    const n = b.defUnits?.scout ?? 0;
    for (const [u, k] of representatives({ scout: n }, 4)) for (let i = 0; i < k; i++) {
      const a = this.makeActor(u, 'def', v.theme, i);
      a.mode = 'scripted';
      a.home = 'main';
      a.pos.copy(doorstep('main', 2));
      this.defenders.push(a);
    }
  }

  private at(battle: Battle, t: number, run: () => void): void {
    const e = { t: battle.t0 + t, run };
    const i = battle.events.findIndex((x) => x.t > e.t);
    if (i < 0) battle.events.push(e);
    else battle.events.splice(i, 0, e);
  }

  /** Walk from a to b along the village roads (never through a house); returns when they get there. */
  private walk(moves: Move[], from: THREE.Vector3, to: THREE.Vector3, t0: number, speed: number, run: boolean, wall = true): number {
    const pts = route(from, to, wall);
    // up onto the wall: walk to its foot, then climb straight up
    const end = pts[pts.length - 1];
    if (end.y > ground(end.x, end.z) + 0.5) {
      const r = Math.hypot(end.x, end.z) || 1;
      pts.splice(pts.length - 1, 0, new THREE.Vector3((end.x * (r - 1.6)) / r, 0, (end.z * (r - 1.6)) / r));
    }
    // long legs over open ground follow its rise and fall
    const way: THREE.Vector3[] = [];
    let p = from.clone();
    pts.forEach((q0, i) => {
      const last = i === pts.length - 1;
      const q = q0.clone();
      if (!last) q.y = ground(q.x, q.z);
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      const n = last && q.y > p.y + 0.5 ? 1 : Math.max(1, Math.ceil(d / 5));
      for (let k = 1; k < n; k++) {
        const e = new THREE.Vector3(p.x + ((q.x - p.x) * k) / n, 0, p.z + ((q.z - p.z) * k) / n);
        e.y = ground(e.x, e.z);
        way.push(e);
      }
      way.push(q);
      p = q;
    });
    let t = t0;
    p = from.clone();
    way.forEach((q, i) => {
      const climb = i === way.length - 1 && q.y > p.y + 0.5;
      const dur = climb ? Math.max(0.6, (q.y - p.y) / 3) : Math.max(0.15, Math.hypot(q.x - p.x, q.z - p.z) / speed);
      moves.push({ t0: t, t1: t + dur, from: p.clone(), to: q, hop: 0, run, climb: climb ? q.y : undefined });
      t += dur;
      p = q;
    });
    return t;
  }

  private scriptBattle(army: Army, battle: Battle): void {
    const { plan, P, u, v, theta } = battle;
    const T0 = battle.t0;
    const wallNow = this.holds.wall ?? this.stage.wallLevel();
    const wallH0 = wallHeight(wallNow);
    const gate = Math.abs(angDiff(theta, GATE_A)) < 0.01;
    // the wall as it stands when the lines close: through the gate, over the rubble of a wall knocked flat, or up ladders
    let wallAt = wallNow;
    for (const h of plan.ramHits) if (h.level !== null && h.t < plan.meleeStart) wallAt = Math.min(wallAt, h.level);
    for (const c of plan.catShots) if (c.target === 'wall' && c.level !== null && c.land < plan.meleeStart + 0.5) wallAt = Math.min(wallAt, c.level);
    const wallH = wallHeight(wallAt);
    const needLadders = wallAt > 0 && !gate;
    const ladLat = needLadders ? [-2.6, 2.6] : [];
    battle.ladLat = ladLat;
    battle.wallH = wallH;
    const rnd = rngOf(army.key.length * 97 + plan.meleeStart * 13);
    // positions around the fight
    const outside = (d: number, lat: number) => spot(theta, WALL_R + d, lat);
    const inside = (d: number, lat: number) => spot(theta, WALL_R - d, lat);
    const atts = army.actors;
    const defs = this.defenders;
    // attackers: siege to their places, the rest press up to the wall
    let lineI = 0, shootI = 0, ramI = 0;
    const nRams = atts.filter((a) => a.unit === 'ram').length;
    const onLand = (p: THREE.Vector3) => { clearOfWorks(p); p.y = ground(p.x, p.z); return p; };
    for (const a of atts) {
      const from = a.pos.clone();
      let to: THREE.Vector3;
      // rams side by side, their heads just reaching the wall at full swing
      if (a.unit === 'ram') to = outside(5.2, (ramI++ - (nRams - 1) / 2) * 3.4);
      else if (a.unit === 'catapult') to = onLand(outside(20 + (shootI % 2) * 3, ((shootI++ % 3) - 1) * 6));
      else if (a.role === 'shooter' || a.role === 'caster') to = onLand(outside(10 + rnd() * 3, ((shootI++ % 7) - 3) * 2.3));
      else if (a.role === 'noble') to = outside(14, (rnd() - 0.5) * 4);
      else if (a.role === 'scout') to = onLand(outside(18, (rnd() - 0.5) * 8));
      else { to = outside(3.4 + (lineI % 3) * 1.4, ((lineI % 7) - 3) * 2.1); lineI++; }
      const d = from.distanceTo(to);
      // the rams are in place before their first blow
      a.moves = [{ t0: T0, t1: T0 + Math.max(0.6, Math.min(a.unit === 'ram' ? 2.0 : 2.2, d / 5)), from, to, hop: 0, run: true }];
      a.lookAt = inside(6, 0);
    }
    // fall times, from the report's losses
    const assign = (list: Actor[], side: Side) => {
      const byUnit = new Map<string, Actor[]>();
      for (const a of list) (byUnit.get(a.unit) ?? byUnit.set(a.unit, []).get(a.unit)!).push(a);
      let seed = side === 'att' ? 11 : 29;
      for (const [unit, group] of byUnit) {
        const share = plan.fall[side][unit as UnitId] ?? (plan.winner === side ? 0 : 1);
        const times = fallTimes(group.length, share, roleOf(unit as UnitId), plan, side, seed++);
        group.forEach((a, i) => { a.fallAt = times[i] !== null ? T0 + times[i]! : null; });
      }
    };
    assign(atts, 'att');
    assign(defs, 'def');
    // the melee lines: pair up the fighters
    const meleeRole = (a: Actor) => a.role === 'melee' || a.role === 'thrower' || (a.role === 'caster' && a.side === 'def' && a.unit !== 'sorcerer' && a.unit !== 'frost');
    const attM = atts.filter(meleeRole);
    const defM = defs.filter((a) => meleeRole(a) && !a.post);
    // the lines meet a few steps inside, so the attackers are seen pouring in through the gap
    const M = inside(needLadders ? 5 : 6.5, 0);
    attM.forEach((a, i) => {
      const lat = ((i % 7) - 3) * 1.8 + (Math.floor(i / 7) % 2) * 0.9;
      const spotA = M.clone().addScaledVector(u, 0.9 + Math.floor(i / 7) * 1.5).addScaledVector(v, lat);
      a.partner = defM.length ? defM[i % defM.length] : null;
      const start = T0 + plan.meleeStart + (i % 5) * 0.12;
      const last = a.moves[a.moves.length - 1];
      const from = last.to.clone();
      if (needLadders && a.f.mounted) {
        // riders cannot climb: they take the wall at a leap
        const run = outside(4.5, lat);
        const land = inside(3.5, lat);
        a.moves.push({ t0: start, t1: start + 0.7, from, to: run, hop: 0, run: true });
        a.moves.push({ t0: start + 0.9 + (i % 4) * 0.3, t1: start + 2.0 + (i % 4) * 0.3, from: run, to: land, hop: wallH + 2.2, run: true });
        a.moves.push({ t0: start + 2.1 + (i % 4) * 0.3, t1: start + 2.8 + (i % 4) * 0.3, from: land, to: spotA, hop: 0, run: true });
      } else if (needLadders) {
        const lat2 = ladLat[i % 2];
        const base = outside(1.1, lat2);
        const top = spot(theta, WALL_R - 0.2, lat2); top.y = wallH + 0.3;
        const down = inside(1.6, lat2);
        a.moves.push({ t0: start, t1: start + 0.8, from, to: base, hop: 0, run: true });
        a.moves.push({ t0: start + 0.8 + (i % 4) * 0.35, t1: start + 1.8 + (i % 4) * 0.35, from: base, to: top, hop: 0, run: false, climb: wallH + 0.3 });
        a.moves.push({ t0: start + 1.9 + (i % 4) * 0.35, t1: start + 2.5 + (i % 4) * 0.35, from: top, to: down, hop: 0.8, run: true });
        a.moves.push({ t0: start + 2.6 + (i % 4) * 0.35, t1: start + 3.2 + (i % 4) * 0.35, from: down, to: spotA, hop: 0, run: true });
      } else if (gate && wallAt > 0) {
        // in through the gate, a few abreast
        const gOut = outside(1.5, lat * 0.4), gIn = inside(1.5, lat * 0.4);
        a.moves.push({ t0: start, t1: start + 0.9, from, to: gOut, hop: 0, run: true });
        a.moves.push({ t0: start + 0.9, t1: start + 1.4, from: gOut, to: gIn, hop: 0, run: true });
        a.moves.push({ t0: start + 1.4, t1: start + 2.1, from: gIn, to: spotA, hop: 0, run: true });
      } else {
        a.moves.push({ t0: start, t1: start + 1.8, from, to: spotA, hop: 0, run: true });
      }
    });
    if (needLadders) {
      for (const lat2 of ladLat) {
        const l = ladder(wallH + 1.2);
        const base = outside(1.3, lat2);
        l.position.copy(base);
        // turned to face the wall, then leaned in against it
        l.rotation.order = 'YXZ';
        l.rotation.y = yawTo(-u.x, -u.z);
        l.rotation.x = 0.28;
        l.scale.setScalar(1.05);
        this.group.add(l);
        battle.ladders.push(l);
      }
    }
    defM.forEach((a, i) => {
      const lat = ((i % 7) - 3) * 1.8 + (Math.floor(i / 7) % 2) * 0.9;
      const spotD = M.clone().addScaledVector(u, -0.9 - Math.floor(i / 7) * 1.5).addScaledVector(v, lat);
      a.partner = attM.length ? attM[i % attM.length] : null;
      const start = T0 + plan.meleeStart + (a.f.mounted ? 0.6 : 0.2) + (i % 5) * 0.1;
      const last = a.moves[a.moves.length - 1];
      a.moves.push({ t0: start, t1: start + (a.f.mounted ? 1.2 : 1.6), from: last ? last.to.clone() : a.pos.clone(), to: spotD, hop: 0, run: true });
    });
    // everyone ranged keeps shooting at someone
    for (const a of [...atts, ...defs]) a.nextAmbient = T0 + 0.6 + rnd() * 1.2;
    // rams: blow after blow, the wall coming down by the levels it really lost
    const rams = atts.filter((a) => a.unit === 'ram');
    plan.ramHits.forEach((h, i) => {
      this.at(battle, h.t, () => {
        const pick = rams[i % Math.max(1, rams.length)];
        const ram = pick && !pick.fallen && !pick.gone ? pick : rams.find((r) => !r.fallen && !r.gone);
        if (ram?.siege) (ram.siege as Ram).log.userData.hitAt = this.T;
        const hit = ram ? ram.f.g.position.clone().addScaledVector(u, -4.3) : P.clone().addScaledVector(u, 0.9);
        hit.y = Math.max(1.2, wallH0 * 0.5);
        const was = this.holds.wall ?? wallNow;
        this.fx.debris(hit, h.level !== null ? 9 : 3, WALL_COLOR(was), u.clone().multiplyScalar(-1).add(new THREE.Vector3(0, 0.4, 0)));
        this.fx.dust(hit, h.level !== null ? 7 : 3);
        this.fx.sparks(hit, 4, 0xffd27a);
        // (on a wall glazed with the Frost Queen's rime the blow mostly shatters ice)
        if (plan.effects.includes('rime')) { this.fx.debris(hit, 5, 0xdff4ff, u.clone().multiplyScalar(-1)); this.fx.magic(hit, 6, 0xcff4ff); }
        this.sfx('thud', 0.1);
        if (h.level !== null && this.lowerWall(h.level)) {
          if (!battle.breached) { battle.breached = true; this.lay(hit, 6, WALL_COLOR(was), 5); }
          else this.lay(hit, 2, WALL_COLOR(was), 4);
        }
      });
    });
    // catapults: load, fling, and the target burns
    const cats = atts.filter((a) => a.unit === 'catapult');
    plan.catShots.forEach((s, i) => {
      this.at(battle, s.fire, () => {
        const pick = cats[i % Math.max(1, cats.length)];
        const cat = pick && !pick.fallen && !pick.gone ? pick : cats.find((c) => !c.fallen && !c.gone);
        const aim = s.target === 'wall' ? { pos: P.clone().setY(wallH0), radius: 3 } : this.stage.aim(s.target);
        if (!cat?.siege || !aim) {
          // nobody left to loose it (or nothing to aim at): the damage it did is done all the same
          this.at(battle, s.land, () => this.shotLands(battle, s, null));
          return;
        }
        const c = cat.siege as Catapult;
        c.arm.userData.fireAt = this.T;
        // the load leaves the cup at the top of the swing
        this.at(battle, s.fire + 0.2, () => {
          const from = new THREE.Vector3();
          c.ammo.getWorldPosition(from);
          c.ammo.visible = false;
          this.sfx('whoosh', 0.2);
          this.fx.lob(from, aim.pos, Math.max(0.4, s.land - s.fire - 0.2), c.shot, shotFire(c.shot).flame, () => this.shotLands(battle, s, c.shot, aim.pos));
        });
        this.at(battle, s.fire + 1.4, () => { c.ammo.visible = true; });
      });
    });
    // heroes and their gifts
    const fx = plan.effects;
    if (fx.includes('thornwall')) this.at(battle, 0.4, () => this.growThorns(P, v));
    if (fx.includes('sneak')) this.at(battle, 1.0, () => { const p = P.clone(); p.y = 0.6; this.fx.dust(p, 16, 0x7a6a4a); this.fx.debris(p, 8, 0x6a5a3a); this.sfx('thud', 0.2); });
    // the Orc King's warcry: a roar that shakes the dust up in a ring around him
    if (fx.includes('warcry')) this.at(battle, 0.6, () => {
      const k = atts.find((a) => a.unit === 'orc' && !a.fallen) ?? atts[0];
      if (!k) return;
      const c = k.pos.clone();
      this.fx.flash(c.clone().setY(c.y + 1.6), 4, 0xff5a2a, 0.6);
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        this.fx.dust(c.clone().add(new THREE.Vector3(Math.cos(ang) * 2.4, 0.3, Math.sin(ang) * 2.4)), 3, 0x8a7a5a);
      }
      this.sfx('horn', 0.3);
    });
    // the Saurian King's pack: a shriek goes up as his riders close, and they burst forward in a spray of dust and torn leaves
    if (fx.includes('pack')) {
      const side = atts.some((a) => a.unit === 'saurian') ? atts : defs.some((a) => a.unit === 'saurian') ? defs : atts;
      for (const [dt, big] of [[Math.max(0.3, plan.meleeStart - 0.7), true], [plan.meleeStart + 0.25, false]] as [number, boolean][]) {
        this.at(battle, dt, () => {
          const king = side.find((a) => a.unit === 'saurian' && !a.fallen);
          if (king && big) {
            this.fx.flash(king.pos.clone().setY(king.pos.y + 2.6), 3.4, 0x8affc0, 0.5);
            this.fx.magic(king.pos.clone().setY(king.pos.y + 2.2), 8, 0x7affb0);
          }
          for (const a of side.filter((x) => x.f.mounted && !x.fallen && !x.gone).slice(0, 10)) {
            const p = a.pos.clone().setY(a.pos.y + 0.3);
            this.fx.dust(p, big ? 4 : 3, 0x8a7a52);
            this.fx.debris(p.setY(p.y + 0.6), big ? 4 : 2, Math.random() < 0.5 ? 0x3f8a32 : 0x6aa83a);
          }
          if (big) this.sfx('shriek', 0.3);
        });
      }
    }
    // the Frost Queen's rime: ice glazes the wall before the rams reach it (and it shatters off with their blows)
    if (fx.includes('rime') && wallNow > 0) this.at(battle, 0.5, () => this.glazeWall(P, u, wallNow));
    // her frostbite: bursts of frost break over the horsemen as they charge, and a cold flash from her staff
    if (fx.includes('frostbite')) {
      const queenAttacks = atts.some((a) => a.unit === 'frost');
      const riders = (queenAttacks ? defs : atts).filter((a) => a.f.mounted);
      for (let k = 0; k < 3; k++) this.at(battle, Math.max(0.4, plan.meleeStart - 1.4 + k * 0.7), () => {
        const q = [...atts, ...defs].find((a) => a.unit === 'frost' && !a.fallen);
        if (q && k === 0) { this.fx.flash(q.pos.clone().setY(q.pos.y + 2.6), 5, 0x9fe6ff, 0.6); this.fx.magic(q.pos.clone().setY(q.pos.y + 2.4), 12, 0xdff6ff); }
        for (const a of riders) {
          if (a.fallen || Math.random() > 0.75) continue;
          const p = a.pos.clone().setY(a.pos.y + 1.5);
          this.fx.flash(p, 3.4, 0x7fd0ff, 0.5);
          this.fx.magic(p, 10, 0x8fd8ff);
          this.fx.debris(p, 5, 0x7cc4f0);
          this.fx.smoke(p, 0xdff0fa, 1, 0.6);
        }
        if (k === 0) this.sfx('whoosh', 0.25);
      });
    }
    // the Forgelord's bolt-throwers: bolts streak from the wall's towers into the attackers before the lines meet,
    // those who fall early going down to them, and more thudding into the ground among the rest
    if (fx.includes('volley')) {
      const from = boltThrowers(wallNow, theta, WALL_R, GATE_A, 0.12);
      const aimAt = (a: Actor, t: number) => {
        const m = a.moves.find((mv) => mv.t1 >= t) ?? a.moves[a.moves.length - 1];
        const p = m ? m.from.clone().lerp(m.to, Math.max(0, Math.min(1, (t - m.t0) / Math.max(0.01, m.t1 - m.t0)))) : a.pos.clone();
        return p.setY(p.y + 1.0);
      };
      const bolt = (o: THREE.Vector3, to: THREE.Vector3, dur: number) => {
        // (big and bright enough to read at the village's usual zoom)
        this.fx.flash(o, 5, 0xffc060, 0.35);
        this.fx.sparks(o, 8, 0xffd27a);
        this.fx.spear(o, to, dur);
        this.fx.bolt(o, to, dur, 0xffa24a, () => { this.fx.flash(to, 4.2, 0xffa24a, 0.4); this.fx.sparks(to, 14, 0xffc060); this.fx.dust(to, 5, 0x6a625a); }, 4.2);
        this.sfx('twang', 0.12);
      };
      if (from.length) {
        atts.filter((a) => a.fallAt !== null && a.fallAt < T0 + plan.meleeStart && !a.siege).slice(0, 8).forEach((a, i) => {
          a.killScheduled = true;
          const dur = 0.5;
          this.at(battle, Math.max(0.15, a.fallAt! - T0 - dur), () => bolt(from[i % from.length], aimAt(a, a.fallAt!), dur));
        });
        for (let i = 0; i < 9; i++) this.at(battle, 0.2 + Math.floor(i / 3) * 0.5 + (i % 3) * 0.08, () => {
          const alive = atts.filter((a) => !a.fallen && !a.gone);
          const tgt = alive[Math.floor(Math.random() * alive.length)];
          if (!tgt) return;
          const to = aimAt(tgt, this.T + 0.5);
          to.x += (Math.random() - 0.5) * 3; to.z += (Math.random() - 0.5) * 3; to.y = ground(to.x, to.z) + 0.1;
          bolt(from[i % from.length], to, 0.5);
        });
      }
    }
    if (fx.includes('ward')) this.at(battle, 0.5, () => { for (const d of defs) this.fx.magic(d.pos.clone().setY(d.pos.y + 1.5), 3, 0x8fd0ff); });
    // the Djinn's desert wind: sand whirls up round his army and spirals over it, sparks of his lamp's blue among it
    for (const side of ['att', 'def'] as Side[]) {
      const list = side === 'att' ? atts : defs;
      if (!list.some((a) => a.unit === 'djinn')) continue;
      for (let k = 0; k < 22; k++) this.at(battle, 0.15 + k * 0.1, () => {
        const live = list.filter((a) => !a.fallen && !a.gone);
        if (!live.length) return;
        const c = live.reduce((s, a) => s.add(a.pos), new THREE.Vector3()).multiplyScalar(1 / live.length);
        // a double helix of sand, winding up round the host
        for (const half of [0, Math.PI]) {
          const ang = k * 0.8 + half, rad = 3.4 + (k % 3) * 0.6;
          const p = c.clone().add(new THREE.Vector3(Math.cos(ang) * rad, 0.4 + k * 0.26, Math.sin(ang) * rad));
          this.fx.dust(p, 4, k % 2 ? 0xc89a58 : 0xe8cf94);
        }
        if (k % 3 === 0) {
          const dj = list.find((a) => a.unit === 'djinn' && !a.fallen);
          if (dj) this.fx.magic(dj.pos.clone().setY(dj.pos.y + 1.8), 3, 0x7ab8ff);
        }
      });
      this.at(battle, 0.1, () => this.sfx('whoosh', 0.2));
    }
    // the Djinn's tribute: when his side wins, gold showers down over the victors
    const trib = battle.report.battle.tribute;
    if (trib) {
      const side: Side = trib.side === 'attacker' ? 'att' : 'def';
      for (let k = 0; k < 5; k++) this.at(battle, plan.outcomeAt + 0.2 + k * 0.35, () => {
        const live = (side === 'att' ? atts : defs).filter((a) => !a.fallen && !a.gone);
        for (const a of live.slice(0, 16)) if (Math.random() < 0.8) this.fx.gold(a.pos.clone().setY(a.pos.y + 5 + Math.random()), 8);
        const dj = live.find((a) => a.unit === 'djinn');
        if (dj && k === 0) { this.fx.flash(dj.pos.clone().setY(dj.pos.y + 2.4), 8, 0xffd35a, 1.0); this.fx.magic(dj.pos.clone().setY(dj.pos.y + 2), 16, 0xffd35a); }
      });
      const worth = trib.res.wood + trib.res.clay + trib.res.iron;
      if (worth > 0) this.at(battle, plan.outcomeAt + 1.2, () => this.say(`${fmtRes(worth)} tribute`, '#ffd35a', doorstep(side === 'att' ? 'main' : 'statue', 3).setY(12), 3.5));
    }
    for (const side of ['att', 'def'] as Side[]) {
      if (!fx.includes(`dread-${side}`)) continue;
      const enemies = side === 'att' ? defs : atts;
      for (let k = 0; k < 8; k++) this.at(battle, 0.5 + k * 0.7, () => { for (const e of enemies) if (!e.fallen && Math.random() < 0.3) this.fx.magic(e.pos.clone().setY(e.pos.y + 1.8), 2, 0x2f7a4a); });
    }
    if (plan.healed) {
      const side = plan.healed.side;
      this.at(battle, plan.meleeEnd + 0.3, () => {
        const list = (side === 'att' ? atts : defs).filter((a) => a.fallen && !a.gone);
        const n = Math.min(list.length, Math.max(1, Math.round(list.length * 0.25)));
        for (const a of list.slice(0, n)) {
          a.fallen = false; a.fallAt = null;
          a.f.g.userData.falling = false;
          a.f.body.rotation.set(0, 0, 0);
          a.f.body.scale.y = 1;
          this.fx.magic(a.pos.clone().setY(a.pos.y + 1), 10, 0xffe38a);
          this.fx.flash(a.pos.clone().setY(a.pos.y + 1.5), 4, 0xffe38a, 0.8);
        }
      });
    }
    if (plan.risen && plan.risen.n > 0) {
      const side = plan.risen.side;
      this.at(battle, plan.meleeEnd - 0.5, () => {
        const corpses = (side === 'att' ? defs : atts).filter((a) => a.fallen && !a.gone);
        const n = Math.min(3, Math.max(1, corpses.length));
        for (let k = 0; k < n; k++) {
          const at = (corpses[k]?.pos ?? M).clone();
          at.x += (Math.random() - 0.5) * 2; at.z += (Math.random() - 0.5) * 2;
          const s = this.makeActor('spear', side, 'necromancer');
          s.mode = 'scripted';
          s.pos.copy(at).setY(at.y - 2.4);
          s.moves = [{ t0: this.T, t1: this.T + 1.4, from: s.pos.clone(), to: at, hop: 0, run: false }];
          s.lookAt = inside(10, 0);
          (side === 'att' ? atts : defs).push(s);
          this.fx.flash(at.clone().setY(at.y + 0.5), 5, 0x5cff9a, 1);
          this.fx.magic(at, 14, 0x5cff9a);
        }
      });
    }
    // the outcome (which also sets when it all ends)
    this.at(battle, plan.outcomeAt, () => this.outcome(army, battle));
  }

  /** A few scouts slip in; the village's own scouts go after them. */
  private scriptScouts(army: Army, battle: Battle): void {
    const { plan, u } = battle;
    const T0 = battle.t0;
    const centre = doorstep('main', 2);
    army.actors.forEach((a, i) => {
      const fly = a.f.flyer ? 7 + (i % 3) : 0;
      const from = a.pos.clone();
      const mid = spot(army.theta, WALL_R - 6, (i - 1) * 4); mid.y += fly;
      const over = centre.clone().add(new THREE.Vector3((i - 1) * 3, fly, 3));
      a.moves = [
        { t0: T0, t1: T0 + 2.4, from, to: mid, hop: fly ? 0 : 0.3, run: true },
        { t0: T0 + 2.4, t1: T0 + 4.6, from: mid, to: over, hop: 0, run: true },
      ];
      a.flying = fly;
      a.lookAt = centre;
    });
    this.defenders.forEach((d, i) => {
      const fly = d.f.flyer ? 8 : 0;
      const target = army.actors[i % Math.max(1, army.actors.length)];
      const to = centre.clone().addScaledVector(u, 5).add(new THREE.Vector3((i - 1) * 2.5, fly, 0));
      d.moves = [{ t0: T0 + 1.2, t1: T0 + 3.4, from: d.pos.clone(), to, hop: 0, run: true }];
      d.flying = fly;
      d.partner = target ?? null;
      if (target) target.partner = d;
    });
    const assign = (list: Actor[], side: Side) => {
      const times = fallTimes(list.length, plan.fall[side].scout ?? (plan.winner === side ? 0 : 1), 'scout', plan, side, side === 'att' ? 5 : 7);
      list.forEach((a, i) => { a.fallAt = times[i] !== null ? T0 + times[i]! : null; });
    };
    if (this.defenders.length) { assign(army.actors, 'att'); assign(this.defenders, 'def'); }
    this.at(battle, plan.outcomeAt, () => this.outcome(army, battle));
  }

  private laterWave(army: Army, r: TheatreReport): void {
    const b = army.battle;
    if (!b) return;
    // the last wave's loyalty is the one that counts
    b.plan.loyalty = r.battle.loyalty ?? b.plan.loyalty;
    b.plan.conquered = b.plan.conquered || !!r.battle.conquered;
    b.plan.nobles += Math.max(0, (r.battle.attUnits.noble ?? 0) - (r.battle.attLost?.noble ?? 0));
  }

  private outcome(army: Army, battle: Battle): void {
    const { plan, theta } = battle;
    const T = this.T;
    const alive = (list: Actor[]) => list.filter((a) => !a.fallen && !a.gone);
    const outside = (d: number, lat: number) => spot(theta, WALL_R + d, lat);
    const inside = (d: number, lat: number) => spot(theta, WALL_R - d, lat);
    if (plan.winner === 'att') {
      if (!army.replay && !army.scoutOnly) this.lostAt = this.input?.now ?? 0;
      const survivors = alive(army.actors);
      const wallUp = (this.holds.wall ?? this.stage.wallLevel()) > 0;
      // off the way they came: back over the ladders, or out through the breach or the gate
      const leave = (a: Actor, from: THREE.Vector3, t: number, speed: number) => {
        const exit = spot(army.theta, APPROACH.edge + 8, (Math.random() - 0.5) * 10);
        let p = from;
        if (battle.ladLat.length && wallUp) {
          const lat = battle.ladLat[Math.floor(Math.random() * battle.ladLat.length)];
          if (a.f.mounted) {
            const run = inside(3.5, lat), land = outside(4.5, lat);
            t = this.walk(a.moves, p, run, t, speed, false);
            a.moves.push({ t0: t, t1: t + 1.1, from: run, to: land, hop: battle.wallH + 2.2, run: true });
            t += 1.1;
            p = land;
          } else {
            const foot = inside(1.6, lat), top = spot(theta, WALL_R - 0.2, lat), base = outside(1.1, lat);
            top.y = battle.wallH + 0.3;
            t = this.walk(a.moves, p, foot, t, speed, false);
            a.moves.push({ t0: t, t1: t + 0.6, from: foot, to: top, hop: 0.8, run: false });
            a.moves.push({ t0: t + 0.7, t1: t + 1.7, from: top, to: base, hop: 0, run: false, climb: -1 });
            t += 1.7;
            p = base;
          }
        }
        t = this.walk(a.moves, p, exit, t, speed, false, wallUp);
        a.lookAt = null;
        a.fadeFrom = t - 3;
      };
      const out = (a: Actor, delay: number, via?: THREE.Vector3) => {
        const from = a.moves.length ? a.moves[a.moves.length - 1].to.clone() : a.pos.clone();
        const speed = a.f.mounted ? 6 : 4.6;
        let t = T + delay;
        let p = from;
        if (via) {
          t = this.walk(a.moves, from, via, t, speed, false);
          if (a.carry) a.carry.userData.showAt = t;
          t += 1.2;
          p = via;
        }
        leave(a, p, t, speed);
      };
      let noblesGo = false;
      if (plan.conquered || plan.nobles > 0) {
        // the noblemen march to the headquarters and plant the banner
        const nobles = survivors.filter((a) => a.unit === 'noble');
        const hq = doorstep('main', 5);
        let arrive = T;
        nobles.forEach((a, i) => {
          const from = a.moves.length ? a.moves[a.moves.length - 1].to.clone() : a.pos.clone();
          const to = hq.clone().add(new THREE.Vector3((i - (nobles.length - 1) / 2) * 1.8, 0, 0));
          arrive = Math.max(arrive, this.walk(a.moves, from, to, T, 5.5, false));
          a.lookAt = doorstep('main', 0);
        });
        this.at(battle, arrive - battle.t0 + 0.2, () => {
          const pole = withTheme(army.theme, () => standard(THEME_COLOR[army.theme], 6));
          pole.scale.setScalar(FIG_SCALE);
          pole.position.copy(hq).add(new THREE.Vector3(0, 0, 1.5));
          this.group.add(pole);
          battle.extras.push(pole);
          this.fx.flash(pole.position.clone().setY(6), 8, plan.conquered ? 0xffd35a : 0xfff0c0, 1.2);
          this.fx.magic(pole.position.clone().setY(3), 18, 0xffd35a);
          const L = plan.loyalty;
          const text = plan.conquered ? 'Conquered!' : L ? `Loyalty ${Math.max(0, Math.round(L.before))} → ${Math.max(0, Math.round(L.after))}` : '';
          if (text) this.say(text, plan.conquered ? '#ffd35a' : '#ffe9c2', hq.clone().setY(12), 5);
          if (plan.conquered) this.sfx('fanfare', 1);
          else this.sfx('horn', 1);
        });
        // they have made their point: after the banner they leave with the rest
        if (!plan.conquered) nobles.forEach((a, i) => out(a, arrive - T + 2 + i * 0.3));
        noblesGo = true;
      }
      if (plan.conquered) {
        // the rest of the army stays: this is their village now
        for (const a of survivors) if (a.unit !== 'noble') a.lookAt = null;
      } else {
        // the loot: some go by the warehouse for it, then everyone leaves the way they came
        const carriers = survivors.filter((a) => a.role !== 'ram' && a.role !== 'catapult' && a.unit !== 'noble' && a.role !== 'scout');
        const sacks = plan.loot > 0 ? Math.min(carriers.length, 1 + Math.round(Math.log10(plan.loot + 1) * 1.2)) : 0;
        const store = doorstep('warehouse', 5);
        const kinds: ('wood' | 'clay' | 'iron')[] = ['wood', 'clay', 'iron'];
        survivors.forEach((a, i) => {
          if (a.unit === 'noble' && noblesGo) return;
          const takes = carriers.indexOf(a);
          if (takes >= 0 && takes < sacks) {
            const sk = sack(kinds[takes % 3]);
            sk.position.set(0, a.f.mounted ? 2.4 : 1.55, -0.25);
            a.carry = sk;
            a.carry.visible = false;
            a.f.body.add(sk);
            out(a, 0.3 + i * 0.1, freeSpot(store.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4))));
          } else if (a.role !== 'ram' && a.role !== 'catapult') out(a, 0.5 + i * 0.08);
        });
        if (plan.loot > 0) this.at(battle, plan.outcomeAt + 3, () => this.say(`${fmtRes(plan.loot)} plundered`, '#ffe9c2', store.clone().setY(10), 3.5));
        // the siege engines roll back out too
        for (const a of army.actors) if ((a.unit === 'ram' || a.unit === 'catapult') && !a.fallen && !a.gone) {
          const from = a.moves.length ? a.moves[a.moves.length - 1].to.clone() : a.pos.clone();
          const end = this.walk(a.moves, from, spot(army.theta, APPROACH.edge + 6, (Math.random() - 0.5) * 6), T + 1, 4, false);
          a.fadeFrom = end - 2;
        }
      }
    } else {
      // the defenders cheer, then go back where they came from; if that was the last of it, to the square first
      const party = !army.scoutOnly && this.partyTime(army);
      alive(this.defenders).forEach((a, i) => {
        a.cheerT = T + i * 0.05;
        if (party) this.toParty(a, i, T + 2.6 + i * 0.06, T + PARTY_S + (i % 3) * 0.3);
        else this.sendHome(a, T + 3 + i * 0.15);
      });
      this.sfx('cheer', 1);
      if (army.scoutOnly) this.say('Scouts driven off', '#ffe9c2', doorstep('main', 2).setY(11), 3.5);
      if (party) this.party(battle, T);
    }
    // buckets for the fires
    this.at(battle, plan.outcomeAt + 1.2, () => this.bucketBrigade());
    let latest = T;
    for (const a of [...army.actors, ...this.defenders]) if (!a.fallen && !a.gone && a.moves.length) latest = Math.max(latest, a.moves[a.moves.length - 1].t1);
    const end = plan.conquered ? plan.end + 6 : plan.end;
    this.at(battle, Math.max(end, Math.min(latest - battle.t0 + 0.6, plan.outcomeAt + 40)), () => this.endBattle(army, battle));
  }

  /** Is this the end of it? No other army on its way (or due soon), and none got the better of us lately. */
  private partyTime(army: Army): boolean {
    if ([...this.armies.values()].some((a) => a !== army && !a.done)) return false;
    if (army.replay) return true;
    const now = this.input?.now ?? 0;
    if (now - this.lostAt < PARTY_QUIET) return false;
    return !(this.input?.incoming ?? []).some((c) => !army.ids.has(c.id) && c.arrive >= now - TRAIN_GAP && c.arrive - now < PARTY_QUIET);
  }

  /** A defender joins the party in the square, then goes home. */
  private toParty(a: Actor, i: number, t: number, until: number): void {
    const cur = a.f.g.position.clone();
    const last = a.moves[a.moves.length - 1];
    let from = last && last.t1 <= t ? last.to.clone() : cur;
    a.moves = a.moves.filter((m) => m.t1 <= t);
    if (a.post) {
      const down = spot(Math.atan2(from.z, from.x), WALL_R - 3, 0);
      a.moves.push({ t0: t, t1: t + 0.6, from, to: down, hop: 1, run: false });
      t += 0.6;
      from = down;
      a.post = false;
    }
    const arrive = this.walk(a.moves, from, partySpot(i), t, a.f.mounted ? 6 : 4.6, true);
    a.partyFrom = arrive;
    a.partyUntil = until;
    this.sendHome(a, Math.max(until, arrive + 2));
    a.lookAt = PARTY_C.clone();
  }

  /** Victory! The villagers pour out of their doors, everyone dances, and fireworks go up over the square. */
  private party(battle: Battle, T: number): void {
    const v = this.input?.village;
    if (!v) return;
    const t0 = T - battle.t0;
    this.at(battle, t0 + 2.4, () => {
      this.say(v.depot ? 'The cache holds!' : 'Victory!', '#ffd35a', PARTY_C.clone().setY(14), 4.5);
      this.sfx('fanfare', 1);
    });
    const doors: BuildingId[] = ['main', 'warehouse', 'market', 'smithy', 'academy', 'rally', 'barracks', 'stable'];
    for (let i = 0; i < (v.depot ? 0 : 12); i++) {
      const f = makeVillager(v.theme, i, true);
      const w: Walker = { f, moves: [], job: 'party', carry: null, loopAt: 0, ph: i * 0.7, gone: false, hidden: false };
      const door = doorstep(doors[i % doors.length], 3.2);
      const arrive = this.walk(w.moves, door, partySpot(i + 30), T + 1.5 + i * 0.25, 4.2, true);
      const until = T + PARTY_S + (i % 4) * 0.4;
      w.dance = [arrive, until];
      w.loopAt = this.walk(w.moves, w.moves[w.moves.length - 1].to.clone(), door, until, 3.8, false);
      f.g.visible = false;
      this.group.add(f.g);
      this.walkers.push(w);
    }
    // fireworks over the square, in every colour and the village's own
    const cols = [0xffd35a, 0xff6a5a, 0x7ad0ff, THEME_COLOR[v.theme], 0xb58cff, 0x9aff8a, 0xffffff];
    for (let k = 0; k < 18; k++) {
      this.at(battle, t0 + 3 + k * 0.5 + Math.random() * 0.3, () => {
        const c = cols[k % cols.length];
        const from = PARTY_C.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 1, (Math.random() - 0.5) * 8));
        const to = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 14, 17 + Math.random() * 9, (Math.random() - 0.5) * 14));
        this.sfx('whoosh', 0.25);
        this.fx.bolt(from, to, 0.85, c, () => {
          this.fx.firework(to, c);
          this.sfx('boom', 0.35);
        });
      });
    }
  }

  private endBattle(army: Army, battle: Battle): void {
    battle.ended = true;
    // the fallen are carried off; everyone else walks off stage
    for (const a of [...army.actors, ...this.defenders]) if (!a.gone && a.fadeFrom === null) a.fadeFrom = this.T;
    for (const l of battle.ladders) { this.group.remove(l); disposeGeo(l); }
    battle.ladders = [];
    army.done = true;
    // another army waiting at the wall takes it from here; otherwise it is all over
    if ([...this.armies.values()].some((a) => a !== army && !a.done)) return;
    if (Object.keys(this.holds).length) { this.holds = {}; this.stage.holdsChanged(); }
    this.allClear();
  }

  /** The wall comes down to `level` (never back up): the ring shakes, and the archers on it step down to the lower walk or the ground. */
  private lowerWall(level: number): boolean {
    const cur = this.holds.wall ?? this.stage.wallLevel();
    if (level >= cur) return false;
    if (wallTier(level) !== wallTier(cur)) this.crumble(WALL_COLOR(cur));
    this.holds.wall = level;
    this.stage.holdsChanged();
    // nothing left to lean a ladder on
    if (level <= 0) for (const a of this.armies.values()) {
      for (const l of a.battle?.ladders ?? []) { this.fx.debris(l.position.clone().setY(1.5), 5, 0x7a5230); this.group.remove(l); disposeGeo(l); }
      if (a.battle) a.battle.ladders = [];
    }
    const posts = wallTier(level) >= 2 ? wallGuardPosts(level) : [];
    for (const d of this.defenders) {
      if (!d.post) continue;
      const from = d.f.g.position.clone();
      const near = posts.length
        ? posts.reduce((b, q) => (Math.hypot(q.x - from.x, q.z - from.z) < Math.hypot(b.x - from.x, b.z - from.z) ? q : b))
        : null;
      const stay = !!near && Math.hypot(near.x - from.x, near.z - from.z) < 5 && near.y <= from.y + 0.1;
      const to = stay ? new THREE.Vector3(near!.x, near!.y, near!.z) : spot(Math.atan2(from.z, from.x), WALL_R - 3, 0);
      if (!stay) d.post = false;
      if (d.fallen) { d.f.g.position.copy(to); d.pos.copy(to); continue; }
      d.moves.push({ t0: this.T, t1: this.T + 0.6, from, to, hop: 1.2, run: true });
    }
    return true;
  }

  /** A catapult's load lands (or its damage is done with no one left to throw it): the level comes down and the fire moves with the roof. */
  private shotLands(battle: Battle, s: BattlePlan['catShots'][number], shot: Shot | null, at?: THREE.Vector3): void {
    const was = this.holds.wall ?? this.stage.wallLevel();
    const colors = shotFire(shot ?? 'fire');
    if (shot && at) {
      this.fx.explode(at, colors.flame, s.target === 'wall' ? WALL_COLOR(was) : 0x8a6a4a, 1.1);
      this.sfx('boom', 0.15);
    }
    if (s.target === 'wall') {
      if (s.level !== null && this.lowerWall(s.level)) this.lay(battle.P, 3, WALL_COLOR(was), 4);
      return;
    }
    if (s.level !== null && s.level < (this.holds[s.target] ?? Infinity)) {
      this.holds[s.target] = s.level;
      this.stage.holdsChanged();
    }
    // the fire sits on what is left of the roof
    const roof = this.stage.aim(s.target);
    if (!roof) return;
    const spotOn = roof.pos.clone().setY(roof.pos.y - 0.3);
    const burning = this.fires.get(s.target);
    if (burning && this.fx.fires.includes(burning)) {
      this.fx.moveFire(burning, spotOn);
      if (shot) burning.level = Math.min(1, burning.level + 0.45);
    } else if (shot) this.fires.set(s.target, this.fx.ignite(spotOn, Math.max(2.2, roof.radius * 0.45), colors, 0.75));
  }

  private bucketBrigade(): void {
    const v = this.input?.village;
    if (!v) return;
    for (const fire of this.fx.fires) {
      if (fire.level < 0.08) continue;
      if (Math.hypot(fire.pos.x, fire.pos.z) > WALL_R - 3) continue; // wrecks burning out on the field are left to burn
      if (this.walkers.some((w) => w.job === 'bucket' && w.target === fire)) continue;
      for (let i = 0; i < 3; i++) {
        const f = makeVillager(v.theme, i + 2);
        const b = makeBucket();
        b.position.set(0.32, 0.95, 0.3);
        f.body.add(b);
        f.g.position.set(1.5 + (i - 1) * 1.3, 0, 10);
        this.group.add(f.g);
        this.walkers.push({ f, moves: [], job: 'bucket', carry: b, loopAt: this.T + i * 1.1, ph: i, target: fire, gone: false, hidden: false });
      }
    }
  }

  /** To the fire, a splash, back to the well, until it is out; then home. */
  private stepBucket(w: Walker, dt: number): void {
    const T = this.T;
    const f = w.f;
    this.follow(f, w.moves, T, dt, w.ph);
    // the pail swings back upright after the throw
    if (w.carry && w.carry.rotation.x !== 0 && T - ((w.carry.userData.tipAt as number | undefined) ?? 0) > 0.6) w.carry.rotation.x = 0;
    const last = w.moves[w.moves.length - 1];
    if (last && T < last.t1) return;
    if (T < w.loopAt) return;
    const fire = w.target;
    const well = new THREE.Vector3(1.5 + (w.ph - 1) * 1.2, 0, 9.5);
    if (!fire || !this.fx.fires.includes(fire) || fire.level < 0.04) {
      // nothing left to put out: walk off and go
      if (f.g.visible && !w.moves.some((m) => m.to.distanceTo(well) < 0.1 && m.t0 >= T - 0.01)) {
        if (!w.loopAt || w.loopAt > 0) {
          w.moves = [{ t0: T, t1: T + 3, from: f.g.position.clone(), to: well, hop: 0, run: false }];
          w.loopAt = -1;
          return;
        }
      }
      if (w.loopAt === -1 && T > (w.moves[0]?.t1 ?? 0)) w.gone = true;
      return;
    }
    const near = f.g.position.distanceTo(new THREE.Vector3(fire.pos.x, f.g.position.y, fire.pos.z)) < fire.radius + 4;
    if (near) {
      // throw the water
      const from = f.g.position.clone().add(new THREE.Vector3(0, 1.6, 0));
      const to = fire.pos.clone().add(new THREE.Vector3(0, 0.8, 0));
      for (let k = 0; k < 6; k++) this.fx.splash(from.clone().lerp(to, k / 5).add(new THREE.Vector3(0, Math.sin((k / 5) * Math.PI) * 2, 0)), 2);
      this.fx.douse(fire, 0.07);
      this.sfx('splash', 0.3);
      if (w.carry) { w.carry.rotation.x = 1.2; w.carry.userData.tipAt = T; }
      w.moves = [];
      w.loopAt = this.walk(w.moves, f.g.position.clone(), well.clone(), T + 0.5, 4.5, true) + 0.8;
    } else {
      if (w.carry) w.carry.rotation.x = 0;
      const d = new THREE.Vector3(fire.pos.x - well.x, 0, fire.pos.z - well.z).normalize();
      const stand = new THREE.Vector3(fire.pos.x - d.x * (fire.radius + 2.5) + (w.ph - 1) * 1.6, 0, fire.pos.z - d.z * (fire.radius + 2.5));
      stand.y = ground(stand.x, stand.z);
      w.moves = [];
      w.loopAt = this.walk(w.moves, f.g.position.clone(), stand, T, 4.5, true) + 0.2;
    }
  }

  /** A battle that happened while no one was watching: the scars it left. */
  private aftermathOnly(r: TheatreReport): void {
    const b = r.battle;
    const v = this.input!.village;
    if (b.building && b.building.after < b.building.before) {
      const aim = this.stage.aim(b.building.id);
      if (aim) {
        const f = this.fx.ignite(aim.pos.clone().setY(aim.pos.y - 0.3), Math.max(2.2, aim.radius * 0.45), shotFire('fire'), 0.45);
        f.fade = 0.03;
        this.fires.set(b.building.id, f);
        this.bucketBrigade();
      }
    }
    if (b.wall && b.wall.after < b.wall.before) {
      const theta = bearingOf(b.attacker.x, b.attacker.y, v.x, v.y);
      const t = Math.abs(angDiff(theta, GATE_A)) < 0.55 ? GATE_A : theta;
      this.lay(spot(t, WALL_R), 8, WALL_COLOR(b.wall.after), 6);
    }
    this.active = true;
  }

  // ---------- small things ----------

  private lay(P: THREE.Vector3, n: number, color: number, spread: number): void {
    let m = this.chunkMats.get(color);
    if (!m) { m = new THREE.MeshLambertMaterial({ color, flatShading: true }); this.chunkMats.set(color, m); }
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(this.chunkGeo, m);
      c.userData.sharedGeometry = true;
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      c.position.set(P.x + Math.cos(a) * r, 0.2, P.z + Math.sin(a) * r);
      c.position.y = ground(c.position.x, c.position.z) + 0.2;
      c.rotation.set(Math.random(), Math.random() * 6, Math.random());
      c.scale.setScalar(0.8 + Math.random() * 1.2);
      c.castShadow = true;
      this.group.add(c);
      this.rubble.push({ m: c, until: this.T + 120 });
    }
  }
  private chunkGeo = new THREE.BoxGeometry(0.7, 0.5, 0.55);

  /** The whole ring shakes down a size: dust all along it. */
  private crumble(color: number): void {
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(a) * WALL_R, 1.5, Math.sin(a) * WALL_R);
      this.fx.dust(p, 3, 0xcdbf9f);
      if (i % 3 === 0) this.fx.debris(p, 2, color);
    }
  }

  private growThorns(P: THREE.Vector3, v: THREE.Vector3): void {
    this.dropThorns();
    const g = new THREE.Group();
    const m = new THREE.MeshLambertMaterial({ color: 0x3f6424, flatShading: true });
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2 + Math.random() * 1.6, 5).translate(0, 1, 0), m);
      const lat = (i / 25 - 0.5) * 16;
      c.position.copy(P).addScaledVector(v, lat).addScaledVector(new THREE.Vector3(P.x, 0, P.z).normalize(), 1.5 + Math.random() * 1.5);
      c.rotation.set((Math.random() - 0.5) * 0.9, 0, (Math.random() - 0.5) * 0.9);
      g.add(c);
    }
    g.position.y = -3;
    this.group.add(g);
    this.thorns = { g, mat: m, t0: this.T, until: this.T + 16 };
  }

  private say(text: string, color: string, at: THREE.Vector3, life: number): void {
    const s = caption(text, color);
    s.position.copy(at);
    this.group.add(s);
    this.captions.push({ s, t0: this.T, life, y0: at.y });
  }

  private sfx(kind: keyof BattleSound, gap: number): void {
    if ((this.sfxAt[kind] ?? -9) + gap > this.T) return;
    this.sfxAt[kind] = this.T;
    this.stage.sound[kind]?.();
  }

  private setQuiet(on: boolean): void {
    if (on === this.quietOn) return;
    this.quietOn = on;
    this.stage.quiet(on);
  }

  // ---------- motion ----------

  /** Walk a figure along its moves at theatre time T. */
  private follow(f: Figure, moves: Move[], T: number, dt: number, ph: number, mounted = false): boolean {
    let m: Move | undefined;
    for (const x of moves) { if (T >= x.t0) m = x; }
    if (!m) { if (moves[0]) { f.g.position.copy(moves[0].from); f.g.visible = true; } return false; }
    const k = m.t1 > m.t0 ? Math.min(1, Math.max(0, (T - m.t0) / (m.t1 - m.t0))) : 1;
    const moving = k > 0 && k < 1;
    const e = m.climb !== undefined ? k : ease(k);
    f.g.position.lerpVectors(m.from, m.to, e);
    if (m.climb !== undefined && m.climb > 0 && m.from.y < m.to.y) f.g.position.y = m.from.y + (m.to.y - m.from.y) * k;
    else if (m.hop) f.g.position.y += m.hop * 4 * e * (1 - e);
    if (moving) {
      const dx = m.to.x - m.from.x, dz = m.to.z - m.from.z;
      if (Math.abs(dx) + Math.abs(dz) > 0.01) f.g.rotation.y = yawTo(dx, dz);
      f.body.position.y = Math.abs(Math.sin(T * (m.run ? 11 : 8) + ph)) * (mounted ? 0.22 : m.run ? 0.16 : 0.1);
      f.body.rotation.x = m.run ? 0.12 : 0.04;
    } else if (!f.g.userData.falling) {
      f.body.position.y = 0;
      f.body.rotation.x = 0;
    }
    f.g.visible = true;
    return moving;
  }

  private stepActor(a: Actor, dt: number, army: Army | null): void {
    const T = this.T;
    const f = a.f;
    if (a.gone) return;
    // falling
    if (!a.fallen && a.fallAt !== null && T >= a.fallAt) {
      a.fallen = true;
      a.fallT = T;
      f.g.userData.falling = true;
      if (a.siege) {
        this.fx.ignite(f.g.position.clone().setY(f.g.position.y + 1.5), 1.6, shotFire('fire'), 0.6);
        this.fx.debris(f.g.position.clone().setY(1.5), 6, 0x6e4a2a);
      } else if (!a.f.flyer) this.fx.dust(f.g.position.clone().setY(f.g.position.y + 0.3), 3);
    }
    if (a.fallen) {
      const k = Math.min(1, (T - a.fallT) / 0.45);
      if (a.siege) {
        f.body.scale.y = 1 - k * 0.55;
        f.body.rotation.z = k * 0.25;
      } else if (f.flyer) {
        f.g.position.y = Math.max(ground(f.g.position.x, f.g.position.z), f.g.position.y - dt * 9);
        f.body.rotation.z = k * 1.4;
      } else if (f.mounted) f.body.rotation.z = k * (Math.PI / 2) * 0.95;
      else f.body.rotation.x = -k * (Math.PI / 2) * 0.95;
      // after a while the fallen sink away
      const lie = T - a.fallT;
      if (lie > 7) {
        f.g.position.y -= dt * 0.35;
        if (lie > 12) this.removeActor(a);
      }
      return;
    }
    // where to be
    let moving = false;
    if (a.mode === 'formation' && army) {
      const g = this.gameNowFor(army);
      const ap = approachAt(g, army.depart, army.arrive, army.replay ? 1 : this.rate);
      if (!ap) { f.g.visible = false; return; }
      const p = this.formationPos(army, a, ap.r);
      const prev = f.g.position.clone();
      f.g.position.copy(p);
      a.pos.copy(p);
      moving = ap.phase === 'emerge' || ap.phase === 'charge';
      f.g.rotation.y = yawTo(-Math.cos(army.theta), -Math.sin(army.theta));
      const run = ap.phase === 'charge';
      f.body.position.y = moving ? Math.abs(Math.sin(T * (run ? 11 : 7) + a.ph)) * (f.mounted ? 0.22 : run ? 0.16 : 0.1) : 0;
      f.body.rotation.x = run ? 0.14 : 0;
      if (moving && prev.distanceTo(p) > 0.001 && a.siege) this.turnWheels(a, prev.distanceTo(p));
      // appear out of the tree line
      const fadeIn = ap.phase === 'emerge' ? Math.min(1, ap.k * 5) : 1;
      f.g.scale.setScalar(FIG_SCALE * Math.max(0.01, fadeIn));
      f.g.visible = true;
      if (f.flyer) f.g.position.y += 6 + Math.sin(T * 2 + a.ph) * 0.6;
    } else {
      const prev = a.siege ? f.g.position.clone() : null;
      moving = this.follow(f, a.moves, T, dt, a.ph, f.mounted);
      if (prev && moving) this.turnWheels(a, prev.distanceTo(f.g.position));
      a.pos.copy(f.g.position);
      if (f.flyer && a.flying === 0 && !a.fallen) f.g.position.y += 6;
      if (!moving) {
        const target = a.partner && !a.partner.fallen && !a.partner.gone ? a.partner.pos : a.lookAt;
        if (target) {
          const want = yawTo(target.x - a.pos.x, target.z - a.pos.z);
          f.g.rotation.y += angDiff(want, f.g.rotation.y) * Math.min(1, dt * 8);
        }
      }
      if (a.fadeFrom !== null && T > a.fadeFrom) {
        const k = Math.min(1, (T - a.fadeFrom) / 2.5);
        f.g.scale.setScalar(FIG_SCALE * Math.max(0.01, 1 - k));
        if (k >= 1) { this.removeActor(a); return; }
      }
      if (a.carry && a.carry.userData.showAt !== undefined && T >= (a.carry.userData.showAt as number)) a.carry.visible = true;
    }
    // wings beat on anything that flies
    if (f.flyer && !a.fallen) f.g.traverse((o) => { if (o.userData.flap) o.rotation.z = Math.sin(T * 13 + a.ph) * 0.7 * (o.userData.flap as number); });
    // what they are doing with their hands
    this.pose(a, dt, moving);
  }

  private turnWheels(a: Actor, d: number): void {
    for (const w of a.siege?.wheels ?? []) w.rotation.x += d * 2.2;
  }

  private gameNowFor(army: Army): number {
    return army.replay ? this.T * 1000 : this.gameNow();
  }

  /** Swings, shots, throws, spells and cheers. */
  private pose(a: Actor, dt: number, moving: boolean): void {
    const T = this.T;
    const f = a.f;
    // rams and catapults
    if (a.siege && 'log' in a.siege) {
      const hit = a.siege.log.userData.hitAt as number | undefined;
      const s = hit !== undefined ? T - hit : 9;
      // the blow lands at hitAt: a fast slam forward, then the crew hauls it back and it hangs ready
      const z = s < 0.12 ? -0.9 + (s / 0.12) * 1.5 : s < 0.9 ? 0.6 - ((s - 0.12) / 0.78) * 1.5 : -0.9 + Math.sin(T * 2.4 + a.ph) * 0.08;
      a.siege.log.position.z = z;
      return;
    }
    if (a.siege && 'arm' in a.siege) {
      const fire = a.siege.arm.userData.fireAt as number | undefined;
      const s = fire !== undefined ? T - fire : 9;
      a.siege.arm.rotation.x = s < 0.22 ? -1.0 + (s / 0.22) * 1.55 : s < 1.4 ? 0.55 - ((s - 0.22) / 1.18) * 1.55 : -1.0;
      return;
    }
    // cheering (and dancing at the party): jumping with weapons up
    const partying = T >= a.partyFrom && T < a.partyUntil;
    if ((T - a.cheerT < 3 && T >= a.cheerT) || partying) {
      f.body.position.y = Math.abs(Math.sin((T - a.cheerT) * 7 + a.ph)) * (partying ? 0.75 : 0.6);
      if (partying && Math.sin(T * 1.3 + a.ph) > 0.6) f.g.rotation.y += dt * 6;
      if (f.weapon) f.weapon.rotation.x = -2.2 + Math.sin(T * 10 + a.ph) * 0.3;
      return;
    }
    if (moving || !this.inBattle(a)) {
      if (f.weapon) f.weapon.rotation.x *= Math.max(0, 1 - dt * 8);
      f.body.position.z = 0;
      return;
    }
    // ranged: keep shooting / casting / throwing at someone on the other side
    const role = a.role;
    const battle = this.battleOf(a);
    if (battle && T >= a.nextAmbient) {
      const enemies = this.enemiesOf(a, battle);
      const inMelee = T > battle.t0 + battle.plan.meleeStart + 1;
      if ((role === 'shooter' || role === 'caster') && enemies.length) {
        const target = enemies[Math.floor(Math.random() * enemies.length)];
        this.shoot(a, target, battle, false);
        a.nextAmbient = T + 1.3 + Math.random() * 1.6;
      } else if (role === 'thrower' && !inMelee && enemies.length && a.side === 'def') {
        const target = enemies[Math.floor(Math.random() * enemies.length)];
        this.shoot(a, target, battle, false);
        a.nextAmbient = T + 2.2 + Math.random() * 1.5;
      } else if ((role === 'melee' || role === 'thrower') && inMelee && a.partner && !a.partner.fallen) {
        a.swingT = T;
        a.nextAmbient = T + 0.7 + Math.random() * 0.8;
        // blades meet
        if (Math.random() < 0.45) {
          const mid = a.pos.clone().lerp(a.partner.pos, 0.5).setY(a.pos.y + 1.4);
          this.fx.sparks(mid, 3, 0xfff0c0);
          this.sfx('clash', 0.09);
        }
      } else a.nextAmbient = T + 0.8;
    }
    // kills: whoever is about to fall is struck down by an enemy
    // (handled when scheduling: see killBlows)
    const sw = T - a.swingT;
    if (f.weapon) {
      if (sw < 0.42) f.weapon.rotation.x = sw < 0.18 ? -(sw / 0.18) * 1.9 : -1.9 + ((sw - 0.18) / 0.24) * 3.0;
      else if (T - a.throwT < 1.4) f.weapon.rotation.x = T - a.throwT < 0.25 ? -((T - a.throwT) / 0.25) * 1.6 : 1.1;
      else if (T - a.shootT < 0.5) f.weapon.rotation.x = -0.5;
      else if (T - a.castT < 0.6) f.weapon.rotation.x = -1.4;
      else f.weapon.rotation.x *= Math.max(0, 1 - dt * 6);
      f.weapon.visible = !(role === 'thrower' && T - a.throwT > 0.25 && T - a.throwT < 1.3);
    }
    f.body.position.z = sw < 0.42 ? Math.sin((sw / 0.42) * Math.PI) * 0.35 : 0;
  }

  private inBattle(a: Actor): boolean {
    return !!this.battleOf(a);
  }

  private battleOf(a: Actor): Battle | null {
    for (const army of this.armies.values()) {
      const b = army.battle;
      if (!b || b.ended) continue;
      if (a.side === 'att' ? army.actors.includes(a) : b.defenders.includes(a)) return b;
    }
    return null;
  }

  private enemiesOf(a: Actor, b: Battle): Actor[] {
    const army = [...this.armies.values()].find((x) => x.battle === b);
    const list = a.side === 'att' ? b.defenders : army?.actors ?? [];
    return list.filter((e) => !e.fallen && !e.gone && e.f.g.visible);
  }

  /** Loose an arrow (or spear, or bolt) at a target; it lands when `hitAt` says, or misses nearby. */
  private shoot(a: Actor, target: Actor, battle: Battle, kill: boolean, hitAt?: number): void {
    const T = this.T;
    const from = a.pos.clone().setY(a.pos.y + (a.f.mounted ? 2.8 : 1.7));
    const to = target.f.flyer ? target.f.g.position.clone() : target.pos.clone().setY(target.pos.y + 1.1);
    if (!kill) { to.x += (Math.random() - 0.5) * 3.5; to.z += (Math.random() - 0.5) * 3.5; to.y = ground(to.x, to.z) + 0.1; }
    const dur = hitAt !== undefined ? Math.max(0.3, hitAt - T) : Math.min(1.4, 0.5 + from.distanceTo(to) * 0.035);
    // a sorcerer's barrier catches some of the arrows aimed into the village
    const barrier = battle.plan.effects.includes('barrier') && a.side === 'att' && !kill && Math.random() < 0.6;
    if (barrier) {
      const dome = to.clone().setLength(WALL_R + 4.6);
      dome.y = Math.max(3, 12 - Math.abs(dome.length() - WALL_R) * 0.2);
      to.copy(dome);
    }
    const land = () => {
      if (barrier) { this.stage.flashBarrier(1); this.fx.magic(to, 5, 0xc9b3ff); }
      else if (!kill) this.fx.dust(to, 1, 0x9a8a6a);
    };
    if (a.role === 'caster') {
      a.castT = T;
      const col = a.unit === 'necromancer' ? 0x5cff9a : a.unit === 'sorcerer' ? 0xb58cff : a.unit === 'frost' ? 0xbfeaff : 0xffd27a;
      this.fx.bolt(from.clone().add(new THREE.Vector3(0, 0.6, 0)), to, dur * 0.7, col, () => { this.fx.magic(to, 6, col); land(); });
      this.sfx('whoosh', 0.25);
    } else if (a.role === 'thrower' || a.role === 'melee') {
      a.throwT = T;
      this.fx.spear(from, to, dur, land);
      this.sfx('whoosh', 0.2);
    } else {
      a.shootT = T;
      this.fx.arrow(from, to, dur, land);
      this.sfx('twang', 0.12);
    }
  }

  /** The blows that kill: every scheduled fall gets an enemy who causes it. */
  private killBlows(): void {
    const T = this.T;
    for (const army of this.armies.values()) {
      const b = army.battle;
      if (!b || b.ended) continue;
      const wallDown = (this.holds.wall ?? this.stage.wallLevel()) <= 0;
      for (const victim of [...army.actors, ...b.defenders]) {
        if (victim.fallen || victim.gone || victim.fallAt === null || victim.killScheduled) continue;
        const lead = victim.fallAt - T;
        if (lead > 1.1) continue;
        const meleePhase = victim.fallAt >= b.t0 + b.plan.meleeStart;
        const enemies = this.enemiesOf(victim, b);
        const near = (list: Actor[]) => list.sort((x, y) => x.pos.distanceTo(victim.pos) - y.pos.distanceTo(victim.pos))[0];
        const shooters = enemies.filter((e) => e.role === 'shooter' || e.role === 'caster' || (e.role === 'thrower' && e.side === 'def'));
        if (!meleePhase && !victim.siege) {
          // the opening volleys: an arrow, spear or bolt timed to land on the moment
          if (shooters.length) {
            victim.killScheduled = true;
            this.shoot(shooters[Math.floor(Math.random() * shooters.length)], victim, b, true, victim.fallAt);
          } else if (lead <= 0.3) {
            // nobody to shoot them: they fall in the melee instead
            victim.fallAt = Math.max(victim.fallAt, b.t0 + b.plan.meleeStart + 0.8 + Math.random() * 2);
          }
          continue;
        }
        // hand to hand: the one they are fighting, if at hand
        const partner = victim.partner && !victim.partner.fallen && !victim.partner.gone && victim.partner.pos.distanceTo(victim.pos) < 6 ? victim.partner : null;
        if (partner) {
          if (lead <= 0.3) { victim.killScheduled = true; this.strike(b, partner, victim, false); }
          continue;
        }
        // else the nearest free fighter on the same side of the wall runs at them
        const inside = (a: Actor) => Math.hypot(a.pos.x, a.pos.z) < WALL_R;
        const runner = near(enemies.filter((e) => this.free(e) && (e.role === 'melee' || e.role === 'thrower') && (wallDown || inside(e) === inside(victim))));
        if (runner && lead > 0.4 && runner.pos.distanceTo(victim.pos) / (lead - 0.3) <= 9) {
          victim.killScheduled = true;
          this.strike(b, runner, victim, true);
          continue;
        }
        // else a missile from whoever can throw or shoot one
        const thrower = near(shooters) ?? (lead <= 0.9 ? near(enemies.filter((e) => !e.siege)) : undefined);
        if (thrower) {
          victim.killScheduled = true;
          this.shoot(thrower, victim, b, true, victim.fallAt);
        } else if (lead <= 0.3 && enemies.length) {
          // someone is on the way: hold on a moment longer
          victim.fallAt = T + 1.2;
        }
      }
    }
  }

  /** Standing about with nothing to do (so free to go and strike someone). */
  private free(e: Actor): boolean {
    return e.mode === 'scripted' && !e.post && !e.siege && e.role !== 'noble' && !e.fallen && !e.gone
      && (!e.moves.length || e.moves[e.moves.length - 1].t1 <= this.T);
  }

  /** The blow that fells: the killer steps (or runs) up and swings as the victim goes down. */
  private strike(b: Battle, k: Actor, victim: Actor, run: boolean): void {
    const at = victim.fallAt!;
    if (run) {
      const d = k.pos.clone().sub(victim.pos).setY(0);
      const len = d.length() || 1;
      const to = victim.pos.clone().addScaledVector(d, (victim.siege ? 2.6 : 1.2) / len);
      to.y = ground(to.x, to.z);
      k.moves.push({ t0: this.T, t1: Math.max(this.T + 0.2, at - 0.3), from: k.f.g.position.clone(), to, hop: 0, run: true });
      k.partner = victim;
    }
    this.at(b, Math.max(0, at - 0.2 - b.t0), () => {
      if (k.fallen || k.gone) return;
      k.swingT = this.T;
      const mid = k.pos.clone().lerp(victim.pos, 0.6).setY(victim.pos.y + 1.2);
      this.fx.sparks(mid, victim.siege ? 8 : 6, 0xff9a6a);
      this.sfx(victim.siege ? 'thud' : 'clash', 0.07);
    });
  }

  // ---------- frame ----------

  step(dt: number, _t: number): void {
    this.T += dt;
    const T = this.T;
    const input = this.input;
    const nowReal = performance.now();
    let anything = false;
    for (const army of [...this.armies.values()]) {
      if (army.done && army.actors.every((a) => a.gone)) {
        this.dropArmy(army);
        this.armies.delete(army.key);
        continue;
      }
      anything = true;
      // its turn at the wall has come
      if (army.pending && !this.fighting()) {
        const r = army.pending;
        army.pending = null;
        this.startBattle(army, r);
      }
      // the army dropped out of the incoming list without a battle (called off, or the page moved on);
      // while the game is paused nothing is heard, so nothing is concluded
      if (!army.battle && !army.replay && !army.pending && !army.done && this.rate > 0 && nowReal - army.seenAt > 4000) {
        const g = this.gameNow();
        if (g < army.arrive - 1000 || nowReal - army.seenAt > 12_000) {
          for (const a of army.actors) if (!a.gone) { a.mode = 'scripted'; a.moves = []; a.fadeFrom = T; }
          army.done = true;
          this.stoodDown();
        }
      }
      // alarms, as the army closes in
      if (!army.battle && !army.done) {
        const g = this.gameNowFor(army);
        const ap = approachAt(g, army.depart, army.arrive, army.replay ? 1 : this.rate);
        if (ap) {
          const tower = input?.village.buildings.watchtower ?? 0;
          if (tower > 0 || army.replay) this.raiseAlarm(army);
          else if (ap.phase === 'hold' || ap.phase === 'charge' || ap.phase === 'arrived') this.lateAlarm(army);
          if (ap.phase === 'arrived') {
            army.arrivedAt ??= T;
            if (army.replay && !army.pending) {
              if (this.fighting()) army.pending = army.replay.report;
              else this.startBattle(army, army.replay.report);
            }
          }
        }
      }
      // banner: carried with the rear of the army
      if (army.banner) {
        const carrier = army.actors.find((a) => a.unit === 'noble' && !a.fallen && !a.gone) ?? army.actors.find((a) => !a.fallen && !a.gone && !a.siege);
        army.banner.visible = !!carrier && carrier.f.g.visible;
        if (carrier) {
          army.banner.position.copy(carrier.f.g.position).add(new THREE.Vector3(-0.6, 0, -0.3));
          army.banner.rotation.y = carrier.f.g.rotation.y;
          army.banner.scale.setScalar(carrier.f.g.scale.x);
          const cloth = army.banner.children[1];
          if (cloth) cloth.rotation.y = Math.sin(T * 3 + army.theta) * 0.35;
        }
      }
      for (const a of army.actors) this.stepActor(a, dt, army);
      // the battle's timed events
      const b = army.battle;
      if (b && !b.ended) {
        while (b.events.length && b.events[0].t <= T) b.events.shift()!.run();
      }
    }
    for (const a of this.defenders) this.stepActor(a, dt, null);
    // (in place: the battle holds this same array)
    for (let i = this.defenders.length - 1; i >= 0; i--) if (this.defenders[i].gone) this.defenders.splice(i, 1);
    this.killBlows();
    // the bell rings while the enemy approaches
    if (this.lookout && T - this.bellAt > 3.2) { this.bellAt = T; this.stage.sound.bell(); }
    if (this.alarm) { this.alarm.material.opacity = 0.6 + Math.abs(Math.sin(T * 4)) * 0.4; }
    this.stepWalkers(dt);
    // thorns
    if (this.thorns) {
      const k = T - this.thorns.t0;
      this.thorns.g.position.y = k < 1 ? -3 + k * 3 : T > this.thorns.until - 2 ? -(T - (this.thorns.until - 2)) * 1.5 : 0;
      if (T > this.thorns.until) this.dropThorns();
    }
    // rime: the glaze spreads out along the wall, then melts away
    if (this.rime) {
      const k = Math.min(1, (T - this.rime.t0) / 1.6);
      const melt = T > this.rime.until - 2 ? Math.max(0.02, (this.rime.until - T) / 2) : 1;
      this.rime.g.scale.set(0.05 + 0.95 * (1 - (1 - k) * (1 - k)), melt, 1);
      if (T > this.rime.until) this.dropRime();
    }
    // captions float up and fade
    this.captions = this.captions.filter((c) => {
      const k = (T - c.t0) / c.life;
      c.s.position.y = c.y0 + k * 3;
      (c.s.material as THREE.SpriteMaterial).opacity = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
      if (k >= 1) { this.dropCaption(c.s); return false; }
      return true;
    });
    // rubble sinks away in time
    this.rubble = this.rubble.filter((r) => {
      if (T < r.until) return true;
      r.m.position.y -= dt * 0.3;
      if (T > r.until + 4) { this.group.remove(r.m); return false; }
      return true;
    });
    this.fx.step(dt, T);
    anything ||= this.defenders.length > 0 || this.walkers.length > 0 || this.fx.busy || this.rubble.length > 0;
    if (!anything && this.active) {
      this.active = false;
      this.setQuiet(false);
      this.musterKey = '';
      this.alarmUntil = 0;
      if (Object.keys(this.holds).length) { this.holds = {}; this.stage.holdsChanged(); }
    }
    if (this.defenders.length === 0 && this.quietOn && ![...this.armies.values()].some((a) => a.battle && !a.battle.ended)) {
      const approaching = [...this.armies.values()].some((a) => !a.done);
      if (!approaching) this.setQuiet(false);
    }
    if (anything) this.active = true;
  }

  dispose(): void {
    this.reset(-1);
    this.stage.scene.remove(this.group);
    this.fx.dispose();
    this.chunkGeo.dispose();
    for (const m of this.chunkMats.values()) m.dispose();
    disposeTemplates();
  }
}

function fmtRes(n: number): string {
  return n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString('en-US');
}

function rngOf(seed: number): () => number {
  let s = Math.floor(seed) | 0;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}


