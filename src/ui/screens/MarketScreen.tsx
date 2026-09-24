import { useEffect, useState } from 'preact/hooks';
import { MERCHANT_CARRY, OWN_SHIPMENT_SPEED } from '../../engine/data/units';
import { EXCHANGE_RATE } from '../../engine/market';
import type { ResKey } from '../../engine/types';
import { Icon } from '../art/icons';
import { Btn, Clock, Countdown, Empty, NumInput, Section, Tabs } from '../components/common';
import { coords, fmt, fmtDur, parseCoords } from '../format';
import { act, host, liveRes, marketTarget, now, view, warp, usePane } from '../store';

type Tab = 'send' | 'exchange' | 'transports';
const KEYS: ResKey[] = ['wood', 'clay', 'iron'];

export function MarketPanel({ tab }: { tab?: string }) {
  const pane = usePane();
  const [t, setT] = useState<Tab>((tab as Tab) || 'send');
  const v = pane.village.value!;
  return (
    <div class="stack">
      <p class="muted">
        <Icon name="merchant" size={16} /> Merchants available: <b class="num">{v.merchants - v.merchantsOut}</b> of <span class="num">{v.merchants}</span> · each carries {fmt(MERCHANT_CARRY)}
      </p>
      <Tabs<Tab> active={t} onChange={setT} tabs={[{ id: 'send', label: 'Send resources' }, { id: 'exchange', label: 'Trading post' }, { id: 'transports', label: 'Transports' }]} />
      {t === 'send' && <SendRes />}
      {t === 'exchange' && <Exchange />}
      {t === 'transports' && <Transports />}
    </div>
  );
}

function SendRes() {
  const pane = usePane();
  const v = pane.village.value!;
  const pv = view.value!;
  const h = host.value!;
  const pre = marketTarget.value;
  const [target, setTarget] = useState(pre ? coords(pre.x, pre.y) : '');
  const [amt, setAmt] = useState<Record<ResKey, number | ''>>({ wood: '', clay: '', iron: '' });
  useEffect(() => { if (pre) { setTarget(coords(pre.x, pre.y)); marketTarget.value = null; } }, [pre]);
  const res = liveRes(v);
  const free = v.merchants - v.merchantsOut;
  const total = KEYS.reduce((s, k) => s + Number(amt[k] || 0), 0);
  const need = Math.ceil(total / MERCHANT_CARRY);
  const xy = parseCoords(target);
  const tid = xy ? h.villageAt(xy[0], xy[1]) : undefined;
  const info = tid !== undefined ? h.villageInfo(tid, v.id) : null;
  const dur = tid !== undefined ? h.merchantTime(v.id, tid) : 0;
  const others = pv.villages.filter((x) => x.id !== v.id);
  const cap = free * MERCHANT_CARRY;
  const maxFor = (k: ResKey) => Math.max(0, Math.min(Math.floor(res[k]), cap - (total - Number(amt[k] || 0))));
  return (
    <div class="grid-2">
      <Section title="Goods">
        {KEYS.map((k) => (
          <label class="unit-input">
            <span class="uname"><Icon name={k} size={20} /> {k[0].toUpperCase() + k.slice(1)}</span>
            <NumInput id={`trade-${k}`} value={amt[k]} max={maxFor(k)} onInput={(n) => setAmt({ ...amt, [k]: n })} />
          </label>
        ))}
        <p class={`small ${need > free ? 'reason' : 'muted'}`}>Needs <b class="num">{need}</b> of {free} merchants.</p>
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
        {info && <p><b>{info.name}</b> <span class="muted">· {info.own ? 'your village' : info.ownerName} · arrives in <span class="num">{fmtDur(dur / warp.value)}</span></span></p>}
        <p class="muted small">Shipments between your own villages are slow: merchants travel at {Math.round(OWN_SHIPMENT_SPEED * 100)}% speed.</p>
        <Btn
          disabled={tid === undefined || total <= 0 || need > free}
          onClick={() => {
            if (tid !== undefined && act({ type: 'trade', vid: v.id, target: tid, res: { wood: Number(amt.wood || 0), clay: Number(amt.clay || 0), iron: Number(amt.iron || 0) } }, 'Merchants are on their way.')) {
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
            </div>
            <div class="right"><Countdown until={c.arrive} /><div class="muted small"><Clock t={c.arrive} /></div></div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export { now };
