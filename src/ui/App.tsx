import { useEffect } from 'preact/hooks';
import { Icon } from './art/icons';
import { Clock } from './components/common';
import { coords, continent, fmt, fmtDur } from './format';
import { BuildingScreen } from './screens/BuildingScreen';
import { MapScreen } from './screens/MapScreen';
import { NewsScreen } from './screens/NewsScreen';
import { TribeScreen } from './screens/TribeScreen';
import { OverviewsScreen } from './screens/OverviewsScreen';
import { QuestsScreen } from './screens/QuestsScreen';
import { RankingScreen } from './screens/RankingScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TitleScreen } from './screens/TitleScreen';
import { VillageScreen } from './screens/VillageScreen';
import { GameOver } from './screens/GameOver';
import {
  applyTheme, dismissToast, go, host, liveRes, now, online, paused, route, setPaused, setWarp, toasts, view, vid, village, warp,
  type Route,
} from './store';

export function App() {
  useEffect(() => {
    applyTheme();
  }, []);
  if (!host.value || !view.value) return <TitleScreen />;
  return <Game />;
}

function Game() {
  const v = view.value!;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const list = view.value?.villages ?? [];
      const idx = list.findIndex((x) => x.id === vid.value);
      switch (e.key.toLowerCase()) {
        case 'a': if (list.length > 1) vid.value = list[(idx - 1 + list.length) % list.length].id; break;
        case 'd': if (list.length > 1) vid.value = list[(idx + 1) % list.length].id; break;
        case 'v': go({ name: 'village' }); break;
        case 'm': go({ name: 'map' }); break;
        case 'r': go({ name: 'reports' }); break;
        case 'q': go({ name: 'quests' }); break;
        case 'p': if (!host.value?.multiplayer) setPaused(!paused.value); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const r = route.value;
  return (
    <div class="shell">
      <Header />
      <Nav />
      {v.me.protectedUntil > now.value && (
        <div class="banner banner-protect">
          <Icon name="shield" size={16} /> Beginner protection: nobody can attack you for another <b class="num">{fmtDur((v.me.protectedUntil - now.value) / warp.value)}</b>. Attacking another player ends it early.
        </div>
      )}
      {v.incoming.some((c) => c.kind === 'attack') && <IncomingBanner />}
      <main class="main" id="main">
        {r.name === 'village' && <VillageScreen />}
        {r.name === 'building' && <BuildingScreen id={r.id} tab={r.tab} />}
        {r.name === 'map' && <MapScreen focus={r.focus} />}
        {r.name === 'reports' && <ReportsScreen id={r.id} />}
        {r.name === 'ranking' && <RankingScreen player={r.player} />}
        {r.name === 'quests' && <QuestsScreen />}
        {r.name === 'overviews' && <OverviewsScreen />}
        {r.name === 'settings' && <SettingsScreen />}
        {r.name === 'news' && <NewsScreen />}
        {r.name === 'tribe' && <TribeScreen id={r.id} tab={r.tab} />}
      </main>
      <Toasts />
      {v.me.eliminated && <GameOver />}
    </div>
  );
}

function IncomingBanner() {
  const v = view.value!;
  const attacks = v.incoming.filter((c) => c.kind === 'attack');
  const next = attacks[0];
  return (
    <button type="button" class="banner banner-attack" onClick={() => go({ name: 'building', id: 'rally', tab: 'commands' })}>
      <Icon name="attack" size={16} />
      <span>
        <b>{attacks.length}</b> incoming {attacks.length === 1 ? 'attack' : 'attacks'} · next hits <b>{next.toName}</b> in{' '}
        <b class="num">{fmtDur((next.arrive - now.value) / warp.value)}</b>
        {next.detected && <> · lookouts spot <b>{next.detected}</b></>}
      </span>
    </button>
  );
}

function Header() {
  const v = view.value!;
  const cur = village.value!;
  const list = v.villages;
  const idx = list.findIndex((x) => x.id === cur.id);
  const res = liveRes(cur);
  const step = (d: number) => (vid.value = list[(idx + d + list.length) % list.length].id);
  return (
    <header class="topbar">
      <button type="button" class="brand" onClick={() => go({ name: 'village' })} title="Back to your village">
        <span class="brand-mark">Hearthwar</span>
        <span class="brand-world">{v.worldName}</span>
      </button>
      <div class="village-switch">
        {list.length > 1 && (
          <button type="button" class="icon-btn" onClick={() => step(-1)} aria-label="Previous village (A)" title="Previous village (A)">
            <Icon name="prev" size={16} />
          </button>
        )}
        <div class="village-name">
          {list.length > 1 ? (
            <select id="village-select" value={cur.id} onChange={(e) => (vid.value = Number((e.currentTarget as HTMLSelectElement).value))} aria-label="Switch village">
              {list.map((x) => (
                <option value={x.id}>{x.name} ({coords(x.x, x.y)})</option>
              ))}
            </select>
          ) : (
            <span class="vname">{cur.name}</span>
          )}
          <span class="vcoords">
            {coords(cur.x, cur.y)} · {continent(cur.x, cur.y)} · <span class="num">{fmt(cur.points)}</span> pts
          </span>
        </div>
        {list.length > 1 && (
          <button type="button" class="icon-btn" onClick={() => step(1)} aria-label="Next village (D)" title="Next village (D)">
            <Icon name="next" size={16} />
          </button>
        )}
      </div>
      <div class="resbar">
        {(['wood', 'clay', 'iron'] as const).map((k) => {
          const full = res[k] >= cur.storage;
          const eta = full ? 0 : ((cur.storage - res[k]) / Math.max(1, cur.rates[k])) * 3600_000;
          return (
            <div class={`resbar-item ${full ? 'is-full' : res[k] > cur.storage * 0.9 ? 'is-near' : ''}`} title={`${k[0].toUpperCase() + k.slice(1)}: +${fmt(cur.rates[k])}/h${full ? ' — warehouse full!' : ` · full in ${fmtDur(eta / warp.value)}`}`}>
              <Icon name={k} size={18} />
              <span class="num">{fmt(res[k])}</span>
              <span class="rate num">+{fmt(cur.rates[k])}/h</span>
            </div>
          );
        })}
        <div class="resbar-item" title="Warehouse capacity">
          <Icon name="storage" size={18} />
          <span class="num">{fmt(cur.storage)}</span>
        </div>
        <div class={`resbar-item ${cur.popUsed >= cur.popMax ? 'is-full' : ''}`} title="Population used / farm capacity">
          <Icon name="pop" size={18} />
          <span class="num">
            {fmt(cur.popUsed)}/{fmt(cur.popMax)}
          </span>
        </div>
      </div>
      {host.value!.multiplayer ? <OnlineBadge /> : <TimeControl />}
    </header>
  );
}

function OnlineBadge() {
  return (
    <div class="timectl" title={online.value ? 'Connected to the shared realm' : 'The game server is down or restarting. Reconnecting automatically…'}>
      <Clock t={now.value} />
      <span class={`online-pill ${online.value ? '' : 'is-down'}`}>{online.value ? 'Online' : 'Offline'}</span>
    </div>
  );
}

function TimeControl() {
  const p = paused.value;
  const w = warp.value;
  return (
    <div class="timectl">
      <Clock t={now.value} />
      <div class="timectl-btns">
        <button type="button" class={`icon-btn ${p ? 'is-on' : ''}`} onClick={() => setPaused(!p)} aria-label={p ? 'Resume (P)' : 'Pause (P)'} title={p ? 'Resume (P)' : 'Pause (P)'}>
          <Icon name={p ? 'play' : 'pause'} size={14} />
        </button>
        <button
          type="button"
          class={`icon-btn warp ${w > 1 ? 'is-on' : ''}`}
          onClick={() => setWarp(w >= 4 ? 1 : w * 2)}
          title="Fast-forward the whole world (single-player only)"
          aria-label={`Time speed ${w}x`}
        >
          <Icon name="ff" size={14} />
          <span class="num">{w}×</span>
        </button>
      </div>
    </div>
  );
}

function Nav() {
  const v = view.value!;
  const r = route.value;
  const claimable = v.quests.filter((q) => q.done).length;
  const items: { r: Route; icon: string; label: string; badge?: number; key: string }[] = [
    { r: { name: 'village' }, icon: 'village', label: 'Village', key: 'village' },
    { r: { name: 'map' }, icon: 'map', label: 'Map', key: 'map' },
    { r: { name: 'building', id: 'rally' }, icon: 'flag', label: 'Rally point', key: 'rally', badge: v.incoming.filter((c) => c.kind === 'attack').length },
    { r: { name: 'reports' }, icon: 'report', label: 'Reports', key: 'reports', badge: v.unreadReports },
    { r: { name: 'quests' }, icon: 'quest', label: 'Quests', key: 'quests', badge: claimable },
    { r: { name: 'overviews' }, icon: 'overview', label: 'Overview', key: 'overviews' },
    { r: { name: 'tribe' }, icon: 'tribe', label: 'Tribe', key: 'tribe', badge: v.tribeInvites || undefined },
    { r: { name: 'ranking' }, icon: 'rank', label: 'Rankings', key: 'ranking' },
    { r: { name: 'news' }, icon: 'news', label: 'Chronicle', key: 'news' },
    { r: { name: 'settings' }, icon: 'settings', label: 'Settings', key: 'settings' },
  ];
  const activeKey = r.name === 'building' && r.id === 'rally' ? 'rally' : r.name === 'building' ? 'village' : r.name;
  return (
    <nav class="nav" aria-label="Main">
      {items.map((it) => (
        <button type="button" class={`nav-item ${activeKey === it.key ? 'is-active' : ''} ${it.key === 'rally' && it.badge ? 'is-alert' : ''}`} onClick={() => go(it.r)}>
          <Icon name={it.icon} size={18} />
          <span class="nav-label">{it.label}</span>
          {it.badge ? <span class="badge">{it.badge}</span> : null}
        </button>
      ))}
    </nav>
  );
}

function Toasts() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.value.map((t) => (
        <div class={`toast toast-${t.kind}`}>
          <span>{t.text}</span>
          {t.action && (
            <button type="button" class="link" onClick={() => { t.action!.run(); dismissToast(t.id); }}>
              {t.action.label}
            </button>
          )}
          <button type="button" class="icon-btn" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
