// Browser-side sign-in. Production uses Supabase with Google. For local testing,
// VITE_DEV_LOGIN=yes pairs with a server started with DEV_NO_AUTH=yes.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const GAME_SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL as string | undefined;
export const devLogin = import.meta.env.VITE_DEV_LOGIN === 'yes' && !url;

export const onlineEnabled = !!GAME_SERVER_URL && (!!(url && anon) || devLogin);

export interface SessionLite {
  access_token: string;
  name: string;
}

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!url || !anon || !GAME_SERVER_URL) return null;
  // PKCE: Google sends back a one-time code (useless without this browser's secret), never the tokens themselves
  client ??= createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  return client;
}

const AUTH_PARAMS = ['access_token', 'refresh_token', 'provider_token', 'provider_refresh_token', 'expires_at', 'expires_in', 'token_type', 'code', 'sb', 'error', 'error_code', 'error_description', 'type'];
const hasAuthParams = () => /(?:^|[#?&])(access_token|refresh_token|provider_token|code|error_description)=/.test(window.location.hash + window.location.search);

/**
 * Once sign-in has read what it needs from the address, take it out again: a copied
 * link (to a report, say) must never carry anyone's login with it.
 */
function scrubAuthFromUrl(): void {
  if (!hasAuthParams()) return;
  const clean = (raw: string) => {
    const q = new URLSearchParams(raw);
    for (const k of AUTH_PARAMS) q.delete(k);
    return q.toString();
  };
  const search = clean(window.location.search.slice(1));
  const hash = clean(window.location.hash.slice(1));
  try {
    history.replaceState(history.state, '', window.location.pathname + (search ? `?${search}` : '') + (hash ? `#${hash}` : ''));
  } catch { /* history unavailable */ }
}

/** On load: if we've just come back from signing in, finish it and clean the address. */
export async function finishSignInFromUrl(): Promise<void> {
  if (!hasAuthParams()) return;
  const sb = supabase();
  if (sb) await sb.auth.getSession().catch(() => null);
  scrubAuthFromUrl();
}

const DEV_KEY = 'hw-dev-user';

export async function currentSession(): Promise<SessionLite | null> {
  if (devLogin) {
    const n = localStorage.getItem(DEV_KEY);
    return n ? { access_token: `dev:${n}`, name: n } : null;
  }
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  scrubAuthFromUrl();
  const s = data.session;
  if (!s) return null;
  const meta = s.user.user_metadata as Record<string, string | undefined>;
  return { access_token: s.access_token, name: meta.full_name || meta.name || s.user.email || 'you' };
}

export function onSessionChange(fn: () => void): () => void {
  const sub = supabase()?.auth.onAuthStateChange(() => { scrubAuthFromUrl(); fn(); });
  return () => sub?.data.subscription.unsubscribe();
}

export async function signInWithGoogle(devName?: string): Promise<void> {
  if (devLogin) {
    localStorage.setItem(DEV_KEY, devName || `Tester${Math.floor(Math.random() * 900 + 100)}`);
    return;
  }
  const sb = supabase();
  if (!sb) return;
  await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
}

export async function signOut(): Promise<void> {
  if (devLogin) {
    localStorage.removeItem(DEV_KEY);
    return;
  }
  await supabase()?.auth.signOut();
}
