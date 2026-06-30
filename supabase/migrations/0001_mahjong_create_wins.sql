-- Mahjong hand tracker: win log.
-- Single-user app (no auth), so anon role is granted full access on this table.
-- (Applied to the Supabase project via MCP; kept here for version history.)
create table if not exists public.mahjong_wins (
  id uuid primary key default gen_random_uuid(),
  hand_id text not null,
  won_at timestamptz not null default now(),
  note text
);

create index if not exists mahjong_wins_hand_id_idx on public.mahjong_wins (hand_id);
create index if not exists mahjong_wins_won_at_idx on public.mahjong_wins (won_at desc);

alter table public.mahjong_wins enable row level security;

create policy "mahjong_wins anon read" on public.mahjong_wins
  for select to anon, authenticated using (true);
create policy "mahjong_wins anon write" on public.mahjong_wins
  for insert to anon, authenticated with check (true);
create policy "mahjong_wins anon update" on public.mahjong_wins
  for update to anon, authenticated using (true) with check (true);
create policy "mahjong_wins anon delete" on public.mahjong_wins
  for delete to anon, authenticated using (true);
