import { BUILDINGS } from '../../engine/data/buildings';
import type { BuildingId, RecruitBuilding } from '../../engine/types';
import { Icon } from '../art/icons';
import { Village3D } from '../three/Village3D';
import { Btn, Countdown, Empty, Progress, Section, UnitList } from '../components/common';
import { fmt } from '../format';
import { act, go, isNightNow, now, prefs, setPrefs, view, village } from '../store';
import { isWinter } from '../../engine/world';
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
            night={night}
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
                  <UnitList units={s.units} />
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
