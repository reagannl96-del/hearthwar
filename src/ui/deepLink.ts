// Shareable links to tribe forum threads: https://site/#t/<thread> or
// #t/<thread>/<post>. The hash is read once, remembered for this tab (so it
// survives signing in and picking the realm) and taken out of the address bar;
// the thread opens as soon as a realm is loaded. Only the viewer's own tribe
// forum is ever looked in: anyone else gets a polite "not for you".

import { parseThreadHash } from './bbcode/parse';
import { host, toast, type Pane } from './store';

const KEY = 'hw-open-thread';

export interface ThreadRef { thread: number; post?: number }

/** where a link waits when this tab cannot store it */
let pending: ThreadRef | null = null;

/** The link to share for a thread, or a post in it. */
export function threadLink(thread: number, post?: number): string {
  const base = typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname;
  return `${base}#t/${thread}${post ? `/${post}` : ''}`;
}

/**
 * If the address holds a thread link, remember it and clear it from the address
 * bar (keeping history.state). Anything else in the hash, such as sign-in
 * parameters, is left alone. True if there was one.
 */
export function captureThreadLink(): boolean {
  if (typeof window === 'undefined') return false;
  const ref = parseThreadHash(window.location.hash);
  if (!ref) return false;
  try { sessionStorage.setItem(KEY, JSON.stringify(ref)); } catch { /* storage unavailable: open it now if we can */ pending = ref; }
  try {
    history.replaceState(history.state, '', window.location.pathname + window.location.search);
  } catch { /* history unavailable */ }
  return true;
}

/** The thread link waiting to be opened, if any (taken: it opens once). */
export function takeThreadLink(): ThreadRef | null {
  let ref = pending;
  pending = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as ThreadRef;
      if (Number.isSafeInteger(v?.thread)) ref = { thread: v.thread, ...(Number.isSafeInteger(v.post) ? { post: v.post } : {}) };
    }
  } catch { /* ignore */ }
  return ref;
}

/** Open a thread in the given pane, if it is in the viewer's own tribe forum. */
export function openThreadLink(ref: ThreadRef, pane: Pane): boolean {
  const tribe = host.value?.tribeHome().tribe;
  const th = tribe?.forum.find((x) => x.id === ref.thread);
  if (!th) {
    toast('That forum thread belongs to a tribe you\'re not in, or it has been deleted.', 'warn');
    return false;
  }
  const post = ref.post && th.posts.some((p) => p.id === ref.post) ? ref.post : undefined;
  if (ref.post && !post) toast('That post has been deleted; here is the thread it was in.', 'info');
  pane.go({ name: 'tribe', tab: 'forum', thread: th.id, ...(post ? { post } : {}) });
  return true;
}
