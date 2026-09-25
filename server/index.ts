import { createHash } from 'node:crypto';
// Hearthwar game server: runs the one shared world in memory, around the clock.
// Players sign in with Google through Supabase and talk to this server over a
// WebSocket. The world is saved to Supabase every 30 seconds.
//
// Environment:
//   PORT                        (Railway sets this)
//   SUPABASE_URL                your project URL
//   SUPABASE_SERVICE_ROLE_KEY   server-only secret key (never ship it to the browser)
//   ALLOWED_ORIGINS             comma-separated site origins, e.g. https://play.example.com
//   WORLD_NAME, WORLD_SPEED, WORLD_UNIT_SPEED, WORLD_SIZE, WORLD_AI, WORLD_DIFFICULTY  (only used for a new world)
//   RESET_WORLD=yes             start a brand new world on boot (the old one is overwritten)
//   DEV_NO_AUTH=yes             LOCAL TESTING ONLY: no Supabase; fake sign-in, world saved to ./world-dev.json

import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { WebSocketServer, type WebSocket } from 'ws';
import { applyAction } from '../src/engine/actions';
import { advance } from '../src/engine/game';
import { privatePacket, publicSnapshot } from '../src/engine/shadow';
import { invalidateSpatial } from '../src/engine/spatial';
import type { Difficulty, RoundResult, World } from '../src/engine/types';
import { recomputeCounters, recomputePlayerPoints } from '../src/engine/village';
import { finishRound, honourChampion } from '../src/engine/round';
import { SIZE_PRESETS, WORLD_VERSION, createWorld, defaultConfig, migrateWorld, reinforceRulers, respawnHuman, welcomeWave, spawnPlayer } from '../src/engine/world';
import type { ClientMsg, ServerMsg } from '../src/net/protocol';

const env = process.env;
const PORT = Number(env.PORT || 8787);
const SUPABASE_URL = env.SUPABASE_URL ?? '';
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ORIGINS = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const DEV = env.DEV_NO_AUTH === 'yes' || process.argv.includes('--dev');
if (!DEV && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}
if (DEV) console.warn('DEV_NO_AUTH is on: anyone can sign in as anyone. Never use this in production.');
const sb = DEV ? null : createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const DEV_FILE = 'world-dev.json';

async function readStored(): Promise<World | undefined> {
  if (!sb) return existsSync(DEV_FILE) ? (JSON.parse(readFileSync(DEV_FILE, 'utf8')) as World) : undefined;
  const { data, error } = await sb.from('world_state').select('data').eq('id', 1).maybeSingle();
  if (error) throw new Error(`Could not load the world: ${error.message}`);
  return data?.data as World | undefined;
}

async function writeStored(w: World): Promise<void> {
  if (!sb) return writeFileSync(DEV_FILE, JSON.stringify(w));
  const { error } = await sb.from('world_state').upsert({ id: 1, data: w, updated_at: new Date().toISOString() });
  if (error) console.error('Save failed:', error.message);
}

/**
 * The realm's admins, by a hash of their sign-in email (so no address sits in the code),
 * plus any listed in ADMIN_EMAILS. Admins may wipe the realm from Settings.
 */
const ADMIN_HASHES = new Set(['16414ce420be9ef65dd90745cfcc9cd97da5317d8fc518dfab6dba282ca04b88']);
const ADMIN_EMAILS = new Set((env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return ADMIN_EMAILS.has(e) || ADMIN_HASHES.has(createHash('sha256').update(e).digest('hex'));
}

async function verify(token: string): Promise<{ id: string; name: string; admin: boolean } | null> {
  if (!sb) return token.startsWith('dev:') ? { id: token, name: token.slice(4) || 'Tester', admin: env.DEV_ADMIN === 'yes' } : null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  const meta = data.user.user_metadata as Record<string, string | undefined>;
  return { id: data.user.id, name: meta.full_name || meta.name || data.user.email?.split('@')[0] || 'Wanderer', admin: isAdminEmail(data.user.email) };
}

// ---------- world ----------

let world: World;
/** AI rulers a new online realm opens with (a running realm is topped up to this on start). */
const AI_RULERS = Math.max(Number(env.WORLD_AI || 0), 70);
/** The realm's usual size: newcomers keep arriving (faster while it is well short) until about this many rulers live in it. */
const AI_TARGET = Math.max(Number(env.WORLD_AI_TARGET || 0), 150);
let clockBase = 0; // world.now = Date.now() - clockBase

async function loadWorld(): Promise<World> {
  if (env.RESET_WORLD !== 'yes') {
    const w = await readStored();
    if (w && w.version === WORLD_VERSION) {
      recomputeCounters(w);
      migrateWorld(w);
      const came = reinforceRulers(w, AI_RULERS);
      // a one-off wave of newcomers to liven the realm up (runs once, whatever restarts follow)
      const wave = welcomeWave(w, 'wave-2026-09-24', 35);
      if (wave > 0) console.log(`A wave of ${wave} new AI rulers arrived.`);
      w.config.aiCount = Math.max(w.config.aiCount, AI_TARGET);
      if (came > 0) console.log(`${came} AI rulers joined, for ${AI_RULERS} in all.`);
      recomputePlayerPoints(w);
      w.accounts ??= {};
      console.log(`Loaded world "${w.name}" with ${Object.keys(w.accounts).length} players.`);
      return w;
    }
  }
  return freshWorld();
}

/** A brand-new realm, as configured by the environment. */
/** A two-day round by default; the round length sets how much faster than a two-week round it runs. */
const ROUND_DAYS = Number(env.ROUND_DAYS || 2);
const ROUND_PACE = Math.max(1, 14 / ROUND_DAYS);

function freshWorld(pastRounds: RoundResult[] = []): World {
  const size = Math.max(Number(env.WORLD_SIZE || 0), SIZE_PRESETS.medium.size);
  const w = createWorld({
    worldName: env.WORLD_NAME || 'The Ashen Marches',
    playerName: '',
    villageName: '',
    multiplayer: true,
    config: {
      ...defaultConfig(),
      // WORLD_SPEED / WORLD_UNIT_SPEED are a standard two-week round's speeds; a shorter round
      // runs faster by the same ratio (economy in full, marches at most 4x: at 7x an attack ten
      // fields off would land in twenty seconds and nobody could answer it)
      speed: Math.round(Number(env.WORLD_SPEED || 150) * ROUND_PACE),
      unitSpeed: Math.round(Number(env.WORLD_UNIT_SPEED || 80) * Math.min(4, ROUND_PACE)),
      size,
      // a short round opens with its full company of rulers (a long one fills up over the first days)
      aiCount: ROUND_PACE > 1 ? AI_TARGET : AI_RULERS,
      difficulty: (env.WORLD_DIFFICULTY as Difficulty) || 'normal',
      roundDays: ROUND_DAYS,
      // troops train twice as fast again as the economy on a short round
      recruitBoost: Number(env.RECRUIT_BOOST || (ROUND_PACE > 1 ? 2 : 1)),
    },
  });
  w.accounts = {};
  // its usual size: newcomers keep it there (a long round opens smaller and fills up to it)
  w.config.aiCount = AI_TARGET;
  w.pastRounds = pastRounds;
  if (pastRounds.length > 0) w.name = `${env.WORLD_NAME || 'The Ashen Marches'} (round ${pastRounds.length + 1})`;
  console.log(`Created a new world "${w.name}".`);
  return w;
}

/** After a round ends, its final standings stay up for a while; then a fresh realm opens. */
const RESULTS_MS = Number(env.ROUND_RESULTS_MINUTES || 60) * 60_000;
let resetting = false;
async function maybeStartNextRound(): Promise<void> {
  if (resetting || !world.finished || world.now - world.finished.at < RESULTS_MS) return;
  await openNewRealm([...(world.pastRounds ?? []), world.finished]);
}

/** Archive the realm and open a fresh one; everyone connected is sent back to found a new village. */
async function openNewRealm(past: RoundResult[]): Promise<void> {
  if (resetting) return;
  resetting = true;
  try {
    await saveArchive(world);
    const honours = world.honours;
    world = freshWorld(past);
    world.honours = honours;
    clockBase = Date.now() - world.now;
    invalidateSpatial();
    pubCache = null;
    // nobody may act on the new realm with an old player id: clear them before anything else can run
    for (const c of clients) {
      c.pid = null;
      send(c, { t: 'reset' });
    }
    await saveWorld(true);
    console.log(`A new round has begun: "${world.name}".`);
  } finally {
    resetting = false;
  }
}

/** Keep the finished realm around (the last one only) in case anyone wants to look back at it. */
async function saveArchive(w: World): Promise<void> {
  if (!sb) {
    writeFileSync('world-dev-previous.json', JSON.stringify(w));
    return;
  }
  const { error } = await sb.from('world_state').upsert({ id: 2, data: w, updated_at: new Date().toISOString() });
  if (error) console.error('Could not archive the finished round:', error.message);
}

let saving = false;
async function saveWorld(force = false): Promise<void> {
  if (saving && !force) return;
  saving = true;
  try {
    await writeStored(world);
  } finally {
    saving = false;
  }
}

// ---------- clients ----------

interface Client {
  ws: WebSocket;
  userId: string | null;
  pid: number | null;
  sentRev: number;
  lastPublic: number;
  actions: number[];
  admin?: boolean;
}

const clients = new Set<Client>();

/**
 * A connection that is still working through what we sent it (a phone on a poor
 * signal, a sleeping tab) gets nothing new for now: every update replaces the last,
 * so it loses nothing, and the server never piles up unsent messages in memory.
 */
const BACKLOG = 512 * 1024;
const backedUp = (c: Client) => c.ws.bufferedAmount > BACKLOG;

function send(c: Client, m: ServerMsg) {
  if (c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(m));
}

/** The whole map is big (a megabyte and more): it goes out at most this often, whatever changes. */
const PUBLIC_EVERY = 30_000;
let pubCache: { rev: number; at: number; json: string } | null = null;
function sendPublic(c: Client, force = false) {
  if (c.ws.readyState !== c.ws.OPEN || (!force && backedUp(c))) return;
  // the public snapshot is the same for everyone: build it once, and not more often than it is sent
  if (!pubCache || (pubCache.rev !== world.mapRev && Date.now() - pubCache.at > PUBLIC_EVERY / 2)) {
    const snap = publicSnapshot(world);
    pubCache = { rev: world.mapRev, at: Date.now(), json: JSON.stringify({ t: 'public', rev: snap.rev, world: snap.world } satisfies ServerMsg) };
  }
  c.ws.send(pubCache.json);
  c.sentRev = pubCache.rev;
  c.lastPublic = Date.now();
}

function sendPrivate(c: Client, force = false) {
  if (c.pid === null || !world.players[c.pid]) return;
  if (!force && backedUp(c)) return;
  send(c, { t: 'private', packet: privatePacket(world, c.pid) });
}

async function authenticate(c: Client, token: string) {
  const user = await verify(token);
  if (!user) {
    send(c, { t: 'error', message: 'Your sign-in has expired. Please sign in again.' });
    c.ws.close();
    return;
  }
  c.userId = user.id;
  c.admin = user.admin;
  const pid = world.accounts?.[c.userId];
  c.pid = pid !== undefined && world.players[pid] ? pid : null;
  const humans = Object.values(world.players).filter((p) => p.kind === 'human').length;
  send(c, {
    t: 'hello',
    joined: c.pid !== null,
    suggestedName: user.name.slice(0, 24),
    worldName: world.name,
    players: humans,
    admin: c.admin || undefined,
  });
  if (c.pid !== null) {
    sendPublic(c, true);
    sendPrivate(c, true);
  }
}

function handle(c: Client, m: ClientMsg) {
  if (m.t === 'ping') return send(c, { t: 'pong', now: world.now });
  if (m.t === 'auth') return void authenticate(c, m.token);
  if (!c.userId) return send(c, { t: 'error', message: 'Sign in first.' });
  if (m.t === 'adminReset') {
    // only the realm's admin, and only with the realm's exact name typed as confirmation
    if (!c.admin) return send(c, { t: 'error', message: 'Only the realm\'s admin can do that.' });
    if (String(m.confirm ?? '') !== world.name) return send(c, { t: 'error', message: 'Type the realm\'s exact name to confirm.' });
    console.log(`The admin reset the realm "${world.name}".`);
    // the round ends here: its standings are recorded and its best player is honoured as champion
    finishRound(world);
    const champ = honourChampion(world);
    if (champ) console.log(`${champ} is honoured as champion of "${world.name}".`);
    void openNewRealm([...(world.pastRounds ?? []), ...(world.finished ? [world.finished] : [])]);
    return;
  }
  if (m.t === 'join') {
    if (c.pid !== null) return;
    if (world.finished) return send(c, { t: 'error', message: 'This round is over. A new realm opens soon.' });
    const p = spawnPlayer(world, String(m.name ?? ''), String(m.village ?? ''));
    if (!p) return send(c, { t: 'error', message: 'The realm is full.' });
    world.accounts![c.userId] = p.id;
    // honours won in earlier realms follow the player
    const won = world.honours?.[c.userId];
    if (won?.length) p.honours = [...won];
    c.pid = p.id;
    invalidateSpatial();
    sendPublic(c, true);
    sendPrivate(c, true);
    void saveWorld();
    return;
  }
  if (c.pid === null) return send(c, { t: 'error', message: 'Found your village first.' });
  if (m.t === 'act') {
    // simple flood protection: at most 25 actions per 5 seconds
    const now = Date.now();
    c.actions = c.actions.filter((t) => now - t < 5000);
    if (c.actions.length >= 25) return send(c, { t: 'result', id: m.id, result: { ok: false, error: 'Slow down a little.' } });
    c.actions.push(now);
    tick();
    const result = applyAction(world, c.pid, m.action);
    send(c, { t: 'result', id: m.id, result });
    if (m.action.type === 'restart' && result.ok) {
      invalidateSpatial();
      sendPublic(c, true);
      void saveWorld();
    }
    sendPrivate(c, true);
    return;
  }
  if (m.t === 'respawn') {
    const p = world.players[c.pid];
    if (!p?.eliminated || world.finished) return;
    respawnHuman(world, String(m.village ?? 'New Hope'), c.pid);
    sendPublic(c, true);
    sendPrivate(c, true);
  }
}

// ---------- loop ----------

function tick() {
  advance(world, Date.now() - clockBase);
  if (world.finished) void maybeStartNextRound();
}

async function main() {
  world = await loadWorld();
  clockBase = Date.now() - world.now;
  invalidateSpatial();
  await saveWorld();

  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(`Hearthwar server: ${world.name}, ${Object.keys(world.accounts ?? {}).length} players`);
  });
  // compress, but cheaply: a small instance has a tenth of a CPU and half a gigabyte to share
  const wss = new WebSocketServer({
    server,
    maxPayload: 64 * 1024,
    perMessageDeflate: { zlibDeflateOptions: { level: 1, memLevel: 7 }, serverMaxWindowBits: 13, threshold: 1024, concurrencyLimit: 2 },
  });
  wss.on('connection', (ws, req) => {
    const origin = req.headers.origin ?? '';
    if (ORIGINS.length && !ORIGINS.includes(origin)) {
      ws.close(1008, 'origin not allowed');
      return;
    }
    const c: Client = { ws, userId: null, pid: null, sentRev: -1, lastPublic: 0, actions: [] };
    clients.add(c);
    const authTimer = setTimeout(() => { if (!c.userId) ws.close(); }, 15_000);
    ws.on('message', (raw) => {
      try {
        handle(c, JSON.parse(String(raw)) as ClientMsg);
      } catch (e) {
        send(c, { t: 'error', message: 'Bad message.' });
        console.error(e);
      }
    });
    ws.on('close', () => {
      clearTimeout(authTimer);
      clients.delete(c);
    });
  });

  setInterval(tick, 250);
  // private packets every second; the (much bigger) public map when it has changed, at most every half minute
  setInterval(() => {
    for (const c of clients) {
      if (c.pid === null) continue;
      if (c.sentRev !== world.mapRev && Date.now() - c.lastPublic > PUBLIC_EVERY) sendPublic(c);
      sendPrivate(c);
    }
  }, 1000);
  // how the server is holding up, now and then in the log
  setInterval(() => {
    const m = process.memoryUsage();
    console.log(`health: heap ${Math.round(m.heapUsed / 1e6)} MB, rss ${Math.round(m.rss / 1e6)} MB, ${clients.size} connections`);
  }, 10 * 60_000);
  setInterval(() => void saveWorld(), 30_000);

  // Free hosts (like Render) put servers to sleep after 15 idle minutes, which
  // would freeze the world. Knocking on our own front door keeps it awake.
  const selfUrl = env.KEEPALIVE_URL || env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    setInterval(() => void fetch(selfUrl).catch(() => {}), 10 * 60_000);
    console.log(`Keep-alive pings ${selfUrl} every 10 minutes.`);
  }

  const shutdown = async () => {
    console.log('Saving before shutdown…');
    for (const c of clients) send(c, { t: 'shutdown' });
    await saveWorld();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  server.listen(PORT, () => console.log(`Hearthwar server listening on :${PORT}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
