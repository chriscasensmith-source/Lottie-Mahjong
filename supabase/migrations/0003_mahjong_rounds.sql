-- Rounds: a set of up to 4 games played together, with a blanks house-rule flag.
create table if not exists public.mahjong_rounds (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  blanks boolean not null default false
);

create index if not exists mahjong_rounds_started_at_idx
  on public.mahjong_rounds (started_at desc);

alter table public.mahjong_rounds enable row level security;

drop policy if exists "mahjong_rounds anon read" on public.mahjong_rounds;
drop policy if exists "mahjong_rounds anon write" on public.mahjong_rounds;
drop policy if exists "mahjong_rounds anon update" on public.mahjong_rounds;
drop policy if exists "mahjong_rounds anon delete" on public.mahjong_rounds;

create policy "mahjong_rounds anon read" on public.mahjong_rounds
  for select to anon, authenticated using (true);
create policy "mahjong_rounds anon write" on public.mahjong_rounds
  for insert to anon, authenticated with check (true);
create policy "mahjong_rounds anon update" on public.mahjong_rounds
  for update to anon, authenticated using (true) with check (true);
create policy "mahjong_rounds anon delete" on public.mahjong_rounds
  for delete to anon, authenticated using (true);

-- Per-game details: which round, jokers used or not, and self-drawn wins.
alter table public.mahjong_wins
  add column if not exists round_id uuid
    references public.mahjong_rounds (id) on delete set null;
alter table public.mahjong_wins
  add column if not exists jokerless boolean not null default false;
alter table public.mahjong_wins
  add column if not exists self_drawn boolean not null default false;

create index if not exists mahjong_wins_round_id_idx
  on public.mahjong_wins (round_id);
