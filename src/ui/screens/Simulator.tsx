import { useState } from 'preact/hooks';
import { HEROES, ITEM_BY_ID, UNITS, UNIT_ORDER, isHero, itemsFor, itemHero } from '../../engine/data/units';
import type { UnitId, Units } from '../../engine/types';
import { EffectFactors } from './ReportsScreen';
import { Icon } from '../art/icons';
import { Btn, NumInput, Section, UnitTable, UnitIcon, unitName } from '../components/common';
import { fmt } from '../format';
import { host, view, usePane } from '../store';

const ATT_UNITS: UnitId[] = UNIT_ORDER;
const DEF_UNITS: UnitId[] = [...UNIT_ORDER, 'militia'];

export function Simulator() {
  const pane = usePane();
  const pv = view.value!;
  const v = pane.village.value!;
  const [att, setAtt] = useState<Units>({});
  const [def, setDef] = useState<Units>({});
  const [wall, setWall] = useState<number | ''>(0);
  const [luck, setLuck] = useState<number | ''>(0);
  const [morale, setMorale] = useState<number | ''>(100);
  const [item, setItem] = useState('');
  // (a world without heroes has none of the statue's heroes, not just no paladin)
  const units = (list: UnitId[]) => list.filter((u) => (pv.config.archers || (u !== 'archer' && u !== 'marcher')) && (pv.config.paladin || !isHero(u)));
  const r = host.value!.simulate({
    att,
    attTech: v.tech,
    // an item only works in the hands of its own hero
    attItem: item && (att[itemHero(ITEM_BY_ID[item])] ?? 0) > 0 ? ITEM_BY_ID[item] : null,
    defStacks: [{ units: def, tech: {} }],
    defItems: [],
    wall: Number(wall || 0),
    luck: Number(luck || 0) / 100,
    morale: Math.max(30, Math.min(100, Number(morale || 100))) / 100,
    catTargetLevel: 10,
  });
  const anyAtt = Object.values(att).some((n) => (n ?? 0) > 0);
  const defSurv: Units = {};
  for (const k in def) defSurv[k as UnitId] = Math.max(0, (def[k as UnitId] ?? 0) - (r.defLost[0]?.[k as UnitId] ?? 0));
  return (
    <div class="stack">
      <div class="grid-2">
        <Section title="Attacker" actions={<Btn small variant="ghost" onClick={() => setAtt({ ...v.units, militia: 0 })}>Use my troops</Btn>}>
          <div class="unit-inputs compact">
            {units(ATT_UNITS).map((u) => (
              <label class="unit-input">
                <span class="uname"><UnitIcon u={u} size={18} /> {unitName(u)}</span>
                <NumInput id={`sim-a-${u}`} value={att[u] ?? ''} onInput={(n) => setAtt({ ...att, [u]: n === '' ? 0 : n })} />
              </label>
            ))}
          </div>
          {pv.config.paladin && (
            <label class="field">
              <span>Hero's legendary item</span>
              <select id="sim-item" value={item} onChange={(e) => setItem((e.currentTarget as HTMLSelectElement).value)}>
                <option value="">None</option>
                {HEROES.map((h) => <optgroup label={UNITS[h].name}>{itemsFor(h).map((i) => <option value={i.id}>{i.name}</option>)}</optgroup>)}
              </select>
            </label>
          )}
          <p class="muted small">Uses this village's smithy levels for the attacker.</p>
        </Section>
        <Section title="Defender" actions={<Btn small variant="quiet" onClick={() => setDef({})}>Clear</Btn>}>
          <div class="unit-inputs compact">
            {units(DEF_UNITS).map((u) => (
              <label class="unit-input">
                <span class="uname"><UnitIcon u={u} size={18} /> {unitName(u)}</span>
                <NumInput id={`sim-d-${u}`} value={def[u] ?? ''} onInput={(n) => setDef({ ...def, [u]: n === '' ? 0 : n })} />
              </label>
            ))}
          </div>
          <div class="row gap wrap">
            <label class="field"><span>Wall</span><input id="sim-wall" type="number" min={0} max={20} value={wall} onInput={(e) => setWall(Math.max(0, Math.min(20, Number(e.currentTarget.value) || 0)))} /></label>
            <label class="field"><span>Luck %</span><input id="sim-luck" type="number" min={-25} max={25} value={luck} onInput={(e) => setLuck(Math.max(-25, Math.min(25, Number(e.currentTarget.value) || 0)))} /></label>
            <label class="field"><span>Morale %</span><input id="sim-morale" type="number" min={30} max={100} value={morale} onInput={(e) => setMorale(Number(e.currentTarget.value) || 100)} /></label>
          </div>
        </Section>
      </div>
      <Section title="Outcome">
        {!anyAtt ? <p class="muted">Add attacking troops to simulate a battle.</p> : (
          <>
            <p class={`outcome ${r.winner === 'attacker' ? 'is-win' : 'is-loss'}`}>
              {r.pureScout ? (r.winner === 'attacker' ? 'Your scouts get through.' : 'Your scouts are caught.') : r.winner === 'attacker' ? 'The attacker wins.' : 'The defender holds.'}
              {!r.pureScout && <span class="muted small"> Attack strength <span class="num">{fmt(r.attStrength)}</span> vs defense <span class="num">{fmt(r.defStrength)}</span>{r.battleWall !== Number(wall || 0) ? ` (wall fought at ${r.battleWall})` : ''}.</span>}
            </p>
            <UnitTable rows={[
              { label: 'Attacker', units: att },
              { label: 'Losses', units: r.attLost, tone: 'loss' },
              { label: 'Defender', units: def },
              { label: 'Losses', units: r.defLost[0] ?? {}, tone: 'loss' },
              { label: 'Survivors', units: defSurv },
            ]} />
            {Number(wall || 0) > 0 && <p class="small">Wall after the battle: <b class="num">{r.wallAfter}</b></p>}
            {!r.pureScout && (r.effects?.length ?? 0) > 0 && (
              <div class="rep-factors sim-effects" aria-label="Hero abilities in play">
                <EffectFactors effects={r.effects} wall={Number(wall || 0)} />
              </div>
            )}
          </>
        )}
      </Section>
    </div>
  );
}
