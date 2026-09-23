// Messages between the browser and the game server (JSON over WebSocket).

import type { Action } from '../engine/actions';
import type { PrivatePacket } from '../engine/shadow';
import type { ActionResult, World } from '../engine/types';

export type ClientMsg =
  | { t: 'auth'; token: string }
  | { t: 'join'; name: string; village: string }
  | { t: 'act'; id: number; action: Action }
  | { t: 'respawn'; village: string }
  | { t: 'ping' };

export type ServerMsg =
  | { t: 'hello'; joined: boolean; suggestedName: string; worldName: string; players: number }
  | { t: 'public'; rev: number; world: World }
  | { t: 'private'; packet: PrivatePacket }
  | { t: 'result'; id: number; result: ActionResult }
  | { t: 'error'; message: string }
  | { t: 'pong'; now: number }
  /** the server is going down (restart or redeploy); clients show Offline until it is back */
  | { t: 'shutdown' }
  /** the round is over and a fresh realm has opened: clients reload and found a new village */
  | { t: 'reset' };
