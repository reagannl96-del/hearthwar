import { useEffect, useState } from 'preact/hooks';
import { MERCHANT_CARRY, OWN_SHIPMENT_SPEED, TRADER_CARRY, TRADER_SPEEDUP, UNITS } from '../../engine/data/units';
import { themeOfHero } from '../../engine/data/themes';
import { EXCHANGE_RATE } from '../../engine/market';
import type { ResKey } from '../../engine/types';
import type { VillageView } from '../../engine/view';
import { Icon } from '../art/icons';
import { Btn, Clock, Cost, Countdown, Empty, NumInput, Section, Tabs, UnitBadge, UnitIcon, unitName } from '../components/common';
import { RecruitQueue } from '../components/RecruitQueue';
import { coords, fmt, fmtDur, parseCoords } from '../format';
import { act, host, liveRes, marketTarget, now, view, warp, usePane } from '../store';

type Tab = 'send' | 'horses' | 'exchange' | 'transports';
const KEYS: ResKey[] = ['wood', 'clay', 'iron'];

export function MarketPanel({ tab }: { tab?: string }) {
  const pane = usePane();
  const [t, setT] = useState<Tab>((tab as Tab) || 'send');
  const v = pane.village.value!;
  const theme = themeOfHero(v.hero);
  const horses = horseCount(v);
  return (
    <div class="stack">
      <p class="muted market-counts">
        <span><Icon name="merchant" size={16} /> Merchants available: <b class="num">{v.merchants - v.merchantsOut}</b> of <span class="num">{v.merchants}</span> · each carries {fmt(MERCHANT_CARRY)}</span>
        {(horses.home + horses.out + horses.training > 0 || v.buildings.market >= (UNITS.trader.req.market ?? 5)) && (
          <span><UnitIcon u="trader" size={16} theme={theme} /> {unitName('trader', true, theme)} at home: <b class="num">{horses.home}</b>{horses.out > 0 && <> · on the road: <span class="num">{horses.out}</span></>} · each carries {fmt(TRADER_CARRY)}</span>
        )}
      </p>
      <Tabs<Tab> active={t} onChange={setT} tabs={[{ id: 'send', label: 'Send resources' }, { id: 'horses', label: unitName('trader', true, theme), badge: v.recruit.market.length || undefined }, { id: 'exchange', label: 'Trading post' }, { id: 'transports', label: 'Transports' }]} />
      {t === 'send' && <SendRes />}
      {t === 'horses' && <HorsePanel v={v} />}
      {t === 'exchange' && <Exchange />}
      {t === 'transports' && <Transports />}
    </div>
  );
}

/** A village's horse merchants: at home, out on the road with goods, and in training at the market. */
function horseCount(v: VillageView): { home: number; out: number; training: number } {
  let out = 0;
  for (const c of view.value!.commands) if (c.fromVid === v.id && (c.kind === 'trade' || c.kind === 'tradeback')) out += c.units?.trader ?? 0;
  const training = v.recruit.market.reduce((s, j) => s + j.count - j.done, 0);
  return { home: v.units.trader ?? 0, out, training };
}

/**
 * One of your own villages as a destination: its warehouse, what it holds, what is already
 * on the way and how much room is left, so a shipment doesn't spill over.
 */
function DestStores({ tid, amt }: { tid: number; amt: Record<ResKey, number | ''> }) {
  const pv = view.value!;
  const d = pv.villages.find((x) => x.id === tid);
  if (!d) return null;
  const have = liveRes(d);
  const coming: Record<ResKey, number> = { wood: 0, clay: 0, iron: 0 };
  for (const c of pv.commands) if (c.kind === 'trade' && c.toVid === tid && c.res) for (const k of KEYS) coming[k] += c.res[k];
  return (
    <div class="dest-stores">
      <div class="small muted">Warehouse holds <b class="num">{fmt(d.storage)}</b> of each</div>
      <table class="dest-table">
        <thead><tr><th /><th class="right">Stored</th><th class="right">On the way</th><th class="right">Room</th></tr></thead>
        <tbody>
          {KEYS.map((k) => {
            const room = Math.max(0, d.storage - Math.floor(have[k]) - coming[k]);
            const spill = Number(amt[k] || 0) - room;
            return (
              <tr class={spill > 0 ? 'is-spill' : ''}>
                <td><Icon name={k} size={16} /></td>
                <td class="right num">{fmt(Math.floor(have[k]))}</td>
                <td class="right num">{coming[k] ? fmt(coming[k]) : '–'}</td>
                <td class="right num">{fmt(room)}{spill > 0 && <span class="reason small" title="More than the warehouse can take: the rest is lost"> ({fmt(spill)} too much)</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SendRes() {
  const pane = usePane();
  const v = pane.village.value!;
  const pv = view.value!;
  const h = host.value!;
  const pre = marketTarget.value;
  const theme = themeOfHero(v.hero);
  const [target, setTarget] = useState(pre ? coords(pre.x, pre.y) : '');
  const [amt, setAmt] = useState<Record<ResKey, number | ''>>({ wood: '', clay: '', iron: '' });
  const [mode, setMode] = useState<'foot' | 'horse'>('foot');
  useEffect(() => { if (pre) { setTarget(coords(pre.x, pre.y)); marketTarget.value = null; } }, [pre]);
  const res = liveRes(v);
  const feet = v.merchants - v.merchantsOut;
  const horsesHome = v.units.trader ?? 0;
  const horse = mode === 'horse';
  const carry = horse ? TRADER_CARRY : MERCHANT_CARRY;
  const free = horse ? horsesHome : feet;
  const total = KEYS.reduce((s, k) => s + Number(amt[k] || 0), 0);
  const need = Math.ceil(total / carry);
  const xy = parseCoords(target);
  const tid = xy ? h.villageAt(xy[0], xy[1]) : undefined;
  const info = tid !== undefined ? h.villageInfo(tid, v.id) : null;
  const slow = tid !== undefined ? h.merchantTime(v.id, tid) : 0;
  // horse merchants ride five times as fast (rounded the way the engine does)
  const dur = horse && tid !== undefined ? Math.max(1000, Math.round(slow / TRADER_SPEEDUP)) : slow;
  const others = pv.villages.filter((x) => x.id !== v.id);
  const cap = free * carry;
  const maxFor = (k: ResKey) => Math.max(0, Math.min(Math.floor(res[k]), cap - (total - Number(amt[k] || 0))));
  const horseName = unitName('trader', true, theme);
  // fill the merchants' room evenly across the three resources (a resource running short
  // leaves its share to the others), or all the stock if it doesn't fill them
  const evenSplit = () => {
    const out: Record<ResKey, number> = { wood: 0, clay: 0, iron: 0 };
    let room = cap;
    const byStock = [...KEYS].sort((a, b) => res[a] - res[b]);
    byStock.forEach((k, i) => {
      const give = Math.max(0, Math.min(Math.floor(res[k]), Math.floor(room / (byStock.length - i))));
      out[k] = give;
      room -= give;
    });
    setAmt(out);
  };
  return (
    <div class="grid-2">
      <Section title="Goods">
        <div class="send-with" role="radiogroup" aria-label="Send with">
          <span class="small muted">Send with</span>
          <button type="button" role="radio" aria-checked={!horse} class={`send-with-opt ${!horse ? 'is-on' : ''}`} onClick={() => setMode('foot')}>
            <Icon name="merchant" size={26} />
            <span><b>Merchants</b><span class="small muted"><span class="num">{feet}</span> free · {fmt(MERCHANT_CARRY)} each</span></span>
          </button>
          <button
            type="button" role="radio" aria-checked={horse} class={`send-with-opt ${horse ? 'is-on' : ''}`} disabled={horsesHome === 0 && !horse}
            title={horsesHome === 0 ? `No ${horseName.toLowerCase()} at home. Recruit them at the market (level ${UNITS.trader.req.market ?? 5}).` : undefined}
            onClick={() => setMode('horse')}
          >
            <UnitIcon u="trader" size={26} theme={theme} />
            <span><b>{horseName}</b><span class="small muted"><span class="num">{horsesHome}</span> at home · {fmt(TRADER_CARRY)} each · {TRADER_SPEEDUP}× faster</span></span>
          </button>
        </div>
        {KEYS.map((k) => (
          <label class="unit-input">
            <span class="uname"><Icon name={k} size={20} /> {k[0].toUpperCase() + k.slice(1)}</span>
            <NumInput id={`trade-${k}`} value={amt[k]} max={maxFor(k)} onInput={(n) => setAmt({ ...amt, [k]: n })} />
          </label>
        ))}
        <div class="row gap send-fill">
          <Btn small variant="ghost" disabled={cap <= 0} onClick={evenSplit} title="Split what the merchants can carry evenly between wood, clay and iron">Even split</Btn>
          <Btn small variant="quiet" disabled={total === 0} onClick={() => setAmt({ wood: '', clay: '', iron: '' })}>Clear</Btn>
        </div>
        <p class={`small ${need > free ? 'reason' : 'muted'}`}>
          Needs <b class="num">{need}</b> of {free} {horse ? horseName.toLowerCase() : 'merchants'} · room for <span class="num">{fmt(cap)}</span>
        </p>
      </Section>
      <Section title="Destination">
        <label class="field">
          <span>Coordinates</span>
          <input id="trade-target" placeholder="x|y" value={target} onInput={(e) => setTarget(e.currentTarget.value)} />
        </label>
        {others.length > 0 && (
          <div class="chips">
            {others.map((o) => <button type="button" class="chip" onClick={() => setTarget(coords(o.x, o.y))}>{o.name}</button>)}
          </div>
        )}
        {info && (
          <p>
            <b>{info.name}</b> <span class="muted">· {info.own ? 'your village' : info.ownerName} · arrives in <span class="num">{fmtDur(dur / warp.value)}</span></span>
            {horse && slow > dur && <span class="muted small"> (on foot: {fmtDur(slow / warp.value)})</span>}
          </p>
        )}
        {info?.own && tid !== undefined && <DestStores tid={tid} amt={amt} />}
        <p class="muted small">Shipments between your own villages are slow: merchants travel at {Math.round(OWN_SHIPMENT_SPEED * 100)}% speed{horse ? `, though ${horseName.toLowerCase()} still ride ${TRADER_SPEEDUP}× faster than that` : ''}.</p>
        <Btn
          disabled={tid === undefined || total <= 0 || need > free}
          onClick={() => {
            if (tid !== undefined && act({ type: 'trade', vid: v.id, target: tid, res: { wood: Number(amt.wood || 0), clay: Number(amt.clay || 0), iron: Number(amt.iron || 0) }, horses: horse || undefined }, horse ? (need === 1 ? `A ${unitName('trader', false, theme).toLowerCase()} sets off with the goods.` : `${need} ${horseName.toLowerCase()} set off with the goods.`) : 'Merchants are on their way.')) {
              setAmt({ wood: '', clay: '', iron: '' });
            }
          }}
        >
          Send
        </Btn>
      </Section>
    </div>
  );
}

/** Recruit horse merchants at the market, and see where they all are. */
function HorsePanel({ v }: { v: VillageView }) {
  const h = host.value!;
  const theme = themeOfHero(v.hero);
  const [n, setN] = useState<number | ''>('');
  const d = UNITS.trader;
  const av = h.unitAvailable(v.id, 'trader');
  const count1 = Number(n || 0);
  const chk = h.recruitCheck(v.id, 'trader', Math.max(1, count1));
  const max = h.recruitCheck(v.id, 'trader', 1).max;
  const per = h.recruitTime(v.id, 'trader');
  const have = liveRes(v);
  const count = horseCount(v);
  const name = unitName('trader', false, theme), plural = unitName('trader', true, theme);
  return (
    <div class="stack">
      <RecruitQueue v={v} b="market" />
      <div class="grid-2">
        <Section title={plural}>
          <div class="horse-head">
            <span class="horse-art"><UnitIcon u="trader" size={56} theme={theme} /></span>
            <p class="muted">{d.description}</p>
          </div>
          <dl class="facts">
            <dt>Carries</dt><dd><span class="num">{fmt(TRADER_CARRY)}</span> <span class="muted small">(as much as {TRADER_CARRY / MERCHANT_CARRY} merchants)</span></dd>
            <dt>Speed</dt><dd>{TRADER_SPEEDUP}× as fast as a merchant on foot</dd>
            <dt>Population</dt><dd class="num">{d.pop} each</dd>
            <dt>At home</dt><dd class="num">{fmt(count.home)}</dd>
            <dt>On the road</dt><dd class="num">{fmt(count.out)}</dd>
            {count.training > 0 && <><dt>In training</dt><dd class="num">{fmt(count.training)}</dd></>}
          </dl>
          <p class="muted small">They never fight: {plural.toLowerCase()} keep out of every battle and cannot march with an army.</p>
        </Section>
        <Section title={`Recruit ${plural.toLowerCase()}`}>
          <div class="muted small">Cost each</div>
          <Cost cost={d.cost} have={have} pop={d.pop} time={per} />
          {av.ok ? (
            <>
              <div class="row gap wrap">
                <NumInput id="recruit-trader" value={n} max={max} onInput={setN} />
                <Btn
                  disabled={count1 <= 0 || !chk.ok}
                  onClick={() => { if (act({ type: 'recruit', vid: v.id, unit: 'trader', count: count1 }, count1 === 1 ? `A ${name.toLowerCase()} begins training.` : `${count1} ${plural.toLowerCase()} begin training.`)) setN(''); }}
                >
                  Recruit
                </Btn>
              </div>
              {count1 > 1 && (
                <div class="row gap wrap small">
                  <span class="muted">In all:</span>
                  <Cost cost={{ wood: d.cost.wood * count1, clay: d.cost.clay * count1, iron: d.cost.iron * count1 }} have={have} pop={d.pop * count1} time={per * count1} compact />
                </div>
              )}
              {count1 > 0 && !chk.ok && <p class="reason small">{chk.reason}</p>}
            </>
          ) : (
            <p class="reason small">{av.reason}</p>
          )}
        </Section>
      </div>
    </div>
  );
}

function Exchange() {
  const pane = usePane();
  const v = pane.village.value!;
  const h = host.value!;
  const [give, setGive] = useState<ResKey>('iron');
  const [get, setGet] = useState<ResKey>('wood');
  const [amount, setAmount] = useState<number | ''>(1000);
  const res = liveRes(v);
  const q = h.exchangeQuote(v.id, give, get, Number(amount || 0));
  const stock = h.exchangeStock();
  const max = Math.min(Math.floor(res[give]), q.maxAmount);
  return (
    <div class="grid-2">
      <Section title="Trade with the post">
        <p class="muted">The trading post always buys and sells. Prices follow its stock: the more of something it holds, the less it pays for it. Its fee is steep: at balanced stock you get about {fmt(EXCHANGE_RATE * 1000)} for every 1,000 you give.</p>
        <div class="exchange">
          <label class="field">
            <span>Give</span>
            <select id="ex-give" value={give} onChange={(e) => setGive((e.currentTarget as HTMLSelectElement).value as ResKey)}>
              {KEYS.map((k) => <option value={k}>{k}</option>)}
            </select>
          </label>
          <NumInput id="ex-amount" value={amount} max={max} onInput={setAmount} />
          <span aria-hidden="true">→</span>
          <label class="field">
            <span>Receive</span>
            <select id="ex-get" value={get} onChange={(e) => setGet((e.currentTarget as HTMLSelectElement).value as ResKey)}>
              {KEYS.map((k) => <option value={k}>{k}</option>)}
            </select>
          </label>
        </div>
        <p>
          You receive <b class="num">{fmt(give === get ? 0 : q.receive)}</b> {get} <span class="muted">(rate {q.rate.toFixed(2)})</span>
        </p>
        <Btn disabled={give === get || !amount || Number(amount) > max} onClick={() => act({ type: 'exchange', vid: v.id, give, get, amount: Number(amount) }, 'Trade complete.')}>Trade</Btn>
        {Number(amount) > q.maxAmount && <p class="reason small">Your free merchants can haul at most {fmt(q.maxAmount)}.</p>}
      </Section>
      <Section title="Post stock">
        <dl class="facts">
          {KEYS.map((k) => <><dt><Icon name={k} size={16} /> {k}</dt><dd class="num">{fmt(stock[k])}</dd></>)}
        </dl>
      </Section>
    </div>
  );
}

function Transports() {
  const pv = view.value!;
  const list = [...pv.commands.filter((c) => c.kind === 'trade' || c.kind === 'tradeback'), ...pv.incoming.filter((c) => c.kind === 'trade')];
  if (list.length === 0) return <Section><Empty>No merchants on the road.</Empty></Section>;
  return (
    <Section title="On the road">
      <ul class="cmd-list">
        {list.sort((a, b) => a.arrive - b.arrive).map((c) => (
          <li class="cmd">
            <Icon name="trade" size={16} />
            <div class="grow">
              {c.dir === 'in' ? <>From {c.ownerName} to {c.toName}</> : c.kind === 'trade' ? <>{c.fromName} → {c.toName}</> : <>Returning to {c.fromName}</>}
              {c.res && <div class="muted small num">{fmt(c.res.wood)} / {fmt(c.res.clay)} / {fmt(c.res.iron)}</div>}
              {(c.units?.trader ?? 0) > 0 && <div class="small"><UnitBadge u="trader" n={c.units!.trader} theme={c.theme} /> <span class="muted">{unitName('trader', c.units!.trader! > 1, c.theme).toLowerCase()}</span></div>}
            </div>
            <div class="right"><Countdown until={c.arrive} /><div class="muted small"><Clock t={c.arrive} /></div></div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export { now };
