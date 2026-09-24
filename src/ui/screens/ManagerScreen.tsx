// The village manager: build templates (an ordered list of "this building to this
// level") and army templates (troops to keep), assigned village by village. The
// game server works through them for you, even while you are away.

import { useEffect, useState } from 'preact/hooks';
import { BUILDINGS, BUILDING_ORDER } from '../../engine/data/buildings';
import { ARMY_ORDER, UNITS, isHero } from '../../engine/data/units';
import { ARMY_PRESETS, BUILD_PRESETS, MANAGER_MAX_VILLAGES, MANAGER_MIN_VILLAGES, type ArmyTemplate, type BuildStep, type BuildTemplate, type ManagerState } from '../../engine/manager';
import type { BuildingId, UnitId } from '../../engine/types';
import type { VillageView } from '../../engine/view';
import { Btn, Empty, NumInput, Section, Tabs, UnitIcon, unitName } from '../components/common';
import { coords, fmt } from '../format';
import { act, liveRes, now, usePane, view } from '../store';

type Tab = 'villages' | 'build' | 'army';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const blank = (): ManagerState => ({ build: [], army: [], villages: {} });
const nextId = (list: { id: number }[]) => list.reduce((n, t) => Math.max(n, t.id), 0) + 1;

/** A building's level counting what is already queued. */
const queued = (v: VillageView, b: BuildingId) => v.buildQueue.reduce((l, j) => (j.building === b ? Math.max(l, j.level) : l), v.buildings[b]);

/** What a village is doing about its build template, in a few words. */
function buildStatus(v: VillageView, t: BuildTemplate | undefined): { text: string; tone: 'ok' | 'warn' | 'muted'; done: number } {
  if (!t) return { text: '—', tone: 'muted', done: 0 };
  const total = t.steps.length || 1;
  const idx = t.steps.findIndex((st) => queued(v, st.b) < st.to);
  if (idx < 0) return { text: 'Template finished', tone: 'ok', done: 1 };
  const st = t.steps[idx];
  const text = `Next: ${BUILDINGS[st.b].name} → ${st.to}`;
  return { text, tone: v.buildQueue.length > 0 ? 'ok' : 'warn', done: idx / total };
}

function armyStatus(v: VillageView, t: ArmyTemplate | undefined): { pct: number; text: string } {
  if (!t) return { pct: 0, text: '—' };
  let want = 0, have = 0;
  for (const [u, n] of Object.entries(t.units) as [UnitId, number][]) {
    const inQueue = Object.values(v.recruit).flat().filter((j) => j.unit === u).reduce((s, j) => s + j.count - j.done, 0);
    want += n * UNITS[u].pop;
    have += Math.min(n, (v.units[u] ?? 0) + inQueue) * UNITS[u].pop;
  }
  const pct = want > 0 ? have / want : 1;
  return { pct, text: `${Math.round(pct * 100)}% of the army` };
}

export function ManagerScreen() {
  const pane = usePane();
  const pv = view.value!;
  const saved = pv.me.manager ?? blank();
  const [draft, setDraft] = useState<ManagerState>(() => clone(saved));
  const [tab, setTab] = useState<Tab>('villages');
  const [openB, setOpenB] = useState<number | null>(saved.build[0]?.id ?? null);
  const [openA, setOpenA] = useState<number | null>(saved.army[0]?.id ?? null);
  const savedJson = JSON.stringify({ ...saved, tickAt: undefined });
  const dirty = JSON.stringify({ ...draft, tickAt: undefined }) !== savedJson;
  // if the server's copy changes while we have nothing unsaved, follow it
  useEffect(() => { if (!dirty) setDraft(clone(saved)); }, [savedJson]);
  const save = (m = draft) => { act({ type: 'manager', manager: m }); setDraft(clone(m)); };
  /** assignments save at once; template edits wait for "Save templates" */
  const assign = (vid: number, patch: { build?: number; army?: number; paused?: boolean }) => {
    const m = clone(draft);
    const cur = { ...(m.villages[vid] ?? {}), ...patch };
    if (cur.build === undefined && cur.army === undefined) delete m.villages[vid];
    else m.villages[vid] = cur;
    save(m);
  };
  /** villages holding one of the manager's slots (paused ones included) */
  const isManaged = (vid: number) => { const mv = draft.villages[vid]; return !!mv && (mv.build !== undefined || mv.army !== undefined); };
  const managedCount = pv.villages.filter((v) => isManaged(v.id)).length;
  const full = managedCount >= MANAGER_MAX_VILLAGES;
  /** set one template on every managed village ('none' clears it; a village left with neither frees its slot) */
  const assignAll = (kind: 'build' | 'army', x: string) => {
    if (x === '') return;
    const m = clone(draft);
    for (const v of pv.villages) if (isManaged(v.id)) m.villages[v.id] = { ...m.villages[v.id], [kind]: x === 'none' ? undefined : Number(x) };
    for (const k in m.villages) if (m.villages[k].build === undefined && m.villages[k].army === undefined) delete m.villages[k];
    save(m);
  };

  if (pv.villages.length < MANAGER_MIN_VILLAGES) {
    return (
      <div class="stack">
        <div class="page-head"><h1>Village manager</h1></div>
        <Section title="Locked">
          <p>The village manager is a tool for running an empire. It unlocks once you rule <b>{MANAGER_MIN_VILLAGES} villages</b>; you rule {pv.villages.length}.</p>
          <p class="muted small">Then you can give each village a build template and an army template, and the realm works through them for you even while you are away. Your saved templates are kept; if you drop below {MANAGER_MIN_VILLAGES} villages the manager switches itself off.</p>
          <div class="row"><Btn small variant="ghost" onClick={() => pane.go({ name: 'quests' })}>See your quests</Btn></div>
        </Section>
      </div>
    );
  }
  return (
    <div class="stack">
      <div class="page-head">
        <h1>Village manager</h1>
        {dirty && <Btn onClick={() => save()}>Save templates</Btn>}
      </div>
      <p class="muted small mgr-lede">
        Give each village a <b>build template</b> (buildings to raise, in order) and an <b>army template</b> (troops to keep).
        The realm works through them for you, even while you are away: it keeps the build queue full as resources allow, and
        recruits only from what the next building doesn't need. Up to {MANAGER_MAX_VILLAGES} villages can be managed at a time.
      </p>
      <Tabs<Tab> active={tab} onChange={setTab} tabs={[{ id: 'villages', label: 'Villages' }, { id: 'build', label: `Build templates (${draft.build.length})` }, { id: 'army', label: `Army templates (${draft.army.length})` }]} />
      {tab === 'villages' && (
        <Section>
          <p class="small mgr-slots">
            Managing <b class="num">{managedCount}</b> of <b class="num">{MANAGER_MAX_VILLAGES}</b> villages.
            {full && <span class="muted"> To manage another village, free a slot by setting a managed village's templates to None.</span>}
          </p>
          {draft.build.length === 0 && draft.army.length === 0 ? (
            <Empty>
              No templates yet. <button type="button" class="link" onClick={() => setTab('build')}>Make a build template</button> or{' '}
              <button type="button" class="link" onClick={() => setTab('army')}>an army template</button> first. Ready-made ones are there to start from.
            </Empty>
          ) : (
            <div class="table-scroll">
              <table class="rank-table mgr-table">
                <thead><tr><th>Village</th><th>Build template</th><th>Progress</th><th>Army template</th><th>Army</th><th /></tr></thead>
                <tbody>
                  {pv.villages.map((v) => {
                    const mv = draft.villages[v.id] ?? {};
                    const bt = draft.build.find((t) => t.id === mv.build);
                    const at = draft.army.find((t) => t.id === mv.army);
                    const bs = buildStatus(v, bt);
                    const as = armyStatus(v, at);
                    const managed = bt || at;
                    const locked = full && !isManaged(v.id);
                    const lockTip = locked ? `You can manage ${MANAGER_MAX_VILLAGES} villages at a time. Set a managed village's templates to None to free a slot.` : undefined;
                    return (
                      <tr class={mv.paused ? 'is-paused' : ''}>
                        <td>
                          <button type="button" class="link" onClick={() => { pane.vid.value = v.id; pane.go({ name: 'village' }); }}>{v.name}</button>
                          <div class="muted small num">{coords(v.x, v.y)} · {fmt(v.points)} pts</div>
                        </td>
                        <td>
                          <select id={`mgr-b-${v.id}`} aria-label={`Build template for ${v.name}`} disabled={locked} title={lockTip} value={mv.build ?? ''} onChange={(e) => { const x = (e.currentTarget as HTMLSelectElement).value; assign(v.id, { build: x === '' ? undefined : Number(x) }); }}>
                            <option value="">None</option>
                            {draft.build.map((t) => <option value={t.id}>{t.name}</option>)}
                          </select>
                        </td>
                        <td>
                          {bt ? (
                            <div class="mgr-status">
                              <div class="progress"><div style={{ width: `${bs.done * 100}%` }} /></div>
                              <span class={`small ${bs.tone === 'warn' ? 'warn-text' : bs.tone === 'ok' ? '' : 'muted'}`}>{mv.paused ? 'Paused' : bs.text}</span>
                            </div>
                          ) : <span class="muted">—</span>}
                        </td>
                        <td>
                          <select id={`mgr-a-${v.id}`} aria-label={`Army template for ${v.name}`} disabled={locked} title={lockTip} value={mv.army ?? ''} onChange={(e) => { const x = (e.currentTarget as HTMLSelectElement).value; assign(v.id, { army: x === '' ? undefined : Number(x) }); }}>
                            <option value="">None</option>
                            {draft.army.map((t) => <option value={t.id}>{t.name}</option>)}
                          </select>
                        </td>
                        <td>
                          {at ? (
                            <div class="mgr-status">
                              <div class="progress"><div style={{ width: `${Math.min(1, as.pct) * 100}%` }} /></div>
                              <span class="small">{as.text}</span>
                            </div>
                          ) : <span class="muted">—</span>}
                        </td>
                        <td class="right">
                          {managed && <Btn small variant="ghost" onClick={() => assign(v.id, { paused: !mv.paused })}>{mv.paused ? 'Resume' : 'Pause'}</Btn>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {managedCount > 1 && (draft.build.length > 0 || draft.army.length > 0) && (
            <div class="row gap wrap mgr-all">
              <span class="small muted">For every managed village:</span>
              <select id="mgr-all-b" aria-label="Build template for every managed village" value="" onChange={(e) => assignAll('build', (e.currentTarget as HTMLSelectElement).value)}>
                <option value="">Build template…</option>
                <option value="none">None</option>
                {draft.build.map((t) => <option value={t.id}>{t.name}</option>)}
              </select>
              <select id="mgr-all-a" aria-label="Army template for every managed village" value="" onChange={(e) => assignAll('army', (e.currentTarget as HTMLSelectElement).value)}>
                <option value="">Army template…</option>
                <option value="none">None</option>
                {draft.army.map((t) => <option value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
        </Section>
      )}
      {tab === 'build' && <BuildTemplates draft={draft} setDraft={setDraft} open={openB} setOpen={setOpenB} />}
      {tab === 'army' && <ArmyTemplates draft={draft} setDraft={setDraft} open={openA} setOpen={setOpenA} />}
      {dirty && (
        <div class="mgr-savebar">
          <span>You have unsaved template changes.</span>
          <Btn small variant="ghost" onClick={() => setDraft(clone(saved))}>Discard</Btn>
          <Btn small onClick={() => save()}>Save templates</Btn>
        </div>
      )}
      <span hidden>{now.value}{liveRes.length}</span>
    </div>
  );
}

interface EditorProps { draft: ManagerState; setDraft: (m: ManagerState) => void; open: number | null; setOpen: (id: number | null) => void }

function BuildTemplates({ draft, setDraft, open, setOpen }: EditorProps) {
  const edit = (id: number, fn: (t: BuildTemplate) => void) => {
    const m = clone(draft);
    const t = m.build.find((x) => x.id === id);
    if (t) fn(t);
    setDraft(m);
  };
  const add = (base: Omit<BuildTemplate, 'id'>) => {
    const m = clone(draft);
    const id = nextId(m.build);
    m.build.push({ id, ...clone(base) });
    setDraft(m);
    setOpen(id);
  };
  const t = draft.build.find((x) => x.id === open);
  return (
    <div class="mgr-grid">
      <Section title="Templates">
        <ul class="mgr-list">
          {draft.build.map((x) => (
            <li><button type="button" class={`mgr-item ${x.id === open ? 'is-active' : ''}`} onClick={() => setOpen(x.id)}><b>{x.name}</b><span class="muted small">{x.steps.length} steps</span></button></li>
          ))}
        </ul>
        <div class="stack-sm">
          <Btn small onClick={() => add({ name: 'New template', steps: [] })}>New empty template</Btn>
          <select id="mgr-bpreset" aria-label="Start from a ready-made build template" value="" onChange={(e) => { const i = Number((e.currentTarget as HTMLSelectElement).value); if (!Number.isNaN(i) && BUILD_PRESETS[i]) add(BUILD_PRESETS[i]); }}>
            <option value="">Start from a ready-made one…</option>
            {BUILD_PRESETS.map((p, i) => <option value={i}>{p.name}</option>)}
          </select>
        </div>
      </Section>
      <Section title={t ? 'Edit template' : 'Pick a template'}>
        {!t ? <Empty>Pick a template on the left, or start a new one.</Empty> : (
          <div class="stack">
            <label class="mgr-name">Name <input id="mgr-bname" value={t.name} maxLength={40} onInput={(e) => edit(t.id, (x) => { x.name = (e.currentTarget as HTMLInputElement).value; })} /></label>
            <p class="muted small">Steps run top to bottom: each building is raised to its level before the next step starts. Steps a village has already reached are skipped.</p>
            {t.steps.length === 0 && <Empty>No steps yet. Add the first below.</Empty>}
            <ol class="mgr-steps">
              {t.steps.map((st, i) => (
                <li>
                  <span class="num muted">{i + 1}</span>
                  <select id={`mgr-step-b-${i}`} aria-label={`Step ${i + 1} building`} value={st.b} onChange={(e) => edit(t.id, (x) => { x.steps[i].b = (e.currentTarget as HTMLSelectElement).value as BuildingId; x.steps[i].to = Math.min(x.steps[i].to, BUILDINGS[x.steps[i].b].max); })}>
                    {BUILDING_ORDER.map((b) => <option value={b}>{BUILDINGS[b].name}</option>)}
                  </select>
                  <span class="small muted">to level</span>
                  <NumInput id={`mgr-step-l-${i}`} value={st.to} max={BUILDINGS[st.b].max} onInput={(n) => edit(t.id, (x) => { x.steps[i].to = Math.max(1, Math.min(BUILDINGS[st.b].max, n === '' ? 1 : n)); })} />
                  <span class="mgr-step-btns">
                    <button type="button" class="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => edit(t.id, (x) => { [x.steps[i - 1], x.steps[i]] = [x.steps[i], x.steps[i - 1]]; })}>↑</button>
                    <button type="button" class="icon-btn" aria-label="Move down" disabled={i === t.steps.length - 1} onClick={() => edit(t.id, (x) => { [x.steps[i + 1], x.steps[i]] = [x.steps[i], x.steps[i + 1]]; })}>↓</button>
                    <button type="button" class="icon-btn" aria-label="Remove step" onClick={() => edit(t.id, (x) => { x.steps.splice(i, 1); })}>✕</button>
                  </span>
                </li>
              ))}
            </ol>
            <div class="row gap wrap">
              <Btn small onClick={() => edit(t.id, (x) => { const last: BuildStep | undefined = x.steps[x.steps.length - 1]; x.steps.push(last ? { b: last.b, to: Math.min(BUILDINGS[last.b].max, last.to + 1) } : { b: 'main', to: 5 }); })}>Add step</Btn>
              <Btn small variant="ghost" onClick={() => { const m = clone(draft); const id = nextId(m.build); m.build.push({ ...clone(t), id, name: `${t.name} (copy)`.slice(0, 40) }); setDraft(m); setOpen(id); }}>Duplicate</Btn>
              <Btn small variant="danger" onClick={() => { const m = clone(draft); m.build = m.build.filter((x) => x.id !== t.id); for (const k in m.villages) if (m.villages[k].build === t.id) delete m.villages[k].build; setDraft(m); setOpen(m.build[0]?.id ?? null); }}>Delete template</Btn>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function ArmyTemplates({ draft, setDraft, open, setOpen }: EditorProps) {
  const pv = view.value!;
  const units = ARMY_ORDER.filter((u) => UNITS[u].building && u !== 'noble' && !isHero(u) && u !== 'militia' && (pv.config.archers || (u !== 'archer' && u !== 'marcher')));
  const edit = (id: number, fn: (t: ArmyTemplate) => void) => {
    const m = clone(draft);
    const t = m.army.find((x) => x.id === id);
    if (t) fn(t);
    setDraft(m);
  };
  const add = (base: Omit<ArmyTemplate, 'id'>) => {
    const m = clone(draft);
    const id = nextId(m.army);
    m.army.push({ id, ...clone(base) });
    setDraft(m);
    setOpen(id);
  };
  const t = draft.army.find((x) => x.id === open);
  const pop = t ? Object.entries(t.units).reduce((s, [u, n]) => s + (n ?? 0) * UNITS[u as UnitId].pop, 0) : 0;
  return (
    <div class="mgr-grid">
      <Section title="Templates">
        <ul class="mgr-list">
          {draft.army.map((x) => (
            <li><button type="button" class={`mgr-item ${x.id === open ? 'is-active' : ''}`} onClick={() => setOpen(x.id)}><b>{x.name}</b><span class="muted small">{Object.keys(x.units).length} kinds</span></button></li>
          ))}
        </ul>
        <div class="stack-sm">
          <Btn small onClick={() => add({ name: 'New army', units: {} })}>New empty template</Btn>
          <select id="mgr-apreset" aria-label="Start from a ready-made army template" value="" onChange={(e) => { const i = Number((e.currentTarget as HTMLSelectElement).value); if (!Number.isNaN(i) && ARMY_PRESETS[i]) add(ARMY_PRESETS[i]); }}>
            <option value="">Start from a ready-made one…</option>
            {ARMY_PRESETS.map((p, i) => <option value={i}>{p.name}</option>)}
          </select>
        </div>
      </Section>
      <Section title={t ? 'Edit template' : 'Pick a template'}>
        {!t ? <Empty>Pick a template on the left, or start a new one.</Empty> : (
          <div class="stack">
            <label class="mgr-name">Name <input id="mgr-aname" value={t.name} maxLength={40} onInput={(e) => edit(t.id, (x) => { x.name = (e.currentTarget as HTMLInputElement).value; })} /></label>
            <p class="muted small">How many of each troop the village should keep (at home, in training or supporting its own villages). Leave a box empty for none.</p>
            <div class="mgr-units">
              {units.map((u) => (
                <label class="mgr-unit">
                  <UnitIcon u={u} size={20} />
                  <span class="small">{unitName(u, true)}</span>
                  <NumInput id={`mgr-u-${u}`} value={t.units[u] ?? ''} onInput={(n) => edit(t.id, (x) => { if (n === '' || n <= 0) delete x.units[u]; else x.units[u] = n; })} />
                </label>
              ))}
            </div>
            <p class="small">Farm space needed: <b class="num">{fmt(pop)}</b></p>
            <div class="row gap wrap">
              <Btn small variant="ghost" onClick={() => { const m = clone(draft); const id = nextId(m.army); m.army.push({ ...clone(t), id, name: `${t.name} (copy)`.slice(0, 40) }); setDraft(m); setOpen(id); }}>Duplicate</Btn>
              <Btn small variant="danger" onClick={() => { const m = clone(draft); m.army = m.army.filter((x) => x.id !== t.id); for (const k in m.villages) if (m.villages[k].army === t.id) delete m.villages[k].army; setDraft(m); setOpen(m.army[0]?.id ?? null); }}>Delete template</Btn>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
