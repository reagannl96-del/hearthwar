import type { RecruitBuilding } from '../../engine/types';
import type { VillageView } from '../../engine/view';
import { fmt } from '../format';
import { act } from '../store';
import { Btn, Countdown, Progress, Section, UnitIcon, unitName } from './common';

/** What a building has in training: each batch, the next one out, and when they are all done. */
export function RecruitQueue({ v, b }: { v: VillageView; b: RecruitBuilding }) {
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
