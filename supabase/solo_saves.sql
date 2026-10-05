-- Run once in Supabase (SQL Editor -> New query -> Run) to turn on cloud saves for single player.
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
