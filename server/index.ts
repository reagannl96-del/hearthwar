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
import type { Difficulty, World } from '../src/engine/types';
import { recomputeCounters, recomputePlayerPoints } from '../src/engine/village';
import { SIZE_PRESETS, WORLD_VERSION, createWorld, defaultConfig, respawnHuman, spawnPlayer } from '../src/engine/world';
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

async function verify(token: string): Promise<{ id: string; name: string } | null> {
  if (!sb) return token.startsWith('dev:') ? { id: token, name: token.slice(4) || 'Tester' } : null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  const meta = data.user.user_metadata as Record<string, string | undefined>;
  return { id: data.user.id, name: meta.full_name || meta.name || data.user.email?.split('@')[0] || 'Wanderer' };
}

// ---------- world ----------

let world: World;
let clockBase = 0; // world.now = Date.now() - clockBase

async function loadWorld(): Promise<World> {
  if (env.RESET_WORLD !== 'yes') {
    const w = await readStored();
    if (w && w.version === WORLD_VERSION) {
      recomputeCounters(w);
      recomputePlayerPoints(w);
      w.accounts ??= {};
      console.log(`Loaded world "${w.name}" with ${Object.keys(w.accounts).length} players.`);
      return w;
    }
  }
  const size = Number(env.WORLD_SIZE || SIZE_PRESETS.medium.size);
  const w = createWorld({
    worldName: env.WORLD_NAME || 'The Ashen Marches',
    playerName: '',
    villageName: '',
    multiplayer: true,
    config: {
      ...defaultConfig(),
      speed: Number(env.WORLD_SPEED || 150),
      unitSpeed: Number(env.WORLD_UNIT_SPEED || 80),
      size,
      aiCount: Number(env.WORLD_AI || SIZE_PRESETS.medium.aiCount),
      difficulty: (env.WORLD_DIFFICULTY as Difficulty) || 'normal',
    },
  });
  w.accounts = {};
  console.log(`Created a new world "${w.name}".`);
  return w;
}

let saving = false;
async function saveWorld(): Promise<void> {
  if (saving) return;
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
}

const clients = new Set<Client>();

function send(c: Client, m: ServerMsg) {
  if (c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(m));
}

let pubCache: { rev: number; at: number; json: string } | null = null;
function sendPublic(c: Client) {
  // the public snapshot is the same for everyone; build it once per change
  if (!pubCache || pubCache.rev !== world.mapRev || Date.now() - pubCache.at > 60_000) {
    const snap = publicSnapshot(world);
    pubCache = { rev: world.mapRev, at: Date.now(), json: JSON.stringify({ t: 'public', rev: snap.rev, world: snap.world } satisfies ServerMsg) };
  }
  if (c.ws.readyState === c.ws.OPEN) c.ws.send(pubCache.json);
  c.sentRev = world.mapRev;
  c.lastPublic = Date.now();
}

function sendPrivate(c: Client) {
  if (c.pid === null || !world.players[c.pid]) return;
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
  const pid = world.accounts?.[c.userId];
  c.pid = pid !== undefined && world.players[pid] ? pid : null;
  const humans = Object.values(world.players).filter((p) => p.kind === 'human').length;
  send(c, {
    t: 'hello',
    joined: c.pid !== null,
    suggestedName: user.name.slice(0, 24),
    worldName: world.name,
    players: humans,
  });
  if (c.pid !== null) {
    sendPublic(c);
    sendPrivate(c);
  }
}

function handle(c: Client, m: ClientMsg) {
  if (m.t === 'ping') return send(c, { t: 'pong', now: world.now });
  if (m.t === 'auth') return void authenticate(c, m.token);
  if (!c.userId) return send(c, { t: 'error', message: 'Sign in first.' });
  if (m.t === 'join') {
    if (c.pid !== null) return;
    const p = spawnPlayer(world, String(m.name ?? ''), String(m.village ?? ''));
    if (!p) return send(c, { t: 'error', message: 'The realm is full.' });
    world.accounts![c.userId] = p.id;
    c.pid = p.id;
    invalidateSpatial();
    sendPublic(c);
    sendPrivate(c);
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
    sendPrivate(c);
    return;
  }
  if (m.t === 'respawn') {
    const p = world.players[c.pid];
    if (!p?.eliminated) return;
    respawnHuman(world, String(m.village ?? 'New Hope'), c.pid);
    sendPublic(c);
    sendPrivate(c);
  }
}

// ---------- loop ----------

function tick() {
  advance(world, Date.now() - clockBase);
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
  const wss = new WebSocketServer({ server, perMessageDeflate: true, maxPayload: 64 * 1024 });
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
  // private packets every second; the (bigger) public map only when it changes
  setInterval(() => {
    for (const c of clients) {
      if (c.pid === null) continue;
      if (c.sentRev !== world.mapRev && Date.now() - c.lastPublic > 4000) sendPublic(c);
      sendPrivate(c);
    }
  }, 1000);
  setInterval(() => void saveWorld(), 30_000);

  const shutdown = async () => {
    console.log('Saving before shutdown…');
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
