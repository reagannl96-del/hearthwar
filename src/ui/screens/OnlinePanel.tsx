import { useEffect, useState } from 'preact/hooks';
import { Connection } from '../../host/remote';
import { GAME_SERVER_URL, currentSession, devLogin, onSessionChange, signInWithGoogle, signOut, type SessionLite } from '../../net/supabase';
import { Btn } from '../components/common';
import { startHost } from '../store';

type Stage =
  | { s: 'checking' }
  | { s: 'signedOut' }
  | { s: 'ready'; session: SessionLite }
  | { s: 'connecting' }
  | { s: 'join'; conn: Connection; name: string; world: string; players: number }
  | { s: 'error'; message: string };

export function OnlinePanel() {
  const [stage, setStage] = useState<Stage>({ s: 'checking' });
  const [village, setVillage] = useState('');
  const [name, setName] = useState('');

  const refresh = () => void currentSession().then((session) => setStage((cur) => (cur.s === 'checking' || cur.s === 'signedOut' || cur.s === 'ready' ? (session ? { s: 'ready', session } : { s: 'signedOut' }) : cur)));
  useEffect(() => {
    refresh();
    return onSessionChange(refresh);
  }, []);

  const enter = async () => {
    setStage({ s: 'connecting' });
    const conn = new Connection(GAME_SERVER_URL!, async () => (await currentSession())?.access_token ?? null);
    try {
      const hello = await conn.open();
      if (hello.joined) {
        startHost(await conn.waitForWorld());
      } else {
        setName(hello.suggestedName);
        setStage({ s: 'join', conn, name: hello.suggestedName, world: hello.worldName, players: hello.players });
      }
    } catch (e) {
      conn.close();
      setStage({ s: 'error', message: (e as Error).message });
    }
  };

  const join = async (conn: Connection) => {
    const waiting = conn.waitForWorld();
    conn.send({ t: 'join', name: name.trim() || 'Wanderer', village: village.trim() || `${name.trim() || 'Wanderer'}'s hold` });
    setStage({ s: 'connecting' });
    startHost(await waiting);
  };

  const who = stage.s === 'ready' ? stage.session.name : '';

  return (
    <section class="online-card">
      <h2>The shared realm</h2>
      {stage.s === 'checking' && <p class="muted">Checking your sign-in…</p>}
      {stage.s === 'signedOut' && (
        <>
          <p>One world, played together. Sign in to claim your village among the other rulers.</p>
          <div>
            <button type="button" class="google-btn" onClick={() => void signInWithGoogle().then(refresh)}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.1C12.5 13.3 17.8 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17.1z" />
                <path fill="#FBBC05" d="M10.6 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.1z" />
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.7 2.3-8.7 2.3-6.2 0-11.5-3.8-13.4-9.2l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
              </svg>
              {devLogin ? 'Sign in (local test)' : 'Sign in with Google'}
            </button>
          </div>
        </>
      )}
      {stage.s === 'ready' && (
        <div class="row gap wrap">
          <span>Signed in as <b>{who}</b></span>
          <Btn onClick={() => void enter()}>Enter the realm</Btn>
          <Btn variant="quiet" onClick={() => void signOut().then(() => setStage({ s: 'signedOut' }))}>Sign out</Btn>
        </div>
      )}
      {stage.s === 'connecting' && <p class="muted">Riding to the realm…</p>}
      {stage.s === 'join' && (
        <form class="stack" onSubmit={(e) => { e.preventDefault(); void join(stage.conn); }}>
          <p>Welcome to <b>{stage.world}</b>. {stage.players > 0 ? `${stage.players} ${stage.players === 1 ? 'ruler has' : 'rulers have'} already claimed land.` : 'You are the first to arrive.'}</p>
          <div class="field-grid">
            <label class="field">
              <span>Your name</span>
              <input id="online-name" value={name} maxLength={24} onInput={(e) => setName(e.currentTarget.value)} />
            </label>
            <label class="field">
              <span>Village name</span>
              <input id="online-village" value={village} maxLength={32} placeholder={`${name || 'Wanderer'}'s hold`} onInput={(e) => setVillage(e.currentTarget.value)} />
            </label>
          </div>
          <div class="row gap end">
            <button type="submit" class="btn btn-primary">Found my village</button>
          </div>
        </form>
      )}
      {stage.s === 'error' && (
        <div class="row gap wrap">
          <span class="reason">{stage.message}</span>
          <Btn variant="ghost" onClick={() => void enter()}>Try again</Btn>
        </div>
      )}
    </section>
  );
}
