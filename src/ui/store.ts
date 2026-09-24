// Client state: the current player view, routing, toasts and settings.

import { computed, signal } from '@preact/signals';
import type { Action } from '../engine/actions';
import { BUILDINGS } from '../engine/data/buildings';
import type { BuildingId, Res, Report } from '../engine/types';
import type { PlayerView, VillageView } from '../engine/view';
import type { HostBase } from '../host/base';
import { lsGet, lsSet } from '../host/storage';
import { interpRes } from './format';
import { setSoundEnabled, sfx } from './sound';

export type Route =
  | { name: 'village' }
  | { name: 'building'; id: BuildingId; tab?: string }
  | { name: 'map'; focus?: number }
  | { name: 'reports'; id?: number }
  | { name: 'ranking'; player?: number }
  | { name: 'quests' }
  | { name: 'overviews' }
  | { name: 'settings' }
  | { name: 'news' }
  | { name: 'realm' }
  | { name: 'tribe'; id?: number; tab?: string };

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'good' | 'bad' | 'warn';
  action?: { label: string; run: () => void };
}

export interface Prefs {
  sound: boolean;
  notify: boolean;
  theme: 'system' | 'light' | 'dark';
  confirmAttacks: boolean;
  /** village scene season: follow the village's place on the map, or force one */
  season: 'auto' | 'fall' | 'winter';
  /** village scene lighting: follow the real clock, or force one */
  sceneTime: 'auto' | 'day' | 'night';
}

export function isNightNow(p: Prefs): boolean {
  if (p.sceneTime !== 'auto') return p.sceneTime === 'night';
  const h = new Date().getHours();
  return h >= 19 || h < 6;
}

export const host = signal<HostBase | null>(null);
export const view = signal<PlayerView | null>(null);
export const now = signal(0);
export const vid = signal(0);
export const route = signal<Route>({ name: 'village' });
export const toasts = signal<Toast[]>([]);
export const paused = signal(false);
/** A battle report to play again in the village scene (set from a report, picked up by the village view). */
export const battleReplay = signal<{ report: Report; at: number } | null>(null);
export const warp = signal(1);
/** a rally-point prefill, e.g. when clicking "attack" on the map */
export const rallyTarget = signal<{ x: number; y: number; kind?: 'attack' | 'support'; units?: Record<string, number> } | null>(null);
export const marketTarget = signal<{ x: number; y: number } | null>(null);

const defaultPrefs: Prefs = { sound: true, notify: false, theme: 'system', confirmAttacks: false, season: 'auto', sceneTime: 'auto' };
function loadPrefs(): Prefs {
  try {
    return { ...defaultPrefs, ...JSON.parse(lsGet('hw-prefs') ?? '{}') };
  } catch {
    return defaultPrefs;
  }
}
export const prefs = signal<Prefs>(loadPrefs());
export function setPrefs(p: Partial<Prefs>) {
  prefs.value = { ...prefs.value, ...p };
  lsSet('hw-prefs', JSON.stringify(prefs.value));
  applyTheme();
  setSoundEnabled(prefs.value.sound);
}
export function applyTheme() {
  const t = prefs.value.theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
setSoundEnabled(prefs.value.sound);

export const village = computed<VillageView | undefined>(() => {
  const v = view.value;
  if (!v) return undefined;
  return v.villages.find((x) => x.id === vid.value) ?? v.villages[0];
});

/** Resources of a village interpolated to the current moment. */
export function liveRes(v: VillageView, t = now.value): Res {
  return interpRes(v.res, v.rates, v.storage, v.resAt, t);
}

let toastId = 1;
export function toast(text: string, kind: Toast['kind'] = 'info', action?: Toast['action']) {
  const t: Toast = { id: toastId++, text, kind, action };
  toasts.value = [...toasts.value.slice(-4), t];
  setTimeout(() => dismissToast(t.id), kind === 'bad' ? 9000 : 5000);
}
export function dismissToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

export function go(r: Route) {
  const same = JSON.stringify(route.value) === JSON.stringify(r);
  route.value = r;
  if (typeof window !== 'undefined') {
    // each screen is a step in the browser's history, so Back and Forward move around the game
    if (!same) try { history.pushState({ hw: r, world: host.value?.world.id }, ''); } catch { /* history unavailable */ }
    window.scrollTo({ top: 0 });
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (e) => {
    const st = e.state as { hw?: Route; world?: string } | null;
    // only steps taken in the realm that is open now
    if (host.value && st?.hw && st.world === host.value.world.id) route.value = st.hw;
  });
}

/**
 * Which realm to reopen when the page loads again: a refresh (or coming back to the
 * tab) drops the player straight back into the game instead of the title screen.
 * Cleared when they leave the realm on purpose.
 */
const RESUME_KEY = 'hw-resume';
export function resumeTarget(): { kind: 'online' } | { kind: 'local'; id: string } | null {
  const v = lsGet(RESUME_KEY);
  if (v === 'online') return { kind: 'online' };
  if (v?.startsWith('local:')) return { kind: 'local', id: v.slice(6) };
  return null;
}
export function forgetResume(): void {
  lsSet(RESUME_KEY, '');
}

/**
 * Guard against a resume that keeps failing (say the realm crashes as it opens):
 * each attempt is marked for this tab, and if the page comes back while the mark is
 * still there, the last attempt never made it, so the title screen is shown instead.
 */
const TRY_KEY = 'hw-resume-try';
let resumeTried = false;
export function beginResume(): boolean {
  if (resumeTried) return false;
  resumeTried = true;
  try {
    if (sessionStorage.getItem(TRY_KEY)) {
      sessionStorage.removeItem(TRY_KEY);
      forgetResume();
      return false;
    }
    sessionStorage.setItem(TRY_KEY, '1');
  } catch { /* storage unavailable: resume anyway */ }
  return true;
}
export function resumeSucceeded(): void {
  try { sessionStorage.removeItem(TRY_KEY); } catch { /* ignore */ }
}

export function act(a: Action, success?: string): boolean {
  const h = host.value;
  if (!h) return false;
  const r = h.act(a);
  if (!r.ok) {
    toast(r.error ?? 'That did not work.', 'bad');
    sfx.error();
    return false;
  }
  if (success) toast(success, 'good');
  sfx.click();
  return true;
}

/** Abandon every village to the barbarians and start again somewhere new. */
export function restartRealm(villageName: string): boolean {
  quietLossUntil = Date.now() + 20_000;
  if (!act({ type: 'restart', village: villageName })) {
    quietLossUntil = 0;
    return false;
  }
  toast('You set out to found a new village. Good luck, ruler.', 'good');
  go({ name: 'village' });
  return true;
}

// ---------- live updates & notifications ----------

let quietLossUntil = 0;

let timer: ReturnType<typeof setInterval> | null = null;
let unsub: (() => void) | null = null;
let lastReportId = 0;

function notifyBrowser(title: string, body: string) {
  if (!prefs.value.notify || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted' || !document.hidden) return;
  try {
    new Notification(title, { body });
  } catch {
    /* ignore */
  }
}

function diff(prev: PlayerView | null, next: PlayerView) {
  if (!prev) return;
  const h = host.value!;
  const oldIn = new Set(prev.incoming.map((c) => c.id));
  for (const c of next.incoming) {
    if (oldIn.has(c.id) || c.kind !== 'attack') continue;
    toast(`Incoming attack on ${c.toName} from ${c.ownerName}!`, 'bad', {
      label: 'Show', run: () => go({ name: 'building', id: 'rally', tab: 'commands' }),
    });
    sfx.horn();
    notifyBrowser('Incoming attack!', `${c.ownerName} is attacking ${c.toName}.`);
  }
  // finished buildings
  for (const v of prev.villages) {
    const nv = next.villages.find((x) => x.id === v.id);
    if (!nv) continue;
    for (const j of v.buildQueue) {
      if (nv.buildQueue.some((x) => x.id === j.id)) continue;
      if (nv.buildings[j.building] >= j.level && !j.demolish && j.end <= next.now) {
        toast(`${BUILDINGS[j.building].name} reached level ${j.level} in ${nv.name}.`, 'good');
        sfx.build();
      }
    }
  }
  // tribe invitations
  if (next.tribeInvites > prev.tribeInvites) {
    toast('A tribe has invited you to join.', 'info', { label: 'Show', run: () => go({ name: 'tribe' }) });
  }
  if ((next.tribeApplications ?? 0) > (prev.tribeApplications ?? 0)) {
    toast('A ruler has asked to join your tribe.', 'info', { label: 'Show', run: () => go({ name: 'tribe', tab: 'invites' }) });
  }
  // lost villages
  for (const v of prev.villages) {
    if (Date.now() < quietLossUntil) break;
    if (!next.villages.some((x) => x.id === v.id)) toast(`${v.name} has been conquered!`, 'bad');
  }
  if (!next.villages.some((x) => x.id === vid.value) && next.villages[0]) vid.value = next.villages[0].id;
  // new reports
  if (next.unreadReports > 0) {
    const reps = h.reports();
    const fresh = reps.filter((r) => r.id > lastReportId && !r.read);
    if (fresh.length && lastReportId > 0) {
      const r = fresh[0];
      const kind = r.color === 'red' ? 'bad' : r.color === 'yellow' ? 'warn' : r.color === 'green' ? 'good' : 'info';
      if (!(r.kind === 'attack' && r.color === 'green' && fresh.length > 1)) {
        toast(fresh.length > 1 ? `${r.title} (+${fresh.length - 1} more)` : r.title, kind, {
          label: 'Read', run: () => go({ name: 'reports', id: r.id }),
        });
      }
      sfx.report();
      if (r.kind === 'defense' || r.kind === 'conquest') notifyBrowser(r.title, 'Open Hearthwar to read the report.');
    }
    if (reps[0]) lastReportId = Math.max(lastReportId, reps[0].id);
  }
  // quests that just became claimable
  const doneBefore = new Set(prev.quests.filter((q) => q.done).map((q) => q.id));
  for (const q of next.quests) {
    if (q.done && !doneBefore.has(q.id) && prev.quests.some((p) => p.id === q.id)) {
      toast(`Quest complete: ${q.title}. Claim your reward!`, 'good', { label: 'Quests', run: () => go({ name: 'quests' }) });
      sfx.quest();
    }
  }
}

export function startHost(h: HostBase) {
  stopHost();
  host.value = h;
  lsSet(RESUME_KEY, h.multiplayer ? 'online' : `local:${h.world.id}`);
  try { history.replaceState({ hw: { name: 'village' }, world: h.world.id }, ''); } catch { /* history unavailable */ }
  if (import.meta.env.DEV) (window as unknown as { __hw: HostBase }).__hw = h;
  if (h.multiplayer) {
    const r = h as HostBase & { onServerError: ((m: string) => void) | null; onConnection: ((up: boolean) => void) | null };
    r.onServerError = (m) => toast(m, 'bad');
    r.onConnection = (up) => {
      const was = online.value;
      online.value = up;
      if (!up) toast('The realm is offline (the server may be restarting). Reconnecting automatically…', 'warn');
      else if (!was) toast('Back online.', 'good');
    };
  }
  paused.value = h.paused;
  warp.value = h.warp;
  const v = h.view();
  view.value = v;
  now.value = h.now;
  vid.value = v.villages[0]?.id ?? 0;
  lastReportId = h.reports()[0]?.id ?? 0;
  route.value = { name: 'village' };
  unsub = h.subscribe(() => {
    const nv = h.view();
    const prev = view.value;
    view.value = nv;
    diff(prev, nv);
  });
  timer = setInterval(() => {
    h.tick();
    now.value = h.now;
  }, 250);
}

/** The player chose to leave the realm: back to the title screen, and no auto-resume next time. */
export function leaveRealm() {
  forgetResume();
  stopHost();
}

export function stopHost() {
  if (timer) clearInterval(timer);
  timer = null;
  unsub?.();
  unsub = null;
  const h = host.value;
  if (h) void h.save();
  if (h && 'close' in h) (h as unknown as { close(): void }).close();
  host.value = null;
  view.value = null;
  battleReplay.value = null;
}

/** online only: is the connection to the game server up? */
export const online = signal(true);

export function setPaused(p: boolean) {
  const h = host.value;
  if (!h) return;
  h.paused = p;
  paused.value = p;
  void h.save();
}

export function setWarp(n: number) {
  const h = host.value;
  if (!h) return;
  h.warp = n;
  warp.value = n;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void host.value?.save();
  });
  window.addEventListener('pagehide', () => void host.value?.save());
}
