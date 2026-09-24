import { useEffect, useState } from 'preact/hooks';
import { navOrder, saveNavOrder } from './navOrder';
import { Icon } from './art/icons';
import { Clock, unitName } from './components/common';
import { coords, continent, fmt, fmtDur } from './format';
import { BuildingScreen } from './screens/BuildingScreen';
import { MapScreen } from './screens/MapScreen';
import { NewsScreen } from './screens/NewsScreen';
import { TribeScreen } from './screens/TribeScreen';
import { OverviewsScreen } from './screens/OverviewsScreen';
import { QuestsScreen } from './screens/QuestsScreen';
import { RankingScreen } from './screens/RankingScreen';
import { RealmScreen } from './screens/RealmScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TitleScreen } from './screens/TitleScreen';
import { VillageScreen } from './screens/VillageScreen';
import { GameOver } from './screens/GameOver';
import {
  PaneCtx, applyTheme, dismissToast, host, liveRes, now, online, paused, resumeSucceeded, setPaused, setSplit, setWarp, sidePane, split, swapPanes, toasts, view, warp,
  type Route, usePane,
} from './store';

export function App() {
  const pane = usePane();
  useEffect(() => {
    applyTheme();
  }, []);
  if (!host.value || !view.value) return <TitleScreen />;
  // every village lost: only the end screen (the header and pages need a village)
  if (view.value.villages.length === 0 || !pane.village.value) return <div class="shell"><GameOver /></div>;
  return <Game />;
}

function Game() {
  const pane = usePane();
  const v = view.value!;
  // the realm opened and drew: a refresh may bring the player straight back to it
  useEffect(() => { resumeSucceeded(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const list = view.value?.villages ?? [];
      const idx = list.findIndex((x) => x.id === pane.vid.value);
      switch (e.key.toLowerCase()) {
        case 'a': if (list.length > 1) pane.vid.value = list[(idx - 1 + list.length) % list.length].id; break;
        case 'd': if (list.length > 1) pane.vid.value = list[(idx + 1) % list.length].id; break;
        case 'v': pane.go({ name: 'village' }); break;
        case 'm': pane.go({ name: 'map' }); break;
        case 'r': pane.go({ name: 'reports' }); break;
        case 'q': pane.go({ name: 'quests' }); break;
        case 'p': if (!host.value?.multiplayer) setPaused(!paused.value); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const r = pane.route.value;
  const wide = useMedia('(min-width: 1100px)');
  const two = split.value && wide;
  return (
    <div class={`shell ${two ? 'is-split' : ''}`}>
      <Header />
      <Nav />
      {v.roundOver && r.name !== 'realm' && (
        <div class="banner banner-round">
          <Icon name="star" size={16} /> This round is over and the realm is frozen. <button type="button" class="link" onClick={() => pane.go({ name: 'realm' })}>See the final standings</button>
        </div>
      )}
      {v.me.protectedUntil > now.value && (
        <div class="banner banner-protect">
          <Icon name="shield" size={16} /> Beginner protection: nobody can attack you for another <b class="num">{fmtDur((v.me.protectedUntil - now.value) / warp.value)}</b>. Attacking another player ends it early.
        </div>
      )}
      {v.incoming.some((c) => c.kind === 'attack') && <IncomingBanner />}
      {two ? (
        <div class="split">
          <main class="main pane-main" id="main"><PaneView /></main>
          <PaneCtx.Provider value={sidePane}>
            <section class="main pane-side" aria-label="Second view">
              <SideBar />
              <PaneView />
            </section>
          </PaneCtx.Provider>
        </div>
      ) : (
        <main class="main" id="main"><PaneView /></main>
      )}
      <Toasts />
      {v.me.eliminated && <GameOver />}
    </div>
  );
}

/** The screen a pane is showing. */
function PaneView() {
  const r = usePane().route.value;
  return (
    <>
      {r.name === 'village' && <VillageScreen />}
      {r.name === 'building' && <BuildingScreen id={r.id} tab={r.tab} />}
      {r.name === 'map' && <MapScreen focus={r.focus} />}
      {r.name === 'reports' && <ReportsScreen id={r.id} />}
      {r.name === 'ranking' && <RankingScreen player={r.player} />}
      {r.name === 'quests' && <QuestsScreen />}
      {r.name === 'overviews' && <OverviewsScreen />}
      {r.name === 'settings' && <SettingsScreen />}
      {r.name === 'news' && <NewsScreen />}
      {r.name === 'realm' && <RealmScreen />}
      {r.name === 'tribe' && <TribeScreen id={r.id} tab={r.tab} />}
    </>
  );
}

const SIDE_SCREENS: { label: string; r: Route }[] = [
  { label: 'Village', r: { name: 'village' } },
  { label: 'Map', r: { name: 'map' } },
  { label: 'Rally point', r: { name: 'building', id: 'rally' } },
  { label: 'Reports', r: { name: 'reports' } },
  { label: 'Quests', r: { name: 'quests' } },
  { label: 'Overview', r: { name: 'overviews' } },
  { label: 'Tribe', r: { name: 'tribe' } },
  { label: 'Rankings', r: { name: 'ranking' } },
  { label: 'Realm', r: { name: 'realm' } },
  { label: 'Chronicle', r: { name: 'news' } },
];

/** The second pane's own bar: what it shows, which village, swap sides, close. */
function SideBar() {
  const pane = sidePane;
  const v = view.value!;
  const r = pane.route.value;
  const cur = pane.village.value!;
  const key = (x: Route) => (x.name === 'building' ? (x.id === 'rally' ? 'rally' : 'building') : x.name);
  const k = key(r);
  return (
    <div class="pane-bar">
      <select id="side-screen" aria-label="What this side shows" value={k} onChange={(e) => { const s2 = SIDE_SCREENS.find((x) => key(x.r) === (e.currentTarget as HTMLSelectElement).value); if (s2) pane.go(s2.r); }}>
        {SIDE_SCREENS.map((x) => <option value={key(x.r)}>{x.label}</option>)}
        {k === 'building' && <option value="building">Building</option>}
      </select>
      {v.villages.length > 1 && (
        <select id="side-village" aria-label="Which village this side shows" value={cur.id} onChange={(e) => (pane.vid.value = Number((e.currentTarget as HTMLSelectElement).value))}>
          {v.villages.map((x) => <option value={x.id}>{x.name} ({coords(x.x, x.y)})</option>)}
        </select>
      )}
      <span class="grow" />
      <button type="button" class="icon-btn" onClick={swapPanes} title="Swap the two sides" aria-label="Swap the two sides">⇄</button>
      <button type="button" class="icon-btn" onClick={() => setSplit(false)} title="Close split screen" aria-label="Close split screen">✕</button>
    </div>
  );
}

function IncomingBanner() {
  const pane = usePane();
  const v = view.value!;
  const attacks = v.incoming.filter((c) => c.kind === 'attack');
  const next = attacks[0];
  return (
    <button type="button" class="banner banner-attack" onClick={() => pane.go({ name: 'building', id: 'rally', tab: 'commands' })}>
      <Icon name="attack" size={16} />
      <span>
        <b>{attacks.length}</b> incoming {attacks.length === 1 ? 'attack' : 'attacks'} · next hits <b>{next.toName}</b> in{' '}
        <b class="num">{fmtDur((next.arrive - now.value) / warp.value)}</b>
        {next.detected && <> · lookouts spot <b>{unitName(next.detected, true, next.theme)}</b></>}
      </span>
    </button>
  );
}

function Header() {
  const pane = usePane();
  const v = view.value!;
  const cur = pane.village.value!;
  const list = v.villages;
  const idx = list.findIndex((x) => x.id === cur.id);
  const res = liveRes(cur);
  const step = (d: number) => (pane.vid.value = list[(idx + d + list.length) % list.length].id);
  return (
    <header class="topbar">
      <button type="button" class="brand" onClick={() => pane.go({ name: 'village' })} title="Back to your village">
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
            <select id="village-select" value={cur.id} onChange={(e) => (pane.vid.value = Number((e.currentTarget as HTMLSelectElement).value))} aria-label="Switch village">
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
  const pane = usePane();
  const v = view.value!;
  const r = pane.route.value;
  const claimable = v.quests.filter((q) => q.done).length;
  const items: { r: Route; icon: string; label: string; badge?: number; key: string; glow?: boolean }[] = [
    { r: { name: 'village' }, icon: 'village', label: 'Village', key: 'village' },
    { r: { name: 'map' }, icon: 'map', label: 'Map', key: 'map' },
    { r: { name: 'building', id: 'rally' }, icon: 'flag', label: 'Rally point', key: 'rally', badge: v.incoming.filter((c) => c.kind === 'attack').length },
    { r: { name: 'reports' }, icon: 'report', label: 'Reports', key: 'reports', badge: v.unreadReports },
    { r: { name: 'quests' }, icon: 'quest', label: 'Quests', key: 'quests', badge: claimable },
    { r: { name: 'overviews' }, icon: 'overview', label: 'Overview', key: 'overviews' },
    { r: { name: 'tribe' }, icon: 'tribe', label: 'Tribe', key: 'tribe', badge: v.tribeInvites + (v.tribeApplications ?? 0) || undefined, glow: v.forumUnread.length > 0 },
    { r: { name: 'ranking' }, icon: 'rank', label: 'Rankings', key: 'ranking' },
    { r: { name: 'realm' }, icon: 'star', label: 'Realm', key: 'realm' },
    { r: { name: 'news' }, icon: 'news', label: 'Chronicle', key: 'news' },
    { r: { name: 'settings' }, icon: 'settings', label: 'Settings', key: 'settings' },
  ];
  const activeKey = r.name === 'building' && r.id === 'rally' ? 'rally' : r.name === 'building' ? 'village' : r.name;
  // the tabs can be dragged into whatever order the player likes; the order is kept in this browser
  const [order, setOrder] = useState<string[]>(navOrder);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const rank = (k: string) => { const i = order.indexOf(k); return i < 0 ? 100 + items.findIndex((x) => x.key === k) : i; };
  const sorted = [...items].sort((a, b) => rank(a.key) - rank(b.key));
  const drop = (target: string) => {
    if (!dragging || dragging === target) return;
    const all = sorted.map((x) => x.key);
    const rightward = all.indexOf(dragging) < all.indexOf(target);
    const keys = all.filter((k) => k !== dragging);
    keys.splice(keys.indexOf(target) + (rightward ? 1 : 0), 0, dragging);
    setOrder(keys);
    saveNavOrder(keys);
  };
  useEffect(() => {
    const reset = () => setOrder([]);
    window.addEventListener('hw-nav-reset', reset);
    return () => window.removeEventListener('hw-nav-reset', reset);
  }, []);
  // phones: the first few tabs sit in the bar, the rest wait behind "More"
  const narrow = useNarrow();
  const [more, setMore] = useState(false);
  const shown = narrow ? sorted.slice(0, 4) : sorted;
  const tucked = narrow ? sorted.slice(4) : [];
  const tuckedActive = tucked.some((x) => x.key === activeKey);
  const tuckedGlow = tucked.some((x) => x.glow);
  const tuckedBadge = tucked.reduce((n, x) => n + (x.badge ?? 0), 0);
  return (
    <nav class={`nav ${dragging ? 'is-sorting' : ''}`} aria-label="Main">
      {narrow && more && (
        <div class="nav-more-sheet" role="menu" onClick={() => setMore(false)}>
          <div class="nav-more-panel" onClick={(e) => e.stopPropagation()}>
            {tucked.map((it) => (
              <button type="button" role="menuitem" class={`nav-more-item ${activeKey === it.key ? 'is-active' : ''} ${it.glow ? 'is-unread' : ''}`} onClick={() => { setMore(false); pane.go(it.r); }}>
                <Icon name={it.icon} size={20} />
                <span>{it.label}</span>
                {it.badge ? <span class="badge">{it.badge}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}
      {shown.map((it) => (
        <button
          key={it.key}
          type="button"
          draggable
          onDragStart={(e) => { setDragging(it.key); e.dataTransfer?.setData('text/plain', it.key); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={(e) => { if (dragging) { e.preventDefault(); if (over !== it.key) setOver(it.key); } }}
          onDragLeave={() => { if (over === it.key) setOver(null); }}
          onDrop={(e) => { e.preventDefault(); drop(it.key); setOver(null); setDragging(null); }}
          onDragEnd={() => { setDragging(null); setOver(null); }}
          class={`nav-item ${activeKey === it.key ? 'is-active' : ''} ${it.key === 'rally' && it.badge ? 'is-alert' : ''} ${it.glow ? 'is-unread' : ''} ${dragging === it.key ? 'is-dragging' : ''} ${over === it.key && dragging !== it.key ? 'is-drop' : ''}`}
          title={it.glow ? 'Unread posts in your tribe forum' : 'Drag to reorder the tabs'}
          onClick={() => pane.go(it.r)}
        >
          <Icon name={it.icon} size={18} />
          <span class="nav-label">{it.label}</span>
          {it.badge ? <span class="badge">{it.badge}</span> : null}
        </button>
      ))}
      {!narrow && (
        <button type="button" class={`nav-item nav-split ${split.value ? 'is-active' : ''}`} onClick={() => setSplit(!split.value)} title={split.value ? 'Back to one screen' : 'Split screen: a second view beside this one (Quests, the map, another village...)'}>
          <span aria-hidden="true" class="split-glyph">◫</span>
          <span class="nav-label">{split.value ? 'Unsplit' : 'Split'}</span>
        </button>
      )}
      {narrow && (
        <button type="button" class={`nav-item ${tuckedActive || more ? 'is-active' : ''} ${tuckedGlow ? 'is-unread' : ''}`} aria-haspopup="menu" aria-expanded={more} onClick={() => setMore(!more)}>
          <Icon name="overview" size={18} />
          <span class="nav-label">More</span>
          {tuckedBadge > 0 && <span class="badge">{tuckedBadge}</span>}
        </button>
      )}
    </nav>
  );
}

function useMedia(q: string): boolean {
  const [on, setOn] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const f2 = () => setOn(m.matches);
    m.addEventListener('change', f2);
    return () => m.removeEventListener('change', f2);
  }, [q]);
  return on;
}

/** Whether the screen is phone-narrow (the tab bar sits at the bottom there). */
function useNarrow(): boolean {
  const q = '(max-width: 760px)';
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setNarrow(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return narrow;
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
