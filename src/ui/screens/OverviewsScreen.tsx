import { useState } from 'preact/hooks';
import { BUILDINGS } from '../../engine/data/buildings';
import { ARMY_ORDER, UNITS } from '../../engine/data/units';
import type { UnitId } from '../../engine/types';
import { Icon } from '../art/icons';
import { Countdown, Section, Tabs, UnitIcon, unitName } from '../components/common';
import { coords, fmt, fmtShort } from '../format';
import { go, liveRes, view, vid } from '../store';

type Tab = 'production' | 'troops' | 'buildings';

export function OverviewsScreen() {
  const pv = view.value!;
  const [tab, setTab] = useState<Tab>('production');
  const open = (id: number) => { vid.value = id; go({ name: 'village' }); };
  const totals = pv.villages.reduce((s, v) => {
    const r = liveRes(v);
    return { wood: s.wood + r.wood, clay: s.clay + r.clay, iron: s.iron + r.iron, rate: s.rate + v.rates.wood + v.rates.clay + v.rates.iron };
  }, { wood: 0, clay: 0, iron: 0, rate: 0 });
  const unitCols = ARMY_ORDER.filter((u) => pv.villages.some((v) => (v.units[u] ?? 0) > 0));
  return (
    <div class="stack">
      <div class="page-head">
        <h1>Overview</h1>
        <span class="muted">{pv.villages.length} {pv.villages.length === 1 ? 'village' : 'villages'} · <span class="num">{fmt(pv.me.points)}</span> points · rank {pv.me.rank}</span>
      </div>
      <div class="stat-row">
        <div class="stat"><span class="muted small">Stored</span><b class="num">{fmtShort(totals.wood + totals.clay + totals.iron)}</b></div>
        <div class="stat"><span class="muted small">Production</span><b class="num">{fmtShort(totals.rate)}/h</b></div>
        <div class="stat"><span class="muted small">Plundered</span><b class="num">{fmtShort(pv.me.stats.loot)}</b></div>
        <div class="stat"><span class="muted small">Crowns</span><b class="num">{pv.me.coins}</b></div>
      </div>
      <Tabs<Tab> active={tab} onChange={setTab} tabs={[{ id: 'production', label: 'Production' }, { id: 'troops', label: 'Troops' }, { id: 'buildings', label: 'Buildings' }]} />
      <Section>
        <div class="table-scroll">
          {tab === 'production' && (
            <table class="rank-table">
              <thead><tr><th>Village</th><th class="right">Points</th><th class="right"><Icon name="wood" size={16} /></th><th class="right"><Icon name="clay" size={16} /></th><th class="right"><Icon name="iron" size={16} /></th><th class="right">Storage</th><th class="right">Population</th><th>Building</th></tr></thead>
              <tbody>
                {pv.villages.map((v) => {
                  const r = liveRes(v);
                  const job = v.buildQueue[0];
                  return (
                    <tr class={v.id === vid.value ? 'is-me' : ''}>
                      <td><button type="button" class="link" onClick={() => open(v.id)}>{v.name}</button> <span class="muted small">({coords(v.x, v.y)})</span></td>
                      <td class="right num">{fmt(v.points)}</td>
                      {(['wood', 'clay', 'iron'] as const).map((k) => <td class={`right num ${r[k] >= v.storage ? 'bad-text' : ''}`}>{fmt(r[k])}</td>)}
                      <td class="right num">{fmt(v.storage)}</td>
                      <td class="right num">{fmt(v.popUsed)}/{fmt(v.popMax)}</td>
                      <td class="small">{job ? <>{BUILDINGS[job.building].short} {job.level} · <Countdown until={job.end} /></> : <span class="muted">idle</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {tab === 'troops' && (
            <table class="rank-table">
              <thead><tr><th>Village</th>{unitCols.map((u) => <th class="right" title={unitName(u)}><UnitIcon u={u} size={16} /></th>)}</tr></thead>
              <tbody>
                {pv.villages.map((v) => (
                  <tr>
                    <td><button type="button" class="link" onClick={() => open(v.id)}>{v.name}</button></td>
                    {unitCols.map((u: UnitId) => <td class="right num">{fmt(v.units[u] ?? 0)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'buildings' && (
            <table class="rank-table">
              <thead><tr><th>Village</th>{Object.values(BUILDINGS).map((b) => <th class="right" title={b.name}><Icon name={`b_${b.id}`} size={16} /></th>)}</tr></thead>
              <tbody>
                {pv.villages.map((v) => (
                  <tr>
                    <td><button type="button" class="link" onClick={() => open(v.id)}>{v.name}</button></td>
                    {Object.values(BUILDINGS).map((b) => <td class={`right num ${v.buildings[b.id] === 0 ? 'zero' : ''}`}>{v.buildings[b.id]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>
    </div>
  );
}
