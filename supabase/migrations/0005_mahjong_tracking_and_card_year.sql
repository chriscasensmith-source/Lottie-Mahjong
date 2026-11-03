-- 0005: honest tracking flags, card year, round closing, and a 4-game cap.
-- Every change is additive. No existing value is rewritten.

-- 1) details_recorded: were jokers / self-drawn / blanks actually captured for
--    this game? The 540 games logged before 2026-11-03 only got those columns
--    from defaults (all false), so they must read as "not recorded", not "no".
--    Adding the column with default false marks every existing row as
--    untracked; switching the default to true marks every new row as tracked.
alter table public.mahjong_wins
  add column if not exists details_recorded boolean not null default false;
alter table public.mahjong_wins
  alter column details_recorded set default true;

-- 2) card_year: which NMJL card the game was played with. Hand ids are only
--    unique within one card, so progress must never mix card years.
--    Every game so far was played with the 2026 card.
alter table public.mahjong_wins
  add column if not exists card_year smallint not null default 2026;
create index if not exists mahjong_wins_card_year_idx
  on public.mahjong_wins (card_year);

-- 3) closed_at: set when a round is ended early. A closed round takes no more
--    games and counts as incomplete unless it already has 4 games.
alter table public.mahjong_rounds
  add column if not exists closed_at timestamptz;

-- 4) A round can never hold more than 4 games, even with two devices logging
--    at once. Locking the round row serializes concurrent inserts.
create or replace function public.mahjong_round_cap()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  if new.round_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.round_id is not distinct from old.round_id then
    return new;
  end if;
  perform 1 from public.mahjong_rounds where id = new.round_id for update;
  select count(*) into n from public.mahjong_wins where round_id = new.round_id;
  if n >= 4 then
    raise exception 'round % already has 4 games', new.round_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists mahjong_round_cap on public.mahjong_wins;
create trigger mahjong_round_cap
  before insert or update of round_id on public.mahjong_wins
  for each row execute function public.mahjong_round_cap();
