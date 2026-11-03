-- Blanks / No blanks for single games (games played outside a round).
-- Games inside a round use the round's blanks setting instead.
alter table public.mahjong_wins
  add column if not exists blanks boolean not null default false;
