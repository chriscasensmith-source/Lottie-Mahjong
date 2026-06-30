-- Add game outcomes (win / loss / wall) to the games log.
-- The table keeps its original name (mahjong_wins) to preserve existing data,
-- but now records all game results. Wins reference a hand; losses and walls
-- have a null hand_id.
alter table public.mahjong_wins
  add column if not exists outcome text not null default 'win';

alter table public.mahjong_wins
  alter column hand_id drop not null;

alter table public.mahjong_wins
  drop constraint if exists mahjong_wins_outcome_chk;

alter table public.mahjong_wins
  add constraint mahjong_wins_outcome_chk check (
    (outcome = 'win' and hand_id is not null)
    or (outcome in ('loss', 'wall') and hand_id is null)
  );

create index if not exists mahjong_wins_outcome_idx on public.mahjong_wins (outcome);
