// Cloud saves for single player: a signed-in player's realms are kept in Supabase
// (gzipped, one row per realm), so a game started on one device carries on on another.
// Local saves (IndexedDB) stay the source of truth while playing; the cloud copy is
// pushed now and then and pulled on the title screen when it is newer.

import { supabase } from '../net/supabase';
import type { SaveBlob, SaveMeta } from './local';

const TABLE = 'solo_saves';

interface Row { id: string; meta: SaveMeta; saved_at: string }

async function userId(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Is there someone signed in whose realms can be kept in the cloud? */
export async function cloudReady(): Promise<boolean> {
  return (await userId()) !== null;
}

export async function gzip(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function gunzip(b64: string): Promise<string> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/** Upload one realm. Quietly does nothing when nobody is signed in; returns whether it was stored. */
export async function pushCloud(meta: SaveMeta, blob: SaveBlob): Promise<boolean> {
  const sb = supabase();
  const uid = await userId();
  if (!sb || !uid) return false;
  try {
    const data = await gzip(JSON.stringify(blob));
    const { error } = await sb.from(TABLE).upsert({ user_id: uid, id: meta.id, meta, data, saved_at: new Date(meta.savedAt).toISOString() });
    if (error) console.warn('Cloud save failed:', error.message);
    return !error;
  } catch (e) {
    console.warn('Cloud save failed:', (e as Error).message);
    return false;
  }
}

/** The realms this player keeps in the cloud (just their summaries). */
export async function listCloud(): Promise<SaveMeta[]> {
  const sb = supabase();
  const uid = await userId();
  if (!sb || !uid) return [];
  const { data, error } = await sb.from(TABLE).select('id, meta, saved_at').eq('user_id', uid);
  if (error) { console.warn('Could not list cloud saves:', error.message); return []; }
  return (data as Row[]).map((r) => ({ ...r.meta, id: r.id, savedAt: Date.parse(r.saved_at) || r.meta.savedAt }));
}

/** Download one realm. */
export async function pullCloud(id: string): Promise<SaveBlob | null> {
  const sb = supabase();
  const uid = await userId();
  if (!sb || !uid) return null;
  const { data, error } = await sb.from(TABLE).select('data').eq('user_id', uid).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return JSON.parse(await gunzip((data as { data: string }).data)) as SaveBlob;
}

export async function deleteCloud(id: string): Promise<void> {
  const sb = supabase();
  const uid = await userId();
  if (!sb || !uid) return;
  await sb.from(TABLE).delete().eq('user_id', uid).eq('id', id);
}
