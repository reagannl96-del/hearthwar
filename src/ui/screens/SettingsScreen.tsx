import { useState } from 'preact/hooks';
import { resetNavOrder } from '../navOrder';
import { SPEED_PRESETS } from '../../engine/world';
import { Btn, Modal, Section } from '../components/common';
import { fmtDur } from '../format';
import { host, paused, prefs, restartRealm, sceneQuality, setPaused, setPrefs, setWarp, leaveRealm, toast, view, warp, usePane } from '../store';
import { BANNER_WALL, FlagBadge } from './BannerScreen';

const QUALITY_NOTE = {
  auto: 'Picked for this device. Change it if the village feels slow or looks rough.',
  low: 'Low: no shadows or night glow, a lower resolution, fewer villagers and about 30 frames a second. Easiest on older phones and laptops.',
  medium: 'Medium: softer shadows, a slightly lower resolution and fewer villagers. A good middle ground for most phones.',
  high: 'High: full resolution, soft shadows and the full night glow. For desktops and recent phones.',
} as const;

export function SettingsScreen() {
  const h = host.value!;
  const pane = usePane();
  const pv = view.value!;
  const p = prefs.value;
  const [copied, setCopied] = useState(false);
  const [speed, setSpeed] = useState(pv.config.speed);
  const [unitSpeed, setUnitSpeed] = useState(pv.config.unitSpeed);
  const [offline, setOffline] = useState(h.offline);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const exportSave = async () => {
    const text = h.exportSave();
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${pv.worldName.replace(/[^\w-]+/g, '_')}.hearthwar.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch { /* downloads may be blocked */ }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch { /* clipboard may be blocked */ }
  };

  return (
    <div class="stack">
      <div class="page-head"><h1>Settings</h1></div>
      <div class="grid-2">
        <Section title="Your banner">
          <div class="banner-mini">
            <FlagBadge flag={pv.me.flag} w={66} h={44} title="Your banner" />
            <p class="muted small grow">Flown at the gate of every village whose wall reaches level {BANNER_WALL}, for every visitor to see.</p>
          </div>
          <div class="row gap wrap">
            <Btn onClick={() => pane.go({ name: 'banner' })}>{pv.me.flag ? 'Change your banner' : 'Design your banner'}</Btn>
          </div>
        </Section>
        {!h.multiplayer && (
        <Section title="Time">
          <p class="muted">This is your realm, so you control its clock. Pausing stops everything, rival rulers included.</p>
          <div class="row gap wrap">
            <Btn variant={paused.value ? 'primary' : 'ghost'} onClick={() => setPaused(!paused.value)}>{paused.value ? 'Resume' : 'Pause'}</Btn>
            {[1, 2, 4].map((n) => (
              <Btn variant={warp.value === n ? 'primary' : 'ghost'} onClick={() => setWarp(n)}>{n}× time</Btn>
            ))}
          </div>
          <div class="row gap wrap">
            <Btn variant="ghost" onClick={() => { const ms = h.skipToNext(); toast(`Skipped ahead ${fmtDur(ms)}.`); }}>Skip to the next event</Btn>
            <Btn variant="ghost" onClick={() => { h.skip(10 * 60_000); toast('Ten minutes pass…'); }}>Skip 10 minutes</Btn>
          </div>
          <label class="toggle">
            <input type="checkbox" checked={offline} onChange={(e) => { const on = e.currentTarget.checked; setOffline(on); h.offline = on; void h.save(); }} />
            Keep the world running while the game is closed
          </label>
          <p class="muted small">When off, the realm freezes when you leave and resumes exactly where you stopped.</p>
        </Section>
        )}
        {!h.multiplayer && (
        <Section title="World speed">
          <p class="muted">Change the pace mid-game. New constructions and marches use the new speed.</p>
          <div class="row gap wrap">
            {Object.values(SPEED_PRESETS).map((s) => (
              <Btn small variant={speed === s.speed && unitSpeed === s.unitSpeed ? 'primary' : 'ghost'} onClick={() => { setSpeed(s.speed); setUnitSpeed(s.unitSpeed); }}>{s.label}</Btn>
            ))}
          </div>
          <div class="row gap wrap">
            <label class="field"><span>Economy</span><input id="set-speed" type="number" min={1} max={2000} value={speed} onInput={(e) => setSpeed(Math.max(1, Number(e.currentTarget.value) || 1))} /></label>
            <label class="field"><span>Marching</span><input id="set-unit" type="number" min={1} max={2000} value={unitSpeed} onInput={(e) => setUnitSpeed(Math.max(1, Number(e.currentTarget.value) || 1))} /></label>
          </div>
          <Btn disabled={speed === pv.config.speed && unitSpeed === pv.config.unitSpeed} onClick={() => { h.setSpeed(speed, unitSpeed); toast('World speed changed.', 'good'); }}>Apply</Btn>
        </Section>
        )}
        <Section title="Graphics quality">
          <p class="muted small">If the village runs slowly or your device gets warm, turn this down. Lower settings draw fewer pixels, drop shadows and the night glow, and show fewer villagers.</p>
          <div class="row gap wrap quality-pick" role="radiogroup" aria-label="Graphics quality">
            {(['auto', 'low', 'medium', 'high'] as const).map((q) => (
              <Btn small variant={p.quality === q ? 'primary' : 'ghost'} onClick={() => setPrefs({ quality: q })} aria-pressed={p.quality === q}>
                {q === 'auto' ? `Auto (${sceneQuality({ ...p, quality: 'auto' })})` : q[0].toUpperCase() + q.slice(1)}
              </Btn>
            ))}
          </div>
          <p class="muted small">{QUALITY_NOTE[p.quality]}</p>
        </Section>
        <Section title="Tabs">
          <p class="muted small">Drag the tabs along the top into whatever order you like. The order is kept in this browser.</p>
          <Btn small variant="ghost" onClick={() => { resetNavOrder(); toast('The tabs are back in their usual order.', 'good'); }}>Reset tab order</Btn>
        </Section>
        <Section title="Sound & alerts">
          <label class="toggle"><input type="checkbox" checked={p.sound} onChange={(e) => setPrefs({ sound: e.currentTarget.checked })} /> Sound effects</label>
          <label class="toggle">
            <input
              type="checkbox"
              checked={p.notify}
              onChange={async (e) => {
                const on = e.currentTarget.checked;
                if (on && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                  try {
                    const r = await Notification.requestPermission();
                    if (r !== 'granted') { toast('Notifications were not allowed.', 'warn'); return; }
                  } catch { toast('Notifications are not available here.', 'warn'); return; }
                }
                setPrefs({ notify: on });
              }}
            />
            Desktop alerts for incoming attacks while the tab is in the background
          </label>
        </Section>
        <Section title="Saves">
          <p class="muted">{h.multiplayer ? 'The shared realm lives on the server and is saved every 30 seconds.' : 'Your realm saves itself every few seconds in this browser. Export a copy to move it to another browser or keep a backup.'}</p>
          <div class="row gap wrap">
            {!h.multiplayer && <Btn variant="ghost" onClick={() => { void h.save().then(() => toast('Saved.', 'good')); }}>Save now</Btn>}
            {!h.multiplayer && <Btn variant="ghost" onClick={exportSave}>Export save</Btn>}
          </div>
          {copied && <p class="small good-text">The save was also copied to your clipboard.</p>}
          <div class="row gap wrap">
            {confirmLeave ? (
              <>
                <span class="small">Return to the realm list?</span>
                <Btn small onClick={() => leaveRealm()}>Yes, leave</Btn>
                <Btn small variant="ghost" onClick={() => setConfirmLeave(false)}>Stay</Btn>
              </>
            ) : <Btn variant="quiet" onClick={() => setConfirmLeave(true)}>Switch realm…</Btn>}
          </div>
        </Section>
        <Section title="Start over">
          <p class="muted">Walk away from your realm and found a new village somewhere else on the map. Everything you leave behind becomes barbarian.</p>
          <div class="row gap wrap">
            <Btn variant="danger" onClick={() => setRestarting(true)}>Restart village…</Btn>
          </div>
        </Section>
        {(h as unknown as { admin?: boolean }).admin && <AdminReset />}
        <Section title="Keyboard">
          <dl class="facts">
            <dt><kbd>A</kbd> / <kbd>D</kbd></dt><dd>Previous / next village</dd>
            <dt><kbd>V</kbd></dt><dd>Village</dd>
            <dt><kbd>M</kbd></dt><dd>Map</dd>
            <dt><kbd>R</kbd></dt><dd>Reports</dd>
            <dt><kbd>Q</kbd></dt><dd>Quests</dd>
            <dt><kbd>P</kbd></dt><dd>Pause / resume</dd>
          </dl>
        </Section>
        <Section title="This world">
          <dl class="facts">
            <dt>Economy speed</dt><dd class="num">{pv.config.speed}×</dd>
            <dt>Marching speed</dt><dd class="num">{pv.config.unitSpeed}×</dd>
            <dt>Map</dt><dd class="num">{pv.config.size}×{pv.config.size}</dd>
            <dt>Rival rulers</dt><dd>{pv.config.aiCount} · {pv.config.difficulty}</dd>
            <dt>Morale</dt><dd>{pv.config.morale ? 'on' : 'off'}</dd>
            <dt>Luck</dt><dd class="num">±{Math.round(pv.config.luck * 100)}%</dd>
          </dl>
        </Section>
      </div>
      {restarting && <RestartModal onClose={() => setRestarting(false)} />}
    </div>
  );
}

function RestartModal({ onClose }: { onClose: () => void }) {
  const pv = view.value!;
  const [name, setName] = useState('');
  const [typed, setTyped] = useState('');
  const troops = pv.villages.reduce((n, v) => n + Object.values(v.units).reduce((a, b) => a + (b ?? 0), 0), 0);
  const count = pv.villages.length;
  const ok = typed.trim().toLowerCase() === 'restart';
  return (
    <Modal title="Abandon your realm?" onClose={onClose}>
      <div class="stack restart-warn">
        <p class="bad-text"><strong>This cannot be undone.</strong></p>
        <ul>
          <li>{count === 1 ? <>Your village becomes a <strong>barbarian village</strong></> : <>Your {count} villages become <strong>barbarian villages</strong></>}, exactly as they stand: every building and the {troops.toLocaleString()} troops at home stay behind to defend them. Anyone (including you) can raid or conquer them.</li>
          <li>Armies on the march, troops supporting or scavenging elsewhere, merchants on the road, and anything in the build or recruit queues are lost.</li>
          <li>Your points, crowns, quests and paladin reset. Your reports and notes are kept.</li>
          <li>You get a fresh village somewhere new on the map, with beginner protection.</li>
        </ul>
        <label class="field">
          <span>Name of your new village</span>
          <input type="text" maxLength={32} value={name} placeholder="New Hope" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        </label>
        <label class="field">
          <span>Type <strong>restart</strong> to confirm</span>
          <input type="text" value={typed} autoComplete="off" onInput={(e) => setTyped((e.target as HTMLInputElement).value)} />
        </label>
        <div class="row gap wrap">
          <Btn variant="danger" disabled={!ok} onClick={() => { if (restartRealm(name.trim() || 'New Hope')) onClose(); }}>Abandon and start over</Btn>
          <Btn variant="ghost" onClick={onClose}>Keep my realm</Btn>
        </div>
      </div>
    </Modal>
  );
}

/** Only for the realm's admin: wipe the whole realm and open a fresh one (typed confirmation). */
function AdminReset() {
  const h = host.value! as unknown as { admin?: boolean; adminReset?: (confirm: string) => void; world: { name: string } };
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const name = h.world.name;
  return (
    <Section title="Admin: restart the realm" class="admin-danger">
      <p class="muted">Only you can see this. It wipes <b>{name}</b> completely, for everyone: every ruler, village, tribe, report and the round history. A brand-new realm opens and everyone founds a new village.</p>
      {!open ? (
        <Btn variant="danger" onClick={() => setOpen(true)}>Restart the realm…</Btn>
      ) : (
        <div class="stack-sm">
          <label class="field">
            <span>Type the realm's name to confirm: <b>{name}</b></span>
            <input value={typed} onInput={(e) => setTyped(e.currentTarget.value)} placeholder={name} />
          </label>
          <div class="row gap">
            <Btn variant="danger" disabled={typed !== name} onClick={() => { h.adminReset?.(typed); toast('Restarting the realm…', 'warn'); setOpen(false); setTyped(''); }}>Wipe it and start fresh</Btn>
            <Btn variant="quiet" onClick={() => { setOpen(false); setTyped(''); }}>Cancel</Btn>
          </div>
        </div>
      )}
    </Section>
  );
}
