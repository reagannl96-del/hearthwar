// RemoteHost: plays in the shared online world. The server is authoritative; this
// host keeps a fog-of-war "shadow" world for the UI and forwards actions.

import { applyAction, type Action } from '../engine/actions';
import { mergeShadow, type PrivatePacket } from '../engine/shadow';
import { invalidateSpatial } from '../engine/spatial';
import type { ActionResult, World } from '../engine/types';
import type { ClientMsg, ServerMsg } from '../net/protocol';
import { HostBase } from './base';

type Hello = Extract<ServerMsg, { t: 'hello' }>;

export class RemoteHost extends HostBase {
  multiplayer = true;
  onServerError: ((msg: string) => void) | null = null;
  onConnection: ((up: boolean) => void) | null = null;
  private pub: World;
  private priv: PrivatePacket;
  private receivedAt = Date.now();
  private lastEmit = 0;
  private seqNo = 1;

  constructor(private conn: Connection, pub: World, priv: PrivatePacket) {
    super(mergeShadow(pub, priv), priv.pid);
    this.pub = pub;
    this.priv = priv;
    invalidateSpatial();
    conn.handler = (m) => this.onMessage(m);
    conn.onStatus = (up) => this.onConnection?.(up);
  }

  private rebuild() {
    this.world = mergeShadow(this.pub, this.priv);
    this.receivedAt = Date.now();
    this.invalidate();
    this.emit();
    this.lastEmit = Date.now();
  }

  private onMessage(m: ServerMsg) {
    if (m.t === 'public') {
      this.pub = m.world;
      invalidateSpatial();
      this.resetMapCache();
      this.rebuild();
    } else if (m.t === 'private') {
      this.priv = m.packet;
      this.rebuild();
    } else if (m.t === 'result') {
      if (!m.result.ok && m.result.error) this.onServerError?.(m.result.error);
    } else if (m.t === 'error') {
      this.onServerError?.(m.message);
    }
  }

  tick(): void {
    // run the shadow clock forward between packets so timers and resources flow smoothly
    this.world.now = this.priv.now + (Date.now() - this.receivedAt);
    if (Date.now() - this.lastEmit >= 1000) {
      this.invalidate();
      this.emit();
      this.lastEmit = Date.now();
    }
  }

  act(a: Action): ActionResult {
    // check it against what we know first, for instant feedback; the server decides for real
    const local = applyAction(this.world, this.pid, a);
    if (!local.ok) return local;
    this.invalidate();
    queueMicrotask(() => this.emit());
    this.conn.send({ t: 'act', id: this.seqNo++, action: a });
    return local;
  }

  respawn(name: string): boolean {
    this.conn.send({ t: 'respawn', village: name });
    return true;
  }

  async save(): Promise<void> {
    /* the server saves the world */
  }

  close() {
    this.conn.close();
  }
}

/** A WebSocket to the game server that reconnects on its own. */
export class Connection {
  handler: ((m: ServerMsg) => void) | null = null;
  onStatus: ((up: boolean) => void) | null = null;
  private ws: WebSocket | null = null;
  private closed = false;
  private queue: ClientMsg[] = [];
  private ping: ReturnType<typeof setInterval> | null = null;

  constructor(private url: string, private getToken: () => Promise<string | null>) {}

  open(): Promise<Hello> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      let greeted = false;
      ws.onopen = async () => {
        const token = await this.getToken();
        if (!token) {
          reject(new Error('Please sign in again.'));
          ws.close();
          return;
        }
        ws.send(JSON.stringify({ t: 'auth', token } satisfies ClientMsg));
      };
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data as string) as ServerMsg;
        if (m.t === 'hello' && !greeted) {
          greeted = true;
          this.onStatus?.(true);
          for (const q of this.queue.splice(0)) ws.send(JSON.stringify(q));
          resolve(m);
          return;
        }
        if (m.t === 'error' && !greeted) {
          reject(new Error(m.message));
          return;
        }
        this.handler?.(m);
      };
      ws.onerror = () => {
        if (!greeted) reject(new Error('Could not reach the game server.'));
      };
      ws.onclose = () => {
        this.onStatus?.(false);
        if (greeted && !this.closed) setTimeout(() => this.reconnect(), 2000);
      };
      if (this.ping) clearInterval(this.ping);
      this.ping = setInterval(() => this.send({ t: 'ping' }), 25_000);
    });
  }

  private async reconnect() {
    if (this.closed) return;
    try {
      await this.open();
    } catch {
      setTimeout(() => this.reconnect(), 5000);
    }
  }

  send(m: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else this.queue.push(m);
  }

  /** Wait for the first public + private packets, then hand over a RemoteHost. */
  waitForWorld(): Promise<RemoteHost> {
    return new Promise((resolve) => {
      let pub: World | null = null;
      let priv: PrivatePacket | null = null;
      this.handler = (m) => {
        if (m.t === 'public') pub = m.world;
        if (m.t === 'private') priv = m.packet;
        if (pub && priv) resolve(new RemoteHost(this, pub, priv));
      };
    });
  }

  close() {
    this.closed = true;
    if (this.ping) clearInterval(this.ping);
    this.ws?.close();
  }
}
