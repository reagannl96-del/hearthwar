import { BUILDINGS } from '../../engine/data/buildings';
import { themeOfHero } from '../../engine/data/themes';
import type { BuildingId, RecruitBuilding } from '../../engine/types';
import { Icon } from '../art/icons';
import { Village3D } from '../three/Village3D';
import { Btn, Countdown, Empty, Progress, Section, UnitList } from '../components/common';
import { fmt } from '../format';
import { act, battleReplay, go, host, isNightNow, liveRes, now, paused, prefs, setPrefs, view, village, warp } from '../store';
import type { TheatreInput } from '../three/battle/theatre';
import { isVolcanic, isWinter } from '../../engine/world';
import { CommandRow } from './RallyScreen';

const BONUS_TEXT: Record<string, string> = {
  wood: '+100% wood production', clay: '+100% clay production', iron: '+100% iron production', all: '+30% all resources',
  farm: '+10% population', storage: '+50% storage and merchants', recruit: '33% faster recruitment',
};

export function VillageScreen() {
  const v = village.value!;
  const pv = view.value!;
  const upgrading: Partial<Record<BuildingId, number>> = {};
  for (const j of v.buildQueue) upgrading[j.building] = j.level;
  const night = isNightNow(prefs.value);
  const quest = pv.quests.find((q) => q.done) ?? pv.quests[0];
  const moves = [...pv.incoming.filter((c) => c.toVid === v.id), ...pv.commands.filter((c) => c.fromVid === v.id || c.toVid === v.id)]
    .sort((a, b) => a.arrive - b.arrive)
    .slice(0, 6);
  const recruiting = (['barracks', 'stable', 'workshop', 'academy', 'statue'] as RecruitBuilding[]).filter((b) => v.recruit[b].length > 0);
  const supportTotal = v.support.length;
  // attacks on this village, and what happened when they landed, for the scene to act out
  const t = now.value;
  const battle: TheatreInput = {
    now: t,
    rate: paused.value ? 0 : warp.value,
    village: {
      id: v.id, x: v.x, y: v.y, buildings: v.buildings, units: v.units,
      support: v.support.map((s) => ({ units: s.units, theme: s.theme })),
      hide: v.hide, res: liveRes(v, t), theme: themeOfHero(v.hero),
    },
    incoming: pv.incoming.filter((c) => c.toVid === v.id && c.kind === 'attack').map((c) => ({
      id: c.id, fromVid: c.fromVid, fromX: c.fromX, fromY: c.fromY, toX: c.toX, toY: c.toY,
      depart: c.depart, arrive: c.arrive, theme: c.theme, kinds: c.kinds, ownerName: c.ownerName,
    })),
    reports: host.value!.reports()
      .filter((r) => r.kind === 'defense' && r.vid === v.id && r.battle && t - r.t < 10 * 60_000)
      .slice(0, 8)
      .map((r) => ({ id: r.id, t: r.t, battle: r.battle! })),
  };
  const rp = battleReplay.value;
  const replay = rp && rp.report.vid === v.id && rp.report.battle
    ? { report: { id: rp.report.id, t: rp.report.t, battle: rp.report.battle }, at: rp.at, fromX: rp.report.battle.attacker.x, fromY: rp.report.battle.attacker.y }
    : null;
  return (
    <div class="village-layout">
      <div class="scene-col">
        <div class="scene-wrap">
          <Village3D
            buildings={v.buildings}
            building={upgrading}
            onPick={(b) => go({ name: 'building', id: b })}
            color={0xe0a526}
            points={v.points}
            villageId={v.id}
            winter={prefs.value.season === 'auto' ? isWinter(v.x, v.y, pv.config.size) : prefs.value.season === 'winter'}
            volcanic={prefs.value.season === 'auto' && isVolcanic(v.x, v.y, pv.config.size)}
            night={night}
            units={v.units}
            marches={[
              ...pv.commands.filter((c) => c.fromVid === v.id && (c.kind === 'attack' || c.kind === 'support')).map((c) => ({ id: c.id, kind: 'out' as const, units: c.units ?? {}, at: c.depart })),
              ...pv.commands.filter((c) => c.fromVid === v.id && c.kind === 'return').map((c) => ({ id: c.id, kind: 'home' as const, units: c.units ?? {}, at: c.arrive })),
            ]}
            now={now.value}
            militia={!!v.militiaUntil && v.militiaUntil > now.value}
            theme={themeOfHero(v.hero)}
            battle={battle}
            replay={replay}
            onReplayed={() => { battleReplay.value = null; }}
            onToggleNight={() => setPrefs({ sceneTime: night ? 'day' : 'night' })}
          />
        </div>
        {quest && (
          <button type="button" class={`quest-strip ${quest.done ? 'is-done' : ''}`} onClick={() => go({ name: 'quests' })}>
            <Icon name="quest" size={18} />
            <span>
              <b>{quest.title}</b> — {quest.done ? 'complete! Claim your reward.' : quest.text}
            </span>
            <span class="num muted">{fmt(quest.cur)}/{fmt(quest.max)}</span>
          </button>
        )}
        <TroopMovements vid={v.id} />
      </div>
      <aside class="side-col">
        <Section title="Construction" actions={<Btn small variant="ghost" onClick={() => go({ name: 'building', id: 'main' })}>Headquarters</Btn>}>
          {v.buildQueue.length === 0 ? (
            <Empty>Nothing is being built. Pick a building in the village or open the headquarters.</Empty>
          ) : (
            <ul class="queue">
              {v.buildQueue.map((j, i) => (
                <li class="queue-item">
                  <Icon name={`b_${j.building}`} size={18} />
                  <span class="grow">
                    {BUILDINGS[j.building].name} <span class="muted">{j.demolish ? `→ ${j.level} (demolish)` : `→ ${j.level}`}</span>
                    {i === 0 && <Progress from={j.start} to={j.end} />}
                  </span>
                  <Countdown until={j.end} />
                  <button type="button" class="icon-btn" aria-label="Cancel" title="Cancel (refund)" onClick={() => act({ type: 'cancelBuild', vid: v.id, job: j.id })}>
                    <Icon name="close" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p class="muted small">
            {v.buildQueue.length}/{v.buildSlots} queue slots
          </p>
        </Section>

        {recruiting.length > 0 && (
          <Section title="Recruitment">
            <ul class="queue">
              {recruiting.map((b) => {
                const q = v.recruit[b];
                const end = q[q.length - 1].start + q[q.length - 1].count * q[q.length - 1].per;
                const first = q[0];
                return (
                  <li class="queue-item">
                    <Icon name={first.unit} size={18} />
                    <button type="button" class="link grow" onClick={() => go({ name: 'building', id: b })}>
                      {q.reduce((s, j) => s + j.count - j.done, 0)} in the {BUILDINGS[b].name.toLowerCase()}
                    </button>
                    <Countdown until={end} />
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        <Section title="Troops at home" actions={<Btn small variant="ghost" onClick={() => go({ name: 'building', id: 'rally', tab: 'send' })}>Send</Btn>}>
          <UnitList units={v.units} empty="No troops at home." />
          {supportTotal > 0 && (
            <div class="sub">
              <h4>Support stationed here</h4>
              {v.support.map((s) => (
                <div class="support-row">
                  <span class="muted small">{s.ownerName} · {s.fromName}</span>
                  <UnitList units={s.units} theme={s.theme} />
                </div>
              ))}
            </div>
          )}
          {v.militiaUntil && v.militiaUntil > now.value && (
            <p class="small warn-text">The militia stands guard for <Countdown until={v.militiaUntil} /> (production halved).</p>
          )}
        </Section>

        <Section title="Movements" actions={<Btn small variant="ghost" onClick={() => go({ name: 'building', id: 'rally', tab: 'commands' })}>All</Btn>}>
          {moves.length === 0 ? <Empty>No troops on the move.</Empty> : (
            <ul class="cmd-list compact">
              {moves.map((c) => <CommandRow c={c} compact />)}
            </ul>
          )}
        </Section>

        <Section title="Village">
          <dl class="facts">
            <dt>Production</dt>
            <dd class="num">{fmt(v.rates.wood + v.rates.clay + v.rates.iron)}/h</dd>
            <dt>Warehouse</dt>
            <dd class="num">{fmt(v.storage)} each</dd>
            <dt>Hidden from raiders</dt>
            <dd class="num">{fmt(v.hide)} each</dd>
            <dt>Loyalty</dt>
            <dd class="num">{Math.floor(v.loyalty)}</dd>
            {v.bonus && (
              <>
                <dt>Bonus</dt>
                <dd>{BONUS_TEXT[v.bonus]}</dd>
              </>
            )}
          </dl>
        </Section>
      </aside>
    </div>
  );
}

/** Every army leaving, coming home to, or marching on the selected village. */
function TroopMovements({ vid }: { vid: number }) {
  const pv = view.value!;
  const out = pv.commands.filter((c) => c.fromVid === vid && (c.kind === 'attack' || c.kind === 'support')).sort((a, b) => a.arrive - b.arrive);
  const back = pv.commands.filter((c) => c.fromVid === vid && c.kind === 'return').sort((a, b) => a.arrive - b.arrive);
  const inc = pv.incoming.filter((c) => c.toVid === vid && (c.kind === 'attack' || c.kind === 'support')).sort((a, b) => a.arrive - b.arrive);
  const groups: [string, typeof out][] = [['Incoming', inc], ['Attacks & support', out], ['Returning', back]];
  const total = out.length + back.length + inc.length;
  return (
    <Section title="Troop movements" actions={<Btn small variant="ghost" onClick={() => go({ name: 'building', id: 'rally', tab: 'commands' })}>Rally point</Btn>}>
      {total === 0 ? <Empty>No armies are on the road from this village.</Empty> : groups.filter(([, list]) => list.length > 0).map(([title, list]) => (
        <div class="move-group">
          <h4>{title} <span class="muted small">({list.length})</span></h4>
          <ul class="cmd-list">
            {list.slice(0, 30).map((c) => <CommandRow c={c} />)}
          </ul>
        </div>
      ))}
    </Section>
  );
}
