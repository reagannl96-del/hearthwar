import { useState } from 'preact/hooks';
import { BUILDINGS } from '../../engine/data/buildings';
import { ITEM_BY_ID } from '../../engine/data/units';
import type { BattleData, Report, ResKey } from '../../engine/types';
import { Icon } from '../art/icons';
import { Btn, Empty, PlayerLink, Res, Section, UnitTable, VillageLink } from '../components/common';
import { fmt, fmtAgo, fmtClock } from '../format';
import { act, go, host, now, rallyTarget, view, warp } from '../store';

type Filter = 'all' | 'attack' | 'defense' | 'support' | 'trade' | 'other';

export function ReportsScreen({ id }: { id?: number }) {
  const h = host.value!;
  view.value; // re-render on updates
  const reports = h.reports();
  const [filter, setFilter] = useState<Filter>('all');
  const open = id !== undefined ? reports.find((r) => r.id === id) : undefined;
  if (open) {
    if (!open.read) queueMicrotask(() => act({ type: 'readReport', id: open.id }));
    return <ReportView r={open} />;
  }
  const list = reports.filter((r) =>
    filter === 'all' ? true : filter === 'other' ? ['info', 'conquest', 'lost'].includes(r.kind) : r.kind === filter,
  );
  const counts = (f: Filter) => reports.filter((r) => !r.read && (f === 'all' || (f === 'other' ? ['info', 'conquest', 'lost'].includes(r.kind) : r.kind === f))).length;
  return (
    <div class="stack">
      <div class="page-head">
        <h1>Reports</h1>
        <div class="row gap">
          <Btn small variant="ghost" onClick={() => act({ type: 'readReport', id: 'all' })}>Mark all read</Btn>
          <Btn small variant="quiet" onClick={() => act({ type: 'deleteReport', id: 'read' }, 'Read reports deleted.')}>Delete read</Btn>
        </div>
      </div>
      <div class="filter-row">
        {(['all', 'attack', 'defense', 'support', 'trade', 'other'] as Filter[]).map((f) => (
          <button type="button" class={`chip ${filter === f ? 'is-on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'attack' ? 'Attacks' : f === 'defense' ? 'Defense' : f === 'support' ? 'Support' : f === 'trade' ? 'Trade' : 'Other'}
            {counts(f) > 0 && <span class="badge">{counts(f)}</span>}
          </button>
        ))}
      </div>
      <Section>
        {list.length === 0 ? <Empty>No reports yet. Send some troops out!</Empty> : (
          <ul class="report-list">
            {list.slice(0, 200).map((r) => (
              <li class={`report-item ${r.read ? '' : 'is-unread'}`}>
                <span class={`dot dot-${r.color}`} />
                <button type="button" class="link grow" onClick={() => go({ name: 'reports', id: r.id })}>{r.title}</button>
                {r.battle?.loot && <span class="muted small num">{fmt(r.battle.loot.wood + r.battle.loot.clay + r.battle.loot.iron)} loot</span>}
                <span class="muted small">{fmtAgo(r.t, now.value)}</span>
                <button type="button" class="icon-btn" aria-label="Delete report" onClick={() => act({ type: 'deleteReport', id: r.id })}>
                  <Icon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function ReportView({ r }: { r: Report }) {
  const reports = host.value!.reports();
  const idx = reports.findIndex((x) => x.id === r.id);
  return (
    <div class="stack report">
      <div class="crumbs">
        <button type="button" class="link" onClick={() => go({ name: 'reports' })}>Reports</button>
        <span aria-hidden="true">›</span>
        <span>{r.title}</span>
      </div>
      <div class="page-head">
        <h1 class="report-title"><span class={`dot dot-${r.color}`} /> {r.title}</h1>
        <div class="row gap">
          <Btn small variant="ghost" disabled={idx <= 0} onClick={() => go({ name: 'reports', id: reports[idx - 1].id })}>Newer</Btn>
          <Btn small variant="ghost" disabled={idx >= reports.length - 1} onClick={() => go({ name: 'reports', id: reports[idx + 1].id })}>Older</Btn>
          <Btn small variant="quiet" onClick={() => { act({ type: 'deleteReport', id: r.id }); go({ name: 'reports' }); }}>Delete</Btn>
        </div>
      </div>
      <p class="muted small">{fmtClock(r.t, now.value, warp.value)}</p>
      {r.text && <Section><p>{r.text}</p></Section>}
      {r.res && (
        <Section title="Goods">
          <span class="cost">{(['wood', 'clay', 'iron'] as ResKey[]).map((k) => <Res k={k} n={r.res![k]} />)}</span>
        </Section>
      )}
      {r.battle && <Battle b={r.battle} kind={r.kind} />}
    </div>
  );
}

function Battle({ b, kind }: { b: BattleData; kind: Report['kind'] }) {
  const pv = view.value!;
  const mine = b.attacker.playerId === pv.me.id;
  const survivors = { ...b.attUnits };
  for (const k in b.attLost) survivors[k as keyof typeof survivors] = (survivors[k as keyof typeof survivors] ?? 0) - (b.attLost[k as keyof typeof b.attLost] ?? 0);
  return (
    <>
      <Section>
        <div class="battle-sides">
          <div>
            <div class="muted small">Attacker</div>
            <PlayerLink id={b.attacker.playerId} name={b.attacker.playerName} />
            <div><VillageLink vid={b.attacker.vid} name={b.attacker.vname} x={b.attacker.x} y={b.attacker.y} /></div>
          </div>
          <div class="battle-mid">
            <div class={`outcome ${b.winner === 'attacker' ? (mine ? 'is-win' : 'is-loss') : mine ? 'is-loss' : 'is-win'}`}>
              {b.winner === 'attacker' ? 'The attacker won' : 'The defender won'}
            </div>
            {b.luck !== 0 && <div class="small">Luck <b class={`num ${b.luck >= 0 ? 'good-text' : 'bad-text'}`}>{b.luck >= 0 ? '+' : ''}{(b.luck * 100).toFixed(1)}%</b></div>}
            {b.morale < 1 && <div class="small">Morale <b class="num">{Math.round(b.morale * 100)}%</b></div>}
            {b.paladinItem && <div class="small">Paladin carried the {ITEM_BY_ID[b.paladinItem]?.name}</div>}
          </div>
          <div class="right">
            <div class="muted small">Defender</div>
            <PlayerLink id={b.defender.playerId} name={b.defender.playerName} />
            <div><VillageLink vid={b.defender.vid} name={b.defender.vname} x={b.defender.x} y={b.defender.y} /></div>
          </div>
        </div>
      </Section>
      <Section title="Attacking army">
        <UnitTable rows={[{ label: 'Sent', units: b.attUnits }, { label: 'Lost', units: b.attLost, tone: 'loss' }]} />
      </Section>
      <Section title="Defending army">
        {b.defUnits ? (
          <UnitTable rows={[{ label: 'Present', units: b.defUnits }, { label: 'Lost', units: b.defLost, tone: 'loss' }]} />
        ) : (
          <p class="muted">None of your troops survived to see the defenders.</p>
        )}
        {b.militia && <p class="small muted">The village's militia fought alongside the defenders.</p>}
      </Section>
      {(b.loot || b.wall || b.building || b.loyalty) && (
        <Section title="Aftermath">
          <dl class="facts">
            {b.loot && (
              <>
                <dt>Plunder</dt>
                <dd>
                  <span class="cost">{(['wood', 'clay', 'iron'] as ResKey[]).map((k) => <Res k={k} n={b.loot![k]} />)}</span>{' '}
                  <span class="muted small num">{fmt(b.loot.wood + b.loot.clay + b.loot.iron)}/{fmt(b.capacity ?? 0)}</span>
                </dd>
              </>
            )}
            {b.wall && <><dt>Wall</dt><dd class="num">{b.wall.before === b.wall.after ? `level ${b.wall.after}` : `damaged from ${b.wall.before} to ${b.wall.after}`}</dd></>}
            {b.building && <><dt>Catapults</dt><dd>{BUILDINGS[b.building.id].name} {b.building.before === b.building.after ? `held at level ${b.building.after}` : `damaged from ${b.building.before} to ${b.building.after}`}</dd></>}
            {b.loyalty && <><dt>Loyalty</dt><dd class="num">{b.conquered ? `fell to 0 — the village was conquered!` : `dropped from ${b.loyalty.before} to ${b.loyalty.after}`}</dd></>}
          </dl>
        </Section>
      )}
      {b.scout && (
        <Section title="Scouting">
          {b.scout.res && (
            <p>Resources: <span class="cost">{(['wood', 'clay', 'iron'] as ResKey[]).map((k) => <Res k={k} n={b.scout!.res![k]} />)}</span></p>
          )}
          {b.scout.buildings && (
            <div class="scout-buildings">
              {Object.entries(b.scout.buildings).filter(([, l]) => (l ?? 0) > 0).map(([id, l]) => (
                <span class="chip"><Icon name={`b_${id}`} size={14} /> {BUILDINGS[id as keyof typeof BUILDINGS].name} {l}</span>
              ))}
            </div>
          )}
          {b.scout.unitsOutside && <UnitTable rows={[{ label: 'Outside', units: b.scout.unitsOutside }]} />}
          {!b.scout.buildings && <p class="muted small">Send more scouts to also see buildings and troops outside.</p>}
        </Section>
      )}
      {kind === 'attack' && mine && (
        <div class="row gap">
          <Btn onClick={() => { rallyTarget.value = { x: b.defender.x, y: b.defender.y, kind: 'attack', units: b.attUnits as Record<string, number> }; go({ name: 'building', id: 'rally', tab: 'send' }); }}>Attack again with the same troops</Btn>
          <Btn variant="ghost" onClick={() => go({ name: 'map', focus: b.defender.vid })}>Show on map</Btn>
        </div>
      )}
    </>
  );
}
