import { useEffect, useState } from 'preact/hooks';
import type { Difficulty } from '../../engine/types';
import { SIZE_PRESETS, SPEED_PRESETS, defaultConfig } from '../../engine/world';
import { LocalHost, deleteSave, importSave, listSaves, type SaveMeta } from '../../host/local';
import { Icon } from '../art/icons';
import { Btn } from '../components/common';
import { fmt } from '../format';
import { startHost, forgetResume, beginResume, resumeTarget } from '../store';
import { ShowcaseVillage } from '../three/Village3D';
import { onlineEnabled } from '../../net/supabase';
import { OnlinePanel } from './OnlinePanel';

function Leaf({ flip }: { flip?: boolean }) {
  return (
    <svg class="leaf" viewBox="0 0 24 24" aria-hidden="true" style={flip ? { transform: 'scaleX(-1) rotate(-20deg)' } : { transform: 'rotate(-20deg)' }}>
      <path d="M12 2l1.6 3.6 3.4-1.2-.9 3.8 3.9.4-2.6 2.8 3.1 2.3-4 .9.6 3.9-3.6-1.6L12 22l-1.5-5.1-3.6 1.6.6-3.9-4-.9 3.1-2.3L4 8.6l3.9-.4L7 4.4l3.4 1.2z" fill="#c4581f" stroke="#7a2f10" stroke-width=".8" />
      <path d="M12 7v15" stroke="#7a2f10" stroke-width="1" />
    </svg>
  );
}

type SpeedKey = keyof typeof SPEED_PRESETS;
type SizeKey = keyof typeof SIZE_PRESETS;

const DIFFICULTY: { id: Difficulty; label: string; text: string }[] = [
  { id: 'peaceful', label: 'Peaceful', text: 'Rulers fight each other but never attack you.' },
  { id: 'easy', label: 'Easy', text: 'Rulers rarely attack, and only if you look weak.' },
  { id: 'normal', label: 'Normal', text: 'A living realm. Neighbours will test your walls.' },
  { id: 'hard', label: 'Hard', text: 'Rulers grow fast and hunt you down.' },
];

export function TitleScreen() {
  const [saves, setSaves] = useState<SaveMeta[] | null>(null);
  const [mode, setMode] = useState<'home' | 'new' | 'import'>('home');
  const [loading, setLoading] = useState<{ label: string; p: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = () => listSaves().then((s) => {
    setSaves(s);
    if (s.length === 0 && !onlineEnabled) setMode('new');
  });
  useEffect(() => { void refresh(); }, []);
  // coming back after a refresh: straight into the realm the player was in
  useEffect(() => {
    const r = resumeTarget();
    if (r?.kind === 'local' && beginResume()) void listSaves().then((all) => { if (all.some((x) => x.id === r.id)) void open(r.id); else forgetResume(); });
  }, []);

  const open = async (id: string) => {
    setError(null);
    setLoading({ label: 'Opening the gates…', p: 0 });
    try {
      const h = await LocalHost.load(id, (done, total) => setLoading({ label: 'The realm moved on while you were away…', p: total > 0 ? done / total : 1 }));
      startHost(h);
    } catch (e) {
      forgetResume();
      setError((e as Error).message);
      setLoading(null);
    }
  };

  if (loading) {
    return (
      <div class="title-screen">
        <ShowcaseVillage />
        <div class="title-card loading-card">
          <h1 class="title-logo">Hearthwar</h1>
          <p>{loading.label}</p>
          <div class="progress"><div style={{ width: `${Math.round(loading.p * 100)}%` }} /></div>
        </div>
      </div>
    );
  }

  return (
    <div class="title-screen">
      <ShowcaseVillage />
      <div class="title-card">
        <header class="title-head">
          <h1 class="title-logo"><Leaf />Hearthwar<Leaf flip /></h1>
          <p class="title-tag">Raise a village. Raid your neighbours. Crown yourself ruler of the realm — in a day, not a season.</p>
        </header>
        {error && <p class="form-error">{error}</p>}
        {onlineEnabled && mode === 'home' && <OnlinePanel />}
        {onlineEnabled && mode === 'home' && <h2 class="solo-head">Or play alone</h2>}
        {mode === 'home' && saves && (
          <div class="saves">
            <div class="saves-head">
              <h2>Your realms</h2>
              <div class="row gap">
                <Btn variant="ghost" onClick={() => setMode('import')}>Import save</Btn>
                <Btn onClick={() => setMode('new')}>New realm</Btn>
              </div>
            </div>
            <ul class="save-list">
              {saves.map((s) => (
                <li class="save">
                  <button type="button" class="save-open" onClick={() => open(s.id)}>
                    <span class="save-name">{s.name}</span>
                    <span class="save-meta">
                      {s.playerName} · <span class="num">{fmt(s.points)}</span> points · {s.villages} {s.villages === 1 ? 'village' : 'villages'} · speed {s.speed}×
                    </span>
                    <span class="save-meta muted">Last played {new Date(s.savedAt).toLocaleString()}</span>
                  </button>
                  {confirmDelete === s.id ? (
                    <span class="row gap">
                      <Btn variant="danger" small onClick={async () => { await deleteSave(s.id); setConfirmDelete(null); void refresh(); }}>Delete forever</Btn>
                      <Btn variant="ghost" small onClick={() => setConfirmDelete(null)}>Keep</Btn>
                    </span>
                  ) : (
                    <button type="button" class="icon-btn" aria-label={`Delete ${s.name}`} title="Delete" onClick={() => setConfirmDelete(s.id)}>
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {mode === 'new' && <NewWorld onCancel={saves && saves.length ? () => setMode('home') : undefined} onError={setError} setLoading={setLoading} />}
        {mode === 'import' && <ImportSave onDone={(id) => open(id)} onCancel={() => setMode('home')} />}
      </div>
    </div>
  );
}

function NewWorld({ onCancel, onError, setLoading }: { onCancel?: () => void; onError: (e: string) => void; setLoading: (l: { label: string; p: number } | null) => void }) {
  const [ruler, setRuler] = useState('');
  const [vname, setVname] = useState('');
  const [wname, setWname] = useState('The Ashen Marches');
  const [speed, setSpeed] = useState<SpeedKey>('standard');
  const [size, setSize] = useState<SizeKey>('medium');
  const [diff, setDiff] = useState<Difficulty>('normal');
  const [adv, setAdv] = useState(false);
  const base = defaultConfig();
  const [archers, setArchers] = useState(base.archers);
  const [paladin, setPaladin] = useState(base.paladin);
  const [morale, setMorale] = useState(base.morale);
  const [luck, setLuck] = useState(25);
  const [customSpeed, setCustomSpeed] = useState<number>(SPEED_PRESETS.standard.speed);
  const [customUnit, setCustomUnit] = useState<number>(SPEED_PRESETS.standard.unitSpeed);

  const start = async (e: Event) => {
    e.preventDefault();
    const name = ruler.trim() || 'Wanderer';
    setLoading({ label: 'Drawing the map…', p: 0.3 });
    await new Promise((r) => setTimeout(r, 30));
    try {
      const sp = adv ? { speed: customSpeed, unitSpeed: customUnit } : SPEED_PRESETS[speed];
      const h = await LocalHost.create({
        worldName: wname.trim() || 'New realm',
        playerName: name,
        villageName: vname.trim() || `${name}'s hold`,
        config: {
          ...base,
          speed: sp.speed,
          unitSpeed: sp.unitSpeed,
          size: SIZE_PRESETS[size].size,
          aiCount: SIZE_PRESETS[size].aiCount,
          difficulty: diff,
          archers,
          paladin,
          morale,
          luck: luck / 100,
        },
      });
      startHost(h);
    } catch (err) {
      onError((err as Error).message);
      setLoading(null);
    }
  };

  return (
    <form class="new-world" onSubmit={start}>
      <h2>Found a new realm</h2>
      <div class="field-grid">
        <label class="field">
          <span>Your name</span>
          <input id="ruler-name" value={ruler} maxLength={24} placeholder="Wanderer" onInput={(e) => setRuler(e.currentTarget.value)} />
        </label>
        <label class="field">
          <span>Village name</span>
          <input id="village-name" value={vname} maxLength={32} placeholder={`${ruler.trim() || 'Wanderer'}'s hold`} onInput={(e) => setVname(e.currentTarget.value)} />
        </label>
        <label class="field">
          <span>Realm name</span>
          <input id="world-name" value={wname} maxLength={40} onInput={(e) => setWname(e.currentTarget.value)} />
        </label>
      </div>

      <fieldset class="choice-group">
        <legend>Pace</legend>
        <div class="choices">
          {(Object.keys(SPEED_PRESETS) as SpeedKey[]).map((k) => (
            <label class={`choice ${speed === k && !adv ? 'is-on' : ''}`}>
              <input type="radio" name="speed" checked={speed === k} onChange={() => { setSpeed(k); setCustomSpeed(SPEED_PRESETS[k].speed); setCustomUnit(SPEED_PRESETS[k].unitSpeed); }} />
              <b>{SPEED_PRESETS[k].label}</b>
              <span class="num muted">{SPEED_PRESETS[k].speed}× economy · {SPEED_PRESETS[k].unitSpeed}× marching</span>
              <span>{SPEED_PRESETS[k].blurb}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset class="choice-group">
        <legend>Map</legend>
        <div class="choices choices-3">
          {(Object.keys(SIZE_PRESETS) as SizeKey[]).map((k) => (
            <label class={`choice ${size === k ? 'is-on' : ''}`}>
              <input type="radio" name="size" checked={size === k} onChange={() => setSize(k)} />
              <b>{SIZE_PRESETS[k].label}</b>
              <span class="num muted">{SIZE_PRESETS[k].size}×{SIZE_PRESETS[k].size} fields · {SIZE_PRESETS[k].aiCount} rulers</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset class="choice-group">
        <legend>Rival rulers</legend>
        <div class="choices choices-4">
          {DIFFICULTY.map((d) => (
            <label class={`choice ${diff === d.id ? 'is-on' : ''}`}>
              <input type="radio" name="difficulty" checked={diff === d.id} onChange={() => setDiff(d.id)} />
              <b>{d.label}</b>
              <span>{d.text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <details class="advanced" open={adv} onToggle={(e) => setAdv((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>World rules</summary>
        <div class="field-grid">
          <label class="field">
            <span>Economy speed</span>
            <input id="custom-speed" type="number" min={1} max={2000} value={customSpeed} onInput={(e) => setCustomSpeed(Math.max(1, Number(e.currentTarget.value) || 1))} />
          </label>
          <label class="field">
            <span>Marching speed</span>
            <input id="custom-unit" type="number" min={1} max={2000} value={customUnit} onInput={(e) => setCustomUnit(Math.max(1, Number(e.currentTarget.value) || 1))} />
          </label>
          <label class="field">
            <span>Luck swing (±%)</span>
            <input id="luck" type="number" min={0} max={25} value={luck} onInput={(e) => setLuck(Math.max(0, Math.min(25, Number(e.currentTarget.value) || 0)))} />
          </label>
        </div>
        <div class="toggles">
          <label class="toggle"><input type="checkbox" checked={archers} onChange={(e) => setArchers(e.currentTarget.checked)} /> Archers &amp; mounted archers</label>
          <label class="toggle"><input type="checkbox" checked={paladin} onChange={(e) => setPaladin(e.currentTarget.checked)} /> Paladin &amp; legendary items</label>
          <label class="toggle"><input type="checkbox" checked={morale} onChange={(e) => setMorale(e.currentTarget.checked)} /> Morale (big players hit small ones softer)</label>
        </div>
      </details>

      <div class="row gap end">
        {onCancel && <Btn variant="ghost" onClick={onCancel}>Back</Btn>}
        <button type="submit" class="btn btn-primary btn-lg">Found the village</button>
      </div>
    </form>
  );
}

function ImportSave({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (t: string) => {
    setBusy(true);
    setErr(null);
    try {
      const id = await importSave(t);
      onDone(id);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <div class="import">
      <h2>Import a save</h2>
      <p class="muted">Choose a save file you exported earlier, or paste its contents below.</p>
      <input
        id="import-file"
        type="file"
        accept=".json,.hearthwar,application/json,text/plain"
        onChange={async (e) => {
          const f = (e.currentTarget as HTMLInputElement).files?.[0];
          if (f) void run(await f.text());
        }}
      />
      <textarea id="import-text" rows={5} value={text} placeholder="…or paste the save here" onInput={(e) => setText(e.currentTarget.value)} />
      {err && <p class="form-error">{err}</p>}
      <div class="row gap end">
        <Btn variant="ghost" onClick={onCancel}>Back</Btn>
        <Btn disabled={busy || !text.trim()} onClick={() => run(text)}>Import</Btn>
      </div>
    </div>
  );
}
