import { useState } from 'preact/hooks';
import { Btn } from '../components/common';
import { host, leaveRealm, view, vid } from '../store';

export function GameOver() {
  const [name, setName] = useState('New Hope');
  const v = view.value!;
  return (
    <div class="modal-backdrop">
      <div class="modal gameover" role="alertdialog" aria-modal="true">
        <h2>Your last village has fallen</h2>
        <p>
          The banners of {v.me.name} no longer fly over the realm. You finished with <b class="num">{v.me.stats.conquered}</b> conquests
          and plundered <b class="num">{v.me.stats.loot.toLocaleString()}</b> resources.
        </p>
        <p>You can rise again from a new village on the frontier, with beginner protection, or leave this realm.</p>
        <label class="field">
          <span>Name of your new village</span>
          <input id="respawn-name" value={name} maxLength={32} onInput={(e) => setName(e.currentTarget.value)} />
        </label>
        <div class="row gap end">
          <Btn variant="ghost" onClick={() => leaveRealm()}>Leave realm</Btn>
          <Btn
            onClick={() => {
              if (host.value?.respawn(name.trim() || 'New Hope')) {
                const nv = host.value.view();
                vid.value = nv.villages[0]?.id ?? 0;
              }
            }}
          >
            Rise again
          </Btn>
        </div>
      </div>
    </div>
  );
}
