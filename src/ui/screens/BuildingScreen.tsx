import { themeOfHero } from '../../engine/data/themes';
import { useState } from 'preact/hooks';
import { BUILDINGS, BUILDING_ORDER } from '../../engine/data/buildings';
import { HEROES, HERO_INFO, ITEM_BY_ID, UNITS, UNIT_ORDER, itemsFor } from '../../engine/data/units';
import {
  COIN_COST, farmCap, hideCap, mineRate, researchCost, storageCap, techMultiplier, wallBase, wallMultiplier,
  watchtowerRange, unitsPop,
} from '../../engine/formulas';
import type { BuildingId, RecruitBuilding, ResKey, UnitId } from '../../engine/types';
import type { VillageView } from '../../engine/view';
import { Icon } from '../art/icons';
import { Btn, Cost, Countdown, Empty, NumInput, Progress, Section, UnitList, UnitIcon, unitName } from '../components/common';
import { fmt, fmtDur } from '../format';
import { act, go, host, liveRes, now, view, village, warp } from '../store';
import { MarketPanel } from './MarketScreen';
import { buildingThumb } from '../three/thumbs';
import { RallyScreen } from './RallyScreen';

export function BuildingScreen({ id, tab }: { id: BuildingId; tab?: string }) {
  const v = village.value!;
  const d = BUILDINGS[id];
  const level = v.buildings[id];
  const thumb = buildingThumb(id, level);
  return (
    <div class="building-screen">
      <div class="crumbs">
        <button type="button" class="link" onClick={() => go({ name: 'village' })}>{v.name}</button>
        <span aria-hidden="true">›</span>
        <span>{d.name}</span>
      </div>
      <header class="building-head">
        <div class="building-title">
          {thumb ? <img class="building-thumb" src={thumb} alt="" /> : <span class="building-icon"><Icon name={`b_${id}`} size={34} /></span>}
          <div>
            <h1>{d.name}</h1>
            <p class="muted">{level > 0 ? `Level ${level} of ${d.max}` : 'Not built yet'} · {d.description}</p>
          </div>
        </div>
        <UpgradeBox v={v} id={id} />
      </header>
      {level <= 0 && id !== 'wall' && !['timber', 'claypit', 'ironmine'].includes(id) ? (
        <Section><Empty>Build the {d.name.toLowerCase()} to use it.</Empty></Section>
      ) : (
        <BuildingBody v={v} id={id} tab={tab} />
      )}
    </div>
  );
}

function UpgradeBox({ v, id }: { v: VillageView; id: BuildingId }) {
  const h = host.value!;
  const chk = h.checkBuild(v.id, id);
  if (chk.reason === 'Fully upgraded.') return <div class="upgrade-box is-max"><b>Fully upgraded</b></div>;
  const have = liveRes(v);
  return (
    <div class="upgrade-box">
      <div class="muted small">Upgrade to level {chk.level}</div>
      <Cost cost={chk.cost} have={have} pop={chk.pop} time={chk.time} />
      <div class="row gap">
        <Btn disabled={!chk.ok} onClick={() => act({ type: 'build', vid: v.id, building: id }, `${BUILDINGS[id].name} level ${chk.level} queued.`)}>
          {BUILDINGS[id].name === 'Headquarters' || v.buildings[id] > 0 ? `Upgrade to ${chk.level}` : 'Build'}
        </Btn>
        {!chk.ok && <span class="reason">{chk.reason}{chk.reason === 'Not enough resources.' ? <> <AffordEta v={v} cost={chk.cost} /></> : null}</span>}
      </div>
    </div>
  );
}

function AffordEta({ v, cost }: { v: VillageView; cost: { wood: number; clay: number; iron: number } }) {
  const have = liveRes(v);
  let t = 0;
  for (const k of ['wood', 'clay', 'iron'] as ResKey[]) {
    const need = cost[k] - have[k];
    if (need > 0) t = Math.max(t, v.rates[k] > 0 ? (need / v.rates[k]) * 3600_000 : Infinity);
  }
  if (!isFinite(t)) return null;
  return <span class="muted">Affordable in <span class="num">{fmtDur(t / warp.value)}</span>.</span>;
}

function BuildingBody({ v, id, tab }: { v: VillageView; id: BuildingId; tab?: string }) {
  switch (id) {
    case 'main': return <HQPanel v={v} />;
    case 'barracks': case 'stable': case 'workshop': return <RecruitPanel v={v} b={id} />;
    case 'academy': return <AcademyPanel v={v} />;
    case 'smithy': return <SmithyPanel v={v} />;
    case 'rally': return <RallyScreen tab={tab} />;
    case 'market': return <MarketPanel tab={tab} />;
    case 'statue': return <StatuePanel v={v} />;
    case 'farm': return <FarmPanel v={v} />;
    case 'warehouse': return <WarehousePanel v={v} />;
    case 'hiding': return <LevelTable title="Hidden per resource" cur={v.buildings.hiding} max={10} fn={(l) => fmt(hideCap(l))} note="Raiders can never take what is hidden. Barbarians have no hiding place." />;
    case 'wall': return <WallPanel v={v} />;
    case 'watchtower': return <LevelTable title="Detection radius" cur={v.buildings.watchtower} max={20} fn={(l) => `${watchtowerRange(l)} fields`} note="Attacks inside the radius reveal their slowest unit on the incoming list, so you know whether rams or noblemen are coming." />;
    case 'timber': case 'claypit': case 'ironmine': return <ProductionPanel v={v} id={id} />;
  }
  return null;
}

// ---------- Headquarters ----------

function HQPanel({ v }: { v: VillageView }) {
  const h = host.value!;
  const have = liveRes(v);
  const [name, setName] = useState(v.name);
  const [showDemolish, setShowDemolish] = useState(false);
  return (
    <div class="stack">
      <Section title="Construction queue" actions={<span class="muted small">{v.buildQueue.length}/{v.buildSlots} slots</span>}>
        {v.buildQueue.length === 0 ? <Empty>The builders are idle.</Empty> : (
          <ul class="queue">
            {v.buildQueue.map((j, i) => (
              <li class="queue-item">
                <Icon name={`b_${j.building}`} size={18} />
                <span class="grow">
                  {BUILDINGS[j.building].name} <span class="muted">→ {j.level}{j.demolish ? ' (demolish)' : ''}</span>
                  {i === 0 && <Progress from={j.start} to={j.end} />}
                </span>
                <span class="muted small">done <span class="num">{new Date(Date.now() + (j.end - now.value) / warp.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></span>
                <Countdown until={j.end} />
                <Btn small variant="ghost" onClick={() => act({ type: 'cancelBuild', vid: v.id, job: j.id })}>Cancel</Btn>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Buildings">
        <div class="table-scroll">
          <table class="build-table">
            <thead>
              <tr><th>Building</th><th>Next level cost</th><th /></tr>
            </thead>
            <tbody>
              {BUILDING_ORDER.map((b) => {
                const chk = h.checkBuild(v.id, b);
                const lvl = v.buildings[b];
                const maxed = chk.reason === 'Fully upgraded.';
                const locked = chk.reason?.startsWith('Requires');
                return (
                  <tr class={locked ? 'is-locked' : ''}>
                    <td>
                      <button type="button" class="bname link" onClick={() => go({ name: 'building', id: b })}>
                        <Icon name={`b_${b}`} size={20} />
                        <span>{BUILDINGS[b].name}</span>
                      </button>
                      <span class="muted small"> {lvl > 0 ? `level ${lvl}` : 'not built'}{chk.level - 1 > lvl ? ` (→${chk.level - 1})` : ''}</span>
                    </td>
                    <td>{maxed ? <span class="muted">—</span> : locked ? <span class="muted small">{chk.reason}</span> : <Cost cost={chk.cost} have={have} pop={chk.pop} time={chk.time} compact />}</td>
                    <td class="right">
                      {!maxed && !locked && (
                        <Btn small disabled={!chk.ok} title={chk.reason} onClick={() => act({ type: 'build', vid: v.id, building: b })}>
                          {lvl === 0 && chk.level === 1 ? 'Build' : `Level ${chk.level}`}
                        </Btn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Village name">
        <form class="row gap" onSubmit={(e) => { e.preventDefault(); act({ type: 'rename', vid: v.id, name }, 'Village renamed.'); }}>
          <input id="rename-village" value={name} maxLength={32} onInput={(e) => setName(e.currentTarget.value)} />
          <button type="submit" class="btn btn-ghost">Rename</button>
        </form>
      </Section>
      {v.buildings.main >= 15 && (
        <Section title="Demolition" actions={<Btn small variant="quiet" onClick={() => setShowDemolish(!showDemolish)}>{showDemolish ? 'Hide' : 'Show'}</Btn>}>
          {showDemolish ? (
            <div class="demolish-grid">
              {BUILDING_ORDER.filter((b) => v.buildings[b] > BUILDINGS[b].min).map((b) => (
                <Btn small variant="danger" onClick={() => act({ type: 'demolish', vid: v.id, building: b })}>
                  {BUILDINGS[b].short} {v.buildings[b]}→{v.buildings[b] - 1}
                </Btn>
              ))}
            </div>
          ) : <p class="muted small">Tear buildings down one level at a time to free population. Nothing is refunded.</p>}
        </Section>
      )}
    </div>
  );
}

// ---------- recruitment ----------

function RecruitQueue({ v, b }: { v: VillageView; b: RecruitBuilding }) {
  const q = v.recruit[b];
  if (q.length === 0) return null;
  return (
    <Section title="In training">
      <ul class="queue">
        {q.map((j, i) => {
          const end = j.start + j.count * j.per;
          return (
            <li class="queue-item">
              <UnitIcon u={j.unit} size={18} />
              <span class="grow">
                {fmt(j.count - j.done)} {unitName(j.unit, true)}
                {i === 0 && <Progress from={j.start + j.done * j.per} to={j.start + (j.done + 1) * j.per} />}
              </span>
              <span class="muted small">next in <Countdown until={j.start + (j.done + 1) * j.per} /></span>
              <Countdown until={end} />
              <Btn small variant="ghost" onClick={() => act({ type: 'cancelRecruit', vid: v.id, building: b, job: j.id })}>Cancel</Btn>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function RecruitPanel({ v, b }: { v: VillageView; b: RecruitBuilding }) {
  const h = host.value!;
  const units = UNIT_ORDER.filter((u) => UNITS[u].building === b && ((u !== 'archer' && u !== 'marcher') || view.value!.config.archers));
  const [counts, setCounts] = useState<Partial<Record<UnitId, number | ''>>>({});
  const have = liveRes(v);
  const total = { wood: 0, clay: 0, iron: 0 };
  let pop = 0;
  for (const u of units) {
    const n = Number(counts[u] || 0);
    total.wood += UNITS[u].cost.wood * n;
    total.clay += UNITS[u].cost.clay * n;
    total.iron += UNITS[u].cost.iron * n;
    pop += UNITS[u].pop * n;
  }
  const submit = (e: Event) => {
    e.preventDefault();
    let any = false;
    for (const u of units) {
      const n = Number(counts[u] || 0);
      if (n > 0) any = act({ type: 'recruit', vid: v.id, unit: u, count: n }) || any;
    }
    if (any) setCounts({});
  };
  const army = (u: UnitId) => v.units[u] ?? 0;
  return (
    <div class="stack">
      <RecruitQueue v={v} b={b} />
      <Section title="Recruit">
        <form onSubmit={submit}>
          <div class="table-scroll">
            <table class="recruit-table">
              <thead>
                <tr><th>Unit</th><th>Cost each</th><th class="right">At home</th><th>Recruit</th></tr>
              </thead>
              <tbody>
                {units.map((u) => {
                  const av = h.unitAvailable(v.id, u);
                  const chk = h.recruitCheck(v.id, u, 1);
                  const per = h.recruitTime(v.id, u);
                  return (
                    <tr class={av.ok ? '' : 'is-locked'}>
                      <td>
                        <span class="uname"><UnitIcon u={u} size={20} /> <b>{unitName(u)}</b></span>
                        <div class="muted small">{UNITS[u].description}</div>
                      </td>
                      <td><Cost cost={UNITS[u].cost} have={have} pop={UNITS[u].pop} time={per} compact /></td>
                      <td class="right num">{fmt(army(u))}</td>
                      <td>
                        {av.ok ? (
                          <NumInput id={`recruit-${u}`} value={counts[u] ?? ''} max={chk.max} onInput={(n) => setCounts({ ...counts, [u]: n })} />
                        ) : (
                          <span class="muted small">{av.reason}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div class="row gap end recruit-foot">
            {pop > 0 && <Cost cost={total} have={have} pop={pop} compact />}
            <button type="submit" class="btn btn-primary" disabled={pop === 0}>Recruit</button>
          </div>
        </form>
      </Section>
    </div>
  );
}

// ---------- smithy ----------

function SmithyPanel({ v }: { v: VillageView }) {
  const h = host.value!;
  const have = liveRes(v);
  const units = UNIT_ORDER.filter((u) => !HEROES.includes(u) && u !== 'noble' && ((u !== 'archer' && u !== 'marcher') || view.value!.config.archers));
  return (
    <div class="stack">
      {v.research.length > 0 && (
        <Section title="Research in progress">
          <ul class="queue">
            {v.research.map((j, i) => (
              <li class="queue-item">
                <UnitIcon u={j.unit} size={18} />
                <span class="grow">
                  {unitName(j.unit)} {j.level === 1 ? '(unlock)' : `→ level ${j.level}`}
                  {i === 0 && <Progress from={j.start} to={j.end} />}
                </span>
                <Countdown until={j.end} />
                <Btn small variant="ghost" onClick={() => act({ type: 'cancelResearch', vid: v.id, job: j.id })}>Cancel</Btn>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Weapons & armor">
        <p class="muted small">Level 1 unlocks a unit. Levels 2 and 3 give that unit +5% and +10% attack and defense.</p>
        <div class="table-scroll">
          <table class="build-table">
            <thead><tr><th>Unit</th><th>Level</th><th>Next</th><th /></tr></thead>
            <tbody>
              {units.map((u) => {
                const chk = h.researchCheck(v.id, u);
                const cur = v.tech[u] ?? (UNITS[u].research ? 0 : 1);
                const maxed = chk.reason === 'Fully researched.';
                return (
                  <tr>
                    <td><span class="uname"><UnitIcon u={u} size={20} /> {unitName(u)}</span></td>
                    <td class="num">{cur === 0 ? <span class="muted">locked</span> : `${cur} (${Math.round((techMultiplier(cur) - 1) * 100)}%)`}</td>
                    <td>{maxed ? <span class="muted">—</span> : chk.reason?.startsWith('Requires') ? <span class="muted small">{chk.reason}</span> : <Cost cost={chk.cost} have={have} time={chk.time} compact />}</td>
                    <td class="right">
                      {!maxed && !chk.reason?.startsWith('Requires') && (
                        <Btn small disabled={!chk.ok} title={chk.reason} onClick={() => act({ type: 'research', vid: v.id, unit: u }, `${unitName(u)} research started.`)}>
                          {chk.level === 1 ? 'Research' : `Level ${chk.level}`}
                        </Btn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ---------- academy ----------

function AcademyPanel({ v }: { v: VillageView }) {
  const pv = view.value!;
  const n = pv.me.nobles;
  const have = liveRes(v);
  const [coins, setCoins] = useState<number | ''>(1);
  const maxCoins = Math.floor(Math.min(have.wood / COIN_COST.wood, have.clay / COIN_COST.clay, have.iron / COIN_COST.iron));
  const h = host.value!;
  const chk = h.recruitCheck(v.id, 'noble', 1);
  return (
    <div class="stack">
      <RecruitQueue v={v} b="academy" />
      <div class="grid-2">
        <Section title="Crowns">
          <p>
            Every nobleman needs crowns minted in advance: the first needs <b>1</b>, the second <b>2</b> more, the third <b>3</b> more, and so on.
            Each village you already rule (beyond your first) counts as a nobleman used.
          </p>
          <dl class="facts">
            <dt>Crowns minted</dt><dd class="num">{n.coins}</dd>
            <dt>Noblemen supported</dt><dd class="num">{n.allowed}</dd>
            <dt>Used (noblemen + extra villages)</dt><dd class="num">{n.used}</dd>
            <dt>Can train now</dt><dd class="num">{n.canTrain}</dd>
            {n.canTrain === 0 && <><dt>Crowns for the next</dt><dd class="num">{n.coinsNeeded}</dd></>}
          </dl>
          <div class="row gap wrap">
            <Cost cost={COIN_COST} have={have} compact />
            <NumInput id="mint-count" value={coins} max={maxCoins} onInput={setCoins} />
            <Btn disabled={!coins || maxCoins < 1} onClick={() => act({ type: 'mintCoin', vid: v.id, count: Number(coins) }, 'Crowns minted.')}>Mint</Btn>
          </div>
        </Section>
        <Section title="Nobleman">
          <p class="muted">{UNITS.noble.description} Each nobleman who survives a won battle lowers loyalty by 20–35. Loyalty slowly recovers.</p>
          <Cost cost={UNITS.noble.cost} have={have} pop={UNITS.noble.pop} time={h.recruitTime(v.id, 'noble')} />
          <div class="row gap">
            <Btn disabled={!chk.ok} onClick={() => act({ type: 'recruit', vid: v.id, unit: 'noble', count: 1 }, 'A nobleman begins his training.')}>Train nobleman</Btn>
            {!chk.ok && <span class="reason">{chk.reason}</span>}
          </div>
          <p class="small muted">Noblemen at home: <b class="num">{v.units.noble ?? 0}</b></p>
        </Section>
      </div>
    </div>
  );
}

// ---------- statue: the village hero ----------

function StatuePanel({ v }: { v: VillageView }) {
  const pv = view.value!;
  const pal = pv.me.paladin;
  const h = host.value!;
  const have = liveRes(v);
  if (!pv.config.paladin) return <Section><Empty>Heroes are disabled in this world.</Empty></Section>;
  const home = HEROES.find((u) => (v.units[u] ?? 0) > 0);
  const training = v.recruit.statue.find((j) => HEROES.includes(j.unit))?.unit;
  const current = home ?? training;
  const sworn = v.hero;
  const chk0 = h.recruitCheck(v.id, 'sorcerer', 1);
  const away = !current && !chk0.ok && /already has a hero/.test(chk0.reason ?? '');
  return (
    <div class="stack">
      <RecruitQueue v={v} b="statue" />
      <Section title="Village hero">
        <p class="muted">
          Every village with a statue may keep one hero. Heroes fight beside your troops and are especially strong
          against one kind of enemy, so pick the one that answers the armies around you.
        </p>
        {current && (
          <p class="hero-current">
            <Icon name={current} size={22} /> <b>{unitName(current)}</b> {home ? 'guards this village.' : 'is in training.'}
          </p>
        )}
        {away && <p class="hero-current"><Icon name="attack" size={18} /> This village's hero is away from home.</p>}
        {sworn && !current && !away && (
          <p class="hero-current"><Icon name={sworn} size={22} /> This statue is sworn to the <b>{unitName(sworn)}</b>. It can raise a new one, but never another kind of hero.</p>
        )}
        {!sworn && <p class="muted small">Choose carefully: the first hero trained here is the only kind this village will ever raise, and its look becomes the village's.</p>}
        <div class="hero-grid">
          {HEROES.map((u) => {
            const d = UNITS[u];
            const info = HERO_INFO[u];
            const chk = h.recruitCheck(v.id, u, 1);
            const mine = current === u;
            return (
              <article class={`hero-card hero-${u} ${mine ? 'is-mine' : ''} ${sworn && sworn !== u ? 'is-locked' : ''}`}>
                <header>
                  <span class="hero-portrait"><UnitIcon u={u} size={44} /></span>
                  <div>
                    <h3>{d.name}</h3>
                    <span class="hero-vs">Strong against <b>{info.vsLabel}</b></span>
                  </div>
                </header>
                <p class="small">{d.description}</p>
                <ul class="hero-perks">
                  {info.perks.map((p) => <li>{p}</li>)}
                </ul>
                <dl class="hero-stats">
                  <dt>Attack</dt><dd class="num">{d.attack}</dd>
                  <dt>Defense</dt><dd class="num">{d.def[0]} / {d.def[1]} / {d.def[2]}</dd>
                  <dt>Speed</dt><dd class="num">{d.speed} min/field</dd>
                  {d.carry > 0 && <><dt>Carries</dt><dd class="num">{d.carry}</dd></>}
                </dl>
                {mine ? <span class="pill">Your hero</span> : sworn && sworn !== u ? (
                  <span class="muted small">This village is sworn to the {unitName(sworn)}.</span>
                ) : (
                  <>
                    <Cost cost={d.cost} have={have} pop={d.pop} time={h.recruitTime(v.id, u)} />
                    <div class="row gap">
                      <Btn small disabled={!chk.ok} onClick={() => act({ type: 'recruit', vid: v.id, unit: u, count: 1 }, `${d.name} answers the call.`)}>Train {d.name}</Btn>
                    </div>
                    {!chk.ok && !current && !away && <span class="reason">{chk.reason}</span>}
                  </>
                )}
              </article>
            );
          })}
        </div>
      </Section>
      <HeroItems kind={current ?? sworn ?? null} />
    </div>
  );
}

/**
 * The legendary items of this village's kind of hero: each kind finds its own,
 * and the one equipped goes into battle with every hero of that kind.
 */
function HeroItems({ kind }: { kind: UnitId | null }) {
  const pv = view.value!;
  if (!kind) {
    return (
      <Section title="Legendary items">
        <p class="muted small">Every kind of hero hunts for its own legendary items. Train a hero here and it starts searching.</p>
      </Section>
    );
  }
  const gear = pv.me.heroGear[kind];
  const theme = themeOfHero(kind);
  const heroName = UNITS[kind].name;
  return (
    <Section title={`${heroName}'s legendary items`}>
      <p class="muted small">
        Your {heroName.toLowerCase()}s search for legendary items, one roughly every <span class="num">{fmtDur((24 * 3600_000) / pv.config.speed / warp.value)}</span>.
        The equipped item goes into battle with every {heroName.toLowerCase()} of yours, boosting the troops it fights beside.
        {!gear && ` Train a ${heroName.toLowerCase()} to start finding them.`}
      </p>
      <div class="items">
        {itemsFor(kind, pv.config.archers).map((it) => {
          const found = gear?.items.includes(it.id);
          const eq = gear?.equipped === it.id;
          return (
            <div class={`item ${found ? '' : 'is-missing'} ${eq ? 'is-equipped' : ''}`}>
              <div class="item-head">
                {it.unit ? <UnitIcon u={it.unit} size={20} theme={theme} /> : <Icon name={kind} size={20} />}
                <b>{found ? it.name : 'Undiscovered'}</b>
              </div>
              <p class="small">{found ? it.description : `Your ${heroName.toLowerCase()} has not found this yet.`}</p>
              {found && (eq
                ? <Btn small variant="quiet" onClick={() => act({ type: 'equip', item: null, hero: kind }, `${it.name} put away.`)}>Equipped · put away</Btn>
                : <Btn small variant="ghost" onClick={() => act({ type: 'equip', item: it.id }, `${it.name} equipped.`)}>Equip</Btn>)}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ---------- info panels ----------

function LevelTable({ title, cur, max, fn, note }: { title: string; cur: number; max: number; fn: (l: number) => string; note?: string }) {
  const levels = Array.from({ length: 6 }, (_, i) => Math.max(1, cur - 1) + i).filter((l) => l <= max);
  return (
    <Section title={title}>
      {note && <p class="muted">{note}</p>}
      <table class="level-table">
        <thead><tr><th>Level</th><th class="right">{title}</th></tr></thead>
        <tbody>
          {levels.map((l) => (
            <tr class={l === cur ? 'is-current' : ''}><td class="num">{l}</td><td class="right num">{fn(l)}</td></tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function ProductionPanel({ v, id }: { v: VillageView; id: 'timber' | 'claypit' | 'ironmine' }) {
  const k: ResKey = id === 'timber' ? 'wood' : id === 'claypit' ? 'clay' : 'iron';
  const speed = view.value!.config.speed;
  const bonus = v.rates[k] / Math.max(1, mineRate(v.buildings[id], speed));
  return (
    <div class="stack">
      <Section title="Production">
        <p class="big-stat"><Icon name={k} size={28} /> <span class="num">{fmt(v.rates[k])}</span> <span class="muted">per hour</span></p>
        {bonus > 1.01 && <p class="muted small">Includes a {Math.round((bonus - 1) * 100)}% bonus.</p>}
      </Section>
      <LevelTable title="Per hour" cur={v.buildings[id]} max={30} fn={(l) => fmt(mineRate(l, speed) * bonus)} />
    </div>
  );
}

function WarehousePanel({ v }: { v: VillageView }) {
  const res = liveRes(v);
  return (
    <div class="stack">
      <Section title="Storage">
        <div class="storage-rows">
          {(['wood', 'clay', 'iron'] as ResKey[]).map((k) => {
            const full = res[k] >= v.storage;
            const eta = ((v.storage - res[k]) / Math.max(1, v.rates[k])) * 3600_000;
            return (
              <div class="storage-row">
                <Icon name={k} size={20} />
                <div class="grow">
                  <div class="progress tone-accent"><div style={{ width: `${Math.min(100, (res[k] / v.storage) * 100)}%` }} /></div>
                </div>
                <span class="num">{fmt(res[k])}/{fmt(v.storage)}</span>
                <span class="muted small">{full ? 'full' : `full in ${fmtDur(eta / warp.value)}`}</span>
              </div>
            );
          })}
        </div>
      </Section>
      <LevelTable title="Capacity" cur={v.buildings.warehouse} max={30} fn={(l) => fmt(storageCap(l, v.bonus))} />
    </div>
  );
}

function FarmPanel({ v }: { v: VillageView }) {
  const home = unitsPop(v.units);
  const queued = (['barracks', 'stable', 'workshop', 'academy', 'statue'] as RecruitBuilding[])
    .reduce((s, b) => s + v.recruit[b].reduce((a, j) => a + (j.count - j.done) * UNITS[j.unit].pop, 0), 0);
  const troopsTotal = v.popUsed;
  const militiaActive = v.militiaUntil !== undefined && v.militiaUntil > now.value;
  const militia = Math.floor(v.popMax * 0.1 + v.buildings.farm * 20);
  return (
    <div class="stack">
      <Section title="Population">
        <p class="big-stat"><Icon name="pop" size={28} /> <span class="num">{fmt(v.popUsed)}</span> <span class="muted">of {fmt(v.popMax)}</span></p>
        <div class="progress tone-accent"><div style={{ width: `${Math.min(100, (v.popUsed / v.popMax) * 100)}%` }} /></div>
        <dl class="facts">
          <dt>Troops at home</dt><dd class="num">{fmt(home)}</dd>
          <dt>In training</dt><dd class="num">{fmt(queued)}</dd>
          <dt>Buildings &amp; troops away</dt><dd class="num">{fmt(Math.max(0, troopsTotal - home - queued))}</dd>
          <dt>Free</dt><dd class="num">{fmt(v.popMax - v.popUsed)}</dd>
        </dl>
      </Section>
      <Section title="Militia">
        <p>
          In an emergency, farmhands take up pitchforks: <b class="num">{fmt(militia)}</b> militia defend the village for{' '}
          <span class="num">{fmtDur((6 * 3600_000) / view.value!.config.speed / warp.value)}</span>. While they stand guard, production is halved.
        </p>
        {militiaActive ? (
          <p class="warn-text">The militia is on guard for another <Countdown until={v.militiaUntil!} />.</p>
        ) : (
          <Btn variant="danger" onClick={() => act({ type: 'militia', vid: v.id }, 'The militia has been called to arms!')}>Call the militia</Btn>
        )}
      </Section>
      <LevelTable title="Population limit" cur={v.buildings.farm} max={30} fn={(l) => fmt(farmCap(l, v.bonus))} />
    </div>
  );
}

function WallPanel({ v }: { v: VillageView }) {
  const l = v.buildings.wall;
  return (
    <div class="stack">
      <Section title="Defense">
        <p class="big-stat"><Icon name="shield" size={26} /> <span class="num">+{Math.round((wallMultiplier(l) - 1) * 100)}%</span> <span class="muted">defense, plus {fmt(wallBase(l))} basic defense</span></p>
        <p class="muted">Rams knock the wall down during and after battle. Catapults can target it too.</p>
      </Section>
      <LevelTable title="Bonus" cur={l} max={20} fn={(x) => `+${Math.round((wallMultiplier(x) - 1) * 100)}% · +${fmt(wallBase(x))}`} />
    </div>
  );
}

export { researchCost, ITEM_BY_ID, UnitList };
