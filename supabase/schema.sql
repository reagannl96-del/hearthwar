-- Hearthwar: run this once in Supabase (SQL Editor -> New query -> Run).
-- The game server keeps the one shared world here and saves it every 30 seconds.

create table if not exists public.world_state (
  id integer primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Lock the table down: only the game server (service role key) may read or write it.
alter table public.world_state enable row level security;
