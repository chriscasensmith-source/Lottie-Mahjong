-- 0007: one journal per signed-in person.
-- Every game and round gets an owner, and the database only shows or changes
-- rows for their owner. No existing row is deleted or rewritten.

-- 1) Owner columns. New rows are stamped with the signed-in user automatically.
alter table public.mahjong_wins
  add column if not exists user_id uuid references auth.users (id) default auth.uid();
alter table public.mahjong_rounds
  add column if not exists user_id uuid references auth.users (id) default auth.uid();
create index if not exists mahjong_wins_user_id_idx on public.mahjong_wins (user_id);
create index if not exists mahjong_rounds_user_id_idx on public.mahjong_rounds (user_id);

-- 2) Games logged before accounts existed have no owner (user_id is null).
--    They belong to the one person whose email is stored here. The address is
--    inserted by hand, not committed to the repo. Nobody can read this table
--    through the API: RLS is on and there are no policies.
create table if not exists public.mahjong_legacy_owner (
  email text primary key
);
alter table public.mahjong_legacy_owner enable row level security;

create or replace function public.mahjong_is_legacy_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mahjong_legacy_owner
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;
revoke all on function public.mahjong_is_legacy_owner() from public, anon;
grant execute on function public.mahjong_is_legacy_owner() to authenticated;

-- 3) Replace the "anyone with the link" policies with owner-only ones.
drop policy if exists "mahjong_wins anon read" on public.mahjong_wins;
drop policy if exists "mahjong_wins anon write" on public.mahjong_wins;
drop policy if exists "mahjong_wins anon update" on public.mahjong_wins;
drop policy if exists "mahjong_wins anon delete" on public.mahjong_wins;
drop policy if exists "mahjong_rounds anon read" on public.mahjong_rounds;
drop policy if exists "mahjong_rounds anon write" on public.mahjong_rounds;
drop policy if exists "mahjong_rounds anon update" on public.mahjong_rounds;
drop policy if exists "mahjong_rounds anon delete" on public.mahjong_rounds;

drop policy if exists "mahjong_wins owner read" on public.mahjong_wins;
drop policy if exists "mahjong_wins owner insert" on public.mahjong_wins;
drop policy if exists "mahjong_wins owner update" on public.mahjong_wins;
drop policy if exists "mahjong_wins owner delete" on public.mahjong_wins;
drop policy if exists "mahjong_rounds owner read" on public.mahjong_rounds;
drop policy if exists "mahjong_rounds owner insert" on public.mahjong_rounds;
drop policy if exists "mahjong_rounds owner update" on public.mahjong_rounds;
drop policy if exists "mahjong_rounds owner delete" on public.mahjong_rounds;

create policy "mahjong_wins owner read" on public.mahjong_wins
  for select to authenticated
  using (user_id = (select auth.uid()) or (user_id is null and (select public.mahjong_is_legacy_owner())));
create policy "mahjong_wins owner insert" on public.mahjong_wins
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "mahjong_wins owner update" on public.mahjong_wins
  for update to authenticated
  using (user_id = (select auth.uid()) or (user_id is null and (select public.mahjong_is_legacy_owner())))
  with check (user_id = (select auth.uid()) or (user_id is null and (select public.mahjong_is_legacy_owner())));
create policy "mahjong_wins owner delete" on public.mahjong_wins
  for delete to authenticated
  using (user_id = (select auth.uid()) or (user_id is null and (select public.mahjong_is_legacy_owner())));

create policy "mahjong_rounds owner read" on public.mahjong_rounds
  for select to authenticated
  using (user_id = (select auth.uid()) or (user_id is null and (select public.mahjong_is_legacy_owner())));
create policy "mahjong_rounds owner insert" on public.mahjong_rounds
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "mahjong_rounds owner update" on public.mahjong_rounds
  for update to authenticated
  using (user_id = (select auth.uid()) or (user_id is null and (select public.mahjong_is_legacy_owner())))
  with check (user_id = (select auth.uid()) or (user_id is null and (select public.mahjong_is_legacy_owner())));
create policy "mahjong_rounds owner delete" on public.mahjong_rounds
  for delete to authenticated
  using (user_id = (select auth.uid()) or (user_id is null and (select public.mahjong_is_legacy_owner())));

-- 4) The 4-game cap now also refuses a round the user can't see (someone
--    else's, or one that doesn't exist).
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
  if not found then
    raise exception 'round % is not yours', new.round_id
      using errcode = 'check_violation';
  end if;
  select count(*) into n from public.mahjong_wins where round_id = new.round_id;
  if n >= 4 then
    raise exception 'round % already has 4 games', new.round_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
