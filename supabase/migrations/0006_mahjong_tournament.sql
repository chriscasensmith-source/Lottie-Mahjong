-- 0006: tournament games and the discarder penalty. Additive only.

-- Tournament games are single games played under tournament scoring.
-- No game before this migration was a tournament game.
alter table public.mahjong_wins
  add column if not exists tournament boolean not null default false;

-- On a tournament loss: did she discard the winning tile (-10 points)?
-- null = not asked (every non-tournament game, and all older games).
alter table public.mahjong_wins
  add column if not exists discarded_winner boolean;
