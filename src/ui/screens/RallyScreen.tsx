import type { VillageTheme } from '../../engine/data/themes';
import type { ComponentChildren } from 'preact';
import { signal } from '@preact/signals';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { BUILDINGS, BUILDING_ORDER } from '../../engine/data/buildings';
import { ARMY_ORDER, UNITS, UNIT_ORDER, HEROES } from '../../engine/data/units';
import { SCAVENGE_TIERS, distance, hasUnits, sighted, unitsCarry, watchtowerRange } from '../../engine/formulas';
import type { BuildingId, UnitId, Units } from '../../engine/types';
import type { CommandView, VillageView } from '../../engine/view';
import { Icon } from '../art/icons';
import { Btn, Clock, Cost, Countdown, Empty, NumInput, Progress, Section, Tabs, UnitList, UnitTable, VillageLink, UnitIcon, unitName } from '../components/common';
import { FARM_PRESETS, loadFarmMode, saveFarmMode, type FarmModeChoice, MAX_TEMPLATES, TEMPLATE_NAME_MAX, defaultTplName, loadFarmTemplates, saveFarmTemplates, tplName, type FarmTemplate } from '../farmTemplates';
import { coords, fmt, fmtAgo, fmtDur, parseCoords } from '../format';
import { act, host, now, rallyTarget, toast, view, warp, usePane } from '../store';
import { Simulator } from './Simulator';
import { cacheSupport } from '../caches';

type Tab = 'send' | 'train' | 'troops' | 'commands' | 'farm' | 'scavenge' | 'sim';

/** The send form's columns, as Tribal Wars lays them out. */
const SEND_GROUPS: { label: string; units: UnitId[] }[] = [
  { label: 'Infantry', units: ['spear', 'sword', 'axe', 'archer'] },
  { label: 'Cavalry', units: ['scout', 'light', 'marcher', 'heavy'] },
  { label: 'Siege', units: ['ram', 'catapult'] },
  { label: 'Heroes & nobles', units: [...HEROES, 'noble'] },
];

export function RallyScreen({ tab }: { tab?: string }) {
  const pane = usePane();
  const [t, setT] = useState<Tab>((tab as Tab) || 'send');
  useEffect(() => { if (tab) setT(tab as Tab); }, [tab]);
  const pv = view.value!;
  const v = pane.village.value!;
  const incoming = pv.incoming.filter((c) => c.kind === 'attack').length;
  const farming = pv.commands.filter((c) => c.repeat && c.fromVid === v.id).length;
  return (
    <div class="stack">
      <Tabs<Tab>
        active={t}
        onChange={setT}
        tabs={[
          { id: 'send', label: 'Send troops' },
          { id: 'train', label: 'Noble train' },
          { id: 'troops', label: 'Troops' },
          { id: 'commands', label: 'Movements', badge: incoming },
          { id: 'farm', label: <>🌾 Farm assistant</>, badge: farming },
          { id: 'scavenge', label: 'Scavenging' },
          { id: 'sim', label: 'Simulator' },
        ]}
      />
      {t === 'send' && <SendTroops v={v} />}
      {t === 'train' && <NobleTrain v={v} />}
      {t === 'troops' && <TroopsTab v={v} />}
      {t === 'commands' && <CommandsTab />}
      {t === 'farm' && <FarmAssistant v={v} />}
      {t === 'scavenge' && <Scavenge v={v} />}
      {t === 'sim' && <Simulator />}
    </div>
  );
}

/** The target typed on the rally point, shared by Send troops and Noble train so it carries over between the tabs. */
const draftTarget = signal('');

// ---------- send ----------

const sendable = (u: UnitId) => u !== 'militia';

function SendTroops({ v }: { v: VillageView }) {
  const pane = usePane();
  const h = host.value!;
  const pv = view.value!;
  const pre = rallyTarget.value;
  if (pre) draftTarget.value = coords(pre.x, pre.y);
  const target = draftTarget.value;
  const setTarget = (t: string) => { draftTarget.value = t; };
  const [units, setUnits] = useState<Units>((pre?.units as Units) ?? {});
  const [cat, setCat] = useState<BuildingId | ''>('');
  useEffect(() => {
    if (pre) {
      setTarget(coords(pre.x, pre.y));
      if (pre.units) setUnits(pre.units as Units);
      if (pre.cat) setCat(pre.cat);
      rallyTarget.value = null;
    }
  }, [pre]);
  const xy = parseCoords(target);
  const tid = xy ? h.villageAt(xy[0], xy[1]) : undefined;
  const info = tid !== undefined ? h.villageInfo(tid, v.id) : null;
  const chosen: Units = {};
  for (const u of UNIT_ORDER) {
    const n = Math.min(units[u] ?? 0, v.units[u] ?? 0);
    if (n > 0) chosen[u] = n;
  }
  const any = hasUnits(chosen);
  // a resource cache takes support only from rulers who have won a battle there (their own reports tell)
  const cacheOk = info?.cache && tid !== undefined ? cacheSupport(h.reports(), { id: tid, endsAt: info.cache.endsAt }, pv.me.id) : null;
  const dur = tid !== undefined && any ? h.travelTime(v.id, tid, chosen) : 0;
  const supportDur = tid !== undefined && any ? h.travelTime(v.id, tid, chosen, true) : 0;
  const send = (kind: 'attack' | 'support') => {
    if (tid === undefined) return;
    const ok = act(
      { type: 'send', vid: v.id, target: tid, kind, units: chosen, catTarget: cat || undefined },
      `${kind === 'attack' ? 'Attack' : 'Support'} sent to ${info?.name}. Arrives in ${fmtDur((kind === 'support' ? supportDur : dur) / warp.value)}.`,
    );
    if (ok) setUnits({});
  };
  const available = UNIT_ORDER.filter((u) => sendable(u) && (v.units[u] ?? 0) > 0);
  const recent = useMemo(() => recentTargets(pv.commands, v.id), [pv.commands.length, v.id]);
  return (
    <div class="grid-send">
      <Section title="Troops">
        {available.length === 0 ? <Empty>No troops at home.</Empty> : (
          <div class="send-groups">
            {SEND_GROUPS.map((g) => {
              const list = g.units.filter((u) => available.includes(u));
              if (list.length === 0) return null;
              return (
                <fieldset class="send-group">
                  <legend>{g.label}</legend>
                  {list.map((u) => (
                    <label class="send-row" title={unitName(u)}>
                      <UnitIcon u={u} size={22} />
                      <span class="send-name">{unitName(u)}</span>
                      <NumInput id={`send-${u}`} value={units[u] ?? ''} max={v.units[u] ?? 0} onInput={(n) => setUnits({ ...units, [u]: n === '' ? 0 : n })} />
                    </label>
                  ))}
                </fieldset>
              );
            })}
          </div>
        )}
        <div class="row gap wrap">
          <Btn small variant="ghost" onClick={() => setUnits({ ...v.units, militia: 0 })}>All troops</Btn>
          <Btn small variant="ghost" onClick={() => setUnits(pick(v.units, ['axe', 'light', 'marcher', 'ram', 'catapult', 'heavy']))}>All offensive</Btn>
          <Btn small variant="ghost" onClick={() => setUnits(pick(v.units, ['spear', 'sword', 'archer', 'heavy']))}>All defensive</Btn>
          <Btn small variant="quiet" onClick={() => setUnits({})}>Clear</Btn>
        </div>
      </Section>
      <Section title="Target">
        <div class="row gap wrap">
          <label class="field grow">
            <span>Coordinates</span>
            <input id="send-target" placeholder="e.g. 512|498" value={target} onInput={(e) => setTarget(e.currentTarget.value)} />
          </label>
          <Btn small variant="ghost" onClick={() => pane.go({ name: 'map', focus: tid ?? v.id })}>Pick on map</Btn>
        </div>
        {recent.length > 0 && (
          <div class="chips">
            {recent.map((r) => (
              <button type="button" class="chip" onClick={() => setTarget(coords(r.x, r.y))}>{r.name} ({coords(r.x, r.y)})</button>
            ))}
          </div>
        )}
        {xy && tid === undefined && <p class="reason">No village at {coords(xy[0], xy[1])}.</p>}
        {info && (
          <div class="target-card">
            <div>
              <b>{info.name}</b> <span class="muted">({coords(info.x, info.y)})</span>
              {info.cache ? (
                <>
                  <div class="muted small">Guards level <b class="num">{info.cache.level}</b> · <Countdown until={info.cache.endsAt} done="ending now" /> left</div>
                  <div class="small cache-note"><Icon name="cache" size={14} /> Resource cache: no noblemen, catapults only hit the wall, nothing to loot.</div>
                </>
              ) : (
                <div class="muted small">
                  {info.own ? 'Your village' : info.ownerName}{info.tribe ? ` [${info.tribe}]` : ''} · <span class="num">{fmt(info.points)}</span> points
                  {info.protected && ' · under protection'}
                </div>
              )}
              {info.intel?.lastColor && <div class="small">Last report: <span class={`dot dot-${info.intel.lastColor}`} /> {fmtAgo(info.intel.lastAttackT ?? info.intel.t, now.value)}{info.intel.wall !== undefined ? ` · wall ${info.intel.wall}` : ''}</div>}
            </div>
            <div class="right">
              <div class="muted small">Distance</div>
              <b class="num">{info.distanceFrom?.toFixed(1)}</b>
            </div>
          </div>
        )}
        {any && tid !== undefined && (
          <dl class="facts">
            <dt>Travel time</dt><dd class="num">{fmtDur(dur / warp.value)}</dd>
            <dt>Arrives</dt><dd><Clock t={now.value + dur} /></dd>
            <dt>Loot capacity</dt><dd class="num">{fmt(unitsCarry(chosen))}</dd>
          </dl>
        )}
        {(chosen.catapult ?? 0) > 0 && (
          <label class="field">
            <span>Catapult target</span>
            <select id="cat-target" value={info?.cache ? 'wall' : cat} onChange={(e) => setCat((e.currentTarget as HTMLSelectElement).value as BuildingId)}>
              {info?.cache ? <option value="wall">{BUILDINGS.wall.name} (the only target at a cache)</option> : <>
                <option value="">Random building</option>
                {BUILDING_ORDER.filter((b) => b !== 'rally').map((b) => <option value={b}>{BUILDINGS[b].name}</option>)}
              </>}
            </select>
          </label>
        )}
        <div class="row gap">
          <Btn variant="danger" disabled={!any || tid === undefined} onClick={() => send('attack')}>
            <Icon name="attack" size={16} /> Attack
          </Btn>
          <Btn variant="ghost" disabled={!any || tid === undefined || !info || (!!info.cache && !cacheOk?.ok) || (chosen.noble ?? 0) > 0} title={cacheOk && !cacheOk.ok ? cacheOk.reason : undefined} onClick={() => send('support')}>
            <Icon name="support" size={16} /> Support
          </Btn>
        </div>
        {cacheOk && !cacheOk.ok && <p class="reason">{cacheOk.reason}</p>}
      </Section>
    </div>
  );
}

// ---------- noble train ----------

const ESCORT_UNITS: UnitId[] = ['axe', 'light', 'heavy', 'spear', 'sword', 'marcher'];

function NobleTrain({ v }: { v: VillageView }) {
  const [mode, setMode] = useState<'real' | 'fake'>('real');
  return (
    <div class="stack">
      <div class="chips" role="group" aria-label="Train type">
        <button type="button" class={`chip ${mode === 'real' ? 'is-on' : ''}`} aria-pressed={mode === 'real'} onClick={() => setMode('real')}>👑 Real noble train</button>
        <button type="button" class={`chip ${mode === 'fake' ? 'is-on' : ''}`} aria-pressed={mode === 'fake'} onClick={() => setMode('fake')}>🎭 Fake noble train</button>
      </div>
      {mode === 'real' ? <RealTrain v={v} /> : <FakeTrain v={v} />}
    </div>
  );
}

/** Token units for fakes, slowest first so the waves march at a siege/noble-like pace. */
const FAKE_UNITS: UnitId[] = ['catapult', 'ram', 'sword', 'spear', 'axe', 'archer', 'heavy', 'light', 'marcher', 'scout'];

/**
 * A fake train: the same back-to-back waves as a real one, but each wave is a
 * token force with no nobleman — to the defender it lands like a train, so they
 * have to guess which of your trains is the real one. Several targets at once.
 */
function FakeTrain({ v }: { v: VillageView }) {
  const h = host.value!;
  const avail = FAKE_UNITS.filter((u) => (v.units[u] ?? 0) > 0);
  const [unit, setUnit] = useState<UnitId | ''>('');
  const u = (unit && avail.includes(unit) ? unit : avail[0]) as UnitId | undefined;
  const [per, setPer] = useState(1);
  const [count, setCount] = useState(4);
  const [list, setList] = useState(draftTarget.value);
  const waves = Math.max(2, Math.min(6, count));
  const size = Math.max(1, per);
  const targets = (list.match(/\d+\s*\|\s*\d+/g) ?? [])
    .map((t) => parseCoords(t))
    .map((xy) => (xy ? h.villageAt(xy[0], xy[1]) : undefined))
    .filter((id, i, a): id is number => id !== undefined && a.indexOf(id) === i)
    .map((id) => h.villageInfo(id, v.id)!)
    .filter((i) => i && !i.own);
  const needPer = waves * size;
  const have = u ? v.units[u] ?? 0 : 0;
  const canDo = u ? Math.min(targets.length, Math.floor(have / needPer)) : 0;
  const sendAll = () => {
    if (!u) return;
    let sent = 0;
    for (const t of targets.slice(0, canDo)) {
      const w: Units[] = Array.from({ length: waves }, () => ({ [u]: size }));
      if (!act({ type: 'train', vid: v.id, target: t.id, waves: w })) break;
      sent++;
    }
    if (sent) toast(`${sent} fake ${sent === 1 ? 'train' : 'trains'} of ${waves} waves on the way.`, 'good');
  };
  return (
    <div class="grid-send">
      <Section title="Fake waves">
        <p class="muted small">
          Each fake lands {waves} tiny attacks 100 ms apart, just like a real train, but without noblemen. Mix them in
          with a real train so the defender can't tell which village to stack.
        </p>
        {!u ? <Empty>No troops at home to fake with.</Empty> : (
          <div class="row gap wrap">
            <label class="field">
              <span>Unit per wave</span>
              <select id="fake-unit" value={u} onChange={(e) => setUnit((e.currentTarget as HTMLSelectElement).value as UnitId)}>
                {avail.map((x) => <option value={x}>{unitName(x, true)} ({fmt(v.units[x] ?? 0)} home)</option>)}
              </select>
            </label>
            <label class="field">
              <span>How many per wave</span>
              <input id="fake-per" type="number" min={1} value={per} style={{ width: '80px' }} onInput={(e) => setPer(Math.max(1, Number(e.currentTarget.value) || 1))} />
            </label>
            <label class="field">
              <span>Waves (2–6)</span>
              <input id="fake-waves" type="number" min={2} max={6} value={count} style={{ width: '80px' }} onInput={(e) => setCount(Number(e.currentTarget.value) || 2)} />
            </label>
          </div>
        )}
        <p class="small muted">Tip: catapults or rams march slowly, so the fake arrives on a pace close to a real noble train.</p>
      </Section>
      <Section title="Targets">
        <label class="field">
          <span>Coordinates — one or more, e.g. 500|500 502|498</span>
          <textarea id="fake-targets" rows={3} placeholder="x|y x|y …" value={list} onInput={(e) => setList(e.currentTarget.value)} />
        </label>
        {targets.length > 0 && (
          <ul class="train-list">
            {targets.map((t, i) => (
              <li class={i < canDo ? '' : 'muted'}>
                <b>{t.name}</b> <span class="muted">({coords(t.x, t.y)}) · {t.ownerName}</span>
                {u && <> · lands <Clock t={now.value + h.travelTime(v.id, t.id, { [u]: size })} /></>}
              </li>
            ))}
          </ul>
        )}
        {u && targets.length > 0 && canDo < targets.length && (
          <p class="reason">Enough {unitName(u, true).toLowerCase()} for {canDo} of {targets.length} ({needPer} per target, {fmt(have)} at home).</p>
        )}
        <Btn variant="danger" disabled={!u || canDo === 0} onClick={sendAll}>
          🎭 Send {canDo || ''} fake {canDo === 1 ? 'train' : 'trains'}
        </Btn>
      </Section>
    </div>
  );
}

function RealTrain({ v }: { v: VillageView }) {
  const h = host.value!;
  const pre = rallyTarget.value;
  if (pre) draftTarget.value = coords(pre.x, pre.y);
  const target = draftTarget.value;
  const setTarget = (t: string) => { draftTarget.value = t; };
  const [clear, setClear] = useState<Units>({});
  useEffect(() => { if (pre) rallyTarget.value = null; }, [pre]);
  const [nobles, setNobles] = useState(Math.min(4, v.units.noble ?? 0));
  const [escortUnit, setEscortUnit] = useState<UnitId>('axe');
  const [escort, setEscort] = useState<number | ''>(50);
  const [cat, setCat] = useState<BuildingId | ''>('');
  const xy = parseCoords(target);
  const tid = xy ? h.villageAt(xy[0], xy[1]) : undefined;
  const info = tid !== undefined ? h.villageInfo(tid, v.id) : null;
  const haveNobles = v.units.noble ?? 0;
  const n = Math.max(0, Math.min(nobles, haveNobles, 5));
  const esc = Number(escort || 0);
  const waves: Units[] = [];
  const clearing: Units = {};
  for (const u of UNIT_ORDER) if ((clear[u] ?? 0) > 0) clearing[u] = clear[u];
  if (hasUnits(clearing)) waves.push(clearing);
  for (let i = 0; i < n; i++) waves.push(esc > 0 ? { noble: 1, [escortUnit]: esc } : { noble: 1 });
  // what's left at home for the clearing wave after escorts are reserved
  const reserved = esc * n;
  const clearMax = (u: UnitId) => Math.max(0, (v.units[u] ?? 0) - (u === escortUnit ? reserved : 0));
  const dur = tid !== undefined && waves.length ? Math.max(...waves.map((w) => h.travelTime(v.id, tid, w))) : 0;
  const offensive = UNIT_ORDER.filter((u) => u !== 'noble' && u !== 'militia' && (v.units[u] ?? 0) > 0);
  return (
    <div class="grid-send">
      <Section title="Waves">
        <p class="muted small">
          A train lands several attacks one right after another, 100 ms apart. The first wave clears the defenders and
          the walls, then each nobleman lowers loyalty by 20–35 before it can recover.
        </p>
        <h4>1 · Clearing wave</h4>
        {offensive.length === 0 ? <Empty>No troops at home.</Empty> : (
          <div class="unit-inputs compact">
            {offensive.map((u) => (
              <label class="unit-input">
                <span class="uname" title={unitName(u)}><UnitIcon u={u} size={18} /> {unitName(u)}</span>
                <NumInput id={`train-${u}`} value={clear[u] ?? ''} max={clearMax(u)} onInput={(x) => setClear({ ...clear, [u]: x === '' ? 0 : Math.min(x, clearMax(u)) })} />
              </label>
            ))}
          </div>
        )}
        <h4>2 · Noblemen</h4>
        <div class="row gap wrap">
          <label class="field">
            <span>Noblemen ({haveNobles} at home)</span>
            <input id="train-nobles" type="number" min={0} max={Math.min(5, haveNobles)} value={n} onInput={(e) => setNobles(Math.max(0, Number(e.currentTarget.value) || 0))} />
          </label>
          <label class="field">
            <span>Escort per nobleman</span>
            <span class="row gap">
              <input id="train-escort" type="number" min={0} value={escort} style={{ width: '80px' }} onInput={(e) => setEscort(e.currentTarget.value === '' ? '' : Math.max(0, Number(e.currentTarget.value)))} />
              <select id="train-escort-unit" value={escortUnit} onChange={(e) => setEscortUnit((e.currentTarget as HTMLSelectElement).value as UnitId)}>
                {ESCORT_UNITS.map((u) => <option value={u}>{unitName(u, true)}</option>)}
              </select>
            </span>
          </label>
        </div>
        {haveNobles === 0 && <p class="reason">Train noblemen in the academy first.</p>}
      </Section>
      <Section title="Target">
        <label class="field">
          <span>Coordinates</span>
          <input id="train-target" placeholder="x|y" value={target} onInput={(e) => setTarget(e.currentTarget.value)} />
        </label>
        {info && (
          <div class="target-card">
            <div>
              <b>{info.name}</b> <span class="muted">({coords(info.x, info.y)})</span>
              <div class="muted small">{info.ownerName} · <span class="num">{fmt(info.points)}</span> points</div>
              {info.intel?.units && <div class="small">Last seen: <UnitList units={info.intel.units} empty="no troops" theme={info.theme} /></div>}
            </div>
          </div>
        )}
        {waves.length > 0 && tid !== undefined && (
          <>
            <ol class="train-list">
              {waves.map((w, i) => (
                <li><span class="muted small">+{i * 100} ms</span> <UnitList units={w} /></li>
              ))}
            </ol>
            <dl class="facts">
              <dt>Lands</dt><dd><Clock t={now.value + dur} /> <span class="muted">({fmtDur(dur / warp.value)})</span></dd>
            </dl>
          </>
        )}
        {(clearing.catapult ?? 0) > 0 && (
          <label class="field">
            <span>Catapult target</span>
            <select id="train-cat" value={cat} onChange={(e) => setCat((e.currentTarget as HTMLSelectElement).value as BuildingId)}>
              <option value="">Random building</option>
              {BUILDING_ORDER.filter((b) => b !== 'rally').map((b) => <option value={b}>{BUILDINGS[b].name}</option>)}
            </select>
          </label>
        )}
        <Btn
          variant="danger"
          disabled={tid === undefined || waves.length < 2 || n === 0}
          onClick={() => {
            if (tid !== undefined && act({ type: 'train', vid: v.id, target: tid, waves, catTarget: cat || undefined }, `Noble train of ${waves.length} waves is on its way.`)) setClear({});
          }}
        >
          <Icon name="noble" size={16} /> Send noble train
        </Btn>
      </Section>
    </div>
  );
}

function pick(u: Units, keys: UnitId[]): Units {
  const o: Units = {};
  for (const k of keys) if ((u[k] ?? 0) > 0) o[k] = u[k];
  return o;
}

function recentTargets(cmds: CommandView[], vid: number) {
  const seen = new Map<number, { name: string; x: number; y: number }>();
  for (const c of cmds) {
    if (c.fromVid !== vid || c.kind === 'return' || c.kind === 'tradeback') continue;
    if (!seen.has(c.toVid)) seen.set(c.toVid, { name: c.toName, x: c.toX, y: c.toY });
  }
  return [...seen.values()].slice(0, 6);
}

// ---------- troops ----------

function TroopsTab({ v }: { v: VillageView }) {
  const pv = view.value!;
  const away: Units = {};
  for (const c of pv.commands) {
    if (c.fromVid !== v.id || !c.units) continue;
    for (const k in c.units) away[k as UnitId] = (away[k as UnitId] ?? 0) + (c.units[k as UnitId] ?? 0);
  }
  const stationedTotal: Units = {};
  for (const s of v.stationed) for (const k in s.units) stationedTotal[k as UnitId] = (stationedTotal[k as UnitId] ?? 0) + (s.units[k as UnitId] ?? 0);
  const scav: Units = {};
  for (const r of v.scavenge) if (r) for (const k in r.units) scav[k as UnitId] = (scav[k as UnitId] ?? 0) + (r.units[k as UnitId] ?? 0);
  const supportIn: Units = {};
  for (const s of v.support) for (const k in s.units) supportIn[k as UnitId] = (supportIn[k as UnitId] ?? 0) + (s.units[k as UnitId] ?? 0);
  return (
    <div class="stack">
      <Section title="Overview">
        <UnitTable rows={[
          { label: 'At home', units: v.units },
          { label: 'On the move', units: away },
          { label: 'Stationed abroad', units: stationedTotal },
          { label: 'Scavenging', units: scav },
          { label: 'Support here', units: supportIn },
        ]} />
      </Section>
      <Section title="Support in this village">
        {v.support.length === 0 ? <Empty>No foreign troops are stationed here.</Empty> : (
          <ul class="support-list">
            {v.support.map((s) => (
              <SupportRow key={s.fromVid} host={v.id} from={s.fromVid} units={s.units} theme={s.theme} allLabel="Send all home" done="Support sent home.">
                <span>{s.ownerName} · from {s.fromName}</span>
              </SupportRow>
            ))}
          </ul>
        )}
      </Section>
      <Section title="This village's troops abroad">
        {v.stationed.length === 0 ? <Empty>None of this village's troops are stationed elsewhere.</Empty> : (
          <ul class="support-list">
            {v.stationed.map((s) => (
              <SupportRow key={s.hostVid} host={s.hostVid} from={v.id} units={s.units} allLabel="Withdraw all" done="Troops are marching home.">
                <span>In <VillageLink vid={s.hostVid} name={s.hostName} x={s.hostX} y={s.hostY} /> <span class="muted">({s.hostOwner})</span></span>
              </SupportRow>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/**
 * A stack of support troops: send the whole stack home at once, or pick just
 * some of them (the rest stay where they are).
 */
function SupportRow({ host, from, units, theme, allLabel, done, children }: { host: number; from: number; units: Units; theme?: VillageTheme; allLabel: string; done: string; children: ComponentChildren }) {
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState<Units>({});
  const kinds = ARMY_ORDER.filter((u) => (units[u] ?? 0) > 0);
  const chosen: Units = {};
  for (const u of kinds) { const n = Math.min(pick[u] ?? 0, units[u] ?? 0); if (n > 0) chosen[u] = n; }
  const some = Object.keys(chosen).length > 0;
  return (
    <li class={`support-row ${picking ? 'is-picking' : ''}`}>
      {children}
      <UnitList units={units} theme={theme} />
      <span class="row gap">
        <Btn small variant="ghost" onClick={() => act({ type: 'withdraw', host, from }, done)}>{allLabel}</Btn>
        <Btn small variant="quiet" onClick={() => { setPicking(!picking); setPick({}); }}>{picking ? 'Cancel' : 'Choose troops'}</Btn>
      </span>
      {picking && (
        <div class="support-pick">
          {kinds.map((u) => (
            <label class="send-row" title={unitName(u, false, theme)}>
              <UnitIcon u={u} size={20} theme={theme} />
              <span class="send-name">{unitName(u, false, theme)}</span>
              <NumInput value={pick[u] ?? ''} max={units[u] ?? 0} onInput={(n) => setPick({ ...pick, [u]: n === '' ? 0 : n })} />
            </label>
          ))}
          <Btn small disabled={!some} onClick={() => { if (act({ type: 'withdraw', host, from, units: chosen }, done)) { setPicking(false); setPick({}); } }}>Send these home</Btn>
        </div>
      )}
    </li>
  );
}

// ---------- commands ----------

/**
 * An incoming attack close enough that its troops should be made out (past the point where
 * an army comes into plain sight, or inside the watchtower's reach) whose troops still can't
 * be: something in that army hides it from lookouts and sentries. Read at the moment the view
 * was taken, so a stale view never mistakes an ordinary attack for a hidden one.
 */
export function stalkedAttack(c: CommandView): boolean {
  if (c.dir !== 'in' || c.kind !== 'attack' || c.kinds || c.detected) return false;
  const pv = view.value!;
  const t = pv.now;
  if (sighted(t, c.depart, c.arrive)) return true;
  const tower = pv.villages.find((x) => x.id === c.toVid)?.buildings.watchtower ?? 0;
  if (tower <= 0) return false;
  const frac = Math.min(1, Math.max(0, (t - c.depart) / Math.max(1, c.arrive - c.depart)));
  const cx = c.fromX + (c.toX - c.fromX) * frac, cy = c.fromY + (c.toY - c.fromY) * frac;
  return distance(cx, cy, c.toX, c.toY) <= watchtowerRange(tower);
}

/** What the defender can make out of an incoming attack: the lookouts' report, the kinds of troops in sight, or nothing. */
function IncomingIntel({ c }: { c: CommandView }) {
  const seen = c.kinds && c.kinds.length > 0 && (
    <span class="inc-kinds" title={`In sight on the road: ${c.kinds.map((u) => unitName(u, true, c.theme)).join(', ')} (never how many)`}>
      {' · in sight: '}
      {c.kinds.map((u) => <UnitIcon u={u} size={16} theme={c.theme} />)}
    </span>
  );
  if (c.detected) return <> · lookouts report <b>{unitName(c.detected, true, c.theme)}</b>{seen}</>;
  if (seen) return seen;
  if (stalkedAttack(c)) {
    return (
      <span class="inc-stalked" title="The army is close, yet neither lookouts nor sentries can tell what is in it. Something in it moves unseen.">
        {' · '}<Icon name="scout" size={14} /> close, but the troops can't be made out
      </span>
    );
  }
  return <> · troops unknown</>;
}

export function CommandRow({ c, compact }: { c: CommandView; compact?: boolean }) {
  const incoming = c.dir === 'in';
  const kindIcon = c.kind === 'attack' ? 'attack' : c.kind === 'support' ? 'support' : c.kind === 'return' ? 'return' : 'trade';
  let text;
  if (incoming) {
    text = c.kind === 'attack' ? <>Attack from <b>{c.ownerName}</b> ({c.fromName}) on {c.toName}</> : c.kind === 'support' ? <>Support from {c.ownerName} to {c.toName}</> : <>Merchants from {c.ownerName}</>;
  } else if (c.kind === 'return') {
    text = <>Return from {c.originName ?? c.toName}</>;
  } else if (c.kind === 'tradeback') {
    text = <>{(c.units?.trader ?? 0) > 0 ? unitName('trader', true, c.theme) : 'Merchants'} returning to {c.fromName}</>;
  } else if (c.kind === 'trade') {
    text = <>Transport to {c.toName}</>;
  } else {
    text = <>{c.kind === 'attack' ? 'Attack on' : 'Support to'} {c.toName} <span class="muted">({coords(c.toX, c.toY)})</span></>;
  }
  const canCancel = !incoming && c.cancelUntil !== undefined && c.cancelUntil > now.value;
  const cls = incoming && c.kind === 'attack' ? 'is-incoming' : c.kind === 'attack' ? 'is-attack' : c.kind === 'support' ? 'is-support' : 'is-return';
  return (
    <li class={`cmd ${cls}`}>
      <Icon name={kindIcon} size={16} />
      <div class="grow">
        <div>{text}{c.repeat && <span class="pill" title="Repeats automatically while the raids come back clean">repeat</span>}</div>
        {!compact && (
          <div class="muted small">
            {c.units && <UnitList units={c.units} theme={c.theme} />}
            {c.res && <> · carrying <span class="num">{fmt(c.res.wood + c.res.clay + c.res.iron)}</span></>}
            {incoming && c.kind === 'attack' && <IncomingIntel c={c} />}
          </div>
        )}
      </div>
      <div class="right">
        <Countdown until={c.arrive} />
        {!compact && <div class="muted small"><Clock t={c.arrive} /></div>}
      </div>
      {!compact && canCancel && <Btn small variant="ghost" onClick={() => act({ type: 'cancelCommand', id: c.id }, 'Troops recalled.')}>Cancel</Btn>}
      {c.repeat && <Btn small variant="quiet" onClick={() => act({ type: 'stopRepeat', id: c.id }, 'Repeat stopped. The troops come home and stay.')} title="Stop repeating this raid">{compact ? '■ ↻' : 'Stop repeat'}</Btn>}
    </li>
  );
}

function CommandsTab() {
  const pane = usePane();
  const pv = view.value!;
  const [scope, setScope] = useState<'village' | 'all'>('all');
  const v = pane.village.value!;
  const inc = pv.incoming.filter((c) => scope === 'all' || c.toVid === v.id);
  const out = pv.commands.filter((c) => scope === 'all' || c.fromVid === v.id);
  return (
    <div class="stack">
      <div class="row gap">
        <Btn small variant={scope === 'all' ? 'primary' : 'ghost'} onClick={() => setScope('all')}>All villages</Btn>
        <Btn small variant={scope === 'village' ? 'primary' : 'ghost'} onClick={() => setScope('village')}>This village</Btn>
        {out.some((c) => c.repeat) && (
          <Btn small variant="ghost" title={scope === 'all' ? 'Stop every repeating raid from all your villages' : 'Stop every repeating raid from this village'}
            onClick={() => act({ type: 'stopRepeats', vid: scope === 'all' ? undefined : v.id }, 'Repeating raids stopped. The troops come home and stay.')}>
            ■ Stop all repeats ({out.filter((c) => c.repeat).length})
          </Btn>
        )}
      </div>
      <Section title={`Incoming (${inc.length})`}>
        {inc.length === 0 ? <Empty>Nothing is marching toward you.</Empty> : <ul class="cmd-list">{inc.map((c) => <CommandRow c={c} />)}</ul>}
      </Section>
      <Section title={`Outgoing (${out.length})`}>
        {out.length === 0 ? <Empty>No commands.</Empty> : <ul class="cmd-list">{out.map((c) => <CommandRow c={c} />)}</ul>}
      </Section>
    </div>
  );
}

// ---------- farm assistant ----------

/** A first guess for template A from the troops this village has. */
function guessFarmUnits(v: VillageView): Units {
  const has = (u: UnitId, n: number) => (v.units[u] ?? 0) >= n;
  return has('light', 10) ? { light: 5 } : has('axe', 20) ? { axe: 20 } : has('spear', 20) ? { spear: 15 } : { light: 5 };
}

const FARM_UNITS: UnitId[] = ['spear', 'sword', 'axe', 'archer', 'scout', 'light', 'marcher', 'heavy'];

function FarmAssistant({ v }: { v: VillageView }) {
  const pane = usePane();
  const h = host.value!;
  const pv = view.value!;
  const [tpls, setTpls] = useState<FarmTemplate[]>(() => loadFarmTemplates(guessFarmUnits(v)));
  const [radius, setRadius] = useState(12);
  const [hideRed, setHideRed] = useState(true);
  const [onlyFree, setOnlyFree] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [mode, setModeState] = useState<FarmModeChoice>(loadFarmMode);
  const setMode = (m: FarmModeChoice) => { setModeState(m); saveFarmMode(m); };
  const saveTpls = (list: FarmTemplate[]) => { setTpls(list); saveFarmTemplates(list); };
  const patchTpl = (id: number, p: Partial<FarmTemplate>) => saveTpls(tpls.map((t) => (t.id === id ? { ...t, ...p } : t)));
  const addTpl = () => {
    const id = Math.max(0, ...tpls.map((t) => t.id)) + 1;
    saveTpls([...tpls, { id, name: '', units: {} }]);
    setEditId(id);
  };
  const first = tpls[0];
  const firstName = tplName(first, 0);
  const map = h.map();
  const busy = new Set(pv.commands.filter((c) => c.kind === 'attack').map((c) => c.toVid));
  const returning = new Map<number, CommandView>();
  for (const c of pv.commands) if (c.kind === 'return' && c.origin !== undefined) returning.set(c.origin, c);
  // raids from this village that go out again by themselves, by target
  const repeating = new Set<number>();
  for (const c of pv.commands) {
    if (!c.repeat || c.fromVid !== v.id) continue;
    const t = c.kind === 'return' ? c.origin : c.toVid;
    if (t !== undefined) repeating.add(t);
  }
  const stopRepeats = (target?: number) => act({ type: 'stopRepeats', vid: v.id, target }, target === undefined ? 'Every repeating raid from here is stopped. The troops come home and stay.' : 'Repeat stopped. The troops come home and stay.');
  // barbarian villages we spike (troops stationed there, or on the way) are not farms
  const spiked = new Set<number>();
  for (const hv of pv.villages) for (const st of hv.stationed) spiked.add(st.hostVid);
  for (const c of pv.commands) if (c.kind === 'support') spiked.add(c.toVid);
  const allRows = map.villages
    .filter((m) => m.ownerId === null && !m.cache && !spiked.has(m.id))
    .map((m) => ({ m, d: distance(v.x, v.y, m.x, m.y) }))
    .filter((r) => r.d <= radius)
    .sort((a, b) => a.d - b.d)
    .slice(0, 60)
    .map((r) => ({ ...r, info: h.villageInfo(r.m.id, v.id)! }));
  const isFree = (id: number) => !busy.has(id) && !returning.has(id) && !repeating.has(id);
  const rows = allRows
    .filter((r) => !(hideRed && r.info.intel?.lastColor === 'red'))
    .filter((r) => !onlyFree || isFree(r.m.id));
  // targets a sweep would hit: free, and not lost last time
  const ready = allRows.filter((r) => isFree(r.m.id) && r.info.intel?.lastColor !== 'red');
  const canSend = (u: Units) => hasUnits(u) && Object.entries(u).every(([k, n]) => (v.units[k as UnitId] ?? 0) >= (n ?? 0));
  // how many times a template can go out with the troops at home, and what it is short of when it can't
  const sendsLeft = (u: Units) => {
    let n = Infinity;
    for (const [k, c] of Object.entries(u)) if ((c ?? 0) > 0) n = Math.min(n, Math.floor((v.units[k as UnitId] ?? 0) / c!));
    return n === Infinity ? 0 : n;
  };
  const short = (u: Units) => Object.entries(u)
    .filter(([k, n]) => (n ?? 0) > (v.units[k as UnitId] ?? 0))
    .map(([k, n]) => `${unitName(k as UnitId, true)} ${v.units[k as UnitId] ?? 0}/${n}`)
    .join(', ');
  const send = (vid: number, u: Units, repeat = false) => act({ type: 'send', vid: v.id, target: vid, kind: 'attack', units: u, repeat, farmMode: repeat && mode ? mode : undefined });
  // send a template to the nearest ready targets, as many times as the troops at home allow
  const sweep = (t: FarmTemplate, i: number) => {
    const n = Math.min(sendsLeft(t.units), ready.length);
    let sent = 0;
    for (const r of ready.slice(0, n)) { if (!send(r.m.id, t.units)) break; sent++; }
    if (sent) toast(`${tplName(t, i)} sent to ${sent} ${sent === 1 ? 'village' : 'villages'}.`, 'good');
  };
  const setupNeeded = !tpls.some((t) => hasUnits(t.units));
  const unitsShown = FARM_UNITS.filter((u) => pv.config.archers || (u !== 'archer' && u !== 'marcher'));
  const homeFarm = unitsShown.filter((u) => (v.units[u] ?? 0) > 0);
  const bestIdx = tpls.findIndex((t) => canSend(t.units));
  return (
    <div class="stack farm">
      <div class="farm-summary" role="status">
        <div class="farm-stat"><span class="farm-stat-n num">{ready.length}</span><span class="farm-stat-l">ready to raid</span></div>
        <div class="farm-stat"><span class="farm-stat-n num">{allRows.length}</span><span class="farm-stat-l">barbarians within {radius}</span></div>
        <div class="farm-stat"><span class="farm-stat-n num">{busy.size + returning.size}</span><span class="farm-stat-l">raids out</span></div>
        <div class={`farm-stat ${repeating.size ? 'is-live' : ''}`}><span class="farm-stat-n num">↻ {repeating.size}</span><span class="farm-stat-l">repeating</span></div>
        {repeating.size > 0 && <Btn small variant="ghost" onClick={() => stopRepeats()}>Stop all repeats</Btn>}
      </div>

      {setupNeeded && (
        <div class="farm-guide">
          <h4>Set up farming in three steps</h4>
          <ol>
            <li><b>Pick a troop mix.</b> Tap a preset on a template below, or tap <i>Edit</i> to type numbers.</li>
            <li><b>Send it.</b> Tap a template's name next to a barbarian village, or <i>Raid all nearby</i>.</li>
            <li><b>Let it repeat.</b> The ↻ button keeps sending your ★ template every time the troops come home.</li>
          </ol>
        </div>
      )}

      <Section title="Your raid templates" actions={tpls.length < MAX_TEMPLATES ? <Btn small variant="ghost" onClick={addTpl}>+ New template</Btn> : undefined}>
        <p class="small farm-home"><span class="muted">At home:</span> {homeFarm.length ? homeFarm.map((u) => <span class="farm-unit" title={unitName(u)}><UnitIcon u={u} size={18} /><span class="num">{fmt(v.units[u] ?? 0)}</span></span>) : <span class="muted">no raiders</span>}</p>
        <div class="farm-tpls">
          {tpls.map((t, i) => {
            const editing = editId === t.id || !hasUnits(t.units);
            const left = sendsLeft(t.units);
            const ok = canSend(t.units);
            return (
              <div class={`template farm-tpl ${i === 0 ? 'is-first' : ''} ${ok ? 'is-ok' : hasUnits(t.units) ? 'is-short' : 'is-empty'}`} key={t.id}>
                <div class="tpl-head">
                  {editId === t.id ? (
                    <input id={`tpl-name-${t.id}`} class="tpl-name" type="text" maxLength={TEMPLATE_NAME_MAX} placeholder={defaultTplName(i)} value={t.name} aria-label="Template name"
                      onInput={(e) => patchTpl(t.id, { name: e.currentTarget.value.slice(0, TEMPLATE_NAME_MAX) })} />
                  ) : <b class="tpl-key">{tplName(t, i)}</b>}
                  {i === 0
                    ? <span class="pill farm-star" title="Repeat (↻) sends this template">★ repeats</span>
                    : <Btn small variant="quiet" onClick={() => saveTpls([t, ...tpls.filter((x) => x.id !== t.id)])} title="Make this the template Repeat sends">☆ Use for repeat</Btn>}
                  <span class="farm-grow" />
                  <Btn small variant="quiet" onClick={() => setEditId(editId === t.id ? null : t.id)} aria-expanded={editId === t.id}>{editId === t.id ? 'Done' : 'Edit'}</Btn>
                  {tpls.length > 1 && <Btn small variant="quiet" onClick={() => { saveTpls(tpls.filter((x) => x.id !== t.id)); if (editId === t.id) setEditId(null); }} title="Delete this template" aria-label={`Delete template ${tplName(t, i)}`}>✕</Btn>}
                </div>
                {hasUnits(t.units) && (
                  <div class="farm-mix">
                    {Object.entries(t.units).filter(([, n]) => (n ?? 0) > 0).map(([u, n]) => (
                      <span class={`farm-unit ${(v.units[u as UnitId] ?? 0) < n! ? 'is-short' : ''}`} title={unitName(u as UnitId)}><UnitIcon u={u as UnitId} size={20} /><span class="num">{fmt(n!)}</span></span>
                    ))}
                    <span class="muted small">carries <b class="num">{fmt(unitsCarry(t.units))}</b></span>
                  </div>
                )}
                {editing && (
                  <div class="farm-edit">
                    <div class="chips" role="group" aria-label="Quick fill">
                      {FARM_PRESETS.filter((p) => Object.keys(p.units).every((u) => unitsShown.includes(u as UnitId))).map((p) => (
                        <button type="button" class="chip" title={p.hint} onClick={() => patchTpl(t.id, { units: { ...p.units }, name: t.name || p.name.slice(0, TEMPLATE_NAME_MAX) })}>{p.name}</button>
                      ))}
                    </div>
                    {editId === t.id && (
                      <div class="unit-inputs compact">
                        {unitsShown.map((u) => (
                          <label class="unit-input" title={unitName(u)}>
                            <span class="uname"><UnitIcon u={u} size={18} /></span>
                            <NumInput id={`tpl-${t.id}-${u}`} value={t.units[u] || ''} onInput={(n) => patchTpl(t.id, { units: { ...t.units, [u]: n === '' ? 0 : n } })} />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!hasUnits(t.units) ? <span class="small muted">Empty — pick a preset above to get going.</span>
                  : ok ? (
                    <div class="farm-foot">
                      <span class="small good-text">✓ {left} {left === 1 ? 'send' : 'sends'} possible</span>
                      <Btn small disabled={!ready.length} onClick={() => sweep(t, i)} title={`Send ${tplName(t, i)} to the nearest ${Math.min(left, ready.length)} ready villages`}>
                        Raid all nearby ({Math.min(left, ready.length)})
                      </Btn>
                    </div>
                  )
                  : <span class="small bad-text">Not enough at home: {short(t.units)}</span>}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="When a repeating raid doesn't come home full">
        <div class="chips" role="radiogroup" aria-label="When a repeating raid doesn't come home full">
          {([['', 'Keep raiding', 'Send the same raid again regardless'], ['stop', 'Stop', 'Troops stay home and you get a report'], ['switch', 'Move to another barb', 'Try the nearest free barbarian village with clean reports']] as const).map(([m, label, hint]) => (
            <button type="button" role="radio" aria-checked={mode === m} class={`chip ${mode === m ? 'is-on' : ''}`} title={hint} onClick={() => setMode(m)}>{label}</button>
          ))}
        </div>
        <p class="small muted">
          {mode === 'switch' ? 'A village that runs dry is left for the nearest other barbarian village within 20 fields you are not already raiding or spiking.'
            : mode === 'stop' ? 'A raid that brings back less than it can carry stops repeating.'
            : 'Repeats go on as long as raids come back without losses.'} Applies to ↻ raids you send from now on.
        </p>
      </Section>

      <Section title="Barbarian villages nearby">
        <div class="farm-filters">
          <label class="farm-radius small">
            Range <input type="range" min={2} max={60} value={radius} onInput={(e) => setRadius(Number(e.currentTarget.value))} aria-label="Search range in fields" />
            <input id="farm-radius" class="tiny" type="number" min={2} max={60} value={radius} onInput={(e) => setRadius(Math.max(2, Math.min(60, Number(e.currentTarget.value) || 12)))} aria-label="Search range in fields" /> fields
          </label>
          <div class="chips">
            <button type="button" class={`chip ${hideRed ? 'is-on' : ''}`} aria-pressed={hideRed} onClick={() => setHideRed(!hideRed)}>Hide lost raids</button>
            <button type="button" class={`chip ${onlyFree ? 'is-on' : ''}`} aria-pressed={onlyFree} onClick={() => setOnlyFree(!onlyFree)}>Only idle targets</button>
          </div>
        </div>
        <p class="farm-legend small muted">
          <span><span class="dot dot-green" /> clean win</span>
          <span><span class="dot dot-yellow" /> losses</span>
          <span><span class="dot dot-red" /> lost</span>
          <span><span class="dot" /> never raided</span>
          <span><b>full</b> = troops came home full, send more</span>
        </p>
        {rows.length === 0 ? <Empty>No barbarian villages match. Try a bigger range.</Empty> : (
          <div class="table-scroll">
            <table class="farm-table">
              <thead>
                <tr><th /><th>Village</th><th class="right">Dist.</th><th class="right">Points</th><th>Last raid</th><th class="right">Wall</th><th class="right">Known res.</th><th class="right">Send</th></tr>
              </thead>
              <tbody>
                {rows.map(({ m, d, info }) => {
                  const it = info.intel;
                  const full = it?.lastCapacity ? (it.lastLoot ?? 0) >= it.lastCapacity * 0.95 : false;
                  const known = it?.res ? it.res.wood + it.res.clay + it.res.iron : undefined;
                  const onWay = busy.has(m.id);
                  return (
                    <tr key={m.id} class={`farm-row farm-${it?.lastColor ?? 'none'}`}>
                      <td>{it?.lastColor ? <span class={`dot dot-${it.lastColor}`} title={`last report ${it.lastColor}`} /> : <span class="dot" title="never raided" />}</td>
                      <td class="nowrap">
                        <button type="button" class="link" onClick={() => pane.go({ name: 'map', focus: m.id })}>{coords(m.x, m.y)}</button>
                        {m.bonus && <span class="pill" title="Bonus village">bonus</span>}
                        {onWay && <span class="pill" title="Troops are on the way">en route</span>}
                        {returning.has(m.id) && <span class="pill">returning</span>}
                        {repeating.has(m.id) && <span class="pill" title="Raids here go out again by themselves">↻ repeating</span>}
                      </td>
                      <td class="right num">{d.toFixed(1)}</td>
                      <td class="right num">{fmt(m.points)}</td>
                      <td>{it?.lastAttackT ? <span class="small">{fmtAgo(it.lastAttackT, now.value)}{it.lastLoot !== undefined ? <> · <span class="num">{fmt(it.lastLoot)}</span>{full && <b title="Troops came home full — send more"> full</b>}</> : null}</span> : <span class="muted small">never</span>}</td>
                      <td class="right num">{it?.wall ?? '?'}</td>
                      <td class="right num">{known !== undefined ? fmt(known) : '—'}</td>
                      <td class="right farm-send">
                        <div class="farm-btns">
                          {tpls.map((t, i) => (
                            <Btn small variant={i === bestIdx ? 'primary' : 'ghost'} disabled={!canSend(t.units)} onClick={() => send(m.id, t.units)} title={`Send template ${tplName(t, i)}`}><span class="trunc">{tplName(t, i)}</span></Btn>
                          ))}
                          {repeating.has(m.id)
                            ? <Btn small variant="ghost" onClick={() => stopRepeats(m.id)} title="Stop repeating raids on this village" aria-label="Stop repeating">■ ↻</Btn>
                            : <Btn small variant="ghost" disabled={!canSend(first.units)} onClick={() => send(m.id, first.units, true)} title={`Send ${firstName} and keep repeating`} aria-label={`Send ${firstName} and repeat`}>↻</Btn>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

// ---------- scavenging ----------

function Scavenge({ v }: { v: VillageView }) {
  const h = host.value!;
  const [units, setUnits] = useState<Units>({});
  const scavUnits: UnitId[] = ['spear', 'sword', 'axe', 'archer', 'light', 'marcher', 'heavy'];
  const avail = scavUnits.filter((u) => (v.units[u] ?? 0) > 0);
  const chosen: Units = {};
  for (const u of avail) {
    const n = Math.min(units[u] ?? 0, v.units[u] ?? 0);
    if (n > 0) chosen[u] = n;
  }
  const have = { wood: v.res.wood, clay: v.res.clay, iron: v.res.iron };
  return (
    <div class="stack">
      <Section title="Scavenging parties">
        <p class="muted">Send idle troops to comb the countryside for resources. Nobody can attack them, and they always come home. The more they can carry, the longer they stay out.</p>
        {avail.length === 0 ? <Empty>No troops who can carry anything are at home.</Empty> : (
          <div class="unit-inputs">
            {avail.map((u) => (
              <label class="unit-input">
                <span class="uname"><UnitIcon u={u} size={20} /> {unitName(u)}</span>
                <NumInput id={`scav-${u}`} value={units[u] ?? ''} max={v.units[u] ?? 0} onInput={(n) => setUnits({ ...units, [u]: n === '' ? 0 : n })} />
              </label>
            ))}
          </div>
        )}
      </Section>
      <div class="scav-grid">
        {SCAVENGE_TIERS.map((t, i) => {
          const run = v.scavenge[i];
          const locked = i >= v.scavengeUnlocked;
          const prev = h.scavengePreview(chosen, i);
          return (
            <div class={`scav ${locked ? 'is-locked' : ''} ${run ? 'is-running' : ''}`}>
              <h4>{t.name}</h4>
              <p class="muted small">Brings back {Math.round(t.ratio * 100)}% of carry capacity.</p>
              {run ? (
                <>
                  <UnitList units={run.units} />
                  <p class="small">Returning with <b class="num">{fmt(run.loot.wood + run.loot.clay + run.loot.iron)}</b> resources</p>
                  <Progress from={run.start} to={run.end} tone="ok" />
                  <Countdown until={run.end} />
                </>
              ) : locked ? (
                i === v.scavengeUnlocked ? (
                  <>
                    <Cost cost={t.cost} have={have} compact />
                    <Btn small onClick={() => act({ type: 'scavengeUnlock', vid: v.id, tier: i }, `${t.name} unlocked.`)}>Unlock</Btn>
                  </>
                ) : <p class="muted small">Unlock the previous option first.</p>
              ) : (
                <>
                  <p class="small">{hasUnits(chosen) ? <>≈ <b class="num">{fmt(prev.loot)}</b> resources in <span class="num">{fmtDur(prev.duration / warp.value)}</span></> : 'Choose troops above.'}</p>
                  <Btn small disabled={!hasUnits(chosen)} onClick={() => { if (act({ type: 'scavenge', vid: v.id, tier: i, units: chosen }, 'The party sets out.')) setUnits({}); }}>Send</Btn>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
