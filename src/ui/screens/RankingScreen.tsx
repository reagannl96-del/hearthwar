import { useState } from 'preact/hooks';
import { Icon } from '../art/icons';
import { Btn, Empty, Section, Tabs } from '../components/common';
import { Sparkline } from '../components/Sparkline';
import { coords, fmt } from '../format';
import { go, host, view } from '../store';

type Tab = 'players' | 'tribes' | 'oda' | 'odd';

const PERSONA: Record<string, string> = { farmer: 'Raider', warlord: 'Warlord', turtle: 'Defender', expander: 'Conqueror' };

export function RankingScreen({ player }: { player?: number }) {
  const h = host.value!;
  view.value;
  const [tab, setTab] = useState<Tab>('players');
  if (player !== undefined) return <Profile pid={player} />;
  const rank = h.ranking();
  const me = view.value!.me.id;
  const tribes = h.tribes().sort((a, b) => b.points - a.points);
  const sorted = tab === 'oda' ? [...rank].sort((a, b) => b.killsAtt - a.killsAtt) : tab === 'odd' ? [...rank].sort((a, b) => b.killsDef - a.killsDef) : rank;
  return (
    <div class="stack">
      <div class="page-head"><h1>Rankings</h1></div>
      <Tabs<Tab> active={tab} onChange={setTab} tabs={[{ id: 'players', label: 'Rulers' }, { id: 'tribes', label: 'Tribes' }, { id: 'oda', label: 'Attackers' }, { id: 'odd', label: 'Defenders' }]} />
      {tab === 'tribes' ? (
        <Section>
          {tribes.length === 0 ? <Empty>No tribes in this realm.</Empty> : (
            <div class="table-scroll">
              <table class="rank-table">
                <thead><tr><th>#</th><th>Tribe</th><th>Members</th><th class="right">Villages</th><th class="right">Points</th></tr></thead>
                <tbody>
                  {tribes.map((t, i) => (
                    <tr>
                      <td class="num">{i + 1}</td>
                      <td><i class="sw" style={{ background: t.color }} /> <b>[{t.tag}]</b> {t.name}</td>
                      <td class="small">{t.memberNames.join(', ')}</td>
                      <td class="right num">{t.villages}</td>
                      <td class="right num">{fmt(t.points)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      ) : (
        <Section>
          <div class="table-scroll">
            <table class="rank-table">
              <thead>
                <tr><th>#</th><th>Ruler</th><th>Tribe</th><th class="right">Villages</th><th class="right">{tab === 'oda' ? 'Defeated (attack)' : tab === 'odd' ? 'Defeated (defense)' : 'Points'}</th></tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => (
                  <tr class={p.id === me ? 'is-me' : ''}>
                    <td class="num">{i + 1}</td>
                    <td>
                      <button type="button" class="link" onClick={() => go({ name: 'ranking', player: p.id })}>
                        <i class="sw" style={{ background: p.id === me ? 'var(--me)' : p.color }} /> {p.name}
                      </button>
                      {p.personality && <span class="muted small"> · {PERSONA[p.personality]}</span>}
                    </td>
                    <td>{p.tribe && <span class="pill">{p.tribe}</span>}</td>
                    <td class="right num">{p.villages}</td>
                    <td class="right num">{fmt(tab === 'oda' ? p.killsAtt : tab === 'odd' ? p.killsDef : p.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

function Profile({ pid }: { pid: number }) {
  const h = host.value!;
  const p = h.profile(pid);
  const me = view.value!.me.id;
  if (!p) return <Section><Empty>That ruler is gone.</Empty></Section>;
  return (
    <div class="stack">
      <div class="crumbs">
        <button type="button" class="link" onClick={() => go({ name: 'ranking' })}>Rankings</button>
        <span aria-hidden="true">›</span>
        <span>{p.name}</span>
      </div>
      <div class="page-head">
        <h1><i class="sw lg" style={{ background: p.id === me ? 'var(--me)' : p.color }} /> {p.name}</h1>
        {p.tribe && <span class="pill">[{p.tribe.tag}] {p.tribe.name}</span>}
      </div>
      <div class="grid-2">
        <Section title="Standing">
          <dl class="facts">
            <dt>Points</dt><dd class="num">{fmt(p.points)}</dd>
            <dt>Villages</dt><dd class="num">{p.villages.length}</dd>
            <dt>Enemy troops defeated attacking</dt><dd class="num">{fmt(p.stats.killsAtt)}</dd>
            <dt>Enemy troops defeated defending</dt><dd class="num">{fmt(p.stats.killsDef)}</dd>
            <dt>Villages conquered</dt><dd class="num">{p.stats.conquered}</dd>
            {p.personality && <><dt>Temperament</dt><dd>{PERSONA[p.personality]}</dd></>}
          </dl>
        </Section>
        <Section title="Growth">
          {p.history.length > 1 ? <Sparkline points={p.history} /> : <p class="muted">Not enough history yet.</p>}
        </Section>
      </div>
      <Section title="Villages">
        <div class="table-scroll">
          <table class="rank-table">
            <thead><tr><th>Village</th><th>Coordinates</th><th class="right">Points</th><th /></tr></thead>
            <tbody>
              {p.villages.sort((a, b) => b.points - a.points).map((v) => (
                <tr>
                  <td>{v.name}</td>
                  <td class="num">{coords(v.x, v.y)}</td>
                  <td class="right num">{fmt(v.points)}</td>
                  <td class="right"><Btn small variant="ghost" onClick={() => go({ name: 'map', focus: v.id })}><Icon name="map" size={14} /> Map</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
