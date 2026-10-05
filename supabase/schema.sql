-- Hearthwar: run this once in Supabase (SQL Editor -> New query -> Run).
-- The game server keeps the one shared world here and saves it every 30 seconds.

create table if not exists public.world_state (
  id integer primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Lock the table down: only the game server (service role key) may read or write it.
alter table public.world_state enable row level security;

-- Single-player realms kept in the cloud for players signed in with Google, so a game
-- started on one device carries on on another. Each player sees and changes only their own.
create table if not exists public.solo_saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  meta jsonb not null,
  data text not null,               -- the save, gzipped and base64-encoded
  saved_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.solo_saves enable row level security;
drop policy if exists "own solo saves" on public.solo_saves;
create policy "own solo saves" on public.solo_saves
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
