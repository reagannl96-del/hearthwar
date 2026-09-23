import { useState } from 'preact/hooks';
import { BUILDINGS, BUILDING_ORDER } from '../../engine/data/buildings';
import { ARMY_ORDER, ITEM_BY_ID, UNITS } from '../../engine/data/units';
import type { BattleData, Report, ResKey, SideInfo, UnitId, Units } from '../../engine/types';
import { Icon } from '../art/icons';
import { Btn, Empty, PlayerLink, Res, Section, VillageLink, UnitIcon, unitName } from '../components/common';
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
      <article class={`rep-card rep-${r.color}`}>
        <header class="rep-head">
          <span class={`dot dot-${r.color}`} />
          <div class="grow">
            <h1 class="rep-title">{r.title}</h1>
            <div class="rep-time">{fmtClock(r.t, now.value, warp.value)}</div>
          </div>
          <div class="row gap">
            <Btn small variant="ghost" disabled={idx <= 0} onClick={() => go({ name: 'reports', id: reports[idx - 1].id })}>‹ Newer</Btn>
            <Btn small variant="ghost" disabled={idx >= reports.length - 1} onClick={() => go({ name: 'reports', id: reports[idx + 1].id })}>Older ›</Btn>
            <Btn small variant="quiet" onClick={() => { act({ type: 'deleteReport', id: r.id }); go({ name: 'reports' }); }}>Delete</Btn>
          </div>
        </header>
        {r.text && <p class="rep-text">{r.text}</p>}
        {r.res && (
          <div class="rep-block">
            <h2 class="rep-sub">Goods</h2>
            <span class="cost">{(['wood', 'clay', 'iron'] as ResKey[]).map((k) => <Res k={k} n={r.res![k]} />)}</span>
          </div>
        )}
        {r.battle && <Battle b={r.battle} kind={r.kind} />}
      </article>
    </div>
  );
}

/** Units that can appear in this world, in Tribal Wars column order. */
function columns(b: BattleData): UnitId[] {
  const pv = view.value!;
  const seen = (u: UnitId) => [b.attUnits, b.defUnits, b.scout?.unitsOutside].some((x) => (x?.[u] ?? 0) > 0);
  return ARMY_ORDER.filter((u) => {
    if ((u === 'archer' || u === 'marcher') && !pv.config.archers) return seen(u);
    if (u === 'militia' || u === 'sorcerer' || u === 'druid' || u === 'goblin') return seen(u);
    return true;
  });
}

function minus(a: Units, b?: Units): Units {
  const out: Units = { ...a };
  for (const k in b) out[k as UnitId] = (out[k as UnitId] ?? 0) - (b[k as UnitId] ?? 0);
  return out;
}

/** One side of the battle, laid out like a Tribal Wars report: who, from where, and a row per count. */
function SideTable({ role, side, cols, rows, win }: {
  role: 'Attacker' | 'Defender';
  side: SideInfo;
  cols: UnitId[];
  rows: { label: string; units?: Units; tone?: 'loss' | 'alive' }[];
  win: boolean;
}) {
  return (
    <table class={`rep-side ${win ? 'is-win' : 'is-loss'}`}>
      <tbody>
        <tr class="rep-who">
          <th scope="row">{role}:</th>
          <td colSpan={cols.length}><PlayerLink id={side.playerId} name={side.playerName} /></td>
        </tr>
        <tr>
          <th scope="row">{role === 'Attacker' ? 'Origin' : 'Destination'}:</th>
          <td colSpan={cols.length}><VillageLink vid={side.vid} name={side.vname} x={side.x} y={side.y} /></td>
        </tr>
        <tr class="rep-icons">
          <th />
          {cols.map((u) => <td title={unitName(u, false, side.theme ?? 'classic')}><UnitIcon u={u} size={20} theme={side.theme ?? 'classic'} /></td>)}
        </tr>
        {rows.map((r) => (
          <tr class={`rep-count ${r.tone ?? ''}`}>
            <th scope="row">{r.label}:</th>
            {cols.map((u) => {
              if (r.units === undefined) return <td class="num unknown">?</td>;
              const n = r.units[u] ?? 0;
              return <td class={`num ${n === 0 ? 'zero' : ''}`}>{fmt(n)}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LuckMeter({ luck }: { luck: number }) {
  // luck runs from -25% to +25%; the bar fills from the middle
  const pct = Math.max(-25, Math.min(25, luck * 100));
  const w = (Math.abs(pct) / 25) * 50;
  return (
    <div class="luck">
      <span class="luck-label">Luck</span>
      <span class="luck-bar" role="img" aria-label={`Luck ${pct.toFixed(1)}%`}>
        <span class={`luck-fill ${pct >= 0 ? 'is-good' : 'is-bad'}`} style={{ left: pct >= 0 ? '50%' : `${50 - w}%`, width: `${w}%` }} />
        <span class="luck-mid" />
      </span>
      <b class={`num ${pct >= 0 ? 'good-text' : 'bad-text'}`}>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</b>
    </div>
  );
}

function Battle({ b, kind }: { b: BattleData; kind: Report['kind'] }) {
  const pv = view.value!;
  const mine = b.attacker.playerId === pv.me.id;
  const cols = columns(b);
  const attWon = b.winner === 'attacker';
  const good = attWon === mine;
  const lootSum = b.loot ? b.loot.wood + b.loot.clay + b.loot.iron : 0;
  return (
    <>
      <div class={`rep-verdict ${good ? 'is-good' : 'is-bad'}`}>
        <Icon name={attWon ? 'attack' : 'shield'} size={22} />
        <span>{attWon ? 'The attacker has won' : 'The defender has won'}</span>
      </div>

      <div class="rep-factors">
        <LuckMeter luck={b.luck} />
        <div class="factor"><span>Morale</span><b class="num">{Math.round(b.morale * 100)}%</b></div>
        {b.wall && <div class="factor"><Icon name="b_wall" size={16} /><span>Wall</span><b class="num">{b.wall.before}{b.wall.before !== b.wall.after && <> → {b.wall.after}</>}</b></div>}
        {b.nightOwl && <div class="factor"><span>Night bonus</span><b class="good-text">×2 defense</b></div>}
        {b.militia && <div class="factor"><Icon name="militia" size={16} /><span>Militia fought</span></div>}
        {b.paladinItem && <div class="factor"><Icon name="paladin" size={16} /><span>{ITEM_BY_ID[b.paladinItem]?.name}</span></div>}
      </div>

      <div class="rep-block">
        <SideTable
          role="Attacker" side={b.attacker} cols={cols} win={attWon}
          rows={[
            { label: 'Quantity', units: b.attUnits },
            { label: 'Losses', units: b.attLost, tone: 'loss' },
            { label: 'Survivors', units: minus(b.attUnits, b.attLost), tone: 'alive' },
          ]}
        />
      </div>

      <div class="rep-block">
        <SideTable
          role="Defender" side={b.defender} cols={cols} win={!attWon}
          rows={[
            { label: 'Quantity', units: b.defUnits },
            { label: 'Losses', units: b.defLost, tone: 'loss' },
          ]}
        />
        {!b.defUnits && <p class="muted small rep-note">None of your troops survived to see the defenders.</p>}
      </div>

      {b.scout && (
        <div class="rep-block">
          <h2 class="rep-sub">Espionage</h2>
          <dl class="rep-facts">
            {b.scout.res && (
              <>
                <dt>Resources scouted</dt>
                <dd class="cost">{(['wood', 'clay', 'iron'] as ResKey[]).map((k) => <Res k={k} n={b.scout!.res![k]} />)}</dd>
              </>
            )}
            {b.scout.hidden && (b.scout.hidden.wood + b.scout.hidden.clay + b.scout.hidden.iron) > 0 && (
              <>
                <dt>In the hiding place</dt>
                <dd class="cost">
                  {(['wood', 'clay', 'iron'] as ResKey[]).map((k) => <Res k={k} n={b.scout!.hidden![k]} />)}
                  <span class="muted small">safe from plunder</span>
                </dd>
              </>
            )}
            {b.scout.buildings && (
              <>
                <dt>Buildings</dt>
                <dd>
                  <div class="rep-buildings">
                    {BUILDING_ORDER.filter((id) => (b.scout!.buildings![id] ?? 0) > 0).map((id) => (
                      <span class="rep-bld" title={BUILDINGS[id].name}><Icon name={`b_${id}`} size={18} /><span>{BUILDINGS[id].name}</span><b class="num">{b.scout!.buildings![id]}</b></span>
                    ))}
                  </div>
                </dd>
              </>
            )}
          </dl>
          {b.scout.unitsOutside && (
            <table class="rep-side rep-outside">
              <tbody>
                <tr class="rep-icons"><th /> {cols.map((u) => <td title={unitName(u, false, b.defender.theme ?? 'classic')}><UnitIcon u={u} size={20} theme={b.defender.theme ?? 'classic'} /></td>)}</tr>
                <tr class="rep-count"><th scope="row">Outside:</th>{cols.map((u) => { const n = b.scout!.unitsOutside![u] ?? 0; return <td class={`num ${n === 0 ? 'zero' : ''}`}>{fmt(n)}</td>; })}</tr>
              </tbody>
            </table>
          )}
          {!b.scout.buildings && <p class="muted small">Send more scouts to also see buildings and troops outside.</p>}
        </div>
      )}

      {(b.loot || b.building || b.loyalty) && (
        <div class="rep-block">
          <h2 class="rep-sub">Aftermath</h2>
          <dl class="rep-facts">
            {b.loot && (
              <>
                <dt>Haul</dt>
                <dd>
                  <span class="cost">{(['wood', 'clay', 'iron'] as ResKey[]).map((k) => <Res k={k} n={b.loot![k]} />)}</span>
                  <span class="haul">
                    <span class="haul-bar"><span style={{ width: `${Math.min(100, (lootSum / Math.max(1, b.capacity ?? lootSum)) * 100)}%` }} /></span>
                    <span class="muted small num">{fmt(lootSum)} / {fmt(b.capacity ?? 0)}</span>
                  </span>
                </dd>
              </>
            )}
            {b.building && (
              <>
                <dt>Catapults</dt>
                <dd><Icon name={`b_${b.building.id}`} size={16} /> {BUILDINGS[b.building.id].name} {b.building.before === b.building.after ? `held at level ${b.building.after}` : <>damaged from <b class="num">{b.building.before}</b> to <b class="num">{b.building.after}</b></>}</dd>
              </>
            )}
            {b.loyalty && (
              <>
                <dt>Loyalty</dt>
                <dd>
                  <span class="loyal-bar"><span style={{ width: `${Math.max(0, b.loyalty.after)}%` }} /></span>
                  {b.conquered ? <b class="good-text">fell to 0. The village was conquered!</b> : <>dropped from <b class="num">{Math.round(b.loyalty.before)}</b> to <b class="num">{Math.round(b.loyalty.after)}</b></>}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}

      {kind === 'attack' && mine && (
        <div class="row gap rep-actions">
          <Btn onClick={() => { rallyTarget.value = { x: b.defender.x, y: b.defender.y, kind: 'attack', units: b.attUnits as Record<string, number> }; go({ name: 'building', id: 'rally', tab: 'send' }); }}><Icon name="attack" size={16} /> Attack again with the same troops</Btn>
          <Btn variant="ghost" onClick={() => go({ name: 'map', focus: b.defender.vid })}><Icon name="map" size={16} /> Show on map</Btn>
        </div>
      )}
    </>
  );
}
